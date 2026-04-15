"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NavBar from "@/components/nav-bar";
import JobTabs from "@/components/job-tabs";
import JobFinancialBar from "@/components/job-financial-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import SlideOutPanel from "@/components/slide-out-panel";
import BudgetDrillDown from "@/components/budget-drill-down";
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
  category: string;
  sort_order: number;
  original_estimate: number;
  revised_estimate: number;
  is_allowance: boolean;
  approved_cos: number;
  committed: number;
  invoiced_with_po: number;
  invoiced_without_po: number;
}

type DrillMode = "committed" | "invoiced" | "co" | "full";

const SPENT_STATUSES = [
  "pm_approved",
  "qa_review",
  "qa_approved",
  "pushed_to_qb",
  "in_draw",
  "paid",
];

const ACTIVE_ONLY_KEY = "rbc.budget.showActiveOnly";
const COLLAPSED_CATS_KEY = "rbc.budget.collapsedCategories";
const UNCATEGORIZED = "Uncategorized";

export default function JobBudgetPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drill, setDrill] = useState<{
    lineId: string;
    code: string;
    description: string;
    mode: DrillMode;
  } | null>(null);

  // Hydrate preferences from localStorage once on mount.
  useEffect(() => {
    try {
      const ao = window.localStorage.getItem(ACTIVE_ONLY_KEY);
      if (ao === "1") setActiveOnly(true);
      const cc = window.localStorage.getItem(COLLAPSED_CATS_KEY);
      if (cc) {
        const arr = JSON.parse(cc);
        if (Array.isArray(arr)) setCollapsed(new Set(arr.map(String)));
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist active-only toggle.
  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_ONLY_KEY, activeOnly ? "1" : "0");
    } catch {
      // ignore
    }
  }, [activeOnly]);

  // Persist collapsed categories.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        COLLAPSED_CATS_KEY,
        JSON.stringify(Array.from(collapsed))
      );
    } catch {
      // ignore
    }
  }, [collapsed]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/login?redirect=/jobs/${params.id}/budget`); return; }

      const [jobRes, blRes, coRes, ilRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, name, address, original_contract_amount, current_contract_amount, approved_cos_total")
          .eq("id", params.id)
          .is("deleted_at", null)
          .single(),
        supabase
          .from("budget_lines")
          .select(
            "id, cost_code_id, original_estimate, revised_estimate, committed, co_adjustments, is_allowance, cost_codes:cost_code_id(code, description, category, sort_order)"
          )
          .eq("job_id", params.id)
          .is("deleted_at", null),
        supabase
          .from("change_order_lines")
          .select("budget_line_id, amount, change_orders!inner(job_id, status)")
          .eq("change_orders.job_id", params.id)
          .in("change_orders.status", ["approved", "executed"])
          .is("deleted_at", null),
        supabase
          .from("invoice_line_items")
          .select("amount_cents, budget_line_id, po_id, invoices!inner(job_id, status, deleted_at)")
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
        committed: number;
        co_adjustments: number;
        is_allowance: boolean;
        cost_codes: {
          code: string;
          description: string;
          category: string | null;
          sort_order: number | null;
        } | null;
      }>;

      const coByLine = new Map<string, number>();
      const coData =
        (coRes as { data?: Array<{ budget_line_id: string | null; amount: number }> })?.data ?? [];
      for (const alloc of coData) {
        if (!alloc.budget_line_id) continue;
        coByLine.set(alloc.budget_line_id, (coByLine.get(alloc.budget_line_id) ?? 0) + alloc.amount);
      }

      const invWithPoByLine = new Map<string, number>();
      const invWithoutPoByLine = new Map<string, number>();
      for (const li of ((ilRes.data ?? []) as Array<{
        budget_line_id: string | null;
        po_id: string | null;
        amount_cents: number;
      }>)) {
        if (!li.budget_line_id) continue;
        const target = li.po_id ? invWithPoByLine : invWithoutPoByLine;
        target.set(li.budget_line_id, (target.get(li.budget_line_id) ?? 0) + (li.amount_cents ?? 0));
      }

      const rowData: BudgetRow[] = blData.map((bl) => ({
        id: bl.id,
        cost_code_id: bl.cost_code_id,
        code: bl.cost_codes?.code ?? "—",
        description: bl.cost_codes?.description ?? "—",
        category: bl.cost_codes?.category ?? UNCATEGORIZED,
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
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.code.localeCompare(b.code);
      });

      setRows(rowData);
      setLoading(false);
    }
    load();
  }, [params.id, router]);

  // Distinct categories (for filter dropdown).
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  // Filtered rows after search/category/active-only.
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (activeOnly) {
        const zero =
          (r.original_estimate ?? 0) === 0 &&
          (r.approved_cos ?? 0) === 0 &&
          (r.committed ?? 0) === 0 &&
          r.invoiced_with_po + r.invoiced_without_po === 0;
        if (zero) return false;
      }
      if (categoryFilter && r.category !== categoryFilter) return false;
      if (q) {
        const hay = `${r.code} ${r.description} ${r.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, categoryFilter, activeOnly]);

  // Group by category.
  const groups = useMemo(() => {
    const map = new Map<string, BudgetRow[]>();
    for (const r of filteredRows) {
      const arr = map.get(r.category) ?? [];
      arr.push(r);
      map.set(r.category, arr);
    }
    return Array.from(map.entries()).map(([category, rowsInCat]) => {
      const subtotal = rowsInCat.reduce(
        (acc, r) => ({
          original: acc.original + r.original_estimate,
          approved_cos: acc.approved_cos + r.approved_cos,
          revised: acc.revised + r.revised_estimate,
          committed: acc.committed + r.committed,
          invoiced_with_po: acc.invoiced_with_po + r.invoiced_with_po,
          invoiced_without_po: acc.invoiced_without_po + r.invoiced_without_po,
        }),
        {
          original: 0,
          approved_cos: 0,
          revised: 0,
          committed: 0,
          invoiced_with_po: 0,
          invoiced_without_po: 0,
        }
      );
      return { category, rows: rowsInCat, subtotal };
    });
  }, [filteredRows]);

  const grandTotals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => ({
        original: acc.original + r.original_estimate,
        approved_cos: acc.approved_cos + r.approved_cos,
        revised: acc.revised + r.revised_estimate,
        committed: acc.committed + r.committed,
        invoiced_with_po: acc.invoiced_with_po + r.invoiced_with_po,
        invoiced_without_po: acc.invoiced_without_po + r.invoiced_without_po,
      }),
      {
        original: 0,
        approved_cos: 0,
        revised: 0,
        committed: 0,
        invoiced_with_po: 0,
        invoiced_without_po: 0,
      }
    );
  }, [filteredRows]);

  function toggleCollapsed(cat: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function collapseAll() {
    setCollapsed(new Set(groups.map((g) => g.category)));
  }

  function expandAll() {
    setCollapsed(new Set());
  }

  function clearFilters() {
    setSearch("");
    setCategoryFilter("");
    setActiveOnly(false);
  }

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
        <JobFinancialBar jobId={job.id} />

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
          <>
            {/* Toolbar */}
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search code, description, category…"
                  className="w-full pl-8 pr-2 py-1.5 bg-brand-surface border border-brand-border text-sm text-cream placeholder:text-cream-dim focus:outline-none focus:border-teal"
                />
                <svg
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-dim"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
                  />
                </svg>
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2 py-1.5 bg-brand-surface border border-brand-border text-sm text-cream focus:outline-none focus:border-teal"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-[13px] text-cream cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  className="accent-teal"
                />
                Show active lines only
              </label>
              {(search || categoryFilter || activeOnly) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[12px] text-cream-dim hover:text-cream underline underline-offset-2"
                >
                  Clear filters
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={collapseAll}
                  className="text-[12px] px-2 py-1 border border-brand-border text-cream hover:bg-brand-surface transition-colors"
                >
                  Collapse All
                </button>
                <button
                  type="button"
                  onClick={expandAll}
                  className="text-[12px] px-2 py-1 border border-brand-border text-cream hover:bg-brand-surface transition-colors"
                >
                  Expand All
                </button>
              </div>
            </div>

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
                  {groups.map((g) => {
                    const isCollapsed = collapsed.has(g.category);
                    const subInvoiced = g.subtotal.invoiced_with_po + g.subtotal.invoiced_without_po;
                    const subRemainingPo = Math.max(
                      0,
                      g.subtotal.committed - g.subtotal.invoiced_with_po
                    );
                    const subUncommitted =
                      g.subtotal.revised - g.subtotal.committed - g.subtotal.invoiced_without_po;
                    const subProjected =
                      subInvoiced +
                      subRemainingPo +
                      Math.max(0, g.subtotal.invoiced_with_po - g.subtotal.committed);
                    const subVariance = g.subtotal.revised - subProjected;
                    return (
                      <CategoryBlock
                        key={g.category}
                        category={g.category}
                        isCollapsed={isCollapsed}
                        onToggle={() => toggleCollapsed(g.category)}
                        rowCount={g.rows.length}
                        subtotals={{
                          original: g.subtotal.original,
                          approved_cos: g.subtotal.approved_cos,
                          revised: g.subtotal.revised,
                          committed: g.subtotal.committed,
                          invoiced: subInvoiced,
                          remainingPo: subRemainingPo,
                          uncommitted: subUncommitted,
                          projected: subProjected,
                          variance: subVariance,
                        }}
                        rows={g.rows}
                        onDrill={(lineId, code, description, mode) =>
                          setDrill({ lineId, code, description, mode })
                        }
                      />
                    );
                  })}
                  <tr className="border-t-2 border-brand-border bg-brand-surface font-medium">
                    <td colSpan={2} className="px-3 py-3 text-[11px] uppercase tracking-wider text-cream-dim font-medium sticky left-0 bg-brand-surface z-[1]">
                      Project Totals
                    </td>
                    <td className="px-3 py-3 text-right text-cream tabular-nums font-display">{formatCents(grandTotals.original)}</td>
                    <td className="px-3 py-3 text-right text-teal tabular-nums font-display">
                      {grandTotals.approved_cos ? formatCents(grandTotals.approved_cos) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-cream tabular-nums font-display">{formatCents(grandTotals.revised)}</td>
                    <td className="px-3 py-3 text-right text-cream tabular-nums">
                      {grandTotals.committed > 0 ? formatCents(grandTotals.committed) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-cream tabular-nums font-display">
                      {formatCents(grandTotals.invoiced_with_po + grandTotals.invoiced_without_po)}
                    </td>
                    <td className="px-3 py-3 text-right text-cream-muted tabular-nums">
                      {formatCents(Math.max(0, grandTotals.committed - grandTotals.invoiced_with_po))}
                    </td>
                    <td className="px-3 py-3 text-right text-cream tabular-nums">
                      {formatCents(grandTotals.revised - grandTotals.committed - grandTotals.invoiced_without_po)}
                    </td>
                    <td className="px-3 py-3 text-right text-cream tabular-nums">
                      {formatCents(
                        grandTotals.invoiced_with_po +
                          grandTotals.invoiced_without_po +
                          Math.max(0, grandTotals.committed - grandTotals.invoiced_with_po) +
                          Math.max(0, grandTotals.invoiced_with_po - grandTotals.committed)
                      )}
                    </td>
                    <td
                      className={`px-3 py-3 text-right tabular-nums font-display ${
                        grandTotals.revised -
                          (grandTotals.invoiced_with_po +
                            grandTotals.invoiced_without_po +
                            Math.max(0, grandTotals.committed - grandTotals.invoiced_with_po)) <
                        0
                          ? "text-status-danger"
                          : "text-cream"
                      }`}
                    >
                      {formatCents(
                        grandTotals.revised -
                          (grandTotals.invoiced_with_po +
                            grandTotals.invoiced_without_po +
                            Math.max(0, grandTotals.committed - grandTotals.invoiced_with_po) +
                            Math.max(0, grandTotals.invoiced_with_po - grandTotals.committed))
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-[11px] text-cream-dim">
              Committed = sum of issued POs against this line. Invoiced = sum of approved invoices (with and without POs). Click any Committed / Invoiced / CO value or a description to drill into the source records.
            </p>
          </>
        )}
      </main>

      <SlideOutPanel
        open={!!drill}
        onClose={() => setDrill(null)}
        title={drill ? `${drill.code} · ${panelTitleFor(drill.mode)}` : ""}
        subtitle={drill?.description}
      >
        {drill && <BudgetDrillDown budgetLineId={drill.lineId} mode={drill.mode} />}
      </SlideOutPanel>
    </div>
  );
}

function panelTitleFor(mode: DrillMode): string {
  switch (mode) {
    case "committed":
      return "Purchase Orders";
    case "invoiced":
      return "Invoices";
    case "co":
      return "Change Orders";
    case "full":
      return "All Linked Records";
  }
}

function CategoryBlock({
  category,
  isCollapsed,
  onToggle,
  rowCount,
  subtotals,
  rows,
  onDrill,
}: {
  category: string;
  isCollapsed: boolean;
  onToggle: () => void;
  rowCount: number;
  subtotals: {
    original: number;
    approved_cos: number;
    revised: number;
    committed: number;
    invoiced: number;
    remainingPo: number;
    uncommitted: number;
    projected: number;
    variance: number;
  };
  rows: BudgetRow[];
  onDrill: (lineId: string, code: string, description: string, mode: DrillMode) => void;
}) {
  return (
    <>
      {/* Category header row */}
      <tr
        className="border-b border-brand-border bg-brand-surface/80 cursor-pointer hover:bg-brand-surface transition-colors"
        onClick={onToggle}
      >
        <td
          colSpan={2}
          className="px-3 py-2 text-[12px] font-semibold uppercase tracking-wider text-cream sticky left-0 bg-brand-surface z-[1]"
        >
          <span className="inline-flex items-center gap-2">
            <svg
              className={`w-3 h-3 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            {category}
            <span className="text-[10px] text-cream-dim font-normal normal-case tracking-normal">
              ({rowCount} {rowCount === 1 ? "line" : "lines"})
            </span>
          </span>
        </td>
        <td className="px-3 py-2 text-right text-cream tabular-nums text-[12px] font-semibold">
          {formatCents(subtotals.original)}
        </td>
        <td className="px-3 py-2 text-right text-[12px] tabular-nums font-semibold text-teal">
          {subtotals.approved_cos ? formatCents(subtotals.approved_cos) : "—"}
        </td>
        <td className="px-3 py-2 text-right text-cream tabular-nums text-[12px] font-semibold">
          {formatCents(subtotals.revised)}
        </td>
        <td className="px-3 py-2 text-right text-cream tabular-nums text-[12px] font-semibold">
          {subtotals.committed > 0 ? formatCents(subtotals.committed) : "—"}
        </td>
        <td className="px-3 py-2 text-right text-cream tabular-nums text-[12px] font-semibold">
          {formatCents(subtotals.invoiced)}
        </td>
        <td className="px-3 py-2 text-right text-cream-muted tabular-nums text-[12px] font-semibold">
          {subtotals.remainingPo > 0 ? formatCents(subtotals.remainingPo) : "—"}
        </td>
        <td
          className={`px-3 py-2 text-right tabular-nums text-[12px] font-semibold ${
            subtotals.uncommitted < 0 ? "text-status-warning" : "text-cream"
          }`}
        >
          {formatCents(subtotals.uncommitted)}
        </td>
        <td className="px-3 py-2 text-right text-cream tabular-nums text-[12px] font-semibold">
          {formatCents(subtotals.projected)}
        </td>
        <td
          className={`px-3 py-2 text-right tabular-nums text-[12px] font-semibold ${
            subtotals.variance < 0 ? "text-status-danger" : "text-cream"
          }`}
        >
          {formatCents(subtotals.variance)}
        </td>
      </tr>

      {/* Line rows */}
      {!isCollapsed &&
        rows.map((r) => {
          const invoiced = r.invoiced_with_po + r.invoiced_without_po;
          const remainingPo = Math.max(0, r.committed - r.invoiced_with_po);
          const uncommitted = r.revised_estimate - r.committed - r.invoiced_without_po;
          const projected =
            invoiced + remainingPo + Math.max(0, r.invoiced_with_po - r.committed);
          const variance = r.revised_estimate - projected;
          const variancePct = r.revised_estimate > 0 ? variance / r.revised_estimate : 0;

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
                <button
                  type="button"
                  onClick={() => onDrill(r.id, r.code, r.description, "full")}
                  className="text-left hover:text-teal hover:underline underline-offset-2 transition-colors"
                >
                  {r.description}
                </button>
                {r.is_allowance && (
                  <span className="ml-2 inline-block px-1.5 py-0.5 text-[9px] uppercase tracking-wider border border-brass/50 text-brass">
                    Allowance
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right text-cream tabular-nums">{formatCents(r.original_estimate)}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${r.approved_cos ? "" : "text-cream-dim"}`}>
                {r.approved_cos ? (
                  <button
                    type="button"
                    onClick={() => onDrill(r.id, r.code, r.description, "co")}
                    className="text-teal hover:underline underline-offset-2 transition-colors"
                  >
                    {formatCents(r.approved_cos)}
                  </button>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2 text-right text-cream font-medium tabular-nums">{formatCents(r.revised_estimate)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.committed > 0 ? (
                  <button
                    type="button"
                    onClick={() => onDrill(r.id, r.code, r.description, "committed")}
                    className="text-cream hover:text-teal hover:underline underline-offset-2 transition-colors"
                  >
                    {formatCents(r.committed)}
                  </button>
                ) : (
                  <span className="text-cream-dim">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {invoiced > 0 ? (
                  <button
                    type="button"
                    onClick={() => onDrill(r.id, r.code, r.description, "invoiced")}
                    className="text-cream hover:text-teal hover:underline underline-offset-2 transition-colors"
                  >
                    {formatCents(invoiced)}
                  </button>
                ) : (
                  <span className="text-cream">{formatCents(invoiced)}</span>
                )}
              </td>
              <td className="px-3 py-2 text-right text-cream-muted tabular-nums">
                {remainingPo > 0 ? formatCents(remainingPo) : <span className="text-cream-dim">—</span>}
              </td>
              <td className={`px-3 py-2 text-right tabular-nums ${uncommitted < 0 ? "text-status-warning" : "text-cream"}`}>
                {formatCents(uncommitted)}
              </td>
              <td className="px-3 py-2 text-right text-cream tabular-nums">{formatCents(projected)}</td>
              <td
                className={`px-3 py-2 text-right tabular-nums font-medium ${
                  badBand
                    ? "text-status-danger"
                    : tightBand
                      ? "text-status-warning"
                      : variance > 0
                        ? "text-status-success"
                        : "text-cream"
                }`}
              >
                {formatCents(variance)}
              </td>
            </tr>
          );
        })}
    </>
  );
}
