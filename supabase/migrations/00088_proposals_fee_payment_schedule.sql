-- Phase 3.4 Step 5b — proposals: structured fee/payment schedule columns.
--
-- Adds 3 nullable JSONB columns to capture vendor billing terms that
-- were previously dropped on the floor by the extractor (or worse,
-- partially shoved into the freeform `notes` text). Each is a real
-- product gap surfaced during Step 6 eval — vendors regularly include:
--
--   1. additional_fee_schedule — table of hourly/blended rates for
--      services beyond the base proposal scope. Common on
--      design/professional services proposals (e.g., principal hour
--      $200, drafter hour $90).
--      Shape: [{rate_type, description, rate_cents, unit}, ...]
--
--   2. payment_schedule — milestone-based billing breakdown. Common on
--      proposals for material-heavy or phased work (e.g., "50% deposit,
--      25% upon delivery, 25% upon completion").
--      Shape: [{milestone, percentage_pct, amount_cents, trigger}, ...]
--
--   3. payment_terms — top-level vendor billing terms. Net days, late
--      interest, governing law, miscellaneous terms text.
--      Shape: {net_days, late_interest_rate_pct, governing_law, other_terms_text}
--
-- All three are nullable + default NULL — proposals without these
-- structures (e.g., a single-line lump-sum proposal with no terms
-- printed) leave them NULL. Extractor returns NULL when proposal
-- doesn't include the structure; never inferred. Same rule as
-- vendor_stated_start_date / vendor_stated_duration_days from
-- migration 00087.
--
-- Idempotent via ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS additional_fee_schedule JSONB;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS payment_schedule JSONB;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS payment_terms JSONB;

COMMENT ON COLUMN public.proposals.additional_fee_schedule IS
'JSONB array of additional fee/rate entries when the proposal lists hourly rates or additional-service pricing. Shape: [{rate_type, description, rate_cents, unit}]. NULL when proposal does not include such a schedule. Extractor (Phase 3.4 Step 5c) returns NULL when not explicitly stated; never inferred.';

COMMENT ON COLUMN public.proposals.payment_schedule IS
'JSONB array of payment-milestone entries when the proposal specifies a milestone-based billing breakdown. Shape: [{milestone, percentage_pct, amount_cents, trigger}]. NULL when proposal does not include a milestone schedule. Extractor returns NULL when not explicitly stated; never inferred.';

COMMENT ON COLUMN public.proposals.payment_terms IS
'JSONB object capturing vendor billing terms. Shape: {net_days, late_interest_rate_pct, governing_law, other_terms_text}. NULL when proposal does not state explicit terms. Each sub-field nullable. Extractor populates only fields explicitly present on the proposal; never inferred.';
