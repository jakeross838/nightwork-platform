# Plan — stage-1.5a-design-system-documents

**Status:** v2 READY FOR REVIEW (post plan-review iteration 1; addresses CR1-CR7 + 14 HIGH + 13 MEDIUM-inline)
**Phase:** Stage 1.5a (per MASTER-PLAN.md §12)
**Inputs:** EXPANDED-SCOPE.md (APPROVED), DISCUSSION.md v2 (RESOLVED), SPEC.md v2 (LOCKED — 51 acceptance criteria)

**v2 changelog:**
- New tasks: T03.1 (contrast matrix artifact), T08b (breakpoint aliases), T10b (Forbidden-list hook), T10c (sample-data isolation hook), T10d (tenant-blind primitives hook), T11.5 (npm audit), T12.1 (A11 contract in SYSTEM.md), T13.1 (A11 contract in COMPONENTS.md), T17b (PHILOSOPHY screen comparisons split), T18.5 (middleware edit), T20a-T20f (6 category pages — replaces single T20), T24.1 (CP2 pick-affordance), T33.1 (axe-core archival), T35.5 (sample-data + Forbidden + tenant-blind hook positive tests)
- Removed: T20 single (replaced by T20a-T20f category pages)
- Estimate change: T17 split into T17a (2h thesis) + T17b (3-4h, 9 screen comparisons); T20 split into 6 category pages × 60min = 6h; total Claude-hours unchanged at ~37-42h
- Critical path corrected: T07 → T08 → T13 → T20a-T20f → T29-T36

---

## 1. Goal recap

Lock the Nightwork design system as 6 canonical documents + a contrast-matrix artifact + a live components playground at `/design-system` (6 category pages + palette + typography + patterns + philosophy + forbidden). 3 distinct PHILOSOPHY directions presented at Strategic Checkpoint #2 with side-by-side renderings of how invoice review / dashboard / mobile approval pages would feel in each direction. Middleware-level gating in production (404 for non-platform_admin). Hooks enforce sample-data isolation, Forbidden-list violations, and tenant-blind primitives.

---

## 2. Task breakdown (47 tasks)

### Wave 1 — Foundation + auditing (parallelizable; no inter-dependencies)

| ID | Task | Estimate | Owner | Depends on |
|---|---|---|---|---|
| T01 | Audit existing `colors_and_type.css` — enumerate every CSS variable + value (light + dark) + Tailwind utility name | 30 min | Claude | — |
| T02 | Audit `tailwind.config.ts` — extract every `nw-*` color, font, animation, breakpoint | 20 min | Claude | — |
| T03 | Compute contrast ratios for every token combination (text-on-bg) — both candidate palette sets per Q1=C | 45 min | Claude | T01 |
| **T03.1** | **NEW: Produce `.planning/design/CONTRAST-MATRIX.md` artifact** — full matrix of light + dark, every `--text-*` × every `--bg-*`, with WCAG 2.2 AA pass/fail per cell. Failures flagged for fix or accepted-with-rationale. (Per H8 / SPEC A3.1.) | 1 hr | Claude | T03 |
| T04 | Audit existing 3 design skills + invoice review template — note what gets cross-referenced vs lifted | 30 min | Claude | — |
| T05 | Audit existing custom components (NwButton, NwEyebrow, NwInput, NwCard, etc.) — codify props + variants for COMPONENTS.md | 60 min | Claude | — |
| T06 | Inventory existing icons in `src/components/` — count usages of inline SVGs to be replaced eventually | 30 min | Claude | — |

### Wave 2 — Dependency installation + scaffolding (sequential — Jake runs `npx shadcn-ui@latest init` interactively)

