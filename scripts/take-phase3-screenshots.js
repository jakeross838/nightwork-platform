// Phase 3 screenshots: public landing, pricing, signup, onboarding wizard, login.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const OUT_DIR = process.env.OUT_DIR || "C:/Users/jaker/Ross-Built-Command/screenshots";
const BASE = process.env.BASE || "http://localhost:3003";

async function shot(page, file, opts = {}) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(600);
  const target = path.join(OUT_DIR, file);
  await page.screenshot({ path: target, fullPage: opts.fullPage ?? true, clip: opts.clip });
  console.log(`  ✓ ${file}`);
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);

  try {
    // 01 Landing hero (viewport-sized clip of top of page)
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(800);
    await shot(page, "phase3-01-landing-hero.png", {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1440, height: 720 },
    });

    // 02 Features section
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 720));
    await page.waitForTimeout(500);
    await shot(page, "phase3-02-landing-features.png", {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    });

    // 03 Pricing
    await page.goto(`${BASE}/pricing`);
    await shot(page, "phase3-03-pricing.png");

    // 04 Signup (signed out)
    await page.goto(`${BASE}/signup`);
    await shot(page, "phase3-04-signup.png");

    // 10 Login
    await page.goto(`${BASE}/login`);
    await shot(page, "phase3-10-login-branded.png");

    // Now create a fresh test user so we can capture the onboarding wizard
    const testEmail = `phase3+${Date.now()}@example.com`;
    const testPassword = "PhaseThree-2026!";
    const testCompany = `Test Builder ${new Date().toLocaleDateString()}`;
    await page.goto(`${BASE}/signup`);
    await page.fill('input[name="full_name"]', "Phase Three Tester");
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="company_name"]', testCompany);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3500);
    const urlAfter = page.url();
    console.log(`  → url after submit: ${urlAfter}`);
    if (!urlAfter.includes("/onboard")) {
      const errorText = await page.textContent("body");
      console.log("  Body snippet:", errorText?.slice(0, 400));
      // Force navigation if the server action redirected but playwright didn't follow.
      await page.goto(`${BASE}/onboard`);
      await page.waitForTimeout(800);
    }
    console.log(`  → Signed up ${testEmail}`);

    // 05 Onboard step 1 (Company)
    await page.waitForTimeout(800);
    await shot(page, "phase3-05-onboard-step1.png");

    // Click next → step 2
    await page.click('button:has-text("Next — Financial Defaults")');
    await page.waitForTimeout(900);
    await shot(page, "phase3-06-onboard-step2.png");

    await page.click('button:has-text("Next — Cost Codes")');
    await page.waitForTimeout(600);
    await shot(page, "phase3-07-onboard-step3.png");

    // Select the "Import CSV / Excel" card so we don't clone Ross Built's
    // codes into the throwaway org, but the screenshot still shows the
    // three choice cards.
    await page.click('button:has-text("Import CSV")').catch(() => {});
    await page.waitForTimeout(200);
    await page.click('button:has-text("Next — Invite Team")');
    await page.waitForTimeout(500);
    await shot(page, "phase3-08-onboard-step4.png");

    await page.click('button:has-text("Next — First Job")');
    await page.waitForTimeout(500);
    await shot(page, "phase3-09-onboard-step5.png");
  } catch (err) {
    console.error("Screenshot run failed:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
