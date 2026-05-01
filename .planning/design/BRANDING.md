# BRANDING.md — Nightwork wordmark + icon spec (v0)

**Status:** v0 — locked for 1.5a ship per nwrp19 directive (2026-04-30).
**Scope:** the Nightwork product wordmark + icon. Tenant-customizable branding (`logo_url` per-org, `--brand-accent`) is OUT of scope here — see SYSTEM.md §2 for that contract and §9 below for the distinction.
**Owners:** Jake (brand decisions). Implementation owners change per phase.
**Revisited:** 6–12 months from 1.5a ship, by a real brand designer when revenue justifies the investment.

## Table of contents

1. Wordmark specification
2. Icon specification
3. Sizing system
4. Color treatments
5. Spacing & clear-space rules
6. Forbidden treatments
7. File map
8. v0 status + open caveats
9. Tenant-logo distinction

---

## 1. Wordmark specification

**Visual:**
- Text: lowercase **"nightwork"** — single word, no caps, no spaces
- Font: **Space Grotesk Medium (500)** — the locked display font from SYSTEM.md §4a
- Letter-spacing: `-0.02em`
- Underscore line: 2px stroke, full width of wordmark, gradient opacity **100% (left) → 0% (right)**
- Underscore color: Stone Blue (`--nw-stone-blue` — works for both Set A and Set B at CP2 per SYSTEM.md §1b)
- Spacing: 6px between wordmark baseline and underscore top
- ViewBox tuned to `0 0 220 56` so consumer `size` (in px width) maps to height via `56/220` ratio (~28px tall at 110px wide)

**Wordmark color (light bg):** `--text-primary` (resolves to `--nw-slate-tile`)
**Wordmark color (dark bg):** `--nw-white-sand` via `color="inverse"` prop, OR `currentColor` so a single SVG inherits text color from the page
**Underscore color (always):** `--nw-stone-blue` gradient (light + dark)

**Why a single SVG works:** the React component sets `color` on the wrapping `<svg>` based on the `color` prop, and the inner `<text>` uses `fill="currentColor"`. The CSS variable token resolves at render time, so the same component renders correctly on light AND dark backgrounds.

**Reference implementation:**
- `src/components/branding/Wordmark.tsx` — `<NwWordmark size={110} color="auto" />`
- `public/brand/nightwork-wordmark.svg` — static file for non-React contexts

---

## 2. Icon specification

**Visual:**
- Square format
- Lowercase **"n"** in Space Grotesk Medium (500)
- Stone Blue (`--nw-stone-blue`) background fill
- White Sand (`--nw-white-sand`) "n" character
- Letter-spacing matches the wordmark (`-0.88` at 44px font-size = `-0.02em`)
- ViewBox `0 0 64 64`

**Sizes needed (raster):**
- 16×16 — favicon legacy (covered by SVG; v1 will export PNG)
- 32×32 — favicon (covered by SVG)
- 192×192 — Android home screen (covered by SVG; v1 will export PNG)
- 512×512 — PWA splash (already at `/public/icon-512.png` — pre-existing; v1 will refresh to match this spec)

**Usage contexts:**
- Favicon (browser tab) — auto-routed via `src/app/icon.svg` (Next.js 14 file-based)
- Mobile <360px collapsed nav — `<NwIcon size={32} />` React component
- Social profile / app icon — covered by manifest `icons[]` array
- Future: Apple Touch Icon (180×180 PNG) — deferred to v1 per §3 below

**Reference implementation:**
- `src/components/branding/Icon.tsx` — `<NwIcon size={32} />`
- `public/brand/nightwork-icon.svg` — static file
- `src/app/icon.svg` — Next.js auto-handled favicon (matches static brand file)

---

## 3. Sizing system

| Context | Required width | Component / asset |
|---|---|---|
| Login screen | 200px | `<NwWordmark size={200} />` |
| Signup screen | 200px | `<NwWordmark size={200} />` |
| Top nav (authenticated, ≥360px viewport) | 110px | `<NwWordmark size={110} color="inverse" />` |
| Top nav (<360px viewport) | 32px (icon) | `<NwIcon size={32} />` |
| Email templates | 140px | `/public/brand/nightwork-wordmark.svg` (static) |
| PDF exports (G702/G703 header, lien releases) | 140px | `/public/brand/nightwork-wordmark.svg` (static) |
| Marketing surfaces (landing, pricing) | 180–240px | Either component or static SVG |
| Minimum render width | 80px | Below 80px: switch to icon |

