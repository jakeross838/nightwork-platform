# SYSTEM.md — Nightwork Design System (tokens, type, motion, density, accessibility)

**Status:** v1 DRAFT (Stage 1.5a, T12) — produced 2026-04-29.
**Phase:** stage-1.5a-design-system-documents
**Scope:** Single source of truth for design tokens, typography, motion, layout grid, density modes, accessibility contracts, and tenant brand-customization. Subordinate skills (`nightwork-design`, `nightwork-design-tokens`, `nightwork-ui-template`, `nightwork-design-system-reviewer`, `nightwork-ui-reviewer`) reference SYSTEM.md as authoritative.
**SPEC anchors:** A2.1, A2.2, A3, A3.1, A4, A5, A6, A7, A8, A9, A10, A11, A11.1-A11.7, A19.1, C1, C9.

**Document length target:** 600-900 lines structured into 14 sections + cross-references.

---

## Table of contents

1. Color tokens — Slate palette + candidate Set A vs Set B comparison
2. Brand customization tokens — A11 contract (`--brand-accent`, `--brand-logo`)
3. Shadcn token remap — Slate-aware aliasing
4. Typography — Slate type system locked
5. Spacing — Tailwind default scale only
6. Border-radius — square-by-default, dot exception
7. Shadows — minimal, hover-lift only
8. Motion — CSS-only, no bouncy
9. Layout grid + breakpoints
10. Density modes — compact + comfortable + print
11. Touch targets — 44px / 56px high-stakes
12. Accessibility — WCAG 2.2 AA mandatory
13. Forbidden thresholds — quantified violation criteria
14. Skill anchor — bidirectional cross-reference

---

## 1. Color tokens

The Nightwork palette is **Slate** — a coastal-construction-flavored stone-blue + slate-deep + warm-gray system. Tokens are declared in `src/app/colors_and_type.css` (the single canonical source).

### 1a. Raw brand tokens (theme-invariant)

These are the literal hex sources. They flow into the semantic tokens below via `var(--nw-*)`. Values are constant across light / dark — only the *semantic* tokens flip.

| CSS variable        | Hex value | Tailwind utility   | Role                                                  |
|---------------------|-----------|--------------------|-------------------------------------------------------|
| `--nw-slate-tile`   | `#3B5864` | `nw-slate-tile`    | Mid-slate; primary text in light                      |
| `--nw-slate-deep`   | `#1A2830` | `nw-slate-deep`    | Deep-slate; page bg in dark                            |
| `--nw-slate-deeper` | `#132028` | `nw-slate-deeper`  | Deepest-slate; card bg in dark                         |
| `--nw-stone-blue`   | `#5B8699` | `nw-stone-blue`    | Stone-blue; brand accent / focus ring                  |
| `--nw-gulf-blue`    | `#436A7A` | `nw-gulf-blue`     | Gulf-blue; link hover hue (bumped from `#4E7A8C` in T12 for WCAG AA-normal compliance — see §1i text tokens)  |
| `--nw-oceanside`    | `#CBD8DB` | `nw-oceanside`     | Oceanside light; accent in dark mode                   |
| `--nw-white-sand`   | `#F7F5EC` | `nw-white-sand`    | White-sand; page bg in light                           |
| `--nw-warn`         | `#C98A3B` | `nw-warn`          | Warning amber                                          |
| `--nw-success`      | `#4A8A6F` | `nw-success`       | Success green                                          |
| `--nw-danger`       | `#B0554E` | `nw-danger`        | Danger red                                             |

### 1b. Candidate palette comparison — Set A vs Set B (Q1=C decision at CP2)

Per EXPANDED-SCOPE Q1=C, two palette sets are presented at CP2 for visual pick.

**Set B (existing, current implementation, what `colors_and_type.css` resolves to today):**
- Stone-blue: `#5B8699`
- Slate-deep: `#1A2830`
- Slate-tile: `#3B5864`
- White-sand: `#F7F5EC`

