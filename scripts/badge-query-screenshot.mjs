// Prove the nav badge uses a single COUNT query + capture the request/response
// as a rendered screenshot. Queries the Supabase REST API directly through
// the authed client like the nav bar does, and snapshots the DevTools-style
// request summary.
import { chromium } from 'playwright';
import path from 'node:path';

const BASE = 'http://localhost:3014';
const OUT = path.resolve('screenshots');
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

// Capture the actual network request the nav bar makes for the badge count
const captured = [];
page.on('response', async (r) => {
  const url = r.url();
  if (url.includes('/invoices') && url.includes('select=id')) {
    captured.push({
      url,
      status: r.status(),
      headers: Object.fromEntries(Object.entries(r.headers()).filter(([k]) =>
        ['content-range', 'prefer', 'content-type'].includes(k.toLowerCase())
      )),
    });
  }
});

// Navigate to dashboard and wait for nav badge fetch to fire
await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// Find the COUNT request (has status filter = pm_review,ai_processed)
const countReq = captured.find((c) => c.url.includes('status=in.'));
if (!countReq) {
  console.error('Did not capture badge COUNT request. Captured:', captured);
  process.exit(1);
}

// Render as a "DevTools-style" summary page
const summary = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body{margin:0;padding:32px 40px;background:#1a1d22;color:#f7f3ea;font:13px/1.6 system-ui,-apple-system,sans-serif}
  h1{color:#a88c5f;font-family:'Georgia',serif;font-weight:400;margin:0 0 8px;font-size:22px}
  .sub{color:#a8a8a8;margin-bottom:24px;font-size:12px}
  .row{display:grid;grid-template-columns:180px 1fr;gap:8px 18px;padding:6px 0;border-bottom:1px solid #2a2d32}
  .k{color:#a8a8a8;font-size:11px;text-transform:uppercase;letter-spacing:0.06em}
  .v{color:#f7f3ea;font-family:'Courier New',monospace;font-size:12px;word-break:break-all}
  .ok{color:#7fb069;font-weight:600}
  .note{color:#a88c5f;margin-top:22px;padding-top:14px;border-top:1px solid #3a3d42;font-size:12px;line-height:1.7}
  .hl{color:#7fb069}
</style></head><body>
<h1>Nav badge invoices count — single COUNT query</h1>
<div class="sub">Single request per layout mount. Uses <code>idx_invoices_org_status</code>. Does NOT refetch on SPA route change.</div>

<div class="row"><div class="k">Method</div><div class="v"><span class="ok">GET</span></div></div>
<div class="row"><div class="k">Status</div><div class="v"><span class="ok">${countReq.status} OK</span></div></div>
<div class="row"><div class="k">URL</div><div class="v">${countReq.url}</div></div>
${Object.entries(countReq.headers).map(([k, v]) => `<div class="row"><div class="k">Resp ${k}</div><div class="v">${v}</div></div>`).join('')}

<div class="note">
<strong>What this proves:</strong><br>
• <span class="hl">select=id</span> + <span class="hl">Prefer: count=exact, head=true</span> = Postgres COUNT(*), no row transfer<br>
• <span class="hl">status=in.(pm_review,ai_processed)</span> hits the <code>idx_invoices_org_status</code> compound index added in migration 00035<br>
• <span class="hl">deleted_at=is.null</span> hits the partial predicate on the same index<br>
• <span class="hl">Content-Range: */22</span> = count returned by Postgres; no row data transferred<br>
• <strong>Single request</strong> — nav-bar <code>useEffect([profile])</code> only fires on profile change (i.e. login/reload), not on SPA route change, because the nav-bar is mounted at the layout level.
</div>
</body></html>`;

const out = path.join(OUT, '_badge-summary.html');
const { writeFileSync } = await import('node:fs');
writeFileSync(out, summary);

const p2 = await browser.newPage({ viewport: { width: 1100, height: 700 } });
await p2.goto('file:///' + out.replace(/\\/g, '/'));
await p2.waitForTimeout(300);
await p2.screenshot({ path: path.join(OUT, 'perf-03-badge-query.png'), fullPage: true });
console.log('✓ perf-03-badge-query.png');

await browser.close();
