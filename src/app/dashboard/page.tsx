"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import NavBar from "@/components/nav-bar";
import { useOrgBranding } from "@/components/org-branding-provider";
import { PUBLIC_APP_NAME } from "@/lib/org/public";
import GettingStartedChecklist from "@/components/getting-started-checklist";

type UserRole = "owner" | "admin" | "pm" | "accounting";

type NavItem = {
  key: string;
  href: string;
  title: string;
  subtitle: string;
  count?: number;
  roles: UserRole[];
};

type DashboardStats = {
  activeJobs: number;
  pendingInvoices: number;
  currentDrawCents: number;
  teamMembers: number;
};

function firstNameOf(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default function Home() {
  const [status, setStatus] = useState<"loading" | "connected" | "error">("loading");
  const [role, setRole] = useState<UserRole | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [pmCount, setPmCount] = useState(0);
  const [qaCount, setQaCount] = useState(0);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        let resolvedRole: UserRole | null = null;
        if (user) {
          const [{ data: profile }, { data: membership }] = await Promise.all([
            supabase.from("profiles").select("full_name").eq("id", user.id).single(),
            supabase
              .from("org_members")
              .select("role")
              .eq("user_id", user.id)
              .eq("is_active", true)
              .maybeSingle(),
          ]);
          if (membership?.role) {
            resolvedRole = membership.role as UserRole;
            setRole(resolvedRole);
          }
          if (profile?.full_name) setFirstName(firstNameOf(profile.full_name));
        }

        const { error } = await supabase.from("cost_codes").select("id").limit(1);
        setStatus(error ? "error" : "connected");

        // PM count scoped to the signed-in PM's jobs; global for admin.
        let pmCountVal = 0;
        if (user && resolvedRole === "pm") {
          const { data: myJobs } = await supabase
            .from("jobs")
            .select("id")
            .eq("pm_id", user.id)
            .is("deleted_at", null);
          const jobIds = (myJobs ?? []).map((j) => j.id as string);
          const orClause =
            jobIds.length > 0
              ? `assigned_pm_id.eq.${user.id},job_id.in.(${jobIds.join(",")})`
              : `assigned_pm_id.eq.${user.id}`;
          const { count } = await supabase
            .from("invoices")
            .select("id", { count: "exact", head: true })
            .in("status", ["pm_review", "ai_processed"])
            .is("deleted_at", null)
            .or(orClause);
          pmCountVal = count ?? 0;
        } else if (resolvedRole === "admin" || resolvedRole === "owner") {
          const { count } = await supabase
            .from("invoices")
            .select("id", { count: "exact", head: true })
            .in("status", ["pm_review", "ai_processed"])
            .is("deleted_at", null);
          pmCountVal = count ?? 0;
        }

        const { count: qaCountVal } = await supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .in("status", ["qa_review", "pm_approved"])
          .is("deleted_at", null);

        setPmCount(pmCountVal);
        setQaCount(qaCountVal ?? 0);

        // Dashboard stat cards — org-scoped (RLS handles org isolation).
        // Run in parallel; any single failure leaves that stat at 0 so the
        // rest of the dashboard still renders.
        const [activeJobsRes, pendingInvoicesRes, drawInvoicesRes, teamMembersRes] =
          await Promise.all([
            supabase
              .from("jobs")
              .select("id", { count: "exact", head: true })
              .eq("status", "active")
              .is("deleted_at", null),
            supabase
              .from("invoices")
              .select("id", { count: "exact", head: true })
              .in("status", ["pm_review", "ai_processed", "qa_review", "pm_approved"])
              .is("deleted_at", null),
            supabase
              .from("invoices")
              .select("total_amount")
              .in("status", ["qa_approved", "pushed_to_qb"])
              .is("deleted_at", null)
              .is("draw_id", null),
            supabase
              .from("org_members")
              .select("id", { count: "exact", head: true })
              .eq("is_active", true),
          ]);

        const currentDrawCents = (drawInvoicesRes.data ?? []).reduce(
          (sum, row) => sum + (Number((row as { total_amount: number }).total_amount) || 0),
          0
        );

        setStats({
          activeJobs: activeJobsRes.count ?? 0,
          pendingInvoices: pendingInvoicesRes.count ?? 0,
          currentDrawCents,
          teamMembers: teamMembersRes.count ?? 0,
        });
      } catch {
        setStatus("error");
      }
    }
    check();
  }, []);

  const cards: NavItem[] = [
    { key: "upload",   href: "/invoices/upload", title: "Upload Invoices", subtitle: "Drag and drop — AI parses instantly", roles: ["owner", "admin", "accounting"] },
    { key: "all",      href: "/invoices",        title: "All Invoices",    subtitle: "Search, filter, track every invoice", roles: ["owner", "admin", "pm", "accounting"] },
    { key: "pmQueue",  href: "/invoices/queue",  title: "PM Queue",        subtitle: pmCount > 0 ? `${pmCount} pending review` : "No invoices waiting", count: pmCount, roles: ["owner", "admin", "pm"] },
    { key: "qaQueue",  href: "/invoices/qa",     title: "Accounting QA",   subtitle: qaCount > 0 ? `${qaCount} ready for QA` : "QA queue clear",        count: qaCount, roles: ["owner", "admin", "accounting"] },
    { key: "draws",    href: "/draws",           title: "Draws",           subtitle: "G702/G703 pay applications", roles: ["owner", "admin", "pm"] },
    { key: "vendors",  href: "/vendors",         title: "Vendors",         subtitle: "Manage vendors and merge duplicates", roles: ["owner", "admin", "accounting"] },
    { key: "jobs",     href: "/jobs",            title: "Jobs",            subtitle: "Create and manage projects", roles: ["owner", "admin"] },
  ];

  const visibleCards = role ? cards.filter((c) => c.roles.includes(role)) : [];
  const branding = useOrgBranding();
  const brandName = branding?.name ?? PUBLIC_APP_NAME;
  const tagline = branding?.tagline ?? null;

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden px-6 py-12">
        <div className="relative z-10 text-center max-w-5xl w-full">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-brand-border mb-6 rounded-none">
              <span className={`h-1.5 w-1.5 ${status === "loading" ? "bg-brass animate-pulse" : status === "connected" ? "bg-status-success" : "bg-status-danger"}`} />
              <span className="text-[10px] text-cream-dim tracking-[0.08em] uppercase">
                {status === "loading" ? "Connecting..." : status === "connected" ? "Systems Online" : "Connection Failed"}
              </span>
            </div>
          </div>

          <h1 className="animate-fade-up stagger-1 font-display text-5xl md:text-6xl text-cream tracking-tight leading-[1.1]">
            {brandName}
          </h1>

          {/* Personalized greeting */}
          {firstName && (
            <p className="animate-fade-up stagger-4 mt-10 font-display text-xl text-cream">
              Welcome, {firstName}
            </p>
          )}

          {/* Stat cards — org-scoped KPIs */}
          {stats && (role === "admin" || role === "owner") && (
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-up stagger-4">
              <StatCard label="Active Jobs" value={stats.activeJobs.toString()} href="/jobs" />
              <StatCard label="Pending Invoices" value={stats.pendingInvoices.toString()} href="/invoices" />
              <StatCard label="Current Draw" value={formatCents(stats.currentDrawCents)} href="/draws" />
              <StatCard label="Team Members" value={stats.teamMembers.toString()} href="/settings/team" />
            </div>
          )}

          {/* Navigation cards — filtered by role */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-up stagger-4">
            {visibleCards.map((c) => (
              <NavCard key={c.key} href={c.href} title={c.title} subtitle={c.subtitle} count={c.count} />
            ))}
          </div>

          <GettingStartedChecklist />
        </div>

        {tagline && (
          <div className="mt-12 text-center animate-fade-up stagger-6">
            <p className="text-[11px] text-cream-dim tracking-[0.08em] uppercase">{tagline}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-start p-4 border border-brand-border bg-white hover:border-teal/60 transition-colors text-left"
    >
      <span className="text-[10px] tracking-[0.12em] uppercase text-cream-dim">{label}</span>
      <span className="mt-2 font-display text-3xl text-cream">{value}</span>
    </Link>
  );
}

function NavCard({ href, title, subtitle, count }: {
  href: string; title: string; subtitle: string; count?: number;
}) {
  return (
    <Link href={href}
      className="group relative flex flex-col items-start p-5 border border-brand-border bg-white hover:border-teal/40 transition-all duration-300 text-left rounded-none">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-[15px] text-cream font-medium">{title}</h2>
        {count != null && count > 0 && (
          <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 border border-teal text-teal text-[10px] font-bold rounded-none">{count}</span>
        )}
      </div>
      <p className="mt-1 text-sm text-cream-dim">{subtitle}</p>
      <svg className="absolute top-5 right-5 w-4 h-4 text-cream-dim group-hover:text-teal group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