| ID | Task | Estimate | Owner | Depends on |
|---|---|---|---|---|
| **PRE-T07** | **Backup `tailwind.config.ts`, `globals.css`, `colors_and_type.css`, `package.json` to `.planning/phases/stage-1.5a-design-system-documents/_backups/` before running shadcn init.** (Per H14 / RP2 mitigation.) | 5 min | Claude | — |
| T07 | Run `npx shadcn-ui@latest init` (Jake — interactive) — accept defaults: TS, Tailwind, `src/components/ui/`, `src/lib/utils.ts`, CSS vars. Verify `class-variance-authority` + `tailwind-merge` auto-installed (per SPEC C1). | 5 min | Jake | PRE-T07 |
| T08 | Install missing primitives via `npx shadcn-ui@latest add` — combobox, calendar (DatePicker), drawer, tooltip, popover, hover-card. | 10 min | Claude | T07 |
| **T08b** | **NEW: Add `nw-phone (0-480) / nw-tablet (481-1023) / nw-desktop (1024+) / nw-print` breakpoint aliases to `tailwind.config.ts`.** (Per M-P1 / SPEC A7.) | 10 min | Claude | T07 |
| T09 | Install `@tanstack/react-table` (v8.x) + `@heroicons/react` (v2.x) via `npm install` | 5 min | Claude | T07 |
| **T10a** | Update `.claude/hooks/nightwork-post-edit.sh` to recognize `src/components/ui/` paths under existing token enforcement. (Renamed from T10.) | 30 min | Claude | T08 |
| **T10b** | **NEW: Forbidden-list enforcement hook** — extend `nightwork-post-edit.sh` to grep for `cubic-bezier\([^)]*,[^)]*,\s*[12]\.[0-9]` (bouncy easing) and `rounded-(lg\|xl\|2xl\|3xl\|full)` outside avatar/dot patterns. REJECT with quantified error referencing SPEC A2.1 thresholds. (Per H7 / SPEC C7.) | 30 min | Claude | T10a |
| **T10c** | **NEW: Sample-data isolation hook** — extend `nightwork-post-edit.sh`: if file path matches `^src/app/design-system/.*\.(tsx?\|jsx?)$` AND imports `@/lib/(supabase\|org\|auth)/`, REJECT with explicit error. (Per CR2 / SPEC C6 / D9.) Note: distinguishes `from '@/lib/supabase/types'` (type-only — allowed) from `from '@/lib/supabase/server'` (module — rejected). Per R10 mitigation. | 45 min | Claude | T10a |
| **T10d** | **NEW: Tenant-blind primitives hook** — extend `nightwork-post-edit.sh`: files under `src/components/ui/*.tsx` MUST NOT contain prop names `org_id`, `membership`, `vendor_id`, `orgId`, `membershipId`. REJECT. (Per H6 / SPEC C8 / A12.1.) | 30 min | Claude | T10a |
| T11 | Verify `npm run build` passes after dep install (no regressions) | 10 min | Claude | T08, T08b, T09 |
| **T11.5** | **NEW: `npm audit`** — at first install, run `npm audit --audit-level=moderate` once and document any accepted-as-known moderates in `.planning/phases/stage-1.5a-design-system-documents/artifacts/npm-audit-baseline.json` (per security iteration-2 N3 — first-install gets stricter check; ongoing CI uses `--audit-level=high`). Block on high/critical findings. (Per M-S2 + N3.) | 15 min | Claude | T08, T09 |

### Wave 3 — Document drafting (parallel where dependencies allow)

