-- ============================================================
-- 00066_co_type_expansion.sql — Phase 2.3 (Branch 2)
-- ============================================================
-- Expands change_orders.co_type from the legacy 2-value set
-- ('owner','internal') to the 5-value set ('owner_requested',
-- 'designer_architect','allowance_overage','site_condition','internal').
-- Migrates the 73 live + 15 soft-deleted 'owner' rows to
-- 'owner_requested'. Adds pricing_mode / source_proposal_id / reason
-- on change_orders and created_po_id on change_order_lines.
--
-- Order matters: constraint must be dropped before data migration;
-- new constraint added last. Sequencing bug caught during Branch 2
-- pre-context (flag E).
--
-- Amendment A (pre-flight 2026-04-22): the column default of 'owner'
-- is about to become an invalid value against the new CHECK. Drop
-- DEFAULT before the UPDATE, SET DEFAULT 'owner_requested' after, so
-- concurrent INSERTs relying on the default are never in a window
-- where the default violates the constraint.
--
-- Amendment B (pre-flight 2026-04-22): the live body of
-- app_private.refresh_approved_cos_total (the function fired by
-- co_cache_trigger to maintain jobs.approved_cos_total +
-- jobs.current_contract_amount) filters on co_type = 'owner'. Under
-- the expanded value set, 4 of 5 types raise contract; only 'internal'
-- does not (plan doc §1066–1072). Rewrite to the complement. Include
-- a one-time backfill over every live job and a verification probe
-- that aborts the migration if the post-backfill SUM differs from the
-- pre-migration invariant of 90104565 cents ($901,045.65 — captured
-- in pre-flight S7).
--
-- Naming note: this migration introduces change_orders.pricing_mode
-- (hard_priced/budgetary/allowance_split) which is distinct from the
-- existing items.pricing_model / invoice_extraction_lines.
-- proposed_pricing_model (unit/scope) introduced in 00057. Different
-- tables, different semantics, similar names. Tracked for possible
-- future rename in GH #8.

-- ------------------------------------------------------------
-- (a) Drop old CHECK so in-flight 'owner' rows can be rewritten
-- ------------------------------------------------------------
ALTER TABLE public.change_orders
  DROP CONSTRAINT change_orders_co_type_check;

-- ------------------------------------------------------------
-- (a.1) Drop the stale default. The current default 'owner' is about
-- to become an invalid value against the new CHECK. Dropping it here
-- prevents any concurrent transaction from using it between (a) and
-- (c).
-- ------------------------------------------------------------
ALTER TABLE public.change_orders
  ALTER COLUMN co_type DROP DEFAULT;

-- ------------------------------------------------------------
-- (b) Migrate data: 'owner' → 'owner_requested'; 'internal' stays
-- ------------------------------------------------------------
UPDATE public.change_orders
  SET co_type = 'owner_requested'
  WHERE co_type = 'owner';

-- ------------------------------------------------------------
-- (b.1) Restore a sensible default under the new value set.
-- 'owner_requested' preserves the semantic intent of the old default
-- (owner-initiated CO is the common case).
-- ------------------------------------------------------------
ALTER TABLE public.change_orders
  ALTER COLUMN co_type SET DEFAULT 'owner_requested';

-- ------------------------------------------------------------
-- (c) Install new CHECK over the fully migrated data set
-- ------------------------------------------------------------
ALTER TABLE public.change_orders
  ADD CONSTRAINT change_orders_co_type_check
    CHECK (co_type IN ('owner_requested','designer_architect',
      'allowance_overage','site_condition','internal'));

-- ------------------------------------------------------------
-- (d) Add the new columns on change_orders
-- ------------------------------------------------------------
ALTER TABLE public.change_orders
  ADD COLUMN pricing_mode TEXT NOT NULL DEFAULT 'hard_priced'
    CHECK (pricing_mode IN ('hard_priced','budgetary','allowance_split')),
  ADD COLUMN source_proposal_id UUID REFERENCES public.proposals(id),
  ADD COLUMN reason TEXT;

-- ------------------------------------------------------------
-- (e) Add created_po_id on change_order_lines
-- ------------------------------------------------------------
ALTER TABLE public.change_order_lines
  ADD COLUMN created_po_id UUID REFERENCES public.purchase_orders(id);

-- ============================================================
-- 00066-B: Update contract-raising predicate in the CO cache trigger.
-- ============================================================
-- Before this phase, the filter `co_type = 'owner'` isolated contract-
-- raising COs from 'internal' budget reallocations. Under the expanded
-- value set, 4 of 5 types raise contract; only 'internal' does not
-- (plan doc §1066–1072). Switch to the complement.
--
-- Without this, the 73 rows just migrated from 'owner' to
-- 'owner_requested' stop matching the filter. On the next mutation of
-- any CO on their 2 affected jobs, co_cache_trigger sets
-- approved_cos_total = 0, silently zeroing $901,045.65 of cached
-- contract adjustment.
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
    AND co_type <> 'internal'
    AND status IN ('approved', 'executed')
    AND deleted_at IS NULL;

  UPDATE public.jobs
  SET approved_cos_total = co_total,
      current_contract_amount = COALESCE(original_contract_amount, 0) + co_total
  WHERE id = target_job_id;
END;
$$;

COMMENT ON FUNCTION app_private.refresh_approved_cos_total IS
'Recomputes jobs.approved_cos_total and current_contract_amount for a given job based on current change_orders state. Filter co_type <> ''internal'' excludes internal budget reallocations (which do not raise the contract) while including all 4 contract-raising types. Updated in 00066 from co_type = ''owner''.';

-- One-time backfill: re-run against every live job so approved_cos_total
-- reflects the new predicate immediately, not waiting on the next
-- mutation. Mirrors the 00042 post-install backfill pattern.
DO $$
DECLARE j RECORD;
BEGIN
  FOR j IN SELECT id FROM public.jobs WHERE deleted_at IS NULL LOOP
    PERFORM app_private.refresh_approved_cos_total(j.id);
  END LOOP;
END $$;

-- ============================================================
-- 00066-B.1: Verification probe.
-- ============================================================
-- If the cache backfill produces a different total than the
-- pre-migration cached sum, something is wrong with the predicate
-- change and the migration aborts. The $901,045.65 figure is captured
-- from Phase 2.3 pre-flight S7 — do not change it without re-running
-- the pre-flight sum query.
DO $$
DECLARE
  pre_migration_total_cents bigint := 90104565; -- $901,045.65,
    -- captured from S7 during pre-flight
  post_migration_total_cents bigint;
BEGIN
  SELECT COALESCE(SUM(approved_cos_total), 0)
  INTO post_migration_total_cents
  FROM public.jobs
  WHERE deleted_at IS NULL;

  IF post_migration_total_cents <> pre_migration_total_cents THEN
    RAISE EXCEPTION
      'Cache drift detected: pre-migration approved_cos_total sum was % cents, post-migration backfill produced % cents. Migration aborting to prevent silent cache corruption.',
      pre_migration_total_cents, post_migration_total_cents;
  END IF;

  RAISE NOTICE
    'Cache verification: pre = post = % cents. Migration safe.',
    post_migration_total_cents;
END $$;
