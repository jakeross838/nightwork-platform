-- ============================================================
-- 00070_approval_chains.sql — Phase 2.6 (Branch 2)
-- ============================================================
--
-- Adds public.approval_chains, a tenant-config table holding
-- per-org configurable approval chains across 6 workflow
-- dimensions (invoice_pm, invoice_qa, co, draw, po, proposal).
-- A seed trigger on public.organizations + a one-time backfill
-- guarantee every live org has a default chain per workflow_type
-- at rest.
--
-- Plan-doc lineage: amended spec committed at 317961d (pre-flight
-- amendments A–H), preserved through commit 73eaba8 (Markgraf-
-- scenario renumber that moved approval_chains from Phase 2.5 to
-- Phase 2.6 / migration 00070 so that draw_adjustments could land
-- as Phase 2.5 / 00069). Pre-flight findings at commit 303d5c9.
--
-- ------------------------------------------------------------
-- F-ii scope decision (pre-flight): approval_actions table NOT
-- created. Audit events already flow through status_history
-- JSONB on each workflow entity + public.activity_log
-- (polymorphic entity_type/entity_id, RLS-scoped). A third audit
-- surface adds footprint without answering a query not already
-- answerable from those two. Plan Part 2 §1.12 approval_actions
-- block edited to DEPRECATED note in the same commit.
-- ------------------------------------------------------------
--
-- B (R.23 divergence): RLS adopts the 00065 proposals 3-policy
-- pattern (org_read / org_insert / org_update; no DELETE policy
-- — soft-delete via deleted_at) with an INTENTIONAL write role-
-- set narrowing. proposals' write policies allow (owner, admin,
-- pm, accounting). approval_chains narrows that to (owner,
-- admin) only. Rationale: approval_chains is tenant config, not
-- workflow data — PMs and accounting users should not edit who
-- approves what. This is NOT a structural divergence (policy
-- count + DELETE posture match verbatim) — it is a predicate-
-- level narrowing within the same 3-policy shape. The read
-- policy remains tenant-wide (any active org member can see
-- their org's active approval routing) so workflow UIs can show
-- "this will route to X" hints without a privileged round-trip.
-- ------------------------------------------------------------
--
-- C (partial unique indexes): both partial unique indexes
-- include `AND deleted_at IS NULL` in their WHERE clauses so
-- soft-deleted rows don't block new defaults or re-use of the
-- (org_id, workflow_type, name) triple. The second partial
-- unique approval_chains_unique_name_per_workflow backs the
-- seed function's ON CONFLICT (org_id, workflow_type, name)
-- clause — required because ON CONFLICT needs a matching unique
-- constraint, and we want the predicate to be soft-delete-safe.
-- ------------------------------------------------------------
--
-- D (seed trigger): create_default_approval_chains() mirrors
-- create_default_workflow_settings() (migration 00032) verbatim
-- in shape — public schema, SECURITY DEFINER, pinned search_path,
-- ON CONFLICT DO NOTHING. Default stages are workflow-type-aware
-- via a small helper public.default_stages_for_workflow_type(text)
-- that both the trigger and the one-time backfill call, so the
-- CASE logic is the single source of truth (DRY). Ross-Built-
-- derived heuristics:
--   invoice_pm  → [{order:1, required_roles:['pm'],         all_required:false}]
--   invoice_qa  → [{order:1, required_roles:['accounting'], all_required:false}]
--   co/draw/po/
--   proposal    → [{order:1, required_roles:['owner','admin'], all_required:false}]
-- Tracked in GH #12 for onboarding-wizard override work in
-- Branch 6/7 (remodelers and other org types need UI affordance
-- to customize during onboarding).
-- ------------------------------------------------------------
--
-- F.2 GRANT-verification pattern (extended to public schema):
-- Explicit `GRANT EXECUTE ON FUNCTION ... TO authenticated` on
-- BOTH functions. Pattern introduced by migration 00067 which
-- closed the GH #9 class of latent authenticated-role permission
-- gaps (co_cache_trigger silently failing from UI paths because
-- authenticated lacked USAGE on app_private). Seed functions
-- live in `public` (precedent: create_default_workflow_settings)
-- not `app_private`, but the explicit GRANT keeps the defense-
-- in-depth posture consistent — a future `REVOKE EXECUTE` or a
-- function-definition churn that re-sets PUBLIC EXECUTE won't
-- silently break authenticated-role callers.
-- ------------------------------------------------------------
--
-- RUNTIME NOTE (discovered during Phase 2.6 Migration Dry-Run,
-- 2026-04-22): the ON CONFLICT (org_id, workflow_type, name)
-- clauses in both create_default_approval_chains() and the
-- one-time backfill MUST include `WHERE deleted_at IS NULL` to
-- match the PARTIAL unique index approval_chains_unique_name_
-- per_workflow. Without the predicate, PostgreSQL errors with
-- `42P10: there is no unique or exclusion constraint matching
-- the ON CONFLICT specification` because the index is partial
-- (Amendment C soft-delete narrowing). The amended plan spec
-- omitted the predicate and the dry-run surfaced it before
-- apply. Preserved here so future readers don't strip it.
-- ------------------------------------------------------------
--
-- R.16: Paired 00070_approval_chains.down.sql reverses in strict
-- reverse-dependency order.
-- ============================================================

-- ------------------------------------------------------------
-- (a) approval_chains — tenant config table (Amendment A).
-- Full audit-column set (id / created_at / updated_at /
-- created_by / deleted_at) per CLAUDE.md §Architecture Rules.
-- ------------------------------------------------------------
CREATE TABLE public.approval_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  workflow_type TEXT NOT NULL CHECK (
    workflow_type IN ('invoice_pm','invoice_qa','co','draw','po','proposal')
  ),
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  stages JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- (b) updated_at trigger — reuse project-wide
-- public.update_updated_at (defined in 00001_initial_schema.sql;
-- shared with jobs / invoices / purchase_orders / change_orders
-- / draws / draw_line_items / proposals / draw_adjustments).
-- ------------------------------------------------------------
CREATE TRIGGER trg_approval_chains_updated_at
  BEFORE UPDATE ON public.approval_chains
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ------------------------------------------------------------
-- (c) Partial unique indexes (Amendment C).
-- Both include `AND deleted_at IS NULL` so soft-deleted rows
-- don't occupy the slot.
--   1) At most one LIVE default chain per (org, workflow_type).
--      Soft-deleting a default frees the slot for a replacement.
--   2) Name uniqueness per (org, workflow_type) backs the seed's
--      ON CONFLICT (org_id, workflow_type, name) clause.
-- ------------------------------------------------------------
CREATE UNIQUE INDEX approval_chains_one_default_per_workflow
  ON public.approval_chains (org_id, workflow_type)
  WHERE is_default = true AND deleted_at IS NULL;

