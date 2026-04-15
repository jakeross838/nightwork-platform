"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import NavBar from "@/components/nav-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import { formatCents, formatDate, formatStatus } from "@/lib/utils/format";

interface DrawData {
 id: string; draw_number: number; application_date: string; period_start: string; period_end: string;
 status: string; revision_number: number;
 original_contract_sum: number; net_change_orders: number; contract_sum_to_date: number;
 total_completed_to_date: number; less_previous_payments: number; current_payment_due: number;
 balance_to_finish: number; deposit_amount: number;
 status_history: Array<Record<string, unknown>>;
 jobs: { id: string; name: string; address: string | null; client_name: string | null; deposit_percentage: number; gc_fee_percentage: number } | null;
 line_items: Array<{
 id: string; previous_applications: number; this_period: number; total_to_date: number;
 percent_complete: number; balance_to_finish: number;
 budget_lines: {
 id: string; original_estimate: number; revised_estimate: number;
 cost_codes: { code: string; description: string; category: string; sort_order: number };
 };
 }>;
 all_budget_lines: Array<{
 id: string; original_estimate: number; revised_estimate: number;
 cost_codes: { code: string; description: string; category: string; sort_order: number };
 }>;
 invoices: Array<{ id: string; vendor_name_raw: string | null; invoice_number: string | null; total_amount: number; cost_code_id: string | null }>;
}

const ACTION_MAP: Record<string, { label: string; next: string }> = {
 draft: { label: "Submit for Review", next: "submit" },
 pm_review: { label: "Approve", next: "approve" },
 approved: { label: "Mark Submitted", next: "mark_submitted" },
 submitted: { label: "Mark Paid", next: "mark_paid" },
};

