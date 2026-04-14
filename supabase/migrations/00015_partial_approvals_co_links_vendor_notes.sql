-- 00015_partial_approvals_co_links_vendor_notes.sql
-- Adds:
--   1. invoices.parent_invoice_id        — partial-approval split link
--   2. invoices.partial_approval_note    — reason text for the held portion
--   3. change_orders.source_invoice_id   — CO spawned from an over-budget invoice
--   4. change_order_budget_lines         — allocation of CO amount across budget lines
--   5. vendors.notes                     — QB mapping / internal vendor notes
--   6. vendors.default_notes             — removed in favor of notes (if it existed)

-- ============================================================
-- 1 + 2. Partial approval columns on invoices
-- ============================================================
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS parent_invoice_id UUID REFERENCES invoices(id),
  ADD COLUMN IF NOT EXISTS partial_approval_note TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_parent ON invoices(parent_invoice_id)
  WHERE parent_invoice_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN invoices.parent_invoice_id IS
  'Set on child rows created by partial-approval splits. The parent keeps the held remainder with status pm_held.';
COMMENT ON COLUMN invoices.partial_approval_note IS
  'Reason the PM gave for holding the remaining lines at partial-approval time.';

-- Allow pm_held status checker to also pass when it references a partial.
-- (Existing status enum already includes pm_held, so no CHECK change needed.)

-- ============================================================
-- 3. Change-order link back to the invoice that spawned it
-- ============================================================
ALTER TABLE change_orders
  ADD COLUMN IF NOT EXISTS source_invoice_id UUID REFERENCES invoices(id);

CREATE INDEX IF NOT EXISTS idx_change_orders_source_invoice ON change_orders(source_invoice_id)
  WHERE source_invoice_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN change_orders.source_invoice_id IS
  'When a PM converts an over-budget invoice to a CO, this points back at the invoice so we can show the link in the UI.';

-- ============================================================
-- 4. Allocation of a CO across budget lines
--    One CO can touch multiple cost codes. On execution we bump
--    each referenced budget_line.revised_estimate by its allocation.
-- ============================================================
CREATE TABLE IF NOT EXISTS change_order_budget_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  change_order_id UUID NOT NULL REFERENCES change_orders(id) ON DELETE CASCADE,
  budget_line_id UUID NOT NULL REFERENCES budget_lines(id),
  amount BIGINT NOT NULL DEFAULT 0,
  org_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_co_budget_lines_co ON change_order_budget_lines(change_order_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_co_budget_lines_bl ON change_order_budget_lines(budget_line_id)
  WHERE deleted_at IS NULL;

ALTER TABLE change_order_budget_lines ENABLE ROW LEVEL SECURITY;

-- Inherit the change_orders access policies (authenticated read, admin/pm write).
CREATE POLICY "Authenticated read change_order_budget_lines"
  ON change_order_budget_lines FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin write change_order_budget_lines"
  ON change_order_budget_lines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'pm')
    )
  );

-- ============================================================
-- 5. Vendor notes (QB mapping + internal notes)
-- ============================================================
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN vendors.notes IS
  'Internal vendor notes — QB mapping hints, known quirks, preferred contact, etc. Shown on vendor detail page.';
