-- phase1.3-test-cleanup.sql
--
-- One-off cleanup script for Phase 1.3 test pollution on real Ross Built
-- draws (Fish Residence, Dewberry). See R.21 for why this was needed and
-- why it shouldn't happen again.
--
-- Targets:
--   - Fish Residence draw #1   (b0277ee7-a172-4cec-b15f-37f204b2e38e)
--   - Dewberry draw #1         (13087857-a5fb-4a93-8312-45642ea7c395)
--
-- Paper trail: this script is git-committed before execution per Jake's
-- directive (prompt 34 item 3). Executed via Supabase MCP apply-sql after
-- Jake confirms the intended pre-state.
--
-- Intended pre-state (from status_history reconstruction):
--
--   Fish Residence draw #1
--     status               = 'draft'
--     submitted_at, approved_at, locked_at, paid_at = NULL
--     status_history       = [ initial "Draw #1 created" entry only ]
--     wizard_draft         = NULL  (cannot restore original; submit RPC
--                                   clears it to NULL — note in paper
--                                   trail, leave null)
--
--   Fish Residence lien_releases for draw #1
--     existed pre-test: 0   → hard DELETE all 18 test-created rows
--
--   Fish Residence invoices linked to draw #1 (45 rows)
--     Before submit test:
--       43 × qa_approved / unpaid
--        1 × pm_review   / unpaid
--        1 × qa_review   / unpaid
--       All 45 had scheduled_payment_date = NULL
--     After tests:
--       43 × in_draw      / scheduled (status_history gained "Draw #1 submitted")
--        1 × pm_review    / scheduled
--        1 × qa_review    / scheduled
--     Cleanup:
--       - status: in_draw → qa_approved (for the 43 rows)
--       - payment_status: scheduled → unpaid (for all 45)
--       - scheduled_payment_date → NULL (for all 45)
--       - status_history: strip entries with note = 'Draw #1 submitted'
--
--   Dewberry draw #1
--     status               = 'draft'
--     submitted_at         = NULL   (current value was set by my
--                                    manual SQL UPDATE for the void smoke test)
--     status_history       = [ initial "Draw #1 created" entry only ]
--     wizard_draft         = NULL   (same caveat as Fish)
--
--   Dewberry lien_releases: none were created by the smoke test → no-op.
--   Dewberry invoices: the void smoke test did NOT flip any invoice
--     status (none were in 'in_draw' state to begin with). Current state:
--     11 × qa_approved / unpaid, no scheduled_payment_date → no-op for
--     invoices.
--
-- Execution is wrapped in a single transaction so any statement error
-- rolls back the whole cleanup. Verification queries at the end confirm
-- the target state.

BEGIN;

-- ─── Fish Residence (b0277ee7…) ────────────────────────────────────────

-- Hard-delete the 18 lien_releases created by the submit test.
DELETE FROM public.lien_releases
 WHERE draw_id = 'b0277ee7-a172-4cec-b15f-37f204b2e38e';

-- Revert the 43 invoices that were flipped qa_approved → in_draw by the
-- submit test. Strip the "Draw #1 submitted" entry from status_history.
UPDATE public.invoices
   SET status = 'qa_approved',
       status_history = (
         SELECT COALESCE(jsonb_agg(entry), '[]'::jsonb)
           FROM jsonb_array_elements(status_history) AS entry
          WHERE (entry->>'note') IS DISTINCT FROM 'Draw #1 submitted'
       )
 WHERE draw_id = 'b0277ee7-a172-4cec-b15f-37f204b2e38e'
   AND status = 'in_draw'
   AND deleted_at IS NULL;

-- Clear scheduled_payment_date and revert payment_status on all 45
-- invoices that the approve RPC touched (anything with payment_status
-- 'scheduled' that still has a scheduled_payment_date).
UPDATE public.invoices
   SET scheduled_payment_date = NULL,
       payment_status = 'unpaid'
 WHERE draw_id = 'b0277ee7-a172-4cec-b15f-37f204b2e38e'
   AND payment_status = 'scheduled'
   AND deleted_at IS NULL;

