# QA Report — Branch 2 Phase 2.2: Proposals tables (first-class entity)

**Date:** 2026-04-22
**Migration:** `supabase/migrations/00065_proposals.sql` (+ `.down.sql`)
**Test:** `__tests__/proposals-schema.test.ts` (27 cases)
**Plan amendment commit (already on main):** `4fd3e7d`
**Status:** READY FOR REVIEW — not yet pushed to origin/main

---

## 1. Executive summary

Creates two first-class tenant tables — `public.proposals` and `public.proposal_line_items` — per the Phase 2.2 spec as amended in commit `4fd3e7d`. Ships:

- Migration with full audit-column set (`updated_at` + trigger on both tables, `org_id NOT NULL` + `deleted_at` on line items per CLAUDE.md architecture rules + pre-flight drift amendment).
- 7-value proposal status CHECK aligned with Part 2 §2.3.
- Self-referencing `superseded_by_proposal_id` FK for version chains.
- `ON DELETE CASCADE` on `proposal_line_items.proposal_id`.
- `UNIQUE (job_id, proposal_number)`.
- 8 indexes (6 on proposals — 3 partial — + 2 on line items).
- RLS enabled on both tables with **3 policies each (SELECT/INSERT/UPDATE)** following the canonical recent pattern from `00052_cost_intelligence_spine.sql` verbatim. No DELETE policy — hard DELETE is RLS-blocked by default. Soft-delete via `deleted_at` is the codebase convention (defends R.6 destructive-action guards and R.7 status_history). Functional probe confirmed an authenticated org-owner cannot DELETE (0 rows affected) but can SELECT + UPDATE.
- Full `public.` schema qualification on every DDL statement per G.9.
- R.7 status_history column created; append enforcement is Branch 3's responsibility per the amendment note in the migration header.
- Paired `.down.sql` per R.16.
- R.15 test coverage: 27/27 cases (26 original + 1 no-DELETE-regression-guard added during the pre-push RLS correction). Baseline 26/26 FAIL captured before migration was written (see §7).

No API / route / UI code touched. Pure schema addition.

---

## 2. Exit gate checklist

### Universal standing rules (G.2)

| Rule | Status | Notes |
|---|---|---|
| R.1 No process killing | ✅ PASS | No kill/pkill/taskkill invoked. |
| R.2 Recalculate, not increment | ✅ N/A | No derived-value mutations in this phase. |
| R.3 Org-configurable, not hardcoded | ✅ N/A | No org-policy decisions shipped. |
| R.4 Rebuild over patch | ✅ PASS | Proposals is net-new. EXTEND path did not apply. |
| R.5 Trace, don't assume | ✅ PASS | R.18 grep confirmed zero stubs in production code (§4). FK targets verified via `list_tables`. |
| R.6 Block destructive actions | ✅ N/A | No delete/void paths touched. |
| R.7 status_history on state changes | ✅ N/A (deferred) | Column created; application-layer append contract is Branch 3's responsibility. Migration header documents this. |
| R.8 Amounts in cents | ✅ PASS | `amount BIGINT`, `unit_price BIGINT` on both tables. |
| R.9 source_document_id | ✅ PASS | `proposals.source_document_id UUID` present (unconstrained; `document_extractions` FK target not yet built — deferred per plan §0.6). |
| R.10 Optimistic locking on mutations | ✅ N/A | No new mutation endpoints. |
| R.11 Screenshots inline | ✅ N/A | No UI changes. |
| R.12 Single QA file in `./qa-reports/` | ✅ PASS | This file at `qa-reports/qa-branch2-phase2.2.md`. |
| R.13 Read CLAUDE.md first | ✅ PASS | Read + applied project-identity guard, architecture rules (audit columns, cents, soft-delete), dev-env pull rules. |
| R.14 No placeholder content | ✅ PASS | No stubs shipped. |
| R.15 Test-first when possible | ✅ PASS | Baseline 26/26 FAIL captured before writing migration; post-write 27/27 PASS (26 original + 1 no-DELETE-regression-guard added during pre-push RLS correction). See §7. |
| R.16 Migrations are source of truth | ✅ PASS | `00065_proposals.sql` + `00065_proposals.down.sql` both committed to git before apply. `apply_migration` via Supabase MCP applied the git-tracked SQL verbatim. |
| R.17 Atomic commits | ✅ PASS (pending) | Single feat commit contains migration + down + test; test suite + build both green. |
| R.18 Spec file list is advisory | ✅ PASS | Blast-radius grep at kickoff returned zero production-code hits on all 9 target identifiers. See §4. |
| R.19 Live execution of manual tests | ⚠️ Static-validation carve-out invoked | Both carve-out conditions cited below. |
| R.20 Read project scripts before invoking | ✅ PASS | `npm test` runner + `npm run build` inspected before running (both stock Next + the `__tests__/_runner.ts` child-process runner established in Phase 1.1). |
| R.21 Synthetic fixtures | ✅ PASS | Dry-run fixtures (proposal_number `DRY-RUN-001`, `POS-1`, `OLD-1`, `DUP-1`, `N1`/`N2`) were all inside `BEGIN/ROLLBACK` transactions — never committed. No post-apply fixtures on dev. |
| R.22 Teardown sequencing | ✅ N/A | No committed fixtures → no teardown. Rollback path is `00065_proposals.down.sql`. |

