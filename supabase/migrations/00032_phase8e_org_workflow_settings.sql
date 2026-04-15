-- 00032_phase8e_org_workflow_settings.sql
-- Phase 8e — Org-level workflow settings.
--
-- Each org gets exactly one row controlling how the invoice workflow behaves.
-- Settings that could reasonably differ between builders (batch approval,
-- quick approve thresholds, duplicate detection sensitivity, AI auto-routing,
-- draw & payment policy) live here with sensible defaults.
--
-- Contents:
--   1. org_workflow_settings table (1 row per org, UNIQUE on org_id).
--   2. RLS scoped to org_id.
--   3. Trigger to auto-insert defaults when a new org is created.
--   4. Backfill defaults for any existing org without a row.
--   5. Invoice duplicate detection columns.

-- ============================================================
-- 1. org_workflow_settings TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.org_workflow_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Invoice approvals
  batch_approval_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  quick_approve_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  quick_approve_min_confidence INTEGER NOT NULL DEFAULT 95
    CHECK (quick_approve_min_confidence BETWEEN 0 AND 100),
  require_invoice_date BOOLEAN NOT NULL DEFAULT TRUE,
  require_budget_allocation BOOLEAN NOT NULL DEFAULT FALSE,
  require_po_linkage BOOLEAN NOT NULL DEFAULT FALSE,
  over_budget_requires_note BOOLEAN NOT NULL DEFAULT TRUE,

  -- Duplicate detection
  duplicate_detection_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  duplicate_detection_sensitivity TEXT NOT NULL DEFAULT 'moderate'
    CHECK (duplicate_detection_sensitivity IN ('strict','moderate','loose')),

  -- AI routing
  auto_route_high_confidence BOOLEAN NOT NULL DEFAULT TRUE,
  auto_route_confidence_threshold INTEGER NOT NULL DEFAULT 85
    CHECK (auto_route_confidence_threshold BETWEEN 0 AND 100),

  -- Draw & payment
  require_lien_release_for_draw BOOLEAN NOT NULL DEFAULT TRUE,
  co_approval_required BOOLEAN NOT NULL DEFAULT TRUE,
  payment_auto_scheduling BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_workflow_settings_org_id
  ON public.org_workflow_settings (org_id);

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION public.touch_org_workflow_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_workflow_settings_updated_at
  ON public.org_workflow_settings;
CREATE TRIGGER trg_org_workflow_settings_updated_at
  BEFORE UPDATE ON public.org_workflow_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_org_workflow_settings_updated_at();

-- ============================================================
-- 2. RLS — org-scoped read/write
-- ============================================================
ALTER TABLE public.org_workflow_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org isolation" ON public.org_workflow_settings;
CREATE POLICY "org isolation" ON public.org_workflow_settings
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id())
  WITH CHECK (org_id = app_private.user_org_id());

DROP POLICY IF EXISTS "members read org_workflow_settings" ON public.org_workflow_settings;
CREATE POLICY "members read org_workflow_settings" ON public.org_workflow_settings
  FOR SELECT TO authenticated
  USING (org_id = app_private.user_org_id());

DROP POLICY IF EXISTS "owners admins write org_workflow_settings" ON public.org_workflow_settings;
CREATE POLICY "owners admins write org_workflow_settings" ON public.org_workflow_settings
  FOR ALL TO authenticated
  USING (
    org_id = app_private.user_org_id()
    AND app_private.user_role() IN ('admin','owner')
  )
  WITH CHECK (
    org_id = app_private.user_org_id()
    AND app_private.user_role() IN ('admin','owner')
  );

-- ============================================================
-- 3. Auto-insert defaults on organization insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_default_workflow_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.org_workflow_settings (org_id)
  VALUES (NEW.id)
  ON CONFLICT (org_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_organizations_create_workflow_settings
  ON public.organizations;
CREATE TRIGGER trg_organizations_create_workflow_settings
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.create_default_workflow_settings();

-- ============================================================
-- 4. Backfill existing orgs with a default row
-- ============================================================
INSERT INTO public.org_workflow_settings (org_id)
SELECT o.id
FROM public.organizations o
LEFT JOIN public.org_workflow_settings s ON s.org_id = o.id
WHERE s.id IS NULL;

-- ============================================================
-- 5. Duplicate detection columns on invoices
-- ============================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_potential_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS duplicate_of_id UUID REFERENCES public.invoices(id),
  ADD COLUMN IF NOT EXISTS duplicate_dismissed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duplicate_dismissed_by UUID;

CREATE INDEX IF NOT EXISTS idx_invoices_is_potential_duplicate
  ON public.invoices (is_potential_duplicate)
  WHERE deleted_at IS NULL AND is_potential_duplicate = TRUE;

CREATE INDEX IF NOT EXISTS idx_invoices_duplicate_of_id
  ON public.invoices (duplicate_of_id)
  WHERE duplicate_of_id IS NOT NULL;
