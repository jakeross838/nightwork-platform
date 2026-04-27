-- Down migration for 00085_items_add_embedding.sql
--
-- Drops the embedding column + ivfflat index + occurrence_count. Note:
-- vendor_item_pricing rows do NOT reference these columns directly, so
-- dropping them does not cascade into the spine. But any code that
-- starts reading items.embedding (Phase 3.4+ when wired in) would
-- break — only run when truly tearing down.

DROP INDEX IF EXISTS items_embedding_idx;
ALTER TABLE public.items DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.items DROP COLUMN IF EXISTS occurrence_count;
