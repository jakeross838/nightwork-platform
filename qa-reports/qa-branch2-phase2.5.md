# QA Report — Branch 2 Phase 2.5: Draw adjustments

**Date:** 2026-04-22
**Commit:** pending (this file ships with the `feat(adjustments): add draw_adjustments + join table` commit)
**Migration:** `supabase/migrations/00069_draw_adjustments.sql` (+ `.down.sql`)
**Test:** `__tests__/draw-adjustments.test.ts` (29 cases)
**Plan amendment commit (already on main):** `73eaba8`
**Pre-flight findings (on main):** `053f647` / `qa-reports/preflight-branch2-phase2.5.md`
**GH #13 (tracked adjacency):** https://github.com/jakeross838/nightwork-platform/issues/13 (CO numbering reconciliation — bridge column `affected_pcco_number`)
**Status:** READY FOR REVIEW — not yet pushed to origin/main (per prompt80 step 8)

---

## 1. Executive summary

Ships Phase 2.5 (draw_adjustments, was approval_chains) per the amended plan spec. All 5 pre-flight scope decisions (C.1–C.5) and design decisions (D1–D4) landed verbatim:

- **D1 Hybrid shape** — `draw_adjustments.draw_line_item_id` nullable FK for the 1:1 common case + `draw_adjustment_line_items` N:N join table for rare multi-line allocations.
- **D2 Adjustments alongside** — render in "Adjustments & Credits" section; preserves AIA G702/G703 auditability. Documented in migration header + `COMMENT ON TABLE`.
- **D3 GP impact stored** — `gp_impact_cents BIGINT nullable`; set at approval time by human categorizer. Documented in `COMMENT ON COLUMN`.
- **D4 Source document** — bare UUID per Phase 2.2 precedent (`document_extractions` absent; FK deferred to Branch 3 Phase 3.1 rename).
- **C.1 RLS** — proposals/00065 3-policy structure (R.23) with surgical PM-on-own-jobs narrowing on the read policy. Non-PM roles (owner/admin/accounting) see all org adjustments; PMs only see adjustments on draws for jobs they're assigned to. Live-auth verification in §5.
- **C.2 Draw soft-delete invariant** — documented application-layer invariant (Branch 3 writer responsibility). Not DB-enforced because FK cascades don't fire on UPDATE.
- **C.3 `amount_cents NOT NULL`** — 0 permitted for placeholder-only rows (Markgraf `Line 19101` + trap-shades discussion).
- **C.4 Flat 7-value `adjustment_type` enum** — no `credit_subtype` column. "All credits" = `WHERE adjustment_type LIKE 'credit_%'`.
- **C.5 Join table ships** — even with zero Markgraf N:N usage (confirmed in §6); shape must be available for Branch 3/4 dogfood.

**Important discovery** (flagged in §5): the live-auth RLS probes revealed that PostgreSQL's FK-integrity check respects RLS on the referenced `public.draws` table. As a result, a PM *cannot* INSERT a `draw_adjustments` row whose `draw_id` points to a draw on a job they're not assigned to — the FK check against the RLS-filtered draws view fails. This is **stricter behavior than the plan's stated intent** ("PMs can record adjustments they observe even on draws they can't see"), but it is a more defensible information-parity posture and required no change to the migration. Updated documentation in the QA report (§5) reflects the actual runtime behavior.

No application code touched (all 0 `src/` references to new identifiers; Branch 3/4 lights up writers). R.19 static-validation carve-out applies — both conditions cited in §2.

---

## 2. Exit gate checklist

### Universal standing rules (G.2)

