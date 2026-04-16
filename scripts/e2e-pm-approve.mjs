// PM approval driver.
// For each Dewberry invoice in pm_review / qa_review:
//   1. Look up its mapped cost_code_id.
//   2. POST /api/invoices/[id]/action with {action:'approve', updates:{cost_code_id}}.
//   3. Record per-invoice timing + any mismatches/errors for findings.
import { chromium } from 'playwright';
import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BASE = 'http://localhost:3000';
const EMAIL = 'jake@rossbuilt.com';
const PASSWORD = 'RossBuilt2026!';
const { dewberry_job_id: JOB_ID } = JSON.parse(readFileSync('e2e-state.json', 'utf8'));
const OUT = path.resolve('screenshots');

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Trade-based cost-code mapping (from the Dewberry budget).
const VENDOR_TO_CODE = [
  { match: /FPL|florida power/i,          code: '03110', description: 'Temporary Electric & Water' },
  { match: /clean cans/i,                 code: '03111', description: 'Temporary Sanitation' },
  { match: /ecosouth|roll off|waste/i,    code: '03112', description: 'Debris Removal' },
  { match: /island lumber|hardware/i,     code: '06101', description: 'Framing — Lumber' },
  { match: /avery roof|roof/i,            code: '17101', description: 'Roofing' },
  { match: /watts|stucco|plaster/i,       code: '26112', description: 'Stucco' },
  { match: /tnt|paint/i,                  code: '27101', description: 'Painting' },
];

function mapCode(invoice) {
  const name = (invoice.vendor_name_raw || invoice.file_name || '').toLowerCase();
  const fileMatch = (invoice.original_filename || '').toLowerCase();
  // Filename-based override for the misidentified FPL invoice (page 02).
  if (/page-02/.test(fileMatch)) return { code: '03110', description: 'Temporary Electric & Water — manual (FPL misidentified as ROSS BUILT LLC)' };
  for (const r of VENDOR_TO_CODE) if (r.match.test(name)) return r;
  return null;
}

const findings = [];
const approvalLog = [];
const t0 = Date.now();

// ─── Look up cost_code_id for each desired code ─────────
const codes = Array.from(new Set(VENDOR_TO_CODE.map((r) => r.code).concat(['03110'])));
const { data: ccRows } = await sb
  .from('cost_codes')
  .select('id, code, description')
  .in('code', codes)
  .is('deleted_at', null);
// cost_codes has duplicate codes with different descriptions — pick the right one per intent.
const ccMap = new Map();
for (const row of ccRows) {
  // Prefer the description we expect; otherwise keep whatever maps first.
  const desired = VENDOR_TO_CODE.find((r) => r.code === row.code)?.description;
  if (desired && row.description.toLowerCase().includes(desired.toLowerCase().slice(0, 10))) {
    ccMap.set(row.code, { id: row.id, description: row.description });
  } else if (!ccMap.has(row.code)) {
    ccMap.set(row.code, { id: row.id, description: row.description });
  }
}
console.log('Code → id mapping:');
for (const [c, v] of ccMap.entries()) console.log(`  ${c} → ${v.id.slice(0,8)} (${v.description})`);

// ─── Fix page-02 vendor data before approving ─────────
const { data: page02Rows } = await sb
  .from('invoices')
  .select('id, vendor_name_raw, status')
  .eq('original_filename', 'dewberry-invoice-page-02.pdf')
  .is('deleted_at', null);
const page02 = page02Rows?.[0];
if (page02) {
  // Find (or create) an FPL vendor and link it.
  const { data: fpl } = await sb
    .from('vendors')
    .select('id, name')
    .eq('org_id', '00000000-0000-0000-0000-000000000001')
    .ilike('name', 'FPL')
    .limit(1);
  let fplId = fpl?.[0]?.id;
  if (!fplId) {
    const { data: newFpl } = await sb
      .from('vendors')
      .insert({ name: 'FPL', org_id: '00000000-0000-0000-0000-000000000001' })
      .select('id')
      .single();
    fplId = newFpl.id;
    findings.push('page-02 vendor created as FPL (AI parsed as "ROSS BUILT LLC" instead — billing-TO line misread)');
  } else {
    findings.push('page-02 vendor re-linked to FPL (AI parsed as "ROSS BUILT LLC" instead — billing-TO line misread)');
  }
  await sb
    .from('invoices')
    .update({ vendor_id: fplId, vendor_name_raw: 'FPL', status: 'pm_review' })
    .eq('id', page02.id);
  console.log(`  page-02 vendor fixed → FPL, status → pm_review`);
}

