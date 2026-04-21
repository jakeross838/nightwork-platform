/**
 * Commits a verified (or auto-trusted) extraction line to the cost
 * intelligence spine (vendor_item_pricing).
 *
 * Steps:
 *   1. Fetch extraction_line + parent extraction (for invoice + vendor + org).
 *   2. If line has proposed_item_data but no verified item yet, create the
 *      item row now.
 *   3. Insert vendor_item_pricing row with full provenance
 *      (source_extraction_line_id, source_invoice_id, created_via, etc).
 *   4. Update extraction_line: verification_status, vendor_item_pricing_id,
 *      verified_at, verified_by.
 *   5. The vip_after_insert DB trigger handles item_aliases + job_item_activity.
 *
 * This function is called by:
 *   - Human "Approve" click in verification UI (verification_status=verified)
 *   - Human "Edit" save in correction modal (verification_status=corrected)
 *   - Auto-commit path inside extract-invoice.ts (verification_status=auto_committed)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InvoiceExtractionLineRow,
  InvoiceExtractionRow,
  LineVerificationStatus,
  ProposedItemData,
  CreatedVia,
} from "./types";

export interface CommitLineOptions {
  /** User doing the verification (null for auto-commit path). */
  verifiedBy: string | null;
  /** Status to set on the extraction line. */
  newStatus: Extract<LineVerificationStatus, "verified" | "corrected" | "auto_committed">;
  /** If caller already chose an item (e.g. via correction modal), use it. */
  overrideItemId?: string;
  /** If caller corrected the proposed item data pre-commit. */
  overrideProposedData?: ProposedItemData;
  /** Transaction date to use. Defaults to today or invoice.invoice_date. */
  transactionDate?: string;
  /** Cost code to record (falls back to the invoice's cost_code_id). */
  costCodeId?: string | null;
  /** Correction notes to persist on extraction_line. */
  correctionNotes?: string | null;
}

export interface CommitLineResult {
  vendor_item_pricing_id: string;
  item_id: string;
  extraction_line_id: string;
}

type InvoiceRowSlim = {
  id: string;
  org_id: string;
  vendor_id: string | null;
  job_id: string | null;
  cost_code_id: string | null;
  invoice_date: string | null;
  original_file_url: string | null;
};

type ExtractionLineFull = InvoiceExtractionLineRow & {
  extraction: InvoiceExtractionRow | null;
};

