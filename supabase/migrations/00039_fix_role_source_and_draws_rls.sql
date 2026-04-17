-- ============================================================
-- Migration 00039: Fix role-system inconsistency + draws RLS gaps
-- ============================================================
-- Bug: app_private.user_role() reads profiles.role, but the app
-- canonically uses org_members.role. Signup flow creates
-- mismatched rows (profiles=admin, org_members=owner).
--
-- Additionally, draws and draw_line_items had role-gated SELECT
-- policies that only covered admin + pm (on own jobs), leaving
-- owner and accounting without explicit permissive policies.
-- The org_isolation RESTRICTIVE policy requires at least one
-- permissive policy to match — so owner/accounting were blocked.
-- ============================================================

-- 1. Fix user_role() to read canonical source (org_members)
CREATE OR REPLACE FUNCTION app_private.user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.org_members
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

-- 2. Add explicit SELECT policies for owner + accounting on draws
--    (admin included so we can drop the separate admin-only policy)
CREATE POLICY "owner admin accounting read draws"
  ON draws FOR SELECT TO authenticated
  USING (app_private.user_role() IN ('owner', 'admin', 'accounting'));

DROP POLICY IF EXISTS "admin read draws" ON draws;

-- Same for draw_line_items
CREATE POLICY "owner admin accounting read draw_line_items"
  ON draw_line_items FOR SELECT TO authenticated
  USING (app_private.user_role() IN ('owner', 'admin', 'accounting'));

DROP POLICY IF EXISTS "admin read draw_line_items" ON draw_line_items;

-- 3. Fix signup functions to write consistent role to profiles
--    Both previously wrote profiles.role = 'admin' but org_members.role = 'owner'

CREATE OR REPLACE FUNCTION public.create_organization_for_new_user(p_org_name text, p_org_slug text, p_full_name text, p_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_org_id UUID;
  v_slug TEXT := p_org_slug;
  v_suffix INT := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Dedupe slug on collision.
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug := p_org_slug || '-' || v_suffix::text;
  END LOOP;

  INSERT INTO public.organizations (name, slug, onboarding_complete)
  VALUES (p_org_name, v_slug, FALSE)
  RETURNING id INTO v_org_id;

  -- Insert profile (or update if somehow already present).
  -- Role = 'owner' to match org_members canonical source.
  INSERT INTO public.profiles (id, full_name, email, role, org_id)
  VALUES (v_user_id, p_full_name, p_email, 'owner', v_org_id)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    org_id = EXCLUDED.org_id;

  -- Creator becomes the owner of the new org.
  INSERT INTO public.org_members (org_id, user_id, role, accepted_at, is_active)
  VALUES (v_org_id, v_user_id, 'owner', NOW(), TRUE)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  RETURN v_org_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_signup(p_email text, p_password text, p_full_name text, p_company_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
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

  INSERT INTO public.organizations (
    name, slug, onboarding_complete,
    subscription_plan, subscription_status, trial_ends_at
  )
  VALUES (
    p_company_name, v_slug, FALSE,
    'free_trial', 'trialing', NOW() + INTERVAL '14 days'
  )
  RETURNING id INTO v_org_id;

  -- Role = 'owner' to match org_members canonical source.
  INSERT INTO public.profiles (id, full_name, email, role, org_id)
  VALUES (v_user_id, p_full_name, v_email, 'owner', v_org_id);

  INSERT INTO public.org_members (org_id, user_id, role, accepted_at, is_active)
  VALUES (v_org_id, v_user_id, 'owner', NOW(), TRUE);

  RETURN jsonb_build_object('user_id', v_user_id, 'org_id', v_org_id);
END;
$function$;

-- 4. Add 'owner' to profiles.role check constraint (was missing)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['admin', 'pm', 'accounting', 'owner']));

-- 5. Sync existing mismatched profiles data
UPDATE profiles
SET role = om.role, updated_at = NOW()
FROM org_members om
WHERE om.user_id = profiles.id
  AND om.is_active = true
  AND profiles.role != om.role;
