# Audit — Data Model + Migrations
**Date:** 2026-04-24
**Scope:** `supabase/migrations/` (78 files + 00078 untracked), `src/lib/types/`, `src/lib/guards/`
**Migrations covered:** 00001–00078

---

## Summary

Schema health is **moderate-good with one latent CRITICAL risk and several HIGH gaps**. The migration discipline improved sharply at migration 00060: every migration from 00060 onward has a paired `.down.sql` rollback file, transactions where appropriate, and thorough inline rationale. Pre-00060 migrations are undocumented, non-transactional, and rollback-free. The enum alignment work in Branch 1 (00060) resolved the most dangerous drift. Remaining risks concentrate in (1) missing `ENABLE ROW LEVEL SECURITY` statements for 8 core tables in migrations (relying on Supabase dashboard or deployment bootstrap outside version control), (2) two money-adjacent NUMERIC columns in early schema, and (3) `purchase_orders.status` missing the `accepted` value added in Part 2 §2.3.

Migration numbering discipline: **00075 is intentionally vacant** (documented in the rebuild plan as a naming-registry slot, no migration ships). No accidental gaps found.

Overall grade: **B−** — solid trajectory, migration 00060+ practices are strong, but the RLS bootstrap risk and enum drift items need tracking.

---

## Findings

### CRITICAL

#### D-1: No `ENABLE ROW LEVEL SECURITY` statement for 8 core tenant tables in migrations
- **Location:** `supabase/migrations/` — absent across all 78 files for tables `jobs`, `invoices`, `draws`, `draw_line_items`, `vendors`, `budget_lines`, `purchase_orders`, `cost_codes`
- **Finding:** Every one of the 8 core financial tables has RLS policies applied in migrations (00009, 00016, 00043, 00046, 00049, etc.) but **no migration ever executes `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY`** for them. The policies exist, but if RLS is not enabled at the table level, every policy is silently ignored and all rows are world-readable/writable by any authenticated session. For comparison, `change_orders`, `invoice_line_items`, `org_members`, `platform_admins`, and every post-00052 table all have explicit `ENABLE ROW LEVEL SECURITY` in their creating migration. The 8 core tables were created in 00001 (pre-RLS era) and the enablement was apparently done via the Supabase dashboard and never codified in a migration, meaning it does not travel with the schema.
- **Impact:** If the schema is migrated to a fresh database from migration files alone (new developer environment, CI, disaster recovery), all 8 core tables will have their policies defined but RLS not enabled. The org-isolation RESTRICTIVE policies from 00016 and the tightened reads from 00046 are silently inert. Any authenticated session can SELECT all invoices, jobs, vendors, and draws across all orgs.
- **Suggested fix:** Add a single idempotent migration (e.g., `00079_enable_rls_core_tables.sql`) that runs `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY` for all 8 tables. Include `ALTER TABLE public.<table> FORCE ROW LEVEL SECURITY` to also protect the table owner. Migration is a no-op if RLS is already enabled (Supabase allows it to be re-run safely). This converts an implicit Supabase-dashboard dependency into a versioned guarantee.

---

### HIGH

#### D-2: `purchase_orders.status` missing `accepted` value — Part 2 §2.3 drift
- **Location:** `supabase/migrations/00028_phase7_purchase_orders_change_orders.sql:76-77`, `supabase/migrations/00001_initial_schema.sql:95`
- **Finding:** Part 2 §2.3 defines `purchase_orders.status` as `('draft','issued','accepted','partially_invoiced','fully_invoiced','closed','void')`. The current CHECK constraint (last set in 00028) is `('draft','issued','partially_invoiced','fully_invoiced','closed','void')`. The `accepted` value is absent. The PO lifecycle in §1.6 explicitly introduces `accepted` as the state between `issued` and `partially_invoiced` (vendor acceptance = binding agreement). Any code that tries to set `status = 'accepted'` will produce a CHECK violation 500. This is the same class of silent violation that caused 00060's enum alignment migration.
- **Impact:** PO vendor-acceptance flow cannot be built without a migration first. If a developer writes an `accepted` status transition without checking the constraint, it fails silently in production. The schema also lacks the `accepted_date` column referenced in the Part 2 §2.2 PO entity spec.
- **Suggested fix:** Migration to drop and re-add `purchase_orders_status_check` with the 7-value set. Also add `accepted_date DATE` column. Same drop-UPDATE-add-CHECK pattern as 00066.

