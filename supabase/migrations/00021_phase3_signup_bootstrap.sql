-- Phase 3 — signup bootstrap RPC.
-- A freshly-signed-up user has no profile or org yet, which means the
-- `app_private.user_org_id()` / `app_private.user_role()` session helpers
-- return NULL — and every RLS policy on profiles/organizations/org_members
-- evaluates false. This SECURITY DEFINER function runs with elevated
-- privileges long enough to create the three rows atomically, then drops
-- back out. Callable only by authenticated users, and it uses auth.uid()
-- (not a user-supplied id) so it can only bootstrap the caller's own org.

CREATE OR REPLACE FUNCTION public.create_organization_for_new_user(
  p_org_name TEXT,
  p_org_slug TEXT,
  p_full_name TEXT,
  p_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_org_id UUID;
  v_slug TEXT := p_org_slug;
  v_suffix INT := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug := p_org_slug || '-' || v_suffix::text;
  END LOOP;

  INSERT INTO public.organizations (name, slug, onboarding_complete)
  VALUES (p_org_name, v_slug, FALSE)
  RETURNING id INTO v_org_id;

  INSERT INTO public.profiles (id, full_name, email, role, org_id)
  VALUES (v_user_id, p_full_name, p_email, 'admin', v_org_id)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    org_id = EXCLUDED.org_id;

  INSERT INTO public.org_members (org_id, user_id, role, accepted_at, is_active)
  VALUES (v_org_id, v_user_id, 'owner', NOW(), TRUE)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  RETURN v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization_for_new_user(TEXT, TEXT, TEXT, TEXT) TO authenticated;
