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
  approved_cos_total: number | null;
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
  approved_cos: number;
  committed: number;           // sum of open POs
  invoiced_with_po: number;    // invoices linked to a PO
  invoiced_without_po: number; // direct spend (no PO)
}

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
  const [totalCommittedAll, setTotalCommittedAll] = useState(0);
  const [totalInvoicedAll, setTotalInvoicedAll] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/login?redirect=/jobs/${params.id}/budget`); return; }

      const [jobRes, blRes, coRes, ilRes, poRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, name, address, original_contract_amount, current_contract_amount, approved_cos_total")
          .eq("id", params.id)
          .is("deleted_at", null)
          .single(),
        supabase
          .from("budget_lines")
          .select("id, cost_code_id, original_estimate, revised_estimate, committed, co_adjustments, is_allowance, cost_codes:cost_code_id(code, description, sort_order)")
          .eq("job_id", params.id)
          .is("deleted_at", null),
        // Approved CO allocations.
        supabase
          .from("change_order_lines")
          .select("budget_line_id, amount, change_orders!inner(job_id, status)")
          .eq("change_orders.job_id", params.id)
          .in("change_orders.status", ["approved", "executed"])
          .is("deleted_at", null),
        // All approved invoice lines on this job — split by PO-linked vs direct.
        supabase
          .from("invoice_line_items")
          .select("amount_cents, budget_line_id, po_id, invoices!inner(job_id, status, deleted_at)")
          .eq("invoices.job_id", params.id)
          .in("invoices.status", SPENT_STATUSES)
          .is("deleted_at", null)
          .is("invoices.deleted_at", null),
        // All POs on this job for summary count.
        supabase
          .from("purchase_orders")
          .select("amount, invoiced_total, status")
          .eq("job_id", params.id)
          .is("deleted_at", null),
      ]);

      if (jobRes.data) setJob(jobRes.data as Job);

      const blData = ((blRes.data ?? []) as unknown) as Array<{
        id: string;
        cost_code_id: string | null;
        original_estimate: number;
        revised_estimate: number;
        committed: number;
        co_adjustments: number;
        is_allowance: boolean;
        cost_codes: { code: string; description: string; sort_order: number | null } | null;
      }>;

      const coByLine = new Map<string, number>();
      const coData = ((coRes as { data?: Array<{ budget_line_id: string | null; amount: number }> })?.data) ?? [];
      for (const alloc of coData) {
        if (!alloc.budget_line_id) continue;
        coByLine.set(alloc.budget_line_id, (coByLine.get(alloc.budget_line_id) ?? 0) + alloc.amount);
      }

      const invWithPoByLine = new Map<string, number>();
      const invWithoutPoByLine = new Map<string, number>();
      for (const li of ((ilRes.data ?? []) as Array<{ budget_line_id: string | null; po_id: string | null; amount_cents: number }>)) {
        if (!li.budget_line_id) continue;
        const target = li.po_id ? invWithPoByLine : invWithoutPoByLine;
        target.set(li.budget_line_id, (target.get(li.budget_line_id) ?? 0) + (li.amount_cents ?? 0));
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
        approved_cos: coByLine.get(bl.id) ?? bl.co_adjustments ?? 0,
        committed: bl.committed ?? 0,
        invoiced_with_po: invWithPoByLine.get(bl.id) ?? 0,
        invoiced_without_po: invWithoutPoByLine.get(bl.id) ?? 0,
      }));

      rowData.sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.code.localeCompare(b.code);
      });

      setRows(rowData);

      // Summary-card totals (all POs & all approved invoices, not just those on budget lines).
      const pos = poRes.data ?? [];
      const committedAll = pos
        .filter((p: { status: string }) => ["issued", "partially_invoiced", "fully_invoiced"].includes(p.status))
        .reduce((s: number, p: { amount: number }) => s + (p.amount ?? 0), 0);
      setTotalCommittedAll(committedAll);
      setTotalInvoicedAll(((ilRes.data ?? []) as Array<{ amount_cents: number }>).reduce((s, li) => s + li.amount_cents, 0));

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
        committed: acc.committed + r.committed,
        invoiced_with_po: acc.invoiced_with_po + r.invoiced_with_po,
        invoiced_without_po: acc.invoiced_without_po + r.invoiced_without_po,
      }),
      { original: 0, approved_cos: 0, revised: 0, committed: 0, invoiced_with_po: 0, invoiced_without_po: 0 }
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

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <Stat label="Original Contract" value={formatCents(job.original_contract_amount)} />
          <Stat label="Approved COs" value={formatCents(job.approved_cos_total ?? totals.approved_cos)} />
          <Stat label="Revised Contract" value={formatCents(job.current_contract_amount)} highlight />
          <Stat label="Committed (POs)" value={formatCents(totalCommittedAll)} />
          <Stat label="Invoiced" value={formatCents(totalInvoicedAll)} />
          <Stat
            label="Remaining"
            value={formatCents(job.current_contract_amount - totalInvoicedAll)}
            negative={totalInvoicedAll > job.current_contract_amount}
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
                  <th className="text-right px-3 py-3 font-medium">Original</th>
                  <th className="text-right px-3 py-3 font-medium">CO +/-</th>
                  <th className="text-right px-3 py-3 font-medium">Revised</th>
                  <th className="text-right px-3 py-3 font-medium">Committed</th>
                  <th className="text-right px-3 py-3 font-medium">Invoiced</th>
                  <th className="text-right px-3 py-3 font-medium">Remaining PO</th>
                  <th className="text-right px-3 py-3 font-medium">Uncommitted</th>
                  <th className="text-right px-3 py-3 font-medium">Projected</th>
                  <th className="text-right px-3 py-3 font-medium">Variance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const invoiced = r.invoiced_with_po + r.invoiced_without_po;
                  const remainingPo = Math.max(0, r.committed - r.invoiced_with_po);
                  const uncommitted = r.revised_estimate - r.committed - r.invoiced_without_po;
                  const projected = invoiced + remainingPo + Math.max(0, r.invoiced_with_po - r.committed);
                  const variance = r.revised_estimate - projected;
                  const variancePct = r.revised_estimate > 0 ? variance / r.revised_estimate : 0;

                  // Row colors per spec:
                  //   variance > 0 → green (under budget)
                  //   0 >= variance >= -5% of revised → yellow (slightly over)
                  //   variance < -5% of revised → red (significantly over)
                  const badBand = r.revised_estimate > 0 && variancePct < -0.05;
                  const tightBand = r.revised_estimate > 0 && variancePct <= 0 && !badBand;
                  const rowBg = badBand
                    ? "bg-status-danger/10"
                    : tightBand
                      ? "bg-status-warning/10"
                      : r.revised_estimate > 0
                        ? "bg-status-success/5"
                        : "";
                  const stickyBg = badBand
                    ? "bg-[#FBE4E4]"
                    : tightBand
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
                      <td className="px-3 py-2 text-right text-cream tabular-nums">
                        {r.committed > 0 ? formatCents(r.committed) : <span className="text-cream-dim">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-cream tabular-nums">{formatCents(invoiced)}</td>
                      <td className="px-3 py-2 text-right text-cream-muted tabular-nums">
                        {remainingPo > 0 ? formatCents(remainingPo) : <span className="text-cream-dim">—</span>}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${uncommitted < 0 ? "text-status-warning" : "text-cream"}`}>
                        {formatCents(uncommitted)}
                      </td>
                      <td className="px-3 py-2 text-right text-cream tabular-nums">{formatCents(projected)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${
                        badBand ? "text-status-danger" : tightBand ? "text-status-warning" : variance > 0 ? "text-status-success" : "text-cream"
                      }`}>
                        {formatCents(variance)}
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
                  <td className="px-3 py-3 text-right text-cream tabular-nums">
                    {totals.committed > 0 ? formatCents(totals.committed) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right text-cream tabular-nums font-display">
                    {formatCents(totals.invoiced_with_po + totals.invoiced_without_po)}
                  </td>
                  <td className="px-3 py-3 text-right text-cream-muted tabular-nums">
                    {formatCents(Math.max(0, totals.committed - totals.invoiced_with_po))}
                  </td>
                  <td className="px-3 py-3 text-right text-cream tabular-nums">
                    {formatCents(totals.revised - totals.committed - totals.invoiced_without_po)}
                  </td>
                  <td className="px-3 py-3 text-right text-cream tabular-nums">
                    {formatCents(
                      totals.invoiced_with_po + totals.invoiced_without_po
                      + Math.max(0, totals.committed - totals.invoiced_with_po)
                      + Math.max(0, totals.invoiced_with_po - totals.committed)
                    )}
                  </td>
                  <td className={`px-3 py-3 text-right tabular-nums font-display ${
                    totals.revised - (totals.invoiced_with_po + totals.invoiced_without_po + Math.max(0, totals.committed - totals.invoiced_with_po)) < 0 ? "text-status-danger" : "text-cream"
                  }`}>
                    {formatCents(totals.revised - (
                      totals.invoiced_with_po + totals.invoiced_without_po
                      + Math.max(0, totals.committed - totals.invoiced_with_po)
                      + Math.max(0, totals.invoiced_with_po - totals.committed)
                    ))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-[11px] text-cream-dim">
          Committed = sum of issued POs against this line. Invoiced = sum of approved invoices (with and without POs). Remaining PO = committed − invoiced on POs.
          Uncommitted = revised − committed − direct invoices (no PO). Projected = invoiced + remaining PO + any overage. Variance = revised − projected.
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
