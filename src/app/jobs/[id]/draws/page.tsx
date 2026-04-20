"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JobTabs from "@/components/job-tabs";
import JobFinancialBar from "@/components/job-financial-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import { supabase } from "@/lib/supabase/client";
import { formatDate, formatStatus } from "@/lib/utils/format";
import EmptyState, { EmptyIcons } from "@/components/empty-state";
import DrawsSubTabs from "@/components/draws-sub-tabs";
import NwBadge, { type BadgeVariant } from "@/components/nw/Badge";
import NwMoney from "@/components/nw/Money";

interface Job { id: string; name: string; address: string | null; }

interface Draw {
  id: string;
  draw_number: number;
  revision_number: number;
  application_date: string | null;
  period_start: string | null;
  period_end: string | null;
  status: string;
  current_payment_due: number;
}

function drawBadgeVariant(status: string): BadgeVariant {
  if (status === "submitted" || status === "pm_review") return "warning";
  if (status === "paid" || status === "approved") return "success";
  if (status === "void") return "danger";
  if (status === "draft") return "neutral";
  return "neutral";
}

export default function JobDrawsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/login?redirect=/jobs/${params.id}/draws`); return; }

      const { data: j } = await supabase
        .from("jobs").select("id, name, address")
        .eq("id", params.id).is("deleted_at", null).single();
      if (j) setJob(j as Job);

      const { data: d } = await supabase
        .from("draws")
        .select("id, draw_number, revision_number, application_date, period_start, period_end, status, current_payment_due")
        .eq("job_id", params.id)
        .is("deleted_at", null)
        .order("draw_number", { ascending: false });
      if (d) setDraws(d as Draw[]);
      setLoading(false);
    }
    load();
  }, [params.id, router]);

  if (loading) {
    return (
      <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
        <div className="w-8 h-8 border-2 border-[rgba(91,134,153,0.3)] border-t-[var(--nw-stone-blue)] animate-spin mx-auto" />
      </main>
    );
  }
  if (!job) {
    return (
      <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
        <p className="text-[color:var(--text-primary)]">Job not found</p>
      </main>
    );
  }

  return (
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Jobs", href: "/jobs" },
            { label: job.name, href: `/jobs/${job.id}` },
            { label: "Draws" },
          ]}
        />
        <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
          <div>
            <span
              className="block mb-2 text-[10px] uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Job · Draws
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
              {job.name}
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {job.address ?? "No address"}
            </p>
          </div>
          <Link
            href={`/draws/new?jobId=${job.id}`}
            className="inline-flex items-center justify-center h-9 px-4 text-[11px] uppercase font-medium border transition-colors"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.12em",
              background: "var(--nw-stone-blue)",
              borderColor: "var(--nw-stone-blue)",
              color: "var(--nw-white-sand)",
            }}
          >
            + New Draw
          </Link>
        </div>
        <JobTabs jobId={job.id} active="draws" />
        <JobFinancialBar jobId={job.id} />
        <DrawsSubTabs jobId={job.id} active="draws" />

        {draws.length === 0 ? (
          <EmptyState
            icon={<EmptyIcons.Document />}
            title="No draws created for this job yet"
            message="Create a draw to compile approved invoices into an AIA G702/G703 pay application."
            primaryAction={{ label: "+ Create Draw", href: `/draws/new?jobId=${job.id}` }}
          />
        ) : (
          <div className="bg-[var(--bg-card)] border border-[var(--border-default)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-secondary)] font-medium bg-[rgba(91,134,153,0.04)]">
                  <th className="text-left px-4 py-3 font-medium">Draw #</th>
                  <th className="text-left px-4 py-3 font-medium">Period</th>
                  <th className="text-left px-4 py-3 font-medium">Application Date</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Current Payment Due</th>
                </tr>
              </thead>
              <tbody>
                {draws.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-[var(--border-default)] last:border-0 hover:bg-[rgba(91,134,153,0.06)] cursor-pointer"
                    onClick={() => router.push(`/draws/${d.id}`)}
                  >
                    <td className="px-4 py-3 text-[color:var(--text-primary)] font-display font-medium">
                      #{d.draw_number}
                      {d.revision_number > 0 && (
                        <span className="text-brass ml-1 text-xs">Rev {d.revision_number}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--text-muted)]">
                      {formatDate(d.period_start)} — {formatDate(d.period_end)}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--text-muted)]">{formatDate(d.application_date)}</td>
                    <td className="px-4 py-3">
                      <NwBadge variant={drawBadgeVariant(d.status)} size="sm">
                        {formatStatus(d.status)}
                      </NwBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <NwMoney cents={d.current_payment_due} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
  );
}
