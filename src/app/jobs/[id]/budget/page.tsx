"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JobTabs from "@/components/job-tabs";
import JobFinancialBar from "@/components/job-financial-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import SlideOutPanel from "@/components/slide-out-panel";
import BudgetDrillDown from "@/components/budget-drill-down";
import EditableCell from "@/components/editable-cell";
import { supabase } from "@/lib/supabase/client";
import { formatCents } from "@/lib/utils/format";
import type { BudgetExportInput } from "@/lib/budget-export";
import { toast } from "@/lib/utils/toast";
import EmptyState, { EmptyIcons } from "@/components/empty-state";
import BudgetCostsSubTabs from "@/components/budget-costs-sub-tabs";

interface Job {
  id: string;
  name: string;
  address: string | null;
  original_contract_amount: number;
  current_contract_amount: number;
  approved_cos_total: number | null;
  retainage_percent: number | null;
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

interface CostCodeOption {
  id: string;
  code: string;
  description: string;
  category: string | null;
  sort_order: number | null;
}

type DrillMode = "committed" | "invoiced" | "co" | "full";
type StatusFilter = "all" | "over" | "uncommitted" | "active" | "zero";

const SPENT_STATUSES = [
  "pm_approved",
  "qa_review",
  "qa_approved",
  "pushed_to_qb",
  "in_draw",
  "paid",
];
const _PO_OPEN_STATUSES = ["issued", "partially_invoiced", "fully_invoiced"];

const ACTIVE_ONLY_KEY = "rbc.budget.showActiveOnly";
const COLLAPSED_CATS_KEY = "rbc.budget.collapsedCategories";
const VIEW_MODE_KEY = "rbc.budget.viewMode";
const UNCATEGORIZED = "Uncategorized";

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All Lines",
  over: "Over Budget",
  uncommitted: "Under Committed",
  active: "Has Activity",
  zero: "Zero Budget",
};