**v1 follow-ups (deferred per nwrp19):**
- `src/app/apple-icon.png` — 180×180 PNG version of the icon for iOS Safari home-screen pinning. Not generated in v0 because `sharp` / `png-to-ico` aren't installed and modern iOS Safari falls back to `<link rel="icon">` SVG. v1 brand designer ships this with PNG-export pipeline.
- 16/32/192 PNG raster exports — same rationale; SVG icon handles all modern browsers; legacy IE/Edge-Legacy not supported by Nightwork.
- `favicon.ico` (multi-size legacy format) — same rationale; SVG covers modern browsers.

---

## 4. Color treatments

**Light background:**
- Wordmark text: `--text-primary` (`--nw-slate-tile` resolves to `#3B5864`)
- Underscore: `--nw-stone-blue` gradient (100% → 0% opacity left to right)
- Component invocation: `<NwWordmark color="auto" />`

**Dark background (slate deep):**
- Wordmark text: `--nw-white-sand`
- Underscore: `--nw-stone-blue` gradient (same color, reads correctly on both bg)
- Component invocation: `<NwWordmark color="inverse" />`
- Used in: nav-bar (dark slate background)

**Single-color treatment (brand mode):**
- Wordmark text: `--nw-stone-blue`
- Underscore: `--nw-stone-blue` (no gradient — single solid stroke)
- Component invocation: `<NwWordmark color="brand" />`
- Used in: tinted/colored marketing surfaces, future product collateral

**Print / PDF (deferred to v1):**
- Wordmark text: black 100%
- Underscore: black 50% opacity
- v1 will add a `color="print"` mode + an explicit print-mode static SVG. Until then, PDF exports use the static `nightwork-wordmark.svg` which renders Stone Blue gradient on the page (acceptable for builder-distributed pay app PDFs).

---

## 5. Spacing & clear-space rules

**Minimum padding around wordmark = 0.5× its rendered height.**

E.g., a 110px wordmark renders ~28px tall, so the minimum clear space on each side is 14px. The wordmark must not abut other content closer than this.

**Touch target (when wordmark is a click target — links to home):**
- Wrap the wordmark in a `<Link>` or `<button>` with at least 44×44px hit area (per SYSTEM.md §11). The wordmark itself can be smaller; the wrapping element provides the touch zone.

**Vertical alignment in nav bars:**
- Wordmark baseline aligns to nav-bar centerline (already handled by `flex items-center` in nav-bar.tsx).

---

## 6. Forbidden treatments

