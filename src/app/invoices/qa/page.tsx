"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatCents, daysAgo } from "@/lib/utils/format";
import NavBar from "@/components/nav-bar";

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
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl text-cream">Accounting QA</h2>
            <p className="text-sm text-cream-dim mt-1">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""} ready for QA review</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-teal/30 border-t-teal animate-spin mx-auto" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-20 animate-fade-up">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-surface border border-brand-border mb-6">
              <svg className="w-7 h-7 text-cream-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-cream text-lg font-display">QA queue is clear</p>
            <p className="text-cream-dim text-sm mt-1">No invoices waiting for accounting review</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-brand-border animate-fade-up">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-surface text-left">
                  <th className="py-3 px-5 text-[11px] text-cream-dim font-medium uppercase tracking-wider">Vendor</th>
                  <th className="py-3 px-5 text-[11px] text-cream-dim font-medium uppercase tracking-wider">Invoice #</th>
                  <th className="py-3 px-5 text-[11px] text-cream-dim font-medium uppercase tracking-wider">Job</th>
                  <th className="py-3 px-5 text-[11px] text-cream-dim font-medium uppercase tracking-wider">Cost Code</th>
                  <th className="py-3 px-5 text-[11px] text-cream-dim font-medium uppercase tracking-wider text-right">Amount</th>
                  <th className="py-3 px-5 text-[11px] text-cream-dim font-medium uppercase tracking-wider">PM Approved</th>
                  <th className="py-3 px-5 text-[11px] text-cream-dim font-medium uppercase tracking-wider text-right">Waiting</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => {
                  const approval = getApprovalInfo(inv.status_history ?? []);
                  return (
                    <tr key={inv.id}
                      className="border-t border-brand-border/50 hover:bg-brand-elevated/50 cursor-pointer transition-colors animate-fade-up"
                      style={{ animationDelay: `${0.05 + i * 0.03}s` }}
                      onClick={() => window.location.href = `/invoices/${inv.id}/qa`}
                    >
                      <td className="py-4 px-5 text-cream font-medium">{inv.vendor_name_raw ?? "Unknown"}</td>
                      <td className="py-4 px-5 text-cream-muted font-mono text-xs">{inv.invoice_number ?? "—"}</td>
                      <td className="py-4 px-5">
                        {inv.jobs?.name ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-brass-muted text-brass text-xs font-medium">{inv.jobs.name}</span>
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
                            <span className="text-cream-dim"> — {new Date(approval.when).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
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
    </div>
  );
}
