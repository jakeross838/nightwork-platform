# Pre-flight Findings — Branch 2 Phase 2.5: Draw adjustments

**Date:** 2026-04-22
**Migration target:** `supabase/migrations/00069_draw_adjustments.sql` (+ `.down.sql`)
**Origin HEAD at kickoff:** `2565307` (.gitattributes fix landed; Phase 2.5 was approval_chains until this kickoff reassigned Phase 2.5 → draw_adjustments, shifting approval_chains to Phase 2.6).
**Mode:** PRE-FLIGHT ONLY — no migration written, no SQL applied, no Dry-Run, no commit.
**Previous preflight at this filename** (approval_chains) is preserved in git history at commit `f296e0a`.

---

## §1 Executive summary

**Verdict: AMEND PLAN FIRST, then execute.** Design decisions D1–D4 from the kickoff are sound and the Markgraf scenario walkthrough (§6) shows the schema absorbs all 9–11 adjustments cleanly. Five open questions surface that need Jake's review before migration SQL is drafted (§5.C). Renumber logistics (§10) are mechanical — same pattern as the 00067 grant-fix renumber.

**Top 3 flags:**

1. **RLS precedent tension — most-recent tenant-table (proposals / 00065, 3 policies) diverges from in-family precedent (draws / draw_line_items, 6 policies with PM-on-own-jobs narrowing).** §3 D4 confirms draws has the older 6-policy pattern — explicit PM read narrowed to `EXISTS (SELECT 1 FROM jobs j WHERE j.id = draws.job_id AND j.pm_id = auth.uid())`. R.23 says adopt the most-recent tenant-table migration's shape = proposals (3 policies, read by any org member). Jake's §5 scope says adopt proposals + include `('pm','accounting')` in write role-set. But proposals' read policy does NOT narrow PMs — it lets any org_member read everything. That's a **visibility widening** vs the draws table, where PMs can't read draws on jobs they don't own. If a PM can't see the draw itself, but can SELECT its adjustments via draw_adjustments, we have a leak. Decision needed: (a) adopt proposals shape verbatim and accept the PM-visibility-widening relative to draws (simpler, consistent with R.23); (b) adopt proposals shape but add a PM-on-own-jobs narrowing to the read policy (bespoke, matches draws parity, deviates from R.23 most-recent-precedent); (c) adopt the older 6-policy draws pattern (R.23 divergence in the opposite direction, but matches the in-family table behavior exactly).

2. **`amount_cents NOT NULL` blocks placeholder-only adjustments.** 2 of the email events (Line 19101 "clarify charges" + trapezoidal shades "need a discussion") are adjustment-adjacent correspondence with no $ attached. Jake's schema has `amount_cents BIGINT NOT NULL`. Options: (i) model these as `amount_cents = 0` with reason explaining "amount TBD"; (ii) allow `amount_cents NULL`; (iii) don't model them as draw_adjustments — route through a separate draw_correspondence surface (new entity, out of scope). Flagging for the decision because it affects whether the "9 events" count treats these as trackable adjustments.

3. **`adjustment_type` 7-value flat enum vs. 5-type + `credit_subtype` column.** Jake's scope says "final 7-value enum from the 5 categories + goodwill/defect/error credit subtypes flattened." That gives `correction` / `credit_goodwill` / `credit_defect` / `credit_error` / `withhold` / `customer_direct_pay` / `conditional`. Alternative: 5-value `adjustment_type` (`correction`/`credit`/`withhold`/`customer_direct_pay`/`conditional`) + nullable `credit_subtype TEXT` CHECK-constrained to `('goodwill','defect','error')` WHERE `adjustment_type='credit'`. Pros/cons in §5.B. Recommendation: flat 7-value (cleaner CHECK, `WHERE adjustment_type LIKE 'credit_%'` handles "all credits" queries). Flag for decision.

**Plan moves required (in one docs(plan) commit):**

- Insert new §1.8a "Draw adjustments" block in Part 2 §1.8 right after `draw_line_items` and `job_milestones` (line 1879 boundary), before Lien Releases (line 1881). Draft text in §9.
- Insert new Phase 2.5 spec at line 3240 (replacing the current Phase 2.5 approval_chains content that landed in commit `317961d`).
- Shift every existing Phase 2.5-2.9 → 2.6-3.0 (5 renames). Shift migrations 00069-00073 → 00070-00074 (5 file-reference updates inside the plan doc — the actual migration SQL files haven't been written yet so no file moves).
- Update Branch 2 exit-gate migration-count reference (current: "00064 through 00073, with 00067 as the mid-branch grant fix" → new: "00064 through 00074, with 00067 as the mid-branch grant fix, and a mid-Branch-2 insertion of 00069 draw_adjustments from the Markgraf-scenario pivot").

---

## §2 R.18 blast-radius grep

Greps across `src/`, `supabase/migrations/`, `__tests__/`, `docs/`.

### Identifier summary

| Identifier | src/ hits | migrations | __tests__ | docs | Verdict |
|---|---|---|---|---|---|
| `draw_adjustments` / `draw_adjustment_line_items` | **0** | 0 | 0 | 0 (net-new) | **Clean net-new.** |
| `adjustment_type` / `adjustment_status` | 0 | 0 | 0 | 0 | Clean net-new. |
| `gp_impact_cents` / `correspondence_source` | 0 | 0 | 0 | 0 | Clean net-new. |
| `credit_goodwill` / `credit_defect` / `credit_error` / `customer_direct_pay` | 0 | 0 | 0 | 0 | Clean net-new enum values. |
| `withhold` (as column / enum value) | 0 hits | 1 narrative only (00031_phase8c_org_default_retainage: "doesn't withhold retainage on their cost-plus jobs") | 0 | 0 | Existing `withhold` usage is retainage-math narrative, different concept. Clean for Phase 2.5. |
| `correction` (as enum value) | 0 hits (generic English elsewhere) | 0 | 0 | 0 | Clean net-new. |
| `conditional` (as enum value) | **MANY hits** — see §2.1 collision flag | 0 (different concept) | 0 | 0 | **Name-collision risk with lien_releases.release_type ('conditional_progress','unconditional_progress','conditional_final','unconditional_final').** See §2.1. |
| `proposed` / `approved` / `applied_to_draw` / `resolved` / `voided` (status_enum) | `proposed`: many narrative; `approved`: many (across invoices, draws, COs); `applied_to_draw`: 0; `resolved`: some unrelated; `voided`: some CO/invoice statuses | — | — | — | Status CHECK-enum values are intentionally generic. No collision at DB level (CHECK is table-scoped). Flag for naming-hygiene only. |
| `source_document_id` (on draws) | 0 new | Pattern already used on `proposals.source_document_id` (bare UUID) per Phase 2.2 precedent | 0 | Phase 2.2 precedent | **Adopt Phase 2.2 precedent:** bare UUID, no FK until document_extractions table exists. |
| `adjustment` (generic, existing usage to catalog) | **1 HIT of interest** — `src/app/draws/new/page.tsx:1122` has an ad-hoc `<input placeholder="Reason for adjustment (required)">` that fires when a PM overrides a draw line's `this_period` amount in the wizard. §2.2 classifies this. | Existing `budget_lines.co_adjustments` (trigger-maintained cache of CO-driven budget adjustments — **different concept, don't conflate**) | 0 | Plan §1.7 / §1.8 / §3 use the term `co_adjustments` on budget_lines and "negative adjustment" for retainage math | §2.2 classification. |

