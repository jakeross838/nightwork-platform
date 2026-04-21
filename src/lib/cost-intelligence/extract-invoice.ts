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
 */
function defaultComponentTypeFor(
  proposal: ProposedItemData | null | undefined
): ComponentType {
  switch (proposal?.item_type) {
    case "labor":
    case "service":
      return "labor";
    case "equipment":
      return "equipment_rental";
    case "subcontract":
      return "bundled";
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
  proposal: ProposedItemData | null
): Promise<void> {
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
            component_type: defaultComponentTypeFor(proposal),
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

const EXTRACTION_PROMPT_VERSION = "v1.1";
const EXTRACTION_MODEL = "claude-sonnet-4-20250514";

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
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      throw new Error(`extractInvoice: failed to create extraction: ${insertErr?.message}`);
    }
    extractionId = inserted.id as string;
  }

  // 7. For each line, detect overhead (delivery/freight/etc) first — those
  //    bypass matchItem since they will be reallocated. Real lines run the
  //    full tiered matcher.
  const tierBreakdown: Record<string, number> = {};
  let newItemsProposed = 0;
  let matchedExisting = 0;

  const insertedLines: Array<{ id: string; match: MatchResult; rawTotalCents: number }> = [];
  const overheadEntries: InvoiceOverheadEntry[] = [];

  for (const li of lineItems) {
    const rawTotalCents = li.amount_cents ?? 0;
    const rawUnitPriceCents =
      li.rate != null && Number.isFinite(li.rate) ? Math.round(li.rate * 100) : null;

    const overhead = detectOverheadLine(li.description);

    // Transaction-line pre-filter. Billing events (progress payments,
    // draws, rental periods, recurring services) are not catalog items.
    // Flag them so they render with a distinct badge and the PM can
    // one-click dismiss via the "Not an item" action.
    const transaction = !overhead ? detectTransactionLine(li.description) : null;
    if (transaction?.is_transaction) {
      const { data: tRow, error: tErr } = await supabase
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
          classification_confidence: null,
          match_reasoning: `Transaction line detected (${transaction.type}): ${transaction.reasoning}. Skipping item match.`,
          candidates_considered: null,
          verification_status: "pending",
          is_transaction_line: true,
          transaction_line_type: transaction.type,
        })
        .select("id")
        .single();

      if (tErr || !tRow) {
        console.warn(`[extract] transaction line insert failed: ${tErr?.message}`);
        continue;
      }
      tierBreakdown["transaction_line"] = (tierBreakdown["transaction_line"] ?? 0) + 1;
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
      })
      .select("id")
      .single();

    if (lineErr || !lineInsert) {
      console.warn(`[extract] line insert failed for invoice ${invoiceId} line ${li.id}: ${lineErr?.message}`);
      continue;
    }

    await persistLineComponents(
      supabase,
      orgId,
      lineInsert.id as string,
      rawTotalCents,
      match.components,
      match.proposed_item_data
    );

    insertedLines.push({
      id: lineInsert.id as string,
      match,
      rawTotalCents,
    });
  }

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
