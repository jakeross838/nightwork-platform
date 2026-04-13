"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatCents, confidenceColor, daysAgo } from "@/lib/utils/format";

interface QueueInvoice {
  id: string;
  vendor_name_raw: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total_amount: number;
  confidence_score: number;
  received_date: string;
  status: string;
  jobs: { name: string } | null;
}

export default function QueuePage() {
  const [invoices, setInvoices] = useState<QueueInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchQueue() {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, vendor_name_raw, invoice_number, invoice_date, total_amount, confidence_score, received_date, status, jobs:job_id (name)")
        .in("status", ["pm_review", "ai_processed"])
        .is("deleted_at", null)
        .order("received_date", { ascending: true });
      if (!error && data) setInvoices(data as unknown as QueueInvoice[]);
      setLoading(false);
    }
    fetchQueue();
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-brand-border bg-brand-bg/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-cream-dim hover:text-cream transition-colors text-sm">
              &larr; Home
            </Link>
            <h1 className="font-display text-2xl text-cream">Invoice Queue</h1>
            <span className="text-sm text-cream-dim font-body">
              {invoices.length} pending
            </span>
          </div>
          <Link href="/invoices/upload"
            className="px-4 py-2 bg-teal hover:bg-teal-hover text-brand-bg text-sm font-medium rounded-lg transition-colors">
            Upload New
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-teal/30 border-t-teal animate-spin mx-auto" />
            <p className="mt-4 text-cream-dim text-sm">Loading queue...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-20 opacity-0 animate-fade-up">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-surface border border-brand-border mb-6">
              <svg className="w-7 h-7 text-cream-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-cream text-lg font-display">All clear</p>
            <p className="text-cream-dim text-sm mt-1">No invoices pending review</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-brand-border opacity-0 animate-fade-up">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-surface text-left">
                  <th className="py-3 px-5 text-[11px] text-cream-dim font-medium uppercase tracking-wider">Vendor</th>
                  <th className="py-3 px-5 text-[11px] text-cream-dim font-medium uppercase tracking-wider">Invoice #</th>
                  <th className="py-3 px-5 text-[11px] text-cream-dim font-medium uppercase tracking-wider">Date</th>
                  <th className="py-3 px-5 text-[11px] text-cream-dim font-medium uppercase tracking-wider">Job</th>
                  <th className="py-3 px-5 text-[11px] text-cream-dim font-medium uppercase tracking-wider text-right">Amount</th>
                  <th className="py-3 px-5 text-[11px] text-cream-dim font-medium uppercase tracking-wider">Confidence</th>
                  <th className="py-3 px-5 text-[11px] text-cream-dim font-medium uppercase tracking-wider text-right">Waiting</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr key={inv.id}
                    className="border-t border-brand-border/50 hover:bg-brand-elevated/50 cursor-pointer transition-colors opacity-0 animate-fade-up"
                    style={{ animationDelay: `${0.05 + i * 0.03}s` }}
                    onClick={() => window.location.href = `/invoices/${inv.id}`}
                  >
                    <td className="py-4 px-5 text-cream font-medium">{inv.vendor_name_raw ?? "Unknown"}</td>
                    <td className="py-4 px-5 text-cream-muted font-mono text-xs">{inv.invoice_number ?? "—"}</td>
                    <td className="py-4 px-5 text-cream-muted">{inv.invoice_date ?? "—"}</td>
                    <td className="py-4 px-5">
                      {inv.jobs?.name ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-brass-muted text-brass text-xs font-medium">
                          {inv.jobs.name}
                        </span>
                      ) : (
                        <span className="text-cream-dim">Unmatched</span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-cream text-right font-medium font-display">{formatCents(inv.total_amount)}</td>
                    <td className="py-4 px-5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${confidenceColor(inv.confidence_score)}`}>
                        {Math.round(inv.confidence_score * 100)}%
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      {(() => {
                        const d = daysAgo(inv.received_date);
                        return (
                          <span className={`text-sm font-medium ${d > 5 ? "text-status-danger" : d > 2 ? "text-brass" : "text-cream-dim"}`}>
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
        )}
      </main>
    </div>
  );
}
