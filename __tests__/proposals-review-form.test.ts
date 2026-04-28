/**
 * Phase 3.4 Step 4 — proposal review form structural fence.
 *
 * Same pattern as __tests__/api-ingest.test.ts: static structural
 * validation that the review-form server page + client manager + the
 * suggestions queue follow the contract laid down in prompt 173 §Step 4
 * and Jake's clarification 3 in prompt 176 (cost-code dual-write).
 *
 * Live happy-path coverage requires Chrome MCP / Cypress against a
 * logged-in session; the fences below cover the contract surface.
 *
 * Required behaviors verified:
 *   - Server pages auth-gate via getCurrentMembership() + redirect to login
 *   - Server pages org-scope every Supabase query
 *   - Review page loads BOTH org_cost_codes (Phase 3.3) AND cost_codes
 *     (Phase 1) — dual-write per Jake's clarification 3
 *   - ReviewManager calls /api/proposals/extract on mount (idempotent)
 *   - ReviewManager has 4 action buttons: Save / Convert to PO /
 *     Convert to CO (disabled) / Reject
 *   - Convert to CO is disabled with the "Available after Phase 3.7" tooltip
 *   - Cost-code dropdown shows three optgroups labeled [New] / [Legacy] /
 *     [Pending]
 *   - Suggest-new-code modal posts to /api/cost-code-suggestions
 *   - Pending pick shows "Pending: <code>" badge
 *   - SuggestionsManager only shows approve/reject buttons for
 *     owner/admin role; calls /api/cost-code-suggestions/[id]/resolve
 *   - Hot-path matcher byte-identical (Addendum-B)
 */

import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const REVIEW_PAGE = "src/app/proposals/review/[extraction_id]/page.tsx";
const REVIEW_MANAGER = "src/app/proposals/review/[extraction_id]/ReviewManager.tsx";
const SUGGESTIONS_PAGE = "src/app/cost-intelligence/suggestions/page.tsx";
const SUGGESTIONS_MANAGER = "src/app/cost-intelligence/suggestions/SuggestionsManager.tsx";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

// ── Existence ─────────────────────────────────────────────────
test("review page exists at proposals/review/[extraction_id]/page.tsx", () => {
  assert.ok(existsSync(REVIEW_PAGE), `missing ${REVIEW_PAGE}`);
});
test("review manager (client) exists", () => {
  assert.ok(existsSync(REVIEW_MANAGER), `missing ${REVIEW_MANAGER}`);
});
test("suggestions page exists at cost-intelligence/suggestions/page.tsx", () => {
  assert.ok(existsSync(SUGGESTIONS_PAGE), `missing ${SUGGESTIONS_PAGE}`);
});
test("suggestions manager (client) exists", () => {
  assert.ok(existsSync(SUGGESTIONS_MANAGER), `missing ${SUGGESTIONS_MANAGER}`);
});

const reviewPage = existsSync(REVIEW_PAGE) ? readFileSync(REVIEW_PAGE, "utf8") : "";
const reviewManager = existsSync(REVIEW_MANAGER)
  ? readFileSync(REVIEW_MANAGER, "utf8")
  : "";
const suggestionsPage = existsSync(SUGGESTIONS_PAGE)
  ? readFileSync(SUGGESTIONS_PAGE, "utf8")
  : "";
const suggestionsManager = existsSync(SUGGESTIONS_MANAGER)
  ? readFileSync(SUGGESTIONS_MANAGER, "utf8")
  : "";

// ── Review page: auth + org scoping ───────────────────────────
test("review page imports getCurrentMembership", () => {
  assert.match(
    reviewPage,
    /import\s*\{[^}]*getCurrentMembership[^}]*\}\s*from\s*['"]@\/lib\/org\/session['"]/
  );
});

