# Pre-flight Findings — Branch 2 Phase 2.6: Approval chains

**Date:** 2026-04-22
**Migration target:** `supabase/migrations/00070_approval_chains.sql` (+ `.down.sql`)
**Origin HEAD at kickoff:** `3523533` (clean working tree)
**Mode:** PRE-FLIGHT ONLY — no migration written, no SQL applied, no Dry-Run, no plan amendment.
**Prior pre-flight (when phase was numbered 2.5 / migration 00069 / pre-Markgraf-pivot):** commit `f296e0a` → `qa-reports/preflight-branch2-phase2.5.md` at that SHA. Filename was reused for the draw_adjustments pre-flight after the pivot.

---

## §1 Executive summary

**Verdict: EXECUTE-AS-IS.** The Phase 2.6 spec at `docs/nightwork-rebuild-plan.md:3665–3907` is the post-amendment, post-renumber version of the original approval_chains plan. All 8 amendments + the F-ii scope decision landed in commit `317961d` and were preserved through the Markgraf-pivot renumber in `73eaba8`. The Part 3 §3.7 runtime-flow sync from F-ii landed separately in `d11523a`. No new collisions surfaced. No new design questions need Jake's input. R.19 static-validation carve-out is expected to apply at execution time (schema-only phase, zero runtime code touched — Branch 7 introduces write paths).

**Top flags (1):**

1. **GH #12 issue body wording is stale post-pivot.** Body still reads "Phase 2.5 migration 00069 seeds default approval_chains per org…" — the seeding now lands in Phase 2.6 / migration 00070. Cosmetic; does not block execution. Recommendation: update issue body to reference Phase 2.6 / 00070 either before or after the Phase 2.6 commit lands. No other GH-tracked items affected (GH #1–#14 audited, only #12 has approval_chains language).

**Scope is intentionally lighter than Phase 2.5's pre-flight at `053f647`:** that report was a fresh planning surface (D1–D4 design decisions + 5 open questions + RLS precedent tension + Markgraf walkthrough) because draw_adjustments was being scoped from scratch under time pressure. This report is a re-verification + delta check against an already-amended spec — most of the reasoning was done in the original f296e0a pre-flight and the eight amendments derived from it.

---

## §2 Migration number + filename verification

### §2.1 Slot availability

`ls supabase/migrations/ | tail` confirms:

| File | Status |
|---|---|
| `00067_co_cache_trigger_authenticated_grants.sql` + `.down.sql` | applied |
| `00068_cost_codes_hierarchy.sql` + `.down.sql` | applied |
| `00069_draw_adjustments.sql` + `.down.sql` | applied (Phase 2.5) |
| `00070_*` | **next free slot** ✅ |

Phase 2.6 spec consistently targets `00070`. No leftover `00069` references in the spec body (verified by `grep -n "00069\|Phase 2\.5" docs/nightwork-rebuild-plan.md` — every `00069` hit lands inside Phase 2.5 / draw_adjustments scope or in the documented amendment-history paragraphs, never in Phase 2.6 SQL or test text).

### §2.2 In-spec filename references

Five filename references inside the Phase 2.6 spec body (lines 3665–3907):

| Line | Reference | Verdict |
|---|---|---|
| 3683 | ` Migration `00070_approval_chains.sql`:` | ✅ |
| 3686 | `-- Phase 2.6 — Approval chains (migration 00070).` | ✅ |
| 3879 | `Also write `00070_approval_chains.down.sql` per R.16…` | ✅ |
| 3885 | ``Migration `00070_approval_chains.sql` + `.down.sql` exist.`` | ✅ |
| 3907 | ``Commit:` `feat(approvals): add approval_chains + seed-on-org-creation trigger`` | ✅ (verb tense correct) |

### §2.3 "Phase 2.5" references inside Phase 2.6 spec body

Every `Phase 2.5` token at lines 3665–3907 lands inside one of the documented amendment-history / precedent-citation paragraphs:

- Line 3669 — pre-flight history (cites pre-pivot numbering)
- Line 3680 H.2/H.3 — cites Phase 2.4 Amendment F.1/F.2 precedent (correct as Phase 2.4)
- Line 3881 — cites Phase 2.1 / 2.3 TS-union precedent (correct)
- Line 3895 — cites Phase 2.4 Amendment F.1 mirror (correct)
- Line 3896 — cites Phase 2.4 Amendment F.2 pattern (correct)

