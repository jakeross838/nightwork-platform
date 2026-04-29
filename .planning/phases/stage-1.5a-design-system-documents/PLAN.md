# Plan — stage-1.5a-design-system-documents

**Status:** READY FOR REVIEW (pre-execute)
**Phase:** Stage 1.5a (per MASTER-PLAN.md §12)
**Inputs:** EXPANDED-SCOPE.md (APPROVED), DISCUSSION.md (RESOLVED), SPEC.md (LOCKED)

---

## 1. Goal recap

Lock the Nightwork design system as 6 canonical documents + a live components playground at `/design-system`. 3 distinct PHILOSOPHY directions presented at Strategic Checkpoint #2 with side-by-side renderings of how invoice review / dashboard / mobile approval pages would feel in each direction.

---

## 2. Task breakdown

Tasks numbered T01-T28. Dependency graph + waves below. "Goal-backward verification" follows the task list.

### Wave 1 — Foundation + auditing (parallelizable; no inter-dependencies)

| ID | Task | Estimate | Owner | Depends on |
|---|---|---|---|---|
| T01 | Audit existing `colors_and_type.css` — enumerate every CSS variable + value (light + dark) + Tailwind utility name | 30 min | Claude | — |
| T02 | Audit `tailwind.config.ts` — extract every `nw-*` color, font, animation, breakpoint | 20 min | Claude | — |
| T03 | Compute contrast ratios for every token combination (text-on-bg) — both candidate palette sets per Q1=C | 45 min | Claude | T01 |
| T04 | Audit existing 3 design skills + invoice review template — note what gets cross-referenced vs lifted | 30 min | Claude | — |
| T05 | Audit existing custom components (NwButton, NwEyebrow, NwInput, NwCard, etc.) — codify props + variants for COMPONENTS.md | 60 min | Claude | — |
| T06 | Inventory existing icons in `src/components/` — count usages of inline SVGs to be replaced eventually | 30 min | Claude | — |

### Wave 2 — Dependency installation + scaffolding (sequential — Jake runs `npx shadcn-ui@latest init` interactively)

| ID | Task | Estimate | Owner | Depends on |
|---|---|---|---|---|
| T07 | Run `npx shadcn-ui@latest init` (Jake — interactive) — accept defaults: TS, Tailwind, `src/components/ui/`, `src/lib/utils.ts`, CSS vars | 5 min | Jake | — |
| T08 | Install missing primitives via `npx shadcn-ui@latest add` — combobox, calendar (DatePicker), drawer, tooltip, popover | 10 min | Claude | T07 |
| T09 | Install `@tanstack/react-table` + `@heroicons/react` via `npm install` | 5 min | Claude | T07 |
| T10 | Update `.claude/hooks/nightwork-post-edit.sh` to recognize `src/components/ui/` paths under token enforcement | 30 min | Claude | T08 |
| T11 | Verify `npm run build` passes after dep install (no regressions) | 10 min | Claude | T08, T09 |

### Wave 3 — Document drafting (parallel; T12-T17 can run concurrently after Wave 1-2 completes)

| ID | Task | Estimate | Owner | Depends on |
|---|---|---|---|---|
| T12 | Draft `.planning/design/SYSTEM.md` — full token enumeration, type system, motion, layout, density, accessibility, tenant brand customization | 3 hr | Claude | T01-T03 |
| T13 | Draft `.planning/design/COMPONENTS.md` — inventory with shadcn / TanStack / custom mapping, variants, states, tokens, a11y | 3 hr | Claude | T05, T08 |
| T14 | Draft `.planning/design/PATTERNS.md` — 9 patterns + AppShell with regions, data shapes, states, references | 3 hr | Claude | T04 |
| T15 | Draft `.planning/design/PROPAGATION-RULES.md` — token-add, component-add, pattern-add workflows + propagate orchestrator integration | 1 hr | Claude | T12 |
| T16 | Draft `.impeccable.md` (root) — anchor frontend-design + impeccable skills to SYSTEM/COMPONENTS/PATTERNS | 30 min | Claude | T12, T13, T14 |
| T17 | Draft `.planning/design/PHILOSOPHY.md` — 3 distinct directions with concrete invoice-review / dashboard / mobile-approval comparisons + Forbidden section + reference benchmarks (Procore, Linear, Stripe vs Notion, Slack) | 4 hr | Claude | T04 |

### Wave 4 — Components playground (parallel; T18-T26 after T13)

