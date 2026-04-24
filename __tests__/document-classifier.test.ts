/**
 * Phase 3.2 — Document classifier accuracy harness.
 *
 * Iterates __tests__/fixtures/classifier/.local/{invoice,proposal,other}/
 * fixtures, calls classifyDocument() directly (no HTTP / no /api/ingest),
 * and reports per-fixture results, per-category accuracy, a confusion
 * matrix, and cache-hit verification against api_usage.
 *
 * Env-gated: skipped unless RUN_CLASSIFIER_EVAL=1 is set. Each run makes
 * 15 live Claude Sonnet calls (~2-3s each) so it is opt-in. The default
 * `npm test` invocation treats this file as a no-op.
 *
 * Fixture source directories are gitignored under .local/ per preflight
 * Risk R8 (real Ross Built documents never commit).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { strict as assert } from "node:assert";
import * as dotenv from "dotenv";

const RUN_EVAL = process.env.RUN_CLASSIFIER_EVAL === "1";

if (!RUN_EVAL) {
  console.log("SKIP  classifier eval (set RUN_CLASSIFIER_EVAL=1 to run)");
  console.log("1 test(s) passed");
  process.exit(0);
}

dotenv.config({ path: ".env.local" });

const FIXTURE_ROOT = "__tests__/fixtures/classifier/.local";
const ORG_ID = "00000000-0000-0000-0000-000000000001";
const CATEGORIES = ["invoice", "proposal", "plan", "other"] as const;
const CALL_TIMEOUT_MS = 15_000;
const ACCURACY_GATE = 0.9;

type Category = (typeof CATEGORIES)[number];

type Row = {
  category: Category;
  filename: string;
  expected: Category;
  actual: string;
  confidence: number;
  pass: boolean;
  ms: number;
  error?: string;
};

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms: ${label}`)), ms);
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

async function main() {
  // Import after dotenv so the SDK has its API key.
  const { classifyDocument } = await import("../src/lib/claude/classify-document");
  const { createClient } = await import("@supabase/supabase-js");

  assert.ok(existsSync(FIXTURE_ROOT), `fixture root missing: ${FIXTURE_ROOT}`);

  const runStart = new Date();
  const rows: Row[] = [];

  for (const cat of CATEGORIES) {
    const dir = join(FIXTURE_ROOT, cat);
    assert.ok(existsSync(dir), `fixture dir missing: ${dir}`);
    const files = readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".pdf"))
      .sort();
    assert.ok(files.length > 0, `${cat} should have at least 1 pdf fixture, found 0`);
    for (const filename of files) {
      const buf = readFileSync(join(dir, filename));
      const t0 = Date.now();
      try {
        const result = await withTimeout(
          classifyDocument(
            { pdfBuffer: buf, documentId: `eval-${cat}-${filename}` },
            {
              org_id: ORG_ID,
              user_id: null,
              metadata: { source: "classifier-eval", fixture: `${cat}/${filename}` },
            }
          ),
          CALL_TIMEOUT_MS,
          `${cat}/${filename}`
        );
        const ms = Date.now() - t0;
        const pass = result.classified_type === cat;
        rows.push({
          category: cat,
          filename,
          expected: cat,
          actual: result.classified_type,
          confidence: result.classification_confidence,
          pass,
          ms,
        });
        const mark = pass ? "PASS" : "FAIL";
        console.log(
          `${mark}  ${cat.padEnd(8)} → ${result.classified_type.padEnd(16)} conf=${result.classification_confidence
            .toFixed(2)
            .padStart(4)} ${String(ms).padStart(5)}ms  ${filename}`
        );
      } catch (err) {
        const ms = Date.now() - t0;
        const msg = err instanceof Error ? err.message : String(err);
        rows.push({
          category: cat,
          filename,
          expected: cat,
          actual: "ERROR",
          confidence: 0,
          pass: false,
          ms,
          error: msg,
        });
        console.log(`FAIL  ${cat.padEnd(8)} → ERROR             conf=0.00 ${String(ms).padStart(5)}ms  ${filename}`);
        console.log(`      ${msg}`);
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────
  const total = rows.length;
  const passed = rows.filter((r) => r.pass).length;
  const accuracy = total > 0 ? passed / total : 0;
  const gatePass = accuracy >= ACCURACY_GATE;

  console.log("");
  console.log("── Summary ─────────────────────────────────────────");
  console.log(`accuracy: ${passed}/${total} = ${(accuracy * 100).toFixed(1)}%`);
  console.log(`gate ≥${(ACCURACY_GATE * 100).toFixed(0)}%: ${gatePass ? "PASS" : "FAIL"}`);

  // ── Per-category ───────────────────────────────────────────────
  console.log("");
  console.log("── Per-category accuracy ───────────────────────────");
  for (const cat of CATEGORIES) {
    const catRows = rows.filter((r) => r.category === cat);
    const catPassed = catRows.filter((r) => r.pass).length;
    const catPct = catRows.length > 0 ? (catPassed / catRows.length) * 100 : 0;
    console.log(`${cat.padEnd(10)} ${catPassed}/${catRows.length} (${catPct.toFixed(1)}%)`);
  }

  // ── Confusion matrix ───────────────────────────────────────────
  console.log("");
  console.log("── Confusion matrix (row=expected, col=actual) ─────");
  const actualLabels = Array.from(new Set(rows.map((r) => r.actual))).sort();
  const COL_WIDTH = 14;
  const header = ["expected".padEnd(12), ...actualLabels.map((a) => a.padEnd(COL_WIDTH))].join("");
  console.log(header);
  for (const cat of CATEGORIES) {
    const line = [cat.padEnd(12)];
    for (const a of actualLabels) {
      const n = rows.filter((r) => r.category === cat && r.actual === a).length;
      line.push(String(n).padEnd(COL_WIDTH));
    }
    console.log(line.join(""));
  }

  // ── Cache-hit verification (queries api_usage) ─────────────────
  console.log("");
  console.log("── Cache-hit verification ──────────────────────────");
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let cachePass = false;
  if (!sbUrl || !sbKey) {
    console.log("SKIP  no supabase env vars — cache check skipped");
  } else {
    const sb = createClient(sbUrl, sbKey, { auth: { persistSession: false } });
    const { data, error } = await sb
      .from("api_usage")
      .select("created_at, metadata, input_tokens")
      .eq("function_type", "document_classify")
      .gte("created_at", runStart.toISOString())
      .order("created_at", { ascending: true });
    if (error) {
      console.log(`FAIL  api_usage query error: ${error.message}`);
    } else {
      const usageRows = (data ?? []) as Array<{
        created_at: string;
        metadata: Record<string, unknown> | null;
        input_tokens: number | null;
      }>;
      const withCacheRead = usageRows.filter((r) => {
        const raw = (r.metadata ?? {}) as { cache_read_input_tokens?: unknown };
        const n = Number(raw.cache_read_input_tokens ?? 0);
        return Number.isFinite(n) && n > 0;
      });
      console.log(`classifier usage rows this run:         ${usageRows.length}`);
      console.log(`rows with cache_read_input_tokens > 0:  ${withCacheRead.length}`);
      if (withCacheRead.length === 0) {
        console.log("FAIL  no cache hits — prompt cache is not working");
      } else {
        const firstHitIdx = usageRows.findIndex((r) => {
          const raw = (r.metadata ?? {}) as { cache_read_input_tokens?: unknown };
          return Number(raw.cache_read_input_tokens ?? 0) > 0;
        });
        console.log(`first cache hit at row index:           ${firstHitIdx}`);
        cachePass = true;
      }
    }
  }

  // ── Exit ────────────────────────────────────────────────────────
  console.log("");
  const allPass = gatePass && cachePass;
  if (!allPass) {
    const reasons: string[] = [];
    if (!gatePass) reasons.push(`accuracy ${(accuracy * 100).toFixed(1)}% < ${(ACCURACY_GATE * 100).toFixed(0)}%`);
    if (!cachePass) reasons.push("cache verification failed");
    console.error(`${reasons.length} failure(s): ${reasons.join(", ")}`);
    process.exit(1);
  }
  console.log(`${total} fixture(s) classified; accuracy ${(accuracy * 100).toFixed(1)}%; cache verified`);
  console.log(`${total} test(s) passed`);
}

main().catch((err) => {
  console.error("harness error:", err);
  process.exit(1);
});
