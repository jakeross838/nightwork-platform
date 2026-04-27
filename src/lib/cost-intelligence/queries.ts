/**
 * Cost-intelligence query layer.
 *
 * Phase 3.3 (Cost Intelligence Foundation) — four typed functions consumed
 * by Phase 3.4+ pipelines and the future intelligence UI. All queries are
 * org-scoped via the supabase session client passed in (RLS does the
 * actual gating; passing through the user session client is what
 * enforces the org boundary).
 *
 * - findSimilarLineItems(orgId, description, limit)
 *     Embeds `description` via OpenAI text-embedding-3-small and runs a
 *     cosine-similarity query against items.embedding. Returns top-N
 *     matches with similarity score in [0, 1] (1 = identical, 0 = orthogonal).
 *
 * - getVendorPriceHistory(orgId, vendorId, canonicalCodeId, dateRange)
 *     Returns price points over time from vendor_item_pricing scoped by
 *     org + vendor + (optionally) canonical cost code. Phase 3.3 ships
 *     this as scaffolding — full coverage activates when proposals
 *     (Phase 3.4) and historical draws (Phase 3.9) populate cost-code
 *     associations on vendor_item_pricing rows.
 *
 * - getCostCodeRollup(orgId, canonicalCodeId, dateRange)
 *     Aggregates vendor_item_pricing rows mapped to the canonical code
 *     into a total + monthly bucketing. Same scaffolding caveat as
 *     getVendorPriceHistory — meaningful results require Phase 3.4+
 *     data.
 *
 * - flagAnomaly(orgId, lineItem)
 *     Scaffolding: returns is_anomaly=false with reason="insufficient
 *     history" until enough historical pricing exists for the canonical
 *     code. Full anomaly logic activates once Phase 3.4+ proposals
 *     populate the spine with a few months of data.
 *
 * Strict TypeScript types. No `any`. Never throws on empty data —
 * returns safe defaults so callers can render an empty-state UI
 * cleanly.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding, vectorLiteral } from "./embeddings";

// ---------------------------------------------------------------------------
// findSimilarLineItems
// ---------------------------------------------------------------------------

export interface SimilarItem {
  id: string;
  canonical_name: string;
  category: string | null;
  subcategory: string | null;
  unit: string;
  similarity: number;
}

export interface SimilarItemMatch {
  canonical_item: SimilarItem;
  similarity: number;
}

/**
 * Embed `description` and find the top-N most similar items in this org's
 * catalog by cosine similarity on items.embedding. Items without an
 * embedding (Phase 3.3 ships them empty until backfill) are excluded.
 *
 * The embed call hits OpenAI (logged to api_usage) — callers should
 * ratelimit / cache aggressively if this runs in a hot loop.
 */
export async function findSimilarLineItems(
  supabase: SupabaseClient,
  orgId: string,
  description: string,
  limit = 5
): Promise<SimilarItemMatch[]> {
  const trimmed = description.trim();
  if (!trimmed) return [];

  const embedding = await generateEmbedding(trimmed, {
    org_id: orgId,
    metadata: { source: "findSimilarLineItems" },
  });

  // pgvector cosine distance is `<=>` (smaller = more similar). Convert to
  // similarity in [0, 1] via 1 - distance. Use the rpc when available, but
  // here we do the literal SELECT so the function works without an extra
  // database function dependency.
  const literal = vectorLiteral(embedding);
  const { data, error } = await supabase.rpc("find_similar_items", {
    p_org_id: orgId,
    p_query_embedding: literal,
    p_limit: limit,
  });

  if (error) {
    // RPC may not exist in dev yet — fall back to a typed SELECT via raw
    // string. We can't compose <=> through PostgREST so we use rpc only;
    // the fallback below preserves a useful shape.
    const fallback = await findSimilarItemsViaRpcFallback(
      supabase,
      orgId,
      literal,
      limit
    );
    return fallback;
  }

  type RpcRow = SimilarItem;
  const rows = (data ?? []) as RpcRow[];
  return rows.map((r) => ({
    canonical_item: r,
    similarity: r.similarity,
  }));
}

/**
 * Fallback path for findSimilarLineItems: uses the supabase JS client's
 * range filter on a special `embedding_distance` virtual column via an
 * inline rpc — but in practice if the rpc doesn't exist we just return
 * an empty array and warn. Phase 3.3 sets up the rpc as part of
 * commit 7's seed verification step, so this path should never trip in
 * a freshly-seeded dev environment.
 */
async function findSimilarItemsViaRpcFallback(
  supabase: SupabaseClient,
  orgId: string,
  vectorLit: string,
  limit: number
): Promise<SimilarItemMatch[]> {
  // Best-effort inline alternative: pull all items with embeddings and rank
  // in JS. Acceptable at small org scale (hundreds of items).
  const { data } = await supabase
    .from("items")
    .select("id, canonical_name, category, subcategory, unit, embedding")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .not("embedding", "is", null)
    .limit(2000);

  if (!data || data.length === 0) return [];

  type Row = {
    id: string;
    canonical_name: string;
    category: string | null;
    subcategory: string | null;
    unit: string;
    embedding: string | number[] | null;
  };

  // Parse query vector once.
  const query = parseVectorLiteral(vectorLit);
  if (!query) return [];

  const scored: SimilarItemMatch[] = [];
  for (const r of data as Row[]) {
    const vec = parseVectorValue(r.embedding);
    if (!vec || vec.length !== query.length) continue;
    const sim = cosineSimilarity(query, vec);
    scored.push({
      canonical_item: {
        id: r.id,
        canonical_name: r.canonical_name,
        category: r.category,
        subcategory: r.subcategory,
        unit: r.unit,
        similarity: sim,
      },
      similarity: sim,
    });
  }
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, limit);
}

