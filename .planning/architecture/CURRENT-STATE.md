# Nightwork — CURRENT-STATE.md

**Status:** Stage 1 architecture diagnostic. Last updated 2026-04-29.
**Scope:** Where Nightwork actually is, today. Comprehensive audit of entity coherence, workflow consistency, platform primitive coverage, code-level health, and known issues, plus the Drummond reference-fixture inventory across three sources.
**Source artifacts (gitignored intermediates):**
- `.planning/audits/2026-04-29/current-state-A-B.md` (entity coherence + workflow consistency)
- `.planning/audits/2026-04-29/current-state-C-D.md` (platform primitives + code health)
- `.planning/audits/2026-04-29/current-state-E.md` (dashboard 503 + ingestion gap)
- `.planning/fixtures/drummond/source1-pdrive/INVENTORY.md` (P-drive scan)
- `.planning/fixtures/drummond/source2-supabase/*.json` (DB extraction)
- `.planning/fixtures/drummond/source3-downloads/INVENTORY.md` (Downloads hunt)

This document is the second of four Stage 1 architecture artifacts (after `VISION.md`, before `TARGET.md` and `GAP.md`).

---

## Table of contents

A. Entity model coherence
B. Workflow consistency
C. Platform primitives coverage
D. Code-level health
E. Specific known issues
F. Drummond fixture inventory (3 sources)

Headline findings appear at the end.

---

## A. Entity model coherence

40 entities surveyed against the VISION.md target. Counts:

| Status | Count | Meaning |
|---|---:|---|
| **COMPLETE** | 16 | Entity exists, RLS + audit + soft-delete in place, no known coherence issues |
| **PARTIAL** | 9 | Entity exists but missing audit/RLS/soft-delete or has known gaps |
| **COEXISTING** | 5 | Multiple definitions for one logical concept |
| **MISSING** | 12 | Not yet implemented |
| **AMBIGUOUS** | 4 | Unclear if existing tables map cleanly |

### A.1 COMPLETE entities (16)

`organizations`, `vendors`, `jobs`, `budget_lines`, `draws`, `draw_line_items`, `change_orders`, `change_order_lines`, `invoices`, `proposals`, `proposal_line_items`, `draw_adjustments`, `job_milestones`, `internal_billings`, `lien_releases` (as table; see §A.2 for status_history gap), `client_portal_access`, `activity_log`.

These have full RLS coverage (with the R.23 3-policy shape or its documented divergences), audit-log writes via `activity_log` or status_history JSONB, and soft-delete via `deleted_at` (or status='void' for financial entities).

### A.2 PARTIAL entities (9)

| Entity | Gap |
|---|---|
| `auth.users` / `profiles` / `users` | Three identity tables; role enum diverges (`org_members.role` includes `owner`, `profiles.role` does not). Tolerated by design but a latent bug. |
| `budgets` (header table) | Created in migration 00027 with versioning intent; **0 rows live**. `budget_lines.budget_id` is nullable and never populated. G703 reads bypass it entirely. |
| `lien_releases` | **No `status_history` JSONB column** despite a 4-value status enum (pending/received/waived/not_required). Direct R.7 violation. Audit only via `activity_log`. |
| `approval_chains` | **Dead config.** Migration 00070 ships full architecture; `grep -r approval_chain src/` returns zero files. All approval flows are hard-coded role-based. Customer-customizable chains have no runtime effect. |
| `payments` | Modeled today as a projection of `invoices.payment_date` + `invoices.check_number` rather than its own table. Will need promotion to a first-class `payments` table for QB sync (Wave 5). |
| `document_extractions` | Converging — pipeline works for invoices and proposals; CO/vendor/budget/lien_release/daily_log extractors not yet built (canonical §7.4). |
| `email_inbox` | Scaffold-only. Schema present (`emails` shape via `email_inbox` table); 0 rows; no inbound webhook wired. Wave 3 work. |
| `notifications` | Live (78 rows) but no preference-center UI. Per-user mute is missing. |
| `retainage` | Forward-looking — derived (org_workflow_settings.retainage_percentage × draw_line_items.this_period). Not yet exposed in UI. |

### A.3 COEXISTING entities (5)

These are the high-priority drift risks. Every entry is a place where two or more tables represent one logical concept and downstream code must branch.

#### A.3.1 Cost-code triple table — **highest drift risk**

Three live tables with three RLS shapes:

| Table | Migration | Rows | RLS shape |
|---|---|---:|---|
| `cost_codes` | 00001 (legacy) | 238 | Original Phase-1 RLS |
| `canonical_cost_codes` | 00082 | 354 | Read-only, all authenticated |
| `org_cost_codes` | 00083 | 12 | R.23 3-policy + canonical mapping |

`src/app/api/proposals/commit/route.ts` carries explicit four-way branching for `pick_kind ∈ { canonical, org_existing, org_new, legacy_cost_code }`. Cutover from `cost_codes` to `org_cost_codes` is deferred indefinitely (canonical Q4). **Drift example:** Ross Built's real production cost codes live only in `cost_codes`; `org_cost_codes` for Ross Built contains 12 rows of synthetic test data (R-DW-001, R-FAKE-001, R-T-001 through R-T-007, R-TEST-FOO-001).

