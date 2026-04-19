# Nightwork Design System

> "Nightwork makes building lightwork."

Design system for **Nightwork** — construction financial software for custom home builders running $1.5M–$10M+ projects. Built for / by Ross Built Custom Homes (Anna Maria Island, FL).

## Index

- `colors_and_type.css` — design tokens (final Slate palette). Import directly.
- `SKILL.md` — Agent-Skills manifest; works standalone in Claude Code.
- `assets/` — logos (wordmark light/dark, app icon).
- `preview/` — specimen cards for colors, type, spacing, components, brand.
- `ui_kits/app/` — authenticated product (nav, sidebar, dashboard, draw wizard).
- `ui_kits/marketing/` — public site (hero, features, pricing, CTA, footer).
- **Reference screens** (use these as pixel templates):
  - `Slate Owner Portal.html` — homeowner dashboard
  - `Slate Owner Sign-in.html` — split-screen auth
  - `Slate Draw Approval Detail.html` — deep detail + sticky rail
  - `Slate Draw Wizard.html` — multi-step wizard pattern
  - `Slate Invoice Detail.html` — invoice drill-down
  - `Slate Mobile Jobsite.html` — phone-first patterns
  - `Slate Immersive Build.html` — data-dense internal app shell

## Source repo
`github.com/jakeross838/Ross-Built-Command` @ `main`

---

## PALETTE — Slate (final)

Cayman-Islands-inspired: slate-tile text, stone-blue action, white-sand page.

| Token | Hex | Use |
|---|---|---|
| `--nw-slate-tile` | `#3B5864` | Primary text + brand color |
| `--nw-slate-deep` | `#1A2830` | Top nav, inverse surfaces, primary button |
| `--nw-slate-deeper` | `#132028` | Hover state on slate-deep |
| `--nw-stone-blue` | `#5B8699` | Primary accent, progress bars, accent button |
| `--nw-gulf-blue` | `#4E7A8C` | Links, hover on stone-blue |
| `--nw-oceanside` | `#CBD8DB` | Tint, subtle accent |
| `--nw-white-sand` | `#F7F5EC` | Page background (warm off-white — NOT pure white) |
| `--nw-warn` | `#C98A3B` | Pending approvals, warnings, allowance overages |
| `--nw-success` | `#4A8A6F` | Approvals, complete, verified |
| `--nw-danger` | `#B0554E` | Disputes, errors, retainage deductions |

**The page is `#F7F5EC`, not white.** This single choice carries most of the brand identity — the UI reads like drafting stock rather than generic SaaS chrome.

---

## TYPOGRAPHY

Three families, each with a clear job:

- **Space Grotesk** — display + headlines. Weight 400/500 only, never 700. `-0.02em` tracking on display sizes.
- **Inter** — body copy, nav items, form fields. 14–15px (not 16).
- **JetBrains Mono** — eyebrows, labels, money, status pills, audit trails. 10–11px, `0.14em` tracking, `UPPERCASE`.

Money is **always** JetBrains Mono + `font-variant-numeric: tabular-nums`.

Eyebrow pattern (the single most-repeated motif):
```html
<span class="eyebrow">AWAITING YOUR APPROVAL · DUE APR 25</span>
```

---

## CONTENT FUNDAMENTALS

**Tone: confident, professional, builder-direct.** Serious financial software — copy respects that.

- **Voice** — second person ("You build homes. Nightwork runs your business."). Plain verbs. Short sentences. No hedging.
- **Casing** — Title Case in page/section headers. UPPERCASE WITH TRACKING for eyebrows, form labels, button text. Sentence case in body.
- **Money** — always tabular nums, `$1,234.56`. Dollar sign + commas. Never abbreviate ($1.2M only acceptable on marketing).
- **Numbers** — draw numbers are `#`-prefixed (`Draw #9`). PCCO numbers use `PCCO-` prefix. CSI codes `06-100` formatted with mono.
- **Status vocabulary** — `active / complete / warranty / cancelled` for jobs; `received / pm_review / pm_approved / qa_approved / pushed_to_qb / in_draw / paid / void` for invoices.
- **No emoji.** Exceptions: `⚠` and `ℹ` in inline warning strips. That's it.
- **No AI sparkle.** No ✨, no "magic", no "smart". Use "Claude extracts" or "AI parses" — name the mechanism.
- **Oxford comma** used.
- **Constructionisms are fine** — "draw", "cost code", "G702", "PCCO", "lien release", "retainage" aren't defined inline. Audience is builders.

