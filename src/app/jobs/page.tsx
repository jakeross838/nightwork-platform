"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate } from "@/lib/utils/format";
import NavBar from "@/components/nav-bar";

type JobStatus = "active" | "complete" | "warranty" | "cancelled";

interface Job {
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
  pm_name?: string | null;
}

type StatusFilter = "all" | JobStatus;

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

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [role, setRole] = useState<"admin" | "pm" | "accounting" | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?redirect=/jobs");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const userRole = (profile?.role as "admin" | "pm" | "accounting" | null) ?? null;
      setRole(userRole);

      if (userRole !== "admin") {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      setAuthorized(true);

      const [jobsResult, usersResult] = await Promise.all([
        supabase
          .from("jobs")
          .select(
            "id, name, address, client_name, contract_type, original_contract_amount, current_contract_amount, contract_date, status, pm_id"
          )
          .is("deleted_at", null)
          .order("name"),
        supabase
          .from("users")
          .select("id, full_name")
          .is("deleted_at", null),
      ]);

      if (!jobsResult.error && jobsResult.data) {
        const pmMap = new Map<string, string>(
          (usersResult.data ?? []).map((u) => [u.id as string, u.full_name as string])
        );
        const enriched = jobsResult.data.map((j) => ({
          ...j,
          pm_name: j.pm_id ? pmMap.get(j.pm_id as string) ?? null : null,
        })) as Job[];
        setJobs(enriched);
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
    return result;
  }, [jobs, statusFilter, search]);

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
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-teal/30 border-t-teal animate-spin mx-auto" />
            <p className="mt-4 text-cream-dim text-sm">Loading jobs...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-brand-border">
            <p className="text-cream text-lg font-display">No jobs</p>
            <p className="text-cream-dim text-sm mt-1">
              {search || statusFilter !== "all" ? "Try adjusting filters." : "Create your first job to get started."}
            </p>
          </div>
        ) : (
          <div className="border border-brand-border bg-brand-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-[11px] uppercase tracking-wider text-cream-dim">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Address</th>
                  <th className="text-left px-4 py-3 font-medium">Client</th>
                  <th className="text-left px-4 py-3 font-medium">PM</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-right px-4 py-3 font-medium">Original Contract</th>
                  <th className="text-left px-4 py-3 font-medium">Contract Date</th>
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
                    <td className="px-4 py-3 text-cream font-medium">{j.name}</td>
                    <td className="px-4 py-3 text-cream-muted">{j.address ?? "—"}</td>
                    <td className="px-4 py-3 text-cream-muted">{j.client_name ?? "—"}</td>
                    <td className="px-4 py-3 text-cream-muted">{j.pm_name ?? "—"}</td>
                    <td className="px-4 py-3 text-cream-muted uppercase text-[11px] tracking-wider">
                      {j.contract_type === "cost_plus" ? "Cost Plus" : "Fixed"}
                    </td>
                    <td className="px-4 py-3 text-right text-cream font-medium tabular-nums">
                      {formatCents(j.original_contract_amount)}
                    </td>
                    <td className="px-4 py-3 text-cream-muted">{formatDate(j.contract_date)}</td>
                    <td className="px-4 py-3"><StatusBadge status={j.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
