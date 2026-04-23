-- ============================================================
-- Phase 2.8 — Pricing history table (migration 00073).
--
-- Trigger-populated, append-only audit spine. Captures pricing
-- observations across 4 source-entity writes: invoice line items
-- (on invoices.status=qa_approved), proposal line items (on
-- proposals.status=accepted), PO line items (on
-- purchase_orders.status=issued), CO lines (on
-- change_orders.status=approved). Backs future fuzzy-match /
-- "similar recent pricing" Branch 3/4 UIs (GH #16 signal-quality
-- validation gate).
--
-- Amendments A-N + O landed at plan-amendment commit 643b669.
-- Pre-flight findings at qa-reports/preflight-branch2-phase2.8.md
-- (commit 7bc4db0).
--
-- R.23 DIVERGENCE (Amendment B): adopts a 1-policy RLS shape
-- (single SELECT; no INSERT/UPDATE/DELETE policies) because
-- pricing_history is a trigger-populated audit spine — neither
-- workflow data (proposals/00065, draw_adjustments/00069,
-- job_milestones/00071+00072) nor tenant config
-- (approval_chains/00070). Closest prior precedent:
-- activity_log. First Branch 2 phase outside the 3-policy
-- family. Trigger functions are SECURITY DEFINER (Amendment J)
-- so they bypass the RLS write-absence on INSERT. Service-role
-- platform-admin SQL is the correction path.
--
-- IMMUTABILITY CONTRACT (Amendment C): no deleted_at column; no
-- UPDATE policy. Once a row lands, it is permanent historical
-- record. Semantic rationale: a vendor did quote $X on that
-- date, regardless of whether the source entity (invoice/PO/
-- proposal/CO) was later voided. Pricing intel should reflect
-- reality, not entity lifecycle.
--
-- CORRECTION PROCEDURE (Amendment C, §N):
--   To invalidate a historical pricing_history row for fraud or
--   data-entry error, use service-role SQL via platform admin:
--     DELETE FROM public.pricing_history WHERE id = '...';
--   This is the only correction path. Do not add UPDATE or
--   soft-delete policies — the append-only semantic is load-
--   bearing for pricing-intelligence signal integrity.
--
-- SPEC CORRECTION (Amendment H): the original plan spec
-- referenced a `purchase_order_line_items` trigger target. That
-- table does not exist. Actual canonical name is
-- public.po_line_items (5 prior migrations + 5 src/ consumers
-- confirm). Trigger target corrected here.
--
-- PO PARENT-ENTITY RESOLUTION (Amendment I): po_line_items is
-- sparser than invoice_line_items (no quantity/unit/unit_price/
-- vendor_id/date). The PO trigger function resolves vendor_id
-- via po_line_items.po_id → purchase_orders.vendor_id, and date
-- via purchase_orders.issued_date (pre-flight probe confirmed
-- this is the PO-date column — no po_date) with fallback to
-- purchase_orders.created_at::date. quantity / unit / unit_price
-- insert as NULL. po_line_items.cost_code is TEXT (5-digit code)
-- resolved to cost_codes.id via (code, org_id) lookup.
--
-- GRANT PATTERN (Amendment J / F.2): all 4 trigger functions
-- are SECURITY DEFINER with pinned search_path = public, pg_temp,
-- and each has an explicit GRANT EXECUTE TO authenticated.
-- Defends the GH #9 class of latent authenticated-role permission
-- gaps. Pattern lineage: 00032 → 00067 → 00070.
--
-- BACKFILL (Amendment M): one-time INSERT...SELECT at apply time
-- for invoice_line_items where parent invoices.status =
-- 'qa_approved' AND deleted_at IS NULL. Dev tenant pre-apply
-- probe: 113 total invoice_line_items, 112 qualify. GH #16 gates
-- Branch 3/4 user-facing matching UI on signal-quality
-- validation of the backfill output.
--
-- ────────────────────────────────────────────────────────────
-- RUNTIME NOTE — plan-spec column-shape defects surfaced during
-- Schema Validator pre-probes (not caught by pre-flight §1.3):
--
--   Defect #1: invoice_line_items column names. Plan-doc spec
--   uses NEW.quantity / NEW.unit_price / NEW.amount; actual
--   columns are qty / rate / amount_cents. Migration uses
--   actual names.
--
--   Defect #2: invoice_line_items.rate semantic. Probe-sampled
--   10/10 rows: rate * qty * 100 = amount_cents → rate is
--   stored in DOLLARS (numeric), not cents. pricing_history
--   .unit_price is BIGINT cents per R.8. Invoice trigger +
--   backfill convert via ROUND(NEW.rate * 100)::BIGINT when
--   rate IS NOT NULL.
--
--   Defect #3: change_orders has NO vendor_id column. Plan-doc
--   spec's CO trigger SELECTs _co.vendor_id which would fail.
--   CO trigger omits the SELECT column and inserts NULL for
--   pricing_history.vendor_id.
--
--   Defect #4: change_order_lines shape. Plan-doc spec uses
--   NEW.change_order_id / NEW.quantity / NEW.unit / NEW
--   .unit_price / NEW.cost_code_id; actual columns: co_id,
--   description, amount, cost_code (TEXT), gc_fee_amount only.
--   No quantity / unit / unit_price / cost_code_id columns.
--   CO trigger uses co_id, inserts NULL for quantity / unit /
--   unit_price (same asymmetry as po_line_items Amendment I),
--   and resolves cost_code TEXT to cost_codes.id via (code,
--   org_id) lookup.
--
-- These are material plan-spec defects that block any verbatim
-- copy of the plan-doc SQL. Documented in the execution-phase QA
-- report (qa-reports/qa-branch2-phase2.8.md) as RUNTIME findings
-- #1-#4. Future fixers: do NOT "correct" this migration back to
-- the plan-doc spec column names — the probe-verified column set
-- below is the authoritative one.
-- ────────────────────────────────────────────────────────────
-- ============================================================

