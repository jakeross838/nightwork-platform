import type { SupabaseClient } from "@supabase/supabase-js";
import { computePaymentDate } from "@/lib/utils/payment-schedule";
import type { ParsedInvoice } from "@/lib/types/invoice";
import {
  detectOverhead,
  loadJobCandidates,
  matchJobForInvoice,
  type MatchResult,
} from "@/lib/invoices/job-matcher";
import {
  buildCleanFilename,
  extensionFor,
  renameStorageObject,
  storagePathFor,
} from "@/lib/invoices/file-naming";
import { notifyPmsForJob } from "@/lib/notifications";
import { findPotentialDuplicate } from "@/lib/invoices/duplicate-detection";
import { getWorkflowSettings } from "@/lib/workflow-settings";

const INVOICES_BUCKET = "invoice-files";

export const ORG_ID = "00000000-0000-0000-0000-000000000001";

export interface SaveInvoiceRequest {
  parsed: ParsedInvoice;
  file_url: string;
  file_name: string;
  file_type: string;
  force_save?: boolean;
  /** User-selected document type: 'invoice' (default) or 'receipt'. */
  document_type?: "invoice" | "receipt";
}

export interface SaveInvoiceResult {
  id?: string;
  duplicate?: {
    id: string;
    vendor_name_raw: string;
    total_amount: number;
    status: string;
  };
}

const VENDOR_SUFFIXES = /\b(llc|inc|co|corp|ltd|company|enterprises|services)\b\.?/gi;

function normalizeVendorName(name: string): string {
  return name.replace(VENDOR_SUFFIXES, "").replace(/[.,]+/g, "").trim().toLowerCase();
}

/**
 * Match by strong evidence only: either full-substring containment (in
 * either direction after normalization) or a ≥2-word token overlap.
 * A single first-word match is NOT enough — e.g. "Florida Sunshine
 * Carpentry" should never bind to "M & J Florida Enterprises, LLC".
 */
async function matchVendor(supabase: SupabaseClient, vendorName: string) {
  const normalizedNew = normalizeVendorName(vendorName);
  if (!normalizedNew) return null;

  // Pull candidates whose normalized form shares any non-trivial word with
  // the incoming name. We filter precisely in-process.
  const newTokens = new Set(
    normalizedNew.split(/\s+/).filter((w) => w.length >= 3)
  );
  if (newTokens.size === 0) return null;

  const firstToken = Array.from(newTokens)[0];
  const { data } = await supabase
    .from("vendors")
    .select("id, name")
    .ilike("name", `%${firstToken}%`)
    .is("deleted_at", null)
    .limit(25);

  const candidates = (data ?? []) as Array<{ id: string; name: string }>;
  if (candidates.length === 0) return null;

  for (const c of candidates) {
    const normalizedExisting = normalizeVendorName(c.name);
    if (!normalizedExisting) continue;

    // Substring containment in either direction is strong evidence.
    if (
      normalizedExisting.includes(normalizedNew) ||
      normalizedNew.includes(normalizedExisting)
    ) {
      return c;
    }

    // ≥2 shared significant-word tokens is also strong evidence.
    const existingTokens = new Set(
      normalizedExisting.split(/\s+/).filter((w) => w.length >= 3)
    );
    let overlap = 0;
    newTokens.forEach((t) => { if (existingTokens.has(t)) overlap++; });
    if (overlap >= 2) return c;
  }
  return null;
}

