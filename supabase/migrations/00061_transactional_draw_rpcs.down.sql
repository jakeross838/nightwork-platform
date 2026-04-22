-- 00061_transactional_draw_rpcs.down.sql
-- Rollback for 00061_transactional_draw_rpcs.sql.
--
-- IMPORTANT: running this .down.sql WITHOUT also reverting
-- `src/app/api/draws/[id]/action/route.ts` to its pre-Phase-1.3
-- implementation will break the draw submit/approve/void actions.
-- The route now invokes `supabase.rpc('draw_submit_rpc', …)` etc.;
-- once these functions are dropped, every call returns a
-- "function does not exist" error.
--
-- Rollback procedure if Phase 1.3 ever needs to be reverted:
--   1. Revert the action-route + notifications.ts + payment-schedule.ts
--      + lien-releases.ts changes from Phase 1.3's commit (78b57e6) in
--      a single commit.
--   2. Apply THIS .down.sql.
--   3. Drop the post-hoc test-cleanup artifact
--      `scripts/one-off/phase1.3-test-cleanup.sql` if still present.
--
-- See Phase 1.1 .down.sql precedent (00060_align_status_enums.down.sql)
-- for the paired-revert pattern. R.16 + prompt-34 item 5.

DROP FUNCTION IF EXISTS public.draw_submit_rpc(uuid, uuid, text, timestamptz, text);
DROP FUNCTION IF EXISTS public.draw_approve_rpc(uuid, uuid, text, timestamptz, text);
DROP FUNCTION IF EXISTS public.draw_void_rpc(uuid, uuid, text, timestamptz, text);
DROP FUNCTION IF EXISTS public._compute_scheduled_payment_date(date, text);
