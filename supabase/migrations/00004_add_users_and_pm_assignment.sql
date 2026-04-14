-- Users table for internal team
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'pm' CHECK (role IN ('admin', 'pm', 'accounting', 'owner')),
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Add assigned_pm_id to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS assigned_pm_id UUID REFERENCES users(id);

-- Seed users
INSERT INTO users (id, full_name, email, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Jake Ross', 'jake@rossbuilt.com', 'admin'),
  ('a0000000-0000-0000-0000-000000000002', 'Lee Worthy', 'lee@rossbuilt.com', 'pm'),
  ('a0000000-0000-0000-0000-000000000003', 'Nelson Belanger', 'nelson@rossbuilt.com', 'pm'),
  ('a0000000-0000-0000-0000-000000000004', 'Bob Mozine', 'bob@rossbuilt.com', 'pm'),
  ('a0000000-0000-0000-0000-000000000005', 'Jeff Bryde', 'jeff@rossbuilt.com', 'pm'),
  ('a0000000-0000-0000-0000-000000000006', 'Martin Mannix', 'martin@rossbuilt.com', 'pm'),
  ('a0000000-0000-0000-0000-000000000007', 'Jason Szykulski', 'jason@rossbuilt.com', 'pm'),
  ('a0000000-0000-0000-0000-000000000008', 'Diane', 'diane@rossbuilt.com', 'accounting')
ON CONFLICT (id) DO NOTHING;

-- Assign Lee Worthy as PM on Drummond job
UPDATE jobs SET pm_id = 'a0000000-0000-0000-0000-000000000002' WHERE id = 'fb4a65f7-f295-45a3-b6c5-ba1737be3d96';
