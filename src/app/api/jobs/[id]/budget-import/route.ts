import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { isPayAppWorkbook, parsePayApp } from "@/lib/pay-app-parser";
import type { PayAppParseResult } from "@/lib/pay-app-parser";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

/**
 * Minimal CSV parser — splits on commas, respects double-quoted fields with
 * embedded commas and escaped quotes (RFC 4180-ish). No external dependency
 * because PapaParse would be overkill for a single-column-A-cost-code use
 * case and the spec calls this "simple 5-row CSV".
 */
function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cur.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        // Skip \r\n duplicate newline
        if (ch === "\r" && input[i + 1] === "\n") i++;
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  // Flush tail
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}

type ParsedRow = {
  rowNumber: number;
  codeCell: string;
  amountCents: number;
  code: string;
  description?: string;
};

type ImportResult = {
  imported: { cost_code: string; description: string; amount: number }[];
  skipped: { row: number; reason: string; raw_code?: string; raw_amount?: unknown }[];
  unmatched_codes: string[];
  total_rows: number;
};

function extractText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const v = value as { text?: string; richText?: Array<{ text: string }>; result?: unknown };
    if (typeof v.text === "string") return v.text.trim();
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("").trim();
    if (v.result !== undefined) return extractText(v.result);
  }
  return String(value).trim();
}

function extractNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && isFinite(value)) return value;
  if (typeof value === "object") {
    const v = value as { result?: unknown };
    if (v.result !== undefined) return extractNumber(v.result);
  }
  const s = String(value).replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

// Cost codes are 5 digits (e.g. "09101") but may arrive as number or with dashes.
function normaliseCostCode(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  // Accept 5-digit codes directly; pad 4-digit codes to 5.
  if (digits.length === 5) return digits;
  if (digits.length === 4) return "0" + digits;
  if (digits.length === 3) return "00" + digits;
  return null;
}

