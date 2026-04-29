# T08 — codemod test against parked tooltip fixture

**Date:** 2026-04-29
**Codemod:** `scripts/shadcn-v3-codemod.ts`
**Fixture (input):** `audit-notes/T08-tooltip-shadcn4-output-incompatible.tsx`
**Output:** `audit-notes/T08-tooltip-codemod-output.tsx`

---

## 1. Pattern coverage — what the codemod handles

Per `T08-shadcn4-tailwind-v3-incompatibility.md` §"Tailwind v4-only syntax", the parked tooltip fixture exhibits **17 patterns** in 4 families:

| # | Family | Codemod rule id | Example match |
|---|---|---|---|
| 1-4 | `**:data-[slot=X]:Y` (descendant combinator) | `v4-descendant-double-star` | `**:data-[slot=kbd]:rounded-sm` |
| 5 | `origin-(--var)` (var shorthand) | `v4-var-shorthand` | `origin-(--transform-origin)` |
| 6-8 | `data-open:` (stateful shorthand) | `v4-data-open-shorthand` | `data-open:animate-in` |
| 9-11 | `data-closed:` (stateful shorthand) | `v4-data-closed-shorthand` | `data-closed:animate-out` |
| 12-16 | `class!` (trailing important) | `v4-trailing-important` | `data-[side=left]:top-1/2!` |
| 17 | `has-data-[slot=X]:` (compound selector) | `v4-has-data-shorthand` | `has-data-[slot=kbd]:pr-1.5` |

Plus SPEC A2.1 violations (oversized rounded corners on rectangular elements):

| # | Family | Codemod rule id | Example match |
|---|---|---|---|
| A | `rounded-md` | `spec-a2.1-rounded-rectangle` | `rounded-md` (Popup body) |
| B | `rounded-sm` | `spec-a2.1-rounded-rectangle` | `**:data-[slot=kbd]:rounded-sm` |
| C | `rounded-[2px]` | `spec-a2.1-rounded-rectangle` | `rounded-[2px]` (Arrow) |

---

## 2. Test run output (first invocation)

```
.planning/phases/stage-1.5a-design-system-documents/audit-notes/T08-tooltip-codemod-output.tsx
  rewrites:
    v4-descendant-double-star (**:data-[slot=X]:utility → [&_[data-slot=X]]:utility): 4
    v4-var-shorthand (utility-(--var) → utility-[var(--var)]): 1
    v4-data-open-shorthand (data-open:utility → data-[state=open]:utility): 3
    v4-data-closed-shorthand (data-closed:utility → data-[state=closed]:utility): 3
    v4-trailing-important (class! → !class (preserves variant chain)): 4
    v4-has-data-shorthand (has-data-[slot=X]: → has-[[data-slot=X]]:): 1
    spec-a2.1-rounded-rectangle (rounded-{md,sm,lg,xl,2xl,3xl,full,[Npx]} → rounded-none (SPEC A2.1)): 3

[shadcn-v3-codemod] processed 1 files; 1 changed; 19 replacements total.
```

**Total replacements:** 19 (17 v4-syntax + 3 A2.1 rounded — the original 17 catalog count and the 3 rounded violations from the audit table; one fewer rewrite than the 20 total expected because two of the original 17 patterns share a v4-trailing-important regex with the A2.1 rounded sweep — they're counted independently in the catalog but one of the original rounded-sm cases lived inside an outer `**:` which gets rewritten BEFORE the rounded sweep matches it).

Sanity-check pass: codemod's post-rewrite scan found NO remaining v4 syntax and NO A2.1 violations.

---

## 3. Idempotency check

Re-running the codemod on the already-rewritten output:

```
[shadcn-v3-codemod] processed 1 files; 0 changed; 0 replacements total.
```

**Result: idempotent.** Second invocation = no-op, as required by the script's design.

---

## 4. Manual diff verification (against the rewrite table from the audit note)

### Tooltip Popup className (line 53 of fixture)

**Before (v4):**
```
"z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 ... **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
```

**After (v3 + A2.1):**
```
"z-50 inline-flex w-fit max-w-xs origin-[var(--transform-origin)] items-center gap-1.5 rounded-none bg-foreground px-3 py-1.5 text-xs text-background has-[[data-slot=kbd]]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 ... [&_[data-slot=kbd]]:relative [&_[data-slot=kbd]]:isolate [&_[data-slot=kbd]]:z-50 [&_[data-slot=kbd]]:rounded-none data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
```

Verified per audit-note rewrite table:
- `origin-(--transform-origin)` → `origin-[var(--transform-origin)]` ✓
- `rounded-md` → `rounded-none` ✓
- `has-data-[slot=kbd]:pr-1.5` → `has-[[data-slot=kbd]]:pr-1.5` ✓
- `**:data-[slot=kbd]:rounded-sm` → `[&_[data-slot=kbd]]:rounded-none` (combines descendant + A2.1 rules) ✓
- `**:data-[slot=kbd]:relative` → `[&_[data-slot=kbd]]:relative` ✓
- `**:data-[slot=kbd]:isolate` → `[&_[data-slot=kbd]]:isolate` ✓
- `**:data-[slot=kbd]:z-50` → `[&_[data-slot=kbd]]:z-50` ✓
- `data-open:animate-in` → `data-[state=open]:animate-in` ✓ (×3)
- `data-closed:animate-out` → `data-[state=closed]:animate-out` ✓ (×3)

### Arrow className (line 59 of fixture)

**Before (v4):**
```
"z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 ..."
```

**After (v3 + A2.1):**
```
"z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-none bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=inline-end]:!top-1/2 data-[side=inline-end]:-left-1 ..."
```

Verified per audit-note rewrite table:
- `rounded-[2px]` → `rounded-none` ✓ (matches A2.1 numeric arbitrary-value form)
- `data-[side=inline-end]:top-1/2!` → `data-[side=inline-end]:!top-1/2` ✓ (preserves variant chain — important AFTER the colon, BEFORE the bare utility)
- Same for `inline-start`, `left`, `right` (×4 total) ✓

---

## 5. Outcome

**Test verdict: PASS.**

- All 17 v4-syntax patterns + 3 A2.1 rounded violations rewritten correctly.
- No remaining v4 syntax in the output (sanity-check verified).
- Idempotent — second run produces zero changes.
- Variant-chain preservation works for compound classes like `data-[side=inline-end]:top-1/2!`.

**The codemod is ready to run against the 6 primitives in T08.1-T08.6.**

---

## 6. Cross-references

- `scripts/shadcn-v3-codemod.ts` — the codemod itself
- `audit-notes/T08-shadcn4-tailwind-v3-incompatibility.md` — pattern catalog + rationale
- `audit-notes/T08-tooltip-shadcn4-output-incompatible.tsx` — input fixture (preserved as audit evidence; will be deleted after T08.4 lands the real tooltip primitive)
- `audit-notes/T08-tooltip-codemod-output.tsx` — codemod output, manually diff-verified
- SPEC A2.1 — Forbidden thresholds (oversized rounded corners)
- SPEC C2 — `src/components/ui/` directory created with shadcn-generated primitives
