-- Migration 00083 — org_cost_codes (per-org cost code map, mapped to canonical)
-- Phase 3.3 (Cost Intelligence Foundation) per amendment-1 + addendum-A.
--
-- This is the per-org "Layer 2" of the 3-layer cost code architecture:
--   Layer 1 = canonical_cost_codes (global reference, NAHB seed in 00082)
--   Layer 2 = org_cost_codes (this table — each org's working codes)
--   Layer 3 = display in org's native codes (UI concern, not schema)
--
-- This is a NEW namespace alongside the existing Phase-1 cost_codes
-- table. Both coexist; eventual migration of cost_codes → org_cost_codes
-- is a future phase. Per addendum-A, we use canonical_code_id (UUID FK
-- to canonical_cost_codes.id) rather than the original spec's
-- csi_canonical_code text reference.
--
-- RLS: 3-policy pattern (SELECT / INSERT / UPDATE — no explicit DELETE,
-- relying on RLS-blocks-by-default). Mirrors cost_intelligence_spine
-- 00052 precedent per R.23. Soft-delete via is_active=false UPDATE.

CREATE TABLE IF NOT EXISTS public.org_cost_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_code TEXT,
  canonical_code_id UUID REFERENCES public.canonical_cost_codes(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (org_id, code)
);

CREATE INDEX IF NOT EXISTS org_cost_codes_org_idx ON public.org_cost_codes (org_id);
CREATE INDEX IF NOT EXISTS org_cost_codes_canonical_idx
  ON public.org_cost_codes (canonical_code_id);
CREATE INDEX IF NOT EXISTS org_cost_codes_org_parent_idx
  ON public.org_cost_codes (org_id, parent_code);

-- Auto-bump updated_at on every UPDATE so optimistic locking works
-- (mirrors moddatetime trigger pattern used elsewhere).
CREATE OR REPLACE FUNCTION public.org_cost_codes_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS org_cost_codes_updated_at_trigger ON public.org_cost_codes;
CREATE TRIGGER org_cost_codes_updated_at_trigger
  BEFORE UPDATE ON public.org_cost_codes
  FOR EACH ROW EXECUTE FUNCTION public.org_cost_codes_set_updated_at();

ALTER TABLE public.org_cost_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_cost_codes FORCE ROW LEVEL SECURITY;

-- 3-policy pattern (no explicit DELETE) per cost_intelligence_spine 00052
-- precedent. Soft-delete via is_active=false UPDATE goes through the UPDATE
-- policy.

DROP POLICY IF EXISTS org_cost_codes_org_read ON public.org_cost_codes;
CREATE POLICY org_cost_codes_org_read ON public.org_cost_codes FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

DROP POLICY IF EXISTS org_cost_codes_org_write ON public.org_cost_codes;
CREATE POLICY org_cost_codes_org_write ON public.org_cost_codes FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS org_cost_codes_org_update ON public.org_cost_codes;
CREATE POLICY org_cost_codes_org_update ON public.org_cost_codes FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin')
    )
  );

COMMENT ON TABLE public.org_cost_codes IS
  'Per-org cost code map. Each row optionally maps to a canonical_cost_codes row via canonical_code_id, enabling cross-org pricing intelligence within an org. Soft-delete via is_active=false. Coexists with the legacy cost_codes table (Phase 1) until a future migration consolidates them.';
