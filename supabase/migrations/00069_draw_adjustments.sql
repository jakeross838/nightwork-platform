-- ============================================================
-- 00069_draw_adjustments.sql — Phase 2.5 (Branch 2)
-- ============================================================
--
-- Adds two new public-schema tables for tracking draw-level
-- adjustments that don't fit the AIA G702/G703 line-item model:
--   public.draw_adjustments        — first-class adjustments
--                                    (corrections, credits,
--                                    withholds, customer direct
--                                    pays, conditional holds)
--   public.draw_adjustment_line_items — N:N join for rare
--                                       multi-line allocations
--
-- Scope pivot (2026-04-22): Phase 2.5 was reassigned from
-- approval_chains to draw_adjustments after the 2026-04-14
-- Markgraf substantial-completion email surfaced 9+ distinct
-- adjustment events on one draw with no clean entity to track.
-- Approval chains work moved to Phase 2.6 / migration 00070.
-- Every subsequent Branch 2 phase shifted +1. See the Phase 2.5
-- pre-flight (qa-reports/preflight-branch2-phase2.5.md, commit
-- 053f647) and the amended plan spec (commit 73eaba8).
--
-- ------------------------------------------------------------
-- C.1 RLS posture (R.23 with surgical narrowing):
-- draw_adjustments adopts the proposals/00065 3-policy structure
-- (org_read / org_insert / org_update; no DELETE policy —
-- soft-delete via deleted_at) with a SURGICAL predicate-level
-- narrowing on the READ policy: PMs only see adjustments on
-- draws for jobs they are assigned to (pm_id = auth.uid()).
-- This preserves information parity with the existing draws /
-- draw_line_items "pm read on own jobs" visibility rule. Without
-- this narrowing, PMs excluded from a job could SELECT
-- adjustments on that job's draws — an information leak
-- relative to the draws table itself. This is NOT a structural
-- divergence from the 00065 proposals precedent (policy count +
-- DELETE posture match verbatim) — it is a predicate-level
-- narrowing within the same shape.
--
-- Join-table read policy narrows via a longer chain:
--   adjustment_id → draw_adjustments → draws → jobs → pm_id.
--
-- Write role set: (owner, admin, pm, accounting). PMs propose
-- adjustments they catch in the field or during wizard builds;
-- accounting reviews and approves. Mirrors the existing draws
-- write-policy role set.
--
-- RUNTIME NOTE (discovered during Phase 2.5 execution
-- live-auth RLS probes, 2026-04-22): PostgreSQL's FK integrity
-- check respects RLS on the referenced draws table. Because
-- draws' 'pm read draws on own jobs' policy narrows PM
-- visibility by pm_id, the FK check on draw_adjustments.draw_id
-- fails during INSERT when a PM references a draw they cannot
-- see. This is stricter than the write policy itself declares —
-- emergent defense-in-depth from combining existing draws RLS
-- with the new FK. Real behavior: PMs can only INSERT
-- adjustments against draws on their own jobs. Branch 3/4
-- writers should route cross-job adjustment observations
-- through accounting/admin. See qa-reports/qa-branch2-phase2.5.md
-- §5 for the live-auth probe results that surfaced this.
-- ------------------------------------------------------------
--
-- C.2 Draw soft-delete invariant (application-layer):
-- When draws.deleted_at is set via application code, all
-- associated draw_adjustments rows MUST also be soft-deleted in
-- the same transaction. Enforced by the draws-soft-delete RPC
-- (Branch 3 writer responsibility). NOT enforced at the DB layer
-- because FK cascades don't trigger on UPDATE — only DELETE —
-- and the plan mandates soft-delete via deleted_at timestamp,
-- never hard DELETE. The draws_delete_strict RLS policy blocks
-- hard DELETE from any non-service-role caller anyway.
-- ------------------------------------------------------------
--
-- D2 G702/G703 rendering rule:
-- draw_adjustments render in a dedicated "Adjustments & Credits"
-- section on the draw doc. They do NOT silently modify
-- draw_line_items.this_period. Final current-payment-due math =
-- line-item total MINUS adjustments section. This preserves AIA
-- G702/G703 auditability — every line item remains traceable to
-- its invoice/PO/CO lineage, and every adjustment is visible as
-- a separately-justified item with a reason.
-- ------------------------------------------------------------
--
-- C.3 amount_cents: NOT NULL. Placeholder-only rows (e.g.,
-- "Line 19101 clarification" or "trapezoidal shade discussion"
-- from the Markgraf email thread) use amount_cents = 0 with
-- reason documenting the TBD status.
--
-- C.4 adjustment_type: flat 7-value enum. Credit subtypes
-- (goodwill / defect / error) are first-class enum values, not
-- a separate credit_subtype column. "All credits" query pattern:
-- WHERE adjustment_type LIKE 'credit_%'.
--
-- C.5 draw_adjustment_line_items join table ships even though
-- the Markgraf scenario has 0 N:N cases — the shape must be
-- available when Branch 3/4 dogfood surfaces the first case.
-- ------------------------------------------------------------
--
-- Name-collision note: the adjustment_type value 'conditional'
-- refers to an adjustment where the owner refuses payment
-- pending a specific condition (e.g., Real Woods door without
-- approved shop drawing). This is SEMANTICALLY DISTINCT from
-- lien_releases.release_type values 'conditional_progress' and
-- 'conditional_final', which describe lien-waiver document
-- types. Different tables, different CHECK enums — no DB-level
-- collision. UI layer should use table-scoped label helpers.
--
-- Name-collision note 2: affected_pcco_number is a bridge TEXT
-- column — NOT an FK to change_orders. Internal Buildertrend
-- CO numbers (Jeff's accounting routing) and external AIA PCCO
-- numbers (architect/owner-facing) are unreconciled numbering
-- systems. The Markgraf email surfaced a $95 double-charge
-- dispute stemming from this gap (DB Welding invoice
-- #0064.ADD.26 cited "CO51" internal while the AIA PCCO log
-- showed PCCO-88 for the same work). Reconciliation scope is
-- tracked in GH #13; backfill to proper FK lands when Branch 3
-- resolves.
-- ============================================================

-- ------------------------------------------------------------
-- (a) draw_adjustments — draw-level adjustments, one per event.
-- 1:1 FK to draw_line_items for the common case; nullable for
-- contract-sum-level or PCCO-scoped events.
-- ------------------------------------------------------------
CREATE TABLE public.draw_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  org_id UUID NOT NULL REFERENCES public.organizations(id),
  draw_id UUID NOT NULL REFERENCES public.draws(id),
  -- NO ACTION on draw_id matches all 5 existing FKs pointing to
  -- draws. Hard DELETE on draws is RLS-blocked via
  -- draws_delete_strict. Soft-delete cascade to adjustments is
  -- the C.2 application-layer invariant (draws-soft-delete RPC,
  -- Branch 3).
  draw_line_item_id UUID REFERENCES public.draw_line_items(id),

  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN (
    'correction',
    'credit_goodwill',
    'credit_defect',
    'credit_error',
    'withhold',
    'customer_direct_pay',
    'conditional'
  )),

  adjustment_status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (adjustment_status IN (
      'proposed',
      'approved',
      'applied_to_draw',
      'resolved',
      'voided'
    )),

  -- Signed. Negative = reduces amount owed by owner (credit,
  -- withhold, customer_direct_pay). Positive = increases (upward
  -- correction, contract-sum restoration). 0 allowed for
  -- placeholder-only rows (C.3) with reason documenting the TBD
  -- status.
  amount_cents BIGINT NOT NULL,

  -- Stored at approval time by a human categorizer (D3).
  -- Positive = GP hit on Ross Built (defect, goodwill). Negative
  -- = GP boost (rare: caught billing error that would have been
  -- RB's loss). NULL until categorized. Not derivable — defect-
  -- vs-goodwill is judgment, not computation.
  gp_impact_cents BIGINT,

  reason TEXT NOT NULL,

  -- Soft references — each captures a dimension the email thread
  -- actually discusses. All nullable.
  affected_vendor_id UUID REFERENCES public.vendors(id),
  affected_invoice_id UUID REFERENCES public.invoices(id),
  affected_pcco_number TEXT,  -- bridge column, see GH #13

  -- Phase 2.2 precedent: bare UUID until document_extractions
  -- table lands in Branch 3 Phase 3.1. FK wire-up deferred.
  source_document_id UUID,

  -- Audit trail
  status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- (b) draw_adjustment_line_items — join table for rare N:N (C.5)
-- ------------------------------------------------------------
CREATE TABLE public.draw_adjustment_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  adjustment_id UUID NOT NULL REFERENCES public.draw_adjustments(id)
    ON DELETE CASCADE,
  draw_line_item_id UUID NOT NULL REFERENCES public.draw_line_items(id),
  allocation_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- (c) updated_at triggers — reuse project-wide public.update_updated_at
-- ------------------------------------------------------------
CREATE TRIGGER trg_draw_adjustments_updated_at
BEFORE UPDATE ON public.draw_adjustments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_draw_adjustment_line_items_updated_at
BEFORE UPDATE ON public.draw_adjustment_line_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ------------------------------------------------------------
-- (d) Indexes — all partial with deleted_at IS NULL (matches
-- Phase 2.4 Amendment C and the 35+ existing partial-index
-- precedents across the schema).
-- ------------------------------------------------------------
CREATE INDEX idx_draw_adjustments_draw
  ON public.draw_adjustments (org_id, draw_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_draw_adjustments_status
  ON public.draw_adjustments (org_id, adjustment_status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_draw_adjustments_line_item
  ON public.draw_adjustments (draw_line_item_id)
  WHERE draw_line_item_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_draw_adjustments_vendor
  ON public.draw_adjustments (affected_vendor_id)
  WHERE affected_vendor_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_draw_adjustments_invoice
  ON public.draw_adjustments (affected_invoice_id)
  WHERE affected_invoice_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_dali_adjustment
  ON public.draw_adjustment_line_items (adjustment_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_dali_draw_line_item
  ON public.draw_adjustment_line_items (draw_line_item_id)
  WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- (e) RLS — C.1 decision: proposals/00065 3-policy structure
-- with surgical PM-on-own-jobs narrowing on the read policy.
-- No DELETE policy — RLS blocks hard DELETE; soft-delete via
-- deleted_at (cost_intelligence_spine / proposals precedent).
-- ------------------------------------------------------------
ALTER TABLE public.draw_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY draw_adjustments_org_read
  ON public.draw_adjustments
  FOR SELECT
  USING (
    (
      org_id IN (
        SELECT org_id FROM public.org_members
        WHERE user_id = auth.uid() AND is_active = true
      )
      AND (
        app_private.user_role() IN ('owner','admin','accounting')
        OR (
          app_private.user_role() = 'pm'
          AND EXISTS (
            SELECT 1
            FROM public.draws d
            JOIN public.jobs j ON j.id = d.job_id
            WHERE d.id = draw_adjustments.draw_id
              AND j.pm_id = auth.uid()
          )
        )
      )
    )
    OR app_private.is_platform_admin()
  );

CREATE POLICY draw_adjustments_org_insert
  ON public.draw_adjustments
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner','admin','pm','accounting')
    )
  );

CREATE POLICY draw_adjustments_org_update
  ON public.draw_adjustments
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner','admin','pm','accounting')
    )
  );

