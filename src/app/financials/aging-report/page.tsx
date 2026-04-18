"use client";

import Link from "next/link";
import AppShell from "@/components/app-shell";
import FinancialViewTabs from "@/components/financial-view-tabs";

export default function AgingReportPage() {
  return (
    <AppShell>
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <FinancialViewTabs active="aging" />
        <div className="mb-6">
          <h1 className="font-display text-2xl text-slate-tile">Aging Report</h1>
          <p className="text-sm text-[rgba(59,88,100,0.55)] mt-1">
            Cross-job invoice aging — current, 30, 60, 90+ days. Coming soon.
          </p>
        </div>

        <div className="bg-white border border-[rgba(59,88,100,0.15)] p-8 text-center">
          <p className="text-sm text-[rgba(59,88,100,0.55)]">
            The aging report will roll up every open invoice by age bucket so
            the accounting team can chase vendors and flag stuck items.
          </p>
          <div className="mt-4 inline-flex items-center gap-3">
            <Link
              href="/invoices/payments"
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-stone-blue text-stone-blue hover:bg-stone-blue hover:text-white text-sm font-medium transition-colors"
            >
              Payment Tracking
            </Link>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
