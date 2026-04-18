"use client";

import Link from "next/link";

export type JobTabKey =
  | "overview"
  | "budget"
  | "invoices"
  | "draws"
  | "change-orders"
  | "activity";

const TABS: { key: JobTabKey; label: string; slug: string }[] = [
  { key: "overview", label: "Overview", slug: "" },
  { key: "budget", label: "Budget & Costs", slug: "/budget" },
  { key: "invoices", label: "Invoices", slug: "/invoices" },
  { key: "draws", label: "Draws", slug: "/draws" },
  { key: "change-orders", label: "Change Orders", slug: "/change-orders" },
  { key: "activity", label: "Activity", slug: "/activity" },
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