No edits required.

### §2.4 Plan exit-gate update

`docs/nightwork-rebuild-plan.md:4049` reads "All 11 migrations (00064 through 00074, with 00067 as the mid-branch grant fix and 00069 as the mid-Branch-2 draw_adjustments insertion from the Markgraf-scenario pivot)". Phase 2.6 lands as 00070 inside that range. No exit-gate edit required for Phase 2.6 itself.

---

## §3 Precedent re-check (R.23)

For each precedent the spec cites, verify the precedent table still exists at the cited shape and no later migration overrode it.

### §3.1 — 00065 `proposals` 3-policy RLS shape

`supabase/migrations/00065_proposals.sql` lines 156–185:

```
CREATE POLICY proposals_org_read       ON public.proposals FOR SELECT  …  -- any org member + platform admin
CREATE POLICY proposals_org_insert     ON public.proposals FOR INSERT  …  AND role IN ('owner','admin','pm','accounting')
CREATE POLICY proposals_org_update     ON public.proposals FOR UPDATE  …  AND role IN ('owner','admin','pm','accounting')
-- No DELETE policy.
```

3-policy shape confirmed. Write role-set is `(owner, admin, pm, accounting)`. Phase 2.6 spec (lines 3783–3815) adopts the 3-policy shape verbatim and **narrows the write role-set to `(owner, admin)`** — the documented R.23 divergence (Amendment B). Divergence is recorded in:

- Migration header (lines 3692–3695)
- Plan amendment block (line 3672)
- R.23 precedent statement (line 3905)
- Table COMMENT (line 3870)

Verified: no later migration replaced or modified the proposals RLS shape (`grep "POLICY proposals_org_" supabase/migrations/0007*.sql` returns no hits).

### §3.2 — 00032 `create_default_workflow_settings` seed-trigger shape

`supabase/migrations/00032_phase8e_org_workflow_settings.sql` lines 101–115:

```
CREATE OR REPLACE FUNCTION public.create_default_workflow_settings()
…
ON CONFLICT (org_id) DO NOTHING;
…
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER trg_organizations_create_workflow_settings
  …
  FOR EACH ROW EXECUTE FUNCTION public.create_default_workflow_settings();
```

Pattern confirmed: `public` schema, `SECURITY DEFINER`, pinned `search_path = public, pg_temp`, `ON CONFLICT … DO NOTHING`, `AFTER INSERT` trigger on `public.organizations`.

Phase 2.6 spec (lines 3819–3851) mirrors this verbatim for `create_default_approval_chains()` + `trg_organizations_create_default_approval_chains`. Confirmed.

### §3.3 — 00067 `GRANT EXECUTE … TO authenticated` pattern

`supabase/migrations/00067_co_cache_trigger_authenticated_grants.sql` (entire file) establishes the explicit grant pattern: `GRANT EXECUTE ON FUNCTION app_private.X() TO authenticated;` per function, plus `ALTER DEFAULT PRIVILEGES IN SCHEMA app_private GRANT EXECUTE ON FUNCTIONS TO authenticated`.

Phase 2.6 spec applies the per-function grant to **both** new functions:

- Line 3742–3743: `GRANT EXECUTE ON FUNCTION public.default_stages_for_workflow_type(text) TO authenticated;`
- Line 3846–3847: `GRANT EXECUTE ON FUNCTION public.create_default_approval_chains() TO authenticated;`

Confirmed. Note: Phase 2.6 functions live in `public` schema, so the `ALTER DEFAULT PRIVILEGES` clause from 00067 (scoped to `app_private`) is not relevant. Per-function grants are sufficient.

### §3.4 — 00068 `has_function_privilege` test pattern (Phase 2.4 Amendment F.1/F.2)

`supabase/migrations/00068_cost_codes_hierarchy.sql` lines 65–93 contain the precedent: `app_private.validate_cost_code_hierarchy()` defined SECURITY DEFINER + paired with explicit `GRANT EXECUTE … TO authenticated`. Phase 2.4 R.15 test added the `has_function_privilege('authenticated', …, 'EXECUTE')` probe — verified live in `qa-reports/qa-branch2-phase2.4.md` §F.2 (line 119, line 168, line 263).

