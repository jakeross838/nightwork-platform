-- Phase 3.4 Step 5f — proposals: schedule_items JSONB + acceptance signature.
--
-- Two more product gaps surfaced during Step 6 fixture-1 review:
--
-- (1) Schedule intelligence foundation. Phase 4 placeholder per
--     amendment-1; capture structured schedule_items now so the
--     intelligence layer has data to learn from when Phase 4 ships.
--     No UI surface in Phase 3.4 — captured to JSONB, sits there,
--     surfaced when Phase 3.5 (PO detail tab) ships.
--
--     Shape: array of
--       {
--         scope_item: text,
--         linked_line_number: int,    -- references proposal_line_items
--         estimated_start_date: date,
--         estimated_duration_days: int,
--         sequence_position: int,     -- 1-indexed phase order
--         depends_on: int[],          -- sequence_positions this blocks on
--         responsibility: text,       -- "vendor" | "contractor" | "shared"
--         deliverables: text[],
--         trigger: text               -- when this scope item starts
--       }
--
-- (2) Acceptance signature. Proposals routinely include a sign-and-
--     date block at the bottom; capturing it gives a paper trail for
--     when the proposal was actually accepted (separate from the
--     proposal_date which is the SENDER's issue date).
--
--       accepted_signature_name TEXT      -- nullable
--       accepted_signature_date DATE      -- nullable
--       accepted_signature_present BOOL   -- NOT NULL DEFAULT false
--
-- All nullable except accepted_signature_present (with default).
-- Idempotent ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS schedule_items JSONB;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS accepted_signature_name TEXT;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS accepted_signature_date DATE;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS accepted_signature_present BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.proposals.schedule_items IS
'JSONB array of structured schedule entries derived from the proposal scope. Phase 4 schedule-intelligence foundation per amendment-1; captured here, surfaced in Phase 3.5 PO detail tab. Shape: [{scope_item, linked_line_number, estimated_start_date, estimated_duration_days, sequence_position, depends_on:int[], responsibility, deliverables:text[], trigger}]. NULL when proposal has no schedulable scope structure (e.g. lump-sum delivery with no phases).';

COMMENT ON COLUMN public.proposals.accepted_signature_name IS
'Name from the "Accepted By" / "Signed By" / "Approved By" block on the proposal. NULL until the proposal is signed (or never if vendor proposal lacks a signature block). Captures the actual acceptor — separate from proposals.created_by which is the Nightwork user who committed the proposal entity.';

COMMENT ON COLUMN public.proposals.accepted_signature_date IS
'Date next to the acceptance signature on the proposal. NULL until signed. Separate from proposals.proposal_date (the sender''s issue date) and proposals.created_at (when committed to Nightwork).';

COMMENT ON COLUMN public.proposals.accepted_signature_present IS
'TRUE when the proposal PDF includes a filled-in acceptance signature block (name + date present). FALSE when the block is blank or absent. Lets queries filter for "accepted-by-owner" proposals without scanning the JSONB or text columns.';
