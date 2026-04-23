-- ============================================================
-- 00071_milestones_retainage.sql — Phase 2.7 (Branch 2)
-- ============================================================
--
-- Adds public.job_milestones (workflow entity — PMs mark
-- complete; accounting bills against them into draws); extends
-- public.jobs with two retainage-policy columns (threshold +
-- dropoff); extends public.draws with draw_mode +
-- milestone_completions + T&M columns.
--
-- Plan-doc lineage: amended spec committed at 510dacb (pre-
-- flight amendments A–L + Amendment M GH #15 tracker), pre-
-- flight findings at commit 0b548ff. Every amendment below
-- maps back to the plan-doc amendment-history block.
--
-- ------------------------------------------------------------
-- R.23 precedent: job_milestones adopts the 00065 proposals
-- 3-policy pattern (org_read / org_insert / org_update; no
-- DELETE, soft-delete via deleted_at) PLUS the 00069
-- draw_adjustments PM-on-own-jobs read-policy narrowing.
-- Rationale: job_milestones is job-scoped workflow data, not
-- tenant config (so 00070 approval_chains' owner/admin
-- narrowing does NOT apply). PM visibility mirrors the
-- draws / draw_adjustments "PM read on own jobs" information-
-- parity rule — otherwise PMs excluded from a job could
-- SELECT that job's milestones, an information leak relative
-- to public.draws.
--
-- Write role-set (owner, admin, pm, accounting) matches
-- proposals verbatim — PMs need to mark their assigned jobs'
-- milestones as in_progress/complete; accounting marks them
-- billed when pulling into a draw.
--
-- RUNTIME NOTE (Phase 2.5 discovery preserved for Branch 3/4):
-- PostgreSQL's FK-integrity check respects RLS on referenced
-- tables. A PM INSERTing a job_milestones row whose job_id
-- points to a job the PM cannot see will fail the FK check —
-- stricter than the write policy itself declares, emergent
-- defense-in-depth. Branch 3/4 writers should route cross-job
-- milestone observations through accounting/admin, same
-- pattern as draw_adjustments.
-- ------------------------------------------------------------
--
-- GH #5 RESOLUTION (Amendment E, Option A):
-- jobs has TWO CHECK constraints on retainage_percent with
-- byte-identical predicates:
--   * chk_jobs_retainage_percent    — explicit name, chk_jobs_*
--                                     hygiene convention family
--   * jobs_retainage_percent_check  — auto-named leftover from
--                                     00030's inline ADD COLUMN
--                                     ... CHECK
-- Drop the auto-named duplicate; keep the explicit-name
-- survivor. Predicates are identical so zero row-revalidation
-- risk and zero semantic change. Pre-flight §1.3 confirmed
-- zero code references to either constraint name. Closes GH #5
-- with this migration.
-- ------------------------------------------------------------
--
-- AMENDMENT F (milestone_completions NOT NULL DEFAULT '[]'):
-- Matches status_history / proposals / draw_adjustments JSONB-
-- array precedent — never null. Existing 2 live draws
-- backfill to '[]' on ADD COLUMN.
-- ------------------------------------------------------------
--
-- AMENDMENT G (cross-column invariant at application layer):
-- draw_mode ↔ milestone_completions / tm_* mutual exclusivity
-- is Branch 3/4 draw-writer responsibility, NOT a DB CHECK.
-- A 5-column conditional CHECK is maintenance-hostile and
-- the Branch 3 writer is the single source of truth for draw
-- creation. Documented in COMMENT ON COLUMN draws.draw_mode.
-- ------------------------------------------------------------
--
-- AMENDMENT H (hours-not-money carve-out):
-- draws.tm_labor_hours is NUMERIC, not BIGINT. CLAUDE.md R.8
-- cents rule applies to monetary amounts only. Hours are
-- not money. Documented in COMMENT ON COLUMN.
-- tm_material_cost / tm_sub_cost / tm_markup_amount ARE
-- monetary → BIGINT cents per R.8.
-- ------------------------------------------------------------
--
-- AMENDMENT K (F.2 GRANT-verification N/A):
-- No new SECURITY DEFINER functions in Phase 2.7 scope
-- (unlike 00070 approval_chains which shipped 2 functions +
-- explicit GRANTs). Documented so absence is recognized as
-- intentional, not oversight.
-- ------------------------------------------------------------
--
-- AMENDMENT L (Branch 3/4 writer contracts):
--
--   (a) Milestone soft-delete cascade: when jobs.deleted_at is
--       set via application code, all associated
--       job_milestones rows MUST be soft-deleted in the same
--       transaction. Mirrors the 00069 draw_adjustments
--       invariant. NOT enforced at the DB layer — FK cascades
--       don't fire on UPDATE and the plan mandates soft-delete
--       via deleted_at, never hard DELETE.
--
--   (b) milestone_completions JSONB shape (expected):
--       [{milestone_id: uuid, completed_percent: number (0-100),
--         notes?: text}]
--
--   (c) draw_mode vs. jobs.contract_type relationship: these
--       are STRUCTURALLY INDEPENDENT. A contract_type =
--       'cost_plus_aia' job could in theory issue a draw_mode
--       = 'tm' draw for a specific scope; consistency is
--       application-layer. The contract-type enum already
--       includes 'time_and_materials' as a valid value (see
--       00030) — draw_mode extends T&M awareness to the draw
--       level independently.
-- ------------------------------------------------------------
--
-- ROSS-BUILT-VS-OTHER-ORGS CONTEXT:
-- Ross Built runs AIA G702/G703 cost-plus exclusively.
-- draw_mode='milestone' and draw_mode='tm' are NOT Ross Built
-- patterns today (T&M scope lands as line items on AIA
-- draws). Similarly, Ross Built runs retainage_percent=0
-- (2/15 active jobs) or a flat 10% with no dropoff (13/15) —
-- retainage_threshold_percent and retainage_dropoff_percent
-- are DEAD CODE for Ross Built's current jobs. Phase 2.7
-- ships all five forward-looking fields as v2.0 schema
-- infrastructure for fixed-price builders and remodelers.
-- GH #15 tracks onboarding-wizard override for per-org
-- retainage threshold/dropoff customization. GH #12 tracks
-- the parallel onboarding pattern for approval_chains defaults.
-- ------------------------------------------------------------
--
-- R.16: Paired 00071_milestones_retainage.down.sql reverses
-- in strict reverse-dependency order. Includes a COMMENTED-
-- OUT block with the SQL to re-add jobs_retainage_percent_check
-- if GH #5 rollback is ever desired — undo path documented
-- without executing (Amendment I).
-- ============================================================

-- ------------------------------------------------------------
-- (a) job_milestones — workflow entity (Amendment A: full
-- audit-column set per CLAUDE.md §Architecture Rules).
-- ------------------------------------------------------------
CREATE TABLE public.job_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  job_id UUID NOT NULL REFERENCES public.jobs(id),
  sort_order INT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  amount_cents BIGINT NOT NULL,
  target_date DATE,
  completed_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','in_progress','complete','billed')
  ),
  status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- (b) updated_at trigger — reuse project-wide
