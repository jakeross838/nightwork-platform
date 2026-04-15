-- Phase 7 — Purchase Orders, Change Orders, and PO↔Budget integration.
--
-- Builds out the financial chain that ties budget lines to real-world
-- commitments and eventual spend:
--   * purchase_orders — already existed; extend with invoiced_total,
--     remaining (generated), issued_date, notes, budget_line_id, po_number
--     auto-generation metadata, and a broader status CHECK constraint.
--   * po_line_items — multi-line POs (each line can point at its own
--     budget line and cost code).
--   * invoice_line_items.po_id — links an invoice line to a PO so the PO's
--     invoiced_total can be kept in sync.
--   * change_orders — already exists from Phase 1; extend with title,
--     co_type (owner | internal), submitted_date, approved_by,
--     denied_reason, source_invoice_id, and broaden status CHECK.
--   * change_order_lines — one row per budget line affected by a CO.
--     Positive amount = addition, negative = credit.
--   * jobs.approved_cos — sum of approved owner-type COs; revised_contract
--     derives from original_contract + approved_cos.
--   * Triggers that keep budget_lines.committed (sum of open PO amounts)
--     and budget_lines.co_adjustments (sum of approved CO line amounts)
--     in sync automatically, plus triggers that recompute a PO's
--     invoiced_total whenever a linked invoice line changes.
--
-- This migration is additive; existing columns and data are preserved.

-- ============================================================
-- 1. jobs — track approved_cos for revised_contract math
-- ============================================================
-- Existing `original_contract_amount` + `current_contract_amount` stay as
-- the canonical contract totals (current is updated on CO execution).
-- The new `approved_cos_total` mirrors the sum of approved owner COs so
-- the Phase 7 budget summary cards can show Original / Approved / Revised
-- without re-summing change_orders every render.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS approved_cos_total BIGINT NOT NULL DEFAULT 0;

-- ============================================================
-- 2. purchase_orders — extend existing table
-- ============================================================
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS budget_line_id UUID REFERENCES public.budget_lines(id);

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS invoiced_total BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS issued_date DATE;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Existing rows require vendor_id and cost_code_id NOT NULL; loosen so POs
-- can exist in draft before those are picked, matching the UI flow.
ALTER TABLE public.purchase_orders
  ALTER COLUMN vendor_id DROP NOT NULL;

ALTER TABLE public.purchase_orders
  ALTER COLUMN cost_code_id DROP NOT NULL;

-- Broaden status CHECK to include the Phase 7 statuses. Existing rows are
-- zero so we drop any implicit check and recreate the explicit one.
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.purchase_orders'::regclass
    AND pg_get_constraintdef(oid) ILIKE '%status%IN%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.purchase_orders DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN ('draft','issued','partially_invoiced','fully_invoiced','closed','void'));

