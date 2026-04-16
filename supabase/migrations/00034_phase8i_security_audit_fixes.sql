-- Phase 8i — Security audit fixes
--
-- Phase 8i identified RLS issues flagged by the Supabase security
-- advisor and cross-referenced against every table that carries an
-- org_id column.
--
--   1. change_order_budget_lines had no RESTRICTIVE org_id isolation. The
--      PERMISSIVE read policy allowed any authenticated user to read any
--      row across every org. Multi-tenant hole.
--   2. lien_releases had a `USING (true) WITH CHECK (true)` write policy
--      that bypassed role checks. The RESTRICTIVE org isolation policy
--      prevents cross-org writes, but within an org any role could write.
--      Replaced with the admin/accounting/pm pattern used by other tables.
--   3. Helper functions flagged for role-mutable search_path. Lock to
--      `public, pg_temp`.

-- 1. change_order_budget_lines — add restrictive org isolation and
-- replace the legacy policies.
DROP POLICY IF EXISTS "Admin write change_order_budget_lines" ON change_order_budget_lines;
DROP POLICY IF EXISTS "Authenticated read change_order_budget_lines" ON change_order_budget_lines;

CREATE POLICY "org isolation"
  ON change_order_budget_lines
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (org_id = app_private.user_org_id())
  WITH CHECK (org_id = app_private.user_org_id());

CREATE POLICY "members read change_order_budget_lines"
  ON change_order_budget_lines
  FOR SELECT
  TO authenticated
  USING (org_id = app_private.user_org_id());

CREATE POLICY "admin write change_order_budget_lines"
  ON change_order_budget_lines
  FOR ALL
  TO authenticated
  USING (app_private.user_role() = 'admin')
  WITH CHECK (app_private.user_role() = 'admin');

CREATE POLICY "pm write change_order_budget_lines on own jobs"
  ON change_order_budget_lines
  FOR ALL
  TO authenticated
  USING (
    app_private.user_role() = 'pm'
    AND EXISTS (
      SELECT 1 FROM change_orders co
      JOIN jobs j ON j.id = co.job_id
      WHERE co.id = change_order_budget_lines.change_order_id
      AND j.pm_id = auth.uid()
    )
  )
  WITH CHECK (
    app_private.user_role() = 'pm'
    AND EXISTS (
      SELECT 1 FROM change_orders co
      JOIN jobs j ON j.id = co.job_id
      WHERE co.id = change_order_budget_lines.change_order_id
      AND j.pm_id = auth.uid()
    )
  );

-- 2. lien_releases — replace the true/true write policy with role-based
-- access. Accounting manages lien releases; admin can too; PM on own jobs.
DROP POLICY IF EXISTS "authenticated write lien_releases" ON lien_releases;

CREATE POLICY "admin or accounting write lien_releases"
  ON lien_releases
  FOR ALL
  TO authenticated
  USING (app_private.user_role() = ANY (ARRAY['admin', 'accounting']))
  WITH CHECK (app_private.user_role() = ANY (ARRAY['admin', 'accounting']));

CREATE POLICY "pm write lien_releases on own jobs"
  ON lien_releases
  FOR ALL
  TO authenticated
  USING (
    app_private.user_role() = 'pm'
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = lien_releases.job_id
      AND j.pm_id = auth.uid()
    )
  )
  WITH CHECK (
    app_private.user_role() = 'pm'
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = lien_releases.job_id
      AND j.pm_id = auth.uid()
    )
  );

-- 3. Lock search_path on helper functions flagged by the advisor.
ALTER FUNCTION public.recompute_budget_line_invoiced(p_budget_line_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.recompute_budget_line_committed(p_budget_line_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.recompute_po_invoiced(p_po_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.recompute_budget_line_co_adjustments(p_budget_line_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_invoice_line_items_budget_sync() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_invoices_status_budget_sync() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_purchase_orders_commit_sync() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_po_line_items_commit_sync() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_invoice_line_items_po_sync() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_invoices_status_po_sync() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_change_order_lines_sync() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_change_orders_status_sync() SET search_path = public, pg_temp;
ALTER FUNCTION public.next_po_number(p_org_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.touch_org_workflow_settings_updated_at() SET search_path = public, pg_temp;
