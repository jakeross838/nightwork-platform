# Phase 3.1 — Schema rename (invoice_extractions → document_extractions) — Pre-Flight Findings

**Date:** 2026-04-23
**Plan section:** `docs/nightwork-rebuild-plan.md:5556-5575`
**Migration slot:** `00076` (Phase 2.10 reframe left `00075` reserved-unused; Branch 3 picks up at `00076`)
**Verdict:** **READY TO EXECUTE WITH 14 AMENDMENTS (A–N).** No blockers. One material scope-drift flag (plan-internal conflict between Phase 3.1 phase-spec and Part 2 §2.2 architecture target) needs an explicit decision — pre-flight recommends **strict-minimal scope** (rename + 3 new columns, preserve all existing columns), with Part 2 §2.2 reconciled to the delivered shape.
**R.19 status:** Non-schema-only phase. Live regression testing IS required (first since Branch 1). Plan drafted in §8 below.

---

## §1 — Confirmed scope (and scope-drift reconciliation)

### 1.1 Phase 3.1 phase-spec (plan lines 5556–5575)

Verbatim, the phase-spec says:

> Rename `invoice_extractions` → `document_extractions`, same for lines. Add `classified_type`, `target_entity_type`, `target_entity_id`.
> Migration, code rename cascade (routes, types, components), verify existing invoice flow still works post-rename.
> Rebuild-vs-patch call: REBUILD.

Exit Gate names migration `00072` [STALE — Amendment A corrects to `00076`], grep validator zero-refs, regression-test invoice flow, new columns populate on new ingest, RLS follows, QA report.

### 1.2 Part 2 §2.2 architecture target (plan lines 1945–1968)

`document_extractions` target columns:

- `id, org_id, uploaded_by` (note: `invoice_id` FK NOT listed in target)
- `original_file_url, original_filename, file_type, file_size`
- `classified_type` (10-val CHECK)
- `classification_confidence`
- `target_entity_type, target_entity_id`
- `verification_status` (4-val: `pending|verified|committed|rejected` — **different from current 4-val `pending|partial|verified|rejected`**)
- `extracted_data JSONB`
- `skipped_lines JSONB`
- `error_message`
- `created_at, committed_at, rejected_at`

`document_extraction_lines` target also heavily reshaped (rename `line_order`→`sort_order`; rename `invoice_line_item_id`→`target_line_id`; split `proposed_item_id` into `proposed_cost_code_id` + `proposed_vendor_id`; rename money/unit columns; add `line_nature` [ALREADY EXISTS via 00058]; etc.).

### 1.3 **Material scope drift — plan-internal inconsistency**

**The phase-spec (1.1) and the architecture target (1.2) do not agree on Phase 3.1's scope.** Evidence:

| Column / object | Current (post-00074) | Phase 3.1 spec says | Part 2 §2.2 target says |
|---|---|---|---|
| `invoice_id` NOT NULL FK | EXISTS | untouched (rename only) | DROPPED |
| `uploaded_by` | absent | untouched | ADDED |
| `original_file_url` etc. file metadata | absent | untouched | ADDED (4 cols) |
| `classification_confidence` | absent | untouched | ADDED |
| `extracted_data JSONB` | absent (we have `field_confidences`) | untouched | ADDED |
| `error_message`, `committed_at`, `rejected_at` | absent | untouched | ADDED (3 cols) |
| `extraction_model`, `_prompt_version`, tokens, `field_confidences`, `verified_lines_count`, `total_lines_count`, `auto_committed*`, `raw_ocr_text`, `raw_pdf_url`, `invoice_subtotal_cents`, etc. | EXIST (14 cols) | untouched | NOT IN TARGET |
| `verification_status` CHECK | `('pending','partial','verified','rejected')` | untouched | `('pending','verified','committed','rejected')` — **semantically incompatible** (`partial` vs `committed`) |
| `classified_type, target_entity_type, target_entity_id` | absent | ADD (3 cols) | present in target |

**Plan line 5570 exit-gate text** only names `classified_type` and `target_entity_type` as "populate correctly on new invoice ingest" — which is consistent with the phase-spec, not the Part 2 §2.2 target.

### 1.4 Recommended scope resolution — **Amendment B**

Phase 3.1 follows the **phase-spec** (strict-minimal): rename both tables, add 3 new columns, preserve all existing columns and existing `verification_status` value set. Part 2 §2.2 gets a plan-doc amendment noting the **delivered shape** (current 27/45-col tables + 3 new cols), not the pre-delivery ideal shape. Columns the Part 2 §2.2 ideal lists but current does not have (`uploaded_by`, `original_file_*`, `extracted_data`, `error_message`, `committed_at`, `rejected_at`, line-side `proposed_cost_code_id`/`proposed_vendor_id`/`target_line_id`/`sort_order`) become **deferred to a later Branch 3 convergence phase** (post-Phase 3.10). Columns the current has but Part 2 §2.2 ideal omits (`extraction_model`, tokens, `field_confidences`, `raw_*`, `invoice_*_cents`, `auto_committed*`, `verified_lines_count`, `total_lines_count`) **stay** — they are load-bearing for 36 src/ files and the active ~56-row invoice extraction pipeline.

Rationale:
- User preflight prompt (lines 108–111) explicitly lists 3-col scope and warns "if the actual spec has grown beyond … flag as scope drift before proceeding" — strict-minimal honors the intent.
- REBUILD call at line 5562 refers to "the generalization is core" — the **rename** is what's rebuilt (not patched by e.g. a `documents` view); the 3 new cols are the generalization hooks for downstream Phases 3.2–3.10. Further column rationalization is not "core" and can be incremental.
- Touching the `verification_status` enum in Phase 3.1 would cascade to the index predicate `idx_invoice_extractions_pending WHERE verification_status IN ('pending','partial')` + the `iel_status_rollup` trigger that writes `'partial'` + the `ExtractionStatus` TS type + at least 10 UI filter paths. Out of scope for Phase 3.1.
- `invoice_id` FK drop requires backfill of `target_entity_id` + removal of unique index `idx_invoice_extractions_invoice` (enforces 1:1 invoice↔extraction) + code-path migration for ~20 src/ files that currently `SELECT ... WHERE invoice_id = $1`. Out of scope.

