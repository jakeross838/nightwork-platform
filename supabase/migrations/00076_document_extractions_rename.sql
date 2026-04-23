-- ============================================================
-- 00076_document_extractions_rename.sql — Phase 3.1 (Branch 3)
-- ============================================================
--
-- Renames two existing tables to their document-generalized names
-- and adds 3 new classifier routing columns to the parent:
--
--   public.invoice_extractions      → public.document_extractions
--   public.invoice_extraction_lines → public.document_extraction_lines
--
--   ADD COLUMN classified_type    TEXT  (10-val CHECK or NULL)
--   ADD COLUMN target_entity_type TEXT  (7-val CHECK or NULL)
--   ADD COLUMN target_entity_id   UUID  (bare — NO foreign key)
--
-- Plan-doc amendments landed at commit c5cbdb9. Pre-flight findings
-- at qa-reports/preflight-branch3-phase3.1.md (commit 777b752)
-- captured 14 amendments (A–N) and 5 decisions resolved. This
-- migration is the execution artifact for Stage 1 of Phase 3.1
-- (DB-only rename + backfill). Stage 2 handles the 131-ref code
-- rename cascade across 36 src/ files + 5 scripts/ files + 26 TS
-- type refs. Stage 3 handles live regression testing of 3 reference
-- invoice formats per CLAUDE.md (R.19).
--
-- ------------------------------------------------------------
-- AMENDMENT B — STRICT-MINIMAL SCOPE (user-approved)
-- ------------------------------------------------------------
-- The Part 2 §2.2 architecture target describes document_extractions
-- with a meaningfully different column set (drops invoice_id FK,
-- adds uploaded_by / original_file_* / extracted_data /
-- error_message / committed_at / rejected_at; evolves the
-- verification_status enum from current (pending|partial|verified|
-- rejected) to target (pending|verified|committed|rejected)). That
-- convergence is deferred to a future Branch 3.8 / Branch 4 phase
-- once the classifier is production-validated.
--
-- This migration delivers ONLY the rename + 3 new classifier routing
-- columns. All existing columns preserved. verification_status enum
-- preserved. invoice_id FK preserved. Plan Part 2 §2.2 documents the
-- drift via the "Current vs Target Shape" subsection (Amendment M).
--
-- ------------------------------------------------------------
-- AMENDMENT D — classified_type vs target_entity_type SEMANTIC
-- DISTINCTION
-- ------------------------------------------------------------
-- These two columns represent DIFFERENT semantics and their CHECK
-- sets are intentionally different:
--
--   classified_type     = what the document IS (classifier output)
--                         10 values: invoice, purchase_order,
--                         change_order, proposal, vendor, budget,
--                         historical_draw, plan, contract, other
--
--   target_entity_type  = where the data GOES (commit destination)
--                         7 values: the committable subset —
--                         invoice, purchase_order, change_order,
--                         proposal, vendor, budget, historical_draw
--                         (excludes plan, contract, other — those
--                         have no v1.0 commit target)
--
-- These fields CAN AND DO diverge in real flows. Examples:
--   - A document classified_type='proposal' that the PM accepts and
--     converts to a PO commits with target_entity_type='purchase_order'.
--   - A document classified_type='contract' stays with
--     target_entity_type=NULL because no contracts table exists yet.
--   - A document classified_type='other' never commits anywhere —
--     target_entity_* stays NULL forever.
--
-- Do NOT "unify" the two CHECK sets later. They are semantically
-- distinct on purpose.
--
-- ------------------------------------------------------------
-- AMENDMENT E — target_entity_id is a BARE UUID with NO foreign key
-- ------------------------------------------------------------
-- Referential integrity is enforced at the app layer (classifier
-- write-path in Branch 3.2+), NOT at the DB level, because the
-- referenced entity varies by target_entity_type. A single FK can
-- only point at a single table — target_entity_id has to point at
-- 7 different tables. Three polymorphic-FK alternatives were
-- considered in the pre-flight:
--   (a) Raw UUID + app-layer integrity — SELECTED (this migration).
--   (b) Per-target-type columns (target_invoice_id, target_po_id,
--       …, 7 FKs + 7 indexes). Rejected — schema bloat with no
--       correctness gain for low-cardinality lookups.
--   (c) Trigger-enforced integrity. Rejected — complex, doesn't
--       compose with multi-row inserts.
-- Matches Phase 2.2 proposals.source_document_id precedent (plan
-- line 2920). The R.15 regression fence
-- (__tests__/document-extractions-rename.test.ts) EXPLICITLY
-- asserts no FK on target_entity_id so a future "fix" cannot
-- silently add one. COMMENT ON COLUMN below documents the same for
-- pg_catalog readers.
--
-- ------------------------------------------------------------
-- AMENDMENT F — BACKFILL + COMPLETENESS PROBE
-- ------------------------------------------------------------
-- All 56 active pre-existing extraction rows came from invoices.
-- Backfill populates the 3 new columns with:
--   classified_type    = 'invoice'
--   target_entity_type = 'invoice'
--   target_entity_id   = invoice_id
-- Scoped to deleted_at IS NULL (soft-deleted rows stay NULL to
-- preserve state-at-time). Makes target_entity_* populate from day
-- one so Phase 3.2+ consumers can treat backfilled rows as
-- already-classified.
--
-- Completeness probe (DO block post-backfill) RAISEs if any active
-- row has classified_type='invoice' AND target_entity_id IS NULL —
-- catches any gap in the backfill scope. Migration aborts on
-- failure.
--
-- ------------------------------------------------------------
-- AMENDMENT G — SELECTIVE OBJECT RENAME
-- ------------------------------------------------------------
-- Not every dependent database object gets renamed. The decision:
--
--   Triggers (2/4 renamed):
--     trg_invoice_extractions_touch       → trg_document_extractions_touch
--     trg_invoice_extraction_lines_touch  → trg_document_extraction_lines_touch
--     (kept neutral: trg_iel_landed_total, trg_iel_status_rollup)
--
--   Indexes (5/12 renamed):
--     invoice_extractions_pkey            → document_extractions_pkey
--     invoice_extraction_lines_pkey       → document_extraction_lines_pkey
--     idx_invoice_extractions_invoice     → idx_document_extractions_invoice
--     idx_invoice_extractions_pending     → idx_document_extractions_pending
--     idx_invoice_extractions_status      → idx_document_extractions_status
--     (kept neutral: idx_iel_* — 7 indexes)
--
--   Policies (6/6 renamed — Stage 1 decision):
--     invoice_extractions_org_read/write/update → document_extractions_org_read/write/update
--     iel_org_read/write/update                 → document_extraction_lines_org_read/write/update
--
--   Constraints (14/17 renamed, excluding 2 pkeys which go via
--   ALTER INDEX because Postgres backs pkey constraints with
--   same-named indexes):
--     document_extractions side (4):
--       invoice_extractions_invoice_id_fkey            → document_extractions_invoice_id_fkey
--       invoice_extractions_org_id_fkey                → document_extractions_org_id_fkey
--       invoice_extractions_verified_by_fkey           → document_extractions_verified_by_fkey
--       invoice_extractions_verification_status_check  → document_extractions_verification_status_check
--     document_extraction_lines side (10):
--       invoice_extraction_lines_extraction_id_fkey         → document_extraction_lines_extraction_id_fkey
--       invoice_extraction_lines_invoice_line_item_id_fkey  → document_extraction_lines_invoice_line_item_id_fkey
--       invoice_extraction_lines_match_tier_check           → document_extraction_lines_match_tier_check
--       invoice_extraction_lines_org_id_fkey                → document_extraction_lines_org_id_fkey
--       invoice_extraction_lines_proposed_item_id_fkey      → document_extraction_lines_proposed_item_id_fkey
--       invoice_extraction_lines_transaction_line_type_check → document_extraction_lines_transaction_line_type_check
--       invoice_extraction_lines_vendor_item_pricing_id_fkey → document_extraction_lines_vendor_item_pricing_id_fkey
--       invoice_extraction_lines_verification_status_check  → document_extraction_lines_verification_status_check
--       invoice_extraction_lines_verified_by_fkey           → document_extraction_lines_verified_by_fkey
--       invoice_extraction_lines_verified_item_id_fkey      → document_extraction_lines_verified_item_id_fkey
--     (kept neutral: iel_line_nature_check, iel_overhead_type_check,
--      iel_proposed_pricing_model_check — 3 CHECK constraints)
--
-- The iel_ / idx_iel_ / trg_iel_ prefix is retained because it is
-- already table-neutral (carries historical meaning about the lines
-- side of the pipeline without naming the literal table). Renaming
-- those adds churn with no readability gain. The iel_org_* policy
-- names were the exception to this rule — they got renamed in the
-- Stage 1 decision because policy names should reflect the table
-- they attach to, and "iel" did not convey that at the policy scope.
--
-- ------------------------------------------------------------
-- AMENDMENT H — FK COLUMN NAMES ON DEPENDENT TABLES UNCHANGED
-- ------------------------------------------------------------
-- 5 downstream FK columns reference the renamed tables:
--   line_cost_components.invoice_extraction_line_id
--   vendor_item_pricing.source_extraction_line_id
--   unit_conversion_suggestions.source_extraction_line_id
--   line_bom_attachments.scope_extraction_line_id
--   line_bom_attachments.bom_extraction_line_id
-- Plus the self-FK invoice_extraction_lines.extraction_id →
-- invoice_extractions(id) — auto-follows the rename.
--
-- These COLUMN names stay unchanged. The FK relationships auto-
-- follow the renamed parent tables (metadata-only rename; live-
-- probed in pre-flight §4). Renaming these columns would cascade
-- to ~15 additional src/ files without correctness benefit.
-- Column-name normalization is deferred to a future phase.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- (a) Rename the two tables.
-- ------------------------------------------------------------
-- RENAME TABLE is metadata-only. Preserves row data, self-FKs,
-- RLS policies (names only — renamed below), triggers, indexes,
-- CHECK constraints, and dependent FK references from other tables.
-- Live-probed pre-flight §4 Probe 1-5.

