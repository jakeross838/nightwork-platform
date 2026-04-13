"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatCents, confidenceColor, confidenceLabel, daysAgo } from "@/lib/utils/format";

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
        .select(`
          id, vendor_name_raw, invoice_number, invoice_date,
          total_amount, confidence_score, received_date, status,
          jobs:job_id (name)
        `)
        .in("status", ["pm_review", "ai_processed"])
        .is("deleted_at", null)
        .order("received_date", { ascending: true });

      if (!error && data) {
        setInvoices(data as unknown as QueueInvoice[]);
      }
      setLoading(false);
    }
    fetchQueue();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">
              &larr; Home
            </Link>
            <h1 className="text-xl font-semibold">Invoice Queue</h1>
            <span className="text-sm text-gray-500">
              {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} pending review
            </span>
          </div>
          <Link
            href="/invoices/upload"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Upload New
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No invoices pending review</p>
            <p className="text-gray-500 text-sm mt-2">Upload invoices to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="py-3 pr-4 text-gray-400 font-medium">Vendor</th>
                  <th className="py-3 pr-4 text-gray-400 font-medium">Invoice #</th>
                  <th className="py-3 pr-4 text-gray-400 font-medium">Date</th>
                  <th className="py-3 pr-4 text-gray-400 font-medium">Job</th>
                  <th className="py-3 pr-4 text-gray-400 font-medium text-right">Amount</th>
                  <th className="py-3 pr-4 text-gray-400 font-medium">Confidence</th>
                  <th className="py-3 text-gray-400 font-medium text-right">Waiting</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="contents"
                  >
                    <tr className="border-b border-gray-800/50 hover:bg-gray-900/50 cursor-pointer transition-colors">
                      <td className="py-4 pr-4 text-gray-200 font-medium">
                        {inv.vendor_name_raw ?? "Unknown"}
                      </td>
                      <td className="py-4 pr-4 text-gray-300">
                        {inv.invoice_number ?? "—"}
                      </td>
                      <td className="py-4 pr-4 text-gray-400">
                        {inv.invoice_date ?? "—"}
                      </td>
                      <td className="py-4 pr-4 text-gray-300">
                        {inv.jobs?.name ?? "Unmatched"}
                      </td>
                      <td className="py-4 pr-4 text-gray-200 text-right font-medium">
                        {formatCents(inv.total_amount)}
                      </td>
                      <td className="py-4 pr-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${confidenceColor(inv.confidence_score)}`}>
                          {Math.round(inv.confidence_score * 100)}% {confidenceLabel(inv.confidence_score)}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <span className={`text-sm ${daysAgo(inv.received_date) > 3 ? "text-red-400" : "text-gray-400"}`}>
                          {daysAgo(inv.received_date)}d
                        </span>
                      </td>
                    </tr>
                  </Link>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