async function findOrCreateVendor(
  supabase: SupabaseClient,
  vendorName: string
): Promise<{ id: string; name: string }> {
  const matched = await matchVendor(supabase, vendorName);
  if (matched) return matched;

  const { data, error } = await supabase
    .from("vendors")
    .insert({ name: vendorName.trim(), org_id: ORG_ID })
    .select("id, name")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create vendor: ${error?.message ?? "unknown"}`);
  }
  return data;
}

async function matchCostCode(supabase: SupabaseClient, code: string) {
  const { data } = await supabase
    .from("cost_codes")
    .select("id, code, description, is_change_order")
    .eq("code", code)
    .is("deleted_at", null)
    .limit(1);
  return data?.[0] ?? null;
}

/**
 * Resolve the budget_line for a given job + cost code pair. Returns null
 * if no row exists yet — the G703 endpoint auto-creates budget lines on
 * the fly when it sees an invoice referencing a code without one.
 */
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

async function checkDuplicate(
  supabase: SupabaseClient,
  vendorNameRaw: string,
  totalAmountCents: number,
  invoiceDate: string | null
) {
  if (!vendorNameRaw || !invoiceDate) return null;

  const trimmedVendor = vendorNameRaw.trim();
  const { data } = await supabase
    .from("invoices")
    .select("id, vendor_name_raw, total_amount, status")
    .ilike("vendor_name_raw", trimmedVendor)
    .eq("total_amount", totalAmountCents)
    .eq("invoice_date", invoiceDate)
    .is("deleted_at", null)
    .neq("status", "void")
    .limit(1);

  return data?.[0] ?? null;
}

function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Routes high-confidence invoices to the PM queue; low-confidence ones
 * go straight to Diane (QA) per product spec.
 */
export function determineStatus(confidence: number): string {
  if (confidence < 0.7) return "qa_review";
  return "pm_review";
}

function mapFileType(type: string): "image" | "pdf" | "docx" | "xlsx" {
  if (type === "image") return "image";
  if (type === "pdf") return "pdf";
  if (type === "docx") return "docx";
  if (type === "xlsx") return "xlsx";
  return "pdf";
}

/**
 * Save a single parsed invoice. Handles duplicate detection, vendor/job/
 * cost-code matching, and status routing. If `force_save` is false and a
 * duplicate is found, returns `{ duplicate }` without inserting.
 *
 * Shared by the /api/invoices/save route and the bulk-import script.
 */
export async function saveParsedInvoice(
  supabase: SupabaseClient,
  req: SaveInvoiceRequest
): Promise<SaveInvoiceResult> {
  const { parsed, file_url, file_name, file_type, force_save, document_type } = req;

  const totalAmountCents = dollarsToCents(parsed.total_amount);

  const existingDuplicate = await checkDuplicate(
    supabase,
    parsed.vendor_name,
    totalAmountCents,
    parsed.invoice_date
  );

  if (existingDuplicate && !force_save) {
    return {
      duplicate: {
        id: existingDuplicate.id as string,
        vendor_name_raw: existingDuplicate.vendor_name_raw as string,
        total_amount: existingDuplicate.total_amount as number,
        status: existingDuplicate.status as string,
      },
    };
  }

  const today = new Date().toISOString().split("T")[0];
  const paymentDate = computePaymentDate(today);
  const status = determineStatus(parsed.confidence_score);

  let matchedVendor: { id: string; name: string } | null = null;
  if (parsed.vendor_name) {
    try {
      matchedVendor = await findOrCreateVendor(supabase, parsed.vendor_name);
    } catch (err) {
      // Log so we can track why vendor linkage fails; don't fail the save —
      // invoice still enters the review queue, just without a vendor_id.
      console.warn(
        `[save] findOrCreateVendor failed for "${parsed.vendor_name}": ${err instanceof Error ? err.message : err}`
      );
      matchedVendor = null;
    }
  }

  // ---- Job matching (improved: name, address, client, filename, description) ----
  const jobs = await loadJobCandidates(supabase);
  const match: MatchResult | null = matchJobForInvoice(jobs, {
    job_reference_raw: parsed.job_reference,
    po_reference_raw: parsed.po_reference,
    vendor_name_raw: parsed.vendor_name,
    description: parsed.description,
    filename: file_name,
  });

  // ---- Overhead detection (only when no job matched) ----
  const overhead =
    match === null
      ? detectOverhead({
          vendor_name_raw: parsed.vendor_name,
          description: parsed.description,
          job_reference_raw: parsed.job_reference,
          po_reference_raw: parsed.po_reference,
        })
      : { isOverhead: false };

  let matchedCostCode: { id: string; code: string; is_change_order?: boolean } | null = null;
  let autoFilledCostCode = false;
  if (parsed.cost_code_suggestion && parsed.cost_code_suggestion.confidence >= 0.8) {
    matchedCostCode = await matchCostCode(
      supabase,
      parsed.cost_code_suggestion.code
    );
    if (matchedCostCode) autoFilledCostCode = true;
  }

  // ---- AI change-order detection — auto-toggle invoice-level CO flag
  // when the AI flagged it OR the suggested cost code is a C-variant OR
  // the description/line items contain CO keywords. We bias toward true
  // (false positives are cheap; false negatives route real CO work onto
  // the base-contract budget). ----
  const aiFlaggedChangeOrder = !!(
    parsed.is_change_order ||
    parsed.cost_code_suggestion?.is_change_order ||
    parsed.flags?.includes("change_order")
  );
  const CO_KEYWORDS = [
    "change order", "co #", "pcco",
    "additional", "extra", "added",
    "beyond scope", "beyond original scope", "not in original",
    "revision", "revised", "modification", "modified",
    "extension required", "extensions required",
    "relocated", "relocation",
  ];
  const haystack = [
    parsed.description,
    ...parsed.line_items.map((l) => l.description ?? ""),
  ].join(" ").toLowerCase();
  const keywordHit = CO_KEYWORDS.some((kw) => haystack.includes(kw));

  const invoiceIsChangeOrder =
    aiFlaggedChangeOrder ||
    (matchedCostCode?.is_change_order ?? false) ||
    !!parsed.co_reference ||
    keywordHit;

  const autoFills: Record<string, boolean> = {};
  if (match) autoFills.job_id = true;
  if (autoFilledCostCode) autoFills.cost_code_id = true;

  // ---- Rename storage object to the clean filename convention ----
  // [job]_[vendor]_[invoice#]_[date].[ext]
  const ext = extensionFor(null, file_type, file_name ?? file_url);
  const cleanName = buildCleanFilename({
    jobName: match?.job.name ?? null,
    overhead: overhead.isOverhead,
    vendorName: parsed.vendor_name,
    invoiceNumber: parsed.invoice_number,
    invoiceDate: parsed.invoice_date,
    extension: ext,
  });
  const desiredPath = storagePathFor(cleanName, ORG_ID);

  let finalFileUrl = file_url;
  try {
    finalFileUrl = await renameStorageObject(
      supabase,
      INVOICES_BUCKET,
      file_url,
      desiredPath
    );
  } catch (err) {
    // Rename is cosmetic — don't fail the whole save if storage chokes.
    console.warn(
      `[save] storage rename failed for ${file_url} → ${desiredPath}: ${err instanceof Error ? err.message : err}`
    );
  }

  const matchNote = match
    ? ` Job auto-matched to ${match.job.name} (score ${match.score}: ${match.reasons.join("; ")}${match.ambiguous ? "; flagged as ambiguous" : ""}).`
    : overhead.isOverhead
      ? ` Flagged as overhead expense — ${overhead.reason ?? "overhead pattern match"}.`
      : "";

  const duplicateNote =
    existingDuplicate && force_save
      ? ` Force-saved as possible duplicate of invoice ${existingDuplicate.id}.`
      : "";

  const statusEntry = {
    who: "system",
    when: new Date().toISOString(),
    old_status: "received",
    new_status: status,
    note: `AI parsed with ${Math.round(parsed.confidence_score * 100)}% confidence. Auto-routed.${matchNote}${autoFilledCostCode ? ` Cost code auto-assigned: ${matchedCostCode?.code}.` : ""}${duplicateNote}`,
  };

  const { data, error } = await supabase
    .from("invoices")
    .insert({
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
        ...(existingDuplicate && force_save
          ? { possible_duplicate_of: existingDuplicate.id }
          : {}),
      },
      ai_model_used: "claude-sonnet-4-20250514",
      ai_raw_response: parsed,
      status,
      status_history: [statusEntry],
      received_date: today,
      payment_date: paymentDate,
      original_file_url: finalFileUrl,
      original_filename: file_name,
      original_file_type: mapFileType(file_type),
      document_category: overhead.isOverhead ? "overhead" : "job_cost",
      document_type: document_type ?? "invoice",
      org_id: ORG_ID,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to save invoice: ${error?.message ?? "unknown"}`);
  }

  const invoiceId = data.id as string;

  // ---- Soft duplicate detection (Phase 8e) ----
  // Runs per org settings. Flags (not blocks) invoices that match an existing
  // record within the configured sensitivity window. The hard duplicate block
  // above already caught exact matches before we ever wrote the row.
  try {
    const settings = await getWorkflowSettings(ORG_ID);
    if (settings.duplicate_detection_enabled) {
      const match = await findPotentialDuplicate(supabase, {
        org_id: ORG_ID,
        vendor_name_raw: parsed.vendor_name ?? null,
        total_amount_cents: totalAmountCents,
        invoice_date: parsed.invoice_date,
        invoice_number: parsed.invoice_number,
        sensitivity: settings.duplicate_detection_sensitivity,
        exclude_id: invoiceId,
      });
      if (match) {
        await supabase
          .from("invoices")
          .update({
            is_potential_duplicate: true,
            duplicate_of_id: match.id,
          })
          .eq("id", invoiceId);
      }
    }
  } catch (err) {
    console.warn(
      `[save dup-detect] ${err instanceof Error ? err.message : err}`
    );
  }

  // ---- Persist per-line-item rows in invoice_line_items ----
  // Each line gets its own cost code (AI-suggested when available; otherwise
  // falls back to the invoice-level default). PM can re-assign in review.
  if (Array.isArray(parsed.line_items) && parsed.line_items.length > 0) {
    // Resolve default budget_line_id once for lines that fall back to
    // the invoice-level cost code.
    const defaultBudgetLineId = await findBudgetLine(
      supabase,
      match?.job.id ?? null,
      matchedCostCode?.id ?? null
    );

    // Pre-resolve per-line AI-suggested codes (dedupe by code string).
    const perLineCodes = new Map<string, { id: string; is_change_order: boolean } | null>();
    for (const li of parsed.line_items) {
      const sug = li.cost_code_suggestion;
      if (sug?.code && !perLineCodes.has(sug.code)) {
        const cc = await matchCostCode(supabase, sug.code);
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

        // Assign the line's cost code: AI suggestion if strong, else invoice default.
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
            // Mirror invoice-level CO if this line has no opinion of its own.
            (li.is_change_order === undefined && invoiceIsChangeOrder),
          co_reference: li.co_reference ?? (invoiceIsChangeOrder ? parsed.co_reference : null),
          ai_suggested_cost_code_id: sugMatch?.id ?? null,
          ai_suggestion_confidence: sugConfidence,
          org_id: ORG_ID,
        };
      })
    );

    const { error: lineErr } = await supabase.from("invoice_line_items").insert(lineRows);
    if (lineErr) {
      // Log but don't fail the invoice save — JSONB copy on the invoice row
      // remains as a fallback. PMs can still review the invoice; the line
      // table can be backfilled by a later reprocess job.
      console.warn(
        `[save] invoice_line_items insert failed for invoice ${invoiceId}: ${lineErr.message}`
      );
    }
  }

  // ---- Auto-populate invoice_allocations ----
  // When the invoice has a cost_code_id, create a single allocation at the
  // full amount so the PM doesn't have to click "Save allocations" before
  // the amount flows into budget views. PM can still split later via the UI.
  if (matchedCostCode?.id && totalAmountCents > 0) {
    try {
      await supabase.from("invoice_allocations").insert({
        invoice_id: invoiceId,
        cost_code_id: matchedCostCode.id,
        amount_cents: totalAmountCents,
        description: parsed.description ?? null,
      });
    } catch (allocErr) {
      console.warn(
        `[save] invoice_allocations auto-create failed for ${invoiceId}: ${allocErr instanceof Error ? allocErr.message : allocErr}`
      );
    }
  }

  // Fire PM notifications when a matched, non-overhead invoice lands in a
  // queue they're responsible for. Wrapped so dispatch failures can't roll
  // back the save.
  if (match?.job.id && !overhead.isOverhead) {
    const vendorName = parsed.vendor_name ?? "a vendor";
    const jobName = match.job.name;
    const totalDollars = `$${Math.round(parsed.total_amount ?? 0).toLocaleString("en-US")}`;
    try {
      await notifyPmsForJob(match.job.id, ORG_ID, {
        notification_type: "invoice_uploaded",
        subject: `New invoice — ${vendorName} · ${totalDollars}`,
        body: `New invoice from ${vendorName} for ${totalDollars} on ${jobName} needs your review.`,
        action_url: `/invoices/${invoiceId}`,
        related_entity_id: invoiceId,
      });
    } catch (notifyErr) {
      console.warn(
        `[save] notifyPmsForJob failed for invoice ${invoiceId}: ${notifyErr instanceof Error ? notifyErr.message : notifyErr}`
      );
    }
  }

  return { id: invoiceId };
}
