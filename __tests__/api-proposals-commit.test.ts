/**
 * Phase 3.4 Step 5 — proposal commit + convert-to-po + reject route fences.
 *
 * Mirrors __tests__/api-proposals-extract.test.ts: structural validation
 * that each route file conforms to the Phase 3.4 contract. Live happy-
 * path coverage requires a fixtured Supabase + real Claude/OpenAI keys;
 * the fences below cover the auth/org/contract surface.
 *
 * Fenced behaviors:
 *   COMMIT (/api/proposals/commit):
 *     - auth + role gate (owner/admin/pm/accounting)
 *     - org-scoped SELECT + UPDATE on document_extractions
 *     - validates classified_type='proposal' + not yet committed
 *     - inserts proposals with status='accepted' + status_history append
 *     - cost-code dual-write resolves three pick kinds (org/legacy/pending)
 *     - legacy auto-create org_cost_codes uses service-role client
 *     - cost-intel wiring uses findSimilarLineItems + generateEmbedding
 *     - similarity threshold 0.85 matches addendum-1 §Phase 3.4 exit gate
 *     - updates document_extractions.target_entity_id on success
 *     - response shape: { proposal_id, line_items_count, new_items_created }
 *     - hot-path matcher untouched
 *
 *   CONVERT TO PO (/api/proposals/[id]/convert-to-po):
 *     - returns 501 with phase=3.5 marker (Phase 3.5 stub)
 *     - does NOT mutate proposal status (status flip belongs in Phase 3.5)
 *     - auth + org-scoped load
 *
 *   REJECT (/api/proposals/extract/[id]/reject):
 *     - auth + org scope
 *     - validates classified_type='proposal' + not yet committed
 *     - sets verification_status='rejected'
 */

import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const COMMIT_PATH = "src/app/api/proposals/commit/route.ts";
const CONVERT_PATH = "src/app/api/proposals/[proposal_id]/convert-to-po/route.ts";
const REJECT_PATH = "src/app/api/proposals/extract/[extraction_id]/reject/route.ts";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

// ── Existence ──────────────────────────────────────────────────
test("commit route exists at src/app/api/proposals/commit/route.ts", () => {
  assert.ok(existsSync(COMMIT_PATH), `missing ${COMMIT_PATH}`);
});
test("convert-to-po stub exists", () => {
  assert.ok(existsSync(CONVERT_PATH), `missing ${CONVERT_PATH}`);
});
test("reject route exists", () => {
  assert.ok(existsSync(REJECT_PATH), `missing ${REJECT_PATH}`);
});

const commit = existsSync(COMMIT_PATH) ? readFileSync(COMMIT_PATH, "utf8") : "";
const convert = existsSync(CONVERT_PATH) ? readFileSync(CONVERT_PATH, "utf8") : "";
const reject = existsSync(REJECT_PATH) ? readFileSync(REJECT_PATH, "utf8") : "";

// ── Commit: auth + role gate ───────────────────────────────────
test("commit imports getCurrentMembership", () => {
  assert.match(
    commit,
    /import\s*\{[^}]*getCurrentMembership[^}]*\}\s*from\s*['"]@\/lib\/org\/session['"]/
  );
});

