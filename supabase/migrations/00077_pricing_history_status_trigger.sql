-- ============================================================
-- 00077_pricing_history_status_trigger.sql — GH #19 Path A
-- ============================================================
--
-- Phase 3.1 Stage 3B-1 diagnostic (qa-reports/qa-branch3-phase3.1.md
-- §7) surfaced that the Phase 2.8 pricing_history trigger on
-- `invoice_line_items` (migration 00073 —
-- `trg_pricing_history_from_invoice_line`) has NEVER fired in the
-- real QA-approval flow since shipping. Root cause: app-layer UPDATE
-- ordering.
--
-- The invoices-approval transaction updates invoice_line_items
-- BEFORE updating invoices.status='qa_approved'. The AFTER UPDATE on
-- invoice_line_items reads the parent invoices.status (still
-- whatever it was pre-transition — 'qa_review', 'pm_approved', etc.)
-- and the `IF _inv.status IS DISTINCT FROM 'qa_approved' THEN RETURN
-- NEW;` guard takes the no-op path. pricing_history never gets
-- populated. All 55 qa_approved invoices on Ross Built were
-- historically orphaned — 54 caught by the 00073 Amendment M
-- one-time backfill at apply time, 1 (Metro Electric #60433) that
-- qa_approved post-00073 remained orphaned and became the Phase 3.1
-- canary. Filed as GH #19.
--
-- Fix (Path A, THIS migration):
-- ─────────────────────────────
-- A new trigger that fires on the OTHER side of the update ordering
-- — AFTER UPDATE OF status ON public.invoices, gated to the
-- transition OLD.status != 'qa_approved' AND NEW.status =
-- 'qa_approved'. By the time invoices.status is written, all the
-- row's invoice_line_items are in their final state, so the trigger
-- can INSERT pricing_history rows for every line without the stale-
-- read hazard.
--
-- Idempotent via ON CONFLICT (source_type, source_line_id) DO
-- NOTHING against the 00073 UNIQUE constraint. So:
--   - If the 00073 invoice_line trigger DID fire on some future
--     invoice (e.g., someone UPDATEs an already-qa_approved invoice's
--     line item) and a row already exists, this one is a no-op.
--   - If an invoice bounces qa_review → qa_approved → qa_review →
--     qa_approved, the second transition ON CONFLICT-skips the
--     already-inserted rows.
--
-- Backfill for historical orphans (Path C): deferred to migration
-- 00078. Splitting migrations preserves rollback granularity —
-- this migration can be rolled back without affecting the Path C
-- backfill rows, and the Path C backfill can be added/rolled back
-- independently.
--
-- Column mapping + guards match the 00073 invoice_line trigger
-- exactly (see RUNTIME NOTE #1 + #2 in 00073 header for the
-- canonical dollars→cents conversion):
--   qty            → quantity
--   unit           → unit
--   rate (dollars) → unit_price (cents), via ROUND(rate*100)::BIGINT
--   amount_cents   → amount
--   invoice_date   → date, with COALESCE(.., created_at::date)
--                     fallback
--   auth.uid()     → created_by
-- Skips invoices whose job_id IS NULL (same reason as 00073:
-- pricing_history.job_id is NOT NULL, legacy orphans are
-- intentionally not backfilled — those are pre-tenancy-cleanup).
--
-- GRANT PATTERN (Amendment J / F.2 lineage 00032 → 00067 → 00070 →
-- 00073): SECURITY DEFINER with pinned search_path = public, pg_temp,
-- explicit GRANT EXECUTE TO authenticated. Defends the GH #9 class
-- of latent authenticated-role permission gaps.
--
-- R.15 regression fence:
-- __tests__/pricing-history-status-trigger.test.ts (24 static
-- assertions over this file + its .down.sql). Dynamic behavior
-- (trigger fires on exact transition, doesn't fire on others,
-- idempotency on re-UPDATE) is covered by the Migration Dry-Run
-- + live regression on Metro Electric recorded in the Jake-review
-- Task 3A summary.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.trg_pricing_history_from_invoice_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Fire ONLY on the transition from a non-qa_approved status TO
  -- qa_approved. Skips UPDATEs that don't touch status (guarded by
  -- AFTER UPDATE OF status) AND UPDATEs that keep status qa_approved
  -- (e.g., a second payment-date edit on an already-approved invoice).
  IF NEW.status IS DISTINCT FROM 'qa_approved' THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT DISTINCT FROM 'qa_approved' THEN
    RETURN NEW;
  END IF;

  -- job_id on invoices is nullable (legacy rows pre-tenancy cleanup);
  -- pricing_history.job_id is NOT NULL. Skip rather than fail the
  -- parent UPDATE. Matches 00073 invoice_line trigger handling.
  IF NEW.job_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.pricing_history (
    org_id, job_id, source_type, source_id, source_line_id,
    vendor_id, cost_code_id, description,
    quantity, unit, unit_price, amount, date,
    created_by
  )
  SELECT
    NEW.org_id, NEW.job_id, 'invoice', NEW.id, ili.id,
    NEW.vendor_id, ili.cost_code_id, COALESCE(ili.description, ''),
    ili.qty, ili.unit,
    CASE WHEN ili.rate IS NOT NULL THEN ROUND(ili.rate * 100)::BIGINT ELSE NULL END,
    ili.amount_cents,
    COALESCE(NEW.invoice_date, NEW.created_at::date),
    auth.uid()
  FROM public.invoice_line_items ili
  WHERE ili.invoice_id = NEW.id
    AND ili.deleted_at IS NULL
  ON CONFLICT (source_type, source_line_id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_pricing_history_from_invoice_status() IS
'GH #19 Path A. Populates pricing_history from invoice_line_items on the invoices.status transition TO qa_approved. Complements 00073 trg_pricing_history_from_invoice_line (which never fires in real flow due to update-ordering — see Phase 3.1 Stage 3B-1 diagnostic in qa-reports/qa-branch3-phase3.1.md §7). Idempotent via 00073 UNIQUE (source_type, source_line_id). Skips invoices with NULL job_id (legacy pre-tenancy rows). Historical orphan backfill is Path C / migration 00078.';

GRANT EXECUTE ON FUNCTION public.trg_pricing_history_from_invoice_status()
  TO authenticated;

-- AFTER UPDATE OF status — column-scoped so the trigger only evaluates
-- when status is in the SET list. Other invoice UPDATEs (payment_date,
-- check_number, etc.) don't re-fire.
CREATE TRIGGER trg_invoices_pricing_history_on_status
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_pricing_history_from_invoice_status();

COMMIT;