Real copy examples:
- Hero: "You build homes. Nightwork runs your business."
- Empty state: "You're all caught up — nothing needs your attention right now."
- Warning: "Draw #3 is still in pm_review status — approve or void it before creating Draw #4."
- Button: "Create Draw" · "Approve & release →" · "Save Draft"

---

## VISUAL FOUNDATIONS

### Corners
**Everything is square.** Zero border-radius on cards, buttons, fields, badges, pills. The only exceptions: avatar circles and status dots (999px). This is non-negotiable — "no overly rounded corners" is a brand rule.

### Borders
Thin (`1px`) slate borders at `rgba(59, 88, 100, 0.15)`. Divider rules between table rows at `0.08` opacity. No double borders, no colored left-border accents.

### Shadows
Almost none. A subtle hover lift (`0 4px 6px -1px rgba(26,40,48,0.08)`) on interactive cards. A sticky right-rail may use `0 8px 24px -12px` for floating feel. No drop shadows on regular cards.

### Backgrounds
- Page: `--nw-white-sand` (`#F7F5EC`). Cards: white.
- Inverse surfaces: `--nw-slate-deep` (nav, CTA banners, modal headers, action strips).
- **No gradients as backgrounds.** None. The only gradient acceptable is a 1px beam accent next to the wordmark (`linear-gradient(90deg, stone-blue, transparent)`).
- **No illustrations, no stock photography** inside the product.
- Photo tiles use solid slate gradients as placeholders (since real jobsite photos come from clients).

### Density
Body 14px. Line-height 1.5. Card padding `24px 26px`. Table cells `13px` with `12px` vertical padding. Tighter than default SaaS — builders scan a lot of data.

### Buttons
Square. Padding `11px 18px`. JetBrains Mono `11px`, `letter-spacing: 0.12em`, UPPERCASE.
- **Primary** — `slate-deep` background, `white-sand` text.
- **Accent** — `stone-blue` background, `white-sand` text.
- **Ghost** — transparent + `1px border-strong`, hover to `stone-blue`.
- **Danger** — transparent + danger border, subtle pink hover.

### Status pills
`pill` class — square, bordered, mono 9px label. Color = border + text (`currentColor`). Never filled.

### Layout
- Max content width: **1180px** (dashboards), **1200px** (marketing).
- Sidebar: **220px** fixed, collapses to 48px rail.
- Nav: **60px** tall, `slate-deep` bg.
- Mobile breakpoint: `<900px` → sidebar becomes drawer, right-rails flow below main column.
- KPI strips: 4 cells, `1px gap` with colored hairlines (not card-style).

### Motion
Minimal. `transition: 0.15s` on hover/focus. No entrance animations, no scroll effects, no parallax. Loading states use a thin mono-monochrome spinner (2px border, stone-blue top).

### Hover / press
Hover: darken or shift border toward `stone-blue`. Never translate or scale.
Press: no effect. Immediate response on click.

### Transparency / blur
Used only for overlay backdrops (`rgba(0,0,0,0.5)` for drawer backdrop). No frosted-glass, no blur chrome.

### Iconography
**Heroicons outline** is the canonical set. 1.5 stroke width. Never filled icons, never duotone. Usually `text-secondary` color. Common sizes: `w-3.5 h-3.5` (nav), `w-4 h-4` (inline), `w-5 h-5` (buttons), `w-12 h-12` (empty states).

---

## STACK CONTEXT

- **Next.js 14** (App Router) + TypeScript
- **Tailwind** with custom tokens (see `colors_and_type.css` → Tailwind mapping below)
- **shadcn/ui** as component base, heavily customized
- **Supabase** for auth + data

### Tailwind mapping
Put these in `tailwind.config.ts`:

```ts
colors: {
  'slate-tile':   '#3B5864',
  'slate-deep':   '#1A2830',
  'slate-deeper': '#132028',
  'stone-blue':   '#5B8699',
  'gulf-blue':    '#4E7A8C',
  'oceanside':    '#CBD8DB',
  'white-sand':   '#F7F5EC',
  'nw-warn':      '#C98A3B',
  'nw-success':   '#4A8A6F',
  'nw-danger':    '#B0554E',
},
fontFamily: {
  display: ['Space Grotesk', 'sans-serif'],
  sans:    ['Inter', 'sans-serif'],
  mono:    ['JetBrains Mono', 'monospace'],
},
borderRadius: { none: '0', DEFAULT: '0' },  // everything square
```

---

## NOTES

- Product app uses Heroicons outline; if Claude Code finds no icon in the page, pull from `@heroicons/react/24/outline`.
- Reference `Slate *.html` files are the source of truth for final layouts — read them before inventing new patterns.
