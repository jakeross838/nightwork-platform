# Pre-flight Findings — Branch 2 Phase 2.7: Job milestones + retainage config

**Date:** 2026-04-23
**Migration target:** `supabase/migrations/00071_milestones_retainage.sql` (+ `.down.sql`)
**Origin HEAD at kickoff:** `7a1e33d` (clean working tree)
**Mode:** PRE-FLIGHT ONLY — no migration written, no SQL applied, no Dry-Run, no plan amendment.
**Plan spec:** `docs/nightwork-rebuild-plan.md` lines 3913–3943 (raw SQL, no prior amendments).

---

## §1 Scope call: GH #5 retainage CHECK duplication

### §1.1 Live-state probe via `pg_constraint`

```sql
SELECT conname, pg_get_constraintdef(oid), oid
FROM pg_constraint
WHERE conrelid = 'public.jobs'::regclass AND conname ILIKE '%retainage%'
ORDER BY oid;
```

| conname | def | oid (creation-order proxy) |
|---|---|---|
| `jobs_retainage_percent_check` | `CHECK (((retainage_percent >= (0)::numeric) AND (retainage_percent <= (100)::numeric)))` | `19623` (older) |
| `chk_jobs_retainage_percent`   | `CHECK (((retainage_percent >= (0)::numeric) AND (retainage_percent <= (100)::numeric)))` | `21418` (newer) |

**Predicates are byte-identical.** Dropping either one leaves the surviving constraint enforcing the same rule; no semantic change.

### §1.2 Origin trace

| Constraint | Introduced by | Mechanism |
|---|---|---|
| `jobs_retainage_percent_check` | `00030_phase8_draws_liens_payments.sql:23–25` (`ADD COLUMN … CHECK (…)` inline) | Auto-generated name (Postgres `{table}_{column}_check` convention) |
| `chk_jobs_retainage_percent`   | Not found as a named `ADD CONSTRAINT … CHECK` in `supabase/migrations/` grep. Sibling explicit-name constraints `chk_jobs_deposit_percentage` and `chk_jobs_gc_fee_percentage` appear in `00037_rollback_phase_b_pre_rebuild.sql:146–148` as `DROP CONSTRAINT IF EXISTS` statements — strong evidence the `chk_jobs_*` naming convention was introduced as a hygiene/consistency pass whose CREATE side lives in a migration the grep hasn't surfaced (or was applied via MCP and not captured in `supabase/migrations/`). | Intentional, explicit name; part of the `chk_jobs_*` convention family. |

**`chk_jobs_retainage_percent` is the intentional survivor.** `jobs_retainage_percent_check` is the auto-named leftover.

### §1.3 Code references

```
Grep pattern: chk_jobs_retainage_percent|jobs_retainage_percent_check
Scope: everything except node_modules/.next/.git/dist/build
Result: 1 file — qa-reports/qa-branch2-phase2.1.md (§ original GH #5 flag)
```

Zero `src/`, `__tests__/`, `app/api/`, `lib/`, or migration references to either constraint **name**. Dropping either is safe — no error-handler string-matches against the name.

### §1.4 Data-impact check

```sql
SELECT retainage_percent, count(*) FROM public.jobs WHERE deleted_at IS NULL GROUP BY retainage_percent;
```

| retainage_percent | jobs |
|---|---|
| `0.00` | 2 |
| `10.00` | 13 |

Both values satisfy both constraints (0 ≤ 0/10 ≤ 100). Dropping the auto-named duplicate triggers no row-level revalidation failures.

### §1.5 Recommendation — **OPTION A (resolve inside 00071)**

Drop `jobs_retainage_percent_check` (the auto-named leftover from 00030). Keep `chk_jobs_retainage_percent` (explicit name, aligned with the `chk_jobs_deposit_percentage` / `chk_jobs_gc_fee_percentage` convention family). Add new constraints on the two new columns using the same explicit `chk_jobs_*` naming:

- `chk_jobs_retainage_threshold_percent CHECK (retainage_threshold_percent >= 0 AND retainage_threshold_percent <= 100)`
- `chk_jobs_retainage_dropoff_percent   CHECK (retainage_dropoff_percent   >= 0 AND retainage_dropoff_percent   <= 100)`

**Why A over B (defer) or C (leave standing):**

