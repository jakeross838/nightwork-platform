/**
 * Bulk-invoice import helpers (Phase 9).
 *
 * Unlike the single-upload save flow, the bulk flow creates the invoice row
 * IMMEDIATELY on file drop (status `import_queued`) so the user can see
 * per-file progress in a live table. Claude parsing happens in a separate
 * step that UPDATES the row rather than inserting one.
 *
 * This module owns the update-after-parse path. Matching and duplicate
 * detection logic is shared with the single-upload flow via small helpers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { computePaymentDate } from "@/lib/utils/payment-schedule";
import type { ParsedInvoice } from "@/lib/types/invoice";
import {
  detectOverhead,
  loadJobCandidates,
  matchJobForInvoice,
  type MatchResult,
} from "@/lib/invoices/job-matcher";
import { findPotentialDuplicate } from "@/lib/invoices/duplicate-detection";
import { getWorkflowSettings } from "@/lib/workflow-settings";
import { determineStatus } from "@/lib/invoices/save";

const VENDOR_SUFFIXES = /\b(llc|inc|co|corp|ltd|company|enterprises|services)\b\.?/gi;

function normalizeVendorName(name: string): string {
  return name.replace(VENDOR_SUFFIXES, "").replace(/[.,]+/g, "").trim().toLowerCase();
}

function getFirstSignificantWord(name: string): string | null {
  const normalized = normalizeVendorName(name);
  const words = normalized.split(/\s+/).filter((w) => w.length > 2);
  return words[0] ?? null;
}

async function matchVendor(
  supabase: SupabaseClient,
  orgId: string,
  vendorName: string
) {
  const normalized = normalizeVendorName(vendorName);
  if (normalized) {
    const { data } = await supabase
      .from("vendors")
      .select("id, name")
      .eq("org_id", orgId)
      .ilike("name", `%${normalized}%`)
      .is("deleted_at", null)
      .limit(1);
    if (data && data.length > 0) return data[0];
  }
  const firstWord = getFirstSignificantWord(vendorName);
  if (firstWord && firstWord.length >= 3) {
    const { data } = await supabase
      .from("vendors")
      .select("id, name")
      .eq("org_id", orgId)
      .ilike("name", `%${firstWord}%`)
      .is("deleted_at", null)
      .limit(1);
    if (data && data.length > 0) return data[0];
  }
  return null;
}

async function findOrCreateVendor(
  supabase: SupabaseClient,
  orgId: string,
  vendorName: string
): Promise<{ id: string; name: string }> {
  const matched = await matchVendor(supabase, orgId, vendorName);
  if (matched) return matched as { id: string; name: string };
  const { data, error } = await supabase
    .from("vendors")
    .insert({ name: vendorName.trim(), org_id: orgId })
    .select("id, name")
    .single();
  if (error || !data) {
    throw new Error(`Failed to create vendor: ${error?.message ?? "unknown"}`);
  }
  return data as { id: string; name: string };
}

async function matchCostCode(
  supabase: SupabaseClient,
  orgId: string,
  code: string
) {
  const { data } = await supabase
    .from("cost_codes")
    .select("id, code, description, is_change_order")
    .eq("org_id", orgId)
    .eq("code", code)
    .is("deleted_at", null)
    .limit(1);
  return data?.[0] ?? null;
}

async function findBudgetLine(
  supabase: SupabaseClient,
  jobId: string | null,
  costCodeId: string | null
): Promise<string | null> {
  if (!jobId || !costCodeId) return null;
  const { data } = await supabase
    .from("budget_lines")
    .select("id")
    .eq("job_id", jobId)
    .eq("cost_code_id", costCodeId)
    .is("deleted_at", null)
    .limit(1);
  return (data?.[0]?.id as string) ?? null;
}

function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

function mapFileType(type: string): "image" | "pdf" | "docx" | "xlsx" {
  if (type === "image" || type === "pdf" || type === "docx" || type === "xlsx") return type;
  return "pdf";
}

export type ImportStatus =
  | "import_queued"
  | "import_parsing"
  | "import_parsed"
  | "import_error"
  | "import_duplicate";

export interface ApplyParsedResult {
  status: ImportStatus;
  job_match_score: number;
  duplicate_of_id: string | null;
}

/**
 * Apply a Claude-parsed result to an existing invoice row that's in
 * `import_queued` state. Transitions the row to `import_parsed`,
 * `import_duplicate`, or (on programmer error) throws.
 *
 * Differs from saveParsedInvoice in that it UPDATES an existing row,
 * and returns the chosen status rather than performing final routing —
 * the PM-queue transition happens later when the user clicks "Send to
 * approval queue."
 */
