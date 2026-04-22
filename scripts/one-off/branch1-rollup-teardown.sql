-- branch1-rollup-teardown.sql
--
-- Hard-deletes every row created during the Branch 1 Final Exit Gate rollup
-- regression suite. Every fixture uses the `ZZZ_BRANCH_1_ROLLUP_TEST_` prefix
-- per R.21 so this teardown can pattern-match and never touch real Ross Built
-- data.
--
-- Paper trail: committed to git BEFORE execution (R.22 authoring order:
-- finalize fixtures → write and commit teardown → execute tests → execute
-- teardown). Executed via Supabase MCP after the live rollup tests complete.
-- Idempotent — re-running produces zero deletions when no fixtures exist.
--
-- Fixture set (seeded synthetically for the regression flow):
--   jobs.name           LIKE 'ZZZ_BRANCH_1_ROLLUP_TEST_%'
--   cost_codes.code     LIKE 'ZZZ_BRANCH_1_ROLLUP_TEST_%'
--   vendors.name        LIKE 'ZZZ_BRANCH_1_ROLLUP_TEST_%'
--   + children discovered by FK: budget_lines, draws, invoices,
--     invoice_line_items, lien_releases, draw_line_items, purchase_orders
--   + side-effect rows keyed by entity_id: activity_log, notifications
--     (notifications have no FK to draws; matched by action_url path)

BEGIN;

-- 1. Collect test entity ids.
CREATE TEMP TABLE _b1r_test_jobs ON COMMIT DROP AS
  SELECT id FROM public.jobs WHERE name LIKE 'ZZZ_BRANCH_1_ROLLUP_TEST_%';

CREATE TEMP TABLE _b1r_test_draws ON COMMIT DROP AS
  SELECT id FROM public.draws WHERE job_id IN (SELECT id FROM _b1r_test_jobs);

CREATE TEMP TABLE _b1r_test_invoices ON COMMIT DROP AS
  SELECT id FROM public.invoices
   WHERE draw_id IN (SELECT id FROM _b1r_test_draws)
      OR job_id IN (SELECT id FROM _b1r_test_jobs);

CREATE TEMP TABLE _b1r_test_pos ON COMMIT DROP AS
  SELECT id FROM public.purchase_orders WHERE job_id IN (SELECT id FROM _b1r_test_jobs);

CREATE TEMP TABLE _b1r_test_lrs ON COMMIT DROP AS
  SELECT id FROM public.lien_releases
   WHERE job_id IN (SELECT id FROM _b1r_test_jobs)
      OR draw_id IN (SELECT id FROM _b1r_test_draws);

-- 2. activity_log side-effects (from logStatusChange / logActivity on test entities).
DELETE FROM public.activity_log
 WHERE entity_id IN (SELECT id FROM _b1r_test_draws)
    OR entity_id IN (SELECT id FROM _b1r_test_invoices)
    OR entity_id IN (SELECT id FROM _b1r_test_lrs)
    OR entity_id IN (SELECT id FROM _b1r_test_jobs)
    OR entity_id IN (SELECT id FROM _b1r_test_pos);

-- 3. notifications — no FK to draws. Match by action_url path to test draws.
--    Also catches the post-submit "lien_release_pending" + "draw_submitted" rows.
DELETE FROM public.notifications
 WHERE action_url IN (
   SELECT '/draws/' || id::text FROM _b1r_test_draws
 );

-- 4. Children of test invoices.
DELETE FROM public.invoice_line_items
 WHERE invoice_id IN (SELECT id FROM _b1r_test_invoices);

-- 5. Lien releases (children of test draws / jobs).
DELETE FROM public.lien_releases
 WHERE id IN (SELECT id FROM _b1r_test_lrs);

-- 6. Draw line items (if any seeded).
DELETE FROM public.draw_line_items
 WHERE draw_id IN (SELECT id FROM _b1r_test_draws);

-- 7. Invoices (children of test jobs / draws).
DELETE FROM public.invoices
 WHERE id IN (SELECT id FROM _b1r_test_invoices);

-- 8. Purchase orders on test jobs.
DELETE FROM public.purchase_orders
 WHERE id IN (SELECT id FROM _b1r_test_pos);

-- 9. Test draws themselves.
DELETE FROM public.draws
 WHERE id IN (SELECT id FROM _b1r_test_draws);

-- 10. Budget lines scoped to test jobs.
DELETE FROM public.budget_lines
 WHERE job_id IN (SELECT id FROM _b1r_test_jobs);