export async function commitLineToSpine(
  supabase: SupabaseClient,
  extractionLineId: string,
  opts: CommitLineOptions
): Promise<CommitLineResult> {
  // 1. Load extraction line + parent extraction
  const { data: line, error: lineErr } = await supabase
    .from("invoice_extraction_lines")
    .select("*, extraction:invoice_extractions(*)")
    .eq("id", extractionLineId)
    .is("deleted_at", null)
    .single();

  if (lineErr || !line) {
    throw new Error(
      `commitLineToSpine: extraction line ${extractionLineId} not found: ${lineErr?.message}`
    );
  }

  const extractionLine = line as ExtractionLineFull;
  const extraction = extractionLine.extraction;
  if (!extraction) {
    throw new Error(`commitLineToSpine: extraction missing for line ${extractionLineId}`);
  }

  // Overhead/delivery lines do not represent real items — they are allocated
  // across the real lines in allocate-overhead.ts. Never let them enter the
  // spine.
  if ((extractionLine as unknown as { is_allocated_overhead?: boolean }).is_allocated_overhead) {
    throw new Error(
      `commitLineToSpine: line ${extractionLineId} is an allocated-overhead row — cannot commit`
    );
  }

  // 2. Load invoice for job_id / vendor_id / invoice_date
  const { data: invoiceData, error: invoiceErr } = await supabase
    .from("invoices")
    .select("id, org_id, vendor_id, job_id, cost_code_id, invoice_date, original_file_url")
    .eq("id", extraction.invoice_id)
    .is("deleted_at", null)
    .single();

  if (invoiceErr || !invoiceData) {
    throw new Error(
      `commitLineToSpine: invoice ${extraction.invoice_id} not found: ${invoiceErr?.message}`
    );
  }

  const invoice = invoiceData as InvoiceRowSlim;
  if (!invoice.vendor_id) {
    throw new Error(
      `commitLineToSpine: invoice ${invoice.id} has no vendor_id — cannot commit pricing`
    );
  }
  if (!invoice.org_id) {
    throw new Error(
      `commitLineToSpine: invoice ${invoice.id} missing org_id`
    );
  }

  // 3. Resolve item_id: override → already verified → create from proposal
  let itemId: string | null = opts.overrideItemId ?? extractionLine.verified_item_id ?? extractionLine.proposed_item_id;

  if (!itemId) {
    // Create from proposal (overrideProposedData takes precedence)
    const proposal = opts.overrideProposedData ?? extractionLine.proposed_item_data;
    if (!proposal) {
      throw new Error(
        `commitLineToSpine: line ${extractionLineId} has no item_id and no proposed_item_data`
      );
    }

    const { data: newItem, error: itemErr } = await supabase
      .from("items")
      .insert({
        org_id: invoice.org_id,
        canonical_name: proposal.canonical_name,
        item_type: proposal.item_type,
        category: proposal.category,
        subcategory: proposal.subcategory,
        specs: proposal.specs ?? {},
        unit: proposal.unit,
        first_seen_source: "invoice_extraction",
        ai_confidence: extractionLine.match_confidence,
        human_verified: opts.newStatus !== "auto_committed",
        human_verified_at: opts.verifiedBy ? new Date().toISOString() : null,
        human_verified_by: opts.verifiedBy,
        created_by: opts.verifiedBy,
      })
      .select("id")
      .single();

    if (itemErr || !newItem) {
      throw new Error(`commitLineToSpine: failed to create item: ${itemErr?.message}`);
    }
    itemId = newItem.id as string;
  }

  // 4. Derive quantity / unit / prices from extraction raw values, with
  // reasonable fallbacks so we never insert zeros unnecessarily
  const quantity = extractionLine.raw_quantity ?? 1;
  const totalCents = extractionLine.raw_total_cents ?? 0;
  const unitPriceCents =
    extractionLine.raw_unit_price_cents ??
    (quantity > 0 ? Math.round(totalCents / quantity) : totalCents);
  const unit = extractionLine.raw_unit_text ?? "each";
  const createdVia: CreatedVia = extractionLine.match_tier ?? "ai_new_item";
  const txnDate = opts.transactionDate ?? invoice.invoice_date ?? new Date().toISOString().slice(0, 10);
  const ccId = opts.costCodeId ?? invoice.cost_code_id ?? null;

  const isAutoCommit = opts.newStatus === "auto_committed";

  // Pull tax + overhead allocation from the extraction line so the spine
  // row carries landed-cost context even though cross-vendor queries still
  // default to the pre-tax total_cents.
  const lineTax = (extractionLine as unknown as { line_tax_cents?: number | null }).line_tax_cents ?? 0;
  const lineOverhead =
    (extractionLine as unknown as { overhead_allocated_cents?: number | null }).overhead_allocated_cents ?? 0;
  const lineIsTaxable =
    (extractionLine as unknown as { line_is_taxable?: boolean | null }).line_is_taxable ?? null;
  const taxRate = (extraction as unknown as { invoice_tax_rate?: number | null }).invoice_tax_rate ?? null;

  // 5. Insert vendor_item_pricing row
  const { data: vip, error: vipErr } = await supabase
    .from("vendor_item_pricing")
    .insert({
      org_id: invoice.org_id,
      vendor_id: invoice.vendor_id,
      item_id: itemId,
      unit_price_cents: unitPriceCents,
      quantity,
      total_cents: totalCents,
      unit,
      tax_cents: lineTax,
      tax_rate: taxRate,
      is_taxable: lineIsTaxable,
      overhead_allocated_cents: lineOverhead,
      job_id: invoice.job_id,
      cost_code_id: ccId,
      source_type: "invoice_line",
      source_invoice_id: invoice.id,
      source_invoice_line_id: extractionLine.invoice_line_item_id,
      source_extraction_line_id: extractionLine.id,
      source_doc_url: invoice.original_file_url,
      transaction_date: txnDate,
      ai_confidence: extractionLine.match_confidence,
      created_via: createdVia,
      human_verified: !isAutoCommit,
      human_verified_by: opts.verifiedBy,
      human_verified_at: opts.verifiedBy ? new Date().toISOString() : null,
      auto_committed: isAutoCommit,
      created_by: opts.verifiedBy,
    })
    .select("id")
    .single();

  if (vipErr || !vip) {
    throw new Error(`commitLineToSpine: failed to insert spine row: ${vipErr?.message}`);
  }

  // 6. Update extraction_line
  const { error: updateErr } = await supabase
    .from("invoice_extraction_lines")
    .update({
      verification_status: opts.newStatus,
      verified_item_id: itemId,
      verified_at: new Date().toISOString(),
      verified_by: opts.verifiedBy,
      correction_notes: opts.correctionNotes ?? null,
      vendor_item_pricing_id: vip.id,
    })
    .eq("id", extractionLineId);

  if (updateErr) {
    throw new Error(
      `commitLineToSpine: line update failed (spine row already committed!): ${updateErr.message}`
    );
  }

  return {
    vendor_item_pricing_id: vip.id as string,
    item_id: itemId,
    extraction_line_id: extractionLineId,
  };
}

/**
 * Reject a line — marks it rejected, does not write to spine.
 */
export async function rejectExtractionLine(
  supabase: SupabaseClient,
  extractionLineId: string,
  rejectedBy: string | null,
  notes?: string
): Promise<void> {
  const { error } = await supabase
    .from("invoice_extraction_lines")
    .update({
      verification_status: "rejected",
      verified_at: new Date().toISOString(),
      verified_by: rejectedBy,
      correction_notes: notes ?? null,
    })
    .eq("id", extractionLineId);

  if (error) {
    throw new Error(`rejectExtractionLine: ${error.message}`);
  }
}
