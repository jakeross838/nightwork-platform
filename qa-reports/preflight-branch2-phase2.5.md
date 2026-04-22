# Pre-flight Findings — Branch 2 Phase 2.5: Approval chains

**Date:** 2026-04-22
**Migration target:** `supabase/migrations/00069_approval_chains.sql` (+ `.down.sql`)
**Origin HEAD at kickoff:** `21800ee` (Phase 2.4 QA report landed; plan renumber on main)
**Mode:** PRE-FLIGHT ONLY — no migration written, no SQL applied, no Dry-Run, no commit.
**Dry-Run:** deferred per R.20 + user prompt until post-amendment decisions.

---

## §1 Executive summary

**Verdict: AMEND PLAN FIRST.** The Phase 2.5 spec at `docs/nightwork-rebuild-plan.md:3240–3282` is a 43-line skeleton that will **not** execute safely against the live dev state (3 orgs, 56 live invoices, 73 live change_orders, 2 live draws — all of which already carry `status_history` JSONB that captures the same audit events the new `approval_actions` table is meant to record). Eight drift flags land in §5; two are scope decisions I am deliberately not answering (Amendment E — FK target shape; Amendment F — approval_actions overlap with existing audit surface).

**Top 3 flags** (detailed list in §5):

1. **`approval_actions` overlaps with two existing audit surfaces and has no `org_id` — scope decision needed before any SQL is written.** (Amendment F.) Every workflow-type target table (`invoices`, `change_orders`, `draws`, `proposals`, `purchase_orders`) already has a `status_history` JSONB column populated by application writes (mandated by CLAUDE.md §Architecture Rules + plan Part 2 §2.4 rule #4). Separately, `public.activity_log` (50 rows, 4 policies, tenant-scoped) already stores `(entity_type, entity_id, action, details)` — structurally identical to the proposed `approval_actions`. The plan at `docs/nightwork-rebuild-plan.md:1948` explicitly calls `approval_actions` an "audit log." Two overlapping audit layers is not inherently wrong, but ships with zero documented rationale and drops `approval_actions` below the CLAUDE.md bar: no `org_id`, no `updated_at`, no `created_by`, no `deleted_at`. Under the proposals (00065) RLS precedent this table **cannot** have a tenant-isolation policy without `org_id`. Jake needs to decide: (F-i) keep `approval_actions` as a cross-workflow log and add `org_id` + audit set, accepting R.23 alignment with proposals; (F-ii) drop `approval_actions` entirely and rely on `status_history` + `activity_log`; (F-iii) keep `approval_actions` as-is and document the exemption.

2. **`approval_actions.entity_id` is polymorphic (`entity_type TEXT, entity_id UUID`) with no FK integrity — scope decision needed.** (Amendment E.) The spec has zero FKs on the pair. `activity_log` uses the same shape (precedent exists), but activity_log is best-effort telemetry, whereas approval_actions is load-bearing for workflow state per `docs/nightwork-rebuild-plan.md:2382–2396` ("Look up approval_chain for this org + workflow_type … Write approval_actions row"). Four options land in §5 flag E with trade-offs; I am deliberately not choosing. This interacts with flag F (if F-ii is accepted the decision evaporates).

3. **Seed-on-org-creation trigger is a naked narrative comment, not SQL.** (Amendment D.) The spec ends with `-- Seed default chains per org (will be populated by a trigger on org creation + backfill)` — no function, no trigger, no backfill INSERT, no `ON CONFLICT` posture, no `stages` JSONB default payload, no F.2-style GRANT to `authenticated`. A direct precedent exists at live runtime: `public.create_default_workflow_settings()` (SECURITY DEFINER, `search_path = public, pg_temp`) attached via `trg_organizations_create_workflow_settings AFTER INSERT` and the paired migration 00032. Amendment D proposes mirroring that function verbatim (with a minimal default `stages` payload) plus a one-time backfill over the live 3 orgs × 6 workflow_types = 18 default chains. Without this, the migration lands but new orgs get no default chains and existing orgs stay empty.

Additional flags in §5 cover RLS adoption (B), architecture-rules audit columns (A), soft-delete-safe partial unique index (C), `.down.sql` per R.16 (G), and R.15 test coverage including the F.2 GRANT probe (H).

**Recommendation:** amend plan spec in a commit before execution, mirroring the Phase 2.3 (`c6b468d`) and Phase 2.4 (`95df1b4`) precedents. Draft amendment diffs land in §5 below as A–H.

---

## §2 R.18 blast-radius grep

Greps across `src/`, `supabase/migrations/`, `__tests__/`, `docs/`.

### Identifier summary

| Identifier | src/ hits | migrations | __tests__ | docs | Verdict |
|---|---|---|---|---|---|
| `approval_chain` / `approval_chains` | **0** | 0 | 0 | 7 (plan only — lines 1481, 1943, 2063, 2382, 2447, 3242, 3244, 3261, 3262) | **Clean net-new.** No application code touches approval chains yet; Branch 7 surfaces the UI. |
| `approval_action` / `approval_actions` | **0** | 0 | 0 | 5 (plan only — lines 1948, 2396, 3265, 3277) | Clean net-new. |
| `workflow_type` / `workflowType` | 0 | 0 | 0 | 5 (plan only) | Clean net-new. |
| `entity_type` | **12 files** in src/ (activity_log reads, support tool handlers, dashboard, admin pages, budget drill-down) + 1 migration (00026 activity_log) | — | — | — | **Name collision — see §2.1.** `activity_log.entity_type` is the same column name, same shape, same usage. |
| `entity_id` | Same 12 files as above | — | — | — | Same collision as entity_type. Not a bug, but worth a naming-hygiene note. |
| `stage_order` | 0 | 0 | 0 | 2 (plan only) | Clean net-new. |
| `actor_user_id` | 0 in application source; appears in 00061 draw RPCs as a function **parameter** (not a column) | 1 (00061_transactional_draw_rpcs.sql, 5× as `_actor_user_id uuid` param) | — | 2 (plan only) | No column conflict. `_actor_user_id` is a draw RPC parameter used to attribute status_history writes to the caller — same semantic, different scope. |
| `actor_role` | 0 | 0 | 0 | 1 (plan only) | Clean net-new. |
| `stages` (approval context) | 0 relevant; `src/components/invoice-status-timeline.tsx:72–199` uses `const stages = useMemo(...)` for UI display (different concept) | 0 | 0 | — | Clean — UI `stages` variable is local scope. |
| `'invoice_pm'` / `'invoice_qa'` as strings | 0 | 0 | 0 | 2 (plan only, lines 2064 + 3247) | Clean. **But see §2.2 below** — these are *CHECK-enum values for the approval_chains.workflow_type column*, NOT invoice statuses. The actual invoice status enum (CHECK on `invoices.status`) has 21 values including `pm_review`, `pm_approved`, `qa_review`, `qa_approved` — invoice_pm / invoice_qa are APPROVAL-CHAIN dimensions over the invoice workflow, not status values themselves. |
| `approval_chains_one_default_per_workflow` (target index name) | 0 | 0 | 0 | 1 (plan only, line 3261) | Clean net-new. |
| `create_default_workflow_settings` (precedent function) | 0 | **1 — 00032_phase8e_org_workflow_settings.sql** | 0 | 0 | **Direct precedent for Amendment D.** Also live at runtime via `trg_organizations_create_workflow_settings`. |
| `trg_organizations_*` (existing org-creation triggers) | — | 00032 | — | — | Only 2 triggers currently on `public.organizations`: `trg_organizations_create_workflow_settings` (AFTER INSERT → `create_default_workflow_settings()`) and `trg_organizations_updated_at` (BEFORE UPDATE, standard). Amendment D proposes a 3rd trigger (`trg_organizations_create_default_approval_chains`) OR extending the existing function body — decision surfaced in §5 flag D. |

### §2.1 Name collision: `entity_type` / `entity_id` on `approval_actions` vs `activity_log`

**Flag.** `public.activity_log` (migration 00026) has the exact column tuple `(org_id uuid, entity_type text, entity_id uuid, action text, details jsonb, created_at timestamptz)`. The proposed `approval_actions` has `(entity_type text, entity_id uuid, stage_order int, action text, actor_user_id uuid, actor_role text, comment text, acted_at timestamptz)`. Overlap is ~60% by column names, 100% by `(entity_type, entity_id, action)` semantic. Flag for §5 Amendment F — this is part of the overlap-with-existing-audit-surface scope decision.

### §2.2 workflow_type semantic vs invoices.status enum

The `approval_chains.workflow_type` CHECK enum `('invoice_pm','invoice_qa','co','draw','po','proposal')` is **not** a subset of any existing status enum. It's a new orthogonal dimension — "which approval workflow dimension is this chain configured for." The invoice status CHECK (verified S4 below) has 21 values including `pm_review`/`pm_approved`/`qa_review`/`qa_approved` — those are invoice state transitions. `invoice_pm` vs `invoice_qa` is the phase of approval *against* an invoice row. An invoice row flows through both (pm_review → pm_approved → qa_review → qa_approved). Approval chains layer on top of this, not replace it. Flag for record only — no code delta needed in Phase 2.5 since nothing consumes these values yet.

### §2.3 Classification

**Type A: PASSTHROUGH** — None. Both new tables have zero existing application consumers.

**Type B: WRITE PATHS — verify on Migration Dry-Run** — None in Phase 2.5 scope. Branch 7 will introduce write paths.

**Type C: WORKFLOW INTEGRATION POINTS (future, not this phase)** — `docs/nightwork-rebuild-plan.md:2382–2396` describes the future call sequence: lookup approval_chain → evaluate stages → write approval_actions row. No code implements this yet. Flag that Phase 2.5 is strictly schema + seed-trigger; invocation surface ships in Branch 7.

**Type D: TS-UNION-VS-CHECK (Phase 2.1 / 2.3 precedent)** — No TS unions currently narrow to the workflow_type or action enums (zero src/ hits). When Branch 7 adds consumers, apply the `046a164` pattern: runtime-validate against a file-private constant, don't narrow TS. Flag for Branch 7 record only.

---

## §3 Schema Validator findings (C1–C7)

### C1 — Existing approval-event surface

**S1a. `status_history` JSONB columns (append-only audit per plan Part 2 §2.4 rule #4):**

| Table | `status_history` | `approved_at` | `approved_by` |
|---|---|---|---|
| `invoices` | ✅ | ❌ (state lives in `status` enum transitions: `pm_approved` / `qa_approved`) | ❌ |
| `change_orders` | ✅ | ❌ | ✅ (uuid) |
| `draws` | ✅ | ✅ (timestamptz) | ✅ (uuid) |
| `proposals` | ✅ | ❌ | ❌ |
| `purchase_orders` | ✅ | ❌ | ❌ |
| `selections` | ✅ | ❌ | ❌ |

All 6 tables that could hold an approval event already have `status_history`. Application writes append `{from, to, actor_user_id, at, reason?, comment?}` entries on every status change (per `docs/nightwork-rebuild-plan.md:61`). Live examples in `src/lib/invoices/save.ts:403`, `src/lib/invoices/bulk-import.ts:327`, and migration `00061_transactional_draw_rpcs.sql` (lines 156, 177, 347, 459, 479).

**S1b. `public.activity_log` (migration 00026):**

| Column | Type | Nullable |
|---|---|---|
| id | uuid | NO |
| org_id | uuid | NO |
| user_id | uuid | YES |
| entity_type | text | NO |
| entity_id | uuid | YES |
| action | text | NO |
| details | jsonb | YES |
| created_at | timestamptz | NO |

Live entity_types currently used: `budget_line, change_order, draw, invoice, invoice_import_batch, job`. Live actions: `created, sent_to_queue, status_changed, updated`. 50 live rows. 4 RLS policies (`org isolation` ALL, `members read activity` SELECT, `activity_log_delete_strict` DELETE, `activity_log_platform_admin_read` SELECT).

**Implication:** the "audit log" purpose of `approval_actions` is already fulfilled by two layers. Phase 2.5 either (a) adds a third cross-workflow aggregator that normalizes approve/reject events across all 6 workflow-type targets, or (b) the plan intent was that `approval_actions` *replaces* the status_history-append approach going forward. The plan is silent on which. §5 Amendment F surfaces this for scope decision.

### C2 — Row counts on workflow-type referent tables

| Table | Live rows | Soft-deleted | CHECK enum values relevant to approvals |
|---|---|---|---|
| `invoices` | 56 | — | status has 21 values incl. `pm_review, pm_approved, pm_held, pm_denied, qa_review, qa_approved, qa_kicked_back` |
| `change_orders` | 73 | 15 | status (5 values) — approvals stored via `approved_by` + status transitions |
| `draws` | 2 | — | status (7 values) incl. `approved`; also `approved_at` / `approved_by` columns |
| `purchase_orders` | 0 | — | status enum |
| `proposals` | 0 | — | status (7 values) incl. `accepted` |

**Implication:** backfilling historical `approval_actions` rows from the existing `status_history` JSONB on the 56+73+2 = 131 live rows is theoretically possible but explicitly **not** in Phase 2.5 scope per the plan (no backfill mentioned for approval_actions). Confirm in §5 that 0 rows seed into approval_actions on migration apply; all approval_actions rows arrive post-Branch-7 when write paths exist.

### C3 — `organizations` row count + backfill size

**3 live orgs.** With 6 workflow_type values, default-chain backfill = **3 × 6 = 18 rows** on migration apply. Every subsequent `INSERT INTO public.organizations` would fire the trigger and insert 6 more. All on `ON CONFLICT DO NOTHING` posture.

### C4 — FK target candidates per `workflow_type`

| workflow_type | Candidate target table | Target id column | Live-row count (C2) | FK target table has RLS? |
|---|---|---|---|---|
| `invoice_pm` | `public.invoices` | `id` (uuid) | 56 live | ✅ |
| `invoice_qa` | `public.invoices` | `id` (uuid) | 56 live (same rows as invoice_pm — different phase) | ✅ |
| `co` | `public.change_orders` | `id` (uuid) | 73 live | ✅ |
| `draw` | `public.draws` | `id` (uuid) | 2 live | ✅ |
| `po` | `public.purchase_orders` | `id` (uuid) | 0 live | ✅ |
| `proposal` | `public.proposals` | `id` (uuid) | 0 live | ✅ |

**Important:** `invoice_pm` and `invoice_qa` both target `invoices.id` — they're two approval-chain dimensions on the same row set, not two distinct entities. The plan's Part 2 §1.12 `approval_actions.entity_type` (line 1949) doesn't enumerate which strings are used; probable intent is `entity_type IN ('invoice', 'change_order', 'draw', 'purchase_order', 'proposal')` (5 distinct tables), with the `workflow_type` on the parent `approval_chains` row disambiguating invoice_pm vs invoice_qa. §5 Amendment E's option (a) requires making this explicit via a CHECK; option (c) requires 5 nullable FK columns (not 6).

### C5 — R.23 precedent identification (most-recent tenant table)

Migration order from live `supabase_migrations.schema_migrations` (post-60):

```
00068 cost_codes_hierarchy                  — SYSTEM catalog table (not tenant)
00067 co_cache_trigger_authenticated_grants — grant-fix, no table
00066 co_type_expansion                     — additive, no new table
00065 proposals_amended_3_policies          — tenant table (proposals + proposal_line_items)
00065 proposals                             — superseded by the amend commit
00064 job_phase_contract_type               — additive
00063 lien_release_waived_at                — additive
00062 assert_created_by_columns             — additive check
00061 transactional_draw_rpcs               — RPCs, no table
00060 align_status_enums                    — additive
```

**Most recent tenant table of the same shape = 00065 proposals.** Adopt its RLS posture verbatim per R.23. Verified policy structure (from `pg_policies`):

```
proposals / proposal_line_items:
  proposals_org_read      SELECT  org_id IN (org_members with is_active) OR app_private.is_platform_admin()
  proposals_org_insert    INSERT  org_id IN (org_members with is_active AND role IN (owner,admin,pm,accounting))
  proposals_org_update    UPDATE  (same qual as insert)
  — no DELETE policy; RLS blocks hard DELETE by default (soft-delete via deleted_at)
```

3 policies per table. No DELETE policy. Pattern originates in 00052 `cost_intelligence_spine`. Phase 2.5 Amendment B adopts this on `approval_chains` (and on `approval_actions` **if** it gets an `org_id` per Amendment F-i).

**Also-relevant precedent:** `public.org_workflow_settings` (migration 00032) is the closest *purpose* precedent — per-org configurable settings table, default row per org seeded via AFTER INSERT trigger. It has 5 policies (older-style, mixes `app_private.user_org_id()` with explicit DELETE), but its **seed-trigger function body** (`create_default_workflow_settings()`) is the direct structural precedent for Amendment D. Phase 2.5 adopts org_workflow_settings's *trigger pattern* but proposals's *RLS policy shape* (R.23 is explicit about "most-recent tenant-table migration").

### C6 — Inbound FK implications

With the spec-as-written (no FKs on approval_actions.entity_id), inbound-FK count on the 5 target tables stays unchanged. Options in §5 Amendment E change this:

- Option (a) polymorphic + CHECK on entity_type: **+0** FKs. Integrity enforced at app layer only.
- Option (b) per-entity tables: **+5** tables, **+1** FK per new table. Largest footprint; scales ugly.
- Option (c) nullable per-target FKs on one table: **+5** FKs (one each on invoices, change_orders, draws, purchase_orders, proposals) plus a CHECK constraint for exactly-one-non-null. Moderate footprint; cleanest integrity.
- Option (d) approval_actions dropped entirely (rely on status_history + activity_log): **+0** anywhere.

Whichever option lands, the decision must come before the migration is drafted.

### C7 — Triggers on `organizations` + seed-on-org-creation precedent

2 existing triggers:

| Trigger | Timing | Event | Function |
|---|---|---|---|
| `trg_organizations_create_workflow_settings` | AFTER | INSERT | `public.create_default_workflow_settings()` |
| `trg_organizations_updated_at` | BEFORE | UPDATE | `public.update_updated_at()` |

**`create_default_workflow_settings()` body (live):**

```sql
CREATE OR REPLACE FUNCTION public.create_default_workflow_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.org_workflow_settings (org_id)
  VALUES (NEW.id)
  ON CONFLICT (org_id) DO NOTHING;
  RETURN NEW;
END;
$function$
```

- SECURITY DEFINER ✅
- `search_path` pinned ✅
- `ON CONFLICT DO NOTHING` makes the trigger idempotent ✅
- ACL includes `authenticated=X/postgres` (EXECUTE) ✅ — matches the F.2 pattern

Amendment D proposes a mirror function `create_default_approval_chains()` that iterates the 6 workflow_type values and INSERTs one default chain per pair, with `ON CONFLICT (org_id, workflow_type, name) DO NOTHING`. Must include explicit `GRANT EXECUTE ... TO authenticated` per the 00067 + Phase 2.4 Amendment A pattern, and the R.15 suite must include an F.2 `has_function_privilege('authenticated', ..., 'EXECUTE')` probe.

Design choice: new separate function vs extend existing. Both work; new separate function has looser coupling (Phase 7.5's TEMPLATE_ORG_ID cutover + future seed changes touch fewer sites). Recommended in Amendment D.

---

## §4 Architecture-rules compliance

CLAUDE.md §Architecture Rules require every record: `id, created_at, updated_at, created_by, org_id, deleted_at`. Plan Part 2 §2.4 rule #4 requires `status_history` on workflow entities.

| Column | `approval_chains` (spec) | `approval_chains` required | `approval_actions` (spec) | `approval_actions` required |
|---|---|---|---|---|
| id | ✅ | ✅ | ✅ | ✅ |
| created_at | ✅ | ✅ | ❌ (has `acted_at` only) | ⚠️ see below |
| updated_at | ❌ | ✅ | ❌ | ⚠️ see below |
| created_by | ✅ | ✅ | ❌ (has `actor_user_id` only) | ⚠️ see below |
| org_id | ✅ | ✅ | **❌** | ✅ (required for RLS org-isolation) |
| deleted_at | ✅ | ✅ | ❌ | ✅ (plan rule) |
| status_history | N/A (config table) | N/A | N/A (is itself an audit log) | N/A |

**`approval_chains` verdict:** missing `updated_at`. Amendment A adds it + trigger.

**`approval_actions` verdict:** spec is below the architecture-rules bar on 4 of 6 columns. Two interpretations:

- **If F-i (keep approval_actions as cross-workflow log, add org_id):** Amendment A adds `org_id`, `created_at` (alias for `acted_at` or replaces it), `created_by` (probably identical to `actor_user_id`; pick one), `deleted_at`, `updated_at`. This is heavy but architecture-compliant.
- **If F-ii (drop approval_actions, rely on status_history + activity_log):** the architecture gap evaporates. activity_log already carries `org_id` + audit columns. status_history is JSONB-appended on each entity.
- **If F-iii (accept the exemption and keep as-is):** requires explicit R.23 precedent citation for the divergence, parallel to Phase 2.4's cost_code_templates divergence (which cited unit_conversion_templates). There is no existing tenant-table precedent in the repo with no `org_id` and no audit columns. activity_log has `org_id` + 4 RLS policies. So F-iii has no precedent and cannot invoke R.23 cleanly.

My recommendation (surfaced for Jake's scope call, not decided): **F-i** — keep approval_actions, add `org_id` and audit set, adopt 00065 RLS. Reasoning: cross-workflow analytics queries (e.g., "which PMs are approving fastest, broken out by workflow_type") are cleaner over one denormalized table than over 6 per-entity status_history JSONB columns. But the call is yours.

---

## §5 Plan-drift flags — proposed amendments

Eight amendments. A, B, C, G, H are mechanical (R.23 + standing-rules alignment). D is structural (trigger design). E and F are scope decisions I am **not** answering here.

### Amendment A — Audit-column completion

**Current plan spec** (lines 3244–3255 for approval_chains):
```sql
CREATE TABLE approval_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  workflow_type TEXT NOT NULL CHECK (...),
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  conditions JSONB DEFAULT '{}'::jsonb,
  stages JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);
```

**Gaps:** no `updated_at`, no `public.` schema qualification (G.9), nullability on timestamps.

**Proposed amendment (approval_chains):**

```sql
CREATE TABLE public.approval_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  workflow_type TEXT NOT NULL CHECK (
    workflow_type IN ('invoice_pm','invoice_qa','co','draw','po','proposal')
  ),
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  stages JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER trg_approval_chains_updated_at
BEFORE UPDATE ON public.approval_chains
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

**Proposed amendment (approval_actions) — IF Amendment F lands as F-i (keep + add org_id):**

```sql
CREATE TABLE public.approval_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  entity_type TEXT NOT NULL CHECK (
    entity_type IN ('invoice','change_order','draw','purchase_order','proposal')
  ),
  entity_id UUID NOT NULL,
  chain_id UUID REFERENCES public.approval_chains(id),   -- optional link to the chain that governed this action
  stage_order INT NOT NULL,
  action TEXT NOT NULL CHECK (
    action IN ('approve','reject','skip','delegate')
  ),
  actor_user_id UUID REFERENCES auth.users(id),
  actor_role TEXT,
  comment TEXT,
  acted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),             -- typically equal to actor_user_id; kept for consistency
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER trg_approval_actions_updated_at
BEFORE UPDATE ON public.approval_actions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

Note `created_at` vs `acted_at`: per the architecture rule, every row gets `created_at`. `acted_at` is retained because the plan explicitly names it and because in theory approval events could be backfilled (`acted_at` = domain time, `created_at` = row-insert time). Flag the duplication for your review — collapse to one column if preferred.

### Amendment B — RLS adoption (R.23 — proposals precedent)

**Current plan spec:** zero policies.

**Proposed amendment (approval_chains):**

```sql
ALTER TABLE public.approval_chains ENABLE ROW LEVEL SECURITY;

-- Pattern matches 00065 proposals verbatim (most recent tenant-table under R.23).
-- No DELETE policy — RLS blocks hard DELETE by default; deletion is soft via deleted_at.

CREATE POLICY approval_chains_org_read
  ON public.approval_chains
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

CREATE POLICY approval_chains_org_insert
  ON public.approval_chains
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner','admin')
    )
  );

CREATE POLICY approval_chains_org_update
  ON public.approval_chains
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner','admin')
    )
  );
```

**Role-set divergence from proposals:** 00065 proposals uses `role IN ('owner','admin','pm','accounting')`. approval_chains is a **tenant configuration** table (policy surface), not a workflow entity. PMs should not edit who approves what — that's org-admin territory. Narrowing to `('owner','admin')` is an intentional divergence from the precedent. Flag for your review.

**Proposed amendment (approval_actions) — IF F-i:** Same 3-policy structure, but read policy extends to all org_members (not just write-capable roles), and write policies restricted to authenticated users who are org members. Append-only — no UPDATE policy (actions are immutable once written). I.e., only read + insert.

```sql
ALTER TABLE public.approval_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY approval_actions_org_read
  ON public.approval_actions
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

CREATE POLICY approval_actions_org_insert
  ON public.approval_actions
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- No UPDATE policy — approval_actions is append-only.
-- No DELETE policy — RLS blocks hard DELETE; soft-delete via deleted_at if needed.
```

### Amendment C — Soft-delete-safe partial unique index

**Current plan spec** (lines 3261–3263):
```sql
CREATE UNIQUE INDEX approval_chains_one_default_per_workflow
  ON approval_chains (org_id, workflow_type)
  WHERE is_default = true;
```

**Gap:** a soft-deleted default chain would still occupy the unique slot, blocking the creation of a new default after deletion. Precedent: most live partial uniques include `AND deleted_at IS NULL` (verified: `idx_cost_codes_code_org`, `idx_draws_job_number`, `idx_budgets_one_active_per_job`, etc.).

**Proposed amendment:**

```sql
CREATE UNIQUE INDEX approval_chains_one_default_per_workflow
  ON public.approval_chains (org_id, workflow_type)
  WHERE is_default = true AND deleted_at IS NULL;
```

Also suggest a natural UNIQUE for the seed ON CONFLICT to target (see Amendment D):

```sql
CREATE UNIQUE INDEX approval_chains_unique_name_per_workflow
  ON public.approval_chains (org_id, workflow_type, name)
  WHERE deleted_at IS NULL;
```

Needed so Amendment D's `ON CONFLICT (org_id, workflow_type, name) DO NOTHING` has an index to target.

### Amendment D — Seed-on-org-creation design + idempotent backfill

**Current plan spec** (line 3279 — the entire seed design):
```sql
-- Seed default chains per org (will be populated by a trigger on org creation + backfill)
```

**Gap:** no function body, no trigger registration, no backfill, no `ON CONFLICT` posture, no `stages` JSONB default, no GRANT to authenticated.

**Proposed amendment:**

```sql
-- ------------------------------------------------------------
-- (seed trigger function) — mirrors create_default_workflow_settings()
-- pattern from migration 00032. SECURITY DEFINER + search_path
-- pinned. ON CONFLICT targets approval_chains_unique_name_per_workflow
-- from Amendment C. GRANT EXECUTE TO authenticated mirrors the
-- Phase 2.4 Amendment A pattern (defense against the GH #9 class of
-- bug — app_private / public function-privilege gaps).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_default_approval_chains()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _wt text;
  _workflow_types text[] := ARRAY[
    'invoice_pm','invoice_qa','co','draw','po','proposal'
  ];
  _default_stages jsonb := jsonb_build_array(
    jsonb_build_object(
      'order', 1,
      'required_roles', jsonb_build_array('owner','admin'),
      'required_users', '[]'::jsonb,
      'all_required', false
    )
  );
BEGIN
  FOREACH _wt IN ARRAY _workflow_types LOOP
    INSERT INTO public.approval_chains (
      org_id, workflow_type, name, is_default, stages
    ) VALUES (
      NEW.id, _wt, 'Default ' || _wt || ' approval', true, _default_stages
    )
    ON CONFLICT (org_id, workflow_type, name)
      WHERE deleted_at IS NULL
      DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_default_approval_chains()
  TO authenticated;

CREATE TRIGGER trg_organizations_create_default_approval_chains
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.create_default_approval_chains();

-- ------------------------------------------------------------
-- One-time backfill for the 3 live orgs (6 workflow_types each = 18
-- rows). Idempotent via the same ON CONFLICT predicate.
-- ------------------------------------------------------------
INSERT INTO public.approval_chains (org_id, workflow_type, name, is_default, stages)
SELECT
  o.id,
  wt,
  'Default ' || wt || ' approval',
  true,
  jsonb_build_array(jsonb_build_object(
    'order', 1,
    'required_roles', jsonb_build_array('owner','admin'),
    'required_users', '[]'::jsonb,
    'all_required', false
  ))
FROM public.organizations o
CROSS JOIN unnest(ARRAY['invoice_pm','invoice_qa','co','draw','po','proposal']) AS wt
WHERE o.deleted_at IS NULL
ON CONFLICT (org_id, workflow_type, name)
  WHERE deleted_at IS NULL
  DO NOTHING;
```

**Default `stages` payload note:** I chose a minimal single-stage `[{order:1, required_roles:['owner','admin'], required_users:[], all_required:false}]`. This is a conservative guess at what Ross Built's actual default should be. Flag for your review — the current Ross Built workflow (CLAUDE.md §Current Pain Points) routes PM approval first, then QA review; the default stages for `invoice_pm` and `invoice_qa` could be more opinionated. I deliberately kept the seed minimal to avoid encoding Ross-Built-specific policy into a system-wide default.

### Amendment E — FK target decision for `approval_actions.entity_id` (SCOPE DECISION — not decided here)

**Current plan spec** (lines 3267–3268): `entity_type TEXT NOT NULL, entity_id UUID NOT NULL` — no FK, no entity_type CHECK.

**Four options, trade-offs only:**

| Option | Shape | Integrity | Blast radius | Precedent in repo |
|---|---|---|---|---|
| **(a) Polymorphic + CHECK on entity_type** | 1 table, entity_type enum via CHECK, entity_id UUID with no FK | App-layer only. Orphan rows possible if target is hard-deleted (mitigated by RLS-blocks-DELETE on targets). | Minimal. +0 FKs. | `activity_log` (migration 00026) uses exact shape. |
| **(b) Per-entity tables** | 5 tables: `invoice_approvals`, `co_approvals`, `draw_approvals`, `po_approvals`, `proposal_approvals` | Real FK per table. Cleanest. | Largest. +5 tables, +5 FKs, +15 RLS policies (3 per), 5 updated_at triggers. | None in repo. |
| **(c) Single table + nullable per-target FKs + CHECK** | `invoice_id UUID NULL REFERENCES invoices(id)`, `co_id UUID NULL`, `draw_id`, `po_id`, `proposal_id`, all nullable; CHECK constraint forces exactly one non-null | Full FK integrity. | Moderate. +5 FKs on one table, 1 CHECK, indexing overhead. | Not identical; `invoice_line_items` uses a nullable pair FK pattern. |
| **(d) Drop approval_actions entirely** | 0 tables. Rely on `status_history` JSONB on each entity + `activity_log` cross-workflow. | Already present (mandated by plan Part 2 §2.4). | Negative — removes a planned table. Requires plan edit to §1.12. | See §3 C1 — both audit surfaces exist. |

Option (a) is simplest and mirrors activity_log. Option (c) is the strongest integrity for the least footprint. Option (d) is the most aggressive — it forces a plan-level decision that Phase 2.5's audit purpose is already covered. My gut (you may disagree) is (a) for symmetry with activity_log; but the decision is yours.

**This amendment interacts with Amendment F.** If F lands as F-ii (drop approval_actions), Amendment E is moot.

### Amendment F — `approval_actions` vs existing audit surface (SCOPE DECISION — not decided here)

**Context:** §3 C1 demonstrates that every workflow-type target already carries `status_history` JSONB; `public.activity_log` carries a superset-shape of `(entity_type, entity_id, action, details)`. The plan (line 1948) calls `approval_actions` an "audit log." Three courses:

- **F-i. Keep `approval_actions` as cross-workflow log. Add `org_id` + audit columns per Amendment A.** Rationale: cross-workflow analytics (which PMs are slowest, which workflow_type has the most rejections) are cleaner over one denormalized table. Cost: ~6 new columns, 3 RLS policies, justification needed for why activity_log isn't enough.
- **F-ii. Drop `approval_actions`. Status_history + activity_log fulfill the need.** Rationale: R.4 (rebuild over patch) — don't add a third audit surface unless there's a clear gap. Cost: plan §1.12 + §5 Part 2 spec need edits. Phase 2.5 ships with only `approval_chains`. Branch 7 consumers write to status_history + activity_log.
- **F-iii. Keep `approval_actions` spec verbatim.** Rationale: accept the architecture-rules exemption. Cost: no precedent for an org-unaware table with no audit columns; can't invoke R.23. Would need explicit plan documentation of the exemption. Weakest option.

My recommendation (for your decision, not decided here): **F-ii or F-i**. F-iii is defensible but creates a new kind of non-precedent table.

### Amendment G — `.down.sql` per R.16

**Gap:** plan silent.

**Proposed down.sql (assuming F-i is selected):**

```sql
-- 00069_approval_chains.down.sql — reverses 00069 in strict reverse-
-- dependency order.

-- Backfill is data-only; reversed by the approval_chains DROP below.

DROP TRIGGER IF EXISTS trg_organizations_create_default_approval_chains
  ON public.organizations;
DROP FUNCTION IF EXISTS public.create_default_approval_chains();

DROP POLICY IF EXISTS approval_actions_org_insert ON public.approval_actions;
DROP POLICY IF EXISTS approval_actions_org_read   ON public.approval_actions;
ALTER TABLE public.approval_actions DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_approval_actions_updated_at
  ON public.approval_actions;
DROP INDEX IF EXISTS idx_approval_actions_entity;
DROP TABLE IF EXISTS public.approval_actions;

DROP POLICY IF EXISTS approval_chains_org_update ON public.approval_chains;
DROP POLICY IF EXISTS approval_chains_org_insert ON public.approval_chains;
DROP POLICY IF EXISTS approval_chains_org_read   ON public.approval_chains;
ALTER TABLE public.approval_chains DISABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_approval_chains_updated_at
  ON public.approval_chains;
DROP INDEX IF EXISTS approval_chains_unique_name_per_workflow;
DROP INDEX IF EXISTS approval_chains_one_default_per_workflow;
DROP TABLE IF EXISTS public.approval_chains;
```

If F-ii is selected, the `approval_actions`-related blocks drop out.

### Amendment H — R.15 test coverage

**Gap:** plan silent.

**Proposed file: `__tests__/approval-chains.test.ts`** (assuming F-i).

Coverage list:

1. **Migration file existence:** `00069_approval_chains.sql` and `.down.sql` exist.
2. **Schema:** `public.approval_chains` has all columns per Amendment A, with `updated_at` and the trigger registered.
3. **Schema:** `public.approval_actions` has `org_id NOT NULL` + FK to organizations + the full audit set (F-i).
4. **Indexes:** `approval_chains_one_default_per_workflow` partial unique exists with predicate `is_default = true AND deleted_at IS NULL`; `approval_chains_unique_name_per_workflow` partial unique exists; `idx_approval_actions_entity` composite index exists.
5. **RLS:** `approval_chains` has exactly 3 policies (names `approval_chains_org_read` / `_insert` / `_update`); `approval_actions` has exactly 2 policies (read + insert, no update, no delete). `ENABLE ROW LEVEL SECURITY` is on both tables.
6. **Seed function:** `public.create_default_approval_chains` is SECURITY DEFINER with pinned search_path; `GRANT EXECUTE ... TO authenticated` is present (F.2 pattern via `has_function_privilege('authenticated', 'public.create_default_approval_chains()', 'EXECUTE')`).
7. **Seed trigger:** `trg_organizations_create_default_approval_chains` exists AFTER INSERT on organizations.
8. **Backfill correctness:** post-migration, every live org has exactly 6 default approval_chains (one per workflow_type), all with `is_default = true`. Live org count is 3, so 18 total default rows.
9. **Seed idempotency (negative probe in Dry-Run):** re-running the backfill is a no-op (0 rows inserted on second run due to `ON CONFLICT DO NOTHING`).
10. **Live-auth RLS probe on `approval_chains` (Amendment F.1 from Phase 2.4):** using a non-platform-admin authenticated JWT, verify (a) SELECT returns only rows in the user's org; (b) INSERT with role='pm' fails `insufficient_privilege` (narrowed role-set per Amendment B); (c) INSERT with role='admin' succeeds.
11. **Partial unique index verification:** INSERT two chains with `is_default=true` for the same (org_id, workflow_type) → second insert violates the partial unique; then set the first's `deleted_at` → new `is_default=true` insert succeeds (proves the `AND deleted_at IS NULL` predicate from Amendment C).
12. **Workflow_type CHECK:** INSERT with `workflow_type='invalid'` fails with a CHECK violation.
13. **Workflow_type inventory:** stored enum values exactly match the plan's Part 2 §2.3 enum inventory (line 2064).

### Summary of amendment dependencies

- **A, B, C, G, H** are independent and mechanical. Ship regardless of F.
- **D** depends on **C** (needs the unique-name-per-workflow index to ON CONFLICT against).
- **E** is moot if **F** lands as F-ii.
- **F** is the root scope decision; your call determines whether A/B/G/H's `approval_actions` blocks ship or drop.

---

## §6 Subagent strategy

| Subagent | Applies? | Scope |
|---|---|---|
| **Schema Validator** | ✅ | Verify post-Dry-Run: 2 new tables (1 if F-ii); 4–5 indexes; 2 or 3 new triggers (one updated_at per new table + one org-creation trigger); 1 new SECURITY DEFINER function in `public`; 3 RLS policies on approval_chains, 0–2 on approval_actions depending on F; 18 default approval_chains rows post-backfill. Confirm trigger function EXECUTE grant visible via `has_function_privilege`. |
| **Migration Dry-Run** | ✅ | BEGIN/ROLLBACK on dev. Structural probes (tables, columns, indexes, triggers, RLS enablement, policy names/quals); negative probes (workflow_type CHECK violation, duplicate-default-chain violation with/without soft-delete, missing org_id INSERT); positive probes (default row lands on org INSERT, backfill populates 18 rows, idempotent re-apply is 0-row delta, live-auth non-admin INSERT on approval_chains hits `insufficient_privilege`). |
| **Grep/Rename Validator** | ⚠️ **Skippable** | No renames. Additive new tables + 1 new function + 1 new trigger. Blast-radius grep in §2 is sufficient; 0 src/ hits means no consumer code touches. |
| **R.23 precedent check** | ✅ | Amendment B adopts 00065 proposals as the tenant-table precedent. Amendment D adopts the 00032 `create_default_workflow_settings()` function shape. QA report must state both precedents explicitly, including the intentional role-set narrowing (`owner`/`admin` only on approval_chains writes) as a divergence. |

**Subagent additions beyond this list:** none. Flagging per the kickoff subagent-additions rule — no new subagent is proposed beyond the 4 above.

---

## §7 R.21 teardown plan

**Expectation: static-validation carve-out applies.** Both conditions:

- **(a)** No runtime code path touched. §2 grep returned 0 hits in src/ for every new identifier; all consumers are future Branch 7 surfaces.
- **(b)** Migration Dry-Run negative probes exercise the full DB stack (workflow_type CHECK violation, duplicate-default partial-unique violation, live-auth RLS rejection on non-admin INSERT, non-org INSERT rejection).

No live synthetic-fixture R.19 run strictly required. Optional validation: call `GET /api/admin/integrity-check` post-apply to verify the 18 default chains are visible; existing route doesn't query approval_chains so this is genuinely optional.

If Jake wants a live round-trip anyway (mirrors Phase 2.3 pattern), fixtures land inside `BEGIN/ROLLBACK` on Dry-Run only — no committed post-apply fixtures because approval_chains writes require `role IN ('owner','admin')` which is the existing Ross Built user role; no new test user creation needed.

```
Fixtures (R.21 prefix, Dry-Run scope only):
  ZZZ_PHASE_2_5_TEST_CHAIN_A          (approval_chains, is_default=true, manually inserted)
  ZZZ_PHASE_2_5_TEST_CHAIN_B          (approval_chains, is_default=true, same org+wf — should fail)
  ZZZ_PHASE_2_5_TEST_ACTION_A         (approval_actions, if F-i)

Teardown:
  — none needed; all fixtures inside BEGIN/ROLLBACK transaction.
  VERIFY post-rollback: approval_chains count = 18 (3 orgs × 6 workflow_types); approval_actions count = 0.
```

Committed before live execution per R.22 — if any ad-hoc fixture is added during execution, update teardown first.

---

## §8 Recommended next step

**AMEND PLAN FIRST — draft diffs in §5, await Jake approval on the two scope decisions (E, F).** Mirrors Phase 2.3 (`c6b468d`) and Phase 2.4 (`95df1b4`) precedents.

Suggested sequence:

1. Jake reviews the two scope decisions:
   - **Amendment F** (approval_actions vs existing audit surface): F-i / F-ii / F-iii.
   - **Amendment E** (FK target for approval_actions.entity_id): a / b / c / d — only relevant if F-i.
2. Jake reviews mechanical amendments A, B, C, D, G, H: accept / modify / reject each.
3. New commit `docs(plan): Phase 2.5 pre-flight amendments — approval_chains RLS + seed-on-org-creation + FK-target decision + audit columns + .down.sql + R.15 tests` lands on main.
4. Jake issues the Phase 2.5 execution prompt. Claude Code runs Migration Dry-Run against the amended SQL (BEGIN/ROLLBACK on dev, 13+ probes), writes migration + down.sql + test file, applies, commits, pushes, produces `qa-reports/qa-branch2-phase2.5.md`.

**Scope additions surfaced in pre-flight (beyond Jake's original kickoff flag list):**

- **`approval_actions` overlap with `status_history` + `activity_log`** (Amendment F) — wasn't in the original kickoff's expected-drift list.
- **Role-set narrowing on approval_chains writes** (`owner`/`admin` only, not the full proposals-precedent 4-role set) — intentional R.23 divergence, flagged for your approval.
- **`approval_actions` as append-only → 2 RLS policies instead of 3** (Amendment B) — no UPDATE policy because audit log rows are immutable once written.
- **Partial-unique index soft-delete posture** (Amendment C) — pre-flight scope mentioned this; confirmed needed. Also surfaces the need for a **second** partial unique index (`approval_chains_unique_name_per_workflow`) to support the seed's `ON CONFLICT` clause.
- **Default `stages` JSONB payload decision** (Amendment D) — I chose a minimal `[{order:1, required_roles:['owner','admin'], all_required:false}]` to avoid encoding Ross-Built-specific policy. Flag for your review.

**Do-not list:**

- Do not write `00069_approval_chains.sql` until §5 amendments are accepted.
- Do not run Migration Dry-Run until the amended migration is drafted.
- Do not decide **E** or **F** — they are scope calls for Jake.
- Do not touch `public.activity_log` or any status_history append logic in Phase 2.5.
- Do not push. Do not commit.

**Tracked open issues check:**

- **GH #9** (app_private grants audit) — adjacent. Amendment D adds `public.create_default_approval_chains()`, not an `app_private` function, so the 00067 GRANT pattern must be mirrored in `public` instead. An F.2-style `has_function_privilege` probe still applies. If Jake prefers the new function live in `app_private` for symmetry with Phase 2.4's `validate_cost_code_hierarchy`, flag during amendment review and I'll adjust.
- **GH #10 / #11** — cost-codes UI & TEMPLATE_ORG_ID cutover. No overlap with Phase 2.5.
- **GH #1–#8** — no direct overlap.
