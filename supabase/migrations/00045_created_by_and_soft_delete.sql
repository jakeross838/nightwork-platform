-- ===========================================================================
-- 00045_created_by_and_soft_delete.sql
-- ===========================================================================
--
-- Closes two audit/governance gaps flagged in the architecture review:
--
-- 1. created_by: three tables (cost_codes, budget_lines, draw_line_items)
--    were missing the created_by column that the rest of the schema relies
--    on for audit trails. Retrofits the column, nullable (existing rows
--    stay NULL — acceptable for historical data).
--
-- 2. deleted_at: invoice_allocations and internal_billings were created
--    without soft-delete columns, forcing the API to use hard .delete()
--    calls. Adds deleted_at and a matching WHERE clause on the usual
--    unique/FK indexes so queries can filter deleted rows.
--
-- TARGET: DEV Supabase (egxkffodxcefwpqmwrur) ONLY.
-- DO NOT APPLY TO PROD (vnpqjderiuhsiiygfwfb).
-- ===========================================================================

BEGIN;

-- =========================================================================
-- Part 1: created_by retrofit
-- =========================================================================

ALTER TABLE public.cost_codes
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE public.budget_lines
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE public.draw_line_items
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- =========================================================================
-- Part 2: deleted_at retrofit on invoice_allocations + internal_billings
-- =========================================================================

ALTER TABLE public.invoice_allocations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.internal_billings
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Filtered indexes so "live row" lookups stay fast without including
-- soft-deleted rows.
CREATE INDEX IF NOT EXISTS idx_invoice_allocations_live
  ON public.invoice_allocations (invoice_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_internal_billings_live
  ON public.internal_billings (job_id)
  WHERE deleted_at IS NULL;

COMMIT;
