-- 00007_add_profiles_and_auth_roles.sql
-- Profiles table linked to auth.users + helper function for role-based RLS.
--
-- Design:
--   * profiles.id === auth.users.id === public.users.id (where an internal-team
--     user exists). This three-way identity lets RLS compare auth.uid() to
--     existing FKs like jobs.pm_id and invoices.assigned_pm_id without a join.
--   * Role ('admin' | 'pm' | 'accounting') is stored in profiles, exposed via
--     a SECURITY DEFINER helper in the `app_private` schema (not exposed via
--     the API) so policies can consult it without triggering RLS recursion.

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'pm', 'accounting')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- PRIVATE HELPER SCHEMA
-- ============================================================
CREATE SCHEMA IF NOT EXISTS app_private;

-- Returns the role of the currently authenticated user.
-- SECURITY DEFINER so it can read `profiles` without invoking the table's
-- own RLS (avoids infinite recursion when policies on other tables
-- reference this function).
CREATE OR REPLACE FUNCTION app_private.user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION app_private.user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.user_role() TO authenticated;

-- ============================================================
-- PROFILES RLS POLICIES
-- ============================================================
-- Everyone authenticated can read profiles (needed for PM dropdown lists, etc.)
DROP POLICY IF EXISTS "authenticated can read profiles" ON public.profiles;
CREATE POLICY "authenticated can read profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- A user can update their own row (name/email tweaks).
DROP POLICY IF EXISTS "user can update own profile" ON public.profiles;
CREATE POLICY "user can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = app_private.user_role());

-- Admins can do anything on profiles.
DROP POLICY IF EXISTS "admin manages profiles" ON public.profiles;
CREATE POLICY "admin manages profiles"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (app_private.user_role() = 'admin')
  WITH CHECK (app_private.user_role() = 'admin');

-- ============================================================
-- Add Andrew Ross to the legacy users table
-- (other 8 users were seeded in migration 00004)
-- ============================================================
INSERT INTO public.users (id, full_name, email, role) VALUES
  ('a0000000-0000-0000-0000-000000000009', 'Andrew Ross', 'andrew@rossbuilt.com', 'admin')
ON CONFLICT (id) DO NOTHING;
