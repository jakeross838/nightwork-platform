/**
 * Stage-1 extraction pipeline.
 *
 * Called by the invoice save flow immediately after an invoice + its
 * invoice_line_items rows have been persisted.
 *
 * For each invoice line item:
 *   1. Build vendor context (aliases + past corrections).
 *   2. Run matchItem (tiered alias → trigram → AI semantic → AI new).
 *   3. Persist an invoice_extraction_lines row (pending verification).
 *
 * Then, per-org settings decide whether high-confidence lines auto-commit
 * straight to the spine (vendor_item_pricing) or wait for human verification.
 *
 * Idempotent: if an invoice_extractions row already exists, reuses it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildVendorContext, matchItem } from "./match-item";
import { commitLineToSpine } from "./commit-line-to-spine";
import {
  applyAllocationsToLines,
  computeAllocations,
  detectOverheadLine,
  type AllocationLine,
} from "./allocate-overhead";
import { detectTransactionLine } from "./classify-transaction-line";
import {
  classifyLineNatures,
  type ClassifierLineInput,
  type LineClassification,
  type LineNature,
  type SkippedLineResult,
  type SkipReason,
} from "./classify-line-natures";
import type {
  CostIntelligenceSettings,
  InvoiceExtractionLineRow,
  InvoiceExtractionRow,
  MatchResult,
  ExtractedComponent,
  ComponentType,
  ProposedItemData,
} from "./types";

/**
 * Map a line's proposed item_type to the default component_type used when
 * the AI did not return an explicit breakdown. Mirrors migration 00056's
 * backfill logic so historical and newly-staged rows classify consistently.
 *
 * Scope items (subcontract / service / labor trade work) always default to
 * 'labor_and_material' per migration 00057. Unit items fall back to
 * material-ish types.
 */
function defaultComponentTypeFor(
  proposal: ProposedItemData | null | undefined,
  pricingModel: "unit" | "scope" = "unit"
): ComponentType {
  if (pricingModel === "scope") return "labor_and_material";
  switch (proposal?.item_type) {
    case "labor":
    case "service":
      return "labor_and_material";
    case "equipment":
      return "equipment_rental";
    case "subcontract":
      return "labor_and_material";
    default:
      return "material";
  }
}

async function persistLineComponents(
  supabase: SupabaseClient,
  orgId: string,
  extractionLineId: string,
  lineTotalCents: number,
  detected: ExtractedComponent[],
  proposal: ProposedItemData | null,
  pricingModel: "unit" | "scope" = "unit"
): Promise<void> {
  // Scope items always get a single labor_and_material component (subs
  // don't split). Only unit items use the AI-extracted breakdown.
  if (pricingModel === "scope") {
    const { error } = await supabase.from("line_cost_components").insert([
      {
        org_id: orgId,
        invoice_extraction_line_id: extractionLineId,
        component_type: "labor_and_material" as ComponentType,
        amount_cents: lineTotalCents,
        source: "default_bundled",
        notes: null,
        quantity: null,
        unit: null,
        unit_rate_cents: null,
        display_order: 0,
      },
    ]);
    if (error) {
      console.warn(
        `[extract] scope component insert failed for line ${extractionLineId}: ${error.message}`
      );
    }
    return;
  }

  const sum = detected.reduce((s, c) => s + c.amount_cents, 0);
  const mismatch = Math.abs(sum - lineTotalCents) > 5;

  const rows: Array<{
    org_id: string;
    invoice_extraction_line_id: string;
    component_type: ComponentType;
    amount_cents: number;
    source: string;
    notes: string | null;
    quantity: number | null;
    unit: string | null;
    unit_rate_cents: number | null;
    display_order: number;
  }> =
    detected.length > 0 && !mismatch
      ? detected.map((c, i) => ({
          org_id: orgId,
          invoice_extraction_line_id: extractionLineId,
          component_type: c.component_type,
          amount_cents: c.amount_cents,
          source: c.source,
          notes: c.notes ?? null,
          quantity: c.quantity ?? null,
          unit: c.unit ?? null,
          unit_rate_cents: c.unit_rate_cents ?? null,
          display_order: i,
        }))
      : [
          {
            org_id: orgId,
            invoice_extraction_line_id: extractionLineId,
            component_type: defaultComponentTypeFor(proposal, pricingModel),
            amount_cents: lineTotalCents,
            source: "default_bundled",
            notes: null,
            quantity: null,
            unit: null,
            unit_rate_cents: null,
            display_order: 0,
          },
        ];

  if (mismatch) {
    console.warn(
      `[extract] component sum $${(sum / 100).toFixed(2)} does not match line total $${(
        lineTotalCents / 100
      ).toFixed(2)} on line ${extractionLineId} — falling back to default_bundled`
    );
  }

  const { error } = await supabase.from("line_cost_components").insert(rows);
  if (error) {
    console.warn(`[extract] component insert failed for line ${extractionLineId}: ${error.message}`);
  }
}

