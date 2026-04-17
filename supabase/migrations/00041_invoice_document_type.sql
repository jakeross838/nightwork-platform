-- F-011 fix: distinguish formal invoices from receipts/expense captures.
-- Receipts are hardware store runs, permits, dump fees, card charges,
-- petty cash — real spend that doesn't arrive as a vendor PDF.

ALTER TABLE invoices
ADD COLUMN document_type text NOT NULL DEFAULT 'invoice'
CHECK (document_type IN ('invoice', 'receipt'));

COMMENT ON COLUMN invoices.document_type IS
'Either ''invoice'' (formal vendor invoice with PDF + invoice number) or ''receipt'' (photo-based spend: hardware runs, permits, dump fees, card charges, petty cash). Receipts skip vendor/invoice_number requirements.';
