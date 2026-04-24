-- Migration 00079 — classification_confidence column on document_extractions
--
-- Phase 3.2 (document classifier) needs a typed confidence column to record
-- the classifier's certainty in classified_type. Spec calls for 4-decimal
-- precision (NUMERIC(5,4) — values 0.0000 to 1.0000) so we can store and
-- query confidence directly without JSONB extraction.
--
-- Why a column and not field_confidences JSONB:
--   - Phase 3.2 exit gate requires querying low-confidence rows
--     (classification_confidence < 0.70) for manual triage in Phase 3.10.
--     A column lets us add a partial index later without JSONB ops.
--   - Distinct from field_confidences (per-extracted-field map) — this is
--     the classifier's overall type-decision certainty, not a field-level
--     extraction confidence.
--
-- NOT NULL DEFAULT 0.0000:
--   - All 56 active rows backfill to 0.0000 (they were Phase 3.1 backfilled
--     to classified_type='invoice' WITHOUT a classifier run, so 0.0 is the
--     honest "we did not classify this" value). Phase 3.10 may treat
--     0.0000 as a special "needs reclassification" marker if needed.
--   - Future inserts via /api/ingest fill the real value at classify time.
--
-- CHECK constraint enforces 0.0 <= x <= 1.0 (NUMERIC(5,4) caps at 9.9999, so
-- without the CHECK we could record nonsense like 5.4321).
--
-- No trigger required — app-layer fills at classify time. R.23 precedent:
-- when value is set by a single well-defined code path, prefer app fill
-- over trigger (avoids action-at-a-distance).
--
-- Blast radius: additive only. No existing code reads or writes this
-- column. R.18 estimate: SMALL.
--
-- Slot note: preflight originally scoped migration 00078 for this column,
-- but 00078 was consumed on 2026-04-24 by the allocations backfill
-- (commit ab690f1). Column moves to 00079 with no semantic change.

ALTER TABLE public.document_extractions
  ADD COLUMN classification_confidence NUMERIC(5,4)
    NOT NULL DEFAULT 0.0000
    CHECK (classification_confidence >= 0.0000 AND classification_confidence <= 1.0000);

COMMENT ON COLUMN public.document_extractions.classification_confidence IS
  'Phase 3.2 classifier overall confidence in classified_type. Range 0.0000-1.0000. App-layer fill at classify time. 0.0000 default covers Phase 3.1 backfilled rows that were never classifier-routed. Distinct from field_confidences (per-field extraction confidence) by design - this is the type-decision confidence only.';
