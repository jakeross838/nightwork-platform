"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatCents, confidenceColor, confidenceLabel, formatStatus, formatFlag, formatDate, formatDateTime } from "@/lib/utils/format";
import NavBar from "@/components/nav-bar";

interface Job { id: string; name: string; address: string | null; }
interface CostCode { id: string; code: string; description: string; category: string; is_change_order: boolean; }
interface PurchaseOrder { id: string; po_number: string | null; description: string | null; amount: number; }
interface BudgetInfo { original_estimate: number; revised_estimate: number; total_spent: number; remaining: number; }

interface InvoiceData {
 id: string; job_id: string | null; vendor_id: string | null; cost_code_id: string | null; po_id: string | null;
 invoice_number: string | null; invoice_date: string | null; vendor_name_raw: string | null;
 job_reference_raw: string | null; po_reference_raw: string | null; description: string | null;
 line_items: Array<{ description: string; qty: number | null; unit: string | null; rate: number | null; amount: number; }>;
 total_amount: number; invoice_type: string | null; co_reference_raw: string | null;
 confidence_score: number;
 confidence_details: (Record<string, number> & { auto_fills?: Record<string, boolean> }) | null;
 ai_raw_response: { cost_code_suggestion?: { code: string; description: string; confidence: number; is_change_order: boolean }; flags?: string[] } | null;
 status: string; status_history: Array<Record<string, unknown>>;
 received_date: string | null; payment_date: string | null; original_file_type: string | null;
 check_number: string | null; picked_up: boolean; mailed_date: string | null;
 pm_overrides: Record<string, { old: unknown; new: unknown }> | null;
 qa_overrides: Record<string, { old: unknown; new: unknown }> | null;
 signed_file_url: string | null;
 assigned_pm: { id: string; full_name: string; role: string } | null;
 jobs: Job | null; vendors: { id: string; name: string } | null; cost_codes: CostCode | null;
 pm_users?: { id: string; full_name: string }[];
}

