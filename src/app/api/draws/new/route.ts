import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

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

    // Get all budget lines for this job
    const { data: budgetLines } = await supabase
      .from("budget_lines")
      .select("id, cost_code_id, original_estimate, revised_estimate")
      .eq("job_id", job_id)
      .is("deleted_at", null);

    // G702 Line 1: Original Contract Sum from job record, NOT budget lines
    const originalContractSum = job.original_contract_amount;

    // Get selected invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, cost_code_id, total_amount")
      .in("id", invoice_ids)
      .is("deleted_at", null);

    // Get sum of all prior draws for this job (less_previous_payments)
    const { data: priorDraws } = await supabase
      .from("draws")
      .select("current_payment_due")
      .eq("job_id", job_id)
      .is("deleted_at", null)
      .neq("status", "void");

    const lessPreviousPayments = priorDraws?.reduce((s, d) => s + d.current_payment_due, 0) ?? 0;

    // Compute this period total
    const thisPeriodTotal = invoices?.reduce((s, inv) => s + inv.total_amount, 0) ?? 0;

    // Get total from all prior draws' invoices (previous applications total)
    const { data: priorInvoices } = await supabase
      .from("invoices")
      .select("total_amount")
      .eq("job_id", job_id)
      .eq("status", "in_draw")
      .is("deleted_at", null);

    const previousApplicationsTotal = priorInvoices?.reduce((s, inv) => s + inv.total_amount, 0) ?? 0;

    // G702 Line 2: Net Change Orders from executed change_orders
    const { data: changeOrders } = await supabase
      .from("change_orders")
      .select("total_with_fee")
      .eq("job_id", job_id)
      .eq("status", "executed")
      .is("deleted_at", null);
    const netChangeOrders = changeOrders?.reduce((s, co) => s + co.total_with_fee, 0) ?? 0;

    // G702 Line 3: Contract Sum to Date
    const contractSumToDate = originalContractSum + netChangeOrders;
    const totalCompletedToDate = previousApplicationsTotal + thisPeriodTotal;
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

    // Create draw_line_items for each budget line that has activity
    if (budgetLines && invoices) {
      const lineItems = budgetLines
        .map((bl) => {
          // Invoices in this draw for this cost code
          const thisDrawInvoices = invoices.filter(inv => inv.cost_code_id === bl.cost_code_id);
          const thisPeriod = thisDrawInvoices.reduce((s, inv) => s + inv.total_amount, 0);

          // For now, previous applications = 0 (first draw)
          // In a real scenario, we'd query prior draw_line_items
          const previousApps = 0;
          const totalToDate = previousApps + thisPeriod;
          const percentComplete = bl.revised_estimate > 0
            ? Math.round((totalToDate / bl.revised_estimate) * 10000) / 100
            : 0;
          const balToFinish = bl.revised_estimate - totalToDate;

          return {
            draw_id: draw.id,
            budget_line_id: bl.id,
            previous_applications: previousApps,
            this_period: thisPeriod,
            total_to_date: totalToDate,
            percent_complete: percentComplete,
            balance_to_finish: balToFinish,
            org_id: ORG_ID,
          };
        })
        .filter(li => li.this_period > 0 || li.previous_applications > 0);

      if (lineItems.length > 0) {
        await supabase.from("draw_line_items").insert(lineItems);
      }
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
