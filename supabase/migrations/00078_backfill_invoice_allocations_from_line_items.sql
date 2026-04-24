-- Migration 00078 — backfill multi-cost-code invoice_allocations from line items
--
-- Context
--   Prior to the companion PR that updated the GET
--   /api/invoices/[id]/allocations route, the auto-create fallback
--   inserted ONE invoice_allocations row matching
--   invoices.cost_code_id + invoices.total_amount whenever an invoice
--   was viewed without an explicit allocation set. When the PM
--   approved a line-item split across multiple cost codes, that split
--   persisted in invoice_line_items but invoice_allocations still
--   held only the stub row. The legacy read-only "cost code
--   allocation" summary in InvoiceDetailsPanel masked the gap by
--   summing line_items client-side; commit 68115a0 removed that
--   summary in favour of the single editor surface that reads
--   allocations directly, and exposed the discrepancy.
--
-- What this migration does
--   For each invoice where —
--     (a) invoice_line_items has >= 2 distinct assigned cost_code_ids,
--     (b) exactly 1 live invoice_allocations row exists,
--     (c) that single allocation's cost_code_id = invoices.cost_code_id
--         (confirming it's the auto-stub, not a user-created single
--         allocation), AND
--     (d) the assigned line items' amount_cents sum equals
--         invoices.total_amount (same invariant the PUT /allocations
--         route enforces — skipping violations keeps the post-
--         migration state valid for immediate user re-save) —
--   the stub is soft-deleted (deleted_at = NOW()) and replaced with
--   one invoice_allocations row per cost_code_id group:
--     - amount_cents = SUM(line.amount_cents)
--     - description  = first (lowest line_index) line's description
--                      COALESCE'd to 'Migrated from line items'
--
-- Why soft-delete the stub instead of DELETE
--   Preserves forensics: a later audit can query
--   deleted_at IS NOT NULL to see what was replaced.
--
-- Idempotency
--   A second invocation finds zero candidates. After the first pass,
--   each affected invoice has N >= 2 live allocations, so condition
--   (b) ("exactly 1 live row") no longer matches. Rerunning is a no-op.
--
-- Guards against unintended writes
--   - Untouched: invoices with 0 or >= 2 live allocations.
--   - Untouched: invoices where the single allocation is at a cost
--     code different from invoices.cost_code_id (indicates
--     user-created intentional single allocation).
--   - Untouched: invoices where the sum invariant fails (would leave
--     the allocations table in an invariant-violating state).

BEGIN;

-- 1. Build the backfill plan in a temp table. A temp table rather
--    than chained CTEs because the same row set feeds both the
--    soft-delete UPDATE (step 2) and the INSERT (step 3), and
--    Postgres can't share one WITH across two modifying statements.
CREATE TEMP TABLE _allocations_backfill_plan ON COMMIT DROP AS
WITH candidate_invoices AS (
  -- Invoices whose single live allocation looks like an auto-stub.
  SELECT i.id                 AS invoice_id,
         i.total_amount       AS total_amount,
         i.cost_code_id       AS invoice_cost_code_id
  FROM public.invoices i
  WHERE i.deleted_at IS NULL
    AND i.total_amount IS NOT NULL
    AND i.cost_code_id IS NOT NULL
    AND (
      SELECT COUNT(*)
      FROM public.invoice_allocations a
      WHERE a.invoice_id = i.id
        AND a.deleted_at IS NULL
    ) = 1
    AND (
      SELECT a.cost_code_id
      FROM public.invoice_allocations a
      WHERE a.invoice_id = i.id
        AND a.deleted_at IS NULL
      LIMIT 1
    ) = i.cost_code_id
),
line_item_groups AS (
  -- Per-invoice × cost-code rollup. Assigned (non-null cost_code_id)
  -- and non-deleted line items only. First description by line_index
  -- preserves source ordering and stays deterministic across runs.
  SELECT ci.invoice_id,
         ci.total_amount,
         li.cost_code_id,
         SUM(li.amount_cents)::bigint AS amount_cents,
         (array_agg(li.description ORDER BY li.line_index))[1] AS description
  FROM candidate_invoices ci
  JOIN public.invoice_line_items li
    ON li.invoice_id = ci.invoice_id
   AND li.deleted_at IS NULL
   AND li.cost_code_id IS NOT NULL
  GROUP BY ci.invoice_id, ci.total_amount, li.cost_code_id
),
valid_invoices AS (
  -- Enforce invariants before emitting the plan.
  SELECT invoice_id
  FROM line_item_groups
  GROUP BY invoice_id, total_amount
  HAVING COUNT(DISTINCT cost_code_id) >= 2
     AND SUM(amount_cents) = total_amount
)
SELECT g.invoice_id,
       g.cost_code_id,
       g.amount_cents,
       g.description
FROM line_item_groups g
JOIN valid_invoices v USING (invoice_id);

-- 2. Soft-delete stub rows for the invoices we're about to backfill.
UPDATE public.invoice_allocations
   SET deleted_at = NOW()
 WHERE invoice_id IN (SELECT DISTINCT invoice_id FROM _allocations_backfill_plan)
   AND deleted_at IS NULL;

-- 3. Insert the grouped rows. NULL descriptions fall back to a
--    sentinel so downstream consumers that assume non-null get a
--    predictable marker.
INSERT INTO public.invoice_allocations (invoice_id, cost_code_id, amount_cents, description)
SELECT invoice_id,
       cost_code_id,
       amount_cents,
       COALESCE(description, 'Migrated from line items')
  FROM _allocations_backfill_plan;

COMMIT;
