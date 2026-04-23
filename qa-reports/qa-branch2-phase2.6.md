# QA Report — Branch 2 Phase 2.6: Approval chains

**Date:** 2026-04-22
**Commit:** pending (this file ships with the `feat(approvals): add approval_chains + workflow-type-aware seed trigger` commit)
**Migration:** `supabase/migrations/00070_approval_chains.sql` (+ `.down.sql`)
**Test:** `__tests__/approval-chains.test.ts` (30 cases)
**Amended spec commit (already on main):** `317961d` (8 amendments A–H, F-ii scope decision)
**Renumber commit (already on main):** `73eaba8` (Phase 2.5 ↔ 2.6 swap after Markgraf pivot)
**Pre-flight findings (on main):** `303d5c9` / `8895ca5` / `qa-reports/preflight-branch2-phase2.6.md`
**GH #12 (tracked adjacency):** onboarding-wizard override for Ross-Built-derived default approval chains (remodelers + other org types will need UI affordance)
**Status:** READY FOR REVIEW — not yet pushed to origin/main (per prompt step 8)

---

## 1. Executive summary

Ships Phase 2.6 (approval_chains) per the amended plan spec. All 8 pre-flight amendments (A–H) plus the F-ii scope decision landed verbatim:

- **F-ii Scope decision** — `approval_actions` table NOT created. Audit continues through `status_history` JSONB on each workflow entity + `public.activity_log`. A third audit surface adds footprint without answering a query not already answerable from those two.
- **A Full audit-column set** — `id`, `org_id`, `workflow_type`, `name`, `is_default`, `conditions`, `stages`, `created_at`, `updated_at`, `created_by`, `deleted_at` (11 columns + the `workflow_type` CHECK enum). `trg_approval_chains_updated_at` registered.
- **B R.23 divergence** — 3-policy RLS (`org_read`/`org_insert`/`org_update`; no DELETE) adopted from 00065 proposals, **write role-set narrowed** from proposals' `(owner, admin, pm, accounting)` to `(owner, admin)` only. `approval_chains` is tenant config, not workflow data — PMs should not edit who approves what. Read policy remains tenant-wide so workflow UIs can show approval-routing hints to any member without a privileged round-trip.
- **C Partial unique indexes with soft-delete predicates** — `approval_chains_one_default_per_workflow (org_id, workflow_type) WHERE is_default = true AND deleted_at IS NULL` + `approval_chains_unique_name_per_workflow (org_id, workflow_type, name) WHERE deleted_at IS NULL`. Soft-deleting a default frees the slot for a replacement; see §5 positive-probe result.
- **D Seed trigger + DRY helper** — `public.create_default_approval_chains()` (SECURITY DEFINER, pinned `search_path = public, pg_temp`, ON CONFLICT DO NOTHING — mirrors `create_default_workflow_settings` from 00032). Stages are workflow-type-aware via the small helper `public.default_stages_for_workflow_type(text)` (IMMUTABLE, pinned search_path). Both the trigger and the one-time backfill call the helper; the CASE logic is a single source of truth.
  - `invoice_pm → [pm]`
  - `invoice_qa → [accounting]`
  - `co / draw / po / proposal → [owner, admin]`
- **F GRANT pattern extended to public schema** — explicit `GRANT EXECUTE … TO authenticated` on **both** functions per the 00067 / Amendment F.2 defense-in-depth posture. See §5 live-auth + `has_function_privilege` probes.
- **G Paired down.sql** — strict reverse-dependency order.
- **H R.15 test file** — 30 static assertions covering migration + down.sql; dynamic probes (live-auth RLS, GRANT verification, workflow-type-aware default-stages verification, seed-trigger verification, soft-delete unblocking) recorded in §5 per R.19.

**Important discovery** (flagged in §5 and §8): the Migration Dry-Run surfaced that the amended plan spec's `ON CONFLICT (org_id, workflow_type, name) DO NOTHING` clause **fails** with `42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification` because the backing unique index is PARTIAL (Amendment C soft-delete narrowing). PostgreSQL requires the ON CONFLICT clause to repeat the partial index's predicate for inference. The migration now carries `ON CONFLICT (org_id, workflow_type, name) WHERE deleted_at IS NULL DO NOTHING` at both call sites (seed function + one-time backfill), a RUNTIME NOTE in the header documenting the discovery, and a regression-fence test assertion so future readers don't strip the predicate.