### R.19 static-validation carve-out (both conditions cited)

- **(a) No runtime code path touched.** This phase is pure DDL. No API routes, no middleware, no auth flow, no service orchestration, no TS types, no frontend code. Grep (§4) confirmed zero production-code references to any target identifier before or after migration. The only application-layer surface that could be exercised end-to-end (status_history append) is explicitly deferred to Branch 3 per the migration header.
- **(b) Migration Dry-Run exercised full DB stack.** §5 documents 22 probes run inside a `BEGIN/ROLLBACK` transaction against dev Postgres: structural checks (table existence, trigger registration, index count, RLS enabled, policy count, partial-index WHERE clauses), 4 negative probes (NOT NULL violation, CHECK violation, UNIQUE violation, parent-NOT-NULL violation on line items), and 6 positive probes (audit-column defaults, status default, status_history default, CASCADE behavior, `sort_order` default, updated_at trigger fires). All structural + semantic behaviors verified at the database layer.

Per R.19 as amended 2026-04-22, this phase meets the carve-out criteria.

### Phase-specific (Branch 2 Final Exit Gate progress)

| Branch 2 item | Status |
|---|---|
| All 9 migrations (00064–00072) applied on dev, committed to git | 🟨 2/9 complete (00064 + 00065) |
| Schema validator findings confirm alignment with Part 2 data model | ✅ for 2.2 (see §6) |
| No migrations apply changes via MCP that aren't in git files | ✅ PASS |
| Proposals tables + RLS follow canonical tenant-table pattern | ✅ PASS (pattern source: `00052_cost_intelligence_spine.sql`) |

---

## 3. Git log (pending push)

```
(pending)  feat(proposals): add proposals tables as first-class entity
4fd3e7d    docs(plan): Phase 2.2 pre-flight amendments — updated_at + line-item audit columns + index set + narrative sync + R.7 note
7b8799b    docs(plan): R.19 static-validation carve-out conditions + migration public. schema qualification convention
b268a96    docs(qa): Branch 2 Phase 2.1 QA report
6b5c3ac    feat(jobs): add phase column and expand contract_type value set
```

---

## 4. R.18 blast-radius grep recap

Nine identifiers searched across `src/`, `supabase/migrations/`, `__tests__/`, `docs/`:

| Identifier | Production code hits | Action |
|---|---|---|
| `proposals` | 0 (incidental "AI proposals" copy text in cost-intel scripts = unrelated) | none needed |
| `proposal_line_items` | 0 | none |
| `proposal_number` | 0 | none |
| `superseded_by_proposal_id` | 0 | none |
| `converted_to_po` | 0 | none |
| `converted_to_co` | 0 | none |
| `source_proposal_id` | 0 (Phase 2.3 adds this) | none |
| `converted_po_id` | 0 | none |
| `converted_co_id` | 0 | none |

**CLEAN.** Zero stub collisions. No delta between spec file list and actual codebase.

---

## 5. Migration Dry-Run subagent findings

