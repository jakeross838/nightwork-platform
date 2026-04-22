-- 00064_job_phase_contract_type.sql
-- Phase 2.1 — adds jobs.phase (9 values) and expands jobs.contract_type
-- from the legacy 2-value set (cost_plus, fixed) to the v1.0 target
-- 6-value set.
--
-- Order matters: phase is added first (clean additive), then
-- contract_type follows the drop-CHECK → UPDATE → set default →
-- add-CHECK pattern established by Phase 2.3 (flag-E precedent).
-- Rewriting rows under an in-place CHECK that does not yet permit
-- the new values would fail on the first row — hence the drop/add
-- dance.
--
-- Data migration maps cost_plus → cost_plus_aia (Ross Built's AIA
-- billing convention) and fixed → fixed_price. Pre-flight probe
-- showed 15 live jobs, all 'cost_plus' (zero 'fixed'), so the
-- fixed_price arm is defensive.
--
-- Supporting code changes (API validator, TS types, onboard default)
-- ship in the same commit per Phase 2.1 amended scope. UI display
-- labels deferred to Branch 4 (GH issue #4).

BEGIN;

-- Step 1: Add new phase column (clean additive; no existing data to migrate)
ALTER TABLE public.jobs
  ADD COLUMN phase TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (phase IN (
      'lead',
      'estimating',
      'contracted',
      'pre_construction',
      'in_progress',
      'substantially_complete',
      'closed',
      'warranty',
      'archived'
    ));

-- Step 2: Drop the legacy 2-value CHECK on contract_type so we can
-- rewrite row values. Constraint name confirmed via information_schema
-- at pre-flight: jobs_contract_type_check.
ALTER TABLE public.jobs DROP CONSTRAINT jobs_contract_type_check;

-- Step 3: Migrate legacy data to the new value set
UPDATE public.jobs SET contract_type = 'cost_plus_aia'
  WHERE contract_type = 'cost_plus';
UPDATE public.jobs SET contract_type = 'fixed_price'
  WHERE contract_type = 'fixed';

-- Step 4: Swap the column default from the legacy 'cost_plus' to
-- the new 'cost_plus_aia' so post-migration inserts land on the
-- AIA-billed default (Ross Built's house standard).
ALTER TABLE public.jobs ALTER COLUMN contract_type DROP DEFAULT;
ALTER TABLE public.jobs ALTER COLUMN contract_type SET DEFAULT 'cost_plus_aia';

-- Step 5: Add the new 6-value CHECK over the fully migrated data set
ALTER TABLE public.jobs ADD CONSTRAINT jobs_contract_type_check
  CHECK (contract_type IN (
    'cost_plus_aia',
    'cost_plus_open_book',
    'fixed_price',
    'gmp',
    'time_and_materials',
    'unit_price'
  ));

-- Step 6: Indexes for org-scoped filtering on both new/expanded columns
CREATE INDEX idx_jobs_phase ON public.jobs(org_id, phase);
CREATE INDEX idx_jobs_contract_type ON public.jobs(org_id, contract_type);

COMMIT;
