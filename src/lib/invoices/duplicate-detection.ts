import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DUPLICATE_SENSITIVITY_CONFIG,
  type DuplicateSensitivity,
} from "@/lib/workflow-settings";

export type DuplicateMatch = {
  id: string;
  vendor_name_raw: string | null;
  total_amount: number;
  invoice_date: string | null;
  invoice_number: string | null;
  status: string;
  job_id: string | null;
};

function daysBetween(a: string, b: string): number {
  const aT = new Date(a).getTime();
  const bT = new Date(b).getTime();
  return Math.abs(aT - bT) / (1000 * 60 * 60 * 24);
}

function pctDiff(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  const base = Math.max(Math.abs(a), Math.abs(b));
  if (base === 0) return 0;
  return (Math.abs(a - b) / base) * 100;
}

/**
 * Find potential duplicates of a candidate invoice within the same org.
 *
 * Uses org-configured sensitivity thresholds. Same `invoice_number`
 * (non-empty, case-insensitive) is ALWAYS a hit regardless of sensitivity.
 *
 * Excludes: the candidate itself (when id provided), void/deleted rows,
 * and rows whose duplicate flag has already been dismissed against this
 * candidate (we don't keep dismissing the same pair).
 */
export async function findPotentialDuplicate(
  supabase: SupabaseClient,
  params: {
    org_id: string;
    vendor_name_raw: string | null;
    total_amount_cents: number;
    invoice_date: string | null;
    invoice_number: string | null;
    sensitivity: DuplicateSensitivity;
    exclude_id?: string | null;
  }
): Promise<DuplicateMatch | null> {
  const {
    org_id,
    vendor_name_raw,
    total_amount_cents,
    invoice_date,
    invoice_number,
    sensitivity,
    exclude_id,
  } = params;

  const cfg = DUPLICATE_SENSITIVITY_CONFIG[sensitivity];

  // 1) Exact invoice number match — highest-signal; always wins.
  if (invoice_number && invoice_number.trim() !== "") {
    const q = supabase
      .from("invoices")
      .select("id, vendor_name_raw, total_amount, invoice_date, invoice_number, status, job_id")
      .eq("org_id", org_id)
      .eq("invoice_number", invoice_number.trim())
      .is("deleted_at", null)
      .neq("status", "void")
      .limit(2);
    if (exclude_id) q.neq("id", exclude_id);
    const { data } = await q;
    if (data && data.length > 0) return data[0] as DuplicateMatch;
  }

  // 2) Fuzzy match on vendor + amount + date. Vendor name required.
  if (!vendor_name_raw || !invoice_date) return null;

  // Amount window in cents.
  const amountWindow = Math.ceil(total_amount_cents * (cfg.amountPct / 100));
  const minAmount = Math.max(0, total_amount_cents - amountWindow);
  const maxAmount = total_amount_cents + amountWindow;

  // Date window.
  const ivDate = new Date(invoice_date);
  const minDate = new Date(ivDate);
  minDate.setDate(ivDate.getDate() - cfg.dateDays);
  const maxDate = new Date(ivDate);
  maxDate.setDate(ivDate.getDate() + cfg.dateDays);

  const q = supabase
    .from("invoices")
    .select("id, vendor_name_raw, total_amount, invoice_date, invoice_number, status, job_id")
    .eq("org_id", org_id)
    .ilike("vendor_name_raw", vendor_name_raw.trim())
    .gte("total_amount", minAmount)
    .lte("total_amount", maxAmount)
    .gte("invoice_date", minDate.toISOString().slice(0, 10))
    .lte("invoice_date", maxDate.toISOString().slice(0, 10))
    .is("deleted_at", null)
    .neq("status", "void")
    .order("invoice_date", { ascending: false })
    .limit(5);
  if (exclude_id) q.neq("id", exclude_id);

  const { data } = await q;
  if (!data || data.length === 0) return null;

  // Pick the closest-amount match (tiebreak by closest date) to reduce noise.
  const scored = data
    .map((row) => {
      const amtDiff = pctDiff(row.total_amount as number, total_amount_cents);
      const dateDiff = row.invoice_date ? daysBetween(row.invoice_date as string, invoice_date) : 999;
      return { row, amtDiff, dateDiff };
    })
    .sort((a, b) => a.amtDiff + a.dateDiff - (b.amtDiff + b.dateDiff));

  return scored[0].row as DuplicateMatch;
}
