-- ============================================================
-- 00068_cost_codes_hierarchy.down.sql — Phase 2.4 rollback
-- ============================================================
-- Reverses 00068 in strict reverse-dependency order.
--
-- Policies first (required before disabling RLS or dropping the
-- table), then the updated_at trigger, then the table itself. The
-- hierarchy trigger + function on cost_codes is dropped before the
-- columns it references. Columns drop in reverse of the ADD order.

-- ------------------------------------------------------------
-- cost_code_templates cleanup
-- ------------------------------------------------------------
DROP POLICY IF EXISTS cct_platform_admin_write ON public.cost_code_templates;
DROP POLICY IF EXISTS cct_read                 ON public.cost_code_templates;
DROP TRIGGER IF EXISTS trg_cost_code_templates_updated_at
  ON public.cost_code_templates;
DROP TABLE IF EXISTS public.cost_code_templates;

-- ------------------------------------------------------------
-- cost_codes hierarchy trigger + function
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_cost_codes_hierarchy ON public.cost_codes;
DROP FUNCTION IF EXISTS app_private.validate_cost_code_hierarchy();

-- ------------------------------------------------------------
-- cost_codes new columns (reverse of ADD order)
-- ------------------------------------------------------------
ALTER TABLE public.cost_codes DROP COLUMN IF EXISTS default_allowance_amount;
ALTER TABLE public.cost_codes DROP COLUMN IF EXISTS is_allowance;
ALTER TABLE public.cost_codes DROP COLUMN IF EXISTS parent_id;