Phase 2.6 spec H.2 (lines 3896–3898) extends this probe to two `public`-schema functions:

- `public.create_default_approval_chains()`
- `public.default_stages_for_workflow_type(text)`

Confirmed. Cross-schema extension is mechanical — `has_function_privilege` is schema-agnostic.

---

## §4 R.18 blast-radius grep

Greps across `src/`, `supabase/migrations/`, `__tests__/`, `docs/` for every new identifier introduced by Phase 2.6.

### §4.1 Identifier summary

| Identifier | src/ | supabase/migrations/ | __tests__/ | docs/ | Verdict |
|---|---|---|---|---|---|
| `approval_chains` | 0 | narrative-only in `00069_draw_adjustments.sql:15,365` (scope-pivot comment + runtime-note table COMMENT) | 1 file (`draw-adjustments.test.ts`) — narrative comment + header-citation assertion at line 53 | 1 file (`docs/nightwork-rebuild-plan.md`) — expected | **Clean net-new.** No production consumers. |
| `approval_actions` | 0 | 0 | 0 | plan only (DEPRECATED note + Part 3 §3.7 sync from `d11523a`) | F-ii confirmed: nothing references this identifier. |
| `default_stages_for_workflow_type` | 0 | 0 | 0 | plan only | Clean net-new. |
| `create_default_approval_chains` | 0 | 0 | 0 | plan only | Clean net-new. |
| `trg_organizations_create_default_approval_chains` | 0 | 0 | 0 | plan only | Clean net-new. |
| `trg_approval_chains_updated_at` | 0 | 0 | 0 | plan only | Clean net-new. |
| `approval_chains_one_default_per_workflow` | 0 | 0 | 0 | plan only | Clean net-new. |
| `approval_chains_unique_name_per_workflow` | 0 | 0 | 0 | plan only | Clean net-new. |
| `'invoice_pm'` / `"invoice_pm"` | 0 | 0 | 0 | plan only | Clean net-new. |
| `'invoice_qa'` / `"invoice_qa"` | 0 | 0 | 0 | plan only | Clean net-new. |

### §4.2 `__tests__/draw-adjustments.test.ts` reference detail

Two narrative-only references, no consumption:

```
// Lines 7–11: scope-pivot comment block
//   "Scope pivot (2026-04-22): Phase 2.5 was reassigned from approval_chains
//    to draw_adjustments after the 2026-04-14 Markgraf substantial-completion
//    email surfaced 9+ distinct adjustment events on one draw with no clean
//    entity to track."

// Lines 51–55: header-citation assertion
//   /approval_chains/i.test(src) && /Phase\s*2\.6/i.test(src)
//   "header must cite the approval_chains → Phase 2.6 / migration 00070 shift"
```

The assertion at line 53 reads `00069_draw_adjustments.sql` and verifies the table COMMENT cites the pivot — it does not interact with any Phase 2.6 identifier. No test edit required when 00070 lands; the assertion remains true.

### §4.3 Classification (mirrors original f296e0a §2.3)

- **Type A (PASSTHROUGH):** none — both new tables have zero existing consumers.
- **Type B (WRITE PATHS — verify on Dry-Run):** none in Phase 2.6 scope.
- **Type C (WORKFLOW INTEGRATION POINTS, future):** Branch 7 introduces the lookup-chain → evaluate-stages → write-status-history runtime path. Plan §3.7 was synced in `d11523a` to remove the `approval_actions` write step per F-ii.
- **Type D (TS-UNION-VS-CHECK):** no TS unions narrow to the `workflow_type` CHECK enum yet (zero src/ hits). When Branch 7 adds consumers, apply the Phase 2.1 / 2.3 precedent (runtime validation against a file-private constant).

Verdict: clean net-new, identical posture to the original pre-flight.

---

## §5 GH #12 applicability

`gh issue view 12`:

| Field | Value |
|---|---|
| State | OPEN |
| Title | "Default approval_chains stages are Ross-Built-derived heuristics; other orgs will need onboarding overrides" |
| Labels / assignees / milestone | none |

