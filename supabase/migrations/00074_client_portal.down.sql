-- ============================================================
-- Phase 2.9 down migration — reverses 00074_client_portal.sql.
--
-- Strict reverse-dependency order:
--   1. DROP 3 RPCs (mark → submit → create) — they own GRANTs
--      and reference both tables.
--   2. DROP all 6 RLS policies (3 per table).
--   3. DISABLE RLS on both tables.
--   4. DROP trg_client_portal_access_updated_at trigger
--      (shared public.update_updated_at() function stays — used
--      by many other tables across the codebase).
--   5. DROP 5 indexes (2 partial unique on access + 3 on messages
--      and access listings).
--   6. DROP table public.client_portal_messages (no FK from access).
--   7. DROP table public.client_portal_access.
-- ============================================================

-- ── RPCs (drop first — own GRANTs) ──────────────────────────────────
DROP FUNCTION IF EXISTS public.mark_client_portal_message_read(TEXT, UUID);
DROP FUNCTION IF EXISTS public.submit_client_portal_message(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_client_portal_invite(
  UUID, UUID, TEXT, TEXT, JSONB, TIMESTAMPTZ
);

-- ── policies (drop before tables) ───────────────────────────────────
DROP POLICY IF EXISTS client_portal_messages_read_at_flip ON public.client_portal_messages;
DROP POLICY IF EXISTS client_portal_messages_org_insert ON public.client_portal_messages;
DROP POLICY IF EXISTS client_portal_messages_org_read ON public.client_portal_messages;

DROP POLICY IF EXISTS client_portal_access_org_update ON public.client_portal_access;
DROP POLICY IF EXISTS client_portal_access_org_insert ON public.client_portal_access;
DROP POLICY IF EXISTS client_portal_access_org_read ON public.client_portal_access;

-- ── disable RLS ─────────────────────────────────────────────────────
ALTER TABLE public.client_portal_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_access DISABLE ROW LEVEL SECURITY;

-- ── trigger (drop before table) ─────────────────────────────────────
DROP TRIGGER IF EXISTS trg_client_portal_access_updated_at
  ON public.client_portal_access;

-- ── indexes (drop before tables) ────────────────────────────────────
DROP INDEX IF EXISTS public.idx_client_portal_messages_unread;
DROP INDEX IF EXISTS public.idx_client_portal_messages_timeline;
DROP INDEX IF EXISTS public.idx_client_portal_access_email;
DROP INDEX IF EXISTS public.idx_client_portal_access_org_job;
DROP INDEX IF EXISTS public.idx_client_portal_access_token_hash;
DROP INDEX IF EXISTS public.client_portal_access_org_job_email_active;

-- ── tables (drop messages first — independent; then access) ─────────
DROP TABLE IF EXISTS public.client_portal_messages;
DROP TABLE IF EXISTS public.client_portal_access;

-- ── Amendment N validator (drop after access table — referenced by CHECK) ─
DROP FUNCTION IF EXISTS public.validate_visibility_config(JSONB);
