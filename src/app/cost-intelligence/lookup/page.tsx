"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/app-shell";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwMoney from "@/components/nw/Money";

type ItemSearchResult = {
  id: string;
  canonical_name: string;
  item_type: string;
  category: string | null;
  subcategory: string | null;
  unit: string;
};

type PricingRow = {
  id: string;
  vendor_id: string;
  unit_price_cents: number;
  quantity: number;
  total_cents: number;
  unit: string;
  observed_unit: string | null;
  observed_quantity: number | null;
  observed_unit_price_cents: number | null;
  canonical_quantity: number | null;
  canonical_unit_price_cents: number | null;
  conversion_applied: {
    from_unit?: string;
    to_unit?: string;
    ratio?: number;
    source?: string;
  } | null;
  job_id: string | null;
  transaction_date: string;
  created_via: string | null;
  human_verified: boolean;
  auto_committed: boolean;
  vendors: { id: string; name: string } | null;
  jobs: { id: string; name: string } | null;
};

type AliasRow = {
  id: string;
  alias_text: string;
  occurrence_count: number;
  vendors: { id: string; name: string } | null;
};

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
  human_verified: boolean;
};

type DetailBundle = {
  item: ItemDetail;
  aliases: AliasRow[];
  pricing: PricingRow[];
};

