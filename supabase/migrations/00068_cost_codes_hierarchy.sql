-- ============================================================
-- 00068_cost_codes_hierarchy.sql — Phase 2.4 (Branch 2)
-- ============================================================
-- Adds hierarchy columns + validation trigger to public.cost_codes
-- and creates the public.cost_code_templates system-catalog table.
--
-- Amendment A (pre-flight 2026-04-22): the plan's raw `parent_id`
-- adjacency-list column is unsafe without cycle + depth enforcement
-- (Part 2 §1.3 caps hierarchy at 3 tiers). A BEFORE INSERT OR UPDATE
-- OF parent_id trigger walks the parent chain and RAISE EXCEPTIONs on
-- either a cycle or depth > 3. The function lives in app_private
-- (mirrors co_cache_trigger placement) and is granted EXECUTE to
-- authenticated explicitly (mirrors migration 00067's pattern to
-- avoid the GH #9 class of latent "permission denied for schema
-- app_private" bug).
--
-- Amendment B (pre-flight 2026-04-22): cost_code_templates adopts the
-- unit_conversion_templates (migration 00054) precedent under R.23.
-- 2 RLS policies — authenticated SELECT + platform_admin ALL — no
-- org_id, minimal audit columns (id, created_at, updated_at). This is
-- an ACCEPTED DIVERGENCE from CLAUDE.md's per-row audit rule because
-- cost_code_templates is a SYSTEM-level catalog, not a tenant-scoped
-- table. The is_system column is declarative metadata; RLS is the
-- authoritative writer gate.
--
-- Amendment C (pre-flight 2026-04-22): this migration creates
-- cost_code_templates but does NOT populate `codes` JSONB with real
-- data (all 4 seeded rows land with '{}'::jsonb), and does NOT modify
-- src/app/api/cost-codes/template/route.ts (which still reads Ross
-- Built's live cost_codes rows via TEMPLATE_ORG_ID =
-- '00000000-0000-0000-0000-000000000001'). The full cutover — populate
-- codes JSONB, rewrite the template route to read from
-- cost_code_templates, drop the TEMPLATE_ORG_ID carve-out in the
-- cost_codes RLS policy — is Phase 7.5's scope. GH #11 tracks the
-- deprecation.
--
-- Amendment D (pre-flight 2026-04-22): cost_codes.is_allowance (added
-- below) is the TEMPLATE-level flag — "does this cost code default to
-- being treated as an allowance?". The existing
-- budget_lines.is_allowance (migration 00014) is the INSTANCE-level
-- flag — "is this specific budget line tracked as an allowance?". The
-- budget_line value takes precedence at the job level; the cost_code
-- value is the default the budget-line picker pre-populates with.
-- Current live data: 0 budget_lines.is_allowance=true rows on dev.
-- GH #10 tracks the Branch 4 UI affordance work for the hierarchy.
--
-- Amendment E ships the paired 00068_cost_codes_hierarchy.down.sql.
--
-- Amendment F ships __tests__/cost-codes-hierarchy.test.ts with a
-- live-auth RLS probe on cost_code_templates (mirrors Phase 2.2
-- qa-branch2-phase2.2.md §6 DELETE-block verification) and a
-- has_function_privilege() probe on the new app_private function.

-- ------------------------------------------------------------
-- (a) New columns on public.cost_codes
-- ------------------------------------------------------------
ALTER TABLE public.cost_codes
  ADD COLUMN parent_id UUID REFERENCES public.cost_codes(id),
  ADD COLUMN is_allowance BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN default_allowance_amount BIGINT;

-- ------------------------------------------------------------
-- (b) Hierarchy validation function (Amendment A)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_private.validate_cost_code_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _depth int := 1;
  _cur uuid := NEW.parent_id;
BEGIN
  WHILE _cur IS NOT NULL LOOP
    IF _cur = NEW.id THEN
      RAISE EXCEPTION 'cost_codes hierarchy cycle: % -> ... -> %', NEW.id, _cur;
    END IF;
    _depth := _depth + 1;
    IF _depth > 3 THEN
      RAISE EXCEPTION 'cost_codes hierarchy exceeds 3 tiers (parent chain depth %)', _depth;
    END IF;
    SELECT parent_id INTO _cur FROM public.cost_codes WHERE id = _cur;
  END LOOP;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- (c) Grant EXECUTE to authenticated (GH #9 pattern from 00067)
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION app_private.validate_cost_code_hierarchy()
  TO authenticated;

-- ------------------------------------------------------------
-- (d) Trigger that fires the hierarchy validator
-- ------------------------------------------------------------
CREATE TRIGGER trg_cost_codes_hierarchy
BEFORE INSERT OR UPDATE OF parent_id ON public.cost_codes
FOR EACH ROW EXECUTE FUNCTION app_private.validate_cost_code_hierarchy();

-- ------------------------------------------------------------
-- (e) cost_code_templates system catalog (Amendment B)
-- ------------------------------------------------------------
CREATE TABLE public.cost_code_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  codes JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)
);

