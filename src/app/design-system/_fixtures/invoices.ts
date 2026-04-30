// Sample invoices for the design-system playground (Stage 1.5a T19.5).
//
// Pure constants. No imports from @/lib/supabase|org|auth (per SPEC C6 / D9).
// References the vendor / job / cost-code IDs from the sibling fixture
// files. Mix of: progress / time_and_materials / lump_sum types,
// confidence scores spanning the routing thresholds (0.65-0.99 range —
// crosses the 70% and 85% bands), and statuses across the workflow.
//
// Amounts in cents per CLAUDE.md "Amounts in cents" rule.

export type SampleInvoiceType = "progress" | "time_and_materials" | "lump_sum";

export type SampleInvoiceStatus =
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

export type SampleInvoiceLineItem = {
  description: string;
  date: string | null; // YYYY-MM-DD
  qty: number | null;
  unit: string | null;
  rate: number | null; // dollars
  amount: number; // cents
};

export type SampleInvoice = {
  id: string;
  vendor_id: string;
  job_id: string;
  cost_code_id: string | null;
  po_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null; // YYYY-MM-DD
  description: string;
  invoice_type: SampleInvoiceType;
  total_amount: number; // cents
  confidence_score: number; // 0-1
  confidence_details: {
    vendor_name: number;
    invoice_number: number;
    total_amount: number;
    job_reference: number;
    cost_code_suggestion: number;
  };
  status: SampleInvoiceStatus;
  received_date: string; // YYYY-MM-DD
  payment_date: string | null; // YYYY-MM-DD
  line_items: SampleInvoiceLineItem[];
  flags: string[];
};

