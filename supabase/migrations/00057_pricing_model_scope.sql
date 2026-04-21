-- ===========================================================================
-- 00057_pricing_model_scope.sql
-- ===========================================================================
--
-- Pricing Model + Scope Size.
--
-- Introduces the unit vs scope distinction for cost intelligence:
--
--   * UNIT items compare unit_price across vendors (2x4 lumber, tile slabs).
--   * SCOPE items compare total / scope_size_value on a size metric basis
--     (roof_sf, heated_sf, lf, job, etc.) — how subcontractors price work.
--
-- Also introduces the progressive-enrichment pattern for scope_size_value:
-- each observation carries a source (invoice_extraction, manual,
-- job_characteristics, daily_log, plan_ai, inferred) and confidence, so a
-- lower-confidence value can be replaced by a better source later.
--
-- TARGET: DEV Supabase (egxkffodxcefwpqmwrur) ONLY.
-- DO NOT APPLY TO PROD (vnpqjderiuhsiiygfwfb).
-- ===========================================================================

BEGIN;

-- ============================================================================
-- 1. ITEMS — pricing_model + scope_size_metric
-- ============================================================================

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS pricing_model TEXT NOT NULL DEFAULT 'unit'
  CHECK (pricing_model IN ('unit', 'scope'));

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS scope_size_metric TEXT;

COMMENT ON COLUMN public.items.pricing_model IS
  'unit = discrete purchasable goods compared by unit_price. scope = installed/completed work compared by total / scope_size_value on a size metric basis.';

COMMENT ON COLUMN public.items.scope_size_metric IS
  'Free-text size metric for scope items (e.g. roof_sf, heated_sf, tile_sf, stucco_sf, drywall_sf, paint_sf, lf, each, job). NULL for unit items.';

CREATE INDEX IF NOT EXISTS idx_items_pricing_model
  ON public.items(org_id, pricing_model) WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. VENDOR_ITEM_PRICING — scope observations
-- ============================================================================

ALTER TABLE public.vendor_item_pricing
  ADD COLUMN IF NOT EXISTS scope_size_value NUMERIC(12, 4);

ALTER TABLE public.vendor_item_pricing
  DROP CONSTRAINT IF EXISTS vip_scope_size_source_check;

ALTER TABLE public.vendor_item_pricing
  ADD COLUMN IF NOT EXISTS scope_size_source TEXT;

ALTER TABLE public.vendor_item_pricing
  ADD CONSTRAINT vip_scope_size_source_check
  CHECK (scope_size_source IS NULL OR scope_size_source IN (
    'invoice_extraction', 'manual', 'job_characteristics',
    'daily_log', 'plan_ai', 'inferred'
  ));

ALTER TABLE public.vendor_item_pricing
  ADD COLUMN IF NOT EXISTS scope_size_confidence NUMERIC(4, 3);

ALTER TABLE public.vendor_item_pricing
  ADD COLUMN IF NOT EXISTS scope_size_notes TEXT;

COMMENT ON COLUMN public.vendor_item_pricing.scope_size_value IS
  'Size of the scope being priced (e.g. 2400 for 2,400 roof_sf). NULL = enrichment needed; intelligence queries filter these out of $/metric calcs.';

COMMENT ON COLUMN public.vendor_item_pricing.scope_size_source IS
  'Where the size came from. invoice_extraction = AI read it off the invoice; manual = PM entered; job_characteristics = computed from jobs.heated_sf / roof_sf etc; daily_log = from a site measurement; plan_ai = AI read plan PDF; inferred = heuristic.';

CREATE INDEX IF NOT EXISTS idx_vip_scope_incomplete
  ON public.vendor_item_pricing(org_id, item_id)
  WHERE scope_size_value IS NULL AND deleted_at IS NULL;

-- ============================================================================
-- 3. INVOICE_EXTRACTION_LINES — proposed pricing model + extracted scope
-- ============================================================================

ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS proposed_pricing_model TEXT;

ALTER TABLE public.invoice_extraction_lines
  DROP CONSTRAINT IF EXISTS iel_proposed_pricing_model_check;