ALTER TABLE public.invoice_extractions      RENAME TO document_extractions;
ALTER TABLE public.invoice_extraction_lines RENAME TO document_extraction_lines;

-- ------------------------------------------------------------
-- (b) Selective index renames (Amendment G — 5/12).
-- ------------------------------------------------------------
-- Primary-key constraints use same-named indexes, so ALTER INDEX
-- renames both the index AND the backing pkey constraint.

ALTER INDEX public.invoice_extractions_pkey         RENAME TO document_extractions_pkey;
ALTER INDEX public.invoice_extraction_lines_pkey    RENAME TO document_extraction_lines_pkey;
ALTER INDEX public.idx_invoice_extractions_invoice  RENAME TO idx_document_extractions_invoice;
ALTER INDEX public.idx_invoice_extractions_pending  RENAME TO idx_document_extractions_pending;
ALTER INDEX public.idx_invoice_extractions_status   RENAME TO idx_document_extractions_status;
-- idx_iel_* indexes (7) kept neutral.

-- ------------------------------------------------------------
-- (c) Selective constraint renames (Amendment G — 14/17 non-pkey).
-- ------------------------------------------------------------

-- document_extractions side (4 non-pkey constraints)
ALTER TABLE public.document_extractions
  RENAME CONSTRAINT invoice_extractions_invoice_id_fkey
                 TO document_extractions_invoice_id_fkey;