-- Revert the draw itself.
UPDATE public.draws
   SET status = 'draft',
       submitted_at = NULL,
       approved_at = NULL,
       locked_at = NULL,
       paid_at = NULL,
       status_history = (
         SELECT COALESCE(jsonb_agg(entry), '[]'::jsonb)
           FROM jsonb_array_elements(status_history) AS entry
          WHERE (entry->>'note') NOT LIKE 'Phase 1.3%'
       )
 WHERE id = 'b0277ee7-a172-4cec-b15f-37f204b2e38e';

-- ─── Dewberry (13087857…) ──────────────────────────────────────────────

UPDATE public.draws
   SET status = 'draft',
       submitted_at = NULL,
       status_history = (
         SELECT COALESCE(jsonb_agg(entry), '[]'::jsonb)
           FROM jsonb_array_elements(status_history) AS entry
          WHERE (entry->>'note') NOT LIKE 'Phase 1.3%'
       )
 WHERE id = '13087857-a5fb-4a93-8312-45642ea7c395';

-- ─── Verification ─────────────────────────────────────────────────────

-- Fish draw back to draft + clean history.
DO $$
DECLARE
  _fish_status text;
  _fish_hist_len int;
  _fish_releases int;
  _fish_in_draw int;
  _fish_scheduled int;
  _dew_status text;
  _dew_hist_len int;
  _dew_submitted_at timestamptz;
BEGIN
  SELECT status, jsonb_array_length(status_history) INTO _fish_status, _fish_hist_len
    FROM draws WHERE id = 'b0277ee7-a172-4cec-b15f-37f204b2e38e';
  SELECT count(*) INTO _fish_releases FROM lien_releases
   WHERE draw_id = 'b0277ee7-a172-4cec-b15f-37f204b2e38e';
  SELECT count(*) INTO _fish_in_draw FROM invoices
   WHERE draw_id = 'b0277ee7-a172-4cec-b15f-37f204b2e38e'
     AND status = 'in_draw' AND deleted_at IS NULL;
  SELECT count(*) INTO _fish_scheduled FROM invoices
   WHERE draw_id = 'b0277ee7-a172-4cec-b15f-37f204b2e38e'
     AND (payment_status = 'scheduled' OR scheduled_payment_date IS NOT NULL)
     AND deleted_at IS NULL;
  SELECT status, jsonb_array_length(status_history), submitted_at
    INTO _dew_status, _dew_hist_len, _dew_submitted_at
    FROM draws WHERE id = '13087857-a5fb-4a93-8312-45642ea7c395';

  IF _fish_status <> 'draft' THEN RAISE EXCEPTION 'Fish draw not draft: %', _fish_status; END IF;
  IF _fish_hist_len <> 1 THEN RAISE EXCEPTION 'Fish status_history unexpected length: %', _fish_hist_len; END IF;
  IF _fish_releases <> 0 THEN RAISE EXCEPTION 'Fish lien_releases not cleared: %', _fish_releases; END IF;
  IF _fish_in_draw <> 0 THEN RAISE EXCEPTION 'Fish in_draw invoices remain: %', _fish_in_draw; END IF;
  IF _fish_scheduled <> 0 THEN RAISE EXCEPTION 'Fish scheduled invoices remain: %', _fish_scheduled; END IF;

  IF _dew_status <> 'draft' THEN RAISE EXCEPTION 'Dewberry draw not draft: %', _dew_status; END IF;
  IF _dew_hist_len <> 1 THEN RAISE EXCEPTION 'Dewberry status_history unexpected length: %', _dew_hist_len; END IF;
  IF _dew_submitted_at IS NOT NULL THEN RAISE EXCEPTION 'Dewberry submitted_at not cleared'; END IF;

  RAISE NOTICE 'Phase 1.3 test cleanup verified.';
END $$;

COMMIT;
