// Caldwell fixture types — Stage 1.5b prototype gallery.
//
// Pure type-only file (no runtime values). No imports from
// @/lib/supabase|org|auth (per hook T10c sample-data isolation
// nightwork-post-edit.sh:194-230). Type-only imports from
// @/lib/supabase/types/* would be permitted but not needed here —
// fixture types are self-contained.
//
// Per CONTEXT D-05: Caldwell-only types extend the existing
// playground fixture pattern with one-job-only nuance + Wave 2
// schedule + payments (projected from invoices) + reconciliation
// (paired imported/current) shapes that have no playground analog.
//
// Per CONTEXT D-28: type/const names use Caldwell* (the substituted
// surname) exclusively; the substitution-pipeline source-of-truth file
// is the only place the source surname survives in source code.
//
// Per R.2 / CLAUDE.md "Recalculate, don't increment" — computed
// fields (previous_applications, total_to_date, percent_complete,
// balance_to_finish) are LEFT OFF CaldwellBudgetLine and computed
// on-render in prototype pages.

export type CaldwellJob = {
  id: string;
  name: string;
  address: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  contract_type: "cost_plus" | "fixed";
  original_contract_amount: number; // cents
  current_contract_amount: number;
  pm_id: string;
  status: "active" | "complete" | "warranty" | "cancelled";
  deposit_percentage: number;
  gc_fee_percentage: number;
};

export type CaldwellVendor = {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  default_cost_code_id: string | null;
};

export type CaldwellCostCode = {
  id: string;
  code: string; // 5-digit, e.g. "01101"
  description: string;
  category: string;
  sort_order: number;
};

export type CaldwellInvoiceType = "progress" | "time_and_materials" | "lump_sum";

export type CaldwellInvoiceStatus =
  | "received"
  | "ai_processed"
  | "pm_review"
  | "pm_approved"
  | "pm_held"
  | "pm_denied"
  | "qa_review"
  | "qa_approved"
  | "qa_kicked_back"
  | "pushed_to_qb"
  | "in_draw"
  | "paid";

export type CaldwellInvoiceLineItem = {
  description: string;
  date: string | null;
  qty: number | null;
  unit: string | null;
  rate: number | null; // dollars
  amount: number; // cents
};

export type CaldwellInvoiceConfidenceDetails = {
  vendor_name: number;
  invoice_number: number;
  total_amount: number;
  job_reference: number;
  cost_code_suggestion: number;
};

export type CaldwellInvoice = {
  id: string;
  vendor_id: string;
  job_id: string;
  cost_code_id: string | null;
  po_id: string | null;
  co_id: string | null; // link to change order if invoice is CO-driven
  invoice_number: string | null;
  invoice_date: string | null;
  description: string;
  invoice_type: CaldwellInvoiceType;
  total_amount: number; // cents
  confidence_score: number; // 0-1
  confidence_details: CaldwellInvoiceConfidenceDetails;
  status: CaldwellInvoiceStatus;
  received_date: string;
  payment_date: string | null;
  draw_id: string | null; // set when pulled into a draw
  line_items: CaldwellInvoiceLineItem[];
  flags: string[];
  original_file_url: string | null; // sanitized fixture path or null
};

export type CaldwellDrawStatus =
  | "draft"
  | "pm_review"
  | "approved"
  | "submitted"
  | "paid"
  | "void";

export type CaldwellDraw = {
  id: string;
  job_id: string;
  draw_number: number;
  application_date: string;
  period_start: string;
  period_end: string;
  status: CaldwellDrawStatus;
  revision_number: number;
  original_contract_sum: number;
  net_change_orders: number;
  contract_sum_to_date: number;
  total_completed_to_date: number;
  less_previous_payments: number;
  current_payment_due: number;
  balance_to_finish: number;
  deposit_amount: number;
  submitted_at: string | null;
  paid_at: string | null;
};

export type CaldwellDrawLineItem = {
  id: string;
  draw_id: string;
  budget_line_id: string;
  cost_code_id: string;
  previous_applications: number; // cents
  this_period: number;
  total_to_date: number;
  percent_complete: number; // 0-1
  balance_to_finish: number;
};

export type CaldwellChangeOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "executed"
  | "void";

export type CaldwellChangeOrder = {
  id: string;
  job_id: string;
  pcco_number: number;
  description: string;
  amount: number; // cents (excluding GC fee)
  gc_fee_amount: number;
  gc_fee_rate: number;
  total_with_fee: number;
  estimated_days_added: number;
  status: CaldwellChangeOrderStatus;
  approved_date: string | null;
  draw_number: number | null;
};

// Per R.2 — computed fields LEFT OFF this type. Prototype pages
// derive previous_applications / this_period / total_to_date /
// percent_complete / balance_to_finish from CALDWELL_INVOICES on render.
export type CaldwellBudgetLine = {
  id: string;
  job_id: string;
  cost_code_id: string;
  original_estimate: number; // cents
  revised_estimate: number; // cents (original + approved COs)
};

export type CaldwellLienReleaseType =
  | "conditional_progress" // Florida statute 713.20(2)(a)
  | "unconditional_progress" // Florida statute 713.20(2)(c)
  | "conditional_final" // Florida statute 713.20(2)(b)
  | "unconditional_final"; // Florida statute 713.20(2)(d)

export type CaldwellLienReleaseStatus =
  | "not_required"
  | "pending"
  | "received"
  | "waived";

export type CaldwellLienRelease = {
  id: string;
  job_id: string;
  vendor_id: string;
  invoice_id: string;
  draw_id: string | null;
  release_type: CaldwellLienReleaseType;
  status: CaldwellLienReleaseStatus;
  release_date: string | null;
  amount_through: number; // cents
};

export type CaldwellScheduleStatus =
  | "not_started"
  | "in_progress"
  | "complete"
  | "blocked";

export type CaldwellScheduleItem = {
  id: string;
  job_id: string;
  name: string;
  start_date: string; // ISO date
  end_date: string; // ISO date
  predecessor_ids: string[];
  parent_id?: string; // hierarchical tasks
  assigned_vendor_id?: string;
  percent_complete: number; // 0-1
  status: CaldwellScheduleStatus;
  is_milestone: boolean; // pay app dates render as diamonds in Gantt
};

export type CaldwellPayment = {
  id: string;
  invoice_id: string;
  job_id: string;
  vendor_id: string;
  amount: number; // cents
  check_number: string | null;
  payment_date: string; // computed via Ross Built rule
  picked_up: boolean;
  picked_up_at: string | null;
};

export type CaldwellReconciliationDriftType = "invoice_po" | "draw_budget";

export type CaldwellReconciliationPair = {
  id: string;
  drift_type: CaldwellReconciliationDriftType;
  imported: Record<string, unknown>; // QuickBooks / external snapshot
  current: Record<string, unknown>; // Nightwork current state
  diffs: Array<{ field: string; imported_value: unknown; current_value: unknown }>;
};
