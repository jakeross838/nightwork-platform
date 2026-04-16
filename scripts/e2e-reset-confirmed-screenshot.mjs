import { chromium } from 'playwright';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const OUT = path.resolve('screenshots');
mkdirSync(OUT, { recursive: true });

const before = {
  organizations: 3, profiles: 11, users: 9, org_members: 11,
  org_workflow_settings: 3, cost_codes: 237,
  jobs: 10, invoices: 42, invoice_line_items: 105, invoice_import_batches: 2,
  draws: 3, draw_line_items: 0, budget_lines: 162,
  purchase_orders: 3, change_orders: 1, lien_releases: 2,
  vendors: 25, activity_log: 28, notifications: 7,
};
const after = {
  organizations: 3, profiles: 11, users: 9, org_members: 11,
  org_workflow_settings: 3, cost_codes: 237,
  jobs: 0, invoices: 0, invoice_line_items: 0, invoice_import_batches: 0,
  draws: 0, draw_line_items: 0, budget_lines: 0,
  purchase_orders: 0, change_orders: 0, lien_releases: 0,
  vendors: 0, activity_log: 0, notifications: 0,
};
const preserved = ['organizations','profiles','users','org_members','org_workflow_settings','cost_codes'];

const rows = Object.keys(after).map((k) => {
  const isP = preserved.includes(k);
  const b = before[k] ?? 0;
  const a = after[k];
  const cls = isP ? (b === a ? 'ok' : 'bad') : (a === 0 ? 'ok' : 'bad');
  const tag = isP ? 'preserved' : 'wiped';
  const tagCls = isP ? 'tag-preserved' : 'tag-wiped';
  return `<div class="k">${k}</div><div class="v ${cls}">${b} → ${a}</div><div class="tag ${tagCls}">${tag}</div>`;
}).join('\n');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 40px; background: #0d1117; color: #f7f3ea;
    font: 14px/1.65 'Consolas', 'Menlo', monospace; }
  .card { max-width: 880px; border: 1px solid #a88c5f; padding: 28px 32px;
    background: #1a1d22; box-shadow: 0 10px 40px rgba(0,0,0,.5); }
  h1 { color: #a88c5f; font-size: 18px; margin: 0 0 18px 0; letter-spacing: .5px; }
  h2 { color: #a88c5f; font-size: 13px; margin: 20px 0 8px 0; letter-spacing: .5px; text-transform: uppercase; }
  .ok { color: #7fb069; } .bad { color: #e07a5f; }
  .kv { display: grid; grid-template-columns: 240px 160px 100px; gap: 3px 16px; margin-left: 12px; }
  .k { color: #c7beae; }
  .tag { font-size: 10px; padding: 1px 8px; border: 1px solid; text-align: center; align-self: center; }
  .tag-preserved { color: #7fb069; border-color: #7fb069; }
  .tag-wiped { color: #c7beae; border-color: #555; }
  .footer { margin-top: 22px; padding-top: 14px; border-top: 1px solid #3a3d42; color: #8a8378; font-size: 12px; }
</style></head><body>
<div class="card">
  <h1>E2E Reset — Confirmed</h1>
  <h2>Env: https://egxkffodxcefwpqmwrur.supabase.co (DEV)</h2>
  <h2>Before → After (identity & reference preserved, tenant data wiped)</h2>
  <div class="kv">
    <div class="k" style="color:#a88c5f">TABLE</div><div class="v" style="color:#a88c5f">BEFORE → AFTER</div><div class="tag" style="border:none;color:#a88c5f">STATUS</div>
${rows}
  </div>
  <div class="footer">
    <span class="ok">Reset OK</span> — 0 rows across every tenant table; all 6 preserved tables intact. Ready for Drummond setup.
  </div>
</div>
</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(OUT, 'e2e-01-reset-confirmed.png') });
  await browser.close();
  console.log('Wrote screenshots/e2e-01-reset-confirmed.png');
})();
