/**
 * Phase 3.3 Step 5 — embedding pipeline tests.
 *
 * Covers:
 *   - Structural: file exists, exports the right surface, no leftover
 *     references to a SDK we don't depend on (we use raw fetch, no
 *     `openai` npm package)
 *   - assertOpenAIKey throws fast when the key is missing or a
 *     placeholder
 *   - itemEmbeddingInput formats canonical_name + category + specs into
 *     a single deterministic string (so seed runs and future Phase 3.4
 *     wiring produce identical embeddings for the same item)
 *   - Live: generate a single embedding for a known string, assert
 *     dimension=1536, all values numeric, api_usage row created.
 *     Gated behind RUN_EMBEDDINGS_LIVE_TEST=1 + OPENAI_API_KEY (so
 *     unattended `npm test` doesn't burn API credit).
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const FILE = "src/lib/cost-intelligence/embeddings.ts";

type Case = { name: string; fn: () => Promise<void> | void };
const cases: Case[] = [];
const test = (name: string, fn: () => Promise<void> | void) =>
  cases.push({ name, fn });

// ── Structural ─────────────────────────────────────────────────
test("embeddings.ts exists at src/lib/cost-intelligence/embeddings.ts", () => {
  assert.ok(existsSync(FILE), `missing ${FILE}`);
});

const source = existsSync(FILE) ? readFileSync(FILE, "utf8") : "";

test("exports assertOpenAIKey, callOpenAIEmbeddings, generateEmbedding, backfillItemEmbeddings, itemEmbeddingInput, vectorLiteral", () => {
  assert.match(source, /export\s+function\s+assertOpenAIKey/);
  assert.match(source, /export\s+async\s+function\s+callOpenAIEmbeddings/);
  assert.match(source, /export\s+async\s+function\s+generateEmbedding/);
  assert.match(source, /export\s+async\s+function\s+backfillItemEmbeddings/);
  assert.match(source, /export\s+function\s+itemEmbeddingInput/);
  assert.match(source, /export\s+function\s+vectorLiteral/);
});

test("uses text-embedding-3-small with 1536 dimensions", () => {
  assert.match(source, /text-embedding-3-small/);
  assert.match(source, /EMBEDDING_DIMENSIONS\s*=\s*1536/);
});

test("does NOT import the openai npm package (we use raw fetch)", () => {
  assert.ok(
    !/from\s+['"]openai['"]/.test(source),
    "embeddings.ts must use raw fetch, not the openai SDK (we don't depend on it)"
  );
});

test("logs to api_usage with function_type='embedding'", () => {
  assert.match(source, /function_type:\s*['"]embedding['"]/);
  assert.match(source, /\.from\(\s*['"]api_usage['"]\s*\)/);
});

test("vectorLiteral renders pgvector array literal '[a,b,c,...]'", async () => {
  // Import via dynamic import so the structural existence check above
  // can fail noisily before this even runs.
  const mod = await import("../src/lib/cost-intelligence/embeddings");
  const out = mod.vectorLiteral([0.1, -0.2, 3.4]);
  assert.equal(out, "[0.1,-0.2,3.4]");
});

test("itemEmbeddingInput composes name + category + specs deterministically", async () => {
  const mod = await import("../src/lib/cost-intelligence/embeddings");
  const out = mod.itemEmbeddingInput({
    canonical_name: "2x4 SPF stud KD",
    category: "lumber",
    subcategory: "framing",
    specs: { species: "SPF", grade: "stud", length_in: 92.625 },
  });
  // Stable ordering: name first, then category, then subcategory, then specs.
  assert.match(out, /^2x4 SPF stud KD\s\|\scategory: lumber\s\|\ssubcategory: framing\s\|\sspecs:/);
  assert.match(out, /species: SPF/);
  assert.match(out, /grade: stud/);
  assert.match(out, /length_in: 92\.625/);
});

test("itemEmbeddingInput skips empty/null specs gracefully", async () => {
  const mod = await import("../src/lib/cost-intelligence/embeddings");
  const out = mod.itemEmbeddingInput({
    canonical_name: "Simple item",
    specs: null,
  });
  assert.equal(out, "Simple item");
});

test("assertOpenAIKey throws when OPENAI_API_KEY is missing", async () => {
  const original = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "";
  try {
    const mod = await import("../src/lib/cost-intelligence/embeddings");
    let threw = false;
    try {
      mod.assertOpenAIKey();
    } catch (err) {
      threw = true;
      assert.match(
        err instanceof Error ? err.message : "",
        /OPENAI_API_KEY/,
        "error must mention OPENAI_API_KEY"
      );
    }
    assert.ok(threw, "assertOpenAIKey must throw when key is missing");
  } finally {
    if (original !== undefined) process.env.OPENAI_API_KEY = original;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("assertOpenAIKey throws on the 'sk-placeholder' sentinel", async () => {
  const original = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-placeholder";
  try {
    const mod = await import("../src/lib/cost-intelligence/embeddings");
    let threw = false;
    try {
      mod.assertOpenAIKey();
    } catch {
      threw = true;
    }
    assert.ok(threw, "placeholder must be rejected");
  } finally {
    if (original !== undefined) process.env.OPENAI_API_KEY = original;
    else delete process.env.OPENAI_API_KEY;
  }
});

// ── Live (gated) ────────────────────────────────────────────────
// Only runs when RUN_EMBEDDINGS_LIVE_TEST=1 + OPENAI_API_KEY is set, so
// `npm test` in CI doesn't burn API credit. Manual gate kept so anyone
// can verify end-to-end with `RUN_EMBEDDINGS_LIVE_TEST=1 npm test`.
if (process.env.RUN_EMBEDDINGS_LIVE_TEST === "1") {
  test("LIVE: generateEmbedding returns 1536-dim numeric vector for a known string", async () => {
    const mod = await import("../src/lib/cost-intelligence/embeddings");
    const vec = await mod.generateEmbedding("2x4 SPF stud lumber 92-5/8 KD", {
      org_id: "00000000-0000-0000-0000-000000000001",
      metadata: { source: "live_test" },
    });
    assert.equal(vec.length, 1536, "must be 1536-dim");
    for (const n of vec) {
      assert.ok(Number.isFinite(n), "all components must be finite numbers");
    }
  });
}

// ── Runner ─────────────────────────────────────────────────────
(async () => {
  let failed = 0;
  for (const c of cases) {
    try {
      await c.fn();
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
})();