CREATE INDEX IF NOT EXISTS idx_purchase_orders_job_id ON public.purchase_orders (job_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id ON public.purchase_orders (vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_budget_line_id ON public.purchase_orders (budget_line_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON public.purchase_orders (org_id, po_number);

-- ============================================================
-- 3. po_line_items — multi-line POs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.po_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  budget_line_id UUID REFERENCES public.budget_lines(id),
  cost_code TEXT,
  description TEXT,
  amount BIGINT NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_po_line_items_po_id ON public.po_line_items (po_id);
CREATE INDEX IF NOT EXISTS idx_po_line_items_budget_line_id ON public.po_line_items (budget_line_id);
CREATE INDEX IF NOT EXISTS idx_po_line_items_org_id ON public.po_line_items (org_id);

ALTER TABLE public.po_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org isolation" ON public.po_line_items;
CREATE POLICY "org isolation" ON public.po_line_items
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id())
  WITH CHECK (org_id = app_private.user_org_id());
DROP POLICY IF EXISTS "members read po_line_items" ON public.po_line_items;
CREATE POLICY "members read po_line_items" ON public.po_line_items
  FOR SELECT USING (org_id = app_private.user_org_id());

-- ============================================================
-- 4. invoice_line_items — link a line to a PO
-- ============================================================
ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES public.purchase_orders(id);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_po_id ON public.invoice_line_items (po_id);

-- ============================================================
-- 5. change_orders — extend existing table
-- ============================================================
ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS title TEXT;

ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS co_type TEXT NOT NULL DEFAULT 'owner';

ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS submitted_date DATE;

ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS denied_reason TEXT;

ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS source_invoice_id UUID REFERENCES public.invoices(id);

-- Broaden status CHECK: keep existing 'pending_approval' / 'executed' for
-- back-compat, add 'pending' (alias) and 'denied'.
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.change_orders'::regclass
    AND pg_get_constraintdef(oid) ILIKE '%status%IN%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.change_orders DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.change_orders
  ADD CONSTRAINT change_orders_status_check
  CHECK (status IN ('draft','pending','pending_approval','approved','executed','denied','void'));

ALTER TABLE public.change_orders
  ADD CONSTRAINT change_orders_co_type_check
  CHECK (co_type IN ('owner','internal'));

-- Backfill title from description where empty for legacy rows.
UPDATE public.change_orders
  SET title = COALESCE(NULLIF(title,''), LEFT(COALESCE(description,'Change Order'), 120))
  WHERE title IS NULL OR title = '';

CREATE INDEX IF NOT EXISTS idx_change_orders_job_id ON public.change_orders (job_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_org_id ON public.change_orders (org_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_status ON public.change_orders (job_id, status);

-- ============================================================
-- 6. change_order_lines — one row per budget line affected
-- ============================================================
-- Replaces the legacy `change_order_budget_lines` table the Phase 1 code
-- gestured at but never actually created. Positive amount = addition;
-- negative = credit back to owner.
CREATE TABLE IF NOT EXISTS public.change_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  co_id UUID NOT NULL REFERENCES public.change_orders(id) ON DELETE CASCADE,
  budget_line_id UUID REFERENCES public.budget_lines(id),
  cost_code TEXT,
  description TEXT,
  amount BIGINT NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_change_order_lines_co_id ON public.change_order_lines (co_id);
CREATE INDEX IF NOT EXISTS idx_change_order_lines_budget_line_id ON public.change_order_lines (budget_line_id);
CREATE INDEX IF NOT EXISTS idx_change_order_lines_org_id ON public.change_order_lines (org_id);

ALTER TABLE public.change_order_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org isolation" ON public.change_order_lines;
CREATE POLICY "org isolation" ON public.change_order_lines
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id())
  WITH CHECK (org_id = app_private.user_org_id());
DROP POLICY IF EXISTS "members read change_order_lines" ON public.change_order_lines;
CREATE POLICY "members read change_order_lines" ON public.change_order_lines
  FOR SELECT USING (org_id = app_private.user_org_id());

-- ============================================================
-- 7. Triggers — keep budget_lines.committed in sync with POs
-- ============================================================
-- committed = SUM(amount) of open PO amounts against this budget line.
-- Open = status IN ('issued','partially_invoiced','fully_invoiced').
-- Lines also count: if po_line_items rows point at budget_lines, their
-- amounts contribute; if not, fall back to the PO's header budget_line_id.

CREATE OR REPLACE FUNCTION public.recompute_budget_line_committed(p_budget_line_id UUID)
RETURNS VOID AS $$
BEGIN
  IF p_budget_line_id IS NULL THEN RETURN; END IF;
  UPDATE public.budget_lines bl
    SET committed = COALESCE((
      -- Header-level commitments: PO has no line items but points at this bl.
      SELECT SUM(po.amount)
        FROM public.purchase_orders po
        WHERE po.budget_line_id = p_budget_line_id
          AND po.deleted_at IS NULL
          AND po.status IN ('issued','partially_invoiced','fully_invoiced')
          AND NOT EXISTS (
            SELECT 1 FROM public.po_line_items li
            WHERE li.po_id = po.id AND li.deleted_at IS NULL
          )
    ), 0) + COALESCE((
      -- Line-item commitments: sum po_line_items.amount for open POs.
      SELECT SUM(li.amount)
        FROM public.po_line_items li
        JOIN public.purchase_orders po ON po.id = li.po_id
        WHERE li.budget_line_id = p_budget_line_id
          AND li.deleted_at IS NULL
          AND po.deleted_at IS NULL
          AND po.status IN ('issued','partially_invoiced','fully_invoiced')
    ), 0)
  WHERE bl.id = p_budget_line_id;
END;
$$ LANGUAGE plpgsql;

-- Invoiced-total sync: PO.invoiced_total = SUM(approved invoice line amount
-- where ili.po_id = po.id), and status flips to partially/fully_invoiced.
CREATE OR REPLACE FUNCTION public.recompute_po_invoiced(p_po_id UUID)
RETURNS VOID AS $$
DECLARE
  new_total BIGINT;
  po_amount BIGINT;
  cur_status TEXT;
  next_status TEXT;
BEGIN
  IF p_po_id IS NULL THEN RETURN; END IF;
  SELECT COALESCE(SUM(ili.amount_cents), 0)
    INTO new_total
    FROM public.invoice_line_items ili
    JOIN public.invoices i ON i.id = ili.invoice_id
    WHERE ili.po_id = p_po_id
      AND ili.deleted_at IS NULL
      AND i.deleted_at IS NULL
      AND i.status IN ('pm_approved','qa_review','qa_approved','pushed_to_qb','in_draw','paid');

  SELECT amount, status INTO po_amount, cur_status
    FROM public.purchase_orders WHERE id = p_po_id;

  IF po_amount IS NULL THEN RETURN; END IF;

  next_status := cur_status;
  IF cur_status IN ('issued','partially_invoiced','fully_invoiced') THEN
    IF new_total <= 0 THEN
      next_status := 'issued';
    ELSIF new_total < po_amount THEN
      next_status := 'partially_invoiced';
    ELSE
      next_status := 'fully_invoiced';
    END IF;
  END IF;

  UPDATE public.purchase_orders
    SET invoiced_total = new_total,
        status = next_status,
        updated_at = NOW()
    WHERE id = p_po_id;
END;
$$ LANGUAGE plpgsql;

-- Fire when purchase_orders rows change (status flips, line items insert,
-- budget_line_id flips) — we recompute the relevant budget line(s).
CREATE OR REPLACE FUNCTION public.trg_purchase_orders_commit_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.budget_line_id IS NOT NULL THEN
      PERFORM public.recompute_budget_line_committed(OLD.budget_line_id);
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.budget_line_id IS DISTINCT FROM NEW.budget_line_id THEN
      IF OLD.budget_line_id IS NOT NULL THEN
        PERFORM public.recompute_budget_line_committed(OLD.budget_line_id);
      END IF;
    END IF;
    IF NEW.budget_line_id IS NOT NULL THEN
      PERFORM public.recompute_budget_line_committed(NEW.budget_line_id);
    END IF;
    RETURN NEW;
  ELSE  -- INSERT
    IF NEW.budget_line_id IS NOT NULL THEN
      PERFORM public.recompute_budget_line_committed(NEW.budget_line_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_purchase_orders_commit_sync ON public.purchase_orders;
CREATE TRIGGER trg_purchase_orders_commit_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_purchase_orders_commit_sync();

CREATE OR REPLACE FUNCTION public.trg_po_line_items_commit_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.budget_line_id IS NOT NULL THEN
      PERFORM public.recompute_budget_line_committed(OLD.budget_line_id);
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.budget_line_id IS DISTINCT FROM NEW.budget_line_id THEN
      IF OLD.budget_line_id IS NOT NULL THEN
        PERFORM public.recompute_budget_line_committed(OLD.budget_line_id);
      END IF;
    END IF;
    IF NEW.budget_line_id IS NOT NULL THEN
      PERFORM public.recompute_budget_line_committed(NEW.budget_line_id);
    END IF;
    RETURN NEW;
  ELSE
    IF NEW.budget_line_id IS NOT NULL THEN
      PERFORM public.recompute_budget_line_committed(NEW.budget_line_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_po_line_items_commit_sync ON public.po_line_items;
CREATE TRIGGER trg_po_line_items_commit_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.po_line_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_po_line_items_commit_sync();

-- ============================================================
-- 8. Triggers — keep PO.invoiced_total in sync with invoice lines
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_invoice_line_items_po_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.po_id IS NOT NULL THEN
      PERFORM public.recompute_po_invoiced(OLD.po_id);
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.po_id IS DISTINCT FROM NEW.po_id THEN
      IF OLD.po_id IS NOT NULL THEN
        PERFORM public.recompute_po_invoiced(OLD.po_id);
      END IF;
    END IF;
    IF NEW.po_id IS NOT NULL THEN
      PERFORM public.recompute_po_invoiced(NEW.po_id);
    END IF;
    RETURN NEW;
  ELSE
    IF NEW.po_id IS NOT NULL THEN
      PERFORM public.recompute_po_invoiced(NEW.po_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_line_items_po_sync ON public.invoice_line_items;
CREATE TRIGGER trg_invoice_line_items_po_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_invoice_line_items_po_sync();

-- Invoice status flips also move lines in/out of "approved" aggregation.
CREATE OR REPLACE FUNCTION public.trg_invoices_status_po_sync()
RETURNS TRIGGER AS $$
DECLARE
  po_id_val UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    FOR po_id_val IN
      SELECT DISTINCT ili.po_id
        FROM public.invoice_line_items ili
        WHERE ili.invoice_id = NEW.id
          AND ili.po_id IS NOT NULL
          AND ili.deleted_at IS NULL
    LOOP
      PERFORM public.recompute_po_invoiced(po_id_val);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoices_status_po_sync ON public.invoices;
CREATE TRIGGER trg_invoices_status_po_sync
  AFTER UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_invoices_status_po_sync();

-- ============================================================
-- 9. Triggers — keep budget_lines.co_adjustments in sync with COs
-- ============================================================
-- co_adjustments = SUM(co_lines.amount) for approved COs.
CREATE OR REPLACE FUNCTION public.recompute_budget_line_co_adjustments(p_budget_line_id UUID)
RETURNS VOID AS $$
BEGIN
  IF p_budget_line_id IS NULL THEN RETURN; END IF;
  UPDATE public.budget_lines bl
    SET co_adjustments = COALESCE((
      SELECT SUM(col.amount)
        FROM public.change_order_lines col
        JOIN public.change_orders co ON co.id = col.co_id
        WHERE col.budget_line_id = p_budget_line_id
          AND col.deleted_at IS NULL
          AND co.deleted_at IS NULL
          AND co.status IN ('approved','executed')
    ), 0),
    revised_estimate = original_estimate + COALESCE((
      SELECT SUM(col.amount)
        FROM public.change_order_lines col
        JOIN public.change_orders co ON co.id = col.co_id
        WHERE col.budget_line_id = p_budget_line_id
          AND col.deleted_at IS NULL
          AND co.deleted_at IS NULL
          AND co.status IN ('approved','executed')
    ), 0)
  WHERE bl.id = p_budget_line_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trg_change_order_lines_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.budget_line_id IS NOT NULL THEN
      PERFORM public.recompute_budget_line_co_adjustments(OLD.budget_line_id);
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.budget_line_id IS DISTINCT FROM NEW.budget_line_id THEN
      IF OLD.budget_line_id IS NOT NULL THEN
        PERFORM public.recompute_budget_line_co_adjustments(OLD.budget_line_id);
      END IF;
    END IF;
    IF NEW.budget_line_id IS NOT NULL THEN
      PERFORM public.recompute_budget_line_co_adjustments(NEW.budget_line_id);
    END IF;
    RETURN NEW;
  ELSE
    IF NEW.budget_line_id IS NOT NULL THEN
      PERFORM public.recompute_budget_line_co_adjustments(NEW.budget_line_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_change_order_lines_sync ON public.change_order_lines;
CREATE TRIGGER trg_change_order_lines_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.change_order_lines
  FOR EACH ROW EXECUTE FUNCTION public.trg_change_order_lines_sync();

-- When a CO's status flips (approved/denied/void), recalc every line it touches.
CREATE OR REPLACE FUNCTION public.trg_change_orders_status_sync()
RETURNS TRIGGER AS $$
DECLARE
  bl_id UUID;
  job_approved_total BIGINT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    FOR bl_id IN
      SELECT DISTINCT col.budget_line_id
        FROM public.change_order_lines col
        WHERE col.co_id = NEW.id
          AND col.budget_line_id IS NOT NULL
          AND col.deleted_at IS NULL
    LOOP
      PERFORM public.recompute_budget_line_co_adjustments(bl_id);
    END LOOP;

    -- Update jobs.approved_cos_total for owner-type COs.
    SELECT COALESCE(SUM(amount), 0) INTO job_approved_total
      FROM public.change_orders
      WHERE job_id = NEW.job_id
        AND co_type = 'owner'
        AND status IN ('approved','executed')
        AND deleted_at IS NULL;
    UPDATE public.jobs
      SET approved_cos_total = job_approved_total,
          current_contract_amount = original_contract_amount + job_approved_total,
          updated_at = NOW()
      WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_change_orders_status_sync ON public.change_orders;
CREATE TRIGGER trg_change_orders_status_sync
  AFTER UPDATE ON public.change_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_change_orders_status_sync();

-- ============================================================
-- 10. Helper — generate the next PO number per org
-- ============================================================
-- Format: PO-001, PO-002, …. The UI can override by sending its own.
CREATE OR REPLACE FUNCTION public.next_po_number(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_n INTEGER;
  max_parsed INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(
      CASE
        WHEN po_number ~ '^PO-[0-9]+$'
        THEN substring(po_number FROM 4)::INTEGER
        ELSE 0
      END
    ),
    0
  ) INTO max_parsed
  FROM public.purchase_orders
  WHERE org_id = p_org_id AND deleted_at IS NULL;
  next_n := max_parsed + 1;
  RETURN 'PO-' || LPAD(next_n::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 11. Backfill — committed, invoiced_total, approved_cos_total
-- ============================================================
DO $$
DECLARE
  bl_id UUID;
  po_id_val UUID;
  j RECORD;
BEGIN
  FOR bl_id IN SELECT id FROM public.budget_lines WHERE deleted_at IS NULL LOOP
    PERFORM public.recompute_budget_line_committed(bl_id);
    PERFORM public.recompute_budget_line_co_adjustments(bl_id);
  END LOOP;
  FOR po_id_val IN SELECT id FROM public.purchase_orders WHERE deleted_at IS NULL LOOP
    PERFORM public.recompute_po_invoiced(po_id_val);
  END LOOP;
  FOR j IN SELECT id FROM public.jobs WHERE deleted_at IS NULL LOOP
    UPDATE public.jobs
      SET approved_cos_total = COALESCE((
        SELECT SUM(amount)
          FROM public.change_orders
          WHERE job_id = j.id
            AND co_type = 'owner'
            AND status IN ('approved','executed')
            AND deleted_at IS NULL
      ), 0)
      WHERE id = j.id;
  END LOOP;
END $$;
