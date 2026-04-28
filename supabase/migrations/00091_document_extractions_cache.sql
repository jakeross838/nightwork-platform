-- Phase 3.4 Issue 1 — document_extractions.extracted_data cache column.
--
-- Closes the gap explicitly deferred in 00076_document_extractions_rename
-- §AMENDMENT B. The proposal review surface re-POSTs /api/proposals/extract
-- on every mount (and again on refresh), and without a cache that re-runs
-- Claude Vision on every load (25–40s, ~$0.05–$0.30/call). Invoices persist
-- their parsed data into invoices/invoice_line_items at ingest, so they
-- have no equivalent re-extract path; proposals defer creation of the
-- proposals row until /api/proposals/commit, so the parsed payload has had
-- nowhere to live between extract and commit.
--
-- Adding `extracted_data JSONB NULL` lets the route persist the normalized
-- ParsedProposal envelope (line items, schedules, raw_response, etc.)
-- alongside the existing extraction metadata. Read-side becomes:
--   1. row.extracted_data exists AND row.extraction_prompt_version
--      matches current EXTRACTION_PROMPT_VERSION → return cached envelope
--   2. mismatch → re-extract and overwrite (auto-bust on prompt iteration)
--   3. ?force=true query param → bypass cache + re-extract
--
-- extraction_prompt_version already exists as a TEXT column on the table
-- (added in 00076). Keeping it as a separate column rather than nesting
-- inside extracted_data keeps the comparison a simple string equality
-- without JSONB-path lookups.
--
-- Idempotent ADD COLUMN IF NOT EXISTS. No backfill — existing rows have
-- NULL extracted_data and will be re-extracted on next access (the cache
-- miss path is the same as before this migration).

ALTER TABLE public.document_extractions
  ADD COLUMN IF NOT EXISTS extracted_data JSONB;

COMMENT ON COLUMN public.document_extractions.extracted_data IS
'Cached normalized extraction envelope (ParsedProposal for proposals; future doc types will follow same pattern). Populated by /api/proposals/extract on first extraction; consulted on subsequent calls and bypassed only when extraction_prompt_version mismatches the current code-side version, when ?force=true is passed, or when the column is NULL. Null on rows that pre-date this migration or have not yet been extracted. Closes the convergence gap noted in migration 00076 §AMENDMENT B.';
