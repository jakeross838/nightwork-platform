/**
 * Phase 1.5 regression fence — R.15.
 *
 * Migration 00063 adds `waived_at TIMESTAMPTZ` to `lien_releases`. The two
 * write paths that can flip status to 'waived' must both stamp `waived_at`:
 *
 *   1. PATCH /api/lien-releases/[id] — single-release edit. Stamps only on
 *      the pending→waived transition (existing.status !== 'waived'), to
 *      match the received_at precedent in the same file.
 *   2. POST /api/lien-releases/bulk with action='waive' — bulk "Waive All"
 *      button on the draw detail page. Stamps unconditionally, to match the
 *      bulk received_at precedent in the same file.
 *
 * This test locks those behaviors in place + guards the pre-existing
 * received_at stamps against accidental removal.
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

const MIGRATION = "supabase/migrations/00063_lien_release_waived_at.sql";
const MIGRATION_DOWN = "supabase/migrations/00063_lien_release_waived_at.down.sql";
const PATCH_ROUTE = "src/app/api/lien-releases/[id]/route.ts";
const BULK_ROUTE = "src/app/api/lien-releases/bulk/route.ts";

// ── migration 00063 ──────────────────────────────────────────────────

test("migration 00063 exists", () => {
  assert.ok(existsSync(MIGRATION), `${MIGRATION} missing`);
});

test("migration 00063 adds nullable waived_at TIMESTAMPTZ to lien_releases", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ALTER\s+TABLE\s+public\.lien_releases[\s\S]{0,200}ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+waived_at\s+TIMESTAMPTZ/i.test(src),
    "migration must ADD COLUMN IF NOT EXISTS waived_at TIMESTAMPTZ on public.lien_releases"
  );
});

test("migration 00063 has a rollback companion (.down.sql)", () => {
  assert.ok(existsSync(MIGRATION_DOWN), `${MIGRATION_DOWN} missing`);
  const src = readFileSync(MIGRATION_DOWN, "utf8");
  assert.ok(
    /DROP\s+COLUMN\s+IF\s+EXISTS\s+waived_at/i.test(src),
    "rollback must DROP COLUMN IF EXISTS waived_at"
  );
});

// ── PATCH route (single) ─────────────────────────────────────────────

test(`${PATCH_ROUTE} stamps received_at on pending→received (regression guard)`, () => {
  const src = readFileSync(PATCH_ROUTE, "utf8");
  assert.ok(
    /body\.status\s*===\s*["']received["'][\s\S]{0,80}existing\.status\s*!==\s*["']received["'][\s\S]{0,80}updates\.received_at\s*=\s*new Date/.test(src),
    "PATCH route must stamp received_at only on the pending→received transition"
  );
});

test(`${PATCH_ROUTE} stamps waived_at on pending→waived`, () => {
  const src = readFileSync(PATCH_ROUTE, "utf8");
  assert.ok(
    /body\.status\s*===\s*["']waived["'][\s\S]{0,80}existing\.status\s*!==\s*["']waived["'][\s\S]{0,80}updates\.waived_at\s*=\s*new Date/.test(src),
    "PATCH route must stamp waived_at only on the pending→waived transition"
  );
});

test(`${PATCH_ROUTE} docstring mentions the waived_at stamp`, () => {
  const src = readFileSync(PATCH_ROUTE, "utf8");
  // Pull the first JSDoc block and verify it documents the new behavior so
  // future readers see both stamps side by side.
  const doc = src.match(/\/\*\*[\s\S]*?\*\//)?.[0] ?? "";
  assert.ok(
    /waived/i.test(doc) && /waived_at/i.test(doc),
    "PATCH route JSDoc must document the waived_at stamp alongside received_at"
  );
});

// ── bulk route ────────────────────────────────────────────────────────

test(`${BULK_ROUTE} stamps received_at on bulk mark_received (regression guard)`, () => {
  const src = readFileSync(BULK_ROUTE, "utf8");
  assert.ok(
    /action\s*===\s*["']mark_received["'][\s\S]{0,200}updates\.received_at\s*=\s*new Date/.test(src),
    "bulk route must stamp received_at on action='mark_received'"
  );
});

test(`${BULK_ROUTE} stamps waived_at on bulk waive`, () => {
  const src = readFileSync(BULK_ROUTE, "utf8");
  assert.ok(
    /action\s*===\s*["']waive["'][\s\S]{0,200}updates\.waived_at\s*=\s*new Date/.test(src),
    "bulk route must stamp waived_at on action='waive'"
  );
});

test(`${BULK_ROUTE} still sets status='waived' on bulk waive (regression guard)`, () => {
  const src = readFileSync(BULK_ROUTE, "utf8");
  assert.ok(
    /action\s*===\s*["']waive["'][\s\S]{0,200}updates\.status\s*=\s*["']waived["']/.test(src),
    "bulk route must still set status='waived' on action='waive'"
  );
});

// ── runner ────────────────────────────────────────────────────────────

let failed = 0;
for (const c of cases) {
  try {
    c.fn();
    console.log(`PASS  ${c.name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${c.name}`);
    console.log(`      ${e instanceof Error ? e.message : String(e)}`);
  }
}
console.log("");
if (failed > 0) {
  console.error(`${failed} of ${cases.length} test(s) failed`);
  process.exit(1);
} else {
  console.log(`${cases.length} test(s) passed`);
}
