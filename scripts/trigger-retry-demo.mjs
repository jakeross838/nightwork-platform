// Fire one parse-next call against the retry-demo batch.
// The prod server running this was started with FORCE_PARSE_FAIL=first,
// so the first attempt fails and the second succeeds. We capture the
// server log afterwards.
import { chromium } from 'playwright';

const BASE = 'http://localhost:3015';
const BATCH_ID = 'd5f19d6d-2546-4b97-b7be-8f42ddcbf7cf';
const EMAIL = 'jake@rossbuilt.com';
const PASSWORD = 'RossBuilt2026!';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
const page = await ctx.newPage();

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', EMAIL);
await page.fill('input[type=password]', PASSWORD);
await Promise.all([
  page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => null),
  page.click('button[type=submit]'),
]);

console.log('→ Calling parse-next');
const result = await page.evaluate(async (batchId) => {
  const r = await fetch(`/api/invoices/import/${batchId}/parse-next`, { method: 'POST' });
  return { status: r.status, body: await r.json() };
}, BATCH_ID);
console.log('→ result:', JSON.stringify(result, null, 2));

await browser.close();
