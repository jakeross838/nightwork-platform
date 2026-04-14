// Retry just 04 (invoice detail) and 05 (partial approve modal).
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const OUT_DIR = process.env.OUT_DIR || "C:/Users/jaker/Screenshots";
const BASE = process.env.BASE || "http://localhost:3000";
const EMAIL = process.env.LOGIN_EMAIL || "jake@rossbuilt.com";
const PASSWORD = process.env.LOGIN_PASSWORD || "RossBuilt2026!";

async function shot(page, file) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
  const target = path.join(OUT_DIR, file);
  await page.screenshot({ path: target, fullPage: true });
  console.log(`  ✓ ${file}`);
}

(async () => {
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

    // PM queue desktop table — rows use onClick(window.location.href = ...).
    await page.goto(`${BASE}/invoices/queue`);
    await page.waitForLoadState("networkidle");
    // Wait for fade-in animation
    await page.waitForTimeout(3000);

    let invoiceId = null;
    try {
      const rows = page.locator("table tbody tr");
      const rowCount = await rows.count();
      console.log(`  queue table has ${rowCount} rows`);
      if (rowCount > 0) {
        // Click within the row but not on the checkbox; click on the vendor cell
        const target = rows.first().locator("td").nth(1); // second cell, skipping checkbox
        await Promise.all([
          page.waitForURL(/\/invoices\/[^/]+$/, { timeout: 15000 }),
          target.click({ force: true }),
        ]);
        const m = page.url().match(/\/invoices\/([^/?#]+)/);
        invoiceId = m?.[1] ?? null;
      }
    } catch (e) {
      console.log(`  queue click failed: ${e.message}`);
    }

    if (!invoiceId) {
      // Fallback to All Invoices
      await page.goto(`${BASE}/invoices`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2500);
      const rows = page.locator("table tbody tr");
      const rowCount = await rows.count();
      console.log(`  all-invoices table has ${rowCount} rows`);
      if (rowCount > 0) {
        try {
          const target = rows.first().locator("td").nth(1);
          await Promise.all([
            page.waitForURL(/\/invoices\/[^/]+$/, { timeout: 15000 }),
            target.click({ force: true }),
          ]);
          const m = page.url().match(/\/invoices\/([^/?#]+)/);
          invoiceId = m?.[1] ?? null;
        } catch (e) {
          console.log(`  all-invoices click failed: ${e.message}`);
        }
      }
    }

    if (!invoiceId) {
      failed.push("04/05 — could not click through to any invoice");
    } else {
      console.log(`  found invoiceId=${invoiceId}`);
      try {
        await shot(page, "04-invoice-detail.png");
      } catch (e) {
        failed.push(`04-invoice-detail.png — ${e.message}`);
      }

      try {
        await page.goto(`${BASE}/invoices/${invoiceId}`);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2500);
        const btn = page.locator('button:has-text("Partial Approve")').first();
        if (await btn.isVisible({ timeout: 5000 })) {
          await btn.click({ force: true });
          await page.waitForTimeout(1200);
          await shot(page, "05-partial-approve-modal.png");
        } else {
          failed.push("05-partial-approve-modal.png — Partial Approve button is not visible on this invoice (likely <2 line items or not in pm_review). Capture manually on a multi-line invoice in review status.");
        }
      } catch (e) {
        failed.push(`05-partial-approve-modal.png — ${e.message}`);
      }
    }

    if (failed.length) {
      console.log("\n--- FAILURES ---");
      for (const f of failed) console.log("  ✗", f);
      process.exitCode = 1;
    } else {
      console.log("\n04 and 05 captured.");
    }
  } finally {
    await browser.close();
  }
})();
