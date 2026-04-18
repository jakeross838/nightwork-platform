"use client";

import Link from "next/link";

export type FinancialView =
  | "invoices"
  | "queue"
  | "qa"
  | "payments"
  | "draws"
  | "aging"
  | "liens";

const TABS: { key: FinancialView; label: string; href: string }[] = [
  { key: "invoices", label: "Invoices", href: "/invoices" },
  { key: "queue", label: "Queue", href: "/invoices/queue" },
  { key: "qa", label: "QA", href: "/invoices/qa" },
  { key: "payments", label: "Payments", href: "/invoices/payments" },
  { key: "draws", label: "Draws", href: "/draws" },
  { key: "aging", label: "Aging", href: "/financials/aging-report" },
  { key: "liens", label: "Liens", href: "/invoices/liens" },
];

export default function FinancialViewTabs({
  active,
}: {
  active: FinancialView;
}) {
  return (
    <div className="flex items-center gap-1 mb-5 border-b border-border-def/50 overflow-x-auto">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`relative px-3 py-2 text-xs tracking-[0.04em] font-medium transition-colors whitespace-nowrap ${
              isActive ? "text-slate-tile" : "text-tertiary hover:text-slate-tile"
            }`}
          >
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-slate-deep" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
