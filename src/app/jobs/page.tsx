"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate, formatPercent, formatRelativeTime } from "@/lib/utils/format";
import { SkeletonList } from "@/components/loading-skeleton";
import EmptyState, { EmptyIcons } from "@/components/empty-state";
import FirstUseTip from "@/components/first-use-tip";

type JobStatus = "active" | "complete" | "warranty" | "cancelled";
type Health = "green" | "yellow" | "red";
type SortKey = "health" | "name" | "activity" | "budget";

interface JobHealth {
  id: string;
  name: string;
  address: string | null;
  client_name: string | null;
  contract_type: string;
  original_contract_amount: number;
  current_contract_amount: number;
  contract_date: string | null;
  status: JobStatus;
  pm_id: string | null;
  pm_name: string | null;
  health: Health;
  health_reasons: string[];
  pct_complete: number;
  budget_used_pct: number;
  open_invoices: number;
  oldest_invoice_days: number;
  last_activity_at: string | null;
  budget_total: number;
  invoiced_total: number;
}

type StatusFilter = "all" | JobStatus;

const HEALTH_RANK: Record<Health, number> = { red: 0, yellow: 1, green: 2 };
const HEALTH_DOT: Record<Health, string> = {
  green: "bg-nw-success",
  yellow: "bg-nw-warn",
  red: "bg-nw-danger",
};
const HEALTH_LABEL: Record<Health, string> = {
  green: "On track",
  yellow: "Needs attention",
  red: "Action required",
};

