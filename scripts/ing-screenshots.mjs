// Capture the Part 2 ingestion screenshots:
//   ing-01-bulk-assign.png — select + applied state
//   ing-02-send-flow.png — post-click send flow (rows leave view)
//   ing-03-org-settings.png — /settings/workflow with import section
import { chromium } from 'playwright';
import path from 'node:path';

const BASE = 'http://localhost:3017';
const BATCH_ID = 'd9e84f9b-ad43-4c34-a089-bf5a71f0976a';
const FISH_JOB_ID = 'b3e4684e-2a5f-4384-ab93-656aef2f6636';
const OUT = path.resolve('screenshots');
const EMAIL = 'jake@rossbuilt.com';
const PASSWORD = 'RossBuilt2026!';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();

console.log('→ Login');
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', EMAIL);
await page.fill('input[type=password]', PASSWORD);
await Promise.all([
  page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => null),
  page.click('button[type=submit]'),
]);

// ------------ ing-03-org-settings.png ------------
console.log('→ Settings page');
await page.goto(BASE + '/settings/workflow', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
// Scroll to the Bulk Import section
await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll('h2'))
    .find((h) => /bulk import/i.test(h.textContent ?? ''));
  if (el) (el.closest('section') ?? el).scrollIntoView({ block: 'start' });
});
await page.waitForTimeout(400);
await page.screenshot({
  path: path.join(OUT, 'ing-03-org-settings.png'),
  fullPage: false,
});

// ------------ ing-01-bulk-assign.png ------------
console.log('→ Bulk-assign (selection state)');
await page.goto(`${BASE}/invoices/import?batch=${BATCH_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// Select the 3 unassigned parsed rows by ticking their checkboxes
const targets = ['doug_naeher_drywall.pdf', 'italian_touch_flooring.pdf', 'universal_window_solutions.pdf'];
for (const fname of targets) {
  // Find row by filename, then click its checkbox
  const row = page.locator('tr', { hasText: fname }).first();
  const cb = row.locator('input[type=checkbox]');
  if (await cb.count()) await cb.first().check();
}
await page.waitForTimeout(300);

// Open the job dropdown
const sel = page.locator('select').first();
await sel.selectOption({ value: FISH_JOB_ID });
await page.waitForTimeout(300);

// Overlay a "3 SELECTED · Dropdown open" caption to make the action clear
await page.evaluate(() => {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;top:240px;right:22px;background:#1a1d22;color:#f7f3ea;padding:12px 16px;border:1px solid #a88c5f;font:12px/1.4 monospace;z-index:99999;';
  div.innerHTML = '<strong style="color:#a88c5f">Bulk assign — selected</strong><br>3 rows ticked<br>Assign-job dropdown populated with all org jobs<br>Next step → click "Apply"';
  document.body.appendChild(div);
});
await page.waitForTimeout(300);
await page.screenshot({
  path: path.join(OUT, 'ing-01-bulk-assign.png'),
  fullPage: true,
});

// Now APPLY the bulk-assign (via API, faster than clicking)
console.log('→ Apply bulk-assign');
const selectedIds = await page.evaluate(() => {
  // Pull invoice IDs from checked checkboxes via data attributes if set, else from row text
  return null; // we'll fetch server-side below
});
void selectedIds;
// Fetch the invoice ids via a DB-less roundtrip: the GET batch endpoint
const batch = await page.evaluate(async (bid) => {
  const r = await fetch(`/api/invoices/import/${bid}`);
  return r.json();
}, BATCH_ID);
const targetFiles = targets;
const invoiceIds = (batch.invoices || [])
  .filter((r) => targetFiles.includes(r.original_filename))
  .map((r) => r.id);

const assignResp = await page.evaluate(async ({ bid, ids, jid }) => {
  const r = await fetch(`/api/invoices/import/${bid}/bulk-assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice_ids: ids, job_id: jid }),
  });
  return { status: r.status, body: await r.json() };
}, { bid: BATCH_ID, ids: invoiceIds, jid: FISH_JOB_ID });
console.log('  assign result:', assignResp);

// ------------ ing-02-send-flow.png ------------
// Reload to pick up assigned jobs
console.log('→ Send-to-queue');
await page.goto(`${BASE}/invoices/import?batch=${BATCH_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

// Now POST send-to-queue
const sendResp = await page.evaluate(async (bid) => {
  const r = await fetch(`/api/invoices/import/${bid}/send-to-queue`, { method: 'POST' });
  return { status: r.status, body: await r.json() };
}, BATCH_ID);
console.log('  send result:', sendResp);

// Refresh to see the post-send state
await page.goto(`${BASE}/invoices/import?batch=${BATCH_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Overlay a confirmation toast
await page.evaluate((sent) => {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;top:80px;right:22px;background:#0e4f3a;color:#f7f3ea;padding:12px 18px;border:1px solid #7fb069;font:13px/1.4 system-ui;z-index:99999;';
  div.innerHTML = `<strong style="color:#7fb069">✓ Toast confirmation</strong><br>Sent ${sent} invoices to approval queue<br>Rows removed from import view — batch history preserved in counters`;
  document.body.appendChild(div);
}, sendResp.body.promoted);
await page.waitForTimeout(300);
await page.screenshot({
  path: path.join(OUT, 'ing-02-send-flow.png'),
  fullPage: true,
});

await browser.close();
console.log('✓ Done');
