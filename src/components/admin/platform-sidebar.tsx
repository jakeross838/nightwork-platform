"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  matches?: (pathname: string, search: URLSearchParams) => boolean;
  badge?: number | null;
};

export default function PlatformSidebar({
  unresolvedFeedback,
  escalatedSupport,
}: {
  unresolvedFeedback?: number;
  escalatedSupport?: number;
}) {
  const pathname = usePathname();

  const NAV_ITEMS: NavItem[] = [
    { href: "/admin/platform", label: "Overview", exact: true },
    { href: "/admin/platform/organizations", label: "Organizations" },
    { href: "/admin/platform/users", label: "Users" },
    {
      href: "/admin/platform/support",
      label: "Support",
      badge: escalatedSupport ?? null,
    },
    {
      href: "/admin/platform/feedback",
      label: "Feedback",
      badge: unresolvedFeedback ?? null,
    },
    { href: "/admin/platform/items", label: "CI · Items" },
    { href: "/admin/platform/pricing", label: "CI · Pricing" },
    { href: "/admin/platform/extractions", label: "CI · Extractions" },
    { href: "/admin/platform/classifications", label: "CI · Corrections" },
    { href: "/admin/platform/audit", label: "Audit log" },
    {
      href: "/admin/platform/audit?action=impersonate_start",
      label: "Impersonation history",
      matches: (pathname: string, search: URLSearchParams) =>
        pathname === "/admin/platform/audit" &&
        search.get("action") === "impersonate_start",
    },
  ];

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
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors"
              style={{
                color: active ? "var(--text-primary)" : "var(--text-tertiary)",
                fontWeight: active ? 500 : 400,
                background: active ? "var(--bg-subtle)" : "transparent",
                borderLeft: active
                  ? "2px solid var(--nw-stone-blue)"
                  : "2px solid transparent",
              }}
            >
              <span>{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span
                  className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-medium tabular-nums border"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    letterSpacing: "0.08em",
                    color: "var(--nw-white-sand)",
                    background: "var(--nw-danger)",
                    borderColor: "var(--nw-danger)",
                  }}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
