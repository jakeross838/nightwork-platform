-- APPLIED: 2026-04-17T01:45:00Z
-- ===========================================================================
-- 00038_phase_b_internal_billings.sql
-- ===========================================================================
--
-- Phase B: Internal billings schema (clean rebuild).
--
-- Adds 3 new tables (internal_billing_types, internal_billings,
-- invoice_allocations), 7 new columns across draw_line_items/change_orders/
-- jobs, partial unique indexes on draw_line_items, RLS policies on all 3
-- tables, and seeds 8 Ross Built internal billing types.
--
-- Convention: ALL percentage/rate columns use FRACTION (numeric(5,4), 0.0-1.0).
-- No convention changes from the existing codebase at commit 246b2cb.
--
-- TARGET: DEV Supabase (egxkffodxcefwpqmwrur) ONLY.
-- DO NOT APPLY TO PROD (vnpqjderiuhsiiygfwfb).
-- ===========================================================================

BEGIN;

-- ================================================================
-- B1. Three new tables
-- ================================================================

-- B1a. internal_billing_types — org-level templates for GC fees, supervision, etc.
CREATE TABLE IF NOT EXISTS public.internal_billing_types (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  calculation_method   TEXT NOT NULL CHECK (calculation_method IN ('fixed', 'rate_x_quantity', 'percentage', 'manual')),
  default_amount_cents BIGINT,
  default_rate_cents   BIGINT,
  default_quantity_unit TEXT,
  default_percentage   NUMERIC(5,4),
  default_cost_code_id UUID REFERENCES public.cost_codes(id) ON DELETE SET NULL,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_internal_billing_types_org_id
  ON public.internal_billing_types (org_id);

-- B1b. internal_billings — per-job instances of an internal billing type
CREATE TABLE IF NOT EXISTS public.internal_billings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id          UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  billing_type_id UUID NOT NULL REFERENCES public.internal_billing_types(id) ON DELETE RESTRICT,
  cost_code_id    UUID REFERENCES public.cost_codes(id) ON DELETE SET NULL,
  description     TEXT,
  amount_cents    BIGINT NOT NULL DEFAULT 0,
  rate_cents      BIGINT,
  quantity        NUMERIC(10,2),
  percentage      NUMERIC(5,4),
  period_start    DATE,
  period_end      DATE,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'attached', 'billed', 'paid')),
  draw_line_item_id UUID,  -- FK added in B3 after draw_line_items columns exist
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_billings_org_id
  ON public.internal_billings (org_id);
CREATE INDEX IF NOT EXISTS idx_internal_billings_job_id
  ON public.internal_billings (job_id);
CREATE INDEX IF NOT EXISTS idx_internal_billings_billing_type_id
  ON public.internal_billings (billing_type_id);

-- B1c. invoice_allocations — per-cost-code splits on invoices
-- No org_id column; org scoping enforced via EXISTS on invoices.
CREATE TABLE IF NOT EXISTS public.invoice_allocations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  cost_code_id    UUID NOT NULL REFERENCES public.cost_codes(id) ON DELETE RESTRICT,
  change_order_id UUID REFERENCES public.change_orders(id) ON DELETE SET NULL,
  amount_cents    BIGINT NOT NULL CHECK (amount_cents >= 0),
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_allocations_invoice_id
  ON public.invoice_allocations (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_allocations_cost_code_id
  ON public.invoice_allocations (cost_code_id);


-- ================================================================
-- B2. Column additions to existing tables
-- ================================================================

-- draw_line_items: source_type + FKs for internal/CO line sources
ALTER TABLE public.draw_line_items
  ADD COLUMN IF NOT EXISTS source_type TEXT
    CHECK (source_type IN ('budget', 'internal', 'change_order')),
  ADD COLUMN IF NOT EXISTS internal_billing_id UUID
    REFERENCES public.internal_billings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS change_order_id UUID
    REFERENCES public.change_orders(id) ON DELETE SET NULL;

-- Partial unique indexes: one source per draw per source entity
CREATE UNIQUE INDEX IF NOT EXISTS ux_draw_line_items_budget
  ON public.draw_line_items (draw_id, budget_line_id)
  WHERE source_type = 'budget' AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_draw_line_items_internal
  ON public.draw_line_items (draw_id, internal_billing_id)
  WHERE source_type = 'internal' AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_draw_line_items_change_order
  ON public.draw_line_items (draw_id, change_order_id)
  WHERE source_type = 'change_order' AND deleted_at IS NULL;

-- change_orders: which pay application the CO appears on
ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS application_number INTEGER;

-- jobs: mid-lifecycle start fields
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS starting_application_number INTEGER,
  ADD COLUMN IF NOT EXISTS previous_certificates_total BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS previous_change_orders_total BIGINT NOT NULL DEFAULT 0;


-- ================================================================
-- B3. Back-ref FK from internal_billings to draw_line_items
-- ================================================================
-- Must come after draw_line_items.internal_billing_id exists.

ALTER TABLE public.internal_billings
  ADD CONSTRAINT internal_billings_draw_line_item_id_fkey
  FOREIGN KEY (draw_line_item_id) REFERENCES public.draw_line_items(id)
  ON DELETE SET NULL;


-- ================================================================
-- B4. RLS policies on the 3 new tables
-- ================================================================
-- Pattern matches 00028 (change_order_lines) and 00034 (security audit):
--   RESTRICTIVE "org isolation" for org_id tables
--   PERMISSIVE "members read" + "admin write" for org_id tables
--   EXISTS-based policies for invoice_allocations (no org_id column)

-- B4a. internal_billing_types (org-scoped)
ALTER TABLE public.internal_billing_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org isolation"
  ON public.internal_billing_types
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id())
  WITH CHECK (org_id = app_private.user_org_id());

