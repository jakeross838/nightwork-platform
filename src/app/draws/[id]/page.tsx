"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import NavBar from "@/components/nav-bar";
import { formatCents, formatStatus } from "@/lib/utils/format";

interface DrawData {
  id: string; draw_number: number; application_date: string; period_start: string; period_end: string;
  status: string; revision_number: number;
  original_contract_sum: number; net_change_orders: number; contract_sum_to_date: number;
  total_completed_to_date: number; less_previous_payments: number; current_payment_due: number;
  balance_to_finish: number; deposit_amount: number;
  status_history: Array<Record<string, unknown>>;
  jobs: { id: string; name: string; address: string | null; client_name: string | null; deposit_percentage: number; gc_fee_percentage: number } | null;
  line_items: Array<{
    id: string; previous_applications: number; this_period: number; total_to_date: number;
    percent_complete: number; balance_to_finish: number;
    budget_lines: {
      id: string; original_estimate: number; revised_estimate: number;
      cost_codes: { code: string; description: string; category: string; sort_order: number };
    };
  }>;
  all_budget_lines: Array<{
    id: string; original_estimate: number; revised_estimate: number;
    cost_codes: { code: string; description: string; category: string; sort_order: number };
  }>;
  invoices: Array<{ id: string; vendor_name_raw: string | null; invoice_number: string | null; total_amount: number; cost_code_id: string | null }>;
}

const ACTION_MAP: Record<string, { label: string; next: string }> = {
  draft: { label: "Submit for Review", next: "submit" },
  pm_review: { label: "Approve", next: "approve" },
  approved: { label: "Mark Submitted", next: "mark_submitted" },
  submitted: { label: "Mark Paid", next: "mark_paid" },
};

