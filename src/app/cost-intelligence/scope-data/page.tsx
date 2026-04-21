"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/app-shell";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwButton from "@/components/nw/Button";
import NwMoney from "@/components/nw/Money";
import { toast } from "@/lib/utils/toast";
import { COMMON_SCOPE_METRICS } from "@/components/cost-intelligence/queue-types";

type Status = "incomplete" | "complete" | "all";

interface ScopeRow {
  id: string;
  item_id: string;
  item_name: string;
  item_type: string | null;
  category: string | null;
  scope_size_metric: string | null;
  vendor_id: string;
  vendor_name: string;
  job_id: string | null;
  job_name: string | null;
  total_cents: number;
  transaction_date: string;
  scope_size_value: number | null;
  scope_size_source: string | null;
  scope_size_confidence: number | null;
  scope_size_notes: string | null;
  source_invoice_id: string | null;
  per_metric_cents: number | null;
}

interface ApiResponse {
  rows: ScopeRow[];
  total: number;
  complete: number;
  incomplete: number;
}

export default function ScopeDataPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>("incomplete");
  const [vendorFilter, setVendorFilter] = useState<string>("");
  const [jobFilter, setJobFilter] = useState<string>("");
  const [edits, setEdits] = useState<Record<string, { value: string; source: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status });
      if (vendorFilter) params.set("vendor_id", vendorFilter);
      if (jobFilter) params.set("job_id", jobFilter);
      const res = await fetch(`/api/cost-intelligence/scope-data?${params.toString()}`);
      if (!res.ok) throw new Error(`Load failed: ${res.status}`);
      const json: ApiResponse = await res.json();
      setData(json);
    } catch (err) {
      toast.error(`Load failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoading(false);
    }
  }, [status, vendorFilter, jobFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const vendors = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of data?.rows ?? []) m.set(r.vendor_id, r.vendor_name);
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const jobs = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of data?.rows ?? []) {
      if (r.job_id && r.job_name) m.set(r.job_id, r.job_name);
    }
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const updateEdit = (row: ScopeRow, patch: Partial<{ value: string; source: string }>) => {
    setEdits((prev) => ({
      ...prev,
      [row.id]: {
        value: prev[row.id]?.value ?? (row.scope_size_value?.toString() ?? ""),
        source: prev[row.id]?.source ?? row.scope_size_source ?? "manual",
        ...patch,
      },
    }));
  };

  const saveRow = async (row: ScopeRow) => {
    const edit = edits[row.id];
    if (!edit) return;
    const num = Number.parseFloat(edit.value);
    if (!Number.isFinite(num) || num <= 0) {
      toast.error("Size must be a positive number");
      return;
    }
    setSavingId(row.id);
    try {
      const res = await fetch(`/api/cost-intelligence/scope-data/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope_size_value: num,
          scope_size_source: edit.source || "manual",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Status ${res.status}`);
      toast.success("Saved");
      setEdits((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      void fetchData();
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setSavingId(null);
    }
  };

  const completePct =
    data && data.total > 0 ? Math.round((data.complete / data.total) * 100) : 0;

  return (
    <AppShell>
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <Link
          href="/cost-intelligence"
          className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--nw-gulf-blue)] uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          ← Cost Intelligence
        </Link>

        <div className="mt-4 mb-5">
          <NwEyebrow tone="accent">Cost Intelligence · Scope Data</NwEyebrow>
          <h1
            className="mt-2 text-[28px] tracking-[-0.02em] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Scope data completion
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Add size metrics to scope pricing so it becomes comparable across vendors.
          </p>
        </div>

        {/* KPI strip */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <KpiCard
            label="Complete"
            value={data ? `${data.complete.toLocaleString()} / ${data.total.toLocaleString()}` : "—"}
            subtext={`${completePct}% have scope size`}
          />
          <KpiCard
            label="Needs enrichment"
            value={data ? data.incomplete.toLocaleString() : "—"}
            subtext="Scope items missing size"
            warn={(data?.incomplete ?? 0) > 0}
          />
          <KpiCard
            label="Average $/metric"
            value="—"
            subtext="Computed on complete rows only"
          />
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="px-3 h-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[12px] text-[var(--text-primary)]"
          >
            <option value="incomplete">Incomplete only</option>
            <option value="complete">Complete only</option>
            <option value="all">All</option>
          </select>
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="px-3 h-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[12px] text-[var(--text-primary)]"
          >
            <option value="">All vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <select
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="px-3 h-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[12px] text-[var(--text-primary)]"
          >
            <option value="">All jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="border border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden">
          <div
            className="grid grid-cols-[minmax(200px,1.6fr)_minmax(140px,1fr)_minmax(140px,1fr)_120px_140px_180px_160px_110px] gap-3 items-center px-3 py-2 border-b border-[var(--border-default)] text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            <span>Item</span>
            <span>Vendor</span>
            <span>Job</span>
            <span className="text-right">Line total</span>
            <span>Metric</span>
            <span>Size value</span>
            <span>Source · $/metric</span>
            <span></span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-[12px] text-[var(--text-tertiary)]">
              Loading…
            </div>
          ) : !data || data.rows.length === 0 ? (
            <div className="p-8 text-center text-[12px] text-[var(--text-tertiary)]">
              No scope pricing rows match these filters.
            </div>
          ) : (
            data.rows.map((row) => {
              const edit = edits[row.id];
              const editing = edit != null;
              const sizeValue = editing ? edit.value : row.scope_size_value?.toString() ?? "";
              const source = editing ? edit.source : row.scope_size_source ?? "manual";
              const sizeNum = Number.parseFloat(sizeValue);
              const pmCents =
                Number.isFinite(sizeNum) && sizeNum > 0
                  ? Math.round(row.total_cents / sizeNum)
                  : null;
              return (
                <div
                  key={row.id}
                  className="grid grid-cols-[minmax(200px,1.6fr)_minmax(140px,1fr)_minmax(140px,1fr)_120px_140px_180px_160px_110px] gap-3 items-center px-3 py-2 border-b border-[var(--border-default)] text-[12px] last:border-b-0 hover:bg-[var(--bg-subtle)]"
                >
                  <div className="min-w-0">
                    <div className="text-[var(--text-primary)] truncate" title={row.item_name}>
                      {row.item_name}
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">
                      {row.item_type ?? "—"}
                      {row.category ? ` · ${row.category}` : ""}
                    </div>
                  </div>
                  <div
                    className="text-[var(--text-secondary)] truncate"
                    title={row.vendor_name}
                  >
                    {row.vendor_name}
                  </div>
                  <div
                    className="text-[var(--text-secondary)] truncate"
                    title={row.job_name ?? undefined}
                  >
                    {row.job_name ?? "—"}
                  </div>
                  <div
                    className="text-right text-[var(--text-primary)]"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    <NwMoney cents={row.total_cents} size="sm" />
                  </div>
                  <div
                    className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  >
                    {row.scope_size_metric ?? <span className="text-[var(--nw-warn)]">not set</span>}
                  </div>
                  <div>
                    <input
                      list={`scope-metrics-${row.id}`}
                      type="text"
                      inputMode="decimal"
                      value={sizeValue}
                      onChange={(e) => updateEdit(row, { value: e.target.value })}
                      placeholder="—"
                      className="w-full h-[28px] px-2 border border-[var(--border-default)] bg-[var(--bg-card)] text-[12px] text-right text-[var(--text-primary)]"
                      style={{
                        fontFamily: "var(--font-jetbrains-mono)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    />
                    <datalist id={`scope-metrics-${row.id}`}>
                      {COMMON_SCOPE_METRICS.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={source}
                      onChange={(e) => updateEdit(row, { source: e.target.value })}
                      className="h-[26px] px-1 border border-[var(--border-default)] bg-[var(--bg-card)] text-[10px] text-[var(--text-secondary)]"
                      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                    >
                      <option value="manual">Manual</option>
                      <option value="invoice_extraction">Invoice</option>
                      <option value="job_characteristics">Job</option>
                      <option value="daily_log">Daily log</option>
                      <option value="plan_ai">Plan AI</option>
                      <option value="inferred">Inferred</option>
                    </select>
                    {pmCents != null ? (
                      <span
                        className="text-[11px] text-[var(--text-primary)]"
                        style={{
                          fontFamily: "var(--font-jetbrains-mono)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        <NwMoney cents={pmCents} size="sm" />
                      </span>
                    ) : (
                      <NwBadge variant="warning" size="sm">
                        Needed
                      </NwBadge>
                    )}
                  </div>
                  <div>
                    {editing ? (
                      <NwButton
                        variant="primary"
                        size="sm"
                        loading={savingId === row.id}
                        onClick={() => saveRow(row)}
                      >
                        Save
                      </NwButton>
                    ) : (
                      row.per_metric_cents != null && (
                        <NwBadge variant="success" size="sm">
                          Saved
                        </NwBadge>
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </AppShell>
  );
}

function KpiCard({
  label,
  value,
  subtext,
  warn,
}: {
  label: string;
  value: string;
  subtext: string;
  warn?: boolean;
}) {
  return (
    <div className="border border-[var(--border-default)] bg-[var(--bg-card)] p-3">
      <div
        className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        {label}
      </div>
      <div
        className={`mt-1 text-[20px] ${warn ? "text-[var(--nw-warn)]" : "text-[var(--text-primary)]"}`}
        style={{ fontFamily: "var(--font-space-grotesk)", fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">{subtext}</div>
    </div>
  );
}
