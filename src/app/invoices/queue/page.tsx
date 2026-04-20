"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatCents, confidenceColor, daysAgo, formatDate } from "@/lib/utils/format";
import AppShell from "@/components/app-shell";
import FinancialViewTabs from "@/components/financial-view-tabs";
import EmptyState, { EmptyIcons } from "@/components/empty-state";
import { SkeletonList } from "@/components/loading-skeleton";

interface QueueInvoice {
 id: string;
 vendor_name_raw: string | null;
 vendor_id: string | null;
 invoice_number: string | null;
 invoice_date: string | null;
 total_amount: number;
 confidence_score: number;
 received_date: string;
 status: string;
 job_id: string | null;
 cost_code_id: string | null;
 document_category: string | null;
 document_type: string | null;
 po_id: string | null;
 is_potential_duplicate: boolean;
 duplicate_dismissed_at: string | null;
 jobs: { name: string } | null;
 assigned_pm: { id: string; full_name: string } | null;
}

/**
 * Per-card pill set flagging missing required fields. Any of these means the
 * invoice is stuck in PM Queue until a human fills in the blank, so we surface
 * them loudly on the card.
 */
function MissingDataBadges({ inv }: { inv: QueueInvoice }) {
 const unknownVendor =
 !inv.vendor_id ||
 (inv.vendor_name_raw ?? "").trim().toLowerCase() === "unknown" ||
 !inv.vendor_name_raw?.trim();
 const missingNumber = !inv.invoice_number?.trim();
 const missingDate = !inv.invoice_date;
 if (!unknownVendor && !missingNumber && !missingDate) return null;
 return (
 <div className="mt-2 flex flex-wrap gap-1.5">
 {missingNumber && (
 <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-transparent text-brass border border-brass uppercase tracking-wide">
 No Invoice #
 </span>
 )}
 {missingDate && (
 <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-transparent text-status-danger border border-status-danger uppercase tracking-wide">
 No Date
 </span>
 )}
 {unknownVendor && (
 <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-transparent text-status-danger border border-status-danger uppercase tracking-wide">
 Unknown Vendor
 </span>
 )}
 </div>
 );
}

function hasMissingData(inv: QueueInvoice): boolean {
 const unknownVendor =
 !inv.vendor_id ||
 (inv.vendor_name_raw ?? "").trim().toLowerCase() === "unknown" ||
 !inv.vendor_name_raw?.trim();
 return unknownVendor || !inv.invoice_number?.trim() || !inv.invoice_date;
}

interface PmUser {
 id: string;
 full_name: string;
}

interface WorkflowSettingsClient {
 batch_approval_enabled: boolean;
 quick_approve_enabled: boolean;
 quick_approve_min_confidence: number;
 require_invoice_date: boolean;
 require_budget_allocation: boolean;
 require_po_linkage: boolean;
 duplicate_detection_enabled: boolean;
 over_budget_requires_note: boolean;
}

type SortKey = "vendor" | "date" | "amount" | "confidence" | "waiting" | "pm";
type SortDir = "asc" | "desc";
type ConfidenceFilter = "all" | "high" | "medium" | "low";
type StatusFilter = "pending" | "held" | "denied" | "kicked_back" | "info_requested" | "needs_attention" | "all";
type AmountRange = "all" | "0-5k" | "5k-25k" | "25k-100k" | "100k+";

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
 if (!active) return <span className="ml-1 text-cream-dim">&#8597;</span>;
 return <span className="ml-1 text-teal">{dir === "asc" ? "\u2191" : "\u2193"}</span>;
}

/** Orange outlined badge for invoices that aren't job-costed (software,
 *  storage, utilities). Shown in place of the "Unmatched" grey text so
 *  PMs know they're not supposed to hunt for a job match. */
function OverheadBadge() {
 return (
 <span
 className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-transparent border"
 style={{ color: "var(--color-warning, #E65100)", borderColor: "var(--color-warning, #E65100)" }}
 >
 Overhead
 </span>
 );
}

