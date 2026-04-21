"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/app-shell";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwButton from "@/components/nw/Button";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/lib/utils/toast";

type SuggestionRow = {
  id: string;
  item_id: string;
  from_unit: string;
  to_unit: string;
  suggested_ratio: number;
  ai_reasoning: string | null;
  ai_confidence: number | null;
  status: "pending" | "confirmed" | "rejected" | "superseded";
  confirmed_at: string | null;
  confirmed_ratio: number | null;
  notes: string | null;
  created_at: string;
  items: { id: string; canonical_name: string; canonical_unit: string } | null;
};

type StatusFilter = "pending" | "confirmed" | "rejected" | "all";

export default function UnitConversionsPage() {
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [itemFilter, setItemFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingRatio, setEditingRatio] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("unit_conversion_suggestions")
      .select(
        "id, item_id, from_unit, to_unit, suggested_ratio, ai_reasoning, ai_confidence, status, confirmed_at, confirmed_ratio, notes, created_at, items(id, canonical_name, canonical_unit)"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);

    if (statusFilter !== "all") {
      q = q.eq("status", statusFilter);
    }

    const { data } = await q;
    setSuggestions((data ?? []) as unknown as SuggestionRow[]);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const items = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of suggestions) {
      if (s.items) m.set(s.items.id, s.items.canonical_name);
    }
    return Array.from(m.entries()).sort(([, a], [, b]) => a.localeCompare(b));
  }, [suggestions]);

  const filtered = useMemo(() => {
    if (!itemFilter) return suggestions;
    return suggestions.filter((s) => s.item_id === itemFilter);
  }, [suggestions, itemFilter]);

  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return {
      pending: suggestions.filter((s) => s.status === "pending").length,
      confirmedThisMonth: suggestions.filter(
        (s) => s.status === "confirmed" && (s.confirmed_at ?? "") >= monthStart
      ).length,
      rejectedThisMonth: suggestions.filter(
        (s) => s.status === "rejected" && (s.confirmed_at ?? s.created_at) >= monthStart
      ).length,
    };
  }, [suggestions]);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const withBusy = useCallback(async (id: string, fn: () => Promise<void>) => {
    setBusy((prev) => new Set(prev).add(id));
    try {
      await fn();
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const confirm = useCallback(
    (s: SuggestionRow, overrideRatio?: number) => {
      return withBusy(s.id, async () => {
        const res = await fetch(`/api/cost-intelligence/conversions/${s.id}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(overrideRatio != null ? { ratio: overrideRatio } : {}),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(`Confirm failed: ${err.error ?? res.status}`);
          return;
        }
        toast.success(`Confirmed conversion for ${s.items?.canonical_name ?? "item"}`);
        await fetchData();
      });
    },
    [fetchData, withBusy]
  );

  const reject = useCallback(
    (s: SuggestionRow) => {
      return withBusy(s.id, async () => {
        const res = await fetch(`/api/cost-intelligence/conversions/${s.id}/reject`, {
          method: "POST",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(`Reject failed: ${err.error ?? res.status}`);
          return;
        }
        toast.success("Rejected");
        await fetchData();
      });
    },
    [fetchData, withBusy]
  );

  return (
    <AppShell>
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <Link
          href="/cost-intelligence"
          className="text-[11px] text-[var(--text-tertiary)] hover:text-nw-gulf-blue uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          ← Cost Intelligence
        </Link>

        <div className="mt-4 mb-6">
          <NwEyebrow tone="accent">Cost Intelligence · Unit Conversions</NwEyebrow>
          <h1
            className="mt-2 text-[28px] tracking-[-0.02em] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Unit Conversion Suggestions
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)] max-w-[680px]">
            Confirm AI-suggested conversions so every invoice price gets normalized into the
            item&apos;s canonical unit. Rejected suggestions leave existing rows unchanged.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Kpi label="Pending" value={kpis.pending.toLocaleString("en-US")} warn={kpis.pending > 0} />
          <Kpi label="Confirmed this month" value={kpis.confirmedThisMonth.toLocaleString("en-US")} />
          <Kpi label="Rejected this month" value={kpis.rejectedThisMonth.toLocaleString("en-US")} />
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
          >
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="rejected">Rejected</option>
            <option value="all">All statuses</option>
          </select>
          <select
            value={itemFilter}
            onChange={(e) => setItemFilter(e.target.value)}
            className="px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
          >
            <option value="">All items</option>
            {items.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="border border-[var(--border-default)] bg-[var(--bg-card)]">
          <table className="w-full text-[12px]">
            <thead
              className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              <tr className="border-b border-[var(--border-default)]">
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Item</th>
                <th className="text-left px-3 py-2 font-medium">Suggestion</th>
                <th className="text-right px-3 py-2 font-medium">Confidence</th>
                <th className="text-right px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[var(--text-tertiary)]">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[var(--text-tertiary)]">
                    {statusFilter === "pending"
                      ? "No pending suggestions. The system proposes conversions when an invoice uses a different unit than an item's canonical."
                      : "No suggestions match your filters."}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const isExpanded = expanded.has(s.id);
                  const confidence = s.ai_confidence ?? 0;
                  const confVariant =
                    confidence >= 0.85 ? "success" : confidence >= 0.7 ? "accent" : "warning";
                  const currentEdit = editingRatio[s.id];
                  const isBusy = busy.has(s.id);
                  return (
                    <>
                      <tr
                        key={s.id}
                        className="border-b border-[var(--border-default)] last:border-b-0 hover:bg-[var(--bg-subtle)]"
                      >
                        <td
                          className="px-3 py-2 text-[var(--text-tertiary)]"
                          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                        >
                          {new Date(s.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2">
                          {s.items ? (
                            <Link
                              href={`/cost-intelligence/items/${s.item_id}`}
                              className="text-[var(--text-primary)] hover:text-nw-gulf-blue hover:underline font-medium"
                            >
                              {s.items.canonical_name}
                            </Link>
                          ) : (
                            "(unknown)"
                          )}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-primary)]">
                          <span
                            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                            className="text-[13px]"
                          >
                            1 {s.from_unit} = {formatRatio(s.suggested_ratio)} {s.to_unit}
                          </span>
                          {s.ai_reasoning && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(s.id)}
                              className="ml-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                            >
                              {isExpanded ? "Hide" : "Why?"}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <NwBadge variant={confVariant} size="sm">
                            {Math.round(confidence * 100)}%
                          </NwBadge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {s.status === "pending" ? (
                            <div className="inline-flex items-center gap-2">
                              <input
                                type="number"
                                step="0.0001"
                                placeholder={String(s.suggested_ratio)}
                                value={currentEdit ?? ""}
                                onChange={(e) =>
                                  setEditingRatio((prev) => ({
                                    ...prev,
                                    [s.id]: e.target.value,
                                  }))
                                }
                                className="w-[90px] px-2 h-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[12px] text-[var(--text-primary)]"
                                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                              />
                              <NwButton
                                size="sm"
                                variant="primary"
                                loading={isBusy}
                                onClick={() => {
                                  const override = currentEdit ? Number(currentEdit) : undefined;
                                  const ratio = override && Number.isFinite(override) && override > 0 ? override : undefined;
                                  void confirm(s, ratio);
                                }}
                              >
                                {currentEdit ? "Save" : "Confirm"}
                              </NwButton>
                              <NwButton
                                size="sm"
                                variant="ghost"
                                loading={isBusy}
                                onClick={() => void reject(s)}
                              >
                                Reject
                              </NwButton>
                            </div>
                          ) : (
                            <NwBadge
                              variant={
                                s.status === "confirmed"
                                  ? "success"
                                  : s.status === "rejected"
                                  ? "danger"
                                  : "neutral"
                              }
                              size="sm"
                            >
                              {s.status}
                              {s.status === "confirmed" && s.confirmed_ratio != null
                                ? ` · ${formatRatio(s.confirmed_ratio)}`
                                : ""}
                            </NwBadge>
                          )}
                        </td>
                      </tr>
                      {isExpanded && s.ai_reasoning && (
                        <tr
                          key={`${s.id}-exp`}
                          className="border-b border-[var(--border-default)] last:border-b-0 bg-[var(--bg-subtle)]"
                        >
                          <td colSpan={5} className="px-4 py-3">
                            <div
                              className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                            >
                              AI reasoning
                            </div>
                            <p className="mt-1 text-[12px] text-[var(--text-secondary)] italic">
                              {s.ai_reasoning}
                            </p>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}

function Kpi({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div
      className="border p-4"
      style={{
        borderColor: warn ? "var(--nw-warning)" : "var(--border-default)",
        background: "var(--bg-card)",
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-[22px] text-[var(--text-primary)]"
        style={{ fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "-0.02em" }}
      >
        {value}
      </div>
    </div>
  );
}

function formatRatio(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(n < 1 ? 4 : 2);
}
