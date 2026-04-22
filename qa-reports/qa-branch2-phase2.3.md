# QA Report — Branch 2 Phase 2.3: CO type expansion

**Date:** 2026-04-22
**Commit:** `b746cf7` (pending push)
**Migration:** `supabase/migrations/00066_co_type_expansion.sql` (+ `.down.sql`)
**Test:** `__tests__/co-type-expansion.test.ts` (32 cases)
**Plan amendment commit (already on main):** `c6b468d`
**Pre-flight findings:** `qa-reports/preflight-branch2-phase2.3.md` (commit `09e80ac`)
**Status:** READY FOR REVIEW — not yet pushed to origin/main

---

## 1. Executive summary

Ships Phase 2.3 per the amended plan spec. Five amendments A–E (landed in plan commit `c6b468d`) were all executed:

- **A.** DROP / RE-SET `change_orders.co_type` DEFAULT around the data UPDATE so the pre-flight default `'owner'` never violates the new CHECK. Final default is `'owner_requested'`.
- **B.** Rewrote `app_private.refresh_approved_cos_total` predicate from `co_type = 'owner'` to `co_type <> 'internal'`. Ran a one-time cache backfill across every live job. The embedded verification probe passed: pre-migration SUM = post-backfill SUM = **90104565 cents ($901,045.65)**; no cache drift; `RAISE NOTICE` fired without `RAISE EXCEPTION`.
- **C.** Rewrote 6 application-layer filter sites (4 `.eq("co_type","owner")` → `.neq("co_type","internal")`; 3 `co.co_type === "owner"` → `co.co_type !== "internal"`, counting both preview occurrences), updated the POST default from `?? "owner"` → `?? "owner_requested"`, widened 2 TS body unions (`"owner" | "internal"` → `string` + file-private `CO_TYPES` constant + runtime `.includes()` validation, mirroring the Phase 2.1 `CONTRACT_TYPES` precedent at `src/app/api/jobs/route.ts:16`), and widened the new-CO form state to a full 5-value union with a picker exposing all 5 values and defaulting to `'owner_requested'`.
- **D.** R.15 test file `__tests__/co-type-expansion.test.ts` (32 cases). Baseline 32/32 FAIL captured before the migration SQL existed; post-implementation 32/32 PASS.
- **E.** Paired `00066_co_type_expansion.down.sql` per R.16. Mirrors Phase 2.1's loud-fail posture: restores the legacy 2-value CHECK and intentionally violates if post-migration rows use `designer_architect` / `allowance_overage` / `site_condition` — no silent data-loss window.

UI display labels/badges deferred to Branch 4 per GH #7 (raw-string fallback means new non-`internal` types render as "Internal" until the label map lands). Naming collision between new `change_orders.pricing_mode` and existing `items.pricing_model` noted in the migration header; tracked under GH #8 for possible future rename.

This phase touches application-layer code + a DB function body → **R.19 static-validation carve-out does NOT apply.** The test suite and build checks exercise the code paths, but no live dev-server round-trip was performed. See §9 flag #1.

---

## 2. Exit gate checklist

### Universal standing rules (G.2)