#### A.3.2 Three user-identity tables

`auth.users` (Supabase managed) + `profiles` (11 rows, identity-scoped extras) + `public.users` (9 rows, legacy). Role enum diverges between `org_members.role` (includes `owner`) and `profiles.role` (does not). Tolerated by design; latent bug if any code reads role from `profiles`.

#### A.3.3 Invoice line shape spans 4 tables

| Table | Rows | Purpose |
|---|---:|---|
| `invoice_line_items` | 119 | Canonical per-invoice line detail |
| `invoice_allocations` | 51 | Cost-code splits + base-vs-CO splits |
| `document_extraction_lines` | 391 | AI-parser output, pre-commit |
| `line_cost_components` | 285 | Hybrid cost-component breakdown (per migration 00067 comment) |

Migration 00078 backfills `invoice_allocations` from `invoice_line_items`. The same dollar amount lives in 4 places. Cost intelligence queries (Pillar 2) must know which to read. UCM (canonical §6) is the proposed consolidation.

#### A.3.4 Change-order line shape spans 2 tables

`change_order_lines` (Phase 3.7+ canonical) coexists with `change_order_budget_lines` (00015, **0 rows, 0 src/ consumers — verified dead code**).

#### A.3.5 `org_members.role` vs `profiles.role`

Same divergence flagged in A.3.2 — duplicating because it's an enum coherence issue too.

### A.4 MISSING entities (12)

Wave 2+ entities not yet built:

`schedule_items`, `schedule_baselines`, `tasks`, `punchlist_items`, `daily_logs`, `photos`, `weekly_updates` (Wave 2-3), `market_pricing_reference`, `performance_metrics`, `custom_reports`, `snapshots` (Wave 4), and as a Wave-1 promotion: `gl_codes` (currently implicit in cost-code mappings; first-class promotion proposed in VISION.md VQ2), `documents` (general document store — today docs live ad-hoc per entity).

### A.5 AMBIGUOUS entities (4)

| Entity | Question |
|---|---|
| `permissions` | Should it be a table, an RPC, or a capability map? VISION.md proposes RPC + capability map (synthetic). |
| `change_events` | Should this be a CDC-style stream over `activity_log`, or a separate higher-level entity? VISION.md leans synthetic-aggregation over `activity_log`. |
| `notes` | Today `notes` exists as an ad-hoc column on a few entities. Should it be promoted to a polymorphic `notes` table (entity_type + entity_id)? VISION.md leans yes. |
| `documents` | As above — general docs lack a central table; per-entity attachment columns exist. VISION.md leans first-class table. |

---

## B. Workflow consistency

9 workflow entities mapped. State enum sizes:

| Entity | Status enum size | Notes |
|---|---:|---|
| `invoice` | 21 | Largest enum; spans intake → AI parse → PM review → QA → QB → in_draw → paid → void |
| `draw` | 7 | draft → pm_review → approved → submitted → paid → void (+ revisions) |
| `change_order` | 5 | post-migration 00060 alignment |
| `purchase_order` | 6 | draft → issued → partially_invoiced → fully_invoiced → closed → void |
| `proposal` | 7 | post Phase 3.4 |
| `lien_release` | 4 | pending → received → waived → not_required |
| `draw_adjustment` | 5 | per migration 00069 |
| `job_milestone` | 4 | pending → in_progress → complete → billed |
| `todo` / `daily_log` / `punchlist` | — | MISSING (per A.4) |

### B.1 Top 5 workflow inconsistencies

1. **`approval_chains` is dead config.** 6-dimension architecture (invoice_pm, invoice_qa, co, draw, po, proposal) shipped in migration 00070 with 18 seeded rows. Zero `src/` consumers. Customer-customized chains have no runtime effect today; all approval logic is hard-coded role-based.

2. **Stored aggregates beyond CLAUDE.md's enumerated exception.** ~10 trigger-maintained cache columns across `jobs`, `budget_lines`, `purchase_orders`, `draws`. Only `jobs.approved_cos_total` is enumerated as a sanctioned R.2 exception. Most lack `COMMENT ON COLUMN` rationale.

3. **`lien_releases` violates R.7.** Status enum present (4 values), API transitions present, status_history JSONB **column missing**. Reading the row in isolation gives no transition history; audit only via cross-table `activity_log` lookup.

4. **No central state-transition helper.** Every workflow route hand-rolls `[...history, { who, when, old_status, new_status, note }]`. `src/lib/activity-log.ts:logStatusChange` writes only to `activity_log`, not to row JSONB. Two write paths for one logical event; drift inevitable.

