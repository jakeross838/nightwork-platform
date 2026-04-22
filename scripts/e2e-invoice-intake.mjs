// Drive the /invoices/import UI: drop 11 PDFs, wait for sequential parse,
// bulk-assign to Dewberry, send to queue.
import { chromium } from 'playwright';
import path from 'node:path';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BASE = 'http://localhost:3000';
const EMAIL = 'jake@rossbuilt.com';
const PASSWORD = 'RossBuilt2026!';
const { dewberry_job_id: JOB_ID } = JSON.parse(readFileSync('e2e-state.json', 'utf8'));
const OUT = path.resolve('screenshots');

const INVOICE_DIR = 'C:/Users/Jake/nightwork-platform/test-invoices';
const PDFs = readdirSync(INVOICE_DIR)
  .filter((n) => /^dewberry-invoice-page-\d+\.pdf$/.test(n))
  .sort()
  .map((n) => path.join(INVOICE_DIR, n));

console.log(`Found ${PDFs.length} PDFs`);

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const findings = [];
const t0 = Date.now();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => findings.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') findings.push(`console.error: ${m.text().slice(0, 200)}`); });

console.log('→ login');
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', EMAIL);
await page.fill('input[type=password]', PASSWORD);
await Promise.all([
  page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => null),
  page.click('button[type=submit]'),
]);

console.log('→ /invoices/import');
await page.goto(BASE + '/invoices/import', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

console.log(`→ setInputFiles(${PDFs.length})`);
await page.locator('input[type=file][accept*="pdf"]').first().setInputFiles(PDFs);

// The page kicks off upload + parse-next loop client-side.
// Poll DB directly via service role to watch progress (page's internal state
// isn't observable from Playwright without deep hooks).
console.log('→ waiting for parse');
const t1 = Date.now();
const TIMEOUT = 10 * 60 * 1000;
let lastLog = 0;
let batchId = null;
while (Date.now() - t1 < TIMEOUT) {
  const { data: batches } = await sb
    .from('invoice_import_batches')
    .select('id, total_files, parsed_count, error_count, duplicate_count, status, completed_at')
    .order('created_at', { ascending: false })
    .limit(1);
  const b = batches?.[0];
  if (b) {
    batchId = b.id;
    const nowMs = Date.now();
    if (nowMs - lastLog > 2000) {
      console.log(`  [${Math.round((nowMs - t1) / 1000)}s] batch=${b.id.slice(0,8)}  total=${b.total_files}  parsed=${b.parsed_count}  err=${b.error_count}  dup=${b.duplicate_count}  status=${b.status}`);
      lastLog = nowMs;
    }
    if (b.status === 'complete' || b.completed_at || (b.parsed_count + b.error_count + b.duplicate_count) >= b.total_files) {
      console.log('  → batch complete');
      break;
    }
  }
  await page.waitForTimeout(2500);
}

await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(OUT, 'e2e-04-bulk-import.png'), fullPage: true });

// Pull per-row detail from DB.
const { data: rows } = await sb
  .from('invoices')
  .select(`id, original_filename, status, vendor_id, vendor_name_raw,
           invoice_number, invoice_date, total_amount, confidence_score,
           job_id, duplicate_of_id, import_error,
           jobs:job_id (id, name),
           vendors:vendor_id (id, name)`)
  .eq('org_id', '00000000-0000-0000-0000-000000000001')
  .is('deleted_at', null)
  .order('created_at', { ascending: true });

const list = rows ?? [];
const summary = {
  total: list.length,
  parsed:     list.filter((r) => r.status === 'import_parsed').length,
  errors:     list.filter((r) => r.status === 'import_error').length,
  duplicates: list.filter((r) => r.status === 'import_duplicate').length,
  matched_to_dewberry: list.filter((r) => r.job_id === JOB_ID).length,
  unmatched_parsed:    list.filter((r) => !r.job_id && r.status === 'import_parsed').length,
  vendor_linked:       list.filter((r) => r.vendor_id).length,
  vendor_unknown:      list.filter((r) => !r.vendor_id).length,
};
console.log('\nSummary:', JSON.stringify(summary, null, 2));

