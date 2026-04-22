-- 00060_align_status_enums.sql
-- Branch 1 Phase 1.1 — Enum Alignment
--
-- Consolidates change_orders.status to its canonical 5-value set and widens
-- invoices.status CHECK to accept the info_requested + info_received states
-- the API was already setting (silent CHECK violation risk closed).
--
-- Background:
--   00001 introduced ('draft','pending_approval','approved','executed','void')
--   00028 widened to ('draft','pending','pending_approval','approved','executed','denied','void')
--          and noted the back-compat values would be cleaned up later. Later is
--          now: nothing else writes 'pending_approval' or 'executed', and the
--          PATCH route at src/app/api/change-orders/[id]/route.ts still typed
--          'executed' in PatchBody — so a stale client that POSTs status=executed
--          would create a row that no current UI workflow can move forward.
--
--   For invoices, 00036 listed the bulk-import lifecycle states but omitted
--   'info_requested' / 'info_received' which the action route at
--   src/app/api/invoices/[id]/action/route.ts maps `request_info` and
--   `info_received` actions to. Until this migration, hitting those actions
--   returns a CHECK violation 500.
--
-- Migration order:
--   1. Backfill legacy CO data forward (pending_approval → pending, executed → approved)
--   2. Drop and re-add the change_orders_status_check with the canonical 5-value set
--   3. Drop and re-add invoices_status_check with the same prior list PLUS
--      info_requested + info_received
--
-- This migration is idempotent: backfills use exact value matches, CHECK
-- constraints are dropped IF EXISTS before re-adding. status_history JSONB is
-- intentionally NOT rewritten — historical entries record what actually
-- happened and are audit-critical (R.7).
--
-- Rollback: see 00060_align_status_enums.down.sql. Note that re-adding the
-- legacy values to the CHECK does NOT restore the original status values on
-- migrated rows — by design, since legacy values are no longer meaningful.

-- ─── Step 1: Backfill change_orders ──────────────────────────────────────
UPDATE public.change_orders
   SET status = 'pending'
 WHERE status = 'pending_approval';

UPDATE public.change_orders
   SET status = 'approved'
 WHERE status = 'executed';

-- ─── Step 2: Re-issue change_orders.status CHECK ─────────────────────────
ALTER TABLE public.change_orders
  DROP CONSTRAINT IF EXISTS change_orders_status_check;

ALTER TABLE public.change_orders
  ADD CONSTRAINT change_orders_status_check
  CHECK (status IN ('draft','pending','approved','denied','void'));

-- ─── Step 3: Widen invoices.status CHECK ─────────────────────────────────
-- Preserves every value 00036 set, ADDS info_requested + info_received.
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status = ANY (ARRAY[
    -- Existing workflow (from 00036)
    'received', 'ai_processed',
    'pm_review', 'pm_approved', 'pm_held', 'pm_denied',
    'qa_review', 'qa_approved', 'qa_kicked_back',
    'pushed_to_qb', 'qb_failed',
    'in_draw', 'paid', 'void',
    -- Bulk-import lifecycle (from 00036)
    'import_queued', 'import_parsing', 'import_parsed',
    'import_error', 'import_duplicate',
    -- Phase 1.1 additions: API was setting these, CHECK was rejecting them
    'info_requested', 'info_received'
  ]));
