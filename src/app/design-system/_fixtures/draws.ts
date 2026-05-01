// Sample draws for the design-system playground (Stage 1.5a T19.5).
//
// Pure constants. No imports from @/lib/supabase|org|auth (per SPEC C6 / D9).
// References job IDs from jobs.ts. Amounts in cents. Per CLAUDE.md "draws"
// schema — represents one monthly AIA G702/G703 pay application.

export type SampleDrawStatus =
  | "draft"
  | "pm_review"
  | "approved"
  | "submitted"
  | "paid"
  | "void";

export type SampleDraw = {
  id: string;
  job_id: string;
  draw_number: number;
  application_date: string; // YYYY-MM-DD
  period_start: string;
  period_end: string;
  status: SampleDrawStatus;
  revision_number: number;

  // G702 summary fields (cents) — in production these are computed on
  // read from line items; here they're pre-rolled for display fidelity.
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

export const SAMPLE_DRAWS: SampleDraw[] = [
  // Pelican Bay — draw 8 of 12, paid
  {
    id: "d-pelican-bay-08",
    job_id: "j-pelican-bay",
    draw_number: 8,
    application_date: "2026-03-25",
    period_start: "2026-03-01",
    period_end: "2026-03-31",
    status: "paid",
    revision_number: 0,
    original_contract_sum: 482_000_000,
    net_change_orders: 28_500_000,
    contract_sum_to_date: 510_500_000,
    total_completed_to_date: 312_400_000,
    less_previous_payments: 289_000_000,
    current_payment_due: 23_400_000,
    balance_to_finish: 198_100_000,
    deposit_amount: 48_200_000,
    submitted_at: "2026-03-26T14:30:00Z",
    paid_at: "2026-04-08T11:15:00Z",
  },

  // Pelican Bay — draw 9, in pm_review
  {
    id: "d-pelican-bay-09",
    job_id: "j-pelican-bay",
    draw_number: 9,
    application_date: "2026-04-25",
    period_start: "2026-04-01",
    period_end: "2026-04-30",
    status: "pm_review",
    revision_number: 0,
    original_contract_sum: 482_000_000,
    net_change_orders: 28_500_000,
    contract_sum_to_date: 510_500_000,
    total_completed_to_date: 348_700_000,
    less_previous_payments: 312_400_000,
    current_payment_due: 36_300_000,
    balance_to_finish: 161_800_000,
    deposit_amount: 48_200_000,
    submitted_at: null,
    paid_at: null,
  },

  // Mangrove Cove — draw 4, approved (waiting submit)
  {
    id: "d-mangrove-cove-04",
    job_id: "j-mangrove-cove",
    draw_number: 4,
    application_date: "2026-04-25",
    period_start: "2026-04-01",
    period_end: "2026-04-30",
    status: "approved",
    revision_number: 0,
    original_contract_sum: 318_000_000,
    net_change_orders: 9_400_000,
    contract_sum_to_date: 327_400_000,
    total_completed_to_date: 168_900_000,
    less_previous_payments: 142_500_000,
    current_payment_due: 26_400_000,
    balance_to_finish: 158_500_000,
    deposit_amount: 31_800_000,
    submitted_at: null,
    paid_at: null,
  },

  // Heron Point — draw 12 of ~18, submitted
  {
    id: "d-heron-point-12",
    job_id: "j-heron-point",
    draw_number: 12,
    application_date: "2026-04-25",
    period_start: "2026-04-01",
    period_end: "2026-04-30",
    status: "submitted",
    revision_number: 0,
    original_contract_sum: 765_000_000,
    net_change_orders: 33_200_000,
    contract_sum_to_date: 798_200_000,
    total_completed_to_date: 542_300_000,
    less_previous_payments: 489_500_000,
    current_payment_due: 52_800_000,
    balance_to_finish: 255_900_000,
    deposit_amount: 76_500_000,
    submitted_at: "2026-04-26T09:00:00Z",
    paid_at: null,
  },

  // Oyster Bay — draw 6, draft
  {
    id: "d-oyster-bay-06",
    job_id: "j-oyster-bay",
    draw_number: 6,
    application_date: "2026-04-26",
    period_start: "2026-04-01",
    period_end: "2026-04-30",
    status: "draft",
    revision_number: 0,
    original_contract_sum: 612_000_000,
    net_change_orders: 26_750_000,
    contract_sum_to_date: 638_750_000,
    total_completed_to_date: 287_400_000,
    less_previous_payments: 248_900_000,
    current_payment_due: 38_500_000,
    balance_to_finish: 351_350_000,
    deposit_amount: 61_200_000,
    submitted_at: null,
    paid_at: null,
  },
];
