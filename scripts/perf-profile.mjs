// Fire both dashboard + jobs/health endpoints 3 times each to capture
// per-query timing in the server stdout (PERF_LOG=1).
import { chromium } from 'playwright';

const BASE = process.env.PROFILE_BASE || 'http://localhost:3005';
const EMAIL = 'jake@rossbuilt.com';
const PASSWORD = 'RossBuilt2026!';

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

console.log('→ Firing /api/dashboard 3x');
for (let i = 1; i <= 3; i++) {
  const t = await page.evaluate(async () => {
    const t0 = performance.now();
    const r = await fetch('/api/dashboard', { cache: 'no-store' });
    return { status: r.status, ms: Math.round(performance.now() - t0) };
  });
  console.log(`  run ${i}:`, t);
}

console.log('→ Firing /api/jobs/health 3x');
for (let i = 1; i <= 3; i++) {
  const t = await page.evaluate(async () => {
    const t0 = performance.now();
    const r = await fetch('/api/jobs/health', { cache: 'no-store' });
    return { status: r.status, ms: Math.round(performance.now() - t0) };
  });
  console.log(`  run ${i}:`, t);
}

await browser.close();
console.log('✓ Done — check server stdout for per-query timings');
