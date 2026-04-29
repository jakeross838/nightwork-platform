# Nightwork — Requirements

**Source of truth:** `docs/nightwork-plan-canonical-v1.md` §3 (standing rules) and §4 (architecture rules). This file summarizes the requirements that govern every phase. Update on canonical-plan changes.

**Last canonical-plan refresh:** 2026-04-29 (commit `d5222a5`).

## Standing rules (R.1–R.23)

Every phase honors these. Violations are blocked at plan-review or QA. Full text: canonical §3.

| ID | Rule | Owner |
|----|------|-------|
| R.1 | Never kill running processes | All agents, hooks |
| R.2 | Recalculate, never increment/decrement | nightwork-ai-logic-tester, nightwork-ai-logic-checker |
| R.3 | Org-configurable, never hardcoded | nightwork-multi-tenant-architect |
| R.4 | Rebuild over patch | architect agent |
| R.5 | Trace, don't assume | search-first skill |
| R.6 | Block destructive actions when linked records exist | nightwork-rls-auditor, nightwork-data-migration-safety |
| R.7 | Log all state changes to status_history | nightwork-spec-checker |
| R.8 | Amounts in cents | nightwork-ai-logic-tester |
| R.9 | Source document provenance | nightwork-spec-checker |
| R.10 | Optimistic locking on mutations | nightwork-rls-auditor |
| R.11 | Screenshots are inline, not disk-saved | (see CLAUDE.md screenshot protocol) |
| R.12 | Single QA file per phase | nightwork-qa |
| R.13 | Read CLAUDE.md first | session-start hooks |
| R.14 | No placeholder content | nightwork-spec-checker |
| R.15 | Test-first when possible | gsd-add-tests |
| R.16 | Migration files are the source of truth | nightwork-data-migration-safety |
| R.17 | Atomic commits | gsd-validate-commit hook |
| R.18 | Phase spec file lists are advisory, not authoritative | nightwork-spec-checker |
| R.19 | Live execution of manual tests | nightwork-end-to-end-test |
| R.20 | Read project scripts before invoking | session-start, search-first |
| R.21 | Synthetic test fixtures, never production-shaped data | nightwork-end-to-end-test (Drummond) |
| R.22 | Teardown script sequencing | nightwork-data-migration-safety |
| R.23 | Codebase-precedent check for RLS and table conventions | nightwork-rls-auditor |

## Architecture requirements (current state)

Canonical §4 is authoritative. Summary:

- **Multi-tenant by construction.** Every tenant table has `org_id`, RLS enabled, policies that filter on `getCurrentMembership().org_id`.
- **Soft delete only.** No `DELETE FROM` on tenant tables; `UPDATE … SET deleted_at = now()`.
- **Cents math everywhere.** Money is `bigint` cents in DB, `formatCents()` / `formatDollars()` in UI.
- **Status history JSONB on every workflow entity.** Every transition appends `{who, when, old_status, new_status, note}`.
- **Recalculate on read.** Trigger-maintained caches only when read-time recompute is prohibitive (e.g., `jobs.approved_cos_total`).
- **Optimistic locking.** Writes accept `expected_updated_at`; stale writes return 409 with current row.
- **Design tokens, not hex.** Slate palette via CSS vars + `nw-*` Tailwind utilities.
- **Audit log coverage.** Every override (PM, QA), every external action (email, payment push, file upload), every data import / export.

## Data portability requirement

Canonical §1.3 Pillar 1 + the spec for the build system: every entity has clean import/export contracts. See `.claude/skills/nightwork-data-portability/SKILL.md` for what this means in practice.

## Workflow requirements

- **Acceptance criteria required on every phase.** `nightwork-spec-checker` blocks phases without them.
- **Plan-level review precedes execute.** `/nightwork-plan-review` on every phase.
- **QA review precedes ship.** `/nightwork-qa` on every phase.
- **End-to-end Drummond test precedes ship.** `/nightwork-end-to-end-test`.
- **Cross-cutting changes use `/nightwork-propagate`** (5-phase orchestrator with blast radius, plan, execute with QA between chunks, smoke test, report).

## Data model requirements

Canonical §5 (current) and §6 (target — Unified Commitment Model TBD) are authoritative. This file does not duplicate that content.