#### D-3: `draw_line_items.percent_complete` stored as `NUMERIC(5,2)` — R.8 adjacent risk
- **Location:** `supabase/migrations/00001_initial_schema.sql:237`
- **Finding:** `percent_complete NUMERIC(5,2) NOT NULL DEFAULT 0`. This is not a money column so it does not directly violate R.8, but the Part 2 §2.1 naming convention table defines `_percent` as 0-100 scale and `_rate` as decimal 0-1. This column stores a 0-100 percentage. The value stored is correctly a percentage (not a decimal rate), but the column exists in the schema both as a computed AIA G703 value and as a read-through input. The concern is that `draw_calc.ts` may apply division by 100 or not depending on which convention it assumes for this column.
- **Impact:** Low risk of silent incorrect draw percentages if `draw_calc.ts` and `draw_line_items.percent_complete` make inconsistent assumptions about scale. Augments the known MEDIUM finding in CONCERNS.md (percentage scale inconsistency) with a specific column in the draw path.
- **Suggested fix:** Add `COMMENT ON COLUMN draw_line_items.percent_complete IS '0-100 scale (e.g. 50.00 = 50%). Compare with retainage_percent convention.'` to prevent future confusion. Validate against `draw-calc.ts` that the read and write are using the same scale.

#### D-4: `retainage_percent` stored as `NUMERIC(5,2)` 0-100 scale while `gc_fee_percentage` / `deposit_percentage` use decimal 0-1 scale — inconsistent convention
- **Location:** `supabase/migrations/00030_phase8_draws_liens_payments.sql:24`, `supabase/migrations/00001_initial_schema.sql:23-24`, `supabase/migrations/00031_phase8c_org_default_retainage.sql:16`
- **Finding:** Already identified in CONCERNS.md as MEDIUM. Confirmed: `retainage_percent` (00030) = 0-100, `gc_fee_percentage` (00001) = 0.0-1.0. Two different scales for percentages in closely related columns on the same table (`jobs`). `draw_calc.ts` handles both but the inconsistency is a latent bug for every future migration or calculation that adds a new percentage column.
- **Impact:** Any developer adding a new percentage column without checking the existing convention will use the wrong scale, causing silent calculation errors in draw math.
- **Suggested fix:** Migration to standardize all percentage columns on one convention. Part 2 §2.1 uses `_rate` for decimal and `_percent` for 0-100 — the naming is correct but the scales are mixed. Recommended: keep `_percent` columns as 0-100, keep `_rate` columns as 0-1. Add CHECK constraints on all: `(retainage_percent >= 0 AND retainage_percent <= 100)` already exists; add `(gc_fee_percentage >= 0 AND gc_fee_percentage <= 1)`.

