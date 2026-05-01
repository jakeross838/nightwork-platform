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

Pulled from canonical §9 + Stage 1 architecture (`.planning/architecture/{VISION,CURRENT-STATE,TARGET,GAP}.md`) + CP1 resolutions. The build system supports `/nightwork-init-phase`, `/np`, `/nx`, `/gsd-ship`, `/nightwork-end-to-end-test` for each foundation/wave phase. Per D-018, every phase begins with `/nightwork-init-phase`.

**Stage 1.5 — Design system + prototype gallery + test infrastructure (next):**
- 1.5a — `.planning/design/PHILOSOPHY.md`, `SYSTEM.md`, `COMPONENTS.md`, `PATTERNS.md`.
- 1.5b — Prototype gallery on Drummond data: invoice review, draw assembly, budget dashboard, CO log, lien-release flow, settings, owner portal stub, **+ reconciliation-surface mock-up (per D-036)**. **Strategic Checkpoint #2** with Jake.
- 1.5c — Drummond fixture loader + Playwright e2e harness + automated `/nightwork-end-to-end-test` runs in CI.

**Stage 2 — Foundations F1–F4 (post-1.5; F0 absorbed into F1 per D-035):**
- **F1 — Unified entity model** (~6–8 days): cost-code consolidation wipe-and-reseed, drop `public.users` + `change_order_budget_lines`, promote `payments`, add `gl_codes` (NAHB-seeded) + `approvals`, address split (`construction_address`/`billing_address`), universal envelope V.1 audit.
- **F2 — Workflow framework** (~7–10 days): `transitionEntity` helper, approval framework wiring `approval_chains` (invoice first), `send_back` cascade fix, `withAuditWrap` middleware, embedding-on-create wiring.
- **F3 — Platform primitives** (~10–14 days): Inngest Cloud + pg_cron, idempotency, rate limit, RLS policy-stack collapse via `/nightwork-propagate`, V.2 portability framework, structured logger, CI test gate.
- **F4 — Refactor + Drummond back-import** (~8–12 days): `requireRole` adoption, `withOrg` wrapper, UI uniformity 4/4, audit-log coverage 95%+, **Drummond historical back-import via V.2 framework as dogfood (per D-025)**.
- **Strategic Checkpoint #3** between F4 and Wave 1.

**Stage 3 — Wave 1 polish + completion:**
- **Wave 1.1 — Invoice approval polish + ship to Ross Built** (Strategic Checkpoint #4 / Wave 1 mini).
- **Phases 3.5+** — completing Wave 1 classifier work (CO, vendor, budget, historical draw extractors). Reconciliation thesis (canonical §2) lands as own phase post-3.9 per D-028.

**Stages 4+ — Wave 2 → 5 in canonical order.**

## Phases — future

Wave 2 (operations), Wave 3 (communication), Wave 4 (intelligence — reports + Pillar 3 schedule intelligence), Wave 5 (integrations: Procore, QuickBooks, Bluebeam, Buildertrend).

## Open architectural questions

Canonical §11 lists open questions. Most resolved at CP1 (2026-04-29) — see DECISIONS LOG D-018 through D-036. Remaining longer-term:

- **Commitment Schema Consolidation** (working title: UCM, per D-027) — target data model that unifies commitment-shaped entities (proposal/contract/PO/CO/invoice/draw line) into one graph (canonical §6, Q3). Lands post-Phase-3.9.
- **Reconciliation surface** — canonical UI for "the books and the field disagree" (canonical §2). Lands as own phase post-Phase-3.9 per D-028.
- **Cross-org data sharing tier** — explicitly off today; architecture preserves the option (canonical §1.4).

Resolve via `/gsd-explore` or `/nightwork-init-phase` before phases that depend on them.

## How to start a new phase (post-D-018)

The canonical sequence per D-018:

1. **`/nightwork-init-phase <phase-name>`** — captures Jake's stated scope verbatim, runs `nightwork-requirements-expander` agent, produces approved EXPANDED-SCOPE.md, then runs `/nightwork-auto-setup` (AUTO infra items + MANUAL checklist for Jake), and ends with SETUP-COMPLETE.md when fully ready.
2. **`/np <phase-name>`** — chains `/gsd-discuss-phase` (with EXPANDED-SCOPE as input) → `/gsd-plan-phase` → `/nightwork-plan-review`. Critical findings block execute.
3. **`/nx <phase-name>`** — runs `nightwork-preflight` (10 checks); on PASS chains `/gsd-execute-phase` → `/nightwork-qa`. Critical findings block ship.
4. **`/gsd-ship <phase-name>`** — auto-runs `/nightwork-qa` + `/nightwork-end-to-end-test` before PR.

`/gsd-add-phase` and `/gsd-spec-phase` remain available for spec-first or roadmap-stub workflows; integrate with `/nightwork-init-phase` rather than replacing it.
