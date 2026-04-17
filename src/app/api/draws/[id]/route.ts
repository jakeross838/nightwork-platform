import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service";
import {
  applicationNumberForDraw,
  computeDrawLines,
  lessPreviousCertificatesForJob,
  nonBudgetLineThisPeriodForDraw,
  rollupDrawTotals,
} from "@/lib/draw-calc";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const ORG_ID = "00000000-0000-0000-0000-000000000001";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Service-role bypasses RLS so embeds like `cost_codes:cost_code_id (...)`
    // return actual rows instead of null when user-session RLS evaluation
    // is ambiguous. Auth gate still runs on the user-session client.
    const userSb = createServerClient();
    const { data: { user } } = await userSb.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const supabase = tryCreateServiceRoleClient() ?? userSb;

    const { data: draw, error } = await supabase
      .from("draws")
      .select(
        `*, jobs:job_id (id, name, address, client_name, deposit_percentage, gc_fee_percentage, retainage_percent, original_contract_amount, current_contract_amount, starting_application_number, previous_co_completed_amount)`
      )
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();

    if (error || !draw) {
      return NextResponse.json({ error: "Draw not found" }, { status: 404 });
    }

    // Invoices linked to this draw.
    const { data: invoices } = await supabase
      .from("invoices")
      .select(
        "id, vendor_id, vendor_name_raw, invoice_number, total_amount, cost_code_id, payment_status, payment_date"
      )
      .eq("draw_id", params.id)
      .is("deleted_at", null);

    // Budget lines and cost codes for this job.
    const { data: budgetLinesRaw } = await supabase
      .from("budget_lines")
      .select(
        `id, cost_code_id, original_estimate, revised_estimate, previous_applications_baseline, co_adjustments,
         cost_codes:cost_code_id (code, description, category, sort_order, is_change_order)`
      )
      .eq("job_id", draw.job_id)
      .is("deleted_at", null);

    // Auto-create budget lines for invoice cost codes not yet present (same
    // recovery path as before so draws with unexpected cost codes still
    // render).
    const coveredCc = new Set((budgetLinesRaw ?? []).map((b) => b.cost_code_id as string));
    const missingCc = new Set<string>();
    for (const inv of invoices ?? []) {
      if (inv.cost_code_id && !coveredCc.has(inv.cost_code_id as string)) {
        missingCc.add(inv.cost_code_id as string);
      }
    }
    for (const ccId of Array.from(missingCc)) {
      const { data: created } = await supabase
        .from("budget_lines")
        .insert({
          job_id: draw.job_id,
          cost_code_id: ccId,
          original_estimate: 0,
          revised_estimate: 0,
          previous_applications_baseline: 0,
          org_id: ORG_ID,
        })
        .select(
          `id, cost_code_id, original_estimate, revised_estimate, previous_applications_baseline, co_adjustments,
           cost_codes:cost_code_id (code, description, category, sort_order, is_change_order)`
        )
        .single();
      if (created && budgetLinesRaw) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        budgetLinesRaw.push(created as any);
      }
    }

    const budgetLines = (budgetLinesRaw ?? []).map((bl) => ({
      ...bl,
      cost_codes: Array.isArray(bl.cost_codes) ? bl.cost_codes[0] : bl.cost_codes,
    })) as Array<{
      id: string;
      cost_code_id: string;
      original_estimate: number;
      revised_estimate: number;
      previous_applications_baseline: number;
      co_adjustments?: number;
      cost_codes: { code: string; description: string; category: string; sort_order: number; is_change_order?: boolean };
    }>;

    // Compute Phase 8 line snapshot + totals.
    const invoiceIds = (invoices ?? []).map((i) => i.id as string);
    const retainagePct = (draw as { jobs?: { retainage_percent?: number } }).jobs?.retainage_percent ?? 10;
    const { lines: snapshot } = await computeDrawLines({
      jobId: draw.job_id as string,
      drawNumber: (draw as { draw_number: number }).draw_number,
      excludeDrawId: draw.id as string,
      periodStart: (draw as { period_start: string | null }).period_start,
      periodEnd: (draw as { period_end: string | null }).period_end,
      drawInvoiceIds: invoiceIds,
      retainagePercent: retainagePct,
      isFinalDraw: !!(draw as { is_final?: boolean }).is_final,
    });

    const lessPrevCerts = await lessPreviousCertificatesForJob(
      draw.job_id as string,
      (draw as { draw_number: number }).draw_number,
      draw.id as string
    );
    const nonBudgetLineThisPeriod = await nonBudgetLineThisPeriodForDraw(draw.id as string);

    const totals = rollupDrawTotals({
      originalContractSum: (draw as { original_contract_sum?: number }).original_contract_sum ?? 0,
      netChangeOrders: (draw as { net_change_orders?: number }).net_change_orders ?? 0,
      depositPercentage:
        (draw as { jobs?: { deposit_percentage?: number } }).jobs?.deposit_percentage ?? 0.1,
      retainagePercent: retainagePct,
      lines: snapshot,
      lessPreviousCertificates: lessPrevCerts,
      isFinalDraw: !!(draw as { is_final?: boolean }).is_final,
      nonBudgetLineThisPeriod,
      previousCoCompletedAmount:
        (draw as { jobs?: { previous_co_completed_amount?: number } }).jobs?.previous_co_completed_amount ?? 0,
    });

    // Build G703 rows: merge snapshot by cost_code_id into budget_lines.
    const snapByCc = new Map(snapshot.map((l) => [l.cost_code_id, l]));
    const g703Rows = budgetLines.map((bl) => {
      const s = snapByCc.get(bl.cost_code_id) ?? {
        scheduled_value: bl.revised_estimate,
        previous_applications: bl.previous_applications_baseline ?? 0,
        this_period: 0,
        total_completed: bl.previous_applications_baseline ?? 0,
        retainage: 0,
        balance_to_finish: bl.revised_estimate - (bl.previous_applications_baseline ?? 0),
        percent_complete: 0,
      };
      return {
        id: `computed-${bl.id}`,
        previous_applications: s.previous_applications,
        this_period: s.this_period,
        total_to_date: s.total_completed,
        percent_complete: s.percent_complete,
        balance_to_finish: s.balance_to_finish,
        retainage: s.retainage,
        scheduled_value: s.scheduled_value,
        co_adjustment: bl.co_adjustments ?? Math.max(0, bl.revised_estimate - bl.original_estimate),
        is_change_order_line: !!bl.cost_codes?.is_change_order,
        budget_lines: {
          id: bl.id,
          original_estimate: bl.original_estimate,
          revised_estimate: bl.revised_estimate,
          cost_codes: bl.cost_codes,
        },
      };
    });

    // Lien releases for this draw.
    const { data: lienReleases } = await supabase
      .from("lien_releases")
      .select(
        `id, vendor_id, amount, release_type, status, through_date, received_at, document_url, notes,
         vendors:vendor_id (id, name)`
      )
      .eq("draw_id", params.id)
      .is("deleted_at", null)
      .order("created_at");

    return NextResponse.json({
      ...draw,
      // Override the stored G702 totals with freshly-computed Phase 8 math so
      // the detail page always shows correct retainage / current-due numbers
      // even if the stored row is stale (e.g., after editing retainage_percent).
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
      application_number: applicationNumberForDraw(
        { draw_number: (draw as { draw_number: number }).draw_number },
        { starting_application_number: (draw as { jobs?: { starting_application_number?: number | null } }).jobs?.starting_application_number ?? null }
      ),
      retainage_percent: retainagePct,
      line_items: g703Rows.sort(
        (a, b) =>
          (a.budget_lines.cost_codes?.sort_order ?? 0) - (b.budget_lines.cost_codes?.sort_order ?? 0)
      ),
      all_budget_lines: budgetLines,
      invoices: invoices ?? [],
      lien_releases: lienReleases ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