CREATE TABLE public.pricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  job_id UUID NOT NULL REFERENCES public.jobs(id),

  source_type TEXT NOT NULL CHECK (
    source_type IN ('invoice','proposal','po','co')
  ),
  source_id UUID NOT NULL,
  source_line_id UUID NOT NULL,

  vendor_id UUID REFERENCES public.vendors(id),
  cost_code_id UUID REFERENCES public.cost_codes(id),
  description TEXT NOT NULL,

  quantity NUMERIC,
  unit TEXT,
  unit_price BIGINT,      -- cents per R.8
  amount BIGINT NOT NULL, -- cents per R.8
  date DATE NOT NULL,

  -- Amendment E: FK wired to cost-intelligence spine.
  -- Populated by Branch 3/4 matching logic.
  canonical_item_id UUID REFERENCES public.items(id),

  -- Amendment F: 0-1 range matching items.ai_confidence convention.
  match_confidence NUMERIC
    CHECK (match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1)),

  -- Amendment A: audit columns. Append-only — no update-tracking
  -- column. No soft-delete column (Amendment C immutability).
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  -- Amendment C: full unique (non-partial) — idempotency guard
  -- for trigger ON CONFLICT.
  UNIQUE (source_type, source_line_id)
);

-- Amendment G: 5 indexes total (3 spec'd + 2 trigger idempotency).
CREATE INDEX idx_pricing_history_cost_code
  ON public.pricing_history (org_id, cost_code_id, date DESC);
CREATE INDEX idx_pricing_history_vendor
  ON public.pricing_history (org_id, vendor_id, date DESC);
CREATE INDEX idx_pricing_history_description_trgm
  ON public.pricing_history USING GIN (description gin_trgm_ops);
CREATE INDEX idx_pricing_history_job
  ON public.pricing_history (org_id, job_id, date DESC)
  WHERE job_id IS NOT NULL;
CREATE INDEX idx_pricing_history_source_lookup
  ON public.pricing_history (org_id, source_type, source_id);

-- Amendment B: single-SELECT-policy RLS. No INSERT/UPDATE/
-- DELETE policies — trigger functions (SECURITY DEFINER)
-- bypass RLS on writes. R.23 divergence from the 3-policy
-- family. Closest prior pattern: activity_log.
ALTER TABLE public.pricing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY pricing_history_org_read
  ON public.pricing_history
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR app_private.is_platform_admin()
  );

