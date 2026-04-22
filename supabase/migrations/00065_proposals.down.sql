-- Rollback for 00065_proposals.sql (paired per R.16).
--
-- DESTRUCTIVE if rows exist. Pre-Branch-3 this should be safe to run —
-- no write routes exist for proposals yet, so tables should be empty.
-- Post-Branch-3, running this rollback with data in place will drop
-- every proposal + line item with no recovery path.
--
-- Drops in reverse-dependency order:
--   1. Child table first (proposal_line_items depends on proposals via FK)
--   2. Parent table second (proposals)
--
-- CASCADE on the DROP TABLE implicitly drops: triggers, indexes,
-- RLS policies, and any dependent views (none at this phase).

DROP TABLE IF EXISTS public.proposal_line_items CASCADE;
DROP TABLE IF EXISTS public.proposals CASCADE;