1. **Identical predicates** — the drop is semantically null. No behavioral change, no row revalidation risk.
2. **Zero code reach** — §1.3 grep confirms no error handler, RLS policy, or test depends on the constraint name.
3. **Adjacent scope** — 00071 is already touching jobs retainage columns. Dropping the duplicate is zero additional blast radius (same ALTER TABLE statement).
4. **Debt cost of deferral** — Branch 8 is phases away. Every Phase 2.x migration that touches jobs CHECK constraints in between has to work around the duplicate existing. Pay the cost once, now.
5. **Zero test regressions expected** — no existing `__tests__/*.test.ts` asserts constraint names or counts on jobs (R.18 grep confirms).

Recommend closing GH #5 with the 00071 commit message. If Jake prefers B or C, that's a single-line Amendment flip — the migration-file skeleton is the same except for whether `ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_retainage_percent_check;` is present.

---

## §2 Migration number + filename verification

### §2.1 Slot availability

```
$ ls supabase/migrations/ | tail
  00066_co_type_expansion.sql / .down.sql          (applied)
  00067_co_cache_trigger_authenticated_grants.*    (applied)
  00068_cost_codes_hierarchy.*                     (applied)
  00069_draw_adjustments.*                         (applied, Phase 2.5)
  00070_approval_chains.*                          (applied, Phase 2.6)
  00071_*                                          (next free slot) ✅
```

`mcp__supabase__list_migrations` confirms `20260423005250 00070_approval_chains` as the last applied entry.

### §2.2 In-spec filename references

Phase 2.7 spec at lines 3913–3943:

| Line | Reference | Verdict |
|---|---|---|
| 3915 | `` Migration `00071_milestones_retainage.sql`: `` | ✅ |

Only one filename reference; no pluralization / number drift.

### §2.3 Plan exit-gate language

Plan exit-gate at line 4053:

> `All 11 migrations (00064 through 00074, with 00067 as the mid-branch grant fix and 00069 as the mid-Branch-2 draw_adjustments insertion from the Markgraf-scenario pivot) applied on dev, committed to git`

00071 lands cleanly inside this range. No exit-gate edit required for Phase 2.7.

### §2.4 "Phase 2.6" / other-phase references inside Phase 2.7 spec

`grep -nE "Phase 2\.[0-9]+" docs/nightwork-rebuild-plan.md | head` shows the Phase 2.7 spec body (3913–3943) contains zero cross-phase references. No precedent citations, no renumber artifacts. (The 3163 mid-branch-renumber paragraph lives outside the Phase 2.7 spec block.)

---

## §3 R.18 blast-radius grep

Scope: everything under repo root except `node_modules/ .next/ .git/ dist/ build/`.

### §3.1 New identifiers introduced by Phase 2.7 spec

```
Grep: job_milestones|milestone_completions|draw_mode|tm_labor_hours|
      tm_material_cost|tm_sub_cost|tm_markup_amount|
      retainage_threshold_percent|retainage_dropoff_percent
Hits: 2 files
  docs/nightwork-rebuild-plan.md           (the spec itself)
  qa-reports/preflight-branch2-phase2.5.md (forward-looking reference)
```

**Zero `src/` / `__tests__/` / `supabase/migrations/` hits for any of the 9 new identifiers.** Consumers land in Branch 3/4 (draw writer) and Branch 7 (settings UI).

### §3.2 Generic `milestone` (case-insensitive, -i)

```
Hits: 8 files
  docs/nightwork-rebuild-plan.md                        (spec)
  src/app/invoices/[id]/page.tsx                        ⚠ inspect
  qa-reports/qa-branch2-phase2.4.md                     (QA report)
  qa-reports/preflight-branch2-phase2.5.md              (QA report)
  qa-reports/preflight-branch2-phase2.6.md              (QA report)
  REVIEW_FINDINGS.md                                    (doc)
  .claude/skills/nightwork-design/Slate Immersive Build.html  (design skill)
  .claude/skills/nightwork-design/Slate Mobile Jobsite.html   (design skill)
```

`src/app/invoices/[id]/page.tsx` — inspected:

```
1463:       narrative + milestone status timeline. Workbench (full editing
1993:       {/* ── Status timeline (milestone view) ── */}
```

