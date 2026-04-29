-- Down migration for 00088_proposals_fee_payment_schedule.sql
--
-- Drops the 3 JSONB columns added by the up migration. Idempotent
-- via DROP COLUMN IF EXISTS. Production data check before applying:
-- if any proposals.additional_fee_schedule, .payment_schedule, or
-- .payment_terms is non-NULL, dropping discards that data
-- irreversibly. Confirm before running.

ALTER TABLE public.proposals
  DROP COLUMN IF EXISTS additional_fee_schedule;

ALTER TABLE public.proposals
  DROP COLUMN IF EXISTS payment_schedule;

ALTER TABLE public.proposals
  DROP COLUMN IF EXISTS payment_terms;
