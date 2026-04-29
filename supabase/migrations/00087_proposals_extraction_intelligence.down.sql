-- Reverts only the columns / table / FK / indexes added by 00087.
-- Legacy 00065 schema (proposals.amount, .received_date, .status_history,
-- proposal_line_items.cost_code_id, .unit, .unit_price, .amount,
-- .scope_detail, .sort_order) NOT touched.
--
-- WARNING: restoring NOT NULL on proposals.proposal_number will fail if
-- any rows exist with proposal_number IS NULL. Operator must clean up
-- (assign or delete) before rolling back. This is correct rollback
-- semantics — fail loudly to force resolution rather than silently
-- losing data.

-- ─────────────────────────────────────────────────────────────────────
-- DROP public.pending_cost_code_suggestions
-- (cascades to indexes, policies, trigger, comment)
-- ─────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.pending_cost_code_suggestions;

-- ─────────────────────────────────────────────────────────────────────
-- ALTER public.proposal_line_items — drop added columns + indexes
-- ─────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_proposal_line_items_org_cost_code;
DROP INDEX IF EXISTS public.idx_proposal_line_items_canonical_code;
DROP INDEX IF EXISTS public.idx_proposal_line_items_item;

ALTER TABLE public.proposal_line_items DROP COLUMN IF EXISTS pm_edits;
ALTER TABLE public.proposal_line_items DROP COLUMN IF EXISTS pm_edited;
ALTER TABLE public.proposal_line_items DROP COLUMN IF EXISTS extraction_confidence;
ALTER TABLE public.proposal_line_items DROP COLUMN IF EXISTS attributes;
ALTER TABLE public.proposal_line_items DROP COLUMN IF EXISTS notes_cents;
ALTER TABLE public.proposal_line_items DROP COLUMN IF EXISTS delivery_cents;
ALTER TABLE public.proposal_line_items DROP COLUMN IF EXISTS tax_cents;
ALTER TABLE public.proposal_line_items DROP COLUMN IF EXISTS subcontract_cost_cents;
ALTER TABLE public.proposal_line_items DROP COLUMN IF EXISTS labor_cost_cents;
ALTER TABLE public.proposal_line_items DROP COLUMN IF EXISTS material_cost_cents;
ALTER TABLE public.proposal_line_items DROP COLUMN IF EXISTS description_normalized;
ALTER TABLE public.proposal_line_items DROP COLUMN IF EXISTS item_id;
ALTER TABLE public.proposal_line_items DROP COLUMN IF EXISTS canonical_code_id;
ALTER TABLE public.proposal_line_items DROP COLUMN IF EXISTS org_cost_code_id;

-- ─────────────────────────────────────────────────────────────────────
-- ALTER public.proposals — drop added columns + index + FK + restore NOT NULL
-- ─────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS public.idx_proposals_source_document;

ALTER TABLE public.proposals
  DROP CONSTRAINT IF EXISTS proposals_source_document_id_fkey;

-- Restore NOT NULL on proposal_number (will fail if any NULL rows exist
-- — operator must clean up first).
ALTER TABLE public.proposals
  ALTER COLUMN proposal_number SET NOT NULL;

ALTER TABLE public.proposals DROP COLUMN IF EXISTS extraction_confidence;
ALTER TABLE public.proposals DROP COLUMN IF EXISTS raw_extraction;
ALTER TABLE public.proposals DROP COLUMN IF EXISTS vendor_stated_duration_days;
ALTER TABLE public.proposals DROP COLUMN IF EXISTS vendor_stated_start_date;
ALTER TABLE public.proposals DROP COLUMN IF EXISTS proposal_date;
