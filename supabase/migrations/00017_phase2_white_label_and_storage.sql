-- Phase 2 — White-Label, Settings, Org-Scoped Storage
--
-- 1. Backfill Ross Built's branding/company fields so the white-label
--    experience loads with real values the moment we swap the hardcodes.
-- 2. Create the `logos` storage bucket + RLS so orgs can upload their own
--    logo (path: logos/{org_id}/...).
-- 3. Create RLS on the existing `invoice-files` bucket restricting reads
--    and writes to paths under the user's own org_id (with a legacy escape
--    hatch for pre-migration `uploads/...` files).

-- 1. Ross Built seed backfill ----------------------------------------------
-- Only fill the zip (part of the known address) and a sensible accent color.
-- Phone / email / website are left blank for Jake to set via the settings UI.
UPDATE public.organizations
SET
  company_zip = COALESCE(company_zip, '34209'),
  accent_color = COALESCE(accent_color, '#B8860B')
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 2. logos bucket ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Logo storage policies: public read, admin/owner write scoped to own org.
DROP POLICY IF EXISTS "logos public read" ON storage.objects;
CREATE POLICY "logos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos admin upload" ON storage.objects;
CREATE POLICY "logos admin upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = app_private.user_org_id()::text
    AND app_private.user_role() IN ('admin','owner')
  );

DROP POLICY IF EXISTS "logos admin update" ON storage.objects;
CREATE POLICY "logos admin update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = app_private.user_org_id()::text
    AND app_private.user_role() IN ('admin','owner')
  );

DROP POLICY IF EXISTS "logos admin delete" ON storage.objects;
CREATE POLICY "logos admin delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = app_private.user_org_id()::text
    AND app_private.user_role() IN ('admin','owner')
  );

-- 3. invoice-files org-scoped policies --------------------------------------
-- Legacy files live at `uploads/...` (no org folder). New files live at
-- `{org_id}/uploads/...`. Allow legacy reads for everyone in the single
-- tenant (safe today — only Ross Built exists) until the migration script
-- finishes, then a follow-up migration will tighten this.
DROP POLICY IF EXISTS "invoice-files read" ON storage.objects;
CREATE POLICY "invoice-files read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'invoice-files'
    AND (
      (storage.foldername(name))[1] = app_private.user_org_id()::text
      OR (storage.foldername(name))[1] = 'uploads'
    )
  );

DROP POLICY IF EXISTS "invoice-files insert" ON storage.objects;
CREATE POLICY "invoice-files insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'invoice-files'
    AND (storage.foldername(name))[1] = app_private.user_org_id()::text
  );

DROP POLICY IF EXISTS "invoice-files update" ON storage.objects;
CREATE POLICY "invoice-files update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'invoice-files'
    AND (
      (storage.foldername(name))[1] = app_private.user_org_id()::text
      OR (storage.foldername(name))[1] = 'uploads'
    )
  );

DROP POLICY IF EXISTS "invoice-files delete" ON storage.objects;
CREATE POLICY "invoice-files delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'invoice-files'
    AND (
      (storage.foldername(name))[1] = app_private.user_org_id()::text
      OR (storage.foldername(name))[1] = 'uploads'
    )
  );
