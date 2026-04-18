"use client";

import { useEffect, useState } from "react";
import { formatCents, formatDate } from "@/lib/utils/format";

interface CompareLine {
  cost_code_id: string;
  code: string;
  description: string;
  is_change_order: boolean;
  scheduled_value: number;
  previous_period: number;
  current_period: number;
  delta: number;
  cumulative_pct: number;
  prior_cumulative_pct: number;
  new_line: boolean;
  went_backwards: boolean;
  large_swing: boolean;
  swing_pct: number;
}

interface CompareData {
  current: {
    id: string;
    draw_number: number;
    revision_number: number;
    period_start: string | null;
    period_end: string | null;
    totals: { current_payment_due: number; total_completed_to_date: number };
    invoice_count: number;
  };
  prior: {
    id: string;
    draw_number: number;
    revision_number: number;
    period_start: string | null;
    period_end: string | null;
    totals?: { current_payment_due: number; total_completed_to_date: number };
    invoice_count: number;
  } | null;
  lines: CompareLine[];
}

export default function DrawCompareView({ drawId }: { drawId: string }) {
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/draws/${drawId}/compare`);
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [drawId]);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="w-6 h-6 border-2 border-stone-blue/30 border-t-teal animate-spin mx-auto" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="border border-border-def p-6 text-center text-tertiary text-sm">
        No comparison data available.
      </div>
    );
  }

  if (!data.prior) {
    return (
      <div className="border border-border-def p-8 text-center">
        <p className="text-slate-tile font-display">First draw for this job</p>
        <p className="text-tertiary text-sm mt-1">
          No previous draw exists yet — comparison becomes available starting with Draw #2.
        </p>
      </div>
    );
  }

  const currentTotal = data.current.totals.current_payment_due;
  const priorTotal = data.prior.totals?.current_payment_due ?? 0;
  const totalDelta = currentTotal - priorTotal;
  const currentCompleted = data.current.totals.total_completed_to_date;
  const priorCompleted = data.prior.totals?.total_completed_to_date ?? 0;

  const baseLines = data.lines.filter((l) => !l.is_change_order);
  const coLines = data.lines.filter((l) => l.is_change_order);

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Summary header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard
          label={`Draw #${data.prior.draw_number} (previous)`}
          period={`${formatDate(data.prior.period_start)} → ${formatDate(data.prior.period_end)}`}
          amount={priorTotal}
          completed={priorCompleted}
          invoiceCount={data.prior.invoice_count}
        />
        <SummaryCard
          label={`Draw #${data.current.draw_number} (current)`}
          period={`${formatDate(data.current.period_start)} → ${formatDate(data.current.period_end)}`}
          amount={currentTotal}
          completed={currentCompleted}
          invoiceCount={data.current.invoice_count}
          highlight
        />
        <div className="bg-white border border-border-def p-4">
          <p className="text-[11px] font-medium text-tertiary uppercase tracking-wider">
            Delta
          </p>
          <p
            className={`text-2xl font-display font-medium mt-2 ${
              totalDelta > 0 ? "text-nw-success" : totalDelta < 0 ? "text-nw-danger" : "text-slate-tile"
            }`}
          >
            {totalDelta > 0 ? "+" : ""}
            {formatCents(totalDelta)}
          </p>
          <p className="text-xs text-tertiary mt-1">vs previous draw amount</p>
        </div>
      </div>

      {/* Per-line comparison */}
      <div className="overflow-x-auto border border-border-def">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-bg-sub text-left">
              <Th>Code</Th>
              <Th>Description</Th>
              <Th right>Scheduled</Th>
              <Th right>Prev Period</Th>
              <Th right>This Period</Th>
              <Th right>Δ</Th>
              <Th right>Cumulative %</Th>
              <Th>Flags</Th>
            </tr>
          </thead>
          <tbody>
            {baseLines.length > 0 && (
              <SectionRow label="Base Contract" />
            )}
            {baseLines.map((l) => (
              <CompareRow key={l.cost_code_id} line={l} />
            ))}
            {coLines.length > 0 && <SectionRow label="Change Orders" co />}
            {coLines.map((l) => (
              <CompareRow key={l.cost_code_id} line={l} co />
            ))}
            {data.lines.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-tertiary text-xs">
                  No line activity to compare.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionRow({ label, co }: { label: string; co?: boolean }) {
  return (
    <tr className={co ? "bg-nw-warn/10" : "bg-bg-sub/40"}>
      <td colSpan={8} className={`py-1.5 px-3 text-[10px] uppercase tracking-wider font-semibold ${
        co ? "text-nw-warn" : "text-tertiary"
      }`}>
        {label}
      </td>
    </tr>
  );
}

function CompareRow({ line, co }: { line: CompareLine; co?: boolean }) {
  const deltaCol =
    line.delta > 0 ? "text-nw-success" : line.delta < 0 ? "text-nw-danger" : "text-tertiary";
  const flagBadges: { text: string; cls: string }[] = [];
  if (line.new_line) flagBadges.push({ text: "NEW", cls: "border-stone-blue text-stone-blue" });
  if (line.large_swing)
    flagBadges.push({ text: `±${line.swing_pct.toFixed(0)}%`, cls: "border-nw-warn text-nw-warn" });
  if (line.went_backwards)
    flagBadges.push({ text: "REVERSED", cls: "border-nw-danger text-nw-danger" });

  return (
    <tr className={`border-t border-border-sub ${line.large_swing ? "bg-nw-warn/5" : ""}`}>
      <td className={`py-2 px-3 font-mono text-xs font-bold ${co ? "text-nw-warn" : "text-stone-blue"}`}>
        {line.code}
      </td>
      <td className="py-2 px-3 text-slate-tile">{line.description}</td>
      <td className="py-2 px-3 text-slate-tile text-right">
        {line.scheduled_value > 0 ? formatCents(line.scheduled_value) : "—"}
      </td>
      <td className="py-2 px-3 text-right text-slate-tile">
        {line.previous_period > 0 ? formatCents(line.previous_period) : <span className="text-tertiary">—</span>}
      </td>
      <td className="py-2 px-3 text-right text-slate-tile">
        {line.current_period > 0 ? formatCents(line.current_period) : <span className="text-tertiary">—</span>}
      </td>
      <td className={`py-2 px-3 text-right font-display ${deltaCol}`}>
        {line.delta > 0 ? "+" : ""}
        {formatCents(line.delta)}
      </td>
      <td className="py-2 px-3 text-right text-secondary text-xs">
        {line.prior_cumulative_pct.toFixed(1)}% → {line.cumulative_pct.toFixed(1)}%
      </td>
      <td className="py-2 px-3">
        <div className="flex flex-wrap gap-1">
          {flagBadges.map((b) => (
            <span
              key={b.text}
              className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border ${b.cls}`}
            >
              {b.text}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

function SummaryCard({
  label,
  period,
  amount,
  completed,
  invoiceCount,
  highlight,
}: {
  label: string;
  period: string;
  amount: number;
  completed: number;
  invoiceCount: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-white border ${highlight ? "border-stone-blue/40" : "border-border-def"} p-4`}
    >
      <p className="text-[11px] font-medium text-tertiary uppercase tracking-wider">{label}</p>
      <p className="text-xs text-secondary mt-1">{period}</p>
      <p className={`text-2xl font-display font-medium mt-2 ${highlight ? "text-nw-warn" : "text-slate-tile"}`}>
        {formatCents(amount)}
      </p>
      <p className="text-xs text-tertiary mt-1">
        {invoiceCount} invoice{invoiceCount === 1 ? "" : "s"} · {formatCents(completed)} completed
      </p>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`py-3 px-3 text-[10px] text-slate-tile font-bold uppercase tracking-wider ${
        right ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}
