import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS — NEVER call this from a
 * client component or a route that returns data to end users. It exists
 * for trusted server-to-server flows only, e.g. Stripe webhook handlers
 * that need to mutate an org they don't have a session for.
 */
let cached: SupabaseClient | null = null;

export function createServiceRoleClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set to use the service-role client. See .env.example."
    );
  }
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * Best-effort variant. Returns null when SUPABASE_SERVICE_ROLE_KEY is not
 * configured instead of throwing — used by non-critical paths like the
 * api_usage logger and plan-limit counter where a missing service key
 * should NOT break the user's flow (we'd rather skip logging than fail the
 * invoice upload).
 */
export function tryCreateServiceRoleClient(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * Startup-time assertion that SUPABASE_SERVICE_ROLE_KEY is set and
 * non-empty. Call this ONCE at server boot (from instrumentation.ts).
 * Fails loudly with remediation guidance — designed to catch the
 * silent-degradation pattern where a fresh dev checkout or unset
 * production env causes audit logs, plan-limit counters, bulk imports,
 * and impersonation audits to all silently skip via the best-effort
 * fallback in `tryCreateServiceRoleClient`.
 *
 * Distinguishes "missing" from "empty string" — both fail. Does NOT
 * print the key value in the error message.
 *
 * The existing `tryCreateServiceRoleClient()` helper retains its
 * best-effort null-return semantics for code paths where a missing key
 * is acceptable. This assertion ONLY fires at startup so production
 * boot fails fast instead of degrading silently per request.
 */
export function assertServiceRoleKey(): void {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key.trim() === "") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Set it in .env.local (dev) " +
        "or your hosting provider's env settings (production). " +
        "Get the value from Supabase Dashboard → Project Settings → API → service_role key."
    );
  }
}
