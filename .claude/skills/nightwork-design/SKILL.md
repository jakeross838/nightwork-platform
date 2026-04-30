---
name: nightwork-design
description: Use this skill to generate well-branded interfaces and assets for Nightwork — construction financial software for custom home builders. Use when designing or implementing any UI for the Nightwork product, marketing site, or owner portal. Contains the Slate palette, type system, component patterns, reference screens, and stack conventions (Next.js 14 + Tailwind + shadcn/ui).
user-invocable: true
---

# Nightwork design skill

Serious construction financial software for custom home builders ($1.5M–$10M+ projects). Think Linear, Vercel, Stripe dashboard — not flashy, not playful. Mobile-responsive is critical (PMs use it on phones in the field).

## Authoritative documents (Stage 1.5a — locked)

The Stage 1.5a design system documents are now the SINGLE SOURCE OF TRUTH. When this skill conflicts with any of them, the documents win. Read these before opening this skill's `README.md`:

- **`.planning/design/SYSTEM.md`** — token catalog (colors, type, spacing, radii, shadows, motion, density, touch targets, accessibility, brand-customization). Every CSS var + every Tailwind utility lives here.
- **`.planning/design/COMPONENTS.md`** — component contract (every primitive: Button, Input, Combobox, DataGrid, etc. with variants / states / token bindings / a11y notes / anti-patterns). Includes the tenant-blind primitives rule (A12.1) and the Icon Library Boundary (A12.2: Heroicons-only outside `src/components/ui/`).
- **`.planning/design/PATTERNS.md`** — page patterns catalogue (12 patterns: Document Review = gold standard, Dashboard, Settings, List+Detail, Wizard, Empty Workspace, Print View, Mobile Approval, Reconciliation with 4 candidate models, AppShell, Audit Timeline, File Uploader). Each entry: when to use / when NOT, regions, data shape, states, references.
- **`.planning/design/PROPAGATION-RULES.md`** — workflow rules for changing the system (token-add, component-add, pattern-add, icon-add, versioning posture, shadcn-hybrid boundary).
- **`.impeccable.md`** (root) — quality contract that anchors `frontend-design` + `impeccable` skills to the documents above.
- **`.planning/design/PHILOSOPHY.md`** — 3 candidate directions (Helm + Brass / Specimen / Site Office) with concrete invoice-review + dashboard + mobile-approval renders. Locked DRAFT until Strategic Checkpoint #2 — Jake picks one direction at CP2 via the playground at `/design-system/philosophy` and the choice is written to `.planning/design/CHOSEN-DIRECTION.md`.
- **`.planning/design/CONTRAST-MATRIX.md`** — full WCAG 2.2 AA contrast matrix for every text-token × bg-token in light + dark, both candidate palettes.

**SYSTEM.md's "Skill anchor" section** lists this skill (and `nightwork-design-tokens`, `nightwork-ui-template`, `nightwork-design-system-reviewer`, `nightwork-ui-reviewer`) as dependents — when SYSTEM tokens change, those skills update too. Bidirectional cross-reference per SPEC A19.1.

**The components playground at `/design-system`** (gated to platform_admin in production via middleware) renders every COMPONENTS.md entry live. Use it as the visual reference when this skill's text isn't enough.

**When this skill is invoked, read `README.md` first.** It contains the full palette, type system, content rules, and visual foundations. The `Slate *.html` files at the root are the reference screens — open them to see any pattern in context before inventing new ones.

## Quick orientation

- **Product**: Nightwork — job-cost accounting, AIA draws, invoice parsing for custom home builders.
- **Tagline**: "Nightwork makes building lightwork." Use sparingly.
- **Voice**: Confident, professional, builder-peer. No emoji, no "AI sparkle."
- **Stack**: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase.

## Slate palette (final, final)

- **Page** `#F7F5EC` (white-sand — NEVER pure white)
- **Primary text** `#3B5864` (slate-tile — NEVER black)
- **Nav / primary button** `#1A2830` (slate-deep)
- **Accent / secondary button / progress** `#5B8699` (stone-blue)
- **Links / hover** `#4E7A8C` (gulf-blue)
- **Warnings** `#C98A3B` · **Success** `#4A8A6F` · **Danger** `#B0554E`

Full tokens in `colors_and_type.css`. Tailwind mapping in `README.md`.

## Type (three families, no substitutions)

- **Space Grotesk** — headlines (weights 400/500 only, `-0.02em` tracking)
- **Inter** — body, nav, forms (14–15px, not 16)
- **JetBrains Mono** — eyebrows, money, labels, audit trails (10–11px, `0.14em` UPPERCASE)

Money: always JetBrains Mono + `font-variant-numeric: tabular-nums`.

## Non-negotiable visual rules

1. **Everything is square.** Zero border-radius except avatars and status dots.
2. **Page is sand, not white.** Cards are white on sand.
3. **No gradients as backgrounds.** Only the 1px beam accent beside the wordmark.
4. **Borders are thin slate** (`rgba(59,88,100,0.15)`), not gray.
5. **Shadows are rare.** Hover lift only on interactive cards.
6. **Eyebrow everywhere** — JetBrains Mono 10px UPPERCASE above every section.
7. **Status pills are bordered, never filled.**
8. **No emoji in UI.** Only `⚠`/`ℹ` in warning strips.

## When building

- **For production code**: lift tokens from `colors_and_type.css` into `globals.css` and the Tailwind config in `README.md`. Use Heroicons outline (stroke 1.5). Reference the `Slate *.html` files for exact layouts.
- **For mockups / prototypes / slides**: copy assets out, write static HTML, use the fonts via Google Fonts imports from `colors_and_type.css`.
- **For a new screen**: first find the nearest `Slate *.html` and match its pattern — dashboard density, wizard step chrome, detail + sticky rail, mobile card stack, etc.

If the user invokes this skill without guidance, ask what they're building, ask 2–3 clarifying questions about audience + density + device, then produce HTML or code accordingly.