-- public.update_updated_at().
-- ------------------------------------------------------------
CREATE TRIGGER trg_job_milestones_updated_at
  BEFORE UPDATE ON public.job_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ------------------------------------------------------------
-- (c) Indexes — Amendment C. All partial on deleted_at IS NULL.
-- ------------------------------------------------------------
CREATE UNIQUE INDEX job_milestones_unique_sort_per_job
  ON public.job_milestones (org_id, job_id, sort_order)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_job_milestones_org_job
  ON public.job_milestones (org_id, job_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_job_milestones_status
  ON public.job_milestones (org_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_job_milestones_target_date
  ON public.job_milestones (org_id, target_date)
  WHERE target_date IS NOT NULL AND deleted_at IS NULL;

-- ------------------------------------------------------------
-- (d) RLS — Amendment B. 00065 proposals 3-policy shape +
-- 00069 draw_adjustments PM-on-own-jobs read narrowing.
-- ------------------------------------------------------------
ALTER TABLE public.job_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_milestones_org_read
  ON public.job_milestones
  FOR SELECT
  USING (
    (
      org_id IN (
        SELECT org_id FROM public.org_members
        WHERE user_id = auth.uid() AND is_active = true
      )
      AND (
        app_private.user_role() IN ('owner','admin','accounting')
        OR (
          app_private.user_role() = 'pm'
          AND EXISTS (
            SELECT 1
            FROM public.jobs j
            WHERE j.id = job_milestones.job_id
              AND j.pm_id = auth.uid()
          )
        )
      )
    )
    OR app_private.is_platform_admin()
  );

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
-- No DELETE policy — RLS blocks hard DELETE; soft-delete via
-- deleted_at (cost_intelligence_spine / proposals /
-- draw_adjustments / approval_chains precedents).

-- ------------------------------------------------------------
-- (e) COMMENTs on job_milestones — Amendment H.
-- ------------------------------------------------------------
COMMENT ON TABLE public.job_milestones IS
'Job-scoped workflow milestones — PMs mark complete, accounting bills against them into draws. 4-value lifecycle: pending → in_progress → complete → billed (terminal). RLS adopts 00065 proposals 3-policy pattern (R.23) + 00069 draw_adjustments PM-on-own-jobs read narrowing. job_milestones is job-scoped workflow data, so PM visibility mirrors the draws / draw_adjustments information-parity rule. Write role-set (owner, admin, pm, accounting) matches proposals precedent verbatim. Tenant-config approval_chains (00070) narrowing does NOT apply. Milestone soft-delete cascade from jobs.deleted_at is application-layer (Branch 3/4 jobs-soft-delete path) since FK cascades don''t fire on UPDATE. Milestone-mode draws are not a Ross Built pattern today (AIA cost-plus exclusively) — this table is forward-looking v2.0 infrastructure for fixed-price builders and remodelers.';

COMMENT ON COLUMN public.job_milestones.sort_order IS
'Unique per (org_id, job_id) via partial index job_milestones_unique_sort_per_job (WHERE deleted_at IS NULL). Soft-deleting a row frees its slot for a replacement.';

-- ------------------------------------------------------------
-- (f) jobs ALTER — Amendment E (GH #5 Option A drop) +
-- Amendment D (new columns with CHECKs).
-- ------------------------------------------------------------

-- Amendment E / GH #5 Option A: drop auto-named duplicate.
-- chk_jobs_retainage_percent (explicit name) survives.
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_retainage_percent_check;

-- Amendment D: two new retainage-policy columns. NUMERIC(5,2)
-- NOT NULL DEFAULT matches existing retainage_percent pattern.
-- Explicit-name CHECKs follow the chk_jobs_* hygiene convention
-- family (chk_jobs_retainage_percent, chk_jobs_deposit_percentage,
-- chk_jobs_gc_fee_percentage).
ALTER TABLE public.jobs
  ADD COLUMN retainage_threshold_percent NUMERIC(5,2) NOT NULL DEFAULT 50.00
    CONSTRAINT chk_jobs_retainage_threshold_percent
    CHECK (retainage_threshold_percent >= 0 AND retainage_threshold_percent <= 100),
  ADD COLUMN retainage_dropoff_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00
    CONSTRAINT chk_jobs_retainage_dropoff_percent
    CHECK (retainage_dropoff_percent >= 0 AND retainage_dropoff_percent <= 100);

COMMENT ON COLUMN public.jobs.retainage_threshold_percent IS
'Percent-complete threshold at which retainage drops from retainage_percent to retainage_dropoff_percent. AIA industry default 50.00 (retainage drops from 10% to 5% at 50% complete). Ross Built runs cost-plus AIA with retainage_percent = 0 or 10% flat — this column is dead code for Ross Built''s current jobs, and becomes live when Ross Built onboards a fixed-price job (contract_type=''fixed_price'') or when other builders use the platform. GH #15 tracks onboarding-wizard override for per-org customization.';

COMMENT ON COLUMN public.jobs.retainage_dropoff_percent IS
'Reduced retainage percent applied once job completion reaches retainage_threshold_percent. AIA industry default 5.00. See COMMENT on retainage_threshold_percent for Ross-Built-vs-other-orgs context and GH #15 onboarding override tracker.';

-- ------------------------------------------------------------
-- (g) draws ALTER — Amendment F (milestone_completions NOT
-- NULL) + new draw_mode + T&M columns (Amendment H).
-- Existing 2 live draws backfill to draw_mode='aia',
-- milestone_completions='[]'.
-- ------------------------------------------------------------
ALTER TABLE public.draws
  ADD COLUMN draw_mode TEXT NOT NULL DEFAULT 'aia'
    CONSTRAINT chk_draws_draw_mode
    CHECK (draw_mode IN ('aia','milestone','tm')),
  ADD COLUMN milestone_completions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN tm_labor_hours NUMERIC,
  ADD COLUMN tm_material_cost BIGINT,
  ADD COLUMN tm_sub_cost BIGINT,
  ADD COLUMN tm_markup_amount BIGINT;

-- ------------------------------------------------------------
-- (h) COMMENTs on draws — Amendment H.
-- ------------------------------------------------------------
COMMENT ON COLUMN public.draws.draw_mode IS
'Presentation/billing mode for this draw: aia (default — AIA G702/G703), milestone (fixed-price / milestone billing), tm (time-and-materials). Cross-column invariant (Amendment G, application-layer — Branch 3/4 draw writer contract): milestone_completions is populated only when draw_mode=''milestone''. tm_labor_hours / tm_material_cost / tm_sub_cost / tm_markup_amount are populated only when draw_mode=''tm''. NOT enforced as a DB CHECK — a 5-column conditional CHECK is maintenance-hostile and the Branch 3 writer is the single source of truth for draw creation. Note: draw_mode is structurally independent from jobs.contract_type — a contract_type=''cost_plus_aia'' job could in theory issue a draw_mode=''tm'' draw for a specific scope, and consistency is application-layer.';

COMMENT ON COLUMN public.draws.milestone_completions IS
'Array of milestone completion records when draw_mode=''milestone''. Expected shape (Branch 3/4 writer contract, Amendment L): [{milestone_id: uuid, completed_percent: number 0-100, notes?: text}]. NOT NULL with DEFAULT ''[]''::jsonb, matching the status_history / proposals / draw_adjustments JSONB-array precedent (never null).';

COMMENT ON COLUMN public.draws.tm_labor_hours IS
'Hours of labor for draw_mode=''tm'' draws. NUMERIC, not BIGINT — hours are not money, so NUMERIC is correct per CLAUDE.md R.8 cents rule (the cents rule applies to monetary amounts only). The T&M monetary columns (tm_material_cost, tm_sub_cost, tm_markup_amount) are BIGINT cents.';
