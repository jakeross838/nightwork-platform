# Nightwork — GAP.md

**Status:** Stage 1 architecture document. Last updated 2026-04-29 (CP1 close + Stage 1.6 build).
**Scope:** Where Nightwork is vs where it needs to be — the foundation work to bridge from `CURRENT-STATE.md` to `TARGET.md`. Concrete F1–F4 phase sequence with acceptance criteria, plus risks and assumptions.
**Inputs:** VISION.md, CURRENT-STATE.md, TARGET.md, MASTER-PLAN.md §8 default sequence, canonical §11 + §12, CP1-RESOLUTIONS.md (CLOSED 2026-04-29).

---

## ✱ CP1 CLOSE UPDATE (2026-04-29)

This update supersedes specific sections below where noted. See `.planning/architecture/CP1-RESOLUTIONS.md` for full detail.

**Phase sequence (resolved):**
- **F0 prep is ABSORBED into F1** per D-035. F1's first-day tasks now include the prior F0 quick wins. F1 estimate becomes **6–8 days** (was 5–7).
- F1, F2, F3, F4 sequence and scopes otherwise unchanged.
- Total foundation estimate: **~30–43 calendar days** (was 31–44 — small reduction from F0 absorption overhead).

**Assumption status (all resolved):**
- A1 RESOLVED → D-019 (NAHB CoA seed; one non-blocking follow-up for Jake about QB Desktop CoA customization)
- A2 RESOLVED → D-020 (cost-code wipe-and-reseed safe)
- A3 RESOLVED → D-021 (drop `change_order_budget_lines` safe)
- A4 RESOLVED → D-022 (Inngest Cloud)
- A5 RESOLVED → D-023 (F2 before F3 confirmed)
- A6 RESOLVED → D-024 (invoice as approval-framework guinea pig)
- A7 RESOLVED → D-025 (Drummond back-import as F4 dogfood)
- A8 RESOLVED → D-026 (CP3 between F4 and Wave 1)
- A9 RESOLVED → D-027 (UCM concept retained, branding softened)
- A10 RESOLVED → D-028 (reconciliation surface as own phase post-3.9)
- A11 RESOLVED → D-029 (substitution-map approach)
- A12 RESOLVED → D-030 (F3 estimate stands)
- A13 RESOLVED → D-031 (F4 includes Drummond back-import)
- NQ1 RESOLVED → D-032 (construction_address + billing_address split)
- NQ2 RESOLVED → D-033 (`payments` first-class in F1)
- NQ3 RESOLVED → D-034 (four-table invoice-line-shape documented, not consolidated)
- NQ4 RESOLVED → D-035 (F0 absorbed into F1)
- NQ5 RESOLVED → D-036 (reconciliation-surface mock-up added to Stage 1.5b)
- A14 RESOLVED → D-018 (Stage 1.6 system built)

**One open follow-up for Jake (non-blocking):**
- A1 sub-question: stock vs customized QB Desktop CoA. Default = stock (NAHB only). If customized, Diane exports IIF and we layer Ross Built CoA in `org_gl_codes`. Answer when convenient; F1 starts either way.

---

---

## Table of contents

A. Foundation work needed (prioritized)
B. Recommended F1–F4 phase sequence
C. Risks and assumptions

---

## A. Foundation work needed (prioritized)

The 20-criterion acceptance gate from TARGET.md §D.5 captures the destination. This section prioritizes the gaps by **risk × impact**: how badly does each gap hurt if we ship without fixing it, and how much does it block downstream work.

### Severity rubric

- **CRITICAL** — gates Wave 2+ entirely or risks tenant-data leak
- **HIGH** — recurring drift source; multiplies cost across phases if not fixed first
- **MEDIUM** — should fix during foundation, but doesn't block specific Wave 1 features
- **LOW** — opportunistic; not blocking

### A.1 Prioritized gap list

