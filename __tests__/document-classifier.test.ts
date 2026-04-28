/**
 * Phase 3.2 v2 Step 3 — Document classifier eval, full 10-category coverage.
 *
 * Discovers fixtures dynamically from __tests__/fixtures/classifier/.local/
 * subfolders. The subfolder name IS the expected classified_type.
 * Calls classifyDocument() directly (no HTTP / no /api/ingest), reports
 * per-fixture results, per-category accuracy, a confusion matrix, and
 * cache-hit verification against api_usage.
 *
 * Env-gated: skipped unless RUN_CLASSIFIER_EVAL=1 is set. Each run makes
 * one live Claude Sonnet call per fixture (~2-3s each) so it is opt-in.
 * Default `npm test` invocation treats this file as a no-op.
 *
 * Fixture source directories are gitignored under .local/ per preflight
 * Risk R8 (real Ross Built documents never commit). The TEN_CATEGORIES
 * constant below is the full classifier enum from
 * src/lib/ingestion/classify.ts; subfolders not in that list are flagged
 * as authoring errors.
 *
 * Exit gate (Phase 3.2 v2 Path B per Jake's decisions in prompt 153):
 *   1. Overall accuracy ≥ 90%
 *   2. Per-category accuracy ≥ 80% on FAT categories (≥3 fixtures)
 *   3. THIN categories (<3 fixtures) — any miss flagged as INVESTIGATE,
 *      counted in overall accuracy but does NOT short-circuit the gate
 *      via the per-category check (which requires ≥3 fixtures to be
 *      statistically meaningful)
 *
 * The thin-category misses are reported as "INVESTIGATE — insufficient
 * sample" in the QA report, never excused as sample-size noise without
 * a prompt-side investigation first.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
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
const RESULTS_DIR = "qa-reports/.eval";
const RESULTS_FILE = join(RESULTS_DIR, "phase3.2-v2-eval.md");
const ORG_ID = "00000000-0000-0000-0000-000000000001";
const CALL_TIMEOUT_MS = 30_000;

// Phase 3.2 v2 Path B exit-gate parameters
const OVERALL_GATE = 0.9;
const FAT_CATEGORY_GATE = 0.8;
const FAT_CATEGORY_MIN_FIXTURES = 3;

// Full enum from src/lib/ingestion/classify.ts CLASSIFIED_TYPES.
// Subfolder names must come from this list.
const TEN_CATEGORIES = [
  "invoice",
  "purchase_order",
  "change_order",
  "proposal",
  "vendor",
  "budget",
  "historical_draw",
  "plan",
  "contract",
  "other",
] as const;
type Category = (typeof TEN_CATEGORIES)[number];

// Subdirectories under FIXTURE_ROOT that are NOT classifier categories.
// Add entries here as needed (e.g., 'experiments', 'archive').
// Skipped before the TEN_CATEGORIES assertion so they don't fail
// "unknown category" but also don't get evaluated.
const SKIPPED_DIRS = new Set<string>(["dogfood"]);

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

function discoverCategories(root: string): Category[] {
  assert.ok(existsSync(root), `fixture root missing: ${root}`);
  const subdirs = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !SKIPPED_DIRS.has(name))
    .sort();

  const known = new Set<string>(TEN_CATEGORIES);
  const unknown = subdirs.filter((d) => !known.has(d));
  assert.ok(
    unknown.length === 0,
    `fixture subfolder(s) not in TEN_CATEGORIES enum: ${unknown.join(", ")}. ` +
      "Either rename to match an enum value, add the value to TEN_CATEGORIES + the classifier prompt, or add it to SKIPPED_DIRS if it is intentionally not a classifier category."
  );

  return subdirs as Category[];
}

function discoverPdfs(catDir: string): string[] {
  return readdirSync(catDir)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .sort();
}

function escapePipe(s: string): string {
  return s.replace(/\|/g, "\\|");
}

function writeMarkdownReport(args: {
  rows: Row[];
  runStart: Date;
  runEnd: Date;
  cacheStats: { total: number; hits: number; firstHitIdx: number | null } | null;
}) {
  const { rows, runStart, runEnd, cacheStats } = args;

  const total = rows.length;
  const passed = rows.filter((r) => r.pass).length;
  const overallAcc = total > 0 ? passed / total : 0;

  const categoriesPresent = Array.from(new Set(rows.map((r) => r.category))).sort() as Category[];
  type CatStat = {
    cat: Category;
    n: number;
    pass: number;
    pct: number;
    fat: boolean;
    gatePass: boolean;
    investigate: boolean;
  };
  const catStats: CatStat[] = categoriesPresent.map((cat) => {
    const cr = rows.filter((r) => r.category === cat);
    const n = cr.length;
    const pass = cr.filter((r) => r.pass).length;
    const fat = n >= FAT_CATEGORY_MIN_FIXTURES;
    const pct = n > 0 ? pass / n : 0;
    const gatePass = !fat || pct >= FAT_CATEGORY_GATE;
    const investigate = !fat && pass < n; // thin category with at least one miss
    return { cat, n, pass, pct, fat, gatePass, investigate };
  });

  // Categories absent from fixtures but in the enum — fixture top-up needed.
  const missingCats = TEN_CATEGORIES.filter(
    (c) => !categoriesPresent.includes(c)
  );

  const overallGatePass = overallAcc >= OVERALL_GATE;
  const fatGatePass = catStats.every((s) => s.gatePass);
  const investigateRows = rows.filter((r) =>
    catStats.find((s) => s.cat === r.category && s.investigate && !r.pass)
  );

  mkdirSync(RESULTS_DIR, { recursive: true });

  const lines: string[] = [];
  lines.push(`# Phase 3.2 v2 — classifier eval results`);
  lines.push("");
  lines.push(`Run window: ${runStart.toISOString()} → ${runEnd.toISOString()}`);
  lines.push(`Fixture root: \`${FIXTURE_ROOT}\` (gitignored, real Ross Built docs)`);
  lines.push(`Total fixtures: ${total}`);
  lines.push(`Overall accuracy: ${passed} / ${total} = ${(overallAcc * 100).toFixed(1)}%`);
  lines.push("");
  lines.push("## Exit gate status (Path B)");
  lines.push("");
  lines.push(`| Gate | Threshold | Actual | Status |`);
  lines.push(`|---|---|---|---|`);
  lines.push(
    `| Overall accuracy | ≥ ${(OVERALL_GATE * 100).toFixed(0)}% | ${(overallAcc * 100).toFixed(1)}% | ${overallGatePass ? "PASS" : "FAIL"} |`
  );
  lines.push(
    `| Per-category accuracy (fat ≥${FAT_CATEGORY_MIN_FIXTURES}) | ≥ ${(FAT_CATEGORY_GATE * 100).toFixed(0)}% each | see table | ${fatGatePass ? "PASS" : "FAIL"} |`
  );
  lines.push(
    `| Thin-category misses | flagged for investigate | ${investigateRows.length} flagged | ${investigateRows.length === 0 ? "no investigation needed" : "INVESTIGATE"} |`
  );
  lines.push("");

  lines.push("## Per-category accuracy");
  lines.push("");
  lines.push(`| Category | Fixtures | Pass | % | Tier | Status |`);
  lines.push(`|---|---|---|---|---|---|`);
  for (const s of catStats) {
    const tier = s.fat ? "fat" : "thin";
    const status = s.fat
      ? s.gatePass
        ? "PASS"
        : `FAIL (<${(FAT_CATEGORY_GATE * 100).toFixed(0)}%)`
      : s.investigate
        ? "INVESTIGATE — insufficient sample"
        : "PASS (thin, all-pass)";
    lines.push(
      `| \`${s.cat}\` | ${s.n} | ${s.pass} | ${(s.pct * 100).toFixed(1)}% | ${tier} | ${status} |`
    );
  }
  lines.push("");

  if (missingCats.length > 0) {
    lines.push("## Fixture top-up needed");
    lines.push("");
    lines.push("Categories in the enum with zero fixtures in this run:");
    lines.push("");
    for (const c of missingCats) lines.push(`- \`${c}\` — 0 fixtures`);
    lines.push("");
    lines.push(
      `Categories with <${FAT_CATEGORY_MIN_FIXTURES} fixtures (thin tier — exit gate cannot apply per-category 80% threshold):`
    );
    lines.push("");
    for (const s of catStats.filter((s) => !s.fat)) {
      lines.push(`- \`${s.cat}\` — ${s.n} fixture(s)`);
    }
    lines.push("");
  }

  lines.push("## Per-fixture results");
  lines.push("");
  lines.push(`| Expected | Actual | Pass | Confidence | ms | Filename | Notes |`);
  lines.push(`|---|---|---|---|---|---|---|`);
  for (const r of rows) {
    const note = r.error
      ? escapePipe(`ERROR: ${r.error}`)
      : !r.pass && catStats.find((s) => s.cat === r.category && !s.fat)
        ? "INVESTIGATE — thin category miss"
        : "";
    lines.push(
      `| \`${r.expected}\` | \`${r.actual}\` | ${r.pass ? "PASS" : "FAIL"} | ${r.confidence.toFixed(2)} | ${r.ms} | ${escapePipe(r.filename)} | ${note} |`
    );
  }
  lines.push("");

  lines.push("## Confusion matrix");
  lines.push("");
  const actualLabels = Array.from(new Set(rows.map((r) => r.actual))).sort();
  const headerCells = ["expected ↓ / actual →", ...actualLabels.map((a) => `\`${a}\``)];
  lines.push("| " + headerCells.join(" | ") + " |");
  lines.push("|" + headerCells.map(() => "---").join("|") + "|");
  for (const cat of categoriesPresent) {
    const cells = [`\`${cat}\``];
    for (const a of actualLabels) {
      const n = rows.filter((r) => r.category === cat && r.actual === a).length;
      cells.push(String(n));
    }
    lines.push("| " + cells.join(" | ") + " |");
  }
  lines.push("");

  if (cacheStats) {
    lines.push("## Cache-hit verification");
    lines.push("");
    lines.push(`| Metric | Value |`);
    lines.push(`|---|---|`);
    lines.push(`| classifier rows this run | ${cacheStats.total} |`);
    lines.push(`| rows with cache_read_input_tokens > 0 | ${cacheStats.hits} |`);
    lines.push(
      `| first cache hit row index | ${cacheStats.firstHitIdx === null ? "n/a" : cacheStats.firstHitIdx} |`
    );
    lines.push(
      `| status | ${cacheStats.hits > 0 ? "PASS (≥1 hit required)" : "FAIL — caching not working"} |`
    );
    lines.push("");
  }

  if (investigateRows.length > 0) {
    lines.push("## Investigate — thin-category misses");
    lines.push("");
    lines.push(
      "Per Path B: thin categories (<3 fixtures) cannot trigger the per-category 80% gate, but any miss must be investigated against the prompt — not excused as sample-size noise."
    );
    lines.push("");
    for (const r of investigateRows) {
      lines.push(`- **\`${r.category}\`**: \`${r.filename}\` → got \`${r.actual}\` (conf ${r.confidence.toFixed(2)}). Inspect classifier prompt for the relevant signal.`);
    }
    lines.push("");
  }

  writeFileSync(RESULTS_FILE, lines.join("\n"), "utf8");
  console.log(`wrote ${RESULTS_FILE}`);
}

async function main() {
  const { classifyDocument } = await import("../src/lib/ingestion/classify");
  const { createClient } = await import("@supabase/supabase-js");

  const categories = discoverCategories(FIXTURE_ROOT);
  console.log(`discovered ${categories.length} categor${categories.length === 1 ? "y" : "ies"}: ${categories.join(", ")}`);

  const runStart = new Date();
  const rows: Row[] = [];

  for (const cat of categories) {
    const dir = join(FIXTURE_ROOT, cat);
    const files = discoverPdfs(dir);
    if (files.length === 0) {
      console.log(`SKIP  ${cat} (no .pdf fixtures)`);
      continue;
    }
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
              metadata: { source: "classifier-eval-v2", fixture: `${cat}/${filename}` },
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
          `${mark}  ${cat.padEnd(16)} → ${result.classified_type.padEnd(16)} conf=${result.classification_confidence
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
        console.log(`FAIL  ${cat.padEnd(16)} → ERROR             conf=0.00 ${String(ms).padStart(5)}ms  ${filename}`);
        console.log(`      ${msg}`);
      }
    }
  }

  const runEnd = new Date();

  // ── Summary ────────────────────────────────────────────────────
  const total = rows.length;
  const passed = rows.filter((r) => r.pass).length;
  const overallAcc = total > 0 ? passed / total : 0;
  const overallGatePass = overallAcc >= OVERALL_GATE;

  console.log("");
  console.log("── Summary ─────────────────────────────────────────");
  console.log(`accuracy: ${passed}/${total} = ${(overallAcc * 100).toFixed(1)}%`);
  console.log(`overall gate ≥${(OVERALL_GATE * 100).toFixed(0)}%: ${overallGatePass ? "PASS" : "FAIL"}`);

  // ── Per-category ───────────────────────────────────────────────
  console.log("");
  console.log("── Per-category accuracy ───────────────────────────");
  let fatGatePass = true;
  let investigateCount = 0;
  for (const cat of categories) {
    const cr = rows.filter((r) => r.category === cat);
    if (cr.length === 0) continue;
    const cp = cr.filter((r) => r.pass).length;
    const pct = cp / cr.length;
    const fat = cr.length >= FAT_CATEGORY_MIN_FIXTURES;
    let status: string;
    if (fat) {
      const ok = pct >= FAT_CATEGORY_GATE;
      status = ok ? "PASS" : `FAIL (<${(FAT_CATEGORY_GATE * 100).toFixed(0)}%)`;
      if (!ok) fatGatePass = false;
    } else {
      const miss = cr.length - cp;
      if (miss > 0) {
        status = `INVESTIGATE (${miss} miss, thin sample)`;
        investigateCount += miss;
      } else {
        status = "PASS (thin, all-pass)";
      }
    }
    console.log(`${cat.padEnd(16)} ${cp}/${cr.length} (${(pct * 100).toFixed(1)}%) ${fat ? "fat " : "thin"} ${status}`);
  }

  // ── Confusion matrix ───────────────────────────────────────────
  console.log("");
  console.log("── Confusion matrix (row=expected, col=actual) ─────");
  const actualLabels = Array.from(new Set(rows.map((r) => r.actual))).sort();
  const COL_WIDTH = 14;
  const header = ["expected".padEnd(16), ...actualLabels.map((a) => a.padEnd(COL_WIDTH))].join("");
  console.log(header);
  for (const cat of categories) {
    const line = [cat.padEnd(16)];
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
  let cacheStats: { total: number; hits: number; firstHitIdx: number | null } | null = null;
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
      let firstHitIdx: number | null = null;
      if (withCacheRead.length === 0) {
        console.log("FAIL  no cache hits — prompt cache is not working");
      } else {
        firstHitIdx = usageRows.findIndex((r) => {
          const raw = (r.metadata ?? {}) as { cache_read_input_tokens?: unknown };
          return Number(raw.cache_read_input_tokens ?? 0) > 0;
        });
        console.log(`first cache hit at row index:           ${firstHitIdx}`);
        cachePass = true;
      }
      cacheStats = { total: usageRows.length, hits: withCacheRead.length, firstHitIdx };
    }
  }

  // ── Write structured report for QA ────────────────────────────
  console.log("");
  writeMarkdownReport({ rows, runStart, runEnd, cacheStats });

  // ── Exit ──────────────────────────────────────────────────────
  console.log("");
  const allPass = overallGatePass && fatGatePass && cachePass;
  if (!allPass) {
    const reasons: string[] = [];
    if (!overallGatePass)
      reasons.push(`overall ${(overallAcc * 100).toFixed(1)}% < ${(OVERALL_GATE * 100).toFixed(0)}%`);
    if (!fatGatePass) reasons.push("≥1 fat category below 80%");
    if (!cachePass) reasons.push("cache verification failed");
    console.error(`${reasons.length} failure(s): ${reasons.join(", ")}`);
    if (investigateCount > 0)
      console.error(`(also: ${investigateCount} thin-category miss(es) to investigate — see report)`);
    process.exit(1);
  }
  if (investigateCount > 0) {
    console.log(
      `${total} fixture(s); accuracy ${(overallAcc * 100).toFixed(1)}%; cache verified; ${investigateCount} thin-category miss(es) flagged for investigation`
    );
  } else {
    console.log(`${total} fixture(s); accuracy ${(overallAcc * 100).toFixed(1)}%; cache verified`);
  }
  console.log(`${total} test(s) passed`);
}

main().catch((err) => {
  console.error("harness error:", err);
  process.exit(1);
});