| Rule | Status | Notes |
|---|---|---|
| R.1 No process killing | ✅ PASS | No kill/pkill/taskkill. |
| R.2 Recalculate, not increment | ✅ PASS | The cache-trigger rewrite keeps the existing recompute-from-source pattern; the only stored-cache column (`jobs.approved_cos_total`) remains the CLAUDE.md trigger-maintained exception with rationale. |
| R.3 Org-configurable, not hardcoded | ✅ N/A | `co_type` is a per-CO value; the CHECK value set is a platform-level enum, not an org policy. |
| R.4 Rebuild over patch | ✅ PASS | Enum expansion is additive; EXTEND was correct per G.5 tree. |
| R.5 Trace, don't assume | ✅ PASS | S-probes re-ran at kickoff (§6) confirmed every pre-flight assumption; S3.1 confirmed the 90104565 invariant; S7 confirmed the live function body was still the pre-rewrite version. |
| R.6 Block destructive actions | ✅ N/A | No delete/void paths touched. |
| R.7 status_history on state changes | ✅ N/A | No statused entity mutated by schema change. |
| R.8 Amounts in cents | ✅ PASS | Verification probe expressed in cents (90104565); `total_with_fee`, `amount`, `gc_fee_amount` all already BIGINT. |
| R.9 source_document_id | ✅ N/A | No drag-createable entity touched. `source_proposal_id` added with FK to `public.proposals` per R.9 intent for proposal-derived COs. |
| R.10 Optimistic locking on mutations | ✅ N/A | No new mutation endpoints. Existing PATCH route inherits its existing `updateWithLock()` contract. |
| R.11 Screenshots inline | ✅ N/A | No UI screenshots — the form picker change is covered by the R.15 test (`NEW_CO_PAGE` references all 5 values + defaults to `'owner_requested'`). |
| R.12 Single QA file in `./qa-reports/` | ✅ PASS | This file at `qa-reports/qa-branch2-phase2.3.md`. |
| R.13 Read CLAUDE.md first | ✅ PASS | Read; applied architecture rules (cents, soft-delete, org_id) + trigger-maintained-cache exception for the refresh_approved_cos_total rewrite. |
| R.14 No placeholder content | ✅ PASS | No stubs shipped. Deferred surfaces (UI label map, GH #7) handled via raw-string fallback + tracked issue, not "coming soon" UI. |
| R.15 Test-first when possible | ✅ PASS | Baseline 32/32 FAIL captured before migration SQL or code edits (see §7). Post-implementation 32/32 PASS. Includes semantic-equivalence regression on the 90104565 invariant, default-regression probe, and migration-file structural probes. |
| R.16 Migrations are source of truth | ✅ PASS | `00066_co_type_expansion.sql` + `.down.sql` both written to git before `apply_migration` ran; the MCP `apply_migration` body was copy-pasted verbatim from the git-tracked SQL. No direct-dashboard edits. |
| R.17 Atomic commits | ✅ PASS | Single commit `b746cf7` contains migration + down + test + all 8 code-file edits; test suite + build both pass on the commit. |
| R.18 Spec file list is advisory | ✅ PASS | Pre-flight §2 classification table listed the 9 hardcoded sites across 7 files (6 Type B filter sites, 1 Type C default, 2 Type C unions, 1 Type C form state, 2 Type D deferred). This commit touched exactly the 7 amended-spec files + form; deferred Type D labels intentionally left alone per GH #7. No delta from pre-flight. |
| R.19 Live execution of manual tests | ⚠️ NOT claimed — see §9 flag #1 | This phase modifies live application code paths (6 filter sites, 2 API routes, 1 form state). Static validation via `npm test` + `npm run build` exercised the compile-time + regex-asserted contracts; no running dev-server round-trip. The R.15 semantic-equivalence regression + the in-DB verification probe bound the correctness risk. |
| R.20 Read project scripts before invoking | ✅ PASS | `__tests__/_runner.ts` inspected before new test file landed; runner shape (discovers `*.test.ts`, spawns each as isolated `tsx` child) unchanged. `npm run build` is stock Next. |
| R.21 Synthetic fixtures | ✅ PASS | Dry-run fixtures (pcco_numbers 99901–99920) all inside `BEGIN/ROLLBACK`; never committed to dev. No post-apply fixtures. |
| R.22 Teardown sequencing | ✅ N/A | No committed fixtures. Rollback is `00066_co_type_expansion.down.sql`. |
| R.23 Codebase-precedent check | ✅ PASS | No new RLS policies or table conventions introduced (precedent statement in §6). |

### Phase-specific (Branch 2 Final Exit Gate progress)

| Branch 2 item | Status |
|---|---|
| All 9 migrations (00064–00072) applied on dev, committed to git | 🟨 **3/9 complete** (00064 + 00065 + 00066) |
| Schema validator findings confirm alignment with Part 2 data model | ✅ for 2.3 (see §6) |
| No migrations apply changes via MCP that aren't in git files | ✅ PASS |
| `change_orders.co_type` + added columns align with Part 2 §2.2 | ✅ PASS |
| `app_private.refresh_approved_cos_total` predicate matches §1066–1072 value-semantics | ✅ PASS |

---

## 3. Git log (pending push)

```
b746cf7  feat(co): expand CO types and add pricing_mode, source_proposal_id
c6b468d  docs(plan): Phase 2.3 pre-flight amendments — A co_type default, B cache trigger + verification probe, C scope expansion to 7 app sites + form, D R.15 tests + semantic-equivalence regression, E down.sql, naming-collision note
09e80ac  docs(qa): Phase 2.3 pre-flight findings
803f4fe  docs(plan): add R.23 on codebase-precedent check for RLS and conventions
adae700  feat(proposals): add proposals tables as first-class entity
4fd3e7d  docs(plan): Phase 2.2 pre-flight amendments — updated_at + line-item audit columns + index set + narrative sync + R.7 note
```

---

## 4. R.18 blast-radius recap

Kickoff S-probes and pre-flight §2 classification table were re-verified on dev before any code touched. No delta from pre-flight findings:

| Identifier class | Pre-flight count | At kickoff (re-probe) | Touched in this commit |
|---|---|---|---|
| Type A passthrough (`co_type: string` / SELECT lists) | 6 files, 8 lines | same | 0 (no action needed — already correct) |
| Type B filter (`.eq("co_type","owner")` / `=== "owner"`) | 6 lines | same | **6 rewrites** — see §8 |
| Type C default (`?? "owner"`) | 1 line | same | **1 rewrite** to `?? "owner_requested"` |
| Type C TS union (`"owner" \| "internal"`) | 2 files | same | **2 rewrites** to `string` + `CO_TYPES` constant + runtime validation |
| Type C form state (`useState<"owner"\|"internal">`) | 1 file | same | **1 rewrite** to 5-value union + picker + `'owner_requested'` default |
| Type D UI label/badge | 2 files | same | **0** — deferred per GH #7 (raw-string fallback; label map lands in Branch 4) |
| Type E migrations (historical 00028 + live 00042) | 4 lines | same | 0 (00066 `CREATE OR REPLACE`s the live 00042 function body; historical 00028 lines are inert) |

Pre-flight §2.1 naming-collision flag (new `change_orders.pricing_mode` vs existing `items.pricing_model`) documented inline in the migration header and tracked under GH #8. No rename performed — the plan spec intentionally keeps the new name and defers renaming.

---

## 5. Migration Dry-Run findings

Executed against dev Postgres via Supabase MCP `execute_sql` inside three `BEGIN/ROLLBACK` blocks. Migration SQL inlined verbatim from `00066_co_type_expansion.sql`.

### Structural probes (12/12 PASS)

| Probe | Expected | Observed |
|---|---|---|
| `change_orders_co_type_check` definition | `CHECK (co_type IN ('owner_requested','designer_architect','allowance_overage','site_condition','internal'))` | `CHECK ((co_type = ANY (ARRAY['owner_requested'::text, 'designer_architect'::text, 'allowance_overage'::text, 'site_condition'::text, 'internal'::text])))` ✅ |
| `change_orders.co_type` default | `'owner_requested'::text` | `'owner_requested'::text` ✅ |
| `change_orders.pricing_mode` | TEXT NOT NULL DEFAULT `'hard_priced'` | `{"data_type":"text","not_null":true,"default":"'hard_priced'::text"}` ✅ |
| `change_orders.source_proposal_id` | `uuid` | `uuid` ✅ |
| `change_orders.reason` | `text` | `text` ✅ |
| `change_order_lines.created_po_id` | `uuid` | `uuid` ✅ |
| `app_private.refresh_approved_cos_total` body contains `co_type <> 'internal'` | true | `true` ✅ |
| `app_private.refresh_approved_cos_total` body still contains `co_type = 'owner'` | false | `false` ✅ |
| Live rows with `co_type='owner'` | 0 (all migrated) | `0` ✅ |
| Live rows with `co_type='owner_requested'` | 73 | `73` ✅ |
| Soft-deleted rows with `co_type='owner_requested'` | 15 | `15` ✅ |
| Post-backfill SUM(`jobs.approved_cos_total`) | `90104565` | `90104565` ✅ |

### Negative + positive probes (6/6 PASS)

All probes executed inside `DO $$ BEGIN … EXCEPTION` blocks against a real `(job_id, org_id)` seed tuple, with outcomes collected in a temp table before `ROLLBACK`:

| Probe | Expected | Observed |
|---|---|---|
| INSERT `co_type = 'owner'` (legacy value, now invalid) | `check_violation` (23514) | `23514` ✅ |
| INSERT `co_type = 'foobar'` (random invalid value) | `check_violation` (23514) | `23514` ✅ |
| INSERT `pricing_mode = 'unit'` (items.pricing_model value, wrong set) | `check_violation` (23514) | `23514` ✅ |
| INSERT `source_proposal_id = '00000…0001'` (no such proposal) | `foreign_key_violation` (23503) | `23503` ✅ |
| INSERT `change_order_lines.created_po_id = '00000…0002'` (no such PO) | `foreign_key_violation` (23503) | `23503` ✅ |
| INSERT without `co_type` — should land `'owner_requested'` under new default + new CHECK | `co_type='owner_requested'` | `co_type=owner_requested` ✅ |

### Trigger-chain probe (1/1 PASS)

Mutated an approved CO on one of the 2 affected jobs (+100 cents then –100 cents) inside `BEGIN/ROLLBACK` to exercise `co_cache_trigger → refresh_approved_cos_total` end-to-end under the new predicate.

| Metric | Expected | Observed |
|---|---|---|
| Baseline SUM(`approved_cos_total`) | 90104565 | `90104565` ✅ |
| Post-mutation SUM | 90104565 (no drift) | `90104565` ✅ |
| `trigger_kept_totals_consistent` | true | `true` ✅ |

### Post-apply probes (matching Dry-Run, after `apply_migration`)

Re-ran the 12 structural probes against live state after the real migration applied. All 12 match Dry-Run expectations. No `RAISE EXCEPTION` fired from the embedded verification probe — the in-migration check confirms the 90104565 invariant held through the real apply.

---

## 6. Schema Validator findings

### Kickoff re-probe (S1–S7) — no drift from pre-flight

| Probe | Pre-flight (2026-04-22 early) | Kickoff re-probe (2026-04-22 pre-commit) |
|---|---|---|
| S1: CHECK def | `CHECK ((co_type = ANY (ARRAY['owner'::text, 'internal'::text])))` | same ✅ |
| S2: DEFAULT | `'owner'::text`, NOT NULL | same ✅ |
| S3: live/soft-del `'owner'` | 73 / 15 | same ✅ |
| S3.1: SUM(approved_cos_total) | 90104565 cents, 2 jobs | same ✅ |
| S4: new columns absent | pricing_mode, source_proposal_id, reason, created_po_id all absent | same ✅ |
| S7: fn body predicate | `co_type = 'owner'` | same ✅ |

### Post-apply state (verified after `apply_migration`)

| Check | Result |
|---|---|
| `change_orders.co_type` CHECK | 5-value set (owner_requested, designer_architect, allowance_overage, site_condition, internal) ✅ |
| `change_orders.co_type` default | `'owner_requested'::text` ✅ |
| `change_orders.pricing_mode` | TEXT NOT NULL DEFAULT `'hard_priced'` ✅ |
| `change_orders.source_proposal_id` | UUID, FK → `public.proposals(id)` ✅ |
| `change_orders.reason` | TEXT, nullable ✅ |
| `change_order_lines.created_po_id` | UUID, FK → `public.purchase_orders(id)` ✅ |
| `app_private.refresh_approved_cos_total` body | predicate = `co_type <> 'internal'`; legacy `= 'owner'` gone ✅ |
| Live rows at `'owner'` | 0 ✅ |
| Live rows at `'owner_requested'` | 73 ✅ |
| Soft-del rows at `'owner_requested'` | 15 ✅ |
| SUM(`jobs.approved_cos_total`) on live jobs | 90104565 cents ✅ (invariant preserved) |
| Jobs with non-zero CO totals | 2 ✅ |

### R.23 precedent statement

Phase 2.3 introduces no new RLS policies and no new table conventions. Adding columns to existing tables (`change_orders`, `change_order_lines`) inherits row-level posture from the existing policy sets (5 policies on `change_orders`, 7 on `change_order_lines` — confirmed pre-flight S6). Modifying `app_private.refresh_approved_cos_total` is a behavioral correction matching the plan's own value-semantics table (§1066–1072) executed in the same transaction as the CHECK change — not a precedent-setting RLS or convention decision.

### Part 2 data-model alignment

- `co_type` 5-value set ✅ aligns with plan §2.2 value-semantics table.
- `pricing_mode` 3-value set (`hard_priced`,`budgetary`,`allowance_split`) ✅ aligns with plan §2.2.
- `source_proposal_id` FK target ✅ — `public.proposals` landed in 00065 (Phase 2.2); reference resolves.
- `created_po_id` FK target ✅ — `public.purchase_orders` from 00028.

---

## 7. Test results

### R.15 baseline (migration + code not yet written)

`npx tsx __tests__/co-type-expansion.test.ts`:

```
32 of 32 test(s) failed
```

Every FAIL reported either `ENOENT` on the migration/down files (19 cases) or the expected regex/string miss against the legacy application source (13 cases). Baseline evidence captured.

### Post-migration + post-code (R.15 green)

`npm test` — full suite:

```
── co-type-expansion.test.ts ──    32 passed   (NEW)
── created-by-populated.test.ts ── 15 passed
── draw-rpc-cascade.test.ts ──     11 passed
── job-phase-contract-type.test.ts ── 17 passed
── lien-release-waived-at.test.ts ──  9 passed
── po-patch-role-check.test.ts ──   4 passed
── proposals-schema.test.ts ──     27 passed
── status-enum-alignment.test.ts ── 20 passed

all test files passed
```

Total: **135 passed, 0 failed.** 103 prior (Phase 1.x + Phase 2.1 + Phase 2.2) + 32 new for Phase 2.3.

### Build

`npm run build` — `✓ Compiled successfully`. No TypeScript errors. Static page generation complete.

---

## 8. Files changed in this commit

**New files:**

- `supabase/migrations/00066_co_type_expansion.sql` — 173 lines. Flag-E sequencing with Amendment A (drop/re-set DEFAULT) + Amendment B (function rewrite + backfill + verification probe). Full `public.` schema qualification on every DDL line.
- `supabase/migrations/00066_co_type_expansion.down.sql` — 75 lines. Restores legacy predicate, drops 4 new columns in reverse order, reverse-maps `'owner_requested'` → `'owner'`, restores legacy CHECK + default, re-runs cache backfill under old predicate. Loud-fail posture.
- `__tests__/co-type-expansion.test.ts` — 32 cases covering migration structural contracts (existence, sequencing, Amendment A, Amendment B, columns, verification probe), down.sql structural contracts, 7 application-layer contracts (create route default + CO_TYPES constant, PATCH route widening + CO_TYPES constant, form widening + default value, 6 filter-site rewrites), and regression guards (invalid-value not in new CHECK).

**Modified files (8):**

- `src/lib/recalc.ts:213` — `.eq("co_type","owner")` → `.neq("co_type","internal")`.
- `src/lib/draw-calc.ts:421` — `.eq("co_type","owner")` → `.neq("co_type","internal")`.
- `src/app/api/draws/preview/route.ts:75,201` — 2 occurrences of `co.co_type === "owner"` → `co.co_type !== "internal"`.
- `src/app/api/draws/[id]/compare/route.ts:107` — `co.co_type === "owner"` → `co.co_type !== "internal"`.
- `src/app/api/admin/integrity-check/route.ts:215` — `.eq("co_type","owner")` → `.neq("co_type","internal")`.
- `src/app/api/jobs/[id]/change-orders/route.ts` — added file-private `CO_TYPES` constant (5 values); widened `CreateCoBody.co_type` to `string`; default `?? "owner"` → `?? "owner_requested"` + runtime validation via `CO_TYPES.includes(...)` (CONTRACT_TYPES precedent).
- `src/app/api/change-orders/[id]/route.ts` — same pattern: file-private `CO_TYPES` constant; widened `PatchBody.co_type` to `string`; runtime validation when `body.co_type !== undefined`.
- `src/app/jobs/[id]/change-orders/new/page.tsx` — added `CoType` union + `CO_TYPE_OPTIONS` picker list (5 labeled options); `useState<CoType>("owner_requested")`; `onChange` cast widened to `CoType`; select options rendered from `CO_TYPE_OPTIONS`.

Plan amendments shipped separately in commit `c6b468d`.

---

## 9. Flagged discoveries

1. **R.19 not claimed — no live dev-server round-trip.** This phase touches live runtime: 6 application filter sites (recalc, draw-calc, 2 draw routes, integrity-check), 2 API route validators, 1 form picker. The R.19 carve-out requires BOTH "no runtime code path touched" AND "Migration Dry-Run exercised full DB stack." Condition (a) fails. Mitigations shipped:
   - In-migration verification probe that aborts on cache drift (passed: 90104565 → 90104565).
   - Dry-run trigger-chain probe that mutated a real approved CO and confirmed `co_cache_trigger → refresh_approved_cos_total` kept totals consistent (passed).
   - R.15 test suite covers every code-change contract (32/32 PASS).
   - Build passes without TS errors — the widened body types + runtime validators compile cleanly against existing call sites.

   Recommended follow-up for push gate: hit one real-workflow path on dev (create a CO from the new form, approve it, verify the job's `approved_cos_total` reflects the new row) before merging to main. Not a blocker for review.

2. **GH #7 — UI display label/badge degradation is live.** `src/app/change-orders/[id]/page.tsx:170` and `src/app/jobs/[id]/change-orders/page.tsx:260` still read `co.co_type === "owner"` for their display branch. Any of the 73 existing rows (now `'owner_requested'`) and any future `designer_architect` / `allowance_overage` / `site_condition` rows render as the fallback branch — "Internal (budget only)" label / "Internal" badge. This is the known degradation that triggered GH #7; the label map lands in Branch 4. The new-CO form still lets users pick all 5 values, but the post-save display misrepresents them until the label map ships. Data model is correct; only the cosmetic layer is wrong.

3. **GH #8 — `pricing_mode` vs `items.pricing_model` naming collision.** Documented in the 00066 migration header (lines 32–37). Different tables (`change_orders` vs `items` + `invoice_extraction_lines`), different semantics (`hard_priced/budgetary/allowance_split` vs `unit/scope`). No rename performed — the plan spec locked the name. Future rename tracked under GH #8.

4. **Dry-run artifact:** a seed pcco_number conflict would have raised `unique_violation` in the negative probe block if I'd picked a pcco_number already present on the chosen job. Chose `99901–99920` range which doesn't exist on any live job; probes ran clean. Not a code issue — just a harness detail.

5. **Commit author attribution warning.** `git commit` surfaced Git's auto-identity warning (`Jake <Jake@RBC.local>`) because global user.email isn't set on this machine. Commit landed cleanly at `b746cf7`; no action needed unless you want a real author email baked into the commit — that's a `git config --global user.email` task, not a Phase 2.3 concern.

---

## 10. Invariant check — cached CO total

| Checkpoint | SUM(`jobs.approved_cos_total`) cents | Status |
|---|---|---|
| Pre-flight S3.1 (captured 2026-04-22, pre-amendment) | 90104565 | baseline |
| Kickoff re-probe (2026-04-22, pre-migration) | 90104565 | ✅ no drift |
| Migration Dry-Run post-body (inside BEGIN, before ROLLBACK) | 90104565 | ✅ match |
| Migration Dry-Run trigger-chain probe (after +100/–100 mutate) | 90104565 | ✅ invariant survives live trigger |
| Real apply — in-migration verification probe | 90104565 == 90104565 (no `RAISE EXCEPTION`) | ✅ |
| Post-apply live re-probe | 90104565 | ✅ invariant preserved |

The $901,045.65 cached contract adjustment across the 2 affected Ross Built jobs is intact. No silent zeroing occurred; the predicate switch from `co_type = 'owner'` to `co_type <> 'internal'` is semantically equivalent over the current dataset (every live approved CO is owner-typed; zero are internal), and the new predicate is also correct forward-looking under the 5-value set.
