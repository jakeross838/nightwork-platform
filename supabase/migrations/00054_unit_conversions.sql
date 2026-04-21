-- ===========================================================================
-- 00054_unit_conversions.sql
-- ===========================================================================
--
-- Unit Conversion Infrastructure
--
-- Makes cost intelligence data actually comparable across vendors by
-- normalizing observed units (box, bundle, pallet) into a canonical unit
-- (each, sf) per item. Adds:
--
--   1. items.canonical_unit + items.conversion_rules JSONB
--      The canonical unit is what cost intelligence queries use; the
--      conversion_rules JSONB stores "1 {unit} = {ratio} {canonical_units}".
--
--   2. vendor_item_pricing.observed_*/canonical_*
--      Each pricing row now captures both the observed numbers (what was
--      on the invoice) and the canonical numbers (normalized for
--      cross-vendor comparison).
--
--   3. unit_conversion_suggestions
--      AI-proposed conversions that require human confirmation before
--      they become permanent rules on the item.
--
--   4. unit_conversion_templates
--      Pre-seeded conversion knowledge (lumber bundles, drywall sheets,
--      tile boxes, etc.) that the AI consults and that populates new
--      items on creation.
--
-- TARGET: DEV Supabase (egxkffodxcefwpqmwrur) ONLY.
-- DO NOT APPLY TO PROD (vnpqjderiuhsiiygfwfb).
-- ===========================================================================

BEGIN;

-- ============================================================================
-- 1. ITEMS: canonical_unit + conversion_rules
-- ============================================================================

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS canonical_unit TEXT;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS conversion_rules JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.items.canonical_unit IS
  'Normalized unit used in cost-intelligence queries. For a 2x4x8, canonical_unit=''each'' and box/bundle prices are converted via conversion_rules.';

COMMENT ON COLUMN public.items.conversion_rules IS
  'Map of {unit: { ratio, notes }}. ratio means 1 {unit} = {ratio} {canonical_units}. Example: {"box": {"ratio": 20, "notes": "box covers 20 sf"}, "pallet": {"ratio": 400, "notes": "40 boxes per pallet"}}.';

-- Backfill canonical_unit from unit for existing items.
UPDATE public.items
SET canonical_unit = unit
WHERE canonical_unit IS NULL AND deleted_at IS NULL;

-- Make canonical_unit NOT NULL going forward.
-- (Unconstrained TEXT — templates may use non-enum units like bd_ft.)
ALTER TABLE public.items
  ALTER COLUMN canonical_unit SET NOT NULL;

-- ============================================================================
-- 2. VENDOR_ITEM_PRICING: observed_* + canonical_* + conversion_applied
-- ============================================================================

ALTER TABLE public.vendor_item_pricing
  ADD COLUMN IF NOT EXISTS observed_unit TEXT;
ALTER TABLE public.vendor_item_pricing
  ADD COLUMN IF NOT EXISTS observed_quantity NUMERIC(12, 4);
ALTER TABLE public.vendor_item_pricing
  ADD COLUMN IF NOT EXISTS observed_unit_price_cents BIGINT;

ALTER TABLE public.vendor_item_pricing
  ADD COLUMN IF NOT EXISTS canonical_quantity NUMERIC(12, 4);
ALTER TABLE public.vendor_item_pricing
  ADD COLUMN IF NOT EXISTS canonical_unit_price_cents BIGINT;

ALTER TABLE public.vendor_item_pricing
  ADD COLUMN IF NOT EXISTS conversion_applied JSONB;

COMMENT ON COLUMN public.vendor_item_pricing.observed_unit IS
  'Unit text exactly as captured from the invoice (box, bundle, etc).';
COMMENT ON COLUMN public.vendor_item_pricing.canonical_unit_price_cents IS
  'Unit price normalized into the item''s canonical_unit. This is the number cost-intelligence queries compare across vendors.';
COMMENT ON COLUMN public.vendor_item_pricing.conversion_applied IS
  'Snapshot of the rule used at capture time: {from_unit, to_unit, ratio, source}. Source is one of: tenant_rule | template | ai_suggested_confirmed | ai_suggested_pending | no_conversion.';

-- Backfill existing rows: assume observed == canonical (no conversion
-- was applied historically). conversion_applied.source='no_conversion'
-- marks them so we can spot rows that still need retroactive conversion
-- if we want to run a backfill pass later.
UPDATE public.vendor_item_pricing
SET
  observed_unit = COALESCE(observed_unit, unit),
  observed_quantity = COALESCE(observed_quantity, quantity),
  observed_unit_price_cents = COALESCE(observed_unit_price_cents, unit_price_cents),
  canonical_quantity = COALESCE(canonical_quantity, quantity),
  canonical_unit_price_cents = COALESCE(canonical_unit_price_cents, unit_price_cents),
  conversion_applied = COALESCE(
    conversion_applied,
    jsonb_build_object(
      'from_unit', unit,
      'to_unit', unit,
      'ratio', 1,
      'source', 'no_conversion'
    )
  )
WHERE deleted_at IS NULL
  AND (canonical_quantity IS NULL OR canonical_unit_price_cents IS NULL);

CREATE INDEX IF NOT EXISTS idx_vip_canonical_item_date
  ON public.vendor_item_pricing(org_id, item_id, transaction_date DESC)
  WHERE deleted_at IS NULL AND canonical_unit_price_cents IS NOT NULL;