export default function DrawDetailPage() {
  const params = useParams();
  const router = useRouter();
  const drawId = params.id as string;
  const [draw, setDraw] = useState<DrawData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    async function fetchDraw() {
      const res = await fetch(`/api/draws/${drawId}`);
      if (res.ok) setDraw(await res.json());
      setLoading(false);
    }
    fetchDraw();
  }, [drawId]);

  const handleAction = async (action: string) => {
    setActing(true);
    const res = await fetch(`/api/draws/${drawId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      // Refetch to update status
      const res2 = await fetch(`/api/draws/${drawId}`);
      if (res2.ok) setDraw(await res2.json());
    }
    setActing(false);
  };

  if (loading) return (
    <div className="min-h-screen"><NavBar /><div className="flex items-center justify-center py-32"><div className="w-8 h-8 rounded-full border-2 border-teal/30 border-t-teal animate-spin" /></div></div>
  );
  if (!draw) return (
    <div className="min-h-screen"><NavBar /><div className="flex items-center justify-center py-32"><p className="text-status-danger font-display text-lg">Draw not found</p></div></div>
  );

  const action = ACTION_MAP[draw.status];

  // Build G703 rows: merge line_items with all_budget_lines
  const lineItemMap = new Map(draw.line_items.map(li => [li.budget_lines.id, li]));
  const g703Rows = draw.all_budget_lines
    .map((bl) => {
      const li = lineItemMap.get(bl.id);
      return {
        code: bl.cost_codes.code,
        description: bl.cost_codes.description,
        sort_order: bl.cost_codes.sort_order,
        original_estimate: bl.original_estimate,
        revised_estimate: bl.revised_estimate,
        previous_applications: li?.previous_applications ?? 0,
        this_period: li?.this_period ?? 0,
        total_to_date: li?.total_to_date ?? 0,
        percent_complete: li?.percent_complete ?? 0,
        balance_to_finish: li ? li.balance_to_finish : bl.revised_estimate,
        hasActivity: !!li,
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order);

  // Only show rows with activity or nonzero estimate
  const visibleRows = g703Rows.filter(r => r.hasActivity || r.original_estimate > 0);

  // Grand totals
  const totals = visibleRows.reduce(
    (acc, r) => ({
      original: acc.original + r.original_estimate,
      previous: acc.previous + r.previous_applications,
      thisPeriod: acc.thisPeriod + r.this_period,
      totalToDate: acc.totalToDate + r.total_to_date,
      balance: acc.balance + r.balance_to_finish,
    }),
    { original: 0, previous: 0, thisPeriod: 0, totalToDate: 0, balance: 0 }
  );

  return (
    <div className="min-h-screen">
      <NavBar />

      {/* Sub-header */}
      <div className="border-b border-brand-border bg-brand-surface/50 px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/draws")} className="text-cream-dim hover:text-cream transition-colors text-sm">&larr; Draws</button>
            <h1 className="font-display text-xl text-cream">
              {draw.jobs?.name} <span className="text-cream-dim">&mdash;</span> Draw #{draw.draw_number}
            </h1>
            <span className="text-xs text-cream-dim bg-brand-card px-2.5 py-1 rounded-full border border-brand-border">
              {formatStatus(draw.status)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button disabled className="px-4 py-2 border border-brand-border text-cream-dim text-sm rounded-lg opacity-50 cursor-not-allowed">
              Export to Excel
            </button>
            {action && (
              <button onClick={() => handleAction(action.next)} disabled={acting}
                className="px-4 py-2 bg-teal hover:bg-teal-hover disabled:opacity-50 text-brand-bg text-sm font-medium rounded-lg transition-colors">
                {acting ? "Processing..." : action.label}
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 opacity-0 animate-fade-up">

          {/* G702 Summary */}
          <div className="xl:col-span-1">
            <div className="sticky top-24 space-y-5">
              <div className="bg-brand-card border border-brand-border rounded-2xl p-5">
                <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-4 brass-underline">G702 — Application for Payment</p>
                <div className="mt-5 space-y-2.5">
                  <G702Row num="1" label="Original Contract Sum" value={draw.original_contract_sum} />
                  <G702Row num="" label="Deposit" value={draw.deposit_amount} sub />
                  <G702Row num="2" label="Net Change Orders" value={draw.net_change_orders} />
                  <G702Row num="3" label="Contract Sum to Date" value={draw.contract_sum_to_date} bold />
                  <div className="border-t border-brand-border my-1" />
                  <G702Row num="4" label="Total Completed to Date" value={draw.total_completed_to_date} />
                  <G702Row num="5" label="Less Previous Payments" value={draw.less_previous_payments} />
                  <G702Row num="6" label="Current Payment Due" value={draw.current_payment_due} bold highlight />
                  <div className="border-t border-brand-border my-1" />
                  <G702Row num="7" label="Balance to Finish" value={draw.balance_to_finish} />
                </div>
              </div>

              <div className="bg-brand-card border border-brand-border rounded-2xl p-5">
                <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-4 brass-underline">Details</p>
                <div className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-cream-dim">Application #</span><span className="text-cream">{draw.draw_number}</span></div>
                  <div className="flex justify-between"><span className="text-cream-dim">Period</span><span className="text-cream">{draw.period_start} — {draw.period_end}</span></div>
                  <div className="flex justify-between"><span className="text-cream-dim">App Date</span><span className="text-cream">{draw.application_date}</span></div>
                  <div className="flex justify-between"><span className="text-cream-dim">Owner</span><span className="text-cream">{draw.jobs?.client_name ?? "—"}</span></div>
                  <div className="flex justify-between"><span className="text-cream-dim">Invoices</span><span className="text-cream">{draw.invoices?.length ?? 0}</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* G703 Table */}
          <div className="xl:col-span-3">
            <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-3 brass-underline">G703 — Continuation Sheet</p>
            <div className="mt-5 overflow-x-auto rounded-2xl border border-brand-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-brand-surface text-left">
                    <th className="py-3 px-4 text-[11px] text-cream-dim font-medium uppercase tracking-wider">A — Item</th>
                    <th className="py-3 px-4 text-[11px] text-cream-dim font-medium uppercase tracking-wider">B — Description</th>
                    <th className="py-3 px-4 text-[11px] text-cream-dim font-medium uppercase tracking-wider text-right">C — Original Est.</th>
                    <th className="py-3 px-4 text-[11px] text-cream-dim font-medium uppercase tracking-wider text-right">D — Previous</th>
                    <th className="py-3 px-4 text-[11px] text-cream-dim font-medium uppercase tracking-wider text-right">E — This Period</th>
                    <th className="py-3 px-4 text-[11px] text-cream-dim font-medium uppercase tracking-wider text-right">F — Total to Date</th>
                    <th className="py-3 px-4 text-[11px] text-cream-dim font-medium uppercase tracking-wider text-right">G — %</th>
                    <th className="py-3 px-4 text-[11px] text-cream-dim font-medium uppercase tracking-wider text-right">H — Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.code} className={`border-t border-brand-border/50 ${row.this_period > 0 ? "bg-teal/5" : ""}`}>
                      <td className="py-2.5 px-4 text-cream font-mono text-xs">{row.code}</td>
                      <td className="py-2.5 px-4 text-cream-muted">{row.description}</td>
                      <td className="py-2.5 px-4 text-cream-muted text-right">{formatCents(row.original_estimate)}</td>
                      <td className="py-2.5 px-4 text-cream-dim text-right">{row.previous_applications > 0 ? formatCents(row.previous_applications) : "—"}</td>
                      <td className="py-2.5 px-4 text-right font-medium">{row.this_period > 0 ? <span className="text-teal">{formatCents(row.this_period)}</span> : <span className="text-cream-dim">—</span>}</td>
                      <td className="py-2.5 px-4 text-cream text-right">{row.total_to_date > 0 ? formatCents(row.total_to_date) : "—"}</td>
                      <td className="py-2.5 px-4 text-cream-dim text-right">{row.percent_complete > 0 ? `${row.percent_complete.toFixed(1)}%` : "—"}</td>
                      <td className="py-2.5 px-4 text-cream-muted text-right">{formatCents(row.balance_to_finish)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-brand-border bg-brand-surface">
                    <td colSpan={2} className="py-3 px-4 text-cream font-medium">Grand Total</td>
                    <td className="py-3 px-4 text-cream text-right font-display font-medium">{formatCents(totals.original)}</td>
                    <td className="py-3 px-4 text-cream-dim text-right">{totals.previous > 0 ? formatCents(totals.previous) : "—"}</td>
                    <td className="py-3 px-4 text-teal text-right font-display font-medium">{formatCents(totals.thisPeriod)}</td>
                    <td className="py-3 px-4 text-cream text-right font-display font-medium">{formatCents(totals.totalToDate)}</td>
                    <td className="py-3 px-4 text-cream-dim text-right">
                      {totals.original > 0 ? `${((totals.totalToDate / totals.original) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-3 px-4 text-cream text-right font-display font-medium">{formatCents(totals.balance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function G702Row({ num, label, value, bold, highlight, sub }: {
  num: string; label: string; value: number; bold?: boolean; highlight?: boolean; sub?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${sub ? "pl-4 opacity-70" : ""}`}>
      <div className="flex items-center gap-2">
        {num && <span className="text-cream-dim text-[11px] font-mono w-4">{num}</span>}
        {!num && <span className="w-4" />}
        <span className={`text-xs ${bold ? "text-cream font-medium" : "text-cream-muted"}`}>{label}</span>
      </div>
      <span className={`font-display text-sm ${highlight ? "text-brass font-medium" : bold ? "text-cream font-medium" : "text-cream-muted"}`}>
        {formatCents(value)}
      </span>
    </div>
  );
}
