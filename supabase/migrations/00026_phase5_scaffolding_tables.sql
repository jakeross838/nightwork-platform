-- Phase 5 — Future-feature scaffolding.
--
-- These tables are not wired into the UI yet, but they're added now so we
-- never need to retrofit when we build lien tracking, notifications,
-- activity feeds, or the email intake parser. The change_orders table
-- already exists from the initial schema (migration 00001) so it's not
-- re-declared here.
--
-- Every table follows the house conventions:
--   - id UUID PK
--   - org_id FK → organizations(id), NOT NULL
--   - created_at timestamptz
--   - RLS enabled + RESTRICTIVE org-isolation policy
--   - indexes on org_id and created_at

-- 1. lien_releases -----------------------------------------------------------
-- Tracks conditional/unconditional/partial/final lien waivers per vendor per
-- draw. When drawn, they'll be compiled into the supporting docs packet.
CREATE TABLE public.lien_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  draw_id UUID REFERENCES public.draws(id) ON DELETE SET NULL,
  release_type TEXT NOT NULL CHECK (release_type IN ('conditional','unconditional','partial','final')),
  amount BIGINT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','received','waived')),
  received_at TIMESTAMPTZ,
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lien_releases_org_id ON public.lien_releases (org_id);
CREATE INDEX idx_lien_releases_created_at ON public.lien_releases (created_at DESC);
CREATE INDEX idx_lien_releases_job_id ON public.lien_releases (job_id);
CREATE INDEX idx_lien_releases_draw_id ON public.lien_releases (draw_id);

CREATE TRIGGER trg_lien_releases_updated_at
  BEFORE UPDATE ON public.lien_releases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.lien_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org isolation" ON public.lien_releases
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id())
  WITH CHECK (org_id = app_private.user_org_id());

-- 2. notifications -----------------------------------------------------------
-- In-app notification feed. The AI call wrapper and approval flows will push
-- into this later; for now it's just a table.
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_org_id ON public.notifications (org_id);
CREATE INDEX idx_notifications_created_at ON public.notifications (created_at DESC);
CREATE INDEX idx_notifications_user_id_unread ON public.notifications (user_id) WHERE read = FALSE;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org isolation" ON public.notifications
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id())
  WITH CHECK (org_id = app_private.user_org_id());

-- Users can read their own notifications.
CREATE POLICY "user read own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

-- 3. activity_log ------------------------------------------------------------
-- Audit trail for every mutating action on tenant entities. Once wired, the
-- drill-down views (budget → PO → invoice → status change) will show this
-- as a breadcrumb.
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_log_org_id ON public.activity_log (org_id);
CREATE INDEX idx_activity_log_created_at ON public.activity_log (created_at DESC);
CREATE INDEX idx_activity_log_entity ON public.activity_log (entity_type, entity_id);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org isolation" ON public.activity_log
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id())
  WITH CHECK (org_id = app_private.user_org_id());

-- Any org member can read their org's activity. Writes happen server-side.
CREATE POLICY "members read activity" ON public.activity_log
  FOR SELECT USING (org_id = app_private.user_org_id());

-- 4. email_inbox -------------------------------------------------------------
-- For the upcoming email intake parser. Incoming mail lands here, gets
-- normalized, and attachments flow to the invoice pipeline.
CREATE TABLE public.email_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_address TEXT,
  to_address TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  attachments JSONB,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_inbox_org_id ON public.email_inbox (org_id);
CREATE INDEX idx_email_inbox_created_at ON public.email_inbox (created_at DESC);
CREATE INDEX idx_email_inbox_unprocessed ON public.email_inbox (org_id) WHERE processed = FALSE;

ALTER TABLE public.email_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org isolation" ON public.email_inbox
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id())
  WITH CHECK (org_id = app_private.user_org_id());

-- Admin/owner-only read; the inbox may contain sensitive email bodies.
CREATE POLICY "admin read email_inbox" ON public.email_inbox
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = email_inbox.org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
        AND m.is_active
    )
  );
