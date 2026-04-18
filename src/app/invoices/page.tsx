"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatStatus, formatDate, statusBadgeOutline } from "@/lib/utils/format";
import AppShell from "@/components/app-shell";
import FinancialViewTabs from "@/components/financial-view-tabs";
import InvoiceUploadModal from "@/components/invoice-upload-modal";
import InvoiceImportModal from "@/components/invoice-import-modal";
import EmptyState, { EmptyIcons } from "@/components/empty-state";
import { SkeletonList, SkeletonStatCard } from "@/components/loading-skeleton";

interface Invoice {
 id: string;
 vendor_name_raw: string | null;
 vendor_id: string | null;
 invoice_number: string | null;
 invoice_date: string | null;
 total_amount: number;
 confidence_score: number;
 received_date: string;
 payment_date: string | null;
 status: string;
 check_number: string | null;
 picked_up: boolean;
 mailed_date: string | null;
 document_category: string | null;
 document_type: string | null;
 is_change_order: boolean;
 parent_invoice_id: string | null;
 partial_approval_note: string | null;
 payment_status: string | null;
 jobs: { name: string } | null;
 cost_codes: { code: string; description: string } | null;
 assigned_pm: { id: string; full_name: string } | null;
 /** Set by client after fetching per-invoice line-item splits. */
 line_item_cost_codes?: string[];
}

function isUnknownVendor(inv: Pick<Invoice, "vendor_id" | "vendor_name_raw">): boolean {
 if (!inv.vendor_id) return true;
 const name = (inv.vendor_name_raw ?? "").trim().toLowerCase();
 return name === "unknown" || name === "";
}

interface PmUser { id: string; full_name: string; }

type SortKey = "vendor" | "date" | "amount" | "status" | "pm" | "aging";

