-- phase2.3-live-test-teardown.sql
--
-- Hard-deletes every row created during Phase 2.3 live workflow tests. Every
-- fixture uses the `ZZZ_PHASE_2_3_LIVE_TEST_` prefix per R.21 so this
-- teardown can pattern-match and never touch real Ross Built data.
--
-- Paper trail: committed to git BEFORE execution (R.22 + Phase 1.4
-- precedent). Executed via Supabase MCP after the live workflow completes.
-- Idempotent — re-running produces zero deletions when no fixtures exist.
--
-- Fixture set (created synthetically for the live workflow, torn down here):
--   - jobs.name            LIKE 'ZZZ_PHASE_2_3_LIVE_TEST%'
--   - vendors.name         LIKE 'ZZZ_PHASE_2_3_LIVE_TEST%'
--   - change_orders.title  LIKE 'ZZZ_PHASE_2_3_TEST_CO%' OR job_id in test jobs
--   - change_order_lines   (discovered by FK to test COs)
--   - budget_lines         (discovered by FK to test jobs)
--
-- After teardown, the Ross Built invariant is re-verified: SUM(approved_cos_total)
-- across live jobs must return to 90104565 cents (the pre-migration /
-- pre-test baseline captured in Phase 2.3 pre-flight S7).

BEGIN;

-- 1. Collect test job ids.
CREATE TEMP TABLE _phase23_test_jobs ON COMMIT DROP AS
  SELECT id FROM public.jobs WHERE name LIKE 'ZZZ_PHASE_2_3_LIVE_TEST%';

-- 2. Collect test change order ids (by title prefix OR by test job parent).
CREATE TEMP TABLE _phase23_test_cos ON COMMIT DROP AS
  SELECT id FROM public.change_orders
   WHERE title LIKE 'ZZZ_PHASE_2_3_TEST_CO%'
      OR job_id IN (SELECT id FROM _phase23_test_jobs);

-- 3. Child rows of test change orders (change_order_lines) first.
DELETE FROM public.change_order_lines
 WHERE co_id IN (SELECT id FROM _phase23_test_cos);

-- 4. Test change orders themselves. Deleting these will fire the
--    co_cache_trigger on each parent job; after the DELETE, any test job's
--    approved_cos_total recomputes to 0 (since no surviving COs), and any
--    real-job CO accidentally pulled in would still be subject to the trigger
--    recompute — but per the scope above we only delete rows we own.
DELETE FROM public.change_orders
 WHERE id IN (SELECT id FROM _phase23_test_cos);

-- 5. Budget lines scoped to test jobs (if any were created).
DELETE FROM public.budget_lines
 WHERE job_id IN (SELECT id FROM _phase23_test_jobs);

-- 6. Test jobs.
DELETE FROM public.jobs
 WHERE id IN (SELECT id FROM _phase23_test_jobs);

-- 7. Test vendors (separate from jobs — prefix-match on name).
DELETE FROM public.vendors
 WHERE name LIKE 'ZZZ_PHASE_2_3_LIVE_TEST%';

-- 8. Verification: zero fixtures remain + Ross Built invariant restored.
DO $$
DECLARE
  _jobs int;
  _vendors int;
  _cos int;
  _col int;
  _bl int;
  _live_sum_cents bigint;
  expected_sum_cents bigint := 90104565;  -- pre-test baseline
BEGIN
  SELECT count(*) INTO _jobs
    FROM public.jobs WHERE name LIKE 'ZZZ_PHASE_2_3_LIVE_TEST%';
  SELECT count(*) INTO _vendors
    FROM public.vendors WHERE name LIKE 'ZZZ_PHASE_2_3_LIVE_TEST%';
  SELECT count(*) INTO _cos
    FROM public.change_orders WHERE title LIKE 'ZZZ_PHASE_2_3_TEST_CO%';
  SELECT count(*) INTO _col
    FROM public.change_order_lines col
    JOIN public.change_orders co ON co.id = col.co_id
   WHERE co.title LIKE 'ZZZ_PHASE_2_3_TEST_CO%';
  SELECT count(*) INTO _bl
    FROM public.budget_lines bl
    JOIN public.jobs j ON j.id = bl.job_id
   WHERE j.name LIKE 'ZZZ_PHASE_2_3_LIVE_TEST%';

  IF _jobs    > 0 THEN RAISE EXCEPTION 'Phase 2.3 test jobs remain: %', _jobs; END IF;
  IF _vendors > 0 THEN RAISE EXCEPTION 'Phase 2.3 test vendors remain: %', _vendors; END IF;
  IF _cos     > 0 THEN RAISE EXCEPTION 'Phase 2.3 test change_orders remain: %', _cos; END IF;
  IF _col     > 0 THEN RAISE EXCEPTION 'Phase 2.3 test change_order_lines remain: %', _col; END IF;
  IF _bl      > 0 THEN RAISE EXCEPTION 'Phase 2.3 test budget_lines remain: %', _bl; END IF;

  -- Invariant restoration check: after teardown, the SUM across live jobs
  -- must match the pre-test / pre-migration baseline. If it diverges, the
  -- teardown failed to clean a cache-raising fixture or the cache trigger
  -- didn't recompute after the test CO delete.
  SELECT COALESCE(SUM(approved_cos_total), 0) INTO _live_sum_cents
    FROM public.jobs WHERE deleted_at IS NULL;

  IF _live_sum_cents <> expected_sum_cents THEN
    RAISE EXCEPTION
      'Invariant not restored: SUM(approved_cos_total) is % cents, expected % cents. Cache may still reflect test-CO adjustments.',
      _live_sum_cents, expected_sum_cents;
  END IF;

  RAISE NOTICE
    'Phase 2.3 live test teardown verified — zero fixtures remain; invariant restored to % cents.',
    _live_sum_cents;
END $$;

COMMIT;
