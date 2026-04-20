-- Support chat: AI customer support conversations. Two tables so we can
-- track conversation-level state (status, title) separate from per-message
-- data (role, content, tool_calls, tokens). User-scoped by default; platform
-- admins can read everything.
--
-- Design notes:
-- - tool_calls is JSONB so we can capture the full [{ name, input, output }]
--   array the API returned — useful both for transparency (inline chips in
--   the UI) and for the platform-admin inbox debug view.
-- - status='escalated' is a hand-off signal from the AI to human support.
--   It never reverts automatically; staff mark resolved or re-active.
-- - ON DELETE CASCADE on messages so deleting a conversation (rare, admin
--   only) takes its messages with it and we don't leave orphans.

CREATE TABLE IF NOT EXISTS public.support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  title TEXT,
  status TEXT NOT NULL CHECK (status IN
    ('active', 'resolved', 'escalated')) DEFAULT 'active',
  escalated_at TIMESTAMPTZ,
  escalation_reason TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES
    public.support_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tokens_input INT,
  tokens_output INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_conversations_user
  ON public.support_conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_conversations_org
  ON public.support_conversations(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_conversations_status
  ON public.support_conversations(status)
  WHERE status != 'resolved';
CREATE INDEX IF NOT EXISTS idx_support_messages_conversation
  ON public.support_messages(conversation_id, created_at);

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Users own their conversations
CREATE POLICY "support_conversations_user_read"
  ON public.support_conversations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "support_conversations_user_insert"
  ON public.support_conversations FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "support_conversations_user_update"
  ON public.support_conversations FOR UPDATE
  USING (user_id = auth.uid());

-- Messages inherit via conversation ownership
CREATE POLICY "support_messages_user_read"
  ON public.support_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.support_conversations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "support_messages_user_insert"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.support_conversations
      WHERE user_id = auth.uid()
    )
  );

-- Platform admins read everything + update conversations for resolve/notes
CREATE POLICY "support_conversations_platform_admin_read"
  ON public.support_conversations FOR SELECT
  USING (app_private.is_platform_admin());

CREATE POLICY "support_conversations_platform_admin_update"
  ON public.support_conversations FOR UPDATE
  USING (app_private.is_platform_admin());

CREATE POLICY "support_messages_platform_admin_read"
  ON public.support_messages FOR SELECT
  USING (app_private.is_platform_admin());

-- Reuse project-wide updated_at trigger function
CREATE TRIGGER trg_support_conversations_updated_at
  BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
