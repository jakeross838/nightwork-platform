# T01 — Audit `src/app/colors_and_type.css` — full CSS variable enumeration

**Source:** `src/app/colors_and_type.css` (Slate palette tokens; additive only)
**Scope:** every `--*` declaration grouped by role, with light + dark values + the corresponding Tailwind utility name (where one exists in `tailwind.config.ts`).
**Date:** 2026-04-29

---

## 1. Raw brand tokens (`--nw-*`) — declared on `:root`, theme-invariant

These are the literal hex sources. They flow into the semantic tokens below via `var(--nw-*)`. The same value resolves in light and dark mode — only the *semantic* tokens flip.

| CSS variable | Hex value | Tailwind utility |
|---|---|---|
| `--nw-slate-tile`   | `#3B5864` | `nw-slate-tile`   |
| `--nw-slate-deep`   | `#1A2830` | `nw-slate-deep`   |
| `--nw-slate-deeper` | `#132028` | `nw-slate-deeper` |
| `--nw-stone-blue`   | `#5B8699` | `nw-stone-blue`   |
| `--nw-gulf-blue`    | `#4E7A8C` | `nw-gulf-blue`    |
| `--nw-oceanside`    | `#CBD8DB` | `nw-oceanside`    |
| `--nw-white-sand`   | `#F7F5EC` | `nw-white-sand`   |
| `--nw-warn`         | `#C98A3B` | `nw-warn`         |
| `--nw-success`      | `#4A8A6F` | `nw-success`      |
| `--nw-danger`       | `#B0554E` | `nw-danger`       |

Total: **10 raw brand tokens.**

---

## 2. Font family tokens — theme-invariant

Loaded by `next/font` in `layout.tsx`; CSS-var fallback chain matches Slate skill.

