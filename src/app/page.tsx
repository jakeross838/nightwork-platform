"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import NavBar from "@/components/nav-bar";

type UserRole = "admin" | "pm" | "accounting";

type NavItem = {
  key: string;
  href: string;
  title: string;
  subtitle: string;
  count?: number;
  roles: UserRole[];
};

function firstNameOf(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export default function Home() {
  const [status, setStatus] = useState<"loading" | "connected" | "error">("loading");
  const [role, setRole] = useState<UserRole | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [pmCount, setPmCount] = useState(0);
  const [qaCount, setQaCount] = useState(0);

  useEffect(() => {
    async function check() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        let resolvedRole: UserRole | null = null;
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, full_name")
            .eq("id", user.id)
            .single();
          if (profile?.role) {
            resolvedRole = profile.role as UserRole;
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
        } else if (resolvedRole === "admin") {
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
      } catch {
        setStatus("error");
      }
    }
    check();
  }, []);

  const cards: NavItem[] = [
    { key: "upload",   href: "/invoices/upload", title: "Upload Invoices", subtitle: "Drag and drop — AI parses instantly", roles: ["admin", "accounting"] },
    { key: "all",      href: "/invoices",        title: "All Invoices",    subtitle: "Search, filter, track every invoice", roles: ["admin", "pm", "accounting"] },
    { key: "pmQueue",  href: "/invoices/queue",  title: "PM Queue",        subtitle: pmCount > 0 ? `${pmCount} pending review` : "No invoices waiting", count: pmCount, roles: ["admin", "pm"] },
    { key: "qaQueue",  href: "/invoices/qa",     title: "Accounting QA",   subtitle: qaCount > 0 ? `${qaCount} ready for QA` : "QA queue clear",        count: qaCount, roles: ["admin", "accounting"] },
    { key: "draws",    href: "/draws",           title: "Draws",           subtitle: "G702/G703 pay applications", roles: ["admin", "pm"] },
    { key: "vendors",  href: "/vendors",         title: "Vendors",         subtitle: "Manage vendors and merge duplicates", roles: ["admin", "accounting"] },
    { key: "jobs",     href: "/jobs",            title: "Jobs",            subtitle: "Create and manage projects", roles: ["admin"] },
  ];

  const visibleCards = role ? cards.filter((c) => c.roles.includes(role)) : [];

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden px-6 py-12">
        <div className="relative z-10 text-center max-w-3xl">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-brand-border mb-6 rounded-none">
              <span className={`h-1.5 w-1.5 ${status === "loading" ? "bg-brass animate-pulse" : status === "connected" ? "bg-status-success" : "bg-status-danger"}`} />
              <span className="text-[10px] text-cream-dim tracking-[0.08em] uppercase">
                {status === "loading" ? "Connecting..." : status === "connected" ? "Systems Online" : "Connection Failed"}
              </span>
            </div>
          </div>

          <h1 className="animate-fade-up stagger-1 font-display text-5xl md:text-6xl text-cream tracking-tight leading-[1.1]">
            Ross Command Center
          </h1>
          <p className="animate-fade-up stagger-2 mt-4 font-body text-cream-muted text-lg">Ross Built Custom Homes</p>
          <div className="animate-fade-up stagger-3 mt-2 flex items-center justify-center gap-3 text-cream-dim text-sm">
            <span>Bradenton</span><span className="text-teal">&#x2022;</span><span>Anna Maria Island</span>
          </div>

          {/* Personalized greeting */}
          {firstName && (
            <p className="animate-fade-up stagger-4 mt-10 font-display text-xl text-cream">
              Welcome, {firstName}
            </p>
          )}

          {/* Navigation cards — filtered by role */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-up stagger-4">
            {visibleCards.map((c) => (
              <NavCard key={c.key} href={c.href} title={c.title} subtitle={c.subtitle} count={c.count} />
            ))}
          </div>
        </div>

        <div className="mt-12 text-center animate-fade-up stagger-6">
          <p className="text-[11px] text-cream-dim tracking-[0.08em] uppercase">Est. 2006 &middot; Luxury Coastal Custom Homes</p>
        </div>
      </div>
    </div>
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
