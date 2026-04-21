/**
 * Recent learnings feed.
 *
 * Aggregates three signals that mean "the system learned something
 * from a human" over the last 30 days:
 *
 *   1. New item aliases — vendor phrasings mapped to canonical items.
 *   2. Classification corrections — AI's guess overridden by a human.
 *   3. Confirmed unit conversion suggestions — AI-proposed ratios
 *      accepted as permanent rules.
 *
 * The output is flattened into a single chronological list for the
 * "Recent Learnings" panel on the Cost Intelligence hub. Empty list is
 * fine — the panel has its own empty state.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type LearningType = "alias" | "correction" | "conversion";

export interface LearningEntry {
  id: string;
  type: LearningType;
  timestamp: string;
  display_text: string;
  link_href: string | null;
}

const LOOKBACK_DAYS = 30;

export async function getRecentLearnings(
  supabase: SupabaseClient,
  orgId: string,
  limit = 5
): Promise<LearningEntry[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Pull a bit more than `limit` from each source so we can merge and trim.
  const overfetch = Math.max(limit * 3, 12);

  const [aliasesRes, correctionsRes, conversionsRes] = await Promise.all([
    supabase
      .from("item_aliases")
      .select("id, alias_text, created_at, item_id, vendor_id, items(canonical_name), vendors(name)")
      .eq("org_id", orgId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(overfetch),
    supabase
      .from("item_classification_corrections")
      .select(
        "id, source_text, ai_canonical_name, corrected_canonical_name, created_at, corrected_item_id, vendors(name)"
      )
      .eq("org_id", orgId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(overfetch),
    supabase
      .from("unit_conversion_suggestions")
      .select(
        "id, from_unit, to_unit, confirmed_ratio, suggested_ratio, confirmed_at, item_id, items(canonical_name)"
      )
      .eq("org_id", orgId)
      .eq("status", "confirmed")
      .gte("confirmed_at", since)
      .order("confirmed_at", { ascending: false })
      .limit(overfetch),
  ]);

  const entries: LearningEntry[] = [];

  type AliasRow = {
    id: string;
    alias_text: string;
    created_at: string;
    item_id: string;
    vendor_id: string | null;
    items: { canonical_name: string } | { canonical_name: string }[] | null;
    vendors: { name: string } | { name: string }[] | null;
  };
  for (const raw of (aliasesRes.data ?? []) as AliasRow[]) {
    const canonical = flat(raw.items)?.canonical_name ?? "(item)";
    const vendorName = flat(raw.vendors)?.name ?? null;
    const prefix = vendorName ? `${vendorName} ` : "";
    entries.push({
      id: `alias-${raw.id}`,
      type: "alias",
      timestamp: raw.created_at,
      display_text: `${prefix}"${raw.alias_text}" → ${canonical} — now auto-matches`,
      link_href: `/cost-intelligence/items/${raw.item_id}`,
    });
  }

  type CorrectionRow = {
    id: string;
    source_text: string;
    ai_canonical_name: string | null;
    corrected_canonical_name: string | null;
    created_at: string;
    corrected_item_id: string | null;
    vendors: { name: string } | { name: string }[] | null;
  };
  for (const raw of (correctionsRes.data ?? []) as CorrectionRow[]) {
    const vendorName = flat(raw.vendors)?.name ?? null;
    const vendorPrefix = vendorName ? `${vendorName} ` : "";
    const aiName = raw.ai_canonical_name ?? "(unknown)";
    const correctedName = raw.corrected_canonical_name ?? "(item)";
    entries.push({
      id: `correction-${raw.id}`,
      type: "correction",
      timestamp: raw.created_at,
      display_text: `${vendorPrefix}corrected "${raw.source_text}" from ${aiName} → ${correctedName}`,
      link_href: raw.corrected_item_id
        ? `/cost-intelligence/items/${raw.corrected_item_id}`
        : null,
    });
  }

  type ConversionRow = {
    id: string;
    from_unit: string;
    to_unit: string;
    confirmed_ratio: number | null;
    suggested_ratio: number;
    confirmed_at: string | null;
    item_id: string;
    items: { canonical_name: string } | { canonical_name: string }[] | null;
  };
  for (const raw of (conversionsRes.data ?? []) as ConversionRow[]) {
    const canonical = flat(raw.items)?.canonical_name ?? "(item)";
    const ratio = raw.confirmed_ratio ?? raw.suggested_ratio;
    entries.push({
      id: `conversion-${raw.id}`,
      type: "conversion",
      timestamp: raw.confirmed_at ?? new Date().toISOString(),
      display_text: `Confirmed: 1 ${raw.from_unit} of ${canonical} = ${formatRatio(ratio)} ${raw.to_unit}`,
      link_href: `/cost-intelligence/items/${raw.item_id}`,
    });
  }

  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return entries.slice(0, limit);
}

function flat<T>(v: T | T[] | null): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function formatRatio(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(n < 1 ? 4 : 2);
}

export function relativeTimeLabel(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const delta = Date.now() - then;
  const days = Math.round(delta / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