-- ------------------------------------------------------------
-- (f) Join-table RLS — mirrors parent-table structure; read
-- policy narrows via adjustment_id → draw_adjustments → draws
-- → jobs chain.
-- ------------------------------------------------------------
ALTER TABLE public.draw_adjustment_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY draw_adjustment_line_items_org_read
  ON public.draw_adjustment_line_items
  FOR SELECT
  USING (
    (
      org_id IN (
        SELECT org_id FROM public.org_members
        WHERE user_id = auth.uid() AND is_active = true
      )
      AND (
        app_private.user_role() IN ('owner','admin','accounting')
        OR (
          app_private.user_role() = 'pm'
          AND EXISTS (
            SELECT 1
            FROM public.draw_adjustments da
            JOIN public.draws d ON d.id = da.draw_id
            JOIN public.jobs j   ON j.id = d.job_id
            WHERE da.id = draw_adjustment_line_items.adjustment_id
              AND j.pm_id = auth.uid()
          )
        )
      )
    )
    OR app_private.is_platform_admin()
  );

CREATE POLICY draw_adjustment_line_items_org_insert
  ON public.draw_adjustment_line_items
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner','admin','pm','accounting')
    )
  );

CREATE POLICY draw_adjustment_line_items_org_update
  ON public.draw_adjustment_line_items
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner','admin','pm','accounting')
    )
  );

