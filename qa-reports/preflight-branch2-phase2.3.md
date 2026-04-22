# Pre-flight Findings — Branch 2 Phase 2.3: CO type expansion

**Date:** 2026-04-22
**Migration target:** `supabase/migrations/00066_co_type_expansion.sql` (+ `.down.sql`)
**Mode:** PRE-FLIGHT ONLY — no migration written, no SQL applied, no commit, no push.
**Dry-Run:** deferred per Jake's instruction until post-amendment.

---

## §1 Executive summary

Phase 2.3 as written in `docs/nightwork-rebuild-plan.md` lines 2918–2951 is **not safe to execute as-is**. The flag-E sequencing (drop CHECK → UPDATE data → add new CHECK) is correct, but the spec is silent on three load-bearing details that will leave the runtime broken the moment the migration lands.

**Row-count confirmation (matches Jake's "88" estimate):**
- 73 live `co_type = 'owner'` rows, 15 soft-deleted `co_type = 'owner'` rows, 88 total.
- Zero `co_type = 'internal'` rows.
- All 73 live 'owner' rows are `status = 'approved'`, spread across 2 jobs, summing to **$901,045.65** of approved-CO contract adjustment currently cached in `jobs.approved_cos_total`.

**Three must-fix issues for migration 00066:**

1. **`change_orders.co_type` column DEFAULT is `'owner'`** (S2). The moment the new CHECK lands, the default becomes an invalid value. Every INSERT that omits `co_type` (including application code paths and some trigger logic) will hit the new CHECK. The migration must drop the default, run the data UPDATE, then set the new default to `'owner_requested'`.

2. **`app_private.refresh_approved_cos_total` filters `co_type = 'owner'`** (S7). This function fires via `co_cache_trigger` on every `change_orders` mutation and maintains `jobs.approved_cos_total` + `jobs.current_contract_amount`. Post data-migration all 73 live rows become `'owner_requested'`; the filter matches zero. On the next CO mutation to any of the 2 jobs with active COs, their cached contract total drops to $0. **The $901,045.65 cache goes stale silently.** Per the plan's own value-semantics table (lines 1066–1072), the correct filter under the new value set is `co_type != 'internal'` (4 of 5 new types raise contract; only 'internal' does not). Function body must be rewritten in the same migration + a one-time cache backfill against every live job.

3. **7 application-layer filter sites use `co_type === 'owner'` with the same contract-raising semantics** (§2 table). After the data migration they silently stop matching all 73 rows and any future owner_requested/designer_architect/allowance_overage/site_condition rows. Two TypeScript union types (`"owner" | "internal"`) in API routes will fail TS check when new values are sent. The new-CO form's local state is `useState<"owner" | "internal">("owner")` — the UI only offers the old 2 values.

**Recommendation: AMEND PLAN FIRST.** Draft amendment diffs in §6. Execution prompt should not be issued until amendments are committed to the plan doc (mirroring commits `046a164` for Phase 2.1 and `4fd3e7d` for Phase 2.2).

---

## §2 R.18 blast-radius grep

Greps run across `src/`, `supabase/migrations/`, `__tests__/`, `docs/`.

### Identifier summary table

| Identifier | src/ hits | migrations hits | __tests__ hits | docs hits | Verdict |
|---|---|---|---|---|---|
| `co_type` | 12 files, 23 lines | 2 files, 6 lines | 0 | 1 file | Mix of passthrough + hardcoded — see classification table below |
| `'owner'` / `"owner"` (co_type context only) | 9 hardcoded sites across 7 files | 3 sites (00028:129, 00028:502, 00028:569, plus 00042:25 — note 00042 supersedes 00028:502 via CREATE OR REPLACE so only 00042:25 is live) | 0 | 0 | **9 src/ sites + 1 live DB function break post-migration** |
| `'internal'` / `"internal"` (co_type context only) | 3 sites (all in TS union types + UI conditionals paired with 'owner') | 1 (00028:164 inside CHECK) | 0 | 0 | All adjacent to 'owner' sites above; same fix scope |
| `change_orders_co_type_check` | 0 | 2 (00028:163 authoring, plan spec line 2928/2935) | 0 | 0 | Expected; only CHECK-constraint name |
| `pricing_mode` | **35 hits** (all `pricing_model`, NOT `pricing_mode`) — **semantic-collision flag, see below** | 0 on `pricing_mode`; 35 on `pricing_model` (different field, different table) | 0 | 10 hits on `pricing_mode` (plan doc) | **Naming-collision risk — see §2.1** |
| `source_proposal_id` | 0 (Phase 2.2 reported 0; still 0) | 0 | 0 | 5 (plan doc only) | Clean — FK target `proposals` now exists (Phase 2.2 landed) |
| `created_po_id` | 0 | 0 | 0 | 4 (plan doc only) | Clean |
| `owner_requested` | 0 | 0 | 0 | 6 (plan doc only) | Clean — net-new value |
| `designer_architect` | 0 | 0 | 0 | 3 (plan doc only) | Clean |
| `allowance_overage` | 0 | 0 | 0 | 5 (plan doc only) | Clean |
| `site_condition` | 0 | 0 | 0 | 3 (plan doc only) | Clean |
| `hard_priced` | 0 | 0 | 0 | 5 (plan doc only) | Clean |
| `budgetary` | 0 | 0 | 0 | 6 (plan doc only) | Clean |
| `allowance_split` | 0 | 0 | 0 | 8 (plan doc only) | Clean |

### §2.1 Naming collision: `pricing_mode` (new) vs `pricing_model` (existing)

**Flag.** The cost-intelligence subsystem (Phase 11–13, migration 00057) introduced `items.pricing_model` and `invoice_extraction_lines.proposed_pricing_model` with values `'unit' | 'scope'`. Phase 2.3 introduces `change_orders.pricing_mode` with values `'hard_priced' | 'budgetary' | 'allowance_split'`. Different tables, different semantics, similar names. Not a blocker — but worth a one-line comment in the 00066 migration header differentiating them, and worth a note in the Part 2 section 2.1 naming-conventions area if the plan hasn't already called it out.

### §2.2 `co_type` classification — 12 src/ files, 23 lines

**Type A: PASSTHROUGH (reads co_type as string; values untouched; safe post-migration)**

| File | Line | Snippet | Safe? |
|---|---|---|---|
| `src/app/change-orders/[id]/page.tsx` | 23 | `co_type: string;` type decl | ✅ |
| `src/app/jobs/[id]/change-orders/page.tsx` | 35 | `co_type: string;` | ✅ |
| `src/components/draw-change-orders.tsx` | 16 | `co_type: string;` | ✅ |
| `src/app/api/change-orders/[id]/route.ts` | 26 | SELECT column list | ✅ |
| `src/app/api/jobs/[id]/change-orders/route.ts` | 38, 154 | SELECT column list + insert-row builder | ✅ |
| `src/app/api/draws/[id]/change-orders/route.ts` | 37, 46 | SELECT column list | ✅ |

**Type B: HARDCODED `'owner'` FILTER (contract-raising semantic; runtime-breaks post-migration)**

| File | Line | Snippet | Current behavior | Post-migration behavior |
|---|---|---|---|---|
| `src/lib/recalc.ts` | 213 | `.eq("co_type", "owner")` in `recalcJobContract()` | Sums all 73 owner COs | Matches 0 rows; recalc writes `approved_cos_total = 0` |
| `src/lib/draw-calc.ts` | 421 | `.eq("co_type", "owner")` | Includes CO amounts in draw calc | Excludes all 73 COs from draw math |
| `src/app/api/draws/preview/route.ts` | 75 | `.filter(co => co.co_type === "owner")` | Draw preview includes CO rows | Preview excludes them |
| `src/app/api/draws/preview/route.ts` | 201 | same filter, second occurrence | same | same |
| `src/app/api/draws/[id]/compare/route.ts` | 107 | `.filter(co => co.co_type === "owner")` | Draw-vs-snapshot compare | Excludes |
| `src/app/api/admin/integrity-check/route.ts` | 215 | `.eq("co_type", "owner")` | Integrity check counts owner COs | Counts 0 |

**Type C: HARDCODED `'owner'` DEFAULT / UNION (TS- or UX-breaks post-migration)**

| File | Line | Snippet | Break type |
|---|---|---|---|
| `src/app/api/jobs/[id]/change-orders/route.ts` | 16 | `co_type?: "owner" \| "internal"` TS union | TS check fails when form sends new values |
| `src/app/api/jobs/[id]/change-orders/route.ts` | 65 | `const coType = body.co_type ?? "owner";` | Default inserts a now-invalid value → CHECK violation |
| `src/app/api/change-orders/[id]/route.ts` | 55 | `co_type?: "owner" \| "internal"` TS union | TS check fails on PATCH with new values |
| `src/app/jobs/[id]/change-orders/new/page.tsx` | 51, 136 | `useState<"owner" \| "internal">("owner")` + `body.co_type: coType` | UI form only offers 2 old values; cannot create new types |

**Type D: UI DISPLAY HARDCODE (post-migration: correct display degrades, not a functional break)**

| File | Line | Snippet | Impact |
|---|---|---|---|
| `src/app/change-orders/[id]/page.tsx` | 170 | `co.co_type === "owner" ? "Owner Change Order (contract)" : "Internal (budget only)"` | Post-migration, owner_requested/designer_architect/etc. render as "Internal (budget only)" — wrong label |
| `src/app/jobs/[id]/change-orders/page.tsx` | 260 | `co.co_type === "owner" ? <NwBadge variant="info" size="sm">Owner</NwBadge> : <NwBadge variant="muted" size="sm">Internal</NwBadge>` | Same — all new non-internal types badge as "Internal" |

**Type E: MIGRATIONS referencing co_type (advisory, since migrations are historical)**

- `supabase/migrations/00028_phase7_purchase_orders_change_orders.sql:129` — `ADD COLUMN IF NOT EXISTS co_type TEXT NOT NULL DEFAULT 'owner';` (the authoring column add; default is the live default verified in S2)
- `supabase/migrations/00028_phase7_purchase_orders_change_orders.sql:163-164` — the CHECK being dropped in 00066
- `supabase/migrations/00028_phase7_purchase_orders_change_orders.sql:502` — inside `trg_change_orders_status_sync` function body. **Superseded at runtime by 00042's `CREATE OR REPLACE FUNCTION trg_change_orders_status_sync` which removes the co_type filter entirely.** Confirmed via pg_proc sweep (§3 S7): the live function body no longer references co_type. Historical only.
- `supabase/migrations/00028_phase7_purchase_orders_change_orders.sql:569` — inside a one-time DO block backfill that ran at 00028 apply time. Historical only.
- `supabase/migrations/00042_co_cache_trigger.sql:25` — inside `refresh_approved_cos_total`, **live**, and the critical issue in S7 + §1.

---

## §3 Schema Validator findings (S1–S7)

All probes run via Supabase MCP `execute_sql` against dev (read-only, no BEGIN/ROLLBACK needed).

### S1 — current CHECK on `change_orders.co_type`

| Expected | Observed |
|---|---|
| Exactly one row, value set `('owner','internal')` | ✅ Match. `change_orders_co_type_check`: `CHECK ((co_type = ANY (ARRAY['owner'::text, 'internal'::text])))` |

### S2 — current `change_orders.co_type` column metadata

| Expected | Observed |
|---|---|
| TEXT, NOT NULL, DEFAULT `'owner'` | ✅ Match. `co_type text NOT NULL DEFAULT 'owner'::text` |

**⚠ FOOT-GUN confirmed.** The plan spec does not drop/replace this default. Post-CHECK-swap, INSERTs relying on the default violate the new CHECK. **Amendment A (§6) addresses this.**

### S3 — row counts by value (confirms Jake's "88")

| co_type | live rows (`deleted_at IS NULL`) | soft-deleted | total |
|---|---|---|---|
| `owner` | 73 | 15 | 88 |
| `internal` | 0 | 0 | 0 |

| co_type | status | live rows |
|---|---|---|
| `owner` | `approved` | 73 |

All 73 live rows are in status `approved`. Zero rows at `internal` means the `'internal'` value in the CHECK is currently unused but kept for forward-compatibility (matches plan: `'internal'` stays in the new value set).

Blast radius of the `jobs.approved_cos_total` cache issue (see S7):
- 2 distinct jobs have approved owner COs.
- Sum of `total_with_fee` across those 73 rows: **$901,045.65** (90104565 cents).

### S4 — pre-existence checks for columns Phase 2.3 will ADD

| Column | Expected | Observed |
|---|---|---|
| `change_orders.pricing_mode` | absent | ✅ absent |
| `change_orders.source_proposal_id` | absent | ✅ absent |
| `change_orders.reason` | absent | ✅ absent |
| `change_order_lines.created_po_id` | absent | ✅ absent |

Clean — no prior drift.

### S5 — FK target check for `source_proposal_id`

| Expected | Observed |
|---|---|
| `public.proposals` present (landed in 00065, Phase 2.2) | ✅ present |
| `public.purchase_orders` present (FK target for `created_po_id`) | ✅ present |
| `public.change_orders` present | ✅ present |
| `public.change_order_lines` present | ✅ present |

All 4 FK targets exist on dev.

### S6 — RLS posture on `change_orders` and `change_order_lines`

| Table | RLS enabled | Policy count | Commands covered |
|---|---|---|---|
| `change_orders` | ✅ true | 5 | `*` (all) × 2, `r` (SELECT) × 2, `d` (DELETE) × 1 |
| `change_order_lines` | ✅ true | 7 | `*` × 3, `r` × 3, `d` × 1 |

Policies by name:
- `change_orders`: `admin owner accounting write change_orders`, `authenticated read change_orders`, `change_orders_delete_strict`, `change_orders_platform_admin_read`, `org isolation`
- `change_order_lines`: `admin owner accounting write change_order_lines`, `authenticated read change_order_lines`, `change_order_lines_delete_strict`, `change_order_lines_platform_admin_read`, `members read change_order_lines`, `org isolation`, `pm write change_order_lines on own jobs`

Phase 2.3 does NOT need to add or modify any policy — the new columns inherit the row-level posture from the existing policies. R.23 compliance in §4.

### S7 — dependent code paths: pg_proc bodies containing `co_type`

Broad sweep (every function mentioning `co_type`):

| Schema | Function | Contains `co_type` | Contains `'owner'` |
|---|---|---|---|
| `app_private` | `refresh_approved_cos_total(target_job_id uuid)` | YES | YES — **LIVE DEPENDENCY** |
| `app_private` | `co_cache_trigger()` | NO | NO (it PERFORMs `refresh_approved_cos_total`; predicate lives there) |
| `public` | `trg_change_orders_status_sync()` | NO (00042 replaced the 00028 definition and stripped the co_type filter) | NO |
| `public` | `trg_change_order_lines_sync()` | NO | NO |

**Confirmed: exactly one live database-side dependency on `co_type = 'owner'`:**

```
app_private.refresh_approved_cos_total(target_job_id uuid)
-- body excerpt (full body returned by probe):
  SELECT COALESCE(SUM(
    COALESCE(total_with_fee, COALESCE(amount, 0) + COALESCE(gc_fee_amount, 0))
  ), 0)
  INTO co_total
  FROM change_orders
  WHERE job_id = target_job_id
    AND co_type = 'owner'              ← breaks post-migration
    AND status IN ('approved', 'executed')
    AND deleted_at IS NULL;
```

Fired by trigger:
```
co_cache_trigger: AFTER INSERT OR UPDATE OR DELETE ON public.change_orders
                  FOR EACH ROW EXECUTE FUNCTION app_private.co_cache_trigger()
```

On any CO mutation, `co_cache_trigger` calls `refresh_approved_cos_total`, which recomputes with the now-dead filter. `jobs.approved_cos_total` gets set to 0 and `jobs.current_contract_amount` reverts to `original_contract_amount` for the affected job. **Amendment B (§6) addresses this.**

### S7.1 — trigger registration on `change_orders` / `change_order_lines`

| Trigger | Table | Function |
|---|---|---|
| `co_cache_trigger` | `change_orders` | `app_private.co_cache_trigger()` |
| `trg_change_orders_status_sync` | `change_orders` | `public.trg_change_orders_status_sync()` (00042 version, no co_type filter) |
| `trg_change_orders_updated_at` | `change_orders` | `public.update_updated_at()` |
| `trg_change_order_lines_sync` | `change_order_lines` | `public.trg_change_order_lines_sync()` |

No trigger on `change_order_lines.updated_at` visible (likely inherits via base create — not a 2.3 scope item but worth tracking as part of the GH #6 retrofit).

---

## §4 R.23 precedent statement

**Phase 2.3 introduces NO new RLS policies and NO new table conventions.** This is an ALTER on two existing tables (`change_orders`, `change_order_lines`) that already have full RLS posture and policy sets (S6). Added columns inherit row-level posture from existing policies. Added CHECK constraints are value-set expansions, not structural changes.

R.23 compliance statement for the QA report post-execution:
> Phase 2.3 does not introduce new RLS policies, new table conventions, or any pattern inconsistent with codebase precedent. Existing policies on `change_orders` and `change_order_lines` cover the new columns by inheritance. No precedent check required beyond this statement.

One process note: R.23 is about "adding" RLS/conventions. The adjacent concern here — modifying an existing DB trigger function body (`refresh_approved_cos_total`) — is not R.23's domain. It's an implementation-correctness concern that Amendment B addresses on its own terms.

---

## §5 Migration Dry-Run

**Deferred per Jake's instruction.** Will run post-amendment against the amended migration SQL, inside BEGIN/ROLLBACK on dev, once §6 amendments are approved and the migration is drafted.

---

## §6 Proposed plan amendments

Five amendments. A–C are correctness-blocking must-land-in-Phase-2.3. D is a Branch 2 discipline (R.15) gap. E is an R.16 gap.

### Amendment A — Fix `change_orders.co_type` DEFAULT

**Current plan spec (lines 2926–2936):**
```sql
-- (a) Drop old CHECK so in-flight 'owner' rows can be rewritten
ALTER TABLE change_orders
  DROP CONSTRAINT change_orders_co_type_check;

-- (b) Migrate data: 'owner' → 'owner_requested'; 'internal' stays
UPDATE change_orders SET co_type = 'owner_requested' WHERE co_type = 'owner';

-- (c) Install new CHECK over the fully migrated data set
ALTER TABLE change_orders
  ADD CONSTRAINT change_orders_co_type_check
    CHECK (co_type IN ('owner_requested','designer_architect','allowance_overage','site_condition','internal'));
```

**Proposed amendment (inserts DROP DEFAULT before step (b) and SET DEFAULT between steps (b) and (c)):**
```sql
-- (a) Drop old CHECK so in-flight 'owner' rows can be rewritten
ALTER TABLE public.change_orders
  DROP CONSTRAINT change_orders_co_type_check;

-- (a.1) Drop the stale default. The current default 'owner' is about to
-- become an invalid value against the new CHECK. Dropping it here prevents
-- any concurrent transaction from using it between (a) and (c).
ALTER TABLE public.change_orders
  ALTER COLUMN co_type DROP DEFAULT;

-- (b) Migrate data: 'owner' → 'owner_requested'; 'internal' stays
UPDATE public.change_orders
  SET co_type = 'owner_requested'
  WHERE co_type = 'owner';

-- (b.1) Restore a sensible default under the new value set. 'owner_requested'
-- preserves the semantic intent of the old default (owner-initiated CO is
-- the common case).
ALTER TABLE public.change_orders
  ALTER COLUMN co_type SET DEFAULT 'owner_requested';

-- (c) Install new CHECK over the fully migrated data set
ALTER TABLE public.change_orders
  ADD CONSTRAINT change_orders_co_type_check
    CHECK (co_type IN ('owner_requested','designer_architect','allowance_overage','site_condition','internal'));
```

Also: add `public.` schema qualification on every DDL line (per Phase 2.2's G.9 precedent established in commit 7b8799b).

### Amendment B — Rewrite `app_private.refresh_approved_cos_total` predicate + backfill cache

Insert after the column-ADD block (after plan spec line 2948, after `created_po_id` ADD):

```sql
-- ============================================================
-- 00066-B: Update contract-raising predicate in the CO cache trigger.
-- ============================================================
-- Before this phase, the filter `co_type = 'owner'` isolated contract-
-- raising COs from 'internal' budget reallocations. Under the expanded
-- value set, 4 of 5 types raise contract; only 'internal' does not
-- (plan doc §1066–1072). Switch to the complement.
--
-- Without this, the 73 rows just migrated from 'owner' to 'owner_requested'
-- stop matching the filter. On the next mutation of any CO on their 2
-- affected jobs, co_cache_trigger sets approved_cos_total = 0, silently
-- zeroing $901,045.65 of cached contract adjustment.
CREATE OR REPLACE FUNCTION app_private.refresh_approved_cos_total(target_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  co_total bigint;
BEGIN
  SELECT COALESCE(SUM(
    COALESCE(total_with_fee, COALESCE(amount, 0) + COALESCE(gc_fee_amount, 0))
  ), 0)
  INTO co_total
  FROM public.change_orders
  WHERE job_id = target_job_id
    AND co_type <> 'internal'
    AND status IN ('approved', 'executed')
    AND deleted_at IS NULL;

  UPDATE public.jobs
  SET approved_cos_total = co_total,
      current_contract_amount = COALESCE(original_contract_amount, 0) + co_total
  WHERE id = target_job_id;
END;
$$;

COMMENT ON FUNCTION app_private.refresh_approved_cos_total IS
'Recomputes jobs.approved_cos_total and current_contract_amount for a given job based on current change_orders state. Filter co_type <> ''internal'' excludes internal budget reallocations (which do not raise the contract) while including all 4 contract-raising types. Updated in 00066 from co_type = ''owner''.';

-- One-time backfill: re-run against every live job so approved_cos_total
-- reflects the new predicate immediately, not waiting on the next mutation.
-- Mirrors the 00042 post-install backfill pattern.
DO $$
DECLARE j RECORD;
BEGIN
  FOR j IN SELECT id FROM public.jobs WHERE deleted_at IS NULL LOOP
    PERFORM app_private.refresh_approved_cos_total(j.id);
  END LOOP;
END $$;
```

### Amendment C — Scope expansion: 7 application-layer filter sites + 2 TS unions + 1 DEFAULT + 1 form state

**Decision for Jake:** include in Phase 2.3 commit (C.1) OR split into companion Phase 2.3b (C.2)?

Precedent for C.1: Phase 2.1 expanded its scope mid-pre-flight to cover API validator + TS types (commit `046a164`) because schema-without-code would have left writes broken. Same shape applies here.

**Recommendation: C.1 (include in Phase 2.3 commit).** The alternative — shipping the migration alone — leaves the runtime measurably broken on dev until C.2 ships (cache goes stale on next CO mutation, draw math excludes all 73 rows, draw preview/compare excludes them, new CO creation defaults to a now-invalid value, form can't create new types).

**Under C.1, files in scope (append to Phase 2.3 commit):**

**Filter updates** (`.eq("co_type", "owner")` → `.neq("co_type", "internal")`; `co.co_type === "owner"` → `co.co_type !== "internal"`):
- `src/lib/recalc.ts:213`
- `src/lib/draw-calc.ts:421`
- `src/app/api/draws/preview/route.ts:75, 201` (2 occurrences)
- `src/app/api/draws/[id]/compare/route.ts:107`
- `src/app/api/admin/integrity-check/route.ts:215`

**Default value update** (`?? "owner"` → `?? "owner_requested"`):
- `src/app/api/jobs/[id]/change-orders/route.ts:65`

**TS union widening** (`"owner" | "internal"` → full 5-value union or `string` — decide based on route contract):
- `src/app/api/jobs/[id]/change-orders/route.ts:16`
- `src/app/api/change-orders/[id]/route.ts:55`

**Form state widening** (UI form that currently only offers 2 values):
- `src/app/jobs/[id]/change-orders/new/page.tsx:51` (`useState<"owner" | "internal">("owner")` → widen to full 5-value union, add UI picker for all 5)

**Explicitly deferred to a Branch 4-class GH issue (mirroring Phase 2.1's UI label deferral):**
- `src/app/change-orders/[id]/page.tsx:170` — display label (currently says "Owner Change Order (contract)" or "Internal (budget only)")
- `src/app/jobs/[id]/change-orders/page.tsx:260` — display badge (currently "Owner" or "Internal" badges)

These two surfaces do degrade post-migration (every non-internal new type renders as "Internal"), but the surface is display-only and the raw-string fallback pattern from Phase 2.1 applies. Open a new GH issue at the time Amendment C lands.

### Amendment D — R.15 test coverage

Phase 2.3 plan spec does not mention a test file. R.15 requires baseline-FAIL tests authored before the migration, going PASS after. Add to Phase 2.3 spec:

- `__tests__/co-type-expansion.test.ts`, covering:
  - Migration 00066 file exists and applies idempotently
  - New CHECK enforces 5-value set (4 negative probes for each non-value)
  - All 4 new columns + `change_order_lines.created_po_id` exist with the expected types/defaults/FKs
  - Data migration completeness: zero rows with `co_type = 'owner'` post-apply; 73 + 15 rows with `co_type = 'owner_requested'`
  - `app_private.refresh_approved_cos_total` function body contains `co_type <> 'internal'` (not `= 'owner'`)
  - Post-apply probe: run the function for each of the 2 jobs with COs, verify `jobs.approved_cos_total` matches the pre-migration 90104565 cents (or falls out of the 'owner_requested' rows; either way, not 0)
  - Regression test for the default: INSERT into change_orders without specifying `co_type`, verify row lands with `co_type = 'owner_requested'` and passes the new CHECK

### Amendment E — `.down.sql` companion (R.16)

Plan spec doesn't mention a down file. Add to Phase 2.3 spec a companion `00066_co_type_expansion.down.sql`:

```sql
-- Reverse 00066 in strict reverse-dependency order.

-- Restore old refresh_approved_cos_total predicate
CREATE OR REPLACE FUNCTION app_private.refresh_approved_cos_total(target_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  co_total bigint;
BEGIN
  SELECT COALESCE(SUM(
    COALESCE(total_with_fee, COALESCE(amount, 0) + COALESCE(gc_fee_amount, 0))
  ), 0)
  INTO co_total
  FROM public.change_orders
  WHERE job_id = target_job_id
    AND co_type = 'owner'
    AND status IN ('approved', 'executed')
    AND deleted_at IS NULL;

  UPDATE public.jobs
  SET approved_cos_total = co_total,
      current_contract_amount = COALESCE(original_contract_amount, 0) + co_total
  WHERE id = target_job_id;
END;
$$;

-- Drop the added columns (reverse order of ADD)
ALTER TABLE public.change_order_lines DROP COLUMN IF EXISTS created_po_id;
ALTER TABLE public.change_orders DROP COLUMN IF EXISTS reason;
ALTER TABLE public.change_orders DROP COLUMN IF EXISTS source_proposal_id;
ALTER TABLE public.change_orders DROP COLUMN IF EXISTS pricing_mode;

-- Reverse-map data. Acknowledges: designer_architect / allowance_overage /
-- site_condition rows will violate the restored 2-value CHECK below. This
-- mirrors Phase 2.1's down.sql precedent — the down intentionally LOUDLY
-- fails if post-migration rows use values outside the legacy set, so you
-- can't silently roll back through a data-loss window.
ALTER TABLE public.change_orders DROP CONSTRAINT change_orders_co_type_check;
ALTER TABLE public.change_orders ALTER COLUMN co_type DROP DEFAULT;
UPDATE public.change_orders SET co_type = 'owner' WHERE co_type = 'owner_requested';
ALTER TABLE public.change_orders ALTER COLUMN co_type SET DEFAULT 'owner';
ALTER TABLE public.change_orders
  ADD CONSTRAINT change_orders_co_type_check CHECK (co_type IN ('owner','internal'));

-- Re-run cache backfill under old predicate
DO $$
DECLARE j RECORD;
BEGIN
  FOR j IN SELECT id FROM public.jobs WHERE deleted_at IS NULL LOOP
    PERFORM app_private.refresh_approved_cos_total(j.id);
  END LOOP;
END $$;
```

---

## §7 Recommended next step

**AMEND PLAN FIRST — draft diffs in §6, await Jake approval.**

Suggested sequence:

1. Jake reviews §6 amendments A–E. Accepts / rejects / modifies each.
2. A new commit `docs(plan): Phase 2.3 pre-flight amendments — co_type default, cache trigger predicate, scope expansion, R.15 test, down.sql` lands on main, amending `docs/nightwork-rebuild-plan.md` Phase 2.3 section and (if warranted) adding a one-line note under Part 2 section 2.1 about the `pricing_mode` vs `pricing_model` naming collision.
3. Jake issues the Phase 2.3 execution prompt. Claude Code runs Migration Dry-Run against the amended migration SQL (BEGIN/ROLLBACK on dev, structural + negative + positive probes per Phase 2.2's §5 structure), then writes the migration + code changes + test file, applies, commits, pushes, produces `qa-reports/qa-branch2-phase2.3.md`.

**Scope additions surfaced in pre-flight (beyond Jake's original kickoff identifier list):**

- `pricing_model` (not `pricing_mode`) — collision flag worth a naming-convention note. Not a blocker.
- Application-layer filter sites (7 in Type B + 4 in Type C = 11 sites total outside DB) — not in the original plan spec but correctness-blocking if migration ships alone.
- `__tests__/` — no existing coverage for co_type; R.15 requires tests, so Phase 2.3 must author the first test file.

**Do-not list:**
- Do not write `00066_co_type_expansion.sql` until §6 amendments A–E are accepted.
- Do not run Migration Dry-Run until the amended migration is drafted.
- Do not touch application-layer code until the Amendment C in/out decision is locked (C.1 vs C.2).
- Do not push. Do not commit.

---

**Tracked open issues check:** None of GH #1–#6 directly overlap Phase 2.3 scope. GH #6 (line-item audit-column retrofit deferred to Branch 8) is adjacent — `change_order_lines` is one of the tables it tracks — but the retrofit itself is not a Phase 2.3 concern.