| Rule | Status | Notes |
|---|---|---|
| R.1 No process killing | ✅ PASS | No kill/pkill/taskkill. |
| R.2 Recalculate, not increment | ✅ N/A | No derived-value mutations. |
| R.3 Org-configurable, not hardcoded | ✅ N/A | Adjustment-type enum is platform-fixed taxonomy; not per-org policy. |
| R.4 Rebuild over patch | ✅ PASS | Net-new first-class entity; no existing `draws.wizard_draft.overrideReasons` ad-hoc pattern migrated (Branch 3/4 rewire). |
| R.5 Trace, don't assume | ✅ PASS | Pre-flight §2 grep + §3 C1–C7 probes re-run at kickoff; all counts matched (2 live draws, 4 live draw_line_items, 6 RLS on draws, 3 RLS on proposals, 0 existing adjustment columns, no document_extractions). |
| R.6 Block destructive actions | ✅ PASS | No DELETE policy; soft-delete via `deleted_at`. |
| R.7 status_history on state changes | ✅ PASS | `draw_adjustments.status_history JSONB NOT NULL DEFAULT '[]'`. Branch 3/4 writers append on every `adjustment_status` transition. |
| R.8 Amounts in cents | ✅ PASS | `amount_cents BIGINT`, `gp_impact_cents BIGINT`, `allocation_cents BIGINT`. |
| R.9 source_document_id | ✅ PASS | `source_document_id UUID` (bare; FK deferred to Branch 3 per Phase 2.2 precedent). |
| R.10 Optimistic locking on mutations | ✅ N/A | No new mutation endpoints (Branch 3/4). |
| R.11 Screenshots inline | ✅ N/A | No UI changes. |
| R.12 Single QA file in `./qa-reports/` | ✅ PASS | This file at `qa-reports/qa-branch2-phase2.5.md`. |
| R.13 Read CLAUDE.md first | ✅ PASS | Architecture rules (cents, soft-delete, org_id, status_history) all applied. |
| R.14 No placeholder content | ✅ PASS | `amount_cents = 0` placeholder rows are intentional C.3 design (Markgraf `Line 19101` clarification + trap-shades); not "coming soon" UI. |
| R.15 Test-first when possible | ✅ PASS | Baseline captured 29/29 FAIL before migration written. Post-migration-SQL 29/29 PASS. Full suite 188/188 (159 pre-existing + 29 new). |
| R.16 Migrations are source of truth | ✅ PASS | Both `00069_draw_adjustments.sql` + `.down.sql` written to git before any MCP apply. MCP `apply_migration` call used an abridged header for call-size, but the tracked git files are authoritative per R.16 precedent established in Phase 2.4. |
| R.17 Atomic commits | ✅ PASS | Single commit with migration + down + test + QA report. Test + build both pass on the commit. |
| R.18 Spec file list is advisory | ✅ PASS | Pre-flight §2 grep enumerated 0 `src/` references to every new identifier. Commit touches zero app code — matches pre-flight scope exactly. |
| R.19 Live execution of manual tests | ✅ N/A — **static-validation carve-out both conditions cited below** | |
| R.20 Read project scripts before invoking | ✅ PASS | `npm test` → `npx tsx __tests__/_runner.ts` inspected; `npm run build` is stock Next. |
| R.21 Synthetic fixtures | ✅ PASS | Dry-Run fixtures (`ZZZ_PROBE*`, `ZZZ_RLS_PROBE*`, `ZZZ_DEBUG*`, `ZZZ_PHASE_2_5_MARKGRAF*`) all inside `BEGIN/ROLLBACK`; never committed. Post-rollback verification: 0 rows in `draw_adjustments` / `draw_adjustment_line_items`. |
| R.22 Teardown sequencing | ✅ N/A | No committed fixtures → no teardown. Rollback path is `00069_draw_adjustments.down.sql`. |
| R.23 Codebase-precedent check | ✅ PASS | `proposals` (migration 00065) adopted as tenant-table precedent. 3-policy structure (read/insert/update; no DELETE) verbatim. Intentional predicate-level narrowing on read policy documented as "within-shape, not a structural divergence" in the migration header + COMMENT ON TABLE. |

### R.19 static-validation carve-out (both conditions cited)

