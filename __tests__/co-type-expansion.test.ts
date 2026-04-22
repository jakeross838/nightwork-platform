/**
 * Phase 2.3 regression fence — R.15.
 *
 * Migration 00066 expands `change_orders.co_type` from the legacy 2-value
 * CHECK (`'owner'`, `'internal'`) to a 5-value set (`'owner_requested'`,
 * `'designer_architect'`, `'allowance_overage'`, `'site_condition'`,
 * `'internal'`); data-migrates the 73 live + 15 soft-deleted `'owner'`
 * rows to `'owner_requested'`; drops then re-sets the column default
 * (Amendment A, because the live default `'owner'` becomes invalid
 * against the new CHECK); rewrites the live
 * `app_private.refresh_approved_cos_total` predicate from
 * `co_type = 'owner'` to `co_type <> 'internal'` (Amendment B, because 4
 * of 5 new types raise contract; only `internal` does not); runs a
 * one-time cache backfill over every live job; and aborts via RAISE
 * EXCEPTION if the post-backfill SUM of `jobs.approved_cos_total`
 * diverges from the pre-migration invariant of 90104565 cents
 * ($901,045.65 — captured in pre-flight S7).
 *
 * Scope expansion (Amendment C): this commit also rewrites 6
 * application-layer filter sites that hardcode `co_type === 'owner'`
 * with contract-raising semantics to `co_type !== 'internal'`; updates
 * the API default from `?? "owner"` to `?? "owner_requested"`; widens 2
 * TS body unions from `"owner" | "internal"` to `string` with runtime
 * validation against a file-private `CO_TYPES` constant (Phase 2.1
 * `CONTRACT_TYPES` precedent at src/app/api/jobs/route.ts:16); and
 * widens the new-CO form state from the 2-value union to the full
 * 5-value union with a picker UI that exposes all 5 values.
 *
 * UI display labels/badges (src/app/change-orders/[id]/page.tsx:170 +
 * src/app/jobs/[id]/change-orders/page.tsx:260) are deferred to
 * Branch 4 per GH #7 — not asserted here.
 *
 * Paired .down.sql per R.16 restores the legacy predicate, drops the
 * new columns in reverse order, reverse-maps `'owner_requested'` →
 * `'owner'`, restores the legacy default and 2-value CHECK, and
 * re-runs the cache backfill. Mirrors Phase 2.1's loud-fail posture:
 * if any designer_architect / allowance_overage / site_condition rows
 * exist at rollback time, the restored CHECK violates intentionally.
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

const MIGRATION = "supabase/migrations/00066_co_type_expansion.sql";
const MIGRATION_DOWN = "supabase/migrations/00066_co_type_expansion.down.sql";

const CREATE_CO_ROUTE = "src/app/api/jobs/[id]/change-orders/route.ts";
const PATCH_CO_ROUTE = "src/app/api/change-orders/[id]/route.ts";
const NEW_CO_PAGE = "src/app/jobs/[id]/change-orders/new/page.tsx";
const RECALC_LIB = "src/lib/recalc.ts";
const DRAW_CALC_LIB = "src/lib/draw-calc.ts";
const DRAWS_PREVIEW_ROUTE = "src/app/api/draws/preview/route.ts";
const DRAWS_COMPARE_ROUTE = "src/app/api/draws/[id]/compare/route.ts";
const INTEGRITY_CHECK_ROUTE = "src/app/api/admin/integrity-check/route.ts";

const NEW_CO_TYPES = [
  "owner_requested",
  "designer_architect",
  "allowance_overage",
  "site_condition",
  "internal",
];

// Values that are no longer valid under the new CHECK — negative probes
// against the migration text and against application code.
const INVALID_UNDER_NEW_CHECK = [
  "foobar",
  "owner", // the legacy value must not appear in the new CHECK
  "partial_payment",
  "retention",
];

// ── migration 00066 — file existence + flag-E sequencing ─────────────

test("migration 00066 exists", () => {
  assert.ok(existsSync(MIGRATION), `${MIGRATION} missing`);
});

test("migration 00066 has a rollback companion (.down.sql)", () => {
  assert.ok(existsSync(MIGRATION_DOWN), `${MIGRATION_DOWN} missing`);
});

test("migration 00066 drops the legacy CHECK before the data UPDATE (flag-E sequencing)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const dropIdx = src.search(
    /ALTER\s+TABLE\s+public\.change_orders\s+DROP\s+CONSTRAINT\s+change_orders_co_type_check/i
  );
  const updateIdx = src.search(
    /UPDATE\s+public\.change_orders\s+SET\s+co_type\s*=\s*'owner_requested'/i
  );
  assert.ok(dropIdx >= 0, "DROP CONSTRAINT change_orders_co_type_check must be present");
  assert.ok(
    updateIdx >= 0,
    "UPDATE public.change_orders SET co_type='owner_requested' must be present"
  );
  assert.ok(
    dropIdx < updateIdx,
    "DROP CONSTRAINT must precede the data UPDATE (flag-E sequencing)"
  );
});

test("migration 00066 drops the stale 'owner' DEFAULT before the UPDATE (Amendment A)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const dropDefaultIdx = src.search(
    /ALTER\s+TABLE\s+public\.change_orders\s+ALTER\s+COLUMN\s+co_type\s+DROP\s+DEFAULT/i
  );
  const updateIdx = src.search(
    /UPDATE\s+public\.change_orders\s+SET\s+co_type\s*=\s*'owner_requested'/i
  );
  assert.ok(
    dropDefaultIdx >= 0,
    "migration must DROP DEFAULT on co_type before the UPDATE (Amendment A)"
  );
  assert.ok(
    dropDefaultIdx < updateIdx,
    "DROP DEFAULT must precede the data UPDATE (Amendment A sequencing)"
  );
});

test("migration 00066 maps 'owner' → 'owner_requested'", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /UPDATE\s+public\.change_orders\s+SET\s+co_type\s*=\s*'owner_requested'\s+WHERE\s+co_type\s*=\s*'owner'/is.test(
      src
    ),
    "migration must UPDATE co_type='owner_requested' WHERE co_type='owner'"
  );
});

test("migration 00066 re-sets DEFAULT to 'owner_requested' after the UPDATE (Amendment A)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const setDefaultIdx = src.search(
    /ALTER\s+TABLE\s+public\.change_orders\s+ALTER\s+COLUMN\s+co_type\s+SET\s+DEFAULT\s+'owner_requested'/i
  );
  const updateIdx = src.search(
    /UPDATE\s+public\.change_orders\s+SET\s+co_type\s*=\s*'owner_requested'/i
  );
  const addCheckIdx = src.search(
    /ADD\s+CONSTRAINT\s+change_orders_co_type_check\s+CHECK/i
  );
  assert.ok(setDefaultIdx >= 0, "migration must SET DEFAULT 'owner_requested' on co_type");
  assert.ok(
    setDefaultIdx > updateIdx,
    "SET DEFAULT 'owner_requested' must follow the data UPDATE"
  );
  assert.ok(
    setDefaultIdx < addCheckIdx,
    "SET DEFAULT 'owner_requested' must precede the new CHECK (so the default is valid when the CHECK lands)"
  );
});

test("migration 00066 installs the new 5-value co_type CHECK over the fully migrated data", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ADD\s+CONSTRAINT\s+change_orders_co_type_check\s+CHECK\s*\(\s*co_type\s+IN\s*\(/i.test(src),
    "migration must ADD CONSTRAINT change_orders_co_type_check with CHECK (co_type IN (...))"
  );
  for (const v of NEW_CO_TYPES) {
    assert.ok(
      src.includes(`'${v}'`),
      `migration must reference co_type value '${v}' inside the new CHECK`
    );
  }
  // Negative guards against values that must not appear in the new CHECK
  const addCheckMatch = src.match(
    /ADD\s+CONSTRAINT\s+change_orders_co_type_check\s+CHECK\s*\(\s*co_type\s+IN\s*\(([^)]*)\)\s*\)/i
  );
  assert.ok(addCheckMatch, "could not locate the ADD CONSTRAINT ... CHECK (co_type IN (...))");
  const checkBody = addCheckMatch![1];
  assert.ok(
    !/'owner'\s*(,|$)/.test(checkBody),
    "the new CHECK must not contain the legacy bare 'owner' value"
  );
});

// ── migration 00066 — added columns ──────────────────────────────────

test("migration 00066 adds change_orders.pricing_mode with 3-value CHECK + default 'hard_priced'", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ADD\s+COLUMN\s+pricing_mode\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'hard_priced'\s+CHECK\s*\(\s*pricing_mode\s+IN\s*\(\s*'hard_priced'\s*,\s*'budgetary'\s*,\s*'allowance_split'\s*\)\s*\)/i.test(
      src
    ),
    "migration must ADD COLUMN pricing_mode TEXT NOT NULL DEFAULT 'hard_priced' CHECK (pricing_mode IN ('hard_priced','budgetary','allowance_split'))"
  );
});

test("migration 00066 adds change_orders.source_proposal_id UUID REFERENCES public.proposals(id)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ADD\s+COLUMN\s+source_proposal_id\s+UUID\s+REFERENCES\s+public\.proposals\s*\(\s*id\s*\)/i.test(
      src
    ),
    "migration must ADD COLUMN source_proposal_id UUID REFERENCES public.proposals(id)"
  );
});

test("migration 00066 adds change_orders.reason TEXT", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ADD\s+COLUMN\s+reason\s+TEXT/i.test(src),
    "migration must ADD COLUMN reason TEXT on change_orders"
  );
});

test("migration 00066 adds change_order_lines.created_po_id UUID REFERENCES public.purchase_orders(id)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ALTER\s+TABLE\s+public\.change_order_lines\s+ADD\s+COLUMN\s+created_po_id\s+UUID\s+REFERENCES\s+public\.purchase_orders\s*\(\s*id\s*\)/is.test(
      src
    ),
    "migration must ALTER TABLE public.change_order_lines ADD COLUMN created_po_id UUID REFERENCES public.purchase_orders(id)"
  );
});

// ── migration 00066 — predicate rewrite + backfill + verification ────

test("migration 00066 rewrites app_private.refresh_approved_cos_total to use co_type <> 'internal' (Amendment B)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+app_private\.refresh_approved_cos_total\s*\(/i.test(src),
    "migration must CREATE OR REPLACE FUNCTION app_private.refresh_approved_cos_total"
  );
  assert.ok(
    /co_type\s*<>\s*'internal'/i.test(src),
    "migration must install the predicate co_type <> 'internal' in the rewritten function"
  );
  // Regression guard: the legacy predicate must not survive in the new body
  // (we still allow it inside the down.sql, but not in the up migration).
  const fnMatch = src.match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+app_private\.refresh_approved_cos_total[\s\S]*?\$\$\s*;/i
  );
  assert.ok(
    fnMatch,
    "could not locate the full CREATE OR REPLACE FUNCTION body inside the up migration"
  );
  const fnBody = fnMatch![0];
  assert.ok(
    !/co_type\s*=\s*'owner'/i.test(fnBody),
    "rewritten function body must not contain the legacy predicate co_type = 'owner'"
  );
});

test("migration 00066 runs a one-time cache backfill over every live job", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Match a DO block that loops jobs and PERFORMs refresh_approved_cos_total
  assert.ok(
    /DO\s+\$\$[\s\S]*?FOR\s+\w+\s+IN\s+SELECT\s+id\s+FROM\s+public\.jobs\s+WHERE\s+deleted_at\s+IS\s+NULL[\s\S]*?PERFORM\s+app_private\.refresh_approved_cos_total\s*\(/is.test(
      src
    ),
    "migration must include a DO block that loops public.jobs (deleted_at IS NULL) and PERFORMs app_private.refresh_approved_cos_total"
  );
});

test("migration 00066 verification probe asserts post-migration SUM == 90104565 cents (invariant)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // The 90104565 invariant must appear inside a RAISE EXCEPTION block.
  assert.ok(
    /90104565/.test(src),
    "migration must reference the pre-migration invariant 90104565 cents"
  );
  assert.ok(
    /RAISE\s+EXCEPTION/i.test(src),
    "migration must include a RAISE EXCEPTION inside the verification probe"
  );
  assert.ok(
    /SUM\s*\(\s*approved_cos_total\s*\)/i.test(src),
    "migration verification probe must aggregate SUM(approved_cos_total) from public.jobs"
  );
});

// ── migration 00066 — schema qualification (G.9) ─────────────────────

test("migration 00066 uses public. schema qualification on every DDL target", () => {
  const raw = readFileSync(MIGRATION, "utf8");
  // Strip line comments first so narrative doesn't false-positive.
  const stripped = raw.replace(/--.*$/gm, "");
  const suspects = [
    /\bALTER\s+TABLE\s+change_orders\b/i,
    /\bALTER\s+TABLE\s+change_order_lines\b/i,
    /\bUPDATE\s+change_orders\b/i,
    /\bREFERENCES\s+proposals\s*\(/i,
    /\bREFERENCES\s+purchase_orders\s*\(/i,
    /\bFROM\s+change_orders\s+WHERE/i,
    /\bFROM\s+jobs\s+WHERE/i,
  ];
  for (const re of suspects) {
    assert.ok(
      !re.test(stripped),
      `found unqualified DDL/DML reference matching ${re} — every target must use public. prefix (G.9)`
    );
  }
});

// ── down migration ───────────────────────────────────────────────────

test("down migration restores the legacy co_type = 'owner' predicate in refresh_approved_cos_total", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");
  assert.ok(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+app_private\.refresh_approved_cos_total\s*\(/i.test(src),
    "down migration must CREATE OR REPLACE FUNCTION app_private.refresh_approved_cos_total"
  );
  assert.ok(
    /co_type\s*=\s*'owner'/i.test(src),
    "down migration must restore the legacy predicate co_type = 'owner'"
  );
});

test("down migration drops the 4 added columns in reverse-dependency order", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");
  const orderedDrops = [
    /DROP\s+COLUMN\s+IF\s+EXISTS\s+created_po_id/i,
    /DROP\s+COLUMN\s+IF\s+EXISTS\s+reason/i,
    /DROP\s+COLUMN\s+IF\s+EXISTS\s+source_proposal_id/i,
    /DROP\s+COLUMN\s+IF\s+EXISTS\s+pricing_mode/i,
  ];
  let lastIdx = -1;
  for (const re of orderedDrops) {
    const idx = src.search(re);
    assert.ok(idx >= 0, `down migration must include ${re}`);
    assert.ok(
      idx > lastIdx,
      `down migration must drop columns in reverse order; ${re} must follow the previous drop`
    );
    lastIdx = idx;
  }
});

test("down migration reverse-maps 'owner_requested' → 'owner' and restores the 2-value CHECK + default", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");
  assert.ok(
    /UPDATE\s+public\.change_orders\s+SET\s+co_type\s*=\s*'owner'\s+WHERE\s+co_type\s*=\s*'owner_requested'/is.test(
      src
    ),
    "down migration must reverse-map 'owner_requested' → 'owner'"
  );
  assert.ok(
    /ALTER\s+TABLE\s+public\.change_orders\s+ALTER\s+COLUMN\s+co_type\s+SET\s+DEFAULT\s+'owner'/i.test(
      src
    ),
    "down migration must restore DEFAULT 'owner'"
  );
  assert.ok(
    /CHECK\s*\(\s*co_type\s+IN\s*\(\s*'owner'\s*,\s*'internal'\s*\)\s*\)/i.test(src),
    "down migration must restore the 2-value CHECK (co_type IN ('owner','internal'))"
  );
});

// ── API create route (POST change order) ─────────────────────────────

test(`${CREATE_CO_ROUTE} defaults body.co_type to 'owner_requested' (Amendment C)`, () => {
  const src = readFileSync(CREATE_CO_ROUTE, "utf8");
  assert.ok(
    /body\.co_type\s*\?\?\s*["']owner_requested["']/.test(src),
    `${CREATE_CO_ROUTE} must default body.co_type to "owner_requested"`
  );
  // Regression guard: must not still default to "owner"
  assert.ok(
    !/body\.co_type\s*\?\?\s*["']owner["']/.test(src),
    `${CREATE_CO_ROUTE} must not still default body.co_type to "owner"`
  );
});

test(`${CREATE_CO_ROUTE} widens co_type body type away from the legacy 2-value union`, () => {
  const src = readFileSync(CREATE_CO_ROUTE, "utf8");
  assert.ok(
    !/co_type\?\s*:\s*["']owner["']\s*\|\s*["']internal["']/.test(src),
    `${CREATE_CO_ROUTE} must not keep the legacy co_type?: "owner" | "internal" union`
  );
});

test(`${CREATE_CO_ROUTE} declares a CO_TYPES constant with all 5 new values + runtime validation`, () => {
  const src = readFileSync(CREATE_CO_ROUTE, "utf8");
  // File-private const array (mirrors CONTRACT_TYPES pattern at
  // src/app/api/jobs/route.ts:16).
  assert.ok(
    /const\s+CO_TYPES\s*=\s*\[/i.test(src),
    `${CREATE_CO_ROUTE} must declare a file-private CO_TYPES constant`
  );
  for (const v of NEW_CO_TYPES) {
    assert.ok(
      src.includes(`"${v}"`),
      `${CREATE_CO_ROUTE} CO_TYPES must include "${v}"`
    );
  }
  assert.ok(
    /CO_TYPES\.includes\s*\(/.test(src),
    `${CREATE_CO_ROUTE} must validate body.co_type via CO_TYPES.includes(...)`
  );
});

// ── API patch route (PATCH change order) ─────────────────────────────

test(`${PATCH_CO_ROUTE} widens co_type body type away from the legacy 2-value union`, () => {
  const src = readFileSync(PATCH_CO_ROUTE, "utf8");
  assert.ok(
    !/co_type\?\s*:\s*["']owner["']\s*\|\s*["']internal["']/.test(src),
    `${PATCH_CO_ROUTE} must not keep the legacy co_type?: "owner" | "internal" union`
  );
});

test(`${PATCH_CO_ROUTE} declares a CO_TYPES constant with all 5 new values + runtime validation`, () => {
  const src = readFileSync(PATCH_CO_ROUTE, "utf8");
  assert.ok(
    /const\s+CO_TYPES\s*=\s*\[/i.test(src),
    `${PATCH_CO_ROUTE} must declare a file-private CO_TYPES constant`
  );
  for (const v of NEW_CO_TYPES) {
    assert.ok(
      src.includes(`"${v}"`),
      `${PATCH_CO_ROUTE} CO_TYPES must include "${v}"`
    );
  }
  assert.ok(
    /CO_TYPES\.includes\s*\(/.test(src),
    `${PATCH_CO_ROUTE} must validate body.co_type via CO_TYPES.includes(...)`
  );
});

// ── New-CO form state widening ───────────────────────────────────────

test(`${NEW_CO_PAGE} widens useState co_type away from the legacy 2-value union`, () => {
  const src = readFileSync(NEW_CO_PAGE, "utf8");
  assert.ok(
    !/useState<["']owner["']\s*\|\s*["']internal["']>/.test(src),
    `${NEW_CO_PAGE} must not keep useState<"owner" | "internal">`
  );
});

test(`${NEW_CO_PAGE} references all 5 new co_type values so the picker can emit them`, () => {
  const src = readFileSync(NEW_CO_PAGE, "utf8");
  for (const v of NEW_CO_TYPES) {
    assert.ok(
      src.includes(`"${v}"`),
      `${NEW_CO_PAGE} must reference co_type value "${v}" in the form (picker option or union)`
    );
  }
});

test(`${NEW_CO_PAGE} default selected co_type is 'owner_requested'`, () => {
  const src = readFileSync(NEW_CO_PAGE, "utf8");
  // useState(..., "owner_requested") or useState("owner_requested") somewhere
  // in the component's state init. Accept both a plain string init and a
  // typed init (e.g. useState<SomeUnion>("owner_requested")).
  assert.ok(
    /useState<[^>]*>\s*\(\s*["']owner_requested["']\s*\)/.test(src) ||
      /useState\s*\(\s*["']owner_requested["']\s*\)/.test(src),
    `${NEW_CO_PAGE} must default coType state to "owner_requested"`
  );
});

// ── 6 filter rewrites (contract-raising semantic) ────────────────────
// Legacy: .eq("co_type", "owner") / co.co_type === "owner"
// New:    .neq("co_type", "internal") / co.co_type !== "internal"

test(`${RECALC_LIB} uses .neq("co_type", "internal") (no .eq("co_type", "owner"))`, () => {
  const src = readFileSync(RECALC_LIB, "utf8");
  assert.ok(
    /\.neq\s*\(\s*["']co_type["']\s*,\s*["']internal["']\s*\)/.test(src),
    `${RECALC_LIB} must filter change_orders via .neq("co_type", "internal")`
  );
  assert.ok(
    !/\.eq\s*\(\s*["']co_type["']\s*,\s*["']owner["']\s*\)/.test(src),
    `${RECALC_LIB} must not still call .eq("co_type", "owner")`
  );
});

test(`${DRAW_CALC_LIB} uses .neq("co_type", "internal") (no .eq("co_type", "owner"))`, () => {
  const src = readFileSync(DRAW_CALC_LIB, "utf8");
  assert.ok(
    /\.neq\s*\(\s*["']co_type["']\s*,\s*["']internal["']\s*\)/.test(src),
    `${DRAW_CALC_LIB} must filter change_orders via .neq("co_type", "internal")`
  );
  assert.ok(
    !/\.eq\s*\(\s*["']co_type["']\s*,\s*["']owner["']\s*\)/.test(src),
    `${DRAW_CALC_LIB} must not still call .eq("co_type", "owner")`
  );
});

test(`${DRAWS_PREVIEW_ROUTE} uses co.co_type !== "internal" in BOTH filter sites (no legacy === "owner")`, () => {
  const src = readFileSync(DRAWS_PREVIEW_ROUTE, "utf8");
  const newMatches = src.match(/co_type\s*!==\s*["']internal["']/g) ?? [];
  assert.ok(
    newMatches.length >= 2,
    `${DRAWS_PREVIEW_ROUTE} must contain at least 2 co_type !== "internal" filters (found ${newMatches.length})`
  );
  assert.ok(
    !/co_type\s*===\s*["']owner["']/.test(src),
    `${DRAWS_PREVIEW_ROUTE} must not still filter co.co_type === "owner"`
  );
});

test(`${DRAWS_COMPARE_ROUTE} uses co.co_type !== "internal" (no legacy === "owner")`, () => {
  const src = readFileSync(DRAWS_COMPARE_ROUTE, "utf8");
  assert.ok(
    /co_type\s*!==\s*["']internal["']/.test(src),
    `${DRAWS_COMPARE_ROUTE} must filter via co.co_type !== "internal"`
  );
  assert.ok(
    !/co_type\s*===\s*["']owner["']/.test(src),
    `${DRAWS_COMPARE_ROUTE} must not still filter co.co_type === "owner"`
  );
});

test(`${INTEGRITY_CHECK_ROUTE} uses .neq("co_type", "internal") (no .eq("co_type", "owner"))`, () => {
  const src = readFileSync(INTEGRITY_CHECK_ROUTE, "utf8");
  assert.ok(
    /\.neq\s*\(\s*["']co_type["']\s*,\s*["']internal["']\s*\)/.test(src),
    `${INTEGRITY_CHECK_ROUTE} must filter change_orders via .neq("co_type", "internal")`
  );
  assert.ok(
    !/\.eq\s*\(\s*["']co_type["']\s*,\s*["']owner["']\s*\)/.test(src),
    `${INTEGRITY_CHECK_ROUTE} must not still call .eq("co_type", "owner")`
  );
});

// ── regression guards — values that must not survive the expansion ──

test("migration 00066 does not allow any invalid-under-new-CHECK value to slip into the new CHECK", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const addCheckMatch = src.match(
    /ADD\s+CONSTRAINT\s+change_orders_co_type_check\s+CHECK\s*\(\s*co_type\s+IN\s*\(([^)]*)\)\s*\)/i
  );
  assert.ok(addCheckMatch, "could not locate ADD CONSTRAINT change_orders_co_type_check");
  const checkBody = addCheckMatch![1];
  for (const bad of INVALID_UNDER_NEW_CHECK) {
    // Skip the bare 'internal' which IS in the new set (it's valid).
    if (bad === "internal") continue;
    assert.ok(
      !new RegExp(`'${bad}'`).test(checkBody),
      `new CHECK must not contain the invalid value '${bad}'`
    );
  }
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