| ID | Task | Estimate | Owner | Depends on |
|---|---|---|---|---|
| T18 | Create `src/app/design-system/layout.tsx` — gating middleware (platform_admin in prod, all auth in dev), navigation shell | 1 hr | Claude | T07 |
| T19 | Create `src/app/design-system/page.tsx` — index of components + patterns + palette + typography + philosophy + forbidden | 1 hr | Claude | T18 |
| T20 | Create `src/app/design-system/components/[name]/page.tsx` — dynamic route rendering each COMPONENTS.md entry with variants/states/tokens/a11y/anti-patterns | 4 hr | Claude | T13, T18 |
| T21 | Create `src/app/design-system/palette/page.tsx` — Q1 side-by-side palette comparison + per-token contrast labels | 1 hr | Claude | T03, T18 |
| T22 | Create `src/app/design-system/typography/page.tsx` — Slate type system render | 1 hr | Claude | T12, T18 |
| T23 | Create `src/app/design-system/patterns/page.tsx` — every PATTERNS.md entry as static layout. Reconciliation strawman shows all 3 candidate models | 3 hr | Claude | T14, T18 |
| T24 | Create `src/app/design-system/philosophy/page.tsx` — render PHILOSOPHY.md's 3 directions as comparable previews. Each direction has invoice-review-mockup / dashboard-mockup / mobile-approval-mockup as static HTML | 4 hr | Claude | T17, T18 |
| T25 | Create `src/app/design-system/forbidden/page.tsx` — visual examples of each Forbidden item with "DO NOT" overlay | 1 hr | Claude | T17, T18 |
| T26 | Wire dark-mode toggle on playground (re-uses existing ThemeProvider) | 30 min | Claude | T18 |

### Wave 5 — Integration + polish (sequential)

| ID | Task | Estimate | Owner | Depends on |
|---|---|---|---|---|
| T27 | Update existing skills (`nightwork-design`, `nightwork-design-tokens`, `nightwork-ui-template`) to cross-reference new SYSTEM/COMPONENTS/PATTERNS as authoritative | 1 hr | Claude | T12-T15 |
| T28 | Update CLAUDE.md "UI rules" section to defer to SYSTEM.md as single source of truth | 15 min | Claude | T12 |

### Wave 6 — Verification (sequential — runs once everything else lands)

| ID | Task | Estimate | Owner | Depends on |
|---|---|---|---|---|
| T29 | `npm run build` — must pass with zero errors | 5 min | Claude | T20-T26 |
| T30 | `npx tsc --noEmit` strict mode pass | 5 min | Claude | T20-T26 |
| T31 | `npx eslint src/app/design-system` — zero errors | 5 min | Claude | T20-T26 |
| T32 | Visual regression: capture component sub-page screenshots via Chrome DevTools MCP at nw-phone/tablet/desktop × light/dark | 2 hr | Claude | T29 |
| T33 | axe-core automated WCAG 2.2 AA checks on every component sub-page | 1 hr | Claude | T29 |
| T34 | Manual keyboard navigation spot-check on Combobox, DatePicker, Drawer | 30 min | Claude | T29 |
| T35 | Confirm post-edit hook enforces no hardcoded hex outside allowed files (test by attempting one) | 15 min | Claude | T10 |
| T36 | Push branch + verify Vercel preview URL serves `/design-system` | 15 min | Claude | T29 |
| T37 | `/nightwork-qa` runs (spec-checker + design-system-reviewer + ui-reviewer + custodian); critical findings block | 1 hr | Claude | T29-T36 |

### Wave 7 — Strategic Checkpoint #2 readiness

| ID | Task | Estimate | Owner | Depends on |
|---|---|---|---|---|
| T38 | Tag commit "stage-1.5a/cp2-ready" | 2 min | Claude | T37 |
| T39 | Walk Jake through Vercel preview URL `/design-system` for CP2 review (palette pick + philosophy pick) | 30 min | Jake + Claude | T36 |

---

## 3. Dependency graph (textual)

```
Wave 1 (audits, parallel):    T01 T02 T03 T04 T05 T06
                              │
Wave 2 (deps install, seq):   T07 (Jake interactive) → T08 → T09 → T10 → T11
                              │
Wave 3 (docs, parallel):      T12 ──┬── T13 ── T16
                              T14 ──┤
                              T17 ──┤
                                    └── T15 (depends on T12)
                              │
Wave 4 (playground, parallel after T13/T18):
                              T18 → T19, T20-T26 (most parallel)
                              │
Wave 5 (integration, seq):    T27 → T28
                              │
Wave 6 (verification):        T29 → T30 → T31 → T32 → T33 → T34 → T35 → T36 → T37
                              │
Wave 7 (CP2):                 T38 → T39
```

---

## 4. Estimated calendar time

- **Pure-coding hours:** ~35-40 hours of Claude work + ~30 min Jake interactive (T07, T39) + 30 min CP2 review
- **Calendar:** 4-6 working days realistic — accounts for review/checkpoint loops, debug cycles on the components playground, and the 4-hour PHILOSOPHY.md draft (T17 is the longest single task because it produces 3 distinct directions, each with concrete screen-level comparisons).
- **Critical path:** T01-T03 → T12 → T20 → T29-T37 → T39. ~28 hours.

---

## 5. Goal-backward verification

The phase goal: **"Stage 1.5b can render Drummond-data prototypes against a fully locked design system."** Working backward:

