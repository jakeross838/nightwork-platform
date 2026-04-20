"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwMoney from "@/components/nw/Money";

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
      className="sticky top-[56px] z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-2.5 mb-4 border-b"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
      }}
      aria-label="Job financial summary"
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
        <Cell label="Original Contract" cents={data?.original_contract ?? null} />
        <Cell
          label="Approved COs"
          cents={data?.approved_cos ?? null}
          signColor
        />
        <Cell label="Revised Contract" cents={data?.revised_contract ?? null} emphasized />
        <Cell label="Billed to Date" cents={data?.billed_to_date ?? null} />
        <div className="flex flex-col gap-1.5">
          <NwEyebrow tone="muted">% Complete</NwEyebrow>
          <div className="flex items-center gap-2">
            <div
              className="flex-1 h-1.5 overflow-hidden"
              style={{ background: "var(--bg-subtle)" }}
            >
              <div
                className="h-full"
                style={{
                  width: `${data?.percent_complete ?? 0}%`,
                  background: "var(--nw-stone-blue)",
                }}
              />
            </div>
            <span
              className="text-[13px] tabular-nums shrink-0"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                color: "var(--text-primary)",
              }}
            >
              {data ? `${data.percent_complete.toFixed(1)}%` : "—"}
            </span>
          </div>
        </div>
        <Cell
          label="Remaining"
          cents={data?.remaining ?? null}
          signColor
        />
      </div>
    </div>
  );
}

function Cell({
  label,
  cents,
  emphasized,
  signColor,
}: {
  label: string;
  cents: number | null;
  emphasized?: boolean;
  signColor?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <NwEyebrow tone="muted">{label}</NwEyebrow>
      <NwMoney
        cents={cents}
        size="md"
        variant={emphasized ? "emphasized" : "default"}
        signColor={signColor}
      />
    </div>
  );
}
