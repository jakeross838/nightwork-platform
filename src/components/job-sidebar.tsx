"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type UserRole = "owner" | "admin" | "pm" | "accounting";
type SortKey = "alpha" | "status" | "recent";
type FilterKey = "all" | "mine";

interface SidebarJob {
  id: string;
  name: string;
  address: string | null;
  status: string;
  client_name: string | null;
  client_email: string | null;
  pm_id: string | null;
  updated_at: string;
}

const COLLAPSE_KEY = "nightwork:sidebar-collapsed";

const SORT_LABELS: Record<SortKey, string> = {
  alpha: "A-Z",
  status: "Status",
  recent: "Recent",
};

const SORT_CYCLE: SortKey[] = ["alpha", "status", "recent"];

/** Status dot color — rounded-full is the ONE exception to the square rule */
function statusDot(status: string): string {
  if (status === "active") return "bg-nw-success";
  if (status === "warranty") return "bg-nw-warn";
  if (status === "complete") return "bg-[rgba(59,88,100,0.55)]";
  return "bg-[rgba(59,88,100,0.55)]";
}

function statusLabel(status: string): string {
  if (status === "active") return "Active";
  if (status === "complete") return "Complete";
  if (status === "warranty") return "Warranty";
  if (status === "cancelled") return "Cancelled";
  return status;
}