const EXTRACTION_PROMPT_VERSION = "v1.2";
const EXTRACTION_MODEL = "claude-sonnet-4-20250514";

/**
 * Map the regex detector's transaction_line_type into the skipped_lines
 * skip_reason taxonomy stored on invoice_extractions.skipped_lines. Keeps the
 * skip_reason vocabulary stable whether the regex or the AI flagged the row.
 */
function regexTransactionToSkipReason(
  type: string | null | undefined
): SkipReason {
  switch (type) {
    case "draw":
      return "draw";
    case "progress_payment":
      return "progress_payment";
    case "change_order_narrative":
      return "change_order_narrative";
    case "partial_payment":
      return "flagged_transaction";
    case "rental_period":
    case "service_period":
      return "flagged_transaction";
    case "zero_dollar_note":
      return "admin_note";
    default:
      return "other_non_item";
  }
}

interface InvoiceOverheadEntry {
  type: string;
  amount_cents: number;
  description: string;
  source_line_id: string;
}

function dollarsToCents(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export interface ExtractInvoiceOptions {
  /** Force re-extraction even if an extraction row already exists. */
  reextract?: boolean;
  /** Override the invoice's stored org_id (rarely needed). */
  orgIdOverride?: string;
  /** User triggering the extraction (for auto-commit audit trail). */
  triggeredBy?: string | null;
}

export interface ExtractInvoiceReport {
  extraction_id: string;
  invoice_id: string;
  lines_staged: number;
  lines_auto_committed: number;
  lines_pending: number;
  new_items_proposed: number;
  matched_existing_items: number;
  match_tier_breakdown: Record<string, number>;
  skipped_existing: boolean;
}

type InvoiceSlim = {
  id: string;
  org_id: string;
  vendor_id: string | null;
  vendor_name_raw: string | null;
  invoice_date: string | null;
  original_file_url: string | null;
  total_amount: number | null;
  ai_raw_response: {
    subtotal?: number | null;
    tax?: number | null;
    total_amount?: number | null;
  } | null;
};

type InvoiceLineSlim = {
  id: string;
  line_index: number;
  description: string | null;
  qty: number | null;
  unit: string | null;
  rate: number | null;
  amount_cents: number;
};

export async function extractInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  opts: ExtractInvoiceOptions = {}
): Promise<ExtractInvoiceReport> {
  // 1. Load invoice
  const { data: invoiceRow, error: invoiceErr } = await supabase
    .from("invoices")
    .select(
      "id, org_id, vendor_id, vendor_name_raw, invoice_date, original_file_url, total_amount, ai_raw_response"
    )
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .single();

  if (invoiceErr || !invoiceRow) {
    throw new Error(`extractInvoice: invoice ${invoiceId} not found: ${invoiceErr?.message}`);
  }

  const invoice = invoiceRow as InvoiceSlim;
  const orgId = opts.orgIdOverride ?? invoice.org_id;

  if (!orgId) {
    throw new Error(`extractInvoice: invoice ${invoiceId} missing org_id`);
  }

  // 2. Check for existing extraction row (idempotency)
  const { data: existingExtractionRaw } = await supabase
    .from("invoice_extractions")
    .select("*")
    .eq("invoice_id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle();

  const existingExtraction = existingExtractionRaw as InvoiceExtractionRow | null;

  if (existingExtraction && !opts.reextract) {
    const { data: lines } = await supabase
      .from("invoice_extraction_lines")
      .select("id, verification_status")
      .eq("extraction_id", existingExtraction.id)
      .is("deleted_at", null);

    const lineRows = (lines ?? []) as Array<{ id: string; verification_status: string }>;
    return {
      extraction_id: existingExtraction.id,
      invoice_id: invoiceId,
      lines_staged: lineRows.length,
      lines_auto_committed: lineRows.filter((l) => l.verification_status === "auto_committed").length,
      lines_pending: lineRows.filter((l) => l.verification_status === "pending").length,
      new_items_proposed: 0,
      matched_existing_items: 0,
      match_tier_breakdown: {},
      skipped_existing: true,
    };
  }

  // 3. Load invoice line items
  const { data: lineData } = await supabase
    .from("invoice_line_items")
    .select("id, line_index, description, qty, unit, rate, amount_cents")
    .eq("invoice_id", invoiceId)
    .is("deleted_at", null)
    .order("line_index", { ascending: true });

  const lineItems = (lineData ?? []) as InvoiceLineSlim[];

  // 4. Build vendor context once
  const vendorContext = await buildVendorContext(
    supabase,
    orgId,
    invoice.vendor_id,
    invoice.vendor_name_raw
  );

  // 5. Load org settings for auto-commit gate
  const settings = await loadOrgSettings(supabase, orgId);

  // 5b. Pull invoice-level totals (tax / subtotal / total) from the Claude
  //     Vision response captured at upload time. Stored as dollars — convert.
  const aiResp = invoice.ai_raw_response ?? null;
  const invoiceSubtotalCents = dollarsToCents(aiResp?.subtotal);
  const invoiceTaxCents = dollarsToCents(aiResp?.tax) ?? 0;
  const invoiceTotalFromAiCents = dollarsToCents(aiResp?.total_amount);
  const invoiceTotalCents = invoiceTotalFromAiCents ?? invoice.total_amount ?? null;
  const invoiceTaxRate =
    invoiceSubtotalCents && invoiceSubtotalCents > 0 && invoiceTaxCents > 0
      ? Number((invoiceTaxCents / invoiceSubtotalCents).toFixed(4))
      : null;

  // 6. Create (or update) the extraction row
  let extractionId: string;
  if (existingExtraction) {
    // Reset for re-extraction: soft-delete any components tied to old lines
    // first (so the UI doesn't see orphaned components), then soft-delete
    // the lines themselves.
    const { data: oldLineIds } = await supabase
      .from("invoice_extraction_lines")
      .select("id")
      .eq("extraction_id", existingExtraction.id)
      .is("deleted_at", null);

    const ids = ((oldLineIds ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (ids.length > 0) {
      await supabase
        .from("line_cost_components")
        .update({ deleted_at: new Date().toISOString() })
        .in("invoice_extraction_line_id", ids)
        .is("deleted_at", null);
    }

    await supabase
      .from("invoice_extraction_lines")
      .update({ deleted_at: new Date().toISOString() })
      .eq("extraction_id", existingExtraction.id);

    // Also soft-delete any prior BOM attachments tied to the extraction's
    // lines — re-extraction rebuilds them fresh. Note lines themselves are
    // soft-deleted just above; this is the belt-and-braces step for any
    // attachment rows that would otherwise hang off dead lines.
    if (ids.length > 0) {
      await supabase
        .from("line_bom_attachments")
        .update({ deleted_at: new Date().toISOString() })
        .or(`scope_extraction_line_id.in.(${ids.join(",")}),bom_extraction_line_id.in.(${ids.join(",")})`)
        .is("deleted_at", null);
    }

    extractionId = existingExtraction.id;
    await supabase
      .from("invoice_extractions")
      .update({
        extracted_at: new Date().toISOString(),
        extraction_model: EXTRACTION_MODEL,
        extraction_prompt_version: EXTRACTION_PROMPT_VERSION,
        verification_status: "pending",
        verified_lines_count: 0,
        total_lines_count: lineItems.length,
        verified_at: null,
        verified_by: null,
        auto_committed: false,
        auto_commit_reason: null,
        invoice_subtotal_cents: invoiceSubtotalCents,
        invoice_tax_cents: invoiceTaxCents,
        invoice_tax_rate: invoiceTaxRate,
        invoice_overhead: [],
        invoice_total_cents: invoiceTotalCents,
        skipped_lines: [],
      })
      .eq("id", extractionId);
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("invoice_extractions")
      .insert({
        org_id: orgId,
        invoice_id: invoiceId,
        raw_pdf_url: invoice.original_file_url,
        extraction_model: EXTRACTION_MODEL,
        extraction_prompt_version: EXTRACTION_PROMPT_VERSION,
        field_confidences: {},
        verification_status: "pending",
        total_lines_count: lineItems.length,
        invoice_subtotal_cents: invoiceSubtotalCents,
        invoice_tax_cents: invoiceTaxCents,
        invoice_tax_rate: invoiceTaxRate,
        invoice_overhead: [],
        invoice_total_cents: invoiceTotalCents,
        skipped_lines: [],
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      throw new Error(`extractInvoice: failed to create extraction: ${insertErr?.message}`);
    }
    extractionId = inserted.id as string;
  }

  // 7. THREE-PHASE LINE PIPELINE
  //
  //   A. Regex pre-filter: detect overhead (delivery/freight) + transaction
  //      lines (draws, progress payments, CO narratives). Overhead still gets
  //      a line row with is_allocated_overhead=true. Transaction lines are
  //      collected into skippedBuffer and NEVER persisted — their raw content
  //      lives on invoice_extractions.skipped_lines for audit.
  //
  //   B. Invoice-level AI classifier (classifyLineNatures): assigns
  //      line_nature to everything the regex didn't pre-filter, identifies
  //      additional admin notes/non-item lines to skip, and proposes BOM
  //      attachments from $0 spec lines to scope lines on the same invoice.
  //
  //   C. Per-line matchItem: runs only on real catalog lines (nature in
  //      material / labor / scope / equipment / service / unclassified). BOM
  //      spec lines get a lightweight insert with line_nature='bom_spec' and
  //      no matchItem / no components.

  const tierBreakdown: Record<string, number> = {};
  let newItemsProposed = 0;
  let matchedExisting = 0;

  const insertedLines: Array<{ id: string; match: MatchResult; rawTotalCents: number }> = [];
  const overheadEntries: InvoiceOverheadEntry[] = [];
  const skippedBuffer: SkippedLineResult[] = [];
  // Maps the invoice-line's line_index (NOT extraction_line_id) to the DB id
  // of the extraction_line we persisted. Used to resolve BOM attachment
  // target references after all lines are inserted.
  const lineIdByIndex = new Map<number, string>();

  // Lines that survive the regex pre-filter and need AI nature classification.
  const classifyBucket: Array<{
    li: InvoiceLineSlim;
    rawTotalCents: number;
    rawUnitPriceCents: number | null;
  }> = [];

  for (const li of lineItems) {
    const rawTotalCents = li.amount_cents ?? 0;
    const rawUnitPriceCents =
      li.rate != null && Number.isFinite(li.rate) ? Math.round(li.rate * 100) : null;

    const overhead = detectOverheadLine(li.description);
    const transaction = !overhead ? detectTransactionLine(li.description) : null;

    if (transaction?.is_transaction) {
      // Collect into skippedBuffer, do NOT persist as extraction_line. The
      // queue should never see these rows.
      skippedBuffer.push({
        line_index: li.line_index ?? 0,
        raw_description: li.description ?? "",
        amount_cents: rawTotalCents,
        skip_reason: regexTransactionToSkipReason(transaction.type),
        detected_type: transaction.type ?? "other",
      });
      tierBreakdown["skipped_regex_transaction"] =
        (tierBreakdown["skipped_regex_transaction"] ?? 0) + 1;
      continue;
    }

    if (overhead) {
      // Overhead lines: stage them with is_allocated_overhead=true but do not
      // run matchItem (we're not trying to catalog "delivery charge" as an
      // item). They stay visible in the verification UI, greyed out.
      const { data: oRow, error: oErr } = await supabase
        .from("invoice_extraction_lines")
        .insert({
          org_id: orgId,
          extraction_id: extractionId,
          invoice_line_item_id: li.id,
          line_order: li.line_index ?? 0,
          raw_description: li.description ?? "",
          raw_quantity: li.qty,
          raw_unit_price_cents: rawUnitPriceCents,
          raw_total_cents: rawTotalCents,
          raw_unit_text: li.unit,
          proposed_item_id: null,
          proposed_item_data: null,
          match_tier: null,
          match_confidence: null,
          match_reasoning: `Detected invoice-level ${overhead.overhead_type} charge — allocated proportionally to real lines`,
          candidates_considered: null,
          verification_status: "pending",
          is_allocated_overhead: true,
          overhead_type: overhead.overhead_type,
        })
        .select("id")
        .single();

      if (oErr || !oRow) {
        console.warn(
          `[extract] overhead line insert failed: ${oErr?.message}`
        );
        continue;
      }
      overheadEntries.push({
        type: overhead.overhead_type,
        amount_cents: rawTotalCents,
        description: li.description ?? "",
        source_line_id: oRow.id as string,
      });
      tierBreakdown["overhead_allocated"] = (tierBreakdown["overhead_allocated"] ?? 0) + 1;
      continue;
    }

    classifyBucket.push({ li, rawTotalCents, rawUnitPriceCents });
  }

  // Phase B — invoice-level AI classifier.
  const classifierInput: ClassifierLineInput[] = classifyBucket.map(({ li, rawTotalCents, rawUnitPriceCents }) => ({
    line_index: li.line_index ?? 0,
    description: li.description ?? "",
    amount_cents: rawTotalCents,
    qty: li.qty,
    unit: li.unit,
    rate_cents: rawUnitPriceCents,
  }));

  const classification =
    classifierInput.length > 0
      ? await classifyLineNatures(classifierInput, {
          org_id: orgId,
          user_id: opts.triggeredBy ?? null,
          invoice_id: invoiceId,
          vendor_name: invoice.vendor_name_raw,
        })
      : { lines: [], skipped_lines: [] };

  const natureByIndex = new Map<number, LineClassification>();
  for (const entry of classification.lines) {
    natureByIndex.set(entry.line_index, entry);
  }
  for (const entry of classification.skipped_lines) {
    skippedBuffer.push(entry);
    tierBreakdown["skipped_ai"] = (tierBreakdown["skipped_ai"] ?? 0) + 1;
  }

  // Proposals collected here; resolved to DB ids after all lines are inserted.
  interface BomProposalPending {
    bom_line_index: number;
    scope_line_index: number;
    confidence: number;
    reasoning: string;
    product_description: string | null;
    product_specs: Record<string, unknown>;
  }
  const bomProposals: BomProposalPending[] = [];

  // Phase C — insert real lines (+ bom_spec lines) and run matchItem on real ones.
  for (const { li, rawTotalCents, rawUnitPriceCents } of classifyBucket) {
    const cls = natureByIndex.get(li.line_index ?? 0);
    if (!cls) continue; // AI moved it to skipped_lines — nothing to insert.

    if (cls.line_nature === "bom_spec") {
      // BOM spec lines do NOT get an item match or component rows — they're
      // product descriptions attached to a scope line.
      const { data: bRow, error: bErr } = await supabase
        .from("invoice_extraction_lines")
        .insert({
          org_id: orgId,
          extraction_id: extractionId,
          invoice_line_item_id: li.id,
          line_order: li.line_index ?? 0,
          raw_description: li.description ?? "",
          raw_quantity: li.qty,
          raw_unit_price_cents: rawUnitPriceCents,
          raw_total_cents: rawTotalCents,
          raw_unit_text: li.unit,
          proposed_item_id: null,
          proposed_item_data: null,
          match_tier: null,
          match_confidence: null,
          match_confidence_score: null,
          classification_confidence: cls.nature_confidence,
          match_reasoning: `BOM spec line (confidence ${cls.nature_confidence.toFixed(2)}): ${cls.nature_reasoning}`,
          candidates_considered: null,
          verification_status: "pending",
          line_nature: "bom_spec",
        })
        .select("id")
        .single();

      if (bErr || !bRow) {
        console.warn(`[extract] bom_spec insert failed: ${bErr?.message}`);
        continue;
      }
      lineIdByIndex.set(li.line_index ?? 0, bRow.id as string);
      tierBreakdown["bom_spec"] = (tierBreakdown["bom_spec"] ?? 0) + 1;

      if (cls.proposed_bom_attachment) {
        bomProposals.push({
          bom_line_index: li.line_index ?? 0,
          scope_line_index: cls.proposed_bom_attachment.target_line_index,
          confidence: cls.proposed_bom_attachment.confidence,
          reasoning: cls.proposed_bom_attachment.reasoning,
          product_description: cls.proposed_bom_attachment.product_description,
          product_specs: cls.proposed_bom_attachment.product_specs,
        });
      }
      continue;
    }

    // Real catalog line — run matchItem as before, persist with line_nature.
    const match = await matchItem(
      supabase,
      {
        raw_description: li.description ?? "",
        raw_quantity: li.qty,
        raw_unit_price_cents: rawUnitPriceCents,
        raw_total_cents: rawTotalCents,
        raw_unit_text: li.unit,
      },
      vendorContext,
      { org_id: orgId, user_id: opts.triggeredBy ?? null, invoice_id: invoiceId }
    );

    tierBreakdown[match.created_via] = (tierBreakdown[match.created_via] ?? 0) + 1;
    if (match.item_id) matchedExisting++;
    else newItemsProposed++;

    // line_nature is authoritative from the classifier. But when the
    // classifier said 'unclassified', we still honor it and surface in the
    // Review tab — we do NOT try to infer from item_type here.
    const resolvedNature: LineNature = cls.line_nature;

    const { data: lineInsert, error: lineErr } = await supabase
      .from("invoice_extraction_lines")
      .insert({
        org_id: orgId,
        extraction_id: extractionId,
        invoice_line_item_id: li.id,
        line_order: li.line_index ?? 0,
        raw_description: li.description ?? "",
        raw_quantity: li.qty,
        raw_unit_price_cents: rawUnitPriceCents,
        raw_total_cents: rawTotalCents,
        raw_unit_text: li.unit,
        proposed_item_id: match.item_id,
        proposed_item_data: match.proposed_item_data,
        match_tier: match.created_via,
        match_confidence: match.confidence,
        match_confidence_score: match.match_confidence,
        classification_confidence: match.classification_confidence,
        match_reasoning: match.reasoning,
        candidates_considered: match.candidates_considered,
        verification_status: "pending",
        proposed_pricing_model: match.pricing_model,
        proposed_scope_size_metric:
          match.pricing_model === "scope" ? match.scope_size_metric : null,
        extracted_scope_size_value:
          match.pricing_model === "scope" ? match.scope_size_value : null,
        extracted_scope_size_confidence:
          match.pricing_model === "scope" ? match.scope_size_confidence : null,
        extracted_scope_size_source:
          match.pricing_model === "scope" ? match.scope_size_source : null,
        line_nature: resolvedNature,
      })
      .select("id")
      .single();

    if (lineErr || !lineInsert) {
      console.warn(`[extract] line insert failed for invoice ${invoiceId} line ${li.id}: ${lineErr?.message}`);
      continue;
    }

    lineIdByIndex.set(li.line_index ?? 0, lineInsert.id as string);

    await persistLineComponents(
      supabase,
      orgId,
      lineInsert.id as string,
      rawTotalCents,
      match.components,
      match.proposed_item_data,
      match.pricing_model
    );

    insertedLines.push({
      id: lineInsert.id as string,
      match,
      rawTotalCents,
    });
  }

  // 7b. Persist accumulated skipped_lines on the extraction row.
  if (skippedBuffer.length > 0) {
    await supabase
      .from("invoice_extractions")
      .update({
        skipped_lines: skippedBuffer.map((s) => ({
          line_index: s.line_index,
          raw_description: s.raw_description,
          amount_cents: s.amount_cents,
          skip_reason: s.skip_reason,
          detected_type: s.detected_type,
        })),
      })
      .eq("id", extractionId);
  }

  // 7c. Create BOM attachments. Confidence tiering:
  //       >= 0.85 → ai_auto + confirmed
  //       0.5-0.85 → ai_suggested + pending
  //       < 0.5 → drop (classifier should already have classified as
  //                unclassified, but be defensive)
  let bomAutoConfirmed = 0;
  let bomSuggested = 0;
  for (const prop of bomProposals) {
    const bomLineId = lineIdByIndex.get(prop.bom_line_index);
    const scopeLineId = lineIdByIndex.get(prop.scope_line_index);
    if (!bomLineId || !scopeLineId) continue;
    // Target must be a scope line — classifier should guarantee this but
    // verify against our insertedLines metadata to catch prompt drift.
    const scopeInserted = insertedLines.find((l) => l.id === scopeLineId);
    if (!scopeInserted) continue;
    if (prop.confidence < 0.5) continue;

    const source = prop.confidence >= 0.85 ? "ai_auto" : "ai_suggested";
    const status = source === "ai_auto" ? "confirmed" : "pending";

    const { error: bErr } = await supabase.from("line_bom_attachments").insert({
      org_id: orgId,
      scope_extraction_line_id: scopeLineId,
      bom_extraction_line_id: bomLineId,
      ai_confidence: prop.confidence,
      ai_reasoning: prop.reasoning,
      attachment_source: source,
      confirmation_status: status,
      confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
      product_description: prop.product_description,
      product_specs: prop.product_specs,
    });

    if (bErr) {
      console.warn(
        `[extract] BOM attachment insert failed (scope=${scopeLineId}, bom=${bomLineId}): ${bErr.message}`
      );
      continue;
    }
    if (source === "ai_auto") bomAutoConfirmed++;
    else bomSuggested++;
  }
  if (bomAutoConfirmed > 0) tierBreakdown["bom_ai_auto"] = bomAutoConfirmed;
  if (bomSuggested > 0) tierBreakdown["bom_ai_suggested"] = bomSuggested;

  // 7b. Persist detected overhead on the extraction + run allocation pass
  if (overheadEntries.length > 0) {
    await supabase
      .from("invoice_extractions")
      .update({ invoice_overhead: overheadEntries })
      .eq("id", extractionId);
  }

  const overheadTotalCents = overheadEntries.reduce((s, o) => s + o.amount_cents, 0);
  if (overheadTotalCents > 0 || invoiceTaxCents > 0) {
    const allocationLines: AllocationLine[] = insertedLines.map((s) => ({
      id: s.id,
      raw_total_cents: s.rawTotalCents,
      is_allocated_overhead: false,
      line_is_taxable: null,
    }));
    const result = computeAllocations(allocationLines, overheadTotalCents, invoiceTaxCents);
    await applyAllocationsToLines(supabase, result);
  }

  // 8. Auto-commit pass (if org enabled):
  //    - alias_match / trigram_match ALWAYS auto-commit — these are
  //      deterministic matches against vendor-scoped prior verifications.
  //    - ai_semantic_match only if confidence >= org threshold (default 0.95).
  //    - ai_new_item NEVER auto-commits — new items always need a human eye
  //      before joining the catalog.
  let linesAutoCommitted = 0;
  let autoCommitReason: string | null = null;
  if (settings.auto_commit_enabled && invoice.vendor_id) {
    const threshold = settings.auto_commit_threshold;
    for (const staged of insertedLines) {
      const tier = staged.match.created_via;
      const shouldAutoCommit =
        tier === "alias_match" ||
        tier === "trigram_match" ||
        (tier === "ai_semantic_match" && staged.match.confidence >= threshold);

      if (!shouldAutoCommit) continue;

      try {
        await commitLineToSpine(supabase, staged.id, {
          verifiedBy: null,
          newStatus: "auto_committed",
        });
        linesAutoCommitted++;
      } catch (err) {
        console.warn(
          `[extract] auto-commit failed for line ${staged.id}: ${err instanceof Error ? err.message : err}`
        );
      }
    }
    if (linesAutoCommitted > 0) {
      autoCommitReason = `Auto-committed ${linesAutoCommitted}/${insertedLines.length} lines (alias/trigram always; ai_semantic >= ${threshold})`;
      await supabase
        .from("invoice_extractions")
        .update({
          auto_committed: linesAutoCommitted === insertedLines.length,
          auto_commit_reason: autoCommitReason,
        })
        .eq("id", extractionId);
    }
  }

  const linesPending = insertedLines.length - linesAutoCommitted;

  return {
    extraction_id: extractionId,
    invoice_id: invoiceId,
    lines_staged: insertedLines.length,
    lines_auto_committed: linesAutoCommitted,
    lines_pending: linesPending,
    new_items_proposed: newItemsProposed,
    matched_existing_items: matchedExisting,
    match_tier_breakdown: tierBreakdown,
    skipped_existing: false,
  };
}

async function loadOrgSettings(
  supabase: SupabaseClient,
  orgId: string
): Promise<CostIntelligenceSettings> {
  const { data } = await supabase
    .from("organizations")
    .select("cost_intelligence_settings")
    .eq("id", orgId)
    .maybeSingle();

  const raw = (data as { cost_intelligence_settings: CostIntelligenceSettings | null } | null)
    ?.cost_intelligence_settings;

  return {
    auto_commit_enabled: raw?.auto_commit_enabled ?? false,
    auto_commit_threshold: raw?.auto_commit_threshold ?? 0.95,
    verification_required_for_low_confidence: raw?.verification_required_for_low_confidence ?? true,
  };
}

/** Helper exported for API routes that need to list lines for a given extraction. */
export async function listExtractionLines(
  supabase: SupabaseClient,
  extractionId: string
): Promise<InvoiceExtractionLineRow[]> {
  const { data } = await supabase
    .from("invoice_extraction_lines")
    .select("*")
    .eq("extraction_id", extractionId)
    .is("deleted_at", null)
    .order("line_order", { ascending: true });

  return (data ?? []) as InvoiceExtractionLineRow[];
}
