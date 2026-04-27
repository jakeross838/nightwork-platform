-- Down migration for 00082_canonical_cost_codes.sql
--
-- Drops the canonical_cost_codes table. Because the table is referenced by
-- org_cost_codes.canonical_code_id (added in migration 00083), this down
-- migration MUST run before 00083's down — Supabase migration tooling
-- enforces order, so this is correct as long as down migrations are run in
-- reverse order.
--
-- All indexes, policies, and the seed data go away with the table. There is
-- no per-tenant data here, so no application-level damage.

DROP POLICY IF EXISTS canonical_cost_codes_read_all_authenticated ON canonical_cost_codes;
DROP TABLE IF EXISTS canonical_cost_codes;
