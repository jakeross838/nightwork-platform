-- NOT APPLIED
-- ===========================================================================
-- 00037_rollback_phase_b_pre_rebuild.sql
-- ===========================================================================
--
-- CONTEXT RECAP
-- -------------
-- Phase B migration "phase_b_internal_billings_and_allocations" was applied
-- directly to DEV Supabase via MCP but never committed to git. The DB schema
-- is ahead of the codebase at commit 79ab01d. This rollback restores the DB
-- to match the committed schema so we can rebuild Phase D fixes on a known-
-- good baseline.
--
-- Phase B introduced:
--   - 3 new tables: internal_billing_types, internal_billings, invoice_allocations
--   - 7 new columns across jobs, change_orders, draw_line_items
--   - Convention change: gc_fee_rate, deposit_percentage, gc_fee_percentage,
--     and organization defaults converted from fraction (0.0-1.0, numeric(5,4))
--     to whole-percent (0-100, numeric(5,2)) with CHECK constraints
--   - RLS policies on the 3 new tables
--   - Seed data (8 internal_billing_types, 3 internal_billings, 2 invoice_allocations)
--
-- CONVENTION CHANGE AUDIT
-- -----------------------
-- Phase B converted 5 columns from fraction to whole-percent:
--
--   Table            | Column                     | Before (git)       | After (Phase B)    | Data example
--   -----------------+----------------------------+--------------------+--------------------+-------------
--   change_orders    | gc_fee_rate                | numeric(5,4) 0.18  | numeric(5,2) 18.00 | 18.00 -> 0.18
--   jobs             | deposit_percentage         | numeric(5,4) 0.10  | numeric(5,2) 10.00 | 10.00 -> 0.10
--   jobs             | gc_fee_percentage          | numeric(5,4) 0.20  | numeric(5,2) 20.00 | 20.00 -> 0.20
--   organizations    | default_gc_fee_percentage  | numeric(5,4) 0.20  | numeric(5,2) 20.00 | 20.00 -> 0.20
--   organizations    | default_deposit_percentage | numeric(5,4) 0.10  | numeric(5,2) 10.00 | 10.00 -> 0.10
--
-- Code at 79ab01d expects FRACTION convention (e.g. amount * 0.18, display * 100).
-- Current DB stores WHOLE-PERCENT. This is an active math bug on any write path.
-- This rollback converts data back to fractions and restores numeric(5,4).
--
-- TARGET: DEV Supabase (egxkffodxcefwpqmwrur) ONLY
-- DO NOT APPLY TO PROD (vnpqjderiuhsiiygfwfb)
-- ===========================================================================

BEGIN;

-- ================================================================
-- SECTION 1: Drop foreign key constraints that block table drops
-- ================================================================
-- draw_line_items has FKs pointing INTO the tables being dropped.
-- internal_billings has a FK pointing INTO draw_line_items (circular).
-- invoice_allocations has a FK pointing INTO draw_line_items.

-- draw_line_items -> internal_billings
ALTER TABLE draw_line_items
  DROP CONSTRAINT IF EXISTS draw_line_items_internal_billing_id_fkey;

-- draw_line_items -> change_orders (Phase B addition; the pre-existing
-- draw_line_items table had no change_order_id column)
ALTER TABLE draw_line_items
  DROP CONSTRAINT IF EXISTS draw_line_items_change_order_id_fkey;

-- internal_billings -> draw_line_items (circular back-ref)
ALTER TABLE internal_billings
  DROP CONSTRAINT IF EXISTS internal_billings_draw_line_item_id_fkey;

-- invoice_allocations -> draw_line_items
ALTER TABLE invoice_allocations
  DROP CONSTRAINT IF EXISTS invoice_allocations_draw_line_item_id_fkey;

-- invoice_allocations -> invoices
ALTER TABLE invoice_allocations
  DROP CONSTRAINT IF EXISTS invoice_allocations_invoice_id_fkey;

-- invoice_allocations -> cost_codes
ALTER TABLE invoice_allocations
  DROP CONSTRAINT IF EXISTS invoice_allocations_cost_code_id_fkey;

-- internal_billings -> internal_billing_types
ALTER TABLE internal_billings
  DROP CONSTRAINT IF EXISTS internal_billings_billing_type_id_fkey;

-- internal_billings -> jobs
ALTER TABLE internal_billings
  DROP CONSTRAINT IF EXISTS internal_billings_job_id_fkey;

-- internal_billings -> cost_codes
ALTER TABLE internal_billings
  DROP CONSTRAINT IF EXISTS internal_billings_cost_code_id_fkey;

-- internal_billings -> organizations
ALTER TABLE internal_billings
  DROP CONSTRAINT IF EXISTS internal_billings_org_id_fkey;

