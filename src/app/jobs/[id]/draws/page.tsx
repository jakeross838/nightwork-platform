"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JobTabs from "@/components/job-tabs";
import JobFinancialBar from "@/components/job-financial-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate, formatStatus } from "@/lib/utils/format";
import EmptyState, { EmptyIcons } from "@/components/empty-state";
import DrawsSubTabs from "@/components/draws-sub-tabs";

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

function drawBadge(status: string): string {
  if (status === "submitted") return "text-slate-tile border-cream";
  if (status === "paid") return "text-nw-success border-nw-success";
  if (status === "approved") return "text-nw-success border-nw-success";
  if (status === "pm_review" || status === "draft") return "text-nw-warn border-nw-warn";
  if (status === "void") return "text-nw-danger border-nw-danger";
  return "text-[rgba(59,88,100,0.55)] border-cream-dim";
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
        <div className="w-8 h-8 border-2 border-stone-blue/30 border-t-teal animate-spin mx-auto" />
      </main>
    );
  }
  if (!job) {
    return (
      <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
        <p className="text-slate-tile">Job not found</p>
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
            <h2 className="font-display text-2xl text-slate-tile">{job.name}</h2>
            <p className="text-sm text-[rgba(59,88,100,0.55)] mt-1">{job.address ?? "No address"}</p>
          </div>
          <Link
            href={`/draws/new?jobId=${job.id}`}
            className="px-4 py-2 bg-slate-deep hover:bg-slate-deeper text-white text-sm font-medium transition-colors"
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
          <div className="bg-white border border-[rgba(59,88,100,0.15)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(59,88,100,0.15)] text-[11px] uppercase tracking-wider text-[rgba(59,88,100,0.55)] bg-[rgba(91,134,153,0.06)]/50">
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
                    className="border-b border-[rgba(59,88,100,0.08)] last:border-0 hover:bg-[rgba(91,134,153,0.06)]/40 cursor-pointer"
                    onClick={() => router.push(`/draws/${d.id}`)}
                  >
                    <td className="px-4 py-3 text-slate-tile font-display font-medium">
                      #{d.draw_number}
                      {d.revision_number > 0 && (
                        <span className="text-nw-warn ml-1 text-xs">Rev {d.revision_number}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[rgba(59,88,100,0.70)]">
                      {formatDate(d.period_start)} — {formatDate(d.period_end)}
                    </td>
                    <td className="px-4 py-3 text-[rgba(59,88,100,0.70)]">{formatDate(d.application_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-[11px] uppercase tracking-wider border ${drawBadge(d.status)}`}>
                        {formatStatus(d.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-tile tabular-nums">
                      {formatCents(d.current_payment_due)}
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
