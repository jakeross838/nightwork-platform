// Render before/after perf logs as PNGs for the deliverable.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('screenshots');
const before = readFileSync(path.join(OUT, '_perf-before.txt'), 'utf8');
const after = readFileSync(path.join(OUT, '_perf-after.txt'), 'utf8');

// Trim to first 2 full request cycles each
function firstTwoCycles(log, tagRegex) {
  const lines = log.split('\n').filter(Boolean);
  const out = [];
  let cycles = 0;
  let inCycle = false;
  for (const line of lines) {
    if (line.includes('middleware ')) {
      if (inCycle) cycles++;
      if (cycles >= 2) break;
      inCycle = true;
    }
    out.push(line);
  }
  return out.join('\n');
}

const beforeTrim = firstTwoCycles(before);
const afterTrim = firstTwoCycles(after);

function makeHtml(title, log, color, extraNote) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body{margin:0;padding:32px 40px;background:#1a1d22;color:#f7f3ea;font:12px/1.55 'Courier New',monospace}
  h1{color:${color};font-family:'Georgia',serif;font-weight:400;margin:0 0 8px;font-size:20px}
  .sub{color:#a8a8a8;margin-bottom:20px;font-size:12px;font-family:system-ui}
  pre{white-space:pre;background:transparent;margin:0;color:#f7f3ea;font-size:11.5px}
  .hi{color:#7fb069;font-weight:600}
  .warn{color:#e67e22;font-weight:600}
  .red{color:#e74c3c;font-weight:600}
  .note{color:#a88c5f;margin-top:20px;padding-top:14px;border-top:1px solid #3a3d42;font-size:12px;font-family:system-ui;line-height:1.7}
</style></head><body>
<h1>${title}</h1>
<div class="sub">Nightwork · production build · 2-request sample · PERF_LOG=1</div>
<pre id="out"></pre>
<div class="note">${extraNote}</div>
<script>
  const raw = ${JSON.stringify(log)};
  const html = raw
    .replace(/GRAND TOTAL: (\\d+)ms/g, (m, n) => {
      const ms = Number(n);
      const cls = ms < 500 ? 'hi' : ms < 800 ? 'warn' : 'red';
      return \`GRAND TOTAL: <span class="\${cls}">\${n}ms</span>\`;
    })
    .replace(/middleware (\\S+): (\\d+)ms/g, (m, p, n) => {
      const ms = Number(n);
      const cls = ms < 300 ? 'hi' : ms < 500 ? 'warn' : 'red';
      return \`middleware \${p}: <span class="\${cls}">\${n}ms</span>\`;
    });
  document.getElementById('out').innerHTML = html;
</script>
</body></html>`;
}

const beforeHtml = makeHtml(
  'perf — BEFORE optimization',
  beforeTrim,
  '#e67e22',
  `<strong>Client-side totals:</strong> dashboard 1052–1170ms; jobs/health 942–973ms. Target: &lt;500ms.<br>
<strong>Bottleneck:</strong> double auth (middleware + handler), 2 sequential query waves, redundant PO query.`
);
const afterHtml = makeHtml(
  'perf — AFTER optimization',
  afterTrim,
  '#7fb069',
  `<strong>Client-side totals (15-sample medians):</strong> dashboard 352ms; jobs/health 313ms — both well under 500ms.<br>
<strong>What changed:</strong> middleware getSession() for /api hot paths, trusted headers pass-through (auth+membership: 0ms in handler), wave 2 eliminated via prefetch, PO query consolidated.`
);

writeFileSync(path.join(OUT, '_perf-before.html'), beforeHtml);
writeFileSync(path.join(OUT, '_perf-after.html'), afterHtml);

const browser = await chromium.launch();

for (const [html, out] of [
  ['_perf-before.html', 'perf-01-before.png'],
  ['_perf-after.html', 'perf-02-after.png'],
]) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
  await page.goto('file:///' + path.join(OUT, html).replace(/\\/g, '/'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, out), fullPage: true });
  console.log('✓', out);
}

await browser.close();
