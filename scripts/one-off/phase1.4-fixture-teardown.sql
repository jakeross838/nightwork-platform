-- phase1.4-fixture-teardown.sql
--
-- Hard-deletes every row created during Phase 1.4 live manual tests. Every
-- fixture uses the `ZZZ_PHASE_1_4_TEST_` prefix per R.21 so this teardown
-- can pattern-match and never touch real Ross Built data.
--
-- Paper trail: committed to git BEFORE execution (R.21 + Phase 1.3
-- precedent). Executed via Supabase MCP after the live tests complete.
-- Idempotent — re-running produces zero deletions when no fixtures exist.
--
-- Fixture set (created synthetically for the tests, torn down here):
--   - jobs.name        LIKE 'ZZZ_PHASE_1_4_TEST_%'
--   - cost_codes.code  LIKE 'ZZZ_PHASE_1_4_TEST_%'
--   - budget_lines / draws / draw_line_items / lien_releases scoped to the
--     test jobs (discovered by FK, not by name)

BEGIN;

-- 1. Collect test job ids.
CREATE TEMP TABLE _phase14_test_jobs ON COMMIT DROP AS
  SELECT id FROM public.jobs WHERE name LIKE 'ZZZ_PHASE_1_4_TEST_%';

-- 2. Collect test draw ids (children of test jobs).
CREATE TEMP TABLE _phase14_test_draws ON COMMIT DROP AS
  SELECT id FROM public.draws WHERE job_id IN (SELECT id FROM _phase14_test_jobs);

-- 3. Children of test draws first.
DELETE FROM public.draw_line_items
 WHERE draw_id IN (SELECT id FROM _phase14_test_draws);

DELETE FROM public.lien_releases
 WHERE draw_id IN (SELECT id FROM _phase14_test_draws);

-- 4. Test draws themselves.
DELETE FROM public.draws
 WHERE id IN (SELECT id FROM _phase14_test_draws);

-- 5. Budget lines scoped to test jobs.
DELETE FROM public.budget_lines
 WHERE job_id IN (SELECT id FROM _phase14_test_jobs);

-- 6. Test cost codes (prefix-match on code).
DELETE FROM public.cost_codes
 WHERE code LIKE 'ZZZ_PHASE_1_4_TEST_%';

-- 7. Test jobs last.
DELETE FROM public.jobs
 WHERE id IN (SELECT id FROM _phase14_test_jobs);

-- 8. Verification: zero fixtures should remain.
DO $$
DECLARE
  _jobs int;
  _cc int;
  _bl int;
  _draws int;
  _dli int;
BEGIN
  SELECT count(*) INTO _jobs  FROM public.jobs        WHERE name LIKE 'ZZZ_PHASE_1_4_TEST_%';
  SELECT count(*) INTO _cc    FROM public.cost_codes  WHERE code LIKE 'ZZZ_PHASE_1_4_TEST_%';
  SELECT count(*) INTO _bl    FROM public.budget_lines bl
                              JOIN public.jobs j ON j.id = bl.job_id
                             WHERE j.name LIKE 'ZZZ_PHASE_1_4_TEST_%';
  SELECT count(*) INTO _draws FROM public.draws d
                              JOIN public.jobs j ON j.id = d.job_id
                             WHERE j.name LIKE 'ZZZ_PHASE_1_4_TEST_%';
  SELECT count(*) INTO _dli   FROM public.draw_line_items dli
                              JOIN public.draws d ON d.id = dli.draw_id
                              JOIN public.jobs j ON j.id = d.job_id
                             WHERE j.name LIKE 'ZZZ_PHASE_1_4_TEST_%';

  IF _jobs  > 0 THEN RAISE EXCEPTION 'Phase 1.4 test jobs remain: %', _jobs; END IF;
  IF _cc    > 0 THEN RAISE EXCEPTION 'Phase 1.4 test cost_codes remain: %', _cc; END IF;
  IF _bl    > 0 THEN RAISE EXCEPTION 'Phase 1.4 test budget_lines remain: %', _bl; END IF;
  IF _draws > 0 THEN RAISE EXCEPTION 'Phase 1.4 test draws remain: %', _draws; END IF;
  IF _dli   > 0 THEN RAISE EXCEPTION 'Phase 1.4 test draw_line_items remain: %', _dli; END IF;

  RAISE NOTICE 'Phase 1.4 fixture teardown verified — zero fixtures remain.';
END $$;

COMMIT;
