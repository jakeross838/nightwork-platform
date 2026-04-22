-- 00063_lien_release_waived_at.sql
-- Branch 1 Phase 1.5 — Stamp `waived_at` when a lien release is marked waived.
--
-- Background: lien_releases already has `received_at` stamped when a release
-- flips to status='received' (single PATCH route + bulk mark_received path).
-- There is no parallel timestamp for the waive transition — the only record
-- that a waive happened lives in status_history. That's fine for audit but
-- loses round-number query ability ("show me all releases waived in March")
-- and makes UI summaries inconsistent between received and waived states.
--
-- This migration adds a nullable `waived_at TIMESTAMPTZ` column. The single
-- PATCH route at src/app/api/lien-releases/[id]/route.ts and the bulk
-- endpoint at src/app/api/lien-releases/bulk/route.ts (both updated in the
-- same Phase 1.5 commit) populate it on the pending→waived transition.
--
-- Existing rows with status='waived' will have waived_at = NULL. We do not
-- backfill — there is no audit-quality source (status_history's `at` is
-- close but not guaranteed), and the gate does not require it. Backfill can
-- happen later if ever needed; the column being nullable makes that safe.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.lien_releases
  ADD COLUMN IF NOT EXISTS waived_at TIMESTAMPTZ;

COMMENT ON COLUMN public.lien_releases.waived_at IS
  'Set when status transitions pending→waived via the PATCH or bulk endpoint. NULL for rows never waived or waived before migration 00063 (no backfill).';
