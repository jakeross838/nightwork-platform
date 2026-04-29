# Spec — stage-1.5a-design-system-documents

**Status:** LOCKED v2 2026-04-29 (post plan-review iteration 1; addresses CR1-CR7 + 14 HIGH + 13 MEDIUM-inline)
**Phase:** Stage 1.5a (per MASTER-PLAN.md §12, D-009)
**Dependencies:** EXPANDED-SCOPE.md APPROVED, SETUP-COMPLETE.md exists, DISCUSSION.md (v2) resolved

This spec is the contract between PLAN.md (what gets built) and the verifier (`nightwork-spec-checker` at `/nightwork-qa` time). Every acceptance criterion is falsifiable. Per D-015 — acceptance criteria are required.

**v2 changelog:** New criteria A2.1-A2.2 (Forbidden quantification), A3.1 (contrast matrix artifact), A11.1-A11.7 (brand-customization contract), A12.1 (tenant-blind primitives), A14 expanded (12 patterns), A16.1 (reconciliation rejection criteria), A18.1 (mobile density mapping), B2 scope-cut (6 category pages), B7 upgraded (middleware enforcement), C1 expanded (specific package list with versions), D5.1 (Forbidden hook), D6.1 (axe-core artifact), D9 (sample-data isolation), E4 (CP2 pick-affordance UI), E5 (locked-direction placeholder).

---

## 1. Goal

Lock the Nightwork design system as a set of canonical documents + a live components playground, so every UI built from Stage 1.5b onward has a single source of truth for tokens, components, patterns, and philosophy. Three distinct PHILOSOPHY directions are presented at Strategic Checkpoint #2 with concrete invoice-review/dashboard/mobile-approval comparisons; the chosen direction guides every subsequent UI phase.

---

## 2. Deliverables

| # | Deliverable | Path | Status target |
|---|---|---|---|
| 1 | PHILOSOPHY.md (3 distinct directions) | `.planning/design/PHILOSOPHY.md` | NEW |
| 2 | SYSTEM.md (tokens, type, motion, layout, density, accessibility, brand-customization contract) | `.planning/design/SYSTEM.md` | NEW |
| 3 | COMPONENTS.md (inventory mapped to shadcn / TanStack / custom + iconography + tenant-blind rule) | `.planning/design/COMPONENTS.md` | NEW |
| 4 | PATTERNS.md (12 patterns: 9 Jake-named + AppShell + Audit Timeline + File Uploader) | `.planning/design/PATTERNS.md` | NEW |
| 5 | PROPAGATION-RULES.md (token/component/pattern-add workflows + tenant-blind rule + skill cross-reference) | `.planning/design/PROPAGATION-RULES.md` | NEW |
| 6 | CONTRAST-MATRIX.md (light + dark, every text-token × every bg-token, with WCAG ratios) | `.planning/design/CONTRAST-MATRIX.md` | NEW |
| 7 | `.impeccable.md` (frontend-design + impeccable skill anchor) | `.impeccable.md` (root) | NEW |
| 8 | Components playground (live render of every COMPONENTS.md entry) | `src/app/design-system/` (Next.js App Router) | NEW |
| 9 | shadcn primitives + TanStack Table v8 + Heroicons installed | `package.json` + `src/components/ui/` | NEW |
| 10 | Middleware gating for `/design-system/*` (platform_admin only in production) | `src/middleware.ts` | UPDATE |
| 11 | Post-edit hooks extended: sample-data isolation + Forbidden-list enforcement + tenant-blind-primitives | `.claude/hooks/nightwork-post-edit.sh` | UPDATE |
| 12 | CLAUDE.md "UI rules" section updated to defer to SYSTEM.md | `CLAUDE.md` | UPDATE |
| 13 | Existing skills cross-reference new docs (bidirectional) | `.claude/skills/nightwork-*` | UPDATE |
| 14 | axe-core report archived | `.planning/phases/stage-1.5a-design-system-documents/artifacts/axe-report.json` | NEW |

---

## 3. Acceptance criteria (falsifiable)

### Group A — Documents content