#### D-5: Trigger `app_private.co_cache_trigger` defined without `SECURITY DEFINER` / `SECURITY INVOKER` annotation
- **Location:** `supabase/migrations/00042_co_cache_trigger.sql:37-55`
- **Finding:** The trigger dispatch function `app_private.co_cache_trigger()` (lines 37-55) does not declare `SECURITY DEFINER` or `SECURITY INVOKER`. PostgreSQL defaults trigger functions to `SECURITY DEFINER` semantics when executed via a trigger, but this is not explicit in the function definition. The inner `refresh_approved_cos_total` function IS `SECURITY DEFINER`, but the dispatch wrapper is not annotated. The GRANT added in 00042 (lines 110-115) grants service_role access to `app_private`, but there is no corresponding grant for `authenticated` calling the trigger indirectly.
- **Impact:** The trigger fires correctly via service_role and admin paths but may fail silently on authenticated-role paths that don't have `USAGE` on `app_private`. Migration 00067 added explicit GRANTs for `authenticated` on `app_private` functions, which closes most of the gap, but the absence of explicit SECURITY posture on the trigger dispatch function makes future audits harder.
- **Suggested fix:** Add `SECURITY DEFINER SET search_path = public, pg_temp` to `app_private.co_cache_trigger()` definition to make the security posture explicit. Pattern established by `refresh_approved_cos_total` in the same file.

#### D-6: `invoice_line_items` `authenticated read` policy uses `USING (true)` — cross-org read if RESTRICTIVE policy dropped
- **Location:** `supabase/migrations/00013_invoice_line_items_and_co_flags.sql:119-121`
- **Finding:** The `authenticated read invoice_line_items` PERMISSIVE policy has `USING (true)`. The RESTRICTIVE org-isolation policy (added in 00016, replaced in 00049) prevents cross-org reads as long as it exists. But if the RESTRICTIVE policy is accidentally dropped, the permissive `USING (true)` exposes all invoice line items across all orgs. Migration 00046 tightened the same pattern on `jobs`, `vendors`, `cost_codes` but did NOT update `invoice_line_items`. This is already noted in CONCERNS.md (SEC-M-2) as partially fixed — the tighten pass missed `invoice_line_items`.
- **Impact:** Same risk as the `jobs`/`vendors`/`cost_codes` pre-00046 state: single RESTRICTIVE policy deletion leaks all invoice line items cross-tenant.
- **Suggested fix:** Add a migration that drops `authenticated read invoice_line_items` and replaces it with `USING (org_id = app_private.user_org_id())`.

#### D-7: `draw_line_items` `authenticated read` policies also use `USING (true)` pattern — same risk
- **Location:** `supabase/migrations/00009_role_based_rls.sql:220-241`
- **Finding:** All draw_line_items SELECT policies (admin/pm) ultimately rely on the RESTRICTIVE org-isolation policy from 00016 for multi-tenant safety. There is no explicit `ENABLE ROW LEVEL SECURITY` for draw_line_items (see D-1) and the read policies were not tightened in 00046.
- **Impact:** Same pattern as D-6. Compound risk with D-1 — if both the RESTRICTIVE policy and the RLS enablement are absent in a fresh deployment, draw_line_items are world-readable.
- **Suggested fix:** Same approach as D-6 — add org_id scoping to the PERMISSIVE read policies.

---

### MEDIUM

#### D-8: `change_orders.status` still accepts `'executed'` via co_cache_trigger filter — stale filter not fully cleaned
- **Location:** `supabase/migrations/00066_co_type_expansion.sql:116-128`
- **Finding:** Migration 00066's updated `refresh_approved_cos_total` function filters `AND status IN ('approved', 'executed')` even though 00060 backfilled all `'executed'` rows to `'approved'` and removed `'executed'` from the CHECK constraint. The filter is defensive (harmless since no rows can have `status='executed'` post-00060) but creates misleading code: a future reader of the trigger will wonder if `'executed'` is a valid status.
- **Impact:** No runtime impact. Code clarity issue — maintenance hazard if the `'executed'` reference is misread as a valid value.
- **Suggested fix:** Update the filter in `refresh_approved_cos_total` to `AND status = 'approved'` and add a comment explaining the historical backfill.

