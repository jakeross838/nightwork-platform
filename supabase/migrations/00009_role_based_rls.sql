-- 00009_role_based_rls.sql
-- Replace the permissive "Allow all" RLS policies with role-aware ones.
--
-- Access summary (from product spec):
--   admin       → full read + write on everything
--   pm          → read all invoices; update only invoices on their own jobs
--                 (invoice.assigned_pm_id = auth.uid() OR job.pm_id = auth.uid())
--   accounting  → read all invoices; update invoices only during the QA flow
--   all roles   → read jobs, vendors, cost_codes, budget_lines (needed for UI)
--   draws       → admin full; pm read-only on their jobs; accounting no access
--   vendors     → admin full; accounting full; pm read-only

-- ============================================================
-- Drop old permissive policies
-- ============================================================
DROP POLICY IF EXISTS "Allow all on jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow all on vendors" ON public.vendors;
DROP POLICY IF EXISTS "Allow all on cost_codes" ON public.cost_codes;
DROP POLICY IF EXISTS "Allow all on budget_lines" ON public.budget_lines;
DROP POLICY IF EXISTS "Allow all on purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Allow all on invoices" ON public.invoices;
DROP POLICY IF EXISTS "Allow all on draws" ON public.draws;
DROP POLICY IF EXISTS "Allow all on draw_line_items" ON public.draw_line_items;

-- Tables that were missing RLS entirely
ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- users (legacy internal-team table) — authenticated can read;
-- admin can write. PMs need to read to see assigned_pm names.
-- ============================================================
DROP POLICY IF EXISTS "authenticated read users"  ON public.users;
CREATE POLICY "authenticated read users"
  ON public.users FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin write users"         ON public.users;
CREATE POLICY "admin write users"
  ON public.users FOR ALL TO authenticated
  USING (app_private.user_role() = 'admin')
  WITH CHECK (app_private.user_role() = 'admin');

-- ============================================================
-- jobs — everyone authenticated can read (needed across UI);
-- only admin can insert/update/delete.
-- ============================================================
DROP POLICY IF EXISTS "authenticated read jobs"   ON public.jobs;
CREATE POLICY "authenticated read jobs"
  ON public.jobs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin write jobs"          ON public.jobs;
CREATE POLICY "admin write jobs"
  ON public.jobs FOR ALL TO authenticated
  USING (app_private.user_role() = 'admin')
  WITH CHECK (app_private.user_role() = 'admin');

-- ============================================================
-- vendors — admin + accounting full access; pm read-only
-- ============================================================
DROP POLICY IF EXISTS "authenticated read vendors" ON public.vendors;
CREATE POLICY "authenticated read vendors"
  ON public.vendors FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin or accounting write vendors" ON public.vendors;
CREATE POLICY "admin or accounting write vendors"
  ON public.vendors FOR ALL TO authenticated
  USING (app_private.user_role() IN ('admin', 'accounting'))
  WITH CHECK (app_private.user_role() IN ('admin', 'accounting'));

-- ============================================================
-- cost_codes — read for all, admin-only writes
-- ============================================================
DROP POLICY IF EXISTS "authenticated read cost_codes" ON public.cost_codes;
CREATE POLICY "authenticated read cost_codes"
  ON public.cost_codes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin write cost_codes" ON public.cost_codes;
CREATE POLICY "admin write cost_codes"
  ON public.cost_codes FOR ALL TO authenticated
  USING (app_private.user_role() = 'admin')
  WITH CHECK (app_private.user_role() = 'admin');

-- ============================================================
-- budget_lines — read for all, admin-only writes
-- ============================================================
DROP POLICY IF EXISTS "authenticated read budget_lines" ON public.budget_lines;
CREATE POLICY "authenticated read budget_lines"
  ON public.budget_lines FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin write budget_lines" ON public.budget_lines;
CREATE POLICY "admin write budget_lines"
  ON public.budget_lines FOR ALL TO authenticated
  USING (app_private.user_role() = 'admin')
  WITH CHECK (app_private.user_role() = 'admin');

-- ============================================================
-- purchase_orders — read for all, admin + pm-on-their-jobs writes
-- ============================================================
DROP POLICY IF EXISTS "authenticated read purchase_orders" ON public.purchase_orders;
CREATE POLICY "authenticated read purchase_orders"
  ON public.purchase_orders FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin write purchase_orders" ON public.purchase_orders;
CREATE POLICY "admin write purchase_orders"
  ON public.purchase_orders FOR ALL TO authenticated
  USING (app_private.user_role() = 'admin')
  WITH CHECK (app_private.user_role() = 'admin');

DROP POLICY IF EXISTS "pm write purchase_orders on own jobs" ON public.purchase_orders;
CREATE POLICY "pm write purchase_orders on own jobs"
  ON public.purchase_orders FOR ALL TO authenticated
  USING (
    app_private.user_role() = 'pm'
    AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = purchase_orders.job_id AND j.pm_id = auth.uid())
  )
  WITH CHECK (
    app_private.user_role() = 'pm'
    AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = purchase_orders.job_id AND j.pm_id = auth.uid())
  );

