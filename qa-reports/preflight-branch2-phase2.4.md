# Pre-flight Findings — Branch 2 Phase 2.4: Cost codes hierarchy + starter templates

**Date:** 2026-04-22
**Migration target:** `supabase/migrations/00068_cost_codes_hierarchy.sql` (+ `.down.sql`)
**Origin HEAD at kickoff:** `ddf4063` (plan renumber landed; 00067 grant fix already on dev)
**Mode:** PRE-FLIGHT ONLY — no migration written, no SQL applied, no Dry-Run, no commit.
**Dry-Run:** deferred per R.20 + user prompt until post-amendment decisions.

---

## §1 Executive summary

**Verdict: AMEND PLAN FIRST.** The Phase 2.4 spec at `docs/nightwork-rebuild-plan.md:3099–3128` is a 25-line skeleton that will **not** execute safely as-is against the live dev state (238 cost_codes rows across 2 orgs, 14 FK inbound, Ross Built's org currently doubling as the template source via `TEMPLATE_ORG_ID` at `src/app/api/cost-codes/template/route.ts:12`).

**Top 3 flags** (detailed list in §5):

1. **`cost_code_templates` has no R.23 RLS / no org_id / no audit columns — precedent exists but wasn't applied.** The plan's `CREATE TABLE cost_code_templates (…)` omits row-level security policies entirely, has only `created_at` from the audit set, and doesn't decide tenant vs. global. A clean precedent exists: `unit_conversion_templates` (Branch 1 / 00054, no org_id, 2-policy RLS: `authenticated SELECT` + `platform_admin ALL`). Adopting that pattern is the R.23 default. Without it the migration lands with RLS-off on a new public table.

2. **Seed `INSERT INTO cost_code_templates` has no conflict guard — re-running the migration (or adding the same template in a later migration) duplicates rows.** The plan seeds 4 templates with `VALUES ('Custom Home Builder …', …), …` directly and no `ON CONFLICT DO NOTHING` or `WHERE NOT EXISTS` predicate. There's no UNIQUE constraint on `name` either, and `id` defaults to `gen_random_uuid()`. Two migration applies → 8 rows with 4 distinct names. Even on the happy path (one apply, no re-run), if Phase 7.5's onboarding wizard later inserts user-custom templates before the next Branch-2 migration, re-applying 00068 on a fresh clone would still produce dupes.

3. **Existing `TEMPLATE_ORG_ID` pattern is unsilenced.** Today, starter templates = "clone from Ross Built's 218 cost_codes rows at org `00000000-…-001`" via `src/app/api/cost-codes/template/route.ts`. The plan introduces `cost_code_templates.codes JSONB` to hold template data, but the seed bodies are placeholders (`'{...}'`) and the plan says "JSONB seed data for starter templates is separate script." So after the migration lands, `cost_code_templates` exists with 4 empty-JSONB rows, the old template route still reads from Ross Built, and there's no wiring between them until Phase 7.5. That is a real valid decoupling — but it needs to be called out as such in the plan, along with an explicit statement that Phase 7.5 owns the data population + API rewrite.

Additional flags in §5 cover existing-row parent_id migration (silent), cycle-prevention CHECK (absent), depth cap (silent vs. Part 2 §1.3's "up to 3 tiers"), and the `is_allowance` name collision with the existing `budget_lines.is_allowance` column.

**Recommendation:** amend plan spec in a commit before execution, mirroring the Phase 2.2 (`4fd3e7d`) and Phase 2.3 (`c6b468d`) precedents. Draft amendments land in §5 below as A–F.

---

## §2 R.18 blast-radius grep

Greps across `src/`, `supabase/migrations/`, `__tests__/`, `docs/`.

### Identifier summary

| Identifier | src/ hits | migrations | __tests__ | docs | Verdict |
|---|---|---|---|---|---|
| `cost_codes` (table refs) | 46 files, mostly SELECT-join passthrough; 5 admin routes under `src/app/api/cost-codes/` | 00001, 00009 RLS, 00014 allowance, 00045 created_by, 00060 status enum (no hit) | 1 file (`__tests__/proposals-schema.test.ts:352` — FK check), 2 files (`created-by-populated.test.ts`) | plan + QA reports | Central table, 14 inbound FKs (§3 C6). Column-adds will not break reads; watch for breaks on bulk INSERT routes (`import`, `bulk`) if new columns become NOT NULL without default. |
| `cost_code_id` | 54 files | several | included above | plan | Passthrough. Not affected by Phase 2.4. |
| `parent_id` (in cost_codes context) | 0 | 0 | 0 | plan only (2 hits — new column spec) | Clean net-new. |
| `depth`, `path` (cost-codes context) | 0 (only generic "depth" strings) | 0 | 0 | 0 | Clean. Plan uses adjacency list only; no path/depth columns proposed. |
| `is_allowance` | **Extensive on `budget_lines`** — 54 files read/write this column | 00014 (original on budget_lines), 00065 proposals (FK target check) | 0 | plan (in both `budget_lines` and new `cost_codes` sections) | **Name collision — see §5 flag D.** Adding `is_allowance` to `cost_codes` doesn't conflict at the DB level (different tables) but creates two columns with the same name and same semantic *default*; downstream code will need clarity about which layer is authoritative. |
| `default_allowance_amount` | 0 | 0 | 0 | plan only | Clean net-new. |
| `cost_code_templates` | 0 | 0 | 0 | plan only (3 hits) | Clean net-new. |
| `is_system`, `is_template` | 0 | 0 | 0 | plan | Clean net-new. |
| `TEMPLATE_ORG_ID` | **1 file — `src/app/api/cost-codes/template/route.ts:12`** | 0 | 0 | CLAUDE.md Part 2 §1.3, plan | **Exists as a live pattern.** See §5 flag C. |

### §2.1 Classification

**Type A: PASSTHROUGH** (reads `cost_codes` via FK join, unaffected by Phase 2.4 column adds):

- All 46 `src/` references to `cost_codes` that SELECT via `cost_codes:cost_code_id(code, description, …)`-style embedded joins. Adding `parent_id`, `is_allowance`, `default_allowance_amount` as nullable/default-able columns is transparent to these callers.

**Type B: WRITE PATHS — verify on Migration Dry-Run:**

- `src/app/api/cost-codes/route.ts` (POST — creates a cost code)
- `src/app/api/cost-codes/[id]/route.ts` (PATCH / soft-delete)
- `src/app/api/cost-codes/bulk/route.ts` (bulk insert)
- `src/app/api/cost-codes/import/route.ts` (CSV import)
- `src/app/api/cost-codes/template/route.ts` (template clone; POST inserts rows into caller's org)

For all 5: the plan's new columns (`parent_id` UUID NULL, `is_allowance` BOOL NOT NULL DEFAULT false, `default_allowance_amount` BIGINT NULL) should be transparent — existing INSERTs that omit the new columns get the defaults. Confirm during Dry-Run.

**Type C: TEMPLATE PATTERN:**

- `src/app/api/cost-codes/template/route.ts` — the legacy "clone Ross Built's cost_codes into your org" flow. Phase 2.4 creates a new `cost_code_templates` table but does NOT modify this route. Phase 7.5 rewires it. Plan should say so explicitly (§5 flag C).

**Type D: NO TYPE-D DEGRADATIONS** — no UI label maps or enum-switches to worry about; adding columns is additive.

---

## §3 Schema Validator findings (C1–C7)

### C1 — current `cost_codes` columns

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | NO | `uuid_generate_v4()` | PK |
| code | text | NO | — | |
| description | text | NO | — | Part 2 §1.3 calls this `name` but live schema uses `description`. Not a Phase 2.4 concern; flagging for future alignment. |
| category | text | YES | — | De-facto tier-1 grouping ("Planning", "Site Work", …). Existing soft hierarchy hint. |
| sort_order | integer | NO | 0 | |
| org_id | uuid | NO | — | FK to organizations |
| created_at | timestamptz | NO | `now()` | |
| updated_at | timestamptz | NO | `now()` | |
| deleted_at | timestamptz | YES | — | |
| is_change_order | boolean | NO | false | From 00002. |
| created_by | uuid | YES | — | From 00045 (Phase 1.4). |

Architecture columns (R.13 / CLAUDE.md §Architecture Rules): ✅ all present. No `status_history` — N/A (cost_codes is a catalog, not a workflow entity).

### C2 — CHECK constraints + indexes

**Constraints:** PK + 2 FKs (org_id → organizations, created_by → auth.users). **No CHECK constraints.**

**Indexes:**
- `cost_codes_pkey` (PK on id)
- `idx_cost_codes_code_org` — **UNIQUE** on `(code, org_id) WHERE deleted_at IS NULL`
- `idx_cost_codes_org_id` — btree

### C3 — row counts by org

| org_id | live rows |
|---|---|
| `00000000-0000-0000-0000-000000000001` (Ross Built) | **218** |
| `c0a42420-509d-4d2c-b789-0d6e3ce17519` (second tenant) | **20** |
| **Total live** | **238** |

### C4 — code-naming pattern + hierarchy hints

Sample (first 25 rows, Ross Built):
```
01101 Architectural Services                  | Planning
01102 Design Services Drafting                | Planning
01103 Design Services Design Travel Shop      | Planning
01104 Pre-Permitting Planning Services        | Planning
01105 Development and Permitting Services     | Planning
01106 Engineering Services                    | Planning
01107 Engineered Drainage Plan                | Planning
02101 NOC                                      | Planning
02102 Silt Fence Permit                       | Planning
02103 Development and ROW Permit              | Planning
02104 Building Permit                         | Planning
…
03109  Silt Fence and Temporary Fencing       | Site Work
03109C Silt Fence and Temporary Fencing CO    | Site Work
03112 Debris Removal                          | Site Work
```

**Observations:**
- Codes are **5-digit flat strings** (`01101`, `02101`, `03112`). First two digits align roughly with CSI-ish division grouping (`01*` planning/arch, `02*` permits, `03*` sitework) but with Ross-Built-specific numbering, **not** MasterFormat.
- **No dash-delimiter structure** like `03-200-100`. The "up to 3 tiers" in Part 2 §1.3 is aspirational/future — the live data is flat.
- **Category column encodes a soft tier-1 grouping** ("Planning", "Site Work", …) — not via `parent_id`.
- **Suffix convention:** `03109C` (trailing `C` = change-order variant). Suffix characters appear in the data, so the `code` column already stores non-numeric characters; no new CHECK is needed for that reason, but any regex validation should not exclude letters.

**Implication for migration:** all 238 existing rows should default to `parent_id = NULL` (root level). Plan should make this explicit so it's not an unexamined consequence. See §5 flag A.

### C5 — RLS on `cost_codes`

5 policies:
| Policy | Cmd | Predicate |
|---|---|---|
| `admin owner write cost_codes` | ALL | `user_role() IN ('admin','owner')` |
| `authenticated read cost_codes` | SELECT | `org_id = user_org_id() OR org_id = '00000000-…-001'::uuid` |
| `cost_codes_delete_strict` | DELETE | `org_id = user_org_id()` |
| `cost_codes_platform_admin_read` | SELECT | `is_platform_admin()` |
| `org isolation` | ALL | `(org_id = user_org_id() OR is_platform_admin())`, with_check `org_id = user_org_id()` |

Pre-R.23 / pre-cost_intelligence_spine pattern (5 policies, separate `FOR DELETE`). Phase 2.4 does **not** need to add policies for the new columns — they inherit. **But** phase 2.4 does need to **decide the RLS posture for the new `cost_code_templates` table** (§5 flag B).

Note: the `authenticated read` policy includes a hard-coded carve-out for `org_id = '00000000-0000-0000-0000-000000000001'` — Ross Built's own codes are readable by every authenticated user in any org. That's the TEMPLATE_ORG_ID mechanism. §5 flag C.

### C6 — FKs pointing TO `cost_codes` (inbound blast radius)

**14 inbound FKs** across 13 tables:

```
vendors.default_cost_code_id
budget_lines.cost_code_id
purchase_orders.cost_code_id
invoices.cost_code_id
invoice_line_items.cost_code_id
invoice_line_items.ai_suggested_cost_code_id
internal_billing_types.default_cost_code_id  (ON DELETE SET NULL)
internal_billings.cost_code_id               (ON DELETE SET NULL)
invoice_allocations.cost_code_id             (ON DELETE RESTRICT)
parser_corrections.cost_code_id
items.default_cost_code_id
vendor_item_pricing.cost_code_id
job_item_activity.cost_code_id
proposal_line_items.cost_code_id              ← new, landed in 00065
```

Phase 2.4 adds 1 new self-referencing FK (`cost_codes.parent_id → cost_codes.id`). That brings the inbound count to 15. **No changes needed on the other 14 tables.** Adjacency-list self-ref is the standard shape; no structural concern.

### C7 — triggers

One trigger: `trg_cost_codes_updated_at` (`BEFORE UPDATE … EXECUTE FUNCTION update_updated_at()`). Standard. Phase 2.4 doesn't need to add or modify triggers on `cost_codes`. `cost_code_templates` will need its own `trg_cost_code_templates_updated_at` **if** Amendment B lands with an `updated_at` column (§5 flag B).

---

## §4 Architecture-rules compliance

CLAUDE.md §Architecture Rules require every record to carry `id, created_at, updated_at, created_by, org_id, deleted_at`. Status-history is required only for workflow entities.

| Table | id | created_at | updated_at | created_by | org_id | deleted_at | Verdict |
|---|---|---|---|---|---|---|---|
| `cost_codes` (existing) | ✅ | ✅ | ✅ | ✅ (00045) | ✅ | ✅ | Fully compliant. |
| `cost_code_templates` (Phase 2.4 plan spec as written) | ✅ | ✅ | ❌ | ❌ | ❌ (intentional? — no per-org template storage in plan) | ❌ | **Diverges.** See §5 flag B. |

**Precedent match:** `unit_conversion_templates` (landed Phase 11–13 / 00054) is the closest system-template precedent and also uses a minimal audit set (id, created_at only) + **no org_id**. Under R.23, that's a defensible match for "system-level templates not tied to an org." But Phase 2.4 should be explicit about the intent: the plan currently leaves it ambiguous.

---

## §5 Plan-drift flags — proposed amendments

Six amendments. A–C are correctness-blocking for a clean ship. D is a naming hygiene flag. E is defense-in-depth. F is scope documentation.

### Amendment A — Spec the existing-rows migration + cycle/depth posture

**Current plan spec** (line 3103–3106):
```sql
ALTER TABLE cost_codes
  ADD COLUMN parent_id UUID REFERENCES cost_codes(id),
  ADD COLUMN is_allowance BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN default_allowance_amount BIGINT;
```

**Silent questions:**
- All 238 existing rows default to `parent_id = NULL` (= root). Is that intent? Plan should say so.
- Part 2 §1.3 caps hierarchy at **3 tiers**. Plan has no CHECK or trigger enforcing that. Adjacency-list depth is trivially unbounded without enforcement.
- No cycle-prevention. A parent-points-to-descendant cycle breaks recursive-CTE reads + makes delete cascades unsafe.

**Proposed amendment** (append to the ALTER block):

```sql
-- Existing 238 cost_codes rows (Ross Built 218, second tenant 20) all
-- default to parent_id = NULL (i.e., root-level). No backfill attempts to
-- synthesize hierarchy from the existing `category` column — that stays a
-- display-only grouping. Orgs that want deeper hierarchy build it via the
-- settings UI (Branch 7 / Phase 7.5).

-- Depth cap: Part 2 §1.3 says "up to 3 tiers." Enforce with a BEFORE
-- INSERT/UPDATE trigger that walks parent_id up to 3 levels; reject on
-- depth > 3 or on cycles. Pure SQL check + trigger function in
-- app_private (mirrors the co_cache_trigger placement; 00067 grants
-- already let authenticated fire it).

CREATE OR REPLACE FUNCTION app_private.validate_cost_code_hierarchy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  _depth int := 1;
  _cur uuid := NEW.parent_id;
BEGIN
  WHILE _cur IS NOT NULL LOOP
    IF _cur = NEW.id THEN
      RAISE EXCEPTION 'cost_codes hierarchy cycle: % → … → %', NEW.id, _cur;
    END IF;
    _depth := _depth + 1;
    IF _depth > 3 THEN
      RAISE EXCEPTION 'cost_codes hierarchy exceeds 3 tiers (parent chain depth %)', _depth;
    END IF;
    SELECT parent_id INTO _cur FROM public.cost_codes WHERE id = _cur;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cost_codes_hierarchy
BEFORE INSERT OR UPDATE OF parent_id ON public.cost_codes
FOR EACH ROW EXECUTE FUNCTION app_private.validate_cost_code_hierarchy();

GRANT EXECUTE ON FUNCTION app_private.validate_cost_code_hierarchy()
  TO authenticated;
```

Adds one trigger + function. No data backfill (NULL parent_id is correct for all 238 rows). The explicit `GRANT EXECUTE` mirrors migration 00067 so UI-driven INSERTs work under the authenticated role.

### Amendment B — Adopt the `unit_conversion_templates` RLS + audit precedent for `cost_code_templates`

**Current plan spec** (lines 3109–3116):
```sql
CREATE TABLE cost_code_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  codes JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Gaps:** no RLS, no `updated_at` trigger, no UNIQUE (name), no schema qualification (G.9 convention from commit 7b8799b).

**Proposed amendment:**

```sql
CREATE TABLE public.cost_code_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  codes JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)  -- idempotent seeding + onboarding wizard lookup key
);

CREATE TRIGGER trg_cost_code_templates_updated_at
BEFORE UPDATE ON public.cost_code_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.cost_code_templates ENABLE ROW LEVEL SECURITY;

-- Match unit_conversion_templates (00054) precedent — R.23.
CREATE POLICY cct_read ON public.cost_code_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY cct_platform_admin_write ON public.cost_code_templates
  FOR ALL USING (app_private.is_platform_admin())
  WITH CHECK (app_private.is_platform_admin());
```

Notes:
- No `org_id` — this is a system-level catalog (like unit_conversion_templates). If future requirements surface (user-custom templates per org), add `org_id NULLABLE` + a 3rd policy at that time.
- `is_system` column kept from plan spec; under the above policies it's declarative metadata (the RLS enforces the actual rule: only platform admins write).
- No `created_by` / `deleted_at` — match unit_conversion_templates precedent. Flag accepted divergence from CLAUDE.md's per-row audit rule under R.23 (precedent over convention).

### Amendment C — Make the seed idempotent + document the TEMPLATE_ORG_ID cutover

**Current plan spec** (lines 3118–3123):
```sql
INSERT INTO cost_code_templates (name, description, is_system, codes) VALUES
  ('Custom Home Builder (Simplified)', '…', TRUE, '{...}'),
  ('Remodeler (Simplified)', '…', TRUE, '{...}'),
  ('CSI MasterFormat (Full)', '…', TRUE, '{...}'),
  ('Empty — build your own', 'Start fresh', TRUE, '{}');
```

**Proposed amendment:**

```sql
-- Idempotent seed. UNIQUE (name) from Amendment B makes ON CONFLICT viable.
-- codes = '{}'::jsonb is an empty-template placeholder; real seed data
-- lands in Phase 7.5 or via a follow-up data script (plan already flags
-- "JSONB seed data … is separate script").
INSERT INTO public.cost_code_templates (name, description, is_system, codes) VALUES
  ('Custom Home Builder (Simplified)', 'A 25-code list for custom builders', TRUE, '{}'::jsonb),
  ('Remodeler (Simplified)',           'A 20-code list for renovation',     TRUE, '{}'::jsonb),
  ('CSI MasterFormat (Full)',          'All 50 divisions, ~200 codes',      TRUE, '{}'::jsonb),
  ('Empty — build your own',           'Start fresh',                       TRUE, '{}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Migration header note: this migration creates the cost_code_templates
-- table but does NOT populate `codes` with real data, and does NOT
-- modify src/app/api/cost-codes/template/route.ts (which still reads
-- Ross Built's live cost_codes rows via TEMPLATE_ORG_ID). The cutover —
-- populate `codes` JSONB from Ross Built + rewrite the template route
-- to read from cost_code_templates + deprecate the TEMPLATE_ORG_ID
-- read-bypass in the cost_codes RLS policy — lands in Phase 7.5.
```

### Amendment D — Name-collision hygiene for `is_allowance`

Adding `cost_codes.is_allowance` duplicates a column name already used heavily on `budget_lines` (migration 00014, referenced in 30+ src files incl. `src/app/invoices/[id]/page.tsx`, `src/app/jobs/[id]/budget/page.tsx`, `src/app/api/budget-lines/route.ts`). Both columns are BOOLEAN, semantically related (cost-code-level *default* flag → budget-line-level *override* / effective flag). Not a bug, but the plan's migration header should call it out so future devs know which layer is authoritative:

**Proposed header note:**

```
-- Naming note: cost_codes.is_allowance is the template-level flag
-- (does this cost code represent an allowance by default?).
-- budget_lines.is_allowance (migration 00014) is the instance-level
-- flag (is this specific budget line tracked as an allowance?). The
-- budget_line value takes precedence at the job level; the cost_code
-- value is the default the budget-line picker pre-populates with.
-- Current live data: 0 budget_lines.is_allowance=true rows — feature
-- exists in code, no data yet.
```

### Amendment E — Add `.down.sql` per R.16

Plan doesn't mention a down file. Phase 2.1 / 2.2 / 2.3 all shipped `.down.sql` companions. Add to the spec:

```sql
-- 00068_cost_codes_hierarchy.down.sql — reverses 00068 in strict
-- reverse-dependency order.

DROP POLICY IF EXISTS cct_platform_admin_write ON public.cost_code_templates;
DROP POLICY IF EXISTS cct_read                 ON public.cost_code_templates;
ALTER TABLE public.cost_code_templates DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_cost_code_templates_updated_at
  ON public.cost_code_templates;
DROP TABLE IF EXISTS public.cost_code_templates;

DROP TRIGGER IF EXISTS trg_cost_codes_hierarchy ON public.cost_codes;
DROP FUNCTION IF EXISTS app_private.validate_cost_code_hierarchy();

ALTER TABLE public.cost_codes DROP COLUMN IF EXISTS default_allowance_amount;
ALTER TABLE public.cost_codes DROP COLUMN IF EXISTS is_allowance;
ALTER TABLE public.cost_codes DROP COLUMN IF EXISTS parent_id;
```

Mirrors Phase 2.3's loud-fail posture only where it matters — here there's no data to reverse-map so the drop is straightforward.

### Amendment F — R.15 test coverage

Phase 2.4 plan has no test file. R.15 requires baseline-FAIL tests authored before the migration, going PASS after. Add to Phase 2.4 spec:

`__tests__/cost-codes-hierarchy.test.ts`, covering:

- Migration `00068_cost_codes_hierarchy.sql` file exists; `.down.sql` exists.
- `cost_codes.parent_id` column present, nullable, FK to `cost_codes(id)`.
- `cost_codes.is_allowance` present, NOT NULL, default `false`.
- `cost_codes.default_allowance_amount` present, BIGINT, nullable.
- `cost_code_templates` table exists with all columns, `UNIQUE (name)`, `updated_at` trigger, RLS enabled, 2 policies (names `cct_read` and `cct_platform_admin_write`).
- 4 seeded template rows present (negative probe: re-applying seed doesn't dupe due to `ON CONFLICT`).
- **Cycle probe:** INSERT two rows A and B; UPDATE A.parent_id=B; UPDATE B.parent_id=A → expect CHECK violation (via trigger).
- **Depth probe:** INSERT a 4-deep parent chain → expect exception on the 4th.
- **Existing-row data preservation:** 238 pre-migration rows remain, all with `parent_id IS NULL` and `is_allowance = false`.
- Semantic-equivalence / regression: `src/app/api/cost-codes/template/route.ts` still works unchanged (it reads from `cost_codes` via TEMPLATE_ORG_ID, not from the new table). Use a file-content assertion that TEMPLATE_ORG_ID still points to `00000000-0000-0000-0000-000000000001`.

---

## §6 Subagent strategy

| Subagent | Applies? | Scope |
|---|---|---|
| **Schema Validator** | ✅ | Verify post-Dry-Run: 3 new columns on `cost_codes`, 1 new table `cost_code_templates` with 7 columns, 1 trigger, 2 RLS policies, 1 function in app_private, 14+1=15 inbound FKs still intact, 238 existing rows untouched, ON CONFLICT seed leaves 4 rows. |
| **Migration Dry-Run** | ✅ | BEGIN/ROLLBACK on dev. Structural probes (columns, constraints, trigger registration, RLS policy count); negative probes (cycle trigger raises, depth-4 trigger raises, duplicate seed name raises no error under ON CONFLICT); positive probes (default column values on INSERT; ALTER DEFAULT PRIVILEGES inherited by the new function from 00067 so authenticated can call the hierarchy trigger). |
| **Grep/Rename Validator** | ⚠️ Skippable | No renames. Additive columns + 1 net-new table. Blast-radius grep in §2 is sufficient; a full subagent pass isn't warranted. |
| **R.23 precedent check** | ✅ | Amendment B adopts `unit_conversion_templates` (00054) as the precedent. QA report should state this explicitly. Phase 2.4 adds no new tenant-table RLS convention. |

---

## §7 R.21 teardown plan

Minimal. No synthetic-fixture live test is strictly required for this phase because:

- The migration doesn't touch live workflow (no CO trigger, no draw logic).
- The R.15 suite with cycle/depth/seed-idempotency probes covers the correctness surface in the test file.
- Optional live verification: call `GET /api/cost-codes` on the dev server and confirm Ross Built's 218 codes still render — static equivalence from 103→TBD-case R.15 suite likely replaces the need.

If Jake wants a live round-trip regardless, the fixture set and teardown mirror Phase 2.3's pattern:

```
Fixtures (R.21 prefix):
  ZZZ_PHASE_2_4_LIVE_TEST_ROOT            (cost_code, parent_id=NULL)
  ZZZ_PHASE_2_4_LIVE_TEST_CHILD           (cost_code, parent_id=root.id)
  ZZZ_PHASE_2_4_LIVE_TEST_TEMPLATE        (cost_code_template, name match)

Teardown:
  DELETE FROM cost_codes  WHERE code LIKE 'ZZZ_PHASE_2_4_LIVE_TEST_%';
  DELETE FROM cost_code_templates WHERE name LIKE 'ZZZ_PHASE_2_4_LIVE_TEST_%';
  VERIFY: 238 cost_codes live rows remain on dev, 4 cost_code_templates.
```

Committed before live execution per R.22.

---

## §8 Recommended next step

**AMEND PLAN FIRST — draft diffs in §5, await Jake approval.**

Suggested sequence (mirrors Phase 2.2 `4fd3e7d` and Phase 2.3 `c6b468d`):

1. Jake reviews Amendments A–F. Accepts / rejects / modifies each.
2. A new commit `docs(plan): Phase 2.4 pre-flight amendments — hierarchy trigger + cost_code_templates RLS + idempotent seed + down.sql + R.15 tests + naming hygiene` lands on main.
3. Jake issues the Phase 2.4 execution prompt. Claude Code runs Migration Dry-Run against the amended migration SQL (BEGIN/ROLLBACK on dev, structural + negative + positive probes), then writes migration + code changes (none expected; the API routes are pass-through) + test file, applies, commits, pushes, produces `qa-reports/qa-branch2-phase2.4.md`.

**Scope additions surfaced in pre-flight (beyond Jake's original kickoff identifier list):**

- `unit_conversion_templates` — the R.23 precedent for `cost_code_templates` RLS + audit-column posture (Amendment B). Not in the original Phase 2.4 spec.
- Hierarchy validation function + trigger in `app_private` (Amendment A). Plan's `parent_id` column alone is not safe without cycle/depth enforcement.
- `UNIQUE (name)` + `ON CONFLICT DO NOTHING` on the seed (Amendment C). Plan's naked INSERT is not idempotent.
- R.15 test file (Amendment F). Plan doesn't mention one.
- `.down.sql` (Amendment E). Plan doesn't mention one.
- Naming-collision note for `is_allowance` (Amendment D). Plan spec lands the column without commentary.

**Do-not list:**
- Do not write `00068_cost_codes_hierarchy.sql` until §5 amendments are accepted.
- Do not run Migration Dry-Run until the amended migration is drafted.
- Do not modify `src/app/api/cost-codes/template/route.ts` in Phase 2.4 — that's explicitly Phase 7.5's scope.
- Do not push. Do not commit.

**Tracked open issues check:** GH #1–#9 do not directly overlap Phase 2.4 scope. GH #9 (app_private grants audit) is adjacent — Amendment A adds a new app_private function + explicit EXECUTE grant to authenticated, which stays consistent with 00067's intent and is flagged in the GH #9 scope.
