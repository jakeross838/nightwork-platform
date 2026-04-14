"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/nav-bar";
import { formatCents, formatDate, formatStatus } from "@/lib/utils/format";

interface Draw {
  id: string;
  draw_number: number;
  revision_number: number;
  application_date: string | null;
  period_start: string | null;
  period_end: string | null;
  status: string;
  current_payment_due: number;
  jobs: { id: string; name: string; address: string | null } | null;
}

export default function DrawsPage() {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDraws() {
      const res = await fetch("/api/draws");
      if (res.ok) {
        const data = await res.json();
        setDraws(data);
      }
      setLoading(false);
    }
    fetchDraws();
  }, []);

  // Group by job
  const grouped = draws.reduce<Record<string, { job: Draw["jobs"]; draws: Draw[] }>>((acc, d) => {
    const key = d.jobs?.id ?? "unknown";
    if (!acc[key]) acc[key] = { job: d.jobs, draws: [] };
    acc[key].draws.push(d);
    return acc;
  }, {});

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl text-cream">Draws</h2>
            <p className="text-sm text-cream-dim mt-1">AIA G702/G703 pay applications</p>
          </div>
          <Link href="/draws/new"
            className="px-4 py-2 bg-teal hover:bg-teal-hover text-brand-bg text-sm font-medium rounded-lg transition-colors">
            Create New Draw
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-teal/30 border-t-teal animate-spin mx-auto" />
          </div>
        ) : draws.length === 0 ? (
          <div className="text-center py-20 animate-fade-up">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-surface border border-brand-border mb-6">
              <svg className="w-7 h-7 text-cream-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-cream text-lg font-display">No draws yet</p>
            <p className="text-cream-dim text-sm mt-1">Create your first draw to generate an AIA pay application</p>
          </div>
        ) : (
          <div className="space-y-8 animate-fade-up">
            {Object.entries(grouped).map(([, { job, draws: jobDraws }]) => (
              <div key={job?.id ?? "unknown"}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-brass-muted text-brass text-sm font-medium">
                    {job?.name ?? "Unknown Job"}
                  </span>
                  <span className="text-xs text-cream-dim">{job?.address}</span>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-brand-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-brand-surface text-left">
                        <th className="py-3 px-5 text-[11px] text-cream font-semibold uppercase tracking-wider">Draw #</th>
                        <th className="py-3 px-5 text-[11px] text-cream font-semibold uppercase tracking-wider">Period</th>
                        <th className="py-3 px-5 text-[11px] text-cream font-semibold uppercase tracking-wider">Application Date</th>
                        <th className="py-3 px-5 text-[11px] text-cream font-semibold uppercase tracking-wider">Status</th>
                        <th className="py-3 px-5 text-[11px] text-cream font-semibold uppercase tracking-wider text-right">Current Payment Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobDraws.map((d) => (
                        <tr key={d.id}
                          className="border-t border-brand-row-border hover:bg-brand-elevated/50 cursor-pointer transition-colors"
                          onClick={() => window.location.href = `/draws/${d.id}`}>
                          <td className="py-4 px-5 text-cream font-display font-medium">
                            #{d.draw_number}
                            {d.revision_number > 0 && <span className="text-brass ml-1 text-xs">Rev {d.revision_number}</span>}
                          </td>
                          <td className="py-4 px-5 text-cream-muted">{formatDate(d.period_start)} — {formatDate(d.period_end)}</td>
                          <td className="py-4 px-5 text-cream-muted">{formatDate(d.application_date)}</td>
                          <td className="py-4 px-5">
                            <span className="text-xs text-cream bg-brand-surface px-3 py-1.5 rounded-full border border-brand-border-light font-medium">
                              {formatStatus(d.status)}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-cream text-right font-display font-medium">{formatCents(d.current_payment_due)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