export default function QueuePage() {
 const [invoices, setInvoices] = useState<QueueInvoice[]>([]);
 const [pmUsers, setPmUsers] = useState<PmUser[]>([]);
 const [loading, setLoading] = useState(true);

 // Current user (from Supabase auth) — drives PM-only self-filter
 const [currentUserId, setCurrentUserId] = useState<string | null>(null);
 const [currentRole, setCurrentRole] = useState<"admin" | "pm" | "accounting" | null>(null);
 const [myJobIds, setMyJobIds] = useState<Set<string>>(new Set());

 // Primary filters (always visible)
 const [search, setSearch] = useState("");
 const [jobFilter, setJobFilter] = useState("");
 const [pmFilter, setPmFilter] = useState("");
 const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");

 // Advanced filters (collapsible)
 const [showMoreFilters, setShowMoreFilters] = useState(false);
 const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
 const [amountRange, setAmountRange] = useState<AmountRange>("all");
 const [dateStart, setDateStart] = useState("");
 const [dateEnd, setDateEnd] = useState("");

 // Sort
 const [sortKey, setSortKey] = useState<SortKey>("waiting");
 const [sortDir, setSortDir] = useState<SortDir>("desc");

 // Batch selection
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [batchProcessing, setBatchProcessing] = useState(false);
 const [showHoldNoteModal, setShowHoldNoteModal] = useState(false);
 const [holdNote, setHoldNote] = useState("");
 const [showDenyNoteModal, setShowDenyNoteModal] = useState(false);
 const [denyNote, setDenyNote] = useState("");
 const [showApproveConfirm, setShowApproveConfirm] = useState(false);
 const [approvalEligible, setApprovalEligible] = useState<QueueInvoice[]>([]);
 const [approvalExcluded, setApprovalExcluded] = useState<Array<{ invoice: QueueInvoice; reasons: string[] }>>([]);
 const selectAllRef = useRef<HTMLInputElement>(null);

 // Workflow settings (null while loading — UI gates off this)
 const [workflowSettings, setWorkflowSettings] = useState<WorkflowSettingsClient | null>(null);

 // Line items allocation map (id -> { hasAnyBudgetLine, hasAllBudgetLines, hasAnyPO, hasAllPOs })
 const [lineItemSummary, setLineItemSummary] = useState<
 Map<string, { hasAllBudgetLines: boolean; hasAllPOs: boolean; lineCount: number }>
 >(new Map());

 // Toast feedback for batch actions
 const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

 // Quick Approve — inline confirmation state per invoice
 const [quickApproveConfirmId, setQuickApproveConfirmId] = useState<string | null>(null);
 const [quickApproveProcessingId, setQuickApproveProcessingId] = useState<string | null>(null);
 const [animatingOutIds, setAnimatingOutIds] = useState<Set<string>>(new Set());

 useEffect(() => {
 async function fetchData() {
 const {
 data: { user },
 } = await supabase.auth.getUser();

 let role: "admin" | "pm" | "accounting" | null = null;
 if (user) {
 setCurrentUserId(user.id);
 const { data: membership } = await supabase
 .from("org_members")
 .select("role")
 .eq("user_id", user.id)
 .eq("is_active", true)
 .maybeSingle();
 role = (membership?.role as typeof role) ?? null;
 setCurrentRole(role);

 // For PMs, pre-load the set of jobs they own so we can include
 // any invoice on those jobs (not just ones explicitly assigned).
 if (role === "pm") {
 const { data: myJobs } = await supabase
 .from("jobs")
 .select("id")
 .eq("pm_id", user.id)
 .is("deleted_at", null);
 if (myJobs) setMyJobIds(new Set(myJobs.map((j) => j.id as string)));
 }
 }

 const [invoiceResult, pmResult, settingsResult] = await Promise.all([
 supabase
 .from("invoices")
 .select(
 "id, vendor_name_raw, vendor_id, invoice_number, invoice_date, total_amount, confidence_score, received_date, status, job_id, cost_code_id, document_category, document_type, po_id, is_potential_duplicate, duplicate_dismissed_at, jobs:job_id (name), assigned_pm:assigned_pm_id (id, full_name)"
 )
 .in("status", ["pm_review", "ai_processed", "pm_held", "pm_denied", "info_requested"])
 .is("deleted_at", null)
 .order("received_date", { ascending: true }),
 supabase
 .from("users")
 .select("id, full_name")
 .in("role", ["pm", "admin"])
 .is("deleted_at", null)
 .order("full_name"),
 fetch("/api/workflow-settings").then((r) => (r.ok ? r.json() : null)).catch(() => null),
 ]);

 if (!invoiceResult.error && invoiceResult.data) {
 const rows = invoiceResult.data as unknown as QueueInvoice[];
 setInvoices(rows);
 // Load line item allocation summary for batch workflow checks.
 const ids = rows.map((r) => r.id);
 if (ids.length > 0) {
 const { data: lines } = await supabase
 .from("invoice_line_items")
 .select("invoice_id, budget_line_id, po_id")
 .in("invoice_id", ids)
 .is("deleted_at", null);
 const map = new Map<string, { hasAllBudgetLines: boolean; hasAllPOs: boolean; lineCount: number }>();
 for (const r of rows) {
 const myLines = (lines ?? []).filter((l) => l.invoice_id === r.id);
 map.set(r.id, {
 hasAllBudgetLines: myLines.length > 0 && myLines.every((l) => !!l.budget_line_id),
 hasAllPOs: myLines.length > 0 && myLines.every((l) => !!l.po_id),
 lineCount: myLines.length,
 });
 }
 setLineItemSummary(map);
 }
 }
 if (!pmResult.error && pmResult.data) {
 setPmUsers(pmResult.data as PmUser[]);
 }
 if (settingsResult?.settings) {
 setWorkflowSettings({
 batch_approval_enabled: settingsResult.settings.batch_approval_enabled,
 quick_approve_enabled: settingsResult.settings.quick_approve_enabled,
 quick_approve_min_confidence: settingsResult.settings.quick_approve_min_confidence,
 require_invoice_date: settingsResult.settings.require_invoice_date,
 require_budget_allocation: settingsResult.settings.require_budget_allocation,
 require_po_linkage: settingsResult.settings.require_po_linkage,
 duplicate_detection_enabled: settingsResult.settings.duplicate_detection_enabled,
 over_budget_requires_note: settingsResult.settings.over_budget_requires_note,
 });
 } else {
 // Fallback defaults if settings couldn't load.
 setWorkflowSettings({
 batch_approval_enabled: true,
 quick_approve_enabled: true,
 quick_approve_min_confidence: 95,
 require_invoice_date: true,
 require_budget_allocation: false,
 require_po_linkage: false,
 duplicate_detection_enabled: true,
 over_budget_requires_note: true,
 });
 }
 setLoading(false);
 }
 fetchData();
 }, []);

 const batchEnabled = workflowSettings?.batch_approval_enabled ?? false;
 const quickApproveEnabled = workflowSettings?.quick_approve_enabled ?? false;
 const quickApproveThreshold = (workflowSettings?.quick_approve_min_confidence ?? 95) / 100;

 const getApprovalBlockers = useCallback(
 (inv: QueueInvoice): string[] => {
 if (!workflowSettings) return [];
 const reasons: string[] = [];
 if (!inv.job_id) reasons.push("No job assigned");
 if (!inv.cost_code_id) reasons.push("No cost code assigned");
 if (workflowSettings.require_invoice_date && !inv.invoice_date) {
 reasons.push("Missing invoice date");
 }
 if (
 workflowSettings.duplicate_detection_enabled &&
 inv.is_potential_duplicate &&
 !inv.duplicate_dismissed_at
 ) {
 reasons.push("Flagged as duplicate — review individually");
 }
 if (workflowSettings.require_budget_allocation) {
 const s = lineItemSummary.get(inv.id);
 if (!s || s.lineCount === 0 || !s.hasAllBudgetLines) {
 reasons.push("Not fully allocated to budget lines");
 }
 }
 if (workflowSettings.require_po_linkage) {
 const s = lineItemSummary.get(inv.id);
 const headerPO = !!inv.po_id;
 if (!headerPO && (!s || !s.hasAllPOs)) {
 reasons.push("No PO linked");
 }
 }
 return reasons;
 },
 [workflowSettings, lineItemSummary]
 );

 // Quick Approve eligibility: requires confidence threshold met, no blockers,
 // and invoice in a reviewable state.
 const isQuickApproveEligible = useCallback(
 (inv: QueueInvoice): boolean => {
 if (!workflowSettings?.quick_approve_enabled) return false;
 if (inv.confidence_score < quickApproveThreshold) return false;
 if (inv.status !== "pm_review" && inv.status !== "ai_processed") return false;
 const blockers = getApprovalBlockers(inv);
 if (blockers.length > 0) return false;
 return true;
 },
 [workflowSettings, quickApproveThreshold, getApprovalBlockers]
 );

 const handleQuickApprove = useCallback(
 async (inv: QueueInvoice) => {
 setQuickApproveProcessingId(inv.id);
 try {
 const res = await fetch(`/api/invoices/${inv.id}/action`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ action: "approve", note: "Quick approve" }),
 });
 if (!res.ok) {
 const err = await res.json().catch(() => ({}));
 setToast({ kind: "err", text: err.error ?? "Quick approve failed" });
 setTimeout(() => setToast(null), 4500);
 return;
 }
 // Animate card out, then remove from list.
 setAnimatingOutIds((prev) => new Set(prev).add(inv.id));
 setQuickApproveConfirmId(null);
 setTimeout(() => {
 setInvoices((prev) => prev.filter((i) => i.id !== inv.id));
 setAnimatingOutIds((prev) => {
 const next = new Set(prev);
 next.delete(inv.id);
 return next;
 });
 }, 300);
 setToast({
 kind: "ok",
 text: `Approved ${inv.vendor_name_raw ?? "invoice"} · ${formatCents(inv.total_amount)}`,
 });
 setTimeout(() => setToast(null), 3500);
 } finally {
 setQuickApproveProcessingId(null);
 }
 },
 []
 );

 // Unique job names for dropdown
 const jobNames = useMemo(() => {
 const names = new Set<string>();
 invoices.forEach((inv) => {
 if (inv.jobs?.name) names.add(inv.jobs.name);
 });
 return Array.from(names).sort();
 }, [invoices]);

 // Count active advanced filters for badge
 const advancedFilterCount = useMemo(() => {
 let count = 0;
 if (statusFilter !== "pending") count++;
 if (amountRange !== "all") count++;
 if (dateStart || dateEnd) count++;
 return count;
 }, [statusFilter, amountRange, dateStart, dateEnd]);

 // Filter + sort
 const filtered = useMemo(() => {
 let result = invoices;

 // PM self-filter: a PM only ever sees invoices on their own jobs
 // (either explicitly assigned to them OR on a job where they are pm_id).
 if (currentRole === "pm" && currentUserId) {
 result = result.filter(
 (inv) =>
 inv.assigned_pm?.id === currentUserId ||
 (inv.job_id != null && myJobIds.has(inv.job_id))
 );
 }

 // Text search
 if (search.trim()) {
 const q = search.toLowerCase();
 result = result.filter(
 (inv) =>
 (inv.vendor_name_raw ?? "").toLowerCase().includes(q) ||
 (inv.invoice_number ?? "").toLowerCase().includes(q)
 );
 }

 // Job filter
 if (jobFilter) {
 result = result.filter((inv) => inv.jobs?.name === jobFilter);
 }

 // PM filter
 if (pmFilter) {
 if (pmFilter === "__unassigned__") {
 result = result.filter((inv) => !inv.assigned_pm);
 } else {
 result = result.filter((inv) => inv.assigned_pm?.id === pmFilter);
 }
 }

 // Confidence filter
 if (confidenceFilter !== "all") {
 result = result.filter((inv) => {
 const s = inv.confidence_score;
 if (confidenceFilter === "high") return s >= 0.85;
 if (confidenceFilter === "medium") return s >= 0.7 && s < 0.85;
 return s < 0.7; // low
 });
 }

 // Status filter
 if (statusFilter !== "all") {
 if (statusFilter === "pending") {
 result = result.filter(
 (inv) => inv.status === "pm_review" || inv.status === "ai_processed"
 );
 } else if (statusFilter === "held") {
 result = result.filter((inv) => inv.status === "pm_held");
 } else if (statusFilter === "denied") {
 result = result.filter((inv) => inv.status === "pm_denied");
 } else if (statusFilter === "kicked_back") {
 // Kicked-back items return to pm_review status
 result = result.filter((inv) => inv.status === "pm_review");
 } else if (statusFilter === "info_requested") {
 result = result.filter((inv) => inv.status === "info_requested");
 } else if (statusFilter === "needs_attention") {
 result = result.filter(hasMissingData);
 }
 }

 // Amount range filter
 if (amountRange !== "all") {
 result = result.filter((inv) => {
 const amt = inv.total_amount;
 switch (amountRange) {
 case "0-5k":
 return amt >= 0 && amt < 500000;
 case "5k-25k":
 return amt >= 500000 && amt < 2500000;
 case "25k-100k":
 return amt >= 2500000 && amt < 10000000;
 case "100k+":
 return amt >= 10000000;
 default:
 return true;
 }
 });
 }

 // Date range filter (received_date)
 if (dateStart) {
 result = result.filter((inv) => inv.received_date >= dateStart);
 }
 if (dateEnd) {
 result = result.filter((inv) => inv.received_date <= dateEnd);
 }

 // Sort
 result = [...result].sort((a, b) => {
 let cmp = 0;
 switch (sortKey) {
 case "vendor":
 cmp = (a.vendor_name_raw ?? "").localeCompare(
 b.vendor_name_raw ?? ""
 );
 break;
 case "date":
 cmp = (a.invoice_date ?? "").localeCompare(b.invoice_date ?? "");
 break;
 case "amount":
 cmp = a.total_amount - b.total_amount;
 break;
 case "confidence":
 cmp = a.confidence_score - b.confidence_score;
 break;
 case "waiting":
 cmp = daysAgo(a.received_date) - daysAgo(b.received_date);
 break;
 case "pm":
 cmp = (a.assigned_pm?.full_name ?? "").localeCompare(
 b.assigned_pm?.full_name ?? ""
 );
 break;
 }
 return sortDir === "asc" ? cmp : -cmp;
 });

 return result;
 }, [
 invoices,
 currentRole,
 currentUserId,
 myJobIds,
 search,
 jobFilter,
 pmFilter,
 confidenceFilter,
 statusFilter,
 amountRange,
 dateStart,
 dateEnd,
 sortKey,
 sortDir,
 ]);

 const toggleSort = (key: SortKey) => {
 if (sortKey === key) {
 setSortDir((d) => (d === "asc" ? "desc" : "asc"));
 } else {
 setSortKey(key);
 setSortDir(key === "vendor" || key === "pm" ? "asc" : "desc");
 }
 };

 const isFiltered =
 search.trim() !== "" ||
 jobFilter !== "" ||
 pmFilter !== "" ||
 confidenceFilter !== "all" ||
 statusFilter !== "pending" ||
 amountRange !== "all" ||
 dateStart !== "" ||
 dateEnd !== "";

 const clearAllFilters = () => {
 setSearch("");
 setJobFilter("");
 setPmFilter("");
 setConfidenceFilter("all");
 setStatusFilter("pending");
 setAmountRange("all");
 setDateStart("");
 setDateEnd("");
 };

 // Clear selection when filters change
 useEffect(() => {
 setSelectedIds(new Set());
 }, [search, jobFilter, pmFilter, confidenceFilter, statusFilter, amountRange, dateStart, dateEnd]);

 // Update indeterminate state on select-all checkbox
 useEffect(() => {
 if (selectAllRef.current) {
 const allSelected = filtered.length > 0 && filtered.every((inv) => selectedIds.has(inv.id));
 const someSelected = filtered.some((inv) => selectedIds.has(inv.id));
 selectAllRef.current.indeterminate = someSelected && !allSelected;
 }
 }, [selectedIds, filtered]);

 const toggleSelectAll = useCallback(() => {
 const allFilteredIds = filtered.map((inv) => inv.id);
 const allSelected = allFilteredIds.every((id) => selectedIds.has(id));
 if (allSelected) {
 setSelectedIds(new Set());
 } else {
 setSelectedIds(new Set(allFilteredIds));
 }
 }, [filtered, selectedIds]);

 const toggleSelect = useCallback((id: string) => {
 setSelectedIds((prev) => {
 const next = new Set(prev);
 if (next.has(id)) {
 next.delete(id);
 } else {
 next.add(id);
 }
 return next;
 });
 }, []);

 // Step 1 of batch approve: open the confirmation modal with eligibility split.
 const handleBatchApprove = useCallback(() => {
 const selected = filtered.filter((inv) => selectedIds.has(inv.id));
 const eligible: QueueInvoice[] = [];
 const excluded: Array<{ invoice: QueueInvoice; reasons: string[] }> = [];
 for (const inv of selected) {
 const reasons = getApprovalBlockers(inv);
 if (reasons.length === 0) eligible.push(inv);
 else excluded.push({ invoice: inv, reasons });
 }
 setApprovalEligible(eligible);
 setApprovalExcluded(excluded);
 setShowApproveConfirm(true);
 }, [filtered, selectedIds, getApprovalBlockers]);

 // Step 2: commit the approval for the eligible subset.
 const confirmBatchApprove = useCallback(async () => {
 if (approvalEligible.length === 0) {
 setShowApproveConfirm(false);
 return;
 }
 setBatchProcessing(true);
 try {
 const res = await fetch("/api/invoices/batch-action", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 action: "approve",
 invoice_ids: approvalEligible.map((i) => i.id),
 }),
 });
 if (res.ok) {
 const result = await res.json();
 const successSet = new Set(result.success as string[]);
 setInvoices((prev) => prev.filter((inv) => !successSet.has(inv.id)));
 setSelectedIds(new Set());
 setToast({
 kind: "ok",
 text: `Approved ${result.success.length} invoice${result.success.length !== 1 ? "s" : ""}`,
 });
 setTimeout(() => setToast(null), 3500);
 } else {
 const err = await res.json().catch(() => ({}));
 setToast({ kind: "err", text: err.error ?? "Batch approve failed" });
 setTimeout(() => setToast(null), 4500);
 }
 } finally {
 setBatchProcessing(false);
 setShowApproveConfirm(false);
 }
 }, [approvalEligible]);

 const handleBatchHold = useCallback(async () => {
 if (!holdNote.trim()) return;
 setBatchProcessing(true);
 setShowHoldNoteModal(false);
 try {
 const res = await fetch("/api/invoices/batch-action", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ action: "hold", invoice_ids: Array.from(selectedIds), note: holdNote.trim() }),
 });
 if (res.ok) {
 const result = await res.json();
 const successSet = new Set(result.success as string[]);
 setInvoices((prev) => prev.filter((inv) => !successSet.has(inv.id)));
 setSelectedIds(new Set());
 setHoldNote("");
 setToast({
 kind: "ok",
 text: `Held ${result.success.length} invoice${result.success.length !== 1 ? "s" : ""}`,
 });
 setTimeout(() => setToast(null), 3500);
 }
 } finally {
 setBatchProcessing(false);
 }
 }, [selectedIds, holdNote]);

 const handleBatchDeny = useCallback(async () => {
 if (!denyNote.trim()) return;
 setBatchProcessing(true);
 setShowDenyNoteModal(false);
 try {
 const res = await fetch("/api/invoices/batch-action", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ action: "deny", invoice_ids: Array.from(selectedIds), note: denyNote.trim() }),
 });
 if (res.ok) {
 const result = await res.json();
 const successSet = new Set(result.success as string[]);
 setInvoices((prev) => prev.filter((inv) => !successSet.has(inv.id)));
 setSelectedIds(new Set());
 setDenyNote("");
 setToast({
 kind: "ok",
 text: `Denied ${result.success.length} invoice${result.success.length !== 1 ? "s" : ""}`,
 });
 setTimeout(() => setToast(null), 3500);
 }
 } finally {
 setBatchProcessing(false);
 }
 }, [selectedIds, denyNote]);

 // Selected total for batch bar.
 const selectedTotalCents = useMemo(() => {
 return filtered
 .filter((inv) => selectedIds.has(inv.id))
 .reduce((sum, inv) => sum + (inv.total_amount ?? 0), 0);
 }, [filtered, selectedIds]);

 return (
 <AppShell>

 <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
 <FinancialViewTabs active="queue" />
 <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
 <div>
 <span
 className="block mb-2 text-[10px] uppercase"
 style={{
 fontFamily: "var(--font-jetbrains-mono)",
 letterSpacing: "0.14em",
 color: "var(--text-tertiary)",
 }}
 >
 Financial · PM Queue
 </span>
 <h2
 className="m-0"
 style={{
 fontFamily: "var(--font-space-grotesk)",
 fontWeight: 500,
 fontSize: "30px",
 letterSpacing: "-0.02em",
 color: "var(--text-primary)",
 }}
 >
 PM Queue
 </h2>
 <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
 {isFiltered
 ? `Showing ${filtered.length} of ${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}`
 : `${filtered.length} invoice${filtered.length !== 1 ? "s" : ""} pending PM review`}
 </p>
 </div>
 </div>

 {loading ? (
 <SkeletonList rows={5} columns={["w-40", "w-32", "w-24", "w-24", "w-20"]} />
 ) : invoices.length === 0 ? (
 <EmptyState
 icon={<EmptyIcons.Check />}
 variant="success"
 title="You're all caught up!"
 message="No invoices waiting for PM review. Newly uploaded invoices will appear here."
 primaryAction={{ label: "Upload Invoices", href: "/invoices?action=upload" }}
 />
 ) : (
 <>
 {/* Primary filter row */}
 <div className="flex flex-col md:flex-row gap-3 mb-3">
 {/* Search */}
 <div className="relative flex-1">
 <svg
 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-dim"
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 strokeWidth={2}
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
 />
 </svg>
 <input
 type="text"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search vendor or invoice #..."
 className="w-full pl-9 pr-3 py-2.5 bg-brand-surface border border-brand-border text-sm text-cream placeholder-cream-dim focus:border-teal focus:outline-none"
 />
 {search && (
 <button
 onClick={() => setSearch("")}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-cream-dim hover:text-cream"
 >
 <svg
 className="w-4 h-4"
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 strokeWidth={2}
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 d="M6 18L18 6M6 6l12 12"
 />
 </svg>
 </button>
 )}
 </div>

 {/* Job dropdown */}
 <select
 value={jobFilter}
 onChange={(e) => setJobFilter(e.target.value)}
 className="px-3 py-2.5 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none md:w-48"
 >
 <option value="">All Jobs</option>
 {jobNames.map((name) => (
 <option key={name} value={name}>
 {name}
 </option>
 ))}
 </select>

 {/* PM dropdown */}
 <select
 value={pmFilter}
 onChange={(e) => setPmFilter(e.target.value)}
 className="px-3 py-2.5 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none md:w-48"
 >
 <option value="">All PMs</option>
 <option value="__unassigned__">Unassigned</option>
 {pmUsers.map((pm) => (
 <option key={pm.id} value={pm.id}>
 {pm.full_name}
 </option>
 ))}
 </select>

 {/* Confidence filter */}
 <select
 value={confidenceFilter}
 onChange={(e) =>
 setConfidenceFilter(e.target.value as ConfidenceFilter)
 }
 className="px-3 py-2.5 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none md:w-40"
 >
 <option value="all">All Confidence</option>
 <option value="high">High (&ge;85%)</option>
 <option value="medium">Medium (70-84%)</option>
 <option value="low">Low (&lt;70%)</option>
 </select>
 </div>

 {/* More Filters toggle + advanced filters */}
 <div className="mb-5">
 <div className="flex items-center gap-3">
 <button
 onClick={() => setShowMoreFilters((v) => !v)}
 className="flex items-center gap-1.5 px-3 py-2 text-sm text-cream-dim hover:text-cream border border-brand-border hover:border-brand-border-light transition-colors"
 >
 <svg
 className={`w-4 h-4 transition-transform ${showMoreFilters ? "rotate-180" : ""}`}
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 strokeWidth={2}
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 d="M19 9l-7 7-7-7"
 />
 </svg>
 More Filters
 {!showMoreFilters && advancedFilterCount > 0 && (
 <span className="ml-1 inline-flex items-center justify-center w-5 h-5 bg-teal/20 text-teal text-xs font-semibold">
 {advancedFilterCount}
 </span>
 )}
 </button>

 {/* Clear filters */}
 {isFiltered && (
 <button
 onClick={clearAllFilters}
 className="px-3 py-2 text-sm text-cream-dim hover:text-cream border border-brand-border hover:border-brand-border-light transition-colors whitespace-nowrap"
 >
 Clear filters
 </button>
 )}
 </div>

 {showMoreFilters && (
 <div className="flex flex-col md:flex-row gap-3 mt-3 pl-0 md:pl-0">
 {/* Status filter */}
 <select
 value={statusFilter}
 onChange={(e) =>
 setStatusFilter(e.target.value as StatusFilter)
 }
 className="px-3 py-2.5 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none md:w-44"
 >
 <option value="pending">Pending Review</option>
 <option value="needs_attention">Needs Attention</option>
 <option value="held">Held</option>
 <option value="denied">Denied</option>
 <option value="kicked_back">Kicked Back</option>
 <option value="info_requested">Info Requested</option>
 <option value="all">All Statuses</option>
 </select>

 {/* Amount range */}
 <select
 value={amountRange}
 onChange={(e) =>
 setAmountRange(e.target.value as AmountRange)
 }
 className="px-3 py-2.5 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none md:w-40"
 >
 <option value="all">All Amounts</option>
 <option value="0-5k">$0 - $5K</option>
 <option value="5k-25k">$5K - $25K</option>
 <option value="25k-100k">$25K - $100K</option>
 <option value="100k+">$100K+</option>
 </select>

 {/* Date range start */}
 <div className="flex items-center gap-2">
 <label className="text-xs text-cream-dim whitespace-nowrap">
 From
 </label>
 <input
 type="date"
 value={dateStart}
 onChange={(e) => setDateStart(e.target.value)}
 className="px-3 py-2.5 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none"
 />
 </div>

 {/* Date range end */}
 <div className="flex items-center gap-2">
 <label className="text-xs text-cream-dim whitespace-nowrap">
 To
 </label>
 <input
 type="date"
 value={dateEnd}
 onChange={(e) => setDateEnd(e.target.value)}
 className="px-3 py-2.5 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none"
 />
 </div>
 </div>
 )}
 </div>

 {/* No results after filtering */}
 {filtered.length === 0 && (
 <div className="text-center py-16 animate-fade-up">
 <p className="text-cream-muted text-sm">
 No invoices match your filters
 </p>
 <button
 onClick={clearAllFilters}
 className="mt-2 text-sm text-teal hover:text-teal-hover transition-colors"
 >
 Clear all filters
 </button>
 </div>
 )}

 {filtered.length > 0 && (
 <>
 {/* Mobile card layout */}
 <div className={`flex flex-col gap-3 md:hidden ${selectedIds.size > 0 ? "pb-20" : ""}`}>
 {filtered.map((inv, i) => (
 <div
 key={inv.id}
 className={`bg-brand-card border p-4 cursor-pointer active:opacity-80 transition-all duration-300 animate-fade-up ${selectedIds.has(inv.id) ? "border-teal/60 bg-teal/5" : "border-brand-border"} ${animatingOutIds.has(inv.id) ? "opacity-0 scale-95" : ""}`}
 style={{ animationDelay: `${0.05 + i * 0.03}s` }}
 onClick={() =>
 (window.location.href = `/invoices/${inv.id}`)
 }
 >
 <div className="flex items-start justify-between">
 <span className="text-cream font-medium text-base inline-flex items-center gap-2">
 {inv.vendor_name_raw ?? "Unknown"}
 {inv.document_type === "receipt" && (
 <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-transparent text-cream-dim border border-cream-dim/40 uppercase tracking-wide">Receipt</span>
 )}
 </span>
 <div className="flex items-center gap-2">
 <span className="text-cream font-display font-medium text-lg">
 {formatCents(inv.total_amount)}
 </span>
 {batchEnabled && (
 <label
 onClick={(e) => e.stopPropagation()}
 className="flex items-center justify-center w-11 h-11 -mr-2 -my-2 cursor-pointer"
 aria-label="Select invoice for batch action"
 >
 <input
 type="checkbox"
 checked={selectedIds.has(inv.id)}
 onChange={() => toggleSelect(inv.id)}
 className="w-5 h-5 accent-teal cursor-pointer"
 />
 </label>
 )}
 </div>
 </div>
 <div className="flex items-center justify-between mt-2">
 <div>
 {inv.jobs?.name ? (
 <span className="inline-flex items-center px-2 py-0.5 bg-transparent text-brass border border-brass text-xs font-medium">
 {inv.jobs.name}
 </span>
 ) : inv.document_category === "overhead" ? (
 <OverheadBadge />
 ) : (
 <span className="text-cream-dim text-xs">
 Unmatched
 </span>
 )}
 </div>
 <div className="flex items-center gap-2">
 <span
 className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border ${confidenceColor(inv.confidence_score)}`}
 >
 {Math.round(inv.confidence_score * 100)}%
 </span>
 {(() => {
 const d = daysAgo(inv.received_date);
 let badge: { label: string; style: React.CSSProperties } | null = null;
 if (d >= 90) badge = { label: "90d+", style: { backgroundColor: "#EF4444", color: "#FFFFFF", borderColor: "#DC2626" } };
 else if (d >= 61) badge = { label: "60d+", style: { backgroundColor: "#F97316", color: "#FFFFFF", borderColor: "#EA580C" } };
 else if (d >= 30) badge = { label: "30d+", style: { backgroundColor: "#EAB308", color: "#1F2937", borderColor: "#CA8A04" } };
 return (
 <>
 <span className={`text-sm font-medium ${d > 5 ? "text-status-danger" : d > 2 ? "text-brass" : "text-cream-dim"}`}>
 {d}d
 </span>
 {badge && (
 <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full border" style={badge.style}>
 {badge.label}
 </span>
 )}
 </>
 );
 })()}
 </div>
 </div>
 {/* PM name + invoice details */}
 <div className="flex items-center gap-2 mt-2 text-xs text-cream-muted">
 <span className={inv.assigned_pm ? "text-cream-muted" : "text-cream-dim"}>
 {inv.assigned_pm?.full_name ?? "Unassigned"}
 </span>
 {(inv.invoice_number || inv.invoice_date) && (
 <>
 <span>&middot;</span>
 {inv.invoice_number && (
 <span className="font-mono">
 #{inv.invoice_number}
 </span>
 )}
 {inv.invoice_number && inv.invoice_date && (
 <span>&middot;</span>
 )}
 {inv.invoice_date && <span>{formatDate(inv.invoice_date)}</span>}
 </>
 )}
 </div>
 <MissingDataBadges inv={inv} />
 {inv.status === "pm_held" && (
 <div className="mt-2">
 <span className="inline-flex items-center px-2 py-0.5 bg-transparent text-brass border border-brass text-xs font-medium">
 Held
 </span>
 </div>
 )}
 {inv.status === "pm_denied" && (
 <div className="mt-2">
 <span className="inline-flex items-center px-2 py-0.5 bg-transparent text-status-danger border border-status-danger text-xs font-medium">
 Denied
 </span>
 </div>
 )}
 {inv.status === "info_requested" && (
 <div className="mt-2">
 <span className="inline-flex items-center px-2 py-0.5 bg-transparent text-brass border border-brass text-xs font-medium">
 Info Requested
 </span>
 </div>
 )}
 {inv.is_potential_duplicate && !inv.duplicate_dismissed_at && (
 <div className="mt-2">
 <span className="inline-flex items-center px-2 py-0.5 bg-transparent text-brass border border-brass text-xs font-medium">
 Duplicate?
 </span>
 </div>
 )}
 {/* Quick Approve — mobile card */}
 {isQuickApproveEligible(inv) && (
 <div className="mt-3 pt-3 border-t border-brand-border/60">
 {quickApproveConfirmId === inv.id ? (
 <div
 className="flex items-center justify-between gap-2"
 onClick={(e) => e.stopPropagation()}
 >
 <span className="text-xs text-cream-dim truncate">
 Approve {inv.vendor_name_raw ?? "invoice"} {formatCents(inv.total_amount)}
 {inv.jobs?.name ? ` to ${inv.jobs.name}` : ""}?
 </span>
 <div className="flex gap-2 shrink-0">
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 setQuickApproveConfirmId(null);
 }}
 disabled={quickApproveProcessingId === inv.id}
 aria-label="Cancel quick approve"
 className="px-2 py-1 text-sm text-cream-dim border border-brand-border"
 >
 &#10007;
 </button>
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 handleQuickApprove(inv);
 }}
 disabled={quickApproveProcessingId === inv.id}
 aria-label="Confirm quick approve"
 className="px-2 py-1 text-sm font-medium bg-status-success text-white disabled:opacity-50"
 >
 {quickApproveProcessingId === inv.id ? "..." : "\u2713 Yes"}
 </button>
 </div>
 </div>
 ) : (
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 setQuickApproveConfirmId(inv.id);
 }}
 className="w-full px-3 py-2 text-sm font-medium bg-status-success text-white hover:bg-status-success/90 transition-colors"
 >
 Quick Approve
 </button>
 )}
 </div>
 )}
 </div>
 ))}
 </div>

 {/* Desktop table layout */}
 <div className={`hidden md:block overflow-x-auto border border-brand-border animate-fade-up ${selectedIds.size > 0 ? "mb-20" : ""}`}>
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-brand-surface text-left">
 {batchEnabled && (
 <th className="py-3 px-3 w-10">
 <input
 ref={selectAllRef}
 type="checkbox"
 checked={filtered.length > 0 && filtered.every((inv) => selectedIds.has(inv.id))}
 onChange={toggleSelectAll}
 className="w-4 h-4 accent-teal cursor-pointer"
 aria-label="Select all invoices"
 />
 </th>
 )}
 <th
 className="py-3 px-5 text-[10px] uppercase font-medium tracking-[0.14em] text-cream-dim cursor-pointer select-none hover:text-teal transition-colors"
 onClick={() => toggleSort("vendor")}
 >
 Vendor
 <SortArrow
 active={sortKey === "vendor"}
 dir={sortDir}
 />
 </th>
 <th className="py-3 px-5 text-[10px] uppercase font-medium tracking-[0.14em] text-cream-dim">
 Invoice #
 </th>
 <th
 className="py-3 px-5 text-[10px] uppercase font-medium tracking-[0.14em] text-cream-dim cursor-pointer select-none hover:text-teal transition-colors"
 onClick={() => toggleSort("date")}
 >
 Date
 <SortArrow
 active={sortKey === "date"}
 dir={sortDir}
 />
 </th>
 <th className="py-3 px-5 text-[10px] uppercase font-medium tracking-[0.14em] text-cream-dim">
 Job
 </th>
 <th
 className="py-3 px-5 text-[10px] uppercase font-medium tracking-[0.14em] text-cream-dim cursor-pointer select-none hover:text-teal transition-colors"
 onClick={() => toggleSort("pm")}
 >
 PM
 <SortArrow
 active={sortKey === "pm"}
 dir={sortDir}
 />
 </th>
 <th
 className="py-3 px-5 text-[10px] uppercase font-medium tracking-[0.14em] text-cream-dim text-right cursor-pointer select-none hover:text-teal transition-colors"
 onClick={() => toggleSort("amount")}
 >
 Amount
 <SortArrow
 active={sortKey === "amount"}
 dir={sortDir}
 />
 </th>
 <th
 className="py-3 px-5 text-[10px] uppercase font-medium tracking-[0.14em] text-cream-dim cursor-pointer select-none hover:text-teal transition-colors"
 onClick={() => toggleSort("confidence")}
 >
 Confidence
 <SortArrow
 active={sortKey === "confidence"}
 dir={sortDir}
 />
 </th>
 <th
 className="py-3 px-5 text-[10px] uppercase font-medium tracking-[0.14em] text-cream-dim text-right cursor-pointer select-none hover:text-teal transition-colors"
 onClick={() => toggleSort("waiting")}
 >
 Waiting
 <SortArrow
 active={sortKey === "waiting"}
 dir={sortDir}
 />
 </th>
 {quickApproveEnabled && <th className="py-3 px-5 w-40" />}
 </tr>
 </thead>
 <tbody>
 {filtered.map((inv) => (
 <tr
 key={inv.id}
 className={`border-t border-brand-row-border hover:bg-brand-elevated/50 cursor-pointer transition-all duration-300 ${selectedIds.has(inv.id) ? "bg-teal/5" : ""} ${animatingOutIds.has(inv.id) ? "opacity-0" : ""}`}
 onClick={() =>
 (window.location.href = `/invoices/${inv.id}`)
 }
 >
 {batchEnabled && (
 <td className="py-4 px-3 w-10">
 <input
 type="checkbox"
 checked={selectedIds.has(inv.id)}
 onChange={() => toggleSelect(inv.id)}
 onClick={(e) => e.stopPropagation()}
 className="w-4 h-4 accent-teal cursor-pointer"
 aria-label="Select invoice for batch action"
 />
 </td>
 )}
 <td className="py-4 px-5 text-cream font-medium">
 {inv.vendor_name_raw ?? "Unknown"}
 {inv.document_type === "receipt" && (
 <span className="ml-2 inline-flex items-center px-1.5 py-0.5 bg-transparent text-cream-dim border border-cream-dim/40 text-[10px] font-medium uppercase tracking-wide">Receipt</span>
 )}
 {inv.status === "pm_held" && (
 <span className="ml-2 inline-flex items-center px-1.5 py-0.5 bg-transparent text-brass border border-brass text-[10px] font-medium">
 Held
 </span>
 )}
 {inv.status === "pm_denied" && (
 <span className="ml-2 inline-flex items-center px-1.5 py-0.5 bg-transparent text-status-danger border border-status-danger text-[10px] font-medium">
 Denied
 </span>
 )}
 {inv.status === "info_requested" && (
 <span className="ml-2 inline-flex items-center px-1.5 py-0.5 bg-transparent text-brass border border-brass text-[10px] font-medium">
 Info Requested
 </span>
 )}
 {inv.is_potential_duplicate && !inv.duplicate_dismissed_at && (
 <span className="ml-2 inline-flex items-center px-1.5 py-0.5 bg-transparent text-brass border border-brass text-[10px] font-medium">
 Duplicate?
 </span>
 )}
 <MissingDataBadges inv={inv} />
 </td>
 <td className="py-4 px-5 text-cream-muted font-mono text-xs">
 {inv.invoice_number ?? (
 <span className="text-status-danger">No #</span>
 )}
 </td>
 <td className="py-4 px-5 text-cream-muted">
 {inv.invoice_date ? (
 formatDate(inv.invoice_date)
 ) : (
 <span className="text-status-danger">No Date</span>
 )}
 </td>
 <td className="py-4 px-5">
 {inv.jobs?.name ? (
 <span className="inline-flex items-center px-2 py-0.5 bg-transparent text-brass border border-brass text-xs font-medium">
 {inv.jobs.name}
 </span>
 ) : inv.document_category === "overhead" ? (
 <OverheadBadge />
 ) : (
 <span className="text-cream-dim">Unmatched</span>
 )}
 </td>
 <td className="py-4 px-5">
 <span
 className={
 inv.assigned_pm
 ? "text-cream-muted text-sm"
 : "text-cream-dim text-sm"
 }
 >
 {inv.assigned_pm?.full_name ?? "Unassigned"}
 </span>
 </td>
 <td className="py-4 px-5 text-cream text-right font-medium font-display">
 {formatCents(inv.total_amount)}
 </td>
 <td className="py-4 px-5">
 <span
 className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border ${confidenceColor(inv.confidence_score)}`}
 >
 {Math.round(inv.confidence_score * 100)}%
 </span>
 </td>
 <td className="py-4 px-5 text-right">
 {(() => {
 const d = daysAgo(inv.received_date);
 let badge: { label: string; style: React.CSSProperties } | null = null;
 if (d >= 90) badge = { label: "90d+", style: { backgroundColor: "#EF4444", color: "#FFFFFF", borderColor: "#DC2626" } };
 else if (d >= 61) badge = { label: "60d+", style: { backgroundColor: "#F97316", color: "#FFFFFF", borderColor: "#EA580C" } };
 else if (d >= 30) badge = { label: "30d+", style: { backgroundColor: "#EAB308", color: "#1F2937", borderColor: "#CA8A04" } };
 return (
 <div className="flex items-center justify-end gap-1.5">
 <span className={`text-sm font-medium ${d > 5 ? "text-status-danger" : d > 2 ? "text-brass" : "text-cream-dim"}`}>
 {d}d
 </span>
 {badge && (
 <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full border" style={badge.style}>
 {badge.label}
 </span>
 )}
 </div>
 );
 })()}
 </td>
 {quickApproveEnabled && (
 <td className="py-4 px-3 w-40" onClick={(e) => e.stopPropagation()}>
 {isQuickApproveEligible(inv) ? (
 quickApproveConfirmId === inv.id ? (
 <div className="flex gap-1 items-center justify-end">
 <button
 type="button"
 onClick={() => setQuickApproveConfirmId(null)}
 disabled={quickApproveProcessingId === inv.id}
 className="px-2 py-1 text-sm text-cream-dim border border-brand-border hover:text-cream"
 aria-label="Cancel quick approve"
 >
 &#10007;
 </button>
 <button
 type="button"
 onClick={() => handleQuickApprove(inv)}
 disabled={quickApproveProcessingId === inv.id}
 className="px-2 py-1 text-sm font-medium bg-status-success text-white disabled:opacity-50"
 aria-label="Confirm quick approve"
 >
 {quickApproveProcessingId === inv.id ? "..." : "\u2713 Yes"}
 </button>
 </div>
 ) : (
 <button
 type="button"
 onClick={() => setQuickApproveConfirmId(inv.id)}
 className="w-full px-3 py-1.5 text-xs font-medium bg-status-success text-white hover:bg-status-success/90 transition-colors"
 >
 Quick Approve
 </button>
 )
 ) : null}
 </td>
 )}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </>
 )}
 </>
 )}
 {/* Floating batch action bar */}
 {batchEnabled && selectedIds.size > 0 && (
 <div className="fixed bottom-0 left-0 right-0 z-50 bg-brand-surface/95 backdrop-blur-sm border-t border-brand-border px-4 py-3 animate-fade-up">
 <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
 <div className="flex items-baseline justify-between sm:justify-start gap-3">
 <span className="text-sm text-cream font-medium">
 {selectedIds.size} selected
 </span>
 <span className="text-xs text-cream-dim">
 Total: <span className="text-cream font-medium font-display">{formatCents(selectedTotalCents)}</span>
 </span>
 <button
 onClick={() => setSelectedIds(new Set())}
 className="sm:hidden text-xs text-cream-dim hover:text-cream underline underline-offset-2"
 >
 Clear
 </button>
 </div>
 <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-2">
 <button
 onClick={() => setSelectedIds(new Set())}
 className="hidden sm:inline-flex px-3 py-2 text-sm text-cream-dim hover:text-cream border border-brand-border hover:border-brand-border-light transition-colors items-center justify-center"
 >
 Clear Selection
 </button>
 <button
 onClick={() => { setHoldNote(""); setShowHoldNoteModal(true); }}
 disabled={batchProcessing}
 className="px-3 py-2.5 text-sm font-medium bg-brass text-brand-bg hover:bg-brass-hover transition-colors disabled:opacity-50"
 >
 <span className="sm:hidden">Hold</span>
 <span className="hidden sm:inline">Hold All</span>
 </button>
 <button
 onClick={() => { setDenyNote(""); setShowDenyNoteModal(true); }}
 disabled={batchProcessing}
 className="px-3 py-2.5 text-sm font-medium bg-status-danger text-white hover:bg-status-danger/90 transition-colors disabled:opacity-50"
 >
 <span className="sm:hidden">Deny</span>
 <span className="hidden sm:inline">Deny All</span>
 </button>
 <button
 onClick={handleBatchApprove}
 disabled={batchProcessing}
 className="px-3 py-2.5 text-sm font-medium bg-status-success text-white hover:bg-status-success/90 transition-colors disabled:opacity-50"
 >
 {batchProcessing ? "..." : <><span className="sm:hidden">Approve</span><span className="hidden sm:inline">Approve All</span></>}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Toast */}
 {toast && (
 <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] animate-fade-up">
 <div className={`px-5 py-3 border shadow-lg text-sm font-medium ${toast.kind === "ok" ? "bg-status-success text-white border-status-success" : "bg-status-danger text-white border-status-danger"}`}>
 {toast.text}
 </div>
 </div>
 )}

 {/* Hold Note Modal */}
 {showHoldNoteModal && (
 <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
 <div className="bg-brand-card border border-brand-border p-6 w-full max-w-md animate-fade-up">
 <h3 className="font-display text-lg text-cream mb-1">Batch Hold</h3>
 <p className="text-sm text-cream-dim mb-4">
 Hold {selectedIds.size} invoice{selectedIds.size !== 1 ? "s" : ""}. Add a note explaining why.
 </p>
 <textarea
 value={holdNote}
 onChange={(e) => setHoldNote(e.target.value)}
 placeholder="Add a note (required)..."
 className="w-full h-24 px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream placeholder-cream-dim focus:border-teal focus:outline-none resize-none"
 autoFocus
 />
 <div className="flex gap-2 mt-4">
 <button
 onClick={() => setShowHoldNoteModal(false)}
 className="flex-1 px-4 py-2.5 text-sm text-cream-dim border border-brand-border hover:text-cream hover:border-brand-border-light transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={handleBatchHold}
 disabled={!holdNote.trim() || batchProcessing}
 className="flex-1 px-4 py-2.5 text-sm font-medium bg-brass text-brand-bg hover:bg-brass-hover transition-colors disabled:opacity-50"
 >
 Hold
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Deny Note Modal */}
 {showDenyNoteModal && (
 <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
 <div className="bg-brand-card border border-brand-border p-6 w-full max-w-md animate-fade-up">
 <h3 className="font-display text-lg text-cream mb-1">Batch Deny</h3>
 <p className="text-sm text-cream-dim mb-4">
 Deny {selectedIds.size} invoice{selectedIds.size !== 1 ? "s" : ""}. A reason is required and will apply to each.
 </p>
 <textarea
 value={denyNote}
 onChange={(e) => setDenyNote(e.target.value)}
 placeholder="Reason for denial (required)..."
 className="w-full h-24 px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream placeholder-cream-dim focus:border-teal focus:outline-none resize-none"
 autoFocus
 />
 <div className="flex gap-2 mt-4">
 <button
 onClick={() => setShowDenyNoteModal(false)}
 className="flex-1 px-4 py-2.5 text-sm text-cream-dim border border-brand-border hover:text-cream hover:border-brand-border-light transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={handleBatchDeny}
 disabled={!denyNote.trim() || batchProcessing}
 className="flex-1 px-4 py-2.5 text-sm font-medium bg-status-danger text-white hover:bg-status-danger/90 transition-colors disabled:opacity-50"
 >
 Deny
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Approve Confirmation Modal */}
 {showApproveConfirm && (
 <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
 <div className="bg-brand-card border border-brand-border p-6 w-full max-w-xl animate-fade-up">
 <h3 className="font-display text-lg text-cream mb-1">
 {approvalExcluded.length === 0
 ? `Approve ${approvalEligible.length} invoice${approvalEligible.length !== 1 ? "s" : ""}?`
 : `${approvalEligible.length} of ${approvalEligible.length + approvalExcluded.length} invoices can be batch approved`}
 </h3>
 <p className="text-sm text-cream-dim mb-4">
 {approvalEligible.length > 0 && (
 <>Total: <span className="text-cream font-display font-medium">{formatCents(approvalEligible.reduce((s, i) => s + i.total_amount, 0))}</span></>
 )}
 </p>

 {approvalEligible.length > 0 && (
 <div className="mb-4">
 <div className="text-[11px] tracking-[0.08em] uppercase text-cream-dim mb-2">Will be approved</div>
 <div className="max-h-48 overflow-y-auto space-y-1.5">
 {approvalEligible.map((inv) => (
 <div key={inv.id} className="flex items-center justify-between px-3 py-2 bg-brand-surface border border-brand-border text-sm">
 <div className="min-w-0 truncate">
 <span className="text-cream">{inv.vendor_name_raw ?? "Unknown"}</span>
 {inv.jobs?.name && (
 <span className="ml-2 text-cream-dim text-xs">{inv.jobs.name}</span>
 )}
 </div>
 <span className="text-cream font-display ml-2 shrink-0">{formatCents(inv.total_amount)}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {approvalExcluded.length > 0 && (
 <div className="mb-4">
 <div className="text-[11px] tracking-[0.08em] uppercase text-status-danger mb-2">
 Excluded from batch ({approvalExcluded.length})
 </div>
 <div className="max-h-48 overflow-y-auto space-y-1.5">
 {approvalExcluded.map(({ invoice, reasons }) => (
 <div key={invoice.id} className="px-3 py-2 bg-status-danger-muted border border-status-danger/40 text-sm">
 <div className="flex items-center justify-between gap-2">
 <span className="text-cream truncate">{invoice.vendor_name_raw ?? "Unknown"}</span>
 <span className="text-cream-dim font-display text-xs shrink-0">{formatCents(invoice.total_amount)}</span>
 </div>
 <div className="text-xs text-status-danger mt-1">
 {reasons.join(" · ")}
 </div>
 </div>
 ))}
 </div>
 <p className="text-xs text-cream-dim mt-2">
 Open these invoices individually to fix the issues, then try again.
 </p>
 </div>
 )}

 <div className="flex gap-2 mt-4">
 <button
 onClick={() => setShowApproveConfirm(false)}
 className="flex-1 px-4 py-2.5 text-sm text-cream-dim border border-brand-border hover:text-cream hover:border-brand-border-light transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={confirmBatchApprove}
 disabled={approvalEligible.length === 0 || batchProcessing}
 className="flex-1 px-4 py-2.5 text-sm font-medium bg-status-success text-white hover:bg-status-success/90 transition-colors disabled:opacity-50"
 >
 {batchProcessing
 ? "Processing..."
 : approvalEligible.length > 0
 ? `Approve ${approvalEligible.length} invoice${approvalEligible.length !== 1 ? "s" : ""}`
 : "Nothing to approve"}
 </button>
 </div>
 </div>
 </div>
 )}
 </main>
 </AppShell>
 );
}
