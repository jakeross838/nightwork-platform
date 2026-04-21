-- ===========================================================================
-- 00052_cost_intelligence_spine.sql
-- ===========================================================================
--
-- Cost Intelligence Spine — Wave 1A
--
-- Foundational data layer for Nightwork's cost intelligence platform:
--
--   1. Two-stage capture: invoice_extractions + invoice_extraction_lines
--      hold AI-extracted data in a staging area until a human verifies
--      each line. Unverified data does NOT enter the spine.
--
--   2. Universal items taxonomy (items) — AI-assigned item_type /
--      category / subcategory independent of a tenant's cost codes.
--
--   3. Vendor-scoped alias library (item_aliases) — cheap exact + fuzzy
--      tiers before spending AI tokens.
--
--   4. The spine (vendor_item_pricing) — source_type column means future
--      POs, COs, proposals, quotes, and manual entries all write to the
--      same table without schema change.
--
--   5. job_item_activity — plan vs actual rollup per job/item.
--
--   6. item_classification_corrections — every human correction feeds
--      back as training/context signal for future extractions.
--
--   7. Selections (selection_categories + selections) — schema only.
--      No UI surface yet (Wave 1B).
--
--   8. Home characteristics columns on jobs — optional, no enforcement.
--
--   9. organizations.cost_intelligence_settings — per-org auto-commit
--      gate (default OFF — verification is required by default).
--
-- TARGET: DEV Supabase (egxkffodxcefwpqmwrur) ONLY.
-- DO NOT APPLY TO PROD (vnpqjderiuhsiiygfwfb).
-- ===========================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 1. ITEMS — universal "thing" model
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),

  canonical_name TEXT NOT NULL,
  description TEXT,

  item_type TEXT NOT NULL CHECK (item_type IN (
    'material', 'labor', 'equipment', 'service',
    'subcontract', 'other'
  )),
  category TEXT,
  subcategory TEXT,
  specs JSONB DEFAULT '{}'::jsonb,

  unit TEXT NOT NULL CHECK (unit IN (
    'each', 'sf', 'lf', 'sy', 'cy', 'lb', 'gal',
    'hr', 'day', 'lump_sum', 'pkg', 'box'
  )),

  default_cost_code_id UUID REFERENCES public.cost_codes(id),

  first_seen_source TEXT,
  ai_confidence NUMERIC(4, 3),

  human_verified BOOLEAN DEFAULT FALSE,
  human_verified_at TIMESTAMPTZ,
  human_verified_by UUID REFERENCES auth.users(id),

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_items_org
  ON public.items(org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_items_category
  ON public.items(org_id, category, subcategory) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_items_type
  ON public.items(org_id, item_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_items_canonical_lower
  ON public.items(org_id, lower(canonical_name)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_items_canonical_trgm
  ON public.items USING gin(canonical_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_specs
  ON public.items USING gin(specs);

-- ============================================================================
-- 2. ITEM ALIASES — vendor-scoped fuzzy match shortcuts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.item_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  alias_text TEXT NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id),
  source_type TEXT,
  occurrence_count INT DEFAULT 1,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_aliases_org_item
  ON public.item_aliases(org_id, item_id);
CREATE INDEX IF NOT EXISTS idx_item_aliases_text_lower
  ON public.item_aliases(org_id, lower(alias_text));
CREATE INDEX IF NOT EXISTS idx_item_aliases_vendor_text
  ON public.item_aliases(vendor_id, lower(alias_text));
CREATE INDEX IF NOT EXISTS idx_item_aliases_text_trgm
  ON public.item_aliases USING gin(alias_text gin_trgm_ops);

CREATE UNIQUE INDEX IF NOT EXISTS idx_item_aliases_unique
  ON public.item_aliases(
    org_id,
    item_id,
    COALESCE(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(alias_text)
  );

-- ============================================================================
-- 3. VENDOR ITEM PRICING — the spine
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vendor_item_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  item_id UUID NOT NULL REFERENCES public.items(id),

  unit_price_cents BIGINT NOT NULL,
  quantity NUMERIC(12, 4) NOT NULL,
  total_cents BIGINT NOT NULL,
  unit TEXT NOT NULL,

  job_id UUID REFERENCES public.jobs(id),
  cost_code_id UUID REFERENCES public.cost_codes(id),
  scope_tags TEXT[],

  source_type TEXT NOT NULL CHECK (source_type IN (
    'invoice', 'invoice_line', 'po', 'po_line',
    'co', 'co_line', 'proposal', 'quote', 'manual_entry'
  )),
  source_invoice_id UUID REFERENCES public.invoices(id),
  source_invoice_line_id UUID REFERENCES public.invoice_line_items(id),
  source_extraction_line_id UUID, -- FK added after extraction_lines created
  source_po_id UUID,
  source_co_id UUID,
  source_doc_url TEXT,

  transaction_date DATE NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  ai_confidence NUMERIC(4, 3),
  created_via TEXT CHECK (created_via IN (
    'alias_match', 'trigram_match', 'ai_semantic_match',
    'ai_new_item', 'manual'
  )),

  human_verified BOOLEAN DEFAULT FALSE,
  human_verified_by UUID REFERENCES auth.users(id),
  human_verified_at TIMESTAMPTZ,
  auto_committed BOOLEAN DEFAULT FALSE,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vip_org
  ON public.vendor_item_pricing(org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vip_vendor_item_date
  ON public.vendor_item_pricing(org_id, vendor_id, item_id, transaction_date DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vip_item_date
  ON public.vendor_item_pricing(org_id, item_id, transaction_date DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vip_job
  ON public.vendor_item_pricing(org_id, job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vip_extraction
  ON public.vendor_item_pricing(source_extraction_line_id)
  WHERE deleted_at IS NULL AND source_extraction_line_id IS NOT NULL;

-- ============================================================================
-- 4. INVOICE EXTRACTIONS — staging for two-stage capture
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invoice_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,

  raw_ocr_text TEXT,
  raw_pdf_url TEXT,

  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  extraction_model TEXT,
  extraction_prompt_version TEXT,
  total_tokens_input INT,
  total_tokens_output INT,

  field_confidences JSONB DEFAULT '{}'::jsonb,

  verification_status TEXT NOT NULL CHECK (verification_status IN (
    'pending', 'partial', 'verified', 'rejected'
  )) DEFAULT 'pending',
  verified_lines_count INT DEFAULT 0,
  total_lines_count INT DEFAULT 0,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),

  auto_committed BOOLEAN DEFAULT FALSE,
  auto_commit_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_extractions_invoice
  ON public.invoice_extractions(invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_extractions_status
  ON public.invoice_extractions(org_id, verification_status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_extractions_pending
  ON public.invoice_extractions(org_id, created_at DESC)
  WHERE verification_status IN ('pending', 'partial') AND deleted_at IS NULL;

-- ============================================================================
-- 5. INVOICE EXTRACTION LINES — per-line staging
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invoice_extraction_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  extraction_id UUID NOT NULL REFERENCES public.invoice_extractions(id)
    ON DELETE CASCADE,
  invoice_line_item_id UUID REFERENCES public.invoice_line_items(id),

  line_order INT NOT NULL,

  raw_description TEXT NOT NULL,
  raw_quantity NUMERIC(12, 4),
  raw_unit_price_cents BIGINT,
  raw_total_cents BIGINT,
  raw_unit_text TEXT,

  proposed_item_id UUID REFERENCES public.items(id),
  proposed_item_data JSONB,

  match_tier TEXT CHECK (match_tier IN (
    'alias_match', 'trigram_match', 'ai_semantic_match', 'ai_new_item'
  )),
  match_confidence NUMERIC(4, 3),
  match_reasoning TEXT,
  candidates_considered JSONB,

  verification_status TEXT NOT NULL CHECK (verification_status IN (
    'pending', 'verified', 'corrected', 'rejected', 'auto_committed'
  )) DEFAULT 'pending',

  verified_item_id UUID REFERENCES public.items(id),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  correction_notes TEXT,

  vendor_item_pricing_id UUID REFERENCES public.vendor_item_pricing(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_iel_extraction
  ON public.invoice_extraction_lines(extraction_id, line_order)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_iel_pending
  ON public.invoice_extraction_lines(org_id, verification_status)
  WHERE verification_status = 'pending' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_iel_invoice_line
  ON public.invoice_extraction_lines(invoice_line_item_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_iel_org
  ON public.invoice_extraction_lines(org_id) WHERE deleted_at IS NULL;

-- Now add the deferred FK on vendor_item_pricing back to extraction_lines
ALTER TABLE public.vendor_item_pricing
  ADD CONSTRAINT vip_source_extraction_line_fk
  FOREIGN KEY (source_extraction_line_id)
  REFERENCES public.invoice_extraction_lines(id)
  ON DELETE SET NULL;

-- ============================================================================
-- 6. JOB ITEM ACTIVITY — plan vs actual rollup
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.job_item_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  job_id UUID NOT NULL REFERENCES public.jobs(id),
  item_id UUID NOT NULL REFERENCES public.items(id),

  planned_quantity NUMERIC(12, 4),
  planned_unit_price_cents BIGINT,
  planned_total_cents BIGINT,
  planned_vendor_id UUID REFERENCES public.vendors(id),

  actual_quantity NUMERIC(12, 4),
  actual_total_cents BIGINT,

  status TEXT NOT NULL CHECK (status IN (
    'planned', 'ordered', 'partial_received',
    'fully_received', 'installed', 'rejected', 'cancelled'
  )) DEFAULT 'planned',

  cost_code_id UUID REFERENCES public.cost_codes(id),
  scope_tags TEXT[],

  first_purchase_date DATE,
  last_purchase_date DATE,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jia_job
  ON public.job_item_activity(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jia_item
  ON public.job_item_activity(item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jia_status
  ON public.job_item_activity(org_id, status) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_jia_job_item_unique
  ON public.job_item_activity(job_id, item_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- 7. ITEM CLASSIFICATION CORRECTIONS — training signal
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.item_classification_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),

  source_text TEXT NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id),

  ai_item_id UUID REFERENCES public.items(id),
  ai_canonical_name TEXT,
  ai_specs JSONB,
  ai_confidence NUMERIC(4, 3),
  ai_created_via TEXT,

  corrected_item_id UUID REFERENCES public.items(id),
  corrected_canonical_name TEXT,
  corrected_specs JSONB,

  source_type TEXT,
  source_record_id UUID,

  corrected_by UUID REFERENCES auth.users(id),
  correction_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_icc_org
  ON public.item_classification_corrections(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_icc_vendor_text
  ON public.item_classification_corrections(vendor_id, lower(source_text));

-- ============================================================================
-- 8. SELECTIONS (schema only, no UI in 1A)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.selection_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  display_order INT DEFAULT 0,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_selection_categories_org
  ON public.selection_categories(org_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  job_id UUID NOT NULL REFERENCES public.jobs(id),
  category_id UUID REFERENCES public.selection_categories(id),

  name TEXT NOT NULL,
  description TEXT,

  allowance_cents BIGINT,
  allowance_notes TEXT,

  selected_product_name TEXT,
  selected_product_specs JSONB,
  selected_vendor_id UUID REFERENCES public.vendors(id),

  decided_at TIMESTAMPTZ,
  decided_by_owner_name TEXT,

  estimated_cost_cents BIGINT,
  actual_cost_cents BIGINT,
  cost_delta_cents BIGINT,

  linked_item_id UUID REFERENCES public.items(id),

  status TEXT NOT NULL CHECK (status IN (
    'pending', 'specified', 'owner_review',
    'owner_approved', 'ordered', 'received',
    'installed', 'cancelled'
  )) DEFAULT 'pending',

  needed_by_date DATE,
  ordered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  installed_at TIMESTAMPTZ,
  lead_time_days INT,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  status_history JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_selections_job
  ON public.selections(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_selections_status
  ON public.selections(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_selections_category
  ON public.selections(category_id) WHERE deleted_at IS NULL;

-- Seed default selection categories for every existing org
INSERT INTO public.selection_categories (org_id, name, display_order)
SELECT o.id, d.name, d.ord
FROM public.organizations o,
LATERAL (VALUES
  ('Appliances', 1), ('Plumbing Fixtures', 2),
  ('Hardware', 3), ('Lighting', 4), ('Tile', 5),
  ('Flooring', 6), ('Cabinetry', 7), ('Countertops', 8),
  ('Paint Colors', 9), ('Trim & Millwork', 10),
  ('Doors', 11), ('Windows', 12), ('Exterior Finishes', 13)
) AS d(name, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM public.selection_categories sc
  WHERE sc.org_id = o.id AND sc.name = d.name AND sc.deleted_at IS NULL
);

-- ============================================================================
-- 9. HOME CHARACTERISTICS on jobs (optional, no enforcement)
-- ============================================================================

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS heated_sf INT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS total_sf INT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS bedroom_count INT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS bathroom_count NUMERIC(3, 1);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS half_bathroom_count INT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS story_count INT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS garage_bay_count INT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS lot_size_sf INT;

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS finish_level TEXT;
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_finish_level_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_finish_level_check
  CHECK (finish_level IS NULL OR finish_level IN (
    'production', 'semi_custom', 'custom', 'luxury', 'ultra_luxury'
  ));

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS construction_type TEXT;
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_construction_type_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_construction_type_check
  CHECK (construction_type IS NULL OR construction_type IN (
    'wood_frame', 'cmu', 'cmu_wood_hybrid',
    'timber_frame', 'icf', 'steel_frame'
  ));

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS site_characteristics JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS complexity_factors JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS region_jurisdiction JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS characteristics_enrichment_source JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- 10. ORG-LEVEL COST INTELLIGENCE CONFIG
-- ============================================================================

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS
  cost_intelligence_settings JSONB DEFAULT jsonb_build_object(
    'auto_commit_enabled', false,
    'auto_commit_threshold', 0.95,
    'verification_required_for_low_confidence', true
  );

-- Backfill any pre-existing NULLs
UPDATE public.organizations
SET cost_intelligence_settings = jsonb_build_object(
  'auto_commit_enabled', false,
  'auto_commit_threshold', 0.95,
  'verification_required_for_low_confidence', true
)
WHERE cost_intelligence_settings IS NULL;

-- ============================================================================
-- 11. UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_items_touch ON public.items;
CREATE TRIGGER trg_items_touch
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_job_item_activity_touch ON public.job_item_activity;
CREATE TRIGGER trg_job_item_activity_touch
  BEFORE UPDATE ON public.job_item_activity
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_selections_touch ON public.selections;
CREATE TRIGGER trg_selections_touch
  BEFORE UPDATE ON public.selections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_invoice_extractions_touch ON public.invoice_extractions;
CREATE TRIGGER trg_invoice_extractions_touch
  BEFORE UPDATE ON public.invoice_extractions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_invoice_extraction_lines_touch
  ON public.invoice_extraction_lines;
CREATE TRIGGER trg_invoice_extraction_lines_touch
  BEFORE UPDATE ON public.invoice_extraction_lines
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- 12. SPINE SIDE-EFFECTS: after insert on vendor_item_pricing
--
-- Keeps:
--   - job_item_activity.actual_* rollups fresh
--   - item_aliases inserted / occurrence_count incremented
-- ============================================================================

CREATE OR REPLACE FUNCTION app_private.vip_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alias_text TEXT;
BEGIN
  -- Maintain job_item_activity rollup when job_id present
  IF NEW.job_id IS NOT NULL THEN
    INSERT INTO public.job_item_activity (
      org_id, job_id, item_id,
      actual_quantity, actual_total_cents,
      cost_code_id,
      first_purchase_date, last_purchase_date,
      status
    )
    VALUES (
      NEW.org_id, NEW.job_id, NEW.item_id,
      NEW.quantity, NEW.total_cents,
      NEW.cost_code_id,
      NEW.transaction_date, NEW.transaction_date,
      'partial_received'
    )
    ON CONFLICT (job_id, item_id) WHERE deleted_at IS NULL
    DO UPDATE SET
      actual_quantity = COALESCE(job_item_activity.actual_quantity, 0) + EXCLUDED.actual_quantity,
      actual_total_cents = COALESCE(job_item_activity.actual_total_cents, 0) + EXCLUDED.actual_total_cents,
      last_purchase_date = GREATEST(
        job_item_activity.last_purchase_date,
        EXCLUDED.last_purchase_date
      ),
      first_purchase_date = COALESCE(
        job_item_activity.first_purchase_date,
        EXCLUDED.first_purchase_date
      ),
      updated_at = NOW();
  END IF;

  -- Maintain alias table: pull the raw_description from the extraction line
  -- if present. Otherwise skip.
  IF NEW.source_extraction_line_id IS NOT NULL THEN
    SELECT iel.raw_description INTO v_alias_text
    FROM public.invoice_extraction_lines iel
    WHERE iel.id = NEW.source_extraction_line_id;

    IF v_alias_text IS NOT NULL AND length(trim(v_alias_text)) > 0 THEN
      INSERT INTO public.item_aliases (
        org_id, item_id, alias_text, vendor_id,
        source_type, occurrence_count,
        first_seen_at, last_seen_at
      )
      VALUES (
        NEW.org_id, NEW.item_id, v_alias_text, NEW.vendor_id,
        NEW.source_type, 1, NOW(), NOW()
      )
      ON CONFLICT (
        org_id,
        item_id,
        (COALESCE(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid)),
        lower(alias_text)
      )
      DO UPDATE SET
        occurrence_count = item_aliases.occurrence_count + 1,
        last_seen_at = NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vip_after_insert ON public.vendor_item_pricing;
CREATE TRIGGER trg_vip_after_insert
  AFTER INSERT ON public.vendor_item_pricing
  FOR EACH ROW EXECUTE FUNCTION app_private.vip_after_insert();

-- ============================================================================
-- 13. EXTRACTION LINE STATUS ROLLUP
--
-- When an extraction_line's verification_status changes, recompute the
-- parent invoice_extractions.verification_status + verified_lines_count.
-- ============================================================================

CREATE OR REPLACE FUNCTION app_private.iel_status_rollup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INT;
  v_verified INT;
  v_rejected INT;
  v_pending INT;
  v_new_status TEXT;
  v_extraction_id UUID;
BEGIN
  v_extraction_id := COALESCE(NEW.extraction_id, OLD.extraction_id);

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE verification_status IN ('verified', 'corrected', 'auto_committed')),
    COUNT(*) FILTER (WHERE verification_status = 'rejected'),
    COUNT(*) FILTER (WHERE verification_status = 'pending')
  INTO v_total, v_verified, v_rejected, v_pending
  FROM public.invoice_extraction_lines
  WHERE extraction_id = v_extraction_id AND deleted_at IS NULL;

  IF v_total = 0 THEN
    v_new_status := 'pending';
  ELSIF v_pending = 0 AND v_verified = v_total THEN
    v_new_status := 'verified';
  ELSIF v_pending = 0 AND v_verified = 0 THEN
    v_new_status := 'rejected';
  ELSIF v_verified > 0 OR v_rejected > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'pending';
  END IF;

  UPDATE public.invoice_extractions
  SET
    verification_status = v_new_status,
    verified_lines_count = v_verified,
    total_lines_count = v_total,
    verified_at = CASE WHEN v_new_status = 'verified' THEN NOW() ELSE verified_at END,
    updated_at = NOW()
  WHERE id = v_extraction_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_iel_status_rollup ON public.invoice_extraction_lines;
CREATE TRIGGER trg_iel_status_rollup
  AFTER INSERT OR UPDATE OF verification_status OR DELETE
  ON public.invoice_extraction_lines
  FOR EACH ROW EXECUTE FUNCTION app_private.iel_status_rollup();

-- ============================================================================
-- 14. ROW LEVEL SECURITY
-- ============================================================================

-- Items
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS items_org_read ON public.items;
CREATE POLICY items_org_read ON public.items FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

DROP POLICY IF EXISTS items_org_write ON public.items;
CREATE POLICY items_org_write ON public.items FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

DROP POLICY IF EXISTS items_org_update ON public.items;
CREATE POLICY items_org_update ON public.items FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

-- Item aliases
ALTER TABLE public.item_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS item_aliases_org_read ON public.item_aliases;
CREATE POLICY item_aliases_org_read ON public.item_aliases FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

DROP POLICY IF EXISTS item_aliases_org_write ON public.item_aliases;
CREATE POLICY item_aliases_org_write ON public.item_aliases FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

DROP POLICY IF EXISTS item_aliases_org_update ON public.item_aliases;
CREATE POLICY item_aliases_org_update ON public.item_aliases FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

-- Vendor item pricing
ALTER TABLE public.vendor_item_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vip_org_read ON public.vendor_item_pricing;
CREATE POLICY vip_org_read ON public.vendor_item_pricing FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

DROP POLICY IF EXISTS vip_org_write ON public.vendor_item_pricing;
CREATE POLICY vip_org_write ON public.vendor_item_pricing FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

DROP POLICY IF EXISTS vip_org_update ON public.vendor_item_pricing;
CREATE POLICY vip_org_update ON public.vendor_item_pricing FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

-- Invoice extractions
ALTER TABLE public.invoice_extractions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_extractions_org_read ON public.invoice_extractions;
CREATE POLICY invoice_extractions_org_read ON public.invoice_extractions FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

DROP POLICY IF EXISTS invoice_extractions_org_write ON public.invoice_extractions;
CREATE POLICY invoice_extractions_org_write ON public.invoice_extractions FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

DROP POLICY IF EXISTS invoice_extractions_org_update ON public.invoice_extractions;
CREATE POLICY invoice_extractions_org_update ON public.invoice_extractions FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

-- Invoice extraction lines
ALTER TABLE public.invoice_extraction_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS iel_org_read ON public.invoice_extraction_lines;
CREATE POLICY iel_org_read ON public.invoice_extraction_lines FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

DROP POLICY IF EXISTS iel_org_write ON public.invoice_extraction_lines;
CREATE POLICY iel_org_write ON public.invoice_extraction_lines FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

DROP POLICY IF EXISTS iel_org_update ON public.invoice_extraction_lines;
CREATE POLICY iel_org_update ON public.invoice_extraction_lines FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

-- Job item activity
ALTER TABLE public.job_item_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS jia_org_read ON public.job_item_activity;
CREATE POLICY jia_org_read ON public.job_item_activity FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

DROP POLICY IF EXISTS jia_org_write ON public.job_item_activity;
CREATE POLICY jia_org_write ON public.job_item_activity FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

DROP POLICY IF EXISTS jia_org_update ON public.job_item_activity;
CREATE POLICY jia_org_update ON public.job_item_activity FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

-- Item classification corrections
ALTER TABLE public.item_classification_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS icc_org_read ON public.item_classification_corrections;
CREATE POLICY icc_org_read ON public.item_classification_corrections FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

DROP POLICY IF EXISTS icc_org_write ON public.item_classification_corrections;
CREATE POLICY icc_org_write ON public.item_classification_corrections FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

-- Selection categories
ALTER TABLE public.selection_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS selection_categories_org_read ON public.selection_categories;
CREATE POLICY selection_categories_org_read ON public.selection_categories FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

DROP POLICY IF EXISTS selection_categories_org_write ON public.selection_categories;
CREATE POLICY selection_categories_org_write ON public.selection_categories FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

DROP POLICY IF EXISTS selection_categories_org_update ON public.selection_categories;
CREATE POLICY selection_categories_org_update ON public.selection_categories FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

-- Selections
ALTER TABLE public.selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS selections_org_read ON public.selections;
CREATE POLICY selections_org_read ON public.selections FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

DROP POLICY IF EXISTS selections_org_write ON public.selections;
CREATE POLICY selections_org_write ON public.selections FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

DROP POLICY IF EXISTS selections_org_update ON public.selections;
CREATE POLICY selections_org_update ON public.selections FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

-- ============================================================================
-- 15. COMMENTS (documentation, not behavior)
-- ============================================================================

COMMENT ON TABLE public.invoice_extractions IS
  'Two-stage capture staging: AI-extracted invoice header data that has not yet been committed to the cost intelligence spine. A human (or per-org auto-commit threshold) must verify lines before they enter vendor_item_pricing.';

COMMENT ON TABLE public.invoice_extraction_lines IS
  'Per-line AI extraction + proposed item classification. verification_status flows pending → verified|corrected|rejected|auto_committed. When verified or auto_committed, a row is written to vendor_item_pricing and the FK is set.';

COMMENT ON TABLE public.items IS
  'Universal "thing" taxonomy. AI-assigned item_type/category/subcategory independent of tenant cost codes. Aliases in item_aliases map vendor-specific phrasings back to canonical items.';

COMMENT ON TABLE public.vendor_item_pricing IS
  'THE spine. Every cost fact across invoices, POs, COs, proposals. source_type column means future sources are additive. ai_confidence + created_via + human_verified track provenance per row.';

COMMENT ON TABLE public.job_item_activity IS
  'Plan vs actual rollup per job × item. Updated automatically by vip_after_insert trigger when vendor_item_pricing rows land with job_id.';

COMMENT ON TABLE public.item_classification_corrections IS
  'Every human correction of an AI-proposed item classification. Used as vendor-scoped context in future extraction prompts.';

COMMIT;
