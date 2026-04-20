import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";
import {
  notifyRole,
  notifyUser,
} from "@/lib/notifications";
import { recalcLinesAndPOs } from "@/lib/recalc";
import { logStatusChange } from "@/lib/activity-log";
import { getWorkflowSettings } from "@/lib/workflow-settings";
import { captureCorrections } from "@/lib/invoices/corrections";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

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
 const membership = await getCurrentMembership();
 if (!membership) {
 return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
 }

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
 .select("status, status_history, pm_overrides, qa_overrides, job_id, cost_code_id, total_amount, ai_parsed_total_amount, org_id, vendor_name_raw, invoice_date, is_potential_duplicate, duplicate_dismissed_at, po_id, vendors(name), jobs(name, pm_id), created_by, assigned_pm_id")
 .eq("id", params.id)
 .eq("org_id", membership.org_id)
 .single();

 if (fetchError || !invoice) {
 return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
 }

 const invoiceOrgId = invoice.org_id as string | null;
 if (!invoiceOrgId) {
 return NextResponse.json(
 { error: "Invoice record missing org_id" },
 { status: 500 }
 );
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

 // Phase 8e — org-configured workflow gates
 try {
 const orgId = (invoice.org_id as string | null) ?? null;
 if (orgId) {
 const settings = await getWorkflowSettings(orgId);
 const effectiveInvoiceDate =
 (typeof updates?.invoice_date === "string" ? updates.invoice_date : invoice.invoice_date) as string | null;

 if (settings.require_invoice_date && !effectiveInvoiceDate) {
 return NextResponse.json(
 { error: "Invoice date is required before approval" },
 { status: 422 }
 );
 }

 if (
 settings.duplicate_detection_enabled &&
 invoice.is_potential_duplicate &&
 !invoice.duplicate_dismissed_at
 ) {
 return NextResponse.json(
 {
 error:
 "Flagged as potential duplicate — dismiss the flag or deny before approving.",
 },
 { status: 422 }
 );
 }

 if (settings.require_po_linkage) {
 const effectivePoId = (updates?.po_id ?? invoice.po_id) as string | null;
 if (!effectivePoId) {
 const { data: lineCheck } = await supabase
 .from("invoice_line_items")
 .select("po_id")
 .eq("invoice_id", params.id)
 .is("deleted_at", null);
 const allLinesPO =
 (lineCheck?.length ?? 0) > 0 && lineCheck!.every((l) => !!l.po_id);
 if (!allLinesPO) {
 return NextResponse.json(
 { error: "Each line must be linked to a purchase order before approval" },
 { status: 422 }
 );
 }
 }
 }

 if (settings.require_budget_allocation) {
 const { data: lineCheck } = await supabase
 .from("invoice_line_items")
 .select("budget_line_id")
 .eq("invoice_id", params.id)
 .is("deleted_at", null);
 const allAllocated =
 (lineCheck?.length ?? 0) > 0 && lineCheck!.every((l) => !!l.budget_line_id);
 if (!allAllocated) {
 return NextResponse.json(
 { error: "Every invoice line must be allocated to a budget line before approval" },
 { status: 422 }
 );
 }
 }
 }
 } catch (err) {
 // Don't block on workflow-settings read error — just log.
 console.warn(
 `[invoice action workflow] ${err instanceof Error ? err.message : err}`
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

 // Prefer the acting user's UUID in `who` so the UI can resolve to their
 // real name. Fallback to a role string keeps legacy behaviour if auth is
 // somehow missing.
 const { data: { user: actor } } = await supabase.auth.getUser();
 const roleLabel = ["qa_approve", "kick_back"].includes(action) ? "accounting" : "pm";
 const who = actor?.id ?? roleLabel;

 const existingHistory = Array.isArray(invoice.status_history) ? invoice.status_history : [];

 // Log the immediate action
 const statusEntries = [
 {
 who,
 when: new Date().toISOString(),
 old_status: invoice.status,
 new_status: newStatus,
 note: note ?? `${roleLabel} ${action.replace(/_/g, " ")}`,
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

 // Capture parser corrections before applying updates
 if (updates && Object.keys(updates).length > 0) {
 const { data: { user } } = await supabase.auth.getUser();
 if (user) {
 captureCorrections(supabase, params.id, updates, user.id).catch((err) => {
 console.warn("[corrections] capture failed:", err);
 });
 }
 }

 const { error: updateError } = await supabase
 .from("invoices")
 .update(updatePayload)
 .eq("id", params.id);

 if (updateError) {
 return NextResponse.json({ error: updateError.message }, { status: 500 });
 }

 // ─── Phase 7b: recalc downstream totals + activity log ─────────────
 // The DB triggers added in 00028 already keep these in sync, but we
 // call the TS recalcs explicitly so any caller reading a fresh copy of
 // the row sees the new totals in the same request cycle, and so this
 // is the documented source of truth for the status transition.
 try {
 // Fetch every line item on this invoice so we know which budget lines
 // and POs to recompute. Both old status → new status (and vice versa)
 // change the "counting" set, so we recalc unconditionally.
 const { data: lines } = await supabase
 .from("invoice_line_items")
 .select("budget_line_id, po_id")
 .eq("invoice_id", params.id)
 .is("deleted_at", null);
 await recalcLinesAndPOs(
 (lines ?? []).map((l) => l.budget_line_id),
 (lines ?? []).map((l) => l.po_id)
 );
 } catch (recalcErr) {
 console.warn(
 `[invoice action recalc] ${recalcErr instanceof Error ? recalcErr.message : recalcErr}`
 );
 }

 // Activity log — one row per user-visible status transition.
 await logStatusChange({
 org_id: invoiceOrgId,
 user_id: actor?.id ?? null,
 entity_type: "invoice",
 entity_id: params.id,
 from: invoice.status,
 to: finalStatus,
 reason: note,
 extra: { action },
 });

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
