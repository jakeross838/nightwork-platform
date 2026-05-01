// Sample cost codes for the design-system playground (Stage 1.5a T19.5).
//
// Pure constants. No imports from @/lib/supabase|org|auth (per SPEC C6 / D9).
// Format follows Ross Built's 5-digit AIA G703 line-item structure (see
// CLAUDE.md "cost_codes" schema). All values fictional — these never tie
// back to a real org_id.

export type SampleCostCode = {
  id: string;
  code: string;
  description: string;
  category: string;
  sort_order: number;
};

export const SAMPLE_COST_CODES: SampleCostCode[] = [
  // 01xxx — Pre-construction + soft costs
  {
    id: "cc-01101",
    code: "01101",
    description: "Architectural Services",
    category: "Pre-construction",
    sort_order: 1,
  },
  {
    id: "cc-01104",
    code: "01104",
    description: "Pre-Permitting Planning Services",
    category: "Pre-construction",
    sort_order: 2,
  },
  {
    id: "cc-01201",
    code: "01201",
    description: "Engineering — Structural",
    category: "Pre-construction",
    sort_order: 3,
  },

  // 03xxx — Site logistics + utilities
  {
    id: "cc-03110",
    code: "03110",
    description: "Temporary Electric & Water",
    category: "Site logistics",
    sort_order: 4,
  },
  {
    id: "cc-03112",
    code: "03112",
    description: "Debris Removal",
    category: "Site logistics",
    sort_order: 5,
  },

  // 04xxx — Site work
  {
    id: "cc-04101",
    code: "04101",
    description: "Site Work — Clearing & Grading",
    category: "Site work",
    sort_order: 6,
  },
  {
    id: "cc-04201",
    code: "04201",
    description: "Site Work — Driveway & Hardscape",
    category: "Site work",
    sort_order: 7,
  },

  // 05xxx — Concrete + foundation
  {
    id: "cc-05101",
    code: "05101",
    description: "Concrete / Foundation",
    category: "Concrete",
    sort_order: 8,
  },
  {
    id: "cc-05201",
    code: "05201",
    description: "Concrete / Slab on Grade",
    category: "Concrete",
    sort_order: 9,
  },

  // 06xxx — Framing
  {
    id: "cc-06101",
    code: "06101",
    description: "Framing — Rough Carpentry",
    category: "Framing",
    sort_order: 10,
  },
  {
    id: "cc-06201",
    code: "06201",
    description: "Framing — Trusses",
    category: "Framing",
    sort_order: 11,
  },

  // 09xxx — Electrical
  {
    id: "cc-09101",
    code: "09101",
    description: "Electrical — Rough",
    category: "Electrical",
    sort_order: 12,
  },
  {
    id: "cc-09201",
    code: "09201",
    description: "Electrical — Trim & Finish",
    category: "Electrical",
    sort_order: 13,
  },

  // 10xxx — Plumbing
  {
    id: "cc-10101",
    code: "10101",
    description: "Plumbing — Rough",
    category: "Plumbing",
    sort_order: 14,
  },
  {
    id: "cc-10201",
    code: "10201",
    description: "Plumbing — Trim & Fixtures",
    category: "Plumbing",
    sort_order: 15,
  },

  // 12xxx — HVAC
  {
    id: "cc-12101",
    code: "12101",
    description: "HVAC — Rough & Equipment",
    category: "HVAC",
    sort_order: 16,
  },

  // 15xxx — Drywall + finishes
  {
    id: "cc-15101",
    code: "15101",
    description: "Drywall — Hang & Finish",
    category: "Finishes",
    sort_order: 17,
  },
  {
    id: "cc-15301",
    code: "15301",
    description: "Trim & Millwork",
    category: "Finishes",
    sort_order: 18,
  },
  {
    id: "cc-15401",
    code: "15401",
    description: "Cabinetry & Built-ins",
    category: "Finishes",
    sort_order: 19,
  },
  {
    id: "cc-15501",
    code: "15501",
    description: "Painting & Coatings",
    category: "Finishes",
    sort_order: 20,
  },
];
