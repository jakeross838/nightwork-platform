"use client";

import Link from "next/link";

export type JobTabKey =
  | "overview"
  | "budget"
  | "change-orders"
  | "purchase-orders"
  | "invoices"
  | "lien-releases"
  | "draws";

// Tab order is workflow-priority: Overview → Budget → Invoices →
// Purchase Orders → Change Orders → Draws → Lien Releases. Budget and
// Invoices are the most-touched tabs so they come first after Overview.
const TABS: { key: JobTabKey; label: string; slug: string }[] = [
  { key: "overview", label: "Overview", slug: "" },
  { key: "budget", label: "Budget", slug: "/budget" },
  { key: "invoices", label: "Invoices", slug: "/invoices" },
  { key: "purchase-orders", label: "Purchase Orders", slug: "/purchase-orders" },
  { key: "change-orders", label: "Change Orders", slug: "/change-orders" },
  { key: "draws", label: "Draws", slug: "/draws" },
  { key: "lien-releases", label: "Lien Releases", slug: "/lien-releases" },
];

export default function JobTabs({
  jobId,
  active,
}: {
  jobId: string;
  active: JobTabKey;
}) {
  return (
    <div className="border-b border-brand-border mb-6">
      <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Job sections">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={`/jobs/${jobId}${tab.slug}`}
              className={`relative px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? "text-teal"
                  : "text-cream-dim hover:text-cream"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-teal" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
