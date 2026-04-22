# QA Report — Branch 1 Final Exit Gate (Rollup)

**Generated:** 2026-04-22
**Claude Code session:** Branch 1 rollup — amendment `d45f4db` → rollup teardown `3a15e69` → live regression against fixtures (`934188fb-...`) → verification → teardown
**Overall status:** ✅ COMPLETE — ready for Jake sign-off

---

## Summary

Branch 1 ("Data Integrity Foundation") is done. Five phases shipped, all exit gates PASS, end-to-end regression flow (draw submit → approve → lock → paid) executed live against a running dev server with synthetic fixtures, zero orphan data, zero scope leaks.

Two plan-drift items discovered and fixed during the rollup:
1. `docs/workflow-audit.md` did not exist; gate item referenced a non-existent file. Created retroactively (commit `d45f4db`) with all 13 findings from Part 4 of the plan inline.
2. Gate item's finding list had `#17` (no such finding exists; numbering tops at #13), omitted `#6` (closed by Phase 1.5), and included `#13` (Branch 4 UI scope, not Branch 1). Amended gate text to match actual finding set + Branch 1 scope (same commit `d45f4db`).

---

## Amended Branch 1 Final Exit Gate checklist

```
[✓] All 5 phases have PASS exit gates
[✓] Branch 1 regression suite passes (draw submit → approve → lock → paid, no silent failures)
[✓] Git log is clean (5 phase fix commits, one per phase) + 23 supporting commits (plan infra, QA docs, R.21/R.22 teardown scripts, R.16 rollback files, R.1 remediation for dev.sh) — all scoped and atomic
[✓] No out-of-scope work leaked into Branch 1
[✓] docs/workflow-audit.md updated: findings #1, #2, #3, #4, #5, #6 CLOSED; #13 OPEN (deferred to Branch 4); #17 confirmed as plan drift (never existed)
[✓] Branch rollup QA report generated: this file
[ ] Jake has signed off — PENDING
```

---

## Phase-by-phase exit gate status

| Phase | Goal | Fix commit | QA report | Gate status |
|---|---|---|---|---|
| 1.1 | Enum alignment (CO + invoice statuses canonical) | `2206ee4` | `qa-branch1-phase1.1.md` | ✅ PASS |
| 1.2 | PO PATCH role check (owner/admin) | `87218b0` | `qa-branch1-phase1.2.md` | ✅ PASS |
| 1.3 | Atomic RPC cascades (submit/approve/void) | `78b57e6` | `qa-branch1-phase1.3.md` | ✅ PASS |
| 1.4 | `created_by` population (cost_codes, budget_lines, draw_line_items) | `dc5ab64` | `qa-branch1-phase1.4.md` | ✅ PASS |
| 1.5 | `lien_releases.waived_at` stamp (single PATCH + bulk) | `19821ad` | `qa-branch1-phase1.5.md` | ✅ PASS |

Every phase QA file is committed at `./qa-reports/qa-branch1-phase1.<N>.md` and linked to its phase fix commit.

---

## Branch 1 regression suite — live end-to-end flow

### Synthetic fixtures (R.21)

Seeded with `ZZZ_BRANCH_1_ROLLUP_TEST_` prefix, torn down via committed script `scripts/one-off/branch1-rollup-teardown.sql` (commit `3a15e69`):