| CSS variable    | Value (next/font + fallback) | Tailwind utility |
|---|---|---|
| `--font-display` | `var(--font-space-grotesk, "Space Grotesk"), system-ui, sans-serif`                 | `font-display`               |
| `--font-body`    | `var(--font-inter, "Inter"), system-ui, -apple-system, sans-serif`                  | `font-body` / `font-sans`    |
| `--font-mono`    | `var(--font-jetbrains-mono, "JetBrains Mono"), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | `font-mono` |

---

## 3. Type scale (font-size) — theme-invariant

Bracket-value Tailwind only (`text-[length:var(--fs-…)]`); no namespaced utility — these are consumed by hand-written `style={{ fontSize: 'var(--fs-…)' }}` or by component internals (e.g. `Eyebrow.tsx` uses `text-[10px]` literal).

| CSS variable | Value | Notes |
|---|---|---|
| `--fs-label`    | `10px` | Eyebrow size; used in `Eyebrow.tsx` (literal `text-[10px]`) |
| `--fs-label-sm` | `11px` | Smaller eyebrow / Money sm                                   |
| `--fs-meta`     | `12px` | Metadata, table column headers                              |
| `--fs-sm`       | `13px` | Default DataRow value, Money md, Card metadata             |
| `--fs-body`     | `14px` | Body text default per nightwork-design skill                 |
| `--fs-md`       | `15px` | `body { font-size: 15px }` in `globals.css`                  |
| `--fs-lg`       | `17px` |                                                              |
| `--fs-xl`       | `20px` |                                                              |
| `--fs-h3`       | `22px` | Money xl                                                     |
| `--fs-h2`       | `30px` |                                                              |
| `--fs-h1`       | `38px` |                                                              |
| `--fs-display`  | `48px` |                                                              |
| `--fs-hero`     | `60px` |                                                              |

Total: **13 type-scale tokens.**

---

## 4. Tracking (letter-spacing) — theme-invariant

| CSS variable | Value | Used in |
|---|---|---|
| `--tracking-eyebrow`  | `0.14em`  | `Eyebrow.tsx` (inline `letterSpacing: '0.14em'`), `Badge.tsx` |
| `--tracking-button`   | `0.12em`  | `Button.tsx` (inline `letterSpacing: '0.12em'`)               |
| `--tracking-tight`    | `-0.02em` | Display headings per skill                                    |
| `--tracking-wordmark` | `-0.03em` | Logo wordmark per skill                                       |

---

## 5. Spacing (4px grid) — theme-invariant

Tailwind defaults already cover this scale (1=4px, 2=8px, 3=12px, ...). The named `--space-*` vars are duplicate references for non-Tailwind contexts.

| CSS variable | Value | Tailwind equivalent |
|---|---|---|
| `--space-1`  | `4px`  | `p-1`, `gap-1`, `m-1`   |
| `--space-2`  | `8px`  | `p-2`, `gap-2`, `m-2`   |
| `--space-3`  | `12px` | `p-3`, `gap-3`, `m-3`   |
| `--space-4`  | `16px` | `p-4`, `gap-4`, `m-4`   |
| `--space-5`  | `20px` | `p-5`, `gap-5`, `m-5`   |
| `--space-6`  | `24px` | `p-6`, `gap-6`, `m-6`   |
| `--space-8`  | `32px` | `p-8`, `gap-8`, `m-8`   |
| `--space-10` | `40px` | `p-10`, `gap-10`, `m-10`|
| `--space-12` | `48px` | `p-12`, `gap-12`, `m-12`|
| `--space-16` | `64px` | `p-16`, `gap-16`, `m-16`|

Total: **10 spacing tokens.**

---

## 6. Radii — theme-invariant

| CSS variable | Value | Notes |
|---|---|---|
| `--radius-none` | `0`    | Default for all rectangular elements (per Slate non-negotiable #1) |
| `--radius-dot`  | `999px`| Avatars + status dots only — explicit exception                    |

`tailwind.config.ts` extends `borderRadius` with `none: "0"`.

---

## 7. Shadows — theme-invariant

| CSS variable | Value | Used in |
|---|---|---|
| `--shadow-hover` | `0 4px 6px -1px rgba(26, 40, 48, 0.08)` | Hover lift on interactive cards                  |
| `--shadow-panel` | `0 8px 24px -12px rgba(26, 40, 48, 0.18)`| Right-rail panel elevation                       |

---

## 8. Status dot tokens — theme-invariant (color delegated to `--nw-*`)

| CSS variable | Value | Used in |
|---|---|---|
| `--dot-active`   | `var(--nw-success)`            | Active job status |
| `--dot-warranty` | `var(--nw-warn)`               | Warranty status   |
| `--dot-complete` | `rgba(59, 88, 100, 0.55)`      | Completed status  |

---

## 9. Semantic tokens — THEME-DEPENDENT

These flip per `data-theme="light"` vs `data-theme="dark"`. Selector list is `:root, :root[data-theme="light"], [data-theme="light"]` for light, and `:root[data-theme="dark"], [data-theme="dark"]` for dark.

### 9a. Background tokens (`--bg-*`)

| Variable           | Light value                    | Dark value                            | Tailwind utility shape                  |
|---|---|---|---|
| `--bg-page`        | `var(--nw-white-sand)` = `#F7F5EC` | `var(--nw-slate-deep)` = `#1A2830` | `bg-[var(--bg-page)]`                |
| `--bg-card`        | `#FFFFFF`                          | `var(--nw-slate-deeper)` = `#132028` | `bg-[var(--bg-card)]`                |
| `--bg-subtle`      | `rgba(91, 134, 153, 0.06)` (stone-blue 6%) | `rgba(247, 245, 236, 0.04)` (sand 4%) | `bg-[var(--bg-subtle)]`         |
| `--bg-muted`       | `rgba(59, 88, 100, 0.08)` (tile 8%) | `rgba(247, 245, 236, 0.08)` (sand 8%) | `bg-[var(--bg-muted)]`            |
| `--bg-inverse`     | `var(--nw-slate-deep)` = `#1A2830` | `var(--nw-white-sand)` = `#F7F5EC` | `bg-[var(--bg-inverse)]`             |
| `--bg-inverse-hover` | `var(--nw-slate-deeper)` = `#132028` | `rgba(247, 245, 236, 0.92)`     | `bg-[var(--bg-inverse-hover)]`       |

### 9b. Text tokens (`--text-*`)

| Variable          | Light value                    | Dark value                          | Tailwind utility shape                       |
|---|---|---|---|
| `--text-primary`   | `var(--nw-slate-tile)` = `#3B5864` | `var(--nw-white-sand)` = `#F7F5EC` | `text-[color:var(--text-primary)]`        |
| `--text-secondary` | `rgba(59, 88, 100, 0.70)` (tile 70%) | `rgba(247, 245, 236, 0.72)` (sand 72%) | `text-[color:var(--text-secondary)]`  |
| `--text-tertiary`  | `rgba(59, 88, 100, 0.55)` (tile 55%) | `rgba(247, 245, 236, 0.55)` (sand 55%) | `text-[color:var(--text-tertiary)]`   |
| `--text-muted`     | `rgba(59, 88, 100, 0.40)` (tile 40%) | `rgba(247, 245, 236, 0.40)` (sand 40%) | `text-[color:var(--text-muted)]`     |
| `--text-inverse`   | `var(--nw-white-sand)` = `#F7F5EC` | `var(--nw-slate-tile)` = `#3B5864` | `text-[color:var(--text-inverse)]`         |
| `--text-accent`    | `var(--nw-gulf-blue)` = `#4E7A8C` | `var(--nw-oceanside)` = `#CBD8DB`  | `text-[color:var(--text-accent)]`         |