CREATE UNIQUE INDEX approval_chains_unique_name_per_workflow
  ON public.approval_chains (org_id, workflow_type, name)
  WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- (d) RLS — Amendment B. 00065 proposals 3-policy pattern with
-- the R.23 divergence on writes (owner/admin only).
-- No DELETE policy — RLS blocks hard DELETE; soft-delete via
-- deleted_at (cost_intelligence_spine / proposals precedent).
-- ------------------------------------------------------------
ALTER TABLE public.approval_chains ENABLE ROW LEVEL SECURITY;

-- Read: any active org member + platform-admin bypass. Tenant-
-- wide config visibility so workflow UIs can show approval-
-- routing hints without a privileged round-trip.
CREATE POLICY approval_chains_org_read
  ON public.approval_chains
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

-- Insert: owner/admin only. R.23 divergence from proposals' 4-
-- role write set — approval_chains is tenant config, not
-- workflow data. PMs should not edit who approves what.
CREATE POLICY approval_chains_org_insert
  ON public.approval_chains
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner','admin')
    )
  );

-- Update: owner/admin only. Same R.23 rationale as insert.
CREATE POLICY approval_chains_org_update
  ON public.approval_chains
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner','admin')
    )
  );

-- ------------------------------------------------------------
-- (e) Helper: workflow-type-aware default stages (Amendment D.2).
-- IMMUTABLE — pure input → output over the CHECK-enum values.
-- Called by both create_default_approval_chains() and the one-
-- time backfill so the CASE logic is a single source of truth.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.default_stages_for_workflow_type(_wt text)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN CASE _wt
    WHEN 'invoice_pm' THEN
      jsonb_build_array(jsonb_build_object(
        'order', 1,
        'required_roles', jsonb_build_array('pm'),
        'required_users', '[]'::jsonb,
        'all_required', false
      ))
    WHEN 'invoice_qa' THEN
      jsonb_build_array(jsonb_build_object(
        'order', 1,
        'required_roles', jsonb_build_array('accounting'),
        'required_users', '[]'::jsonb,
        'all_required', false
      ))
    ELSE
      jsonb_build_array(jsonb_build_object(
        'order', 1,
        'required_roles', jsonb_build_array('owner','admin'),
        'required_users', '[]'::jsonb,
        'all_required', false
      ))
  END;
END;
$$;

