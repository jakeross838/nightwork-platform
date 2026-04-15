-- 00031_phase8c_org_default_retainage.sql
-- Phase 8c — Organization default retainage percent.
--
-- Adds:
--   1. organizations.default_retainage_percent (NUMERIC(5,2), default 10)
--   2. Sets Ross Built Custom Homes org default to 0 (the real builder, who
--      doesn't withhold retainage on their cost-plus jobs).
--
-- The per-job retainage_percent (added in 00030) still controls the actual
-- draws. This column is the value that new jobs inherit at creation time.

-- ============================================================
-- 1. ORGANIZATIONS — default_retainage_percent
-- ============================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS default_retainage_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00
    CHECK (default_retainage_percent >= 0 AND default_retainage_percent <= 100);

-- ============================================================
-- 2. Ross Built — set default to 0
-- ============================================================
-- Ross Built runs cost-plus jobs with no retainage. The seeded org uses a
-- well-known UUID so this migration is idempotent in any environment.
UPDATE public.organizations
  SET default_retainage_percent = 0.00
  WHERE id = '00000000-0000-0000-0000-000000000001';

-- Back-fill existing Ross Built jobs to match. This keeps draft draws from
-- silently inheriting the old 10% default. (Submitted/approved/locked draws
-- keep their captured numbers — retainage on those is a snapshot.)
UPDATE public.jobs
  SET retainage_percent = 0.00
  WHERE org_id = '00000000-0000-0000-0000-000000000001'
    AND deleted_at IS NULL;
