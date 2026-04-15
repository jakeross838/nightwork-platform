-- Phase 6 — Budget system extensions + email notification preferences.
--
-- Extends the existing budget_lines table with sort_order, notes,
-- co_adjustments, committed, and invoiced running totals, and adds a
-- parent `budgets` table for versioning ("Original Budget", "Owner Rev 2").
--
-- Adds email_notifications_enabled to org_members so users can opt out of
-- notification emails (the in-app bell and status-history logs still fire).
--
-- Adds a trigger that keeps budget_lines.invoiced in sync with the sum of
-- approved invoice line items allocated to each budget line. Approval flow
-- doesn't have to remember to recompute — writes to invoice_line_items or
-- invoice status changes cascade.

-- ============================================================
-- 1. budgets parent table
-- ============================================================
-- Owner + version history. The existing "singleton" budget_lines-per-job
-- becomes the default active budget; future revisions get new budgets rows.
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id),
  name TEXT NOT NULL DEFAULT 'Original Budget',
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_amount BIGINT NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_budgets_org_id ON public.budgets (org_id);
CREATE INDEX IF NOT EXISTS idx_budgets_job_id ON public.budgets (job_id);
-- Only one active budget per job
CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_one_active_per_job
  ON public.budgets (job_id)
  WHERE is_active = true AND deleted_at IS NULL;

CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org isolation" ON public.budgets
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id())
  WITH CHECK (org_id = app_private.user_org_id());

CREATE POLICY "members read budgets" ON public.budgets
  FOR SELECT USING (org_id = app_private.user_org_id());

CREATE POLICY "admin write budgets" ON public.budgets
  FOR ALL TO authenticated
  USING (app_private.user_role() = 'admin')
  WITH CHECK (app_private.user_role() = 'admin');

-- ============================================================
-- 2. Extend budget_lines with Phase 6 fields
-- ============================================================
ALTER TABLE public.budget_lines
  ADD COLUMN IF NOT EXISTS budget_id UUID REFERENCES public.budgets(id);

ALTER TABLE public.budget_lines
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.budget_lines
  ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE public.budget_lines
  ADD COLUMN IF NOT EXISTS co_adjustments BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.budget_lines
  ADD COLUMN IF NOT EXISTS committed BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.budget_lines
  ADD COLUMN IF NOT EXISTS invoiced BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.budget_lines
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.budget_lines
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Backfill description/category from cost_codes where empty, and sort_order
-- from the matching cost_code.sort_order for a sensible default ordering.
UPDATE public.budget_lines bl
  SET description = cc.description,
      category = cc.category,
      sort_order = COALESCE(cc.sort_order, 0)
  FROM public.cost_codes cc
  WHERE bl.cost_code_id = cc.id
    AND (bl.description IS NULL OR bl.category IS NULL);

CREATE INDEX IF NOT EXISTS idx_budget_lines_budget_id ON public.budget_lines (budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_lines_sort_order ON public.budget_lines (job_id, sort_order);

-- ============================================================
-- 3. Trigger: recompute budget_lines.invoiced from approved invoice lines
-- ============================================================
-- Statuses at and beyond PM approval count toward "invoiced". Kept in sync
-- whenever an invoice_line_item is inserted/updated/deleted, or an invoice
-- status changes. This is the single source of truth — no caller has to
-- remember to recompute.

CREATE OR REPLACE FUNCTION public.recompute_budget_line_invoiced(p_budget_line_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.budget_lines bl
    SET invoiced = COALESCE((
      SELECT SUM(ili.amount_cents)
        FROM public.invoice_line_items ili
        JOIN public.invoices i ON i.id = ili.invoice_id
        WHERE ili.budget_line_id = p_budget_line_id
          AND ili.deleted_at IS NULL
          AND i.deleted_at IS NULL
          AND i.status IN (
            'pm_approved', 'qa_review', 'qa_approved',
            'pushed_to_qb', 'in_draw', 'paid'
          )
    ), 0)
  WHERE bl.id = p_budget_line_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trg_invoice_line_items_budget_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Recompute for both the old and new budget_line_id (they may differ on UPDATE).
  IF TG_OP = 'DELETE' THEN
    IF OLD.budget_line_id IS NOT NULL THEN
      PERFORM public.recompute_budget_line_invoiced(OLD.budget_line_id);
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.budget_line_id IS DISTINCT FROM NEW.budget_line_id THEN
      IF OLD.budget_line_id IS NOT NULL THEN
        PERFORM public.recompute_budget_line_invoiced(OLD.budget_line_id);
      END IF;
    END IF;
    IF NEW.budget_line_id IS NOT NULL THEN
      PERFORM public.recompute_budget_line_invoiced(NEW.budget_line_id);
    END IF;
    RETURN NEW;
  ELSE  -- INSERT
    IF NEW.budget_line_id IS NOT NULL THEN
      PERFORM public.recompute_budget_line_invoiced(NEW.budget_line_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_line_items_budget_sync ON public.invoice_line_items;
CREATE TRIGGER trg_invoice_line_items_budget_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_invoice_line_items_budget_sync();

-- When an invoice status changes, every line item's effective allocation
-- flips in/out of "invoiced" — recompute each affected budget line.
CREATE OR REPLACE FUNCTION public.trg_invoices_status_budget_sync()
RETURNS TRIGGER AS $$
DECLARE
  bl_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    FOR bl_id IN
      SELECT DISTINCT ili.budget_line_id
        FROM public.invoice_line_items ili
        WHERE ili.invoice_id = NEW.id
          AND ili.budget_line_id IS NOT NULL
          AND ili.deleted_at IS NULL
    LOOP
      PERFORM public.recompute_budget_line_invoiced(bl_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoices_status_budget_sync ON public.invoices;
CREATE TRIGGER trg_invoices_status_budget_sync
  AFTER UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_invoices_status_budget_sync();

-- Backfill the invoiced totals once so existing data is correct.
DO $$
DECLARE
  bl_id UUID;
BEGIN
  FOR bl_id IN SELECT id FROM public.budget_lines WHERE deleted_at IS NULL LOOP
    PERFORM public.recompute_budget_line_invoiced(bl_id);
  END LOOP;
END;
$$;

-- ============================================================
-- 4. Email notification preferences on org_members
-- ============================================================
ALTER TABLE public.org_members
  ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- 5. Notifications: allow users to update their OWN read-state
-- ============================================================
-- Existing RLS only allowed reading their own rows; to mark a notification
-- as read, the user needs UPDATE on their own rows too.
DROP POLICY IF EXISTS "user update own notifications" ON public.notifications;
CREATE POLICY "user update own notifications" ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
