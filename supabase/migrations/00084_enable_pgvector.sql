-- Migration 00084 — enable pgvector extension
-- Phase 3.3 (Cost Intelligence Foundation) per amendment-1 + addendum-B.
--
-- Idempotent (CREATE EXTENSION IF NOT EXISTS). On dev the vector
-- extension v0.8.0 is available but not installed; this migration is
-- where it gets turned on. On prod / future fresh databases this
-- migration creates it from scratch.
--
-- Required by migration 00085 which adds items.embedding VECTOR(1536)
-- and an ivfflat index for cosine similarity search.

CREATE EXTENSION IF NOT EXISTS vector;