-- ============================================================================
-- 3. UNIT CONVERSION SUGGESTIONS (AI proposals awaiting human confirmation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.unit_conversion_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,

  from_unit TEXT NOT NULL,
  to_unit TEXT NOT NULL,
  suggested_ratio NUMERIC(12, 6) NOT NULL,

  ai_reasoning TEXT,
  ai_confidence NUMERIC(4, 3),

  source_extraction_line_id UUID REFERENCES public.invoice_extraction_lines(id)
    ON DELETE SET NULL,

  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'rejected', 'superseded'))
    DEFAULT 'pending',
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,
  confirmed_ratio NUMERIC(12, 6),
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ucs_org_pending
  ON public.unit_conversion_suggestions(org_id, status)
  WHERE status = 'pending' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ucs_item
  ON public.unit_conversion_suggestions(item_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ucs_org_confirmed_recent
  ON public.unit_conversion_suggestions(org_id, confirmed_at DESC)
  WHERE status = 'confirmed' AND deleted_at IS NULL;

ALTER TABLE public.unit_conversion_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ucs_org_read ON public.unit_conversion_suggestions;
CREATE POLICY ucs_org_read ON public.unit_conversion_suggestions FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

DROP POLICY IF EXISTS ucs_org_write ON public.unit_conversion_suggestions;
CREATE POLICY ucs_org_write ON public.unit_conversion_suggestions FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

DROP POLICY IF EXISTS ucs_org_update ON public.unit_conversion_suggestions;
CREATE POLICY ucs_org_update ON public.unit_conversion_suggestions FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

COMMENT ON TABLE public.unit_conversion_suggestions IS
  'AI-proposed unit conversion ratios awaiting human confirmation. Confirmed rows are merged into items.conversion_rules; rejected rows are kept for audit.';

-- ============================================================================
-- 4. UNIT CONVERSION TEMPLATES (construction defaults — cross-org)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.unit_conversion_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_category TEXT NOT NULL,
  item_subcategory TEXT,
  specs_match JSONB,
  from_unit TEXT NOT NULL,
  to_unit TEXT NOT NULL,
  ratio NUMERIC(12, 6) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uct_category
  ON public.unit_conversion_templates(item_category, item_subcategory);

-- Templates are read-only reference data — every authenticated user can
-- read, but only platform admins can mutate (we seed via migration).
ALTER TABLE public.unit_conversion_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uct_read ON public.unit_conversion_templates;
CREATE POLICY uct_read ON public.unit_conversion_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS uct_platform_admin_write ON public.unit_conversion_templates;
CREATE POLICY uct_platform_admin_write ON public.unit_conversion_templates
  FOR ALL
  USING (app_private.is_platform_admin())
  WITH CHECK (app_private.is_platform_admin());

COMMENT ON TABLE public.unit_conversion_templates IS
  'Construction-industry default conversion ratios (bundle→each, sheet→sf, etc). Read-only for tenants; AI consults these when proposing conversions for new items.';

-- Seed core construction conversions. ON CONFLICT is unnecessary because
-- every row is new (this table doesn't exist until this migration runs),
-- but we use NOT EXISTS to make the migration idempotent if re-run.
INSERT INTO public.unit_conversion_templates
  (item_category, item_subcategory, from_unit, to_unit, ratio, notes)
SELECT v.item_category, v.item_subcategory, v.from_unit, v.to_unit, v.ratio, v.notes
FROM (VALUES
  -- Lumber
  ('lumber', 'dimensional_lumber', 'bundle', 'each', 48, 'Typical 2x4 bundle contains 48 pieces'),
  ('lumber', 'dimensional_lumber', 'bd_ft', 'each', 0.125, '1 bd-ft ~= 1/8 of a 2x4x8'),
  ('lumber', 'sheet_goods', 'pallet', 'each', 48, 'Typical plywood pallet contains 48 sheets'),
  -- Drywall
  ('drywall', 'gypsum_board', 'sheet', 'sf', 32, '4x8 sheet covers 32 sf'),
  ('drywall', 'gypsum_board', 'lift', 'sf', 2048, 'Typical lift = 64 sheets @ 32 sf'),
  -- Tile
  ('tile', 'ceramic', 'box', 'sf', 10, 'Box coverage varies — typical 10 sf for 12x12'),
  ('tile', 'porcelain', 'box', 'sf', 10, 'Box coverage varies — typical 10 sf for 12x12'),
  ('tile', 'any', 'pallet', 'sf', 400, 'Typical pallet = 40 boxes @ 10 sf'),
  -- Fasteners
  ('fasteners', 'any', 'box', 'each', 100, 'Default 100 per box — many variants exist'),
  ('fasteners', 'any', 'lb', 'each', 1, 'Weight-based count depends on fastener spec; placeholder'),
  -- Concrete
  ('concrete', 'any', 'cy', 'sf', 0.0185, '1 cy concrete ~= 54 sf at 4" thick'),
  -- Paint
  ('paint', 'any', 'gallon', 'sf', 350, '1 gal covers ~350 sf with one coat'),
  ('paint', 'any', 'bucket', 'gallon', 5, 'Standard 5-gallon bucket')
) AS v(item_category, item_subcategory, from_unit, to_unit, ratio, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.unit_conversion_templates t
  WHERE t.item_category = v.item_category
    AND COALESCE(t.item_subcategory, '') = COALESCE(v.item_subcategory, '')
    AND t.from_unit = v.from_unit
    AND t.to_unit = v.to_unit
);

COMMIT;
