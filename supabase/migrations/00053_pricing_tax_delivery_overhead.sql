-- ===========================================================================
-- 00053_pricing_tax_delivery_overhead.sql
-- ===========================================================================
--
-- Cost Intelligence Wave 1B — tax + delivery/overhead tracking.
--
-- Problem that drove this migration:
--   Wave 1A stored invoice line totals as-is, which for most vendors meant
--   totals with sales tax baked in and delivery/freight captured as a
--   pseudo line item. Both corrupt cost comparisons across vendors and
--   across time (tax is jurisdictional; delivery is per-invoice noise).
--
-- Changes:
--   1. vendor_item_pricing gets tax_cents, overhead_allocated_cents,
--      landed_total_cents (trigger-maintained), plus tax_rate / is_taxable
--      metadata.
--   2. invoice_extractions gets invoice_subtotal_cents, invoice_tax_cents,
--      invoice_tax_rate, invoice_overhead JSONB, invoice_total_cents.
--   3. invoice_extraction_lines gets line_tax_cents, overhead_allocated_cents,
--      landed_total_cents (trigger-maintained), is_allocated_overhead +
--      overhead_type (for lines that were originally invoice-level charges).
--
-- Semantics:
--   total_cents          = pre-tax, pre-overhead line subtotal (qty * unit)
--   landed_total_cents   = all-in: total + tax + overhead_allocated
--
-- The two-column design lets cost intelligence queries default to pre-tax
-- (cleanest comparison) while invoice detail views show actual $ paid.
--
-- TARGET: DEV Supabase (egxkffodxcefwpqmwrur) ONLY.
-- DO NOT APPLY TO PROD (vnpqjderiuhsiiygfwfb).
-- ===========================================================================

BEGIN;

-- ============================================================================
-- 1. VENDOR ITEM PRICING — tax + overhead + landed
-- ============================================================================

ALTER TABLE public.vendor_item_pricing
  ADD COLUMN IF NOT EXISTS tax_cents BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.vendor_item_pricing
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(6, 4);

ALTER TABLE public.vendor_item_pricing
  ADD COLUMN IF NOT EXISTS is_taxable BOOLEAN;

ALTER TABLE public.vendor_item_pricing
  ADD COLUMN IF NOT EXISTS overhead_allocated_cents BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.vendor_item_pricing
  ADD COLUMN IF NOT EXISTS landed_total_cents BIGINT;

COMMENT ON COLUMN public.vendor_item_pricing.total_cents IS
  'Pre-tax, pre-overhead line subtotal (unit_price_cents * quantity). Default for cost intelligence queries across vendors and jobs.';

COMMENT ON COLUMN public.vendor_item_pricing.landed_total_cents IS
  'All-in money attributable to this line: total_cents + tax_cents + overhead_allocated_cents. Trigger-maintained. Shown on invoice detail views.';

COMMENT ON COLUMN public.vendor_item_pricing.overhead_allocated_cents IS
  'Proportional share of invoice-level delivery/freight/fuel/handling charges allocated to this line.';

-- ============================================================================
-- 2. INVOICE EXTRACTIONS — invoice-level tax + overhead
-- ============================================================================

ALTER TABLE public.invoice_extractions
  ADD COLUMN IF NOT EXISTS invoice_subtotal_cents BIGINT;

ALTER TABLE public.invoice_extractions
  ADD COLUMN IF NOT EXISTS invoice_tax_cents BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.invoice_extractions
  ADD COLUMN IF NOT EXISTS invoice_tax_rate NUMERIC(6, 4);

ALTER TABLE public.invoice_extractions
  ADD COLUMN IF NOT EXISTS invoice_overhead JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.invoice_extractions
  ADD COLUMN IF NOT EXISTS invoice_total_cents BIGINT;

COMMENT ON COLUMN public.invoice_extractions.invoice_overhead IS
  'Array of {type, amount_cents, description} for invoice-level charges (delivery, freight, fuel_surcharge, handling, restocking). Allocated proportionally to lines at extraction time.';

-- ============================================================================
-- 3. INVOICE EXTRACTION LINES — per-line tax + landed + overhead flags
-- ============================================================================

ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS line_tax_cents BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS line_is_taxable BOOLEAN;

ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS overhead_allocated_cents BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS landed_total_cents BIGINT;

ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS is_allocated_overhead BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS overhead_type TEXT;

ALTER TABLE public.invoice_extraction_lines
  DROP CONSTRAINT IF EXISTS iel_overhead_type_check;

ALTER TABLE public.invoice_extraction_lines
  ADD CONSTRAINT iel_overhead_type_check CHECK (
    overhead_type IS NULL OR overhead_type IN (
      'delivery', 'freight', 'shipping', 'fuel_surcharge',
      'handling', 'restocking', 'core_charge'
    )
  );

COMMENT ON COLUMN public.invoice_extraction_lines.is_allocated_overhead IS
  'TRUE when this line was originally extracted as a delivery/freight/fuel surcharge and its cents were redistributed proportionally to real line items. Do NOT commit to vendor_item_pricing.';

-- ============================================================================
-- 4. LANDED TOTAL TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION app_private.update_vip_landed_total_cents()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.landed_total_cents :=
    COALESCE(NEW.total_cents, 0) +
    COALESCE(NEW.tax_cents, 0) +
    COALESCE(NEW.overhead_allocated_cents, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vip_landed_total ON public.vendor_item_pricing;
CREATE TRIGGER trg_vip_landed_total
  BEFORE INSERT OR UPDATE OF total_cents, tax_cents, overhead_allocated_cents
  ON public.vendor_item_pricing
  FOR EACH ROW
  EXECUTE FUNCTION app_private.update_vip_landed_total_cents();

CREATE OR REPLACE FUNCTION app_private.update_iel_landed_total_cents()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.landed_total_cents :=
    COALESCE(NEW.raw_total_cents, 0) +
    COALESCE(NEW.line_tax_cents, 0) +
    COALESCE(NEW.overhead_allocated_cents, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_iel_landed_total ON public.invoice_extraction_lines;
CREATE TRIGGER trg_iel_landed_total
  BEFORE INSERT OR UPDATE OF raw_total_cents, line_tax_cents, overhead_allocated_cents
  ON public.invoice_extraction_lines
  FOR EACH ROW
  EXECUTE FUNCTION app_private.update_iel_landed_total_cents();

-- ============================================================================
-- 5. BACKFILL landed_total_cents for existing rows
-- ============================================================================

UPDATE public.vendor_item_pricing
  SET landed_total_cents = COALESCE(total_cents, 0)
  WHERE landed_total_cents IS NULL;

UPDATE public.invoice_extraction_lines
  SET landed_total_cents = COALESCE(raw_total_cents, 0)
  WHERE landed_total_cents IS NULL;

COMMIT;
