// Build Draw #1 for Dewberry pulling all 11 qa_approved invoices.
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

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

const findings = [];

// Gather invoice IDs.
const { data: invs } = await sb
  .from('invoices')
  .select('id, total_amount')
  .eq('job_id', JOB_ID)
  .eq('status', 'qa_approved')
  .is('draw_id', null)
  .is('deleted_at', null)
  .order('invoice_date');
console.log(`qa_approved invoices: ${invs.length}, total $${(invs.reduce((s,r)=>s+r.total_amount,0)/100).toFixed(2)}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => findings.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') findings.push(`console.error: ${m.text().slice(0, 200)}`); });

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', EMAIL);
await page.fill('input[type=password]', PASSWORD);
await Promise.all([page.waitForURL('**/dashboard', { timeout: 15000 }).catch(()=>null), page.click('button[type=submit]')]);

// Create the draw via the API.
console.log('→ POST /api/draws/new');
const createResp = await page.evaluate(async ({ jobId, invoiceIds }) => {
  const r = await fetch('/api/draws/new', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      job_id: jobId,
      application_date: '2026-03-09',
      period_start:     '2026-03-01',
      period_end:       '2026-03-31',
      invoice_ids: invoiceIds,
    }),
  });
  return { status: r.status, body: await r.text() };
}, { jobId: JOB_ID, invoiceIds: invs.map((i) => i.id) });

console.log(`  HTTP ${createResp.status}`);
console.log(`  body: ${createResp.body.slice(0, 600)}`);

let drawId = null;
try {
  const j = JSON.parse(createResp.body);
  drawId = j.id || j.draw_id || j.draw?.id;
} catch {}
if (!drawId) {
  findings.push(`draw creation failed or missing id: ${createResp.body.slice(0, 300)}`);
  writeFileSync('e2e-draw-log.json', JSON.stringify({ createResp, findings }, null, 2));
  await browser.close();
  process.exit(1);
}
console.log(`  drawId: ${drawId}`);

// Snap draft draw detail.
await page.goto(BASE + `/draws/${drawId}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
await page.screenshot({ path: path.join(OUT, 'e2e-07-draw-built.png'), fullPage: true });

// Try G702 preview and G703 preview tabs/buttons if they exist on the page.
const body = (await page.content()).toLowerCase();
const hasG702 = /g702|cover|summary/i.test(body);
const hasG703 = /g703|continuation|line item/i.test(body);
findings.push(`draw-page has G702 markers: ${hasG702}, G703 markers: ${hasG703}`);

// Probe preview URL that the draws API might expose.
const prev = await page.evaluate(async (id) => {
  const r = await fetch(`/api/draws/${id}/preview`, { cache: 'no-store' });
  return { status: r.status, type: r.headers.get('content-type'), size: (await r.text()).length };
}, drawId);
console.log(`  /api/draws/${drawId}/preview HTTP ${prev.status} (${prev.type}, ${prev.size} bytes)`);

// Capture G702 and G703 separately by scrolling to elements if present.
try {
  await page.locator('text=G702').first().scrollIntoViewIfNeeded({ timeout: 2000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'e2e-08-g702-preview.png'), fullPage: false });
} catch { findings.push('G702 marker not found on draw page'); }
try {
  await page.locator('text=G703').first().scrollIntoViewIfNeeded({ timeout: 2000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'e2e-09-g703-preview.png'), fullPage: false });
} catch { findings.push('G703 marker not found on draw page'); }

// Try to export the draw (PDF + Excel) via likely endpoints. Download to test-invoices.
const exports = [
  ['pdf',  `/api/draws/${drawId}/export?format=pdf`,  'dewberry-draw-9-g702-g703.pdf'],
  ['xlsx', `/api/draws/${drawId}/export?format=xlsx`, 'dewberry-draw-9-g702-g703.xlsx'],
];
for (const [label, url, fn] of exports) {
  const r = await page.evaluate(async (u) => {
    const r = await fetch(u);
    if (!r.ok) return { status: r.status, size: 0 };
    const buf = await r.arrayBuffer();
    return { status: r.status, size: buf.byteLength, type: r.headers.get('content-type') };
  }, url);
  console.log(`  export ${label}: HTTP ${r.status}  ${r.size} bytes  type=${r.type}`);
  findings.push(`export ${label} via ${url}: HTTP ${r.status} size=${r.size}`);
}

// Save DB snapshot.
const { data: draw } = await sb
  .from('draws')
  .select('id, draw_number, revision_number, status, application_date, period_start, period_end, original_contract_sum, net_change_orders, contract_sum_to_date, total_completed_to_date, current_payment_due')
  .eq('id', drawId)
  .single();
const { data: lines } = await sb
  .from('draw_line_items')
  .select('budget_line_id, this_period, previous_applications, total_to_date')
  .eq('draw_id', drawId);

writeFileSync('e2e-draw-log.json', JSON.stringify({
  drawId, draw, line_count: lines?.length, sum_this_period: lines?.reduce((s,l)=>s+(l.this_period??0),0),
  findings
}, null, 2));

console.log('done');
await browser.close();
