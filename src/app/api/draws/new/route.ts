import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

interface CreateDrawRequest {
  job_id: string;
  application_date: string;
  period_start: string;
  period_end: string;
  invoice_ids: string[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body: CreateDrawRequest = await request.json();
    const { job_id, application_date, period_start, period_end, invoice_ids } = body;

    if (!job_id || !application_date || !period_start || !period_end) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get next draw number for this job
    const { data: lastDraw } = await supabase
      .from("draws")
      .select("draw_number")
      .eq("job_id", job_id)
      .is("deleted_at", null)
      .order("draw_number", { ascending: false })
      .limit(1);

    const drawNumber = (lastDraw?.[0]?.draw_number ?? 0) + 1;

    // Get job info for G702 computations
    const { data: job } = await supabase
      .from("jobs")
      .select("original_contract_amount, current_contract_amount, deposit_percentage")
      .eq("id", job_id)
      .single();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Get all budget lines for this job (including baseline)
    const { data: budgetLines, error: blError } = await supabase
      .from("budget_lines")
      .select("id, cost_code_id, original_estimate, revised_estimate, previous_applications_baseline")
      .eq("job_id", job_id)
      .is("deleted_at", null);

    if (blError) {
      return NextResponse.json({ error: blError.message }, { status: 500 });
    }

    // G702 Line 1: Original Contract Sum from job record
    const originalContractSum = job.original_contract_amount;

    // Get selected invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, cost_code_id, total_amount")
      .in("id", invoice_ids)
      .is("deleted_at", null);

    // Auto-create missing budget lines for invoice cost codes
    const existingCostCodeIds = new Set((budgetLines ?? []).map(bl => bl.cost_code_id));
    const missingCostCodeIds = new Set<string>();
    for (const inv of invoices ?? []) {
      if (inv.cost_code_id && !existingCostCodeIds.has(inv.cost_code_id)) {
        missingCostCodeIds.add(inv.cost_code_id);
      }
    }

    if (missingCostCodeIds.size > 0) {
      const newBudgetLines = Array.from(missingCostCodeIds).map(ccId => ({
        job_id,
        cost_code_id: ccId,
        original_estimate: 0,
        revised_estimate: 0,
        previous_applications_baseline: 0,
        org_id: ORG_ID,
      }));
      const { data: inserted, error: insertBlError } = await supabase
        .from("budget_lines")
        .insert(newBudgetLines)
        .select("id, cost_code_id, original_estimate, revised_estimate, previous_applications_baseline");

      if (insertBlError) {
        return NextResponse.json({ error: `Failed to create budget lines: ${insertBlError.message}` }, { status: 500 });
      }

      if (inserted) {
        for (const bl of inserted) {
          budgetLines!.push(bl);
        }
      }
    }

    // Sum baseline from all budget lines (pre-system draw history)
    const totalBaseline = (budgetLines ?? []).reduce((s, bl) => s + (bl.previous_applications_baseline ?? 0), 0);

    // Get invoices from prior draws for this job
    const { data: priorDrawInvoices } = await supabase
      .from("invoices")
      .select("total_amount")
      .eq("job_id", job_id)
      .eq("status", "in_draw")
      .is("deleted_at", null);

    const priorDrawInvoiceTotal = priorDrawInvoices?.reduce((s, inv) => s + inv.total_amount, 0) ?? 0;

    // This period total
    const thisPeriodTotal = invoices?.reduce((s, inv) => s + inv.total_amount, 0) ?? 0;

    // G702 Line 2: Net Change Orders from executed change_orders
    const { data: changeOrders } = await supabase
      .from("change_orders")
      .select("total_with_fee")
      .eq("job_id", job_id)
      .eq("status", "executed")
      .is("deleted_at", null);
    const netChangeOrders = changeOrders?.reduce((s, co) => s + co.total_with_fee, 0) ?? 0;

    // G702 calculations
    const contractSumToDate = originalContractSum + netChangeOrders;
    // Line 4: baseline + all prior draw invoices + this draw invoices
    const totalCompletedToDate = totalBaseline + priorDrawInvoiceTotal + thisPeriodTotal;
    // Line 5: baseline + all prior draw invoices (NOT this draw)
    const lessPreviousPayments = totalBaseline + priorDrawInvoiceTotal;
    // Line 6: what's new this draw
    const currentPaymentDue = totalCompletedToDate - lessPreviousPayments;
    const balanceToFinish = contractSumToDate - totalCompletedToDate;
    const depositAmount = Math.round(originalContractSum * (job.deposit_percentage ?? 0.10));

    // Create the draw record
    const { data: draw, error: drawError } = await supabase
      .from("draws")
      .insert({
        job_id,
        draw_number: drawNumber,
        application_date,
        period_start,
        period_end,
        status: "draft",
        original_contract_sum: originalContractSum,
        net_change_orders: netChangeOrders,
        contract_sum_to_date: contractSumToDate,
        total_completed_to_date: totalCompletedToDate,
        less_previous_payments: lessPreviousPayments,
        current_payment_due: currentPaymentDue,
        balance_to_finish: balanceToFinish,
        deposit_amount: depositAmount,
        status_history: [{
          who: "system",
          when: new Date().toISOString(),
          old_status: null,
          new_status: "draft",
          note: `Draw #${drawNumber} created with ${invoice_ids.length} invoice(s). Period: ${period_start} to ${period_end}.`,
        }],
        org_id: ORG_ID,
      })
      .select("id, draw_number")
      .single();

    if (drawError) {
      return NextResponse.json({ error: drawError.message }, { status: 500 });
    }

    // Update invoices: set draw_id and status to "in_draw"
    if (invoice_ids.length > 0) {
      await supabase
        .from("invoices")
        .update({ draw_id: draw.id, status: "in_draw" })
        .in("id", invoice_ids);
    }

    return NextResponse.json({ id: draw.id, draw_number: draw.draw_number });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
