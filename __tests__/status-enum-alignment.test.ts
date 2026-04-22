/**
 * Phase 1.1 regression fence — R.15.
 *
 * Fails if any code path references the legacy CO statuses
 * ('pending_approval', 'executed') that migration 00060 consolidates,
 * or if migration 00060 is missing.
 *
 * Run: `npm test`
 *
 * The legacy values came from 00001 (executed, pending_approval) and 00028
 * (kept both for back-compat but never deprecated). 00060 collapses them:
 *   pending_approval → pending
 *   executed         → approved
 * Invoices CHECK is widened to accept info_requested + info_received which
 * the API was already setting.
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

const LEGACY_PATTERNS = [
  { re: /['"]pending_approval['"]/g, label: "'pending_approval'" },
  { re: /['"]executed['"]/g, label: "'executed'" },
];

function assertNoLegacy(filePath: string) {
  if (!existsSync(filePath)) {
    throw new Error(`expected file does not exist: ${filePath}`);
  }
  const src = readFileSync(filePath, "utf8");
  for (const p of LEGACY_PATTERNS) {
    const hits = src.match(p.re);
    assert.ok(
      !hits,
      `${filePath}: ${hits?.length ?? 0} ${p.label} reference(s) remain`
    );
  }
}

// Files that filter, query, guard, or compute on CO status. Every one of
// these must stop using the legacy values after 00060.
const CO_STATUS_CONSUMERS = [
  "src/lib/recalc.ts",
  "src/lib/deletion-guards.ts",
  "src/lib/draw-calc.ts",
  "src/lib/support/system-prompt.ts",
  "src/lib/support/tool-handlers.ts",
  "src/components/budget-drill-down.tsx",
  "src/components/job-overview-cards.tsx",
  "src/app/api/change-orders/[id]/route.ts",
  "src/app/api/draws/[id]/export/route.ts",
  "src/app/api/draws/[id]/compare/route.ts",
  "src/app/api/draws/[id]/change-orders/route.ts",
  "src/app/api/draws/preview/route.ts",
  "src/app/api/admin/integrity-check/route.ts",
  "src/app/api/jobs/[id]/overview/route.ts",
  "src/app/api/jobs/[id]/budget-import/route.ts",
  "src/app/change-orders/[id]/page.tsx",
  "src/app/jobs/[id]/change-orders/page.tsx",
  "src/app/jobs/[id]/budget/page.tsx",
];

for (const f of CO_STATUS_CONSUMERS) {
  test(`${f} uses canonical CO statuses only`, () => assertNoLegacy(f));
}

test("invoices action route maps request_info → info_requested", () => {
  const src = readFileSync(
    "src/app/api/invoices/[id]/action/route.ts",
    "utf8"
  );
  assert.ok(
    /request_info:\s*['"]info_requested['"]/.test(src),
    "request_info action must map to status 'info_requested'"
  );
});

test("migration 00060 exists and addresses both enums", () => {
  const path = "supabase/migrations/00060_align_status_enums.sql";
  assert.ok(existsSync(path), `${path} missing`);
  const src = readFileSync(path, "utf8");
  // Migrates legacy CO data forward
  assert.ok(
    /UPDATE\s+public\.change_orders[\s\S]+pending_approval[\s\S]+pending\b/i.test(
      src
    ),
    "must migrate change_orders.status pending_approval → pending"
  );
  assert.ok(
    /UPDATE\s+public\.change_orders[\s\S]+executed[\s\S]+approved/i.test(src),
    "must migrate change_orders.status executed → approved"
  );
  // Replaces the CO CHECK with the canonical set (no pending_approval, no executed)
  const newCoCheck = src.match(
    /change_orders_status_check[\s\S]+?CHECK\s*\(\s*status\s+IN\s*\(([^)]+)\)/i
  );
  assert.ok(newCoCheck, "must define new change_orders_status_check");
  const coVals = newCoCheck![1];
  assert.ok(
    !/pending_approval/.test(coVals),
    "new CO CHECK must not include pending_approval"
  );
  assert.ok(
    !/executed/.test(coVals),
    "new CO CHECK must not include executed"
  );
  for (const v of ["draft", "pending", "approved", "denied", "void"]) {
    assert.ok(
      coVals.includes(`'${v}'`),
      `new CO CHECK missing canonical value '${v}'`
    );
  }
  // Widens invoices CHECK to accept info_requested + info_received
  assert.ok(
    /invoices_status_check[\s\S]+info_requested/i.test(src),
    "must add info_requested to invoices_status_check"
  );
  assert.ok(
    /info_received/i.test(src),
    "must add info_received to invoices_status_check"
  );
  // Has rollback documentation
  assert.ok(
    /(rollback|down)/i.test(src) ||
      existsSync("supabase/migrations/00060_align_status_enums.down.sql"),
    "must document rollback (in-file or .down.sql)"
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
