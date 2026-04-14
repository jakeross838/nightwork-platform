import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(
 _request: NextRequest,
 { params }: { params: { id: string } }
) {
 try {
 const supabase = createServerClient();

 // Fetch the current draw
 const { data: original, error: fetchError } = await supabase
 .from("draws")
 .select("*")
 .eq("id", params.id)
 .is("deleted_at", null)
 .single();

 if (fetchError || !original) {
 return NextResponse.json({ error: "Draw not found" }, { status: 404 });
 }

 // Only submitted or paid draws can be revised
 if (original.status !== "submitted" && original.status !== "paid") {
 return NextResponse.json(
 { error: "Only submitted or paid draws can be revised. Current status: " + original.status },
 { status: 400 }
 );
 }

 const newRevisionNumber = (original.revision_number ?? 0) + 1;

 // Create a new draw record as a revision
 const { data: revision, error: createError } = await supabase
 .from("draws")
 .insert({
 job_id: original.job_id,
 draw_number: original.draw_number,
 application_date: original.application_date,
 period_start: original.period_start,
 period_end: original.period_end,
 revision_number: newRevisionNumber,
 status: "draft",
 original_contract_sum: original.original_contract_sum,
 net_change_orders: original.net_change_orders,
 contract_sum_to_date: original.contract_sum_to_date,
 total_completed_to_date: original.total_completed_to_date,
 less_previous_payments: original.less_previous_payments,
 current_payment_due: original.current_payment_due,
 balance_to_finish: original.balance_to_finish,
 deposit_amount: original.deposit_amount,
 status_history: [
 {
 who: "system",
 when: new Date().toISOString(),
 old_status: null,
 new_status: "draft",
 note: `Revision ${newRevisionNumber} created from Rev ${original.revision_number ?? 0} (draw was ${original.status})`,
 },
 ],
 org_id: ORG_ID,
 })
 .select("id, draw_number, revision_number")
 .single();

 if (createError || !revision) {
 return NextResponse.json(
 { error: createError?.message ?? "Failed to create revision" },
 { status: 500 }
 );
 }

 return NextResponse.json({
 id: revision.id,
 draw_number: revision.draw_number,
 revision_number: revision.revision_number,
 });
 } catch (err) {
 const message = err instanceof Error ? err.message : "Unknown error";
 return NextResponse.json({ error: message }, { status: 500 });
 }
}