ALTER TABLE public.document_extractions
  RENAME CONSTRAINT invoice_extractions_org_id_fkey
                 TO document_extractions_org_id_fkey;
ALTER TABLE public.document_extractions
  RENAME CONSTRAINT invoice_extractions_verified_by_fkey
                 TO document_extractions_verified_by_fkey;
ALTER TABLE public.document_extractions
  RENAME CONSTRAINT invoice_extractions_verification_status_check
                 TO document_extractions_verification_status_check;

-- document_extraction_lines side (10 non-pkey constraints)
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT invoice_extraction_lines_extraction_id_fkey
                 TO document_extraction_lines_extraction_id_fkey;
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT invoice_extraction_lines_invoice_line_item_id_fkey
                 TO document_extraction_lines_invoice_line_item_id_fkey;
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT invoice_extraction_lines_match_tier_check
                 TO document_extraction_lines_match_tier_check;
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT invoice_extraction_lines_org_id_fkey
                 TO document_extraction_lines_org_id_fkey;
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT invoice_extraction_lines_proposed_item_id_fkey
                 TO document_extraction_lines_proposed_item_id_fkey;
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT invoice_extraction_lines_transaction_line_type_check
                 TO document_extraction_lines_transaction_line_type_check;
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT invoice_extraction_lines_vendor_item_pricing_id_fkey
                 TO document_extraction_lines_vendor_item_pricing_id_fkey;
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT invoice_extraction_lines_verification_status_check
                 TO document_extraction_lines_verification_status_check;
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT invoice_extraction_lines_verified_by_fkey
                 TO document_extraction_lines_verified_by_fkey;
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT invoice_extraction_lines_verified_item_id_fkey
                 TO document_extraction_lines_verified_item_id_fkey;

