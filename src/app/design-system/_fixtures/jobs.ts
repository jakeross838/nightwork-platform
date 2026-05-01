// Sample jobs for the design-system playground (Stage 1.5a T19.5).
//
// Pure constants. No imports from @/lib/supabase|org|auth (per SPEC C6 / D9).
// All job names are FICTIONAL — Florida-coastal-luxury-flavored. The
// reference job for real fixtures (used in end-to-end tests + screenshots
// outside the playground) is intentionally NOT used here per SPEC D7. The
// build-time grep check rejects that name verbatim. Names below — Pelican
// Bay / Mangrove Cove / Heron Point / Tarpon Key / Oyster Bay — evoke the
// right luxury-coastal-custom-home segment without touching real Ross
// Built records.
//
// Amounts in cents per CLAUDE.md "Amounts in cents" rule.

export type SampleJob = {
  id: string;
  name: string;
  address: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  contract_type: "cost_plus" | "fixed";
  original_contract_amount: number; // cents
  current_contract_amount: number; // cents (original + approved COs)
  pm_id: string;
  status: "active" | "complete" | "warranty" | "cancelled";
  deposit_percentage: number;
  gc_fee_percentage: number;
};

export const SAMPLE_JOBS: SampleJob[] = [
  {
    id: "j-pelican-bay",
    name: "Pelican Bay Estate",
    address: "612 Bay Isles Pkwy, Longboat Key, FL 34228",
    client_name: "Sarah Reilly",
    client_email: "s.reilly@example.com",
    client_phone: "(941) 555-0211",
    contract_type: "cost_plus",
    original_contract_amount: 482_000_000, // $4.82M
    current_contract_amount: 510_500_000, // $5.105M after COs
    pm_id: "u-mark-henderson",
    status: "active",
    deposit_percentage: 0.1,
    gc_fee_percentage: 0.2,
  },
  {
    id: "j-mangrove-cove",
    name: "Mangrove Cove Residence",
    address: "1820 Casey Key Rd, Nokomis, FL 34275",
    client_name: "Daniel Whitcomb",
    client_email: "dwhitcomb@example.com",
    client_phone: "(941) 555-0276",
    contract_type: "cost_plus",
    original_contract_amount: 318_000_000, // $3.18M
    current_contract_amount: 327_400_000,
    pm_id: "u-jenna-ortiz",
    status: "active",
    deposit_percentage: 0.1,
    gc_fee_percentage: 0.2,
  },
  {
    id: "j-heron-point",
    name: "Heron Point Custom Build",
    address: "405 Bayside Pkwy, Anna Maria, FL 34216",
    client_name: "Margaret Fellowes",
    client_email: "margaret@example.com",
    client_phone: "(941) 555-0193",
    contract_type: "cost_plus",
    original_contract_amount: 765_000_000, // $7.65M
    current_contract_amount: 798_200_000,
    pm_id: "u-mark-henderson",
    status: "active",
    deposit_percentage: 0.1,
    gc_fee_percentage: 0.18, // negotiated lower fee on this contract
  },
  {
    id: "j-tarpon-key",
    name: "Tarpon Key Coastal Modern",
    address: "240 Tarpon Key Blvd, Tarpon Springs, FL 34689",
    client_name: "Jonathan Park",
    client_email: "jpark@example.com",
    client_phone: "(727) 555-0247",
    contract_type: "cost_plus",
    original_contract_amount: 256_000_000, // $2.56M
    current_contract_amount: 256_000_000,
    pm_id: "u-tessa-vance",
    status: "active",
    deposit_percentage: 0.1,
    gc_fee_percentage: 0.2,
  },
  {
    id: "j-oyster-bay",
    name: "Oyster Bay Beachfront",
    address: "8902 Manasota Key Rd, Englewood, FL 34223",
    client_name: "Rebecca & Adam Cho",
    client_email: "rcho@example.com",
    client_phone: "(941) 555-0304",
    contract_type: "cost_plus",
    original_contract_amount: 612_000_000, // $6.12M
    current_contract_amount: 638_750_000,
    pm_id: "u-jenna-ortiz",
    status: "active",
    deposit_percentage: 0.1,
    gc_fee_percentage: 0.2,
  },
];
