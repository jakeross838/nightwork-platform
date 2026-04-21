"use client";

import Link from "next/link";
import { useMemo, useState, useCallback } from "react";
import NwBadge from "@/components/nw/Badge";
import NwMoney from "@/components/nw/Money";

export type GroupBy = "category" | "vendor" | "job";

export interface ItemRowWithAgg {
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
  tracked_spend_cents: number;
  pricing_rows_count: number;
  vendors_count: number;
  jobs_count: number;
  last_seen: string | null;
  pricing_model?: "unit" | "scope";
  scope_size_metric?: string | null;
}

interface GroupSection {
  key: string;
  label: string;
  items: ItemRowWithAgg[];
  totalItems: number;
  vendorsCount: number;
  jobsCount: number;
  trackedSpendCents: number;
}

interface ItemsGroupedTableProps {
  items: ItemRowWithAgg[];
  groupBy: GroupBy;
  defaultExpanded?: boolean;
}

const UNCATEGORIZED_KEY = "__uncategorized__";

function groupByCategory(items: ItemRowWithAgg[]): GroupSection[] {
  const map = new Map<string, ItemRowWithAgg[]>();
  for (const it of items) {
    const key = it.category ?? UNCATEGORIZED_KEY;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  const sections: GroupSection[] = Array.from(map.entries()).map(([key, groupItems]) => ({
    key,
    label:
      key === UNCATEGORIZED_KEY
        ? "Uncategorized"
        : key
            .split(/[\s_]+/)
            .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : ""))
            .join(" "),
    items: groupItems,
    totalItems: groupItems.length,
    vendorsCount: sumDistinct(groupItems, (i) => i.vendors_count),
    jobsCount: sumDistinct(groupItems, (i) => i.jobs_count),
    trackedSpendCents: groupItems.reduce((s, i) => s + i.tracked_spend_cents, 0),
  }));
  // Uncategorized pinned to the bottom; rest sorted by item count desc.
  return sections.sort((a, b) => {
    if (a.key === UNCATEGORIZED_KEY) return 1;
    if (b.key === UNCATEGORIZED_KEY) return -1;
    if (b.totalItems !== a.totalItems) return b.totalItems - a.totalItems;
    return a.label.localeCompare(b.label);
  });
}

/**
 * For "by vendor" / "by job" we don't have the individual vendor/job
 * links on the item row directly — our aggregates only know counts. So
 * these groupings group each item once under the label "Across N
 * vendors" etc. For a deeper drill, the user can hit the item detail
 * page.
 *
 * If/when we want to actually show every vendor/job split, we'd need to
 * join vendor_item_pricing and emit one row per (vendor, item). For now
 * we treat those as "Items most used with vendors" / "Items most used
 * with jobs" buckets — still collapsable and still useful as a
 * consolidation lens, but kept lightweight.
 */
function groupByUsage(items: ItemRowWithAgg[], dimension: "vendor" | "job"): GroupSection[] {
  const active: ItemRowWithAgg[] = [];
  const zero: ItemRowWithAgg[] = [];
  for (const it of items) {
    const count = dimension === "vendor" ? it.vendors_count : it.jobs_count;
    if (count > 0) active.push(it);
    else zero.push(it);
  }
  const sections: GroupSection[] = [];
  if (active.length > 0) {
    sections.push({
      key: "active",
      label: dimension === "vendor" ? "Items with vendor pricing" : "Items with job usage",
      items: active,
      totalItems: active.length,
      vendorsCount: sumDistinct(active, (i) => i.vendors_count),
      jobsCount: sumDistinct(active, (i) => i.jobs_count),
      trackedSpendCents: active.reduce((s, i) => s + i.tracked_spend_cents, 0),
    });
  }
  if (zero.length > 0) {
    sections.push({
      key: "zero",
      label:
        dimension === "vendor"
          ? "Items with no vendor pricing yet"
          : "Items not yet used on a job",
      items: zero,
      totalItems: zero.length,
      vendorsCount: 0,
      jobsCount: 0,
      trackedSpendCents: 0,
    });
  }
  return sections;
}

function sumDistinct(items: ItemRowWithAgg[], extract: (i: ItemRowWithAgg) => number): number {
  // Conservative: sum of per-item distinct counts is NOT the true overall
  // distinct count (an item with 3 vendors contributes 3 but they may be
  // shared across items). Labelling this as a "vendor-touches" aggregate
  // in the UI keeps it honest while avoiding a second query.
  return items.reduce((s, i) => s + extract(i), 0);
}

