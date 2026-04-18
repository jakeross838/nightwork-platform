"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import NavBar from "./nav-bar";
import JobSidebar from "./job-sidebar";

/**
 * Paths where the job sidebar should NOT render. Matched against
 * pathname — order doesn't matter, first match wins.
 */
const NO_SIDEBAR: RegExp[] = [
  /^\/invoices\/[a-f0-9-]+/,         // invoice detail drill-down
  /^\/draws\/[a-f0-9-]+/,            // draw detail drill-down
  /^\/draws\/new/,                    // draw wizard
  /^\/change-orders\/[a-f0-9-]+/,    // CO detail drill-down
  /^\/admin/,                         // admin section (has its own sidebar)
  /^\/settings/,
  /^\/vendors/,
  /^\/login/,
  /^\/signup/,
  /^\/forgot/,
  /^\/onboard/,
  /^\/pricing/,
];

/**
 * AppShell wraps authenticated page content with NavBar +
 * conditional JobSidebar. Replaces the per-page pattern of
 * `<div min-h-screen><NavBar /><main>...</main></div>`.
 *
 * Desktop: sidebar renders as 220px fixed left column.
 * Mobile (<md): sidebar hidden; hamburger in nav opens drawer overlay.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const showSidebar = !NO_SIDEBAR.some((p) => p.test(pathname));

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const toggleDrawer = useCallback(() => setDrawerOpen((p) => !p), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar onToggleSidebar={showSidebar ? toggleDrawer : undefined} />

      {showSidebar ? (
        <div className="flex flex-1">
          {/* Desktop sidebar — hidden below md */}
          <JobSidebar />

          {/* Mobile drawer overlay — visible below md when open */}
          {drawerOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-30 bg-black/50 md:hidden"
                onClick={closeDrawer}
              />
              {/* Drawer panel */}
              <div className="fixed inset-y-0 left-0 z-30 w-[280px] bg-white shadow-2xl md:hidden overflow-hidden flex flex-col animate-slide-in-left">
                <div className="flex items-center justify-between p-3 border-b border-brand-border">
                  <span className="text-[10px] tracking-[0.12em] uppercase text-cream-dim font-medium">
                    Jobs
                  </span>
                  <button
                    onClick={closeDrawer}
                    className="w-7 h-7 flex items-center justify-center text-cream-dim hover:text-cream"
                    aria-label="Close sidebar"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <JobSidebar mobile />
                </div>
              </div>
            </>
          )}

          <div className="flex-1 min-w-0">{children}</div>
        </div>
      ) : (
        <>{children}</>
      )}
    </div>
  );
}
