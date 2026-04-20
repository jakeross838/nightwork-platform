import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";
import {
  computeDrawLines,
  lessPreviousCertificatesForJob,
  nonBudgetLineThisPeriodForDraw,
  rollupDrawTotals,
} from "@/lib/draw-calc";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * GET /api/draws/[id]/compare
 *
 * Phase 8f Part B: returns side-by-side line comparison for the current draw
 * vs the immediate prior locked/submitted/approved draw on the same job. Per
 * line: previous_period_amount, current_period_amount, delta, cumulative %.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const orgId = membership.org_id;

    const supabase = createServerClient();
    const { data: current, error } = await supabase
      .from("draws")
      .select("id, job_id, draw_number, revision_number, period_start, period_end, is_final, status")
      .eq("id", params.id)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .single();
    if (error || !current) {
      return NextResponse.json({ error: "Draw not found" }, { status: 404 });
    }

    const job_id = current.job_id as string;
    const drawNumber = current.draw_number as number;

    // Find the immediate prior draw on this job (lower draw_number, any
    // workflow status, latest revision wins).
    const { data: priorList } = await supabase
      .from("draws")
      .select("id, draw_number, revision_number, status, period_start, period_end, is_final")
      .eq("job_id", job_id)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .lt("draw_number", drawNumber)
      .order("draw_number", { ascending: false })
      .order("revision_number", { ascending: false })
      .limit(5);

    const prior = (priorList ?? [])[0] ?? null;

    // Helper to produce the snapshot/totals payload for a given draw.
    const snapshotFor = async (draw: {
      id: string;
      job_id?: string;
      draw_number: number;
      period_start: string | null;
      period_end: string | null;
      is_final: boolean;
    }) => {
      const { data: invs } = await supabase
        .from("invoices")
        .select("id, total_amount, vendor_id, vendor_name_raw, cost_code_id")
        .eq("draw_id", draw.id)
        .eq("org_id", orgId)
        .is("deleted_at", null);
      const invIds = (invs ?? []).map((i) => i.id as string);
      const { data: jobRow } = await supabase
        .from("jobs")
        .select("retainage_percent, original_contract_amount, deposit_percentage, previous_co_completed_amount")
        .eq("id", job_id)
        .eq("org_id", orgId)
        .single();
      const retPct = (jobRow as { retainage_percent?: number } | null)?.retainage_percent ?? 10;
      const { lines } = await computeDrawLines({
        jobId: job_id,
        drawNumber: draw.draw_number,
        excludeDrawId: draw.id,
        periodStart: draw.period_start,
        periodEnd: draw.period_end,
        drawInvoiceIds: invIds,
        retainagePercent: retPct,
        isFinalDraw: !!draw.is_final,
      });
      const lessPrev = await lessPreviousCertificatesForJob(job_id, draw.draw_number, draw.id);

      // Net change orders for the rollup totals.
      const { data: changeOrders } = await supabase
        .from("change_orders")
        .select("total_with_fee, amount, co_type, status")
        .eq("job_id", job_id)
        .eq("org_id", orgId)
        .in("status", ["approved", "executed"])
        .is("deleted_at", null);
      const netChangeOrders =
        (changeOrders ?? [])
          .filter((co) => (co as { co_type?: string }).co_type === "owner")
          .reduce(
            (s, co) =>
              s +
              ((co as { total_with_fee?: number; amount?: number }).total_with_fee ??
                (co as { amount?: number }).amount ??
                0),
            0
          );

      const nonBudgetLineThisPeriod = await nonBudgetLineThisPeriodForDraw(draw.id);
      const totals = rollupDrawTotals({
        originalContractSum:
          (jobRow as { original_contract_amount?: number } | null)?.original_contract_amount ?? 0,
        netChangeOrders,
        depositPercentage:
          (jobRow as { deposit_percentage?: number } | null)?.deposit_percentage ?? 0.1,
        retainagePercent: retPct,
        lines,
        lessPreviousCertificates: lessPrev,
        isFinalDraw: !!draw.is_final,
        nonBudgetLineThisPeriod,
        previousCoCompletedAmount:
          (jobRow as { previous_co_completed_amount?: number } | null)?.previous_co_completed_amount ?? 0,
      });
      return { lines, totals, invoiceCount: (invs ?? []).length };
    };

    const currentSnap = await snapshotFor({
      id: current.id as string,
      draw_number: drawNumber,
      period_start: current.period_start as string | null,
      period_end: current.period_end as string | null,
      is_final: !!current.is_final,
    });

    const priorSnap = prior
      ? await snapshotFor({
          id: prior.id as string,
          draw_number: prior.draw_number as number,
          period_start: prior.period_start as string | null,
          period_end: prior.period_end as string | null,
          is_final: !!prior.is_final,
        })
      : null;

    // Resolve cost-code metadata for the union of cost codes on either side.
    const ccIds = Array.from(
      new Set([
        ...currentSnap.lines.map((l) => l.cost_code_id),
        ...(priorSnap?.lines.map((l) => l.cost_code_id) ?? []),
      ])
    );
    const { data: ccMetaRaw } = await supabase
      .from("cost_codes")
      .select("id, code, description, sort_order, is_change_order")
      .in("id", ccIds);
    const ccMeta = new Map<
      string,
      { code: string; description: string; sort_order: number; is_change_order: boolean }
    >();
    for (const row of (ccMetaRaw ?? []) as Array<{
      id: string;
      code: string;
      description: string;
      sort_order: number;
      is_change_order: boolean;
    }>) {
      ccMeta.set(row.id, {
        code: row.code,
        description: row.description,
        sort_order: row.sort_order,
        is_change_order: row.is_change_order,
      });
    }

    // Per-line comparison. A line appears if it has any value on either side.
    const merged = ccIds
      .map((ccId) => {
        const cur = currentSnap.lines.find((l) => l.cost_code_id === ccId);
        const pri = priorSnap?.lines.find((l) => l.cost_code_id === ccId);
        const meta = ccMeta.get(ccId);
        const previous_period = pri?.this_period ?? 0;
        const current_period = cur?.this_period ?? 0;
        const delta = current_period - previous_period;
        const cumulative_pct = cur?.percent_complete ?? 0;
        const prior_cumulative_pct = pri?.percent_complete ?? 0;
        const new_line = previous_period === 0 && current_period > 0;
        const went_backwards = current_period < 0;
        const swing_pct =
          previous_period > 0
            ? Math.abs((current_period - previous_period) / previous_period) * 100
            : current_period > 0
              ? 100
              : 0;
        const large_swing = previous_period > 0 && swing_pct > 50;
        return {
          cost_code_id: ccId,
          code: meta?.code ?? "—",
          description: meta?.description ?? "",
          sort_order: meta?.sort_order ?? 0,
          is_change_order: !!meta?.is_change_order,
          scheduled_value: cur?.scheduled_value ?? pri?.scheduled_value ?? 0,
          previous_period,
          current_period,
          delta,
          cumulative_pct,
          prior_cumulative_pct,
          new_line,
          went_backwards,
          large_swing,
          swing_pct,
        };
      })
      .filter((m) => m.previous_period !== 0 || m.current_period !== 0)
      .sort((a, b) => a.sort_order - b.sort_order);

    return NextResponse.json({
      current: {
        id: current.id,
        draw_number: current.draw_number,
        revision_number: current.revision_number,
        period_start: current.period_start,
        period_end: current.period_end,
        totals: currentSnap.totals,
        invoice_count: currentSnap.invoiceCount,
      },
      prior: prior
        ? {
            id: prior.id,
            draw_number: prior.draw_number,
            revision_number: prior.revision_number,
            period_start: prior.period_start,
            period_end: prior.period_end,
            totals: priorSnap?.totals,
            invoice_count: priorSnap?.invoiceCount ?? 0,
          }
        : null,
      lines: merged,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
