-- ============================================================
-- Phase 2.8 rollback — migration 00073_pricing_history.
--
-- Reverses in strict reverse-dependency order:
--   1. Drop 4 triggers (depend on functions + on source tables)
--   2. Drop 4 trigger functions (depend on pricing_history table)
--   3. Drop 1 RLS policy
--   4. DISABLE RLS
--   5. Drop 5 indexes (cost_code / vendor / trigram / job /
--      source_lookup)
--   6. Drop table (also drops backfilled rows and the
--      (source_type, source_line_id) unique constraint)
--
-- Backfilled rows from Amendment M are discarded implicitly by
-- the DROP TABLE.
-- ============================================================

-- (1) Drop 4 triggers first — they depend on the functions and
-- on the source tables.
DROP TRIGGER IF EXISTS trg_change_order_lines_pricing_history
  ON public.change_order_lines;
DROP TRIGGER IF EXISTS trg_po_line_items_pricing_history
  ON public.po_line_items;
DROP TRIGGER IF EXISTS trg_proposal_line_items_pricing_history
  ON public.proposal_line_items;
DROP TRIGGER IF EXISTS trg_invoice_line_items_pricing_history
  ON public.invoice_line_items;

-- (2) Drop 4 trigger functions — they INSERT into
-- pricing_history, so must be dropped before the table.
DROP FUNCTION IF EXISTS public.trg_pricing_history_from_co_line();
DROP FUNCTION IF EXISTS public.trg_pricing_history_from_po_line();
DROP FUNCTION IF EXISTS public.trg_pricing_history_from_proposal_line();
DROP FUNCTION IF EXISTS public.trg_pricing_history_from_invoice_line();

-- (3) Drop the lone RLS policy.
DROP POLICY IF EXISTS pricing_history_org_read
  ON public.pricing_history;

-- (4) Disable RLS on the table (reverses ENABLE).
ALTER TABLE public.pricing_history DISABLE ROW LEVEL SECURITY;

-- (5) Drop 5 indexes (reverse of creation order).
DROP INDEX IF EXISTS idx_pricing_history_source_lookup;
DROP INDEX IF EXISTS idx_pricing_history_job;
DROP INDEX IF EXISTS idx_pricing_history_description_trgm;
DROP INDEX IF EXISTS idx_pricing_history_vendor;
DROP INDEX IF EXISTS idx_pricing_history_cost_code;

-- (6) Drop the table last — also drops backfilled rows + the
-- inline UNIQUE (source_type, source_line_id) constraint and
-- its backing index.
DROP TABLE IF EXISTS public.pricing_history;