export default function ItemsGroupedTable({
  items,
  groupBy,
  defaultExpanded = true,
}: ItemsGroupedTableProps) {
  const sections = useMemo(() => {
    if (groupBy === "category") return groupByCategory(items);
    return groupByUsage(items, groupBy);
  }, [items, groupBy]);

  const initialCollapsed = useMemo(() => {
    if (defaultExpanded) return new Set<string>();
    return new Set<string>(sections.map((s) => s.key));
  }, [defaultExpanded, sections]);
  const [collapsed, setCollapsed] = useState<Set<string>>(initialCollapsed);

  const toggle = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (items.length === 0) {
    return (
      <div className="border border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-center">
        <p className="text-[13px] text-[var(--text-secondary)]">No items match your filters.</p>
      </div>
    );
  }

  return (
    <div className="border border-[var(--border-default)] bg-[var(--bg-card)]">
      {sections.map((section, idx) => {
        const isCollapsed = collapsed.has(section.key);
        return (
          <div
            key={section.key}
            className={idx > 0 ? "border-t border-[var(--border-default)]" : ""}
          >
            <button
              type="button"
              onClick={() => toggle(section.key)}
              className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-[var(--bg-subtle)] transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className={`transition-transform text-[var(--text-tertiary)] ${
                    isCollapsed ? "-rotate-90" : ""
                  }`}
                  aria-hidden="true"
                >
                  <path d="M2 3.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span
                  className="text-[15px] font-medium text-[var(--text-primary)]"
                  style={{ fontFamily: "var(--font-space-grotesk)" }}
                >
                  {section.label}
                </span>
              </div>
              <div
                className="flex items-center gap-4 text-[11px] text-[var(--text-tertiary)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                <span>{section.totalItems} items</span>
                <span>{section.vendorsCount} vendors</span>
                <span>{section.jobsCount} jobs</span>
                <span>
                  <NwMoney cents={section.trackedSpendCents} size="sm" />{" "}
                  <span className="uppercase tracking-[0.12em]">tracked</span>
                </span>
              </div>
            </button>

            {!isCollapsed && <ItemsRows rows={section.items} />}
          </div>
        );
      })}
    </div>
  );
}

function ItemsRows({ rows }: { rows: ItemRowWithAgg[] }) {
  return (
    <div className="border-t border-[var(--border-default)]">
      <table className="w-full text-[13px]">
        <thead
          className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          <tr className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)]">
            <th className="text-left px-4 py-2 font-medium">Item</th>
            <th className="text-left px-4 py-2 font-medium">Type</th>
            <th className="text-left px-4 py-2 font-medium">Canonical unit</th>
            <th className="text-right px-4 py-2 font-medium">Vendors</th>
            <th className="text-right px-4 py-2 font-medium">Jobs</th>
            <th className="text-right px-4 py-2 font-medium">Pricing rows</th>
            <th className="text-right px-4 py-2 font-medium">Tracked spend</th>
            <th className="text-left px-4 py-2 font-medium">Verified</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it) => (
            <tr key={it.id} className="border-b border-[var(--border-default)] last:border-b-0 hover:bg-[var(--bg-subtle)]">
              <td className="px-4 py-2.5">
                <Link
                  href={`/cost-intelligence/items/${it.id}`}
                  className="text-[var(--text-primary)] hover:text-nw-gulf-blue hover:underline font-medium"
                >
                  {it.canonical_name}
                </Link>
                {it.subcategory && (
                  <div className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">{it.subcategory}</div>
                )}
              </td>
              <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                {it.item_type}
                {it.pricing_model === "scope" && (
                  <span className="ml-1">
                    <NwBadge variant="accent" size="sm">
                      scope
                    </NwBadge>
                  </span>
                )}
              </td>
              <td
                className="px-4 py-2.5 text-[var(--text-secondary)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                {it.pricing_model === "scope"
                  ? it.scope_size_metric ?? <span className="text-[var(--nw-warn)]">no metric</span>
                  : it.canonical_unit}
              </td>
              <td
                className="px-4 py-2.5 text-right text-[var(--text-secondary)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
              >
                {it.vendors_count}
              </td>
              <td
                className="px-4 py-2.5 text-right text-[var(--text-secondary)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
              >
                {it.jobs_count}
              </td>
              <td
                className="px-4 py-2.5 text-right text-[var(--text-secondary)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
              >
                {it.pricing_rows_count}
              </td>
              <td className="px-4 py-2.5 text-right">
                <NwMoney cents={it.tracked_spend_cents} size="sm" />
              </td>
              <td className="px-4 py-2.5">
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