CREATE POLICY "authenticated read internal_billing_types"
  ON public.internal_billing_types
  FOR SELECT TO authenticated
  USING (org_id = app_private.user_org_id());

CREATE POLICY "admin write internal_billing_types"
  ON public.internal_billing_types
  FOR ALL TO authenticated
  USING (app_private.user_role() = 'admin')
  WITH CHECK (app_private.user_role() = 'admin');

-- B4b. internal_billings (org-scoped)
ALTER TABLE public.internal_billings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org isolation"
  ON public.internal_billings
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id())
  WITH CHECK (org_id = app_private.user_org_id());

CREATE POLICY "authenticated read internal_billings"
  ON public.internal_billings
  FOR SELECT TO authenticated
  USING (org_id = app_private.user_org_id());

CREATE POLICY "admin write internal_billings"
  ON public.internal_billings
  FOR ALL TO authenticated
  USING (app_private.user_role() = 'admin')
  WITH CHECK (app_private.user_role() = 'admin');

-- B4c. invoice_allocations (parent-scoped via invoices.org_id)
ALTER TABLE public.invoice_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org isolation"
  ON public.invoice_allocations
  AS RESTRICTIVE FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_allocations.invoice_id
      AND i.org_id = app_private.user_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_allocations.invoice_id
      AND i.org_id = app_private.user_org_id()
    )
  );

CREATE POLICY "authenticated read invoice_allocations"
  ON public.invoice_allocations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_allocations.invoice_id
      AND i.org_id = app_private.user_org_id()
    )
  );

CREATE POLICY "admin write invoice_allocations"
  ON public.invoice_allocations
  FOR ALL TO authenticated
  USING (app_private.user_role() = 'admin')
  WITH CHECK (app_private.user_role() = 'admin');


-- ================================================================
-- B5. Seed Ross Built internal_billing_types (8 rows)
-- ================================================================
-- org_id = '00000000-0000-0000-0000-000000000001' (Ross Built)
-- All percentage values in FRACTION convention (0.18 = 18%).

