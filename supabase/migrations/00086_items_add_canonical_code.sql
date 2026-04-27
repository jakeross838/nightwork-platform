-- Migration 00086 — items.canonical_code_id
-- Phase 3.3 (Cost Intelligence Foundation), commit 7.
--
-- Per addendum-B, the existing items table is the canonical item registry.
-- Amendment-1 §Phase 3.4 schema specifies that proposal/invoice/budget
-- line items reference the canonical item registry via canonical_code_id
-- (UUID FK to canonical_cost_codes). This migration adds that column to
-- items so seed entries (commit 7) and future Phase 3.4+ wiring can
-- populate it.
--
-- Purely additive: nullable column, no constraint on existing rows. The
-- existing extraction matcher (match-item.ts, commit-line-to-spine.ts)
-- does NOT read or write this column. Phase 3.4+ owns the wiring.

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS canonical_code_id UUID REFERENCES public.canonical_cost_codes(id);

CREATE INDEX IF NOT EXISTS items_canonical_code_idx
  ON public.items (canonical_code_id);

COMMENT ON COLUMN public.items.canonical_code_id IS
  'Optional FK to canonical_cost_codes (NAHB v1; CSI later). Populated by the seed script in Phase 3.3 commit 7 and by Phase 3.4+ extractors. Nullable — items without a canonical link are still valid catalog entries.';