No application code touched (0 `src/` references to new identifiers; Branch 6/7 lights up writers). R.19 static-validation carve-out applies — both conditions cited in §2.

---

## 2. Exit gate checklist

### Universal standing rules (G.2)

| Rule | Status | Notes |
|---|---|---|
| R.1 No process killing | ✅ PASS | No kill/pkill/taskkill. |
| R.2 Recalculate, not increment | ✅ N/A | No derived-value mutations. |
| R.3 Org-configurable, not hardcoded | ⚠ SEED DEFAULT | Default stages are Ross-Built-derived heuristics; **tracked as GH #12** for onboarding-wizard override. Orgs can freely UPDATE / INSERT additional chains post-seed — defaults aren't load-bearing. |
| R.4 Rebuild over patch | ✅ PASS | Net-new first-class entity; no prior approvals table pattern migrated. |
| R.5 Trace, don't assume | ✅ PASS | Pre-flight findings re-run at kickoff: 3 live orgs confirmed, 00069 last applied, `approval_chains`/`approval_actions` regclass both null, `public.update_updated_at()` present, 00065 proposals still has 3-policy shape, 00032 organizations seed trigger still registered. |
| R.6 Block destructive actions | ✅ PASS | No DELETE policy; soft-delete via `deleted_at`. |
| R.7 status_history on state changes | ✅ N/A | No status-tracked lifecycle on `approval_chains` itself — it's tenant config. |
| R.8 Amounts in cents | ✅ N/A | No money columns. |
| R.9 source_document_id | ✅ N/A | Not a document-derived entity. |
| R.10 Optimistic locking on mutations | ✅ N/A | No new mutation endpoints (Branch 6/7). |
| R.11 Screenshots inline | ✅ N/A | No UI changes. |
| R.12 Data integrity before features | ✅ PASS | Two partial unique indexes + CHECK enum + FKs. |
| R.13 Server-side business logic | ✅ PASS | Seed logic in SECURITY DEFINER functions. |
| R.14 Multi-tenant via org_id | ✅ PASS | `org_id UUID NOT NULL REFERENCES public.organizations(id)`. |
| R.15 R.15 test-first | ✅ PASS | 30 static assertions written before the migration file. Baseline: 29/29 FAIL pre-apply (§5.1). After adding the ON CONFLICT partial-index regression fence: 30/30 PASS (§5.2). |
| R.16 Paired down.sql | ✅ PASS | `00070_approval_chains.down.sql` drops in strict reverse-dependency order. |
| R.17 Pre-flight grep before write | ✅ PASS | Grep pre-flight (already in `preflight-branch2-phase2.6.md`) recorded 0 existing `src/` references to `approval_chains*`, `create_default_approval_chains`, or `default_stages_for_workflow_type`. |
| R.18 Blast-radius recap | ✅ PASS | §3 below. |
| R.19 Static-validation carve-out | ✅ PASS | Both conditions met: (a) **no runtime code touched** — all 0 `src/` references; (b) **Migration Dry-Run exercised DB stack** including structural probes, 4 negative probes, soft-delete unblocking, idempotency, seed-trigger synthetic INSERT, `has_function_privilege` GRANT probes, and live-auth RLS probes (owner/admin/pm/accounting/stranger) — all in §5. |
| R.20 Optimistic locking column | ✅ PASS | `updated_at` NOT NULL DEFAULT now(), trigger-maintained. |
| R.21 `public.` schema qualification | ✅ PASS | Every DDL + backfill statement qualifies. |
| R.22 Migration-file atomicity | ✅ PASS | Single `apply_migration` call via Supabase MCP (atomic or full rollback). |
| R.23 Apply precedent faithfully, divergences documented | ✅ PASS | Precedent: 00065 proposals (3-policy; no DELETE). **Intentional divergence:** write role-set narrowed from `(owner, admin, pm, accounting)` to `(owner, admin)`. Divergence documented in migration header `B (R.23 divergence)` block + `COMMENT ON TABLE`. Structural shape (policy count, DELETE posture) matches verbatim. |

---

## 3. R.18 blast-radius recap

