-- Migration 00043: RLS owner/admin write parity
--
-- BUG: All "admin write {table}" RLS policies only checked for role = 'admin',
-- excluding 'owner'. Jake Ross (Director of Construction, owner role) could not
-- write to most tables. Discovered during Phase 4 Fish draw creation dogfood.
--
-- This migration establishes the correct write-access matrix:
--
--   admin + owner only:
--     jobs, budget_lines, budgets, cost_codes, purchase_orders, po_line_items,
--     users, profiles
--
--   admin + owner + accounting:
--     draws, draw_line_items, invoices(*), invoice_allocations, invoice_line_items,
--     change_orders, change_order_lines, change_order_budget_lines,
--     internal_billings, internal_billing_types,
--     lien_releases, vendors
--
--   (*) invoices already has a separate "accounting update qa invoices" policy
--       for status-gated updates. The ALL policy here covers admin/owner full
--       access + accounting full access (they intake, QA, and push to QB).
--
-- Idempotent: drops both old ("admin write X") and Phase-4-patched
-- ("admin owner write X") policy names before creating final policy.


-- ============================================================
-- ADMIN + OWNER ONLY (config / structural tables)
-- ============================================================

-- budget_lines
DROP POLICY IF EXISTS "admin write budget_lines" ON budget_lines;
DROP POLICY IF EXISTS "admin owner write budget_lines" ON budget_lines;
CREATE POLICY "admin owner write budget_lines" ON budget_lines
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner'));

-- budgets
DROP POLICY IF EXISTS "admin write budgets" ON budgets;
DROP POLICY IF EXISTS "admin owner write budgets" ON budgets;
CREATE POLICY "admin owner write budgets" ON budgets
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner'));

-- cost_codes
DROP POLICY IF EXISTS "admin write cost_codes" ON cost_codes;
DROP POLICY IF EXISTS "admin owner write cost_codes" ON cost_codes;
CREATE POLICY "admin owner write cost_codes" ON cost_codes
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner'));

-- jobs
DROP POLICY IF EXISTS "admin write jobs" ON jobs;
DROP POLICY IF EXISTS "admin owner write jobs" ON jobs;
CREATE POLICY "admin owner write jobs" ON jobs
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner'));

-- purchase_orders
DROP POLICY IF EXISTS "admin write purchase_orders" ON purchase_orders;
DROP POLICY IF EXISTS "admin owner write purchase_orders" ON purchase_orders;
CREATE POLICY "admin owner write purchase_orders" ON purchase_orders
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner'));

-- po_line_items
DROP POLICY IF EXISTS "admin write po_line_items" ON po_line_items;
DROP POLICY IF EXISTS "admin owner write po_line_items" ON po_line_items;
CREATE POLICY "admin owner write po_line_items" ON po_line_items
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner'));

-- users
DROP POLICY IF EXISTS "admin write users" ON users;
DROP POLICY IF EXISTS "admin owner write users" ON users;
CREATE POLICY "admin owner write users" ON users
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner'));

-- profiles
DROP POLICY IF EXISTS "admin manages profiles" ON profiles;
DROP POLICY IF EXISTS "admin owner write profiles" ON profiles;
CREATE POLICY "admin owner write profiles" ON profiles
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner'));


-- ============================================================
-- ADMIN + OWNER + ACCOUNTING (financial workflow tables)
-- ============================================================

-- draws (accounting compiles draws)
DROP POLICY IF EXISTS "admin write draws" ON draws;
DROP POLICY IF EXISTS "admin owner write draws" ON draws;
CREATE POLICY "admin owner accounting write draws" ON draws
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner', 'accounting'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner', 'accounting'));

-- draw_line_items (accounting compiles draw line items)
DROP POLICY IF EXISTS "admin write draw_line_items" ON draw_line_items;
DROP POLICY IF EXISTS "admin owner write draw_line_items" ON draw_line_items;
CREATE POLICY "admin owner accounting write draw_line_items" ON draw_line_items
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner', 'accounting'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner', 'accounting'));

