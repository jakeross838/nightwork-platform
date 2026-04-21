"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/app-shell";
import FinancialViewTabs from "@/components/financial-view-tabs";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwMoney from "@/components/nw/Money";
import { supabase } from "@/lib/supabase/client";
import CostLookupWidget from "@/components/items/cost-lookup-widget";

type ItemType = "material" | "labor" | "equipment" | "service" | "subcontract" | "other";

interface ItemRow {
  id: string;
  canonical_name: string;
  item_type: string;
  category: string | null;
  subcategory: string | null;
  unit: string;
  ai_confidence: number | null;
  human_verified: boolean;
  created_at: string;
}

interface PricingAgg {
  item_id: string;
  total_cents: number;
  count: number;
  last_seen: string | null;
  vendor_count: number;
  job_count: number;
}

const TYPE_OPTIONS: Array<{ value: "" | ItemType; label: string }> = [
  { value: "", label: "All types" },
  { value: "material", label: "Material" },
  { value: "labor", label: "Labor" },
  { value: "equipment", label: "Equipment" },
  { value: "service", label: "Service" },
  { value: "subcontract", label: "Subcontract" },
  { value: "other", label: "Other" },
];

export default function ItemsPage() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [aggByItem, setAggByItem] = useState<Record<string, PricingAgg>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | ItemType>("");
  const [verifiedFilter, setVerifiedFilter] = useState<"" | "verified" | "unverified">("");

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Items
    const { data: itemRows } = await supabase
      .from("items")
      .select("id, canonical_name, item_type, category, subcategory, unit, ai_confidence, human_verified, created_at")
      .is("deleted_at", null)
      .order("canonical_name");

    const list = (itemRows ?? []) as ItemRow[];
    setItems(list);

    // Pricing aggregates in a single pass
    const { data: pricingRows } = await supabase
      .from("vendor_item_pricing")
      .select("item_id, total_cents, vendor_id, job_id, transaction_date")
      .is("deleted_at", null);

    const agg: Record<string, PricingAgg> = {};
    for (const row of (pricingRows ?? []) as Array<{
      item_id: string;
      total_cents: number;
      vendor_id: string | null;
      job_id: string | null;
      transaction_date: string | null;
    }>) {
      const key = row.item_id;
      if (!agg[key]) {
        agg[key] = {
          item_id: key,
          total_cents: 0,
          count: 0,
          last_seen: null,
          vendor_count: 0,
          job_count: 0,
        };
      }
      const a = agg[key];
      a.total_cents += row.total_cents ?? 0;
      a.count += 1;
      if (row.transaction_date && (!a.last_seen || row.transaction_date > a.last_seen)) {
        a.last_seen = row.transaction_date;
      }
    }

    // Second pass for distinct vendor/job counts
    const vendorsByItem = new Map<string, Set<string>>();
    const jobsByItem = new Map<string, Set<string>>();
    for (const row of (pricingRows ?? []) as Array<{
      item_id: string;
      vendor_id: string | null;
      job_id: string | null;
    }>) {
      if (row.vendor_id) {
        if (!vendorsByItem.has(row.item_id)) vendorsByItem.set(row.item_id, new Set());
        vendorsByItem.get(row.item_id)!.add(row.vendor_id);
      }
      if (row.job_id) {
        if (!jobsByItem.has(row.item_id)) jobsByItem.set(row.item_id, new Set());
        jobsByItem.get(row.item_id)!.add(row.job_id);
      }
    }
    vendorsByItem.forEach((set, itemId) => {
      if (agg[itemId]) agg[itemId].vendor_count = set.size;
    });
    jobsByItem.forEach((set, itemId) => {
      if (agg[itemId]) agg[itemId].job_count = set.size;
    });

    setAggByItem(agg);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((it) => {
      if (typeFilter && it.item_type !== typeFilter) return false;
      if (verifiedFilter === "verified" && !it.human_verified) return false;
      if (verifiedFilter === "unverified" && it.human_verified) return false;
      if (q) {
        const haystack = `${it.canonical_name} ${it.category ?? ""} ${it.subcategory ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, typeFilter, verifiedFilter]);

  const kpis = useMemo(() => {
    const totalItems = items.length;
    const verifiedItems = items.filter((i) => i.human_verified).length;
    const totalSpendCents = Object.values(aggByItem).reduce((s, a) => s + a.total_cents, 0);
    const totalPricingRows = Object.values(aggByItem).reduce((s, a) => s + a.count, 0);
    return { totalItems, verifiedItems, totalSpendCents, totalPricingRows };
  }, [items, aggByItem]);

  return (
    <AppShell>
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <FinancialViewTabs active="items" />

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <NwEyebrow tone="accent">Cost Intelligence · Items</NwEyebrow>
            <h1
              className="mt-2 text-[28px] tracking-[-0.02em] text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Items
            </h1>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              Canonical items built up from verified invoice lines, POs, COs, and proposals.
            </p>
          </div>
          <Link
            href="/items/verification-queue"
            className="inline-flex items-center gap-2 h-[36px] px-4 border border-[var(--border-strong)] text-[11px] uppercase tracking-[0.12em] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            Verification queue
          </Link>
        </div>

        <CostLookupWidget />

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Total items" value={kpis.totalItems.toLocaleString("en-US")} />
          <Kpi
            label="Verified"
            value={`${kpis.verifiedItems.toLocaleString("en-US")} / ${kpis.totalItems.toLocaleString("en-US")}`}
          />
          <Kpi
            label="Pricing rows"
            value={kpis.totalPricingRows.toLocaleString("en-US")}
          />
          <KpiMoney label="Total spend tracked" cents={kpis.totalSpendCents} />
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search items, categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] min-w-[280px]"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={verifiedFilter}
            onChange={(e) => setVerifiedFilter(e.target.value as typeof verifiedFilter)}
            className="px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
          >
            <option value="">All</option>
            <option value="verified">Verified only</option>
            <option value="unverified">Unverified only</option>
          </select>
        </div>

        {/* Table */}
        <div className="mt-5 border border-[var(--border-default)] bg-[var(--bg-card)]">
          <table className="w-full text-[13px]">
            <thead
              className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              <tr className="border-b border-[var(--border-default)]">
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Unit</th>
                <th className="text-left px-4 py-3 font-medium">Vendors</th>
                <th className="text-left px-4 py-3 font-medium">Jobs</th>
                <th className="text-right px-4 py-3 font-medium">Pricing rows</th>
                <th className="text-right px-4 py-3 font-medium">Tracked spend</th>
                <th className="text-left px-4 py-3 font-medium">Verified</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-[var(--text-tertiary)]">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-[var(--text-tertiary)]">
                    No items yet. Extract invoices to start building the spine.
                  </td>
                </tr>
              ) : (
                filtered.map((it) => {
                  const a = aggByItem[it.id];
                  return (
                    <tr
                      key={it.id}
                      className="border-b border-[var(--border-default)] last:border-b-0 hover:bg-[var(--bg-subtle)]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/items/${it.id}`}
                          className="text-[var(--text-primary)] hover:text-nw-gulf-blue hover:underline font-medium"
                        >
                          {it.canonical_name}
                        </Link>
                        {it.category ? (
                          <div className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                            {it.category}
                            {it.subcategory ? ` · ${it.subcategory}` : ""}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{it.item_type}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{it.unit}</td>
                      <td
                        className="px-4 py-3 text-[var(--text-secondary)]"
                        style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
                      >
                        {a?.vendor_count ?? 0}
                      </td>
                      <td
                        className="px-4 py-3 text-[var(--text-secondary)]"
                        style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
                      >
                        {a?.job_count ?? 0}
                      </td>
                      <td
                        className="px-4 py-3 text-right text-[var(--text-secondary)]"
                        style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
                      >
                        {a?.count ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <NwMoney cents={a?.total_cents ?? 0} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        {it.human_verified ? (
                          <NwBadge variant="success" size="sm">
                            verified
                          </NwBadge>
                        ) : (
                          <NwBadge variant="warning" size="sm">
                            unverified
                          </NwBadge>
                        )}
                      </td>
                    </tr>
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
      <div
        className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-[22px] text-[var(--text-primary)]"
        style={{ fontFamily: "var(--font-space-grotesk)", letterSpacing: "-0.02em" }}
      >
        {value}
      </div>
    </div>
  );
}

function KpiMoney({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
      <div
        className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        {label}
      </div>
      <div className="mt-2">
        <NwMoney cents={cents} size="xl" variant="emphasized" showCents={false} />
      </div>
    </div>
  );
}