-- ------------------------------------------------------------
-- (g) COMMENTs — table + key columns
-- ------------------------------------------------------------
COMMENT ON TABLE public.draw_adjustments IS
'Draw-level adjustments: corrections, credits (goodwill/defect/error), withholds, customer direct-pays, conditional holds. Renders in a dedicated "Adjustments & Credits" section on the draw doc (D2) — NOT silently applied to draw_line_items.this_period (preserves AIA G702/G703 auditability). RLS adopts proposals/00065 3-policy pattern (R.23) with a surgical PM-on-own-jobs narrowing on the read policy to preserve information parity with the draws table. Draw soft-delete invariant (C.2): when draws.deleted_at is set via application code, all associated draw_adjustments rows MUST also be soft-deleted in the same transaction — enforced by the draws-soft-delete RPC (Branch 3 writer), NOT at the DB layer. Scope pivot from approval_chains at kickoff (2026-04-22; see qa-reports/preflight-branch2-phase2.5.md, commit 053f647). Runtime note (2026-04-22): PostgreSQL''s FK integrity check respects RLS on the referenced draws table. Because draws'' pm-on-own-jobs read policy narrows PM visibility, the FK check on draw_adjustments.draw_id fails during INSERT when a PM references a draw they cannot see — emergent defense-in-depth stricter than the write policy itself declares. Real behavior: PMs can only INSERT adjustments against draws on their own jobs. Branch 3/4 writers should route cross-job adjustment observations through accounting/admin. See qa-reports/qa-branch2-phase2.5.md §5 for the live-auth probe results that surfaced this; GH #14 tracks the Branch 3/4 UX implications.';

