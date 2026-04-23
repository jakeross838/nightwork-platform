# Pre-flight Findings — Branch 2 Phase 2.8: Pricing history table

**Date:** 2026-04-23
**Migration target:** `supabase/migrations/00073_pricing_history.sql` (+ `.down.sql`)
**Origin HEAD at kickoff:** `41522ba` (clean working tree)
**Mode:** PRE-FLIGHT ONLY — no migration written, no SQL applied, no Dry-Run, no plan amendment.
**Plan spec:** `docs/nightwork-rebuild-plan.md` §4168–4206 (30 lines of raw SQL + 4-bullet trigger list; no prior amendments).

---

## §1 Scope call

### §1.1 What the spec says, verbatim (plan §4170–4205)

```sql
CREATE TABLE pricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  source_type TEXT NOT NULL CHECK (source_type IN ('invoice','proposal','po','co')),
  source_id UUID NOT NULL,
  source_line_id UUID NOT NULL,
  vendor_id UUID REFERENCES vendors(id),
  cost_code_id UUID REFERENCES cost_codes(id),
  description TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  unit_price BIGINT,
  amount BIGINT NOT NULL,
  date DATE NOT NULL,
  canonical_item_id UUID,     -- for advanced mode later
  match_confidence NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (source_type, source_line_id)  -- idempotency
);

CREATE INDEX idx_pricing_history_cost_code ON pricing_history(org_id, cost_code_id, date DESC);
CREATE INDEX idx_pricing_history_vendor   ON pricing_history(org_id, vendor_id,    date DESC);
CREATE INDEX idx_pricing_history_description_trgm ON pricing_history USING GIN (description gin_trgm_ops);

-- RLS: org-scoped read; writes via service role only (triggered from entity writes)
```

Plus 4 trigger points (prose, not SQL):

- `invoice_line_items` insert + `invoices.status → qa_approved`
- `proposal_line_items` insert + `proposals.status → accepted`
- `purchase_order_line_items` insert + `purchase_orders.status → issued`
- `change_order_lines` insert + `change_orders.status → approved`

### §1.2 Assessment against Branch 2 standards

| Standard | Status | Notes |
|---|---|---|
| `public.` qualification | ❌ MISSING | Every DDL statement unqualified (`CREATE TABLE pricing_history`, `REFERENCES organizations(id)`, etc.). Phase 2.1–2.7 all qualify. R.21. |
| Full audit-column set | ❌ MISSING | No `updated_at`, no `created_by`, no `deleted_at`. Only `created_at TIMESTAMPTZ DEFAULT now()`. Even `created_at` lacks `NOT NULL`. CLAUDE.md §Architecture Rules. |
| RLS policies | ❌ MISSING | Comment says "org-scoped read; writes via service role only" but no `ALTER TABLE … ENABLE RLS` + no `CREATE POLICY` statements. R.14. |
| Trigger SQL | ❌ MISSING | 4 trigger points listed as prose; no `CREATE FUNCTION` / `CREATE TRIGGER` SQL. Execution-phase work. |
| Paired down.sql | ❌ MISSING | Not mentioned. R.16. |
| R.15 test file | ❌ MISSING | Not mentioned. |
| `NOT NULL DEFAULT now()` on `created_at` | ❌ | Spec has `TIMESTAMPTZ DEFAULT now()` — nullable. Every Branch 2 table has `NOT NULL DEFAULT now()`. |
| Soft-delete semantic | 🟡 DECISION NEEDED | Is pricing_history immutable historical record (no `deleted_at`) or soft-deletable like other Branch 2 tables? See §6. |
| Partial unique predicates | ⚠ | `UNIQUE (source_type, source_line_id)` is a full unique constraint. If soft-delete lands, needs to become partial `WHERE deleted_at IS NULL`. See §6. |
| status / status_history | ✅ N/A | No lifecycle — append-only historical record. |
| CHECK enums | ✅ | `source_type IN ('invoice','proposal','po','co')` present. |
| `amount BIGINT` cents | ✅ | R.8 compliant. `quantity NUMERIC` + `unit_price BIGINT` are reasonable (quantity is not money). |
| `match_confidence NUMERIC` | ⚠ | No range CHECK (0–1 or 0–100?). Existing `items.ai_confidence` and `invoice_extraction_lines.match_confidence` precedents may imply a convention — worth confirming in §6. |
| Indexes | ✅ mostly | 3 indexes spec'd (cost_code + date DESC, vendor + date DESC, GIN trigram on description). Reasonable for Ross-Built-style "what have we paid for similar X recently?" queries. One missing: composite `(org_id, source_type, source_id)` or `(org_id, source_line_id)` for trigger-side idempotency lookups. |

