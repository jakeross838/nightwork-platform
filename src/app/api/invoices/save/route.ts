import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { computePaymentDate } from "@/lib/utils/payment-schedule";
import type { ParsedInvoice } from "@/lib/types/invoice";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

interface SaveRequest {
  parsed: ParsedInvoice;
  file_url: string;
  file_name: string;
  file_type: string;
  force_save?: boolean;
}

async function matchVendor(supabase: ReturnType<typeof createServerClient>, vendorName: string) {
  const { data } = await supabase
    .from("vendors")
    .select("id, name")
    .ilike("name", `%${vendorName}%`)
    .is("deleted_at", null)
    .limit(1);
  return data?.[0] ?? null;
}

async function matchJob(supabase: ReturnType<typeof createServerClient>, jobRef: string) {
  const { data } = await supabase
    .from("jobs")
    .select("id, name, address, pm_id")
    .is("deleted_at", null)
    .or(`name.ilike.%${jobRef}%,address.ilike.%${jobRef}%`)
    .limit(1);
  return data?.[0] ?? null;
}

async function matchCostCode(
  supabase: ReturnType<typeof createServerClient>,
  code: string
) {
  const { data } = await supabase
    .from("cost_codes")
    .select("id, code, description, is_change_order")
    .eq("code", code)
    .is("deleted_at", null)
    .limit(1);
  return data?.[0] ?? null;
}

async function checkDuplicate(
  supabase: ReturnType<typeof createServerClient>,
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

function determineStatus(confidence: number): string {
  if (confidence < 0.7) return "qa_review";
  return "pm_review";
}

function mapFileType(type: string): string {
  if (type === "image") return "image";
  if (type === "pdf") return "pdf";
  if (type === "docx") return "docx";
  if (type === "xlsx") return "xlsx";
  return "pdf";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items: SaveRequest[] = Array.isArray(body) ? body : [body];
    const supabase = createServerClient();
    const savedIds: string[] = [];

    const duplicates: Array<{
      index: number;
      existing: { id: string; vendor_name_raw: string; total_amount: number; status: string };
    }> = [];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const { parsed, file_url, file_type, force_save } = item;

      const totalAmountCents = dollarsToCents(parsed.total_amount);

      // Check for duplicate before inserting
      const existingDuplicate = await checkDuplicate(
        supabase,
        parsed.vendor_name,
        totalAmountCents,
        parsed.invoice_date
      );

      if (existingDuplicate && !force_save) {
        // For batch requests, collect duplicates; for single, return immediately
        if (items.length === 1) {
          return NextResponse.json({
            duplicate: true,
            existing: {
              id: existingDuplicate.id,
              vendor_name_raw: existingDuplicate.vendor_name_raw,
              total_amount: existingDuplicate.total_amount,
              status: existingDuplicate.status,
            },
          });
        }
        duplicates.push({
          index: idx,
          existing: {
            id: existingDuplicate.id,
            vendor_name_raw: existingDuplicate.vendor_name_raw,
            total_amount: existingDuplicate.total_amount,
            status: existingDuplicate.status,
          },
        });
        continue;
      }

      const today = new Date().toISOString().split("T")[0];
      const paymentDate = computePaymentDate(today);
      const status = determineStatus(parsed.confidence_score);

      // Match vendor and job
      const matchedVendor = parsed.vendor_name
        ? await matchVendor(supabase, parsed.vendor_name)
        : null;

      // Auto-fill job if confidence >= 0.85
      const jobConfidence = parsed.confidence_details?.job_reference ?? 0;
      const matchedJob =
        parsed.job_reference && jobConfidence >= 0.85
          ? await matchJob(supabase, parsed.job_reference)
          : parsed.job_reference
            ? await matchJob(supabase, parsed.job_reference)
            : null;
      const autoFilledJob = matchedJob && jobConfidence >= 0.85;

      // Auto-fill cost code if suggestion confidence >= 0.80
      let matchedCostCode: { id: string; code: string } | null = null;
      let autoFilledCostCode = false;
      if (parsed.cost_code_suggestion && parsed.cost_code_suggestion.confidence >= 0.80) {
        matchedCostCode = await matchCostCode(supabase, parsed.cost_code_suggestion.code);
        if (matchedCostCode) autoFilledCostCode = true;
      }

      const autoFills: Record<string, boolean> = {};
      if (autoFilledJob) autoFills.job_id = true;
      if (autoFilledCostCode) autoFills.cost_code_id = true;

      // Build status history note — include duplicate flag if force-saving
      const duplicateNote = (existingDuplicate && force_save)
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

      if (error) {
        console.error("Insert error:", error);
        return NextResponse.json(
          { error: `Failed to save invoice: ${error.message}` },
          { status: 500 }
        );
      }

      savedIds.push(data.id);
    }

    return NextResponse.json({
      saved: savedIds,
      ...(duplicates.length > 0 ? { duplicates } : {}),
    });
  } catch (err) {
    console.error("Save error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
