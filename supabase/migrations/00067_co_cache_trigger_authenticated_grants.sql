-- ============================================================
-- 00067_co_cache_trigger_authenticated_grants.sql
-- ============================================================
-- Completes 00042's app_private permissions setup.
--
-- 00042 introduced app_private.co_cache_trigger (a table trigger on
-- public.change_orders) and app_private.refresh_approved_cos_total (the
-- cache-computation helper the trigger PERFORMs). 00042 granted USAGE on
-- the schema + EXECUTE on ALL FUNCTIONS only to `service_role`, with this
-- comment:
--
--   "service_role must be able to call app_private functions via the
--    trigger. Without this, CO inserts from the JS client (pay-app imports,
--    server scripts, admin ops) silently fail the cache update, leaving
--    approved_cos_total stale."
--
-- The grant set is incomplete for the production app. Next.js API routes
-- that use `@supabase/ssr`'s cookie-authenticated `createServerClient()`
-- execute as the `authenticated` role, not `service_role`. When such a
-- route issues an INSERT / UPDATE / DELETE on `public.change_orders`, the
-- co_cache_trigger fires in the authenticated role's context. Because
-- authenticated lacks USAGE on `app_private`, the trigger throws
-- `42501 permission denied for schema app_private` and the whole write
-- rolls back with an HTTP 500.
--
-- Discovered during Phase 2.3 R.19 live-workflow test (qa-reports/
-- qa-branch2-phase2.3.md §11). Before Phase 2.3 this latent bug was
-- dormant because the dev DB's 73 owner COs were all seeded via service-
-- role paths; no authenticated-role UI INSERT of a change_order had been
-- exercised post-00042. Phase 2.3's R.19 mitigation surfaced it.
--
-- Fix is minimal and matches the 00042 pattern:
--   1. GRANT USAGE ON SCHEMA app_private TO authenticated
--   2. GRANT EXECUTE on the two functions the trigger chain needs
--   3. ALTER DEFAULT PRIVILEGES so future app_private functions keep
--      authenticated working without another migration.
--
-- Why this scope, not more?
-- - We do NOT `GRANT EXECUTE ON ALL FUNCTIONS` to authenticated. Other
--   app_private functions (`cleanup_stale_import_errors`, `vip_after_insert`,
--   etc.) are intentionally scoped tighter; blanket-granting them would
--   expand attack surface.
-- - We do NOT change the trigger function's SECURITY DEFINER flag. The
--   underlying cache-computation helper `refresh_approved_cos_total` is
--   already SECURITY DEFINER and executes as postgres, so privileged
--   reads/writes are already handled at that layer. The trigger just
--   needs USAGE + EXECUTE to reach it.

GRANT USAGE ON SCHEMA app_private TO authenticated;

GRANT EXECUTE ON FUNCTION app_private.co_cache_trigger()
  TO authenticated;

GRANT EXECUTE ON FUNCTION app_private.refresh_approved_cos_total(uuid)
  TO authenticated;

-- Keep future app_private functions accessible to the JS client without a
-- separate migration each time. Mirrors 00042's service_role clause.
ALTER DEFAULT PRIVILEGES IN SCHEMA app_private
  GRANT EXECUTE ON FUNCTIONS TO authenticated;