### §1.3 Spec-correctness bugs (not just omissions)

Probes surfaced three concrete defects in the spec beyond missing Branch 2 amenities:

1. **Table name mismatch: `purchase_order_line_items` does not exist.** Probes confirm the codebase canonical name is `public.po_line_items` (migrations 00028/00029/00034/00043/00049 + 5 `src/` consumers). The spec's trigger reference is a plan-doc error. Needs correction during execution-phase.
2. **`po_line_items` column shape is sparser than the spec assumes.** Actual columns: `id, org_id, po_id, budget_line_id, cost_code, description, amount, sort_order, created_at, deleted_at`. Missing from PO lines vs. invoice lines: `quantity`, `unit`, `unit_price`, `vendor_id`, `date`. Consequence: PO-triggered `pricing_history` rows will have `quantity` / `unit` / `unit_price` NULL; `vendor_id` must be resolved via `po_id → purchase_orders.vendor_id`; `date` must be resolved via `purchase_orders.po_date` or similar. Trigger SQL will be more complex than a straight column map.
3. **`canonical_item_id UUID` — no FK declared.** Comment says "for advanced mode later". The cost-intelligence spine (00052+) uses `public.items.id` as the canonical target; the spec should either (a) wire the FK now, or (b) explicitly annotate it as a bare UUID pending Branch 3/4 wiring (same precedent as Phase 2.2 `proposals.source_document_id` bare-UUID deferral). No collision in current schema (no other table has a `canonical_item_id` column — probe confirmed `null` for that query).

### §1.4 Verdict: **AMEND-HEAVY**

Not shippable as-is. Roughly 12 amendments needed to bring the spec to Branch 2 bar: audit columns + RLS + down.sql + R.15 test file + `public.` qualification + soft-delete decision + `created_at NOT NULL` + indexes review + table-name correction (`po_line_items`) + trigger SQL shape decisions (service-role vs. SECURITY DEFINER) + canonical_item_id FK decision + match_confidence range CHECK. Three of the issues (§1.3) are spec defects that would block migration execution if left; the rest are hygiene gaps consistent with every other pre-Amendment Branch 2 phase.

See §8 for the enumerated amendment list.

---

## §2 Migration number + filename verification

### §2.1 Slot availability

```
$ ls supabase/migrations/ | tail -5
00070_approval_chains.sql / .down.sql                          (applied)
00071_milestones_retainage.sql / .down.sql                     (applied)
00072_job_milestones_pm_write_narrowing.sql / .down.sql        (applied)
00073_*                                                         (next free slot) ✅
```

`mcp__supabase__list_migrations` last entry: `20260423014854` (corresponds to the `00072_job_milestones_pm_write_narrowing` apply). 00073 is free.

### §2.2 In-spec filename references

Phase 2.8 spec body (plan §4168–4206):

| Line | Reference | Verdict |
|---|---|---|
| 4170 | `` Migration `00073_pricing_history.sql`: `` | ✅ post-renumber consistent |

Only one filename reference in the spec body. No stale `00071` / `00072` numbering inside the Phase 2.8 block. The renumber commit `41522ba` landed cleanly.

### §2.3 Cross-section references

Plan-doc line 4310 (Phase 3.1 exit-gate) still reads `[ ] Migration 00072 applied, rollback tested`. That reference is Branch 3 scope per the convention established on prior phases — flagged in §2.4 of the Phase 2.7 preflight, not this phase's concern. No edit required here.

Plan-doc line 4770 (Phase 3.1 rebuild-vs-patch call) references `schema from Branch 2 Phase 2.8` — phase identifier only, not a migration number; not affected by the renumber.

### §2.4 Plan exit-gate language

Exit gate at §4276:

> `All 12 migrations (00064 through 00075, with 3 mid-branch insertions: 00067 grant fix, 00069 draw_adjustments Markgraf pivot, and 00072 job_milestones PM write narrowing) applied on dev, committed to git`

Phase 2.8's 00073 lands cleanly inside this range. No exit-gate edit required for Phase 2.8 itself.

---

## §3 R.18 blast-radius grep

**Scope:** everything under repo root except `node_modules/ .next/ .git/ dist/ build/`.

### §3.1 New identifiers introduced by Phase 2.8