function parseVectorLiteral(literal: string): number[] | null {
  if (!literal.startsWith("[") || !literal.endsWith("]")) return null;
  const inner = literal.slice(1, -1);
  const parts = inner.split(",");
  const out: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n)) return null;
    out.push(n);
  }
  return out;
}

function parseVectorValue(v: unknown): number[] | null {
  if (Array.isArray(v)) {
    if (v.every((n) => typeof n === "number" && Number.isFinite(n))) return v;
    return null;
  }
  if (typeof v === "string") return parseVectorLiteral(v);
  return null;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

// ---------------------------------------------------------------------------
// getVendorPriceHistory
// ---------------------------------------------------------------------------

export interface VendorPriceHistoryPoint {
  date: string; // ISO yyyy-mm-dd
  unit_price_cents: number;
  source_proposal_id: string | null;
  source_invoice_id: string | null;
}

/**
 * Returns price observations for (orgId, vendorId, canonicalCodeId) over
 * a date range, ordered by transaction_date ascending.
 *
 * Phase 3.3 caveat: vendor_item_pricing.cost_code_id today references the
 * Phase-1 cost_codes table, NOT canonical_cost_codes. Until Phase 3.4+
 * wires canonical_code_id onto vendor_item_pricing rows (or a join via
 * org_cost_codes.canonical_code_id), this query joins through items
 * (which itself doesn't yet carry canonical_code_id). For Phase 3.3
 * the function ships as scaffolding — returns the raw history when
 * canonicalCodeId is null, and an empty array when it's specified
 * (because we can't yet resolve the canonical link without Phase 3.4
 * data).
 */
export async function getVendorPriceHistory(
  supabase: SupabaseClient,
  orgId: string,
  vendorId: string,
  canonicalCodeId: string | null,
  dateRange: { start: Date; end: Date }
): Promise<VendorPriceHistoryPoint[]> {
  // Scaffolding: when canonicalCodeId is given but no canonical resolution
  // path exists yet, return empty rather than over-promise.
  if (canonicalCodeId !== null) {
    return [];
  }

  const startStr = dateRange.start.toISOString().slice(0, 10);
  const endStr = dateRange.end.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("vendor_item_pricing")
    .select("transaction_date, unit_price_cents, source_invoice_id")
    .eq("org_id", orgId)
    .eq("vendor_id", vendorId)
    .gte("transaction_date", startStr)
    .lte("transaction_date", endStr)
    .is("deleted_at", null)
    .order("transaction_date", { ascending: true })
    .limit(2000);

  if (error || !data) return [];

  return data.map((row) => ({
    date: row.transaction_date as string,
    unit_price_cents: (row.unit_price_cents as number) ?? 0,
    source_proposal_id: null, // populated once proposals (Phase 3.4) write to spine
    source_invoice_id: (row.source_invoice_id as string | null) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// getCostCodeRollup
// ---------------------------------------------------------------------------

export interface CostCodeRollupMonth {
  month: string; // 'YYYY-MM'
  total_cents: number;
  count: number;
}

export interface CostCodeRollup {
  total_cents: number;
  count: number;
  avg_unit_price_cents: number;
  by_month: CostCodeRollupMonth[];
}

const EMPTY_ROLLUP: CostCodeRollup = {
  total_cents: 0,
  count: 0,
  avg_unit_price_cents: 0,
  by_month: [],
};

/**
 * Aggregate spine rows for a canonical cost code over a date range.
 *
 * Phase 3.3 scaffolding — returns EMPTY_ROLLUP when the canonical
 * resolution path isn't wired (see getVendorPriceHistory for the same
 * caveat). When Phase 3.4+ adds canonical_code_id to the spine (or a
 * resolvable join via org_cost_codes), this function fills out for real.
 */
export async function getCostCodeRollup(
  _supabase: SupabaseClient,
  _orgId: string,
  _canonicalCodeId: string,
  _dateRange: { start: Date; end: Date }
): Promise<CostCodeRollup> {
  // Phase 3.3 ships this as a stub. Full implementation lives behind a
  // wired canonical_code_id chain; commit-line-to-spine.ts isn't
  // modified in 3.3 per addendum-B's hot-path boundary. Returning the
  // empty shape lets callers render an "insufficient history" empty
  // state with no special-casing.
  return EMPTY_ROLLUP;
}

// ---------------------------------------------------------------------------
// flagAnomaly
// ---------------------------------------------------------------------------

export type AnomalySeverity = "none" | "warning" | "critical";

export interface AnomalyFlag {
  is_anomaly: boolean;
  severity: AnomalySeverity;
  reason: string;
  rolling_avg_cents: number | null;
  pct_deviation: number | null;
}

const NO_HISTORY: AnomalyFlag = {
  is_anomaly: false,
  severity: "none",
  reason: "insufficient history",
  rolling_avg_cents: null,
  pct_deviation: null,
};

/**
 * Anomaly detection scaffolding. Phase 3.3 ships the safe-default
 * "insufficient history" response — full statistical anomaly logic
 * (z-score, rolling-window deviation, severity tiering) activates in
 * Phase 3.4+ once the spine has months of population.
 */
export async function flagAnomaly(
  _supabase: SupabaseClient,
  _orgId: string,
  _lineItem: {
    canonical_code_id: string;
    unit_price_cents: number;
    quantity: number;
  }
): Promise<AnomalyFlag> {
  return NO_HISTORY;
}