Body (full):

> Phase 2.5 migration 00069 seeds default approval_chains per org with workflow-type-aware defaults (invoice_pm → pm role, invoice_qa → accounting role, others → owner/admin). These defaults match Ross Built's current workflow (PM approves invoices, accounting does QA review, admin approves COs/draws/POs/proposals). Other Nightwork customers (especially remodelers, per the $30M ARR positioning) will have different role distributions and may want different defaults. When the onboarding wizard UI lands in Branch 6/7, include a 'customize approval workflows' step that overrides the defaults based on org-specific questions (e.g., 'who approves invoices at your company?'). Until then, new orgs get Ross-Built-derived defaults which may need manual correction. Related: GH #10 (is_allowance two-layer semantics — similar pattern where defaults need UI affordances).

### §5.1 Tracker still applicable

The spec's `default_stages_for_workflow_type(text)` helper hardcodes the Ross-Built-derived defaults (invoice_pm → pm; invoice_qa → accounting; co/draw/po/proposal → owner/admin). These ship as seed values in migration 00070's helper function and are referenced from both the on-INSERT trigger and the one-time backfill. The onboarding-wizard work the issue tracks (Branch 6/7 — surface a "customize approval workflows" step) remains the right escape hatch and lands as expected. **Tracker fully applicable as the spec lands.**

### §5.2 Body wording is stale post-pivot

The body opens with "Phase 2.5 migration 00069 seeds default approval_chains per org…" — that wording reflects the pre-Markgraf-pivot numbering. After commit `73eaba8` the seed lands in **Phase 2.6, migration 00070**.

Recommendation: update the issue body's first sentence to "Phase 2.6 migration 00070 seeds default approval_chains per org…" Cosmetic only; does not block execution. Could be done either:
- Before Phase 2.6 commits (to avoid creating reverse-stale doc references), or
- Right after the migration lands, in the same git push as the feat commit (so the tracker mentions the actual migration that introduced the seed).