console.log('\nPer-row:');
for (const r of list) {
  const amt = r.total_amount != null ? `$${(r.total_amount / 100).toFixed(2)}` : '—';
  const ven = r.vendors?.name ?? r.vendor_name_raw ?? '(none)';
  const job = r.jobs?.name ?? (r.job_id ? `(job ${r.job_id.slice(0,8)})` : '(unmatched)');
  console.log(` - ${r.original_filename?.padEnd(40)} ${String(r.status).padEnd(18)} ${ven.padEnd(32)} ${amt.padEnd(12)} ${job}`);
}

// Bulk-assign unmatched to Dewberry via the UI endpoint.
const unmatchedIds = list.filter((r) => !r.job_id && (r.status === 'import_parsed' || r.status === 'import_duplicate')).map((r) => r.id);
if (unmatchedIds.length > 0 && batchId) {
  console.log(`\n→ bulk-assign ${unmatchedIds.length} to Dewberry`);
  const resp = await page.evaluate(async ({ batchId, jobId, ids }) => {
    const r = await fetch(`/api/invoices/import/${batchId}/bulk-assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_ids: ids, job_id: jobId }),
    });
    return { status: r.status, body: (await r.text()).slice(0, 300) };
  }, { batchId, jobId: JOB_ID, ids: unmatchedIds });
  console.log(`  HTTP ${resp.status}: ${resp.body}`);
  findings.push(`bulk-assign ${unmatchedIds.length}: HTTP ${resp.status}`);
}

// Send to queue.
if (batchId) {
  console.log('\n→ send-to-queue');
  const resp = await page.evaluate(async (batchId) => {
    const r = await fetch(`/api/invoices/import/${batchId}/send-to-queue`, { method: 'POST' });
    return { status: r.status, body: (await r.text()).slice(0, 300) };
  }, batchId);
  console.log(`  HTTP ${resp.status}: ${resp.body}`);
  findings.push(`send-to-queue: HTTP ${resp.status}`);
}

await page.waitForTimeout(2000);
await page.goto(BASE + '/invoices/import', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(OUT, 'e2e-05-sent-to-queue.png'), fullPage: true });

// Post-send DB state.
const { data: rows2 } = await sb
  .from('invoices')
  .select('id, status, job_id, vendor_id')
  .eq('org_id', '00000000-0000-0000-0000-000000000001')
  .is('deleted_at', null);
const summary2 = {
  total: rows2?.length ?? 0,
  pm_review: rows2?.filter((r) => r.status === 'pm_review').length ?? 0,
  qa_review: rows2?.filter((r) => r.status === 'qa_review').length ?? 0,
  ai_processed: rows2?.filter((r) => r.status === 'ai_processed').length ?? 0,
  still_import: rows2?.filter((r) => String(r.status).startsWith('import_')).length ?? 0,
  matched: rows2?.filter((r) => r.job_id === JOB_ID).length ?? 0,
};
console.log('\nPost-send summary:', JSON.stringify(summary2, null, 2));

writeFileSync('e2e-intake-log.json', JSON.stringify({
  elapsed_ms: Date.now() - t0,
  batch_id: batchId,
  pre_send: summary,
  post_send: summary2,
  rows: list.map((r) => ({
    file: r.original_filename,
    status: r.status,
    vendor: r.vendors?.name ?? r.vendor_name_raw,
    amount_dollars: r.total_amount != null ? r.total_amount / 100 : null,
    job: r.jobs?.name,
    confidence: r.confidence_score,
    error: r.import_error,
  })),
  findings,
}, null, 2));

console.log(`\ndone in ${Math.round((Date.now() - t0) / 1000)}s`);
await browser.close();
