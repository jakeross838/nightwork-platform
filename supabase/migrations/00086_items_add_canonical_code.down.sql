-- Down migration for 00086_items_add_canonical_code.sql

DROP INDEX IF EXISTS items_canonical_code_idx;
ALTER TABLE public.items DROP COLUMN IF EXISTS canonical_code_id;
