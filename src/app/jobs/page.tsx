"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate, formatPercent, formatRelativeTime } from "@/lib/utils/format";
import { SkeletonList } from "@/components/loading-skeleton";
import EmptyState, { EmptyIcons } from "@/components/empty-state";
import FirstUseTip from "@/components/first-use-tip";
import NwBadge, { type BadgeVariant } from "@/components/nw/Badge";
import NwStatusDot, { type StatusDotVariant } from "@/components/nw/StatusDot";

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
const HEALTH_DOT_VARIANT: Record<Health, StatusDotVariant> = {
  green: "active",
  yellow: "pending",
  red: "danger",
};
const HEALTH_LABEL: Record<Health, string> = {
  green: "On track",
  yellow: "Needs attention",
  red: "Action required",
};

const JOB_STATUS_VARIANT: Record<JobStatus, BadgeVariant> = {
  active: "success",
  complete: "info",
  warranty: "warning",
  cancelled: "danger",
};

function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <NwBadge variant={JOB_STATUS_VARIANT[status]} size="sm">
      {status}
    </NwBadge>
  );
}

function HealthDot({ health, reasons }: { health: Health; reasons: string[] }) {
  const tooltip = reasons.length > 0 ? reasons.join(" • ") : HEALTH_LABEL[health];
  return (
    <span
      title={tooltip}
      aria-label={`Health: ${HEALTH_LABEL[health]}${reasons.length ? `. ${reasons.join(". ")}` : ""}`}
    >
      <NwStatusDot variant={HEALTH_DOT_VARIANT[health]} size="md" />
    </span>
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
        .order("created_at", { ascending: true })
        .limit(1)
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
      <main className="max-w-[1600px] mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-2xl" style={{ color: "var(--text-primary)" }}>Access denied</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--text-tertiary)" }}>
          Jobs management is restricted to administrators.
        </p>
        <Link
          href="/"
          className="inline-block mt-6 px-4 py-2 border text-[var(--text-primary)] border-[var(--border-default)] hover:border-[var(--nw-stone-blue)] transition-colors"
        >
          Return home
        </Link>
      </main>
    );
  }

  return (
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
          <div>
            <span
              className="block mb-2 text-[10px] uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Operations · Jobs
            </span>
            <h2
              className="m-0"
              style={{
                fontFamily: "var(--font-space-grotesk)",
                fontWeight: 500,
                fontSize: "30px",
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
              }}
            >
              Jobs
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {loading
                ? "Loading..."
                : `${filtered.length} ${filtered.length === 1 ? "job" : "jobs"}${statusFilter !== "all" ? ` (${statusFilter})` : ""}`}
            </p>
          </div>
          <Link
            href="/jobs/new"
            className="inline-flex items-center gap-1.5 h-9 px-4 text-[11px] uppercase font-medium border transition-colors"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.12em",
              background: "var(--nw-stone-blue)",
              borderColor: "var(--nw-stone-blue)",
              color: "var(--nw-white-sand)",
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
            className="flex-1 px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
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
            className="px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
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
          <div className="flex items-center gap-4 mb-4 text-[11px] text-[var(--text-tertiary)]">
            <span className="flex items-center gap-1.5">
              <NwStatusDot variant="active" size="sm" /> Green: on track
            </span>
            <span className="flex items-center gap-1.5">
              <NwStatusDot variant="pending" size="sm" /> Yellow: needs attention
            </span>
            <span className="flex items-center gap-1.5">
              <NwStatusDot variant="danger" size="sm" /> Red: action required
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
                  className="block border border-[var(--border-default)] bg-[var(--bg-card)] p-4 active:bg-[var(--bg-subtle)] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1.5">
                      <HealthDot health={j.health} reasons={j.health_reasons} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[var(--text-primary)] font-medium truncate">{j.name}</div>
                          <div className="text-xs text-[var(--text-tertiary)] truncate">{j.address ?? "—"}</div>
                        </div>
                        <StatusBadge status={j.status} />
                      </div>
                      <div className="mt-2 text-xs text-[var(--text-secondary)]">
                        <span>{j.client_name ?? "—"}</span>
                        <span className="text-[var(--text-tertiary)]"> · PM: {j.pm_name ?? "—"}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Complete</div>
                          <div className="text-[var(--text-primary)] tabular-nums">{formatPercent(j.pct_complete)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Budget Used</div>
                          <div className={`tabular-nums ${j.budget_used_pct > 100 ? "text-[color:var(--nw-danger)]" : "text-[var(--text-primary)]"}`}>
                            {formatPercent(j.budget_used_pct)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Open Invoices</div>
                          <div className="text-[var(--text-primary)] tabular-nums">
                            {j.open_invoices > 0 ? (
                              <span className={j.oldest_invoice_days >= 7 ? "text-[color:var(--nw-danger)]" : "text-[color:var(--nw-warn)]"}>
                                {j.open_invoices}
                              </span>
                            ) : (
                              <span className="text-[var(--text-tertiary)]">—</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-[10px] text-[var(--text-tertiary)]">
                        {j.last_activity_at ? `Active ${formatRelativeTime(j.last_activity_at)}` : `Contract ${formatDate(j.contract_date)}`}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop table view (>= md) */}
            <div className="hidden md:block border border-[var(--border-default)] bg-[var(--bg-card)] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-default)] text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] font-medium">
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
                      className="border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors"
                      onClick={() => router.push(`/jobs/${j.id}`)}
                    >
                      <td className="px-4 py-3">
                        <HealthDot health={j.health} reasons={j.health_reasons} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[var(--text-primary)] font-medium">{j.name}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">{j.address ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        <div>{j.client_name ?? "—"}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">PM: {j.pm_name ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--text-primary)] tabular-nums">
                        {formatPercent(j.pct_complete)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={j.budget_used_pct > 100 ? "text-[color:var(--nw-danger)]" : "text-[var(--text-primary)]"}>
                          {formatPercent(j.budget_used_pct)}
                        </span>
                        <div className="text-[10px] text-[var(--text-tertiary)]">
                          {formatCents(j.invoiced_total)} / {formatCents(j.budget_total)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {j.open_invoices > 0 ? (
                          <NwBadge variant={j.oldest_invoice_days >= 7 ? "danger" : "warning"} size="sm">
                            {String(j.open_invoices)}
                          </NwBadge>
                        ) : (
                          <span className="text-[var(--text-tertiary)] text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] text-xs">
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
  );
}