| Identifier | Hits | Breakdown |
|---|---|---|
| `pricing_history` | 2 files | `docs/nightwork-rebuild-plan.md` (spec, 3 lines) + `qa-reports/qa-branch2-phase2.7.md` (preflight forward-reference). **Zero `src/` / `__tests__/` / `supabase/migrations/` hits.** |
| `canonical_item_id` | multiple | Appears in 18 files — **but all hits are in the cost-intelligence subsystem** (00052 spine + 00055 non-item verification + `src/lib/cost-intelligence/*` + scripts). Live schema probe confirms **zero tables currently have a `canonical_item_id` column**. Spec would introduce the name. Not a DB-level collision; conceptually aligned with the cost-intelligence spine's `items.id` identifier. See §1.3 bug #3. |
| `match_confidence` | multiple | 1 live table uses it today: `public.invoice_extraction_lines` (from the cost-intelligence subsystem). Adding `match_confidence NUMERIC` to `pricing_history` is not a collision (different table) but worth keeping nomenclature parallel — same `0.0–1.0` convention as the spine. See §6. |
| `source_type` / `source_id` / `source_line_id` | generic terms | Numerous hits across the codebase for generic `source_*` naming. No collision specific to the spec's usage. |

### §3.2 Summary

| Identifier space | src/ hits | __tests__/ hits | supabase/migrations/ hits |
|---|---|---|---|
| `pricing_history` direct | 0 | 0 | 0 |
| `canonical_item_id` / `match_confidence` conceptual overlap with cost-intelligence spine | 11 | 1 | 2 |

No blast-radius surprises specific to Phase 2.8. The cost-intelligence-spine overlap is conceptual alignment, not collision. Branch 3/4 will wire the `canonical_item_id` matching logic; Phase 2.8 ships the column as a bare-UUID forward hook (same pattern as Phase 2.2 `proposals.source_document_id`).

---

## §4 Schema Validator pre-probes

### §4.1 Migration state

- **Last applied:** `20260423014854` → `00072_job_milestones_pm_write_narrowing`.
- `to_regclass('public.pricing_history')` = `null` — no pre-existing table.
- 00073 slot free.

### §4.2 Source-table existence (the 4 trigger targets)

