import { NextRequest, NextResponse } from "next/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { getCurrentMembership } from "@/lib/org/session";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service";
import { recalcAllForJob } from "@/lib/recalc";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/admin/integrity-check
 *
 * Phase 7b safety net. Owners can run this to audit every budget_line,
 * purchase_order, and job in the org against what the recalc functions
 * would compute. Returns a report of any drift. A second POST call with
 * `{ fix: true }` runs recalcAllForJob on every job in the org.
 *
 * The endpoint uses the service-role client so it can read past RLS
 * (owners would pass the policies anyway, but this lets us sum across
 * tables without tripping per-table RESTRICTIVE policies during counts).
 */

type Mismatch = {
  entity_type: "budget_line" | "purchase_order" | "job";
  entity_id: string;
  label: string;
  field: string;
  stored_value: number;
  calculated_value: number;
  delta: number;
};

const INVOICE_COUNTING_STATUSES = [
  "pm_approved",
  "qa_review",
  "qa_approved",
  "pushed_to_qb",
  "in_draw",
  "paid",
];
const PO_OPEN_STATUSES = ["issued", "partially_invoiced", "fully_invoiced"];
const CO_APPROVED_STATUSES = ["approved", "executed"];

export const GET = withApiError(async (_request: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (membership.role !== "owner") throw new ApiError("Owner role required", 403);

  const supabase = tryCreateServiceRoleClient();
  if (!supabase) throw new ApiError("Service role not configured", 500);

  const mismatches: Mismatch[] = [];
  let linesChecked = 0;
  let posChecked = 0;
  let jobsChecked = 0;

  // ── Budget lines ──
  const { data: budgetLines } = await supabase
    .from("budget_lines")
    .select("id, job_id, committed, invoiced, co_adjustments, revised_estimate, original_estimate, cost_codes:cost_code_id(code, description)")
    .eq("org_id", membership.org_id)
    .is("deleted_at", null);

  for (const bl of budgetLines ?? []) {
    linesChecked++;
    const label = `${(bl as unknown as { cost_codes?: { code: string } | null }).cost_codes?.code ?? "—"} — ${(bl as unknown as { cost_codes?: { description: string } | null }).cost_codes?.description ?? ""}`.trim();

    // Committed
    const [{ data: poHeaders }, { data: poLines }] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select("id, amount, status")
        .eq("budget_line_id", bl.id)
        .is("deleted_at", null)
        .in("status", PO_OPEN_STATUSES),
      supabase
        .from("po_line_items")
        .select("amount, po_id, purchase_orders!inner(status, deleted_at)")
        .eq("budget_line_id", bl.id)
        .is("deleted_at", null),
    ]);
    const headerSum = (poHeaders ?? [])
      .filter((po) => {
        const hasLines = (poLines ?? []).some((li) => (li as { po_id: string }).po_id === po.id);
        return !hasLines;
      })
      .reduce((s, po) => s + ((po as { amount: number }).amount ?? 0), 0);
    const lineSum = (poLines ?? [])
      .filter((li) => {
        const po = (li as unknown as { purchase_orders: { status: string; deleted_at: string | null } }).purchase_orders;
        return po && !po.deleted_at && PO_OPEN_STATUSES.includes(po.status);
      })
      .reduce((s, li) => s + ((li as { amount: number }).amount ?? 0), 0);
    const committedCalc = headerSum + lineSum;
    if (committedCalc !== (bl.committed ?? 0)) {
      mismatches.push({
        entity_type: "budget_line",
        entity_id: bl.id,
        label,
        field: "committed",
        stored_value: bl.committed ?? 0,
        calculated_value: committedCalc,
        delta: committedCalc - (bl.committed ?? 0),
      });
    }

    // Invoiced
    const { data: invRows } = await supabase
      .from("invoice_line_items")
      .select("amount_cents, invoices!inner(status, deleted_at)")
      .eq("budget_line_id", bl.id)
      .is("deleted_at", null);
    const invoicedCalc = (invRows ?? [])
      .filter((li) => {
        const inv = (li as unknown as { invoices: { status: string; deleted_at: string | null } }).invoices;
        return inv && !inv.deleted_at && INVOICE_COUNTING_STATUSES.includes(inv.status);
      })
      .reduce((s, li) => s + ((li as { amount_cents: number }).amount_cents ?? 0), 0);
    if (invoicedCalc !== (bl.invoiced ?? 0)) {
      mismatches.push({
        entity_type: "budget_line",
        entity_id: bl.id,
        label,
        field: "invoiced",
        stored_value: bl.invoiced ?? 0,
        calculated_value: invoicedCalc,
        delta: invoicedCalc - (bl.invoiced ?? 0),
      });
    }

    // CO adjustments
    const { data: coRows } = await supabase
      .from("change_order_lines")
      .select("amount, change_orders!inner(status, deleted_at)")
      .eq("budget_line_id", bl.id)
      .is("deleted_at", null);
    const coCalc = (coRows ?? [])
      .filter((r) => {
        const co = (r as unknown as { change_orders: { status: string; deleted_at: string | null } }).change_orders;
        return co && !co.deleted_at && CO_APPROVED_STATUSES.includes(co.status);
      })
      .reduce((s, r) => s + ((r as { amount: number }).amount ?? 0), 0);
    if (coCalc !== (bl.co_adjustments ?? 0)) {
      mismatches.push({
        entity_type: "budget_line",
        entity_id: bl.id,
        label,
        field: "co_adjustments",
        stored_value: bl.co_adjustments ?? 0,
        calculated_value: coCalc,
        delta: coCalc - (bl.co_adjustments ?? 0),
      });
    }

    const revisedCalc = (bl.original_estimate ?? 0) + coCalc;
    if (revisedCalc !== (bl.revised_estimate ?? 0)) {
      mismatches.push({
        entity_type: "budget_line",
        entity_id: bl.id,
        label,
        field: "revised_estimate",
        stored_value: bl.revised_estimate ?? 0,
        calculated_value: revisedCalc,
        delta: revisedCalc - (bl.revised_estimate ?? 0),
      });
    }
  }

  // ── Purchase orders ──
  const { data: pos } = await supabase
    .from("purchase_orders")
    .select("id, po_number, amount, invoiced_total, status")
    .eq("org_id", membership.org_id)
    .is("deleted_at", null);
  for (const po of pos ?? []) {
    posChecked++;
    const { data: invRows } = await supabase
      .from("invoice_line_items")
      .select("amount_cents, invoices!inner(status, deleted_at)")
      .eq("po_id", po.id)
      .is("deleted_at", null);
    const calc = (invRows ?? [])
      .filter((li) => {
        const inv = (li as unknown as { invoices: { status: string; deleted_at: string | null } }).invoices;
        return inv && !inv.deleted_at && INVOICE_COUNTING_STATUSES.includes(inv.status);
      })
      .reduce((s, li) => s + ((li as { amount_cents: number }).amount_cents ?? 0), 0);
    if (calc !== (po.invoiced_total ?? 0)) {
      mismatches.push({
        entity_type: "purchase_order",
        entity_id: po.id,
        label: (po as { po_number?: string }).po_number ?? "—",
        field: "invoiced_total",
        stored_value: po.invoiced_total ?? 0,
        calculated_value: calc,
        delta: calc - (po.invoiced_total ?? 0),
      });
    }
  }

  // ── Jobs (approved_cos_total) ──
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, name, approved_cos_total, original_contract_amount, current_contract_amount")
    .eq("org_id", membership.org_id)
    .is("deleted_at", null);
  for (const j of jobs ?? []) {
    jobsChecked++;
    const { data: cos } = await supabase
      .from("change_orders")
      .select("amount")
      .eq("job_id", j.id)
      .eq("co_type", "owner")
      .in("status", CO_APPROVED_STATUSES)
      .is("deleted_at", null);
    const calc = (cos ?? []).reduce((s, co) => s + ((co as { amount: number }).amount ?? 0), 0);
    if (calc !== (j.approved_cos_total ?? 0)) {
      mismatches.push({
        entity_type: "job",
        entity_id: j.id,
        label: j.name ?? "—",
        field: "approved_cos_total",
        stored_value: j.approved_cos_total ?? 0,
        calculated_value: calc,
        delta: calc - (j.approved_cos_total ?? 0),
      });
    }
    const revisedCalc = (j.original_contract_amount ?? 0) + calc;
    if (revisedCalc !== (j.current_contract_amount ?? 0)) {
      mismatches.push({
        entity_type: "job",
        entity_id: j.id,
        label: j.name ?? "—",
        field: "current_contract_amount",
        stored_value: j.current_contract_amount ?? 0,
        calculated_value: revisedCalc,
        delta: revisedCalc - (j.current_contract_amount ?? 0),
      });
    }
  }

  return NextResponse.json({
    lines_checked: linesChecked,
    pos_checked: posChecked,
    jobs_checked: jobsChecked,
    mismatches,
    ran_at: new Date().toISOString(),
  });
});

