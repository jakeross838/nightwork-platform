"use client";

import Link from "next/link";
import NavBar from "@/components/nav-bar";
import FinancialViewTabs from "@/components/financial-view-tabs";

export default function AgingReportPage() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <FinancialViewTabs active="aging" />
        <div className="mb-6">
          <h1 className="font-display text-2xl text-cream">Aging Report</h1>
          <p className="text-sm text-cream-dim mt-1">
            Cross-job invoice aging — current, 30, 60, 90+ days. Coming soon.
          </p>
        </div>

        <div className="bg-brand-card border border-brand-border p-8 text-center">
          <p className="text-sm text-cream-dim">
            The aging report will roll up every open invoice by age bucket so
            the accounting team can chase vendors and flag stuck items.
          </p>
          <div className="mt-4 inline-flex items-center gap-3">
            <Link
              href="/invoices/payments"
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-teal text-teal hover:bg-teal hover:text-white text-sm font-medium transition-colors"
            >
              Payment Tracking
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
