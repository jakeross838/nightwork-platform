-- ============================================================
-- Migration 00072: tighten job_milestones write policies to
-- match the read-side PM-on-own-jobs narrowing.
--
-- Phase 2.7 QA (commit c05da3a, qa-reports/qa-branch2-phase2.7.md
-- §5.7) surfaced a defense-in-depth asymmetry:
-- job_milestones_org_read narrows PMs to jobs where
-- pm_id = auth.uid() via EXISTS, but job_milestones_org_insert /
-- org_update WITH CHECK only gated on role membership + org_id.
-- FK-through-RLS did not catch cross-job INSERTs because
-- public.jobs has no PM-narrowed SELECT policy (unlike
-- public.draws, which does narrow PMs via "pm read draws on
-- own jobs").
--
-- Net effect before this fix: PMs could INSERT job_milestones
-- rows on jobs they don't own, but couldn't read them back
-- afterwards. Not a CVE (app UX never exposed cross-job write
-- buttons) but an asymmetry between read and write narrowing.
--
-- This migration extends the WITH CHECK predicate on
-- job_milestones_org_insert and job_milestones_org_update to
-- match the read policy's EXISTS clause. Writes now match reads.
--
-- Precedent: Phase 2.5 draw_adjustments (00069) relied on
-- FK-through-draws-RLS for emergent defense-in-depth. Phase
-- 2.7 can't rely on FK-through-jobs-RLS (jobs is org-wide) so
-- the narrowing must be explicit on the table's own policies.
--
-- R.19 carve-out: both conditions apply. No runtime code
-- touched; Migration Dry-Run exercises the policy change via
-- live-auth probes (Martin-on-Dewberry INSERT flips from
-- succeed to 42501).
--
-- R.16: paired 00072_job_milestones_pm_write_narrowing.down.sql
-- restores the pre-fix (asymmetric) policy shape so the rollback
-- path is clean. Rolling back reintroduces the §5.7 asymmetry —
-- this is intentional and documented in the down.sql header.
--
-- job_milestones is empty in production (0 rows at time of
-- apply) — no data reconciliation needed. Policy swap is
-- atomic within this migration.
-- ============================================================

-- Drop the existing (non-narrowed) policies.
DROP POLICY IF EXISTS job_milestones_org_insert ON public.job_milestones;
DROP POLICY IF EXISTS job_milestones_org_update ON public.job_milestones;

-- Recreate with PM-narrowing EXISTS matching the read policy.
-- The outer role-set gate preserves the workflow-data 4-role
-- write set (owner / admin / pm / accounting); the inner
-- branch splits PM writes (which require pm_id = auth.uid())
-- from owner/admin/accounting writes (which do not).

CREATE POLICY job_milestones_org_insert
  ON public.job_milestones
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner','admin','pm','accounting')
    )
    AND (
      app_private.user_role() IN ('owner','admin','accounting')
      OR (
        app_private.user_role() = 'pm'
        AND EXISTS (
          SELECT 1 FROM public.jobs j
          WHERE j.id = job_milestones.job_id
            AND j.pm_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY job_milestones_org_update
  ON public.job_milestones
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner','admin','pm','accounting')
    )
    AND (
      app_private.user_role() IN ('owner','admin','accounting')
      OR (
        app_private.user_role() = 'pm'
        AND EXISTS (
          SELECT 1 FROM public.jobs j
          WHERE j.id = job_milestones.job_id
            AND j.pm_id = auth.uid()
        )
      )
    )
  );