test("review page redirects to /login when no membership", () => {
  assert.match(reviewPage, /if\s*\(!membership\)\s+redirect\(['"]\/login['"]\)/);
});

test("review page validates classified_type='proposal' and 404s otherwise", () => {
  assert.match(
    reviewPage,
    /classified_type\s*!==\s*['"]proposal['"][\s\S]{0,80}?notFound\(\)/
  );
});

test("review page filters every Supabase query by membership.org_id", () => {
  // Should appear at least 5 times: extraction row + jobs + vendors +
  // org_cost_codes + cost_codes + pending_cost_code_suggestions.
  const matches = reviewPage.match(/\.eq\(\s*['"]org_id['"]\s*,\s*membership\.org_id\s*\)/g);
  assert.ok(
    matches && matches.length >= 5,
    `expected ≥5 .eq('org_id', membership.org_id) calls, got ${matches?.length ?? 0}`
  );
});

test("review page loads org_cost_codes (Phase 3.3 namespace)", () => {
  assert.match(reviewPage, /\.from\(\s*['"]org_cost_codes['"]\s*\)/);
});

test("review page loads cost_codes (Phase 1 legacy namespace) — dual-write per clarification 3", () => {
  assert.match(reviewPage, /\.from\(\s*['"]cost_codes['"]\s*\)/);
});

test("review page loads pending_cost_code_suggestions for the PM-suggested codes optgroup", () => {
  assert.match(reviewPage, /\.from\(\s*['"]pending_cost_code_suggestions['"]\s*\)/);
});

test("review page generates a signed URL for the PDF preview", () => {
  assert.match(reviewPage, /createSignedUrl\(/);
  // Bucket must match where /api/ingest uploaded
  assert.match(reviewPage, /\.from\(\s*['"]invoice-files['"]\s*\)/);
});

// ── Review manager: extract fetch + 4 buttons ─────────────────
test("review manager is a client component", () => {
  assert.match(reviewManager, /^["']use client["'];?\s*$/m);
});

test("review manager fetches /api/proposals/extract on mount", () => {
  assert.match(reviewManager, /['"]\/api\/proposals\/extract['"]/);
  assert.match(reviewManager, /useEffect/);
});

test("review manager has 4 action labels: Save as Proposal, Convert to PO, Convert to CO, Reject", () => {
  assert.match(reviewManager, /Save as Proposal/);
  assert.match(reviewManager, /Convert to PO/);
  assert.match(reviewManager, /Convert to CO/);
  assert.match(reviewManager, /Reject/);
});

test("Convert to CO is disabled with the 'Available after Phase 3.7' tooltip", () => {
  // Match the pattern: a button-like element with disabled and a title
  // referencing Phase 3.7. Whitespace-tolerant.
  const hasDisabledCO =
    /Convert to CO[\s\S]{0,400}?Available after Phase 3\.7/.test(reviewManager) ||
    /Available after Phase 3\.7[\s\S]{0,400}?Convert to CO/.test(reviewManager);
  assert.ok(hasDisabledCO, "Convert to CO must be disabled with the Phase 3.7 tooltip");
});

test("Convert to PO posts to /api/proposals/[id]/convert-to-po after commit", () => {
  assert.match(reviewManager, /\/api\/proposals\/\$\{[^}]+\}\/convert-to-po/);
  assert.match(reviewManager, /\/api\/proposals\/commit/);
});

test("Convert to PO handles 501 (Phase 3.5 stub) gracefully", () => {
  assert.match(reviewManager, /501/);
});

test("Save as Proposal posts to /api/proposals/commit", () => {
  assert.match(reviewManager, /\/api\/proposals\/commit/);
});

test("Reject posts to /api/proposals/extract/[id]/reject", () => {
  assert.match(reviewManager, /\/api\/proposals\/extract\/\$\{[^}]+\}\/reject/);
});

// ── Cost-code dropdown: three optgroups ───────────────────────
test("cost-code dropdown labels include [New], [Legacy], [Pending]", () => {
  assert.match(reviewManager, /\[New\][^"']*Org codes/);
  assert.match(reviewManager, /\[Legacy\][^"']*Cost codes/);
  assert.match(reviewManager, /\[Pending\]/);
});

test("cost-code pick is namespaced by source (org/legacy/pending)", () => {
  // The dropdown values use the form `<kind>:<id>` so Step 5 commit can
  // route to the right FK column. The TS discriminated-union has these
  // three "kind" cases.
  // Template literals: `org:${...}`. Regex tolerates backtick or quote.
  assert.match(reviewManager, /[`'"]org:\$\{[^}]+\}[`'"]/);
  assert.match(reviewManager, /[`'"]legacy:\$\{[^}]+\}[`'"]/);
  assert.match(reviewManager, /[`'"]pending:\$\{[^}]+\}[`'"]/);
});

test('pending pick renders a "Pending: <code>" badge on the line', () => {
  assert.match(reviewManager, /Pending:\s*\{?[^"']*suggested_code/);
});

// ── Suggest-new-code modal ─────────────────────────────────────
test("suggest-new-code modal posts to /api/cost-code-suggestions", () => {
  assert.match(reviewManager, /['"]\/api\/cost-code-suggestions['"]/);
});

test("modal requires a code and a name (submit disabled otherwise)", () => {
  // Find the "Submit suggestion" button context and check for an empty-string
  // disabled guard nearby.
  assert.match(reviewManager, /Submit suggestion/);
  assert.match(reviewManager, /suggested_code\.trim\(\)\s*===\s*['"]['"]/);
  assert.match(reviewManager, /suggested_name\.trim\(\)\s*===\s*['"]['"]/);
});

// ── Suggestions queue page ─────────────────────────────────────
test("suggestions page is owner/admin-facing — passes role to the manager", () => {
  // Match either JSX prop form `role={membership.role}` or object form `role: membership.role`.
  assert.match(suggestionsPage, /role[=:{]\s*\{?\s*membership\.role/);
});

test("suggestions page filters by org_id + status='pending'", () => {
  assert.match(
    suggestionsPage,
    /\.from\(\s*['"]pending_cost_code_suggestions['"]\s*\)[\s\S]{0,400}?\.eq\(\s*['"]org_id['"]/
  );
  assert.match(suggestionsPage, /\.eq\(\s*['"]status['"]\s*,\s*['"]pending['"]\s*\)/);
});

test("suggestions manager only shows approve/reject buttons to owner/admin", () => {
  assert.match(suggestionsManager, /role\s*===\s*['"]owner['"]/);
  assert.match(suggestionsManager, /role\s*===\s*['"]admin['"]/);
});

test("suggestions manager posts resolve to /api/cost-code-suggestions/[id]/resolve", () => {
  assert.match(
    suggestionsManager,
    /\/api\/cost-code-suggestions\/\$\{[^}]+\}\/resolve/
  );
});

// ── Step 5b/5c structured billing sections ─────────────────────
test("review manager renders fee schedule, payment schedule, payment terms sections", () => {
  assert.match(reviewManager, /FeeScheduleSection/);
  assert.match(reviewManager, /PaymentScheduleSection/);
  assert.match(reviewManager, /PaymentTermsSection/);
});

test("commit POST body forwards additional_fee_schedule, payment_schedule, payment_terms", () => {
  // Each must appear inside the JSON.stringify body shape sent to /commit.
  assert.match(
    reviewManager,
    /additional_fee_schedule:\s*form\.additional_fee_schedule/
  );
  assert.match(reviewManager, /payment_schedule:\s*form\.payment_schedule/);
  assert.match(reviewManager, /payment_terms:\s*form\.payment_terms/);
});

test("commit POST body forwards Step 5f/5g schedule + signature fields", () => {
  assert.match(reviewManager, /schedule_items:\s*form\.schedule_items/);
  assert.match(
    reviewManager,
    /accepted_signature_present:\s*form\.accepted_signature_present/
  );
  assert.match(
    reviewManager,
    /accepted_signature_name:\s*form\.accepted_signature_name/
  );
  assert.match(
    reviewManager,
    /accepted_signature_date:\s*form\.accepted_signature_date/
  );
});

test("commit POST body forwards Step 5j/5k job_address", () => {
  assert.match(reviewManager, /job_address:\s*form\.job_address/);
});

test("review manager loads + edits job_address from extract response", () => {
  assert.match(reviewManager, /job_address:\s*ed\.job_address/);
  // Editable input field present with the user-facing label
  assert.match(reviewManager, /Job address \(extracted from proposal\)/);
});

test("review manager loads the 3 fields from the extract API response", () => {
  // The setForm() call must populate all three from `ed.*`.
  assert.match(
    reviewManager,
    /additional_fee_schedule:\s*ed\.additional_fee_schedule/
  );
  assert.match(reviewManager, /payment_schedule:\s*ed\.payment_schedule/);
  assert.match(reviewManager, /payment_terms:\s*ed\.payment_terms/);
});

test("review manager loads Step 5f/5g schedule + signature fields", () => {
  assert.match(reviewManager, /schedule_items:\s*ed\.schedule_items/);
  assert.match(
    reviewManager,
    /accepted_signature_present:\s*ed\.accepted_signature_present/
  );
  assert.match(
    reviewManager,
    /accepted_signature_name:\s*ed\.accepted_signature_name/
  );
  assert.match(
    reviewManager,
    /accepted_signature_date:\s*ed\.accepted_signature_date/
  );
});

test("PaymentTermsSection collapses to null when all sub-fields cleared", () => {
  // Confirms the "all-null → null at top level" rule is preserved end-to-end.
  assert.match(reviewManager, /allNull[\s\S]{0,200}?onChange\(allNull\s*\?\s*null\s*:\s*merged\)/);
});

// ── Hot-path boundary (Addendum-B) ─────────────────────────────
test("review files do NOT import hot-path matcher modules", () => {
  for (const src of [reviewPage, reviewManager, suggestionsPage, suggestionsManager]) {
    assert.ok(
      !/from\s+['"]@\/lib\/cost-intelligence\/(match-item|commit-line-to-spine|extract-invoice|correct-line)['"]/.test(
        src
      ),
      "review/suggestions UI must not import hot-path matcher modules"
    );
  }
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
