// Take verification screenshots for the /invoices/import flow.
// Uses Playwright + the seeded test admin; prod server on :3004.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3004';
const OUT = path.resolve('screenshots');
const EMAIL = 'jake@rossbuilt.com';
const PASSWORD = 'RossBuilt2026!';
const BATCH_ID = 'd9e84f9b-ad43-4c34-a089-bf5a71f0976a';

mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('→ Login');
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => null),
    page.click('button[type=submit]'),
  ]);

  console.log('→ Empty state');
  await page.goto(BASE + '/invoices/import', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: path.join(OUT, 'import-01-empty-state.png'),
    fullPage: false,
  });

  console.log('→ Mid-parse state');
  await page.goto(`${BASE}/invoices/import?batch=${BATCH_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(OUT, 'import-02-mid-parse.png'),
    fullPage: true,
  });

  console.log('✓ Done (empty + mid-parse)');
  await browser.close();
})().catch((e) => {
  console.error('Failed:', e);
  process.exit(1);
});
