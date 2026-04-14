-- 00010_add_contract_date_to_jobs.sql
-- Add contract_date so the jobs UI can track the effective contract date.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS contract_date DATE;