- **Stage 1.5b needs:** PHILOSOPHY direction picked (CP2), SYSTEM tokens locked, COMPONENTS inventory in code, PATTERNS contracts written, components playground deployed for visual reference.
- **CP2 needs:** PHILOSOPHY.md rendered with 3 distinct directions + side-by-side screen comparisons + palette comparison + typography rendering. Jake can pick one direction in the deployed playground.
- **PHILOSOPHY.md rendering needs:** T24 (philosophy page) + T21 (palette page) + T22 (typography page) → which depend on T17 (PHILOSOPHY.md draft) + T03 (contrast computation) + T12 (SYSTEM.md draft) → which depend on T01-T05 audits.
- **Components playground needs:** T20 dynamic component pages → T13 COMPONENTS.md → T05 existing-component audit + T08 shadcn primitives installed → T07 (Jake's interactive shadcn init).
- **Vercel preview deploy needs:** T36 push + T29-T31 build/typecheck/lint passing.

The plan covers every backward-derived prerequisite. Goal achievable in the estimated time.

---

## 6. Risks and mitigations (per SPEC §5 + plan-time additions)

| # | Risk | Mitigation in plan |
|---|---|---|
| RP1 | T07 (`npx shadcn-ui@latest init`) is interactive — Claude can't run it; Jake must | Plan explicitly assigns T07 to Jake; T08-T11 sequenced after Jake confirms init complete. Auto-setup MANUAL-CHECKLIST already noted this is interactive — but per nwrp10 SETUP-COMPLETE didn't include it (since shadcn install was deferred to execute). T07 is the actual install moment. |
| RP2 | shadcn init may modify `tailwind.config.ts` in ways that conflict with existing Slate tokens | T11 includes a `npm run build` check to catch immediately; T10 updates the post-edit hook for new paths. T08 + T09 are atomic; if anything breaks, revert the commit. |
| RP3 | PHILOSOPHY.md's 3 directions might converge despite Jake's hard requirement | T17 budgets 4 hours specifically because the directions need to be GENUINELY distinct (Procore-direction vs Linear-direction vs Stripe-direction or some non-obvious axis). If two directions feel similar at draft time, regenerate before T17 completes. PLAN-REVIEW design-pushback agent specifically validates this. |
| RP4 | Components playground render fails at Vercel preview because of CSS-var dark-mode interaction | T26 (dark-mode toggle wiring) is its own task; T32 (visual regression captures both modes); T29 (build passes) is the hard gate. |
| RP5 | TypeScript strict mode + TanStack Table v8 + shadcn primitives may produce subtle type errors | T08 + T09 land separately; T11 + T30 catch type issues; resolution is per-component — TanStack Table + cmdk are well-typed in current versions. |
| RP6 | Visual regression at 12 screenshots × ~30 components = 360 screenshots manual | T32 budgets 2 hours but realistically uses Chrome DevTools MCP `navigate` + `computer` tools efficiently. Target: spot-check 5 most-complex components (DataGrid, Combobox, Modal, Drawer, Form) at full breakpoint × mode coverage; remaining components get single-state screenshots. |
| RP7 | axe-core errors on shadcn primitives that Nightwork didn't author | T33 separates "shadcn-primitive failure" from "Nightwork-custom failure" — primitives that fail get patched in `src/components/ui/` (acceptable per shadcn pattern of code-in-repo) or marked as known-issue with upstream link. Custom components must pass. |
| RP8 | Tasks T20 (dynamic component sub-pages) underestimated at 4 hours | If T20 expands beyond budget, scope-cut to "component index + 5 most-critical sub-pages" + defer remaining sub-pages to a follow-up. PHILOSOPHY direction pick is the gating moment for CP2, not full sub-page coverage. |

---

## 7. Open items at PLAN-time

These are not blocking; surfaced for awareness:

- **Heroicons icons aren't migrated.** T20 component sub-pages may reference Heroicons; existing inline-SVG icons in `src/components/` not refactored. Refactor is a future phase.
- **`nw-phone / nw-tablet / nw-desktop` breakpoint aliases need Tailwind config addition.** Wave 2 should add these to `tailwind.config.ts` — added as T08.5 (sub-task within T08-T11).
- **PHILOSOPHY direction names** are TBD until T17 produces them; Jake's hard rule (must be distinct) is a content gate, not a process gate.

---

## 8. PLAN-REVIEW expectations

`/nightwork-plan-review` runs after this PLAN.md is written. 6 reviewers in fresh contexts (architect, planner, multi-tenant-architect, design-pushback, enterprise-readiness, security-reviewer). Skipped: scalability (no queries / no aggregations / docs-only), compliance (no PII / no schema / no audit-log changes).

Expected to PASS unless reviewers find:
- Missing acceptance criterion (would force SPEC.md update)
- Underestimated task (would force PLAN.md update)
- Cross-cutting concern not addressed (e.g., per-org brand customization implementation not detailed enough)
- Design-pushback finding (Jake's stated scope conflicts with reviewer's read of canonical design)

If review verdict is BLOCKING, /np re-runs after correction. If NEEDS WORK, the corrections are flagged for execute-time attention.
