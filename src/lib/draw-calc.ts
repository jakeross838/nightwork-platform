/**
 * Draw calculation engine — Phase 8.
 *
 * Centralizes the math for AIA G702/G703 pay applications so the create,
 * update, detail, and export endpoints all produce identical numbers.
 *
 * Key rules:
 *   1. "Previous Applications" for a line = sum of that line's this_period
 *      across all locked/submitted/approved/paid draws on the same job with a
 *      lower draw_number (revisions within the same draw_number do NOT stack
 *      — the revision REPLACES the parent, so we take the most recent
 *      revision per draw_number).
 *   2. "This Period" includes only invoices whose approval_date (or received
 *      date, whichever falls first) lies within the draw's
 *      [period_start, period_end] window and are linked to this draw.
 *   3. Retainage = retainage_percent × total_completed_to_date. On a final
 *      draw, retainage releases as a separate line (negative adjustment).
 *
 * All amounts are cents (BIGINT). All percentages are 0–100 (NUMERIC(5,2)).
 *
 * The helpers here are server-only; they use the service-role client so they
 * can run from API routes regardless of RLS.
 */

import { createServiceRoleClient } from "@/lib/supabase/service";

export interface DrawTotals {
  original_contract_sum: number;
  net_change_orders: number;
  contract_sum_to_date: number;
  total_completed_to_date: number;
  // Phase 8 retainage breakdown (lines 5a / 5b / 5c / 6 / 7 / 8 / 9).
  retainage_on_completed: number;
  retainage_on_stored: number;
  total_retainage: number;
  total_earned_less_retainage: number;
  less_previous_certificates: number;
  current_payment_due: number;
  balance_to_finish: number;
  deposit_amount: number;
  // Phase 7b legacy column — kept because the G702 detail API and PDF
  // exporter still read it. We populate it to match total_completed_to_date
  // minus less_previous_certificates so back-compat reports still balance.
  less_previous_payments: number;
}

export interface DrawLineSnapshot {
  cost_code_id: string;
  scheduled_value: number;      // revised_estimate
  previous_applications: number;
  this_period: number;
  total_completed: number;
  retainage: number;            // cents withheld on this line this period
  balance_to_finish: number;
  percent_complete: number;     // 0..100 decimal
}

// Invoice statuses that count as approved for draw inclusion purposes.
const APPROVED_INVOICE_STATUSES = [
  "qa_approved",
  "pushed_to_qb",
  "in_draw",
  "paid",
];

// Draw statuses whose line totals contribute to "Previous Applications".
// Submitted / approved / locked / paid: already locked-in pay apps.
// Revisions within the same draw_number share the draw_number but we take
// only the highest revision_number per draw_number (so Rev 2 replaces Rev 1
// replaces Rev 0).
const PRIOR_DRAW_STATUSES = ["submitted", "approved", "locked", "paid"];

/**
 * Compute per-cost-code totals for a draw, including the Phase 8
 * previous-applications math that pulls forward prior draws' this_period
 * values.
 *
 * @param jobId              The job the draw belongs to.
 * @param drawNumber         Draw # (so we include only DRAWS with a LOWER
 *                           draw_number as "prior"). For a new draw being
 *                           created, pass the upcoming draw number.
 * @param excludeDrawId      If this draw is being recomputed, pass its own
 *                           id to exclude it from "prior" aggregation.
 * @param periodStart        Draw period start (ISO date yyyy-mm-dd)
 * @param periodEnd          Draw period end   (ISO date yyyy-mm-dd)
 * @param drawInvoiceIds     Invoice IDs linked to this draw (this_period
 *                           source). If empty, this_period = 0.
 * @param retainagePercent   0..100, e.g. 10 means withhold 10%.
 * @param isFinalDraw        When true, retainage on completed work releases
 *                           — Phase 8 surfaces this as a separate line on
 *                           the G703 output.
 */
