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
  | "financial"
  | "operations"
  | "admin";

const ACCESS: Record<NavItemKey, UserRole[]> = {
  dashboard: ["owner", "admin", "pm", "accounting"],
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
    <span className="px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-[0.12em] uppercase border border-white-sand/25 text-white-sand/80">
      {ROLE_LABEL[role]}
    </span>
  );
}

function firstNameOf(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** Beam gradient — 56px wide, stone-blue fading to transparent */
function LogoBeam() {
  return (
    <svg
      width="56"
      height="2"
      viewBox="0 0 56 2"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="ml-2 self-center"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="beam-grad" x1="0" y1="1" x2="56" y2="1" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5B8699" />
          <stop offset="100%" stopColor="#5B8699" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="56" height="2" fill="url(#beam-grad)" />
    </svg>
  );
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
      className={`relative flex items-center gap-1.5 font-sans text-[13px] font-medium transition-colors ${
        mobile ? "py-3 px-4 w-full" : "px-3.5 h-[60px]"
      } ${
        active
          ? "text-white-sand"
          : "text-white-sand/65 hover:text-white-sand"
      }`}
    >
      {label}
      {count != null && count > 0 && (
        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 border border-white-sand/25 text-white-sand font-mono text-[9px] font-medium tracking-[0.12em] bg-transparent">
          {count}
        </span>
      )}
      {/* Active bottom border — 2px stone-blue, desktop only */}
      {active && !mobile && (
        <span className="absolute bottom-0 left-3.5 right-3.5 h-[2px] bg-stone-blue" />
      )}
      {/* Mobile active indicator — left bar */}
      {active && mobile && (
        <span className="absolute left-0 top-2 bottom-2 w-[2px] bg-stone-blue" />
      )}
    </Link>
  );
}

export default function NavBar({ onToggleSidebar }: { onToggleSidebar?: () => void } = {}) {
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
  const isFinancialActive =
    pathname.startsWith("/financial") ||
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/draws");
  const isAdminActive =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/vendors");

  const role = profile?.role ?? null;
  const show = {
    dashboard: can(role, "dashboard"),
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
      className="h-[60px] bg-slate-deep border-b border-white-sand/8 sticky top-0 z-40"
    >
      <div className="max-w-[1600px] mx-auto px-7 h-full flex items-center justify-between gap-7">
        {/* Logo area */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          {logoUrl ? (
            // Tenant has uploaded a custom logo — respect it (paid customization).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={brandName}
              className="h-8 w-auto object-contain"
            />
          ) : (
            <>
              <span
                className="font-display text-[18px] font-semibold tracking-[-0.03em] text-white-sand group-hover:opacity-80 transition-opacity select-none"
              >
                nightwork
              </span>
              <LogoBeam />
            </>
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center h-full">
          {show.dashboard && (
            <NavLink href="/dashboard" label="Dashboard" active={isDashboardActive} />
          )}
          {show.financial && (
            <NavLink href="/financial" label="Financial" active={isFinancialActive} />
          )}
          {show.operations && (
            <span
              className="relative flex items-center gap-1.5 px-3.5 h-[60px] font-sans text-[13px] font-medium text-white-sand/25 cursor-default select-none"
              title="Coming soon"
            >
              Operations
              <span className="px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] uppercase border border-white-sand/15 text-white-sand/25">
                SOON
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
            <div className="flex items-center gap-2.5">
              <span className="font-sans text-[13px] font-medium text-white-sand/80">
                {firstNameOf(profile.full_name)}
              </span>
              <RoleBadge role={profile.role} />
            </div>
          )}
          <form action={logoutAction}>
            <button type="submit"
              className="font-sans text-[13px] px-2 py-1 text-white-sand/65 hover:text-white-sand transition-colors hover:underline underline-offset-4">
              Sign Out
            </button>
          </form>
        </div>

        {/* Mobile: sidebar hamburger + notification bell + nav menu */}
        <div className="flex md:hidden items-center gap-1">
          {onToggleSidebar && (
            <button type="button" onClick={onToggleSidebar}
              className="flex items-center justify-center w-10 h-10 text-white-sand/65 hover:text-white-sand transition-colors"
              aria-label="Open job sidebar">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
            </button>
          )}
          {profile && <NotificationBell userId={profile.id} />}
          <button type="button" onClick={() => setMobileOpen((p) => !p)}
            className="flex items-center justify-center w-10 h-10 text-white-sand/65 hover:text-white-sand transition-colors relative"
            aria-label="Toggle menu" aria-expanded={mobileOpen}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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
        <nav className="md:hidden bg-slate-deep border-b border-white-sand/8 px-4 pb-3 pt-1 flex flex-col gap-1">
          {profile && (
            <div className="flex items-center justify-between py-2 px-4 border-b border-white-sand/8 mb-1">
              <div className="flex items-center gap-2.5">
                <span className="font-sans text-[13px] font-medium text-white-sand/80">
                  {firstNameOf(profile.full_name)}
                </span>
                <RoleBadge role={profile.role} />
              </div>
            </div>
          )}
          {show.dashboard && <NavLink href="/dashboard" label="Dashboard" active={isDashboardActive} mobile onClick={closeMobile} />}
          {show.financial && <NavLink href="/financial" label="Financial" active={isFinancialActive} mobile onClick={closeMobile} />}
          {show.operations && (
            <span className="flex items-center gap-2 py-3 px-4 font-sans text-[13px] font-medium text-white-sand/25">
              Operations
              <span className="px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] uppercase border border-white-sand/15 text-white-sand/25">
                SOON
              </span>
            </span>
          )}
          {show.admin && <NavLink href="/admin" label="Admin" active={isAdminActive} mobile onClick={closeMobile} />}
          <form action={logoutAction} className="mt-1">
            <button type="submit" className="w-full text-left py-3 px-4 font-sans text-[13px] text-white-sand/65 hover:text-white-sand transition-colors hover:underline underline-offset-4">
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
