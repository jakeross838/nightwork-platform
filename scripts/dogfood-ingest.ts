/**
 * Phase 3.2 v2 — /api/ingest dogfood harness.
 *
 * Iterates every PDF in __tests__/fixtures/classifier/.local/dogfood/
 * and POSTs each to the local /api/ingest endpoint using a real
 * authenticated session cookie. Captures classification responses,
 * joins to api_usage for cache-hit metadata, and writes a markdown
 * report at qa-reports/qa-branch3-phase3.2-v2-dogfood.md.
 *
 * The report has placeholder columns for "Jake's expected type" and
 * "Pass/fail" so Jake fills those in after reviewing each result.
 *
 * Usage:
 *   1. npm run dev (separate terminal — leave running)
 *   2. Drop PDFs into __tests__/fixtures/classifier/.local/dogfood/
 *      (gitignored; real Ross Built docs only, never committed)
 *   3. Get a session cookie:
 *      - Open http://localhost:3000 in a browser, sign in
 *      - DevTools → Application → Cookies → http://localhost:3000
 *      - Copy ALL cookies as a single header string, e.g.
 *        "sb-...-auth-token=...; nw_session=..."
 *   4. Run:
 *      DOGFOOD_SESSION_COOKIE='<paste here>' npx tsx scripts/dogfood-ingest.ts
 *   5. Open qa-reports/qa-branch3-phase3.2-v2-dogfood.md, fill in the
 *      "Expected" and "Pass/fail" columns per fixture
 *
 * The script does NOT delete or modify the document_extractions rows
 * it creates. Inspect them in the dev DB after the run if you want
 * to verify the contract (invoice_id=NULL, target_*=NULL, etc.).
 */
import { readFileSync, statSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DOGFOOD_DIR = "__tests__/fixtures/classifier/.local/dogfood";
const REPORT_PATH = "qa-reports/qa-branch3-phase3.2-v2-dogfood.md";
const ENDPOINT = process.env.DOGFOOD_ENDPOINT ?? "http://localhost:3000/api/ingest";
const COOKIE = process.env.DOGFOOD_SESSION_COOKIE ?? "";
const LOW_CONFIDENCE_THRESHOLD = 0.7;

type IngestResponse = {
  extraction_id?: string;
  classified_type?: string;
  classification_confidence?: number;
  error?: string;
};

type Result = {
  filename: string;
  fileSize: number;
  pageCount: number;
  extractionId: string | null;
  classifiedType: string | null;
  confidence: number | null;
  cacheHit: boolean | null;
  cacheReadTokens: number | null;
  inputTokens: number | null;
  latencyMs: number;
  status: number;
  error: string | null;
};

function fail(msg: string, code = 1): never {
  console.error(`error: ${msg}`);
  process.exit(code);
}

function countPdfPages(buf: Buffer): number {
  // Heuristic — count occurrences of `/Type /Page` (excluding the
  // catalog-level `/Type /Pages` collection). Works on every modern
  // PDF generator we've seen at Ross Built. Returns 0 on parse miss.
  const text = buf.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : 0;
}

function escapePipe(s: string): string {
  return s.replace(/\|/g, "\\|");
}

async function postFile(filename: string, buf: Buffer): Promise<{
  status: number;
  body: IngestResponse;
  latencyMs: number;
}> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buf)], { type: "application/pdf" });
  form.append("file", blob, filename);

  const t0 = Date.now();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Cookie: COOKIE },
    body: form,
  });
  const latencyMs = Date.now() - t0;

  let body: IngestResponse;
  try {
    body = (await res.json()) as IngestResponse;
  } catch {
    body = { error: `non-JSON response (status ${res.status})` };
  }

  return { status: res.status, body, latencyMs };
}

async function joinCacheMetadata(extractionIds: string[]): Promise<
  Map<string, { cacheReadTokens: number; inputTokens: number; cacheHit: boolean }>