-- invoices (accounting intakes, QAs, and pushes to QB)
-- Note: a separate "accounting update qa invoices" policy already exists for
-- status-gated updates. This ALL policy gives admin/owner/accounting full access.
DROP POLICY IF EXISTS "admin write invoices" ON invoices;
DROP POLICY IF EXISTS "admin owner write invoices" ON invoices;
CREATE POLICY "admin owner accounting write invoices" ON invoices
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner', 'accounting'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner', 'accounting'));

-- invoice_allocations (accounting adjusts allocations during QA)
DROP POLICY IF EXISTS "admin write invoice_allocations" ON invoice_allocations;
DROP POLICY IF EXISTS "admin owner write invoice_allocations" ON invoice_allocations;
CREATE POLICY "admin owner accounting write invoice_allocations" ON invoice_allocations
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner', 'accounting'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner', 'accounting'));

-- invoice_line_items (accounting adjusts line items during QA)
DROP POLICY IF EXISTS "admin write invoice_line_items" ON invoice_line_items;
DROP POLICY IF EXISTS "admin owner write invoice_line_items" ON invoice_line_items;
CREATE POLICY "admin owner accounting write invoice_line_items" ON invoice_line_items
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner', 'accounting'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner', 'accounting'));

-- change_orders (accounting processes COs)
DROP POLICY IF EXISTS "admin write change_orders" ON change_orders;
DROP POLICY IF EXISTS "admin owner write change_orders" ON change_orders;
CREATE POLICY "admin owner accounting write change_orders" ON change_orders
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner', 'accounting'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner', 'accounting'));

-- change_order_lines
DROP POLICY IF EXISTS "admin write change_order_lines" ON change_order_lines;
DROP POLICY IF EXISTS "admin owner write change_order_lines" ON change_order_lines;
CREATE POLICY "admin owner accounting write change_order_lines" ON change_order_lines
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner', 'accounting'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner', 'accounting'));

-- change_order_budget_lines
DROP POLICY IF EXISTS "admin write change_order_budget_lines" ON change_order_budget_lines;
DROP POLICY IF EXISTS "admin owner write change_order_budget_lines" ON change_order_budget_lines;
CREATE POLICY "admin owner accounting write change_order_budget_lines" ON change_order_budget_lines
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner', 'accounting'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner', 'accounting'));

-- internal_billings (accounting manages recurring billings)
DROP POLICY IF EXISTS "admin write internal_billings" ON internal_billings;
DROP POLICY IF EXISTS "admin owner write internal_billings" ON internal_billings;
CREATE POLICY "admin owner accounting write internal_billings" ON internal_billings
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner', 'accounting'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner', 'accounting'));

-- internal_billing_types (accounting configures billing types)
DROP POLICY IF EXISTS "admin write internal_billing_types" ON internal_billing_types;
DROP POLICY IF EXISTS "admin owner write internal_billing_types" ON internal_billing_types;
CREATE POLICY "admin owner accounting write internal_billing_types" ON internal_billing_types
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner', 'accounting'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner', 'accounting'));

-- lien_releases (accounting manages lien releases — already had accounting, was missing owner)
DROP POLICY IF EXISTS "admin or accounting write lien_releases" ON lien_releases;
DROP POLICY IF EXISTS "admin owner write lien_releases" ON lien_releases;
CREATE POLICY "admin owner accounting write lien_releases" ON lien_releases
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner', 'accounting'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner', 'accounting'));

-- vendors (accounting creates/manages vendors — already had accounting, was missing owner)
DROP POLICY IF EXISTS "admin or accounting write vendors" ON vendors;
DROP POLICY IF EXISTS "admin owner write vendors" ON vendors;
CREATE POLICY "admin owner accounting write vendors" ON vendors
  FOR ALL USING (app_private.user_role() IN ('admin', 'owner', 'accounting'))
  WITH CHECK (app_private.user_role() IN ('admin', 'owner', 'accounting'));
