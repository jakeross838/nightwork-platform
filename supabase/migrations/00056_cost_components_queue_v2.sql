-- ===========================================================================
-- 00056_cost_components_queue_v2.sql
-- ===========================================================================
--
-- Verification Queue V2 + Cost Components.
--
-- Three changes:
--
--   1. Expand invoice_extraction_lines.transaction_line_type CHECK to include
--      'zero_dollar_note'. Auto-flag any pending $0 line as a zero-dollar note
--      so the new Notes tab on the queue can surface them in bulk.
--
--   2. New line_cost_components table: hybrid component breakdown per
--      invoice_extraction_line and/or vendor_item_pricing row. Every line has
--      at least one component (even if just "bundled" for the full amount).
--      14 component types spanning material / fab / install / delivery / tax
--      / waste / permit / bundled / other.
--
--   3. Backfill every existing extraction_line + vip row with a single
--      default_bundled component so the UI always has components to render.
--
-- TARGET: DEV Supabase (egxkffodxcefwpqmwrur) ONLY.
-- DO NOT APPLY TO PROD (vnpqjderiuhsiiygfwfb).
-- ===========================================================================

BEGIN;

-- ============================================================================
-- 1. $0 AUTO-FLAG — expand transaction_line_type CHECK + flag pending lines
-- ============================================================================

ALTER TABLE public.invoice_extraction_lines
  DROP CONSTRAINT IF EXISTS iel_transaction_line_type_check;

ALTER TABLE public.invoice_extraction_lines
  DROP CONSTRAINT IF EXISTS invoice_extraction_lines_transaction_line_type_check;

ALTER TABLE public.invoice_extraction_lines
  ADD CONSTRAINT invoice_extraction_lines_transaction_line_type_check
  CHECK (transaction_line_type IS NULL OR transaction_line_type IN (
    'progress_payment', 'draw', 'rental_period',
    'service_period', 'change_order_narrative',
    'partial_payment', 'zero_dollar_note', 'other'
  ));

-- Flag pending $0 extraction lines so they surface in the Notes tab rather
-- than the Materials / Labor / etc. tabs. Only touches rows that are still
-- pending and not already flagged; don't disturb historical state.
UPDATE public.invoice_extraction_lines
SET
  is_transaction_line = TRUE,
  transaction_line_type = 'zero_dollar_note'
WHERE raw_total_cents = 0
  AND is_transaction_line = FALSE
  AND verification_status = 'pending'
  AND deleted_at IS NULL;

