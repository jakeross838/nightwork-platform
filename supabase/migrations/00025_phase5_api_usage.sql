-- Phase 5 — API usage tracking.
--
-- Every Claude API call is logged here by the server-side wrapper in
-- /lib/claude.ts. Inserts happen via the service-role client to bypass RLS;
-- the only client-facing path is SELECT, gated by the usual org-isolation
-- + admin/owner role checks. We keep this in its own migration to make the
-- history clean: Phase 4 was billing plumbing, Phase 5 is metering.

CREATE TABLE public.api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Nullable because some calls may be system-triggered (e.g. future cron
  -- jobs that re-run parsing on stuck invoices, scheduled email intake).
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Free-text category rather than CHECK constraint because we'll add more
  -- function types as features land (draw_generation, cost_code_match,
  -- document_extract, email_parse, etc.) without needing a migration each time.
  function_type TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER GENERATED ALWAYS AS (
    COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)
  ) STORED,
  -- Stored in cents to avoid floating-point drift on aggregate queries. The
  -- wrapper computes this from Anthropic's per-MTok pricing.
  estimated_cost_cents INTEGER,
  duration_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
  error_message TEXT,
  -- Bag for contextual ids (invoice_id, job_id, confidence_score, etc.) that
  -- future dashboards can pivot on without needing schema changes.
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary read pattern is "rows for my org, newest first". Secondary patterns
-- include "current-month count" (by org, date range) and "by function type".
CREATE INDEX idx_api_usage_org_id ON public.api_usage (org_id);
CREATE INDEX idx_api_usage_created_at ON public.api_usage (created_at DESC);
CREATE INDEX idx_api_usage_function_type ON public.api_usage (function_type);
CREATE INDEX idx_api_usage_org_created_at ON public.api_usage (org_id, created_at DESC);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- Defense-in-depth org isolation (matches the pattern on other tenant tables).
CREATE POLICY "org isolation" ON public.api_usage
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id())
  WITH CHECK (org_id = app_private.user_org_id());

-- Only admins/owners can read their org's usage data from the client. PMs and
-- accounting don't need to see raw AI logs — they'll see plan limits via the
-- API wrapper's error responses instead.
CREATE POLICY "admin read api_usage" ON public.api_usage
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = api_usage.org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
        AND m.is_active
    )
  );

-- Production inserts come from the service-role client (see /lib/claude.ts).
-- As a fallback for local-dev environments that haven't configured
-- SUPABASE_SERVICE_ROLE_KEY, this policy lets the authenticated SSR client
-- write rows for its own org — the wrapper's code path is "try service role,
-- fall back to request-context client". Cross-org writes are still blocked
-- by the RESTRICTIVE "org isolation" policy above.
CREATE POLICY "members insert api_usage" ON public.api_usage
  FOR INSERT
  WITH CHECK (org_id = app_private.user_org_id());