-- iel_line_nature_check, iel_overhead_type_check,
-- iel_proposed_pricing_model_check kept neutral (neutral iel_*
-- prefix carries lineage signal without the literal old table name).

-- ------------------------------------------------------------
-- (d) Selective trigger renames (Amendment G — 2/4).
-- ------------------------------------------------------------

ALTER TRIGGER trg_invoice_extractions_touch
  ON public.document_extractions
  RENAME TO trg_document_extractions_touch;

ALTER TRIGGER trg_invoice_extraction_lines_touch
  ON public.document_extraction_lines
  RENAME TO trg_document_extraction_lines_touch;

-- trg_iel_landed_total + trg_iel_status_rollup kept neutral.

-- ------------------------------------------------------------
-- (e) Policy renames (Amendment G — 6/6, Stage 1 decision).
-- ------------------------------------------------------------
-- All 6 RLS policies renamed. Policies follow the table
-- automatically (live-probed) but the policy NAMES still reference
-- the old tables. Rename them so schema-introspection surfaces
-- the correct parent-table-matching identifier.

ALTER POLICY invoice_extractions_org_read
  ON public.document_extractions
  RENAME TO document_extractions_org_read;

ALTER POLICY invoice_extractions_org_write
  ON public.document_extractions
  RENAME TO document_extractions_org_write;

ALTER POLICY invoice_extractions_org_update
  ON public.document_extractions
  RENAME TO document_extractions_org_update;

ALTER POLICY iel_org_read
  ON public.document_extraction_lines
  RENAME TO document_extraction_lines_org_read;

ALTER POLICY iel_org_write
  ON public.document_extraction_lines
  RENAME TO document_extraction_lines_org_write;

ALTER POLICY iel_org_update
  ON public.document_extraction_lines
  RENAME TO document_extraction_lines_org_update;

-- ------------------------------------------------------------
-- (f) Add 3 new columns (Amendments C / D / E).
-- ------------------------------------------------------------
-- All three nullable initially. Backfill (step h) populates the
-- 56 active rows with invoice/invoice/invoice_id; classifier
-- (Branch 3.2+) populates the rest going forward.

-- classified_type: what the document IS (classifier output).
-- 10-value CHECK (Amendment C). NULL until classifier runs.
ALTER TABLE public.document_extractions
  ADD COLUMN classified_type TEXT
    CHECK (classified_type IS NULL OR classified_type IN (
      'invoice',
      'purchase_order',
      'change_order',
      'proposal',
      'vendor',
      'budget',
      'historical_draw',
      'plan',
      'contract',
      'other'
    ));

-- target_entity_type: commit destination (where data goes).
-- 7-value committable-subset CHECK (Amendment D — excludes
-- plan/contract/other which have no v1.0 commit entity).
ALTER TABLE public.document_extractions
  ADD COLUMN target_entity_type TEXT
    CHECK (target_entity_type IS NULL OR target_entity_type IN (
      'invoice',
      'purchase_order',
      'change_order',
      'proposal',
      'vendor',
      'budget',
      'historical_draw'
    ));

