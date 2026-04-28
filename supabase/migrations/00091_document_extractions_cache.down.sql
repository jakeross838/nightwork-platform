-- Down migration for 00091_document_extractions_cache.sql
--
-- Drops the extracted_data column. Cached extraction payloads for any
-- non-NULL rows are discarded irreversibly. Subsequent reads will be
-- forced to re-extract via Claude (the path that existed before 00091).

ALTER TABLE public.document_extractions
  DROP COLUMN IF EXISTS extracted_data;
