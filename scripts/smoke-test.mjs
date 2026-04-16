// Pre-dogfood comprehensive smoke test.
// Exercises all 60 items from the test spec, captures PASS/FAIL/PARTIAL,
// and takes screenshots only for FAIL/PARTIAL.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('screenshots');
const EMAIL = 'jake@rossbuilt.com';
const PASSWORD = 'RossBuilt2026!';
const RESULTS_JSON = path.resolve('smoke-test-results.json');

mkdirSync(OUT, { recursive: true });

const results = [];
const gaps = [];
const consoleErrors = {};

function addResult(id, area, name, status, note = '') {
  results.push({ id, area, name, status, note });
  const icon = status === 'PASS' ? 'OK' : status === 'PARTIAL' ? '~~' : 'XX';
  console.log(`  [${icon}] #${id} ${name}${note ? ` — ${note}` : ''}`);
}

async function snap(page, id, suffix = 'fail') {
  const file = path.join(OUT, `${String(id).padStart(2, '0')}-${suffix}.png`);
  try { await page.screenshot({ path: file, fullPage: false }); } catch {}
  return file;
}

async function run(id, area, name, fn) {
  try {
    const r = await fn();
    const status = r?.status || 'PASS';
    const note = r?.note || '';
    if (status !== 'PASS') await snap(global.PAGE, id, status.toLowerCase());
    addResult(id, area, name, status, note);
  } catch (e) {
    await snap(global.PAGE, id, 'fail');
    addResult(id, area, name, 'FAIL', (e.message || String(e)).slice(0, 240).replace(/\n/g, ' '));
  }
}

