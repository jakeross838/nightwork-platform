-- 00001_initial_schema.sql
-- Ross Command Center — Full initial schema
-- All tables follow: id (UUID), created_at, updated_at, created_by, org_id, deleted_at (soft delete)

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- JOBS — Universal parent for all financial records
-- ============================================================
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  contract_type TEXT NOT NULL DEFAULT 'cost_plus' CHECK (contract_type IN ('cost_plus', 'fixed')),
  original_contract_amount BIGINT NOT NULL DEFAULT 0,
  current_contract_amount BIGINT NOT NULL DEFAULT 0,
  pm_id UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'complete', 'warranty', 'cancelled')),
  deposit_percentage NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  gc_fee_percentage NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  org_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- VENDORS
-- ============================================================
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  default_cost_code_id UUID,
  qb_vendor_id TEXT,
  org_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- COST CODES — 5-digit codes mapped to AIA G703 line items
-- ============================================================
CREATE TABLE cost_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  org_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_cost_codes_code_org ON cost_codes (code, org_id) WHERE deleted_at IS NULL;

-- ============================================================
-- BUDGET LINES — One per cost code per job (G703 rows)
-- ============================================================
CREATE TABLE budget_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  cost_code_id UUID NOT NULL REFERENCES cost_codes(id),
  original_estimate BIGINT NOT NULL DEFAULT 0,
  revised_estimate BIGINT NOT NULL DEFAULT 0,
  org_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_budget_lines_job_cost ON budget_lines (job_id, cost_code_id) WHERE deleted_at IS NULL;

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  cost_code_id UUID NOT NULL REFERENCES cost_codes(id),
  po_number TEXT,
  description TEXT,
  amount BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'partially_invoiced', 'fully_invoiced', 'closed', 'void')),
  co_id UUID,
  status_history JSONB NOT NULL DEFAULT '[]'::JSONB,
  org_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- CHANGE ORDERS — Maps to PCCO Log
-- ============================================================
CREATE TABLE change_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  pcco_number INTEGER NOT NULL,
  description TEXT,
  amount BIGINT NOT NULL DEFAULT 0,
  gc_fee_amount BIGINT NOT NULL DEFAULT 0,
  gc_fee_rate NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  total_with_fee BIGINT NOT NULL DEFAULT 0,
  estimated_days_added INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'executed', 'void')),
  approved_date DATE,
  draw_number INTEGER,
  status_history JSONB NOT NULL DEFAULT '[]'::JSONB,
  org_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- INVOICES — Phase 1 Focus
-- ============================================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id),
  vendor_id UUID REFERENCES vendors(id),
  cost_code_id UUID REFERENCES cost_codes(id),
  po_id UUID REFERENCES purchase_orders(id),
  co_id UUID REFERENCES change_orders(id),

  -- Parsed fields
  invoice_number TEXT,
  invoice_date DATE,
  vendor_name_raw TEXT,
  job_reference_raw TEXT,
  po_reference_raw TEXT,
  description TEXT,
  line_items JSONB NOT NULL DEFAULT '[]'::JSONB,
  total_amount BIGINT NOT NULL DEFAULT 0,
  invoice_type TEXT CHECK (invoice_type IN ('progress', 'time_and_materials', 'lump_sum')),
  co_reference_raw TEXT,

  -- AI metadata
  confidence_score NUMERIC(3,2) DEFAULT 0,
  confidence_details JSONB,
  ai_model_used TEXT,
  ai_raw_response JSONB,

  -- Workflow
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN (
    'received', 'ai_processed', 'pm_review', 'pm_approved', 'pm_held', 'pm_denied',
    'qa_review', 'qa_approved', 'qa_kicked_back',
    'pushed_to_qb', 'qb_failed',
    'in_draw', 'paid', 'void'
  )),
  status_history JSONB NOT NULL DEFAULT '[]'::JSONB,

  -- Payment
  received_date DATE,
  payment_date DATE,
  check_number TEXT,
  picked_up BOOLEAN NOT NULL DEFAULT FALSE,

  -- File storage
  original_file_url TEXT,
  original_file_type TEXT CHECK (original_file_type IN ('pdf', 'docx', 'xlsx', 'image')),

  -- Edit tracking
  pm_overrides JSONB,
  qa_overrides JSONB,

  -- Links
  draw_id UUID,
  qb_bill_id TEXT,

  org_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- DRAWS — Monthly AIA G702/G703 pay applications
-- ============================================================
CREATE TABLE draws (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  draw_number INTEGER NOT NULL,
  application_date DATE,
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pm_review', 'approved', 'submitted', 'paid', 'void')),
  revision_number INTEGER NOT NULL DEFAULT 0,

  -- G702 summary fields (all cents, all computed from line items)
  original_contract_sum BIGINT NOT NULL DEFAULT 0,
  net_change_orders BIGINT NOT NULL DEFAULT 0,
  contract_sum_to_date BIGINT NOT NULL DEFAULT 0,
  total_completed_to_date BIGINT NOT NULL DEFAULT 0,
  less_previous_payments BIGINT NOT NULL DEFAULT 0,
  current_payment_due BIGINT NOT NULL DEFAULT 0,
  balance_to_finish BIGINT NOT NULL DEFAULT 0,
  deposit_amount BIGINT NOT NULL DEFAULT 0,

  status_history JSONB NOT NULL DEFAULT '[]'::JSONB,
  submitted_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  org_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_draws_job_number ON draws (job_id, draw_number) WHERE deleted_at IS NULL;

-- ============================================================
-- DRAW LINE ITEMS — One per budget line per draw (G703 rows)
-- ============================================================
CREATE TABLE draw_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_id UUID NOT NULL REFERENCES draws(id),
  budget_line_id UUID NOT NULL REFERENCES budget_lines(id),
  previous_applications BIGINT NOT NULL DEFAULT 0,
  this_period BIGINT NOT NULL DEFAULT 0,
  total_to_date BIGINT NOT NULL DEFAULT 0,
  percent_complete NUMERIC(5,2) NOT NULL DEFAULT 0,
  balance_to_finish BIGINT NOT NULL DEFAULT 0,
  org_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_draw_line_items_draw_budget ON draw_line_items (draw_id, budget_line_id) WHERE deleted_at IS NULL;

-- ============================================================
-- Add FK for invoices.draw_id now that draws table exists
-- ============================================================
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_draw FOREIGN KEY (draw_id) REFERENCES draws(id);

-- ============================================================
-- Add FK for purchase_orders.co_id now that change_orders table exists
-- ============================================================
ALTER TABLE purchase_orders ADD CONSTRAINT fk_purchase_orders_co FOREIGN KEY (co_id) REFERENCES change_orders(id);

-- ============================================================
-- Add FK for vendors.default_cost_code_id
-- ============================================================
ALTER TABLE vendors ADD CONSTRAINT fk_vendors_default_cost_code FOREIGN KEY (default_cost_code_id) REFERENCES cost_codes(id);

-- ============================================================
-- updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_cost_codes_updated_at BEFORE UPDATE ON cost_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_budget_lines_updated_at BEFORE UPDATE ON budget_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_change_orders_updated_at BEFORE UPDATE ON change_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_draws_updated_at BEFORE UPDATE ON draws FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_draw_line_items_updated_at BEFORE UPDATE ON draw_line_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