Both hits are `milestone` used **colloquially** to describe a status-timeline UI idiom on invoices — unrelated to `job_milestones` the new table. No collision; no refactor required.

### §3.3 `retainage_percent` (existing column — expected hits)

```
Hits: 18 files
  docs/nightwork-rebuild-plan.md
  supabase/migrations/00030_phase8_draws_liens_payments.sql
  supabase/migrations/00031_phase8c_org_default_retainage.sql
  supabase/migrations/00037_rollback_phase_b_pre_rebuild.sql
  src/lib/draw-calc.ts
  src/lib/budget-export.ts
  src/app/jobs/[id]/page.tsx
  src/app/jobs/[id]/budget/page.tsx
  src/app/draws/new/page.tsx
  src/app/draws/[id]/page.tsx
  src/app/api/jobs/route.ts
  src/app/api/draws/new/route.ts
  src/app/api/draws/preview/route.ts
  src/app/api/draws/[id]/route.ts
  src/app/api/draws/[id]/compare/route.ts
  scripts/e2e-dewberry-setup.mjs
  qa-reports/qa-branch2-phase2.1.md
  REVIEW_FINDINGS.md
```

All hits are data reads/writes against `jobs.retainage_percent` (expected). **Zero hits reference the CHECK constraint names** (`chk_jobs_retainage_percent` / `jobs_retainage_percent_check`) — confirms §1.3. GH #5 cleanup is code-invisible.

### §3.4 Summary

| Identifier space | src/ hits | __tests__/ hits | supabase/migrations/ hits |
|---|---|---|---|
| 9 new identifiers introduced by Phase 2.7 | 0 | 0 | 0 |
| Generic `milestone` | 1 (unrelated UI idiom) | 0 | 0 |
| `retainage_percent` (existing, for context) | 11 | 0 | 3 |

No blast-radius surprises. Phase 2.7 is a clean additive migration from the application-code perspective.

---

## §4 Schema Validator pre-probes (via Supabase MCP)

### §4.1 Migration state

- Last applied: `00070_approval_chains` (2026-04-23, Phase 2.6).
- `to_regclass('public.job_milestones')` = `null` — no pre-existing table.
- 00071 slot free.

### §4.2 Live entity counts

| Entity | Count |
|---|---|
| `public.organizations` (active) | `3` |
| `public.jobs` (not soft-deleted) | `15` |
| `public.jobs` (status='active', not soft-deleted) | `15` |
| `public.draws` (not soft-deleted) | `2` |

Kickoff prompt expected ~14 active jobs — **actual is 15**. Minor drift; not a flag. All 15 are `status='active'`.