ALTER TABLE public.invoice_extraction_lines
  ADD CONSTRAINT iel_proposed_pricing_model_check
  CHECK (proposed_pricing_model IS NULL OR proposed_pricing_model IN ('unit', 'scope'));

ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS proposed_scope_size_metric TEXT;

ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS extracted_scope_size_value NUMERIC(12, 4);

ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS extracted_scope_size_confidence NUMERIC(4, 3);

ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS extracted_scope_size_source TEXT;

-- ============================================================================
-- 4. LINE_COST_COMPONENTS — allow labor_and_material
-- ============================================================================

ALTER TABLE public.line_cost_components
  DROP CONSTRAINT IF EXISTS line_cost_components_component_type_check;

ALTER TABLE public.line_cost_components
  ADD CONSTRAINT line_cost_components_component_type_check
  CHECK (component_type IN (
    'material', 'fabrication', 'installation', 'labor',
    'equipment_rental', 'delivery', 'fuel_surcharge',
    'handling', 'restocking', 'tax', 'waste_disposal',
    'permit_fee', 'bundled', 'labor_and_material', 'other'
  ));

COMMENT ON COLUMN public.line_cost_components.component_type IS
  'One of 15 types. bundled = unit-pricing vendor combined multiple costs into one number, no breakdown available. labor_and_material = scope-pricing default; never fabricate a breakdown — prefer labor_and_material for scope items.';

-- ============================================================================
-- 5. RECLASSIFY EXISTING ITEMS
-- ============================================================================
--
-- subcontract / service / labor → scope (trade labor, installed work).
-- material / equipment / other remain unit (default).

UPDATE public.items
SET pricing_model = 'scope'
WHERE deleted_at IS NULL
  AND item_type IN ('subcontract', 'service', 'labor')
  AND pricing_model = 'unit';

-- ============================================================================
-- 6. RECLASSIFY EXTRACTION LINES' proposed_pricing_model
-- ============================================================================

UPDATE public.invoice_extraction_lines
SET proposed_pricing_model =
  CASE
    WHEN (proposed_item_data->>'item_type') IN ('subcontract', 'service', 'labor')
      THEN 'scope'
    ELSE 'unit'
  END
WHERE deleted_at IS NULL
  AND proposed_pricing_model IS NULL;

-- ============================================================================
-- 7. RECLASSIFY EXISTING COMPONENTS ON SCOPE ITEMS → labor_and_material
-- ============================================================================
--
-- Two paths:
--   (a) components attached to vendor_item_pricing rows whose item is scope
--   (b) components attached to extraction_lines whose proposed_item_id OR
--       verified_item_id is scope, OR whose proposed_pricing_model = 'scope'
--
-- Only touch rows whose current type is a "catch-all" (bundled/material/
-- labor/subcontract) — don't clobber explicit breakdowns that a PM may have
-- already split, even if the item is being reclassified to scope.

UPDATE public.line_cost_components lcc
SET component_type = 'labor_and_material'
FROM public.vendor_item_pricing vip
JOIN public.items i ON i.id = vip.item_id
WHERE lcc.vendor_item_pricing_id = vip.id
  AND i.pricing_model = 'scope'
  AND lcc.component_type IN ('bundled', 'material', 'labor')
  AND lcc.deleted_at IS NULL;

UPDATE public.line_cost_components lcc
SET component_type = 'labor_and_material'
FROM public.invoice_extraction_lines iel
LEFT JOIN public.items i_verified ON i_verified.id = iel.verified_item_id
LEFT JOIN public.items i_proposed ON i_proposed.id = iel.proposed_item_id
WHERE lcc.invoice_extraction_line_id = iel.id
  AND (
    (i_verified.pricing_model = 'scope')
    OR (i_proposed.pricing_model = 'scope')
    OR (iel.proposed_pricing_model = 'scope')
  )
  AND lcc.component_type IN ('bundled', 'material', 'labor')
  AND lcc.deleted_at IS NULL;

COMMIT;