// ── Searchable Combobox ────────────────────────────────
function SearchCombobox({ label, value, onChange, options, disabled, aiFilled, grouped, placeholder }: {
 label: string; value: string; onChange: (v: string) => void;
 options: { value: string; label: string; group?: string }[];
 disabled?: boolean; aiFilled?: boolean; grouped?: boolean; placeholder?: string;
}) {
 const [open, setOpen] = useState(false);
 const [search, setSearch] = useState("");
 const ref = useRef<HTMLDivElement>(null);
 const inputRef = useRef<HTMLInputElement>(null);

 const selectedLabel = options.find(o => o.value === value)?.label ?? "";

 useEffect(() => {
 function handleClick(e: MouseEvent) {
 if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
 }
 document.addEventListener("mousedown", handleClick);
 return () => document.removeEventListener("mousedown", handleClick);
 }, []);

 const filtered = options.filter(o =>
 o.value === "" || o.label.toLowerCase().includes(search.toLowerCase())
 );

 const groups = grouped
 ? Array.from(new Set(filtered.filter(o => o.group).map(o => o.group!)))
 : [];

 return (
 <div ref={ref} className="relative">
 <label className="flex items-center gap-2 text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5">
 {label}
 {aiFilled && <AiBadge />}
 </label>
 <div
 className={`flex items-center w-full px-3 py-2.5 bg-brand-surface border text-sm transition-colors cursor-text ${
 open ? "border-teal" : aiFilled ? "border-teal/40" : "border-brand-border"
 } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
 onClick={() => { setOpen(true); setSearch(""); setTimeout(() => inputRef.current?.focus(), 0); }}
 >
 {open ? (
 <input
 ref={inputRef}
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder={selectedLabel || placeholder || "Type to search..."}
 className="flex-1 bg-transparent text-cream placeholder-cream-dim outline-none text-sm"
 onKeyDown={(e) => {
 if (e.key === "Escape") setOpen(false);
 if (e.key === "Enter" && filtered.length > 0) {
 const first = filtered.find(o => o.value !== "");
 if (first) { onChange(first.value); setOpen(false); }
 }
 }}
 />
 ) : (
 <span className={`flex-1 truncate ${value ? "text-cream" : "text-cream-dim"}`}>
 {selectedLabel || placeholder || "Select..."}
 </span>
 )}
 {value && !disabled && (
 <button onClick={(e) => { e.stopPropagation(); onChange(""); }} className="ml-2 text-cream-dim hover:text-cream">
 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 )}
 <svg className={`w-4 h-4 ml-1 text-cream-dim transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
 </svg>
 </div>

 {open && (
 <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto bg-brand-card border border-brand-border shadow-2xl">
 {filtered.length === 0 ? (
 <div className="px-3 py-4 text-sm text-cream-dim text-center">No matches</div>
 ) : grouped && groups.length > 0 ? (
 groups.map(group => {
 const groupItems = filtered.filter(o => o.group === group);
 if (groupItems.length === 0) return null;
 return (
 <div key={group}>
 <div className="px-3 py-1.5 text-[10px] font-medium text-cream-dim uppercase tracking-wider bg-brand-surface sticky top-0">{group}</div>
 {groupItems.map(o => (
 <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
 className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-elevated transition-colors ${o.value === value ? "text-teal bg-teal/5" : "text-cream"}`}>
 {o.label}
 </button>
 ))}
 </div>
 );
 })
 ) : (
 filtered.map(o => (
 <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
 className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-elevated transition-colors ${o.value === value ? "text-teal bg-teal/5" : o.value === "" ? "text-cream-dim" : "text-cream"}`}>
 {o.label}
 </button>
 ))
 )}
 </div>
 )}
 </div>
 );
}

function AiBadge() {
 return <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold bg-teal/15 text-teal border border-teal/25 normal-case tracking-normal">AI</span>;
}

// ── Status History Timeline ─────────────────────────────
function statusDotColor(newStatus: string): string {
 if (["pm_approved", "qa_approved", "pushed_to_qb", "in_draw", "paid"].includes(newStatus)) return "bg-status-success";
 if (["pm_held", "info_requested"].includes(newStatus)) return "bg-brass";
 if (["pm_denied", "qa_kicked_back", "void"].includes(newStatus)) return "bg-status-danger";
 return "bg-teal"; // forward progress: pm_review, qa_review, ai_processed
}

// ── Main Page ───────────────────────────────────────────
export default function InvoiceReviewPage() {
 const params = useParams();
 const router = useRouter();
 const invoiceId = params.id as string;

 const [invoice, setInvoice] = useState<InvoiceData | null>(null);
 const [loading, setLoading] = useState(true);
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
 const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
 const [budgetInfo, setBudgetInfo] = useState<BudgetInfo | null>(null);
 const [actionNote, setActionNote] = useState("");
 const [showNoteModal, setShowNoteModal] = useState<"hold" | "deny" | null>(null);
 const [showApproveConfirm, setShowApproveConfirm] = useState(false);
 const [showMissingFieldsBlock, setShowMissingFieldsBlock] = useState(false);
 const [showDocPreview, setShowDocPreview] = useState(false);
 const [pmUsers, setPmUsers] = useState<{ id: string; full_name: string }[]>([]);
 const [reassigning, setReassigning] = useState(false);
 const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
 const [infoRecipient, setInfoRecipient] = useState("");
 const [infoQuestion, setInfoQuestion] = useState("");

 // Payment tracking
 const [checkNumber, setCheckNumber] = useState("");
 const [pickedUp, setPickedUp] = useState(false);
 const [mailedDate, setMailedDate] = useState("");
 const [savingPayment, setSavingPayment] = useState(false);

 // Fetch invoice
 useEffect(() => {
 async function fetchInvoice() {
 const res = await fetch(`/api/invoices/${invoiceId}`);
 if (res.ok) {
 const data: InvoiceData = await res.json();
 setInvoice(data);
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
 // Default CO toggle if AI detected a CO reference
 if (data.co_reference_raw) setIsChangeOrder(true);
 // Check if cost code is a CO variant
 if (data.cost_codes?.code?.endsWith("C")) setIsChangeOrder(true);
 }
 setLoading(false);
 }
 fetchInvoice();
 }, [invoiceId]);

 // Fetch lookups (cost codes with category + is_change_order)
 useEffect(() => {
 async function fetchLookups() {
 const [jobsRes, codesRes] = await Promise.all([
 supabase.from("jobs").select("id, name, address").is("deleted_at", null).eq("status", "active").order("name"),
 supabase.from("cost_codes").select("id, code, description, category, is_change_order").is("deleted_at", null).order("sort_order"),
 ]);
 if (jobsRes.data) setJobs(jobsRes.data);
 if (codesRes.data) setCostCodes(codesRes.data as CostCode[]);
 }
 fetchLookups();
 }, []);

 // Fetch POs
 useEffect(() => {
 async function fetchPOs() {
 if (!jobId) { setPurchaseOrders([]); return; }
 const { data } = await supabase.from("purchase_orders").select("id, po_number, description, amount").eq("job_id", jobId).is("deleted_at", null).order("po_number");
 if (data) setPurchaseOrders(data);
 }
 fetchPOs();
 }, [jobId]);

 // Fetch budget
 useEffect(() => {
 async function fetchBudget() {
 if (!jobId || !costCodeId) { setBudgetInfo(null); return; }
 const { data: bl } = await supabase.from("budget_lines").select("original_estimate, revised_estimate").eq("job_id", jobId).eq("cost_code_id", costCodeId).is("deleted_at", null).single();
 if (!bl) { setBudgetInfo(null); return; }
 const { data: spent } = await supabase.from("invoices").select("total_amount").eq("job_id", jobId).eq("cost_code_id", costCodeId).in("status", ["pm_approved","qa_review","qa_approved","pushed_to_qb","in_draw","paid"]).is("deleted_at", null);
 const totalSpent = spent?.reduce((s, i) => s + i.total_amount, 0) ?? 0;
 setBudgetInfo({ original_estimate: bl.original_estimate, revised_estimate: bl.revised_estimate, total_spent: totalSpent, remaining: bl.revised_estimate - totalSpent });
 }
 fetchBudget();
 }, [jobId, costCodeId]);

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
 if (totalAmount !== String(invoice.total_amount / 100)) o.total_amount = { old: invoice.total_amount / 100, new: parseFloat(totalAmount) };
 if (invoiceType !== (invoice.invoice_type ?? "")) o.invoice_type = { old: invoice.invoice_type, new: invoiceType };
 if (description !== (invoice.description ?? "")) o.description = { old: invoice.description, new: description };
 if (jobId !== (invoice.job_id ?? "")) o.job_id = { old: invoice.job_id, new: jobId };
 if (costCodeId !== (invoice.cost_code_id ?? "")) o.cost_code_id = { old: invoice.cost_code_id, new: costCodeId };
 return o;
 }, [invoice, invoiceNumber, invoiceDate, totalAmount, invoiceType, description, jobId, costCodeId]);

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
 const res = await fetch(`/api/invoices/${invoiceId}/action`, {
 method: "POST", headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ action, note, pm_overrides: Object.keys(overrides).length > 0 ? overrides : undefined, updates: Object.keys(updates).length > 0 ? updates : undefined }),
 });
 setSaving(false);
 if (res.ok) router.push("/invoices/queue");
 };

 if (loading) return (
 <div className="min-h-screen flex items-center justify-center">
 <div className="w-8 h-8 border-2 border-teal/30 border-t-teal animate-spin" />
 </div>
 );

 if (!invoice) return (
 <div className="min-h-screen flex items-center justify-center">
 <p className="text-status-danger font-display text-lg">Invoice not found</p>
 </div>
 );

 const isReviewable = ["pm_review", "ai_processed", "pm_held", "info_requested"].includes(invoice.status);
 const showPaymentTracking = ["qa_approved", "pushed_to_qb", "in_draw", "paid"].includes(invoice.status);
 const autoFills = (invoice.confidence_details as Record<string, unknown>)?.auto_fills as Record<string, boolean> | undefined;

 // Filter cost codes based on CO toggle
 const filteredCostCodes = costCodes.filter(c => c.is_change_order === isChangeOrder);

 // Build grouped cost code options
 const costCodeOptions = filteredCostCodes.map(c => ({
 value: c.id, label: `${c.code} — ${c.description}`, group: c.category,
 }));

 // Job options
 const jobOptions = jobs.map(j => ({ value: j.id, label: `${j.name} — ${j.address ?? ""}` }));

 // Resolve labels for approve confirmation
 const selectedJob = jobs.find(j => j.id === jobId);
 const selectedCostCode = costCodes.find(c => c.id === costCodeId);

 // Missing field flags
 const missingInvoiceNumber = !invoiceNumber.trim();
 const missingInvoiceDate = !invoiceDate.trim();

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
 if (res.ok) window.location.reload();
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
 }
 setSavingPayment(false);
 };

 return (
 <div className="min-h-screen">
 <NavBar />

 {/* Sub-header */}
 <div className="border-b border-brand-border bg-brand-surface/50 px-4 md:px-6 py-3">
 <div className="max-w-[1600px] mx-auto flex items-center gap-3 md:gap-4 flex-wrap">
 <Link href="/invoices/queue" className="text-cream-dim hover:text-cream transition-colors text-sm">&larr; Queue</Link>
 <h1 className="font-display text-base md:text-xl text-cream truncate">
 {invoice.vendor_name_raw ?? "Invoice"} <span className="text-cream-dim hidden md:inline">&mdash;</span><span className="md:hidden"> </span>{invoice.invoice_number ?? "No #"}
 </h1>
 <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium border ${confidenceColor(invoice.confidence_score)}`}>
 {Math.round(invoice.confidence_score * 100)}% {confidenceLabel(invoice.confidence_score)}
 </span>
 <span className="text-xs text-cream bg-brand-surface px-3 py-1.5 border border-brand-border-light font-medium">
 {formatStatus(invoice.status)}
 </span>
 <span className="inline-flex items-center gap-1.5 text-xs text-cream-dim">
 <span>PM:</span>
 <select
 value={invoice.assigned_pm?.id ?? ""}
 onChange={(e) => handleReassignPm(e.target.value)}
 disabled={reassigning}
 className="bg-brand-surface border border-brand-border text-sm text-cream px-2 py-1 focus:border-teal focus:outline-none disabled:opacity-50 cursor-pointer"
 >
 <option value="">Unassigned</option>
 {pmUsers.map(u => (
 <option key={u.id} value={u.id}>{u.full_name}</option>
 ))}
 </select>
 </span>
 </div>
 </div>

 {/* Kick-back banner from QA */}
 {kickBackInfo && (
 <div className="bg-status-danger-muted border-b border-status-danger/20 px-6 py-3">
 <div className="max-w-[1600px] mx-auto flex items-start gap-3">
 <svg className="w-5 h-5 text-status-danger flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
 </svg>
 <div>
 <p className="text-sm font-medium text-status-danger">Kicked Back by Accounting</p>
 <p className="text-sm text-status-danger/80 mt-0.5">{kickBackInfo}</p>
 </div>
 </div>
 </div>
 )}

 {/* Hold banner */}
 {holdInfo !== null && (
 <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-6 py-3">
 <div className="max-w-[1600px] mx-auto flex items-start gap-3">
 <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
 </svg>
 <div>
 <p className="text-sm font-medium text-yellow-400">This invoice is on hold</p>
 {holdInfo && <p className="text-sm text-yellow-400/80 mt-0.5">{holdInfo}</p>}
 </div>
 </div>
 </div>
 )}

 {/* Deny banner with reopen */}
 {denyInfo !== null && (
 <div className="bg-status-danger-muted border-b border-status-danger/20 px-6 py-3">
 <div className="max-w-[1600px] mx-auto flex items-start gap-3">
 <svg className="w-5 h-5 text-status-danger flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
 </svg>
 <div className="flex-1">
 <p className="text-sm font-medium text-status-danger">This invoice was denied</p>
 {denyInfo && <p className="text-sm text-status-danger/80 mt-0.5">{denyInfo}</p>}
 <button
 onClick={handleReopen}
 disabled={saving}
 className="mt-2 px-3 py-1.5 bg-brand-surface border border-brand-border hover:border-brand-border-light text-cream text-sm font-medium transition-colors disabled:opacity-50"
 >
 {saving ? "Reopening..." : "Reopen for Review"}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Info Requested banner */}
 {infoRequestedInfo !== null && (
 <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-6 py-3">
 <div className="max-w-[1600px] mx-auto flex items-start gap-3">
 <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
 </svg>
 <div className="flex-1">
 <p className="text-sm font-medium text-yellow-400">Info Requested</p>
 <p className="text-sm text-yellow-400/80 mt-0.5">{infoRequestedInfo}</p>
 <button
 onClick={() => handleAction("info_received", "Info received — returning to PM review")}
 disabled={saving}
 className="mt-2 px-3 py-1.5 bg-brand-surface border border-brand-border hover:border-brand-border-light text-cream text-sm font-medium transition-colors disabled:opacity-50"
 >
 {saving ? "Processing..." : "Info Received — Resume Review"}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Math mismatch banner */}
 {invoice.ai_raw_response?.flags?.includes("math_mismatch") && (
 <div className="bg-status-danger-muted border-b border-status-danger/20 px-6 py-3">
 <div className="max-w-[1600px] mx-auto flex items-start gap-3">
 <svg className="w-5 h-5 text-status-danger flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
 </svg>
 <div>
 <p className="text-sm font-medium text-status-danger">Math Mismatch Detected</p>
 <p className="text-sm text-status-danger/80 mt-0.5">Line items may not sum to the stated total. Verify amounts before approving.</p>
 </div>
 </div>
 </div>
 )}

 <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 pb-32 md:pb-6">
 <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-fade-up">
 {/* ── Left: Document Preview ── */}
 <div className="xl:col-span-1">
 {/* Mobile: collapsible toggle */}
 <button
 onClick={() => setShowDocPreview(!showDocPreview)}
 className="xl:hidden w-full flex items-center justify-between px-4 py-3 bg-brand-card border border-brand-border mb-4"
 >
 <span className="text-sm font-medium text-cream">View Original Document</span>
 <svg className={`w-4 h-4 text-cream-dim transition-transform ${showDocPreview ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
 </svg>
 </button>
 <div className={`${showDocPreview ? "block" : "hidden"} xl:block`}>
 <div className="xl:sticky xl:top-24">
 <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-3 brass-underline hidden xl:block">Original Document</p>
 <div className="xl:mt-5">
 {invoice.signed_file_url ? (
 invoice.original_file_type === "image" ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img src={invoice.signed_file_url} alt="Invoice" className="w-full border border-brand-border" />
 ) : (
 <iframe src={invoice.signed_file_url} className="w-full h-[500px] xl:h-[700px] border border-brand-border bg-brand-surface" title="Invoice PDF" />
 )
 ) : (
 <div className="h-48 xl:h-64 border border-brand-border bg-brand-surface flex items-center justify-center">
 <p className="text-cream-dim text-sm">No preview available</p>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* ── Middle: Editable Form ── */}
 <div className="xl:col-span-1 space-y-6 animate-fade-up stagger-2">
 <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider brass-underline">Invoice Details</p>

 {/* Missing field flags */}
 {(missingInvoiceNumber || missingInvoiceDate) && (
 <div className="mt-4 flex flex-wrap gap-2">
 {missingInvoiceNumber && (
 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-status-warning-muted text-brass border border-brass/20">
 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
 No invoice #
 </span>
 )}
 {missingInvoiceDate && (
 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-status-warning-muted text-brass border border-brass/20">
 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
 No date detected
 </span>
 )}
 </div>
 )}

 <div className="mt-5 space-y-4">
 {/* Job — searchable combobox */}
 <SearchCombobox label="Job" value={jobId} onChange={setJobId}
 options={jobOptions} disabled={!isReviewable}
 aiFilled={!!autoFills?.job_id} placeholder="Search jobs..." />

 {/* Change Order toggle */}
 <div className="flex items-center gap-3">
 <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider">Change Order?</label>
 <button
 onClick={() => { setIsChangeOrder(!isChangeOrder); setCostCodeId(""); }}
 disabled={!isReviewable}
 className={`relative inline-flex h-6 w-11 items-center transition-colors disabled:opacity-50 ${isChangeOrder ? "bg-brass" : "bg-brand-border"}`}
 >
 <span className={`inline-block h-4 w-4 transform bg-white transition-transform ${isChangeOrder ? "translate-x-6" : "translate-x-1"}`} />
 </button>
 <span className="text-xs text-cream-dim">{isChangeOrder ? "Yes" : "No"}</span>
 </div>

 {/* CO Reference — only when toggle is on */}
 {isChangeOrder && (
 <FormField label="CO Reference" value={coReference} onChange={setCoReference}
 disabled={!isReviewable} placeholder="e.g. PCCO #3" />
 )}

 {/* Cost Code — searchable, grouped by category */}
 <SearchCombobox label="Cost Code" value={costCodeId} onChange={setCostCodeId}
 options={costCodeOptions} disabled={!isReviewable}
 aiFilled={!!autoFills?.cost_code_id} grouped placeholder="Search cost codes..." />

 {purchaseOrders.length > 0 && (
 <SearchCombobox label="Purchase Order" value={poId} onChange={setPoId}
 options={[{ value: "", label: "— No PO —" }, ...purchaseOrders.map(p => ({ value: p.id, label: `${p.po_number ?? "PO"} — ${formatCents(p.amount)}` }))]}
 disabled={!isReviewable} placeholder="Select PO..." />
 )}

 <div className="grid grid-cols-2 gap-4">
 <FormField label="Invoice #" value={invoiceNumber} onChange={setInvoiceNumber} disabled={!isReviewable} />
 <FormField label="Invoice Date" value={invoiceDate} onChange={setInvoiceDate} type="date" disabled={!isReviewable} />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <FormField label="Total ($)" value={totalAmount} onChange={setTotalAmount} type="number" disabled={!isReviewable} />
 <div>
 <label className="flex items-center gap-2 text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5">Type</label>
 <select value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)} disabled={!isReviewable}
 className="w-full px-3 py-2.5 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none disabled:opacity-50">
 <option value="lump_sum">Lump Sum</option>
 <option value="progress">Progress</option>
 <option value="time_and_materials">Time &amp; Materials</option>
 </select>
 </div>
 </div>

 <FormField label="Description" value={description} onChange={setDescription} type="textarea" disabled={!isReviewable} />

 {/* Raw AI data */}
 <div className="border-t border-brand-border pt-4">
 <p className="text-[11px] text-cream-dim mb-2 uppercase tracking-wider">AI Parsed (raw)</p>
 <div className="grid grid-cols-2 gap-2 text-xs text-cream-dim">
 <div>Vendor: {invoice.vendor_name_raw ?? "—"}</div>
 <div>Job Ref: {invoice.job_reference_raw ?? "—"}</div>
 <div>PO Ref: {invoice.po_reference_raw ?? "—"}</div>
 <div>CO Ref: {invoice.co_reference_raw ?? "—"}</div>
 </div>
 </div>

 {/* Line Items — smart display for $0 scope items vs priced items */}
 {invoice.line_items?.length > 0 && (() => {
 const allZero = invoice.line_items.every(i => !i.amount || i.amount === 0);
 return (
 <div className="border-t border-brand-border pt-4">
 <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-2">{allZero ? "Scope Items" : "Line Items"}</p>
 {allZero ? (
 <div className=" border border-brand-border overflow-hidden">
 {invoice.line_items.map((item, i) => (
 <div key={i} className={`px-3 py-2 text-xs text-cream ${i > 0 ? "border-t border-brand-row-border" : ""}`}>{item.description}</div>
 ))}
 </div>
 ) : (
 <div className="overflow-x-auto border border-brand-border">
 <table className="w-full text-xs">
 <thead>
 <tr className="bg-brand-surface">
 <th className="py-2 px-3 text-left text-cream font-semibold">Description</th>
 <th className="py-2 px-3 text-right text-cream font-semibold">Qty</th>
 <th className="py-2 px-3 text-right text-cream font-semibold">Rate</th>
 <th className="py-2 px-3 text-right text-cream font-semibold">Amount</th>
 </tr>
 </thead>
 <tbody>
 {invoice.line_items.map((item, i) => (
 <tr key={i} className="border-t border-brand-row-border">
 <td className="py-2 px-3 text-cream">{item.description}</td>
 <td className="py-2 px-3 text-right text-cream-muted">{item.qty ?? <span className="text-cream-dim">—</span>}</td>
 <td className="py-2 px-3 text-right text-cream-muted">{item.rate != null ? `$${item.rate}` : <span className="text-cream-dim">—</span>}</td>
 <td className="py-2 px-3 text-right text-cream font-medium">${item.amount?.toFixed(2)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 );
 })()}
 </div>

 {/* Actions — desktop only (mobile uses sticky bar below) */}
 {isReviewable && (
 <div className="hidden md:block border-t border-brand-border pt-6 space-y-3">
 <div className="flex gap-3">
 <button onClick={() => { if (!jobId || !costCodeId) { setShowMissingFieldsBlock(true); } else { setShowApproveConfirm(true); } }} disabled={saving}
 className="flex-1 px-4 py-3 bg-status-success hover:brightness-110 disabled:opacity-50 text-white font-medium transition-all">
 {saving ? "Saving..." : "Approve"}
 </button>
 <button onClick={() => setShowNoteModal("hold")} disabled={saving}
 className="flex-1 px-4 py-3 bg-brass hover:brightness-110 disabled:opacity-50 text-brand-bg font-medium transition-all">
 Hold
 </button>
 <button onClick={() => setShowNoteModal("deny")} disabled={saving}
 className="flex-1 px-4 py-3 bg-status-danger hover:brightness-110 disabled:opacity-50 text-white font-medium transition-all">
 Deny
 </button>
 </div>
 <button onClick={() => setShowRequestInfoModal(true)} disabled={saving}
 className="w-full px-4 py-2 border border-brand-border hover:border-brand-border-light text-cream-muted text-sm transition-colors">
 Request Info
 </button>
 </div>
 )}
 </div>

 {/* ── Right: Sidebar ── */}
 <div className="xl:col-span-1 animate-fade-up stagger-4">
 <div className="sticky top-24 space-y-5">
 {/* Budget */}
 <SidebarCard title="Budget Status">
 {budgetInfo ? (
 <div className="space-y-3">
 <BudgetRow label="Original Estimate" value={budgetInfo.original_estimate} />
 <BudgetRow label="Revised Estimate" value={budgetInfo.revised_estimate} />
 <BudgetRow label="Total Spent" value={budgetInfo.total_spent} />
 <div className="border-t border-brand-border pt-3">
 <BudgetRow label="Remaining" value={budgetInfo.remaining}
 highlight={budgetInfo.remaining < 0 ? "danger" : budgetInfo.remaining < invoice.total_amount ? "warning" : "success"} />
 </div>
 {budgetInfo.remaining < invoice.total_amount && (
 <div className="mt-2 px-3 py-2 bg-status-danger-muted border border-status-danger/20 ">
 <p className="text-xs text-status-danger font-medium">Invoice ({formatCents(invoice.total_amount)}) exceeds remaining budget</p>
 </div>
 )}
 </div>
 ) : (
 jobId && costCodeId ? (
 <div className="px-3 py-2.5 bg-brass/10 border border-brass/20 ">
 <p className="text-xs text-brass font-medium">No budget set for this cost code</p>
 <p className="text-[11px] text-cream-dim mt-1">Approving will create a $0 budget line — this invoice will show as over-budget on the draw.</p>
 </div>
 ) : (
 <p className="text-sm text-cream-dim">Select job + cost code</p>
 )
 )}
 </SidebarCard>

 {/* Payment */}
 <SidebarCard title="Payment">
 <div className="space-y-2.5 text-sm">
 <div className="flex justify-between"><span className="text-cream-dim">Received</span><span className="text-cream">{formatDate(invoice.received_date)}</span></div>
 <div className="flex justify-between"><span className="text-cream-dim">Scheduled</span><span className="text-cream">{formatDate(invoice.payment_date)}</span></div>
 <div className="flex justify-between border-t border-brand-border pt-2.5"><span className="text-cream-dim">Amount</span><span className="text-brass font-display text-base font-medium">{formatCents(invoice.total_amount)}</span></div>
 </div>
 </SidebarCard>

 {/* Payment Tracking */}
 {showPaymentTracking && (
 <SidebarCard title="Payment Tracking">
 <div className="space-y-4">
 <div>
 <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">Check #</label>
 <input type="text" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} placeholder="e.g. 10452"
 className="w-full px-3 py-2.5 bg-brand-surface border border-brand-border text-sm text-cream placeholder-cream-dim focus:border-teal focus:outline-none transition-colors" />
 </div>
 <div className="flex items-center gap-3">
 <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider">Picked Up</label>
 <button onClick={() => setPickedUp(!pickedUp)}
 className={`relative inline-flex h-6 w-11 items-center transition-colors ${pickedUp ? "bg-status-success" : "bg-brand-border"}`}>
 <span className={`inline-block h-4 w-4 transform bg-white transition-transform ${pickedUp ? "translate-x-6" : "translate-x-1"}`} />
 </button>
 <span className="text-xs text-cream-dim">{pickedUp ? "Yes" : "No"}</span>
 </div>
 {!pickedUp && (
 <div>
 <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">Mailed Date</label>
 <input type="date" value={mailedDate} onChange={(e) => setMailedDate(e.target.value)}
 className="w-full px-3 py-2.5 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none transition-colors" />
 </div>
 )}
 <button onClick={handleSavePaymentTracking} disabled={savingPayment}
 className="w-full px-4 py-2.5 bg-teal hover:bg-teal-hover text-brand-bg font-medium transition-colors disabled:opacity-50">
 {savingPayment ? "Saving..." : "Save"}
 </button>
 </div>
 </SidebarCard>
 )}

 {/* AI Confidence */}
 {invoice.confidence_details && (
 <SidebarCard title="AI Confidence">
 <div className="space-y-2">
 {Object.entries(invoice.confidence_details)
 .filter(([f, s]) => f !== "auto_fills" && typeof s === "number")
 .map(([field, score]) => (
 <div key={field} className="flex items-center justify-between text-sm">
 <span className="text-cream-dim">{formatFlag(field)}</span>
 <span className={`px-2 py-0.5 text-xs ${confidenceColor(score as number)}`}>{Math.round((score as number) * 100)}%</span>
 </div>
 ))}
 </div>
 </SidebarCard>
 )}

 {/* Status History Timeline — newest first */}
 {invoice.status_history?.length > 0 && (
 <SidebarCard title="Status History">
 <div className="space-y-0">
 {[...invoice.status_history].reverse().map((entry, i) => {
 const newStatus = String(entry.new_status);
 return (
 <div key={i} className="relative pl-6 pb-4 last:pb-0">
 {i < invoice.status_history.length - 1 && (
 <div className="absolute left-[7px] top-3 bottom-0 w-px bg-brand-border" />
 )}
 <div className={`absolute left-0 top-1 w-[15px] h-[15px] border-2 border-brand-card ${statusDotColor(newStatus)}`} />
 <div className="text-xs">
 <p className="text-cream font-medium">
 {formatStatus(String(entry.old_status))} &rarr; {formatStatus(newStatus)}
 </p>
 <p className="text-cream-dim mt-0.5">
 {String(entry.who)} &mdash; {formatDateTime(String(entry.when))}
 </p>
 {entry.note ? <p className="text-cream-dim/80 mt-1 italic text-[11px] leading-relaxed">{String(entry.note)}</p> : null}
 </div>
 </div>
 );
 })}
 </div>
 </SidebarCard>
 )}

 {/* Edit History (PM + QA overrides) — collapsible */}
 {(invoice.pm_overrides && Object.keys(invoice.pm_overrides).length > 0) || (invoice.qa_overrides && Object.keys(invoice.qa_overrides).length > 0) ? (
 <EditHistoryCard pmOverrides={invoice.pm_overrides} qaOverrides={invoice.qa_overrides} />
 ) : null}
 </div>
 </div>
 </div>
 </main>

 {/* ── Sticky Mobile Action Bar ── */}
 {isReviewable && (
 <div className="md:hidden fixed bottom-0 left-0 right-0 bg-brand-bg/95 backdrop-blur-sm border-t border-brand-border px-4 py-3 z-30">
 <div className="flex gap-2">
 <button onClick={() => { if (!jobId || !costCodeId) { setShowMissingFieldsBlock(true); } else { setShowApproveConfirm(true); } }} disabled={saving}
 className="flex-1 px-3 py-3 bg-status-success hover:brightness-110 disabled:opacity-50 text-white font-medium transition-all text-sm">
 {saving ? "..." : "Approve"}
 </button>
 <button onClick={() => setShowNoteModal("hold")} disabled={saving}
 className="flex-1 px-3 py-3 bg-brass hover:brightness-110 disabled:opacity-50 text-brand-bg font-medium transition-all text-sm">
 Hold
 </button>
 <button onClick={() => setShowNoteModal("deny")} disabled={saving}
 className="flex-1 px-3 py-3 bg-status-danger hover:brightness-110 disabled:opacity-50 text-white font-medium transition-all text-sm">
 Deny
 </button>
 </div>
 <button onClick={() => setShowRequestInfoModal(true)} disabled={saving}
 className="w-full mt-2 px-3 py-2 border border-brand-border hover:border-brand-border-light text-cream-muted text-xs transition-colors">
 Request Info
 </button>
 </div>
 )}

 {/* ── Approve Confirmation Modal ── */}
 {showApproveConfirm && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="bg-brand-card border border-brand-border p-6 w-full max-w-md animate-fade-up shadow-2xl">
 <h3 className="font-display text-xl text-cream mb-2">Approve Invoice</h3>

 {/* Soft warnings for optional fields (job+cost code enforced before reaching this modal) */}
 {(missingInvoiceNumber || missingInvoiceDate) && (
 <div className="mb-4 px-3 py-2.5 bg-status-warning-muted border border-brass/20 space-y-1">
 {missingInvoiceNumber && <p className="text-xs text-brass">Missing invoice number</p>}
 {missingInvoiceDate && <p className="text-xs text-brass">Missing invoice date</p>}
 <p className="text-[11px] text-cream-dim mt-1">You can still approve, but consider filling these in.</p>
 </div>
 )}

 <div className="bg-brand-surface border border-brand-border p-4 space-y-2 text-sm">
 <div className="flex justify-between">
 <span className="text-cream-dim">Amount</span>
 <span className="text-brass font-display font-medium">{formatCents(invoice.total_amount)}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-cream-dim">Vendor</span>
 <span className="text-cream">{invoice.vendor_name_raw ?? "Unknown"}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-cream-dim">Job</span>
 <span className="text-cream">{selectedJob?.name ?? "Not assigned"}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-cream-dim">Cost Code</span>
 <span className="text-cream">{selectedCostCode ? `${selectedCostCode.code} — ${selectedCostCode.description}` : "Not assigned"}</span>
 </div>
 </div>

 <div className="flex gap-3 mt-5">
 <button
 onClick={() => { setShowApproveConfirm(false); handleAction("approve"); }}
 disabled={saving}
 className="flex-1 px-4 py-2.5 bg-status-success hover:brightness-110 text-white font-medium disabled:opacity-50 transition-all">
 Confirm Approval
 </button>
 <button onClick={() => setShowApproveConfirm(false)}
 className="flex-1 px-4 py-2.5 border border-brand-border text-cream-muted hover:border-brand-border-light transition-colors">
 Cancel
 </button>
 </div>
 </div>
 </div>
 )}

 {/* ── Missing Fields Block Modal ── */}
 {showMissingFieldsBlock && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="bg-brand-card border border-brand-border p-6 w-full max-w-md animate-fade-up shadow-2xl">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 bg-status-danger-muted flex items-center justify-center flex-shrink-0">
 <svg className="w-5 h-5 text-status-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
 </svg>
 </div>
 <h3 className="font-display text-xl text-cream">Cannot Approve</h3>
 </div>
 <p className="text-sm text-cream-muted mb-2">Job and Cost Code are required before approving.</p>
 <div className="bg-brand-surface border border-brand-border p-3 space-y-1.5 mb-5">
 <div className="flex items-center gap-2">
 <span className={`w-2 h-2 ${jobId ? "bg-status-success" : "bg-status-danger"}`} />
 <span className={`text-sm ${jobId ? "text-cream-muted" : "text-cream font-medium"}`}>
 {jobId ? `Job: ${selectedJob?.name ?? "Assigned"}` : "Job — not assigned"}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <span className={`w-2 h-2 ${costCodeId ? "bg-status-success" : "bg-status-danger"}`} />
 <span className={`text-sm ${costCodeId ? "text-cream-muted" : "text-cream font-medium"}`}>
 {costCodeId ? `Cost Code: ${selectedCostCode?.code ?? "Assigned"}` : "Cost Code — not assigned"}
 </span>
 </div>
 </div>
 <div className="flex gap-3">
 <button
 onClick={() => setShowMissingFieldsBlock(false)}
 className="flex-1 px-4 py-2.5 bg-teal hover:bg-teal-hover text-brand-bg font-medium transition-colors">
 Go Back and Assign
 </button>
 <button
 onClick={() => { setShowMissingFieldsBlock(false); handleAction("hold", "Held — missing job or cost code assignment"); }}
 disabled={saving}
 className="flex-1 px-4 py-2.5 bg-brass hover:brightness-110 text-brand-bg font-medium disabled:opacity-50 transition-all">
 Hold Instead
 </button>
 </div>
 </div>
 </div>
 )}

 {/* ── Request Info Modal ── */}
 {showRequestInfoModal && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="bg-brand-card border border-brand-border p-6 w-full max-w-md animate-fade-up shadow-2xl">
 <h3 className="font-display text-xl text-cream mb-4">Request Information</h3>
 <div className="space-y-4">
 <div>
 <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">
 Who do you need info from?
 </label>
 <select
 value={infoRecipient}
 onChange={(e) => setInfoRecipient(e.target.value)}
 className="w-full px-3 py-2.5 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none"
 >
 <option value="">Select...</option>
 <option value="Vendor">Vendor</option>
 <option value="Subcontractor">Subcontractor</option>
 <option value="Architect">Architect</option>
 <option value="Other">Other</option>
 </select>
 </div>
 <div>
 <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">
 What do you need?
 </label>
 <textarea
 value={infoQuestion}
 onChange={(e) => setInfoQuestion(e.target.value)}
 placeholder="Describe the information you need..."
 className="w-full h-24 px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream placeholder-cream-dim focus:border-teal focus:outline-none resize-none"
 />
 </div>
 </div>
 <div className="flex gap-3 mt-5">
 <button
 onClick={() => {
 handleAction("request_info", `Info requested from ${infoRecipient}: ${infoQuestion.trim()}`);
 setShowRequestInfoModal(false);
 setInfoRecipient("");
 setInfoQuestion("");
 }}
 disabled={!infoRecipient || !infoQuestion.trim() || saving}
 className="flex-1 px-4 py-2.5 bg-brass hover:brightness-110 text-brand-bg font-medium disabled:opacity-50 transition-all">
 {saving ? "Sending..." : "Send Request"}
 </button>
 <button
 onClick={() => { setShowRequestInfoModal(false); setInfoRecipient(""); setInfoQuestion(""); }}
 className="flex-1 px-4 py-2.5 border border-brand-border text-cream-muted hover:border-brand-border-light transition-colors">
 Cancel
 </button>
 </div>
 </div>
 </div>
 )}

 {/* ── Hold / Deny Note Modal ── */}
 {showNoteModal && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="bg-brand-card border border-brand-border p-6 w-full max-w-md animate-fade-up shadow-2xl">
 <h3 className="font-display text-xl text-cream mb-4">
 {showNoteModal === "hold" ? "Hold Invoice" : "Deny Invoice"}
 </h3>
 <textarea value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder="Add a note (required)..."
 className="w-full h-24 px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream placeholder-cream-dim focus:border-teal focus:outline-none resize-none" />
 <div className="flex gap-3 mt-4">
 <button
 onClick={() => { if (actionNote.trim()) { handleAction(showNoteModal, actionNote.trim()); setShowNoteModal(null); setActionNote(""); } }}
 disabled={!actionNote.trim() || saving}
 className={`flex-1 px-4 py-2.5 font-medium disabled:opacity-50 transition-all ${showNoteModal === "hold" ? "bg-brass text-brand-bg" : "bg-status-danger text-white"}`}>
 {showNoteModal === "hold" ? "Hold" : "Deny"}
 </button>
 <button onClick={() => { setShowNoteModal(null); setActionNote(""); }}
 className="flex-1 px-4 py-2.5 border border-brand-border text-cream-muted hover:border-brand-border-light transition-colors">
 Cancel
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}

function SidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
 return (
 <div className="bg-brand-card border border-brand-border p-5">
 <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-4 brass-underline">{title}</p>
 <div className="mt-5">{children}</div>
 </div>
 );
}

function FormField({ label, value, onChange, type = "text", disabled, placeholder }: {
 label: string; value: string; onChange: (v: string) => void;
 type?: "text" | "number" | "date" | "textarea"; disabled?: boolean; placeholder?: string;
}) {
 const base = "w-full px-3 py-2.5 bg-brand-surface border border-brand-border text-sm text-cream placeholder-cream-dim focus:border-teal focus:outline-none disabled:opacity-50 transition-colors";
 return (
 <div>
 <label className="flex items-center gap-2 text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5">{label}</label>
 {type === "textarea" ? (
 <textarea value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} rows={3} placeholder={placeholder} className={`${base} resize-none`} />
 ) : (
 <input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} className={base} />
 )}
 </div>
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
 if (typeof value === "number") return `$${value.toFixed(2)}`;
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
 <div className="bg-brand-card border border-brand-border p-5">
 <button
 onClick={() => setOpen(!open)}
 className="w-full flex items-center justify-between"
 >
 <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider brass-underline">
 Edit History ({entries.length})
 </p>
 <svg
 className={`w-4 h-4 text-cream-dim transition-transform ${open ? "rotate-180" : ""}`}
 fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
 >
 <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
 </svg>
 </button>
 {open && (
 <div className="mt-4 space-y-3">
 {entries.map((entry, i) => (
 <div key={i} className="text-xs border-l-2 border-teal/30 pl-3 py-1">
 <p className="text-cream">
 <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold mr-1.5 ${
 entry.source === "PM" ? "bg-teal/15 text-teal" : "bg-brass/15 text-brass"
 }`}>
 {entry.source}
 </span>
 changed <span className="font-medium">{FIELD_LABELS[entry.field] ?? entry.field}</span>
 </p>
 <p className="text-cream-dim mt-1">
 <span className="line-through">{formatOverrideValue(entry.old)}</span>
 {" "}&rarr;{" "}
 <span className="text-cream">{formatOverrideValue(entry.newVal)}</span>
 </p>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}

function BudgetRow({ label, value, highlight }: { label: string; value: number; highlight?: "danger" | "warning" | "success" }) {
 const color = highlight === "danger" ? "text-status-danger" : highlight === "warning" ? "text-brass" : highlight === "success" ? "text-status-success" : "text-cream";
 return (
 <div className="flex justify-between text-sm">
 <span className="text-cream-dim">{label}</span>
 <span className={`font-medium font-display ${color}`}>{formatCents(value)}</span>
 </div>
 );
}
