// Brand-branding verification screenshots.
import { chromium } from 'playwright';
import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost:3020';
const OUT = path.resolve('screenshots');
const PUBLIC = path.resolve('public');
const EMAIL = 'jake@rossbuilt.com';
const PASSWORD = 'RossBuilt2026!';

const browser = await chromium.launch();

// ============================================================
// brand-03-login.png — login page with Nightwork logo
// ============================================================
console.log('→ Login page (unauthed)');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'brand-03-login.png'), fullPage: false });
  await ctx.close();
}

// ============================================================
// brand-02-nav-header.png — app nav showing Nightwork logo
// ============================================================
console.log('→ Dashboard nav header');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => null),
    page.click('button[type=submit]'),
  ]);
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // Just show the top of the page where the header lives
  await page.screenshot({
    path: path.join(OUT, 'brand-02-nav-header.png'),
    clip: { x: 0, y: 0, width: 1440, height: 180 },
  });
  await ctx.close();
}

// ============================================================
// brand-01-favicon-tab.png — render a mock browser tab w/ favicon
// ============================================================
console.log('→ Favicon tab mock');
{
  const favicon32 = readFileSync(path.join(PUBLIC, 'favicon-32x32.png')).toString('base64');
  const appleIcon = readFileSync(path.join(PUBLIC, 'apple-touch-icon.png')).toString('base64');
  const icon512 = readFileSync(path.join(PUBLIC, 'icon-512.png')).toString('base64');
  const faviconIco = readFileSync(path.join(PUBLIC, 'favicon.ico')).toString('base64');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body{margin:0;padding:32px;background:#1a1d22;color:#f7f3ea;font:13px/1.6 system-ui,sans-serif}
  h1{color:#a88c5f;font-family:'Georgia',serif;font-weight:400;margin:0 0 6px;font-size:22px}
  .sub{color:#a8a8a8;margin-bottom:24px;font-size:12px}

  /* Browser chrome mock */
  .browser{background:#2a2d32;border:1px solid #3a3d42;border-radius:8px 8px 0 0;padding:10px 12px 0;margin-bottom:24px}
  .tabs{display:flex;gap:4px;align-items:flex-end}
  .tab{background:#1a1d22;border:1px solid #3a3d42;border-bottom:none;border-radius:8px 8px 0 0;padding:8px 14px;display:flex;align-items:center;gap:8px;font-size:12px;min-width:220px;max-width:280px}
  .tab.active{background:#f7f3ea;color:#1a1d22}
  .tab img{width:16px;height:16px;flex-shrink:0}
  .tab-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  /* Assets grid */
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:8px}
  .asset{background:#2a2d32;border:1px solid #3a3d42;padding:14px;display:flex;flex-direction:column;align-items:center;gap:10px}
  .asset img{display:block}
  .label{font-size:11px;color:#a8a8a8;text-align:center;font-family:monospace}
  .size{font-size:10px;color:#7b8a9e;font-family:monospace}
  .note{color:#a88c5f;margin-top:22px;padding-top:14px;border-top:1px solid #3a3d42;font-size:12px;line-height:1.7}
</style></head><body>
<h1>Favicon — Nightwork tab mock + asset pack</h1>
<div class="sub">As browsers see Ross Command Center once the Metadata API declares the new icons.</div>

<div class="browser">
  <div class="tabs">
    <div class="tab active">
      <img src="data:image/png;base64,${favicon32}" />
      <span class="tab-title">Nightwork</span>
      <span style="color:#7b8a9e">×</span>
    </div>
    <div class="tab">
      <span style="opacity:0.5">New Tab</span>
      <span style="color:#7b8a9e">×</span>
    </div>
  </div>
</div>

<div class="grid">
  <div class="asset">
    <img src="data:image/x-icon;base64,${faviconIco}" width="32" height="32" />
    <div class="label">favicon.ico</div>
    <div class="size">multi-res</div>
  </div>
  <div class="asset">
    <img src="data:image/png;base64,${favicon32}" width="32" height="32" />
    <div class="label">favicon-32x32.png</div>
    <div class="size">32×32</div>
  </div>
  <div class="asset">
    <img src="data:image/png;base64,${appleIcon}" width="72" height="72" />
    <div class="label">apple-touch-icon.png</div>
    <div class="size">180×180</div>
  </div>
  <div class="asset">
    <img src="data:image/png;base64,${icon512}" width="96" height="96" />
    <div class="label">icon-512.png</div>
    <div class="size">PWA + OG</div>
  </div>
</div>

<div class="note">
All four icons declared via Next.js Metadata API in <code>src/app/layout.tsx</code>:<br>
<code style="color:#7fb069">icons: { icon: [...], apple: '/apple-touch-icon.png' }</code><br>
Title <code style="color:#7fb069">Nightwork</code> is served as the default — tenant org name stays in content areas only.
</div>
</body></html>`;

  const file = path.join(OUT, '_favicon-tab.html');
  writeFileSync(file, html);

  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  const page = await ctx.newPage();
  await page.goto('file:///' + file.replace(/\\/g, '/'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'brand-01-favicon-tab.png'), fullPage: true });
  await ctx.close();
}

// ============================================================
// brand-04-og-preview.png — render OG meta as a social-card mock
// ============================================================
console.log('→ OG preview mock');
{
  // Fetch the live meta from the dashboard HTML
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  const page = await ctx.newPage();
  // Go to public root so og meta is the default "Nightwork" set (not tenant)
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  const meta = await page.evaluate(() => {
    const pick = (sel) => document.querySelector(sel)?.content ?? null;
    return {
      title: document.title,
      ogTitle: pick('meta[property="og:title"]'),
      ogDescription: pick('meta[property="og:description"]'),
      ogUrl: pick('meta[property="og:url"]'),
      ogImage: pick('meta[property="og:image"]'),
      ogSiteName: pick('meta[property="og:site_name"]'),
      twCard: pick('meta[name="twitter:card"]'),
      twTitle: pick('meta[name="twitter:title"]'),
      favicon32: document.querySelector('link[rel="icon"][sizes="32x32"]')?.href ?? null,
      favIco: document.querySelector('link[rel="icon"][sizes="any"]')?.href ?? null,
      apple: document.querySelector('link[rel="apple-touch-icon"]')?.href ?? null,
    };
  });
  await ctx.close();

  const icon512 = readFileSync(path.join(PUBLIC, 'icon-512.png')).toString('base64');
  const favicon32 = readFileSync(path.join(PUBLIC, 'favicon-32x32.png')).toString('base64');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body{margin:0;padding:32px 40px;background:#1a1d22;color:#f7f3ea;font:13px/1.6 system-ui,sans-serif}
  h1{color:#a88c5f;font-family:'Georgia',serif;font-weight:400;margin:0 0 6px;font-size:22px}
  .sub{color:#a8a8a8;margin-bottom:24px;font-size:12px}

  /* Slack/Discord-style unfurl card */
  .card{background:#2a2d32;border:1px solid #3a3d42;border-left:4px solid #E89A2B;border-radius:6px;padding:14px 18px;max-width:620px;margin:20px 0;display:flex;gap:16px;align-items:center}
  .card-text{flex:1}
  .card-site{color:#a8a8a8;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px}
  .card-title{color:#f7f3ea;font-size:15px;font-weight:600;margin-bottom:4px}
  .card-desc{color:#c0c0c0;font-size:12px;line-height:1.5}
  .card-img{width:90px;height:90px;background:#0F1E36;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .card-img img{width:72px;height:72px;object-fit:contain}

  /* Raw meta tags */
  .raw{background:#0f1115;border:1px solid #3a3d42;padding:14px;font-family:'Courier New',monospace;font-size:11px;color:#c0c0c0;margin-top:18px;white-space:pre-wrap;line-height:1.6}
  .raw .key{color:#a88c5f}
  .raw .val{color:#7fb069}
  .note{color:#a88c5f;margin-top:22px;padding-top:14px;border-top:1px solid #3a3d42;font-size:12px;line-height:1.7}
</style></head><body>
<h1>Open Graph + favicon — social link preview</h1>
<div class="sub">How a Slack / LinkedIn / iMessage unfurl will render a link to the app.</div>

<div class="card">
  <div class="card-img">
    <img src="data:image/png;base64,${icon512}" />
  </div>
  <div class="card-text">
    <div class="card-site">nightwork.build</div>
    <div class="card-title">${meta.ogTitle ?? '(missing)'}</div>
    <div class="card-desc">${meta.ogDescription ?? '(missing)'}</div>
  </div>
</div>

<div class="raw">
<span class="key">&lt;title&gt;</span><span class="val">${meta.title}</span><span class="key">&lt;/title&gt;</span>
<span class="key">&lt;link rel="icon" sizes="any" href=</span><span class="val">"${(meta.favIco ?? '').split('/').slice(3).join('/').replace(/^/, '/')}"</span><span class="key">&gt;</span>
<span class="key">&lt;link rel="icon" sizes="32x32" type="image/png" href=</span><span class="val">"${(meta.favicon32 ?? '').split('/').slice(3).join('/').replace(/^/, '/')}"</span><span class="key">&gt;</span>
<span class="key">&lt;link rel="apple-touch-icon" href=</span><span class="val">"${(meta.apple ?? '').split('/').slice(3).join('/').replace(/^/, '/')}"</span><span class="key">&gt;</span>
<span class="key">&lt;meta property="og:site_name" content=</span><span class="val">"${meta.ogSiteName ?? 'Nightwork'}"</span><span class="key">&gt;</span>
<span class="key">&lt;meta property="og:title" content=</span><span class="val">"${meta.ogTitle ?? ''}"</span><span class="key">&gt;</span>
<span class="key">&lt;meta property="og:description" content=</span><span class="val">"${meta.ogDescription ?? ''}"</span><span class="key">&gt;</span>
<span class="key">&lt;meta property="og:image" content=</span><span class="val">"${meta.ogImage ?? ''}"</span><span class="key">&gt;</span>
<span class="key">&lt;meta property="og:url" content=</span><span class="val">"${meta.ogUrl ?? ''}"</span><span class="key">&gt;</span>
<span class="key">&lt;meta name="twitter:card" content=</span><span class="val">"${meta.twCard ?? ''}"</span><span class="key">&gt;</span>
<span class="key">&lt;meta name="twitter:title" content=</span><span class="val">"${meta.twTitle ?? ''}"</span><span class="key">&gt;</span>
</div>

<div class="note">
Meta extracted live from <code>http://localhost:3020/login</code> HTML via <code>document.querySelector('meta[property=...]')</code>. This is what
<a style="color:#7fb069">metatags.io</a>, Twitter Card Validator, or any OG preview tool will see when hitting <code>nightwork.build</code> in production.
Favicon shown inline: <img style="vertical-align:-4px;width:16px;height:16px;margin:0 4px" src="data:image/png;base64,${favicon32}" />.
</div>
</body></html>`;

  const file = path.join(OUT, '_og-preview.html');
  writeFileSync(file, html);

  const ctx2 = await browser.newContext({ viewport: { width: 1100, height: 820 } });
  const page2 = await ctx2.newPage();
  await page2.goto('file:///' + file.replace(/\\/g, '/'));
  await page2.waitForTimeout(400);
  await page2.screenshot({ path: path.join(OUT, 'brand-04-og-preview.png'), fullPage: true });
  await ctx2.close();
}

await browser.close();
console.log('✓ Done');