export default function JobBudgetPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [costCodes, setCostCodes] = useState<CostCodeOption[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"detail" | "compare">("detail");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drill, setDrill] = useState<{
    lineId: string;
    code: string;
    description: string;
    mode: DrillMode;
  } | null>(null);

  const [addingLineFor, setAddingLineFor] = useState<string | null>(null);
  const [addLineCostCode, setAddLineCostCode] = useState<string>("");
  const [addLineAmount, setAddLineAmount] = useState<string>("0.00");
  const [addLineBusy, setAddLineBusy] = useState(false);
  const [addLineError, setAddLineError] = useState<string | null>(null);

  const [readOnlyToast, setReadOnlyToast] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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
      const vm = window.localStorage.getItem(VIEW_MODE_KEY);
      if (vm === "compare" || vm === "detail") setViewMode(vm);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_ONLY_KEY, activeOnly ? "1" : "0");
    } catch {
      // ignore
    }
  }, [activeOnly]);

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
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  const loadBudget = useCallback(async () => {
    const [jobRes, blRes, coRes, ilRes, ccRes] = await Promise.all([
      supabase
        .from("jobs")
        .select(
          "id, name, address, original_contract_amount, current_contract_amount, approved_cos_total, retainage_percent"
        )
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
      supabase
        .from("cost_codes")
        .select("id, code, description, category, sort_order")
        .is("deleted_at", null)
        .order("sort_order")
        .order("code"),
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
    setCostCodes(
      ((ccRes.data ?? []) as Array<{
        id: string;
        code: string;
        description: string;
        category: string | null;
        sort_order: number | null;
      }>)
    );
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/login?redirect=/jobs/${params.id}/budget`); return; }
      await loadBudget();
    })();
  }, [params.id, router, loadBudget]);

  // Distinct categories (for filter dropdown).
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  function rowMatchesStatus(r: BudgetRow): boolean {
    if (statusFilter === "all") return true;
    const invoiced = r.invoiced_with_po + r.invoiced_without_po;
    const remainingPo = Math.max(0, r.committed - r.invoiced_with_po);
    const projected = invoiced + remainingPo + Math.max(0, r.invoiced_with_po - r.committed);
    const variance = r.revised_estimate - projected;
    switch (statusFilter) {
      case "over":
        return r.revised_estimate > 0 && variance < 0;
      case "uncommitted":
        return r.revised_estimate > 0 && r.committed === 0;
      case "active":
        return invoiced > 0 || r.committed > 0;
      case "zero":
        return r.original_estimate === 0 && r.revised_estimate === 0;
    }
    return true;
  }

  // Filtered rows after search/category/status/active-only.
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
      if (!rowMatchesStatus(r)) return false;
      if (q) {
        const hay = `${r.code} ${r.description} ${r.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, categoryFilter, activeOnly, statusFilter]);

  const filtersActive =
    !!search || !!categoryFilter || activeOnly || statusFilter !== "all";

  // Group filtered rows by category. If a category ends up empty under the
  // filter, it's omitted from the groups (category header is hidden).
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

  // Stats used by the compare-view summary.
  const compareStats = useMemo(() => {
    let underCount = 0;
    let overCount = 0;
    let savings = 0;
    let overage = 0;
    for (const r of filteredRows) {
      const invoiced = r.invoiced_with_po + r.invoiced_without_po;
      const remainingPo = Math.max(0, r.committed - r.invoiced_with_po);
      const projected = invoiced + remainingPo + Math.max(0, r.invoiced_with_po - r.committed);
      const variance = r.revised_estimate - projected;
      if (variance > 0) {
        underCount += 1;
        savings += variance;
      } else if (variance < 0) {
        overCount += 1;
        overage += Math.abs(variance);
      }
    }
    return { underCount, overCount, savings, overage };
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
    setStatusFilter("all");
    setActiveOnly(false);
  }

  function showReadOnlyTip(label: string) {
    setReadOnlyToast(`${label} is calculated automatically`);
    window.setTimeout(() => setReadOnlyToast(null), 2000);
  }

  // Inline edit: save a new original_estimate.
  async function saveOriginalEstimate(lineId: string, nextCents: number) {
    setEditError(null);
    const res = await fetch(`/api/budget-lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ original_estimate: nextCents }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(j.error || `HTTP ${res.status}`);
    }
    // Optimistically update the row, then reload so committed/invoiced stay correct.
    setRows((prev) =>
      prev.map((r) =>
        r.id === lineId ? { ...r, original_estimate: nextCents, revised_estimate: nextCents + r.approved_cos } : r
      )
    );
    // Refresh to pull any trigger-driven side effects (co_adjustments, invoiced, etc.).
    await loadBudget();
  }

  // Add line inline.
  function beginAddLine(category: string | null) {
    setAddingLineFor(category ?? "__tail__");
    setAddLineCostCode("");
    setAddLineAmount("0.00");
    setAddLineError(null);
  }

  function cancelAddLine() {
    setAddingLineFor(null);
    setAddLineCostCode("");
    setAddLineAmount("0.00");
    setAddLineError(null);
  }

  async function submitAddLine() {
    if (!addLineCostCode) {
      setAddLineError("Pick a cost code");
      return;
    }
    const amountDollars = Number((addLineAmount || "0").replace(/[$,]/g, ""));
    if (!Number.isFinite(amountDollars) || amountDollars < 0) {
      setAddLineError("Amount must be 0 or greater");
      return;
    }
    const amountCents = Math.round(amountDollars * 100);

    setAddLineBusy(true);
    setAddLineError(null);
    try {
      const res = await fetch("/api/budget-lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: params.id,
          cost_code_id: addLineCostCode,
          original_estimate: amountCents,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      await loadBudget();
      cancelAddLine();
    } catch (err) {
      setAddLineError(err instanceof Error ? err.message : "Add failed");
    } finally {
      setAddLineBusy(false);
    }
  }

  // Cost codes not yet represented on the budget — the add-line dropdown
  // narrows to these to prevent duplicates. Also honors category when
  // adding inside a category block.
  const availableCostCodes = useMemo(() => {
    const used = new Set(rows.map((r) => r.cost_code_id).filter(Boolean) as string[]);
    return costCodes.filter((c) => !used.has(c.id));
  }, [rows, costCodes]);

  async function handleExport() {
    if (!job) return;
    setExporting(true);
    try {
      // Pull PO + invoice detail for the "PO Detail" and "Invoice Detail" sheets.
      const [poRes, invRes] = await Promise.all([
        supabase
          .from("purchase_orders")
          .select(
            "id, po_number, amount, invoiced_total, status, issued_date, budget_line_id, vendors:vendor_id (name), cost_codes:cost_code_id (code), budget_lines:budget_line_id (cost_codes:cost_code_id (code, description))"
          )
          .eq("job_id", job.id)
          .is("deleted_at", null),
        supabase
          .from("invoices")
          .select(
            `id, invoice_number, received_date, total_amount, description, status,
             cost_codes:cost_code_id (code),
             vendors:vendor_id (name),
             vendor_name_raw,
             purchase_orders:po_id (po_number),
             budget_line_lookup:cost_code_id (code, description)`
          )
          .eq("job_id", job.id)
          .in("status", SPENT_STATUSES)
          .is("deleted_at", null),
      ]);

      const lines = filteredRows.map((r) => {
        const invoiced = r.invoiced_with_po + r.invoiced_without_po;
        const remainingPo = Math.max(0, r.committed - r.invoiced_with_po);
        const uncommitted = r.revised_estimate - r.committed - r.invoiced_without_po;
        const projected =
          invoiced + remainingPo + Math.max(0, r.invoiced_with_po - r.committed);
        const variance = r.revised_estimate - projected;
        return {
          code: r.code,
          description: r.description,
          category: r.category,
          original: r.original_estimate,
          approved_cos: r.approved_cos,
          revised: r.revised_estimate,
          committed: r.committed,
          invoiced,
          remaining_po: remainingPo,
          uncommitted,
          projected,
          variance,
        };
      });

      const pos = ((poRes.data ?? []) as Array<{
        po_number: string | null;
        amount: number;
        invoiced_total: number;
        status: string;
        issued_date: string | null;
        vendors: { name: string } | { name: string }[] | null;
        cost_codes: { code: string } | { code: string }[] | null;
        budget_lines:
          | {
              cost_codes: { code: string; description: string } | { code: string; description: string }[] | null;
            }
          | {
              cost_codes: { code: string; description: string } | { code: string; description: string }[] | null;
            }[]
          | null;
      }>).map((p) => {
        const vendor = Array.isArray(p.vendors) ? p.vendors[0]?.name : p.vendors?.name;
        const cc = Array.isArray(p.cost_codes) ? p.cost_codes[0]?.code : p.cost_codes?.code;
        const bl = Array.isArray(p.budget_lines) ? p.budget_lines[0] : p.budget_lines;
        const blCC = bl ? (Array.isArray(bl.cost_codes) ? bl.cost_codes[0] : bl.cost_codes) : null;
        const blDesc = blCC?.description ?? null;
        return {
          po_number: p.po_number,
          vendor: vendor ?? null,
          cost_code: cc ?? null,
          budget_line_description: blDesc,
          amount: p.amount ?? 0,
          invoiced_total: p.invoiced_total ?? 0,
          remaining: Math.max(0, (p.amount ?? 0) - (p.invoiced_total ?? 0)),
          status: p.status,
          issued_date: p.issued_date,
        };
      });

      const invoices = ((invRes.data ?? []) as Array<{
        invoice_number: string | null;
        received_date: string | null;
        total_amount: number;
        description: string | null;
        status: string;
        vendors: { name: string } | { name: string }[] | null;
        vendor_name_raw: string | null;
        cost_codes: { code: string } | { code: string }[] | null;
        purchase_orders: { po_number: string | null } | { po_number: string | null }[] | null;
        budget_line_lookup: { code: string; description: string } | { code: string; description: string }[] | null;
      }>).map((i) => {
        const vendor = Array.isArray(i.vendors) ? i.vendors[0]?.name : i.vendors?.name;
        const cc = Array.isArray(i.cost_codes) ? i.cost_codes[0]?.code : i.cost_codes?.code;
        const po = Array.isArray(i.purchase_orders)
          ? i.purchase_orders[0]?.po_number
          : i.purchase_orders?.po_number;
        const bl = Array.isArray(i.budget_line_lookup)
          ? i.budget_line_lookup[0]
          : i.budget_line_lookup;
        return {
          vendor: vendor ?? i.vendor_name_raw ?? null,
          invoice_number: i.invoice_number,
          received_date: i.received_date,
          amount: i.total_amount ?? 0,
          cost_code: cc ?? null,
          budget_line_description: bl?.description ?? null,
          po_number: po ?? null,
          status: i.status,
          description: i.description,
        };
      });

      const summaryInvoiced = grandTotals.invoiced_with_po + grandTotals.invoiced_without_po;
      const summary = {
        original: grandTotals.original,
        approved_cos: grandTotals.approved_cos,
        revised: grandTotals.revised,
        committed: grandTotals.committed,
        invoiced: summaryInvoiced,
        remaining: job.current_contract_amount - summaryInvoiced,
      };

      const input: BudgetExportInput = {
        job: {
          name: job.name,
          address: job.address,
          original_contract_amount: job.original_contract_amount,
          current_contract_amount: job.current_contract_amount,
          approved_cos_total: job.approved_cos_total ?? 0,
          retainage_percent: Number(job.retainage_percent ?? 0),
        },
        lines,
        pos,
        invoices,
        summary,
      };
      // Dynamic import: ExcelJS is heavy (~280KB) — load only on export
      const { buildBudgetWorkbook, downloadBlob } = await import("@/lib/budget-export");
      const blob = await buildBudgetWorkbook(input);
      const date = new Date().toISOString().slice(0, 10);
      const safeName = job.name.replace(/[^a-z0-9]+/gi, "_");
      downloadBlob(blob, `${safeName}_Budget_${date}.xlsx`);
      toast.success("Budget exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
        <div className="w-8 h-8 border-2 border-teal/30 border-t-teal animate-spin mx-auto" />
      </main>
    );
  }
  if (!job) {
    return (
      <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
        <p className="text-cream">Job not found</p>
        <Link href="/jobs" className="text-teal hover:underline text-sm">Back to jobs</Link>
      </main>
    );
  }

  const showCompareStats = viewMode === "compare";

  return (
    <>
      <main className="print-area max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Jobs", href: "/jobs" },
            { label: job.name, href: `/jobs/${job.id}` },
            { label: "Budget" },
          ]}
        />
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-cream">{job.name}</h2>
            <p className="text-sm text-cream-dim mt-1">{job.address ?? "No address"}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 border border-brand-border text-cream hover:bg-brand-elevated text-xs uppercase tracking-[0.06em] transition-colors print:hidden"
            aria-label="Print this budget"
          >
            Print
          </button>
        </div>
        <div className="print:hidden">
          <JobTabs jobId={job.id} active="budget" />
          <JobFinancialBar jobId={job.id} />
          <BudgetCostsSubTabs jobId={job.id} active="budget" />
        </div>

        {showCompareStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="border border-status-success/40 bg-status-success/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-cream-dim font-medium">
                Under Budget
              </p>
              <p className="text-base text-cream tabular-nums font-display mt-1">
                {compareStats.underCount} line{compareStats.underCount === 1 ? "" : "s"}
                <span className="text-cream-dim"> · </span>
                <span className="text-status-success">{formatCents(compareStats.savings)}</span>
                <span className="text-cream-dim"> savings</span>
              </p>
            </div>
            <div className="border border-status-danger/40 bg-status-danger/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-cream-dim font-medium">
                Over Budget
              </p>
              <p className="text-base text-cream tabular-nums font-display mt-1">
                {compareStats.overCount} line{compareStats.overCount === 1 ? "" : "s"}
                <span className="text-cream-dim"> · </span>
                <span className="text-status-danger">{formatCents(compareStats.overage)}</span>
                <span className="text-cream-dim"> overage</span>
              </p>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState
            icon={<EmptyIcons.Document />}
            title="No budget lines yet"
            message="Import a budget CSV/Excel from the overview tab, or add lines manually."
            primaryAction={{ label: "Import CSV / Excel", href: `/jobs/${job.id}` }}
            secondaryAction={{ label: "+ Add Line", onClick: () => beginAddLine(null) }}
          />
        ) : (
          <>
            {/* Toolbar */}
            <div className="mb-3 space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
              <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-xs">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search code, description, category…"
                  className="w-full pl-8 pr-2 py-2 bg-brand-surface border border-brand-border text-sm text-cream placeholder:text-cream-dim focus:outline-none focus:border-teal"
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
              <div className="grid grid-cols-2 gap-2 sm:contents">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-2 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:outline-none focus:border-teal"
                  aria-label="Filter by category"
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="px-2 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:outline-none focus:border-teal"
                  aria-label="Filter by status"
                >
                  {(Object.keys(STATUS_FILTER_LABELS) as StatusFilter[]).map((k) => (
                    <option key={k} value={k}>
                      {STATUS_FILTER_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-cream cursor-pointer select-none min-h-[44px] sm:min-h-0">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  className="accent-teal w-4 h-4"
                />
                Active only
              </label>

              <span className="block text-[12px] text-cream-dim tabular-nums">
                Showing {filteredRows.length} of {rows.length} line
                {rows.length === 1 ? "" : "s"}
                {filtersActive && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="ml-3 text-[12px] text-cream-dim hover:text-cream underline underline-offset-2"
                  >
                    Clear all filters
                  </button>
                )}
              </span>

              <div className="sm:ml-auto flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === "detail" ? "compare" : "detail")}
                  className={`text-[12px] px-3 py-2 border transition-colors ${
                    viewMode === "compare"
                      ? "bg-teal text-white border-teal"
                      : "border-brand-border text-cream hover:bg-brand-surface"
                  }`}
                  aria-pressed={viewMode === "compare"}
                  title="Toggle owner-meeting comparison view"
                >
                  Compare
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  className="text-[12px] px-3 py-2 border border-brand-border text-cream hover:bg-brand-surface disabled:opacity-60 transition-colors"
                  title="Download budget as Excel (.xlsx)"
                >
                  {exporting ? "Exporting…" : "Export Excel"}
                </button>
                {viewMode === "detail" && (
                  <>
                    <button
                      type="button"
                      onClick={collapseAll}
                      className="text-[12px] px-3 py-2 border border-brand-border text-cream hover:bg-brand-surface transition-colors"
                    >
                      Collapse All
                    </button>
                    <button
                      type="button"
                      onClick={expandAll}
                      className="text-[12px] px-3 py-2 border border-brand-border text-cream hover:bg-brand-surface transition-colors"
                    >
                      Expand All
                    </button>
                  </>
                )}
              </div>
            </div>

            {editError && (
              <div className="mb-3 border border-status-danger/40 bg-status-danger/5 px-3 py-2 text-[12px] text-status-danger">
                {editError}
              </div>
            )}

            {viewMode === "compare" ? (
              <CompareTable rows={filteredRows} />
            ) : (
              <div className="bg-brand-card border border-brand-border overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm">
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
                      const isAdding = addingLineFor === g.category;
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
                          isAdding={isAdding}
                          onBeginAdd={() => beginAddLine(g.category)}
                          onCancelAdd={cancelAddLine}
                          onSubmitAdd={submitAddLine}
                          addLineCostCode={addLineCostCode}
                          setAddLineCostCode={setAddLineCostCode}
                          addLineAmount={addLineAmount}
                          setAddLineAmount={setAddLineAmount}
                          addLineBusy={addLineBusy}
                          addLineError={addLineError}
                          availableCostCodes={availableCostCodes}
                          onDrill={(lineId, code, description, mode) =>
                            setDrill({ lineId, code, description, mode })
                          }
                          onShowReadOnlyTip={showReadOnlyTip}
                          onSaveOriginal={saveOriginalEstimate}
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
            )}

            <p className="mt-4 text-[11px] text-cream-dim">
              Double-click Original to edit. Click Committed / Invoiced / CO / description to
              drill in. Calculated columns are read-only.
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

      {readOnlyToast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-3 py-2 bg-brand-card border border-brand-border text-[12px] text-cream shadow-lg"
          role="status"
        >
          {readOnlyToast}
        </div>
      )}
    </>
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
  isAdding,
  onBeginAdd,
  onCancelAdd,
  onSubmitAdd,
  addLineCostCode,
  setAddLineCostCode,
  addLineAmount,
  setAddLineAmount,
  addLineBusy,
  addLineError,
  availableCostCodes,
  onDrill,
  onShowReadOnlyTip,
  onSaveOriginal,
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
  isAdding: boolean;
  onBeginAdd: () => void;
  onCancelAdd: () => void;
  onSubmitAdd: () => void;
  addLineCostCode: string;
  setAddLineCostCode: (v: string) => void;
  addLineAmount: string;
  setAddLineAmount: (v: string) => void;
  addLineBusy: boolean;
  addLineError: string | null;
  availableCostCodes: CostCodeOption[];
  onDrill: (lineId: string, code: string, description: string, mode: DrillMode) => void;
  onShowReadOnlyTip: (label: string) => void;
  onSaveOriginal: (lineId: string, nextCents: number) => Promise<void>;
}) {
  // Narrow the cost-code dropdown to this category if any match.
  const catCodes = availableCostCodes.filter(
    (c) => (c.category ?? UNCATEGORIZED) === category
  );
  const dropdownOptions = catCodes.length > 0 ? catCodes : availableCostCodes;

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
            ? "bg-status-danger/10"
            : tightBand
              ? "bg-status-warning/10"
              : r.revised_estimate > 0
                ? "bg-status-success/10"
                : "bg-brand-card";
          return (
            <tr
              key={r.id}
              className={`border-b border-brand-row-border last:border-0 ${rowBg}`}
            >
              <td
                className={`px-3 py-2 font-mono text-xs sticky left-0 z-[1] ${stickyBg}`}
                style={{ color: "var(--text-primary)" }}
              >
                {r.code}
              </td>
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
              {/* Original — editable */}
              <td className="px-3 py-2 text-right tabular-nums">
                <EditableCell
                  value={r.original_estimate}
                  kind="currency"
                  format={(v) => formatCents(typeof v === "number" ? v : Number(v) || 0)}
                  onSave={(next) => onSaveOriginal(r.id, Number(next))}
                  ariaLabel={`Original for ${r.code}`}
                  alignRight
                />
              </td>
              {/* CO +/- — read-only, but clickable → drill */}
              <td
                className={`px-3 py-2 text-right tabular-nums ${r.approved_cos ? "" : "text-cream-dim"}`}
              >
                {r.approved_cos ? (
                  <button
                    type="button"
                    onClick={() => onDrill(r.id, r.code, r.description, "co")}
                    className="text-teal hover:underline underline-offset-2 transition-colors"
                  >
                    {formatCents(r.approved_cos)}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onShowReadOnlyTip("CO +/−")}
                    className="text-cream-dim hover:text-cream transition-colors"
                    title="Calculated automatically from approved COs"
                  >
                    —
                  </button>
                )}
              </td>
              {/* Revised — read-only */}
              <td
                className="px-3 py-2 text-right text-cream font-medium tabular-nums"
                onClick={() => onShowReadOnlyTip("Revised")}
                title="Calculated automatically (Original + CO +/−)"
              >
                {formatCents(r.revised_estimate)}
              </td>
              {/* Committed — read-only, click to drill */}
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
                  <button
                    type="button"
                    onClick={() => onShowReadOnlyTip("Committed")}
                    className="text-cream-dim hover:text-cream transition-colors"
                    title="Calculated automatically from open POs"
                  >
                    —
                  </button>
                )}
              </td>
              {/* Invoiced — read-only, click to drill */}
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
                  <button
                    type="button"
                    onClick={() => onShowReadOnlyTip("Invoiced")}
                    className="text-cream transition-colors"
                    title="Calculated automatically from approved invoices"
                  >
                    {formatCents(invoiced)}
                  </button>
                )}
              </td>
              {/* Remaining PO — read-only */}
              <td
                className="px-3 py-2 text-right text-cream-muted tabular-nums"
                onClick={() => onShowReadOnlyTip("Remaining PO")}
                title="Calculated automatically (Committed − Invoiced on POs)"
              >
                {remainingPo > 0 ? formatCents(remainingPo) : <span className="text-cream-dim">—</span>}
              </td>
              {/* Uncommitted — read-only */}
              <td
                className={`px-3 py-2 text-right tabular-nums ${uncommitted < 0 ? "text-status-warning" : "text-cream"}`}
                onClick={() => onShowReadOnlyTip("Uncommitted")}
                title="Calculated automatically (Revised − Committed − direct invoices)"
              >
                {formatCents(uncommitted)}
              </td>
              {/* Projected — read-only */}
              <td
                className="px-3 py-2 text-right text-cream tabular-nums"
                onClick={() => onShowReadOnlyTip("Projected")}
                title="Calculated automatically"
              >
                {formatCents(projected)}
              </td>
              {/* Variance — read-only */}
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
                onClick={() => onShowReadOnlyTip("Variance")}
                title="Calculated automatically (Revised − Projected)"
              >
                {formatCents(variance)}
              </td>
            </tr>
          );
        })}

      {/* Add-line row */}
      {!isCollapsed && (
        <tr className="border-b border-brand-row-border bg-brand-card/50">
          <td className="px-3 py-1.5" colSpan={11}>
            {!isAdding ? (
              <button
                type="button"
                onClick={onBeginAdd}
                className="inline-flex items-center gap-1 text-[12px] text-cream-dim hover:text-teal transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add line to {category}
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  autoFocus
                  value={addLineCostCode}
                  onChange={(e) => setAddLineCostCode(e.target.value)}
                  className="px-2 py-1 bg-brand-surface border border-teal text-sm text-cream focus:outline-none"
                  aria-label="Cost code"
                  disabled={addLineBusy}
                >
                  <option value="">— Select cost code —</option>
                  {dropdownOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.description}
                      {c.category ? ` (${c.category})` : ""}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  inputMode="decimal"
                  value={addLineAmount}
                  onChange={(e) => setAddLineAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onSubmitAdd();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      onCancelAdd();
                    }
                  }}
                  placeholder="0.00"
                  className="w-28 px-2 py-1 bg-brand-surface border border-teal text-sm text-cream text-right tabular-nums focus:outline-none"
                  aria-label="Original amount"
                  disabled={addLineBusy}
                />
                <button
                  type="button"
                  onClick={onSubmitAdd}
                  disabled={addLineBusy}
                  className="text-[12px] px-2 py-1 bg-teal text-white hover:bg-teal-hover disabled:opacity-60 transition-colors"
                >
                  {addLineBusy ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={onCancelAdd}
                  disabled={addLineBusy}
                  className="text-[12px] px-2 py-1 border border-brand-border text-cream hover:bg-brand-surface transition-colors"
                >
                  Cancel
                </button>
                {addLineError && (
                  <span className="text-[12px] text-status-danger">{addLineError}</span>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function CompareTable({ rows }: { rows: BudgetRow[] }) {
  // Simplified layout for the owner-meeting view: 7 columns, full-row
  // background color based on variance band.
  return (
    <div className="bg-brand-card border border-brand-border overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-brand-border text-[11px] uppercase tracking-wider text-cream-dim bg-brand-surface/50">
            <th className="text-left px-3 py-3 font-medium sticky left-0 bg-brand-surface/90 z-10">Code</th>
            <th className="text-left px-3 py-3 font-medium">Description</th>
            <th className="text-right px-3 py-3 font-medium">Original</th>
            <th className="text-right px-3 py-3 font-medium">Revised</th>
            <th className="text-right px-3 py-3 font-medium">Projected</th>
            <th className="text-right px-3 py-3 font-medium">Variance</th>
            <th className="text-right px-3 py-3 font-medium">% Var</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const invoiced = r.invoiced_with_po + r.invoiced_without_po;
            const remainingPo = Math.max(0, r.committed - r.invoiced_with_po);
            const projected =
              invoiced + remainingPo + Math.max(0, r.invoiced_with_po - r.committed);
            const variance = r.revised_estimate - projected;
            const pct = r.revised_estimate > 0 ? (variance / r.revised_estimate) * 100 : 0;
            const badBand = r.revised_estimate > 0 && pct < -5;
            const tightBand = r.revised_estimate > 0 && pct <= 0 && !badBand;
            const goodBand = r.revised_estimate > 0 && variance > 0;

            const rowBg = badBand
              ? "bg-status-danger/15"
              : tightBand
                ? "bg-status-warning/15"
                : goodBand
                  ? "bg-status-success/10"
                  : "";
            const stickyBg = badBand
              ? "bg-status-danger/15"
              : tightBand
                ? "bg-status-warning/15"
                : goodBand
                  ? "bg-status-success/15"
                  : "bg-brand-card";
            const varTone = badBand
              ? "text-status-danger"
              : tightBand
                ? "text-status-warning"
                : goodBand
                  ? "text-status-success"
                  : "text-cream";

            return (
              <tr key={r.id} className={`border-b border-brand-row-border last:border-0 ${rowBg}`}>
                <td
                  className={`px-3 py-2 font-mono text-xs sticky left-0 z-[1] ${stickyBg}`}
                  style={{ color: "var(--text-primary)" }}
                >
                  {r.code}
                </td>
                <td className="px-3 py-2 text-cream-muted">{r.description}</td>
                <td className="px-3 py-2 text-right text-cream tabular-nums">
                  {formatCents(r.original_estimate)}
                </td>
                <td className="px-3 py-2 text-right text-cream tabular-nums font-medium">
                  {formatCents(r.revised_estimate)}
                </td>
                <td className="px-3 py-2 text-right text-cream tabular-nums">
                  {formatCents(projected)}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums font-medium ${varTone}`}>
                  {formatCents(variance)}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums ${varTone}`}>
                  {pct.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