- [ ] **A1.** `.planning/design/PHILOSOPHY.md` presents exactly 3 directions, each with: name (short, evocative, distinct enough that no two names feel similar — Jake's hard requirement), 2-3 paragraph thesis, "what this WOULD look like" + "what this WOULDN'T look like" lists, and **concrete side-by-side comparisons of how invoice review / dashboard / mobile approval pages would render in each direction** (per nwrp10.txt). No abstract aesthetic descriptions without screen-level concrete examples. **Distinctness self-review checklist** at end of each direction: at least 2 of 4 axes (reference benchmark / density posture / motion posture / typography weight defaults) must vary per pair (per H11).
- [ ] **A2.** PHILOSOPHY.md "Forbidden" section lifts Jake's "things I never want to see again" list verbatim (bouncy easing, generic gradients, purple/pink accents, dark glows, oversized rounded corners, marketing-page typography on internal screens, phone-app-trying-to-be-desktop, desktop-trying-to-be-phone-app).
- [ ] **A2.1.** SYSTEM.md "Forbidden thresholds" section quantifies each Forbidden item with specific violation criteria: `border-radius > 4px on rectangular elements = oversized` (avatars + status dots use `--radius-dot: 999px` — explicit exception); `cubic-bezier(.x, [1-9].[0-9])` = bouncy easing; gradients in `background:` declarations = generic; HSL hue ∈ [270°, 320°] = purple/pink; `box-shadow` with blur > 20px + spread > 0 = dark glow; `font-family` outside the Slate type system = marketing typography. Quantification is verifiable by automated check (per H7 / D5.1).
- [ ] **A2.2.** Per-pattern density mapping defined — print mode always uses `--density-compact` regardless of user preference (per M-A2).
- [ ] **A3.** `.planning/design/SYSTEM.md` enumerates every CSS variable token currently in `colors_and_type.css` with: light value, dark value, contrast ratio against page bg + against card bg + against text-primary (where applicable), token name in CSS + in Tailwind utilities. Both candidate palette sets (Q1=C — Jake's brief `#6B8EA3` set vs existing `#5B8699` set) listed for visual pick at CP2.
- [ ] **A3.1.** `.planning/design/CONTRAST-MATRIX.md` exists as a separate artifact — full matrix of light + dark, every `--text-*` token × every `--bg-*` token, with WCAG 2.2 AA pass/fail per cell. Failures flagged for fix or accepted-with-rationale (per H8). Committed alongside SYSTEM.md.
- [ ] **A4.** SYSTEM.md typography section reflects Q2=B exactly: Space Grotesk (display, weights 400/500, `-0.02em` tracking), Inter (body, 14-15px), JetBrains Mono (eyebrows/money, 10-11px UPPERCASE, `0.14em` tracking, `font-variant-numeric: tabular-nums` for money). No Calibri references. Type scale enumerated.
- [ ] **A5.** SYSTEM.md spacing uses Tailwind default scale only (no arbitrary `[13px]`); border-radius is 0 except avatars + status dots (per A2.1 exception); shadows are minimal (hover-lift only on interactive cards).
- [ ] **A6.** SYSTEM.md motion section defines easing curves (no bouncy / no elastic — explicitly forbidden per A2.1), durations, supported transitions. CSS-only (per Q5=A); Framer Motion explicitly out of scope.
- [ ] **A7.** SYSTEM.md layout grid: 12-col desktop, 4-col mobile. Breakpoints named `nw-phone (0-480) / nw-tablet (481-1023) / nw-desktop (1024+) / nw-print` (per Q4=B), maps to Tailwind defaults. Tailwind config extended with these aliases (per M-P1, see T08b in PLAN).
- [ ] **A8.** SYSTEM.md density: `--density-compact` and `--density-comfortable` tokens defined with explicit row-height + padding values (per Q7=B). Components accept a `density` prop. Print mode forces compact (per A2.2).
- [ ] **A9.** SYSTEM.md touch targets: 44×44px minimum (WCAG 2.5.5), 56×56px for high-stakes actions. "High-stakes" defined as: any action that mutates state irreversibly, transitions a workflow, or moves money (approve/reject/void/submit/delete) (per Q10=A).
- [ ] **A10.** SYSTEM.md accessibility: WCAG 2.2 AA mandatory; per-token contrast ratios listed (cross-reference CONTRAST-MATRIX.md per A3.1); focus-visible standard specified (per Q9=B).
- [ ] **A11.** SYSTEM.md tenant brand customization: only `--brand-accent` and `--brand-logo` are tenant-customizable in v1; everything else (palette structure, typography, spacing, motion) is locked Nightwork (per Q14 modified-A). Token architecture explicitly reserves `--brand-accent` as overrideable; structural tokens (`--bg-page`, `--text-primary`, etc.) are not.
- [ ] **A11.1.** Brand-customization delivery contract — `--brand-accent` injected via `document.documentElement.style.setProperty('--brand-accent', value)` at request time; NEVER `<style>` tag concatenation; NEVER inline HTML interpolation. Server-derives value from `getOrgBranding()`; never client-derivable.
- [ ] **A11.2.** Server-side hex regex validation: `/^#[0-9A-Fa-f]{6}$/` applied before injection. Invalid values reject and fall back to default `--brand-accent` (Stone Blue).
- [ ] **A11.3.** Cache header — every response carrying tenant-branded HTML sets `Cache-Control: private, no-store` to prevent CDN cross-tenant pollution.
- [ ] **A11.4.** `--brand-logo` storage — Supabase Storage at `branding/{org_id}/logo.{ext}`; signed URL scoped to the requesting org's membership; refresh policy documented; never public bucket.
- [ ] **A11.5.** `--brand-logo` file-type allow-list: `image/png`, `image/svg+xml`, `image/jpeg` only. SVG sanitization required server-side (DOMPurify or equivalent — strip `<script>`, event handlers, external refs) before storage.
- [ ] **A11.6.** `--brand-logo` max file size: 200KB. Rejected at upload time.
- [ ] **A11.7.** One logo per org, one accent per org. Override write requires owner/admin role. Every mutation audit-logs to `activity_log` with `action='branding.logo_updated'` or `branding.accent_updated`.
- [ ] **A12.** `.planning/design/COMPONENTS.md` inventory has every component from Jake's list (Button, Input, Select, Combobox, DatePicker, Table, DataGrid, Card, Modal, Drawer, Sheet, Tabs, Toast, Banner, Empty State, Loading State, Error State, Skeleton, Tooltip, Popover, Form) plus implicit extensions (FileDropzone, ConfidenceBadge, NwEyebrow + NwButton existing-codification, AppShell). Columns: Component | Source (custom/shadcn/tanstack) | Variants | Required props | Token bindings | Snapshot states (default/hover/focus/disabled/loading/error) | Accessibility notes | Mobile behavior | Anti-patterns.
- [ ] **A12.1.** COMPONENTS.md "Tenant-blind primitives" rule — primitives in `src/components/ui/` (shadcn output) MUST NOT accept tenant-identifying props (no `org_id`, no `membership`, no `vendor_id`). Tenant-aware composition lives in `src/components/<domain>/` only. Enforced by post-edit hook (per H6).
- [ ] **A12.2.** COMPONENTS.md "Iconography" subsection — semantic icon→use mapping. Heroicons outline (stroke 1.5) for: status, action, navigation, file-type, progress, alert. Specific icon names enumerated per use (per M-DP4).
- [ ] **A12.3.** COMPONENTS.md "Brand Customization" section — restates the A11.1-A11.7 contract from the COMPONENTS perspective (which components consume `--brand-accent` / `--brand-logo`; how the override flows through to button/header/loading-state surfaces).
- [ ] **A13.** COMPONENTS.md DataGrid entry uses TanStack Table v8 (per Q8=A); Combobox uses cmdk; DatePicker uses react-day-picker; Drawer uses Vaul; Tooltip + Popover use Radix.
- [ ] **A14.** `.planning/design/PATTERNS.md` has all 12 patterns: 9 Jake-named (Document Review, Dashboard, Settings, List+Detail, Wizard, Empty Workspace, Print View, Mobile Approval, Reconciliation) + AppShell + Audit Timeline (per H3) + File Uploader (per H4 partial). Each entry: when to use / when NOT, required regions + responsive behavior, data shape contract, example states, reference implementation (if exists), print behavior, mobile behavior.
- [ ] **A15.** PATTERNS.md "Document Review" entry treats `src/app/invoices/[id]/page.tsx` as the reference implementation. Lifts the existing `nightwork-ui-template` skill's contract verbatim and elaborates with explicit data-shape + example-state details.
- [ ] **A16.** PATTERNS.md "Reconciliation" defines required regions (header, left rail, right rail, center, bottom, audit timeline), data shape contract, **4 candidate visualization models** (side-by-side delta / inline diff / timeline overlay / hybrid: header-level timeline + line-level inline diff per H2) with no model picked yet — 1.5b mock-up will pick (per D5 + Q12=B).
- [ ] **A16.1.** PATTERNS.md "Reconciliation" includes **rejection criteria** — explicit: "won't ship a model requiring horizontal scroll on `nw-tablet` to see drift"; "won't ship a model that breaks audit-trail viewability." Plus a "Strawman acceptance posture" paragraph noting that 1.5b picking model 2/3/4 forces non-trivial PATTERNS.md rewrite (per H2 + M-DP3).
- [ ] **A17.** PATTERNS.md "Print View" specifies AIA G702/G703 print layout; how `print:` Tailwind utilities are applied; static-block fallback in print stylesheet; orientation; margin standards; page-break behavior; print mode forces `--density-compact` (per A2.2).
- [ ] **A18.** PATTERNS.md "Mobile Approval" specifies touch targets (per A9), gesture vocabulary (no swipe-to-approve in v1 — taps only — but the pattern documents the decision), file-preview-on-mobile interaction (pinch-zoom, pan), approve/reject/kickback CTA prominence on small viewport.
- [ ] **A18.1.** PATTERNS.md "Mobile Approval" information density mapping: at `nw-phone`, the invoice review template — file preview moves to top (was LEFT desktop); allocations editor pushes below status (collapsed by default with "edit allocations" tap-expand); audit timeline stays inline but condensed (last 3 events visible, "show all" tap-expands); status badge + total + primary action stay above-the-fold (per H9).
- [ ] **A19.** `.planning/design/PROPAGATION-RULES.md` covers: when to add a token vs reuse, when token change is "everywhere" (route through `/nightwork-propagate`), component-add workflow (COMPONENTS.md → playground → first usage → enforcement hook), pattern-add workflow (PATTERNS.md → first surface → second surface validates contract), versioning posture (1.5a is v1.0). Plus shadcn-hybrid boundary rule (per M-A4): "if shadcn ships an upstream version of an existing custom Nw* component, we do NOT auto-migrate." Plus "Storybook re-evaluation marker at 40+ components" (per M-E5). Plus "design-system access audit-logging: explicit N/A — design docs are not SOC2-relevant view events" (per M-E3).
- [ ] **A19.1.** PROPAGATION-RULES.md "Skill anchor" section — bidirectional cross-reference: SYSTEM.md lists every skill that depends on it (`nightwork-design`, `nightwork-design-tokens`, `nightwork-ui-template`, `nightwork-design-system-reviewer`, `nightwork-ui-reviewer`); when SYSTEM tokens change, those skills update too (per H10 + M-DP1).
- [ ] **A20.** `.impeccable.md` (root) anchors `frontend-design` + `impeccable` skills to SYSTEM.md, COMPONENTS.md, PATTERNS.md, the chosen philosophy direction (placeholder until CP2 picks), the "Forbidden" list, and the reference benchmarks (Procore, Linear, Stripe Dashboard).

### Group B — Components playground

- [ ] **B1.** `src/app/design-system/page.tsx` exists as a Next.js App Router page that lists all components + patterns + palette + typography + philosophy + forbidden as a navigable index.
- [ ] **B2.** Components organized into 6 category pages (per CR5 scope-cut): `/design-system/components/inputs` (Button/Input/Select/Combobox/DatePicker/Form), `/components/surfaces` (Card/Modal/Drawer/Sheet/Tabs), `/components/feedback` (Toast/Banner/Empty/Loading/Error/Skeleton), `/components/navigation` (AppShell/Tabs-as-nav/Breadcrumb), `/components/data-display` (Table/DataGrid/ConfidenceBadge), `/components/overlays` (Tooltip/Popover/Confirm/HoverCard). Each category page renders all components in its category with: variants, states (default/hover/focus/disabled/loading/error/empty), token bindings, sample data (constants only, NOT tenant-derived per D9), accessibility notes (ARIA, keyboard support), anti-pattern examples (don't-do-this).
- [ ] **B3.** A `/design-system/palette` page renders Q1's two candidate palette sets side-by-side: (a) Jake's brief values (`#6B8EA3 / #2D3E4A / #8A8A8A`), (b) existing skill values (`#5B8699 / #1A2830 / #3B5864 / #F7F5EC`). Both displayed as full color cards with hex labels and contrast ratios. Visual pick happens at CP2.
- [ ] **B4.** A `/design-system/typography` page renders the Slate type system (Space Grotesk + Inter + JetBrains Mono) at every defined size, weight, and tracking. Includes a `tabular-nums` money sample.
- [ ] **B5.** A `/design-system/patterns` page lists every pattern from PATTERNS.md with a 1-paragraph description + a link to the canonical implementation (where applicable). The Reconciliation pattern shows all 4 candidate visualization models as static layouts (no real data).
- [ ] **B6.** A `/design-system/forbidden` page lifts the "Forbidden" list and shows visual examples of what NOT to do for each (oversized rounded corners with arrow + "DO NOT", etc.).
- [ ] **B7.** Playground access gated **at middleware level** in production (404 for non-platform_admin per CR1 + H12). `src/middleware.ts` matcher includes `/design-system/:path*`; for non-platform_admin, returns `NextResponse.rewrite(new URL('/_not-found', req.url))` (NOT `redirect('/dashboard')`). In development, gate to authenticated users at middleware layer. **No env-var bypass** (per H13 — DISCUSSION.md D3 v2 locks this). Layout-level check stays as defense-in-depth.
- [ ] **B8.** Playground renders correctly in both light and dark mode (Q3=A); includes a mode toggle that respects existing ThemeProvider cookie.
- [ ] **B9.** Playground responsive — renders correctly at `nw-phone`, `nw-tablet`, `nw-desktop` breakpoints. Tailwind config extended with breakpoint aliases (per A7).
- [ ] **B10.** Each category page (per B2) has a Next.js `error.tsx` boundary that falls back to "this component preview failed; check console" — internal-only surface, Sentry tag is sufficient (per M-E4).

### Group C — Dependencies + integration

- [ ] **C1.** `package.json` adds (specific versions pinned at first install — exact pinned versions captured in T07/T08 commit):
  - `@radix-ui/react-popover` (latest stable)
  - `@radix-ui/react-tooltip` (latest stable)
  - `cmdk` (latest stable)
  - `react-day-picker` (latest stable)
  - `vaul` (latest stable)
  - `class-variance-authority` (latest stable; auto-installed by shadcn init)
  - `tailwind-merge` (latest stable; auto-installed by shadcn init)
  - `@heroicons/react` (latest stable, v2.x)
  - `@tanstack/react-table` (v8.x)

  Existing custom components (NwButton, NwEyebrow, NwInput) NOT migrated to shadcn (per D1=C). `npm audit --audit-level=high` passes after install (per M-S2).

- [ ] **C2.** `src/components/ui/` directory created with shadcn-generated primitives (Combobox, Calendar/DatePicker, Drawer, Tooltip, Popover, HoverCard) per `npx shadcn-ui@latest add`.
- [ ] **C3.** CLAUDE.md "UI rules" section updated: SYSTEM.md is the single source of truth for tokens; CLAUDE.md links to it for reference. Calibri correction stands. Edit narrowly scoped to "UI rules" section only — Architecture Rules, Development Rules, and platform admin sections untouched (per M-S4).
- [ ] **C4.** Existing `nightwork-design` skill cross-references SYSTEM.md as authoritative; same for `nightwork-design-tokens` and `nightwork-ui-template`. Bidirectional — SYSTEM.md "Skill anchor" section names these skills (per A19.1).
- [ ] **C5.** Post-edit token enforcement hook (`.claude/hooks/nightwork-post-edit.sh`) updated to recognize new shadcn primitive paths (`src/components/ui/`) and apply token enforcement there too.
- [ ] **C6.** Post-edit hook extended with **sample-data isolation** (per CR2 / D9): if file path matches `^src/app/design-system/.*\.(tsx?|jsx?)$` AND imports `@/lib/(supabase|org|auth)/`, REJECT with explicit error message. Verified by attempting a test-import (positive test).
- [ ] **C7.** Post-edit hook extended with **Forbidden-list enforcement** (per H7 / D5.1): regex check for `cubic-bezier\([^)]*,[^)]*,\s*[12]\.[0-9]` (bouncy easing) and `rounded-(lg|xl|2xl|3xl|full)` outside avatar/dot patterns (oversized rounded corners). REJECT with quantified error message referencing A2.1 thresholds.
- [ ] **C8.** Post-edit hook extended with **tenant-blind primitives rule** (per H6 / A12.1): files under `src/components/ui/*.tsx` MUST NOT contain prop names `org_id`, `membership`, `vendor_id`, `orgId`, `membershipId`. REJECT with explicit error.

### Group D — Quality gates

- [ ] **D1.** `npm run build` passes with zero errors (Next.js production build).
- [ ] **D2.** `npx tsc --noEmit` passes (TypeScript strict mode, no `any`).
- [ ] **D3.** `npx eslint src/app/design-system` passes with zero errors.
- [ ] **D4.** Visual regression: each category page screenshot captured via Chrome DevTools MCP at `nw-phone`, `nw-tablet`, `nw-desktop` breakpoints in both light + dark mode (6 categories × 3 breakpoints × 2 modes = 36 screenshots). Spot-check approach explicit: 5 most-complex components (DataGrid, Combobox, Modal, Drawer, Form) get full coverage; remaining components verified at desktop-light only (per M-P4).
- [ ] **D5.** No hardcoded hex colors outside `colors_and_type.css` and `tailwind.config.ts` (post-edit hook enforces). No Tailwind named colors (`bg-blue-500` etc). No legacy namespaces (`cream-*`, `teal-*`, `brass-*`, etc.).
- [ ] **D5.1.** Forbidden-list violations rejected by hook (per H7 / C7). Verified by positive test — attempting to commit `transition: cubic-bezier(.4, 1.5, .3, 1.2)` blocks; attempting `rounded-3xl` on non-avatar element blocks.
- [ ] **D6.** Accessibility audit: every category page passes axe-core automated checks at WCAG 2.2 AA (per Q9=B). Manual keyboard-navigation spot-check on Combobox, DatePicker, Drawer (interactive components).
- [ ] **D6.1.** axe-core JSON output saved to `.planning/phases/stage-1.5a-design-system-documents/artifacts/axe-report.json` with per-component pass/fail (per H11). PR description links to it.
- [ ] **D7.** No prototypes — verify scope discipline. Drummond data does NOT appear in `/design-system` (sample data only). Jake's stated scope explicitly forbids prototypes in 1.5a.
- [ ] **D8.** `nightwork-design-system-reviewer` agent passes on the playground (when invoked via `/nightwork-design-check`).
- [ ] **D9.** **Sample-data isolation** (per CR2): No file under `src/app/design-system/` imports from `@/lib/supabase/*`, `@/lib/org/*`, `@/lib/auth/*`, or any module returning tenant-scoped data. All sample data lives in `src/app/design-system/_fixtures/` as pure constants. Verified by post-edit hook (per C6) AND a build-time grep check.

### Group E — Strategic Checkpoint #2 readiness

- [ ] **E1.** Vercel preview deploy URL accessible and `/design-system` renders all sub-pages (gated to platform_admin per B7).
- [ ] **E2.** PHILOSOPHY.md's 3 directions are visible at `/design-system/philosophy`; Jake can scroll through the side-by-side screen comparisons in browser.
- [ ] **E3.** Q1 palette comparison (`/design-system/palette`) is rendered for visual pick.
- [ ] **E4.** A "Strategic Checkpoint #2 — pick a direction" affordance on the philosophy page (per CR4): each direction has a "Pick this direction" button. When clicked (intended for CP2), the button writes the chosen direction's name to `.planning/design/CHOSEN-DIRECTION.md` (a marker file used by post-CP2 documents to lock the choice). Button is gated to platform_admin in production.
- [ ] **E5.** PHILOSOPHY.md ends with a "Locked direction" section (initially blank with placeholder text "TO BE LOCKED AT CP2 — Jake's chosen direction goes here, with rationale"). Populated post-CP2 (per CR4).

---

## 4. Out of scope (explicit)

- Prototypes on Drummond data (Stage 1.5b)
- Visual regression test harness (Stage 1.5c)
- Storybook installation
- Framer Motion installation
- Per-org brand customization UI (Wave 3+; v1.5a only defines token shape + contract per A11.1-A11.7)
- CMS-driven design tokens (never)
- Versioning automation (defer to first real change)
- AAA accessibility on select surfaces (defer)
- Migration of existing custom Nw* components to shadcn (defer; D1=C is hybrid by intent)
- Migration of existing inline SVG icons to Heroicons (defer; just install Heroicons for new components)
- Refactor of existing UI surfaces to extend new patterns (Foundation F4 + Wave 1.1 do this — 1.5a defines the targets only)
- Side-by-Side Compare pattern (Wave 1.1 polish work owns this; per M-A5)
- Timeline/Gantt pattern (Wave 2 schedules; per M-A5)
- Per-user dark-mode preference persistence (Wave 3+ user_settings.theme_mode; per M-E1; tech-debt logged)
- platform_admin role-revocation refresh on open `/design-system` page (acceptable posture for design docs; per M-E2; documented in SYSTEM.md, tech-debt logged)

---

## 5. Risks and assumptions

R1-R8 from EXPANDED-SCOPE §8 stand. Plus from PLAN-REVIEW iteration 1:
- **R9** — shadcn init may auto-install `class-variance-authority` + `tailwind-merge` at minor versions that conflict with future TanStack Table v8 dependencies. **Mitigation:** T07 commit pins versions explicitly; T11 build-pass + T11.5 `npm audit` catches at install time.
- **R10** — Sample-data isolation hook (C6) may produce false-positives if a future contributor needs a real-shape type import (`type Vendor` from `@/lib/supabase/types`). **Mitigation:** hook regex matches imports like `from '@/lib/supabase/server'` (modules) but allows `from '@/lib/supabase/types'` (type-only) — the regex distinguishes path-segment patterns.
- **R11** — Reconciliation strawman with 4 candidate models adds complexity to PATTERNS.md and the `/design-system/patterns` page. **Mitigation:** A16.1's rejection criteria (no horizontal scroll on `nw-tablet`) likely eliminates 1-2 candidates at design time; 1.5b doesn't have to evaluate all 4 from scratch.
- **R12** — Tenant-blind primitives hook (C8) may false-positive on legitimate type names like `member.id` if regex is too aggressive. **Mitigation:** hook checks PROP NAMES in component signatures, not arbitrary `.id` accesses.

---

## 6. Verification (goal-backward)

The verifier (`nightwork-spec-checker` at `/nightwork-qa` time) verifies acceptance criteria A1-E5 against actual artifacts. Order of verification:

1. Documents exist at named paths and contain named sections
2. SPEC counts match (12 patterns; 6 category pages; 9 deliverables)
3. Components playground renders without errors at `npm run build`
4. TypeScript strict passes; ESLint passes; axe-core passes (axe-report.json archived)
5. Vercel preview URL serves the playground (404 for non-platform_admin in prod — verified by curl)
6. Hooks reject Forbidden-list violations / sample-data isolation violations / tenant-blind violations (verified by attempting each)
7. Strategic Checkpoint #2 readiness is met (E1-E5)

If any criterion is MISSING or PARTIAL at QA time, the verdict is BLOCKING. Strategic Checkpoint #2 cannot happen until all are COVERED.

**Total: 51 falsifiable acceptance criteria** (was 42 in v1; +9 net after consolidation).
