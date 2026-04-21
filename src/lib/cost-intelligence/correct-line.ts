/**
 * Record a human correction to an AI-proposed classification, then commit
 * the (now corrected) line to the spine. The correction row is the training
 * signal reused as vendor context in future match-item calls.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { commitLineToSpine } from "./commit-line-to-spine";
import type { ProposedItemData, InvoiceExtractionLineRow } from "./types";

export interface CorrectionInput {
  /** User selected an existing item (preferred). */
  corrected_item_id?: string;
  /** User edited the proposed new item fields (used when no existing match). */
  corrected_proposed_data?: ProposedItemData;
  /** Free-form explanation of why the AI was wrong. */
  correction_notes?: string;
}

export async function correctLine(
  supabase: SupabaseClient,
  extractionLineId: string,
  correction: CorrectionInput,
  correctedBy: string
): Promise<{ vendor_item_pricing_id: string; item_id: string }> {
  // Pull current line state for the audit trail
  const { data: line, error: lineErr } = await supabase
    .from("invoice_extraction_lines")
    .select("*, extraction:invoice_extractions(invoice_id)")
    .eq("id", extractionLineId)
    .is("deleted_at", null)
    .single();

  if (lineErr || !line) {
    throw new Error(`correctLine: line ${extractionLineId} not found: ${lineErr?.message}`);
  }

  const extractionLine = line as InvoiceExtractionLineRow & {
    extraction: { invoice_id: string } | null;
  };

  // Determine vendor_id for the correction record (via invoice)
  let vendorId: string | null = null;
  if (extractionLine.extraction?.invoice_id) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("vendor_id")
      .eq("id", extractionLine.extraction.invoice_id)
      .maybeSingle();
    vendorId = (inv as { vendor_id: string | null } | null)?.vendor_id ?? null;
  }

  // Record the correction BEFORE we commit so the training signal is
  // durable even if the commit fails
  const correctedCanonicalName =
    correction.corrected_proposed_data?.canonical_name ??
    (await resolveItemName(supabase, correction.corrected_item_id));

  const correctedSpecs = correction.corrected_proposed_data?.specs ?? null;

  const aiCanonicalName = extractionLine.proposed_item_data?.canonical_name ?? null;
  const aiSpecs = extractionLine.proposed_item_data?.specs ?? null;

  const { error: correctionErr } = await supabase
    .from("item_classification_corrections")
    .insert({
      org_id: extractionLine.org_id,
      source_text: extractionLine.raw_description,
      vendor_id: vendorId,
      ai_item_id: extractionLine.proposed_item_id,
      ai_canonical_name: aiCanonicalName,
      ai_specs: aiSpecs,
      ai_confidence: extractionLine.match_confidence,
      ai_created_via: extractionLine.match_tier,
      corrected_item_id: correction.corrected_item_id ?? null,
      corrected_canonical_name: correctedCanonicalName,
      corrected_specs: correctedSpecs,
      source_type: "invoice_extraction_line",
      source_record_id: extractionLineId,
      corrected_by: correctedBy,
      correction_notes: correction.correction_notes ?? null,
    });

  if (correctionErr) {
    throw new Error(`correctLine: failed to record correction: ${correctionErr.message}`);
  }

  // Now commit the corrected line to the spine
  const result = await commitLineToSpine(supabase, extractionLineId, {
    verifiedBy: correctedBy,
    newStatus: "corrected",
    overrideItemId: correction.corrected_item_id,
    overrideProposedData: correction.corrected_proposed_data,
    correctionNotes: correction.correction_notes,
  });

  return result;
}

async function resolveItemName(
  supabase: SupabaseClient,
  itemId: string | undefined
): Promise<string | null> {
  if (!itemId) return null;
  const { data } = await supabase
    .from("items")
    .select("canonical_name")
    .eq("id", itemId)
    .maybeSingle();
  return (data as { canonical_name: string } | null)?.canonical_name ?? null;
}
