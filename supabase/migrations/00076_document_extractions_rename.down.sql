-- ============================================================
-- 00076_document_extractions_rename.down.sql — Phase 3.1 rollback
-- ============================================================
--
-- Reverses migration 00076. Restores the pre-migration state:
--   public.document_extractions       → public.invoice_extractions
--   public.document_extraction_lines  → public.invoice_extraction_lines
--   drops classified_type / target_entity_type / target_entity_id
--   reverses 14 constraint renames, 2 trigger renames, 5 index
--   renames, 6 policy renames
--
-- Plan amendment commit: c5cbdb9
-- Pre-flight findings:   qa-reports/preflight-branch3-phase3.1.md
--                        (commit 777b752)
--
-- ------------------------------------------------------------
-- DATA-LOSS IMPLICATION
-- ------------------------------------------------------------
-- Dropping the 3 new columns loses:
--   (a) Any classifier-written values in classified_type /
--       target_entity_type / target_entity_id — zero rows at
--       Phase 3.1-immediate rollback, N rows if rollback happens
--       after Branch 3.2+ classifier starts populating.
--   (b) The Amendment F backfill (56 rows with invoice/invoice/
--       invoice_id) — but these values are identical to existing
--       invoice_id FK data, so no net loss at rollback (the UUID
--       is still in the preserved invoice_id column).
--
-- Rollback is SAFE pre-Phase 3.2 (no classifier data to lose yet).
-- Rollback becomes increasingly lossy after Phase 3.2+ because
-- dropping target_entity_type / target_entity_id discards the
-- classifier's commit-destination decisions for non-invoice
-- documents. Use platform-admin service role to snapshot the 3
-- columns into an audit table before running down.sql if there's
-- any concern about post-classifier rollback.
-- ------------------------------------------------------------

BEGIN;

-- ------------------------------------------------------------
-- (a) Drop the 3 new columns (reverse of up.sql step f/g).
-- ------------------------------------------------------------
-- Postgres automatically drops the CHECK constraints + COMMENT ON
-- COLUMN when the underlying column is dropped — no separate
-- DROP CONSTRAINT or COMMENT IS NULL needed.

ALTER TABLE public.document_extractions DROP COLUMN IF EXISTS target_entity_id;
ALTER TABLE public.document_extractions DROP COLUMN IF EXISTS target_entity_type;
ALTER TABLE public.document_extractions DROP COLUMN IF EXISTS classified_type;

-- ------------------------------------------------------------
-- (b) Reverse the 6 policy renames.
-- ------------------------------------------------------------

ALTER POLICY document_extraction_lines_org_update
  ON public.document_extraction_lines
  RENAME TO iel_org_update;

ALTER POLICY document_extraction_lines_org_write
  ON public.document_extraction_lines
  RENAME TO iel_org_write;

ALTER POLICY document_extraction_lines_org_read
  ON public.document_extraction_lines
  RENAME TO iel_org_read;

ALTER POLICY document_extractions_org_update
  ON public.document_extractions
  RENAME TO invoice_extractions_org_update;

ALTER POLICY document_extractions_org_write
  ON public.document_extractions
  RENAME TO invoice_extractions_org_write;

ALTER POLICY document_extractions_org_read
  ON public.document_extractions
  RENAME TO invoice_extractions_org_read;

-- ------------------------------------------------------------
-- (c) Reverse the 2 trigger renames.
-- ------------------------------------------------------------

ALTER TRIGGER trg_document_extraction_lines_touch
  ON public.document_extraction_lines
  RENAME TO trg_invoice_extraction_lines_touch;

ALTER TRIGGER trg_document_extractions_touch
  ON public.document_extractions
  RENAME TO trg_invoice_extractions_touch;

-- ------------------------------------------------------------
-- (d) Reverse the 14 non-pkey constraint renames.
-- ------------------------------------------------------------

-- document_extraction_lines side (10)
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT document_extraction_lines_verified_item_id_fkey
                 TO invoice_extraction_lines_verified_item_id_fkey;
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT document_extraction_lines_verified_by_fkey
                 TO invoice_extraction_lines_verified_by_fkey;
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT document_extraction_lines_verification_status_check
                 TO invoice_extraction_lines_verification_status_check;
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT document_extraction_lines_vendor_item_pricing_id_fkey
                 TO invoice_extraction_lines_vendor_item_pricing_id_fkey;
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT document_extraction_lines_transaction_line_type_check
                 TO invoice_extraction_lines_transaction_line_type_check;
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT document_extraction_lines_proposed_item_id_fkey
                 TO invoice_extraction_lines_proposed_item_id_fkey;
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT document_extraction_lines_org_id_fkey
                 TO invoice_extraction_lines_org_id_fkey;
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT document_extraction_lines_match_tier_check
                 TO invoice_extraction_lines_match_tier_check;
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT document_extraction_lines_invoice_line_item_id_fkey
                 TO invoice_extraction_lines_invoice_line_item_id_fkey;
ALTER TABLE public.document_extraction_lines
  RENAME CONSTRAINT document_extraction_lines_extraction_id_fkey
                 TO invoice_extraction_lines_extraction_id_fkey;

-- document_extractions side (4)
ALTER TABLE public.document_extractions
  RENAME CONSTRAINT document_extractions_verification_status_check
                 TO invoice_extractions_verification_status_check;
ALTER TABLE public.document_extractions
  RENAME CONSTRAINT document_extractions_verified_by_fkey
                 TO invoice_extractions_verified_by_fkey;
ALTER TABLE public.document_extractions
  RENAME CONSTRAINT document_extractions_org_id_fkey
                 TO invoice_extractions_org_id_fkey;
ALTER TABLE public.document_extractions
  RENAME CONSTRAINT document_extractions_invoice_id_fkey
                 TO invoice_extractions_invoice_id_fkey;

-- ------------------------------------------------------------
-- (e) Reverse the 5 index renames.
-- ------------------------------------------------------------

ALTER INDEX public.idx_document_extractions_status   RENAME TO idx_invoice_extractions_status;
ALTER INDEX public.idx_document_extractions_pending  RENAME TO idx_invoice_extractions_pending;
ALTER INDEX public.idx_document_extractions_invoice  RENAME TO idx_invoice_extractions_invoice;
ALTER INDEX public.document_extraction_lines_pkey    RENAME TO invoice_extraction_lines_pkey;
ALTER INDEX public.document_extractions_pkey         RENAME TO invoice_extractions_pkey;

-- ------------------------------------------------------------
-- (f) Rename tables back.
-- ------------------------------------------------------------

ALTER TABLE public.document_extraction_lines RENAME TO invoice_extraction_lines;
ALTER TABLE public.document_extractions      RENAME TO invoice_extractions;

COMMIT;
