import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { recalcLinesAndPOs } from "@/lib/recalc";
import { logStatusChange } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

interface BatchActionRequest {
 action: "approve" | "hold";
 invoice_ids: string[];
 note?: string;
}

interface FailedItem {
 id: string;
 reason: string;
}

const REVIEWABLE_STATUSES = ["pm_review", "ai_processed", "pm_held"];

export async function POST(request: NextRequest) {
 try {
 const supabase = createServerClient();
 const body: BatchActionRequest = await request.json();
 const { action, invoice_ids, note } = body;

 if (!action || !["approve", "hold"].includes(action)) {
 return NextResponse.json({ error: "Invalid action" }, { status: 400 });
 }

 if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
 return NextResponse.json({ error: "No invoice IDs provided" }, { status: 400 });
 }

 if (action === "hold" && !note) {
 return NextResponse.json({ error: "Hold requires a note" }, { status: 400 });
 }

 // Fetch all requested invoices
 const { data: invoices, error: fetchError } = await supabase
 .from("invoices")
 .select("id, status, status_history, job_id, cost_code_id, org_id")
 .in("id", invoice_ids)
 .is("deleted_at", null);

 if (fetchError) {
 return NextResponse.json({ error: fetchError.message }, { status: 500 });
 }

 const invoiceMap = new Map(
 (invoices ?? []).map((inv) => [inv.id, inv])
 );

 const success: string[] = [];
 const failed: FailedItem[] = [];

 for (const id of invoice_ids) {
 const invoice = invoiceMap.get(id);

 if (!invoice) {
 failed.push({ id, reason: "Invoice not found" });
 continue;
 }

 if (!REVIEWABLE_STATUSES.includes(invoice.status)) {
 failed.push({ id, reason: `Invoice is not in a reviewable state (current: ${invoice.status})` });
 continue;
 }

 if (action === "approve") {
 if (!invoice.job_id || !invoice.cost_code_id) {
 failed.push({ id, reason: "Missing job or cost code" });
 continue;
 }
 }

 // Build status transition
 const now = new Date().toISOString();
 const existingHistory = Array.isArray(invoice.status_history) ? invoice.status_history : [];

 if (action === "approve") {
 // approve -> pm_approved -> auto-advance to qa_review
 const statusEntries = [
 {
 who: "pm",
 when: now,
 old_status: invoice.status,
 new_status: "pm_approved",
 note: note ?? "pm approve (batch)",
 },
 {
 who: "system",
 when: now,
 old_status: "pm_approved",
 new_status: "qa_review",
 note: "Auto-routed to qa review",
 },
 ];

 const { error: updateError } = await supabase
 .from("invoices")
 .update({
 status: "qa_review",
 status_history: [...existingHistory, ...statusEntries],
 })
 .eq("id", id);

 if (updateError) {
 failed.push({ id, reason: updateError.message });
 } else {
 success.push(id);
 }
 } else {
 // hold -> pm_held
 const statusEntry = {
 who: "pm",
 when: now,
 old_status: invoice.status,
 new_status: "pm_held",
 note: note ?? "pm hold (batch)",
 };

 const { error: updateError } = await supabase
 .from("invoices")
 .update({
 status: "pm_held",
 status_history: [...existingHistory, statusEntry],
 })
 .eq("id", id);

 if (updateError) {
 failed.push({ id, reason: updateError.message });
 } else {
 success.push(id);
 }
 }
 }

 // Phase 7b: recalc + log for every successfully-flipped invoice.
 if (success.length > 0) {
 const { data: { user } } = await supabase.auth.getUser();
 try {
 const { data: lines } = await supabase
 .from("invoice_line_items")
 .select("invoice_id, budget_line_id, po_id")
 .in("invoice_id", success)
 .is("deleted_at", null);
 await recalcLinesAndPOs(
 (lines ?? []).map((l) => l.budget_line_id),
 (lines ?? []).map((l) => l.po_id)
 );
 } catch (recalcErr) {
 console.warn(
 `[batch-action recalc] ${recalcErr instanceof Error ? recalcErr.message : recalcErr}`
 );
 }
 for (const id of success) {
 const inv = invoiceMap.get(id);
 if (!inv) continue;
 await logStatusChange({
 org_id: (inv.org_id as string | null) ?? "00000000-0000-0000-0000-000000000001",
 user_id: user?.id ?? null,
 entity_type: "invoice",
 entity_id: id,
 from: inv.status,
 to: action === "approve" ? "qa_review" : "pm_held",
 reason: note,
 extra: { action, batch: true },
 });
 }
 }

 return NextResponse.json({ success, failed });
 } catch (err) {
 const message = err instanceof Error ? err.message : "Unknown error";
 return NextResponse.json({ error: message }, { status: 500 });
 }
}