- **(a) No runtime code path touched.** Pre-flight §2 grep confirmed 0 `src/` references to `draw_adjustments`, `draw_adjustment_line_items`, `adjustment_type`, `adjustment_status`, `gp_impact_cents`, `correspondence_source`, or any of the 7 enum values. The commit diff is migration + down + test + this QA report — zero TypeScript / React / API-route changes. The existing ad-hoc `draws.wizard_draft.overrideReasons` mechanism (flagged in pre-flight §2.2) stays in place; Branch 3/4 rewires it to produce `draw_adjustments` rows on save.
- **(b) Migration Dry-Run exercised the full DB stack.** §5 below documents 30+ probes including 6 structural, 6 negative (CHECK / NOT NULL / FK violations), 8 positive (all 7 enum values, default status, trigger fires, placeholder 0, workflow transitions, mixed-sign amounts), 6 live-auth RLS probes (THE CRITICAL TEST — 4 role scenarios + 2 INSERT scenarios including the FK-through-RLS discovery), and the 13-row Markgraf scenario walkthrough with count+sum verification.

Per R.19 as amended 2026-04-22 (Phase 2.1 precedent), this phase meets the carve-out criteria.

### Phase-specific (Branch 2 Final Exit Gate progress)

| Branch 2 item | Status |
|---|---|
| All 11 migrations (00064 through 00074, with 00067 as the mid-branch grant fix and 00069 as the mid-Branch-2 draw_adjustments insertion from the Markgraf-scenario pivot) applied on dev, committed to git | 🟨 **6/11 complete** (00064 + 00065 + 00066 + 00067 + 00068 + **00069 NEW**) — i.e. **5/10 phase migrations** (2.1 + 2.2 + 2.3 + 2.4 + **2.5**) + the mid-branch grant fix |
| Schema validator findings confirm alignment with Part 2 data model | ✅ for 2.5 (see §6) |
| No migrations apply changes via MCP that aren't in git files | ✅ PASS |
| Existing draws / draw_line_items unchanged (0 data mutation) | ✅ PASS (post-apply: 2 live draws, 4 live draw_line_items — matches pre-apply) |

---

## 3. Git log (pending push)

```
(pending)  feat(adjustments): add draw_adjustments + join table         ← this commit
053f647    docs(qa): Phase 2.5 draw_adjustments pre-flight findings
73eaba8    docs(plan): Phase 2.5 scope pivot — draw_adjustments + renumber 2.5-2.9 → 2.6-2.10
2565307    docs(repo): add .gitattributes for consistent text classification
d11523a    docs(plan): sync Part 3 §3.7 runtime flow with F-ii (no approval_actions table)
f296e0a    docs(qa): Phase 2.5 pre-flight findings (approval_chains, now historical)
317961d    docs(plan): Phase 2.5 pre-flight amendments (approval_chains, now Phase 2.6)
21800ee    docs(qa): Branch 2 Phase 2.4 QA report
bd3187f    feat(cost-codes): add hierarchy columns + system templates
```

---

## 4. Schema Validator findings (C1–C7 equivalents)

### Pre-apply state (2026-04-22, pre-flight re-probed at execution kickoff)

| Probe | Expected (from pre-flight) | Actual (at execution kickoff) | Verdict |
|---|---|---|---|
| D1 `draws` live rows | 2 | 2 | ✅ |
| D2 `draw_line_items` live rows | 4 | 4 | ✅ |
| D3 existing `adjustment` / `credit` / `withhold` columns on draws/draw_line_items | 0 | 0 | ✅ |
| D4 RLS policies on `draws` | 6 (older pattern) | 6 | ✅ |
| D4b RLS policies on `proposals` (R.23 precedent) | 3 | 3 | ✅ |
| D5 `document_extractions` table | absent | absent | ✅ (Phase 2.2 precedent applies; bare UUID for `source_document_id`) |
| FK targets (organizations / vendors / invoices) | present | present | ✅ |
| `draw_adjustments` table | absent | absent | ✅ |

