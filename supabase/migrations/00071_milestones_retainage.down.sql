-- ============================================================
-- 00071_milestones_retainage.down.sql — reverses 00071
-- ============================================================
-- Strict reverse-dependency order:
--
--   (1) Drop draws columns (reverse of section (g) up).
--       CHECK constraint chk_draws_draw_mode auto-drops with
--       the draw_mode column.
--
--   (2) Drop jobs new columns (reverse of section (f)).
--       chk_jobs_retainage_threshold_percent and
--       chk_jobs_retainage_dropoff_percent auto-drop with
--       their columns.
--
--   (3) **Amendment I — GH #5 rollback path (NOT EXECUTED).**
--       If a future operator ever needs to restore the
--       jobs_retainage_percent_check duplicate that 00071
--       dropped (Amendment E / Option A), the SQL below
--       reproduces it. Kept as a commented-out block so the
--       undo path is documented at the source of truth
--       without actually executing — a live re-add would
--       re-introduce the byte-identical duplicate whose
--       removal was the whole point. To apply: uncomment the
--       two lines below, run this file.
--       -----
--       -- Restore the GH #5 duplicate CHECK on jobs.retainage_percent:
--       -- ALTER TABLE public.jobs
--       --   ADD CONSTRAINT jobs_retainage_percent_check
--       --   CHECK (retainage_percent >= 0 AND retainage_percent <= 100);
--
--   (4) Drop job_milestones policies (reverse-declaration
--       order: update → insert → read).
--   (5) DISABLE RLS on job_milestones.
--   (6) Drop updated_at trigger.
--   (7) Drop indexes (reverse of section (c)).
--   (8) DROP TABLE public.job_milestones.
--
-- Data loss on rollback: all rows in public.job_milestones are
-- discarded. 15 jobs and 2 draws have their 00071-added columns
-- DROPPED (defaults backfilled in the up migration are lost).
-- Existing rows survive; only the new columns are removed.
-- ============================================================

-- (1) Drop draws columns.
ALTER TABLE public.draws
  DROP COLUMN IF EXISTS tm_markup_amount,
  DROP COLUMN IF EXISTS tm_sub_cost,
  DROP COLUMN IF EXISTS tm_material_cost,
  DROP COLUMN IF EXISTS tm_labor_hours,
  DROP COLUMN IF EXISTS milestone_completions,
  DROP COLUMN IF EXISTS draw_mode;

-- (2) Drop jobs new columns.
ALTER TABLE public.jobs
  DROP COLUMN IF EXISTS retainage_dropoff_percent,
  DROP COLUMN IF EXISTS retainage_threshold_percent;

-- (3) GH #5 rollback path (Amendment I) — commented out above;
-- see the header block for the restore SQL.

-- (4) Drop job_milestones policies.
DROP POLICY IF EXISTS job_milestones_org_update ON public.job_milestones;
DROP POLICY IF EXISTS job_milestones_org_insert ON public.job_milestones;
DROP POLICY IF EXISTS job_milestones_org_read   ON public.job_milestones;

-- (5) DISABLE RLS.
ALTER TABLE public.job_milestones DISABLE ROW LEVEL SECURITY;

-- (6) Drop updated_at trigger.
DROP TRIGGER IF EXISTS trg_job_milestones_updated_at
  ON public.job_milestones;

-- (7) Drop indexes.
DROP INDEX IF EXISTS idx_job_milestones_target_date;
DROP INDEX IF EXISTS idx_job_milestones_status;
DROP INDEX IF EXISTS idx_job_milestones_org_job;
DROP INDEX IF EXISTS job_milestones_unique_sort_per_job;

-- (8) Drop table.
DROP TABLE IF EXISTS public.job_milestones;
