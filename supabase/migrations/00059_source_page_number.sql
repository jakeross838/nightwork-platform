-- Migration 00059: add source_page_number to invoice_extraction_lines
--
-- Per diagnostic-source-highlighting.md (Option C — "minimum-data page-level
-- jump + description search"): extending the extraction prompt to capture
-- which PDF page each extracted line appears on. Downstream, react-pdf will
-- jump to that page and highlight the raw_description text when a PM
-- selects a line in the verification queue.
--
-- Nullable because older extractions (pre-Phase 2) do not have this value.
-- The viewer falls back to page 1 + a text search when null.

ALTER TABLE invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS source_page_number INT;

CREATE INDEX IF NOT EXISTS idx_iel_source_page
  ON invoice_extraction_lines(extraction_id, source_page_number)
  WHERE deleted_at IS NULL;