5. **`send_back` cascade documented as incomplete.** Header note in `src/app/api/draws/[id]/action/route.ts`: *"send_back's cascade is a known gap."* Submit/approve/void are atomic via `SECURITY DEFINER` RPCs (00061); send_back runs sequentially in TS and can leave invoices in `qa_approved` while `draws.status` is still `submitted` on partial failure.

### B.2 Recalculation-pattern observations

Per CLAUDE.md / R.2, derived totals must be recomputed from source rows. Audit findings:

- ✅ `previous_applications`, `total_to_date`, `current_payment_due` — recomputed at read time per canonical pattern
- ✅ `jobs.approved_cos_total` — trigger-maintained cache with rationale comment (canonical exception, migration 00042)
- ⚠ `vendor_balance` (if it exists) — TBD in audit, may be incrementally maintained
- ⚠ Several other cache columns flagged in B.1 #2 above

### B.3 Approval flow per entity (current state)

Today, every approval is hard-coded:

| Entity | Approval logic | Configurable? |
|---|---|---|
| Invoice | PM (own job) → QA (accounting) | No |
| CO | Owner/admin only | No |
| Draw | PM review → owner approve → submit | No |
| PO | Owner/admin only | No |
| Proposal | Owner/admin → accept | No |
| Lien release | Accounting receive | No |

`approval_chains` exists but is unused. Migration to chain-driven approval is forward work (likely TARGET.md phase F2).

---

## C. Platform primitives coverage

Per VISION.md §4 target — 13 primitives. Status:

| # | Primitive | Status | Evidence |
|---|---|---|---|
| 1 | Audit logging | **PARTIAL** | 31/119 routes write to `activity_log`. Many mutation routes skip it (e.g., the 9-route `cost-intelligence/extraction-lines/*` suite, `lien-releases/[id]/upload`). Some legitimately rely on status_history JSONB; others should write both. |
| 2 | Permission system | **PARTIAL** | `getCurrentMembership()` is canonical helper; `requireRole()` exists but used in only 1/119 routes. Other 92 routes hand-roll `getCurrentMembership()` + per-route role checks (boilerplate duplication). |
| 3 | RLS helpers | **PRESENT (ad-hoc)** | `getCurrentMembership()` + `.eq("org_id", membership.org_id)` repeated ~200+ times across routes. No `withOrg(supabase)` wrapper. RLS posture is solid by construction; refactor target only. |
| 4 | Error handling | **PARTIAL** | `withApiError` wrapper exists; not universally applied. Some routes catch errors locally and don't propagate to Sentry. |
| 5 | Observability (Sentry) | **PRESENT (gated)** | `@sentry/nextjs ^10.49.0` installed; 3 config files; tags `user_id`, `org_id`, `impersonation_active`, `platform_admin` set per request via middleware; `tracesSampleRate: 0.1`; `sendDefaultPii: false`. Init is gated on `SENTRY_DSN` — no startup assertion. Not hooked into `withApiError` catch path; relies on Next.js auto-capture. |
| 6 | Idempotency | **PARTIAL** | Stripe webhook does NOT dedupe by `event.id` (relies on UPSERT semantics). Imports re-running creates duplicates. No `Idempotency-Key` header support anywhere. |
| 7 | Rate limiting | **ABSENT** | Single occurrence (`feedback/route.ts:12`). Login, signup, AI parse, file upload — all unlimited. |
| 8 | Background jobs | **ABSENT** | No Inngest/Trigger.dev/BullMQ/pg-boss installed. Every AI parse, email, recalc, notification runs sync inside the request. |
| 9 | File storage | **PRESENT** | Supabase Storage; `invoice-files` bucket retains its name from Phase 1. Path convention `{org_id}/...` enforced. |
| 10 | Email/notification delivery | **PARTIAL** | Resend consumed via raw `fetch` to `https://api.resend.com/emails` in `src/lib/notifications.ts`. `RESEND_API_KEY=re_placeholder` in env. Failures logged and swallowed; no retry, no DLQ, no preference UI. |
| 11 | Search infrastructure | **ABSENT** | Search is `LIKE`/`ILIKE`. No tsvector/tsquery anywhere. |
| 12 | Caching | **PARTIAL** | Vercel Edge cache implicit; no application-level cache invalidation strategy; no `settings_version` field on `organizations` to bump. |
| 13 | Data import/export framework | **ABSENT (D-008 violation)** | Per-entity CSV importers exist for vendors / invoices / cost-codes / budget / PO, each with its own parser. **No common schema validator, no central audit log, no idempotent re-run guarantee, zero export endpoints.** |

### C.1 Top 5 platform-primitive gaps (most critical)

1. **No background job framework.** Every AI parse, email, recalc, notification runs sync inside the request. Will hit Vercel's 60s function limit and saturate Anthropic rate limits as tenant count grows. Wave 2 (daily logs, schedules, photo processing) and Wave 3 (weekly digests, email intake) are unbuildable as-is.

2. **No data import/export framework — D-008 violation.** Today: per-entity ad-hoc CSV importers, no exports. D-008 says "first-class"; reality is "last-class."

