# Phase 1.5b: prototype-gallery — Context

**Gathered:** 2026-05-01 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Throwaway HTML prototype gallery on sanitized Drummond data, rendered in locked Site Office direction + Set B palette. Validates whether the design system actually works for real construction workflows before F1-F4 foundations begin. 11 deliverables (10 prototype routes + 1 Drummond fixture sanitization). Per D-009 sequencing: 1.5a documents → 1.5b prototype gallery → 1.5c test infrastructure. Strategic Checkpoint #2 closed (Site Office + Set B locked per D-037).

**Sources of truth (locked):**
- EXPANDED-SCOPE.md (APPROVED 2026-05-01 with overrides Q2=C, Q7=tiered, R1 4-day halt rule)
- AUTO-LOG.md (D1-D5 strategic questions, all now resolved per Jake's nwrp29 directive)
- SETUP-COMPLETE.md (M1+M2 LOCKED, M3 PENDING ship-time)
</domain>

<decisions>
## Implementation Decisions

### Route Organization
- **D-01:** All 11 prototype routes under `src/app/design-system/prototypes/` as a sibling to existing playground routes (patterns/, palette/, philosophy/, typography/, forbidden/, components/), inheriting parent layout.tsx chrome, design-system.css, hook T10c isolation, and middleware platform_admin gating without modification. Each prototype is a subdir with `page.tsx` (and `print/page.tsx` nested under `draws/[id]/print/`).
- **D-02:** New `prototypes/layout.tsx` overrides parent layout's DirectionPaletteSwitcher and forces `data-direction="C" data-palette="B"` (locking the CP2 pick during walkthrough — prevents accidental flips to Helm + Brass mid-walkthrough that would defeat the validation goal).

### Fixture Loader Pattern
- **D-03:** `src/app/design-system/_fixtures/drummond/*.ts` mirrors existing `_fixtures/{jobs,vendors,invoices,draws,change-orders,cost-codes,users}.ts` shape — each file exports a typed const array. Barrel `index.ts` re-exports everything.
- **D-04:** Use `DRUMMOND_*` named constants (vs `SAMPLE_*` for fictional fixtures) to keep playground's fictional fixtures separable from Drummond's sanitized fixtures during cross-imports.
- **D-05:** Drummond-only types extend the existing pattern: `DrummondLienRelease` (4-statute enum + status without history JSONB per gap #7), `DrummondBudgetLine` (computed math vars per CLAUDE.md), `DrummondScheduleItem` (Wave 2 entity per Q2 override C — see D-11), `DrummondPayment` (inferred from invoice fields per CURRENT-STATE A.2).
- **D-06:** All sanitized data lives as static const arrays — no runtime extraction at prototype-render time. The extractor script writes once during execute-phase.

### Reconciliation Strawman Organization
- **D-07:** Single page at `src/app/design-system/prototypes/reconciliation/page.tsx` rendering 4×2 matrix top-to-bottom (per drift-type sections: invoice↔PO, draw↔budget). Each section contains 4 candidate Cards stacked. Section anchors enable side-by-side scrolling comparison.
- **D-08:** Extends existing `ReconciliationStrawman` function in `src/app/design-system/patterns/page.tsx:1149-1279` (which already implements the 4 candidate visual shapes: side-by-side delta, inline diff, timeline overlay, hybrid split+inline). Reuses 1.5a-locked PATTERNS.md §11 strawman — does NOT diverge, would force forbidden rewrite per A16.1.
- **D-09:** Drummond drift fixtures live at `_fixtures/drummond/reconciliation.ts` as paired `imported` / `current` shapes derived from real Source 3 invoice-vs-PO and pay-app-vs-budget mismatches.

### Schedule (Gantt) Implementation
- **D-10:** **Use TanStack Table v8** (already installed `@^8.21.3` per `package.json:27`) with custom timeline cell renderers — NOT from-scratch CSS grid. TanStack handles virtualization, sorting, column sizing; we write only the bar-rendering logic on top. Fallback if TanStack timeline support insufficient: lightweight Gantt library (frappe-gantt or similar small well-maintained dep). NOT custom CSS grid Gantt — known time sink.
- **D-11:** **`schedule_items` proposed shape (1.5b — NOT canonical, F1 may revise):**
  ```typescript
  type DrummondScheduleItem = {
    id: string;
    job_id: string;
    name: string;
    start_date: string;          // ISO date
    end_date: string;            // ISO date
    predecessor_ids: string[];   // dependencies
    parent_id?: string;          // hierarchical tasks (constant in real construction schedules)
    assigned_vendor_id?: string;
    percent_complete: number;    // 0-1
    status: 'not_started' | 'in_progress' | 'complete' | 'blocked';
    is_milestone: boolean;       // milestones render as diamonds in Gantt, not bars; pay app dates are milestones
  };
  ```
  Schema lock happens in F1; 1.5b implementation may discover real complexity that informs F1 revision.
- **D-12:** Use real Drummond `Schedule_*.xlsx` data, NOT reconstructed dates from pay app + lien dates. Source 3 has `Schedule_List_Drummond-501 74th St.xlsx` + `Schedule_Gantt_Drummond-501 74th St (12).pdf` already staged. The .xlsx provides the actual ~6-month schedule shape.

### G702/G703 Print Stylesheet
- **D-13:** Pure CSS `@page` + `@media print` against the existing component tree — NO server-side PDF generator (puppeteer/playwright). Print route at `src/app/design-system/prototypes/draws/[id]/print/page.tsx` extends existing print stylesheet in `src/app/globals.css:255-289` (covers chrome hide, page break, table borders, link styling, animation disable).
- **D-14:** Replicate the conditional-rendering pattern in real `src/app/draws/[id]/page.tsx:269-470` (`print:hidden` chrome + `hidden print:block` content). Existing PATTERN 9 in `patterns/page.tsx:1048-1143` is the visual contract (G703 simulated table with JetBrains Mono tabular-nums, UPPERCASE column headers at 9px / 0.08em).
- **D-15:** Per Q7 override: G702 cover sheet attempts pixel-perfect against `Pay Application #5 - Drummond-501 74th St.pdf`. G703 detail page accepts 80%. Density forced compact via SYSTEM.md §10b's existing `@media print { :root { --density-row: var(--density-compact-row) } }`.
- **D-16 — HALT POINT:** **G702 1-day judgment.** If pixel-perfect G702 attempt exceeds 1 day during execute, drop to 80% on both G702 and G703 and continue. Log as 1.5b-followup if pixel-perfect ultimately required for production.

### PDF Parsing Strategy (D1 resolved)
- **D-17:** Manual Read via Claude Code's Read tool for 4-6 priority invoices + lien release PDF. `exceljs` (already shipped @^4.4.0) for all 5 pay apps + budget XLSX + schedule XLSX. NO new `pdf-parse` npm dep.
- **D-18:** **One-time pre-step:** re-save 4 `.xls` files as `.xlsx` (exceljs doesn't read legacy .xls binary OLE compound document format). Pre-extraction step for execute-phase. After re-save, exceljs handles all 5 pay apps uniformly.
- **D-19:** **Fallback note:** if manual Read approach is too slow for the broader ~94 invoice PDFs, parse only the 4-6 priority invoices manually; render remaining invoices with line-item summaries extracted from pay apps rather than per-invoice extraction. Document as 1.5b-followup tech debt if needed.

### Build-Time Grep Check (D5 resolved — Option 2)
- **D-20:** **Two-tier grep gate:**
  1. **Extractor-side** (`scripts/sanitize-drummond.ts`) — runs before writing sanitized output, reads real-name list from gitignored SUBSTITUTION-MAP.md, fails extraction if real names detected post-substitution.
  2. **CI-side** (`.github/workflows/`) — runs against committed `src/app/design-system/_fixtures/drummond/*.ts` to catch hand-written drift bypassing the extractor. Hardcoded list of ~17-20 high-risk Drummond identifiers (Drummond, 501 74th, Holmes Beach, 17 vendor names).
- **D-21:** Privacy posture: real names already appear in committed `CLAUDE.md` / `VISION.md` / `MASTER-PLAN.md` and the repo is private. Defense-in-depth justified. CI list intentionally narrow (~17-20 entries, high-risk identifiers only) to bound the leak surface.
- **D-22:** SUBSTITUTION-MAP.md remains gitignored as authoritative source. Updates to vendor list must be reflected in BOTH the gitignored SUBSTITUTION-MAP.md AND the CI workflow's hardcoded list.

### Halt Points (per Jake's nwrp29 plan-phase instructions)
- **D-23 — R1 hard halt:** at fixture-extractor completion (2-day estimate). Stop and verify sanitized output before any prototype rendering begins. R1 escalation: if extraction passes 4 days (2x overrun), halt and tell Jake — fallback options Q4=B compressed fixture OR scope-cut another deliverable.
- **D-24 — G702 1-day halt:** see D-16. If pixel-perfect attempt exceeds 1 day, drop to 80% and continue.

### M3 Phone Gate Placeholder
- **D-25:** M3 phone info (PENDING from nwrp27 literal `[PHONE]`) MUST be substituted in EXPANDED-SCOPE.md §0 + MANUAL-CHECKLIST.md M3 before `/nx` execute completes. The QA spec-checker validates against a concrete device. PLAN.md's acceptance criteria carries the placeholder forward.

### Privacy Posture (D-26 + D-27, locked 2026-05-04 per nwrp31)
- **D-26 — substitution-map redaction:** Substitution pairs (real → fictional name mappings) MUST NOT be inlined in committed planning artifacts. PLAN-1's original `<interfaces>` block contained the full substitution table — redacted in the post-37c5a92 redaction commit. Future PLAN / CONTEXT / RESEARCH / PATTERNS / EXPANDED-SCOPE files reference the gitignored `.planning/fixtures/drummond/SUBSTITUTION-MAP.md` instead. Historical exposure at commit 37c5a92 is accepted (residual threat T-1.5b-W0-07; repo private; force-push avoided per nwrp31). Plan-level reviewers (architect, security-reviewer, compliance) MUST flag any new inlined substitution pair on future PRs.
- **D-27 — caldwell-* prefix:** Sanitized fixture identifiers use `caldwell-*` prefix (e.g., `j-caldwell-1`, `v-caldwell-coastal-smart-systems`, `inv-caldwell-001`, `d-caldwell-05`). NOT `drummond-*`. The directory `_fixtures/drummond/` retains the "Drummond reference job" labeling (matches CLAUDE.md / MASTER-PLAN.md / VISION.md naming) — this is documentation labeling, not data, and is accepted leak per D-21.
- **Defense-in-depth grep gate (per nwrp31 #2 + #3):** Three tiers — (1) extractor-side in `scripts/sanitize-drummond.ts` (refuses to write if real names survive substitution), (2) Claude-pre-commit in `.claude/hooks/nightwork-pre-commit.sh` (blocks Claude-initiated commits with real names in `src/app/design-system/_fixtures/drummond/`), (3) CI-side in `.github/workflows/drummond-grep-check.yml` (blocks PRs/pushes to main). The CI pattern is broadened beyond the original 17-vendor list to include Tier 2 Ross Built customers (Dewberry, Pou, Krauss, Duncan, Molinari, Markgraf, Harllee, Fish, Clark) + canonical PM names (Lee Worthy, Nelson Belanger, Bob Mozine, Jason Szykulski, Martin Mannix). All three tiers share the same pattern.
- **Sanitize-script CI guard (per nwrp31 #5):** `scripts/sanitize-drummond.ts` throws at startup if `process.env.CI === "true"` or `process.env.VERCEL === "1"` — local-only execution; prevents accidental cloud run from leaking real filenames to build logs.
- **Sanitize-script gitignore hard-fail (per nwrp31 #4):** `scripts/sanitize-drummond.ts` runs `git check-ignore -v` against `scripts/drummond-invoice-fields.json` at startup; throws if file exists but is not gitignored. Belt-and-braces.

### Folded Todos
None — `gsd-sdk query todo.match-phase 1.5` returned 0 matches.

### Claude's Discretion
- **Tactical sub-decisions during implementation** (e.g., specific Card variant choice for owner portal vs invoice review, exact column proportions for G703 row, exact bar-color encoding for Gantt status states) — Claude decides during execute, applying Site Office tokens consistently. Halt only if a tactical choice would force a SYSTEM.md / COMPONENTS.md / PATTERNS.md update.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope (locked)
- `.planning/expansions/stage-1.5b-prototype-gallery-EXPANDED-SCOPE.md` — APPROVED 2026-05-01 with overrides (Q2=C schedule kept / daily log dropped, Q7=tiered fidelity G702 pixel-perfect + G703 80%, R1 4-day halt rule). Contains 11 deliverables, 17 mapped entities, 10 acceptance criteria.
- `.planning/expansions/stage-1.5b-prototype-gallery-AUTO-LOG.md` — D1-D5 strategic questions and recommendations.
- `.planning/expansions/stage-1.5b-prototype-gallery-SETUP-COMPLETE.md` — infrastructure state (M1+M2 LOCKED, M3 PENDING ship-time).
- `.planning/expansions/stage-1.5b-prototype-gallery-MANUAL-CHECKLIST.md` — M3 PENDING tracking.

### Design system (locked at 1.5a / CP2)
- `.planning/design/SYSTEM.md` — design tokens, motion contracts, density modes, accessibility.
- `.planning/design/COMPONENTS.md` — component primitives (Button, Card, DataGrid, Combobox, etc.) + tenant-blind primitives rule + Icon Library Boundary.
- `.planning/design/PATTERNS.md` — 12 page patterns. **§2 Document Review (gold standard)**, **§10 Print View**, **§11 Reconciliation (4 candidates strawman)**, §5 Mobile Touch Approval.
- `.planning/design/PHILOSOPHY.md` — Site Office direction explanation (locked DRAFT until CP2; CP2 closed 2026-04-30).
- `.planning/design/CHOSEN-DIRECTION.md` — Site Office + Set B locked 2026-05-01 per D-037.
- `.planning/design/PROPAGATION-RULES.md` — design system change workflow.

### Architecture
- `.planning/architecture/VISION.md` — entity model + Wave structure.
- `.planning/architecture/CURRENT-STATE.md` — what's built today + entity status (F.4 Drummond ingestion gap).
- `.planning/architecture/TARGET.md` — F1-F4 target state.
- `.planning/architecture/GAP.md` — F1-F4 sequencing.
- `.planning/architecture/CP1-RESOLUTIONS.md` — D-029 (substitution-map workflow), D-036 (reconciliation strawman as 1.5b deliverable).
- `.planning/architecture/DRUMMOND-FIXTURE-SUMMARY.md` — Drummond Source 1+2+3 inventory; uses sanitized counts only.

### Operational rules
- `CLAUDE.md` — Drummond reference job, Site Office direction lock, hook T10c, design tokens always, R.1-R.23 rules.
- `docs/nightwork-plan-canonical-v1.md` — full plan §1-§13 incl §10 Drummond, §11 open questions.
- `.planning/MASTER-PLAN.md` — D-009 (design-system-before-features), D-029 (substitution-map), D-036 (reconciliation in 1.5b), D-037 (Site Office + Set B), D-038 (rgba drift deferred), D-039 (CP marker file persistence).

### Codebase intelligence
- `.planning/codebase/STACK.md` — Next.js 14, TanStack Table 8.21.3, exceljs 4.4.0, react-pdf 7.7.3, Tailwind, Sentry.
- `.planning/codebase/STRUCTURE.md` — repo layout (`src/app/`, `src/components/`, `src/lib/`).
- `.planning/codebase/CONVENTIONS.md` — coding conventions.

### Hooks + middleware
- `.claude/hooks/nightwork-post-edit.sh:194-230` — T10c sample-data isolation in `src/app/design-system/*`.
- `src/middleware.ts:98-117` — `/design-system/*` platform_admin gate (inherits to `prototypes/*` via `startsWith`).

### Drummond fixtures (gitignored — local only)
- `.planning/fixtures/drummond/source3-downloads/` — 19 staged raw files (5 pay apps, budget XLSX, schedule XLSX, lien releases PDF, combined invoices PDF, contract DOCX, 6 split-invoices).
- `.planning/fixtures/drummond/SUBSTITUTION-MAP.md` — locked 17 vendor + owner + address mappings (gitignored authoritative source).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/design-system/layout.tsx` — parent layout with DirectionPaletteShell (chrome inheritance for sidebar + top-right logo + theme toggle).
- `src/app/design-system/design-system.css` — direction + palette overrides (Site Office variant defaults — UPPERCASE eyebrows, JetBrains Mono dominance, compact density, 1px slate-tile left-stamp, 150ms ease-out).
- `src/app/design-system/_fixtures/index.ts` — barrel export pattern to mirror for `_fixtures/drummond/`.
- `src/app/design-system/_fixtures/{jobs,vendors,invoices,draws,change-orders,cost-codes,users}.ts` — fictional fixture types (`SampleInvoice`, `SampleJob`, etc.) to extend with `Drummond*` types.
- `src/app/design-system/patterns/page.tsx:256-1390` — Document Review (§2 gold-standard layout), Print View (§10), Reconciliation (§11 with 4 candidates), Multi-step Approval (§3) — patterns to extend.
- `src/app/globals.css:255-289` — existing print stylesheet base (chrome hide, page break, table borders, link styling, animation disable).
- `src/app/draws/[id]/page.tsx:269-470` — real draws print pattern precedent (`print:hidden` chrome + `hidden print:block` content + `window.print()` button).
- `src/components/ui/` — tenant-blind primitives (Button, Input, Combobox, DatePicker, Card, Modal, Drawer, Tabs, Toast, Banner, Tooltip, Popover, Form, Table, DataGrid, ConfidenceBadge).
- `src/components/nw/` — Nightwork-specific UI patterns.
- TanStack Table v8 (`@tanstack/react-table@^8.21.3` per `package.json:27`; in use at `src/app/design-system/patterns/data-display/page.tsx:451`) — **canonical Gantt foundation per D-10**.
- `exceljs` (`@^4.4.0`) — XLSX parsing for pay apps + budget + schedule.

### Established Patterns
- Hook T10c forbids `@/lib/(supabase|org|auth)` imports in `src/app/design-system/*`. Type-only imports from `@/lib/supabase/types/*` permitted. Pure data exports (the fixture pattern) always pass.
- Design tokens via CSS vars only; no hardcoded hex (post-edit hook enforces per `nightwork-post-edit.sh`).
- Site Office variant (locked per D-037): UPPERCASE eyebrows + 0.18em tracking + JetBrains Mono dominance + compact density + 1px slate-tile left-stamp + 150ms ease-out.
- Print stylesheet auto-forces compact density via SYSTEM.md §10b.
- Fixture barrel pattern: `_fixtures/<entity>.ts` exports `<TypeName>` + `SAMPLE_<UPPER>`; `_fixtures/index.ts` re-exports.

### Integration Points
- `src/middleware.ts:98` `pathname.startsWith("/design-system/")` covers all `prototypes/*` subroutes — no middleware changes needed.
- `src/app/design-system/layout.tsx` provides chrome inheritance — new `prototypes/layout.tsx` overrides DirectionPaletteSwitcher to lock CP2 pick (per D-02).
- Existing PATTERN 9 (`patterns/page.tsx:1048-1143`) is the visual contract for G703 print rendering.

</code_context>

<specifics>
## Specific Ideas

- **TanStack Table v8 for Gantt** explicitly chosen (D-10) — not custom CSS grid, not new library by default. Custom timeline cell renderers on top of TanStack's row/column infrastructure.
- **Real Drummond Schedule_*.xlsx** files (already staged) used for Gantt data — NOT reconstructed dates from pay app + lien release dates as EXPANDED-SCOPE §1.2 hedged.
- **Two-tier grep gate** (D-20): extractor-side authoritative + CI-side defense-in-depth with hardcoded ~17-20 entry list. Repo is private; names already in CLAUDE.md/VISION.md/MASTER-PLAN.md context.
- **Explicit halt points** baked into plan acceptance criteria: R1 fixture extractor 2-day (D-23), G702 pixel-perfect 1-day (D-16/D-24).
- **M3 phone gate placeholder** (D-25) carried forward to PLAN.md acceptance criteria — Jake provides device info before `/nx`.
- **schedule_items shape** (D-11) is 1.5b proposed — NOT canonical. Includes `parent_id?` (hierarchy) and `is_milestone` (Gantt diamonds for pay app dates) per Jake's additions.

</specifics>

<deferred>
## Deferred Ideas

- **frappe-gantt (or similar Gantt library)** — fallback if TanStack Table + custom timeline cells prove insufficient during execute (D-10 fallback path). Decision deferred to execute-phase based on first attempt's complexity.
- **Per-invoice extraction for ~94 PDFs** — if manual Read approach is too slow during fixture extraction, render remaining invoices with line-item summaries from pay apps. Document as 1.5b-followup tech debt if needed (per D-19).
- **Pixel-perfect G702 (full AIA Document Service certification)** — 1.5b attempts; if escape clause activates (D-16), log as 1.5b-followup. Bank-format certification lands when real AIA generation ships (Wave 3+).
- **Pixel-perfect AIA G703 detail** — out of scope per Q7 override; Wave 3+.
- **`schedule_items` canonical schema** — proposed shape NOT canonical; F1 may revise based on real complexity discovered in 1.5b implementation. Schema lock happens in F1.
- **Daily log view** — out of scope per Q2 override C; defers to Wave 2 phase.
- **Owner portal photos / messages / lien viewer** — out of scope per Q8=B; Wave 3 entities.
- **CP marker-file persistence re-architecture** (per D-039 / Q10=C) — pre-CP3 infra task, not 1.5b.
- **1.5a-followup-1 rgba opacity drift fix** (per D-038) — polish phase work, not 1.5b.

### Reviewed Todos (not folded)
None — todo.match-phase returned 0 matches.

</deferred>

---

*Phase: stage-1.5b-prototype-gallery*
*Context gathered: 2026-05-01 (assumptions mode, 7 areas surfaced, 1 corrected: schedule impl tech, 1 D5 resolved: grep gate Option 2)*
