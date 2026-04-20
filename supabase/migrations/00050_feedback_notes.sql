-- Feedback notes: customer-facing feedback capture for the Ross Built
-- PM testing cohort starting 2026-04-27. Every authenticated page has a
-- floating feedback button that opens a modal; submissions land here.
--
-- Design notes:
-- - user_id + org_id are required so we always know who/where. Insert
--   policy requires user_id = auth.uid() AND org_id matches the
--   submitter's active membership — a user can't file feedback
--   attributed to another org.
-- - Platform admins see/update everything via app_private.is_platform_admin()
--   (added in 00048).
-- - impersonation_admin_id captures the staff user if feedback was filed
--   during an impersonation session — important for separating "PM said
--   this" from "Jake noticed this while impersonating".

CREATE TABLE IF NOT EXISTS public.feedback_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who submitted
  user_id UUID NOT NULL REFERENCES auth.users(id),
  org_id UUID NOT NULL REFERENCES public.organizations(id),

  -- What they said
  category TEXT NOT NULL CHECK (category IN
    ('bug', 'confusion', 'idea', 'other')),
  severity TEXT NOT NULL CHECK (severity IN
    ('low', 'medium', 'high')) DEFAULT 'medium',
  note TEXT NOT NULL CHECK (length(note) <= 2000),

  -- Context (auto-captured)
  page_url TEXT,
  user_role TEXT,
  impersonation_active BOOLEAN DEFAULT FALSE,
  impersonation_admin_id UUID REFERENCES auth.users(id),
  browser TEXT,
  os TEXT,
  theme TEXT,

  -- Admin workflow
  status TEXT NOT NULL CHECK (status IN
    ('new', 'reviewing', 'in_progress', 'resolved', 'wont_fix'))
    DEFAULT 'new',
  admin_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_notes_org_created
  ON public.feedback_notes(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_notes_status
  ON public.feedback_notes(status)
  WHERE status IN ('new', 'reviewing', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_feedback_notes_severity
  ON public.feedback_notes(severity, created_at DESC);

-- RLS
ALTER TABLE public.feedback_notes ENABLE ROW LEVEL SECURITY;

-- Users can insert feedback tied to their own active org membership.
-- The user_id must also match auth.uid() so one user can't post as
-- another.
CREATE POLICY "feedback_notes_user_insert"
  ON public.feedback_notes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Users can see their own feedback (e.g. future "my submissions" view).
CREATE POLICY "feedback_notes_user_read"
  ON public.feedback_notes FOR SELECT
  USING (user_id = auth.uid());

-- Platform admins can read and update all feedback.
CREATE POLICY "feedback_notes_platform_admin_read"
  ON public.feedback_notes FOR SELECT
  USING (app_private.is_platform_admin());

CREATE POLICY "feedback_notes_platform_admin_update"
  ON public.feedback_notes FOR UPDATE
  USING (app_private.is_platform_admin());

-- Reuse the project-wide updated_at trigger function.
CREATE TRIGGER trg_feedback_notes_updated_at
  BEFORE UPDATE ON public.feedback_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
