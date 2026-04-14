import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    throw new ApiError("Only admins can import budgets", 403);
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
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(arrayBuffer);
  } catch (err) {
    throw new ApiError(
      `Could not read Excel file: ${err instanceof Error ? err.message : "unknown"}`,
      400
    );
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ApiError("Workbook has no sheets", 400);

  // Walk every row — take col A as cost code, col B as amount (col C optional description).
  const parsed: ParsedRow[] = [];
  const skipped: ImportResult["skipped"] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const codeRaw = extractText(row.getCell(1).value);
    const amountRaw = row.getCell(2).value;
    const descRaw = extractText(row.getCell(3).value);

    // Skip empty rows & header rows
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

  if (parsed.length === 0) {
    throw new ApiError(
      "No valid budget rows found. Column A must have 5-digit cost codes, column B must have dollar amounts.",
      400
    );
  }

  // Map codes to cost_code ids
  const uniqueCodes = Array.from(new Set(parsed.map((p) => p.code)));
  const { data: costCodes, error: ccError } = await supabase
    .from("cost_codes")
    .select("id, code")
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
      org_id: DEFAULT_ORG_ID,
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