Not a blocker. No other GH-tracked items reference approval_chains numbering — verified via `gh issue list --state open --limit 20` (only #12 has approval_chains language; #14 references draw_adjustments / Phase 2.5 only).

---

## §6 New concerns since `f296e0a`

The original kickoff prompt asked specifically about read-policy parity vs Phase 2.5 draw_adjustments. Plus a sweep for any other new flags that landed since f296e0a.

### §6.1 Read-policy parity vs Phase 2.5 draw_adjustments

**Phase 2.5 draw_adjustments read policy** (`supabase/migrations/00069_draw_adjustments.sql:257–282`):

```sql
CREATE POLICY draw_adjustments_org_read
  …
  USING (
    org_id IN (… org members) AND (
      role IN ('owner','admin','accounting')      -- any of these see all
      OR (role = 'pm' AND EXISTS (
            SELECT 1 FROM public.draws d
            JOIN public.jobs j ON j.id = d.job_id
            WHERE d.id = draw_adjustments.draw_id
              AND j.pm_id = auth.uid()))           -- PMs see only their jobs
    )
  )
```

The PM-on-own-jobs narrowing was added under R.23 to preserve information parity with the `draws` table (which already narrows PMs to own jobs at the read layer). Without it, a PM could see adjustments on a draw they cannot read.

**Phase 2.6 approval_chains read policy** (spec lines 3783–3792):

```sql
CREATE POLICY approval_chains_org_read
  …
  USING (
    org_id IN (… org members)
    OR app_private.is_platform_admin()
  )
```

No PM narrowing.

### §6.2 Justification — why no narrowing on approval_chains

The Phase 2.5 narrowing was driven by two pressures, neither of which apply here:

1. **FK-through-RLS information leak:** `draw_adjustments.draw_id → draws.id`, where `draws` already narrows PMs to own jobs. Without the read narrowing on adjustments, a PM could SELECT adjustments whose parent draw they cannot SELECT — an information leak. (And in fact, per GH #14, the FK-through-RLS interaction is even stronger than the policy declared: PMs can't even INSERT against draws they can't see.)

2. **In-family parity with `draws`:** `draws` is job-scoped; `draw_adjustments` is job-scoped via FK. Information posture between the two should match.

`approval_chains` has neither pressure:

- **No job-scoped FK.** `approval_chains` columns (`org_id, workflow_type, name, is_default, conditions, stages, …`) carry zero job reference. Chains are org-wide configuration over a workflow_type dimension, not workflow data tied to a specific job.
- **No in-family parity to maintain.** The closest in-family table is `org_workflow_settings` (00032), which has org-wide read by design (`members read org_workflow_settings` policy at line 79 of 00032 is unconditional within `org_id`).
- **Operational requirement:** when Branch 7 builds the workflow-evaluation runtime, every PM-facing UI that submits a workflow item needs to display "this will be reviewed by Y after you submit" — that requires reading the relevant chain. A PM can read the workflow chain to know what'll happen to their submission; the *write* policy (narrowed to owner/admin per Amendment B) is what enforces "PMs can't change who reviews."

The spec's intentional R.23 divergence is on the **write** policy (narrowed to owner/admin), not read. Read remains org-wide because approval_chains is org-wide config, not job-scoped data.

**Verdict: justified. No change requested.** This was not flagged in the original f296e0a pre-flight either — the read policy adopted from proposals (which similarly has org-wide read) was unchanged through the eight amendments.

### §6.3 Plan-doc commits since f296e0a — anything new affecting Phase 2.6?

`git log --oneline f296e0a..HEAD -- docs/nightwork-rebuild-plan.md`:

| SHA | Subject | Affects Phase 2.6 spec? |
|---|---|---|
| `73eaba8` | docs(plan): Phase 2.5 scope pivot — draw_adjustments (was approval_chains) + renumber 2.5-2.9 → 2.6-2.10 | Renumber accounted for (00069 → 00070, Phase 2.5 → 2.6). Spec body content unchanged. |
| `d11523a` | docs(plan): sync Part 3 §3.7 runtime flow with F-ii (no approval_actions table; status_history + activity_log carry the audit) | Downstream consequence of F-ii, accounted for. Confirms F-ii decision held through later docs work. |

No new amendments to the Phase 2.6 spec body since `317961d`. No new design surface to evaluate.

### §6.4 Other open-issue dependencies

Cross-checked GH #1–#14 for anything that touches approval_chains scope:

- **GH #9** (audit `app_private` schema grants): closed-pattern; Phase 2.6 functions are `public`, not `app_private`. Per-function GRANT EXECUTE handles the same defense-in-depth posture. No interaction.
- **GH #12**: see §5. Tracker still applies; body wording stale.
- **GH #13** (CO numbering reconciliation), **GH #14** (PM cross-job draw_adjustments INSERT via FK-through-RLS): both Phase 2.5 / draw_adjustments scoped. No interaction with approval_chains.

**Verdict: no new concerns.**

---

## §7 Verdict

**EXECUTE-AS-IS.**

Reasoning:
- 8 amendments + F-ii scope decision already landed in `317961d` and were preserved through the Markgraf-pivot renumber `73eaba8`.
- Part 3 §3.7 runtime-flow sync per F-ii landed in `d11523a`.
- §1 confirmed migration number 00070 is the next free slot; spec internal references all use 00070.
- §3 confirmed all four cited precedents (00065 / 00032 / 00067 / 00068) still hold at the cited shape.
- §4 confirmed clean net-new posture across `src/` / migrations / tests / docs — same as the original f296e0a finding.
- §5 confirmed GH #12 still applicable (body wording stale, cosmetic).
- §6 confirmed no new design questions or RLS concerns since f296e0a.

**R.19 carve-out applies at execution time.** Phase 2.6 is schema-only — zero runtime code touched. Both static-validation conditions are met (the only application code that will reference approval_chains lands in Branch 7). Live manual tests are not required for this phase.

**One non-blocking flag for the executor:** GH #12 issue body still reads "Phase 2.5 migration 00069." Recommend updating to "Phase 2.6 migration 00070" either before the feat commit or in the same git push.

**Stop here.** Do not start migration work. Findings file ships as `docs(qa): Phase 2.6 pre-flight findings`. Jake reviews + triggers execution in a separate session.
