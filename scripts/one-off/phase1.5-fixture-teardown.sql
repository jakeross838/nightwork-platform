-- phase1.5-fixture-teardown.sql
--
-- Hard-deletes every row created during Phase 1.5 live manual tests. Every
-- fixture uses the `ZZZ_PHASE_1_5_TEST_` prefix per R.21 so this teardown
-- can pattern-match and never touch real Ross Built data.
--
-- Paper trail: committed to git BEFORE execution (R.22 authoring order:
-- finalize fixtures → write and commit teardown → execute tests → execute
-- teardown). Executed via Supabase MCP after the live tests complete.
-- Idempotent — re-running produces zero deletions when no fixtures exist.
--
-- Fixture set (created synthetically for the tests, torn down here):
--   - jobs.name         LIKE 'ZZZ_PHASE_1_5_TEST_%'
--   - lien_releases scoped to the test jobs (discovered by FK, not by name —
--     lien_releases has no name column, so prefix-matching on the parent job
--     is how we isolate them)
--
-- Phase 1.5 does NOT seed: draws, draw_line_items, change_orders,
-- budget_lines, cost_codes, invoices, POs, or vendors. If any of those
-- appear with a ZZZ_PHASE_1_5_TEST_ reference, flag it: the fixture plan
-- drifted and this teardown under-covers it.

BEGIN;

-- 1. Collect test job ids.
CREATE TEMP TABLE _phase15_test_jobs ON COMMIT DROP AS
  SELECT id FROM public.jobs WHERE name LIKE 'ZZZ_PHASE_1_5_TEST_%';

-- 2. Delete test lien_releases (children of test jobs).
DELETE FROM public.lien_releases
 WHERE job_id IN (SELECT id FROM _phase15_test_jobs);

-- 3. Delete the test jobs themselves.
DELETE FROM public.jobs
 WHERE id IN (SELECT id FROM _phase15_test_jobs);

-- 4. Verification: zero fixtures should remain.
DO $$
DECLARE
  _jobs int;
  _lrs  int;
BEGIN
  SELECT count(*) INTO _jobs FROM public.jobs WHERE name LIKE 'ZZZ_PHASE_1_5_TEST_%';
  SELECT count(*) INTO _lrs  FROM public.lien_releases lr
                              JOIN public.jobs j ON j.id = lr.job_id
                             WHERE j.name LIKE 'ZZZ_PHASE_1_5_TEST_%';

  IF _jobs > 0 THEN RAISE EXCEPTION 'Phase 1.5 test jobs remain: %', _jobs; END IF;
  IF _lrs  > 0 THEN RAISE EXCEPTION 'Phase 1.5 test lien_releases remain: %', _lrs; END IF;

  RAISE NOTICE 'Phase 1.5 fixture teardown verified — zero fixtures remain.';
END $$;

COMMIT;
