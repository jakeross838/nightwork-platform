-- 00014_add_allowance_tracking.sql
-- Allowance line items are intentionally open-ended budget placeholders —
-- the final selection (flooring, tile, fixtures, etc.) is up to the client,
-- and any overage becomes a change order by design. Flagging these at the
-- budget-line level lets the UI auto-suggest "Convert to Change Order"
-- when the PM reviews an over-budget allowance invoice.

ALTER TABLE budget_lines
  ADD COLUMN IF NOT EXISTS is_allowance BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_budget_lines_allowance
  ON budget_lines (is_allowance) WHERE deleted_at IS NULL AND is_allowance = true;

-- Mark the standard Drummond allowance codes. These are the categories
-- where the client picks the finish/fixture after the base contract is
-- signed — so any invoice against these codes is expected to trigger a CO
-- when the selection exceeds the allowance.
UPDATE budget_lines bl
  SET is_allowance = true
  FROM cost_codes cc
  WHERE bl.cost_code_id = cc.id
    AND cc.code IN (
      '12102', -- Plumbing Fixtures
      '13102', -- Electrical Fixtures
      '21103', -- Countertops
      '22101', -- Appliances
      '23101', -- Flooring Materials
      '24101', -- Tile Labor Floors
      '24102', -- Tile Material Floors
      '24103', -- Tile Labor Walls
      '24104', -- Tile Material Walls
      '30101', -- Bath Hardware Material
      '31101'  -- Shower Doors and Glass
    )
    AND bl.deleted_at IS NULL;
