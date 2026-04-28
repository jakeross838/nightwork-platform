/**
 * Phase 3.4 — proposal extraction smoke test.
 *
 * Gated behind RUN_PROPOSAL_EVAL=1 + ANTHROPIC_API_KEY. Runs
 * extractProposal() on each PDF in
 * __tests__/fixtures/classifier/.local/proposal/ and asserts the
 * returned ParsedProposal shape is valid.
 *
 * Methodology note: Phase 3.4 used a lightweight Jake-driven review
 * methodology rather than formal ground-truth comparison (per prompts
 * 183, 187, 191). This test confirms extraction RUNS cleanly across
 * the fixture set — it does NOT enforce per-field accuracy. Accuracy
 * was confirmed by Jake's per-fixture review captured in
 * qa-reports/qa-branch3-phase3.4.md §6.
 *
 * On `npm test` without the env var: SKIP. Default `npm test` does
 * not burn AI credit.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { strict as assert } from "node:assert";
import * as dotenv from "dotenv";

const RUN_EVAL = process.env.RUN_PROPOSAL_EVAL === "1";

if (!RUN_EVAL) {
  console.log("SKIP  proposal extraction eval (set RUN_PROPOSAL_EVAL=1 to run)");
  console.log("1 test(s) passed");
  process.exit(0);
}

dotenv.config({ path: ".env.local" });

const FIXTURE_DIR = "__tests__/fixtures/classifier/.local/proposal";
const ORG_ID = "00000000-0000-0000-0000-000000000001";
const CALL_TIMEOUT_MS = 60_000;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY missing from .env.local");
  process.exit(1);
}
if (!existsSync(FIXTURE_DIR)) {
  console.error(`Fixture dir missing: ${FIXTURE_DIR}`);
  process.exit(1);
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`timeout after ${ms}ms: ${label}`)),
      ms
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

(async () => {
  const fixtures = readdirSync(FIXTURE_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .sort();
  if (fixtures.length === 0) {
    console.error(`No PDF fixtures in ${FIXTURE_DIR}`);
    process.exit(1);
  }

  const mod = await import("../src/lib/ingestion/extract-proposal");
  let failed = 0;
  for (const fixture of fixtures) {
    const path = join(FIXTURE_DIR, fixture);
    const pdfBuffer = readFileSync(path);
    const t0 = Date.now();
    try {
      const out = await withTimeout(
        mod.extractProposal(
          { pdfBuffer },
          {
            org_id: ORG_ID,
            metadata: { source: "RUN_PROPOSAL_EVAL", fixture },
          }
        ),
        CALL_TIMEOUT_MS,
        fixture
      );
      // Shape assertions — the contract every PM-reviewable extraction
      // must satisfy. Per-field accuracy is the lightweight review.
      assert.ok(
        typeof out.vendor_name === "string" && out.vendor_name.length > 0,
        `${fixture}: vendor_name must be non-empty string`
      );
      assert.ok(
        typeof out.title === "string" && out.title.length > 0,
        `${fixture}: title must be non-empty string`
      );
      assert.ok(
        typeof out.scope_summary === "string",
        `${fixture}: scope_summary must be string`
      );
      assert.ok(
        Number.isInteger(out.total_cents),
        `${fixture}: total_cents must be integer`
      );
      assert.ok(
        Array.isArray(out.line_items) && out.line_items.length > 0,
        `${fixture}: line_items must be non-empty array`
      );
      for (const li of out.line_items) {
        assert.ok(
          typeof li.description === "string" && li.description.length > 0,
          `${fixture} line ${li.line_number}: description must be non-empty`
        );
        assert.ok(
          Number.isInteger(li.total_price_cents),
          `${fixture} line ${li.line_number}: total_price_cents must be integer`
        );
        assert.ok(
          Number.isInteger(li.line_number),
          `${fixture} line ${li.line_number}: line_number must be integer`
        );
      }
      assert.ok(
        out.confidence_score >= 0 && out.confidence_score <= 1,
        `${fixture}: confidence_score must be in [0,1]`
      );
      assert.ok(
        typeof out.accepted_signature_present === "boolean",
        `${fixture}: accepted_signature_present must be boolean`
      );
      const ms = Date.now() - t0;
      console.log(
        `PASS  ${fixture}  (${ms}ms, vendor="${out.vendor_name}", lines=${out.line_items.length}, total=$${(out.total_cents / 100).toFixed(2)})`
      );
    } catch (e) {
      failed++;
      console.log(`FAIL  ${fixture}`);
      console.log(`      ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log("");
  if (failed > 0) {
    console.error(`${failed} of ${fixtures.length} fixture(s) failed`);
    process.exit(1);
  } else {
    console.log(`${fixtures.length} fixture(s) passed`);
  }
})();
