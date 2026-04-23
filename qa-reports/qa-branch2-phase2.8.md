# QA — Branch 2 Phase 2.8: Pricing history table

**Date:** 2026-04-23
**Migration:** `supabase/migrations/00073_pricing_history.sql` (+ `.down.sql`)
**Applied version:** `20260423023749` → `00073_pricing_history`
**Plan-amendment commit:** `643b669` (14 amendments A–N + O)
**Pre-flight findings:** `qa-reports/preflight-branch2-phase2.8.md` (commit `7bc4db0`)
**HEAD at kickoff:** `643b669` (clean working tree; `git pull` up to date)

---

## §1 Summary

Phase 2.8 ships `public.pricing_history` — a trigger-populated append-only audit spine capturing pricing observations across 4 source entities (invoice / proposal / po / co) on parent-entity "pricing-committed" status transitions. **First Branch 2 phase outside the 3-policy RLS family** — adopts a 1-policy (single SELECT, no INSERT/UPDATE/DELETE) shape documented as intentional R.23 divergence with `activity_log` as the closest precedent. Immutability contract (no soft-delete, no UPDATE) is load-bearing for pricing-intelligence signal integrity; correction procedure is platform-admin service-role DELETE only.

**Apply outcome:** clean. 112-row backfill from `qa_approved` invoice lines. All 305 tests across 14 test files pass (42 new Phase 2.8 tests added). `npm run build` clean.

---

## §2 Amendments executed (A–N + O)

| ID | Amendment | Executed? |
|---|---|---|
| A | Audit columns: `created_at NOT NULL DEFAULT now()` + nullable `created_by` FK; no `updated_at`; no `deleted_at` | ✅ |
| B | RLS 1-policy shape (R.23 divergence) — single SELECT, no INSERT/UPDATE/DELETE | ✅ |
| C | Immutable append-only (Option A): no `deleted_at`, full (non-partial) `UNIQUE (source_type, source_line_id)`, header correction procedure | ✅ |
| D | `public.` qualification on every DDL statement | ✅ |
| E | `canonical_item_id UUID REFERENCES public.items(id)` wired now (ON DELETE NO ACTION) | ✅ |
| F | `match_confidence NUMERIC CHECK (… >= 0 AND … <= 1)` | ✅ |
| G | 5 indexes: cost_code + date DESC, vendor + date DESC, trigram GIN, job + date DESC partial, source_lookup | ✅ |
| H | Trigger target rename: `purchase_order_line_items` → `public.po_line_items` | ✅ |
| I | PO parent-entity resolution: vendor_id via `purchase_orders.vendor_id`, date via `issued_date` + `created_at::date` fallback, NULL for q/u/up | ✅ |
| J | 4 trigger functions `SECURITY DEFINER` + pinned `search_path = public, pg_temp` + explicit `GRANT EXECUTE TO authenticated` | ✅ |
| K | Paired `00073_pricing_history.down.sql` (reverse-dependency order) | ✅ |
| L | R.15 test file `__tests__/pricing-history.test.ts` with regression fences (42 tests, all passing) | ✅ |
| M | Backfill Interpretation B: invoice-only, qa_approved gated | ✅ (112 rows) |
| N | Header documentation: R.23 divergence, activity_log precedent, correction procedure, Amendment H rename, Amendment I resolution, Amendment J lineage (00032→00067→00070), Amendment M backfill, GH #16 | ✅ |
| O | GH #16 opened (pre-execution, `2026-04-23 02:12 UTC`) — tracks Branch 3/4 signal-quality validation before enabling user-facing matching UI | ✅ |

---

## §3 Execution-phase RUNTIME discoveries (beyond pre-flight §1.3)

The pre-flight caught 1 spec defect (Amendment H: `purchase_order_line_items` does not exist). Schema Validator pre-probes during execution surfaced **4 additional material plan-spec defects** that would have broken any verbatim copy of the plan-doc trigger SQL. Documented in the migration header RUNTIME NOTE and fixed inline.

### §3.1 Defect #1 — `invoice_line_items` column names

Plan-doc spec uses `NEW.quantity`, `NEW.unit_price`, `NEW.amount`. Actual columns: `qty`, `rate`, `amount_cents`.

