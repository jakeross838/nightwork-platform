# T08 — codemod test against parked tooltip fixture (+ combobox install discoveries)

**Date:** 2026-04-29
**Codemod:** `scripts/shadcn-v3-codemod.ts`
**Fixture (input):** `audit-notes/T08-tooltip-shadcn4-output-incompatible.tsx`
**Output:** `audit-notes/T08-tooltip-codemod-output.tsx`

---

## 1. Codemod evolution — v1 vs v2

The original audit (`T08-shadcn4-tailwind-v3-incompatibility.md`) documented **17 patterns** across 4 families based on the parked tooltip fixture. v1 of the codemod handled exactly those 17 + SPEC A2.1 rounded sweep.

**v2 expansion** triggered by the combobox install (T08.1). The combobox primitive (and its auto-installed deps button, input, textarea, input-group) exposed several v4 patterns the tooltip alone didn't surface:

| New pattern | Where seen | Rule id |
|---|---|---|
| `*:data-[slot=X]:Y` (single-star — direct child) | combobox.tsx | `v4-descendant-single-star` |
| `data-WORD:` for words beyond open/closed (pressed, highlighted, empty, disabled, etc.) | combobox.tsx, button.tsx | `v4-data-bare-word` (generalized; 20 known words) |
| `has-WORD:` (CSS pseudo shorthand — `has-disabled:`, `has-checked:`, etc.) | input-group.tsx, combobox.tsx | `v4-has-bare-pseudo` (7 known) |
| `group-has-data-[slot=X]/scope:` (compound prefix) | combobox.tsx | `v4-group-has-data` |
| `not-data-[X=Y]:` (negation modifier) | combobox.tsx | `v4-not-data-shorthand` |
| `in-data-[X=Y]:` (parent-scope variant) | input-group.tsx, button.tsx | `v4-in-data-shorthand` |
| `outline-hidden` (v4 rename of `outline-none`) | combobox.tsx | `v4-outline-hidden` |
| `--spacing(N)` (v4 calc helper function) | combobox.tsx | `v4-spacing-fn` |

**Compound-variant fix** to existing rules: the left-anchor regex for `data-WORD:` and `has-WORD:` originally allowed only whitespace/quote/bracket/start-of-string boundaries. Compound chains like `dark:has-disabled:` and `not-[[…]]:data-highlighted:` have a `:` boundary on the left. v2 adds `:` to the allowed left-boundary character class so chained variants rewrite correctly.

**Critical mapping correction**: v1 mapped `data-open: → data-[state=open]:` per the original audit-note table. v2 corrects this to `data-open: → data-[open]:` per Base UI's actual emitted attributes (verified in `node_modules/@base-ui/react/tooltip/popup/TooltipPopupDataAttributes.d.ts`: Base UI tooltip uses presence-only `data-open` / `data-closed` boolean attributes, NOT `data-state="open"`). The Tailwind v4 `data-WORD:` shorthand compiles to `[data-WORD]` (presence selector) regardless of v3 spelling.

---

## 2. Final pattern catalog (12 rule families, after v2 expansion)

### v4-only utility syntax → v3 equivalents

| # | Rule id | v4 form | v3 rewrite |
|---|---|---|---|
| 1 | `v4-descendant-double-star` | `**:data-[slot=X]:Y` | `[&_[data-slot=X]]:Y` (deep descendant) |
| 2 | `v4-descendant-single-star` | `*:data-[slot=X]:Y` | `[&>[data-slot=X]]:Y` (direct child) |
| 3 | `v4-var-shorthand` | `utility-(--var)` | `utility-[var(--var)]` |
| 4 | `v4-data-bare-word` | `data-WORD:Y` (20 known words) | `data-[WORD]:Y` |
| 5 | `v4-trailing-important` | `class!` | `!class` (preserves variant chain) |
| 6 | `v4-has-data-shorthand` | `has-data-[slot=X]:Y` | `has-[[data-slot=X]]:Y` |
| 7 | `v4-has-bare-pseudo` | `has-WORD:Y` (7 known pseudos) | `has-[:WORD]:Y` |
| 8 | `v4-group-has-data` | `group-has-data-[slot=X]/scope:Y` | `group-has-[[data-slot=X]]/scope:Y` |
| 9 | `v4-not-data-shorthand` | `not-data-[X=Y]:Z` | `not-[[data-X=Y]]:Z` |
| 9b | `v4-in-data-shorthand` | `in-data-[X=Y]:Z` | `[[data-X=Y]_&]:Z` (parent-scope) |
| 10 | `v4-outline-hidden` | `outline-hidden` | `outline-none` |
| 11 | `v4-spacing-fn` | `--spacing(N)` | `calc(0.25rem * N)` |

