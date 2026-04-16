// Third-pass: verify list-page navigation patterns (rows may not be <a>)
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
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('response', r => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });

  // login
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  await Promise.all([page.waitForURL('**/dashboard'), page.click('button[type=submit]')]);

  // ---- /invoices: click first row and see what happens ----
  await page.goto(BASE + '/invoices', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  // Try clicking first table row
  const firstRow = page.locator('tbody tr, [role="row"]').nth(1); // nth(0) is often header
  const rowCount = await page.locator('tbody tr').count();
  notes.inv_tbody_rows = rowCount;
  // Look for any clickable invoice-ish element
  const clickables = await page.locator('button, [role="button"], [onclick]').count();
  notes.inv_clickable_count = clickables;
  // Check if there are any /invoices/[id] hrefs in the rendered DOM
  const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href')).filter(Boolean).filter(h => h.match(/^\/invoices\/[0-9a-f-]/)));
  notes.inv_detail_hrefs = hrefs.slice(0, 5);
  notes.inv_detail_hrefs_count = hrefs.length;

  if (hrefs.length > 0) {
    await page.goto(BASE + hrefs[0], { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    notes.inv_detail_url = page.url();
    notes.inv_detail_body_len = (await page.content()).length;
    const editable = await page.locator('input:not([type="hidden"]), select, textarea').count();
    notes.inv_detail_editable_count = editable;
    await page.screenshot({ path: path.join(OUT, 'probe2-invoice-detail.png'), fullPage: true });
  } else {
    // Try clicking first tbody row
    try {
      await firstRow.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
      notes.inv_detail_via_row_click = page.url();
    } catch (e) {
      notes.inv_row_click_error = String(e).slice(0, 150);
    }
  }

  // ---- /draws: same pattern check ----
  await page.goto(BASE + '/draws', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const drawHrefs = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href')).filter(Boolean).filter(h => h.match(/^\/draws\/[0-9a-f-]/) || h.match(/^\/jobs\/[^\/]+\/draws\/[^\/]+/)));
  notes.draw_hrefs = drawHrefs.slice(0, 5);
  notes.draw_hrefs_count = drawHrefs.length;
  const drawRows = await page.locator('tbody tr').count();
  notes.draw_tbody_rows = drawRows;
  await page.screenshot({ path: path.join(OUT, 'probe2-draws-list.png'), fullPage: true });

  if (drawHrefs.length > 0) {
    await page.goto(BASE + drawHrefs[0], { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const drawBody = (await page.content()).toLowerCase();
    notes.draw_detail_has_cover = /cover letter|letter/i.test(drawBody);
    notes.draw_detail_has_export = /export|g702|g703|pdf|excel|download/i.test(drawBody);
    notes.draw_detail_has_revision = /revision|compare|diff/i.test(drawBody);
    notes.draw_detail_has_lien = /lien/i.test(drawBody);
    notes.draw_detail_url = page.url();
    await page.screenshot({ path: path.join(OUT, 'probe2-draw-detail.png'), fullPage: true });
  }

  // ---- /purchase-orders: same ----
  await page.goto(BASE + '/purchase-orders', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const poHrefs = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href')).filter(Boolean).filter(h => h.match(/\/purchase-orders\/[0-9a-f-]/)));
  notes.po_hrefs = poHrefs.slice(0, 5);
  notes.po_hrefs_count = poHrefs.length;
  notes.po_tbody_rows = await page.locator('tbody tr').count();
  await page.screenshot({ path: path.join(OUT, 'probe2-po-list.png'), fullPage: true });

  // ---- /change-orders ----
  await page.goto(BASE + '/change-orders', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  notes.co_tbody_rows = await page.locator('tbody tr').count();
  notes.co_hrefs = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href')).filter(Boolean).filter(h => h.match(/\/change-orders\/[0-9a-f-]/))).then ? await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href')).filter(Boolean).filter(h => h.match(/\/change-orders\/[0-9a-f-]/))) : [];

  // ---- /invoices/liens: scroll and look for upload button ----
  await page.goto(BASE + '/invoices/liens', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const lienButtons = await page.locator('button').allTextContents();
  notes.lien_buttons = lienButtons.slice(0, 20);
  notes.lien_has_upload_button = lienButtons.some(t => /upload|add|import|bulk/i.test(t));
  await page.screenshot({ path: path.join(OUT, 'probe2-liens.png'), fullPage: true });

  // ---- /invoices/payments: check for batch-by-vendor ----
  await page.goto(BASE + '/invoices/payments', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const payBody = (await page.content()).toLowerCase();
  notes.payments_has_batch = /batch|group.*vendor|vendor.*group/i.test(payBody);
  notes.payments_has_mark_paid = /mark.*paid|paid|record/i.test(payBody);
  await page.screenshot({ path: path.join(OUT, 'probe2-payments.png'), fullPage: true });

  // ---- Verify logout actually works ----
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // Look for logout button anywhere
  const logoutNow = await page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout"), a:has-text("Sign out")').count();
  notes.logout_controls_found_dashboard = logoutNow;

  // ---- /forgot-password submit test ----
  await page.goto(BASE + '/forgot-password', { waitUntil: 'networkidle' });
  const emailInput = await page.locator('input[type=email]').count();
  const submitBtn = await page.locator('button[type=submit], button:has-text("Reset"), button:has-text("Send")').count();
  notes.forgot_has_email = emailInput;
  notes.forgot_has_submit = submitBtn;

  // ---- Search filter on /jobs: actually try typing a job name ----
  await page.goto(BASE + '/jobs', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const jobNamesBefore = await page.evaluate(() => Array.from(document.querySelectorAll('a[href^="/jobs/"]')).map(a => (a.textContent || '').trim().slice(0,40)).filter(Boolean));
  notes.jobs_before_search = jobNamesBefore.length;
  notes.jobs_names_sample = jobNamesBefore.slice(0, 3);
  const search = page.locator('input[type=search], input[placeholder*="search" i]').first();
  if (await search.count() > 0 && jobNamesBefore.length > 0) {
    // search for first job's first word
    const q = (jobNamesBefore[0] || '').split(/\s+/)[0];
    if (q) {
      await search.fill(q);
      await page.waitForTimeout(1000);
      const jobsAfter = await page.locator('a[href^="/jobs/"]').count();
      notes.jobs_after_search = jobsAfter;
      notes.search_query_used = q;
    }
  }

  await browser.close();
  notes.errors = errors;
  writeFileSync('smoke-test-probe2.json', JSON.stringify(notes, null, 2));
  console.log(JSON.stringify(notes, null, 2));
})().catch(e => { console.error(e); process.exit(2); });