- **No rotation.** The wordmark renders horizontally only.
- **No skew or shearing.** No CSS `transform: skew(...)` on the wordmark.
- **No recoloring outside the 3 documented modes.** `auto` / `inverse` / `brand` are the three. No tenant-defined color overrides apply to the wordmark (tenant `--brand-accent` styles internal CTAs, not the Nightwork mark — see §9).
- **No effects or shadows.** No `filter: drop-shadow(...)`, no `box-shadow`, no glows. The 2px gradient underscore is the only decorative element.
- **No stretching.** Width-only sizing via `size` prop maintains aspect ratio. Never override `height` independently.
- **No enclosing in shapes.** No circle, square, badge, or pill container around the wordmark. The icon variant is a separate primitive (`<NwIcon>`).
- **No hex literals overriding wordmark color.** Use the `color` prop or token-driven CSS vars. The post-edit hook (per §8 Task 8) rejects `style={{ color: "#..." }}` or `text-[#...]` on `<NwWordmark>` instances.
- **No size below 80px for wordmark.** Below 80px, switch to `<NwIcon>`. (At 80px width the underscore detail is ~2px tall; below that it's lost.)
- **No alt-font fallback in React surfaces.** The component pulls `var(--font-display)` which next/font binds to Space Grotesk in `src/app/layout.tsx`. If the font fails to load, system-ui fallback is acceptable transient state but should not be intentionally engineered for.

---

## 7. File map

| File | Purpose | When to use |
|---|---|---|
| `src/components/branding/Wordmark.tsx` | Canonical React component (`<NwWordmark>`) | All React surfaces — login, signup, nav, design-system, future authenticated screens |
| `src/components/branding/Icon.tsx` | Canonical icon React component (`<NwIcon>`) | <360px nav collapse, future icon-only surfaces in React |
| `public/brand/nightwork-wordmark.svg` | Static wordmark SVG | Non-React contexts — email templates, PDF generators, marketing, anywhere `<img>` or `<link>` references the brand |
| `public/brand/nightwork-icon.svg` | Static icon SVG | Non-React icon contexts paired with the wordmark file above |
| `src/app/icon.svg` | Next.js 14 file-based favicon | Auto-routed by Next at `/icon.svg`; auto-injected into `<head>` as `<link rel="icon">` |
| `public/icon-512.png` | 512×512 raster icon | OpenGraph share images, PWA manifest 512px slot, Twitter card |
| `src/app/manifest.ts` | Programmatic PWA Web App Manifest | Auto-routed by Next at `/manifest.webmanifest`; auto-injected as `<link rel="manifest">` |
| `src/lib/branding/constants.ts` | Hex literals carve-out for non-CSS contexts | Manifest theme_color, future OG image generators, future PDF generators — anywhere `var(--*)` cannot be resolved |

---

## 8. v0 status + open caveats

**This is v0.** Good enough for 1.5a ship. Locked per nwrp19 directive on 2026-04-30. v1 by a real brand designer in 6–12 months when revenue justifies the investment.

**Open caveats (acceptable for v0; v1 follow-ups):**

1. **SVG file font fallback.** The static SVG files in `/public/brand/` use `font-family="'Space Grotesk', system-ui, sans-serif"` declaratively. Browsers rendering the SVG as `<img src="...">` are sandboxed and cannot access page-loaded fonts, so they fall back to `system-ui` (the OS sans-serif). Email clients and PDF generators behave the same way. This means the static-file rendering is NOT pixel-perfect Space Grotesk. It IS still recognizable as the wordmark.
   - **v1 fix:** brand designer converts the wordmark text to outlined paths (`<path>` glyph data instead of `<text>`). Then the SVG renders identically in any context. v0 holds because email + PDF surfaces aren't shipping in 1.5a.

2. **Apple Touch Icon (apple-icon.png) not present.** Modern iOS Safari falls back to `<link rel="icon" type="image/svg+xml">` for home-screen pinning. The icon will render but won't have the iOS-rounded-square Apple-specific styling.
   - **v1 fix:** add `src/app/apple-icon.png` (180×180 PNG) generated from the icon SVG via `sharp` or equivalent. Requires installing `sharp` (Next.js dependency-managed) or a build-time PNG export step. Deferred because no current user reported iOS pinning issues.

3. **Print-mode color treatment is implicit.** The "Print/PDF — wordmark black 100%, line black 50%" treatment from the spec is documented but not implemented as a `color="print"` mode. PDF exports today render the static SVG with Stone Blue gradient (acceptable for builder-distributed pay apps).
   - **v1 fix:** add `color="print"` to NwWordmark; render via the static SVG file with `currentColor` and let `@media print { color: black; }` handle the rest.

4. **Favicon multi-size raster (favicon.ico) not generated.** Modern browsers (Chrome, Safari, Firefox, Edge — including legacy Edge after 2020) handle `<link rel="icon" type="image/svg+xml">` natively. IE and pre-2020 Edge are NOT supported by Nightwork.
   - **v1 fix:** export `favicon.ico` from the icon SVG as a multi-size container (16/32/48). Adds 5 minutes once `sharp` is installed.

5. **CP2 palette pick interaction.** The wordmark's underscore uses `--nw-stone-blue` token. If Jake picks Set A at `/design-system/palette` (vs. current Set B), the token VALUE shifts but the wordmark continues to render correctly because it consumes the token. No code change to NwWordmark needed at CP2.

**Cross-references:** nwrp19 directive (2026-04-30 — Stage 1.5a CP2 walkthrough revealed 4 divergent logo paths). SYSTEM.md §1 (token system). SYSTEM.md §4a (font system).

---

## 9. Tenant-logo distinction (Nightwork mark vs customer org logo)

There are TWO distinct logo systems in Nightwork. They serve different purposes and follow different rules.

### 9a. Nightwork product wordmark (this document)

- **Subject:** the Nightwork brand identity itself
- **Source of truth:** this document
- **Color tokens:** locked Nightwork (`--text-primary`, `--nw-stone-blue`, `--nw-white-sand`)
- **Customizable by tenants:** **NO** — locked per nwrp19
- **Where it renders:** every Nightwork surface — login, signup, nav-bar wordmark slot (left of the optional tenant logo), design-system playground header, marketing pages, email branding, PDF brand mark

### 9b. Tenant org logo (customer-uploaded brand asset)

- **Subject:** the customer org's company logo (e.g., Ross Built's house-shaped logo)
- **Source of truth:** SYSTEM.md §2 brand customization tokens contract; PROPAGATION-RULES.md §6 customization workflow
- **Storage:** `org_settings.logo_url` per-org, file uploaded via `OnboardWizard` (`src/app/onboard/OnboardWizard.tsx`) into Supabase Storage at `branding/{org_id}/logo.{ext}`
- **Customizable by tenants:** **YES** — owner/admin role, signed URL scoped to org, sanitized SVG via `isomorphic-dompurify`, max 200KB, allow-list `image/png` / `image/svg+xml` / `image/jpeg` per A11.5
- **Where it renders:** nav-bar (right of the Nightwork wordmark, separator pipe between), org settings page, future PDF AIA G702 contractor-logo header (per A12.3), public footer / marketing site (per A12.3)
- **Customization contract:** A11.1–A11.7 in SYSTEM.md §2; subject to brand-customization-add workflow in PROPAGATION-RULES.md §6 if a future v2 expands tenant-customizable tokens

