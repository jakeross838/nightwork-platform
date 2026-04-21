"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/app-shell";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwMoney from "@/components/nw/Money";

type ItemDetail = {
  id: string;
  canonical_name: string;
  description: string | null;
  item_type: string;
  category: string | null;
  subcategory: string | null;
  unit: string;
  canonical_unit: string;
  conversion_rules: Record<string, { ratio: number; notes?: string }> | null;
  specs: Record<string, unknown> | null;
  ai_confidence: number | null;
  human_verified: boolean;
  created_at: string;
  default_cost_code: { id: string; code: string; description: string } | null;
  pricing_model: "unit" | "scope";
  scope_size_metric: string | null;
};

type AliasRow = {
  id: string;
  alias_text: string;
  vendor_id: string | null;
  source_type: string | null;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  vendors: { id: string; name: string } | null;
};

type PricingRow = {
  id: string;
  vendor_id: string;
  unit_price_cents: number;
  quantity: number;
  total_cents: number;
  unit: string;
  observed_unit: string | null;
  observed_unit_price_cents: number | null;
  canonical_unit_price_cents: number | null;
  conversion_applied: { from_unit: string; to_unit: string; ratio: number; source: string } | null;
  job_id: string | null;
  source_type: string;
  transaction_date: string;
  ai_confidence: number | null;
  created_via: string | null;
  human_verified: boolean;
  auto_committed: boolean;
  scope_size_value: number | null;
  scope_size_source: string | null;
  scope_size_confidence: number | null;
  scope_size_notes: string | null;
  vendors: { id: string; name: string } | null;
  jobs: { id: string; name: string } | null;
};

type JobActivity = {
  id: string;
  job_id: string;
  planned_quantity: number | null;
  planned_total_cents: number | null;
  actual_quantity: number | null;
  actual_total_cents: number | null;
  status: string;
  first_purchase_date: string | null;
  last_purchase_date: string | null;
  jobs: { id: string; name: string } | null;
};

interface FetchResult {
  item: ItemDetail;
  aliases: AliasRow[];
  pricing: PricingRow[];
  job_activity: JobActivity[];
}