export default function JobSidebar({ mobile }: { mobile?: boolean } = {}) {
  const pathname = usePathname();
  const [jobs, setJobs] = useState<SidebarJob[]>([]);
  const [role, setRole] = useState<UserRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("alpha");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);

  // Parse current job ID and tab from pathname
  const currentJobId = useMemo(() => {
    const m = pathname.match(/^\/jobs\/([a-f0-9-]+)/);
    return m?.[1] ?? null;
  }, [pathname]);

  const currentTab = useMemo(() => {
    const m = pathname.match(/^\/jobs\/[a-f0-9-]+\/(.*)/);
    return m?.[1] ?? "";
  }, [pathname]);

  // Load collapse state from localStorage
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(COLLAPSE_KEY) : null;
    if (stored === "1") setCollapsed(true);
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const cycleSort = useCallback(() => {
    setSort((prev) => {
      const idx = SORT_CYCLE.indexOf(prev);
      return SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
    });
  }, []);

  // Fetch user info (once)
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: membership } = await supabase
        .from("org_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      const userRole = (membership?.role as UserRole) ?? null;
      setRole(userRole);
      if (userRole === "pm") setFilter("mine");
    }
    loadUser();
  }, []);

  // Fetch jobs — refetches when filter changes so the server
  // only sends what the user should see (F-012 fix).
  useEffect(() => {
    if (!userId) return;
    async function loadJobs() {
      setLoading(true);
      let query = supabase
        .from("jobs")
        .select("id, name, address, status, client_name, client_email, pm_id, updated_at")
        .is("deleted_at", null)
        .order("name");

      if (filter === "mine" && role === "pm") {
        query = query.eq("pm_id", userId);
      }

      const { data: jobsData } = await query;
      setJobs((jobsData ?? []) as SidebarJob[]);
      setLoading(false);
    }
    loadJobs();
  }, [userId, filter, role]);

  // Search + sort (pm_id filter is now server-side)
  const filtered = useMemo(() => {
    let list = jobs;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (j) =>
          j.name.toLowerCase().includes(q) ||
          (j.address ?? "").toLowerCase().includes(q)
      );
    }
    if (sort === "alpha") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "status") list = [...list].sort((a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name));
    else if (sort === "recent") list = [...list].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return list;
  }, [jobs, search, sort]);

  const selectedJob = useMemo(
    () => (currentJobId ? jobs.find((j) => j.id === currentJobId) ?? null : null),
    [jobs, currentJobId]
  );

  const otherJobs = useMemo(
    () => filtered.filter((j) => j.id !== currentJobId),
    [filtered, currentJobId]
  );

  const canCreateJob = role === "owner" || role === "admin";

  function jobHref(jobId: string): string {
    if (currentTab) return `/jobs/${jobId}/${currentTab}`;
    return `/jobs/${jobId}`;
  }

  /* ─── Mobile mode ─── */
  if (mobile) {
    return (
      <div className="flex flex-col h-full bg-white">
        {/* Header controls */}
        <div
          className="p-3 space-y-2 border-b"
          style={{ borderColor: "rgba(59,88,100,0.15)" }}
        >
          {/* JOBS label + sort toggle */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[rgba(59,88,100,0.70)] font-medium">
              Jobs
            </span>
            <button
              type="button"
              onClick={cycleSort}
              className="font-mono text-[10px] tracking-[0.14em] uppercase text-[rgba(59,88,100,0.55)] hover:text-slate-tile transition-colors"
            >
              {SORT_LABELS[sort]}
            </button>
          </div>

          {canCreateJob && (
            <Link
              href="/jobs/new"
              className="flex items-center justify-center gap-1.5 w-full py-2 font-mono text-[10px] tracking-[0.14em] uppercase font-medium border text-stone-blue hover:bg-stone-blue hover:text-white transition-colors"
              style={{ borderColor: "var(--nw-stone-blue)" }}
            >
              + New Job
            </Link>
          )}

          {role === "pm" && (
            <div
              className="flex gap-0.5 p-0.5 border"
              style={{ borderColor: "rgba(59,88,100,0.15)" }}
            >
              <button
                type="button"
                onClick={() => setFilter("mine")}
                className={`flex-1 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                  filter === "mine"
                    ? "bg-[rgba(91,134,153,0.1)] text-slate-tile font-medium"
                    : "text-[rgba(59,88,100,0.55)] hover:text-slate-tile"
                }`}
              >
                My Jobs
              </button>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`flex-1 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                  filter === "all"
                    ? "bg-[rgba(91,134,153,0.1)] text-slate-tile font-medium"
                    : "text-[rgba(59,88,100,0.55)] hover:text-slate-tile"
                }`}
              >
                All Jobs
              </button>
            </div>
          )}

          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-2 py-1.5 font-sans text-[13px] border bg-white text-slate-tile placeholder:text-[rgba(59,88,100,0.40)] focus:outline-none focus:border-stone-blue"
            style={{ borderColor: "rgba(59,88,100,0.15)" }}
          />
        </div>

        {/* Selected job detail */}
        {selectedJob && (
          <div
            className="px-3 py-3 border-b bg-[rgba(91,134,153,0.1)]"
            style={{ borderColor: "rgba(59,88,100,0.15)" }}
          >
            <p className="text-[13px] font-sans font-medium text-slate-tile">
              {selectedJob.name}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${statusDot(selectedJob.status)}`}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[rgba(59,88,100,0.70)]">
                {statusLabel(selectedJob.status)}
              </span>
            </div>
          </div>
        )}

        {/* Job list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center">
              <div className="w-5 h-5 border-2 border-stone-blue/30 border-t-stone-blue rounded-full animate-spin mx-auto" />
            </div>
          ) : otherJobs.length === 0 ? (
            <p className="p-3 text-[13px] font-sans text-[rgba(59,88,100,0.55)] text-center">
              {search ? "No matches" : "No jobs"}
            </p>
          ) : (
            otherJobs.map((j) => (
              <Link
                key={j.id}
                href={jobHref(j.id)}
                className="flex items-center gap-2 px-3 py-2.5 font-sans text-[13px] text-slate-tile transition-colors hover:bg-[rgba(91,134,153,0.06)] border-b"
                style={{ borderColor: "rgba(59,88,100,0.08)" }}
                title={j.address ?? j.name}
              >
                <span
                  className={`shrink-0 inline-block w-1.5 h-1.5 rounded-full ${statusDot(j.status)}`}
                />
                <span className="truncate">{j.name}</span>
              </Link>
            ))
          )}
        </div>

        {/* Job count footer */}
        <div
          className="px-3 py-2 border-t"
          style={{ borderColor: "rgba(59,88,100,0.15)" }}
        >
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[rgba(59,88,100,0.55)]">
            {filtered.length} Job{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    );
  }

  /* ─── Collapsed rail (48px) ─── */
  if (collapsed) {
    return (
      <aside
        className="hidden md:flex flex-col items-center w-12 shrink-0 border-r bg-white py-4 gap-2"
        style={{ borderColor: "rgba(59,88,100,0.15)" }}
      >
        <button
          onClick={toggleCollapse}
          className="w-8 h-8 flex items-center justify-center text-[rgba(59,88,100,0.55)] hover:text-slate-tile hover:bg-[rgba(91,134,153,0.06)] transition-colors"
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div className="flex-1 overflow-y-auto w-full">
          {filtered.slice(0, 20).map((j) => {
            const active = j.id === currentJobId;
            return (
              <Link
                key={j.id}
                href={jobHref(j.id)}
                className={`block w-full py-2 px-1 text-center transition-colors ${
                  active
                    ? "bg-[rgba(91,134,153,0.1)] border-l-2 border-l-stone-blue"
                    : "hover:bg-[rgba(91,134,153,0.06)]"
                }`}
                title={j.name}
              >
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${statusDot(j.status)}`}
                />
              </Link>
            );
          })}
        </div>
        {/* Job count at bottom */}
        <span className="font-mono text-[10px] text-[rgba(59,88,100,0.55)]">
          {filtered.length}
        </span>
      </aside>
    );
  }

  /* ─── Expanded sidebar (220px) ─── */
  return (
    <aside
      className="hidden md:flex flex-col w-[220px] shrink-0 border-r bg-white overflow-hidden"
      style={{ borderColor: "rgba(59,88,100,0.15)" }}
    >
      {/* Header */}
      <div
        className="p-3 border-b space-y-2"
        style={{ borderColor: "rgba(59,88,100,0.15)" }}
      >
        {/* JOBS label + sort toggle + collapse */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[rgba(59,88,100,0.70)] font-medium">
              Jobs
            </span>
            <button
              type="button"
              onClick={cycleSort}
              className="font-mono text-[10px] tracking-[0.14em] uppercase text-[rgba(59,88,100,0.40)] hover:text-slate-tile transition-colors"
              title={`Sort: ${SORT_LABELS[sort]}`}
            >
              {SORT_LABELS[sort]}
            </button>
          </div>
          <button
            onClick={toggleCollapse}
            className="w-6 h-6 flex items-center justify-center text-[rgba(59,88,100,0.55)] hover:text-slate-tile transition-colors"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {canCreateJob && (
          <Link
            href="/jobs/new"
            className="flex items-center justify-center gap-1.5 w-full py-2 font-mono text-[10px] tracking-[0.14em] uppercase font-medium border text-stone-blue hover:bg-stone-blue hover:text-white transition-colors"
            style={{ borderColor: "var(--nw-stone-blue)" }}
          >
            + New Job
          </Link>
        )}

        {/* Filter toggle -- only shown for PMs */}
        {role === "pm" && (
          <div
            className="flex gap-0.5 p-0.5 border"
            style={{ borderColor: "rgba(59,88,100,0.15)" }}
          >
            <button
              type="button"
              onClick={() => setFilter("mine")}
              className={`flex-1 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                filter === "mine"
                  ? "bg-[rgba(91,134,153,0.1)] text-slate-tile font-medium"
                  : "text-[rgba(59,88,100,0.55)] hover:text-slate-tile"
              }`}
            >
              My Jobs
            </button>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`flex-1 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                filter === "all"
                  ? "bg-[rgba(91,134,153,0.1)] text-slate-tile font-medium"
                  : "text-[rgba(59,88,100,0.55)] hover:text-slate-tile"
              }`}
            >
              All Jobs
            </button>
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-2 py-1.5 font-sans text-[13px] border bg-white text-slate-tile placeholder:text-[rgba(59,88,100,0.40)] focus:outline-none focus:border-stone-blue"
          style={{ borderColor: "rgba(59,88,100,0.15)" }}
        />
      </div>

      {/* Selected job details */}
      {selectedJob && (
        <div
          className="p-3 border-b bg-[rgba(91,134,153,0.1)]"
          style={{ borderColor: "rgba(59,88,100,0.15)" }}
        >
          <p className="text-[13px] font-sans font-medium text-slate-tile truncate">
            {selectedJob.name}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${statusDot(selectedJob.status)}`}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[rgba(59,88,100,0.70)]">
              {statusLabel(selectedJob.status)}
            </span>
          </div>
          {selectedJob.client_name && (
            <p className="text-[11px] font-sans text-[rgba(59,88,100,0.55)] mt-1.5 truncate">
              {selectedJob.client_name}
            </p>
          )}
          {selectedJob.address && (
            <p className="text-[11px] font-sans text-[rgba(59,88,100,0.55)] mt-0.5 truncate">
              {selectedJob.address}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {selectedJob.client_email && (
              <a
                href={`mailto:${selectedJob.client_email}`}
                className="font-mono text-[10px] tracking-[0.12em] uppercase text-stone-blue hover:underline"
                title="Email client"
              >
                Email
              </a>
            )}
            {selectedJob.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedJob.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] tracking-[0.12em] uppercase text-stone-blue hover:underline"
                title="View on map"
              >
                Map
              </a>
            )}
          </div>
        </div>
      )}

      {/* Job list */}
      <div className="flex-1 overflow-y-auto">
        <Link
          href="/jobs"
          className="block px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[rgba(59,88,100,0.55)] hover:text-slate-tile border-b transition-colors"
          style={{ borderColor: "rgba(59,88,100,0.08)" }}
        >
          All {filtered.length} Job{filtered.length !== 1 ? "s" : ""}
        </Link>
        {loading ? (
          <div className="p-4 text-center">
            <div className="w-5 h-5 border-2 border-stone-blue/30 border-t-stone-blue rounded-full animate-spin mx-auto" />
          </div>
        ) : otherJobs.length === 0 ? (
          <p className="p-3 text-[13px] font-sans text-[rgba(59,88,100,0.55)] text-center">
            {search ? "No matches" : "No other jobs"}
          </p>
        ) : (
          otherJobs.map((j) => {
            const active = j.id === currentJobId;
            return (
              <Link
                key={j.id}
                href={jobHref(j.id)}
                className={`flex items-center gap-2 px-3 py-2 font-sans text-[13px] text-slate-tile transition-colors border-b ${
                  active
                    ? "bg-[rgba(91,134,153,0.1)] border-l-2 border-l-stone-blue"
                    : "hover:bg-[rgba(91,134,153,0.06)]"
                }`}
                style={{ borderBottomColor: "rgba(59,88,100,0.08)" }}
                title={j.address ?? j.name}
              >
                <span
                  className={`shrink-0 inline-block w-1.5 h-1.5 rounded-full ${statusDot(j.status)}`}
                />
                <span className="truncate">{j.name}</span>
              </Link>
            );
          })
        )}
      </div>

      {/* Job count footer */}
      <div
        className="px-3 py-2 border-t"
        style={{ borderColor: "rgba(59,88,100,0.15)" }}
      >
        <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[rgba(59,88,100,0.55)]">
          {filtered.length} Job{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>
    </aside>
  );
}
