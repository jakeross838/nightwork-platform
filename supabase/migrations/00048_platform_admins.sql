-- Platform admin: cross-tenant staff table for Nightwork operators
-- (Jake, Andrew, future support/engineering hires). Separate from org
-- membership so staff can impersonate and read across every org without
-- polluting org_members with fake rows.
--
-- Design notes:
-- - Approach 1 (separate table) so we never have to reason about "Jake is
--   a member of Ross Built AND also a cross-tenant admin" collisions.
-- - Writes to tenant tables are NOT granted here. Platform admin mutations
--   go through dedicated API routes that write to platform_admin_audit
--   every time.
-- - app_private.is_platform_admin() is SECURITY DEFINER so RLS policies
--   can call it without self-recursion on platform_admins.

-- ============================================================
-- 1. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('staff', 'support', 'engineer')) DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.platform_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_record_type TEXT,
  target_record_id UUID,
  details JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_admin
  ON public.platform_admin_audit (admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_target_org
  ON public.platform_admin_audit (target_org_id, created_at DESC)
  WHERE target_org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_target_user
  ON public.platform_admin_audit (target_user_id, created_at DESC)
  WHERE target_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_action
  ON public.platform_admin_audit (action, created_at DESC);

-- ============================================================
-- 2. HELPER FUNCTION (must come before policies that use it)
-- ============================================================
-- SECURITY DEFINER + empty search_path bypasses RLS for the internal
-- check (we're querying our own table to decide "is this user staff")
-- and also dodges any self-recursion when a policy on platform_admins
-- calls back into platform_admins.
CREATE OR REPLACE FUNCTION app_private.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION app_private.is_platform_admin() TO authenticated;

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admin_audit ENABLE ROW LEVEL SECURITY;

-- A signed-in user can always see their own row (if any). Lets app code
-- do a simple .eq('user_id', currentUser) check without needing staff
-- privileges.
CREATE POLICY "platform_admins_self_read" ON public.platform_admins
  FOR SELECT USING (user_id = auth.uid());

-- Staff can read every row (for the Users admin view).
CREATE POLICY "platform_admins_staff_read_all" ON public.platform_admins
  FOR SELECT USING (app_private.is_platform_admin());

-- No authenticated writes. Grants/revocations of platform admin happen
-- through direct DB migrations or a service-role admin route later — NOT
-- through end-user-facing app code.

-- Audit log: staff can read everything.
CREATE POLICY "platform_admin_audit_staff_read" ON public.platform_admin_audit
  FOR SELECT USING (app_private.is_platform_admin());

-- Staff can append (but not update/delete — append-only by design).
CREATE POLICY "platform_admin_audit_staff_insert" ON public.platform_admin_audit
  FOR INSERT WITH CHECK (app_private.is_platform_admin());

-- ============================================================
-- 4. SEED INITIAL STAFF
-- ============================================================
-- Using SELECT-based insert so missing emails are silently skipped
-- rather than failing the migration with a NOT NULL violation.
INSERT INTO public.platform_admins (user_id, role, notes)
SELECT id, 'staff', 'Founder'
FROM auth.users
WHERE email IN ('jake@rossbuilt.com', 'andrew@rossbuilt.com')
ON CONFLICT (user_id) DO NOTHING;
