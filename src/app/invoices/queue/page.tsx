"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatCents, confidenceColor, daysAgo, formatDate } from "@/lib/utils/format";
import NavBar from "@/components/nav-bar";

interface QueueInvoice {
 id: string;
 vendor_name_raw: string | null;
 invoice_number: string | null;
 invoice_date: string | null;
 total_amount: number;
 confidence_score: number;
 received_date: string;
 status: string;
 job_id: string | null;
 cost_code_id: string | null;
 document_category: string | null;
 jobs: { name: string } | null;
 assigned_pm: { id: string; full_name: string } | null;
}

interface PmUser {
 id: string;
 full_name: string;
}

type SortKey = "vendor" | "date" | "amount" | "confidence" | "waiting" | "pm";
type SortDir = "asc" | "desc";
type ConfidenceFilter = "all" | "high" | "medium" | "low";
type StatusFilter = "pending" | "held" | "denied" | "kicked_back" | "info_requested" | "all";
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
 const [showMissingModal, setShowMissingModal] = useState(false);
 const [missingInvoices, setMissingInvoices] = useState<QueueInvoice[]>([]);
 const selectAllRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
 async function fetchData() {
 const {
 data: { user },
 } = await supabase.auth.getUser();

 let role: "admin" | "pm" | "accounting" | null = null;
 if (user) {
 setCurrentUserId(user.id);
 const { data: profile } = await supabase
 .from("profiles")
 .select("role")
 .eq("id", user.id)
 .single();
 role = (profile?.role as typeof role) ?? null;
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

 const [invoiceResult, pmResult] = await Promise.all([
 supabase
 .from("invoices")
 .select(
 "id, vendor_name_raw, invoice_number, invoice_date, total_amount, confidence_score, received_date, status, job_id, cost_code_id, document_category, jobs:job_id (name), assigned_pm:assigned_pm_id (id, full_name)"
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
 ]);

 if (!invoiceResult.error && invoiceResult.data) {
 setInvoices(invoiceResult.data as unknown as QueueInvoice[]);
 }
 if (!pmResult.error && pmResult.data) {
 setPmUsers(pmResult.data as PmUser[]);
 }
 setLoading(false);
 }
 fetchData();
 }, []);

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

 const handleBatchApprove = useCallback(async () => {
 // Check for invoices missing job_id or cost_code_id
 const selected = filtered.filter((inv) => selectedIds.has(inv.id));
 const missing = selected.filter((inv) => !inv.job_id || !inv.cost_code_id);
 if (missing.length > 0) {
 setMissingInvoices(missing);
 setShowMissingModal(true);
 return;
 }

 setBatchProcessing(true);
 try {
 const res = await fetch("/api/invoices/batch-action", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ action: "approve", invoice_ids: Array.from(selectedIds) }),
 });
 if (res.ok) {
 const result = await res.json();
 const successSet = new Set(result.success as string[]);
 setInvoices((prev) => prev.filter((inv) => !successSet.has(inv.id)));
 setSelectedIds(new Set());
 }
 } finally {
 setBatchProcessing(false);
 }
 }, [filtered, selectedIds]);

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
 }
 } finally {
 setBatchProcessing(false);
 }
 }, [selectedIds, holdNote]);

 return (
 <div className="min-h-screen">
 <NavBar />

 <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
 <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
 <div>
 <h2 className="font-display text-2xl text-cream">PM Queue</h2>
 <p className="text-sm text-cream-dim mt-1">
 {isFiltered
 ? `Showing ${filtered.length} of ${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}`
 : `${filtered.length} invoice${filtered.length !== 1 ? "s" : ""} pending PM review`}
 </p>
 </div>
 </div>

 {loading ? (
 <div className="text-center py-20">
 <div className="w-8 h-8 border-2 border-teal/30 border-t-teal animate-spin mx-auto" />
 <p className="mt-4 text-cream-dim text-sm">Loading queue...</p>
 </div>
 ) : invoices.length === 0 ? (
 <div className="text-center py-20 animate-fade-up">
 <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-surface border border-brand-border mb-6">
 <svg
 className="w-7 h-7 text-cream-dim"
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 strokeWidth={1.5}
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
 />
 </svg>
 </div>
 <p className="text-cream text-lg font-display">All clear</p>
 <p className="text-cream-dim text-sm mt-1">
 No invoices pending review
 </p>
 </div>
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
 className={`bg-brand-card border p-4 cursor-pointer active:opacity-80 transition-opacity animate-fade-up ${selectedIds.has(inv.id) ? "border-teal/60 bg-teal/5" : "border-brand-border"}`}
 style={{ animationDelay: `${0.05 + i * 0.03}s` }}
 onClick={() =>
 (window.location.href = `/invoices/${inv.id}`)
 }
 >
 <div className="flex items-start justify-between">
 <span className="text-cream font-medium text-base">
 {inv.vendor_name_raw ?? "Unknown"}
 </span>
 <div className="flex items-center gap-2">
 <span className="text-cream font-display font-medium text-lg">
 {formatCents(inv.total_amount)}
 </span>
 <input
 type="checkbox"
 checked={selectedIds.has(inv.id)}
 onChange={() => toggleSelect(inv.id)}
 onClick={(e) => e.stopPropagation()}
 className="w-4 h-4 accent-teal cursor-pointer"
 />
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
 return (
 <span
 className={`text-sm font-medium ${d > 5 ? "text-status-danger" : d > 2 ? "text-brass" : "text-cream-dim"}`}
 >
 {d}d
 </span>
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
 </div>
 ))}
 </div>

 {/* Desktop table layout */}
 <div className={`hidden md:block overflow-x-auto border border-brand-border animate-fade-up ${selectedIds.size > 0 ? "mb-20" : ""}`}>
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-brand-surface text-left">
 <th className="py-3 px-3 w-10">
 <input
 ref={selectAllRef}
 type="checkbox"
 checked={filtered.length > 0 && filtered.every((inv) => selectedIds.has(inv.id))}
 onChange={toggleSelectAll}
 className="w-4 h-4 accent-teal cursor-pointer"
 />
 </th>
 <th
 className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider cursor-pointer select-none hover:text-teal transition-colors"
 onClick={() => toggleSort("vendor")}
 >
 Vendor
 <SortArrow
 active={sortKey === "vendor"}
 dir={sortDir}
 />
 </th>
 <th className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider">
 Invoice #
 </th>
 <th
 className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider cursor-pointer select-none hover:text-teal transition-colors"
 onClick={() => toggleSort("date")}
 >
 Date
 <SortArrow
 active={sortKey === "date"}
 dir={sortDir}
 />
 </th>
 <th className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider">
 Job
 </th>
 <th
 className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider cursor-pointer select-none hover:text-teal transition-colors"
 onClick={() => toggleSort("pm")}
 >
 PM
 <SortArrow
 active={sortKey === "pm"}
 dir={sortDir}
 />
 </th>
 <th
 className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider text-right cursor-pointer select-none hover:text-teal transition-colors"
 onClick={() => toggleSort("amount")}
 >
 Amount
 <SortArrow
 active={sortKey === "amount"}
 dir={sortDir}
 />
 </th>
 <th
 className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider cursor-pointer select-none hover:text-teal transition-colors"
 onClick={() => toggleSort("confidence")}
 >
 Confidence
 <SortArrow
 active={sortKey === "confidence"}
 dir={sortDir}
 />
 </th>
 <th
 className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider text-right cursor-pointer select-none hover:text-teal transition-colors"
 onClick={() => toggleSort("waiting")}
 >
 Waiting
 <SortArrow
 active={sortKey === "waiting"}
 dir={sortDir}
 />
 </th>
 </tr>
 </thead>
 <tbody>
 {filtered.map((inv) => (
 <tr
 key={inv.id}
 className={`border-t border-brand-row-border hover:bg-brand-elevated/50 cursor-pointer transition-colors ${selectedIds.has(inv.id) ? "bg-teal/5" : ""}`}
 onClick={() =>
 (window.location.href = `/invoices/${inv.id}`)
 }
 >
 <td className="py-4 px-3 w-10">
 <input
 type="checkbox"
 checked={selectedIds.has(inv.id)}
 onChange={() => toggleSelect(inv.id)}
 onClick={(e) => e.stopPropagation()}
 className="w-4 h-4 accent-teal cursor-pointer"
 />
 </td>
 <td className="py-4 px-5 text-cream font-medium">
 {inv.vendor_name_raw ?? "Unknown"}
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
 </td>
 <td className="py-4 px-5 text-cream-muted font-mono text-xs">
 {inv.invoice_number ?? (
 <span className="text-cream-dim">&mdash;</span>
 )}
 </td>
 <td className="py-4 px-5 text-cream-muted">
 {formatDate(inv.invoice_date)}
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
 return (
 <span
 className={`text-sm font-medium ${d > 5 ? "text-status-danger" : d > 2 ? "text-brass" : "text-cream-dim"}`}
 >
 {d}d
 </span>
 );
 })()}
 </td>
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
 {selectedIds.size > 0 && (
 <div className="fixed bottom-0 left-0 right-0 z-50 bg-brand-surface/95 backdrop-blur-sm border-t border-brand-border px-4 py-3 animate-fade-up">
 <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3">
 <span className="text-sm text-cream font-medium">
 {selectedIds.size} invoice{selectedIds.size !== 1 ? "s" : ""} selected
 </span>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setSelectedIds(new Set())}
 className="px-3 py-2 text-sm text-cream-dim hover:text-cream border border-brand-border hover:border-brand-border-light transition-colors"
 >
 Clear
 </button>
 <button
 onClick={() => { setHoldNote(""); setShowHoldNoteModal(true); }}
 disabled={batchProcessing}
 className="px-4 py-2 text-sm font-medium bg-brass text-brand-bg hover:bg-brass-hover transition-colors disabled:opacity-50"
 >
 Batch Hold
 </button>
 <button
 onClick={handleBatchApprove}
 disabled={batchProcessing}
 className="px-4 py-2 text-sm font-medium bg-status-success text-white hover:bg-status-success/90 transition-colors disabled:opacity-50"
 >
 {batchProcessing ? "Processing..." : "Batch Approve"}
 </button>
 </div>
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

 {/* Missing Fields Modal */}
 {showMissingModal && (
 <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
 <div className="bg-brand-card border border-brand-border p-6 w-full max-w-lg animate-fade-up">
 <h3 className="font-display text-lg text-cream mb-1">Cannot Batch Approve</h3>
 <p className="text-sm text-cream-dim mb-4">
 The following invoice{missingInvoices.length !== 1 ? "s need" : " needs"} a job and cost code assigned before approval:
 </p>
 <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
 {missingInvoices.map((inv) => (
 <div key={inv.id} className="flex items-center justify-between px-3 py-2 bg-brand-surface border border-brand-border">
 <div>
 <span className="text-sm text-cream">{inv.vendor_name_raw ?? "Unknown"}</span>
 {inv.invoice_number && (
 <span className="ml-2 text-xs text-cream-dim font-mono">#{inv.invoice_number}</span>
 )}
 </div>
 <div className="flex items-center gap-1.5 text-[10px]">
 {!inv.job_id && (
 <span className="px-1.5 py-0.5 bg-transparent text-status-danger border border-status-danger">No Job</span>
 )}
 {!inv.cost_code_id && (
 <span className="px-1.5 py-0.5 bg-transparent text-status-danger border border-status-danger">No Cost Code</span>
 )}
 </div>
 </div>
 ))}
 </div>
 <p className="text-xs text-cream-dim mb-4">
 Open each invoice individually to assign the missing fields, then try batch approve again.
 </p>
 <button
 onClick={() => { setShowMissingModal(false); setMissingInvoices([]); }}
 className="w-full px-4 py-2.5 text-sm font-medium text-cream border border-brand-border hover:border-brand-border-light transition-colors"
 >
 Got it
 </button>
 </div>
 </div>
 )}
 </main>
 </div>
 );
}
