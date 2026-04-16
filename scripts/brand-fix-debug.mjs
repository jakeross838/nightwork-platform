// Debug: capture the actual computed style + render of the logo element.
import { chromium } from 'playwright';
import path from 'node:path';

const BASE = 'http://localhost:3021';
const OUT = path.resolve('screenshots');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'jake@rossbuilt.com');
await page.fill('input[type=password]', 'RossBuilt2026!');
await Promise.all([
  page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => null),
  page.click('button[type=submit]'),
]);

await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Extract logo info
const info = await page.evaluate(() => {
  const img = document.querySelector('header img[alt="Nightwork"]');
  if (!img) return { error: 'not found' };
  const cs = getComputedStyle(img);
  const rect = img.getBoundingClientRect();
  return {
    src: img.getAttribute('src'),
    natural: { w: img.naturalWidth, h: img.naturalHeight },
    box: { w: rect.width, h: rect.height, x: rect.x, y: rect.y },
    cs: { width: cs.width, height: cs.height, display: cs.display, color: cs.color },
  };
});
console.log('LOGO INFO:', JSON.stringify(info, null, 2));

// Very-zoomed screenshot showing the logo at 2x device pixel ratio
await page.screenshot({
  path: path.join(OUT, 'brand-fix-01-nav-hidef.png'),
  clip: { x: 0, y: 0, width: 500, height: 70 },
});

await browser.close();
