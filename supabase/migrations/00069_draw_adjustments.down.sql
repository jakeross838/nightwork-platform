-- ============================================================
-- 00069_draw_adjustments.down.sql — reverses 00069
-- ============================================================
-- Strict reverse-dependency order:
--   1. Drop all 6 RLS policies (3 per table).
--   2. DISABLE RLS on both tables.
--   3. Drop 2 updated_at triggers.
--   4. Drop 7 indexes.
--   5. Drop join table FIRST (draw_adjustment_line_items) —
--      its adjustment_id FK has ON DELETE CASCADE, but an
--      explicit drop is cleaner and keeps the reverse order
--      mirror-symmetric with the up migration.
--   6. Drop parent table (draw_adjustments) SECOND.
--
-- No backfill rows to reverse — Phase 2.5 creates empty tables;
-- Branch 3/4 populates them. On rollback, zero rows are
-- discarded.
-- ============================================================

-- (1) Drop RLS policies (6 total — no DELETE policies exist so
--     not listed here). Reverse dependency order: update → insert
--     → read for each table, join table first then parent.

DROP POLICY IF EXISTS draw_adjustment_line_items_org_update
  ON public.draw_adjustment_line_items;
DROP POLICY IF EXISTS draw_adjustment_line_items_org_insert
  ON public.draw_adjustment_line_items;
DROP POLICY IF EXISTS draw_adjustment_line_items_org_read
  ON public.draw_adjustment_line_items;

DROP POLICY IF EXISTS draw_adjustments_org_update ON public.draw_adjustments;
DROP POLICY IF EXISTS draw_adjustments_org_insert ON public.draw_adjustments;
DROP POLICY IF EXISTS draw_adjustments_org_read   ON public.draw_adjustments;

-- (2) DISABLE RLS on both tables.

ALTER TABLE public.draw_adjustment_line_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_adjustments            DISABLE ROW LEVEL SECURITY;

-- (3) Drop updated_at triggers.

DROP TRIGGER IF EXISTS trg_draw_adjustment_line_items_updated_at
  ON public.draw_adjustment_line_items;
DROP TRIGGER IF EXISTS trg_draw_adjustments_updated_at
  ON public.draw_adjustments;

-- (4) Drop indexes (7 total). Partial predicates carry over from
--     the up migration; DROP INDEX IF EXISTS is predicate-
--     agnostic.

DROP INDEX IF EXISTS idx_dali_draw_line_item;
DROP INDEX IF EXISTS idx_dali_adjustment;
DROP INDEX IF EXISTS idx_draw_adjustments_invoice;
DROP INDEX IF EXISTS idx_draw_adjustments_vendor;
DROP INDEX IF EXISTS idx_draw_adjustments_line_item;
DROP INDEX IF EXISTS idx_draw_adjustments_status;
DROP INDEX IF EXISTS idx_draw_adjustments_draw;

-- (5) Drop join table FIRST.

DROP TABLE IF EXISTS public.draw_adjustment_line_items;

-- (6) Drop parent table SECOND.

DROP TABLE IF EXISTS public.draw_adjustments;