export async function computeDrawLines(args: {
  jobId: string;
  drawNumber: number;
  excludeDrawId?: string;
  periodStart: string | null;
  periodEnd: string | null;
  drawInvoiceIds: string[];
  retainagePercent: number;
  isFinalDraw: boolean;
}): Promise<{
  lines: DrawLineSnapshot[];
  allBudgetLineIds: string[];
}> {
  const supabase = createServiceRoleClient();
  const {
    jobId,
    drawNumber,
    excludeDrawId,
    drawInvoiceIds,
    retainagePercent,
    isFinalDraw,
  } = args;

  // 1. Budget lines for this job.
  const { data: budgetLines } = await supabase
    .from("budget_lines")
    .select("id, cost_code_id, original_estimate, revised_estimate, previous_applications_baseline, co_adjustments")
    .eq("job_id", jobId)
    .is("deleted_at", null);

  const bls = budgetLines ?? [];
  const bCodeMap = new Map<string, (typeof bls)[number]>();
  for (const bl of bls) bCodeMap.set(bl.cost_code_id as string, bl);

  // 2. This period per cost_code_id — from the invoices on this draw.
  const thisPeriod = new Map<string, number>();
  if (drawInvoiceIds.length > 0) {
    // Prefer the per-line splits; fall back to invoice-level cost_code_id.
    const { data: lines } = await supabase
      .from("invoice_line_items")
      .select("invoice_id, cost_code_id, amount_cents")
      .in("invoice_id", drawInvoiceIds)
      .is("deleted_at", null);
    const covered = new Set<string>();
    for (const li of lines ?? []) {
      if (li.cost_code_id) {
        covered.add(li.invoice_id as string);
        thisPeriod.set(
          li.cost_code_id as string,
          (thisPeriod.get(li.cost_code_id as string) ?? 0) +
            ((li as { amount_cents: number }).amount_cents ?? 0)
        );
      }
    }
    // Fall back to invoice-level cost code for any invoice without line splits.
    const { data: invs } = await supabase
      .from("invoices")
      .select("id, cost_code_id, total_amount")
      .in("id", drawInvoiceIds)
      .is("deleted_at", null);
    for (const inv of invs ?? []) {
      if (
        inv.cost_code_id &&
        !covered.has(inv.id as string)
      ) {
        thisPeriod.set(
          inv.cost_code_id as string,
          (thisPeriod.get(inv.cost_code_id as string) ?? 0) +
            ((inv as { total_amount: number }).total_amount ?? 0)
        );
      }
    }
  }

  // 3. Previous applications per cost_code_id: sum of this_period on every
  //    LOCKED draw with a lower draw_number. Take the latest revision per
  //    draw_number.
  let priorDrawsQuery = supabase
    .from("draws")
    .select("id, draw_number, revision_number, status")
    .eq("job_id", jobId)
    .lt("draw_number", drawNumber)
    .in("status", PRIOR_DRAW_STATUSES)
    .is("deleted_at", null);
  if (excludeDrawId) priorDrawsQuery = priorDrawsQuery.neq("id", excludeDrawId);
  const { data: priorDrawsRaw } = await priorDrawsQuery;

  // Collapse revisions: for each draw_number, keep the highest revision.
  const priorByNumber = new Map<number, { id: string; revision: number }>();
  for (const d of priorDrawsRaw ?? []) {
    const num = (d as { draw_number: number }).draw_number;
    const rev = (d as { revision_number: number }).revision_number ?? 0;
    const id = (d as { id: string }).id;
    const cur = priorByNumber.get(num);
    if (!cur || rev > cur.revision) priorByNumber.set(num, { id, revision: rev });
  }
  const priorDrawIds = Array.from(priorByNumber.values()).map((v) => v.id);

  // Previous = baseline per line + sum of this_period for that cost_code
  // across prior (locked) draws.
  const priorThisPeriod = new Map<string, number>();
  if (priorDrawIds.length > 0) {
    const { data: priorInvoices } = await supabase
      .from("invoices")
      .select("id, cost_code_id, total_amount, draw_id")
      .in("draw_id", priorDrawIds)
      .is("deleted_at", null);
    const priorInvIds = (priorInvoices ?? []).map((i) => i.id as string);
    const { data: priorLines } =
      priorInvIds.length > 0
        ? await supabase
            .from("invoice_line_items")
            .select("invoice_id, cost_code_id, amount_cents")
            .in("invoice_id", priorInvIds)
            .is("deleted_at", null)
        : { data: [] as Array<{ invoice_id: string; cost_code_id: string | null; amount_cents: number }> };

    const covered = new Set<string>();
    for (const li of priorLines ?? []) {
      if (li.cost_code_id) {
        covered.add(li.invoice_id as string);
        priorThisPeriod.set(
          li.cost_code_id as string,
          (priorThisPeriod.get(li.cost_code_id as string) ?? 0) +
            ((li as { amount_cents: number }).amount_cents ?? 0)
        );
      }
    }
    for (const inv of priorInvoices ?? []) {
      if (inv.cost_code_id && !covered.has(inv.id as string)) {
        priorThisPeriod.set(
          inv.cost_code_id as string,
          (priorThisPeriod.get(inv.cost_code_id as string) ?? 0) +
            ((inv as { total_amount: number }).total_amount ?? 0)
        );
      }
    }
  }

  // 4. Compose the snapshot.
  const lines: DrawLineSnapshot[] = [];
  const pct = Math.max(0, Math.min(100, retainagePercent)) / 100;
  for (const bl of bls) {
    const ccId = bl.cost_code_id as string;
    const scheduled = (bl as { revised_estimate?: number }).revised_estimate ?? 0;
    const baseline = (bl as { previous_applications_baseline?: number }).previous_applications_baseline ?? 0;
    const prior = priorThisPeriod.get(ccId) ?? 0;
    const previous_applications = baseline + prior;
    const this_period = thisPeriod.get(ccId) ?? 0;
    const total_completed = previous_applications + this_period;
    // Retainage released on a final draw — withholds drop to 0; otherwise
    // we withhold pct of total_completed so far. The line's retainage
    // column shows *currently withheld*, not incremental.
    const retainage = isFinalDraw ? 0 : Math.round(total_completed * pct);
    const balance_to_finish = scheduled - total_completed;
    const percent_complete =
      scheduled > 0 ? Math.round((total_completed / scheduled) * 10000) / 100 : total_completed > 0 ? 100 : 0;
    lines.push({
      cost_code_id: ccId,
      scheduled_value: scheduled,
      previous_applications,
      this_period,
      total_completed,
      retainage,
      balance_to_finish,
      percent_complete,
    });
  }

  return { lines, allBudgetLineIds: bls.map((b) => b.id as string) };
}

