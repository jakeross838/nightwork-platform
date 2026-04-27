-- Migration 00085 — items.embedding + items.occurrence_count
-- Phase 3.3 (Cost Intelligence Foundation) per amendment-1 + addendum-B.
--
-- Per addendum-B: amendment-1 originally specified a NEW canonical_items
-- table with embedding + occurrence_count columns. Investigation showed
-- the existing items table (migration 00052) IS the canonical item
-- registry — richer than what amendment-1 planned. Building a parallel
-- canonical_items table would create the schema-drift pattern Phase A
-- had to clean up.
--
-- Decision: ALTER existing items table additively. No new table.
--
-- This migration is purely additive. Existing extraction → match →
-- commit pipeline (match-item.ts, commit-line-to-spine.ts, etc.) is
-- NOT modified by Phase 3.3. The new columns sit unpopulated until
-- the seed script (Step 7) or a manual backfill via
-- src/lib/cost-intelligence/embeddings.ts populates them.
--
-- Embedding-on-create wiring into commit-line-to-spine.ts is deferred
-- to a later phase per addendum-B.

ALTER TABLE public.items ADD COLUMN IF NOT EXISTS embedding VECTOR(1536);
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS occurrence_count INTEGER NOT NULL DEFAULT 1;

-- ivfflat index with 100 lists. Default tuning for ~thousands of items;
-- if items grows past ~100k rows in production, lists should bump per
-- pgvector docs (sqrt of row count is the rule of thumb). Cosine
-- distance op class — matches our query layer's similarity function.
CREATE INDEX IF NOT EXISTS items_embedding_idx
  ON public.items
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

COMMENT ON COLUMN public.items.embedding IS
  'OpenAI text-embedding-3-small (1536-dim) for similarity search. Populated by scripts/seed-canonical-items.ts in Phase 3.3 and by backfillItemEmbeddings() in src/lib/cost-intelligence/embeddings.ts. Embedding-on-create wiring is deferred to a later phase.';

COMMENT ON COLUMN public.items.occurrence_count IS
  'How many extraction lines / proposals / etc. have matched this item. Default 1 on insert; a future Phase 3.4+ trigger or job will increment as references accumulate.';
