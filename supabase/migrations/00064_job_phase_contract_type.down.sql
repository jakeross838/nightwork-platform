-- 00064_job_phase_contract_type.down.sql
-- Reverses 00064_job_phase_contract_type.sql.
--
-- Restores the legacy 2-value contract_type CHECK + default and
-- drops the phase column and its index.
--
-- Reverse data mapping:
--   cost_plus_aia  → cost_plus
--   fixed_price    → fixed
-- Any other expanded value (cost_plus_open_book, gmp,
-- time_and_materials, unit_price) has no legacy mapping; rollback
-- will fail loud via the legacy CHECK if such rows exist. That's
-- deliberate — if production data has already adopted the new
-- values, rolling back needs a human decision, not a silent recast.

BEGIN;

-- Step 1: Drop the expanded CHECK so values can be rewritten
ALTER TABLE public.jobs DROP CONSTRAINT jobs_contract_type_check;

-- Step 2: Reverse-map the two values that round-trip cleanly
UPDATE public.jobs SET contract_type = 'cost_plus'
  WHERE contract_type = 'cost_plus_aia';
UPDATE public.jobs SET contract_type = 'fixed'
  WHERE contract_type = 'fixed_price';

-- Step 3: Restore the legacy default
ALTER TABLE public.jobs ALTER COLUMN contract_type DROP DEFAULT;
ALTER TABLE public.jobs ALTER COLUMN contract_type SET DEFAULT 'cost_plus';

-- Step 4: Restore the legacy 2-value CHECK. If any rows hold one of
-- the unmapped expanded values, this ADD CONSTRAINT will error —
-- which is the intended loud-fail signal.
ALTER TABLE public.jobs ADD CONSTRAINT jobs_contract_type_check
  CHECK (contract_type IN ('cost_plus', 'fixed'));

-- Step 5: Drop phase column + its index
DROP INDEX IF EXISTS idx_jobs_phase;
DROP INDEX IF EXISTS idx_jobs_contract_type;
ALTER TABLE public.jobs DROP COLUMN IF EXISTS phase;

COMMIT;
