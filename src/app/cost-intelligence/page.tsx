"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/app-shell";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwMoney from "@/components/nw/Money";
import CostLookupWidget from "@/components/items/cost-lookup-widget";
import ItemsGroupedTable, {
  type ItemRowWithAgg,
  type GroupBy,
} from "@/components/items/items-grouped-table";
import RecentLearningsPanel from "@/components/cost-intelligence/recent-learnings-panel";
import type { LearningEntry } from "@/lib/cost-intelligence/recent-learnings";
import { supabase } from "@/lib/supabase/client";

const GROUPING_STORAGE_KEY = "cost-intel-items-grouping";

interface HubState {
  items: ItemRowWithAgg[];
  totalPricingRows: number;
  totalVendors: number;
  totalJobs: number;
  totalSpendCents: number;
  pendingVerification: number;
  pendingVerificationOldestDays: number | null;
  pendingConversions: number;
  pendingScopeEnrichment: number;
  pendingZeroVendorItems: ItemRowWithAgg[];
  pendingUncategorizedItems: ItemRowWithAgg[];
  learnings: LearningEntry[];
}

export default function CostIntelligenceHubPage() {
  const [state, setState] = useState<HubState | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>("category");

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

  const fetchHub = useCallback(async () => {
    setLoading(true);
    const [
      { data: itemRows },
      { data: pricingRows },
      { data: pendingLines, count: pendingLinesCount },
      { count: pendingConversionsCount },
    ] = await Promise.all([
      supabase
        .from("items")
        .select(
          "id, canonical_name, item_type, category, subcategory, unit, canonical_unit, ai_confidence, human_verified, created_at, pricing_model, scope_size_metric"
        )
        .is("deleted_at", null)
        .order("canonical_name"),
      supabase
        .from("vendor_item_pricing")
        .select("item_id, total_cents, vendor_id, job_id, transaction_date")
        .is("deleted_at", null),
      supabase
        .from("invoice_extraction_lines")
        .select("id, created_at", { count: "exact" })
        .eq("verification_status", "pending")
        .eq("is_allocated_overhead", false)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1),
      supabase
        .from("unit_conversion_suggestions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .is("deleted_at", null),
    ]);

    // Separate query: scope pricing rows missing scope_size_value (counts
    // needed for the Scope Data badge in the header).
    const { data: scopeItemIdsData } = await supabase
      .from("items")
      .select("id")
      .eq("pricing_model", "scope")
      .is("deleted_at", null);
    const scopeItemIds = (scopeItemIdsData ?? []).map((r: { id: string }) => r.id);
    let pendingScopeCount = 0;
    if (scopeItemIds.length > 0) {
      const { count } = await supabase
        .from("vendor_item_pricing")
        .select("id", { count: "exact", head: true })
        .is("scope_size_value", null)
        .is("deleted_at", null)
        .in("item_id", scopeItemIds);
      pendingScopeCount = count ?? 0;
    }

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

    type Agg = {
      total_cents: number;
      count: number;
      vendors: Set<string>;
      jobs: Set<string>;
      last_seen: string | null;
    };
    const aggByItem = new Map<string, Agg>();
    const allVendors = new Set<string>();
    const allJobs = new Set<string>();
    let totalPricingRows = 0;
    let totalSpendCents = 0;
    for (const row of (pricingRows ?? []) as Array<{
      item_id: string;
      total_cents: number;
      vendor_id: string | null;
      job_id: string | null;
      transaction_date: string | null;
    }>) {
      let a = aggByItem.get(row.item_id);
      if (!a) {
        a = { total_cents: 0, count: 0, vendors: new Set(), jobs: new Set(), last_seen: null };
        aggByItem.set(row.item_id, a);
      }
      a.total_cents += row.total_cents ?? 0;
      a.count += 1;
      if (row.vendor_id) a.vendors.add(row.vendor_id);
      if (row.job_id) a.jobs.add(row.job_id);
      if (row.transaction_date && (!a.last_seen || row.transaction_date > a.last_seen)) {
        a.last_seen = row.transaction_date;
      }
      totalPricingRows++;
      totalSpendCents += row.total_cents ?? 0;
      if (row.vendor_id) allVendors.add(row.vendor_id);
      if (row.job_id) allJobs.add(row.job_id);
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

    const pendingVerification = pendingLinesCount ?? 0;
    const oldestPendingAt = (pendingLines?.[0] as { created_at?: string } | undefined)?.created_at;
    const oldestDays = oldestPendingAt
      ? Math.max(0, Math.round((Date.now() - new Date(oldestPendingAt).getTime()) / 86_400_000))
      : null;

    const pendingZeroVendorItems = enriched
      .filter((i) => i.vendors_count === 0)
      .slice(0, 3);
    const pendingUncategorizedItems = enriched
      .filter((i) => !i.category)
      .slice(0, 3);

    // Load learnings via API (keeps RLS-scoped + SSR caching if we add it later)
    let learnings: LearningEntry[] = [];
    try {
      const res = await fetch("/api/cost-intelligence/recent-learnings?limit=5");
      if (res.ok) {
        const json = (await res.json()) as { learnings: LearningEntry[] };
        learnings = json.learnings ?? [];
      }
    } catch {
      learnings = [];
    }

    setState({
      items: enriched,
      totalPricingRows,
      totalVendors: allVendors.size,
      totalJobs: allJobs.size,
      totalSpendCents,
      pendingVerification,
      pendingVerificationOldestDays: oldestDays,
      pendingConversions: pendingConversionsCount ?? 0,
      pendingScopeEnrichment: pendingScopeCount,
      pendingZeroVendorItems,
      pendingUncategorizedItems,
      learnings,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchHub();
  }, [fetchHub]);

  const kpis = useMemo(() => {
    if (!state) {
      return {
        totalItems: 0,
        verifiedItems: 0,
        unverifiedItems: 0,
        totalPricingRows: 0,
        totalVendors: 0,
        totalSpendCents: 0,
        totalJobs: 0,
      };
    }
    const verifiedItems = state.items.filter((i) => i.human_verified).length;
    return {
      totalItems: state.items.length,
      verifiedItems,
      unverifiedItems: state.items.length - verifiedItems,
      totalPricingRows: state.totalPricingRows,
      totalVendors: state.totalVendors,
      totalSpendCents: state.totalSpendCents,
      totalJobs: state.totalJobs,
    };
  }, [state]);

  return (
    <AppShell>
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <NwEyebrow tone="accent">Operations · Cost Intelligence</NwEyebrow>
            <h1
              className="mt-2 text-[32px] tracking-[-0.02em] text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Cost Intelligence
            </h1>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)] max-w-[680px]">
              Your proprietary pricing database built from every invoice, PO, and transaction.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/cost-intelligence/verification"
              className="inline-flex items-center gap-2 h-[36px] px-4 border border-[var(--border-strong)] text-[11px] uppercase tracking-[0.12em] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              Verification Queue
              {state && state.pendingVerification > 0 && (
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 border text-[10px] font-bold"
                  style={{
                    color: "var(--text-primary)",
                    borderColor: "var(--border-default)",
                    background: "var(--bg-subtle)",
                  }}
                >
                  {state.pendingVerification}
                </span>
              )}
            </Link>
            <Link
              href="/cost-intelligence/conversions"
              className="inline-flex items-center gap-2 h-[36px] px-4 border border-[var(--border-strong)] text-[11px] uppercase tracking-[0.12em] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              Unit Conversions
              {state && state.pendingConversions > 0 && (
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 border text-[10px] font-bold"
                  style={{
                    color: "var(--text-primary)",
                    borderColor: "var(--border-default)",
                    background: "var(--bg-subtle)",
                  }}
                >
                  {state.pendingConversions}
                </span>
              )}
            </Link>
            <Link
              href="/cost-intelligence/scope-data"
              className="inline-flex items-center gap-2 h-[36px] px-4 border border-[var(--border-strong)] text-[11px] uppercase tracking-[0.12em] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              Scope Data
              {state && state.pendingScopeEnrichment > 10 && (
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 border text-[10px] font-bold"
                  style={{
                    color: "var(--nw-warn)",
                    borderColor: "var(--nw-warn)",
                    background: "var(--bg-subtle)",
                  }}
                >
                  {state.pendingScopeEnrichment}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard
            label="Total Items"
            value={kpis.totalItems.toLocaleString("en-US")}
            subtext={`${kpis.verifiedItems} verified · ${kpis.unverifiedItems} unverified`}
          />
          <KpiCard
            label="Pricing Observations"
            value={kpis.totalPricingRows.toLocaleString("en-US")}
            subtext={`Across ${kpis.totalVendors} vendor${kpis.totalVendors === 1 ? "" : "s"}`}
          />
          <KpiCard
            label="Pending Verification"
            value={state?.pendingVerification.toLocaleString("en-US") ?? "—"}
            subtext={
              state?.pendingVerificationOldestDays != null && state.pendingVerificationOldestDays > 0
                ? `Oldest: ${state.pendingVerificationOldestDays} days ago`
                : state?.pendingVerification && state.pendingVerification > 0
                ? "Oldest: today"
                : "Queue is clear"
            }
            href="/cost-intelligence/verification"
            warn={state ? state.pendingVerification > 20 : false}
          />
          <KpiMoneyCard
            label="Total Spend Tracked"
            cents={kpis.totalSpendCents}
            subtext={`Across ${kpis.totalJobs} job${kpis.totalJobs === 1 ? "" : "s"}`}
          />
        </div>

        {/* Cost Lookup widget */}
        <div className="mb-6">
          <CostLookupWidget />
        </div>

        {/* Learnings + Needs Attention */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <RecentLearningsPanel learnings={state?.learnings ?? []} />
          <NeedsAttentionPanel
            pendingVerification={state?.pendingVerification ?? 0}
            pendingConversions={state?.pendingConversions ?? 0}
            zeroVendorItems={state?.pendingZeroVendorItems ?? []}
            uncategorizedItems={state?.pendingUncategorizedItems ?? []}
          />
        </div>

        {/* Items Browser */}
        <section>
          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div>
              <NwEyebrow tone="accent">Items Database</NwEyebrow>
              <h2
                className="mt-1 text-[20px] tracking-[-0.02em] text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-space-grotesk)" }}
              >
                All items
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <GroupToggle value={groupBy} onChange={updateGrouping} />
              <Link
                href="/cost-intelligence/items"
                className="text-[11px] uppercase tracking-[0.12em] text-nw-gulf-blue hover:underline"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                Open full items view →
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="border border-[var(--border-default)] bg-[var(--bg-card)] p-6 text-[13px] text-[var(--text-tertiary)]">
              Loading items…
            </div>
          ) : state && state.items.length === 0 ? (
            <div className="border border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-center">
              <p className="text-[14px] text-[var(--text-primary)] font-medium">
                No items yet.
              </p>
              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                Upload invoices to start building your cost intelligence database.
              </p>
              <Link
                href="/invoices"
                className="inline-block mt-4 h-[36px] px-4 border border-[var(--border-strong)] text-[11px] uppercase tracking-[0.12em] text-[var(--text-primary)] leading-[36px] hover:bg-[var(--bg-subtle)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                Go to invoices →
              </Link>
            </div>
          ) : state ? (
            <ItemsGroupedTable items={state.items} groupBy={groupBy} />
          ) : null}
        </section>
      </main>
    </AppShell>
  );
}

