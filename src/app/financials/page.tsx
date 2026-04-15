"use client";

import Link from "next/link";
import NavBar from "@/components/nav-bar";
import Breadcrumbs from "@/components/breadcrumbs";

export default function FinancialsOverviewPage() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs items={[{ label: "Financials" }]} />
        <div className="mb-6">
          <h1 className="font-display text-2xl text-cream">Financials</h1>
          <p className="text-sm text-cream-dim mt-1">
            Financial overview coming soon — cross-job cash flow, aging, and margin analysis.
          </p>
        </div>

        <div className="bg-brand-card border border-brand-border p-8 mb-6">
          <p className="text-sm text-cream-dim">
            This page will become the Ross Built finance command center. In the
            meantime, use the tools below for day-to-day financial work.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TileLink
            href="/draws"
            title="Draws"
            description="AIA G702/G703 pay applications across every active job."
          />
          <TileLink
            href="/financials/aging-report"
            title="Aging Report"
            description="Open invoices by age bucket — what's due, what's late."
          />
          <TileLink
            href="/vendors"
            title="Vendors"
            description="Vendor master list, cost code defaults, QuickBooks IDs."
          />
        </div>
      </main>
    </div>
  );
}

function TileLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-brand-card border border-brand-border p-5 hover:border-teal transition-colors group"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-cream group-hover:text-teal transition-colors">
          {title}
        </h3>
        <svg
          className="w-4 h-4 text-cream-dim group-hover:text-teal transition-colors"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <p className="mt-2 text-xs text-cream-dim">{description}</p>
    </Link>
  );
}