**Resolution:** invoice trigger + backfill use actual column names. Mapping:
- `qty` → `pricing_history.quantity`
- `rate` → `pricing_history.unit_price` (with conversion — see Defect #2)
- `amount_cents` → `pricing_history.amount`

### §3.2 Defect #2 — `invoice_line_items.rate` semantic (dollars, not cents)

Probe-sampled 10 rows; every sample satisfies `rate * qty * 100 = amount_cents`. Confirms `rate` is stored in dollars (NUMERIC), not cents. `pricing_history.unit_price` is BIGINT cents per R.8.

**Resolution:** convert via `CASE WHEN rate IS NOT NULL THEN ROUND(rate * 100)::BIGINT ELSE NULL END` in both the invoice trigger and the Amendment M backfill.

**Probe P3 verifies:** inserting `rate=75` + `qty=2` produces `unit_price=7500, quantity=2, amount=15000` in pricing_history. PASS.

### §3.3 Defect #3 — `change_orders` has NO `vendor_id` column

Plan-doc spec's CO trigger SELECTs `_co.vendor_id`. `information_schema.columns` confirms no such column on `public.change_orders`.

**Resolution:** CO trigger omits `vendor_id` from the parent SELECT and inserts `NULL` for `pricing_history.vendor_id`. Documented in trigger COMMENT.

### §3.4 Defect #4 — `change_order_lines` column shape

Plan-doc spec uses `NEW.change_order_id`, `NEW.cost_code_id`, `NEW.quantity`, `NEW.unit`, `NEW.unit_price`. Actual columns: `co_id` (not change_order_id), `cost_code` TEXT (not cost_code_id UUID), description, amount, gc_fee_amount — no quantity/unit/unit_price columns.

**Resolution:** CO trigger uses `NEW.co_id`, inserts `NULL` for quantity/unit/unit_price (same asymmetry as po_line_items under Amendment I), and resolves `cost_code` TEXT to `cost_codes.id` via `(code, org_id)` lookup.

### §3.5 Regression guardrail

Runtime NOTE in the migration header explicitly instructs future fixers: **do NOT "correct" this migration back to the plan-doc spec column names — the probe-verified column set is the authoritative one.** The R.15 regression fences assert the actual-column behavior (PO trigger NULL q/u/up, idempotency, status gates) which would break if a future fixer reverts.

---

## §4 Schema Validator probes

### §4.1 Pre-apply probes

| Probe | Expected | Actual |
|---|---|---|
| Last applied migration | `00072_job_milestones_pm_write_narrowing` | ✅ |
| `pricing_history` pre-exists? | NO | ✅ (null) |
| `po_line_items` exists? | YES | ✅ |
| `purchase_order_line_items` exists? | NO (Amendment H guard) | ✅ (null) |
| `public.items` exists? (Amendment E FK target) | YES | ✅ |
| `invoice_line_items`, `proposal_line_items`, `change_order_lines` exist? | YES × 3 | ✅ |
| `activity_log` exists? (R.23 precedent) | YES | ✅ |
| `pg_trgm` extension installed? | YES | ✅ (v1.6, schema `public`) |
| `purchase_orders.issued_date` column? | YES (Amendment I source) | ✅ (date, nullable) |
| qa_approved invoice_line_items with non-null job_id | 112 expected | ✅ (backfill landed exactly 112) |

### §4.2 Post-apply structural probes

| Structure | Expected | Actual |
|---|---|---|
| Column count on `pricing_history` | 18 | ✅ (id, org_id, job_id, source_type, source_id, source_line_id, vendor_id, cost_code_id, description, quantity, unit, unit_price, amount, date, canonical_item_id, match_confidence, created_at, created_by) |
| `updated_at` present? | NO (Amendment A) | ✅ (absent) |
| `deleted_at` present? | NO (Amendment C) | ✅ (absent) |
| Indexes | 5 spec'd + pkey + unique | ✅ (7 total) |
| `idx_pricing_history_job` partial predicate | `WHERE job_id IS NOT NULL` | ✅ |
| `idx_pricing_history_description_trgm` method | GIN with `gin_trgm_ops` | ✅ |
| RLS enabled on `pricing_history` | YES | ✅ (`relrowsecurity = true`) |
| Policies on `pricing_history` | Exactly 1 SELECT (`pricing_history_org_read`) | ✅ (polcmd = 'r') |
| INSERT / UPDATE / DELETE policies | NONE | ✅ (none — Amendment B regression fence holds at DB level) |
| 4 trigger functions `prosecdef = true` | SECURITY DEFINER × 4 | ✅ |
| 4 trigger functions `proconfig` | `search_path=public, pg_temp` × 4 | ✅ |
| GRANT EXECUTE TO authenticated on all 4 | YES (Amendment J / F.2) | ✅ (`has_function_privilege` = true × 4) |
| CREATE TRIGGER registrations | 4 triggers × {INSERT, UPDATE} = 8 rows in `information_schema.triggers` | ✅ |
| `source_type` CHECK enum | IN ('invoice','proposal','po','co') | ✅ |
| `match_confidence` CHECK range | `>= 0 AND <= 1` OR NULL | ✅ |
| `canonical_item_id` FK | REFERENCES `public.items(id)` | ✅ |
| UNIQUE (source_type, source_line_id) | full, non-partial | ✅ (no WHERE predicate) |

### §4.3 Negative probes (4 probes — all PASS)

| Probe | Action | Expected | Actual |
|---|---|---|---|
| N1 | INSERT with `source_type='invalid_type'` | check_violation | ✅ raised |
| N2 | INSERT with `match_confidence=1.5` | check_violation | ✅ raised |
| N3 | INSERT with `canonical_item_id=<random uuid>` | foreign_key_violation | ✅ raised |
| N4 | INSERT duplicate `(source_type, source_line_id)` | unique_violation | ✅ raised |

### §4.4 Positive trigger probes (8 probes — all PASS, all BEGIN/ROLLBACK-scoped)

| Probe | Action | Expected | Actual |
|---|---|---|---|
| P1 | Insert `invoice_line_items` where parent invoice is `pm_review` | no new pricing_history row | ✅ 112 → 112 |
| P2 | Insert `invoice_line_items` where parent invoice is `qa_approved` | +1 pricing_history row | ✅ 112 → 113 |
| P3 | Verify P2 row: `rate=75` (dollars) → `unit_price=7500` (cents); qty=2; amount=15000 | rate dollar→cents conversion preserved | ✅ `unit_price=7500, quantity=2, amount=15000` |
| P4 | UPDATE the line from P2 | ON CONFLICT DO NOTHING prevents duplicate | ✅ 113 → 113 (idempotency holds) |
| P5 | Create PO `status='issued'` + po_line_items insert | +1 row; vendor_id + date + cost_code resolved via parent; q/u/up NULL | ✅ `vendor_resolved=true, date=2026-04-10, q/u/up_null=true, cost_code_resolved=true` |
| P6 | Create PO `status='draft'` + po_line_items insert | no new pricing_history row | ✅ 113 → 113 |
| P7 | Create CO `status='approved'` + change_order_lines insert | +1 row; vendor_id NULL (no vendor on CO); q/u/up NULL; cost_code resolved | ✅ `vendor_null=true, date=2026-04-15, q/u/up_null=true, cost_code_resolved=true` |
| P8 | Create CO `status='draft'` + change_order_lines insert | no new pricing_history row | ✅ 114 → 114 |

### §4.5 Live-auth RLS probes (5 probes — all PASS, all BEGIN/ROLLBACK-scoped)

| Probe | Role | Action | Expected | Actual |
|---|---|---|---|---|
| L1 | Ross Built PM (`a0000000-…-006`) | SELECT | visible_rows = 112 (own org) | ✅ 112 |
| L2 | Cross-org owner (`34760e08-…`) | SELECT | visible_rows = 0 | ✅ 0 (org isolation) |
| L3 | Ross Built PM | INSERT | blocked (no INSERT policy) | ✅ blocked (RLS default-deny) |
| L4 | Ross Built PM | UPDATE | 0 rows affected | ✅ 0 rows tampered |
| L5 | Ross Built PM | DELETE | 0 rows affected | ✅ 0 rows deleted |

### §4.6 Amendment F.2 GRANT-verification probes (4 probes — all PASS)

| Function | `has_function_privilege('authenticated', …, 'EXECUTE')` |
|---|---|
| `public.trg_pricing_history_from_invoice_line()` | ✅ `true` |
| `public.trg_pricing_history_from_proposal_line()` | ✅ `true` |
| `public.trg_pricing_history_from_po_line()` | ✅ `true` |
| `public.trg_pricing_history_from_co_line()` | ✅ `true` |

---

## §5 Backfill (Amendment M) — signal-quality gate for GH #16

### §5.1 Row count verification

| Metric | Value |
|---|---|
| Expected (qa_approved invoice_line_items with non-null job_id + parent not soft-deleted) | **112** |
| Actual (post-apply `SELECT COUNT(*) FROM pricing_history WHERE source_type='invoice'`) | **112** |
| Diff | **0** ✅ |

### §5.2 Aggregate signal-quality

| Signal | Count | Ratio |
|---|---|---|
| Total backfilled rows | 112 | 100% |
| Rows with non-null `vendor_id` | 112 | **100%** (strong signal — every Ross Built invoice has vendor attribution) |
| Rows with non-null `cost_code_id` | 95 | 85% (17 rows missing cost-code assignment — legacy invoices often unassigned) |
| Rows with non-null `quantity` | 96 | 86% |
| Rows with non-null `unit` | 74 | 66% |
| Rows with non-null `unit_price` | 96 | 86% |
| Rows with empty description | 0 | 0% (all rows have description text) |
| Amount range (cents) | -5,035,000 → 6,056,700 | ($-50,350 credit memo → $60,567 max invoice line) |
| Date range | 2020-02-04 → **2027-03-25** | ⚠ see §5.4 anomaly |

### §5.3 5-row sample spot-check

| Description | qty | unit | unit_price (cents) | amount (cents) | date | vendor | cost_code |
|---|---|---|---|---|---|---|---|
| 1/4 X 1-1/2 LATTICE 8ft PVC | 2 | EA | 1099 | 2198 | 2027-03-25 ⚠ | ✓ | ✗ |
| Energy Usage History - Monthly data points… | — | — | — | 3665 | 2026-05-01 | ✓ | ✗ |
| Electric utility charges | — | — | — | 30645 | 2026-04-17 | ✓ | ✓ |
| Labor & material to furnish & install two one-inch conduit sleeves… | 1 | — | 98956 | 98956 | 2026-04-10 | ✓ | ✓ |
| SCREW TRIM T15 BRN 2-1/2INXNO8 | 1 | BX | 2869 | 2869 | 2026-04-06 | ✓ | ✓ |

Math sanity (rows with qty + unit_price): `2 × $10.99 = $21.98` ✓; `1 × $989.56 = $989.56` ✓; `1 × $28.69 = $28.69` ✓. Dollar→cents conversion correct on backfill.

### §5.4 Anomalies flagged for GH #16 review

1. **Future date (2027-03-25)** on one backfilled row — AI-parsed invoice date is ~1 year in the future. Classic signal-quality issue GH #16 exists to gate on.
2. **17 rows missing cost_code_id** (15%) — Branch 3/4 matching UI should surface these for human review before relying on pricing intel from them.
3. **Negative amount** (-$50,350) represents a credit memo — correctly preserved, no transformation needed.
4. **Partial quantity/unit coverage** (86% / 66%) — some invoices are lump-sum with no line-item detail; expected for Ross Built's mix of clean-PDF vendors vs. lump-sum Word-doc vendors.

No blocking issues — the backfill is usable as historical reference data. GH #16 appropriately gates the user-facing matching UI on human review of the 15–20% lower-signal-quality rows before Branch 3/4 ships.

---

## §6 R.19 carve-out — both conditions cited

Phase 2.8 qualifies for the R.19 static-validation carve-out (both conditions hold):

1. **Static R.15 test file shipped** — `__tests__/pricing-history.test.ts` (42 regex assertions against migration SQL, all passing).
2. **Dynamic probes executed in Migration Dry-Run** — this QA report §4.3–§4.6 + §5 (17 probes total: 4 negative, 8 positive/gate, 5 live-auth, plus backfill verification). All pass.

---

## §7 R.23 divergence statement

Phase 2.8 is the **first Branch 2 phase outside the 3-policy RLS family**. The 3-policy family — proposals/00065, draw_adjustments/00069, approval_chains/00070, job_milestones/00071+00072 — all ship SELECT/INSERT/UPDATE policies with role-narrowed writes. `pricing_history` diverges to a **1-policy shape** (single SELECT; no INSERT/UPDATE/DELETE) because it is neither workflow data nor tenant config — it is a **trigger-populated append-only audit spine**.

**Closest prior precedent: `activity_log`** (also trigger-populated; append-only; service-role writes). activity_log ships 4 policies on the older RESTRICTIVE-layered pattern; Phase 2.8 adopts a cleaner modern 1-policy shape with RLS default-deny + no write policies.

**Why 1-policy is load-bearing:**
- Triggers are `SECURITY DEFINER` → bypass RLS on writes → no INSERT policy needed
- Append-only contract (Amendment C) → no UPDATE path exists → no UPDATE policy needed
- Correction path is platform-admin service-role SQL DELETE only → no DELETE policy needed
- Adding any write policy would violate the pricing-intelligence signal-integrity contract

**Regression fence:** R.15 test asserts exactly 1 policy (`cmd='r'`) and explicitly rejects any CREATE POLICY FOR INSERT/UPDATE/DELETE/ALL on pricing_history. Future fixer cannot silently widen the surface without this test failing.

---

## §8 Branch 2 Final Exit Gate progress

**Target:** 12 migrations applied on dev (00064 → 00075 with 3 insertions: 00067, 00069, 00072)

| # | Migration | Applied? |
|---|---|---|
| 1 | 00064 job_phase_contract_type | ✅ (Phase 2.1) |
| 2 | 00065 proposals | ✅ (Phase 2.2) |
| 3 | 00065_amended proposals 3-policy | ✅ (Phase 2.2 follow-up) |
| 4 | 00066 co_type_expansion | ✅ (Phase 2.3) |
| 5 | 00067 co_cache_trigger_authenticated_grants | ✅ (Phase 2.3 follow-up — Amendment F.2 genesis) |
| 6 | 00068 cost_codes_hierarchy | ✅ (Phase 2.4) |
| 7 | 00069 draw_adjustments | ✅ (Phase 2.5) |
| 8 | 00070 approval_chains | ✅ (Phase 2.6) |
| 9 | 00071 milestones_retainage | ✅ (Phase 2.7) |
| 10 | 00072 job_milestones_pm_write_narrowing | ✅ (Phase 2.7 §5.7 addendum) |
| 11 | **00073 pricing_history** | ✅ **(Phase 2.8 — THIS PHASE)** |
| 12 | 00074 client_portal | ⏳ (Phase 2.9 — pending) |
| 13 | 00075 (TBD — originally sprint_analytics, now Phase 2.10) | ⏳ (Phase 2.10 — pending) |

**Progress: 11 of 12 migrations applied on dev.** (One more at 00074; final Phase 2.10 will consume a new number.) Branch 2 is 8 of 10 phases complete post-Phase 2.8.

---

## §9 Test results

### §9.1 R.15 static suite — `__tests__/pricing-history.test.ts`

Baseline (pre-migration): **42 of 42 tests failed** (ENOENT on missing migration file). Expected — test-first R.15 captures before-state.

Post-migration: **42 of 42 tests pass**. All 14 Amendment categories (A, B, C, D, E, F, G, H, I, J, K, L, M, N+O documentation) fenced.

### §9.2 Full npm test

```
14 test files, all passing:
- approval-chains.test.ts                         30 passed
- co-type-expansion.test.ts                       32 passed
- cost-codes-hierarchy.test.ts                    24 passed
- created-by-populated.test.ts                    15 passed
- draw-adjustments.test.ts                        29 passed
- draw-rpc-cascade.test.ts                        11 passed
- job-milestones-pm-write-narrowing.test.ts       11 passed
- job-phase-contract-type.test.ts                 17 passed
- lien-release-waived-at.test.ts                   9 passed
- milestones-retainage.test.ts                    34 passed
- po-patch-role-check.test.ts                      4 passed
- pricing-history.test.ts                         42 passed  ← NEW
- proposals-schema.test.ts                        27 passed
- status-enum-alignment.test.ts                   20 passed

Total: 305 tests passing (was 263 pre-Phase 2.8)
```

### §9.3 npm run build

Clean. Route tree compiled; no type errors; no missing module errors.

---

## §10 Open follow-ups

None blocking. The 4 RUNTIME defects (§3) are fixed inline with regression fences. GH #16 already open and tracks the Branch 3/4 signal-quality review before user-facing matching UI ships.

No new GH issues needed from Phase 2.8 execution.