#### D-9: `document_extractions.verification_status` current vs target enum divergence
- **Location:** `supabase/migrations/00076_document_extractions_rename.sql`, Part 2 §2.3
- **Finding:** Current enum (preserved from pre-rename table): `('pending','partial','verified','rejected')`. Part 2 §2.3 target: `('pending','verified','committed','rejected')`. Amendment B in 00076 explicitly documents this divergence as intentional (deferred to Branch 3.8/4). The `'partial'` value has no target-state equivalent; `'committed'` is the new value for what was `auto_committed` boolean. This is a tracked known divergence with a documented convergence plan.
- **Impact:** Any code building Branch 3.2+ classifier that writes `'committed'` to `verification_status` will get a CHECK violation until the convergence migration runs. Must be resolved before the classifier writes to this column.
- **Suggested fix:** No immediate action — documented in plan. Flag as prerequisite for Branch 3.2 classifier work.

#### D-10: `org_members.role` CHECK missing `superintendent` and `field` values
- **Location:** `supabase/migrations/00016_multi_tenant_foundation.sql:97`
- **Finding:** Current CHECK: `('owner','admin','pm','accounting')`. Part 2 §2.3 target: `('owner','admin','pm','accounting','superintendent','field')`. These roles are v2.0 per §1.13 ("not enforced in v1.0 but schema supports them") — so the divergence is intentional scope deferral, not oversight. No migration should add them yet per the plan.
- **Impact:** Attempting to assign `superintendent` or `field` roles to org_members will fail with a CHECK violation until a future migration adds them.
- **Suggested fix:** Document as v2.0 deferred in a COMMENT ON CONSTRAINT. No migration needed now.

#### D-11: `lien_releases.release_type` contains 4 legacy values not in Part 2 §2.3
- **Location:** `supabase/migrations/00030_phase8_draws_liens_payments.sql:81-93`
- **Finding:** Current CHECK includes `'conditional'`, `'unconditional'`, `'partial'`, `'final'` (legacy Phase 5 values) alongside the correct 4-value set from §2.3 (`conditional_progress`, `unconditional_progress`, `conditional_final`, `unconditional_final`). The legacy values were kept for backward compatibility ("Back-compat release_type values kept for any rows already written during Phase 5 scaffolding"). 00030's comment explains this. However, §2.3 defines only 4 values — the 4 legacy values are not in the authoritative enum inventory.
- **Impact:** Any new code can accidentally write the legacy values (`'conditional'`, `'final'`) and get a row that passes the CHECK but does not match any valid §2.3 value. UI code that exhaustively switches on this enum would have silent no-op cases for legacy rows.
- **Suggested fix:** Add a backfill migration that maps `conditional→conditional_progress`, `unconditional→unconditional_progress`, `final→unconditional_final`, `partial→conditional_progress` (or flag for manual review), then drops the legacy values from the CHECK. Verify 0 live rows use legacy values first.

#### D-12: `draws.status` CHECK includes `'locked'` but Part 2 §2.3 target also includes `'locked'` — match confirmed; note `'submitted'` order
- **Location:** `supabase/migrations/00030_phase8_draws_liens_payments.sql:48-57`
- **Finding:** Current `draws.status` CHECK: `('draft','pm_review','submitted','approved','locked','paid','void')`. Part 2 §2.3: `('draft','pm_review','submitted','approved','locked','paid','void')`. **These match.** No drift. Including here for completeness since the earlier CLAUDE.md draw lifecycle showed `'locked'` was added late.
- **Impact:** None. Confirmed match.
- **Suggested fix:** None needed.

#### D-13: `invoices.status` CHECK includes `'received'` and `'ai_processed'` not in Part 2 §2.3 target
- **Location:** `supabase/migrations/00060_align_status_enums.sql:62-74`
- **Finding:** Current CHECK includes `'received'` and `'ai_processed'`. Part 2 §2.3 target invoice status enum starts at `'import_queued'`, does not include `'received'` or `'ai_processed'` as first-class values. These were the CLAUDE.md Phase 1 spec values, replaced in the rebuild plan with the import queue lifecycle. The invoices status CHECK was widened in 00060 to ADD `info_requested`/`info_received` but was not restructured to replace `received`/`ai_processed` with `import_queued` etc.
- **Impact:** Invoices can be set to `'received'` or `'ai_processed'` by legacy API paths, but the Part 2 §2.3 target-state machine has no such states. Code that expects only the §2.3 values will have unexpected cases.
- **Suggested fix:** Branch 1 Phase 1.1 (migration 00060) was the enum alignment migration. This drift survived that pass. A follow-up migration should backfill `received→import_parsed` (or the appropriate target value) and remove `received`/`ai_processed` from the CHECK. Requires coordinating with API routes that still write these values.

