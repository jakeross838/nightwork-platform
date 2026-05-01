# Phase 1.5b: prototype-gallery — Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-05-01
**Phase:** stage-1.5b-prototype-gallery
**Mode:** assumptions
**Areas analyzed:** Route organization, Fixture loader pattern, Reconciliation strawman organization, Schedule (Gantt) implementation tech, G702/G703 print stylesheet approach, PDF parsing strategy (D1), Build-time grep check location (D5)
**Calibration:** standard (no USER-PROFILE.md found)

---

## Assumptions Presented

### Route organization

| Assumption | Confidence | Evidence |
|---|---|---|
| All 11 prototypes under `src/app/design-system/prototypes/` (sibling to existing playground routes), inheriting parent chrome + hook T10c + middleware gate | Confident | `src/middleware.ts:98` startsWith match covers subroutes; `nightwork-post-edit.sh:202` regex covers nested dirs; EXPANDED-SCOPE §2 gap #3 |
| New `prototypes/layout.tsx` overrides parent's DirectionPaletteSwitcher to lock Site Office + Set B | Confident | `src/app/design-system/layout.tsx` parent layout uses DirectionPaletteShell which is switchable; CP2 pick is locked per D-037 — must not flip mid-walkthrough |

### Fixture loader pattern

| Assumption | Confidence | Evidence |
|---|---|---|
| `_fixtures/drummond/*.ts` mirrors existing `_fixtures/{jobs,vendors,...}.ts` shape; `DRUMMOND_*` constants vs `SAMPLE_*`; barrel index.ts; static const arrays | Confident | `_fixtures/index.ts` already establishes barrel pattern; README at `_fixtures/drummond/README.md:17-30` commits to file list; existing `Sample*` types provide starting point |

### Reconciliation strawman organization

| Assumption | Confidence | Evidence |
|---|---|---|
| Single page at `prototypes/reconciliation/page.tsx` with 4×2 matrix top-to-bottom (per drift-type sections); section anchors enable side-by-side scrolling | Likely | EXPANDED-SCOPE §6 Q3=C + Q6=A+B sets matrix at 4×2=8; existing `ReconciliationStrawman` in `patterns/page.tsx:1149-1279` already implements 4 candidate visual shapes; Q3 rationale "leading candidate becomes visually obvious" requires matrix scroll |

### Schedule (Gantt) implementation tech

| Assumption | Confidence | Evidence |
|---|---|---|
| Custom TimelineGrid via CSS grid + absolute-positioned bars (NO new npm dep); 7-day-per-column × ~26 weeks; Site Office tokens | Likely | AUTO-LOG D2 Recommended A; package.json no Gantt lib; EXPANDED-SCOPE §0 acceptance criterion validates Site Office Gantt readability — tokens primary, not library override |

### G702/G703 print stylesheet approach

| Assumption | Confidence | Evidence |
|---|---|---|
| Pure CSS @page + @media print extending globals.css:255-289; replicate real `draws/[id]/page.tsx:269-470` print pattern; G702 pixel-perfect attempt + G703 80% per Q7 override | Confident | AUTO-LOG D3 Recommended A; existing globals.css covers 80% of print machinery; SYSTEM.md §10b forces print=compact density; SYSTEM.md §8e disables animations in print; existing draws print precedent |

### PDF parsing strategy (D1)