| Spec target table | Actual name | Exists? | Live row count |
|---|---|---|---|
| `invoice_line_items` | `public.invoice_line_items` | ✅ | **113 rows** |
| `proposal_line_items` | `public.proposal_line_items` | ✅ | 0 rows (Phase 2.2 new; Branch 3 writes) |
| `purchase_order_line_items` | ❌ **does not exist** — actual name is `public.po_line_items` | ⚠ rename needed | `po_line_items` has unknown row count (probe didn't run count, but the parent `public.purchase_orders` has 0 rows) |
| `change_order_lines` | `public.change_order_lines` | ✅ | 0 rows |

**Parent-entity live counts:** `invoices=56`, `proposals=0`, `purchase_orders=0`, `change_orders=73`. Ross Built's live data is concentrated in `invoices` + `change_orders`; PO + proposal workflows are empty (Branch 3/4 adoption pending).

### §4.3 Status-enum correctness (spec's trigger firing conditions)

Each spec'd status value is present in its table's CHECK enum:

| Table | Spec's trigger fires on status → | Status enum | Valid? |
|---|---|---|---|
| `invoices.status` | `qa_approved` | `'received','ai_processed','pm_review','pm_approved','pm_held','pm_denied','qa_review','qa_approved','qa_kicked_back','pushed_to_qb','qb_failed','in_draw','paid','void','import_*','info_*'` | ✅ |
| `proposals.status` | `accepted` | `'received','under_review','accepted','rejected','superseded','converted_to_po','converted_to_co'` | ✅ |
| `purchase_orders.status` | `issued` | `'draft','issued','partially_invoiced','fully_invoiced','closed','void'` | ✅ |
| `change_orders.status` | `approved` | `'draft','pending','approved','denied','void'` | ✅ |

All four trigger firing conditions are valid enum values. Good.

### §4.4 FK target tables

- `organizations` ✅, `jobs` ✅, `vendors` ✅ (23 live), `cost_codes` ✅ (238 live), `items` ✅ (cost-intelligence spine — available for future `canonical_item_id` FK wire-up).
- **No `purchase_order_line_items` table** (§1.3 bug #1 — the spec must reference `po_line_items`).

### §4.5 Extension check (GIN trigram index)

`pg_trgm` extension is **installed** — `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_trgm') → true`. The spec's `CREATE INDEX … USING GIN (description gin_trgm_ops)` will apply without an `ENABLE EXTENSION` prerequisite.

### §4.6 RLS precedent catalog (for §5 selection)

**Most recent applicable precedents:**

| Migration | Table | Policy count | Posture | Fit for pricing_history? |
|---|---|---|---|---|
| 00065 | `proposals` / `proposal_line_items` | 3 (read/insert/update) | 4-role workflow writes | ❌ pricing_history has no update path |
| 00070 | `approval_chains` | 3 | 2-role tenant-config writes | ❌ not tenant config |
| 00069 | `draw_adjustments` | 3 + PM read narrowing | 4-role workflow writes | ❌ not job-scoped workflow |
| 00072 | `job_milestones` (post-fix) | 3 + PM narrowing both sides | 4-role | ❌ same |
| **activity_log** (pre-Branch-2, referenced in §5) | `activity_log` | 4 (org isolation RESTRICTIVE + members-read SELECT + platform-admin SELECT + delete_strict) | Trigger-only writes via service role; no app-layer INSERT | ✅ closest conceptual match |

**proposals and approval_chains 3-policy posture still intact** (confirmed via live probe — both report exactly 3 policies, no DELETE). R.23 precedent family is preserved.

---

## §5 R.23 precedent selection

### §5.1 What kind of table is pricing_history?

- **Trigger-populated, not user-written.** The spec's comment explicitly says "writes via service role only (triggered from entity writes)". The 4 bullet trigger points confirm: rows arrive by DB trigger side-effects of entity writes, never by direct API INSERT.
- **Append-only audit spine**, not a workflow entity. No lifecycle. No `status`. No `status_history`. No app-layer UPDATE path (corrections would re-fire the source-entity trigger, producing a new row).
- **Org-wide reference data**, not job-scoped. Every member of an org benefits from pricing history regardless of job assignment (`"what have we paid for 2x6 studs in the last year?"`). No PM-narrowing needed.
- **Reference target for future matching.** `canonical_item_id` hints at downstream joining with the cost-intelligence spine; pricing_history rows are looked up by search/fuzzy-match, not by job-scope.

### §5.2 Precedent recommendation

**Closest existing precedent: `activity_log` (trigger-populated audit spine).** activity_log ships 4 policies:

```
org isolation              ALL         RESTRICTIVE — org_id = user_org_id() OR is_platform_admin()
members read activity      SELECT      org_id = user_org_id()
activity_log_platform_admin_read  SELECT  is_platform_admin()
activity_log_delete_strict DELETE      org_id = user_org_id()   — plus service_role only
```

No INSERT policy (service_role bypasses RLS for trigger inserts). No UPDATE policy (append-only). Policy count = 4.

**But activity_log uses the older RESTRICTIVE-layered pattern**, not the post-Branch-2 3-policy shape. The cleaner modern posture for a pure-audit trigger-populated table is:

- **1 SELECT policy** — any active org member + platform-admin bypass (mirrors the proposals/approval_chains `org_read` pattern but stops there).
- **No INSERT policy** — service-role triggers bypass RLS. Explicit RLS enablement makes this safe: non-service-role callers are rejected by default.
- **No UPDATE policy** — append-only. Corrections fire new rows via the source-entity re-processing path.
- **No DELETE policy** — historical record. Soft-delete via `deleted_at` if a row is ever invalidated (see §6 soft-delete decision).

Policy count = **1** (just the read). This is a **new pattern for Branch 2**, not drawn from the proposals 3-policy family. **Document as intentional divergence** (R.23) — pricing_history is neither workflow data nor tenant config; it's a trigger-populated audit surface, which has no Branch 2 precedent.

**Alternative considered (3-policy):** adopt proposals' shape with a narrowed write set (owner/admin only for manual backfill + corrections). Rejected because:
- The spec explicitly scopes writes to service role.
- UPDATE capability implies mutability, which contradicts the "append-only historical record" semantics.
- Owner/admin corrections can always be done via service-role impersonation in the platform-admin UI.

### §5.3 PM-on-own-jobs read narrowing?

**Not applicable.** pricing_history is org-wide reference data. A PM researching pricing for a future bid legitimately needs to see historical pricing across all the org's jobs, not just their assigned ones. No job-visibility-narrowing required.

### §5.4 Precedent summary

**Adopt: `activity_log`-style trigger-populated audit spine, refactored to the modern 1-policy shape.** Document as R.23 intentional divergence from the proposals / approval_chains / draw_adjustments / job_milestones 3-policy family.

---

## §6 Spec gaps / amendments-to-consider

The raw spec at plan §4170–4205 is 30 lines of bare SQL + 4 prose trigger bullets. Gap list:

### §6.1 `pricing_history` table gaps

| # | Gap | Recommended resolution |
|---|---|---|
| 1 | No `public.` qualification on any DDL statement — violates R.21 | Add `public.` on every table/FK reference |
| 2 | No `NOT NULL` on `created_at` — violates CLAUDE.md audit-column convention | `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` |
| 3 | No `updated_at` | **DECISION:** if append-only, omit (activity_log has no updated_at either); if corrections-in-place are ever needed, add with trigger. **Recommend: omit.** |
| 4 | No `created_by` | Triggers populate this table, not users. Service-role writes have no session user context unless the trigger captures `auth.uid()` explicitly. **DECISION:** either (a) omit, documenting that this is a system-populated table; (b) include and let triggers default to `NULL` (or capture `auth.uid()` at trigger firing time if the source-entity write was from an authenticated session). **Recommend: include as nullable** — triggers can capture `auth.uid()` opportunistically. |
| 5 | No `deleted_at` — does pricing_history soft-delete? | **DECISION:** see §6.2 below. |
| 6 | No RLS declared — violates R.14 + CLAUDE.md | Enable RLS; 1-policy shape per §5 |
| 7 | FKs have no `ON DELETE` behavior | Spec-level default = `NO ACTION`. pricing_history shouldn't cascade-hard-delete when parent soft-deletes; application-layer invariant (same pattern as 00069 draw_adjustments). Document in migration header. |
| 8 | `canonical_item_id UUID` has no FK | **DECISION:** wire `REFERENCES public.items(id)` now (cost-intelligence spine exists) OR bare-UUID + document as Phase 2.2-style deferred FK. **Recommend: wire now** — items table is stable, no deferral rationale. |
| 9 | `match_confidence NUMERIC` has no range CHECK | Probe showed `invoice_extraction_lines.match_confidence` exists — check its CHECK predicate for convention. Recommend `CHECK (match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1))` matching the ai_confidence 0–1 convention. |
| 10 | `UNIQUE (source_type, source_line_id)` is a full unique constraint, not partial | **DECISION:** tied to §6.2 soft-delete decision. If soft-delete → partial `WHERE deleted_at IS NULL`. If immutable → full UNIQUE is fine. |
| 11 | No index on `(org_id, source_type, source_id)` | Trigger idempotency lookups (`INSERT … ON CONFLICT DO NOTHING`) benefit from an index matching the conflict target. The `UNIQUE (source_type, source_line_id)` constraint auto-creates a backing index but omits `org_id` — for hot-path trigger queries, recommend a separate covering index. |
| 12 | No FK column index on `job_id` | Trigger idempotency + per-job pricing lookups benefit. Recommend `idx_pricing_history_job (org_id, job_id, date DESC)`. |

### §6.2 Soft-delete decision (§6.1 #5 + #10)

**Two coherent options:**

- **Option A: immutable append-only.** No `deleted_at`. `UNIQUE (source_type, source_line_id)` is full (backing index full). Semantic: pricing_history rows are permanent historical record; invalidation is done via a correction row (re-fire trigger with updated source data, producing a new row with a later `date`) or by deleting-and-re-inserting the underlying source-entity line item (which would cascade back through the trigger). Matches the spirit of the spec comment "append-only historical data".
- **Option B: soft-delete like every other Branch 2 table.** Add `deleted_at`. Make `UNIQUE (source_type, source_line_id)` partial `WHERE deleted_at IS NULL`. Triggers on source-entity soft-delete cascade-soft-delete the matching pricing_history row (application-layer, mirrors 00069 draw_adjustments invariant).

**Recommend Option A** (immutable append-only). Rationale:
1. Spec comment "historical data" implies immutability.
2. `source_entity` soft-delete doesn't semantically invalidate the historical pricing — the vendor did quote $X on that date, regardless of whether the PO was later voided. pricing intel should reflect reality, not entity lifecycle.
3. Option B adds a cross-table soft-delete cascade to 4 more entities (invoice_line_items, proposal_line_items, po_line_items, change_order_lines) — blast radius Phase 2.8 doesn't need.
4. If a row is ever *fraudulent* or *incorrectly entered*, the platform-admin DELETE path exists via service-role SQL (same pattern as activity_log).

Flag this as a scope decision for Jake if Option A feels wrong; the mechanical impact is small (one column + one partial-index predicate swap).

### §6.3 Spec defects (§1.3 — not mere omissions)

| # | Defect | Recommended resolution |
|---|---|---|
| 13 | **Spec references `purchase_order_line_items` which does not exist.** Actual table is `public.po_line_items`. | Correct to `public.po_line_items` in the execution-phase trigger SQL + migration header's trigger-point enumeration |
| 14 | **`po_line_items` has no `quantity` / `unit` / `unit_price` / `vendor_id` / `date` columns** — spec implicitly assumes symmetric column shape with invoice_line_items | Trigger SQL must resolve `vendor_id` via `po_line_items.po_id → purchase_orders.vendor_id`; `date` via `purchase_orders.po_date` (probe via information_schema during execution) or `purchase_orders.created_at` fallback; `quantity` / `unit` / `unit_price` insert as NULL (bigint `amount` only). Document this asymmetry in the trigger function's COMMENT. |
| 15 | **`canonical_item_id UUID` has no FK** (also listed §6.1 #8 as gap) | Same recommendation — wire `REFERENCES public.items(id)` now. |

### §6.4 Non-SQL deliverables (R.15, R.16)

| # | Gap | Recommended resolution |
|---|---|---|
| 16 | No paired `.down.sql` — violates R.16 | Write `00073_pricing_history.down.sql`. Reverse order: drop 4 triggers + 4 trigger functions → drop RLS policy → DISABLE RLS → drop indexes → drop table. |
| 17 | No R.15 test file | Write `__tests__/pricing-history.test.ts`. Static regex assertions matching the Phase 2.5/2.7 precedent: migration + down file existence; public. qualification; 4-value source_type CHECK enum; 1 SELECT policy + RLS enabled + no INSERT/UPDATE/DELETE policies (R.23 divergence regression fence); trigger registrations on the 4 source entities; `po_line_items` (not `purchase_order_line_items`) referenced — fence against the spec defect. Dynamic trigger-firing + live-auth probes fire in Migration Dry-Run per R.19. |
| 18 | Amendment F.2 GRANT-verification — applicable? | **Applicable if trigger functions are SECURITY DEFINER.** The 4 trigger functions need to INSERT INTO `public.pricing_history` when the source-entity write is from an authenticated role. Two paths: (a) SECURITY INVOKER + `authenticated` gets RLS-bypass via a narrow write policy (rejected — we want no write policy); (b) SECURITY DEFINER functions + pinned search_path + `GRANT EXECUTE TO authenticated`. **Recommend (b)** — matches the 00032 / 00067 / 00070 precedent family. Amendment F.2 applies. |

### §6.5 Trigger-function shape (execution-phase detail)

The plan doc's 4-bullet prose trigger list is incomplete. Each trigger needs:
- An `AFTER INSERT OR UPDATE` trigger on the source-entity line-item table.
- A status-gate check (only fire when the parent entity's status matches the spec's firing condition).
- A column-map resolution (especially for `po_line_items` per §6.3 #14).
- `ON CONFLICT (source_type, source_line_id) [WHERE deleted_at IS NULL] DO NOTHING` to make the triggers idempotent under re-processing.
- `SECURITY DEFINER` + pinned search_path + explicit `GRANT EXECUTE` per §6.4 #18.

Recommend breaking the 4 triggers into a separate Amendment block in the execution-phase header so the spec-vs-reality column-shape asymmetry is called out per-source.

---

## §7 Ross Built / live-data fit check

### §7.1 Backfill expectation

pricing_history is a net-new table; 0 rows at apply. **The spec does not call for a backfill of the 113 existing `invoice_line_items` rows or the 73 existing change_orders.** Two interpretations:

- **Interpretation A: no backfill.** pricing_history populates only forward from the apply moment. Ross Built's 113 existing invoice lines won't appear in pricing history — pricing intel is "queries against transactions that happen after this phase lands".
- **Interpretation B: explicit backfill.** Add a one-time `INSERT … SELECT` at migration-apply time that pulls existing qa_approved invoice lines (and their change_order-line counterparts) into pricing_history. Matches the 00070 approval_chains backfill precedent.

**Open question for Jake:** interpretation A or B? If B, scope decision: backfill invoice lines only (qa_approved filter), or all 4 source types? If 4 source types, proposal_line_items is 0 / change_order_lines is 0 / po_line_items has unknown row count but parent `purchase_orders` has 0 rows — so effectively B collapses to "backfill 113 qa_approved invoice_line_items" on the dev tenant.

**Recommend Interpretation B, invoice-only,** gated on `invoices.status = 'qa_approved'`. Matches the spec's trigger firing condition and makes pricing_history immediately useful after apply. Low blast radius (113 rows, single source table).

### §7.2 Branch 3 write-path shape

Branch 3/4 introduces:
- Invoice QA approval flow (transitions invoice.status to `qa_approved`) → fires invoice-line-items trigger → pricing_history population path goes live.
- Proposal acceptance flow → fires proposal-line-items trigger.
- PO issuance flow → fires po_line_items trigger.
- CO approval flow → fires change_order_lines trigger.

Phase 2.8 ships the spine; Branch 3/4 lights up the 4 write paths by driving the source-entity status transitions through UI/API. No runtime code touches `pricing_history` directly — it's populated by DB triggers + read by future Branch 3+ search UIs.

### §7.3 Open questions flagged for Jake

1. **Soft-delete decision** (§6.2) — Option A (immutable) vs. Option B (soft-deletable).
2. **Backfill decision** (§7.1) — Interpretation A (no backfill) vs. B (113 invoice lines).
3. **Match confidence range** (§6.1 #9) — 0–1 (like `items.ai_confidence`) vs. 0–100 (like some other systems). Recommend 0–1.
4. **canonical_item_id FK** (§6.1 #8 / §6.3 #15) — wire now to `public.items(id)` or defer as bare UUID?
5. **`po_line_items` shape mismatch** (§6.3 #14) — confirm trigger function should resolve missing fields (vendor_id / date) via parent entity, not leave them NULL.

---

## §8 Recommended amendment list (for Jake to approve)

Letters mirror the Phase 2.5 / 2.7 pattern. If approved, each becomes a one-line entry in the plan-doc amendment block and the migration header's citation list.

| ID | Amendment | Scope |
|---|---|---|
| **A** | **Audit columns on `pricing_history`** — add `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` (make it NOT NULL), `created_by UUID REFERENCES auth.users(id)` nullable (trigger captures `auth.uid()` opportunistically). **Omit `updated_at`** (append-only). See §6.2 for `deleted_at` decision. §6.1 #2–4. | Table |
| **B** | **RLS: 1-policy read-only shape (R.23 divergence)** — `ALTER TABLE public.pricing_history ENABLE ROW LEVEL SECURITY;` + single `pricing_history_org_read` SELECT policy (any active org member + platform-admin bypass). **No INSERT / UPDATE / DELETE policies** — service-role triggers populate via SECURITY DEFINER; no app-layer mutation path. Document as intentional divergence from the proposals / approval_chains / draw_adjustments / job_milestones 3-policy family because pricing_history is a trigger-populated audit spine with no lifecycle. Closest prior pattern: `activity_log`. | Table |
| **C** | **Soft-delete decision: Option A (immutable append-only)** — no `deleted_at` column. `UNIQUE (source_type, source_line_id)` stays full (non-partial). Platform-admin SQL deletion path for fraud/error correction (same as activity_log). **Flag for Jake** — flip to Option B (soft-deletable with partial unique) if preferred. §6.2. | Scope decision |
| **D** | **`public.` schema qualification throughout** — every DDL statement qualifies. R.21. §6.1 #1. | All |
| **E** | **`canonical_item_id UUID REFERENCES public.items(id)`** — wire the FK now. Cost-intelligence spine is stable; no deferral rationale. Update spec comment from "for advanced mode later" to "Branch 3/4 matching fills this from the cost-intelligence spine". §6.1 #8, §6.3 #15. | Table |
| **F** | **`match_confidence` range CHECK 0–1** — add `CHECK (match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1))` matching the `items.ai_confidence` 0–1 convention. §6.1 #9. | Table |
| **G** | **Additional indexes** — `idx_pricing_history_job (org_id, job_id, date DESC)` + `idx_pricing_history_source_lookup (org_id, source_type, source_id)` for trigger idempotency lookups and per-job pricing queries. Keep the 3 spec'd indexes (`cost_code`, `vendor`, trigram). §6.1 #11, #12. | Indexes |
| **H** | **Correct trigger target table `purchase_order_line_items` → `public.po_line_items`** — spec defect. Document the rename in the migration header + trigger-function COMMENT. §6.3 #13. | Spec correction |
| **I** | **`po_line_items` column-shape resolution** — trigger function must resolve `vendor_id` via `po_line_items.po_id → public.purchase_orders.vendor_id`, `date` via `public.purchase_orders.po_date` (probe column name during execution) with a fallback, and insert `quantity` / `unit` / `unit_price` as NULL. Document the asymmetry in the PO-trigger function's COMMENT. §6.3 #14. | Trigger SQL |
| **J** | **4 trigger functions with SECURITY DEFINER + pinned search_path + explicit GRANT EXECUTE TO authenticated** (Amendment F.2 pattern from 00067/00070). Each trigger: `AFTER INSERT OR UPDATE` on source-line table; status-gate check via parent entity; `INSERT … ON CONFLICT (source_type, source_line_id) DO NOTHING` for idempotency. 4 functions × explicit GRANT = 4 GRANT statements. §6.4 #18, §6.5. | Trigger SQL |
| **K** | **Paired `00073_pricing_history.down.sql` per R.16** — reverse order: drop 4 triggers → drop 4 trigger functions → drop RLS policy → DISABLE RLS → drop 5 indexes (3 spec'd + 2 per Amendment G) → drop table. §6.4 #16. | R.16 |
| **L** | **R.15 test file `__tests__/pricing-history.test.ts`** — static-regex assertions matching approval-chains / milestones-retainage precedent. Regression fences on: `po_line_items` reference (not `purchase_order_line_items`); 1-policy shape (no INSERT/UPDATE/DELETE policies); `canonical_item_id REFERENCES public.items(id)`; `match_confidence` range CHECK; 4-value `source_type` CHECK; 4 trigger registrations; each trigger function is SECURITY DEFINER with pinned search_path + GRANT EXECUTE TO authenticated. Dynamic probes in Migration Dry-Run. §6.4 #17. | R.15 |
| **M** | **Backfill decision: Interpretation B, invoice-only** — one-time `INSERT … SELECT` at apply time pulling existing `invoice_line_items` rows where the parent invoice's `status = 'qa_approved'`. 113 invoice_line_items exist on dev; subset with qa_approved parent is unknown (probe in execution-phase). Makes pricing_history immediately useful post-apply. **Flag for Jake** — flip to Interpretation A (no backfill) if forward-only semantics preferred. §7.1. | Scope decision |
| **N** | **Header documentation: trigger-populated audit spine rationale** — migration header cites (a) R.23 divergence from the 3-policy family with `activity_log` as the closest precedent; (b) Amendment C soft-delete decision + rationale; (c) Amendment H `po_line_items` correction; (d) Amendment J SECURITY DEFINER / GRANT pattern lineage (00032 → 00067 → 00070); (e) Amendment M backfill decision + query preview; (f) Branch 3/4 writer-contract — which status transitions fire which triggers; (g) future canonical_item_id population via cost-intelligence spine. | Documentation |

**Open questions flagged for Jake before execution** (concentrated in §7.3):

1. Amendment C soft-delete — confirm **Option A (immutable)** vs. Option B.
2. Amendment M backfill — confirm **Interpretation B, invoice-only** vs. A (no backfill).
3. Amendment F `match_confidence` range — confirm **0–1** vs. 0–100.
4. Amendment E `canonical_item_id` FK — confirm **wire to `public.items(id)` now** vs. defer.
5. Amendment I `po_line_items` resolution — confirm trigger function resolves missing fields via parent entity vs. inserts as NULL.

---

## §9 Delta from prior Branch 2 pre-flights

- **Closer to Phase 2.7 "fresh-surface" template** than Phase 2.6's lighter re-verification — the spec is 30 lines of bare SQL with zero prior amendments baked in (same starting state as Phase 2.7).
- **Three spec defects** (§1.3) in addition to the usual hygiene gaps. Phase 2.7's spec had one similar-tier defect (the ON CONFLICT predicate); pricing_history has three: wrong table name (`purchase_order_line_items`), no FK on `canonical_item_id`, and asymmetric column shape between invoice and PO line tables. The live-probe step was essential to catch all three.
- **R.23 divergence candidate.** First Branch 2 phase to adopt a single-policy RLS shape. Documented as intentional (Amendment B) — pricing_history sits outside the workflow-data / tenant-config dichotomy that 00065 / 00069 / 00070 / 00072 all fit into.
- **Amendment F.2 GRANT pattern re-activates** (4 trigger functions), matching Phases 2.6 (2 functions) and 2.3 follow-up (2 functions). Phase 2.7 had no SECURITY DEFINER functions (Amendment K N/A).

No stance on whether to amend the plan doc directly or keep amendments in this pre-flight + execution-phase QA report — same pattern as prior phases.
