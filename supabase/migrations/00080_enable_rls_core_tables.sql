-- ============================================================
-- 00080_enable_rls_core_tables.sql — Phase A Lockdown / D-1
-- ============================================================
-- Audit reference: qa-reports/audit-data.md D-1 (CRITICAL —
-- "No ENABLE ROW LEVEL SECURITY statement for 8 core tenant
-- tables in migrations").
--
-- 8 core tables affected:
--   public.jobs
--   public.invoices
--   public.draws
--   public.draw_line_items
--   public.vendors
--   public.budget_lines
--   public.purchase_orders
--   public.cost_codes
--
-- Why this migration exists: every one of the 8 tables already
-- has RLS policies (created in 00009, 00016, 00043, 00046, etc.)
-- but no migration ever ran ALTER TABLE ... ENABLE ROW LEVEL
-- SECURITY. Enablement was performed by hand in the Supabase
-- dashboard on the live dev/prod DBs, so the policies are honored
-- there — but a fresh deploy from migration files alone (CI, new
-- dev env, disaster recovery) produces a system where every
-- policy is silently inert and all rows are world-readable to
-- any authenticated session.
--
-- This migration ONLY enables and forces RLS. It does not create,
-- drop, or modify any policy — those already exist and are
-- audit-verified.
--
-- Why FORCE in addition to ENABLE: ENABLE applies RLS to non-
-- owners of the table; FORCE applies it to the table owner too
-- (the postgres role that owns these tables in Supabase). Without
-- FORCE, any service-role or owner-context query bypasses
-- policies. We want defense-in-depth: even owner-context queries
-- must pass org-scoped predicates from explicit code paths
-- (service-role API routes), not by accident of role.
--
-- Idempotency: each table is wrapped in a DO block that probes
-- pg_class.relrowsecurity / relforcerowsecurity before issuing
-- the ALTER. PostgreSQL's ALTER TABLE ... ENABLE/FORCE is itself
-- idempotent, but the explicit guard keeps the migration auditable
-- (NOTICE log emits exactly which tables were actually changed).
-- Safe to re-run on dev where RLS is already on.
--
-- Verification post-apply (run manually):
--
--   SELECT relname, relrowsecurity, relforcerowsecurity
--   FROM pg_class
--   WHERE relname IN ('jobs','invoices','draws','draw_line_items',
--                     'vendors','budget_lines','purchase_orders',
--                     'cost_codes')
--     AND relnamespace = 'public'::regnamespace
--   ORDER BY relname;
--
-- All 8 rows must show relrowsecurity = t AND relforcerowsecurity = t.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_table TEXT;
  v_tables TEXT[] := ARRAY[
    'jobs',
    'invoices',
    'draws',
    'draw_line_items',
    'vendors',
    'budget_lines',
    'purchase_orders',
    'cost_codes'
  ];
  v_rls_on BOOLEAN;
  v_force_on BOOLEAN;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    SELECT relrowsecurity, relforcerowsecurity
      INTO v_rls_on, v_force_on
    FROM pg_class
    WHERE oid = ('public.' || v_table)::regclass;

    IF NOT v_rls_on THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
      RAISE NOTICE '00080: ENABLE RLS on public.%', v_table;
    ELSE
      RAISE NOTICE '00080: ENABLE RLS already on public.% — skipped', v_table;
    END IF;

    IF NOT v_force_on THEN
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_table);
      RAISE NOTICE '00080: FORCE RLS on public.%', v_table;
    ELSE
      RAISE NOTICE '00080: FORCE RLS already on public.% — skipped', v_table;
    END IF;
  END LOOP;
END $$;

-- Post-apply verification: aborts the transaction if any of the 8
-- tables ended up without RLS enabled or forced. This catches
-- failures from concurrent ALTERs or an unexpected pg_class state.
DO $$
DECLARE
  v_bad_count INT;
BEGIN
  SELECT COUNT(*)
    INTO v_bad_count
  FROM pg_class
  WHERE relnamespace = 'public'::regnamespace
    AND relname IN ('jobs','invoices','draws','draw_line_items',
                    'vendors','budget_lines','purchase_orders',
                    'cost_codes')
    AND (NOT relrowsecurity OR NOT relforcerowsecurity);

  IF v_bad_count > 0 THEN
    RAISE EXCEPTION
      '00080 post-apply check failed: % of the 8 core tables still missing ENABLE or FORCE RLS',
      v_bad_count;
  END IF;
END $$;

COMMIT;
