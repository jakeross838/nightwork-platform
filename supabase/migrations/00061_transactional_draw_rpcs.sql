-- 00061_transactional_draw_rpcs.sql
-- Branch 1 Phase 1.3 — Transactional Cascade Wrapping
--
-- Before: draw submit/approve/void triggered a sequence of non-transactional
-- writes from the TS route — draw status, invoice statuses, lien release
-- generation, payment scheduling, notifications. A failure mid-sequence left
-- the DB in a partially-mutated state (e.g., draw 'submitted' but no lien
-- releases).
--
-- After: three RPCs wrap each cascade in a single PL/pgSQL function call =
-- single Postgres transaction. RAISE rolls back everything. The TS route
-- invokes `supabase.rpc('draw_submit_rpc', …)` once; post-commit it dispatches
-- emails and budget-line recalcs (side-effects that don't need atomicity with
-- the cascade).
--
-- Failure-injection hooks (for Phase 1.3 manual tests 2 and 4):
--   _force_fail = 'lien_gen'        → raises at the lien-release step inside
--                                      draw_submit_rpc (test 2)
--   _force_fail = 'approve'         → raises at the payment-schedule step
--                                      inside draw_approve_rpc (test 4)
-- The TS route reads FORCE_LIEN_GEN_FAIL and FORCE_APPROVE_FAIL env vars and
-- passes them through. In production the env vars are unset, `_force_fail`
-- defaults to null, and no injection occurs.
--
-- R.5 blast-radius decision (Jake, prompt 33, option a — narrow rebuild):
--   - src/lib/lien-releases.ts (4 exports, all draw-only) is deleted.
--     autoGenerateLienReleases, pendingReleaseBlockers, missingDocumentBlockers,
--     markDrawReleasesNotRequired are now inlined here.
--   - src/lib/payment-schedule.ts keeps its utility functions
--     (getOrgPaymentSchedule, scheduledPaymentDate) for invoice routes.
--     Only autoScheduleDrawPayments moved into draw_approve_rpc as PL/pgSQL.
--   - Date-math is duplicated (~25 lines) between TS and the helper below.
--     Tracked in GitHub issue #1 —
--     github.com/jakeross838/Ross-Built-Command/issues/1 — as a Branch 8 or
--     Branch 9 cleanup candidate. When consolidated, invoice routes will
--     also call _compute_scheduled_payment_date via RPC or a shared SQL
--     helper.
--
-- SECURITY DEFINER: these RPCs need to write across invoices, lien_releases,
-- draws, notifications — which would otherwise hit user-session RLS in the
-- route. The definer role (Supabase default: postgres) bypasses RLS. Callers
-- pass _actor_user_id explicitly for status_history attribution because
-- auth.uid() inside SECURITY DEFINER returns the definer.

-- ── Helper: payment-schedule date math (PL/pgSQL port of TS scheduledPaymentDate) ──
-- Mirrors src/lib/payment-schedule.ts::scheduledPaymentDate. Any change here
-- must be reflected in the TS version until the Branch 8/9 consolidation
-- collapses both into one source of truth.
CREATE OR REPLACE FUNCTION public._compute_scheduled_payment_date(
  _received_date date,
  _schedule text
) RETURNS date
  LANGUAGE plpgsql
  IMMUTABLE
AS $$
DECLARE
  target date;
  dow int;
  d int;
BEGIN
  IF _received_date IS NULL OR _schedule = 'custom' THEN
    RETURN NULL;
  END IF;

  d := EXTRACT(day FROM _received_date)::int;

  IF _schedule = '5_20' THEN
    IF d <= 5 THEN
      target := date_trunc('month', _received_date)::date + 14; -- 15th this month
    ELSIF d <= 20 THEN
      target := (date_trunc('month', _received_date) + interval '1 month')::date - 1; -- end of this month
    ELSE
      target := (date_trunc('month', _received_date) + interval '1 month')::date + 14; -- 15th next month
    END IF;
  ELSIF _schedule = '15_30' THEN
    IF d <= 15 THEN
      target := (date_trunc('month', _received_date) + interval '1 month')::date - 1;
    ELSE
      target := (date_trunc('month', _received_date) + interval '1 month')::date + 14;
    END IF;
  ELSIF _schedule = 'monthly' THEN
    target := (date_trunc('month', _received_date) + interval '2 months')::date - 1; -- end of next month
  ELSE
    RETURN NULL;
  END IF;

  -- Weekend bump: Sat(6) → Mon, Sun(7) → Mon. Postgres isodow: Mon=1..Sun=7.
  dow := EXTRACT(isodow FROM target)::int;
  IF dow = 6 THEN
    target := target + 2;
  ELSIF dow = 7 THEN
    target := target + 1;
  END IF;

  RETURN target;
