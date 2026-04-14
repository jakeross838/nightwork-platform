import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

interface BudgetLineRow {
  id: string;
  cost_code_id: string;
  original_estimate: number;
  revised_estimate: number;
  previous_applications_baseline: number;
  cost_codes: { code: string; description: string; category: string; sort_order: number };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();

    // Get draw with job info
    const { data: draw, error } = await supabase
      .from("draws")
      .select(`*, jobs:job_id (id, name, address, client_name, deposit_percentage, gc_fee_percentage)`)
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();

    if (error || !draw) {
      return NextResponse.json({ error: "Draw not found" }, { status: 404 });
    }

    // Get invoices linked to this draw
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, vendor_name_raw, invoice_number, total_amount, cost_code_id")
      .eq("draw_id", params.id)
      .is("deleted_at", null);

    // Get all budget lines for this job (including baseline)
    const { data: fetchedBudgetLines } = await supabase
      .from("budget_lines")
      .select(`
        id, cost_code_id, original_estimate, revised_estimate, previous_applications_baseline,
        cost_codes:cost_code_id (code, description, category, sort_order)
      `)
      .eq("job_id", draw.job_id)
      .is("deleted_at", null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allBudgetLines: BudgetLineRow[] = ((fetchedBudgetLines ?? []) as any[]).map(bl => ({
      ...bl,
      cost_codes: Array.isArray(bl.cost_codes) ? bl.cost_codes[0] : bl.cost_codes,
    }));

    // Handle invoice cost codes missing from the bulk query (PostgREST caching quirk)
    const budgetLineCostCodeIds = new Set(allBudgetLines.map(bl => bl.cost_code_id));
    for (const inv of invoices ?? []) {
      if (inv.cost_code_id && !budgetLineCostCodeIds.has(inv.cost_code_id)) {
        const { data: existingBl } = await supabase
          .from("budget_lines")
          .select(`
            id, cost_code_id, original_estimate, revised_estimate, previous_applications_baseline,
            cost_codes:cost_code_id (code, description, category, sort_order)
          `)
          .eq("job_id", draw.job_id)
          .eq("cost_code_id", inv.cost_code_id)
          .is("deleted_at", null)
          .maybeSingle();

        if (existingBl) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bl = existingBl as any;
          allBudgetLines.push({ ...bl, cost_codes: Array.isArray(bl.cost_codes) ? bl.cost_codes[0] : bl.cost_codes });
          budgetLineCostCodeIds.add(inv.cost_code_id);
        } else {
          // Auto-create budget line with $0 estimate
          const { data: created } = await supabase
            .from("budget_lines")
            .insert({ job_id: draw.job_id, cost_code_id: inv.cost_code_id, original_estimate: 0, revised_estimate: 0, previous_applications_baseline: 0, org_id: ORG_ID })
            .select(`
              id, cost_code_id, original_estimate, revised_estimate, previous_applications_baseline,
              cost_codes:cost_code_id (code, description, category, sort_order)
            `)
            .single();
          if (created) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const bl = created as any;
            allBudgetLines.push({ ...bl, cost_codes: Array.isArray(bl.cost_codes) ? bl.cost_codes[0] : bl.cost_codes });
            budgetLineCostCodeIds.add(inv.cost_code_id);
          }
        }
      }
    }

    // Compute G703 line items dynamically from invoices (never stored, always calculated)
    // Sum invoice amounts by cost_code_id for this draw
    const thisPeriodByCostCode = new Map<string, number>();
    for (const inv of invoices ?? []) {
      if (inv.cost_code_id) {
        thisPeriodByCostCode.set(
          inv.cost_code_id,
          (thisPeriodByCostCode.get(inv.cost_code_id) ?? 0) + inv.total_amount
        );
      }
    }

    // TODO: For multi-draw support, also query invoices from prior draws grouped by cost_code_id
    // For now, prior draw invoices = 0 (baseline covers pre-system history)

    // Build computed line items for the response
    const computedLineItems = allBudgetLines.map(bl => {
      const thisPeriod = thisPeriodByCostCode.get(bl.cost_code_id) ?? 0;
      const baseline = bl.previous_applications_baseline ?? 0;
      const previousApplications = baseline; // + prior draw invoices when multi-draw
      const totalToDate = previousApplications + thisPeriod;
      const percentComplete = bl.revised_estimate > 0
        ? Math.round((totalToDate / bl.revised_estimate) * 10000) / 100
        : (totalToDate > 0 ? 100 : 0);
      const balanceToFinish = bl.revised_estimate - totalToDate;

      return {
        id: `computed-${bl.id}`,
        previous_applications: previousApplications,
        this_period: thisPeriod,
        total_to_date: totalToDate,
        percent_complete: percentComplete,
        balance_to_finish: balanceToFinish,
        budget_lines: {
          id: bl.id,
          original_estimate: bl.original_estimate,
          revised_estimate: bl.revised_estimate,
          cost_codes: bl.cost_codes,
        },
      };
    });

    // Sort by cost code sort_order
    const sortedLineItems = computedLineItems.sort((a, b) => {
      const aSort = a.budget_lines.cost_codes?.sort_order ?? 0;
      const bSort = b.budget_lines.cost_codes?.sort_order ?? 0;
      return aSort - bSort;
    });

    return NextResponse.json({
      ...draw,
      line_items: sortedLineItems,
      all_budget_lines: allBudgetLines,
      invoices: invoices ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