-- ============================================================================
-- 2. LINE_COST_COMPONENTS — hybrid component breakdown
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.line_cost_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),

  -- Parent references — at least one must be non-null.
  -- Staging: points to extraction_line.
  -- Committed: points to vendor_item_pricing (+ extraction_line for
  -- traceability).
  vendor_item_pricing_id UUID REFERENCES public.vendor_item_pricing(id)
    ON DELETE CASCADE,
  invoice_extraction_line_id UUID REFERENCES public.invoice_extraction_lines(id)
    ON DELETE CASCADE,

  component_type TEXT NOT NULL CHECK (component_type IN (
    'material', 'fabrication', 'installation', 'labor',
    'equipment_rental', 'delivery', 'fuel_surcharge',
    'handling', 'restocking', 'tax', 'waste_disposal',
    'permit_fee', 'bundled', 'other'
  )),

  amount_cents BIGINT NOT NULL,

  -- Optional per-component breakdown
  quantity NUMERIC(12, 4),
  unit TEXT,
  unit_rate_cents BIGINT,

  source TEXT NOT NULL CHECK (source IN (
    'invoice_explicit',
    'ai_extracted',
    'human_added',
    'default_bundled'
  )),
  ai_confidence NUMERIC(4, 3),

  notes TEXT,
  display_order INT DEFAULT 0,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT lcc_has_parent CHECK (
    vendor_item_pricing_id IS NOT NULL
    OR invoice_extraction_line_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_lcc_pricing
  ON public.line_cost_components(vendor_item_pricing_id)
  WHERE deleted_at IS NULL AND vendor_item_pricing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lcc_extraction_line
  ON public.line_cost_components(invoice_extraction_line_id)
  WHERE deleted_at IS NULL AND invoice_extraction_line_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lcc_org_type
  ON public.line_cost_components(org_id, component_type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_lcc_type_amount
  ON public.line_cost_components(component_type, amount_cents)
  WHERE deleted_at IS NULL;

-- updated_at trigger — reuse the project-wide touch_updated_at function
-- defined in migration 00052.
DROP TRIGGER IF EXISTS trg_lcc_touch ON public.line_cost_components;
CREATE TRIGGER trg_lcc_touch
  BEFORE UPDATE ON public.line_cost_components
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- 3. RLS — org-scoped reads/writes + platform admin override
-- ============================================================================

ALTER TABLE public.line_cost_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lcc_org_read ON public.line_cost_components;
CREATE POLICY lcc_org_read ON public.line_cost_components FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

DROP POLICY IF EXISTS lcc_org_write ON public.line_cost_components;
CREATE POLICY lcc_org_write ON public.line_cost_components FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

DROP POLICY IF EXISTS lcc_org_update ON public.line_cost_components;
CREATE POLICY lcc_org_update ON public.line_cost_components FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

DROP POLICY IF EXISTS lcc_org_delete ON public.line_cost_components;
CREATE POLICY lcc_org_delete ON public.line_cost_components FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

-- ============================================================================
-- 4. BACKFILL — one default_bundled component per existing row
-- ============================================================================
--
-- Every extraction_line and every vendor_item_pricing row gets a single
-- 'bundled' / type-appropriate component so the UI always has something to
-- render. component_type is derived from proposed item_type (or items.item_type
-- for pricing rows).

INSERT INTO public.line_cost_components (
  org_id,
  invoice_extraction_line_id,
  component_type,
  amount_cents,
  source,
  display_order
)
SELECT
  iel.org_id,
  iel.id,
  CASE
    WHEN (iel.proposed_item_data->>'item_type') = 'labor' THEN 'labor'
    WHEN (iel.proposed_item_data->>'item_type') = 'service' THEN 'labor'
    WHEN (iel.proposed_item_data->>'item_type') = 'equipment' THEN 'equipment_rental'
    WHEN (iel.proposed_item_data->>'item_type') = 'subcontract' THEN 'bundled'
    ELSE 'material'
  END,
  COALESCE(iel.raw_total_cents, 0),
  'default_bundled',
  0
FROM public.invoice_extraction_lines iel
WHERE iel.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.line_cost_components lcc
    WHERE lcc.invoice_extraction_line_id = iel.id
      AND lcc.deleted_at IS NULL
  );

INSERT INTO public.line_cost_components (
  org_id,
  vendor_item_pricing_id,
  component_type,
  amount_cents,
  source,
  display_order
)
SELECT
  vip.org_id,
  vip.id,
  CASE
    WHEN i.item_type = 'labor' THEN 'labor'
    WHEN i.item_type = 'service' THEN 'labor'
    WHEN i.item_type = 'equipment' THEN 'equipment_rental'
    WHEN i.item_type = 'subcontract' THEN 'bundled'
    ELSE 'material'
  END,
  vip.total_cents,
  'default_bundled',
  0
FROM public.vendor_item_pricing vip
JOIN public.items i ON i.id = vip.item_id
WHERE vip.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.line_cost_components lcc
    WHERE lcc.vendor_item_pricing_id = vip.id
      AND lcc.deleted_at IS NULL
  );

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.line_cost_components IS
  'Hybrid breakdown of a line''s total into typed components (material / fabrication / installation / delivery / tax / etc.). Every extraction_line and vendor_item_pricing row has >= 1 component. Sum of amount_cents across a line''s components SHOULD equal the line total (within rounding tolerance), but the UI warns rather than blocks on mismatches.';

COMMENT ON COLUMN public.line_cost_components.source IS
  'Where this component came from: invoice_explicit (itemized on the invoice), ai_extracted (AI detected from OCR), human_added (PM added manually), default_bundled (fallback when no breakdown is available).';

COMMENT ON COLUMN public.line_cost_components.component_type IS
  'One of 14 types. ''bundled'' means the vendor combined multiple costs into one number and we do not have a breakdown. NEVER fabricate a breakdown — prefer bundled over guessing.';

COMMIT;
