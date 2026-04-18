"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/app-shell";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDollars, formatStatus, formatFlag, formatInvoiceType, confidenceColor, formatDate, formatDateTime, formatWho, statusBadgeOutline } from "@/lib/utils/format";

interface QaLineItem {
 id: string;
 line_index: number;
 description: string | null;
 amount_cents: number;
 cost_code_id: string | null;
 is_change_order: boolean;
 co_reference: string | null;
 cost_codes: { id: string; code: string; description: string } | null;
}

interface InvoiceData {
 id: string; job_id: string | null; vendor_name_raw: string | null; invoice_number: string | null;
 invoice_date: string | null; description: string | null; total_amount: number; invoice_type: string | null;
 is_change_order?: boolean;
 confidence_score: number;
 confidence_details: (Record<string, number> & { auto_fills?: Record<string, boolean> }) | null;
 status: string; status_history: Array<Record<string, unknown>>;
 received_date: string | null; payment_date: string | null; original_file_type: string | null;
 signed_file_url: string | null;
 jobs: { id: string; name: string } | null;
 cost_codes: { id: string; code: string; description: string } | null;
 vendors: { id: string; name: string } | null;
 line_items: Array<{ description: string; qty: number | null; rate: number | null; amount: number }>;
 invoice_line_items: QaLineItem[];
}

function statusDotColor(newStatus: string): string {
 if (["pm_approved", "qa_approved", "pushed_to_qb", "in_draw", "paid"].includes(newStatus)) return "bg-nw-success";
 if (["pm_held", "request_info"].includes(newStatus)) return "bg-nw-warn";
 if (["pm_denied", "qa_kicked_back", "void"].includes(newStatus)) return "bg-nw-danger";
 return "bg-slate-deep";
}

