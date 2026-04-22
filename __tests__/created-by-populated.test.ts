/**
 * Phase 1.4 regression fence — R.15.
 *
 * created_by columns on cost_codes / budget_lines / draw_line_items already
 * exist (migration 00045). The Phase 1.4 work is on the WRITE PATHS:
 *   - User-authenticated insert sites must populate `created_by: user.id`.
 *   - Insert sites without a user session (sample-data generators, system
 *     batch jobs without auth) leave it NULL with an explicit
 *     `// no user session: <reason>` comment so audits can tell the
 *     intentional-NULL sites from the accidentally-skipped ones.
 *
 * This test enforces both:
 *   1. Already-correct sites (regression guard) — must keep populating.
 *   2. Phase-1.4 audit sites — must EITHER populate OR carry the comment.
 *
 * It also asserts migration 00062 ships as an assert-only tripwire with the
 * 6 DO-block assertions Jake specified (3 columns + 3 FKs to auth.users).
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

const MIGRATION = "supabase/migrations/00062_assert_created_by_columns.sql";

// ── insert-site audit ────────────────────────────────────────────────
// For each (file, table) tuple, verify every `.from("<table>").insert(`
// occurrence either:
//   - has `created_by:` set somewhere nearby (in the insert payload, or in
//     the variable built immediately above and passed into the insert), OR
//   - carries a `// no user session: <reason>` comment in the same window.
//
// The window is bidirectional (BEFORE_WINDOW chars back + AFTER_WINDOW chars
// forward) because real inserts split into two shapes:
//   (a) inline object literal: `.insert({ ..., created_by: x })` — match
//       lives forward of the .insert(.
//   (b) variable reference: `const row = { ..., created_by: x }; .insert(row)`
//       — match lives backward of the .insert(. Covers the budget-import,
//       template, sample-data shapes.
// Some inserts pass a row variable built much earlier in the same handler
// (e.g., a `toUpsert.push({…, created_by: user.id})` 30+ lines above the
// `.insert(row)` call inside a later `for` loop). The window has to be wide
// enough to span that distance without leaking across functions. ~1500 chars
// ≈ 35 lines of typical code — comfortable for handler-scoped lookbacks.
const BEFORE_WINDOW = 1500;
const AFTER_WINDOW = 600;

function findAllInsertOffsets(src: string, table: string): number[] {
  const re = new RegExp(
    `\\.from\\(\\s*["']${table}["']\\s*\\)\\s*\\.insert\\(`,
    "g"
  );
  return Array.from(src.matchAll(re), (m) => m.index ?? -1).filter((i) => i >= 0);
}

function checkInsertSite(
  filePath: string,
  table: string,
  mode: "must-populate" | "either"
): void {
  if (!existsSync(filePath)) {
    throw new Error(`audit site does not exist: ${filePath}`);
  }
  const src = readFileSync(filePath, "utf8");
  const offsets = findAllInsertOffsets(src, table);
  assert.ok(
    offsets.length > 0,
    `${filePath}: expected at least one .from("${table}").insert() — phase scope changed?`
  );
  for (const start of offsets) {
    const sliceStart = Math.max(0, start - BEFORE_WINDOW);
    const window = src.slice(sliceStart, start + AFTER_WINDOW);
    const hasPopulate = /\bcreated_by\s*:/.test(window);
    const hasComment = /\/\/\s*no user session:/i.test(window);
    if (mode === "must-populate") {
      assert.ok(
        hasPopulate,
        `${filePath} @ offset ${start}: .from("${table}").insert() must populate created_by (regression guard)`
      );
    } else {
      assert.ok(
        hasPopulate || hasComment,
        `${filePath} @ offset ${start}: .from("${table}").insert() must populate created_by OR carry a "// no user session:" comment within window [${sliceStart}..${start + AFTER_WINDOW}]`
      );
    }
  }
}

// Already-correct as of pre-Phase-1.4 (regression guards — must keep
// populating no matter what).
const REGRESSION_GUARDS: Array<[string, string]> = [
  ["src/app/api/cost-codes/route.ts", "cost_codes"],
  ["src/app/api/budget-lines/route.ts", "budget_lines"],
  ["src/app/api/draws/[id]/internal-billings/route.ts", "draw_line_items"],
  ["src/app/api/draws/[id]/internal-billings/attach/route.ts", "draw_line_items"],
  ["src/app/api/draws/[id]/change-orders/route.ts", "draw_line_items"],
];

for (const [file, table] of REGRESSION_GUARDS) {
  test(`regression guard: ${file} populates created_by on ${table} insert`, () => {
    checkInsertSite(file, table, "must-populate");
  });
}

// Phase 1.4 audit sites — must populate OR carry the explicit comment.
const AUDIT_SITES: Array<[string, string]> = [
  ["src/app/api/cost-codes/import/route.ts", "cost_codes"],
  ["src/app/api/cost-codes/template/route.ts", "cost_codes"],
  ["src/app/api/jobs/[id]/budget-import/route.ts", "budget_lines"],
  ["src/app/api/sample-data/route.ts", "budget_lines"],
  ["src/app/api/change-orders/[id]/route.ts", "budget_lines"],
];

for (const [file, table] of AUDIT_SITES) {
  test(`audit: ${file} insert on ${table} populates created_by OR has // no user session: comment`, () => {
    checkInsertSite(file, table, "either");
  });
}

// ── migration 00062 — assert-only tripwire ───────────────────────────

test("migration 00062 exists", () => {
  assert.ok(existsSync(MIGRATION), `${MIGRATION} missing`);
});

test("migration 00062 header documents the nullable-by-design policy", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /nullable by design/i.test(src),
    `migration header must include "nullable by design" policy text`
  );
  assert.ok(
    /no user session/i.test(src) || /system route/i.test(src),
    `migration header must reference the system-route NULL allowance`
  );
});

test("migration 00062 contains 3 column-existence assertions (one per table)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  for (const table of ["cost_codes", "budget_lines", "draw_line_items"]) {
    const re = new RegExp(
      `information_schema\\.columns[\\s\\S]{0,400}table_name\\s*=\\s*'${table}'[\\s\\S]{0,400}column_name\\s*=\\s*'created_by'`,
      "i"
    );
    assert.ok(
      re.test(src),
      `migration must assert created_by column exists on ${table}`
    );
  }
});

test("migration 00062 contains 3 FK-existence assertions (one per table) referencing auth.users", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Each FK assertion should be visible as a query against pg_constraint or
  // information_schema that mentions both the source table and auth.users.
  for (const table of ["cost_codes", "budget_lines", "draw_line_items"]) {
    const re = new RegExp(
      `${table}[\\s\\S]{0,800}auth\\.users|auth\\.users[\\s\\S]{0,800}${table}`,
      "i"
    );
    assert.ok(
      re.test(src),
      `migration must assert FK from ${table}.created_by to auth.users(id)`
    );
  }
});

test("migration 00062 has at least 6 RAISE EXCEPTION lines (one per assertion)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const raises = src.match(/RAISE\s+EXCEPTION/gi) ?? [];
  assert.ok(
    raises.length >= 6,
    `expected ≥6 RAISE EXCEPTION lines (3 column + 3 FK), found ${raises.length}`
  );
});

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
