# Nightwork — Canonical Plan v1

**Date:** 2026-04-29
**Branch:** `plan/canonical-v1`
**Status:** Authoritative. Supersedes the planning surface listed in §13.6 and in `docs/CHANGELOG-plan-consolidation.md`.
**Audience:** Jake. A future engineer who needs to come up to speed in one read. Claude Code at the start of every session.

This is the present-tense source of truth for what Nightwork is, how it's built, what's shipped, what's next, and what's known to be wrong. It consolidates the original rebuild plan's Part 5 phase list, amendment-1 + addenda A and B, and a layer of one-shot diagnostic markdowns into one document. Documents that stay alive alongside this plan are listed in §13.5.

Everything below is current state. The audit at `docs/repo-audit-and-plan-consolidation-2026-04-29.md` (on branch `audit/2026-04-29`) is the primary source for this consolidation; specific findings are cited by deliverable and section throughout.

---

## Table of contents

1. [Identity, mission, four-pillar moat thesis](#1-identity-mission-four-pillar-moat-thesis)
2. [The reconciliation thesis (TBD)](#2-the-reconciliation-thesis-tbd)
3. [Standing rules R.1–R.23 + meta-process](#3-standing-rules-r1r23--meta-process)
4. [Architecture rules — current state](#4-architecture-rules--current-state)
5. [Data model — current state](#5-data-model--current-state)
6. [Data model — target state (Unified Commitment Model — TBD)](#6-data-model--target-state-unified-commitment-model--tbd)
7. [The classify-extract-commit pipeline](#7-the-classify-extract-commit-pipeline)
8. [Cost intelligence subsystem](#8-cost-intelligence-subsystem)
9. [Phase plan — shipped, next, future](#9-phase-plan--shipped-next-future)
10. [Operations playbook](#10-operations-playbook)
11. [Open architectural questions (TBD)](#11-open-architectural-questions-tbd)
12. [Outstanding tech debt + known issues](#12-outstanding-tech-debt--known-issues)
13. [Glossary + appendix](#13-glossary--appendix)

---

## 1. Identity, mission, four-pillar moat thesis

### 1.1 What Nightwork is

Nightwork is the AI-powered operating system for custom home builders. It replaces the paper-and-spreadsheet workflow of a $1.5M–$10M+ residential GC with one system where data enters once and flows everywhere — invoices to draws, proposals to POs, COs to budgets, lien releases to payment schedules. Cost-plus and fixed-price are both first-class. The architecture is multi-tenant from day one.

The brand voice (per `docs/BRAND.md`, kept alive): "Nightwork makes building lightwork." Pricing tiers: Starter $249/mo (1–5 active jobs), Pro $499/mo (6–15), Enterprise $799/mo (unlimited). No contracts. The reference competitor is Adaptive ($575–$2,000+/mo, revenue-based, enterprise sales); Nightwork is the self-service builder-built alternative at a quarter of the price.

### 1.2 Who Ross Built is, who the broader market is

Ross Built Custom Homes is the first instance and the source of every operational requirement baked into this plan. Founded 2006, ~14 simultaneous projects, cost-plus open-book builder, two admin owners (Jake Ross, Andrew Ross), six PMs, three accounting roles, one ownership viewer. Team and roles documented in `CLAUDE.md`.

The broader target is custom and semi-custom builders running 1–15 simultaneous jobs who today live in QuickBooks + Excel + Buildertrend + email + paper. Adaptive serves the upper end and charges accordingly; Nightwork serves the same segment self-service.

### 1.3 The four moat pillars

The defensibility thesis (from `docs/nightwork-rebuild-plan-amendment-1.md` §moat-thesis) rests on four pillars. The plan is built around making each one true.

**Pillar 1 — Universal ingestion.** Every construction document gets classified, extracted, and structured by AI. No competitor does this end-to-end. The classify-extract-commit pipeline (§7) is how this gets built. Two extractors are live (invoice, proposal); four are scheduled (CO, vendor, budget, historical draw).

**Pillar 2 — Cost intelligence that compounds.** Every accepted proposal, every approved invoice, every signed CO contributes line-level pricing data with vendor, date, item attributes, and cost code attached. Within months an active org has irreplaceable pricing memory. The architecture (§8) treats this as first-class. The current gap — embedding-on-create wiring — is a named blocker (§12.1).

**Pillar 3 — Schedule intelligence that compounds (Phase 4).** Same pattern as cost intelligence, applied to time. Every PO/CO carries `estimated_start_date`, `estimated_duration_days`, and actual dates as they accumulate. Within 6–18 months, an active org has a predictive schedule model. Phase 4 is a placeholder — schema fields ship from Phase 3.5 onward so data accumulates passively before the intelligence layer is built (§9).

**Pillar 4 — AI as bookkeeper.** For small remodelers with no in-house finance team, Nightwork is not "saves time on financial workflows." It IS the financial department. Cost codes get assigned automatically. Vendors get matched. Draws get generated. Anomalies get flagged. A human bookkeeping add-on (later) handles the edge cases. This pillar overlays the others — it's how the platform sells to the long tail.

### 1.4 Cross-org data sharing — explicitly off

Per Jake's decision (amendment-1 §cross-org), every org's intelligence is private. No cross-org rollups, no anonymized regional benchmarks. The schema is designed so cross-org sharing is technically possible — canonical NAHB codes are universal, items are vendor-attributed — but explicitly disabled at the query layer. This preserves the option to enable it later as a paid premium tier without re-architecting.

---

## 2. The reconciliation thesis (TBD)

> **TBD section.** This section names the wedge but does not yet specify the implementation.

The four-pillar moat thesis (§1.3) is what Nightwork sells. The reconciliation thesis is what Nightwork is. Construction is a chain of entities that drift from each other over time:

```
proposal → estimate → contract → budget → PO → CO → invoice → payment → draw → lien release
```

At every transition, numbers and scope can drift. The accepted proposal said $208,774.69 but the contract was signed at $215,000. The PO was issued for $42,000 but the first invoice billed $44,500. The CO log shows $186,000 of approved COs but the budget reflects $174,000. The draw bills $12,000 of work but only $9,800 of lien releases came back. Each is a normal field-versus-paper gap; collectively, they are how a job's books drift from reality.

Nightwork's wedge — beyond ingestion and cost intelligence — is **AI-mediated reconciliation across these transitions, with drift detection at every entity boundary.** A proposal commits, the AI watches for contract drift; the contract commits, it watches for budget-line drift; the budget commits, it watches for PO-issuance drift; and so on. At each boundary, the system surfaces the gap, suggests the correction (forward CO, retroactive CO, scope split, dispute, accept), and writes back upstream so the books stay coherent.

Today, the codebase contains pieces — `paper_lag_days` planned on COs (amendment-1 §Phase 3.7), `is_change_order` flags on invoices, status_history JSONB carrying audit transitions, anomaly flags in cost intelligence. But there is no unified reconciliation surface, no drift detection at every transition, and no canonical UI for "the books and the field disagree by $X — here's why and here's how to fix it."

### Open questions

1. **What defines drift at each transition?** Proposal-to-contract is straightforward (totals differ). Budget-to-PO is harder (a PO consumes a budget line; partial draws and overages need a tolerance). Invoice-to-PO drift (variance) is proposed in Phase 3.6 with TBD defaults. CO-to-budget requires deciding when an approved CO has executed against the budget vs still pending.

2. **What does the reconciliation UI look like?** Per-job dashboard with a drift column on every entity? A queue of unreconciled gaps? A timeline overlay? The gold-standard `/invoices/[id]` page (audit Deliverable 6) is the closest precedent but doesn't show cross-entity drift.

3. **What does writeback look like?** When a CO is approved, does it modify the original proposal's `total`, or just the budget? When an invoice is reconciled to a PO, does the PO's `consumed` derived value update (today: no — variance is a planned write in Phase 3.6)?

4. **Where in the phase plan does this live?** Reconciliation is implicit in Phases 3.6 (invoice ↔ PO), 3.7 (CO workflow), 3.9 (budget + draw). It is not currently called out as its own phase. A v2 of this plan should likely define a Phase 3.X explicitly devoted to "the reconciliation surface" once the constituent extractors and matchers are live.

These need to be locked before any reconciliation surface is built. Until then, individual phases (3.6, 3.7, 3.9) carry the per-transition reconciliation logic and the cross-entity story remains stitched-together.

---

## 3. Standing rules R.1–R.23 + meta-process

The 23 standing rules below are reproduced verbatim from `docs/nightwork-rebuild-plan.md` Part R. They apply to every branch, every phase, every commit. Violating them is grounds for rejection at the phase exit gate. Claude Code reads this section at the start of every session.

### R.1 Never kill running processes

Never run `pkill`, `kill`, `taskkill`, `killall`, or equivalent. Never kill the dev server, never kill Node, never kill Supabase. If a port is in use, pick a different port. If a process is stuck, report it — don't kill it.

### R.2 Recalculate, never increment/decrement

For any derived value (budget committed, invoiced totals, approved CO totals, etc.): always recompute from source truth. Never `UPDATE ... SET committed = committed + X`. Always `UPDATE ... SET committed = (SELECT SUM(...) FROM ... WHERE ...)`. Increment/decrement patterns drift silently when a trigger fails, a row is soft-deleted, or an operation is retried.

### R.3 Org-configurable, never hardcoded

Any workflow behavior that could differ between builders must be a per-org or per-job configuration. No hardcoded approval chains, no hardcoded cost code lists, no hardcoded draw modes, no hardcoded retainage percentages. If it feels like a policy choice, it's configurable.

### R.4 Rebuild over patch

When existing code is wrong, rip it out and rebuild. Not "wrong as in incomplete" — wrong as in foundationally off-target, pattern-mismatched, or drifting from the schema/architecture defined in this plan. Patching wrong code creates compounding debt.

### R.5 Trace, don't assume

Before modifying any entity, trace its downstream dependencies. If you change an enum value, grep for every string reference. If you rename a column, check triggers, views, RLS policies, API routes, UI components. If you delete a route, check nav, dashboard links, email templates.

### R.6 Block destructive actions when linked records exist

Before allowing a delete/void/status change on a record, check for linked children. A job with draws can't be deleted. A draw with approved invoices can't be voided without a `canVoid*` guard. Guards live in `src/lib/guards/*.ts`.

### R.7 Log all state changes to status_history

Every mutation on a statused entity appends to `status_history` JSONB: `{from, to, actor_user_id, at, reason?, comment?}`. This is audit-critical. No exceptions.

### R.8 Amounts in cents

Money is stored as `BIGINT` cents. Never `NUMERIC`, never `REAL`, never `FLOAT`. Display as dollars via format helpers. Math happens in cents.

### R.9 Source document provenance

Any entity that could be drag-created (invoices, POs, COs, proposals, vendors, budgets, historical draws) has `source_document_id UUID` that points to the `document_extractions` row it came from. Manual entities have `source_document_id` = NULL — not a broken FK.

### R.10 Optimistic locking on mutations

All PATCH requests on mutable entities include `expected_updated_at`. The API returns 409 Conflict on mismatch. This is not optional — it's the only way multi-user editing stays safe.

### R.11 Screenshots are inline, not disk-saved

Screenshots are captured via Chrome MCP and returned inline in the conversation. They are not persisted to disk.

### R.12 Single QA file per phase

At the end of every phase, Claude Code produces **one** QA report file named `qa-branch{N}-phase{M}.md` in `./qa-reports/` following the format in §3 meta-process. The folder is git-versioned, not gitignored — QA reports are the rebuild's audit trail and must travel with the code.

### R.13 Read CLAUDE.md first

Every Claude Code session begins by reading `CLAUDE.md` and this plan doc.

### R.14 No placeholder content

Never ship "coming soon" pages, stub components, or Lorem ipsum. If a feature isn't built, it isn't in the nav, isn't linked, and doesn't render.

### R.15 Test-first when possible

For any fix that closes a bug, write a failing test FIRST that would have caught the bug, then fix the bug. Save the test to `__tests__/`.

### R.16 Migration files are the source of truth

Never apply schema changes directly via MCP or dashboard. Every schema change is a numbered migration file committed to git.

### R.17 Atomic commits

Every phase commit is self-contained and passes all tests. Never commit a partial phase. Never commit with failing tests. Never commit with `TODO`/`FIXME`/`XXX` without a linked issue.

### R.18 Phase spec file lists are advisory, not authoritative

The "Files touched" list in each phase spec is the plan author's guess at blast radius. It is advisory. At every phase kickoff, Claude Code must grep the actual codebase for the identifiers the phase will change and reconcile. Exit gate grep/rename checks are the authoritative scope.

### R.19 Live execution of manual tests

Manual tests in a phase's exit gate must be executed live against a running dev server with real HTTP requests and real auth sessions. Static-validation carve-out conditions: (a) the runtime path touched is a single function call with no middleware, auth flow, or service-orchestration implications; (b) Migration Dry-Run negative probes or equivalent exercise the full stack at the database layer. Both conditions must be cited explicitly in the QA report when invoked.

### R.20 Read project scripts before invoking

Before running any project script, read the script contents. Scripts can contain kill commands, destructive operations, or environment mutations that violate R.1, R.5, or R.6.

### R.21 Synthetic test fixtures, never production-shaped data

Live manual tests must use purpose-built synthetic fixtures created at phase kickoff and torn down at phase end. Real Ross Built job data must not be used as test fixtures. Naming convention: prefix `ZZZ_PHASE_X_X_TEST`.

### R.22 Teardown script sequencing

R.21's teardown script must reflect every fixture actually created during the phase. Authoring order: finalize fixtures → write and commit teardown → execute tests → execute teardown.

### R.23 Codebase-precedent check for RLS and table conventions

Before writing a new migration that adds RLS policies, triggers, or new table conventions, the Schema Validator subagent must identify the most recent tenant-table migration of the same shape and report its pattern BEFORE any new SQL is written. Don't invent policy structures — adopt the existing pattern and flag any intentional divergence for explicit approval.

### Meta-process

The phase execution loop: Jake prompts → Claude executes → Claude generates QA report at `qa-reports/qa-branch{N}-phase{M}.md` → Jake uploads → Claude reviews against exit gate → if all green, proceed; otherwise fix-prompt back to start.

Every phase has a phase-specific exit gate that extends the universal checklist (CODE QUALITY / SCHEMA / API / UI / TESTS / REGRESSION / STANDING RULES / GIT HYGIENE / DOCUMENTATION). The full template lives in `docs/nightwork-rebuild-plan.md` Part G.2 and remains unchanged.

QA report format (G.3) is enforced. Visual QA is required for any UI-touching phase: screenshots embedded as base64 data URIs, capture resolution 1280×800 desktop / 375×667 mobile, file size cap 35MB. Backend-only phases write "N/A — backend only" with justification.

Subagents (G.4) are used surgically: Schema Validator after migrations, Visual QA after UI is complete, Test Runner every phase, Grep/Rename Validator on renames, Migration Dry-Run on schema, Rebuild Impact Analyzer when G.5 is invoked. The G.5 rebuild decision tree defaults to REBUILD unless the existing code's architecture is aligned with this plan AND its implementation is correct.

Migration SQL conventions (G.9): all table references in migrations must be qualified with the `public.` schema prefix from migration 00064 onward.

---

## 4. Architecture rules — current state

These are load-bearing rules baked into the codebase today (per audit Deliverable 7). Each one has files that depend on it; changing one ripples through the system.

**4.1 Multi-tenancy via `org_members.user_id` RLS.** Every tenant table's RLS resolves through `org_members`. `getCurrentMembership()` (in `src/lib/org/session.ts`) reads the same table. Single-org-per-user is load-bearing — a user with two active memberships gets the older one. Platform-admin escape hatch via `app_private.is_platform_admin()` (`SECURITY DEFINER`, `search_path = ''`). No grep hits for `org_id` trusted from request body or query param.

**4.2 Soft-delete only.** No hard `DELETE` in app code. Voided records keep status + reason. Soft-delete predicates are application-layer, not RLS — every query adds `.is("deleted_at", null)`. By design (per `CLAUDE.md`); a forgotten filter leaks soft-deleted records (audit Deliverable 3, §Anti-patterns).

**4.3 Money in cents.** All amounts stored as `BIGINT` cents; conversion in the UI only via `formatCents()`. Discipline holds across the codebase.

**4.4 Status history JSONB on every workflow entity.** `status_history JSONB NOT NULL DEFAULT '[]'::jsonb` with shape `{ who, when, old_status, new_status, note? }`. App-layer append; no triggers; no DB-level structural validation. Tables: `invoices`, `draws`, `change_orders`, `purchase_orders`, `proposals`, `lien_releases`, `internal_billings`.

**4.5 RLS conventions (R.23 precedent, 3-policy default).** Newer migrations (00065+) use SELECT, INSERT, UPDATE — no DELETE policy (defaults to deny). Older migrations used `app_private.user_org_id()`; pattern drifted. Documented divergences include `pricing_history` (1-policy SELECT-only because trigger-populated, migration 00073) and `draw_adjustments` (PM-on-own-jobs read narrowing, migration 00069).

**4.6 Optimistic locking on PATCH.** Client passes `expected_updated_at`; server uses `updateWithLock()` and returns 409 with current row on mismatch. 10 routes use it. Known gap: `proposals/commit` doesn't take it (audit Deliverable 5).

**4.7 TypeScript strict, no `any`.** Test fence in `__tests__/queries.test.ts` greps for `: any` and fails. Project-wide rule per `CLAUDE.md`.

**4.8 Trigger-maintained caches as exception.** Computed values are recomputed on read (R.2) except where read-time recompute would be prohibitively expensive. Each cache column has an explicit trigger and rationale comment. Canonical example: `jobs.approved_cos_total` maintained by `co_cache_trigger` (migration 00042).

**4.9 SECURITY DEFINER patterns.** Multi-table cascades go through Postgres RPCs, not TypeScript transactions. Examples: `draw_submit_rpc`, `draw_approve_rpc`, `draw_void_rpc`, `draw_lock_rpc` (migration 00061). The TS layer never opens a transaction. Multi-step writes that aren't RPC-backed use sequential writes with rollback-on-error (e.g., `proposals/commit` soft-deletes on failure).

**4.10 The hot-path matcher boundary.** Four files (per addendum-B): `match-item.ts` (906), `commit-line-to-spine.ts` (524), `extract-invoice.ts` (914), `correct-line.ts` (117) — total 2,461 LOC. Byte-identical between branches; any change requires a deliberate, isolated commit.

**4.11 CHECK constraints over Postgres ENUM types.** Status columns are `TEXT NOT NULL CHECK (status IN (...))`. Adding a value is `ALTER TABLE`, not `CREATE TYPE`. Migration 00060 explicitly aligned values across invoice/draw/PO/CO.

**4.12 `org_id` always derived from auth, never trusted from request body.** No grep hits for the bad pattern.

**4.13 No hardcoded `ORG_ID` fallback.** If a record's `org_id` is null, fail with 500. The only legitimate constant is `TEMPLATE_ORG_ID` for seed reads.

**4.14 Service-role fallback for reads.** Some routes call `tryCreateServiceRoleClient()` first to avoid RLS-with-embedded-foreign-tables noise during auth rehydration, then explicitly include `eq("org_id", orgId)` filtering at the application layer.

---

## 5. Data model — current state

The schema is the most stable artifact in this codebase. 91 numbered migrations (00001–00091), `.down.sql` paired from 00060 onward, ~70 tables, RLS on every tenant table, 354-row NAHB seed, 30+ triggers, 80+ indexes. Row counts below are from the live dev DB queried on 2026-04-28 (audit Deliverable 4).

### 5.1 Auth / org / permissions

| Table | Rows | Notes |
|---|---:|---|
| `auth.users` | 11 | Supabase-managed |
| `public.profiles` | 11 | Mirror of `auth.users` |
| `public.users` | 9 | **Legacy** — Phase 1 internal team table, parallel to `profiles` |
| `public.organizations` | 3 | Ross Built (enterprise/trialing), 2 test orgs |
| `public.org_members` | 11 | The RLS anchor: (org_id, user_id, role, is_active, …) |
| `public.org_invites` | 0 | 24-byte hex token, 14-day expiry |
| `public.platform_admins` | 2 | Jake + Andrew |
| `public.platform_admin_audit` | 8 | Append-only |

The legacy `public.users` is referenced by Phase 1 FKs (e.g., `assigned_pm_id` on invoices) and coexists with `profiles` and `auth.users`. Cleanup migration pending.

### 5.2 Jobs and vendors

`public.jobs` (16): universal parent. Contract amounts in cents. `retainage_percent`, `deposit_percentage`, `gc_fee_percentage`. `public.vendors` (24): per-org. `default_cost_code_id`. `qb_vendor_id` is present and never written.

### 5.3 Cost codes (3-layer + legacy bridge)

| Table | Rows | Notes |
|---|---:|---|
| `public.cost_codes` | 238 | **Legacy Phase-1 codes.** 5-digit Ross Built codes seeded. `is_change_order` flag. |
| `public.canonical_cost_codes` | 354 | NAHB spine v1: 5 level-1, 62 level-2, 287 level-3 (`spine='NAHB'`). Read-only RLS to all authenticated. |
| `public.org_cost_codes` | 12 | Per-org Layer-2 mapping. Sparsely used. `canonical_code_id` nullable. |
| `public.pending_cost_code_suggestions` | 1 | PM-suggested codes awaiting owner/admin approval. |
| `public.cost_code_templates` | 4 | System-level starter templates for new orgs. |

Two registries coexist by design until consolidation: legacy `cost_codes` (238) and `org_cost_codes` (12). Every cost code lookup has to know which table to query. Proposal commit performs a silent dual-write bridge (audit Deliverable 4, §Cost codes).

### 5.4 Budgets

`public.budget_lines` (288): one per cost code per job. `original_estimate`, `revised_estimate` (with CO adjustments), `committed` (PO sum), `invoiced` (auto-sync trigger). `public.budgets` (0): version history per job — schema only. Computed fields (`previous_applications`, `this_period`, `total_to_date`, `percent_complete`, `balance_to_finish`) are computed on read except where the 00042 trigger maintains a cache.

### 5.5 POs / COs / internal billings

| Table | Rows | Notes |
|---|---:|---|
| `public.purchase_orders` | 0 | **Tables exist; no rows. PO ingestion deferred per amendment-1.** |
| `public.po_line_items` | 0 | Same. |
| `public.change_orders` | 88 | Mostly Ross Built historicals. `gc_fee_amount`, `gc_fee_rate`, `total_with_fee`, `draw_number`. `source_invoice_id` for future Phase 3.6 handoff. |
| `public.change_order_lines` | 0 | Schema only. |
| `public.change_order_budget_lines` | 0 | Schema only. |
| `public.internal_billing_types` | 8 | Org-scoped: GC Supervision, Contingency, etc. |
| `public.internal_billings` | 3 | Live internal billings on draws. |

### 5.6 Invoices

`public.invoices` (57; 55 `qa_approved`, 2 `qa_review`): the most mature workflow table. `status_history` JSONB. `document_category` (job_cost / overhead). `is_change_order`, `is_potential_duplicate`, `parent_invoice_id` (partial split). `pm_overrides` + `qa_overrides` JSONB. `ai_raw_response` JSONB. `import_batch_id`.

`public.invoice_line_items` (119), `public.invoice_allocations` (51, newer 00038/00078), `public.invoice_import_batches` (1). Indexes from migration 00035.

### 5.7 Draws / liens / payments

`public.draws` (2 active, both `draft`): wizard draft in `draws.wizard_draft` JSONB. G702 fields stored, computed at create-time, updated via RPC. `retainage_on_completed/stored`, `total_retainage`. `parent_draw_id`, `is_final`, `locked_at`. Cover letter text + `generated` flag.

`public.draw_line_items` (16): per budget_line per draw. `public.draw_adjustments`/`draw_adjustment_line_items` (0/0): schema only. `public.lien_releases` (0): per draw per vendor.

Atomicity: `draw_submit_rpc`, `draw_approve_rpc`, `draw_void_rpc`, `draw_lock_rpc` (all migration 00061). All `SECURITY DEFINER`, `FOR UPDATE` row locks, `_force_fail` parameter for testing rollback.

### 5.8 Proposals

`public.proposals` (1, the Phase 3.4 cutover): 38 columns including `raw_extraction` JSONB, `extraction_confidence`, `additional_fee_schedule` JSONB, `payment_schedule` JSONB, `payment_terms` JSONB, `schedule_items` JSONB, `accepted_signature_present/name/date`, `vendor_stated_start_date`, `vendor_stated_duration_days`. `amount BIGINT` (cents).

Naming note: amendment-1 line 297 wrote `total_cents BIGINT NOT NULL`; the shipped column is `amount BIGINT`. Same semantics. Cutover row is $208,774.69, status `accepted`.

`public.proposal_line_items` (7): per-line. Cost code dual-write (`cost_code_id` + `org_cost_code_id`). Cost-intelligence wiring deferred per addendum-B.

### 5.9 Cost intelligence

| Table | Rows | Notes |
|---|---:|---|
| `public.items` | 61 | Canonical item registry (per addendum-B). `embedding VECTOR(1536)`, `occurrence_count`, `default_cost_code_id`. |
| `public.item_aliases` | 6 | Vendor-scoped. Tier-1 matcher. |
| `public.vendor_item_pricing` | 7 | Pricing spine. `source_type`, `unit_price`, `cost_components` JSONB. |
| `public.pricing_history` | 126 | Append-only audit (00073/00077). 1-policy RLS (R.23 deviation). |
| `public.line_cost_components` | 285 | Hybrid component breakdown. |
| `public.line_bom_attachments` | 2 | Bill-of-materials. |
| `public.unit_conversion_templates` | 13 | System-level. |
| `public.unit_conversion_suggestions` | 3 | AI-proposed. |
| `public.job_item_activity` | 6 | Plan vs actual per item per job. |
| `public.item_classification_corrections` | 0 | PM corrections feed back to alias library. |

`items_embedding_idx` is `ivfflat` cosine, 100 lists. pgvector enabled in migration 00084.

### 5.10 Document extractions (the universal mediator)

`public.document_extractions` (133, ~75 active): the universal row. `classified_type` (10 values), `target_entity_type` (7), `target_entity_id` (bare UUID, no FK), `verification_status`. `extracted_data` JSONB cache + `extraction_prompt_version`. `raw_pdf_url`. `invoice_id` made nullable in migration 00081 so proposals share the row.

`public.document_extraction_lines` (391). The bare UUID `target_entity_id` is documented in migration 00076 — alternative would be one column per entity type, which doesn't scale to 10 classified types.

### 5.11 Approvals / milestones / portal / support / feedback

`public.approval_chains` (18): 6 workflow types × 3 orgs. Default seed via trigger. `public.job_milestones` (0): schema only — v2 infra for fixed-price builders (00071). `public.client_portal_access`, `client_portal_messages` (0/0): SHA-256 hashed token, 90-day sliding window. `public.feedback_notes` (1), `support_conversations` (3), `support_messages` (14).

### 5.12 Usage / audit / misc

`public.api_usage` (1,928): every Claude / OpenAI call logged. `public.activity_log` (63), `public.notifications` (78), `public.parser_corrections` (5), `public.org_workflow_settings` (3). `public.email_inbox` (0): future intake stub. `public.subscriptions` (0): vestigial. `public.selection_categories` (39), `public.selections` (0).

### 5.13 Status history JSONB shape

```jsonb
[{ "who": "<user_uuid>", "when": "<ISO8601>", "old_status": "<text>", "new_status": "<text>", "note": "<optional>" }]
```

Schema enforced by `src/lib/activity-log.ts`. No triggers, no DB-level validation.

### 5.14 Tables marked deprecated / vestigial

Per audit Deliverable 4 §Concerns: `public.users` (legacy), `public.subscriptions` (duplicates `organizations.subscription_*`), `public.email_inbox` (vestigial unless Phase-4 ships), `public.cost_codes` (coexists with `org_cost_codes` until consolidation).

---

## 6. Data model — target state (Unified Commitment Model — TBD)

> **TBD section.** UCM is the proposed target, tentatively locked 2026-04-28. Final schema design pending.

The current data model (§5) treats each commitment-shaped entity (proposal, contract, PO, CO, invoice, draw line) as its own table with its own status enum, its own line-items table, its own extraction handler, and its own review surface. UCM is the proposed target: one underlying table for all commitment-shaped entities, with type discrimination and entity-specific projections on top.

Motivating findings from the audit:

- **Two cost code registries coexist** (audit Deliverable 4 §Cost codes). Every lookup has to know which table.
- **`status_history` JSONB has no DB-level enforcement** (audit Deliverable 3 §JSONB usage). Each table relies on `src/lib/activity-log.ts`.
- **`target_entity_id` is a bare UUID without FK** (audit Deliverable 4 §Document extractions). Integrity is application-layer only.
- **No transactions in the TS layer** (audit Deliverable 3 §DB transactions). Multi-table cascades go through `SECURITY DEFINER` RPCs; sequential writes use rollback-via-soft-delete. Proposal commit is the canonical fragility example (audit Flow B).
- **Per-entity status enums** drift from each other. Migration 00060 had to re-align invoice/draw/PO/CO sets after they had drifted in earlier phases.

### Open decisions

**(a) Wide table with nullables vs narrow table with JSONB attributes.** A wide `commitment_lines` table produces a sparse table with most columns null per row. A narrow table with `attributes JSONB` produces denser rows at the cost of typed columns and JSONB queryability concerns. Today's `proposal_line_items` has 38 columns including 4 JSONB; `invoice_line_items` has 12 columns. Wide would be very wide.

**(b) Per-entity status vs global chain state.** Today each entity has its own status. UCM could collapse to a chain-state model (drafted → committed → consumed → reconciled → closed) or keep per-entity statuses with a chain-position column. The reconciliation thesis (§2) implies the chain-state model would be more useful.

**(c) Migration sequence.** (1) Ship UCM as Phase 4.0 before any further extractor work; (2) ship per-entity extractors (Phases 3.6–3.9) on the current schema, then migrate to UCM in Phase 4; (3) ship UCM incrementally as each phase touches its entity, with the legacy `cost_codes` consolidation as the first step. Option (3) is the most pragmatic but bears the highest risk of partial migration.

These decisions need to be locked before any UCM code is written. Until then, individual phases continue to extend the current schema (§9) with explicit awareness that UCM consolidation is the planned target.

---

## 7. The classify-extract-commit pipeline

The universal pattern for moving a document from upload to entity is three stages mediated by `document_extractions`. Per audit Deliverable 7 §D, this is enforced in migration 00076 and every extraction route since.

### 7.1 The three stages

**Stage 1 — Classify.** PM uploads a PDF. The drop-zone POSTs to `/api/ingest`, which uploads to Supabase Storage at `{org_id}/ingest/{timestamp}_{filename}` (bucket `invoice-files`, retained from Phase 1 even after extension to other types), inserts a `document_extractions` row with `verification_status='pending'`, then calls `src/lib/ingestion/classify.ts`. Classifier is Claude Sonnet 4 with prompt version `phase-3.2-v2`, system prompt instructing 10-way classification, `cache_control: ephemeral` on the system prompt. Returns `{ classified_type, confidence }`. Audit log via `api_usage`. Per audit Deliverable 0, this dominates by call volume — 1,298 calls / 6.15M tokens / $25.71 of the $37.88 lifetime spend.

**Stage 2 — Extract.** Per-classified-type extractor reads the row, calls a typed prompt against the PDF, writes `extracted_data` JSONB and `extraction_prompt_version`. Two extractors are live: invoice (mature) and proposal (Phase 3.4). Four are scheduled: CO (3.7), vendor (3.8), budget (3.9), historical draw (3.9).

**Stage 3 — Commit.** PM (or auto-commit at high confidence) reviews, edits, clicks Save. The commit route validates membership + role, re-loads the extraction, validates `target_entity_id IS NULL`, INSERTs the entity and its line items, runs cost-intelligence wiring (deferred for proposals — see §8), and UPDATEs `document_extractions` SET `target_entity_type`, `target_entity_id`, `verification_status='verified'`. The 409 on already-committed extraction is the race guard.

### 7.2 The 36/36 + 2-flake eval baseline

`__tests__/document-classifier.test.ts` is the regression fence. Fixtures in `__tests__/fixtures/classifier/.local/{category}/*.pdf`. Gates: overall ≥90%, FAT categories (≥3 fixtures) ≥80%. Two known-flake fixtures are explicitly allowlisted: `10_Home_Depot_Receipts.pdf` (expected `invoice`, observed `other`, GH issue 28) and `Dewberry - Gilkey Landscaping 6-5-25 Q.pdf` (expected `proposal`, observed `contract`, GH issue 30).

Pass rules: 36/36 = pass. 35/36 with one of those two failing = pass with note. 35/36 with a different fixture failing = fail. 34/36 (both flakes hit) = fail. Cache reads verified via `api_usage.cache_read_input_tokens > 0`.

The eval is `RUN_CLASSIFIER_EVAL=1`-gated, costs ~$0.50 / 4–5 minutes per run. CI doesn't run it. Manual operator discipline is the only fence — flagged as a top concern (audit Deliverable 9).

### 7.3 The cache-on-extraction pattern (Phase 3.4)

`document_extractions.extracted_data` JSONB caches the full extraction envelope. `extraction_prompt_version` is the cache key. Bumping the constant in the route auto-busts every cached row on next read. No extra tables, no complex invalidation. The audit calls this elegant and reusable — every future extractor will adopt the same pattern.

The dual-purpose nature of `extraction_prompt_version` (carries either classifier or proposal extractor version, depending on which stage wrote last) is a flagged subtlety (audit Deliverable 9). A future bug needing both versions has nowhere to write. Consolidation would split into two columns.

### 7.4 Per-classified-type extractors

| Type | Status | Phase |
|---|---|---|
| invoice | LIVE | 1.x → 3.4 (mature) |
| proposal | LIVE | 3.4 (shipped 2026-04-28) |
| change_order | NOT STARTED | 3.7 |
| vendor | NOT STARTED | 3.8 |
| budget | NOT STARTED | 3.9 |
| historical_draw | NOT STARTED | 3.9 |
| purchase_order | DEFERRED | (POs are outputs not inputs per amendment-1) |
| plan, contract, other | NOT STARTED | TBD (passive routing) |

### 7.5 Shared review-form pattern

Audit Deliverable 6 names `/invoices/[id]/page.tsx` (2,229 LOC) as the gold-standard: 50/50 grid, file preview left, details + actions right, status timeline + edit history below, role-gated action strip, `print:hidden` chrome with a print-only static block. Surfaces that follow it: `/invoices/[id]`, `/draws/[id]`, `/jobs/[id]/budget`. Surfaces that don't: `/proposals/review/[extraction_id]` (single-column form), `/change-orders/[id]` (no file preview). Bringing them into line is tracked tech debt (§12).

---

## 8. Cost intelligence subsystem

The cost intelligence layer is Pillar 2 of the moat thesis (§1.3) — the substrate that turns every extracted line into compounding pricing memory. Phase 3.3 shipped the foundation; Phase 3.4 shipped proposal extraction with deferred wiring; the next critical wave is the embedding-on-create wiring (§9.2).

### 8.1 The compounding-pricing-database thesis

Every accepted proposal, every approved invoice, every signed CO has a vendor, a date, a unit price, and (with extraction) a normalized item description. Stored together in `vendor_item_pricing` and projected through `pricing_history`, this becomes a per-org, per-vendor, per-item, time-series pricing database. Within months, "what did we pay XYZ Stucco for 2x4 SPF stud-grade KD 92-5/8 in the last 6 months?" returns an answer backed by hundreds of data points. Within a year it's an irreplaceable asset that follows every estimate, every bid review, every CO. Cross-org sharing is held off (§1.4) but the architecture supports it.

### 8.2 NAHB canonical spine + 3-layer architecture

Per addendum-A, the canonical cost code spine is NAHB Standard Homebuilder Cost Codes: 354 rows seeded from `docs/canonical-codes/nahb-2024.csv` (5 level-1, 62 level-2, 287 level-3). Stored in `public.canonical_cost_codes` with `spine='NAHB'`. Read-only RLS to all authenticated users. CSI MasterFormat support is preserved as a future addition (same table, different `spine` value).

The 3-layer architecture: Layer 1 canonical (NAHB read-only), Layer 2 `org_cost_codes` (per-org map, sparsely populated — 12 rows live), Layer 3 display (PMs see their org's codes; queries hit canonical internally and translate back). Onboarding wizards will support CSV import of an org's existing codes from Buildertrend/Excel, leaving `canonical_code_id` NULL initially and nudging mappings over time.

### 8.3 Items registry + pgvector embeddings

Per addendum-B, the existing `public.items` table (61 rows) is the canonical item registry. `embedding VECTOR(1536)` and `occurrence_count` columns added in migration 00085 with `items_embedding_idx` (`ivfflat` cosine, 100 lists). pgvector enabled in 00084. Embedding model: OpenAI `text-embedding-3-small`, 1536 dims, ~$0.02 per 1M tokens.

Building a parallel `canonical_items` table (as amendment-1 originally proposed) was rejected — the existing `items` table is richer (carries `item_type`, `unit`, `canonical_unit`, `conversion_rules`, `pricing_model`, `scope_size_metric`, `default_cost_code_id`, plus `item_aliases` and `vendor_item_pricing` already wired to the 4-tier matcher).

### 8.4 The 4-tier matcher (boundary-protected)

Per addendum-B, four files are byte-identical between branches (audit Deliverable 7 §A): `match-item.ts` (906 LOC, 4-tier matcher: T1 alias-exact, T2 trigram vendor-scoped, T3 AI semantic, T4 AI propose-new), `commit-line-to-spine.ts` (524, commit verified extraction line to `vendor_item_pricing`), `extract-invoice.ts` (914, orchestrator), `correct-line.ts` (117, PM correction handler).

Tier 1 (exact alias) is instant and cost-free; Tier 2 (trigram) is fast SQL; Tier 3 (AI semantic) is the only Claude call; Tier 4 is the cold-start path. The boundary is byte-protected — any change requires a deliberate, isolated commit. The classifier eval doesn't directly cover this code, but a regression here breaks cost intelligence silently.

### 8.5 Embedding-on-create wiring — currently deferred (CRITICAL gap)

Per addendum-B, Phase 3.3 shipped the foundation: `items.embedding` column, embedding pipeline (`src/lib/cost-intelligence/embeddings.ts`), seed script, query layer (`findSimilarLineItems`, `getVendorPriceHistory`, `getCostCodeRollup`, `flagAnomaly`). Wiring embedding-on-create into `commit-line-to-spine.ts` was deferred — addendum-B says "to be scoped when the natural touch point arrives."

Phase 3.4 was the natural touch point. It shipped without the wiring. This is the named gap that turns the moat thesis from "in progress" to "real." Until proposal commit feeds the cost intelligence layer, the moat doesn't compound on the proposal side. The cost intelligence query layer returns scaffolded data today — `findSimilarLineItems` works on the 30 manually-backfilled embeddings but not on accumulating production data. Flagged as the top concerning item in the audit's honest assessment (audit Deliverable 9).

Sequenced as the first task of Phase 3.5 work (§9.2).

### 8.6 Verification queue + PM correction loop

`/cost-intelligence/verification` is the active surface for invoice extractions: PM reviews extracted lines, confirms matches, edits when wrong. PM corrections write `item_classification_corrections` rows and update the alias library through `correct-line.ts`. The feedback loop is real for invoices (the matcher gets smarter as Diane and the PMs correct it).

The cross-document classifier triage UI promised in amendment-1 §3.10 is not built. Today low-confidence classifications surface inside per-document review (e.g., proposal review form's `ProposalStatusBadge`); there is no unified queue across document types. Phase 3.10 will build this.

The PM-suggest-new-code modal writes `pending_cost_code_suggestions` (1 row live). Owners/admins approve/reject from `/cost-intelligence/verification`. PMs cannot directly create `org_cost_codes` — UI, API, and RLS gates all enforce this.

### 8.7 Pricing history append-only audit

`public.pricing_history` (126 rows) is trigger-driven, append-only. Migration 00073/00077 wires the trigger that fires on every `vendor_item_pricing` change. RLS is 1-policy SELECT-only (R.23 documented divergence) because it's an audit spine. The migration header explains the reasoning — the cleanest example of a deliberate divergence from R.23 in the codebase.

---

## 9. Phase plan — shipped, next, future

The phase plan below replaces the original `docs/nightwork-rebuild-plan.md` Part 5 phase list. Amendment-1's re-scoped phase order is the authoritative sequencing.

### 9.1 Shipped — Phases 1 through 3.4

| Phase | Deliverable | QA report |
|---|---|---|
| 1.1–1.5 | Branch 1 — schema baseline, enum alignment, RLS hardening, status_history, money-in-cents | `qa-reports/qa-branch1-final.md` + per-phase QAs |
| 2.1–2.X | Branch 2 — schema expansion (proposals 00065, milestones 00071, client portal 00074), R.23 RLS conventions | per-phase QAs |
| 3.1 | Document extractions universal row + rename (migration 00076) | `qa-branch3-phase3.1.md` |
| 3.2 | Document classifier (10-way, prompt v2, 36-fixture eval) | `qa-branch3-phase3.2.md` |
| 3.3 | Cost intelligence foundation (NAHB seed, org_cost_codes, items.embedding, pgvector) | `qa-branch3-phase3.3.md` |
| 3.4 | Proposal extraction + cache + 11-component review form + print view | `qa-branch3-phase3.4.md` (2026-04-28) |

The `qa-reports/` archive is the authoritative per-phase audit trail. It is git-versioned and never consolidated.

### 9.2 Next — Phase 3.5 + embedding-on-create wiring

**Phase 3.5 — PO Generation from Proposal.** Per amendment-1 §3.5. PM clicks "Convert to PO" on an accepted proposal → Nightwork generates a complete subcontract-grade PO bundle. Pre-fills line items from the proposal, applies the org's PO terms template, attaches plan pages from the job's plan set, generates a PDF, sends via email with e-sign link. Schedule intelligence fields (`estimated_start_date`, `estimated_duration_days`, `actual_start_date`, `actual_completion_date`, `schedule_predecessor_po_ids`) ship with this phase even though Phase 4 schedule intelligence is deferred — capturing data from day one is cheaper than backfilling.

Open questions before Phase 3.5 starts (carried forward from amendment-1): (1) e-signature provider (DocuSign / HelloSign / built-in), (2) plan attachment source, (3) Ross Built's actual sub agreement terms as the seed default.

**Embedding-on-create wiring.** Per §8.5, the named critical gap that turns the moat thesis from in-progress to real. Wiring touches `commit-line-to-spine.ts` and the proposal commit path. Sequencing options: (a) ship as part of Phase 3.5; (b) ship as Phase 3.4.1 hotfix before Phase 3.5; (c) ship as Phase 3.5.1 after PO generation. Option (b) is the most defensible — it cleans up Phase 3.4's deferred wiring before more extractors land. Tracked as Q2 in §11.

### 9.3 Future — Phases 3.6 through 3.10

**Phase 3.6 — Invoice ↔ PO matching + variance detection.** Per amendment-1 §3.6. Invoice matched to PO, variance flagged, payment blocked until reconciled. Tolerance org-configurable (default 2% / $250). Schema additions on invoices: `matched_po_id`, `variance_cents`, `variance_status`, `reconciliation_co_id`. Two reconcile paths: Create CO (forward to Phase 3.7) or Dispute invoice.

**Phase 3.7 — Change Order workflow (forward + retroactive equal weight).** Per amendment-1 §3.7. The reframe: retroactive COs are normal field operations, not deviations. Schema additions on `change_orders`: `co_origin`, `work_started_date`, `co_signed_date`, `paper_lag_days` (computed), `verbal_approver`, `field_documentation`, `source_invoice_id`, plus schedule intelligence fields. Paper lag days is a coaching metric, not a blocker. Signed-CO ingest is a thin pipeline because the CO record already exists — incoming PDFs match by CO number and attach the artifact.

**Phase 3.8 — Vendor extraction (W-9, COI, business cards).** Per amendment-1 §3.8. Schema on `vendors`: `coi_expiration_date`, `coi_carrier`, `coi_policy_number`, `w9_on_file`, `tax_id_encrypted` (never plaintext), `tax_id_type`, `trades` JSONB. The `trades` array enables Phase 3.5 plan-attachment suggestions and Phase 3.4 vendor-typeahead.

**Phase 3.9 — Budget + historical draw extraction (merged from original 3.7 + 3.8).** Per amendment-1 §3.9. Three input shapes: Excel/CSV with column-mapping UI, PDF basic line-item extraction, Buildertrend CSV pre-mapped. Historical G702/G703 ingest for onboarding migration. Cost intelligence integration: every imported line creates/updates `items` records.

**Phase 3.10 — Document review queue UI.** Per amendment-1 §3.10. Cross-document classifier-output triage UI. Surfaces low-confidence classifications for manual type selection. Adds a job-level document timeline. No schema changes.

Sequencing: 3.3 → 3.4 → 3.5 (strictly serial, completed for 3.3/3.4); 3.6, 3.7, 3.8, 3.9 can be parallelized; 3.10 depends on all extraction phases shipping.

### 9.4 Phase 4+ placeholder

Phase 4 is the umbrella for everything that depends on Phase 3.x extractors having shipped and accumulated data: schedule intelligence layer (Pillar 3); onboarding migration paths (Buildertrend export, Excel/Sheets); QuickBooks Online integration (`qb_bill_id` exists, no code); email intake parser (`accounting@rossbuilt.com`, `email_inbox` table empty); daily logs and site documentation; client portal UI; vendor portal; internal labor/equipment billing; inspection tracking; full QuickBooks two-way sync. UCM consolidation (§6) is also Phase 4-class work and may sequence before or alongside the items above depending on the open decisions.

---

## 10. Operations playbook

Operational procedures live in `docs/platform-admin-runbook.md` (kept alongside this plan); this section summarizes the load-bearing pieces.

**10.1 Platform admin.** Cross-tenant access stored in `public.platform_admins` (2 rows: Jake + Andrew). Granted via direct SQL insert (no UI by design); `platform_admin_audit` row written manually via service-role client. UI at `/admin/platform`. Middleware redirects non-staff to `/dashboard`. Every admin action opens a reason modal and writes to `platform_admin_audit`. Impersonation is a signed `nw_impersonate` cookie, max 1-hour TTL, red banner on every page. Service-role write shim for cross-org repairs is deferred — staff use Supabase SQL editor + manual audit log writes.

**10.2 Cost monitoring.** `public.api_usage` (1,928 rows lifetime) logs every Claude / OpenAI call with `function_type`, model, tokens, cost cents, status, error_message, metadata. Read by `/admin/platform` cost rollups. Lifetime spend is $37.88 (audit Deliverable 0). Cost is not a near-term constraint; quality is.

**10.3 Trial / billing operations.** Stripe webhook handles `customer.subscription.updated` and `customer.subscription.deleted`. Trial expiry is **not** auto-enforced — orgs in `trialing` past `trial_ends_at` keep working. Plan-limits gate is inconsistently applied. Both flagged as tech debt (§12).

**10.4 Incident handling.** Sentry wired in client/server/edge configs. `src/lib/sentry-context.ts` stamps `org_id`, `user_id`, `impersonation_active`, `platform_admin` on every request. Filter by org_id when a customer reports an error. Classifier regressions surface only via manual `RUN_CLASSIFIER_EVAL=1` runs.

**10.5 Backup / migration discipline.** Migrations are the single source of truth (R.16). 91 numbered migrations, `.down.sql` paired from 00060 onward. `cleanup_stale_import_errors()` (00047) exists for orphan-storage cleanup; not on a cron. The single cron route (`/api/cron/overdue-invoices`) is dormant — no Vercel Cron or external scheduler wired (audit Flow G).

---

## 11. Open architectural questions (TBD)

Each item below names a decision that needs to be locked before the phase or feature it gates can be built.

**Q1. Reconciliation surface — how and when.** (Per §2.) (a) Decision: whether reconciliation is an explicit Phase 3.X with its own surface, or distributed implicitly across Phases 3.6/3.7/3.9. (b) Audit/codebase: per-transition reconciliation (invoice ↔ PO, CO ↔ budget, draw ↔ lien) is planned in Phases 3.6/3.7/3.9; cross-entity drift detection is not. (c) Unknown: drift definitions per transition, UI surface, writeback rules, sequencing relative to UCM. (d) Lock by: before Phase 3.6 starts.

**Q2. Embedding-on-create wiring sequencing.** (Per §8.5 and §9.2.) (a) Decision: whether wiring ships as Phase 3.4.1 hotfix, Phase 3.5 bundled, or Phase 3.5.1 after PO generation. (b) Audit/codebase: addendum-B left this open. Phase 3.4 was the natural touch point and shipped without it. Top concerning item per audit Deliverable 9. (c) Unknown: precise touch points in `commit-line-to-spine.ts` and `proposals/commit/route.ts`; whether to also retro-fit invoice extraction. (d) Lock by: before Phase 3.5 starts.

**Q3. UCM design — wide vs JSONB, status model, migration sequence.** (Per §6.) (a) Decision: schema shape; whether commitment chain state replaces per-entity status enums; whether UCM ships before Phase 3.6, after Phase 3.10, or incrementally per touch. (b) Audit/codebase: two cost code registries coexist, `status_history` JSONB has no enforcement, `target_entity_id` is bare UUID without FK, no transactions in TS layer. (c) Unknown: schema shape, status model, sequencing. (d) Lock by: before any UCM code; ideally before Phase 4 planning.

**Q4. Cost code registry consolidation timing.** (a) Decision: when to consolidate `cost_codes` (legacy, 238) into `org_cost_codes` (12). (b) Audit/codebase: every cost code lookup has to know which table; proposal commit performs a silent dual-write. (c) Unknown: stand-alone migration vs fold into UCM. (d) Lock by: before Phase 3.6 if Phase 3.6's variance flow queries cost codes; otherwise before UCM.

**Q5. Trial expiry enforcement.** (a) Decision: middleware gate at request time vs cron flip on `trial_ends_at`. (b) Audit/codebase: today `trial_ends_at` is set but never enforced. Two test orgs are at or past expiry as of 2026-04-29. (c) Unknown: grace period, lockout UX (read-only? full lockout? upgrade prompt?). (d) Lock by: before paid GA.

**Q6. Plan-limits gating coverage.** (a) Decision: which token-consuming routes need gating, what 429 looks like. (b) Audit/codebase: ingest and parse routes gate; some invoice routes and `proposals/extract` do not. (c) Unknown: full inventory of routes that should gate, UI behavior at 429. (d) Lock by: before paid GA.

**Q7. `/api/invoices/[id]/docx-html` auth hardening.** (a) Decision: add explicit `getCurrentMembership()` + role check, or move route behind a different mediator. (b) Audit/codebase: today RLS-only (audit Deliverable 5 §Auth coverage). (c) Unknown: whether docx export should be role-gated beyond SELECT. (d) Lock by: before any further dogfooding — 5-minute fix.

**Q8. PO scaffolding fate.** (a) Decision: keep `purchase_orders` UI surfaces in nav for Phase 3.5 to populate, or remove until Phase 3.5 ships. (b) Audit/codebase: tables exist with 0 rows; UI surfaces show "No purchase orders" with no creation path. (c) Unknown: how loud the dogfood signal is. (d) Lock by: before Phase 3.5 starts; likely "leave in nav, Phase 3.5 fills."

**Q9. Classifier eval scheduling.** (a) Decision: cron (e.g., daily on dev), scheduled CI on a non-PR branch, or stay manual operator-discipline. (b) Audit/codebase: `RUN_CLASSIFIER_EVAL=1`-gated, ~$0.50/run. (c) Unknown: budget for daily eval (~$15/mo trivial), CI runner with API key access. (d) Lock by: before Phase 3.6 if it modifies the classifier prompt.

**Q10. Proposal commit transactionality and lock.** (a) Decision: convert `proposals/commit` to a `SECURITY DEFINER` RPC like the draw RPCs, or add `expected_updated_at` and accept sequential-write fragility. (b) Audit/codebase: today no transaction, no optimistic lock, soft-delete-on-failure can trap state. (c) Unknown: whether the RPC pattern generalizes to every other commit route — if yes, this becomes the precedent for all of them. (d) Lock by: before Phase 3.6 (the "Create CO" path will exercise the same pattern).

**Q11. Ingest pipeline orphan-storage cleanup.** (a) Decision: schedule `cleanup_stale_import_errors()` (00047), or accept orphan accumulation. (b) Audit/codebase: function exists, never runs. (c) Unknown: cron scheduler choice. (d) Lock by: before paid GA.

**Q12. Vestigial UI cleanup.** (a) Decision: delete the 32 vestigial pages (12 redirects + 20 stubs) or keep as nav placeholders. (b) Audit/codebase: half the navigable surface is placeholder. (c) Unknown: which placeholders correspond to in-flight phases vs dead ends. (d) Lock by: opportunistic; not blocking.

---

## 12. Outstanding tech debt + known issues

Top 10 from the audit's honest assessment (audit Deliverable 9), condensed. Resolution lives in a phase or in §11.

1. **Embedding-on-create deferred but not sequenced.** Per addendum-B and §8.5. Cost-intelligence-as-moat thesis depends on this. Resolution: Q2 in §11.

2. **`/api/invoices/[id]/docx-html` lacks explicit auth.** RLS-only. 5-minute fix. Resolution: Q7 in §11.

3. **Trial expiry not enforced.** Two test orgs at/past `trial_ends_at` as of 2026-04-29. Resolution: Q5 in §11.

4. **Plan-limits gating inconsistent.** Several token-consuming routes skip the check. Resolution: Q6 in §11.

5. **Proposal commit not transactional, no optimistic lock.** Race condition can produce orphaned proposals. Resolution: Q10 in §11.

6. **Classifier eval requires manual run.** Operator discipline is the only fence. Resolution: Q9 in §11.

7. **Two cost code registries coexist.** Legacy `cost_codes` (238) and `org_cost_codes` (12). Silent dual-write bridge. Resolution: Q4 in §11.

8. **PO scaffolding exists with zero production rows.** UI surfaces present, no creation path. Resolution: Phase 3.5 fills (Q8 in §11).

9. **No HTTP integration tests.** All 39 tests are structural fences or env-gated evals. The single largest test gap. Resolution: opportunistic per route.

10. **`extraction_prompt_version` column dual-purposed.** Carries either classifier or proposal extractor version. A future bug needing both has nowhere to write. Resolution: split at next consolidation.

---

## 13. Glossary + appendix

### 13.1 Glossary

- **AIA G702 / G703.** Standard contractor pay-application forms. G702 is the project summary (page 1); G703 the line-item continuation. Banks expect them; Nightwork exports Excel today (no real AIA form yet).
- **Buildertrend.** Existing CRM used by Ross Built. No public API; future Playwright scraper integration is on Phase 4.
- **Canonical cost code.** A code from a public-domain spine (NAHB or future CSI) that orgs map their working codes to.
- **Canonical item.** An item in `public.items` with a normalized name, embedding, attributes, and pricing history.
- **Conditional / unconditional lien release.** Vendor's waiver of lien rights upon receipt (conditional) or unconditionally for prior payments (unconditional).
- **Cost-plus / open-book.** Contract type where the client pays actual costs plus a GC fee. Ross Built's primary mode.
- **Drift.** The gap between two entities that should reconcile (proposal vs contract total, PO vs invoice, CO vs budget, draw vs lien). Per §2.
- **Hot-path matcher boundary.** The four byte-identical files in `src/lib/cost-intelligence/`: `match-item.ts`, `commit-line-to-spine.ts`, `extract-invoice.ts`, `correct-line.ts`. Per addendum-B.
- **NAHB Standard Homebuilder Cost Codes.** Public-domain spine published by the National Association of Home Builders. ~354 codes seeded.
- **Optimistic locking.** Concurrent-edit safety via `expected_updated_at`. Server returns 409 on mismatch.
- **Paper lag days.** Days between when work physically started and when the corresponding CO was signed. Coaching metric, not blocker. Phase 3.7.
- **PCO.** Potential Change Order. Forward-direction CO drafted before work begins.
- **Reconciliation thesis.** AI-mediated reconciliation across entity transitions, with drift detection at every entity boundary. Per §2.
- **Retainage.** Percentage withheld from each progress payment, released at substantial completion. Org-configurable; Ross Built defaults to 0; platform default is 10.
- **Schedule intelligence (Phase 4).** The second moat, parallel to cost intelligence, applied to time.
- **Soft delete.** No hard DELETE. Records keep `deleted_at` and a status + reason.
- **`target_entity_id`.** UUID on `document_extractions` pointing at the entity created from the extraction. No FK because it points at different tables depending on `target_entity_type`.
- **UCM (Unified Commitment Model).** Proposed target schema (§6). One underlying table for all commitment-shaped entities. TBD design.
- **Variance.** The dollar gap between an invoice and its matched PO. Phase 3.6.

### 13.2 Appendix A — Migration list

91 numbered migrations live at `supabase/migrations/00001_*.sql` through `00091_*.sql`. `.down.sql` paired from 00060 onward. Migrations are the single source of truth for schema (R.16). Read the migration headers — several recent ones (00069, 00071, 00073, 00074, 00076) carry multi-paragraph ADRs with R.23 precedents and divergence rationales.

### 13.3 Appendix B — Cost rollup query template

`public.api_usage` is the cost-instrumentation spine. Lifetime spend as of 2026-04-28 is $37.88 across 1,928 calls. Sample rollup (per audit Deliverable 0):

```sql
SELECT function_type, COUNT(*) AS calls, SUM(total_tokens) AS tokens, SUM(cost_usd) AS cost
FROM public.api_usage
GROUP BY function_type
ORDER BY cost DESC;
```

### 13.4 Appendix C — Classifier fixtures

The 36-fixture eval lives at `__tests__/fixtures/classifier/.local/{category}/*.pdf`. Two boundary flakes are allowlisted in `__tests__/document-classifier.test.ts:54-95`: `10_Home_Depot_Receipts.pdf` (GH issue 28) and `Dewberry - Gilkey Landscaping 6-5-25 Q.pdf` (GH issue 30). Eval gated by `RUN_CLASSIFIER_EVAL=1`; ~$0.50 / 4–5 minutes per run.

### 13.5 Documents that stay alive alongside this plan

- `CLAUDE.md` — operational constitution. Reduced where redundant with §3 and §4 of this plan; kept everywhere else.
- `docs/canonical-codes/nahb-2024.csv` — NAHB seed data (public domain).
- `docs/platform-admin-runbook.md` — deeper reference for operations.
- `docs/BRAND.md` — voice, positioning, pricing tiers.
- `qa-reports/qa-branch{N}-phase{M}.md` — per-phase audit trail. **Never consolidated.**
- `__tests__/*.test.ts` — test fences. 39 files.
- All 91 migrations + `.down.sql` pairs.

### 13.6 Documents retired by this plan

See `docs/CHANGELOG-plan-consolidation.md` for the full mapping. Marked SUPERSEDED 2026-04-29 (kept for history, not deleted):

- `critical-gaps.md`
- `REVIEW_FINDINGS.md`
- `DEFERRED_FINDINGS.md`
- `diagnostic-naming.md`
- `diagnostic-pdf-preview.md`
- `diagnostic-report-cost-intel.md`
- `diagnostic-source-highlighting.md`
- `e2e-findings.md`
- `route-sweep.md`
- `migration-preview.md`
- `smoke-test-results.md`
- `docs/QA-RESULTS.md`
- `docs/NAV_REORG_PLAN.md` (deprecated unless executed)
- `docs/nightwork-rebuild-plan.md` Part 5 phase list only (Part R + Part G remain canonical; supersession is partial)

---

**End of Nightwork Canonical Plan v1.**
