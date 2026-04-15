-- 00033_phase8f_draw_wizard_lien_uploads.sql
-- Phase 8f — Draw wizard auto-save, draw cover letter, and lien-release file uploads.
--
-- Adds (idempotent):
--   1. org_workflow_settings.cover_letter_template (TEXT, nullable)
--      — org-level template body. NULL = use built-in default.
--   2. draws.cover_letter_text (TEXT, nullable)
--      — per-draw editable letter body. NULL until generated.
--   3. draws.wizard_draft (JSONB, nullable)
--      — wizard auto-save state. Cleared when draw is finalized (status moves
--      out of draft).
--   4. lien-release-files storage bucket + RLS policies scoped to org_id.

-- ============================================================
-- 1. cover_letter_template on org_workflow_settings
-- ============================================================
ALTER TABLE public.org_workflow_settings
  ADD COLUMN IF NOT EXISTS cover_letter_template TEXT;

COMMENT ON COLUMN public.org_workflow_settings.cover_letter_template IS
  'Org-level draw cover letter template. Supports {{job_name}}, {{job_address}}, '
  '{{owner_name}}, {{draw_number}}, {{period_start}}, {{period_end}}, '
  '{{current_payment_due}}, {{contract_sum_to_date}}, {{total_completed}}, '
  '{{percent_complete}}, {{retainage}} placeholders. NULL = use built-in default.';

-- ============================================================
-- 2. draws.cover_letter_text + draws.wizard_draft
-- ============================================================
ALTER TABLE public.draws
  ADD COLUMN IF NOT EXISTS cover_letter_text TEXT,
  ADD COLUMN IF NOT EXISTS wizard_draft JSONB;

COMMENT ON COLUMN public.draws.cover_letter_text IS
  'Editable cover letter body for this draw. NULL until generated.';

COMMENT ON COLUMN public.draws.wizard_draft IS
  'Wizard auto-save state for in-progress draws. Cleared when status leaves draft.';

-- ============================================================
-- 3. lien-release-files storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('lien-release-files', 'lien-release-files', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Public read so the URL on lien_releases.document_url loads in <a> / <img>
-- without signing. Writes are scoped to the user's own org folder.
DROP POLICY IF EXISTS "lien-release-files read" ON storage.objects;
CREATE POLICY "lien-release-files read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lien-release-files');

DROP POLICY IF EXISTS "lien-release-files insert" ON storage.objects;
CREATE POLICY "lien-release-files insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'lien-release-files'
    AND (storage.foldername(name))[1] = app_private.user_org_id()::text
  );

DROP POLICY IF EXISTS "lien-release-files update" ON storage.objects;
CREATE POLICY "lien-release-files update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'lien-release-files'
    AND (storage.foldername(name))[1] = app_private.user_org_id()::text
  );

DROP POLICY IF EXISTS "lien-release-files delete" ON storage.objects;
CREATE POLICY "lien-release-files delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'lien-release-files'
    AND (storage.foldername(name))[1] = app_private.user_org_id()::text
  );

-- ============================================================
-- 4. lien_releases — fix missing PERMISSIVE policy
--
-- The Phase 5 scaffolding for lien_releases only added a RESTRICTIVE
-- org-isolation policy. In Postgres, RESTRICTIVE policies layer ON TOP of
-- PERMISSIVE ones, so without any PERMISSIVE policy authenticated reads
-- silently return 0 rows. Add the same PERMISSIVE pattern used elsewhere.
-- ============================================================
DROP POLICY IF EXISTS "authenticated read lien_releases" ON public.lien_releases;
CREATE POLICY "authenticated read lien_releases" ON public.lien_releases
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "authenticated write lien_releases" ON public.lien_releases;
CREATE POLICY "authenticated write lien_releases" ON public.lien_releases
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