/**
 * Compute the G702 header totals (lines 1–9) from the line snapshot +
 * job/context metadata. This is pure math — no DB access — so it can be
 * reused by the preview UI as well.
 */
export function rollupDrawTotals(args: {
  originalContractSum: number;
  netChangeOrders: number;
  depositPercentage: number;
  retainagePercent: number;
  lines: DrawLineSnapshot[];
  lessPreviousCertificates: number;
  isFinalDraw: boolean;
  nonBudgetLineThisPeriod: number;
}): DrawTotals {
  const {
    originalContractSum,
    netChangeOrders,
    depositPercentage,
    retainagePercent,
    lines,
    lessPreviousCertificates,
    isFinalDraw,
    nonBudgetLineThisPeriod,
  } = args;

  const contract_sum_to_date = originalContractSum + netChangeOrders;
  const total_completed_to_date =
    lines.reduce((s, l) => s + l.total_completed, 0) + nonBudgetLineThisPeriod;
  const pct = Math.max(0, Math.min(100, retainagePercent)) / 100;
  // Line 5a — retainage on completed work. On final draw, we release (0).
  const retainage_on_completed = isFinalDraw ? 0 : Math.round(total_completed_to_date * pct);
  const retainage_on_stored = 0; // scaffold; stored-material retainage unused yet
  const total_retainage = retainage_on_completed + retainage_on_stored;
  // Line 6 — total earned less retainage.
  const total_earned_less_retainage = total_completed_to_date - total_retainage;
  // Line 8 — current payment due = (line 6) - (line 7 previous certificates).
  const current_payment_due = total_earned_less_retainage - lessPreviousCertificates;
  // Line 9 — balance to finish + retainage.
  const balance_to_finish = contract_sum_to_date - total_completed_to_date + total_retainage;
  const deposit_amount = Math.round(originalContractSum * depositPercentage);

  return {
    original_contract_sum: originalContractSum,
    net_change_orders: netChangeOrders,
    contract_sum_to_date,
    total_completed_to_date,
    retainage_on_completed,
    retainage_on_stored,
    total_retainage,
    total_earned_less_retainage,
    less_previous_certificates: lessPreviousCertificates,
    current_payment_due,
    balance_to_finish,
    deposit_amount,
    // Back-compat: legacy "less_previous_payments" tracks what Line 7 used to
    // mean before we split retainage out. Keep it aligned with line 7 so the
    // existing export path continues to read a sensible number.
    less_previous_payments: lessPreviousCertificates,
  };
}

/**
 * G702 Line 7: sum of current_payment_due across all prior
 * locked/submitted/approved/paid draws, plus the pre-Nightwork baseline
 * from jobs.previous_certificates_total. Revisions within the same
 * draw_number collapse to the latest revision.
 *
 * Baseline is for pre-Nightwork certificates NOT represented in the draws
 * table. If the draws table has no prior submitted draws (e.g. Dewberry
 * Draw #1 is the first Nightwork draw), the baseline carries the full
 * historical certified amount.
 */
