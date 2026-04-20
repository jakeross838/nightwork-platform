-- Platform admin RLS bypass: staff can READ across every org, but CANNOT
-- write/delete across orgs via RLS. Cross-org mutations must go through
-- dedicated API routes that use the service-role key and log to
-- platform_admin_audit.
--
-- Strategy per table:
-- 1. Existing RESTRICTIVE "org isolation" FOR ALL is replaced with a
--    looser USING (platform admin OR org match) while keeping WITH CHECK
--    strict (org match only). This allows platform admins to SELECT any
--    org's rows and to TARGET rows for UPDATE, but blocks them from
--    writing cross-org (WITH CHECK fails on resulting row).
-- 2. A companion RESTRICTIVE FOR DELETE policy re-imposes strict
--    org-scoping on deletes (which lack WITH CHECK). Platform admins
--    therefore cannot delete cross-org via RLS.
-- 3. A new PERMISSIVE "{table}_platform_admin_read" policy is added so
--    the bypass shows up explicitly in pg_policies audits and OR'd with
--    existing PERMISSIVE SELECT policies that filter by user_org_id().
--
-- For tables without a RESTRICTIVE "org isolation" (organizations,
-- org_members, org_invites, parser_corrections), we only need to add
-- the new PERMISSIVE SELECT policy — there is no restrictive layer to
-- loosen.
--
-- invoice_allocations has a special restrictive policy that joins through
-- invoices.org_id; it gets its own variant of the pattern.

-- ============================================================
-- Helper: one block per table
-- ============================================================

-- activity_log
DROP POLICY IF EXISTS "org isolation" ON public.activity_log;
CREATE POLICY "org isolation" ON public.activity_log
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "activity_log_delete_strict" ON public.activity_log
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "activity_log_platform_admin_read" ON public.activity_log
  FOR SELECT USING (app_private.is_platform_admin());

-- api_usage
DROP POLICY IF EXISTS "org isolation" ON public.api_usage;
CREATE POLICY "org isolation" ON public.api_usage
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "api_usage_delete_strict" ON public.api_usage
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "api_usage_platform_admin_read" ON public.api_usage
  FOR SELECT USING (app_private.is_platform_admin());

-- budget_lines
DROP POLICY IF EXISTS "org isolation" ON public.budget_lines;
CREATE POLICY "org isolation" ON public.budget_lines
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "budget_lines_delete_strict" ON public.budget_lines
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "budget_lines_platform_admin_read" ON public.budget_lines
  FOR SELECT USING (app_private.is_platform_admin());

-- budgets
DROP POLICY IF EXISTS "org isolation" ON public.budgets;
CREATE POLICY "org isolation" ON public.budgets
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "budgets_delete_strict" ON public.budgets
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "budgets_platform_admin_read" ON public.budgets
  FOR SELECT USING (app_private.is_platform_admin());

-- change_order_budget_lines
DROP POLICY IF EXISTS "org isolation" ON public.change_order_budget_lines;
CREATE POLICY "org isolation" ON public.change_order_budget_lines
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "change_order_budget_lines_delete_strict" ON public.change_order_budget_lines
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "change_order_budget_lines_platform_admin_read" ON public.change_order_budget_lines
  FOR SELECT USING (app_private.is_platform_admin());

-- change_order_lines
DROP POLICY IF EXISTS "org isolation" ON public.change_order_lines;
CREATE POLICY "org isolation" ON public.change_order_lines
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "change_order_lines_delete_strict" ON public.change_order_lines
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "change_order_lines_platform_admin_read" ON public.change_order_lines
  FOR SELECT USING (app_private.is_platform_admin());

-- change_orders
DROP POLICY IF EXISTS "org isolation" ON public.change_orders;
CREATE POLICY "org isolation" ON public.change_orders
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "change_orders_delete_strict" ON public.change_orders
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "change_orders_platform_admin_read" ON public.change_orders
  FOR SELECT USING (app_private.is_platform_admin());

