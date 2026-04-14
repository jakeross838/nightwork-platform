import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

interface LineItemPayload {
 id?: string | null; // existing row id (UUID) — null/undefined = new row
 line_index: number;
 description: string | null;
 qty: number | null;
 unit: string | null;
 rate: number | null;
 amount_cents: number;
 cost_code_id: string | null;
 is_change_order: boolean;
 co_reference: string | null;
}

/**
 * Bulk-replace the invoice's line items. The PM Review page calls this to
 * persist per-line cost-code splits, CO toggles, and any edits. Resolves
 * budget_line_id on the server based on the invoice's job + each line's
 * cost code, so the G703 query has the right join key.
 *
 * Strategy: soft-delete any row not in the payload (so history survives),
 * update existing rows in place, and insert new ones.
 */
export async function PUT(
 request: NextRequest,
 { params }: { params: { id: string } }
) {
 try {
 const supabase = createServerClient();
 const body = (await request.json()) as { line_items: LineItemPayload[] };
 const payload = Array.isArray(body.line_items) ? body.line_items : [];

 // Fetch the parent invoice so we can resolve budget_line_id per line.
 const { data: invoice, error: invErr } = await supabase
 .from("invoices")
 .select("id, job_id")
 .eq("id", params.id)
 .single();
 if (invErr || !invoice) {
 return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
 }
 const jobId = invoice.job_id as string | null;

 // Fetch every current line so we can soft-delete the ones the client dropped.
 const { data: currentLines } = await supabase
 .from("invoice_line_items")
 .select("id")
 .eq("invoice_id", params.id)
 .is("deleted_at", null);
 const currentIds = new Set((currentLines ?? []).map((l) => l.id as string));
 const payloadIds = new Set(payload.filter((p) => p.id).map((p) => p.id as string));
 const toDelete = Array.from(currentIds).filter((id) => !payloadIds.has(id));

 if (toDelete.length > 0) {
 await supabase
 .from("invoice_line_items")
 .update({ deleted_at: new Date().toISOString() })
 .in("id", toDelete);
 }

 // Resolve budget lines (dedupe by cost code).
 const uniqueCostCodes = Array.from(
 new Set(payload.map((p) => p.cost_code_id).filter(Boolean) as string[])
 );
 const budgetLineByCode = new Map<string, string | null>();
 if (jobId) {
 for (const ccId of uniqueCostCodes) {
 const { data } = await supabase
 .from("budget_lines")
 .select("id")
 .eq("job_id", jobId)
 .eq("cost_code_id", ccId)
 .is("deleted_at", null)
 .limit(1);
 budgetLineByCode.set(ccId, (data?.[0]?.id as string) ?? null);
 }
 }

 const rows = payload.map((p) => ({
 id: p.id ?? undefined,
 invoice_id: params.id,
 line_index: p.line_index,
 description: p.description,
 qty: p.qty,
 unit: p.unit,
 rate: p.rate,
 amount_cents: p.amount_cents,
 cost_code_id: p.cost_code_id,
 budget_line_id: p.cost_code_id ? budgetLineByCode.get(p.cost_code_id) ?? null : null,
 is_change_order: p.is_change_order,
 co_reference: p.co_reference,
 org_id: ORG_ID,
 // Revive rows if a prior soft-delete left this id dangling.
 deleted_at: null,
 }));

 if (rows.length > 0) {
 const { error: upsertErr } = await supabase
 .from("invoice_line_items")
 .upsert(rows, { onConflict: "id" });
 if (upsertErr) {
 return NextResponse.json({ error: upsertErr.message }, { status: 500 });
 }
 }

 return NextResponse.json({ ok: true, count: rows.length, deleted: toDelete.length });
 } catch (err) {
 const message = err instanceof Error ? err.message : "Unknown error";
 return NextResponse.json({ error: message }, { status: 500 });
 }
}
