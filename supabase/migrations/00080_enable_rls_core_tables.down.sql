-- ============================================================
-- 00080_enable_rls_core_tables.down.sql
-- ============================================================
-- Reverses 00080_enable_rls_core_tables.sql.
--
-- Disables FORCE then ENABLE on the 8 core tables. Policies are
-- NOT dropped — they continue to exist and would be re-honored
-- the moment ENABLE RLS is re-applied.
--
-- WARNING: running this down migration produces the exact failure
-- mode the up migration was written to prevent (every row world-
-- readable to any authenticated session). Only run if rolling back
-- to a state predating Phase A lockdown.
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
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', v_table);
  END LOOP;
END $$;

COMMIT;
