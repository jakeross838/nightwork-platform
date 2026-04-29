# Plan Consolidation — Changelog

**Date:** 2026-04-29
**Branch:** `plan/canonical-v1`
**Source audit:** `docs/repo-audit-and-plan-consolidation-2026-04-29.md` (branch `audit/2026-04-29`)

This changelog records the consolidation that produced `docs/nightwork-plan-canonical-v1.md`. Three things changed: docs were retired (with `SUPERSEDED 2026-04-29` headers, kept for history), docs stayed alive alongside the canonical plan, and the canonical plan is newly written. Every retired doc's open items are mapped to the canonical plan section that now carries them.

---

## Newly written

| File | Purpose |
|---|---|
| `docs/nightwork-plan-canonical-v1.md` | Consolidated source of truth. ~8,300 words across 13 sections. Sections 2, 6, and 11 are explicitly TBD. |
| `docs/CHANGELOG-plan-consolidation.md` | This file. |

---

## Preserved (kept alive alongside the canonical plan)

These remain authoritative or load-bearing in their own right:

| File | Why kept |
|---|---|
| `CLAUDE.md` | Operational constitution. Reduced where redundant with §3 (standing rules) and §4 (architecture rules) of v1; kept everywhere else. |
| `docs/nightwork-rebuild-plan.md` | **Partial supersession.** Part R (standing rules R.1–R.23) and Part G (exit gates, QA reports, subagents, rebuild tree) remain canonical and are reproduced verbatim in v1 §3. Part 5 phase list is superseded by v1 §9 (which uses amendment-1's re-scoped order). |
| `docs/nightwork-rebuild-plan-amendment-1.md` | Authoritative phase plan for 3.3–3.10, consolidated into v1 §9. Stays as the source-of-truth amendment record. |
| `docs/nightwork-rebuild-plan-amendment-1-addendum-a.md` | NAHB substitution rationale. Consolidated into v1 §8.2. Stays as the source-of-truth addendum. |
| `docs/nightwork-rebuild-plan-amendment-1-addendum-b.md` | Hot-path matcher boundary + items table decision. Consolidated into v1 §4.10 and §8.3–8.5. Stays as the source-of-truth addendum. |
| `docs/BRAND.md` | Voice, positioning, pricing tiers. Cited in v1 §1.1. |
| `docs/canonical-codes/nahb-2024.csv` | NAHB seed data (public domain). |
| `docs/canonical-codes/nahb-2024-source.txt` | Source notes for NAHB seed. |
| `docs/platform-admin-runbook.md` | Deeper operational reference for impersonation, audit log queries, etc. Cited in v1 §10. |
| `docs/NAV_INVENTORY.md` | As-built nav inventory; informs Q12 (vestigial UI) in v1 §11. Kept until Q12 is locked. |
| `docs/preflight-branch3-phase3.2.md` | Phase 3.2 preflight. Historical but useful precedent for future preflight docs. |
| `docs/product-surface-audit.md` | Walkthrough of product surfaces. Partially outdated; kept until §9.2 (Phase 3.5) refreshes the surface map. |
| `docs/workflow-audit.md` | State-machine walkthrough. Mostly accurate; missing proposals state machine (added in Phase 3.4). |
| `qa-reports/*.md` | Per-phase audit trail. **Never consolidated.** Cited in v1 §9.1 and §13.5. |
| `__tests__/*.test.ts` | Test fences. 39 files. |
| `supabase/migrations/*.sql` (91 numbered + `.down.sql` from 00060) | Single source of truth for schema (R.16). |
| `SETUP.md` | Quickstart. |

---

## Retired (marked SUPERSEDED 2026-04-29, kept for history)

Each retired file gets a one-line header at the top: `> SUPERSEDED 2026-04-29 by docs/nightwork-plan-canonical-v1.md. Kept for history.` Files are not deleted. The mapping below shows where each retired doc's open items live in v1.

| Retired file | Open items landed in v1 | Closed items |
|---|---|---|
| `critical-gaps.md` (2026-04-16, 109 LOC) | Job detail performance and lien upload UX have largely shipped. Remaining items map to v1 §12 (tech debt). | Pre-dogfood blockers: most fixed. |
| `REVIEW_FINDINGS.md` (2026-04-20, 571 LOC) | Open Critical/High/Medium items roll into v1 §12 (tech debt list, top 10) and v1 §11 (open architectural questions). The docx-html auth gap → v1 §12 item 2 + Q7 in §11. | Resolution grid items (Phases A–E, G, H, I) closed; archived per audit Deliverable 1. |
| `DEFERRED_FINDINGS.md` (2026-04-20, 467 LOC) | F-001 through F-024+ items: F-001 (hardcoded ORG_ID) is closed per audit. Open items map to v1 §12 and §11. | Per audit, several items marked RESOLVED; archived. |
| `diagnostic-naming.md` (2026-04-21, 100 LOC) | The 82 pending extraction lines with un-normalized AI names → v1 §8 (cost intelligence subsystem) as accumulated state. Backfill SQL is documented in the original; not separately tracked. | Item itself is no longer load-bearing post-Phase 3.4. |
| `diagnostic-pdf-preview.md` (2026-04-21, 96 LOC) | The iframe + `createSignedUrl` gap remains real. Maps to v1 §13 glossary entry "PDF preview iframe" and is implicitly addressed when Phase 3.5 touches the proposal review surface. | None — issue still live. |
| `diagnostic-report-cost-intel.md` (2026-04-21, 100 LOC) | Cold-start state characterization → context for v1 §8.5 (embedding-on-create deferral). | Specific row counts superseded by audit Deliverable 0. |
| `diagnostic-source-highlighting.md` (2026-04-21, 100 LOC) | The PM-trust feature (per-line page/bbox positional extraction) is blocked on extraction-time positional capture. Maps to v1 §12 (implicit) and is a candidate for a future phase; no specific Q in §11 yet. | None — proposal still live as a future feature spec. |
| `e2e-findings.md` (2026-04-16, 66 LOC) | The Dewberry Draw #9 dogfood blockers: most fixed (RLS embed null cost_codes, ROSS BUILT auto-vendor-creation, etc.). Remaining items → v1 §12. | Cost code 06108 missing and several others addressed per audit. |
| `route-sweep.md` (2026-04-16, 145 LOC) | Service-role fallback pattern → v1 §4.14. The 28-route hardening is complete and now historical. | All 28 routes hardened with `fetchCache = "force-no-store"`; archived. |
| `migration-preview.md` (2026-04-16, 69 LOC) | Pre-dogfood data + code fixes — all shipped. | All shipped; archived. |
| `smoke-test-results.md` (2026-04-16, 119 LOC) | 52 PASS / 8 PARTIAL rollup is historical. Console errors mostly addressed. Anything remaining → v1 §12. | Superseded by per-phase QA reports in `qa-reports/`. |
| `docs/QA-RESULTS.md` (2026-04-15, ~150 LOC) | Early-phase rollup → superseded entirely by `qa-reports/qa-branch{N}-phase{M}.md`. | All rolled up; archived. |
| `docs/NAV_REORG_PLAN.md` (2026-04-18, ~180 LOC) | Approved but never executed. Decision deferred to v1 §11 Q12 (vestigial UI cleanup). | None — entire plan is open. |
| `docs/nightwork-rebuild-plan.md` Part 5 (phase list only, ~entire Part 5 sections 3.3–3.8) | Phase list superseded by amendment-1's re-scoped order, which is consolidated into v1 §9. **Part R and Part G of the same file remain canonical** (reproduced verbatim in v1 §3). | None — Part 5 is the superseded portion. The rest of the file (Parts R, G, 0, 1, 2, 3, 4, 6) remains alive. |

---

## What this consolidation does NOT do

- **Does not change code, migrations, or tests.** Plan-doc only.
- **Does not lock the TBD sections.** v1 §2 (reconciliation thesis), §6 (UCM target state), and §11 (open architectural questions) carry decisions that need explicit Jake-and-Claude planning sessions to resolve. They are flagged as TBD throughout.
- **Does not retroactively edit the rebuild plan, amendment, or addenda.** Those remain authoritative source-of-truth records of the decisions taken at their time. v1 cites them; it does not replace them as primary sources for those decisions.
- **Does not consolidate `qa-reports/`.** Per audit Deliverable 10, the per-phase QA archive is the rebuild's permanent audit trail and is never rolled up.
- **Does not delete any file.** Retired files are marked `SUPERSEDED 2026-04-29` and kept on disk and in git history.

---

## Pre-existing open items not covered by retired docs

A handful of audit-surfaced items did not originate in the retired docs but are tracked in v1 anyway:

- **Embedding-on-create wiring deferred (audit Deliverable 9 item 1)** → v1 §8.5 + §11 Q2.
- **Trial expiry not enforced (audit Deliverable 9 item 5)** → v1 §12 item 3 + §11 Q5.
- **Plan-limits gating inconsistent (audit Deliverable 9 item 6)** → v1 §12 item 4 + §11 Q6.
- **Proposal commit not transactional (audit Deliverable 9 item 3)** → v1 §12 item 5 + §11 Q10.
- **Classifier eval requires manual run (audit Deliverable 9 item 2)** → v1 §12 item 6 + §11 Q9.
- **Two cost code registries coexist (audit Deliverable 9 item 11)** → v1 §12 item 7 + §11 Q4.
- **`extraction_prompt_version` dual-purposed (audit Deliverable 9 surprise 7)** → v1 §12 item 10 + §7.3.

---

**End of consolidation changelog.**
