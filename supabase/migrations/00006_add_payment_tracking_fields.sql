-- 00006_add_payment_tracking_fields.sql
-- Add mailed_date for payment tracking (check_number and picked_up already exist from 00001)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS mailed_date DATE;
