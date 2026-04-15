// Capture the three "fix" screenshots after the broken-page fixes.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const OUT_DIR = process.env.OUT_DIR || "C:/Users/jaker/Screenshots";
const BASE = process.env.BASE || "http://localhost:3000";
const EMAIL = process.env.LOGIN_EMAIL || "jake@rossbuilt.com";
const PASSWORD = process.env.LOGIN_PASSWORD || "RossBuilt2026!";

async function shot(page, file) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  const target = path.join(OUT_DIR, file);
  await page.screenshot({ path: target, fullPage: true });
  console.log(`  ✓ ${file}`);
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
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

    // fix-01: Vendor detail — pick a vendor with invoices.
    try {
      await page.goto(`${BASE}/vendors`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
      // Click the first vendor whose Invoices cell > 0.
      const linkHref = await page.evaluate(() => {
        const rows = document.querySelectorAll("table tbody tr");
        for (const r of rows) {
          const cells = r.querySelectorAll("td");
          // Columns: checkbox | name(a) | default_cc | invoices | total_billed
          const invoiceCount = cells[3] ? parseInt(cells[3].textContent || "0", 10) : 0;
          if (invoiceCount > 0) {
            const a = cells[1]?.querySelector("a");
            if (a) return a.getAttribute("href");
          }
        }
        // Fallback: any vendor link
        const a = document.querySelector('a[href^="/vendors/"]');
        return a ? a.getAttribute("href") : null;
      });
      if (linkHref) {
        await page.goto(`${BASE}${linkHref}`);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2500);
        await shot(page, "fix-01-vendor-detail.png");
      } else {
        failed.push("fix-01 — no vendor with invoices found");
      }
    } catch (e) { failed.push(`fix-01 — ${e.message}`); }

    // fix-02: Drummond job invoices tab
    try {
      // Find Drummond job ID by navigating via the jobs list
      await page.goto(`${BASE}/jobs`);
      await page.waitForSelector("table tbody tr", { timeout: 15000 });
      await page.waitForTimeout(1000);
      const drummondRow = page.locator("table tbody tr", { hasText: /drummond/i }).first();
      await Promise.all([
        page.waitForURL(/\/jobs\/[^/]+$/, { timeout: 10000 }),
        drummondRow.click({ force: true }),
      ]);
      const jobMatch = page.url().match(/\/jobs\/([^/?#]+)/);
      const jobId = jobMatch?.[1];
      if (!jobId) { failed.push("fix-02 — could not resolve Drummond job id"); }
      else {
        await page.goto(`${BASE}/jobs/${jobId}/invoices`);
        await shot(page, "fix-02-job-invoices.png");
      }
    } catch (e) { failed.push(`fix-02 — ${e.message}`); }

    // fix-03: Invoice detail with PDF preview
    try {
      await page.goto(`${BASE}/invoices/queue`);
      await page.waitForSelector("table tbody tr", { timeout: 15000 });
      await page.waitForTimeout(1500);
      const firstCell = page.locator("table tbody tr").first().locator("td").nth(1);
      await Promise.all([
        page.waitForURL(/\/invoices\/[^/]+$/, { timeout: 15000 }),
        firstCell.click({ force: true }),
      ]);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2500);
      await shot(page, "fix-03-invoice-preview.png");
    } catch (e) { failed.push(`fix-03 — ${e.message}`); }

    if (failed.length) {
      console.log("\n--- FAILURES ---");
      for (const f of failed) console.log("  ✗", f);
      process.exitCode = 1;
    } else {
      console.log("\nAll 3 fix screenshots captured.");
    }
  } finally {
    await browser.close();
  }
})();
