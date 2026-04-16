// Renders the pre-flight state (env URL + before row counts) as a
// terminal-style overlay and saves it to screenshots/e2e-00-preflight.png.
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const OUT = path.resolve('screenshots');
mkdirSync(OUT, { recursive: true });

const ENV_URL = 'https://egxkffodxcefwpqmwrur.supabase.co';
const DEV_REF = 'egxkffodxcefwpqmwrur';
const PROD_REF = 'vnpqjderiuhsiiygfwfb';

const before = [
  ['organizations', 3],
  ['profiles', 11],
  ['org_members', 11],
  ['jobs', 10],
  ['invoices', 42],
  ['draws', 3],
  ['draw_line_items', 0],
  ['budget_lines', 162],
  ['purchase_orders', 3],
  ['change_orders', 1],
  ['lien_releases', 2],
  ['vendors', 25],
  ['activity_log', 28],
];

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 40px; background: #0d1117; color: #f7f3ea;
    font: 14px/1.65 'Consolas', 'Menlo', 'SF Mono', monospace; }
  .card { max-width: 820px; border: 1px solid #a88c5f; padding: 28px 32px;
    background: #1a1d22; box-shadow: 0 10px 40px rgba(0,0,0,.5); }
  h1 { color: #a88c5f; font-size: 18px; margin: 0 0 18px 0; letter-spacing: .5px; }
  h2 { color: #a88c5f; font-size: 13px; margin: 20px 0 8px 0; letter-spacing: .5px;
    text-transform: uppercase; }
  .ok   { color: #7fb069; }
  .warn { color: #d4a84b; }
  .bad  { color: #e07a5f; }
  .kv   { display: grid; grid-template-columns: 220px auto; gap: 2px 16px; margin-left: 12px; }
  .kv .k { color: #c7beae; }
  .kv .v { color: #f7f3ea; }
  .footer { margin-top: 22px; padding-top: 14px; border-top: 1px solid #3a3d42;
    color: #8a8378; font-size: 12px; }
</style></head><body>
<div class="card">
  <h1>E2E Pre-flight — Dev Supabase Reset</h1>

  <h2>Env target</h2>
  <div class="kv">
    <div class="k">NEXT_PUBLIC_SUPABASE_URL</div><div class="v">${ENV_URL}</div>
    <div class="k">Project ref</div><div class="v ok">${DEV_REF}  ← DEV (match)</div>
    <div class="k">Prod ref (avoid)</div><div class="v">${PROD_REF}</div>
    <div class="k">Source</div><div class="v">.env.local</div>
  </div>

  <h2>Before-state row counts</h2>
  <div class="kv">
${before.map(([t, n]) => `    <div class="k">${t}</div><div class="v">${n}</div>`).join('\n')}
  </div>

  <div class="footer">
    <span class="ok">PROCEED</span> — env confirmed DEV; reset SQL to be shown next, awaiting explicit "go".
  </div>
</div>
</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(OUT, 'e2e-00-preflight.png') });
  await browser.close();
  console.log('Wrote screenshots/e2e-00-preflight.png');
})();
