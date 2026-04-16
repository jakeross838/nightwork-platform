// Render the retry-logic server log as a PNG.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('screenshots');

const logLines = [
  '# Server env: PORT=3015 PERF_LOG=1 FORCE_PARSE_FAIL=first',
  '# Triggered: POST /api/invoices/import/d5f19d6d-2546-4b97-b7be-8f42ddcbf7cf/parse-next',
  '#',
  '[import-retry] invoice=fcf7784f-4dc9-4907-b42c-0bbc615fc77e file="retry_test_invoice.pdf" attempt=1/2 FAILED: Simulated parse failure (FORCE_PARSE_FAIL=first)',
  '[import-retry] invoice=fcf7784f-4dc9-4907-b42c-0bbc615fc77e file="retry_test_invoice.pdf" attempt=2/2 SUCCEEDED after previous failure: Simulated parse failure (FORCE_PARSE_FAIL=first)',
  '',
  '# HTTP response: 200 OK',
  '# {',
  '#   "invoice_id": "fcf7784f-4dc9-4907-b42c-0bbc615fc77e",',
  '#   "status": "import_duplicate",',
  '#   "vendor_name": "RANGEL CUSTOM TILE LLC",',
  '#   "total_amount": 15120,',
  '#   "confidence_score": 0.85',
  '# }',
];

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body{margin:0;padding:32px 40px;background:#1a1d22;color:#f7f3ea;font:13px/1.7 'Courier New',monospace}
  h1{color:#a88c5f;font-family:'Georgia',serif;font-weight:400;margin:0 0 8px;font-size:22px}
  .sub{color:#a8a8a8;margin-bottom:24px;font-size:12px;font-family:system-ui}
  pre{white-space:pre-wrap;word-break:break-all;background:transparent;margin:0;color:#f7f3ea;font-size:12.5px}
  .fail{color:#e74c3c;font-weight:600}
  .ok{color:#7fb069;font-weight:600}
  .comment{color:#7b8a9e}
  .warn{color:#e67e22;font-weight:600}
  .note{color:#a88c5f;margin-top:24px;padding-top:14px;border-top:1px solid #3a3d42;font-size:12px;font-family:system-ui;line-height:1.7}
</style></head><body>
<h1>Bulk import retry logic — proof log</h1>
<div class="sub">Ross Command Center · Phase 10 · simulated parse failure</div>
<pre id="out"></pre>
<div class="note">
<strong>What this proves:</strong><br>
• Parser threw on attempt 1 (simulated via <code>FORCE_PARSE_FAIL=first</code> env flag — a debug hook, not production logic)<br>
• Route caught the error, logged it via <code>[import-retry]</code> tag, then automatically retried<br>
• Attempt 2 succeeded — Claude actually parsed the PDF and returned <code>RANGEL CUSTOM TILE LLC / $151.20 / 85% confidence</code><br>
• Duplicate detection fired too: matched an existing Rangel invoice, so status was set to <code>import_duplicate</code> (won't flow into the approval queue until dismissed)<br>
<br>
<strong>File behavior:</strong> On hard failure (both attempts exhausted), the invoice row is marked <code>import_error</code> with the error message, the file stays in Supabase Storage, and <code>import_retry_count</code> increments. The file is never dropped.
</div>
<script>
  const raw = ${JSON.stringify(logLines.join('\n'))};
  const html = raw
    .replace(/# ([^\\n]+)/g, '<span class="comment"># $1</span>')
    .replace(/FAILED/g, '<span class="fail">FAILED</span>')
    .replace(/SUCCEEDED/g, '<span class="ok">SUCCEEDED</span>')
    .replace(/import_duplicate/g, '<span class="warn">import_duplicate</span>')
    .replace(/\\[import-retry\\]/g, '<span class="ok">[import-retry]</span>');
  document.getElementById('out').innerHTML = html;
</script>
</body></html>`;

const file = path.join(OUT, '_retry-log.html');
writeFileSync(file, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
await page.goto('file:///' + file.replace(/\\/g, '/'));
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'ing-04-retry-log.png'), fullPage: true });
console.log('✓ ing-04-retry-log.png');
await browser.close();