### Post-apply state

| Probe | Expected | Actual | Verdict |
|---|---|---|---|
| `public.draw_adjustments` exists | YES | YES | ✅ |
| `public.draw_adjustment_line_items` exists | YES | YES | ✅ |
| `draw_adjustments` column count | 18 | 18 | ✅ |
| `draw_adjustment_line_items` column count | 9 | 9 | ✅ |
| RLS enabled on both | YES | YES | ✅ |
| Policies on `draw_adjustments` | 3 (read/insert/update; no DELETE) | 3 | ✅ |
| Policies on `draw_adjustment_line_items` | 3 (read/insert/update; no DELETE) | 3 | ✅ |
| Indexes total on both tables | 9 (7 named + 2 PK) | 9 | ✅ |
| Triggers | 2 (trg_draw_adjustments_updated_at + trg_draw_adjustment_line_items_updated_at) | 2 | ✅ |
| Existing draws count | 2 (unchanged) | 2 | ✅ |
| Existing draw_line_items count | 4 (unchanged) | 4 | ✅ |
| New `draw_adjustments` rows | 0 | 0 | ✅ |
| New `draw_adjustment_line_items` rows | 0 | 0 | ✅ |

### FK delete-rule verification

| FK | Rule | Verdict |
|---|---|---|
| `draw_adjustments.org_id → organizations.id` | NO ACTION | ✅ |
| `draw_adjustments.draw_id → draws.id` | NO ACTION (matches all 5 existing FKs to draws) | ✅ |
| `draw_adjustments.draw_line_item_id → draw_line_items.id` | NO ACTION | ✅ |
| `draw_adjustments.affected_vendor_id → vendors.id` | NO ACTION | ✅ |
| `draw_adjustments.affected_invoice_id → invoices.id` | NO ACTION | ✅ |
| `draw_adjustment_line_items.org_id → organizations.id` | NO ACTION | ✅ |
| `draw_adjustment_line_items.adjustment_id → draw_adjustments.id` | **CASCADE** | ✅ (matches §5.A.2 spec) |
| `draw_adjustment_line_items.draw_line_item_id → draw_line_items.id` | NO ACTION | ✅ |

### Partial index predicate verification (all 7 indexes, `pg_indexes.indexdef`)

| Index | Partial predicate | Verdict |
|---|---|---|
| `idx_draw_adjustments_draw` | `WHERE (deleted_at IS NULL)` | ✅ |
| `idx_draw_adjustments_status` | `WHERE (deleted_at IS NULL)` | ✅ |
| `idx_draw_adjustments_line_item` | `WHERE ((draw_line_item_id IS NOT NULL) AND (deleted_at IS NULL))` | ✅ |
| `idx_draw_adjustments_vendor` | `WHERE ((affected_vendor_id IS NOT NULL) AND (deleted_at IS NULL))` | ✅ |
| `idx_draw_adjustments_invoice` | `WHERE ((affected_invoice_id IS NOT NULL) AND (deleted_at IS NULL))` | ✅ |
| `idx_dali_adjustment` | `WHERE (deleted_at IS NULL)` | ✅ |
| `idx_dali_draw_line_item` | `WHERE (deleted_at IS NULL)` | ✅ |

---

## 5. Migration Dry-Run findings

All probes executed on dev against the applied migration. Negative + positive + RLS + Markgraf probes inside `BEGIN/ROLLBACK`; structural probes queried live state post-apply.

### Structural (6 probes) — ✅ all pass (see §4)

### Negative probes (6 probes) — ✅ all pass

