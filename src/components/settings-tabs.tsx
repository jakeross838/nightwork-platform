"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Role = "owner" | "admin" | "pm" | "accounting";

const TABS: Array<{ href: string; label: string; roles: Role[] }> = [
  { href: "/settings/company", label: "Company", roles: ["owner", "admin", "pm", "accounting"] },
  { href: "/settings/team", label: "Team", roles: ["owner", "admin"] },
  { href: "/settings/financial", label: "Financial", roles: ["owner", "admin", "pm", "accounting"] },
  { href: "/settings/workflow", label: "Workflow", roles: ["owner", "admin", "accounting"] },
  { href: "/settings/cost-codes", label: "Cost Codes", roles: ["owner", "admin", "pm", "accounting"] },
  { href: "/settings/internal-billings", label: "Internal Billings", roles: ["owner", "admin"] },
  { href: "/settings/usage", label: "Usage", roles: ["owner", "admin"] },
  { href: "/settings/admin", label: "Admin", roles: ["owner", "admin"] },
  { href: "/settings/billing", label: "Billing", roles: ["owner", "admin"] },
];

export default function SettingsTabs({ role }: { role: Role }) {
  const pathname = usePathname();
  const visible = TABS.filter((t) => t.roles.includes(role));
  return (
    <nav
      className="flex gap-1 border-b border-brand-border overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 whitespace-nowrap"
      aria-label="Settings sections"
    >
      {visible.map((t) => {
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
