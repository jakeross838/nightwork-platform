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
  | "jobs"
  | "financial"
  | "operations"
  | "admin";

const ACCESS: Record<NavItemKey, UserRole[]> = {
  dashboard: ["owner", "admin", "pm", "accounting"],
  jobs: ["owner", "admin"],
  financial: ["owner", "admin", "pm", "accounting"],
  operations: ["owner", "admin", "pm"],
  admin: ["owner", "admin"],
};

function can(role: UserRole | null, key: NavItemKey) {
  return role != null && ACCESS[key].includes(role);
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMobileOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  const isDashboardActive = pathname === "/" || pathname === "/dashboard";
  const isJobsActive = pathname.startsWith("/jobs");
  const isFinancialActive =
    pathname.startsWith("/financial") ||
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/draws") ||
    pathname.startsWith("/vendors");
  const isAdminActive = pathname.startsWith("/admin") || pathname.startsWith("/settings");

  const role = profile?.role ?? null;
  const show = {
    dashboard: can(role, "dashboard"),
    jobs: can(role, "jobs"),
    financial: can(role, "financial"),
    operations: can(role, "operations"),
    admin: can(role, "admin"),
  };
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
            // Tenant has uploaded a custom logo — respect it (paid customization).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={brandName}
              className="h-8 w-auto object-contain"
            />
          ) : (
            // Default product chrome — Nightwork logo on dark nav background.
            // Plain <img> (not next/image) because the SVG's amber brace +
            // cream studs collapse at subpixel during Next's rasterization
            // at ~28px tall. Browser-native SVG render preserves fills.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/brand/nightwork-logo-dark.svg"
              alt={PUBLIC_APP_NAME}
              style={{ width: "auto" }}
              className="h-8 w-auto group-hover:opacity-80 transition-opacity"
            />
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {show.dashboard && (
            <NavLink href="/dashboard" label="Dashboard" active={isDashboardActive} />
          )}
          {show.jobs && (
            <NavLink href="/jobs" label="Jobs" active={isJobsActive} />
          )}
          {show.financial && (
            <NavLink href="/financial" label="Financial" active={isFinancialActive} />
          )}
          {show.operations && (
            <span
              className="relative flex items-center gap-1.5 px-3 py-1.5 text-[14px] font-medium text-white/30 cursor-default select-none"
              title="Coming soon"
            >
              Operations
              <span className="px-1 py-0.5 text-[9px] tracking-[0.08em] uppercase border border-white/20 text-white/30">
                Soon
              </span>
            </span>
          )}
          {show.admin && (
            <NavLink href="/admin" label="Admin" active={isAdminActive} />
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
          {show.dashboard && <NavLink href="/dashboard" label="Dashboard" active={isDashboardActive} mobile onClick={closeMobile} />}
          {show.jobs && <NavLink href="/jobs" label="Jobs" active={isJobsActive} mobile onClick={closeMobile} />}
          {show.financial && <NavLink href="/financial" label="Financial" active={isFinancialActive} mobile onClick={closeMobile} />}
          {show.operations && (
            <span className="flex items-center gap-2 py-3 px-4 text-[14px] font-medium text-white/30">
              Operations
              <span className="px-1 py-0.5 text-[9px] tracking-[0.08em] uppercase border border-white/20 text-white/30">
                Soon
              </span>
            </span>
          )}
          {show.admin && <NavLink href="/admin" label="Admin" active={isAdminActive} mobile onClick={closeMobile} />}
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

