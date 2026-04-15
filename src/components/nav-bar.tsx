"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { logoutAction } from "@/app/login/actions";
import { useOrgBranding } from "@/components/org-branding-provider";
import { PUBLIC_APP_NAME } from "@/lib/org/public";
import TrialBanner from "@/components/trial-banner";
import NotificationBell from "@/components/notification-bell";

export type UserRole = "admin" | "pm" | "accounting" | "owner";

type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
};

type NavItemKey =
  | "dashboard"
  | "invoices"
  | "jobs"
  | "draws"
  | "vendors"
  | "settings";

// Who can see what. "invoices" covers the whole dropdown — individual
// child items check their own ACCESS list.
const ACCESS: Record<NavItemKey, UserRole[]> = {
  dashboard: ["owner", "admin", "pm", "accounting"],
  invoices: ["owner", "admin", "pm", "accounting"],
  jobs: ["owner", "admin"],
  draws: ["owner", "admin", "pm"],
  vendors: ["owner", "admin", "accounting"],
  settings: ["owner", "admin"],
};

type SubItemKey = "upload" | "all" | "pmQueue" | "qaQueue";

const SUB_ACCESS: Record<SubItemKey, UserRole[]> = {
  upload: ["owner", "admin", "accounting"],
  all: ["owner", "admin", "pm", "accounting"],
  pmQueue: ["owner", "admin", "pm"],
  qaQueue: ["owner", "admin", "accounting"],
};

function can(role: UserRole | null, key: NavItemKey) {
  return role != null && ACCESS[key].includes(role);
}
function canSub(role: UserRole | null, key: SubItemKey) {
  return role != null && SUB_ACCESS[key].includes(role);
}

const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  pm: "PM",
  accounting: "Accounting",
};

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className="px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] uppercase border rounded-none"
      style={{ color: "var(--text-inverse)", borderColor: "var(--text-inverse)" }}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

