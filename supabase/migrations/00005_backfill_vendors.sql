-- Backfill: create vendor records from existing invoices with vendor_name_raw but no vendor_id
INSERT INTO vendors (name, org_id)
SELECT DISTINCT trim(vendor_name_raw), '00000000-0000-0000-0000-000000000001'::uuid
FROM invoices
WHERE vendor_name_raw IS NOT NULL
  AND deleted_at IS NULL
  AND vendor_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM vendors v WHERE lower(trim(v.name)) = lower(trim(invoices.vendor_name_raw)) AND v.deleted_at IS NULL
  );

-- Link invoices to their matching vendors
UPDATE invoices i
SET vendor_id = v.id
FROM vendors v
WHERE lower(trim(i.vendor_name_raw)) = lower(trim(v.name))
  AND i.vendor_id IS NULL
  AND i.deleted_at IS NULL
  AND v.deleted_at IS NULL;