**Set A (Jake's brief candidate, NOT current):**
- Stone-blue accent: `#6B8EA3` (lighter, slightly cooler than Set B)
- Dark slate: `#2D3E4A` (mid-slate; lighter than Set B's `#1A2830`)
- Warm gray: `#8A8A8A` (NEW token — Set A only; placeholder for chrome/borders)

**Wave 1 contrast finding (per `.planning/design/CONTRAST-MATRIX.md`):**

> Set B is **measurably more accessible than Set A on dark surfaces**. Dark-mode AA-normal pass count drops from Set B's 8 to Set A's 5. Set A's slightly lighter `#2D3E4A` slate-deep produces a `#F7F5EC` text-primary contrast ratio of `10.12:1` vs Set B's `13.83:1` — both exceed WCAG AAA, but Set A loses headroom.

The matrix flags that DARK + Set A is the single weakest matrix; if Set A is chosen at CP2, SYSTEM.md must add a rule "semantic colors render in `Badge` only on dark + Set A; raw text labels MUST switch to `--text-primary` color with a colored icon prefix."

**If Set B is picked at CP2, this special-case rule is unnecessary and gets removed from §10 (Component variants) and §13 (Forbidden — semantic patterns).** Per nwrp14 directive 2026-04-30: Jake approved this special-case rule as the right mitigation IF Set A is chosen; it does not apply to Set B because DARK + Set B clears AA-normal on all four semantic-color × bg-page pairings.

**Set B is the existing implementation; Set A requires `colors_and_type.css` update + matrix re-verification if picked.** Both sets are rendered side-by-side at `/design-system/palette` for the CP2 visual pick.

### 1c. Type scale tokens — see Section 4

Font-size CSS variables (`--fs-*`) live with the type system rather than the color system. Section 4 enumerates them.

### 1d. Tracking tokens — see Section 4

Letter-spacing (`--tracking-*`) lives with type. Section 4.

### 1e. Spacing tokens — see Section 5

`--space-*` tokens are cosmetic mirrors of the Tailwind spacing scale. Section 5.

### 1f. Radii tokens

| CSS variable      | Value    | Notes                                                                  |
|-------------------|----------|------------------------------------------------------------------------|
| `--radius-none`   | `0`      | Default for all rectangular elements (per A2.1 Forbidden non-negotiable) |
| `--radius-dot`    | `999px`  | Avatars + status dots only — explicit exception                          |

Tailwind config extends `borderRadius: { none: "0" }` for ergonomic `rounded-none` utility.

### 1g. Shadow tokens

| CSS variable      | Value                                          | Used in                                  |
|-------------------|------------------------------------------------|------------------------------------------|
| `--shadow-hover`  | `0 4px 6px -1px rgba(26, 40, 48, 0.08)`         | Hover lift on interactive cards          |
| `--shadow-panel`  | `0 8px 24px -12px rgba(26, 40, 48, 0.18)`       | Right-rail panel elevation               |

No drop shadows on resting elements. No dark glows (Forbidden — see Section 13).

### 1h. Status dot tokens

| CSS variable        | Value                            | Used in              |
|---------------------|----------------------------------|----------------------|
| `--dot-active`      | `var(--nw-success)`              | Active job status    |
| `--dot-warranty`    | `var(--nw-warn)`                 | Warranty status      |
| `--dot-complete`    | `rgba(59, 88, 100, 0.55)`        | Completed status     |

### 1i. Semantic tokens — THEME-DEPENDENT

Light vs Dark — flip per `data-theme="light"` vs `data-theme="dark"`. The selector list is `:root, :root[data-theme="light"], [data-theme="light"]` for light, and `:root[data-theme="dark"], [data-theme="dark"]` for dark.

#### Background tokens (`--bg-*`)

| Variable               | Light value                                          | Dark value                                           | Tailwind utility shape                |
|------------------------|------------------------------------------------------|------------------------------------------------------|---------------------------------------|
| `--bg-page`            | `var(--nw-white-sand)` = `#F7F5EC`                   | `var(--nw-slate-deep)` = `#1A2830`                   | `bg-[var(--bg-page)]`                 |
| `--bg-card`            | `#FFFFFF`                                            | `var(--nw-slate-deeper)` = `#132028`                 | `bg-[var(--bg-card)]`                 |
| `--bg-subtle`          | `rgba(91, 134, 153, 0.06)` (stone-blue 6%)           | `rgba(247, 245, 236, 0.04)` (sand 4%)                | `bg-[var(--bg-subtle)]`               |
| `--bg-muted`           | `rgba(59, 88, 100, 0.08)` (tile 8%)                  | `rgba(247, 245, 236, 0.08)` (sand 8%)                | `bg-[var(--bg-muted)]`                |
| `--bg-inverse`         | `var(--nw-slate-deep)` = `#1A2830`                   | `var(--nw-white-sand)` = `#F7F5EC`                   | `bg-[var(--bg-inverse)]`              |
| `--bg-inverse-hover`   | `var(--nw-slate-deeper)` = `#132028`                 | `rgba(247, 245, 236, 0.92)`                          | `bg-[var(--bg-inverse-hover)]`        |

#### Text tokens (`--text-*`)

| Variable             | Light value                                          | Dark value                                            | Tailwind utility shape                    |
|----------------------|------------------------------------------------------|-------------------------------------------------------|-------------------------------------------|
| `--text-primary`     | `var(--nw-slate-tile)` = `#3B5864`                   | `var(--nw-white-sand)` = `#F7F5EC`                    | `text-[color:var(--text-primary)]`        |
| `--text-secondary`   | `rgba(59, 88, 100, 0.70)`                            | `rgba(247, 245, 236, 0.72)`                           | `text-[color:var(--text-secondary)]`      |
| `--text-tertiary`    | `rgba(59, 88, 100, 0.55)`                            | `rgba(247, 245, 236, 0.55)`                           | `text-[color:var(--text-tertiary)]`       |
| `--text-muted`       | `rgba(59, 88, 100, 0.40)`                            | `rgba(247, 245, 236, 0.40)`                           | `text-[color:var(--text-muted)]`          |
| `--text-inverse`     | `var(--nw-white-sand)` = `#F7F5EC`                   | `var(--nw-slate-tile)` = `#3B5864`                    | `text-[color:var(--text-inverse)]`        |
| `--text-accent`      | `var(--nw-gulf-blue)` = `#436A7A`                    | `var(--nw-oceanside)` = `#CBD8DB`                     | `text-[color:var(--text-accent)]`         |

**Applied fix (T12, 2026-04-30):** `--text-accent` light variant bumped from `#4E7A8C` → `#436A7A` to clear WCAG 2.2 AA-normal on `bg-page`. Measured contrast ratios for the new value (verified by the contrast script at T12 patch time):

| Surface                  | Old (`#4E7A8C`) | New (`#436A7A`) | AA-normal (4.5:1) |
|--------------------------|-----------------|-----------------|-------------------|
| `bg-page` light (`#F7F5EC`)   | 4.29:1          | **5.37:1**      | PASS              |
| `bg-card` light (`#FFFFFF`)   | 4.68:1          | **5.86:1**      | PASS              |
| `bg-subtle` light (`#EEEEE7`) | 4.02:1          | **5.03:1**      | PASS              |
| `bg-muted` light (`#E8E8E1`)  | 3.80:1          | **4.76:1**      | PASS              |

The dark variant `--text-accent` = `var(--nw-oceanside)` = `#CBD8DB` is unchanged (already passes at 10.35:1 on dark `bg-page`). The hover-state side-effects (`hover:bg-nw-gulf-blue` button backgrounds, `text-nw-gulf-blue` link hovers) all see strict ratio improvements — see CONTRAST-MATRIX.md §3, §5 for the full re-verification.

#### Border tokens (`--border-*`)

| Variable           | Light value                          | Dark value                          | Tailwind utility shape         |
|--------------------|--------------------------------------|-------------------------------------|--------------------------------|
| `--border-default` | `rgba(59, 88, 100, 0.15)` (15%)      | `rgba(247, 245, 236, 0.08)` (8%)    | `border-[var(--border-default)]` |
| `--border-subtle`  | `rgba(59, 88, 100, 0.08)` (8%)       | `rgba(247, 245, 236, 0.04)` (4%)    | `border-[var(--border-subtle)]`  |
| `--border-strong`  | `rgba(59, 88, 100, 0.30)` (30%)      | `rgba(247, 245, 236, 0.18)` (18%)   | `border-[var(--border-strong)]`  |
| `--border-brand`   | `var(--nw-stone-blue)` = `#5B8699`   | `var(--nw-stone-blue)` = `#5B8699`  | `border-[var(--border-brand)]`   |

#### Semantic colors (status / financial signal — constant across themes)

| Variable          | Value                            | Role                                                     |
|-------------------|----------------------------------|----------------------------------------------------------|
| `--color-success` | `var(--nw-success)` = `#4A8A6F`  | Successful workflow transition (paid, approved)          |
| `--color-warning` | `var(--nw-warn)` = `#C98A3B`     | Held / pending / over-budget warning                     |
| `--color-error`   | `var(--nw-danger)` = `#B0554E`   | Denied / void / failed                                   |
| `--color-money`   | `var(--nw-slate-tile)` (`#3B5864`) light / `var(--nw-white-sand)` (`#F7F5EC`) dark | Money values (amounts in cents, formatted as dollars in UI) |

#### Legacy bridge tokens (Phase E carve-out — kept for ongoing migration)

| Variable        | Light value         | Dark value                       | Notes |
|-----------------|---------------------|----------------------------------|-------|
| `--color-white` | `#FFFFFF`           | `var(--nw-slate-deeper)` = `#132028` | Bridges old `bg-brand-card` consumers; in dark mode this is *not* white (adapts to card surface) |
| `--text-body`   | `var(--text-primary)` | `var(--text-primary)`            | Bridges `text-cream-muted` consumers; same value as primary |

### 1j. Token totals

**69 CSS variables total** across 13 groups (see `audit-notes/T01-css-variables.md` for the canonical enumeration).

---

## 2. Brand customization tokens — A11 contract

Per A11 / A11.1-A11.7 / A12.3 — only **two** tokens are tenant-customizable in v1: `--brand-accent` (one per org) and `--brand-logo` (one per org). Everything else (palette structure, typography, spacing, motion) is locked Nightwork.

### 2a. Token shape

```css
:root {
  /* Defaults — overridden per-tenant at request time */
  --brand-accent: var(--nw-stone-blue);  /* default = Nightwork Slate */
  --brand-logo: url("/branding/default/logo.png");  /* default = Ross Built */
}
```

### 2b. Delivery contract (per A11.1)

The `--brand-accent` value is injected via:

```ts
// In a server-rendered Layout component
document.documentElement.style.setProperty('--brand-accent', orgBranding.accentHex);
```

**NEVER** via `<style>` tag concatenation. **NEVER** via inline HTML interpolation. The value is server-derived from `getOrgBranding()` and never client-derivable.

### 2c. Validation (per A11.2)

Server-side hex regex: `/^#[0-9A-Fa-f]{6}$/`. Applied **before** injection. Invalid values reject and fall back to default `--brand-accent` (Stone Blue).

### 2d. Cache headers (per A11.3)

Every response carrying tenant-branded HTML sets:

```
Cache-Control: private, no-store
Vary: Cookie
```

This prevents CDN cross-tenant pollution. The `Vary: Cookie` ensures CDN partitions the cache key by session cookie; `private, no-store` stops shared caches entirely.

### 2e. Logo storage (per A11.4)

Storage backend: Supabase Storage at path `branding/{org_id}/logo.{ext}`. Signed URL scoped to the requesting org's membership; refreshed on a documented cadence (TBD — operational concern; default 1 hour expiry). Never a public bucket.

### 2f. Logo file types (per A11.5)

Allow-list: `image/png`, `image/svg+xml`, `image/jpeg`. **No other types.** SVG sanitization is mandatory server-side via `isomorphic-dompurify` (already installed; `^3.10.0`):

```ts
import DOMPurify from 'isomorphic-dompurify';

const sanitized = DOMPurify.sanitize(svgString, {
  USE_PROFILES: { svg: true, svgFilters: true },
});
```

`USE_PROFILES: { svg: true, svgFilters: true }` strips:
- `<script>` tags
- Event handlers (`onload`, `onclick`, `onerror`, etc.)
- External refs (`<use href="…"/>` to remote URLs)
- Unsafe SVG features (`<animate>` injection vectors)

**Sanitization runs server-side before storage.** Client-sanitized payloads are never trusted.

### 2g. Logo file size (per A11.6)

Max 200KB. Rejected at upload time with explicit error; no compression / resizing pipeline in v1.

### 2h. Role gate + audit log (per A11.7)

- **Write requires** `owner` or `admin` org role (per `getCurrentMembership()` check at API route).
- Every mutation appends to `activity_log`:
  - `action='branding.logo_updated'` for logo changes
  - `action='branding.accent_updated'` for accent changes
- Audit log is append-only; never editable.

### 2i. Components consuming brand tokens (per A12.3)

The COMPONENTS.md "Brand Customization" section (T13.1) restates which components reach `--brand-accent` / `--brand-logo`:
- **Button** primary variant → background uses `--brand-accent` fallback chain
- **AppShell header** → logo uses `--brand-logo`
- **Loading state spinner** → accent stripe uses `--brand-accent`
- **NwButton** (existing custom) → primary tint uses `--brand-accent`

Other surfaces (forms, tables, modals) use Nightwork Slate tokens directly — NOT brand-accent — because they should remain visually consistent across tenants.

---

## 3. Shadcn token remap (per C9)

shadcn 4.x ships primitives that reference tokens like `--background`, `--foreground`, `--primary`, etc. (the shadcn-default `neutral` palette names). Rather than introducing a parallel neutral OKLCH palette, **all shadcn token names alias to Slate values** from `colors_and_type.css`.

### 3a. The alias map (canonical, see `src/app/globals.css` for live source)

```css
:root,
:root[data-theme="light"],
[data-theme="light"] {
  --background: var(--bg-page);
  --foreground: var(--text-primary);
  --card: var(--bg-card);
  --card-foreground: var(--text-primary);
  --popover: var(--bg-card);
  --popover-foreground: var(--text-primary);
  --primary: var(--nw-stone-blue);
  --primary-foreground: var(--nw-white-sand);
  --secondary: var(--bg-subtle);
  --secondary-foreground: var(--text-primary);
  --muted: var(--bg-muted);
  --muted-foreground: var(--text-secondary);
  --accent: var(--nw-gulf-blue);
  --accent-foreground: var(--nw-white-sand);
  --destructive: var(--nw-danger);
  --destructive-foreground: var(--nw-white-sand);
  --border: var(--border-default);
  --input: var(--border-default);
  --ring: var(--nw-stone-blue);
  --radius: 0;
  --chart-1: var(--nw-stone-blue);
  --chart-2: var(--nw-gulf-blue);
  --chart-3: var(--nw-success);
  --chart-4: var(--nw-warn);
  --chart-5: var(--nw-danger);
  --sidebar: var(--bg-card);
  --sidebar-foreground: var(--text-primary);
  --sidebar-primary: var(--nw-stone-blue);
  --sidebar-primary-foreground: var(--nw-white-sand);
  --sidebar-accent: var(--bg-subtle);
  --sidebar-accent-foreground: var(--text-primary);
  --sidebar-border: var(--border-default);
  --sidebar-ring: var(--nw-stone-blue);
}
```

The dark-mode block (`:root[data-theme="dark"]`) uses identical alias names. `colors_and_type.css` already flips the underlying Slate vars when `[data-theme="dark"]` is set — so the shadcn aliases flip for free.

### 3b. The `--radius: 0` override

shadcn's default `--radius` is `0.625rem` (10px). Per SPEC A2.1, rectangular elements use `0`. The override is hard-coded; the explicit exception (`--radius-dot: 999px`) lives in `colors_and_type.css` and is referenced by avatars + status dots only.

### 3c. Verification

- `grep -c "oklch(" src/app/globals.css` returns 0 — no neutral OKLCH tokens persist.
- All shadcn primitives render in Slate via the alias indirection.
- Single source of truth: `colors_and_type.css` (the alias values point to Slate).

### 3d. Why aliasing instead of replacing

Replacing shadcn's token names with Slate names directly would require modifying every shadcn-generated primitive. The alias indirection lets us:
- Run `npx shadcn add` cleanly without rewriting token names
- Update Slate values in `colors_and_type.css` and have shadcn primitives inherit automatically
- Keep diffs against shadcn upstream small (only the codemod-rewritten v3 syntax + A2.1 changes remain)

---

## 4. Typography (per Q2=B + A4)

Slate type system locked. **No Calibri references. No Geist references.**

### 4a. Font families

| CSS variable      | Value                                                                                              | Tailwind utility            | Role                                                |
|-------------------|----------------------------------------------------------------------------------------------------|-----------------------------|-----------------------------------------------------|
| `--font-display`  | `var(--font-space-grotesk, "Space Grotesk"), system-ui, sans-serif`                                | `font-display`              | Display, headings, wordmark                         |
| `--font-body`     | `var(--font-inter, "Inter"), system-ui, -apple-system, sans-serif`                                 | `font-body` / `font-sans`    | Body text, form labels                              |
| `--font-mono`     | `var(--font-jetbrains-mono, "JetBrains Mono"), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | `font-mono`                  | Eyebrows, money, metadata                            |

Loaded via `next/font` in `layout.tsx`. CSS-var fallback chain matches the Slate skill.

### 4b. Type scale

| Scale token           | Value | Use case                                                          |
|-----------------------|-------|-------------------------------------------------------------------|
| `--fs-label`          | `10px`| Eyebrow size (UPPERCASE) — used in `Eyebrow.tsx`                   |
| `--fs-label-sm`       | `11px`| Smaller eyebrow / Money sm                                         |
| `--fs-meta`           | `12px`| Metadata, table column headers                                     |
| `--fs-sm`             | `13px`| Default DataRow value, Money md, Card metadata                     |
| `--fs-body`           | `14px`| Body text default per nightwork-design skill                       |
| `--fs-md`             | `15px`| `body { font-size: 15px }` in `globals.css`                        |
| `--fs-lg`             | `17px`| Larger body                                                        |
| `--fs-xl`             | `20px`| Section heading-ish                                                |
| `--fs-h3`             | `22px`| Money xl                                                           |
| `--fs-h2`             | `30px`| Page H2                                                            |
| `--fs-h1`             | `38px`| Page H1                                                            |
| `--fs-display`        | `48px`| Display (rarely used internally)                                   |
| `--fs-hero`           | `60px`| Hero (marketing only — internal screens never)                      |

**13 type-scale tokens.** Body default is **14-15px** (NOT 16). Eyebrows + money are **10-11px UPPERCASE** with mono.

### 4c. Tracking

| CSS variable            | Value     | Used in                                                    |
|-------------------------|-----------|------------------------------------------------------------|
| `--tracking-eyebrow`    | `0.14em`  | `Eyebrow.tsx`, `Badge.tsx`                                 |
| `--tracking-button`     | `0.12em`  | `Button.tsx`                                               |
| `--tracking-tight`      | `-0.02em` | Display headings (Space Grotesk)                            |
| `--tracking-wordmark`   | `-0.03em` | Logo wordmark                                               |

### 4d. Weights

- **Space Grotesk:** weights `400` and `500` only. Never `600/700` for display headings — looks heavy on internal screens.
- **Inter:** body weight `400` (regular); `500` (medium) for emphasis. Never `700`.
- **JetBrains Mono:** weight `500` (medium) UPPERCASE for eyebrows and money labels; weight `400` for code blocks.

### 4e. Special-purpose typography

- **Money values:** `font-mono` + `font-variant-numeric: tabular-nums` (per A4). Aligns columns of dollar amounts.
- **Eyebrows:** UPPERCASE + `--tracking-eyebrow` + `--font-mono` + `text-[color:var(--text-secondary)]` per `Eyebrow.tsx`.
- **Display headings:** `--font-display` + `--tracking-tight` + weight 400/500.

---

## 5. Spacing

**Tailwind default scale only.** No arbitrary `[13px]` values.

| Tailwind utility | Pixel value | CSS variable mirror |
|------------------|-------------|---------------------|
| `p-1`, `gap-1`, `m-1` | 4px  | `--space-1`  |
| `p-2`, `gap-2`, `m-2` | 8px  | `--space-2`  |
| `p-3`, `gap-3`, `m-3` | 12px | `--space-3`  |
| `p-4`, `gap-4`, `m-4` | 16px | `--space-4`  |
| `p-5`, `gap-5`, `m-5` | 20px | `--space-5`  |
| `p-6`, `gap-6`, `m-6` | 24px | `--space-6`  |
| `p-8`, `gap-8`, `m-8` | 32px | `--space-8`  |
| `p-10`, `gap-10`, `m-10` | 40px | `--space-10` |
| `p-12`, `gap-12`, `m-12` | 48px | `--space-12` |
| `p-16`, `gap-16`, `m-16` | 64px | `--space-16` |

The `--space-*` CSS variables exist for non-Tailwind contexts (e.g. in custom CSS files where bracket-value Tailwind isn't available). Prefer Tailwind utilities in `.tsx` components.

**Forbidden:** arbitrary spacing like `p-[13px]`, `gap-[7px]`. Use the next nearest scale step.

---

## 6. Border-radius

**0 except avatars + status dots.** Per SPEC A2.1 — `border-radius > 4px on rectangular elements` is oversized and forbidden.

```css
:root {
  --radius-none: 0;     /* default */
  --radius-dot: 999px;  /* avatars + status dots — explicit exception */
}
```

The Slate-aware shadcn token remap sets `--radius: 0` so all shadcn primitives inherit square aesthetic.

**Allowed:**
- `rounded-none` (the default)
- `rounded-full` ONLY on avatar / status dot files (filename heuristic: `*avatar*`, `*status-dot*`, `*radius-dot*`)

**Forbidden** (rejected by post-edit hook T10b):
- `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl` on rectangular elements
- Directional rounded: `rounded-t-xl`, `rounded-r-md`, `rounded-b-lg`, `rounded-l-xl`, `rounded-tl-md`, etc.

---

## 7. Shadows

**Minimal. Hover-lift only on interactive cards. No drop shadows on resting elements.**

| Use case                          | Shadow token       | CSS value                                          |
|-----------------------------------|--------------------|----------------------------------------------------|
| Hover on interactive card         | `--shadow-hover`   | `0 4px 6px -1px rgba(26, 40, 48, 0.08)`             |
| Right-rail panel elevation         | `--shadow-panel`   | `0 8px 24px -12px rgba(26, 40, 48, 0.18)`           |

**Forbidden** (rejected by post-edit hook T10b — see Section 13):
- `box-shadow` with blur > 20px AND non-zero spread (dark glow — Notion/Slack-adjacent)
- Drop shadows on resting (non-hover) elements
- Inner shadows (`inset` keyword) — not used in Nightwork

---

## 8. Motion (per Q5=A + A6)

**CSS-only.** Framer Motion is explicitly OUT OF SCOPE for v1. CSS transitions + `tailwindcss-animate` provide everything we need.

### 8a. Easing curves — allowed

- `linear` — for data-driven animations (progress bars, percent fills)
- `ease-in` — for fade-out / slide-out (departing elements decelerate from full speed)
- `ease-out` — for fade-in / slide-in (entering elements accelerate to a halt)
- `ease-in-out` — for symmetric transitions (e.g. accordion open/close)

### 8b. Easing curves — Forbidden (per A2.1)

- `cubic-bezier(.x, [1-9].[0-9], …)` — bouncy easing (overshoots ≥ 1.0 in 2nd or 4th arg)
- Spring overshoots — `transform: scale(1.05)` keyframes that exceed 1.0
- Elastic — repeating bounce at end of transition

The post-edit hook (T10b) enforces this — REJECTS any `cubic-bezier` with 2nd or 4th argument ≥ 1.0.

### 8c. Durations

| Duration | Use case                                              |
|----------|-------------------------------------------------------|
| `100ms`  | Micro-interactions (hover state changes, button feedback) |
| `200ms`  | Default — most transitions (modal open, dropdown reveal)   |
| `300ms`  | Deliberate (full-page transitions, accordion expand)        |

**Never** use durations > 300ms internally — feels sluggish. Marketing pages may use longer; internal screens never.

### 8d. `tailwindcss-animate` utility set (per C1 swap from `tw-animate-css`)

The plugin provides v3-compatible motion utilities:

- `animate-in`, `animate-out` — base classes that apply transition properties
- `fade-in-0`, `fade-out-0` — opacity transitions
- `zoom-in-95`, `zoom-out-95` — scale transitions (95% to 100% — sub-overshoot, allowed)
- `slide-in-from-top-2`, `slide-in-from-bottom-2`, `slide-in-from-left-2`, `slide-in-from-right-2` — translate transitions
- `slide-out-to-{direction}` — exit animations
- `data-[state=open]:`, `data-[state=closed]:` — Tailwind v3 arbitrary variants for data-attribute-driven animations (used by shadcn primitives)

Custom keyframes in `tailwind.config.ts`:
- `fade-up`, `fade-in`, `slide-in-left` — Nightwork-specific Slate motion
- `accordion-down`, `accordion-up` — for shadcn Accordion / Collapsible

### 8e. Print mode — animations disabled

```css
@media print {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

(Implemented in `globals.css`'s print stylesheet section.)

---

## 9. Layout grid + breakpoints (per Q4=B + A7)

**12-column desktop, 4-column mobile.** Tailwind defaults retained alongside Nightwork-specific aliases.

### 9a. Breakpoint aliases (extended in `tailwind.config.ts`)

| Alias          | Range           | Maps to                                                   |
|----------------|-----------------|-----------------------------------------------------------|
| `nw-phone`     | 0-480px         | iPhone (PM in field)                                       |
| `nw-tablet`    | 481-1023px      | iPad (PM in office)                                        |
| `nw-desktop`   | 1024+px         | Desktop monitor (HQ)                                       |
| `nw-print`     | (raw `print`)   | Print preview / PDF export                                 |

Tailwind defaults (`sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, `2xl: 1536px`) stay available — use them when granularity beyond the 4 nw-* aliases is needed.

### 9b. Grid

- **Desktop:** `grid-cols-12 gap-4` (or `gap-6` for sparse layouts)
- **Tablet:** typically `grid-cols-8 gap-4`
- **Mobile:** `grid-cols-4 gap-3`

Components specify their column span using Tailwind's `col-span-N` utilities. Major regions (left rail / center / right rail) use predictable spans:
- Left rail: `col-span-3` desktop / `col-span-4` tablet / `col-span-4` mobile
- Center: `col-span-6` desktop / `col-span-4` tablet / `col-span-4` mobile
- Right rail: `col-span-3` desktop / `col-span-8` tablet (collapses to full-width) / `col-span-4` mobile (collapses)

(See PATTERNS.md Document Review entry for the canonical layout.)

---

## 10. Density modes (per Q7=B + A8)

Two density tokens. Each component accepts a `density` prop (default: `comfortable`).

### 10a. Density CSS vars

```css
:root {
  --density-compact-row: 32px;
  --density-compact-padding: 4px 8px;
  --density-comfortable-row: 48px;
  --density-comfortable-padding: 8px 16px;
}
```

- **`--density-compact`** — `row-height: 32px`, `padding: 4px 8px`. Used for table cells, dense data, status badge pills.
- **`--density-comfortable`** — `row-height: 48px`, `padding: 8px 16px`. Used for forms, approval flows, document review fields.

### 10b. Print mode forces compact (per A2.2)

```css
@media print {
  :root {
    --density-row: var(--density-compact-row);
    --density-padding: var(--density-compact-padding);
  }
}
```

**Regardless of user preference**, print mode uses compact. AIA G702/G703 pay applications need maximum information density per page.

### 10c. Component contract

Components consume density via:
```tsx
<DataGrid density="compact" />     {/* explicit compact */}
<Form density="comfortable" />      {/* explicit comfortable */}
<Card density={isMobile ? "compact" : "comfortable"} />  {/* responsive */}
```

Default density per component family is documented in COMPONENTS.md.

---

## 11. Touch targets (per Q10=A + A9)

**44×44px minimum** (WCAG 2.5.5). **56×56px for high-stakes actions.**

### 11a. Definition of "high-stakes"

A high-stakes action is any action that:
- Mutates state irreversibly (delete, void, finalize)
- Transitions a workflow (approve, reject, kickback, submit)
- Moves money (record payment, push to QB, generate draw)

Specifically:
- **High-stakes (56×56px):** approve, reject, kickback, void, submit, delete, finalize-draw
- **Standard (44×44px):** edit, cancel, navigate, expand, collapse, search, filter

### 11b. Implementation

```tsx
// Standard touch target
<Button size="default">  {/* 44×44 minimum */}
  Edit
</Button>

// High-stakes
<Button size="lg">  {/* 56×56 minimum */}
  Approve
</Button>
```

Shadcn's button has size variants we map to:
- `size="sm"` → 36px (NOT a touch target — desktop-only / non-touch fallback)
- `size="default"` → 44px (standard touch target)
- `size="lg"` → 56px (high-stakes)
- `size="icon"` → 44×44 square

The codemod-rewritten button.tsx in `src/components/ui/` honors these.

### 11c. Touch-target spacing

Adjacent touch targets need ≥8px gap so a finger doesn't trigger the wrong one. Use `gap-2` (8px) minimum between touch-targetable elements.

---

## 12. Accessibility (per Q9=B + A10)

**WCAG 2.2 AA mandatory.** AAA aspirational where the matrix passes (`--text-primary` on `--bg-page` light/dark).

### 12a. Per-token contrast — see CONTRAST-MATRIX.md

The full matrix (`.planning/design/CONTRAST-MATRIX.md`) lists every `--text-*` × `--bg-*` combination in light + dark modes for both candidate palette sets.

**Summary — Set B (existing):**

| Theme | AA-normal passes | AA-large/UI only | Fails | Accept-with-rationale (text) |
|-------|------------------|------------------|-------|------------------------------|
| LIGHT | 9 / 50           | 14 / 50          | 15    | 3 (cap)                      |
| DARK  | 25 / 50          | 9 / 50           | 16    | 3 (cap)                      |

≤3 accept-with-rationale text cells per matrix per the design-pushback iteration-2 N1 cap. Each accept entry has a `Jake-signed: ____` line filled at CP2 review.

**Applied T12 fix (2026-04-30):** `--nw-gulf-blue` value bumped `#4E7A8C` → `#436A7A`. New measured contrast ratio of `--text-accent` on `bg-page` light: **5.37:1** (clears AA-normal 4.5:1). See §1i for the full ratio table across all light surface backgrounds, and CONTRAST-MATRIX.md §3, §5 for re-verified Set B and Set A LIGHT matrices.

### 12b. Focus-visible standard

```css
:where(button, a, [role="button"], input, select, textarea):focus-visible {
  outline: 2px solid var(--ring);  /* aliases to --nw-stone-blue */
  outline-offset: 2px;
}
```

- 2px outline width (visible without overpowering)
- 2px offset (separates outline from element border)
- `var(--ring)` color (Stone Blue — high contrast against both bg-page and bg-card)

### 12c. Keyboard navigation

Every interactive primitive supports:
- **Tab** — focus next interactive element
- **Shift+Tab** — focus previous
- **Enter / Space** — activate (button-like)
- **Escape** — dismiss (modal, drawer, popover)
- **Arrow keys** — navigate within composite widgets (combobox options, calendar dates, tabs)

Per ARIA convention. shadcn primitives + Base UI handle this for us out of the box.

### 12d. Screen reader

- All interactive elements have visible labels OR `aria-label` / `aria-labelledby`
- Status changes announce via `aria-live="polite"` (toasts, banners) or `aria-live="assertive"` (errors)
- Form errors associate with inputs via `aria-describedby`
- Loading states announce "Loading…" via visually-hidden text or `role="status"`

### 12e. axe-core automated checks (per D6 / D6.1)

Every category page in the components playground passes axe-core automated WCAG 2.2 AA checks. Output archived to `.planning/phases/stage-1.5a-design-system-documents/artifacts/axe-report.json`.

Manual keyboard-navigation spot-check on Combobox, DatePicker, Drawer (the three most-complex primitives).

---

## 13. Forbidden thresholds (per A2.1)

Every Forbidden category from PHILOSOPHY.md's "things I never want to see again" list is quantified here for **automated enforcement** by the post-edit hook (T10b).

### 13a. Oversized rounded corners

**Quantified:** `border-radius > 4px on rectangular elements`.

- Forbidden: `rounded-md` (6px), `rounded-lg` (8px), `rounded-xl` (12px), `rounded-2xl` (16px), `rounded-3xl` (24px), `rounded-full` (9999px)
- Forbidden directional: `rounded-t-xl`, `rounded-r-md`, `rounded-b-lg`, `rounded-l-xl`, `rounded-tl-md`, `rounded-tr-lg`, `rounded-bl-xl`, `rounded-br-2xl`, `rounded-ts-*`, `rounded-te-*`, `rounded-bs-*`, `rounded-be-*`, `rounded-s-*`, `rounded-e-*`
- Forbidden bracket form: `rounded-[5px]` and higher

**Allowed exception:** avatars + status dots — `--radius-dot: 999px` per `colors_and_type.css`. Detected by filename heuristic (`*avatar*`, `*status-dot*`, etc.).

### 13b. Bouncy easing

**Quantified:** `cubic-bezier(.x, [1-9].[0-9], .x, [1-9].[0-9])` — any 2nd or 4th argument ≥ 1.0 means overshoot/elastic.

- Forbidden: `cubic-bezier(0.4, 1.5, 0.3, 0.5)` (2nd arg overshoots)
- Forbidden: `cubic-bezier(0.4, 0.5, 0.3, 1.2)` (4th arg overshoots)
- Forbidden: `cubic-bezier(0.4, 1.5, 0.3, 1.2)` (both overshoot — elastic)

The post-edit hook (T10b) regex matches both arg positions independently.

### 13c. Generic gradients

**Quantified:** any `background:` declaration containing `linear-gradient`, `radial-gradient`, or `conic-gradient` is forbidden on a non-decorative element.

(NOT enforced by hook in v1 — too noisy. Documented; enforced by review at `/nightwork-design-check`.)

### 13d. Purple/pink accents (anti-Notion / anti-Slack posture)

**Quantified:** HSL hue ∈ [270°, 320°] in any `hsl(…)` literal.

- Forbidden: `hsl(280, 50%, 50%)` (purple)
- Forbidden: `hsl(310, 60%, 70%)` (pink)
- Forbidden: `hsl(290, 40%, 60%)` (violet)

### 13e. Dark glows

**Quantified:** `box-shadow:` with blur > 20px AND non-zero spread.

- Forbidden: `box-shadow: 0 0 30px 5px rgba(0,0,0,0.3)`
- Forbidden: `box-shadow: 0 8px 32px 4px rgba(91,134,153,0.4)`

The hook's regex matches `\\s+(2[1-9]|[3-9][0-9]|[1-9][0-9]{2,})px\\s+[1-9][0-9]*px` after `box-shadow:`.

### 13f. Marketing-page typography on internal screens

**Quantified:** `font-family` outside the Slate type system (Space Grotesk / Inter / JetBrains Mono).

- Forbidden: `font-family: "Calibri"`
- Forbidden: `font-family: "Geist"` (Vercel's marketing font)
- Forbidden: `font-family: "Helvetica"`, `"Arial"` (raw — no fallback chain)
- Forbidden: weight ≥ 700 on Space Grotesk display headings (looks heavy)

(Partial hook coverage; full enforcement at `/nightwork-design-check`.)

### 13g. Phone-trying-to-be-desktop / desktop-trying-to-be-phone

**Quantified:** anti-patterns are catalogued at the PATTERNS.md level (Mobile Approval pattern A18 / A18.1) — not enforced by automated check.

- Mobile screen with desktop's left rail intact at <481px: anti-pattern
- Desktop screen forcing single-column stack at >1024px: anti-pattern

PATTERNS.md "Mobile Approval" defines correct mobile information density.

### 13h. Hook coverage summary

| Forbidden category | Hook block | Enforcement quality |
|---|---|---|
| Oversized rounded | T10b | Strong (matches all variants except in-bracket forms) |
| Bouncy easing | T10b | Strong (matches both arg positions) |
| Generic gradients | (none — review only) | Weak (manual at `/nightwork-design-check`) |
| Purple/pink HSL | T10b | Strong (matches HSL [270, 320]) |
| Dark glows | T10b | Strong (matches blur > 20px + spread > 0) |
| Marketing typography | (partial — review only) | Weak (manual + tooling at lint) |
| Phone/desktop confusion | (none — pattern review) | None at hook layer |

---

## 14. Skill anchor (per A19.1)

SYSTEM.md is referenced by the following skills as authoritative for tokens / type / motion / density / accessibility. **Bidirectional cross-reference** — when SYSTEM.md tokens change, those skills update too.

### 14a. Skills depending on SYSTEM.md

| Skill                                | What SYSTEM.md authorizes                                                  |
|--------------------------------------|----------------------------------------------------------------------------|
| `nightwork-design`                   | Palette intent + type system; SYSTEM.md is the canonical source            |
| `nightwork-design-tokens`            | Token enforcement rules (the canonical list of allowed tokens lives here)  |
| `nightwork-ui-template`              | Invoice review gold-standard template — references SYSTEM.md tokens         |
| `nightwork-design-system-reviewer`   | Runs at `/nightwork-qa` and `/nightwork-design-check`; verifies SYSTEM.md compliance |
| `nightwork-ui-reviewer`              | Runs in `/nightwork-qa`; verifies pattern adherence + token usage           |

### 14b. SYSTEM.md → skill propagation rules

When this document changes:
1. The corresponding skill file MUST be updated in lockstep
2. The post-edit hook (`.claude/hooks/nightwork-post-edit.sh`) MUST be updated if a new Forbidden threshold is added
3. CONTRAST-MATRIX.md MUST be re-run if any `--text-*` or `--bg-*` value changes
4. The `/design-system/palette` and `/design-system/typography` playground pages MUST re-render correctly

The `/nightwork-propagate` orchestrator (per CLAUDE.md "Cross-cutting changes") runs this lockstep update for any SYSTEM.md change tagged "everywhere" or "all".

### 14c. Skills referenced FROM SYSTEM.md

This document references back to:
- `colors_and_type.css` — single canonical token source (read-only from SYSTEM.md's perspective)
- `tailwind.config.ts` — Tailwind utility extensions for `nw-*` colors + breakpoints
- `globals.css` — shadcn token alias remap + body baseline
- `.planning/design/CONTRAST-MATRIX.md` — full WCAG matrix
- `.planning/design/COMPONENTS.md` (T13 — pending) — component inventory consuming these tokens
- `.planning/design/PATTERNS.md` (T14 — pending) — patterns built on these tokens
- `.planning/design/PHILOSOPHY.md` (T17a/b — pending) — design directions that interpret these tokens
- `.planning/design/PROPAGATION-RULES.md` (T15 — pending) — workflow for token changes
- `.planning/design/BRANDING.md` (nwrp19 — 2026-04-30) — Nightwork wordmark + icon spec; authoritative for wordmark/icon usage. Tenant-customizable branding (`logo_url`, `--brand-accent`) remains in §2 of THIS document; the Nightwork mark itself is locked per BRANDING.md and non-customizable.

---

## 15. Cross-references

| Source | Where |
|---|---|
| Token enumeration audit | `audit-notes/T01-css-variables.md` (69 tokens) |
| Skill audit | `audit-notes/T04-design-skills.md` |
| Existing-component audit | `audit-notes/T05-existing-components.md` |
| Contrast matrix | `.planning/design/CONTRAST-MATRIX.md` (Set A + Set B; light + dark) |
| shadcn-v3 incompatibility | `audit-notes/T08-shadcn4-tailwind-v3-incompatibility.md` |
| Codemod | `scripts/shadcn-v3-codemod.ts` |
| Codemod test outcomes | `audit-notes/T08-codemod-test.md` |
| Hook positive tests | `.planning/phases/stage-1.5a-design-system-documents/artifacts/T35.5-hook-positive-tests.md` |
| SPEC criteria | `.planning/phases/stage-1.5a-design-system-documents/SPEC.md` (v2.1 — 51 + amended criteria) |
| PLAN tasks | `.planning/phases/stage-1.5a-design-system-documents/PLAN.md` (v2 — 47 tasks) |
| CLAUDE.md UI rules | `CLAUDE.md` "Nightwork standing rules → UI rules" section |
| Slate skill (palette intent) | `.claude/skills/nightwork-design/SKILL.md` |
| Token enforcement skill | `.claude/skills/nightwork-design-tokens/SKILL.md` |
| Invoice review template | `.claude/skills/nightwork-ui-template/SKILL.md` |
| Design system reviewer | `.claude/skills/nightwork-design-system-reviewer/SKILL.md` |

---

## 16. T12 carry-forward — applied + deferred

### Applied at T12 patch (2026-04-30, per nwrp14)

1. **`--nw-gulf-blue` bump** from `#4E7A8C` → `#436A7A` — measured **5.37:1** on `bg-page` light (was 4.29:1, AA-normal FAIL → PASS). Applied to:
   - `src/app/colors_and_type.css` — single source of truth (`--nw-gulf-blue` line 17).
   - `.claude/skills/nightwork-design/colors_and_type.css` — skill copy.
   - `.claude/skills/nightwork-design/README.md` — token docs table.
   - `.planning/design/SYSTEM.md` — §1a raw token table, §1i text token table, §1i applied-fix block, §12a applied-fix annotation.
   - `.planning/design/CONTRAST-MATRIX.md` — §3 LIGHT+B accent row, §5 LIGHT+A accent row, §3.5 disposition tables (A5/A6/A20/A21 → applied), §8 summary metrics.

   Side-effects (all strict improvements): `hover:bg-nw-gulf-blue` button hover backgrounds, `text-nw-gulf-blue` link hovers, and `.nw-primary-btn:hover` styles all see contrast ratios increase from `4.68:1` to `5.86:1` (white text on hover bg).

### Deferred (not blocking CP2)

2. **CP2 palette pick** — if Jake picks Set A at `/design-system/palette`, all `--nw-stone-blue` / `--nw-slate-deep` / `--nw-slate-tile` values shift; `colors_and_type.css` updates and the contrast matrix re-runs. The §1b note in this document (added per nwrp14 directive 3) tracks the conditional removal of the DARK + Set A semantic-color special-case rule if Set B is picked instead.
3. **Density CSS vars** — currently described in this document; need to be added to `colors_and_type.css` as `--density-compact-row` / `--density-compact-padding` / `--density-comfortable-row` / `--density-comfortable-padding` (deferred to first density-aware component implementation).

These are tracked as deferred items within Stage 1.5a — none block CP2.

---

**T12 status:** SYSTEM.md APPROVED + PATCHED (2026-04-30 per nwrp14 — text-accent contrast fix applied, Set B special-case-rule note added). Subordinate documents (COMPONENTS.md, PATTERNS.md, PROPAGATION-RULES.md) and the components playground (T18-T26) reference this document as authoritative. Re-verification triggered by Q1 palette pick at CP2.
