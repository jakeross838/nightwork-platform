-- 00002_add_is_change_order.sql
-- Add is_change_order boolean to cost_codes table
ALTER TABLE cost_codes ADD COLUMN IF NOT EXISTS is_change_order BOOLEAN NOT NULL DEFAULT false;
