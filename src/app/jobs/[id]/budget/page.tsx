"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NavBar from "@/components/nav-bar";
import JobTabs from "@/components/job-tabs";
import Breadcrumbs from "@/components/breadcrumbs";
import { supabase } from "@/lib/supabase/client";
import { formatCents } from "@/lib/utils/format";

interface Job {
  id: string;
  name: string;
  address: string | null;
  original_contract_amount: number;
  current_contract_amount: number;
}

interface BudgetRow {
  id: string;
  cost_code_id: string | null;
  code: string;
  description: string;
  sort_order: number;
  original_estimate: number;
  revised_estimate: number;
  is_allowance: boolean;
  approved_cos: number; // sum of CO allocations to this line
  committed: number;    // sum of POs (zero for now)
  spent: number;        // sum of approved/downstream invoices
}

// Matches which invoice statuses count toward Spent.
const SPENT_STATUSES = [
  "pm_approved",
  "qa_review",
  "qa_approved",
  "pushed_to_qb",
  "in_draw",
  "paid",
];

export default function JobBudgetPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/login?redirect=/jobs/${params.id}/budget`); return; }

      const [jobRes, blRes, coRes, ilRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, name, address, original_contract_amount, current_contract_amount")
          .eq("id", params.id)
          .is("deleted_at", null)
          .single(),
        supabase
          .from("budget_lines")
          .select("id, cost_code_id, original_estimate, revised_estimate, is_allowance, cost_codes:cost_code_id(code, description, sort_order)")
          .eq("job_id", params.id)
          .is("deleted_at", null),
        // Approved + executed CO allocations
        (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          supabase.from("change_order_budget_lines") as any
        )
          .select("budget_line_id, amount, change_orders!inner(job_id, status)")
          .eq("change_orders.job_id", params.id)
          .eq("change_orders.status", "executed")
          .is("deleted_at", null),
        // Approved invoice line items (spent)
        supabase
          .from("invoice_line_items")
          .select("amount_cents, budget_line_id, invoices!inner(job_id, status, deleted_at)")
          .eq("invoices.job_id", params.id)
          .in("invoices.status", SPENT_STATUSES)
          .is("deleted_at", null)
          .is("invoices.deleted_at", null),
      ]);

      if (jobRes.data) setJob(jobRes.data as Job);

      const blData = ((blRes.data ?? []) as unknown) as Array<{
        id: string;
        cost_code_id: string | null;
        original_estimate: number;
        revised_estimate: number;
        is_allowance: boolean;
        cost_codes: { code: string; description: string; sort_order: number | null } | null;
      }>;

      const coByLine = new Map<string, number>();
      const coData = ((coRes as { data?: Array<{ budget_line_id: string; amount: number }> })?.data) ?? [];
      for (const alloc of coData) {
        coByLine.set(alloc.budget_line_id, (coByLine.get(alloc.budget_line_id) ?? 0) + alloc.amount);
      }

      const spentByLine = new Map<string, number>();
      for (const li of ((ilRes.data ?? []) as Array<{ budget_line_id: string | null; amount_cents: number }>)) {
        if (!li.budget_line_id) continue;
        spentByLine.set(li.budget_line_id, (spentByLine.get(li.budget_line_id) ?? 0) + (li.amount_cents ?? 0));
      }

      const rowData: BudgetRow[] = blData.map((bl) => ({
        id: bl.id,
        cost_code_id: bl.cost_code_id,
        code: bl.cost_codes?.code ?? "—",
        description: bl.cost_codes?.description ?? "—",
        sort_order: bl.cost_codes?.sort_order ?? 0,
        original_estimate: bl.original_estimate,
        revised_estimate: bl.revised_estimate,
        is_allowance: bl.is_allowance,
        approved_cos: coByLine.get(bl.id) ?? 0,
        committed: 0,
        spent: spentByLine.get(bl.id) ?? 0,
      }));

      rowData.sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.code.localeCompare(b.code);
      });

      setRows(rowData);
      setLoading(false);
    }
    load();
  }, [params.id, router]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        original: acc.original + r.original_estimate,
        approved_cos: acc.approved_cos + r.approved_cos,
        revised: acc.revised + r.revised_estimate,
        committed: acc.committed + (r.committed ?? 0),
        spent: acc.spent + r.spent,
      }),
      { original: 0, approved_cos: 0, revised: 0, committed: 0, spent: 0 }
    );
  }, [rows]);

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
          <Link href="/jobs" className="text-teal hover:underline text-sm">Back to jobs</Link>
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
            { label: "Budget" },
          ]}
        />
        <div className="mb-4">
          <h2 className="font-display text-2xl text-cream">{job.name}</h2>
          <p className="text-sm text-cream-dim mt-1">{job.address ?? "No address"}</p>
        </div>
        <JobTabs jobId={job.id} active="budget" />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Stat label="Original" value={formatCents(totals.original)} />
          <Stat label="Approved COs" value={formatCents(totals.approved_cos)} />
          <Stat label="Revised" value={formatCents(totals.revised)} highlight />
          <Stat label="Spent" value={formatCents(totals.spent)} />
          <Stat
            label="Remaining"
            value={formatCents(totals.revised - totals.spent)}
            negative={totals.spent > totals.revised}
          />
        </div>

        {rows.length === 0 ? (
          <div className="bg-brand-card border border-brand-border p-12 text-center">
            <p className="text-cream-dim text-sm">No budget lines yet.</p>
            <p className="mt-1 text-[11px] text-cream-dim">
              Start a budget for this job from the overview tab.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
              <Link
                href={`/jobs/${job.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-teal text-teal hover:bg-teal hover:text-white text-sm font-medium transition-colors"
              >
                Import CSV / Excel
              </Link>
              <Link
                href={`/jobs/${job.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-border text-cream hover:bg-brand-surface text-sm font-medium transition-colors"
              >
                Create Manually
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-brand-card border border-brand-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-[11px] uppercase tracking-wider text-cream-dim bg-brand-surface/50">
                  <th className="text-left px-3 py-3 font-medium sticky left-0 bg-brand-surface/90 z-10">Code</th>
                  <th className="text-left px-3 py-3 font-medium">Description</th>
                  <th className="text-right px-3 py-3 font-medium">Original Budget</th>
                  <th className="text-right px-3 py-3 font-medium">CO +/-</th>
                  <th className="text-right px-3 py-3 font-medium">Revised Budget</th>
                  <th className="text-right px-3 py-3 font-medium">Committed</th>
                  <th className="text-right px-3 py-3 font-medium">Invoiced</th>
                  <th className="text-right px-3 py-3 font-medium">Remaining</th>
                  <th className="text-right px-3 py-3 font-medium">Variance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  // Phase 6 row colors. remaining = revised - invoiced.
                  // > 20% remaining → green (bg-status-success/5)
                  // 0-20% remaining → yellow (bg-status-warning/5)
                  // negative remaining (over budget) → red (bg-status-danger/5)
                  const remaining = r.revised_estimate - r.spent;
                  const pct = r.revised_estimate > 0 ? (r.spent / r.revised_estimate) * 100 : 0;
                  const over = remaining < 0;
                  const tight = !over && r.revised_estimate > 0 && remaining <= 0.2 * r.revised_estimate;
                  const rowBg = over
                    ? "bg-status-danger/10"
                    : tight
                      ? "bg-status-warning/10"
                      : r.revised_estimate > 0
                        ? "bg-status-success/5"
                        : "";
                  const stickyBg = over
                    ? "bg-[#FBE4E4]"
                    : tight
                      ? "bg-[#FCF3DC]"
                      : r.revised_estimate > 0
                        ? "bg-[#E9F4EB]"
                        : "bg-brand-card";
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-brand-row-border last:border-0 ${rowBg}`}
                    >
                      <td className={`px-3 py-2 font-mono text-cream text-xs sticky left-0 z-[1] ${stickyBg}`}>{r.code}</td>
                      <td className="px-3 py-2 text-cream-muted">
                        {r.description}
                        {r.is_allowance && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 text-[9px] uppercase tracking-wider border border-brass/50 text-brass">
                            Allowance
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-cream tabular-nums">{formatCents(r.original_estimate)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${r.approved_cos ? "text-teal" : "text-cream-dim"}`}>
                        {r.approved_cos ? formatCents(r.approved_cos) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-cream font-medium tabular-nums">{formatCents(r.revised_estimate)}</td>
                      <td className="px-3 py-2 text-right text-cream-dim tabular-nums">
                        {r.committed > 0 ? formatCents(r.committed) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-cream tabular-nums">{formatCents(r.spent)}</td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums font-medium ${
                          over
                            ? "text-status-danger"
                            : tight
                              ? "text-status-warning"
                              : "text-status-success"
                        }`}
                      >
                        {formatCents(remaining)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          over ? "text-status-danger font-medium" : tight ? "text-status-warning" : "text-status-success"
                        }`}
                        title={`${pct.toFixed(1)}% of revised budget invoiced`}
                      >
                        {over ? formatCents(remaining) : formatCents(remaining)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-brand-border bg-brand-surface font-medium">
                  <td colSpan={2} className="px-3 py-3 text-[11px] uppercase tracking-wider text-cream-dim font-medium sticky left-0 bg-brand-surface z-[1]">
                    Project Totals
                  </td>
                  <td className="px-3 py-3 text-right text-cream tabular-nums font-display">{formatCents(totals.original)}</td>
                  <td className="px-3 py-3 text-right text-teal tabular-nums font-display">
                    {totals.approved_cos ? formatCents(totals.approved_cos) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right text-cream tabular-nums font-display">{formatCents(totals.revised)}</td>
                  <td className="px-3 py-3 text-right text-cream-dim tabular-nums">
                    {totals.committed > 0 ? formatCents(totals.committed) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right text-cream tabular-nums font-display">{formatCents(totals.spent)}</td>
                  <td className="px-3 py-3 text-right text-cream tabular-nums font-display">
                    {formatCents(totals.revised - totals.spent)}
                  </td>
                  <td
                    className={`px-3 py-3 text-right tabular-nums font-display ${
                      totals.revised - totals.spent < 0 ? "text-status-danger" : "text-cream"
                    }`}
                  >
                    {totals.revised > 0
                      ? `${(((totals.revised - totals.spent) / totals.revised) * 100).toFixed(0)}% healthy`
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-[11px] text-cream-dim">
          Invoiced = sum of invoice line-item amounts allocated to each budget line (approved or downstream). Committed (POs) arrives in Phase 7.
          Rows turn yellow at 20% remaining and red when the invoiced total exceeds the revised budget.
        </p>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  negative,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={`border p-3 ${
        highlight
          ? "border-teal bg-teal-muted"
          : negative
            ? "border-status-danger/40 bg-status-danger/5"
            : "border-brand-border bg-brand-card"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wider text-cream-dim font-medium">{label}</p>
      <p
        className={`text-base mt-1 tabular-nums font-display ${
          negative ? "text-status-danger" : "text-cream"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