### 9c. The two coexist in the nav bar

The current nav-bar layout (post-nwrp19):

```
[Nightwork wordmark]   [|]   [Tenant org logo]   ─────  Dashboard  Financial  …
       110px          1px      ≤18px tall            (rest of nav)
   (always visible           (only if logoUrl)
    above 360px;
    icon below)
```

The Nightwork wordmark is non-customizable. The tenant org logo is per-org and falls through `useOrgBranding()`. Below 360px viewport, the Nightwork wordmark collapses to the icon; the tenant logo also hides (the existing `hidden md:block` modifier handles that).

### 9d. Why the distinction matters

- **Tenant invariance:** the Nightwork mark must read consistently across all customer orgs. A customer's brand never overrides Nightwork's brand identity in the product chrome. (Reverse — customer brand would dominate — would conflate the SaaS provider with the customer's company identity. Reference: Slack's logo always says "Slack" regardless of which org is logged in.)
- **Audit trail:** tenant logo changes are audit-logged via `activity_log.action='branding.logo_updated'`. Nightwork wordmark changes are not (they're code changes, tracked via git).
- **Validation paths:** tenant logos are sanitized server-side (SVG via `isomorphic-dompurify`); the Nightwork wordmark is shipped as code we control.
- **Cache headers:** tenant logos require `Cache-Control: private, no-store` + `Vary: Cookie` per A11.3 to prevent cross-tenant CDN pollution. The Nightwork wordmark is publicly cacheable (no tenant data).

---

## Cross-references

- **Source code:**
  - `src/components/branding/Wordmark.tsx` — NwWordmark React component
  - `src/components/branding/Icon.tsx` — NwIcon React component
  - `public/brand/nightwork-wordmark.svg` — static wordmark file
  - `public/brand/nightwork-icon.svg` — static icon file
  - `src/app/icon.svg` — Next.js 14 file-based favicon
  - `src/app/manifest.ts` — programmatic PWA manifest
  - `src/lib/branding/constants.ts` — hex carve-out for non-CSS contexts
- **Documents:**
  - `.planning/design/SYSTEM.md` §1 (tokens), §2 (brand customization), §4 (typography)
  - `.planning/design/PROPAGATION-RULES.md` §6 (brand-customization workflow), §7 (forbidden-list update)
  - `CLAUDE.md` — UI rules (Stone blue palette + Slate type system + logo top-right)
- **Hooks:**
  - `.claude/hooks/nightwork-post-edit.sh` — wordmark integrity rules (size + color enforcement per Task 8 of nwrp19)
- **Phase artifacts:**
  - `.planning/phases/stage-1.5a-design-system-documents/artifacts/T35.5-hook-positive-tests.md` — hook positive tests including wordmark integrity rules
- **Skills:**
  - `.claude/skills/nightwork-design/` — design-system skill (will reference this document for branding-related questions)
- **Directive:** nwrp19 (Stage 1.5a CP2 walkthrough resolution, 2026-04-30)