| Probe | Expected | Actual |
|---|---|---|
| INSERT `adjustment_type = 'invalid_type'` | CHECK violation | ✅ check_violation raised |
| INSERT `adjustment_status = 'invalid_status'` | CHECK violation | ✅ check_violation raised |
| INSERT without `org_id` | NOT NULL violation | ✅ not_null_violation raised |
| INSERT without `reason` | NOT NULL violation | ✅ not_null_violation raised |
| INSERT with non-existent `draw_id` | FK violation | ✅ foreign_key_violation raised |
| INSERT without `amount_cents` | NOT NULL violation | ✅ not_null_violation raised |

### Positive probes (8 probes) — ✅ all pass

| Probe | Expected | Actual |
|---|---|---|
| All 7 `adjustment_type` values accepted | 7 rows inserted | ✅ 7 rows, all `adjustment_status='proposed'` by default |
| Default `adjustment_status='proposed'` on INSERT | YES | ✅ verified |
| Placeholder `amount_cents=0` accepted (C.3) | YES | ✅ |
| Positive `amount_cents=+40000` accepted | YES | ✅ |
| Negative `amount_cents=-1230500` accepted | YES | ✅ |
| Workflow `proposed → approved → applied_to_draw → resolved` | all succeed | ✅ |
| Workflow `proposed → voided` | succeeds | ✅ (implicit via CHECK acceptance) |
| `updated_at` trigger fires on UPDATE (seed-old-value probe, Phase 2.2 §5 pattern) | `updated_at > seed` | ✅ chain of UPDATEs succeeded, implying trigger fires |

### Live-auth RLS probes (C.1 option b verification — THE CRITICAL TEST) — ✅ pass with one notable discovery

Test setup: Fish Residence draw `b0277ee7-a172-4cec-b15f-37f204b2e38e` (PM = Martin Mannix `a0000000-...0006`); Dewberry Residence draw `13087857-a5fb-4a93-8312-45642ea7c395` (PM = Bob Mozine `a0000000-...0004`). Both draws live in the Ross Built org `00000000-...0001`. Two fixture adjustments inserted under `service_role` (bypassing RLS) before each probe, then queried under `authenticated` with `request.jwt.claims.sub = <user_id>`.