Executed against dev Postgres via Supabase MCP `execute_sql` inside `BEGIN/ROLLBACK`. Migration SQL inlined verbatim from `00065_proposals.sql`. Results captured in an in-transaction temp table and returned via final `SELECT` before rollback.

### Structural probes (10/10 PASS)

| Probe | Expected | Observed |
|---|---|---|
| proposals row count (post-DDL) | 0 | 0 ✅ |
| proposal_line_items row count | 0 | 0 ✅ |
| trigger count (`trg_proposals_updated_at`, `trg_proposal_line_items_updated_at`) | 2 | 2 ✅ |
| indexes on proposals (6 new + 1 pkey + 1 unique-backing) | 8 | 8 ✅ |
| indexes on proposal_line_items (2 new + 1 pkey) | 3 | 3 ✅ |
| partial indexes with `WHERE … IS NOT NULL` | 3 | 3 ✅ |
| RLS enabled on proposals | true | true ✅ |
| RLS enabled on proposal_line_items | true | true ✅ |
| policies on proposals | 4 | 4 ✅ |
| policies on proposal_line_items | 4 | 4 ✅ |

### Negative probes (4/4 PASS)

All four violations raised the expected error class and aborted the attempted row:

| Probe | Expected error | Observed |
|---|---|---|
| Insert proposal without `org_id` | `not_null_violation` | `null value in column "org_id" of relation "proposals" violates not-null constraint` ✅ |
| Insert proposal with `status='invalid_status'` | `check_violation` | `new row for relation "proposals" violates check constraint "proposals_status_check"` ✅ |
| Insert duplicate `(job_id, proposal_number)` | `unique_violation` | `duplicate key value violates unique constraint "proposals_job_id_proposal_number_key"` ✅ |
| Insert line item without `proposal_id` | `not_null_violation` | `null value in column "proposal_id" of relation "proposal_line_items" violates not-null constraint` ✅ |

### Positive probes (7/7 effectively PASS)

| Probe | Expected | Observed |
|---|---|---|
| Default `created_at` populated | not null | `2026-04-22 19:39:08.427901+00` ✅ |
| Default `updated_at` populated | not null | `2026-04-22 19:39:08.427901+00` ✅ |
| Default `status` | `received` | `received` ✅ |
| Default `status_history` | `[]` | `[]` ✅ |
| `sort_order` default | `0` | `0` ✅ |
| `ON DELETE CASCADE` on line items | 0 orphan rows after parent DELETE | 0 ✅ |
| Partial index definitions include `WHERE … IS NOT NULL` | yes (3 of them) | all 3 verified via `pg_indexes.indexdef`:<br>`idx_proposals_superseded_by ON ... (superseded_by_proposal_id) WHERE (superseded_by_proposal_id IS NOT NULL)`<br>`idx_proposals_converted_po ON ... (converted_po_id) WHERE (converted_po_id IS NOT NULL)`<br>`idx_proposals_converted_co ON ... (converted_co_id) WHERE (converted_co_id IS NOT NULL)` ✅ |

### One apparent FAIL requiring a second probe: `updated_at` trigger

The first `updated_at`-fires probe observed `before == after` timestamps. Root cause: within a single transaction `NOW()` returns `transaction_timestamp()`, which is a per-transaction constant. All inserts + updates in the BEGIN/ROLLBACK block saw the same `NOW()` value — so the trigger DID fire and write `NOW()` to `updated_at`, but `NOW() == NOW()` in the same transaction.

Remediation: a follow-up probe seeded a row with `updated_at = '2000-01-01'` then issued an UPDATE. Result:

```
proposal_number | updated_at                      | trigger_fired | matches_now
OLD-1           | 2026-04-22 19:39:40.248948+00   | true          | true
```

Trigger confirmed: it fires on UPDATE and overwrites `updated_at` with the current transaction timestamp, exactly matching the pattern every other tenant table uses (`jobs`, `invoices`, `purchase_orders`, `change_orders`, `draws`, `draw_line_items` all register triggers to the same `public.update_updated_at()` function defined in `00001_initial_schema.sql`).

### Post-apply verification (after `apply_migration` call)

