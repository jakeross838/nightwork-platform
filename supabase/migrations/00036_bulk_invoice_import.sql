-- 00036_bulk_invoice_import.sql
-- Phase 9 — bulk invoice import flow.
-- Adds a batch-tracking table, wires invoices to their batch, and adds
-- org-configurable settings for max batch size / default PM / auto-approval
-- threshold (never auto-approves; only routes).

-- 1. Batch tracker --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'complete', 'partial', 'cancelled')),
  total_files INT NOT NULL DEFAULT 0,
  parsed_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  duplicate_count INT NOT NULL DEFAULT 0,
  sent_to_queue_count INT NOT NULL DEFAULT 0,
  -- Snapshot of settings at batch creation (max_batch_size, default_pm_id, etc.)
  -- so we can reproduce behavior even if settings change mid-batch.
  settings_snapshot JSONB
);

CREATE INDEX IF NOT EXISTS idx_invoice_import_batches_org_created
  ON public.invoice_import_batches (org_id, created_at DESC);

ALTER TABLE public.invoice_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org isolation" ON public.invoice_import_batches
  AS RESTRICTIVE FOR ALL
  USING (org_id = app_private.user_org_id())
  WITH CHECK (org_id = app_private.user_org_id());

CREATE POLICY "members read batches" ON public.invoice_import_batches
  FOR SELECT USING (org_id = app_private.user_org_id());

-- Admins/accounting drive imports; PMs don't. Keep writes restricted.
CREATE POLICY "admins write batches" ON public.invoice_import_batches
  FOR ALL
  USING (
    org_id = app_private.user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.user_id = auth.uid()
        AND m.org_id = invoice_import_batches.org_id
        AND m.is_active = TRUE
        AND m.role IN ('admin', 'owner', 'accounting')
    )
  );

-- 2. Wire invoices → batch -----------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS import_batch_id UUID
    REFERENCES public.invoice_import_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS import_error TEXT,
  ADD COLUMN IF NOT EXISTS import_retry_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_invoices_import_batch
  ON public.invoices (import_batch_id) WHERE import_batch_id IS NOT NULL;

-- 3. Org-configurable import settings ------------------------------------
-- Added as columns on org_workflow_settings (matches the existing columnar
-- layout). Defaults chosen to match task spec: 50-file batch cap, no auto-
-- approval (threshold lives here but route, don't auto-approve), no default
-- PM until org sets one.
ALTER TABLE public.org_workflow_settings
  ADD COLUMN IF NOT EXISTS import_max_batch_size INT NOT NULL DEFAULT 50
    CHECK (import_max_batch_size > 0 AND import_max_batch_size <= 200),
  ADD COLUMN IF NOT EXISTS import_default_pm_id UUID
    REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS import_auto_route_threshold INT NOT NULL DEFAULT 85
    CHECK (import_auto_route_threshold BETWEEN 0 AND 100);

-- 4. Widen the invoices.status CHECK to allow bulk-import lifecycle states.
-- (Turns out status WAS constrained — it's a pre-existing CHECK, not a TEXT-
-- only column as I first assumed. Drop and re-add with the import states.)
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status = ANY (ARRAY[
    -- Existing workflow
    'received', 'ai_processed',
    'pm_review', 'pm_approved', 'pm_held', 'pm_denied',
    'qa_review', 'qa_approved', 'qa_kicked_back',
    'pushed_to_qb', 'qb_failed',
    'in_draw', 'paid', 'void',
    -- Phase 9 bulk-import states (pre-pm_review)
    'import_queued', 'import_parsing', 'import_parsed',
    'import_error', 'import_duplicate'
  ]));
