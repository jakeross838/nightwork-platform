# T08 — shadcn 4.x emits Tailwind v4-only syntax — fundamental incompatibility with Nightwork's Tailwind v3.4.1

**Date:** 2026-04-29
**Status:** HALT-WORTHY per nwrp12.txt directive ("Halt only if a new SPEC-violating shadcn default surfaces or a fundamental incompatibility appears").

## Summary

`npx shadcn@latest add tooltip -y` succeeded (1 file created at `src/components/ui/tooltip.tsx`) but the generated component **uses Tailwind v4-only utility syntax** that does not work in Nightwork's **Tailwind v3.4.1** toolchain. The build does NOT error (Tailwind v3 silently emits no CSS for unrecognized classes), but the components would render visually broken at runtime — no animation, no positioning, no styling.

This is a **fundamental incompatibility** per nwrp12.txt's halt condition.

## Evidence — captured tooltip.tsx output

The generated file is preserved at:
- `.planning/phases/stage-1.5a-design-system-documents/audit-notes/T08-tooltip-shadcn4-output-incompatible.tsx`

(Moved out of `src/components/ui/` so it doesn't ship as a broken primitive.)

## Tailwind v4-only syntax found in the generated tooltip

| # | Class | v4 feature | v3 equivalent (rewrite required) |
|---|---|---|---|
| 1 | `**:data-[slot=kbd]:rounded-sm` | `**:` descendant combinator (Tailwind v4) | `[&_[data-slot=kbd]]:rounded-none` (arbitrary-variant + restructure) |
| 2 | `**:data-[slot=kbd]:relative` | same | same restructure |
| 3 | `**:data-[slot=kbd]:isolate` | same | same restructure |
| 4 | `**:data-[slot=kbd]:z-50` | same | same restructure |
| 5 | `origin-(--transform-origin)` | `(--var-name)` shorthand for `var(--var-name)` (v4) | `origin-[var(--transform-origin)]` |
| 6 | `data-open:animate-in` | `data-open:` shorthand (v4 docs) | `data-[state=open]:animate-in` (v3-spelled) |
| 7 | `data-open:fade-in-0` | same | `data-[state=open]:fade-in-0` |
| 8 | `data-open:zoom-in-95` | same | `data-[state=open]:zoom-in-95` |
| 9 | `data-closed:animate-out` | same | `data-[state=closed]:animate-out` |
| 10 | `data-closed:fade-out-0` | same | `data-[state=closed]:fade-out-0` |
| 11 | `data-closed:zoom-out-95` | same | `data-[state=closed]:zoom-out-95` |
| 12 | `top-1/2!` | trailing-`!` important suffix (v4) | `!top-1/2` (v3 leading-`!` prefix) |
| 13 | `data-[side=inline-end]:top-1/2!` | same | `data-[side=inline-end]:!top-1/2` |
| 14 | `data-[side=inline-start]:top-1/2!` | same | `data-[side=inline-start]:!top-1/2` |
| 15 | `data-[side=left]:top-1/2!` | same | `data-[side=left]:!top-1/2` |
| 16 | `data-[side=right]:top-1/2!` | same | `data-[side=right]:!top-1/2` |
| 17 | `has-data-[slot=kbd]:pr-1.5` | `has-data-[…]` requires v3 `has-[[data-slot=kbd]]` form | `has-[[data-slot=kbd]]:pr-1.5` |

## A2.1 SPEC violations (independent of v4-vs-v3)

| # | Class | A2.1 violation | Required change |
|---|---|---|---|
| A | `rounded-md` (Popup) | rectangular elements must use border-radius 0 (only avatars + status dots may round) | `rounded-none` |
| B | `rounded-sm` (kbd slot) | same | `rounded-none` |
| C | `rounded-[2px]` (Arrow) | same | remove the rounded — arrow is a transformed square anyway |

## Tokens that DO work in v3 (good news)

`tailwindcss-animate@1.0.7` (now installed) DOES provide v3-spelled equivalents for most of the motion vocabulary that shadcn 4 emits:

- `animate-in`, `animate-out` — provided.
- `fade-in-0` — provided (matches `matchUtilities` against `theme("animationOpacity")` which extends `theme("opacity")` and includes `0`).
- `fade-out-0` — provided.
- `zoom-in-95`, `zoom-out-95` — provided (matches `animationScale` extending `theme("scale")` which has `95`).
- `slide-in-from-top-2`, `slide-in-from-bottom-2`, `slide-in-from-left-2`, `slide-in-from-right-2` — provided (matches `slide-in-from-{direction}` `matchUtilities` accepting Tailwind translate values like `2`).
- `slide-out-to-{direction}` likewise.
- `data-[state=delayed-open]:`, `data-[side=top]:`, etc. — v3 supports the `data-[…]:` arbitrary variant prefix.

So the rewrite scope is bounded — items 1-17 in the table above (per primitive). Estimated effort: **30-45 min per primitive** to rewrite + visual-verify in the components playground (which doesn't exist yet — Wave 4).

## Decision options for Jake

### Option 1 — Migrate Nightwork to Tailwind v4 in this phase

- Adds substantial scope to Stage 1.5a.
- Tailwind v4 changes a lot: new `@theme` directive, removed `tailwind.config.js`, new CSS-first config, new `@property` directives, etc.
- Existing 93 inline-SVG icons and 100+ existing components would all need v4-syntax compatibility audit.
- **Estimated effort: 5-10 days** of own-phase migration work.
- Pro: aligned with shadcn 4 forever.
- Con: massive scope creep on 1.5a; tooltip incompatibility is one symptom of a broader Tailwind v3→v4 migration that should be its own phase.

### Option 2 — Pin shadcn to a v3-compatible CLI version

- The legacy `shadcn-ui@0.x` CLI emits Tailwind v3 syntax. Issue: it's deprecated upstream (no new components, no Base UI integration; uses Radix UI directly).
- Locking to a deprecated tool is its own form of tech debt.
- **Estimated effort: 1-2 hr** to swap CLI + re-init.
- Pro: gets us shipping with v3 today.
- Con: locks us out of Base UI (the new shadcn primitives library) and any post-v0.x improvements.

### Option 3 — Manually rewrite each shadcn 4-generated component to Tailwind v3 + A2.1-compliant syntax

- shadcn's official posture is "code-in-repo, modify freely". Modifying generated output is intended workflow.
- Per primitive: 30-45 min using the rewrite table above.
- 6 primitives in T08 (combobox/calendar/drawer/tooltip/popover/hover-card) × 45 min = ~5 hr extra Wave 2 work.
- **Estimated effort: 5-6 hr** added to the existing T08 budget.
- Pro: keeps shadcn 4 + Base UI; no Tailwind migration; no scope creep on 1.5a.
- Con: ongoing cost — every future shadcn add or update needs the same rewrite. Could be partially scripted (sed-based codemod) if patterns hold.

### Option 4 — Skip shadcn primitive installation entirely for Wave 2

- Document the primitive gap in COMPONENTS.md; mark as "deferred — shadcn 4 + Tailwind v3 incompatibility blocks installation; revisit at Tailwind v4 migration phase".
- 1.5a still ships with PHILOSOPHY/SYSTEM/COMPONENTS docs + components playground rendering only the existing custom Nw* primitives.
- **Estimated effort: 0 (defer to its own phase)**.
- Pro: cleanest scope. 1.5a delivers what it can and clearly punts the gap.
- Con: COMPONENTS.md inventory has rows marked "TBD-after-Tailwind-v4" which is unsatisfying for the design system canonical docs.

## Recommendation (architect lens)

**Option 3** — Manual rewrite. Three reasons:

1. The rewrite mapping is mechanical — same 17 classes per file with the same target replacements. A small bash codemod handles 80% of it.
2. Stage 1.5a is the design system foundation phase. Its purpose is to lock the contract. Punting (Option 4) defeats the purpose.
3. Tailwind v4 migration (Option 1) is a Wave 3 hardening item already implicit in the tech-debt registry; doing it as a side-effect of design system docs is wrong scope coupling.

But this requires Jake's call — Option 3 adds 5-6 hr to the autonomous Wave 2 budget, and that's beyond what the executor can authorize unilaterally per nwrp12.

## What the executor did before halting

1. Part A cleanup committed at 845cd4b: SPEC v2.1 amendments, package.json reorg, globals.css Slate alias, tailwind.config.ts breakpoints + animate plugin, npm audit baseline, T07 tw-animate evaluation.
2. Attempted T08 first primitive (tooltip) via `npx shadcn@latest add tooltip -y`.
3. Inspected output → found Tailwind v4 syntax.
4. Verified `npm run build` doesn't error (silent v3 ignore of unknown classes — would render visually broken at runtime).
5. Moved the broken tooltip.tsx to audit-notes (preserves evidence; doesn't ship).
6. Wrote this incompatibility report.
7. Returning structured checkpoint to Jake per nwrp12 halt directive.

## Cross-references

- nwrp12.txt — halt directive: "fundamental incompatibility appears"
- SPEC v2.1 §C1 — `tailwindcss-animate` swap (already covered)
- SPEC v2.1 §C2 — "shadcn-generated primitives" assumes those primitives compile
- PLAN T08 — "Install missing primitives via `npx shadcn-ui@latest add` — combobox, calendar (DatePicker), drawer, tooltip, popover, hover-card."
- `node_modules/tailwindcss-animate/index.js` — verified what the v3 plugin DOES provide
- MASTER-PLAN §11 tech-debt registry — Next.js 16 migration already deferred; Tailwind v4 migration similarly should be its own phase

---

**T08 status:** HALTED. Awaiting Jake decision on Options 1-4.
