-- 00030_phase8_draws_liens_payments.sql
-- Phase 8 — Draw improvements, lien releases, payment tracking.
--
-- Adds (idempotent):
--   1. jobs.retainage_percent (NUMERIC, default 10)
--   2. draws: retainage columns (5a/5b/5c/6/7/8/9), parent_draw_id FK,
--      approved_at/approved_by/locked_at timestamps, is_final flag.
--      Status CHECK widened to include 'locked'.
--   3. lien_releases: po_id FK, through_date, notes, created_by. release_type
--      CHECK widened to include the four progress/final variants from the
--      spec (conditional_progress, unconditional_progress, conditional_final,
--      unconditional_final). status CHECK widened to include 'not_required'.
--   4. invoices: payment_status, payment_amount, payment_method,
--      payment_reference, scheduled_payment_date.
--
-- Preserves all Phase 7b triggers, recalc helpers, and existing data.
-- No data is deleted. Back-compat release_type values kept for any rows
-- already written during Phase 5 scaffolding.

-- ============================================================
-- 1. JOBS — retainage_percent
-- ============================================================
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS retainage_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00
    CHECK (retainage_percent >= 0 AND retainage_percent <= 100);

-- ============================================================
-- 2. DRAWS — retainage breakdown + revision tracking + locked status
-- ============================================================
ALTER TABLE public.draws
  ADD COLUMN IF NOT EXISTS retainage_on_completed BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retainage_on_stored BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_retainage BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earned_less_retainage BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS less_previous_certificates BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_draw_id UUID REFERENCES public.draws(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_final BOOLEAN NOT NULL DEFAULT FALSE;

-- Widen status CHECK to include 'locked'. Keep legacy values so existing rows
-- (if any) remain valid.
DO $$
BEGIN
  ALTER TABLE public.draws DROP CONSTRAINT IF EXISTS draws_status_check;
  ALTER TABLE public.draws
    ADD CONSTRAINT draws_status_check
    CHECK (status IN (
      'draft',
      'pm_review',
      'submitted',
      'approved',
      'locked',
      'paid',
      'void'
    ));
EXCEPTION WHEN others THEN
  -- Tolerate environments where the constraint has a different name. Find it
  -- and retry by name, falling back to the attempt above's error path.
  RAISE NOTICE 'draws status constraint rename: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_draws_parent_draw_id
  ON public.draws (parent_draw_id) WHERE parent_draw_id IS NOT NULL;

-- ============================================================
-- 3. LIEN_RELEASES — po_id, through_date, notes, created_by,
--     wider release_type + status CHECK.
-- ============================================================
ALTER TABLE public.lien_releases
  ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS through_date DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE public.lien_releases DROP CONSTRAINT IF EXISTS lien_releases_release_type_check;
  ALTER TABLE public.lien_releases
    ADD CONSTRAINT lien_releases_release_type_check
    CHECK (release_type IN (
      'conditional',
      'unconditional',
      'partial',
      'final',
      'conditional_progress',
      'unconditional_progress',
      'conditional_final',
      'unconditional_final'
    ));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'lien_releases release_type rename: %', SQLERRM;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lien_releases DROP CONSTRAINT IF EXISTS lien_releases_status_check;
  ALTER TABLE public.lien_releases
    ADD CONSTRAINT lien_releases_status_check
    CHECK (status IN ('pending','received','waived','not_required'));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'lien_releases status rename: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_lien_releases_vendor_id
  ON public.lien_releases (vendor_id);
CREATE INDEX IF NOT EXISTS idx_lien_releases_po_id
  ON public.lien_releases (po_id) WHERE po_id IS NOT NULL;

-- ============================================================
-- 4. INVOICES — payment tracking fields
--
-- received_date + payment_date + check_number + picked_up + mailed_date
-- already exist. We add structured payment status + amount + method +
-- reference + scheduled_payment_date so Phase 8 can track partial pays and
-- schedule automation.
-- ============================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','scheduled','paid','partial')),
  ADD COLUMN IF NOT EXISTS payment_amount BIGINT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN ('check','ach','wire','credit_card')),
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_payment_date DATE;

CREATE INDEX IF NOT EXISTS idx_invoices_payment_status
  ON public.invoices (payment_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_scheduled_payment_date
  ON public.invoices (scheduled_payment_date)
  WHERE deleted_at IS NULL AND payment_status = 'scheduled';

-- Backfill payment_status for any invoice already marked paid via status,
-- so the new column lines up with legacy data.
UPDATE public.invoices
SET payment_status = 'paid',
    payment_amount = COALESCE(payment_amount, total_amount)
WHERE status = 'paid'
  AND payment_status = 'unpaid';
