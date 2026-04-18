-- F-009 fix: Auto-maintain jobs.approved_cos_total and current_contract_amount
-- via trigger on change_orders. Replaces reliance on recalcJobContract() being
-- called from every mutation path.
--
-- Uses total_with_fee (not amount alone) to include GC fees in the contract
-- adjustment — fixes a pre-existing bug where recalcJobContract() only summed
-- the amount field.

-- Function: recompute approved_cos_total for a given job_id
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
  FROM change_orders
  WHERE job_id = target_job_id
    AND co_type = 'owner'
    AND status IN ('approved', 'executed')
    AND deleted_at IS NULL;

  UPDATE jobs
  SET approved_cos_total = co_total,
      current_contract_amount = COALESCE(original_contract_amount, 0) + co_total
  WHERE id = target_job_id;
END;
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION app_private.co_cache_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM app_private.refresh_approved_cos_total(NEW.job_id);
    IF TG_OP = 'UPDATE' AND OLD.job_id IS DISTINCT FROM NEW.job_id THEN
      PERFORM app_private.refresh_approved_cos_total(OLD.job_id);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM app_private.refresh_approved_cos_total(OLD.job_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS co_cache_trigger ON change_orders;

CREATE TRIGGER co_cache_trigger
AFTER INSERT OR UPDATE OR DELETE ON change_orders
FOR EACH ROW
EXECUTE FUNCTION app_private.co_cache_trigger();

-- One-time backfill: refresh all jobs' caches
DO $$
DECLARE
  j RECORD;
BEGIN
  FOR j IN SELECT id FROM jobs WHERE deleted_at IS NULL LOOP
    PERFORM app_private.refresh_approved_cos_total(j.id);
  END LOOP;
END $$;

COMMENT ON FUNCTION app_private.refresh_approved_cos_total IS
'Recomputes jobs.approved_cos_total and current_contract_amount for a given job based on current change_orders state. Called automatically via trigger on change_orders mutations. Also callable directly for one-off reconciliation.';

-- Remove the job-cache portion from the existing trg_change_orders_status_sync
-- trigger (migration 00028). That trigger used SUM(amount) which excluded GC
-- fees. Our new co_cache_trigger handles this correctly with total_with_fee.
-- Keep the budget_line co_adjustments recomputation — that's still needed.
CREATE OR REPLACE FUNCTION trg_change_orders_status_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  bl_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    FOR bl_id IN
      SELECT DISTINCT col.budget_line_id
        FROM public.change_order_lines col
        WHERE col.co_id = NEW.id
          AND col.budget_line_id IS NOT NULL
          AND col.deleted_at IS NULL
    LOOP
      PERFORM public.recompute_budget_line_co_adjustments(bl_id);
    END LOOP;
    -- Job-level cache (approved_cos_total, current_contract_amount) is now
    -- handled by co_cache_trigger which uses total_with_fee.
  END IF;
  RETURN NEW;
END;
$$;

-- Permissions: service_role must be able to call app_private functions via
-- the trigger. Without this, CO inserts from the JS client (pay-app imports,
-- server scripts, admin ops) silently fail the cache update, leaving
-- approved_cos_total stale. Discovered during Fish Pay App #21 seed.
GRANT USAGE ON SCHEMA app_private TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO service_role;

-- Future functions added to app_private automatically get the grant.
ALTER DEFAULT PRIVILEGES IN SCHEMA app_private
GRANT EXECUTE ON FUNCTIONS TO service_role;
