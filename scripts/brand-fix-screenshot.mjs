// Verification screenshot: nav header with plain <img> rendering the SVG.
// Captured at 2x DPR so the 4px studs/brace don't alias into the teal bg.
import { chromium } from 'playwright';
import path from 'node:path';

const BASE = 'http://localhost:3021';
const OUT = path.resolve('screenshots');
const EMAIL = 'jake@rossbuilt.com';
const PASSWORD = 'RossBuilt2026!';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', EMAIL);
await page.fill('input[type=password]', PASSWORD);
await Promise.all([
  page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => null),
  page.click('button[type=submit]'),
]);

await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Main deliverable — full nav, 2x DPR
await page.screenshot({
  path: path.join(OUT, 'brand-fix-01-nav.png'),
  clip: { x: 0, y: 0, width: 1440, height: 120 },
});

// Extra close-up so the solid fills are unambiguous
await page.screenshot({
  path: path.join(OUT, 'brand-fix-01-nav-zoom.png'),
  clip: { x: 0, y: 0, width: 280, height: 70 },
});

await browser.close();
console.log('✓ brand-fix-01-nav.png + zoom (2x DPR)');