> {
  const out = new Map<string, { cacheReadTokens: number; inputTokens: number; cacheHit: boolean }>();
  if (extractionIds.length === 0) return out;

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbKey) {
    console.warn(
      "warn: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — cache-hit column will be 'unknown'."
    );
    return out;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(sbUrl, sbKey, { auth: { persistSession: false } });

  // The /api/ingest route stamps metadata.extraction_id on every classify
  // call. We pull every classify usage row that matches one of our ids
  // in a single query.
  const orFilter = extractionIds
    .map((id) => `metadata->>extraction_id.eq.${id}`)
    .join(",");
  const { data, error } = await sb
    .from("api_usage")
    .select("metadata, input_tokens")
    .eq("function_type", "document_classify")
    .or(orFilter);

  if (error) {
    console.warn(`warn: api_usage query error: ${error.message}`);
    return out;
  }

  for (const row of (data ?? []) as Array<{
    metadata: Record<string, unknown> | null;
    input_tokens: number | null;
  }>) {
    const md = (row.metadata ?? {}) as {
      extraction_id?: string;
      cache_read_input_tokens?: number;
    };
    const id = md.extraction_id;
    if (!id) continue;
    const cacheReadTokens = Number(md.cache_read_input_tokens ?? 0);
    out.set(id, {
      cacheReadTokens,
      inputTokens: Number(row.input_tokens ?? 0),
      cacheHit: cacheReadTokens > 0,
    });
  }

  return out;
}