### 1.5 Confirmed scope (post-Amendment B)

SQL:
- `ALTER TABLE invoice_extractions RENAME TO document_extractions`
- `ALTER TABLE invoice_extraction_lines RENAME TO document_extraction_lines`
- `ALTER TABLE document_extractions ADD COLUMN classified_type TEXT` with CHECK (10-val or NULL)
- `ALTER TABLE document_extractions ADD COLUMN target_entity_type TEXT` with CHECK (7-val or NULL)
- `ALTER TABLE document_extractions ADD COLUMN target_entity_id UUID` (no FK; app-layer integrity)
- Rename dependent database objects (policies, constraints, triggers, indexes, unique index) to match new table name — Amendment G below
- Data backfill for 56 active rows — Amendment F below
- Paired `00076_document_extractions_rename.down.sql`

Code:
- Rename table references in 36 src/ files, 5 scripts/ files, 0 __tests__/ files (!) — 131 total refs
- Rename TS types: `InvoiceExtractionRow` → `DocumentExtractionRow`, `InvoiceExtractionLineRow` → `DocumentExtractionLineRow`, `ExtractionStatus` → `DocumentExtractionStatus` (26 refs across 7 src/ files)
- Rename imports, variable names, SQL strings in RPC/helper paths

---

## §2 — Scope-drift flags (summary)

| Flag | Severity | Reference | Disposition |
|------|----------|-----------|-------------|
| Phase-spec vs Part 2 §2.2 target conflict | **HIGH** | plan 5558 vs 1945-1968 | Amendment B — strict-minimal, reconcile §2.2 post-delivery |
| Stale "Migration 00072" in Phase 3.1 Exit Gate | LOW (known, carry-forward) | plan 5567 | Amendment A — update to 00076 |
| `verification_status` enum divergence (`partial` vs `committed`) | MEDIUM | plan 2112 vs DB | Amendment B — keep current enum, defer reconciliation |
| Dependent-object names reference old table (policies, triggers, indexes, constraints) | LOW-MEDIUM | probe results §4 | Amendment G — explicit renames for schema-doc hygiene |
| 5 downstream FK COLUMN names reference old table (`invoice_extraction_line_id` in `line_cost_components`, `source_extraction_line_id` in 3 tables, `scope_/bom_extraction_line_id` in `line_bom_attachments`) | LOW | probe results §4 | Amendment H — out of scope; column-name normalization deferred |
| TS type names (`InvoiceExtractionRow` etc.) — rename cascade | MEDIUM | grep §5 | Amendment N — included in code cascade |
| Plan line 3004 raw-reference to `invoice_extraction_lines` in proposals §2.2 commentary | LOW | plan 3004 | Amendment M (plan-doc sync) — will update to new name when §2.2 reconciled |
| Plan lines 579 / 2488 / 2515 describe `invoice_extractions` as the legacy state | NONE | plan | Intentional historical references — keep |

No blockers. No collisions. No architectural-rule violations.

---

## §3 — Amendments (A–N) with rationale

### A. Update Phase 3.1 Exit Gate stale migration ref: `00072` → `00076`

- **Where:** `docs/nightwork-rebuild-plan.md:5567`
- **What:** "Migration 00072 applied, rollback tested" → "Migration 00076 applied, rollback tested"
- **Why:** Phase 2.10 reframe left slot `00075` reserved-unused; Branch 2 Final rollup confirmed Phase 3.1 picks up at `00076`. Stale ref noted in kickoff context line 81–83 and Phase 2.10 pre-flight §2.I (deferred to Branch 3 pre-context).
- **How:** Land in the plan-doc amendment commit before the feat commit, per standing amend-before-execute discipline.

### B. Confirm strict-minimal scope (rename + 3 cols); reconcile Part 2 §2.2 to delivered shape post-execution

- **Where:** Phase 3.1 remains as-written; Part 2 §2.2 gets a follow-up plan-doc sync commit after the feat commit lands (Amendment M below carries it out)
- **What:** Phase 3.1 does the rename + 3 new cols. All existing columns preserved. `verification_status` enum preserved. `invoice_id` FK preserved. Deferred columns and enum reconciliation documented in §2.2 as "Branch 3 convergence" future work.
- **Why:** User preflight prompt lines 108–111 and 117 explicitly name 3-col scope and instruct "flag drift before proceeding". Phase-spec at line 5558 matches. Cascading the Part 2 §2.2 ideal into Phase 3.1 would multiply scope 3–5×. See §1.3–1.4 detail.
- **How:** Pre-flight is the flag; user confirms; execution is strict-minimal; post-feat plan-doc sync commit updates §2.2 to delivered shape.

### C. `classified_type` CHECK — 10 values matching plan line 2110

- **What:**
  ```sql
  ADD COLUMN classified_type TEXT
    CHECK (classified_type IS NULL OR classified_type IN (
      'invoice','purchase_order','change_order','proposal',
      'vendor','budget','historical_draw','plan','contract','other'
    ));
  ```
- **Why:** Plan enum inventory line 2110 already locks this set. `plan`, `contract`, `other` included for classifier output breadth even though they have no commit target yet.
- **Nullability:** NULL until classifier populates (Phase 3.2+). Existing rows backfilled to `'invoice'` in Amendment F.

### D. `target_entity_type` CHECK — 7-value SUBSET of `classified_type`

- **What:**
  ```sql
  ADD COLUMN target_entity_type TEXT
    CHECK (target_entity_type IS NULL OR target_entity_type IN (
      'invoice','purchase_order','change_order','proposal','vendor','budget','historical_draw'
    ));
  ```
- **Why:** Plan §2.2 line 1950 says "same enum as classified_type" — but 3 of the 10 classified_types (`plan`, `contract`, `other`) have no committable entity in v1.0 (no `plans` table, no `contracts` table, `other` is undefined). Narrowing the CHECK makes the schema document which types can actually commit. Matches plan line 1428 semantic (target_entity_type lists only committable entities).
- **Alternative considered:** Match the full 10-value set like classified_type. Rejected — would allow obviously invalid rows (target_entity_type='plan' with no plans table) to pass the constraint. The committable-subset CHECK is the informative version.

