"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDollars, formatStatus, formatDate, statusBadgeOutline } from "@/lib/utils/format";
import AppShell from "@/components/app-shell";
import InvoiceFilePreview from "@/components/invoice-file-preview";
import InvoiceAllocationsEditor from "@/components/invoice-allocations-editor";
import NwButton from "@/components/nw/Button";
import NwEyebrow from "@/components/nw/Eyebrow";
import { invoiceDisplayName } from "@/lib/invoices/display";
import { toast } from "@/lib/utils/toast";
import PaymentPanel from "@/components/invoices/PaymentPanel";
import PaymentTrackingPanel from "@/components/invoices/PaymentTrackingPanel";
import InvoiceHeader from "@/components/invoices/InvoiceHeader";
import InvoiceDetailsPanel from "@/components/invoices/InvoiceDetailsPanel";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentRole } from "@/hooks/use-current-role";
import { isInvoiceLocked, canEditLockedFields } from "@/lib/invoice-permissions";

interface Job { id: string; name: string; address: string | null; }
interface CostCode { id: string; code: string; description: string; category: string; is_change_order: boolean; }
interface BudgetInfo {
 original_estimate: number;
 revised_estimate: number;
 total_spent: number;
 remaining: number;
 is_allowance?: boolean;
}

interface InvoiceLineItem {
 id: string;
 line_index: number;
 description: string | null;
 qty: number | null;
 unit: string | null;
 rate: number | null;
 amount_cents: number;
 cost_code_id: string | null;
 po_id: string | null;
 budget_line_id: string | null;
 is_change_order: boolean;
 co_reference: string | null;
 ai_suggested_cost_code_id: string | null;
 ai_suggestion_confidence: number | null;
 cost_codes: { id: string; code: string; description: string; category: string; is_change_order: boolean } | null;
}

interface InvoiceData {
 id: string; job_id: string | null; vendor_id: string | null; cost_code_id: string | null; po_id: string | null;
 parent_invoice_id: string | null;
 partial_approval_note: string | null;
 invoice_number: string | null; invoice_date: string | null; vendor_name_raw: string | null;
 job_reference_raw: string | null; po_reference_raw: string | null; description: string | null;
 line_items: Array<{ description: string; qty: number | null; unit: string | null; rate: number | null; amount: number; }>;
 invoice_line_items: InvoiceLineItem[];
 total_amount: number;
 ai_parsed_total_amount: number | null;
 is_change_order: boolean;
 document_type: string | null;
 invoice_type: string | null; co_reference_raw: string | null;
 confidence_score: number;
 confidence_details: (Record<string, number> & { auto_fills?: Record<string, boolean> }) | null;
 ai_raw_response: { cost_code_suggestion?: { code: string; description: string; confidence: number; is_change_order: boolean }; flags?: string[] } | null;
 status: string; status_history: Array<Record<string, unknown>>;
 received_date: string | null; payment_date: string | null; original_file_type: string | null;
 check_number: string | null; picked_up: boolean; mailed_date: string | null;
 payment_status: string | null; payment_amount: number | null; payment_method: string | null;
 payment_reference: string | null; scheduled_payment_date: string | null;
 is_potential_duplicate: boolean | null;
 duplicate_of_id: string | null;
 duplicate_dismissed_at: string | null;
 duplicate_of: {
 id: string;
 vendor_name_raw: string | null;
 total_amount: number;
 invoice_date: string | null;
 invoice_number: string | null;
 job_name: string | null;
 } | null;
 pm_overrides: Record<string, { old: unknown; new: unknown }> | null;
 qa_overrides: Record<string, { old: unknown; new: unknown }> | null;
 signed_file_url: string | null;
 assigned_pm: { id: string; full_name: string; role: string } | null;
 jobs: Job | null; vendors: { id: string; name: string; phone: string | null; email: string | null; address: string | null } | null; cost_codes: CostCode | null;
 pm_users?: { id: string; full_name: string }[];
 // Linked draw — set when invoice has been pulled into a monthly pay app.
 // Fetched separately in the page since /api/invoices/[id] uses select("*")
 // and does not join the draws table.
 draw_id: string | null;
}

// PM-edited shape for a line item — mirrors InvoiceLineItem but keeps
// unsaved edits in client state until the PM approves.
interface EditableLineItem {
 id: string | null; // null = client-only new row (shouldn't happen today but future-proof)
 line_index: number;
 description: string;
 qty: number | null;
 unit: string | null;
 rate: number | null;
 amount_cents: number;
 cost_code_id: string | null;
 po_id: string | null;
 is_change_order: boolean;
 co_reference: string;
 ai_suggested_cost_code_id: string | null;
 ai_suggestion_confidence: number | null;
}

