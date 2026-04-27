-- Migration 00081 — relax document_extractions.invoice_id to nullable
--
-- Phase 3.2 v2 — unblocks the universal /api/ingest route. v1 of Phase
-- 3.2 (Path Z, commit 975e06e) deferred /api/ingest entirely because
-- document_extractions.invoice_id was NOT NULL with an FK to invoices.
-- That meant the row could only be inserted in a flow that had already
-- created an invoice — which defeats the purpose of a type-agnostic
-- classifier endpoint that may be classifying a PO, CO, proposal, etc.
--
-- Phase 3.1 (migration 00076) renamed invoice_extractions →
-- document_extractions but explicitly preserved the invoice_id FK and
-- NOT NULL constraint to keep the rename behavior-preserving. That was
-- correct sequencing for 3.1; 3.2 v2 now needs the actual relaxation.
-- Phases 3.3–3.8 (PO / CO / proposal / vendor / budget / historical_draw
-- extraction pipelines) all require this nullability — they will
-- populate target_entity_type and target_entity_id at commit time, with
-- invoice_id staying NULL whenever the document is not an invoice.
--
-- Why a CHECK guards target_entity_type='invoice':
--   When an extraction IS committed against an invoice (the existing
--   Phase 3.1 path, target_entity_type='invoice'), invoice_id MUST be
--   populated so downstream FKs and the existing invoice ↔ extraction
--   relationship continue to work. The CHECK enforces that
--   invariant at the database level so a future writer cannot leave
--   target_entity_type='invoice' with NULL invoice_id.
--
--   For target_entity_type IN ('purchase_order','change_order',
--   'proposal','vendor','budget','historical_draw') OR NULL, the
--   invoice_id field is allowed to remain NULL.
--
-- Pre-deploy verification (must return 0 before applying):
--   SELECT count(*) FROM public.document_extractions
--   WHERE target_entity_type = 'invoice' AND invoice_id IS NULL;
-- Verified 0 on dev 2026-04-27 prior to authoring this migration.
--
-- Slot note: spec called for slot 00080, but 00080 was consumed by the
-- Phase A lockdown's RLS-enable migration (commit 37f0891, PR #23,
-- merged 2026-04-27). This migration takes the next free slot 00081.
-- No semantic change from the spec; only the numeric prefix shifted.
--
-- Blast radius: SMALL.
--   - 1 column constraint relaxed (DROP NOT NULL on invoice_id).
--   - 1 CHECK constraint added enforcing the type-aware requirement.
--   - 0 rows mutated. All 57 existing rows already satisfy the new
--     CHECK (every existing row has both invoice_id populated and
--     classified_type='invoice'; the existing target_entity_type
--     column was added by 00076 and is NULL on every existing row, so
--     the predicate `target_entity_type IS DISTINCT FROM 'invoice'`
--     resolves to TRUE for all existing rows — they pass the CHECK).
--   - Down migration drops the CHECK and re-adds NOT NULL. Re-adding
--     NOT NULL will fail if any rows have been inserted with NULL
--     invoice_id by then, which is the correct behavior — a down
--     migration must not silently discard data.

ALTER TABLE public.document_extractions
  ALTER COLUMN invoice_id DROP NOT NULL;

ALTER TABLE public.document_extractions
  ADD CONSTRAINT document_extractions_invoice_id_required_when_invoice_target
  CHECK (target_entity_type IS DISTINCT FROM 'invoice' OR invoice_id IS NOT NULL);

COMMENT ON COLUMN public.document_extractions.invoice_id IS
  'Nullable as of migration 00081. Required only when target_entity_type=''invoice'' (enforced by document_extractions_invoice_id_required_when_invoice_target). NULL during the Phase 3.2 classify step and during Phase 3.3-3.8 pre-commit extraction for non-invoice document types. Populated at commit time alongside target_entity_type=''invoice'' for the invoice path.';
