-- ===========================================================================
-- 00058_line_nature_bom.sql
-- ===========================================================================
--
-- Line Nature Classification + Bill of Materials attachments.
--
-- Two real usage issues this addresses:
--
--   1. Scope items (labor+material bids) were being bucketed into the
--      Materials tab because they inherited their item_type from the older
--      taxonomy. We need a first-class classification — independent of
--      item_type and proposed_pricing_model — that the verification queue
--      can partition on directly.
--
--   2. $0 "spec lines" on subcontractor invoices (e.g. three lines naming
--      specific Carrier airhandler models, followed by a single bundled
--      install total) were being treated as zero_dollar_notes and ending up
--      in the Notes tab. They are actually bill-of-materials context for the
--      scope line on the same invoice. A dedicated table lets the AI attach
--      them automatically (with confidence tiers) and the PM confirm/edit.
--
-- Design notes:
--   * line_nature is NULL for rows that will be excluded from the queue:
--     flagged transaction lines (draws, progress payments, CO narratives)
--     and admin notes (location headers, payment reminders). Those rows
--     are soft-deleted by this migration — their raw description is
--     preserved on invoice_extractions.skipped_lines for audit.
--   * line_nature='bom_spec' marks a $0 product spec that is attached to
--     a scope line. These lines DO NOT appear in the main tabs — the UI
--     renders them as metadata on the scope line's detail panel.
--   * line_bom_attachments.bom_extraction_line_id has a unique index so a
--     given $0 spec line can only be attached to ONE scope line at a time.
--     Detaching soft-deletes the attachment and the spec line drops back
--     to the Review tab as unclassified.
--   * scope_split_into_components + scope_estimated_material_cents record
--     the PM's material-estimate split for a scope line. The split is
--     reversible and never fabricated — material/labor ratios only appear
--     if a human entered the material estimate.
--
-- TARGET: DEV Supabase (egxkffodxcefwpqmwrur) ONLY.
-- DO NOT APPLY TO PROD (vnpqjderiuhsiiygfwfb).
-- ===========================================================================

BEGIN;

-- ============================================================================
-- 1. LINE_NATURE — first-class classification on extraction lines
-- ============================================================================

ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS line_nature TEXT;

ALTER TABLE public.invoice_extraction_lines
  DROP CONSTRAINT IF EXISTS iel_line_nature_check;

ALTER TABLE public.invoice_extraction_lines
  ADD CONSTRAINT iel_line_nature_check
  CHECK (line_nature IS NULL OR line_nature IN (
    'material',       -- discrete physical goods from supplier
    'labor',          -- workmanship only, no material bundled
    'scope',          -- subcontractor labor + material bundled
    'equipment',      -- rental / separately billed
    'service',        -- recurring billable service
    'bom_spec',       -- $0 product spec attached to a scope line
    'unclassified'    -- AI couldn't determine — PM classifies in Review tab
  ));

COMMENT ON COLUMN public.invoice_extraction_lines.line_nature IS
  'First-class line classification driving verification-queue tab assignment. NULL on soft-deleted rows (flagged transactions / admin notes). bom_spec rows never appear in main tabs — they render as metadata on the scope line they attach to. unclassified rows surface in the Review tab for PM triage.';

CREATE INDEX IF NOT EXISTS idx_iel_line_nature
  ON public.invoice_extraction_lines(org_id, line_nature)
  WHERE deleted_at IS NULL AND line_nature IS NOT NULL;

-- ============================================================================
-- 2. BACKFILL line_nature on existing rows
-- ============================================================================
--
-- Map the older item_type / proposed_pricing_model / transaction flags into
-- the new nature taxonomy. Rows that were previously flagged (draws, notes,
-- etc) get NULL here and are soft-deleted in step 3 — their content is
-- preserved on invoice_extractions.skipped_lines in step 4.

UPDATE public.invoice_extraction_lines
SET line_nature = CASE
  WHEN is_transaction_line = TRUE THEN NULL
  WHEN proposed_pricing_model = 'scope' THEN 'scope'
  WHEN (proposed_item_data->>'item_type') = 'material' THEN 'material'
  WHEN (proposed_item_data->>'item_type') = 'labor' THEN 'labor'
  WHEN (proposed_item_data->>'item_type') = 'equipment' THEN 'equipment'
  WHEN (proposed_item_data->>'item_type') = 'service' THEN 'service'
  WHEN (proposed_item_data->>'item_type') = 'subcontract' THEN 'scope'
  ELSE 'unclassified'
END
WHERE line_nature IS NULL
  AND deleted_at IS NULL;

-- ============================================================================
-- 3. SKIPPED_LINES — preserve flagged/note content on invoice_extractions
-- ============================================================================

ALTER TABLE public.invoice_extractions
  ADD COLUMN IF NOT EXISTS skipped_lines JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.invoice_extractions.skipped_lines IS
  'Array of raw line content the AI chose NOT to persist as extraction_lines: draws, progress payments, CO narratives, location headers, payment reminders, other administrative text. Each entry: { raw_description, amount_cents, skip_reason, detected_type }. Preserved for audit — not shown in the verification queue.';