export const POST = withApiError(async (
  request: NextRequest,
  context: { params: { id: string } }
) => {
  const supabase = createServerClient();

  // Auth — admin only
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const membership = await getCurrentMembership();
  if (!membership || !["admin", "owner"].includes(membership.role)) {
    throw new ApiError("Only admins/owners can import budgets", 403);
  }

  // Verify job exists
  const jobId = context.params.id;
  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .is("deleted_at", null)
    .single();
  if (!job) throw new ApiError("Job not found", 404);

  // Parse file
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) throw new ApiError("No file provided", 400);

  const arrayBuffer = await file.arrayBuffer();
  const filename = (file.name ?? "").toLowerCase();
  const isCsv =
    filename.endsWith(".csv") ||
    file.type === "text/csv" ||
    file.type === "application/csv";

  const parsed: ParsedRow[] = [];
  const skipped: ImportResult["skipped"] = [];

  if (isCsv) {
    // CSV branch — decode as UTF-8, walk each row.
    const text = new TextDecoder("utf-8").decode(arrayBuffer);
    const rows = parseCsv(text);
    rows.forEach((cells, idx) => {
      const rowNumber = idx + 1;
      const codeRaw = extractText(cells[0] ?? "");
      const descRaw = extractText(cells[1] ?? "");
      // Column order: cost_code, description, category, amount — per the
      // Phase 6 spec's suggested CSV format. Amount is column 4; if only
      // three columns exist, fall back to column 3.
      const amountRaw = cells[3] !== undefined && cells[3] !== ""
        ? cells[3]
        : cells[2] ?? null;

      if (!codeRaw && (amountRaw == null || amountRaw === "")) return;
      const lowered = codeRaw.toLowerCase();
      if (
        lowered === "cost code" ||
        lowered === "cost_code" ||
        lowered === "code" ||
        lowered === "item"
      ) {
        return;
      }

      const normalized = normaliseCostCode(codeRaw);
      if (!normalized) {
        skipped.push({
          row: rowNumber,
          reason: "Column 1 is not a valid cost code",
          raw_code: codeRaw,
        });
        return;
      }
      const amount = extractNumber(amountRaw);
      if (amount == null) {
        skipped.push({
          row: rowNumber,
          reason: "Amount column is not a valid dollar amount",
          raw_code: codeRaw,
          raw_amount: amountRaw,
        });
        return;
      }
      parsed.push({
        rowNumber,
        codeCell: codeRaw,
        code: normalized,
        description: descRaw || undefined,
        amountCents: Math.round(amount * 100),
      });
    });
  } else {
    // Excel branch — detect pay-app vs simple budget sheet.
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(arrayBuffer);
    } catch (err) {
      throw new ApiError(
        `Could not read Excel file: ${err instanceof Error ? err.message : "unknown"}`,
        400
      );
    }

    if (isPayAppWorkbook(workbook)) {
      // ── Pay-app path: G702/G703/PCCO workbook ──
      return handlePayAppImport(workbook, jobId, supabase);
    }

    // ── Simple budget sheet path (column A = code, column B = amount) ──
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new ApiError("Workbook has no sheets", 400);

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const codeRaw = extractText(row.getCell(1).value);
      const amountRaw = row.getCell(2).value;
      const descRaw = extractText(row.getCell(3).value);

      if (!codeRaw && amountRaw == null) return;
      const lowered = codeRaw.toLowerCase();
      if (
        lowered === "cost code" ||
        lowered === "code" ||
        lowered === "item" ||
        lowered === "total" ||
        lowered.startsWith("grand total")
      ) {
        return;
      }

      const normalized = normaliseCostCode(codeRaw);
      if (!normalized) {
        skipped.push({
          row: rowNumber,
          reason: "Column A is not a valid cost code",
          raw_code: codeRaw,
        });
        return;
      }

      const amount = extractNumber(amountRaw);
      if (amount == null) {
        skipped.push({
          row: rowNumber,
          reason: "Column B is not a valid dollar amount",
          raw_code: codeRaw,
          raw_amount: amountRaw,
        });
        return;
      }

      parsed.push({
        rowNumber,
        codeCell: codeRaw,
        code: normalized,
        description: descRaw || undefined,
        amountCents: Math.round(amount * 100),
      });
    });
  }

  if (parsed.length === 0) {
    throw new ApiError(
      "No valid budget rows found. Column A must have 5-digit cost codes, column B must have dollar amounts.",
      400
    );
  }

  const { data: jobOrg } = await supabase
    .from("jobs")
    .select("org_id")
    .eq("id", jobId)
    .single();
  if (!jobOrg?.org_id) throw new ApiError("Job has no org_id", 400);
  const orgId = jobOrg.org_id as string;

  const uniqueCodes = Array.from(new Set(parsed.map((p) => p.code)));
  const { data: costCodes, error: ccError } = await supabase
    .from("cost_codes")
    .select("id, code")
    .eq("org_id", orgId)
    .in("code", uniqueCodes)
    .is("deleted_at", null);
  if (ccError) throw new ApiError(ccError.message, 500);

  const codeToId = new Map<string, string>(
    (costCodes ?? []).map((c) => [c.code as string, c.id as string])
  );

  const unmatched: string[] = [];
  const toUpsert: {
    job_id: string;
    cost_code_id: string;
    original_estimate: number;
    revised_estimate: number;
    org_id: string;
  }[] = [];

  const imported: ImportResult["imported"] = [];

  for (const row of parsed) {
    const ccId = codeToId.get(row.code);
    if (!ccId) {
      unmatched.push(row.code);
      skipped.push({
        row: row.rowNumber,
        reason: `Cost code ${row.code} not found in cost_codes table`,
        raw_code: row.codeCell,
      });
      continue;
    }

    toUpsert.push({
      job_id: jobId,
      cost_code_id: ccId,
      original_estimate: row.amountCents,
      revised_estimate: row.amountCents,
      org_id: orgId,
    });
    imported.push({
      cost_code: row.code,
      description: row.description ?? "",
      amount: row.amountCents,
    });
  }

  if (toUpsert.length === 0) {
    throw new ApiError(
      `No matching cost codes. Unmatched: ${Array.from(new Set(unmatched)).join(", ")}`,
      400
    );
  }

  // Upsert one at a time — (job_id, cost_code_id) has a unique index so we can
  // update in place. Small N in practice (≤ a few hundred budget lines).
  for (const row of toUpsert) {
    const { data: existing } = await supabase
      .from("budget_lines")
      .select("id")
      .eq("job_id", row.job_id)
      .eq("cost_code_id", row.cost_code_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from("budget_lines")
        .update({
          original_estimate: row.original_estimate,
          revised_estimate: row.revised_estimate,
        })
        .eq("id", existing.id);
      if (error) throw new ApiError(`Update failed: ${error.message}`, 500);
    } else {
      const { error } = await supabase.from("budget_lines").insert(row);
      if (error) throw new ApiError(`Insert failed: ${error.message}`, 500);
    }
  }

  const result: ImportResult = {
    imported,
    skipped,
    unmatched_codes: Array.from(new Set(unmatched)),
    total_rows: parsed.length + skipped.length,
  };

  return NextResponse.json(result);
});

// ---------------------------------------------------------------------------
// Pay-app import handler
// ---------------------------------------------------------------------------

type SupabaseClient = ReturnType<typeof createServerClient>;

