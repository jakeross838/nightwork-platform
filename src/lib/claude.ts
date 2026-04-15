/**
 * Claude API wrapper.
 *
 * All Claude calls in the app flow through `callClaude` so that:
 *   1. Usage is metered per-org (plan limits are enforced BEFORE the call).
 *   2. Every call is logged to api_usage with token counts, duration, and
 *      estimated cost in cents.
 *   3. Retries for transient overload/rate-limit errors happen in one place.
 *
 * The wrapper is a drop-in for `getAnthropic().messages.create(...)`:
 * callers pass the same params plus `function_type`, `org_id`, and (optionally)
 * `user_id` + `metadata`. It returns the raw Anthropic response so existing
 * parsing logic doesn't need to change.
 *
 * On plan-limit violations it throws `PlanLimitError`, which API routes catch
 * and surface as `{ error, current, limit, plan }` JSON.
 */
import Anthropic from "@anthropic-ai/sdk";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service";
import { checkPlanLimit, planDisplayName, type PlanSlug } from "@/lib/plan-limits";

// Anthropic pricing (USD per million tokens) for the Sonnet family. If we
// start using Opus/Haiku in this app we'll branch here.
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-opus-4-20250514": { input: 15, output: 75 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};
const DEFAULT_PRICING = { input: 3, output: 15 };

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

export type CallClaudeOptions = Anthropic.Messages.MessageCreateParamsNonStreaming & {
  /** Short category describing *why* we're calling Claude — grouped in the usage dashboard. */
  function_type: string;
  /** Org paying for the call. Every call must be tagged to an org. */
  org_id: string;
  /** Optional user attribution. Null when the call is system-triggered. */
  user_id?: string | null;
  /** Free-form context the dashboard can pivot on (invoice_id, job_id, etc). */
  metadata?: Record<string, unknown>;
};

/**
 * Thrown when the org has hit its monthly AI call limit. API routes should
 * convert this into an HTTP 429 JSON response with the `current`/`limit`/`plan`
 * fields intact so the UI can show a proper upgrade prompt.
 */
export class PlanLimitError extends Error {
  readonly code = "plan_limit_reached" as const;
  readonly current: number;
  readonly limit: number;
  readonly plan: PlanSlug;

  constructor(current: number, limit: number, plan: PlanSlug) {
    super(
      `AI call limit reached: used ${current} of ${limit} this month on ${planDisplayName(plan)}.`
    );
    this.current = current;
    this.limit = limit;
    this.plan = plan;
    this.name = "PlanLimitError";
  }
}

function estimateCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING_PER_MTOK[model] ?? DEFAULT_PRICING;
  const dollars =
    (inputTokens * pricing.input) / 1_000_000 +
    (outputTokens * pricing.output) / 1_000_000;
  return Math.ceil(dollars * 100);
}

type UsageRow = {
  org_id: string;
  user_id: string | null | undefined;
  function_type: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_cents: number | null;
  duration_ms: number;
  status: "success" | "error" | "timeout";
  error_message: string | null;
  metadata: Record<string, unknown> | null;
};

function rowToInsert(row: UsageRow) {
  return {
    org_id: row.org_id,
    user_id: row.user_id ?? null,
    function_type: row.function_type,
    model: row.model,
    input_tokens: row.input_tokens,
    output_tokens: row.output_tokens,
    estimated_cost_cents: row.estimated_cost_cents,
    duration_ms: row.duration_ms,
    status: row.status,
    error_message: row.error_message,
    metadata: row.metadata,
  };
}

/**
 * Write a row to api_usage. Prefers the service-role client so inserts work
 * regardless of caller context, but falls back to the authenticated SSR
 * client when service role isn't configured (local dev without
 * SUPABASE_SERVICE_ROLE_KEY). The fallback path relies on the
 * "members insert api_usage" RLS policy.
 *
 * Any failure here is logged but swallowed — a dropped usage row is a
 * metering bug, not a user-facing error.
 */
async function logUsage(row: UsageRow): Promise<void> {
  const insert = rowToInsert(row);

  // 1. Preferred path: service role.
  const service = tryCreateServiceRoleClient();
  if (service) {
    const { error } = await service.from("api_usage").insert(insert);
    if (!error) return;
    console.error("[claude] service-role insert failed:", error.message);
    // Fall through to the SSR fallback on a real error.
  }

  // 2. Fallback: authenticated SSR client. Only works inside a Next.js
  //    request context — scripts will hit the dynamic-import error and
  //    skip silently, which is fine for dev.
  try {
    const { createServerClient } = await import("@/lib/supabase/server");
    const ssr = createServerClient();
    const { error } = await ssr.from("api_usage").insert(insert);
    if (error) {
      console.error("[claude] SSR insert failed:", error.message);
    }
  } catch (err) {
    console.error("[claude] unable to log api_usage (no service role, no request context):", err);
  }
}

async function callWithRetry(
  fn: () => Promise<Anthropic.Messages.Message>,
  maxRetries = 5
): Promise<Anthropic.Messages.Message> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable =
        err instanceof Anthropic.APIError &&
        (err.status === 529 || err.status === 503 || err.status === 429);
      if (!isRetryable || attempt === maxRetries) {
        if (isRetryable) {
          throw new Error("Claude API is overloaded. Please try again in a minute.");
        }
        throw err;
      }
      const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
      console.log(`Claude API overloaded, retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Retry logic failed unexpectedly");
}

/**
 * Call the Claude messages API with metering + logging. Returns the raw
 * Anthropic response so callers can extract content blocks the same way as
 * before.
 *
 * Throws `PlanLimitError` when the org has exhausted its monthly allowance —
 * the call is NOT made in that case (so we don't charge the API for a request
 * we've already decided to block).
 */
export async function callClaude(
  opts: CallClaudeOptions
): Promise<Anthropic.Messages.Message> {
  const { function_type, org_id, user_id, metadata, ...apiParams } = opts;

  // 1. Enforce plan limit BEFORE spending real money on an API call.
  const limit = await checkPlanLimit(org_id, "ai_calls");
  if (!limit.allowed) {
    throw new PlanLimitError(limit.current, limit.limit, limit.plan);
  }

  const startedAt = Date.now();
  try {
    const response = await callWithRetry(() =>
      getAnthropic().messages.create(apiParams)
    );
    const durationMs = Date.now() - startedAt;
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;

    await logUsage({
      org_id,
      user_id,
      function_type,
      model: apiParams.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_cents: estimateCostCents(apiParams.model, inputTokens, outputTokens),
      duration_ms: durationMs,
      status: "success",
      error_message: null,
      metadata: metadata ?? null,
    });

    return response;
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = /timeout|timed out/i.test(message);
    await logUsage({
      org_id,
      user_id,
      function_type,
      model: apiParams.model,
      input_tokens: null,
      output_tokens: null,
      estimated_cost_cents: null,
      duration_ms: durationMs,
      status: isTimeout ? "timeout" : "error",
      error_message: message.slice(0, 1000),
      metadata: metadata ?? null,
    });
    throw err;
  }
}