-- target_entity_id: bare UUID, NO foreign key (Amendment E —
-- app-layer integrity; see header comment for rationale and
-- COMMENT ON COLUMN below for pg_catalog surface).
ALTER TABLE public.document_extractions
  ADD COLUMN target_entity_id UUID;
  -- DELIBERATELY no REFERENCES clause. See Amendment E in header.

-- ------------------------------------------------------------
-- (g) COMMENT ON COLUMN for the 3 new columns.
-- ------------------------------------------------------------
-- Documentation surfaces through pg_catalog.pg_description so
-- future readers (DBAs, LLM agents, new engineers) discover the
-- rationale without reading this migration file.

COMMENT ON COLUMN public.document_extractions.classified_type IS
'What the document IS per the Branch 3.2 classifier. 10-value set: invoice, purchase_order, change_order, proposal, vendor, budget, historical_draw, plan, contract, other. NULL until classifier runs. Semantically distinct from target_entity_type (commit destination): a document can be classified as one type but committed to a different entity — e.g., a proposal classified_type=''proposal'' that the PM accepts and converts to a PO → target_entity_type=''purchase_order''. These fields intentionally diverge in real flows. See migration 00076 header Amendment D.';

COMMENT ON COLUMN public.document_extractions.target_entity_type IS
'Where this extraction WILL commit to — the 7-value committable subset of classified_type (excludes plan/contract/other, which have no v1.0 commit target). NULL until PM/classifier decides commit destination. Distinct from classified_type by design: (1) classified=proposal, target=purchase_order when proposal accepted and converted; (2) classified=contract, target=NULL because contracts table doesn''t exist yet; (3) classified=other, target=NULL — never commits. See migration 00076 header Amendment D.';

COMMENT ON COLUMN public.document_extractions.target_entity_id IS
'UUID of the entity this extraction committed to. App-layer integrity: populated by Branch 3.2+ classifier/commit-path after successful match. Referential integrity enforced at classifier write-path, NOT at the DB level, because referenced entity varies by target_entity_type (invoices, purchase_orders, change_orders, proposals, vendors, budgets, historical_draws — 7 different parent tables). A single Postgres FK can only point at a single table. Matches Phase 2.2 proposals.source_document_id precedent. DO NOT add a FK constraint to this column later — it would break every row where target_entity_type is not ''invoice''. The R.15 regression fence (__tests__/document-extractions-rename.test.ts) explicitly asserts no FK on this column. See migration 00076 header Amendment E.';

-- ------------------------------------------------------------
-- (h) Backfill (Amendment F).
-- ------------------------------------------------------------
-- All 56 active pre-existing extraction rows came from invoices.
-- Scope: deleted_at IS NULL (soft-deleted rows stay NULL to
-- preserve state-at-time).

UPDATE public.document_extractions
SET classified_type    = 'invoice',
    target_entity_type = 'invoice',
    target_entity_id   = invoice_id
WHERE deleted_at IS NULL
  AND invoice_id IS NOT NULL;

-- ------------------------------------------------------------
-- (i) Backfill completeness probe (Amendment F addition).
-- ------------------------------------------------------------
-- Any active row with classified_type='invoice' AND
-- target_entity_id IS NULL indicates a backfill gap — the
-- migration RAISEs and rolls back.

DO $$
DECLARE
  v_gap_count INT;
BEGIN
  SELECT COUNT(*) INTO v_gap_count
  FROM public.document_extractions
  WHERE deleted_at IS NULL
    AND classified_type = 'invoice'
    AND target_entity_id IS NULL;
  IF v_gap_count > 0 THEN
    RAISE EXCEPTION
      'Phase 3.1 backfill incomplete: % active rows have classified_type=''invoice'' but target_entity_id IS NULL. Investigate invoice_id IS NULL rows before re-running.',
      v_gap_count;
  END IF;
END $$;

COMMIT;