async function handlePayAppImport(
  workbook: ExcelJS.Workbook,
  jobId: string,
  supabase: SupabaseClient,
) {
  const payApp: PayAppParseResult = parsePayApp(workbook);
  const { g702, g703Lines, pccoLog, previousCoCompletedAmount, warnings } = payApp;

  if (g703Lines.length === 0) {
    throw new ApiError(
      "Pay-app detected but no G703 line items found. " +
        warnings.join("; "),
      400
    );
  }

  const { data: jobOrg } = await supabase
    .from("jobs")
    .select("org_id")
    .eq("id", jobId)
    .single();
  if (!jobOrg?.org_id) throw new ApiError("Job has no org_id", 400);
  const orgId = jobOrg.org_id as string;

  const uniqueCodes = Array.from(new Set(g703Lines.map((l) => l.costCode)));
  const { data: costCodes, error: ccErr } = await supabase
    .from("cost_codes")
    .select("id, code")
    .eq("org_id", orgId)
    .in("code", uniqueCodes)
    .is("deleted_at", null);
  if (ccErr) throw new ApiError(ccErr.message, 500);

  const codeToId = new Map<string, string>(
    (costCodes ?? []).map((c) => [c.code as string, c.id as string])
  );

  const unmatchedCodes: string[] = [];
  let budgetLinesImported = 0;
  let budgetLinesSkipped = 0;

  // Upsert budget lines from G703
  for (const line of g703Lines) {
    const ccId = codeToId.get(line.costCode);
    if (!ccId) {
      unmatchedCodes.push(line.costCode);
      budgetLinesSkipped++;
      continue;
    }

    const { data: existing } = await supabase
      .from("budget_lines")
      .select("id")
      .eq("job_id", jobId)
      .eq("cost_code_id", ccId)
      .is("deleted_at", null)
      .maybeSingle();

    const row = {
      job_id: jobId,
      cost_code_id: ccId,
      original_estimate: line.scheduledValue,
      revised_estimate: line.scheduledValue,
      previous_applications_baseline: line.previousApplications,
      org_id: orgId,
    };

    if (existing?.id) {
      const { error } = await supabase
        .from("budget_lines")
        .update({
          original_estimate: row.original_estimate,
          revised_estimate: row.revised_estimate,
          previous_applications_baseline: row.previous_applications_baseline,
        })
        .eq("id", existing.id);
      if (error) throw new ApiError(`Budget line update failed: ${error.message}`, 500);
    } else {
      const { error } = await supabase.from("budget_lines").insert(row);
      if (error) throw new ApiError(`Budget line insert failed: ${error.message}`, 500);
    }
    budgetLinesImported++;
  }

  // Auto-create change orders from PCCO log
  let cosImported = 0;
  for (const co of pccoLog) {
    // Check if this PCCO # already exists for the job
    const { data: existingCo } = await supabase
      .from("change_orders")
      .select("id")
      .eq("job_id", jobId)
      .eq("pcco_number", co.pccoNumber)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingCo?.id) continue; // already imported

    const { error } = await supabase.from("change_orders").insert({
      job_id: jobId,
      pcco_number: co.pccoNumber,
      description: co.description,
      amount: co.addition,
      gc_fee_rate: co.gcFeeRate,  // fraction convention
      gc_fee_amount: co.gcFeeAmount,
      total_with_fee: co.addition + co.gcFeeAmount,
      estimated_days_added: co.estimatedDaysAdded,
      status: "executed",
      draw_number: co.appNumber,
      org_id: orgId,
      status_history: JSON.stringify([
        {
          who: "pay-app-import",
          when: new Date().toISOString(),
          old_status: null,
          new_status: "executed",
          note: `Imported from pay app #${g702.applicationNumber}`,
        },
      ]),
    });
    if (error) {
      warnings.push(`CO #${co.pccoNumber} insert failed: ${error.message}`);
    } else {
      cosImported++;
    }
  }

  // Update job with pay-app metadata
  const jobPatch: Record<string, unknown> = {};
  if (g702.originalContractSum > 0) {
    jobPatch.original_contract_amount = g702.originalContractSum;
    jobPatch.current_contract_amount = g702.contractSumToDate;
  }
  if (previousCoCompletedAmount > 0) {
    jobPatch.previous_co_completed_amount = previousCoCompletedAmount;
  }

  if (Object.keys(jobPatch).length > 0) {
    const { error } = await supabase
      .from("jobs")
      .update(jobPatch)
      .eq("id", jobId);
    if (error) warnings.push(`Job update failed: ${error.message}`);
  }

  return NextResponse.json({
    format: "pay-app",
    g702_summary: {
      application_number: g702.applicationNumber,
      original_contract: g702.originalContractSum,
      net_change_orders: g702.netChangeOrders,
      contract_to_date: g702.contractSumToDate,
      total_completed: g702.totalCompletedStored,
      less_previous: g702.lessPreviousPayments,
      current_due: g702.currentPaymentDue,
    },
    budget_lines_imported: budgetLinesImported,
    budget_lines_skipped: budgetLinesSkipped,
    change_orders_imported: cosImported,
    unmatched_codes: Array.from(new Set(unmatchedCodes)),
    warnings,
    total_g703_lines: g703Lines.length,
    total_pcco_entries: pccoLog.length,
  });
}
