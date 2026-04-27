-- Down migration for 00081.
--
-- Drops the type-aware CHECK and re-asserts NOT NULL on invoice_id.
-- Re-adding NOT NULL will FAIL if any rows have been inserted with
-- NULL invoice_id since 00081 was applied (which is expected as soon
-- as Phase 3.2 v2's /api/ingest classify-only path lands and writes
-- non-invoice document_extractions rows).
--
-- This failure is intentional. A down migration must not silently
-- discard rows. If you need to roll back 00081 after non-invoice
-- ingestions have happened, you must first decide whether to:
--   (a) export and remove those rows (data loss, but clean rollback),
--   (b) backfill invoice_id with placeholder invoice rows (preserves
--       data but creates synthetic invoices — usually wrong),
--   (c) abandon the rollback and forward-fix instead.
--
-- The first ALTER below should be run only after one of (a)/(b)/(c)
-- is decided.

ALTER TABLE public.document_extractions
  DROP CONSTRAINT IF EXISTS document_extractions_invoice_id_required_when_invoice_target;

ALTER TABLE public.document_extractions
  ALTER COLUMN invoice_id SET NOT NULL;

COMMENT ON COLUMN public.document_extractions.invoice_id IS
  'FK to invoices.id. NOT NULL — every extraction must be tied to an invoice (Phase 3.1 baseline shape).';