| Assumption | Confidence | Evidence |
|---|---|---|
| Manual Read for invoices + lien release; exceljs for all 5 pay apps + budget + schedule; one-time pre-step re-save 4 .xls files as .xlsx (exceljs doesn't read legacy .xls binary) | Likely | AUTO-LOG D1 Recommended B; `package.json:31` exceljs ^4.4.0 shipped; no pdf-parse; `scripts/inspect-xlsx.mjs` confirms XLSX-via-exceljs precedent |

### Build-time grep check location (D5)

| Assumption | Confidence | Evidence |
|---|---|---|
| Extractor-side gate + CI-side gate (Option 2 in AUTO-LOG D5); privacy posture for CI list unresolved (embed names vs Vercel env-var vs extractor-only) | Unclear | EXPANDED-SCOPE §2 gap #6 + acceptance criterion mandates check; SUBSTITUTION-MAP.md gitignored creates CI list dilemma; .gitignore:94 blocks .planning/* |

---

## Surfaced Gap (not flagged in EXPANDED-SCOPE)

The Wave 2 schedule entity (`schedule_items`) has NO existing TypeScript shape in `_fixtures/` types nor in `src/lib/types/`. EXPANDED-SCOPE §1.2 marks it MISSING but does not specify the type — 1.5b must invent it.

**Analyzer's proposed shape:**
```typescript
{ id, job_id, name, start_date, end_date, predecessor_ids[], assigned_vendor_id, percent_complete, status }
```

**Jake's additions (approved per nwrp29):**
- `parent_id?: string` — for hierarchical tasks (real construction schedules have this constantly)
- `is_milestone: boolean` — milestones render as diamonds in Gantts (not bars); pay app dates are effectively milestones

**Final shape:**
```typescript
{ id, job_id, name, start_date, end_date, predecessor_ids[], parent_id?, assigned_vendor_id, percent_complete, status, is_milestone }
```

**Caveat:** NOT canonical yet. Folded into CONTEXT.md as "1.5b proposed shape, F1 may revise based on real complexity discovered in 1.5b implementation." Schema lock happens in F1.

---

## Corrections Made

### Schedule (Gantt) implementation tech (Area 4) — CORRECTED

- **Original assumption:** Custom TimelineGrid built from CSS grid + absolute-positioned bars (no new npm dep). 7-day-per-column grid × ~26 weeks; task rows as `data-slot="card"` blocks with `position: relative`; bars via `position: absolute`.
- **User correction (nwrp29):** Use **TanStack Table v8** (already installed @^8.21.3) with custom timeline cell renderers — NOT from-scratch CSS grid. TanStack handles virtualization, sorting, column sizing; we write only bar-rendering logic on top. **Fallback** if TanStack timeline support insufficient: lightweight Gantt library (frappe-gantt or similar small well-maintained dep). NOT custom CSS grid Gantt — known time sink.
- **Reason:** Custom CSS grid Gantt is a known time sink. TanStack Table provides virtualization, sorting, column sizing for free — write bar-rendering on top. If TanStack proves insufficient, drop to a small Gantt library rather than continuing custom-CSS-grid effort.

### Build-time grep check location (D5, Area 7) — RESOLVED (was Unclear)

- **Original assumption:** Extractor + CI gate; privacy posture between three options (embed real names in committed CI / Vercel env-var injection / extractor-only) unresolved.
- **User decision (nwrp29):** **Option 2 — Extractor + CI with hardcoded list.**
  - Names (Drummond, 501 74th, Holmes Beach, ~17 vendor names) already appear in committed `CLAUDE.md` / `VISION.md` / `MASTER-PLAN.md`.
  - Repo is private.
  - Defense-in-depth justified: extractor catches drift in extracted fixtures, CI catches drift in hand-written files.
  - Keep CI list narrow (high-risk identifiers only, ~17-20 entries).

### PDF parsing strategy (D1, Area 6) — CONFIRMED with note

- **Original assumption:** Manual Read for 4-6 invoices + lien release; exceljs for XLSX (re-save .xls one-time).
- **User confirmation (nwrp29):** Approved.
- **Added note:** If manual Read approach is too slow for the broader ~94 PDFs, parse only the 4-6 priority invoices manually; render remaining invoices with line-item summaries extracted from pay apps rather than per-invoice extraction. Document as 1.5b-followup tech debt if needed.

---

## Auto-Resolved

None — no `--auto` flag passed to /np.

---

## External Research

None — analyzer flagged 0 research gaps. Codebase + EXPANDED-SCOPE + AUTO-LOG provide complete coverage. Two areas where codebase alone is incomplete:

1. **D5 grep-list privacy posture** — resolved by Jake's directive nwrp29 (Option 2).
2. **Q7 G702 pixel-perfect first-attempt judgment call** — deferred to execute-phase escape-clause activation per D-16; not a research gap.

---

## Plan-Phase Instructions (per Jake's nwrp29 directive)

Carried forward to PLAN.md acceptance criteria:

1. **Use TanStack Table v8 for Gantt** (D-10) with custom timeline cell renderers; frappe-gantt fallback if TanStack timeline support insufficient.
2. **Implement Option 2 grep gates** (D-20): extractor-side + CI-side hardcoded list.
3. **Bake in M3 phone gate placeholder** (D-25): Jake provides device info before /nx; QA spec-checker validates against concrete device.
4. **Explicit halt at fixture-extractor completion** (D-23 / R1 hard blocker, 2-day estimate): stop and verify before prototype rendering begins.
5. **Explicit halt at G702 pixel-perfect attempt** (D-16 / D-24): if attempt exceeds 1 day, drop to 80% on both G702 and G703 and continue; log as 1.5b-followup if pixel-perfect ultimately required for production.

**Per Jake:** PLAN.md drafts → HALT before /nightwork-plan-review for Jake to read high-level structure.
