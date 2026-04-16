// Second-pass investigation: verify suspicious PASS/FAIL from smoke-test.mjs
// Focus: invoice list render, job detail click, 500 on csv-parse, duplicate detection
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('screenshots');
const EMAIL = 'jake@rossbuilt.com';
const PASSWORD = 'RossBuilt2026!';

const notes = {};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // login
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 15000 }).catch(()=>null),
    page.click('button[type=submit]'),
  ]);

  // ---- Re-check #17: invoice list actually populates ----
  await page.goto(BASE + '/invoices', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);  // client-side Supabase query
  const invoiceRows = await page.locator('tr, [data-invoice-row], a[href*="/invoices/"]').count();
  const bodyHasInvoiceData = /\$[\d,]+\.\d{2}/.test(await page.content());
  notes.invoices_list_rows = invoiceRows;
  notes.invoices_list_has_dollars = bodyHasInvoiceData;
  await page.screenshot({ path: path.join(OUT, 'probe-invoices-list.png'), fullPage: true });

  // Get first invoice detail link
  const firstInvoiceLink = await page.locator('a[href^="/invoices/"]').filter({ hasNotText: /upload|import|qa|queue|payment|liens/i }).first();
  const invLinkCount = await firstInvoiceLink.count();
  notes.invoice_detail_links_count = invLinkCount;
  if (invLinkCount > 0) {
    const href = await firstInvoiceLink.getAttribute('href');
    notes.first_invoice_href = href;
    await page.goto(BASE + href, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const detailInputs = await page.locator('input, textarea, select').count();
    const detailHasLineItems = /line item|description|quantity|qty|rate/i.test(await page.content());
    notes.invoice_detail_inputs = detailInputs;
    notes.invoice_detail_has_line_items = detailHasLineItems;
    await page.screenshot({ path: path.join(OUT, 'probe-invoice-detail.png'), fullPage: true });
  }

  // ---- Re-check #14: job detail click ----
  await page.goto(BASE + '/jobs', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const firstJobLink = page.locator('a[href^="/jobs/"]').filter({ hasNotText: /new/i }).first();
  const jobLinkCount = await firstJobLink.count();
  notes.job_link_count = jobLinkCount;
  if (jobLinkCount > 0) {
    const href = await firstJobLink.getAttribute('href');
    notes.first_job_href = href;
    const t = Date.now();
    const resp = await page.goto(BASE + href, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => ({ error: e.message }));
    notes.job_detail_ms = Date.now() - t;
    notes.job_detail_status = resp?.status?.() || resp?.error || 'unknown';
    await page.waitForTimeout(1500);
    const bodyLen = (await page.content()).length;
    notes.job_detail_body_len = bodyLen;
    await page.screenshot({ path: path.join(OUT, 'probe-job-detail.png'), fullPage: true });
  }

  // ---- Re-check #29: /api/csv-parse/xlsx returns 500 ----
  const csvResp = await page.evaluate(async () => {
    try {
      const r = await fetch('/api/csv-parse/xlsx', { method: 'POST', body: new FormData() });
      const text = await r.text();
      return { status: r.status, body: text.slice(0, 500) };
    } catch (e) { return { error: String(e) }; }
  });
  notes.csv_parse_empty_post = csvResp;

  // Try GET on the same endpoint — some apps support both
  const csvResp2 = await page.evaluate(async () => {
    try {
      const r = await fetch('/api/csv-parse/xlsx', { method: 'GET' });
      return { status: r.status, body: (await r.text()).slice(0, 300) };
    } catch (e) { return { error: String(e) }; }
  });
  notes.csv_parse_get = csvResp2;

  // ---- Probe: is there a duplicate detection endpoint? ----
  const dupEndpoints = ['/api/invoices/parse', '/api/invoices/save', '/api/invoices/import'];
  for (const ep of dupEndpoints) {
    const r = await page.evaluate(async (url) => {
      const res = await fetch(url, { method: 'GET' });
      return { status: res.status, url };
    }, ep);
    notes[`endpoint_${ep}`] = r;
  }

  // ---- Probe #33 #35: find a real draw with revisions ----
  await page.goto(BASE + '/draws', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const drawLinks = await page.locator('a[href^="/draws/"]').filter({ hasNotText: /new/i }).all();
  notes.draw_links = drawLinks.length;
  if (drawLinks.length > 0) {
    const drawHref = await drawLinks[0].getAttribute('href');
    notes.first_draw_href = drawHref;
    await page.goto(BASE + drawHref, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const drawBody = (await page.content()).toLowerCase();
    notes.draw_page_has_cover = /cover letter|letter/i.test(drawBody);
    notes.draw_page_has_export = /export|g702|g703|pdf|excel|download/i.test(drawBody);
    notes.draw_page_has_revision = /revision|compare|diff/i.test(drawBody);
    notes.draw_page_has_lien = /lien/i.test(drawBody);
    await page.screenshot({ path: path.join(OUT, 'probe-draw-detail.png'), fullPage: true });
  }

  // ---- Probe #43 bulk lien upload ----
  await page.goto(BASE + '/invoices/liens', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const lienBody = (await page.content()).toLowerCase();
  notes.liens_page_has_upload = /upload|import|drag|drop/i.test(lienBody);
  notes.liens_page_has_bulk = /bulk/i.test(lienBody);
  await page.screenshot({ path: path.join(OUT, 'probe-liens.png'), fullPage: true });

  // ---- Probe #40 PO partial approval ----
  await page.goto(BASE + '/purchase-orders', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const poLinks = await page.locator('a[href^="/purchase-orders/"]').filter({ hasNotText: /new/i }).all();
  notes.po_links = poLinks.length;
  if (poLinks.length > 0) {
    const poHref = await poLinks[0].getAttribute('href');
    await page.goto(BASE + poHref, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const poBody = (await page.content()).toLowerCase();
    notes.po_detail_has_partial = /partial|remaining|balance/i.test(poBody);
    notes.po_detail_has_approve = /approve/i.test(poBody);
    await page.screenshot({ path: path.join(OUT, 'probe-po-detail.png'), fullPage: true });
  }

  await browser.close();
  writeFileSync('smoke-test-probe.json', JSON.stringify(notes, null, 2));
  console.log(JSON.stringify(notes, null, 2));
})().catch(e => { console.error(e); process.exit(2); });