function writeReport(results: Result[]): void {
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
  lines.push("# Phase 3.2 v2 — /api/ingest dogfood report");
  lines.push("");
  lines.push(`Run window: ${new Date().toISOString()}`);
  lines.push(`Endpoint: \`${ENDPOINT}\``);
  lines.push(`Fixture root: \`${DOGFOOD_DIR}\` (gitignored — real Ross Built docs only)`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|---|---|");
  lines.push(`| Total documents | ${total} |`);
  lines.push(`| Successful classifications | ${succeeded} |`);
  lines.push(`| Failed (HTTP error or no body) | ${failed} |`);
  lines.push(`| Low-confidence rows (<${LOW_CONFIDENCE_THRESHOLD}) | ${lowConf} |`);
  lines.push(`| Avg latency | ${avgLatency} ms |`);
  lines.push(`| Cache-hit rate (api_usage) | ${cacheRate} |`);
  lines.push("");
  lines.push("## Per-fixture results");
  lines.push("");
  lines.push("**Jake fills `Expected` and `Pass/fail` after the run.** Use one of the");
  lines.push("ten enum values for Expected: `invoice`, `purchase_order`, `change_order`,");
  lines.push("`proposal`, `vendor`, `budget`, `historical_draw`, `plan`, `contract`, `other`.");
  lines.push("");
  lines.push("| # | Filename | Size (KB) | Pages | Classified | Confidence | Cache hit | Latency (ms) | Extraction id | Expected | Pass/fail |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
  results.forEach((r, idx) => {
    const sizeKB = (r.fileSize / 1024).toFixed(1);
    const cls = r.classifiedType ?? (r.error ? `ERROR (${r.error})` : "—");
    const conf = r.confidence === null ? "—" : r.confidence.toFixed(2);
    const cache = r.cacheHit === null ? "?" : r.cacheHit ? "yes" : "no";
    const idShort = r.extractionId ? r.extractionId.slice(0, 8) + "…" : "—";
    lines.push(
      `| ${idx + 1} | ${escapePipe(r.filename)} | ${sizeKB} | ${r.pageCount} | \`${cls}\` | ${conf} | ${cache} | ${r.latencyMs} | \`${idShort}\` | _fill_ | _fill_ |`
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
        lines.push(`- **${escapePipe(r.filename)}** → \`${r.classifiedType}\` at ${r.confidence.toFixed(2)} (extraction \`${r.extractionId}\`)`);
      }
    }
    lines.push("");
  }

  if (failed > 0) {
    lines.push("## Failures");
    lines.push("");
    for (const r of results) {
      if (r.error !== null) {
        lines.push(`- **${escapePipe(r.filename)}** (HTTP ${r.status}) — ${escapePipe(r.error)}`);
      }
    }
    lines.push("");
  }

  lines.push("## Inspect rows in dev DB");
  lines.push("");
  lines.push("The script does NOT delete or modify the rows it creates. To verify the contract:");
  lines.push("");
  lines.push("```sql");
  lines.push("SELECT id, classified_type, classification_confidence,");
  lines.push("       invoice_id, target_entity_type, target_entity_id,");
  lines.push("       verification_status, raw_pdf_url");
  lines.push("FROM document_extractions");
  if (results.some((r) => r.extractionId)) {
    const ids = results
      .map((r) => r.extractionId)
      .filter((x): x is string => Boolean(x));
    lines.push(`WHERE id IN (${ids.map((id) => `'${id}'`).join(", ")});`);
  } else {
    lines.push("-- no extractions created this run");
  }
  lines.push("```");
  lines.push("");
  lines.push("Expected per row: `invoice_id` IS NULL, `target_entity_type` IS NULL, `target_entity_id` IS NULL, `verification_status='pending'`, `classified_type` set, `classification_confidence` set, `raw_pdf_url` points at `{org_id}/ingest/...`.");
  lines.push("");

  mkdirSync("qa-reports", { recursive: true });
  writeFileSync(REPORT_PATH, lines.join("\n"), "utf8");
  console.log(`wrote ${REPORT_PATH}`);
}

async function main() {
  if (!COOKIE) {
    fail(
      "DOGFOOD_SESSION_COOKIE env var is empty. Get a real session cookie from the browser " +
        "(http://localhost:3000 → DevTools → Application → Cookies, copy as a single header string) " +
        "and re-run as: DOGFOOD_SESSION_COOKIE='...' npx tsx scripts/dogfood-ingest.ts"
    );
  }

  if (!existsSync(DOGFOOD_DIR)) {
    fail(`fixture dir missing: ${DOGFOOD_DIR}. Drop ≥1 .pdf into it and re-run.`);
  }

  const files = readdirSync(DOGFOOD_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .sort();
  if (files.length === 0) {
    fail(`no .pdf files under ${DOGFOOD_DIR}. Drop ≥1 and re-run.`);
  }

  console.log(`found ${files.length} fixture(s) under ${DOGFOOD_DIR}`);
  console.log(`POSTing to ${ENDPOINT}`);
  console.log("");

  const results: Result[] = [];

  for (const filename of files) {
    const path = join(DOGFOOD_DIR, filename);
    const buf = readFileSync(path);
    const fileSize = statSync(path).size;
    const pageCount = countPdfPages(buf);

    process.stdout.write(`→ ${filename} (${(fileSize / 1024).toFixed(1)} KB, ${pageCount}p) ... `);

    let result: Result;
    try {
      const { status, body, latencyMs } = await postFile(filename, buf);
      if (status === 200 && body.classified_type && typeof body.classification_confidence === "number") {
        result = {
          filename,
          fileSize,
          pageCount,
          extractionId: body.extraction_id ?? null,
          classifiedType: body.classified_type,
          confidence: body.classification_confidence,
          cacheHit: null,
          cacheReadTokens: null,
          inputTokens: null,
          latencyMs,
          status,
          error: null,
        };
        console.log(
          `${body.classified_type} (conf ${body.classification_confidence.toFixed(2)}, ${latencyMs}ms)`
        );
      } else {
        result = {
          filename,
          fileSize,
          pageCount,
          extractionId: null,
          classifiedType: null,
          confidence: null,
          cacheHit: null,
          cacheReadTokens: null,
          inputTokens: null,
          latencyMs,
          status,
          error: body.error ?? `unexpected response shape (status ${status})`,
        };
        console.log(`FAIL HTTP ${status} — ${result.error}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result = {
        filename,
        fileSize,
        pageCount,
        extractionId: null,
        classifiedType: null,
        confidence: null,
        cacheHit: null,
        cacheReadTokens: null,
        inputTokens: null,
        latencyMs: 0,
        status: 0,
        error: message,
      };
      console.log(`FAIL ${message}`);
    }

    results.push(result);
  }

  console.log("");
  console.log("joining api_usage for cache-hit metadata...");
  const ids = results.map((r) => r.extractionId).filter((x): x is string => Boolean(x));
  const cacheMap = await joinCacheMetadata(ids);
  for (const r of results) {
    if (!r.extractionId) continue;
    const stat = cacheMap.get(r.extractionId);
    if (stat) {
      r.cacheHit = stat.cacheHit;
      r.cacheReadTokens = stat.cacheReadTokens;
      r.inputTokens = stat.inputTokens;
    }
  }

  console.log("");
  writeReport(results);
  console.log("");
  console.log(`run complete — ${results.length} fixture(s), ${results.filter((r) => r.error).length} failure(s)`);
  console.log(`open ${REPORT_PATH} and fill in the Expected + Pass/fail columns per row.`);
}

main().catch((err) => {
  console.error("dogfood-ingest fatal error:", err);
  process.exit(1);
});
