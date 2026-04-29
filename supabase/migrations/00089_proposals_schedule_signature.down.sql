-- Down migration for 00089_proposals_schedule_signature.sql
--
-- Drops the 4 columns added by the up migration. Production data
-- check before applying: if any proposal has a non-NULL
-- schedule_items / accepted_signature_*, dropping discards data
-- irreversibly. Confirm before running.

ALTER TABLE public.proposals
  DROP COLUMN IF EXISTS schedule_items;

ALTER TABLE public.proposals
  DROP COLUMN IF EXISTS accepted_signature_name;

ALTER TABLE public.proposals
  DROP COLUMN IF EXISTS accepted_signature_date;

ALTER TABLE public.proposals
  DROP COLUMN IF EXISTS accepted_signature_present;
