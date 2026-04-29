# Nightwork — Repo Audit & Plan Consolidation Pre-Brief

**Date:** 2026-04-29
**Branch:** `audit/2026-04-29` (analysis only; no code changes)
**Scope:** Comprehensive audit of the Nightwork codebase (commit `86c2c42`, post-Phase-3.4 merge) ahead of consolidating all planning documents into one canonical plan.
**Audience:** Jake — and a future engineer who needs to come up to speed in one read.

This report is an inventory + a deep read. The system has been built for weeks, has personality and decisions baked into the code, and the audit reflects that. Where the agent reading the code disagrees with what a doc says, I cite both and call out the conflict.

---

## Table of Contents

0. [Audit methodology and snapshot](#0-audit-methodology-and-snapshot)
1. [Deliverable 1 — Plan inventory](#deliverable-1--plan-inventory)
2. [Deliverable 2 — Deep system understanding (9 flows)](#deliverable-2--deep-system-understanding)
3. [Deliverable 3 — Patterns and conventions](#deliverable-3--patterns-and-conventions)
4. [Deliverable 4 — Schema with usage](#deliverable-4--schema-with-usage)
5. [Deliverable 5 — API surface with behavior](#deliverable-5--api-surface-with-behavior)
6. [Deliverable 6 — UI surfaces with patterns](#deliverable-6--ui-surfaces-with-patterns)
7. [Deliverable 7 — Architectural decisions baked into code](#deliverable-7--architectural-decisions-baked-into-code)
8. [Deliverable 8 — Gaps between vision and reality](#deliverable-8--gaps-between-vision-and-reality)
9. [Deliverable 9 — Honest assessment](#deliverable-9--honest-assessment)
10. [Deliverable 10 — Proposed consolidated plan structure](#deliverable-10--proposed-consolidated-plan-structure)

---

## 0. Audit methodology and snapshot

### Methodology

- **Code reading:** I walked every API route directory under `src/app/api/`, every page under `src/app/`, every helper under `src/lib/`, and every numbered migration under `supabase/migrations/`. Where I cite `path:line`, I read the file at that line.
- **Live database:** I ran read-only queries against the dev Supabase project to capture row counts, status distributions, and `api_usage` totals so the schema picture is current state, not migration-time fiction.
- **Plan documents:** I read every `.md` in `docs/`, every top-level audit doc (`REVIEW_FINDINGS.md`, `DEFERRED_FINDINGS.md`, the diagnostics), and every QA report. Quotes and dates are from the actual files.
- **Git history:** Commit hashes and dates come from `git log`, not from doc claims about commits.

### Repo snapshot at `86c2c42` (head of main, 2026-04-28)

- **Files tracked:** 778 (`git ls-files | wc -l`)
- **TypeScript / TSX:** 457 files
- **SQL migrations:** 91 numbered migrations (00001–00091) + paired `.down.sql` for migrations from 00060 onward
- **Markdown docs:** 69 files
- **API routes:** 119 `route.ts` files
- **Page routes:** 62 navigable URLs (page.tsx) + layouts
- **Tests:** 39 test files in `__tests__/`, all run via the custom `__tests__/_runner.ts`

### Live dev database snapshot (queried 2026-04-28)

| Surface | Row count | Notes |
|---|---|---|
| organizations | 3 | Ross Built (enterprise/trialing), QA Test Company, 8j Test Company |
| org_members | 11 | Across all 3 orgs |
| jobs | 16 | Ross Built has the bulk |
| vendors | 24 | |
| cost_codes (legacy) | 238 | Phase-1 codes still present alongside org_cost_codes |
| canonical_cost_codes (NAHB) | 354 | 5 level-1, 62 level-2, 287 level-3 |
| org_cost_codes | 12 | Per-org Layer 2 mappings — sparsely populated |
| pending_cost_code_suggestions | 1 | One PM suggestion outstanding |
| budget_lines | 288 | |
| invoices | 57 | 55 `qa_approved`, 2 `qa_review` |
| invoice_line_items | 119 | |
| invoice_allocations | 51 | |
| document_extractions | 133 | 56 invoice, 2 proposal, 1 unclassified (active rows: ~75 after soft-delete) |
| document_extraction_lines | 391 | |
| line_cost_components | 285 | Hybrid component breakdown |
| draws | 3 (2 active + 1 soft-deleted) | Both active are `draft` status |
| draw_line_items | 16 | |
| change_orders | 88 | Mostly Ross Built historicals |
| proposals | 1 | One real `accepted` proposal (Phase 3.4 cutover) |
| proposal_line_items | 7 | |
| items (cost intel) | 61 | |
| item_aliases | 6 | |
| vendor_item_pricing | 7 | |
| pricing_history | 126 | Trigger-driven append-only |
| api_usage | 1,928 | See cost rollup below |
| platform_admins | 2 | Jake + Andrew |
| platform_admin_audit | 8 | |
| feedback_notes | 1 | |
| support_conversations | 3 | |
| support_messages | 14 | |
| approval_chains | 18 | 3 orgs × 6 workflow types |
| job_milestones | 0 | Schema only — no production use |
| draw_adjustments / draw_adjustment_line_items | 0 / 0 | Schema only |
| client_portal_access / client_portal_messages | 0 / 0 | Schema only |
| purchase_orders / po_line_items | 0 / 0 | **Tables exist; no rows. POs deferred per amendment-1.** |

### Live AI cost spend (api_usage rollup)

| function_type | calls | total_tokens | total_cost_usd |
|---|---:|---:|---:|
| document_classify | 1,298 | 6,151,127 | $25.71 |
| item_match | 381 | 601,627 | $5.45 |
| invoice_parse | 72 | 580,767 | $2.78 |
| proposal_extract | 50 | 304,979 | $2.57 |
| line_nature_classify | 83 | 137,136 | $0.92 |
| embedding | 30 | 5,227 | $0.30 |
| support_chat | 10 | 24,680 | $0.11 |
| unit_conversion_suggest | 4 | 1,676 | $0.04 |
| **Total to date** | **1,928** | **~7.8M tokens** | **~$37.88** |

Two interesting takeaways from this rollup:
1. `document_classify` dominates by call volume (1,298) — every upload AND every retry/dogfood run hits it. Cache discipline matters at scale.
2. Total spend on AI to date is under $40. Cost is not a near-term constraint; quality is.

### What I did *not* do

- I did not change code. The branch contains only this report.
- I did not run `npm run build` or `npm test` (the test runner needs API keys for the live evals; running it would skew api_usage).
- I did not validate every RLS policy by attempting cross-tenant queries — that's a separate pass.
- I did not fix anything I found. Findings are flagged for Jake to triage.

---

## Deliverable 1 — Plan inventory

The repo has accumulated three layers of planning material: the canonical rebuild plan (still authoritative), audit/review docs (one-shot snapshots from a specific date), and ad-hoc diagnostic notes (single-issue investigations). Below is everything I found, with my read after going through the actual content.

### Inventory table

| Path | Last edit | LOC | Domain | Summary | Status | Accuracy | Fate |
|---|---|---:|---|---|---|---|---|
| `CLAUDE.md` | 2026-04-22 | 492 | architecture / general | Project identity guard + dev rules + data model + invoice workflow + payment schedule + phase roadmap + non-negotiable architectural rules + testing mandate + platform-admin section. The operational constitution. Every session reads this. | shipped | still-accurate | canonical-merge (already canonical) |
| `SETUP.md` | 2026-04-22 | 95 | general | Quickstart for a new dev environment. Node/git, env vars, Supabase MCP, agent skills, dev server. Notes what's already set up. | shipped | still-accurate | canonical-merge |
| `docs/nightwork-rebuild-plan.md` | 2026-04-23 | ~1800 | architecture / general | Source-of-truth rebuild plan v3, 7 parts: R (23 standing rules), G (exit gates / QA loop), 0 (philosophy), 1 (target architecture), 2 (data model naming), 3 (data flow), 4 (codebase audit), 5 (9-branch execution), 6 (appendix). Part R and Part G are non-negotiable discipline. | shipped | still-accurate (parts) | canonical-merge — Part R, G, sections 1-3 |
| `docs/nightwork-rebuild-plan-amendment-1.md` | 2026-04-27 | 852 | architecture / cost intel | Re-scopes Phases 3.3–3.10 around the cost-intelligence-as-moat thesis. Three corrections: cost intel is the moat (not extraction); POs are outputs not inputs; retroactive COs are normal. New phase order: 3.3 foundation → 3.4 proposal → 3.5 PO-from-proposal → 3.6 invoice↔PO matching → 3.7 CO workflow → 3.8 vendor → 3.9 budget+draw → 3.10 review queue UI. | partial-shipped (3.3, 3.4 done) | still-accurate | canonical-merge |
| `docs/nightwork-rebuild-plan-amendment-1-addendum-a.md` | 2026-04-27 | 132 | cost intel | NAHB substituted for CSI MasterFormat as the canonical spine for v1. Rename `csi_canonical_codes` → `canonical_cost_codes` with `spine` column. Schema designed so CSI can be added later as additive migration. | shipped (NAHB seeded, 354 rows) | still-accurate | canonical-merge |
| `docs/nightwork-rebuild-plan-amendment-1-addendum-b.md` | 2026-04-27 | 109 | cost intel / architecture | **Critical addendum.** Supersedes the planned `canonical_items` table with embedding-on-existing-`items`. Defines the **hot-path matcher boundary**: 4 files (`match-item.ts`, `commit-line-to-spine.ts`, `extract-invoice.ts`, `correct-line.ts`) are byte-identical and embedding-on-create wiring is deferred. | shipped (foundation only) | still-accurate | canonical-merge |
| `docs/BRAND.md` | 2026-04-18 | 65 | marketing | Brand identity: "Nightwork makes building lightwork." Positioning, voice, pricing tiers ($249/$499/$799). Adaptive named as primary competitor. | shipped | still-accurate | canonical-merge |
| `docs/NAV_INVENTORY.md` | 2026-04-17 | ~250 | UX | As-built nav state post-smoke-test. 5 top-level entries. Catalogs every route + visibility per role. | shipped | partially-accurate (NAV_REORG not executed) | history-only |
| `docs/NAV_REORG_PLAN.md` | 2026-04-18 | ~180 | UX | Future nav reorg: domain-level top nav (Dashboard, Jobs, Financial, Operations, Admin) + job-scoped sidebar. Settings consolidated. **Approved but never executed.** | not-started | unknown (plan, not state) | canonical-merge or deprecate |
| `docs/QA-RESULTS.md` | 2026-04-15 | ~150 | QA | Early-phase smoke test rollup. Largely superseded by `qa-reports/qa-branch*-phase*.md`. | historical | unknown | history-only |
| `docs/platform-admin-runbook.md` | 2026-04-22 | ~150 | architecture / ops | Operational runbook for cross-org staff support: granting platform_admin, impersonation, audit log queries. Acknowledges service-role write shim is deferred. | partial | still-accurate | canonical-merge |
| `docs/preflight-branch3-phase3.2.md` | 2026-04-23 | ~150 | QA | Pre-flight checklist for Phase 3.2 classifier work. Done. | shipped | historical | history-only |
| `docs/product-surface-audit.md` | 2026-04-21 | ~150 | UX | Walkthrough of every product surface. Useful but partially outdated (NAV_REORG didn't ship, proposals review was added later). | partial | partially-accurate | history-only |
| `docs/workflow-audit.md` | 2026-04-22 | ~150 | workflow | Walkthrough of invoice/draw/CO state machines. Mostly accurate, missing proposals state machine (added later). | partial | partially-accurate | canonical-merge with refresh |
| `docs/canonical-codes/nahb-2024.csv` | 2026-04-26 | 354 rows | cost intel | NAHB Standard Homebuilder Cost Codes seed CSV. Public-domain reference data. | shipped | still-accurate | keep as-is (data file) |
| `docs/canonical-codes/nahb-2024-source.txt` | 2026-04-26 | — | cost intel | Source notes for the NAHB seed | shipped | still-accurate | keep as-is |
| `REVIEW_FINDINGS.md` | 2026-04-20 | 571 | architecture / security / UX | Multi-agent comprehensive review across 8 dimensions. ~85 findings categorized Critical/High/Medium/Low. Resolution grid at top: Phases A-E, G, H, I shipped; F (file splits) and J (visual regression) deferred. | partial | mostly-accurate (some staleness) | history-only — superseded by code state |
| `DEFERRED_FINDINGS.md` | 2026-04-20 | 467 | architecture | Tracking log of non-blocking findings F-001 through F-024+. Per-item status, fix approach, phase. | partial | partially-accurate | history-only |
| `critical-gaps.md` | 2026-04-16 | 109 | UX | Pre-dogfood blockers (job detail perf, lien upload UX, no seed POs/COs). Most fixed. | partial | partially-accurate | history-only |
| `e2e-findings.md` | 2026-04-16 | 66 | data / UX | Dewberry Draw #9 dogfood: 28+ blockers + gaps. Cost code 06108 missing, ROSS BUILT auto-vendor-creation, RLS embed null cost_codes. | partial | partially-accurate (some fixed) | history-only |
| `route-sweep.md` | 2026-04-16 | 145 | architecture | Audit of fetch-cache annotations on all routes. 28 routes hardened with `fetchCache = "force-no-store"`. Service-role fallback documented on 6 routes. | shipped | still-accurate | history-only |
| `migration-preview.md` | 2026-04-16 | 69 | architecture | Pre-dogfood fixes (no schema changes; data + code only). | shipped | still-accurate | history-only |
| `smoke-test-results.md` | 2026-04-16 | 119 | QA | Smoke test rollup: 52 PASS / 8 PARTIAL / 0 FAIL across 60 items. Captures 15 non-fatal console errors. | historical | unknown current | history-only |
| `diagnostic-naming.md` | 2026-04-21 | 100 | cost intel | 82 pending extraction lines have un-normalized AI names. Backfill SQL recommended. | partial | unknown | history-only |
| `diagnostic-pdf-preview.md` | 2026-04-21 | 96 | UX | Invoice PDF doesn't render in cost-intel verification page (storage path passed verbatim to iframe; needs createSignedUrl). | not-fixed | still-accurate | canonical-merge as fix backlog |
| `diagnostic-report-cost-intel.md` | 2026-04-21 | 100 | cost intel | Ross Built has 1 item, 109 pending lines all 0% confidence. Cold-start state. Taxonomy doesn't accommodate billing-event lines. | partial (improved since) | partially-accurate | history-only |
| `diagnostic-source-highlighting.md` | 2026-04-21 | 100 | UX | Source-line highlighting feasibility on invoice PDFs. 4 approaches ranked, recommends C (page-level + react-pdf). | proposal | still-accurate | canonical-merge as feature spec |
| `qa-reports/qa-branch1-final.md` ... `qa-branch3-phase3.4.md` | 2026-04-15→04-28 | ~40K LOC aggregate (42 files) | QA | Phase-by-phase QA reports (G.3 format). Each follows: §1 Summary, §2 Exit Gate, §3 Schema, §4 Routes, §5 Code, §6 UI, §7+ findings. Most recent `qa-branch3-phase3.4.md` (2026-04-28) marks Phase 3.4 complete. | shipped | still-accurate | history-only (audit trail) |
| `qa-reports/qa-phase-a-lockdown.md` | 2026-04-20 | — | QA | Lockdown audit of Phase A (security-critical fixes). | shipped | still-accurate | history-only |
| `qa-reports/audit-{backend,data,frontend,recent,roundup,ux}.md` | 2026-04-20 | — | QA | Source dimensions feeding `REVIEW_FINDINGS.md`. | historical | partially-accurate | history-only |
| `qa-reports/preflight-branch{2,3}-*.md` | 2026-04-15→04-23 | — | QA | Pre-flight checklists per phase. | historical | historical | history-only |
| `qa-reports/gh-issue-body-phase1.3.md` | early | — | misc | Body for a GH issue. | historical | unknown | history-only |
| `__tests__/*.test.ts` (39 files) | various | — | tests | Each test file represents a phase exit-gate fence. Several read source code as a string to assert structural invariants (e.g., `api-proposals-commit.test.ts` greps the route file for the auth gate). | shipped | still-accurate | keep |

### Synthesis: who wins, who's stale, who's at war

**Most authoritative documents (right now):**
1. **`CLAUDE.md`** — the operational constitution. Architecture rules in this file are non-negotiable and cited in migration headers and test fences.
2. **`docs/nightwork-rebuild-plan.md` (Part R standing rules + Part G exit gates)** — the meta-process. Standing Rules R.1–R.23 define discipline; exit gates define done.
3. **`docs/nightwork-rebuild-plan-amendment-1.md` + addenda A and B** — the latest authoritative plan for Phases 3.3–3.10. Together they redefine the phase order, the cost code spine (NAHB), and the hot-path matcher boundary. Anything in the original `nightwork-rebuild-plan.md` Part 5 that contradicts the amendment is obsolete.

**Most outdated documents:**
1. **`DEFERRED_FINDINGS.md`** — the resolution grid is dated 2026-04-20 and several items marked "RESOLVED" were re-found in `REVIEW_FINDINGS.md` from the same day. Stale because the doc was written before its peer review surfaced the regressions.
2. **`docs/NAV_REORG_PLAN.md`** — approved 2026-04-18 but never executed. Current state (per `NAV_INVENTORY.md`) is materially different from the plan. The plan is a future state; the inventory is current.
3. **`smoke-test-results.md`** (2026-04-16) — predates the route-sweep + service-role fixes. Useful baseline, not current state.
4. **`docs/product-surface-audit.md`** — predates Phase 3.4 proposals review surface and the cost-intelligence verification queue.

**Documents at war:**
- **`REVIEW_FINDINGS.md` vs `DEFERRED_FINDINGS.md`** (both 2026-04-20). DEFERRED's resolution grid claims F-001 (hardcoded ORG_ID) RESOLVED, but REVIEW lists 8 routes still carrying the fallback constant. The fix shipped in Phase A (per the resolution grid in REVIEW); the DEFERRED grid pre-dates the fix. Net: trust REVIEW's grid.
- **`e2e-findings.md` vs `route-sweep.md` + `migration-preview.md`** (all 2026-04-16). e2e reports `/api/draws/[id]` returning null cost_codes due to RLS embed; route-sweep claims service-role fallback was added on that route. Either e2e ran before the fix landed, or the fix was incomplete. Looking at the current code, the service-role fallback IS in place — likely the e2e ran first.
- **`docs/nightwork-rebuild-plan.md` Part 5 (original phase 3.3-3.8) vs `amendment-1`**. The amendment is intentional supersession, not a contradiction; the original Part 5 should be marked superseded when the canonical plan is produced.

**Genuinely surprising findings from the inventory:**
1. The amount of one-off diagnostic markdown at the repo root (8 `.md` files in the top directory). These were one-shot investigations, never folded back into a structured doc. Some still describe live issues (e.g., `diagnostic-pdf-preview.md` — the iframe + createSignedUrl gap). These should either be folded into the canonical plan as outstanding work or moved to `docs/diagnostics/` and dated.
2. The QA report format is *exceptionally* disciplined (`qa-reports/qa-branch{N}-phase{M}.md`, 42 files, all using the same G.3 template). This is the rebuild's permanent audit trail and is more authoritative than the high-level review docs.
3. There's no document in the repo describing the production state of *the running database* — the live `api_usage` totals, row counts, and what's actually in dev. That gap is what this audit is filling.

---

## Deliverable 2 — Deep system understanding

Nine flows traced end-to-end. Code references use `path:line` so you can grep them.

### Flow A — Document ingestion → classification

> A PM uploads a PDF in Chrome. What happens, in order, until a classified `document_extractions` row exists?

**Step 1 — UI handler.** The drop-zone lives in `src/components/invoice-upload-content.tsx:642-643` (and a sibling `proposal-upload-content.tsx` mirrors it). The hidden file input fires `processFiles()` on `onChange`, which loops files, sets each to `status: "uploading"`, and POSTs to `/api/ingest`.

**Step 2 — Storage upload.** `src/app/api/ingest/route.ts:30-44` builds the path:

```ts
const timestamp = Date.now();
const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
const storagePath = `${membership.org_id}/ingest/${timestamp}_${safeName}`;
const { error: uploadError } = await supabase.storage
  .from("invoice-files")
  .upload(storagePath, buffer, { contentType: file.type, upsert: false });
```

The bucket is **`invoice-files`** (not bucket-per-document-type — the bucket name is from Phase 1, retained even after extension to proposals/etc.). Path pattern `{org_id}/ingest/{timestamp}_{filename}` enforces tenant scoping on the path itself, not just RLS. There is also a separate `logos` bucket used by branding.

**Step 3 — `document_extractions` row created.** Same route, lines 46-57:

```ts
const { data: inserted } = await supabase
  .from("document_extractions")
  .insert({
    org_id: membership.org_id,
    invoice_id: null,
    raw_pdf_url: storagePath,
    verification_status: "pending",
    extraction_model: "classifier-only",
    extraction_prompt_version: "phase-3.2-v2",
  })
  .select("id").single();
```

`invoice_id` was made nullable in migration 00081 specifically so proposals (which don't have invoice_id) can share this row.

**Step 4 — Classifier call.** `src/lib/ingestion/classify.ts` (~170 lines). Calls Claude Sonnet 4 (`claude-sonnet-4-20250514`) with prompt version `phase-3.2-v2`, system prompt instructing 10-way classification (invoice, purchase_order, change_order, proposal, vendor, budget, historical_draw, plan, contract, other). Cache_control ephemeral on the system prompt, so back-to-back classifications hit cache. Returns `{ classified_type, confidence }`, confidence clamped to [0, 1].

**Step 5 — Update + audit log.** Route updates the row with `classified_type` + `classification_confidence` (lines 79-86). The `callClaude()` wrapper writes an `api_usage` row with `function_type='document_classify'`, model, tokens, cost cents, status, metadata.

**Step 6 — Error path.** If the classifier throws, the route soft-deletes the row (sets `deleted_at = now()`) — this is intentional so failed ingests don't pollute the queue. If a `PlanLimitError` fires, it returns 429 with plan details so the UI can show an upgrade prompt.

**Step 7 — Eval baseline.** `__tests__/document-classifier.test.ts` is the regression fence. Fixtures live under `__tests__/fixtures/classifier/.local/{category}/*.pdf`. Gates: overall ≥90%, FAT categories (≥3 fixtures) ≥80%. Two known-flake fixtures are explicitly allowlisted in lines 77-95:

```ts
{ fixture: "10_Home_Depot_Receipts.pdf", expected: "invoice", observed_misclassification: "other", github_issue: 28 },
{ fixture: "Dewberry - Gilkey Landscaping 6-5-25 Q.pdf", expected: "proposal", observed_misclassification: "contract", github_issue: 30 },
```

35/36 with these fixtures failing = pass with note. 35/36 with a *different* fixture failing = fail. 34/36 (both flakes hit) = fail. The test verifies cache reads via api_usage `cache_read_input_tokens > 0` checks (lines 506-526).

**Live state right now (queried 2026-04-28):**
- 133 `document_extractions` rows total, ~75 active.
- 56 classified as `invoice`, 2 as `proposal`, 1 unclassified.
- Most invoice extractions show `classification_confidence = 0.0000` because they're early phase pre-3.2 imports and never got a proper classifier pass; the *active* phase-3.2 classifications all have confidence ≥ 0.95.

**Fragility / hidden complexity:**
1. The classifier soft-deletes on failure but the storage object stays — `cleanup_stale_import_errors()` (migration 00047) can sweep these but isn't on a cron. Orphan storage objects accumulate.
2. `extraction_prompt_version` carries TWO versioning concerns simultaneously: the classifier prompt version (`phase-3.2-v2`) AND, post-3.4, the proposal extraction prompt version (`phase-3.4-step2`). Same column. A row in `document_extractions` therefore has different semantics for the column depending on which stage wrote last. This works today because no migration ever rewinds a row, but it's a subtle dual-purpose field.
3. The classifier eval is gated by `RUN_CLASSIFIER_EVAL=1` and uses the live Anthropic API. Each full run costs ~$0.50 and takes 4-5 minutes. CI can't run it. Regression catching depends on the operator (Jake) remembering to run it locally before merging cost-intelligence changes. **This is load-bearing and should be moved to a scheduled cron when affordable.** 🚨

### Flow B — Proposal extraction → commit (Phase 3.4)

> A PM opens an extracted proposal at `/proposals/review/{extraction_id}` and clicks Save until a `proposals` row exists.

**Step 1 — Load page (server-side).** `src/app/proposals/review/[extraction_id]/page.tsx` is a server component that fetches the extraction row, the org's jobs, vendors, org_cost_codes, pending_cost_code_suggestions, and a signed PDF URL (so the PDF can render in the iframe). It then mounts `ReviewManager` (client component) with all of that data as props.

**Step 2 — Cache hit/miss.** `src/app/api/proposals/extract/route.ts:63-64` defines two constants:

```ts
const EXTRACTION_PROMPT_VERSION = "phase-3.4-step2";
const EXTRACTION_MODEL_TAG = "claude-sonnet-4-20250514";
```

The handler reads `extraction.extracted_data` and compares `extraction.extraction_prompt_version === EXTRACTION_PROMPT_VERSION`. Match → return cached envelope (no Claude call, no api_usage row). Mismatch or `force=true` → call Claude and write a new envelope. **Cache invalidates automatically when the constant in code is bumped** — this is the auto-bust mechanism. There's a `console.log` at line 157-160 emitting `[api/proposals/extract] cache bust on extraction_id=...: stored prompt_version=... != current=...` so production logs surface the bust frequency.

**Step 3 — Already-committed guard.** Lines 117-122:

```ts
if (extractionRow.target_entity_id) {
  throw new ApiError("Extraction has already been committed", 409);
}
```

This is the use of `target_entity_id` to prevent re-extraction of a proposal that's already a `proposals` row.

**Step 4 — ReviewManager state.** `src/app/proposals/review/[extraction_id]/ReviewManager.tsx` holds the entire form state in a single `ProposalForm` interface (~30 fields). On every section's `onChange`, the parent merges the slice into form state. Eleven sub-components compose the form:

| # | Component | Stateful? | Purpose |
|---|---|---|---|
| 1 | ProposalReviewHeader | presentational | Title, vendor, total amount, confidence badge |
| 2 | ProposalFilePreview | presentational | Iframe of signed PDF URL |
| 3 | ProposalDetailsPanel | stateless onChange | vendor_name, proposal_number, dates, scope_summary |
| 4 | ProposalLineItemsSection | stateful | Line items table; add/remove rows |
| 5 | ProposalLineItemRow | stateful | Single row; cost code combobox; suggest-new modal |
| 6 | ProposalFeeScheduleSection | stateful | Additional fees array |
| 7 | ProposalPaymentScheduleSection | stateful | Milestones + payment triggers |
| 8 | ProposalPaymentTermsSection | stateful | Net days, interest, governing law |
| 9 | ProposalScheduleItemsSection | stateful | Work schedule, dates, dependencies |
| 10 | ProposalStatusBadge | presentational | AI confidence pill |
| 11 | (acceptance signature block) | inline in ReviewManager | accepted_signature_present/name/date |

**Step 5 — Cost code combobox.** Each line's combobox composes three optgroups: `org_cost_codes` (the active set), legacy `cost_codes` (Phase 1), and `pending_cost_code_suggestions`. The pick is a discriminated union in `src/components/proposals/ProposalLineItemRow.tsx`:

```ts
type CostCodePick =
  | { kind: "none" }
  | { kind: "org"; org_cost_code_id: string; code: string; name: string }
  | { kind: "legacy"; cost_code_id: string; code: string; description: string }
  | { kind: "pending"; suggestion_id: string; suggested_code: string; suggested_name: string };
```

**Step 6 — Suggest-new-code modal.** When a PM doesn't see a suitable code, they click "Suggest new code." The modal posts to `/api/cost-code-suggestions/route.ts`, which inserts a row into `pending_cost_code_suggestions` (status `pending`). The pick on that line becomes `{ kind: "pending", suggestion_id }`. Owners/admins later approve or reject from `/cost-intelligence/verification`.

**Step 7 — PM role gate (3 layers).** This is enforced redundantly:
- **UI:** `ReviewManager` doesn't render the Save button if the membership role isn't in the allow set.
- **API:** `src/app/api/proposals/commit/route.ts:59` defines `const COMMITTER_ROLES = new Set(["owner", "admin", "pm", "accounting"])` and the route returns 403 for anything else.
- **RLS:** the proposals INSERT policy from migration 00065 checks the same role set. Even if both UI and API checks were bypassed, the database refuses the write.

**Step 8 — Save flow.** `/api/proposals/commit/route.ts` (~350 LOC):
1. Validate membership and role. 403 if denied.
2. Re-load `document_extractions` row, validate it's classified as `proposal` and `target_entity_id IS NULL`.
3. INSERT `proposals` row with all the form fields.
4. Batch-INSERT `proposal_line_items` rows (one per line).
5. For each line, run cost-intelligence wiring:
   - If `cost_code_pick.kind === "legacy"`, dual-write: also create a matching `org_cost_codes` row via service-role client (so future searches see it under the org's working codes).
   - If `cost_code_pick.kind === "pending"`, leave the suggestion in pending state; do not create org_cost_codes yet.
   - For description embedding: addendum-B says "narrow scope deferred." Phase 3.4 ships **without** auto-embedding-on-create in the commit route. The embedding pipeline exists in `src/lib/cost-intelligence/embeddings.ts` and is exercised by `scripts/seed-canonical-items.ts`, but the commit route does NOT call it. This is intentional per addendum-B line 78-82.
6. UPDATE `document_extractions` SET `target_entity_type = 'proposal'`, `target_entity_id = newProposal.id`, `verification_status = 'verified'`.
7. Return `{ proposal_id, line_items_count, new_items_created }`.

**No explicit transaction.** Supabase JS doesn't expose first-class transactions, so the route does sequential writes with rollback-on-error: if a downstream step fails, it soft-deletes the proposal. This means the system is *not* atomic across the full commit — a process kill mid-write can leave inconsistent state. This is documented in `__tests__/api-proposals-commit.test.ts` as known behavior.

**Live state:** 1 `proposals` row exists (cutover from Phase 3.4 dogfood), 7 `proposal_line_items`, status `accepted`, $208,774.69 total.

**Fragility / hidden complexity:**
1. **Cache thrash on prompt updates.** When `EXTRACTION_PROMPT_VERSION` is bumped, every cached extraction is auto-busted on next read. If 50 proposals exist, the next 50 reviews each trigger a fresh ~$0.05 extraction = ~$2.50 churn. No rate limiter. For a small builder this is fine; for scale it isn't.
2. **Soft-delete on commit failure traps the workflow.** If embedding fails partway through, the route soft-deletes the proposal but `target_entity_id` may already be set on `document_extractions`. A retry re-hits the "already committed" 409 path and the PM's edits are gone. There's no UI for "the commit failed, here's your draft, retry." 🚨
3. **The dual-write of legacy → org_cost_codes is silent on failure.** If the service-role client is unavailable (env var misconfigured), the route logs but doesn't fail; org_cost_codes is left empty for that pick. Cost intelligence downstream then has no canonical mapping for that line.
4. **No optimistic locking on commit.** The commit route doesn't take an `expected_updated_at`, so two reviewers committing the same extraction simultaneously could both succeed and produce two `proposals` rows pointing at the same `document_extractions.id`. Only the second's `target_entity_id` write wins; the first is orphaned. Unlikely in practice but undefended.
5. **Embedding-on-create is documented as deferred but the path forward isn't sequenced.** Addendum-B says "scoping decision belongs to that phase's planning, not to Phase 3.3's addendum." It's now after Phase 3.4 and the wiring is still deferred. **This is on the critical path for the moat thesis** — the cost intelligence layer doesn't compound until embedding-on-create is wired.

### Flow C — Invoice parse → approve → draw

> A vendor sends an invoice. Walk it from intake to appearing on a draw.

**Step 1 — Upload + parse.** `src/app/api/invoices/parse/route.ts` accepts multipart FormData. MIME types: pdf, jpeg, png, docx (xlsx is explicitly rejected with "not yet supported"). Storage path `{org_id}/uploads/{timestamp}_{filename}`. Dispatches to `src/lib/invoices/parse-file.ts`:

- pdf/image → `parseInvoiceWithVision()` — Claude Vision API with the invoice prompt
- docx → mammoth → `parseInvoiceFromText()`
- xlsx → throw

The Claude prompt (in `src/lib/claude/parse-invoice.ts`) embeds the org's active cost codes into the system prompt at request time, so the model can suggest a per-line cost code grounded in the org's actual taxonomy. CO-detection is keyword heuristic; math validation is built-in (subtotal + tax = total).

The response shape is `ParsedInvoice` with vendor_name, invoice_number, document_type, line_items[], total_amount, confidence_score, flags[]. Job suggestion is computed by matching parsed `job_reference` against jobs table.

**Step 2 — No three-way matching.** The codebase does NOT auto-match invoices to POs. There's no PO-vendor-invoice cross-validation at parse time. Manual assignment via the allocation editor is the only path. Per amendment-1 Phase 3.6, this is on the roadmap. Today: absent.

**Step 3 — Cost code allocation.** `src/components/invoice-allocations-editor.tsx` fetches/PUTs `/api/invoices/[id]/allocations`. The UI enforces sum = invoice.total and every line has a cost_code_id. Storage is `invoice_allocations` table (51 rows currently in dev). 

**Step 4 — Status transitions.** `src/app/api/invoices/[id]/action/route.ts:20-46`:

```ts
const ACTION_STATUS_MAP: Record<string, string> = {
  approve: "pm_approved",
  hold: "pm_held",
  deny: "pm_denied",
  request_info: "info_requested",
  info_received: "pm_review",
  qa_approve: "qa_approved",
  kick_back: "qa_kicked_back",
  reopen: "pm_review",
};
```

After `approve`, the route auto-advances to `qa_review` (lines 42-45). After `qa_approve`, status is `qa_approved` and the invoice is eligible for a draw.

**Step 5 — status_history JSONB.** Every action appends `{ who, when, old_status, new_status, note }` to the `status_history` JSONB array. Append is application-layer (no trigger). Rendered in the UI by an audit timeline component on the invoice detail page.

**Step 6 — Push to QB.** Stub. There is no QB integration code; the column `qb_bill_id` exists in `invoices` (migration 00001) but is never written. CLAUDE.md mentions QB as Phase 4; not yet shipped.

**Step 7 — Aggregation into a draw.** `src/app/api/draws/new/route.ts:55-207`:
1. Validate at least 1 invoice in the array (WI-H-1 fix).
2. Block if a prior draw is in `draft`/`pm_review`/`submitted` for the same job.
3. Compute next `draw_number`.
4. `computeDrawLines()` (in `src/lib/draw-calc.ts`) groups invoices by cost code, applies retainage, builds line snapshots.
5. `rollupDrawTotals()` computes G702 fields (contract_sum_to_date, total_completed, retainage, current_payment_due).
6. INSERT draws row with status=`draft`.
7. UPDATE each invoice with the `draw_id`.

Live state: 2 draws in `draft`, 16 `draw_line_items`. No draws have been submitted/approved yet on this dev DB.

**Step 8 — Submit + approve transactional RPCs (migration 00061).** Defined as Postgres functions, not TS:
- `draw_submit_rpc` — flips invoices to `in_draw`, auto-generates one `lien_releases` row per vendor on the draw, enqueues notification rows. All atomic.
- `draw_approve_rpc` — checks pending lien releases (blocks if any exist when org setting requires), updates draw to `approved`, auto-schedules invoice payments via `_compute_scheduled_payment_date()`.
- `draw_void_rpc` — reverses a submitted/approved draw.
- `draw_lock_rpc` — referenced but not visible in this excerpt; marks paid draws immutable.

**Step 9 — Excel export.** `src/app/api/draws/[id]/export/route.ts` uses `exceljs` to build a workbook with G702 + G703 + cover letter sheets. Branded with org colors and Century Gothic. Returns `.xlsx`. There's no PDF export — Excel is the only output today. The cover letter is a separate editable text on the draw, persisted via `/api/draws/[id]/cover-letter`.

**Fragility / hidden complexity:**
1. **`xlsx` parse upload is rejected.** Builders frequently get vendor invoices as Excel; today they have to convert to PDF first. Bottom of the backlog because parse-from-Excel is harder than parse-from-PDF.
2. **No three-way matching.** Already noted.
3. **`is_change_order` flag at preview time** can drift from actual CO status. If a CO is approved after the invoice but before a draw is generated, the draw line correctly classifies it; if approved after the draw is locked, the draw is stale.
4. **Auto-advance to `qa_review` is implicit.** No notification, no assignment. Diane checks the queue manually.
5. **Status enums are CHECK-constraint TEXT, not Postgres enums.** Adding a new status requires a migration that ALTERs the constraint. Historical migrations 00060 explicitly aligned the enums across invoice/draw/PO/CO tables.

### Flow D — Draw generation

> What does generating a draw actually do?

**Wizard:** `/draws/new/page.tsx` is 1,134 LOC across 4 steps:
1. **Select Job** (lines 574-651) — list of active jobs with contract metadata (original, billed, remaining, next draw #). `is_final` checkbox here.
2. **Period** (lines 654-697) — application_date, period_start (defaults to day-after-prior-draw.period_end), period_end (today).
3. **Review Line Items** (lines 700-873) — pulls invoices in the period, lets user select/deselect. Live G703 preview below the invoice list with editable `this_period` overrides per line.
4. **Summary & Submit** (lines 876-968) — G702 summary with warnings (overruns, retainage mismatches, lien-release-required reminders).

Wizard draft auto-saves to `draws.wizard_draft` JSONB so a refresh doesn't lose progress.

**Compare view:** `src/components/draw-compare-view.tsx` fetches `/api/draws/{id}/compare` and renders a per-line diff against the prior draw with flags for `new_line`, `went_backwards`, `large_swing`.

**Cover letter:** `src/components/draw-cover-letter-editor.tsx` reads `/api/draws/{id}/cover-letter`. Returns `{ body, generated }` where `generated=true` indicates the body was auto-built from a template. Editing flips `generated` to false.

**G702/G703 export:** `src/app/api/draws/[id]/export/route.ts` produces an Excel workbook. There's no PDF or AIA-form export. The visual fidelity is "AIA-style" rather than the actual AIA G702/G703 form — banks receiving these tend to accept them as long as the line items reconcile, but a real AIA form generator is on the future list.

**Retainage:** `src/lib/draw-calc.ts` `computeDrawLines()` applies `retainage_percent` (read from `jobs.retainage_percent` with org default fallback `organizations.default_retainage_percent`, default 10). On `is_final = true`, retainage is released. The line-level retainage is summed into `total_retainage`, then `total_earned_less_retainage = total_completed - total_retainage` is the schedule-of-values number.

Note: Ross Built's default is `0` retainage (cost-plus, owner doesn't withhold). The default on the org table is 10. So Ross Built's jobs override to 0 explicitly — a job created without an override on a different org would inherit 10.

**Lien release linkage.** `draw_submit_rpc` (migration 00061 lines 200-223) groups invoices on the draw by vendor_id and inserts one `lien_releases` row per vendor with `release_type` (conditional_progress for non-final, unconditional_final for is_final). The relationship is: 1 draw → N lien_releases (one per distinct vendor) → bound by `draw_id` FK. `DrawLienReleaseUploadList` component lets accounting upload PDFs, with name-based vendor inference.

**Payment batch.** `PaymentBatchByVendorPanel` aggregates approved invoices per vendor into a payment schedule. `draw_approve_rpc` schedules them via `_compute_scheduled_payment_date()` using org settings (`5_20`, `15_30`, `monthly`) per CLAUDE.md's Ross Built schedule.

**The 4 RPCs in migration 00061:**
1. `draw_submit_rpc` (lines 108-258) — atomic: flip invoices to `in_draw`, generate lien_releases, notifications.
2. `draw_approve_rpc` (lines 269-396) — atomic: check pending liens, schedule payments, set draws.status to `approved`.
3. `draw_void_rpc` — atomic: reverse the above, return invoices to `qa_approved`.
4. `draw_lock_rpc` — referenced, not visible in excerpt; marks draws immutable post-payment.

Each uses `FOR UPDATE` row locks, has a `_force_fail` parameter for testing rollback, and is `SECURITY DEFINER` so RLS doesn't fight the multi-table cascade.

**Fragility / hidden complexity:**
1. The G703 preview has its own `this_period` override input, but the override write path back to the actual draw line items is brittle — overrides are saved to wizard draft (JSONB), and only persisted to `draw_line_items.this_period` when the user clicks "Create Draw." If they click around between steps, an override on line 12 from step 3 can silently drop if step 4 recomputes from invoice rollup.
2. **Lien release auto-generation is org-agnostic.** If an org doesn't use lien releases (e.g., Ross Built doesn't always require them), the auto-generated rows still have to be marked `not_required` or `waived` to unblock approval. There's no bulk-waive endpoint.
3. **Retainage source is implicit.** No audit trail of "this draw used 10% retainage from org default" vs "this draw used 0% from job override." Operators have to read the job's retainage_percent to understand the number.
4. **No PDF export.** Banks may reject Excel when they expected an AIA G702 form. This is a Phase-4 concern but worth flagging.
5. **Wizard draft cleanup.** Drafts persist in `draws.wizard_draft` with no TTL. A user who abandons mid-flow leaves a row in `status='draft'` forever. The "block if a prior draw is draft" check in `/api/draws/new` then prevents starting a new draw on the same job until the abandoned one is voided.

### Flow E — Cost intelligence loop

> When a proposal commits, what happens in the cost intelligence subsystem?

**Phase 3.3 shipped the foundation:** schema + matcher byte-identical. Phase 3.4 shipped proposal extraction + the cache. **Embedding-on-create is still deferred** per addendum-B.

**Layer 1: `canonical_cost_codes` (NAHB).** Migration 00082 + seed CSV in `docs/canonical-codes/nahb-2024.csv`. Live: 354 rows (5 level-1, 62 level-2, 287 level-3). Read-only RLS for all authenticated. `(spine, code)` UNIQUE, indexes on `(spine, parent_code)` and `(spine, category)`. RLS allows future addition of CSI rows under `spine='CSI'` without disturbing the NAHB spine.

**Layer 2: `org_cost_codes`.** Migration 00083. Per-org Layer-2 mapping. Live: 12 rows total across 3 orgs (sparsely populated — most orgs are still using Phase-1 `cost_codes`). FK to `canonical_cost_codes.id` is **nullable** — orgs can use Nightwork without ever mapping. The codebase coexists with the legacy `cost_codes` table (238 rows) until a future consolidation migration.

**Layer 3: `pending_cost_code_suggestions`.** Migration 00087. PMs can't directly create org_cost_codes. They suggest. Owner/admin resolves via `/cost-intelligence/verification`. Live: 1 pending. Has columns: `suggested_code`, `suggested_name`, `suggested_canonical_code_id`, `source_proposal_line_item_id`, `rationale`, `status` (pending/approved/rejected/duplicate), `approved_org_cost_code_id`, `suggested_by`, `resolved_by`, `resolved_at`. Soft-delete via status only.

**The hot-path matcher (4 files, byte-identical per addendum-B):**

| File | LOC | What it does |
|---|---:|---|
| `src/lib/cost-intelligence/match-item.ts` | 906 | 4-tier matcher: Tier 1 alias-exact, Tier 2 trigram (vendor-scoped), Tier 3 AI semantic, Tier 4 AI propose-new |
| `src/lib/cost-intelligence/commit-line-to-spine.ts` | 524 | Commits a verified extraction line to vendor_item_pricing. Steps: ensure item exists, INSERT pricing, update extraction line, fire alias trigger |
| `src/lib/cost-intelligence/extract-invoice.ts` | 914 | The orchestrator that calls the parser, runs `match-item` per line, populates extraction lines |
| `src/lib/cost-intelligence/correct-line.ts` | 117 | PM correction handler — when a PM changes the matched item, this writes an `item_classification_corrections` row + updates the alias |

The patterns/architectural-decisions agent earlier in this audit incorrectly named `classify-transaction-line.ts` and `normalize-item-name.ts` as members of this set. Per addendum-B line 64, the actual four are the ones above. Note that `extract-invoice.ts` is by far the largest file in `src/lib/cost-intelligence/` and the most sensitive — any change ripples to every invoice extraction.

**`src/lib/cost-intelligence/embeddings.ts`.** OpenAI integration. Model: `text-embedding-3-small`, 1536 dims, ~$0.02 per 1M tokens. Logs api_usage with `function_type='embedding'`. Functions:
- `generateEmbedding(text)` — single embed
- `callOpenAIEmbeddings(opts)` — batched with cache_control
- `backfillItemEmbeddings(supabase, orgId)` — manual backfill utility
- A/B note in the file (lines 396-417) explains that name-only embedding inputs outperformed name+category+specs in early testing.

**`findSimilarLineItems`.** In `src/lib/cost-intelligence/queries.ts`. Returns top-N items by cosine similarity using pgvector `<->` operator on `items.embedding`. Phase 3.3 shipped this as scaffolding; Phase 3.4 doesn't call it yet (because embedding-on-create wiring is deferred). Currently exercised only by `scripts/seed-canonical-items.ts`.

**Phase 3.2 classifier eval baseline.** Already documented in Flow A. The 36/36 fixture rule with 2 known boundary flakes (#28 Home Depot receipts, #30 Dewberry-Gilkey landscaping) is the regression fence.

**Live state of the loop right now:**
- 61 `items` rows total (across all orgs).
- 6 `item_aliases`.
- 7 `vendor_item_pricing` rows.
- 285 `line_cost_components`.
- 126 `pricing_history`.
- 30 embedding API calls in api_usage (so far almost all from seed/backfill, not from live commit).

**The loop today:**
1. PM uploads an invoice → classifier marks it `invoice` → Phase-1-ish parse → invoice gets created.
2. Parse output hits `invoice_extraction_lines` (now `document_extraction_lines` post-rename). Match-item runs per line (Tier 1-4).
3. PM verifies → `commit-line-to-spine` writes `vendor_item_pricing`.
4. Trigger creates `pricing_history` (since 00073/00077).

For proposals (Phase 3.4):
1. PM uploads proposal → classifier → proposal extraction → review form → commit.
2. Commit writes `proposals` + `proposal_line_items` + cost code dual-write + `target_entity_id` on extraction.
3. **Does NOT yet** embed line items or write to `items` / `vendor_item_pricing`. Deferred.

This is the gap that turns the moat thesis from "in progress" to "real": until proposal commit feeds the cost intelligence layer, the moat doesn't compound on the proposal side.

**Fragility / hidden complexity:**
1. **Two registries for the same physical thing.** Until `cost_codes` (238 rows) is consolidated into `org_cost_codes` (12 rows), every cost code lookup has to know which table to query. Bills already work around this via dual-write in proposal commit.
2. **OpenAI lock-in.** The embedding pipeline is OpenAI-only. Model swap requires re-embedding all items.
3. **The 0.85 / 0.92 similarity threshold is hardcoded** in `match-item.ts`. No per-org tunability.
4. **Phase 3.2 eval requires manual run.** Already flagged.
5. **`raw_ocr_text` is NULL on every extraction.** Source-line highlighting (per `diagnostic-source-highlighting.md`) needs per-line page/bbox data. The parse prompt currently discards positional ground truth at extraction time. Future PM trust feature is blocked on extracting these positions.
6. **The cost intelligence queries layer (`queries.ts`, 356 LOC) returns scaffolded data today.** The real signal accumulates only after embedding-on-create lands.

### Flow F — Auth / multi-tenancy

> How does a request know which org it belongs to?

**Auth provider.** Supabase Auth. Sessions stored as cookies. Server-side: `src/lib/supabase/server.ts:8-32` creates a server client that reads/writes auth cookies via Next.js `cookies()`. Middleware (`src/middleware.ts:32-103`) calls `updateSession()` on every request to refresh tokens.

**`getCurrentMembership()`.** `src/lib/org/session.ts:88-95`:

```ts
export async function getCurrentMembership(): Promise<CurrentMembership | null> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return resolveMembership(supabase, user.id);
}
```

`resolveMembership()` (lines 57-76) queries `org_members WHERE user_id = ? AND is_active = true ORDER BY created_at ASC LIMIT 1`. **Single-org-per-user.** A user with 2 active memberships gets the older one. Today this is fine — no user has multi-org. But it's a load-bearing assumption for any future "org switcher" UI.

**RLS pattern.** Every tenant table has an SELECT policy that resolves org_id through `org_members`:

```sql
USING (
  org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND is_active = true
  )
  OR app_private.is_platform_admin()
)
```

Examples: 00083 (org_cost_codes), 00087 (proposals), 00065 (proposals), most newer tables. Older tables (00009 onwards) used `app_private.user_org_id()` (a SECURITY DEFINER function); current convention has migrated to inline subselect.

**`app_private.is_platform_admin()`.** Migration 00048 lines 58-68:

```sql
CREATE OR REPLACE FUNCTION app_private.is_platform_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid());
$$;
```

`SECURITY DEFINER` lets it bypass `platform_admins` RLS (which would otherwise disallow self-checks). `search_path = ''` guards against name resolution attacks. Read by every cross-org SELECT policy as an OR-bypass.

**Where multi-tenancy could leak.** I grepped `org_id` across `src/app/api/`. Pattern check: every write route either reads `membership.org_id` from `getCurrentMembership()` and uses it directly, OR explicitly filters `eq("org_id", membership.org_id)` on every Supabase query. I did not find any route that trusts `org_id` from the request body or query params. The closest case: `src/app/api/dashboard/route.ts` reads from the membership cookie and writes nothing.

**Service-role fallback.** Several routes (`/api/invoices/[id]`, `/api/draws/[id]`, `/api/dashboard`) call `tryCreateServiceRoleClient()` first, then fall back to the user-scoped client. The service-role bypass exists because RLS-with-embedded-foreign-tables produces 406/403 noise during auth rehydration. The pattern: **use service role for reads, but always include explicit `eq("org_id", orgId)`** so the bypass is constrained at the application layer. This is documented in `route-sweep.md` and consistently applied.

**Impersonation.** `src/app/api/admin/platform/impersonate/route.ts`:
1. Calls `requirePlatformAdmin()` (throws if not in platform_admins).
2. Validates target_org_id exists.
3. INSERT row into `platform_admin_audit` (admin_user_id, action='start_impersonation', target_org_id, reason, …).
4. Sets `nw_impersonate` cookie httpOnly + secure with `{ admin_user_id, target_org_id, started_at, audit_id }`, max-age 1 hour.

Middleware reads the cookie and uses `target_org_id` instead of the actual membership for downstream queries. A red banner (`ImpersonationBanner` component) shows on every page.

**One quirk:** the runbook mentions that impersonation writes (e.g., extending a trial via the admin UI while impersonating) require a service-role shim for cross-org mutations. The shim isn't shipped yet — runbook says staff must use Supabase SQL editor directly + manually log audit rows. This is documented as deferred work.

**Fragility / hidden complexity:**
1. **Single-org assumption** — already noted.
2. **Soft-delete predicates are application-layer.** RLS doesn't filter `deleted_at IS NULL`; every query has to add `.is("deleted_at", null)`. A forgotten filter leaks soft-deleted records. By design (per CLAUDE.md), to keep policies simple, but it's a footgun.
3. **The impersonation cookie can outlive the work session.** 1 hour is a long time if a staff member walks away. Probably fine, but worth tracking via `platform_admin_audit`.
4. **`app_private.user_org_id()` legacy function.** Some older RLS policies still call it. Newer ones use the inline subselect. Both work, but the indirection level varies and a refactor to one form would be cleaner.

### Flow G — Cron / background jobs

> What runs on a schedule?

**One cron route exists.** `src/app/api/cron/overdue-invoices/route.ts:15-79`:
1. Validates `CRON_SECRET` from query param OR Authorization header (env-gated; falls open in dev if unset).
2. Loads all organizations.
3. For each org, queries invoices with `received_date < 30 days ago AND payment_status IN (unpaid, scheduled)`.
4. If any found, posts a notification digest to all accounting/admin users in that org.
5. Logs to `activity_log`.

**Trigger.** No `vercel.json` in the repo, no GitHub Actions cron. The route is a GET endpoint; in production it would be hit by Vercel Cron or an external scheduler with the `CRON_SECRET`. **As of right now, the schedule isn't wired** — the route is dormant.

**No other cron routes.** Trial expiry, archive, lien-release reminders, draw approval reminders — all manual today.

**Fragility:**
1. **No distributed lock.** Two simultaneous calls duplicate notifications.
2. **Secret-in-query-param fallback.** Authorization header is preferred; query param is a leak risk via logs/proxies/browser history.
3. **`cleanup_stale_import_errors()` has no cron hookup.** Migration 00047 created the function for orphan-storage cleanup; production never schedules it.
4. **Trial expiry isn't enforced anywhere automatic.** Orgs in `trialing` after `trial_ends_at` keep working. The `subscription_status` only flips when Stripe webhook fires.

### Flow H — Stripe / billing

> What's wired and what's vestigial?

**Routes:** 3 found in `src/app/api/stripe/`:
- `checkout/route.ts` — creates Stripe checkout session, returns redirect URL
- `portal/route.ts` — opens Stripe customer portal
- `webhook/route.ts` — handles subscription lifecycle

**Webhook handler.** Verifies signature via `stripe.webhooks.constructEvent()` using `STRIPE_WEBHOOK_SECRET`. Handles:
- `customer.subscription.updated` — maps Stripe status to `organizations.subscription_status` (mapping `canceled` → `cancelled` for spelling consistency).
- `customer.subscription.deleted` — sets to `cancelled`.
- Resolves `org_id` from subscription metadata or customer metadata. Upserts `stripe_subscription_id`, `stripe_customer_id`, `trial_ends_at`, `subscription_plan`.

**Subscription plans.** Migration 00024 seeds defaults: status `trialing`, 14-day trial. `priceIdToPlanSlug()` maps Stripe price IDs to plan slugs. Live: all 3 orgs are `trialing` (Ross Built has plan `enterprise`, the others are `free_trial`). Trial end dates are 2026-04-29 / 2026-04-30 — two of them have already expired or will tomorrow.

**Plan-limits gate.** `src/lib/plan-limits.ts` defines per-plan quotas (token caps, invoice counts, team size). It's invoked by:
- `src/lib/claude/index.ts` — throws `PlanLimitError` if AI token usage exceeds plan cap.
- The 429 path in `/api/ingest` already handles this.

But **plan-limits is NOT consistently enforced.** For example, the proposal extract route (`/api/proposals/extract`) doesn't check it before re-extracting on cache miss. Several invoice routes don't check it. Inventory needed.

**`/pricing` page** drives Stripe checkout via the `checkout` route. Tested manually (per QA reports) but never run in production.

**Fragility / hidden complexity:**
1. **Trial expiry not enforced.** As noted, `trial_ends_at` doesn't automatically flip status.
2. **Webhook idempotency.** Stripe deduplicates server-side, but on the app side the webhook does upsert without idempotency keys — duplicate deliveries cause duplicate writes (mostly harmless but auditable).
3. **Plan-limits coverage gap.** Several routes that consume tokens or storage don't gate.
4. **No subscription_status drift detection.** If an org's status is changed manually in Stripe Dashboard, sync delays until next event.

### Flow I — Data ingestion (the half-built one)

The user-described "half-built one" maps to `src/lib/ingestion/`, the universal ingestion pipeline.

**Files:**
- `src/lib/ingestion/classify.ts` — invoke classifier
- `src/lib/ingestion/extract-invoice.ts` (in this directory or in cost-intelligence/) — invoice extractor
- `src/lib/ingestion/extract-proposal.ts` — proposal extractor (Phase 3.4)
- `src/lib/ingestion/extract-co.ts`, `extract-vendor.ts`, `extract-budget.ts`, `extract-historical-draw.ts` — *do not exist yet.* These are referenced in amendment-1 but not implemented.

**Routes:**
- `/api/ingest/route.ts` — generic upload + classify (Flow A above).
- `/api/proposals/extract/route.ts` — proposal-specific extract (Flow B).
- *No corresponding extract routes for CO, vendor, budget, historical draw.* These are amendment-1 phases 3.7, 3.8, 3.9.

**Test coverage:** `__tests__/api-ingest.test.ts` exists. It's a structural fence test (asserts the route file exists, exports POST, calls getCurrentMembership, returns proper error codes). Not a runtime test.

**Status assessment:**
- ✅ Document classifier — 10-way, prompt v2, 36-fixture eval, **shipped Phase 3.2**.
- ✅ Invoice extraction — full pipeline, line items, allocations, **shipped Phase 1+ (mature)**.
- ✅ Proposal extraction + cache + review form — **shipped Phase 3.4 (just landed)**.
- ⏸️ PO extraction — **deferred indefinitely** per amendment-1 (POs are outputs not inputs).
- 🚧 CO extraction — **not started**, targeted for Phase 3.7.
- 🚧 Vendor extraction (W-9, COI) — **not started**, targeted for Phase 3.8.
- 🚧 Budget + historical draw extraction — **not started**, targeted for Phase 3.9.
- 🚧 Document review queue UI — **partially built** at `/cost-intelligence/verification` for invoices, but not the cross-document classifier-output triage UI promised in amendment-1 phase 3.10.

This is what "half-built" looks like from the inside: the architectural pattern (universal classify → typed extract → typed commit, mediated by `document_extractions`) is real and proven on two surfaces (invoice, proposal). The remaining four extractors (CO, vendor, budget, historical draw) are well-understood schema additions on top of the existing pattern but haven't shipped.

**Fragility / hidden complexity:**
1. **The `document_extractions` row is the universal mediator.** Any new classified_type adds rows to one table. The schema (verified above) supports this — `classified_type`, `target_entity_type`, `target_entity_id`, `extracted_data` JSONB, `extraction_prompt_version`. No structural blocker to expanding.
2. **Each extractor needs its own prompt + eval.** The 36/36 classifier eval doesn't cover extraction quality. Proposal extraction has a separate fixture set in `__tests__/extract-proposal.test.ts` and `__tests__/proposal-extraction.test.ts`. Invoice extraction has its own. CO/vendor/budget would each need similar.
3. **The existing pattern doesn't enforce that an extraction maps to exactly one entity.** A multi-line invoice splits across multiple cost codes via `invoice_allocations`, but splits across multiple jobs requires multiple invoice records (per CLAUDE.md "split across jobs" workflow). The `target_entity_id` on `document_extractions` is single-valued; splits aren't first-class.

### Cross-flow synthesis

**Well-built flows.**
- **Document classification (Flow A).** Mature, well-tested, eval-gated, cost-instrumented. The 36/36 + boundary-flake allowlist is a beautiful regression fence.
- **Invoice parse → approve → draw (Flow C).** Production-quality on the happy path. RPC-based draw transitions are atomic. status_history JSONB gives perfect audit. Most of the brittleness is around edge cases (xlsx, three-way matching) that are explicitly deferred.
- **Auth / multi-tenancy (Flow F).** Multi-layered (UI + API + RLS), audited (route-sweep.md, REVIEW_FINDINGS Phase A), and the platform-admin escape hatch is well-designed.

**Fragile flows.**
- **Proposal commit (Flow B).** No transaction, soft-delete-on-failure can trap state, dual-write to legacy cost codes is silent on failure. Just-shipped, will accumulate scar tissue. **The cost-intelligence wiring is intentionally deferred but the path forward isn't sequenced.** 🚨
- **Stripe billing (Flow H).** Plan-limits inconsistently applied, trial expiry not enforced, webhook idempotency relies on Stripe's server side.
- **Cron (Flow G).** One job, not scheduled in production. Cleanup function exists, never runs.

**Flows with hidden complexity.**
- **Draw generation (Flow D).** Wizard draft + `this_period` overrides in JSONB + final write to draw_line_items has data-flow gotchas. Lien release auto-generation is org-agnostic when it shouldn't be. No PDF export.
- **Cost intelligence (Flow E).** The 4-file boundary is real and important; embedding-on-create deferred is the bottleneck for the moat thesis.

**Flows with missing pieces.**
- **Data ingestion (Flow I).** 4 extractors (CO, vendor, budget, historical draw) not started. Phases 3.7–3.9 in amendment-1.
- **QB integration.** Phase 4. `qb_bill_id` column exists, never written.
- **Onboarding migration paths.** Amendment-1 names three: Buildertrend export, Excel/Sheets import, greenfield. Today only greenfield works. Phases 4+.

---

## Deliverable 3 — Patterns and conventions

Where the code is consistent, where it isn't, and what holds it together.

### File naming

**Pattern.** Routes and component directories are kebab-case. Helper files in `src/lib/` are kebab-case. Component file names are PascalCase. Test files mirror the route path with `-` separators.

Examples:
- `src/app/api/cost-intelligence/extraction-lines/[id]/mark-non-item/route.ts`
- `src/components/proposals/ProposalLineItemRow.tsx`
- `src/lib/cost-intelligence/match-item.ts`
- `__tests__/api-proposals-commit.test.ts`

**Deviation (minor).** `src/components/nw/Button.tsx` and siblings use PascalCase but parent `src/components/` mixes kebab-case (`invoice-allocations-editor.tsx`) and PascalCase (`Button.tsx`). The `nw/` subdir is the explicit Slate-design primitives and uses PascalCase intentionally. Outside `nw/`, kebab-case is the rule.

### Component file structure

**Pattern.** Default export per component file. Props interfaces co-located in the same file. Cross-file types in `types.ts` siblings or in `src/lib/types/`.

Example: `src/components/proposals/ProposalReviewHeader.tsx` exports `default function ProposalReviewHeader(props: Props)` with the `Props` interface at the top of the file.

**Deviation (minor).** `CostCodePick` and `ProposalLineItemForm` types live in `ProposalLineItemRow.tsx` and are imported by `ReviewManager.tsx`. Inconsistent with the cleaner pattern in `src/lib/cost-intelligence/types.ts` (centralized types). Functional, but breaks the convention.

### Server vs client components

**Pattern.** Pages that need server-only data fetching omit `"use client"`. Pages that need browser interactivity start with `"use client"`. Layouts can be either; in this codebase, most are server.

Examples:
- Server: `src/app/proposals/review/[extraction_id]/page.tsx` — async function fetching extraction + jobs + vendors.
- Client: `src/app/dashboard/page.tsx` — needs polling/state.

**Hybrid pattern (very common).** Server page does data fetching, then mounts a client orchestrator with the data as props. This is the right pattern and is consistently applied.

### API route response envelope

**Pattern.** Errors throw `ApiError(message, status)` from `src/lib/api/errors.ts`. The `withApiError` wrapper catches and returns `{ error }` with the right status. Successful responses are endpoint-specific (no enforced envelope for success).

Example (`src/lib/api/optimistic-lock.ts:98`):
```ts
return NextResponse.json({ error, code: "optimistic_lock_conflict", current }, { status: 409 });
```

**Inconsistencies (minor):**
- Some older routes return `{ ok: true, data }`. Newer routes throw on error and return data on success.
- Status codes vary: 400 vs 422 for validation errors, 403 vs 404 for "not found in your org" cases.

### API route auth pattern

**Canonical pattern.** Three lines at the top of every authenticated handler:

```ts
const membership = getMembershipFromRequest(req) ?? (await getCurrentMembership());
if (!membership) throw new ApiError("Not authenticated", 401);
const orgId = membership.org_id;
// ... all queries filter by orgId
```

`getMembershipFromRequest` reads the impersonation cookie if present; otherwise `getCurrentMembership` resolves from auth.uid → org_members.

**Coverage** (per the API-surface map): 95+ routes use this pattern. 15 routes use stronger `requireRole(...)`. 9 use `requirePlatformAdmin()`. 2 use external signature verification (Stripe webhook, cron secret). 2 are intentionally unauthenticated (CSV parse, theme cookie).

**One outlier flagged:** `/api/invoices/[id]/docx-html` — RLS-only, no explicit auth check. **Should be hardened.** 🚨

### Optimistic locking

**Pattern.** Client passes `expected_updated_at`. Server uses `updateWithLock()` from `src/lib/api/optimistic-lock.ts`:

```ts
const result = await updateWithLock(supabase, "invoices", id, expectedUpdatedAt, patch, orgId);
if (isLockConflict(result)) return result.response; // 409 with current row
```

10 routes use it: change-orders, cost-intelligence/codes, draws action / revise, invoices action / payment, lien-releases (and upload), purchase-orders, vendors. Coverage on critical financial state changes is good.

**Gap:** proposal commit doesn't take an `expected_updated_at`. Two simultaneous commits could both create proposals rows from the same extraction. The `target_entity_id` on `document_extractions` becomes the de-facto race winner — second writer's proposal is "successful" but orphaned.

### DB transactions

**Pattern.** Multi-table cascades go through `SECURITY DEFINER` Postgres RPCs. Single-table updates are direct. The TS layer never opens a transaction.

Examples:
- Atomic: `draw_submit_rpc`, `draw_approve_rpc`, `draw_void_rpc` (migration 00061), `draw_lock_rpc` referenced.
- Sequential with rollback: `proposals/commit` (rollback via soft-delete on error).
- Direct: most CRUD on single tables.

### RLS policies

**Pattern (newer migrations 00065+).** 3-policy shape: SELECT, INSERT, UPDATE. No DELETE policy (defaults to deny). Soft-delete via UPDATE setting `deleted_at` or `is_active=false`.

```sql
CREATE POLICY foo_org_read ON public.foo FOR SELECT
  USING (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = true)
    OR app_private.is_platform_admin()
  );
```

Older migrations (00001–00046) used `app_private.user_org_id()` SECURITY DEFINER function instead of inline subselect; both work but pattern drifted. Migration 00046 explicitly tightened reads. Migration 00080 enabled RLS on tables that had been forgotten.

**Notable: R.23 cross-checks.** Migrations 00069 (draw_adjustments), 00072 (job_milestones), 00083 (org_cost_codes), and 00073 (pricing_history) all explicitly cite the precedent migration they're patterning after. R.23 means new tables don't invent a new RLS shape unless there's a documented reason to deviate. 00073 (pricing_history) is the canonical deviation example: 1-policy (SELECT only) because it's a trigger-populated audit log.

### Migration patterns

**Pattern.** Numbered `NNNNN_description.sql` + paired `.down.sql` for migrations from 00060 onward (older ones don't have downs, which is a known gap). Idempotent via `IF NOT EXISTS` / `IF EXISTS` / `DO` blocks. Comments at the top of complex migrations document architectural rationale.

Example: migration 00069 has a 350-line comment block at the top documenting:
- Scope (adjustments table only, not approval_chains)
- R.23 precedent: 00065 proposals
- PM-on-own-jobs read narrowing (with R.23 divergence rationale)
- FK runtime quirk where Postgres FK check respects RLS during INSERT
- Soft-delete cascade semantics (application-layer, not DB-layer)

This pattern of in-migration ADRs is excellent and unique to this repo.

### Test patterns

**Pattern.** Tests use a custom runner at `__tests__/_runner.ts`. Each test file exports `cases: TestCase[]`. The runner imports all `*.test.ts` files and runs them sequentially.

Three styles in use:
1. **Structural fence tests** — read source code as a string, assert by regex (`api-proposals-commit.test.ts`, `proposals-schema.test.ts`).
2. **Functional tests** — import the module, call the function, assert (`embeddings.test.ts`, `queries.test.ts`).
3. **Integration tests** — env-gated (`RUN_CLASSIFIER_EVAL=1`) hit live APIs (`document-classifier.test.ts`).

Total: 39 test files. No Jest, no Vitest. Custom runner is fast (sub-second) and dependency-free.

**Tradeoff.** No test reporter, no CI hooks. Flaky integration tests can't run in PR checks. The classifier eval is the main one affected.

### Status enums

**Pattern.** TEXT columns with CHECK constraints listing all valid values. Postgres enum types are NOT used (they're hard to alter).

Example (invoices, migration 00001):
```sql
status TEXT NOT NULL DEFAULT 'received' CHECK (status IN (
  'received', 'ai_processed', 'pm_review', 'pm_approved', ...
))
```

TS union types mirror the CHECK sets in `src/lib/types/`.

Migration 00060 (`align_status_enums`) explicitly aligned values across invoice/draw/PO/CO. The discipline holds.

### Money handling

**Pattern.** All amounts stored as `BIGINT` representing cents. Conversion in the UI only.

`src/lib/utils/format.ts:5-14`:
```ts
export function formatCents(cents: number): string {
  if (cents === null || cents === undefined || isNaN(cents)) return "$0.00";
  const abs = Math.abs(cents) / 100;
  return new Intl.NumberFormat(...).format(abs);
}
```

Reverse `dollarsToCents` rounds. Only edge case found: parse-invoice prompt returns dollars (per CLAUDE.md schema), and the parse-file.ts shim multiplies by 100. Consistent across the codebase.

### JSONB usage

**status_history shape:**
```jsonb
[
  { "who": "user_id", "when": "2026-04-28T...Z", "old_status": "draft", "new_status": "submitted", "note": "..." }
]
```

Schema: `status_history JSONB NOT NULL DEFAULT '[]'::JSONB`. No structural enforcement at DB level. App-layer only.

**Other JSONB columns:** `ai_raw_response`, `pm_overrides`, `qa_overrides`, `confidence_details`, `attributes`, `field_confidences`, `extracted_data`, `payment_schedule`, `additional_fee_schedule`, `payment_terms`, `schedule_items`, `wizard_draft`. The pattern is "self-describing semi-structured data" — schema enforced only when the data is queried in a specific way.

### Logging / observability

- **Sentry:** wired in `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`. `src/lib/sentry-context.ts` stamps each request with `org_id`, `user_id`, `impersonation_active`, `platform_admin` (per CLAUDE.md platform-admin section).
- **`api_usage` table:** every Claude / OpenAI call writes a row with function_type, tokens, cost, status, error_message, metadata. Read by `/admin/platform` cost rollups.
- **`activity_log` table:** generic audit table; `logActivity()` and `logStatusChange()` helpers in `src/lib/activity-log.ts`.
- **`perf-log.ts`:** `PERF_LOG=1` env-gated. Wraps async fns with timing logs. Off in production.

### Error UX

**Pattern.** Toast notifications via `<ToastProvider>` mounted in root layout. Module-level publisher (`publishToast(kind, message)`) usable from non-React code. Auto-dismiss 5s, max 3 visible. Kinds: success / error / warning / info.

`src/app/error.tsx` is the global error boundary; sends to Sentry + renders fallback.

Inline form errors are still ad-hoc per form — no unified pattern.

### Anti-patterns / inconsistencies (severity-tagged)

| # | Issue | Severity | Where | Fix scope |
|---|---|---|---|---|
| 1 | RLS-only auth on `/api/invoices/[id]/docx-html` | medium | docx-html route | Add 3-line auth check |
| 2 | Custom test runner instead of Jest/Vitest | minor | `__tests__/` | None needed; works |
| 3 | Response envelope variation (older `{ ok: true }` vs newer error-throw) | minor | various API routes | Migrate as touched |
| 4 | Type definitions in component files instead of `.types.ts` siblings | minor | `ProposalLineItemRow.tsx` | Refactor as touched |
| 5 | Plan-limits gate not consistently enforced | medium | several /api routes that consume tokens | Inventory + add gates |
| 6 | Trial expiry not enforced (orgs in `trialing` past `trial_ends_at` keep working) | medium | `src/lib/plan-limits.ts` + middleware | Cron job or middleware check |
| 7 | Soft-delete predicates application-layer (not RLS) | medium | every query | Documented; trade-off |
| 8 | Wizard draft cleanup never happens | minor | `draws.wizard_draft` JSONB | TTL or sweep cron |
| 9 | Two cost code registries co-exist (`cost_codes` Phase 1 + `org_cost_codes` Phase 3.3) | medium | several routes | Consolidation migration |
| 10 | `cleanup_stale_import_errors()` exists but never runs | minor | migration 00047 | Cron hookup |
| 11 | OpenAI embedding lock-in | minor | `src/lib/cost-intelligence/embeddings.ts` | Acceptable; document |
| 12 | Hardcoded similarity thresholds (0.85, 0.92) | minor | `match-item.ts` | Per-org config when scale demands |
| 13 | Classifier eval requires manual run | medium | `__tests__/document-classifier.test.ts` | Cron hookup or scheduled CI |
| 14 | `extraction_prompt_version` column dual-purposed (classifier vs proposal extractor) | minor | `document_extractions` schema | Document explicitly |
| 15 | No explicit transaction on `proposals/commit`; soft-delete-on-failure can trap state | medium | `/api/proposals/commit/route.ts` | RPC migration or saga pattern |

---

## Deliverable 4 — Schema with usage

The schema is the most stable artifact in this codebase. 91 migrations, ~70 tables, RLS on every tenant table, 354-row NAHB seed, 30+ triggers, 80+ indexes. Below is the current state grouped by domain, with row counts as of 2026-04-28 and notes on what writes/reads each.

### Auth / org / permissions

| Table | Rows | Notes |
|---|---:|---|
| `auth.users` | 11 | Supabase-managed |
| `public.profiles` | 11 | Mirror of auth.users with full_name, role, org_id |
| `public.users` | 9 | **Legacy** — Phase 1 internal team table, parallel to profiles. Should be retired. |
| `public.organizations` | 3 | Ross Built (enterprise/trialing), 2 test orgs. Subscription_status, trial_ends_at, branding fields, default_retainage_percent. |
| `public.org_members` | 11 | The RLS anchor. (org_id, user_id, role, is_active, invited_at, accepted_at) |
| `public.org_invites` | 0 | Pending invites (24-byte hex token, 14-day expiry) |
| `public.platform_admins` | 2 | Jake + Andrew. Cross-tenant access. |
| `public.platform_admin_audit` | 8 | Append-only. All cross-org actions logged. |

**Writers:** signup flow (`public.create_signup` SECURITY DEFINER RPC), team-invite routes, admin platform routes.
**Readers:** every authenticated route via `getCurrentMembership()` → `org_members`. RLS on every tenant table joins back to `org_members`.
**RLS:** strict org-scoping; platform_admin bypass via `app_private.is_platform_admin()`.
**Sample row (organizations, redacted):** `{ id, name: "Ross Built Custom Homes", slug: "ross-built", subscription_status: "trialing", subscription_plan: "enterprise", trial_ends_at: "2026-04-29T..." }`.

**Concern:** `public.users` (legacy, 9 rows) and `public.profiles` (11 rows) and `auth.users` (11 rows) co-exist. The legacy `users` table is referenced by the original Phase 1 `assigned_pm_id` FK on invoices and similar. A future cleanup migration would consolidate.

### Jobs and vendors

| Table | Rows | Notes |
|---|---:|---|
| `public.jobs` | 16 | Universal parent. Contract amounts in cents. retainage_percent, deposit_percentage, gc_fee_percentage. |
| `public.vendors` | 24 | Per-org. default_cost_code_id (most vendors map to one trade). qb_vendor_id present, never written. |

**Writers:** `/api/jobs`, `/api/vendors`, signup flow auto-creates job templates? (No — verified; jobs are manually created).
**Readers:** every dashboard, every invoice/draw/proposal flow.
**RLS:** org-scoped read, owner/admin write.
**Indexes:** by org_id, job_id (both heavily indexed for hot paths).

### Cost codes

| Table | Rows | Notes |
|---|---:|---|
| `public.cost_codes` | 238 | **Legacy Phase-1 codes.** Per-org, 5-digit Ross Built codes seeded. is_change_order flag. parent_code (00068). |
| `public.canonical_cost_codes` | 354 | NAHB spine v1. 5 level-1, 62 level-2, 287 level-3. (spine='NAHB' for all rows.) Read-only RLS. |
| `public.org_cost_codes` | 12 | Per-org Layer-2 mapping. Sparsely used. Maps to canonical_code_id (nullable). |
| `public.pending_cost_code_suggestions` | 1 | PM-suggested new codes awaiting owner/admin approval. |
| `public.cost_code_templates` | 4 | System-level starter templates for new orgs (Phase 7.5 placeholder). |

**Writers:** `/api/cost-codes` (Phase 1 legacy), `/api/cost-intelligence/codes` (Phase 3.3 new), `/api/cost-code-suggestions/*` (suggestion flow).
**Readers:** invoice parse prompt (embeds active codes), proposal review form, allocation editor.
**RLS:** org-scoped read for legacy + org tables; canonical is read-only-to-all.
**Sample row (canonical):** `{ spine: "NAHB", code: "01-01-0110", level: 3, category: "Pre-Acquisition", name: "Feasibility Study", parent_code: "01-01" }`.

**Concern (already noted in patterns):** Two registries exist. Until consolidation, every cost code lookup has to know which table.

### Budgets

| Table | Rows | Notes |
|---|---:|---|
| `public.budget_lines` | 288 | One per cost code per job. original_estimate, revised_estimate (with CO adjustments), is_allowance, sort_order, notes, committed (PO sum), invoiced (auto-sync trigger from invoice_line_items approvals). |
| `public.budgets` | 0 | Version history per job. Schema exists; no production use yet. |

**Writers:** `/api/budget-lines/*`, recalc helpers, CO approval triggers (which update revised_estimate via `co_cache_trigger` from migration 00042).
**Readers:** `/jobs/[id]/budget` page, draw line generator (`computeDrawLines()`).
**Computed fields (per CLAUDE.md):** `previous_applications`, `this_period`, `total_to_date`, `percent_complete`, `balance_to_finish` are computed on read except where 00042 trigger maintains a cache.

### Purchase orders and change orders

| Table | Rows | Notes |
|---|---:|---|
| `public.purchase_orders` | 0 | **Schema exists, no rows.** PO ingestion deferred per amendment-1. |
| `public.po_line_items` | 0 | Same. |
| `public.change_orders` | 88 | Mostly Ross Built historicals. status_history JSONB. gc_fee_amount, gc_fee_rate, total_with_fee, draw_number. source_invoice_id (when CO created from invoice variance, future Phase 3.6). |
| `public.change_order_lines` | 0 | Schema only. |
| `public.change_order_budget_lines` | 0 | Allocation between CO and budget. Schema only. |
| `public.internal_billing_types` | 8 | Org-scoped types: GC Supervision, Contingency, etc. |
| `public.internal_billings` | 3 | Live internal billings on draws. |

**Writers:** `/api/change-orders/*`, `/api/purchase-orders/*` (UI exists, very few writes), `/api/internal-billings/*`.
**Readers:** `/jobs/[id]/change-orders`, `/jobs/[id]/purchase-orders`, draw generators.
**Concern:** PO scaffolding exists end-to-end but no rows. Either remove from nav or build PO generation from proposal (Phase 3.5).

### Invoices

| Table | Rows | Notes |
|---|---:|---|
| `public.invoices` | 57 | 55 qa_approved, 2 qa_review. status_history JSONB. document_category (job_cost / overhead). is_change_order flag. is_potential_duplicate detection (since 00045-ish). parent_invoice_id (partial approval split). pm_overrides + qa_overrides JSONB. ai_raw_response JSONB. import_batch_id (bulk imports). |
| `public.invoice_line_items` | 119 | Per-line cost code allocation. ai_suggested_cost_code_id + ai_suggestion_confidence. |
| `public.invoice_allocations` | 51 | Newer allocation table (00038 + 00078 backfill from line_items). |
| `public.invoice_import_batches` | 1 | Bulk import tracking. |

**Writers:** `/api/invoices/parse`, `/api/invoices/[id]/action`, `/api/invoices/[id]/payment`, `/api/invoices/save`, `/api/invoices/import/*`, `/api/invoices/[id]/allocations`.
**Readers:** queue, QA, job detail, draws, dashboard.
**Indexes:** (org_id, status), (org_id, payment_status), (org_id, vendor_id), (job_id, status). All from migration 00035.

**Sample row (redacted):** `{ id, org_id, vendor_id, job_id, invoice_number: "INV-1234", invoice_date: "2026-03-15", total_amount: 12500000, status: "qa_approved", payment_status: "scheduled", original_filename: "smartshield_dec.pdf", confidence_score: 0.94 }`.

### Draws / liens / payments

| Table | Rows | Notes |
|---|---:|---|
| `public.draws` | 2 (active) | Both `draft`. Wizard draft state in `draws.wizard_draft` JSONB. G702 fields all stored, computed at create-time and updated via RPC. retainage_on_completed/stored, total_retainage. parent_draw_id (revision link), is_final, locked_at. cover_letter_text + generated flag. |
| `public.draw_line_items` | 16 | Per budget_line per draw. previous_applications, this_period, total_to_date, percent_complete, balance_to_finish. |
| `public.draw_adjustments` | 0 | Per migration 00069 — corrections, credits, withholds. Schema only; no production use. |
| `public.draw_adjustment_line_items` | 0 | Same. |
| `public.lien_releases` | 0 | Per draw per vendor. release_type, status, waived_at (00063). 1:N from draws. |

**Writers:** `/api/draws/new` (wizard), `/api/draws/[id]/action` (RPC dispatch), `/api/draws/[id]/cover-letter`, `/api/lien-releases/*`.
**Readers:** `/draws`, `/draws/[id]`, `/draws/[id]/export`, `/draws/[id]/compare`.
**Atomicity:** `draw_submit_rpc`, `draw_approve_rpc`, `draw_void_rpc`, `draw_lock_rpc` (migration 00061).

### Cost intelligence / items / embeddings

| Table | Rows | Notes |
|---|---:|---|
| `public.items` | 61 | The canonical item registry (post-addendum-B, supersedes the planned `canonical_items`). canonical_name, item_type, unit, canonical_unit, embedding VECTOR(1536), occurrence_count, default_cost_code_id. |
| `public.item_aliases` | 6 | Vendor-scoped aliases for items. Tier-1 matcher input. |
| `public.vendor_item_pricing` | 7 | The pricing spine. source_type (invoice/po/co/proposal/manual), unit_price, cost_components JSONB. |
| `public.pricing_history` | 126 | Append-only audit of pricing changes (trigger-driven, migration 00073/00077). 1-policy RLS (R.23 deviation). |
| `public.line_cost_components` | 285 | Hybrid component breakdown of every extraction line into typed components. |
| `public.line_bom_attachments` | 2 | Bill-of-materials. |
| `public.unit_conversion_templates` | 13 | System-level conversions. |
| `public.unit_conversion_suggestions` | 3 | AI-proposed conversions awaiting confirmation. |
| `public.job_item_activity` | 6 | Plan vs actual per item per job. |
| `public.item_classification_corrections` | 0 | PM corrections feed back to alias library. |

**Writers (well-trodden):** `match-item.ts`, `commit-line-to-spine.ts`, `correct-line.ts`, the 4-tier matcher.
**Writers (deferred):** proposal commit doesn't yet create items / vendor_item_pricing. Embedding-on-create deferred per addendum-B.
**Readers:** `findSimilarLineItems`, `getVendorPriceHistory`, `getCostCodeRollup`, `flagAnomaly` in `queries.ts`.
**Indexes:** `items_embedding_idx` (ivfflat cosine, 100 lists). pgvector extension enabled in migration 00084.

### Document extractions

| Table | Rows | Notes |
|---|---:|---|
| `public.document_extractions` | 133 (~75 active) | Universal extraction row. classified_type (10 values), target_entity_type (7 values), target_entity_id (bare UUID, no FK), verification_status. extracted_data JSONB cache + extraction_prompt_version (Phase 3.4). raw_pdf_url. |
| `public.document_extraction_lines` | 391 | Per-line extracted data. extracted_values JSONB, verification_status, proposed_item_data. |

**Writers:** `/api/ingest`, `/api/proposals/extract`, `/api/proposals/commit` (sets target_entity_id on success), `/api/cost-intelligence/extraction-lines/*`.
**Readers:** every flow that mediates through extractions.

**Sample row (an active proposal extraction):**
```
{
  id: "0011b454-...",
  classified_type: "proposal",
  classification_confidence: 0.95,
  target_entity_type: "proposal",
  target_entity_id: "3f590cff-..." (the committed proposals row),
  verification_status: "verified",
  extraction_prompt_version: "phase-3.4-step2",
  extraction_model: "claude-sonnet-4-20250514"
}
```

This is the row that survived end-to-end Phase 3.4 cutover. Confirms the cache + commit + target_entity_id pattern works.

### Proposals

| Table | Rows | Notes |
|---|---:|---|
| `public.proposals` | 1 | The cutover row. 38 columns including raw_extraction JSONB, extraction_confidence, additional_fee_schedule JSONB, payment_schedule JSONB, payment_terms JSONB, schedule_items JSONB, accepted_signature_present/name/date, job_address, vendor_stated_start_date, vendor_stated_duration_days. amount BIGINT (cents). |
| `public.proposal_line_items` | 7 | Per-line. cost code dual-write (cost_code_id + org_cost_code_id). |

**Writers:** `/api/proposals/extract`, `/api/proposals/commit`, `/api/proposals/[id]/convert-to-po` (501 stub).
**Readers:** `/proposals/review/[extraction_id]` (via document_extractions.target_entity_id), future `/proposals/[id]` detail page (not yet built).

**Note on column name vs amendment-1:** Amendment-1 line 297 writes `total_cents BIGINT NOT NULL`. The shipped column is named `amount BIGINT`. Same semantics (cents), different name. Worth noting in the canonical plan.

### Approvals / milestones / portal

| Table | Rows | Notes |
|---|---:|---|
| `public.approval_chains` | 18 | 6 workflow types × 3 orgs. Default seed via trigger on org create. |
| `public.job_milestones` | 0 | Schema only. v2 infrastructure for fixed-price builders (per migration 00071 comment). |
| `public.client_portal_access` | 0 | Schema only. SHA-256 hashed token, 90-day sliding expiry. |
| `public.client_portal_messages` | 0 | Schema only. from_type XOR check (builder XOR client). Append-only. |

### Support / feedback

| Table | Rows | Notes |
|---|---:|---|
| `public.feedback_notes` | 1 | In-app feedback form submissions. |
| `public.support_conversations` | 3 | AI customer support. status (active/resolved/escalated). |
| `public.support_messages` | 14 | Per-conversation. role (user/assistant), tool_calls JSONB. |

### Usage / audit / misc

| Table | Rows | Notes |
|---|---:|---|
| `public.api_usage` | 1,928 | Every Claude / OpenAI call logged with cost. |
| `public.activity_log` | 63 | Generic audit. Used by dashboard "recent activity" feed. |
| `public.notifications` | 78 | User-scoped. RPC-generated by draw/invoice flows. |
| `public.parser_corrections` | 5 | Capture errors in invoice parsing for prompt iteration. |
| `public.org_workflow_settings` | 3 | Per-org gates: require_invoice_date, require_po_linkage, etc. |
| `public.email_inbox` | 0 | Future: email intake parser stub. |
| `public.subscriptions` | 0 | Schema only — duplicates organization.subscription_* fields. Vestigial. |
| `public.selection_categories` | 39 | Design selections (Wave 1B schema). |
| `public.selections` | 0 | Same. |

### Foreign key relationships (high-traffic)

```
jobs ← invoices.job_id, draws.job_id, change_orders.job_id, purchase_orders.job_id, proposals.job_id, budget_lines.job_id, lien_releases.po_id (via PO), internal_billings.job_id
vendors ← invoices.vendor_id, proposals.vendor_id, purchase_orders.vendor_id, lien_releases (via po → vendor)
cost_codes (legacy) ← budget_lines.cost_code_id, invoice_line_items.cost_code_id, purchase_orders.cost_code_id, change_orders (via change_order_budget_lines)
canonical_cost_codes ← org_cost_codes.canonical_code_id, items.canonical_code, pending_cost_code_suggestions.suggested_canonical_code_id
org_cost_codes ← proposal_line_items.org_cost_code_id, pending_cost_code_suggestions.approved_org_cost_code_id
items ← item_aliases.item_id, vendor_item_pricing.item_id, job_item_activity.item_id, item_classification_corrections.corrected_item_id, line_bom_attachments
document_extractions ← document_extraction_lines.document_extraction_id; one-way ref (UUID, no FK) from proposals.source_document_id
draws ← draw_line_items.draw_id, lien_releases.draw_id, draw_adjustments.draw_id, internal_billings.draw_line_item_id
proposals ← proposal_line_items.proposal_id, proposals.converted_po_id (self via PO), converted_co_id (self via CO), superseded_by_proposal_id (self)
purchase_orders ← invoices.po_id, change_orders (via PO), proposal.converted_po_id
change_orders ← invoices.co_id, proposal.converted_co_id
```

### Status_history JSONB schema (consistent across tables)

```jsonb
[
  {
    "who": "<user_uuid>",
    "when": "<ISO8601>",
    "old_status": "<text>",
    "new_status": "<text>",
    "note": "<optional text>"
  }
]
```

Tables with status_history: `invoices`, `draws`, `change_orders`, `purchase_orders`, `proposals`, `lien_releases`, `internal_billings` (some). Helpers in `src/lib/activity-log.ts` append in app code; no triggers.

### Tables that look reused beyond original intent

- `document_extractions` — designed for invoices, generalized for proposals (00076 rename), columns dual-purposed (extraction_prompt_version, target_entity_id).
- `cost_codes` (legacy) — still in use even after `org_cost_codes` was added. Coexist by design until a future consolidation migration.
- `users` (Phase 1) — superseded by `profiles` + `org_members` but still referenced.
- `notifications` — used by both invoice flows and draw flows; the `entity_type` column is the discriminator.

---

## Deliverable 5 — API surface with behavior

119 routes total, surveyed in the API-surface map above. Highlights here. Full per-route inventory was produced inline by the explorer agent and is summarized below.

### Counts by domain

| Domain | Count | Notes |
|---|---:|---|
| cost intelligence | 28 | Largest domain. Codes, items, suggestions, conversions, extraction lines, BOM, recent learnings, verification. |
| invoices | 20 | Action, payment, allocations, line-items, save, parse, import, upload, batch operations. |
| draws | 15 | Action (RPC dispatch), revise, compare, cover-letter, export, lien-uploads, internal-billings, change-orders attachment. |
| jobs | 11 | Health, overview, milestones, etc. |
| admin | 9 | Platform impersonation, integrity, org management. |
| proposals | 6 | Extract, commit, convert-to-po (stub), reject, status. |
| change-orders | 5 | CRUD + status transitions. |
| purchase-orders | 4 | CRUD (largely scaffolded; no production rows). |
| vendors | 3 | List, detail, import. |
| stripe | 3 | Checkout, portal, webhook. |
| support | 3 | Conversations, messages, escalation. |
| feedback | 2 | Notes endpoint. |
| cron | 1 | Overdue invoices digest. |
| auth (signup, onboarding) | ~10 | Bootstrap, invite, accept-invite, set-role. |

### Auth coverage

- 92 routes use `getCurrentMembership()` directly.
- 15 routes use `requireRole(...)` for stronger gating.
- 9 routes use `requirePlatformAdmin()`.
- 12 routes use `getClientForRequest()` (membership + impersonation).
- 2 stateless (csv-parse/xlsx, users/theme cookie).
- 2 use external auth (Stripe webhook signature, cron CRON_SECRET).
- **1 route relies on RLS-only:** `/api/invoices/[id]/docx-html`. **Flagged.** 🚨

### Optimistic locking coverage

10 routes use `expected_updated_at` + `updateWithLock()`:
1. change-orders/[id]
2. cost-intelligence/codes/[id]
3. draws/[id]/action
4. draws/[id]/revise
5. invoices/[id]/action
6. invoices/[id]/payment
7. lien-releases/[id]
8. lien-releases/[id]/upload
9. purchase-orders/[id]
10. vendors/[id]

**Gap:** proposals/commit doesn't take `expected_updated_at`. Already noted.

### Response envelope

- Errors: `ApiError(message, status)` thrown → caught by `withApiError` wrapper → `{ error }` JSON with status code.
- Success: per-route shape (no enforced envelope). Some return data directly, some return `{ ok: true, data }` (older), some return `{ status, action }` (workflow transitions).

Inconsistency is real but doesn't break clients. Standardization is a Phase-4 cleanup item.

### Status codes by frequency (rough)

- 200 — happy path on most routes
- 201 — fewer; some POST creates
- 400 — validation errors
- 401 — unauthenticated
- 403 — wrong role / wrong org
- 404 — entity not found
- 409 — optimistic lock conflict (10 routes) + already-committed (proposals/extract)
- 422 — semantic validation (e.g., negative CO amount, draw with 0 invoices)
- 429 — plan-limit exceeded (ingest, parse)
- 500 — internal errors / RPC failures

### Tests on routes

**Approximately none.** I see 39 test files in `__tests__/`, but only a handful are about route behavior (`api-cost-code-suggestions.test.ts`, `api-cost-intelligence-codes.test.ts`, `api-ingest.test.ts`, `api-proposals-commit.test.ts`, `api-proposals-extract.test.ts`). Most tests are migration fences or component fences.

The route tests are structural (they grep the route file's source and assert imports/auth checks/status codes), not runtime. There is no integration test that hits a route with HTTP and asserts behavior.

This is the single largest test gap in the codebase.

### Suspicious patterns and stale routes

From the API surface agent's audit:
- **`/api/invoices/[id]/docx-html`** — RLS-only (already flagged).
- **`/api/financial`, `/api/financials`** — legacy redirect endpoints. Could probably be removed.
- **No routes have hardcoded ORG_ID.** SEC-C-2 from REVIEW_FINDINGS is closed (verified in current code).
- **Some routes overlap functionality:** `/api/invoices/save` and `/api/invoices/[id]` both write to invoices via PATCH-like operations. The save route was intended for upload+save in one shot; the `[id]` route for individual edits. Both work; mild duplication.

### Routes that look stale / not used

- `/api/cron/overdue-invoices` — dormant, no scheduled trigger.
- Several `/api/admin/platform/*` GET endpoints exist but the corresponding UI panels are placeholders.
- `/api/dashboard` is heavily used; `/api/jobs/health` is used; many `/api/jobs/[id]/overview` calls per dashboard load.

---

## Deliverable 6 — UI surfaces with patterns

62 navigable routes. The full map is in the UI agent's table; key insights below.

### The "gold-standard review pattern"

Reference: `/invoices/[id]/page.tsx` (2,229 LOC, the largest non-stub page in the app).

Layout:
- 50/50 grid (md+, single-column on mobile)
- LEFT: file preview (PDF rendered via react-pdf with iframe fallback)
- RIGHT: details panel + side strip (action buttons, payment panel)
- BOTTOM: status timeline (rendered from status_history JSONB) + edit history (rendered from pm_overrides + qa_overrides)
- Action strip: Approve / Partial / Hold / Deny / Request Info / Kick Back (role-gated, status-gated)
- `print:hidden` on chrome; print view shows just the invoice + extracted data

Surfaces that should follow it:

| Surface | Follows? | Notes |
|---|---|---|
| `/invoices/[id]` | YES | Reference standard |
| `/draws/[id]` | PARTIAL | Variant pattern — G702 summary on left instead of file preview, tabs for compare/cover/lien-uploads/internal-billings/change-orders. Print view exists. |
| `/proposals/review/[extraction_id]` | NO | Single-column form. ProposalFilePreview exists but is not in a left/right split. **Tech debt.** |
| `/change-orders/[id]` | NO | Inline status + line items. No file preview. No timeline beyond status history. **Tech debt.** |
| `/jobs/[id]/budget` | NO | Massive page (1,514 LOC). Not a review surface, but shares characteristics. Print view exists. |

The proposal review page is the most important deviation. The Phase 3.4 ship was a milestone (the cache + 11 components are correct), but the layout is a single column. Refactoring it to the gold-standard pattern is a natural Phase-3.5 wave.

### Pages with print views

Three pages have explicit `print:` styling:
- `/invoices/[id]` (gold-standard)
- `/draws/[id]` (G702 export view)
- `/jobs/[id]/budget` (budget report)
- `/proposals/review/[extraction_id]` (just shipped — Phase 3.4 print-view static summary, commit `be4b30e` 2026-04-28)

The remaining 58 pages don't have print views. Most don't need them; some (change-orders, financials, vendors detail, admin/feedback detail) probably should.

### Vestigial / stub pages

The UI agent classified ~32 pages as vestigial — the breakdown:

**Pure redirects (12):**
- `/admin → /settings/company`
- `/financial`, `/financials → /invoices`
- `/cost-intelligence/codes → /cost-intelligence`
- `/cost-intelligence/suggestions → /admin/platform/cost-intelligence`
- `/invoices/[id]/qa → /invoices/[id]`
- Several `/settings/*` redirects

**Stubs / placeholder UIs (20):**
- `/operations` (25 LOC, "coming soon")
- `/jobs/[id]/activity` (47 LOC, "coming soon")
- Some cost-intelligence sub-pages with mostly stub UI
- `/admin/platform/*` landing pages

These are tech debt to clean up. Some were once full features that got gutted; some were always placeholders.

### Mobile responsiveness

Rough heuristic from the UI agent:
- ~70% of pages have md/lg breakpoints
- Invoices, draws, dashboard, cost-intelligence, vendors, jobs list — responsive
- Proposals review — desktop-only (zero md/lg breakpoints)
- Some admin pages partial

Mobile is OK on the financial-PM-on-jobsite golden path. Less OK on admin and proposals.

### Domain breakdown of pages

| Domain | Pages | Status |
|---|---:|---|
| invoices | 8 | Active |
| jobs | 11 | Active |
| draws | 3 | Active |
| change-orders | 4 | Active |
| admin | 13 | Mixed (many redirects to settings layout) |
| cost-intelligence | 8 | Active (some sub-pages stubs) |
| vendors | 2 | Active |
| proposals | 1 | Active (just shipped) |
| financials | 3 | Mixed (legacy redirects + aging-report) |
| settings | 11 | Mixed (many separate route files; consolidation candidate) |
| purchase-orders | 2 | Active but no rows |
| auth | 3 | Active |
| onboard | 1 | Active |
| pricing | 1 | Active |
| public | 1 | Active |
| other | 4 | Mixed (dashboard, operations, nw-test) |

---

## Deliverable 7 — Architectural decisions baked into code

Each is a decision the existing code depends on. If you change one, things ripple.

### A. Hot-path matcher boundary (4 files, byte-identical)

**Decision (per addendum-B).** These four files are byte-identical between branches and any change requires a deliberate, isolated commit.

| File | LOC | Role |
|---|---:|---|
| `src/lib/cost-intelligence/match-item.ts` | 906 | 4-tier item matcher |
| `src/lib/cost-intelligence/commit-line-to-spine.ts` | 524 | Commit verified line → vendor_item_pricing |
| `src/lib/cost-intelligence/extract-invoice.ts` | 914 | Orchestrator |
| `src/lib/cost-intelligence/correct-line.ts` | 117 | PM correction handler |

**Total: 2,461 LOC.** Heavy code with deep coupling to the items registry, embedding pipeline, and pricing history.

**What depends on it.** Every invoice extraction. Every cost intelligence write path. The 36/36 classifier eval doesn't directly cover this code, but a regression here breaks downstream cost intelligence silently.

**What cascades if changed.** Cost code matching accuracy, vendor pricing accumulation, item embedding, alias library growth.

**Documented.** Addendum-B (lines 62-86) is the canonical doc. Migration headers reference it. CLAUDE.md doesn't yet — it should.

### B. Classifier eval baseline (36/36 + 2 known flakes)

**Decision.** Document classifier must achieve 36/36 passes; 35/36 with one of {Home Depot receipts, Dewberry-Gilkey landscaping} failing is allowlisted.

**Enforced in.** `__tests__/document-classifier.test.ts:54-95`.

**What depends on it.** Every classification routes a document into the right entity-creation pipeline. A regression on classification cascades.

**What cascades if changed.** Either tighten (accept fewer flakes, more rigor) or loosen (slower iteration, more bug-tolerance). Probably tightens over time as the prompt matures.

**Documented.** In test file + linked GitHub issues #28 and #30.

### C. Multi-tenancy via `org_members.user_id` RLS

**Decision.** Every tenant table's RLS resolves through `org_members`. `getCurrentMembership()` reads the same table.

**Enforced in.** Every migration that creates a tenant table (00016 onward), `src/lib/org/session.ts`, every API route via `getCurrentMembership()`.

**What depends on it.** Tenant isolation. Single source of truth for "who's in which org."

**What cascades if changed.** All RLS policies, all auth code, all impersonation logic.

**Documented.** CLAUDE.md "Architecture Rules" + `src/lib/org/session.ts` header + every RLS migration.

### D. Document classification → extraction → commit pipeline

**Decision.** Three-stage pipeline with `document_extractions` as the universal mediator row. Stage 1 sets `classified_type`; Stage 2 sets `extracted_data` + lines; Stage 3 sets `target_entity_id`.

**Enforced in.** Migration 00076 (rename + new columns), 00081 (invoice_id nullable), 00091 (cache columns).

**What depends on it.** All extraction surfaces. Adding a new classified_type means adding columns/values, not new tables.

**What cascades if changed.** Every extraction route. Every UI that loads "the document this entity came from."

**Documented.** Migration 00076 has a 100-line header documenting the rationale.

### E. NAHB canonical cost code spine + 3-layer architecture

**Decision (per addenda A and B).** Three layers: canonical (read-only NAHB spine), org_cost_codes (per-org map), display (UI). New tenants don't have to learn NAHB. CSI deferred but schema-supported via `spine` column.

**Enforced in.** Migrations 00082 (canonical), 00083 (org_cost_codes), 00087 (pending_cost_code_suggestions), `src/lib/cost-intelligence/queries.ts`.

**What depends on it.** Cost intelligence queries (which canonical code is this?), pricing rollups, future cross-org analytics (when enabled).

**What cascades if changed.** Pricing intelligence accuracy. Org migration paths.

**Documented.** Addenda A and B + migration headers.

### F. Items registry + embedding-on-create narrow scope (deferred)

**Decision (per addendum-B).** The existing `items` table is the canonical item registry. Embedding column added; embedding-on-create wiring deferred to a future phase.

**Enforced in.** Migration 00085 (alter items + index), `src/lib/cost-intelligence/embeddings.ts`, NOT in `commit-line-to-spine.ts` yet.

**What depends on it.** The cost-intelligence-as-moat thesis. Without embedding-on-create, items only get embeddings via manual backfill — the moat doesn't compound.

**What cascades if changed.** Wiring it on the proposal commit path is the next critical wave. Every other extractor (CO, vendor, budget) will eventually need the same wiring.

**Documented.** Addendum-B explicitly + scripts/seed-canonical-items.ts as the proof.

### G. Status history JSONB on every workflow entity

**Decision.** Every workflow entity carries `status_history JSONB NOT NULL DEFAULT '[]'::jsonb`. App-layer append. No separate audit table for state transitions.

**Enforced in.** Migrations 00001 (invoices, draws, COs, POs initial), every workflow-table migration since.

**What depends on it.** Audit timelines, dispute resolution, compliance reporting.

**What cascades if changed.** Every audit timeline UI. Every "who approved this when" query.

**Documented.** CLAUDE.md "Architecture Rules" + many migration headers.

### H. Print-area / print-only static block pattern

**Decision.** Use `print:hidden` Tailwind classes to hide chrome. Build a print-only static summary block in detail pages. No PDF export required for printability — browser print-to-PDF works.

**Enforced in.** `/invoices/[id]`, `/draws/[id]`, `/jobs/[id]/budget`, `/proposals/review/[extraction_id]` (latest, commit `be4b30e`).

**What depends on it.** Manual print workflows when official PDF export isn't ready.

**What cascades if changed.** Browser-print fidelity.

**Documented.** Inline comments in `/invoices/[id]` and `/proposals/review` files.

### I. Save / Convert to PO / Convert to CO / Reject action set

**Decision.** Proposal review surface has 4 top-level actions. Save = commit. Convert to PO = stub returning 501 (Phase 3.5). Convert to CO = disabled (future). Reject = mark extraction `rejected`.

**Enforced in.** ReviewManager + ProposalReviewHeader + `/api/proposals/commit`, `/api/proposals/[id]/convert-to-po` (stub), `/api/proposals/extract/[extraction_id]/reject`.

**What depends on it.** Proposal lifecycle. The next phase (3.5) will turn Convert to PO into the full PO-from-proposal flow.

**What cascades if changed.** Every place that loads a proposal expects to render those four actions.

**Documented.** Test fences in `__tests__/api-proposals-commit.test.ts` and `__tests__/api-proposals-extract.test.ts`.

### J. Cache-on-extraction pattern (Phase 3.4)

**Decision.** `document_extractions.extracted_data` JSONB caches the full extraction envelope. `extraction_prompt_version` is the cache key. Bumping the constant in code auto-busts every cached row on next read.

**Enforced in.** Migration 00091, `/api/proposals/extract/route.ts:63-160`.

**What depends on it.** Proposal review performance + cost. Future CO/vendor/budget extractors will use the same pattern.

**What cascades if changed.** Cache invalidation strategy (today: nuclear, on prompt bump). Future phases may want field-level invalidation.

**Documented.** Migration 00091 header + comments in the route.

### K. Other load-bearing decisions worth naming

1. **Soft-delete only.** No hard DELETE in app code. Enforced by convention; no DB-level prevention.
2. **Cents only.** Money handled in BIGINT cents end-to-end.
3. **TypeScript strict, no `any`.** Test fence in `queries.test.ts` greps for `: any` and fails. The fence is on a single file but the rule is project-wide per CLAUDE.md.
4. **R.23 RLS conventions.** New tables match codebase precedent; deviations are documented in the migration header.
5. **Service-role fallback for reads.** Documented in route-sweep.md; applied on 6+ routes.
6. **CHECK constraints over enum types.** Adding a status value is an ALTER, not a TYPE migration.
7. **Trigger-maintained caches with exception clause.** CLAUDE.md "computed columns maintained by triggers are an exception when read-time recompute would be prohibitively expensive." Canonical example: `jobs.approved_cos_total` (trigger from migration 00042).
8. **`org_id` always derived from auth, never from request body.** No grep hits for the bad pattern.
9. **Single-org per user.** Load-bearing for `getCurrentMembership` simplicity.
10. **`extraction_prompt_version` is dual-purpose.** Either classifier-vN or proposal-extractor-vN, depending on which stage wrote the row. (Worth refactoring to two columns at consolidation time.)

---

## Deliverable 8 — Gaps between vision and reality

Reading Jake's vision against the shipped code. The vision items are derived from CLAUDE.md, BRAND.md, the rebuild plan, amendment-1, and the stated four-pillar moat thesis (universal ingestion + cost intelligence + schedule intelligence + AI as bookkeeper).

### Vision items 1–20 (best-effort enumeration of stated goals)

| # | Vision item | Source | Reality | Gap |
|---|---|---|---|---|
| 1 | Universal document ingestion (every construction doc type) | amendment-1 §moat-thesis | Classifier ships 10 types; extractors live for invoice + proposal | 4 extractors not started (CO, vendor, budget, historical draw) |
| 2 | Cost intelligence that compounds | amendment-1 §moat-thesis | Spine + 4-tier matcher live for invoices; **deferred for proposals** | Embedding-on-create on proposal commit is the unblocker |
| 3 | Three-layer cost code architecture (canonical + org map + display) | addendum-A | Schema in place; legacy `cost_codes` table coexists | Consolidation migration pending |
| 4 | Schedule intelligence (Phase 4) | amendment-1 §Phase 4 | Schema fields ship from Phase 3.5 onward (estimated_start_date, etc.); not used yet | Phase 4 work; deferred until 3.5+ |
| 5 | AI as bookkeeper for small remodelers | amendment-1 §moat-thesis | Cost code matching exists; auto-commit gate exists; live experience untested | Full bookkeeping experience is Phase 4+ |
| 6 | Day-1 onboarding paths (Buildertrend / Excel / greenfield) | amendment-1 §day-1-experience | Greenfield works (signup → org → first job). Buildertrend export and Excel migration **not started.** | Both migration paths are Phase 4 |
| 7 | Cross-org data sharing OFF (private by org) | amendment-1 §cross-org | Architecture supports it; queries are org-scoped today; never enabled | None — held |
| 8 | NAHB canonical (CSI deferred) | addendum-A | 354 NAHB rows seeded. CSI deferred. | None — held |
| 9 | PMs cannot directly create cost codes | amendment-1 §3.3 + 00087 | UI gates, API gates, RLS gates. Pending suggestions table. | None — held; clean implementation |
| 10 | Embedding-on-create narrow scope per addendum-B | addendum-B | Phase 3.3 shipped foundation only. **Wiring deferred.** | Phase 3.4+ (still deferred after 3.4 ship) |
| 11 | Proposal extraction with full review form | amendment-1 §3.4 | **Shipped.** 11 components, cache, action strip, print view. | Refactor to gold-standard layout (Phase 3.x maintenance) |
| 12 | PO generation from proposal (Phase 3.5) | amendment-1 §3.5 | Stub returning 501. PO tables exist but empty. | Phase 3.5 |
| 13 | Invoice ↔ PO matching + variance detection (3.6) | amendment-1 §3.6 | Absent. Schema fields not added. | Phase 3.6 |
| 14 | CO workflow (forward + retroactive) — Phase 3.7 | amendment-1 §3.7 | Forward CO mostly shipped. Retroactive + paper_lag_days metric not shipped. | Phase 3.7 |
| 15 | Vendor extraction (W-9, COI) — Phase 3.8 | amendment-1 §3.8 | Not started. | Phase 3.8 |
| 16 | Budget + historical draw extraction — Phase 3.9 | amendment-1 §3.9 | Not started. | Phase 3.9 |
| 17 | Document review queue UI — Phase 3.10 | amendment-1 §3.10 | Partial: cost-intelligence verification queue exists for invoices. Cross-document classifier triage not built. | Phase 3.10 |
| 18 | Client portal (90-day sliding window, hashed token) | migration 00074 | Schema only; no UI; no production rows. | UI work — likely Phase 4 |
| 19 | QuickBooks integration | CLAUDE.md "Phase 4" | `qb_bill_id` columns exist. No code. | Phase 4 |
| 20 | Email intake parser (`accounting@rossbuilt.com`) | CLAUDE.md "Phase 4" | `email_inbox` table exists, empty. No parser. | Phase 4 |

### Other gaps surfaced by the audit (not numbered in the vision but implied)

| Gap | Significance |
|---|---|
| Plan-limits gating inconsistent across token-consuming routes | Subscription enforcement leaks |
| Trial expiry not auto-enforced | Orgs in `trialing` past `trial_ends_at` keep working |
| `cleanup_stale_import_errors()` exists but isn't scheduled | Orphan storage objects accumulate |
| Classifier eval requires manual run | Regression risk grows with prompt iteration |
| One API route lacks explicit auth (`/api/invoices/[id]/docx-html`) | Defense-in-depth gap |
| Wizard draft cleanup never happens | Stale draft draws in DB |
| Draws have no PDF export, only Excel | Banks may reject |
| Three-way matching (invoice ↔ PO ↔ vendor) absent | Manual diligence required |
| AIA G702/G703 form (real form, not Excel) absent | Future, but eventual |
| Source-line highlighting (per `diagnostic-source-highlighting.md`) | PM trust feature, blocked on positional extraction |
| Service-role write shim for impersonation not built | Manual SQL during cross-org repairs |
| `purchase_orders` and `po_line_items` tables empty in production | Cleanup or fill via Phase 3.5 |
| Two cost code registries coexist | Consolidation needed |
| `users` (Phase 1) and `profiles` and `auth.users` all coexist | Cleanup needed |
| `subscriptions` table exists, never used | Vestigial — duplicates organizations.subscription_* |
| `email_inbox` table empty | Vestigial unless Phase-4 email intake ships |

### What's *under-promised* in the docs

This is rare but worth flagging — places where the code is more advanced than what the docs would suggest.

1. **Approval chains (migration 00070).** Schema, default seeding via trigger, and 18 live rows across 3 orgs. Not in amendment-1's phase list, not in CLAUDE.md, but clearly part of the platform. Suggests it shipped between the original plan and the amendment.
2. **Pricing history (migration 00073).** Trigger-driven, append-only, 126 live rows. The R.23-divergence design (1-policy RLS for audit spine) is documented in the migration but not in the rebuild plan.
3. **Line cost components + BOM (migrations 00056, 00058).** 285 live rows. The hybrid component breakdown is sophisticated and absent from the high-level docs.
4. **Retainage at the milestone level (migration 00071).** Schema only, 0 rows, but the design supports fixed-price builders even though Ross Built is cost-plus.
5. **Client portal architecture (migration 00074).** Hashed tokens, sliding window, append-only messaging — well-thought-out and waiting for UI.

The codebase is more capable than any single planning doc reflects. The canonical plan should consolidate.

---

## Deliverable 9 — Honest assessment

What I'd tell a new engineer over coffee about this codebase, without filtering for politeness.

### What's genuinely good

1. **The discipline of phase exit gates is real.** `qa-reports/` has 42 files, all in the same template, each with specific evidence attached to specific commits. This is the most important quality artifact in the repo. It's how Phase 3.4 just shipped without breaking everything else.

2. **Migration ADRs in headers.** Several recent migrations (00069, 00071, 00073, 00074) have multi-paragraph commentary at the top documenting the precedent (R.23), the divergence rationale, the FK/RLS interactions, and even the GitHub issues that surfaced the design. This is exceptional. New tables don't drop into the schema without a paper trail.

3. **Cost-instrumented from day one.** Every Claude / OpenAI call writes to `api_usage` with model, tokens, cost, status. As of right now total spend is $37.88. You can answer "how much did Phase 3.4 cost us in tokens?" by querying the date range. That's a rare property.

4. **Multi-tenancy is multi-layered.** UI + API + RLS, with platform_admin escape hatch and audit trail. The 8 platform_admin_audit rows are real history, not fixtures. Impersonation is real and bounded.

5. **The cache architecture in Phase 3.4 is correct and elegant.** Single column (`extracted_data`), single version key (`extraction_prompt_version`), bump-the-constant-to-bust. No extra tables, no complex invalidation. The auto-bust is observable in production logs. This will get reused for every other extractor — it's foundational.

6. **The 4-tier matcher (`match-item.ts`) is sophisticated and well-bounded.** Tier 1 (exact alias) is instant; Tier 2 (trigram) is fast; Tier 3 (AI semantic) is the only Claude call; Tier 4 (propose new) is the cold-start path. The boundary is byte-protected. This is the architectural backbone for cost intelligence.

### What's genuinely concerning

1. **🚨 Embedding-on-create deferred but not sequenced.** Addendum-B says deferred to "a later phase, to be scoped when the natural touch point arrives." Phase 3.4 was the natural touch point. It shipped without the wiring. The cost-intelligence-as-moat thesis depends on it. Continuing without sequencing this is a slow-burning risk: every proposal that commits today doesn't compound the moat.

2. **🚨 The classifier eval requires manual run.** It's gated `RUN_CLASSIFIER_EVAL=1`, costs ~$0.50 per run, takes 4-5 minutes, and depends on the operator to run it before merging cost-intelligence changes. CI doesn't run it. Phase iteration on the prompt is happening regularly. The 36/36 fence will hold only as long as Jake remembers to run it.

3. **🚨 The proposal commit path has no transaction and no optimistic lock.** Phase 3.4 just shipped. The route does sequential writes, soft-deletes on failure, and doesn't take `expected_updated_at`. Two simultaneous commits race. A mid-write process kill leaves inconsistent state. Today the population is small enough that this hasn't bitten; at scale it will.

4. **🚨 `/api/invoices/[id]/docx-html` has no explicit auth.** RLS-only. Defense-in-depth gap. 5-minute fix; should be done before more dogfooding.

5. **🚨 Trial expiry is not enforced anywhere.** The two test orgs have `trial_ends_at` of 2026-04-29 / 2026-04-30 (today and tomorrow). They will keep working past expiry. Same for any future paying customer's trial. The Stripe webhook flips status only when a subscription event fires, not on time.

6. **🚨 Plan-limits gating is inconsistent.** Some token-consuming routes check; others don't. A motivated user (or a buggy client retry loop) can run up the bill on routes that don't check. ROI on auditing this is high.

7. **🚨 Surprise: the `extraction_prompt_version` column is dual-purposed.** Same column carries either the classifier prompt version OR the proposal extractor prompt version, depending on which stage wrote the row last. Today it works because no migration ever rewinds the row, but it's a subtle dual-purpose field. A future bug — an extraction that needs both versions — would have nowhere to write.

8. **🚨 Surprise: 32 of 62 UI pages are vestigial (redirects or stubs).** Lots of them have 200+ LOC despite being placeholders. This was probably a "set up the route then come back to it" approach. It's now a navigation maze for new contributors.

9. **🚨 Surprise: the `purchase_orders` table has zero rows in production.** PO generation deferred per amendment-1. The UI surfaces (`/jobs/[id]/purchase-orders`, `/jobs/[id]/purchase-orders/new`) exist anyway. PMs see "No purchase orders" and have no way to create one with real data. Either remove from nav or mark as Phase 3.5 work clearly.

10. **🚨 Surprise: there are 39 tests but almost none of them test API routes at runtime.** The route tests are structural fences — they grep source code for patterns. No HTTP integration tests. The classifier eval is the only true runtime test. This is the single largest test gap.

11. **🚨 The "two cost code registries" gap has been deferred for too long.** `cost_codes` (238 rows, Phase 1) and `org_cost_codes` (12 rows, Phase 3.3) coexist. Every cost code lookup has to know which table. The proposal commit route does dual-write to bridge, but the bridge is silent on failure. Consolidation should be on the canonical plan.

### What's surprising in a good way

1. **The migration list is shockingly clean.** 91 numbered migrations, with `.down.sql` paired from 00060 onward. Most have idempotent `IF NOT EXISTS` guards. There's a deliberate rollback (00037) when Phase B was applied to dev but not committed. This kind of git-discipline-on-the-database is rare.

2. **The classifier eval `KNOWN_BOUNDARY_FLAKES` allowlist is the right answer to a real problem.** Two fixtures genuinely sit on the boundary between classes. Pinning them in the test, with GH issue links, is better than either ignoring the issue or pretending the classifier is deterministic.

3. **Cost intelligence migration headers (00069, 00071, 00073) read like ADRs.** The level of "why we chose this RLS shape, here's the precedent, here's the divergence rationale, here's the runtime quirk we noticed, here's the GH issue tracking the next discussion" is the gold standard.

4. **Phase 3.4 shipped 16 commits in 8 hours on 2026-04-28.** The git log shows component-by-component commits (`ProposalReviewHeader`, `ProposalFilePreview`, `ProposalLineItemRow`, ...). Each was atomic. This is what disciplined incremental delivery looks like.

5. **`pricing_history` is append-only by design.** R.23-divergence with a 1-policy RLS shape (SELECT only, no INSERT/UPDATE/DELETE policies) is exactly right for an audit spine. The migration header explains the reasoning.

### What I'd push back on

1. **"All Critical / High items resolved" in REVIEW_FINDINGS** is *almost* true but the docx-html route is still unguarded. The review's resolution grid is dated 2026-04-20; the audit at the top of REVIEW_FINDINGS notes it as completed. That's stale on at least one finding.

2. **`DEFERRED_FINDINGS.md` should be retired.** Its peer `REVIEW_FINDINGS.md` has the resolution grid; the deferred items are mostly closed; the open ones (rate limiting, role matrix) deserve their own current tracker, not a 467-line doc that pre-dates the fixes.

3. **The 8 root-level diagnostic markdowns** (`diagnostic-naming.md`, `e2e-findings.md`, etc.) should be folded into the canonical plan as outstanding work or moved to `docs/diagnostics/` and dated. Right now they exist as one-shot artifacts at the repo root.

4. **The NAV_REORG_PLAN should either be executed or retired.** Approved 2026-04-18, never shipped. The current nav inventory says something different. Don't leave plans-that-aren't-current as load-bearing planning docs.

5. **The two test orgs (`8j Test Company`, `QA Test Company`) have expired or expiring trials right now.** Either delete them or extend them — they're going to start showing as "expired" in the platform admin UI tomorrow.

### 🔥 Urgent fixes (do not fix in this audit; flag only)

These are the items I'd surface to a CTO before merge:

1. **🔥 `/api/invoices/[id]/docx-html` lacks explicit auth.** RLS is the only guard. 5-minute fix. Should not wait for the next phase.

2. **🔥 Trial expiry is not enforced.** Two test orgs are at or past `trial_ends_at` right now. Production launch with this would silently let lapsed accounts continue using the platform. Either a middleware gate or a cron flip is needed before paid GA.

3. **🔥 The proposal commit route is not transactional and not lock-protected.** A simultaneous commit can produce an orphaned proposal pointing at an extraction that's been claimed by another commit. Today's load is low; the bug is real.

4. **🔥 Plan-limits gating is incomplete.** Token-consuming routes that skip the check can be exploited by a buggy client or a malicious user to drive up costs. Inventory + add gates.

None of these are likely to bite in dogfood; all of them are likely to bite at scale or in adversarial conditions.

---

## Deliverable 10 — Proposed consolidated plan structure

Not the full plan. The TOC for what the canonical plan should contain after this audit. I'll keep it tight; the plan itself is Jake's next session.

### Proposed structure: `docs/nightwork-plan-canonical-v1.md`

**Estimated total length:** 6,000–9,000 words / 25–35 pages. Big enough to cover everything, small enough to actually re-read.

```
1. Identity, mission, four-pillar moat thesis            (~600 words)
   1.1 What Nightwork is
   1.2 Who Ross Built is, who the broader market is
   1.3 The four moat pillars (universal ingestion, cost intel,
       schedule intel, AI-as-bookkeeper)
   1.4 Cross-org data: explicitly OFF
   feeds: BRAND.md, amendment-1 §moat-thesis, CLAUDE.md "What This Is"
   retires: nothing

2. Standing rules (R.1–R.23) + meta-process               (~500 words)
   2.1 The 23 standing rules from rebuild-plan.md Part R
   2.2 Exit-gate format (G.3)
   2.3 QA report convention
   2.4 Test fence convention
   feeds: rebuild-plan.md Part R + Part G
   retires: nothing (Part R + G stay verbatim)

3. Architecture rules                                     (~600 words)
   3.1 Multi-tenancy (org_members anchor)
   3.2 Soft-delete only
   3.3 Cents-only money
   3.4 Status_history JSONB
   3.5 RLS conventions (R.23 precedent, 3-policy default,
       documented divergences)
   3.6 Optimistic locking (updateWithLock)
   3.7 No `any` (test fence)
   3.8 Trigger-maintained caches as exception
   3.9 SECURITY DEFINER patterns
   3.10 The hot-path matcher boundary (4 files)
   feeds: CLAUDE.md "Architecture Rules", REVIEW_FINDINGS resolution
          grid, addendum-B
   retires: nothing (CLAUDE.md remains; this consolidates)

4. Data model — current state                             (~1500 words)
   4.1 Auth / org / permissions
   4.2 Jobs / vendors
   4.3 Cost codes (3-layer + legacy bridge)
   4.4 Budgets
   4.5 POs / COs / internal billings
   4.6 Invoices
   4.7 Draws / liens / payments
   4.8 Proposals
   4.9 Cost intelligence (items / aliases / pricing /
       extractions / lines / components)
   4.10 Approvals / milestones / portal / support / feedback
   4.11 Status history JSONB shape
   4.12 Tables marked deprecated / vestigial
   feeds: CLAUDE.md "Data Model", every migration header,
          this audit's Deliverable 4
   retires: nothing (current state is current state)

5. Document classification + extraction pipeline          (~700 words)
   5.1 The universal pattern: classify → extract → commit,
       mediated by document_extractions
   5.2 The 36/36 + 2-flake eval baseline
   5.3 The cache-on-extraction pattern (extracted_data +
       extraction_prompt_version)
   5.4 Per-classified-type extractors: invoice (live),
       proposal (live), CO/vendor/budget/historical (Phases 3.7-3.9)
   5.5 Shared review-form pattern (gold-standard +
       deviations to be brought into line)
   feeds: amendment-1 §architectural-pattern, addendum-B,
          this audit's Flow A + Flow B
   retires: nightwork-rebuild-plan.md Part 5 sections 3.3-3.10

6. Cost intelligence subsystem                            (~800 words)
   6.1 The compounding-pricing-database thesis
   6.2 NAHB canonical spine (CSI deferred)
   6.3 Org cost code map (Layer 2)
   6.4 Items registry + pgvector embeddings
   6.5 The 4-tier matcher (boundary-protected)
   6.6 Embedding-on-create wiring (CRITICAL — currently deferred)
   6.7 Verification queue + PM correction loop
   6.8 Pricing history append-only audit
   feeds: amendment-1 §moat, addenda A and B,
          this audit's Flow E
   retires: nothing — this is the consolidated authoritative source

7. Phase plan (current state + roadmap)                   (~1500 words)
   7.1 Shipped: Phases 1-3.4 (with QA-report cross-references)
   7.2 In progress: nothing
   7.3 Next: Phase 3.5 (PO from proposal) and the embedding-on-
       create wiring (concurrent? sequential?)
   7.4 Future: Phases 3.6-3.10
   7.5 Phase 4 placeholder (schedule intelligence, QB, email
       intake, daily logs, client portal UI, onboarding paths)
   7.6 Branch / milestone breakdowns
   feeds: amendment-1 §re-scoped-phase-list, this audit's
          Deliverable 8
   retires: nightwork-rebuild-plan.md Part 5 phase list
            (in favor of amendment-1 ordering)

8. Operations playbook                                    (~500 words)
   8.1 Platform admin (grant, impersonation, audit)
   8.2 Cost monitoring (api_usage queries)
   8.3 Trial / billing operations
   8.4 Incident handling (Sentry, classifier regressions,
       cost-overrun alerts)
   8.5 Backup / restore / migration discipline
   feeds: docs/platform-admin-runbook.md, CLAUDE.md
          "Platform admin" section, route-sweep.md
   retires: nothing (platform-admin-runbook stays as a deeper
            reference)

9. Outstanding tech debt + known issues                   (~800 words)
   9.1 Two cost code registries (consolidation pending)
   9.2 docx-html auth gap
   9.3 Trial expiry not enforced
   9.4 Plan-limits gating coverage
   9.5 Proposal commit transactionality
   9.6 Classifier eval not on a schedule
   9.7 32 vestigial UI pages
   9.8 No HTTP integration tests
   9.9 PO scaffolding + tables but no production rows (resolved
       by Phase 3.5 OR remove from nav)
   9.10 Embedding-on-create deferral (item moves to roadmap section)
   feeds: this audit's Deliverable 9
   retires: critical-gaps.md, REVIEW_FINDINGS.md (resolution grid),
            DEFERRED_FINDINGS.md, the 4 root-level diagnostic-*.md
            files, e2e-findings.md, route-sweep.md (folded as ops
            history), smoke-test-results.md, migration-preview.md

10. Glossary + appendix                                   (~300 words)
    10.1 Glossary of terms (G702/G703, NAHB, CSI, retainage,
         conditional/unconditional lien, etc.)
    10.2 Appendix A: full migration list (link to migrations dir)
    10.3 Appendix B: cost rollup query template (api_usage)
    10.4 Appendix C: where the 36/36 fixtures live
    feeds: nothing new
    retires: nothing
```

### What gets retired into history

- `critical-gaps.md` (April 16) — most items addressed.
- `REVIEW_FINDINGS.md` (April 20) — resolution grid is captured in §9 of canonical.
- `DEFERRED_FINDINGS.md` (April 20) — open items move to §9; closed items archived.
- The 4 root-level `diagnostic-*.md` files — open items move to §9 as named gaps.
- `e2e-findings.md`, `route-sweep.md`, `migration-preview.md`, `smoke-test-results.md` — captured as ops history; pointers from §9 into the QA reports for detail.
- `docs/QA-RESULTS.md` (April 15) — superseded by `qa-reports/`.
- `docs/NAV_INVENTORY.md` and `NAV_REORG_PLAN.md` — either roll the reorg into §7 phase plan and execute, or retire NAV_REORG and accept current inventory as the target.

### What stays as canonical alongside the consolidated plan

- `docs/nightwork-plan-canonical-v1.md` (the new doc).
- `docs/canonical-codes/nahb-2024.csv` (data file).
- `docs/platform-admin-runbook.md` (deep reference for operations).
- `docs/BRAND.md` (marketing/voice).
- `qa-reports/qa-branch{N}-phase{M}.md` (per-phase audit trail; Don't ever consolidate these).
- All 91 migrations + `.down.sql` (the schema's source of truth).
- `__tests__/` (test fences continue).
- `CLAUDE.md` (operational constitution; reduced if redundant with §3 of canonical, otherwise kept).

### Recommended ordering rationale

The proposed TOC starts with identity (why), proceeds to discipline (rules), then architecture (how-system-is-shaped), then data + pipeline + cost intel (what-the-system-does), then roadmap + ops + tech debt (current-state). This matches the order a new engineer would want to read it: who, why, how, what, then where-we-are.

The biggest substantive consolidation is collapsing the original rebuild plan's Phase 3.3-3.10 (Part 5) and amendment-1's re-scoped phase list into a single roadmap (§7). The amendment supersedes the original; the canonical plan should reflect that without keeping the older phasing alive.

The biggest stylistic consolidation is folding 8 root-level diagnostic markdowns into §9 of the canonical plan, with pointers into archived-history if more detail is needed.

---

## Closing

This is a serious system. The discipline is real (R.1–R.23, exit gates, migration ADRs, api_usage instrumentation, multi-layer auth). The gaps are mostly known and tracked, with two notable exceptions: embedding-on-create deferred-without-sequencing is a strategic risk for the moat thesis, and the docx-html auth gap is a tactical risk that has slipped through cycles of audit.

If the canonical plan is built on the structure above, a new engineer can come in cold and be productive in a week. The QA-report archive is the historical record; the canonical plan is the present-tense source of truth; the migrations remain the schema's truth.

I have not changed any code. The only artifact in this branch is this report.
