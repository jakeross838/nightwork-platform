-- Down migration for 00090_proposals_job_address.sql
--
-- Drops the job_address column. Production data check before
-- applying: any non-NULL job_address values are discarded
-- irreversibly.

ALTER TABLE public.proposals
  DROP COLUMN IF EXISTS job_address;
