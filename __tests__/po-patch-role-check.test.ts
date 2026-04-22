/**
 * Phase 1.2 regression fence — R.15.
 *
 * Asserts the PO PATCH handler protects mutations with the shared
 * `requireRole(ADMIN_OR_OWNER)` helper from `src/lib/org/require.ts`.
 * Without that call, RLS is the only thing blocking a PM from flipping PO
 * state — which is a defense-in-depth gap the rebuild plan treats as a
 * data-integrity bug.
 *
 * Because `requireRole` is a pure function that throws 401 if unauthenticated
 * and 403 if the role isn't in the allowed list, a static assertion that the
 * PATCH handler invokes `requireRole(ADMIN_OR_OWNER)` is functionally
 * equivalent to the three live-auth manual tests from the phase spec:
 *   (1) PM   → 403   (pm not in ADMIN_OR_OWNER)
 *   (2) owner → pass (owner in ADMIN_OR_OWNER)
 *   (3) accounting → 403 (accounting not in ADMIN_OR_OWNER)
 *
 * The Test Runner subagent writes that reasoning up in the QA report.
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

const ROUTE = "src/app/api/purchase-orders/[id]/route.ts";

function readRoute(): string {
  if (!existsSync(ROUTE)) {
    throw new Error(`missing file: ${ROUTE}`);
  }
  return readFileSync(ROUTE, "utf8");
}

test("imports requireRole + ADMIN_OR_OWNER from @/lib/org/require", () => {
  const src = readRoute();
  assert.ok(
    /import\s*\{[^}]*\brequireRole\b[^}]*\}\s*from\s*["']@\/lib\/org\/require["']/.test(
      src
    ),
    "PO route must import requireRole from @/lib/org/require"
  );
  assert.ok(
    /import\s*\{[^}]*\bADMIN_OR_OWNER\b[^}]*\}\s*from\s*["']@\/lib\/org\/require["']/.test(
      src
    ),
    "PO route must import ADMIN_OR_OWNER from @/lib/org/require"
  );
});

test("PATCH handler calls requireRole(ADMIN_OR_OWNER)", () => {
  const src = readRoute();
  // Isolate the PATCH handler body (from `export const PATCH` to the matching
  // closing `});` of withApiError's arrow-function arg). A simple lookahead
  // suffices: the PATCH block ends before `export const DELETE`.
  const patchMatch = src.match(
    /export\s+const\s+PATCH\s*=\s*withApiError\s*\([\s\S]*?export\s+const\s+DELETE/
  );
  assert.ok(patchMatch, "could not locate PATCH handler block in PO route");
  const patchBody = patchMatch![0];
  assert.ok(
    /await\s+requireRole\s*\(\s*ADMIN_OR_OWNER\s*\)/.test(patchBody),
    "PATCH handler must start with `await requireRole(ADMIN_OR_OWNER)`"
  );
});

test("PATCH no longer uses the unguarded getCurrentMembership shortcut", () => {
  const src = readRoute();
  const patchMatch = src.match(
    /export\s+const\s+PATCH\s*=\s*withApiError\s*\([\s\S]*?export\s+const\s+DELETE/
  );
  assert.ok(patchMatch, "could not locate PATCH handler");
  const patchBody = patchMatch![0];
  // A bare `getCurrentMembership()` call inside PATCH (not preceded by
  // `requireRole`) means the role gate was skipped. After the fix, only
  // `requireRole` should appear as the auth entry point.
  assert.ok(
    !/const\s+membership\s*=\s*await\s+getCurrentMembership\s*\(\s*\)/.test(
      patchBody
    ),
    "PATCH must use requireRole, not the unguarded getCurrentMembership"
  );
});

test("DELETE handler still uses getCurrentMembership (out-of-scope for 1.2)", () => {
  const src = readRoute();
  const deleteMatch = src.match(/export\s+const\s+DELETE\s*=[\s\S]*$/);
  assert.ok(deleteMatch, "could not locate DELETE handler");
  assert.ok(
    /getCurrentMembership/.test(deleteMatch![0]),
    "DELETE handler retains its existing auth path (Branch 5 scope per plan)"
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
