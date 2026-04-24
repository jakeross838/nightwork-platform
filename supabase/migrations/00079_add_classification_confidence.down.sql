-- Down migration for 00079.
-- Additive column with default — no data preservation needed.

ALTER TABLE public.document_extractions
  DROP COLUMN IF EXISTS classification_confidence;
