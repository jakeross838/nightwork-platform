# T34 — Keyboard navigation spot-check plan

**Date:** 2026-04-30
**Wave:** D verification (Stage 1.5a-design-system-documents)
**SPEC criterion:** D6 — keyboard accessibility for the 3 most-complex components
**Plan task:** T34 — keyboard nav spot-check before CP2 walkthrough

This document is a **plan**, not a runtime test. Jake executes this checklist
during the CP2 walkthrough on the Vercel preview URL. Agent-context cannot
drive Chrome from inside this run; the underlying primitives (Base UI,
react-day-picker, Vaul) handle keyboard a11y at the library level — this
checklist verifies the integration didn't regress.

## Why these three

Per SPEC D6, the spot-check focuses on Combobox, DatePicker, and Drawer
because they each compose a popover + custom-keyboard-handling surface.
These are the components where regression is most likely if shadcn primitives
were rewritten incorrectly during the codemod.

## Test environment

- Vercel preview URL `/design-system/components/inputs` (Combobox, DatePicker)
- Vercel preview URL `/design-system/components/overlays` (Drawer)
- Browser: Chrome latest (Jake's CP2 environment)
- Authenticated as: `platform_admin` (per middleware gate)
- Display modes to verify: light + dark (toggle via `?theme=dark` query string
  or the design-system header toggle if present)

## Component 1 — Combobox (`/design-system/components/inputs`)

**Library:** `@base-ui/react/combobox` (per COMPONENTS.md §1.4)

**Expected keyboard contract** (from COMPONENTS.md §1.4 A11y row):

| Key | Expected behavior |
|---|---|
| `Tab` | Focus the Combobox input |
| Type a letter | Filter list shows matching items |
| `↓` (Arrow Down) | Move highlight to next item; opens popup if closed |
| `↑` (Arrow Up) | Move highlight to previous item |
| `Home` | Jump to first item (per ARIA listbox spec) |
| `End` | Jump to last item |
| `Enter` | Select highlighted item, close popup |
| `Escape` | Close popup without selecting |
| `Tab` (while open) | Move focus OUT of popup (default Base UI behavior) |

**Acceptance criteria:**
- All keys above produce the expected behavior on the live preview
- `aria-expanded` toggles between `true`/`false` when popup opens/closes
- `aria-activedescendant` updates as ↑/↓ moves highlight
- Focus ring is visible (`--ring` token) on input + highlighted item
- ZERO console errors during interaction

**Failure modes to watch for:**
- Tab while open captures focus inside popup (Base UI default is OUT) — REGRESSION
- Esc doesn't close popup — REGRESSION
- Type-ahead doesn't filter — possible cmdk-vs-Base-UI issue (T20a flagged)

## Component 2 — DatePicker (`/design-system/components/inputs`)

**Library:** `react-day-picker@^9.14.0` (per COMPONENTS.md §1.5)

**Expected keyboard contract** (from COMPONENTS.md §1.5 A11y row):

| Key | Expected behavior |
|---|---|
| `Tab` | Move focus to the trigger button |
| `Enter` / `Space` on trigger | Open Popover with Calendar grid |
| `Tab` (inside grid) | Move to grid (DayPicker auto-focus on open) |
| `←` / `→` | Move 1 day prev/next |
| `↑` / `↓` | Move 1 week prev/next |
| `PageUp` / `PageDown` | Move 1 month prev/next |
| `Home` / `End` | Jump to start/end of week |
| `Enter` | Select highlighted day; closes Popover |
| `Escape` | Close Popover without selecting |

**Acceptance criteria:**
- Calendar grid emits `role="grid"` with `aria-label="<Month Year>"`
- Each day cell is `role="gridcell"`
- All key bindings produce the expected behavior
- Focus visibly moves between cells (yellow/stone-blue focus ring)
- ZERO console errors during interaction

**Failure modes to watch for:**
- Arrow keys scroll the page instead of moving day focus — DayPicker
  preventDefault regression
- Escape doesn't close Popover — Popover trigger / DayPicker focus trap
  conflict
- PageUp/PageDown not bound — react-day-picker v9 → v8 regression

## Component 3 — Drawer (`/design-system/components/overlays`)

**Library:** `vaul@^1.1.2` (per COMPONENTS.md §2.3)

**Expected keyboard contract** (from COMPONENTS.md §2.3 A11y row):

| Key | Expected behavior |
|---|---|
| `Tab` (page) | Focus the trigger button that opens the drawer |
| `Enter` / `Space` on trigger | Open Drawer (slide-in animation) |
| `Tab` (drawer open) | Cycle focus between focusable elements WITHIN drawer (focus trap) |
| `Shift+Tab` (drawer open) | Cycle focus reverse |
| `Escape` | Close Drawer (slide-out animation) |
| `Tab` (drawer closed) | Return to trigger button |

**Acceptance criteria:**
- Drawer container has `role="dialog"` + `aria-modal="true"` while open
- Focus is TRAPPED inside the Drawer (Tab cycles within, never out)
- `aria-labelledby` points to the DrawerTitle
- Esc fires onOpenChange(false), drawer slides out
- The bottom-direction drawer shows the handle indicator (small horizontal
  bar at top — signals draggability)
- ZERO console errors during interaction

**Failure modes to watch for:**
- Tab escapes the focus trap — Vaul focus-trap regression
- Esc doesn't fire onOpenChange — controlled-state wiring issue
- Reduced-motion preference not honored (drawer slides aggressively) —
  Vaul reduced-motion fallback regression

## Walkthrough sequence (~5 min total)

1. Open `/design-system/components/inputs` on the Vercel preview URL.
2. Tab to Combobox input. Run all 9 key tests.
3. Tab to DatePicker trigger. Run all 9 key tests.
4. Open `/design-system/components/overlays`.
5. Tab to Drawer trigger. Run all 6 key tests.
6. Repeat steps 2-5 in dark mode.
7. Note any failures or unexpected behavior in the CP2 walkthrough log.

## Out of scope

This is a SPOT-CHECK, not a comprehensive a11y audit. Full WCAG 2.2 AA
verification is T33 (axe-core) — see `T33-axe-DEFERRED.md` for that scope.
Visual focus-ring rendering is verified separately in T32 (visual regression).

## Cross-references

- `.planning/design/COMPONENTS.md` — §1.4 (Combobox), §1.5 (DatePicker),
  §2.3 (Drawer) — A11y row in each table is the contract
- SPEC D6 (keyboard nav verification) and SPEC C8 (a11y posture)
- `src/components/ui/combobox.tsx`, `src/components/ui/calendar.tsx`,
  `src/components/ui/drawer.tsx` — codemod-rewritten implementations
