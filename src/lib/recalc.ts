/**
 * Financial recalculation engine — Phase 7b.
 *
 * Every function here recomputes a financial totals column FROM source data
 * using SUM queries. Callers must NEVER increment/decrement; always pass the
 * affected primary key and let these functions re-derive the truth.
 *
 * Statuses that "count" toward totals:
 *   - Invoice approved → any of ('pm_approved','qa_review','qa_approved',
 *     'pushed_to_qb','in_draw','paid'). A denied/held/void invoice does
 *     NOT count. A 'pm_denied' / 'qa_kicked_back' / 'void' invoice does NOT
 *     count.
 *   - PO issued → ('issued','partially_invoiced','fully_invoiced').
 *     ('draft','void','closed') do NOT count as commitments.
 *   - CO approved → ('approved'). ('draft','pending','denied','void') do
 *     NOT count.
 *
 * The recalc functions are intentionally idempotent — running them twice
 * leaves the same result. They use a service-role client so they can run
 * from server actions regardless of RLS.
 *
 * These complement the SQL triggers added in 00028 — the triggers are the
 * automatic safety net, these are the explicit paths that also let us log
 * to activity_log and short-circuit edge cases (e.g. recalc after batch
 * imports where many rows change at once).
 */

import { createServiceRoleClient } from "@/lib/supabase/service";

const INVOICE_COUNTING_STATUSES = [
  "pm_approved",
  "qa_review",
  "qa_approved",
  "pushed_to_qb",
  "in_draw",
  "paid",
];

const PO_OPEN_STATUSES = ["issued", "partially_invoiced", "fully_invoiced"];
const CO_APPROVED_STATUSES = ["approved"];

/**
 * Recompute committed / invoiced / co_adjustments / revised_estimate for one
 * budget line. Returns the new values for callers that want to diff them
 * against prior values (useful for activity_log deltas).
 */
