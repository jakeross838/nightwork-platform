-- NOT APPLIED — awaiting confirmation from Jake
--
-- DEV-ONLY RESET: nukes tenant transactional data; preserves identity
-- (auth.users, profiles, users, org_members), organizations, workflow
-- settings, and cost_codes reference data.
--
-- Target env: https://egxkffodxcefwpqmwrur.supabase.co  (dev)
-- Prod ref (NEVER run this against):  vnpqjderiuhsiiygfwfb
--
-- Tables in this script were chosen from a live SELECT on pg_tables (see
-- e2e-00-preflight.png for the authoritative before-counts).
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- Sanity guard: verify we're on DEV. If the org pre-seeded as Ross Built
-- is missing OR a prod-only org is present, bail out before touching data.
-- (Commented out by default — Postgres doesn't let us branch on SELECTs
-- inside plain SQL. Kept here for reviewer awareness; the real guard is the
-- NEXT_PUBLIC_SUPABASE_URL check on the wrapper.)
-- SELECT COUNT(*) FROM organizations WHERE slug = 'ross-built';

-- Wipe tenant transactional data. Order handled by CASCADE where FKs require
-- parent-before-child ordering. RESTART IDENTITY resets any serial counters.
TRUNCATE TABLE
  invoice_line_items,
  invoices,
  invoice_import_batches,
  draw_line_items,
  draws,
  budget_lines,
  budgets,
  po_line_items,
  purchase_orders,
  change_order_budget_lines,
  change_order_lines,
  change_orders,
  lien_releases,
  vendors,
  activity_log,
  notifications,
  email_inbox,
  jobs
RESTART IDENTITY CASCADE;

-- Tables intentionally NOT touched:
--   auth.users           — all user accounts stay
--   organizations        — Ross Built (+ any other seeded orgs) preserved
--   profiles             — all 11 rows stay
--   users                — 9 rows (FK target for invoices.assigned_pm_id) stay
--   org_members          — all 11 rows stay
--   org_workflow_settings — Ross Built workflow config preserved
--   cost_codes           — 237 rows reference data preserved
--   org_invites          — invitation tokens preserved
--   api_usage            — operational telemetry, not tenant data
--   subscriptions        — billing state preserved

COMMIT;

-- Storage bucket `invoice-files` is NOT cleared by this script. Supabase
-- storage must be emptied via the storage API (or by hand in the dashboard)
-- if we want a truly clean re-upload path. For this E2E, orphan files are
-- harmless — they won't surface in the UI because the invoices rows that
-- referenced them are gone. Flagging as an item for e2e-findings.md.
