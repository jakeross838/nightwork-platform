import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  notifyRole,
  notifyUser,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

interface ActionRequest {
 action: "approve" | "hold" | "deny" | "request_info" | "info_received" | "qa_approve" | "kick_back" | "reopen";
 note?: string;
 pm_overrides?: Record<string, { old: unknown; new: unknown }>;
 qa_overrides?: Record<string, { old: unknown; new: unknown }>;
 updates?: Record<string, unknown>;
}

const ACTION_STATUS_MAP: Record<string, string> = {
 approve: "pm_approved",
 hold: "pm_held",
 deny: "pm_denied",
 request_info: "info_requested",
 info_received: "pm_review",
 qa_approve: "qa_approved",
 kick_back: "qa_kicked_back",
 reopen: "pm_review",
};

// After reaching this status, auto-advance to next
const NEXT_STATUS_MAP: Record<string, string> = {
 pm_approved: "qa_review",
 qa_kicked_back: "pm_review",
};

export async function POST(
 request: NextRequest,
 { params }: { params: { id: string } }
) {
 try {
 const supabase = createServerClient();
 const body: ActionRequest = await request.json();
 const { action, note, pm_overrides, qa_overrides, updates } = body;

 if (!ACTION_STATUS_MAP[action]) {
 return NextResponse.json({ error: "Invalid action" }, { status: 400 });
 }

 if ((action === "hold" || action === "deny" || action === "kick_back" || action === "request_info") && !note) {
 return NextResponse.json(
 { error: `${action} requires a note` },
 { status: 400 }
 );
 }

 const { data: invoice, error: fetchError } = await supabase
 .from("invoices")
 .select("status, status_history, pm_overrides, qa_overrides, job_id, cost_code_id, total_amount, ai_parsed_total_amount, org_id, vendor_name_raw, vendors(name), jobs(name, pm_id), created_by, assigned_pm_id")
 .eq("id", params.id)
 .single();

 if (fetchError || !invoice) {
 return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
 }

 // Hard block: cannot approve without job and cost code
 if (action === "approve") {
 const effectiveJobId = updates?.job_id ?? invoice.job_id;
 const effectiveCostCodeId = updates?.cost_code_id ?? invoice.cost_code_id;
 if (!effectiveJobId || !effectiveCostCodeId) {
 return NextResponse.json(
 { error: "Job and Cost Code are required before approving" },
 { status: 422 }
 );
 }

 // Hard block: every change-order line item must have a CO reference.
 // Runs server-side so it can't be bypassed by editing the UI.
 const { data: coLinesMissingRef } = await supabase
 .from("invoice_line_items")
 .select("id, line_index, description")
 .eq("invoice_id", params.id)
 .eq("is_change_order", true)
 .or("co_reference.is.null,co_reference.eq.")
 .is("deleted_at", null);

 if (coLinesMissingRef && coLinesMissingRef.length > 0) {
 return NextResponse.json(
 {
 error: `CO Reference required on ${coLinesMissingRef.length} change-order line item(s)`,
 lines: coLinesMissingRef,
 },
 { status: 422 }
 );
 }

 // Amount guard: > 10% over AI-parsed requires a note so the reason is
 // captured in status_history.
 const aiParsed = invoice.ai_parsed_total_amount ?? invoice.total_amount;
 const effectiveTotal =
 typeof updates?.total_amount === "number" ? updates.total_amount : invoice.total_amount;
 if (aiParsed > 0 && effectiveTotal > aiParsed) {
 const pct = ((effectiveTotal - aiParsed) / aiParsed) * 100;
 if (pct > 10 && !note) {
 return NextResponse.json(
 {
 error: `Amount increased by ${pct.toFixed(1)}% over AI-parsed total — a note is required for any increase > 10%`,
 },
 { status: 422 }
 );
 }
 }
 }

 const newStatus = ACTION_STATUS_MAP[action];
 const finalStatus = NEXT_STATUS_MAP[newStatus] ?? newStatus;

 const who = ["qa_approve", "kick_back"].includes(action) ? "accounting" : "pm";

 const existingHistory = Array.isArray(invoice.status_history) ? invoice.status_history : [];

 // Log the immediate action
 const statusEntries = [
 {
 who,
 when: new Date().toISOString(),
 old_status: invoice.status,
 new_status: newStatus,
 note: note ?? `${who} ${action.replace(/_/g, " ")}`,
 },
 ];

 // If there's an auto-advance (e.g. pm_approved → qa_review, qa_kicked_back → pm_review),
 // log that transition too
 if (NEXT_STATUS_MAP[newStatus]) {
 statusEntries.push({
 who: "system",
 when: new Date().toISOString(),
 old_status: newStatus,
 new_status: finalStatus,
 note: newStatus === "qa_kicked_back"
 ? `Auto-routed back to PM. Reason: ${note}`
 : `Auto-routed to ${finalStatus.replace(/_/g, " ")}`,
 });
 }

 const mergedPmOverrides = {
 ...(invoice.pm_overrides as Record<string, unknown> ?? {}),
 ...(pm_overrides ?? {}),
 };

 const mergedQaOverrides = {
 ...(invoice.qa_overrides as Record<string, unknown> ?? {}),
 ...(qa_overrides ?? {}),
 };

 const updatePayload: Record<string, unknown> = {
 status: finalStatus,
 status_history: [...existingHistory, ...statusEntries],
 ...(updates ?? {}),
 };

 if (Object.keys(mergedPmOverrides).length > 0) {
 updatePayload.pm_overrides = mergedPmOverrides;
 }
 if (Object.keys(mergedQaOverrides).length > 0) {
 updatePayload.qa_overrides = mergedQaOverrides;
 }

 const { error: updateError } = await supabase
 .from("invoices")
 .update(updatePayload)
 .eq("id", params.id);

 if (updateError) {
 return NextResponse.json({ error: updateError.message }, { status: 500 });
 }

 // Fire-and-forget notifications. Wrapped so any dispatch failure cannot
 // block the action response — the invoice already advanced status.
 try {
 const inv = invoice as typeof invoice & {
 vendors?: { name: string } | null;
 jobs?: { name: string; pm_id: string | null } | null;
 };
 const vendorName = inv.vendors?.name ?? inv.vendor_name_raw ?? "vendor";
 const jobName = inv.jobs?.name ?? "job";
 const totalDollars = `$${((typeof updates?.total_amount === "number" ? updates.total_amount : invoice.total_amount) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
 const actionUrl = `/invoices/${params.id}`;

 if (action === "approve" && invoice.org_id) {
 await notifyRole(invoice.org_id, ["accounting", "admin", "owner"], {
 notification_type: "invoice_pm_approved",
 subject: `Invoice approved — ${vendorName} · ${totalDollars}`,
 body: `${vendorName} invoice for ${totalDollars} on ${jobName} was approved and is ready for accounting QA.`,
 action_url: actionUrl,
 related_entity_id: params.id,
 });
 } else if (action === "deny" && invoice.org_id) {
 const uploader = (invoice.created_by as string | null) ?? null;
 if (uploader) {
 await notifyUser(uploader, invoice.org_id, {
 notification_type: "invoice_pm_denied",
 subject: `Invoice denied — ${vendorName}`,
 body: `${vendorName} invoice on ${jobName} was denied. Reason: ${note ?? "No reason provided"}`,
 action_url: actionUrl,
 related_entity_id: params.id,
 });
 }
 } else if (action === "qa_approve" && invoice.org_id) {
 const pmId = (invoice.assigned_pm_id as string | null) ?? (inv.jobs?.pm_id ?? null);
 if (pmId) {
 await notifyUser(pmId, invoice.org_id, {
 notification_type: "invoice_qa_approved",
 subject: `Invoice QA approved — ${vendorName}`,
 body: `Accounting approved ${vendorName} invoice for ${totalDollars}. It will be included in the next draw.`,
 action_url: actionUrl,
 related_entity_id: params.id,
 });
 }
 }
 } catch (notifyErr) {
 console.warn(
 `[invoice action notifications] ${notifyErr instanceof Error ? notifyErr.message : notifyErr}`
 );
 }

 return NextResponse.json({ status: finalStatus, action });
 } catch (err) {
 const message = err instanceof Error ? err.message : "Unknown error";
 return NextResponse.json({ error: message }, { status: 500 });
 }
}