| ID | Task | Estimate | Owner | Depends on |
|---|---|---|---|---|
| T12 | Draft `.planning/design/SYSTEM.md` — full token enumeration + Forbidden thresholds (A2.1) + density (A8) + print-uses-compact (A2.2) + accessibility (A10) + skill anchor section (A19.1) | 3 hr | Claude | T01-T03, T03.1 |
| **T12.1** | **NEW: A11 brand-customization contract documented in SYSTEM.md** — token shape, override mechanism (setProperty only), validation regex, cache header, storage path, file-types, max-size, audit-log requirement. (Per CR3 / SPEC A11.1-A11.7.) | 45 min | Claude | T12 |
| T13 | Draft `.planning/design/COMPONENTS.md` — inventory with shadcn/TanStack/custom mapping, variants, states, tokens, a11y. Plus tenant-blind primitives rule (A12.1) + iconography (A12.2). | 3 hr | Claude | T05, T08 |
| **T13.1** | **NEW: A11 brand-customization contract documented in COMPONENTS.md** — Brand Customization section listing which components consume `--brand-accent` / `--brand-logo` and how the override flows through. (Per CR3 / SPEC A12.3.) | 30 min | Claude | T12.1, T13 |
| T14 | Draft `.planning/design/PATTERNS.md` — 12 patterns: 9 Jake-named + AppShell + Audit Timeline (H3) + File Uploader (H4 partial). Each entry: regions, data shapes, states, references. Reconciliation entry has 4 candidate models + rejection criteria (A16.1) + strawman acceptance posture. Mobile Approval has density mapping (A18.1). | 4 hr | Claude | T04 |
| T15 | Draft `.planning/design/PROPAGATION-RULES.md` — token-add, component-add, pattern-add workflows + propagate orchestrator integration + skill anchor section (A19.1) + shadcn-hybrid boundary rule + Storybook re-eval marker + audit-logging N/A note | 1.5 hr | Claude | T12, T13, T14 |
| T16 | Draft `.impeccable.md` (root) — anchor frontend-design + impeccable skills to SYSTEM/COMPONENTS/PATTERNS | 30 min | Claude | T12, T13, T14 |
| **T17a** | **SPLIT: PHILOSOPHY.md thesis** — 3 distinct directions, each with: name (distinct per Jake's hard rule), 2-3 paragraph thesis, would/wouldn't lists, distinctness self-review checklist (4 axes: reference benchmark / density / motion / typography weight) | 2 hr | Claude | T04 |
| **T17b** | **SPLIT: PHILOSOPHY.md screen comparisons** — 9 concrete screen mockup descriptions (3 directions × invoice-review + dashboard + mobile-approval). Forbidden section lifted verbatim from Jake's brief. Locked-direction placeholder section (E5). **Budget bumped from 4h to 4.5h** (per planner iteration-2 NEW-M1 — accounts for Forbidden lift + E5 placeholder + transitive distinctness check vs original 9-mockups-only budget). | 4.5 hr | Claude | T17a, T12 |

### Wave 4 — Components playground (parallel; T18-T26 after T13)

| ID | Task | Estimate | Owner | Depends on |
|---|---|---|---|---|
| T18 | Create `src/app/design-system/layout.tsx` — navigation shell. (Layout-level check is defense-in-depth; the wall is in middleware per T18.5.) | 1 hr | Claude | T07 |
| **T18.5** | **NEW: Middleware edit** — Add `/design-system/:path*` matcher to `src/middleware.ts`; in production, unconditional `isPlatformAdmin` check; non-admin returns `NextResponse.rewrite(new URL('/_not-found', req.url))` (404 not redirect). In dev, gate to authenticated users. NO env-var bypass. (Per CR1 / H12 / SPEC B7.) | 1 hr | Claude | T18 |
| T19 | Create `src/app/design-system/page.tsx` — index of components + patterns + palette + typography + philosophy + forbidden | 1 hr | Claude | T18 |
| **T19.5** | **NEW: Create `src/app/design-system/_fixtures/` directory** — sample-data constants (Button props, Vendor type, Invoice mock-data, etc.) — pure constants, no DB reads, no `getCurrentMembership()`. Hook (T10c) enforces no imports from `@/lib/supabase|org|auth/`. | 30 min | Claude | T18 |
| **T20a** | **SCOPE-CUT (replaces T20 single page): `src/app/design-system/components/inputs/page.tsx`** — Button, Input, Select, Combobox, DatePicker, Form. Per-component: variants, 6 states, token bindings, sample data (constants from `_fixtures/` only), ARIA notes, anti-patterns. **Do NOT refactor existing inline SVG icons in this phase** (per planner M-P2 carryover; SVG migration is deferred per scope §4). | 60 min | Claude | T13, T18, T19.5 |
| **T20b** | **`/components/surfaces` page** — Card, Modal, Drawer, Sheet, Tabs | 60 min | Claude | T13, T18, T19.5 |
| **T20c** | **`/components/feedback` page** — Toast, Banner, Empty State, Loading State, Error State, Skeleton | 60 min | Claude | T13, T18, T19.5 |
| **T20d** | **`/components/navigation` page** — AppShell, Tabs-as-nav, Breadcrumb | **30 min** (rebalanced — fewer/simpler components per planner iteration-2 NEW-M2) | Claude | T13, T18, T19.5 |
| **T20e** | **`/components/data-display` page** — Table, DataGrid, ConfidenceBadge | **90 min** (rebalanced — DataGrid is the riskiest single component; budget moves from T20d to here per planner iteration-2 NEW-M2) | Claude | T13, T18, T19.5 |
| **T20f** | **`/components/overlays` page** — Tooltip, Popover, Confirm, HoverCard | 60 min | Claude | T13, T18, T19.5 |
| **T20g** | **NEW: error.tsx boundary on each category page** (per M-E4 / SPEC B10) — 6 boundaries, "this component preview failed; check console" fallback + Sentry tag | 30 min | Claude | T20a-T20f |
| T21 | Create `src/app/design-system/palette/page.tsx` — Q1 side-by-side palette comparison + per-token contrast labels | 1 hr | Claude | T03, T18 |
| T22 | Create `src/app/design-system/typography/page.tsx` — Slate type system render | 1 hr | Claude | T12, T18 |
| T23 | Create `src/app/design-system/patterns/page.tsx` — every PATTERNS.md entry as static layout. Reconciliation strawman shows all 4 candidate models (per A16). | 3 hr | Claude | T14, T18 |
| T24 | Create `src/app/design-system/philosophy/page.tsx` — render PHILOSOPHY.md's 3 directions with screen comparisons + would/wouldn't | 4 hr | Claude | T17a, T17b, T18 |
| **T24.1** | **NEW: CP2 pick-affordance UI** — each direction has a "Pick this direction" button. On click (CP2-only, gated to platform_admin), writes the chosen direction's name to `.planning/design/CHOSEN-DIRECTION.md` marker file. (Per CR4 / SPEC E4.) | 1 hr | Claude | T24 |
| T25 | Create `src/app/design-system/forbidden/page.tsx` — visual examples of each Forbidden item with "DO NOT" overlay (cross-references SPEC A2.1 thresholds) | 1 hr | Claude | T17a |
| T26 | Wire dark-mode toggle on playground (re-uses existing ThemeProvider) | 30 min | Claude | T18 |

### Wave 5 — Integration + polish (sequential)

| ID | Task | Estimate | Owner | Depends on |
|---|---|---|---|---|
| T27 | Update existing skills (`nightwork-design`, `nightwork-design-tokens`, `nightwork-ui-template`) to cross-reference new SYSTEM/COMPONENTS/PATTERNS as authoritative. Bidirectional — SYSTEM.md "Skill anchor" section names them too. (Per H10 / M-DP1 / SPEC A19.1.) | 1 hr | Claude | T12-T15 |
| T28 | Update CLAUDE.md "UI rules" section ONLY to defer to SYSTEM.md as single source of truth. Architecture Rules / Development Rules / Platform Admin sections untouched. (Per M-S4 / SPEC C3.) | 15 min | Claude | T12 |

### Wave 6 — Verification (sequential — runs once everything else lands)

| ID | Task | Estimate | Owner | Depends on |
|---|---|---|---|---|
| T29 | `npm run build` — must pass with zero errors | 5 min | Claude | T20a-T26 |
| T30 | `npx tsc --noEmit` strict mode pass | 5 min | Claude | T20a-T26 |
| T31 | `npx eslint src/app/design-system` — zero errors | 5 min | Claude | T20a-T26 |
| T32 | Visual regression: capture component category screenshots via Chrome DevTools MCP at nw-phone/tablet/desktop × light/dark. **Spot-check approach** (per M-P4 / SPEC D4): 5 most-complex components (DataGrid, Combobox, Modal, Drawer, Form) get full coverage; remaining components verified at desktop-light only. | 90 min | Claude | T29 |
| T33 | axe-core automated WCAG 2.2 AA checks on every category page | 1 hr | Claude | T29 |
| **T33.1** | **NEW: Archive axe-core JSON output** to `.planning/phases/stage-1.5a-design-system-documents/artifacts/axe-report.json` with per-component pass/fail. (Per H11 / SPEC D6.1.) | 15 min | Claude | T33 |
| T34 | Manual keyboard navigation spot-check on Combobox, DatePicker, Drawer | 30 min | Claude | T29 |
| T35 | Confirm post-edit hook enforces no hardcoded hex outside allowed files (test by attempting one) | 15 min | Claude | T10a |
| **T35.5** | **NEW: Hook positive-tests** — attempt to commit (a) `transition: cubic-bezier(.4, 1.5, .3, 1.2)` (Forbidden hook should reject); (b) `import { createClient } from '@/lib/supabase/server'` in `src/app/design-system/components/inputs/page.tsx` (sample-data hook should reject); (c) prop named `org_id` in `src/components/ui/button.tsx` (tenant-blind hook should reject). Each rejection verifies the hook works. (Per CR2/H7/H6 / SPEC D5.1/D9/C8.) | 30 min | Claude | T10b, T10c, T10d |
| **T35.6** | **NEW: Build-time grep check for D7** (no Drummond data in playground): `grep -rn "drummond\|smartshield\|holmes beach" src/app/design-system/ \|\| echo "PASS"`. (Per M-P5.) | 10 min | Claude | T20a-T26 |
| T36 | Push branch + verify Vercel preview URL serves `/design-system` (404 for non-platform_admin in prod — verified by curl with non-admin session) | 30 min | Claude | T29 |
| T37 | `/nightwork-qa` runs (spec-checker + design-system-reviewer + ui-reviewer + custodian); critical findings block | 1 hr | Claude | T29-T36 |

### Wave 7 — Strategic Checkpoint #2 readiness

| ID | Task | Estimate | Owner | Depends on |
|---|---|---|---|---|
| T38 | Tag commit "stage-1.5a/cp2-ready" | 2 min | Claude | T37 |
| T39 | Walk Jake through Vercel preview URL `/design-system` for CP2 review (palette pick + philosophy pick via T24.1 affordance) | 30 min | Jake + Claude | T36 |

---

## 3. Dependency graph (corrected per CR7)

```
Wave 1 (audits, parallel):    T01 T02 T03 T04 T05 T06
                              │
                              T03 → T03.1 (contrast matrix artifact)
                              │
Wave 2 (deps install, seq):   PRE-T07 (backup) → T07 (Jake interactive)
                              │
                              T07 → T08, T08b, T09 (parallel after T07)
                              │
                              T08 → T10a → {T10b, T10c, T10d} (parallel)
                              │
                              T11 (build pass), T11.5 (npm audit)
                              │
Wave 3 (docs, mostly parallel — corrected):
                              T12 ── (after T01-T03, T03.1)
                              T13 ── (after T05, T08)
                              T14 ── (after T04)
                              T17a ── (after T04)
                              │
                              T12 → T12.1 (A11 contract — serial)
                              T13 → T13.1 (A11 contract — serial after T12.1)
                              T17a → T17b (after T12)
                              T15 (after T12, T13, T14)
                              T16 (after T12, T13, T14)
                              │
Wave 4 (playground):          T18 (after T07) → T19, T19.5 (parallel)
                              T20a-T20f (parallel after T13, T18, T19.5)
                              T20a-T20f → T20g (error.tsx)
                              T21 (after T03, T18)
                              T22 (after T12, T18)
                              T23 (after T14, T18)
                              T24 (after T17a, T17b, T18)
                              T24 → T24.1 (CP2 pick-affordance)
                              T25 (after T17a)
                              T26 (after T18)
                              │
Wave 5 (integration, seq):    T27 → T28
                              │
Wave 6 (verification):        T29 → T30 → T31 → T32 → T33 → T33.1 → T34 → T35 → T35.5 → T35.6 → T36 → T37
                              │
Wave 7 (CP2):                 T38 → T39
```

### Critical path (corrected per CR7)

**True critical path:** PRE-T07 → T07 (Jake interactive) → T08 → T10a → T10c → T13 → T20a (or any T20x) → T29 → T32 → T33 → T36 → T37 → T39.

Total: ~17 hours of serialized work plus T07/T39 Jake-availability.

T17a/T17b (PHILOSOPHY) is parallel-able — its critical-path role is via T24 (philosophy page) which depends on it. T24's path: T07 → T08 → ... → T17a → T17b → T24 → T24.1 → T29 → ... — but this is shorter than the T13→T20→ path because T17b doesn't gate T20a-T20f.

**Practical critical path bottleneck:** T13 (COMPONENTS.md, 3h) + T20a-T20f (6h sequential or 1h if perfectly parallel) + verification stack.

---

## 4. Estimated calendar time

- **Pure-coding hours:** ~37-42 hours of Claude work + ~30 min Jake interactive (PRE-T07 + T07 + T39) + 30 min CP2 review.
- **Calendar:** **5-7 working days** realistic — includes review/checkpoint loops, debug cycles on the components playground, hook-extension iteration, and the 4-hour T17b PHILOSOPHY screen comparisons. (Bumped from 4-6 days due to v2 scope additions.)
- **Critical path:** ~17 hours of serialized work + Jake availability gates T07 (~5min interactive) and T39 (~30min review).
- **Wall time** can compress with aggressive parallelization on Wave 4 (T20a-T20f run as 6 separate background sub-tasks if Claude-context-budget allows).
- **Risk register adjustments** account for hook-iteration false-positives (R10) and reconciliation strawman complexity (R11).

---

## 5. Goal-backward verification

**Phase goal:** "Stage 1.5b can render Drummond-data prototypes against a fully locked design system."

Working backward:

- **Stage 1.5b needs:** PHILOSOPHY direction picked (CP2 via T24.1 button), SYSTEM tokens locked (T12 + T12.1), COMPONENTS inventory in code (T13 + T13.1), PATTERNS contracts written (T14), components playground deployed for visual reference (T18-T26 + T36).
- **CP2 needs:** PHILOSOPHY.md rendered with 3 directions + screen comparisons (T17b) + palette comparison (T21) + typography rendering (T22) + forbidden examples (T25) + pick-affordance (T24.1). Jake can pick one direction in deployed playground.
- **PHILOSOPHY.md rendering needs:** T24 (philosophy page) + T17a (thesis) + T17b (screen comparisons) → which depend on T04 (skill audit) + T12 (SYSTEM tokens for screen styling).
- **Components playground needs:** T20a-T20f category pages → T13 COMPONENTS.md → T05 existing-component audit + T08 shadcn primitives installed → T07 (Jake's interactive shadcn init) → PRE-T07 backup.
- **Vercel preview deploy needs:** T36 push + T29-T31 build/typecheck/lint passing + T18.5 middleware gate working (verified by curl).
- **Hooks enforcement needs:** T10b/T10c/T10d hook extensions → T35.5 positive tests → T11 build still passes after hook reload.

The plan covers every backward-derived prerequisite. Goal achievable in the estimated time.

---

## 6. Risks and mitigations (carried + new)

R1-R12 from SPEC §5 stand. Plus plan-time:

| # | Risk | Mitigation in plan |
|---|---|---|
| RP1 | T07 (`npx shadcn-ui@latest init`) is interactive — Claude can't run it | Plan explicitly assigns T07 to Jake; PRE-T07 backs up config files; T11 catches breakage; revert path documented. |
| RP2 | shadcn init may modify `tailwind.config.ts` in ways that conflict with existing Slate tokens | PRE-T07 backup lets revert. T11 + T11.5 catch immediately. T08b restores `nw-*` breakpoints if shadcn init drops them. |
| RP3 | PHILOSOPHY.md's 3 directions might converge despite Jake's hard requirement | T17a budgets 2h with explicit distinctness self-review checklist (4 axes; at least 2 must vary per pair). PLAN-REVIEW design-pushback agent specifically validates this. |
| RP4 | Components playground render fails at Vercel preview because of CSS-var dark-mode interaction | T26 (dark-mode toggle) is its own task; T32 captures both modes; T29 is the hard gate. |
| RP5 | TypeScript strict mode + TanStack Table v8 + shadcn primitives may produce subtle type errors | T08 + T09 land separately; T11 + T30 catch type issues; resolution per-component. |
| RP6 | Visual regression at 36 screenshots vs realistic time | T32's spot-check approach explicit (5 most-complex components × full coverage; remaining at desktop-light). |
| RP7 | axe-core errors on shadcn primitives that Nightwork didn't author | T33 separates "shadcn-primitive failure" from "custom failure" — primitives that fail get patched in `src/components/ui/` (acceptable per shadcn pattern of code-in-repo) or marked with upstream link. |
| RP8 | T17b (PHILOSOPHY screen comparisons) underestimated at 4h | T17b explicitly budgets 4h for 9 screen mockup descriptions = ~25 min each. If first 3 take >75 min, scope-cut to 6 screens (2 per direction) and surface as plan-review finding. |
| RP9 | T20a-T20f category pages may individually exceed 60min budget if a component has unusually complex variants (e.g., DataGrid with 20+ feature flags) | T20e (data-display) explicitly budgets 60min; if DataGrid alone takes 60min, scope-cut to "DataGrid + ConfidenceBadge with Table deferred to a follow-up T20e.1." Surface as deviation. |
| RP10 | Hook false-positives from T10c (sample-data isolation) catching legitimate type-only imports | Hook regex distinguishes `from '@/lib/supabase/types'` (allowed — type-only path segment) from `from '@/lib/supabase/server'` (rejected — module path). T35.5 positive test verifies. |
| RP11 | T18.5 middleware edit conflicts with `/admin/platform` matcher pattern | T18.5 mirrors `/admin/platform` exactly (lines 65-79 of `src/middleware.ts`); pattern is reusable. |
| RP12 | T24.1 CP2 pick-affordance button writes a marker file at runtime — but Vercel deploy is stateless | Acceptable: the `CHOSEN-DIRECTION.md` marker is committed by Claude after Jake clicks (post-CP2 manual step). T24.1 documents the click→commit handoff in the button's tooltip. |

---

## 7. Open items at PLAN-time

These are not blocking; surfaced for awareness:

- **PHILOSOPHY direction names** are TBD until T17a produces them; Jake's hard rule (must be distinct) is a content gate, not a process gate.
- **TanStack Table v8 migration** — once installed, future work (Wave 1.1) may want to migrate existing tables. Out of 1.5a scope per SPEC §4.
- **Heroicons icons aren't migrated** — T20a-T20f sub-pages reference Heroicons for new components; existing inline-SVG icons in `src/components/` not refactored. Per SPEC §4.
- **Marker file workflow** for CP2 pick (T24.1 button → `.planning/design/CHOSEN-DIRECTION.md` commit) is a Claude-mediated handoff, not a real-time DB write. Documented in PROPAGATION-RULES.md.

---

## 8. PLAN-REVIEW expectations (iteration 2)

`/nightwork-plan-review` runs after this PLAN.md v2 is written. 6 reviewers (architect, planner, multi-tenant-architect, design-pushback, enterprise-readiness, security) in fresh contexts. Skipped: scalability + compliance (no queries / no PII).

Expected to PASS or marginal NEEDS WORK. v2 addresses every CRITICAL + HIGH from iteration 1. Re-run findings should be limited to:
- Newly surfaced issues (not iteration-1 leftovers)
- Deferrable items already logged to MASTER-PLAN.md tech debt
- Forward concerns (Wave 1.1 / 1.5b implementation details that 1.5a scope explicitly defers)

If iteration-2 BLOCKING/CRITICAL emerges, the plan loops to iteration 3 (max 3 per directive). After 3 iterations, escalate to Jake.
