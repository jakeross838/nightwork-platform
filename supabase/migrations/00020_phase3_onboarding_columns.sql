-- Phase 3 — track onboarding state per organization.
-- New organizations (created via /signup) start with
-- onboarding_complete = FALSE and run through the /onboard wizard.
-- Ross Built, which pre-dates onboarding, is backfilled TRUE.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS builder_type TEXT;

UPDATE public.organizations
SET onboarding_complete = TRUE
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND onboarding_complete = FALSE;
