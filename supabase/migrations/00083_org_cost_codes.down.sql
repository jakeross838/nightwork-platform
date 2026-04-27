-- Down migration for 00083_org_cost_codes.sql
--
-- Drops the org_cost_codes table + trigger + function. Per-tenant data
-- is destroyed by this drop — only run if you mean it.

DROP TRIGGER IF EXISTS org_cost_codes_updated_at_trigger ON public.org_cost_codes;
DROP FUNCTION IF EXISTS public.org_cost_codes_set_updated_at();

DROP POLICY IF EXISTS org_cost_codes_org_read ON public.org_cost_codes;
DROP POLICY IF EXISTS org_cost_codes_org_write ON public.org_cost_codes;
DROP POLICY IF EXISTS org_cost_codes_org_update ON public.org_cost_codes;

DROP TABLE IF EXISTS public.org_cost_codes;
