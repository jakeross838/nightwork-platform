# Spec — stage-1.5a-design-system-documents

**Status:** LOCKED 2026-04-29
**Phase:** Stage 1.5a (per MASTER-PLAN.md §12, D-009)
**Dependencies:** EXPANDED-SCOPE.md APPROVED, SETUP-COMPLETE.md exists, DISCUSSION.md resolved

This spec is the contract between PLAN.md (what gets built) and the verifier (`nightwork-spec-checker` at `/nightwork-qa` time). Every acceptance criterion is falsifiable. Per D-015 — acceptance criteria are required.

---

## 1. Goal

Lock the Nightwork design system as a set of canonical documents + a live components playground, so every UI built from Stage 1.5b onward has a single source of truth for tokens, components, patterns, and philosophy. Three distinct PHILOSOPHY directions are presented at Strategic Checkpoint #2 for Jake to choose from; the chosen direction guides every subsequent UI phase.

---

## 2. Deliverables

| # | Deliverable | Path | Status target |
|---|---|---|---|
| 1 | PHILOSOPHY.md (3 distinct directions) | `.planning/design/PHILOSOPHY.md` | NEW |
| 2 | SYSTEM.md (tokens, type, motion, layout, density, accessibility) | `.planning/design/SYSTEM.md` | NEW |
| 3 | COMPONENTS.md (inventory mapped to shadcn / TanStack / custom) | `.planning/design/COMPONENTS.md` | NEW |
| 4 | PATTERNS.md (9 patterns + AppShell) | `.planning/design/PATTERNS.md` | NEW |
| 5 | PROPAGATION-RULES.md (token-add, component-add, pattern-add workflows) | `.planning/design/PROPAGATION-RULES.md` | NEW |
| 6 | `.impeccable.md` (frontend-design + impeccable skill anchor) | `.impeccable.md` (root) | NEW |
| 7 | Components playground (live render of every COMPONENTS.md entry) | `src/app/design-system/` (Next.js App Router) | NEW |
| 8 | shadcn primitives installed (cmdk, react-day-picker, vaul, Radix Popover/Tooltip, class-variance-authority, tailwind-merge, @heroicons/react, @tanstack/react-table) | `package.json` + `src/components/ui/` (shadcn output) | NEW |
| 9 | CLAUDE.md "UI rules" section updated to defer to SYSTEM.md | `CLAUDE.md` | UPDATE |
| 10 | Existing skills (`nightwork-design`, `nightwork-design-tokens`, `nightwork-ui-template`) cross-reference new docs | `.claude/skills/nightwork-*` | UPDATE |

---

## 3. Acceptance criteria (falsifiable)

### Group A — Documents content

