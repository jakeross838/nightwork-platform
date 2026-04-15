-- Phase 7 — RLS permissive policies for the new child tables.
--
-- change_order_lines and po_line_items inherit the RESTRICTIVE "org isolation"
-- policy from the Phase 7 schema migration, but need matching permissive
-- policies for roles (admin/pm) so INSERT/UPDATE/DELETE actually succeed.
-- Mirrors the pattern already used on change_orders / purchase_orders /
-- invoice_line_items.

DROP POLICY IF EXISTS "admin write change_order_lines" ON public.change_order_lines;
CREATE POLICY "admin write change_order_lines" ON public.change_order_lines
  FOR ALL TO authenticated
  USING (app_private.user_role() = 'admin')
  WITH CHECK (app_private.user_role() = 'admin');

DROP POLICY IF EXISTS "pm write change_order_lines on own jobs" ON public.change_order_lines;
CREATE POLICY "pm write change_order_lines on own jobs" ON public.change_order_lines
  FOR ALL TO authenticated
  USING (
    app_private.user_role() = 'pm' AND EXISTS (
      SELECT 1 FROM public.change_orders co
      JOIN public.jobs j ON j.id = co.job_id
      WHERE co.id = change_order_lines.co_id AND j.pm_id = auth.uid()
    )
  )
  WITH CHECK (
    app_private.user_role() = 'pm' AND EXISTS (
      SELECT 1 FROM public.change_orders co
      JOIN public.jobs j ON j.id = co.job_id
      WHERE co.id = change_order_lines.co_id AND j.pm_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "authenticated read change_order_lines" ON public.change_order_lines;
CREATE POLICY "authenticated read change_order_lines" ON public.change_order_lines
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin write po_line_items" ON public.po_line_items;
CREATE POLICY "admin write po_line_items" ON public.po_line_items
  FOR ALL TO authenticated
  USING (app_private.user_role() = 'admin')
  WITH CHECK (app_private.user_role() = 'admin');

DROP POLICY IF EXISTS "pm write po_line_items on own jobs" ON public.po_line_items;
CREATE POLICY "pm write po_line_items on own jobs" ON public.po_line_items
  FOR ALL TO authenticated
  USING (
    app_private.user_role() = 'pm' AND EXISTS (
      SELECT 1 FROM public.purchase_orders po
      JOIN public.jobs j ON j.id = po.job_id
      WHERE po.id = po_line_items.po_id AND j.pm_id = auth.uid()
    )
  )
  WITH CHECK (
    app_private.user_role() = 'pm' AND EXISTS (
      SELECT 1 FROM public.purchase_orders po
      JOIN public.jobs j ON j.id = po.job_id
      WHERE po.id = po_line_items.po_id AND j.pm_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "authenticated read po_line_items" ON public.po_line_items;
CREATE POLICY "authenticated read po_line_items" ON public.po_line_items
  FOR SELECT TO authenticated
  USING (true);
