/**
 * Phase 3.2 v2 — fallback dogfood when /api/ingest auth cookie is unworkable.
 *
 * The original dogfood-ingest.ts script POSTs each PDF to /api/ingest,
 * which requires a real authenticated session cookie. When Jake's
 * Supabase chunked auth cookie can't be reliably reconstructed from a
 * paste (the chunk boundary in DevTools collapses certain characters),
 * this script provides an end-around: call classifyDocument() directly
 * on every PDF in the dogfood folder.
 *
 * What this proves vs what it skips:
 *   PROVES   — classifier handles docs not in the eval fixture set
 *              (no overfitting); per-doc classified_type, confidence,
 *              cache hit, latency.
 *   SKIPS    — /api/ingest plumbing (multipart upload, document_extractions
 *              insert, soft-delete-on-failure). That surface is already
 *              covered by __tests__/api-ingest.test.ts (17 static fences)
 *              and by manual curl with a real session cookie when one
 *              is available.
 *
 * Usage:
 *   npx tsx scripts/dogfood-classify-direct.ts
 *
 * Writes qa-reports/qa-branch3-phase3.2-v2-dogfood.md with the same
 * Expected + Pass/fail columns Jake fills in after the run.
 */
import { readFileSync, statSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DOGFOOD_DIR = "__tests__/fixtures/classifier/.local/dogfood";
const REPORT_PATH = "qa-reports/qa-branch3-phase3.2-v2-dogfood.md";
const ORG_ID = "00000000-0000-0000-0000-000000000001";
const LOW_CONFIDENCE_THRESHOLD = 0.7;

function escapePipe(s: string): string {
  return s.replace(/\|/g, "\\|");
}

function countPdfPages(buf: Buffer): number {
  const text = buf.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : 0;
}

type Result = {
  filename: string;
  fileSize: number;
  pageCount: number;
  classifiedType: string | null;
  confidence: number | null;
  cacheHit: boolean | null;
  inputTokens: number | null;
  cacheReadTokens: number | null;
  latencyMs: number;
  error: string | null;
};

async function main() {
  if (!existsSync(DOGFOOD_DIR)) {
    console.error(`error: fixture dir missing: ${DOGFOOD_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(DOGFOOD_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .sort();
  if (files.length === 0) {
    console.error(`error: no .pdf files under ${DOGFOOD_DIR}`);
    process.exit(1);
  }

  const { classifyDocument } = await import("../src/lib/ingestion/classify");

  console.log(`found ${files.length} fixture(s) under ${DOGFOOD_DIR}`);
  console.log(`mode: classifier-direct (skips /api/ingest plumbing — see header comment)`);
  console.log("");

  const runStart = new Date();
  const results: Result[] = [];

  for (const filename of files) {
    const path = join(DOGFOOD_DIR, filename);
    const buf = readFileSync(path);
    const fileSize = statSync(path).size;
    const pageCount = countPdfPages(buf);

    process.stdout.write(`→ ${filename} (${(fileSize / 1024).toFixed(1)} KB, ${pageCount}p) ... `);

    const t0 = Date.now();
    try {
      const out = await classifyDocument(
        { pdfBuffer: buf, documentId: `dogfood-${filename}` },
        {
          org_id: ORG_ID,
          user_id: null,
          metadata: { source: "classifier-dogfood-direct", fixture: `dogfood/${filename}` },
        }
      );
      const latencyMs = Date.now() - t0;
      results.push({
        filename,
        fileSize,
        pageCount,
        classifiedType: out.classified_type,
        confidence: out.classification_confidence,
        cacheHit: null,
        inputTokens: null,
        cacheReadTokens: null,
        latencyMs,
        error: null,
      });
      console.log(`${out.classified_type} (conf ${out.classification_confidence.toFixed(2)}, ${latencyMs}ms)`);
    } catch (err) {
      const latencyMs = Date.now() - t0;
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        filename,
        fileSize,
        pageCount,
        classifiedType: null,
        confidence: null,
        cacheHit: null,
        inputTokens: null,
        cacheReadTokens: null,
        latencyMs,
        error: message,
      });
      console.log(`ERROR ${message}`);
    }
  }

  // Pull cache metadata from api_usage for the rows we just produced.
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (sbUrl && sbKey) {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(sbUrl, sbKey, { auth: { persistSession: false } });
    const { data, error } = await sb
      .from("api_usage")
      .select("metadata, input_tokens, created_at")
      .eq("function_type", "document_classify")
      .gte("created_at", runStart.toISOString())
      .order("created_at", { ascending: true });
    if (error) {
      console.warn(`warn: api_usage query error: ${error.message}`);
    } else {
      const usageRows = (data ?? []) as Array<{
        metadata: Record<string, unknown> | null;
        input_tokens: number | null;
        created_at: string;
      }>;
      // Match by metadata.fixture (the `dogfood/<filename>` we stamped above).
      for (const r of results) {
        const target = `dogfood/${r.filename}`;
        const row = usageRows.find((u) => {
          const md = (u.metadata ?? {}) as { fixture?: string };
          return md.fixture === target;
        });
        if (row) {
          const md = (row.metadata ?? {}) as { cache_read_input_tokens?: unknown };
          const cacheRead = Number(md.cache_read_input_tokens ?? 0);
          r.cacheHit = Number.isFinite(cacheRead) && cacheRead > 0;
          r.cacheReadTokens = cacheRead;
          r.inputTokens = Number(row.input_tokens ?? 0);
        }
      }
    }
  }

  // ── Write report ─────────────────────────────────────────────
  const total = results.length;
  const succeeded = results.filter((r) => r.error === null).length;
  const failed = total - succeeded;
  const lowConf = results.filter(
    (r) => r.confidence !== null && r.confidence < LOW_CONFIDENCE_THRESHOLD
  ).length;
  const cacheKnown = results.filter((r) => r.cacheHit !== null);
  const cacheHits = cacheKnown.filter((r) => r.cacheHit === true).length;
  const cacheRate =
    cacheKnown.length === 0 ? "n/a" : `${((cacheHits / cacheKnown.length) * 100).toFixed(1)}%`;
  const avgLatency =
    total === 0 ? 0 : Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / total);

  const lines: string[] = [];
  lines.push("# Phase 3.2 v2 — dogfood report (classifier-direct mode)");
  lines.push("");
  lines.push(`Run window: ${runStart.toISOString()} → ${new Date().toISOString()}`);
  lines.push(`Mode: **classifier-direct**. Skips /api/ingest plumbing — see §Mode below.`);
  lines.push(`Fixture root: \`${DOGFOOD_DIR}\` (gitignored — real Ross Built docs only)`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|---|---|");
  lines.push(`| Total documents | ${total} |`);
  lines.push(`| Successful classifications | ${succeeded} |`);
  lines.push(`| Failed (classifier error) | ${failed} |`);
  lines.push(`| Low-confidence rows (<${LOW_CONFIDENCE_THRESHOLD}) | ${lowConf} |`);
  lines.push(`| Avg latency | ${avgLatency} ms |`);
  lines.push(`| Cache-hit rate (api_usage) | ${cacheRate} |`);
  lines.push("");
  lines.push("## Mode — why classifier-direct, not /api/ingest");
  lines.push("");
  lines.push("The original dogfood plan POSTed each PDF to `/api/ingest` with Jake's");
  lines.push("authenticated session cookie. Supabase splits long auth tokens into");
  lines.push("chunked cookies (`name.0`, `name.1`); when copied from Chrome DevTools");
  lines.push("and pasted, the chunk boundary loses a few separator characters that");
  lines.push("aren't recoverable from the visible text — the SSR base64-URL decoder");
  lines.push("then errors with `Invalid UTF-8 sequence`.");
  lines.push("");
  lines.push("Rather than burn another cycle on cookie extraction, this run calls");
  lines.push("`classifyDocument()` directly on every PDF in the dogfood folder.");
  lines.push("");
  lines.push("**What this proves:** the classifier classifies real, unseen Ross Built");
  lines.push("documents correctly (no overfitting to the eval fixture set).");
  lines.push("");
  lines.push("**What this skips:** the `/api/ingest` plumbing — multipart upload,");
  lines.push("`document_extractions` insert/update with `invoice_id=null`, soft-delete");
  lines.push("on classifier failure. That surface is covered separately by the 17");
  lines.push("static fences in `__tests__/api-ingest.test.ts` and by future manual");
  lines.push("curl-with-cookie when a clean session cookie is available.");
  lines.push("");
  lines.push("## Per-fixture results");
  lines.push("");
  lines.push("**Jake fills `Expected` and `Pass/fail` after the run.** Use one of the");
  lines.push("ten enum values for Expected: `invoice`, `purchase_order`, `change_order`,");
  lines.push("`proposal`, `vendor`, `budget`, `historical_draw`, `plan`, `contract`, `other`.");
  lines.push("");
  lines.push("| # | Filename | Size (KB) | Pages | Classified | Confidence | Cache hit | Latency (ms) | Expected | Pass/fail |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|");
  results.forEach((r, idx) => {
    const sizeKB = (r.fileSize / 1024).toFixed(1);
    const cls = r.classifiedType ?? (r.error ? `ERROR (${r.error})` : "—");
    const conf = r.confidence === null ? "—" : r.confidence.toFixed(2);
    const cache = r.cacheHit === null ? "?" : r.cacheHit ? "yes" : "no";
    lines.push(
      `| ${idx + 1} | ${escapePipe(r.filename)} | ${sizeKB} | ${r.pageCount} | \`${cls}\` | ${conf} | ${cache} | ${r.latencyMs} | _fill_ | _fill_ |`
    );
  });
  lines.push("");

  if (lowConf > 0) {
    lines.push("## Low-confidence rows");
    lines.push("");
    lines.push(`These rows landed at confidence <${LOW_CONFIDENCE_THRESHOLD} and would be flagged for manual type selection in the eventual Phase 3.10 surface.`);
    lines.push("");
    for (const r of results) {
      if (r.confidence !== null && r.confidence < LOW_CONFIDENCE_THRESHOLD) {
        lines.push(`- **${escapePipe(r.filename)}** → \`${r.classifiedType}\` at ${r.confidence.toFixed(2)}`);
      }
    }
    lines.push("");
  }

  if (failed > 0) {
    lines.push("## Failures");
    lines.push("");
    for (const r of results) {
      if (r.error !== null) {
        lines.push(`- **${escapePipe(r.filename)}** — ${escapePipe(r.error)}`);
      }
    }
    lines.push("");
  }

  mkdirSync("qa-reports", { recursive: true });
  writeFileSync(REPORT_PATH, lines.join("\n"), "utf8");
  console.log("");
  console.log(`wrote ${REPORT_PATH}`);
  console.log(`run complete — ${total} fixture(s), ${failed} failure(s)`);
  console.log(`open ${REPORT_PATH} and fill in Expected + Pass/fail columns.`);
}

main().catch((err) => {
  console.error("dogfood-classify-direct fatal error:", err);
  process.exit(1);
});
