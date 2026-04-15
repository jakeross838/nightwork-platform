"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatCents, confidenceColor, confidenceLabel, formatStatus, formatFlag, formatDate, formatDateTime, statusBadgeOutline } from "@/lib/utils/format";
import NavBar from "@/components/nav-bar";
import InvoiceFilePreview from "@/components/invoice-file-preview";
import InvoiceStatusTimeline from "@/components/invoice-status-timeline";
import VendorContactPopover from "@/components/vendor-contact-popover";
import Breadcrumbs from "@/components/breadcrumbs";
import { invoiceDisplayName } from "@/lib/invoices/display";

interface Job { id: string; name: string; address: string | null; }
interface CostCode { id: string; code: string; description: string; category: string; is_change_order: boolean; }
interface PurchaseOrder {
 id: string;
 po_number: string | null;
 description: string | null;
 amount: number;
 invoiced_total: number;
 budget_line_id: string | null;
 status: string;
}
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
 return <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold bg-transparent text-teal border border-teal normal-case tracking-normal">AI</span>;
}

/** Resolve the matching base↔CO cost code variant. Mapping is the literal
 *  code string: "07101" ↔ "07101C". Returns the original id if no partner
 *  exists in the table (so the dropdown stays populated with a valid code
 *  even when the PM has picked something that doesn't have both variants). */
function resolveVariant(
 costCodes: { id: string; code: string; is_change_order: boolean }[],
 costCodeId: string | null | undefined,
 wantChangeOrder: boolean
): string | null {
 if (!costCodeId) return costCodeId ?? null;
 const current = costCodes.find(c => c.id === costCodeId);
 if (!current) return costCodeId;
 if (current.is_change_order === wantChangeOrder) return costCodeId;
 const targetCode = wantChangeOrder
 ? `${current.code}C`
 : current.code.replace(/C$/, "");
 const partner = costCodes.find(
 c => c.code === targetCode && c.is_change_order === wantChangeOrder
 );
 return partner ? partner.id : costCodeId;
}

