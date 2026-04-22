-- 00060_align_status_enums.down.sql
-- Rollback for 00060_align_status_enums.sql.
--
-- IMPORTANT: this re-permits the legacy values in the CHECK constraints but
-- does NOT restore migrated rows back to 'pending_approval' / 'executed' —
-- that data is gone (collapsed forward). Rolling back is only useful if
-- application code is being reverted alongside; otherwise the new code paths
-- continue to produce only the canonical values.

-- ─── Reverse step 3 ──────────────────────────────────────────────────────
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status = ANY (ARRAY[
    'received', 'ai_processed',
    'pm_review', 'pm_approved', 'pm_held', 'pm_denied',
    'qa_review', 'qa_approved', 'qa_kicked_back',
    'pushed_to_qb', 'qb_failed',
    'in_draw', 'paid', 'void',
    'import_queued', 'import_parsing', 'import_parsed',
    'import_error', 'import_duplicate'
  ]));

-- ─── Reverse step 2 ──────────────────────────────────────────────────────
ALTER TABLE public.change_orders
  DROP CONSTRAINT IF EXISTS change_orders_status_check;

ALTER TABLE public.change_orders
  ADD CONSTRAINT change_orders_status_check
  CHECK (status IN ('draft','pending','pending_approval','approved','executed','denied','void'));
