"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { logoutAction } from "@/app/login/actions";

export type UserRole = "admin" | "pm" | "accounting";

type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
};

type NavItemKey =
  | "upload"
  | "invoices"
  | "pmQueue"
  | "qaQueue"
  | "draws"
  | "vendors"
  | "jobs";

// Who sees which nav item.
const ACCESS: Record<NavItemKey, UserRole[]> = {
  upload: ["admin", "accounting"],
  invoices: ["admin", "pm", "accounting"],
  pmQueue: ["admin", "pm"],
  qaQueue: ["admin", "accounting"],
  draws: ["admin", "pm"],
  vendors: ["admin", "accounting"],
  jobs: ["admin"],
};

function can(role: UserRole | null, key: NavItemKey) {
  return role != null && ACCESS[key].includes(role);
}

function NavLink({
  href,
  label,
  count,
  active,
  mobile,
  onClick,
}: {
  href: string;
  label: string;
  count?: number;
  active: boolean;
  mobile?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`relative flex items-center gap-1.5 text-[14px] font-medium transition-colors ${
        mobile ? "py-3 px-4 w-full" : "px-3 py-1.5"
      } ${
        active
          ? "text-white nav-underline active"
          : "text-white/70 hover:text-white nav-underline"
      }`}
    >
      {label}
      {count != null && count > 0 && (
        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 border border-white/50 text-white text-[10px] font-bold bg-transparent">
          {count}
        </span>
      )}
    </Link>
  );
}

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  pm: "PM",
  accounting: "Accounting",
};

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className="px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] uppercase border rounded-none"
      style={{
        color: "var(--text-inverse)",
        borderColor: "var(--text-inverse)",
      }}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