3. **Rate limiting effectively absent.** Single occurrence. Cannot admit Tenant 2 (or any non-trusted user) safely as-is.

4. **Idempotency partial.** Stripe webhook deduplication relies on UPSERT semantics (incidental, not designed). No `Idempotency-Key` support. Imports double-write on retry.

5. **No structured logging or full-text search.** 100+ `console.warn`/`console.error` calls (CONCERNS.md HIGH from 2026-04-24, unresolved). Search is `LIKE`/`ILIKE`.

---

## D. Code-level health

### D.1 Orphaned files / dead code

- `change_order_budget_lines` table — **0 rows, 0 `src/` consumers, live RLS** (verified). Superseded by `change_order_lines` (00028) but never dropped.
- Several MISSING-entity table scaffolds present (e.g., `email_inbox` with 0 rows, schema only).
- Specific orphan list documented in `.planning/audits/2026-04-29/current-state-C-D.md`.

### D.2 Duplicate logic

- **`.eq("org_id", …)` repeated ~200+ times across routes.** No `withOrg(supabase)` wrapper. Not a leak risk (RLS is the backstop) but a refactor target.
- 92/119 routes hand-roll `getCurrentMembership()` + role check, where `requireRole()` would suffice.
- `formatDate`, `formatCurrency` variations in multiple components.

### D.3 UI uniformity vs. invoice-review template

CLAUDE.md mandates "invoice review is the gold standard." Current state:

| Surface | Verdict |
|---|---|
| `src/app/invoices/[id]/page.tsx` | **TEMPLATE** (gold standard) |
| `src/app/proposals/review/[extraction_id]/page.tsx` | **EXTENDS** template (Phase 3.4) |
| `src/app/change-orders/[id]/page.tsx` | **ONE-OFF** (no file preview, text-only) |
| `src/app/draws/[id]/page.tsx` | **ONE-OFF** (tab-based, different paradigm) |

**Score: 2/4.** Direct violation of the CLAUDE.md "invoice review is the gold standard" rule.

### D.4 Multi-tenant RLS audit

- **119 API routes total.**
- **93 (78%) call `getCurrentMembership()` / `getMembershipFromRequest()` / `requireRole()` directly.**
- **26 are exempt by design**: `requirePlatformAdmin()` (8), `CRON_SECRET` (1), Stripe-signature (1), service-role + tested-flow `getCurrentOrg()` (16). **No unauthenticated mutation routes.**
- **1 hardcoded `org_id`** — `TEMPLATE_ORG_ID` in `cost-codes/template/route.ts:12` (CLAUDE.md exception).
- **3 routes accept user-controlled `org_id` in body** — all platform-admin-gated.
- **Verdict:** solid by construction.

### D.5 Spec drift across phases 1-8j

Phase artifacts in `.planning/phases/` largely match shipped code (per spot-check). The most recent phases (3.4, 3.5, 8.x) are actively executed and well-tracked. Older phases (1-3.3) are post-hoc reconstruction-friendly via migrations + canonical plan §5.

### D.6 Production readiness gaps

- **No CI test gate.** 40 tests exist with custom `tsx` runner; `npm test` is local-only. **No GitHub Actions, no Vercel pre-build hook.** Largest production-readiness gap after rate limiting.
- Open `console.log`/`console.warn`/`console.error` count: ~100+ (HIGH per CONCERNS.md 2026-04-24, unresolved).
- Several `vercel.json` headers improvements deferred per MASTER-PLAN §11 (X-Frame-Options DENY, Permissions-Policy completion, COOP, nonce-based CSP).

### D.7 Security gaps

- `/api/invoices/[id]/docx-html` lacks explicit `getCurrentMembership()`/role check (RLS-only) — canonical Q7, 5-min fix.
- Plan-limits gating inconsistent — several token-consuming routes skip the check (canonical Q6).
- Trial-expiry not enforced — two test orgs at/past `trial_ends_at` as of 2026-04-29 (canonical Q5).

### D.8 Enterprise readiness gaps

