---
name: nightwork-design-tokens
description: Use this skill on every styling change in Nightwork — adding components, editing components, theming, dark-mode work, charts, layouts, or anything that touches color/spacing/typography/border. Enforces design tokens everywhere; rejects hardcoded colors, spacing, font-family, font-size declarations. Hooks fire on .ts/.tsx/.css edits to enforce. Pairs with the `post-edit` hook to BLOCK saves that introduce hardcoded values.
---

# Nightwork design tokens — enforcement skill

The design system is only as strong as the weakest hardcoded value. This skill documents the canonical token set, the rules for using them, and the violations that cause hooks/agents to reject the edit.

## Token sources of truth

- **CSS variables:** `src/app/globals.css` (`--bg-card`, `--bg-subtle`, `--text-primary`, `--text-secondary`, `--border-default`, `--nw-stone-blue`, etc.)
- **Tailwind config:** `tailwind.config.ts` — extends `nw-*` color utilities (`nw-stone-blue`, `nw-slate-tile`, `nw-slate-deep`, etc.)
- **Design skill:** `.claude/skills/nightwork-design/` — palette intent, type system, content rules.

When in doubt, READ those three before guessing. Do not invent new token names; do not import a new color library.

## Allowed shapes

| Need                   | Allowed                                                                                                                                   |
|------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| Background color       | `bg-[var(--bg-card)]`, `bg-[var(--bg-subtle)]`, `bg-nw-page`, `bg-nw-stone-blue`                                                          |
| Text color             | `text-[color:var(--text-primary)]`, `text-[color:var(--text-secondary)]`, `text-nw-slate-tile`                                            |
| Border                 | `border-[var(--border-default)]`, `border-[var(--border-subtle)]`, `border-nw-stone-blue`                                                 |
| Accent / primary       | `bg-[var(--nw-stone-blue)]`, `text-[color:var(--nw-stone-blue)]`, `ring-[var(--nw-stone-blue)]`                                           |
| Spacing                | Tailwind scale only (`p-2`, `gap-5`, `mt-8`) — no arbitrary `p-[13px]`                                                                    |
| Typography family      | `font-display` (Space Grotesk), `font-sans` (Inter), `font-mono` (JetBrains Mono) — defined in tailwind.config                            |
| Typography size        | Tailwind scale (`text-sm`, `text-base`, `text-xs`) — no arbitrary `text-[13.5px]`                                                         |
| Money                  | `formatCents()` / `formatDollars()` from `src/lib/utils/format.ts` — never raw `${(n/100).toFixed(2)}`                                     |
| Status pills           | `formatStatus()` + `statusBadgeOutline()` from `src/lib/utils/format.ts`                                                                  |
| Eyebrows               | `<NwEyebrow>` from `src/components/nw/Eyebrow.tsx` — never inline `text-xs uppercase tracking-widest`                                     |
| Buttons                | `<NwButton>` from `src/components/nw/Button.tsx` — never raw styled `<button>`                                                            |

## Hard rejections

The post-edit hook + `nightwork-design-system-reviewer` reject ALL of the following:

1. **Hex colors.** `#1A2830`, `#5b8699`, `#ffffff`, `rgb(91,134,153)`, `hsl(...)`, `rgba(...)` — anywhere in `.tsx` / `.css` / `.ts` style strings.
2. **Tailwind named colors.** `bg-blue-500`, `text-gray-700`, `border-slate-200`, `bg-white`, `text-black` — Nightwork removed these in Phase E. Use Slate tokens.
3. **Legacy namespaces.** `cream-*`, `teal-*`, `brass-*`, `brand-*`, `status-*`, `nightwork-*` (without the `nw-` prefix) — removed in Phase E and must not return.
4. **Hardcoded font-family.** `font-family: 'Inter'` in inline styles or CSS — use `font-sans` Tailwind utility.
5. **Hardcoded pixel typography.** `text-[14px]`, `font-size: 14px;` — use Tailwind scale.
6. **Inline color hex via style prop.** `<div style={{ color: '#3B5864' }}>` — use Tailwind / CSS var utility.
7. **Custom status pill.** `<span className="px-2 py-1 bg-yellow-100 ...">Pending</span>` — use the canonical helpers.
8. **Direct money formatting.** `${invoice.total / 100}.toFixed(2)` — use `formatCents(invoice.total)`.

## Allowed exceptions

- **Brand-prepared SVG/asset files** in `public/brand/` — those are the source assets and ship as-is.
- **Tailwind config + globals.css** — these DEFINE the tokens; they may have raw hex.
- **Test fixtures and storybook files** — when a fixture explicitly demonstrates a hex/legacy value to test the rejection path. Mark the file `// allow-design-tokens-exception: <reason>` at the top.

## Self-check protocol

Before saving a styling edit:

1. Did you change a color? Confirm it's a CSS var or `nw-*` utility.
2. Did you change typography? Confirm `font-display/sans/mono` + Tailwind scale.
3. Did you create a status pill? Confirm `formatStatus` + `statusBadgeOutline`.
4. Did you format money? Confirm `formatCents` / `formatDollars`.
5. Did you add a `style={{}}` prop with color/spacing? Strongly prefer Tailwind utility.

## Cross-references

- `nightwork-design` skill — palette intent, why these specific colors.
- `nightwork-ui-template` skill — uses these tokens by default.
- `nightwork-design-system-reviewer` agent — runs in `/nightwork-qa` and `/nightwork-design-check` to enforce.
- `nightwork-design-pushback-agent` agent — pushes back on plans that propose new tokens or override existing ones.
- Post-edit hook in `.claude/hooks/post-edit-design-tokens.sh` — fires on `.tsx`/`.css` edits and BLOCKS on rejection patterns.
