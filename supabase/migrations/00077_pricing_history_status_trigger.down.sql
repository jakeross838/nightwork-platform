-- ============================================================
-- 00077_pricing_history_status_trigger.down.sql
-- ============================================================
-- Reverses 00077_pricing_history_status_trigger.sql.
--
-- Drops the trigger BEFORE the function (dependency order —
-- PostgreSQL forbids dropping a function that a trigger depends on).
--
-- NOTE: pricing_history rows inserted by this trigger since 00077
-- landed are intentionally NOT reverted. pricing_history is an
-- append-only audit spine (00073 Amendment C immutability
-- contract). Correction procedure for any mis-inserted rows is
-- service-role SQL DELETE by platform admin, NOT via this down.sql.
-- ============================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_invoices_pricing_history_on_status
  ON public.invoices;

DROP FUNCTION IF EXISTS public.trg_pricing_history_from_invoice_status();

COMMIT;
