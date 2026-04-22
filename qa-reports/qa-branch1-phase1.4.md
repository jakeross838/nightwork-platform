# QA Report — Branch 1 Phase 1.4: Missing `created_by` Columns

**Generated:** 2026-04-22
**Claude Code session:** starting commit `07ab98b` → teardown commit `0843425` → phase commit `dc5ab64`
**Overall status:** ✅ COMPLETE

---

## Summary

- **Phase intent (as-spec):** Add `created_by` UUID columns to `cost_codes`, `budget_lines`, `draw_line_items`; populate from authenticated write paths.
- **Phase intent (as-kickoff-refined):** The R.18 blast-radius check revealed migration 00045 already added the columns (with FK to `auth.users`) and the three plan-listed write-path routes already populate `created_by`. The real work was **auditing every other insert site** for the three tables and **landing an assert-only tripwire migration** that fails if any of the 6 schema invariants (3 columns + 3 FKs) ever regress.
- **What shipped:**
  - Migration `00062_assert_created_by_columns.sql` — 6 DO-block tripwire assertions; header documents the nullable-by-design + system-route-NULL policy Jake specified.
  - 5 write-path patches: `cost-codes/import`, `cost-codes/template`, `jobs/[id]/budget-import` (2 insert sites + `handlePayAppImport` signature widened to accept `actorUserId`), `change-orders/[id]` (auto-create budget_line branch).
  - 1 explicit-NULL site with `// no user session:` comment: `sample-data/route.ts` (dev-only generator, per Jake's call in prompt 41).
  - `__tests__/created-by-populated.test.ts` — 15 assertions covering regression guards on the 5 already-correct sites + audit checks on the 5 patched sites + 5 migration-structure assertions.
  - `scripts/one-off/phase1.4-fixture-teardown.sql` — committed before execution; teardown verified zero `ZZZ_PHASE_1_4_TEST_%` fixtures remain after live tests.
- **Rebuild vs patch:** PATCH across the board. No module was architecturally off-target.
- **Subagents used:** Schema Validator + Test Runner, both in-process (per Branch 1 convention). No additions beyond plan list — the audit work was grep-based and doesn't warrant a separate agent.
- **R.18 delta vs plan:** Major. Plan named 3 routes as files-touched; reality was 6 insert sites across 5 additional files (1 false positive on `cost-codes/bulk` that had `.update` only, no `.insert`). Flagged at kickoff; Jake approved Option B1 (audit all) + Option A2+ (assert-only migration with 6 DO blocks).
- **R.21 compliance:** all live tests used `ZZZ_PHASE_1_4_TEST_` prefixed synthetic fixtures; committed teardown script + post-run verification confirmed zero fixtures remain.
- **Flags for Jake:**
  1. `npm run build` caught two TypeScript errors from my initial patches (inferred object-literal types blocked adding `created_by`; a helper function didn't take `user` as arg). Both fixed in the same commit; the working build is what shipped.
  2. Teardown script was updated **after** execution to include a CO cleanup I ran ad-hoc. Covered in a follow-up edit to the committed script for audit-trail alignment — flagged in the "Teardown" section below.

---

## R.18 Blast-Radius Report (at kickoff)

Grep results for `.from("<table>").insert(` on cost_codes / budget_lines / draw_line_items:

| Site | Table | State pre-1.4 | Action taken |
|---|---|---|---|
| `src/app/api/cost-codes/route.ts:38` | cost_codes | **already populates** | regression guard ✓ |
| `src/app/api/budget-lines/route.ts:72` | budget_lines | **already populates** | regression guard ✓ |
| `src/app/api/draws/[id]/internal-billings/route.ts:165` | draw_line_items | **already populates** | regression guard ✓ |
| `src/app/api/draws/[id]/internal-billings/attach/route.ts:131` | draw_line_items | **already populates** | regression guard ✓ |
| `src/app/api/draws/[id]/change-orders/route.ts:117` | draw_line_items | **already populates** | regression guard ✓ |
| `src/app/api/cost-codes/import/route.ts:56` | cost_codes | unpopulated | **patched** — added `supabase.auth.getUser()` + `created_by` to insert |
| `src/app/api/cost-codes/template/route.ts:64` | cost_codes | unpopulated | **patched** — added user fetch + `created_by` to row map |
| `src/app/api/jobs/[id]/budget-import/route.ts:372` (regular import) | budget_lines | unpopulated | **patched** — widened `toUpsert` type + added `created_by: user.id` to push |
| `src/app/api/jobs/[id]/budget-import/route.ts:471` (pay-app import) | budget_lines | unpopulated | **patched** — threaded `actorUserId` param through `handlePayAppImport` signature, added `created_by: actorUserId` to row |
| `src/app/api/change-orders/[id]/route.ts:266` (CO approval auto-create) | budget_lines | unpopulated | **patched** — added `created_by: user.id` to insert |
| `src/app/api/sample-data/route.ts:127` | budget_lines | unpopulated | **`// no user session:` comment** — dev-only generator, NULL is intentional |
| `src/app/api/cost-codes/bulk/route.ts` | cost_codes | — | **false positive**: file has `.update` only, no `.insert`. Removed from audit list. |

Original plan spec: 3 routes. Real blast radius: 11 insert sites across 9 files. Delta flagged at kickoff; Jake approved Option B1 (audit all).

---

## Exit Gate Checklist

```
[✓] Migration 00062 applied on dev
    — assert-only migration returned success; all 6 tripwire assertions passed.
[✓] All 3 manual tests PASS
    — Test 1 (cost_codes POST), Test 2 (budget_lines POST), Test 3 (draw_line_items via CO attach) — all live, all populate created_by with jake@rossbuilt.com's user id.
[✓] Schema validator confirms new columns match Part 2 data model
    — migration 00062's 6 DO assertions are the schema validator. Ran green.
[✓] Existing rows readable (NULL accepted)
    — 238 cost_codes, 287 budget_lines, 4 draw_line_items rows have NULL created_by. All readable. No constraint violations.
[✓] QA report generated
    — this file.
```

---

## Commits

| SHA | Message |
|---|---|
| `0843425` | scripts: Phase 1.4 fixture teardown (R.21) — committed before test execution |
| `dc5ab64` | fix(schema): add created_by to cost_codes, budget_lines, draw_line_items |

Diff summary: migration + test (new), 6 src files edited, teardown script (new, committed standalone earlier).

---

## Migrations

| File | Purpose | Applied? | Rollback? |
|---|---|---|---|
| `00062_assert_created_by_columns.sql` | Assert-only tripwire: 3 column-existence + 3 FK-existence DO blocks | ✅ via Supabase MCP | N/A — migration makes no schema changes; nothing to roll back |

Migration is idempotent: every assertion is `IF NOT EXISTS ... RAISE`. Re-running on a healthy schema is a no-op. Re-running after a regression (e.g., someone drops `cost_codes.created_by`) raises a clear exception.

---

## Test Results

```
$ npm test
── created-by-populated.test.ts ───────────────────────────────
PASS  regression guard: src/app/api/cost-codes/route.ts populates created_by on cost_codes insert
PASS  regression guard: src/app/api/budget-lines/route.ts populates created_by on budget_lines insert
PASS  regression guard: src/app/api/draws/[id]/internal-billings/route.ts populates created_by on draw_line_items insert
PASS  regression guard: src/app/api/draws/[id]/internal-billings/attach/route.ts populates created_by on draw_line_items insert
PASS  regression guard: src/app/api/draws/[id]/change-orders/route.ts populates created_by on draw_line_items insert
PASS  audit: src/app/api/cost-codes/import/route.ts insert on cost_codes populates created_by OR has // no user session: comment
PASS  audit: src/app/api/cost-codes/template/route.ts insert on cost_codes populates created_by OR has // no user session: comment
PASS  audit: src/app/api/jobs/[id]/budget-import/route.ts insert on budget_lines populates created_by OR has // no user session: comment
PASS  audit: src/app/api/sample-data/route.ts insert on budget_lines populates created_by OR has // no user session: comment
PASS  audit: src/app/api/change-orders/[id]/route.ts insert on budget_lines populates created_by OR has // no user session: comment
PASS  migration 00062 exists
PASS  migration 00062 header documents the nullable-by-design policy
PASS  migration 00062 contains 3 column-existence assertions (one per table)
PASS  migration 00062 contains 3 FK-existence assertions (one per table) referencing auth.users
PASS  migration 00062 has at least 6 RAISE EXCEPTION lines (one per assertion)

15 test(s) passed
…
all test files passed
```

Pre-fix baseline: **10 of 15 failed** (the 5 regression guards passed immediately — they were already correct pre-Phase-1.4; the 5 audit sites and 5 migration assertions all failed). R.15 satisfied.

### Build

`npm run build` → `✓ Compiled successfully`. Two TypeScript errors caught during execution:
- `budget-import/route.ts`: array `toUpsert` had inferred object-literal type without `created_by`; fixed by widening the type annotation.
- `budget-import/route.ts` `handlePayAppImport`: `user` was out of scope; fixed by adding `actorUserId: string` parameter and threading from the POST handler.

Both resolved in the same commit as the patches.

### Live manual tests (R.19 + R.21)

Synthetic fixtures created (ZZZ_PHASE_1_4_TEST_ prefix):
- Job `faa72310-8f65-43d1-b104-b13f856a332c` (direct SQL insert — jobs POST endpoint out of Phase 1.4 scope)
- Cost code `3bae3de1-6923-4fa4-8843-b310afdf71fa` (via Test 1's live POST)
- Budget line `9b1c12fc-e4a5-4c54-a959-9cbc1f9f0da0` (via Test 2's live POST)
- Synthetic draft draw `e1755f65-042a-40e3-acf4-10bc87d7c421` + CO `248913df-bac2-4b6d-a087-3cdf75596856` (SQL seed for Test 3's CO-attach fixture)

**Test 1** — `POST /api/cost-codes` → HTTP 200 `{ ok: true }`. DB verification:
```
code              = ZZZ_PHASE_1_4_TEST_CC
created_by        = a0000000-0000-0000-0000-000000000001
creator_email     = jake@rossbuilt.com
```

**Test 2** — `POST /api/budget-lines` → HTTP 200 `{ id: 9b1c12fc… }`. DB verification:
```
original_estimate = 100000
created_by        = a0000000-0000-0000-0000-000000000001
creator_email     = jake@rossbuilt.com
```

**Test 3** — `POST /api/draws/{id}/change-orders` attaching the test CO → HTTP 200 `{ inserted_count: 1, ok: true }`. DB verification on the resulting draw_line_items row:
```
source_type       = change_order
change_order_id   = 248913df-bac2-4b6d-a087-3cdf75596856
created_by        = a0000000-0000-0000-0000-000000000001
creator_email     = jake@rossbuilt.com
```

**Test 4** — existing-rows-NULL accepted:
```
cost_codes_with_null_created_by        238
budget_lines_with_null_created_by      287
draw_line_items_with_null_created_by     4
```
All readable with no constraint violations.

---

## Teardown

Committed teardown script at `scripts/one-off/phase1.4-fixture-teardown.sql` (commit `0843425`) **before** test execution, per R.21 + Phase 1.3 precedent.

Teardown executed via Supabase MCP after live tests. Verified zero fixtures remain across jobs, cost_codes, budget_lines, draws, draw_line_items, and change_orders.

**Flagged adjustment:** The initial committed teardown script did not include a branch for the synthetic test CO that Test 3's fixture seed produced (I seeded the CO via direct SQL as part of Test 3's fixture chain, but the teardown script was written before I confirmed Test 3's fixture shape). The actual teardown run included an additional `DELETE FROM change_orders WHERE title LIKE 'ZZZ_PHASE_1_4_TEST%' OR job_id IN (...test_jobs...)` statement. After execution, I updated the committed `scripts/one-off/phase1.4-fixture-teardown.sql` to include this branch so the file on disk matches what was run — same-commit follow-up.

---

## Regression Check

- `npm test`: 40/40 across 4 test files (Phase 1.1 × 20, Phase 1.2 × 4, Phase 1.3 × 11, Phase 1.4 × 15).
- `npm run build`: ✓ compiles cleanly.
- Prior-phase regression guards: unchanged (still green).
- Migration 00062 is assert-only; has no possible downstream impact.

---

## Subagent Reports

### Schema Validator (plan-listed) — in-process

Migration 00062 is the schema validator in DDL form. The 6 DO-block assertions double as migration body AND validator — any regression raises at apply time. All 6 passed silently on apply.

### Test Runner (plan-listed) — in-process

- R.15 baseline: 10/15 Phase 1.4 tests failed pre-fix. Post-fix: 15/15 pass.
- Regression guards on the 5 already-correct sites: 5/5 pass.
- Audit sites: 5/5 pass after patches + comment.
- Migration structure assertions: 5/5 pass.
- Full suite: 40/40 pass.
- Live manual tests 1–4: all pass.

---

## Rebuild Decisions

None. Every change was PATCH:
- Migration adds no schema (assert-only).
- 5 route files got small-surface additions (user fetch + `created_by` propagation).
- `handlePayAppImport` got one new parameter (`actorUserId`) — minimal signature widening.
- `sample-data` got a comment — no behavioral change.

---

## Flagged for Jake

1. **R.18 delta accepted.** Plan said 3 routes; reality was 11 insert sites across 9 files (with 1 false positive pruned). Option B1 landed. The test file's regression guards now lock in correctness on all 5 pre-1.4-already-correct sites + all 5 newly-patched sites, so a future regression trips immediately.
2. **Teardown drift.** I updated the committed teardown script *after* running it, to add the CO cleanup branch that my live-test seed required. Script on disk now matches executed statements. If your audit trail discipline requires the committed script to be identical to the first-run commit, I can back that edit out and note it as an ad-hoc extension only. Flagging for acknowledgment.
3. **sample-data `// no user session:` comment.** Placement at line 120–122 (above the insert payload construction, ~10 lines above the `.from("budget_lines").insert()` call). The regression fence's bidirectional window is 1500 chars back / 600 chars forward — comfortably covers the shape. If you'd prefer a tighter contract (e.g., comment must be on the same line as the insert), flag and I'll reshape.
4. **No `.down.sql` for 00062.** The migration creates no schema, so a down script would be a no-op. Included a header note indicating rollback is trivially the same as apply. If you want the empty file present for consistency with prior phases, I'll add one.
5. **`npm run dev` is no longer destructive** after the Phase 1.3 fix, but I still preferred the existing running server (already on :3000) rather than starting a new one. No `npm run dev` invocation this phase.

---

## Ready for next phase?

✅ **YES** — proceed to Phase 1.5 (`lien_releases.waived_at` stamp) after review.
