-- ===========================================================================
-- 00055_non_item_verification.sql
-- ===========================================================================
--
-- Non-item verification + confidence split.
--
-- Fixes two issues surfaced in diagnostic-report-cost-intel.md:
--
--   1. Transactional line items (progress payments, rental periods,
--      recurring services, change-order narratives) were being forced
--      into the item taxonomy. Now: is_transaction_line flag + typed
--      reason, and a new 'not_item' verification_status to mark them
--      as permanently out-of-catalog without writing to the spine.
--
--   2. The single match_confidence column was overloaded — "how sure
--      is the match" vs. "how sure is the classification" collapsed
--      into one number. Claude was returning 0 for new-item proposals
--      interpreting it as "no match = zero confidence", which rendered
--      as a scary "0% AI" badge everywhere. Split into:
--        - match_confidence_score (meaningful only for matches)
--        - classification_confidence (how sure of type/category/specs)
--
-- Backward-compat: match_confidence stays in place and gets mirrored
-- into match_confidence_score; consumers migrate over time.
--
-- TARGET: DEV Supabase (egxkffodxcefwpqmwrur) ONLY.
-- ===========================================================================

BEGIN;

-- ============================================================================
-- 1. TRANSACTION LINE FLAGS
-- ============================================================================

ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS is_transaction_line BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.invoice_extraction_lines
  DROP CONSTRAINT IF EXISTS iel_transaction_line_type_check;
ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS transaction_line_type TEXT;
ALTER TABLE public.invoice_extraction_lines
  ADD CONSTRAINT iel_transaction_line_type_check
  CHECK (transaction_line_type IS NULL OR transaction_line_type IN (
    'progress_payment', 'draw', 'rental_period',
    'service_period', 'change_order_narrative',
    'partial_payment', 'other'
  ));

ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS non_item_reason TEXT;

COMMENT ON COLUMN public.invoice_extraction_lines.is_transaction_line IS
  'Auto-detected by regex pre-filter: this line looks like a billing event (draw, rent period, recurring service) rather than a catalog item.';
COMMENT ON COLUMN public.invoice_extraction_lines.transaction_line_type IS
  'If is_transaction_line OR verification_status=''not_item'': which kind.';
COMMENT ON COLUMN public.invoice_extraction_lines.non_item_reason IS
  'Free-text reason a human supplied when marking a line as non-item.';

CREATE INDEX IF NOT EXISTS idx_iel_transaction_line
  ON public.invoice_extraction_lines(org_id, is_transaction_line)
  WHERE is_transaction_line = TRUE AND deleted_at IS NULL;

-- ============================================================================
-- 2. CONFIDENCE SPLIT
-- ============================================================================

ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS match_confidence_score NUMERIC(4, 3);
ALTER TABLE public.invoice_extraction_lines
  ADD COLUMN IF NOT EXISTS classification_confidence NUMERIC(4, 3);

COMMENT ON COLUMN public.invoice_extraction_lines.match_confidence_score IS
  'How sure the AI is that matched_item_id is the right existing item. 0.0 when match=new. Only meaningful for ai_semantic_match / alias_match / trigram_match tiers.';
COMMENT ON COLUMN public.invoice_extraction_lines.classification_confidence IS
  'How sure the AI is about the proposed item_type + category + specs. Meaningful for every tier including ai_new_item.';

-- Backfill: mirror existing match_confidence into the new match score.
-- classification_confidence is intentionally left NULL on historical rows —
-- the AI didn't return that signal when they were created, so we don't
-- have truthful data to seed it with.
UPDATE public.invoice_extraction_lines
SET match_confidence_score = match_confidence
WHERE match_confidence_score IS NULL AND deleted_at IS NULL;

-- ============================================================================
-- 3. VERIFICATION STATUS ENUM — ADD 'not_item'
-- ============================================================================

ALTER TABLE public.invoice_extraction_lines
  DROP CONSTRAINT IF EXISTS invoice_extraction_lines_verification_status_check;

ALTER TABLE public.invoice_extraction_lines
  ADD CONSTRAINT invoice_extraction_lines_verification_status_check
  CHECK (verification_status IN (
    'pending', 'verified', 'corrected',
    'rejected', 'auto_committed', 'not_item'
  ));

-- ============================================================================
-- 4. EXTRACTION ROLLUP TRIGGER — treat 'not_item' as terminal
-- ============================================================================

-- The existing rollup treats verified|corrected|auto_committed as "complete".
-- 'not_item' is also terminal (line is intentionally not going to spine).
-- Refresh the function so the parent invoice_extractions row rolls up
-- correctly when every remaining line is 'not_item'.

CREATE OR REPLACE FUNCTION app_private.iel_status_rollup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INT;
  v_resolved INT;
  v_rejected INT;
  v_pending INT;
  v_new_status TEXT;
  v_extraction_id UUID;
BEGIN
  v_extraction_id := COALESCE(NEW.extraction_id, OLD.extraction_id);

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE verification_status IN ('verified', 'corrected', 'auto_committed', 'not_item')),
    COUNT(*) FILTER (WHERE verification_status = 'rejected'),
    COUNT(*) FILTER (WHERE verification_status = 'pending')
  INTO v_total, v_resolved, v_rejected, v_pending
  FROM public.invoice_extraction_lines
  WHERE extraction_id = v_extraction_id AND deleted_at IS NULL;

  IF v_total = 0 THEN
    v_new_status := 'pending';
  ELSIF v_pending = 0 AND v_resolved = v_total THEN
    v_new_status := 'verified';
  ELSIF v_pending = 0 AND v_resolved = 0 THEN
    v_new_status := 'rejected';
  ELSIF v_resolved > 0 OR v_rejected > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'pending';
  END IF;

  UPDATE public.invoice_extractions
  SET
    verification_status = v_new_status,
    verified_lines_count = v_resolved,
    total_lines_count = v_total,
    verified_at = CASE WHEN v_new_status = 'verified' THEN NOW() ELSE verified_at END,
    updated_at = NOW()
  WHERE id = v_extraction_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMIT;
