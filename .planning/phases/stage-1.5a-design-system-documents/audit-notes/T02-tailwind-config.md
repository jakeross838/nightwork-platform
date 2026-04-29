# T02 — Audit `tailwind.config.ts`

**Source:** `tailwind.config.ts` (root)
**Scope:** every extended utility — colors, font families, animations, keyframes, breakpoints, border-radius, plus `darkMode` config.
**Date:** 2026-04-29

---

## 1. `darkMode` configuration

```ts
darkMode: ["class", '[data-theme="dark"]']
```

- Uses Tailwind's `class` strategy with the custom selector `[data-theme="dark"]`.
- Theme is server-rendered from the `nw_theme` cookie in `layout.tsx`; toggled on the client via `ThemeProvider`.
- This selector is what the `.dark:` Tailwind variants attach to. Any element with `data-theme="dark"` (or any ancestor with it) flips dark utilities.

---

## 2. `content` globs

```ts
content: [
  "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
  "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
],
```

**Implication for Wave 4:** the `src/app/design-system/**` route directory is already covered by the `./src/app/**` glob — no config change needed for the playground. **The `src/components/ui/**` directory (shadcn output, T07) is also already covered** by the `./src/components/**` glob.

---

## 3. `theme.extend.colors` — `nw-*` tokens (10 entries)

Every entry references a CSS variable from `colors_and_type.css`. No raw hex values in the config.

| Tailwind utility | CSS variable        | Resolves to (light) | Resolves to (dark) |
|---|---|---|---|
| `nw-slate-tile`   | `var(--nw-slate-tile)`   | `#3B5864` | `#3B5864` (theme-invariant) |
| `nw-slate-deep`   | `var(--nw-slate-deep)`   | `#1A2830` | `#1A2830` |
| `nw-slate-deeper` | `var(--nw-slate-deeper)` | `#132028` | `#132028` |
| `nw-stone-blue`   | `var(--nw-stone-blue)`   | `#5B8699` | `#5B8699` |
| `nw-gulf-blue`    | `var(--nw-gulf-blue)`    | `#4E7A8C` | `#4E7A8C` |
| `nw-oceanside`    | `var(--nw-oceanside)`    | `#CBD8DB` | `#CBD8DB` |
| `nw-white-sand`   | `var(--nw-white-sand)`   | `#F7F5EC` | `#F7F5EC` |
| `nw-warn`         | `var(--nw-warn)`         | `#C98A3B` | `#C98A3B` |
| `nw-success`      | `var(--nw-success)`      | `#4A8A6F` | `#4A8A6F` |
| `nw-danger`       | `var(--nw-danger)`       | `#B0554E` | `#B0554E` |

**Available as bg / text / border / ring / etc.** via the standard Tailwind utility shape (`bg-nw-stone-blue`, `text-nw-slate-tile`, `border-nw-stone-blue`, `ring-nw-stone-blue`, `divide-nw-stone-blue`, ...).

**Removed in Phase E (must NOT return):** `cream.*`, `teal.*`, `brass.*`, `brand.*`, `nightwork.*`, `status.*` namespaces — confirmed gone from this file.

---

## 4. `theme.extend.fontFamily`

| Tailwind utility | First fallback (next/font CSS var)              | Family chain                                                     |
|---|---|---|
| `font-display`   | `var(--font-space-grotesk)`                     | `Space Grotesk, system-ui, sans-serif`                          |
| `font-body`      | `var(--font-inter)`                             | `Inter, system-ui, -apple-system, sans-serif`                   |
| `font-sans`      | `var(--font-inter)`                             | `Inter, system-ui, -apple-system, sans-serif` (alias of `font-body`) |
| `font-mono`      | `var(--font-jetbrains-mono)`                    | `JetBrains Mono, ui-monospace, monospace`                       |

**Note:** `font-sans` and `font-body` resolve identically (both are Inter). Tailwind's default `font-sans` is therefore overridden to Inter, not the framework default.

---

## 5. `theme.extend.borderRadius`

```ts
borderRadius: { none: "0" }
```

- Only one extension: `rounded-none` resolves explicitly to `0`.
- All other Tailwind defaults (`rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-full`) **are NOT removed.** They still exist in the framework default. The Slate non-negotiable rule "everything is square except avatars + status dots" is enforced by the post-edit hook (`nightwork-design-tokens` skill), not by removing utilities here.
- **Hook enforcement (T10b will add):** `rounded-(lg|xl|2xl|3xl|full)` outside avatar/dot patterns gets blocked at edit time per SPEC C7 / A2.1.

---

## 6. `theme.extend.keyframes` — 3 named keyframes

| Name             | Frames                                                                          |
|---|---|
| `fade-up`        | `0%: { opacity: 0, transform: translateY(8px) }` → `100%: { opacity: 1, transform: translateY(0) }` |
| `fade-in`        | `0%: { opacity: 0 }` → `100%: { opacity: 1 }`                                   |
| `slide-in-left`  | `0%: { transform: translateX(-100%) }` → `100%: { transform: translateX(0) }`   |