function StatusBadge({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, string> = {
    active: "text-nw-success border-nw-success",
    complete: "text-[rgba(59,88,100,0.55)] border-[rgba(59,88,100,0.30)]",
    warranty: "text-nw-warn border-nw-warn",
    cancelled: "text-nw-danger border-nw-danger",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] uppercase border bg-transparent ${map[status]}`}>
      {status}
    </span>
  );
}

function HealthDot({ health, reasons }: { health: Health; reasons: string[] }) {
  const tooltip = reasons.length > 0 ? reasons.join(" \u00b7 ") : HEALTH_LABEL[health];
  return (
    <span
      title={tooltip}
      aria-label={`Health: ${HEALTH_LABEL[health]}${reasons.length ? `. ${reasons.join(". ")}` : ""}`}
      className={`inline-block w-2.5 h-2.5 rounded-full ${HEALTH_DOT[health]}`}
    />
  );
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [sortKey, setSortKey] = useState<SortKey>("health");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?redirect=/jobs");
        return;
      }

      // Resolve role via org_members so it matches the rest of the app.
      const { data: membership } = await supabase
        .from("org_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      const userRole = (membership?.role as "owner" | "admin" | "pm" | "accounting" | undefined) ?? null;

      if (userRole !== "admin" && userRole !== "owner") {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      setAuthorized(true);

      const res = await fetch("/api/jobs/health", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as JobHealth[];
        setJobs(json);
      }
      setLoading(false);
    }
    load();
  }, [router]);

  const filtered = useMemo(() => {
    let result = jobs;
    if (statusFilter !== "all") {
      result = result.filter((j) => j.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (j) =>
          j.name.toLowerCase().includes(q) ||
          (j.address ?? "").toLowerCase().includes(q) ||
          (j.client_name ?? "").toLowerCase().includes(q)
      );
    }
    const sorted = [...result];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "health":
          return HEALTH_RANK[a.health] - HEALTH_RANK[b.health] || a.name.localeCompare(b.name);
        case "name":
          return a.name.localeCompare(b.name);
        case "activity": {
          const at = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
          const bt = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
          return bt - at;
        }
        case "budget": {
          const ar = a.budget_total - a.invoiced_total;
          const br = b.budget_total - b.invoiced_total;
          return br - ar;
        }
      }
    });
    return sorted;
  }, [jobs, statusFilter, search, sortKey]);

  if (authorized === false) {
    return (
      <main className="max-w-[1180px] mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-[22px] font-medium text-slate-tile">Access denied</h2>
        <p className="mt-2 text-[13px] text-[rgba(59,88,100,0.55)]">
          Jobs management is restricted to administrators.
        </p>
        <Link
          href="/"
          className="inline-block mt-6 px-4 py-2 border border-[rgba(59,88,100,0.15)] text-slate-tile hover:border-stone-blue transition-colors font-mono text-[11px] tracking-[0.12em] uppercase"
        >
          Return home
        </Link>
      </main>
    );
  }

  return (
      <main className="max-w-[1180px] mx-auto px-4 md:px-8 py-7">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
          <div>
            <h2 className="font-display text-[22px] font-medium tracking-[-0.01em] text-slate-tile">Jobs</h2>
            <p className="text-[13px] text-[rgba(59,88,100,0.55)] mt-0.5">
              {loading
                ? "Loading..."
                : `${filtered.length} ${filtered.length === 1 ? "job" : "jobs"}${statusFilter !== "all" ? ` (${statusFilter})` : ""}`}
            </p>
          </div>
          <Link
            href="/jobs/new"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-deep hover:bg-slate-deeper text-white-sand font-mono text-[11px] tracking-[0.12em] uppercase font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Job
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder="Search by name, address, or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 bg-white border border-[rgba(59,88,100,0.15)] text-[14px] font-sans text-slate-tile placeholder:text-[rgba(59,88,100,0.40)] focus:border-stone-blue focus:outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 bg-white border border-[rgba(59,88,100,0.15)] text-[14px] font-sans text-slate-tile focus:border-stone-blue focus:outline-none"
          >
            <option value="active">Active</option>
            <option value="complete">Complete</option>
            <option value="warranty">Warranty</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All Statuses</option>
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="px-3 py-2 bg-white border border-[rgba(59,88,100,0.15)] text-[14px] font-sans text-slate-tile focus:border-stone-blue focus:outline-none"
            aria-label="Sort jobs"
          >
            <option value="health">Sort: Health (worst first)</option>
            <option value="name">Sort: Name (A-Z)</option>
            <option value="activity">Sort: Last activity</option>
            <option value="budget">Sort: Budget remaining</option>
          </select>
        </div>

        {/* Health legend */}
        {!loading && jobs.length > 0 && (
          <div className="flex items-center gap-4 mb-4 font-mono text-[10px] tracking-[0.12em] uppercase text-[rgba(59,88,100,0.55)]">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${HEALTH_DOT.green}`} /> Green: on track
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${HEALTH_DOT.yellow}`} /> Yellow: needs attention
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${HEALTH_DOT.red}`} /> Red: action required
            </span>
          </div>
        )}

        {loading ? (
          <SkeletonList rows={6} columns={["w-24", "w-40", "w-32", "w-32", "w-20", "w-20", "w-20"]} />
        ) : filtered.length === 0 ? (
          jobs.length === 0 ? (
            <>
              <FirstUseTip id="jobs-empty">
                Jobs are the foundation of everything in Nightwork. Create a job for each project you&apos;re managing — budgets, invoices, and draws all connect here.
              </FirstUseTip>
              <EmptyState
                icon={<EmptyIcons.Building />}
                title="No jobs yet"
                message="Create your first job to start tracking budgets, invoices, and draws."
                primaryAction={{ label: "+ New Job", href: "/jobs/new" }}
              />
            </>
          ) : (
            <EmptyState
              icon={<EmptyIcons.Search />}
              title="No matching jobs"
              message="Try adjusting your search or filter to see more results."
            />
          )
        ) : (
          <>
            {/* Mobile card view (< md) */}
            <div className="md:hidden space-y-3">
              {filtered.map((j) => (
                <Link
                  key={j.id}
                  href={`/jobs/${j.id}`}
                  className="block border border-[rgba(59,88,100,0.15)] bg-white p-4 active:bg-[rgba(91,134,153,0.04)] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1.5">
                      <HealthDot health={j.health} reasons={j.health_reasons} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] text-slate-tile font-medium truncate">{j.name}</div>
                          <div className="text-[12px] text-[rgba(59,88,100,0.55)] truncate">{j.address ?? "\u2014"}</div>
                        </div>
                        <StatusBadge status={j.status} />
                      </div>
                      <div className="mt-2 text-[12px] text-[rgba(59,88,100,0.55)]">
                        <span>{j.client_name ?? "\u2014"}</span>
                        <span className="text-[rgba(59,88,100,0.40)]"> \u00b7 PM: {j.pm_name ?? "\u2014"}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div>
                          <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-[rgba(59,88,100,0.55)]">Complete</div>
                          <div className="font-mono text-[12px] text-slate-tile tabular-nums">{formatPercent(j.pct_complete)}</div>
                        </div>
                        <div>
                          <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-[rgba(59,88,100,0.55)]">Budget Used</div>
                          <div className={`font-mono text-[12px] tabular-nums ${j.budget_used_pct > 100 ? "text-nw-danger" : "text-slate-tile"}`}>
                            {formatPercent(j.budget_used_pct)}
                          </div>
                        </div>
                        <div>
                          <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-[rgba(59,88,100,0.55)]">Open Invoices</div>
                          <div className="font-mono text-[12px] tabular-nums">
                            {j.open_invoices > 0 ? (
                              <span className={j.oldest_invoice_days >= 7 ? "text-nw-danger" : "text-nw-warn"}>
                                {j.open_invoices}
                              </span>
                            ) : (
                              <span className="text-[rgba(59,88,100,0.40)]">\u2014</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 font-mono text-[10px] tracking-[0.08em] text-[rgba(59,88,100,0.55)]">
                        {j.last_activity_at ? `Active ${formatRelativeTime(j.last_activity_at)}` : `Contract ${formatDate(j.contract_date)}`}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop table view (>= md) */}
            <div className="hidden md:block border border-[rgba(59,88,100,0.15)] bg-white overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[rgba(59,88,100,0.15)]">
                    <th className="text-left px-3 py-2.5 font-mono text-[9px] tracking-[0.12em] uppercase text-[rgba(59,88,100,0.55)] font-medium w-8" aria-label="Health"></th>
                    <th className="text-left px-3 py-2.5 font-mono text-[9px] tracking-[0.12em] uppercase text-[rgba(59,88,100,0.55)] font-medium">Name</th>
                    <th className="text-left px-3 py-2.5 font-mono text-[9px] tracking-[0.12em] uppercase text-[rgba(59,88,100,0.55)] font-medium">Client / PM</th>
                    <th className="text-right px-3 py-2.5 font-mono text-[9px] tracking-[0.12em] uppercase text-[rgba(59,88,100,0.55)] font-medium">% Complete</th>
                    <th className="text-right px-3 py-2.5 font-mono text-[9px] tracking-[0.12em] uppercase text-[rgba(59,88,100,0.55)] font-medium">Budget Used</th>
                    <th className="text-center px-3 py-2.5 font-mono text-[9px] tracking-[0.12em] uppercase text-[rgba(59,88,100,0.55)] font-medium">Open Inv.</th>
                    <th className="text-left px-3 py-2.5 font-mono text-[9px] tracking-[0.12em] uppercase text-[rgba(59,88,100,0.55)] font-medium">Last Activity</th>
                    <th className="text-left px-3 py-2.5 font-mono text-[9px] tracking-[0.12em] uppercase text-[rgba(59,88,100,0.55)] font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((j) => (
                    <tr
                      key={j.id}
                      className="border-b border-[rgba(59,88,100,0.08)] last:border-0 hover:bg-[rgba(91,134,153,0.04)] cursor-pointer transition-colors"
                      onClick={() => router.push(`/jobs/${j.id}`)}
                    >
                      <td className="px-3 py-3">
                        <HealthDot health={j.health} reasons={j.health_reasons} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-slate-tile font-medium">{j.name}</div>
                        <div className="text-[12px] text-[rgba(59,88,100,0.55)]">{j.address ?? "\u2014"}</div>
                      </td>
                      <td className="px-3 py-3 text-[rgba(59,88,100,0.70)]">
                        <div>{j.client_name ?? "\u2014"}</div>
                        <div className="text-[12px] text-[rgba(59,88,100,0.55)]">PM: {j.pm_name ?? "\u2014"}</div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[12px] text-slate-tile tabular-nums">
                        {formatPercent(j.pct_complete)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        <span className={`text-[12px] ${j.budget_used_pct > 100 ? "text-nw-danger" : "text-slate-tile"}`}>
                          {formatPercent(j.budget_used_pct)}
                        </span>
                        <div className="text-[10px] text-[rgba(59,88,100,0.55)]">
                          {formatCents(j.invoiced_total)} / {formatCents(j.budget_total)}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {j.open_invoices > 0 ? (
                          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 font-mono text-[9px] tracking-[0.12em] uppercase border ${
                            j.oldest_invoice_days >= 7 ? "border-nw-danger text-nw-danger" : "border-nw-warn text-nw-warn"
                          }`}>
                            {j.open_invoices}
                          </span>
                        ) : (
                          <span className="text-[rgba(59,88,100,0.40)] text-[12px]">\u2014</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[rgba(59,88,100,0.55)] text-[12px]">
                        {j.last_activity_at ? formatRelativeTime(j.last_activity_at) : formatDate(j.contract_date)}
                      </td>
                      <td className="px-3 py-3"><StatusBadge status={j.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
  );
}