-- cost_codes
DROP POLICY IF EXISTS "org isolation" ON public.cost_codes;
CREATE POLICY "org isolation" ON public.cost_codes
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "cost_codes_delete_strict" ON public.cost_codes
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "cost_codes_platform_admin_read" ON public.cost_codes
  FOR SELECT USING (app_private.is_platform_admin());

-- draw_line_items
DROP POLICY IF EXISTS "org isolation" ON public.draw_line_items;
CREATE POLICY "org isolation" ON public.draw_line_items
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "draw_line_items_delete_strict" ON public.draw_line_items
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "draw_line_items_platform_admin_read" ON public.draw_line_items
  FOR SELECT USING (app_private.is_platform_admin());

-- draws
DROP POLICY IF EXISTS "org isolation" ON public.draws;
CREATE POLICY "org isolation" ON public.draws
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "draws_delete_strict" ON public.draws
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "draws_platform_admin_read" ON public.draws
  FOR SELECT USING (app_private.is_platform_admin());

-- email_inbox
DROP POLICY IF EXISTS "org isolation" ON public.email_inbox;
CREATE POLICY "org isolation" ON public.email_inbox
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "email_inbox_delete_strict" ON public.email_inbox
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "email_inbox_platform_admin_read" ON public.email_inbox
  FOR SELECT USING (app_private.is_platform_admin());

-- internal_billing_types
DROP POLICY IF EXISTS "org isolation" ON public.internal_billing_types;
CREATE POLICY "org isolation" ON public.internal_billing_types
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "internal_billing_types_delete_strict" ON public.internal_billing_types
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "internal_billing_types_platform_admin_read" ON public.internal_billing_types
  FOR SELECT USING (app_private.is_platform_admin());

-- internal_billings
DROP POLICY IF EXISTS "org isolation" ON public.internal_billings;
CREATE POLICY "org isolation" ON public.internal_billings
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "internal_billings_delete_strict" ON public.internal_billings
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "internal_billings_platform_admin_read" ON public.internal_billings
  FOR SELECT USING (app_private.is_platform_admin());

-- invoice_import_batches
DROP POLICY IF EXISTS "org isolation" ON public.invoice_import_batches;
CREATE POLICY "org isolation" ON public.invoice_import_batches
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "invoice_import_batches_delete_strict" ON public.invoice_import_batches
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "invoice_import_batches_platform_admin_read" ON public.invoice_import_batches
  FOR SELECT USING (app_private.is_platform_admin());

-- invoice_line_items
DROP POLICY IF EXISTS "org isolation" ON public.invoice_line_items;
CREATE POLICY "org isolation" ON public.invoice_line_items
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "invoice_line_items_delete_strict" ON public.invoice_line_items
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "invoice_line_items_platform_admin_read" ON public.invoice_line_items
  FOR SELECT USING (app_private.is_platform_admin());

-- invoices
DROP POLICY IF EXISTS "org isolation" ON public.invoices;
CREATE POLICY "org isolation" ON public.invoices
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "invoices_delete_strict" ON public.invoices
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "invoices_platform_admin_read" ON public.invoices
  FOR SELECT USING (app_private.is_platform_admin());

-- jobs
DROP POLICY IF EXISTS "org isolation" ON public.jobs;
CREATE POLICY "org isolation" ON public.jobs
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "jobs_delete_strict" ON public.jobs
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "jobs_platform_admin_read" ON public.jobs
  FOR SELECT USING (app_private.is_platform_admin());

-- lien_releases
DROP POLICY IF EXISTS "org isolation" ON public.lien_releases;
CREATE POLICY "org isolation" ON public.lien_releases
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "lien_releases_delete_strict" ON public.lien_releases
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "lien_releases_platform_admin_read" ON public.lien_releases
  FOR SELECT USING (app_private.is_platform_admin());

-- notifications
DROP POLICY IF EXISTS "org isolation" ON public.notifications;
CREATE POLICY "org isolation" ON public.notifications
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "notifications_delete_strict" ON public.notifications
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "notifications_platform_admin_read" ON public.notifications
  FOR SELECT USING (app_private.is_platform_admin());