**No bouncy / elastic / spring easing.** All three use linear transforms with monotonic `opacity` / `translate` interpolation. Cleared for Forbidden-list audit per A2 / A2.1.

---

## 7. `theme.extend.animation` — 3 named animations

| Tailwind utility    | Composition                              |
|---|---|
| `animate-fade-up`   | `fade-up 0.4s ease-out forwards`         |
| `animate-fade-in`   | `fade-in 0.3s ease-out forwards`         |
| `animate-slide-in-left` | `slide-in-left 0.2s ease-out`        |

All use `ease-out` (not bouncy). Durations are 200–400ms (within typical UI spec).

---

## 8. Breakpoints — **MISSING (T08b will add)**

`tailwind.config.ts` does **not** extend `theme.screens`. Tailwind defaults apply:

| Default key | Min-width | Notes                       |
|---|---|---|
| `sm`  | 640px  | (default Tailwind)            |
| `md`  | 768px  | (default Tailwind)            |
| `lg`  | 1024px | desktop pivot in invoice template |
| `xl`  | 1280px | (default Tailwind)            |
| `2xl` | 1536px | (default Tailwind)            |

**Required in T08b (per SPEC A7 / Q4=B):** add semantic aliases on top of Tailwind defaults:

```ts
screens: {
  'nw-phone':   { max: '480px' },
  'nw-tablet':  { min: '481px', max: '1023px' },
  'nw-desktop': { min: '1024px' },
  'nw-print':   { raw: 'print' },
  // Tailwind defaults remain via not removing them
}
```

(Exact shape TBD at T08b implementation time. No implementation in this audit; just the gap is logged.)

---

## 9. `plugins`

```ts
plugins: []
```

Empty array — no Tailwind plugins. Forms (`@tailwindcss/forms`), typography (`@tailwindcss/typography`), aspect-ratio not loaded. The Slate skill operates without plugins; if Wave 4 needs them, they'd be added as plan deviations.

---

## 10. Defaults that are NOT extended (and therefore inherit Tailwind defaults)

These are useful to enumerate so that any utility shape we use that's not explicitly extended is known to come from the framework default:

- `theme.spacing` — Tailwind default 4px grid (matches `--space-*` CSS vars).
- `theme.fontSize` — Tailwind default scale (`text-xs` = 12px, `text-sm` = 14px, `text-base` = 16px, ...).
- `theme.lineHeight` — Tailwind default.
- `theme.zIndex` — Tailwind default.
- `theme.boxShadow` — Tailwind default (Nightwork uses CSS vars for `--shadow-hover` / `--shadow-panel` directly via inline style or arbitrary `shadow-[...]` utility).
- `theme.opacity` — Tailwind default.
- `theme.borderWidth` — Tailwind default (1, 2, 4, 8 px).

---

## 11. Notable inline patterns in components (not in config)

Components use `style={{ … }}` for tokens that can't be expressed cleanly via Tailwind utilities:

- `Button.tsx`: `style={{ fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "0.12em" }}`
- `Eyebrow.tsx`: `style={{ fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "0.14em", color: TONE_COLORS[tone] }}`
- `Badge.tsx`: `style={{ fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "0.14em", color, borderColor, backgroundColor }}`
- `Money.tsx`: `style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums", color: VARIANT_COLORS[variant] }}`

Why inline: `fontFamily` + `letterSpacing` per-element + dynamic color via JS lookup map. Tailwind arbitrary values (`tracking-[0.14em]`) work for letter-spacing but require config extension or string interpolation. The current pattern is consistent across all `nw/*` primitives.

---

## 12. Bracket-value usage (the canonical Slate pattern)

Per `nightwork-design-tokens` skill, the supported pattern for theme-aware tokens is:

```tsx
className="bg-[var(--bg-card)] text-[color:var(--text-primary)] border-[var(--border-default)]"
```

This is supported by Tailwind's arbitrary value syntax — does NOT require config changes. No utilities are namespaced under `bg-card`, etc.; the pattern is `bg-[var(--…)]` directly.

---

## 13. Summary

| Section | Count / Status |
|---|---|
| `darkMode` strategy            | `class` + `[data-theme="dark"]` (custom)                          |
| `content` globs                | 4 (covers app/, components/, pages/, lib/)                        |
| `colors.nw-*`                  | 10 entries, all `var(--nw-*)`                                     |
| `fontFamily.*`                 | 4 entries (display, body, sans-alias-of-body, mono)               |
| `borderRadius.*`               | 1 entry (`none: "0"`)                                             |
| `keyframes.*`                  | 3 (fade-up, fade-in, slide-in-left)                               |
| `animation.*`                  | 3 (animate-fade-up, animate-fade-in, animate-slide-in-left)       |
| Breakpoints (`screens.*`)      | **NOT EXTENDED — T08b adds nw-phone / nw-tablet / nw-desktop / nw-print** |
| `plugins`                      | empty array                                                       |

**T02 status:** COMPLETE — full enumeration captured. Gap noted: T08b adds breakpoint aliases.