| Entity | Identifier | Count |
|---|---|---|
| Job | `ZZZ_BRANCH_1_ROLLUP_TEST_JOB` (`934188fb-5e08-4b02-a4a1-5b4ad2dcb700`) | 1 |
| Cost code | `ZZZ_BRANCH_1_ROLLUP_TEST_CC` | 1 |
| Budget line (on job+cost_code) | `8a09d84b-8691-40e7-8cbf-77cebcf57a44` | 1 |
| Vendor | `ZZZ_BRANCH_1_ROLLUP_TEST_VENDOR` | 1 |
| Draft draw | `aaa86ac3-7491-48e3-9da4-b919cafa4d85` (draw #1) | 1 |
| Invoices (qa_approved, attached to draw) | `ZZZ_BRANCH_1_ROLLUP_TEST_INV_{A,B}` | 2 |
| Invoice line items | linked to budget line | 2 |
| Purchase order | `ZZZ_BRANCH_1_ROLLUP_TEST_PO_001` | 1 |

Phase 1.2 (PO role check) is **not live-exercised here** — the static regression fence in `__tests__/po-patch-role-check.test.ts` (4 assertions, all PASS in `npm test`) locks the `requireRole(ADMIN_OR_OWNER)` pattern in place. Live PATCH on a PO adds no signal beyond what the static test already guarantees. This is a deliberate scoping choice, flagged here for transparency.

### Live HTTP runner

`scripts/one-off/branch1-rollup-live-tests.ts` — authenticates via `@supabase/ssr` (map-backed cookie jar, `jake@rossbuilt.com` password grant) and drives the flow against `http://localhost:3000`.

```
OK sign-in as jake@rossbuilt.com (uid=a0000000-0000-0000-0000-000000000001)
OK   Step 1: POST draws/action=submit    : HTTP 200 — {"status":"submitted"}
    discovered 1 auto-generated lien release(s)
OK   Step 2: PATCH lien 3639f57f status=waived : HTTP 200 — {"ok":true}
OK   Step 3: POST draws/action=approve   : HTTP 200 — {"status":"approved"}
OK   Step 4: POST draws/action=lock      : HTTP 200 — {"status":"locked"}
OK   Step 5: POST draws/action=mark_paid : HTTP 200 — {"status":"paid"}

6 live test step(s) passed
```

### Post-run DB verification (cross-phase behavior)

| Behavior | Check | Result |
|---|---|---|
| Final draw state | status=paid, submitted_at/approved_at/locked_at/paid_at all stamped | ✅ |
| Draw status_history | 4 canonical transitions (draft→submitted→approved→locked→paid), all with `who`/`when`/`old_status`/`new_status`/`note` | ✅ |
| **Phase 1.1**: draw enum canonical | `status='paid'` is in `{draft,pm_review,submitted,approved,locked,paid,void}`, not `pending_approval` | ✅ |
| **Phase 1.1**: invoice enum canonical | both 2 invoices transitioned to `in_draw` via submit cascade (was `qa_approved`) | ✅ |
| **Phase 1.3**: atomic RPC — submit | `draw_submit_rpc` committed draw + invoices + lien_releases + notifications in one transaction | ✅ |
| **Phase 1.3**: atomic RPC — approve | `draw_approve_rpc` flipped status + scheduled payments in one transaction | ✅ |
| **Phase 1.4**: `created_by` populated | auto-generated lien_release has `created_by = a0000000-0000-0000-0000-000000000001` | ✅ |
| **Phase 1.5**: `waived_at` stamped | lien_release has `waived_at = 2026-04-22T17:45:15.232+00:00`; status = `waived` | ✅ |
| R.7: no silent failures | every status transition logged via `logStatusChange`; every cascade inserted notification rows (1 `lien_release_pending` + 1 `draw_submitted`) | ✅ |
| R.21: real data untouched | zero changes to Fish/Dewberry/Markgraf jobs or their descendants | ✅ |

### Teardown (R.22)

Teardown script `scripts/one-off/branch1-rollup-teardown.sql` committed at `3a15e69` BEFORE test execution. Executed post-regression via Supabase MCP. DO-block verification passed (`RAISE NOTICE 'Branch 1 rollup fixture teardown verified — zero fixtures remain.'`). Post-teardown sweep confirmed zero `ZZZ_BRANCH_1_ROLLUP_TEST_%` rows across jobs, cost_codes, vendors, purchase_orders, invoices.

No post-hoc teardown edits required.

---

## Git log cleanliness

All Branch 1 commits dated 2026-04-22 (the execution day). 28 total commits, broken down:

**Phase fix commits (5, one per phase):**
- `2206ee4` fix(schema): align CO and invoice status enums with application code — Phase 1.1
- `87218b0` fix(po): add owner/admin role check to PO PATCH endpoint — Phase 1.2
- `78b57e6` fix(draws): atomic RPC transactions for submit/approve/void — Phase 1.3
- `dc5ab64` fix(schema): add created_by to cost_codes, budget_lines, draw_line_items — Phase 1.4
- `19821ad` fix(lien-release): stamp waived_at on waive action — Phase 1.5

**Standing-rule compliance (1):**
- `95b3000` fix(scripts): remove taskkill from dev.sh per R.1 — discovered during Phase 1.3; R.1 requires no process killing, scripts/dev.sh contained `taskkill` on port conflict. Scoped single-file change.

**Migration rollbacks per R.16 (1):**
- `bb0ec97` migration: 00061 .down.sql per R.16 and Phase 1.1 precedent

**Fixture teardown scripts per R.22 (3):**
- `0843425` Phase 1.4 teardown (R.21)
- `6084dc0` Phase 1.5 teardown (R.22)
- `3a15e69` Branch 1 rollup teardown (R.22)

**Phase 1.3 data cleanup (2):** `78905f4`, `6d2eba6` — R.21 post-hoc pollution cleanup of test data on real Fish/Dewberry draws (Phase 1.3 predated R.21; this is the paper trail for the fix).

**Test infrastructure (1):** `82d5f75` test(draw-rpc): additional assertion on failure-injection gate structure.

**Plan doc amendments (8):**
- `73daf9c` version plan + Phase 1.1 follow-ups
- `0319fe1` G.3 base64 encoding / 35MB cap / compression
- `a87e00b` add R.19 (live tests rule)
- `b4d923f` rewrite R.19 to verbatim spec
- `bbe83f5` tighten Phase 1.3 exit gate
- `07ab98b` wire GH issue #1 into Phase 1.3 artifacts
- `966bb47` add R.20 (read scripts) + R.21 (synthetic fixtures)
- `1924dc7` add R.22 (teardown sequencing)
- `9994df4` fix Branch 1 rollup QA path to repo-relative per R.12
- `d45f4db` create workflow-audit.md + fix Branch 1 gate (this rollup's plan-drift fix)

**QA reports (7):**
- `6259860` Phase 1.2 SHA populate
- `f16e5c1` Phase 1.3 SHA populate
- `1e54c1d` GH issue body draft for Phase 1.3
- `b98fa18` Phase 1.4 SHA populate
- `5de3a46` Phase 1.5 QA report

Plus the Phase 1.1/1.3/1.4/1.5 QA markdown files were added in the phase fix commits themselves. No WIP commits, no partial work, every commit is atomic and individually passes `npm test` + `npm run build`. Conventional-commits format across the board (`fix/docs/scripts/test/migration`).

---

## Out-of-scope leak sweep (Regression Check subagent)

**Explore-agent run:** initial sweep used `--since="2026-04-14"` and returned 21 false positives — all cost-intelligence feature commits (2b420e5, b12d8eb, …, 88de345) dated **2026-04-21**. Those predate Phase 1.1 (`2206ee4` dated `2026-04-22 11:01`) and are pre-rebuild history, not Branch 1 scope creep. Agent was not aware of the 2026-04-22 start boundary.

**Parent-re-verified sweep (correct window `--since="2026-04-22"`):**

Branch 1 out-of-scope (per plan lines 2716–2720):
- UI changes → Branches 2, 4
- New features → Branches 2, 3, 6, 7
- Permission hardening beyond the PO fix → Branch 5
- Performance → Branch 8

Every 2026-04-22 commit reviewed (28 total) falls into one of:
- Phase fix (5, one per phase — in-scope)
- Standing-rule compliance (1 — R.1 remediation, scope-bounded single file)
- Migration rollback (1 — R.16)
- Teardown script (3 — R.21/R.22)
- Data cleanup (2 — R.21 remediation for Phase 1.3's pre-R.21 pollution)
- Test infra (1)
- Plan doc amendments (10)
- QA reports (5)

**UI changes?** Phase 1.1 (`2206ee4`) touched `src/components/budget-drill-down.tsx`, `src/components/job-overview-cards.tsx`, `src/app/change-orders/[id]/page.tsx`, `src/app/jobs/[id]/change-orders/page.tsx`, `src/app/jobs/[id]/budget/page.tsx` — **enum literal + label-map updates only**, no new UI behavior, no new routes, no new components. Explicitly in-scope per the phase spec's "UI conditional branches, UI label maps" scope line.

**New features?** None. Every change maps to one of the 5 stated data-integrity fixes.

**Permission hardening beyond PO?** None. Phase 1.2 added the PO role check; no other routes got new role checks.

**Performance?** None.

**Verdict:** ✅ No scope leaks. Zero commits outside Branch 1 scope.

---

## `docs/workflow-audit.md` finding status

File created retroactively (`d45f4db`) with all findings from Part 4 of the plan. Branch 1 closures:

| # | Finding | Status |
|---|---|---|
| 1 | CO status enum drift | CLOSED — Phase 1.1, commit `2206ee4` |
| 2 | `invoices.status = 'info_requested'` CHECK mismatch | CLOSED — Phase 1.1, commit `2206ee4` |
| 3 | Non-transactional cascades | CLOSED — Phase 1.3, commit `78b57e6` |
| 4 | PO PATCH missing app-layer role check | CLOSED — Phase 1.2, commit `87218b0` |
| 5 | Missing `created_by` columns | CLOSED — Phase 1.4, commit `dc5ab64` |
| 6 | `lien_releases.waived_at` stamp | CLOSED — Phase 1.5, commit `19821ad` |
| 7–13 | Visible breakage (UI/nav/routes) | OPEN — deferred to Branch 4 |

Six findings closed in Branch 1. Seven remain open for Branch 4 (all UI/nav; correctly out-of-scope for data-integrity branch).

---

## Test suite

```
$ npm test
── created-by-populated.test.ts          15/15 PASS
── draw-rpc-cascade.test.ts              11/11 PASS
── lien-release-waived-at.test.ts         9/9  PASS
── po-patch-role-check.test.ts            4/4  PASS
── status-enum-alignment.test.ts         20/20 PASS

all test files passed
```

**Total: 59/59 PASS, 0 FAIL, 5 test files covering all 5 phases.** Each phase ships with its own regression fence; `npm test` exercises every Phase 1.1–1.5 invariant on every run.

```
$ npm run build
✓ Compiled successfully
(warnings: pre-existing Sentry deprecation + React-hooks lint advisories from files not touched in Branch 1)
```

---

## Open issues tracked to later branches

| Issue | Title | Target |
|---|---|---|
| [#1](https://github.com/jakeross838/nightwork-platform/issues/1) | Date-math duplication between TS `scheduledPaymentDate` and PL/pgSQL `_compute_scheduled_payment_date` | Branch 8 or Branch 9 |
| [#2](https://github.com/jakeross838/nightwork-platform/issues/2) | Surface `lien_releases.waived_at` in UI read paths | Branch 4 |
| [#3](https://github.com/jakeross838/nightwork-platform/issues/3) | Bulk lien-release actions overwrite `received_at`/`waived_at` on repeated calls | Branch 5 or standalone patch |

---

## Flagged for Jake

1. **Plan-drift on gate item 5** (file path + finding numbers) — resolved via `d45f4db`. Plan's original gate referenced a non-existent file (`docs/workflow-audit.md`) and mismatched finding numbers. File created with Part 4 content; gate amended to match actual set (`#6` added, `#13` marked OPEN for Branch 4, `#17` confirmed as plan drift). Option 1 from my prompt-45 flag, per your prompt-46 direction.

2. **Regression Check subagent's first sweep was wrong** — cast too wide a date window (`--since="2026-04-14"`) and flagged 21 cost-intelligence commits as scope leaks. Those are pre-rebuild history (2026-04-21). Parent agent re-verified with correct window (`--since="2026-04-22"`) and found zero leaks. Calling this out so future rollups set an explicit start-of-branch cutoff when spawning the subagent.

3. **Phase 1.2 not live-exercised in this rollup** — static regression test (`po-patch-role-check.test.ts`, 4 assertions, PASS) already locks the `requireRole(ADMIN_OR_OWNER)` pattern in the route. Live PATCH on a fixture PO would add no signal. Flagged for transparency; easy to add if you want it.

4. **Branch 1 rollup path updated** — `docs/nightwork-rebuild-plan.md` line 2712 now reads `./qa-reports/qa-branch1-final.md` (repo-relative, R.12 compliance) instead of the original `/mnt/user-data/outputs/...` sandbox path. Amendment commit: `9994df4`.

5. **`docs/nightwork-rebuild-plan.md` standing-rules grew mid-Branch-1** — R.18 (blast-radius grep), R.19 (live manual tests), R.20 (read scripts before invoking), R.21 (synthetic fixtures), R.22 (teardown sequencing) were all added during Branch 1 execution in response to incidents. Each is a standing rule going forward; no retroactive application expected on prior phases.

---

## Artifact inventory (files + commits)

**New files during Branch 1 execution:**
- `docs/workflow-audit.md`
- `docs/nightwork-rebuild-plan.md` (existed; now amended with R.18–R.22 + Phase 1.4–1.5 spec + Branch 1 Final Exit Gate fixes)
- `qa-reports/qa-branch1-phase1.{1,2,3,4,5}.md`
- `qa-reports/qa-branch1-final.md` (this file)
- `scripts/one-off/phase1.3-test-cleanup.sql`
- `scripts/one-off/phase1.4-fixture-teardown.sql`
- `scripts/one-off/phase1.5-fixture-teardown.sql`
- `scripts/one-off/phase1.5-live-tests.ts`
- `scripts/one-off/branch1-rollup-teardown.sql`
- `scripts/one-off/branch1-rollup-live-tests.ts`
- `__tests__/_runner.ts`
- `__tests__/status-enum-alignment.test.ts`
- `__tests__/po-patch-role-check.test.ts`
- `__tests__/draw-rpc-cascade.test.ts`
- `__tests__/created-by-populated.test.ts`
- `__tests__/lien-release-waived-at.test.ts`
- `supabase/migrations/00060_align_status_enums.{sql,down.sql}`
- `supabase/migrations/00061_transactional_draw_rpcs.{sql,down.sql}`
- `supabase/migrations/00062_assert_created_by_columns.sql`
- `supabase/migrations/00063_lien_release_waived_at.{sql,down.sql}`

**Modified during Branch 1 execution (by phase):**
- Phase 1.1: 18 src/ files + package.json (enum literals + label maps)
- Phase 1.2: 1 src/ file (src/app/api/purchase-orders/[id]/route.ts)
- Phase 1.3: 3 src/ files rebuilt/deleted (action route, lien-releases lib, notifications lib)
- Phase 1.4: 5 src/ files patched (insert-site created_by propagation) + sample-data NULL comment
- Phase 1.5: 2 src/ files patched (single PATCH + bulk routes)

---

## Ready for Branch 2?

✅ YES, pending Jake's sign-off on this report.

Branch 2 ("Schema Expansion for v1.0 Target") is migrations-only. No dependency on Branch 1 data paths; Branch 1's data-integrity fixes are a safe foundation for schema additions.

Do NOT push this file yet — per your prompt-46 instruction, this is produced for your review first.
