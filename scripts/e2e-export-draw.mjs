import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BASE = 'http://localhost:3000';
const EMAIL = 'jake@rossbuilt.com';
const PASSWORD = 'RossBuilt2026!';
const OUT = path.resolve('screenshots');
const DELIVERABLES = 'C:/Users/Jake/Ross-Built-Command/test-invoices';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const { data: draws } = await sb
  .from('draws')
  .select('id, draw_number, status')
  .order('created_at', { ascending: false })
  .limit(1);
const drawId = draws[0].id;
console.log(`drawId: ${drawId}  drawNumber: ${draws[0].draw_number}  status: ${draws[0].status}`);

const findings = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => findings.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') findings.push(`console.error: ${m.text().slice(0, 200)}`); });

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', EMAIL);
await page.fill('input[type=password]', PASSWORD);
await Promise.all([page.waitForURL('**/dashboard', { timeout: 15000 }).catch(()=>null), page.click('button[type=submit]')]);

await page.goto(BASE + `/draws/${drawId}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4500);

// Full-page screenshot of draw detail.
await page.screenshot({ path: path.join(OUT, 'e2e-07-draw-built.png'), fullPage: true });

// Try to find G702 / G703 sections and snapshot them.
async function snapSection(label, outName) {
  const loc = page.locator(`text=/${label}/i`).first();
  const count = await loc.count();
  if (count === 0) { findings.push(`${label} section not found on draw page`); return; }
  await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, outName), fullPage: false });
  console.log(`snapped ${outName}`);
}
await snapSection('G702', 'e2e-08-g702-preview.png');
await snapSection('G703', 'e2e-09-g703-preview.png');

// ─── Export Excel (the real endpoint, no ?format=) ─────────
console.log('→ download XLSX');
const xlsxResp = await page.evaluate(async (id) => {
  const r = await fetch(`/api/draws/${id}/export`);
  if (!r.ok) return { status: r.status, bytes: 0, body: (await r.text()).slice(0, 300) };
  const buf = await r.arrayBuffer();
  const arr = Array.from(new Uint8Array(buf));
  return { status: r.status, bytes: arr.length, b64: btoa(String.fromCharCode(...arr.slice(0, 0))), data: arr };
}, drawId);
if (xlsxResp.status === 200 && xlsxResp.data) {
  const buf = Buffer.from(xlsxResp.data);
  const xlsxPath = path.join(DELIVERABLES, 'e2e-09-g702-g703.xlsx');
  writeFileSync(xlsxPath, buf);
  console.log(`  saved ${xlsxPath}  (${buf.length} bytes)`);
  findings.push(`XLSX export: ${buf.length} bytes saved`);
} else {
  findings.push(`XLSX export HTTP ${xlsxResp.status}: ${xlsxResp.body ?? ''}`);
}

// ─── Render PDF via page.pdf (simulates the window.print() path) ─────────
console.log('→ render PDF via Playwright');
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(500);
const pdfPath = path.join(DELIVERABLES, 'e2e-08-g702-g703.pdf');
try {
  const pdfBuf = await page.pdf({ path: pdfPath, format: 'Letter', printBackground: true });
  console.log(`  saved ${pdfPath}  (${pdfBuf.length} bytes)`);
  findings.push(`PDF via browser-print: ${pdfBuf.length} bytes saved`);
} catch (e) {
  findings.push(`PDF render failed: ${e.message}`);
}
await page.emulateMedia({ media: 'screen' });

// Cover letter check.
console.log('→ cover letter endpoint');
const cl = await page.evaluate(async (id) => {
  const r = await fetch(`/api/draws/${id}/cover-letter`);
  return { status: r.status, bytes: (await r.text()).length };
}, drawId);
findings.push(`cover-letter GET HTTP ${cl.status} bytes=${cl.bytes}`);
console.log(`  cover-letter HTTP ${cl.status}  ${cl.bytes} bytes`);

writeFileSync('e2e-export-log.json', JSON.stringify({ drawId, findings }, null, 2));
await browser.close();
console.log('done');