#### D-14: `00078_backfill_invoice_allocations_from_line_items.sql` is uncommitted (untracked)
- **Location:** `supabase/migrations/00078_backfill_invoice_allocations_from_line_items.sql`
- **Finding:** Git status shows this file as untracked (`??`). The migration is complete and well-written (idempotent, transactional, with a rollback-safe soft-delete strategy). It cannot be applied via the Supabase CLI migration runner until it is committed. It also cannot be rolled back to a known-good state if a problem occurs. No `.down.sql` pair exists (all other migrations from 00060 onward have one).
- **Impact:** The backfill remains unapplied in any environment that uses migration files as the source of truth. The invoice allocations editor (commit 68115a0) that exposed the discrepancy it fixes is already deployed. Users viewing invoices with multi-cost-code line items will still see the stub allocation until this runs.
- **Suggested fix:** Commit the migration. Write a `.down.sql` that reverses the backfill (restore stub rows from soft-deleted allocations). Then apply via Supabase CLI.

#### D-15: Backfill migrations 00005 and 00013 have no rollback mechanism
- **Location:** `supabase/migrations/00005_backfill_vendors.sql`, `supabase/migrations/00013_invoice_line_items_and_co_flags.sql`
- **Finding:** Both are DML-only backfills that UPDATE/INSERT live data. Neither has a `.down.sql`. 00005 links vendors to invoices; if the link was incorrect (e.g., wrong vendor matched by name), there is no automated rollback path.
- **Impact:** If either backfill produces incorrect data, manual SQL is required to undo. Low practical risk since these ran years ago and data has since been validated.
- **Suggested fix:** Document the rollback procedure as a comment at the top of each migration file. No need for a `.down.sql` at this point.

---

### LOW

#### D-16: `pricing_history.quantity` and `match_confidence` use bare `NUMERIC` without precision
- **Location:** `supabase/migrations/00073_pricing_history.sql:127,138`
- **Finding:** `quantity NUMERIC` and `match_confidence NUMERIC` have no precision/scale specification. Part 2 §2.1 shows `quantity NUMERIC` is acceptable for non-money quantities but `match_confidence` is documented as 0-1 scale — other similar columns use `NUMERIC(4,3)` (e.g., `ai_confidence NUMERIC(4,3)` in 00052).
- **Impact:** Inconsistent precision on confidence columns. Minor — PostgreSQL NUMERIC without scale stores arbitrary precision but the lack of constraint allows any scale.
- **Suggested fix:** Add `NUMERIC(4,3)` to `match_confidence` for consistency with the rest of the codebase.

#### D-17: Migration 00075 slot is intentionally vacant — document in README
- **Location:** Documented in Part 2 §2.2 of `docs/nightwork-rebuild-plan.md` (V1.5/V2.0 naming registry section)
- **Finding:** No `00075_*.sql` file exists. The plan explicitly reserves this slot as a naming-registry-only entry (Phase 2.10 pre-flight abandoned the stub migration). The gap is intentional and documented but will look like an error to a developer unfamiliar with the plan.
- **Impact:** None — Supabase applies migrations sequentially by filename; a missing number does not cause issues.
- **Suggested fix:** Add a `00075_VACANT.md` marker file or a comment in `supabase/migrations/` that explains the vacancy to future developers.