### E. `target_entity_id` — bare UUID, no FK constraint, app-layer integrity

- **What:**
  ```sql
  ADD COLUMN target_entity_id UUID;
  ```
  No FK. Enforced by application: once `target_entity_type` + `target_entity_id` populate on commit, `commit-*-to-spine.ts` path writes to the appropriate target table and sets the UUID.
- **Why:** Polymorphic FKs are a Postgres anti-pattern. Three options considered:
  - **(a) Raw UUID + app-layer integrity** — SELECTED. Matches established Phase 2.2 precedent (`proposals.source_document_id`) — plan line 2920 explicitly documents this convention with COMMENT. Phase 2.5 draw_adjustments `source_document_id` uses same pattern (plan line 3610-3611). Consistent with the broader v1.0 design philosophy "app layer enforces what the DB can't cleanly model".
  - **(b) Per-target-type column** (`target_invoice_id FK invoices`, `target_po_id FK purchase_orders`, etc.) — REJECTED. Adds 7 columns + 7 FK constraints + 7 indexes. Schema bloat that doesn't carry its weight for low-cardinality lookup. Also forces migrations each time a new entity type is added.
  - **(c) Trigger-enforced integrity** — REJECTED. Complex; hard to reason about; doesn't compose well with multi-row inserts; violates simplicity preference of v1.0.
- **COMMENT:** Add a table/column COMMENT documenting the polymorphic pattern and pointing to the Phase 2.2 precedent, so future readers don't mistake the missing FK for an oversight.

### F. Backfill existing 56 active rows

- **What:**
  ```sql
  UPDATE public.document_extractions
  SET classified_type = 'invoice',
      target_entity_type = 'invoice',
      target_entity_id = invoice_id
  WHERE deleted_at IS NULL;
  ```
  (Runs inside the migration, post-ALTER.)
- **Why:** All current extraction rows came from invoices. Making target_entity_* populate from day one means:
  - Phase 3.2 classifier tests can treat backfilled rows as "already-classified" baseline.
  - Any future query `WHERE target_entity_type='invoice' AND target_entity_id=?` works on historical data, not just post-classifier rows.
  - Row-count probe stays simple: 56 active before ↔ 56 active after; `classified_type IS NOT NULL` count matches.
- **Scope note:** Backfill only touches the 3 new columns. `invoice_id` stays populated (strict-minimal). Both paths carry the same value until Phase 3.2+ makes target_entity_* the primary.

### G. Rename dependent database objects to match new table name

- **Scope (from live-probe §4):**
  - **Policies (6):** `invoice_extractions_org_read|write|update` → `document_extractions_org_read|write|update`. `iel_org_read|write|update` kept (prefix is table-neutral; rename noise) OR renamed to `del_org_read|write|update` — **recommend KEEP `iel_*`** for minimal churn; document the "iel = invoice_extraction_lines legacy prefix" in migration COMMENT.
  - **Triggers (4):** `trg_invoice_extractions_touch` → `trg_document_extractions_touch`; `trg_invoice_extraction_lines_touch` → `trg_document_extraction_lines_touch`; `trg_iel_landed_total` and `trg_iel_status_rollup` kept (iel prefix neutral).
  - **Indexes (5 non-pkey + 2 pkeys):**
    - `idx_invoice_extractions_invoice` → `idx_document_extractions_invoice` (name update; predicate unchanged)
    - `idx_invoice_extractions_pending` → `idx_document_extractions_pending`
    - `idx_invoice_extractions_status` → `idx_document_extractions_status`
    - `invoice_extractions_pkey` → `document_extractions_pkey`
    - `invoice_extraction_lines_pkey` → `document_extraction_lines_pkey`
    - `idx_iel_*` (7 indexes) kept (iel prefix neutral).
  - **Constraints (named non-pkey):**
    - `invoice_extractions_invoice_id_fkey` → `document_extractions_invoice_id_fkey`
    - `invoice_extractions_org_id_fkey` → `document_extractions_org_id_fkey`
    - `invoice_extractions_verified_by_fkey` → `document_extractions_verified_by_fkey`
    - `invoice_extractions_verification_status_check` → `document_extractions_verification_status_check`
    - `invoice_extraction_lines_*` (9 constraint names) → `document_extraction_lines_*`
    - `iel_*` constraints (3) kept.
- **Why:** Leaving constraint names like `invoice_extractions_verification_status_check` attached to `document_extractions` creates schema-reading noise forever. Cheap to rename inline with the table rename. Keeping `iel_*` / `idx_iel_*` prefix since it's already generic and renaming it adds churn with no gain.
- **Mechanism:** `ALTER POLICY ... ON ... RENAME TO`, `ALTER TRIGGER ... ON ... RENAME TO`, `ALTER INDEX ... RENAME TO`, `ALTER TABLE ... RENAME CONSTRAINT`. All tested as valid PG syntax (live probe §4).

### H. FK column names on dependent tables — out of scope

- **What stays as-is:**
  - `line_cost_components.invoice_extraction_line_id` (FK → document_extraction_lines.id)
  - `vendor_item_pricing.source_extraction_line_id` (FK → document_extraction_lines.id)
  - `unit_conversion_suggestions.source_extraction_line_id` (FK → document_extraction_lines.id)
  - `line_bom_attachments.scope_extraction_line_id`, `bom_extraction_line_id` (FKs → document_extraction_lines.id)
- **Why:** Renaming these columns means ALTER COLUMN on 4 tables + cascading code rename on ~15 src/ files that read/write them. This is equivalent effort to the table rename itself. Column-name consistency ≠ correctness — the FK relationship stays intact after the table rename. Defer to a future phase if/when the column-naming churn has other rationale.
- **Document:** Migration header comment notes the deliberate decision to leave FK column names as-is.

### I. Paired down migration — `00076_document_extractions_rename.down.sql`