/** POST with { fix: true } → run recalcAllForJob on every job in the org. */
export const POST = withApiError(async (request: NextRequest) => {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (membership.role !== "owner") throw new ApiError("Owner role required", 403);

  const body = (await request.json().catch(() => ({}))) as { fix?: boolean };
  if (!body.fix) throw new ApiError("Must include { fix: true } to run fixes", 400);

  const supabase = tryCreateServiceRoleClient();
  if (!supabase) throw new ApiError("Service role not configured", 500);

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, name")
    .eq("org_id", membership.org_id)
    .is("deleted_at", null);

  let budgetLinesRecalculated = 0;
  let posRecalculated = 0;
  for (const j of jobs ?? []) {
    const { budget_lines, pos } = await recalcAllForJob((j as { id: string }).id);
    budgetLinesRecalculated += budget_lines;
    posRecalculated += pos;
  }

  await logActivity({
    org_id: membership.org_id,
    user_id: null,
    entity_type: "job",
    entity_id: null,
    action: "recomputed",
    details: {
      jobs: (jobs ?? []).length,
      budget_lines: budgetLinesRecalculated,
      pos: posRecalculated,
    },
  });

  return NextResponse.json({
    jobs_fixed: (jobs ?? []).length,
    budget_lines_recalculated: budgetLinesRecalculated,
    pos_recalculated: posRecalculated,
  });
});
