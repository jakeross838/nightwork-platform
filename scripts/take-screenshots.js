// Playwright screenshot script for Ross Command Center.
// Logs in as jake@rossbuilt.com and captures 13 full-page screenshots
// to the path specified as OUT_DIR (defaults to C:/Users/jaker/Screenshots).
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const OUT_DIR = process.env.OUT_DIR || "C:/Users/jaker/Screenshots";
const BASE = process.env.BASE || "http://localhost:3000";
const EMAIL = process.env.LOGIN_EMAIL || "jake@rossbuilt.com";
const PASSWORD = process.env.LOGIN_PASSWORD || "RossBuilt2026!";

const NAME_MATCH = /drummond/i;

async function shot(page, file) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(600);
  const target = path.join(OUT_DIR, file);
  await page.screenshot({ path: target, fullPage: true });
  console.log(`  ✓ ${file}`);
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  // Wipe any existing PNGs so we know every file is fresh.
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.toLowerCase().endsWith(".png")) fs.unlinkSync(path.join(OUT_DIR, f));
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const failed = [];

  try {
    console.log("→ Logging in…");
    await page.goto(`${BASE}/login`);
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await Promise.all([
      page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 15000 }),
      page.click('button[type="submit"]'),
    ]);
    console.log("  ✓ Signed in");

    // 01 Landing
    await page.goto(`${BASE}/`);
    await shot(page, "01-landing.png");

    // 02 Nav dropdown — click Invoices in nav
    try {
      const invoicesBtn = page.locator('nav button:has-text("Invoices")').first();
      await invoicesBtn.click({ timeout: 5000 });
      await page.waitForTimeout(400);
      await shot(page, "02-nav-dropdown.png");
      // Close dropdown
      await page.keyboard.press("Escape").catch(() => {});
      await page.mouse.click(20, 20).catch(() => {});
    } catch (e) {
      failed.push(`02-nav-dropdown.png — ${e.message}`);
    }

    // 03 PM queue
    try {
      await page.goto(`${BASE}/invoices/queue`);
      await shot(page, "03-pm-queue.png");
    } catch (e) { failed.push(`03-pm-queue.png — ${e.message}`); }

    // 04 Invoice detail — find one from the queue
    let invoiceId = null;
    try {
      await page.goto(`${BASE}/invoices`);
      await page.waitForLoadState("networkidle");
      invoiceId = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('a[href^="/invoices/"]'));
        for (const a of rows) {
          const m = a.getAttribute("href").match(/^\/invoices\/([a-f0-9-]+)$/);
          if (m) return m[1];
        }
        // Fallback: look for clickable row handlers
        return null;
      });
      if (!invoiceId) {
        // Click the first row and capture URL
        await page.locator("table tbody tr").first().click({ timeout: 5000 });
        await page.waitForURL(/\/invoices\/[a-f0-9-]{8,}/, { timeout: 8000 });
        const url = page.url();
        const m = url.match(/\/invoices\/([a-f0-9-]+)/);
        invoiceId = m?.[1] ?? null;
      } else {
        await page.goto(`${BASE}/invoices/${invoiceId}`);
      }
      await shot(page, "04-invoice-detail.png");
    } catch (e) { failed.push(`04-invoice-detail.png — ${e.message}`); }

    // 05 Partial approve modal
    try {
      if (invoiceId) {
        await page.goto(`${BASE}/invoices/${invoiceId}`);
        await page.waitForLoadState("networkidle");
        const btn = page.locator('button:has-text("Partial Approve")').first();
        if (await btn.isVisible({ timeout: 4000 })) {
          await btn.click();
          await page.waitForTimeout(600);
          await shot(page, "05-partial-approve-modal.png");
          await page.keyboard.press("Escape").catch(() => {});
        } else {
          failed.push("05-partial-approve-modal.png — Partial Approve button not visible (invoice may not be in PM-review status or has <2 line items)");
        }
      } else {
        failed.push("05-partial-approve-modal.png — no invoiceId from step 04");
      }
    } catch (e) { failed.push(`05-partial-approve-modal.png — ${e.message}`); }

    // 06 Jobs list
    try {
      await page.goto(`${BASE}/jobs`);
      await shot(page, "06-job-list.png");
    } catch (e) { failed.push(`06-job-list.png — ${e.message}`); }

    // 07–10: Drummond job
    let drummondId = null;
    try {
      await page.goto(`${BASE}/jobs`);
      await page.waitForLoadState("networkidle");
      drummondId = await page.evaluate((rx) => {
        const pattern = new RegExp(rx, "i");
        const rows = Array.from(document.querySelectorAll("table tbody tr"));
        for (const r of rows) {
          if (pattern.test(r.textContent || "")) {
            const click = r.getAttribute("onclick") || "";
            const m1 = click.match(/\/jobs\/([a-f0-9-]+)/);
            if (m1) return m1[1];
            const a = r.querySelector('a[href*="/jobs/"]');
            if (a) {
              const m2 = a.getAttribute("href").match(/\/jobs\/([a-f0-9-]+)/);
              if (m2) return m2[1];
            }
          }
        }
        return null;
      }, NAME_MATCH.source);

      if (!drummondId) {
        // Click the row that contains "Drummond"
        const rowLocator = page.locator("table tbody tr", { hasText: /drummond/i }).first();
        if (await rowLocator.count() > 0) {
          await rowLocator.click({ timeout: 5000 });
          await page.waitForURL(/\/jobs\/[a-f0-9-]+$/, { timeout: 10000 });
          const m = page.url().match(/\/jobs\/([a-f0-9-]+)/);
          drummondId = m?.[1] ?? null;
        }
      }
    } catch (e) { /* handled per screenshot */ }

    if (drummondId) {
      try {
        await page.goto(`${BASE}/jobs/${drummondId}`);
        await shot(page, "07-job-detail-overview.png");
      } catch (e) { failed.push(`07-job-detail-overview.png — ${e.message}`); }
      try {
        await page.goto(`${BASE}/jobs/${drummondId}/budget`);
        await shot(page, "08-job-detail-budget.png");
      } catch (e) { failed.push(`08-job-detail-budget.png — ${e.message}`); }
      try {
        await page.goto(`${BASE}/jobs/${drummondId}/change-orders`);
        await shot(page, "09-job-detail-cos.png");
      } catch (e) { failed.push(`09-job-detail-cos.png — ${e.message}`); }
      try {
        await page.goto(`${BASE}/jobs/${drummondId}/invoices`);
        await shot(page, "10-job-detail-invoices.png");
      } catch (e) { failed.push(`10-job-detail-invoices.png — ${e.message}`); }
    } else {
      failed.push("07-10 — Could not find Drummond job");
    }

    // 11 Draw detail
    try {
      await page.goto(`${BASE}/draws`);
      await page.waitForLoadState("networkidle");
      await page.locator("table tbody tr").first().click({ timeout: 5000 });
      await page.waitForURL(/\/draws\/[a-f0-9-]+$/, { timeout: 10000 });
      await shot(page, "11-draw-detail.png");
    } catch (e) { failed.push(`11-draw-detail.png — ${e.message}`); }

    // 12 Vendor detail
    try {
      await page.goto(`${BASE}/vendors`);
      await page.waitForLoadState("networkidle");
      const link = page.locator('a[href^="/vendors/"]').first();
      await link.click({ timeout: 5000 });
      await page.waitForURL(/\/vendors\/[a-f0-9-]+$/, { timeout: 10000 });
      await shot(page, "12-vendor-detail.png");
    } catch (e) { failed.push(`12-vendor-detail.png — ${e.message}`); }

    // 13 Breadcrumbs — already visible on most inner pages. Use the job budget.
    try {
      if (drummondId) {
        await page.goto(`${BASE}/jobs/${drummondId}/budget`);
        await page.waitForLoadState("networkidle");
        // Crop just the top 400 px to highlight breadcrumbs + tabs
        await page.screenshot({
          path: path.join(OUT_DIR, "13-breadcrumbs.png"),
          clip: { x: 0, y: 0, width: 1440, height: 420 },
        });
        console.log("  ✓ 13-breadcrumbs.png (clipped)");
      } else if (invoiceId) {
        await page.goto(`${BASE}/invoices/${invoiceId}`);
        await page.waitForLoadState("networkidle");
        await page.screenshot({
          path: path.join(OUT_DIR, "13-breadcrumbs.png"),
          clip: { x: 0, y: 0, width: 1440, height: 420 },
        });
        console.log("  ✓ 13-breadcrumbs.png (clipped)");
      } else {
        failed.push("13-breadcrumbs.png — no inner page available");
      }
    } catch (e) { failed.push(`13-breadcrumbs.png — ${e.message}`); }

    if (failed.length) {
      console.log("\n--- FAILURES ---");
      for (const f of failed) console.log("  ✗", f);
      process.exitCode = 1;
    } else {
      console.log("\nAll 13 screenshots captured.");
    }
  } finally {
    await browser.close();
  }
})();