**New DB objects (all additive):**
- 1 table: `public.approval_chains` (11 columns + CHECK enum).
- 2 partial unique indexes: `approval_chains_one_default_per_workflow`, `approval_chains_unique_name_per_workflow`.
- 1 implicit PK index (`approval_chains_pkey`).
- 3 RLS policies: `approval_chains_org_read`, `approval_chains_org_insert`, `approval_chains_org_update`.
- 2 functions: `public.default_stages_for_workflow_type(text)` (helper, IMMUTABLE), `public.create_default_approval_chains()` (seed function, SECURITY DEFINER).
- 2 GRANT EXECUTE statements (Amendment F.2, both functions, `TO authenticated`).
- 2 triggers: `trg_approval_chains_updated_at` (BEFORE UPDATE), `trg_organizations_create_default_approval_chains` (AFTER INSERT on `public.organizations`).
- 18 backfill rows (3 live orgs × 6 `workflow_type` values).
- 3 COMMENTs (table + both functions).

**Existing DB objects touched:**
- `public.organizations` — gains 1 new AFTER INSERT trigger alongside the existing `trg_organizations_create_workflow_settings` (00032). No schema change.

**Existing `src/` code touched:**
- None. 0 references in pre-flight grep; Branch 6/7 will light up writers.

---

## 4. Schema Validator pre + post state

### 4.1 Pre-migration probes (2026-04-22, commit 303d5c9)

| Probe | Result |
|---|---|
| Live org count (excluding soft-deleted) | `3` |
| Last applied migration | `00069_draw_adjustments` (2026-04-22) |
| `to_regclass('public.approval_chains')` | `null` — no pre-existing table |
| `to_regclass('public.approval_actions')` | `null` — F-ii decision preserved |
| `to_regprocedure('public.update_updated_at()')` | `update_updated_at()` — shared trigger function still present |
| `to_regprocedure('public.create_default_workflow_settings()')` | present — 00032 precedent still intact |
| `public.proposals` policies | exactly 3 — `proposals_org_insert`, `proposals_org_read`, `proposals_org_update` (R.23 precedent intact) |
| `public.organizations` triggers | `trg_organizations_create_workflow_settings`, `trg_organizations_updated_at` (00032 precedent intact) |

### 4.2 Post-apply probes (live state after `apply_migration`)

| Probe | Result |
|---|---|
| `to_regclass('public.approval_chains')` | present |
| `pg_class.relrowsecurity` for approval_chains | `true` |
| Policy count | `3` |
| Policies | `approval_chains_org_insert` (INSERT), `approval_chains_org_read` (SELECT), `approval_chains_org_update` (UPDATE) |
| DELETE policy present? | `false` (R.23 precedent: soft-delete via `deleted_at`) |
| Indexes (definitions verified) | `approval_chains_one_default_per_workflow (org_id, workflow_type) WHERE is_default=true AND deleted_at IS NULL` / `approval_chains_unique_name_per_workflow (org_id, workflow_type, name) WHERE deleted_at IS NULL` / `approval_chains_pkey (id)` |
| `trg_approval_chains_updated_at` on approval_chains | present |
| `trg_organizations_create_default_approval_chains` on organizations | present |
| `default_stages_for_workflow_type(text)` — IMMUTABLE? | `true` |
| `default_stages_for_workflow_type(text)` — SECURITY DEFINER? | `true` |
| `default_stages_for_workflow_type(text)` — `search_path` | `search_path=public, pg_temp` |
| `create_default_approval_chains()` — SECURITY DEFINER? | `true` |
| `create_default_approval_chains()` — `search_path` | `search_path=public, pg_temp` |
| `has_function_privilege('authenticated', 'public.default_stages_for_workflow_type(text)', 'EXECUTE')` | `true` |
| `has_function_privilege('authenticated', 'public.create_default_approval_chains()', 'EXECUTE')` | `true` |
| Backfilled row count | `18` |
| Every org has exactly 6 rows? | `true` (3 orgs × 6) |
| Every `workflow_type` has exactly 3 rows? | `true` (6 types × 3 orgs) |
| All 18 rows have `is_default = true`? | `true` |

### 4.3 Workflow-type-aware default verification (18 rows)