#### D-18: `change_orders` missing `source_document_id` (R.9 provenance)
- **Location:** `supabase/migrations/00001_initial_schema.sql`, no subsequent migration adds it
- **Finding:** R.9 requires `source_document_id UUID` on all drag-createable entities. `change_orders` can be drag-created from a vendor proposal PDF. No migration adds `source_document_id` to `change_orders` (it is on `proposals` per 00065, but not on `change_orders`).
- **Impact:** CO provenance tracking is incomplete — there is no DB-level link from a CO to its source document. Data exists only in application memory.
- **Suggested fix:** Add `source_document_id UUID` to `change_orders` via a migration. No FK until `document_extractions` table fully stabilizes (same pattern as 00065 proposals).

#### D-19: `proposals.vendor_id` is `NOT NULL` but Part 2 §2.2 implies optional
- **Location:** `supabase/migrations/00065_proposals.sql:35`
- **Finding:** `vendor_id UUID NOT NULL REFERENCES public.vendors(id)`. A proposal received via email before the vendor is in the system would require creating a stub vendor first. Some proposals (e.g., internal cost estimates) may not have a vendor. Other entities (`invoices.vendor_id`) are nullable to handle this.
- **Impact:** Minor workflow friction for proposals without a pre-existing vendor record.
- **Suggested fix:** Consider making `vendor_id` nullable on `proposals` to match the `invoices` pattern.

---

## Migration hygiene table

| Migration | Has .down.sql? | Backfill? | Notes |
|---|---|---|---|
| 00001–00059 | ❌ None | Some (00005, 00013, 00040) | Pre-rebuild era; no rollbacks |
| 00060_align_status_enums | ✅ | Yes (backfills CO status) | First migration with rollback |
| 00061_transactional_draw_rpcs | ✅ | No | |
| 00063_lien_release_waived_at | ✅ | No | |
| 00064_job_phase_contract_type | ✅ | Yes (migrates legacy values) | Wrapped in BEGIN/COMMIT |
| 00065_proposals | ✅ | No | |
| 00066_co_type_expansion | ✅ | Yes (backfills co_type + cache) | Has verification RAISE EXCEPTION |
| 00067_co_cache_trigger_grants | ✅ | No | |
| 00068_cost_codes_hierarchy | ✅ | No | |
| 00069_draw_adjustments | ✅ | No | Extensive inline docs |
| 00070_approval_chains | ✅ | Yes (seeds default chains) | |
| 00071_milestones_retainage | ✅ | No | 14 amendments documented |
| 00072_job_milestones_pm_write | ✅ | No | |
| 00073_pricing_history | ✅ | Yes (backfills invoice lines) | Has SECURITY DEFINER triggers |
| 00074_client_portal | ✅ | No | |
| 00075 | — | — | **Intentionally vacant** (naming registry slot) |
| 00076_document_extractions_rename | ✅ | No | Extensive pre-flight amendments A–N |
| 00077_pricing_history_status_trigger | ✅ | No | |
| 00078_backfill_invoice_allocations | ❌ **Missing** | Yes (idempotent backfill) | **UNCOMMITTED** — not in git |

---

## Enum drift vs Part 2 §2.3

