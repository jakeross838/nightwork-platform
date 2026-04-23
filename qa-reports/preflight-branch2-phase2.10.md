# Phase 2.10 — V2.0 Schema Hooks — Pre-Flight Findings

**Date:** 2026-04-23
**Plan section:** `docs/nightwork-rebuild-plan.md:5505-5527`
**Migration slot (originally planned):** `00075`
**Verdict:** **NOT EXECUTED AS PLANNED.** Spec had a hard collision blocker (§2.A) and architectural-rule violations (§2.B–F). User selected **Option 2 (documentation-only reframe)** — no migration ships, slot `00075` stays reserved-unused, naming registry documented in Part 2 §2.2.
**Execution outcome:** Phase 2.10 closes via plan-doc amendments only (Amendments A + I + reframe). See `docs(plan)` follow-up commit for the actual edits applied.

---

## §1 — Confirmed scope (as plan originally read, lines 5509–5520)

8 stub tables, each `CREATE TABLE foo ( id UUID PRIMARY KEY DEFAULT gen_random_uuid() );`:

1. `daily_logs` (v2.0)
2. `schedule_items` (v2.0)
3. `time_entries` (v2.0)
4. `selections` (Part 2 §2.2 said v1.5)
5. `blueprint_plans` (v1.5; pre-context flag G renamed from `plans` to avoid subscription-plan namespace collision — confirmed by line 5514 comment)
6. `takeoff_extractions` (v1.5)
7. `overhead_pools` (v2.0)
8. `overhead_allocations` (v2.0)

Original plan narrative purpose (line 5525): *"This isn't strictly necessary but locks in naming so v2.0 doesn't rename things."*

Branch 2 Exit Gate (line 5547) originally required: `[ ] V2.0 hook tables exist (empty, ready for future use)`.

Plan Part 2 §2.2 V2.0 schema hooks (lines 2036–2051) listed 10 tables originally; `client_portal_access` + `client_portal_messages` were promoted to real tables in Phase 2.9 (00074), leaving 8 in the Phase 2.10 list — that omission was intentional and correct.

---

## §2 — Scope-drift / blocker flags

### A. **HARD COLLISION BLOCKER** — `selections` already exists

- `public.selections` is a **fully-built real table** from migration `00052_cost_intelligence_spine.sql` (lines 398–440).
- 28 columns, RLS enabled, 3 policies (`selections_org_read`, `selections_org_write`, `selections_org_update`).
- Loaded with FKs to `organizations`, `jobs`, `selection_categories`, `vendors`, `items`. Has full status state machine (8-value CHECK), audit cols, status_history, indexes.
- Spec used bare `CREATE TABLE selections (...)` — would fail with `42P07 relation "selections" already exists` on apply.
- Plan Part 2 §2.2 line 2044 listing `selections (v1.5)` was **internally inconsistent** with what shipped in 00052 (v1.0).
- **Source of inconsistency:** Phase 2.10 spec was authored against the Part 2 §2.2 stub list, which itself drifted from on-disk reality. Same class of plan-doc drift caught in Phase 2.6 / 2.8 / 2.9 syncs — but here it was pre-execution, not post.

### B. **No `org_id` columns** on any of 8 stubs

Violated CLAUDE.md "Every record: id, created_at, updated_at, created_by, org_id" rule. Without `org_id`, RLS cannot be defined org-scoped, and future v1.5/v2.0 schema fills would silently shape tenant-scoping decisions around the inherited (absent) shape.

### C. **No audit columns** (created_at, updated_at, created_by, deleted_at)

Same CLAUDE.md violation. Phase 2.4-2.9 precedent: every new table ships with full audit column set. Phase 2.10 spec shipped none.

### D. **No RLS enable, no policies**

