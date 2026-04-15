-- Phase 2 — Pending invites to an organization.
-- UX: admin/owner fills an email + role; we store a token-bearing invite
-- row. A future sign-up flow reads the token and creates the matching
-- org_members record when the invited user completes registration.

CREATE TABLE public.org_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','pm','accounting')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  UNIQUE (org_id, email)
);

CREATE INDEX idx_org_invites_org_id ON public.org_invites(org_id);
CREATE INDEX idx_org_invites_email ON public.org_invites(email);
CREATE INDEX idx_org_invites_token ON public.org_invites(token);

ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage org_invites"
  ON public.org_invites FOR ALL
  USING (org_id = app_private.user_org_id() AND app_private.user_role() IN ('admin','owner'))
  WITH CHECK (org_id = app_private.user_org_id() AND app_private.user_role() IN ('admin','owner'));