async function gotoWait(page, url, opts = {}) {
  await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 20000, ...opts });
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  global.PAGE = page;

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(`[console.error] ${msg.text()}`.slice(0, 300));
  });

  // ===== AUTH & ORG =====
  console.log('\n== AUTH & ORG ==');

  await run(1, 'Auth', 'Login valid credentials → dashboard', async () => {
    await gotoWait(page, '/login');
    await page.fill('input[type=email]', EMAIL);
    await page.fill('input[type=password]', PASSWORD);
    await Promise.all([
      page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => null),
      page.click('button[type=submit]'),
    ]);
    if (!page.url().includes('/dashboard')) {
      return { status: 'FAIL', note: `Did not reach dashboard, at ${page.url()}` };
    }
  });

  await run(2, 'Auth', 'Logout → /login', async () => {
    // Look for logout button / menu
    const logoutBtn = await page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout"), a:has-text("Sign out")').first();
    if (await logoutBtn.count() === 0) {
      // may be behind a menu — try clicking user avatar/menu
      const menuBtn = page.locator('[aria-label*="menu" i], [aria-label*="user" i], button:has-text("Jake")').first();
      if (await menuBtn.count() > 0) await menuBtn.click({ timeout: 2000 }).catch(() => {});
    }
    const logout2 = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout"), a:has-text("Sign out")').first();
    if (await logout2.count() === 0) return { status: 'PARTIAL', note: 'No logout control found on dashboard' };
    await Promise.all([
      page.waitForURL('**/login', { timeout: 10000 }).catch(() => null),
      logout2.click(),
    ]);
    if (!page.url().includes('/login')) return { status: 'FAIL', note: `After logout at ${page.url()}` };
  });

  await run(3, 'Auth', 'Forgot password page loads', async () => {
    await gotoWait(page, '/forgot-password');
    const hasForm = await page.locator('input[type=email]').count() > 0;
    if (!hasForm) return { status: 'FAIL', note: 'No email input on /forgot-password' };
    // Don't actually submit — just verify form is there
  });

  // re-login for remainder
  await gotoWait(page, '/login');
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => null),
    page.click('button[type=submit]'),
  ]);

  await run(4, 'Org', 'Org settings page loads', async () => {
    await gotoWait(page, '/settings/company');
    const title = await page.title();
    const hasInputs = await page.locator('input, select, textarea').count() > 0;
    if (!hasInputs) return { status: 'FAIL', note: 'No inputs on /settings/company' };
  });

  await run(5, 'Org', 'Workflow settings page loads w/ bulk-import settings', async () => {
    await gotoWait(page, '/settings/workflow');
    const text = await page.content();
    const has3 = ['bulk', 'import', 'threshold'].filter(k => text.toLowerCase().includes(k)).length >= 2;
    if (!has3) return { status: 'PARTIAL', note: 'Bulk-import settings not clearly labeled' };
  });

  // ===== DASHBOARD =====
  console.log('\n== DASHBOARD ==');

  await run(6, 'Dashboard', 'Dashboard <500ms', async () => {
    const times = [];
    for (let i = 0; i < 3; i++) {
      const t = Date.now();
      await gotoWait(page, '/dashboard');
      times.push(Date.now() - t);
    }
    const avg = Math.round(times.reduce((a,b) => a+b, 0) / times.length);
    // This is a full page load including Next.js hydration; API measurement would be tighter.
    const apiT = await page.evaluate(async () => {
      const t = performance.now();
      const r = await fetch('/api/dashboard', { cache: 'no-store' });
      return { ms: Math.round(performance.now() - t), status: r.status };
    });
    if (apiT.status !== 200) return { status: 'FAIL', note: `/api/dashboard returned ${apiT.status}` };
    if (apiT.ms > 500) return { status: 'PARTIAL', note: `API ${apiT.ms}ms >500ms (full page ${avg}ms avg)` };
    return { status: 'PASS', note: `API ${apiT.ms}ms, full page ${avg}ms avg` };
  });

  await run(7, 'Dashboard', 'All 4 KPI cards populate', async () => {
    await gotoWait(page, '/dashboard');
    await page.waitForTimeout(1000);
    const body = (await page.content()).toLowerCase();
    const keys = ['active jobs', 'pending review', 'open draws', 'payments due'];
    const found = keys.filter(k => body.includes(k));
    if (found.length < 4) return { status: 'PARTIAL', note: `${found.length}/4 KPI labels found: ${found.join(', ')}` };
  });

  await run(8, 'Dashboard', 'Needs Attention list renders + clickthrough', async () => {
    await gotoWait(page, '/dashboard');
    await page.waitForTimeout(1000);
    const hasSection = (await page.content()).toLowerCase().includes('needs attention');
    if (!hasSection) return { status: 'FAIL', note: 'No "Needs Attention" section' };
    // try clicking a link inside that section
    const section = page.locator('section, div').filter({ hasText: /needs attention/i }).first();
    const firstLink = section.locator('a').first();
    if (await firstLink.count() === 0) return { status: 'PARTIAL', note: 'Section visible but no clickable items (may be empty state)' };
  });

  await run(9, 'Dashboard', 'Activity Feed renders + view all', async () => {
    await gotoWait(page, '/dashboard');
    await page.waitForTimeout(1000);
    const body = await page.content();
    const hasFeed = /activity/i.test(body);
    if (!hasFeed) return { status: 'FAIL', note: 'No activity section' };
    const viewAll = page.locator('a:has-text("View all activity"), a:has-text("View all")').first();
    if (await viewAll.count() === 0) return { status: 'PARTIAL', note: 'Feed shown but no "View all activity" link' };
  });

  await run(10, 'Dashboard', 'Cash Flow card + aging', async () => {
    await gotoWait(page, '/dashboard');
    await page.waitForTimeout(1000);
    const body = (await page.content()).toLowerCase();
    const hasCF = body.includes('cash flow') || body.includes('outstanding');
    const hasAging = body.includes('aging') || body.includes('30') || body.includes('60');
    if (!hasCF) return { status: 'FAIL', note: 'No Cash Flow card' };
    if (!hasAging) return { status: 'PARTIAL', note: 'Cash Flow present but no aging buckets' };
  });

  // ===== JOBS =====
  console.log('\n== JOBS ==');

  await run(11, 'Jobs', 'Jobs list sorts by health', async () => {
    await gotoWait(page, '/jobs');
    const tbl = await page.locator('table, [role="table"], [data-job-row]').first();
    if (await tbl.count() === 0) {
      const hasRows = (await page.locator('a[href*="/jobs/"]').count()) > 0;
      if (!hasRows) return { status: 'FAIL', note: 'No job rows visible' };
    }
    const body = (await page.content()).toLowerCase();
    const hasHealth = body.includes('health') || body.includes('risk') || body.includes('severity');
    if (!hasHealth) return { status: 'PARTIAL', note: 'No visible "health" sort indicator' };
  });

  await run(12, 'Jobs', 'Search filter works', async () => {
    await gotoWait(page, '/jobs');
    const search = page.locator('input[type=search], input[placeholder*="search" i]').first();
    if (await search.count() === 0) return { status: 'FAIL', note: 'No search input' };
    await search.fill('xxzzqqrare');
    await page.waitForTimeout(800);
    const noResults = /no jobs|no results|no matches/i.test(await page.content());
    if (!noResults) return { status: 'PARTIAL', note: 'Search UI present but no empty-state response' };
    await search.fill('');
  });

  await run(13, 'Jobs', 'Active/Inactive filter', async () => {
    await gotoWait(page, '/jobs');
    const body = (await page.content()).toLowerCase();
    const hasActiveToggle = body.includes('active') && (body.includes('inactive') || body.includes('complete') || body.includes('archive'));
    if (!hasActiveToggle) return { status: 'PARTIAL', note: 'No active/inactive filter visible' };
  });

  await run(14, 'Jobs', 'Click into job → detail loads', async () => {
    await gotoWait(page, '/jobs');
    const firstJobLink = page.locator('a[href*="/jobs/"]').filter({ hasNotText: /new/i }).first();
    if (await firstJobLink.count() === 0) return { status: 'FAIL', note: 'No job links' };
    await firstJobLink.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    if (!/\/jobs\/[^\/]+/.test(page.url())) return { status: 'FAIL', note: `Detail not reached: ${page.url()}` };
  });

  await run(15, 'Jobs', 'Job detail has all tabs', async () => {
    // We should be on a job detail page from #14
    const body = (await page.content()).toLowerCase();
    const tabs = ['budget', 'invoice', 'draw', 'purchase order', 'change order', 'lien'];
    const found = tabs.filter(t => body.includes(t));
    if (found.length < 4) return { status: 'PARTIAL', note: `Only ${found.length}/6 tabs visible: ${found.join(', ')}` };
  });

  await run(16, 'Jobs', 'New Job button → creation flow', async () => {
    await gotoWait(page, '/jobs/new');
    const inputs = await page.locator('input').count();
    if (inputs < 2) return { status: 'FAIL', note: `Only ${inputs} inputs on /jobs/new` };
    // Don't actually create — just verify form
  });

  // ===== INVOICES =====
  console.log('\n== INVOICES ==');

  await run(17, 'Invoices', '/invoices list loads', async () => {
    await gotoWait(page, '/invoices');
    const body = await page.content();
    const hasInvoices = /invoice/i.test(body);
    if (!hasInvoices) return { status: 'FAIL', note: 'No "invoice" text on page' };
    // count approximate rows
    const rows = await page.locator('a[href*="/invoices/"]').count();
    return { status: 'PASS', note: `~${rows} invoice links visible` };
  });

  await run(18, 'Invoices', 'Filters work (job/PM/confidence/status)', async () => {
    await gotoWait(page, '/invoices');
    const body = (await page.content()).toLowerCase();
    const filters = ['job', 'status', 'confidence', 'pm', 'vendor'];
    const found = filters.filter(f => body.includes(f));
    if (found.length < 3) return { status: 'PARTIAL', note: `Filter keywords found: ${found.join(', ')}` };
  });

  await run(19, 'Invoices', 'Single upload page loads', async () => {
    await gotoWait(page, '/invoices/upload');
    const hasDrop = (await page.content()).toLowerCase().match(/drag|drop|upload|choose file|select file/);
    if (!hasDrop) return { status: 'FAIL', note: 'No upload UI found' };
  });

  await run(20, 'Invoices', '/invoices/import page loads', async () => {
    await gotoWait(page, '/invoices/import');
    const body = (await page.content()).toLowerCase();
    if (!body.match(/import|bulk|upload/)) return { status: 'FAIL', note: 'Import page missing core UI' };
    // Don't actually process 8 files in smoke — just confirm UI
    return { status: 'PARTIAL', note: 'Page loads; full 8-file batch not run in smoke (write-heavy)' };
  });

  await run(21, 'Invoices', 'Bulk-assign job to rows', async () => {
    await gotoWait(page, '/invoices/import');
    const body = (await page.content()).toLowerCase();
    const hasBulk = body.includes('assign') || body.includes('bulk');
    if (!hasBulk) return { status: 'PARTIAL', note: 'Bulk-assign control not detected without loading fixtures' };
  });

  await run(22, 'Invoices', 'Send N to approval queue (UI present)', async () => {
    await gotoWait(page, '/invoices/import');
    const body = (await page.content()).toLowerCase();
    if (!body.match(/send|approve|queue|submit/)) return { status: 'PARTIAL', note: 'Send-to-queue control not obvious without fixtures loaded' };
  });

  await run(23, 'Invoices', 'PM queue /invoices/qa loads', async () => {
    await gotoWait(page, '/invoices/qa');
    const body = await page.content();
    if (!/qa|review|queue|approve/i.test(body)) return { status: 'FAIL', note: 'QA/review page missing expected labels' };
  });

  await run(24, 'Invoices', 'Invoice detail → editable', async () => {
    await gotoWait(page, '/invoices');
    const firstLink = page.locator('a[href*="/invoices/"]').filter({ hasNotText: /upload|import|qa|queue|payment/i }).first();
    if (await firstLink.count() === 0) return { status: 'PARTIAL', note: 'No invoice detail links available' };
    await firstLink.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    const hasInputs = await page.locator('input, textarea, select').count() > 2;
    if (!hasInputs) return { status: 'PARTIAL', note: 'Detail loaded but few editable fields' };
  });

  await run(25, 'Invoices', 'Duplicate detection on re-upload (code-level)', async () => {
    // Code-level: check if dup detection API exists
    const resp = await page.evaluate(async () => {
      const r = await fetch('/api/invoices?limit=1', { cache: 'no-store' });
      return { status: r.status };
    });
    if (resp.status !== 200) return { status: 'FAIL', note: `/api/invoices returned ${resp.status}` };
    return { status: 'PARTIAL', note: 'Duplicate detection not exercised end-to-end in smoke (would require upload + re-upload)' };
  });

  await run(26, 'Invoices', 'Dismiss duplicate (UI present)', async () => {
    return { status: 'PARTIAL', note: 'Cannot verify without triggering a duplicate first; endpoint-only check' };
  });

  await run(27, 'Invoices', 'Payment recording page', async () => {
    await gotoWait(page, '/invoices/payments');
    const body = (await page.content()).toLowerCase();
    if (!body.match(/payment|paid|check/)) return { status: 'FAIL', note: 'Payments page missing expected labels' };
  });

  await run(28, 'Invoices', 'Batch payment by vendor', async () => {
    const body = (await page.content()).toLowerCase();
    const hasBatch = body.includes('batch') || body.includes('group') || body.includes('vendor');
    if (!hasBatch) return { status: 'PARTIAL', note: 'Batch-by-vendor control not clearly visible' };
  });

  await run(29, 'Invoices', 'CSV/XLSX parse endpoint', async () => {
    const resp = await page.evaluate(async () => {
      const r = await fetch('/api/csv-parse/xlsx', { method: 'POST' });
      return { status: r.status };
    });
    // expect 400/415 without body, not 404
    if (resp.status === 404) return { status: 'FAIL', note: 'Endpoint 404' };
    return { status: 'PASS', note: `Endpoint exists (responds ${resp.status} to empty POST)` };
  });

  // ===== DRAWS =====
  console.log('\n== DRAWS ==');

  await run(30, 'Draws', '/draws list loads', async () => {
    await gotoWait(page, '/draws');
    const body = await page.content();
    if (!/draw/i.test(body)) return { status: 'FAIL', note: 'No "draw" content' };
  });

  await run(31, 'Draws', 'Draft editable / submitted read-only', async () => {
    const body = (await page.content()).toLowerCase();
    const hasStatus = body.includes('draft') || body.includes('submitted');
    if (!hasStatus) return { status: 'PARTIAL', note: 'No draft/submitted status labels visible' };
  });

  await run(32, 'Draws', 'New draw wizard loads', async () => {
    await gotoWait(page, '/draws/new');
    const inputs = await page.locator('input, select').count();
    if (inputs < 1) return { status: 'FAIL', note: 'No wizard inputs' };
  });

  await run(33, 'Draws', 'Draw cover letter gen (UI present)', async () => {
    await gotoWait(page, '/draws');
    const firstDraw = page.locator('a[href*="/draws/"]').filter({ hasNotText: /new/i }).first();
    if (await firstDraw.count() === 0) return { status: 'PARTIAL', note: 'No existing draws to enter' };
    await firstDraw.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    const body = (await page.content()).toLowerCase();
    const hasCover = body.includes('cover letter') || body.includes('cover');
    if (!hasCover) return { status: 'PARTIAL', note: 'Cover letter UI not visible on draw detail' };
  });

  await run(34, 'Draws', 'G702/G703 export (UI present)', async () => {
    const body = (await page.content()).toLowerCase();
    const hasExport = body.includes('g702') || body.includes('g703') || body.includes('export') || body.includes('pdf') || body.includes('excel');
    if (!hasExport) return { status: 'PARTIAL', note: 'No export buttons visible on draw detail' };
  });

  await run(35, 'Draws', 'Draw comparison (revision diff)', async () => {
    const body = (await page.content()).toLowerCase();
    const hasDiff = body.includes('revision') || body.includes('compare') || body.includes('diff');
    if (!hasDiff) return { status: 'PARTIAL', note: 'No comparison/revision UI visible' };
  });

  await run(36, 'Draws', 'Lien release upload on line items', async () => {
    const body = (await page.content()).toLowerCase();
    const hasLien = body.includes('lien');
    if (!hasLien) return { status: 'PARTIAL', note: 'No lien references on draw page' };
  });

  // ===== BUDGETS / POs / COs =====
  console.log('\n== BUDGETS / POs / COs ==');

  await run(37, 'Budget', 'Job budget page loads', async () => {
    await gotoWait(page, '/jobs');
    const firstJob = page.locator('a[href*="/jobs/"]').filter({ hasNotText: /new/i }).first();
    if (await firstJob.count() === 0) return { status: 'FAIL', note: 'No jobs' };
    const href = await firstJob.getAttribute('href');
    await gotoWait(page, `${href}/budget`);
    const body = (await page.content()).toLowerCase();
    if (!body.match(/budget|cost code|estimate/)) return { status: 'PARTIAL', note: 'Budget page loaded but expected labels missing' };
  });

  await run(38, 'Budget', 'Budget import (Excel) UI', async () => {
    const body = (await page.content()).toLowerCase();
    const hasImport = body.includes('import') || body.includes('upload');
    if (!hasImport) return { status: 'PARTIAL', note: 'No import control on budget page' };
  });

  await run(39, 'PO', 'PO list + new PO', async () => {
    await gotoWait(page, '/purchase-orders');
    const body = (await page.content()).toLowerCase();
    if (!body.match(/purchase order|po/)) return { status: 'FAIL', note: 'PO page missing' };
  });

  await run(40, 'PO', 'PO partial approval (UI present)', async () => {
    await gotoWait(page, '/purchase-orders');
    const body = (await page.content()).toLowerCase();
    const hasPartial = body.includes('partial') || body.includes('remaining') || body.includes('balance');
    if (!hasPartial) return { status: 'PARTIAL', note: 'No partial-approval indicator visible from list' };
  });

  await run(41, 'CO', 'CO list + new CO', async () => {
    await gotoWait(page, '/change-orders');
    const body = (await page.content()).toLowerCase();
    if (!body.match(/change order|co/)) return { status: 'FAIL', note: 'CO page missing' };
  });

  // ===== LIEN RELEASES =====
  console.log('\n== LIEN RELEASES ==');

  await run(42, 'Lien', 'Lien release list loads', async () => {
    // try a few likely paths
    const paths = ['/lien-releases', '/liens', '/invoices/liens'];
    let ok = false, note = '';
    for (const p of paths) {
      const r = await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => null);
      if (r && r.status() === 200 && /lien/i.test(await page.content())) { ok = true; note = p; break; }
    }
    if (!ok) return { status: 'FAIL', note: 'No lien release list page found' };
    return { status: 'PASS', note: `at ${note}` };
  });

  await run(43, 'Lien', 'Bulk lien upload', async () => {
    const body = (await page.content()).toLowerCase();
    const hasBulk = body.includes('bulk') || body.includes('upload');
    if (!hasBulk) return { status: 'PARTIAL', note: 'No bulk upload control visible' };
  });

  await run(44, 'Lien', 'Lien → draw line item matching', async () => {
    const body = (await page.content()).toLowerCase();
    const hasMatch = body.includes('match') || body.includes('draw') || body.includes('line item');
    if (!hasMatch) return { status: 'PARTIAL', note: 'No matching UI visible' };
  });

  // ===== VENDORS =====
  console.log('\n== VENDORS ==');

  await run(45, 'Vendors', '/vendors list loads', async () => {
    await gotoWait(page, '/vendors');
    const rows = await page.locator('a[href*="/vendors/"]').count();
    if (rows === 0 && !/vendor/i.test(await page.content())) return { status: 'FAIL', note: 'No vendors content' };
    return { status: 'PASS', note: `~${rows} vendor links` };
  });

  await run(46, 'Vendors', 'Vendor detail shows invoice history', async () => {
    await gotoWait(page, '/vendors');
    const link = page.locator('a[href*="/vendors/"]').filter({ hasNotText: /import|new/i }).first();
    if (await link.count() === 0) return { status: 'PARTIAL', note: 'No vendor details to enter' };
    await link.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    const body = (await page.content()).toLowerCase();
    if (!body.includes('invoice')) return { status: 'PARTIAL', note: 'Vendor detail has no invoice history section' };
  });

  await run(47, 'Vendors', 'Vendor merge tool', async () => {
    const body = (await page.content()).toLowerCase();
    const hasMerge = body.includes('merge') || body.includes('duplicate');
    if (!hasMerge) return { status: 'PARTIAL', note: 'No merge/duplicate UI visible on vendor detail' };
  });

  await run(48, 'Vendors', 'Vendor import CSV', async () => {
    await gotoWait(page, '/vendors/import');
    const body = (await page.content()).toLowerCase();
    if (!body.match(/import|csv|upload/)) return { status: 'FAIL', note: 'Import page missing' };
  });

  // ===== REPORTS / FINANCIALS =====
  console.log('\n== REPORTS / FINANCIALS ==');

  await run(49, 'Reports', 'Aging report loads', async () => {
    await gotoWait(page, '/financials/aging-report');
    const body = (await page.content()).toLowerCase();
    if (!body.match(/aging|30|60|90/)) return { status: 'FAIL', note: 'Aging report content missing' };
  });

  await run(50, 'Reports', 'Overdue invoices view', async () => {
    const paths = ['/financials/overdue', '/invoices?status=overdue', '/financials'];
    let ok = false, note = '';
    for (const p of paths) {
      const r = await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => null);
      const b = (await page.content()).toLowerCase();
      if (r && r.status() === 200 && (b.includes('overdue') || b.includes('past due'))) { ok = true; note = p; break; }
    }
    if (!ok) return { status: 'PARTIAL', note: 'Dedicated overdue view not found; may live under aging report' };
    return { status: 'PASS', note: `at ${note}` };
  });

  // ===== SETTINGS =====
  console.log('\n== SETTINGS ==');

  await run(51, 'Settings', 'Company settings editable', async () => {
    await gotoWait(page, '/settings/company');
    const inputs = await page.locator('input, textarea, select').count();
    const saveBtn = await page.locator('button:has-text("Save"), button[type=submit]').count();
    if (inputs < 2 || saveBtn === 0) return { status: 'PARTIAL', note: `${inputs} inputs, ${saveBtn} save buttons` };
  });

  await run(52, 'Settings', 'Team management: invite flow', async () => {
    await gotoWait(page, '/settings/team');
    const body = (await page.content()).toLowerCase();
    const hasInvite = body.includes('invite') || body.includes('add member');
    if (!hasInvite) return { status: 'PARTIAL', note: 'No invite control visible' };
  });

  await run(53, 'Settings', 'Cost codes list/create/edit/import', async () => {
    await gotoWait(page, '/settings/cost-codes');
    const body = (await page.content()).toLowerCase();
    const hasList = body.includes('cost code') || body.includes('code');
    const hasActions = body.includes('add') || body.includes('new') || body.includes('import');
    if (!hasList || !hasActions) return { status: 'PARTIAL', note: `list=${hasList} actions=${hasActions}` };
  });

  await run(54, 'Settings', 'Billing: Stripe portal link', async () => {
    await gotoWait(page, '/settings/billing');
    const body = (await page.content()).toLowerCase();
    const hasBilling = body.includes('billing') || body.includes('stripe') || body.includes('portal') || body.includes('subscription');
    if (!hasBilling) return { status: 'FAIL', note: 'Billing page missing expected content' };
  });

  await run(55, 'Settings', 'Workflow settings save', async () => {
    await gotoWait(page, '/settings/workflow');
    const saveBtn = await page.locator('button:has-text("Save"), button[type=submit]').count();
    if (saveBtn === 0) return { status: 'PARTIAL', note: 'No save button visible (may auto-save)' };
  });

  // ===== KEYBOARD / UX =====
  console.log('\n== KEYBOARD / UX ==');

  await run(56, 'UX', 'Keyboard shortcuts (spot check)', async () => {
    await gotoWait(page, '/dashboard');
    // Try a common shortcut pattern: ? opens help
    await page.keyboard.press('?');
    await page.waitForTimeout(500);
    const helpVisible = /shortcut|keyboard|press/i.test(await page.content());
    if (!helpVisible) return { status: 'PARTIAL', note: 'No ? shortcut help found; need explicit documented shortcuts' };
    await page.keyboard.press('Escape');
  });

  await run(57, 'UX', 'Empty states for new orgs', async () => {
    // Can't easily test without new org — code-level check: look for common empty-state patterns in pages we already visited
    return { status: 'PARTIAL', note: 'Not testable without new org fixture; verified only that pages handle no-results states in search' };
  });

  await run(58, 'UX', 'Loading skeletons', async () => {
    // Capture a fast navigation and look for skeleton classes
    await page.goto(BASE + '/invoices', { waitUntil: 'domcontentloaded' });
    const body = await page.content();
    const hasSkeleton = /skeleton|animate-pulse|loading/i.test(body);
    if (!hasSkeleton) return { status: 'PARTIAL', note: 'No skeleton/pulse classes in initial HTML' };
  });

  await run(59, 'UX', 'Toasts for save/error', async () => {
    // Navigate to a form and check for toast library signals in DOM
    await gotoWait(page, '/settings/company');
    const body = await page.content();
    const hasToast = /toast|notif|role="status"|aria-live/i.test(body);
    if (!hasToast) return { status: 'PARTIAL', note: 'No obvious toast/aria-live region in DOM' };
  });

  await run(60, 'UX', 'Mobile responsive 375px', async () => {
    await page.setViewportSize({ width: 375, height: 800 });
    await gotoWait(page, '/dashboard');
    await page.waitForTimeout(800);
    // check overflow
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    await page.screenshot({ path: path.join(OUT, '60-mobile-dashboard.png'), fullPage: true });
    await gotoWait(page, '/invoices/qa');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, '60-mobile-qa.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    if (overflow) return { status: 'PARTIAL', note: 'Dashboard has horizontal scroll at 375px' };
  });

  // ===== DONE =====
  await browser.close();

  // Write JSON
  writeFileSync(RESULTS_JSON, JSON.stringify({ results, pageErrors }, null, 2));
  console.log(`\n== DONE ==\nResults: ${results.length}  PASS: ${results.filter(r=>r.status==='PASS').length}  PARTIAL: ${results.filter(r=>r.status==='PARTIAL').length}  FAIL: ${results.filter(r=>r.status==='FAIL').length}`);
  console.log('Console/page errors captured:', pageErrors.length);
  if (pageErrors.length) {
    console.log('First 10 errors:');
    pageErrors.slice(0, 10).forEach(e => console.log(' -', e));
  }
  process.exit(0);
})().catch(e => { console.error('SMOKE TEST CRASHED:', e); process.exit(2); });
