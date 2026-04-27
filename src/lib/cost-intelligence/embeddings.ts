/**
 * OpenAI text embedding pipeline.
 *
 * Phase 3.3 (Cost Intelligence Foundation) — provides:
 *   1. generateEmbedding(text) → 1536-dim vector via OpenAI's
 *      text-embedding-3-small. Logs every call to api_usage with
 *      function_type='embedding' so cost is metered alongside Claude.
 *   2. callOpenAIEmbeddings(opts) — full-featured wrapper with org_id
 *      attribution, error handling, and api_usage logging. Mirrors the
 *      shape of callClaude() in src/lib/claude.ts.
 *   3. backfillItemEmbeddings(supabase, orgId) — batch utility for
 *      populating embeddings on existing items rows. Manual-trigger
 *      only in Phase 3.3; embedding-on-create wiring into
 *      commit-line-to-spine.ts is deferred to a later phase per
 *      addendum-B.
 *
 * No new SDK dependency: uses raw fetch() against
 * https://api.openai.com/v1/embeddings. text-embedding-3-small is
 * $0.02 per 1M tokens — negligible at proposal/invoice volumes.
 *
 * The OPENAI_API_KEY environment variable is required. assertOpenAIKey()
 * throws fast with a clear message if it's missing — call sites should
 * invoke it once at startup or before the first embedding call. The
 * pattern is failure-loud (throws) rather than failure-silent (the
 * RESEND_API_KEY pattern in notifications.ts) because embeddings are
 * NOT optional — if the key is missing, similarity search will be
 * silently broken, and a thrown error surfaces that immediately.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

// OpenAI pricing for text-embedding-3-small (USD per 1M tokens, input only —
// embeddings have no output side). Source: https://openai.com/api/pricing
const PRICE_PER_MTOK = 0.02;

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

/**
 * Throws fast if OPENAI_API_KEY is not configured. Call this once at
 * startup of any code path that will hit embeddings — surfaces the
 * configuration gap immediately instead of failing silently mid-pipeline.
 */
export function assertOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.length < 10 || key === "sk-placeholder") {
    throw new Error(
      "OPENAI_API_KEY is not configured. Set it in .env.local (or your deploy environment) before running embeddings. text-embedding-3-small is required for cost-intelligence similarity search."
    );
  }
  return key;
}

export interface CallOpenAIEmbeddingsOptions {
  /** Single string or array of strings (OpenAI batches up to 2048 inputs). */
  input: string | string[];
  /** Org paying for the call. Logged to api_usage. */
  org_id: string;
  /** Optional user attribution. Null when system-triggered. */
  user_id?: string | null;
  /** Free-form context for the dashboard (item_id, source, etc). */
  metadata?: Record<string, unknown>;
}

export interface OpenAIEmbeddingResponse {
  embeddings: number[][];
  total_tokens: number;
  duration_ms: number;
}

interface UsageRow {
  org_id: string;
  user_id: string | null | undefined;
  function_type: "embedding";
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_cents: number | null;
  duration_ms: number;
  status: "success" | "error" | "timeout";
  error_message: string | null;
  metadata: Record<string, unknown> | null;
}

function estimateCostCents(inputTokens: number): number {
  // text-embedding-3-small: $0.02 per 1M tokens, input only.
  const dollars = (inputTokens * PRICE_PER_MTOK) / 1_000_000;
  // Round up to nearest cent — small calls round to 1¢ minimum to keep
  // metering visible in the dashboard.
  return Math.max(1, Math.ceil(dollars * 100));
}

/**
 * Write a row to api_usage. Same fall-through pattern as
 * src/lib/claude.ts logUsage(): service role preferred, SSR fallback,
 * any failure logged but swallowed (a dropped usage row is a metering
 * bug, not a user-facing error).
 */
async function logUsage(row: UsageRow): Promise<void> {
  const insert = {
    org_id: row.org_id,
    user_id: row.user_id ?? null,
    function_type: row.function_type,
    model: row.model,
    input_tokens: row.input_tokens,
    output_tokens: row.output_tokens,
    total_tokens: row.input_tokens ?? 0,
    estimated_cost_cents: row.estimated_cost_cents,
    duration_ms: row.duration_ms,
    status: row.status,
    error_message: row.error_message,
    metadata: row.metadata,
  };

  const service = tryCreateServiceRoleClient();
  if (service) {
    const { error } = await service.from("api_usage").insert(insert);
    if (!error) return;
    console.error("[embeddings] service-role insert failed:", error.message);
  }

  try {
    const { createServerClient } = await import("@/lib/supabase/server");
    const ssr = createServerClient();
    const { error } = await ssr.from("api_usage").insert(insert);
    if (error) {
      console.error("[embeddings] SSR insert failed:", error.message);
    }
  } catch (err) {
    console.error(
      "[embeddings] unable to log api_usage (no service role, no request context):",
      err
    );
  }
}