-- ------------------------------------------------------------
-- (f) updated_at trigger (matches project-wide pattern)
-- ------------------------------------------------------------
CREATE TRIGGER trg_cost_code_templates_updated_at
BEFORE UPDATE ON public.cost_code_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ------------------------------------------------------------
-- (g) RLS enabled (Amendment B)
-- ------------------------------------------------------------
ALTER TABLE public.cost_code_templates ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- (h) cct_read — unit_conversion_templates (00054) precedent.
-- Any authenticated user can read every template (system catalog).
-- ------------------------------------------------------------
CREATE POLICY cct_read ON public.cost_code_templates
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ------------------------------------------------------------
-- (i) cct_platform_admin_write — only platform admins mutate.
-- Non-platform-admin authenticated users get RLS rejection on
-- INSERT / UPDATE / DELETE.
-- ------------------------------------------------------------
CREATE POLICY cct_platform_admin_write ON public.cost_code_templates
  FOR ALL
  USING (app_private.is_platform_admin())
  WITH CHECK (app_private.is_platform_admin());

-- ------------------------------------------------------------
-- (j) Idempotent seed (Amendment C).
-- Real JSONB bodies for `codes` land in Phase 7.5 or a separate data
-- script. UNIQUE (name) makes ON CONFLICT (name) DO NOTHING safe
-- across re-applies (migration repos, fresh dev clones, etc.).
-- ------------------------------------------------------------
INSERT INTO public.cost_code_templates (name, description, is_system, codes) VALUES
  ('Custom Home Builder (Simplified)', 'A 25-code list for custom builders', TRUE, '{}'::jsonb),
  ('Remodeler (Simplified)',           'A 20-code list for renovation',     TRUE, '{}'::jsonb),
  ('CSI MasterFormat (Full)',          'All 50 divisions, ~200 codes',      TRUE, '{}'::jsonb),
  ('Empty — build your own',           'Start fresh',                       TRUE, '{}'::jsonb)
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE public.cost_code_templates IS
'System-level starter templates for new orgs. Adopted from unit_conversion_templates (00054) precedent under R.23. Real JSONB bodies for `codes` are populated in Phase 7.5; Phase 2.4 seeds the 4 template names with empty {} bodies as idempotent placeholders.';

COMMENT ON COLUMN public.cost_codes.is_allowance IS
'Template-level default for whether this cost code represents an allowance. Distinct from budget_lines.is_allowance (00014) which is the instance-level override; the budget_line value takes precedence at the job level. See GH #10.';

COMMENT ON FUNCTION app_private.validate_cost_code_hierarchy() IS
'Adjacency-list validator on public.cost_codes(parent_id). Raises on cycles (walking parent_id back to NEW.id) or on depth > 3 (Part 2 §1.3 cap). SECURITY DEFINER so the trigger runs as the function owner regardless of the triggering role, and explicitly granted EXECUTE to authenticated to avoid the GH #9 class of latent bug.';
