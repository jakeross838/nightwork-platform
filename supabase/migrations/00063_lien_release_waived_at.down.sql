-- 00063_lien_release_waived_at.down.sql
-- Rollback for 00063_lien_release_waived_at.sql.
--
-- IMPORTANT: dropping the column destroys every `waived_at` timestamp already
-- stamped by the write-path patches. Only roll back if the Phase 1.5 code
-- changes (in src/app/api/lien-releases/[id]/route.ts and
-- src/app/api/lien-releases/bulk/route.ts) are being reverted in the same
-- session — otherwise the application will try to write a column that no
-- longer exists.

ALTER TABLE public.lien_releases
  DROP COLUMN IF EXISTS waived_at;
