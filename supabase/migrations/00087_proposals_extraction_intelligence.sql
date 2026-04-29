-- Phase 3.4 Step 1 — Schema migration only.
--
-- Extends 00065 proposals + proposal_line_items with extraction-related
-- columns. Creates pending_cost_code_suggestions for the PM role gate
-- (PMs cannot directly create org_cost_codes; they suggest, owners/admins
-- resolve).
--
-- Steps 2-7 of Phase 3.4 (extraction prompt + library, /api/proposals/*
-- routes, review UI, eval) deferred to a future session pending real-PDF
-- fixture transfer to this PC.
--
-- Pre-flight orphan check (must return 0 before applying):
--   SELECT count(*) FROM public.proposals
--   WHERE source_document_id IS NOT NULL
--     AND source_document_id NOT IN (SELECT id FROM public.document_extractions);
-- Confirmed 0 on dev 2026-04-27.
--
-- Conventions:
--   - All ALTERs idempotent via ADD COLUMN IF NOT EXISTS.
--   - Existing CHECK constraint on proposals.status (7 values) NOT touched.
--   - Existing UNIQUE (job_id, proposal_number) NOT touched. Postgres
--     treats NULLs as distinct in unique indexes by default
--     (NULLS DISTINCT — the existing constraint specifies no NULLS option,
--     so default applies). Multiple proposals with NULL proposal_number
--     on the same job are therefore permitted without index changes.
--   - Optimistic locking uses updated_at via existing updateWithLock()
--     pattern in src/lib/api/optimistic-lock.ts. No version column added.
--   - Legacy columns (proposals.amount, .received_date, .terms;
--     proposal_line_items.cost_code_id, .unit, .unit_price, .amount,
--     .scope_detail, .sort_order) NOT touched. New extraction columns
--     coexist alongside.
--   - extraction_confidence uses unscaled NUMERIC to match codebase
--     precedent (document_extractions.classification_confidence,
--     items.ai_confidence).

-- ─────────────────────────────────────────────────────────────────────
-- ALTER public.proposals — add extraction-related columns
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS proposal_date DATE;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS vendor_stated_start_date DATE;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS vendor_stated_duration_days INTEGER;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS raw_extraction JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS extraction_confidence NUMERIC;

-- Drop NOT NULL on proposal_number — subs don't always include one,
-- and we cannot fail extraction on a missing PDF identifier. Existing
-- UNIQUE (job_id, proposal_number) is preserved; default NULLS DISTINCT
-- behavior allows multiple NULL rows on the same job.
ALTER TABLE public.proposals
  ALTER COLUMN proposal_number DROP NOT NULL;

-- Promote existing source_document_id UUID to FK to document_extractions.
-- Pre-flight orphan check above must return 0 before this runs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.proposals'::regclass
      AND conname = 'proposals_source_document_id_fkey'
  ) THEN
    ALTER TABLE public.proposals
      ADD CONSTRAINT proposals_source_document_id_fkey
      FOREIGN KEY (source_document_id) REFERENCES public.document_extractions(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_proposals_source_document
  ON public.proposals (source_document_id)
  WHERE source_document_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- ALTER public.proposal_line_items — add extraction + cost-intel columns
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.proposal_line_items
  ADD COLUMN IF NOT EXISTS org_cost_code_id UUID
    REFERENCES public.org_cost_codes(id);

ALTER TABLE public.proposal_line_items
  ADD COLUMN IF NOT EXISTS canonical_code_id UUID
    REFERENCES public.canonical_cost_codes(id);

ALTER TABLE public.proposal_line_items
  ADD COLUMN IF NOT EXISTS item_id UUID
    REFERENCES public.items(id);

ALTER TABLE public.proposal_line_items
  ADD COLUMN IF NOT EXISTS description_normalized TEXT;

ALTER TABLE public.proposal_line_items
  ADD COLUMN IF NOT EXISTS material_cost_cents BIGINT;

ALTER TABLE public.proposal_line_items
  ADD COLUMN IF NOT EXISTS labor_cost_cents BIGINT;

ALTER TABLE public.proposal_line_items
  ADD COLUMN IF NOT EXISTS subcontract_cost_cents BIGINT;

ALTER TABLE public.proposal_line_items
  ADD COLUMN IF NOT EXISTS tax_cents BIGINT;

ALTER TABLE public.proposal_line_items
  ADD COLUMN IF NOT EXISTS delivery_cents BIGINT;

ALTER TABLE public.proposal_line_items
  ADD COLUMN IF NOT EXISTS notes_cents BIGINT;

ALTER TABLE public.proposal_line_items
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.proposal_line_items
  ADD COLUMN IF NOT EXISTS extraction_confidence NUMERIC;

ALTER TABLE public.proposal_line_items
  ADD COLUMN IF NOT EXISTS pm_edited BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.proposal_line_items
  ADD COLUMN IF NOT EXISTS pm_edits JSONB;

CREATE INDEX IF NOT EXISTS idx_proposal_line_items_org_cost_code
  ON public.proposal_line_items (org_cost_code_id)
  WHERE org_cost_code_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proposal_line_items_canonical_code
  ON public.proposal_line_items (canonical_code_id)
  WHERE canonical_code_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proposal_line_items_item
  ON public.proposal_line_items (item_id)
  WHERE item_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- CREATE public.pending_cost_code_suggestions — PM role gate
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pending_cost_code_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),

  -- Suggestion details
  suggested_code TEXT NOT NULL,
  suggested_name TEXT NOT NULL,
  suggested_canonical_code_id UUID REFERENCES public.canonical_cost_codes(id),
  suggested_parent_code TEXT,

  -- Context — why the PM thinks this code is needed
  source_proposal_line_item_id UUID
    REFERENCES public.proposal_line_items(id),
  rationale TEXT,

  -- Workflow
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
  approved_org_cost_code_id UUID REFERENCES public.org_cost_codes(id),

  -- Audit
  suggested_by UUID NOT NULL REFERENCES auth.users(id),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pcs_org_status_idx
  ON public.pending_cost_code_suggestions (org_id, status);

CREATE INDEX IF NOT EXISTS pcs_suggested_by_idx
  ON public.pending_cost_code_suggestions (suggested_by);

CREATE INDEX IF NOT EXISTS pcs_source_line_item_idx
  ON public.pending_cost_code_suggestions (source_proposal_line_item_id)
  WHERE source_proposal_line_item_id IS NOT NULL;

-- updated_at trigger — reuses project-wide function from 00001
DROP TRIGGER IF EXISTS trg_pending_cost_code_suggestions_updated_at
  ON public.pending_cost_code_suggestions;
CREATE TRIGGER trg_pending_cost_code_suggestions_updated_at
  BEFORE UPDATE ON public.pending_cost_code_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- RLS — pending_cost_code_suggestions
-- 3 policies (no DELETE — RLS-blocks-by-default; soft-delete via status).
--   SELECT: any active org member + platform admin bypass
--   INSERT: any active org member with role in (owner, admin, pm,
--           accounting) — mirrors proposals INSERT from 00065 so PMs
--           can suggest
--   UPDATE (resolve): owner/admin only — mirrors org_cost_codes write
--           gate from 00083
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.pending_cost_code_suggestions
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_cost_code_suggestions
  FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pcs_org_read
  ON public.pending_cost_code_suggestions;
CREATE POLICY pcs_org_read
  ON public.pending_cost_code_suggestions
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

DROP POLICY IF EXISTS pcs_org_insert
  ON public.pending_cost_code_suggestions;
CREATE POLICY pcs_org_insert
  ON public.pending_cost_code_suggestions
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

DROP POLICY IF EXISTS pcs_org_resolve
  ON public.pending_cost_code_suggestions;
CREATE POLICY pcs_org_resolve
  ON public.pending_cost_code_suggestions
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin')
    )
  );

COMMENT ON TABLE public.pending_cost_code_suggestions IS
  'PM role gate (Phase 3.4): PMs cannot directly create org_cost_codes. They suggest new codes via this table; owners/admins resolve via approve (creates org_cost_codes row + sets approved_org_cost_code_id) or reject. Soft-delete via status=rejected/duplicate; no hard DELETE.';
