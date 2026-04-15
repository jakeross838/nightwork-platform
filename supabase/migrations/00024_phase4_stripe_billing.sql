-- Phase 4 — Stripe billing.
--
-- Most billing columns on organizations already exist from Phase 1
-- (stripe_customer_id, stripe_subscription_id, subscription_plan,
-- subscription_status, trial_ends_at). This migration:
--   1. Defaults trial_ends_at to 14 days out and subscription_status to
--      'trialing' so new signups start in an explicit trial.
--   2. Creates a subscriptions table that mirrors Stripe's subscription
--      lifecycle (one row per live Stripe subscription, per org).
--   3. Backfills Ross Built (org 0000…0001) to 'active' so the existing
--      tenant isn't suddenly in a trial.
--
-- Throughout this codebase the existing column `subscription_plan` serves
-- the role of the spec's "plan_slug" — we reuse it rather than introducing
-- a parallel column that would need to be kept in sync.

-- 1. Column default tweaks ---------------------------------------------------
ALTER TABLE public.organizations
  ALTER COLUMN subscription_status SET DEFAULT 'trialing';

ALTER TABLE public.organizations
  ALTER COLUMN trial_ends_at SET DEFAULT (NOW() + INTERVAL '14 days');

-- Backfill: any existing org with a NULL trial_ends_at (e.g. created before
-- the default landed) gets 14 days from now so the trial-expired guard has
-- something to compare against. Ross Built is 'active' and already seeded.
UPDATE public.organizations
SET trial_ends_at = NOW() + INTERVAL '14 days'
WHERE trial_ends_at IS NULL
  AND subscription_status = 'trialing';

-- 2. Update create_signup so new orgs start on an explicit trial -----------
CREATE OR REPLACE FUNCTION public.create_signup(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_company_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_email TEXT := LOWER(p_email);
  v_user_id UUID := gen_random_uuid();
  v_org_id UUID;
  v_slug TEXT;
  v_suffix INT := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = v_email) THEN
    RAISE EXCEPTION 'An account with that email already exists.'
      USING ERRCODE = 'unique_violation';
  END IF;

  v_slug := regexp_replace(lower(p_company_name), '[^a-z0-9]+', '-', 'g');
  v_slug := regexp_replace(v_slug, '^-+|-+$', '', 'g');
  IF v_slug = '' THEN v_slug := 'org'; END IF;
  v_slug := substr(v_slug, 1, 40);
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug := substr(regexp_replace(lower(p_company_name), '[^a-z0-9]+', '-', 'g'), 1, 35) || '-' || v_suffix::text;
  END LOOP;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous,
    created_at, updated_at
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    NOW(),
    '', '', '', '',
    jsonb_build_object('full_name', p_full_name, 'email', v_email, 'email_verified', true),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    false, false,
    NOW(), NOW()
  );

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id::text,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email',
    NOW(), NOW(), NOW()
  );

  -- onboarding_complete = FALSE so the wizard runs; trial defaults apply.
  INSERT INTO public.organizations (
    name, slug, onboarding_complete,
    subscription_plan, subscription_status, trial_ends_at
  )
  VALUES (
    p_company_name, v_slug, FALSE,
    'free_trial', 'trialing', NOW() + INTERVAL '14 days'
  )
  RETURNING id INTO v_org_id;

  INSERT INTO public.profiles (id, full_name, email, role, org_id)
  VALUES (v_user_id, p_full_name, v_email, 'admin', v_org_id);

  INSERT INTO public.org_members (org_id, user_id, role, accepted_at, is_active)
  VALUES (v_org_id, v_user_id, 'owner', NOW(), TRUE);

  RETURN jsonb_build_object('user_id', v_user_id, 'org_id', v_org_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_signup(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- 3. subscriptions table -----------------------------------------------------
-- One row per live Stripe subscription. We keep the subscription lifecycle
-- state here so we have a durable audit trail beyond the single mirror
-- fields on organizations; the org.stripe_subscription_id points to the
-- "current" subscription for convenience.
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  plan_slug TEXT NOT NULL
    CHECK (plan_slug IN ('starter','professional','enterprise')),
  status TEXT NOT NULL
    CHECK (status IN ('trialing','active','past_due','canceled','incomplete','incomplete_expired','unpaid','paused')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON public.subscriptions (org_id);

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Org isolation (same pattern as other tenant tables).
CREATE POLICY "org isolation" ON public.subscriptions
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id())
  WITH CHECK (org_id = app_private.user_org_id());

-- Only admins/owners can read their org's subscriptions from the client.
CREATE POLICY "admin read subs" ON public.subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = subscriptions.org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
        AND m.is_active
    )
  );

-- No client writes — subscriptions are mutated only by the Stripe webhook,
-- which uses the service role key (bypasses RLS).
