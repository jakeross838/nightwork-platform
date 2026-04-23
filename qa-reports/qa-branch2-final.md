# QA Report — Branch 2 Final Exit Gate (Rollup)

**Generated:** 2026-04-23
**Branch span:** 2026-04-22 to 2026-04-23 (2 calendar days)
**Origin HEAD:** `aede6b9`
**Overall status:** ✅ COMPLETE — ready for Jake sign-off

---

## Summary

Branch 2 ("Schema Expansion for v1.0 Target") is done. **10 phases shipped, 11 migrations applied (00064–00074), slot 00075 reserved-unused** per Phase 2.10 reframe to documentation-only. Pre-flight discipline matured across the branch — by Phase 2.7+ every phase landed two commits (amendments → execution) and several added a third (post-execution plan-doc sync). 12+ pre-ship catches across the branch surfaced before any production-affecting work.

5 new standing rules added (R.19–R.23). 1 R.23 divergence accepted (`pricing_history` 1-policy audit spine, Phase 2.8). 11 GitHub issues opened (#7–#17), 1 closed (#5).

Build: ✅ green. Test suite: ✅ all 15 files passing (`__tests__/_runner.ts`). Schema state: 59 public tables, 242 policies, 75 triggers, 24 SECURITY DEFINER functions across `public` + `app_private`.

---

## §1 — Migration inventory

11 migrations applied. Slot 00075 reserved-unused. All have paired `.down.sql` per R.16.

| # | File | Phase | Notes |
|---|---|---|---|
| 00064 | `00064_job_phase_contract_type.sql` | 2.1 | New `jobs.phase` enum (9 values), expanded `jobs.contract_type` (6 values). Defaults chosen so existing rows don't break. |
| 00065 | `00065_proposals.sql` | 2.2 | First-class `proposals` + `proposal_line_items` entities. 3-policy RLS + audit cols + status_history. |
| 00066 | `00066_co_type_expansion.sql` | 2.3 | Expanded `change_orders.co_type` (5 values), added `pricing_mode` + `source_proposal_id`. Required `co_cache_trigger` modification (in `app_private`). |
| 00067 | `00067_co_cache_trigger_authenticated_grants.sql` | 2.3 (mid-branch insertion) | Pre-existing 00042-era latent bug surfaced by Phase 2.3 R.19 live test: `authenticated` role lacked `USAGE` on `app_private` schema → CO cache trigger broken on UI INSERTs. Insertion shifted Phase 2.4–2.9 by +1. |
| 00068 | `00068_cost_codes_hierarchy.sql` | 2.4 | `cost_codes.parent_id` self-FK + `app_private.validate_cost_code_hierarchy()` enforcing 3-tier max + cycle prevention. New `cost_code_templates` table (2-policy tenant config — Phase 2.4 R.23 precedent). |
| 00069 | `00069_draw_adjustments.sql` | 2.5 (Markgraf pivot) | Markgraf email surfaced 9+ adjustment events on one draw with no clean entity. Phase reassigned from approval_chains → draw_adjustments. 3-policy RLS + PM-on-own-jobs narrowing via FK-through-RLS to draws. |
| 00070 | `00070_approval_chains.sql` | 2.6 | `approval_chains` + `approval_chain_steps` (2 tables) for invoice/PO/CO routing config. 3-policy tenant config RLS (owner/admin writes only). Default chains seeded per org. |
| 00071 | `00071_milestones_retainage.sql` | 2.7 | New `job_milestones` table + retainage cols on `jobs` (`retainage_percent_default`, `retainage_dropoff_threshold`, `retainage_dropoff_percent`). Closed GH #5 (duplicate retainage CHECK constraints). |
| 00072 | `00072_job_milestones_pm_write_narrowing.sql` | 2.7 (mid-branch insertion) | §5.7 addendum: PM read narrowed via FK to `jobs.pm_id`, but writes only gated on role+org. `jobs` is org-wide readable so emergent FK-through-RLS defense didn't cover writes. Resolved before push, not deferred. |
| 00073 | `00073_pricing_history.sql` | 2.8 | Trigger-populated audit spine. **First R.23 divergence in Branch 2** (1-policy SELECT — no INSERT/UPDATE/DELETE policies). 4 trigger functions × SECURITY DEFINER + Amendment F.2 GRANT pattern. One-time backfill of `qa_approved` invoice lines. |
| 00074 | `00074_client_portal.sql` | 2.9 | `client_portal_access` (3-role: pm/admin/owner) + `client_portal_messages` (4-role: + accounting). Hashed tokens, sliding-window expiry, first anon-grant SECURITY DEFINER RPCs. 3-policy RLS — composition, no R.23 divergence. |
| ~~00075~~ | (no file) | 2.10 | **Reserved-unused.** Reframed to documentation-only per `qa-reports/preflight-branch2-phase2.10.md` after pre-flight surfaced `selections` collision (already shipped in 00052) + architectural-rule violations on empty stubs. v1.5/v2.0 naming registry now lives in plan Part 2 §2.2. Phase 3.1 picks up at 00076. |

**3 mid-branch insertions** broke the original 00064–00072 numbering: 00067 (Phase 2.3 grant fix), 00069 (Markgraf pivot), 00072 (PM write narrowing). Each renumber is documented in plan-doc renumber notes (lines 3161, 3163, 3165) with its source incident.

---

## §2 — Standing rules added in Branch 2 (R.19–R.23)

| Rule | Title | Origin | Notes |
|---|---|---|---|
| R.19 | Live-tests rule + static-validation carve-out | Branch 1 (R.19 added late in B1) refined in Branch 2 | Carve-out: schema-only phases can skip live workflow tests if (a) no API/UI changes and (b) Schema Validator + Migration Dry-Run probes cover the surface. Cited in Phase 2.4, 2.6, 2.7, 2.8, 2.9, 2.10. |
| R.20 | Read scripts before invoking | Branch 1 | Sister to R.21 — read fixture/teardown scripts before running them, not after. |
| R.21 | Synthetic fixtures, never real Ross Built data | Branch 1 (after Phase 1.3 pollution incident) | All R.19 live tests use `ZZZ_*` prefixed synthetic fixtures. Carried into every Branch 2 R.19-applicable phase. |
| R.22 | Teardown script sequencing | Branch 1 | Teardown script must be committed BEFORE test execution begins, not patched after. Ensures rollback path always exists. |
| R.23 | Codebase-precedent check for RLS and conventions | **Phase 2.2 (Branch 2)** | Before introducing a new RLS shape or convention, scan the codebase for prior precedent. Record either (a) which precedent is being followed, or (b) the explicit divergence rationale. Added in commit `803f4fe` after Phase 2.2 proposals work. **Most-cited new rule of Branch 2** — every subsequent phase has an "R.23 precedent statement" section. |

R.23 in particular shaped the structure of every later phase's QA report (mandatory `### R.23 precedent statement` heading in 2.4–2.10 reports).

---

## §3 — R.23 precedent catalog

Every RLS shape decision in Branch 2 against the precedent it cites:

| Phase | Table(s) | Shape | Precedent | Notes |
|---|---|---|---|---|
| 2.2 | `proposals`, `proposal_line_items` | 3-policy workflow (org_read + org_write + platform_admin) | New baseline (no prior workflow-entity precedent in plan; established by Phase 2.2) | Sets the canonical 3-policy workflow shape for Branch 2. |
| 2.3 | `change_orders` (existing, no new policies) | n/a | n/a | Column expansion only — inherits existing 5-policy shape. |
| 2.4 | `cost_codes` (existing, hierarchy added) | n/a (existing 5 policies preserved) | `unit_conversion_templates` (00054) | `cost_code_templates` adopts 2-policy tenant config (authenticated SELECT + platform_admin ALL) — Amendment B precedent reuse. R.23 accepted divergence on audit cols (no `org_id` / `created_by` / `deleted_at` on templates table — matches 00054 precedent). |
| 2.5 | `draw_adjustments` | 3-policy + PM narrowing via FK-through-RLS to `draws.pm_id` | Phase 2.2 | **Emergent defense:** `draws` is PM-narrowed at read-time, so even without explicit `EXISTS pm_id=auth.uid()`, the FK-through-RLS effectively narrows PMs to their own jobs. Tracked as GH #14 (PMs cannot INSERT cross-job draw_adjustments — by design). |
| 2.6 | `approval_chains`, `approval_chain_steps` | 3-policy tenant config (owner/admin write-only) | Phase 2.2 (3-policy shape) but writes restricted | Owner/admin only on writes — accepted variant. Default chains seeded per org. |
| 2.7 | `job_milestones` | 3-policy + PM narrowing via FK-through-RLS to `jobs.pm_id` | Phase 2.5 | **§5.7 finding:** read-side defense did NOT propagate to writes (`jobs` is org-wide readable, unlike `draws`). Resolved in 00072 before push (not deferred to Branch 8). |
| 2.8 | `pricing_history` | **1-policy SELECT only** (R.23 divergence) | `activity_log` (older 4-policy RESTRICTIVE-layered shape, not adopted) | First R.23 divergence in Branch 2. Trigger-populated append-only audit spine. SECURITY DEFINER triggers bypass RLS on writes. Immutability load-bearing for pricing-intelligence signal integrity. Regression fence in test asserts policy_count=1. |
| 2.9 | `client_portal_access`, `client_portal_messages` | 3-policy with composition (org_member OR portal_user) | Phase 2.2 | **No R.23 divergence** (Amendment A). Mixed-auth (authenticated org members + anon via signed token) handled via composition inside the policies, not via separate policy shapes. Asymmetric write role-sets: access table = 3-role (pm/admin/owner), messages table = 4-role (+ accounting). |
| 2.10 | (none — reframed to documentation-only) | n/a | n/a | Reframe avoided needing a new "stub table with no business rows yet" R.23 precedent. Decision deferred to v1.5/v2.0 builds. |

**Live state confirmation** (via `pg_policies` query, 2026-04-23):
- `proposals`: 3, `proposal_line_items`: 3, `draw_adjustments`: 3, `approval_chains`: 3, `job_milestones`: 3, `client_portal_access`: 3, `client_portal_messages`: 3 ✅
- `pricing_history`: 1 ✅ (R.23 divergence regression fence holds)
- `cost_code_templates`: 2 ✅ (tenant config shape)
- `cost_codes`: 5 ✅ (existing, untouched)

---

## §4 — GitHub issues opened/closed in Branch 2

**Opened in Branch 2** (#7–#17, 11 issues):

| # | Title | Phase | Target |
|---|---|---|---|
| [#7](https://github.com/jakeross838/nightwork-platform/issues/7) | Surface new change_orders.co_type values in UI display labels | 2.3 | Branch 4 |
| [#8](https://github.com/jakeross838/nightwork-platform/issues/8) | Naming collision: change_orders.pricing_mode vs items.pricing_model | 2.3 | Standalone or Branch 7 |
| [#9](https://github.com/jakeross838/nightwork-platform/issues/9) | Audit app_private schema grants for missing USAGE on authenticated role | 2.3 (00067 root cause) | Branch 5 or standalone |
| [#10](https://github.com/jakeross838/nightwork-platform/issues/10) | Clarify cost_codes.is_allowance vs budget_lines.is_allowance semantic authority | 2.4 | Branch 4 UI |
| [#11](https://github.com/jakeross838/nightwork-platform/issues/11) | Deprecate TEMPLATE_ORG_ID read-bypass in cost_codes RLS policy | 2.4 | Phase 7.5 |
| [#12](https://github.com/jakeross838/nightwork-platform/issues/12) | Default approval_chains stages are Ross-Built-derived heuristics; onboarding overrides | 2.6 | Branch 7 onboarding |
| [#13](https://github.com/jakeross838/nightwork-platform/issues/13) | CO numbering reconciliation — internal Buildertrend CO# vs AIA PCCO# | 2.6/2.7 (Markgraf email) | Branch 3 or 4 |
| [#14](https://github.com/jakeross838/nightwork-platform/issues/14) | PMs cannot INSERT draw_adjustments on cross-job draws (FK-through-RLS narrowing — by design) | 2.5 | Branch 3/4 (UX decision) |
| [#15](https://github.com/jakeross838/nightwork-platform/issues/15) | Retainage threshold/dropoff defaults are AIA values; onboarding should surface | 2.7 | Branch 7 onboarding |
| [#16](https://github.com/jakeross838/nightwork-platform/issues/16) | Validate pricing_history backfill signal quality before enabling matching UI | 2.8 | Branch 3/4 (gates matching UI) |
| [#17](https://github.com/jakeross838/nightwork-platform/issues/17) | Client-portal security review checklist before production launch | 2.9 | Branch 3/4 (pre-launch gate) |

**Closed in Branch 2** (1 issue):

| # | Title | Closure |
|---|---|---|
| [#5](https://github.com/jakeross838/nightwork-platform/issues/5) | Duplicate retainage CHECK constraints on jobs | Phase 2.7 — `00071_milestones_retainage.sql` dropped one of the duplicate constraints. |

**Carried from Branch 1 (still OPEN):** #1 (date math duplication), #2 (waived_at UI surface), #3 (bulk lien-release overwrite), #4 (jobs.phase/contract_type UI labels), #6 (audit cols on po_line_items + change_order_lines).

**Total open after Branch 2:** 16 (Branch 1 carry: #1-#4, #6; Branch 2: #7-#17). Total closed: 1 (#5).

---

## §5 — Pre-ship catches catalog (12 catches across Branch 2)

Pre-flight discipline matured through Branch 2. Catches surfaced *before* execution and were resolved via amendment commits.

| # | Phase | Catch | Class | Resolution |
|---|---|---|---|---|
| 1 | 1.3 (carry) | Real-data pollution from pre-R.21 fixtures on Fish/Dewberry draws | Data hygiene | R.21 added; cleanup commits `78905f4`, `6d2eba6`. |
| 2 | 2.2 | Hard `DELETE` policy missing from proposals tables | RLS shape | Pre-flight added Amendment-style explicit DELETE block + R.15 regression fence. |
| 3a | 2.3 | `co_cache_trigger` broken on UI INSERTs (latent 00042-era bug) | Runtime grant | 00067 grant fix (`authenticated USAGE on app_private`) + GH #9 follow-up. |
| 3b | 2.3 | `co_type` default value change (no surfaced UI for new values) | Schema/UI sync | Amendment A: kept default = `'internal'` to avoid breaking existing flows; UI labels deferred to GH #7. |
| 3c | 2.3 | 7 `app_private` consumer sites needed semantic-equivalence checks | Blast radius | R.18 sweep added Amendment C; R.15 regression fence per site. |
| 4 | 2.5 | **Markgraf architectural save** — original `approval_chains` Phase 2.5 reassigned to `draw_adjustments` after Markgraf email surfaced 9+ adjustment events on one draw with no clean entity | Scope pivot | Phase 2.5 reassigned; approval_chains shifted to Phase 2.6; downstream phases +1. |
| 5 | 2.5 | FK-through-RLS runtime defense (PMs cross-job INSERT block) | RLS emergent behavior | Discovered + accepted; tracked as GH #14. |
| 6 | 2.6 | `42P10` ON CONFLICT partial-index rule — partial indexes can't be used for ON CONFLICT inference | Postgres dialect | Amendment changed approach; documented in plan-doc sync. |
| 7 | 2.7 | PM write-side asymmetry on `job_milestones` (read narrowed, writes role+org only) | RLS defense in depth | 00072 mid-branch fix before push. Established defense-in-depth precedent for any future PM-narrowed table. |
| 8 | 2.8 | Pre-flight table-name defect: spec said `purchase_order_line_items`, canonical name is `po_line_items` | Spec drift | Amendment H corrected trigger target. |
| 9a–9d | 2.8 | Runtime: 4 column-shape defects on invoice_line_items (qty/rate/amount_cents not quantity/unit_price/amount) | Spec drift | Plan-doc sync commit after execution; documented in QA §3. |
| 9e | 2.8 | `rate` stored in DOLLARS not cents; needed `ROUND(rate * 100)::BIGINT` conversion | Unit hazard | Caught at execution; documented in QA §3 + migration header runtime note. |
| 10 | 2.9 | `extensions.digest()` schema qualifier (was `digest()` in plan, fails apply) | Postgres dialect | Plan-doc sync after execution caught it; resolved in QA §3.1. |
| 11 | 2.9 | `0A000` subquery-in-`CHECK` constraint (Postgres rejects subqueries in CHECK) | Postgres dialect | Amendment N decision: KEEP CHECK with rewrite; documented in QA §6.2. |
| 12 | 2.10 | `selections` collision — already exists as fully-built table from 00052 (28 cols + RLS), not a v1.5 stub | Plan-doc drift | Phase 2.10 reframed to documentation-only per `qa-reports/preflight-branch2-phase2.10.md`. |

**Pattern:** the cadence of pre-flight findings stayed roughly constant through the branch (1–4 per phase), but the type shifted: early phases (2.2–2.6) caught policy/precedent issues; mid-late phases (2.7–2.9) caught runtime/dialect issues that schema-level static review missed; Phase 2.10 caught the most consequential (a hard collision) via static `pg_tables` lookup before any DDL ran.

---

## §6 — Plan-doc sync commits (post-execution drift correction)

Pattern established: after a phase ships, sync the plan-doc spec to whatever actually got applied. 4 instances in Branch 2:

| Phase | Commit | Drift type |
|---|---|---|
| 2.6 | (`docs(plan): sync Phase 2.6 ON CONFLICT...`) | `42P10` ON CONFLICT inference rewrite |
| 2.7 | `c05da3a` (renumber) + `6b43caf` (00072 narrowing) | Mid-branch renumber + §5.7 addendum |
| 2.8 | `083167e` | 4 column-shape defects + dollars/cents conversion |
| 2.9 | `18dc087` | 2 runtime defects (digest schema qualifier + subquery-in-CHECK rewrite) |

Established discipline: plan-doc and shipped migration must converge in git history. Phase 2.10 followed the same pattern preemptively (the documentation-only reframe IS the sync — slot 00075 reserved-unused is the new shipped reality).

---

## §7 — Branch 2 Final Exit Gate checklist

Run against live state on `aede6b9` / 2026-04-23:

| # | Gate item | Status | Evidence |
|---|---|---|---|
| 1 | All 11 migrations (00064–00074) applied; slot 00075 reserved-unused | ✅ PASS | `mcp__supabase__list_migrations` confirms 00064–00074 applied; no 00075 file in repo (`ls supabase/migrations/00075*` = no match). Branch HEAD `aede6b9`, working tree clean. |
| 2 | Schema validator confirms full alignment with Part 2 data model | ✅ PASS | Schema Validator probes embedded in Phase 2.2–2.9 R.15 test files (15 test files, all green). Live `pg_policies` query confirms expected policy counts on all 10 new Branch 2 tables. |
| 3 | No migrations apply changes via MCP that aren't in git files | ✅ PASS | All 11 migrations have corresponding `supabase/migrations/000XX_*.sql` files committed; live `mcp__supabase__list_migrations` versions match git filenames. |
| 4 | `jobs.phase` and `jobs.contract_type` defaults don't break existing workflows | ✅ PASS | Phase 2.1 QA (`qa-branch2-phase2.1.md`) confirms 15 production jobs migrated cleanly; defaults chosen so existing rows fall into `'in_progress'` / `'cost_plus_aia'`. |
| 5 | Proposals tables exist and are empty (populated in Branch 3) | ✅ PASS | `proposals` + `proposal_line_items` exist with 3-policy RLS each. Population deferred to Phase 3.5 (proposal extraction pipeline). |
| 6 | Approval chains table exists; default chains seeded per org | ✅ PASS | `approval_chains` + `approval_chain_steps` exist; Phase 2.6 QA confirmed seed for all existing orgs. GH #12 tracks onboarding overrides for new orgs. |
| 7 | Pricing history triggers ready to fire (nothing to fire against until Branch 3) | ✅ PASS | 4 trigger functions present with SECURITY DEFINER + GRANT EXECUTE TO authenticated. One-time backfill of `qa_approved` invoice lines completed at 00073 apply (count + spot-check in `qa-branch2-phase2.8.md` §3). |
| 8 | Client portal tables exist and are empty | ✅ PASS | `client_portal_access` + `client_portal_messages` exist with 3-policy RLS. Hashed-token RPCs + sliding-window expiry shipped. Population/UX deferred to Branch 3/4. GH #17 gates production launch. |
| 9 | V2.0 hook tables documented as naming registry in Part 2 §2.2 (no migration shipped per Phase 2.10 reframe) | ✅ PASS | Plan-doc Part 2 §2.2 contains v1.5/v2.0 naming registry for 7 tables (selections excluded — already shipped in 00052). `qa-reports/preflight-branch2-phase2.10.md` documents the reframe. |
| 10 | Branch rollup QA report generated | ✅ PASS | This file. |

**Build:** ✅ `npm run build` clean (background task `bzwoo5hy3`, exit 0).
**Tests:** ✅ all 15 test files green (`npx tsx __tests__/_runner.ts`, exit 0). User-reported aggregate 358 tests across 15 files.
**Working tree:** ✅ clean on `main` at `aede6b9`, up to date with `origin/main`.

**Verdict:** all 10 gate items PASS. ✅ Branch 2 closes.

---

## §8 — Carried-forward items for Branch 3 pre-context

### 8.1 — Plan-doc stale references

- **Line 4083 / 4310 — Phase 3.1 Exit Gate "Migration 00072"** — pre-existing stale reference. Should read `00076` post-Phase-2.10 reframe (was `00075` in user's kickoff context, now `00076` since 00075 is reserved-unused). **Pre-context task for Branch 3.1.**
- **Line 3168 historical renumber note** — last mid-branch renumber note says "Phase 2.10 = V2.0 hooks / 00075". Accurate at writing time; reframe documented separately. Leave as historical paper trail.

### 8.2 — Branch 1 / pre-Branch-2 issues still open

- #1 — date math duplication (Branch 8/9 candidate)
- #2 — `lien_releases.waived_at` UI surface (Branch 4)
- #3 — bulk lien-release overwrites `received_at`/`waived_at` on repeated calls (Branch 5 or standalone)
- #4 — jobs.phase / contract_type UI labels (Branch 4)
- #6 — audit columns on `po_line_items` and `change_order_lines` (Branch 2 candidate but deferred — surfaces in Branch 3 if extraction pipelines need them)

### 8.3 — Branch-2 issues that gate downstream branches

- **#16 (gates Branch 3/4 matching UI)** — pricing_history backfill signal-quality validation. MUST run before any user-facing fuzzy-match UI lights up.
- **#17 (gates production portal launch)** — client-portal security review checklist. MUST clear before any portal goes live to real Ross Built clients.
- **#9 (Branch 5 candidate)** — full audit of `app_private` grants. Surfaced by 00067 latent bug; not all functions verified yet.

### 8.4 — Known security advisor warnings (none new from Branch 2)

11 advisor warnings remain on dev (`mcp__supabase__get_advisors`, security):
- 7 × `function_search_path_mutable` — all on pre-Branch-2 functions (`trg_change_orders_status_sync`, `touch_updated_at`, `_compute_scheduled_payment_date`, `app_private.{co_cache_trigger, cleanup_stale_import_errors, update_vip_landed_total_cents, update_iel_landed_total_cents}`). **Branch 2's new SECURITY DEFINER functions all pin `search_path = public, pg_temp` per Amendment F.2 / J pattern — none added a new warning.**
- 1 × `extension_in_public` — `pg_trgm` in public schema (used by Phase 2.8 `pricing_history.description gin_trgm_ops` index). Pre-existing (extension was already in public before Phase 2.8 used it). Branch 9 cleanup candidate.
- 2 × `public_bucket_allows_listing` — pre-existing storage bucket warnings (`lien-release-files`, `logos`).
- 1 × `auth_leaked_password_protection` — config-level, pre-existing.

**Performance advisor** was attempted but exceeded token limit (435K chars). Spot-checking deferred to Branch 8 (performance branch). Schema-only Branch 2 changes are unlikely to have introduced new performance regressions — every new policy uses `auth.uid()` + `org_members` lookup pattern matching prior phases.

---

## §9 — Ross Built dogfood readiness statement

**Question:** is dev DB ready to start processing real Ross Built data in Branch 3?

**Answer:** ✅ **Yes, with one explicit gate.**

Branch 2 ships only schema additions + new RLS shapes. No existing data paths were modified. 15 production jobs still load; existing invoice/CO/PO/draw flows unchanged. The 11 new migrations are additive — old code reads/writes nothing in the new tables, and new tables are empty (or, for `pricing_history`, populated only by SECURITY DEFINER triggers from `qa_approved` invoice lines per the Phase 2.8 backfill).

**The one gate:** **Branch 3 ingestion pipelines populating `client_portal_*` / `pricing_history` / `proposals` should NOT run against real Ross Built client data until:**

1. **GH #17 (client-portal security review)** — checklist clear, hashed-token revocation paths verified, sliding-window expiry observed under realistic load.
2. **GH #16 (pricing_history signal quality)** — backfill output spot-checked for cost-intelligence noise before any matching UI surfaces.

Both are tracked, both are gates on Branch 3/4 user-facing UIs (not on the underlying ingestion jobs, which can run in shadow mode against real data to build the dataset that the gates validate).

**Real Ross Built Buildertrend exports + invoice PDFs can flow into the system from Phase 3.2 onward without modification to existing jobs/budgets/draws data.** The Markgraf job (the Phase 2.5 trigger) is the first natural canary for Phase 3.2/3.3 once those land.

---

## §10 — Artifact inventory

**New files in Branch 2 (47 total committed):**

- 11 migrations + 11 paired `.down.sql` (22 files)
- 12 R.15 test files (8 new in Branch 2 + carry from Branch 1; current state 15 total in `__tests__/`)
- 9 phase QA reports (`qa-branch2-phase2.1.md` through `qa-branch2-phase2.9.md`)
- 8 phase pre-flight reports (`preflight-branch2-phase2.3.md` through `preflight-branch2-phase2.10.md`)
- This rollup (`qa-branch2-final.md`)

**Modified during Branch 2:**

- `docs/nightwork-rebuild-plan.md` — extensive amendments throughout (R.23 added, every phase has amendment commit + sync commit)
- `CLAUDE.md` — minor (no major edits Branch 2)
- `src/` — minimal touches (Branch 2 is schema-only; UI for new fields deferred to Branch 4)

**Branch 2 commit count:** ~50 commits since Branch 1 close (`7c5e038` marked Branch 1 complete; `aede6b9` is Branch 2 close).

---

## §11 — Flagged for Jake

1. **R.23 became the most-cited new rule.** Every phase 2.4+ has an "R.23 precedent statement" section in its QA report. The discipline of stating "I am following X precedent" or "I am explicitly diverging because Y" surfaced the `pricing_history` divergence (Phase 2.8) cleanly instead of having it emerge as an inconsistency later. Recommend keeping this discipline through Branch 3+.

2. **Mid-branch renumbers cost paper-trail clarity but caught real bugs.** 3 renumbers in 11 migrations (00067, 00069, 00072) means ~27% of slots required mid-branch insertion. Each was an actual catch (latent 00042 bug; Markgraf architectural save; PM write-side defense-in-depth). The plan-doc renumber notes (lines 3161, 3163, 3165) preserve the chain — reading those notes is required context for any Branch 3 plan amendment.

3. **Phase 2.10 reframe set a useful precedent** — when pre-flight surfaces architectural concerns on a "thin" phase, reframing to documentation-only beats forcing the migration through. Slot 00075 reserved-unused is a small cost; the architectural-rule audit it forced (CLAUDE.md "every record" rules don't sit cleanly on empty stubs) is the actual value.

4. **Performance advisor was oversized (435K chars).** Skipping it for Branch 2 rollup is acceptable since Branch 2 is schema-only. Branch 8 (performance) will need to fetch this in chunks or via direct `pg_stat_*` queries.

5. **Test runner output appears truncated** (only 30 lines visible per run). User-reported "358 passing across 15 files" is consistent with the runner's `all test files passed` final-status marker but I could not verify the exact aggregate from a single run's stdout. Branch 9 test-runner replacement should produce a clear per-file + grand-total summary.

6. **GH #17 + #16 are the two production-launch gates.** Both are well-tracked and have explicit gating language. Adding them to a "Branch 3 launch checklist" doc when Branch 3 nears completion would be cheap insurance.

---

## §12 — Ready for Branch 3?

✅ **YES**, pending Jake's sign-off on this report.

Branch 3 ("Universal Ingestion Generalization") begins at Phase 3.1 (`invoice_extractions` → `document_extractions` rename, migration `00076`). Branch 3 pre-context tasks: resolve plan-doc stale ref at line 4083/4310 (`Migration 00072` → `Migration 00076`), confirm test-suite green after rename cascade, dry-run the extraction-pipeline scaffold against the 3 reference invoice formats (clean PDF, T&M, lump sum Word doc — per CLAUDE.md testing rule).

Branch 2 closes here.
