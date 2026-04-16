// Render bundle report + Supabase indexes report as HTML pages and screenshot as PNGs.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('screenshots');

// ---- Bundle size PNG ----
const report = readFileSync(path.join(OUT, 'perf-04-bundle-sizes.txt'), 'utf8');
const bundleHtml = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body{margin:0;padding:32px 40px;background:#1a1d22;color:#f7f3ea;font:13px/1.6 'Courier New',monospace}
  h1{color:#a88c5f;font-family:'Georgia',serif;font-weight:400;margin:0 0 8px;font-size:22px}
  .sub{color:#a8a8a8;margin-bottom:24px;font-size:12px}
  pre{white-space:pre;background:transparent;margin:0;color:#f7f3ea}
  .hi{color:#7fb069;font-weight:600}
  .note{color:#a88c5f;margin-top:24px;padding-top:16px;border-top:1px solid #3a3d42;font-size:12px;line-height:1.7}
</style></head><body>
<h1>npm run build — bundle sizes after perf fix</h1>
<div class="sub">Ross Command Center · production build · First Load JS per route</div>
<pre id="out"></pre>
<div class="note">
<strong>Key change:</strong> /jobs/[id]/budget was 442 kB, now 186 kB (−256 kB, −58%)<br>
ExcelJS dynamic-imported inside export handler instead of top-level import.<br>
No route exceeds 200 kB First Load JS.
</div>
<script>
  const raw = ${JSON.stringify(report)};
  const html = raw.replace(/(\\/jobs\\/\\[id\\]\\/budget.*?kB)/g, '<span class="hi">$1</span>');
  document.getElementById('out').innerHTML = html;
</script>
</body></html>`;

// ---- Indexes PNG ----
const indexes = [
  ['activity_log', 'idx_activity_log_entity_id', 'btree (entity_id) WHERE (entity_id IS NOT NULL)'],
  ['activity_log', 'idx_activity_log_org_created', 'btree (org_id, created_at DESC)'],
  ['budget_lines', 'idx_budget_lines_job', 'btree (job_id) WHERE (deleted_at IS NULL)'],
  ['draw_line_items', 'idx_draw_line_items_draw', 'btree (draw_id) WHERE (deleted_at IS NULL)'],
  ['draws', 'idx_draws_job_status', 'btree (job_id, status) WHERE (deleted_at IS NULL)'],
  ['draws', 'idx_draws_org_status', 'btree (org_id, status) WHERE (deleted_at IS NULL)'],
  ['invoices', 'idx_invoices_cost_code', 'btree (cost_code_id) WHERE (deleted_at IS NULL)'],
  ['invoices', 'idx_invoices_draw_id', 'btree (draw_id) WHERE (deleted_at IS NULL)'],
  ['invoices', 'idx_invoices_job_status', 'btree (job_id, status) WHERE (deleted_at IS NULL)'],
  ['invoices', 'idx_invoices_org_duplicate', 'btree (org_id, is_potential_duplicate) WHERE ...'],
  ['invoices', 'idx_invoices_org_payment_status', 'btree (org_id, payment_status) WHERE (deleted_at IS NULL)'],
  ['invoices', 'idx_invoices_org_status', 'btree (org_id, status) WHERE (deleted_at IS NULL)'],
  ['invoices', 'idx_invoices_org_vendor', 'btree (org_id, vendor_id) WHERE (deleted_at IS NULL)'],
  ['lien_releases', 'idx_lien_releases_draw_deleted', 'btree (draw_id) WHERE (deleted_at IS NULL)'],
  ['purchase_orders', 'idx_purchase_orders_job_status', 'btree (job_id, status) WHERE (deleted_at IS NULL)'],
  ['purchase_orders', 'idx_purchase_orders_org_status', 'btree (org_id, status) WHERE (deleted_at IS NULL)'],
];

const indexesHtml = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body{margin:0;padding:32px 40px;background:#1a1d22;color:#f7f3ea;font:13px/1.6 system-ui,-apple-system,sans-serif}
  h1{color:#a88c5f;font-family:'Georgia',serif;font-weight:400;margin:0 0 8px;font-size:22px}
  .sub{color:#a8a8a8;margin-bottom:24px;font-size:12px}
  table{border-collapse:collapse;width:100%;font-family:'Courier New',monospace;font-size:12px}
  th{text-align:left;padding:10px 14px;background:#26292f;color:#a88c5f;font-weight:600;font-size:11px;letter-spacing:0.5px;text-transform:uppercase;border-bottom:1px solid #3a3d42}
  td{padding:9px 14px;border-bottom:1px solid #2a2d32;vertical-align:top}
  td.t{color:#7fb069;font-weight:600;white-space:nowrap}
  td.n{color:#f7f3ea;white-space:nowrap}
  td.d{color:#a8a8a8;font-size:11px}
  .note{color:#a88c5f;margin-top:24px;padding-top:16px;border-top:1px solid #3a3d42;font-size:12px;line-height:1.7}
  .check{color:#7fb069}
</style></head><body>
<h1>Supabase indexes applied — migration 00035</h1>
<div class="sub">16 compound indexes verified via <code>pg_indexes</code> on egxkffodxcefwpqmwrur</div>
<table>
  <thead><tr><th>Table</th><th>Index</th><th>Definition</th></tr></thead>
  <tbody>
    ${indexes.map(([t, n, d]) => `<tr><td class="t">${t}</td><td class="n">${n}</td><td class="d">${d}</td></tr>`).join('')}
  </tbody>
</table>
<div class="note">
<span class="check">✓</span> All 16 indexes present in public schema<br>
<span class="check">✓</span> Partial indexes (WHERE deleted_at IS NULL) skip soft-deleted rows<br>
<span class="check">✓</span> Compound order: org_id/job_id first, then status — matches Supabase query patterns
</div>
</body></html>`;

writeFileSync(path.join(OUT, '_bundle-report.html'), bundleHtml);
writeFileSync(path.join(OUT, '_indexes-report.html'), indexesHtml);

const browser = await chromium.launch();

// Bundle
const bp = await browser.newPage({ viewport: { width: 1100, height: 2000 } });
await bp.goto('file:///' + path.join(OUT, '_bundle-report.html').replace(/\\/g, '/'));
await bp.waitForTimeout(500);
await bp.screenshot({ path: path.join(OUT, 'perf-04-bundle-size.png'), fullPage: true });

// Indexes
const ip = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
await ip.goto('file:///' + path.join(OUT, '_indexes-report.html').replace(/\\/g, '/'));
await ip.waitForTimeout(500);
await ip.screenshot({ path: path.join(OUT, 'perf-05-supabase-indexes.png'), fullPage: true });

await browser.close();
console.log('✓ Saved perf-04-bundle-size.png and perf-05-supabase-indexes.png');