-- ============================================================
-- Amendment J: 4 trigger functions. Each: SECURITY DEFINER,
-- pinned search_path, INSERT ... ON CONFLICT DO NOTHING for
-- idempotency. Explicit GRANT EXECUTE TO authenticated per
-- Amendment F.2 / 00067 pattern.
-- ============================================================

-- (1) invoice_line_items trigger — fires when parent invoice
-- reaches qa_approved status.
-- RUNTIME NOTE #1 + #2: invoice_line_items actual columns are
-- qty / unit / rate / amount_cents (not quantity / unit_price /
-- amount per plan-doc spec); rate is stored in dollars so
-- unit_price requires conversion to BIGINT cents.
CREATE OR REPLACE FUNCTION public.trg_pricing_history_from_invoice_line()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _inv RECORD;
BEGIN
  SELECT id, org_id, job_id, vendor_id, status, invoice_date, created_at
    INTO _inv
    FROM public.invoices
    WHERE id = NEW.invoice_id;

  IF _inv.status IS DISTINCT FROM 'qa_approved' THEN
    RETURN NEW;
  END IF;

  -- job_id on invoices is nullable (legacy); pricing_history.job_id
  -- is NOT NULL. Skip orphans rather than fail the parent INSERT.
  IF _inv.job_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.pricing_history (
    org_id, job_id, source_type, source_id, source_line_id,
    vendor_id, cost_code_id, description,
    quantity, unit, unit_price, amount, date,
    created_by
  ) VALUES (
    _inv.org_id, _inv.job_id, 'invoice', _inv.id, NEW.id,
    _inv.vendor_id, NEW.cost_code_id, COALESCE(NEW.description, ''),
    NEW.qty, NEW.unit,
    CASE WHEN NEW.rate IS NOT NULL THEN ROUND(NEW.rate * 100)::BIGINT ELSE NULL END,
    NEW.amount_cents,
    COALESCE(_inv.invoice_date, _inv.created_at::date),
    auth.uid()
  )
  ON CONFLICT (source_type, source_line_id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_pricing_history_from_invoice_line() IS
'Populates pricing_history from public.invoice_line_items on invoice QA approval (parent invoices.status = ''qa_approved''). RUNTIME NOTE #1 + #2: maps actual column names qty / rate / amount_cents → pricing_history quantity / unit_price / amount, with rate (stored as dollars per invoice-parse convention) converted to cents via ROUND(rate * 100)::BIGINT. Skips rows whose parent invoice has NULL job_id (legacy orphans) because pricing_history.job_id is NOT NULL.';

GRANT EXECUTE ON FUNCTION public.trg_pricing_history_from_invoice_line()
  TO authenticated;

CREATE TRIGGER trg_invoice_line_items_pricing_history
  AFTER INSERT OR UPDATE ON public.invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_pricing_history_from_invoice_line();

-- (2) proposal_line_items trigger — fires when parent proposal
-- reaches accepted status. Column shape matches plan-doc spec
-- (quantity / unit_price / amount all present).
CREATE OR REPLACE FUNCTION public.trg_pricing_history_from_proposal_line()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _prop RECORD;
BEGIN
  SELECT id, org_id, job_id, vendor_id, status, received_date, created_at
    INTO _prop
    FROM public.proposals
    WHERE id = NEW.proposal_id;

  IF _prop.status IS DISTINCT FROM 'accepted' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.pricing_history (
    org_id, job_id, source_type, source_id, source_line_id,
    vendor_id, cost_code_id, description,
    quantity, unit, unit_price, amount, date,
    created_by
  ) VALUES (
    _prop.org_id, _prop.job_id, 'proposal', _prop.id, NEW.id,
    _prop.vendor_id, NEW.cost_code_id, NEW.description,
    NEW.quantity, NEW.unit, NEW.unit_price, NEW.amount,
    COALESCE(_prop.received_date, _prop.created_at::date),
    auth.uid()
  )
  ON CONFLICT (source_type, source_line_id) DO NOTHING;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trg_pricing_history_from_proposal_line()
  TO authenticated;

CREATE TRIGGER trg_proposal_line_items_pricing_history
  AFTER INSERT OR UPDATE ON public.proposal_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_pricing_history_from_proposal_line();

-- (3) po_line_items trigger — fires when parent PO reaches
-- issued status. Amendment I parent-entity resolution:
-- vendor_id via po.vendor_id; date via po.issued_date (with
-- po.created_at fallback); quantity/unit/unit_price NULL
-- because po_line_items doesn't carry them. Note: table name
-- is po_line_items (Amendment H correction from the original
-- spec's purchase_order_line_items). cost_code TEXT resolved
-- to cost_codes.id via (code, org_id) lookup.
CREATE OR REPLACE FUNCTION public.trg_pricing_history_from_po_line()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _po RECORD;
  _cost_code_id UUID;
BEGIN
  SELECT id, org_id, job_id, vendor_id, status, issued_date, created_at
    INTO _po
    FROM public.purchase_orders
    WHERE id = NEW.po_id;

  IF _po.status IS DISTINCT FROM 'issued' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO _cost_code_id
    FROM public.cost_codes
    WHERE code = NEW.cost_code
      AND org_id = _po.org_id
    LIMIT 1;

  INSERT INTO public.pricing_history (
    org_id, job_id, source_type, source_id, source_line_id,
    vendor_id, cost_code_id, description,
    quantity, unit, unit_price, amount, date,
    created_by
  ) VALUES (
    _po.org_id, _po.job_id, 'po', _po.id, NEW.id,
    _po.vendor_id, _cost_code_id, COALESCE(NEW.description, ''),
    NULL, NULL, NULL, NEW.amount,
    COALESCE(_po.issued_date, _po.created_at::date),
    auth.uid()
  )
  ON CONFLICT (source_type, source_line_id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_pricing_history_from_po_line() IS
'Populates pricing_history from public.po_line_items on PO issuance (parent purchase_orders.status = ''issued''). Resolves missing columns from the parent PO: vendor_id ← purchase_orders.vendor_id; date ← purchase_orders.issued_date with purchase_orders.created_at::date fallback. quantity / unit / unit_price insert as NULL because po_line_items does not carry them (asymmetry vs invoice_line_items and proposal_line_items). cost_code TEXT on po_line_items is resolved to cost_codes.id via (code, org_id) lookup. Amendment H renamed the trigger target from the spec''s purchase_order_line_items to po_line_items (canonical name in the codebase).';

GRANT EXECUTE ON FUNCTION public.trg_pricing_history_from_po_line()
  TO authenticated;

CREATE TRIGGER trg_po_line_items_pricing_history
  AFTER INSERT OR UPDATE ON public.po_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_pricing_history_from_po_line();

-- (4) change_order_lines trigger — fires when parent CO
-- reaches approved status.
-- RUNTIME NOTE #3 + #4: change_orders has no vendor_id column
-- (NULL inserted); change_order_lines uses co_id (not
-- change_order_id), has no quantity/unit/unit_price/cost_code_id,
-- and carries cost_code as TEXT — resolved to cost_codes.id via
-- (code, org_id) lookup. Same NULL-fill asymmetry as
-- po_line_items (Amendment I).
CREATE OR REPLACE FUNCTION public.trg_pricing_history_from_co_line()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _co RECORD;
  _cost_code_id UUID;
BEGIN
  SELECT id, org_id, job_id, status, approved_date, created_at
    INTO _co
    FROM public.change_orders
    WHERE id = NEW.co_id;

  IF _co.status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO _cost_code_id
    FROM public.cost_codes
    WHERE code = NEW.cost_code
      AND org_id = _co.org_id
    LIMIT 1;

  INSERT INTO public.pricing_history (
    org_id, job_id, source_type, source_id, source_line_id,
    vendor_id, cost_code_id, description,
    quantity, unit, unit_price, amount, date,
    created_by
  ) VALUES (
    _co.org_id, _co.job_id, 'co', _co.id, NEW.id,
    NULL, _cost_code_id, COALESCE(NEW.description, ''),
    NULL, NULL, NULL, NEW.amount,
    COALESCE(_co.approved_date, _co.created_at::date),
    auth.uid()
  )
  ON CONFLICT (source_type, source_line_id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_pricing_history_from_co_line() IS
'Populates pricing_history from public.change_order_lines on CO approval (parent change_orders.status = ''approved''). RUNTIME NOTE #3 + #4: change_orders has NO vendor_id column — pricing_history.vendor_id inserts as NULL; change_order_lines has NO quantity / unit / unit_price / cost_code_id columns (same asymmetry as po_line_items per Amendment I) — inserts NULL for quantity / unit / unit_price and resolves cost_code TEXT via (code, org_id) lookup on cost_codes. Parent reference column is co_id, not change_order_id as plan-doc spec assumed.';

GRANT EXECUTE ON FUNCTION public.trg_pricing_history_from_co_line()
  TO authenticated;

CREATE TRIGGER trg_change_order_lines_pricing_history
  AFTER INSERT OR UPDATE ON public.change_order_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_pricing_history_from_co_line();

-- ============================================================
-- Amendment M: one-time backfill for qa_approved invoice lines.
-- Execution-phase QA report captures the actual row count +
-- spot-check sample per GH #16 signal-quality gate.
-- RUNTIME NOTE #1 + #2: uses actual column names (qty / rate /
-- amount_cents) with dollar→cents conversion for unit_price.
-- ============================================================
INSERT INTO public.pricing_history (
  org_id, job_id, source_type, source_id, source_line_id,
  vendor_id, cost_code_id, description,
  quantity, unit, unit_price, amount, date,
  created_by
)
SELECT
  i.org_id, i.job_id, 'invoice', i.id, ili.id,
  i.vendor_id, ili.cost_code_id, COALESCE(ili.description, ''),
  ili.qty, ili.unit,
  CASE WHEN ili.rate IS NOT NULL THEN ROUND(ili.rate * 100)::BIGINT ELSE NULL END,
  ili.amount_cents,
  COALESCE(i.invoice_date, i.created_at::date),
  NULL
FROM public.invoice_line_items ili
JOIN public.invoices i ON i.id = ili.invoice_id
WHERE i.status = 'qa_approved'
  AND i.deleted_at IS NULL
  AND i.job_id IS NOT NULL
ON CONFLICT (source_type, source_line_id) DO NOTHING;

-- ============================================================
-- Amendment N: COMMENTs.
-- ============================================================
COMMENT ON TABLE public.pricing_history IS
'Trigger-populated append-only audit spine for pricing observations across 4 source entities (invoice / proposal / po / co). Captures a pricing row when the parent entity reaches its "pricing-committed" status (invoice=qa_approved, proposal=accepted, po=issued, co=approved). R.23 DIVERGENCE (Amendment B): adopts a 1-policy RLS shape (single SELECT, no INSERT/UPDATE/DELETE policies) because pricing_history is a trigger-populated audit spine — neither workflow data nor tenant config. Closest prior precedent: activity_log. IMMUTABILITY (Amendment C): no soft-delete column, no UPDATE. Correction procedure is service-role SQL DELETE by platform admin only. Adding UPDATE or soft-delete policies is prohibited — the append-only semantic is load-bearing for pricing-intelligence signal integrity. GH #16 tracks Branch 3/4 signal-quality validation before enabling user-facing fuzzy-match UIs.';

COMMENT ON COLUMN public.pricing_history.canonical_item_id IS
'Populated by Branch 3/4 matching logic against the cost-intelligence spine (public.items). NULL until matched. FK wired (Amendment E) — ON DELETE NO ACTION preserves history even if a canonical item is retired.';

COMMENT ON COLUMN public.pricing_history.match_confidence IS
'Confidence score for canonical_item_id match, in range [0, 1]. NULL until matching runs. Matches the items.ai_confidence convention (Amendment F).';
