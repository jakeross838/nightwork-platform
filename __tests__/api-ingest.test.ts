/**
 * Phase 3.2 v2 Step 2 — /api/ingest route shape fence.
 *
 * Static structural validation that the route file conforms to the
 * Phase 3.2 v2 contract:
 *   - auth gate via getCurrentMembership() (Phase A pattern, NOT
 *     auth.getUser-only and NOT requireOrgId() which the legacy
 *     /api/invoices/parse uses)
 *   - org scoping on every Supabase query
 *   - calls classifyDocument from src/lib/ingestion/classify (the
 *     post-Step-1 location, NOT the v1 src/lib/claude/classify-document)
 *   - inserts into document_extractions with invoice_id=null and
 *     verification_status='pending'; leaves target_entity_type/_id NULL
 *   - returns the contract payload {extraction_id, classified_type,
 *     classification_confidence}
 *   - does NOT touch src/app/api/invoices/parse (legacy untouched)
 *
 * Live happy-path coverage is exercised by:
 *   - __tests__/document-classifier.test.ts (calls classifyDocument
 *     directly against real fixtures, RUN_CLASSIFIER_EVAL=1)
 *   - the QA report's manual cutover-readiness checklist (curl POST)
 *
 * Spinning up the Next.js route in-process inside this static runner
 * would require a synthesized request context with auth cookies; that
 * adds fragile harness code without strengthening the contract. The
 * static checks below cover the auth/org/contract surface; the eval
 * harness covers the classifier itself.
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const ROUTE_PATH = "src/app/api/ingest/route.ts";
const LEGACY_ROUTE_PATH = "src/app/api/invoices/parse/route.ts";
const CLASSIFIER_PATH = "src/lib/ingestion/classify.ts";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

// ── Existence ──────────────────────────────────────────────────
test("route file exists at src/app/api/ingest/route.ts", () => {
  assert.ok(existsSync(ROUTE_PATH), `missing ${ROUTE_PATH}`);
});

test("classifier exists at post-Step-1 location src/lib/ingestion/classify.ts", () => {
  assert.ok(existsSync(CLASSIFIER_PATH), `missing ${CLASSIFIER_PATH}`);
});

test("legacy /api/invoices/parse route still exists (untouched cutover guarantee)", () => {
  assert.ok(existsSync(LEGACY_ROUTE_PATH), `missing ${LEGACY_ROUTE_PATH}`);
});

// ── Route content checks ───────────────────────────────────────
const routeSource = existsSync(ROUTE_PATH) ? readFileSync(ROUTE_PATH, "utf8") : "";

test("route imports getCurrentMembership from @/lib/org/session", () => {
  assert.match(
    routeSource,
    /import\s*\{[^}]*getCurrentMembership[^}]*\}\s*from\s*['"]@\/lib\/org\/session['"]/,
    "route must use getCurrentMembership() (Phase A standard)"
  );
});

test("route does NOT use requireOrgId (legacy pattern)", () => {
  assert.ok(
    !/requireOrgId/.test(routeSource),
    "route must use getCurrentMembership() instead of requireOrgId() so the membership object (with role) is available for future write authz"
  );
});

test("route imports classifyDocument from @/lib/ingestion/classify", () => {
  assert.match(
    routeSource,
    /import\s*\{[^}]*classifyDocument[^}]*\}\s*from\s*['"]@\/lib\/ingestion\/classify['"]/,
    "route must call the relocated classifier, not the legacy src/lib/claude/classify-document"
  );
});

test("route enforces auth: throws ApiError 401 when membership is null", () => {
  // We accept either an explicit Not authenticated message or a 401 status
  // to avoid coupling the test to wording; either signals the auth gate.
  const hasGate =
    /if\s*\(!membership\)\s*throw\s+new\s+ApiError\([^)]*401\)/.test(routeSource) ||
    /if\s*\(!membership\)[\s\S]{0,80}?401/.test(routeSource);
  assert.ok(hasGate, "route must reject unauthenticated callers with 401");
});

test("route inserts document_extractions with invoice_id=null", () => {
  // Match a key/value pair in the .insert({...}) block. The pattern is
  // permissive about whitespace and quote style.
  assert.match(
    routeSource,
    /\binvoice_id\s*:\s*null\b/,
    "row must be inserted with invoice_id=null per Phase 3.2 v2 scope (target_entity_type also stays NULL until commit time)"
  );
});

test("route inserts document_extractions with verification_status='pending'", () => {
  assert.match(
    routeSource,
    /verification_status\s*:\s*['"]pending['"]/,
    "initial row state must be 'pending' per spec — gets updated after classify, soft-deleted on classifier failure"
  );
});

test("route does NOT set target_entity_type or target_entity_id at insert time", () => {
  // Defensively check both columns are absent from any insert/update payload.
  // Phase 3.3+ owns these fields; Phase 3.2 v2 must not pre-populate.
  assert.ok(
    !/target_entity_type\s*:/.test(routeSource),
    "v2 must leave target_entity_type NULL — Phase 3.3+ populates at commit time"
  );
  assert.ok(
    !/target_entity_id\s*:/.test(routeSource),
    "v2 must leave target_entity_id NULL — Phase 3.3+ populates at commit time"
  );
});

test("route filters Supabase updates by org_id (org scoping)", () => {
  // Every .update() against document_extractions in this route must be
  // accompanied by .eq("org_id", membership.org_id) so a stolen extraction
  // id from another org cannot be mutated.
  const hasOrgScopedUpdate =
    /\.update\([\s\S]{0,400}?\)[\s\S]{0,200}?\.eq\(["']org_id["']\s*,\s*membership\.org_id\s*\)/.test(
      routeSource
    );
  assert.ok(
    hasOrgScopedUpdate,
    "every .update() on document_extractions must filter by org_id=membership.org_id (RLS is a backstop, not a substitute)"
  );
});

test("route storage path is org-scoped (prevents cross-tenant overwrite)", () => {
  assert.match(
    routeSource,
    /\$\{\s*membership\.org_id\s*\}\/ingest\//,
    "storage path must be ${membership.org_id}/ingest/... so cross-tenant uploads cannot collide"
  );
});

test("route returns the contract payload {extraction_id, classified_type, classification_confidence}", () => {
  // NextResponse.json({...}) must include all three keys.
  assert.match(routeSource, /extraction_id\s*:/, "response missing extraction_id");
  assert.match(
    routeSource,
    /classified_type\s*:/,
    "response missing classified_type"
  );
  assert.match(
    routeSource,
    /classification_confidence\s*:/,
    "response missing classification_confidence"
  );
});

test("route handles PlanLimitError → 429 with structured fields", () => {
  // Match either the import or the runtime check. The spec's plan-limit
  // pattern returns {error, current, limit, plan} at status 429.
  assert.match(
    routeSource,
    /PlanLimitError/,
    "route must handle PlanLimitError to surface 429 with current/limit/plan fields"
  );
  assert.match(routeSource, /\b429\b/, "PlanLimitError must map to HTTP 429");
});

test("route soft-deletes document_extractions row on classifier failure (no 'failed' enum value)", () => {
  // The verification_status enum is ('pending','partial','verified',
  // 'rejected'). There is no 'failed' value, so the spec's
  // "row status=failed on classifier failure" maps to soft-delete + log
  // here. Future schema work could add 'failed' if telemetry shows the
  // soft-delete trail isn't enough.
  assert.match(
    routeSource,
    /deleted_at\s*:\s*new\s+Date\(\)\.toISOString\(\)/,
    "route must soft-delete the document_extractions row on classifier failure to keep it out of active queries"
  );
});

// ── Legacy route untouched ─────────────────────────────────────
const legacySource = existsSync(LEGACY_ROUTE_PATH)
  ? readFileSync(LEGACY_ROUTE_PATH, "utf8")
  : "";

test("legacy /api/invoices/parse route does NOT import the new classifier (cutover boundary)", () => {
  assert.ok(
    !/from\s*['"]@\/lib\/ingestion\/classify['"]/.test(legacySource),
    "legacy /api/invoices/parse must remain classifier-free in v2 — Phase 3.10 owns the cutover"
  );
});

test("legacy /api/invoices/parse route still uses requireOrgId (proves v2 did not modify it)", () => {
  // This is a stability fence: if a future change migrates the legacy
  // route to getCurrentMembership(), this test must be updated as part
  // of that migration. v2's contract is "legacy 100% untouched".
  assert.match(
    legacySource,
    /requireOrgId/,
    "legacy route should still use requireOrgId — v2 must not modify it"
  );
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
