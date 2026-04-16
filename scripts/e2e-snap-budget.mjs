import { chromium } from 'playwright';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:3000';
const EMAIL = 'jake@rossbuilt.com';
const PASSWORD = 'RossBuilt2026!';
const { drummond_job_id: JOB_ID } = JSON.parse(readFileSync('e2e-state.json', 'utf8'));
const OUT = path.resolve('screenshots');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => null),
    page.click('button[type=submit]'),
  ]);

  await page.goto(BASE + `/jobs/${JOB_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(OUT, 'e2e-03-budget-imported.png'), fullPage: true });

  await page.goto(BASE + `/jobs/${JOB_ID}/budget`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(OUT, 'e2e-03b-budget-detail.png'), fullPage: true });

  await browser.close();
})();
