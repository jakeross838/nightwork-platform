-- 00013_invoice_line_items_and_co_flags.sql
-- Multi-cost-code support at the line-item level.
-- In construction, a single invoice often spans multiple cost codes
-- (lumber: framing material + strapping material; T&M: labor + materials).
-- Each line item becomes independently assignable to its own cost code,
-- and independently flaggable as a change order.
--
-- Also adds is_change_order + amount guard fields at the invoice level
-- so the PM approval flow can auto-toggle CO from AI detection and guard
-- against amount edits that exceed the AI-parsed total by >10%.

-- ============================================================
-- Invoice-level flags
-- ============================================================
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS is_change_order BOOLEAN NOT NULL DEFAULT false;

-- Preserve the AI-parsed total so the PM approval guard can compare edits
-- to the original parsed amount (and flag > 10% increases).
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS ai_parsed_total_amount BIGINT;

-- ============================================================
-- INVOICE_LINE_ITEMS — one row per line, individually assignable
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_index INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  qty NUMERIC,
  unit TEXT,
  rate NUMERIC,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  cost_code_id UUID REFERENCES cost_codes(id),
  budget_line_id UUID REFERENCES budget_lines(id),
  is_change_order BOOLEAN NOT NULL DEFAULT false,
  co_reference TEXT,
  ai_suggested_cost_code_id UUID REFERENCES cost_codes(id),
  ai_suggestion_confidence NUMERIC(3,2),
  org_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice
  ON invoice_line_items (invoice_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_cost_code
  ON invoice_line_items (cost_code_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_budget_line
  ON invoice_line_items (budget_line_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_invoice_line_items_updated_at
  BEFORE UPDATE ON invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- BACKFILL — migrate existing JSONB line_items into the new table
-- ============================================================
-- For every invoice that has line_items JSONB but no rows in invoice_line_items,
-- copy each entry across. We resolve budget_line_id from the invoice's current
-- cost_code_id + job_id (best-effort — PM can re-assign after).
INSERT INTO invoice_line_items (
  invoice_id, line_index, description, qty, unit, rate, amount_cents,
  cost_code_id, budget_line_id, is_change_order, co_reference, org_id
)
SELECT
  i.id AS invoice_id,
  (li.ord - 1)::INTEGER AS line_index,
  NULLIF(li.item->>'description', '') AS description,
  CASE WHEN li.item->>'qty' ~ '^-?[0-9]+(\.[0-9]+)?$'
       THEN (li.item->>'qty')::NUMERIC
       ELSE NULL END AS qty,
  NULLIF(li.item->>'unit', '') AS unit,
  CASE WHEN li.item->>'rate' ~ '^-?[0-9]+(\.[0-9]+)?$'
       THEN (li.item->>'rate')::NUMERIC
       ELSE NULL END AS rate,
  -- Dollars → cents. If amount is absent, fall back to 0.
  CASE WHEN li.item->>'amount' ~ '^-?[0-9]+(\.[0-9]+)?$'
       THEN ROUND((li.item->>'amount')::NUMERIC * 100)::BIGINT
       ELSE 0 END AS amount_cents,
  i.cost_code_id,
  bl.id AS budget_line_id,
  -- Infer CO flag from invoice-level co_reference_raw for the migration
  (i.co_reference_raw IS NOT NULL AND i.co_reference_raw <> '') AS is_change_order,
  i.co_reference_raw AS co_reference,
  i.org_id
FROM invoices i
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(i.line_items, '[]'::jsonb))
  WITH ORDINALITY AS li(item, ord)
LEFT JOIN budget_lines bl
  ON bl.job_id = i.job_id
  AND bl.cost_code_id = i.cost_code_id
  AND bl.deleted_at IS NULL
WHERE i.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM invoice_line_items ili
    WHERE ili.invoice_id = i.id AND ili.deleted_at IS NULL
  )
  AND jsonb_typeof(i.line_items) = 'array'
  AND jsonb_array_length(i.line_items) > 0;

-- Also backfill ai_parsed_total_amount from current total_amount where unset,
-- so future PM edits have a reference point for the > 10% guard.
UPDATE invoices
  SET ai_parsed_total_amount = total_amount
  WHERE ai_parsed_total_amount IS NULL
    AND deleted_at IS NULL;

-- ============================================================
-- RLS — mirror the invoices table (read-all, write gated by role + ownership)
-- ============================================================
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read invoice_line_items" ON public.invoice_line_items;
CREATE POLICY "authenticated read invoice_line_items"
  ON public.invoice_line_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin write invoice_line_items" ON public.invoice_line_items;
CREATE POLICY "admin write invoice_line_items"
  ON public.invoice_line_items FOR ALL TO authenticated
  USING (app_private.user_role() = 'admin')
  WITH CHECK (app_private.user_role() = 'admin');

DROP POLICY IF EXISTS "pm write invoice_line_items on own jobs" ON public.invoice_line_items;
CREATE POLICY "pm write invoice_line_items on own jobs"
  ON public.invoice_line_items FOR ALL TO authenticated
  USING (
    app_private.user_role() = 'pm'
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_line_items.invoice_id
        AND (
          i.assigned_pm_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = i.job_id AND j.pm_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    app_private.user_role() = 'pm'
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_line_items.invoice_id
        AND (
          i.assigned_pm_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = i.job_id AND j.pm_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "accounting write invoice_line_items" ON public.invoice_line_items;
CREATE POLICY "accounting write invoice_line_items"
  ON public.invoice_line_items FOR ALL TO authenticated
  USING (app_private.user_role() = 'accounting')
  WITH CHECK (app_private.user_role() = 'accounting');
