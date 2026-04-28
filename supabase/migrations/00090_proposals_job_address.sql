-- Phase 3.4 Step 5j — proposals.job_address column.
--
-- Surfaced during cross-fixture eval review (prompt 191):
-- proposals routinely include a project/install/job address that
-- maps to a Ross Built job during PM review. Today that address is
-- buried in scope_summary text and not queryable.
--
-- Adding as nullable TEXT (not all proposals have a usable address —
-- service-only proposals with no fixed site, etc., return null).
-- No CHECK constraint — addresses are freeform vendor-supplied text.
-- Mappable to jobs.address by the PM on review (or future fuzzy-match
-- routine).
--
-- Idempotent ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS job_address TEXT;

COMMENT ON COLUMN public.proposals.job_address IS
'Project/install/site address as stated on the vendor proposal — populated by extractor (Phase 3.4 Step 5k) from "Project address", "Job address", "Install address", "Site address", or "Bill To" sections. Null when proposal does not state a site address. PM-mappable to the Ross Built job_id during review; useful for cross-job vendor queries (e.g. "what has Faust quoted us on Holmes Beach addresses").';
