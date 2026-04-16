-- 00035_performance_indexes.sql
-- Compound indexes for dashboard and jobs/health aggregation queries.
-- These replace slow sequential scans on single-column org_id indexes
-- when queries also filter on status, date, or job_id.

-- invoices: dashboard filters by org_id + status constantly
CREATE INDEX IF NOT EXISTS idx_invoices_org_status
  ON public.invoices (org_id, status) WHERE deleted_at IS NULL;

-- invoices: dashboard cash-flow aging and payment queries
CREATE INDEX IF NOT EXISTS idx_invoices_org_payment_status
  ON public.invoices (org_id, payment_status) WHERE deleted_at IS NULL;

-- invoices: vendor drill-downs and payment batching
CREATE INDEX IF NOT EXISTS idx_invoices_org_vendor
  ON public.invoices (org_id, vendor_id) WHERE deleted_at IS NULL;

-- invoices: job-scoped lookups (job detail, health check)
CREATE INDEX IF NOT EXISTS idx_invoices_job_status
  ON public.invoices (job_id, status) WHERE deleted_at IS NULL;

-- activity_log: dashboard feed — org + recency
CREATE INDEX IF NOT EXISTS idx_activity_log_org_created
  ON public.activity_log (org_id, created_at DESC);

-- activity_log: jobs/health resolution — entity_id lookup
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_id
  ON public.activity_log (entity_id) WHERE entity_id IS NOT NULL;

-- budget_lines: job-scoped aggregation (jobs/health, budget page)
CREATE INDEX IF NOT EXISTS idx_budget_lines_job
  ON public.budget_lines (job_id) WHERE deleted_at IS NULL;

-- purchase_orders: dashboard PO exhaustion check
CREATE INDEX IF NOT EXISTS idx_purchase_orders_org_status
  ON public.purchase_orders (org_id, status) WHERE deleted_at IS NULL;

-- purchase_orders: job-scoped lookups
CREATE INDEX IF NOT EXISTS idx_purchase_orders_job_status
  ON public.purchase_orders (job_id, status) WHERE deleted_at IS NULL;

-- draws: dashboard draft/submitted counts
CREATE INDEX IF NOT EXISTS idx_draws_org_status
  ON public.draws (org_id, status) WHERE deleted_at IS NULL;

-- draws: job-scoped lookups (job detail, health)
CREATE INDEX IF NOT EXISTS idx_draws_job_status
  ON public.draws (job_id, status) WHERE deleted_at IS NULL;

-- lien_releases: dashboard "draws missing liens" check
CREATE INDEX IF NOT EXISTS idx_lien_releases_draw_deleted
  ON public.lien_releases (draw_id) WHERE deleted_at IS NULL;

-- invoices: duplicate detection dashboard check
CREATE INDEX IF NOT EXISTS idx_invoices_org_duplicate
  ON public.invoices (org_id, is_potential_duplicate)
  WHERE deleted_at IS NULL AND is_potential_duplicate = TRUE AND duplicate_dismissed_at IS NULL;

-- FK columns that lacked indexes:
CREATE INDEX IF NOT EXISTS idx_invoices_draw_id
  ON public.invoices (draw_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_draw_line_items_draw
  ON public.draw_line_items (draw_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_cost_code
  ON public.invoices (cost_code_id) WHERE deleted_at IS NULL;