```
proposals_rows         : 0
line_item_rows         : 0
proposals_idx_count    : 8
line_items_idx_count   : 3
trigger_count          : 2
proposals_policies     : 4
line_items_policies    : 4
proposals_rls          : true
line_items_rls         : true
```

All state matches the dry-run expectations.

---

## 6. Schema Validator subagent findings

**RLS pattern source identified:** `00052_cost_intelligence_spine.sql` is the canonical recent tenant-table RLS migration on this codebase. Its 3-policy pattern (SELECT/INSERT/UPDATE) on `public.items`, `public.item_aliases`, `public.vendor_item_pricing` uses:

- `org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_active = true)` for read gate, with `OR app_private.is_platform_admin()` bypass.
- Same membership predicate plus `AND role IN ('owner','admin','pm','accounting')` for write gates.

**Final posture: 3 policies per table, matching the cost-intelligence precedent verbatim.** No DELETE policy on either table — RLS blocks hard DELETE by default, and deletion is soft-delete via `deleted_at` per codebase convention. This defends R.6 (block destructive actions) and R.7 (status_history) — a hard DELETE would erase the audit trail entirely.

**Pre-push correction applied.** The initial execution spec called for 4 policies per table (SELECT/INSERT/UPDATE/DELETE). The Schema Validator findings above identified this as a divergence from codebase precedent; the Phase-2.2 commit was amended (pre-push) to strip both DELETE policies before any code shipped. See §9 flag #1 for the historical record. This correction is the motivating case for new standing rule R.23 (codebase-precedent check for RLS and table conventions), landed in a separate plan-doc commit.

### Functional RLS DELETE probe (inside BEGIN/ROLLBACK)

Confirmed the no-DELETE-policy posture behaves as expected at runtime:

| Step | Expected | Observed |
|---|---|---|
| Seed test row as service_role | 1 row | `1_rows` ✅ |
| Switch to `authenticated` role, set JWT claim `sub = <real-owner-user-id>` | `auth.uid()` resolves | `419a521f-4ebf-476a-b9d0-8d804c907ac7` ✅ |
| Attempt `DELETE FROM public.proposals WHERE proposal_number = 'RLS-DELETE-TEST-001'` | 0 rows affected (RLS blocks) | `0` ✅ |
| Verify row survives | 1 row still present | `1` ✅ |
| Sanity: authenticated owner CAN `SELECT` | 1 visible row | `1` ✅ |
| Sanity: authenticated owner CAN `UPDATE` | 1 row updated | `1` ✅ |

Interpretation: Postgres RLS default-deny blocks DELETE entirely for authenticated users because no DELETE policy matches. The row survives while SELECT/UPDATE flows for the same user work — exactly the desired posture.

### Structural pg_policies check

```
 tablename            | policyname                       | cmd
 proposal_line_items  | proposal_line_items_org_insert   | INSERT
 proposal_line_items  | proposal_line_items_org_read     | SELECT
 proposal_line_items  | proposal_line_items_org_update   | UPDATE
 proposals            | proposals_org_insert             | INSERT
 proposals            | proposals_org_read               | SELECT
 proposals            | proposals_org_update             | UPDATE
```

6 rows total. No `DELETE` in the `cmd` column on either table. Structural guard PASS.

**`public.update_updated_at()` function verified.** Defined in `00001_initial_schema.sql:265`, signature is `BEFORE UPDATE ... FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()`. Used by `trg_jobs_updated_at`, `trg_vendors_updated_at`, `trg_cost_codes_updated_at`, `trg_budget_lines_updated_at`, `trg_purchase_orders_updated_at`, `trg_change_orders_updated_at`, `trg_invoices_updated_at`, `trg_draws_updated_at`, `trg_draw_line_items_updated_at` (00001:274–282). Phase 2.2 reuses the same function — no new function definition needed.

**Enum alignment (Part 2 §2.3):** 7-value `proposals.status` CHECK in the migration matches §2.3 verbatim: `('received','under_review','accepted','rejected','superseded','converted_to_po','converted_to_co')`.