Violated the Branch 2-wide expectation. Even an empty stub with no `org_id` would still need `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + at minimum a no-op deny-all to avoid Supabase advisor warnings (`rls_disabled_in_public`). Phase 2.10 spec shipped zero RLS. Pre-flight check #4 ("Live-auth RLS probes only if new tables introduced") fired positive — 7 new tables, all needed RLS decisions.

### E. **No `00075_v2_hooks.down.sql`**

Violated R.16 (paired down migration mandatory). Not mentioned in spec.

### F. **No test file**

Violated R.15 (test-first per migration). Phase 2.4-2.9 precedent: every migration ships with `__tests__/<migration-name>.test.ts` covering existence, columns, constraints, RLS shape, GRANTS. Phase 2.10 spec mentioned none.

### G. **No COMMENT ON TABLE**

Phase 2.7/2.8/2.9 set firm precedent: every new table gets a COMMENT documenting purpose, lineage, R.23 status, immutability rules, etc. Phase 2.10 spec shipped none.

### H. **R.23 precedent gap — what RLS shape do empty stubs adopt?**

No prior Branch 2 phase established a precedent for "stub table with no business rows yet." Closest analogues:
- Workflow data → 3-policy (org_read + org_write + platform_admin)
- Tenant config → 2-policy (authenticated SELECT + platform_admin ALL) — e.g. `cost_code_templates` (00068)
- Audit spine → 1-policy SELECT (R.23 divergence) — e.g. `pricing_history` (00073)

Empty stubs didn't fit any of the three. Avoiding the precedent decision is a positive secondary benefit of the documentation-only reframe.

### I. **Branch 2 Exit Gate referenced "Migration 00075"** — accurate at time of authoring

Exit Gate at line 5539 said "All 12 migrations (00064 through 00075...)". 00064→00075 = 12 migrations including the 3 mid-branch insertions (00067, 00069, 00072). Math checked out at authoring time. Post-reframe, this number drops to **11 migrations (00064 through 00074)** with `00075` reserved-unused. Plan-doc amendment commit updates this count.

Note: line 5573 "Migration 00072" in Phase 3.1 Exit Gate is the known pre-existing stale reference deferred to Branch 3 pre-context per kickoff context — not Phase 2.10 scope.

---

## §3 — Live-probe results

Live-probe goal: confirm spec SQL would apply cleanly on a probe branch.

| Probe | Result | Notes |
|-------|--------|-------|
| `pg_tables` lookup of all 8 stub names in `public` schema (production) | `selections` exists; 7 others do not | Confirms collision A statically — branch probe unnecessary |
| `selections` RLS state | RLS enabled, 3 policies (`org_read`/`org_write`/`org_update`) | Real table from 00052 — bare `CREATE TABLE` would fail |
| Source-tree grep for the 8 names in `src/` | 0 hits | No code references any of these 8 — clean naming reservation, no rename cascade needed |
| Migration-tree grep | `selections` referenced in 00052 (creation) and 00074 (visibility_config CHECK enum keyword); 7 others have 0 hits | Only `selections` is load-bearing in any prior migration |
| Last applied migration | `00074_client_portal` | Slot `00075` was free; reframe leaves it reserved-unused |
| Branch state (start of pre-flight) | clean on `main` at `18dc087`, no uncommitted work | Ready for amendment commit pattern |

**Did NOT spin up Supabase preview branch.** The collision was provable statically from `pg_tables` + `pg_policy` reads — no DDL probe added signal beyond confirming `42P07`. R.19 schema-only-phase carve-out applied for the static portion. Live RLS probes would have been required if amendments added policies, but the Option 2 reframe ships no policies.

---

## §4 — Proposed amendments at decision time (A–I) + reframe option (J)

The pre-flight surfaced 9 amendments + 1 reframe path. User selected **Option 2 (reframe)** — only Amendments A + I land; B–H are obsolete because no migration ships.

- **A — Drop `selections` from the stub list.** [APPLIED in plan-doc commit] Spec line 5513 removed. Part 2 §2.2 line 2044 updated to remove `(v1.5)` annotation since `selections` shipped as v1.0 in 00052. Cross-referenced to the 00052 build.
- **B — Add `org_id`** to remaining 7 stubs. [OBSOLETE — no migration]
- **C — Add full audit-column set** to remaining 7 stubs. [OBSOLETE — no migration]
- **D — Enable RLS + adopt R.23 precedent for empty stubs.** [OBSOLETE — no migration; precedent decision deferred to v1.5/v2.0 when each table is built for real]
- **E — Add `COMMENT ON TABLE`** for each of the 7 stubs. [OBSOLETE — no tables]
- **F — Write `00075_v2_hooks.down.sql`** per R.16. [OBSOLETE — no migration]
- **G — Write `__tests__/v2-hooks.test.ts`** per R.15. [OBSOLETE — no migration]
- **H — Update Branch 2 Exit Gate line 5547.** [APPLIED in plan-doc commit] Replaced with "V2.0 hook tables documented as naming registry in Part 2 §2.2 (no migration shipped; reframed from pre-creation to documentation-only per Phase 2.10 pre-flight ...)".
- **I — Add a one-line note in Part 2 §2.2** that `client_portal_access` and `client_portal_messages` are no longer stubs (promoted to real tables in 00074, Phase 2.9). [APPLIED in plan-doc commit]

---

## §5 — Decision: Option 2 (documentation-only reframe)

The kickoff said "lightest phase in Branch 2" — that intent conflicted with the 9 amendments above. Three viable paths were surfaced; user selected **Option 2**.

### Option 1 — Execute with amendments A–I (closest to original plan intent) [REJECTED]
Would have landed a real migration creating 7 stub tables with full architectural-rule compliance + deny-all RLS. ~150 lines of SQL, ~80 lines of tests. Matched Phase 2.4-2.9 ceremony. Heaviest of the three options but most aligned with original plan structure.

### Option 2 — Reframe to documentation-only phase [SELECTED]
**No migration. No SQL. No tests.** Phase 2.10 became a plan-doc cleanup pass:
- Naming registry documented in Part 2 §2.2 with intended schema shapes for each of the 7 stubs.
- `selections` v1.0/v1.5 inconsistency resolved.
- Branch 2 Exit Gate updated to drop "stubs exist" line, replaced with "naming registry documented".
- Migration slot `00075` stays reserved-unused; next migration is `00076` in Phase 3.1.

**Why selected:** the plan narrative itself admitted "isn't strictly necessary", architectural rules in CLAUDE.md don't sit cleanly on empty stubs, and `selections` already proved that pre-creating stubs ahead of the real schema invites drift. A documented naming registry achieves the goal (lock names so v1.5/v2.0 doesn't rename) without the architectural debt.

### Option 3 — Execute selections-correction only [REJECTED]
Would have treated Phase 2.10 as just "fix Part 2 §2.2 drift": amendment A + I only, no enriched naming registry. Loses the naming-reservation goal more thoroughly than Option 2.

---

## §6 — Out of scope (confirmed not touched)

- Plan-doc line 5573 "Migration 00072 → 00075 renumber" in Phase 3.1 Exit Gate — deferred to Branch 3 pre-context per kickoff.
- Branch 2 Final rollup QA — separate pass after 2.10 closes.
- GH #1–#17 issue housekeeping.

---

## §7 — Phase 2.10 closure

- Phase 2.10 closes via plan-doc-only commits (this findings doc + amendment commit).
- No migration `00075_v2_hooks.sql` ships. No `.down.sql`. No test file.
- Migration slot `00075` is **reserved-unused**. Phase 3.1 picks up at `00076`.
- Branch 2 progress at close: **10/10 phases complete, 11/12 originally-planned migrations applied** (`00064` through `00074`; slot `00075` reserved-unused per this reframe).
- Next step: Branch 2 Final rollup QA.
