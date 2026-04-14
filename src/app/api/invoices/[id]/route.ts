import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
 _request: NextRequest,
 { params }: { params: { id: string } }
) {
 try {
 const supabase = createServerClient();

 const { data: invoice, error } = await supabase
 .from("invoices")
 .select(`
 *,
 jobs:job_id (id, name, address, client_name, original_contract_amount, current_contract_amount),
 vendors:vendor_id (id, name),
 cost_codes:cost_code_id (id, code, description),
 assigned_pm:assigned_pm_id (id, full_name, role)
 `)
 .eq("id", params.id)
 .is("deleted_at", null)
 .single();

 if (error || !invoice) {
 return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
 }

 // Per-line items (multi-cost-code support). The invoice-level
 // `line_items` JSONB is kept as a mirror but the authoritative source
 // for cost-code splits is invoice_line_items.
 const { data: lineItems } = await supabase
 .from("invoice_line_items")
 .select(`
 id, line_index, description, qty, unit, rate, amount_cents,
 cost_code_id, budget_line_id, is_change_order, co_reference,
 ai_suggested_cost_code_id, ai_suggestion_confidence,
 cost_codes:cost_code_id (id, code, description, category, is_change_order)
 `)
 .eq("invoice_id", params.id)
 .is("deleted_at", null)
 .order("line_index");

 // Get signed URL for the original file
 let signedUrl: string | null = null;
 if (invoice.original_file_url) {
 const { data: urlData } = await supabase.storage
 .from("invoice-files")
 .createSignedUrl(invoice.original_file_url, 3600);
 signedUrl = urlData?.signedUrl ?? null;
 }

 // Fetch PM/admin users for reassignment dropdown
 const { data: pmUsers } = await supabase
 .from("users")
 .select("id, full_name")
 .in("role", ["pm", "admin"])
 .is("deleted_at", null)
 .order("full_name");

 return NextResponse.json({
 ...invoice,
 signed_file_url: signedUrl,
 pm_users: pmUsers ?? [],
 invoice_line_items: lineItems ?? [],
 });
 } catch (err) {
 const message = err instanceof Error ? err.message : "Unknown error";
 return NextResponse.json({ error: message }, { status: 500 });
 }
}

export async function PATCH(
 request: NextRequest,
 { params }: { params: { id: string } }
) {
 try {
 const supabase = createServerClient();
 const updates = await request.json();

 const { data, error } = await supabase
 .from("invoices")
 .update(updates)
 .eq("id", params.id)
 .select("id")
 .single();

 if (error) {
 return NextResponse.json({ error: error.message }, { status: 500 });
 }

 return NextResponse.json(data);
 } catch (err) {
 const message = err instanceof Error ? err.message : "Unknown error";
 return NextResponse.json({ error: message }, { status: 500 });
 }
}