function firstNameOf(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
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
        active ? "text-white nav-underline active" : "text-white/70 hover:text-white nav-underline"
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

export default function NavBar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pmCount, setPmCount] = useState(0);
  const [qaCount, setQaCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  const [mobileInvoicesOpen, setMobileInvoicesOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const invoicesMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Full name comes from profiles; canonical role comes from org_members.
      const [{ data: profileRow }, { data: membership }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").eq("id", user.id).single(),
        supabase
          .from("org_members")
          .select("role")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle(),
      ]);
      if (profileRow && membership?.role) {
        setProfile({
          id: profileRow.id as string,
          full_name: profileRow.full_name as string,
          role: membership.role as UserRole,
        });
      }
    }
    loadProfile();
  }, []);

  useEffect(() => {
    if (!profile) return;
    const showPm = canSub(profile.role, "pmQueue");
    const showQa = canSub(profile.role, "qaQueue");
    if (!showPm && !showQa) return;

    async function fetchCounts() {
      let pmCountVal = 0;
      if (showPm && profile) {
        if (profile.role === "pm") {
          const { data: myJobs } = await supabase
            .from("jobs").select("id").eq("pm_id", profile.id).is("deleted_at", null);
          const jobIds = (myJobs ?? []).map((j) => j.id as string);
          const orClause = jobIds.length > 0
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

  useEffect(() => { setMobileOpen(false); setInvoicesOpen(false); setMobileInvoicesOpen(false); }, [pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMobileOpen(false);
      if (invoicesMenuRef.current && !invoicesMenuRef.current.contains(e.target as Node)) setInvoicesOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeMobile = () => { setMobileOpen(false); setMobileInvoicesOpen(false); };

  const isDashboardActive = pathname === "/";
  const isUploadActive = pathname === "/invoices/upload";
  const isAllInvoicesActive = pathname === "/invoices";
  const isPmQueueActive =
    pathname === "/invoices/queue" ||
    (pathname.startsWith("/invoices/") && pathname !== "/invoices" &&
      !pathname.endsWith("/qa") && !pathname.includes("/upload") && !pathname.includes("/qa/"));
  const isQaActive = pathname === "/invoices/qa" || pathname.endsWith("/qa");
  const isInvoicesSectionActive =
    isUploadActive || isAllInvoicesActive || isPmQueueActive || isQaActive;
  const isJobsActive = pathname.startsWith("/jobs");
  const isDrawsActive = pathname.startsWith("/draws");
  const isVendorsActive = pathname.startsWith("/vendors");

  const role = profile?.role ?? null;
  const isSettingsActive = pathname.startsWith("/settings");
  const show = {
    dashboard: can(role, "dashboard"),
    invoices: can(role, "invoices"),
    jobs: can(role, "jobs"),
    draws: can(role, "draws"),
    vendors: can(role, "vendors"),
    settings: can(role, "settings"),
  };

  const totalInvoicesCount = pmCount + qaCount;
  const branding = useOrgBranding();
  const brandName = branding?.name ?? PUBLIC_APP_NAME;
  const logoUrl = branding?.logo_url ?? null;

  return (
    <>
    <header
      ref={menuRef}
      className="border-t-[3px] border-t-teal border-b border-brand-border bg-teal backdrop-blur-sm sticky top-0 z-40"
    >
      <div className="max-w-[1600px] mx-auto px-6 py-2.5 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={brandName}
              className="h-8 w-auto object-contain"
            />
          ) : (
            <span className="font-display text-lg text-white uppercase tracking-[0.08em] font-normal group-hover:text-white/80 transition-colors">
              {brandName}
            </span>
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {show.dashboard && (
            <NavLink href="/" label="Dashboard" active={isDashboardActive} />
          )}
          {show.invoices && (
            <div ref={invoicesMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setInvoicesOpen((o) => !o)}
                onMouseEnter={() => setInvoicesOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[14px] font-medium transition-colors nav-underline ${
                  isInvoicesSectionActive ? "text-white active" : "text-white/70 hover:text-white"
                }`}
                aria-haspopup="menu"
                aria-expanded={invoicesOpen}
              >
                Invoices
                {totalInvoicesCount > 0 && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 border border-white/50 text-white text-[10px] font-bold bg-transparent">
                    {totalInvoicesCount}
                  </span>
                )}
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${invoicesOpen ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {invoicesOpen && (
                <div
                  onMouseLeave={() => setInvoicesOpen(false)}
                  className="absolute left-0 top-full mt-1 min-w-[220px] bg-brand-card border border-brand-border shadow-2xl z-50"
                >
                  {canSub(role, "upload") && (
                    <DropdownItem href="/invoices/upload" label="Upload" active={isUploadActive} onClick={() => setInvoicesOpen(false)} />
                  )}
                  {canSub(role, "all") && (
                    <DropdownItem href="/invoices" label="All Invoices" active={isAllInvoicesActive} onClick={() => setInvoicesOpen(false)} />
                  )}
                  {canSub(role, "pmQueue") && (
                    <DropdownItem href="/invoices/queue" label="PM Queue" count={pmCount} active={isPmQueueActive} onClick={() => setInvoicesOpen(false)} />
                  )}
                  {canSub(role, "qaQueue") && (
                    <DropdownItem href="/invoices/qa" label="Accounting QA" count={qaCount} active={isQaActive} onClick={() => setInvoicesOpen(false)} />
                  )}
                </div>
              )}
            </div>
          )}
          {show.jobs && (
            <NavLink href="/jobs" label="Jobs" active={isJobsActive} />
          )}
          {show.draws && (
            <NavLink href="/draws" label="Draws" active={isDrawsActive} />
          )}
          {show.vendors && (
            <NavLink href="/vendors" label="Vendors" active={isVendorsActive} />
          )}
          {show.settings && (
            <NavLink href="/settings/company" label="Settings" active={isSettingsActive} />
          )}
        </nav>

        {/* Desktop user + logout */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {profile && <NotificationBell userId={profile.id} />}
          {profile && (
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium" style={{ color: "var(--text-inverse)" }}>
                {firstNameOf(profile.full_name)}
              </span>
              <span className="text-[13px]" style={{ color: "var(--text-inverse)", opacity: 0.6 }}>&middot;</span>
              <RoleBadge role={profile.role} />
            </div>
          )}
          <form action={logoutAction}>
            <button type="submit"
              className="text-[13px] px-2 py-1 transition-colors hover:underline underline-offset-4"
              style={{ color: "var(--text-inverse)", opacity: 0.8 }}>
              Sign Out
            </button>
          </form>
        </div>

        {/* Mobile notification bell + hamburger */}
        <div className="flex md:hidden items-center gap-1">
          {profile && <NotificationBell userId={profile.id} />}
          <button type="button" onClick={() => setMobileOpen((p) => !p)}
            className="flex items-center justify-center w-11 h-11 text-white/80 hover:text-white transition-colors relative"
            aria-label="Toggle menu" aria-expanded={mobileOpen}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
            {totalInvoicesCount > 0 && !mobileOpen && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 bg-brass text-white text-[9px] font-bold rounded-full">
                {totalInvoicesCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <nav className="md:hidden bg-teal border-b border-white/10 px-4 pb-3 pt-1 flex flex-col gap-1">
          {profile && (
            <div className="flex items-center justify-between py-2 px-4 border-b border-white/10 mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium" style={{ color: "var(--text-inverse)" }}>
                  {firstNameOf(profile.full_name)}
                </span>
                <span className="text-[13px]" style={{ color: "var(--text-inverse)", opacity: 0.6 }}>&middot;</span>
                <RoleBadge role={profile.role} />
              </div>
            </div>
          )}
          {show.dashboard && <NavLink href="/" label="Dashboard" active={isDashboardActive} mobile onClick={closeMobile} />}
          {show.invoices && (
            <>
              <button
                type="button"
                onClick={() => setMobileInvoicesOpen((o) => !o)}
                className={`flex items-center justify-between py-3 px-4 w-full text-[14px] font-medium transition-colors ${
                  isInvoicesSectionActive ? "text-white" : "text-white/70"
                }`}
              >
                <span className="flex items-center gap-2">
                  Invoices
                  {totalInvoicesCount > 0 && (
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 border border-white/50 text-white text-[10px] font-bold">
                      {totalInvoicesCount}
                    </span>
                  )}
                </span>
                <svg className={`w-3.5 h-3.5 transition-transform ${mobileInvoicesOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {mobileInvoicesOpen && (
                <div className="pl-4">
                  {canSub(role, "upload") && <NavLink href="/invoices/upload" label="Upload" active={isUploadActive} mobile onClick={closeMobile} />}
                  {canSub(role, "all") && <NavLink href="/invoices" label="All Invoices" active={isAllInvoicesActive} mobile onClick={closeMobile} />}
                  {canSub(role, "pmQueue") && <NavLink href="/invoices/queue" label="PM Queue" count={pmCount} active={isPmQueueActive} mobile onClick={closeMobile} />}
                  {canSub(role, "qaQueue") && <NavLink href="/invoices/qa" label="Accounting QA" count={qaCount} active={isQaActive} mobile onClick={closeMobile} />}
                </div>
              )}
            </>
          )}
          {show.jobs && <NavLink href="/jobs" label="Jobs" active={isJobsActive} mobile onClick={closeMobile} />}
          {show.draws && <NavLink href="/draws" label="Draws" active={isDrawsActive} mobile onClick={closeMobile} />}
          {show.vendors && <NavLink href="/vendors" label="Vendors" active={isVendorsActive} mobile onClick={closeMobile} />}
          {show.settings && <NavLink href="/settings/company" label="Settings" active={isSettingsActive} mobile onClick={closeMobile} />}
          <form action={logoutAction} className="mt-1">
            <button type="submit" className="w-full text-left py-3 px-4 text-[14px] transition-colors hover:underline underline-offset-4"
              style={{ color: "var(--text-inverse)", opacity: 0.8 }}>
              Sign Out
            </button>
          </form>
        </nav>
      )}
    </header>
    <TrialBanner />
    </>
  );
}

function DropdownItem({
  href, label, count, active, onClick,
}: {
  href: string; label: string; count?: number; active: boolean; onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] transition-colors border-b border-brand-row-border last:border-0 ${
        active ? "bg-brand-surface text-cream font-medium" : "text-cream hover:bg-brand-surface/60"
      }`}
    >
      <span>{label}</span>
      {count != null && count > 0 && (
        <span className="flex items-center justify-center min-w-[20px] h-[18px] px-1 text-[10px] font-bold text-teal border border-teal">
          {count}
        </span>
      )}
    </Link>
  );
}
