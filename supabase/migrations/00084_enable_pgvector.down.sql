-- Down migration for 00084_enable_pgvector.sql
--
-- Disabling pgvector destroys all VECTOR columns + ivfflat indexes. By
-- the time this is run, migration 00085's down should have already
-- dropped items.embedding + items_embedding_idx — but DROP EXTENSION
-- with CASCADE will clean up any stragglers.
--
-- Only run when truly tearing down. In normal rollback flow you'd
-- typically stop at 00085's down and leave the extension enabled.

DROP EXTENSION IF EXISTS vector CASCADE;