export const SAMPLE_INVOICES: SampleInvoice[] = [
  // 1 — High confidence (0.97), progress, pm_approved, clean PDF style
  {
    id: "inv-001",
    vendor_id: "v-bayside-plumbing",
    job_id: "j-pelican-bay",
    cost_code_id: "cc-10101",
    po_id: "po-001",
    invoice_number: "BAY-2026-04-0117",
    invoice_date: "2026-04-22",
    description: "Plumbing rough-in — first floor, master suite + kitchen",
    invoice_type: "progress",
    total_amount: 1_860_000, // $18,600
    confidence_score: 0.97,
    confidence_details: {
      vendor_name: 0.99,
      invoice_number: 0.97,
      total_amount: 0.99,
      job_reference: 0.95,
      cost_code_suggestion: 0.94,
    },
    status: "pm_approved",
    received_date: "2026-04-22",
    payment_date: "2026-04-30",
    line_items: [
      {
        description: "Rough-in plumbing — Phase 2 progress (40%)",
        date: null,
        qty: null,
        unit: null,
        rate: null,
        amount: 1_860_000,
      },
    ],
    flags: [],
  },

  // 2 — Mid confidence (0.78), T&M, pm_review, daily labor entries
  {
    id: "inv-002",
    vendor_id: "v-coastal-carpentry",
    job_id: "j-pelican-bay",
    cost_code_id: "cc-06101",
    po_id: null,
    invoice_number: "CC-04-22B",
    invoice_date: "2026-04-22",
    description: "Framing — week ending 04/19, T&M",
    invoice_type: "time_and_materials",
    total_amount: 2_472_500, // $24,725
    confidence_score: 0.78,
    confidence_details: {
      vendor_name: 0.95,
      invoice_number: 0.74,
      total_amount: 0.92,
      job_reference: 0.69,
      cost_code_suggestion: 0.61,
    },
    status: "pm_review",
    received_date: "2026-04-22",
    payment_date: null,
    line_items: [
      {
        description: "Lead carpenter — site supervision",
        date: "2026-04-15",
        qty: 8,
        unit: "hours",
        rate: 95,
        amount: 76_000,
      },
      {
        description: "Crew of 4 — exterior wall framing",
        date: "2026-04-15",
        qty: 32,
        unit: "hours",
        rate: 65,
        amount: 208_000,
      },
      {
        description: "Crew of 4 — exterior wall framing",
        date: "2026-04-16",
        qty: 32,
        unit: "hours",
        rate: 65,
        amount: 208_000,
      },
      {
        description: "Crew of 4 — interior partitions",
        date: "2026-04-17",
        qty: 28,
        unit: "hours",
        rate: 65,
        amount: 182_000,
      },
      {
        description: "Lumber pull — second story plates",
        date: "2026-04-18",
        qty: null,
        unit: null,
        rate: null,
        amount: 1_798_500,
      },
    ],
    flags: ["job_reference_low_confidence"],
  },

  // 3 — Low confidence (0.66), lump sum, ai_processed (Diane triages first)
  {
    id: "inv-003",
    vendor_id: "v-pelican-drywall",
    job_id: "j-mangrove-cove",
    cost_code_id: null,
    po_id: null,
    invoice_number: null, // some vendors omit
    invoice_date: "2026-04-19",
    description: "Drywall hang & finish — full house, Mangrove Cove",
    invoice_type: "lump_sum",
    total_amount: 4_125_000, // $41,250
    confidence_score: 0.66,
    confidence_details: {
      vendor_name: 0.92,
      invoice_number: 0.0,
      total_amount: 0.95,
      job_reference: 0.55,
      cost_code_suggestion: 0.48,
    },
    status: "ai_processed",
    received_date: "2026-04-21",
    payment_date: null,
    line_items: [
      {
        description: "Drywall hang & finish — full house",
        date: null,
        qty: null,
        unit: null,
        rate: null,
        amount: 4_125_000,
      },
    ],
    flags: ["no_invoice_number", "cost_code_unclear"],
  },

  // 4 — High confidence, lump sum, qa_review (Diane post-PM)
  {
    id: "inv-004",
    vendor_id: "v-sunrise-electric",
    job_id: "j-heron-point",
    cost_code_id: "cc-09101",
    po_id: "po-002",
    invoice_number: "SES-26-0411",
    invoice_date: "2026-04-11",
    description: "Electrical rough — first + second floor",
    invoice_type: "progress",
    total_amount: 3_240_000, // $32,400
    confidence_score: 0.93,
    confidence_details: {
      vendor_name: 0.99,
      invoice_number: 0.94,
      total_amount: 0.99,
      job_reference: 0.91,
      cost_code_suggestion: 0.88,
    },
    status: "qa_review",
    received_date: "2026-04-13",
    payment_date: "2026-04-30",
    line_items: [
      {
        description: "Electrical rough — Phase 1 (35% complete)",
        date: null,
        qty: null,
        unit: null,
        rate: null,
        amount: 3_240_000,
      },
    ],
    flags: [],
  },

  // 5 — High, progress, paid — final state
  {
    id: "inv-005",
    vendor_id: "v-shoreline-concrete",
    job_id: "j-pelican-bay",
    cost_code_id: "cc-05101",
    po_id: "po-003",
    invoice_number: "SC-2026-0382",
    invoice_date: "2026-03-08",
    description: "Foundation pour — slab on grade + footings",
    invoice_type: "progress",
    total_amount: 8_750_000, // $87,500
    confidence_score: 0.98,
    confidence_details: {
      vendor_name: 0.99,
      invoice_number: 0.98,
      total_amount: 0.99,
      job_reference: 0.99,
      cost_code_suggestion: 0.95,
    },
    status: "paid",
    received_date: "2026-03-08",
    payment_date: "2026-03-15",
    line_items: [
      {
        description: "Slab on grade — 6,200 SF",
        date: null,
        qty: 6200,
        unit: "sqft",
        rate: 12.5,
        amount: 7_750_000,
      },
      {
        description: "Footings — perimeter + interior",
        date: null,
        qty: null,
        unit: null,
        rate: null,
        amount: 1_000_000,
      },
    ],
    flags: [],
  },

  // 6 — Mid, progress, in_draw (compiled into draw 8)
  {
    id: "inv-006",
    vendor_id: "v-mangrove-hvac",
    job_id: "j-mangrove-cove",
    cost_code_id: "cc-12101",
    po_id: "po-004",
    invoice_number: "MHM-2604",
    invoice_date: "2026-04-05",
    description: "HVAC equipment + rough-in — phase 1",
    invoice_type: "progress",
    total_amount: 4_540_000, // $45,400
    confidence_score: 0.81,
    confidence_details: {
      vendor_name: 0.96,
      invoice_number: 0.78,
      total_amount: 0.99,
      job_reference: 0.83,
      cost_code_suggestion: 0.71,
    },
    status: "in_draw",
    received_date: "2026-04-05",
    payment_date: "2026-04-15",
    line_items: [
      {
        description: "Trane condensers (3) + air handlers (3)",
        date: null,
        qty: null,
        unit: null,
        rate: null,
        amount: 3_280_000,
      },
      {
        description: "Rough-in labor — first floor",
        date: null,
        qty: null,
        unit: null,
        rate: null,
        amount: 1_260_000,
      },
    ],
    flags: [],
  },

  // 7 — Low, lump sum, pm_held (waiting on PM clarification)
  {
    id: "inv-007",
    vendor_id: "v-osprey-painting",
    job_id: "j-tarpon-key",
    cost_code_id: null,
    po_id: null,
    invoice_number: "OPC-INV-2026-91",
    invoice_date: "2026-04-25",
    description: "Exterior paint — full house",
    invoice_type: "lump_sum",
    total_amount: 1_185_000, // $11,850
    confidence_score: 0.69,
    confidence_details: {
      vendor_name: 0.91,
      invoice_number: 0.84,
      total_amount: 0.97,
      job_reference: 0.62,
      cost_code_suggestion: 0.5,
    },
    status: "pm_held",
    received_date: "2026-04-26",
    payment_date: null,
    line_items: [
      {
        description: "Exterior paint — body + trim + accent",
        date: null,
        qty: null,
        unit: null,
        rate: null,
        amount: 1_185_000,
      },
    ],
    flags: ["job_reference_low_confidence", "scope_unclear"],
  },

  // 8 — High, lump sum, qa_approved (Diane finished QA)
  {
    id: "inv-008",
    vendor_id: "v-tarpon-cabinets",
    job_id: "j-heron-point",
    cost_code_id: "cc-15401",
    po_id: "po-005",
    invoice_number: "TCC-2026-0147",
    invoice_date: "2026-04-01",
    description: "Custom cabinetry — kitchen + master bath, deposit invoice",
    invoice_type: "lump_sum",
    total_amount: 9_650_000, // $96,500
    confidence_score: 0.92,
    confidence_details: {
      vendor_name: 0.97,
      invoice_number: 0.93,
      total_amount: 0.99,
      job_reference: 0.91,
      cost_code_suggestion: 0.86,
    },
    status: "qa_approved",
    received_date: "2026-04-01",
    payment_date: "2026-04-15",
    line_items: [
      {
        description: "Kitchen — 22 cabinets, custom inset, walnut",
        date: null,
        qty: null,
        unit: null,
        rate: null,
        amount: 6_400_000,
      },
      {
        description: "Master bath — 8 cabinets, custom, white oak",
        date: null,
        qty: null,
        unit: null,
        rate: null,
        amount: 3_250_000,
      },
    ],
    flags: [],
  },

  // 9 — Mid, T&M, qa_kicked_back (back to PM)
  {
    id: "inv-009",
    vendor_id: "v-redfish-trim",
    job_id: "j-oyster-bay",
    cost_code_id: "cc-15301",
    po_id: null,
    invoice_number: "RFT-04-21",
    invoice_date: "2026-04-21",
    description: "Trim install — week ending 04/19",
    invoice_type: "time_and_materials",
    total_amount: 825_000, // $8,250
    confidence_score: 0.74,
    confidence_details: {
      vendor_name: 0.94,
      invoice_number: 0.69,
      total_amount: 0.91,
      job_reference: 0.71,
      cost_code_suggestion: 0.65,
    },
    status: "qa_kicked_back",
    received_date: "2026-04-22",
    payment_date: null,
    line_items: [
      {
        description: "Lead trim carpenter",
        date: "2026-04-15",
        qty: 24,
        unit: "hours",
        rate: 85,
        amount: 204_000,
      },
      {
        description: "Apprentice — assist",
        date: "2026-04-15",
        qty: 32,
        unit: "hours",
        rate: 45,
        amount: 144_000,
      },
      {
        description: "Crown molding stock",
        date: null,
        qty: null,
        unit: null,
        rate: null,
        amount: 477_000,
      },
    ],
    flags: ["math_mismatch_minor"],
  },

  // 10 — High, lump sum, received (just arrived, AI not run yet)
  {
    id: "inv-010",
    vendor_id: "v-gulfside-architects",
    job_id: "j-tarpon-key",
    cost_code_id: "cc-01101",
    po_id: null,
    invoice_number: "GA-26-0408",
    invoice_date: "2026-04-08",
    description: "Architectural services — schematic design, construction docs",
    invoice_type: "lump_sum",
    total_amount: 1_525_000, // $15,250
    confidence_score: 0.95,
    confidence_details: {
      vendor_name: 0.99,
      invoice_number: 0.96,
      total_amount: 0.99,
      job_reference: 0.92,
      cost_code_suggestion: 0.93,
    },
    status: "received",
    received_date: "2026-04-29",
    payment_date: null,
    line_items: [
      {
        description: "Construction documents — final set",
        date: null,
        qty: null,
        unit: null,
        rate: null,
        amount: 1_525_000,
      },
    ],
    flags: [],
  },

  // 11 — Low (0.71), progress, ai_processed
  {
    id: "inv-011",
    vendor_id: "v-coastal-carpentry",
    job_id: "j-mangrove-cove",
    cost_code_id: null,
    po_id: null,
    invoice_number: null,
    invoice_date: "2026-04-23",
    description: "Framing — Mangrove Cove second floor progress",
    invoice_type: "progress",
    total_amount: 1_984_000, // $19,840
    confidence_score: 0.71,
    confidence_details: {
      vendor_name: 0.96,
      invoice_number: 0.0,
      total_amount: 0.95,
      job_reference: 0.7,
      cost_code_suggestion: 0.62,
    },
    status: "ai_processed",
    received_date: "2026-04-25",
    payment_date: null,
    line_items: [
      {
        description: "Second floor framing — 60% progress",
        date: null,
        qty: null,
        unit: null,
        rate: null,
        amount: 1_984_000,
      },
    ],
    flags: ["no_invoice_number", "cost_code_unclear"],
  },

  // 12 — High, progress, pushed_to_qb
  {
    id: "inv-012",
    vendor_id: "v-bayside-plumbing",
    job_id: "j-oyster-bay",
    cost_code_id: "cc-10201",
    po_id: "po-006",
    invoice_number: "BAY-2026-04-0142",
    invoice_date: "2026-04-18",
    description: "Plumbing trim — fixtures install + final hookup",
    invoice_type: "progress",
    total_amount: 1_240_000, // $12,400
    confidence_score: 0.96,
    confidence_details: {
      vendor_name: 0.99,
      invoice_number: 0.97,
      total_amount: 0.99,
      job_reference: 0.96,
      cost_code_suggestion: 0.91,
    },
    status: "pushed_to_qb",
    received_date: "2026-04-19",
    payment_date: "2026-04-30",
    line_items: [
      {
        description: "Trim — kitchen + 4 baths",
        date: null,
        qty: null,
        unit: null,
        rate: null,
        amount: 1_240_000,
      },
    ],
    flags: [],
  },
];
