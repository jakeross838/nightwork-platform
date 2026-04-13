-- ============================================================
-- Ross Command Center — Initial Schema
-- All tables, indexes, and constraints.
-- Amounts stored in cents (bigint). UUIDs for PKs.
-- Soft delete via deleted_at. Status history via JSONB.
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- JOBS — universal parent for all financial records
-- ============================================================
create table jobs (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  address       text not null,
  client_name   text not null,
  client_email  text,
  client_phone  text,
  contract_type text not null check (contract_type in ('cost_plus', 'fixed')),
  original_contract_amount bigint not null default 0,
  current_contract_amount  bigint not null default 0,
  pm_id         uuid,  -- references auth.users; FK added after auth setup
  status        text not null default 'active' check (status in ('active', 'complete', 'warranty', 'cancelled')),
  deposit_percentage  numeric(5,4) not null default 0.10,
  gc_fee_percentage   numeric(5,4) not null default 0.20,
  org_id        uuid not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid not null,
  deleted_at    timestamptz
);

create index idx_jobs_status on jobs (status) where deleted_at is null;
create index idx_jobs_org_id on jobs (org_id) where deleted_at is null;
create index idx_jobs_pm_id  on jobs (pm_id)  where deleted_at is null;

-- ============================================================
-- VENDORS
-- ============================================================
create table vendors (
  id                   uuid primary key default uuid_generate_v4(),
  name                 text not null,
  address              text,
  phone                text,
  email                text,
  default_cost_code_id uuid,  -- FK added after cost_codes table
  qb_vendor_id         text,
  org_id               uuid not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid not null,
  deleted_at           timestamptz
);

create index idx_vendors_org_id on vendors (org_id) where deleted_at is null;

-- ============================================================
-- COST CODES
-- ============================================================
create table cost_codes (
  id          uuid primary key default uuid_generate_v4(),
  code        text not null,
  description text not null,
  category    text,
  sort_order  integer not null default 0,
  org_id      uuid not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create unique index idx_cost_codes_code_org on cost_codes (org_id, code) where deleted_at is null;
create index idx_cost_codes_org_id on cost_codes (org_id) where deleted_at is null;

-- Add FK from vendors to cost_codes now that both exist
alter table vendors
  add constraint fk_vendors_default_cost_code
  foreign key (default_cost_code_id) references cost_codes (id);

-- ============================================================
-- BUDGET LINES — one per cost code per job
-- ============================================================
create table budget_lines (
  id                uuid primary key default uuid_generate_v4(),
  job_id            uuid not null references jobs (id),
  cost_code_id      uuid not null references cost_codes (id),
  original_estimate bigint not null default 0,
  revised_estimate  bigint not null default 0,
  org_id            uuid not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create unique index idx_budget_lines_job_code on budget_lines (job_id, cost_code_id) where deleted_at is null;
create index idx_budget_lines_job_id on budget_lines (job_id) where deleted_at is null;

-- ============================================================
-- CHANGE ORDERS — PCCO log entries
-- ============================================================
create table change_orders (
  id                  uuid primary key default uuid_generate_v4(),
  job_id              uuid not null references jobs (id),
  pcco_number         integer not null,
  description         text not null,
  amount              bigint not null default 0,
  gc_fee_amount       bigint not null default 0,
  gc_fee_rate         numeric(5,4) not null default 0.20,
  total_with_fee      bigint not null default 0,
  estimated_days_added integer,
  status              text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'executed', 'void')),
  approved_date       date,
  draw_number         integer,
  status_history      jsonb not null default '[]'::jsonb,
  org_id              uuid not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid not null,
  deleted_at          timestamptz
);

create unique index idx_change_orders_job_pcco on change_orders (job_id, pcco_number) where deleted_at is null;
create index idx_change_orders_job_id on change_orders (job_id) where deleted_at is null;
create index idx_change_orders_status on change_orders (status) where deleted_at is null;

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================
create table purchase_orders (
  id             uuid primary key default uuid_generate_v4(),
  job_id         uuid not null references jobs (id),
  vendor_id      uuid not null references vendors (id),
  cost_code_id   uuid not null references cost_codes (id),
  po_number      text not null,
  description    text not null,
  amount         bigint not null default 0,
  status         text not null default 'draft' check (status in ('draft', 'issued', 'partially_invoiced', 'fully_invoiced', 'closed', 'void')),
  co_id          uuid references change_orders (id),
  status_history jsonb not null default '[]'::jsonb,
  org_id         uuid not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid not null,
  deleted_at     timestamptz
);

create index idx_purchase_orders_job_id on purchase_orders (job_id) where deleted_at is null;
create index idx_purchase_orders_status on purchase_orders (status) where deleted_at is null;
create index idx_purchase_orders_vendor on purchase_orders (vendor_id) where deleted_at is null;

