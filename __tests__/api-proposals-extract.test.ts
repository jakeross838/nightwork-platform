/**
 * Phase 3.4 Step 3 — /api/proposals/extract route shape fence.
 *
 * Mirrors __tests__/api-ingest.test.ts: structural validation that the
 * route file conforms to the Phase 3.4 contract. Spinning up the route
 * in-process would need synthesized auth cookies + storage mocks; the
 * fences below cover the auth/org/contract surface, and live happy-path
 * coverage comes from Step 6B's eval against real proposal PDFs.
 *
 * Fences:
 *   - auth gate via getCurrentMembership() (Phase A pattern)
 *   - extractProposal() called from the post-Step-2 location
 *   - org scoping on every Supabase query (.eq('org_id', membership.org_id))
 *   - 401 unauthenticated, 400 bad request, 404 not found, 409 wrong type,
 *     409 already committed, 429 plan limit, 500 storage/extract failure
 *   - target_entity_type='proposal' set after successful extract
 *   - extracted_data + confidence_summary returned in response
 *   - does NOT touch hot-path matcher (Addendum-B)
 *   - does NOT modify legacy /api/ingest route or invoice routes
 */

import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const ROUTE_PATH = "src/app/api/proposals/extract/route.ts";
const EXTRACTOR_PATH = "src/lib/ingestion/extract-proposal.ts";
const INGEST_ROUTE_PATH = "src/app/api/ingest/route.ts";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

// ── Existence ──────────────────────────────────────────────────
test("route file exists at src/app/api/proposals/extract/route.ts", () => {
  assert.ok(existsSync(ROUTE_PATH), `missing ${ROUTE_PATH}`);
});

test("extractor exists at src/lib/ingestion/extract-proposal.ts", () => {
  assert.ok(existsSync(EXTRACTOR_PATH), `missing ${EXTRACTOR_PATH}`);
});

const source = existsSync(ROUTE_PATH) ? readFileSync(ROUTE_PATH, "utf8") : "";
const ingestSource = existsSync(INGEST_ROUTE_PATH)
  ? readFileSync(INGEST_ROUTE_PATH, "utf8")
  : "";

// ── Auth + org scoping ─────────────────────────────────────────
test("imports getCurrentMembership from @/lib/org/session", () => {
  assert.match(
    source,
    /import\s*\{[^}]*getCurrentMembership[^}]*\}\s*from\s*['"]@\/lib\/org\/session['"]/,
    "route must use getCurrentMembership() (Phase A standard)"
  );
});

test("does NOT use requireOrgId (legacy pattern)", () => {
  assert.ok(
    !/requireOrgId/.test(source),
    "route must use getCurrentMembership() so role is available for future write authz"
  );
});

test("imports extractProposal from @/lib/ingestion/extract-proposal", () => {
  assert.match(
    source,
    /import\s*\{[^}]*extractProposal[^}]*\}\s*from\s*['"]@\/lib\/ingestion\/extract-proposal['"]/
  );
});

test("rejects unauthenticated callers with 401", () => {
  const hasGate =
    /if\s*\(!membership\)\s*throw\s+new\s+ApiError\([^)]*401\)/.test(source) ||
    /if\s*\(!membership\)[\s\S]{0,80}?401/.test(source);
  assert.ok(hasGate, "route must reject unauthenticated callers with 401");
});

test("rejects missing extraction_id with 400", () => {
  const has400 =
    /Missing\s+or\s+invalid\s+extraction_id/i.test(source) &&
    /\b400\b/.test(source);
  assert.ok(has400, "route must return 400 when extraction_id is missing");
});

