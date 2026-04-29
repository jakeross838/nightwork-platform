# Nightwork — Roadmap

**Source of truth:** `docs/nightwork-plan-canonical-v1.md` §9 (Phase plan — shipped, next, future). Update this file when the canonical plan changes; do not duplicate detail here.

**Last canonical-plan refresh:** 2026-04-29 (commit `d5222a5`).

## Wave structure

Five deployment waves shape the roadmap. The build-system setup (`nwrp1.txt` 2026-04-29) prepares the foundations to support all of them; phases land within each wave incrementally.

| Wave | Theme | Status |
|------|-------|--------|
| 1 | Financial core (invoices, draws, budgets, POs, COs, lien releases, price intelligence, vendors) | partially shipped — Phases 1–8j |
| 2 | Project operations (schedules, daily logs, punchlists, todos, document management) | future |
| 3 | Communication (email intake, weekly updates, notifications, client portal) | partially scoped (notifications shipped) |
| 4 | Intelligence (reports, analytics, AI insights, schedule intelligence) | future — see canonical §1.3 Pillar 3 |
| 5 | Integrations (Procore, QuickBooks, Bluebeam, Buildertrend) | future |

## Phases — shipped

| # | Phase | Notes |
|---|-------|-------|
| 0 | Foundation | scaffold, schema, auth, file storage, cost code seeding |
| 1 | Invoice processing | drag-and-drop, AI parse, PM mobile review, accounting QA queue |
| 2 | Budget + POs | per-job dashboard, PO creation/balance, invoice-PO matching |
| 3 | Change Orders + Draws | CO workflow, G702/G703 generation, PCCO log, lock + revisions |
| 3.1–3.4 | Proposals classifier + review | recently merged via PR #26 |
| 4–8j | Various enhancements (cost intelligence, platform admin, design system Slate, navigation reorg, plan consolidation) | recent work — see git log + `docs/CHANGELOG-plan-consolidation.md` |

## Phases — next (active or imminent)

Pulled from canonical §9; refresh when the canonical updates. The build system supports `/gsd-plan-phase`, `/nightwork-plan-review`, `/gsd-execute-phase`, `/nightwork-qa`, `/gsd-ship`, `/nightwork-end-to-end-test` for each.

- **3.5+** — completing Wave 1 invoicing/draw polish and remaining classifier work (CO, vendor, budget, historical draw extractors).
- **Reconciliation thesis (TBD)** — canonical §2: AI-mediated reconciliation across proposal→contract→budget→PO→CO→invoice→draw boundaries. Open architectural questions to be answered before planning.
- **Wave 2 — Project operations** — schedules, daily logs, punchlists. Schema fields for schedule intelligence (`estimated_start_date`, `estimated_duration_days`, etc.) ship in Phase 3.5+ so data accumulates passively (canonical §1.3 Pillar 3).

## Phases — future

Wave 2 (operations), Wave 3 (communication), Wave 4 (intelligence — reports + Pillar 3 schedule intelligence), Wave 5 (integrations: Procore, QuickBooks, Bluebeam, Buildertrend).

## Open architectural questions

Canonical §11 lists open questions. Among them:

- **Unified Commitment Model (UCM)** — target data model that unifies POs / COs / internal billings / change orders into one commitment graph (canonical §6).
- **Reconciliation surface** — canonical UI for "the books and the field disagree" (canonical §2).
- **Cross-org data sharing tier** — explicitly off today; architecture preserves the option (canonical §1.4).

Resolve these via `/gsd-explore` or `/gsd-spec-phase` before adding phases that depend on them.

## How to propose a new phase

1. Read the relevant section of `docs/nightwork-plan-canonical-v1.md`.
2. `/gsd-add-phase` (adds a stub to the roadmap) OR `/gsd-spec-phase` (locks a spec first).
3. `/gsd-discuss-phase --auto` — surfaces assumptions; mode set to `assumptions` in `.planning/config.json`.
4. `/gsd-plan-phase` — produces PLAN.md.
5. `/nightwork-plan-review` — auto-runs, blocks on critical findings.
6. `/gsd-execute-phase` — produces code.
7. `/nightwork-qa` — auto-runs, blocks on critical findings.
8. `/gsd-ship` — auto-runs `/nightwork-qa` + `/nightwork-end-to-end-test` before opening PR.