-- ============================================================
-- DRAWS — AIA G702/G703 pay applications
-- ============================================================
create table draws (
  id                       uuid primary key default uuid_generate_v4(),
  job_id                   uuid not null references jobs (id),
  draw_number              integer not null,
  application_date         date not null,
  period_start             date not null,
  period_end               date not null,
  status                   text not null default 'draft' check (status in ('draft', 'pm_review', 'approved', 'submitted', 'paid', 'void')),
  revision_number          integer not null default 0,
  -- G702 summary fields (cents)
  original_contract_sum    bigint not null default 0,
  net_change_orders        bigint not null default 0,
  contract_sum_to_date     bigint not null default 0,
  total_completed_to_date  bigint not null default 0,
  less_previous_payments   bigint not null default 0,
  current_payment_due      bigint not null default 0,
  balance_to_finish        bigint not null default 0,
  deposit_amount           bigint not null default 0,
  status_history           jsonb not null default '[]'::jsonb,
  submitted_at             timestamptz,
  paid_at                  timestamptz,
  org_id                   uuid not null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  created_by               uuid not null,
  deleted_at               timestamptz
);

create unique index idx_draws_job_number on draws (job_id, draw_number) where deleted_at is null;
create index idx_draws_job_id on draws (job_id) where deleted_at is null;
create index idx_draws_status on draws (status) where deleted_at is null;

-- ============================================================
-- INVOICES — Phase 1 focus
-- ============================================================
create table invoices (
  id                uuid primary key default uuid_generate_v4(),
  job_id            uuid not null references jobs (id),
  vendor_id         uuid references vendors (id),
  cost_code_id      uuid references cost_codes (id),
  po_id             uuid references purchase_orders (id),
  co_id             uuid references change_orders (id),

  -- Parsed fields
  invoice_number    text,
  invoice_date      date,
  vendor_name_raw   text,
  job_reference_raw text,
  po_reference_raw  text,
  description       text,
  line_items        jsonb not null default '[]'::jsonb,
  total_amount      bigint not null default 0,
  invoice_type      text not null default 'lump_sum' check (invoice_type in ('progress', 'time_and_materials', 'lump_sum')),
  co_reference_raw  text,

  -- AI metadata
  confidence_score   numeric(4,3) default 0,
  confidence_details jsonb,
  ai_model_used      text,
  ai_raw_response    jsonb,

  -- Workflow
  status          text not null default 'received' check (status in (
    'received', 'ai_processed', 'pm_review', 'pm_approved', 'pm_held', 'pm_denied',
    'qa_review', 'qa_approved', 'qa_kicked_back',
    'pushed_to_qb', 'qb_failed',
    'in_draw', 'paid', 'void'
  )),
  status_history  jsonb not null default '[]'::jsonb,

  -- Payment
  received_date   date,
  payment_date    date,
  check_number    text,
  picked_up       boolean not null default false,

  -- File storage
  original_file_url  text,
  original_file_type text check (original_file_type in ('pdf', 'docx', 'xlsx', 'image')),

  -- Edit tracking
  pm_overrides    jsonb,
  qa_overrides    jsonb,

  -- Links
  draw_id         uuid references draws (id),
  qb_bill_id      text,

  org_id          uuid not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid not null,
  deleted_at      timestamptz
);

create index idx_invoices_job_id  on invoices (job_id)  where deleted_at is null;
create index idx_invoices_status  on invoices (status)  where deleted_at is null;
create index idx_invoices_vendor  on invoices (vendor_id) where deleted_at is null;
create index idx_invoices_draw    on invoices (draw_id) where deleted_at is null;
create index idx_invoices_po      on invoices (po_id)   where deleted_at is null;

-- Duplicate detection: vendor + invoice_number + total_amount + invoice_date
create unique index idx_invoices_duplicate_check
  on invoices (vendor_id, invoice_number, total_amount, invoice_date)
  where deleted_at is null and invoice_number is not null;

-- ============================================================
-- DRAW LINE ITEMS — one per budget line per draw (G703 rows)
-- ============================================================
create table draw_line_items (
  id                    uuid primary key default uuid_generate_v4(),
  draw_id               uuid not null references draws (id),
  budget_line_id        uuid not null references budget_lines (id),
  previous_applications bigint not null default 0,
  this_period           bigint not null default 0,
  total_to_date         bigint not null default 0,
  percent_complete      numeric(7,4) not null default 0,
  balance_to_finish     bigint not null default 0,
  org_id                uuid not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

create unique index idx_draw_line_items_draw_budget on draw_line_items (draw_id, budget_line_id) where deleted_at is null;
create index idx_draw_line_items_draw_id on draw_line_items (draw_id) where deleted_at is null;

-- ============================================================
-- updated_at trigger — auto-set on every update
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_jobs_updated_at            before update on jobs            for each row execute function update_updated_at();
create trigger trg_vendors_updated_at         before update on vendors         for each row execute function update_updated_at();
create trigger trg_cost_codes_updated_at      before update on cost_codes      for each row execute function update_updated_at();
create trigger trg_budget_lines_updated_at    before update on budget_lines    for each row execute function update_updated_at();
create trigger trg_change_orders_updated_at   before update on change_orders   for each row execute function update_updated_at();
create trigger trg_purchase_orders_updated_at before update on purchase_orders for each row execute function update_updated_at();
create trigger trg_draws_updated_at           before update on draws           for each row execute function update_updated_at();
create trigger trg_invoices_updated_at        before update on invoices        for each row execute function update_updated_at();
create trigger trg_draw_line_items_updated_at before update on draw_line_items for each row execute function update_updated_at();
