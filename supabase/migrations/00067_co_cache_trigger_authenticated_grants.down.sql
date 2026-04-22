-- Reverse of 00067. Revokes the authenticated grants that make
-- co_cache_trigger fireable from Next.js @supabase/ssr routes.
--
-- Rolling this back re-opens the latent bug: any authenticated-role
-- INSERT/UPDATE/DELETE on public.change_orders will fail with 42501
-- "permission denied for schema app_private" because the trigger chain
-- needs USAGE on that schema.

ALTER DEFAULT PRIVILEGES IN SCHEMA app_private
  REVOKE EXECUTE ON FUNCTIONS FROM authenticated;

REVOKE EXECUTE ON FUNCTION app_private.refresh_approved_cos_total(uuid)
  FROM authenticated;

REVOKE EXECUTE ON FUNCTION app_private.co_cache_trigger()
  FROM authenticated;

REVOKE USAGE ON SCHEMA app_private FROM authenticated;