-- (f) Amendment F.2 — explicit GRANT EXECUTE to authenticated
-- keeps the defense-in-depth posture consistent with 00067.
GRANT EXECUTE ON FUNCTION public.default_stages_for_workflow_type(text)
  TO authenticated;

-- ------------------------------------------------------------
-- (g) Seed function — fires on new org INSERT. Amendment D.
-- Mirrors create_default_workflow_settings (00032) in shape:
-- public schema, SECURITY DEFINER, pinned search_path, ON
-- CONFLICT DO NOTHING (idempotent).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_default_approval_chains()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _wt text;
  _workflow_types text[] := ARRAY[
    'invoice_pm','invoice_qa','co','draw','po','proposal'
  ];
BEGIN
  FOREACH _wt IN ARRAY _workflow_types LOOP
    INSERT INTO public.approval_chains (
      org_id, workflow_type, name, is_default, stages
    ) VALUES (
      NEW.id,
      _wt,
      'Default ' || _wt || ' approval',
      true,
      public.default_stages_for_workflow_type(_wt)
    )
    ON CONFLICT (org_id, workflow_type, name) WHERE deleted_at IS NULL DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

-- (h) Amendment F.2 — same explicit GRANT on the seed function.
GRANT EXECUTE ON FUNCTION public.create_default_approval_chains()
  TO authenticated;

-- ------------------------------------------------------------
-- (i) Org-creation trigger. AFTER INSERT so NEW.id is stable.
-- ------------------------------------------------------------
CREATE TRIGGER trg_organizations_create_default_approval_chains
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_approval_chains();

-- ------------------------------------------------------------
-- (j) One-time backfill for live orgs (Amendment D + F).
-- 3 live orgs × 6 workflow_types = 18 default chains on dev.
-- Idempotent via the same ON CONFLICT predicate as the trigger.
-- Excludes soft-deleted orgs — don't seed dead tenants.
-- ------------------------------------------------------------
INSERT INTO public.approval_chains (
  org_id, workflow_type, name, is_default, stages
)
SELECT
  o.id,
  wt,
  'Default ' || wt || ' approval',
  true,
  public.default_stages_for_workflow_type(wt)
FROM public.organizations o
CROSS JOIN unnest(ARRAY['invoice_pm','invoice_qa','co','draw','po','proposal']) AS wt
WHERE o.deleted_at IS NULL
ON CONFLICT (org_id, workflow_type, name) WHERE deleted_at IS NULL DO NOTHING;

-- ------------------------------------------------------------
-- (k) COMMENTs — table + both functions
-- ------------------------------------------------------------
COMMENT ON TABLE public.approval_chains IS
'Per-org configurable approval chains for 6 workflow dimensions (invoice_pm, invoice_qa, co, draw, po, proposal). RLS adopts the 00065 proposals 3-policy pattern under R.23 with an intentional divergence — write role-set narrowed from proposals'' (owner, admin, pm, accounting) to (owner, admin) because approval_chains is tenant config, not workflow data. Read remains tenant-wide so workflow UIs can show approval-routing hints to any member. Default chains seeded on org creation via trg_organizations_create_default_approval_chains with workflow-type-aware defaults from public.default_stages_for_workflow_type(text). Ross-Built-derived defaults (PM approves invoices, accounting does QA, owner/admin for everything else) tracked in GH #12 for onboarding-wizard override work — remodelers and other org types need UI affordance to customize during onboarding. approval_actions table NOT created (F-ii scope decision) — audit flows through status_history JSONB + public.activity_log.';

COMMENT ON FUNCTION public.default_stages_for_workflow_type(text) IS
'Returns the seed-time default stages JSONB for a given approval_chains.workflow_type. Ross-Built-derived heuristics: invoice_pm → [pm]; invoice_qa → [accounting]; co/draw/po/proposal → [owner,admin]. Called by create_default_approval_chains() AND the one-time backfill; both share this single source of truth. IMMUTABLE — pure input → output over the CHECK-enum values. Amendment F.2 GRANT EXECUTE TO authenticated extends the 00067 defense-in-depth pattern to the public schema. See GH #12 for onboarding-wizard override work.';

COMMENT ON FUNCTION public.create_default_approval_chains() IS
'AFTER INSERT trigger on public.organizations that seeds 6 default approval_chains rows per new org (one per workflow_type). Mirrors create_default_workflow_settings (migration 00032) precedent — public schema, SECURITY DEFINER, pinned search_path = public, pg_temp, ON CONFLICT DO NOTHING (idempotent). Explicit GRANT EXECUTE TO authenticated per Amendment F.2 / migration 00067 pattern, defending against the GH #9 class of latent authenticated-role permission gaps.';