test("commit role gate restricts to owner/admin/pm/accounting", () => {
  // The COMMITTER_ROLES set must list all four roles. Permissive regex.
  assert.match(commit, /['"]owner['"]/);
  assert.match(commit, /['"]admin['"]/);
  assert.match(commit, /['"]pm['"]/);
  assert.match(commit, /['"]accounting['"]/);
  assert.match(commit, /COMMITTER_ROLES/);
});

test("commit returns 401 unauthenticated, 403 wrong role", () => {
  assert.match(commit, /\b401\b/);
  assert.match(commit, /\b403\b/);
});

// ── Commit: org scoping ────────────────────────────────────────
test("commit scopes document_extractions SELECT by org_id", () => {
  assert.match(
    commit,
    /\.from\(\s*['"]document_extractions['"]\s*\)[\s\S]{0,400}?\.eq\(\s*['"]org_id['"]\s*,\s*membership\.org_id\s*\)/
  );
});

test("commit scopes proposals INSERT by org_id (in payload)", () => {
  // The .insert({...}) payload includes org_id: membership.org_id.
  assert.match(
    commit,
    /\.from\(\s*['"]proposals['"]\s*\)[\s\S]{0,500}?org_id:\s*membership\.org_id/
  );
});

test("commit scopes target_entity_id UPDATE by org_id", () => {
  // Must update document_extractions and filter by org_id.
  assert.match(
    commit,
    /target_entity_id:\s*proposalId[\s\S]{0,400}?\.eq\(\s*['"]org_id['"]\s*,\s*membership\.org_id\s*\)/
  );
});

// ── Commit: pre-flight checks ──────────────────────────────────
test("commit validates classified_type='proposal' (409 otherwise)", () => {
  assert.match(commit, /classified_type\s*!==\s*['"]proposal['"]/);
  assert.match(commit, /\b409\b/);
});

test("commit refuses to re-commit (target_entity_id already set)", () => {
  assert.match(commit, /target_entity_id[\s\S]{0,400}?already been committed/i);
});

// ── Commit: proposal write ─────────────────────────────────────
test("commit sets status='accepted' on proposal insert", () => {
  assert.match(commit, /status:\s*['"]accepted['"]/);
});

test("commit appends an initial status_history entry on insert", () => {
  assert.match(commit, /status_history:\s*\[/);
  // The entry must include who, status, at fields
  assert.match(commit, /who:\s*user\.id/);
  assert.match(commit, /status:\s*['"]accepted['"]/);
});

test("commit writes raw_extraction JSONB and extraction_confidence", () => {
  assert.match(commit, /raw_extraction:/);
  assert.match(commit, /extraction_confidence:\s*form\.ai_confidence/);
});

test("commit writes total to legacy proposals.amount column (BIGINT cents)", () => {
  // amount is the existing column on proposals; total_cents from the
  // form maps onto it.
  assert.match(commit, /amount:\s*form\.total_cents/);
});

test("commit persists Step 5b/5c fee/payment schedule + terms columns", () => {
  // The 3 JSONB columns from migration 00088 must be written on the
  // proposals INSERT, sourced from form.* (review form passes them).
  assert.match(commit, /additional_fee_schedule:\s*form\.additional_fee_schedule/);
  assert.match(commit, /payment_schedule:\s*form\.payment_schedule/);
  assert.match(commit, /payment_terms:\s*form\.payment_terms/);
});

// ── Commit: cost-code dual-write per clarification 3 ──────────
test("commit imports tryCreateServiceRoleClient for legacy auto-create", () => {
  assert.match(
    commit,
    /import\s*\{[^}]*tryCreateServiceRoleClient[^}]*\}\s*from\s*['"]@\/lib\/supabase\/service['"]/
  );
});

test("commit handles all four CostCodePick kinds (none/org/legacy/pending)", () => {
  assert.match(commit, /case\s+['"]none['"]/);
  assert.match(commit, /case\s+['"]org['"]/);
  assert.match(commit, /case\s+['"]legacy['"]/);
  assert.match(commit, /case\s+['"]pending['"]/);
});

test("commit legacy pick: writes BOTH cost_code_id and tries org_cost_codes lookup", () => {
  // The function resolvePick has the legacy-branch SELECT against
  // org_cost_codes for find-then-create.
  assert.match(
    commit,
    /case\s+['"]legacy['"][\s\S]{0,1500}?\.from\(\s*['"]org_cost_codes['"]\s*\)/
  );
});

test("commit legacy auto-create uses service-role client (RLS bypass)", () => {
  // Tolerate multi-line chaining: `service\n  .from(...)\n  .insert(...)`.
  assert.match(
    commit,
    /service\s*\.from\(\s*['"]org_cost_codes['"]\s*\)\s*\.insert/
  );
});

test("commit pending pick: leaves both FK columns NULL on the line", () => {
  assert.match(commit, /case\s+['"]pending['"][\s\S]{0,400}?org_cost_code_id:\s*null/);
});

// ── Commit: cost-intel wiring ──────────────────────────────────
test("commit imports findSimilarLineItems + generateEmbedding from Phase 3.3", () => {
  assert.match(
    commit,
    /import\s*\{[^}]*findSimilarLineItems[^}]*\}\s*from\s*['"]@\/lib\/cost-intelligence\/queries['"]/
  );
  assert.match(
    commit,
    /import\s*\{[^}]*generateEmbedding[^}]*\}\s*from\s*['"]@\/lib\/cost-intelligence\/embeddings['"]/
  );
});

test("commit similarity threshold matches addendum-1 §Phase 3.4 exit gate (0.85)", () => {
  assert.match(commit, /ITEM_SIMILARITY_THRESHOLD\s*=\s*0\.85/);
});

test("commit creates new items row when similarity < threshold", () => {
  // The else-branch of the similarity match inserts into items.
  assert.match(commit, /\.from\(\s*['"]items['"]\s*\)\s*\.insert/);
  // canonical_name must be populated (NOT NULL on items)
  assert.match(commit, /canonical_name:/);
  // unit normalized to enum (CHECK on items.unit)
  assert.match(commit, /normalizeUnit/);
});

test("commit embeds line and writes vectorLiteral into items.embedding", () => {
  assert.match(commit, /generateEmbedding\(/);
  assert.match(commit, /vectorLiteral\(/);
  assert.match(commit, /embedding:\s*vectorLiteral\(/);
});

// ── Commit: response shape ─────────────────────────────────────
test("commit response includes proposal_id, line_items_count, new_items_created", () => {
  assert.match(commit, /proposal_id:/);
  assert.match(commit, /line_items_count:/);
  assert.match(commit, /new_items_created/);
});

// ── Commit: hot-path boundary ──────────────────────────────────
test("commit does NOT import hot-path matcher modules", () => {
  assert.ok(
    !/from\s+['"]@\/lib\/cost-intelligence\/(match-item|commit-line-to-spine|extract-invoice|correct-line)['"]/.test(
      commit
    ),
    "commit route must not import hot-path matcher modules (Addendum-B byte-identical guarantee)"
  );
});

// ── Convert-to-PO stub ─────────────────────────────────────────
test("convert-to-po returns 501 with phase=3.5 marker", () => {
  assert.match(convert, /\b501\b/);
  assert.match(convert, /['"]phase['"]:\s*['"]3\.5['"]|phase:\s*['"]3\.5['"]/);
});

test("convert-to-po does NOT mutate proposal status (Phase 3.5 owns the flip)", () => {
  // Regex-loose: there must be no .update({ status: 'converted_to_po' })
  // pattern in this file.
  assert.ok(
    !/\.update\(\s*\{[\s\S]{0,200}?status:\s*['"]converted_to_po['"]/.test(convert),
    "convert-to-po must NOT mutate the proposal status — that belongs in Phase 3.5"
  );
});

test("convert-to-po auth + org-scoped load", () => {
  assert.match(convert, /getCurrentMembership/);
  assert.match(
    convert,
    /\.from\(\s*['"]proposals['"]\s*\)[\s\S]{0,300}?\.eq\(\s*['"]org_id['"]\s*,\s*membership\.org_id\s*\)/
  );
});

// ── Reject route ───────────────────────────────────────────────
test("reject auth + role-aware: requires membership", () => {
  assert.match(reject, /getCurrentMembership/);
  assert.match(reject, /\b401\b/);
});

test("reject sets verification_status='rejected'", () => {
  assert.match(reject, /verification_status:\s*['"]rejected['"]/);
});

test("reject validates classified_type='proposal' + not committed", () => {
  assert.match(reject, /classified_type\s*!==\s*['"]proposal['"]/);
  assert.match(reject, /target_entity_id[\s\S]{0,300}?409/);
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