// ─── Login for UI-authenticated action calls ─────────
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => findings.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') findings.push(`console.error: ${m.text().slice(0, 200)}`); });

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', EMAIL);
await page.fill('input[type=password]', PASSWORD);
await Promise.all([
  page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => null),
  page.click('button[type=submit]'),
]);

// Mid-approval screenshot: PM queue before any approvals.
await page.goto(BASE + '/invoices/queue', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(OUT, 'e2e-06-pm-approval-mid.png'), fullPage: true });

// ─── Approve each invoice ─────────
const { data: invoices } = await sb
  .from('invoices')
  .select('id, original_filename, vendor_name_raw, total_amount, status, job_id, cost_code_id, confidence_score')
  .eq('job_id', JOB_ID)
  .is('deleted_at', null)
  .order('original_filename');

console.log(`\nApproving ${invoices.length} invoices...`);

for (const inv of invoices) {
  const mapping = mapCode(inv);
  if (!mapping) {
    findings.push(`No cost code mapped for ${inv.original_filename} (${inv.vendor_name_raw})`);
    approvalLog.push({ file: inv.original_filename, outcome: 'skipped_no_code' });
    continue;
  }
  const cc = ccMap.get(mapping.code);
  if (!cc) {
    findings.push(`Cost code ${mapping.code} not found in cost_codes table`);
    approvalLog.push({ file: inv.original_filename, outcome: 'skipped_code_missing' });
    continue;
  }

  const start = Date.now();
  const resp = await page.evaluate(async ({ invId, ccId }) => {
    const r = await fetch(`/api/invoices/${invId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'approve',
        updates: { cost_code_id: ccId },
        pm_overrides: { cost_code_id: { old: null, new: ccId } },
      }),
    });
    return { status: r.status, body: await r.text() };
  }, { invId: inv.id, ccId: cc.id });

  const ms = Date.now() - start;
  const amt = inv.total_amount != null ? `$${(inv.total_amount / 100).toFixed(2)}` : '—';
  console.log(`  ${inv.original_filename}  ${amt.padEnd(10)} → ${mapping.code} (${cc.description.slice(0,30).padEnd(32)}) HTTP ${resp.status}  ${ms}ms`);
  approvalLog.push({
    file: inv.original_filename,
    vendor: inv.vendor_name_raw,
    amount_dollars: inv.total_amount != null ? inv.total_amount / 100 : null,
    code: mapping.code,
    code_description: cc.description,
    http_status: resp.status,
    ms,
    response: resp.body.slice(0, 300),
  });

  if (resp.status !== 200) {
    findings.push(`${inv.original_filename}: approve returned HTTP ${resp.status}: ${resp.body.slice(0, 200)}`);
  }
}

// Post-approval state.
const { data: after } = await sb
  .from('invoices')
  .select('id, status, cost_code_id')
  .eq('job_id', JOB_ID)
  .is('deleted_at', null);

const afterSummary = {};
for (const r of after ?? []) afterSummary[r.status] = (afterSummary[r.status] ?? 0) + 1;
console.log('\nPost-approve status breakdown:', afterSummary);

await page.goto(BASE + '/invoices/queue', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(OUT, 'e2e-06-pm-approval.png'), fullPage: true });

await page.goto(BASE + '/invoices', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(OUT, 'e2e-06-pm-approval-post.png'), fullPage: true });

writeFileSync('e2e-approve-log.json', JSON.stringify({
  elapsed_ms: Date.now() - t0,
  code_mapping: Array.from(ccMap.entries()).map(([c, v]) => ({ code: c, id: v.id, description: v.description })),
  approvals: approvalLog,
  after_summary: afterSummary,
  findings,
}, null, 2));

console.log(`\ndone in ${Math.round((Date.now() - t0) / 1000)}s`);
await browser.close();