### SPEC A2.1 (Forbidden — oversized rounded corners)

| # | Rule id | Source | Rewrite |
|---|---|---|---|
| 12 | `spec-a2.1-rounded-rectangle` | `rounded-{md,sm,lg,xl,2xl,3xl,full,[Npx]}` (where N≥1) | `rounded-none` |

---

## 3. Test run output — parked tooltip fixture (v2 codemod)

```
.planning/phases/stage-1.5a-design-system-documents/audit-notes/T08-tooltip-codemod-output.tsx
  rewrites:
    v4-descendant-double-star: 4
    v4-var-shorthand: 1
    v4-data-bare-word: 6
    v4-trailing-important: 4
    v4-has-data-shorthand: 1
    spec-a2.1-rounded-rectangle: 3

[shadcn-v3-codemod] processed 1 files; 1 changed; 19 replacements total.
```

**Sanity check:** No remaining v4 syntax. Exit code 0.

The 19 replacements break down as:
- 4× deep-descendant rewrites (`**:data-[slot=kbd]:`)
- 1× var shorthand (`origin-(--transform-origin)`)
- 6× bare-word data (3× `data-open:` + 3× `data-closed:`)
- 4× trailing-important (`top-1/2!` × 4 across 4 sides)
- 1× has-data (`has-data-[slot=kbd]:pr-1.5`)
- 3× SPEC A2.1 rounded (`rounded-md` Popup body + `rounded-sm` kbd slot + `rounded-[2px]` Arrow)

---

## 4. Test run output — full src/components/ui/ on first install (combobox + auto-deps)

```
src/components/ui/textarea.tsx: 1 replacement (rounded sweep)
src/components/ui/input.tsx: 1 replacement (rounded sweep)
src/components/ui/input-group.tsx: 6 replacements (3× has-WORD, 2× in-data, 1× rounded)
src/components/ui/combobox.tsx: 41 replacements (6× *:descendant, 5× var-shorthand,
  13× data-WORD, 2× has-data, 3× has-WORD, 1× group-has-data, 1× not-data,
  1× outline-hidden, 5× --spacing(), 4× rounded)
src/components/ui/button.tsx: 9 replacements (4× in-data, 5× rounded)

Total: 58 replacements across 5 files. Sanity check: PASS.
```

---

## 5. Idempotency check

Re-running the codemod on already-rewritten output:

```
[shadcn-v3-codemod] processed 1 files; 0 changed; 0 replacements total.
```

(Same result for full primitive set: `processed 5 files; 0 changed`.)

**Idempotent. Verified.**

---

## 6. Build verification

`npm run build` after the codemod ran cleanly on combobox + auto-deps: zero errors, all routes compiled. The Tailwind utilities now resolve to v3-valid CSS at build time.

---

## 7. Cross-references

- `scripts/shadcn-v3-codemod.ts` — the codemod (v2)
- `audit-notes/T08-shadcn4-tailwind-v3-incompatibility.md` — original 17-pattern audit (still accurate; v2 just adds discovered patterns)
- `audit-notes/T08-tooltip-shadcn4-output-incompatible.tsx` — input fixture (will be deleted post-T08.4 when real tooltip primitive lands)
- `audit-notes/T08-tooltip-codemod-output.tsx` — verified output
- `node_modules/@base-ui/react/*/DataAttributes.d.ts` — Base UI's actual emitted data attributes (used to correct the v1 audit-note mapping)
- SPEC A2.1 — Forbidden thresholds (oversized rounded corners)
- SPEC C2 — `src/components/ui/` directory created with shadcn-generated primitives
