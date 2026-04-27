/**
 * Phase 3.3 Step 3 — /api/cost-intelligence/codes route shape fence.
 *
 * Static structural validation that the org_cost_codes API conforms to the
 * Phase 3.3 contract:
 *   - new namespace under /api/cost-intelligence/codes (NOT /api/cost-codes
 *     which serves the legacy Phase-1 cost_codes table)
 *   - auth gate via getCurrentMembership() (post-Phase-A pattern)
 *   - org scoping on every Supabase query
 *   - PATCH uses updateWithLock for optimistic locking (R.10)
 *   - DELETE soft-deletes via is_active=false (NOT a true delete)
 *   - import endpoint resolves canonical_code text refs against
 *     canonical_cost_codes for the given spine
 *   - legacy /api/cost-codes routes are NOT modified (parallel-deploy)
 *
 * Live RLS coverage is exercised by the QA dogfood checklist (manual
 * curl + cross-org session test). Live happy-path coverage is exercised
 * by the cost-codes admin UI integration smoke test (manual).
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const LIST_ROUTE = "src/app/api/cost-intelligence/codes/route.ts";
const ID_ROUTE = "src/app/api/cost-intelligence/codes/[id]/route.ts";
const IMPORT_ROUTE = "src/app/api/cost-intelligence/codes/import/route.ts";
const UI_PAGE = "src/app/cost-intelligence/codes/page.tsx";
const LEGACY_LIST_ROUTE = "src/app/api/cost-codes/route.ts";
const LEGACY_ID_ROUTE = "src/app/api/cost-codes/[id]/route.ts";
const MIGRATION = "supabase/migrations/00083_org_cost_codes.sql";
const MIGRATION_DOWN = "supabase/migrations/00083_org_cost_codes.down.sql";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

// ── Existence ──────────────────────────────────────────────────
test("list route exists at src/app/api/cost-intelligence/codes/route.ts", () => {
  assert.ok(existsSync(LIST_ROUTE), `missing ${LIST_ROUTE}`);
});
test("id route exists at src/app/api/cost-intelligence/codes/[id]/route.ts", () => {
  assert.ok(existsSync(ID_ROUTE), `missing ${ID_ROUTE}`);
});
test("import route exists at src/app/api/cost-intelligence/codes/import/route.ts", () => {
  assert.ok(existsSync(IMPORT_ROUTE), `missing ${IMPORT_ROUTE}`);
});
test("UI page exists at src/app/cost-intelligence/codes/page.tsx", () => {
  assert.ok(existsSync(UI_PAGE), `missing ${UI_PAGE}`);
});
test("migration 00083 exists with paired down", () => {
  assert.ok(existsSync(MIGRATION), `missing ${MIGRATION}`);
  assert.ok(existsSync(MIGRATION_DOWN), `missing ${MIGRATION_DOWN}`);
});
test("legacy /api/cost-codes routes still exist (parallel-deploy guarantee)", () => {
  assert.ok(existsSync(LEGACY_LIST_ROUTE), `missing ${LEGACY_LIST_ROUTE}`);
  assert.ok(existsSync(LEGACY_ID_ROUTE), `missing ${LEGACY_ID_ROUTE}`);
});

// ── Migration content checks ───────────────────────────────────
const migrationSource = existsSync(MIGRATION) ? readFileSync(MIGRATION, "utf8") : "";
test("migration creates org_cost_codes table with canonical_code_id FK", () => {
  assert.match(
    migrationSource,
    /CREATE TABLE[\s\S]+?org_cost_codes/,
    "migration must CREATE TABLE org_cost_codes"
  );
  assert.match(
    migrationSource,
    /canonical_code_id\s+UUID\s+REFERENCES\s+public\.canonical_cost_codes\(id\)/i,
    "canonical_code_id must FK to canonical_cost_codes(id)"
  );
});
test("migration enforces UNIQUE (org_id, code)", () => {
  assert.match(
    migrationSource,
    /UNIQUE\s*\(\s*org_id\s*,\s*code\s*\)/,
    "must enforce per-org unique code"
  );
});
test("migration enables FORCE RLS (3-policy pattern, no DELETE policy)", () => {
  assert.match(migrationSource, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migrationSource, /FORCE ROW LEVEL SECURITY/);
  assert.match(migrationSource, /CREATE POLICY org_cost_codes_org_read[\s\S]+?FOR SELECT/);
  assert.match(migrationSource, /CREATE POLICY org_cost_codes_org_write[\s\S]+?FOR INSERT/);
  assert.match(migrationSource, /CREATE POLICY org_cost_codes_org_update[\s\S]+?FOR UPDATE/);
  // Per cost_intelligence_spine 00052 precedent + R.23: no explicit DELETE
  // policy. Soft-delete via is_active=false UPDATE goes through UPDATE policy.
  assert.ok(
    !/CREATE POLICY[\s\S]+?org_cost_codes[\s\S]+?FOR DELETE/.test(migrationSource),
    "must NOT have explicit DELETE policy (mirror cost_intelligence_spine 00052 — RLS blocks deletes by default)"
  );
});
test("migration installs updated_at trigger for optimistic locking", () => {
  assert.match(migrationSource, /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION[\s\S]+?org_cost_codes_set_updated_at/i);
  assert.match(migrationSource, /CREATE TRIGGER[\s\S]+?org_cost_codes_updated_at_trigger/i);
});

// ── List route checks ──────────────────────────────────────────
const listSource = existsSync(LIST_ROUTE) ? readFileSync(LIST_ROUTE, "utf8") : "";
test("list route uses getCurrentMembership (post-Phase-A pattern)", () => {
  assert.match(
    listSource,
    /import\s*\{[^}]*getCurrentMembership[^}]*\}\s*from\s*['"]@\/lib\/org\/session['"]/
  );
});
test("list route does NOT use requireOrgId (legacy pattern)", () => {
  assert.ok(!/requireOrgId/.test(listSource));
});
test("list route filters by .eq('org_id', membership.org_id)", () => {
  assert.match(listSource, /\.eq\(\s*['"]org_id['"]\s*,\s*membership\.org_id\s*\)/);
});
test("list route hits org_cost_codes table (not legacy cost_codes)", () => {
  assert.match(listSource, /\.from\(\s*['"]org_cost_codes['"]\s*\)/);
  assert.ok(!/\.from\(\s*['"]cost_codes['"]\s*\)/.test(listSource));
});
test("list route returns 401 on missing membership", () => {
  assert.match(listSource, /(?:status:\s*401|"Not authenticated")/);
});

// ── ID route checks ────────────────────────────────────────────
const idSource = existsSync(ID_ROUTE) ? readFileSync(ID_ROUTE, "utf8") : "";
test("PATCH uses updateWithLock for optimistic locking (R.10)", () => {
  assert.match(idSource, /import\s*\{[^}]*updateWithLock[^}]*\}\s*from\s*['"]@\/lib\/api\/optimistic-lock['"]/);
  assert.match(idSource, /updateWithLock</);
});
test("PATCH passes orgId to updateWithLock", () => {
  assert.match(idSource, /orgId:\s*membership\.org_id/);
});
test("PATCH expects expected_updated_at in body", () => {
  assert.match(idSource, /expected_updated_at/);
});
test("DELETE soft-deletes via is_active=false (no real delete)", () => {
  assert.match(idSource, /\.update\(\s*\{\s*is_active:\s*false\s*\}\s*\)/);
  assert.ok(
    !/\.delete\(\)/.test(idSource),
    "DELETE handler must NOT call .delete() — soft-delete only via is_active=false"
  );
});

// ── Import route checks ────────────────────────────────────────
const importSource = existsSync(IMPORT_ROUTE) ? readFileSync(IMPORT_ROUTE, "utf8") : "";
test("import route resolves canonical_code text refs to canonical_cost_codes", () => {
  assert.match(importSource, /\.from\(\s*['"]canonical_cost_codes['"]\s*\)/);
  assert.match(importSource, /\.eq\(\s*['"]spine['"]\s*,/);
});
test("import route enforces 5000-row limit (defense-in-depth)", () => {
  assert.match(importSource, /5000/);
});
test("import route returns unmapped_canonical for visibility", () => {
  assert.match(importSource, /unmapped_canonical/);
});

// ── Legacy untouched ───────────────────────────────────────────
const legacyListSource = existsSync(LEGACY_LIST_ROUTE) ? readFileSync(LEGACY_LIST_ROUTE, "utf8") : "";
test("legacy /api/cost-codes still queries cost_codes (NOT org_cost_codes)", () => {
  assert.match(legacyListSource, /\.from\(\s*['"]cost_codes['"]\s*\)/);
  assert.ok(!/org_cost_codes/.test(legacyListSource));
});

// ── Runner ─────────────────────────────────────────────────────
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
