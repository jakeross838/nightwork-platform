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
              <p
                className="text-[10px] uppercase mb-2 px-3"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  letterSpacing: "0.14em",
                  color: "var(--text-tertiary)",
                }}
              >
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {visible.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="block px-3 py-1.5 text-sm transition-colors"
                        style={{
                          color: active ? "var(--text-primary)" : "var(--text-tertiary)",
                          fontWeight: active ? 500 : 400,
                          background: active ? "var(--bg-subtle)" : "transparent",
                          borderLeft: active ? "2px solid var(--nw-stone-blue)" : "2px solid transparent",
                        }}
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
      className="flex gap-1 md:hidden overflow-x-auto -mx-4 px-4 whitespace-nowrap border-b mb-4"
      style={{ borderColor: "var(--border-default)" }}
      aria-label="Admin sections"
    >
      {allItems.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 px-3 py-2 text-xs transition-colors border-b-2 -mb-px"
            style={{
              color: active ? "var(--text-primary)" : "var(--text-tertiary)",
              fontWeight: active ? 500 : 400,
              borderColor: active ? "var(--nw-stone-blue)" : "transparent",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