Grouped by `workflow_type` (each value repeats across all 3 orgs with identical `stages->0->>'required_roles'` — confirmed via `SELECT DISTINCT`):

| org_id (3 orgs) | workflow_type | `stages->0->>'required_roles'` | Amendment D.2 expected | Match? |
|---|---|---|---|---|
| `00000000…000000000001` / `60a3e876…62baed96d501` / `c0a42420…0d6e3ce17519` | `invoice_pm` | `["pm"]` | `["pm"]` | ✅ |
| (same three orgs) | `invoice_qa` | `["accounting"]` | `["accounting"]` | ✅ |
| (same three orgs) | `co` | `["owner", "admin"]` | `["owner","admin"]` | ✅ |
| (same three orgs) | `draw` | `["owner", "admin"]` | `["owner","admin"]` | ✅ |
| (same three orgs) | `po` | `["owner", "admin"]` | `["owner","admin"]` | ✅ |
| (same three orgs) | `proposal` | `["owner", "admin"]` | `["owner","admin"]` | ✅ |

All 18 rows match expected Amendment D.2 defaults. Proves the CASE logic in `default_stages_for_workflow_type(text)` produced the right defaults during backfill — not just that "some default" landed.

---

## 5. Migration Dry-Run findings

**Methodology:** Full migration DDL + backfill wrapped in `BEGIN ... ROLLBACK` via Supabase MCP `execute_sql` for structural + positive probes (no state persisted on failure or success). `apply_migration` for the real apply, then negative / live-auth RLS / GRANT / idempotency / synthetic-seed probes run against live state using `BEGIN ... ROLLBACK` blocks with `SET LOCAL role authenticated` + `SET LOCAL request.jwt.claims` so nothing mutates persisted data.

### 5.1 R.15 baseline (pre-migration)

`npx tsx __tests__/approval-chains.test.ts`:

> `29 of 29 test(s) failed` — every assertion ENOENTs on `supabase/migrations/00070_approval_chains.sql` / `.down.sql` (files don't exist yet).

### 5.2 R.15 post-migration

`npx tsx __tests__/approval-chains.test.ts` (30 cases after the partial-index ON CONFLICT regression fence):

> `30 test(s) passed`

Full suite `npm test`: **218 tests passed** across 11 test files (188 pre-existing + 30 new Phase 2.6).

### 5.3 Structural probes (BEGIN/ROLLBACK dry-run → live-state post-apply)

See §4.2 table — every probe green.

### 5.4 Negative probes (four categories)

| # | Probe | Expected | Result |
|---|---|---|---|
| neg1 | INSERT with `workflow_type='invalid'` | `check_violation` (23514) | ✅ caught by DO block EXCEPTION WHEN `check_violation` |
| neg2 | INSERT without `org_id` | `not_null_violation` (23502) | ✅ caught |
| neg3 | INSERT a 2nd `is_default=true` for same `(org_id, workflow_type)` | `unique_violation` on `approval_chains_one_default_per_workflow` | ✅ caught |
| neg4 | INSERT duplicate `(org_id, workflow_type, name)` triple | `unique_violation` on `approval_chains_unique_name_per_workflow` | ✅ caught |

### 5.5 Positive probes

| Probe | Result |
|---|---|
| Idempotency — re-run backfill SELECT | `count_before=18 / count_after=18 / rerun_inserted=0` (ON CONFLICT DO NOTHING works) |
| Soft-delete a default then INSERT new default for same `(org_id, workflow_type)` | succeeded (returned new row with `is_default=true`) — partial-index soft-delete narrowing works |
| Synthetic org INSERT fires seed trigger | DO block inserted a new org, then verified: `seeded_row_count=6` and all 6 `workflow_type`s have the expected workflow-type-aware stages (`["pm"]` / `["accounting"]` / `["owner","admin"]` ×4). `ROLLBACK` — no persistent org created. |
| `updated_at` trigger bumps timestamp | Seeded a 2020 value, UPDATEd `conditions`, re-read: `updated_at > 2025-01-01` → `true`, actual value `2026-04-23 00:55:25+00`. |

### 5.6 GRANT-verification probes (Amendment F.2)

| Probe | Result |
|---|---|
| `has_function_privilege('authenticated', 'public.default_stages_for_workflow_type(text)', 'EXECUTE')` | `true` |
| `has_function_privilege('authenticated', 'public.create_default_approval_chains()', 'EXECUTE')` | `true` |

### 5.7 Live-auth RLS probes

All via `SET LOCAL role authenticated; SET LOCAL request.jwt.claims = '{"sub":"<user-id>","role":"authenticated"}'`. Each wrapped in `BEGIN ... ROLLBACK` so successful INSERTs don't pollute live data.

| User | Role | SELECT visible rows | INSERT outcome | Matches R.23 divergence? |
|---|---|---|---|---|
| Jake (`a0000000…000000000001`) | owner / org 00000001 | 6 (own org only) | ✅ success | ✅ owner allowed |
| Andrew (`a0000000…000000000009`) | admin / org 00000001 | 6 | ✅ success | ✅ admin allowed |
| Bob (`a0000000…000000000004`) | pm / org 00000001 | 6 (tenant-wide read — **no PM narrowing, by design** — tenant config) | ❌ `insufficient_privilege` (42501) | ✅ PM rejected on writes |
| Diane (`a0000000…000000000008`) | accounting / org 00000001 | 6 | ❌ `insufficient_privilege` | ✅ accounting rejected on writes |
| `ffffffff…` | stranger (no org_members row) | `0` (can't see any chains) | ❌ `insufficient_privilege` | ✅ stranger rejected |

PM and accounting both SEE the chains (tenant-wide read policy) but cannot INSERT — confirms the R.23 **structural** narrowing (3-policy shape preserved) with **predicate-level** narrowing on writes (role IN ('owner','admin') only). Divergence from proposals' 4-role write set is working as designed.

### 5.8 Regression-fence passes

| Subject | Pass |
|---|---|
| 00065 proposals still has 3 policies (no DELETE) | ✅ (§4.1 precedent check) |
| 00032 `trg_organizations_create_workflow_settings` still registered | ✅ |
| `public.update_updated_at()` still the shared trigger function | ✅ |

---

## 6. R.19 carve-out — both conditions cited

R.19 grants a static-validation carve-out when **both** conditions hold:

1. **No runtime code touched.** Confirmed: pre-flight §2 grep recorded 0 `src/` references to `approval_chains`, `create_default_approval_chains`, `default_stages_for_workflow_type`. The post-apply `npm run build` succeeded without touching any new identifiers. Branch 6/7 (settings UI) will later introduce consumers.
2. **Migration Dry-Run exercised the DB stack.** Confirmed in §5: structural probes across table / indexes / policies / triggers / functions; 4 negative probes (CHECK, NOT NULL, both partial unique indexes); 4 positive probes (idempotency, soft-delete unblocking, seed trigger synthetic INSERT, updated_at); 2 GRANT probes; 5 live-auth RLS probes covering owner / admin / pm / accounting / stranger.

Both conditions met.

---

## 7. R.23 precedent statement

Phase 2.6 adopts **00065 proposals** as the tenant-table precedent:

- **Structural shape preserved:** 3 policies — `org_read` (SELECT), `org_insert` (INSERT), `org_update` (UPDATE). No DELETE policy. Soft-delete via `deleted_at` (cost_intelligence_spine / proposals precedent). Policy count + DELETE posture match verbatim.
- **Documented intentional divergence (predicate-level narrowing):** write role-set narrowed from proposals' `(owner, admin, pm, accounting)` to `(owner, admin)` only. `approval_chains` is tenant config, not workflow data — PMs and accounting users should not edit who approves what. Read policy remains tenant-wide so workflow UIs can show approval-routing hints to any member without a privileged round-trip.
- **Seed trigger placement follows 00032** (`create_default_workflow_settings`) — seed functions live in `public` schema, not `app_private`. Validator / helper functions (e.g., `app_private.validate_cost_code_hierarchy` from Phase 2.4) live in `app_private`.
- **Amendment F.2 GRANT-verification pattern extended to `public` schema** — both functions explicitly `GRANT EXECUTE … TO authenticated`, per the 00067 defense-in-depth posture that closed the GH #9 class of latent authenticated-role permission gaps.

---

## 8. Flagged discoveries

### 8.1 ON CONFLICT partial-index predicate (fixed in migration + test + header)

The amended plan spec at `docs/nightwork-rebuild-plan.md` lines 3840 + 3867 specified:

```sql
ON CONFLICT (org_id, workflow_type, name) DO NOTHING
```

The Migration Dry-Run surfaced PostgreSQL error `42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification` because the backing unique index (`approval_chains_unique_name_per_workflow`) is PARTIAL (`WHERE deleted_at IS NULL`). PostgreSQL requires the ON CONFLICT clause to repeat the partial index's predicate for inference.

**Fix (applied to both sites in the migration):**

```sql
ON CONFLICT (org_id, workflow_type, name) WHERE deleted_at IS NULL DO NOTHING
```

**Defenses layered:**

1. Migration header carries a RUNTIME NOTE documenting the discovery so future readers don't strip the predicate when touching the file.
2. Test file `__tests__/approval-chains.test.ts` adds an explicit regression fence asserting that BOTH the seed function's INSERT and the one-time backfill's INSERT include `WHERE deleted_at IS NULL` on their ON CONFLICT clauses.
3. An additional test asserts the header contains a RUNTIME NOTE block referencing `42P10` / partial-index ON CONFLICT, so header-only drift can't silently erase the rationale.

**Plan-doc follow-up:** the plan snippet at lines 3840 + 3867 should be amended to match the migration. Recommend tracking as a small docs-only PR — the migration is the source of truth per R.16, and drift here is caught by the migration apply itself (not silent).

### 8.2 PostgreSQL MVCC snapshot in single-statement probes (dry-run methodology, not a migration issue)

An initial synthetic-org seed probe attempted `WITH new_org AS (INSERT INTO organizations ... RETURNING id) SELECT (SELECT count(*) FROM approval_chains WHERE org_id = (SELECT id FROM new_org))`. The SELECT returned `0` even though the AFTER INSERT trigger had fired, because all sub-statements in a single WITH share an MVCC snapshot and cannot see each other's writes (per PostgreSQL docs, "Modifying Data in WITH"). Re-ran via a `DO $$` block where statements execute sequentially; subsequent SELECTs see the trigger's writes. Not a migration issue — methodology fix only. Documented here for future dry-run authors.

---

## 9. Test results

`npm test` (full suite via `__tests__/_runner.ts`):

- `approval-chains.test.ts` — **30 passed**
- `co-type-expansion.test.ts` — passed
- `cost-codes-hierarchy.test.ts` — passed
- `created-by-populated.test.ts` — passed
- `draw-adjustments.test.ts` — passed
- `draw-rpc-cascade.test.ts` — passed
- `job-phase-contract-type.test.ts` — passed
- `lien-release-waived-at.test.ts` — passed
- `po-patch-role-check.test.ts` — passed
- `proposals-schema.test.ts` — 27 passed
- `status-enum-alignment.test.ts` — 20 passed

**Total: 218 tests passed across 11 test files.** Runner reports `all test files passed`.

`npm run build`: completed without errors. Next.js `+ First Load JS shared by all 159 kB`.

---

## 10. Branch 2 Final Exit Gate progress

| Phase | Migration | Status |
|---|---|---|
| 2.1 | 00064_job_phase_contract_type | ✅ applied |
| 2.2 | 00065_proposals | ✅ applied |
| 2.3 | 00066_co_type_expansion | ✅ applied |
| 2.3 follow-up | 00067_co_cache_trigger_authenticated_grants | ✅ applied |
| 2.4 | 00068_cost_codes_hierarchy | ✅ applied |
| 2.5 | 00069_draw_adjustments | ✅ applied |
| **2.6** | **00070_approval_chains** | ✅ **applied (this report)** |
| 2.7 | 00071_milestones_retainage | ⬜ not started |
| 2.8 | (pending spec) | ⬜ not started |
| 2.9 | (pending spec) | ⬜ not started |
| 2.10 | (pending spec) | ⬜ not started |

**7 of 11 migrations applied.** Phase 2.6 complete pending user review + push.

---

## 11. Next-turn actions for Jake

1. Review this QA report.
2. Review the migration + test diffs (commit pending push).
3. If green: `git push origin main`.
4. Optional: file a follow-up docs PR to sync `docs/nightwork-rebuild-plan.md` lines 3840 + 3867 with the partial-index ON CONFLICT predicate — plan snippet otherwise won't compile verbatim.