- **Sequence (reverse-order of up.sql):**
  1. Drop 3 new columns: `target_entity_id`, `target_entity_type` (+CHECK), `classified_type` (+CHECK) — in reverse-add order
  2. Reverse-rename dependent objects (policies, triggers, indexes, constraints) back to `invoice_*` names
  3. `ALTER TABLE document_extraction_lines RENAME TO invoice_extraction_lines`
  4. `ALTER TABLE document_extractions RENAME TO invoice_extractions`
- **Data-loss note:** Reverse-rename is lossless. The 3 new columns being dropped: `classified_type`, `target_entity_type`, `target_entity_id` were populated via backfill (F) OR by Phase 3.2+ classifier. Dropping them loses whatever the classifier wrote post-migration, but preserves the base invoice-derived data (since `invoice_id` FK was left intact). Header COMMENT documents this.
- **Verification:** Down migration tested via the same probe-transaction pattern: apply up, verify state, apply down, verify state matches pre-up baseline. Column-by-column DELETE count + row-count.

### J. R.15 test file — `__tests__/document-extractions-rename.test.ts`

- **Coverage (matches Phase 2.7–2.9 ceremony):**
  1. Table existence: `document_extractions` + `document_extraction_lines` exist; `invoice_extractions` + `invoice_extraction_lines` do NOT.
  2. New-column existence + nullability: `classified_type`, `target_entity_type`, `target_entity_id` nullable.
  3. CHECK enforcement: invalid `classified_type='bogus'` rejected; valid 10 values accepted. Invalid `target_entity_type='plan'` (not in 7-val subset) rejected.
  4. `target_entity_id` accepts any UUID, no FK enforcement.
  5. RLS shape: 3-policy pattern preserved (org_read, org_write, org_update). Policy names post-rename.
  6. GRANT check: `authenticated` retains prior SELECT/INSERT/UPDATE grants on renamed tables.
  7. Data preservation: row counts pre-rename and post-rename match (simulated on probe branch; on dev, assert `document_extractions` has ≥ 56 active + ≥ 87 active lines — uses live data as fixture, does not create/destroy).
  8. Backfill correctness: every active pre-existing row has `classified_type='invoice'`, `target_entity_type='invoice'`, `target_entity_id=invoice_id` after migration.
  9. Dependent FK integrity: every `line_cost_components.invoice_extraction_line_id` still resolves; every `vendor_item_pricing.source_extraction_line_id` still resolves; etc.
  10. Regression fence: `iel_status_rollup` trigger still fires (insert a line with `verification_status='verified'`, assert parent's `verified_lines_count` increments).

- **R.23 regression fence:** add a test that the `idx_document_extractions_pending` predicate `WHERE verification_status IN ('pending','partial')` still matches rows — catches any accidental enum-narrowing.

### K. R.19 live-regression plan — 3 reference invoice formats

See §8 below for full plan. Summary: upload clean PDF (SmartShield), T&M invoice (Florida Sunshine Carpentry), lump-sum Word doc (Doug Naeher Drywall) post-migration; verify parse → PM review → approve → qa_approved flow end-to-end. Synthetic fixtures per R.21, teardown per R.22.

### L. R.23 precedent — inherit existing 3-policy pattern

- **What:** `document_extractions` and `document_extraction_lines` adopt the same 3-policy R.23 pattern they currently have on `invoice_extractions` / `invoice_extraction_lines`:
  - `_org_read` SELECT: org members OR platform_admin
  - `_org_write` INSERT: org members with role ∈ {owner, admin, pm, accounting}
  - `_org_update` UPDATE: same role set
  - DELETE: no policy (soft-delete via `deleted_at`, writes go through UPDATE)
- **Why:** Rename is not an RLS change. Policies auto-follow (probed §4 Probe 2). No new access vectors. No new precedent needed.
- **Policy text:** Policy USING/WITH CHECK expressions reference `org_members.org_id` — no string reference to the table name, so there's nothing inside the policy body to update beyond the policy name itself (Amendment G covers the name-level rename).

### M. Plan-doc sync commit (post-execution) — Part 2 §2.2 reconciliation

- **When:** AFTER the feat commit lands. Not in the amendment commit.
- **What:** Update plan `docs/nightwork-rebuild-plan.md` Part 2 §2.2 lines 1945–1968 to document the **delivered shape** (current table columns + 3 new cols), not the pre-delivery ideal. Add a "v1.5/v2.0 convergence" note listing deferred columns (`uploaded_by`, `original_file_*`, `extracted_data`, `error_message`, `committed_at`, `rejected_at`, line-side `proposed_cost_code_id`/`proposed_vendor_id`/`target_line_id`/`sort_order`, `verification_status` enum) as planned for a future Branch 3 convergence phase.
- **Also update:** Plan line 3004 (`invoice_extraction_lines` raw reference) → `document_extraction_lines`.
- **Do NOT update:** Plan lines 579, 2488, 2515 — these describe `invoice_extractions` as the legacy / pre-rename state intentionally.
- **Why:** Branch 2 precedent (Phase 2.8 commit `083167e`, Phase 2.9 commit `18dc087`) is plan-doc sync commit AFTER feat commit when execution diverges from spec. Here, divergence = strict-minimal vs ideal shape. Separate commit preserves feat-commit clarity.

### N. TS type rename cascade — 26+ refs across 7 files

- **Renames:**
  - `InvoiceExtractionRow` → `DocumentExtractionRow`
  - `InvoiceExtractionLineRow` → `DocumentExtractionLineRow`
  - `ExtractionStatus` → `DocumentExtractionStatus` (2 refs in types.ts)
- **Files affected:**
  - `src/lib/cost-intelligence/types.ts` (declarations)
  - `src/lib/cost-intelligence/extract-invoice.ts`
  - `src/lib/cost-intelligence/commit-line-to-spine.ts`
  - `src/lib/cost-intelligence/correct-line.ts`
  - `src/app/api/cost-intelligence/extractions/[invoiceId]/route.ts`
  - `src/components/items/extraction-verification-panel.tsx`
  - `src/components/items/raw-ocr-viewer.tsx`
- **Execution note:** Part of the 131-ref code rename cascade (§5), not a separate commit. TypeScript strict mode will catch any missed rename on `tsc --noEmit`.
- **Deferred (NOT renamed in Phase 3.1):**
  - Table-name string in `ScopeSizeSource` enum value `"invoice_extraction"` (types.ts:316) — this is a source-identifier enum value, not a table ref; semantically "source is the invoice extraction step of the pipeline". Keep until Phase 3.2+ renames the pipeline concept.
  - FK column names like `source_extraction_line_id` in TS types (2 refs in types.ts for `UnitConversionSuggestionRow` and `VendorItemPricingRow`) — match Amendment H (FK columns out of scope).

---

## §4 — Live-probe results (schema validator)

All probes executed on dev Supabase (project `egxkffodxcefwpqmwrur`) via transactional `BEGIN ... ROLLBACK` — no state change persisted. Baseline verified before and after: `invoice_extractions` exists, `document_extractions` does not. Post-probe: baseline restored.

| Probe | Result | Notes |
|-------|--------|-------|
| `ALTER TABLE invoice_extractions RENAME TO document_extractions` | ✅ PASS | No dependency errors |
| `ALTER TABLE invoice_extraction_lines RENAME TO document_extraction_lines` | ✅ PASS | Self-FK `extraction_id` auto-follows |
| `ADD COLUMN classified_type TEXT CHECK (10-val or NULL)` | ✅ PASS | |
| `ADD COLUMN target_entity_type TEXT CHECK (7-val or NULL)` | ✅ PASS | |
| `ADD COLUMN target_entity_id UUID` (no FK) | ✅ PASS | |
| FK constraints auto-follow renamed tables? | ✅ PASS | 6 FK columns across 5 dependent tables (`document_extraction_lines.extraction_id` self-FK; `line_bom_attachments.scope_extraction_line_id` + `bom_extraction_line_id`; `line_cost_components.invoice_extraction_line_id`; `unit_conversion_suggestions.source_extraction_line_id`; `vendor_item_pricing.source_extraction_line_id`) all resolve to renamed parents |
| RLS policies auto-follow? | ✅ PASS (with name drift) | 6 policies follow the tables. Policy NAMES still reference old table: `invoice_extractions_org_read|write|update` on `document_extractions`. Amendment G renames. |
| Triggers auto-follow? | ✅ PASS (with name drift) | 4 triggers follow. Trigger NAMES still reference old. Amendment G renames 2 of 4 (keeps `trg_iel_*` neutral). |
| Indexes auto-follow? | ✅ PASS (with name drift) | 12 indexes follow (5 primary-name + 7 iel-prefix). Index NAMES still reference old. Amendment G renames 5 (keeps `idx_iel_*` neutral). |
| CHECK constraints auto-follow? | ✅ PASS (with name drift) | 19 constraints follow. Constraint NAMES still reference old. Amendment G renames ~14 (keeps `iel_*` neutral). |
| Row preservation: 56 active extractions, 87 active lines | ✅ PASS (inferred) | RENAME TABLE is metadata-only. Row counts verified pre-probe; probe rolled back so no live write. |
| `target_entity_id UUID` accepts arbitrary UUIDs (no FK) | ✅ PASS | Confirms raw-UUID design (Amendment E) |

**No 42P07 collisions. No lockup. No advisor warnings surfaced by probe.**

Probe strategy note: used transactional ROLLBACK on main dev DB rather than Supabase preview branch. Same pattern as Phase 2.10 pre-flight §3 (static probes were sufficient). For Phase 3.1, DDL probes gave definitive rename-viability confirmation; branch creation would have added cost without new signal.

---

## §5 — Code rename cascade plan (R.18 blast-radius)

### 5.1 Raw grep results

Total `invoice_extraction` string matches: **131 refs across 36 files** (src/, __tests__/, scripts/). Breakdown by top-10 file hotness:

| Rank | File | Refs | Notes |
|------|------|------|-------|
| 1 | `src/lib/cost-intelligence/extract-invoice.ts` | 23 | Core extraction pipeline |
| 2 | `src/app/cost-intelligence/verification/page.tsx` | 14 | PM verification UI |
| 3 | `src/lib/cost-intelligence/commit-line-to-spine.ts` | 10 | Commit-to-spine pipeline |
| 4 | `src/app/api/cost-intelligence/extractions/[invoiceId]/route.ts` | 6 | Per-invoice extraction API |
| 5 | `src/app/api/cost-intelligence/extraction-lines/[id]/split-scope/route.ts` | 6 | Line split-scope API |
| 6 | `src/app/api/cost-intelligence/extraction-lines/[id]/skip/route.ts` | 6 | Line skip API |
| 7 | `scripts/rebackfill-cost-intelligence.ts` | 6 | Backfill script |
| 8 | `src/lib/cost-intelligence/correct-line.ts` | 4 | Line correction helper |
| 9 | `src/app/api/cost-intelligence/extraction-lines/[id]/revert-split/route.ts` | 4 | Revert-split API |
| 10 | `scripts/reclassify-line-natures.ts` | 4 | Reclassify script |

### 5.2 Directory distribution

- **src/app/api/cost-intelligence/**: 13 files, ~52 refs (routes)
- **src/app/cost-intelligence/**: 3 files, ~16 refs (pages)
- **src/app/admin/platform/**: 2 files, ~3 refs
- **src/lib/cost-intelligence/**: 6 files, ~47 refs (business logic)
- **src/components/cost-intelligence/**: 4 files, ~6 refs
- **src/components/items/**: 2 files (for TS types) — covered separately in Amendment N
- **src/components/nav-bar.tsx**: 1 ref (link to verification page, trivial)
- **scripts/**: 5 files, ~20 refs
- **__tests__/**: **0 files, 0 refs** ← notable

### 5.3 __tests__/ zero-ref finding

None of 16 test files in `__tests__/` reference `invoice_extraction*`. Implication: **no existing tests break from the rename**. This also means there's no existing regression fence on the extraction pipeline at the unit-test level — Amendment J fills that gap for the renamed tables.

### 5.4 docs/ scope

- `docs/nightwork-rebuild-plan.md`: 7 refs. 4 are intentional legacy references (lines 579, 2488, 2515, and the Phase 3.1 spec lines 5558, 5568, 5575). 1 is a raw-reference in Part 2 §2.2 proposals commentary (line 3004) — Amendment M renames it. 2 are in Phase 3.1 itself — leave (they are the phase's own spec).
- No other docs/ files reference the tables.

### 5.5 Execution sequencing recommendation

Execute the rename cascade in this order to minimize broken intermediate states:

1. **Migration 00076 applies** — schema rename lands first.
2. **Types.ts update** — rename type aliases (`DocumentExtractionRow`, etc.). TypeScript `tsc --noEmit` now flags every consumer.
3. **Business-logic layer** (`src/lib/cost-intelligence/`) — 6 files, rename table strings, column refs.
4. **API route layer** (`src/app/api/`) — 15 files, rename table strings in SQL selectors.
5. **UI layer** (`src/app/cost-intelligence/`, `src/components/`) — 9 files, rename type imports and column refs.
6. **Scripts** — 5 files.
7. **Build + test** — `npm run build` must pass. 358 existing tests still pass (they don't touch these tables). New `document-extractions-rename.test.ts` runs and passes.
8. **Plan-doc line 3004** — single-line update (Amendment M).

Grep validator at end: `grep -rn "invoice_extraction" src/ __tests__/ scripts/` must return zero results before feat commit lands.

---

## §6 — R.23 precedent check

- **Current RLS shape on `invoice_extractions` / `invoice_extraction_lines`:** 3-policy pattern (`_org_read`, `_org_write`, `_org_update`) per Phase 2.6 precedent (line 1927 for approval_chains, and 00052 for the current tables).
- **Post-rename:** Identical pattern auto-follows (live probe §4 Probe 2).
- **R.23 divergence?** None. This is a rename, not a new table. No access vectors change.
- **R.23 catalog entry for Branch 3:** this phase does not add a new entry; it preserves the existing invoice_extractions catalog entry with a note that the table was renamed in 00076.

Amendment G renames policy names for documentation consistency (`invoice_extractions_org_read` → `document_extractions_org_read`) — this is a name-level change, not a policy-semantic change. R.23 catalog unaffected.

---

## §7 — Test-suite impact + new fence requirements

### 7.1 Impact on existing tests

Test files: **16 total**, 358 tests passing at Branch 2 close.

- Files referencing `invoice_extraction*`: **0**.
- Files referencing TS types `InvoiceExtractionRow` / `InvoiceExtractionLineRow` / `ExtractionStatus`: **0** (types are declared and used in src/, not __tests__/).
- Files indirectly affected: **0** (no integration test exercises the extraction pipeline).

Post-rename: **all 358 tests continue to pass** assuming the code cascade is clean. No test file needs editing.

### 7.2 New fence requirements

Per R.15, this phase ships a new test file `__tests__/document-extractions-rename.test.ts`. See Amendment J for the full coverage spec (10 test categories).

Additional fence to consider: because no existing test exercises the extraction pipeline, and Phase 3.1 is the first Branch 3 phase that touches live data, the R.19 live-regression in §8 below doubles as the end-to-end acceptance fence. Missing that regression is a higher risk than for any Branch 2 phase.

---

## §8 — Live-regression plan (R.19) — 3 reference invoice formats

### 8.1 Rationale

Phase 3.1 is the first non-schema-only phase since Branch 1. R.19 live-regression is required. The target flow to validate:

```
  Upload real invoice PDF (3 formats)
     ↓
  Storage → parse trigger → document_extractions row created (renamed table!)
     ↓
  Claude Vision API → parsed fields + line items → document_extraction_lines rows
     ↓
  PM Review UI → side-by-side original + parsed → approve
     ↓
  Invoice status → pm_approved
     ↓
  QA (Diane) → verify cost code mapping → approve
     ↓
  Invoice status → qa_approved
```

If ANY step fails post-rename → rename cascade was incomplete; rollback via 00076.down.sql; fix; re-run regression.

### 8.2 Test inputs (3 reference formats per CLAUDE.md)

1. **Clean vendor PDF** — SmartShield Homes-style. Structured table, invoice #, PO ref. High confidence. (sourced from `./test-invoices/`)
2. **T&M invoice** — Florida Sunshine Carpentry-style. Daily labor entries, crew size × hours. (sourced from `./test-invoices/`)
3. **Lump-sum Word/PDF** — Doug Naeher Drywall-style. Scope description + lump sum. No line items, sometimes no invoice number. (sourced from `./test-invoices/`)

Each invoice is tied to a real job (synthetic job if no existing test job exists; see 8.4).

### 8.3 Step-by-step validation checklist

For each of the 3 invoice formats:

- [ ] Upload via `/invoices/upload` (or equivalent) completes without error
- [ ] `document_extractions` row created with `invoice_id = <new invoice>` and `classified_type = 'invoice'` (backfilled trigger or classifier — TBD per Phase 3.2; for Phase 3.1 acceptance, inserted via the upload pipeline as 'invoice' default if classifier not yet shipped)
- [ ] Row count in `document_extractions` increments by exactly 1 per upload
- [ ] Row count in `document_extraction_lines` matches expected line count for the format
- [ ] PM review UI loads the uploaded invoice without console errors
- [ ] All extracted fields render in the verification panel
- [ ] Approve button transitions invoice to `pm_approved`
- [ ] QA review UI loads the pm_approved invoice
- [ ] Approve button transitions invoice to `qa_approved`
- [ ] `iel_status_rollup` trigger correctly updates `document_extractions.verification_status` as lines move through `pending → verified`

### 8.4 Synthetic fixtures (R.21)

- **Job:** `Phase3.1-Test-SmartShield-2026-04-23`, `Phase3.1-Test-FloridaSunshine-2026-04-23`, `Phase3.1-Test-DougNaeher-2026-04-23` — 3 distinct synthetic jobs, each with `org_id` matching current dev test org, minimal budget_lines seeded so cost code assignment at approve-step works.
- **Vendor:** reuse existing SmartShield Homes / Florida Sunshine Carpentry / Doug Naeher Drywall vendor records if already present; else create 3 synthetic vendors with identifying names.
- **Cost codes:** reuse seeded system template cost codes (present from Phase 2.4).
- **Invoice files:** 3 PDFs in `./test-invoices/` (already present per CLAUDE.md "Test with the three reference invoice formats" rule).

### 8.5 Teardown (R.22)

Write `scripts/phase3.1-regression-teardown.ts` (matches Phase 2.3 scripts/qa teardown precedent at `scripts/qa/` or equivalent):

```ts
// Deletes in dependency order:
// 1. document_extraction_lines (by invoice → extraction → line)
// 2. document_extractions (by invoice)
// 3. invoice_line_items (by invoice)
// 4. invoices (by synthetic job)
// 5. budget_lines (by synthetic job)
// 6. jobs (synthetic 3)
// (vendors + cost codes left — they're shared/seeded)
```

Soft-delete semantics: all the above support `deleted_at` soft-delete. Teardown sets `deleted_at = NOW()` rather than hard-delete, so the audit trail remains for debugging. Can follow up with hard-delete via platform admin if needed.

### 8.6 Acceptance criteria

- All 3 formats complete the full flow without manual intervention
- Console clean (no extraction / type errors)
- `document_extractions` row count post-teardown returns to pre-run baseline (soft-delete accounted for — filter `deleted_at IS NULL`)
- 358 existing tests + new document-extractions-rename test all pass

If any acceptance item fails → rollback via 00076.down.sql; fix; re-run.

---

## §9 — Down migration plan (Amendment I detail)

File: `supabase/migrations/00076_document_extractions_rename.down.sql`

```sql
BEGIN;

-- 1. Drop new columns (reverse add-order)
ALTER TABLE public.document_extractions DROP COLUMN IF EXISTS target_entity_id;
ALTER TABLE public.document_extractions DROP COLUMN IF EXISTS target_entity_type;
ALTER TABLE public.document_extractions DROP COLUMN IF EXISTS classified_type;

-- 2. Reverse-rename dependent objects
ALTER POLICY document_extractions_org_read   ON public.document_extractions RENAME TO invoice_extractions_org_read;
ALTER POLICY document_extractions_org_write  ON public.document_extractions RENAME TO invoice_extractions_org_write;
ALTER POLICY document_extractions_org_update ON public.document_extractions RENAME TO invoice_extractions_org_update;
-- (iel_* policies not renamed in up.sql; no reverse needed)

ALTER TRIGGER trg_document_extractions_touch       ON public.document_extractions       RENAME TO trg_invoice_extractions_touch;
ALTER TRIGGER trg_document_extraction_lines_touch  ON public.document_extraction_lines  RENAME TO trg_invoice_extraction_lines_touch;
-- (trg_iel_* triggers not renamed in up.sql; no reverse needed)

ALTER INDEX idx_document_extractions_invoice  RENAME TO idx_invoice_extractions_invoice;
ALTER INDEX idx_document_extractions_pending  RENAME TO idx_invoice_extractions_pending;
ALTER INDEX idx_document_extractions_status   RENAME TO idx_invoice_extractions_status;
ALTER INDEX document_extractions_pkey          RENAME TO invoice_extractions_pkey;
ALTER INDEX document_extraction_lines_pkey     RENAME TO invoice_extraction_lines_pkey;

ALTER TABLE public.document_extractions      RENAME CONSTRAINT document_extractions_invoice_id_fkey              TO invoice_extractions_invoice_id_fkey;
ALTER TABLE public.document_extractions      RENAME CONSTRAINT document_extractions_org_id_fkey                  TO invoice_extractions_org_id_fkey;
ALTER TABLE public.document_extractions      RENAME CONSTRAINT document_extractions_verified_by_fkey             TO invoice_extractions_verified_by_fkey;
ALTER TABLE public.document_extractions      RENAME CONSTRAINT document_extractions_verification_status_check    TO invoice_extractions_verification_status_check;
-- + 9 constraint renames for document_extraction_lines_* → invoice_extraction_lines_*

-- 3. Rename tables back (reverse table-rename order: lines first? No — tables rename in any order; self-FK follows. Keep parallel to up.sql for symmetry.)
ALTER TABLE public.document_extraction_lines RENAME TO invoice_extraction_lines;
ALTER TABLE public.document_extractions      RENAME TO invoice_extractions;

COMMIT;
```

**Data-loss note (header comment):** Dropping the 3 new columns loses:
- Any classifier-written values in `classified_type`, `target_entity_type`, `target_entity_id` (Phase 3.2+ data) — 0 rows at Phase 3.1-immediate rollback, N rows if rollback happens after Phase 3.2+ runs.
- The backfill from Amendment F is identical to existing `invoice_id` data, so no net loss (the UUID is still in `invoice_id`).

Rollback is safe pre-Phase 3.2; increasingly risky after.

---

## §10 — Rebuild-vs-patch call (§12 per kickoff)

**REBUILD — confirmed.**

- 131 code refs across 36 files is firmly in the "rebuild" bracket (kickoff criterion: >30 files → rebuild).
- Patch alternative (e.g., create a `document_extractions` view over `invoice_extractions` + add 3 cols as column extensions; leave code untouched) would:
  - Require a schema-level VIEW or ALIAS mechanism — not Postgres-native without heroics
  - Leave code permanently referencing legacy name → "grep validator zero refs" exit-gate impossible
  - Create permanent confusion about canonical table identity
  - Block every downstream Branch 3 phase (3.2–3.10) that expects to write to `document_extractions`
- REBUILD = one clean migration + one cascade = canonical name everywhere, no tech debt.

Confirmation matches plan line 5562 call.

---

## §11 — Data preservation probe (§11 per kickoff)

### 11.1 Pre-migration baseline

- `invoice_extractions`: 130 total, **56 active** (`deleted_at IS NULL`)
- `invoice_extraction_lines`: 391 total, **87 active**

### 11.2 Post-migration expected state

- `document_extractions`: 130 total, 56 active
- `document_extraction_lines`: 391 total, 87 active
- **New column population (active rows):**
  - `classified_type = 'invoice'` on 56 active rows
  - `target_entity_type = 'invoice'` on 56 active rows
  - `target_entity_id = invoice_id` on 56 active rows
- **New column population (soft-deleted rows):** NULL. Backfill filters `deleted_at IS NULL` per Amendment F, preserving soft-deleted state-at-time.

### 11.3 Probe assertions (in migration as DO blocks or in R.15 test)

```sql
-- Row count preservation
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM public.document_extractions) = 130,
    'document_extractions row count drift';
  ASSERT (SELECT COUNT(*) FROM public.document_extractions WHERE deleted_at IS NULL) = 56,
    'document_extractions active row count drift';
  ASSERT (SELECT COUNT(*) FROM public.document_extraction_lines) = 391,
    'document_extraction_lines row count drift';
  ASSERT (SELECT COUNT(*) FROM public.document_extraction_lines WHERE deleted_at IS NULL) = 87,
    'document_extraction_lines active row count drift';

  -- Backfill correctness
  ASSERT (SELECT COUNT(*) FROM public.document_extractions
          WHERE deleted_at IS NULL AND classified_type = 'invoice') = 56,
    'classified_type backfill incomplete';
  ASSERT (SELECT COUNT(*) FROM public.document_extractions
          WHERE deleted_at IS NULL AND target_entity_type = 'invoice'
            AND target_entity_id = invoice_id) = 56,
    'target_entity_* backfill incomplete';
END $$;
```

**Note:** row counts are snapshot-at-migration-time. If the numbers change between now and execution (additional extractions get created), the ASSERTs become parameterized by pre-migration read — recommend capturing into a `_stats` temp table in the migration before ALTER and comparing after backfill.

### 11.4 Downstream FK integrity probe

```sql
-- All 5 downstream FK columns should still resolve post-rename
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM public.line_cost_components lcc
  WHERE lcc.invoice_extraction_line_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.document_extraction_lines del WHERE del.id = lcc.invoice_extraction_line_id);
  ASSERT orphan_count = 0, 'line_cost_components orphaned FKs';
  -- (similar for vendor_item_pricing, unit_conversion_suggestions, line_bom_attachments)
END $$;
```

---

## §12 — Out of scope for Phase 3.1

Confirmed not touched:

- Phase 3.2+ (classifier, extraction pipelines, /ingest UI)
- Branch 3 Final rollup
- GH #1–#17 housekeeping (tracked by individual Branch 3+ phases)
- Performance advisor catch-up (Branch 8)
- `verification_status` enum reconciliation (`partial` → `committed` or similar) — deferred per Amendment B
- `invoice_id` FK drop + `uploaded_by` add + file-metadata cols add — deferred per Amendment B
- FK column name normalization on 5 dependent tables (`invoice_extraction_line_id` etc.) — deferred per Amendment H
- Part 2 §2.2 ideal-shape columns not yet present (`extracted_data`, `error_message`, `committed_at`, `rejected_at`, etc.) — deferred per Amendment B; plan-doc reconciliation via Amendment M documents the deferral

---

## §13 — Plan-doc amendments to land in the amendment commit

Before the feat commit, one amendment commit lands with:

1. Line 5567: `Migration 00072 applied` → `Migration 00076 applied` (Amendment A)
2. Phase 3.1 spec block (lines 5556–5575): add a pre-flight reference line pointing to this findings doc (matches Phase 2.5–2.9 precedent pattern)
3. Nothing else — Part 2 §2.2 sync deferred to post-feat plan-doc sync commit (Amendment M), per Branch 2 precedent.

After the feat commit lands, the plan-doc sync commit handles Amendment M:
- Part 2 §2.2 lines 1945–1968 reconciled to delivered shape
- Plan line 3004 `invoice_extraction_lines` → `document_extraction_lines`
- Convergence-deferred columns documented

---

## §14 — Recommendation

**READY TO EXECUTE** after user review of:

1. **Scope decision (Amendment B):** strict-minimal (rename + 3 cols; preserve all existing cols) vs. full-align (cascade to Part 2 §2.2 target shape). Pre-flight recommends strict-minimal.
2. **Amendment G scope:** rename 2-of-4 triggers, 5-of-12 indexes, ~14-of-19 constraints, 6-of-6 policies to `document_*` prefix; keep `iel_*`/`idx_iel_*`/`trg_iel_*` neutral. Alternative: rename all (including `iel_*`). Pre-flight recommends partial rename with neutral-prefix kept.
3. **Amendment D:** `target_entity_type` CHECK as 7-value committable subset vs. 10-value full enum (same as classified_type). Pre-flight recommends 7-value subset.
4. **Amendment E:** `target_entity_id` as bare UUID vs. per-target-type columns vs. trigger-enforced. Pre-flight recommends bare UUID, matching Phase 2.2 precedent.
5. **Amendment F:** backfill 56 active rows with `classified_type='invoice'`, `target_entity_type='invoice'`, `target_entity_id=invoice_id`. Pre-flight recommends yes (makes target_entity_* populate from day one; simplifies Phase 3.2+ consumers).

Once confirmed, execution sequence:

1. Amendment commit (plan-doc line 5567 + cross-ref to this findings doc)
2. feat commit: migration 00076 + paired down.sql + `__tests__/document-extractions-rename.test.ts` + 131-ref code rename cascade across 36 src/ + script files + TS type renames
3. Post-feat plan-doc sync commit (Part 2 §2.2 reconciliation per Amendment M)
4. R.19 live-regression run (3 reference invoice formats) per §8
5. QA report `qa-reports/qa-branch3-phase3.1.md`

Standing Branch 2 patterns carry forward: Schema Validator live probes (applied here §4), amend-before-execute discipline, plan-doc sync commit on drift, R.23 precedent check (§6), live-auth RLS probes (policies auto-follow — no new policies, no probe needed), Amendment F.2 GRANT verification (SECURITY DEFINER functions unchanged in this phase — no new functions).

---

## §15 — Carry-forward context

Branch 3 kickoff items referenced by this phase:

- Plan-doc stale "Migration 00072" ref at line 5567 → handled via Amendment A
- 16 open GH issues (#1–#4 Branch 1, #6–#17 Branch 2) — none intersect Phase 3.1 scope; surfacing deferred to relevant later phases
- Claude Code meta-drafting pattern (stable 9+ instances): this findings doc is meta-drafted; accepted per convention; redirection to execution happens on user approval