- Audit-log coverage 31/119 (per C.1 #1).
- Error handling for partial failures: `send_back` cascade documented as incomplete (B.1 #5).
- Graceful degradation: Resend down → notifications silently logged-and-swallowed; Anthropic rate-limited → user-facing error with no retry.

### D.9 Top 5 code-health issues

1. No CI test gate (D.6)
2. UI uniformity score 2/4 (D.3)
3. `requireRole()` underused (D.2)
4. `.eq("org_id", …)` repeated 200+ times (D.2)
5. Audit-log coverage 31/119 routes (C.1 #1)

---

## E. Specific known issues

### E.1 Dashboard 503 root cause

**Surprising finding.** Suspected: missing indexes on aggregations. Actual: **RLS policy-stack planning overhead**.

- The dashboard endpoint (`src/app/api/dashboard/route.ts`) issues **15 parallel queries** via `Promise.all`.
- Execution time on each query is sub-millisecond at current row counts (57 invoices, 88 COs, 288 budget_lines, etc.).
- The 503 root cause is **planner overhead from permissive RLS policy stacking**: every query's planner reads 200–540 catalog buffers (~5,000+ buffers per dashboard hit) inlining a stack of permissive policies.
- `invoices` has 7 permissive policies, `draws`/`purchase_orders` have 4 each, several with correlated `EXISTS` subqueries (`pm read draws on own jobs`).
- At concurrency this saturates the Supabase pooler and triggers timeouts → 503.

**Fixes (in priority order):**

1. **Collapse permissive RLS policies** on `invoices`/`draws`/`purchase_orders`/`budget_lines`/`jobs`/`activity_log` into one `org_isolation` permissive policy + restrictive write policies. Eliminates the 5,000-buffer planning tax. Risk: cross-cutting; needs `/nightwork-propagate`.

2. **Real index miss:** `idx_budget_lines_org_id` is plain `(org_id)` instead of partial `(org_id) WHERE deleted_at IS NULL` → planner picks Seq Scan today on the dashboard "over-budget" query. Fix: `CREATE INDEX idx_budget_lines_org_active ON budget_lines (org_id) WHERE deleted_at IS NULL;`

3. **Composite for recent-activity queries:** `CREATE INDEX idx_invoices_org_updated ON invoices (org_id, updated_at DESC) WHERE deleted_at IS NULL;` — supports `recent_for_activity` and `month_paid` queries that have no `org_id + updated_at` composite today.

Full EXPLAIN-ANALYZE traces and per-query cost breakdown in `.planning/audits/2026-04-29/current-state-E.md`.

### E.2 Data ingestion gap

**What's there:**
- Single-invoice parse (drag-drop → `/api/ingest`)
- PDF batch upload (`invoice_import_batches`)
- `document_extractions` pipeline (133 extractions / 391 lines / 285 cost components)
- Vendors CSV importer
- Cost-codes CSV importer
- Per-job budget XLSX importer
- Generic XLSX parser

**What's missing:**
- Jobs bulk import
- PO bulk import
- Historical invoices CSV import
- Email intake — `email_inbox` table exists (0 rows), no inbound webhook
- Vendor pricing bulk import
- Lien releases import
- QBO sync (correctly deferred per CLAUDE.md)

**Path forward** (to be elaborated in TARGET.md):

1. **Generalize `invoice_import_batches` into a generic `import_batches(entity_type)` framework** so jobs/POs/historical-invoices/lien-releases/vendor-pricing share the same idempotency + audit story.
2. **Add Resend inbound webhook for email intake.** Honors D-008 ("import is a triggering event") because email-attached invoices flow through the same classify-extract pipeline as drag-drop uploads.
3. **Reuse `document_extractions` for any PDF-shaped entity** — lien releases, COs, proposals already align; vendor onboarding docs and daily-log OCR are forward extensions.

---

## F. Drummond fixture inventory (3 sources)

The Drummond reference job (per D-005, MASTER-PLAN.md, canonical §10) is the single fixture truth across phases. Stage 1 directive nwrp7.txt instructs: pull from three sources, anonymize, document.

### F.1 Source 1 — P-drive scan

**Path:** `P:\Projects Info Folder\Drummond 501 74th St\` (mapped, fully accessible)

**Grand total:** 408 files / ~1.06 GB across 17 categories with files. 4 categories empty (Agenda, Correspondence Owners, Meeting Notes, Schedule).

**Top categories by size:**

| Category | Files | Size | Dominant types |
|---|---:|---:|---|
| Plans | 48 | 537.9 MB | 44 PDF, 4 DWG |
| Building Dept | 85 | 195.3 MB | 78 PDF, 3 XLSX, 2 MSG, 1 HTM, 1 MP4 |
| Proposals-subcontractors | 144 | 138.8 MB | 121 PDF, 9 JPG, 7 DOCX, 4 MSG, 3 misc |
| Selections | 38 | 72.5 MB | 18 JPG, 13 PDF, 3 PNG, 2 MSG, 2 PPT |
| Surveys and Elevations | 13 | 39.7 MB | 10 PDF, 2 DWG, 1 JPG |
| NOAs | 9 | 33.3 MB | 9 PDF |
| Engineering | 7 | 22.1 MB | 7 PDF |
| Energy Calcs | 4 | 18.7 MB | 4 PDF |
| Inspections | 16 | 7.8 MB | 12 PDF, 2 EML, 2 MSG |
| Budget | 25 | 7.4 MB | 10 PDF, 7 XLSX, 6 XLS, 2 DOCX |
| Contract | 4 | 3.4 MB | 3 PDF, 1 DOCX |
| Drainage | 3 | 2.0 MB | 3 PDF |
| Photos | 3 | 1.8 MB | 3 JPEG |
| Warranty | 2 | 0.8 MB | 2 PDF |
| Locates | 4 | 0.4 MB | 4 MSG |
| Purchase Orders | 2 | 0.2 MB | 1 PDF, 1 DOCX |
| Permits | 1 | 0.07 MB | 1 PDF |

**Key findings:**
- **No invoices in P-drive** — confirmed per Jake's brief.
- **Plans is half the bytes** (single 117 MB iPhone .mp4 in Building Dept is the only file >100 MB).
- **Proposals-subcontractors is the richest semantic dataset** — 43 trade sub-folders mirroring cost-code structure. Highest-value Phase 3.4 / proposal-extractor fixture target.
- **Empty Schedule / Meeting Notes / Correspondence folders** confirm those workflows live in Buildertrend / email / nowhere yet — relevant for Wave 2 scope.
- **Budget/Payapps and Contract subfolders** are highest-value Phase 1/3 fixture targets.
- **Drummond is a live job** — mtimes up to 2026-04-22.
- **14 `.msg` + 2 `.eml` saved-email artifacts** hint at Wave 3 email-intake parser requirements.

Inventory written to `.planning/fixtures/drummond/source1-pdrive/INVENTORY.md` (gitignored).

### F.2 Source 2 — Supabase invoice graph

**HEADLINE FINDING:** Drummond in Supabase today is **near-empty** — only 1 invoice (INV-108975, $22,620.90, status=`qa_review`, vendor=SmartShield Homes LLC, electrical progress invoice).

**The 57 invoices in the DB are mostly on other test jobs:**

| job | invoice count | total |
|---|---:|---:|
| Fish Residence | 45 | $177,571.34 |
| Dewberry Residence | 11 | $71,180.22 |
| **Drummond Residence** | **1** | **$22,620.90** |

**Drummond-scoped counts (actual):**

| Entity | Count | Notes |
|---|---:|---|
| invoices | 1 | INV-108975, $22,620.90 |
| invoice_line_items | 6 | |
| vendors used | 1 | SmartShield Homes, LLC |
| change_orders | 0 | |
| draws | 0 | |
| budget_lines | 0 | |
| cost_codes referenced | 2 | 13101 Electrical Labor, 13101C Electrical Labor CO |
| invoice_allocations | 3 | 2 active + 1 soft-deleted superseded |
| document_extractions | 1 | verification_status=pending |
| document_extraction_lines | 0 | (see anomaly F.2.A.1) |
| line_cost_components | 0 | |
| purchase_orders | 0 | |
| po_line_items | 0 | |
| lien_releases | 0 | |
| proposals | 0 | |
| activity_log | 6 | All on the one invoice |
| notifications | 13 | One upload event fanned out to 8 users |
| parser_corrections | 3 | All vendor_name_raw edits |

**Total dollar volume:** $22,620.90.
**Date range:** invoice_date 2026-04-20, received 2026-04-24, computed payment_date 2026-05-15.

#### F.2.A Anomalies and orphans

1. **`document_extractions.total_lines_count = 6` but 0 rows in `document_extraction_lines`.** All 6 lines were classified as `progress_payment` and stored as JSONB in `extractions.skipped_lines` instead of being persisted as table rows. Importers expecting 1:1 row alignment will be wrong.
2. **`invoice_allocations` has a soft-deleted superseded row** ($22,620.90 single allocation) replaced by a 2-row split. Honor `deleted_at` to avoid double-counting.
3. **`document_extractions.classification_confidence = "0.0000"` and `target_entity_type = null`** despite an extraction model being recorded — the classifier appears bypassed for this row.
4. **`invoices.cost_code_id` points to 13101C only**, but the actual money is split 13101 / 13101C in `invoice_allocations`. Header cost_code is misleading; allocations are source of truth.
5. **`org_cost_codes` for Ross Built is entirely synthetic test data** (R-DW-001, R-FAKE-001, R-T-001..007, R-TEST-FOO-001). Production Ross Built cost codes live only in the legacy `cost_codes` table (238 rows). This is direct evidence of the A.3.1 cost-code triple-table drift.
6. **No COs / budget / draws / POs / lien releases for Drummond** — Phase 1 invoice flow exercised, Phases 2–4 entities never seeded for this job.
7. **One invoice produces 13 notifications** (full org fan-out per status event). Signal/noise concern at production scale.

#### F.2.B PII fields encountered (for the future compliance pass)

- `jobs.client_name` (real homeowner names), `jobs.client_email`, `jobs.address`
- `vendors.name` and `invoices.ai_raw_response.vendor_address` (real vendor)
- `invoices.original_file_url` and `invoices.original_filename` (encode vendor + invoice number in path)
- `invoices.invoice_number`
- `notifications.title`/`body` (embed vendor name + dollar + job name)
- `notifications.user_id`
- `parser_corrections.original_value` / `corrected_value`

No EINs, SSNs, phone numbers, or check numbers in this pull. Vendor email/phone/address columns are NULL.

#### F.2.C Files

25 JSON files at `.planning/fixtures/drummond/source2-supabase/` (one per table queried). Populated tables: `jobs.json`, `invoices.json`, `invoice_line_items.json`, `vendors.json`, `cost_codes.json`, `invoice_allocations.json`, `document_extractions.json`, `activity_log.json`, `notifications.json`, `parser_corrections.json`, `org_workflow_settings.json`, `approval_chains.json`, `org_cost_codes.json`, `pending_cost_code_suggestions.json`. Empty tables documented as `[]` files for completeness.

### F.3 Source 3 — Downloads filename hunt

**Path:** `C:\Users\Jake\Downloads\` (unorganized)

**Tier counts:**
- **Tier 1 (definitely Drummond):** 94 files, ~93.2 MB. Filename hits on `*drummond*` (84) + `*501*74*` (10).
- **Tier 2 (probably Drummond, review needed):** 69 files, ~67.6 MB. Three sub-buckets:
  - `split-invoices/` subdir — 19 files, ~1.7 MB (vendor-amount-tagged, almost certainly the curated Drummond Pay App invoice batch)
  - `Test Invoices/` subdir — 23 files, ~5.8 MB (mixed jobs; 3 explicitly Drummond/501-74)
  - top-level invoice/draw/lien/PO/payapp files — 27 files, ~60.1 MB (most are NOT Drummond, but the SmartShield INV-105324/105472/106004 files almost certainly are)
- **Tier 3 (excluded):** ~1024 files (24 installers, 38 archives, 7 nwrp directives, 4 Claude state, 6 code files, ~945 other off-topic).
- **Tier 1+2 total:** ~160.8 MB / 163 files (includes some duplicates between top-level and `Test Invoices/`).

**HIGH-VALUE FIXTURE CONTENT FOUND (formats matching CLAUDE.md "Known Invoice Formats at Ross Built"):**

| File pattern | Type | Significance |
|---|---|---|
| `Drummond November 2025 Corresponding Invoices.pdf` (2.2 MB) | Combined invoice PDF | Real historical batch |
| `Drummond-Nov 2025 Lien Releases.pdf` | Lien release set | Companion to above; first real lien release fixture |
| `Drummond_Budget_2026-04-15.xlsx` | Budget XLSX | Most recent budget — Phase 3.9 budget-extractor target |
| `Drummond_Pay_App_2_20260415.xlsx`, `Drummond - Pay App 1/2/3/4` (.xls/.xlsx) | Historical draws | AIA pay-app reference data, Phase 3.9 historical-draw extractor target |
| `Pay Application #5 - Drummond-501 74th St.pdf` + `Draw_5_Drummond-501_74th_St_G702_G703.pdf` | G702/G703 PDFs | Real AIA pay-app output reference |
| `Draw_1_Drummond-501_74th_St_G702_G703.pdf` | First-draw G702/G703 PDF | Earliest reference draw |
| `1767726755355_INV_Drummond_FloridaSunshineCarpentry_2026-01-06_stamped.pdf` | T&M invoice (stamped) | CLAUDE.md "T&M format" reference fixture |
| `Drummond_Doug-Naeher-Drywall_none_2025-12-15-8d0ba2.docx` | Lump-sum invoice | CLAUDE.md "lump-sum Word doc" reference fixture |
| `split-invoices/SmartShield-105472-2845.84.pdf` etc. | Invoice batch (pre-split) | Curated Pay App input set |

**Vendor cross-check vs Source 2:** Source 2 yielded 1 vendor (SmartShield Homes LLC). Source 3 surfaces filename patterns for ~17 distinct Drummond vendors:

✅ **SmartShield** — matches Source 2.

**Additional Drummond vendors observed in filenames (NOT in Source 2):** Florida Sunshine Carpentry, Doug Naeher Drywall, Paradise Foam, Banko, WG Drywall, Loftin (Clark/Loftin) Plumbing, Island Lumber, Ferguson, CoatRite, Ecosouth, MJ Florida, Rangel Tile, TNT Painting, FPL, Home Depot, Avery Roofing, ML Concrete LLC.

**Likely-NOT-Drummond vendors observed (other jobs in same Downloads folder):** Sticks & Stones Flooring, INTEGRITY FLOORS, Sarasota Cabinetry, Tom Sanger Pool, Gilkey, Tile Solutions, All Points Concrete (Duncan), Breath of Life, Krauss, Crews.

**Address pattern:** Filename patterns matching the homeowner residence address had **ZERO matches** in Downloads. Either Jake doesn't include the residence address in filenames or the construction-vs-residence address split is the convention. F.4 records the pending Strategic Checkpoint #1 question.

Inventory written to `.planning/fixtures/drummond/source3-downloads/INVENTORY.md` (gitignored).

### F.4 Cross-source coherence

| Fact | Source(s) | Coherence |
|---|---|---|
| Drummond construction site address | P-drive folder "501 74th St" + Downloads filenames `*501*74*` (10 hits) | Construction address is **501 74th St** — corroborated by both P-drive and Downloads |
| Drummond residence/owner address | Supabase `jobs.address` (the homeowner residence address, Anna Maria, FL) | Downloads filenames have **ZERO** hits on the homeowner-residence-address patterns — corroborates that the residence address in Supabase is the homeowner residence, not the construction site |
| Vendors invoiced on Drummond | Supabase: 1 vendor (SmartShield) / Downloads: 17+ vendors observed in filenames | ⚠ **DIVERGES** by 16+ vendors — Supabase has 1, Downloads files reference SmartShield + ~16 others (Florida Sunshine Carpentry, Doug Naeher Drywall, FPL, Home Depot, Avery Roofing, ML Concrete, Loftin Plumbing, Island Lumber, Ferguson, CoatRite, Ecosouth, MJ Florida, Rangel Tile, TNT Painting, Paradise Foam, Banko, WG Drywall) |
| Total dollar volume on Drummond | Supabase: $22,620.90 (1 invoice) / Downloads: ~93 MB Tier-1 inv/draw/lien files | ⚠ **MASSIVELY DIVERGES** — Supabase has 1 invoice; Downloads has 5+ pay apps, 1 lien-release set, recent budget XLSX, plus the Nov 2025 invoice batch (2.2 MB combined PDF). The real invoice history exists, just not ingested yet. |
| Pay app count | Supabase: 0 draws / Downloads: 5 pay-app G702/G703 references (Pay App 1, 2, 3, 4, 5) | Drummond has shipped at least 5 historical draws — none of which are in Supabase |
| Budget data | Supabase: 0 budget_lines / Downloads: `Drummond_Budget_2026-04-15.xlsx` (most recent) + earlier budget files | Drummond has a real budget; not ingested yet |
| Lien release data | Supabase: 0 lien_releases / Downloads: `Drummond-Nov 2025 Lien Releases.pdf` | Real lien release set exists; not ingested yet |

**Address resolution:** The 501 74th St (construction site) vs [homeowner residence address] (homeowner residence) split is consistent with Ross Built's pattern — the construction folder is named for the lot/build address, the Supabase `jobs.address` is the owner's residence/billing address. Strategic Checkpoint #1 should confirm whether `jobs.address` should be the construction site or the homeowner residence going forward.

**The Drummond ingestion gap is the real finding.** The fixture-pull surfaces a concrete instance of canonical §12 ("data ingestion gap"): Drummond has ~5 pay apps, 1 lien-release batch, ~17 vendors of historical invoices, and a current budget — all of which exist as files in Downloads but none of which exist in Supabase. **This is a Wave 1 backfill opportunity.** GAP.md treats this as a foundation-phase prerequisite (likely F4 or its own pre-foundation phase).

### F.5 Drummond fixture summary status

A sanitized count-only summary will be committed at `.planning/architecture/DRUMMOND-FIXTURE-SUMMARY.md` (counts only, no specific names — this current document already names some real entities, but fixtures themselves stay gitignored).

---

## Headline findings (for Strategic Checkpoint #1)

1. **Drummond's Supabase fixture is thin.** 1 invoice, no COs, no draws, no budget. The 57 invoices in the DB are mostly synthetic Fish/Dewberry test data. Wave 1 testing needs more Drummond data — either expand fixtures via Source 3 hunt or seed synthetic Drummond data per R.21.

2. **Cost-code triple-table drift is the highest-priority entity coherence issue.** Three live tables; Ross Built's real codes only in legacy `cost_codes`. Cost intelligence, proposal commit, and every cost-code lookup must branch. Resolution timing TBD per canonical Q4 — VISION proposes F1 absorbs this.

3. **Dashboard 503 root cause is RLS policy-stack planning overhead, not missing indexes.** 7 permissive policies on `invoices`, 4 on `draws`/`POs`, several with correlated EXISTS subqueries. Collapse to one `org_isolation` permissive + restrictive write policies. Cross-cutting change; route through `/nightwork-propagate`.

4. **Three platform primitives are absent**, two more are partial: background jobs (absent), data import/export framework (absent — D-008 violation), rate limiting (effectively absent), idempotency (partial), structured logging (absent). All gate Wave 2+.

5. **`approval_chains` is dead config.** Full architecture shipped (00070), zero `src/` consumers. Customer-customizable chains have no runtime effect today.

6. **`requireRole()` underused (1/119), audit-log coverage 31/119, UI uniformity score 2/4.** Three pattern-adoption gaps that compound across the codebase.

7. **No CI test gate.** 40 tests exist; `npm test` is local-only. Largest production-readiness gap after rate limiting.

8. **`lien_releases` violates R.7.** Status enum present, status_history JSONB column missing. Direct rule violation; 1-migration fix.

---

**End of CURRENT-STATE.md.**

Cross-references:
- Vision: `.planning/architecture/VISION.md`
- Target architecture: `.planning/architecture/TARGET.md` (Stage 1)
- Foundation phase plan: `.planning/architecture/GAP.md` (Stage 1)
- Drummond fixture summary: `.planning/architecture/DRUMMOND-FIXTURE-SUMMARY.md` (Stage 1)
- Detailed audit reports: `.planning/audits/2026-04-29/*.md` (gitignored)
