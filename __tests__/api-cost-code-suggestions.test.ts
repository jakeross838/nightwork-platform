/**
 * Phase 3.4 Step 5 — cost-code suggestions create + resolve route fences.
 *
 * Two routes:
 *   POST /api/cost-code-suggestions
 *     - Open to owner/admin/pm/accounting
 *     - Inserts pending_cost_code_suggestions row, status='pending'
 *
 *   POST /api/cost-code-suggestions/[id]/resolve
 *     - Open to owner/admin only
 *     - approve → creates org_cost_codes row + links via approved_org_cost_code_id
 *     - reject → status='rejected' with required resolution_note
 */

import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const CREATE_PATH = "src/app/api/cost-code-suggestions/route.ts";
const RESOLVE_PATH = "src/app/api/cost-code-suggestions/[id]/resolve/route.ts";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

// ── Existence ──────────────────────────────────────────────────
test("create route exists", () => {
  assert.ok(existsSync(CREATE_PATH), `missing ${CREATE_PATH}`);
});
test("resolve route exists", () => {
  assert.ok(existsSync(RESOLVE_PATH), `missing ${RESOLVE_PATH}`);
});

const create = existsSync(CREATE_PATH) ? readFileSync(CREATE_PATH, "utf8") : "";
const resolve = existsSync(RESOLVE_PATH) ? readFileSync(RESOLVE_PATH, "utf8") : "";

// ── Create route ───────────────────────────────────────────────
test("create imports getCurrentMembership", () => {
  assert.match(
    create,
    /import\s*\{[^}]*getCurrentMembership[^}]*\}\s*from\s*['"]@\/lib\/org\/session['"]/
  );
});

test("create allows owner/admin/pm/accounting; 403 otherwise", () => {
  assert.match(create, /['"]owner['"]/);
  assert.match(create, /['"]admin['"]/);
  assert.match(create, /['"]pm['"]/);
  assert.match(create, /['"]accounting['"]/);
  assert.match(create, /\b403\b/);
});

test("create rejects unauthenticated with 401, missing fields with 400", () => {
  assert.match(create, /\b401\b/);
  assert.match(create, /\b400\b/);
  assert.match(create, /Missing\s+suggested_code/i);
  assert.match(create, /Missing\s+suggested_name/i);
});

test("create inserts pending_cost_code_suggestions with status='pending'", () => {
  assert.match(
    create,
    /\.from\(\s*['"]pending_cost_code_suggestions['"]\s*\)\s*\.insert/
  );
  assert.match(create, /status:\s*['"]pending['"]/);
});

test("create writes org_id, suggested_by from session", () => {
  assert.match(create, /org_id:\s*membership\.org_id/);
  assert.match(create, /suggested_by:\s*user\.id/);
});

test("create response shape includes suggestion_id", () => {
  assert.match(create, /suggestion_id:/);
});

// ── Resolve route ──────────────────────────────────────────────
test("resolve imports getCurrentMembership", () => {
  assert.match(
    resolve,
    /import\s*\{[^}]*getCurrentMembership[^}]*\}\s*from\s*['"]@\/lib\/org\/session['"]/
  );
});

test("resolve restricts to owner/admin only (403 for pm/accounting)", () => {
  assert.match(resolve, /RESOLVER_ROLES/);
  // Set must contain owner + admin only — pm and accounting must be absent
  // from the RESOLVER_ROLES set (they appear elsewhere in the file but not
  // inside that Set initializer).
  const setMatch = resolve.match(
    /const\s+RESOLVER_ROLES\s*=\s*new\s+Set\(\[\s*([^\]]+)\s*\]\)/
  );
  assert.ok(setMatch, "RESOLVER_ROLES must be a const Set initializer");
  const setBody = setMatch![1];
  assert.match(setBody, /['"]owner['"]/);
  assert.match(setBody, /['"]admin['"]/);
  assert.ok(!/['"]pm['"]/.test(setBody), "RESOLVER_ROLES must not include 'pm'");
  assert.ok(
    !/['"]accounting['"]/.test(setBody),
    "RESOLVER_ROLES must not include 'accounting'"
  );
});

test("resolve validates action: 'approve' | 'reject' (400 otherwise)", () => {
  assert.match(resolve, /['"]approve['"]/);
  assert.match(resolve, /['"]reject['"]/);
  assert.match(resolve, /must be 'approve' or 'reject'/i);
});

test("resolve requires non-empty resolution_note when rejecting", () => {
  assert.match(
    resolve,
    /action\s*===\s*['"]reject['"][\s\S]{0,200}?resolution_note is required/i
  );
});

test("resolve refuses to re-resolve (status !== 'pending' → 409)", () => {
  assert.match(resolve, /already\s+\$\{[^}]+\.status\}/);
  assert.match(resolve, /\b409\b/);
});

test("resolve approve: inserts org_cost_codes and links approved_org_cost_code_id", () => {
  assert.match(resolve, /\.from\(\s*['"]org_cost_codes['"]\s*\)\s*\.insert/);
  assert.match(resolve, /approved_org_cost_code_id:\s*newCode\.id/);
});

test("resolve approve: copies code/name/parent_code/canonical_code_id from suggestion", () => {
  assert.match(resolve, /code:\s*suggestion\.suggested_code/);
  assert.match(resolve, /name:\s*suggestion\.suggested_name/);
  assert.match(resolve, /parent_code:\s*suggestion\.suggested_parent_code/);
  assert.match(resolve, /canonical_code_id:\s*suggestion\.suggested_canonical_code_id/);
});

test("resolve reject: sets status='rejected' + resolved_by + resolved_at", () => {
  assert.match(resolve, /status:\s*['"]rejected['"]/);
  assert.match(resolve, /resolved_by:\s*user\.id/);
  assert.match(resolve, /resolved_at:\s*nowIso/);
});

test("resolve org-scopes the load + update", () => {
  assert.match(
    resolve,
    /\.from\(\s*['"]pending_cost_code_suggestions['"]\s*\)[\s\S]{0,300}?\.eq\(\s*['"]org_id['"]\s*,\s*membership\.org_id\s*\)/
  );
});

test("resolve response shape: suggestion_id + status + approved_org_cost_code_id (on approve)", () => {
  assert.match(resolve, /suggestion_id:/);
  assert.match(resolve, /status:\s*['"]rejected['"]|status:\s*['"]approved['"]/);
  assert.match(resolve, /approved_org_cost_code_id:\s*newCode\.id/);
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
