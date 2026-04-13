import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

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

    // Get draw line items with budget line + cost code info
    const { data: lineItems } = await supabase
      .from("draw_line_items")
      .select(`
        *,
        budget_lines:budget_line_id (
          id, original_estimate, revised_estimate,
          cost_codes:cost_code_id (code, description, category, sort_order)
        )
      `)
      .eq("draw_id", params.id)
      .is("deleted_at", null);

    // Get all budget lines for this job (for showing full G703 including zero-activity lines)
    const { data: allBudgetLines } = await supabase
      .from("budget_lines")
      .select(`
        id, original_estimate, revised_estimate,
        cost_codes:cost_code_id (code, description, category, sort_order)
      `)
      .eq("job_id", draw.job_id)
      .is("deleted_at", null);

    // Get invoices linked to this draw
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, vendor_name_raw, invoice_number, total_amount, cost_code_id")
      .eq("draw_id", params.id)
      .is("deleted_at", null);

    // Sort line items by cost code sort_order
    const sortedLineItems = lineItems?.sort((a, b) => {
      const aSort = (a.budget_lines as { cost_codes: { sort_order: number } })?.cost_codes?.sort_order ?? 0;
      const bSort = (b.budget_lines as { cost_codes: { sort_order: number } })?.cost_codes?.sort_order ?? 0;
      return aSort - bSort;
    });

    return NextResponse.json({
      ...draw,
      line_items: sortedLineItems ?? [],
      all_budget_lines: allBudgetLines ?? [],
      invoices: invoices ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
