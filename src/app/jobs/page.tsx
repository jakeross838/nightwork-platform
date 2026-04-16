"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate, formatPercent, formatRelativeTime } from "@/lib/utils/format";
import NavBar from "@/components/nav-bar";
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
  green: "bg-status-success",
  yellow: "bg-brass",
  red: "bg-status-danger",
};
const HEALTH_LABEL: Record<Health, string> = {
  green: "On track",
  yellow: "Needs attention",
  red: "Action required",
};

function StatusBadge({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, string> = {
    active: "text-status-success border-status-success",
    complete: "text-teal border-teal",
    warranty: "text-brass border-brass",
    cancelled: "text-status-danger border-status-danger",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider border bg-transparent ${map[status]}`}>
      {status}
    </span>
  );
}

function HealthDot({ health, reasons }: { health: Health; reasons: string[] }) {
  const tooltip = reasons.length > 0 ? reasons.join(" • ") : HEALTH_LABEL[health];
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
      <div className="min-h-screen">
        <NavBar />
        <main className="max-w-[1600px] mx-auto px-6 py-16 text-center">
          <h2 className="font-display text-2xl text-cream">Access denied</h2>
          <p className="mt-2 text-sm text-cream-dim">
            Jobs management is restricted to administrators.
          </p>
          <Link
            href="/"
            className="inline-block mt-6 px-4 py-2 border border-brand-border text-cream hover:border-teal transition-colors"
          >
            Return home
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h2 className="font-display text-2xl text-cream">Jobs</h2>
            <p className="text-sm text-cream-dim mt-1">
              {loading
                ? "Loading..."
                : `${filtered.length} ${filtered.length === 1 ? "job" : "jobs"}${statusFilter !== "all" ? ` (${statusFilter})` : ""}`}
            </p>
          </div>
          <Link
            href="/jobs/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal hover:bg-teal-hover text-white text-sm font-medium transition-colors"
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
            className="flex-1 px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none"
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
            className="px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:border-teal focus:outline-none"
            aria-label="Sort jobs"
          >
            <option value="health">Sort: Health (worst first)</option>
            <option value="name">Sort: Name (A→Z)</option>
            <option value="activity">Sort: Last activity</option>
            <option value="budget">Sort: Budget remaining</option>
          </select>
        </div>

        {/* Health legend */}
        {!loading && jobs.length > 0 && (
          <div className="flex items-center gap-4 mb-4 text-[11px] text-cream-dim">
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
                Jobs are the foundation of everything in CommandPost. Create a job for each project you&apos;re managing — budgets, invoices, and draws all connect here.
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
                  className="block border border-brand-border bg-brand-card p-4 active:bg-brand-surface transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1.5">
                      <HealthDot health={j.health} reasons={j.health_reasons} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-cream font-medium truncate">{j.name}</div>
                          <div className="text-xs text-cream-dim truncate">{j.address ?? "—"}</div>
                        </div>
                        <StatusBadge status={j.status} />
                      </div>
                      <div className="mt-2 text-xs text-cream-muted">
                        <span>{j.client_name ?? "—"}</span>
                        <span className="text-cream-dim"> · PM: {j.pm_name ?? "—"}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-cream-dim">Complete</div>
                          <div className="text-cream tabular-nums">{formatPercent(j.pct_complete)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-cream-dim">Budget Used</div>
                          <div className={`tabular-nums ${j.budget_used_pct > 100 ? "text-status-danger" : "text-cream"}`}>
                            {formatPercent(j.budget_used_pct)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-cream-dim">Open Invoices</div>
                          <div className="text-cream tabular-nums">
                            {j.open_invoices > 0 ? (
                              <span className={j.oldest_invoice_days >= 7 ? "text-status-danger" : "text-brass"}>
                                {j.open_invoices}
                              </span>
                            ) : (
                              <span className="text-cream-dim">—</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-[10px] text-cream-dim">
                        {j.last_activity_at ? `Active ${formatRelativeTime(j.last_activity_at)}` : `Contract ${formatDate(j.contract_date)}`}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop table view (>= md) */}
            <div className="hidden md:block border border-brand-border bg-brand-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-border text-[11px] uppercase tracking-wider text-cream-dim">
                    <th className="text-left px-4 py-3 font-medium w-8" aria-label="Health"></th>
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Client / PM</th>
                    <th className="text-right px-4 py-3 font-medium">% Complete</th>
                    <th className="text-right px-4 py-3 font-medium">Budget Used</th>
                    <th className="text-center px-4 py-3 font-medium">Open Invoices</th>
                    <th className="text-left px-4 py-3 font-medium">Last Activity</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((j) => (
                    <tr
                      key={j.id}
                      className="border-b border-brand-row-border last:border-0 hover:bg-brand-surface cursor-pointer transition-colors"
                      onClick={() => router.push(`/jobs/${j.id}`)}
                    >
                      <td className="px-4 py-3">
                        <HealthDot health={j.health} reasons={j.health_reasons} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-cream font-medium">{j.name}</div>
                        <div className="text-xs text-cream-dim">{j.address ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-cream-muted">
                        <div>{j.client_name ?? "—"}</div>
                        <div className="text-xs text-cream-dim">PM: {j.pm_name ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-cream tabular-nums">
                        {formatPercent(j.pct_complete)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={j.budget_used_pct > 100 ? "text-status-danger" : "text-cream"}>
                          {formatPercent(j.budget_used_pct)}
                        </span>
                        <div className="text-[10px] text-cream-dim">
                          {formatCents(j.invoiced_total)} / {formatCents(j.budget_total)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {j.open_invoices > 0 ? (
                          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-medium border ${
                            j.oldest_invoice_days >= 7 ? "border-status-danger text-status-danger" : "border-brass text-brass"
                          }`}>
                            {j.open_invoices}
                          </span>
                        ) : (
                          <span className="text-cream-dim text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-cream-muted text-xs">
                        {j.last_activity_at ? formatRelativeTime(j.last_activity_at) : formatDate(j.contract_date)}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={j.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