/**
 * Call OpenAI's embeddings endpoint with metering + logging. Returns
 * the embedding vectors (one per input) plus token count + duration.
 */
export async function callOpenAIEmbeddings(
  opts: CallOpenAIEmbeddingsOptions
): Promise<OpenAIEmbeddingResponse> {
  const apiKey = assertOpenAIKey();
  const inputs = Array.isArray(opts.input) ? opts.input : [opts.input];
  if (inputs.length === 0) {
    throw new Error("callOpenAIEmbeddings: empty input array");
  }
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetch(OPENAI_EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: inputs,
        encoding_format: "float",
      }),
    });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    await logUsage({
      org_id: opts.org_id,
      user_id: opts.user_id,
      function_type: "embedding",
      model: EMBEDDING_MODEL,
      input_tokens: null,
      output_tokens: null,
      estimated_cost_cents: null,
      duration_ms: durationMs,
      status: "error",
      error_message: err instanceof Error ? err.message : String(err),
      metadata: opts.metadata ?? null,
    });
    throw new Error(
      `OpenAI embeddings network error: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const durationMs = Date.now() - startedAt;
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    await logUsage({
      org_id: opts.org_id,
      user_id: opts.user_id,
      function_type: "embedding",
      model: EMBEDDING_MODEL,
      input_tokens: null,
      output_tokens: null,
      estimated_cost_cents: null,
      duration_ms: durationMs,
      status: "error",
      error_message: `HTTP ${response.status}: ${text.slice(0, 200)}`,
      metadata: opts.metadata ?? null,
    });
    throw new Error(`OpenAI embeddings HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  const json = (await response.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
    usage: { prompt_tokens: number; total_tokens: number };
  };

  // Re-order by index just in case (OpenAI sorts by input order, but be defensive).
  const ordered = [...json.data].sort((a, b) => a.index - b.index);
  const embeddings = ordered.map((d) => d.embedding);

  // Validate dimension on first vector — abort if OpenAI returns the wrong size.
  if (embeddings[0]?.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected embedding dimension ${EMBEDDING_DIMENSIONS} but got ${embeddings[0]?.length}. Model may have changed.`
    );
  }

  const totalTokens = json.usage.total_tokens;
  await logUsage({
    org_id: opts.org_id,
    user_id: opts.user_id,
    function_type: "embedding",
    model: EMBEDDING_MODEL,
    input_tokens: totalTokens,
    output_tokens: null,
    estimated_cost_cents: estimateCostCents(totalTokens),
    duration_ms: durationMs,
    status: "success",
    error_message: null,
    metadata: { ...(opts.metadata ?? {}), input_count: inputs.length },
  });

  return {
    embeddings,
    total_tokens: totalTokens,
    duration_ms: durationMs,
  };
}

/**
 * Convenience wrapper: embed a single string and return its 1536-dim vector.
 */
export async function generateEmbedding(
  text: string,
  ctx: { org_id: string; user_id?: string | null; metadata?: Record<string, unknown> }
): Promise<number[]> {
  const result = await callOpenAIEmbeddings({
    input: text,
    org_id: ctx.org_id,
    user_id: ctx.user_id,
    metadata: ctx.metadata,
  });
  return result.embeddings[0];
}

/**
 * Format a number[] as a pgvector literal string ('[1.2,3.4,...]'). The
 * Supabase JS client accepts this string when inserting/updating a
 * VECTOR column.
 */
export function vectorLiteral(vec: number[]): string {
  return "[" + vec.map((n) => (Number.isFinite(n) ? n.toString() : "0")).join(",") + "]";
}

export interface BackfillOptions {
  /** Hard limit on rows touched per run. Default 1000. */
  limit?: number;
  /** OpenAI batch size (rows per API call). Max 2048; default 50. */
  batchSize?: number;
  /** If false, skip rows where embedding IS NOT NULL. Default true. */
  skipExisting?: boolean;
  /** User attribution for api_usage rows. Default null (system). */
  userId?: string | null;
}

export interface BackfillResult {
  scanned: number;
  embedded: number;
  skipped: number;
  errored: number;
  total_tokens: number;
  estimated_cost_cents: number;
}

/**
 * Manually populate items.embedding for an org's existing rows.
 *
 * Phase 3.3 doesn't wire embedding-on-create into the matcher; this
 * function is the only way to fill the column for existing items in
 * dev. Run from a Node script (admin context) — uses the supabase
 * client passed in (typically service-role) so it can update items
 * regardless of RLS.
 *
 * Builds the embedding input from canonical_name + category + specs
 * (when set) so the vector captures more than just the name. Updates
 * are atomic per row to keep the function safe to retry.
 */
export async function backfillItemEmbeddings(
  supabase: SupabaseClient,
  orgId: string,
  opts: BackfillOptions = {}
): Promise<BackfillResult> {
  assertOpenAIKey();
  const limit = opts.limit ?? 1000;
  const batchSize = Math.min(opts.batchSize ?? 50, 2048);
  const skipExisting = opts.skipExisting !== false;

  let q = supabase
    .from("items")
    .select("id, canonical_name, category, subcategory, specs, embedding")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .limit(limit);
  if (skipExisting) q = q.is("embedding", null);

  const { data: rows, error } = await q;
  if (error) {
    throw new Error(`backfillItemEmbeddings: failed to load items: ${error.message}`);
  }

  type ItemRow = {
    id: string;
    canonical_name: string;
    category: string | null;
    subcategory: string | null;
    specs: Record<string, unknown> | null;
    embedding: unknown;
  };

  const items = (rows ?? []) as ItemRow[];
  const result: BackfillResult = {
    scanned: items.length,
    embedded: 0,
    skipped: 0,
    errored: 0,
    total_tokens: 0,
    estimated_cost_cents: 0,
  };

  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    const inputs = slice.map((r) => itemEmbeddingInput(r));

    let response: OpenAIEmbeddingResponse;
    try {
      response = await callOpenAIEmbeddings({
        input: inputs,
        org_id: orgId,
        user_id: opts.userId ?? null,
        metadata: { source: "backfillItemEmbeddings", batch_size: slice.length },
      });
    } catch (err) {
      console.error(
        `[embeddings] backfill batch failed: ${err instanceof Error ? err.message : err}`
      );
      result.errored += slice.length;
      continue;
    }

    result.total_tokens += response.total_tokens;
    result.estimated_cost_cents += estimateCostCents(response.total_tokens);

    for (let j = 0; j < slice.length; j++) {
      const row = slice[j];
      const vec = response.embeddings[j];
      if (!vec) {
        result.errored++;
        continue;
      }
      const { error: updateErr } = await supabase
        .from("items")
        .update({ embedding: vectorLiteral(vec) })
        .eq("id", row.id)
        .eq("org_id", orgId);
      if (updateErr) {
        console.error(`[embeddings] update failed for item ${row.id}: ${updateErr.message}`);
        result.errored++;
        continue;
      }
      result.embedded++;
    }
  }

  result.skipped = result.scanned - result.embedded - result.errored;
  return result;
}

/**
 * Build the string we embed for an item. Uses canonical_name as the
 * primary signal but adds category/subcategory and a flat list of
 * specs key:value pairs so two items with the same name but different
 * specs (e.g. "2x4 SPF" with different lengths) end up at different
 * points in the embedding space.
 *
 * Exported so the seed script (Phase 3.3 commit 7) and Phase 3.4+
 * pipelines can produce identical inputs and avoid embedding drift.
 */
export function itemEmbeddingInput(item: {
  canonical_name: string;
  category?: string | null;
  subcategory?: string | null;
  specs?: Record<string, unknown> | null;
}): string {
  const parts: string[] = [item.canonical_name];
  if (item.category) parts.push(`category: ${item.category}`);
  if (item.subcategory) parts.push(`subcategory: ${item.subcategory}`);
  if (item.specs && typeof item.specs === "object" && !Array.isArray(item.specs)) {
    const specPairs = Object.entries(item.specs)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `${k}: ${String(v)}`);
    if (specPairs.length > 0) parts.push(`specs: ${specPairs.join(", ")}`);
  }
  return parts.join(" | ");
}