### §4.3 Current `jobs` retainage columns

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='jobs' AND column_name ILIKE '%retainage%';
```

| column | type | nullable | default |
|---|---|---|---|
| `retainage_percent` | `numeric` | `NO` | `10.00` |

No pre-existing `retainage_threshold_percent` or `retainage_dropoff_percent`. New columns land cleanly.

### §4.4 Current `jobs` CHECK constraints (full dump)

| conname | def |
|---|---|
| `chk_jobs_retainage_percent` | `CHECK ((retainage_percent >= 0) AND (retainage_percent <= 100))` |
| `jobs_retainage_percent_check` | `CHECK ((retainage_percent >= 0) AND (retainage_percent <= 100))` — **duplicate, §1** |
| `jobs_construction_type_check` | 6-value enum |
| `jobs_contract_type_check` | 6-value enum (cost_plus_aia / cost_plus_open_book / fixed_price / gmp / time_and_materials / unit_price) |
| `jobs_finish_level_check` | 5-value enum |
| `jobs_phase_check` | 9-value enum |
| `jobs_status_check` | 4-value enum (active / complete / warranty / cancelled) |

**Note for §6:** `contract_type` already includes `'time_and_materials'` as a valid value. Phase 2.7 adds `tm_*` columns on `draws` without touching `contract_type`. The semantic overlap is intentional — a job's `contract_type='time_and_materials'` is the *contract-level* T&M flag; `draws.draw_mode='tm'` is the *draw-level* presentation mode. They can align but are structurally independent (a cost_plus_aia job could theoretically issue a tm-mode draw for a specific scope; consistency is application-layer).

### §4.5 Current `draws` columns (full dump, 36 columns)

Columns relevant to Phase 2.7 impact:

- `wizard_draft JSONB` (nullable) — Branch 3 draw-wizard state. Unrelated to `milestone_completions`.
- `retainage_on_completed BIGINT NOT NULL DEFAULT 0` — existing cents column.
- `retainage_on_stored BIGINT NOT NULL DEFAULT 0` — existing cents column.
- `total_retainage BIGINT NOT NULL DEFAULT 0` — existing cents column.
- `total_earned_less_retainage BIGINT NOT NULL DEFAULT 0` — existing cents column.
- Full audit-column set already present: `org_id`, `created_at`, `updated_at`, `created_by`, `deleted_at`, `status_history`.
- `status TEXT NOT NULL DEFAULT 'draft'` — no `draw_mode` column yet.

**No pre-existing `draw_mode`, `milestone_completions`, `tm_labor_hours`, `tm_material_cost`, `tm_sub_cost`, `tm_markup_amount` columns.** New columns land cleanly.

### §4.6 `job_milestones` name collision

`to_regclass('public.job_milestones')` = `null`. No collision in any schema. No pre-existing trigger named `trg_job_milestones_*`.

### §4.7 Live retainage policy (Ross Built)

```sql
SELECT retainage_percent, count(*) FROM public.jobs WHERE deleted_at IS NULL GROUP BY retainage_percent;
```

| retainage_percent | jobs |
|---|---|
| 0.00 | 2 |
| 10.00 | 13 |

Ross Built's org default (`organizations.default_retainage_percent`) is `0.00` per `00031`. The 13 jobs with 10% retainage were created before the org default was set to 0 (migration 00031 only updates `default_*`, doesn't cascade to existing jobs — see 00031 comment at lines 22–32). Not a Phase 2.7 concern, but useful context for Amendment design on the two new retainage columns: we should not backfill defaults onto existing jobs (additive migration per CLAUDE.md).

---

## §5 R.23 precedent selection

### §5.1 `job_milestones` — new table, R.23 choice

`job_milestones` is **workflow data** (PMs mark milestones complete, accounting bills against them). It is NOT tenant config.

**Latest tenant-table precedent family:**
- 00065 `proposals` → 3-policy shape, write role-set `(owner, admin, pm, accounting)`. **Workflow data precedent.**
- 00069 `draw_adjustments` → same 3-policy shape + surgical PM-on-own-jobs narrowing on the read policy. Workflow data, extends proposals.
- 00070 `approval_chains` → same 3-policy shape, write role-set narrowed to `(owner, admin)` only. **Tenant config precedent — narrower.**

**Recommended precedent for Phase 2.7:** **00065 proposals** (4-role write set). `job_milestones` is workflow data; PMs need to mark their own job's milestones complete; accounting needs to mark billed. The approval_chains narrowing does not apply — milestones are not about *who approves*, they are about *what was achieved*.

Optional PM-on-own-jobs predicate narrowing on the **read** policy (draw_adjustments / 00069 style) is available if Jake wants PMs to only see milestones on their assigned jobs. **Recommend: adopt it.** Consistent with the draws / draw_line_items / draw_adjustments "PM read on own jobs" information-parity rule — otherwise PMs excluded from a job can `SELECT` that job's milestones which is a leak relative to `public.draws`.

### §5.2 Parent-table posture for column ALTERs

`ALTER TABLE public.jobs ADD COLUMN retainage_threshold_percent …` and `ALTER TABLE public.draws ADD COLUMN draw_mode …` inherit existing RLS. Live probe:

**`public.jobs` — 5 policies:**

| policy | cmd | gate |
|---|---|---|
| `org isolation` | ALL (RESTRICTIVE? or PERMISSIVE — pg_policies doesn't show restrictive here, check migration) | `org_id = app_private.user_org_id() OR platform_admin()` |
| `authenticated read jobs` | SELECT | `org_id = app_private.user_org_id()` |
| `admin owner write jobs` | ALL | role IN (admin, owner) |
| `jobs_delete_strict` | DELETE | `org_id = app_private.user_org_id()` |
| `jobs_platform_admin_read` | SELECT | `is_platform_admin()` |

Write-capable roles on `public.jobs` = **owner, admin only**. The two new retainage columns inherit this — only owner/admin can change retainage threshold/dropoff. **Fine — retainage policy is tenant finance config.**

**`public.draws` — 6 policies:**

| policy | cmd | gate |
|---|---|---|
| `org isolation` | ALL | `org_id = app_private.user_org_id() OR platform_admin()` |
| `owner admin accounting read draws` | SELECT | role IN (owner, admin, accounting) |
| `pm read draws on own jobs` | SELECT | role='pm' AND job.pm_id = auth.uid() |
| `draws_platform_admin_read` | SELECT | `is_platform_admin()` |
| `admin owner accounting write draws` | ALL | role IN (admin, owner, accounting) |
| `draws_delete_strict` | DELETE | `org_id = app_private.user_org_id()` |

Write-capable roles on `public.draws` = **owner, admin, accounting.** The new `draw_mode`, `milestone_completions`, and `tm_*` columns inherit this. **Fine — draw mode is an accounting-authored attribute.**

### §5.3 No divergence vs. 00065 proposals precedent required

- `job_milestones` → 3-policy shape with workflow-data write role-set + optional PM-on-own-jobs read narrowing. Verbatim from proposals + draw_adjustments precedent.
- `jobs` / `draws` column ALTERs → inherit existing parent-table RLS (no new policies). Existing write role-sets already enforce the correct writer gates.

---

## §6 Spec gaps / amendments-to-consider

The raw spec at plan lines 3913–3943 is 30 lines of bare SQL without any of the Branch 2 standards established across 2.1–2.6. Gap list:

### §6.1 `job_milestones` table gaps

| # | Gap | Recommended resolution |
|---|---|---|
| 1 | No `org_id UUID NOT NULL REFERENCES public.organizations(id)` — violates R.14 multi-tenant rule | Add |
| 2 | No `public.` schema qualification on `jobs(id)` FK — violates R.21 | Add `public.` everywhere |
| 3 | No `created_at`, `updated_at`, `created_by`, `deleted_at` — violates CLAUDE.md §Architecture Rules + G.2 audit rule | Add full audit-column set |
| 4 | No `updated_at` trigger registration | Register `trg_job_milestones_updated_at` using shared `public.update_updated_at()` |
| 5 | No RLS declared — violates R.14 + CLAUDE.md | Enable RLS; 3-policy shape per §5 (proposals precedent) |
| 6 | No `status_history JSONB NOT NULL DEFAULT '[]'::jsonb` — violates R.7 (status has 4-value lifecycle: pending / in_progress / complete / billed) | Add |
| 7 | No uniqueness on `(job_id, sort_order)` — drift risk if two writers insert with same sort | Partial unique index `WHERE deleted_at IS NULL` (soft-delete-safe, matches 00070 precedent) |
| 8 | `REFERENCES jobs(id)` with no `ON DELETE` clause — jobs aren't hard-deleted (RLS blocks via `jobs_delete_strict`), so NO ACTION is fine, but the application-layer soft-delete cascade (`draws` precedent) should be documented in migration header | Document; do not add DB-level cascade (FK cascades don't fire on UPDATE) |
| 9 | No indexes | `idx_job_milestones_org_job (org_id, job_id) WHERE deleted_at IS NULL`; `idx_job_milestones_status (org_id, status) WHERE deleted_at IS NULL`; optional `idx_job_milestones_target_date (org_id, target_date) WHERE target_date IS NOT NULL AND deleted_at IS NULL` for calendar queries |
| 10 | No `COMMENT ON TABLE` / `COMMENT ON COLUMN` | Add — document R.23 precedent + PM-read narrowing + Ross-Built-vs-other-orgs T&M/milestone-mode usage context |
| 11 | `amount_cents` column is spec'd — matches CLAUDE.md R.8 cents rule ✓ | no change |

### §6.2 `jobs` retainage-column-ALTER gaps

| # | Gap | Recommended resolution |
|---|---|---|
| 12 | `retainage_threshold_percent NUMERIC DEFAULT 50` — no CHECK range | Add `CONSTRAINT chk_jobs_retainage_threshold_percent CHECK (retainage_threshold_percent >= 0 AND retainage_threshold_percent <= 100)` |
| 13 | `retainage_dropoff_percent NUMERIC DEFAULT 5` — no CHECK range | Add `CONSTRAINT chk_jobs_retainage_dropoff_percent CHECK (retainage_dropoff_percent >= 0 AND retainage_dropoff_percent <= 100)` |
| 14 | No `NUMERIC(5,2)` precision like existing `retainage_percent` | Match existing — `NUMERIC(5,2)` |
| 15 | GH #5 duplicate CHECK unresolved | §1.5 recommends Option A — drop `jobs_retainage_percent_check`, keep `chk_jobs_retainage_percent` |
| 16 | No nullability declared — Postgres default is NULL | Match existing `retainage_percent` pattern: `NOT NULL DEFAULT …` |
| 17 | `DEFAULT 50` / `DEFAULT 5` — is this Ross-Built-correct? Plan comment at line 3931 says "drops from 10% to 5% at 50% complete". Numbers match but should be verified against Ross Built's actual policy. Ross Built also runs `default_retainage_percent = 0` for cost-plus (per 00031), so the threshold/dropoff defaults may be dead code for Ross Built's use case. | Flag for Jake — verify with Andrew (finance). Cosmetically, defaults should either match Ross Built reality OR be clearly labeled as "industry default, overridden per-org during onboarding" (GH #12 onboarding-wizard scope) |

### §6.3 `draws` column-ALTER gaps

| # | Gap | Recommended resolution |
|---|---|---|
| 18 | `draw_mode TEXT NOT NULL DEFAULT 'aia' CHECK (draw_mode IN ('aia','milestone','tm'))` — existing 2 live draws backfill to `'aia'` — fine | No change; document in header |
| 19 | `milestone_completions JSONB DEFAULT '[]'::jsonb` — DEFAULT but no NOT NULL | Either set `NOT NULL DEFAULT '[]'::jsonb` OR leave nullable with documented Branch 3/4 writer contract. **Recommend NOT NULL** — matches `status_history` / `proposal` JSONB arrays precedent. |
| 20 | `tm_labor_hours NUMERIC` — hours, not cents → NUMERIC correct per CLAUDE.md R.8 (cents rule applies to money only) — but deserves an explicit carve-out comment | Add `COMMENT ON COLUMN` citing the hours-not-money carve-out |
| 21 | `tm_material_cost BIGINT`, `tm_sub_cost BIGINT`, `tm_markup_amount BIGINT` — all cents ✓ | no change |
| 22 | No cross-column invariant: when `draw_mode='aia'`, `milestone_completions` + `tm_*` should be empty/null. When `draw_mode='milestone'`, `milestone_completions` should be non-empty. When `draw_mode='tm'`, `tm_*` should be populated. | **Recommend application-layer invariant** (Branch 3/4 draw writer) — NOT DB-level CHECK. CHECK constraints spanning 5 columns with conditional logic are maintenance-hostile and the Branch 3 writer is the single source of truth for draw creation anyway. Document in header + `COMMENT ON COLUMN draw_mode`. |
| 23 | `milestone_completions JSONB` — expected shape undocumented | `COMMENT ON COLUMN` citing Branch 3/4 writer contract: expected array of `{milestone_id: uuid, completed_percent: number, notes?: text}` objects — shape finalized in Branch 3 Phase 3.x. |

### §6.4 Non-SQL deliverables (R.15, R.16)

| # | Gap | Recommended resolution |
|---|---|---|
| 24 | No paired `00071_milestones_retainage.down.sql` — violates R.16 | Write; reverse dependency order (drops on draws first, then drops on jobs, then drops job_milestones table + indexes + policies + trigger) |
| 25 | No R.15 test file — violates R.15 | Write `__tests__/milestones-retainage.test.ts` with static assertions matching the draw-adjustments / approval-chains precedent: migration + down.sql exist; header citations; table + column presence; 6 CHECK enums (status + draw_mode); indexes with correct partial predicates; 3 RLS policies on `job_milestones`; no DELETE policy; paired COMMENTs; down-order asserts |
| 26 | No R.19 carve-out audit trail | Both conditions will hold post-execution (zero `src/` references per §3; DB stack exercised via Migration Dry-Run per execution phase) — document in QA report |
| 27 | Amendment F.2 GRANT-verification pattern — applicable? | **Not applicable for Phase 2.7** — no new SECURITY DEFINER functions in scope. Document the inapplicability explicitly so it's not mistaken for an oversight. |

---

## §7 Markgraf / Ross-Built fit check

### §7.1 Milestone-mode draws

Ross Built runs AIA G702/G703 cost-plus draws exclusively (CLAUDE.md §What This Is). `draw_mode='milestone'` is **not a Ross Built pattern**. Phase 2.7 ships the schema for other org types (fixed-price builders, remodelers) whose contracts tie draw amounts to completion of discrete milestones.

**Open question for Jake:** are any of the 15 active jobs expected to run milestone-mode draws? Or is this pure v2.0 / multi-tenant infrastructure? Answer affects the QA report's live-workflow scope during execution.

### §7.2 T&M-mode draws

Ross Built does not currently issue T&M-mode draws (T&M invoices like Florida Sunshine Carpentry land as line items on an AIA draw, not as a separate draw mode). Same question as §7.1 — schema-only forward hook, or active use case?

`jobs.contract_type='time_and_materials'` already exists as a valid enum value (§4.4), so there's precedent for T&M awareness in the schema; Phase 2.7 extends that to the draw level.

### §7.3 Retainage threshold + dropoff

Plan line 3931 comment: *"drops from 10% to 5% at 50% complete"*. Standard AIA retainage policy for new construction.

Ross Built's cost-plus jobs run `retainage_percent = 0.00` (§4.7), so retainage threshold/dropoff is **dead code for Ross Built's current use**. These columns become live when (a) Ross Built onboards a fixed-price job under the new `contract_type='fixed_price'` enum value, or (b) other builders use the platform.

**Open question for Jake:** verify with Andrew (finance director) whether Ross Built has historically used threshold/dropoff retainage on the pre-2020 jobs. If yes, column defaults may need tuning. If no, defaults are fine and the columns are forward-looking.

### §7.4 Milestone lifecycle taxonomy

`status_check IN ('pending','in_progress','complete','billed')` — 4-value lifecycle. Pattern:

- `pending` — not started
- `in_progress` — PM marked started
- `complete` — PM marked done; ready to bill
- `billed` — accounting pulled into a draw

**Terminal state:** `billed`. No re-entry. Matches other Branch 2 lifecycle patterns (proposals / draw_adjustments). No question — taxonomy is coherent.

---

## §8 Recommended amendment list (for Jake to approve)

Proposed amendments; each becomes a one-line entry in the plan-doc amendment block if accepted. Letters mirror the Phase 2.5 / 2.6 pattern.

| ID | Amendment | Scope |
|---|---|---|
| **A** | **Full audit-column set on `job_milestones`** — add `org_id UUID NOT NULL REFERENCES public.organizations(id)`, `created_at / updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `created_by UUID REFERENCES auth.users(id)`, `deleted_at TIMESTAMPTZ`; register `trg_job_milestones_updated_at` using shared `public.update_updated_at()`. Status_history JSONB NOT NULL DEFAULT '[]'::jsonb. Match §6.1 gaps 1, 3, 4, 6. | Table |
| **B** | **RLS on `job_milestones` adopting 00065 proposals 3-policy precedent** — `org_read` (any active org member + platform admin; + optional `draw_adjustments` / 00069-style PM-on-own-jobs narrowing via `EXISTS(SELECT 1 FROM public.jobs j WHERE j.id = job_milestones.job_id AND j.pm_id = auth.uid())` when role='pm'), `org_insert` / `org_update` role IN ('owner','admin','pm','accounting'). No DELETE policy. | Table |
| **C** | **Partial unique index `(org_id, job_id, sort_order) WHERE deleted_at IS NULL`** — soft-delete-safe uniqueness matching 00070 precedent. Plus `idx_job_milestones_org_job`, `idx_job_milestones_status`, optional `idx_job_milestones_target_date`. | Table indexes |
| **D** | **CHECK ranges + NUMERIC(5,2) on the two new `jobs` retainage columns** — `chk_jobs_retainage_threshold_percent` and `chk_jobs_retainage_dropoff_percent`, both `>= 0 AND <= 100`. Match `chk_jobs_retainage_percent` naming convention. Both columns `NUMERIC(5,2) NOT NULL DEFAULT …`. Match §6.2 gaps 12–14, 16. | Jobs ALTER |
| **E** | **GH #5 resolution inside 00071 (OPTION A)** — drop `jobs_retainage_percent_check` (auto-named duplicate), keep `chk_jobs_retainage_percent`. Closes GH #5. See §1.5 rationale. | Jobs ALTER |
| **F** | **`milestone_completions JSONB NOT NULL DEFAULT '[]'::jsonb`** — match `status_history` precedent. `COMMENT ON COLUMN` documents the expected array-of-objects shape + Branch 3/4 writer contract. §6.3 gaps 19, 23. | Draws ALTER |
| **G** | **Draw-mode cross-column invariant documented as application-layer, not DB CHECK** — migration header + `COMMENT ON COLUMN draws.draw_mode` note that Branch 3/4 draw writer is responsible for ensuring `milestone_completions` is only populated when `draw_mode='milestone'` and `tm_*` only when `draw_mode='tm'`. §6.3 gap 22. | Draws ALTER |
| **H** | **`public.` schema qualification throughout + full `COMMENT ON` coverage** — table + key columns on `job_milestones`; `draws.draw_mode` + `milestone_completions` + `tm_labor_hours` (hours-not-money carve-out note per CLAUDE.md R.8); `jobs.retainage_threshold_percent` + `retainage_dropoff_percent`. | All |
| **I** | **Paired `00071_milestones_retainage.down.sql` per R.16** — reverse-dependency drop order: draws columns → jobs new columns + constraint restorations (optional: recreate `jobs_retainage_percent_check` if GH #5 is rolled back too) → `job_milestones` policies → RLS disable → triggers → indexes → table. | R.16 |
| **J** | **R.15 test file `__tests__/milestones-retainage.test.ts`** — static-regex assertions matching the `approval-chains.test.ts` / `draw-adjustments.test.ts` precedent: file existence, header citations (R.23 precedent, GH #5 Option A rationale, PM-read narrowing), column presence, CHECK enum values, index definitions with partial predicates, exactly-3-policy regression fence, no-DELETE policy guard, down.sql reverse-order assertion. Dynamic live-auth probes fire in Migration Dry-Run per R.19 and are recorded in QA report §5. | R.15 |
| **K** | **Amendment F.2 GRANT-verification — NOT APPLICABLE** — no new SECURITY DEFINER functions in Phase 2.7 scope. Document explicitly in migration header so absence is intentional, not oversight. | Scope note |
| **L** | **Branch 3/4 writer contract notes in migration header** — document: (a) milestone soft-delete cascade (when `jobs.deleted_at` is set, all `job_milestones` rows must be soft-deleted in the same txn; application-layer per the 00069 draw-adjustments precedent); (b) `milestone_completions` JSONB shape expectations; (c) `draw_mode` vs. `contract_type` relationship. | Documentation |

**Open questions flagged for Jake before execution:**

1. **GH #5 resolution** — confirm Option A (recommended) vs. B (defer) vs. C (ship new columns only).
2. **Retainage threshold/dropoff defaults (50 / 5)** — verify with Andrew that these reflect Ross Built's historical policy, or label as "industry default, override per-org in onboarding (GH #12)".
3. **Milestone-mode draw usage** — any of the 15 active jobs running milestone draws? Or is this v2.0 schema infrastructure?
4. **T&M-mode draw usage** — same question. Both answers affect live-workflow scope in the QA report.

---

## §9 Delta from Phase 2.6 pre-flight methodology

This pre-flight is structured closer to the **Phase 2.5 fresh-surface template** (`053f647` draw_adjustments pre-flight — 5 scope decisions + precedent selection + open questions) than the **Phase 2.6 re-verification template** (`303d5c9` approval_chains pre-flight — delta check against an already-amended spec). Rationale:

- The Phase 2.7 plan-doc spec at lines 3913–3943 is 30 lines of bare SQL with **zero prior amendments** — no audit columns, no RLS, no down.sql reference, no test file outline.
- Compared to Phase 2.6's spec (240+ lines with 8 pre-baked amendments A–H + an F-ii scope decision), Phase 2.7 is closer to where Phase 2.5 started before its first pre-flight.
- The §6 spec-gap enumeration and §8 amendment list do the thinking up-front so execution-phase isn't surprising. 12 proposed amendments is in line with Phase 2.5's count (10 decisions + 4 late-cycle amendments).

No stance on whether to amend the plan doc directly or keep amendments in this pre-flight + execution-phase QA report — Jake's call. Either approach produces the same migration.
