import type { SupabaseClient } from "@supabase/supabase-js";
import { computePaymentDate } from "@/lib/utils/payment-schedule";
import type { ParsedInvoice } from "@/lib/types/invoice";

export const ORG_ID = "00000000-0000-0000-0000-000000000001";

export interface SaveInvoiceRequest {
  parsed: ParsedInvoice;
  file_url: string;
  file_name: string;
  file_type: string;
  force_save?: boolean;
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

function getFirstSignificantWord(name: string): string | null {
  const normalized = normalizeVendorName(name);
  const words = normalized.split(/\s+/).filter((w) => w.length > 2);
  return words[0] ?? null;
}

async function matchVendor(supabase: SupabaseClient, vendorName: string) {
  const normalized = normalizeVendorName(vendorName);
  if (normalized) {
    const { data } = await supabase
      .from("vendors")
      .select("id, name")
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
      .ilike("name", `%${firstWord}%`)
      .is("deleted_at", null)
      .limit(1);
    if (data && data.length > 0) return data[0];
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

async function matchJob(supabase: SupabaseClient, jobRef: string) {
  const { data } = await supabase
    .from("jobs")
    .select("id, name, address, pm_id")
    .is("deleted_at", null)
    .or(`name.ilike.%${jobRef}%,address.ilike.%${jobRef}%`)
    .limit(1);
  return data?.[0] ?? null;
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
  const { parsed, file_url, file_type, force_save } = req;

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
    } catch {
      matchedVendor = null;
    }
  }

  const jobConfidence = parsed.confidence_details?.job_reference ?? 0;
  const matchedJob = parsed.job_reference
    ? await matchJob(supabase, parsed.job_reference)
    : null;
  const autoFilledJob = matchedJob != null && jobConfidence >= 0.85;

  let matchedCostCode: { id: string; code: string } | null = null;
  let autoFilledCostCode = false;
  if (parsed.cost_code_suggestion && parsed.cost_code_suggestion.confidence >= 0.8) {
    matchedCostCode = await matchCostCode(
      supabase,
      parsed.cost_code_suggestion.code
    );
    if (matchedCostCode) autoFilledCostCode = true;
  }

  const autoFills: Record<string, boolean> = {};
  if (autoFilledJob) autoFills.job_id = true;
  if (autoFilledCostCode) autoFills.cost_code_id = true;

  const duplicateNote =
    existingDuplicate && force_save
      ? ` Force-saved as possible duplicate of invoice ${existingDuplicate.id}.`
      : "";

  const statusEntry = {
    who: "system",
    when: new Date().toISOString(),
    old_status: "received",
    new_status: status,
    note: `AI parsed with ${Math.round(parsed.confidence_score * 100)}% confidence. Auto-routed.${autoFilledJob ? " Job auto-matched." : ""}${autoFilledCostCode ? ` Cost code auto-assigned: ${matchedCostCode?.code}.` : ""}${duplicateNote}`,
  };

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      vendor_id: matchedVendor?.id ?? null,
      job_id: matchedJob?.id ?? null,
      assigned_pm_id: matchedJob?.pm_id ?? null,
      cost_code_id: matchedCostCode?.id ?? null,
      invoice_number: parsed.invoice_number,
      invoice_date: parsed.invoice_date,
      vendor_name_raw: parsed.vendor_name,
      job_reference_raw: parsed.job_reference,
      po_reference_raw: parsed.po_reference,
      description: parsed.description,
      line_items: parsed.line_items,
      total_amount: totalAmountCents,
      invoice_type: parsed.invoice_type,
      co_reference_raw: parsed.co_reference,
      confidence_score: parsed.confidence_score,
      confidence_details: {
        ...parsed.confidence_details,
        cost_code_suggestion: parsed.cost_code_suggestion?.confidence ?? 0,
        auto_fills: autoFills,
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
      original_file_url: file_url,
      original_file_type: mapFileType(file_type),
      org_id: ORG_ID,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to save invoice: ${error?.message ?? "unknown"}`);
  }

  return { id: data.id as string };
}