// Compact searchable cost-code picker sized for the per-line-item table.
// Renders as a filterable dropdown — 230+ codes would be unusable otherwise.
function LineCostCodeSelect({ value, onChange, options, disabled, aiSuggestion }: {
 value: string;
 onChange: (v: string) => void;
 options: { value: string; label: string; group?: string }[];
 disabled?: boolean;
 aiSuggestion?: { code: string; confidence: number } | null;
}) {
 const [open, setOpen] = useState(false);
 const [search, setSearch] = useState("");
 const [highlight, setHighlight] = useState(0);
 const rootRef = useRef<HTMLDivElement>(null);
 const inputRef = useRef<HTMLInputElement>(null);

 const selected = options.find(o => o.value === value) ?? null;

 useEffect(() => {
 if (!open) return;
 function handleClick(e: MouseEvent) {
 if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
 }
 document.addEventListener("mousedown", handleClick);
 return () => document.removeEventListener("mousedown", handleClick);
 }, [open]);

 useEffect(() => {
 if (open) {
 setSearch("");
 setHighlight(0);
 setTimeout(() => inputRef.current?.focus(), 0);
 }
 }, [open]);

 const filtered = search.trim()
 ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
 : options;
 const groups = Array.from(new Set(filtered.filter(o => o.group).map(o => o.group!)));
 const flat = filtered;

 function commit(v: string) {
 onChange(v);
 setOpen(false);
 }

 const borderColor = open ? "border-teal" : aiSuggestion ? "border-teal/40" : "border-brand-border";

 return (
 <div ref={rootRef} className="relative">
 <div
 role="combobox"
 aria-expanded={open}
 tabIndex={disabled ? -1 : 0}
 onClick={() => !disabled && setOpen(o => !o)}
 onKeyDown={(e) => {
 if (disabled) return;
 if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
 e.preventDefault();
 setOpen(true);
 }
 }}
 className={`flex items-center w-full min-h-[26px] px-2 py-1 bg-brand-surface border ${borderColor} text-xs text-cream cursor-pointer transition-colors ${disabled ? "opacity-50 pointer-events-none" : "hover:border-teal/60"}`}
 >
 <span className={`flex-1 truncate ${selected && selected.value ? "text-cream" : "text-cream-dim"}`}>
 {selected?.label || "Select…"}
 </span>
 <svg className={`w-3 h-3 ml-1 text-cream-dim transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
 </svg>
 </div>
 {aiSuggestion && (
 <span className="absolute -top-2 right-1 text-[9px] px-1 bg-brand-card text-teal border border-teal tracking-tight z-10">
 AI {Math.round(aiSuggestion.confidence * 100)}%
 </span>
 )}
 {open && (
 <div className="absolute z-40 mt-1 min-w-[280px] max-w-[400px] bg-brand-card border border-brand-border shadow-2xl left-0">
 <div className="p-1.5 border-b border-brand-border bg-brand-surface">
 <input
 ref={inputRef}
 value={search}
 onChange={(e) => { setSearch(e.target.value); setHighlight(0); }}
 placeholder="Type to filter…"
 className="w-full px-2 py-1 bg-brand-card border border-brand-border text-xs text-cream placeholder-cream-dim focus:outline-none focus:border-teal"
 onKeyDown={(e) => {
 if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
 else if (e.key === "ArrowDown") { e.preventDefault(); setHighlight(h => Math.min(h + 1, flat.length - 1)); }
 else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
 else if (e.key === "Enter" && flat[highlight]) { e.preventDefault(); commit(flat[highlight].value); }
 }}
 />
 </div>
 <div className="max-h-56 overflow-y-auto">
 {flat.length === 0 ? (
 <div className="px-3 py-3 text-xs text-cream-dim text-center">No matches</div>
 ) : groups.length > 0 ? (
 <>
 {filtered.filter(o => !o.group).map(o => {
 const idx = flat.indexOf(o);
 const isHl = idx === highlight;
 return (
 <button key={o.value} data-idx={idx} type="button"
 onMouseEnter={() => setHighlight(idx)}
 onClick={() => commit(o.value)}
 className={`w-full text-left px-2.5 py-1.5 text-xs transition-colors ${isHl ? "bg-teal-muted" : ""} ${o.value === value ? "text-teal font-medium" : o.value === "" ? "text-cream-dim" : "text-cream"}`}>
 {o.label}
 </button>
 );
 })}
 {groups.map(group => (
 <div key={group}>
 <div className="sticky top-0 px-2.5 py-1 text-[10px] font-semibold text-cream-dim uppercase tracking-wider bg-brand-surface border-b border-brand-border">{group}</div>
 {filtered.filter(o => o.group === group).map(o => {
 const idx = flat.indexOf(o);
 const isHl = idx === highlight;
 return (
 <button key={o.value} data-idx={idx} type="button"
 onMouseEnter={() => setHighlight(idx)}
 onClick={() => commit(o.value)}
 className={`w-full text-left px-2.5 py-1.5 text-xs transition-colors ${isHl ? "bg-teal-muted" : ""} ${o.value === value ? "text-teal font-medium" : "text-cream"}`}>
 {o.label}
 </button>
 );
 })}
 </div>
 ))}
 </>
 ) : (
 flat.map(o => {
 const idx = flat.indexOf(o);
 const isHl = idx === highlight;
 return (
 <button key={o.value} data-idx={idx} type="button"
 onMouseEnter={() => setHighlight(idx)}
 onClick={() => commit(o.value)}
 className={`w-full text-left px-2.5 py-1.5 text-xs transition-colors ${isHl ? "bg-teal-muted" : ""} ${o.value === value ? "text-teal font-medium" : "text-cream"}`}>
 {o.label}
 </button>
 );
 })
 )}
 </div>
 </div>
 )}
 </div>
 );
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
 const [showDocPreview, setShowDocPreview] = useState(false);
 const [pmUsers, setPmUsers] = useState<{ id: string; full_name: string }[]>([]);
 const [reassigning, setReassigning] = useState(false);
 const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
 const [infoRecipient, setInfoRecipient] = useState("");
 const [infoQuestion, setInfoQuestion] = useState("");
 const [showPartialModal, setShowPartialModal] = useState(false);
 const [partialApprovedIds, setPartialApprovedIds] = useState<Set<string>>(new Set());
 const [partialNote, setPartialNote] = useState("");
 const [partialSubmitting, setPartialSubmitting] = useState(false);
 const [partialError, setPartialError] = useState<string | null>(null);
 const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set());

 // Cross-link to the "other side" of a partial split
 const [siblingInvoice, setSiblingInvoice] = useState<{ id: string; status: string; total_amount: number } | null>(null);

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
 async function fetchInvoice() {
 const res = await fetch(`/api/invoices/${invoiceId}`);
 if (res.ok) {
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
 }
 setLoading(false);
 }
 useEffect(() => {
 fetchInvoice();
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [invoiceId]);

 const refreshInvoice = () => fetchInvoice();

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

 // Fetch POs
 useEffect(() => {
 async function fetchPOs() {
 if (!jobId) { setPurchaseOrders([]); return; }
 const { data } = await supabase
 .from("purchase_orders")
 .select("id, po_number, description, amount, invoiced_total, budget_line_id, status")
 .eq("job_id", jobId)
 .is("deleted_at", null)
 .in("status", ["issued", "partially_invoiced", "fully_invoiced"])
 .order("po_number");
 if (data) setPurchaseOrders(data);
 }
 fetchPOs();
 }, [jobId]);

 // Fetch budget (legacy single-cost-code sidebar — retained for fallback)
 useEffect(() => {
 async function fetchBudget() {
 if (!jobId || !costCodeId) { setBudgetInfo(null); return; }
 const { data: bl } = await supabase.from("budget_lines").select("original_estimate, revised_estimate, is_allowance").eq("job_id", jobId).eq("cost_code_id", costCodeId).is("deleted_at", null).single();
 if (!bl) { setBudgetInfo(null); return; }
 const { data: spent } = await supabase.from("invoices").select("total_amount").eq("job_id", jobId).eq("cost_code_id", costCodeId).in("status", ["pm_approved","qa_review","qa_approved","pushed_to_qb","in_draw","paid"]).is("deleted_at", null);
 const totalSpent = spent?.reduce((s, i) => s + i.total_amount, 0) ?? 0;
 setBudgetInfo({ original_estimate: bl.original_estimate, revised_estimate: bl.revised_estimate, total_spent: totalSpent, remaining: bl.revised_estimate - totalSpent, is_allowance: !!bl.is_allowance });
 }
 fetchBudget();
 }, [jobId, costCodeId]);

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
 async function fetchMultiBudget() {
 if (!jobId || uniqueLineCostCodeIds.length === 0) {
 setBudgetByCostCode(new Map());
 return;
 }
 const { data: blData } = await supabase
 .from("budget_lines")
 .select("cost_code_id, original_estimate, revised_estimate, is_allowance")
 .eq("job_id", jobId)
 .in("cost_code_id", uniqueLineCostCodeIds)
 .is("deleted_at", null);
 const { data: spentData } = await supabase
 .from("invoices")
 .select("cost_code_id, total_amount")
 .eq("job_id", jobId)
 .in("cost_code_id", uniqueLineCostCodeIds)
 .in("status", ["pm_approved", "qa_review", "qa_approved", "pushed_to_qb", "in_draw", "paid"])
 .is("deleted_at", null);
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
 if (totalAmount !== String(invoice.total_amount / 100)) o.total_amount = { old: invoice.total_amount / 100, new: parseFloat(totalAmount) };
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
 await fetch(`/api/invoices/${invoiceId}/line-items`, {
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
 }

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

 // Per-line cost code options — unfiltered, because each line can be
 // independently a base or CO line. Include both variants so PM has full control.
 const lineCostCodeOptions = [
 { value: "", label: "— Unassigned —" },
 ...costCodes.map(c => ({
 value: c.id,
 label: `${c.code} — ${c.description}${c.is_change_order ? " (CO)" : ""}`,
 group: c.category,
 })),
 ];

 // Summary: how many unique cost codes the line items span
 const uniqueLineCodeIds = Array.from(new Set(lineItems.map(l => l.cost_code_id).filter(Boolean) as string[]));
 const lineItemSumCents = lineItems.reduce((s, l) => s + l.amount_cents, 0);
 const totalCents = Math.round((parseFloat(totalAmount) || 0) * 100);
 const amountMismatchCents = Math.abs(lineItemSumCents - totalCents);
 const hasAmountMismatch = lineItems.length > 0 && amountMismatchCents > 1; // 1¢ rounding tolerance

 // Amount guard: PM edited total above original AI-parsed amount
 const aiParsedTotal = invoice.ai_parsed_total_amount ?? invoice.total_amount;
 const amountIncreasePct = aiParsedTotal > 0
 ? ((totalCents - aiParsedTotal) / aiParsedTotal) * 100
 : 0;
 const amountOverAi = totalCents > aiParsedTotal;
 const amountOver10Pct = amountIncreasePct > 10;

 // Credit memo (negative total)
 const isCreditMemo = invoice.total_amount < 0 || totalCents < 0;

 // CO reference required: any line flagged as CO must have a co_reference
 const lineItemsMissingCoReference = lineItems.filter(l => l.is_change_order && !l.co_reference.trim());
 const missingCoReference = lineItemsMissingCoReference.length > 0;

 // Per-line-item breakdown (for summary display)
 const costCodeSummary = uniqueLineCodeIds.map(ccId => {
 const cc = costCodes.find(c => c.id === ccId);
 const rows = lineItems.filter(l => l.cost_code_id === ccId);
 const total = rows.reduce((s, l) => s + l.amount_cents, 0);
 return {
 id: ccId,
 code: cc?.code ?? "???",
 description: cc?.description ?? "",
 total,
 count: rows.length,
 };
 });

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
 alert("Invoice date is required before approval. Enter a date or toggle the workflow setting off.");
 return;
 }
 // Phase 8e: duplicate flag blocks approval until dismissed.
 if (
 invoice?.is_potential_duplicate &&
 !invoice?.duplicate_dismissed_at &&
 workflowSettings?.duplicate_detection_enabled !== false
 ) {
 alert("This invoice is flagged as a potential duplicate. Dismiss the flag (Not a duplicate) or deny the invoice before approving.");
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

 // Job options
 const jobOptions = jobs.map(j => ({ value: j.id, label: `${j.name} — ${j.address ?? ""}` }));

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

 // Date reasonableness warning (always on, regardless of settings).
 // Shows when the invoice date is >90 days in the past or in the future.
 const dateReasonablenessWarning = (() => {
 if (!invoiceDate.trim()) return null;
 const ivDate = new Date(invoiceDate);
 if (isNaN(ivDate.getTime())) return null;
 const today = new Date();
 today.setHours(0, 0, 0, 0);
 const diffDays = Math.round((today.getTime() - ivDate.getTime()) / (1000 * 60 * 60 * 24));
 if (diffDays > 90) return `Invoice date is ${diffDays} days ago — verify`;
 if (diffDays < 0) return `Invoice date is in the future — verify`;
 return null;
 })();

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
 <h1 className="font-display text-base md:text-xl text-cream flex items-center gap-2 min-w-0">
 <span className="truncate">{invoice.vendor_name_raw ?? "Invoice"}</span>
 <VendorContactPopover
 vendorId={invoice.vendor_id}
 vendorName={invoice.vendor_name_raw ?? invoice.vendors?.name ?? null}
 vendor={invoice.vendors}
 />
 <span className="text-cream-dim hidden md:inline">&mdash;</span>
 <span className="md:hidden"> </span>
 <span className="truncate">{invoice.invoice_number ?? "No #"}</span>
 </h1>
 <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${confidenceColor(invoice.confidence_score)}`}>
 {Math.round(invoice.confidence_score * 100)}% {confidenceLabel(invoice.confidence_score)}
 </span>
 <span className={`inline-flex items-center text-xs px-3 py-1 font-medium ${statusBadgeOutline(invoice.status)}`}>
 {formatStatus(invoice.status)}
 </span>
 {isCreditMemo && (
 <span className="inline-flex items-center text-xs px-3 py-1 font-medium bg-transparent text-teal border border-teal">
 Credit Memo
 </span>
 )}
 {isChangeOrder && (
 <span className="inline-flex items-center text-xs px-3 py-1 font-medium bg-transparent text-brass border border-brass">
 Change Order
 </span>
 )}
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
 <Breadcrumbs
 items={[
 { label: "Invoices", href: "/invoices" },
 { label: "PM Queue", href: "/invoices/queue" },
 {
 label: `${invoice.vendor_name_raw ?? "Invoice"}${invoice.invoice_number ? ` — ${invoice.invoice_number}` : ""}`,
 },
 ]}
 />
 {/* Partial approval banner — shown on both halves of a split */}
 {(invoice.parent_invoice_id || invoice.partial_approval_note) && (
 <div className="mb-4 border border-brass/50 bg-brass/5 px-4 py-3 text-sm text-cream animate-fade-up">
 <div className="flex items-start gap-3">
 <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider border border-brass text-brass">
 Partial
 </span>
 <div className="flex-1">
 {invoice.parent_invoice_id ? (
 <p>
 <span className="font-medium text-cream">Approved portion</span> of a split invoice.{" "}
 {siblingInvoice && (
 <Link href={`/invoices/${siblingInvoice.id}`} className="text-teal hover:underline">
 See held portion ({formatCents(siblingInvoice.total_amount)} · {formatStatus(siblingInvoice.status)}) →
 </Link>
 )}
 </p>
 ) : (
 <>
 <p>
 <span className="font-medium text-cream">Held portion</span> — {siblingInvoice && (
 <>{formatCents(siblingInvoice.total_amount)} approved,{" "}</>
 )}
 {formatCents(invoice.total_amount)} held.
 </p>
 {invoice.partial_approval_note && (
 <p className="mt-1 text-cream-dim">
 <span className="uppercase tracking-wider text-[10px] mr-2">Reason:</span>
 {invoice.partial_approval_note}
 </p>
 )}
 {siblingInvoice && (
 <Link href={`/invoices/${siblingInvoice.id}`} className="inline-block mt-1 text-teal hover:underline">
 See approved portion →
 </Link>
 )}
 </>
 )}
 </div>
 </div>
 </div>
 )}
 {/* Status timeline (Phase 8e) — always shown */}
 <div className="mb-4 animate-fade-up">
 <InvoiceStatusTimeline
 currentStatus={invoice.status}
 history={invoice.status_history ?? []}
 />
 </div>

 {/* Duplicate warning banner (Phase 8e) */}
 {invoice.is_potential_duplicate && invoice.duplicate_of && (
 <div className="mb-4 border border-brass/60 bg-brass/10 px-4 py-3 text-sm animate-fade-up">
 <div className="flex items-start gap-3">
 <svg className="w-5 h-5 text-brass flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
 </svg>
 <div className="flex-1 min-w-0">
 <p className="text-brass font-medium">Possible duplicate detected</p>
 <p className="text-cream-muted mt-1">
 Matches {invoice.duplicate_of.vendor_name_raw ?? "existing invoice"}{" "}
 {formatCents(invoice.duplicate_of.total_amount)}
 {invoice.duplicate_of.invoice_date ? ` on ${formatDate(invoice.duplicate_of.invoice_date)}` : ""}
 {invoice.duplicate_of.job_name ? ` (${invoice.duplicate_of.job_name})` : ""}
 {invoice.duplicate_of.invoice_number ? ` — Invoice #${invoice.duplicate_of.invoice_number}` : ""}
 .{" "}
 <Link href={`/invoices/${invoice.duplicate_of.id}`} className="text-teal hover:underline font-medium">
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
 className="px-3 py-1.5 text-xs font-medium text-cream-dim border border-brand-border hover:text-cream hover:border-brand-border-light transition-colors whitespace-nowrap"
 >
 Not a duplicate
 </button>
 </div>
 </div>
 )}
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
 </div>
 </div>
 </div>
 </div>

 {/* ── Middle: Editable Form ── */}
 <div className="xl:col-span-1 space-y-6 animate-fade-up stagger-2">
 <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider brass-underline">Invoice Details</p>

 {/* Missing field flags */}
 {(missingInvoiceNumber || missingInvoiceDate || dateReasonablenessWarning) && (
 <div className="mt-4 flex flex-wrap gap-2">
 {missingInvoiceNumber && (
 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-status-warning-muted text-brass border border-brass/20">
 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
 No invoice #
 </span>
 )}
 {missingInvoiceDate && (
 workflowSettings?.require_invoice_date ? (
 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-status-danger-muted text-status-danger border border-status-danger/40">
 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
 No date detected — required
 </span>
 ) : (
 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-status-warning-muted text-brass border border-brass/20">
 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
 No date detected
 </span>
 )
 )}
 {dateReasonablenessWarning && (
 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-status-warning-muted text-brass border border-brass/20">
 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
 {dateReasonablenessWarning}
 </span>
 )}
 </div>
 )}

 <div className="mt-5 space-y-4">
 {/* Job — searchable combobox */}
 <SearchCombobox label="Job" value={jobId} onChange={setJobId}
 options={jobOptions} disabled={!isReviewable}
 aiFilled={!!autoFills?.job_id} placeholder="Search jobs..." />

 {/* Change Order toggle — auto-swaps default cost code + every line
 between base ("07101 Pilings") and C-variant ("07101C Pilings CO"). */}
 <div className="flex items-center gap-3">
 <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider">Change Order?</label>
 <button
 onClick={() => {
 const next = !isChangeOrder;
 setIsChangeOrder(next);
 // Swap the default cost code to the matching variant.
 setCostCodeId(prev => resolveVariant(costCodes, prev, next) ?? "");
 // Every line follows the invoice-level flag by default. Swap each
 // line's assigned cost code to its variant AND flip its own CO flag
 // so the table matches the top-level toggle.
 setLineItems(prev => prev.map(li => ({
 ...li,
 is_change_order: next,
 cost_code_id: resolveVariant(costCodes, li.cost_code_id, next),
 // When flipping off, also clear the CO reference so the PM has
 // to re-enter one if they flip back on later.
 co_reference: next ? li.co_reference : "",
 })));
 }}
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

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <FormField label="Invoice #" value={invoiceNumber} onChange={setInvoiceNumber} disabled={!isReviewable} />
 <FormField label="Invoice Date" value={invoiceDate} onChange={setInvoiceDate} type="date" disabled={!isReviewable} />
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <FormField label="Total ($)" value={totalAmount} onChange={setTotalAmount} type="number" disabled={!isReviewable} />
 {amountOverAi && !amountOver10Pct && (
 <p className="mt-1.5 text-[11px] text-brass">
 +{amountIncreasePct.toFixed(1)}% vs AI-parsed {formatCents(aiParsedTotal)}
 </p>
 )}
 {amountOver10Pct && (
 <p className="mt-1.5 text-[11px] text-status-danger font-medium">
 Warning: +{amountIncreasePct.toFixed(1)}% over AI-parsed {formatCents(aiParsedTotal)} — note required
 </p>
 )}
 {isCreditMemo && (
 <span className="mt-1.5 inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-transparent text-teal border border-teal">
 Credit Memo
 </span>
 )}
 </div>
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

 {/* Line Items — editable per-row cost code + CO toggle (multi-cost-code support) */}
 {lineItems.length > 0 && (
 <div className="border-t border-brand-border pt-4">
 <div className="flex items-center justify-between mb-2">
 <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider">Line Items</p>
 {uniqueLineCodeIds.length > 0 && (
 <p className="text-[11px] text-cream-dim">
 {lineItems.length} line{lineItems.length === 1 ? "" : "s"} across {uniqueLineCodeIds.length} cost code{uniqueLineCodeIds.length === 1 ? "" : "s"}
 </p>
 )}
 </div>

 {/* Cost code summary */}
 {costCodeSummary.length > 0 && (
 <div className="mb-2 bg-brand-surface/60 border border-brand-border">
 <div className="px-3 py-2 border-b border-brand-border">
 <p className="text-[10px] text-cream-dim uppercase tracking-wider">
 Cost Code Split · {costCodeSummary.length} code{costCodeSummary.length !== 1 ? "s" : ""}
 </p>
 </div>
 <table className="w-full text-xs">
 <thead>
 <tr className="text-[10px] uppercase tracking-wider text-cream-dim">
 <th className="text-left px-3 py-1.5 font-medium">Code</th>
 <th className="text-left px-3 py-1.5 font-medium">Description</th>
 <th className="text-right px-3 py-1.5 font-medium">Lines</th>
 <th className="text-right px-3 py-1.5 font-medium">Total</th>
 </tr>
 </thead>
 <tbody>
 {costCodeSummary.map(cs => (
 <tr key={cs.id} className="border-t border-brand-row-border">
 <td className="px-3 py-1.5 font-mono text-teal">{cs.code}</td>
 <td className="px-3 py-1.5 text-cream-muted">{cs.description}</td>
 <td className="px-3 py-1.5 text-right text-cream-dim tabular-nums">{cs.count}</td>
 <td className="px-3 py-1.5 text-right text-cream font-medium tabular-nums">{formatCents(cs.total)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 <div className="overflow-x-auto border border-brand-border">
 <table className="w-full text-xs">
 <thead>
 <tr className="bg-brand-surface">
 <th className="py-2 px-3 text-left text-cream font-semibold">Description</th>
 <th className="py-2 px-3 text-left text-cream font-semibold min-w-[220px]">Cost Code</th>
 <th className="py-2 px-3 text-left text-cream font-semibold min-w-[180px]">PO</th>
 <th className="py-2 px-3 text-center text-cream font-semibold">CO</th>
 <th className="py-2 px-3 text-left text-cream font-semibold min-w-[120px]">CO Ref</th>
 <th className="py-2 px-3 text-right text-cream font-semibold">Amount</th>
 </tr>
 </thead>
 <tbody>
 {lineItems.map((li, idx) => {
 const aiSug = li.ai_suggested_cost_code_id && costCodes.find(c => c.id === li.ai_suggested_cost_code_id);
 const aiSugActive = li.cost_code_id === li.ai_suggested_cost_code_id && aiSug;
 const missingCoRef = li.is_change_order && !li.co_reference.trim();
 return (
 <tr key={li.id ?? idx} className="border-t border-brand-row-border align-top">
 <td className="py-2 px-3 text-cream max-w-[360px]">
 {li.description ? (
 <>
 <div className={expandedDescriptions.has(idx) ? "" : "line-clamp-2"}>
 {li.description}
 </div>
 {li.description.length > 100 && (
 <button
 type="button"
 onClick={() => setExpandedDescriptions(prev => {
 const next = new Set(prev);
 if (next.has(idx)) next.delete(idx);
 else next.add(idx);
 return next;
 })}
 className="text-[10px] text-teal hover:underline mt-0.5"
 >
 {expandedDescriptions.has(idx) ? "Show less" : "Show more"}
 </button>
 )}
 </>
 ) : (
 <span className="text-cream-dim italic">(no description)</span>
 )}
 {(li.qty != null || li.rate != null) && (
 <div className="text-[10px] text-cream-dim mt-0.5">
 {li.qty != null && <span>{li.qty}{li.unit ? ` ${li.unit}` : ""}</span>}
 {li.qty != null && li.rate != null && <span> × </span>}
 {li.rate != null && <span>${li.rate}</span>}
 </div>
 )}
 </td>
 <td className="py-2 px-3">
 <LineCostCodeSelect
 value={li.cost_code_id ?? ""}
 onChange={(v) => setLineItems(prev => prev.map((item, i) => i === idx ? { ...item, cost_code_id: v || null } : item))}
 options={lineCostCodeOptions}
 disabled={!isReviewable}
 aiSuggestion={aiSugActive ? { code: aiSug!.code, confidence: li.ai_suggestion_confidence ?? 0 } : null}
 />
 {(() => {
 // Budget allocation hint (Phase 6). Shows the matched budget
 // line's remaining amount and flags over-budget pushes.
 if (!li.cost_code_id) return null;
 const budget = budgetByCostCode.get(li.cost_code_id);
 if (!budget) return (
 <p className="mt-1 text-[10px] text-cream-dim">No budget line for this cost code</p>
 );
 const remainingAfter = budget.remaining - li.amount_cents;
 const willOver = remainingAfter < 0;
 return (
 <p className={`mt-1 text-[10px] ${willOver ? "text-status-danger font-medium" : "text-cream-dim"}`}>
 {willOver
 ? `Over budget by ${formatCents(Math.abs(remainingAfter))}`
 : `${formatCents(budget.remaining)} remaining · after: ${formatCents(remainingAfter)}`}
 </p>
 );
 })()}
 </td>
 <td className="py-2 px-3">
 <select
 value={li.po_id ?? ""}
 onChange={(e) => {
 const newPoId = e.target.value || null;
 const po = newPoId ? purchaseOrders.find(p => p.id === newPoId) : null;
 setLineItems(prev => prev.map((item, i) => {
 if (i !== idx) return item;
 return {
 ...item,
 po_id: newPoId,
 // If PO has a budget_line_id, try to match its cost code.
 cost_code_id: po?.budget_line_id
 ? (costCodes.find(c => budgetByCostCode.has(c.id))?.id ?? item.cost_code_id)
 : item.cost_code_id,
 };
 }));
 }}
 disabled={!isReviewable}
 className="w-full px-2 py-1 bg-brand-surface border border-brand-border text-xs text-cream focus:outline-none focus:border-teal disabled:opacity-50"
 >
 <option value="">— No PO —</option>
 {purchaseOrders.map(po => {
 const remaining = po.amount - po.invoiced_total;
 return (
 <option key={po.id} value={po.id}>
 {po.po_number ?? "—"}: {formatCents(remaining)} left
 </option>
 );
 })}
 </select>
 {(() => {
 if (!li.po_id) return null;
 const po = purchaseOrders.find(p => p.id === li.po_id);
 if (!po) return null;
 const remaining = po.amount - po.invoiced_total;
 const over = li.amount_cents > remaining;
 return (
 <p className={`mt-1 text-[10px] ${over ? "text-status-warning font-medium" : "text-cream-dim"}`}>
 {over
 ? `Exceeds PO by ${formatCents(li.amount_cents - remaining)}`
 : `${formatCents(remaining)} remaining on PO`}
 </p>
 );
 })()}
 </td>
 <td className="py-2 px-3 text-center">
 <button
 onClick={() => setLineItems(prev => prev.map((item, i) => {
 if (i !== idx) return item;
 const next = !item.is_change_order;
 return {
 ...item,
 is_change_order: next,
 cost_code_id: resolveVariant(costCodes, item.cost_code_id, next),
 co_reference: next ? item.co_reference : "",
 };
 }))}
 disabled={!isReviewable}
 className={`relative inline-flex h-5 w-9 items-center transition-colors disabled:opacity-50 ${li.is_change_order ? "bg-brass" : "bg-brand-border"}`}
 aria-label="Toggle Change Order"
 >
 <span className={`inline-block h-3 w-3 transform bg-white transition-transform ${li.is_change_order ? "translate-x-5" : "translate-x-1"}`} />
 </button>
 </td>
 <td className="py-2 px-3">
 {li.is_change_order ? (
 <input
 type="text"
 value={li.co_reference}
 onChange={(e) => setLineItems(prev => prev.map((item, i) => i === idx ? { ...item, co_reference: e.target.value } : item))}
 disabled={!isReviewable}
 placeholder="PCCO #"
 className={`w-full max-w-[140px] px-2 py-1 bg-brand-surface border text-xs text-cream focus:outline-none disabled:opacity-50 ${missingCoRef ? "border-status-danger" : "border-brand-border focus:border-teal"}`}
 />
 ) : (
 <span className="text-cream-dim">—</span>
 )}
 </td>
 <td className="py-2 px-3 text-right text-cream font-medium">${(li.amount_cents / 100).toFixed(2)}</td>
 </tr>
 );
 })}
 </tbody>
 <tfoot>
 <tr className="border-t-2 border-brand-border bg-brand-surface/40">
 <td colSpan={5} className="py-2 px-3 text-right text-cream-dim text-[11px] uppercase tracking-wider">Line Items Sum</td>
 <td className={`py-2 px-3 text-right font-medium ${hasAmountMismatch ? "text-status-danger" : "text-cream"}`}>
 {formatCents(lineItemSumCents)}
 </td>
 </tr>
 </tfoot>
 </table>
 </div>
 {hasAmountMismatch && (
 <div className="mt-2 px-3 py-2 bg-status-danger-muted border border-status-danger/20">
 <p className="text-xs text-status-danger font-medium">
 Line items sum ({formatCents(lineItemSumCents)}) does not match invoice total ({formatCents(totalCents)})
 </p>
 </div>
 )}
 {missingCoReference && (
 <div className="mt-2 px-3 py-2 bg-status-danger-muted border border-status-danger/20">
 <p className="text-xs text-status-danger font-medium">
 {lineItemsMissingCoReference.length} change-order line{lineItemsMissingCoReference.length === 1 ? "" : "s"} missing CO Reference
 </p>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Actions — desktop only (mobile uses sticky bar below) */}
 {isReviewable && (
 <div className="hidden md:block border-t border-brand-border pt-6 space-y-3">
 <div className="flex gap-3">
 <button
 onClick={openApproveFlow}
 disabled={saving || !!approveDisabledReason}
 title={approveDisabledReason ?? undefined}
 style={approveDisabledReason ? { cursor: "not-allowed" } : undefined}
 className={`flex-1 px-4 py-3 font-medium transition-all text-white ${
 approveDisabledReason
 ? "bg-gray-400 opacity-50 hover:bg-gray-400"
 : "bg-status-success hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
 }`}>
 {saving ? "Saving..." : "Approve"}
 </button>
 <button
 onClick={() => { setPartialApprovedIds(new Set()); setPartialNote(""); setPartialError(null); setShowPartialModal(true); }}
 disabled={saving || lineItems.length < 2 || !!approveDisabledReason}
 title={approveDisabledReason ?? (lineItems.length < 2 ? "Partial approval requires 2+ line items" : "Split this invoice into approved and held portions")}
 style={approveDisabledReason ? { cursor: "not-allowed" } : undefined}
 className={`flex-1 px-4 py-3 font-medium transition-all border-2 ${
 approveDisabledReason
 ? "bg-gray-100 border-gray-300 text-gray-400 opacity-60 hover:bg-gray-100 hover:text-gray-400"
 : "border-status-success text-status-success hover:bg-status-success hover:text-white disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-status-success"
 }`}>
 Partial Approve
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
 {/* Budget — stacked per unique cost code in line items */}
 <SidebarCard title="Budget Status">
 {uniqueLineCodeIds.length > 1 ? (
 <div className="space-y-4">
 {overBudgetByCode.map(s => {
 const cc = costCodes.find(c => c.id === s.ccId);
 return (
 <div key={s.ccId} className="border-b border-brand-border pb-3 last:border-b-0 last:pb-0">
 <div className="flex items-baseline justify-between mb-2">
 <span className="text-xs font-mono text-teal">{cc?.code ?? "???"}</span>
 <span className="flex items-center gap-1">
 {s.bi?.is_allowance && (
 <span className="inline-flex items-center px-1 py-0.5 text-[9px] font-bold bg-transparent text-teal border border-teal uppercase">Allowance</span>
 )}
 <span className="text-[10px] text-cream-dim truncate max-w-[120px] text-right">{cc?.description ?? ""}</span>
 </span>
 </div>
 {s.bi ? (
 <div className="space-y-1.5">
 <BudgetRow label="Budget" value={s.bi.revised_estimate} />
 <BudgetRow label="Spent" value={s.bi.total_spent} />
 <BudgetRow label="This Invoice" value={s.thisInvoicePortion} />
 <BudgetRow
 label="Remaining"
 value={s.bi.remaining - s.thisInvoicePortion}
 highlight={s.severity === "red" ? "danger" : s.severity === "orange" ? "danger" : s.severity === "yellow" ? "warning" : "success"}
 />
 {s.severity !== "none" && <OverBudgetAlert severity={s.severity} overage={s.overageCents} pct={s.pct} isAllowance={!!s.bi.is_allowance} />}
 </div>
 ) : (
 <div className="px-2 py-1.5 bg-status-danger-muted border border-status-danger/20">
 <p className="text-[11px] text-status-danger font-medium">No budget set — $0 budget line</p>
 <p className="text-[10px] text-cream-dim mt-0.5">Use Convert to Change Order or Approve as Overage.</p>
 </div>
 )}
 </div>
 );
 })}
 </div>
 ) : budgetInfo ? (() => {
 const singleClass = classifyOverBudget(
 budgetInfo.revised_estimate,
 budgetInfo.total_spent,
 totalCents,
 !!budgetInfo.is_allowance
 );
 return (
 <div className="space-y-3">
 {budgetInfo.is_allowance && (
 <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold bg-transparent text-teal border border-teal uppercase">Allowance</span>
 )}
 <BudgetRow label="Original Estimate" value={budgetInfo.original_estimate} />
 <BudgetRow label="Revised Estimate" value={budgetInfo.revised_estimate} />
 <BudgetRow label="Total Spent" value={budgetInfo.total_spent} />
 <div className="border-t border-brand-border pt-3">
 <BudgetRow label="Remaining" value={budgetInfo.remaining}
 highlight={singleClass.severity === "red" || singleClass.severity === "orange" ? "danger" : singleClass.severity === "yellow" ? "warning" : "success"} />
 </div>
 {singleClass.severity !== "none" && <OverBudgetAlert severity={singleClass.severity} overage={singleClass.overageCents} pct={singleClass.pct} isAllowance={!!budgetInfo.is_allowance} />}
 </div>
 );
 })() : (
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

 {/* Payment — Phase 8 */}
 <PaymentSection invoice={invoice} onRefresh={refreshInvoice} />

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
 <span className="text-cream-muted">{formatFlag(field)}</span>
 <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${confidenceColor(score as number)}`}>{Math.round((score as number) * 100)}%</span>
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
 <button
 onClick={openApproveFlow}
 disabled={saving || !!approveDisabledReason}
 title={approveDisabledReason ?? undefined}
 style={approveDisabledReason ? { cursor: "not-allowed" } : undefined}
 className={`flex-1 px-2 py-3 font-medium transition-all text-white text-sm ${
 approveDisabledReason
 ? "bg-gray-400 opacity-50 hover:bg-gray-400"
 : "bg-status-success hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
 }`}>
 {saving ? "..." : "Approve"}
 </button>
 <button
 onClick={() => { setPartialApprovedIds(new Set()); setPartialNote(""); setPartialError(null); setShowPartialModal(true); }}
 disabled={saving || lineItems.length < 2 || !!approveDisabledReason}
 title={approveDisabledReason ?? undefined}
 style={approveDisabledReason ? { cursor: "not-allowed" } : undefined}
 className={`flex-1 px-2 py-3 font-medium transition-all text-sm border ${
 approveDisabledReason
 ? "bg-gray-100 border-gray-300 text-gray-400 opacity-60 hover:bg-gray-100 hover:text-gray-400"
 : "border-status-success text-status-success hover:bg-status-success hover:text-white disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-status-success"
 }`}>
 Partial
 </button>
 <button onClick={() => setShowNoteModal("hold")} disabled={saving}
 className="flex-1 px-2 py-3 bg-brass hover:brightness-110 disabled:opacity-50 text-brand-bg font-medium transition-all text-sm">
 Hold
 </button>
 <button onClick={() => setShowNoteModal("deny")} disabled={saving}
 className="flex-1 px-2 py-3 bg-status-danger hover:brightness-110 disabled:opacity-50 text-white font-medium transition-all text-sm">
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
 <h3 className="font-display text-xl text-cream mb-2">
 {isCreditMemo ? "Approve Credit Memo" : "Approve Invoice"}
 </h3>

 {isCreditMemo && (
 <p className="text-sm text-cream-muted mb-3">
 Approve credit of {formatCents(Math.abs(totalCents))} from {invoice.vendor_name_raw ?? "Unknown"}?
 </p>
 )}

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
 <span className={`font-display font-medium ${isCreditMemo ? "text-teal" : "text-brass"}`}>{formatCents(totalCents)}</span>
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
 <span className="text-cream-dim">Default Cost Code</span>
 <span className="text-cream">{selectedCostCode ? `${selectedCostCode.code} — ${selectedCostCode.description}` : "Not assigned"}</span>
 </div>
 {uniqueLineCodeIds.length > 1 && (
 <div className="flex justify-between">
 <span className="text-cream-dim">Cost Code Split</span>
 <span className="text-cream">{uniqueLineCodeIds.length} codes across {lineItems.length} lines</span>
 </div>
 )}
 {isChangeOrder && (
 <div className="flex justify-between">
 <span className="text-cream-dim">Change Order</span>
 <span className="text-brass">{coReference || "Yes"}</span>
 </div>
 )}
 </div>

 <div className="flex gap-3 mt-5">
 <button
 onClick={() => { setShowApproveConfirm(false); handleAction("approve"); }}
 disabled={saving}
 className="flex-1 px-4 py-2.5 bg-status-success hover:brightness-110 text-white font-medium disabled:opacity-50 transition-all">
 {isCreditMemo ? "Confirm Credit Approval" : "Confirm Approval"}
 </button>
 <button onClick={() => setShowApproveConfirm(false)}
 className="flex-1 px-4 py-2.5 border border-brand-border text-cream-muted hover:border-brand-border-light transition-colors">
 Cancel
 </button>
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
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="bg-brand-card border border-status-danger/40 p-6 w-full max-w-lg animate-fade-up shadow-2xl">
 <div className="flex items-center gap-3 mb-4">
 <div className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${hasRed ? "bg-status-danger-muted" : "bg-status-warning-muted"}`}>
 <svg className={`w-5 h-5 ${hasRed ? "text-status-danger" : "text-status-warning"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
 </svg>
 </div>
 <h3 className="font-display text-xl text-cream">
 {hasRed ? "Over Budget — Review Required" : "Over Budget — Note Required"}
 </h3>
 </div>
 <p className="text-sm text-cream-muted mb-3">
 This invoice exceeds the budget on {overBudgetByCode.filter(r => r.severity !== "none").length} cost code(s):
 </p>
 <ul className="bg-brand-surface border border-brand-border p-3 space-y-1 mb-4 max-h-40 overflow-y-auto">
 {overBudgetByCode.filter(r => r.severity !== "none").map(r => (
 <li key={r.ccId} className="text-xs text-cream-muted flex justify-between">
 <span>
 <span className="font-mono text-teal">{formatCc(r.ccId)}</span>
 {r.bi?.is_allowance && <span className="ml-1 text-teal">[Allowance]</span>}
 </span>
 <span className={r.severity === "red" ? "text-status-danger" : r.severity === "orange" ? "text-status-warning" : "text-brass"}>
 +{formatCents(r.overageCents)} ({r.pct.toFixed(1)}%)
 </span>
 </li>
 ))}
 </ul>

 {hasAllowanceOverage && (
 <div className="mb-4 px-3 py-2 bg-teal/10 border border-teal/30">
 <p className="text-xs text-teal font-medium">Allowance overage detected</p>
 <p className="text-[11px] text-cream-dim mt-0.5">
 Allowances are expected to generate change orders — &quot;Convert to Change Order&quot; is the recommended path.
 </p>
 </div>
 )}

 <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">
 {hasRed ? "Overage Note (required if approving as overage)" : "Overage Note (required)"}
 </label>
 <textarea
 value={overBudgetNote}
 onChange={(e) => setOverBudgetNote(e.target.value)}
 placeholder={`Why is this going over? (e.g. "Client requested ${orangeRows.length > 0 && orangeRows[0].bi?.is_allowance ? "tile upgrade" : "additional scope"}"`}
 className="w-full h-20 px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream placeholder-cream-dim focus:border-teal focus:outline-none resize-none"
 />

 <div className="flex flex-col gap-2 mt-5">
 {hasRed && (
 <button
 onClick={handleConvertToChangeOrder}
 className="w-full px-4 py-2.5 bg-teal hover:bg-teal-hover text-brand-bg font-medium transition-all">
 Convert to Change Order
 </button>
 )}
 <div className="flex gap-3">
 <button
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
 className={`flex-1 px-4 py-2.5 font-medium disabled:opacity-50 transition-all ${hasRed ? "bg-status-danger text-white" : "bg-status-success text-white"} hover:brightness-110`}>
 {hasRed ? "Approve as Overage" : "Approve With Note"}
 </button>
 <button
 onClick={() => { setShowOverBudgetModal(false); setOverBudgetNote(""); }}
 className="flex-1 px-4 py-2.5 border border-brand-border text-cream-muted hover:border-brand-border-light transition-colors">
 Cancel
 </button>
 </div>
 </div>
 </div>
 </div>
 );
 })()}

 {/* ── Amount Guard Modal (>10% over AI-parsed) ── */}
 {showAmountGuard && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="bg-brand-card border border-status-danger/40 p-6 w-full max-w-md animate-fade-up shadow-2xl">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 bg-status-danger-muted flex items-center justify-center flex-shrink-0">
 <svg className="w-5 h-5 text-status-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
 </svg>
 </div>
 <h3 className="font-display text-xl text-cream">Amount Change Requires Note</h3>
 </div>
 <p className="text-sm text-cream-muted mb-4">
 You&apos;re approving <span className="font-medium text-cream">{formatCents(totalCents)}</span>, which is{" "}
 <span className="text-status-danger font-medium">+{amountIncreasePct.toFixed(1)}%</span> over the AI-parsed total of{" "}
 <span className="text-cream">{formatCents(aiParsedTotal)}</span>. A note is required for any increase over 10%.
 </p>
 <textarea
 value={amountGuardNote}
 onChange={(e) => setAmountGuardNote(e.target.value)}
 placeholder="Reason for the amount change (required)..."
 className="w-full h-24 px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream placeholder-cream-dim focus:border-teal focus:outline-none resize-none"
 />
 <div className="flex gap-3 mt-5">
 <button
 onClick={() => {
 if (!amountGuardNote.trim()) return;
 setShowAmountGuard(false);
 handleAction("approve", `Amount adjusted from ${formatCents(aiParsedTotal)} to ${formatCents(totalCents)} (+${amountIncreasePct.toFixed(1)}%). Reason: ${amountGuardNote.trim()}`);
 setAmountGuardNote("");
 }}
 disabled={!amountGuardNote.trim() || saving}
 className="flex-1 px-4 py-2.5 bg-status-success hover:brightness-110 text-white font-medium disabled:opacity-50 transition-all">
 Approve With Note
 </button>
 <button onClick={() => { setShowAmountGuard(false); setAmountGuardNote(""); }}
 className="flex-1 px-4 py-2.5 border border-brand-border text-cream-muted hover:border-brand-border-light transition-colors">
 Cancel
 </button>
 </div>
 </div>
 </div>
 )}

 {/* ── Missing CO Reference Modal ── */}
 {showMissingCoBlock && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="bg-brand-card border border-brand-border p-6 w-full max-w-md animate-fade-up shadow-2xl">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 bg-status-danger-muted flex items-center justify-center flex-shrink-0">
 <svg className="w-5 h-5 text-status-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
 </svg>
 </div>
 <h3 className="font-display text-xl text-cream">CO Reference Required</h3>
 </div>
 <p className="text-sm text-cream-muted mb-3">
 {lineItemsMissingCoReference.length} change-order line item{lineItemsMissingCoReference.length === 1 ? "" : "s"} need a CO Reference (e.g. &quot;PCCO #3&quot;) before approval.
 </p>
 <ul className="bg-brand-surface border border-brand-border p-3 space-y-1 mb-5 max-h-40 overflow-y-auto">
 {lineItemsMissingCoReference.map((l, i) => (
 <li key={l.id ?? i} className="text-xs text-cream-muted">
 Line {l.line_index + 1}: {l.description || "(no description)"} — {formatCents(l.amount_cents)}
 </li>
 ))}
 </ul>
 <button
 onClick={() => setShowMissingCoBlock(false)}
 className="w-full px-4 py-2.5 bg-teal hover:bg-teal-hover text-brand-bg font-medium transition-colors">
 Go Back and Fill In
 </button>
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

 {/* ── Partial Approve Modal ── */}
 {showPartialModal && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
 <div className="bg-brand-card border border-brand-border p-6 w-full max-w-3xl max-h-[92vh] overflow-y-auto animate-fade-up shadow-2xl">
 <h3 className="font-display text-xl text-cream mb-2">Partial Approval</h3>
 <p className="text-sm text-cream-dim mb-5">
 Check the lines to approve now. The rest stays on Hold with a required note. Approved lines split into a new invoice that flows to QA; held lines remain on this record.
 </p>
 <div className="border border-brand-border">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-brand-border text-[11px] uppercase tracking-wider text-cream-dim bg-brand-surface/50">
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
 <tr key={id} className={`border-b border-brand-row-border last:border-0 ${checked ? "bg-status-success/5" : ""}`}>
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
 <td className="px-3 py-2 text-cream">
 <span className="line-clamp-2">{li.description || "—"}</span>
 {li.is_change_order && li.co_reference && (
 <span className="ml-2 text-[10px] uppercase tracking-wider text-brass">CO {li.co_reference}</span>
 )}
 </td>
 <td className="px-3 py-2 text-cream-muted text-xs font-mono">
 {cc ? `${cc.code} ${cc.description}` : "—"}
 </td>
 <td className="px-3 py-2 text-right text-cream tabular-nums">{formatCents(li.amount_cents)}</td>
 </tr>
 );
 })}
 </tbody>
 <tfoot>
 <tr className="border-t-2 border-brand-border bg-brand-surface">
 <td colSpan={3} className="px-3 py-2 text-[11px] uppercase tracking-wider text-cream-dim">
 Approving {partialApprovedIds.size} of {lineItems.length} lines
 </td>
 <td className="px-3 py-2 text-right text-status-success font-display tabular-nums">
 {formatCents(lineItems.filter((l) => l.id && partialApprovedIds.has(l.id)).reduce((s, l) => s + l.amount_cents, 0))}
 </td>
 </tr>
 <tr className="bg-brand-surface">
 <td colSpan={3} className="px-3 py-2 text-[11px] uppercase tracking-wider text-cream-dim">
 Holding the remaining
 </td>
 <td className="px-3 py-2 text-right text-brass font-display tabular-nums">
 {formatCents(lineItems.filter((l) => l.id && !partialApprovedIds.has(l.id)).reduce((s, l) => s + l.amount_cents, 0))}
 </td>
 </tr>
 </tfoot>
 </table>
 </div>

 <div className="mt-5">
 <label className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5 block">
 Why is the rest held? (required)
 </label>
 <textarea
 value={partialNote}
 onChange={(e) => setPartialNote(e.target.value)}
 rows={3}
 placeholder="e.g. Scope on lines 3-5 wasn't agreed — waiting on confirmation from vendor"
 className="w-full px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream placeholder-cream-dim focus:border-teal focus:outline-none resize-none"
 />
 </div>

 {partialError && (
 <div className="mt-3 border border-status-danger/40 bg-status-danger/5 px-4 py-2 text-sm text-status-danger">
 {partialError}
 </div>
 )}

 <div className="flex gap-3 mt-5 pt-4 border-t border-brand-border">
 <button
 disabled={partialSubmitting || partialApprovedIds.size === 0 || partialApprovedIds.size === lineItems.length || !partialNote.trim()}
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
 className="flex-1 px-4 py-2.5 bg-status-success hover:brightness-110 disabled:opacity-50 text-white font-medium transition-all"
 >
 {partialSubmitting ? "Splitting…" : `Approve ${partialApprovedIds.size} line${partialApprovedIds.size !== 1 ? "s" : ""} & hold the rest`}
 </button>
 <button onClick={() => setShowPartialModal(false)}
 className="px-5 py-2.5 border border-brand-border text-cream-muted hover:border-brand-border-light transition-colors">
 Cancel
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}

// Graduated over-budget badge used in the budget sidebar.
// Yellow  (≤10% over)  — soft warning; PM can still approve normally.
// Orange  (10-25% over) — note required at approve time.
// Red     (>25% over OR $0 budget OR allowance) — forces the over-budget modal.
function OverBudgetAlert({ severity, overage, pct, isAllowance }: {
 severity: "yellow" | "orange" | "red";
 overage: number;
 pct: number;
 isAllowance: boolean;
}) {
 const colorMap: Record<string, { bg: string; border: string; text: string; label: string }> = {
 yellow: { bg: "bg-status-warning-muted", border: "border-brass/30", text: "text-brass", label: "Over budget" },
 orange: { bg: "bg-status-warning-muted", border: "border-status-warning/40", text: "text-status-warning", label: "Significantly over budget" },
 red: { bg: "bg-status-danger-muted", border: "border-status-danger/40", text: "text-status-danger", label: isAllowance ? "Allowance overage" : "Severely over budget" },
 };
 const c = colorMap[severity];
 const fmt = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
 return (
 <div className={`mt-3 p-3 ${c.bg} border ${c.border}`}>
 <div className="flex items-start gap-2">
 <svg className={`w-4 h-4 ${c.text} shrink-0 mt-0.5`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M4.93 19.07A10 10 0 1119.07 4.93 10 10 0 014.93 19.07z" />
 </svg>
 <div className="flex-1 min-w-0">
 <p className={`text-xs ${c.text} font-semibold break-words`}>
 {c.label}
 </p>
 <p className={`text-[11px] ${c.text}/90 mt-0.5 break-words`}>
 +{fmt(overage)} · {pct.toFixed(1)}% over
 </p>
 {severity === "orange" && (
 <p className="text-[11px] text-cream-dim mt-1.5 leading-snug">
 A note is required at approval time.
 </p>
 )}
 {severity === "red" && (
 <p className="text-[11px] text-cream-dim mt-1.5 leading-snug">
 {isAllowance
 ? "Allowances usually become change orders. Use Convert to Change Order below."
 : "Approve as overage with a note, or convert to a formal change order."}
 </p>
 )}
 </div>
 </div>
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
 <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold mr-1.5 bg-transparent border ${
 entry.source === "PM" ? "text-teal border-teal" : "text-brass border-brass"
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

// Phase 8 — payment actions panel (Schedule Payment / Mark as Paid / Reverse).
function PaymentSection({
 invoice,
 onRefresh,
}: {
 invoice: InvoiceData;
 onRefresh: () => void;
}) {
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [showPayModal, setShowPayModal] = useState(false);
 const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
 const [payMethod, setPayMethod] = useState<"check" | "ach" | "wire" | "credit_card">("check");
 const [payReference, setPayReference] = useState("");
 const [payAmount, setPayAmount] = useState((invoice.total_amount / 100).toFixed(2));

 const status = invoice.payment_status ?? "unpaid";
 const canPay = ["pm_approved", "qa_review", "qa_approved", "pushed_to_qb", "in_draw", "paid"].includes(invoice.status);

 async function call(body: Record<string, unknown>) {
 setBusy(true);
 setError(null);
 const res = await fetch(`/api/invoices/${invoice.id}/payment`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(body),
 });
 if (!res.ok) {
 const data = await res.json().catch(() => ({ error: "Failed" }));
 setError(data.error ?? "Failed");
 } else {
 onRefresh();
 setShowPayModal(false);
 }
 setBusy(false);
 }

 return (
 <>
 <SidebarCard title="Payment">
 <div className="space-y-2.5 text-sm">
 <div className="flex justify-between items-center">
 <span className="text-cream-muted">Status</span>
 <span
 className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium border ${
 status === "paid"
 ? "border-status-success text-status-success"
 : status === "scheduled"
 ? "border-teal text-teal"
 : status === "partial"
 ? "border-brass text-brass"
 : "border-brand-border-light text-cream-dim"
 }`}
 >
 {status}
 </span>
 </div>
 <div className="flex justify-between"><span className="text-cream-muted">Received</span><span className="text-cream-muted">{formatDate(invoice.received_date)}</span></div>
 {invoice.scheduled_payment_date && (
 <div className="flex justify-between"><span className="text-cream-muted">Scheduled</span><span className="text-cream">{formatDate(invoice.scheduled_payment_date)}</span></div>
 )}
 {invoice.payment_date && (
 <div className="flex justify-between"><span className="text-cream-muted">Paid</span><span className="text-cream">{formatDate(invoice.payment_date)}</span></div>
 )}
 {invoice.payment_method && (
 <div className="flex justify-between"><span className="text-cream-muted">Method</span><span className="text-cream">{invoice.payment_method}</span></div>
 )}
 {invoice.payment_reference && (
 <div className="flex justify-between"><span className="text-cream-muted">Reference</span><span className="text-cream font-mono text-xs">{invoice.payment_reference}</span></div>
 )}
 <div className="flex justify-between border-t border-brand-border pt-2.5">
 <span className="text-cream-muted">Total</span>
 <span className="text-cream font-display text-base font-medium">{formatCents(invoice.total_amount)}</span>
 </div>
 {invoice.payment_amount != null && invoice.payment_amount !== invoice.total_amount && (
 <div className="flex justify-between">
 <span className="text-cream-muted">Paid so far</span>
 <span className="text-brass font-display font-medium">{formatCents(invoice.payment_amount)}</span>
 </div>
 )}
 </div>

 {error && (
 <div className="mt-3 bg-status-danger/10 border border-status-danger/40 px-3 py-2 text-xs text-status-danger">
 {error}
 </div>
 )}

 {canPay && (
 <div className="mt-4 flex flex-col gap-2">
 {status === "unpaid" && (
 <button
 onClick={() => call({ action: "schedule" })}
 disabled={busy}
 className="px-3 py-2 border border-teal text-teal hover:bg-teal/10 disabled:opacity-50 text-sm font-medium transition-colors"
 >
 {busy ? "Scheduling…" : "Schedule Payment"}
 </button>
 )}
 {status !== "paid" && (
 <button
 onClick={() => setShowPayModal(true)}
 disabled={busy}
 className="px-3 py-2 bg-teal hover:bg-teal-hover disabled:opacity-50 text-white text-sm font-medium transition-colors"
 >
 Mark as Paid
 </button>
 )}
 {(status === "paid" || status === "partial") && (
 <button
 onClick={() => {
 if (window.confirm("Reverse payment? This unmarks the invoice and clears payment fields.")) {
 call({ action: "reverse" });
 }
 }}
 disabled={busy}
 className="px-3 py-2 border border-status-danger text-status-danger hover:bg-status-danger/10 disabled:opacity-50 text-sm font-medium transition-colors"
 >
 Reverse Payment
 </button>
 )}
 </div>
 )}
 </SidebarCard>

 {showPayModal && (
 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={() => setShowPayModal(false)}>
 <div className="bg-brand-card border border-brand-border max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
 <h3 className="font-display text-lg text-cream mb-1">Mark Invoice as Paid</h3>
 <p className="text-sm text-cream-dim mb-4">{invoice.vendor_name_raw ?? "Vendor"} — {formatCents(invoice.total_amount)}</p>
 <div className="space-y-3">
 <label className="block">
 <span className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1 block">Payment Date</span>
 <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="w-full px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none" />
 </label>
 <label className="block">
 <span className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1 block">Amount (dollars)</span>
 <input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none" />
 </label>
 <label className="block">
 <span className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1 block">Method</span>
 <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as typeof payMethod)} className="w-full px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none">
 <option value="check">Check</option>
 <option value="ach">ACH</option>
 <option value="wire">Wire</option>
 <option value="credit_card">Credit Card</option>
 </select>
 </label>
 <label className="block">
 <span className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1 block">Reference (check #, txn ID)</span>
 <input type="text" value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="e.g. 10452" className="w-full px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none" />
 </label>
 </div>
 <div className="mt-5 flex items-center justify-end gap-3">
 <button onClick={() => setShowPayModal(false)} className="px-4 py-2 text-cream-dim hover:text-cream text-sm">Cancel</button>
 <button
 onClick={() =>
 call({
 action: "mark_paid",
 payment_date: payDate,
 payment_amount: Math.round(Number(payAmount) * 100),
 payment_method: payMethod,
 payment_reference: payReference || null,
 })
 }
 disabled={busy}
 className="px-4 py-2 bg-teal hover:bg-teal-hover disabled:opacity-60 text-white text-sm font-medium transition-colors"
 >
 {busy ? "Recording…" : "Record Payment"}
 </button>
 </div>
 </div>
 </div>
 )}
 </>
 );
}