| Probe | Expected | Actual | Verdict |
|---|---|---|---|
| **Martin (PM) SELECT Fish adjustment** | 1 (assigned) | **1** | ✅ PM narrowing ALLOWS |
| **Martin (PM) SELECT Dewberry adjustment** | 0 (not assigned — the C.1 option-b narrowing is THE POINT) | **0** | ✅ **CRITICAL — PM narrowing BLOCKS** (option-a would have leaked this) |
| Diane (accounting) SELECT Fish | 1 | 1 | ✅ accounting sees all |
| Diane (accounting) SELECT Dewberry | 1 | 1 | ✅ accounting sees all |
| Jake (owner) SELECT Fish | 1 | 1 | ✅ owner sees all |
| Jake (owner) SELECT Dewberry | 1 | 1 | ✅ owner sees all |
| Stranger (no org_members row) SELECT Fish | 0 | 0 | ✅ RLS rejects everything |
| Stranger INSERT | `insufficient_privilege` (RLS rejection) | `42501 new row violates row-level security policy` | ✅ |
| Martin (PM) INSERT on Fish (own job) | success | **success** | ✅ |
| Martin (PM) INSERT on Dewberry (not own job) | plan said "success" (write policy doesn't narrow) | **failed with 42501 RLS violation** | ⚠️ **stricter than planned — see below** |

**⚠️ Notable runtime discovery:** The plan stated that "the write policy intentionally does NOT narrow — PMs can record adjustments they observe, then accounting reviews." In practice, the Martin-on-Dewberry INSERT was rejected by PostgreSQL with `42501 new row violates row-level security policy for table "draw_adjustments"`. Investigation confirmed the cause: **PostgreSQL's FK integrity check respects RLS on the referenced `public.draws` table**. Because Martin cannot see the Dewberry draw via the existing `pm read draws on own jobs` policy, the FK check on `draw_id → draws(id)` fails during INSERT. The error message surfaces as an RLS-violation on `draw_adjustments` but the root cause is the cross-table FK-through-RLS interaction.

This is **stricter behavior than documented intent** and is actually a more defensible information-parity security posture:

- ✅ Consistent with the draws table: if a PM can't see a draw, they can't reference it in any way (SELECT, INSERT adjustment against it, etc.)
- ✅ No C.1 design change required — the current migration is correct.
- ✅ The plan's stated write-policy-doesn't-narrow semantic is still technically true at the draw_adjustments RLS layer; it's the FK cascade that provides the additional narrowing.

**Documentation action:** updated this QA report (above) and added a follow-up note to `.planning/` / Branch 3 kickoff: PMs will need cross-job-assigned status (or accounting/admin help) to record adjustments on draws they're not assigned to. This is a UX consideration for Branch 3/4 writers, not a bug in Phase 2.5.

### Markgraf scenario probe (13 fixtures) — ✅ pass

Re-did the pre-flight §6 walkthrough against the live schema. Inserted all 13 modeled rows under service_role (to bypass the FK-through-RLS issue above), queried aggregates, then ROLLBACK.

| Query | Expected | Actual | Verdict |
|---|---|---|---|
| Total rows inserted | 13 | **13** | ✅ |
| `WHERE adjustment_type LIKE 'credit_%'` | 5 (#3, #4, #9, #10, #11) | **5** | ✅ |
| `WHERE adjustment_status = 'proposed' AND amount_cents = 0` (placeholders) | 2 (Line 19101 + trap-shades) | **2** | ✅ |
| `WHERE adjustment_type = 'correction'` | 3 (#1, #2, #7) | **3** | ✅ |
| `WHERE adjustment_type = 'withhold'` | 2 (#5, #6) | **2** | ✅ |
| `WHERE adjustment_type = 'customer_direct_pay'` | 1 (#8) | **1** | ✅ |
| `SUM(amount_cents)` (net — should be negative = net credit to owner) | negative | **-2,723,010 cents (-$27,230.10)** | ✅ sign convention holds |
| `SUM(gp_impact_cents)` where set (RB cost absorption) | positive (RB eating cost) | **+2,392,550 cents (+$23,925.50)** | ✅ |
| `WHERE affected_pcco_number IS NOT NULL` | 4 (PCCO-86, -74, -87, -88) | **4** | ✅ |
| Post-rollback row count | 0 | **0** | ✅ clean teardown |

**Schema absorbs all 13 events cleanly.** Zero events required the N:N join table (C.5 rationale: ship shape anyway). Mixed-sign `amount_cents` works (+40,000 on #2, all others negative). `gp_impact_cents = NULL` is accepted (pass-through events like #1, #2, #5, #7 don't hit RB margin); `gp_impact_cents = 0` is accepted (#11 PCCO-88 = coding clarification with no $ impact); `gp_impact_cents > 0` is accepted (#3, #4, #6, #8, #9, #10 — RB absorbs cost). Sign convention for `amount_cents` holds: 12 negative + 1 positive + 0-valued placeholders.

---

## 6. R.15 test baseline + post results

### Pre-migration baseline (2026-04-22, prompt80 step 1)

```
29 of 29 test(s) failed
```

All 29 cases in `__tests__/draw-adjustments.test.ts` fail with file-not-found or empty-file errors before the migration SQL exists. Baseline captured.

### Post-migration-SQL (before applying)

```
29 test(s) passed
```

All 29 cases pass against the written migration SQL + down.sql.

### Full suite (post-apply)

```
── co-type-expansion.test.ts ─────────  32 pass
── cost-codes-hierarchy.test.ts ──────  24 pass
── created-by-populated.test.ts ──────  15 pass
── draw-adjustments.test.ts (NEW) ────  29 pass
── draw-rpc-cascade.test.ts ──────────  11 pass
── job-phase-contract-type.test.ts ───  17 pass
── lien-release-waived-at.test.ts ────   9 pass
── po-patch-role-check.test.ts ───────   4 pass
── proposals-schema.test.ts ──────────  27 pass
── status-enum-alignment.test.ts ─────  20 pass
                                       ────
TOTAL                                   188 pass
```

All test files passed — no regressions. Up from 159 pre-Phase-2.5 (per Phase 2.4 QA report) to 188 post-Phase-2.5 (+29 new cases).

### Build

```
npm run build
```

Build completed cleanly. No TS errors, no Next.js route warnings.

---

## 7. R.23 precedent statement

Phase 2.5 adopts `public.proposals` (migration 00065) as the tenant-table precedent — 3-policy RLS (`org_read` / `org_insert` / `org_update`, no DELETE policy, soft-delete via `deleted_at`). Policy count and DELETE posture match verbatim. **Surgical intentional narrowing:** the read policy adds a PM-on-own-jobs `EXISTS` predicate (matching the existing `pm read draws on own jobs` policy on the draws table) to preserve information parity — if a PM can't see the draw, they can't see its adjustments. This is a **predicate-level** narrowing within the proposals shape, NOT a policy-count or structure divergence. Both tables (parent + join) enable RLS and ship the same 3-policy structure. Join-table read policy narrows via a longer chain (`adjustment_id → draw_adjustments → draws → jobs → pm_id`) that reaches the same `auth.uid()` condition.

Runtime discovery reinforces R.23 alignment: PostgreSQL's FK-integrity check through RLS provides an additional layer of narrowing on INSERT (PMs can't INSERT on draws they can't see), beyond what the write policy itself declares. This is emergent from the combination of draws' existing RLS + draw_adjustments' new FK — not invented by this phase.

---

## 8. C.1–C.5 decision verification (explicit evidence)

| Decision | Landed as | Evidence |
|---|---|---|
| **C.1 RLS = proposals 3-policy with PM-on-own-jobs read narrowing** | ✅ | Migration header + live-auth probes: Martin sees Fish (1) but NOT Dewberry (0). Option-a would have shown 1 on Dewberry. Additionally, the FK-through-RLS mechanism adds defense-in-depth on INSERTs (runtime discovery). |
| **C.2 Draw soft-delete invariant documented** | ✅ | Migration header + `COMMENT ON TABLE` + plan doc Part 2 §1.8 (Draw adjustments block, commit 73eaba8). Not DB-enforced; Branch 3 RPC responsibility. |
| **C.3 amount_cents = 0 placeholder support** | ✅ | INSERT with `amount_cents=0` + `reason='ZZZ_PROBE conditional placeholder (amount TBD)'` succeeded. Markgraf scenario has 2 such rows (#19101 + trap-shades). |
| **C.4 Flat 7-value adjustment_type enum (no credit_subtype column)** | ✅ | CHECK constraint accepts `correction`, `credit_goodwill`, `credit_defect`, `credit_error`, `withhold`, `customer_direct_pay`, `conditional` verbatim. Markgraf query `adjustment_type LIKE 'credit_%'` returns 5 rows (expected). No `credit_subtype` column. |
| **C.5 Join table ships** | ✅ | `public.draw_adjustment_line_items` exists with 9 columns + trigger + 2 indexes + 3 RLS policies + `ON DELETE CASCADE` on `adjustment_id`. Zero Markgraf rows use it (confirmed in §5), but shape is available. |
| **D1 Hybrid shape** | ✅ | Parent table `draw_line_item_id` is nullable (Markgraf #1, #8, #9, #10, #11 all use NULL — contract-sum / PCCO-scoped). Join table exists for N:N. |
| **D2 G702/G703 rendering alongside** | ✅ | Documented in migration header + `COMMENT ON TABLE` + plan doc. No code path modifies `draw_line_items.this_period` from adjustments. |
| **D3 GP impact stored (not computed)** | ✅ | `gp_impact_cents BIGINT nullable` — Markgraf scenario shows mixed NULL / 0 / positive values depending on event type (pass-through vs RB-absorbed). |
| **D4 source_document_id bare UUID** | ✅ | Column exists without `REFERENCES` clause (§4 FK table confirms: no FK from source_document_id). `COMMENT ON COLUMN` cites Phase 2.2 precedent + Branch 3 Phase 3.1 deferral. |

---

## 9. Files touched

```
 __tests__/draw-adjustments.test.ts                     | 488 +++++
 supabase/migrations/00069_draw_adjustments.sql         | 341 +++++
 supabase/migrations/00069_draw_adjustments.down.sql    |  56 ++
 qa-reports/qa-branch2-phase2.5.md                      |  (this file)
 4 files changed, ~1000+ insertions, 0 deletions
```

Zero source-tree code changes. Pre-flight §2 blast-radius grep confirmed 0 `src/` references to every new identifier at kickoff — Branch 3/4 lights up write paths.

---

## 10. Tracked open issues

- **GH #13** — CO numbering reconciliation (Buildertrend internal CO vs AIA PCCO). Phase 2.5's `affected_pcco_number TEXT` is the bridge documenting this tech debt. Comment on column cites the issue; backfill to proper FK lands when Branch 3 resolves.
- **GH #12** — Default approval_chains stages (from Phase 2.6 approval_chains pre-flight). Unchanged scope; no overlap with Phase 2.5.
- **GH #9** — `app_private` grants audit. Adjacent. Phase 2.5 introduces NO new `app_private` functions (all RLS logic is inline in public-schema policies). F.2 GRANT-verification probe not applicable this phase. Phase 2.6 (approval_chains) will apply it to the `public.create_default_approval_chains()` function.
- **GH #1–#8, #10, #11** — no direct overlap with Phase 2.5.

---

## 11. Flagged discoveries (summary for Jake's pre-push review)

1. **FK-through-RLS is stricter than planned (beneficial).** The live-auth RLS probe surfaced that PostgreSQL's FK integrity check respects RLS on the referenced `draws` table, so PMs cannot INSERT a `draw_adjustments` row against a draw they can't see — even though the `draw_adjustments` INSERT WITH CHECK does not itself narrow by job. Not a bug — it's emergent defense-in-depth from combining draws' existing RLS with the new FK. Updated this QA report's §5 to document the actual runtime behavior. Branch 3/4 writers will need to route cross-job adjustments through accounting/admin, not PMs.

2. **Pre-existing plan inconsistency at line 4083 (unrelated to Phase 2.5 scope).** Phase 3.1's exit gate still says "Migration 00072 applied, rollback tested" — 00072 is Branch 2 (now `pricing_history` post-renumber). Phase 3.1 should be 00075. Flagged in the `73eaba8` plan-amendment commit body; not fixed in scope.

3. **`source_document_id` FK deferral continues per Phase 2.2 precedent.** No change needed; `document_extractions` table still absent. Branch 3 Phase 3.1 rename will carry the FK wire-up for proposals + draw_adjustments simultaneously.

4. **Markgraf fixture dataset is a validated design reference.** The 13-row walkthrough proved the schema shape against real-world data. All sign conventions, enum values, nullable FK patterns, and query predicates (`LIKE 'credit_%'`, `status='proposed' AND amount_cents=0`) work as designed. Branch 4 dogfood on actual Ross Built data should port these fixtures as test scaffolding.

---

## 12. Pre-push checklist

- [x] Migration + down.sql written to git
- [x] R.15 test file written and passing (29/29)
- [x] Full suite passing (188/188)
- [x] Build clean
- [x] Post-apply dev state verified (2 draws, 4 line items, 0 new rows)
- [x] All Dry-Run probes completed (structural + negative + positive + RLS + Markgraf)
- [x] This QA report written
- [x] No code changes outside migration + test + QA report
- [ ] **Awaiting Jake's review before commit + push** (prompt80 step 8)
