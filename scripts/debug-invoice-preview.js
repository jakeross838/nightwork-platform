const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const EMAIL = "jake@rossbuilt.com";
const PASSWORD = "RossBuilt2026!";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVneGtmZm9keGNlZndwcW13cnVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDEyMDAsImV4cCI6MjA5MTY3NzIwMH0.XneB8jpkdiIN04vYGqzwHCUA-3znuICcu-1pp_qlB3Q";

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);

  // Use the Supabase REST endpoint directly with the session token
  // Grab the access token from cookies / local storage
  const token = await page.evaluate(() => {
    // Supabase stores auth in localStorage under a project-ref key
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("sb-")) continue;
      try {
        const val = JSON.parse(localStorage.getItem(key) || "{}");
        if (val.access_token) return val.access_token;
      } catch {}
    }
    return null;
  });
  console.log("access_token:", token ? token.slice(0, 40) + "..." : "null");

  if (!token) {
    // Use the cookie — the middleware sets cookie-based session
    const cookies = await context.cookies();
    console.log("cookies:", cookies.map((c) => c.name).join(", "));
    // Just try with anon key
  }

  const url = `https://egxkffodxcefwpqmwrur.supabase.co/rest/v1/invoices?select=id,original_file_url,original_file_type&limit=25`;
  const res = await fetch(url, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token || ANON_KEY}`,
    },
  });
  console.log("rest status:", res.status);
  const rows = await res.json();
  console.log("rows:", rows.length);

  const counts = { uploads: 0, other: 0, nullUrl: 0 };
  const samples = { uploads: [], other: [] };
  for (const r of rows) {
    if (!r.original_file_url) { counts.nullUrl++; continue; }
    if (r.original_file_url.startsWith("uploads/")) {
      counts.uploads++;
      if (samples.uploads.length < 3) samples.uploads.push(r);
    } else {
      counts.other++;
      if (samples.other.length < 5) samples.other.push(r);
    }
  }
  console.log("counts:", counts);
  console.log("sample uploads:", JSON.stringify(samples.uploads, null, 2));
  console.log("sample other:", JSON.stringify(samples.other, null, 2));

  // Test a couple of signed URLs via the Next.js API (which uses service role via user session)
  for (const r of rows.slice(0, 10)) {
    const apiRes = await page.request.get(`${BASE}/api/invoices/${r.id}`);
    if (apiRes.status() !== 200) continue;
    const j = await apiRes.json();
    if (!j.signed_file_url) {
      console.log(`id=${r.id} url=${r.original_file_url} → signed URL NOT generated`);
      continue;
    }
    const h = await page.request.get(j.signed_file_url);
    console.log(`id=${r.id} url=${r.original_file_url} → signed status ${h.status()}`);
  }

  await browser.close();
})();