export default function CostLookupWorkspacePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ItemSearchResult[]>([]);
  const [selected, setSelected] = useState<ItemSearchResult | null>(null);
  const [detail, setDetail] = useState<DetailBundle | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const res = await fetch(`/api/cost-intelligence/items?q=${encodeURIComponent(q)}&limit=20`);
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
      if (query.trim().length >= 2 && !selected) {
        void runSearch(query.trim());
      } else if (query.trim().length < 2) {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, runSearch, selected]);

  const loadDetail = useCallback(async (item: ItemSearchResult) => {
    setSelected(item);
    setQuery(item.canonical_name);
    setLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/cost-intelligence/items/${item.id}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = (await res.json()) as DetailBundle;
      setDetail(json);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(null);
    setDetail(null);
    setQuery("");
    setResults([]);
  }, []);

  const vendorBreakdown = useMemo(() => {
    if (!detail) return [];
    type Breakdown = {
      vendor_id: string;
      vendor_name: string;
      count: number;
      total_cents: number;
      total_qty: number;
      total_canonical_qty: number;
      last_txn: string | null;
      most_recent_observed: { qty: number; unit: string; price_cents: number } | null;
    };
    const map = new Map<string, Breakdown>();
    for (const p of detail.pricing) {
      const key = p.vendor_id;
      if (!map.has(key)) {
        map.set(key, {
          vendor_id: key,
          vendor_name: p.vendors?.name ?? "(unknown)",
          count: 0,
          total_cents: 0,
          total_qty: 0,
          total_canonical_qty: 0,
          last_txn: null,
          most_recent_observed: null,
        });
      }
      const b = map.get(key)!;
      b.count++;
      b.total_cents += p.total_cents ?? 0;
      b.total_qty += Number(p.quantity ?? 0);
      b.total_canonical_qty += Number(p.canonical_quantity ?? p.quantity ?? 0);
      if (!b.last_txn || p.transaction_date > b.last_txn) {
        b.last_txn = p.transaction_date;
        b.most_recent_observed = {
          qty: Number(p.observed_quantity ?? p.quantity ?? 0),
          unit: p.observed_unit ?? p.unit,
          price_cents: p.observed_unit_price_cents ?? p.unit_price_cents,
        };
      }
    }
    return Array.from(map.values())
      .map((b) => ({
        ...b,
        avg_canonical_unit_cents:
          b.total_canonical_qty > 0
            ? Math.round(b.total_cents / b.total_canonical_qty)
            : 0,
        avg_observed_unit_cents:
          b.total_qty > 0 ? Math.round(b.total_cents / b.total_qty) : 0,
      }))
      .sort((a, b) => a.avg_canonical_unit_cents - b.avg_canonical_unit_cents);
  }, [detail]);

  const trend = useMemo(() => {
    if (!detail) return [];
    return detail.pricing
      .slice()
      .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
      .map((p) => ({
        date: p.transaction_date,
        canonical_unit_price_cents: p.canonical_unit_price_cents ?? p.unit_price_cents,
        vendor: p.vendors?.name ?? "—",
      }));
  }, [detail]);

  return (
    <AppShell>
      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="mb-5">
          <Link
            href="/cost-intelligence"
            className="text-[11px] text-[var(--text-tertiary)] hover:text-nw-gulf-blue uppercase tracking-[0.12em]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            ← Cost Intelligence
          </Link>
        </div>

        <div className="mb-4">
          <NwEyebrow tone="accent">Cost Intelligence · Cost Lookup</NwEyebrow>
          <h1
            className="mt-2 text-[32px] tracking-[-0.02em] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Compare vendor pricing
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)] max-w-[680px]">
            Type an item to see every vendor that priced it and the best canonical unit price
            across all observations.
          </p>
        </div>

        {/* Prominent search */}
        <div className="relative mb-6">
          <input
            type="text"
            placeholder="Search for an item (e.g. 2x4 lumber, framing labor, drywall sheet)…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selected) setSelected(null);
            }}
            className="w-full px-4 h-[52px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[16px] text-[var(--text-primary)]"
          />
          {selected && (
            <button
              type="button"
              onClick={clearSelection}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              Clear
            </button>
          )}
          {query.trim().length >= 2 && !selected && (
            <div className="absolute top-full left-0 right-0 mt-1 border border-[var(--border-default)] bg-[var(--bg-card)] max-h-[320px] overflow-auto z-10 divide-y divide-[var(--border-default)]">
              {searching ? (
                <p className="p-3 text-[13px] text-[var(--text-tertiary)]">Searching…</p>
              ) : results.length === 0 ? (
                <p className="p-3 text-[13px] text-[var(--text-tertiary)]">No matches.</p>
              ) : (
                results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => loadDetail(r)}
                    className="w-full text-left p-3 hover:bg-[var(--bg-subtle)]"
                  >
                    <div className="text-[14px] text-[var(--text-primary)] font-medium">
                      {r.canonical_name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                      {r.item_type}
                      {r.category ? ` · ${r.category}` : ""}
                      {r.subcategory ? ` · ${r.subcategory}` : ""}
                      {r.unit ? ` · unit ${r.unit}` : ""}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {!selected && (
          <div className="border border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-center">
            <p className="text-[14px] text-[var(--text-secondary)]">
              Start typing above to look up an item.
            </p>
          </div>
        )}

        {selected && loading && (
          <div className="border border-[var(--border-default)] bg-[var(--bg-card)] p-6 text-[13px] text-[var(--text-tertiary)]">
            Loading…
          </div>
        )}

        {selected && detail && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left rail: metadata */}
            <aside className="lg:col-span-1 border border-[var(--border-default)] bg-[var(--bg-card)] p-5 space-y-5 h-fit">
              <div>
                <NwEyebrow tone="muted">Item</NwEyebrow>
                <div
                  className="mt-1 text-[20px] tracking-[-0.02em] text-[var(--text-primary)]"
                  style={{ fontFamily: "var(--font-space-grotesk)" }}
                >
                  {detail.item.canonical_name}
                </div>
                {detail.item.description && (
                  <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                    {detail.item.description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <NwBadge variant="neutral" size="sm">
                    canonical · {detail.item.canonical_unit}
                  </NwBadge>
                  {detail.item.category && (
                    <NwBadge variant="neutral" size="sm">{detail.item.category}</NwBadge>
                  )}
                  {detail.item.human_verified && (
                    <NwBadge variant="success" size="sm">verified</NwBadge>
                  )}
                </div>
              </div>

              {detail.item.conversion_rules && Object.keys(detail.item.conversion_rules).length > 0 && (
                <div>
                  <NwEyebrow tone="muted">Conversion rules</NwEyebrow>
                  <ul
                    className="mt-2 space-y-1 text-[12px]"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  >
                    {Object.entries(detail.item.conversion_rules).map(([fromUnit, rule]) => (
                      <li key={fromUnit} className="text-[var(--text-secondary)]">
                        1 {fromUnit} = {rule.ratio} {detail.item.canonical_unit}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detail.item.specs && Object.keys(detail.item.specs).length > 0 && (
                <div>
                  <NwEyebrow tone="muted">Specs</NwEyebrow>
                  <pre
                    className="mt-2 p-2 border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[11px] text-[var(--text-secondary)] overflow-auto max-h-[200px]"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  >
                    {JSON.stringify(detail.item.specs, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <NwEyebrow tone="muted">Aliases ({detail.aliases.length})</NwEyebrow>
                {detail.aliases.length === 0 ? (
                  <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">None recorded.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5 max-h-[280px] overflow-auto">
                    {detail.aliases.slice(0, 30).map((a) => (
                      <li key={a.id} className="text-[11px]">
                        <div
                          className="text-[var(--text-primary)]"
                          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                        >
                          &ldquo;{a.alias_text}&rdquo;
                        </div>
                        <div className="text-[var(--text-tertiary)]">
                          {a.vendors?.name ?? "any vendor"} · {a.occurrence_count}×
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>

            {/* Right: vendor comparison + chart */}
            <div className="lg:col-span-2 space-y-6">
              <section className="border border-[var(--border-default)] bg-[var(--bg-card)]">
                <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                  <NwEyebrow tone="accent">Vendor Comparison</NwEyebrow>
                  <span
                    className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  >
                    Sorted by canonical unit price
                  </span>
                </div>
                {vendorBreakdown.length === 0 ? (
                  <p className="p-4 text-[13px] text-[var(--text-tertiary)]">
                    No pricing observations yet.
                  </p>
                ) : (
                  <table className="w-full text-[13px]">
                    <thead
                      className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                    >
                      <tr className="border-b border-[var(--border-default)]">
                        <th className="text-left px-4 py-2 font-medium">Vendor</th>
                        <th className="text-right px-4 py-2 font-medium">
                          Canonical / {detail.item.canonical_unit}
                        </th>
                        <th className="text-left px-4 py-2 font-medium">Most recent observed</th>
                        <th className="text-right px-4 py-2 font-medium">Txns</th>
                        <th className="text-left px-4 py-2 font-medium">Last seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorBreakdown.map((b, i) => (
                        <tr
                          key={b.vendor_id}
                          className="border-b border-[var(--border-default)] last:border-b-0"
                        >
                          <td className="px-4 py-2.5">
                            <span className="text-[var(--text-primary)]">{b.vendor_name}</span>
                            {i === 0 && (
                              <span className="ml-2">
                                <NwBadge variant="success" size="sm">lowest</NwBadge>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <NwMoney cents={b.avg_canonical_unit_cents} size="sm" />
                          </td>
                          <td
                            className="px-4 py-2.5 text-[12px] text-[var(--text-tertiary)]"
                            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                          >
                            {b.most_recent_observed ? (
                              <>
                                {b.most_recent_observed.qty} {b.most_recent_observed.unit} @{" "}
                                <NwMoney
                                  cents={b.most_recent_observed.price_cents}
                                  size="sm"
                                />
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td
                            className="px-4 py-2.5 text-right text-[var(--text-secondary)]"
                            style={{
                              fontFamily: "var(--font-jetbrains-mono)",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {b.count}
                          </td>
                          <td
                            className="px-4 py-2.5 text-[var(--text-tertiary)]"
                            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                          >
                            {b.last_txn ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              {trend.length > 1 && (
                <section className="border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                  <NwEyebrow tone="muted">Canonical unit price over time</NwEyebrow>
                  <TrendChart
                    points={trend.map((p) => ({
                      date: p.date,
                      unit_price_cents: p.canonical_unit_price_cents,
                      vendor: p.vendor,
                    }))}
                    canonicalUnit={detail.item.canonical_unit}
                  />
                </section>
              )}

              <section className="border border-[var(--border-default)] bg-[var(--bg-card)]">
                <div className="px-4 py-3 border-b border-[var(--border-default)]">
                  <NwEyebrow tone="muted">Recent observations ({detail.pricing.length})</NwEyebrow>
                </div>
                {detail.pricing.length === 0 ? (
                  <p className="p-4 text-[13px] text-[var(--text-tertiary)]">No observations yet.</p>
                ) : (
                  <ul className="divide-y divide-[var(--border-default)] max-h-[360px] overflow-auto">
                    {detail.pricing.slice(0, 30).map((p) => (
                      <li key={p.id} className="px-4 py-2.5 text-[12px]">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <span className="text-[var(--text-primary)]">
                              {p.vendors?.name ?? "—"}
                            </span>
                            {p.jobs?.name && (
                              <span className="ml-2 text-[var(--text-tertiary)]">
                                on {p.jobs.name}
                              </span>
                            )}
                          </div>
                          <span
                            className="text-[var(--text-tertiary)]"
                            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                          >
                            {p.transaction_date}
                          </span>
                        </div>
                        <div
                          className="mt-1 text-[11px] text-[var(--text-tertiary)]"
                          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                        >
                          {p.observed_quantity ?? p.quantity} {p.observed_unit ?? p.unit} @{" "}
                          <NwMoney cents={p.observed_unit_price_cents ?? p.unit_price_cents} size="sm" />
                          {" → "}
                          <NwMoney
                            cents={p.canonical_unit_price_cents ?? p.unit_price_cents}
                            size="sm"
                          />
                          {" / "}
                          {detail.item.canonical_unit}
                          {p.conversion_applied?.source && p.conversion_applied.source !== "same_unit" && p.conversion_applied.source !== "no_conversion" && (
                            <span className="ml-2 text-[10px] text-[var(--text-tertiary)]">
                              ({p.conversion_applied.source})
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}

function TrendChart({
  points,
  canonicalUnit,
}: {
  points: Array<{ date: string; unit_price_cents: number; vendor: string }>;
  canonicalUnit: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.unit_price_cents));
  const min = Math.min(0, ...points.map((p) => p.unit_price_cents));
  const range = Math.max(1, max - min);
  return (
    <div className="mt-3 border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
      <div className="flex items-end gap-1.5 h-[140px]">
        {points.map((p, i) => {
          const h = Math.max(3, ((p.unit_price_cents - min) / range) * 140);
          return (
            <div
              key={i}
              className="relative flex-1 min-w-[6px] bg-nw-stone-blue/50 hover:bg-nw-stone-blue transition-colors group"
              style={{ height: `${h}px` }}
              title={`${p.date} · ${p.vendor} · $${(p.unit_price_cents / 100).toFixed(2)} / ${canonicalUnit}`}
            >
              <div
                className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 whitespace-nowrap bg-[var(--bg-card)] border border-[var(--border-default)] px-2 py-1 text-[10px] text-[var(--text-primary)] z-10"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                {p.date} · ${(p.unit_price_cents / 100).toFixed(2)} / {canonicalUnit}
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
