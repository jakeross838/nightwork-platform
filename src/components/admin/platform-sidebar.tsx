"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin/platform", label: "Overview", exact: true },
  { href: "/admin/platform/organizations", label: "Organizations" },
  { href: "/admin/platform/users", label: "Users" },
  { href: "/admin/platform/audit", label: "Audit log" },
  {
    href: "/admin/platform/audit?action=impersonate_start",
    label: "Impersonation history",
    matches: (pathname: string, search: URLSearchParams) =>
      pathname === "/admin/platform/audit" &&
      search.get("action") === "impersonate_start",
  },
];

export default function PlatformSidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="w-[220px] shrink-0 hidden md:block border-r"
      style={{ borderColor: "var(--border-default)" }}
      aria-label="Platform admin sections"
    >
      <div className="sticky top-0 px-3 py-6 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          let active: boolean;
          if (item.matches) {
            // usePathname doesn't expose search params — fall back to
            // href-prefix match for the impersonation shortcut so the
            // active state at least highlights the audit group.
            active = pathname === "/admin/platform/audit";
          } else if (item.exact) {
            active = pathname === item.href;
          } else {
            active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 text-sm transition-colors"
              style={{
                color: active ? "var(--text-primary)" : "var(--text-tertiary)",
                fontWeight: active ? 500 : 400,
                background: active ? "var(--bg-subtle)" : "transparent",
                borderLeft: active
                  ? "2px solid var(--nw-stone-blue)"
                  : "2px solid transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
