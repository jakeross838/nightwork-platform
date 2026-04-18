"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatCents } from "@/lib/utils/format";

interface JobFinancials {
  original_contract: number;
  approved_cos: number;
  revised_contract: number;
  billed_to_date: number;
  percent_complete: number;
  remaining: number;
}

const SPENT_STATUSES = [
  "pm_approved",
  "qa_review",
  "qa_approved",
  "pushed_to_qb",
  "in_draw",
  "paid",
];

/**
 * Persistent financial summary bar shown at the top of every job detail tab.
 *
 * Derives contract totals from the job row, billed-to-date from the sum of
 * approved invoices on the job, and % complete from billed / revised.
 *
 * Uses `sticky top-[56px]` so it stays visible under the main nav when
 * scrolling. Height is compact (roughly 60px) so it does not dominate the
 * tab content.
 */
export default function JobFinancialBar({
  jobId,
  preloaded,
}: {
  jobId: string;
  preloaded?: JobFinancials | null;
}) {
  const [data, setData] = useState<JobFinancials | null>(preloaded ?? null);

  useEffect(() => {
    if (preloaded) {
      setData(preloaded);
      return;
    }
    let cancelled = false;
    async function load() {
      const [{ data: job }, { data: invRows }] = await Promise.all([
        supabase
          .from("jobs")
          .select(
            "original_contract_amount, current_contract_amount, approved_cos_total, previous_certificates_total"
          )
          .eq("id", jobId)
          .is("deleted_at", null)
          .maybeSingle(),
        supabase
          .from("invoices")
          .select("total_amount")
          .eq("job_id", jobId)
          .in("status", SPENT_STATUSES)
          .is("deleted_at", null),
      ]);

      if (cancelled || !job) return;

      const original = (job as { original_contract_amount?: number }).original_contract_amount ?? 0;
      const approvedCos = (job as { approved_cos_total?: number }).approved_cos_total ?? 0;
      const revised =
        (job as { current_contract_amount?: number }).current_contract_amount ?? original + approvedCos;
      // Include pre-Nightwork certified baseline for mid-project imports.
      const baseline = (job as { previous_certificates_total?: number }).previous_certificates_total ?? 0;
      const nightworkBilled = (invRows ?? []).reduce(
        (s, r) => s + ((r as { total_amount: number }).total_amount ?? 0),
        0
      );
      const billed = baseline + nightworkBilled;
      const remaining = revised - billed;
      const pct = revised > 0 ? Math.min(100, Math.max(0, (billed / revised) * 100)) : 0;

      setData({
        original_contract: original,
        approved_cos: approvedCos,
        revised_contract: revised,
        billed_to_date: billed,
        percent_complete: pct,
        remaining,
      });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [jobId, preloaded]);

  return (
    <div
      className="sticky top-[56px] z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-2.5 bg-white border-b border-[rgba(59,88,100,0.15)] mb-4"
      aria-label="Job financial summary"
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 md:gap-4 text-[11px]">
        <Cell label="Original Contract" value={data ? formatCents(data.original_contract) : "—"} />
        <Cell
          label="Approved COs"
          value={data ? formatCents(data.approved_cos) : "—"}
          tone={data && data.approved_cos > 0 ? "positive" : data && data.approved_cos < 0 ? "negative" : undefined}
        />
        <Cell label="Revised Contract" value={data ? formatCents(data.revised_contract) : "—"} strong />
        <Cell label="Billed to Date" value={data ? formatCents(data.billed_to_date) : "—"} />
        <div className="flex flex-col gap-1">
          <p className="text-[10px] uppercase tracking-wider text-[rgba(59,88,100,0.55)] font-medium">% Complete</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[rgba(91,134,153,0.06)] overflow-hidden">
              <div
                className="h-full bg-slate-deep"
                style={{ width: `${data?.percent_complete ?? 0}%` }}
              />
            </div>
            <span className="text-[13px] text-slate-tile tabular-nums font-display shrink-0">
              {data ? `${data.percent_complete.toFixed(1)}%` : "—"}
            </span>
          </div>
        </div>
        <Cell
          label="Remaining"
          value={data ? formatCents(data.remaining) : "—"}
          tone={data && data.remaining < 0 ? "negative" : undefined}
        />
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  strong?: boolean;
}) {
  const toneClass =
    tone === "positive"
      ? "text-nw-success"
      : tone === "negative"
        ? "text-nw-danger"
        : "text-slate-tile";
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] uppercase tracking-wider text-[rgba(59,88,100,0.55)] font-medium">{label}</p>
      <p
        className={`text-[13px] tabular-nums font-display ${toneClass} ${
          strong ? "font-semibold" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