-- internal_billing_types -> organizations
ALTER TABLE internal_billing_types
  DROP CONSTRAINT IF EXISTS internal_billing_types_org_id_fkey;

-- internal_billing_types -> cost_codes
ALTER TABLE internal_billing_types
  DROP CONSTRAINT IF EXISTS internal_billing_types_default_cost_code_id_fkey;


-- ================================================================
-- SECTION 2: Drop the 3 Phase B tables (dependency order)
-- ================================================================
-- RLS policies are dropped automatically with CASCADE.
-- Order: invoice_allocations first (leaf), then internal_billings
-- (references internal_billing_types), then internal_billing_types (root).

DROP TABLE IF EXISTS invoice_allocations CASCADE;
DROP TABLE IF EXISTS internal_billings CASCADE;
DROP TABLE IF EXISTS internal_billing_types CASCADE;


-- ================================================================
-- SECTION 3: Drop Phase B column additions
-- ================================================================

-- draw_line_items: source_type, internal_billing_id, change_order_id
ALTER TABLE draw_line_items
  DROP COLUMN IF EXISTS source_type,
  DROP COLUMN IF EXISTS internal_billing_id,
  DROP COLUMN IF EXISTS change_order_id;

-- change_orders: application_number
ALTER TABLE change_orders
  DROP COLUMN IF EXISTS application_number;

-- jobs: starting_application_number, previous_certificates_total,
--       previous_change_orders_total
ALTER TABLE jobs
  DROP COLUMN IF EXISTS starting_application_number,
  DROP COLUMN IF EXISTS previous_certificates_total,
  DROP COLUMN IF EXISTS previous_change_orders_total;


-- ================================================================
-- SECTION 4: Revert convention conversion (whole-percent -> fraction)
-- ================================================================
-- Phase B added CHECK(col >= 0 AND col <= 100) on all 5 columns.
-- Drop those first, then convert data, then alter column type + default.

-- 4a. Drop Phase B CHECK constraints
ALTER TABLE change_orders
  DROP CONSTRAINT IF EXISTS chk_change_orders_gc_fee_rate;
ALTER TABLE jobs
  DROP CONSTRAINT IF EXISTS chk_jobs_deposit_percentage;
ALTER TABLE jobs
  DROP CONSTRAINT IF EXISTS chk_jobs_gc_fee_percentage;
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS chk_orgs_default_gc_fee_percentage;
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS chk_orgs_default_deposit_percentage;

-- 4b. Convert data: divide by 100 to go from whole-percent back to fraction
UPDATE change_orders
  SET gc_fee_rate = gc_fee_rate / 100
  WHERE gc_fee_rate IS NOT NULL AND gc_fee_rate > 1;
  -- Guard: only convert rows that are clearly in whole-percent range.
  -- Rows already at 0.00 or 1.00 are ambiguous but 0 / 100 = 0 anyway.

UPDATE jobs
  SET deposit_percentage = deposit_percentage / 100
  WHERE deposit_percentage IS NOT NULL AND deposit_percentage > 1;

UPDATE jobs
  SET gc_fee_percentage = gc_fee_percentage / 100
  WHERE gc_fee_percentage IS NOT NULL AND gc_fee_percentage > 1;

UPDATE organizations
  SET default_gc_fee_percentage = default_gc_fee_percentage / 100
  WHERE default_gc_fee_percentage IS NOT NULL AND default_gc_fee_percentage > 1;

UPDATE organizations
  SET default_deposit_percentage = default_deposit_percentage / 100
  WHERE default_deposit_percentage IS NOT NULL AND default_deposit_percentage > 1;

-- 4c. Alter column types back to numeric(5,4) and restore original defaults
-- Original definitions from supabase/migrations/00001_initial_schema.sql:
--   jobs.deposit_percentage   NUMERIC(5,4) NOT NULL DEFAULT 0.10
--   jobs.gc_fee_percentage    NUMERIC(5,4) NOT NULL DEFAULT 0.20
--   change_orders.gc_fee_rate NUMERIC(5,4) NOT NULL DEFAULT 0.20
-- Original definitions from supabase/migrations/00016_multi_tenant_foundation.sql:
--   organizations.default_gc_fee_percentage  NUMERIC(5,4) NOT NULL DEFAULT 0.20
--   organizations.default_deposit_percentage NUMERIC(5,4) NOT NULL DEFAULT 0.10

ALTER TABLE change_orders
  ALTER COLUMN gc_fee_rate TYPE NUMERIC(5,4) USING gc_fee_rate::NUMERIC(5,4),
  ALTER COLUMN gc_fee_rate SET DEFAULT 0.20;

ALTER TABLE jobs
  ALTER COLUMN deposit_percentage TYPE NUMERIC(5,4) USING deposit_percentage::NUMERIC(5,4),
  ALTER COLUMN deposit_percentage SET DEFAULT 0.10;

