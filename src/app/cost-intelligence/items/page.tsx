"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/app-shell";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwMoney from "@/components/nw/Money";
import { supabase } from "@/lib/supabase/client";
import ItemsGroupedTable, {
  type ItemRowWithAgg,
  type GroupBy,
} from "@/components/items/items-grouped-table";

type ItemType = "material" | "labor" | "equipment" | "service" | "subcontract" | "other";

const TYPE_OPTIONS: Array<{ value: "" | ItemType; label: string }> = [
  { value: "", label: "All types" },
  { value: "material", label: "Material" },
  { value: "labor", label: "Labor" },
  { value: "equipment", label: "Equipment" },
  { value: "service", label: "Service" },
  { value: "subcontract", label: "Subcontract" },
  { value: "other", label: "Other" },
];

const GROUPING_STORAGE_KEY = "cost-intel-items-grouping";

export default function CostIntelligenceItemsPage() {
  const [items, setItems] = useState<ItemRowWithAgg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | ItemType>("");
  const [verifiedFilter, setVerifiedFilter] = useState<"" | "verified" | "unverified">("");
  const [groupBy, setGroupBy] = useState<GroupBy>("category");

  // Restore grouping preference
  useEffect(() => {
    const stored = window.localStorage.getItem(GROUPING_STORAGE_KEY);
    if (stored === "category" || stored === "vendor" || stored === "job") {
      setGroupBy(stored);
    }
  }, []);

  const updateGrouping = useCallback((next: GroupBy) => {
    setGroupBy(next);
    window.localStorage.setItem(GROUPING_STORAGE_KEY, next);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: itemRows } = await supabase
      .from("items")
      .select(
        "id, canonical_name, item_type, category, subcategory, unit, canonical_unit, ai_confidence, human_verified, created_at, pricing_model, scope_size_metric"
      )
      .is("deleted_at", null)
      .order("canonical_name");

    const baseItems = (itemRows ?? []) as Array<{
      id: string;
      canonical_name: string;
      item_type: string;
      category: string | null;
      subcategory: string | null;
      unit: string;
      canonical_unit: string;
      ai_confidence: number | null;
      human_verified: boolean;
      created_at: string;
      pricing_model: "unit" | "scope";
      scope_size_metric: string | null;
    }>;

    // Tracked spend aggregates pretax `total_cents` when available and falls
    // back to `landed_total_cents` (includes tax + overhead) only if the
    // pretax column is NULL — matches the Cost-Lookup widget's semantics.
    // Explicit .limit(50000) bypasses PostgREST's default 1000-row ceiling
    // so large orgs don't silently undercount spend.
    const { data: pricingRows } = await supabase
      .from("vendor_item_pricing")
      .select(
        "item_id, total_cents, landed_total_cents, tax_cents, overhead_allocated_cents, vendor_id, job_id, transaction_date"
      )
      .is("deleted_at", null)
      .limit(50000);

    type Agg = {
      total_cents: number;
      count: number;
      vendors: Set<string>;
      jobs: Set<string>;
      last_seen: string | null;
    };
    const aggByItem = new Map<string, Agg>();
    for (const row of (pricingRows ?? []) as Array<{
      item_id: string;
      total_cents: number | null;
      landed_total_cents: number | null;
      tax_cents: number | null;
      overhead_allocated_cents: number | null;
      vendor_id: string | null;
      job_id: string | null;
      transaction_date: string | null;
    }>) {
      const effectiveCents =
        row.total_cents ??
        (row.landed_total_cents != null
          ? row.landed_total_cents -
            (row.tax_cents ?? 0) -
            (row.overhead_allocated_cents ?? 0)
          : 0);
      let a = aggByItem.get(row.item_id);
      if (!a) {
        a = { total_cents: 0, count: 0, vendors: new Set(), jobs: new Set(), last_seen: null };
        aggByItem.set(row.item_id, a);
      }
      a.total_cents += effectiveCents;
      a.count += 1;
      if (row.vendor_id) a.vendors.add(row.vendor_id);
      if (row.job_id) a.jobs.add(row.job_id);
      if (row.transaction_date && (!a.last_seen || row.transaction_date > a.last_seen)) {
        a.last_seen = row.transaction_date;
      }
    }

    const enriched: ItemRowWithAgg[] = baseItems.map((it) => {
      const a = aggByItem.get(it.id);
      return {
        ...it,
        tracked_spend_cents: a?.total_cents ?? 0,
        pricing_rows_count: a?.count ?? 0,
        vendors_count: a?.vendors.size ?? 0,
        jobs_count: a?.jobs.size ?? 0,
        last_seen: a?.last_seen ?? null,
      };
    });

    setItems(enriched);
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

        <div className="mt-4 flex items-start justify-between gap-4 mb-6">
          <div>
            <NwEyebrow tone="accent">Cost Intelligence · Items</NwEyebrow>
            <h1
              className="mt-2 text-[28px] tracking-[-0.02em] text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              All items
            </h1>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              Canonical items built up from verified invoice lines, POs, COs, and proposals.
            </p>
          </div>
        </div>

        {/* Filters + grouping toggle */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search items, categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] min-w-[260px]"
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

          <GroupToggle value={groupBy} onChange={updateGrouping} />
        </div>

        {loading ? (
          <div className="border border-[var(--border-default)] bg-[var(--bg-card)] p-6 text-[13px] text-[var(--text-tertiary)]">
            Loading…
          </div>
        ) : (
          <ItemsGroupedTable items={filtered} groupBy={groupBy} />
        )}

        {/* Quick KPIs in a footer row */}
        {!loading && (
          <FooterKpis
            items={filtered}
            onClear={() => {
              setSearch("");
              setTypeFilter("");
              setVerifiedFilter("");
            }}
            showClear={Boolean(search || typeFilter || verifiedFilter)}
          />
        )}
      </main>
    </AppShell>
  );
}

function GroupToggle({
  value,
  onChange,
}: {
  value: GroupBy;
  onChange: (next: GroupBy) => void;
}) {
  const opts: Array<{ value: GroupBy; label: string }> = [
    { value: "category", label: "By Category" },
    { value: "vendor", label: "By Vendor" },
    { value: "job", label: "By Job" },
  ];
  return (
    <div
      className="ml-auto inline-flex items-center border border-[var(--border-default)]"
      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
    >
      {opts.map((o, i) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 h-[34px] text-[10px] uppercase tracking-[0.12em] ${
            i > 0 ? "border-l border-[var(--border-default)]" : ""
          } ${
            value === o.value
              ? "bg-nw-stone-blue text-nw-white-sand"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FooterKpis({
  items,
  onClear,
  showClear,
}: {
  items: ItemRowWithAgg[];
  onClear: () => void;
  showClear: boolean;
}) {
  const totalSpend = items.reduce((s, i) => s + i.tracked_spend_cents, 0);
  const verifiedCount = items.filter((i) => i.human_verified).length;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-6 text-[12px] text-[var(--text-tertiary)]">
      <span>
        <span className="uppercase tracking-[0.12em]" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
          {items.length}
        </span>{" "}
        items shown
      </span>
      <span>
        {verifiedCount}/{items.length} verified
      </span>
      <span className="inline-flex items-center gap-2">
        Total spend tracked <NwMoney cents={totalSpend} size="sm" />
      </span>
      {showClear && (
        <button
          type="button"
          onClick={onClear}
          className="ml-auto text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// Keep the NwBadge import alive (used indirectly from the grouped table).
// Explicit reference avoids unused-import errors if the grouped table path
// changes.
void NwBadge;