-- Backfill skipped_lines from existing soft-deletable transaction lines BEFORE
-- we soft-delete them, so audit history survives the restructure.
WITH flagged AS (
  SELECT
    extraction_id,
    jsonb_agg(
      jsonb_build_object(
        'raw_description', raw_description,
        'amount_cents', COALESCE(raw_total_cents, 0),
        'skip_reason', CASE
          WHEN transaction_line_type = 'zero_dollar_note' THEN 'admin_note'
          WHEN transaction_line_type IN ('draw', 'progress_payment', 'partial_payment') THEN 'flagged_transaction'
          WHEN transaction_line_type = 'change_order_narrative' THEN 'change_order_narrative'
          WHEN transaction_line_type IN ('rental_period', 'service_period') THEN 'flagged_transaction'
          ELSE 'other_non_item'
        END,
        'detected_type', COALESCE(transaction_line_type, 'unknown'),
        'backfilled_at', to_char(NOW() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )
      ORDER BY line_order
    ) AS entries
  FROM public.invoice_extraction_lines
  WHERE is_transaction_line = TRUE
    AND deleted_at IS NULL
  GROUP BY extraction_id
)
UPDATE public.invoice_extractions ie
SET skipped_lines = COALESCE(ie.skipped_lines, '[]'::jsonb) || flagged.entries
FROM flagged
WHERE ie.id = flagged.extraction_id
  AND ie.deleted_at IS NULL;

-- Soft-delete the flagged rows — their content now lives on the extraction
-- row's skipped_lines JSONB and should not pollute the verification queue.
-- Also soft-delete any components the flagged line may have had.
WITH flagged_line_ids AS (
  SELECT id
  FROM public.invoice_extraction_lines
  WHERE is_transaction_line = TRUE
    AND deleted_at IS NULL
)
UPDATE public.line_cost_components
SET deleted_at = NOW()
WHERE invoice_extraction_line_id IN (SELECT id FROM flagged_line_ids)
  AND deleted_at IS NULL;

UPDATE public.invoice_extraction_lines
SET deleted_at = NOW()
WHERE is_transaction_line = TRUE
  AND deleted_at IS NULL;

-- ============================================================================
-- 4. LINE_BOM_ATTACHMENTS — $0 spec lines attached to scope lines
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.line_bom_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),

  -- The scope line this BOM describes. Must be a line with line_nature='scope'.
  scope_extraction_line_id UUID NOT NULL
    REFERENCES public.invoice_extraction_lines(id) ON DELETE CASCADE,

  -- The $0 spec line being attached. Must be a line with line_nature='bom_spec'.
  bom_extraction_line_id UUID NOT NULL
    REFERENCES public.invoice_extraction_lines(id) ON DELETE CASCADE,

  -- AI confidence that the attachment is correct. NULL for manual attachments.
  ai_confidence NUMERIC(4, 3),
  ai_reasoning TEXT,

  attachment_source TEXT NOT NULL CHECK (attachment_source IN (
    'ai_auto',      -- AI confidence >= 0.85 — auto-confirmed
    'ai_suggested', -- AI confidence 0.5-0.85 — pending PM confirmation
    'manual'        -- PM attached manually via [Attach spec line]
  )),

  confirmation_status TEXT NOT NULL DEFAULT 'pending' CHECK (confirmation_status IN (
    'pending',    -- AI suggested, awaiting PM confirmation
    'confirmed',  -- auto-confirmed by AI (high confidence) or confirmed by PM
    'rejected'    -- PM rejected; soft-deleted by API, BOM line returns to Review
  )),

  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,

  -- Snapshot of the product identity the BOM line names. Populated by the AI
  -- during extraction for display purposes; the raw text also lives on the
  -- BOM extraction_line.raw_description so this is denormalized convenience.
  product_description TEXT,
  product_specs JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lba_scope
  ON public.line_bom_attachments(scope_extraction_line_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_lba_bom
  ON public.line_bom_attachments(bom_extraction_line_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_lba_pending
  ON public.line_bom_attachments(org_id, confirmation_status)
  WHERE confirmation_status = 'pending' AND deleted_at IS NULL;

-- A given BOM line can only be attached to ONE scope line at a time. Detach
-- before re-attaching elsewhere. Soft-deleted rows are excluded so history
-- is preserved.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lba_bom_unique
  ON public.line_bom_attachments(bom_extraction_line_id)
  WHERE deleted_at IS NULL;

-- updated_at trigger — reuse the project-wide touch_updated_at function
-- defined in migration 00052.
DROP TRIGGER IF EXISTS trg_lba_touch ON public.line_bom_attachments;
CREATE TRIGGER trg_lba_touch
  BEFORE UPDATE ON public.line_bom_attachments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- 5. RLS — org-scoped reads/writes + platform admin override
-- ============================================================================

ALTER TABLE public.line_bom_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lba_org_read ON public.line_bom_attachments;
CREATE POLICY lba_org_read ON public.line_bom_attachments FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

DROP POLICY IF EXISTS lba_org_write ON public.line_bom_attachments;
CREATE POLICY lba_org_write ON public.line_bom_attachments FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

DROP POLICY IF EXISTS lba_org_update ON public.line_bom_attachments;
CREATE POLICY lba_org_update ON public.line_bom_attachments FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

DROP POLICY IF EXISTS lba_org_delete ON public.line_bom_attachments;
CREATE POLICY lba_org_delete ON public.line_bom_attachments FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

-- ============================================================================
-- 6. SCOPE SPLIT TRACKING on extraction_lines
-- ============================================================================
--
-- When a PM enters a material estimate for a scope line, the scope total
-- splits into material + labor components. These columns track that state
-- so the UI can render the correct view (bundled vs split) and the split
-- can be reverted to the single labor_and_material component.

ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS scope_split_into_components BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS scope_estimated_material_cents BIGINT;

COMMENT ON COLUMN public.invoice_extraction_lines.scope_split_into_components IS
  'TRUE when the PM has split this scope line into material + labor components via the Split scope cost action. The split is reversible. FALSE (default) means the line renders as a single labor_and_material component.';

COMMENT ON COLUMN public.invoice_extraction_lines.scope_estimated_material_cents IS
  'PM-entered material estimate in cents. Labor is computed as (raw_total_cents - scope_estimated_material_cents). NULL when the line has not been split. Never fabricated by the AI — requires explicit PM input.';

COMMIT;