// ── Main Page ───────────────────────────────────────────
export default function InvoiceReviewPage() {
 const params = useParams();
 const router = useRouter();
 const invoiceId = params.id as string;

 // Current user's org role (null while loading). Drives lock + edit
 // gating via canEditInvoice(). A loading (null) role is treated as
 // non-privileged — see use-current-role.ts for the fail-closed
 // contract.
 const role = useCurrentRole();

 const [invoice, setInvoice] = useState<InvoiceData | null>(null);
 const [loading, setLoading] = useState(true);
 const [loadError, setLoadError] = useState<string | null>(null);
 const [saving, setSaving] = useState(false);

 const [jobId, setJobId] = useState("");
 const [costCodeId, setCostCodeId] = useState("");
 const [poId, setPoId] = useState("");
 const [invoiceNumber, setInvoiceNumber] = useState("");
 const [invoiceDate, setInvoiceDate] = useState("");
 const [totalAmount, setTotalAmount] = useState("");
 const [invoiceType, setInvoiceType] = useState("");
 const [description, setDescription] = useState("");
 const [isChangeOrder, setIsChangeOrder] = useState(false);
 const [coReference, setCoReference] = useState("");

 const [jobs, setJobs] = useState<Job[]>([]);
 const [costCodes, setCostCodes] = useState<CostCode[]>([]);
 const [lineItems, setLineItems] = useState<EditableLineItem[]>([]);
 const [budgetByCostCode, setBudgetByCostCode] = useState<Map<string, BudgetInfo>>(new Map());
 const [actionNote, setActionNote] = useState("");
 const [showNoteModal, setShowNoteModal] = useState<"hold" | "deny" | null>(null);
 const [showApproveConfirm, setShowApproveConfirm] = useState(false);
 const [showAmountGuard, setShowAmountGuard] = useState(false);
 const [amountGuardNote, setAmountGuardNote] = useState("");
 const [showMissingCoBlock, setShowMissingCoBlock] = useState(false);
 const [showMissingFieldsBlock, setShowMissingFieldsBlock] = useState(false);
 const [showOverBudgetModal, setShowOverBudgetModal] = useState(false);
 const [overBudgetNote, setOverBudgetNote] = useState("");
 const [pmUsers, setPmUsers] = useState<{ id: string; full_name: string }[]>([]);
 const [reassigning, setReassigning] = useState(false);
 const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
 const [infoRecipient, setInfoRecipient] = useState("");
 const [infoQuestion, setInfoQuestion] = useState("");
 const [showPartialModal, setShowPartialModal] = useState(false);
 const [partialApprovedIds, setPartialApprovedIds] = useState<Set<string>>(new Set());
 const [partialNote, setPartialNote] = useState("");
 const [partialSubmitting, setPartialSubmitting] = useState(false);
 // Phase 3b: QA-flow state. qbNotes is bundled into the qa_approve
 // action's note (not a persisted column). Kick-back modal lives here
 // because its note string is specific to kick-back semantics.
 const [qbNotes, setQbNotes] = useState("");
 const [showKickBackModal, setShowKickBackModal] = useState(false);
 const [kickBackNote, setKickBackNote] = useState("");
 const [savingVendorName, setSavingVendorName] = useState(false);
 const [partialError, setPartialError] = useState<string | null>(null);

 // Cross-link to the "other side" of a partial split
 const [siblingInvoice, setSiblingInvoice] = useState<{ id: string; status: string; total_amount: number } | null>(null);

 // Linked draw info (draw_number, status) — fetched separately because
 // /api/invoices/[id] returns invoices.* without a join to draws.
 const [drawInfo, setDrawInfo] = useState<{ id: string; draw_number: number; status: string } | null>(null);

 // Map of user_id → full_name for resolving status_history `who` UUIDs into
 // real names (so the sidebar shows "Bob Mozine" instead of "pm").
 const [userNames, setUserNames] = useState<Map<string, string>>(new Map());

 // Workflow settings (Phase 8e) — controls which gates are active.
 const [workflowSettings, setWorkflowSettings] = useState<{
 require_invoice_date: boolean;
 require_budget_allocation: boolean;
 require_po_linkage: boolean;
 duplicate_detection_enabled: boolean;
 over_budget_requires_note: boolean;
 } | null>(null);

 // Payment tracking
 const [checkNumber, setCheckNumber] = useState("");
 const [pickedUp, setPickedUp] = useState(false);
 const [mailedDate, setMailedDate] = useState("");
 const [savingPayment, setSavingPayment] = useState(false);

 // Fetch invoice
 async function fetchInvoice(signal?: AbortSignal) {
 setLoading(true);
 setLoadError(null);
 try {
 const res = await fetch(`/api/invoices/${invoiceId}`, { signal });
 if (!res.ok) {
 const body = await res.json().catch(() => ({}));
 throw new Error(body?.error ?? `Invoice failed to load (${res.status})`);
 }
 if (signal?.aborted) return;
 const data: InvoiceData = await res.json();
 setInvoice(data);
 // If this is a partial-approval split (either parent or child),
 // pull the sibling so we can show a cross-link banner.
 try {
 if (data.parent_invoice_id) {
 // This is a child (approved portion). Parent is the held remainder.
 const { data: sib } = await supabase
 .from("invoices")
 .select("id, status, total_amount")
 .eq("id", data.parent_invoice_id)
 .maybeSingle();
 if (sib) setSiblingInvoice(sib as { id: string; status: string; total_amount: number });
 } else if (data.partial_approval_note) {
 // This is a parent (held portion). Child has parent_invoice_id=this.id.
 const { data: sib } = await supabase
 .from("invoices")
 .select("id, status, total_amount")
 .eq("parent_invoice_id", data.id)
 .is("deleted_at", null)
 .order("created_at", { ascending: false })
 .limit(1)
 .maybeSingle();
 if (sib) setSiblingInvoice(sib as { id: string; status: string; total_amount: number });
 }
 } catch { /* sibling lookup is best-effort */ }
 setJobId(data.job_id ?? "");
 setCostCodeId(data.cost_code_id ?? "");
 setPoId(data.po_id ?? "");
 setInvoiceNumber(data.invoice_number ?? "");
 setInvoiceDate(data.invoice_date ?? "");
 setTotalAmount(String(data.total_amount / 100));
 setInvoiceType(data.invoice_type ?? "");
 setDescription(data.description ?? "");
 setCoReference(data.co_reference_raw ?? "");
 if (data.pm_users) setPmUsers(data.pm_users);
 setCheckNumber(data.check_number ?? "");
 setPickedUp(data.picked_up ?? false);
 setMailedDate(data.mailed_date ?? "");
 // CO toggle reflects the AI-detected is_change_order flag (set at upload).
 // Fall back to legacy heuristics for pre-migration invoices.
 setIsChangeOrder(
 data.is_change_order ||
 !!data.co_reference_raw ||
 (data.cost_codes?.code?.endsWith("C") ?? false)
 );
 // Hydrate editable line items from server
 if (Array.isArray(data.invoice_line_items)) {
 setLineItems(
 data.invoice_line_items.map((li) => ({
 id: li.id,
 line_index: li.line_index,
 description: li.description ?? "",
 qty: li.qty,
 unit: li.unit,
 rate: li.rate,
 amount_cents: li.amount_cents,
 cost_code_id: li.cost_code_id,
 po_id: li.po_id ?? null,
 is_change_order: li.is_change_order,
 co_reference: li.co_reference ?? "",
 ai_suggested_cost_code_id: li.ai_suggested_cost_code_id,
 ai_suggestion_confidence: li.ai_suggestion_confidence,
 }))
 );
 }
 } catch (err) {
 if ((err as Error)?.name === "AbortError") return;
 setLoadError(err instanceof Error ? err.message : "Couldn't load invoice");
 } finally {
 if (!signal?.aborted) setLoading(false);
 }
 }
 useEffect(() => {
 const controller = new AbortController();
 fetchInvoice(controller.signal);
 return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [invoiceId]);

 // Resolve any UUID `who` values in status_history to real names. Legacy
 // entries with "pm" / "accounting" / "system" remain untouched and render
 // via formatWho below.
 useEffect(() => {
 const history = invoice?.status_history;
 if (!history || history.length === 0) return;
 const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const ids = new Set<string>();
 for (const entry of history) {
 const who = String((entry as { who?: unknown }).who ?? "");
 if (uuidRe.test(who) && !userNames.has(who)) ids.add(who);
 }
 if (ids.size === 0) return;
 let cancelled = false;
 (async () => {
 const { data } = await supabase
 .from("profiles")
 .select("id, full_name")
 .in("id", Array.from(ids));
 if (cancelled || !data) return;
 setUserNames((prev) => {
 const next = new Map(prev);
 for (const row of data as Array<{ id: string; full_name: string | null }>) {
 if (row.full_name) next.set(row.id, row.full_name);
 }
 return next;
 });
 })();
 return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [invoice?.status_history]);

 const refreshInvoice = () => fetchInvoice();

 // Resolve the linked draw # whenever invoice.draw_id changes.
 useEffect(() => {
 const drawId = invoice?.draw_id;
 if (!drawId) {
 setDrawInfo(null);
 return;
 }
 let cancelled = false;
 (async () => {
 const { data } = await supabase
 .from("draws")
 .select("id, draw_number, status")
 .eq("id", drawId)
 .maybeSingle();
 if (!cancelled && data) setDrawInfo(data as { id: string; draw_number: number; status: string });
 })();
 return () => { cancelled = true; };
 }, [invoice?.draw_id]);

 // Fetch lookups (cost codes with category + is_change_order)
 useEffect(() => {
 let cancelled = false;
 async function fetchLookups() {
 const [jobsRes, codesRes] = await Promise.all([
 supabase.from("jobs").select("id, name, address").is("deleted_at", null).eq("status", "active").order("name"),
 supabase.from("cost_codes").select("id, code, description, category, is_change_order").is("deleted_at", null).order("sort_order"),
 ]);
 if (cancelled) return;
 if (jobsRes.data) setJobs(jobsRes.data);
 if (codesRes.data) setCostCodes(codesRes.data as CostCode[]);
 }
 fetchLookups();
 return () => { cancelled = true; };
 }, []);

 // Fetch workflow settings (Phase 8e) — drives badge color / approval gates.
 useEffect(() => {
 let cancelled = false;
 (async () => {
 try {
 const res = await fetch("/api/workflow-settings");
 if (!res.ok) return;
 const json = await res.json();
 if (cancelled || !json?.settings) return;
 setWorkflowSettings({
 require_invoice_date: json.settings.require_invoice_date,
 require_budget_allocation: json.settings.require_budget_allocation,
 require_po_linkage: json.settings.require_po_linkage,
 duplicate_detection_enabled: json.settings.duplicate_detection_enabled,
 over_budget_requires_note: json.settings.over_budget_requires_note,
 });
 } catch {
 /* fall back to defaults */
 }
 })();
 return () => {
 cancelled = true;
 };
 }, []);

 // When the PM picks a default Cost Code, pre-fill any line item that has
 // no cost_code_id yet (don't override PM's per-line picks).
 useEffect(() => {
 if (!costCodeId) return;
 setLineItems(prev => prev.map(l => (l.cost_code_id ? l : { ...l, cost_code_id: costCodeId })));
 }, [costCodeId]);

 // Per-cost-code budget lookup for the multi-cost-code sidebar.
 // Refetches when the set of cost codes used by the line items changes.
 const uniqueLineCostCodeIds = useMemo(
 () => Array.from(new Set(lineItems.map((l) => l.cost_code_id).filter(Boolean) as string[])),
 [lineItems]
 );
 useEffect(() => {
 let cancelled = false;
 async function fetchMultiBudget() {
 if (!jobId || uniqueLineCostCodeIds.length === 0) {
 setBudgetByCostCode(new Map());
 return;
 }
 // Parallel: budget lines + spent invoices (independent queries)
 const [{ data: blData }, { data: spentData }] = await Promise.all([
 supabase
 .from("budget_lines")
 .select("cost_code_id, original_estimate, revised_estimate, is_allowance")
 .eq("job_id", jobId)
 .in("cost_code_id", uniqueLineCostCodeIds)
 .is("deleted_at", null),
 supabase
 .from("invoices")
 .select("cost_code_id, total_amount")
 .eq("job_id", jobId)
 .in("cost_code_id", uniqueLineCostCodeIds)
 .in("status", ["pm_approved", "qa_review", "qa_approved", "pushed_to_qb", "in_draw", "paid"])
 .is("deleted_at", null),
 ]);
 if (cancelled) return;
 const spentByCode = new Map<string, number>();
 for (const row of spentData ?? []) {
 spentByCode.set(row.cost_code_id, (spentByCode.get(row.cost_code_id) ?? 0) + row.total_amount);
 }
 const next = new Map<string, BudgetInfo>();
 for (const bl of blData ?? []) {
 const spent = spentByCode.get(bl.cost_code_id) ?? 0;
 next.set(bl.cost_code_id, {
 original_estimate: bl.original_estimate,
 revised_estimate: bl.revised_estimate,
 total_spent: spent,
 remaining: bl.revised_estimate - spent,
 is_allowance: !!bl.is_allowance,
 });
 }
 setBudgetByCostCode(next);
 }
 fetchMultiBudget();
 return () => { cancelled = true; };
 }, [jobId, uniqueLineCostCodeIds]);

 const handleReassignPm = async (newPmId: string) => {
 setReassigning(true);
 const res = await fetch(`/api/invoices/${invoiceId}`, {
 method: "PATCH",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ assigned_pm_id: newPmId || null }),
 });
 if (res.ok && invoice) {
 const newPm = newPmId ? pmUsers.find(u => u.id === newPmId) : null;
 setInvoice({
 ...invoice,
 assigned_pm: newPm ? { id: newPm.id, full_name: newPm.full_name, role: "" } : null,
 });
 }
 setReassigning(false);
 };

 const buildOverrides = useCallback(() => {
 if (!invoice) return {};
 const o: Record<string, { old: unknown; new: unknown }> = {};
 if (invoiceNumber !== (invoice.invoice_number ?? "")) o.invoice_number = { old: invoice.invoice_number, new: invoiceNumber };
 if (invoiceDate !== (invoice.invoice_date ?? "")) o.invoice_date = { old: invoice.invoice_date, new: invoiceDate };
 if (totalAmount !== String(invoice.total_amount / 100)) o.total_amount = { old: invoice.total_amount, new: Math.round(parseFloat(totalAmount) * 100) };
 if (invoiceType !== (invoice.invoice_type ?? "")) o.invoice_type = { old: invoice.invoice_type, new: invoiceType };
 if (description !== (invoice.description ?? "")) o.description = { old: invoice.description, new: description };
 if (jobId !== (invoice.job_id ?? "")) o.job_id = { old: invoice.job_id, new: jobId };
 if (costCodeId !== (invoice.cost_code_id ?? "")) o.cost_code_id = { old: invoice.cost_code_id, new: costCodeId };
 return o;
 }, [invoice, invoiceNumber, invoiceDate, totalAmount, invoiceType, description, jobId, costCodeId]);

 // "Convert to Change Order" — navigate to a draft CO pre-filled with the
 // invoice's job, overage amount, and a descriptive title. The PM reviews
 // line allocations on the CO form and submits for owner approval.
 const handleConvertToChangeOrder = () => {
 if (!invoice || !jobId) return;
 const amountDollars = (totalCents / 100).toFixed(2);
 const vendor = invoice.vendor_name_raw ?? invoice.vendors?.name ?? "vendor";
 const desc = `Overage from ${vendor}${invoice.invoice_number ? ` inv ${invoice.invoice_number}` : ""}`;
 const params = new URLSearchParams({
 source_invoice_id: invoice.id,
 amount: amountDollars,
 description: desc,
 });
 setShowOverBudgetModal(false);
 setOverBudgetNote("");
 router.push(`/jobs/${jobId}/change-orders/new?${params.toString()}`);
 };

 const handleAction = async (action: "approve" | "hold" | "deny" | "request_info" | "info_received", note?: string) => {
 setSaving(true);
 const overrides = buildOverrides();
 const updates: Record<string, unknown> = {};
 if (jobId) updates.job_id = jobId;
 if (costCodeId) updates.cost_code_id = costCodeId;
 if (poId) updates.po_id = poId;
 if (invoiceNumber !== (invoice?.invoice_number ?? "")) updates.invoice_number = invoiceNumber;
 if (invoiceDate !== (invoice?.invoice_date ?? "")) updates.invoice_date = invoiceDate;
 if (totalAmount !== String((invoice?.total_amount ?? 0) / 100)) updates.total_amount = Math.round(parseFloat(totalAmount) * 100);
 if (invoiceType !== (invoice?.invoice_type ?? "")) updates.invoice_type = invoiceType;
 if (description !== (invoice?.description ?? "")) updates.description = description;
 if (coReference !== (invoice?.co_reference_raw ?? "")) updates.co_reference_raw = coReference;
 if (isChangeOrder !== (invoice?.is_change_order ?? false)) updates.is_change_order = isChangeOrder;

 // Save line items first so the invoice action sees the latest cost-code
 // assignments. Only persist for approve/hold/deny/info flows — reading-only
 // paths (e.g. reassign PM) skip this entirely.
 if (lineItems.length > 0) {
 const liRes = await fetch(`/api/invoices/${invoiceId}/line-items`, {
 method: "PUT", headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 line_items: lineItems.map((li) => ({
 id: li.id,
 line_index: li.line_index,
 description: li.description,
 qty: li.qty,
 unit: li.unit,
 rate: li.rate,
 amount_cents: li.amount_cents,
 cost_code_id: li.cost_code_id,
 po_id: li.po_id ?? null,
 is_change_order: li.is_change_order,
 co_reference: li.co_reference.trim() || null,
 })),
 }),
 });
 if (!liRes.ok) {
 const body = await liRes.json().catch(() => ({}));
 toast.error(
 body?.error ?? "Couldn't save line items — action not applied. Please retry."
 );
 setSaving(false);
 return;
 }
 }

 const submitAction = async (acknowledgedOverBudget = false): Promise<Response> => {
 const url = acknowledgedOverBudget
 ? `/api/invoices/${invoiceId}/action?acknowledged_over_budget=true`
 : `/api/invoices/${invoiceId}/action`;
 return fetch(url, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 action,
 note,
 pm_overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
 updates: Object.keys(updates).length > 0 ? updates : undefined,
 }),
 });
 };

 let res = await submitAction(false);

 // WI-L-4: over-budget gate — 422 asks PM to acknowledge before proceeding.
 if (res.status === 422) {
 const data = await res.clone().json().catch(() => ({}));
 if (data?.error === "over_budget" && Array.isArray(data.details)) {
 type Overage = {
 cost_code: string | null;
 description: string | null;
 revised_estimate: number;
 currently_invoiced: number;
 this_invoice_allocation: number;
 overage: number;
 };
 const details = data.details as Overage[];
 const totalOverage = details.reduce((s, o) => s + o.overage, 0);
 const lines = details
 .map(
 (o) =>
 ` • ${o.cost_code ?? "(no code)"} ${o.description ? "— " + o.description : ""}: over by $${(o.overage / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
 )
 .join("\n");
 const ok = window.confirm(
 `Over budget\n\n` +
 `Approving this invoice would push ${details.length} budget line(s) over by $${(totalOverage / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}:\n\n${lines}\n\nApprove anyway?`
 );
 if (!ok) {
 setSaving(false);
 return;
 }
 res = await submitAction(true);
 }
 }

 setSaving(false);
 if (res.ok) {
 const ACTION_LABEL: Record<string, string> = {
 approve: "Invoice approved",
 hold: "Invoice held",
 deny: "Invoice denied",
 request_info: "Info request sent",
 info_received: "Returned to PM review",
 };
 toast.success(ACTION_LABEL[action] ?? "Action saved");
 router.push("/invoices/queue");
 } else {
 const data = await res.json().catch(() => ({}));
 toast.error(data.error ?? "Action failed");
 }
 };

 if (loading) return (
 <div className="min-h-screen flex items-center justify-center">
 <div className="w-8 h-8 border-2 border-[rgba(91,134,153,0.3)] border-t-[var(--nw-stone-blue)] animate-spin" />
 </div>
 );

 if (loadError || !invoice) return (
 <AppShell>
 <main className="max-w-[640px] mx-auto px-4 md:px-6 py-16">
 <div
 className="border p-6"
 style={{
 background: "var(--bg-card)",
 borderColor: "var(--nw-danger)",
 color: "var(--text-primary)",
 }}
 >
 <NwEyebrow tone="danger" className="mb-2">Couldn&apos;t load</NwEyebrow>
 <p className="text-sm">{loadError ?? "Invoice not found"}</p>
 <div className="mt-4 flex gap-2">
 <NwButton variant="secondary" size="sm" onClick={() => { void fetchInvoice(); }}>Retry</NwButton>
 <NwButton variant="ghost" size="sm" onClick={() => router.push("/invoices")}>Back to Invoices</NwButton>
 </div>
 </div>
 </main>
 </AppShell>
 );

 const isReviewable = ["pm_review", "ai_processed", "pm_held", "info_requested"].includes(invoice.status);
 // Phase 3b: QA-action visibility. Matches the original QA detail
 // page's `isQaReviewable` gate — accounting actions apply only when
 // the PM has already approved and the invoice is awaiting QA.
 const isQaReviewable = ["qa_review", "pm_approved"].includes(invoice.status);
 // Phase 3a: canEdit drives the allocations editor's readOnly gate.
 // - Non-locked statuses are editable by anyone with endpoint
 //   permission — role value doesn't matter.
 // - Locked statuses (pm_approved, qa_review, qa_approved, in_draw,
 //   paid) require a privileged role. While role is still loading
 //   (null), we fail closed so a locked invoice stays readOnly until
 //   confirmed.
 const locked = isInvoiceLocked(invoice.status);
 const canEdit = !locked || (role !== null && canEditLockedFields(role));
 const showPaymentTracking = ["qa_approved", "pushed_to_qb", "in_draw", "paid"].includes(invoice.status);

 // Summary: how many unique cost codes the line items span
 const uniqueLineCodeIds = Array.from(new Set(lineItems.map(l => l.cost_code_id).filter(Boolean) as string[]));
 const totalCents = Math.round((parseFloat(totalAmount) || 0) * 100);

 // Amount guard: PM edited total above original AI-parsed amount
 const aiParsedTotal = invoice.ai_parsed_total_amount ?? invoice.total_amount;
 const amountIncreasePct = aiParsedTotal > 0
 ? ((totalCents - aiParsedTotal) / aiParsedTotal) * 100
 : 0;
 const amountOver10Pct = amountIncreasePct > 10;

 // Credit memo (negative total)
 const isCreditMemo = invoice.total_amount < 0 || totalCents < 0;

 // CO reference required: any line flagged as CO must have a co_reference
 const lineItemsMissingCoReference = lineItems.filter(l => l.is_change_order && !l.co_reference.trim());
 const missingCoReference = lineItemsMissingCoReference.length > 0;

 // Over-budget severity classifier. Returns the worst-case severity across
 // every cost code this invoice touches. Drives the graduated warnings in
 // the sidebar and gates the approve flow.
 type OverBudgetSeverity = "none" | "yellow" | "orange" | "red";
 const classifyOverBudget = (
 revised: number,
 alreadySpent: number,
 thisInvoicePortion: number,
 isAllowance: boolean
 ): { severity: OverBudgetSeverity; overageCents: number; pct: number } => {
 if (revised === 0) {
 return {
 severity: thisInvoicePortion > 0 ? "red" : "none",
 overageCents: thisInvoicePortion,
 pct: 100,
 };
 }
 const projectedTotal = alreadySpent + thisInvoicePortion;
 if (projectedTotal <= revised) return { severity: "none", overageCents: 0, pct: 0 };
 const overageCents = projectedTotal - revised;
 const pct = (overageCents / revised) * 100;
 // Allowances are expected to run over — bump them straight to red so the
 // "Convert to Change Order" path is suggested.
 if (isAllowance) return { severity: "red", overageCents, pct };
 if (pct > 25) return { severity: "red", overageCents, pct };
 if (pct > 10) return { severity: "orange", overageCents, pct };
 return { severity: "yellow", overageCents, pct };
 };

 // Compute per-line-code budget status for the sidebar + gating.
 const overBudgetByCode = uniqueLineCodeIds.map(ccId => {
 const bi = budgetByCostCode.get(ccId);
 const thisInvoicePortion = lineItems.filter(l => l.cost_code_id === ccId).reduce((s, l) => s + l.amount_cents, 0);
 const classification = bi
 ? classifyOverBudget(bi.revised_estimate, bi.total_spent, thisInvoicePortion, !!bi.is_allowance)
 : classifyOverBudget(0, 0, thisInvoicePortion, false);
 return { ccId, bi, thisInvoicePortion, ...classification };
 });
 const worstSeverity: OverBudgetSeverity = overBudgetByCode.reduce<OverBudgetSeverity>((worst, s) => {
 const rank = { none: 0, yellow: 1, orange: 2, red: 3 } as const;
 return rank[s.severity] > rank[worst] ? s.severity : worst;
 }, "none");
 const hasAllowanceOverage = overBudgetByCode.some(s => s.severity !== "none" && s.bi?.is_allowance);

 // Approve-flow gatekeeper. Order matters: job/cost-code → CO refs →
 // over-budget severity → amount guard → confirmation modal.
 const openApproveFlow = () => {
 if (!jobId || !costCodeId) { setShowMissingFieldsBlock(true); return; }
 if (missingCoReference) { setShowMissingCoBlock(true); return; }
 // Phase 8e: org-configured invoice-date gate.
 if (workflowSettings?.require_invoice_date && !invoiceDate.trim()) {
 toast.error("Invoice date is required before approval. Enter a date or toggle the workflow setting off.");
 return;
 }
 // Phase 8e: duplicate flag blocks approval until dismissed.
 if (
 invoice?.is_potential_duplicate &&
 !invoice?.duplicate_dismissed_at &&
 workflowSettings?.duplicate_detection_enabled !== false
 ) {
 toast.warning("This invoice is flagged as a potential duplicate. Dismiss the flag (Not a duplicate) or deny the invoice before approving.");
 return;
 }
 // Orange (10-25%) requires a note via the over-budget modal.
 // Red (>25% or no budget) requires the PM to choose: approve as overage OR convert to CO.
 if ((worstSeverity === "orange" || worstSeverity === "red") && !overBudgetNote.trim()) {
 setShowOverBudgetModal(true);
 return;
 }
 if (amountOver10Pct) { setShowAmountGuard(true); return; }
 setShowApproveConfirm(true);
 };

 // Resolve labels for approve confirmation
 const selectedJob = jobs.find(j => j.id === jobId);
 const selectedCostCode = costCodes.find(c => c.id === costCodeId);

 // Missing field flags
 const missingInvoiceNumber = !invoiceNumber.trim();
 const missingInvoiceDate = !invoiceDate.trim();

 // Phase 8e QA Fix C — compute approve button disabled state + tooltip.
 // When require_invoice_date is ON and date is missing, the button must be
 // visibly disabled (not just alert-on-click). Same for the duplicate flag.
 const dateBlocked =
 !!workflowSettings?.require_invoice_date && missingInvoiceDate;
 const duplicateBlocked =
 !!(invoice?.is_potential_duplicate &&
 !invoice?.duplicate_dismissed_at &&
 workflowSettings?.duplicate_detection_enabled !== false);
 const approveDisabledReason = dateBlocked
 ? "Invoice date is required before approval"
 : duplicateBlocked
 ? "Flagged as potential duplicate — dismiss or deny"
 : null;

 // Detect if this invoice was kicked back by QA
 const kickBackInfo = (() => {
 if (!invoice.status_history || invoice.status !== "pm_review") return null;
 const entry = [...invoice.status_history].reverse().find(
 e => String(e.new_status) === "qa_kicked_back" || (String(e.old_status) === "qa_kicked_back" && String(e.new_status) === "pm_review")
 );
 return entry ? String(entry.note ?? "") : null;
 })();

 // Detect hold reason
 const holdInfo = (() => {
 if (!invoice.status_history || invoice.status !== "pm_held") return null;
 const entry = [...invoice.status_history].reverse().find(
 e => String(e.new_status) === "pm_held"
 );
 return entry ? String(entry.note ?? "") : null;
 })();

 // Detect deny reason
 const denyInfo = (() => {
 if (!invoice.status_history || invoice.status !== "pm_denied") return null;
 const entry = [...invoice.status_history].reverse().find(
 e => String(e.new_status) === "pm_denied"
 );
 return entry ? String(entry.note ?? "") : null;
 })();

 // Detect info requested reason
 const infoRequestedInfo = (() => {
 if (!invoice.status_history || invoice.status !== "info_requested") return null;
 const entry = [...invoice.status_history].reverse().find(
 e => String(e.new_status) === "info_requested"
 );
 return entry ? String(entry.note ?? "") : null;
 })();

 const handleReopen = async () => {
 setSaving(true);
 const res = await fetch(`/api/invoices/${invoiceId}/action`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ action: "reopen", note: "Reopened for review" }),
 });
 setSaving(false);
 if (res.ok) router.refresh();
 };

 // Phase 3b: QA Approve — ported verbatim from src/app/invoices/[id]/qa/
 // page.tsx (handleQaApprove). Bundles QB notes into the action's `note`
 // field (qb_notes is not a DB column). On success, route back to the
 // QA queue so accounting can clear the next item.
 const handleQaApprove = async () => {
 setSaving(true);
 const res = await fetch(`/api/invoices/${invoiceId}/action`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 action: "qa_approve",
 note: qbNotes.trim()
 ? `QA approved. QB notes: ${qbNotes.trim()}`
 : "QA approved",
 }),
 });
 setSaving(false);
 if (res.ok) {
 router.push("/invoices/qa");
 } else {
 const data = await res.json().catch(() => ({}));
 toast.error(data.error ?? "Failed to QA approve");
 }
 };

 // Phase 3b: Kick Back — ported verbatim. Requires a note (enforced by
 // the action route). Route back to QA queue on success.
 const handleKickBack = async () => {
 if (!kickBackNote.trim()) return;
 setSaving(true);
 const res = await fetch(`/api/invoices/${invoiceId}/action`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 action: "kick_back",
 note: kickBackNote.trim(),
 }),
 });
 setSaving(false);
 if (res.ok) {
 router.push("/invoices/qa");
 } else {
 const data = await res.json().catch(() => ({}));
 toast.error(data.error ?? "Failed to kick back");
 }
 };

 // Phase 3b: Vendor name save via hardened PATCH (audit log handled
 // server-side when privileged role edits a locked invoice). Called
 // from InvoiceDetailsPanel on blur when the value changed.
 const handleVendorNameSave = async (newVendorName: string) => {
 if (!invoice) return;
 if (newVendorName === (invoice.vendor_name_raw ?? "")) return;
 setSavingVendorName(true);
 const res = await fetch(`/api/invoices/${invoiceId}`, {
 method: "PATCH",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ vendor_name_raw: newVendorName }),
 });
 if (res.ok) {
 setInvoice({ ...invoice, vendor_name_raw: newVendorName });
 toast.success("Vendor name saved");
 } else {
 const data = await res.json().catch(() => ({}));
 toast.error(data.error ?? "Failed to save vendor name");
 }
 setSavingVendorName(false);
 };

 const handleSavePaymentTracking = async () => {
 setSavingPayment(true);
 const updates: Record<string, unknown> = {
 check_number: checkNumber.trim() || null,
 picked_up: pickedUp,
 mailed_date: !pickedUp && mailedDate ? mailedDate : null,
 };
 const res = await fetch(`/api/invoices/${invoiceId}`, {
 method: "PATCH",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(updates),
 });
 if (res.ok && invoice) {
 setInvoice({ ...invoice, check_number: updates.check_number as string | null, picked_up: updates.picked_up as boolean, mailed_date: updates.mailed_date as string | null });
 toast.success("Payment tracking saved");
 } else if (!res.ok) {
 const data = await res.json().catch(() => ({}));
 toast.error(data.error ?? "Failed to save payment tracking");
 }
 setSavingPayment(false);
 };

 return (
 <AppShell>

 {/* Sub-header */}
 <InvoiceHeader
   vendorNameRaw={invoice.vendor_name_raw}
   vendorId={invoice.vendor_id}
   vendor={invoice.vendors}
   invoiceNumber={invoice.invoice_number}
   confidenceScore={invoice.confidence_score}
   status={invoice.status}
   isCreditMemo={isCreditMemo}
   isChangeOrder={isChangeOrder}
   assignedPmId={invoice.assigned_pm?.id}
   pmUsers={pmUsers}
   reassigning={reassigning}
   onReassignPm={handleReassignPm}
 />

 {/* Kick-back banner from QA */}
 {kickBackInfo && (
 <div className="bg-[rgba(176,85,78,0.12)] border-b border-[rgba(176,85,78,0.24)] px-6 py-3">
 <div className="max-w-[1600px] mx-auto flex items-start gap-3">
 <svg className="w-5 h-5 text-[color:var(--nw-danger)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
 </svg>
 <div>
 <p className="text-sm font-medium text-[color:var(--nw-danger)]">Kicked Back by Accounting</p>
 <p className="text-sm text-[color:var(--nw-danger)]/80 mt-0.5">{kickBackInfo}</p>
 </div>
 </div>
 </div>
 )}

 {/* Hold banner */}
 {holdInfo !== null && (
 <div className="bg-[rgba(201,138,59,0.12)] border-b border-[rgba(201,138,59,0.25)] px-6 py-3">
 <div className="max-w-[1600px] mx-auto flex items-start gap-3">
 <svg className="w-5 h-5 text-nw-warn flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
 </svg>
 <div>
 <p className="text-sm font-medium text-nw-warn">This invoice is on hold</p>
 {holdInfo && <p className="text-sm text-nw-warn/90 mt-0.5">{holdInfo}</p>}
 </div>
 </div>
 </div>
 )}

 {/* Deny banner with reopen */}
 {denyInfo !== null && (
 <div className="bg-[rgba(176,85,78,0.12)] border-b border-[rgba(176,85,78,0.24)] px-6 py-3">
 <div className="max-w-[1600px] mx-auto flex items-start gap-3">
 <svg className="w-5 h-5 text-[color:var(--nw-danger)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
 </svg>
 <div className="flex-1">
 <p className="text-sm font-medium text-[color:var(--nw-danger)]">This invoice was denied</p>
 {denyInfo && <p className="text-sm text-[color:var(--nw-danger)]/80 mt-0.5">{denyInfo}</p>}
 <div className="mt-2">
 <NwButton variant="secondary" size="sm" onClick={handleReopen} disabled={saving} loading={saving}>
 Reopen for Review
 </NwButton>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Info Requested banner */}
 {infoRequestedInfo !== null && (
 <div className="bg-[rgba(201,138,59,0.12)] border-b border-[rgba(201,138,59,0.25)] px-6 py-3">
 <div className="max-w-[1600px] mx-auto flex items-start gap-3">
 <svg className="w-5 h-5 text-nw-warn flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
 </svg>
 <div className="flex-1">
 <p className="text-sm font-medium text-nw-warn">Info Requested</p>
 <p className="text-sm text-nw-warn/90 mt-0.5">{infoRequestedInfo}</p>
 <div className="mt-2">
 <NwButton
 variant="secondary"
 size="sm"
 onClick={() => handleAction("info_received", "Info received — returning to PM review")}
 disabled={saving}
 loading={saving}
 >
 Info Received — Resume Review
 </NwButton>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Math mismatch banner */}
 {invoice.ai_raw_response?.flags?.includes("math_mismatch") && (
 <div className="bg-[rgba(176,85,78,0.12)] border-b border-[rgba(176,85,78,0.24)] px-6 py-3">
 <div className="max-w-[1600px] mx-auto flex items-start gap-3">
 <svg className="w-5 h-5 text-[color:var(--nw-danger)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
 </svg>
 <div>
 <p className="text-sm font-medium text-[color:var(--nw-danger)]">Math Mismatch Detected</p>
 <p className="text-sm text-[color:var(--nw-danger)]/80 mt-0.5">Line items may not sum to the stated total. Verify amounts before approving.</p>
 </div>
 </div>
 </div>
 )}

 <main className="print-area max-w-[1600px] mx-auto px-4 md:px-6 py-6 pb-32 md:pb-6">
 {/* Print-only header */}
 <div className="hidden print:block mb-4">
 <h1 className="text-xl font-semibold">
 {invoice.vendor_name_raw ?? "Invoice"}
 {invoice.invoice_number ? ` — #${invoice.invoice_number}` : ""}
 </h1>
 <p className="text-sm">
 Amount: {formatCents(invoice.total_amount)} ·
 Date: {invoice.invoice_date ? formatDate(invoice.invoice_date) : "—"} ·
 Status: {formatStatus(invoice.status)}
 </p>
 </div>
 {/* Receipt document type badge */}
 {invoice.document_type === "receipt" && (
 <div className="mb-4 border border-[rgba(59,88,100,0.21)] bg-[rgba(59,88,100,0.04)] px-4 py-2.5 text-sm text-[color:var(--text-secondary)] animate-fade-up inline-flex items-center gap-2">
 <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider border border-[rgba(59,88,100,0.28)] text-[color:var(--text-secondary)] font-medium">Receipt</span>
 <span>This is a receipt — vendor and invoice number are optional.</span>
 </div>
 )}
 {/* Partial approval banner — shown on both halves of a split */}
 {(invoice.parent_invoice_id || invoice.partial_approval_note) && (
 <div className="mb-4 border border-[rgba(201,138,59,0.5)] bg-[rgba(201,138,59,0.08)] px-4 py-3 text-sm text-[color:var(--text-primary)] animate-fade-up">
 <div className="flex items-start gap-3">
 <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider border border-[var(--nw-warn)] text-[color:var(--nw-warn)]">
 Partial
 </span>
 <div className="flex-1">
 {invoice.parent_invoice_id ? (
 <p>
 <span className="font-medium text-[color:var(--text-primary)]">Approved portion</span> of a split invoice.{" "}
 {siblingInvoice && (
 <Link href={`/invoices/${siblingInvoice.id}`} className="text-[color:var(--nw-stone-blue)] hover:underline">
 See held portion ({formatCents(siblingInvoice.total_amount)} · {formatStatus(siblingInvoice.status)}) →
 </Link>
 )}
 </p>
 ) : (
 <>
 <p>
 <span className="font-medium text-[color:var(--text-primary)]">Held portion</span> — {siblingInvoice && (
 <>{formatCents(siblingInvoice.total_amount)} approved,{" "}</>
 )}
 {formatCents(invoice.total_amount)} held.
 </p>
 {invoice.partial_approval_note && (
 <p className="mt-1 text-[color:var(--text-secondary)]">
 <span className="uppercase tracking-wider text-[10px] mr-2">Reason:</span>
 {invoice.partial_approval_note}
 </p>
 )}
 {siblingInvoice && (
 <Link href={`/invoices/${siblingInvoice.id}`} className="inline-block mt-1 text-[color:var(--nw-stone-blue)] hover:underline">
 See approved portion →
 </Link>
 )}
 </>
 )}
 </div>
 </div>
 </div>
 )}
 {/* Duplicate warning banner (Phase 8e) */}
 {invoice.is_potential_duplicate && invoice.duplicate_of && (
 <div className="mb-4 border border-[rgba(201,138,59,0.55)] bg-[rgba(201,138,59,0.12)] px-4 py-3 text-sm animate-fade-up">
 <div className="flex items-start gap-3">
 <svg className="w-5 h-5 text-[color:var(--nw-warn)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
 </svg>
 <div className="flex-1 min-w-0">
 <p className="text-[color:var(--nw-warn)] font-medium">Possible duplicate detected</p>
 <p className="text-[color:var(--text-muted)] mt-1">
 Matches {invoice.duplicate_of.vendor_name_raw ?? "existing invoice"}{" "}
 {formatCents(invoice.duplicate_of.total_amount)}
 {invoice.duplicate_of.invoice_date ? ` on ${formatDate(invoice.duplicate_of.invoice_date)}` : ""}
 {invoice.duplicate_of.job_name ? ` (${invoice.duplicate_of.job_name})` : ""}
 {invoice.duplicate_of.invoice_number ? ` — Invoice #${invoice.duplicate_of.invoice_number}` : ""}
 .{" "}
 <Link href={`/invoices/${invoice.duplicate_of.id}`} className="text-[color:var(--nw-stone-blue)] hover:underline font-medium">
 View existing &rarr;
 </Link>
 </p>
 </div>
 <button
 type="button"
 onClick={async () => {
 const res = await fetch(`/api/invoices/${invoice.id}/dismiss-duplicate`, { method: "POST" });
 if (res.ok) refreshInvoice();
 }}
 className="px-3 py-1.5 text-xs font-medium text-[color:var(--text-secondary)] border border-[var(--border-default)] hover:text-[color:var(--text-primary)] hover:border-[var(--border-strong)] transition-colors whitespace-nowrap"
 >
 Not a duplicate
 </button>
 </div>
 </div>
 )}
 {/* ═══ Unified two-column invoice detail — Phase 2 final rewrite.
        Matches Nightwork Design System reference (Nightwork Invoice
        Detail - Standalone.html). Two-column hero (PDF left / metadata
        + AI + timeline right), full-width line items editor, workflow
        actions row, payment row, cost-intelligence link-out. ═══ */}
 {(() => {
   const isQaApproved = invoice.status === "qa_approved";
   const vendorName = invoice.vendor_name_raw ?? invoice.vendors?.name ?? "Unknown vendor";
   const projectName = invoice.jobs?.name ?? "—";
   const receivedAtLabel = invoice.received_date ? formatDate(invoice.received_date) : null;
   const invoiceDateLabel = invoice.invoice_date ? formatDate(invoice.invoice_date) : null;
   const drawLabel = drawInfo
     ? `Draw #${drawInfo.draw_number}${drawInfo.status === "submitted" || drawInfo.status === "paid" ? "" : ` (${drawInfo.status})`}`
     : null;
   const aiModelUsed = (invoice as { ai_model_used?: string }).ai_model_used ?? null;
   const flags = (invoice.ai_raw_response?.flags as string[] | undefined) ?? [];

   const isReceipt = invoice.document_type === "receipt";
   const titleMain = isReceipt
     ? `Receipt ${invoice.invoice_number ?? ""}`.trim()
     : `Invoice #${invoice.invoice_number ?? "—"}`;
   const breadcrumbTrail = `#${invoice.invoice_number ?? "—"} · ${vendorName}`;
   const subLineParts: string[] = [];
   if (vendorName) subLineParts.push(vendorName);
   if (projectName && projectName !== "—") subLineParts.push(projectName);
   if (drawLabel) subLineParts.push(`Assigned to ${drawLabel}`);

   return (
     <div className="max-w-[1280px] mx-auto animate-fade-up">
       {/* ── HEADER BLOCK ── */}
       <div className="mb-6">
         <div
           className="mb-[14px]"
           style={{
             fontFamily: "var(--font-mono)",
             fontSize: "10px",
             letterSpacing: "0.12em",
             textTransform: "uppercase",
             color: "var(--text-muted)",
           }}
         >
           Home / Financial / Invoices /{" "}
           <b style={{ color: "var(--text-primary)", fontWeight: 500 }}>
             {breadcrumbTrail}
           </b>
         </div>
         <div className="flex items-end justify-between gap-5 flex-wrap">
           <div className="min-w-0">
             <h1
               className="flex items-center gap-3 flex-wrap"
               style={{
                 fontFamily: "var(--font-display)",
                 fontWeight: 500,
                 fontSize: "30px",
                 letterSpacing: "-0.02em",
                 margin: "0 0 4px",
                 color: "var(--text-primary)",
                 lineHeight: 1.15,
               }}
             >
               <span>{titleMain}</span>
               <span
                 className={`inline-flex items-center px-[9px] py-[3px] ${statusBadgeOutline(invoice.status)}`}
                 style={{
                   fontFamily: "var(--font-mono)",
                   fontSize: "10px",
                   letterSpacing: "0.12em",
                   textTransform: "uppercase",
                   fontWeight: 500,
                 }}
               >
                 {formatStatus(invoice.status)}
               </span>
               {isReceipt ? (
                 <span
                   className="inline-flex items-center px-[9px] py-[3px] border"
                   style={{
                     fontFamily: "var(--font-mono)",
                     fontSize: "10px",
                     letterSpacing: "0.12em",
                     textTransform: "uppercase",
                     fontWeight: 500,
                     borderColor: "var(--border-strong)",
                     color: "var(--text-secondary)",
                   }}
                 >
                   Receipt
                 </span>
               ) : null}
             </h1>
             <p
               style={{
                 fontSize: "13px",
                 color: "var(--text-tertiary)",
                 margin: 0,
               }}
             >
               {subLineParts.join(" · ")}
             </p>
           </div>
           <div className="hidden md:flex gap-[8px] flex-wrap items-center justify-end">
             {isReviewable ? (
               <>
                 <NwButton
                   variant="primary"
                   size="sm"
                   onClick={openApproveFlow}
                   disabled={saving || !!approveDisabledReason}
                   loading={saving}
                   title={approveDisabledReason ?? undefined}
                 >
                   {saving ? "Saving" : "Approve"}
                 </NwButton>
                 <NwButton
                   variant="secondary"
                   size="sm"
                   onClick={() => {
                     setPartialApprovedIds(new Set());
                     setPartialNote("");
                     setPartialError(null);
                     setShowPartialModal(true);
                   }}
                   disabled={saving || lineItems.length < 2 || !!approveDisabledReason}
                   title={
                     approveDisabledReason ??
                     (lineItems.length < 2
                       ? "Partial approval requires 2+ line items"
                       : "Split this invoice into approved and held portions")
                   }
                 >
                   Partial
                 </NwButton>
                 <NwButton
                   variant="secondary"
                   size="sm"
                   onClick={() => setShowNoteModal("hold")}
                   disabled={saving}
                 >
                   Hold
                 </NwButton>
                 <NwButton
                   variant="danger"
                   size="sm"
                   onClick={() => setShowNoteModal("deny")}
                   disabled={saving}
                 >
                   Deny
                 </NwButton>
                 <NwButton
                   variant="ghost"
                   size="sm"
                   onClick={() => setShowRequestInfoModal(true)}
                   disabled={saving}
                 >
                   Request Info
                 </NwButton>
               </>
             ) : null}
             {isQaReviewable ? (
               <>
                 <NwButton
                   variant="primary"
                   size="sm"
                   onClick={handleQaApprove}
                   disabled={saving}
                   loading={saving}
                 >
                   {saving ? "Saving" : "QA Approve"}
                 </NwButton>
                 <NwButton
                   variant="danger"
                   size="sm"
                   onClick={() => {
                     setKickBackNote("");
                     setShowKickBackModal(true);
                   }}
                   disabled={saving}
                 >
                   Kick Back to PM
                 </NwButton>
               </>
             ) : null}
             {invoice.signed_file_url ? (
               <a
                 href={invoice.signed_file_url}
                 target="_blank"
                 rel="noopener noreferrer"
                 download
               >
                 <NwButton variant="ghost" size="sm">Download PDF</NwButton>
               </a>
             ) : null}
             {isQaApproved ? (
               <NwButton
                 variant="primary"
                 size="sm"
                 onClick={() => toast.info("QuickBooks integration coming soon")}
               >
                 Push to QuickBooks →
               </NwButton>
             ) : null}
           </div>
         </div>
       </div>

       {/* ── 50/50 HERO ── */}
       <div
         className="grid grid-cols-1 lg:grid-cols-2 items-start"
         style={{
           gap: "1px",
           background: "var(--border-default)",
           border: "1px solid var(--border-default)",
         }}
       >
         {/* LEFT — Source document. Matches right-column bg-card so
             both hero cells present as a single matched pair, separated
             by the grid's 1px hairline. Natural height: the PDF
             canvas renders at the column's available width without a
             max-height cap (which previously capped at 460px and made
             the canvas render at a small resolution, then got scaled
             up and looked blurry). */}
         <div
           className="p-[22px]"
           style={{ background: "var(--bg-card)" }}
         >
           <div className="flex items-center justify-between mb-[14px]">
             <h3
               style={{
                 fontFamily: "var(--font-display)",
                 fontWeight: 500,
                 fontSize: "15px",
                 color: "var(--text-primary)",
                 margin: 0,
               }}
             >
               Source document
             </h3>
             {invoice.signed_file_url ? (
               <a
                 href={invoice.signed_file_url}
                 target="_blank"
                 rel="noopener noreferrer"
                 style={{
                   fontFamily: "var(--font-mono)",
                   fontSize: "10px",
                   letterSpacing: "0.1em",
                   textTransform: "uppercase",
                   color: "var(--nw-stone-blue)",
                 }}
               >
                 Open in new tab ↗
               </a>
             ) : null}
           </div>
           <div className="relative">
             <InvoiceFilePreview
               invoiceId={invoice.id}
               fileUrl={invoice.signed_file_url}
               downloadUrl={invoice.signed_file_url}
               fileName={invoiceDisplayName({
                 vendor_name_raw: invoice.vendor_name_raw,
                 invoice_number: invoice.invoice_number,
                 jobs: invoice.jobs,
               })}
             />
             {isQaApproved ? (
               <div
                 className="pointer-events-none absolute bottom-6 right-6 px-3 py-1.5 border-2"
                 style={{
                   transform: "rotate(-8deg)",
                   borderColor: "var(--nw-success)",
                   color: "var(--nw-success)",
                   fontFamily: "var(--font-mono)",
                   letterSpacing: "0.14em",
                   fontSize: "11px",
                   fontWeight: 600,
                   opacity: 0.75,
                 }}
               >
                 QA APPROVED
               </div>
             ) : null}
           </div>
         </div>

         {/* RIGHT — Details panel + allocations editor, stacked.
             Both sit on the same bg-card so the hero grid's 1px gap
             traces a single vertical hairline between the two columns. */}
         <div style={{ background: "var(--bg-card)" }}>
           <InvoiceDetailsPanel
             totalAmountCents={invoice.total_amount}
             vendorName={vendorName}
             vendorId={invoice.vendor_id}
             projectName={projectName}
             jobId={invoice.job_id}
             receivedAtLabel={receivedAtLabel}
             invoiceDateLabel={invoiceDateLabel}
             drawLabel={drawLabel}
             drawInfo={drawInfo}
             confidenceScore={invoice.confidence_score}
             confidenceDetails={invoice.confidence_details}
             flags={flags}
             aiModelUsed={aiModelUsed}
             statusHistory={invoice.status_history ?? []}
             currentStatus={invoice.status}
             userNames={userNames}
             role={role}
             onVendorNameSave={handleVendorNameSave}
             savingVendorName={savingVendorName}
             qbNotes={qbNotes}
             onQbNotesChange={setQbNotes}
             showQbNotes={isQaReviewable}
           />
           <div
             className="px-[22px] pb-[22px] pt-[4px]"
             style={{ borderTop: "1px solid var(--border-default)" }}
           >
             <InvoiceAllocationsEditor
               invoiceId={invoice.id}
               invoiceTotalCents={invoice.total_amount}
               costCodes={costCodes}
               readOnly={!canEdit}
               onChange={refreshInvoice}
             />
           </div>
         </div>
       </div>

       {/* ── Payment + Payment Tracking ── */}
       <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
         <PaymentPanel invoice={invoice} onRefresh={refreshInvoice} />
         {showPaymentTracking ? (
           <details
             className="group p-5"
             style={{
               background: "var(--bg-card)",
               border: "1px solid var(--border-default)",
             }}
           >
             <summary
               className="cursor-pointer flex items-center justify-between list-none [&::-webkit-details-marker]:hidden"
             >
               <NwEyebrow tone="default">Payment tracking</NwEyebrow>
               <svg
                 className="w-4 h-4 transition-transform group-open:rotate-180"
                 fill="none"
                 viewBox="0 0 24 24"
                 stroke="currentColor"
                 strokeWidth={2}
                 style={{ color: "var(--text-secondary)" }}
                 aria-hidden="true"
               >
                 <path
                   strokeLinecap="round"
                   strokeLinejoin="round"
                   d="M19 9l-7 7-7-7"
                 />
               </svg>
             </summary>
             <div className="mt-4">
               <PaymentTrackingPanel
                 checkNumber={checkNumber}
                 onCheckNumberChange={setCheckNumber}
                 pickedUp={pickedUp}
                 onPickedUpChange={setPickedUp}
                 mailedDate={mailedDate}
                 onMailedDateChange={setMailedDate}
                 saving={savingPayment}
                 onSave={handleSavePaymentTracking}
               />
             </div>
           </details>
         ) : null}
       </div>

       {/* Edit history — shown only when overrides exist */}
       {((invoice.pm_overrides && Object.keys(invoice.pm_overrides).length > 0) ||
         (invoice.qa_overrides && Object.keys(invoice.qa_overrides).length > 0)) ? (
         <div className="mt-5">
           <EditHistoryCard
             pmOverrides={invoice.pm_overrides}
             qaOverrides={invoice.qa_overrides}
           />
         </div>
       ) : null}

       {/* ── FOOTER: Cost Intelligence link-out ── */}
       <div
         className="mt-5 pt-4"
         style={{ borderTop: "1px solid var(--border-default)" }}
       >
         <Link
           href={`/cost-intelligence/verification?invoice=${invoice.id}`}
           style={{
             color: "var(--nw-stone-blue)",
             textDecoration: "underline",
             textUnderlineOffset: "3px",
             fontSize: "13px",
           }}
         >
           Verify extracted line items in Cost Intelligence →
         </Link>
       </div>
     </div>
   );
 })()}

 </main>

 {/* ── Sticky Mobile Action Bar ── */}
 {isReviewable && (
 <div
 className="md:hidden fixed bottom-0 left-0 right-0 backdrop-blur-sm border-t px-4 py-3 z-30"
 style={{
 background: "color-mix(in srgb, var(--bg-page) 95%, transparent)",
 borderColor: "var(--border-default)",
 }}
 >
 <div className="flex gap-2">
 <NwButton
 variant="primary"
 size="md"
 onClick={openApproveFlow}
 disabled={saving || !!approveDisabledReason}
 loading={saving}
 title={approveDisabledReason ?? undefined}
 className="flex-1"
 >
 Approve
 </NwButton>
 <NwButton
 variant="secondary"
 size="md"
 onClick={() => { setPartialApprovedIds(new Set()); setPartialNote(""); setPartialError(null); setShowPartialModal(true); }}
 disabled={saving || lineItems.length < 2 || !!approveDisabledReason}
 className="flex-1"
 >
 Partial
 </NwButton>
 <NwButton
 variant="secondary"
 size="md"
 onClick={() => setShowNoteModal("hold")}
 disabled={saving}
 className="flex-1"
 >
 Hold
 </NwButton>
 <NwButton
 variant="danger"
 size="md"
 onClick={() => setShowNoteModal("deny")}
 disabled={saving}
 className="flex-1"
 >
 Deny
 </NwButton>
 </div>
 <NwButton
 variant="ghost"
 size="sm"
 onClick={() => setShowRequestInfoModal(true)}
 disabled={saving}
 className="w-full mt-2"
 >
 Request Info
 </NwButton>
 </div>
 )}

 {/* ── Approve Confirmation Modal ── */}
 {showApproveConfirm && (
 <div className="fixed inset-0 bg-nw-slate-deep/60 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-6 w-full max-w-md animate-fade-up shadow-2xl">
 <h3 className="font-display text-xl text-[color:var(--text-primary)] mb-2">
 {isCreditMemo ? "Approve Credit Memo" : "Approve Invoice"}
 </h3>

 {isCreditMemo && (
 <p className="text-sm text-[color:var(--text-muted)] mb-3">
 Approve credit of {formatCents(Math.abs(totalCents))} from {invoice.vendor_name_raw ?? "Unknown"}?
 </p>
 )}

 {/* Soft warnings for optional fields (job+cost code enforced before reaching this modal) */}
 {(missingInvoiceNumber || missingInvoiceDate) && (
 <div className="mb-4 px-3 py-2.5 bg-[rgba(201,138,59,0.12)] border border-[rgba(201,138,59,0.25)] space-y-1">
 {missingInvoiceNumber && <p className="text-xs text-[color:var(--nw-warn)]">Missing invoice number</p>}
 {missingInvoiceDate && <p className="text-xs text-[color:var(--nw-warn)]">Missing invoice date</p>}
 <p className="text-[11px] text-[color:var(--text-secondary)] mt-1">You can still approve, but consider filling these in.</p>
 </div>
 )}

 <div className="bg-[var(--bg-subtle)] border border-[var(--border-default)] p-4 space-y-2 text-sm">
 <div className="flex justify-between">
 <span className="text-[color:var(--text-secondary)]">Amount</span>
 <span className={`font-display font-medium ${isCreditMemo ? "text-[color:var(--nw-stone-blue)]" : "text-[color:var(--nw-warn)]"}`}>{formatCents(totalCents)}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-[color:var(--text-secondary)]">Vendor</span>
 <span className="text-[color:var(--text-primary)]">{invoice.vendor_name_raw ?? "Unknown"}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-[color:var(--text-secondary)]">Job</span>
 <span className="text-[color:var(--text-primary)]">{selectedJob?.name ?? "Not assigned"}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-[color:var(--text-secondary)]">Default Cost Code</span>
 <span className="text-[color:var(--text-primary)]">{selectedCostCode ? `${selectedCostCode.code} — ${selectedCostCode.description}` : "Not assigned"}</span>
 </div>
 {uniqueLineCodeIds.length > 1 && (
 <div className="flex justify-between">
 <span className="text-[color:var(--text-secondary)]">Cost Code Split</span>
 <span className="text-[color:var(--text-primary)]">{uniqueLineCodeIds.length} codes across {lineItems.length} lines</span>
 </div>
 )}
 {isChangeOrder && (
 <div className="flex justify-between">
 <span className="text-[color:var(--text-secondary)]">Change Order</span>
 <span className="text-[color:var(--nw-warn)]">{coReference || "Yes"}</span>
 </div>
 )}
 </div>

 <div className="flex gap-3 mt-5">
 <NwButton
 variant="primary"
 size="md"
 onClick={() => { setShowApproveConfirm(false); handleAction("approve"); }}
 disabled={saving}
 loading={saving}
 className="flex-1"
 >
 {isCreditMemo ? "Confirm Credit Approval" : "Confirm Approval"}
 </NwButton>
 <NwButton variant="ghost" size="md" onClick={() => setShowApproveConfirm(false)} className="flex-1">
 Cancel
 </NwButton>
 </div>
 </div>
 </div>
 )}

 {/* ── Over-Budget Modal (graduated severity gate) ── */}
 {showOverBudgetModal && (() => {
 const redRows = overBudgetByCode.filter(r => r.severity === "red");
 const orangeRows = overBudgetByCode.filter(r => r.severity === "orange");
 const hasRed = redRows.length > 0;
 const formatCc = (ccId: string) => costCodes.find(c => c.id === ccId)?.code ?? "???";
 return (
 <div className="fixed inset-0 bg-nw-slate-deep/60 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="bg-[var(--bg-card)] border border-[rgba(176,85,78,0.35)] p-6 w-full max-w-lg animate-fade-up shadow-2xl">
 <div className="flex items-center gap-3 mb-4">
 <div className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${hasRed ? "bg-[rgba(176,85,78,0.12)]" : "bg-[rgba(201,138,59,0.12)]"}`}>
 <svg className={`w-5 h-5 ${hasRed ? "text-[color:var(--nw-danger)]" : "text-[color:var(--nw-warn)]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
 </svg>
 </div>
 <h3 className="font-display text-xl text-[color:var(--text-primary)]">
 {hasRed ? "Over Budget — Review Required" : "Over Budget — Note Required"}
 </h3>
 </div>
 <p className="text-sm text-[color:var(--text-muted)] mb-3">
 This invoice exceeds the budget on {overBudgetByCode.filter(r => r.severity !== "none").length} cost code(s):
 </p>
 <ul className="bg-[var(--bg-subtle)] border border-[var(--border-default)] p-3 space-y-1 mb-4 max-h-40 overflow-y-auto">
 {overBudgetByCode.filter(r => r.severity !== "none").map(r => (
 <li key={r.ccId} className="text-xs text-[color:var(--text-muted)] flex justify-between">
 <span>
 <span className="font-mono text-[color:var(--nw-stone-blue)]">{formatCc(r.ccId)}</span>
 {r.bi?.is_allowance && <span className="ml-1 text-[color:var(--nw-stone-blue)]">[Allowance]</span>}
 </span>
 <span className={r.severity === "red" ? "text-[color:var(--nw-danger)]" : r.severity === "orange" ? "text-[color:var(--nw-warn)]" : "text-[color:var(--nw-warn)]"}>
 +{formatCents(r.overageCents)} ({r.pct.toFixed(1)}%)
 </span>
 </li>
 ))}
 </ul>

 {hasAllowanceOverage && (
 <div className="mb-4 px-3 py-2 bg-[rgba(91,134,153,0.12)] border border-[rgba(91,134,153,0.3)]">
 <p className="text-xs text-[color:var(--nw-stone-blue)] font-medium">Allowance overage detected</p>
 <p className="text-[11px] text-[color:var(--text-secondary)] mt-0.5">
 Allowances are expected to generate change orders — &quot;Convert to Change Order&quot; is the recommended path.
 </p>
 </div>
 )}

 <label className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider mb-1.5 block">
 {hasRed ? "Overage Note (required if approving as overage)" : "Overage Note (required)"}
 </label>
 <Textarea
 value={overBudgetNote}
 onChange={(e) => setOverBudgetNote(e.target.value)}
 placeholder={`Why is this going over? (e.g. "Client requested ${orangeRows.length > 0 && orangeRows[0].bi?.is_allowance ? "tile upgrade" : "additional scope"}"`}
 className="resize-none"
 minRows={3}
 />

 <div className="flex flex-col gap-2 mt-5">
 {hasRed && (
 <NwButton variant="primary" size="md" onClick={handleConvertToChangeOrder} className="w-full">
 Convert to Change Order
 </NwButton>
 )}
 <div className="flex gap-3">
 <NwButton
 variant={hasRed ? "danger" : "primary"}
 size="md"
 onClick={() => {
 if (!overBudgetNote.trim()) return;
 setShowOverBudgetModal(false);
 const prefix = hasRed ? "Approved as overage. " : "Over budget approval. ";
 const summary = overBudgetByCode
 .filter(r => r.severity !== "none")
 .map(r => `${formatCc(r.ccId)} +${formatCents(r.overageCents)} (${r.pct.toFixed(1)}%)`)
 .join("; ");
 handleAction("approve", `${prefix}${summary}. Reason: ${overBudgetNote.trim()}`);
 setOverBudgetNote("");
 }}
 disabled={!overBudgetNote.trim() || saving}
 className="flex-1"
 >
 {hasRed ? "Approve as Overage" : "Approve With Note"}
 </NwButton>
 <NwButton
 variant="ghost"
 size="md"
 onClick={() => { setShowOverBudgetModal(false); setOverBudgetNote(""); }}
 className="flex-1"
 >
 Cancel
 </NwButton>
 </div>
 </div>
 </div>
 </div>
 );
 })()}

 {/* ── Amount Guard Modal (>10% over AI-parsed) ── */}
 {showAmountGuard && (
 <div className="fixed inset-0 bg-nw-slate-deep/60 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="bg-[var(--bg-card)] border border-[rgba(176,85,78,0.35)] p-6 w-full max-w-md animate-fade-up shadow-2xl">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 bg-[rgba(176,85,78,0.12)] flex items-center justify-center flex-shrink-0">
 <svg className="w-5 h-5 text-[color:var(--nw-danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
 </svg>
 </div>
 <h3 className="font-display text-xl text-[color:var(--text-primary)]">Amount Change Requires Note</h3>
 </div>
 <p className="text-sm text-[color:var(--text-muted)] mb-4">
 You&apos;re approving <span className="font-medium text-[color:var(--text-primary)]">{formatCents(totalCents)}</span>, which is{" "}
 <span className="text-[color:var(--nw-danger)] font-medium">+{amountIncreasePct.toFixed(1)}%</span> over the AI-parsed total of{" "}
 <span className="text-[color:var(--text-primary)]">{formatCents(aiParsedTotal)}</span>. A note is required for any increase over 10%.
 </p>
 <Textarea
 value={amountGuardNote}
 onChange={(e) => setAmountGuardNote(e.target.value)}
 placeholder="Reason for the amount change (required)..."
 className="resize-none"
 minRows={4}
 />
 <div className="flex gap-3 mt-5">
 <NwButton
 variant="primary"
 size="md"
 onClick={() => {
 if (!amountGuardNote.trim()) return;
 setShowAmountGuard(false);
 handleAction("approve", `Amount adjusted from ${formatCents(aiParsedTotal)} to ${formatCents(totalCents)} (+${amountIncreasePct.toFixed(1)}%). Reason: ${amountGuardNote.trim()}`);
 setAmountGuardNote("");
 }}
 disabled={!amountGuardNote.trim() || saving}
 className="flex-1"
 >
 Approve With Note
 </NwButton>
 <NwButton variant="ghost" size="md" onClick={() => { setShowAmountGuard(false); setAmountGuardNote(""); }} className="flex-1">
 Cancel
 </NwButton>
 </div>
 </div>
 </div>
 )}

 {/* ── Missing CO Reference Modal ── */}
 {showMissingCoBlock && (
 <div className="fixed inset-0 bg-nw-slate-deep/60 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-6 w-full max-w-md animate-fade-up shadow-2xl">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 bg-[rgba(176,85,78,0.12)] flex items-center justify-center flex-shrink-0">
 <svg className="w-5 h-5 text-[color:var(--nw-danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
 </svg>
 </div>
 <h3 className="font-display text-xl text-[color:var(--text-primary)]">CO Reference Required</h3>
 </div>
 <p className="text-sm text-[color:var(--text-muted)] mb-3">
 {lineItemsMissingCoReference.length} change-order line item{lineItemsMissingCoReference.length === 1 ? "" : "s"} need a CO Reference (e.g. &quot;PCCO #3&quot;) before approval.
 </p>
 <ul className="bg-[var(--bg-subtle)] border border-[var(--border-default)] p-3 space-y-1 mb-5 max-h-40 overflow-y-auto">
 {lineItemsMissingCoReference.map((l, i) => (
 <li key={l.id ?? i} className="text-xs text-[color:var(--text-muted)]">
 Line {l.line_index + 1}: {l.description || "(no description)"} — {formatCents(l.amount_cents)}
 </li>
 ))}
 </ul>
 <NwButton variant="primary" size="md" onClick={() => setShowMissingCoBlock(false)} className="w-full">
 Go Back and Fill In
 </NwButton>
 </div>
 </div>
 )}

 {/* ── Missing Fields Block Modal ── */}
 {showMissingFieldsBlock && (
 <div className="fixed inset-0 bg-nw-slate-deep/60 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-6 w-full max-w-md animate-fade-up shadow-2xl">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 bg-[rgba(176,85,78,0.12)] flex items-center justify-center flex-shrink-0">
 <svg className="w-5 h-5 text-[color:var(--nw-danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
 </svg>
 </div>
 <h3 className="font-display text-xl text-[color:var(--text-primary)]">Cannot Approve</h3>
 </div>
 <p className="text-sm text-[color:var(--text-muted)] mb-2">Job and Cost Code are required before approving.</p>
 <div className="bg-[var(--bg-subtle)] border border-[var(--border-default)] p-3 space-y-1.5 mb-5">
 <div className="flex items-center gap-2">
 <span className={`w-2 h-2 ${jobId ? "bg-[var(--nw-success)]" : "bg-[var(--nw-danger)]"}`} />
 <span className={`text-sm ${jobId ? "text-[color:var(--text-muted)]" : "text-[color:var(--text-primary)] font-medium"}`}>
 {jobId ? `Job: ${selectedJob?.name ?? "Assigned"}` : "Job — not assigned"}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <span className={`w-2 h-2 ${costCodeId ? "bg-[var(--nw-success)]" : "bg-[var(--nw-danger)]"}`} />
 <span className={`text-sm ${costCodeId ? "text-[color:var(--text-muted)]" : "text-[color:var(--text-primary)] font-medium"}`}>
 {costCodeId ? `Cost Code: ${selectedCostCode?.code ?? "Assigned"}` : "Cost Code — not assigned"}
 </span>
 </div>
 </div>
 <div className="flex gap-3">
 <NwButton variant="primary" size="md" onClick={() => setShowMissingFieldsBlock(false)} className="flex-1">
 Go Back and Assign
 </NwButton>
 <NwButton
 variant="secondary"
 size="md"
 onClick={() => { setShowMissingFieldsBlock(false); handleAction("hold", "Held — missing job or cost code assignment"); }}
 disabled={saving}
 className="flex-1"
 >
 Hold Instead
 </NwButton>
 </div>
 </div>
 </div>
 )}

 {/* ── Request Info Modal ── */}
 {showRequestInfoModal && (
 <div className="fixed inset-0 bg-nw-slate-deep/60 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-6 w-full max-w-md animate-fade-up shadow-2xl">
 <h3 className="font-display text-xl text-[color:var(--text-primary)] mb-4">Request Information</h3>
 <div className="space-y-4">
 <div>
 <label className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider mb-1.5 block">
 Who do you need info from?
 </label>
 <select
 value={infoRecipient}
 onChange={(e) => setInfoRecipient(e.target.value)}
 className="w-full px-3 py-2.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
 >
 <option value="">Select...</option>
 <option value="Vendor">Vendor</option>
 <option value="Subcontractor">Subcontractor</option>
 <option value="Architect">Architect</option>
 <option value="Other">Other</option>
 </select>
 </div>
 <div>
 <label className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider mb-1.5 block">
 What do you need?
 </label>
 <Textarea
 value={infoQuestion}
 onChange={(e) => setInfoQuestion(e.target.value)}
 placeholder="Describe the information you need..."
 className="resize-none"
 minRows={4}
 />
 </div>
 </div>
 <div className="flex gap-3 mt-5">
 <NwButton
 variant="primary"
 size="md"
 onClick={() => {
 handleAction("request_info", `Info requested from ${infoRecipient}: ${infoQuestion.trim()}`);
 setShowRequestInfoModal(false);
 setInfoRecipient("");
 setInfoQuestion("");
 }}
 disabled={!infoRecipient || !infoQuestion.trim() || saving}
 loading={saving}
 className="flex-1"
 >
 Send Request
 </NwButton>
 <NwButton
 variant="ghost"
 size="md"
 onClick={() => { setShowRequestInfoModal(false); setInfoRecipient(""); setInfoQuestion(""); }}
 className="flex-1"
 >
 Cancel
 </NwButton>
 </div>
 </div>
 </div>
 )}

 {/* ── Hold / Deny Note Modal ── */}
 {showNoteModal && (
 <div className="fixed inset-0 bg-nw-slate-deep/60 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-6 w-full max-w-md animate-fade-up shadow-2xl">
 <h3 className="font-display text-xl text-[color:var(--text-primary)] mb-4">
 {showNoteModal === "hold" ? "Hold Invoice" : "Deny Invoice"}
 </h3>
 <Textarea value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder="Add a note (required)..."
 className="resize-none" minRows={4} />
 <div className="flex gap-3 mt-4">
 <NwButton
 variant={showNoteModal === "hold" ? "secondary" : "danger"}
 size="md"
 onClick={() => { if (actionNote.trim()) { handleAction(showNoteModal, actionNote.trim()); setShowNoteModal(null); setActionNote(""); } }}
 disabled={!actionNote.trim() || saving}
 className="flex-1"
 >
 {showNoteModal === "hold" ? "Hold" : "Deny"}
 </NwButton>
 <NwButton variant="ghost" size="md" onClick={() => { setShowNoteModal(null); setActionNote(""); }} className="flex-1">
 Cancel
 </NwButton>
 </div>
 </div>
 </div>
 )}

 {/* ── Kick Back Modal (Phase 3b) ── */}
 {showKickBackModal && (
 <div className="fixed inset-0 bg-nw-slate-deep/60 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-6 w-full max-w-md animate-fade-up shadow-2xl">
 <h3 className="font-display text-xl text-[color:var(--text-primary)] mb-2">
 Kick Back to PM
 </h3>
 <p className="text-sm text-[color:var(--text-secondary)] mb-4">
 This invoice will be sent back to the PM queue with your note.
 </p>
 <Textarea
 value={kickBackNote}
 onChange={(e) => setKickBackNote(e.target.value)}
 placeholder="Reason for kick back (required)..."
 className="resize-none"
 minRows={4}
 />
 <div className="flex gap-3 mt-4">
 <NwButton
 variant="danger"
 size="md"
 onClick={async () => {
 await handleKickBack();
 setShowKickBackModal(false);
 }}
 disabled={!kickBackNote.trim() || saving}
 className="flex-1"
 >
 Kick Back
 </NwButton>
 <NwButton
 variant="ghost"
 size="md"
 onClick={() => {
 setShowKickBackModal(false);
 setKickBackNote("");
 }}
 className="flex-1"
 >
 Cancel
 </NwButton>
 </div>
 </div>
 </div>
 )}

 {/* ── Partial Approve Modal ── */}
 {showPartialModal && (
 <div className="fixed inset-0 bg-nw-slate-deep/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
 <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-6 w-full max-w-3xl max-h-[92vh] overflow-y-auto animate-fade-up shadow-2xl">
 <h3 className="font-display text-xl text-[color:var(--text-primary)] mb-2">Partial Approval</h3>
 <p className="text-sm text-[color:var(--text-secondary)] mb-5">
 Check the lines to approve now. The rest stays on Hold with a required note. Approved lines split into a new invoice that flows to QA; held lines remain on this record.
 </p>
 <div className="border border-[var(--border-default)]">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-[var(--border-default)] text-[11px] uppercase tracking-wider text-[color:var(--text-secondary)] bg-[rgba(91,134,153,0.04)]">
 <th className="text-left px-3 py-2 font-medium w-8">
 <input
 type="checkbox"
 className="accent-teal w-4 h-4"
 checked={partialApprovedIds.size === lineItems.length && lineItems.length > 0}
 onChange={(e) => {
 if (e.target.checked) setPartialApprovedIds(new Set(lineItems.map((l) => l.id!).filter(Boolean) as string[]));
 else setPartialApprovedIds(new Set());
 }}
 />
 </th>
 <th className="text-left px-3 py-2 font-medium">Description</th>
 <th className="text-left px-3 py-2 font-medium">Cost Code</th>
 <th className="text-right px-3 py-2 font-medium">Amount</th>
 </tr>
 </thead>
 <tbody>
 {lineItems.map((li) => {
 const cc = costCodes.find((c) => c.id === li.cost_code_id);
 const id = li.id;
 if (!id) return null;
 const checked = partialApprovedIds.has(id);
 return (
 <tr key={id} className={`border-b border-[var(--border-default)] last:border-0 ${checked ? "bg-[rgba(74,138,111,0.08)]" : ""}`}>
 <td className="px-3 py-2">
 <input
 type="checkbox"
 className="accent-teal w-4 h-4"
 checked={checked}
 onChange={(e) => {
 setPartialApprovedIds((prev) => {
 const next = new Set(prev);
 if (e.target.checked) next.add(id);
 else next.delete(id);
 return next;
 });
 }}
 />
 </td>
 <td className="px-3 py-2 text-[color:var(--text-primary)]">
 <span className="line-clamp-2">{li.description || "—"}</span>
 {li.is_change_order && li.co_reference && (
 <span className="ml-2 text-[10px] uppercase tracking-wider text-[color:var(--nw-warn)]">CO {li.co_reference}</span>
 )}
 </td>
 <td className="px-3 py-2 text-[color:var(--text-muted)] text-xs font-mono">
 {cc ? `${cc.code} ${cc.description}` : "—"}
 </td>
 <td className="px-3 py-2 text-right text-[color:var(--text-primary)] tabular-nums">{formatCents(li.amount_cents)}</td>
 </tr>
 );
 })}
 </tbody>
 <tfoot>
 <tr className="border-t-2 border-[var(--border-default)] bg-[var(--bg-subtle)]">
 <td colSpan={3} className="px-3 py-2 text-[11px] uppercase tracking-wider text-[color:var(--text-secondary)]">
 Approving {partialApprovedIds.size} of {lineItems.length} lines
 </td>
 <td className="px-3 py-2 text-right text-[color:var(--nw-success)] font-display tabular-nums">
 {formatCents(lineItems.filter((l) => l.id && partialApprovedIds.has(l.id)).reduce((s, l) => s + l.amount_cents, 0))}
 </td>
 </tr>
 <tr className="bg-[var(--bg-subtle)]">
 <td colSpan={3} className="px-3 py-2 text-[11px] uppercase tracking-wider text-[color:var(--text-secondary)]">
 Holding the remaining
 </td>
 <td className="px-3 py-2 text-right text-[color:var(--nw-warn)] font-display tabular-nums">
 {formatCents(lineItems.filter((l) => l.id && !partialApprovedIds.has(l.id)).reduce((s, l) => s + l.amount_cents, 0))}
 </td>
 </tr>
 </tfoot>
 </table>
 </div>

 <div className="mt-5">
 <label className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider mb-1.5 block">
 Why is the rest held? (required)
 </label>
 <Textarea
 value={partialNote}
 onChange={(e) => setPartialNote(e.target.value)}
 minRows={3}
 placeholder="e.g. Scope on lines 3-5 wasn't agreed — waiting on confirmation from vendor"
 className="resize-none"
 />
 </div>

 {partialError && (
 <div className="mt-3 border border-[rgba(176,85,78,0.35)] bg-[rgba(176,85,78,0.08)] px-4 py-2 text-sm text-[color:var(--nw-danger)]">
 {partialError}
 </div>
 )}

 <div className="flex gap-3 mt-5 pt-4 border-t border-[var(--border-default)]">
 <NwButton
 variant="primary"
 size="md"
 disabled={partialSubmitting || partialApprovedIds.size === 0 || partialApprovedIds.size === lineItems.length || !partialNote.trim()}
 loading={partialSubmitting}
 onClick={async () => {
 setPartialError(null);
 setPartialSubmitting(true);
 try {
 const res = await fetch(`/api/invoices/${invoiceId}/partial-approve`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 approved_line_item_ids: Array.from(partialApprovedIds),
 note: partialNote.trim(),
 }),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
 setShowPartialModal(false);
 router.push("/invoices/queue");
 } catch (err) {
 setPartialError(err instanceof Error ? err.message : "Failed");
 } finally {
 setPartialSubmitting(false);
 }
 }}
 className="flex-1"
 >
 {partialSubmitting ? "Splitting" : `Approve ${partialApprovedIds.size} line${partialApprovedIds.size !== 1 ? "s" : ""} & hold the rest`}
 </NwButton>
 <NwButton variant="ghost" size="md" onClick={() => setShowPartialModal(false)}>
 Cancel
 </NwButton>
 </div>
 </div>
 </div>
 )}
 </AppShell>
 );
}

const FIELD_LABELS: Record<string, string> = {
 invoice_number: "Invoice #",
 invoice_date: "Invoice Date",
 total_amount: "Total Amount",
 invoice_type: "Type",
 description: "Description",
 job_id: "Job",
 cost_code_id: "Cost Code",
 po_id: "Purchase Order",
 vendor_id: "Vendor",
 co_reference_raw: "CO Reference",
};

function formatOverrideValue(value: unknown): string {
 if (value === null || value === undefined || value === "") return "(empty)";
 if (typeof value === "number") return formatDollars(value);
 return String(value);
}

function EditHistoryCard({
 pmOverrides,
 qaOverrides,
}: {
 pmOverrides: Record<string, { old: unknown; new: unknown }> | null;
 qaOverrides: Record<string, { old: unknown; new: unknown }> | null;
}) {
 const [open, setOpen] = useState(false);

 const entries: { source: string; field: string; old: unknown; newVal: unknown }[] = [];

 if (pmOverrides) {
 for (const [field, change] of Object.entries(pmOverrides)) {
 entries.push({ source: "PM", field, old: change.old, newVal: change.new });
 }
 }
 if (qaOverrides) {
 for (const [field, change] of Object.entries(qaOverrides)) {
 entries.push({ source: "QA", field, old: change.old, newVal: change.new });
 }
 }

 if (entries.length === 0) return null;

 return (
 <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-5">
 <button
 onClick={() => setOpen(!open)}
 className="w-full flex items-center justify-between"
 >
 <p className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider brass-underline">
 Edit History ({entries.length})
 </p>
 <svg
 className={`w-4 h-4 text-[color:var(--text-secondary)] transition-transform ${open ? "rotate-180" : ""}`}
 fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
 >
 <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
 </svg>
 </button>
 {open && (
 <div className="mt-4 space-y-3">
 {entries.map((entry, i) => (
 <div key={i} className="text-xs border-l-2 border-[rgba(91,134,153,0.3)] pl-3 py-1">
 <p className="text-[color:var(--text-primary)]">
 <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold mr-1.5 bg-transparent border ${
 entry.source === "PM" ? "text-[color:var(--nw-stone-blue)] border-[var(--nw-stone-blue)]" : "text-[color:var(--nw-warn)] border-[var(--nw-warn)]"
 }`}>
 {entry.source}
 </span>
 changed <span className="font-medium">{FIELD_LABELS[entry.field] ?? entry.field}</span>
 </p>
 <p className="text-[color:var(--text-secondary)] mt-1">
 <span className="line-through">{formatOverrideValue(entry.old)}</span>
 {" "}&rarr;{" "}
 <span className="text-[color:var(--text-primary)]">{formatOverrideValue(entry.newVal)}</span>
 </p>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}

