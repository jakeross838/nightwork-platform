"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Role = "owner" | "admin" | "pm" | "accounting";

type SidebarItem = {
  href: string;
  label: string;
  roles: Role[];
};

type SidebarGroup = {
  title: string;
  items: SidebarItem[];
};

const GROUPS: SidebarGroup[] = [
  {
    title: "Settings",
    items: [
      { href: "/settings/company", label: "Company", roles: ["owner", "admin", "pm", "accounting"] },
      { href: "/settings/team", label: "Team", roles: ["owner", "admin"] },
      { href: "/settings/financial", label: "Financial Defaults", roles: ["owner", "admin", "pm", "accounting"] },
      { href: "/settings/cost-codes", label: "Cost Codes", roles: ["owner", "admin", "pm", "accounting"] },
      { href: "/settings/internal-billings", label: "Internal Billings", roles: ["owner", "admin"] },
      { href: "/settings/workflow", label: "Workflow", roles: ["owner", "admin", "accounting"] },
      { href: "/settings/usage", label: "Usage", roles: ["owner", "admin"] },
      { href: "/settings/billing", label: "Billing", roles: ["owner", "admin"] },
    ],
  },
  {
    title: "Reference Data",
    items: [
      { href: "/vendors", label: "Vendors", roles: ["owner", "admin", "accounting"] },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/settings/admin", label: "Admin Tools", roles: ["owner", "admin"] },
    ],
  },
];

export default function AdminSidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <nav className="w-[200px] shrink-0 hidden md:block" aria-label="Admin sections">
      <div className="sticky top-24 space-y-5">
        {GROUPS.map((group) => {
          const visible = group.items.filter((item) => item.roles.includes(role));
          if (visible.length === 0) return null;
          return (
            <div key={group.title}>
              <p className="text-[10px] tracking-[0.12em] uppercase text-tertiary mb-2 px-3">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {visible.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`block px-3 py-1.5 text-sm transition-colors ${
                          active
                            ? "text-slate-tile font-medium bg-bg-sub border-l-2 border-stone-blue"
                            : "text-tertiary hover:text-slate-tile hover:bg-bg-sub/50"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

export function AdminMobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const allItems = GROUPS.flatMap((g) => g.items).filter((item) => item.roles.includes(role));

  return (
    <nav
      className="flex gap-1 md:hidden overflow-x-auto -mx-4 px-4 whitespace-nowrap border-b border-border-def mb-4"
      aria-label="Admin sections"
    >
      {allItems.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 px-3 py-2 text-xs tracking-[0.04em] transition-colors border-b-2 -mb-px ${
              active
                ? "border-stone-blue text-slate-tile font-medium"
                : "border-transparent text-tertiary hover:text-slate-tile"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
