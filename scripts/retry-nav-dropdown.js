// Recapture 02-nav-dropdown.png with the Invoices dropdown open.
const path = require("path");
const { chromium } = require("playwright");

const OUT_DIR = process.env.OUT_DIR || "C:/Users/jaker/Screenshots";
const BASE = process.env.BASE || "http://localhost:3000";
const EMAIL = process.env.LOGIN_EMAIL || "jake@rossbuilt.com";
const PASSWORD = process.env.LOGIN_PASSWORD || "RossBuilt2026!";

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  try {
    await page.goto(`${BASE}/login`);
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await Promise.all([
      page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 15000 }),
      page.click('button[type="submit"]'),
    ]);

    await page.goto(`${BASE}/`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Hover the button — onMouseEnter opens the menu and the mouse stays
    // over the button (not the dropdown) so the leave-to-close doesn't fire.
    const invoicesBtn = page.locator('nav button:has-text("Invoices")').first();
    await invoicesBtn.hover();
    await page.waitForTimeout(400);

    // Verify the dropdown is visible
    const dd = page.locator('text="All Invoices"').first();
    const vis = await dd.isVisible();
    console.log(`  dropdown visible: ${vis}`);
    if (!vis) {
      // Force by JS
      await page.evaluate(() => {
        document.querySelectorAll("nav button").forEach((b) => {
          if (/invoices/i.test(b.textContent || "")) b.click();
        });
      });
      await page.waitForTimeout(500);
    }

    const target = path.join(OUT_DIR, "02-nav-dropdown.png");
    await page.screenshot({ path: target, fullPage: true });
    console.log(`  ✓ 02-nav-dropdown.png recaptured`);
  } finally {
    await browser.close();
  }
})();