-- org_workflow_settings
DROP POLICY IF EXISTS "org isolation" ON public.org_workflow_settings;
CREATE POLICY "org isolation" ON public.org_workflow_settings
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "org_workflow_settings_delete_strict" ON public.org_workflow_settings
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "org_workflow_settings_platform_admin_read" ON public.org_workflow_settings
  FOR SELECT USING (app_private.is_platform_admin());

-- po_line_items
DROP POLICY IF EXISTS "org isolation" ON public.po_line_items;
CREATE POLICY "org isolation" ON public.po_line_items
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "po_line_items_delete_strict" ON public.po_line_items
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "po_line_items_platform_admin_read" ON public.po_line_items
  FOR SELECT USING (app_private.is_platform_admin());

-- profiles
DROP POLICY IF EXISTS "org isolation" ON public.profiles;
CREATE POLICY "org isolation" ON public.profiles
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "profiles_delete_strict" ON public.profiles
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "profiles_platform_admin_read" ON public.profiles
  FOR SELECT USING (app_private.is_platform_admin());

-- purchase_orders
DROP POLICY IF EXISTS "org isolation" ON public.purchase_orders;
CREATE POLICY "org isolation" ON public.purchase_orders
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "purchase_orders_delete_strict" ON public.purchase_orders
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "purchase_orders_platform_admin_read" ON public.purchase_orders
  FOR SELECT USING (app_private.is_platform_admin());

-- subscriptions
DROP POLICY IF EXISTS "org isolation" ON public.subscriptions;
CREATE POLICY "org isolation" ON public.subscriptions
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "subscriptions_delete_strict" ON public.subscriptions
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "subscriptions_platform_admin_read" ON public.subscriptions
  FOR SELECT USING (app_private.is_platform_admin());

-- users (legacy)
DROP POLICY IF EXISTS "org isolation" ON public.users;
CREATE POLICY "org isolation" ON public.users
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "users_delete_strict" ON public.users
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "users_platform_admin_read" ON public.users
  FOR SELECT USING (app_private.is_platform_admin());

-- vendors
DROP POLICY IF EXISTS "org isolation" ON public.vendors;
CREATE POLICY "org isolation" ON public.vendors
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id() OR app_private.is_platform_admin())
  WITH CHECK (org_id = app_private.user_org_id());
CREATE POLICY "vendors_delete_strict" ON public.vendors
  AS RESTRICTIVE FOR DELETE
  USING (org_id = app_private.user_org_id());
CREATE POLICY "vendors_platform_admin_read" ON public.vendors
  FOR SELECT USING (app_private.is_platform_admin());

-- invoice_allocations — joins through invoices for org scoping
DROP POLICY IF EXISTS "org isolation" ON public.invoice_allocations;
CREATE POLICY "org isolation" ON public.invoice_allocations
  AS RESTRICTIVE FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_allocations.invoice_id
        AND i.org_id = app_private.user_org_id()
    ) OR app_private.is_platform_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_allocations.invoice_id
        AND i.org_id = app_private.user_org_id()
    )
  );
CREATE POLICY "invoice_allocations_delete_strict" ON public.invoice_allocations
  AS RESTRICTIVE FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_allocations.invoice_id
        AND i.org_id = app_private.user_org_id()
    )
  );
CREATE POLICY "invoice_allocations_platform_admin_read" ON public.invoice_allocations
  FOR SELECT USING (app_private.is_platform_admin());

-- ============================================================
-- Tables with no RESTRICTIVE "org isolation" — add permissive bypass
-- ============================================================

CREATE POLICY "organizations_platform_admin_read" ON public.organizations
  FOR SELECT USING (app_private.is_platform_admin());

CREATE POLICY "org_members_platform_admin_read" ON public.org_members
  FOR SELECT USING (app_private.is_platform_admin());

CREATE POLICY "org_invites_platform_admin_read" ON public.org_invites
  FOR SELECT USING (app_private.is_platform_admin());

CREATE POLICY "parser_corrections_platform_admin_read" ON public.parser_corrections
  FOR SELECT USING (app_private.is_platform_admin());