| Enum | §2.3 target values | Current CHECK (migration) | Status |
|---|---|---|---|
| `jobs.phase` | lead,estimating,contracted,pre_construction,in_progress,substantially_complete,closed,warranty,archived | Same 9 values (00064) | ✅ Match |
| `jobs.contract_type` | cost_plus_aia,cost_plus_open_book,fixed_price,gmp,time_and_materials,unit_price | Same 6 values (00064) | ✅ Match |
| `jobs.status` | active,inactive | active,complete,warranty,cancelled (00001) | ❌ Drift — §2.3 says active/inactive; schema has 4 legacy values |
| `invoices.status` | import_queued,import_parsing,import_parsed,import_duplicate,import_error, pm_review,pm_approved,pm_held,pm_denied, qa_review,qa_approved,qa_kicked_back, info_requested,info_received, in_draw,paid,void | Same plus 'received','ai_processed' (00060) | ⚠️ Superset — contains legacy values not in §2.3 (D-13) |
| `invoices.payment_status` | unpaid,scheduled,partial,paid | unpaid,scheduled,paid,partial (00030) | ✅ Match (order differs, values same) |
| `change_orders.status` | draft,pending,approved,denied,void | Same 5 values (00060) | ✅ Match |
| `change_orders.co_type` | owner_requested,designer_architect,allowance_overage,site_condition,internal | Same 5 values (00066) | ✅ Match |
| `change_orders.pricing_mode` | hard_priced,budgetary,allowance_split | Same 3 values (00066) | ✅ Match |
| `purchase_orders.status` | draft,issued,**accepted**,partially_invoiced,fully_invoiced,closed,void | draft,issued,partially_invoiced,fully_invoiced,closed,void (00028) | ❌ Missing `accepted` (D-2) |
| `proposals.status` | received,under_review,accepted,rejected,superseded,converted_to_po,converted_to_co | Same 7 values (00065) | ✅ Match |
| `draws.status` | draft,pm_review,submitted,approved,locked,paid,void | Same 7 values (00030) | ✅ Match |
| `draws.draw_mode` | aia,milestone,tm | Same 3 values (00071) | ✅ Match |
| `lien_releases.status` | pending,received,waived,not_required | Same 4 values (00030) | ✅ Match |
| `lien_releases.release_type` | conditional_progress,unconditional_progress,conditional_final,unconditional_final | 8 values — target 4 PLUS legacy conditional,unconditional,partial,final (00030) | ⚠️ Superset — legacy values remain (D-11) |
| `document_extractions.classified_type` | invoice,purchase_order,change_order,proposal,vendor,budget,historical_draw,plan,contract,other | Same 10 values (00076) | ✅ Match |
| `document_extractions.verification_status` | pending,verified,committed,rejected | pending,partial,verified,rejected (00076 preserved) | ❌ Drift — `partial` not in §2.3; `committed` not in current CHECK (D-9) |
| `document_extraction_lines.verification_status` | pending,verified,corrected,rejected,auto_committed,not_item | Same 6 values (00052) | ✅ Match |
| `document_extraction_lines.line_nature` | material,labor,scope,equipment,service,bom_spec,unclassified | Same 7 values (00052) | ✅ Match |
| `org_members.role` | owner,admin,pm,accounting,superintendent,field | owner,admin,pm,accounting (00016) | ⚠️ Missing superintendent,field — v2.0 deferred (D-10) |
| `approval_chains.workflow_type` | invoice_pm,invoice_qa,co,draw,po,proposal | Same 6 values (00070) | ✅ Match |
| `pricing_history.source_type` | invoice,proposal,po,co | Same 4 values (00073) | ✅ Match |

**Summary:** 3 hard mismatches (`jobs.status`, `purchase_orders.status`, `document_extractions.verification_status`), 3 supersets with legacy values (`invoices.status`, `lien_releases.release_type`, `org_members.role`).

---

## TS type drift

Only one TS type file exists: `src/lib/types/invoice.ts`. It defines `ParsedInvoice`, `ParsedLineItem`, `ParseResult` etc. — these are the Claude Vision API parse output shapes, not DB row shapes. There are no TS types directly mirroring DB tables (no `Invoice`, `Job`, `Draw` row types in `src/lib/types/`). This means:

- **No drift risk from TS types** on the schema side — there are no competing type definitions to diverge.
- **Gap risk**: API routes use inline type assertions or Supabase's auto-generated types (if present). Without an explicit `src/lib/types/db.ts` or similar, every route that queries the DB relies on implicit typing or the Supabase generated types. A column rename in a migration does not produce a TS compile error.

The `src/lib/guards/` directory does not exist (Glob returned no results). The ARCHITECTURE.md references `src/lib/deletion-guards.ts` directly (not a `guards/` subdirectory). No guards-specific type drift was found.