INSERT INTO public.internal_billing_types
  (org_id, name, calculation_method, default_amount_cents, default_rate_cents, default_quantity_unit, default_percentage, default_cost_code_id, is_active, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Supervision',      'fixed',           400000, NULL,  'month', NULL,   NULL, true, 1),
  ('00000000-0000-0000-0000-000000000001', 'Contractor Fee',   'percentage',      NULL,   NULL,  NULL,    0.1800, NULL, true, 2),
  ('00000000-0000-0000-0000-000000000001', 'General Labor',    'rate_x_quantity',  NULL,   3500,  'hour',  NULL,   NULL, true, 3),
  ('00000000-0000-0000-0000-000000000001', 'Dump Trailer',     'rate_x_quantity',  NULL,   15000, 'day',   NULL,   NULL, true, 4),
  ('00000000-0000-0000-0000-000000000001', 'Bobcat',           'rate_x_quantity',  NULL,   7500,  'hour',  NULL,   NULL, true, 5),
  ('00000000-0000-0000-0000-000000000001', 'Equipment Rental', 'manual',           NULL,   NULL,  NULL,    NULL,   NULL, true, 6),
  ('00000000-0000-0000-0000-000000000001', 'Fuel',             'manual',           NULL,   NULL,  NULL,    NULL,   NULL, true, 7),
  ('00000000-0000-0000-0000-000000000001', 'Reimbursable',     'manual',           NULL,   NULL,  NULL,    NULL,   NULL, true, 8);


COMMIT;


-- ================================================================
-- VERIFICATION QUERIES (run after applying)
-- ================================================================
--
-- 1. All 3 tables exist:
--    SELECT table_name FROM information_schema.tables
--      WHERE table_schema = 'public'
--      AND table_name IN ('internal_billing_types','internal_billings','invoice_allocations')
--      ORDER BY table_name;
--    Expected: 3 rows
--
-- 2. internal_billing_types seeded:
--    SELECT COUNT(*) FROM internal_billing_types
--      WHERE org_id = '00000000-0000-0000-0000-000000000001';
--    Expected: 8
--
-- 3. Seed data convention check (fraction, not whole-percent):
--    SELECT name, default_percentage FROM internal_billing_types
--      WHERE default_percentage IS NOT NULL;
--    Expected: Contractor Fee = 0.1800 (NOT 18.00)
--
-- 4. draw_line_items new columns:
--    SELECT column_name FROM information_schema.columns
--      WHERE table_name = 'draw_line_items'
--      AND column_name IN ('source_type','internal_billing_id','change_order_id')
--      ORDER BY column_name;
--    Expected: 3 rows
--
-- 5. change_orders.application_number exists:
--    SELECT column_name FROM information_schema.columns
--      WHERE table_name = 'change_orders' AND column_name = 'application_number';
--    Expected: 1 row
--
-- 6. jobs new columns:
--    SELECT column_name FROM information_schema.columns
--      WHERE table_name = 'jobs'
--      AND column_name IN ('starting_application_number','previous_certificates_total','previous_change_orders_total')
--      ORDER BY column_name;
--    Expected: 3 rows
--
-- 7. Partial unique indexes created:
--    SELECT indexname FROM pg_indexes
--      WHERE tablename = 'draw_line_items'
--      AND indexname LIKE 'ux_draw_line_items_%';
--    Expected: 3 rows (ux_draw_line_items_budget, _internal, _change_order)
--
-- 8. RLS enabled on all 3 tables:
--    SELECT tablename, rowsecurity FROM pg_tables
--      WHERE tablename IN ('internal_billing_types','internal_billings','invoice_allocations')
--      ORDER BY tablename;
--    Expected: all 3 have rowsecurity = true
--
-- 9. RLS policies count:
--    SELECT tablename, COUNT(*) FROM pg_policies
--      WHERE tablename IN ('internal_billing_types','internal_billings','invoice_allocations')
--      GROUP BY tablename ORDER BY tablename;
--    Expected: internal_billing_types=3, internal_billings=3, invoice_allocations=3
--
-- 10. Back-ref FK exists:
--     SELECT constraint_name FROM information_schema.table_constraints
--       WHERE table_name = 'internal_billings'
--       AND constraint_name = 'internal_billings_draw_line_item_id_fkey';
--     Expected: 1 row
--
-- 11. Convention preserved — existing columns NOT changed:
--     SELECT column_name, numeric_precision, numeric_scale
--       FROM information_schema.columns
--       WHERE table_name = 'change_orders' AND column_name = 'gc_fee_rate';
--     Expected: numeric(5,4) — unchanged from Phase A rollback
--
-- ===========================================================================
-- CONVENTION CHANGE AUDIT
-- ===========================================================================
-- No convention changes. All new percentage/rate columns use:
--   - NUMERIC(5,4) with fraction values (0.18, not 18)
--   - Matches existing codebase convention at commit 246b2cb
-- Existing columns NOT altered.
-- ===========================================================================
--
-- ===========================================================================
-- OUT OF SCOPE
-- ===========================================================================
-- - No convention changes to existing columns
-- - No change_order_lines.gc_fee_amount column (drift from prior attempt)
-- - No CHECK constraints on existing columns
-- - No code changes to src/
-- - No index creation beyond the 3 partial uniques in B2
-- - PROD database (vnpqjderiuhsiiygfwfb): NOT touched
-- ===========================================================================
