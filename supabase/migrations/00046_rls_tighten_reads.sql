-- SEC-M-2: tighten RLS so reads can't rely solely on the RESTRICTIVE
-- "org isolation" policy. Every authenticated read policy now also
-- filters by org_id. If the RESTRICTIVE policy is ever dropped, the
-- table still enforces tenant isolation at the PERMISSIVE layer.
--
-- Before: jobs/vendors/cost_codes each had a PERMISSIVE "authenticated
-- read" with USING(true), plus a RESTRICTIVE "org isolation" that
-- narrowed to user_org_id(). Drop the restrictive policy and all rows
-- leak via the permissive one.
--
-- After: the permissive read policy itself scopes to user_org_id(), so
-- even without the restrictive net, isolation holds.
--
-- cost_codes additionally allows reads from the template seed org
-- (00000000-0000-0000-0000-000000000001) so newly-onboarded orgs can
-- read the template codes before seeding their own.

DROP POLICY IF EXISTS "authenticated read jobs" ON public.jobs;
CREATE POLICY "authenticated read jobs" ON public.jobs
  FOR SELECT USING (org_id = app_private.user_org_id());

DROP POLICY IF EXISTS "authenticated read vendors" ON public.vendors;
CREATE POLICY "authenticated read vendors" ON public.vendors
  FOR SELECT USING (org_id = app_private.user_org_id());

DROP POLICY IF EXISTS "authenticated read cost_codes" ON public.cost_codes;
CREATE POLICY "authenticated read cost_codes" ON public.cost_codes
  FOR SELECT USING (
    org_id = app_private.user_org_id()
    OR org_id = '00000000-0000-0000-0000-000000000001'::uuid  -- template seed org
  );