-- ============================================================
-- change_orders — read for all, admin-only writes
-- ============================================================
DROP POLICY IF EXISTS "authenticated read change_orders" ON public.change_orders;
CREATE POLICY "authenticated read change_orders"
  ON public.change_orders FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin write change_orders" ON public.change_orders;
CREATE POLICY "admin write change_orders"
  ON public.change_orders FOR ALL TO authenticated
  USING (app_private.user_role() = 'admin')
  WITH CHECK (app_private.user_role() = 'admin');

-- ============================================================
-- invoices — the core of role-based access
-- ============================================================
-- Everyone can read all invoices (PMs see All Invoices read-only,
-- accounting needs the QA queue, admin sees everything).
DROP POLICY IF EXISTS "authenticated read invoices" ON public.invoices;
CREATE POLICY "authenticated read invoices"
  ON public.invoices FOR SELECT TO authenticated USING (true);

-- Admin: full control
DROP POLICY IF EXISTS "admin write invoices" ON public.invoices;
CREATE POLICY "admin write invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (app_private.user_role() = 'admin')
  WITH CHECK (app_private.user_role() = 'admin');

-- PMs can insert/update/delete only invoices on jobs they own OR
-- invoices explicitly assigned to them.
DROP POLICY IF EXISTS "pm insert invoices on own jobs" ON public.invoices;
CREATE POLICY "pm insert invoices on own jobs"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (
    app_private.user_role() = 'pm'
    AND (
      assigned_pm_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = invoices.job_id AND j.pm_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "pm update invoices on own jobs" ON public.invoices;
CREATE POLICY "pm update invoices on own jobs"
  ON public.invoices FOR UPDATE TO authenticated
  USING (
    app_private.user_role() = 'pm'
    AND (
      assigned_pm_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = invoices.job_id AND j.pm_id = auth.uid())
    )
  )
  WITH CHECK (
    app_private.user_role() = 'pm'
    AND (
      assigned_pm_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = invoices.job_id AND j.pm_id = auth.uid())
    )
  );

-- Accounting can update invoices during the QA flow.
-- Insert is allowed (upload happens under the accounting user).
DROP POLICY IF EXISTS "accounting insert invoices" ON public.invoices;
CREATE POLICY "accounting insert invoices"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (app_private.user_role() = 'accounting');

DROP POLICY IF EXISTS "accounting update qa invoices" ON public.invoices;
CREATE POLICY "accounting update qa invoices"
  ON public.invoices FOR UPDATE TO authenticated
  USING (
    app_private.user_role() = 'accounting'
    AND status IN ('received', 'ai_processed', 'pm_approved', 'qa_review',
                   'qa_approved', 'qa_kicked_back', 'pushed_to_qb', 'qb_failed')
  )
  WITH CHECK (app_private.user_role() = 'accounting');

-- ============================================================
-- draws + draw_line_items — admin full; pm read-only on own jobs
-- ============================================================
DROP POLICY IF EXISTS "admin read draws" ON public.draws;
CREATE POLICY "admin read draws"
  ON public.draws FOR SELECT TO authenticated
  USING (app_private.user_role() = 'admin');

DROP POLICY IF EXISTS "pm read draws on own jobs" ON public.draws;
CREATE POLICY "pm read draws on own jobs"
  ON public.draws FOR SELECT TO authenticated
  USING (
    app_private.user_role() = 'pm'
    AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = draws.job_id AND j.pm_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin write draws" ON public.draws;
CREATE POLICY "admin write draws"
  ON public.draws FOR ALL TO authenticated
  USING (app_private.user_role() = 'admin')
  WITH CHECK (app_private.user_role() = 'admin');

DROP POLICY IF EXISTS "admin read draw_line_items" ON public.draw_line_items;
CREATE POLICY "admin read draw_line_items"
  ON public.draw_line_items FOR SELECT TO authenticated
  USING (app_private.user_role() = 'admin');

DROP POLICY IF EXISTS "pm read draw_line_items on own jobs" ON public.draw_line_items;
CREATE POLICY "pm read draw_line_items on own jobs"
  ON public.draw_line_items FOR SELECT TO authenticated
  USING (
    app_private.user_role() = 'pm'
    AND EXISTS (
      SELECT 1 FROM public.draws d
      JOIN public.jobs j ON j.id = d.job_id
      WHERE d.id = draw_line_items.draw_id AND j.pm_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admin write draw_line_items" ON public.draw_line_items;
CREATE POLICY "admin write draw_line_items"
  ON public.draw_line_items FOR ALL TO authenticated
  USING (app_private.user_role() = 'admin')
  WITH CHECK (app_private.user_role() = 'admin');