export async function applyParsedToInvoice(
  supabase: SupabaseClient,
  args: {
    invoiceId: string;
    orgId: string;
    parsed: ParsedInvoice;
    fileName: string;
    fileType: string;
  }
): Promise<ApplyParsedResult> {
  const { invoiceId, orgId, parsed, fileName, fileType } = args;

  const totalAmountCents = dollarsToCents(parsed.total_amount);
  const today = new Date().toISOString().split("T")[0];
  const paymentDate = computePaymentDate(today);

  // ---- Vendor ----
  let matchedVendor: { id: string; name: string } | null = null;
  if (parsed.vendor_name) {
    try {
      matchedVendor = await findOrCreateVendor(supabase, orgId, parsed.vendor_name);
    } catch {
      matchedVendor = null;
    }
  }

  // ---- Job match + overhead detection ----
  const jobs = await loadJobCandidates(supabase);
  const match: MatchResult | null = matchJobForInvoice(jobs, {
    job_reference_raw: parsed.job_reference,
    po_reference_raw: parsed.po_reference,
    vendor_name_raw: parsed.vendor_name,
    description: parsed.description,
    filename: fileName,
  });
  const overhead =
    match === null
      ? detectOverhead({
          vendor_name_raw: parsed.vendor_name,
          description: parsed.description,
          job_reference_raw: parsed.job_reference,
          po_reference_raw: parsed.po_reference,
        })
      : { isOverhead: false };

  // ---- Cost code match ----
  type CostCodeMatch = { id: string; code: string; is_change_order?: boolean };
  let matchedCostCode: CostCodeMatch | null = null;
  let autoFilledCostCode = false;
  if (parsed.cost_code_suggestion && parsed.cost_code_suggestion.confidence >= 0.8) {
    const cc = await matchCostCode(supabase, orgId, parsed.cost_code_suggestion.code);
    if (cc) {
      matchedCostCode = cc as CostCodeMatch;
      autoFilledCostCode = true;
    }
  }

  // ---- CO detection ----
  const CO_KEYWORDS = [
    "change order", "co #", "pcco", "additional", "extra", "added",
    "beyond scope", "beyond original scope", "not in original",
    "revision", "revised", "modification", "modified",
    "extension required", "extensions required", "relocated", "relocation",
  ];
  const haystack = [
    parsed.description,
    ...parsed.line_items.map((l) => l.description ?? ""),
  ].join(" ").toLowerCase();
  const keywordHit = CO_KEYWORDS.some((kw) => haystack.includes(kw));
  const invoiceIsChangeOrder =
    !!(parsed.is_change_order || parsed.cost_code_suggestion?.is_change_order || parsed.flags?.includes("change_order")) ||
    (matchedCostCode?.is_change_order ?? false) ||
    !!parsed.co_reference ||
    keywordHit;

  const autoFills: Record<string, boolean> = {};
  if (match) autoFills.job_id = true;
  if (autoFilledCostCode) autoFills.cost_code_id = true;

  // ---- Duplicate detection ----
  // Hard duplicate = exact vendor + amount + date match (same as single-upload).
  let duplicateOfId: string | null = null;
  let nextStatus: ImportStatus = "import_parsed";
  if (parsed.vendor_name && parsed.invoice_date) {
    const { data: hardDup } = await supabase
      .from("invoices")
      .select("id")
      .eq("org_id", orgId)
      .ilike("vendor_name_raw", parsed.vendor_name.trim())
      .eq("total_amount", totalAmountCents)
      .eq("invoice_date", parsed.invoice_date)
      .is("deleted_at", null)
      .neq("status", "void")
      .neq("id", invoiceId) // don't match self
      .limit(1);
    if (hardDup && hardDup.length > 0) {
      duplicateOfId = hardDup[0].id as string;
      nextStatus = "import_duplicate";
    }
  }

  // Soft dup check (workflow-settings-controlled). Only run when we didn't
  // already hard-match, so we don't over-flag.
  if (!duplicateOfId) {
    try {
      const settings = await getWorkflowSettings(orgId);
      if (settings.duplicate_detection_enabled) {
        const softMatch = await findPotentialDuplicate(supabase, {
          org_id: orgId,
          vendor_name_raw: parsed.vendor_name ?? null,
          total_amount_cents: totalAmountCents,
          invoice_date: parsed.invoice_date,
          invoice_number: parsed.invoice_number,
          sensitivity: settings.duplicate_detection_sensitivity,
          exclude_id: invoiceId,
        });
        if (softMatch) {
          duplicateOfId = softMatch.id;
          // Flag (not block) — status stays "import_parsed" so the user
          // can still decide.
        }
      }
    } catch (err) {
      console.warn(
        `[bulk-import] soft-dup check failed for ${invoiceId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  const statusEntry = {
    who: "system",
    when: new Date().toISOString(),
    old_status: "import_queued",
    new_status: nextStatus,
    note: `Bulk-import AI parsed with ${Math.round(parsed.confidence_score * 100)}% confidence.${
      match ? ` Auto-matched to ${match.job.name} (score ${match.score}).` : ""
    }${duplicateOfId ? ` Possible duplicate of ${duplicateOfId}.` : ""}`,
  };

  const { error: updateErr } = await supabase
    .from("invoices")
    .update({
      vendor_id: matchedVendor?.id ?? null,
      job_id: match?.job.id ?? null,
      assigned_pm_id: match?.job.pm_id ?? null,
      cost_code_id: matchedCostCode?.id ?? null,
      invoice_number: parsed.invoice_number,
      invoice_date: parsed.invoice_date,
      vendor_name_raw: parsed.vendor_name,
      job_reference_raw: parsed.job_reference,
      po_reference_raw: parsed.po_reference,
      description: parsed.description,
      line_items: parsed.line_items,
      total_amount: totalAmountCents,
      ai_parsed_total_amount: totalAmountCents,
      is_change_order: invoiceIsChangeOrder,
      invoice_type: parsed.invoice_type,
      co_reference_raw: parsed.co_reference,
      confidence_score: parsed.confidence_score,
      confidence_details: {
        ...parsed.confidence_details,
        cost_code_suggestion: parsed.cost_code_suggestion?.confidence ?? 0,
        auto_fills: autoFills,
        ...(match
          ? {
              job_match: {
                score: match.score,
                reasons: match.reasons,
                ambiguous: match.ambiguous,
              },
            }
          : {}),
        ...(overhead.isOverhead ? { overhead_reason: overhead.reason } : {}),
      },
      ai_model_used: "claude-sonnet-4-20250514",
      ai_raw_response: parsed,
      status: nextStatus,
      status_history: [statusEntry],
      received_date: today,
      payment_date: paymentDate,
      original_filename: fileName,
      original_file_type: mapFileType(fileType),
      document_category: overhead.isOverhead ? "overhead" : "job_cost",
      is_potential_duplicate: !!duplicateOfId,
      duplicate_of_id: duplicateOfId,
      import_error: null,
    })
    .eq("id", invoiceId)
    .eq("org_id", orgId);

  if (updateErr) {
    throw new Error(`Failed to update invoice during import: ${updateErr.message}`);
  }

  // ---- Line items ----
  if (Array.isArray(parsed.line_items) && parsed.line_items.length > 0) {
    // Remove any existing line items for this invoice (in case of retry)
    await supabase.from("invoice_line_items").delete().eq("invoice_id", invoiceId);

    const defaultBudgetLineId = await findBudgetLine(
      supabase,
      match?.job.id ?? null,
      matchedCostCode?.id ?? null
    );

    const perLineCodes = new Map<string, { id: string; is_change_order: boolean } | null>();
    for (const li of parsed.line_items) {
      const sug = li.cost_code_suggestion;
      if (sug?.code && !perLineCodes.has(sug.code)) {
        const cc = await matchCostCode(supabase, orgId, sug.code);
        perLineCodes.set(
          sug.code,
          cc ? { id: cc.id as string, is_change_order: !!cc.is_change_order } : null
        );
      }
    }

    const lineRows = await Promise.all(
      parsed.line_items.map(async (li, idx) => {
        const sugCode = li.cost_code_suggestion?.code ?? null;
        const sugMatch = sugCode ? perLineCodes.get(sugCode) : null;
        const sugConfidence = li.cost_code_suggestion?.confidence ?? null;
        const autoAssignLineCode =
          sugMatch && (sugConfidence ?? 0) >= 0.8 ? sugMatch.id : matchedCostCode?.id ?? null;
        const lineBudgetLineId =
          autoAssignLineCode === matchedCostCode?.id
            ? defaultBudgetLineId
            : autoAssignLineCode
              ? await findBudgetLine(supabase, match?.job.id ?? null, autoAssignLineCode)
              : null;
        return {
          invoice_id: invoiceId,
          line_index: idx,
          description: li.description ?? null,
          qty: li.qty,
          unit: li.unit,
          rate: li.rate,
          amount_cents: Math.round((li.amount ?? 0) * 100),
          cost_code_id: autoAssignLineCode,
          budget_line_id: lineBudgetLineId,
          is_change_order:
            !!li.is_change_order ||
            sugMatch?.is_change_order === true ||
            (li.is_change_order === undefined && invoiceIsChangeOrder),
          co_reference: li.co_reference ?? (invoiceIsChangeOrder ? parsed.co_reference : null),
          ai_suggested_cost_code_id: sugMatch?.id ?? null,
          ai_suggestion_confidence: sugConfidence,
          org_id: orgId,
        };
      })
    );

    const { error: lineErr } = await supabase.from("invoice_line_items").insert(lineRows);
    if (lineErr) {
      console.warn(
        `[bulk-import] line_items insert failed for ${invoiceId}: ${lineErr.message}`
      );
    }
  }

  return {
    status: nextStatus,
    job_match_score: match?.score ?? 0,
    duplicate_of_id: duplicateOfId,
  };
}

/**
 * Re-read counts from the invoices table for the given batch and persist
 * them back onto the batch row. Call this after every parse and every
 * bulk action so the UI stays consistent — recalc, don't increment.
 */
export async function recalcBatchCounts(
  supabase: SupabaseClient,
  batchId: string,
  orgId: string
): Promise<{ total: number; parsed: number; errors: number; duplicates: number; sent: number }> {
  const { data } = await supabase
    .from("invoices")
    .select("status")
    .eq("org_id", orgId)
    .eq("import_batch_id", batchId);

  const rows = (data ?? []) as Array<{ status: string }>;
  const counts = { total: rows.length, parsed: 0, errors: 0, duplicates: 0, sent: 0 };
  for (const r of rows) {
    if (r.status === "import_parsed") counts.parsed += 1;
    else if (r.status === "import_error") counts.errors += 1;
    else if (r.status === "import_duplicate") counts.duplicates += 1;
    else if (r.status !== "import_queued" && r.status !== "import_parsing") counts.sent += 1;
  }

  const { data: batchRow } = await supabase
    .from("invoice_import_batches")
    .select("total_files")
    .eq("id", batchId)
    .eq("org_id", orgId)
    .maybeSingle();
  const total = (batchRow as { total_files?: number } | null)?.total_files ?? counts.total;

  // Batch status derivation:
  // - processing while any row is still queued/parsing
  // - complete if all parsed without errors and the user has not yet sent
  //   (or all have been sent successfully)
  // - partial if some errors remain after all work is done
  // - (cancelled is set explicitly by the user, never derived here)
  const stillWorking = rows.some(
    (r) => r.status === "import_queued" || r.status === "import_parsing"
  );
  let nextStatus: "processing" | "complete" | "partial" = "processing";
  if (!stillWorking) {
    nextStatus = counts.errors > 0 ? "partial" : "complete";
  }

  await supabase
    .from("invoice_import_batches")
    .update({
      total_files: total,
      parsed_count: counts.parsed,
      error_count: counts.errors,
      duplicate_count: counts.duplicates,
      sent_to_queue_count: counts.sent,
      status: nextStatus,
      completed_at: nextStatus === "processing" ? null : new Date().toISOString(),
    })
    .eq("id", batchId)
    .eq("org_id", orgId);

  return counts;
}

/** Determine final status when promoting a parsed row into the PM queue. */
export function promoteStatus(confidence: number): string {
  return determineStatus(confidence);
}
