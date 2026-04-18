"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatCents, daysAgo, formatDateTime } from "@/lib/utils/format";
import AppShell from "@/components/app-shell";
import FinancialViewTabs from "@/components/financial-view-tabs";
import EmptyState, { EmptyIcons } from "@/components/empty-state";
import { SkeletonList } from "@/components/loading-skeleton";

interface QaInvoice {
 id: string;
 vendor_name_raw: string | null;
 invoice_number: string | null;
 total_amount: number;
 received_date: string;
 status: string;
 status_history: Array<Record<string, unknown>>;
 jobs: { name: string } | null;
 cost_codes: { code: string; description: string } | null;
}

export default function QaQueuePage() {
 const [invoices, setInvoices] = useState<QaInvoice[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 async function fetchQueue() {
 const { data, error } = await supabase
 .from("invoices")
 .select(`
 id, vendor_name_raw, invoice_number, total_amount, received_date, status, status_history,
 jobs:job_id (name),
 cost_codes:cost_code_id (code, description)
 `)
 .in("status", ["qa_review", "pm_approved"])
 .is("deleted_at", null)
 .order("received_date", { ascending: true });
 if (!error && data) setInvoices(data as unknown as QaInvoice[]);
 setLoading(false);
 }
 fetchQueue();
 }, []);

 function getApprovalInfo(history: Array<Record<string, unknown>>): { who: string; when: string } | null {
 const approval = [...history].reverse().find(e => String(e.new_status) === "qa_review" || String(e.new_status) === "pm_approved");
 if (!approval) return null;
 return { who: String(approval.who), when: String(approval.when) };
 }

 return (
 <AppShell>
 <main className="max-w-[1600px] mx-auto px-6 py-8">
 <FinancialViewTabs active="qa" />
 <div className="flex items-center justify-between mb-6">
 <div>
 <h2 className="font-display text-2xl text-cream">Accounting QA</h2>
 <p className="text-sm text-cream-dim mt-1">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""} ready for QA review</p>
 </div>
 </div>

 {loading ? (
 <SkeletonList rows={5} columns={["w-40", "w-24", "w-32", "w-32", "w-20", "w-32", "w-16"]} />
 ) : invoices.length === 0 ? (
 <EmptyState
 icon={<EmptyIcons.Check />}
 variant="success"
 title="QA queue is clear"
 message="No invoices waiting for accounting review. PM-approved invoices will appear here."
 />
 ) : (
 <div className="overflow-x-auto border border-brand-border animate-fade-up">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-brand-surface text-left">
 <th className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider">Vendor</th>
 <th className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider">Invoice #</th>
 <th className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider">Job</th>
 <th className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider">Cost Code</th>
 <th className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider text-right">Amount</th>
 <th className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider">PM Approved</th>
 <th className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider text-right">Waiting</th>
 </tr>
 </thead>
 <tbody>
 {invoices.map((inv, i) => {
 const approval = getApprovalInfo(inv.status_history ?? []);
 return (
 <tr key={inv.id}
 className="border-t border-brand-row-border hover:bg-brand-elevated/50 cursor-pointer transition-colors animate-fade-up"
 style={{ animationDelay: `${0.05 + i * 0.03}s` }}
 onClick={() => window.location.href = `/invoices/${inv.id}/qa`}
 >
 <td className="py-4 px-5 text-cream font-medium">{inv.vendor_name_raw ?? "Unknown"}</td>
 <td className="py-4 px-5 text-cream-muted font-mono text-xs">{inv.invoice_number ?? "—"}</td>
 <td className="py-4 px-5">
 {inv.jobs?.name ? (
 <span className="inline-flex items-center px-2 py-0.5 bg-transparent text-brass border border-brass text-xs font-medium">{inv.jobs.name}</span>
 ) : (
 <span className="text-cream-dim">—</span>
 )}
 </td>
 <td className="py-4 px-5 text-cream-muted text-xs">
 {inv.cost_codes ? `${inv.cost_codes.code} — ${inv.cost_codes.description}` : "—"}
 </td>
 <td className="py-4 px-5 text-cream text-right font-medium font-display">{formatCents(inv.total_amount)}</td>
 <td className="py-4 px-5 text-cream-dim text-xs">
 {approval ? (
 <>
 <span className="text-cream-muted">{approval.who}</span>
 <span className="text-cream-dim"> — {formatDateTime(approval.when)}</span>
 </>
 ) : "—"}
 </td>
 <td className="py-4 px-5 text-right">
 <span className={`text-sm font-medium ${daysAgo(inv.received_date) > 5 ? "text-status-danger" : daysAgo(inv.received_date) > 2 ? "text-brass" : "text-cream-dim"}`}>
 {daysAgo(inv.received_date)}d
 </span>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </main>
 </AppShell>
 );
}
