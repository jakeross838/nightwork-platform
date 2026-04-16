/**
 * Plan limits and enforcement.
 *
 * Single source of truth for what a given subscription plan allows. Referenced
 * by the Claude API wrapper (before making a paid call), by the invite flow
 * (before creating a new org_member), and by the job creation route. Also
 * rendered on the usage dashboard.
 *
 * Limits of -1 mean unlimited for that dimension. Storage is not tracked
 * precisely yet — organizations.storage_used_bytes is a placeholder that
 * future storage-webhook plumbing will fill in.
 */
import { createClient } from "@supabase/supabase-js";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service";

export type PlanSlug = "free_trial" | "starter" | "professional" | "enterprise";

export type PlanLimits = {
  max_ai_calls_per_month: number;
  max_users: number;
  max_active_jobs: number;
  max_storage_gb: number;
};

export const PLAN_LIMITS: Record<PlanSlug, PlanLimits> = {
  free_trial: {
    max_ai_calls_per_month: 100,
    max_users: 3,
    max_active_jobs: 3,
    max_storage_gb: 2,
  },
  starter: {
    max_ai_calls_per_month: 500,
    max_users: 5,
    max_active_jobs: 5,
    max_storage_gb: 25,
  },
  professional: {
    max_ai_calls_per_month: 2500,
    max_users: 15,
    max_active_jobs: 25,
    max_storage_gb: 100,
  },
  enterprise: {
    max_ai_calls_per_month: -1,
    max_users: -1,
    max_active_jobs: -1,
    max_storage_gb: 500,
  },
};

export type LimitType = "ai_calls" | "users" | "active_jobs" | "storage";

export type LimitCheck = {
  allowed: boolean;
  current: number;
  limit: number;
  plan: PlanSlug;
};

/**
 * Return the first day of the current calendar month, in UTC.
 * Used by the ai_calls counter — plans reset on the 1st regardless of when
 * the org signed up. We'll shift to billing-period boundaries when the
 * Stripe subscription lifecycle lands.
 */
function startOfCurrentMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * Check whether an org is currently under the limit for a given dimension.
 *
 * Uses the service-role client on purpose — the caller may be a server route
 * that hasn't yet established a full Supabase session (e.g. webhook-driven
 * code), and RLS would otherwise block the aggregate queries. Never call
 * from client components.
 */
/**
 * Return a Supabase client for aggregate queries, in priority order:
 *   1. Service-role client (bypasses RLS — works from any server context).
 *   2. Authenticated SSR client (works inside a Next.js request, RLS
 *      respected — which is fine because admins/owners have read policies
 *      on api_usage and org_members).
 *   3. Anon client (always returns zero counts under RLS; used only as a
 *      last-ditch fail-open).
 */
async function getQueryClient() {
  const service = tryCreateServiceRoleClient();
  if (service) return service;
  try {
    const { createServerClient } = await import("@/lib/supabase/server");
    return createServerClient();
  } catch {
    // Not in a Next.js request context. Fall through.
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function checkPlanLimit(
  orgId: string,
  limitType: LimitType
): Promise<LimitCheck> {
  const supabase = await getQueryClient();
  if (!supabase) {
    // Fail open: without Supabase creds we can't meter anything. The UI
    // will still render, just with zeroed-out counters.
    return { allowed: true, current: 0, limit: -1, plan: "free_trial" };
  }

  // Resolve the plan first — every dimension needs it.
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("subscription_plan")
    .eq("id", orgId)
    .maybeSingle();

  if (orgErr || !org) {
    // Fail open rather than hard-block the app if the org row is missing.
    // The deeper auth/session layer will catch a truly missing org.
    return { allowed: true, current: 0, limit: -1, plan: "free_trial" };
  }

  const plan = (org.subscription_plan ?? "free_trial") as PlanSlug;
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free_trial;

  let current = 0;
  let limit = -1;

  if (limitType === "ai_calls") {
    limit = limits.max_ai_calls_per_month;
    const { count } = await supabase
      .from("api_usage")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("created_at", startOfCurrentMonthIso());
    current = count ?? 0;
  } else if (limitType === "users") {
    limit = limits.max_users;
    const { count } = await supabase
      .from("org_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("is_active", true);
    current = count ?? 0;
  } else if (limitType === "active_jobs") {
    limit = limits.max_active_jobs;
    const { count } = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "active")
      .is("deleted_at", null);
    current = count ?? 0;
  } else if (limitType === "storage") {
    limit = limits.max_storage_gb;
    // storage_used_bytes is the existing column on organizations. No
    // real tracking pipeline yet — future work.
    const { data: row } = await supabase
      .from("organizations")
      .select("storage_used_bytes")
      .eq("id", orgId)
      .maybeSingle();
    const bytes = (row?.storage_used_bytes as number | null) ?? 0;
    current = Math.round(bytes / (1024 * 1024 * 1024));
  }

  // Unlimited tier: always allowed, but still report the usage for the UI.
  const allowed = limit === -1 ? true : current < limit;

  return { allowed, current, limit, plan };
}

/**
 * Convenience label used by UI copy and error messages.
 */
export function planDisplayName(plan: PlanSlug): string {
  switch (plan) {
    case "free_trial":
      return "Free Trial";
    case "starter":
      return "Starter";
    case "professional":
      return "Pro";
    case "enterprise":
      return "Enterprise";
  }
}
