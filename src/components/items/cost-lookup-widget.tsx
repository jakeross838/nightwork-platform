"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwMoney from "@/components/nw/Money";

type ItemSearchResult = {
  id: string;
  canonical_name: string;
  item_type: string;
  category: string | null;
  unit: string;
};

type VendorComparison = {
  vendor_id: string;
  vendor_name: string;
  txn_count: number;
  total_cents: number;
  landed_total_cents: number;
  avg_unit_cents: number;
  avg_unit_landed_cents: number;
  avg_canonical_unit_cents: number;
  /** Scope items only: total_cents / sum(scope_size_value) across this vendor's rows with size. */
  avg_per_metric_cents: number | null;
  rows_with_scope_size: number;
  last_txn: string | null;
};

type PriceMode = "canonical" | "landed";

type PriceTrendPoint = {
  date: string;
  unit_price_cents: number;
  vendor: string;
};

export default function CostLookupWidget() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ItemSearchResult[]>([]);
  const [selected, setSelected] = useState<ItemSearchResult | null>(null);
  const [comparison, setComparison] = useState<VendorComparison[]>([]);
  const [trend, setTrend] = useState<PriceTrendPoint[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [priceMode, setPriceMode] = useState<PriceMode>("canonical");
  const [canonicalUnit, setCanonicalUnit] = useState<string | null>(null);
  const [pricingModel, setPricingModel] = useState<"unit" | "scope">("unit");
  const [scopeSizeMetric, setScopeSizeMetric] = useState<string | null>(null);

  const runSearch = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const res = await fetch(`/api/cost-intelligence/items?q=${encodeURIComponent(q)}&limit=15`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = await res.json();
      setResults(json.items ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim().length >= 2) {
        void runSearch(query.trim());
      } else {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  const loadItemDetail = useCallback(async (item: ItemSearchResult) => {
    setSelected(item);
    setLoadingDetail(true);
    setComparison([]);
    setTrend([]);
    try {
      const res = await fetch(`/api/cost-intelligence/items/${item.id}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      type PricingRow = {
        vendor_id: string;
        unit_price_cents: number;
        quantity: number;
        total_cents: number;
        canonical_quantity?: number | null;
        canonical_unit_price_cents?: number | null;
        tax_cents?: number | null;
        overhead_allocated_cents?: number | null;
        landed_total_cents?: number | null;
        scope_size_value?: number | null;
        transaction_date: string;
        vendors: { name: string } | null;
      };
      const json = (await res.json()) as {
        item?: {
          canonical_unit?: string | null;
          pricing_model?: "unit" | "scope";
          scope_size_metric?: string | null;
        };
        pricing: PricingRow[];
      };
      setCanonicalUnit(json.item?.canonical_unit ?? null);
      const itemPricingModel: "unit" | "scope" =
        json.item?.pricing_model === "scope" ? "scope" : "unit";
      setPricingModel(itemPricingModel);
      setScopeSizeMetric(json.item?.scope_size_metric ?? null);
      const rows = json.pricing ?? [];

      const map = new Map<
        string,
        VendorComparison & {
          total_qty: number;
          total_canonical_qty: number;
          scope_total_cents: number;
          scope_total_size: number;
        }
      >();
      for (const r of rows) {
        const key = r.vendor_id;
        if (!map.has(key)) {
          map.set(key, {
            vendor_id: key,
            vendor_name: r.vendors?.name ?? "(unknown)",
            txn_count: 0,
            total_cents: 0,
            landed_total_cents: 0,
            total_qty: 0,
            total_canonical_qty: 0,
            avg_unit_cents: 0,
            avg_unit_landed_cents: 0,
            avg_canonical_unit_cents: 0,
            avg_per_metric_cents: null,
            rows_with_scope_size: 0,
            scope_total_cents: 0,
            scope_total_size: 0,
            last_txn: null,
          });
        }
        const b = map.get(key)!;
        b.txn_count++;
        const pretax = r.total_cents ?? 0;
        const landed =
          r.landed_total_cents ??
          pretax + (r.tax_cents ?? 0) + (r.overhead_allocated_cents ?? 0);
        b.total_cents += pretax;
        b.landed_total_cents += landed;
        b.total_qty += Number(r.quantity ?? 0);
        b.total_canonical_qty += Number(r.canonical_quantity ?? r.quantity ?? 0);
        if (r.scope_size_value != null && r.scope_size_value > 0) {
          b.scope_total_cents += pretax;
          b.scope_total_size += Number(r.scope_size_value);
          b.rows_with_scope_size++;
        }
        if (!b.last_txn || r.transaction_date > b.last_txn) b.last_txn = r.transaction_date;
      }

      const comp: VendorComparison[] = Array.from(map.values())
        .map((b) => ({
          vendor_id: b.vendor_id,
          vendor_name: b.vendor_name,
          txn_count: b.txn_count,
          total_cents: b.total_cents,
          landed_total_cents: b.landed_total_cents,
          avg_unit_cents:
            b.total_qty > 0
              ? Math.round(b.total_cents / b.total_qty)
              : Math.round(b.total_cents / Math.max(1, b.txn_count)),
          avg_unit_landed_cents:
            b.total_qty > 0
              ? Math.round(b.landed_total_cents / b.total_qty)
              : Math.round(b.landed_total_cents / Math.max(1, b.txn_count)),
          avg_canonical_unit_cents:
            b.total_canonical_qty > 0
              ? Math.round(b.total_cents / b.total_canonical_qty)
              : Math.round(b.total_cents / Math.max(1, b.txn_count)),
          avg_per_metric_cents:
            b.scope_total_size > 0
              ? Math.round(b.scope_total_cents / b.scope_total_size)
              : null,
          rows_with_scope_size: b.rows_with_scope_size,
          last_txn: b.last_txn,
        }))
        .sort((a, b) => {
          if (itemPricingModel === "scope") {
            const av = a.avg_per_metric_cents ?? Number.MAX_SAFE_INTEGER;
            const bv = b.avg_per_metric_cents ?? Number.MAX_SAFE_INTEGER;
            return av - bv;
          }
          return a.avg_canonical_unit_cents - b.avg_canonical_unit_cents;
        });
      setComparison(comp);

      // Price trend (chronological) — canonical unit price
      setTrend(
        rows
          .slice()
          .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
          .map((r) => ({
            date: r.transaction_date,
            unit_price_cents: Math.round(
              r.canonical_unit_price_cents ?? r.unit_price_cents ?? 0
            ),
            vendor: r.vendors?.name ?? "—",
          }))
      );
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(null);
    setComparison([]);
    setTrend([]);
  }, []);

  return (
    <section className="border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <NwEyebrow tone="accent">Cost Lookup</NwEyebrow>
          <h2
            className="mt-1 text-[18px] tracking-[-0.02em] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Compare vendor pricing
          </h2>
        </div>
        {selected ? (
          <button
            type="button"
            className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            onClick={clearSelection}
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder="Search an item (e.g. 2x4 lumber, framing labor, drywall)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-3 h-[40px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
        />
        {query.trim().length >= 2 && !selected ? (
          <div className="absolute top-full left-0 right-0 mt-1 border border-[var(--border-default)] bg-[var(--bg-card)] max-h-[240px] overflow-auto z-10 divide-y divide-[var(--border-default)]">
            {searching ? (
              <p className="p-3 text-[12px] text-[var(--text-tertiary)]">Searching…</p>
            ) : results.length === 0 ? (
              <p className="p-3 text-[12px] text-[var(--text-tertiary)]">No matches.</p>
            ) : (
              results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => loadItemDetail(r)}
                  className="w-full text-left p-2 hover:bg-[var(--bg-subtle)]"
                >
                  <div className="text-[13px] text-[var(--text-primary)] font-medium">
                    {r.canonical_name}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                    {r.item_type}
                    {r.category ? ` · ${r.category}` : ""}
                    {r.unit ? ` · unit ${r.unit}` : ""}
                  </div>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      {selected ? (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
              <Link
                href={`/cost-intelligence/items/${selected.id}`}
                className="text-[16px] font-medium text-[var(--text-primary)] hover:text-nw-gulf-blue hover:underline"
              >
                {selected.canonical_name}
              </Link>
              <div className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                {selected.item_type}
                {selected.category ? ` · ${selected.category}` : ""}
                {selected.unit ? ` · unit ${selected.unit}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {comparison.length > 0 ? (
                <NwBadge variant="accent" size="sm">
                  {comparison.length} vendor{comparison.length === 1 ? "" : "s"}
                </NwBadge>
              ) : null}
              <div
                className="inline-flex items-center border border-[var(--border-default)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                <button
                  type="button"
                  onClick={() => setPriceMode("canonical")}
                  className={`px-2 h-[26px] text-[10px] uppercase tracking-[0.12em] ${
                    priceMode === "canonical"
                      ? "bg-nw-stone-blue text-nw-white-sand"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Canonical{canonicalUnit ? ` · ${canonicalUnit}` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setPriceMode("landed")}
                  className={`px-2 h-[26px] text-[10px] uppercase tracking-[0.12em] border-l border-[var(--border-default)] ${
                    priceMode === "landed"
                      ? "bg-nw-stone-blue text-nw-white-sand"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Landed
                </button>
              </div>
            </div>
          </div>

          {loadingDetail ? (
            <p className="text-[13px] text-[var(--text-tertiary)]">Loading pricing…</p>
          ) : comparison.length === 0 ? (
            <p className="text-[13px] text-[var(--text-tertiary)]">
              No pricing rows yet. Verify extraction lines to populate this item.
            </p>
          ) : (
            <>
              {/* Vendor comparison table */}
              <div className="border border-[var(--border-default)]">
                <table className="w-full text-[12px]">
                  <thead
                    className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  >
                    <tr className="border-b border-[var(--border-default)]">
                      <th className="text-left px-3 py-2 font-medium">Vendor</th>
                      <th className="text-right px-3 py-2 font-medium">
                        {pricingModel === "scope"
                          ? `Avg / ${scopeSizeMetric ?? "size"}`
                          : "Avg unit"}
                      </th>
                      <th className="text-right px-3 py-2 font-medium">Txns</th>
                      <th className="text-right px-3 py-2 font-medium">Total</th>
                      <th className="text-left px-3 py-2 font-medium">Last</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((b, i) => {
                      const unitCents =
                        pricingModel === "scope"
                          ? b.avg_per_metric_cents
                          : priceMode === "landed"
                          ? b.avg_unit_landed_cents
                          : b.avg_canonical_unit_cents;
                      const totalCents =
                        priceMode === "landed" ? b.landed_total_cents : b.total_cents;
                      const isScopeIncomplete =
                        pricingModel === "scope" && b.avg_per_metric_cents == null;
                      return (
                        <tr
                          key={b.vendor_id}
                          className="border-b border-[var(--border-default)] last:border-b-0"
                        >
                          <td className="px-3 py-2">
                            <span className="text-[var(--text-primary)]">{b.vendor_name}</span>
                            {i === 0 && !isScopeIncomplete ? (
                              <span className="ml-2">
                                <NwBadge variant="success" size="sm">
                                  lowest
                                </NwBadge>
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {isScopeIncomplete ? (
                              <span className="text-[11px] text-[var(--nw-warn)]">
                                size needed
                              </span>
                            ) : (
                              <NwMoney cents={unitCents ?? 0} size="sm" />
                            )}
                          </td>
                          <td
                            className="px-3 py-2 text-right text-[var(--text-secondary)]"
                            style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
                          >
                            {pricingModel === "scope"
                              ? `${b.rows_with_scope_size}/${b.txn_count}`
                              : b.txn_count}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <NwMoney cents={totalCents} size="sm" />
                          </td>
                          <td
                            className="px-3 py-2 text-[var(--text-tertiary)]"
                            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                          >
                            {b.last_txn ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] text-[var(--text-tertiary)] italic">
                {priceMode === "canonical"
                  ? `Canonical unit pricing${canonicalUnit ? ` (per ${canonicalUnit})` : ""} — normalized across whatever unit each vendor uses on their invoices. Pre-tax.`
                  : "Landed prices include sales tax and allocated delivery / freight / fuel overhead. Toggle back to canonical for cleanest comparison."}
              </p>

              {/* Simple trend bars — min/max normalized */}
              {trend.length > 1 ? (
                <div className="mt-4">
                  <NwEyebrow tone="muted">Unit price over time</NwEyebrow>
                  <TrendChart points={trend} />
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

function TrendChart({ points }: { points: PriceTrendPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.unit_price_cents));
  const min = Math.min(0, ...points.map((p) => p.unit_price_cents));
  const range = Math.max(1, max - min);
  return (
    <div className="mt-2 border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
      <div className="flex items-end gap-1.5 h-[120px]">
        {points.map((p, i) => {
          const h = Math.max(3, ((p.unit_price_cents - min) / range) * 120);
          return (
            <div
              key={i}
              className="relative flex-1 min-w-[6px] bg-nw-stone-blue/50 hover:bg-nw-stone-blue transition-colors group"
              style={{ height: `${h}px` }}
              title={`${p.date} · ${p.vendor} · $${(p.unit_price_cents / 100).toFixed(2)}`}
            >
              <div
                className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 whitespace-nowrap bg-[var(--bg-card)] border border-[var(--border-default)] px-2 py-1 text-[10px] text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                {p.date} · ${(p.unit_price_cents / 100).toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
      <div
        className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        <span>{points[0]?.date}</span>
        <span>
          min ${(min / 100).toFixed(2)} · max ${(max / 100).toFixed(2)}
        </span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}
