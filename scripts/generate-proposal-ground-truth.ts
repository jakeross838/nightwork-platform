/**
 * Phase 3.4 Step 6A — generate ground truth TEMPLATE for proposal eval.
 *
 * Reads every PDF under __tests__/fixtures/classifier/.local/proposal/
 * and runs extractProposal() against each. Writes a template at
 * __tests__/fixtures/classifier/.local/proposal-ground-truth.json with:
 *
 *   - "expected" object filled with placeholder strings ("<fill in>")
 *     so Jake fills in independently from the PDFs (methodology requires
 *     blind verification).
 *   - "ai_extracted_for_reference" with the full normalized AI output —
 *     visible to Jake but he must NOT copy from it.
 *
 * After this script runs:
 *   1. Jake opens each PDF + the JSON template side-by-side
 *   2. Fills in every "expected" field by reading the PDF
 *   3. Replies "ground truth complete" — then Step 6B runs the eval
 *
 * Cost: ~5 Claude Sonnet calls, negligible with prompt cache.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import * as dotenv from "dotenv";
import { extractProposal } from "../src/lib/ingestion/extract-proposal";

dotenv.config({ path: ".env.local" });

const FIXTURE_DIR = "__tests__/fixtures/classifier/.local/proposal";
const OUTPUT = "__tests__/fixtures/classifier/.local/proposal-ground-truth.json";
// Same dummy ORG_ID as the classifier eval — api_usage rows are scoped
// here for clean accounting.
const ORG_ID = "00000000-0000-0000-0000-000000000001";

interface FixtureExpected {
  vendor: string;
  total_cents: string | number;
  proposal_number: string | null;
  proposal_date: string | null;
  valid_through: string | null;
  vendor_stated_start_date: string | null;
  vendor_stated_duration_days: string | number | null;
  scope_summary: string;
  inclusions_present: string | boolean;
  exclusions_present: string | boolean;
  line_items_count: string | number;
  line_items: Array<{
    line: number;
    description: string;
    qty: string | number | null;
    uom: string | null;
    unit_price_cents: string | number | null;
    total_cents: string | number;
  }>;
}

(async () => {
  if (!existsSync(FIXTURE_DIR)) {
    console.error(`Fixture dir missing: ${FIXTURE_DIR}`);
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY missing from .env.local");
    process.exit(1);
  }

  const fixtures = readdirSync(FIXTURE_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .sort();
  if (fixtures.length === 0) {
    console.error(`No PDF fixtures in ${FIXTURE_DIR}`);
    process.exit(1);
  }
  console.log(`Found ${fixtures.length} fixture(s)`);

  const result: {
    _instructions: string;
    fixtures: Record<
      string,
      { expected: FixtureExpected; ai_extracted_for_reference: unknown }
    >;
  } = {
    _instructions:
      "Jake fills in 'expected' values per fixture by opening each PDF independently. AI-extracted output shown in 'ai_extracted_for_reference' but Jake must NOT copy it — methodology requires independent verification. Set field to null if the proposal doesn't contain it. For line_items, add one object per real line on the proposal (count may differ from AI's count).",
    fixtures: {},
  };

  let totalTokens = 0;
  const summary: Array<{
    file: string;
    vendor: string;
    total_cents: number;
    line_items_count: number;
  }> = [];

  for (const fixture of fixtures) {
    const path = join(FIXTURE_DIR, fixture);
    const pdfBuffer = readFileSync(path);
    process.stdout.write(`Extracting ${fixture}... `);
    const t0 = Date.now();
    let parsed;
    try {
      parsed = await extractProposal(
        { pdfBuffer },
        {
          org_id: ORG_ID,
          metadata: {
            source: "scripts/generate-proposal-ground-truth",
            fixture,
          },
        }
      );
    } catch (err) {
      console.log(`FAILED`);
      console.error(err instanceof Error ? err.message : String(err));
      continue;
    }
    const ms = Date.now() - t0;
    console.log(
      `${ms}ms — vendor="${parsed.vendor_name}" total_cents=${parsed.total_cents} lines=${parsed.line_items.length}`
    );

    summary.push({
      file: fixture,
      vendor: parsed.vendor_name,
      total_cents: parsed.total_cents,
      line_items_count: parsed.line_items.length,
    });

    result.fixtures[fixture] = {
      expected: {
        vendor: "<fill in>",
        total_cents: "<fill in>",
        proposal_number: null,
        proposal_date: null,
        valid_through: null,
        vendor_stated_start_date: null,
        vendor_stated_duration_days: null,
        scope_summary: "<fill in>",
        inclusions_present: "<true | false>",
        exclusions_present: "<true | false>",
        line_items_count: "<fill in>",
        line_items: [
          {
            line: 1,
            description: "<fill in>",
            qty: "<fill in or null>",
            uom: "<fill in or null>",
            unit_price_cents: "<fill in or null>",
            total_cents: "<fill in>",
          },
        ],
      },
      ai_extracted_for_reference: parsed,
    };
  }

  // Total token cost — pull from api_usage table to be accurate.
  // Skipping live DB query here; user will see cost in api_usage view.
  // Print fixture summary only.
  const outDir = dirname(OUTPUT);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(result, null, 2));

  console.log("");
  console.log(`Wrote ${OUTPUT}`);
  console.log("");
  console.log("Summary (AI-extracted, for reference only — Jake does NOT copy these):");
  console.log("─".repeat(80));
  for (const s of summary) {
    const dollars = (s.total_cents / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
    });
    console.log(`  ${s.file}`);
    console.log(`    vendor: ${s.vendor}`);
    console.log(`    total: $${dollars} (${s.total_cents} cents)`);
    console.log(`    line_items: ${s.line_items_count}`);
  }
  console.log("");
})();
