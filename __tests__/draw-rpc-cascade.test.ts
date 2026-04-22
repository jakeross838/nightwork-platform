/**
 * Phase 1.3 regression fence — R.15.
 *
 * Asserts the draw-cascade rebuild landed:
 *   - migration 00061 defines draw_submit_rpc, draw_approve_rpc, draw_void_rpc,
 *     each accepting a `_force_fail text default null` parameter for the
 *     scoped failure-injection hooks the exit gate requires.
 *   - the action route invokes the RPCs (not the old TS cascade calls).
 *   - src/lib/lien-releases.ts is deleted (its 4 exports are subsumed by
 *     the RPCs).
 *   - src/lib/payment-schedule.ts retains the utility functions used by
 *     invoice routes but no longer exports autoScheduleDrawPayments.
 *   - the two invoice payment routes that depend on payment-schedule
 *     utilities still import them — guard against silent breakage from
 *     the narrow rebuild.
 *
 * R.5 blast-radius decision (locked in prompt 33): keep getOrgPaymentSchedule
 * + scheduledPaymentDate as TS utilities for invoice callers; only move
 * autoScheduleDrawPayments into the RPC. PL/pgSQL duplicates ~25 lines of
 * date math — tracked as a Branch 8/9 cleanup candidate (see GH issue
 * referenced in the RPC source comment).
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

const MIGRATION = "supabase/migrations/00061_transactional_draw_rpcs.sql";
const ACTION_ROUTE = "src/app/api/draws/[id]/action/route.ts";
const PAYMENT_SCHED = "src/lib/payment-schedule.ts";
const LIEN_LIB = "src/lib/lien-releases.ts";
const INV_PAY_ROUTE = "src/app/api/invoices/[id]/payment/route.ts";
const INV_PAY_BULK = "src/app/api/invoices/payments/bulk/route.ts";

test("migration 00061 exists", () => {
  assert.ok(existsSync(MIGRATION), `${MIGRATION} missing`);
});

test("migration 00061 defines all 3 cascade RPCs", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /create\s+(or\s+replace\s+)?function\s+public\.draw_submit_rpc/i.test(src),
    "draw_submit_rpc not defined"
  );
  assert.ok(
    /create\s+(or\s+replace\s+)?function\s+public\.draw_approve_rpc/i.test(src),
    "draw_approve_rpc not defined"
  );
  assert.ok(
    /create\s+(or\s+replace\s+)?function\s+public\.draw_void_rpc/i.test(src),
    "draw_void_rpc not defined"
  );
});

test("migration 00061 declares _force_fail on each RPC", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const matches = src.match(/_force_fail\s+text\s+default\s+null/gi) ?? [];
  assert.ok(
    matches.length >= 3,
    `expected ≥3 _force_fail params (one per RPC), found ${matches.length}`
  );
});

test("migration 00061 references the GH tech-debt issue for duplicated date math", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Issue # is populated post-creation; assert the reference pattern is present
  // (e.g., "Tracked in GH issue #N" or similar). Soft check — accept either
  // a #N reference or the explicit "branch 8" / "branch 9" cleanup phrase.
  assert.ok(
    /github.*issue|gh\s+issue|issue\s+#\d+|branch\s+[89]/i.test(src),
    "RPC source must reference the payment-scheduling consolidation issue"
  );
});

test("action route uses supabase.rpc(), not the removed cascade libs", () => {
  const src = readFileSync(ACTION_ROUTE, "utf8");
  assert.ok(
    !/from\s+["']@\/lib\/lien-releases["']/.test(src),
    "action route must not import @/lib/lien-releases (removed)"
  );
  assert.ok(
    !/autoScheduleDrawPayments/.test(src),
    "action route must not call autoScheduleDrawPayments (moved into RPC)"
  );
  assert.ok(
    /supabase\.rpc\(\s*["']draw_submit_rpc["']/.test(src),
    "action route must invoke draw_submit_rpc"
  );
  assert.ok(
    /supabase\.rpc\(\s*["']draw_approve_rpc["']/.test(src),
    "action route must invoke draw_approve_rpc"
  );
  assert.ok(
    /supabase\.rpc\(\s*["']draw_void_rpc["']/.test(src),
    "action route must invoke draw_void_rpc"
  );
});

test("src/lib/lien-releases.ts is removed", () => {
  assert.ok(
    !existsSync(LIEN_LIB),
    "src/lib/lien-releases.ts must be deleted (subsumed by RPCs)"
  );
});

test("payment-schedule.ts retains utility functions but drops cascade", () => {
  const src = readFileSync(PAYMENT_SCHED, "utf8");
  assert.ok(
    !/export\s+(async\s+)?function\s+autoScheduleDrawPayments/.test(src),
    "autoScheduleDrawPayments must be removed from payment-schedule.ts"
  );
  assert.ok(
    /export\s+function\s+scheduledPaymentDate/.test(src),
    "scheduledPaymentDate must remain (invoice routes depend on it)"
  );
  assert.ok(
    /export\s+async\s+function\s+getOrgPaymentSchedule/.test(src),
    "getOrgPaymentSchedule must remain (invoice routes depend on it)"
  );
  assert.ok(
    /utility functions for invoice payment scheduling/i.test(src),
    "header comment must reflect new draw-cascade-removed purpose"
  );
});

test("invoice payment routes still import payment-schedule utils", () => {
  const inv1 = readFileSync(INV_PAY_ROUTE, "utf8");
  const inv2 = readFileSync(INV_PAY_BULK, "utf8");
  assert.ok(
    /from\s+["']@\/lib\/payment-schedule["']/.test(inv1),
    "invoices/[id]/payment must still import @/lib/payment-schedule"
  );
  assert.ok(
    /from\s+["']@\/lib\/payment-schedule["']/.test(inv2),
    "invoices/payments/bulk must still import @/lib/payment-schedule"
  );
  // And the specific utility names should still resolve
  for (const src of [inv1, inv2]) {
    assert.ok(
      /\bgetOrgPaymentSchedule\b/.test(src) ||
        /\bscheduledPaymentDate\b/.test(src),
      "invoice route must still reference at least one payment-schedule util"
    );
  }
});

test("failure-injection: both env var names referenced for tests 2 and 4", () => {
  const src = readFileSync(ACTION_ROUTE, "utf8");
  assert.ok(
    /FORCE_LIEN_GEN_FAIL/.test(src),
    "action route must reference FORCE_LIEN_GEN_FAIL (manual test 2)"
  );
  assert.ok(
    /FORCE_APPROVE_FAIL/.test(src),
    "action route must reference FORCE_APPROVE_FAIL (manual test 4)"
  );
});

test("failure-injection: dev-only x-force-fail header is gated by NODE_ENV", () => {
  const src = readFileSync(ACTION_ROUTE, "utf8");
  // Dev-only header channel is required so a single running dev server can
  // exercise both normal and failure paths without a restart (R.1 forbids
  // killing the dev server). Must be gated so it never fires in production.
  assert.ok(
    /x-force-fail/i.test(src),
    "action route must recognize the x-force-fail request header"
  );
  assert.ok(
    /NODE_ENV\s*!==\s*["']production["']/.test(src),
    "x-force-fail header must be gated by NODE_ENV !== 'production'"
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
