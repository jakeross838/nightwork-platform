# QA Report — Branch 2 Phase 2.7: Job milestones + retainage config

**Date:** 2026-04-23
**Commit:** pending (this file ships with the `feat(milestones): add job_milestones + retainage threshold/dropoff + draw_mode/tm columns; close GH #5` commit)
**Migration:** `supabase/migrations/00071_milestones_retainage.sql` (+ `.down.sql`)
**Test:** `__tests__/milestones-retainage.test.ts` (34 cases)
**Plan-amendment commit (on main):** `510dacb`
**Pre-flight commit (on main):** `0b548ff`
**GH #5 (tracked):** closes with this commit
**GH #15 (opened during plan-amendment):** https://github.com/jakeross838/nightwork-platform/issues/15
**Status:** READY FOR REVIEW — not yet pushed to origin/main (per prompt step 8)

---

## 1. Executive summary

Ships Phase 2.7 per the amended plan spec (commit `510dacb`, amendments A–L + Amendment M GH #15 tracker).

**What landed:**
- `public.job_milestones` — new workflow table with full audit-column set, 4-value status lifecycle, `status_history` JSONB, `updated_at` trigger.
- 1 partial unique index on `(org_id, job_id, sort_order)` + 3 partial indexes (`org_job`, `status`, `target_date`), all soft-delete-safe.
- 3-policy RLS on `job_milestones` per the 00065 proposals precedent + 00069 draw_adjustments PM-on-own-jobs read-narrowing extension. No DELETE policy.
- `public.jobs` — **GH #5 resolved (Option A)**: auto-named `jobs_retainage_percent_check` dropped; explicit-name `chk_jobs_retainage_percent` survives. Two new columns: `retainage_threshold_percent NUMERIC(5,2) NOT NULL DEFAULT 50.00` + `retainage_dropoff_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00`, both with `chk_jobs_*` explicit-name CHECKs 0–100.
- `public.draws` — new `draw_mode TEXT NOT NULL DEFAULT 'aia'` with 3-value CHECK; `milestone_completions JSONB NOT NULL DEFAULT '[]'::jsonb` (Amendment F); `tm_labor_hours NUMERIC` (hours-not-money carve-out cited in COMMENT per CLAUDE.md R.8); `tm_material_cost` / `tm_sub_cost` / `tm_markup_amount` BIGINT cents.
- 6 `COMMENT ON` statements (1 table + 5 columns) per Amendment H — including the explicit R.8 carve-out on `tm_labor_hours`.

**Data preservation verified:**
- 15 jobs preserved; all 15 backfilled with `retainage_threshold_percent=50.00` + `retainage_dropoff_percent=5.00`.
- 2 draws preserved; both backfilled with `draw_mode='aia'` + `milestone_completions='[]'`.
- `jobs.retainage_percent` distribution unchanged: 2 jobs at `0.00`, 13 at `10.00`.

**Important discovery (§5.7): PM write-side defense does NOT propagate from Phase 2.5.** The 00069 draw_adjustments precedent relied on FK-through-RLS: PM INSERTs on `draw_adjustments` failed the FK check because `public.draws` has a `pm read draws on own jobs` SELECT policy. `public.jobs` has **no** PM-narrowed SELECT policy (`authenticated read jobs` is org-wide), so a PM can INSERT a `job_milestones` row for any job in their org — including jobs they are not assigned to. **Read narrowing still works** (confirmed in §5.6 — Martin sees only Fish milestones; Bob sees only Dewberry milestones). Net effect: PMs can write cross-job but can't read the rows they wrote afterwards. Flagged for Jake's review; see §8.

No application code touched. R.19 static-validation carve-out applies (both conditions cited in §6).

---

## 2. Exit gate checklist

### Universal standing rules (G.2)

| Rule | Status | Notes |
|---|---|---|
| R.1 No process killing | ✅ PASS | |
| R.2 Recalculate, not increment | ✅ N/A | |
| R.3 Org-configurable, not hardcoded | ⚠ SEED DEFAULTS | `retainage_threshold_percent=50` / `retainage_dropoff_percent=5` are AIA industry defaults. Tracked in **GH #15** for onboarding override. |
| R.4 Rebuild over patch | ✅ PASS | Net-new table + column ALTERs only. |
| R.5 Trace, don't assume | ✅ PASS | Pre-flight §4 probes re-run at kickoff (§4.1 below). |
| R.6 Block destructive actions | ✅ PASS | No DELETE policy; soft-delete via `deleted_at`. |
| R.7 status_history on state changes | ✅ PASS | `job_milestones.status_history JSONB NOT NULL DEFAULT '[]'`. Branch 3/4 writers append on every transition. |
| R.8 Amounts in cents | ✅ PASS | `amount_cents` / `tm_material_cost` / `tm_sub_cost` / `tm_markup_amount` all BIGINT cents. Hours-not-money carve-out on `tm_labor_hours` documented in COMMENT citing R.8 explicitly. |
| R.9 source_document_id | ✅ N/A | |
| R.10 Optimistic locking on mutations | ✅ N/A | No new write endpoints. |
| R.11 Screenshots inline | ✅ N/A | |
| R.12 Data integrity | ✅ PASS | 1 partial unique + 3 partial indexes + 4 CHECKs + FKs. |
| R.13 Server-side business logic | ✅ N/A | |
| R.14 Multi-tenant via org_id | ✅ PASS | `job_milestones.org_id UUID NOT NULL REFERENCES public.organizations(id)`. |
| R.15 R.15 test-first | ✅ PASS | 34 static assertions written BEFORE migration. Baseline 34/34 FAIL → post-migration 34/34 PASS. |
| R.16 Paired down.sql | ✅ PASS | Strict reverse-dependency order. Includes commented-out GH #5 rollback block (Amendment I). |
| R.17 Pre-flight grep before write | ✅ PASS | Pre-flight §3 at `0b548ff`: 0 src/ / __tests__/ / migrations/ hits for any of 9 new identifiers. |
| R.18 Blast-radius recap | ✅ PASS | §3 below. |
| R.19 Static-validation carve-out | ✅ PASS | Both conditions met — see §6. |
| R.20 Optimistic locking column | ✅ PASS | `updated_at NOT NULL DEFAULT now()`, trigger-maintained. |
| R.21 `public.` schema qualification | ✅ PASS | Every DDL statement qualifies. |
| R.22 Migration-file atomicity | ✅ PASS | Single `apply_migration` call (atomic or full rollback). |
| R.23 Apply precedent faithfully | ✅ PASS | See §7. |

---

## 3. R.18 blast-radius recap

**New DB objects (all additive):**
- 1 table: `public.job_milestones` (16 columns).
- 1 implicit PK index + 1 partial unique index + 3 partial indexes (5 total on new table).
- 3 RLS policies (`job_milestones_org_read`/`org_insert`/`org_update`).
- 1 trigger (`trg_job_milestones_updated_at` using shared `public.update_updated_at()`).
- 2 new columns on `public.jobs` + 2 new CHECK constraints (`chk_jobs_retainage_threshold_percent`, `chk_jobs_retainage_dropoff_percent`).
- 6 new columns on `public.draws` + 1 new CHECK (`chk_draws_draw_mode`).
- 6 COMMENTs (1 table + 5 columns).

**Existing DB objects touched:**
- `public.jobs` — `jobs_retainage_percent_check` DROPPED (Amendment E / GH #5 Option A). `chk_jobs_retainage_percent` survives. 15 rows backfilled with new column defaults.
- `public.draws` — 2 rows backfilled with new column defaults. No policy/trigger changes.

**Existing src/ code touched:**
- None. 0 references in pre-flight grep. Branch 3/4 lights up writers.

---

## 4. Schema Validator pre + post state

### 4.1 Pre-migration probes (kickoff, commit `510dacb` plan-amendment state)

| Probe | Result |
|---|---|
| Last applied migration | `20260423005250` (`00070_approval_chains`) |
| `to_regclass('public.job_milestones')` | `null` |
| `jobs` retainage CHECK constraints | 2 — `chk_jobs_retainage_percent` (explicit) + `jobs_retainage_percent_check` (auto-named duplicate, identical predicate) |
| `draws` has `draw_mode` / `milestone_completions` / `tm_*`? | `false` / `false` / `false` |
| Live counts | 3 orgs / **15 jobs** / 2 draws |
| `public.update_updated_at()` | present |
| `proposals` policy count / DELETE policy | 3 / false — R.23 precedent intact |
| `draw_adjustments` policy count | 3 — precedent intact |

### 4.2 Post-apply probes (live state)

| Probe | Result |
|---|---|
| `public.job_milestones` | exists |
| `relrowsecurity` | `true` |
| Policies on `job_milestones` | 3: `job_milestones_org_insert` (INSERT), `job_milestones_org_read` (SELECT), `job_milestones_org_update` (UPDATE). No DELETE. |
| Indexes (5 total) | `job_milestones_pkey`; `job_milestones_unique_sort_per_job (org_id, job_id, sort_order) WHERE deleted_at IS NULL`; `idx_job_milestones_org_job WHERE deleted_at IS NULL`; `idx_job_milestones_status WHERE deleted_at IS NULL`; `idx_job_milestones_target_date WHERE target_date IS NOT NULL AND deleted_at IS NULL` |
| `trg_job_milestones_updated_at` | registered |
| `job_milestones` live row count | `0` (no seed data) |
| `jobs` retainage CHECKs after migration | 3: `chk_jobs_retainage_percent`, `chk_jobs_retainage_threshold_percent`, `chk_jobs_retainage_dropoff_percent`. **`jobs_retainage_percent_check` DROPPED (GH #5 closed).** |
| `jobs` with `retainage_threshold_percent=50.00` | **15 / 15** |
| `jobs` with `retainage_dropoff_percent=5.00` | **15 / 15** |
| `draws` with `draw_mode='aia'` | **2 / 2** |
| `draws` with `milestone_completions='[]'::jsonb` | **2 / 2** |
| `jobs.retainage_percent` preserved | `0.00: 2, 10.00: 13` (unchanged) |

### 4.3 Data preservation table — 15 jobs + 2 draws

| Table | Pre-migration count | Post-migration count | New columns backfilled |
|---|---|---|---|
| `public.jobs` (not soft-deleted) | 15 | 15 | all 15 rows: `retainage_threshold_percent=50.00`, `retainage_dropoff_percent=5.00` |
| `public.draws` (not soft-deleted) | 2 | 2 | both rows: `draw_mode='aia'`, `milestone_completions='[]'::jsonb`, `tm_labor_hours=NULL`, `tm_material_cost=NULL`, `tm_sub_cost=NULL`, `tm_markup_amount=NULL` |
| `public.job_milestones` | N/A | 0 | — |

Zero data loss. Zero application-visible field mutations beyond the additive defaults.

---

## 5. Migration Dry-Run findings

**Methodology:** Full migration wrapped in `BEGIN ... ROLLBACK` via Supabase MCP `execute_sql` for structural probes (no state persisted). `apply_migration` for the real apply. Post-apply probes (negative, positive, live-auth RLS) run against live state using `BEGIN ... ROLLBACK` blocks with `SET LOCAL role authenticated` + `SET LOCAL request.jwt.claims`.

### 5.1 R.15 baseline (pre-migration)

```
npx tsx __tests__/milestones-retainage.test.ts
→ 34 of 34 test(s) failed
```

Every assertion ENOENTs on `supabase/migrations/00071_milestones_retainage.sql` / `.down.sql`.

### 5.2 R.15 post-migration

```
npx tsx __tests__/milestones-retainage.test.ts
→ 34 test(s) passed
```

Full suite `npm test`: **252 tests passed** across 12 test files (218 pre-existing + 34 new Phase 2.7). Runner reports `all test files passed`. `npm run build`: clean.

### 5.3 Structural probes (BEGIN/ROLLBACK dry-run + post-apply)

Every probe green — see §4.2 table.

### 5.4 Negative probes

| # | Probe | SQLSTATE observed |
|---|---|---|
| neg1 | `INSERT INTO public.draws (…, draw_mode='invalid')` | ✅ `check_violation` (23514) caught |
| neg2 | `INSERT INTO public.jobs (…, retainage_threshold_percent=150)` | ✅ `check_violation` caught |
| neg3 | `INSERT INTO public.jobs (…, retainage_dropoff_percent=-5)` | ✅ `check_violation` caught |
| neg4 | `INSERT INTO public.job_milestones (…, status='wrong')` | ✅ `check_violation` caught |
| neg5 | `INSERT INTO public.job_milestones (…)` missing `org_id` | ✅ `not_null_violation` (23502) caught |

### 5.5 Positive probes

| Probe | Result |
|---|---|
| Insert milestone at `sort_order=1` | ✅ success |
| Insert duplicate `(org_id, job_id, sort_order=1)` → expect `unique_violation` on partial index | ✅ caught (`23505`) |
| Soft-delete row, then re-INSERT same `(org_id, job_id, sort_order=1)` | ✅ success — partial-index slot freed |

### 5.6 Live-auth RLS probes

All wrapped in `BEGIN ... ROLLBACK`. For the PM-narrowing check, seeded two milestones (one on Fish, one on Dewberry) as the default MCP service role, then switched `role=authenticated` + `request.jwt.claims.sub` to each user.

| User / role | SELECT visible | INSERT outcome |
|---|---|---|
| Jake (owner / org 00000001) | 0 rows (no milestones yet), policy allows | ✅ INSERT succeeds on any job |
| Andrew (admin) | not exercised — same policy path as owner | — |
| Diane (accounting) | 0 rows baseline, then 2 rows after seed | ✅ INSERT succeeds (workflow-data 4-role write set) |
| Martin (pm / assigned to Fish) | After seeding 2 milestones: **only the Fish milestone visible** (1 row) | ✅ INSERT on Fish succeeds; **❗ INSERT on Dewberry ALSO succeeds (see §5.7)** |
| Bob (pm / assigned to Dewberry) | After seeding 2 milestones: **only the Dewberry milestone visible** (1 row) | — |
| Stranger (no org_members row) | 0 rows | ✅ `42501 insufficient_privilege` caught |

**Read-narrowing works end-to-end** — the 00069 draw_adjustments-style EXISTS predicate traversing `public.jobs.pm_id = auth.uid()` correctly filters PM SELECTs down to their own jobs' milestones.

### 5.7 ❗ NEW FINDING: FK-through-RLS defense does NOT transfer from Phase 2.5 on writes

**Phase 2.5 precedent (00069 draw_adjustments):** PM INSERTs on `draw_adjustments` failed the FK check because `public.draws` has a `pm read draws on own jobs` SELECT policy. The FK-integrity check against the RLS-filtered view of `draws` rejected cross-job draw references — emergent defense-in-depth stricter than the write policy itself declared.

**Phase 2.7 actual behavior:** PM INSERT on `job_milestones` targets `job_id` referencing `public.jobs`. `public.jobs` has **no** PM-narrowed SELECT policy — the active read policies are:

- `authenticated read jobs` → `org_id = app_private.user_org_id()` (org-wide)
- `org isolation` ALL → `org_id = ... OR is_platform_admin()`
- `admin owner write jobs` ALL → role IN (admin, owner)
- `jobs_delete_strict` DELETE → `org_id = ...`
- `jobs_platform_admin_read` SELECT → `is_platform_admin()`

None narrow PM reads to own jobs. So when Martin INSERTs a `job_milestones` row with `job_id = Dewberry`, the FK-through-RLS check against `jobs` sees Dewberry (org-wide read visible to Martin) and **passes**. The `job_milestones_org_insert` WITH CHECK only gates on org membership + `role IN ('owner','admin','pm','accounting')` — Martin satisfies both. **INSERT succeeds.**

**Live-auth probe result (Martin trying to INSERT on Dewberry):**

```
OBSERVED: Martin INSERT on Dewberry SUCCEEDED (id=...). FK-through-RLS did
NOT block because jobs has no PM-narrowed read policy — it uses org-wide
authenticated_read_jobs. Write policy WITH CHECK passed because pm is in
the role list. This differs from draw_adjustments (where draws has PM
narrowing) and is a NEW FINDING for Phase 2.7.
```

**Net effect:** PMs can INSERT milestones on jobs they don't own, but cannot subsequently READ those milestones (read policy narrows by `j.pm_id = auth.uid()`). The writes become invisible to the writer afterwards. An attacker with direct SQL access could spam another PM's job milestone list; the legitimate app never surfaces cross-job write buttons, so the UX never triggers this.

**Posture:** Not a CVE. Flagging because the Phase 2.5 amendment commentary explicitly cited FK-through-RLS as part of the defense-in-depth posture, and this phase's write-side does not inherit it. Two remediation options if Jake wants tightening:

1. **Add PM-narrowing to `job_milestones_org_insert` / `org_update` WITH CHECK** — mirror the read policy's EXISTS predicate on the write side. Small migration; one policy each. Guarantees writes match reads.
2. **Add PM-narrowing to `public.jobs` SELECT policies** — broader refactor (touches all FK-referencing tables' write paths), out of scope for 2.7. Would also affect draws, invoices, change_orders, etc.

**Recommendation:** option 1 as a follow-up migration. Low blast radius (job_milestones is empty in production; no real writes to reconcile), fixes the defense-in-depth gap, makes Phase 2.7's PM narrowing symmetric to Phase 2.5's.

### 5.8 GH #5 constraint-drop verification

Pre-migration jobs retainage CHECKs: `chk_jobs_retainage_percent` + `jobs_retainage_percent_check` (both with identical predicate).

Post-migration: **`jobs_retainage_percent_check` DROPPED.** Remaining: `chk_jobs_retainage_percent` (explicit-name survivor) + `chk_jobs_retainage_threshold_percent` (new) + `chk_jobs_retainage_dropoff_percent` (new). GH #5 closed.

### 5.9 Data-preservation probes

Every pre-apply row count matches post-apply (see §4.3). All default backfills applied uniformly. Zero data loss.

### 5.10 §5.7 asymmetry RESOLVED in migration 00072 (commit `6b43caf`)

**Addendum, 2026-04-23** — the FK-through-RLS write-side asymmetry flagged in §5.7 did **not** defer to Branch 8. A follow-up migration `00072_job_milestones_pm_write_narrowing.sql` landed in the same Phase 2.7 paper trail (commit `6b43caf`, `fix(milestones): tighten job_milestones PM write policies to match read-side narrowing (Phase 2.7 QA §5.7 addendum)`).

**Fix:** extend the WITH CHECK predicate on `job_milestones_org_insert` and the USING predicate on `job_milestones_org_update` with the same `EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_milestones.job_id AND j.pm_id = auth.uid())` clause the read policy uses, gated on `app_private.user_role() = 'pm'`. Owner / admin / accounting continue to write without the PM EXISTS gate.

**Key regression probe (post-apply, same harness as §5.6):**

| User / role | Pre-fix (00071) | Post-fix (00072) |
|---|---|---|
| Martin (PM on Fish) INSERT on **Dewberry** (Bob's job) | ❗ SUCCEEDED (§5.7 asymmetry) | ✅ **42501 insufficient_privilege** — asymmetry closed |
| Martin INSERT on Fish (his own job) | ✅ success | ✅ success |
| Bob (PM on Dewberry) INSERT on Dewberry (his own job) | ✅ success | ✅ success |
| Bob INSERT on Fish (not his job) | ❗ would succeed | ✅ **42501** |
| Jake (owner) / Diane (accounting) INSERT on any job | ✅ success | ✅ success |
| Stranger | ✅ 42501 | ✅ 42501 |

Writes now match reads. The 00069 draw_adjustments FK-through-RLS emergent defense-in-depth is replaced by explicit policy-level narrowing, which is more defensible and more portable to future tables with org-wide read posture on their FK-referenced parents.

**Paper trail in Branch 2 Final Exit Gate (§10) below has been updated:** 9 of 11 migrations applied (00071 + 00072). R.15 test file `__tests__/job-milestones-pm-write-narrowing.test.ts` ships 11 static assertions (11/11 FAIL baseline → 11/11 PASS post-apply; full suite **263 tests passing**). R.16 paired `00072_...down.sql` restores the pre-fix asymmetric shape — rollback intentionally reintroduces §5.7, documented in the down.sql header.

**Structural shape preserved:** still exactly 3 policies on `job_milestones`, no DELETE, workflow-data 4-role gate at the outer level. The PM narrowing is a predicate-level extension within the same 3-policy shape — identical to the 00069 draw_adjustments application of the pattern, applied symmetrically to reads AND writes.

**GH #14 context update:** GH #14 tracked the *inverse* of §5.7 (emergent defense-in-depth stricter than declared). §5.7 was the complement (no defense-in-depth where declared). With 00072 landed, both PM-narrowing patterns — Phase 2.5 draw_adjustments and Phase 2.7 job_milestones — now have symmetric read + write narrowing, though via different mechanisms (FK-through-RLS vs. explicit policy clause). Documentation ask on GH #14 can now reference both phases as the canonical pattern catalog.

---

## 6. R.19 static-validation carve-out — both conditions cited

1. **No runtime code touched.** Pre-flight §3 R.18 grep: 0 `src/` / `__tests__/` / `supabase/migrations/` references to any of 9 new identifiers (`job_milestones`, `milestone_completions`, `draw_mode`, `tm_labor_hours`, `tm_material_cost`, `tm_sub_cost`, `tm_markup_amount`, `retainage_threshold_percent`, `retainage_dropoff_percent`). Post-apply `npm run build` clean without touching any new identifier. Branch 3/4 introduces writers.
2. **Migration Dry-Run exercised DB stack.** See §5 — structural (table, 5 indexes, 3 policies, trigger); 5 negative probes (CHECK × 4, NOT NULL × 1); 2 positive probes (partial unique + soft-delete unblock); 5 live-auth RLS probes (owner / pm-on-own-jobs / pm-cross-jobs read narrowing / accounting / stranger); GH #5 constraint-drop verification; data-preservation across 15 jobs + 2 draws.

Both conditions met.

---

## 7. R.23 precedent statement

Phase 2.7 adopts **00065 proposals** as the tenant-table precedent — 3-policy RLS (`org_read` / `org_insert` / `org_update`; no DELETE; soft-delete via `deleted_at`). **Extension from 00069 draw_adjustments**: surgical PM-on-own-jobs narrowing on the read policy via `EXISTS` traversal of `public.jobs.pm_id = auth.uid()` gated on `app_private.user_role() = 'pm'`.

**Write role-set `(owner, admin, pm, accounting)` matches proposals verbatim** — no narrowing to the approval_chains (00070) `(owner, admin)` set. `job_milestones` is job-scoped workflow data, not tenant config; PMs need to mark milestones in_progress/complete on their assigned jobs, and accounting needs to mark them billed when pulling into a draw.

**Structural shape preserved:** policy count (3), cmd distribution (SELECT/INSERT/UPDATE), DELETE posture (none, soft-delete via `deleted_at`) all match proposals verbatim. The PM read narrowing is a **predicate-level extension** within the same 3-policy shape, identical to the 00069 draw_adjustments application of the same pattern.

**`jobs` / `draws` column ALTERs inherit each parent table's existing RLS posture:**
- `public.jobs` write-capable roles = owner/admin (via `admin owner write jobs` ALL policy). The two new retainage columns are tenant-finance config — owner/admin-only write is correct.
- `public.draws` write-capable roles = owner/admin/accounting (via `admin owner accounting write draws` ALL policy). The 6 new draw columns inherit this — draw-mode + T&M fields are accounting-authored.

No new policies on parent tables.

**Amendment F.2 (GRANT-verification) is NOT APPLICABLE** — no new SECURITY DEFINER functions in Phase 2.7 scope. Documented explicitly in migration header (line 81–86) so absence is recognized as intentional, not oversight. Contrast 00070 approval_chains which shipped 2 functions + explicit GRANTs.

---

## 8. Flagged discoveries

### 8.1 FK-through-RLS defense does not propagate from Phase 2.5 on job_milestones writes (see §5.7)

**RESOLVED 2026-04-23 in migration 00072 — see §5.10 for the fix, regression probes, and paper trail. Commit `6b43caf`.** Jake approved option 1 (add PM-narrowing EXISTS to the WITH CHECK predicate) as a follow-up migration before push, not deferred to Branch 8. Writes now match reads; the asymmetry is closed.

The original §5.7 finding remains preserved above as-written for historical accuracy — it documents the pre-fix behavior that motivated 00072.

### 8.2 Three COMMENT-test regex failures required removing embedded semicolons from COMMENT string literals

Minor test-authoring methodology note. My R.15 static-regex test uses `/COMMENT\s+ON\s+...\s+IS[\s\S]*?;/i` with non-greedy matching — stopped at the first `;` encountered, which in three cases fell inside a single-quoted COMMENT body (e.g., `'PMs mark complete; accounting bills…'`). Fixed by rewriting COMMENTs to use dashes/periods instead of semicolons where appropriate. Pre-existing test files (`draw-adjustments.test.ts`, `approval-chains.test.ts`) don't have this issue because their COMMENT text avoided embedded semicolons. Documented for future test authors — either match through SQL string-quote escaping, or avoid semicolons inside COMMENT strings.

### 8.3 GH #15 was opened during plan-amendment step, not during execution

Plan-amendment prompt explicitly requested it. Issue #15 (https://github.com/jakeross838/nightwork-platform/issues/15) tracks onboarding-wizard override for retainage threshold/dropoff defaults, parallel to GH #12 for approval_chains.

---

## 9. Test results

**Full test suite (`npm test`):** `all test files passed`. Total count: **252 tests across 12 test files.**

| File | Tests |
|---|---|
| approval-chains.test.ts | 30 |
| co-type-expansion.test.ts | (pre-existing) |
| cost-codes-hierarchy.test.ts | (pre-existing) |
| created-by-populated.test.ts | (pre-existing) |
| draw-adjustments.test.ts | 29 |
| draw-rpc-cascade.test.ts | (pre-existing) |
| job-phase-contract-type.test.ts | (pre-existing) |
| lien-release-waived-at.test.ts | (pre-existing) |
| **milestones-retainage.test.ts** | **34 (NEW, this phase)** |
| po-patch-role-check.test.ts | (pre-existing) |
| proposals-schema.test.ts | 27 |
| status-enum-alignment.test.ts | 20 |

Pre-migration baseline: `milestones-retainage.test.ts` → 34/34 FAIL.
Post-migration: 34/34 PASS.
Suite delta: +34 tests vs. Phase 2.6's 218.

`npm run build`: completed without errors. Next.js `+ First Load JS shared by all 159 kB`. Middleware `139 kB`.

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
| 2.6 | 00070_approval_chains | ✅ applied |
| **2.7** | **00071_milestones_retainage** | ✅ **applied (this report)** |
| **2.7 addendum** | **00072_job_milestones_pm_write_narrowing** | ✅ **applied — §5.10 above, commit `6b43caf`** |
| 2.8 | 00073_pricing_history | ⬜ not started (renumbered +1 by the §5.7 addendum) |
| 2.9 | 00074_client_portal | ⬜ not started |
| 2.10 | 00075_v2_hooks | ⬜ not started |

**9 of 11 migrations applied.** Phase 2.7 closes with the §5.10 addendum in a single push.

> **Renumber note (2026-04-23):** the §5.7 addendum consumed slot 00072 for the PM write-narrowing fix. Phases 2.8 / 2.9 / 2.10 shift by +1 (00073 / 00074 / 00075). Plan doc at `docs/nightwork-rebuild-plan.md` §3945 / §3985 / §4019 still uses the old numbering — a docs(plan) sync can fold into the Phase 2.8 kickoff, same pattern as the Phase 2.6 `7a1e33d` ON-CONFLICT sync.

### GH issue status

| GH # | Status | Resolution |
|---|---|---|
| #5 — duplicate retainage CHECK on jobs | ✅ **CLOSED** by this migration (Amendment E / Option A) |
| #12 — onboarding-wizard override for approval_chains defaults | open (tracked for Branch 6/7) |
| #13 — CO-numbering reconciliation (Markgraf bridge) | open (Branch 3 scope) |
| #14 — FK-through-RLS UX implications from Phase 2.5 | open — §5.7 of this report documented the inverse case (no defense-in-depth where declared); §5.10 / commit `6b43caf` resolves the Phase 2.7 side via explicit policy-level narrowing. Both patterns (FK-through-RLS emergent in 00069; explicit policy EXISTS in 00072) now catalogued as canonical PM-narrowing recipes for Branch 3/4 reference. |
| #15 — onboarding-wizard override for retainage threshold/dropoff defaults | open — opened during Phase 2.7 plan-amendment step |

---

## 11. Next-turn actions for Jake

1. Review this QA report, paying attention to §5.7 (FK-through-RLS write-side finding) and §8.1 (remediation options).
2. Decide on the PM WITH CHECK narrowing follow-up — small migration or leave as-is.
3. Review the migration + test + down.sql diffs (commit pending push).
4. If green: `git push origin main`.
5. GH #5 will close automatically once the commit containing "Closes GH #5" / "Closes #5" is pushed.
