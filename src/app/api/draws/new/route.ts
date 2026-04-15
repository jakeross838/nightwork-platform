import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import {
  computeDrawLines,
  lessPreviousCertificatesForJob,
  rollupDrawTotals,
} from "@/lib/draw-calc";

export const dynamic = "force-dynamic";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

interface CreateDrawRequest {
  job_id: string;
  application_date: string;
  period_start: string;
  period_end: string;
  invoice_ids: string[];
  is_final?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body: CreateDrawRequest = await request.json();
    const {
      job_id,
      application_date,
      period_start,
      period_end,
      invoice_ids,
      is_final,
    } = body;

    if (!job_id || !application_date || !period_start || !period_end) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Phase 8 guard: cannot create a new draw if the prior one is still in
    // draft or submitted. Revisions (same draw_number) are allowed.
    const { data: openPriorDraws } = await supabase
      .from("draws")
      .select("id, draw_number, status")
      .eq("job_id", job_id)
      .in("status", ["draft", "pm_review", "submitted"])
      .is("deleted_at", null)
      .order("draw_number", { ascending: false })
      .limit(1);

    if (openPriorDraws && openPriorDraws.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot create a new draw — Draw #${openPriorDraws[0].draw_number} is still in '${openPriorDraws[0].status}' status. Approve or void it first.`,
        },
        { status: 400 }
      );
    }

    // Next draw number for this job (revisions share a draw_number so we
    // only count rev 0).
    const { data: lastDraw } = await supabase
      .from("draws")
      .select("draw_number")
      .eq("job_id", job_id)
      .is("deleted_at", null)
      .eq("revision_number", 0)
      .order("draw_number", { ascending: false })
      .limit(1);
    const drawNumber = (lastDraw?.[0]?.draw_number ?? 0) + 1;

    const { data: job } = await supabase
      .from("jobs")
      .select(
        "original_contract_amount, current_contract_amount, deposit_percentage, approved_cos_total, retainage_percent"
      )
      .eq("id", job_id)
      .single();
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const originalContractSum = (job as { original_contract_amount: number }).original_contract_amount ?? 0;

    // Net change orders = sum of owner-type approved/executed COs.
    const { data: changeOrders } = await supabase
      .from("change_orders")
      .select("total_with_fee, amount, co_type, status")
      .eq("job_id", job_id)
      .in("status", ["approved", "executed"])
      .is("deleted_at", null);
    const netChangeOrders =
      (changeOrders ?? [])
        .filter((co) => (co as { co_type?: string }).co_type === "owner")
        .reduce((s, co) => s + ((co as { total_with_fee?: number; amount?: number }).total_with_fee ?? (co as { amount?: number }).amount ?? 0), 0);

    // Compute line snapshot via the shared engine.
    const { lines } = await computeDrawLines({
      jobId: job_id,
      drawNumber,
      drawInvoiceIds: invoice_ids,
      periodStart: period_start,
      periodEnd: period_end,
      retainagePercent: (job as { retainage_percent?: number }).retainage_percent ?? 10,
      isFinalDraw: !!is_final,
    });
    const lessPrevCerts = await lessPreviousCertificatesForJob(job_id, drawNumber);
    const totals = rollupDrawTotals({
      originalContractSum,
      netChangeOrders,
      depositPercentage: (job as { deposit_percentage?: number }).deposit_percentage ?? 0.1,
      retainagePercent: (job as { retainage_percent?: number }).retainage_percent ?? 10,
      lines,
      lessPreviousCertificates: lessPrevCerts,
      isFinalDraw: !!is_final,
    });

    const { data: draw, error: drawError } = await supabase
      .from("draws")
      .insert({
        job_id,
        draw_number: drawNumber,
        revision_number: 0,
        application_date,
        period_start,
        period_end,
        status: "draft",
        is_final: !!is_final,
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
        status_history: [
          {
            who: "system",
            when: new Date().toISOString(),
            old_status: null,
            new_status: "draft",
            note: `Draw #${drawNumber}${is_final ? " (FINAL)" : ""} created with ${invoice_ids.length} invoice(s). Period: ${period_start} to ${period_end}.`,
          },
        ],
        org_id: ORG_ID,
      })
      .select("id, draw_number")
      .single();

    if (drawError || !draw) {
      return NextResponse.json({ error: drawError?.message ?? "Failed to create draw" }, { status: 500 });
    }

    // Link invoices to the draw (status stays qa_approved until submit).
    if (invoice_ids.length > 0) {
      await supabase
        .from("invoices")
        .update({ draw_id: draw.id })
        .in("id", invoice_ids);
    }

    await logActivity({
      org_id: ORG_ID,
      entity_type: "draw",
      entity_id: draw.id as string,
      action: "created",
      details: {
        draw_number: drawNumber,
        invoice_count: invoice_ids.length,
        current_payment_due: totals.current_payment_due,
        retainage: totals.total_retainage,
        is_final: !!is_final,
      },
    });

    return NextResponse.json({ id: draw.id, draw_number: draw.draw_number });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
