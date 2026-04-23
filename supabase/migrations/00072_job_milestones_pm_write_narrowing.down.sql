-- ============================================================
-- 00072_job_milestones_pm_write_narrowing.down.sql — reverses 00072
-- ============================================================
--
-- ROLLBACK INTENTIONALLY RESTORES THE §5.7 ASYMMETRY.
--
-- Migration 00072 closed the defense-in-depth asymmetry flagged
-- in Phase 2.7 QA §5.7: job_milestones read-side narrows PMs to
-- their own jobs via EXISTS, while the original 00071 write-side
-- only gated on role + org_id. 00072 added the same EXISTS
-- clause to the write-side policies.
--
-- This down migration restores the pre-fix (asymmetric) policy
-- shape — write policies will again gate only on role + org_id,
-- allowing PMs to INSERT/UPDATE job_milestones rows on jobs they
-- don't own (though still unable to read them back).
--
-- If you roll this back, you reintroduce the asymmetry. Not a
-- CVE (UX never exposes cross-job writes) but not defensible as
-- a permanent state either — Phase 2.5 QA §5 FK-through-RLS
-- defense does NOT cover this case because public.jobs is
-- org-wide readable. Any code path that lets PMs trigger
-- milestone writes via direct SQL / service-role impersonation
-- could pollute other PMs' milestone lists.
--
-- Usage: only roll back if debugging or intentionally reverting
-- to 00071's policy shape.
-- ============================================================

-- Drop the narrowed policies.
DROP POLICY IF EXISTS job_milestones_org_insert ON public.job_milestones;
DROP POLICY IF EXISTS job_milestones_org_update ON public.job_milestones;

-- Recreate in the original 00071 (non-narrowed) shape.

CREATE POLICY job_milestones_org_insert
  ON public.job_milestones
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner','admin','pm','accounting')
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
  );
