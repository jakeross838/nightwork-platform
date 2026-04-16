import { chromium } from 'playwright';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('screenshots');
const { dewberry_job_id: JOB_ID } = JSON.parse(readFileSync('e2e-state.json', 'utf8'));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'jake@rossbuilt.com');
await page.fill('input[type=password]', 'RossBuilt2026!');
await Promise.all([page.waitForURL('**/dashboard', { timeout: 15000 }).catch(()=>null), page.click('button[type=submit]')]);

// Dashboard
await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
await page.screenshot({ path: path.join(OUT, 'e2e-11-dashboard-final.png'), fullPage: true });

// Dewberry detail
await page.goto(BASE + `/jobs/${JOB_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
await page.screenshot({ path: path.join(OUT, 'e2e-12-job-detail-final.png'), fullPage: true });

// Payment tracking
await page.goto(BASE + '/invoices/payments', { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
await page.screenshot({ path: path.join(OUT, 'e2e-13-payment-tracking.png'), fullPage: true });

await browser.close();
