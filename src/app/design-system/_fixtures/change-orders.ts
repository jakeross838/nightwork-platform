// Sample change orders for the design-system playground (Stage 1.5a T19.5).
//
// Pure constants. No imports from @/lib/supabase|org|auth (per SPEC C6 / D9).
// References job IDs from jobs.ts. Amounts in cents. Per CLAUDE.md
// "change_orders" schema — maps to the PCCO Log sheet.

export type SampleChangeOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "executed"
  | "void";

export type SampleChangeOrder = {
  id: string;
  job_id: string;
  pcco_number: number; // sequential per job
  description: string;
  amount: number; // cents (excluding GC fee)
  gc_fee_amount: number; // cents
  gc_fee_rate: number; // decimal — 0.18 / 0.20 / 0 etc.
  total_with_fee: number; // cents
  estimated_days_added: number;
  status: SampleChangeOrderStatus;
  approved_date: string | null; // YYYY-MM-DD
  draw_number: number | null; // which draw billed
};

export const SAMPLE_CHANGE_ORDERS: SampleChangeOrder[] = [
  // Pelican Bay — CO 1: pool spec upgrade, executed in draw 6
  {
    id: "co-pelican-bay-01",
    job_id: "j-pelican-bay",
    pcco_number: 1,
    description: "Pool — upgrade to PebbleTec finish + extend deck 4ft",
    amount: 18_500_000,
    gc_fee_amount: 3_700_000,
    gc_fee_rate: 0.2,
    total_with_fee: 22_200_000,
    estimated_days_added: 14,
    status: "executed",
    approved_date: "2026-01-12",
    draw_number: 6,
  },

  // Pelican Bay — CO 2: kitchen reconfig, executed in draw 7
  {
    id: "co-pelican-bay-02",
    job_id: "j-pelican-bay",
    pcco_number: 2,
    description: "Kitchen — reconfigure island, add wine fridge alcove",
    amount: 5_250_000,
    gc_fee_amount: 1_050_000,
    gc_fee_rate: 0.2,
    total_with_fee: 6_300_000,
    estimated_days_added: 7,
    status: "executed",
    approved_date: "2026-02-08",
    draw_number: 7,
  },

  // Mangrove Cove — CO 1: HVAC upgrade, approved
  {
    id: "co-mangrove-cove-01",
    job_id: "j-mangrove-cove",
    pcco_number: 1,
    description: "HVAC — upgrade to high-efficiency variable speed system",
    amount: 7_840_000,
    gc_fee_amount: 1_568_000,
    gc_fee_rate: 0.2,
    total_with_fee: 9_408_000,
    estimated_days_added: 5,
    status: "approved",
    approved_date: "2026-03-22",
    draw_number: null,
  },

  // Heron Point — CO 1: garage extension, executed in draw 11
  {
    id: "co-heron-point-01",
    job_id: "j-heron-point",
    pcco_number: 1,
    description: "Garage — extend bay 3 by 6ft for boat clearance",
    amount: 21_500_000,
    gc_fee_amount: 3_870_000,
    gc_fee_rate: 0.18, // negotiated lower fee on this contract
    total_with_fee: 25_370_000,
    estimated_days_added: 21,
    status: "executed",
    approved_date: "2026-02-14",
    draw_number: 11,
  },

  // Oyster Bay — CO 1: dock + boat lift, pending approval
  {
    id: "co-oyster-bay-01",
    job_id: "j-oyster-bay",
    pcco_number: 1,
    description: "Marine — extend dock 12ft + add 10K lb boat lift",
    amount: 22_300_000,
    gc_fee_amount: 4_460_000,
    gc_fee_rate: 0.2,
    total_with_fee: 26_760_000,
    estimated_days_added: 30,
    status: "pending_approval",
    approved_date: null,
    draw_number: null,
  },
];
