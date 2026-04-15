// Capture fix-04-pdf-preview.png after switching to react-pdf.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const OUT_DIR = process.env.OUT_DIR || "C:/Users/jaker/Screenshots";
const BASE = process.env.BASE || "http://localhost:3000";
const EMAIL = process.env.LOGIN_EMAIL || "jake@rossbuilt.com";
const PASSWORD = process.env.LOGIN_PASSWORD || "RossBuilt2026!";

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("[console error]", msg.text());
    if (msg.type() === "warn") console.log("[console warn]", msg.text());
  });
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));

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

    // Find the Integrity Floors invoice. The one I know exists is
    // 385888a5-cae7-452b-8245-7714cf86b732 (from the prior session).
    const invoiceId = process.env.INV_ID || "385888a5-cae7-452b-8245-7714cf86b732";
    await page.goto(`${BASE}/invoices/${invoiceId}`);
    await page.waitForLoadState("networkidle");

    // Give the PDF time to fetch + render (react-pdf loads the worker,
    // fetches the bytes, then renders each page to canvas).
    await page.waitForTimeout(8000);

    // Report what actually rendered so we can spot regressions.
    const info = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll(".react-pdf__Page__canvas"));
      return {
        canvasCount: canvases.length,
        canvasSizes: canvases.slice(0, 3).map((c) => ({ w: c.width, h: c.height })),
        hasDocument: !!document.querySelector(".react-pdf__Document"),
      };
    });
    console.log("render info:", JSON.stringify(info, null, 2));

    const target = path.join(OUT_DIR, "fix-04-pdf-preview.png");
    await page.screenshot({ path: target, fullPage: true });
    console.log(`  ✓ fix-04-pdf-preview.png`);
  } finally {
    await browser.close();
  }
})();
