# QA Report — Branch 2 Phase 2.4: Cost codes hierarchy + starter templates

**Date:** 2026-04-22
**Commit:** `bd3187f` (pending push)
**Migration:** `supabase/migrations/00068_cost_codes_hierarchy.sql` (+ `.down.sql`)
**Test:** `__tests__/cost-codes-hierarchy.test.ts` (24 cases)
**Plan amendment commit (already on main):** `95df1b4`
**Pre-flight findings (on main):** `a33b502` / `qa-reports/preflight-branch2-phase2.4.md`
**Status:** READY FOR REVIEW — not yet pushed to origin/main

---

## 1. Executive summary

Ships Phase 2.4 per the amended plan spec. Six amendments A–F (landed in plan commit `95df1b4`) were all executed:

- **A.** Hierarchy validation: `app_private.validate_cost_code_hierarchy()` (SECURITY DEFINER, search_path=public) walks the `parent_id` chain and `RAISE EXCEPTION`s on cycles or depth > 3. Registered as `trg_cost_codes_hierarchy BEFORE INSERT OR UPDATE OF parent_id`. Explicit `GRANT EXECUTE … TO authenticated` mirrors 00067's pattern to pre-empt the GH #9 class of bug.
- **B.** `public.cost_code_templates` lands with the `unit_conversion_templates` (00054) precedent — 2 RLS policies (`cct_read` authenticated SELECT, `cct_platform_admin_write` platform-admin ALL), no `org_id`, minimal audit columns (id / created_at / updated_at). R.23 accepted divergence from CLAUDE.md per-row audit rule because cost_code_templates is a system catalog, not tenant-scoped.
- **C.** Idempotent seed — 4 starter-template rows with `ON CONFLICT (name) DO NOTHING`. All `codes` JSONB bodies seed as `'{}'::jsonb` placeholders. Migration header documents that Phase 7.5 owns the population + route cutover (GH #11).
- **D.** `is_allowance` two-layer naming hygiene. Migration header + `COMMENT ON COLUMN` document that `cost_codes.is_allowance` is the template default and `budget_lines.is_allowance` (migration 00014) is the instance override. UI affordance work tracked under GH #10.
- **E.** Paired `00068_cost_codes_hierarchy.down.sql` per R.16.
- **F.** R.15 test file with the two pre-flight-added probes: (F.1) live-auth RLS probe on `cost_code_templates` (mirrors Phase 2.2 §6 DELETE-block verification), (F.2) `has_function_privilege('authenticated', 'app_private.validate_cost_code_hierarchy()', 'EXECUTE')` probe catching the GH #9 class of bug at test time.

No application code touched (all 5 `src/app/api/cost-codes/*` routes are pass-through). R.19 static-validation carve-out applies — both conditions cited in §2.

---

## 2. Exit gate checklist

### Universal standing rules (G.2)

| Rule | Status | Notes |
|---|---|---|
| R.1 No process killing | ✅ PASS | No kill/pkill/taskkill. |
| R.2 Recalculate, not increment | ✅ N/A | No derived-value mutations. |
| R.3 Org-configurable, not hardcoded | ✅ N/A | Hierarchy depth cap (3) is from Part 2 §1.3, not an org policy. |
| R.4 Rebuild over patch | ✅ PASS | Additive — EXTEND path correct per G.5 tree. |
| R.5 Trace, don't assume | ✅ PASS | Pre-flight C1–C7 re-probed at kickoff (§6); all counts and identifiers matched. |
| R.6 Block destructive actions | ✅ N/A | No delete/void paths touched. |
| R.7 status_history on state changes | ✅ N/A | cost_codes is a catalog, not a workflow entity. |
| R.8 Amounts in cents | ✅ PASS | `default_allowance_amount BIGINT` (cents). |
| R.9 source_document_id | ✅ N/A | No drag-createable entity. |
| R.10 Optimistic locking on mutations | ✅ N/A | No new mutation endpoints. |
| R.11 Screenshots inline | ✅ N/A | No UI changes. |
| R.12 Single QA file in `./qa-reports/` | ✅ PASS | This file at `qa-reports/qa-branch2-phase2.4.md`. |
| R.13 Read CLAUDE.md first | ✅ PASS | Read; architecture rules (cents, soft-delete, org_id) applied. R.23 accepted divergence on `cost_code_templates` documented. |
| R.14 No placeholder content | ✅ PASS | `'{}'::jsonb` placeholders on template `codes` are intentional — Phase 7.5 populates real data per the amended plan. Not "coming soon" UI. |
| R.15 Test-first when possible | ✅ PASS | Baseline 23/24 FAIL captured before migration (1 PASS = TEMPLATE_ORG_ID regression guard, correctly unchanged). Post-implementation 24/24 PASS. Full suite 159/159. |
| R.16 Migrations are source of truth | ✅ PASS | Both files written to git before `apply_migration`. MCP call applied body matching the git-tracked SQL (abridged narrative headers; amendment-history documentation lives in the git file). |
| R.17 Atomic commits | ✅ PASS | Single commit `bd3187f` contains migration + down + test. Test + build both pass on the commit. |
| R.18 Spec file list is advisory | ✅ PASS | Pre-flight §2 classification table enumerated 46 `cost_codes` pass-through sites, 5 admin routes, 0 sites requiring code changes. Commit touched zero app code — matches pre-flight scope exactly. |
| R.19 Live execution of manual tests | ✅ N/A — **static-validation carve-out both conditions cited below** | |
| R.20 Read project scripts before invoking | ✅ PASS | `__tests__/_runner.ts` inspected; test file follows the proposals-schema / co-type-expansion template. `npm run build` is stock Next. |
| R.21 Synthetic fixtures | ✅ PASS | Dry-run fixtures (`ZZZ_DR_ROOT`, `ZZZ_DR_L1`–`L4`, `ZZZ_DR_X`/`Y`, `ZZZ_PHASE_2_4_TEST_UNAUTHORIZED`) all inside `BEGIN/ROLLBACK`; never committed. No post-apply fixtures. |
| R.22 Teardown sequencing | ✅ N/A | No committed fixtures → no teardown. Rollback path is `00068_*.down.sql`. |
| R.23 Codebase-precedent check | ✅ PASS | `unit_conversion_templates` (migration 00054) adopted as precedent. 2-policy RLS structure verbatim. Accepted divergence from per-row audit columns documented in both migration header and `COMMENT ON TABLE`. |

### R.19 static-validation carve-out (both conditions cited)

- **(a) No runtime code path touched.** Pre-flight §2 classified all 46 `cost_codes` / 54 `cost_code_id` src/ references as passthrough joins or unaffected admin routes. The commit diff is migration + down + test — zero TypeScript / React / API-route changes. The only surface that could be exercised end-to-end (post-apply UI on `/settings/cost-codes`) reads existing columns and renders them; new columns (`parent_id`, `is_allowance`, `default_allowance_amount`) are absent from every current query selector — they light up only when Branch 4/7 implements the hierarchy UI.
- **(b) Migration Dry-Run exercised the full DB stack.** §5 documents 23 probes inside `BEGIN/ROLLBACK`: 15 structural (columns, FKs, function SECURITY DEFINER, EXECUTE grant to authenticated, trigger registration, table shape, UNIQUE constraint, RLS enablement, policy count + names + predicates, seed count + names, cost_codes unchanged), 3 negative (self-reference, 4-deep depth, 2-node cycle — all raise cleanly), 3 positive (default INSERT lands expected values, ON CONFLICT seed is idempotent, updated_at trigger fires via post-apply separate-txn re-probe), and 2 live-auth RLS probes (authenticated non-platform-admin SELECT returns all 4 rows; INSERT rejected under 42501 `insufficient_privilege`).

Per R.19 as amended 2026-04-22, this phase meets the carve-out criteria.

### Phase-specific (Branch 2 Final Exit Gate progress)

| Branch 2 item | Status |
|---|---|
| All 10 migrations (00064 through 00073, with 00067 as the mid-branch grant fix) applied on dev, committed to git | 🟨 **5/10 complete** (00064 + 00065 + 00066 + 00067 + 00068) — i.e. **4/9 phase migrations** + the mid-branch grant fix |
| Schema validator findings confirm alignment with Part 2 data model | ✅ for 2.4 (see §6) |
| No migrations apply changes via MCP that aren't in git files | ✅ PASS |
| `cost_codes` new columns don't break existing workflows | ✅ PASS (0 rows affected by column adds; defaults preserve existing semantics) |

---

## 3. Git log (pending push)

```
bd3187f  feat(cost-codes): add hierarchy columns + system templates
a33b502  docs(qa): Phase 2.4 pre-flight findings
95df1b4  docs(plan): Phase 2.4 pre-flight amendments — A hierarchy trigger, B template RLS precedent, C idempotent seed + 7.5 cutover note, D is_allowance naming hygiene + GH #10, E down.sql, F R.15 tests + live-auth RLS probe + GRANT verification, plus TEMPLATE_ORG_ID deprecation GH #11
ddf4063  docs(plan): renumber Phase 2.4–2.9 to 00068–00073 (00067 taken by grant fix) + GH #9 reference
24df2ad  docs(qa): Phase 2.3 live test addendum (R.19 closure)
1a24e64  fix(db): grant authenticated USAGE on app_private for CO cache trigger
16bebcb  scripts(qa): Phase 2.3 live test teardown
a6753a5  docs(qa): Branch 2 Phase 2.3 QA report
b746cf7  feat(co): expand CO types and add pricing_mode, source_proposal_id
```

---

## 4. R.18 blast-radius recap (from pre-flight commit `a33b502`)

Classifications matched the commit exactly:

| Class | Pre-flight count | Touched in this commit |
|---|---|---|
| Type A passthrough (cost_codes SELECT-joins) | 46 src files | 0 (unaffected by column adds) |
| Type B write paths (`src/app/api/cost-codes/*`) | 5 admin routes | 0 (defaults cover the new columns; no validator update needed) |
| Type C TEMPLATE_ORG_ID pattern (`src/app/api/cost-codes/template/route.ts`) | 1 file | 0 (Phase 7.5 owns the cutover per GH #11; regression guard in R.15 confirms it's unchanged) |
| Type D UI degradations | 0 | 0 |
| New identifiers (`parent_id`, `cost_code_templates`, `is_system`, `default_allowance_amount`) | 0 hits outside docs | Introduced in the commit |
| Name-collision (`is_allowance` on cost_codes vs. budget_lines) | Budget-lines side unchanged; 30+ src files | Documented via migration header + `COMMENT ON COLUMN`; UI work tracked in GH #10 |

---

## 5. Migration Dry-Run findings

Executed against dev Postgres via Supabase MCP `execute_sql` inside two `BEGIN/ROLLBACK` blocks.

### Structural probes (15/15 PASS)

| Probe | Expected | Observed |
|---|---|---|
| `cost_codes.parent_id` | uuid, nullable | `{"type":"uuid","nullable":"YES"}` ✅ |
| `cost_codes.is_allowance` | boolean, NOT NULL, default `false` | `{"type":"boolean","nullable":"NO","default":"false"}` ✅ |
| `cost_codes.default_allowance_amount` | bigint, nullable | `{"type":"bigint","nullable":"YES"}` ✅ |
| `app_private.validate_cost_code_hierarchy` exists and is SECURITY DEFINER | true | `true` ✅ |
| `has_function_privilege('authenticated', …, 'EXECUTE')` (Amendment F.2 probe) | true | `true` ✅ |
| `trg_cost_codes_hierarchy` exists | 1 row in information_schema.triggers | `1` ✅ |
| `cost_code_templates` column count | 7 | `7` ✅ |
| `UNIQUE (name)` on `cost_code_templates` | true | `true` ✅ |
| RLS enabled on `cost_code_templates` | true | `true` ✅ |
| Policies on `cost_code_templates` | exactly 2: `cct_read` SELECT, `cct_platform_admin_write` ALL | `[{"name":"cct_read","cmd":"SELECT"},{"name":"cct_platform_admin_write","cmd":"ALL"}]` ✅ |
| `trg_cost_code_templates_updated_at` registered | yes | `trg_cost_code_templates_updated_at` ✅ |
| `cost_code_templates` seeded rows | 4 | `4` ✅ |
| Seeded names | alphabetical (CSI / Custom Home / Empty / Remodeler) | all 4 present ✅ |
| `cost_codes` live row count unchanged | 238 | `238` ✅ |
| `cost_codes` RLS policy count unchanged | 5 | `5` ✅ |

### Negative + positive probes (7/8 dry-run; 8/8 after post-apply re-probe)

| Probe | Expected | Observed |
|---|---|---|
| POS `pos_default_insert` — INSERT cost_code omitting `parent_id` / `is_allowance` | lands with parent_id NULL, is_allowance false | `parent_id=NULL is_allowance=false` ✅ |
| NEG `neg_self_reference` — UPDATE A SET parent_id = A | trigger raises | `cycle detected` ✅ |
| NEG `neg_depth_4` — INSERT L1→L2→L3→L4 | L4 INSERT raises | `depth>3 rejected` ✅ |
| NEG `neg_2node_cycle` — X→Y then UPDATE X.parent_id=Y | trigger raises on the UPDATE | `cycle X->Y->X rejected` ✅ |
| POS `pos_seed_idempotent` — re-INSERT `'Custom Home Builder …'` under ON CONFLICT | row count unchanged | `before=4 after=4` ✅ |
| POS `pos_updated_at_trigger_fires` (dry-run) | `updated_at > old_updated_at` after an UPDATE | **FAIL in dry-run:** both `old` and `new` = `2026-04-22 21:25:47.098986+00`. Known Phase 2.2 §5 `transaction_timestamp()` artifact — within a single BEGIN/ROLLBACK block, `NOW()` is constant; the first UPDATE (seeding old value) already fires the trigger and overwrites updated_at to the txn timestamp, which the second UPDATE matches. See §5.2 for post-apply re-verification. |
| LIVE-AUTH F.1 `rls_live_auth_select` | authenticated SELECT returns 4 rows | `user=a0000000-…-003 rows=4` ✅ |
| LIVE-AUTH F.1 `rls_live_auth_insert_blocked` | non-platform-admin INSERT rejected (42501 insufficient_privilege) | `user=a0000000-…-003 insert_blocked=true` ✅ |

### §5.2 — updated_at trigger verified post-apply

After `apply_migration` completed, the trigger was re-verified in a separate query (separate transaction):

```sql
UPDATE public.cost_code_templates SET description = 'probe-separate-txn'
WHERE name = 'Remodeler (Simplified)'
RETURNING updated_at, created_at, (updated_at > created_at) AS trigger_fired;
```

Result: `updated_at=2026-04-22 21:26:44…` > `created_at=2026-04-22 21:26:31…` → **`trigger_fired: true`** ✅. Trigger confirmed. Matches Phase 2.2 QA §5 "dry-run updated_at FAIL was a harness artifact, not a migration defect" finding.

### §5.3 — Post-apply structural verification

After `apply_migration`:

| Check | Expected | Observed |
|---|---|---|
| `cost_codes` live rows | 238 (unchanged) | `238` ✅ |
| `cost_codes` rows with `parent_id IS NOT NULL` | 0 | `0` ✅ |
| `cost_codes` rows with `is_allowance <> false` | 0 | `0` ✅ |
| `cost_code_templates` rows | 4 | `4` ✅ |
| `cost_codes` policies | 5 (unchanged) | `5` ✅ |
| `cost_code_templates` policies | 2 | `2` ✅ |
| `has_function_privilege('authenticated', …, 'EXECUTE')` | true | `true` ✅ |

---

## 6. Schema Validator findings

### Pre-apply probes (re-verified at kickoff, matches pre-flight `qa-reports/preflight-branch2-phase2.4.md`)

| Probe | Expected | Observed |
|---|---|---|
| `live_cost_codes` | 238 | `238` ✅ |
| `cost_codes_policies` | 5 | `5` ✅ |
| `cost_code_templates_exists` | false | `false` ✅ |
| `parent_id_col_absent` | true | `true` ✅ |
| `is_allowance_col_absent` | true | `true` ✅ |
| `default_allowance_amount_col_absent` | true | `true` ✅ |
| `app_private_authenticated_usage` | true (from 00067) | `true` ✅ |
| `validate_hierarchy_fn_absent` | true | `true` ✅ |
| `unit_conversion_templates_present` (R.23 precedent table exists) | true | `true` ✅ |

### Post-apply state

All 15 structural probes in §5 passed. The 238 pre-existing rows remain untouched (parent_id NULL / is_allowance false); the 5 existing `cost_codes` RLS policies are unchanged; the 2 new `cost_code_templates` policies match the `unit_conversion_templates` (00054) precedent.

### R.23 precedent statement

> Phase 2.4 adopts `unit_conversion_templates` (migration 00054) as the precedent for system-level template-catalog tables — 2-policy RLS (`authenticated` SELECT + `platform_admin` ALL), no `org_id`, minimal audit columns (id, created_at, updated_at). No new tenant-table convention introduced. Column additions to `public.cost_codes` inherit its 5-policy RLS posture unchanged. The new `app_private.validate_cost_code_hierarchy()` function follows the 00067 explicit-authenticated-GRANT pattern. Accepted divergence from CLAUDE.md's per-row audit rule is documented in the migration header and `COMMENT ON TABLE public.cost_code_templates`.

### Part 2 data-model alignment

- `cost_codes.parent_id` ✅ aligns with Part 2 §1.3 "up to 3 tiers" (enforced by trigger).
- `cost_codes.is_allowance` ✅ aligns with Part 2 §1.3 allowance flag.
- `cost_code_templates` (4 system templates: Custom Home Builder / Remodeler / CSI MasterFormat / Empty) ✅ aligns with Part 2 §1.3 "four starter templates."
- `codes` JSONB shape ("nested {code, name, children}") ✅ declared in the column type; real content populated in Phase 7.5.

---

## 7. Test results

### R.15 baseline (migration + down + function + trigger + table not yet written)

`npx tsx __tests__/cost-codes-hierarchy.test.ts`:

```
23 of 24 test(s) failed
```

The 1 PASS is `src/app/api/cost-codes/template/route.ts still points TEMPLATE_ORG_ID at the Ross Built org (Phase 7.5 cutover; GH #11)` — this is the regression guard and is **supposed to pass at baseline** because Phase 2.4 explicitly does not cut over the template route. Its passing at baseline and passing post-apply both prove the guard is wired correctly.

The 23 FAILs split between `ENOENT` on the two migration files (pre-SQL-write) and static-content misses on the not-yet-created migration body.

### Post-migration + post-code (R.15 green)

`npm test` — full suite:

```
── co-type-expansion.test.ts ──        32 passed
── cost-codes-hierarchy.test.ts ──     24 passed   (NEW)
── created-by-populated.test.ts ──     15 passed
── draw-rpc-cascade.test.ts ──         11 passed
── job-phase-contract-type.test.ts ──  17 passed
── lien-release-waived-at.test.ts ──    9 passed
── po-patch-role-check.test.ts ──       4 passed
── proposals-schema.test.ts ──         27 passed
── status-enum-alignment.test.ts ──    20 passed

all test files passed
```

Total: **159 passed, 0 failed.** 135 prior + 24 new for Phase 2.4.

### Build

`npm run build` — `✓ Compiled successfully`. No TypeScript errors.

---

## 8. Files changed in this commit

**New files (3):**

- `supabase/migrations/00068_cost_codes_hierarchy.sql` — 131 lines. Full migration per amended spec (Amendments A + B + C inline). Header documents Amendments B (R.23 accepted divergence), C (Phase 7.5 TEMPLATE_ORG_ID cutover reference + GH #11), D (is_allowance two-layer semantics + GH #10). Full `public.` schema qualification on every DDL line.
- `supabase/migrations/00068_cost_codes_hierarchy.down.sql` — 28 lines. Drops policies, RLS, trigger + function + columns in strict reverse-dependency order.
- `__tests__/cost-codes-hierarchy.test.ts` — 24 cases covering migration structure (existence, columns, trigger, function, GRANTs, table + RLS + policies + seed), header-documentation regression guards (D/C/B), down-migration structure, and the TEMPLATE_ORG_ID pre-cutover regression guard.

**Modified files:** none.

Plan amendments shipped in commit `95df1b4`. Pre-flight findings in commit `a33b502`.

---

## 9. Flagged discoveries

1. **Dry-run `updated_at` trigger FAIL was a known harness artifact, not a migration defect.** The same Phase 2.2 §5 `transaction_timestamp()` constant-within-a-txn behavior applies — within a single BEGIN/ROLLBACK block, the first `UPDATE … SET updated_at = '2000-01-01'` immediately fires the trigger and rewrites `updated_at` to the transaction's `NOW()`, so my `v_old` read returned the transaction timestamp and `v_new` matched it exactly. Post-apply re-verification in a separate transaction confirmed the trigger fires correctly (`updated_at=21:26:44…` > `created_at=21:26:31…`). Added to QA §5.2.

2. **Amendment F.2 `has_function_privilege` probe passes — GH #9 class defended.** The new `app_private.validate_cost_code_hierarchy()` function has the explicit `GRANT EXECUTE … TO authenticated` from migration 00068 step (c). Post-apply: `has_function_privilege('authenticated', …, 'EXECUTE') = true`. The static test assertion (`CREATE OR REPLACE FUNCTION … GRANT EXECUTE … TO authenticated` regex in the migration file) also passes. This is the defense-in-depth pattern GH #9 asks for — future `app_private` functions called from triggers on tenant tables must include this grant, and a test assertion modeled on Amendment F.2 catches it at R.15 time rather than in a live-workflow crash.

3. **Live-auth RLS probe (Amendment F.1) passes cleanly.** Picked user `a0000000-0000-0000-0000-000000000003` (first non-platform-admin in auth.users). Under `SET LOCAL ROLE authenticated` + `request.jwt.claims.sub = <user>`: SELECT returned 4 rows (cct_read works); INSERT rejected with `42501 insufficient_privilege` (cct_platform_admin_write correctly gates non-platform-admin). Matches the Phase 2.2 `qa-branch2-phase2.2.md` §6 DELETE-block verification pattern.

4. **Zero application code touched.** All 5 `src/app/api/cost-codes/*` routes (`route.ts`, `[id]/route.ts`, `bulk/route.ts`, `import/route.ts`, `template/route.ts`) are pass-through. Column adds with defaults are transparent. `TEMPLATE_ORG_ID` stays intact as Phase 7.5's pending cutover (GH #11). Confirmed via static regression guard in `__tests__/cost-codes-hierarchy.test.ts`.

5. **Deferred: `is_allowance` UI hierarchy (GH #10) + TEMPLATE_ORG_ID cutover (GH #11)** are both Branch 4 / Phase 7.5 scope, not Phase 2.4. Both tracked.

---

## 10. Data preservation verification

| Checkpoint | Live `cost_codes` row count | `parent_id IS NOT NULL` count | `is_allowance=true` count |
|---|---|---|---|
| Pre-flight C3 (2026-04-22) | 238 | N/A (column absent) | N/A (column absent) |
| Kickoff re-probe (pre-migration) | 238 | N/A | N/A |
| Post-apply | 238 | **0** | **0** |

All 238 pre-existing `cost_codes` rows survived with the documented defaults (root-level hierarchy, non-allowance). No data modification.

---

## 11. Branch 2 Exit Gate — running tally

With 5 Branch-2 migrations applied (00064, 00065, 00066, 00067, 00068) across 4 phases (2.1, 2.2, 2.3, 2.4) plus the 00067 mid-branch grant fix:

| Gate item | Status |
|---|---|
| All 10 migrations (00064 through 00073, with 00067 as the mid-branch grant fix) applied on dev + git | 🟨 **5/10** |
| `jobs.phase` + `jobs.contract_type` defaults don't break existing workflows (Phase 2.1) | ✅ (`b268a96` + `6b5c3ac`) |
| Proposals tables exist and are empty (Phase 2.2) | ✅ (`adae700`) |
| CO type expansion + cache-trigger predicate rewrite (Phase 2.3) | ✅ (`b746cf7`) |
| Cost codes hierarchy + starter templates (Phase 2.4) | ✅ (this commit `bd3187f`) |
| Approval chains (Phase 2.5) | ⬜ Pending |
| Milestones / retainage (Phase 2.6) | ⬜ Pending |
| Pricing history (Phase 2.7) | ⬜ Pending |
| Client portal (Phase 2.8) | ⬜ Pending |
| V2 hooks (Phase 2.9) | ⬜ Pending |

Ready for Phase 2.5 kickoff after Jake's QA review + push.