export async function recalcBudgetLine(budgetLineId: string): Promise<{
  committed: number;
  invoiced: number;
  co_adjustments: number;
  revised_estimate: number;
} | null> {
  if (!budgetLineId) return null;
  const supabase = createServiceRoleClient();

  // committed = sum of open PO amounts pointing at this line (either header
  // or via po_line_items).
  const [{ data: poHeader }, { data: poLines }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("id, amount, status")
      .eq("budget_line_id", budgetLineId)
      .is("deleted_at", null)
      .in("status", PO_OPEN_STATUSES),
    supabase
      .from("po_line_items")
      .select("amount, po_id, purchase_orders!inner(status, deleted_at)")
      .eq("budget_line_id", budgetLineId)
      .is("deleted_at", null),
  ]);

  // A PO that has po_line_items is counted via those lines, not the header.
  const headerRows = (poHeader ?? []).filter((po) => {
    const hasLines = (poLines ?? []).some(
      (li) => (li as { po_id: string }).po_id === po.id
    );
    return !hasLines;
  });
  const headerSum = headerRows.reduce((s, po) => s + (po.amount ?? 0), 0);
  const lineSum = (poLines ?? [])
    .filter((li) => {
      const po = (li as unknown as { purchase_orders: { status: string; deleted_at: string | null } }).purchase_orders;
      return po && !po.deleted_at && PO_OPEN_STATUSES.includes(po.status);
    })
    .reduce((s, li) => s + ((li as { amount: number }).amount ?? 0), 0);
  const committed = headerSum + lineSum;

  // invoiced = sum of approved invoice_line_items allocated to this line.
  const { data: invRows } = await supabase
    .from("invoice_line_items")
    .select("amount_cents, invoices!inner(status, deleted_at)")
    .eq("budget_line_id", budgetLineId)
    .is("deleted_at", null);
  const invoiced = (invRows ?? [])
    .filter((li) => {
      const inv = (li as unknown as { invoices: { status: string; deleted_at: string | null } }).invoices;
      return inv && !inv.deleted_at && INVOICE_COUNTING_STATUSES.includes(inv.status);
    })
    .reduce((s, li) => s + ((li as { amount_cents: number }).amount_cents ?? 0), 0);

  // co_adjustments = sum of approved CO lines allocated to this budget line.
  const { data: coRows } = await supabase
    .from("change_order_lines")
    .select("amount, change_orders!inner(status, deleted_at)")
    .eq("budget_line_id", budgetLineId)
    .is("deleted_at", null);
  const co_adjustments = (coRows ?? [])
    .filter((row) => {
      const co = (row as unknown as { change_orders: { status: string; deleted_at: string | null } }).change_orders;
      return co && !co.deleted_at && CO_APPROVED_STATUSES.includes(co.status);
    })
    .reduce((s, row) => s + ((row as { amount: number }).amount ?? 0), 0);

  // revised_estimate = original_estimate + co_adjustments.
  const { data: bl } = await supabase
    .from("budget_lines")
    .select("original_estimate")
    .eq("id", budgetLineId)
    .maybeSingle();
  const original = (bl as { original_estimate?: number } | null)?.original_estimate ?? 0;
  const revised_estimate = original + co_adjustments;

  await supabase
    .from("budget_lines")
    .update({
      committed,
      invoiced,
      co_adjustments,
      revised_estimate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", budgetLineId);

  return { committed, invoiced, co_adjustments, revised_estimate };
}

/**
 * Recompute invoiced_total for one PO and flip status between
 * issued / partially_invoiced / fully_invoiced (but never out of
 * draft / void / closed — those are explicit user decisions).
 */
export async function recalcPO(poId: string): Promise<{
  invoiced_total: number;
  status: string;
} | null> {
  if (!poId) return null;
  const supabase = createServiceRoleClient();

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("amount, status")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return null;
  const poAmount = (po as { amount?: number }).amount ?? 0;
  const curStatus = (po as { status: string }).status;

  const { data: invRows } = await supabase
    .from("invoice_line_items")
    .select("amount_cents, invoices!inner(status, deleted_at)")
    .eq("po_id", poId)
    .is("deleted_at", null);
  const invoiced_total = (invRows ?? [])
    .filter((li) => {
      const inv = (li as unknown as { invoices: { status: string; deleted_at: string | null } }).invoices;
      return inv && !inv.deleted_at && INVOICE_COUNTING_STATUSES.includes(inv.status);
    })
    .reduce((s, li) => s + ((li as { amount_cents: number }).amount_cents ?? 0), 0);

  let nextStatus = curStatus;
  // Only auto-manage the open-state trio. Preserve draft/void/closed.
  if (PO_OPEN_STATUSES.includes(curStatus)) {
    if (invoiced_total <= 0) nextStatus = "issued";
    else if (invoiced_total < poAmount) nextStatus = "partially_invoiced";
    else nextStatus = "fully_invoiced";
  }

  await supabase
    .from("purchase_orders")
    .update({
      invoiced_total,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId);

  return { invoiced_total, status: nextStatus };
}

/**
 * Recompute the job's approved_cos_total and revised contract from the set
 * of approved owner COs. Internal COs adjust the budget only, not contract.
 */
export async function recalcJobContract(jobId: string): Promise<{
  approved_cos_total: number;
  revised_contract: number;
} | null> {
  if (!jobId) return null;
  const supabase = createServiceRoleClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("original_contract_amount")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return null;
  const original = (job as { original_contract_amount?: number }).original_contract_amount ?? 0;

  const { data: cos } = await supabase
    .from("change_orders")
    .select("amount")
    .eq("job_id", jobId)
    .neq("co_type", "internal")
    .in("status", CO_APPROVED_STATUSES)
    .is("deleted_at", null);
  const approved_cos_total = (cos ?? []).reduce((s, co) => s + ((co as { amount: number }).amount ?? 0), 0);
  const revised_contract = original + approved_cos_total;

  await supabase
    .from("jobs")
    .update({
      approved_cos_total,
      current_contract_amount: revised_contract,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  return { approved_cos_total, revised_contract };
}

/**
 * Recompute a budget's total_amount from the sum of its budget_lines'
 * original estimates. Used when an individual line's original_amount is
 * edited.
 */
export async function recalcBudgetTotals(budgetId: string): Promise<{
  total_amount: number;
} | null> {
  if (!budgetId) return null;
  const supabase = createServiceRoleClient();

  const { data: lines } = await supabase
    .from("budget_lines")
    .select("original_estimate")
    .eq("budget_id", budgetId)
    .is("deleted_at", null);
  const total_amount = (lines ?? []).reduce(
    (s, bl) => s + ((bl as { original_estimate: number }).original_estimate ?? 0),
    0
  );

  await supabase
    .from("budgets")
    .update({ total_amount, updated_at: new Date().toISOString() })
    .eq("id", budgetId);
  return { total_amount };
}

/**
 * Nuclear option: recalc every derived total for a job. Useful after bulk
 * imports, migrations, or as the backing action of the admin "Fix All"
 * button.
 */
export async function recalcAllForJob(jobId: string): Promise<{
  budget_lines: number;
  pos: number;
}> {
  const supabase = createServiceRoleClient();
  const [{ data: bls }, { data: pos }] = await Promise.all([
    supabase.from("budget_lines").select("id").eq("job_id", jobId).is("deleted_at", null),
    supabase.from("purchase_orders").select("id").eq("job_id", jobId).is("deleted_at", null),
  ]);
  for (const bl of bls ?? []) await recalcBudgetLine((bl as { id: string }).id);
  for (const po of pos ?? []) await recalcPO((po as { id: string }).id);
  await recalcJobContract(jobId);
  return { budget_lines: (bls ?? []).length, pos: (pos ?? []).length };
}

/**
 * Convenience: recalc a set of budget_line_ids and a set of po_ids — used
 * after invoice status flips where we need to hit each affected budget_line
 * and PO exactly once.
 */
export async function recalcLinesAndPOs(
  budgetLineIds: (string | null | undefined)[],
  poIds: (string | null | undefined)[]
): Promise<void> {
  const uniqueBls = Array.from(new Set(budgetLineIds.filter(Boolean) as string[]));
  const uniquePos = Array.from(new Set(poIds.filter(Boolean) as string[]));
  for (const id of uniqueBls) await recalcBudgetLine(id);
  for (const id of uniquePos) await recalcPO(id);
}