---

## NUMERIC / money column audit

All money columns in core financial tables are correctly `BIGINT` cents. The `NUMERIC` occurrences in migrations are:

**Legitimately non-BIGINT (non-money):**
- Percentage columns (`gc_fee_rate`, `deposit_percentage`, `retainage_percent`, `retainage_threshold_percent`, `retainage_dropoff_percent`) — correctly NUMERIC per R.8 (cents rule applies to monetary amounts)
- Confidence scores (`confidence_score`, `ai_confidence`, `match_confidence`, `classification_confidence`) — correctly NUMERIC (0-1 scale)
- Quantities (`qty`, `quantity`, `raw_quantity`) — correctly NUMERIC (not money)
- Unit conversion ratios (`suggested_ratio`, `confirmed_ratio`) — correctly NUMERIC
- `draws.tm_labor_hours` — correctly NUMERIC per Amendment H comment in 00071 ("hours are not money")
- `scope_size_value`, `scope_size_confidence` — correctly NUMERIC

**No `REAL`, `FLOAT`, `DOUBLE PRECISION` found anywhere in migrations.** R.8 is respected for all monetary columns.

---

## R.2 (recalculate, never increment) audit

All trigger functions found use `SELECT SUM(...)` recalculation pattern:
- `refresh_approved_cos_total` (00042, 00066) — `SUM(total_with_fee)` ✅
- `recompute_budget_line_committed` (referenced in 00028, patched in 00034) — `SUM(amount)` ✅
- `recompute_budget_line_invoiced` — pattern confirmed via 00034 ✅
- `recompute_po_invoiced` — pattern confirmed via 00034 ✅
- `recompute_budget_line_co_adjustments` — pattern confirmed via 00034 ✅

One finding: `purchase_orders.invoiced_total` is listed in 00028 as a column to be maintained by trigger. The trigger `trg_invoices_status_po_sync` / `trg_invoice_line_items_po_sync` in 00028 uses `SET invoiced_total = COALESCE(...)` with a subquery, which is recalculate not increment ✅. The `committed` column in 00028:221 uses `SET committed = COALESCE((SELECT SUM...)...)` — recalculate pattern ✅.

**No R.2 violations found.**

---

## Positive observations

1. **Migration discipline after 00060 is strong.** Every post-00060 migration has: paired `.down.sql`, inline rationale comments, explicit `public.` schema qualification (per G.9), idempotent patterns, and appropriate use of transactions.

2. **Backfill verification probes.** Migration 00066 uses a `RAISE EXCEPTION` guard to abort if the post-backfill cache sum diverges from a pre-migration captured total. This is excellent practice and should be adopted by future backfill migrations.

3. **Trigger SECURITY DEFINER + search_path pinning.** Migrations 00034, 00067, 00070, 00073 all add explicit `SECURITY DEFINER SET search_path = public, pg_temp` on trigger functions, closing the GH #9 class of authenticated-role permission gaps.

4. **Money columns.** No floating-point money columns found. R.8 compliance is excellent across all 78 migrations.

5. **Soft delete consistency.** Every table has `deleted_at TIMESTAMPTZ`. Every major query path correctly filters `WHERE deleted_at IS NULL`.

6. **Optimistic locking infrastructure.** `updateWithLock()` is referenced in ARCHITECTURE.md and the `expected_updated_at` pattern is established. The `updated_at` trigger is on every table from 00001.

7. **Platform admin cross-tenant RLS (00049).** The platform admin bypass pattern is carefully constructed: PERMISSIVE platform-admin read policies allow cross-tenant SELECT but the ORG-scoped RESTRICTIVE policies still block mutations, and every admin action is audit-logged to `platform_admin_audit`.

8. **Pricing history trigger backfill (00073).** The backfill INSERT...SELECT at migration apply time means existing approved invoice lines immediately populate the pricing history table — no separate backfill script needed.