### §2.1 Name-collision flag: `conditional` adjustment_type vs `conditional_*` lien release types

**`public.lien_releases.release_type`** CHECK enum includes `conditional_progress`, `unconditional_progress`, `conditional_final`, `unconditional_final` (migration 00031 / src/app/jobs/[id]/lien-releases/page.tsx:42-45 / src/app/draws/[id]/page.tsx:960-967).

**Phase 2.5 proposed `draw_adjustments.adjustment_type`** includes `conditional` (meaning: owner won't pay until specific condition met).

Same word, different semantic domain:
- Lien-release `conditional_*` = a *type of lien waiver document*.
- draw-adjustment `conditional` = a *type of billing hold*.

DB-level: no collision (different tables, different CHECK enums). Application-layer: if a UI label-map ever reuses a `badgeFor(status)` helper across both domains, the strings conflict. Flag for naming-hygiene mention in the migration header. Recommendation: keep the word (it's the right English term in both contexts) but add a `COMMENT ON COLUMN` clarifying semantics + a Phase 2.5 plan-doc note for future UI work.

### §2.2 Existing ad-hoc override pattern — `draws/new/page.tsx` wizard-override reason field

**Discovered pattern, not in the plan doc:**

`src/app/draws/new/page.tsx:440` has `setLineOverride(ccId, dollars, reason)` — when a PM types a `this_period` dollar value that differs from the wizard-computed amount, a second `<input placeholder="Reason for adjustment (required)">` renders (line 1117-1131). The reason is stored in component state as `overrideReasons[ccId]` and **only persisted in `draws.wizard_draft` JSONB** (line 465-466: `wizard_draft: { step, selected, overrides, overrideReasons, ... }`). It is not saved to any structured column on `draw_line_items` or `draws`.

**Status: ad-hoc, draft-only, free-text, no typing, no vendor link, no GP-impact, no approval workflow.**

**Implication for Phase 2.5:** the new `draw_adjustments` table is the proper structured replacement. Phase 2.5 does **not** migrate the existing override mechanism (no read paths, no write paths, no data migration). Branch 3/4's draw writers will eventually:
- Keep the wizard UI's override capability (PM adjusts a line),
- On save, convert the ad-hoc `overrideReasons` into structured `draw_adjustments` rows (type = `correction` or `credit_*` depending on the override delta's sign),
- Drop `wizard_draft.overrideReasons` from the schema.

Scoped OUT of Phase 2.5 — migration lands the table, Branch 3/4 wires the UI.

**Plan-doc note:** Part 2 §1.8 line 1873 currently lists `override_reason` as a draw_line_items column in the aspirational spec. The live DB (D3) shows no such column. The UI stashes reasons in `wizard_draft` JSONB today. Part 2 §1.8 should be reconciled when Branch 3/4 moves this into draw_adjustments. Flag for Branch 3/4 kickoff.

### §2.3 Classification

**Type A: PASSTHROUGH** — All zero application consumers of the new identifiers. Branch 3/4 lights up writers.

**Type B: WRITE PATHS** — None in Phase 2.5 scope.

**Type C: WORKFLOW INTEGRATION POINTS (future)** — `draws/new/page.tsx` wizard override (§2.2) will be rewired in Branch 3/4 to produce `draw_adjustments` rows on save.

**Type D: TS-UNION-VS-CHECK (Phase 2.1 / 2.3 precedent)** — No TS unions currently narrow to the adjustment_type or adjustment_status enums (zero src/ hits). When Branch 3/4 adds consumers, apply the `046a164` pattern.

**Type E: EXISTING AD-HOC PATTERN** — §2.2 override mechanism is an in-repo placeholder for the adjustment concept; out of Phase 2.5 scope but flagged for Branch 3/4 reconciliation.

---

## §3 Schema Validator probes (read-only)

### D1 — Draws count (live)

| Probe | Live | Incl. deleted |
|---|---|---|
| `public.draws` | **2** | 3 |
| `public.draw_line_items` | **4** | 16 |

Matches Phase 2.3 pre-flight's count of 2 live draws. `draw_line_items` has substantial soft-deleted churn (12 soft-deleted) — historical wizard-iteration artifacts, not a concern.

### D2 — Existing columns on `public.draws`

Key columns relevant to draw_adjustments:

| Column | Type | Notes |
|---|---|---|
| `id` / `job_id` / `draw_number` / `application_date` / `period_start` / `period_end` | — | standard |
| `status` | text (CHECK'd) | workflow state |
| `revision_number` | integer, default 0 | draw revisions |
| `parent_draw_id` | uuid, nullable, FK → draws(id) NO ACTION | draw revision linkage |
| `original_contract_sum`, `net_change_orders`, `contract_sum_to_date`, `total_completed_to_date`, `less_previous_payments`, `current_payment_due`, `balance_to_finish`, `deposit_amount`, `retainage_*`, `total_earned_less_retainage`, `less_previous_certificates` | bigint cents | G702 rollup fields |
| `status_history` | jsonb DEFAULT `'[]'` | R.7 |
| `approved_at`, `approved_by`, `locked_at`, `is_final` | — | lifecycle |
| `cover_letter_text`, `wizard_draft` | text / jsonb | **`wizard_draft` stashes the ad-hoc `overrideReasons` per §2.2** |
| `org_id`, `created_at`, `updated_at`, `created_by`, `deleted_at` | — | standard audit |

**No existing `adjustment` / `credit` / `withhold` / `goodwill` column** on `draws` or `draw_line_items`. Clean surface for the new table.

### D3 — Columns on `public.draw_line_items`

`id`, `draw_id`, `budget_line_id` (nullable), `previous_applications`, `this_period`, `total_to_date`, `percent_complete`, `balance_to_finish`, `org_id`, `created_at`, `updated_at`, `deleted_at`, `source_type`, `internal_billing_id`, `change_order_id`, `created_by`.

**Note:** no `override_reason` column. The plan-doc spec at line 1873 includes it; the live DB does not. §2.2 confirms the reason is stored in `draws.wizard_draft` JSONB only.

**No existing `adjustment` / `credit` column.** The new `draw_adjustments.draw_line_item_id` FK will be a net-new inbound reference. Current inbound FKs on `draw_line_items`: `internal_billings.draw_line_item_id` (ON DELETE SET NULL). Phase 2.5 adds 1 new inbound FK (draw_adjustments.draw_line_item_id, nullable, NO ACTION proposed).

**Also confirmed — existing `budget_lines.co_adjustments`** is the only table-level "adjustment"-named column in the schema. Different concept (trigger-maintained cache of CO-driven budget deltas). No conflict.

### D4 — RLS precedent conflict on draws / draw_line_items

**`public.draws` — 6 policies (older pattern, pre-proposals):**

| Policy | Cmd | Role scope | Predicate |
|---|---|---|---|
| `admin owner accounting write draws` | ALL | public (via user_role()) | `user_role() IN ('admin','owner','accounting')` |
| `draws_delete_strict` | DELETE | public | `org_id = user_org_id()` |
| `draws_platform_admin_read` | SELECT | public | `is_platform_admin()` |
| `org isolation` | ALL | public | `org_id = user_org_id() OR is_platform_admin()`, with_check `org_id = user_org_id()` |
| `owner admin accounting read draws` | SELECT | authenticated | `user_role() IN ('owner','admin','accounting')` |
| `pm read draws on own jobs` | SELECT | authenticated | `user_role() = 'pm' AND EXISTS (SELECT 1 FROM jobs j WHERE j.id = draws.job_id AND j.pm_id = auth.uid())` |

`draw_line_items` has the exact mirror structure (6 policies, with its own `pm read draw_line_items on own jobs` that goes through a draws join).

**`public.proposals` (00065, the R.23 most-recent tenant-table precedent) — 3 policies:**

| Policy | Cmd | Predicate |
|---|---|---|
| `proposals_org_read` | SELECT | `org_id IN (org_members ...)` OR `is_platform_admin()` |
| `proposals_org_insert` | INSERT | `org_id IN (org_members where role IN ('owner','admin','pm','accounting'))` |
| `proposals_org_update` | UPDATE | same as insert |

**The two precedents disagree on PM read scope:**

- Draws: PMs only see draws (and line items) for jobs they're assigned to.
- Proposals: any org_member can SELECT any proposal (no PM narrowing).

**R.23 says adopt most-recent precedent = proposals.** But that widens PM visibility relative to draws. See §5.C.1 open question.

### D5 — `document_extractions` existence

**DOES NOT EXIST.** Only `invoice_extractions` and `invoice_extraction_lines` are present (13 rows and 391 rows respectively). Confirms Phase 2.2 finding. Phase 2.5 uses **bare UUID** for `source_document_id` per the Phase 2.2 precedent (documented in the `proposals.source_document_id` column comment); FK wire-up deferred to the Branch 3 migration that renames `invoice_extractions` → `document_extractions` per the plan doc (line 3449-3461).

### D6 — Plan-doc existing adjustment/credit spec

Grep for `adjustment|draw_adjust` in `docs/nightwork-rebuild-plan.md`:

| Line | Context | Relevance |
|---|---|---|
| 800 | "Revised budget — budget + approved CO line adjustments" | budget concept, different |
| 871 | "unit_price … Rare — unit-rate adjustments" | pricing concept, different |
| 950-951 | `co_adjustments` column on budget_lines (cents, trigger-maintained) + `revised_estimate` generated | existing, different |
| 1127 | "For each CO line with a `budget_line_id`: that line's `co_adjustments` recomputes" | existing trigger flow |
| 1727-1728 | budget_lines schema — `co_adjustments` + `revised_estimate` | existing schema |
| 1873 | `draw_line_items.override_reason` | aspirational (not in live DB per D3) — §2.2 |
| 2175 | "budget_lines.co_adjustments recompute" | existing trigger flow |
| 3002 | "cached contract adjustment" | Phase 2.3 CO narrative |
| 4104 | "Approval adjusts revised contract + creates budget line adjustment" | Branch 3 language |

**No existing plan-doc spec for a `draw_adjustments` table or any draw-level adjustment/credit/withhold entity.** The `co_adjustments` references are all at the budget_line level (trigger-maintained) and address a different concern (tracking how COs change individual budget lines). Phase 2.5's `draw_adjustments` is orthogonal — draw-level adjustments that do NOT flow through budget_lines.

**Insertion point for new Part 2 §1.8a:** right after the `job_milestones` block at line 1879, before Lien Releases at line 1881. Draft text in §9 below.

---

## §4 Architecture-rules compliance

CLAUDE.md §Architecture Rules require: `id`, `created_at`, `updated_at`, `created_by`, `org_id`, `deleted_at`. Plan Part 2 §2.4 rule #4 requires `status_history` on workflow entities.

| Column | `draw_adjustments` (proposed) | `draw_adjustment_line_items` (proposed) |
|---|---|---|
| id | ✅ | ✅ |
| created_at | ✅ | ✅ |
| updated_at | ✅ (via trigger) | ⚠️ **flag** — Jake's scope lists only `created_at` per the proposal_line_items precedent. Proposal line_items has updated_at + trigger. Add for consistency. |
| created_by | ✅ | ✅ |
| org_id | ✅ | ✅ |
| deleted_at | ✅ | ✅ |
| status_history | ✅ — `adjustment_status` is a workflow state (`proposed` → `approved` → `applied_to_draw` → `resolved`; `proposed`/`approved` → `voided`). R.7 requires status_history JSONB. | N/A — join table, not a workflow entity. |

**Verdict:** fully compliant once `updated_at` + trigger are added to the join table (see §5.A amendment).

---

## §5 Schema proposal

### §5.A `public.draw_adjustments` — detailed draft

```sql
CREATE TABLE public.draw_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- tenant + draw
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  draw_id UUID NOT NULL REFERENCES public.draws(id),
    -- NO ACTION on delete (matches all 5 existing FKs pointing to draws;
    -- see §3 FK inventory). Soft-delete propagation handled at the
    -- application layer in Branch 3/4 writers. Flag §5.C.2.

  -- 1:1 common case; nullable for contract-sum-level adjustments (no
  -- specific line) or when N:N via the join table is used. Flag §5.C.3.
  draw_line_item_id UUID REFERENCES public.draw_line_items(id),

  -- taxonomy (see §5.B for the enum decision)
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN (
    'correction',
    'credit_goodwill',
    'credit_defect',
    'credit_error',
    'withhold',
    'customer_direct_pay',
    'conditional'
  )),

  -- workflow state
  adjustment_status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (adjustment_status IN (
      'proposed',
      'approved',
      'applied_to_draw',
      'resolved',
      'voided'
    )),

  -- cents, signed. Convention:
  --   Negative  = reduces amount owed by owner (credit, withhold,
  --               customer_direct_pay).
  --   Positive  = increases amount owed by owner (correction upward,
  --               contract-sum restoration).
  -- See §5.B sign convention note.
  amount_cents BIGINT NOT NULL,

  -- Positive = GP hit on RB (defect, goodwill). Negative = GP boost
  -- (rare: caught billing error that would have been RB's loss).
  -- NULL until categorized at approval time. Not derivable — judgment.
  gp_impact_cents BIGINT,

  reason TEXT NOT NULL,

  -- soft references (nullable; each captures a dimension the email thread
  -- actually discusses)
  affected_vendor_id UUID REFERENCES public.vendors(id),
  affected_invoice_id UUID REFERENCES public.invoices(id),
  affected_pcco_number TEXT,  -- "PCCO-86", "PCCO-87", etc. Separate from
                               -- FK until CO numbering reconciliation
                               -- (see §10 GH issue proposal).

  -- Phase 2.2 precedent — bare UUID, no FK until document_extractions
  -- table lands in Branch 3.
  source_document_id UUID,

  -- audit trail
  status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER trg_draw_adjustments_updated_at
BEFORE UPDATE ON public.draw_adjustments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

### §5.A.2 `public.draw_adjustment_line_items` — join table for rare N:N

```sql
CREATE TABLE public.draw_adjustment_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  adjustment_id UUID NOT NULL REFERENCES public.draw_adjustments(id)
    ON DELETE CASCADE,
  draw_line_item_id UUID NOT NULL REFERENCES public.draw_line_items(id),
  allocation_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),  -- flag: added per §4
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER trg_draw_adjustment_line_items_updated_at
BEFORE UPDATE ON public.draw_adjustment_line_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

**Scope flag on join table:** §6 walkthrough shows **zero** of the 9-11 Markgraf events need the N:N allocation. All are 1:1 via the nullable FK on the parent table. Ship the join table anyway (Jake's D1 design decision) but accept it's speculative. Surfaces Branch 3/4 dogfood question: "does anything actually trigger the N:N path?"

### §5.A.3 Indexes

```sql
-- Query patterns: "all adjustments on this draw," "pending approval across
-- org," "adjustments touching this line," "vendor/invoice back-references."
CREATE INDEX idx_draw_adjustments_draw
  ON public.draw_adjustments (org_id, draw_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_draw_adjustments_status
  ON public.draw_adjustments (org_id, adjustment_status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_draw_adjustments_line_item
  ON public.draw_adjustments (draw_line_item_id)
  WHERE draw_line_item_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_draw_adjustments_vendor
  ON public.draw_adjustments (affected_vendor_id)
  WHERE affected_vendor_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_draw_adjustments_invoice
  ON public.draw_adjustments (affected_invoice_id)
  WHERE affected_invoice_id IS NOT NULL AND deleted_at IS NULL;

-- Join-table indexes
CREATE INDEX idx_dali_adjustment
  ON public.draw_adjustment_line_items (adjustment_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_dali_draw_line_item
  ON public.draw_adjustment_line_items (draw_line_item_id)
  WHERE deleted_at IS NULL;
```

All partial with `deleted_at IS NULL` (consistent with 35+ existing partial-unique/index precedents per §3 / Phase 2.4 Amendment C).

### §5.A.4 RLS — proposed draft, contingent on §5.C.1 decision

**If Jake selects §5.C.1 option (a): proposals-pattern verbatim, R.23 aligned.**

```sql
ALTER TABLE public.draw_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY draw_adjustments_org_read
  ON public.draw_adjustments
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

CREATE POLICY draw_adjustments_org_insert
  ON public.draw_adjustments
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner','admin','pm','accounting')
    )
  );

CREATE POLICY draw_adjustments_org_update
  ON public.draw_adjustments
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner','admin','pm','accounting')
    )
  );
-- No DELETE policy (RLS blocks; soft-delete via deleted_at).
```

Role set matches Jake's §5 spec: `owner`, `admin`, `pm`, `accounting`. Rationale (for migration header comment per Jake's ask): "PMs propose adjustments (they catch credits in the field / during wizard builds); accounting approves or converts to applied; owner/admin ship the policy edits. Narrowing writes to owner/admin only (the approval_chains pattern) would block PMs from recording adjustments they discover — wrong scope for this table."

Join table `draw_adjustment_line_items` gets the same 3 policies (same role set, same qual shape).

**If Jake selects §5.C.1 option (b): proposals pattern + PM-on-own-jobs narrowing on read.**

Replace the read policy above with:

```sql
CREATE POLICY draw_adjustments_org_read
  ON public.draw_adjustments
  FOR SELECT
  USING (
    (
      org_id IN (
        SELECT org_id FROM public.org_members
        WHERE user_id = auth.uid() AND is_active = true
      )
      AND (
        app_private.user_role() IN ('owner','admin','accounting')
        OR (
          app_private.user_role() = 'pm'
          AND EXISTS (
            SELECT 1
            FROM public.draws d
            JOIN public.jobs j ON j.id = d.job_id
            WHERE d.id = draw_adjustments.draw_id
              AND j.pm_id = auth.uid()
          )
        )
      )
    )
    OR app_private.is_platform_admin()
  );
```

Adds the EXISTS subquery on draws+jobs to match the existing `pm read draws on own jobs` behavior exactly. Preserves information parity: if a PM can't see the draw, they can't see its adjustments.

**If Jake selects §5.C.1 option (c): adopt the older 6-policy draws pattern verbatim.** Produces the 6 policies mirroring draws. Documented R.23 divergence (older in-family precedent over newer proposals precedent). Rationale would be: "in-family consistency outweighs R.23 newness." Most intrusive — adds 3 extra policies and forks the Branch 2 trajectory from 00065's 3-policy shape.

**Recommendation:** (b). Matches the draws visibility rule that's actually in production, adopts the newer proposals structure (3 policies, no DELETE), and the extra `EXISTS` is already a well-worn pattern in the draws RLS so there's no new invention. R.23 is "adopt most-recent tenant-table migration's shape" which applies to the policy count + DELETE posture + auth function choice — a predicate-level narrowing within a read policy is not a pattern-shape divergence. This is the surgically-correct answer to the tension.

### §5.A.5 status_history contract

Per R.7 (plan line 61): `{from, to, actor_user_id, at, reason?, comment?}` appended on every status change. Application-layer responsibility (matches proposals / invoices / change_orders). Migration only creates the column + DEFAULT `'[]'`.

### §5.A.6 Status workflow (explicit)

```
   ┌─────────────┐
   │  proposed   │ (new row; PM or accounting creates)
   └─────┬───────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐  ┌──────────┐
│approved│  │  voided  │ (abandoned pre-approval)
└────┬───┘  └──────────┘
     │
     ├──────────────┐
     ▼              ▼
┌──────────────┐ ┌──────────┐
│applied_to_   │ │  voided  │ (retracted post-approval,
│   draw       │ │          │  pre-apply)
└──────┬───────┘ └──────────┘
       │
       ▼
┌──────────┐
│ resolved │ (draw closed; adjustment finalized)
└──────────┘
```

Terminal states: `resolved` and `voided`. No re-entry from terminal states (matches proposals and draws lifecycle patterns).

### §5.B `adjustment_type` — 7-value flat enum vs 5+subtype

**Option 1 (Jake's proposal, 7-value flat):**
```
adjustment_type IN (
  'correction',
  'credit_goodwill','credit_defect','credit_error',
  'withhold','customer_direct_pay','conditional'
)
```
- Pro: single CHECK, no nullable subtype, easy `WHERE adjustment_type LIKE 'credit_%'` for all credits.
- Con: expanding credit subtypes later is a CHECK-constraint migration (low cost).

**Option 2 (alternative, 5+subtype):**
```
adjustment_type IN ('correction','credit','withhold','customer_direct_pay','conditional')
credit_subtype TEXT CHECK (
  credit_subtype IN ('goodwill','defect','error')
  OR credit_subtype IS NULL
)
-- Plus a CHECK that credit_subtype IS NOT NULL WHEN adjustment_type = 'credit'
```
- Pro: richer dimensional model (type + subtype separable for analytics).
- Con: extra nullable column, extra CHECK coordination, "all credits" query still easy but "all defect-like events" query spans a combined predicate.

**Recommendation:** Option 1. The credit subtypes are semantically close enough that flattening doesn't lose information, and the Markgraf walkthrough (§6) shows the 7 leaf values are what the real classification maps to directly. Flag for Jake's decision.

### §5.B.2 amount_cents sign convention

Proposed convention (documented in migration header + `COMMENT ON COLUMN`):

| Type | Typical amount_cents sign | Example |
|---|---|---|
| `correction` | Either (depends on error direction) | Contract-sum typo reducing from $3,714,193.61 → $3,711,293.61 = -$290,000 cents (reduction); line 03112 $400 upward = +40,000 cents |
| `credit_*` | Negative (reduces amount owed) | Real Woods door credit = -$1,230,500 cents |
| `withhold` | Negative (temporarily reduces) | Doudney $675 withhold = -$67,500 cents |
| `customer_direct_pay` | Negative (owner already paid vendor) | Turf line = -$677,500 + any remaining |
| `conditional` | Typically 0 OR negative | Pre-resolution: 0 (placeholder). Post-resolution: whatever credit/correction lands. |

### §5.C Open questions for Jake (top-3 in §1 plus additional)

**§5.C.1 RLS shape — PM visibility question.** See §5.A.4. Three options (a/b/c). Recommendation: (b).

**§5.C.2 draws soft-delete cascade behavior.** Not a DB FK cascade (deleted_at updates don't fire FK actions). The question: when a draw is soft-deleted via application code, should all its `draw_adjustments` also get `deleted_at` set in the same transaction? Proposal: YES, handled by the draw-soft-delete RPC (same transaction as the draws update). Not a migration-file concern — just a documented invariant. Flag for Branch 3/4 writer implementation.

**§5.C.3 `amount_cents NULL` for placeholder-only adjustments.** See §1 flag 2. Three options (i/ii/iii). Recommendation: (i) `amount_cents = 0` with reason explaining "amount TBD." Keeps NOT NULL semantic clean; avoids adding a nullable dimension. Flag for decision.

**§5.C.4 `adjustment_type` flat vs subtype.** See §5.B. Two options. Recommendation: 7-value flat. Flag for decision.

**§5.C.5 Join-table inclusion vs defer.** §6 walkthrough shows 0 Markgraf events need the N:N shape. Ship join table now (D1 decision) OR defer to Branch 3/4 when dogfood confirms need. Recommendation: ship now per D1 (cheap to include; guarantees the shape is available when the first real N:N case lands). Flag for decision.

---

## §6 Markgraf scenario walkthrough

Working from the 2026-04-14 email thread. The email surfaces **10 concrete $-valued adjustment events + 1 ambiguous $95 item + 2 no-$ correspondence items** (total 11-13 depending on what qualifies; Jake's "9" is the central subset of clearly-typed concrete events).

Modeling each as a `draw_adjustments` row. Omitting `id`, `org_id`, `created_at`, `created_by`, `status_history`, `deleted_at` columns (standard); omitting `draw_adjustment_line_items` entirely (zero usage).

| # | Event | `adjustment_type` | `adjustment_status` | `amount_cents` | `gp_impact_cents` | `draw_line_item_id` | `affected_vendor_id` | `affected_invoice_id` | `affected_pcco_number` | `reason` |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Original Contract Sum typo corrected $3,714,193.61 → $3,711,293.61 | `correction` | `resolved` | `-290000` (-$2,900) | NULL (pass-through accounting correction) | NULL (contract-sum level, not a specific line) | NULL | NULL | NULL | "Original Contract Sum had $3,714,193.61 on pay apps 1-N; actual contract is $3,711,293.61. Corrected." |
| 2 | Line 03112 math discrepancy — $400 short | `correction` | `resolved` | `+40000` (+$400) OR normalized to line math | NULL | Line 03112's draw_line_item_id | NULL | NULL | NULL | "Diane highlighted $1,059.88 invoiced on line 03112; architect reconciled totals." |
| 3 | Line 11101 Real Woods door — no shop drawing; $12,305 credit | `conditional` **→ transitions to** `credit_defect` at current state | `applied_to_draw` | `-1230500` (-$12,305) | `1230500` (+$12,305 GP hit — RB eats the cost) | Line 11101's draw_line_item_id | Real Woods | Invoice #69953 | NULL | "Door installed without owner-approved shop drawing; owner conditionally refused pay. RB provided credit on revised pay app." |
| 4 | Line 26103 DB Welding pool brackets (ordered, never used) | `credit_defect` | `applied_to_draw` | `-33550` (-$335.50) | `33550` (+GP hit) | Line 26103's draw_line_item_id | DB Welding | Invoice #0064.ADD.26 | NULL | "Aluminum brackets ordered for pool decking were never used; pool decking not installed per engineered drawings. Credited." |
| 5 | Line 27102 Doudney brake metal seams | `withhold` | `approved` (pending completion) | `-67500` (-$675) | NULL (pass-through; pays vendor once complete) | Line 27102's draw_line_item_id | Doudney Sheet Metal Works | NULL (invoice not cited in email) | NULL | "Brake metal seams visible in several areas; no payment until work completed without seams." |
| 6 | Line 27102 Derosia aluminum reinstall | `withhold` | `approved` (pending) | `-120000` (-$1,200) | `120000` (+GP hit — "Ross Built will be covering to have these redone" implies RB absorbs cost) | Line 27102's draw_line_item_id | Derosia's Custom Builders | NULL | NULL | "Aluminum installation at sliding doors + windows has seams; RB covering redo. Withhold pending completion." |
| 7 | Line 34101 math correction ($34.60 first revision + $7,865.57 / $7,855.07 / $1,711.77 arithmetic reconciliation) | `correction` | `resolved` | `-3460` (-$34.60) OR normalized to the reconciled delta | NULL | Line 34101's draw_line_item_id | NULL | NULL | NULL | "Line 34101 correction: March 31 revision reduced by $34.60; April 14 architect reconciliation confirmed amount after discussion of 34101 vs 34104 coding." |
| 8 | Line 36101 / PCCO-86 turf — owner direct-paid; RB deposit absorbed | `customer_direct_pay` | `applied_to_draw` | Full turf line amount reduction (exact $ not stated; $6,775 RB deposit is one component) | `677500` (+$6,775 GP hit — RB ate the deposit) | Line 36101's draw_line_item_id | (turf vendor — not named in email) | NULL | `'PCCO-86'` | "Owner paid turf balance directly; RB paid $6,775 deposit. Remove turf from draw; credit given." |
| 9 | PCCO-74 Prime Glass bar shelves — $960 credit | `credit_defect` | `applied_to_draw` | `-96000` (-$960) | `96000` (+GP hit) | NULL (tied to PCCO, not a specific line) | Prime Glass | Invoice #16491 | `'PCCO-74'` | "Owners refused to pay for remaking bar shelves; credit given." |
| 10 | PCCO-87 Rangel limestone cleaning — $2,350 credit (second attempt) | `credit_defect` | `applied_to_draw` | `-235000` (-$2,350) | `235000` (+GP hit) | NULL (PCCO-scoped) | Rangel Custom Tile | NULL (two invoices 11/20/25 + 03/20/26, not modeled as FK) | `'PCCO-87'` | "Limestone first cleaned incorrectly; owners refused enhancement-sealer cost on re-clean. RB credited first cleaning; second required the redo." |
| 11 | PCCO-88 DB Welding double-charge of $95 | `credit_error` (if credit applied) OR `correction` (if coding clarification only) | `resolved` | `-9500` (-$95) OR 0 pending clarification | `0` or NULL | NULL (PCCO-scoped) | DB Welding | Invoice #0064.ADD.26 | `'PCCO-88'` | "Invoice #0064.ADD.26 flagged CO51 internal-numbering (Buildertrend); AIA PCCO is 88. Owner flagged as double-charge; likely internal coding confusion — $95 disputed." |
| — | Line 19101 garage/laundry patches — clarification only, no $ | `conditional` if tracked, amount_cents=0 | `proposed` → `resolved` after clarification delivered | 0 | NULL | Line 19101's draw_line_item_id | NULL | NULL | NULL | "Architect requested clarification of stucco repairs / garage ceiling patches / drywall reasons. Diane explained: fan relocation, cabinet-change lights move. Resolved with explanation." |
| — | Trapezoidal shade wires visible — no $ yet, discussion pending | `conditional`, amount_cents=0 | `proposed` | 0 | NULL | (not identified to a line yet) | NULL | NULL | NULL | "Shade wires/cables visible, not disclosed in specs. Discussion pending with owner; potential credit or remediation." |

**Walkthrough verdict: schema absorbs all 13 events cleanly.**

- 0 events require the N:N join table (all are 1:1 via the nullable `draw_line_item_id` FK).
- 2 events (#1, #8) legitimately use NULL for `draw_line_item_id` (contract-sum level, PCCO-scoped).
- 3 events (#9, #10, #11) are PCCO-scoped without specific line attribution — `affected_pcco_number` string captures the CO; `draw_line_item_id` is NULL.
- 2 events (Line 19101, trapezoidal shades) are placeholder-only with `amount_cents = 0` per §5.C.3 recommendation (i).
- Event #3 (Real Woods door) shows the `conditional → credit_defect` transition in real data — owner conditions refused, RB converted to a defect credit. status_history captures the transition.
- All 13 events have a clear `reason` field; all have an identifiable human explanation.
- Event #11 (PCCO-88 double-charge) is the only ambiguous typing case — could be `credit_error` or `correction` depending on whether a $95 was actually credited or just a coding clarification was given. Flag for Branch 3/4 QA: when a dispute resolves with "no $ change, just explanation," model as `correction` with `amount_cents = 0`.

**Note on sign convention verified in §6:** 9 of 11 $-valued events have `amount_cents < 0` (credits, withholds, customer direct pays). 1 event (#2) has `amount_cents > 0` (upward correction). 1 event (#1) is negative (downward correction). The sign table in §5.B.2 matches.

---

## §7 R.21 teardown + R.19 posture

**R.19 carve-out expected to apply.** Both conditions citable at QA time:

- **(a) No runtime code path touched.** §2 grep confirmed 0 src/ references. §2.2's ad-hoc override pattern stays in place (Branch 3/4 rewires later).
- **(b) Migration Dry-Run exercises the full DB stack** at the database layer (structural probes + negative probes for CHECK violations + workflow transitions via direct INSERT/UPDATE).

No live manual test required for Phase 2.5 (schema-only phase). Optional validation at QA time: call `GET /api/draws/[id]` on an existing draw, confirm zero regression (the new table is invisible until a Branch 3 writer populates it).

**R.21 teardown plan.**

Dry-Run fixtures only, all inside `BEGIN/ROLLBACK` transactions:

```
Fixtures (R.21 prefix; Dry-Run only, never committed):
  ZZZ_PHASE_2_5_TEST_ADJ_A        (draw_adjustments, type=correction)
  ZZZ_PHASE_2_5_TEST_ADJ_B        (draw_adjustments, type=credit_defect)
  ZZZ_PHASE_2_5_TEST_ADJ_C        (draw_adjustments, type=withhold)
  ZZZ_PHASE_2_5_TEST_DALI_A       (draw_adjustment_line_items — N:N probe)

Teardown:
  — none needed; all fixtures inside BEGIN/ROLLBACK transaction.
  VERIFY post-rollback: draw_adjustments count = 0; draw_adjustment_line_items count = 0.
```

Post-apply verification (no committed fixtures): the live 2 draws + 4 draw_line_items remain untouched. No rows inserted. No production-shape data.

---

## §8 Subagent strategy

| Subagent | Applies? | Scope |
|---|---|---|
| **Schema Validator** | ✅ | Verify post-Dry-Run: 2 new tables; 7 indexes (5 on parent, 2 on join); 2 updated_at triggers; RLS enabled on both tables; 3 policies per table (if §5.C.1 option a or b) or 6 policies per table (if option c); no DELETE policy; CHECK constraints fire on invalid `adjustment_type` / `adjustment_status` values. Confirm `draw_adjustments.draw_id` FK is NO ACTION (matches 4/5 existing FKs to draws) and `draw_adjustments.draw_line_item_id` FK is nullable. |
| **Migration Dry-Run** | ✅ | BEGIN/ROLLBACK on dev. Structural probes (columns, indexes, triggers, policies); negative probes (invalid enum CHECK, missing NOT NULL, insert with wrong org_id → RLS rejection); positive probes (all 7 adjustment_type values accepted; status transitions proposed → approved → applied_to_draw → resolved work via UPDATE; voided from proposed OR approved). Live-auth RLS probe using a PM-role JWT to validate §5.C.1 decision (whichever option lands). |
| **Grep/Rename Validator** | ⚠️ **Skippable** | No renames. Additive 2 new tables + 2 triggers + 7 indexes + 3-6 RLS policies. §2 blast-radius grep is sufficient. |
| **R.23 precedent check** | ✅ | Adopt 00065 proposals as most-recent tenant-table. Document §5.C.1 choice as precedent-match (option a) or surgical-narrowing (option b) or in-family-divergence (option c). QA report must state the precedent choice explicitly. |

**Subagent additions beyond this list:** none. Flagging per the kickoff subagent-additions rule — no new subagent is proposed.

---

## §9 Part 2 plan-doc insertion draft (for review, not yet applied)

Insert the following block in `docs/nightwork-rebuild-plan.md` at line 1879 (after `job_milestones`, before the `### Lien releases` header at line 1881):

```markdown
### Draw adjustments

Structured first-class entity for tracking every non-line-item mutation to a
draw: corrections, credits (goodwill / defect / error), withholds, customer
direct-pays, and conditional holds. Surfaced by the 2026-04-14 Markgraf
substantial-completion email thread, which showed 9-11 distinct events on a
single draw that had no clean entity to track. Branch 2 Phase 2.5 adds the
schema; Branch 3 writers populate from the existing draws/new wizard (which
currently stashes ad-hoc override reasons in draws.wizard_draft JSONB);
Branch 4 dogfood on Ross Built data validates the taxonomy.

```
draw_adjustments
  id, org_id, draw_id, draw_line_item_id (nullable — NULL = contract-sum
    or PCCO-scoped),
  adjustment_type CHECK IN (
    'correction',
    'credit_goodwill','credit_defect','credit_error',
    'withhold',
    'customer_direct_pay',
    'conditional'
  ),
  adjustment_status CHECK IN (
    'proposed','approved','applied_to_draw','resolved','voided'
  ),
  amount_cents BIGINT NOT NULL (signed; negative reduces amount owed by
    owner; positive increases),
  gp_impact_cents BIGINT NULLABLE (stored at approval time when a human
    categorizes defect vs pass-through; positive = GP hit on RB),
  reason TEXT NOT NULL,
  affected_vendor_id (FK vendors, nullable),
  affected_invoice_id (FK invoices, nullable),
  affected_pcco_number TEXT (nullable — "PCCO-86" etc; see Branch 3 GH
    issue for CO-numbering reconciliation),
  source_document_id UUID (bare — FK wire-up deferred to
    document_extractions / Branch 3, Phase 2.2 precedent),
  status_history JSONB DEFAULT '[]',
  created_at, updated_at, created_by, deleted_at

draw_adjustment_line_items (join table for rare N:N allocations)
  id, org_id, adjustment_id (FK, ON DELETE CASCADE),
  draw_line_item_id (FK), allocation_cents BIGINT NOT NULL,
  created_at, updated_at, created_by, deleted_at
```

G702/G703 rendering note: `draw_adjustments` render in a dedicated
"Adjustments & Credits" section on the draw doc, NOT silently applied to
`draw_line_items.this_period`. Final current-payment-due math = line-item
total minus adjustments section. Preserves AIA auditability (D2 decision).
```

Insert the following new Phase 2.5 spec at line 3240 (replaces the current Phase 2.5 approval_chains content from commit `317961d`; approval_chains spec body moves verbatim to new Phase 2.6 location):

```markdown
### Phase 2.5 — Draw adjustments

**Plan-doc amendment history:**

- Pre-flight (2026-04-22): Phase 2.5 scope reassigned from approval_chains to draw_adjustments after the 2026-04-14 Markgraf substantial-completion email surfaced 9+ distinct adjustment events on one draw with no clean entity to track. See `qa-reports/preflight-branch2-phase2.5.md`.
- Design decisions (locked at kickoff, see preflight §5):
  - **D1 Hybrid shape** — `draw_adjustments.draw_line_item_id` nullable FK for the common 1:1 case; optional `draw_adjustment_line_items` join table for rare N:N.
  - **D2 Adjustments alongside** — render in a dedicated "Adjustments & Credits" section on the draw doc; don't silently modify `draw_line_items.this_period`. Preserves AIA G702/G703 auditability.
  - **D3 GP impact stored** — `gp_impact_cents` set at approval time by a human categorizer; not computed (defect-vs-goodwill is judgment).
  - **D4 Source document** — bare UUID per Phase 2.2 precedent (document_extractions table doesn't exist yet; FK wire-up deferred to Branch 3).

[Full Phase 2.5 spec body shipped in the docs(plan) commit — schema (§5.A draft + RLS decision from §5.C.1), indexes, test coverage (§R.15 including live-auth RLS probes + GRANT probes), down.sql outline, R.23 precedent statement, commit line.]

**Commit:** `feat(adjustments): add draw_adjustments + join table`
```

---

## §10 Renumber plan

Current state (pre-pivot):

| Phase | Migration | Topic |
|---|---|---|
| 2.5 | 00069 | approval_chains |
| 2.6 | 00070 | job milestones + retainage config |
| 2.7 | 00071 | pricing history table |
| 2.8 | 00072 | client portal access |
| 2.9 | 00073 | V2.0 schema hooks (empty tables) |

Post-pivot state:

| Phase | Migration | Topic |
|---|---|---|
| **2.5** (new) | **00069** | **draw_adjustments** ← **inserted** |
| 2.6 | 00070 | approval_chains ← shifted +1 |
| 2.7 | 00071 | job milestones + retainage config ← shifted +1 |
| 2.8 | 00072 | pricing history table ← shifted +1 |
| 2.9 | 00073 | client portal access ← shifted +1 |
| 2.10 (new) | 00074 | V2.0 schema hooks (empty tables) ← shifted +1 |

Renumber precedent: identical pattern to the 00067 grant-fix mid-branch renumber that landed in `ddf4063` (Phase 2.4 kickoff). Plan-doc edit locations (grep for accuracy; these are starting points):

- `### Phase 2.5 — Approval chains` → rename to `### Phase 2.6 — Approval chains`; migration refs `00069_approval_chains.sql` → `00070_approval_chains.sql`; `.down.sql` rename; all internal-reference GH #12 comment references intact (GH #12 is orthogonal to the renumber).
- `### Phase 2.6 — Job milestones + retainage config` → `### Phase 2.7 — ...`; migration `00070_milestones_retainage.sql` → `00071_...`.
- `### Phase 2.7 — Pricing history table` → `### Phase 2.8 — ...`; migration `00071_...` → `00072_...`.
- `### Phase 2.8 — Client portal access` → `### Phase 2.9 — ...`; migration `00072_...` → `00073_...`.
- `### Phase 2.9 — V2.0 schema hooks (empty tables)` → `### Phase 2.10 — ...`; migration `00073_...` → `00074_...`.
- Branch 2 exit-gate checklist reference (plan-doc search for "00064 through 00073"): update to "00064 through 00074, with 00067 as the mid-branch grant fix and 00069 as the mid-Branch-2 draw_adjustments insertion from the Markgraf-scenario pivot." (2 hits expected: the original plan-gate line + the Phase 2.4 QA report reference; QA reports in qa-reports/ are historical and do NOT get retro-edited.)
- Phase 2.4 pre-flight (`qa-reports/preflight-branch2-phase2.4.md`) + Phase 2.4 QA report (`qa-reports/qa-branch2-phase2.4.md`) reference "Phase 2.5" in forward-looking sections (e.g., "Scope additions surfaced in pre-flight …"). These are **historical paper trail per R.16 + R.12** — do NOT retro-edit. The Phase 2.5 approval_chains pre-flight at commit `f296e0a` stays in history describing the approval_chains work; the new Phase 2.5 draw_adjustments pre-flight replaces the same filename on main going forward.

---

## §11 Recommended next step

**AMEND PLAN FIRST** per the pattern established by Phase 2.2 (`4fd3e7d`), Phase 2.3 (`c6b468d`), Phase 2.4 (`95df1b4`), and Phase 2.5-approval-chains (`317961d`). Suggested sequence:

1. **Jake decides §5.C.1–§5.C.5** (5 open questions; #1 is the highest-stakes). Recommendations: C.1=(b), C.2=document invariant, C.3=(i), C.4=flat 7-value, C.5=ship join table per D1.
2. **Jake accepts the Markgraf walkthrough §6** (or flags any events that don't fit cleanly).
3. **Jake decides whether to open a GH issue for CO numbering reconciliation** (Branch 3 scope; `affected_pcco_number TEXT` is the bridge). Proposal body:
   > **Title:** `CO numbering reconciliation — Buildertrend CO51 vs AIA PCCO-88 (and the general class of "internal CO number ≠ AIA PCCO number")`
   > **Body:** Markgraf 2026-04-14 email thread revealed DB Welding invoice #0064.ADD.26 cites "CO51" (Buildertrend internal CO number from Jeff's labeling for accounting) but the AIA PCCO log shows the same work as PCCO-88. This caused a $95 disputed-double-charge flag from the owner. Phase 2.5 `draw_adjustments.affected_pcco_number TEXT` is the bridge column until CO numbering reconciliation lands in Branch 3. Scope: decide whether CO numbering is reconciled at intake (vendor writes a PCCO number; we refuse invoices that reference a Buildertrend-internal CO), or at display (we maintain a mapping table `co_numbering_aliases`), or at migration (Buildertrend ingest script writes PCCO numbers). Affects vendors, invoices, change_orders, draw_adjustments.
4. **Docs(plan) commit** lands (single atomic commit):
   - Part 2 §1.8a insertion (§9 above).
   - Phase 2.5 new spec body (draw_adjustments; §9 above).
   - Phase 2.5 ↔ 2.6 ↔ 2.7 ↔ 2.8 ↔ 2.9 ↔ 2.10 renumber across 5 section headers + 5 migration filenames + Branch 2 exit-gate migration-count sentence.
   - GH issue number captured (if opened).
   - Reference the preflight at `qa-reports/preflight-branch2-phase2.5.md`.
   Commit message: `docs(plan): Phase 2.5 scope pivot — draw_adjustments (was approval_chains) + renumber 2.5-2.9 → 2.6-2.10 per Markgraf scenario`
5. **Docs(qa) commit** lands this preflight (separate commit per Phase 2.3 / 2.4 paper-trail pattern).
6. **Execute Phase 2.5** — write `00069_draw_adjustments.sql` + `.down.sql` per amended plan, R.15 test file, Dry-Run probes, apply, commit, push, produce `qa-reports/qa-branch2-phase2.5.md`.

**Do-not list:**

- Do not write `00069_draw_adjustments.sql` until §5.C questions are decided and the docs(plan) commit lands.
- Do not run Migration Dry-Run yet.
- Do not modify any src/ files (0 blast radius in Phase 2.5; Branch 3/4 wires consumers).
- Do not touch `draws.wizard_draft`, `draws/new/page.tsx`, or any draw-writer path — §2.2 ad-hoc pattern stays in place until Branch 3/4.
- Do not retro-edit historical QA reports (Phase 2.4 paper trail stays frozen per R.12 + R.16).
- Do not commit. Do not push.

**Tracked open issues check:**

- **GH #12** (default approval_chains stages) — adjacent, unchanged. approval_chains moves to Phase 2.6 in the renumber; GH #12 scope (onboarding-wizard overrides for default stages) still applies to the renumbered 2.6.
- **GH #1–#11** — no direct overlap with draw_adjustments.
- **New (proposed)** — CO numbering reconciliation tracker (GH #13 if opened per step 3 above).