END $$;

COMMENT ON FUNCTION public._compute_scheduled_payment_date IS
  'Internal helper — mirrors src/lib/payment-schedule.ts::scheduledPaymentDate. '
  'Tracked in GitHub issue #1. Candidate for Branch 8 or Branch 9.';

-- ── draw_submit_rpc ─────────────────────────────────────────────────────
-- Atomic: updates draw status, flips in-period qa_approved invoices to
-- in_draw (with status_history entries), idempotently generates one lien
-- release per vendor in the draw, enqueues notification rows for
-- accounting/admin (lien_release_pending) + owner/admin (draw_submitted).
-- All writes roll back together on any RAISE.
CREATE OR REPLACE FUNCTION public.draw_submit_rpc(
  _draw_id uuid,
  _actor_user_id uuid,
  _reason text DEFAULT NULL,
  _expected_updated_at timestamptz DEFAULT NULL,
  _force_fail text DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  _draw record;
  _invoice_ids uuid[];
  _new_release_count int := 0;
  _release_type text;
  _now timestamptz := now();
  _status_entry jsonb;
BEGIN
  -- Lock the draw row.
  SELECT id, org_id, job_id, status, status_history, draw_number,
         revision_number, period_end, is_final, current_payment_due,
         updated_at
    INTO _draw
    FROM draws
   WHERE id = _draw_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'draw not found: %', _draw_id USING ERRCODE = 'P0002';
  END IF;

  IF _draw.status NOT IN ('draft', 'pm_review') THEN
    RAISE EXCEPTION 'cannot submit a % draw (allowed: draft, pm_review)', _draw.status
      USING ERRCODE = 'P0001';
  END IF;

  IF _expected_updated_at IS NOT NULL
     AND _draw.updated_at IS DISTINCT FROM _expected_updated_at THEN
    RAISE EXCEPTION 'optimistic_lock_conflict' USING ERRCODE = '40001';
  END IF;

  IF _force_fail = 'pre_status' THEN
    RAISE EXCEPTION 'injected failure: pre_status' USING ERRCODE = 'P0001';
  END IF;

  -- 1. Update draw.
  _status_entry := jsonb_build_object(
    'who', COALESCE(_actor_user_id::text, 'system'),
    'when', _now,
    'old_status', _draw.status,
    'new_status', 'submitted',
    'note', COALESCE(_reason, 'Draw submitted')
  );

  UPDATE draws
     SET status = 'submitted',
         submitted_at = _now,
         wizard_draft = NULL,
         status_history = COALESCE(status_history, '[]'::jsonb) || jsonb_build_array(_status_entry),
         updated_at = _now
   WHERE id = _draw_id;

  -- 2. Flip qa_approved invoices → in_draw.
  WITH updated AS (
    UPDATE invoices
       SET status = 'in_draw',
           status_history = COALESCE(status_history, '[]'::jsonb) || jsonb_build_array(
             jsonb_build_object(
               'who', COALESCE(_actor_user_id::text, 'system'),
               'when', _now,
               'old_status', 'qa_approved',
               'new_status', 'in_draw',
               'note', format('Draw #%s submitted', _draw.draw_number)
             )
           ),
           updated_at = _now
     WHERE draw_id = _draw_id
       AND deleted_at IS NULL
       AND status = 'qa_approved'
    RETURNING id
  )
  SELECT array_agg(id) INTO _invoice_ids FROM updated;

  -- 3. Failure injection hook — test 2's FORCE_LIEN_GEN_FAIL.
  IF _force_fail IN ('lien_gen', 'FORCE_LIEN_GEN_FAIL') THEN
    RAISE EXCEPTION 'injected failure: lien_gen' USING ERRCODE = 'P0001';
  END IF;

  -- 4. Auto-generate lien releases (one per vendor, idempotent by draw+vendor).
  _release_type := CASE WHEN _draw.is_final THEN 'unconditional_final' ELSE 'conditional_progress' END;

  WITH vendor_sums AS (
    SELECT vendor_id, SUM(total_amount)::bigint AS amount
      FROM invoices
     WHERE draw_id = _draw_id
       AND deleted_at IS NULL
       AND vendor_id IS NOT NULL
     GROUP BY vendor_id
  ), inserted AS (
    INSERT INTO lien_releases (
      org_id, job_id, vendor_id, draw_id, release_type, amount, status,
      through_date, created_by
    )
    SELECT _draw.org_id, _draw.job_id, vs.vendor_id, _draw_id, _release_type,
           vs.amount, 'pending', _draw.period_end, _actor_user_id
      FROM vendor_sums vs
     WHERE NOT EXISTS (
       SELECT 1 FROM lien_releases lr
        WHERE lr.draw_id = _draw_id
          AND lr.vendor_id = vs.vendor_id
          AND lr.deleted_at IS NULL
     )
    RETURNING id
  )
  SELECT count(*)::int INTO _new_release_count FROM inserted;

  -- 5. Enqueue in-app notification rows. Emails dispatch AFTER RPC commits
  --    (from the route) — same transactional contract per phase spec.
  IF _new_release_count > 0 THEN
    INSERT INTO notifications (org_id, user_id, type, title, body, action_url)
    SELECT _draw.org_id, m.user_id, 'lien_release_pending',
           format('%s lien release(s) needed — Draw #%s', _new_release_count, _draw.draw_number),
           format('Draw #%s was submitted. %s vendor lien release(s) need to be collected.',
                  _draw.draw_number, _new_release_count),
           format('/draws/%s', _draw_id)
      FROM org_members m
     WHERE m.org_id = _draw.org_id
       AND m.role IN ('accounting', 'admin')
       AND m.is_active = TRUE;
  END IF;

  INSERT INTO notifications (org_id, user_id, type, title, body, action_url)
  SELECT _draw.org_id, m.user_id, 'draw_submitted',
         format('Draw #%s submitted', _draw.draw_number),
         format('Draw #%s submitted for approval.', _draw.draw_number),
         format('/draws/%s', _draw_id)
    FROM org_members m
   WHERE m.org_id = _draw.org_id
     AND m.role IN ('owner', 'admin')
     AND m.is_active = TRUE;

  RETURN jsonb_build_object(
    'status', 'submitted',
    'draw_number', _draw.draw_number,
    'job_id', _draw.job_id,
    'invoice_ids', COALESCE(to_jsonb(_invoice_ids), '[]'::jsonb),
    'new_lien_releases', _new_release_count,
    'current_payment_due', _draw.current_payment_due
  );
END $$;

COMMENT ON FUNCTION public.draw_submit_rpc IS
  'Atomic draw submit cascade: draw status + invoice flip + lien releases + '
  'notification rows. Phase 1.3.';

-- ── draw_approve_rpc ────────────────────────────────────────────────────
-- Atomic: validates no pending lien releases (and — if org setting on —
-- no missing lien release documents), updates draw status, auto-schedules
-- payments for in-draw invoices using _compute_scheduled_payment_date,
-- enqueues a draw_approved notification for the draw creator.
CREATE OR REPLACE FUNCTION public.draw_approve_rpc(
  _draw_id uuid,
  _actor_user_id uuid,
  _reason text DEFAULT NULL,
  _expected_updated_at timestamptz DEFAULT NULL,
  _force_fail text DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  _draw record;
  _pending_count int := 0;
  _missing_docs int := 0;
  _schedule text;
  _require_lien_doc boolean;
  _scheduled_count int := 0;
  _now timestamptz := now();
  _status_entry jsonb;
BEGIN
  SELECT id, org_id, job_id, status, status_history, draw_number,
         created_by, updated_at
    INTO _draw
    FROM draws
   WHERE id = _draw_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'draw not found: %', _draw_id USING ERRCODE = 'P0002';
  END IF;

  IF _draw.status NOT IN ('submitted', 'pm_review') THEN
    RAISE EXCEPTION 'cannot approve a % draw (allowed: submitted, pm_review)', _draw.status
      USING ERRCODE = 'P0001';
  END IF;

  IF _expected_updated_at IS NOT NULL
     AND _draw.updated_at IS DISTINCT FROM _expected_updated_at THEN
    RAISE EXCEPTION 'optimistic_lock_conflict' USING ERRCODE = '40001';
  END IF;

  -- Gate: pending lien releases block approval.
  SELECT count(*)::int INTO _pending_count
    FROM lien_releases
   WHERE draw_id = _draw_id
     AND status = 'pending'
     AND deleted_at IS NULL;
  IF _pending_count > 0 THEN
    RAISE EXCEPTION 'pending_lien_releases:%', _pending_count USING ERRCODE = 'P0001';
  END IF;

  -- Gate: missing lien release documents (only if org requires them).
  SELECT COALESCE(ows.require_lien_release_for_draw, false)
    INTO _require_lien_doc
    FROM org_workflow_settings ows
   WHERE ows.org_id = _draw.org_id
   LIMIT 1;

  IF _require_lien_doc THEN
    SELECT count(*)::int INTO _missing_docs
      FROM lien_releases
     WHERE draw_id = _draw_id
       AND deleted_at IS NULL
       AND status NOT IN ('waived', 'not_required')
       AND (document_url IS NULL OR document_url = '');
    IF _missing_docs > 0 THEN
      RAISE EXCEPTION 'missing_lien_documents:%', _missing_docs USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Failure injection hook — test 4's FORCE_APPROVE_FAIL.
  IF _force_fail IN ('approve', 'FORCE_APPROVE_FAIL') THEN
    RAISE EXCEPTION 'injected failure: approve' USING ERRCODE = 'P0001';
  END IF;

  -- Update draw.
  _status_entry := jsonb_build_object(
    'who', COALESCE(_actor_user_id::text, 'system'),
    'when', _now,
    'old_status', _draw.status,
    'new_status', 'approved',
    'note', COALESCE(_reason, 'Draw approved')
  );

  UPDATE draws
     SET status = 'approved',
         approved_at = _now,
         status_history = COALESCE(status_history, '[]'::jsonb) || jsonb_build_array(_status_entry),
         updated_at = _now
   WHERE id = _draw_id;

  -- Auto-schedule payments for invoices in the draw that don't already have one.
  SELECT COALESCE(payment_schedule_type, '5_20') INTO _schedule
    FROM organizations WHERE id = _draw.org_id;

  WITH scheduled AS (
    UPDATE invoices
       SET scheduled_payment_date = public._compute_scheduled_payment_date(received_date, _schedule),
           payment_status = CASE WHEN payment_status = 'unpaid' THEN 'scheduled' ELSE payment_status END,
           updated_at = _now
     WHERE draw_id = _draw_id
       AND deleted_at IS NULL
       AND payment_status <> 'paid'
       AND scheduled_payment_date IS NULL
       AND public._compute_scheduled_payment_date(received_date, _schedule) IS NOT NULL
    RETURNING id
  )
  SELECT count(*)::int INTO _scheduled_count FROM scheduled;

  -- Enqueue notification for the draw creator.
  IF _draw.created_by IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, type, title, body, action_url)
    VALUES (
      _draw.org_id, _draw.created_by, 'draw_approved',
      format('Draw #%s approved', _draw.draw_number),
      'Your draw submission has been approved.',
      format('/draws/%s', _draw_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'approved',
    'draw_number', _draw.draw_number,
    'job_id', _draw.job_id,
    'scheduled_payment_count', _scheduled_count
  );
END $$;

COMMENT ON FUNCTION public.draw_approve_rpc IS
  'Atomic draw approve cascade: lien gate + status update + payment schedule + '
  'notification. Phase 1.3.';

-- ── draw_void_rpc ───────────────────────────────────────────────────────
-- Atomic: updates draw status, unlinks invoices from the draw and reverts
-- them to qa_approved, marks pending lien releases as not_required.
CREATE OR REPLACE FUNCTION public.draw_void_rpc(
  _draw_id uuid,
  _actor_user_id uuid,
  _reason text DEFAULT NULL,
  _expected_updated_at timestamptz DEFAULT NULL,
  _force_fail text DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  _draw record;
  _paid_count int;
  _invoice_ids uuid[];
  _release_count int := 0;
  _now timestamptz := now();
  _status_entry jsonb;
BEGIN
  SELECT id, org_id, job_id, status, status_history, draw_number, updated_at
    INTO _draw
    FROM draws
   WHERE id = _draw_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'draw not found: %', _draw_id USING ERRCODE = 'P0002';
  END IF;

  IF _draw.status NOT IN ('draft', 'pm_review', 'submitted', 'approved', 'locked') THEN
    RAISE EXCEPTION 'cannot void a % draw', _draw.status USING ERRCODE = 'P0001';
  END IF;

  IF _expected_updated_at IS NOT NULL
     AND _draw.updated_at IS DISTINCT FROM _expected_updated_at THEN
    RAISE EXCEPTION 'optimistic_lock_conflict' USING ERRCODE = '40001';
  END IF;

  -- Gate: cannot void if any invoice in the draw is already paid.
  SELECT count(*)::int INTO _paid_count
    FROM invoices
   WHERE draw_id = _draw_id
     AND payment_status = 'paid'
     AND deleted_at IS NULL;
  IF _paid_count > 0 THEN
    RAISE EXCEPTION 'paid_invoices_in_draw:%', _paid_count USING ERRCODE = 'P0001';
  END IF;

  IF _force_fail = 'void' THEN
    RAISE EXCEPTION 'injected failure: void' USING ERRCODE = 'P0001';
  END IF;

  -- Update draw status.
  _status_entry := jsonb_build_object(
    'who', COALESCE(_actor_user_id::text, 'system'),
    'when', _now,
    'old_status', _draw.status,
    'new_status', 'void',
    'note', COALESCE(_reason, 'Draw voided')
  );

  UPDATE draws
     SET status = 'void',
         status_history = COALESCE(status_history, '[]'::jsonb) || jsonb_build_array(_status_entry),
         updated_at = _now
   WHERE id = _draw_id;

  -- Unlink invoices and revert their status.
  WITH unlinked AS (
    UPDATE invoices
       SET status = 'qa_approved',
           draw_id = NULL,
           status_history = COALESCE(status_history, '[]'::jsonb) || jsonb_build_array(
             jsonb_build_object(
               'who', COALESCE(_actor_user_id::text, 'system'),
               'when', _now,
               'old_status', 'in_draw',
               'new_status', 'qa_approved',
               'note', format('Draw #%s voided', _draw.draw_number)
             )
           ),
           updated_at = _now
     WHERE draw_id = _draw_id
       AND deleted_at IS NULL
       AND status = 'in_draw'
    RETURNING id
  )
  SELECT array_agg(id) INTO _invoice_ids FROM unlinked;

  -- Mark pending lien releases as not_required.
  WITH released AS (
    UPDATE lien_releases
       SET status = 'not_required',
           updated_at = _now
     WHERE draw_id = _draw_id
       AND status = 'pending'
       AND deleted_at IS NULL
    RETURNING id
  )
  SELECT count(*)::int INTO _release_count FROM released;

  RETURN jsonb_build_object(
    'status', 'void',
    'draw_number', _draw.draw_number,
    'job_id', _draw.job_id,
    'invoice_ids', COALESCE(to_jsonb(_invoice_ids), '[]'::jsonb),
    'releases_marked_not_required', _release_count
  );
END $$;

COMMENT ON FUNCTION public.draw_void_rpc IS
  'Atomic draw void cascade: status update + invoice unlink + release revert. '
  'Phase 1.3.';

-- ── Grants ──────────────────────────────────────────────────────────────
-- authenticated role calls these via PostgREST RPC; SECURITY DEFINER handles
-- the table-level RLS bypass internally.
GRANT EXECUTE ON FUNCTION public.draw_submit_rpc(uuid, uuid, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.draw_approve_rpc(uuid, uuid, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.draw_void_rpc(uuid, uuid, text, timestamptz, text) TO authenticated;
-- Helper is called only from the RPCs above.
REVOKE ALL ON FUNCTION public._compute_scheduled_payment_date(date, text) FROM PUBLIC;