/** Days since `received_date` (rounded, non-negative). */
function daysOutstanding(receivedDate: string | null): number {
  if (!receivedDate) return 0;
  const d = new Date(receivedDate);
  if (isNaN(d.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

/** Returns { label, color } for aging badge, or null if not overdue enough.
 *  Rounded-pill styling matching confidence badges. Explicit RGB for visibility. */
function agingBadge(days: number): { label: string; style: React.CSSProperties; title: string } | null {
  if (days >= 90) {
    return {
      label: "90d+",
      // red #EF4444
      style: {
        backgroundColor: "#EF4444",
        color: "#FFFFFF",
        borderColor: "#DC2626",
      },
      title: `Outstanding for ${days} days (90+)`,
    };
  }
  if (days >= 61) {
    return {
      label: "60d+",
      // orange #F97316
      style: {
        backgroundColor: "#F97316",
        color: "#FFFFFF",
        borderColor: "#EA580C",
      },
      title: `Outstanding for ${days} days (61-90)`,
    };
  }
  if (days >= 30) {
    return {
      label: "30d+",
      // yellow #EAB308
      style: {
        backgroundColor: "#EAB308",
        color: "#1F2937",
        borderColor: "#CA8A04",
      },
      title: `Outstanding for ${days} days (30-60)`,
    };
  }
  return null;
}

/** True when invoice is unpaid — aging applies only to unpaid invoices.
 *  Paid by either the workflow status OR the payment_status column counts as
 *  paid (the two can drift if the user doesn't mark payment_status). Voided
 *  invoices never age. */
function isUnpaidInvoice(inv: { payment_status: string | null; status: string }): boolean {
  if (inv.payment_status === "paid") return false;
  if (inv.status === "paid") return false;
  if (inv.status === "void") return false;
  return true;
}
type SortDir = "asc" | "desc";
type ConfidenceFilter = "all" | "high" | "medium" | "low";
type AmountRange = "all" | "0-5k" | "5k-25k" | "25k-100k" | "100k+";

const ALL_STATUSES = [
 "received", "ai_processed", "pm_review", "pm_approved", "pm_held", "pm_denied",
 "qa_review", "qa_approved", "qa_kicked_back", "pushed_to_qb", "qb_failed",
 "in_draw", "paid", "void",
];

const statusBadgeColor = statusBadgeOutline;

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
 if (!active) return <span className="ml-1 text-tertiary">↕</span>;
 return <span className="ml-1 text-stone-blue">{dir === "asc" ? "↑" : "↓"}</span>;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
 return (
 <div className="bg-white border border-border-def px-4 py-3">
 <p className="text-[11px] font-medium text-tertiary uppercase tracking-wider">{label}</p>
 <p className="text-xl font-display font-medium text-slate-tile mt-1">{value}</p>
 {sub && <p className="text-xs text-tertiary mt-0.5">{sub}</p>}
 </div>
 );
}

export default function AllInvoicesPage() {
 const searchParams = useSearchParams();
 const router = useRouter();
 const [invoices, setInvoices] = useState<Invoice[]>([]);
 const [pmUsers, setPmUsers] = useState<PmUser[]>([]);
 const [loading, setLoading] = useState(true);
 const [uploadOpen, setUploadOpen] = useState(searchParams.get("action") === "upload");
 const [importOpen, setImportOpen] = useState(searchParams.get("action") === "import");

 // Tabs
 const [activeTab, setActiveTab] = useState<"all" | "payment">("all");

 // Inline editing for payment tracking
 const [editingCheckId, setEditingCheckId] = useState<string | null>(null);
 const [editingCheckValue, setEditingCheckValue] = useState("");
 const [savingInline, setSavingInline] = useState<string | null>(null);

 // Filters
 const [search, setSearch] = useState("");
 const [jobFilter, setJobFilter] = useState("");
 const [pmFilter, setPmFilter] = useState("");
 const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");

 // Advanced
 const [showMoreFilters, setShowMoreFilters] = useState(false);
 const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
 const [amountRange, setAmountRange] = useState<AmountRange>("all");
 const [dateStart, setDateStart] = useState("");
 const [dateEnd, setDateEnd] = useState("");

 // Sort
 const [sortKey, setSortKey] = useState<SortKey>("date");
 const [sortDir, setSortDir] = useState<SortDir>("desc");

 useEffect(() => {
 async function fetchData() {
 // Try with partial-approval columns first (migration 00015). Fall back if
 // the columns don't exist yet so the page still renders.
 const INVOICES_FULL = "id, vendor_name_raw, vendor_id, invoice_number, invoice_date, total_amount, confidence_score, received_date, payment_date, status, check_number, picked_up, mailed_date, document_category, document_type, is_change_order, parent_invoice_id, partial_approval_note, payment_status, jobs:job_id (name), cost_codes:cost_code_id (code, description), assigned_pm:assigned_pm_id (id, full_name)";
 const INVOICES_MINIMAL = "id, vendor_name_raw, vendor_id, invoice_number, invoice_date, total_amount, confidence_score, received_date, payment_date, status, check_number, picked_up, mailed_date, document_category, document_type, is_change_order, payment_status, jobs:job_id (name), cost_codes:cost_code_id (code, description), assigned_pm:assigned_pm_id (id, full_name)";
 // Parallel: invoices + PMs. Line items fetched in a second pass with
 // an IN filter so we don't scan every line item in the org.
 const [invResult, pmResult] = await Promise.all([
 supabase
 .from("invoices")
 .select(INVOICES_FULL)
 .is("deleted_at", null)
 .order("created_at", { ascending: false })
 .limit(500)
 .then(async (r) => {
 if (r.error && /parent_invoice_id|partial_approval_note/i.test(r.error.message)) {
 return await supabase
 .from("invoices")
 .select(INVOICES_MINIMAL)
 .is("deleted_at", null)
 .order("created_at", { ascending: false })
 .limit(500);
 }
 return r;
 }),
 supabase
 .from("users")
 .select("id, full_name")
 .in("role", ["pm", "admin"])
 .is("deleted_at", null)
 .order("full_name"),
 ]);

 // Build invoice_id → list of unique cost code strings — only for visible invoices
 const lineItemCodesByInvoice = new Map<string, Set<string>>();
 const invoiceIds = (invResult.data as unknown as Array<{ id: string }> | null)?.map((i) => i.id) ?? [];
 if (invoiceIds.length > 0) {
 const { data: lineItems } = await supabase
 .from("invoice_line_items")
 .select("invoice_id, cost_code_id, cost_codes:cost_code_id(code)")
 .in("invoice_id", invoiceIds)
 .is("deleted_at", null);
 for (const li of lineItems ?? []) {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const cc = (li as any).cost_codes;
 const code = Array.isArray(cc) ? cc[0]?.code : cc?.code;
 if (!code) continue;
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const invId = (li as any).invoice_id as string;
 if (!lineItemCodesByInvoice.has(invId)) lineItemCodesByInvoice.set(invId, new Set());
 lineItemCodesByInvoice.get(invId)!.add(code);
 }
 }

 if (!invResult.error && invResult.data) {
 const enriched = (invResult.data as unknown as Invoice[]).map(inv => ({
 ...inv,
 line_item_cost_codes: Array.from(lineItemCodesByInvoice.get(inv.id) ?? []),
 }));
 setInvoices(enriched);
 }
 if (!pmResult.error && pmResult.data) setPmUsers(pmResult.data as PmUser[]);
 setLoading(false);
 }
 fetchData();
 }, []);

 // Unique job names
 const jobNames = useMemo(() => {
 const names = new Set<string>();
 invoices.forEach(inv => { if (inv.jobs?.name) names.add(inv.jobs.name); });
 return Array.from(names).sort();
 }, [invoices]);

 // Stats
 const stats = useMemo(() => {
 const total = invoices.length;
 const totalValue = invoices.reduce((s, inv) => s + inv.total_amount, 0);
 const pending = invoices.filter(inv => ["pm_review", "ai_processed", "received"].includes(inv.status)).length;
 const approved = invoices.filter(inv => ["pm_approved", "qa_review", "qa_approved", "pushed_to_qb"].includes(inv.status)).length;
 const inDraw = invoices.filter(inv => inv.status === "in_draw").length;
 const paid = invoices.filter(inv => inv.status === "paid").length;
 return { total, totalValue, pending, approved, inDraw, paid };
 }, [invoices]);

 // Advanced filter count
 const advancedFilterCount = useMemo(() => {
 let count = 0;
 if (statusFilters.size > 0) count++;
 if (amountRange !== "all") count++;
 if (dateStart || dateEnd) count++;
 return count;
 }, [statusFilters, amountRange, dateStart, dateEnd]);

 // Filter + sort
 const filtered = useMemo(() => {
 let result = invoices;

 if (search.trim()) {
 const q = search.toLowerCase();
 result = result.filter(inv =>
 (inv.vendor_name_raw ?? "").toLowerCase().includes(q) ||
 (inv.invoice_number ?? "").toLowerCase().includes(q)
 );
 }
 if (jobFilter) result = result.filter(inv => inv.jobs?.name === jobFilter);
 if (pmFilter) {
 if (pmFilter === "__unassigned__") result = result.filter(inv => !inv.assigned_pm);
 else result = result.filter(inv => inv.assigned_pm?.id === pmFilter);
 }
 if (confidenceFilter !== "all") {
 result = result.filter(inv => {
 const s = inv.confidence_score;
 if (confidenceFilter === "high") return s >= 0.85;
 if (confidenceFilter === "medium") return s >= 0.70 && s < 0.85;
 return s < 0.70;
 });
 }
 if (statusFilters.size > 0) result = result.filter(inv => statusFilters.has(inv.status));
 if (amountRange !== "all") {
 result = result.filter(inv => {
 const amt = inv.total_amount;
 switch (amountRange) {
 case "0-5k": return amt < 500000;
 case "5k-25k": return amt >= 500000 && amt < 2500000;
 case "25k-100k": return amt >= 2500000 && amt < 10000000;
 case "100k+": return amt >= 10000000;
 default: return true;
 }
 });
 }
 if (dateStart) result = result.filter(inv => (inv.invoice_date ?? "") >= dateStart);
 if (dateEnd) result = result.filter(inv => (inv.invoice_date ?? "") <= dateEnd);

 return [...result].sort((a, b) => {
 let cmp = 0;
 switch (sortKey) {
 case "vendor": cmp = (a.vendor_name_raw ?? "").localeCompare(b.vendor_name_raw ?? ""); break;
 case "date": cmp = (a.invoice_date ?? "").localeCompare(b.invoice_date ?? ""); break;
 case "amount": cmp = a.total_amount - b.total_amount; break;
 case "status": cmp = a.status.localeCompare(b.status); break;
 case "pm": cmp = (a.assigned_pm?.full_name ?? "").localeCompare(b.assigned_pm?.full_name ?? ""); break;
 case "aging": cmp = daysOutstanding(a.received_date) - daysOutstanding(b.received_date); break;
 }
 return sortDir === "asc" ? cmp : -cmp;
 });
 }, [invoices, search, jobFilter, pmFilter, confidenceFilter, statusFilters, amountRange, dateStart, dateEnd, sortKey, sortDir]);

 const toggleSort = (key: SortKey) => {
 if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
 else { setSortKey(key); setSortDir(key === "vendor" || key === "pm" ? "asc" : "desc"); }
 };

 const toggleStatus = (s: string) => {
 setStatusFilters(prev => {
 const next = new Set(prev);
 if (next.has(s)) next.delete(s); else next.add(s);
 return next;
 });
 };

 const isFiltered = search.trim() !== "" || jobFilter !== "" || pmFilter !== "" || confidenceFilter !== "all" || statusFilters.size > 0 || amountRange !== "all" || dateStart !== "" || dateEnd !== "";

 const clearAllFilters = () => { setSearch(""); setJobFilter(""); setPmFilter(""); setConfidenceFilter("all"); setStatusFilters(new Set()); setAmountRange("all"); setDateStart(""); setDateEnd(""); };

 // Payment tracking: filtered and grouped by payment_date
 const PAYMENT_STATUSES = ["qa_approved", "pushed_to_qb", "in_draw", "paid"];
 const paymentInvoices = useMemo(() => {
 return invoices.filter(inv => PAYMENT_STATUSES.includes(inv.status))
 .sort((a, b) => (a.payment_date ?? "").localeCompare(b.payment_date ?? ""));
 }, [invoices]);

 const paymentGroups = useMemo(() => {
 const groups: Record<string, Invoice[]> = {};
 paymentInvoices.forEach(inv => {
 const key = inv.payment_date ?? "No Date";
 if (!groups[key]) groups[key] = [];
 groups[key].push(inv);
 });
 return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
 }, [paymentInvoices]);

 const handleInlineCheckSave = async (invoiceId: string, value: string) => {
 setSavingInline(invoiceId);
 const res = await fetch(`/api/invoices/${invoiceId}`, {
 method: "PATCH", headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ check_number: value.trim() || null }),
 });
 if (res.ok) {
 setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, check_number: value.trim() || null } : inv));
 }
 setSavingInline(null);
 setEditingCheckId(null);
 };

 const handleInlinePickedUpToggle = async (invoiceId: string, current: boolean) => {
 setSavingInline(invoiceId);
 const res = await fetch(`/api/invoices/${invoiceId}`, {
 method: "PATCH", headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ picked_up: !current }),
 });
 if (res.ok) {
 setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, picked_up: !current } : inv));
 }
 setSavingInline(null);
 };

 return (
 <AppShell>
 <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
 <FinancialViewTabs active="invoices" />
 <div className="flex items-center justify-between mb-6">
 <div>
 <h2 className="font-display text-2xl text-slate-tile">Invoices</h2>
 <p className="text-sm text-tertiary mt-1">
 {activeTab === "all"
 ? (isFiltered ? `Showing ${filtered.length} of ${invoices.length} invoices` : `${invoices.length} total invoices`)
 : `${paymentInvoices.length} invoices ready for payment`}
 </p>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setImportOpen(true)}
 className="px-4 py-2 border border-border-def text-tertiary hover:text-slate-tile hover:bg-bg-sub text-sm font-medium transition-colors flex items-center gap-2"
 >
 Import CSV
 </button>
 <button
 onClick={() => setUploadOpen(true)}
 className="px-4 py-2 bg-slate-deep hover:bg-slate-deeper text-brand-bg text-sm font-medium transition-colors flex items-center gap-2"
 >
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
 </svg>
 Upload Invoice
 </button>
 </div>
 </div>

 {/* Tabs */}
 <div className="flex gap-1 mb-6 bg-bg-sub border border-border-def p-1 w-fit">
 <button
 onClick={() => setActiveTab("all")}
 className={`px-4 py-2 text-sm font-medium transition-colors ${
 activeTab === "all" ? "bg-brand-elevated text-slate-tile" : "text-tertiary hover:text-slate-tile"
 }`}>
 All Invoices
 </button>
 <button
 onClick={() => setActiveTab("payment")}
 className={`px-4 py-2 text-sm font-medium transition-colors ${
 activeTab === "payment" ? "bg-brand-elevated text-slate-tile" : "text-tertiary hover:text-slate-tile"
 }`}>
 Payment Tracking
 {paymentInvoices.length > 0 && (
 <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-transparent text-stone-blue border border-stone-blue text-[11px] font-bold">
 {paymentInvoices.length}
 </span>
 )}
 </button>
 </div>

 {loading ? (
 <div className="space-y-4">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
 <SkeletonStatCard />
 <SkeletonStatCard />
 <SkeletonStatCard />
 <SkeletonStatCard />
 </div>
 <SkeletonList rows={6} columns={["w-32", "w-20", "w-24", "w-32", "w-32", "w-20", "w-24"]} />
 </div>
 ) : (
 <>
 {activeTab === "all" ? (
 <>
 {/* Stats */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
 <StatCard label="Total Invoices" value={stats.total.toString()} />
 <StatCard label="Total Value" value={formatCents(stats.totalValue)} />
 <StatCard label="Pending Review" value={stats.pending.toString()} sub={`${stats.approved} approved`} />
 <StatCard label="In Draw / Paid" value={`${stats.inDraw} / ${stats.paid}`} />
 </div>

 {/* Primary filters */}
 <div className="flex flex-col md:flex-row gap-3 mb-3">
 <div className="relative flex-1">
 <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
 </svg>
 <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
 placeholder="Search vendor or invoice #..."
 className="w-full pl-9 pr-8 py-2.5 bg-bg-sub border border-border-def text-sm text-slate-tile placeholder-cream-dim focus:border-stone-blue focus:outline-none" />
 {search && (
 <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-slate-tile">
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
 </button>
 )}
 </div>
 <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}
 className="px-3 py-2.5 bg-bg-sub border border-border-def text-sm text-slate-tile focus:border-stone-blue focus:outline-none md:w-48">
 <option value="">All Jobs</option>
 {jobNames.map(n => <option key={n} value={n}>{n}</option>)}
 </select>
 <select value={pmFilter} onChange={(e) => setPmFilter(e.target.value)}
 className="px-3 py-2.5 bg-bg-sub border border-border-def text-sm text-slate-tile focus:border-stone-blue focus:outline-none md:w-44">
 <option value="">All PMs</option>
 <option value="__unassigned__">Unassigned</option>
 {pmUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
 </select>
 <select value={confidenceFilter} onChange={(e) => setConfidenceFilter(e.target.value as ConfidenceFilter)}
 className="px-3 py-2.5 bg-bg-sub border border-border-def text-sm text-slate-tile focus:border-stone-blue focus:outline-none md:w-40">
 <option value="all">All Confidence</option>
 <option value="high">High (≥85%)</option>
 <option value="medium">Medium (70–84%)</option>
 <option value="low">Low (&lt;70%)</option>
 </select>
 </div>

 {/* More Filters toggle */}
 <div className="flex items-center gap-3 mb-5">
 <button onClick={() => setShowMoreFilters(!showMoreFilters)}
 className="flex items-center gap-1.5 px-3 py-2 text-sm text-tertiary hover:text-slate-tile border border-border-def hover:border-border-def-light transition-colors">
 <svg className={`w-4 h-4 transition-transform ${showMoreFilters ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
 </svg>
 More Filters
 {advancedFilterCount > 0 && (
 <span className="ml-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-slate-deep text-brand-bg text-[10px] font-bold">
 {advancedFilterCount}
 </span>
 )}
 </button>
 {isFiltered && (
 <button onClick={clearAllFilters}
 className="px-3 py-2 text-sm text-tertiary hover:text-slate-tile border border-border-def hover:border-border-def-light transition-colors">
 Clear all filters
 </button>
 )}
 </div>

 {/* Advanced filters */}
 {showMoreFilters && (
 <div className="mb-5 p-4 bg-bg-sub/50 border border-border-def space-y-4 animate-fade-up">
 {/* Status multi-select */}
 <div>
 <p className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-2">Status</p>
 <div className="flex flex-wrap gap-2">
 {ALL_STATUSES.map(s => (
 <button key={s} onClick={() => toggleStatus(s)}
 className={`px-2.5 py-1 text-xs border transition-colors ${
 statusFilters.has(s) ? statusBadgeColor(s) + " font-medium" : "text-tertiary border-border-def hover:border-border-def-light"
 }`}>
 {formatStatus(s)}
 </button>
 ))}
 </div>
 </div>
 <div className="flex flex-col md:flex-row gap-4">
 {/* Amount range */}
 <div>
 <p className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-2">Amount Range</p>
 <select value={amountRange} onChange={(e) => setAmountRange(e.target.value as AmountRange)}
 className="px-3 py-2 bg-bg-sub border border-border-def text-sm text-slate-tile focus:border-stone-blue focus:outline-none">
 <option value="all">All</option>
 <option value="0-5k">$0 – $5K</option>
 <option value="5k-25k">$5K – $25K</option>
 <option value="25k-100k">$25K – $100K</option>
 <option value="100k+">$100K+</option>
 </select>
 </div>
 {/* Date range */}
 <div>
 <p className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-2">Invoice Date Range</p>
 <div className="flex items-center gap-2">
 <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
 className="px-3 py-2 bg-bg-sub border border-border-def text-sm text-slate-tile focus:border-stone-blue focus:outline-none" />
 <span className="text-tertiary text-sm">to</span>
 <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
 className="px-3 py-2 bg-bg-sub border border-border-def text-sm text-slate-tile focus:border-stone-blue focus:outline-none" />
 </div>
 </div>
 </div>
 </div>
 )}

 {/* No results */}
 {filtered.length === 0 && (
 <EmptyState
 icon={<EmptyIcons.Search />}
 title="No invoices match your filters"
 message="Try adjusting your filters, or clear them to see every invoice in the system."
 primaryAction={{ label: "Clear filters", onClick: clearAllFilters }}
 />
 )}

 {filtered.length > 0 && (
 <div className="overflow-x-auto border border-border-def animate-fade-up">
 <table className="w-full min-w-[1100px] text-sm">
 <thead>
 <tr className="bg-bg-sub text-left">
 <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider cursor-pointer select-none hover:text-stone-blue transition-colors sticky left-0 bg-bg-sub z-10" onClick={() => toggleSort("vendor")}>
 Vendor<SortArrow active={sortKey === "vendor"} dir={sortDir} />
 </th>
 <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider">Inv #</th>
 <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider cursor-pointer select-none hover:text-stone-blue transition-colors" onClick={() => toggleSort("date")}>
 Date<SortArrow active={sortKey === "date"} dir={sortDir} />
 </th>
 <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider">Job</th>
 <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider">Cost Code</th>
 <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider text-right cursor-pointer select-none hover:text-stone-blue transition-colors" onClick={() => toggleSort("amount")}>
 Amount<SortArrow active={sortKey === "amount"} dir={sortDir} />
 </th>
 <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider cursor-pointer select-none hover:text-stone-blue transition-colors" onClick={() => toggleSort("status")}>
 Status<SortArrow active={sortKey === "status"} dir={sortDir} />
 </th>
 <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider cursor-pointer select-none hover:text-stone-blue transition-colors" onClick={() => toggleSort("pm")}>
 PM<SortArrow active={sortKey === "pm"} dir={sortDir} />
 </th>
 <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider text-right cursor-pointer select-none hover:text-stone-blue transition-colors" onClick={() => toggleSort("aging")}>
 Days Out<SortArrow active={sortKey === "aging"} dir={sortDir} />
 </th>
 <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider">Payment</th>
 </tr>
 </thead>
 <tbody>
 {filtered.map((inv) => (
 <tr key={inv.id}
 className="group border-t border-border-sub hover:bg-brand-elevated/50 cursor-pointer transition-colors"
 onClick={() => {
 const reviewable = ["pm_review", "ai_processed"].includes(inv.status);
 window.location.href = reviewable ? `/invoices/${inv.id}` : `/invoices/${inv.id}`;
 }}>
 <td className="py-3 px-4 text-slate-tile font-medium sticky left-0 bg-white group-hover:bg-brand-elevated/50 z-[1]">
 <span className="inline-flex items-center gap-2">
 {inv.vendor_name_raw ?? "Unknown"}
 {inv.document_type === "receipt" && (
 <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-transparent text-tertiary border border-cream-dim/40 uppercase tracking-wide">
 Receipt
 </span>
 )}
 {isUnknownVendor(inv) && (
 <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-transparent text-nw-danger border border-nw-danger uppercase tracking-wide">
 Unknown Vendor
 </span>
 )}
 </span>
 </td>
 <td className="py-3 px-4 text-secondary font-mono text-xs">
 {inv.invoice_number ?? (
 <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-transparent text-nw-warn border border-nw-warn uppercase tracking-wide">
 No Invoice #
 </span>
 )}
 </td>
 <td className="py-3 px-4 text-secondary">
 {inv.invoice_date ? (
 formatDate(inv.invoice_date)
 ) : (
 <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-transparent text-nw-danger border border-nw-danger uppercase tracking-wide">
 No Date
 </span>
 )}
 </td>
 <td className="py-3 px-4">
 {inv.jobs?.name ? (
 <span className="inline-flex items-center px-2 py-0.5 bg-transparent text-nw-warn border border-nw-warn text-xs font-medium">{inv.jobs.name}</span>
 ) : inv.document_category === "overhead" ? (
 <span
  className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-transparent border"
  style={{ color: "var(--color-warning, #E65100)", borderColor: "var(--color-warning, #E65100)" }}
 >Overhead</span>
 ) : (
 <span className="text-tertiary">—</span>
 )}
 </td>
 <td className="py-3 px-4 text-secondary text-xs">
 {inv.line_item_cost_codes && inv.line_item_cost_codes.length > 1 ? (
 <span
 className="inline-flex items-center px-2 py-0.5 bg-transparent text-stone-blue border border-stone-blue text-xs font-medium"
 title={inv.line_item_cost_codes.join(", ")}
 >
 Multiple ({inv.line_item_cost_codes.length})
 </span>
 ) : inv.line_item_cost_codes && inv.line_item_cost_codes.length === 1 ? (
 <span>{inv.line_item_cost_codes[0]}</span>
 ) : inv.cost_codes ? (
 <span>{inv.cost_codes.code}</span>
 ) : (
 <span className="text-tertiary">—</span>
 )}
 </td>
 <td className="py-3 px-4 text-slate-tile text-right font-medium font-display">{formatCents(inv.total_amount)}</td>
 <td className="py-3 px-4">
 <div className="flex items-center gap-1.5">
 <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium border ${statusBadgeColor(inv.status)}`}>
 {formatStatus(inv.status)}
 </span>
 {(inv.parent_invoice_id || inv.partial_approval_note) && (
 <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] uppercase tracking-wider border border-nw-warn text-nw-warn" title="Part of a partial-approval split">
 Partial
 </span>
 )}
 </div>
 </td>
 <td className="py-3 px-4 text-secondary text-xs">{inv.assigned_pm?.full_name ?? <span className="text-tertiary">—</span>}</td>
 <td className="py-3 px-4 text-right">
 {(() => {
 // Paid (or voided) invoices don't age — render a dash, no badge, no days text.
 if (!isUnpaidInvoice(inv)) {
 return <span className="text-tertiary">&mdash;</span>;
 }
 const days = daysOutstanding(inv.received_date);
 const badge = agingBadge(days);
 if (badge) {
 return (
 <span
 className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-bold rounded-full border"
 style={badge.style}
 title={badge.title}
 >
 {badge.label}
 </span>
 );
 }
 return (
 <span className="text-xs text-secondary tabular-nums">{days}d</span>
 );
 })()}
 </td>
 <td className="py-3 px-4 text-secondary text-xs">{formatDate(inv.payment_date)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </>
 ) : (
 /* Payment Tracking Tab */
 <>
 {paymentGroups.length === 0 ? (
 <EmptyState
 icon={<EmptyIcons.Check />}
 variant="success"
 title="No invoices ready for payment"
 message="Approved invoices will appear here once they're ready to be paid."
 />
 ) : (
 <div className="space-y-6">
 {paymentGroups.map(([dateKey, group]) => (
 <div key={dateKey} className="animate-fade-up">
 <div className="flex items-center gap-3 mb-3">
 <h3 className="text-sm font-medium text-slate-tile">
 {dateKey === "No Date" ? "No Payment Date" : formatDate(dateKey)}
 </h3>
 <span className="text-[11px] text-tertiary bg-bg-sub px-2 py-0.5 border border-border-def">
 {group.length} invoice{group.length !== 1 ? "s" : ""} &mdash; {formatCents(group.reduce((s, inv) => s + inv.total_amount, 0))}
 </span>
 </div>
 <div className="overflow-x-auto border border-border-def">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-bg-sub text-left">
 <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider">Vendor</th>
 <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider">Inv #</th>
 <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider text-right">Amount</th>
 <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider">Status</th>
 <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider">Payment Date</th>
 <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider">Check #</th>
 <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider text-center">Picked Up</th>
 </tr>
 </thead>
 <tbody>
 {group.map((inv) => (
 <tr key={inv.id} className="border-t border-border-sub hover:bg-brand-elevated/50 transition-colors">
 <td className="py-3 px-4 text-slate-tile font-medium cursor-pointer hover:text-stone-blue transition-colors"
 onClick={() => window.location.href = `/invoices/${inv.id}`}>
 <span className="inline-flex items-center gap-2">
 {inv.vendor_name_raw ?? "Unknown"}
 {inv.document_type === "receipt" && (
 <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-transparent text-tertiary border border-cream-dim/40 uppercase tracking-wide">Receipt</span>
 )}
 </span>
 </td>
 <td className="py-3 px-4 text-secondary font-mono text-xs">{inv.invoice_number ?? <span className="text-tertiary">&mdash;</span>}</td>
 <td className="py-3 px-4 text-slate-tile text-right font-medium font-display">{formatCents(inv.total_amount)}</td>
 <td className="py-3 px-4">
 <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium border ${statusBadgeColor(inv.status)}`}>
 {formatStatus(inv.status)}
 </span>
 </td>
 <td className="py-3 px-4 text-secondary text-xs">{formatDate(inv.payment_date)}</td>
 <td className="py-3 px-4">
 {editingCheckId === inv.id ? (
 <input
 type="text"
 value={editingCheckValue}
 onChange={(e) => setEditingCheckValue(e.target.value)}
 onBlur={() => handleInlineCheckSave(inv.id, editingCheckValue)}
 onKeyDown={(e) => { if (e.key === "Enter") handleInlineCheckSave(inv.id, editingCheckValue); if (e.key === "Escape") setEditingCheckId(null); }}
 autoFocus
 className="w-24 px-2 py-1 bg-bg-sub border border-stone-blue text-xs text-slate-tile focus:outline-none"
 />
 ) : (
 <button
 onClick={(e) => { e.stopPropagation(); setEditingCheckId(inv.id); setEditingCheckValue(inv.check_number ?? ""); }}
 className="px-2 py-1 text-xs text-secondary hover:text-slate-tile hover:bg-bg-sub transition-colors min-w-[60px] text-left"
 disabled={savingInline === inv.id}>
 {savingInline === inv.id ? "..." : (inv.check_number || <span className="text-tertiary italic">Add #</span>)}
 </button>
 )}
 </td>
 <td className="py-3 px-4 text-center">
 <button
 onClick={(e) => { e.stopPropagation(); handleInlinePickedUpToggle(inv.id, inv.picked_up); }}
 disabled={savingInline === inv.id}
 className={`relative inline-flex h-5 w-9 items-center transition-colors disabled:opacity-50 ${inv.picked_up ? "bg-nw-success" : "bg-brand-border"}`}>
 <span className={`inline-block h-3 w-3 transform bg-white transition-transform ${inv.picked_up ? "translate-x-5" : "translate-x-1"}`} />
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 ))}
 </div>
 )}
 </>
 )}
 </>
 )}
 </main>
 <InvoiceUploadModal open={uploadOpen} onClose={() => {
 setUploadOpen(false);
 if (searchParams.get("action")) router.replace("/invoices");
 window.location.reload();
 }} />
 <InvoiceImportModal open={importOpen} onClose={() => {
 setImportOpen(false);
 if (searchParams.get("action")) router.replace("/invoices");
 window.location.reload();
 }} />
 </AppShell>
 );
}
