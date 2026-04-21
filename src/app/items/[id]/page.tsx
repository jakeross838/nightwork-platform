"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/app-shell";
import FinancialViewTabs from "@/components/financial-view-tabs";
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
  specs: Record<string, unknown> | null;
  ai_confidence: number | null;
  human_verified: boolean;
  created_at: string;
  default_cost_code: { id: string; code: string; description: string } | null;
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
  job_id: string | null;
  source_type: string;
  transaction_date: string;
  ai_confidence: number | null;
  created_via: string | null;
  human_verified: boolean;
  auto_committed: boolean;
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

export default function ItemDetailPage() {
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

  // Vendor breakdown (avg unit price, last txn date)
  const vendorBreakdown = useMemo(() => {
    if (!data) return [];
    type Breakdown = {
      vendor_id: string;
      vendor_name: string;
      count: number;
      total_cents: number;
      total_qty: number;
      last_txn: string | null;
      avg_unit_cents: number;
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
          last_txn: null,
          avg_unit_cents: 0,
        });
      }
      const b = map.get(vId)!;
      b.count++;
      b.total_cents += p.total_cents ?? 0;
      b.total_qty += Number(p.quantity ?? 0);
      if (!b.last_txn || p.transaction_date > b.last_txn) b.last_txn = p.transaction_date;
    }
    return Array.from(map.values())
      .map((b) => ({
        ...b,
        avg_unit_cents: b.total_qty > 0 ? Math.round(b.total_cents / b.total_qty) : b.total_cents / Math.max(1, b.count),
      }))
      .sort((a, b) => b.total_cents - a.total_cents);
  }, [data]);

  if (loading) {
    return (
      <AppShell>
        <main className="max-w-[1400px] mx-auto px-6 py-8">
          <FinancialViewTabs active="items" />
          <p className="text-[13px] text-[var(--text-tertiary)]">Loading…</p>
        </main>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <main className="max-w-[1400px] mx-auto px-6 py-8">
          <FinancialViewTabs active="items" />
          <div className="border border-nw-danger/40 p-4 text-[13px] text-nw-danger">
            Load failed: {error ?? "Unknown error"}
          </div>
          <div className="mt-3">
            <Link href="/items" className="text-[11px] text-nw-gulf-blue hover:underline">
              ← Back to items
            </Link>
          </div>
        </main>
      </AppShell>
    );
  }

  const { item, aliases, pricing, job_activity } = data;

  return (
    <AppShell>
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <FinancialViewTabs active="items" />

        <Link
          href="/items"
          className="text-[11px] text-[var(--text-tertiary)] hover:text-nw-gulf-blue uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          ← All items
        </Link>

        {/* Header */}
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
              <NwBadge variant="neutral" size="sm">
                unit · {item.unit}
              </NwBadge>
              {item.human_verified ? (
                <NwBadge variant="success" size="sm">
                  human verified
                </NwBadge>
              ) : (
                <NwBadge variant="warning" size="sm">
                  unverified
                </NwBadge>
              )}
              {item.ai_confidence != null && (
                <NwBadge variant="info" size="sm">
                  AI {Math.round(item.ai_confidence * 100)}%
                </NwBadge>
              )}
              {item.default_cost_code && (
                <NwBadge variant="accent" size="sm">
                  {item.default_cost_code.code}
                </NwBadge>
              )}
            </div>
          </div>
        </div>

        {/* Grid layout */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Vendor breakdown */}
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
                    <th className="text-right px-4 py-2 font-medium">Avg unit</th>
                    <th className="text-right px-4 py-2 font-medium">Txns</th>
                    <th className="text-right px-4 py-2 font-medium">Total</th>
                    <th className="text-left px-4 py-2 font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorBreakdown.map((b) => (
                    <tr key={b.vendor_id} className="border-b border-[var(--border-default)] last:border-b-0">
                      <td className="px-4 py-2 text-[var(--text-primary)]">{b.vendor_name}</td>
                      <td className="px-4 py-2 text-right">
                        <NwMoney cents={b.avg_unit_cents} size="sm" />
                      </td>
                      <td
                        className="px-4 py-2 text-right text-[var(--text-secondary)]"
                        style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
                      >
                        {b.count}
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

          {/* Aliases */}
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
                        style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
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
                    <th className="text-right px-4 py-2 font-medium">Qty</th>
                    <th className="text-right px-4 py-2 font-medium">Unit price</th>
                    <th className="text-right px-4 py-2 font-medium">Total</th>
                    <th className="text-left px-4 py-2 font-medium">Source</th>
                    <th className="text-left px-4 py-2 font-medium">Provenance</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.map((p) => (
                    <tr key={p.id} className="border-b border-[var(--border-default)] last:border-b-0">
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
                        style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
                      >
                        {p.quantity} {p.unit}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <NwMoney cents={p.unit_price_cents} size="sm" />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <NwMoney cents={p.total_cents} size="sm" />
                      </td>
                      <td className="px-4 py-2 text-[var(--text-tertiary)]">{p.source_type}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1 flex-wrap">
                          {p.created_via && (
                            <NwBadge variant="neutral" size="sm">
                              {p.created_via.replace(/_/g, " ")}
                            </NwBadge>
                          )}
                          {p.human_verified ? (
                            <NwBadge variant="success" size="sm">
                              verified
                            </NwBadge>
                          ) : p.auto_committed ? (
                            <NwBadge variant="warning" size="sm">
                              auto
                            </NwBadge>
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
                      style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
                    >
                      {j.planned_quantity ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <NwMoney cents={j.planned_total_cents} size="sm" />
                    </td>
                    <td
                      className="px-4 py-2 text-right text-[var(--text-secondary)]"
                      style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
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
