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
import type {
  CostIntelligenceSettings,
  InvoiceExtractionLineRow,
  InvoiceExtractionRow,
  MatchResult,
} from "./types";

const EXTRACTION_PROMPT_VERSION = "v1.0";
const EXTRACTION_MODEL = "claude-sonnet-4-20250514";

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
    .select("id, org_id, vendor_id, vendor_name_raw, invoice_date, original_file_url")
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

  // 6. Create (or update) the extraction row
  let extractionId: string;
  if (existingExtraction) {
    // Reset for re-extraction
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
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      throw new Error(`extractInvoice: failed to create extraction: ${insertErr?.message}`);
    }
    extractionId = inserted.id as string;
  }

  // 7. For each line, run matching and stage
  const tierBreakdown: Record<string, number> = {};
  let newItemsProposed = 0;
  let matchedExisting = 0;

  const insertedLines: Array<{ id: string; match: MatchResult; rawTotalCents: number }> = [];

  for (const li of lineItems) {
    const rawTotalCents = li.amount_cents ?? 0;
    const rawUnitPriceCents =
      li.rate != null && Number.isFinite(li.rate) ? Math.round(li.rate * 100) : null;

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

    insertedLines.push({
      id: lineInsert.id as string,
      match,
      rawTotalCents,
    });
  }

  // 8. Auto-commit pass (if org enabled)
  let linesAutoCommitted = 0;
  let autoCommitReason: string | null = null;
  if (settings.auto_commit_enabled && invoice.vendor_id) {
    const threshold = settings.auto_commit_threshold;
    for (const staged of insertedLines) {
      if (staged.match.confidence >= threshold) {
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
    }
    if (linesAutoCommitted > 0) {
      autoCommitReason = `Auto-committed ${linesAutoCommitted}/${insertedLines.length} lines at confidence >= ${threshold}`;
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