### 9c. Border tokens (`--border-*`)

| Variable          | Light value                       | Dark value                       | Tailwind utility shape              |
|---|---|---|---|
| `--border-default` | `rgba(59, 88, 100, 0.15)` (tile 15%) | `rgba(247, 245, 236, 0.08)` (sand 8%)  | `border-[var(--border-default)]` |
| `--border-subtle`  | `rgba(59, 88, 100, 0.08)` (tile 8%)  | `rgba(247, 245, 236, 0.04)` (sand 4%)  | `border-[var(--border-subtle)]`  |
| `--border-strong`  | `rgba(59, 88, 100, 0.30)` (tile 30%) | `rgba(247, 245, 236, 0.18)` (sand 18%) | `border-[var(--border-strong)]`  |
| `--border-brand`   | `var(--nw-stone-blue)` = `#5B8699` | `var(--nw-stone-blue)` = `#5B8699` | `border-[var(--border-brand)]`     |

### 9d. Semantic colors (status / financial signal)

These are constant across themes (per file comment "same hues read fine on both backgrounds per Slate refs").

| Variable          | Light value                  | Dark value                     | Tailwind utility shape             |
|---|---|---|---|
| `--color-success` | `var(--nw-success)` = `#4A8A6F` | `var(--nw-success)` = `#4A8A6F` | `text-[color:var(--color-success)]` |
| `--color-warning` | `var(--nw-warn)` = `#C98A3B`    | `var(--nw-warn)` = `#C98A3B`    | `text-[color:var(--color-warning)]` |
| `--color-error`   | `var(--nw-danger)` = `#B0554E`  | `var(--nw-danger)` = `#B0554E`  | `text-[color:var(--color-error)]`   |
| `--color-money`   | `var(--nw-slate-tile)` = `#3B5864` | `var(--nw-white-sand)` = `#F7F5EC` | `text-[color:var(--color-money)]` |

### 9e. Legacy bridge tokens

These exist to keep old Tailwind utilities (`bg-brand-card`, `text-cream-muted`) working while the broader cleanup completes. Per Phase E carve-out.

| Variable        | Light value             | Dark value                          | Notes |
|---|---|---|---|
| `--color-white` | `#FFFFFF`               | `var(--nw-slate-deeper)` = `#132028` | Bridges `bg-brand-card`. In dark mode this is *not* white — adapts to card surface. |
| `--text-body`   | `var(--text-primary)`   | `var(--text-primary)`               | Bridges `text-cream-muted` → adapts via theme.                                      |

Total semantic tokens (9a-9e): **22**.

---

## 10. Token totals (summary)

| Group | Count |
|---|---|
| Raw brand (`--nw-*`)              | 10 |
| Font families (`--font-*`)        | 3  |
| Type scale (`--fs-*`)             | 13 |
| Tracking (`--tracking-*`)         | 4  |
| Spacing (`--space-*`)             | 10 |
| Radii (`--radius-*`)              | 2  |
| Shadows (`--shadow-*`)            | 2  |
| Status dot (`--dot-*`)            | 3  |
| Backgrounds (`--bg-*`)            | 6  |
| Text (`--text-*`)                 | 6  |
| Borders (`--border-*`)            | 4  |
| Semantic colors (`--color-*`)     | 4  |
| Legacy bridges                    | 2  |
| **Total CSS variables**           | **69** |

---

## 11. Divergence vs Jake's brief (forwarded to T03 / T03.1)

EXPANDED-SCOPE Q1 = C — both palette sets must be rendered side-by-side at CP2. The current `colors_and_type.css` matches **Set B** (existing skill values). **Set A** (Jake's brief: `#6B8EA3` accent / `#2D3E4A` dark slate / `#8A8A8A` warm gray) is *not* present in the file and would need to be added to `tailwind.config.ts` + `colors_and_type.css` only if Jake picks Set A at CP2.

This audit treats both sets as candidates — the contrast matrix (T03 + T03.1) computes ratios for both.

---

## 12. Cross-references

- `src/app/globals.css` — imports this file at top; adds `body { background: var(--bg-page); color: var(--text-body); }` and `disabled` form affordances. No additional theme tokens.
- `tailwind.config.ts` — `colors.nw-*` extension consumes the raw brand tokens; `fontFamily.{display,body,sans,mono}` consumes the font tokens; `borderRadius.none = "0"` mirrors `--radius-none`.
- `.claude/skills/nightwork-design/SKILL.md` — describes the same palette in prose; no separate hex declarations.
- `.claude/skills/nightwork-design-tokens/SKILL.md` — enforces these tokens via post-edit hook; rejects hardcoded hex / Tailwind named colors / legacy namespaces (`cream-*`, `teal-*`, `brass-*`, etc).

---

**T01 status:** COMPLETE — full enumeration captured.
