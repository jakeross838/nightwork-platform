// Phase 2 screenshots — captures the white-label + settings deliverables.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const OUT_DIR = process.env.OUT_DIR || "C:/Users/jaker/Ross-Built-Command/screenshots";
const BASE = process.env.BASE || "http://localhost:3001";
const EMAIL = process.env.LOGIN_EMAIL || "jake@rossbuilt.com";
const PASSWORD = process.env.LOGIN_PASSWORD || "RossBuilt2026!";

async function shot(page, file) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(600);
  const target = path.join(OUT_DIR, file);
  await page.screenshot({ path: target, fullPage: true });
  console.log(`  ✓ ${file}`);
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

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

    await page.goto(`${BASE}/`);
    await shot(page, "phase2-01-dashboard-branded.png");

    await page.goto(`${BASE}/settings/company`);
    await shot(page, "phase2-02-settings-company.png");

    await page.goto(`${BASE}/settings/team`);
    await shot(page, "phase2-03-settings-team.png");

    await page.goto(`${BASE}/settings/financial`);
    await shot(page, "phase2-04-settings-financial.png");

    await page.goto(`${BASE}/settings/cost-codes`);
    await shot(page, "phase2-05-settings-costcodes.png");

    // Nav-with-settings is just the top strip of any authenticated page.
    // Use the dashboard and crop after-the-fact — full-page is fine.
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(OUT_DIR, "phase2-06-nav-with-settings.png"),
      clip: { x: 0, y: 0, width: 1440, height: 100 },
    });
    console.log("  ✓ phase2-06-nav-with-settings.png");
  } catch (err) {
    console.error("Screenshot run failed:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
