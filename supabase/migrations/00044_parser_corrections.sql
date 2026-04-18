-- Migration 00044: Parser correction capture
--
-- Every time a PM edits a parser-populated field on an invoice, record the
-- delta. This becomes training data for parser improvements: few-shot example
-- selection, pattern mining, vendor-specific learning.
--
-- The ai_raw_response JSONB column (already on invoices) stores the original
-- parser output. This table captures the diff when a human corrects it.

CREATE TABLE IF NOT EXISTS parser_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  field_name text NOT NULL,           -- 'vendor_name', 'total_amount', 'cost_code_id', etc.
  original_value text,                -- what the parser said (text repr for any type)
  corrected_value text,               -- what the PM changed it to
  original_confidence numeric(3,2),   -- 0.00-1.00 parser confidence at extract time
  vendor_name text,                   -- denormalized for easy querying
  cost_code_id uuid REFERENCES cost_codes(id),
  corrected_by uuid NOT NULL,
  corrected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_parser_corrections_org_id ON parser_corrections(org_id);
CREATE INDEX idx_parser_corrections_invoice_id ON parser_corrections(invoice_id);
CREATE INDEX idx_parser_corrections_field_name ON parser_corrections(field_name);
CREATE INDEX idx_parser_corrections_vendor ON parser_corrections(vendor_name);
CREATE INDEX idx_parser_corrections_corrected_at ON parser_corrections(corrected_at);

-- RLS
ALTER TABLE parser_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org isolation" ON parser_corrections
  FOR ALL
  USING (org_id = app_private.user_org_id())
  WITH CHECK (org_id = app_private.user_org_id());

CREATE POLICY "members read corrections" ON parser_corrections
  FOR SELECT
  USING (org_id = app_private.user_org_id());

CREATE POLICY "pm admin owner accounting write corrections" ON parser_corrections
  FOR INSERT
  WITH CHECK (
    org_id = app_private.user_org_id()
    AND app_private.user_role() IN ('admin', 'owner', 'accounting', 'pm')
  );

COMMENT ON TABLE parser_corrections IS
  'Captures deltas between AI parser output and human corrections on invoice fields. Used for parser improvement analytics and future few-shot example selection.';
