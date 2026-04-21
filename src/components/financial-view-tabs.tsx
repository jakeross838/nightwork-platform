"use client";

import Link from "next/link";

export type FinancialView =
  | "invoices"
  | "queue"
  | "qa"
  | "payments"
  | "draws"
  | "aging"
  | "liens"
  | "items";

const TABS: { key: FinancialView; label: string; href: string }[] = [
  { key: "invoices", label: "Invoices", href: "/invoices" },
  { key: "queue", label: "Queue", href: "/invoices/queue" },
  { key: "qa", label: "QA", href: "/invoices/qa" },
  { key: "payments", label: "Payments", href: "/invoices/payments" },
  { key: "draws", label: "Draws", href: "/draws" },
  { key: "aging", label: "Aging", href: "/financials/aging-report" },
  { key: "liens", label: "Liens", href: "/invoices/liens" },
  { key: "items", label: "Items", href: "/items" },
];

export default function FinancialViewTabs({
  active,
}: {
  active: FinancialView;
}) {
  return (
    <div
      className="flex items-center gap-1 mb-5 overflow-x-auto"
      style={{ borderBottom: "1px solid var(--border-default)" }}
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className="relative px-3 py-2.5 text-[12px] font-medium transition-colors whitespace-nowrap"
            style={{
              color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
              letterSpacing: "0.02em",
            }}
          >
            {tab.label}
            {isActive && (
              <span
                className="absolute bottom-0 left-0 right-0 h-[2px]"
                style={{ background: "var(--nw-stone-blue)" }}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
