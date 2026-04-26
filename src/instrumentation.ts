// Next.js instrumentation hook — runs once per runtime before any request
// handlers load. Sentry pattern per @sentry/nextjs docs: dynamically
// require the runtime-specific config so Node code doesn't ship to edge
// and vice versa.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Fail fast at server boot if SUPABASE_SERVICE_ROLE_KEY is missing —
    // catches the silent-degradation pattern where audit logs, plan-limit
    // counters, bulk imports, and impersonation audits all skip via
    // tryCreateServiceRoleClient()'s best-effort null return.
    const { assertServiceRoleKey } = await import("@/lib/supabase/service");
    assertServiceRoleKey();
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