export async function lessPreviousCertificatesForJob(
  jobId: string,
  drawNumber: number,
  excludeDrawId?: string
): Promise<number> {
  const supabase = createServiceRoleClient();
  let q = supabase
    .from("draws")
    .select("id, draw_number, revision_number, status, current_payment_due")
    .eq("job_id", jobId)
    .lt("draw_number", drawNumber)
    .in("status", PRIOR_DRAW_STATUSES)
    .is("deleted_at", null);
  if (excludeDrawId) q = q.neq("id", excludeDrawId);
  const { data } = await q;
  const byNumber = new Map<number, { revision: number; amount: number }>();
  for (const d of data ?? []) {
    const num = (d as { draw_number: number }).draw_number;
    const rev = (d as { revision_number: number }).revision_number ?? 0;
    const amt = (d as { current_payment_due: number }).current_payment_due ?? 0;
    const cur = byNumber.get(num);
    if (!cur || rev > cur.revision) byNumber.set(num, { revision: rev, amount: amt });
  }
  const sumPriorDraws = Array.from(byNumber.values()).reduce((s, v) => s + v.amount, 0);

  const { data: job } = await supabase
    .from("jobs")
    .select("previous_certificates_total")
    .eq("id", jobId)
    .single();
  const baseline = (job as { previous_certificates_total?: number } | null)
    ?.previous_certificates_total ?? 0;

  return sumPriorDraws + baseline;
}

/**
 * Sum of this_period from draw_line_items whose source is NOT a budget line
 * (i.e. internal billings and change orders). These rows are invisible to
 * computeDrawLines (which iterates budget_lines), so they feed into G702
 * Line 4 separately via rollupDrawTotals.
 */
export async function nonBudgetLineThisPeriodForDraw(drawId: string): Promise<number> {
  if (!drawId) return 0;
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("draw_line_items")
    .select("this_period")
    .eq("draw_id", drawId)
    .in("source_type", ["internal", "change_order"])
    .is("deleted_at", null);
  return (data ?? []).reduce(
    (s, r) => s + ((r as { this_period: number }).this_period ?? 0),
    0
  );
}

/**
 * G702 Line 2: cumulative net change orders. Includes the pre-Nightwork
 * baseline from jobs.previous_change_orders_total plus every approved
 * owner-type CO created in Nightwork.
 *
 * Baseline is for pre-Nightwork COs NOT represented in the change_orders
 * table. If the pay-app importer already created change_orders rows for
 * historical COs, the baseline should be $0 to avoid double-counting.
 */
export async function netChangeOrdersForJob(jobId: string): Promise<number> {
  const supabase = createServiceRoleClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("previous_change_orders_total")
    .eq("id", jobId)
    .single();
  const baseline = (job as { previous_change_orders_total?: number } | null)
    ?.previous_change_orders_total ?? 0;

  const { data: cos } = await supabase
    .from("change_orders")
    .select("total_with_fee, amount, gc_fee_amount")
    .eq("job_id", jobId)
    .in("status", ["approved", "executed"])
    .eq("co_type", "owner")
    .is("deleted_at", null);
  const nightworkSum = (cos ?? []).reduce((s, co) => {
    const row = co as { total_with_fee?: number; amount?: number; gc_fee_amount?: number };
    return s + (row.total_with_fee ?? (row.amount ?? 0) + (row.gc_fee_amount ?? 0));
  }, 0);

  return baseline + nightworkSum;
}

/**
 * Compute the AIA Application # for a draw. Pure function — no DB access.
 * If the job has starting_application_number set, the formula is:
 *   starting_application_number + draw_number - 1
 * Otherwise falls back to draw_number (legacy behavior).
 */
export function applicationNumberForDraw(
  draw: { draw_number: number },
  job: { starting_application_number: number | null }
): number {
  if (job.starting_application_number == null) return draw.draw_number;
  return job.starting_application_number + draw.draw_number - 1;
}

/**
 * Return the invoice IDs approved within a given period that aren't already
 * on a prior draw — the candidates for a "This Period" pull-in.
 */
