-- Phase 2.2 — Proposals tables (first-class entity)
--
-- Plan reference: docs/nightwork-rebuild-plan.md §"Phase 2.2 — Proposals
-- tables (new first-class)". Plan amendments landed in commit 4fd3e7d
-- (adds proposals.updated_at with trigger, full audit-column set on
-- proposal_line_items, 8-index performance set).
--
-- Conventions applied:
--   G.9 public. schema qualification on every DDL statement — protects
--       against search_path mutations.
--   R.7 status_history appends are the responsibility of Branch 3 write
--       routes. This migration creates the column with a JSONB default;
--       application code owns the append contract (same pattern as
--       invoices, change_orders, etc.).
--   R.16 migration file is source of truth. Rollback lives in
--       00065_proposals.down.sql (paired).
--
-- RLS posture matches the canonical recent pattern from
-- 00052_cost_intelligence_spine.sql (items / item_aliases /
-- vendor_item_pricing): 3 policies per table — read = any org member
-- + platform admin bypass; insert / update = org members with write-
-- capable role. No DELETE policy. RLS blocks hard DELETE by default;
-- deletion is soft-delete via deleted_at per codebase convention.
-- This matches R.6 (block destructive actions) and preserves R.7
-- (status_history) — a hard DELETE would erase the audit trail.

-- ────────────────────────────────────────────────────────────────────
-- proposals
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  job_id UUID NOT NULL REFERENCES public.jobs(id),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  proposal_number TEXT NOT NULL,
  title TEXT NOT NULL,
  received_date DATE,
  valid_through DATE,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN (
      'received',
      'under_review',
      'accepted',
      'rejected',
      'superseded',
      'converted_to_po',
      'converted_to_co'
    )),
  amount BIGINT,
  scope_summary TEXT,
  inclusions TEXT,
  exclusions TEXT,
  terms TEXT,
  plan_version_referenced TEXT,
  converted_po_id UUID REFERENCES public.purchase_orders(id),
  converted_co_id UUID REFERENCES public.change_orders(id),
  superseded_by_proposal_id UUID REFERENCES public.proposals(id),
  -- FK deferred: document_extractions table not yet built (see plan §0.6 R.9)
  source_document_id UUID,
  notes TEXT,
  status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,
  UNIQUE (job_id, proposal_number)
);

-- ────────────────────────────────────────────────────────────────────
-- proposal_line_items
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE public.proposal_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES public.cost_codes(id),
  description TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  unit_price BIGINT,
  amount BIGINT NOT NULL,
  scope_detail TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

-- ────────────────────────────────────────────────────────────────────
-- updated_at triggers (reuse project-wide public.update_updated_at)
-- Function defined in 00001_initial_schema.sql; used by jobs / invoices
-- / purchase_orders / change_orders / draws / draw_line_items etc.
-- ────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_proposal_line_items_updated_at
  BEFORE UPDATE ON public.proposal_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ────────────────────────────────────────────────────────────────────
-- Indexes — 6 on proposals (3 partial), 2 on proposal_line_items.
-- UNIQUE (job_id, proposal_number) auto-creates its backing index; no
-- separate index needed.
-- ────────────────────────────────────────────────────────────────────

CREATE INDEX idx_proposals_org_status
  ON public.proposals (org_id, status);

CREATE INDEX idx_proposals_org_job
  ON public.proposals (org_id, job_id);

CREATE INDEX idx_proposals_org_vendor
  ON public.proposals (org_id, vendor_id);

CREATE INDEX idx_proposals_superseded_by
  ON public.proposals (superseded_by_proposal_id)
  WHERE superseded_by_proposal_id IS NOT NULL;

CREATE INDEX idx_proposals_converted_po
  ON public.proposals (converted_po_id)
  WHERE converted_po_id IS NOT NULL;

CREATE INDEX idx_proposals_converted_co
  ON public.proposals (converted_co_id)
  WHERE converted_co_id IS NOT NULL;

CREATE INDEX idx_proposal_line_items_proposal
  ON public.proposal_line_items (proposal_id);

CREATE INDEX idx_proposal_line_items_cost_code
  ON public.proposal_line_items (cost_code_id);

-- ────────────────────────────────────────────────────────────────────
-- RLS — enable + 3 policies per table (SELECT / INSERT / UPDATE).
-- Pattern follows 00052_cost_intelligence_spine.sql verbatim (items,
-- item_aliases, vendor_item_pricing). No DELETE policy — RLS blocks
-- hard DELETE by default. Deletion is soft-delete via deleted_at per
-- codebase convention; a hard DELETE would defeat R.7 (status_history)
-- and R.6 (destructive action guards).
-- ────────────────────────────────────────────────────────────────────

-- proposals RLS block
-- No DELETE policy — RLS blocks hard DELETE by default. Deletion is
-- soft-delete via deleted_at per codebase convention
-- (cost_intelligence_spine precedent).
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY proposals_org_read
  ON public.proposals
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

CREATE POLICY proposals_org_insert
  ON public.proposals
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

CREATE POLICY proposals_org_update
  ON public.proposals
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

-- proposal_line_items RLS block
-- No DELETE policy — RLS blocks hard DELETE by default. Deletion is
-- soft-delete via deleted_at per codebase convention
-- (cost_intelligence_spine precedent). Parent proposal DELETE (also
-- RLS-blocked) would have CASCADE-deleted line items via the FK; since
-- hard DELETE of a proposal is not permitted, neither is CASCADE-driven
-- line-item deletion. Line items soft-delete independently via their
-- own deleted_at.
ALTER TABLE public.proposal_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY proposal_line_items_org_read
  ON public.proposal_line_items
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

CREATE POLICY proposal_line_items_org_insert
  ON public.proposal_line_items
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );

CREATE POLICY proposal_line_items_org_update
  ON public.proposal_line_items
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner', 'admin', 'pm', 'accounting')
    )
  );