export default function QaReviewPage() {
 const params = useParams();
 const router = useRouter();
 const invoiceId = params.id as string;

 const [invoice, setInvoice] = useState<InvoiceData | null>(null);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [vendorName, setVendorName] = useState("");
 const [qbNotes, setQbNotes] = useState("");
 const [showKickBack, setShowKickBack] = useState(false);
 const [kickBackNote, setKickBackNote] = useState("");
 const [userNames, setUserNames] = useState<Map<string, string>>(new Map());

 useEffect(() => {
 async function fetch() {
 const res = await window.fetch(`/api/invoices/${invoiceId}`);
 if (res.ok) {
 const data: InvoiceData = await res.json();
 // QA page only applies while invoice is in QA flow; redirect otherwise.
 if (!["qa_review", "pm_approved"].includes(data.status)) {
 router.replace(`/invoices/${invoiceId}`);
 return;
 }
 setInvoice(data);
 setVendorName(data.vendor_name_raw ?? "");
 }
 setLoading(false);
 }
 fetch();
 }, [invoiceId, router]);

 // Resolve status_history `who` UUIDs to real names for the sidebar.
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
 (async () => {
 const { data } = await supabase
 .from("profiles")
 .select("id, full_name")
 .in("id", Array.from(ids));
 if (!data) return;
 setUserNames((prev) => {
 const next = new Map(prev);
 for (const row of data as Array<{ id: string; full_name: string | null }>) {
 if (row.full_name) next.set(row.id, row.full_name);
 }
 return next;
 });
 })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [invoice?.status_history]);

 const handleQaApprove = async () => {
 setSaving(true);
 const qaOverrides: Record<string, { old: unknown; new: unknown }> = {};
 if (vendorName !== (invoice?.vendor_name_raw ?? "")) {
 qaOverrides.vendor_name_raw = { old: invoice?.vendor_name_raw, new: vendorName };
 }
 const updates: Record<string, unknown> = {};
 if (vendorName !== (invoice?.vendor_name_raw ?? "")) updates.vendor_name_raw = vendorName;

 await window.fetch(`/api/invoices/${invoiceId}/action`, {
 method: "POST", headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 action: "qa_approve",
 note: qbNotes ? `QA approved. QB notes: ${qbNotes}` : "QA approved",
 qa_overrides: Object.keys(qaOverrides).length > 0 ? qaOverrides : undefined,
 updates: Object.keys(updates).length > 0 ? updates : undefined,
 }),
 });
 setSaving(false);
 router.push("/invoices/qa");
 };

 const handleKickBack = async () => {
 if (!kickBackNote.trim()) return;
 setSaving(true);
 await window.fetch(`/api/invoices/${invoiceId}/action`, {
 method: "POST", headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ action: "kick_back", note: kickBackNote.trim() }),
 });
 setSaving(false);
 router.push("/invoices/qa");
 };

 if (loading) return (
 <AppShell><div className="flex items-center justify-center py-32"><div className="w-8 h-8 border-2 border-stone-blue/30 border-t-teal animate-spin" /></div></AppShell>
 );
 if (!invoice) return (
 <AppShell><div className="flex items-center justify-center py-32"><p className="text-nw-danger font-display text-lg">Invoice not found</p></div></AppShell>
 );

 const isQaReviewable = ["qa_review", "pm_approved"].includes(invoice.status);

 return (
 <AppShell>

 {/* Sub-header */}
 <div className="border-b border-border-def bg-bg-sub/50 px-6 py-3">
 <div className="max-w-[1600px] mx-auto flex items-center gap-4 flex-wrap">
 <h1 className="font-display text-xl text-slate-tile">
 {invoice.vendor_name_raw ?? "Invoice"} <span className="text-tertiary">&mdash;</span> {invoice.invoice_number ?? "No #"}
 </h1>
 <span className={`inline-flex items-center text-xs px-3 py-1 font-medium ${statusBadgeOutline(invoice.status)}`}>
 {formatStatus(invoice.status)}
 </span>
 </div>
 </div>

 <main className="max-w-[1600px] mx-auto px-6 py-6">
 <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-fade-up">
 {/* ── Left: Document Preview ── */}
 <div className="xl:col-span-1">
 <div className="sticky top-28">
 <p className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-3 brass-underline">Original Document</p>
 <div className="mt-5">
 {invoice.signed_file_url ? (
 invoice.original_file_type === "image" ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img src={invoice.signed_file_url} alt="Invoice" className="w-full border border-border-def" />
 ) : (
 <iframe src={invoice.signed_file_url} className="w-full h-[700px] border border-border-def bg-bg-sub" title="Invoice PDF" />
 )
 ) : (
 <div className="h-64 border border-border-def bg-bg-sub flex items-center justify-center">
 <p className="text-tertiary text-sm">No preview available</p>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* ── Middle: QA Form ── */}
 <div className="xl:col-span-1 space-y-6 animate-fade-up stagger-2">
 <p className="text-[11px] font-medium text-tertiary uppercase tracking-wider brass-underline">QA Review</p>

 <div className="mt-5 space-y-4">
 {/* Vendor — editable by QA */}
 <div>
 <label className="flex items-center gap-2 text-[11px] font-medium text-tertiary uppercase tracking-wider mb-1.5">
 Vendor Name
 <span className="text-[10px] text-stone-blue normal-case tracking-normal">(editable — match to QuickBooks)</span>
 </label>
 <input value={vendorName} onChange={(e) => setVendorName(e.target.value)}
 disabled={!isQaReviewable}
 className="w-full px-3 py-2.5 bg-bg-sub border border-stone-blue/30 text-sm text-slate-tile focus:border-stone-blue focus:outline-none disabled:opacity-50" />
 </div>

 {/* QB Notes */}
 <div>
 <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-1.5 block">QB Mapping Notes</label>
 <textarea value={qbNotes} onChange={(e) => setQbNotes(e.target.value)} rows={2} placeholder="Optional notes for QuickBooks entry..."
 disabled={!isQaReviewable}
 className="w-full px-3 py-2.5 bg-bg-sub border border-border-def text-sm text-slate-tile placeholder-cream-dim focus:border-stone-blue focus:outline-none disabled:opacity-50 resize-none" />
 </div>

 {/* Locked PM-approved fields */}
 <div className="border-t border-border-def pt-4">
 <p className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-1 flex items-center gap-2">
 PM Approved Fields
 <svg className="w-3.5 h-3.5 text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
 </svg>
 </p>
 {(() => {
 const approvalEntry = [...(invoice.status_history ?? [])].reverse().find(e => String(e.new_status) === "pm_approved");
 if (!approvalEntry) return null;
 return (
 <p className="text-[11px] text-tertiary mb-3">
 Approved by {String(approvalEntry.who)} &mdash; {formatDateTime(String(approvalEntry.when))}
 </p>
 );
 })()}
 <div className="space-y-3">
 <LockedField label="Job" value={invoice.jobs?.name ?? "Not assigned"} />
 <LockedField label="Cost Code" value={invoice.cost_codes ? `${invoice.cost_codes.code} — ${invoice.cost_codes.description}` : "Not assigned"} />
 <div className="grid grid-cols-2 gap-3">
 <LockedField label="Amount" value={formatCents(invoice.total_amount)} />
 <LockedField label="Invoice #" value={invoice.invoice_number ?? "—"} />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <LockedField label="Date" value={formatDate(invoice.invoice_date)} />
 <LockedField label="Type" value={formatInvoiceType(invoice.invoice_type)} />
 </div>
 {invoice.description && <LockedField label="Description" value={invoice.description} />}
 </div>
 </div>

 {/* Line Items — read-only with assigned cost codes (PM owns these) */}
 {invoice.invoice_line_items?.length > 0 ? (
 <div className="border-t border-border-def pt-4">
 <p className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-2 flex items-center gap-2">
 Line Items
 <svg className="w-3.5 h-3.5 text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
 </svg>
 <span className="text-[10px] text-tertiary normal-case tracking-normal">PM-assigned — kick back to change</span>
 </p>
 <div className="overflow-x-auto border border-border-def">
 <table className="w-full text-xs">
 <thead><tr className="bg-bg-sub">
 <th className="py-2 px-3 text-left text-slate-tile font-semibold">Description</th>
 <th className="py-2 px-3 text-left text-slate-tile font-semibold">Cost Code</th>
 <th className="py-2 px-3 text-center text-slate-tile font-semibold">CO</th>
 <th className="py-2 px-3 text-right text-slate-tile font-semibold">Amount</th>
 </tr></thead>
 <tbody>
 {invoice.invoice_line_items.map((li) => (
 <tr key={li.id} className="border-t border-border-sub">
 <td className="py-2 px-3 text-slate-tile">{li.description ?? <span className="text-tertiary italic">(no description)</span>}</td>
 <td className="py-2 px-3 text-secondary">
 {li.cost_codes ? (
 <span className="font-mono text-stone-blue">{li.cost_codes.code}</span>
 ) : (
 <span className="text-tertiary">—</span>
 )}
 {li.cost_codes && <span className="ml-1">{li.cost_codes.description}</span>}
 </td>
 <td className="py-2 px-3 text-center">
 {li.is_change_order ? (
 <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-transparent text-nw-warn border border-nw-warn">
 {li.co_reference || "CO"}
 </span>
 ) : (
 <span className="text-tertiary">—</span>
 )}
 </td>
 <td className="py-2 px-3 text-right text-slate-tile font-medium">{formatCents(li.amount_cents)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 ) : invoice.line_items?.length > 0 && (
 <div className="border-t border-border-def pt-4">
 <p className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-2">Line Items</p>
 <div className="overflow-x-auto border border-border-def">
 <table className="w-full text-xs">
 <thead><tr className="bg-bg-sub">
 <th className="py-2 px-3 text-left text-slate-tile font-semibold">Description</th>
 <th className="py-2 px-3 text-right text-slate-tile font-semibold">Amount</th>
 </tr></thead>
 <tbody>
 {invoice.line_items.map((item, i) => (
 <tr key={i} className="border-t border-border-sub">
 <td className="py-2 px-3 text-slate-tile">{item.description}</td>
 <td className="py-2 px-3 text-right text-slate-tile font-medium">{item.amount ? formatDollars(item.amount) : "—"}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>

 {/* Actions */}
 {isQaReviewable && (
 <div className="border-t border-border-def pt-6 space-y-3">
 <div className="flex gap-3">
 <button onClick={handleQaApprove} disabled={saving}
 className="flex-1 px-4 py-3 bg-nw-success hover:brightness-110 disabled:opacity-50 text-white font-medium transition-all">
 {saving ? "Saving..." : "QA Approve"}
 </button>
 <button onClick={() => setShowKickBack(true)} disabled={saving}
 className="flex-1 px-4 py-3 bg-nw-danger hover:brightness-110 disabled:opacity-50 text-white font-medium transition-all">
 Kick Back to PM
 </button>
 </div>
 </div>
 )}
 </div>

 {/* ── Right: Sidebar ── */}
 <div className="xl:col-span-1 animate-fade-up stagger-4">
 <div className="sticky top-28 space-y-5">
 {/* Payment */}
 <div className="bg-white border border-border-def p-5">
 <p className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-4 brass-underline">Payment</p>
 <div className="mt-5 space-y-2.5 text-sm">
 <div className="flex justify-between"><span className="text-tertiary">Received</span><span className="text-slate-tile">{formatDate(invoice.received_date)}</span></div>
 <div className="flex justify-between"><span className="text-tertiary">Scheduled</span><span className="text-slate-tile">{formatDate(invoice.payment_date)}</span></div>
 <div className="flex justify-between border-t border-border-def pt-2.5"><span className="text-tertiary">Amount</span><span className="text-nw-warn font-display text-base font-medium">{formatCents(invoice.total_amount)}</span></div>
 </div>
 </div>

 {/* AI Confidence */}
 {invoice.confidence_details && (
 <div className="bg-white border border-border-def p-5">
 <p className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-4 brass-underline">AI Confidence</p>
 <div className="mt-5 space-y-2">
 {Object.entries(invoice.confidence_details)
 .filter(([f, s]) => f !== "auto_fills" && typeof s === "number")
 .map(([field, score]) => (
 <div key={field} className="flex items-center justify-between text-sm">
 <span className="text-tertiary">{formatFlag(field)}</span>
 <span className={`px-2 py-0.5 text-xs ${confidenceColor(score as number)}`}>{Math.round((score as number) * 100)}%</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Status History */}
 {invoice.status_history?.length > 0 && (
 <div className="bg-white border border-border-def p-5">
 <p className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-4 brass-underline">Status History</p>
 <div className="mt-5 space-y-0">
 {[...invoice.status_history].reverse().map((entry, i) => {
 const ns = String(entry.new_status);
 return (
 <div key={i} className="relative pl-6 pb-4 last:pb-0">
 {i < invoice.status_history.length - 1 && <div className="absolute left-[7px] top-3 bottom-0 w-px bg-brand-border" />}
 <div className={`absolute left-0 top-1 w-[15px] h-[15px] border-2 border-brand-card ${statusDotColor(ns)}`} />
 <div className="text-xs">
 <p className="text-slate-tile font-medium">{formatStatus(String(entry.old_status))} &rarr; {formatStatus(ns)}</p>
 <p className="text-tertiary mt-0.5">{formatWho(String(entry.who), userNames)} &mdash; {formatDateTime(String(entry.when))}</p>
 {entry.note ? <p className="text-tertiary/80 mt-1 italic text-[11px]">{String(entry.note)}</p> : null}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 </main>

 {/* Kick Back Modal */}
 {showKickBack && (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="bg-white border border-border-def p-6 w-full max-w-md animate-fade-up shadow-2xl">
 <h3 className="font-display text-xl text-slate-tile mb-2">Kick Back to PM</h3>
 <p className="text-sm text-tertiary mb-4">This invoice will be sent back to the PM queue with your note.</p>
 <textarea value={kickBackNote} onChange={(e) => setKickBackNote(e.target.value)} placeholder="Reason for kick back (required)..."
 className="w-full h-24 px-3 py-2 bg-bg-sub border border-border-def text-sm text-slate-tile placeholder-cream-dim focus:border-stone-blue focus:outline-none resize-none" />
 <div className="flex gap-3 mt-4">
 <button onClick={handleKickBack} disabled={!kickBackNote.trim() || saving}
 className="flex-1 px-4 py-2.5 bg-nw-danger text-white font-medium disabled:opacity-50 transition-all">
 Kick Back
 </button>
 <button onClick={() => { setShowKickBack(false); setKickBackNote(""); }}
 className="flex-1 px-4 py-2.5 border border-border-def text-secondary hover:border-border-def-light transition-colors">
 Cancel
 </button>
 </div>
 </div>
 </div>
 )}
 </AppShell>
 );
}

function LockedField({ label, value }: { label: string; value: string }) {
 return (
 <div>
 <label className="flex items-center gap-1.5 text-[11px] font-medium text-tertiary uppercase tracking-wider mb-1">
 {label}
 <svg className="w-3 h-3 text-tertiary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
 </svg>
 </label>
 <div className="px-3 py-2.5 bg-bg-sub/50 border border-border-def text-sm text-secondary" title="PM approved — kick back to change">
 {value}
 </div>
 </div>
 );
}
