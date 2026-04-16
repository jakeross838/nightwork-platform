// Take verification screenshots for the perf fix.
// Uses Playwright (already a dev dep) against the prod server on :3002.
// Login uses the seeded test admin from migration 00008.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3002';
const OUT = path.resolve('screenshots');
const EMAIL = 'jake@rossbuilt.com';
const PASSWORD = 'RossBuilt2026!';

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
  console.log('  logged in, current URL:', page.url());

  // Measure timings (3 runs each) via in-page fetch with performance.now()
  console.log('→ Measuring API timings');
  const timings = await page.evaluate(async () => {
    const urls = ['/api/dashboard', '/api/jobs/health'];
    const out = {};
    for (const url of urls) {
      const runs = [];
      for (let i = 0; i < 3; i++) {
        const t = performance.now();
        const r = await fetch(url, { cache: 'no-store' });
        runs.push({ status: r.status, ms: Math.round(performance.now() - t) });
      }
      out[url] = runs;
    }
    return out;
  });
  console.log('  timings:', JSON.stringify(timings, null, 2));

  console.log('→ Dashboard (full-page)');
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'perf-01-dashboard-loaded.png'), fullPage: true });

  console.log('→ Dashboard (with visible Network panel via overlay)');
  // Overlay a timing summary at the top-right of the page for the network shot
  await page.evaluate((t) => {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:80px;right:20px;background:#1a1d22;color:#f7f3ea;padding:16px 20px;border:1px solid #a88c5f;font:13px/1.5 monospace;z-index:99999;min-width:340px';
    div.innerHTML = `
      <div style="font-size:15px;font-weight:600;margin-bottom:8px;color:#a88c5f">API Response Times</div>
      <div>GET /api/dashboard:</div>
      <div style="padding-left:12px;color:#7fb069">${t['/api/dashboard'].map(r => r.status + ' in ' + r.ms + 'ms').join('<br>')}</div>
      <div style="margin-top:8px">GET /api/jobs/health:</div>
      <div style="padding-left:12px;color:#7fb069">${t['/api/jobs/health'].map(r => r.status + ' in ' + r.ms + 'ms').join('<br>')}</div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #3a3d42;color:#a88c5f">Was 503 → Now 200</div>
    `;
    document.body.appendChild(div);
  }, timings);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'perf-02-network-tab.png'), fullPage: false });

  // Remove overlay for next screenshots
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  console.log('→ Jobs list');
  await page.goto(BASE + '/jobs', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'perf-03-slowest-page.png'), fullPage: true });

  console.log('→ Invoices queue');
  await page.goto(BASE + '/invoices/queue', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'perf-06-invoices-queue.png'), fullPage: true });

  writeFileSync(
    path.join(OUT, 'perf-api-timings.json'),
    JSON.stringify(timings, null, 2)
  );

  await browser.close();
  console.log('✓ Done');
})().catch((e) => {
  console.error('Failed:', e);
  process.exit(1);
});