-- 11. Test cost codes (prefix-match on code).
DELETE FROM public.cost_codes
 WHERE code LIKE 'ZZZ_BRANCH_1_ROLLUP_TEST_%';

-- 12. Test vendors (prefix-match on name).
DELETE FROM public.vendors
 WHERE name LIKE 'ZZZ_BRANCH_1_ROLLUP_TEST_%';

-- 13. Test jobs last.
DELETE FROM public.jobs
 WHERE id IN (SELECT id FROM _b1r_test_jobs);

-- 14. Verification: zero fixtures should remain.
DO $$
DECLARE
  _jobs int; _cc int; _ven int; _bl int; _draws int;
  _inv int; _ili int; _lr int; _dli int; _po int;
BEGIN
  SELECT count(*) INTO _jobs  FROM public.jobs WHERE name LIKE 'ZZZ_BRANCH_1_ROLLUP_TEST_%';
  SELECT count(*) INTO _cc    FROM public.cost_codes WHERE code LIKE 'ZZZ_BRANCH_1_ROLLUP_TEST_%';
  SELECT count(*) INTO _ven   FROM public.vendors WHERE name LIKE 'ZZZ_BRANCH_1_ROLLUP_TEST_%';
  SELECT count(*) INTO _bl    FROM public.budget_lines bl
                               JOIN public.jobs j ON j.id = bl.job_id
                              WHERE j.name LIKE 'ZZZ_BRANCH_1_ROLLUP_TEST_%';
  SELECT count(*) INTO _draws FROM public.draws d
                               JOIN public.jobs j ON j.id = d.job_id
                              WHERE j.name LIKE 'ZZZ_BRANCH_1_ROLLUP_TEST_%';
  SELECT count(*) INTO _inv   FROM public.invoices i
                               LEFT JOIN public.jobs j ON j.id = i.job_id
                              WHERE j.name LIKE 'ZZZ_BRANCH_1_ROLLUP_TEST_%';
  SELECT count(*) INTO _ili   FROM public.invoice_line_items ili
                               JOIN public.invoices i ON i.id = ili.invoice_id
                               LEFT JOIN public.jobs j ON j.id = i.job_id
                              WHERE j.name LIKE 'ZZZ_BRANCH_1_ROLLUP_TEST_%';
  SELECT count(*) INTO _lr    FROM public.lien_releases lr
                               LEFT JOIN public.jobs j ON j.id = lr.job_id
                              WHERE j.name LIKE 'ZZZ_BRANCH_1_ROLLUP_TEST_%';
  SELECT count(*) INTO _dli   FROM public.draw_line_items dli
                               JOIN public.draws d ON d.id = dli.draw_id
                               JOIN public.jobs j ON j.id = d.job_id
                              WHERE j.name LIKE 'ZZZ_BRANCH_1_ROLLUP_TEST_%';
  SELECT count(*) INTO _po    FROM public.purchase_orders po
                               JOIN public.jobs j ON j.id = po.job_id
                              WHERE j.name LIKE 'ZZZ_BRANCH_1_ROLLUP_TEST_%';

  IF _jobs  > 0 THEN RAISE EXCEPTION 'Rollup test jobs remain: %', _jobs; END IF;
  IF _cc    > 0 THEN RAISE EXCEPTION 'Rollup test cost_codes remain: %', _cc; END IF;
  IF _ven   > 0 THEN RAISE EXCEPTION 'Rollup test vendors remain: %', _ven; END IF;
  IF _bl    > 0 THEN RAISE EXCEPTION 'Rollup test budget_lines remain: %', _bl; END IF;
  IF _draws > 0 THEN RAISE EXCEPTION 'Rollup test draws remain: %', _draws; END IF;
  IF _inv   > 0 THEN RAISE EXCEPTION 'Rollup test invoices remain: %', _inv; END IF;
  IF _ili   > 0 THEN RAISE EXCEPTION 'Rollup test invoice_line_items remain: %', _ili; END IF;
  IF _lr    > 0 THEN RAISE EXCEPTION 'Rollup test lien_releases remain: %', _lr; END IF;
  IF _dli   > 0 THEN RAISE EXCEPTION 'Rollup test draw_line_items remain: %', _dli; END IF;
  IF _po    > 0 THEN RAISE EXCEPTION 'Rollup test purchase_orders remain: %', _po; END IF;

  RAISE NOTICE 'Branch 1 rollup fixture teardown verified — zero fixtures remain.';
END $$;

COMMIT;