export default function CostIntelligenceItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<FetchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cost-intelligence/items/${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Status ${res.status}`);
      }
      const json = (await res.json()) as FetchResult;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const vendorBreakdown = useMemo(() => {
    if (!data) return [];
    const isScope = data.item.pricing_model === "scope";
    type Breakdown = {
      vendor_id: string;
      vendor_name: string;
      count: number;
      total_cents: number;
      total_qty: number;
      total_canonical_qty: number;
      last_txn: string | null;
      avg_unit_cents: number;
      avg_canonical_unit_cents: number;
      // Scope-specific
      scope_total_cents: number;
      scope_total_size: number;
      scope_rows_with_size: number;
      scope_rows_missing_size: number;
      avg_per_metric_cents: number | null;
    };
    const map = new Map<string, Breakdown>();
    for (const p of data.pricing) {
      const vId = p.vendor_id;
      const vName = p.vendors?.name ?? "(unknown vendor)";
      if (!map.has(vId)) {
        map.set(vId, {
          vendor_id: vId,
          vendor_name: vName,
          count: 0,
          total_cents: 0,
          total_qty: 0,
          total_canonical_qty: 0,
          last_txn: null,
          avg_unit_cents: 0,
          avg_canonical_unit_cents: 0,
          scope_total_cents: 0,
          scope_total_size: 0,
          scope_rows_with_size: 0,
          scope_rows_missing_size: 0,
          avg_per_metric_cents: null,
        });
      }
      const b = map.get(vId)!;
      b.count++;
      b.total_cents += p.total_cents ?? 0;
      b.total_qty += Number(p.quantity ?? 0);
      const canonicalPrice = p.canonical_unit_price_cents ?? p.unit_price_cents ?? 0;
      const ratio = p.conversion_applied?.ratio ?? 1;
      b.total_canonical_qty += Number(p.quantity ?? 0) * (Number.isFinite(ratio) && ratio > 0 ? ratio : 1);
      void canonicalPrice;
      if (!b.last_txn || p.transaction_date > b.last_txn) b.last_txn = p.transaction_date;

      if (isScope) {
        if (p.scope_size_value != null && p.scope_size_value > 0) {
          b.scope_total_cents += p.total_cents ?? 0;
          b.scope_total_size += Number(p.scope_size_value);
          b.scope_rows_with_size++;
        } else {
          b.scope_rows_missing_size++;
        }
      }
    }
    return Array.from(map.values())
      .map((b) => ({
        ...b,
        avg_unit_cents:
          b.total_qty > 0
            ? Math.round(b.total_cents / b.total_qty)
            : b.total_cents / Math.max(1, b.count),
        avg_canonical_unit_cents:
          b.total_canonical_qty > 0
            ? Math.round(b.total_cents / b.total_canonical_qty)
            : 0,
        avg_per_metric_cents:
          b.scope_total_size > 0
            ? Math.round(b.scope_total_cents / b.scope_total_size)
            : null,
      }))
      .sort((a, b) => b.total_cents - a.total_cents);
  }, [data]);

  if (loading) {
    return (
      <AppShell>
        <main className="max-w-[1400px] mx-auto px-6 py-8">
          <p className="text-[13px] text-[var(--text-tertiary)]">Loading…</p>
        </main>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <main className="max-w-[1400px] mx-auto px-6 py-8">
          <div className="border border-nw-danger/40 p-4 text-[13px] text-nw-danger">
            Load failed: {error ?? "Unknown error"}
          </div>
          <div className="mt-3">
            <Link href="/cost-intelligence/items" className="text-[11px] text-nw-gulf-blue hover:underline">
              ← Back to items
            </Link>
          </div>
        </main>
      </AppShell>
    );
  }

  const { item, aliases, pricing, job_activity } = data;
  const conversionRules = Object.entries(item.conversion_rules ?? {}) as Array<
    [string, { ratio: number; notes?: string }]
  >;

  return (
    <AppShell>
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <Link
          href="/cost-intelligence/items"
          className="text-[11px] text-[var(--text-tertiary)] hover:text-nw-gulf-blue uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          ← All items
        </Link>

        <div className="mt-4 flex items-start justify-between gap-6">
          <div>
            <NwEyebrow tone="accent">
              {item.item_type}
              {item.category ? ` · ${item.category}` : ""}
              {item.subcategory ? ` · ${item.subcategory}` : ""}
            </NwEyebrow>
            <h1
              className="mt-2 text-[28px] tracking-[-0.02em] text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              {item.canonical_name}
            </h1>
            {item.description ? (
              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{item.description}</p>
            ) : null}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {item.pricing_model === "scope" ? (
                <NwBadge variant="accent" size="sm">
                  scope · {item.scope_size_metric ?? "size needed"}
                </NwBadge>
              ) : (
                <NwBadge variant="neutral" size="sm">
                  unit · {item.canonical_unit}
                </NwBadge>
              )}
              {item.pricing_model === "unit" && item.unit !== item.canonical_unit && (
                <NwBadge variant="neutral" size="sm">
                  legacy unit · {item.unit}
                </NwBadge>
              )}
              {item.human_verified ? (
                <NwBadge variant="success" size="sm">human verified</NwBadge>
              ) : (
                <NwBadge variant="warning" size="sm">unverified</NwBadge>
              )}
              {item.ai_confidence != null && (
                <NwBadge variant="info" size="sm">AI {Math.round(item.ai_confidence * 100)}%</NwBadge>
              )}
              {item.default_cost_code && (
                <NwBadge variant="accent" size="sm">{item.default_cost_code.code}</NwBadge>
              )}
            </div>
          </div>
        </div>

        {/* Grid: vendor breakdown + aliases */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 border border-[var(--border-default)] bg-[var(--bg-card)]">
            <div className="px-4 py-3 border-b border-[var(--border-default)]">
              <NwEyebrow tone="muted">Vendor comparison</NwEyebrow>
            </div>
            {vendorBreakdown.length === 0 ? (
              <p className="p-4 text-[13px] text-[var(--text-tertiary)]">
                No pricing rows yet for this item.
              </p>
            ) : (
              <table className="w-full text-[12px]">
                <thead
                  className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  <tr className="border-b border-[var(--border-default)]">
                    <th className="text-left px-4 py-2 font-medium">Vendor</th>
                    <th className="text-right px-4 py-2 font-medium">
                      {item.pricing_model === "scope"
                        ? `Avg / ${item.scope_size_metric ?? "size"}`
                        : `Avg / ${item.canonical_unit}`}
                    </th>
                    <th className="text-right px-4 py-2 font-medium">Txns</th>
                    <th className="text-right px-4 py-2 font-medium">Total</th>
                    <th className="text-left px-4 py-2 font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorBreakdown.map((b) => (
                    <tr
                      key={b.vendor_id}
                      className="border-b border-[var(--border-default)] last:border-b-0"
                    >
                      <td className="px-4 py-2 text-[var(--text-primary)]">{b.vendor_name}</td>
                      <td className="px-4 py-2 text-right">
                        {item.pricing_model === "scope" ? (
                          b.avg_per_metric_cents != null ? (
                            <NwMoney cents={b.avg_per_metric_cents} size="sm" />
                          ) : (
                            <span className="text-[var(--nw-warn)] text-[11px]">size needed</span>
                          )
                        ) : (
                          <NwMoney
                            cents={b.avg_canonical_unit_cents || b.avg_unit_cents}
                            size="sm"
                          />
                        )}
                      </td>
                      <td
                        className="px-4 py-2 text-right text-[var(--text-secondary)]"
                        style={{
                          fontFamily: "var(--font-jetbrains-mono)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {item.pricing_model === "scope" ? (
                          <>
                            {b.scope_rows_with_size}/{b.count}
                            {b.scope_rows_missing_size > 0 && (
                              <span className="text-[var(--nw-warn)]"> ·!</span>
                            )}
                          </>
                        ) : (
                          b.count
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <NwMoney cents={b.total_cents} size="sm" />
                      </td>
                      <td
                        className="px-4 py-2 text-[var(--text-tertiary)]"
                        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                      >
                        {b.last_txn ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="border border-[var(--border-default)] bg-[var(--bg-card)]">
            <div className="px-4 py-3 border-b border-[var(--border-default)]">
              <NwEyebrow tone="muted">Aliases ({aliases.length})</NwEyebrow>
            </div>
            {aliases.length === 0 ? (
              <p className="p-4 text-[13px] text-[var(--text-tertiary)]">No aliases recorded.</p>
            ) : (
              <ul className="divide-y divide-[var(--border-default)]">
                {aliases.slice(0, 20).map((a) => (
                  <li key={a.id} className="px-4 py-2 text-[12px]">
                    <p
                      className="text-[var(--text-primary)]"
                      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                    >
                      &ldquo;{a.alias_text}&rdquo;
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
                      <span>{a.vendors?.name ?? "Any vendor"}</span>
                      <span>·</span>
                      <span
                        style={{
                          fontFamily: "var(--font-jetbrains-mono)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {a.occurrence_count}×
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Unit Conversions section */}
        <section className="mt-6 border border-[var(--border-default)] bg-[var(--bg-card)]">
          <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between gap-3">
            <NwEyebrow tone="muted">Unit Conversions</NwEyebrow>
            <Link
              href="/cost-intelligence/conversions"
              className="text-[10px] uppercase tracking-[0.12em] text-nw-gulf-blue hover:underline"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              All pending conversions →
            </Link>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <div
                className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                Canonical unit
              </div>
              <div
                className="mt-1 text-[15px] text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                {item.canonical_unit}
              </div>
            </div>
            <div>
              <div
                className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                Conversion rules
              </div>
              {conversionRules.length === 0 ? (
                <p className="mt-2 text-[13px] text-[var(--text-tertiary)]">
                  No conversion rules yet. Rules are added automatically when you confirm AI
                  suggestions, or manually on this page (coming soon).
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-[var(--border-default)]">
                  {conversionRules.map(([fromUnit, rule]) => (
                    <li key={fromUnit} className="py-2 text-[13px]">
                      <span
                        className="text-[var(--text-primary)]"
                        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                      >
                        1 {fromUnit} = {rule.ratio} {item.canonical_unit}
                      </span>
                      {rule.notes && (
                        <span className="ml-2 text-[var(--text-tertiary)] italic">
                          {rule.notes}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Pricing history */}
        <div className="mt-6 border border-[var(--border-default)] bg-[var(--bg-card)]">
          <div className="px-4 py-3 border-b border-[var(--border-default)]">
            <NwEyebrow tone="muted">Pricing history ({pricing.length})</NwEyebrow>
          </div>
          {pricing.length === 0 ? (
            <p className="p-4 text-[13px] text-[var(--text-tertiary)]">No pricing rows.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead
                  className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  <tr className="border-b border-[var(--border-default)]">
                    <th className="text-left px-4 py-2 font-medium">Date</th>
                    <th className="text-left px-4 py-2 font-medium">Vendor</th>
                    <th className="text-left px-4 py-2 font-medium">Job</th>
                    <th className="text-right px-4 py-2 font-medium">Observed</th>
                    <th className="text-right px-4 py-2 font-medium">
                      Price / {item.canonical_unit}
                    </th>
                    <th className="text-right px-4 py-2 font-medium">Total</th>
                    <th className="text-left px-4 py-2 font-medium">Conversion</th>
                    <th className="text-left px-4 py-2 font-medium">Provenance</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-[var(--border-default)] last:border-b-0"
                    >
                      <td
                        className="px-4 py-2 text-[var(--text-secondary)]"
                        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                      >
                        {p.transaction_date}
                      </td>
                      <td className="px-4 py-2 text-[var(--text-primary)]">
                        {p.vendors?.name ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-[var(--text-secondary)]">
                        {p.jobs?.name ?? "—"}
                      </td>
                      <td
                        className="px-4 py-2 text-right text-[var(--text-secondary)]"
                        style={{
                          fontFamily: "var(--font-jetbrains-mono)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {p.quantity} {p.observed_unit ?? p.unit}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <NwMoney
                          cents={p.canonical_unit_price_cents ?? p.unit_price_cents}
                          size="sm"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <NwMoney cents={p.total_cents} size="sm" />
                      </td>
                      <td className="px-4 py-2 text-[var(--text-tertiary)]">
                        {p.conversion_applied ? (
                          <span
                            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                            className="text-[11px]"
                          >
                            {p.conversion_applied.source === "same_unit"
                              ? "—"
                              : `×${p.conversion_applied.ratio} ${p.conversion_applied.source}`}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1 flex-wrap">
                          {p.created_via && (
                            <NwBadge variant="neutral" size="sm">
                              {p.created_via.replace(/_/g, " ")}
                            </NwBadge>
                          )}
                          {p.human_verified ? (
                            <NwBadge variant="success" size="sm">verified</NwBadge>
                          ) : p.auto_committed ? (
                            <NwBadge variant="warning" size="sm">auto</NwBadge>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Job usage */}
        {job_activity.length > 0 && (
          <div className="mt-6 border border-[var(--border-default)] bg-[var(--bg-card)]">
            <div className="px-4 py-3 border-b border-[var(--border-default)]">
              <NwEyebrow tone="muted">Job usage ({job_activity.length})</NwEyebrow>
            </div>
            <table className="w-full text-[12px]">
              <thead
                className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                <tr className="border-b border-[var(--border-default)]">
                  <th className="text-left px-4 py-2 font-medium">Job</th>
                  <th className="text-right px-4 py-2 font-medium">Planned qty</th>
                  <th className="text-right px-4 py-2 font-medium">Planned total</th>
                  <th className="text-right px-4 py-2 font-medium">Actual qty</th>
                  <th className="text-right px-4 py-2 font-medium">Actual total</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {job_activity.map((j) => (
                  <tr key={j.id} className="border-b border-[var(--border-default)] last:border-b-0">
                    <td className="px-4 py-2 text-[var(--text-primary)]">
                      {j.jobs?.name ?? "(unknown)"}
                    </td>
                    <td
                      className="px-4 py-2 text-right text-[var(--text-secondary)]"
                      style={{
                        fontFamily: "var(--font-jetbrains-mono)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {j.planned_quantity ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <NwMoney cents={j.planned_total_cents} size="sm" />
                    </td>
                    <td
                      className="px-4 py-2 text-right text-[var(--text-secondary)]"
                      style={{
                        fontFamily: "var(--font-jetbrains-mono)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {j.actual_quantity ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <NwMoney cents={j.actual_total_cents} size="sm" />
                    </td>
                    <td className="px-4 py-2">
                      <NwBadge variant="neutral" size="sm">
                        {j.status.replace(/_/g, " ")}
                      </NwBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppShell>
  );
}