// ── Org scoping ───────────────────────────────────────────────
test("loads document_extractions with .eq('org_id', membership.org_id)", () => {
  const hasOrgScopedSelect =
    /\.from\(\s*['"]document_extractions['"]\s*\)[\s\S]{0,400}?\.eq\(\s*['"]org_id['"]\s*,\s*membership\.org_id\s*\)/.test(
      source
    );
  assert.ok(
    hasOrgScopedSelect,
    "every SELECT on document_extractions must filter by org_id (RLS is a backstop, not a substitute)"
  );
});

test("updates document_extractions with .eq('org_id', membership.org_id)", () => {
  const hasOrgScopedUpdate =
    /\.update\([\s\S]{0,500}?\)[\s\S]{0,200}?\.eq\(\s*['"]org_id['"]\s*,\s*membership\.org_id\s*\)/.test(
      source
    );
  assert.ok(
    hasOrgScopedUpdate,
    "every .update() on document_extractions must filter by org_id"
  );
});

test("storage download uses bucket 'invoice-files' (matches /api/ingest upload bucket)", () => {
  // The PDF was uploaded by /api/ingest into the "invoice-files" bucket;
  // re-downloading from a different bucket would 404.
  assert.match(
    source,
    /storage[\s\S]{0,80}?\.from\(\s*['"]invoice-files['"]\s*\)/
  );
});

// ── Pre-flight checks on the row ───────────────────────────────
test("rejects non-proposal classified_type with 409", () => {
  assert.match(
    source,
    /classified_type\s*!==\s*['"]proposal['"][\s\S]{0,400}?409/,
    "route must refuse to extract proposal data from non-proposal documents"
  );
});

test("rejects already-committed extraction (target_entity_id set) with 409", () => {
  assert.match(
    source,
    /target_entity_id[\s\S]{0,500}?409/,
    "route must refuse to re-extract a committed proposal"
  );
});

test("rejects 404 when extraction row not found", () => {
  assert.match(source, /404/, "must return 404 when row not found");
  assert.match(source, /Extraction\s+not\s+found/i);
});

test("returns 500 when raw_pdf_url is missing on the row", () => {
  assert.match(
    source,
    /raw_pdf_url[\s\S]{0,200}?500/,
    "route must 500 when raw_pdf_url is null"
  );
});

// ── Post-extract write ─────────────────────────────────────────
test("post-extract update sets target_entity_type='proposal'", () => {
  assert.match(
    source,
    /target_entity_type:\s*['"]proposal['"]/,
    "post-extract update must set target_entity_type='proposal' so /commit knows the destination"
  );
});

test("post-extract update writes extraction_model + extraction_prompt_version", () => {
  assert.match(source, /extraction_model:/);
  assert.match(source, /extraction_prompt_version:/);
});

test("post-extract update writes field_confidences (overall + per-field)", () => {
  assert.match(source, /field_confidences:/);
  // Should include 'overall' rolled up from confidence_score
  assert.match(source, /overall/);
});

test("post-extract update sets extracted_at", () => {
  assert.match(source, /extracted_at:\s*new\s+Date\(\)\.toISOString\(\)/);
});

// ── Response shape ─────────────────────────────────────────────
test("response includes extraction_id, extracted_data, confidence_summary", () => {
  // Spec: returns { extraction_id, extracted_data, confidence_summary }.
  // Our impl also includes classified_type + classification_confidence
  // for parity with /api/ingest — that's permitted, the spec is a minimum.
  assert.match(source, /extraction_id:/);
  assert.match(source, /extracted_data:/);
  assert.match(source, /confidence_summary:/);
});

// ── Error handling ─────────────────────────────────────────────
test("handles PlanLimitError → 429 with structured fields", () => {
  assert.match(source, /PlanLimitError/);
  assert.match(source, /\b429\b/);
});

test("does NOT soft-delete the document_extractions row on extractor failure", () => {
  // Different from /api/ingest, which DOES soft-delete because the row
  // is brand-new on failure. Here the row pre-exists; soft-deleting
  // would orphan the classifier's result. Leave it alone, return 500.
  // The api_usage row already records the attempted call.
  assert.ok(
    !/deleted_at\s*:\s*new\s+Date\(\)\.toISOString\(\)/.test(source),
    "extract route must not soft-delete a pre-existing row on extractor failure (orphans classifier result)"
  );
});

// ── Hot-path boundary (Addendum-B) ─────────────────────────────
test("does NOT import hot-path matcher modules", () => {
  assert.ok(
    !/from\s+['"]@\/lib\/cost-intelligence\/match-item['"]/.test(source),
    "route must not import match-item.ts"
  );
  assert.ok(
    !/from\s+['"]@\/lib\/cost-intelligence\/commit-line-to-spine['"]/.test(source),
    "route must not import commit-line-to-spine.ts"
  );
  assert.ok(
    !/from\s+['"]@\/lib\/cost-intelligence\/extract-invoice['"]/.test(source),
    "route must not import extract-invoice.ts"
  );
  assert.ok(
    !/from\s+['"]@\/lib\/cost-intelligence\/correct-line['"]/.test(source),
    "route must not import correct-line.ts"
  );
});

// ── /api/ingest untouched ──────────────────────────────────────
test("legacy /api/ingest route does NOT import extractProposal (pipeline boundary)", () => {
  assert.ok(
    !/from\s+['"]@\/lib\/ingestion\/extract-proposal['"]/.test(ingestSource),
    "/api/ingest is the classifier pipeline only — extractProposal must live behind /api/proposals/extract"
  );
});

// ── Cache (Issue 1, migration 00091) ───────────────────────────
test("migration 00091 exists and adds extracted_data JSONB column", () => {
  const path = "supabase/migrations/00091_document_extractions_cache.sql";
  assert.ok(existsSync(path), `${path} missing`);
  const src = readFileSync(path, "utf8");
  assert.match(
    src,
    /ALTER\s+TABLE\s+public\.document_extractions[\s\S]{0,200}?ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+extracted_data\s+JSONB/i,
    "migration must ALTER TABLE public.document_extractions ADD COLUMN IF NOT EXISTS extracted_data JSONB"
  );
});

test("migration 00091 has a rollback companion (.down.sql)", () => {
  const path = "supabase/migrations/00091_document_extractions_cache.down.sql";
  assert.ok(existsSync(path), `${path} missing`);
  const src = readFileSync(path, "utf8");
  assert.match(
    src,
    /DROP\s+COLUMN\s+IF\s+EXISTS\s+extracted_data/i,
    "down migration must DROP COLUMN IF EXISTS extracted_data"
  );
});

test("route loads extracted_data + extraction_prompt_version from the row", () => {
  // Both columns must be in the SELECT so the cache-hit path can read
  // them without a second round-trip.
  assert.match(
    source,
    /\.select\(\s*[\s\S]{0,400}?extracted_data[\s\S]{0,200}?extraction_prompt_version/,
    "route SELECT must include extracted_data and extraction_prompt_version"
  );
});

test("route reads ?force=true query param to bypass cache", () => {
  assert.match(
    source,
    /searchParams\.get\(\s*['"]force['"]\s*\)\s*===\s*['"]true['"]/,
    "route must read ?force=true to support manual cache busting"
  );
});

test("cache hit short-circuits before storage download + extractor call", () => {
  // The cached return must appear textually BEFORE the storage download
  // and the extractProposal() call. If a future refactor accidentally
  // reorders these, the cache becomes a no-op.
  const cachedReturnIdx = source.search(
    /cache:\s*\{\s*hit:\s*true\s*\}/
  );
  const storageDownloadIdx = source.search(
    /\.storage[\s\S]{0,80}?\.download\(/
  );
  const extractCallIdx = source.search(/await\s+extractProposal\(/);
  assert.ok(cachedReturnIdx > 0, "cache hit return not found");
  assert.ok(storageDownloadIdx > 0, "storage download not found");
  assert.ok(extractCallIdx > 0, "extractProposal call not found");
  assert.ok(
    cachedReturnIdx < storageDownloadIdx,
    "cache hit must short-circuit before the storage download"
  );
  assert.ok(
    cachedReturnIdx < extractCallIdx,
    "cache hit must short-circuit before extractProposal()"
  );
});

test("cache hit guarded by extraction_prompt_version equality", () => {
  // The cache-usable predicate must require the stored prompt version
  // to match the current code-side version. Otherwise prompt iteration
  // can return stale extractions.
  assert.match(
    source,
    /cachedVersion\s*===\s*EXTRACTION_PROMPT_VERSION/,
    "cache must compare stored extraction_prompt_version to current EXTRACTION_PROMPT_VERSION"
  );
});

test("cache miss path persists extracted_data alongside metadata", () => {
  // The post-extract update must include extracted_data: parsed so the
  // next call can hit the cache. Without this write the cache is a
  // permanent miss and the migration is dead weight.
  assert.match(
    source,
    /\.update\(\s*\{[\s\S]{0,400}?extracted_data:\s*parsed/,
    "post-extract update must persist extracted_data for the next read"
  );
});

test("response includes cache: { hit: ... } discriminator", () => {
  // The UI uses this to decide whether to log re-extract events and
  // to suppress the loading copy on hits.
  assert.match(
    source,
    /cache:\s*\{\s*hit:\s*true\s*\}/,
    "cache hit response must include cache: { hit: true }"
  );
  assert.match(
    source,
    /cache:\s*\{\s*hit:\s*false[\s\S]{0,80}?reason:/,
    "cache miss response must include cache: { hit: false, reason }"
  );
});

test("prompt-version mismatch is logged for observability", () => {
  // Without a log line, prompt-iteration churn becomes silent and
  // expensive. The log must be emitted only on the mismatch path.
  assert.match(
    source,
    /cache\s+bust[\s\S]{0,200}?prompt_version/i,
    "prompt-version cache bust must console.log the mismatch"
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
