"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NavBar from "@/components/nav-bar";
import JobTabs from "@/components/job-tabs";
import JobFinancialBar from "@/components/job-financial-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate, formatStatus } from "@/lib/utils/format";

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
  if (status === "submitted") return "text-cream border-cream";
  if (status === "paid") return "text-status-success border-status-success";
  if (status === "approved") return "text-status-success border-status-success";
  if (status === "pm_review" || status === "draft") return "text-brass border-brass";
  if (status === "void") return "text-status-danger border-status-danger";
  return "text-cream-dim border-cream-dim";
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
      <div className="min-h-screen">
        <NavBar />
        <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
          <div className="w-8 h-8 border-2 border-teal/30 border-t-teal animate-spin mx-auto" />
        </main>
      </div>
    );
  }
  if (!job) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
          <p className="text-cream">Job not found</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <NavBar />
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
            <h2 className="font-display text-2xl text-cream">{job.name}</h2>
            <p className="text-sm text-cream-dim mt-1">{job.address ?? "No address"}</p>
          </div>
          <Link
            href={`/draws/new?jobId=${job.id}`}
            className="px-4 py-2 bg-teal hover:bg-teal-hover text-white text-sm font-medium transition-colors"
          >
            + New Draw
          </Link>
        </div>
        <JobTabs jobId={job.id} active="draws" />
        <JobFinancialBar jobId={job.id} />

        {draws.length === 0 ? (
          <div className="bg-brand-card border border-brand-border p-12 text-center">
            <p className="text-cream-dim text-sm">No draws yet for this job.</p>
          </div>
        ) : (
          <div className="bg-brand-card border border-brand-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-[11px] uppercase tracking-wider text-cream-dim bg-brand-surface/50">
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
                    className="border-b border-brand-row-border last:border-0 hover:bg-brand-surface/40 cursor-pointer"
                    onClick={() => router.push(`/draws/${d.id}`)}
                  >
                    <td className="px-4 py-3 text-cream font-display font-medium">
                      #{d.draw_number}
                      {d.revision_number > 0 && (
                        <span className="text-brass ml-1 text-xs">Rev {d.revision_number}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-cream-muted">
                      {formatDate(d.period_start)} — {formatDate(d.period_end)}
                    </td>
                    <td className="px-4 py-3 text-cream-muted">{formatDate(d.application_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-[11px] uppercase tracking-wider border ${drawBadge(d.status)}`}>
                        {formatStatus(d.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-cream tabular-nums">
                      {formatCents(d.current_payment_due)}
                    </td>
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
