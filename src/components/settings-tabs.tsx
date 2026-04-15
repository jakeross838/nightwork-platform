"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: Array<{ href: string; label: string }> = [
  { href: "/settings/company", label: "Company" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/financial", label: "Financial" },
  { href: "/settings/workflow", label: "Workflow" },
  { href: "/settings/cost-codes", label: "Cost Codes" },
  { href: "/settings/usage", label: "Usage" },
  { href: "/settings/admin", label: "Admin" },
  { href: "/settings/billing", label: "Billing" },
];

export default function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav
      className="flex gap-1 border-b border-brand-border overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 whitespace-nowrap"
      aria-label="Settings sections"
    >
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`shrink-0 px-4 py-3 text-sm tracking-[0.04em] transition-colors border-b-2 -mb-px ${
              active
                ? "border-[var(--org-primary)] text-cream font-medium"
                : "border-transparent text-cream-dim hover:text-cream"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
