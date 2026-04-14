-- 00012_add_filename_and_category.sql
-- Track the original uploaded filename on every invoice so the improved
-- job matcher can use it (filename often contains the client surname,
-- e.g. "Clark-Demo_855.pdf"). Also classify invoices as either job-cost
-- or overhead (software subscriptions, storage rental, etc.) so PMs can
-- tell at a glance that an unmatched invoice isn't meant to match a job.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS original_filename TEXT;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS document_category TEXT
    NOT NULL DEFAULT 'job_cost'
    CHECK (document_category IN ('job_cost', 'overhead'));

CREATE INDEX IF NOT EXISTS idx_invoices_document_category
  ON public.invoices (document_category)
  WHERE deleted_at IS NULL;
