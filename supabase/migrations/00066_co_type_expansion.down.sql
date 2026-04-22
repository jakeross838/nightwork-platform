-- ============================================================
-- 00066_co_type_expansion.down.sql — Phase 2.3 rollback (Branch 2)
-- ============================================================
-- Reverses 00066 in strict reverse-dependency order.
--
-- Loud-fail posture (mirrors Phase 2.1's down.sql): if the live data
-- contains designer_architect / allowance_overage / site_condition
-- rows at rollback time, the restored 2-value CHECK intentionally
-- violates. The operator must either reverse-map those rows by hand
-- or accept the loud failure — no silent data-loss window.

-- ------------------------------------------------------------
-- Restore the legacy predicate on refresh_approved_cos_total first,
-- so the subsequent cache backfill uses the old logic.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_private.refresh_approved_cos_total(target_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  co_total bigint;
BEGIN
  SELECT COALESCE(SUM(
    COALESCE(total_with_fee, COALESCE(amount, 0) + COALESCE(gc_fee_amount, 0))
  ), 0)
  INTO co_total
  FROM public.change_orders
  WHERE job_id = target_job_id
    AND co_type = 'owner'
    AND status IN ('approved', 'executed')
    AND deleted_at IS NULL;

  UPDATE public.jobs
  SET approved_cos_total = co_total,
      current_contract_amount = COALESCE(original_contract_amount, 0) + co_total
  WHERE id = target_job_id;
END;
$$;

-- ------------------------------------------------------------
-- Drop the 4 added columns in reverse order of ADD.
-- ------------------------------------------------------------
ALTER TABLE public.change_order_lines DROP COLUMN IF EXISTS created_po_id;
ALTER TABLE public.change_orders DROP COLUMN IF EXISTS reason;
ALTER TABLE public.change_orders DROP COLUMN IF EXISTS source_proposal_id;
ALTER TABLE public.change_orders DROP COLUMN IF EXISTS pricing_mode;

-- ------------------------------------------------------------
-- Reverse-map data. Acknowledges: designer_architect /
-- allowance_overage / site_condition rows will violate the restored
-- 2-value CHECK below. Mirrors Phase 2.1 down.sql precedent — the
-- down intentionally LOUDLY fails if post-migration rows use values
-- outside the legacy set, so you can't silently roll back through a
-- data-loss window.
-- ------------------------------------------------------------
ALTER TABLE public.change_orders DROP CONSTRAINT change_orders_co_type_check;
ALTER TABLE public.change_orders ALTER COLUMN co_type DROP DEFAULT;
UPDATE public.change_orders SET co_type = 'owner' WHERE co_type = 'owner_requested';
ALTER TABLE public.change_orders ALTER COLUMN co_type SET DEFAULT 'owner';
ALTER TABLE public.change_orders
  ADD CONSTRAINT change_orders_co_type_check CHECK (co_type IN ('owner','internal'));

-- ------------------------------------------------------------
-- Re-run cache backfill under the restored predicate.
-- ------------------------------------------------------------
DO $$
DECLARE j RECORD;
BEGIN
  FOR j IN SELECT id FROM public.jobs WHERE deleted_at IS NULL LOOP
    PERFORM app_private.refresh_approved_cos_total(j.id);
  END LOOP;
END $$;
