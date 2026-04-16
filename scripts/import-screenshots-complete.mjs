import { chromium } from 'playwright';
import path from 'node:path';

const BASE = 'http://localhost:3004';
const OUT = path.resolve('screenshots');
const EMAIL = 'jake@rossbuilt.com';
const PASSWORD = 'RossBuilt2026!';
const BATCH_ID = 'd9e84f9b-ad43-4c34-a089-bf5a71f0976a';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', EMAIL);
await page.fill('input[type=password]', PASSWORD);
await Promise.all([
  page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => null),
  page.click('button[type=submit]'),
]);

await page.goto(`${BASE}/invoices/import?batch=${BATCH_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({
  path: path.join(OUT, 'import-03-complete.png'),
  fullPage: true,
});
console.log('✓ Saved import-03-complete.png');
await browser.close();