function KpiCard({
  label,
  value,
  subtext,
  href,
  warn,
}: {
  label: string;
  value: string;
  subtext?: string;
  href?: string;
  warn?: boolean;
}) {
  const inner = (
    <div
      className="border p-4 h-full"
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
        className="mt-2 text-[26px] text-[var(--text-primary)]"
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      {subtext && (
        <div className="mt-1.5 text-[11px] text-[var(--text-tertiary)]">{subtext}</div>
      )}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block hover:opacity-90 transition-opacity">
        {inner}
      </Link>
    );
  }
  return inner;
}

function KpiMoneyCard({
  label,
  cents,
  subtext,
}: {
  label: string;
  cents: number;
  subtext?: string;
}) {
  return (
    <div className="border border-[var(--border-default)] bg-[var(--bg-card)] p-4 h-full">
      <div
        className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        {label}
      </div>
      <div className="mt-2">
        <NwMoney cents={cents} size="xl" variant="emphasized" showCents={false} />
      </div>
      {subtext && (
        <div className="mt-1.5 text-[11px] text-[var(--text-tertiary)]">{subtext}</div>
      )}
    </div>
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
      className="inline-flex items-center border border-[var(--border-default)]"
      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
    >
      {opts.map((o, i) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 h-[30px] text-[10px] uppercase tracking-[0.12em] ${
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

function NeedsAttentionPanel({
  pendingVerification,
  pendingConversions,
  zeroVendorItems,
  uncategorizedItems,
}: {
  pendingVerification: number;
  pendingConversions: number;
  zeroVendorItems: ItemRowWithAgg[];
  uncategorizedItems: ItemRowWithAgg[];
}) {
  type AttentionItem = {
    id: string;
    icon: "queue" | "conversion" | "empty" | "uncategorized";
    text: string;
    href: string;
    badge?: string;
  };
  const entries: AttentionItem[] = [];
  if (pendingVerification > 0) {
    entries.push({
      id: "verification",
      icon: "queue",
      text: `${pendingVerification} line${pendingVerification === 1 ? "" : "s"} awaiting verification`,
      href: "/cost-intelligence/verification",
      badge: String(pendingVerification),
    });
  }
  if (pendingConversions > 0) {
    entries.push({
      id: "conversions",
      icon: "conversion",
      text: `${pendingConversions} unit conversion${pendingConversions === 1 ? "" : "s"} to confirm`,
      href: "/cost-intelligence/conversions",
      badge: String(pendingConversions),
    });
  }
  for (const item of zeroVendorItems.slice(0, 2)) {
    entries.push({
      id: `zero-${item.id}`,
      icon: "empty",
      text: `${item.canonical_name} — no vendor pricing yet`,
      href: `/cost-intelligence/items/${item.id}`,
    });
  }
  for (const item of uncategorizedItems.slice(0, 2)) {
    entries.push({
      id: `uncat-${item.id}`,
      icon: "uncategorized",
      text: `${item.canonical_name} — uncategorized`,
      href: `/cost-intelligence/items/${item.id}`,
    });
  }

  return (
    <section className="border border-[var(--border-default)] bg-[var(--bg-card)] p-5 h-full">
      <NwEyebrow tone="accent">Action Items</NwEyebrow>
      <h2
        className="mt-1 text-[18px] tracking-[-0.02em] text-[var(--text-primary)]"
        style={{ fontFamily: "var(--font-space-grotesk)" }}
      >
        Needs Attention
      </h2>
      {entries.length === 0 ? (
        <p className="mt-4 text-[13px] text-[var(--text-secondary)]">
          All clear. Verification queue is empty and items are classified.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-[var(--border-default)]">
          {entries.slice(0, 5).map((e) => (
            <li key={e.id} className="py-3 first:pt-0">
              <Link
                href={e.href}
                className="flex items-start justify-between gap-3 group"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <AttentionIcon type={e.icon} />
                  <span className="text-[13px] text-[var(--text-primary)] group-hover:text-nw-gulf-blue group-hover:underline">
                    {e.text}
                  </span>
                </div>
                {e.badge && <NwBadge variant="warning" size="sm">{e.badge}</NwBadge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AttentionIcon({ type }: { type: "queue" | "conversion" | "empty" | "uncategorized" }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  const pathFor: Record<typeof type, string> = {
    queue: "M2 3h8M2 6h8M2 9h5",
    conversion: "M2 6h8M8 3l3 3-3 3",
    empty: "M6 2v8M2 6h8",
    uncategorized: "M2 3h8v6H2zM2 6h8",
  };
  return (
    <span
      className="mt-0.5 shrink-0 inline-flex items-center justify-center w-6 h-6 border"
      style={{
        color: "var(--text-tertiary)",
        borderColor: "var(--border-default)",
        background: "var(--bg-subtle)",
      }}
    >
      <svg {...common} aria-hidden="true">
        <path d={pathFor[type]} />
      </svg>
    </span>
  );
}
