// ============================================================
// Ross Command Center — TypeScript Type Definitions
// Matches CLAUDE.md data model exactly. Amounts in cents (number).
// ============================================================

// --- Shared types ---

export type UUID = string;

/** Appended to status_history JSONB array on every status change. */
export interface StatusHistoryEntry {
  who: UUID;
  when: string; // ISO 8601
  old_status: string;
  new_status: string;
  note: string | null;
}

/** Base columns present on every record. */
export interface BaseRecord {
  id: UUID;
  org_id: UUID;
  created_at: string;
  updated_at: string;
  created_by: UUID;
  deleted_at: string | null;
}

/** Base columns for records without created_by (e.g. budget_lines, draw_line_items). */
export interface BaseRecordNoCreator {
  id: UUID;
  org_id: UUID;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// --- Roles ---

export type UserRole = 'admin' | 'owner' | 'accounting' | 'pm';

// --- Jobs ---

export type ContractType = 'cost_plus' | 'fixed';
export type JobStatus = 'active' | 'complete' | 'warranty' | 'cancelled';

export interface Job extends BaseRecord {
  name: string;
  address: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  contract_type: ContractType;
  original_contract_amount: number; // cents
  current_contract_amount: number;  // cents
  pm_id: UUID;
  status: JobStatus;
  deposit_percentage: number;   // decimal, default 0.10
  gc_fee_percentage: number;    // decimal, default 0.20
}

// --- Vendors ---

export interface Vendor extends BaseRecord {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  default_cost_code_id: UUID | null;
  qb_vendor_id: string | null;
}

// --- Cost Codes ---

export interface CostCode extends BaseRecordNoCreator {
  code: string;        // e.g. "09101"
  description: string;
  category: string | null;
  sort_order: number;
}

// --- Budget Lines ---

export interface BudgetLine extends BaseRecordNoCreator {
  job_id: UUID;
  cost_code_id: UUID;
  original_estimate: number; // cents
  revised_estimate: number;  // cents (original + approved COs)
}

/** Computed at read time — never stored. */
export interface BudgetLineComputed extends BudgetLine {
  previous_applications: number; // cents
  this_period: number;           // cents
  total_to_date: number;         // cents
  percent_complete: number;      // decimal 0-1
  balance_to_finish: number;     // cents
}

// --- Purchase Orders ---

export type PurchaseOrderStatus =
  | 'draft'
  | 'issued'
  | 'partially_invoiced'
  | 'fully_invoiced'
  | 'closed'
  | 'void';

export interface PurchaseOrder extends BaseRecord {
  job_id: UUID;
  vendor_id: UUID;
  cost_code_id: UUID;
  po_number: string;
  description: string;
  amount: number; // cents
  status: PurchaseOrderStatus;
  co_id: UUID | null;
  status_history: StatusHistoryEntry[];
}

// --- Change Orders ---

export type ChangeOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'executed'
  | 'void';

export interface ChangeOrder extends BaseRecord {
  job_id: UUID;
  pcco_number: number;
  description: string;
  amount: number;          // cents
  gc_fee_amount: number;   // cents
  gc_fee_rate: number;     // decimal (0.18, 0.20, or 0)
  total_with_fee: number;  // cents
  estimated_days_added: number | null;
  status: ChangeOrderStatus;
  approved_date: string | null;
  draw_number: number | null;
  status_history: StatusHistoryEntry[];
}

// --- Invoices ---

export type InvoiceType = 'progress' | 'time_and_materials' | 'lump_sum';
export type InvoiceFileType = 'pdf' | 'docx' | 'xlsx' | 'image';

export type InvoiceStatus =
  | 'received'
  | 'ai_processed'
  | 'pm_review'
  | 'pm_approved'
  | 'pm_held'
  | 'pm_denied'
  | 'qa_review'
  | 'qa_approved'
  | 'qa_kicked_back'
  | 'pushed_to_qb'
  | 'qb_failed'
  | 'in_draw'
  | 'paid'
  | 'void';

export interface InvoiceLineItem {
  description: string;
  date: string | null;
  qty: number | null;
  unit: string | null;
  rate: number | null;   // dollars (as parsed — convert to cents after)
  amount: number;        // dollars (as parsed — convert to cents after)
}

export interface ConfidenceDetails {
  vendor_name: number;
  invoice_number: number;
  total_amount: number;
  job_reference: number;
  cost_code_suggestion: number;
  [key: string]: number;
}

export interface FieldOverride {
  field: string;
  old_value: string | number | null;
  new_value: string | number | null;
}

export interface Invoice extends BaseRecord {
  job_id: UUID;
  vendor_id: UUID | null;
  cost_code_id: UUID | null;
  po_id: UUID | null;
  co_id: UUID | null;

  // Parsed fields
  invoice_number: string | null;
  invoice_date: string | null;
  vendor_name_raw: string | null;
  job_reference_raw: string | null;
  po_reference_raw: string | null;
  description: string | null;
  line_items: InvoiceLineItem[];
  total_amount: number; // cents
  invoice_type: InvoiceType;
  co_reference_raw: string | null;

  // AI metadata
  confidence_score: number; // 0-1
  confidence_details: ConfidenceDetails | null;
  ai_model_used: string | null;
  ai_raw_response: Record<string, unknown> | null;

  // Workflow
  status: InvoiceStatus;
  status_history: StatusHistoryEntry[];

  // Payment
  received_date: string | null;
  payment_date: string | null; // computed
  check_number: string | null;
  picked_up: boolean;

  // File storage
  original_file_url: string | null;
  original_file_type: InvoiceFileType | null;

  // Edit tracking
  pm_overrides: FieldOverride[] | null;
  qa_overrides: FieldOverride[] | null;

  // Links
  draw_id: UUID | null;
  qb_bill_id: string | null;
}

// --- Claude Vision Parse Response ---

export interface InvoiceParseLineItem {
  description: string;
  date: string | null;
  qty: number | null;
  unit: string | null;
  rate: number | null;   // dollars
  amount: number;        // dollars
}

export interface InvoiceParseResult {
  vendor_name: string;
  vendor_address: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  po_reference: string | null;
  job_reference: string | null;
  description: string;
  invoice_type: InvoiceType;
  co_reference: string | null;
  line_items: InvoiceParseLineItem[];
  subtotal: number;           // dollars
  tax: number | null;         // dollars
  total_amount: number;       // dollars
  confidence_score: number;   // 0.0–1.0
  confidence_details: ConfidenceDetails;
  flags: string[];
}

// --- Draws ---

export type DrawStatus =
  | 'draft'
  | 'pm_review'
  | 'approved'
  | 'submitted'
  | 'paid'
  | 'void';

export interface Draw extends BaseRecord {
  job_id: UUID;
  draw_number: number;
  application_date: string;
  period_start: string;
  period_end: string;
  status: DrawStatus;
  revision_number: number;

  // G702 summary fields — all cents
  original_contract_sum: number;
  net_change_orders: number;
  contract_sum_to_date: number;
  total_completed_to_date: number;
  less_previous_payments: number;
  current_payment_due: number;
  balance_to_finish: number;
  deposit_amount: number;

  status_history: StatusHistoryEntry[];
  submitted_at: string | null;
  paid_at: string | null;
}

// --- Draw Line Items ---

export interface DrawLineItem extends BaseRecordNoCreator {
  draw_id: UUID;
  budget_line_id: UUID;
  previous_applications: number; // cents
  this_period: number;           // cents
  total_to_date: number;         // cents
  percent_complete: number;      // decimal
  balance_to_finish: number;     // cents
}