| # | Gap (from CURRENT-STATE) | Severity | TARGET fix | Phase |
|---:|---|---|---|---|
| 1 | No background job framework (CURRENT C.1 #1) | **CRITICAL** | Inngest + pg_cron (TARGET C.4) | F3 |
| 2 | No data import/export framework — D-008 violation (CURRENT C.1 #2) | **CRITICAL** | V.2 portability framework (TARGET C.7) | F3 |
| 3 | Rate limiting effectively absent (CURRENT C.1 #3) | **CRITICAL** | Rate-limit middleware (TARGET B.5) | F3 |
| 4 | Dashboard 503 — RLS policy-stack overhead (CURRENT E.1) | **CRITICAL** | RLS policy-stack collapse via /nightwork-propagate (TARGET A.5) | F3 |
| 5 | Cost-code triple-table drift (CURRENT A.3.1) | **HIGH** | Wipe-and-reseed to canonical + org (TARGET A.2) | F1 |
| 6 | `approval_chains` is dead config (CURRENT B.1 #1) | **HIGH** | Approval framework + wiring (TARGET B.2) | F2 |
| 7 | No central state-transition helper (CURRENT B.1 #4) | **HIGH** | `transitionEntity` helper (TARGET B.1) | F2 |
| 8 | `lien_releases` violates R.7 (no status_history) (CURRENT B.1 #3) | **HIGH** | Add status_history JSONB column | F1 (R.0 prep) |
| 9 | Idempotency partial (CURRENT C.1 #6) | **HIGH** | Idempotency middleware + Stripe webhook fix (TARGET B.4) | F3 |
| 10 | UI uniformity 2/4 (CURRENT D.3) | **HIGH** | Sweep change-orders + draws to invoice template | F4 |
| 11 | No CI test gate (CURRENT D.6) | **HIGH** | GitHub Actions or Vercel pre-build hook | F3 or F4 |
| 12 | `requireRole()` underused 1/119 (CURRENT D.9 #3) | **MEDIUM** | Adopt across role-gated routes (TARGET C.5) | F4 |
| 13 | `.eq('org_id', …)` repeated 200+ (CURRENT D.9 #4) | **MEDIUM** | `withOrg(supabase)` wrapper | F4 |
| 14 | Audit-log coverage 31/119 (CURRENT D.9 #5) | **MEDIUM** | Universal `withAuditWrap` middleware | F2 or F4 |
| 15 | Stripe webhook deduplication relies on UPSERT (CURRENT C.1 #6) | **MEDIUM** | Dedupe on event.id | F3 |
| 16 | docx-html lacks explicit auth (canonical Q7) | **MEDIUM** | 5-minute fix | R.0 prep |
| 17 | Trial expiry not enforced (canonical Q5) | **MEDIUM** | Middleware-gate at request-time | F3 |
| 18 | Plan-limits gating inconsistent (canonical Q6) | **MEDIUM** | Audit + apply | F3 |
| 19 | `change_order_budget_lines` dead code (CURRENT D.1) | **MEDIUM** | Drop table | R.0 prep |
| 20 | Three user-identity tables (CURRENT A.3.2) | **MEDIUM** | Drop `public.users` after grep-confirm | F1 |
| 21 | `email_inbox` scaffold-only (CURRENT A.2) | **LOW** | Replace with `emails` + Resend webhook | Wave 3 phase, not foundation |
| 22 | Embedding-on-create wiring (canonical §8.5, Q2) | **HIGH (Pillar 2 named blocker)** | Wire on commit | F2 work or Phase 3.5 |
| 23 | Stored aggregates without rationale comments (CURRENT B.1 #2) | **MEDIUM** | Audit + add comments OR convert to read-time | F4 |
| 24 | Drummond ingestion gap — synthetic Supabase stub vs real Downloads/P-drive data (CURRENT F.4) | **HIGH** (named blocker for Wave 1 dogfood) | Build import_batches framework + back-import Drummond historical invoices | F3 (framework) + post-F4 ingest pass |
| 25 | No structured logging (100+ console.* calls) | **MEDIUM** | Pino + replace pass | F3 |
| 26 | Sentry init gated on SENTRY_DSN with no startup assert | **LOW** | Assert at boot | F3 |
| 27 | `send_back` cascade documented as incomplete (CURRENT B.1 #5) | **MEDIUM** | Make atomic via cascade hook in transitionEntity | F2 |
| 28 | `budgets` parent table unused (CURRENT A.2) | **LOW** | Decide deprecate vs activate; document outcome | F1 |
| 29 | RESEND_API_KEY=re_placeholder (MASTER-PLAN §11) | **LOW (functional, not severity)** | Replace with real key when notifications activated | Wave 3 |
| 30 | STRIPE_PRICE_* empty / STRIPE_WEBHOOK_SECRET=whsec_placeholder | **LOW (functional)** | Populate at billing-activation phase | Pre-paid-GA |

### A.2 Quick wins

These items can land in a single "R.0 prep" phase before F1, reducing complexity downstream:

- Drop `change_order_budget_lines` (zero rows, zero consumers — verified)
- Add `lien_releases.status_history` JSONB column (R.7 violation closure)
- 5-min docx-html auth fix (canonical Q7)
- Decide `budgets` parent table fate

Total: ~1 day of work; reduces F1 scope and clears trivial debt.

---

## B. Recommended F1–F4 phase sequence

Per MASTER-PLAN.md §8 default, the foundation has 4 phases. The Stage 1 audit confirms the default ordering is correct: entity model → workflow framework → platform primitives → existing-code refactor. Detailed scopes follow. Each phase's acceptance criteria are falsifiable per D-015.

### F0 (R.0 prep) — ABSORBED INTO F1 per D-035

**Status:** Absorbed into F1's first-day tasks. Kept here for traceability.
**Tasks (now F1 day-1):** Drop `change_order_budget_lines`, add `lien_releases.status_history`, fix docx-html auth, decide `budgets` table fate.

### F1 — Unified entity model

**Name:** Unified entity model
**Scope:**
- Cost-code consolidation: drop `cost_codes` (legacy), seed `org_cost_codes` from Drummond fixtures + canonical mapping where obvious
- Three-table user-identity: drop `public.users` after grep-confirming zero consumers; reconcile `profiles.role` to delegate to `org_members.role`
- Promote `payments` to first-class table; add `payment_invoices` junction
- Add `gl_codes` table (VQ2)
- Add `approvals` table (independent of `approval_chains` config — F2 wires it)
- Document the four-table invoice-line-shape contract in canonical §5.6 (no schema change)
- Universal-envelope audit: every tenant table has the 7 V.1 columns; gaps filled
- Universal-index posture audit: every table has `(org_id) WHERE deleted_at IS NULL` + `(org_id, updated_at DESC) WHERE deleted_at IS NULL`

**Why it matters:** Coexisting entities (cost codes, users, invoice lines) are the highest drift risk per CURRENT-STATE §A.3. Consolidation here pays compounding interest — every future phase touches fewer alternatives.

**Dependencies:** F0.

**Estimated time:** 5–7 days.

**Acceptance criteria:**
- [ ] Migration: `cost_codes` table dropped; all references in code and views updated
- [ ] Migration: `org_cost_codes` seeded from Drummond fixture cost codes
- [ ] Migration: `public.users` dropped; `profiles.role` is virtual or removed
- [ ] Migration: `payments` table created with V.1 envelope; `payment_invoices` junction created
- [ ] Migration: `gl_codes` table created with V.1 envelope
- [ ] Migration: `approvals` table created with V.1 envelope, append-only RLS shape
- [ ] All migrations have `.down.sql` paired
- [ ] Universal-envelope audit script runs and passes (every tenant table has the 7 columns)
- [ ] Universal-index audit script runs and passes
- [ ] Drummond fixture re-seeds via the new schema with no errors (cost-code references resolve)
- [ ] All tests pass (typecheck + suite)
- [ ] Dashboard p95 ≤ 2s on representative load (this is a TARGET — F3 also contributes)
- [ ] `/nightwork-plan-review` from TARGET sequence passes

### F2 — Workflow framework

**Name:** Workflow framework — single transition path + approvals
**Scope:**
- Implement `transitionEntity` helper (TARGET B.1)
- Migrate every workflow API route to use it (incremental — invoice → draw → CO → PO → proposal → lien_release)
- Implement approval framework (`startApprovalFlow`, `recordApprovalDecision` per TARGET B.2)
- Wire `approval_chains` for invoice flow first; verify Ross Built defaults work end-to-end
- Propagate approval framework to draw + CO + PO + proposal
- Make `send_back` cascade atomic via cascade hook (closes CURRENT B.1 #5)
- Add `withAuditWrap` middleware so transitionEntity isn't the only path that writes activity_log
- Audit + close stored-aggregate violations: every trigger-maintained cache gets a rationale comment OR is converted to read-time recompute
- Embedding-on-create wiring for cost intelligence (canonical Q2, §8.5) — wired into the new commit hooks

**Why it matters:** Every drift source identified in CURRENT-STATE §B (dead approval_chains, no central state-transition helper, send_back cascade gap, R.2 stored-aggregate violations, lien_releases R.7 violation) flows from the lack of a unified workflow framework. Once F2 lands, every subsequent phase inherits correctness for free.

**Dependencies:** F1 (entity model stable).

**Estimated time:** 7–10 days.

**Acceptance criteria:**
- [ ] `transitionEntity` helper implemented at `src/lib/workflow/transition.ts`
- [ ] Every workflow API route delegates to it (≥80% adoption; remaining 20% have explicit reason)
- [ ] Approval framework implemented; `approval_chains` is no longer dead config
- [ ] Invoice approval end-to-end works via the framework with Ross Built defaults
- [ ] Draw + CO + PO + proposal approval flows migrated to framework
- [ ] `send_back` cascade is atomic; partial-failure trap state impossible
- [ ] `withAuditWrap` middleware in place; ≥95% of mutation routes write to activity_log
- [ ] Stored-aggregate audit complete: every trigger-maintained cache has rationale comment OR is converted
- [ ] Embedding-on-create wired for invoice + proposal commit; pricing_history populates immediately
- [ ] All tests pass
- [ ] `/nightwork-plan-review` passes
- [ ] `/nightwork-end-to-end-test` runs the Drummond invoice flow end-to-end and reports green

### F3 — Platform primitives

**Name:** Platform primitives — jobs, idempotency, rate limit, observability, RLS, portability
**Scope:**
- **Background jobs:** Inngest setup + first 5 jobs (notification fan-out, AI extract, export, recalc, cleanup); pg_cron schedules for periodic maintenance
- **Idempotency:** middleware + Stripe webhook fix on event.id + per-entity natural-key idempotency on imports
- **Rate limiting:** middleware with per-org/per-user/per-IP/AI-endpoint caps; 429 responses + headers
- **Observability:** Pino structured logger; replace 100+ console.* calls; Sentry tightening (SENTRY_DSN startup assert + hook into withApiError); per-route p50/p95/p99 dashboard
- **RLS policy-stack collapse:** route through `/nightwork-propagate` for cross-cutting nature; collapse to single permissive `org_isolation` SELECT + restrictive write narrowing per TARGET A.5
- **Data portability framework V.2:** Zod schemas per first-3 entities (jobs, vendors, invoices); export/import helpers; round-trip tests
- **Trial expiry middleware:** request-time gate per canonical Q5
- **Plan-limits gating:** apply consistently across token-consuming routes per canonical Q6
- **CI test gate:** GitHub Actions or Vercel pre-build hook running typecheck + test suite

**Why it matters:** Every primitive in this phase is currently absent or partial. CRITICAL gaps #1-4 from §A.1 land here. Without these, Wave 2+ is unbuildable (no bg jobs → can't process daily logs/photos async; no portability → can't bulk-import historical invoices; no rate limit → can't admit Tenant 2; dashboard 503 → can't dogfood).

**Dependencies:** F2 (transitionEntity helper exists for jobs to delegate to).

**Estimated time:** 10–14 days.

**Acceptance criteria:**
- [ ] Inngest set up; ≥5 event-driven jobs defined and working in dev
- [ ] pg_cron schedules: cleanup_stale_imports nightly, dashboard MV refresh every 60s
- [ ] Idempotency-Key middleware live; ≥80% of write routes wrapped
- [ ] Stripe webhook deduplicates on event.id (idempotency table backed)
- [ ] Rate-limit middleware live; per-org/per-user/per-IP caps in effect; 429 responses with headers
- [ ] Pino structured logger live; ≤10 ad-hoc console.* calls remaining
- [ ] Sentry asserts SENTRY_DSN at startup; hooks into withApiError
- [ ] RLS policy-stack collapsed for `invoices`, `draws`, `purchase_orders`, `budget_lines`, `jobs`, `activity_log`
- [ ] Dashboard p95 < 2s under representative load (verified via load test)
- [ ] V.2 portability framework: jobs/vendors/invoices have export+import schemas + round-trip tests
- [ ] Trial expiry middleware live; expired orgs get appropriate 4xx response
- [ ] Plan-limits gating consistent across token-consuming routes
- [ ] CI test gate live (GitHub Actions); PRs blocked when typecheck or tests fail
- [ ] `/nightwork-plan-review` passes
- [ ] `/nightwork-qa` passes with no CRITICAL findings

### F4 — Existing code refactor

**Name:** Existing code refactor — adoption sweep + UI uniformity + audit closure
**Scope:**
- `requireRole()` adoption across 92 routes that hand-roll role checks
- `withOrg(supabase)` wrapper to reduce 200+ `.eq('org_id', …)` repetitions; ≥80% route adoption
- UI uniformity sweep: bring `/change-orders/[id]` and `/draws/[id]` into invoice-template alignment (file preview LEFT + right-rail panel + audit timeline)
- Audit-log coverage closure to 100% mutation routes
- Dead-code cleanup: orphan files, unused TS types, console.log sweep (residual)
- Vercel.json header improvements (X-Frame-Options DENY, Permissions-Policy completion, COOP) per MASTER-PLAN §11
- Nonce-based CSP migration (canonical §11 Q-similar; removes 'unsafe-inline' XSS gap)
- HTTP integration tests for the 10 most-used routes
- Drummond fixture back-import: use V.2 framework to bulk-import historical Drummond invoices/draws/lien-releases from Source 3 Downloads — concrete dogfood of the framework + closes the F.4 ingestion gap

**Why it matters:** Pattern adoption gaps multiply across the codebase. Every new feature built before adoption replicates the gap. F4 closes them and dogfoods the F3 portability framework on the most concrete possible workload (Drummond's own real history).

**Dependencies:** F3 (V.2 framework needed for Drummond back-import).

**Estimated time:** 8–12 days.

**Acceptance criteria:**
- [ ] `requireRole()` used in ≥80% of role-gated routes
- [ ] `withOrg(supabase)` wrapper exists and used in ≥80% of routes
- [ ] UI uniformity 4/4 — every review surface extends invoice template
- [ ] Audit-log coverage ≥95% of mutation routes
- [ ] ≤5 orphan files; ≤5 unused TS types
- [ ] vercel.json improvements applied (DENY, full Permissions-Policy, COOP)
- [ ] CSP migrated to nonce-based; 'unsafe-inline' removed from script-src and style-src
- [ ] HTTP integration tests exist for top-10 most-used routes
- [ ] Drummond historical invoices imported from Downloads → Supabase via V.2 framework
- [ ] `/nightwork-end-to-end-test` runs full Drummond flow on real (now-imported) data and reports green
- [ ] `/nightwork-plan-review` and `/nightwork-qa` pass with no CRITICAL findings
- [ ] Tech-debt registry updated; Stage-1-discovered items resolved or explicitly deferred

### Total estimated time

| Phase | Range |
|---|---|
| F0 prep | 1 day |
| F1 | 5–7 days |
| F2 | 7–10 days |
| F3 | 10–14 days |
| F4 | 8–12 days |
| **Total** | **~31–44 days** (calendar — includes review/checkpoint loops; pure-coding ~20–28 days) |

Strategic Checkpoint #3 (per D-012 — "foundations close") falls between F4 and Wave 1 work proper.

### Sequence rationale

Per nwrp7.txt "Adjust if the audit reveals a different optimal sequence, but justify changes":

The default sequence (entity → workflow → primitives → refactor) holds with one nuance — **F2 should run before F3 even though F3 is heavier**, because:
1. `transitionEntity` (F2) becomes the canonical path for activity_log writes; F3's `withAuditWrap` middleware piggybacks on this (rather than fighting it).
2. The approval framework (F2) is referenced by background jobs (F3 — notify-step-approvers fan-out is the cleanest first Inngest job).
3. Inngest setup (F3) is large enough that having stable workflow/audit invariants from F2 reduces F3 rework.

The alternative — running F3 (primitives) before F2 (workflow) — would mean implementing audit-log middleware twice (once before transitionEntity, once after) and rebuilding approval-fan-out twice. Net cost higher.

The other adjustment vs default: **F0 prep phase is added** to absorb four quick wins. It's not the original §8 sequence but reduces F1 risk by clearing dead code and a R.7 violation up front.

---

## C. Risks and assumptions

### C.1 Risks

| # | Risk | Impact | Likelihood | Mitigation |
|---:|---|---|---|---|
| R1 | RLS policy-stack collapse breaks PM-on-own-jobs read narrowing | HIGH (silent over-broad reads) | MEDIUM | Test on synthetic data with multiple PMs across multiple jobs; assert PM A cannot read PM B's job rows; route through `/nightwork-propagate` for blast radius |
| R2 | Cost-code wipe-and-reseed loses a code Ross Built actually uses | HIGH (downstream invoices fail to allocate) | LOW (12 rows are synthetic; real codes in legacy `cost_codes` are dropped intentionally and re-derived from Drummond fixtures) | Build seed list by joining: (canonical NAHB codes) + (codes referenced in Drummond fixtures Source 1 + Source 3) + (codes used in any active job). Keep `cost_codes.down.sql` for emergency restore. |
| R3 | F1 entity changes cascade to UI surfaces unaware of new shapes | MEDIUM (tests pass, runtime breaks) | MEDIUM | Generate fresh TS types after every migration; lint for `any`; HTTP integration tests in F3 catch regressions |
| R4 | Inngest free tier limits cap concurrency too low for prod-scale | LOW (10-orgs first cohort fine; bigger later) | LOW | Pay for Inngest Pro at first paid GA; pg-boss fallback documented for self-host emergencies |
| R5 | RLS collapse + dashboard MV interact badly | MEDIUM (MV uses underlying tables; permissive policy stack reduction may change row visibility for the MV refresher) | MEDIUM | Use service-role for MV refresh (already pattern for cron); document explicit bypass |
| R6 | Drummond import via V.2 framework reveals schema gaps not covered by Wave 1 entities | MEDIUM (some real invoices may not fit current model) | HIGH | Treat first import as dogfood; surface gaps as F4 mid-phase deviations; expect 1-2 schema patches during F4 |
| R7 | Optimistic-lock retrofitting on existing routes introduces 409 storms in busy windows | LOW | LOW | Phase rollout: read endpoints unchanged; write endpoints adopt one-by-one with client-side reconciliation patterns |
| R8 | Universal envelope V.1 mandate breaks existing tables that lack one of the 7 columns | MEDIUM (e.g., `pricing_history` has no `deleted_at` per its append-only design) | MEDIUM | Document V.1 exemptions explicitly: append-only audit tables (pricing_history, activity_log, approvals) are envelope-minus-deleted_at by design; this is a documented divergence, not a violation |
| R9 | Strategic Checkpoint #1 reveals Jake wants a different sequence | LOW-MEDIUM | LOW (sequence is canonical default; little contention expected) | This document is what gets discussed at the checkpoint; revisions are expected and welcomed before F0 starts |
| R10 | Token cost during F0-F4 (Claude API for code generation, classifier, extractors during dogfood) | MEDIUM (paid plan budget) | MEDIUM | Cost ceiling per phase tracked via `api_usage`; hard cutoff if a single phase exceeds $50 in API spend |

### C.2 Assumptions to validate at Strategic Checkpoint #1

These are decisions VISION/TARGET/GAP take a position on. Jake should confirm or override.

| # | Assumption | VISION/TARGET position | Discuss? |
|---:|---|---|---|
| A1 | `gl_codes` becomes a first-class entity in F1 | YES, add it | Confirm: does Ross Built have a working chart of accounts in QBO that should seed this? |
| A2 | Wipe-and-reseed for cost codes is the right call | YES, per D-007 | Confirm: any production cost-code customizations Jake wants to preserve? |
| A3 | Wipe-and-drop for `change_order_budget_lines` is safe | YES (zero rows, zero consumers) | Confirm: any external integrations or future plans that reference it? |
| A4 | Inngest is the background-job pick over Trigger.dev / pg-boss | YES, with rationale | Discuss: any opinion on running Inngest cloud vs self-host? |
| A5 | F2 before F3 sequence | YES, per §B sequence rationale | Confirm or override |
| A6 | Approval framework wired to invoice first, then propagated | YES | Confirm: which workflow should be the approval-framework guinea pig? Invoice (highest volume) or CO (highest dollar impact)? |
| A7 | Drummond fixture back-import is part of F4, not its own phase | YES | Confirm: is back-importing real Drummond history the right dogfood, or should we keep the system test-data-only until paid GA? |
| A8 | Strategic Checkpoint #3 falls between F4 and Wave 1 (not between F2 and F3, etc.) | YES per D-012 | Confirm |
| A9 | UCM (canonical §6) lands AFTER F1-F4, not as part of foundation | YES (UCM is canonical Q3, foundation phases don't depend on it) | Confirm: is UCM still a real near-term target, or has it been deprioritized in favor of incremental schema cleanup? |
| A10 | The reconciliation surface (canonical Q1) lands as its own phase post-foundation | YES | Confirm |
| A11 | We do NOT ingest real customer (homeowner) data into git-committed fixtures or audits | YES (per Jake 2026-04-29 clarification) | Confirm: substitution-map approach is sufficient when real cross-org sharing eventually happens? |
| A12 | F3 is the heaviest phase; comfort with 10-14 day estimate | (estimate based on scope) | Confirm or scope-cut |
| A13 | F4 final acceptance includes Drummond historical back-import via V.2 framework | YES — best dogfood | Confirm |

### C.3 Open questions raised by the Stage 1 audit (new)

These are not yet captured in canonical §11. Adding for Strategic Checkpoint #1 disposition:

- **NQ1.** Does `jobs.address` represent the construction site or the homeowner residence? Per Jake 2026-04-29, the Supabase Drummond record has synthetic placeholder data; the real construction site is 501 74th, Holmes Beach FL. Going forward, should `jobs` carry both addresses (construction_address + billing_address)?
- **NQ2.** Should `payments` be promoted to a first-class table in F1 even before QB sync planning? VISION/TARGET say yes; Jake confirms.
- **NQ3.** What's the right approach to the four-table invoice-line-shape coexistence (line_items / allocations / extraction_lines / cost_components)? Document and live with for now (TARGET position) or consolidate at F1?
- **NQ4.** Should the F0 "R.0 prep" phase actually exist as a separate phase, or roll into F1? §B argues for separate; alternative is F1 absorbs.
- **NQ5.** Should we add a "reconciliation surface" mock-up phase before Wave 1.5 design system work, given canonical §2 is the wedge thesis but its UI is undefined?

### C.4 Things explicitly NOT in the foundation (and why)

| Out-of-scope item | Why not in F1-F4 | Where it goes |
|---|---|---|
| UCM consolidation (canonical §6) | Foundation doesn't depend on it; canonical Q3 unresolved | Phase 4.X or later |
| Reconciliation surface (canonical Q1) | Per-transition reconciliation is implicit in 3.6/3.7/3.9; cross-entity surface needs extractors + UI design first | After Wave 1 reconciliation extractors land |
| Schedule intelligence layer (canonical §1.3 Pillar 3) | Data accumulation only starts post-foundation; intelligence layer is Wave 4 | Wave 4 |
| Custom report builder | User-facing — not foundation work | Wave 4 |
| Mobile native app | Wave 5+; current PWA pattern via Next.js sufficient through Wave 3 | Post-Wave-5 |
| QuickBooks sync | Wave 5; correct deferral per CLAUDE.md | Wave 5 |
| Buildertrend Playwright scraper | Wave 5 | Wave 5 |
| Multi-region deploy | <100k orgs; iad1 single-region holds | Post-100k-orgs (Wave 5+) |
| EU GDPR-territory tenant support | Single Supabase project today; new region = new project + Vercel routing | Phase 5+ |

---

**End of GAP.md.**

Cross-references:
- Vision: `.planning/architecture/VISION.md`
- Current state: `.planning/architecture/CURRENT-STATE.md`
- Target architecture: `.planning/architecture/TARGET.md`
- Master plan: `.planning/MASTER-PLAN.md`
- Operational rules: `CLAUDE.md`
- Canonical: `docs/nightwork-plan-canonical-v1.md`

**Next:** Strategic Checkpoint #1 with Jake. Then Stage 1.5a (`PHILOSOPHY.md`, `SYSTEM.md`, `COMPONENTS.md`, `PATTERNS.md` for the design system) per MASTER-PLAN.md §12.
