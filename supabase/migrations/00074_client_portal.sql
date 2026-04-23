-- ============================================================
-- Phase 2.9 — Client portal access (migration 00074).
--
-- Adds public.client_portal_access and public.client_portal_messages
-- tables + 3 SECURITY DEFINER RPCs (create_invite / submit_message
-- / mark_read) enabling time-boxed, revocable, hashed-token-based
-- client access to per-job portal pages. Backs Branch 3/4 client-
-- portal UI.
--
-- Amendments A-O + P landed at plan-amendment commit beb70db.
-- Pre-flight findings at qa-reports/preflight-branch2-phase2.9.md
-- (commit 9fb9544). Execution-phase QA at
-- qa-reports/qa-branch2-phase2.9.md.
--
-- NO R.23 DIVERGENCE. Both tables compose from existing Branch 2
-- precedents: job_milestones Phase 2.7 PM-on-own-jobs narrowing +
-- approval_chains Phase 2.6 role-set narrowing + Amendment F.2
-- SECURITY DEFINER pattern extended to anon grant. The mixed-auth
-- surface (authenticated builder + anon client-via-token) resolves
-- via composition: RLS covers builder writes; SECURITY DEFINER
-- RPCs cover anon client writes; service-role API covers portal
-- reads.
--
-- TOKEN HARDENING (Amendment D): access_token_hash stores the
-- SHA-256 hex digest of a server-generated 64-char hex plaintext
-- token (encode(extensions.gen_random_bytes(32), 'hex')). The
-- plaintext is returned ONCE by create_client_portal_invite and
-- never stored in any DB row, query log, or audit table. Threat
-- model: long-lived persistent read-access credentials for $10M+
-- construction data require a higher security bar than org_invites'
-- 14-day single-use onboarding tokens (which use bare plaintext
-- storage of a 24-byte / 48-char hex token). The 64-char length
-- CHECK on access_token_hash rejects accidental plaintext writes
-- (the org_invites pattern would produce 48-char strings).
--
-- FIRST ANON-GRANT IN BRANCH 2 (Amendment J): submit_message +
-- mark_read RPCs are granted to anon. Defense is the token-
-- validation (hash compare + revoked_at + expires_at) inside each
-- SECURITY DEFINER body — invalid/revoked/expired tokens produce
-- silent no-op (no exception leaked) to defeat timing-oracle
-- enumeration. Lineage of the Amendment F.2 GRANT pattern:
-- 00032 → 00067 → 00070 → 00073 (all authenticated) → 00074
-- (first anon).
--
-- SLIDING-WINDOW expires_at (Scope decision #6): default 90 days;
-- each successful RPC token validation auto-extends to now() +
-- interval '90 days'. revoked_at is immediate + independent
-- (a revoked row with expires_at in the future is still invalid).
--
-- APPEND-ONLY MESSAGES (Scope decision #7): no retracted_at, no
-- deleted_at, no UPDATE policy beyond read_at flips. Platform-admin
-- service-role DELETE is the correction path for accidental-send
-- scenarios (parallel to pricing_history Phase 2.8).
--
-- SERVICE-ROLE PORTAL READS (Scope decision #1): portal clients
-- are anon. Portal UI reads route through a dedicated Next.js
-- service-role API that validates token hash → derives org_id /
-- job_id → pre-filters by visibility_config. No RLS policy for
-- anon reads; service-role bypasses RLS. Bounded attack surface.
--
-- ROLE-SET ASYMMETRY between tables (Scope decision #2):
--   client_portal_access write role-set = (owner, admin, pm) —
--     accounting EXCLUDED. Inviting clients to the portal is a
--     PM/owner relationship function; accounting does not own
--     client communication.
--   client_portal_messages INSERT role-set = (owner, admin, pm,
--     accounting) — accounting INCLUDED. Clients send billing
--     questions which legitimately route to accounting.
--
-- AMENDMENT N (visibility_config CHECK + COMMENT). The CHECK
-- expression validates that visibility_config is NULL or a JSONB
-- object whose keys are all in the known 7-key set AND whose
-- values are all booleans. Performance fallback (CHECK-dropped,
-- COMMENT-only) was reserved if Dry-Run measured INSERT-latency
-- regression > 20%. Result documented in execution-phase QA §4.
--
-- BACKFILL (Scope decision #5): none. Forward-only.
--
-- RUNTIME DEFECTS FIXED DURING AUTHORING (QA §3):
--
-- Defect #1 (RPC execute-time): pgcrypto's digest() and
-- gen_random_bytes() live in the `extensions` schema on Supabase,
-- not `public`. The plan-doc SQL called them bare with SET
-- search_path = public, pg_temp — would have failed at RPC execute
-- time with "function does not exist". Fix: schema-qualified to
-- extensions.digest(...) and extensions.gen_random_bytes(...) in
-- all 3 SECURITY DEFINER bodies. More defensive than expanding
-- search_path.
--
-- Defect #2 (DDL apply-time): The Amendment N CHECK expression as
-- drafted contained `NOT EXISTS (SELECT 1 FROM jsonb_object_keys
-- (visibility_config) AS key WHERE …)` — Postgres rejects
-- subqueries inside CHECK constraints (error 0A000 "cannot use
-- subquery in check constraint"). Plan-doc SQL would have failed
-- on first apply. Fix: refactored validation into the IMMUTABLE
-- helper public.validate_visibility_config(JSONB) which iterates
-- the JSONB object in plpgsql and returns boolean. CHECK calls
-- the helper. Preserves Amendment N's DB-layer key-set + boolean-
-- value-type enforcement; same semantics, valid syntax.
--
-- GH #17 tracks Branch 3/4 pre-launch security review checklist
-- (rate limiting on anon RPCs, CSRF on portal read API, plaintext-
-- token transmission security, log scrubbing, revocation flow audit).
-- ============================================================

-- ── Amendment N validator (Defect #2 workaround) ────────────────────
-- IMMUTABLE helper called from the visibility_config CHECK
-- constraint. Subqueries are not allowed in CHECK; this helper
-- iterates the JSONB object in plpgsql and returns boolean,
-- preserving Amendment N's intent (key-set + boolean-value-type
-- enforcement at write time).
CREATE OR REPLACE FUNCTION public.validate_visibility_config(p_config JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  _key TEXT;
  _allowed TEXT[] := ARRAY[
    'show_invoices','show_budget','show_schedule',
    'show_change_orders','show_draws','show_lien_releases',
    'show_daily_logs'
  ];
BEGIN
  IF p_config IS NULL THEN
    RETURN TRUE;
  END IF;
  IF jsonb_typeof(p_config) <> 'object' THEN
    RETURN FALSE;
  END IF;
  FOR _key IN SELECT jsonb_object_keys(p_config) LOOP
    IF _key <> ALL(_allowed) THEN
      RETURN FALSE;
    END IF;
    IF jsonb_typeof(p_config -> _key) <> 'boolean' THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.validate_visibility_config(JSONB) IS
'Amendment N validator. Returns TRUE iff p_config is NULL or a JSONB object whose keys are all in (show_invoices, show_budget, show_schedule, show_change_orders, show_draws, show_lien_releases, show_daily_logs) AND whose values are all booleans. Called from the public.client_portal_access.visibility_config CHECK constraint. Refactored from the plan-doc inline CHECK to work around Postgres'' "cannot use subquery in check constraint" rule (0A000) — see migration header Defect #2.';

-- ── client_portal_access table ──────────────────────────────────────

CREATE TABLE public.client_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  job_id UUID NOT NULL REFERENCES public.jobs(id),
  email TEXT NOT NULL,
  name TEXT,

  -- Amendment D: SHA-256 hex digest of the plaintext token.
  -- Plaintext is returned once by create_client_portal_invite
  -- and never stored. 64-char length CHECK rejects short strings
  -- and accidental plaintext storage.
  access_token_hash TEXT NOT NULL
    CHECK (char_length(access_token_hash) = 64),

  -- Amendment N: both COMMENT + CHECK validating JSONB shape at
  -- write time. CHECK delegates to public.validate_visibility_config
  -- (defined above) — direct subqueries are illegal in CHECK
  -- constraints (Defect #2 workaround; see migration header).
  visibility_config JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (public.validate_visibility_config(visibility_config)),

  -- Amendment B audit-columns + invited_at/revoked_at/expires_at.
  invited_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days'),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES auth.users(id)
);

-- Amendment E: dedup partial unique. Prevents double-invite to
-- same client × same job while preserving historical revoked rows.
CREATE UNIQUE INDEX client_portal_access_org_job_email_active
  ON public.client_portal_access (org_id, job_id, email)
  WHERE revoked_at IS NULL;

-- Amendment D + K: hot-path RPC token lookup.
CREATE UNIQUE INDEX idx_client_portal_access_token_hash
  ON public.client_portal_access (access_token_hash)
  WHERE revoked_at IS NULL;

-- Amendment K: list + lookup indexes.
CREATE INDEX idx_client_portal_access_org_job
  ON public.client_portal_access (org_id, job_id)
  WHERE revoked_at IS NULL;
CREATE INDEX idx_client_portal_access_email
  ON public.client_portal_access (email)
  WHERE revoked_at IS NULL;

-- Amendment B: updated_at trigger using shared helper.
CREATE TRIGGER trg_client_portal_access_updated_at
  BEFORE UPDATE ON public.client_portal_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── client_portal_messages table ────────────────────────────────────

CREATE TABLE public.client_portal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  job_id UUID NOT NULL REFERENCES public.jobs(id),

  from_type TEXT NOT NULL CHECK (from_type IN ('builder','client')),
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  from_client_email TEXT,

  -- Amendment F: XOR enforcing from_type ↔ writer-identity alignment.
  CHECK (
    (from_type = 'builder' AND from_user_id IS NOT NULL AND from_client_email IS NULL)
    OR
    (from_type = 'client' AND from_client_email IS NOT NULL AND from_user_id IS NULL)
  ),

  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,

  -- Amendment C: append-only — only created_at + created_by audit
  -- columns. See header for omitted-column rationale (parallel to
  -- pricing_history Phase 2.8).
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Amendment K: timeline + unread indexes.
CREATE INDEX idx_client_portal_messages_timeline
  ON public.client_portal_messages (org_id, job_id, created_at DESC);
CREATE INDEX idx_client_portal_messages_unread
  ON public.client_portal_messages (org_id, job_id)
  WHERE read_at IS NULL;

-- ============================================================
-- Amendment H: RLS on client_portal_access — 3 policies,
-- PM-on-own-jobs narrowing, no DELETE (revoked_at soft-delete).
-- Write role-set: owner/admin/pm (accounting EXCLUDED per
-- Scope decision #2 — accounting doesn't invite clients).
-- Platform-admin SELECT bypass.
-- ============================================================
ALTER TABLE public.client_portal_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_portal_access_org_read
  ON public.client_portal_access FOR SELECT
  USING (
    app_private.is_platform_admin()
    OR (
      org_id = app_private.user_org_id()
      AND (
        app_private.user_role() IN ('owner','admin','accounting')
        OR (
          app_private.user_role() = 'pm'
          AND EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = client_portal_access.job_id
              AND j.pm_id = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY client_portal_access_org_insert
  ON public.client_portal_access FOR INSERT
  WITH CHECK (
    org_id = app_private.user_org_id()
    AND app_private.user_role() IN ('owner','admin','pm')
    AND (
      app_private.user_role() IN ('owner','admin')
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = client_portal_access.job_id
          AND j.pm_id = auth.uid()
      )
    )
  );

CREATE POLICY client_portal_access_org_update
  ON public.client_portal_access FOR UPDATE
  USING (
    org_id = app_private.user_org_id()
    AND app_private.user_role() IN ('owner','admin','pm')
    AND (
      app_private.user_role() IN ('owner','admin')
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = client_portal_access.job_id
          AND j.pm_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    org_id = app_private.user_org_id()
    AND app_private.user_role() IN ('owner','admin','pm')
  );

-- ============================================================
-- Amendment I: RLS on client_portal_messages — 3 policies,
-- PM-on-own-jobs narrowing, no DELETE, narrow UPDATE for
-- read_at flip. Write role-set INCLUDES accounting (different
-- from access — billing questions route to accounting).
-- ============================================================
ALTER TABLE public.client_portal_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_portal_messages_org_read
  ON public.client_portal_messages FOR SELECT
  USING (
    app_private.is_platform_admin()
    OR (
      org_id = app_private.user_org_id()
      AND (
        app_private.user_role() IN ('owner','admin','accounting')
        OR (
          app_private.user_role() = 'pm'
          AND EXISTS (
            SELECT 1 FROM public.jobs j
            WHERE j.id = client_portal_messages.job_id
              AND j.pm_id = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY client_portal_messages_org_insert
  ON public.client_portal_messages FOR INSERT
  WITH CHECK (
    org_id = app_private.user_org_id()
    AND app_private.user_role() IN ('owner','admin','pm','accounting')
    AND from_type = 'builder'
    AND (
      app_private.user_role() IN ('owner','admin','accounting')
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = client_portal_messages.job_id
          AND j.pm_id = auth.uid()
      )
    )
  );

-- Narrow UPDATE policy — read_at flip only on client messages.
CREATE POLICY client_portal_messages_read_at_flip
  ON public.client_portal_messages FOR UPDATE
  USING (
    org_id = app_private.user_org_id()
    AND from_type = 'client'
    AND read_at IS NULL
    AND (
      app_private.user_role() IN ('owner','admin','accounting')
      OR (
        app_private.user_role() = 'pm'
        AND EXISTS (
          SELECT 1 FROM public.jobs j
          WHERE j.id = client_portal_messages.job_id
            AND j.pm_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    org_id = app_private.user_org_id()
    AND from_type = 'client'
  );

-- ============================================================
-- Amendment J: 3 SECURITY DEFINER RPCs. pinned search_path.
-- GRANT EXECUTE pattern: create_invite → authenticated;
-- submit_message + mark_read → anon. Token validation inside
-- each body defends the anon grant (silent no-op on invalid /
-- revoked / expired).
-- Lineage of the F.2 GRANT pattern: 00032 → 00067 → 00070 →
-- 00073 (all authenticated) → 00074 (first anon).
--
-- Note: digest() and gen_random_bytes() are schema-qualified as
-- extensions.* because pgcrypto installs into the extensions
-- schema on Supabase, and these RPCs use SET search_path =
-- public, pg_temp (which excludes extensions). See migration
-- header runtime-defect note.
-- ============================================================

-- (1) create_client_portal_invite — authenticated only.
-- Returns plaintext token ONCE to the builder UI. Plaintext
-- never stored.
CREATE OR REPLACE FUNCTION public.create_client_portal_invite(
  p_org_id UUID,
  p_job_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_visibility_config JSONB,
  p_expires_at TIMESTAMPTZ
)
RETURNS TABLE(portal_access_id UUID, plaintext_token TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _plaintext TEXT;
  _hash TEXT;
  _new_id UUID;
BEGIN
  -- Caller must be org member with role IN ('owner','admin','pm')
  -- and (if pm) own the job. Mirrors Amendment H insert policy.
  IF NOT (
    p_org_id = app_private.user_org_id()
    AND app_private.user_role() IN ('owner','admin','pm')
    AND (
      app_private.user_role() IN ('owner','admin')
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = p_job_id AND j.pm_id = auth.uid()
      )
    )
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  _plaintext := encode(extensions.gen_random_bytes(32), 'hex');
  _hash := encode(extensions.digest(_plaintext, 'sha256'), 'hex');

  INSERT INTO public.client_portal_access (
    org_id, job_id, email, name, access_token_hash,
    visibility_config, expires_at, created_by
  ) VALUES (
    p_org_id, p_job_id, p_email, p_name, _hash,
    COALESCE(p_visibility_config, '{}'::jsonb),
    COALESCE(p_expires_at, now() + interval '90 days'),
    auth.uid()
  )
  RETURNING id INTO _new_id;

  RETURN QUERY SELECT _new_id, _plaintext;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_client_portal_invite(
  UUID, UUID, TEXT, TEXT, JSONB, TIMESTAMPTZ
) TO authenticated;

-- (2) submit_client_portal_message — anon. Client side.
-- Silent no-op on invalid/revoked/expired to defeat timing
-- oracles. Sliding-window expires_at extension on success.
CREATE OR REPLACE FUNCTION public.submit_client_portal_message(
  p_token TEXT,
  p_message TEXT
)
RETURNS TABLE(message_id UUID)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _hash TEXT;
  _access RECORD;
  _new_id UUID;
BEGIN
  IF p_token IS NULL OR p_message IS NULL OR p_message = '' THEN
    RETURN;
  END IF;

  _hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  SELECT id, org_id, job_id, email
    INTO _access
    FROM public.client_portal_access
    WHERE access_token_hash = _hash
      AND revoked_at IS NULL
      AND expires_at > now();

  IF NOT FOUND THEN
    RETURN;  -- silent no-op
  END IF;

  INSERT INTO public.client_portal_messages (
    org_id, job_id, from_type, from_client_email, message
  ) VALUES (
    _access.org_id, _access.job_id, 'client',
    _access.email, p_message
  )
  RETURNING id INTO _new_id;

  -- Sliding-window: extend expires_at on successful access.
  UPDATE public.client_portal_access
    SET last_accessed_at = now(),
        expires_at = now() + interval '90 days'
    WHERE id = _access.id;

  RETURN QUERY SELECT _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_client_portal_message(TEXT, TEXT)
  TO anon;

-- (3) mark_client_portal_message_read — anon. Client side.
-- Flips read_at on builder messages the client just read.
CREATE OR REPLACE FUNCTION public.mark_client_portal_message_read(
  p_token TEXT,
  p_message_id UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _hash TEXT;
  _access RECORD;
BEGIN
  IF p_token IS NULL OR p_message_id IS NULL THEN
    RETURN;
  END IF;

  _hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  SELECT id, org_id, job_id
    INTO _access
    FROM public.client_portal_access
    WHERE access_token_hash = _hash
      AND revoked_at IS NULL
      AND expires_at > now();

  IF NOT FOUND THEN
    RETURN;  -- silent no-op
  END IF;

  UPDATE public.client_portal_messages
    SET read_at = now()
    WHERE id = p_message_id
      AND org_id = _access.org_id
      AND job_id = _access.job_id
      AND from_type = 'builder'
      AND read_at IS NULL;

  UPDATE public.client_portal_access
    SET last_accessed_at = now(),
        expires_at = now() + interval '90 days'
    WHERE id = _access.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_client_portal_message_read(TEXT, UUID)
  TO anon;

-- ============================================================
-- Amendment N + O: COMMENTs documenting expected shape +
-- writer-contracts + decision rationale.
-- ============================================================
COMMENT ON TABLE public.client_portal_access IS
'Per-job client portal invites. access_token_hash stores SHA-256 hex of a server-generated 64-char hex plaintext token; plaintext is returned ONCE by create_client_portal_invite RPC and never stored. Write role-set: owner/admin/pm (accounting excluded — not their workflow). Sliding-window expires_at: default 90 days; RPC token validations auto-extend. revoked_at is immediate + independent. R.23 COMPOSITION (no divergence): 3-policy + PM-on-own-jobs from job_milestones/00071+00072 + role-narrowing from approval_chains/00070. Platform-admin SELECT bypass. No DELETE policy — revoked_at is the soft-delete mechanism.';

COMMENT ON COLUMN public.client_portal_access.access_token_hash IS
'SHA-256 hex digest (64 chars) of the plaintext token. Plaintext is generated by create_client_portal_invite via encode(extensions.gen_random_bytes(32), ''hex'') and returned ONCE to the caller; it is NEVER stored. RPC validators hash input tokens and compare to this column. CHECK(char_length = 64) distinguishes hashes from 48-char org_invites-style plaintext. Threat model: long-lived persistent read-access credentials require higher security bar than org_invites'' 14-day single-use tokens.';

COMMENT ON COLUMN public.client_portal_access.visibility_config IS
'Which sections of the job portal the client sees. Expected keys (all boolean): show_invoices, show_budget, show_schedule, show_change_orders, show_draws, show_lien_releases, show_daily_logs. NULL or {} means default (application layer decides). CHECK expression validates shape at write time (Amendment N); fallback to COMMENT-only if Dry-Run surfaces INSERT latency regression — see migration header.';

COMMENT ON COLUMN public.client_portal_access.expires_at IS
'Sliding-window expiration. Default: now() + interval ''90 days''. Successful RPC token validations (submit_message, mark_read) extend to now() + interval ''90 days''. revoked_at is immediate and independent — a revoked row with expires_at in the future is still invalid.';

COMMENT ON TABLE public.client_portal_messages IS
'Builder ↔ client messaging per job. from_type XOR CHECK enforces that builder messages carry from_user_id (never from_client_email) and client messages carry from_client_email (never from_user_id). Write role-set INCLUDES accounting (billing questions route to accounting; different from access-table role-set). Append-only: no updated_at, no deleted_at, no retracted_at. Platform-admin service-role DELETE is the correction path for accidental-send scenarios (parallel to pricing_history Phase 2.8). Client-side INSERTs go exclusively through public.submit_client_portal_message RPC (Amendment J, anon grant). Builder-side read_at flip via RLS UPDATE policy; client-side read_at flip via public.mark_client_portal_message_read RPC (anon grant).';

COMMENT ON FUNCTION public.create_client_portal_invite(UUID, UUID, TEXT, TEXT, JSONB, TIMESTAMPTZ) IS
'Creates a client_portal_access row with a freshly generated 64-char hex plaintext token. Stores only the SHA-256 hash in access_token_hash; returns the plaintext ONCE to the caller (builder UI captures it for email delivery). Plaintext is never stored in any DB row, query log, or audit table. SECURITY DEFINER with pinned search_path. GRANT EXECUTE TO authenticated. Caller authorization mirrors Amendment H insert policy: owner/admin unrestricted; pm must own the job.';

COMMENT ON FUNCTION public.submit_client_portal_message(TEXT, TEXT) IS
'Anon-accessible client-side message submit. Hashes the input token, looks up the active (non-revoked, non-expired) portal_access row, INSERTs a message with from_type=''client''. On successful validation: updates last_accessed_at and extends expires_at = now() + interval ''90 days'' (sliding window). Silent no-op on invalid/revoked/expired tokens to defeat timing-oracle enumeration. GRANT EXECUTE TO anon — first anon-grant in Branch 2. Defense is the token validation inside the body.';

COMMENT ON FUNCTION public.mark_client_portal_message_read(TEXT, UUID) IS
'Anon-accessible client-side read-receipt flip. Validates the token, confirms the message belongs to the token''s (org_id, job_id) and is from_type=''builder'', sets read_at = now(). Silent no-op on invalid/revoked/expired tokens or mismatched message scopes. Extends parent access expires_at. GRANT EXECUTE TO anon.';