COMMENT ON COLUMN public.draw_adjustments.adjustment_type IS
'Flat 7-value enum (C.4 decision): correction, credit_goodwill, credit_defect, credit_error, withhold, customer_direct_pay, conditional. Credit subtypes are first-class enum values, not a separate column. "All credits" query pattern: WHERE adjustment_type LIKE ''credit_%''. Name-collision note: ''conditional'' refers to an adjustment where the owner refuses payment pending a specific condition — SEMANTICALLY DISTINCT from lien_releases.release_type values ''conditional_progress''/''conditional_final'' which are lien-waiver document types. Different tables, different CHECK enums, no DB-level collision — UI layer should use table-scoped label helpers.';

COMMENT ON COLUMN public.draw_adjustments.adjustment_status IS
'Workflow state: proposed → approved → applied_to_draw → resolved (terminal); proposed → voided or approved → voided (terminal). No re-entry from terminal states (matches proposals/draws lifecycle patterns). Application-layer concern: DB enforces CHECK enum values only; transition validity is checked in Branch 3 writer code.';

COMMENT ON COLUMN public.draw_adjustments.amount_cents IS
'Signed cents. Negative = reduces amount owed by owner (credit, withhold, customer_direct_pay). Positive = increases (upward correction, contract-sum restoration). 0 allowed for placeholder-only rows (C.3) — e.g., Markgraf email Line 19101 clarification or trapezoidal-shade discussion — with reason documenting the TBD status.';

COMMENT ON COLUMN public.draw_adjustments.gp_impact_cents IS
'Stored at approval time by a human categorizer (D3 design decision). Positive = GP hit on Ross Built (defect, goodwill); negative = GP boost (rare: caught billing error that would have been RB''s loss). NULL until categorized. NOT derivable from other fields — defect-vs-goodwill is judgment, not computation.';

COMMENT ON COLUMN public.draw_adjustments.affected_pcco_number IS
'Bridge column for PCCO references (e.g., "PCCO-86", "PCCO-87"). TEXT not FK because internal Buildertrend CO numbers and external AIA PCCO numbers are unreconciled numbering systems. Markgraf 2026-04-14 email surfaced a $95 double-charge dispute: DB Welding invoice #0064.ADD.26 cited CO51 internal but the AIA PCCO log showed PCCO-88 for the same work. Reconciliation scope tracked in GH #13; backfill to proper FK when Branch 3 resolves.';

COMMENT ON COLUMN public.draw_adjustments.source_document_id IS
'Bare UUID pending document_extractions table creation. FK wire-up deferred to Branch 3 Phase 3.1 rename (invoice_extractions → document_extractions). Phase 2.2 precedent: proposals.source_document_id uses the same bare-UUID pattern for the same reason.';