function firstNameOf(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export default function NavBar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pmCount, setPmCount] = useState(0);
  const [qaCount, setQaCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load profile once on mount. Middleware guarantees a session exists.
  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data as Profile);
    }
    loadProfile();
  }, []);

  // Fetch queue counts (only if the user can see the relevant queue).
  // For PMs, scope the PM count to their own jobs/assignments.
  useEffect(() => {
    if (!profile) return;
    const showPm = can(profile.role, "pmQueue");
    const showQa = can(profile.role, "qaQueue");
    if (!showPm && !showQa) return;

    async function fetchCounts() {
      let pmCountVal = 0;
      if (showPm && profile) {
        if (profile.role === "pm") {
          // Fetch this PM's own jobs, then count invoices assigned to them
          // OR on one of their jobs.
          const { data: myJobs } = await supabase
            .from("jobs")
            .select("id")
            .eq("pm_id", profile.id)
            .is("deleted_at", null);
          const jobIds = (myJobs ?? []).map((j) => j.id as string);
          const orClause =
            jobIds.length > 0
              ? `assigned_pm_id.eq.${profile.id},job_id.in.(${jobIds.join(",")})`
              : `assigned_pm_id.eq.${profile.id}`;
          const { count } = await supabase
            .from("invoices")
            .select("id", { count: "exact", head: true })
            .in("status", ["pm_review", "ai_processed"])
            .is("deleted_at", null)
            .or(orClause);
          pmCountVal = count ?? 0;
        } else {
          const { count } = await supabase
            .from("invoices")
            .select("id", { count: "exact", head: true })
            .in("status", ["pm_review", "ai_processed"])
            .is("deleted_at", null);
          pmCountVal = count ?? 0;
        }
      }

      let qaCountVal = 0;
      if (showQa) {
        const { count } = await supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .in("status", ["qa_review", "pm_approved"])
          .is("deleted_at", null);
        qaCountVal = count ?? 0;
      }

      setPmCount(pmCountVal);
      setQaCount(qaCountVal);
    }
    fetchCounts();
  }, [pathname, profile]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  const isUploadActive = pathname === "/invoices/upload";
  const isAllInvoicesActive = pathname === "/invoices";
  const isPmActive =
    pathname === "/invoices/queue" ||
    (pathname.startsWith("/invoices/") &&
      pathname !== "/invoices" &&
      !pathname.includes("/qa") &&
      !pathname.includes("/upload") &&
      !pathname.includes("/draws"));
  const isQaActive =
    pathname === "/invoices/qa" || pathname.endsWith("/qa");
  const isDrawsActive = pathname.startsWith("/draws");
  const isVendorsActive = pathname === "/vendors";
  const isJobsActive = pathname.startsWith("/jobs");

  const role = profile?.role ?? null;
  const show = {
    upload: can(role, "upload"),
    invoices: can(role, "invoices"),
    pmQueue: can(role, "pmQueue"),
    qaQueue: can(role, "qaQueue"),
    draws: can(role, "draws"),
    vendors: can(role, "vendors"),
    jobs: can(role, "jobs"),
  };

  return (
    <header
      ref={menuRef}
      className="border-t-[3px] border-t-teal border-b border-brand-border bg-teal backdrop-blur-sm sticky top-0 z-40"
    >
      <div className="max-w-[1600px] mx-auto px-6 py-2.5 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <span className="font-display text-lg text-white uppercase tracking-[0.08em] font-normal group-hover:text-white/80 transition-colors">
            Ross Command Center
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {show.upload && (
            <NavLink
              href="/invoices/upload"
              label="Upload"
              active={isUploadActive}
            />
          )}
          {show.invoices && (
            <NavLink
              href="/invoices"
              label="All Invoices"
              active={isAllInvoicesActive}
            />
          )}
          {show.pmQueue && (
            <NavLink
              href="/invoices/queue"
              label="PM Queue"
              count={pmCount}
              active={isPmActive}
            />
          )}
          {show.qaQueue && (
            <NavLink
              href="/invoices/qa"
              label="Accounting QA"
              count={qaCount}
              active={isQaActive}
            />
          )}
          {show.draws && (
            <NavLink href="/draws" label="Draws" active={isDrawsActive} />
          )}
          {show.vendors && (
            <NavLink
              href="/vendors"
              label="Vendors"
              active={isVendorsActive}
            />
          )}
          {show.jobs && (
            <NavLink href="/jobs" label="Jobs" active={isJobsActive} />
          )}
        </nav>

        {/* Desktop user + logout */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {profile && (
            <div className="flex items-center gap-2">
              <span
                className="text-[13px] font-medium"
                style={{ color: "var(--text-inverse)" }}
              >
                {firstNameOf(profile.full_name)}
              </span>
              <span
                className="text-[13px]"
                style={{ color: "var(--text-inverse)", opacity: 0.6 }}
              >
                &middot;
              </span>
              <RoleBadge role={profile.role} />
            </div>
          )}
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-[13px] px-2 py-1 transition-colors hover:underline underline-offset-4"
              style={{ color: "var(--text-inverse)", opacity: 0.8 }}
            >
              Sign Out
            </button>
          </form>
        </div>

        {/* Mobile hamburger + badge */}
        <div className="flex md:hidden items-center gap-2">
          {pmCount > 0 && show.pmQueue && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 border border-white/50 text-white text-[10px] font-bold bg-transparent">
              {pmCount}
            </span>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="p-2 text-white/70 hover:text-white nav-underline transition-colors"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <nav className="md:hidden bg-teal border-b border-white/10 px-4 pb-3 pt-1 flex flex-col gap-1">
          {profile && (
            <div className="flex items-center justify-between py-2 px-4 border-b border-white/10 mb-1">
              <div className="flex items-center gap-2">
                <span
                  className="text-[13px] font-medium"
                  style={{ color: "var(--text-inverse)" }}
                >
                  {firstNameOf(profile.full_name)}
                </span>
                <span
                  className="text-[13px]"
                  style={{ color: "var(--text-inverse)", opacity: 0.6 }}
                >
                  &middot;
                </span>
                <RoleBadge role={profile.role} />
              </div>
            </div>
          )}
          {show.upload && (
            <NavLink
              href="/invoices/upload"
              label="Upload"
              active={isUploadActive}
              mobile
              onClick={closeMobile}
            />
          )}
          {show.invoices && (
            <NavLink
              href="/invoices"
              label="All Invoices"
              active={isAllInvoicesActive}
              mobile
              onClick={closeMobile}
            />
          )}
          {show.pmQueue && (
            <NavLink
              href="/invoices/queue"
              label="PM Queue"
              count={pmCount}
              active={isPmActive}
              mobile
              onClick={closeMobile}
            />
          )}
          {show.qaQueue && (
            <NavLink
              href="/invoices/qa"
              label="Accounting QA"
              count={qaCount}
              active={isQaActive}
              mobile
              onClick={closeMobile}
            />
          )}
          {show.draws && (
            <NavLink
              href="/draws"
              label="Draws"
              active={isDrawsActive}
              mobile
              onClick={closeMobile}
            />
          )}
          {show.vendors && (
            <NavLink
              href="/vendors"
              label="Vendors"
              active={isVendorsActive}
              mobile
              onClick={closeMobile}
            />
          )}
          {show.jobs && (
            <NavLink
              href="/jobs"
              label="Jobs"
              active={isJobsActive}
              mobile
              onClick={closeMobile}
            />
          )}
          <form action={logoutAction} className="mt-1">
            <button
              type="submit"
              className="w-full text-left py-3 px-4 text-[14px] transition-colors hover:underline underline-offset-4"
              style={{ color: "var(--text-inverse)", opacity: 0.8 }}
            >
              Sign Out
            </button>
          </form>
        </nav>
      )}
    </header>
  );
}