ALTER TABLE jobs
  ALTER COLUMN gc_fee_percentage TYPE NUMERIC(5,4) USING gc_fee_percentage::NUMERIC(5,4),
  ALTER COLUMN gc_fee_percentage SET DEFAULT 0.20;

ALTER TABLE organizations
  ALTER COLUMN default_gc_fee_percentage TYPE NUMERIC(5,4) USING default_gc_fee_percentage::NUMERIC(5,4),
  ALTER COLUMN default_gc_fee_percentage SET DEFAULT 0.20;

ALTER TABLE organizations
  ALTER COLUMN default_deposit_percentage TYPE NUMERIC(5,4) USING default_deposit_percentage::NUMERIC(5,4),
  ALTER COLUMN default_deposit_percentage SET DEFAULT 0.10;


-- ================================================================
-- SECTION 5: Remove the Phase B migration record
-- ================================================================

DELETE FROM supabase_migrations.schema_migrations
  WHERE name = 'phase_b_internal_billings_and_allocations';


COMMIT;


-- ================================================================
-- VERIFICATION QUERIES (run manually after applying)
-- ================================================================
--
-- 1. Phase B tables gone:
--    SELECT table_name FROM information_schema.tables
--      WHERE table_schema = 'public'
--      AND table_name IN ('internal_billing_types','internal_billings','invoice_allocations');
--    Expected: 0 rows
--
-- 2. Phase B columns gone from jobs:
--    SELECT column_name FROM information_schema.columns
--      WHERE table_name = 'jobs'
--      AND column_name IN ('starting_application_number','previous_certificates_total','previous_change_orders_total');
--    Expected: 0 rows
--
-- 3. Phase B columns gone from draw_line_items:
--    SELECT column_name FROM information_schema.columns
--      WHERE table_name = 'draw_line_items'
--      AND column_name IN ('source_type','internal_billing_id','change_order_id');
--    Expected: 0 rows
--
-- 4. Phase B column gone from change_orders:
--    SELECT column_name FROM information_schema.columns
--      WHERE table_name = 'change_orders' AND column_name = 'application_number';
--    Expected: 0 rows
--
-- 5. gc_fee_rate back to numeric(5,4):
--    SELECT numeric_precision, numeric_scale FROM information_schema.columns
--      WHERE table_name = 'change_orders' AND column_name = 'gc_fee_rate';
--    Expected: 5, 4
--
-- 6. deposit_percentage back to numeric(5,4):
--    SELECT numeric_precision, numeric_scale FROM information_schema.columns
--      WHERE table_name = 'jobs' AND column_name = 'deposit_percentage';
--    Expected: 5, 4
--
-- 7. gc_fee_percentage back to numeric(5,4):
--    SELECT numeric_precision, numeric_scale FROM information_schema.columns
--      WHERE table_name = 'jobs' AND column_name = 'gc_fee_percentage';
--    Expected: 5, 4
--
-- 8. Data reverted to fraction convention:
--    SELECT gc_fee_rate FROM change_orders WHERE gc_fee_rate IS NOT NULL LIMIT 5;
--    Expected: values like 0.1800, 0.1500, 0.0000 (NOT 18.00, 15.00)
--
--    SELECT deposit_percentage, gc_fee_percentage FROM jobs
--      WHERE deposit_percentage IS NOT NULL LIMIT 5;
--    Expected: values like 0.1000, 0.2000 (NOT 10.00, 20.00)
--
--    SELECT default_gc_fee_percentage, default_deposit_percentage FROM organizations LIMIT 3;
--    Expected: values like 0.2000, 0.1000 (NOT 20.00, 10.00)
--
-- 9. Phase B CHECK constraints gone:
--    SELECT conname FROM pg_constraint
--      WHERE conname LIKE 'chk_%' AND conrelid::regclass::text IN ('change_orders','jobs','organizations');
--    Expected: 0 rows (unless other non-Phase-B checks exist)
--
-- 10. Migration record removed:
--     SELECT name FROM supabase_migrations.schema_migrations
--       WHERE name = 'phase_b_internal_billings_and_allocations';
--     Expected: 0 rows
--
-- ===========================================================================
-- OUT OF SCOPE
-- ===========================================================================
-- - change_order_lines table: NOT dropped. Pre-existing table with 11 code
--   references in src/. Zero rows, but schema is part of committed codebase.
-- - retainage_percent (jobs) and default_retainage_percent (organizations):
--   NOT reverted. These were always numeric(5,2) since migrations 00030/00031.
--   Phase B did not change them.
-- - Dewberry draw record data (draw totals, budget baselines): NOT touched.
--   Those are data-layer values, not schema. Will be addressed in Phase D rebuild.
-- - No code changes to src/. This is schema-only.
-- - PROD database (vnpqjderiuhsiiygfwfb): NOT touched. DEV only.
-- ===========================================================================