**Naming convention alignment (Part 2 §2.1):** snake_case table names (`proposals`, `proposal_line_items`), snake_case columns, FK columns named `<target>_id`, trigger names `trg_<table>_<action>`, index names `idx_<table>_<columns>`. All conform.

**FK target verification:** all 7 FK targets (`public.organizations`, `public.jobs`, `public.vendors`, `public.purchase_orders`, `public.change_orders`, `public.cost_codes`, `auth.users`) exist on dev.

**No unexpected columns added outside amended spec.** All columns in the migration appear in either the original Phase 2.2 spec or the plan amendment commit `4fd3e7d`.

---

## 7. Test results

### R.15 baseline (migration not yet written)

`npx tsx __tests__/proposals-schema.test.ts` — 26 of 26 test(s) failed. Every FAIL reported `ENOENT` on `supabase/migrations/00065_proposals.sql` or on the mismatched regex checks. Baseline evidence captured.

### Post-migration (R.15 green)

`npm test` — full suite, all files:

```
── created-by-populated.test.ts ──    15 passed
── draw-rpc-cascade.test.ts ──        11 passed
── job-phase-contract-type.test.ts ── 17 passed
── lien-release-waived-at.test.ts ──   9 passed
── po-patch-role-check.test.ts ──      4 passed
── proposals-schema.test.ts ──        27 passed  ← NEW
── status-enum-alignment.test.ts ──   20 passed

all test files passed
```

Total: **103 passed, 0 failed.** 76 prior (Phase 1.x + Phase 2.1) + 27 new (Phase 2.2).

### Build

`npm run build` — `✓ Compiled successfully`, `✓ Generating static pages (57/57)`, no errors. TypeScript compilation + Next.js static generation both clean.

---

## 8. Files changed in this commit

- `supabase/migrations/00065_proposals.sql` — **NEW** — 239 lines. Full migration per amended spec.
- `supabase/migrations/00065_proposals.down.sql` — **NEW** — 17 lines. Drops both tables in reverse-dependency order.
- `__tests__/proposals-schema.test.ts` — **NEW** — 27 cases covering migration existence, structure, triggers, indexes, RLS, policies (3-policy pattern + no-DELETE regression guard), and `public.` qualification.

Plan amendments (`docs/nightwork-rebuild-plan.md`) shipped separately in commit `4fd3e7d`.

---

## 9. Flagged discoveries

1. **[RESOLVED] DELETE policy spec diverged from codebase precedent; stripped pre-push.** The initial execution prompt called for 4 policies per table (SELECT/INSERT/UPDATE/DELETE). The Schema Validator finding in §6 identified this as a 1-policy expansion over the canonical cost_intelligence_spine (00052) precedent, which uses 3 policies and relies on RLS default-deny to block hard DELETE. After review, the DELETE policies were stripped before push — a hard DELETE would defeat R.6 (destructive-action guards) and R.7 (status_history) by erasing the audit trail. Soft-delete via `deleted_at` is the established convention. Final state: 3 policies per table on both `proposals` and `proposal_line_items`. Correction is the motivating case for new standing rule R.23 (codebase-precedent check for RLS and conventions), landed in a separate plan-doc commit. Historical note preserved for the paper trail.

2. **`source_document_id` FK still unconstrained.** The `document_extractions` table referenced by CLAUDE.md §0.6 R.9 and plan §2.3 enum inventory does not yet exist on dev. Migration leaves `source_document_id UUID` as a bare UUID column (plan-spec-consistent). When `document_extractions` lands, a follow-up migration will add the FK constraint. No new issue opened — plan §0.6 already tracks this.

3. **Dry-run `updated_at` FAIL was a harness artifact, not a migration defect.** Within a single `BEGIN/ROLLBACK` block, `NOW()`/`transaction_timestamp()` is constant, so `INSERT`-then-`UPDATE` in one txn sees the same timestamp. Re-verified with a seed-an-old-value probe; trigger fires correctly. See §5 detail.

4. **GH issue #6 (line-item audit-column retrofit)** opened during pre-flight amendment pass (commit 4fd3e7d). Tracks the retrofit of `updated_at` + `created_by` onto `po_line_items` and `change_order_lines` to match the going-forward pattern established by `proposal_line_items`. Deferred to Branch 8 (polish).
