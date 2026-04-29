# T05 — Audit existing custom Nw* components

**Source:** `src/components/nw/*.tsx` — 7 components.
**Date:** 2026-04-29

For each: props, variants, default styling, token bindings, accessibility shape. This codification feeds COMPONENTS.md (T13).

The codebase contains exactly **7 Nw-prefixed primitives** under `src/components/nw/`. There are NO Nw* components elsewhere in `src/components/` (verified — Glob `src/components/**/Nw*.tsx` returns 0 outside the `nw/` folder; `Glob src/components/nw/**/*.tsx` returned 7 files: `Badge.tsx`, `Button.tsx`, `Card.tsx`, `DataRow.tsx`, `Eyebrow.tsx`, `Money.tsx`, `StatusDot.tsx`).

---

## Inventory table (top-level)

| # | Component | Default export | "use client"? | Variants | Sizes | Notes |
|---|---|---|---|---|---|---|
| 1 | `Button.tsx`     | `Button`     | yes | `primary` / `secondary` / `ghost` / `danger`           | `sm` / `md` / `lg` | forwardRef; loading state |
| 2 | `Eyebrow.tsx`    | `Eyebrow`    | no  | `default` / `accent` / `warn` / `success` / `danger` / `muted` | (single)        | inline icon slot |
| 3 | `Badge.tsx`      | `Badge`      | no  | `neutral` / `success` / `warning` / `danger` / `info` / `accent` | `sm` / `md` | bordered + tinted |
| 4 | `Card.tsx`       | `Card`       | no  | `default` / `inverse`                                  | padding: `none/sm/md/lg` | square corners |
| 5 | `DataRow.tsx`    | `DataRow`    | no  | `normal` / `emphasized` / `danger`                     | layout: `stacked/horizontal` | composes `<Eyebrow>` |
| 6 | `Money.tsx`      | `Money`      | no  | `default` / `negative` / `emphasized` / `muted`        | `sm` / `md` / `lg` / `xl` | tabular-nums; cents-input |
| 7 | `StatusDot.tsx`  | `StatusDot`  | no  | `active` / `pending` / `inactive` / `danger` / `info`  | `sm` / `md` | round (exception #1) |

---

## 1. `Button.tsx`

### Props

```ts
interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: "primary" | "secondary" | "ghost" | "danger";  // default: "primary"
  size?: "sm" | "md" | "lg";                                // default: "md"
  loading?: boolean;                                         // default: false
  children: ReactNode;
}
```

`forwardRef<HTMLButtonElement, ButtonProps>`. Spreads `...rest` of `ButtonHTMLAttributes` (so `onClick`, `disabled`, `aria-*`, `data-*`, etc. all pass through).

### Variants — default styling

| Variant | Background | Text | Border | Hover | Disabled |
|---|---|---|---|---|---|
| `primary`   | `bg-nw-stone-blue` | `text-nw-white-sand` | `border-nw-stone-blue` | `hover:bg-nw-gulf-blue hover:border-nw-gulf-blue` | `disabled:bg-nw-stone-blue/40 disabled:border-nw-stone-blue/40 disabled:cursor-not-allowed` |
| `secondary` | `bg-transparent` | `text-[var(--text-primary)]` | `border-[var(--border-strong)]` | `hover:border-[var(--text-primary)] hover:bg-[var(--bg-subtle)]` | `disabled:opacity-40 disabled:cursor-not-allowed` |
| `ghost`     | `bg-transparent` | `text-[var(--text-primary)]` | `border-transparent` | `hover:bg-[var(--bg-subtle)]` | `disabled:opacity-40 disabled:cursor-not-allowed` |
| `danger`    | `bg-transparent` | `text-nw-danger` | `border-nw-danger/60` | `hover:bg-nw-danger/[0.08] hover:border-nw-danger` | `disabled:opacity-40 disabled:cursor-not-allowed` |

### Sizes

| Size | Height | Horizontal padding | Font size |
|---|---|---|---|
| `sm` | `h-[30px]` | `px-3` | `text-[10px]` |
| `md` | `h-[36px]` | `px-4` | `text-[11px]` |
| `lg` | `h-[44px]` | `px-5` | `text-[12px]` |

### Token bindings

- `font-family`: inline `style={{ fontFamily: "var(--font-jetbrains-mono)" }}`.
- `letter-spacing`: inline `style={{ letterSpacing: "0.12em" }}` (`--tracking-button`).
- Text-transform: `uppercase`.
- `font-weight`: `font-medium` (500).
- `leading-none` (1.0 line-height).
- Focus: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-stone-blue/40 focus-visible:ring-offset-1`.
- Transition: `transition-colors duration-150`.

### Accessibility shape

- Native `<button>` element; default `type="button"` (overrideable).
- `disabled` propagates to native attribute.
- Focus visible via `focus-visible:ring-*` (not `focus:`) — keyboard-only ring, no mouse-click outline.
- Loading: renders an `aria-hidden` spinner span before children. **Note: loading does not set `aria-busy="true"` — possible improvement for COMPONENTS.md / T13.**
- No explicit `aria-label`; caller supplies via `...rest`.

### Anti-patterns (rejected by `nightwork-design-tokens` skill)

- Raw `<button>` with inline Tailwind utility styling (skill enforces use of NwButton).
- Adding a `rounded-*` class — square is non-negotiable.
- Replacing the inline `fontFamily: "var(--font-jetbrains-mono)"` with `font-mono` Tailwind utility (works, but the inline form preserves the token resolution explicit; current pattern is consistent across all primitives).

### Snapshot states (for COMPONENTS.md per A12)

`default` · `hover` · `focus-visible` · `active` (mouse-down — uses base style) · `disabled` · `loading` (spinner + disabled).

### Identified contract issue (forwarded to T13)

- **Loading does not signal `aria-busy`.** Add to T13 inventory as an a11y note + remediation.
- **Touch target audit:** size `sm` is 30px (below WCAG 2.5.5 44×44px); `md` is 36px (below); `lg` is 44px (passes). For mobile-approval pattern (A18), only `lg` is acceptable. SPEC A9 says 44px standard / 56px high-stakes — **none of the existing sizes meet 56px high-stakes.** T13 must specify "high-stakes mobile actions use a new `xl` size at 56px" OR document the gap.

---

## 2. `Eyebrow.tsx`

### Props

```ts
interface EyebrowProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "default" | "accent" | "warn" | "success" | "danger" | "muted";  // default: "muted"
  icon?: ReactNode;
  children: ReactNode;
}
```

### Variants (tone)

| Tone | Color (CSS var) |
|---|---|
| `default` | `var(--text-primary)` |
| `accent`  | `var(--nw-stone-blue)` |
| `warn`    | `var(--nw-warn)` |
| `success` | `var(--nw-success)` |
| `danger`  | `var(--nw-danger)` |
| `muted`   | `var(--text-tertiary)` (default) |

### Default styling

- Inline `style={{ fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "0.14em", color: TONE_COLORS[tone] }}`.
- `text-[10px]` (literal, matches `--fs-label`).
- `uppercase font-medium leading-none`.
- `inline-flex items-center gap-1.5` for icon alignment.

### Token bindings

`--font-mono` family; `--tracking-eyebrow` letter-spacing; tone-resolves via tone-map.

### Accessibility shape

- Renders a `<span>` (inline). Inherits document semantics (the heading semantic is supplied by the wrapping `<h*>` — eyebrow is a label/lead-in, not a heading).
- No `role` attribute. Caller can apply `role="heading"` if context requires.
- `icon` slot is rendered inside an `inline-flex` wrapper without `aria-hidden` — **possible improvement**: decorative icons should have `aria-hidden="true"`. T13 to flag.

### Snapshot states

`default` · `with icon` · `accent / warn / success / danger / muted variations`.

### Anti-patterns

- Plain `<span className="text-xs uppercase tracking-widest">` — skill rejects.

---

## 3. `Badge.tsx`

### Props

```ts
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "success" | "warning" | "danger" | "info" | "accent";  // default: "neutral"
  size?: "sm" | "md";                                                            // default: "sm"
  children: ReactNode;
}
```

### Variants

Each variant is a `{ color, tint }` pair; bordered + tinted (per Slate non-negotiable #7 — bordered, never filled).

| Variant | Color (border + text) | Background tint |
|---|---|---|
| `neutral` | `var(--text-primary)` | `transparent` |
| `success` | `var(--nw-success)`   | `rgba(74, 138, 111, 0.06)` |
| `warning` | `var(--nw-warn)`      | `rgba(201, 138, 59, 0.06)` |
| `danger`  | `var(--nw-danger)`    | `rgba(176, 85, 78, 0.06)` |
| `info`    | `var(--nw-gulf-blue)` | `rgba(78, 122, 140, 0.06)` |
| `accent`  | `var(--nw-stone-blue)`| `rgba(91, 134, 153, 0.06)` |

### Sizes

| Size | Height | Padding | Font size |
|---|---|---|---|
| `sm` | `h-[20px]` | `px-[6px]` | `text-[10px]` |
| `md` | `h-[24px]` | `px-2` | `text-[11px]` |

### Token bindings

- Inline `fontFamily: "var(--font-jetbrains-mono)"`.
- Inline `letterSpacing: "0.14em"`.
- Color + borderColor + backgroundColor all set inline from variant map.

### Accessibility shape

- `<span>` element with `inline-flex` content. No `role`; caller-determined.
- For status semantics, COMPONENTS.md must document: pair Badge with a `<StatusDot>` (or a status icon) for color-blind users — color alone is not sufficient for status communication (WCAG 1.4.1 Use of Color).

### Identified contract issue (forwarded to T13)

- **Color-only status communication.** Per WCAG 1.4.1, status badges must convey meaning beyond color. Today, the badge uses ALL-CAPS text + bordered shape — text is the primary differentiator, color is secondary. Acceptable, but COMPONENTS.md should explicitly note "always pass a text label, never use empty Badge as a color-coded indicator."

---

## 4. `Card.tsx`

### Props

```ts
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "inverse";          // default: "default"
  padding?: "none" | "sm" | "md" | "lg";   // default: "md"
  children: ReactNode;
}
```

### Variants

| Variant | Background | Text | Border |
|---|---|---|---|
| `default` | `var(--bg-card)` | `var(--text-primary)` | `var(--border-default)` |
| `inverse` | `bg-nw-slate-deep` | `text-nw-white-sand` | `rgba(247, 245, 236, 0.08)` (hardcoded, theme-invariant — "dark island" intentional) |

### Padding tokens

`none`=`p-0`, `sm`=`p-3` (12px), `md`=`p-5` (20px), `lg`=`p-6` (24px).

### Token bindings

- `border-default` color via CSS var.
- `bg-card` resolves theme-aware (white on light, slate-deeper on dark).
- `inverse` is a hardcoded "always-dark island" — does NOT theme-flip.

### Accessibility shape

- Plain `<div>`. No `role`. Caller may apply `role="region"` + `aria-label` if it's a landmark.

### Identified contract issue (forwarded to T13)

- **No `as` polymorphic prop.** If a Card needs to be a `<section>`, a `<button>` (clickable card), or a `<a>` (link card), today the caller must wrap externally. T13 should consider an `as` prop OR document the "wrap externally" pattern.

---

## 5. `DataRow.tsx`

### Props

```ts
interface DataRowProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;       // becomes <Eyebrow>
  value: ReactNode;
  variant?: "normal" | "emphasized" | "danger";  // default: "normal"
  layout?: "stacked" | "horizontal";              // default: "stacked"
  inverse?: boolean;                              // default: false (override eyebrow color for slate-deep card)
}
```

### Variants

| Variant | Value color (CSS var) |
|---|---|
| `normal`     | `var(--text-primary)` |
| `emphasized` | `var(--text-primary)` (same color, weight bumps to `font-medium`) |
| `danger`     | `var(--nw-danger)` |

### Layouts

- `stacked`: label on top (Eyebrow), value below (`text-[13px]`). Used by right-rail panels in invoice review.
- `horizontal`: label left, value right (`flex items-baseline justify-between gap-4`). Used by audit / lien rails.

### Inverse handling

When `inverse=true`, eyebrow color overrides to `rgba(247,245,236,0.5)` and value color resolves to `var(--nw-white-sand)`. Used inside slate-deep "dark island" cards.

### Token bindings

- Composes `<Eyebrow tone="muted">`.
- Value rendered as `<span className="text-[13px]"></span>` with inline `style={{ color: valueColor }}`.

### Accessibility shape

- Plain `<div>` wrapping `<Eyebrow>` + `<span>`. No `dt/dd` association — possible improvement: render as `<dl><dt><dd>` for screen-reader semantics. T13 to flag.

---

## 6. `Money.tsx`

### Props

```ts
interface MoneyProps extends Omit<HTMLAttributes<HTMLSpanElement>, "prefix"> {
  cents: number | null | undefined;  // null/undefined → em-dash "—" placeholder
  variant?: "default" | "negative" | "emphasized" | "muted";  // default: "default"
  size?: "sm" | "md" | "lg" | "xl";                           // default: "md"
  signColor?: boolean;                                         // default: false (auto-color negatives)
  prefix?: string;                                              // default: "$"
  suffix?: string;
  showCents?: boolean;                                          // default: true
}
```

### Variants

| Variant | Color (CSS var) |
|---|---|
| `default`    | `var(--color-money)` (resolves to `--text-primary` light, `--nw-white-sand` dark) |
| `negative`   | `var(--nw-danger)` |
| `emphasized` | `var(--text-primary)` |
| `muted`      | `var(--text-tertiary)` |

### Sizes

| Size | Tailwind |
|---|---|
| `sm` | `text-[11px]` |
| `md` | `text-[13px]` |
| `lg` | `text-[15px]` |
| `xl` | `text-[22px]` |

`emphasized` variant adds a weight bump per size: `sm/md/lg`=`font-medium`, `xl`=`font-semibold`.

### Token bindings

- Inline `fontFamily: "var(--font-jetbrains-mono)"`.
- Inline `fontVariantNumeric: "tabular-nums"` — required for column-aligned money.
- `whitespace-nowrap` to prevent breaking `$1,234.56` across lines.

### Behavior contract

- `cents` is the ONLY input format (matches DB convention per CLAUDE.md "Amounts in cents").
- `null`/`undefined` → renders an em-dash placeholder.
- `signColor=true` auto-promotes negative `default` → `negative` variant color.
- Format: `Math.abs(cents) / 100`, `toLocaleString("en-US")`, configurable `minimumFractionDigits` / `maximumFractionDigits` via `showCents`.

### Accessibility shape

- Plain `<span>`. No additional ARIA. Caller can wrap in `<bdo dir="ltr">` if needed for RTL contexts (Nightwork is en-US only — not relevant).

### Identified contract issue (forwarded to T13)

- **No `aria-label` on em-dash placeholder.** A screen reader would announce "—" — should announce "no value" or be `aria-hidden`. T13 to flag.
- **Money component does NOT use `formatCents()` / `formatDollars()` from `src/lib/utils/format.ts`** — it has its own inline `formatDollars` function. Per `nightwork-design-tokens` skill, the canonical helper is the one in `src/lib/utils/format.ts`. Two implementations may drift. T13 to flag — possible refactor to consume the lib helper.

---

## 7. `StatusDot.tsx`

### Props

```ts
interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "active" | "pending" | "inactive" | "danger" | "info";  // default: "active"
  size?: "sm" | "md";                                                // default: "md"
  label?: string;                                                     // optional sr-only label
}
```

### Variants

| Variant | Background color (CSS var) |
|---|---|
| `active`   | `var(--nw-success)` |
| `pending`  | `var(--nw-warn)` |
| `inactive` | `var(--text-muted)` (theme-aware — adapts to both modes) |
| `danger`   | `var(--nw-danger)` |
| `info`     | `var(--nw-stone-blue)` |

### Sizes

| Size | Tailwind |
|---|---|
| `sm` | `w-1.5 h-1.5` (6px) |
| `md` | `w-2 h-2` (8px) |

### Token bindings

- Inline `style={{ backgroundColor: VARIANT_COLORS[variant] }}`.
- Uses `rounded-full` — **explicit Slate exception** per non-negotiable #1 (avatars + status dots only).

### Accessibility shape

- Outer wrapper `<span>` with `inline-flex items-center`.
- Inner colored dot is `<span aria-hidden={label ? undefined : true}>` — if no `label`, dot is decorative; if `label` provided, dot is announced.
- Optional `<span className="sr-only">{label}</span>` for screen readers.

### Notes

- This is one of the 2 components allowed to be round (per non-negotiable #1).
- Color-only status communication — the `label` prop addresses WCAG 1.4.1 by providing a textual equivalent.

---

## 8. Cross-cutting observations

### Touch targets

- `Button` `lg` is 44px — meets WCAG 2.5.5 standard.
- `Button` `sm` (30px) and `md` (36px) — **below 44px**. For mobile contexts, ONLY `lg` is acceptable.
- **No `xl` (56px) size today.** SPEC A9 mandates 56px for high-stakes actions on mobile (per Q10=A). T13 must add an `xl` size to Button OR document the gap.

### Tabular-nums

Only `Money` enforces `font-variant-numeric: tabular-nums`. Tables of money outside `Money` (e.g. raw text in `<td>`) do not get column-aligned digits unless the consumer adds the inline style. T13 inventory should include "tabular-nums on table cells" guidance.

### Theme awareness — pattern observed

Each component documents WHICH variants are theme-aware vs hardcoded:
- `Button.primary` uses raw `nw-stone-blue` (CTA, designed to stand on both bgs).
- `Button.secondary/ghost` use semantic CSS vars (theme-flip).
- `Card.default` semantic vars (flips).
- `Card.inverse` hardcoded slate-deep (intentional dark island, doesn't flip).
- Eyebrow's `default/muted` flip; colored tones (`accent/warn/success/danger`) hardcoded.
- DataRow's `inverse` mode hardcodes white-sand value color.
- StatusDot's `inactive` flips via `--text-muted`; colored variants hardcoded.

This pattern is **consistent and intentional** per file comments. COMPONENTS.md (T13) must codify this rule explicitly.

### Forwarded missing primitives

These don't yet exist as Nw* but are listed in COMPONENTS.md (T13):
- `<NwInput>` — form text input
- `<NwSelect>` — native select
- `<NwTextarea>` — multi-line text
- `<NwLabel>` — form label
- `<NwFormField>` — Label + Input + Description + Error wrapper
- `<NwCheckbox>` / `<NwRadio>` — form selection
- `<NwIconButton>` — icon-only button (T20a icon migration)
- `<NwDivider>` — horizontal/vertical separators (used inline today)

These get added in Wave 4 (T20a etc.) per shadcn / custom mapping.

---

## 9. Summary inventory

| Custom primitive | Variants | Sizes | Tokens | A11y issues to flag in T13 |
|---|---|---|---|---|
| Button   | 4 (primary/secondary/ghost/danger) | 3 (sm/md/lg) | font-mono + tracking + nw-stone-blue + var(--text-primary)/var(--bg-subtle) | loading not aria-busy; sizes < 44px on mobile |
| Eyebrow  | 6 (default/accent/warn/success/danger/muted) | n/a | font-mono + tracking + tone color | icon slot not aria-hidden |
| Badge    | 6 (neutral/success/warning/danger/info/accent) | 2 (sm/md) | font-mono + tracking + variant color/tint | text-only differentiator (acceptable) |
| Card     | 2 (default/inverse) | n/a + 4 padding tokens | var(--bg-card) / var(--text-primary) / var(--border-default) | no `as` polymorphic prop |
| DataRow  | 3 (normal/emphasized/danger) | 2 layouts | inherits Eyebrow + value color | no dt/dd semantics |
| Money    | 4 (default/negative/emphasized/muted) | 4 (sm/md/lg/xl) | font-mono + tabular-nums + variant color | em-dash placeholder lacks aria-label; duplicates `formatDollars` from lib |
| StatusDot| 5 (active/pending/inactive/danger/info) | 2 (sm/md) | variant color + rounded-full (allowed exception) | label prop addresses WCAG 1.4.1 |

---

**T05 status:** COMPLETE — 7 components codified.
**Forwarded to T13 (COMPONENTS.md):** props, variants, states, tokens, ARIA notes, anti-patterns + 7 a11y / contract gaps for remediation guidance.
