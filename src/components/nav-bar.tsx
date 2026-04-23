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
import FeedbackTrigger from "@/components/feedback-trigger";
import { useTheme } from "@/components/theme-provider";
import NavDropdown, {
  MobileNavSection,
  type NavDropdownItem,
} from "@/components/nav/nav-dropdown";

function NavThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="inline-flex items-center justify-center w-8 h-8 border border-[rgba(247,245,236,0.15)] text-[rgba(247,245,236,0.65)] hover:text-[#F7F5EC] hover:border-[rgba(247,245,236,0.35)] transition-colors"
    >
      {theme === "light" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  );
}

export type UserRole = "admin" | "pm" | "accounting" | "owner";

type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
};

type NavItemKey = "dashboard" | "financial" | "operations" | "cost_intelligence" | "admin";

const ACCESS: Record<NavItemKey, UserRole[]> = {
  dashboard: ["owner", "admin", "pm", "accounting"],
  financial: ["owner", "admin", "pm", "accounting"],
  operations: ["owner", "admin", "pm"],
  cost_intelligence: ["owner", "admin", "pm", "accounting"],
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
      className="px-[6px] py-[2px] text-[9px] font-medium tracking-[0.12em] uppercase border"
      style={{
        fontFamily: "var(--font-mono)",
        color: "#F7F5EC",
        borderColor: "rgba(247,245,236,0.25)",
      }}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

function firstNameOf(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function buildFinancialItems(): NavDropdownItem[] {
  return [
    { href: "/invoices", label: "Invoices" },
    { href: "/invoices/queue", label: "Queue" },
    { href: "/invoices/qa", label: "QA" },
    { href: "/payments", label: "Payments" },
    { href: "/draws", label: "Draws" },
    { href: "/aging", label: "Aging" },
    { href: "/lien-releases", label: "Liens" },
    { href: "/change-orders", label: "Change Orders" },
    { href: "/purchase-orders", label: "Purchase Orders" },
  ];
}

function buildOperationsItems(): NavDropdownItem[] {
  return [
    { href: "#", label: "Schedule", disabled: true, soon: true },
    { href: "#", label: "Daily Logs", disabled: true, soon: true },
    { href: "#", label: "Selections", disabled: true, soon: true },
  ];
}

function buildCostIntelItems(pendingVerification: number, pendingConversions: number): NavDropdownItem[] {
  return [
    { href: "/cost-intelligence", label: "Overview" },
    { href: "/cost-intelligence/items", label: "Items" },
    {
      href: "/cost-intelligence/verification",
      label: "Verification Queue",
      count: pendingVerification,
    },
    { href: "/cost-intelligence/lookup", label: "Cost Lookup" },
    {
      href: "/cost-intelligence/conversions",
      label: "Unit Conversions",
      count: pendingConversions,
    },
  ];
}

function buildAdminItems(isPlatformAdmin: boolean): NavDropdownItem[] {
  const items: NavDropdownItem[] = [
    { href: "/settings", label: "Settings" },
    { href: "/settings/team", label: "Team" },
    { href: "/settings/integrations", label: "Integrations" },
    { href: "/settings/billing", label: "Billing" },
  ];
  if (isPlatformAdmin) {
    items.push({ href: "/admin/platform", label: "Platform Admin" });
  }
  return items;
}

export default function NavBar({ onToggleSidebar }: { onToggleSidebar?: () => void } = {}) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(0);
  const [pendingConversions, setPendingConversions] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: profileRow }, { data: membership }, { data: adminRow }] =
        await Promise.all([
          supabase.from("profiles").select("id, full_name").eq("id", user.id).single(),
          supabase
            .from("org_members")
            .select("role")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("platform_admins")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);
      if (profileRow && membership?.role) {
        setProfile({
          id: profileRow.id as string,
          full_name: profileRow.full_name as string,
          role: membership.role as UserRole,
        });
      }
      setIsPlatformAdmin(!!adminRow);
    }
    loadProfile();
  }, []);

  // Fetch pending counts (verification + conversions). Best-effort —
  // silent failure keeps the nav rendering for users missing either
  // table/permission.
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [{ count: verifCount }, { count: convCount }] = await Promise.all([
        supabase
          .from("document_extraction_lines")
          .select("id", { count: "exact", head: true })
          .eq("verification_status", "pending")
          .eq("is_allocated_overhead", false)
          .is("deleted_at", null),
        supabase
          .from("unit_conversion_suggestions")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .is("deleted_at", null),
      ]);
      setPendingVerification(verifCount ?? 0);
      setPendingConversions(convCount ?? 0);
    })();
  }, [profile, pathname]);

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
    pathname.startsWith("/draws") ||
    pathname.startsWith("/payments") ||
    pathname.startsWith("/aging") ||
    pathname.startsWith("/lien-releases") ||
    pathname.startsWith("/change-orders") ||
    pathname.startsWith("/purchase-orders");
  const isCostIntelActive =
    pathname.startsWith("/cost-intelligence") || pathname.startsWith("/items");
  const isAdminActive =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/vendors");

  const role = profile?.role ?? null;
  const show = {
    dashboard: can(role, "dashboard"),
    financial: can(role, "financial"),
    operations: can(role, "operations"),
    cost_intelligence: can(role, "cost_intelligence"),
    admin: can(role, "admin"),
  };
  const branding = useOrgBranding();
  const brandName = branding?.name ?? PUBLIC_APP_NAME;
  const logoUrl = branding?.logo_url ?? null;

  const financialItems = buildFinancialItems();
  const operationsItems = buildOperationsItems();
  const costIntelItems = buildCostIntelItems(pendingVerification, pendingConversions);
  const adminItems = buildAdminItems(isPlatformAdmin);

  return (
    <>
    <header
      ref={menuRef}
      className="bg-nw-slate-deeper border-b border-[rgba(247,245,236,0.08)] sticky top-0 z-40"
    >
      <div className="max-w-[1600px] mx-auto px-8 h-[54px] flex items-center justify-between gap-[22px]">
        <Link href="/" className="flex items-center gap-4 group shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/nightwork-wordmark.svg"
            alt={PUBLIC_APP_NAME}
            className="h-6 md:h-7 w-auto group-hover:opacity-85 transition-opacity"
          />
          {logoUrl && (
            <>
              <span
                aria-hidden="true"
                className="hidden md:block w-px h-6 bg-[rgba(247,245,236,0.18)]"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={brandName}
                className="hidden md:block h-[18px] w-auto object-contain"
              />
            </>
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center h-full">
          {show.dashboard && (
            <Link
              href="/dashboard"
              className={`flex items-center gap-1.5 h-full px-[14px] text-[13px] font-medium font-sans transition-colors border-b-2 -mb-px ${
                isDashboardActive
                  ? "text-[#F7F5EC] border-b-nw-stone-blue"
                  : "text-[rgba(247,245,236,0.65)] hover:text-[#F7F5EC] border-transparent"
              }`}
            >
              Dashboard
            </Link>
          )}
          {show.financial && (
            <NavDropdown
              label="Financial"
              items={financialItems}
              active={isFinancialActive}
              activeHref={financialItems.find((i) => pathname === i.href)?.href}
            />
          )}
          {show.operations && (
            <NavDropdown label="Operations" items={operationsItems} active={false} />
          )}
          {show.cost_intelligence && (
            <NavDropdown
              label="Cost Intelligence"
              items={costIntelItems}
              active={isCostIntelActive}
              activeHref={costIntelItems.find((i) => pathname === i.href)?.href}
            />
          )}
          {show.admin && (
            <NavDropdown
              label="Admin"
              items={adminItems}
              active={isAdminActive}
              activeHref={adminItems.find((i) => pathname === i.href)?.href}
            />
          )}
        </nav>

        {/* Desktop user + logout */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {profile && <NotificationBell userId={profile.id} />}
          <NavThemeToggle />
          {profile && (
            <div className="flex items-center gap-[12px]">
              <span className="text-[13px] font-medium text-[#F7F5EC]">
                {firstNameOf(profile.full_name)}
              </span>
              <RoleBadge role={profile.role} />
            </div>
          )}
          <FeedbackTrigger className="text-[13px] font-sans px-2 py-1 transition-colors hover:underline underline-offset-4 text-[rgba(247,245,236,0.65)] hover:text-[#F7F5EC]">
            Feedback
          </FeedbackTrigger>
          <form action={logoutAction}>
            <button type="submit"
              className="text-[13px] font-sans px-2 py-1 transition-colors hover:underline underline-offset-4 text-[rgba(247,245,236,0.65)] hover:text-[#F7F5EC]">
              Sign Out
            </button>
          </form>
        </div>

        {/* Mobile: sidebar hamburger + notification bell + nav menu */}
        <div className="flex md:hidden items-center gap-1">
          {onToggleSidebar && (
            <button type="button" onClick={onToggleSidebar}
              className="flex items-center justify-center w-10 h-10 text-[rgba(247,245,236,0.65)] hover:text-[#F7F5EC] transition-colors"
              aria-label="Open job sidebar">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
            </button>
          )}
          {profile && <NotificationBell userId={profile.id} />}
          <NavThemeToggle />
          <button type="button" onClick={() => setMobileOpen((p) => !p)}
            className="flex items-center justify-center w-10 h-10 text-[rgba(247,245,236,0.65)] hover:text-[#F7F5EC] transition-colors relative"
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
        <nav className="md:hidden bg-nw-slate-deeper border-b border-[rgba(247,245,236,0.08)] px-2 pb-3 pt-1 flex flex-col gap-0">
          {profile && (
            <div className="flex items-center justify-between py-2 px-4 border-b border-[rgba(247,245,236,0.08)] mb-1">
              <div className="flex items-center gap-[12px]">
                <span className="text-[13px] font-medium text-[#F7F5EC]">
                  {firstNameOf(profile.full_name)}
                </span>
                <RoleBadge role={profile.role} />
              </div>
            </div>
          )}
          {show.dashboard && (
            <Link
              href="/dashboard"
              onClick={closeMobile}
              className={`py-3 px-4 w-full text-[13px] font-medium font-sans transition-colors ${
                isDashboardActive ? "text-[#F7F5EC]" : "text-[rgba(247,245,236,0.65)] hover:text-[#F7F5EC]"
              }`}
            >
              Dashboard
            </Link>
          )}
          {show.financial && (
            <MobileNavSection
              label="Financial"
              items={financialItems}
              onItemClick={closeMobile}
              activeHref={financialItems.find((i) => pathname === i.href)?.href}
              defaultOpen={isFinancialActive}
            />
          )}
          {show.operations && (
            <MobileNavSection
              label="Operations"
              items={operationsItems}
              defaultOpen={false}
              onItemClick={closeMobile}
            />
          )}
          {show.cost_intelligence && (
            <MobileNavSection
              label="Cost Intelligence"
              items={costIntelItems}
              onItemClick={closeMobile}
              activeHref={costIntelItems.find((i) => pathname === i.href)?.href}
              defaultOpen={isCostIntelActive}
            />
          )}
          {show.admin && (
            <MobileNavSection
              label="Admin"
              items={adminItems}
              onItemClick={closeMobile}
              activeHref={adminItems.find((i) => pathname === i.href)?.href}
              defaultOpen={isAdminActive}
            />
          )}
          <FeedbackTrigger className="w-full text-left py-3 px-4 text-[13px] font-sans transition-colors hover:underline underline-offset-4 text-[rgba(247,245,236,0.65)] hover:text-[#F7F5EC]">
            Give feedback
          </FeedbackTrigger>
          <form action={logoutAction} className="mt-1">
            <button type="submit" className="w-full text-left py-3 px-4 text-[13px] font-sans transition-colors hover:underline underline-offset-4 text-[rgba(247,245,236,0.65)] hover:text-[#F7F5EC]">
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
