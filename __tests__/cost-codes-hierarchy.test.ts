/**
 * Phase 2.4 regression fence — R.15.
 *
 * Migration 00068 adds three columns to `public.cost_codes`
 * (`parent_id`, `is_allowance`, `default_allowance_amount`) plus a
 * hierarchy validation trigger in `app_private` (enforces Part 2 §1.3's
 * 3-tier depth cap + cycle prevention on adjacency-list parent chains)
 * with explicit `GRANT EXECUTE` to `authenticated` (mirrors 00067's
 * pattern; defends against the GH #9 class of bug). A new system
 * `public.cost_code_templates` table lands alongside, adopting the
 * `unit_conversion_templates` (00054) precedent — 2-policy RLS
 * (authenticated SELECT + platform_admin ALL), no `org_id`, minimal
 * audit columns. Seed is idempotent via `UNIQUE (name)` + `ON CONFLICT
 * (name) DO NOTHING`.
 *
 * Scope notes (from amended plan / pre-flight qa-reports/preflight-
 * branch2-phase2.4.md):
 * - `cost_code_templates.codes` JSONB lands as `'{}'::jsonb` placeholders
 *   for all 4 system templates. Real JSONB bodies + route cutover ship
 *   in Phase 7.5 (GH #11).
 * - `is_allowance` now exists at both the cost_codes (template-default)
 *   and budget_lines (instance-override) layers. Branch 4 UI work
 *   clarifies the hierarchy (GH #10).
 * - `TEMPLATE_ORG_ID` read-bypass in the cost_codes RLS policy stays
 *   intact in Phase 2.4 — Phase 7.5 owns the cutover (GH #11).
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

const MIGRATION = "supabase/migrations/00068_cost_codes_hierarchy.sql";
const MIGRATION_DOWN =
  "supabase/migrations/00068_cost_codes_hierarchy.down.sql";
const TEMPLATE_ROUTE = "src/app/api/cost-codes/template/route.ts";

const TEMPLATE_NAMES = [
  "Custom Home Builder (Simplified)",
  "Remodeler (Simplified)",
  "CSI MasterFormat (Full)",
  "Empty — build your own",
];

// ── migration file existence ─────────────────────────────────────────

test("migration 00068 exists", () => {
  assert.ok(existsSync(MIGRATION), `${MIGRATION} missing`);
});

test("migration 00068 has a rollback companion (.down.sql)", () => {
  assert.ok(existsSync(MIGRATION_DOWN), `${MIGRATION_DOWN} missing`);
});

// ── cost_codes column additions ──────────────────────────────────────

test("migration 00068 adds cost_codes.parent_id as nullable UUID with self-FK", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ALTER\s+TABLE\s+public\.cost_codes[\s\S]*?ADD\s+COLUMN\s+parent_id\s+UUID\s+REFERENCES\s+public\.cost_codes\s*\(\s*id\s*\)/i.test(
      src
    ),
    "migration must ADD COLUMN parent_id UUID REFERENCES public.cost_codes(id)"
  );
  // Explicitly nullable: no NOT NULL next to parent_id
  assert.ok(
    !/parent_id\s+UUID\s+NOT\s+NULL/i.test(src),
    "cost_codes.parent_id must stay nullable (root-level rows)"
  );
});

test("migration 00068 adds cost_codes.is_allowance NOT NULL BOOLEAN DEFAULT FALSE", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ADD\s+COLUMN\s+is_allowance\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+FALSE/i.test(
      src
    ),
    "migration must ADD COLUMN is_allowance BOOLEAN NOT NULL DEFAULT FALSE"
  );
});

test("migration 00068 adds cost_codes.default_allowance_amount BIGINT (nullable)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ADD\s+COLUMN\s+default_allowance_amount\s+BIGINT\b/i.test(src),
    "migration must ADD COLUMN default_allowance_amount BIGINT"
  );
  // Nullable: no NOT NULL following default_allowance_amount
  assert.ok(
    !/default_allowance_amount\s+BIGINT\s+NOT\s+NULL/i.test(src),
    "default_allowance_amount must stay nullable (optional allowance hint)"
  );
});

// ── header documentation (Amendments C, D, B per plan commit 95df1b4) ──

test("migration 00068 header documents is_allowance naming collision (Amendment D / GH #10)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /is_allowance/.test(src) && /budget_lines/i.test(src),
    "migration header must reference both cost_codes.is_allowance and budget_lines.is_allowance to document the two-layer semantic"
  );
  assert.ok(
    /GH\s*#10|issue\s*#10/i.test(src),
    "migration header must reference GH #10"
  );
});

test("migration 00068 header documents Phase 7.5 TEMPLATE_ORG_ID cutover deferral (Amendment C / GH #11)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /TEMPLATE_ORG_ID/.test(src),
    "migration header must reference TEMPLATE_ORG_ID to document the deferred cutover"
  );
  assert.ok(
    /Phase\s*7\.5/i.test(src) && /GH\s*#11|issue\s*#11/i.test(src),
    "migration header must cite Phase 7.5 ownership + GH #11"
  );
});

test("migration 00068 header documents R.23 accepted divergence for cost_code_templates audit columns (Amendment B)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /unit_conversion_templates|00054/i.test(src),
    "migration header must cite the unit_conversion_templates / 00054 precedent"
  );
  assert.ok(
    /R\.23/i.test(src),
    "migration header must invoke R.23 accepted-divergence framing"
  );
});

// ── hierarchy validation trigger + function ──────────────────────────

test("migration 00068 defines app_private.validate_cost_code_hierarchy function", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+app_private\.validate_cost_code_hierarchy\s*\(/i.test(
      src
    ),
    "migration must CREATE OR REPLACE FUNCTION app_private.validate_cost_code_hierarchy()"
  );
});

test("migration 00068 validation function is SECURITY DEFINER with SET search_path", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const fnMatch = src.match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+app_private\.validate_cost_code_hierarchy[\s\S]*?\$\$\s*;/i
  );
  assert.ok(fnMatch, "could not locate the full function body");
  const body = fnMatch![0];
  assert.ok(
    /SECURITY\s+DEFINER/i.test(body),
    "validate_cost_code_hierarchy must be SECURITY DEFINER"
  );
  assert.ok(
    /SET\s+search_path\s*=\s*public/i.test(body),
    "validate_cost_code_hierarchy must SET search_path = public"
  );
});

test("migration 00068 grants EXECUTE on validate_cost_code_hierarchy to authenticated (GH #9 defense)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+app_private\.validate_cost_code_hierarchy\s*\(\s*\)\s+TO\s+authenticated/i.test(
      src
    ),
    "migration must GRANT EXECUTE ON FUNCTION app_private.validate_cost_code_hierarchy() TO authenticated"
  );
});

test("migration 00068 registers trg_cost_codes_hierarchy BEFORE INSERT OR UPDATE OF parent_id", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TRIGGER\s+trg_cost_codes_hierarchy\s+BEFORE\s+INSERT\s+OR\s+UPDATE\s+OF\s+parent_id\s+ON\s+public\.cost_codes\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+app_private\.validate_cost_code_hierarchy\s*\(\s*\)/is.test(
      src
    ),
    "migration must CREATE TRIGGER trg_cost_codes_hierarchy BEFORE INSERT OR UPDATE OF parent_id"
  );
});

test("migration 00068 validation function checks cycles AND depth > 3", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const fnMatch = src.match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+app_private\.validate_cost_code_hierarchy[\s\S]*?\$\$\s*;/i
  );
  assert.ok(fnMatch, "function body not found");
  const body = fnMatch![0];
  assert.ok(
    /cycle/i.test(body),
    "function body must raise on cycle (keyword 'cycle' in error message)"
  );
  assert.ok(
    /3\s+tiers|>\s*3|depth\s+%/i.test(body),
    "function body must raise on depth > 3"
  );
  assert.ok(
    /RAISE\s+EXCEPTION/i.test(body),
    "function body must contain RAISE EXCEPTION"
  );
});

// ── cost_code_templates table + RLS (Amendment B — 00054 precedent) ──

test("migration 00068 creates public.cost_code_templates with all 7 columns", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.cost_code_templates\s*\(/i.test(
      src
    ),
    "migration must CREATE TABLE public.cost_code_templates"
  );
  const match = src.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.cost_code_templates\s*\(([\s\S]*?)\n\)\s*;/i
  );
  assert.ok(match, "could not locate cost_code_templates CREATE body");
  const body = match![1];
  const required = [
    /\bid\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\s*\(\s*\)/i,
    /\bname\s+TEXT\s+NOT\s+NULL/i,
    /\bdescription\s+TEXT\b/i,
    /\bis_system\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+FALSE/i,
    /\bcodes\s+JSONB\s+NOT\s+NULL/i,
    /\bcreated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i,
    /\bupdated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i,
  ];
  for (const re of required) {
    assert.ok(
      re.test(body),
      `cost_code_templates body must contain column definition matching ${re}`
    );
  }
});

test("migration 00068 declares UNIQUE (name) on cost_code_templates", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /UNIQUE\s*\(\s*name\s*\)/i.test(src),
    "migration must declare UNIQUE (name) on cost_code_templates for idempotent seeding"
  );
});

test("migration 00068 registers trg_cost_code_templates_updated_at trigger", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TRIGGER\s+trg_cost_code_templates_updated_at\s+BEFORE\s+UPDATE\s+ON\s+public\.cost_code_templates\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.update_updated_at\s*\(\s*\)/is.test(
      src
    ),
    "migration must register trg_cost_code_templates_updated_at using public.update_updated_at()"
  );
});

test("migration 00068 enables RLS on cost_code_templates", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ALTER\s+TABLE\s+public\.cost_code_templates\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(
      src
    ),
    "migration must ENABLE ROW LEVEL SECURITY on cost_code_templates"
  );
});

test("migration 00068 creates exactly the 2 policies from the 00054 precedent — cct_read and cct_platform_admin_write", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+POLICY\s+cct_read\s+ON\s+public\.cost_code_templates\s+FOR\s+SELECT/i.test(
      src
    ),
    "migration must CREATE POLICY cct_read ON public.cost_code_templates FOR SELECT"
  );
  assert.ok(
    /CREATE\s+POLICY\s+cct_platform_admin_write\s+ON\s+public\.cost_code_templates\s+FOR\s+ALL/i.test(
      src
    ),
    "migration must CREATE POLICY cct_platform_admin_write ON public.cost_code_templates FOR ALL"
  );
  // Regression guard: only 2 CREATE POLICY statements targeting this table.
  const policyMatches = src.match(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.cost_code_templates\s+FOR\s+\w+/gi
  );
  assert.ok(
    policyMatches && policyMatches.length === 2,
    `migration must define exactly 2 policies on cost_code_templates (found ${policyMatches?.length ?? 0})`
  );
});

test("migration 00068 policy predicates: cct_read uses auth.uid() IS NOT NULL; platform_admin uses is_platform_admin()", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /auth\.uid\s*\(\s*\)\s+IS\s+NOT\s+NULL/i.test(src),
    "cct_read predicate must use auth.uid() IS NOT NULL"
  );
  assert.ok(
    /app_private\.is_platform_admin\s*\(\s*\)/i.test(src),
    "cct_platform_admin_write predicate must use app_private.is_platform_admin()"
  );
});

// ── seeded templates ─────────────────────────────────────────────────

test("migration 00068 seeds 4 system templates by name with ON CONFLICT (name) DO NOTHING", () => {
  const src = readFileSync(MIGRATION, "utf8");
  for (const n of TEMPLATE_NAMES) {
    // Escape the em-dash for regex safety; use string contains
    assert.ok(
      src.includes(`'${n}'`),
      `migration seed must include template name '${n}'`
    );
  }
  assert.ok(
    /ON\s+CONFLICT\s*\(\s*name\s*\)\s+DO\s+NOTHING/i.test(src),
    "seed INSERT must include ON CONFLICT (name) DO NOTHING for idempotency"
  );
});

test("migration 00068 seed uses '{}'::jsonb placeholders for codes bodies (Phase 7.5 owns real data)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Match the 4 placeholder occurrences within the seed block
  const seedBlock = src.match(
    /INSERT\s+INTO\s+public\.cost_code_templates[\s\S]*?ON\s+CONFLICT/i
  );
  assert.ok(seedBlock, "seed block not found");
  const body = seedBlock![0];
  const placeholderMatches = body.match(/'\{\}'::jsonb/g) ?? [];
  assert.ok(
    placeholderMatches.length === 4,
    `seed body should have 4 '{}'::jsonb placeholders (found ${placeholderMatches.length})`
  );
});

// ── public. schema qualification (G.9) ───────────────────────────────

test("migration 00068 uses public. schema qualification on every DDL target", () => {
  const raw = readFileSync(MIGRATION, "utf8");
  // Strip line comments so narrative doesn't false-positive.
  const stripped = raw.replace(/--.*$/gm, "");
  const suspects = [
    /\bALTER\s+TABLE\s+cost_codes\b/i,
    /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?cost_code_templates\b/i,
    /\bINSERT\s+INTO\s+cost_code_templates\b/i,
    /\bREFERENCES\s+cost_codes\s*\(/i,
    /\bENABLE\s+ROW\s+LEVEL\s+SECURITY\s*$/im, // without schema
  ];
  for (const re of suspects) {
    assert.ok(
      !re.test(stripped),
      `found unqualified DDL/DML reference matching ${re} — every target must use public. prefix (G.9)`
    );
  }
});

// ── down migration ───────────────────────────────────────────────────

test("down migration drops template-table policies + RLS + trigger + table, then function + trigger + columns in reverse order", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");
  // Templates cleanup
  assert.ok(
    /DROP\s+POLICY\s+IF\s+EXISTS\s+cct_platform_admin_write\s+ON\s+public\.cost_code_templates/i.test(
      src
    ),
    "down must DROP POLICY cct_platform_admin_write first"
  );
  assert.ok(
    /DROP\s+POLICY\s+IF\s+EXISTS\s+cct_read\s+ON\s+public\.cost_code_templates/i.test(
      src
    ),
    "down must DROP POLICY cct_read"
  );
  assert.ok(
    /DROP\s+TRIGGER\s+IF\s+EXISTS\s+trg_cost_code_templates_updated_at/i.test(
      src
    ),
    "down must DROP TRIGGER trg_cost_code_templates_updated_at"
  );
  assert.ok(
    /DROP\s+TABLE\s+IF\s+EXISTS\s+public\.cost_code_templates/i.test(src),
    "down must DROP TABLE public.cost_code_templates"
  );
  // Hierarchy cleanup
  assert.ok(
    /DROP\s+TRIGGER\s+IF\s+EXISTS\s+trg_cost_codes_hierarchy/i.test(src),
    "down must DROP TRIGGER trg_cost_codes_hierarchy"
  );
  assert.ok(
    /DROP\s+FUNCTION\s+IF\s+EXISTS\s+app_private\.validate_cost_code_hierarchy/i.test(
      src
    ),
    "down must DROP FUNCTION app_private.validate_cost_code_hierarchy"
  );
  // Columns dropped in reverse order
  const colOrder = [
    /DROP\s+COLUMN\s+IF\s+EXISTS\s+default_allowance_amount/i,
    /DROP\s+COLUMN\s+IF\s+EXISTS\s+is_allowance/i,
    /DROP\s+COLUMN\s+IF\s+EXISTS\s+parent_id/i,
  ];
  let lastIdx = -1;
  for (const re of colOrder) {
    const idx = src.search(re);
    assert.ok(idx >= 0, `down must include ${re}`);
    assert.ok(
      idx > lastIdx,
      `down must drop columns in reverse order; ${re} must follow previous drop`
    );
    lastIdx = idx;
  }
});

// ── TEMPLATE_ORG_ID regression guard (Amendment C — Phase 2.4 doesn't cut over) ──

test(`${TEMPLATE_ROUTE} still points TEMPLATE_ORG_ID at the Ross Built org (Phase 7.5 cutover; GH #11)`, () => {
  const src = readFileSync(TEMPLATE_ROUTE, "utf8");
  assert.ok(
    /TEMPLATE_ORG_ID\s*=\s*["']00000000-0000-0000-0000-000000000001["']/.test(
      src
    ),
    `${TEMPLATE_ROUTE} must still define TEMPLATE_ORG_ID = "00000000-0000-0000-0000-000000000001" — Phase 7.5 owns the cutover (GH #11). This is a regression guard.`
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