export default function DrawDetailPage() {
 const params = useParams();
 const router = useRouter();
 const drawId = params.id as string;
 const [draw, setDraw] = useState<DrawData | null>(null);
 const [loading, setLoading] = useState(true);
 const [acting, setActing] = useState(false);

 useEffect(() => {
 async function fetchDraw() {
 const res = await fetch(`/api/draws/${drawId}`);
 if (res.ok) setDraw(await res.json());
 setLoading(false);
 }
 fetchDraw();
 }, [drawId]);

 const handleAction = async (action: string) => {
 setActing(true);
 const res = await fetch(`/api/draws/${drawId}/action`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ action }),
 });
 if (res.ok) {
 const res2 = await fetch(`/api/draws/${drawId}`);
 if (res2.ok) setDraw(await res2.json());
 }
 setActing(false);
 };

 if (loading) return (
 <div className="min-h-screen"><NavBar /><div className="flex items-center justify-center py-32"><div className="w-8 h-8 border-2 border-teal/30 border-t-teal animate-spin" /></div></div>
 );
 if (!draw) return (
 <div className="min-h-screen"><NavBar /><div className="flex items-center justify-center py-32"><p className="text-status-danger font-display text-lg">Draw not found</p></div></div>
 );

 const action = ACTION_MAP[draw.status];

 const handleCreateRevision = async () => {
 setActing(true);
 try {
 const res = await fetch(`/api/draws/${drawId}/revise`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 });
 if (res.ok) {
 const data = await res.json();
 router.push(`/draws/${data.id}`);
 }
 } finally {
 setActing(false);
 }
 };

 // G703 rows come directly from computed line_items (API already merged budget_lines + invoices)
 const g703Rows = draw.line_items
 .map((li) => ({
 code: li.budget_lines.cost_codes.code,
 description: li.budget_lines.cost_codes.description,
 sort_order: li.budget_lines.cost_codes.sort_order,
 original_estimate: li.budget_lines.original_estimate,
 revised_estimate: li.budget_lines.revised_estimate,
 previous_applications: li.previous_applications,
 this_period: li.this_period,
 total_to_date: li.total_to_date,
 percent_complete: li.percent_complete,
 balance_to_finish: li.balance_to_finish,
 }))
 .sort((a, b) => a.sort_order - b.sort_order);

 // Only show rows with a nonzero estimate OR baseline OR invoice activity
 const visibleRows = g703Rows.filter(r =>
 r.original_estimate > 0 || r.revised_estimate > 0 || r.previous_applications > 0 || r.this_period > 0
 );

 // Grand totals
 const totals = visibleRows.reduce(
 (acc, r) => ({
 original: acc.original + r.original_estimate,
 previous: acc.previous + r.previous_applications,
 thisPeriod: acc.thisPeriod + r.this_period,
 totalToDate: acc.totalToDate + r.total_to_date,
 balance: acc.balance + r.balance_to_finish,
 }),
 { original: 0, previous: 0, thisPeriod: 0, totalToDate: 0, balance: 0 }
 );

 // G702/G703 balance check: G703 This Period must equal G702 Current Payment Due
 const isOutOfBalance = totals.thisPeriod !== draw.current_payment_due;

 return (
 <div className="min-h-screen">
 <NavBar />

 {/* Sub-header */}
 <div className="border-b border-brand-border bg-brand-surface/50 px-6 py-5">
 <div className="max-w-[1600px] mx-auto flex items-center justify-between flex-wrap gap-4">
 <div className="flex items-center gap-4">
 <button onClick={() => router.push("/draws")} className="text-cream-dim hover:text-teal transition-colors text-sm">&larr; Draws</button>
 <h1 className="font-display text-xl text-cream">
 {draw.jobs?.name} <span className="text-cream-dim">&mdash;</span> Draw #{draw.draw_number}
 {draw.revision_number > 0 && <span className="text-brass ml-1">Rev {draw.revision_number}</span>}
 </h1>
 <span className={`text-[10px] px-2.5 py-1 font-medium uppercase tracking-[0.08em] ${
 draw.status === "submitted" ? "bg-transparent text-cream border border-cream" :
 draw.status === "paid" ? "bg-transparent text-status-success border border-status-success" :
 draw.status === "approved" ? "bg-transparent text-status-success border border-status-success" :
 draw.status === "draft" || draw.status === "pm_review" ? "bg-transparent text-brass border border-brass" :
 draw.status === "void" ? "bg-transparent text-status-danger border border-status-danger" :
 "bg-transparent text-cream-muted border border-brand-border-light"
 }`}>
 {formatStatus(draw.status)}
 </span>
 </div>
 <div className="flex items-center gap-3">
 {draw.status !== "paid" && (
 <button
 onClick={() => {
 const a = document.createElement("a");
 a.href = `/api/draws/${drawId}/export`;
 a.download = "";
 a.click();
 }}
 className="px-4 py-2 border border-brand-border text-cream hover:bg-brand-elevated text-sm uppercase tracking-[0.06em] transition-colors">
 Export to Excel
 </button>
 )}
 {action && draw.status !== "paid" && (
 <button onClick={() => handleAction(action.next)} disabled={acting}
 className="px-4 py-2 bg-teal hover:bg-teal-hover disabled:opacity-50 text-white text-sm font-medium uppercase tracking-[0.06em] transition-colors">
 {acting ? "Processing..." : action.label}
 </button>
 )}
 </div>
 </div>
 </div>

 {/* Locked banner for submitted/paid draws */}
 {draw.status === "submitted" && (
 <div className="bg-teal/10 border-b border-teal/30">
 <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
 <div className="flex items-center gap-3 min-w-0">
 <svg className="w-5 h-5 text-teal flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
 </svg>
 <p className="text-teal text-sm">This draw has been submitted to the owner. It is locked — changes require a formal revision.</p>
 </div>
 <button
 onClick={handleCreateRevision}
 disabled={acting}
 className="px-4 py-1.5 bg-transparent hover:bg-teal/10 border border-teal text-teal text-sm font-medium transition-colors disabled:opacity-50 flex-shrink-0 whitespace-nowrap">
 {acting ? "Creating..." : "Create Revision"}
 </button>
 </div>
 </div>
 )}
 {draw.status === "paid" && (
 <div className="bg-teal/10 border-b border-teal/30">
 <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-3">
 <svg className="w-5 h-5 text-teal flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <p className="text-teal text-sm">This draw has been paid.</p>
 </div>
 </div>
 )}

 <main className="max-w-[1600px] mx-auto px-6 py-6">
 <Breadcrumbs
 items={[
 { label: "Draws", href: "/draws" },
 ...(draw.jobs ? [{ label: draw.jobs.name, href: `/jobs/${draw.jobs.id}` }] : []),
 { label: `Draw #${draw.draw_number}${draw.revision_number > 0 ? ` Rev ${draw.revision_number}` : ""}` },
 ]}
 />
 <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-fade-up">

 {/* G702 Summary */}
 <div className="xl:col-span-1">
 <div className="sticky top-24 space-y-5">
 <div className="bg-brand-card border border-teal/30 p-6">
 <p className="section-label">G702 — Application for Payment</p>
 <div className="mt-5 space-y-2.5">
 <G702Row num="1" label="Original Contract Sum" value={draw.original_contract_sum} />
 <G702Row num="" label="Deposit" value={draw.deposit_amount} sub />
 <G702Row num="2" label="Net Change Orders" value={draw.net_change_orders} />
 <G702Row num="3" label="Contract Sum to Date" value={draw.contract_sum_to_date} bold />
 <div className="border-t border-brand-border my-1" />
 <G702Row num="4" label="Total Completed to Date" value={draw.total_completed_to_date} />
 <G702Row num="5" label="Less Previous Payments" value={draw.less_previous_payments} />
 <G702Row num="6" label="Current Payment Due" value={draw.current_payment_due} bold highlight />
 <div className="border-t border-brand-border my-1" />
 <G702Row num="7" label="Balance to Finish" value={draw.balance_to_finish} />
 </div>
 </div>

 <div className="bg-brand-card border border-teal/30 p-6">
 <p className="section-label">Details</p>
 <div className="mt-5 space-y-2 text-sm">
 <div className="flex justify-between"><span className="text-cream-dim">Application #</span><span className="text-cream">{draw.draw_number}</span></div>
 <div className="flex justify-between"><span className="text-cream-dim">Period</span><span className="text-cream">{formatDate(draw.period_start)} — {formatDate(draw.period_end)}</span></div>
 <div className="flex justify-between"><span className="text-cream-dim">App Date</span><span className="text-cream">{formatDate(draw.application_date)}</span></div>
 <div className="flex justify-between"><span className="text-cream-dim">Owner</span><span className="text-cream">{draw.jobs?.client_name ?? "—"}</span></div>
 <div className="flex justify-between"><span className="text-cream-dim">Invoices</span><span className="text-cream">{draw.invoices?.length ?? 0}</span></div>
 </div>
 </div>
 </div>
 </div>

 {/* G703 Table */}
 <div className="xl:col-span-3">
 {isOutOfBalance && (
 <div className="mb-4 p-4 bg-red-900/30 border border-red-500/50 flex items-start gap-3">
 <span className="text-red-400 text-lg leading-none mt-0.5">!</span>
 <div>
 <p className="text-red-300 font-medium text-sm">G702 / G703 Out of Balance</p>
 <p className="text-red-400/80 text-xs mt-1">
 G703 This Period total ({formatCents(totals.thisPeriod)}) does not match G702 Line 6 Current Payment Due ({formatCents(draw.current_payment_due)}).
 Check that all invoices are mapped to budget lines with correct cost codes.
 </p>
 </div>
 </div>
 )}
 <p className="section-label">G703 — Continuation Sheet</p>
 <div className="mt-5 overflow-x-auto border border-brand-border">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-brand-surface text-left">
 <th className="py-3 px-4 text-[11px] text-cream font-bold uppercase tracking-wider sticky left-0 bg-brand-surface z-10">A — Item</th>
 <th className="py-3 px-4 text-[11px] text-cream font-bold uppercase tracking-wider">B — Description</th>
 <th className="py-3 px-4 text-[11px] text-cream font-bold uppercase tracking-wider text-right">C — Original Est.</th>
 <th className="py-3 px-4 text-[11px] text-cream font-bold uppercase tracking-wider text-right">D — Previous</th>
 <th className="py-3 px-4 text-[11px] text-cream font-bold uppercase tracking-wider text-right">E — This Period</th>
 <th className="py-3 px-4 text-[11px] text-cream font-bold uppercase tracking-wider text-right">F — Total to Date</th>
 <th className="py-3 px-4 text-[11px] text-cream font-bold uppercase tracking-wider text-right">G — %</th>
 <th className="py-3 px-4 text-[11px] text-cream font-bold uppercase tracking-wider text-right">H — Balance</th>
 </tr>
 </thead>
 <tbody>
 {visibleRows.map((row, idx) => {
 const overBudget = row.balance_to_finish < 0;
 const stripe = idx % 2 === 1 ? "bg-[#FAFAF5]" : "";
 const highlight = row.this_period > 0 ? "bg-teal/5" : stripe;
 return (
 <tr key={row.code} className={`border-t border-brand-row-border ${highlight}`}>
 <td className={`py-3 px-4 text-teal font-mono text-xs font-bold sticky left-0 z-[1] ${highlight || "bg-brand-card"}`}>{row.code}</td>
 <td className="py-3 px-4 text-cream">{row.description}</td>
 <td className="py-3 px-4 text-cream text-right">{formatCents(row.original_estimate)}</td>
 <td className="py-3 px-4 text-cream text-right">{row.previous_applications > 0 ? formatCents(row.previous_applications) : <span className="text-cream-dim">—</span>}</td>
 <td className="py-3 px-4 text-right font-medium">{row.this_period > 0 ? <span className="text-teal">{formatCents(row.this_period)}</span> : <span className="text-cream-dim">—</span>}</td>
 <td className="py-3 px-4 text-cream text-right">{row.total_to_date > 0 ? formatCents(row.total_to_date) : <span className="text-cream-dim">—</span>}</td>
 <td className="py-3 px-4 text-cream-muted text-right">{row.percent_complete > 0 ? `${row.percent_complete.toFixed(1)}%` : <span className="text-cream-dim">—</span>}</td>
 <td className={`py-3 px-4 text-right ${overBudget ? "text-red-400 font-medium" : "text-cream"}`}>
 {overBudget && <span className="mr-1 font-bold" title="Over original budget — see change order log">*</span>}
 {formatCents(row.balance_to_finish)}
 </td>
 </tr>
 );
 })}
 </tbody>
 <tfoot>
 <tr className="border-t border-brand-border-light bg-brand-surface">
 <td colSpan={2} className="py-3 px-4 text-cream font-medium">Grand Total</td>
 <td className="py-3 px-4 text-cream text-right font-display font-medium">{formatCents(totals.original)}</td>
 <td className="py-3 px-4 text-cream text-right font-display font-medium">{totals.previous > 0 ? formatCents(totals.previous) : <span className="text-cream-dim">—</span>}</td>
 <td className="py-3 px-4 text-teal text-right font-display font-medium">{formatCents(totals.thisPeriod)}</td>
 <td className="py-3 px-4 text-cream text-right font-display font-medium">{formatCents(totals.totalToDate)}</td>
 <td className="py-3 px-4 text-cream-dim text-right">
 {totals.original > 0 ? `${((totals.totalToDate / totals.original) * 100).toFixed(1)}%` : "—"}
 </td>
 <td className="py-3 px-4 text-cream text-right font-display font-medium">{formatCents(totals.balance)}</td>
 </tr>
 </tfoot>
 </table>
 </div>
 {visibleRows.some(r => r.balance_to_finish < 0) && (
 <p className="mt-3 text-[11px] text-cream-dim italic">
 <span className="text-red-400 font-bold mr-1">*</span>
 Indicates line items over original budget — see change order log for details.
 </p>
 )}

 {/* Included Invoices */}
 {draw.invoices && draw.invoices.length > 0 && (
 <div className="mt-6">
 <p className="section-label">Included Invoices</p>
 <div className="mt-5 overflow-x-auto border border-brand-border">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-brand-surface text-left">
 <th className="py-3 px-4 text-[11px] text-cream font-bold uppercase tracking-wider">Vendor</th>
 <th className="py-3 px-4 text-[11px] text-cream font-bold uppercase tracking-wider">Invoice #</th>
 <th className="py-3 px-4 text-[11px] text-cream font-bold uppercase tracking-wider text-right">Amount</th>
 </tr>
 </thead>
 <tbody>
 {draw.invoices.map((inv) => (
 <tr key={inv.id} className="border-t border-brand-row-border hover:bg-brand-elevated/50 cursor-pointer transition-colors"
 onClick={() => window.location.href = `/invoices/${inv.id}`}>
 <td className="py-3 px-4 text-cream">{inv.vendor_name_raw ?? "Unknown"}</td>
 <td className="py-3 px-4 text-cream-muted font-mono text-xs">{inv.invoice_number ?? "—"}</td>
 <td className="py-3 px-4 text-cream text-right font-display font-medium">{formatCents(inv.total_amount)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 </div>
 </main>
 </div>
 );
}

function G702Row({ num, label, value, bold, highlight, sub }: {
 num: string; label: string; value: number; bold?: boolean; highlight?: boolean; sub?: boolean;
}) {
 return (
 <div className={`flex items-center justify-between ${sub ? "pl-4 opacity-70" : ""}`}>
 <div className="flex items-center gap-2">
 {num && <span className="text-cream-dim text-[11px] font-mono w-4">{num}</span>}
 {!num && <span className="w-4" />}
 <span className={`text-xs ${bold ? "text-cream font-medium" : "text-cream-muted"}`}>{label}</span>
 </div>
 <span className={`font-display text-sm ${highlight ? "text-brass font-medium" : bold ? "text-cream font-medium" : "text-cream"}`}>
 {formatCents(value)}
 </span>
 </div>
 );
}