export async function approvedInvoicesInPeriod(args: {
  jobId: string;
  periodStart: string;
  periodEnd: string;
  excludeDrawId?: string;
}): Promise<string[]> {
  const supabase = createServiceRoleClient();
  const { jobId, periodStart, periodEnd, excludeDrawId } = args;
  // "Approval date" falls on the invoice's updated_at when the status
  // flipped to qa_approved. Absent a dedicated column, use
  // received_date as the billing window anchor — that's the date the bill
  // entered Ross Built's system, which is how the accounting team thinks
  // of billing periods.
  let q = supabase
    .from("invoices")
    .select("id, draw_id, received_date, status")
    .eq("job_id", jobId)
    .in("status", APPROVED_INVOICE_STATUSES)
    .gte("received_date", periodStart)
    .lte("received_date", periodEnd)
    .is("deleted_at", null);
  if (excludeDrawId) q = q.or(`draw_id.is.null,draw_id.eq.${excludeDrawId}`);
  else q = q.is("draw_id", null);
  const { data } = await q;
  return (data ?? []).map((r) => (r as { id: string }).id);
}

/** Format a period_end date = last day of the current month at UTC noon. */
export function defaultPeriodEndFromToday(): string {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
}

/**
 * Recompute stored G702 totals for every DRAFT draw on a job.
 *
 * Called from the jobs PATCH endpoint when retainage_percent changes. Draft
 * draws are the only ones that should silently re-stamp retainage —
 * submitted/approved/locked/paid draws keep their captured values because
 * retroactive retainage changes on those would be a revision event.
 *
 * Idempotent: running this twice writes the same values.
 */
export async function recalcDraftDrawsForJob(jobId: string): Promise<number> {
  if (!jobId) return 0;
  const supabase = createServiceRoleClient();

  const [{ data: job }, { data: draws }] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "original_contract_amount, current_contract_amount, deposit_percentage, retainage_percent"
      )
      .eq("id", jobId)
      .maybeSingle(),
    supabase
      .from("draws")
      .select("id, draw_number, period_start, period_end, is_final")
      .eq("job_id", jobId)
      .eq("status", "draft")
      .is("deleted_at", null),
  ]);

  if (!job || !draws || draws.length === 0) return 0;

  const retainagePct =
    (job as { retainage_percent?: number }).retainage_percent ?? 10;
  const depositPct =
    (job as { deposit_percentage?: number }).deposit_percentage ?? 0.1;
  const originalContractSum =
    (job as { original_contract_amount?: number }).original_contract_amount ?? 0;
  const netChangeOrders = await netChangeOrdersForJob(jobId);

  let recomputed = 0;

  for (const d of draws) {
    const draw = d as {
      id: string;
      draw_number: number;
      period_start: string | null;
      period_end: string | null;
      is_final: boolean;
    };

    const { data: invRows } = await supabase
      .from("invoices")
      .select("id")
      .eq("draw_id", draw.id)
      .is("deleted_at", null);
    const invoiceIds = (invRows ?? []).map((i) => (i as { id: string }).id);

    const { lines } = await computeDrawLines({
      jobId,
      drawNumber: draw.draw_number,
      excludeDrawId: draw.id,
      periodStart: draw.period_start,
      periodEnd: draw.period_end,
      drawInvoiceIds: invoiceIds,
      retainagePercent: retainagePct,
      isFinalDraw: !!draw.is_final,
    });

    const lessPrevCerts = await lessPreviousCertificatesForJob(
      jobId,
      draw.draw_number,
      draw.id
    );
    const nonBudgetLineThisPeriod = await nonBudgetLineThisPeriodForDraw(draw.id);

    const totals = rollupDrawTotals({
      originalContractSum,
      netChangeOrders,
      depositPercentage: depositPct,
      retainagePercent: retainagePct,
      lines,
      lessPreviousCertificates: lessPrevCerts,
      isFinalDraw: !!draw.is_final,
      nonBudgetLineThisPeriod,
    });

    await supabase
      .from("draws")
      .update({
        original_contract_sum: totals.original_contract_sum,
        net_change_orders: totals.net_change_orders,
        contract_sum_to_date: totals.contract_sum_to_date,
        total_completed_to_date: totals.total_completed_to_date,
        retainage_on_completed: totals.retainage_on_completed,
        retainage_on_stored: totals.retainage_on_stored,
        total_retainage: totals.total_retainage,
        total_earned_less_retainage: totals.total_earned_less_retainage,
        less_previous_certificates: totals.less_previous_certificates,
        less_previous_payments: totals.less_previous_payments,
        current_payment_due: totals.current_payment_due,
        balance_to_finish: totals.balance_to_finish,
        deposit_amount: totals.deposit_amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", draw.id);

    recomputed += 1;
  }

  return recomputed;
}

export const DRAW_STATUSES_APPROVED_INVOICES = APPROVED_INVOICE_STATUSES;
export const DRAW_LOCKED_STATUSES = PRIOR_DRAW_STATUSES;