- [ ] **A1.** `.planning/design/PHILOSOPHY.md` presents exactly 3 directions, each with: name (short, evocative, distinct enough that no two names feel similar — Jake's hard requirement), 2-3 paragraph thesis, "what this WOULD look like" + "what this WOULDN'T look like" lists, and **concrete side-by-side comparisons of how invoice review / dashboard / mobile approval pages would render in each direction** (per Jake's hard addition in nwrp10.txt). No abstract aesthetic descriptions without screen-level concrete examples.
- [ ] **A2.** PHILOSOPHY.md "Forbidden" section lifts Jake's "things I never want to see again" list verbatim (bouncy easing, generic gradients, purple/pink accents, dark glows, oversized rounded corners, marketing-page typography on internal screens, phone-app-trying-to-be-desktop, desktop-trying-to-be-phone-app). SYSTEM.md cross-references with quantified violation thresholds (e.g., `border-radius > 4px = oversized`, `cubic-bezier(.x, y > 1.0) = bouncy`).
- [ ] **A3.** `.planning/design/SYSTEM.md` enumerates every CSS variable token currently in `colors_and_type.css` with: light value, dark value, contrast ratio against page bg + against card bg + against text-primary (where applicable), token name in CSS + in Tailwind utilities. Both candidate palette sets (Q1=C — Jake's brief `#6B8EA3` set vs existing `#5B8699` set) listed for visual pick at CP2.
- [ ] **A4.** SYSTEM.md typography section reflects Q2=B exactly: Space Grotesk (display, weights 400/500, `-0.02em` tracking), Inter (body, 14-15px), JetBrains Mono (eyebrows/money, 10-11px UPPERCASE, `0.14em` tracking, `font-variant-numeric: tabular-nums` for money). No Calibri references. Type scale enumerated.
- [ ] **A5.** SYSTEM.md spacing uses Tailwind default scale only (no arbitrary `[13px]`); border-radius is 0 except avatars + status dots; shadows are minimal (hover-lift only on interactive cards).
- [ ] **A6.** SYSTEM.md motion section defines easing curves (no bouncy / no elastic — explicitly forbidden), durations, supported transitions. CSS-only (per Q5=A); Framer Motion explicitly out of scope.
- [ ] **A7.** SYSTEM.md layout grid: 12-col desktop, 4-col mobile. Breakpoints named `nw-phone (0-480) / nw-tablet (481-1023) / nw-desktop (1024+) / nw-print TBD` (per Q4=B), maps to Tailwind defaults.
- [ ] **A8.** SYSTEM.md density: `--density-compact` and `--density-comfortable` tokens defined with explicit row-height + padding values (per Q7=B). Components accept a `density` prop.
- [ ] **A9.** SYSTEM.md touch targets: 44×44px minimum, 56×56px for high-stakes actions. "High-stakes" defined as: any action that mutates state irreversibly, transitions a workflow, or moves money (approve/reject/void/submit/delete) (per Q10=A).
- [ ] **A10.** SYSTEM.md accessibility: WCAG 2.2 AA mandatory; per-token contrast ratios listed; focus-visible standard specified (per Q9=B).
- [ ] **A11.** SYSTEM.md tenant brand customization: only `--brand-accent` and `--brand-logo` are tenant-customizable in v1; everything else (palette structure, typography, spacing, motion) is locked Nightwork (per Q14 modified-A). The token architecture explicitly reserves `--brand-accent` as overrideable while structural tokens (`--bg-page`, `--text-primary`, etc.) are not.
- [ ] **A12.** `.planning/design/COMPONENTS.md` inventory has every component from Jake's list (Button, Input, Select, Combobox, DatePicker, Table, DataGrid, Card, Modal, Drawer, Sheet, Tabs, Toast, Banner, Empty State, Loading State, Error State, Skeleton, Tooltip, Popover, Form) plus 3-5 implicit extensions (FileDropzone, ConfidenceBadge, NwEyebrow, NwButton existing-codification, AppShell). Columns: Component | Source (custom/shadcn/tanstack) | Variants | Required props | Token bindings | Snapshot states (default/hover/focus/disabled/loading/error) | Accessibility notes | Mobile behavior | Anti-patterns.
- [ ] **A13.** COMPONENTS.md DataGrid entry uses TanStack Table v8 (per Q8=A); Combobox uses cmdk; DatePicker uses react-day-picker; Drawer uses Vaul; Tooltip + Popover use Radix.
- [ ] **A14.** `.planning/design/PATTERNS.md` has all 9 patterns Jake named: Document Review, Dashboard, Settings, List+Detail, Wizard, Empty Workspace, Print View, Mobile Approval, Reconciliation. Plus implicit AppShell pattern. Each entry: when to use / when NOT, required regions + responsive behavior, data shape contract, example states, reference implementation (if exists), print behavior, mobile behavior.
- [ ] **A15.** PATTERNS.md "Document Review" entry treats `src/app/invoices/[id]/page.tsx` as the reference implementation. Lifts the existing `nightwork-ui-template` skill's contract verbatim and elaborates with explicit data-shape + example-state details.
- [ ] **A16.** PATTERNS.md "Reconciliation" defines required regions (header, left rail, right rail, center, bottom, audit timeline), data shape contract, 3 candidate visualization models (side-by-side delta / inline diff / timeline overlay) with no model picked yet — 1.5b mock-up will pick (per D5 + Q12=B).
- [ ] **A17.** PATTERNS.md "Print View" specifies AIA G702/G703 print layout; how `print:` Tailwind utilities are applied; static-block fallback in print stylesheet for layouts browsers don't render at runtime; orientation; margin standards; page-break behavior.
- [ ] **A18.** PATTERNS.md "Mobile Approval" specifies touch targets (per A9), gesture vocabulary (no swipe-to-approve in v1 — taps only — but the pattern documents the decision), file-preview-on-mobile interaction (pinch-zoom, pan), approve/reject/kickback CTA prominence on small viewport.
- [ ] **A19.** `.planning/design/PROPAGATION-RULES.md` covers: when to add a token vs reuse, when token change is "everywhere" (route through `/nightwork-propagate`), component-add workflow (COMPONENTS.md → playground → first usage → enforcement hook), pattern-add workflow (PATTERNS.md → first surface → second surface validates contract), versioning posture (1.5a is v1.0).
- [ ] **A20.** `.impeccable.md` (root) anchors `frontend-design` + `impeccable` skills to SYSTEM.md, COMPONENTS.md, PATTERNS.md, the chosen philosophy direction (placeholder until CP2 picks), the "Forbidden" list, and the reference benchmarks (Procore, Linear, Stripe Dashboard).

### Group B — Components playground

- [ ] **B1.** `src/app/design-system/page.tsx` exists as a Next.js App Router page that lists every component in COMPONENTS.md as a navigable index.
- [ ] **B2.** Each component has a sub-page (`src/app/design-system/components/[component-name]/page.tsx`) rendering: variants (one card per variant), states (default/hover/focus/disabled/loading/error/empty), token bindings (which CSS variables apply), sample data, accessibility notes (ARIA, keyboard support), anti-pattern examples (don't-do-this).
- [ ] **B3.** A `/design-system/palette` page renders Q1's two candidate palette sets side-by-side: (a) Jake's brief values (`#6B8EA3 / #2D3E4A / #8A8A8A`), (b) existing skill values (`#5B8699 / #1A2830 / #3B5864 / #F7F5EC`). Both displayed as full color cards with hex labels and contrast ratios. Visual pick happens at CP2.
- [ ] **B4.** A `/design-system/typography` page renders the Slate type system (Space Grotesk + Inter + JetBrains Mono) at every defined size, weight, and tracking. Includes a `tabular-nums` money sample.
- [ ] **B5.** A `/design-system/patterns` page lists every pattern from PATTERNS.md with a 1-paragraph description + a link to the canonical implementation (where applicable). The Reconciliation pattern shows all 3 candidate visualization models as static layouts (no real data).
- [ ] **B6.** A `/design-system/forbidden` page lifts the "Forbidden" list and shows visual examples of what NOT to do for each (oversized rounded corners with arrow + "DO NOT", etc.).
- [ ] **B7.** Playground access gated to `platform_admin` role in production (404 for non-admin per D3); accessible to all authenticated users in development.
- [ ] **B8.** Playground renders correctly in both light and dark mode (Q3=A); includes a mode toggle.
- [ ] **B9.** Playground responsive — renders correctly at `nw-phone`, `nw-tablet`, `nw-desktop` breakpoints.

### Group C — Dependencies + integration

- [ ] **C1.** `package.json` adds: `@radix-ui/react-popover`, `@radix-ui/react-tooltip`, `cmdk`, `react-day-picker`, `vaul`, `class-variance-authority`, `tailwind-merge`, `@heroicons/react`, `@tanstack/react-table`. Existing custom components (NwButton, NwEyebrow, NwInput) NOT migrated to shadcn (per D1=C).
- [ ] **C2.** `src/components/ui/` directory created with shadcn-generated primitives (Combobox, DatePicker, Drawer, Tooltip, Popover) per `npx shadcn-ui@latest add`.
- [ ] **C3.** CLAUDE.md "UI rules" section updated: SYSTEM.md is the single source of truth for tokens; CLAUDE.md links to it for reference. The Calibri correction stands.
- [ ] **C4.** Existing `nightwork-design` skill cross-references SYSTEM.md as authoritative; same for `nightwork-design-tokens` and `nightwork-ui-template`. The skills become subordinate (cross-reference) to the new documents.
- [ ] **C5.** Post-edit token enforcement hook (`.claude/hooks/nightwork-post-edit.sh`) updated to recognize new shadcn primitive paths (`src/components/ui/`) and apply token enforcement there too.

### Group D — Quality gates

- [ ] **D1.** `npm run build` passes with zero errors (Next.js production build).
- [ ] **D2.** `npx tsc --noEmit` passes (TypeScript strict mode, no `any`).
- [ ] **D3.** `npx eslint src/app/design-system` passes with zero errors.
- [ ] **D4.** Visual regression: each component sub-page screenshot captured via Chrome DevTools MCP at `nw-phone`, `nw-tablet`, `nw-desktop` breakpoints in both light + dark mode (12 screenshots per component minimum). Screenshots inline in the conversation, not persisted.
- [ ] **D5.** No hardcoded hex colors outside `colors_and_type.css` and `tailwind.config.ts` (post-edit hook enforces). No Tailwind named colors (`bg-blue-500` etc). No legacy namespaces (`cream-*`, `teal-*`, `brass-*`, etc.).
- [ ] **D6.** Accessibility audit: every component sub-page passes axe-core automated checks at WCAG 2.2 AA (per Q9=B). Manual keyboard-navigation spot-check on Combobox, DatePicker, Drawer (interactive components).
- [ ] **D7.** No prototypes — verify scope discipline. Drummond data does NOT appear in `/design-system` (sample data only). Jake's stated scope explicitly forbids prototypes in 1.5a.
- [ ] **D8.** `nightwork-design-system-reviewer` agent passes on the playground (when invoked via `/nightwork-design-check`).

### Group E — Strategic Checkpoint #2 readiness

- [ ] **E1.** Vercel preview deploy URL accessible and `/design-system` renders all sub-pages.
- [ ] **E2.** PHILOSOPHY.md's 3 directions are visible at `/design-system/philosophy` (or similar); Jake can scroll through the side-by-side screen comparisons in browser.
- [ ] **E3.** Q1 palette comparison (`/design-system/palette`) is rendered for visual pick.
- [ ] **E4.** A "Strategic Checkpoint #2 — pick a direction" affordance on the philosophy page (a button or section) makes the choice mechanism explicit. After Jake picks, the implementing direction gets locked into PHILOSOPHY.md and the "Forbidden" / "What this WOULD look like" lists become canonical.
- [ ] **E5.** PHILOSOPHY.md ends with a "Locked direction" section (initially blank, populated post-CP2).

---

## 4. Out of scope (explicit)

- Prototypes on Drummond data (Stage 1.5b)
- Visual regression test harness (Stage 1.5c)
- Storybook installation
- Framer Motion installation
- Per-org brand customization UI (Wave 3+; v1.5a only defines token shape)
- CMS-driven design tokens (never)
- Versioning automation (defer to first real change)
- AAA accessibility on select surfaces (defer)
- Migration of existing custom Nw* components to shadcn (defer; D1=C is hybrid by intent)
- Migration of existing inline SVG icons to Heroicons (defer; just install Heroicons for new components)
- Refactor of existing UI surfaces to extend new patterns (Foundation F4 + Wave 1.1 do this — 1.5a defines the targets only)

---

## 5. Risks (carried from EXPANDED-SCOPE §8)

R1-R8 stand. Most relevant for spec verification:
- R3 — Mobile pinch-zoom on PDF.js may be incompatible with current invoice-files bucket signed-URL flow → spike during Stage 1.5b (prototype gallery), not 1.5a. Spec acknowledges as a future risk, not a blocker.
- R5 — Dark mode codification may reveal contrast issues in existing Slate tokens → A3 acceptance criterion includes contrast-ratio audit; failures get fixed in 1.5a OR carried as a follow-up if scope-bounded.
- R6 — Forbidden list interpretation drift → A2 explicitly quantifies thresholds (border-radius > 4px = oversized, etc.).

---

## 6. Verification (goal-backward)

The verifier (`nightwork-spec-checker` at `/nightwork-qa` time) verifies acceptance criteria A1-E5 against actual artifacts:
- Documents exist at the named paths and contain the named sections
- Components playground renders without errors at `npm run build`
- TypeScript strict passes; ESLint passes; axe-core passes
- Vercel preview URL serves the playground
- Strategic Checkpoint #2 readiness is met (the gate for this phase)

If any criterion is MISSING or PARTIAL at QA time, the verdict is BLOCKING. Strategic Checkpoint #2 cannot happen until all are COVERED.
