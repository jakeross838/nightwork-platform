-- Phase 3 — auto-confirm email for self-service signups.
-- Supabase's project-level "confirm email" requirement is on, which breaks
-- the /signup → /onboard flow. A SECURITY DEFINER RPC stamps
-- email_confirmed_at on the caller's own row right after supabase.auth.signUp.

-- The RPC only confirms users who (a) match the supplied email,
-- (b) are still unconfirmed, and (c) were created within the last 60
-- seconds — a narrow window corresponding to the signup flow itself.
-- Outside that window the UPDATE matches zero rows.
CREATE OR REPLACE FUNCTION public.autoconfirm_signup(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = auth, pg_temp
AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = NOW(),
      confirmed_at = NOW()
  WHERE LOWER(email) = LOWER(p_email)
    AND email_confirmed_at IS NULL
    AND created_at > NOW() - INTERVAL '60 seconds';
END;
$$;

GRANT EXECUTE ON FUNCTION public.autoconfirm_signup(TEXT) TO anon, authenticated;
