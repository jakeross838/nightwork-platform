---
phase: stage-1.5b-prototype-gallery
plan: 1
type: execute
wave: 0
depends_on: []
files_modified:
  - scripts/sanitize-drummond.ts
  - src/app/design-system/_fixtures/drummond/types.ts
  - src/app/design-system/_fixtures/drummond/index.ts
  - src/app/design-system/_fixtures/drummond/jobs.ts
  - src/app/design-system/_fixtures/drummond/vendors.ts
  - src/app/design-system/_fixtures/drummond/cost-codes.ts
  - src/app/design-system/_fixtures/drummond/invoices.ts
  - src/app/design-system/_fixtures/drummond/draws.ts
  - src/app/design-system/_fixtures/drummond/draw-line-items.ts
  - src/app/design-system/_fixtures/drummond/change-orders.ts
  - src/app/design-system/_fixtures/drummond/budget.ts
  - src/app/design-system/_fixtures/drummond/lien-releases.ts
  - src/app/design-system/_fixtures/drummond/schedule.ts
  - src/app/design-system/_fixtures/drummond/payments.ts
  - src/app/design-system/_fixtures/drummond/reconciliation.ts
  - src/app/design-system/prototypes/layout.tsx
  - src/app/design-system/prototypes/page.tsx
  - .github/workflows/drummond-grep-check.yml
autonomous: false
halt_after: true
threat_model_severity: medium
requirements: []
must_haves:
  truths:
    - "Sanitize script reads SUBSTITUTION-MAP.md, applies substitutions, writes 11 sanitized fixture files"
    - "All 11 fixture files exist as static const exports under src/app/design-system/_fixtures/drummond/"
    - "Build-time grep gate (extractor-side) rejects sanitized output if any real Drummond identifier survives"
    - "CI workflow grep-checks committed fixtures for ~17-20 high-risk identifiers"
    - "prototypes/layout.tsx forces data-direction=C and data-palette=B (Site Office + Set B locked)"
    - "prototypes/page.tsx index renders 10 prototype links in Card grid using design tokens only"
    - "npm run build passes with the new fixture barrel"
    - "Halt point reached: Jake reviews sanitized output before any prototype rendering begins"
  artifacts:
    - path: "scripts/sanitize-drummond.ts"
      provides: "exceljs read + substitution apply + grep gate + TS file write pipeline"
      contains: "import ExcelJS"
    - path: "src/app/design-system/_fixtures/drummond/types.ts"
      provides: "DrummondJob, DrummondVendor, DrummondCostCode, DrummondInvoice, DrummondDraw, DrummondDrawLineItem, DrummondChangeOrder, DrummondBudgetLine, DrummondLienRelease, DrummondScheduleItem, DrummondPayment, DrummondReconciliationPair type exports"
      exports: ["DrummondJob", "DrummondVendor", "DrummondCostCode", "DrummondInvoice", "DrummondDraw", "DrummondDrawLineItem", "DrummondChangeOrder", "DrummondBudgetLine", "DrummondLienRelease", "DrummondScheduleItem", "DrummondPayment", "DrummondReconciliationPair"]
    - path: "src/app/design-system/_fixtures/drummond/index.ts"
      provides: "Barrel re-export of all 11 fixture files"
      contains: "export *"
    - path: "src/app/design-system/_fixtures/drummond/jobs.ts"
      provides: "DRUMMOND_JOBS const array (1 entry — Caldwell at 712 Pine Ave)"
      contains: "DRUMMOND_JOBS"
    - path: "src/app/design-system/_fixtures/drummond/vendors.ts"
      provides: "DRUMMOND_VENDORS const array (17 entries — 14 substituted + 3 NO-SUB)"
      contains: "DRUMMOND_VENDORS"
    - path: "src/app/design-system/_fixtures/drummond/invoices.ts"
      provides: "DRUMMOND_INVOICES const array (>=4 invoices spanning workflow statuses; 3 format types)"
      contains: "DRUMMOND_INVOICES"
    - path: "src/app/design-system/_fixtures/drummond/draws.ts"
      provides: "DRUMMOND_DRAWS const array (5 historical pay apps, Pay App 5 canonical)"
      contains: "DRUMMOND_DRAWS"
    - path: "src/app/design-system/_fixtures/drummond/budget.ts"
      provides: "DRUMMOND_BUDGET_LINES const array (>=25 line items)"
      contains: "DRUMMOND_BUDGET_LINES"
    - path: "src/app/design-system/_fixtures/drummond/lien-releases.ts"
      provides: "DRUMMOND_LIEN_RELEASES const array (Florida 4-statute types)"
      contains: "DRUMMOND_LIEN_RELEASES"
    - path: "src/app/design-system/_fixtures/drummond/schedule.ts"
      provides: "DRUMMOND_SCHEDULE_ITEMS const array (>=20 tasks, 6+ month timeline, milestones)"
      contains: "DRUMMOND_SCHEDULE_ITEMS"
    - path: "src/app/design-system/_fixtures/drummond/reconciliation.ts"
      provides: "DRUMMOND_RECONCILIATION_PAIRS const array (8 pairs = 4 candidates × 2 drift types)"
      contains: "DRUMMOND_RECONCILIATION_PAIRS"
    - path: "src/app/design-system/prototypes/layout.tsx"
      provides: "Direction/palette lock for all prototype routes (data-direction=C, data-palette=B)"
      contains: "data-direction=\"C\""
    - path: "src/app/design-system/prototypes/page.tsx"
      provides: "Index landing page for /design-system/prototypes/ with 10 Card links"
      exports: ["default"]
    - path: ".github/workflows/drummond-grep-check.yml"
      provides: "CI grep gate against committed sanitized fixtures (defense-in-depth)"
      contains: "actions/checkout@v4"
  key_links:
    - from: "scripts/sanitize-drummond.ts"
      to: ".planning/fixtures/drummond/SUBSTITUTION-MAP.md (gitignored)"
      via: "fs.readFileSync of SUBSTITUTION-MAP.md path"
      pattern: "readFileSync.*SUBSTITUTION-MAP"
    - from: "scripts/sanitize-drummond.ts"
      to: ".planning/fixtures/drummond/source3-downloads/*.xlsx"
      via: "ExcelJS.Workbook().xlsx.readFile()"
      pattern: "wb\\.xlsx\\.readFile"
    - from: "scripts/sanitize-drummond.ts"
      to: "src/app/design-system/_fixtures/drummond/*.ts"
      via: "fs.writeFileSync of sanitized const arrays"
      pattern: "writeFileSync.*_fixtures/drummond"
    - from: "src/app/design-system/_fixtures/drummond/index.ts"
      to: "all 11 sibling fixture files"
      via: "export * from './<entity>'"
      pattern: "export \\* from"
    - from: "src/app/design-system/prototypes/layout.tsx"
      to: ".design-system-scope CSS class (design-system.css)"
      via: "div className=\"design-system-scope\""
      pattern: "design-system-scope"
    - from: ".github/workflows/drummond-grep-check.yml"
      to: "src/app/design-system/_fixtures/drummond/"
      via: "git grep -E pattern in fixture path"
      pattern: "git grep"
---

<objective>
Drummond fixture extraction (Wave 0). Build the sanitization pipeline + write all 11 sanitized fixture files + scaffold the prototypes/ route shell + add the CI grep gate. **HARD HALT after completion** — Jake reviews sanitized output before any prototype rendering begins (per D-23 / R1 hard halt rule).

This plan is the foundation everything else depends on. Get it right.

Purpose: Every downstream prototype reads from `src/app/design-system/_fixtures/drummond/`. If the fixtures are wrong (real names leak, types misaligned, line item counts insufficient for stress tests), every Wave 1 plan inherits the bug. Halting here ensures Jake can verify sanitized output integrity before 8+ prototype routes get built on top.

Output:
- 1 sanitization script (`scripts/sanitize-drummond.ts`)
- 11 fixture files + types.ts + index.ts barrel under `src/app/design-system/_fixtures/drummond/`
- `prototypes/layout.tsx` forcing `data-direction="C" data-palette="B"`
- `prototypes/page.tsx` index landing
- `.github/workflows/drummond-grep-check.yml` (first GitHub Actions workflow in repo)
- HALT signal to Jake
</objective>

<execution_context>
@C:/Users/Jake/nightwork-platform/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Jake/nightwork-platform/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/stage-1.5b-prototype-gallery/CONTEXT.md
@.planning/phases/stage-1.5b-prototype-gallery/PATTERNS.md
@.planning/expansions/stage-1.5b-prototype-gallery-EXPANDED-SCOPE.md
@.planning/fixtures/drummond/SUBSTITUTION-MAP.md
@CLAUDE.md
@.planning/design/SYSTEM.md
@.planning/design/CHOSEN-DIRECTION.md
@src/app/design-system/_fixtures/index.ts
@src/app/design-system/_fixtures/jobs.ts
@src/app/design-system/_fixtures/vendors.ts
@src/app/design-system/_fixtures/cost-codes.ts
@src/app/design-system/_fixtures/invoices.ts
@src/app/design-system/_fixtures/draws.ts
@src/app/design-system/_fixtures/change-orders.ts
@src/app/design-system/_components/DirectionPaletteShell.tsx
@src/app/design-system/layout.tsx
@src/app/design-system/page.tsx
@src/app/design-system/design-system.css
@scripts/inspect-xlsx.mjs
@.claude/hooks/nightwork-post-edit.sh

<interfaces>
<!-- Locked substitutions from SUBSTITUTION-MAP.md (gitignored). The
     extractor reads this map; the CI workflow has a hardcoded subset for
     defense-in-depth. -->

Owner surname:        Drummond  → Caldwell
Site address:         501 74th Street, Holmes Beach FL 34217  → 712 Pine Ave, Anna Maria FL 34216
Job code:             GC0525  → GC0501
Vendor mappings (17 entries — 14 substituted + 3 NO-SUB):
  SmartShield Homes              → Coastal Smart Systems LLC
  Florida Sunshine Carpentry     → Bay Region Carpentry Inc
  Doug Naeher Drywall            → Sandhill Drywall Inc
  Paradise Foam                  → Coastline Foam LLC
  Banko (Banko Overhead Doors)   → Bayside Doors Inc
  WG Drywall                     → Coastal Finishes LLC
  Loftin Plumbing                → Anchor Bay Plumbing Inc
  Island Lumber                  → Sun Coast Lumber Co
  Ferguson                       → NO-SUB (national chain)
  CoatRite                       → Tide Mark Coatings LLC
  Ecosouth                       → Manatee Eco Co
  MJ Florida                     → MJ Bay Co
  Rangel Tile                    → Sand Dollar Tile Co
  TNT Painting                   → Bayside Painting LLC
  FPL                            → NO-SUB (public utility)
  Home Depot                     → NO-SUB (national chain)
  Avery Roofing                  → (NEW SUB — read SUBSTITUTION-MAP.md for locked value)
  ML Concrete LLC                → Bay Region Concrete Co

<!-- Existing fixture type shapes (analogs in src/app/design-system/_fixtures/).
     Drummond types EXTEND these patterns — same fields, "Drummond*" prefix,
     "DRUMMOND_*" const naming. -->

From src/app/design-system/_fixtures/jobs.ts (analog SampleJob shape):
  type SampleJob = {
    id: string;                    // job ID, e.g. "j-pelican-bay"
    name: string;
    address: string;
    client_name: string;
    client_email: string;
    client_phone: string;
    contract_type: "cost_plus" | "fixed";
    original_contract_amount: number;  // cents
    current_contract_amount: number;   // cents (original + approved COs)
    pm_id: string;
    status: "active" | "complete" | "warranty" | "cancelled";
    deposit_percentage: number;
    gc_fee_percentage: number;
  };

From src/app/design-system/_fixtures/vendors.ts (analog SampleVendor shape):
  type SampleVendor = {
    id: string;
    name: string;
    address: string;
    phone: string;
    email: string;
    default_cost_code_id: string | null;
  };

From src/app/design-system/_fixtures/invoices.ts (analog SampleInvoice shape — DrummondInvoice MAY add original_file_url + co_id):
  type SampleInvoice = {
    id: string;
    vendor_id: string;
    job_id: string;
    cost_code_id: string | null;
    po_id: string | null;
    invoice_number: string | null;
    invoice_date: string | null;
    description: string;
    invoice_type: "progress" | "time_and_materials" | "lump_sum";
    total_amount: number;          // cents
    confidence_score: number;      // 0-1
    confidence_details: { vendor_name: number; invoice_number: number; total_amount: number; job_reference: number; cost_code_suggestion: number };
    status: "received" | "ai_processed" | "pm_review" | "pm_approved" | "pm_held" | "pm_denied" | "qa_review" | "qa_approved" | "qa_kicked_back" | "pushed_to_qb" | "in_draw" | "paid";
    received_date: string;
    payment_date: string | null;
    line_items: Array<{ description: string; date: string | null; qty: number | null; unit: string | null; rate: number | null; amount: number }>;
    flags: string[];
  };

From src/app/design-system/_fixtures/draws.ts (analog SampleDraw shape — DrummondDraw matches verbatim):
  type SampleDraw = {
    id: string;
    job_id: string;
    draw_number: number;
    application_date: string;
    period_start: string;
    period_end: string;
    status: "draft" | "pm_review" | "approved" | "submitted" | "paid" | "void";
    revision_number: number;
    original_contract_sum: number;     // cents
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

From src/app/design-system/_fixtures/change-orders.ts (analog SampleChangeOrder shape):
  type SampleChangeOrder = {
    id: string;
    job_id: string;
    pcco_number: number;
    description: string;
    amount: number;            // cents (excluding GC fee)
    gc_fee_amount: number;
    gc_fee_rate: number;
    total_with_fee: number;
    estimated_days_added: number;
    status: "draft" | "pending_approval" | "approved" | "executed" | "void";
    approved_date: string | null;
    draw_number: number | null;
  };

<!-- New types per CONTEXT D-05/D-11 — no playground analog -->

DrummondBudgetLine (per CONTEXT D-05; computed fields LEFT OFF the type per R.2):
  type DrummondBudgetLine = {
    id: string;
    job_id: string;
    cost_code_id: string;
    original_estimate: number;    // cents
    revised_estimate: number;     // cents (original + approved COs)
  };

DrummondDrawLineItem (1 per cost code per draw — 20-50 rows per pay app):
  type DrummondDrawLineItem = {
    id: string;
    draw_id: string;
    budget_line_id: string;
    cost_code_id: string;
    previous_applications: number;  // cents
    this_period: number;
    total_to_date: number;
    percent_complete: number;       // 0-1
    balance_to_finish: number;
  };

DrummondLienRelease (Florida 4-statute types; status_history JSONB column missing per F1 gap #7):
  type DrummondLienReleaseType =
    | "conditional_progress"        // Florida statute 713.20(2)(a)
    | "unconditional_progress"      // Florida statute 713.20(2)(c)
    | "conditional_final"           // Florida statute 713.20(2)(b)
    | "unconditional_final";        // Florida statute 713.20(2)(d)
  type DrummondLienReleaseStatus = "not_required" | "pending" | "received" | "waived";
  type DrummondLienRelease = {
    id: string;
    job_id: string;
    vendor_id: string;
    invoice_id: string;
    draw_id: string | null;
    release_type: DrummondLienReleaseType;
    status: DrummondLienReleaseStatus;
    release_date: string | null;
    amount_through: number;        // cents
  };

DrummondScheduleItem (per CONTEXT D-11 — 1.5b proposed, F1 may revise):
  type DrummondScheduleStatus = "not_started" | "in_progress" | "complete" | "blocked";
  type DrummondScheduleItem = {
    id: string;
    job_id: string;
    name: string;
    start_date: string;            // ISO date
    end_date: string;              // ISO date
    predecessor_ids: string[];
    parent_id?: string;            // hierarchical
    assigned_vendor_id?: string;
    percent_complete: number;      // 0-1
    status: DrummondScheduleStatus;
    is_milestone: boolean;         // pay app dates render as diamonds
  };

DrummondPayment (inferred from invoice fields per CURRENT-STATE A.2):
  type DrummondPayment = {
    id: string;
    invoice_id: string;
    job_id: string;
    vendor_id: string;
    amount: number;                // cents
    check_number: string | null;
    payment_date: string;          // computed via Ross Built rule
    picked_up: boolean;
    picked_up_at: string | null;
  };

DrummondReconciliationPair (per CONTEXT D-09 — paired imported/current):
  type DrummondReconciliationDriftType = "invoice_po" | "draw_budget";
  type DrummondReconciliationPair = {
    id: string;
    drift_type: DrummondReconciliationDriftType;
    imported: Record<string, unknown>;
    current:  Record<string, unknown>;
    diffs: Array<{ field: string; imported_value: unknown; current_value: unknown }>;
  };
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Sanitize script + types + barrel index</name>
  <files>scripts/sanitize-drummond.ts, src/app/design-system/_fixtures/drummond/types.ts, src/app/design-system/_fixtures/drummond/index.ts</files>

  <read_first>
    - scripts/inspect-xlsx.mjs (exceljs precedent — lines 1-27)
    - .planning/fixtures/drummond/SUBSTITUTION-MAP.md (locked substitution table — read FULL file; 17 vendors + owner + address + job code mappings)
    - src/app/design-system/_fixtures/index.ts (barrel re-export pattern; lines 1-17)
    - src/app/design-system/_fixtures/jobs.ts (full file — type + array shape)
    - src/app/design-system/_fixtures/vendors.ts (full file — type + array shape)
    - src/app/design-system/_fixtures/invoices.ts (full file — type + array shape)
    - src/app/design-system/_fixtures/draws.ts (full file — type + array shape)
    - src/app/design-system/_fixtures/change-orders.ts (full file — type + array shape)
    - src/app/design-system/_fixtures/cost-codes.ts (full file — type + array shape)
    - .planning/codebase/CONVENTIONS.md (TS strict, tsx runner)
    - .planning/codebase/STACK.md (exceljs ^4.4.0 confirmed)
    - .claude/hooks/nightwork-post-edit.sh (T10c lines 194-230 — the regex that gates _fixtures/ imports)
    - CLAUDE.md (R.2 recalculate-don't-increment + cents storage rule)
  </read_first>

  <action>
**Step A — Create `src/app/design-system/_fixtures/drummond/types.ts`:**

Single file containing ALL Drummond type definitions exported. Pattern: each type is `Drummond<Entity>` (matches PATTERNS.md analog naming). Copy these EXACT shapes (from `<interfaces>` block above):

```typescript
// Drummond fixture types — Stage 1.5b prototype gallery.
//
// Pure type-only file (no runtime values). No imports from
// @/lib/supabase|org|auth (per hook T10c sample-data isolation
// nightwork-post-edit.sh:194-230). Type-only imports from
// @/lib/supabase/types/* would be permitted but not needed here —
// fixture types are self-contained.
//
// Per CONTEXT D-05: Drummond-only types extend the existing
// playground fixture pattern with one-job-only nuance + Wave 2
// schedule + payments (projected from invoices) + reconciliation
// (paired imported/current) shapes that have no playground analog.
//
// Per R.2 / CLAUDE.md "Recalculate, don't increment" — computed
// fields (previous_applications, total_to_date, percent_complete,
// balance_to_finish) are LEFT OFF DrummondBudgetLine and computed
// on-render in prototype pages.

export type DrummondJob = {
  id: string;
  name: string;
  address: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  contract_type: "cost_plus" | "fixed";
  original_contract_amount: number;  // cents
  current_contract_amount: number;
  pm_id: string;
  status: "active" | "complete" | "warranty" | "cancelled";
  deposit_percentage: number;
  gc_fee_percentage: number;
};

export type DrummondVendor = {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  default_cost_code_id: string | null;
};

export type DrummondCostCode = {
  id: string;
  code: string;        // 5-digit, e.g. "01101"
  description: string;
  category: string;
  sort_order: number;
};

export type DrummondInvoiceType = "progress" | "time_and_materials" | "lump_sum";

export type DrummondInvoiceStatus =
  | "received" | "ai_processed" | "pm_review" | "pm_approved" | "pm_held" | "pm_denied"
  | "qa_review" | "qa_approved" | "qa_kicked_back" | "pushed_to_qb" | "in_draw" | "paid";

export type DrummondInvoiceLineItem = {
  description: string;
  date: string | null;
  qty: number | null;
  unit: string | null;
  rate: number | null;   // dollars
  amount: number;        // cents
};

export type DrummondInvoiceConfidenceDetails = {
  vendor_name: number;
  invoice_number: number;
  total_amount: number;
  job_reference: number;
  cost_code_suggestion: number;
};

export type DrummondInvoice = {
  id: string;
  vendor_id: string;
  job_id: string;
  cost_code_id: string | null;
  po_id: string | null;
  co_id: string | null;          // link to change order if invoice is CO-driven
  invoice_number: string | null;
  invoice_date: string | null;
  description: string;
  invoice_type: DrummondInvoiceType;
  total_amount: number;           // cents
  confidence_score: number;       // 0-1
  confidence_details: DrummondInvoiceConfidenceDetails;
  status: DrummondInvoiceStatus;
  received_date: string;
  payment_date: string | null;
  draw_id: string | null;         // set when pulled into a draw
  line_items: DrummondInvoiceLineItem[];
  flags: string[];
  original_file_url: string | null; // sanitized fixture path or null
};

export type DrummondDrawStatus = "draft" | "pm_review" | "approved" | "submitted" | "paid" | "void";

export type DrummondDraw = {
  id: string;
  job_id: string;
  draw_number: number;
  application_date: string;
  period_start: string;
  period_end: string;
  status: DrummondDrawStatus;
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

export type DrummondDrawLineItem = {
  id: string;
  draw_id: string;
  budget_line_id: string;
  cost_code_id: string;
  previous_applications: number;   // cents
  this_period: number;
  total_to_date: number;
  percent_complete: number;        // 0-1
  balance_to_finish: number;
};

export type DrummondChangeOrderStatus = "draft" | "pending_approval" | "approved" | "executed" | "void";

export type DrummondChangeOrder = {
  id: string;
  job_id: string;
  pcco_number: number;
  description: string;
  amount: number;                  // cents (excluding GC fee)
  gc_fee_amount: number;
  gc_fee_rate: number;
  total_with_fee: number;
  estimated_days_added: number;
  status: DrummondChangeOrderStatus;
  approved_date: string | null;
  draw_number: number | null;
};

// Per R.2 — computed fields LEFT OFF this type. Prototype pages
// derive previous_applications / this_period / total_to_date /
// percent_complete / balance_to_finish from DRUMMOND_INVOICES on render.
export type DrummondBudgetLine = {
  id: string;
  job_id: string;
  cost_code_id: string;
  original_estimate: number;       // cents
  revised_estimate: number;        // cents (original + approved COs)
};

export type DrummondLienReleaseType =
  | "conditional_progress"         // Florida statute 713.20(2)(a)
  | "unconditional_progress"       // Florida statute 713.20(2)(c)
  | "conditional_final"            // Florida statute 713.20(2)(b)
  | "unconditional_final";         // Florida statute 713.20(2)(d)

export type DrummondLienReleaseStatus = "not_required" | "pending" | "received" | "waived";

export type DrummondLienRelease = {
  id: string;
  job_id: string;
  vendor_id: string;
  invoice_id: string;
  draw_id: string | null;
  release_type: DrummondLienReleaseType;
  status: DrummondLienReleaseStatus;
  release_date: string | null;
  amount_through: number;          // cents
};

export type DrummondScheduleStatus = "not_started" | "in_progress" | "complete" | "blocked";

export type DrummondScheduleItem = {
  id: string;
  job_id: string;
  name: string;
  start_date: string;              // ISO date
  end_date: string;                // ISO date
  predecessor_ids: string[];
  parent_id?: string;              // hierarchical tasks
  assigned_vendor_id?: string;
  percent_complete: number;        // 0-1
  status: DrummondScheduleStatus;
  is_milestone: boolean;           // pay app dates render as diamonds in Gantt
};

export type DrummondPayment = {
  id: string;
  invoice_id: string;
  job_id: string;
  vendor_id: string;
  amount: number;                  // cents
  check_number: string | null;
  payment_date: string;            // computed via Ross Built rule
  picked_up: boolean;
  picked_up_at: string | null;
};

export type DrummondReconciliationDriftType = "invoice_po" | "draw_budget";

export type DrummondReconciliationPair = {
  id: string;
  drift_type: DrummondReconciliationDriftType;
  imported: Record<string, unknown>;  // QuickBooks / external snapshot
  current:  Record<string, unknown>;  // Nightwork current state
  diffs: Array<{ field: string; imported_value: unknown; current_value: unknown }>;
};
```

**Step B — Create `src/app/design-system/_fixtures/drummond/index.ts`:**

Mirror the shape of `src/app/design-system/_fixtures/index.ts` exactly. Re-export all 11 fixture files + types:

```typescript
// Re-exports for the design-system Drummond fixtures (Stage 1.5b).
//
// Pure constants only. No imports from @/lib/supabase|org|auth (per
// hook T10c — nightwork-post-edit.sh:194-230). Consumers can do:
//
//   import { DRUMMOND_INVOICES, DRUMMOND_VENDORS } from '@/app/design-system/_fixtures/drummond';
//
// instead of reaching into individual files.
//
// Per CONTEXT D-04 — DRUMMOND_* prefix vs SAMPLE_* keeps Drummond
// fixtures separable from playground fictional fixtures during
// cross-imports.

export * from "./types";
export * from "./jobs";
export * from "./vendors";
export * from "./cost-codes";
export * from "./invoices";
export * from "./draws";
export * from "./draw-line-items";
export * from "./change-orders";
export * from "./budget";
export * from "./lien-releases";
export * from "./schedule";
export * from "./payments";
export * from "./reconciliation";
```

**Step C — Create `scripts/sanitize-drummond.ts`:**

Build the extraction + substitution + grep-gate + write pipeline. Per CONTEXT D-17 + D-18 + D-20:

- Use `exceljs` (already shipped) to read `.xlsx` files in `.planning/fixtures/drummond/source3-downloads/`.
- For `.xls` legacy files (Pay App 1, 2, 3): require pre-conversion to `.xlsx` (per D-18). The script logs an error if `.xls` files are encountered with a clear instruction to re-save them in Excel.
- For invoice PDFs: per D-17, use the Claude Code Read tool manually for 4-6 priority invoices. The script accepts a JSON file (`scripts/drummond-invoice-fields.json`) hand-curated by the executor during execute-phase as the source for invoice data.
- Read SUBSTITUTION-MAP.md from `.planning/fixtures/drummond/SUBSTITUTION-MAP.md` (gitignored). Parse the markdown tables to build a `Map<string, string>` of real → sanitized.
- For each entity (jobs, vendors, cost-codes, invoices, draws, draw-line-items, change-orders, budget, lien-releases, schedule, payments, reconciliation):
  - Extract structured data from the relevant raw file(s).
  - Apply substitutions (multi-pass: longer keys first to prevent partial-replacement bugs like substituting "501" before "501 74th").
  - Validate against grep gate: scan the sanitized in-memory data for any real-name entries from SUBSTITUTION-MAP.md keys. If ANY survive, exit 1 with file/line/value details.
  - If clean, write the corresponding `_fixtures/drummond/<entity>.ts` file with formatting matching playground analog: type imported from `./types`, const array exported, JSDoc header documenting source file + extraction date.

```typescript
#!/usr/bin/env tsx
/**
 * Sanitize Drummond raw fixtures and write sanitized TS files to
 * src/app/design-system/_fixtures/drummond/.
 *
 * Per CONTEXT D-17 / D-18 / D-20 / D-22 — two-tier grep gate.
 * This is tier 1 (extractor-side). Tier 2 is .github/workflows/drummond-grep-check.yml.
 *
 * Usage: npx tsx scripts/sanitize-drummond.ts
 *
 * Reads:
 *   - .planning/fixtures/drummond/SUBSTITUTION-MAP.md (gitignored)
 *   - .planning/fixtures/drummond/source3-downloads/*.xlsx
 *   - scripts/drummond-invoice-fields.json (hand-curated by executor; gitignored)
 *
 * Writes:
 *   - src/app/design-system/_fixtures/drummond/{jobs,vendors,...}.ts
 *
 * Halts on:
 *   - .xls legacy file encountered → "re-save as .xlsx in Excel first"
 *   - Real Drummond identifier survives substitution → fail with details
 */

import ExcelJS from "exceljs";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, ".planning/fixtures/drummond/source3-downloads");
const SUB_MAP_PATH = path.join(ROOT, ".planning/fixtures/drummond/SUBSTITUTION-MAP.md");
const INVOICE_JSON_PATH = path.join(ROOT, "scripts/drummond-invoice-fields.json");
const OUT_DIR = path.join(ROOT, "src/app/design-system/_fixtures/drummond");

// 1. Parse SUBSTITUTION-MAP.md → Map<real, sanitized>.
//    Reads the markdown tables; each row "| Real | Sanitized | Notes |" with
//    NO-SUB rows filtered out (keep real value, no substitution applied).
function loadSubstitutionMap(): Map<string, string> {
  const md = fs.readFileSync(SUB_MAP_PATH, "utf-8");
  const map = new Map<string, string>();
  // Match table rows: `| <real> | <sanitized> | ...`
  for (const line of md.split("\n")) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (!m) continue;
    const real = m[1].trim();
    const sanitized = m[2].trim();
    // Skip header rows + NO-SUB rows + parenthetical notes.
    if (real === "Real" || sanitized === "Sanitized") continue;
    if (sanitized === "NO-SUB" || sanitized.startsWith("(")) continue;
    if (real.startsWith("(") || real === "") continue;
    map.set(real, sanitized);
  }
  return map;
}

// 2. Apply substitutions to a string. Sort keys by length DESC so "501 74th
//    Street" replaces before "501" (prevents partial-match bugs).
function substitute(text: string, map: Map<string, string>): string {
  const keys = Array.from(map.keys()).sort((a, b) => b.length - a.length);
  let result = text;
  for (const k of keys) {
    result = result.replaceAll(k, map.get(k)!);
  }
  return result;
}

// 3. Grep gate — scan a value (string or recursively object/array) for any
//    real-name keys remaining. Returns array of violations.
function grepGate(value: unknown, map: Map<string, string>, path: string[] = []): Array<{path: string[], real: string, value: string}> {
  const violations: Array<{path: string[], real: string, value: string}> = [];
  if (typeof value === "string") {
    for (const real of map.keys()) {
      if (value.includes(real)) {
        violations.push({ path, real, value });
      }
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => violations.push(...grepGate(v, map, [...path, String(i)])));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      violations.push(...grepGate(v, map, [...path, k]));
    }
  }
  return violations;
}

// 4. Write a sanitized fixture file with consistent formatting.
function writeFixtureFile(filename: string, typeName: string, constName: string, items: unknown[], sourceFile: string) {
  const header = `// Sanitized Drummond fixture — generated by scripts/sanitize-drummond.ts
// Source: ${sourceFile}
// Generated: ${new Date().toISOString().slice(0, 10)}
// Substitutions applied per .planning/fixtures/drummond/SUBSTITUTION-MAP.md (gitignored)
//
// DO NOT HAND-EDIT. Re-run \`npx tsx scripts/sanitize-drummond.ts\` to regenerate.

import type { ${typeName} } from "./types";

export const ${constName}: ${typeName}[] = ${JSON.stringify(items, null, 2)};
`;
  fs.writeFileSync(path.join(OUT_DIR, filename), header);
}

// 5. Main pipeline — for each entity, extract → substitute → gate → write.
async function main() {
  const subMap = loadSubstitutionMap();
  console.log(`[sanitize-drummond] Loaded ${subMap.size} substitution entries`);

  // Verify .xls files have been re-saved as .xlsx (per D-18 pre-step).
  const rawFiles = fs.readdirSync(RAW_DIR);
  const xlsFiles = rawFiles.filter((f) => f.toLowerCase().endsWith(".xls"));
  if (xlsFiles.length > 0) {
    console.error(`[sanitize-drummond] FAIL: ${xlsFiles.length} legacy .xls file(s) found:`);
    xlsFiles.forEach((f) => console.error(`  - ${f}`));
    console.error(`[sanitize-drummond] Re-save these as .xlsx in Excel before re-running (per CONTEXT D-18).`);
    process.exit(1);
  }

  // For each entity, build extraction logic. Pseudo-pattern:
  //
  //   const rawJobs = await extractJobsFromXlsx(...);
  //   const sanitized = rawJobs.map((j) => ({
  //     ...j,
  //     name: substitute(j.name, subMap),
  //     address: substitute(j.address, subMap),
  //     client_name: substitute(j.client_name, subMap),
  //   }));
  //   const violations = grepGate(sanitized, subMap);
  //   if (violations.length > 0) { console.error(...); process.exit(1); }
  //   writeFixtureFile("jobs.ts", "DrummondJob", "DRUMMOND_JOBS", sanitized, "...");
  //
  // Detailed per-entity extraction logic — implementer decides based on
  // raw file structure discovered via inspect-xlsx.mjs runs.

  // (Implementation of extractJobsFromXlsx, extractVendorsFromInvoiceJson, etc.
  //  goes here. Each emits a list of typed objects ready for substitution +
  //  gate + write.)
}

main().catch((e) => {
  console.error("[sanitize-drummond] FAIL:", e);
  process.exit(1);
});
```

(Detailed per-entity extraction logic is the executor's implementation responsibility — patterns vary by source file structure. The script must stop and report on legacy .xls + grep-gate violations as shown.)

**Per D-19 fallback:** if manual Read for ~94 invoice PDFs is too slow, the executor populates `scripts/drummond-invoice-fields.json` with only 4-6 priority invoices manually transcribed; the remainder gets summarized line-items extracted from pay app G703 rows.
  </action>

  <verify>
    <automated>npx tsc --noEmit src/app/design-system/_fixtures/drummond/types.ts src/app/design-system/_fixtures/drummond/index.ts</automated>
    Manual checks (executor confirms):
    - `cat src/app/design-system/_fixtures/drummond/types.ts | grep -c "^export type Drummond"` returns >=12 (Job, Vendor, CostCode, Invoice + sub-types, Draw, DrawLineItem, ChangeOrder, BudgetLine, LienRelease, ScheduleItem, Payment, ReconciliationPair).
    - `cat src/app/design-system/_fixtures/drummond/index.ts | grep -c '^export \\* from'` returns 13 (types + 12 fixture files; matches list in Step B above).
    - `npx tsx scripts/sanitize-drummond.ts --help` (or running with no args) prints usage + does not crash.
    - Hook T10c does not flag the new files (no @/lib/supabase imports — verify with `grep -E '@/lib/(supabase|org|auth)' src/app/design-system/_fixtures/drummond/types.ts src/app/design-system/_fixtures/drummond/index.ts | wc -l` returns 0).
  </verify>

  <done>
    - `src/app/design-system/_fixtures/drummond/types.ts` exports all 12 Drummond types
    - `src/app/design-system/_fixtures/drummond/index.ts` re-exports all 13 sources (types + 12 fixture files)
    - `scripts/sanitize-drummond.ts` exists with exceljs read, SUBSTITUTION-MAP parser, multi-pass substitute, recursive grepGate, and writeFixtureFile helpers
    - Script halts with clear error on legacy `.xls` files
    - Script halts with violation details on real-name leak
    - TypeScript typechecks pass on the new files
    - Hook T10c silent on the new files
  </done>
</task>

<task type="auto">
  <name>Task 2: Run extractor + write 12 sanitized fixture files (jobs, vendors, cost-codes, invoices, draws, draw-line-items, change-orders, budget, lien-releases, schedule, payments, reconciliation)</name>

  <files>
    src/app/design-system/_fixtures/drummond/jobs.ts,
    src/app/design-system/_fixtures/drummond/vendors.ts,
    src/app/design-system/_fixtures/drummond/cost-codes.ts,
    src/app/design-system/_fixtures/drummond/invoices.ts,
    src/app/design-system/_fixtures/drummond/draws.ts,
    src/app/design-system/_fixtures/drummond/draw-line-items.ts,
    src/app/design-system/_fixtures/drummond/change-orders.ts,
    src/app/design-system/_fixtures/drummond/budget.ts,
    src/app/design-system/_fixtures/drummond/lien-releases.ts,
    src/app/design-system/_fixtures/drummond/schedule.ts,
    src/app/design-system/_fixtures/drummond/payments.ts,
    src/app/design-system/_fixtures/drummond/reconciliation.ts,
    scripts/drummond-invoice-fields.json
  </files>

  <read_first>
    - scripts/sanitize-drummond.ts (just-built script from Task 1)
    - src/app/design-system/_fixtures/drummond/types.ts (just-built — type contracts)
    - .planning/fixtures/drummond/SUBSTITUTION-MAP.md (full mapping; gitignored)
    - .planning/fixtures/drummond/source3-downloads/INVENTORY.md (raw file inventory)
    - src/app/design-system/_fixtures/jobs.ts (analog SAMPLE_JOBS const array structure)
    - src/app/design-system/_fixtures/vendors.ts (analog 5-entry SAMPLE_VENDORS array)
    - src/app/design-system/_fixtures/invoices.ts (analog SAMPLE_INVOICES — 12 entries; covers 4 statuses + 3 format types)
    - src/app/design-system/_fixtures/draws.ts (analog SAMPLE_DRAWS with G702 summary fields)
    - src/app/design-system/_fixtures/cost-codes.ts (analog 5-digit codes, sort_order)
    - src/app/design-system/_fixtures/change-orders.ts (analog SAMPLE_CHANGE_ORDERS)
    - .planning/expansions/stage-1.5b-prototype-gallery-EXPANDED-SCOPE.md §1.1 (entity counts: 17 vendors, 5 pay apps, 25-50 budget lines, 4-6 COs, 30+ G703 line items per pay app)
    - CLAUDE.md "Drummond - Line Items Cost Coded.pdf" reference + 5-digit cost code seeds
  </read_first>

  <action>
**One-time pre-step (per CONTEXT D-18):** Re-save 4 legacy `.xls` files in `.planning/fixtures/drummond/source3-downloads/` as `.xlsx` in Excel:
- Drummond - Pay App 1 - March-July 2025.xls → .xlsx
- Drummond - Pay App 2 - August 2025.xls → .xlsx
- Drummond - Pay App 3 - September 2025 REVISED.xls → .xlsx
- (Pay App 4 is already `.xlsx`; Pay App 5 is PDF — extract via the PDF parsing strategy below)

If the legacy `.xls` files cannot be re-saved by Claude (binary format requires Excel app), the executor MUST halt with a CHECKPOINT to Jake requesting the conversion. Per D-23, this halt is acceptable within the 2-day budget; if it slips past 4 days total for fixture extraction, escalate to Jake per R1.

**Step A — Manual PDF extraction (per CONTEXT D-17 / D-19):**

Use the Claude Code Read tool to extract structured fields from these priority PDFs:
- `.planning/fixtures/drummond/source3-downloads/Pay Application #5 - Drummond-501 74th St.pdf` — extract G702 summary (cover sheet) + G703 line items (continuation sheet, ~25-50 rows)
- `.planning/fixtures/drummond/source3-downloads/Drummond November 2025 Corresponding Invoices.pdf` — extract 4-6 priority invoices spanning the 12-status workflow (ai_processed, pm_review, qa_review, paid; clean PDF, T&M, lump_sum format types)
- `.planning/fixtures/drummond/source3-downloads/Drummond-Nov 2025 Lein Releases (2).pdf` — extract lien releases tied to the November 2025 invoices

Hand-curate the extracted fields into `scripts/drummond-invoice-fields.json` with this shape:

```json
{
  "invoices": [
    {
      "vendor_name_raw": "<real name; will be substituted>",
      "invoice_number": "...",
      "invoice_date": "YYYY-MM-DD",
      "total_amount_dollars": 1234.56,
      "description": "...",
      "invoice_type": "progress | time_and_materials | lump_sum",
      "status": "ai_processed | pm_review | qa_review | paid",
      "received_date": "YYYY-MM-DD",
      "line_items": [{ "description": "...", "amount_dollars": 1234.56 }],
      "flags": []
    }
  ],
  "draws": [
    {
      "draw_number": 5,
      "application_date": "YYYY-MM-DD",
      "period_start": "YYYY-MM-DD",
      "period_end": "YYYY-MM-DD",
      "original_contract_sum_dollars": ...,
      "net_change_orders_dollars": ...,
      "contract_sum_to_date_dollars": ...,
      "total_completed_to_date_dollars": ...,
      "less_previous_payments_dollars": ...,
      "current_payment_due_dollars": ...,
      "balance_to_finish_dollars": ...,
      "deposit_amount_dollars": ...,
      "status": "paid"
    }
  ],
  "draw_line_items": [
    {
      "draw_number": 5,
      "cost_code": "01101",
      "previous_applications_dollars": ...,
      "this_period_dollars": ...,
      "total_to_date_dollars": ...,
      "percent_complete": 0.85,
      "balance_to_finish_dollars": ...
    }
  ],
  "lien_releases": [
    {
      "vendor_name_raw": "<real>",
      "invoice_number": "...",
      "release_type": "conditional_progress | unconditional_progress | conditional_final | unconditional_final",
      "status": "received | pending",
      "release_date": "YYYY-MM-DD",
      "amount_through_dollars": ...
    }
  ]
}
```

This file is gitignored (it contains real names pre-substitution) — add `scripts/drummond-invoice-fields.json` to `.gitignore` if not already covered by `/scripts/*.json` rule. **VERIFY gitignore coverage before saving the file.**

**Step B — Run the extractor for each entity:**

Execute `npx tsx scripts/sanitize-drummond.ts` and verify it:
1. Loads SUBSTITUTION-MAP.md (>=17 entries logged)
2. Reads each `.xlsx` (5 pay apps + budget + 2 schedule files)
3. Reads `scripts/drummond-invoice-fields.json` for invoice/lien data
4. Applies substitutions
5. Runs grep gate; exits 0 only if zero real names survive
6. Writes 12 `.ts` fixture files to `src/app/design-system/_fixtures/drummond/`

**Acceptance counts per file (from EXPANDED-SCOPE §1.1 + CONTEXT 1.1):**

| File | Min entries | Source | Notes |
|---|---|---|---|
| `jobs.ts` (DRUMMOND_JOBS) | 1 | manual (substituted from raw) | `name: "Caldwell Residence"` (or similar — substitute "Drummond"), `address: "712 Pine Ave, Anna Maria FL 34216"`, contract amount from Pay App 5 cover sheet |
| `vendors.ts` (DRUMMOND_VENDORS) | 17 | invoice JSON + pay apps | 14 substituted + 3 NO-SUB (Ferguson, FPL, Home Depot) |
| `cost-codes.ts` (DRUMMOND_COST_CODES) | 25+ | "Drummond - Line Items Cost Coded.pdf" or budget XLSX | 5-digit codes; cover Pay App 5 G703 row coverage |
| `invoices.ts` (DRUMMOND_INVOICES) | 4 minimum, prefer 6+ | invoice JSON | Spans ai_processed/pm_review/qa_review/paid + 3 format types |
| `draws.ts` (DRUMMOND_DRAWS) | 5 | Pay Apps 1-5 (xlsx + PDF) | All historical pay apps; Draw #5 = canonical |
| `draw-line-items.ts` (DRUMMOND_DRAW_LINE_ITEMS) | 25+ per draw, 100+ total | Pay App 5 G703 + earlier pay apps | One per cost code per draw |
| `change-orders.ts` (DRUMMOND_CHANGE_ORDERS) | 4-6 | Pay App 5 cover sheet PCCO log | Default GC fee 20%; tests "complex CO chains affecting multiple budget lines" |
| `budget.ts` (DRUMMOND_BUDGET_LINES) | 25+ | Drummond_Budget_2026-04-15.xlsx | Per cost code per job; computed fields LEFT OFF type |
| `lien-releases.ts` (DRUMMOND_LIEN_RELEASES) | 4 minimum (1 per Florida statute type) | Drummond-Nov 2025 Lein Releases.pdf | 4-statute enum exercised |
| `schedule.ts` (DRUMMOND_SCHEDULE_ITEMS) | 20+ | Schedule_List_Drummond-501 74th St.xlsx | 6+ month timeline; >=2 milestones; dependencies populated |
| `payments.ts` (DRUMMOND_PAYMENTS) | 1 per `paid` invoice | derived from DRUMMOND_INVOICES | payment_date computed via Ross Built rule (received by 5th → 15th, by 20th → 30th) |
| `reconciliation.ts` (DRUMMOND_RECONCILIATION_PAIRS) | 8 | derived from invoices+POs+budget | 4 candidates × 2 drift types (invoice_po, draw_budget) |

**Per R.2:** Compute fields like `total_with_fee = amount + gc_fee_amount` at WRITE time (these are stored values that come from the source pay app). Fields that must be DERIVED at render time (`previous_applications`, `total_to_date`, `percent_complete`, `balance_to_finish` for budget lines) STAY OUT of `DRUMMOND_BUDGET_LINES` per the type contract.

**Per CONTEXT D-22:** any vendor list update here MUST also be reflected in the CI workflow hardcoded list (Task 3, `.github/workflows/drummond-grep-check.yml`).

**ID prefixes** (avoid collision with playground fictional fixtures `j-pelican-bay`, `v-coastal-carpentry`, etc.):
- Jobs: `j-drummond-` (or `j-caldwell-` since the substituted name is Caldwell)
- Vendors: `v-drummond-<slug>` (e.g., `v-drummond-coastal-smart-systems`, `v-drummond-bay-region-carpentry`)
- Cost codes: `cc-` (5-digit codes already unique)
- Invoices: `inv-drummond-001` through `inv-drummond-NNN`
- Draws: `d-drummond-01` through `d-drummond-05`
- Change orders: `co-drummond-01` through `co-drummond-06`
- Budget lines: `bl-drummond-<cost-code>`
- Lien releases: `lr-drummond-<seq>`
- Schedule: `s-drummond-<seq>`
- Payments: `p-drummond-<seq>`
- Reconciliation: `rec-drummond-<drift-type>-<candidate>` (e.g., `rec-drummond-invoice_po-1`)
  </action>

  <verify>
    <automated>npx tsc --noEmit && grep -rE 'Drummond|501 74th|Holmes Beach|SmartShield Homes|Florida Sunshine|Doug Naeher|Loftin Plumbing|ML Concrete|Banko|Paradise Foam|WG Drywall|CoatRite|Ecosouth|MJ Florida|Rangel Tile|TNT Painting|Avery Roofing|Island Lumber' src/app/design-system/_fixtures/drummond/ | grep -v '^Binary' | wc -l</automated>
    The grep MUST return 0. If it returns nonzero, halt — real names leaked through the substitution.

    Manual checks:
    - `wc -l src/app/design-system/_fixtures/drummond/*.ts` shows reasonable line counts (vendors 50+ lines, invoices 200+, draw-line-items 300+).
    - Each file imports its type from `./types` and exports the corresponding `DRUMMOND_*` const.
    - `git check-ignore -v scripts/drummond-invoice-fields.json` confirms gitignored.
    - `npx tsx -e 'import { DRUMMOND_JOBS, DRUMMOND_VENDORS, DRUMMOND_INVOICES, DRUMMOND_DRAWS, DRUMMOND_BUDGET_LINES, DRUMMOND_LIEN_RELEASES, DRUMMOND_SCHEDULE_ITEMS, DRUMMOND_RECONCILIATION_PAIRS } from "./src/app/design-system/_fixtures/drummond"; console.log({jobs: DRUMMOND_JOBS.length, vendors: DRUMMOND_VENDORS.length, invoices: DRUMMOND_INVOICES.length, draws: DRUMMOND_DRAWS.length, budget: DRUMMOND_BUDGET_LINES.length, lien: DRUMMOND_LIEN_RELEASES.length, schedule: DRUMMOND_SCHEDULE_ITEMS.length, recon: DRUMMOND_RECONCILIATION_PAIRS.length})'` prints counts matching the table above.
  </verify>

  <done>
    - All 12 fixture files exist and typecheck
    - Vendor count = 17 (verified via DRUMMOND_VENDORS.length)
    - Draw count = 5
    - Budget line count >= 25
    - Schedule item count >= 20 with >= 2 is_milestone=true entries
    - Reconciliation pair count = 8 (4 candidates × 2 drift types)
    - Grep against ALL committed `_fixtures/drummond/*.ts` for real Drummond identifiers returns 0 matches
    - `scripts/drummond-invoice-fields.json` gitignored (verified via `git check-ignore -v`)
  </done>
</task>

<task type="auto">
  <name>Task 3: prototypes scaffold + CI grep gate</name>

  <files>
    src/app/design-system/prototypes/layout.tsx,
    src/app/design-system/prototypes/page.tsx,
    .github/workflows/drummond-grep-check.yml
  </files>

  <read_first>
    - src/app/design-system/_components/DirectionPaletteShell.tsx (lines 31-50 — analog inheritance)
    - src/app/design-system/layout.tsx (full file — parent layout chrome that prototypes/layout.tsx renders inside)
    - src/app/design-system/page.tsx (lines 31-238 — index landing pattern with SECTIONS array + Card grid)
    - src/app/design-system/design-system.css (lines 84-99 — `[data-direction="C"]` Site Office tokens)
    - .planning/design/CHOSEN-DIRECTION.md (Site Office + Set B locked verdict)
    - .planning/design/SYSTEM.md §13 Forbidden (no hex outside globals.css/tailwind.config.ts)
    - .planning/design/SYSTEM.md §10b (print density forces compact)
    - .planning/fixtures/drummond/SUBSTITUTION-MAP.md (for the CI hardcoded list)
    - .claude/hooks/nightwork-post-edit.sh:194-230 (T10c rejects @/lib/supabase|org|auth in /design-system/*)
    - src/components/nw/Eyebrow.tsx (the analog Eyebrow component used in design-system pages)
    - src/components/nw/Card.tsx (the analog Card component)
    - src/components/nw/Badge.tsx (the analog Badge component)
  </read_first>

  <action>
**Step A — Create `src/app/design-system/prototypes/layout.tsx`:**

Override parent's `DirectionPaletteShell` to LOCK direction=C palette=B for all `/prototypes/*` routes (per D-02 — prevents accidental flips during walkthrough).

```typescript
// src/app/design-system/prototypes/layout.tsx
//
// Prototype gallery layout — locks Site Office direction (C) + Set B
// palette for every /design-system/prototypes/* route. Per CONTEXT D-02
// (Phase 1.5b) the parent design-system layout exposes a
// DirectionPaletteSwitcher for picking direction; the prototypes
// gallery hard-codes the CP2 verdict so accidental flips can't
// invalidate the validation walkthrough.
//
// Per .planning/design/CHOSEN-DIRECTION.md (locked 2026-05-01) — Site
// Office + Set B is the locked direction. This file enforces that for
// /prototypes/*.
//
// Hook T10c (nightwork-post-edit.sh:194-230) — no imports from
// @/lib/supabase|org|auth.

import type { ReactNode } from "react";

export default function PrototypesLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-direction="C"
      data-palette="B"
      className="design-system-scope"
    >
      {children}
    </div>
  );
}
```

**Note on Next.js layout nesting:** Parent `src/app/design-system/layout.tsx` wraps children inside `<DirectionPaletteShell>` (a client component reading `?dir=` and `?palette=` from URL). Nested layout's `data-direction="C"` should win at the inner DOM scope because CSS attribute selectors hit the closest ancestor first (`.design-system-scope[data-direction="C"]` matches the inner div). VERIFY this works at execute time by visiting `/design-system/prototypes/?dir=A&palette=A` — Site Office Direction C should still apply (URL params should be ignored).

If verification fails (parent's `DirectionPaletteShell` collapses both attributes onto the outer div and blocks inner override), fall back to a client component approach: read the parent context and re-render content in a fresh wrapper. Document the fallback as a 1.5b finding.

**Step B — Create `src/app/design-system/prototypes/page.tsx`:**

Index landing for `/design-system/prototypes/` with 10 prototype Card links. Mirror the SECTIONS array + Card grid pattern from `src/app/design-system/page.tsx:31-213`.

```typescript
// src/app/design-system/prototypes/page.tsx
//
// Prototype gallery index — landing page for /design-system/prototypes/.
// Lists the 10 prototype routes that validate the design system on
// real-shape Drummond data per Stage 1.5b expanded scope.
//
// All 10 sections inherit Site Office + Set B from prototypes/layout.tsx
// (per CONTEXT D-02). Token discipline enforced — no hardcoded hex.
//
// Hook T10c — no imports from @/lib/supabase|org|auth.

import Link from "next/link";
import {
  DocumentTextIcon,
  CheckBadgeIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  BuildingOfficeIcon,
  FolderOpenIcon,
  DevicePhoneMobileIcon,
  HomeModernIcon,
  ScaleIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";

// 10 prototype routes per EXPANDED-SCOPE §7 (deliverable #2-#11; #1 is fixtures, no route)
const SECTIONS: Array<{
  href: string;
  label: string;
  Icon: typeof DocumentTextIcon;
  blurb: string;
  goal: string;
}> = [
  {
    href: "/design-system/prototypes/invoices/inv-drummond-001",
    label: "Invoice approval",
    Icon: DocumentTextIcon,
    blurb: "AI-parsed invoice review — clean PDF, T&M, lump-sum format types across 4 workflow statuses.",
    goal: "Validate Document Review (PATTERNS §2) at real-data confidence + status diversity.",
  },
  {
    href: "/design-system/prototypes/draws/d-drummond-05",
    label: "Draw approval",
    Icon: CheckBadgeIcon,
    blurb: "Pay App 5 — G702 summary + G703 line items with full Drummond CO chain rolled in.",
    goal: "Validate Document Review extending to draw approval at 25+ G703 line item density.",
  },
  {
    href: "/design-system/prototypes/draws/d-drummond-05/print",
    label: "Print preview (G702/G703)",
    Icon: PrinterIcon,
    blurb: "AIA G702 cover sheet + G703 detail page — pixel-perfect attempt on cover, 80% on detail.",
    goal: "Validate PATTERNS §10 Print View at AIA fidelity. Halt if pixel-perfect explodes (1-day judgment).",
  },
  {
    href: "/design-system/prototypes/jobs/j-drummond/budget",
    label: "Budget view",
    Icon: ChartBarIcon,
    blurb: "Drummond budget — 25+ line items with computed previous/this-period/percent-complete derived on render.",
    goal: "Validate Pattern3Dashboard + DataGrid stress test at compact density.",
  },
  {
    href: "/design-system/prototypes/jobs/j-drummond/schedule",
    label: "Schedule (Gantt)",
    Icon: CalendarDaysIcon,
    blurb: "6+ month Gantt with 20+ tasks, dependencies, milestones for pay app dates. Wave 2 preview.",
    goal: "Validate Site Office direction at Gantt density. NEW pattern — readability finding feeds 1.5a-followup.",
  },
  {
    href: "/design-system/prototypes/vendors",
    label: "Vendors",
    Icon: BuildingOfficeIcon,
    blurb: "17 Drummond vendors in List+Detail layout — long names stress test.",
    goal: "Validate Pattern6ListDetail at real vendor name length + entity-type mix.",
  },
  {
    href: "/design-system/prototypes/documents/doc-drummond-001",
    label: "Documents",
    Icon: FolderOpenIcon,
    blurb: "Plans, contracts, lien releases — sub-prototypes per document type.",
    goal: "Validate Document Review extends to non-invoice/draw document types.",
  },
  {
    href: "/design-system/prototypes/mobile-approval",
    label: "Mobile approval",
    Icon: DevicePhoneMobileIcon,
    blurb: "PM in field — invoice approval on iPhone-sized viewport, 56px high-stakes targets.",
    goal: "Validate Pattern4MobileApproval. Real-phone test on Jake's actual phone GATES SHIP.",
  },
  {
    href: "/design-system/prototypes/owner-portal",
    label: "Owner portal",
    Icon: HomeModernIcon,
    blurb: "Homeowner dashboard + draw approval. Cost-plus open-book transparency.",
    goal: "Validate Site Office trust posture for non-builder audience. \"Lighter variant\" finding if too archival.",
  },
  {
    href: "/design-system/prototypes/reconciliation",
    label: "Reconciliation strawman",
    Icon: ScaleIcon,
    blurb: "4 candidates × 2 drift types (invoice↔PO, draw↔budget) = 8 prototypes.",
    goal: "Validate PATTERNS §11 strawman against real Drummond drift. Leading candidate documented at 1.5b end.",
  },
];

export default function PrototypeGalleryIndex() {
  return (
    <div className="px-6 py-8 max-w-[1200px] mx-auto">
      {/* Header band */}
      <div className="mb-8">
        <Eyebrow tone="muted" className="mb-2">Stage 1.5b</Eyebrow>
        <h1
          className="text-[28px] mb-2"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Prototype gallery
        </h1>
        <p className="text-[14px] mb-4" style={{ color: "var(--text-secondary)" }}>
          Site Office direction + Set B palette, rendered against sanitized Drummond fixtures.
          Validates whether the design system actually works for real construction workflows.
        </p>
        <Badge variant="accent">CP2 locked: Site Office + Set B</Badge>
      </div>

      {/* Card grid — analog: src/app/design-system/page.tsx:131-213 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {SECTIONS.map((section) => {
          const { Icon } = section;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="group block"
            >
              <Card padding="lg" className="h-full transition-colors duration-150 group-hover:border-[var(--border-strong)]">
                <div className="flex items-center justify-between mb-3">
                  <Eyebrow tone="default" icon={<Icon className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                    {section.label}
                  </Eyebrow>
                  <Badge variant="neutral">Validation</Badge>
                </div>
                <h2
                  className="text-[18px] mb-2"
                  style={{
                    fontFamily: "var(--font-space-grotesk)",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                  }}
                >
                  {section.label}
                </h2>
                <p className="text-[13px] mb-3" style={{ color: "var(--text-secondary)" }}>
                  {section.blurb}
                </p>
                <p
                  className="text-[10px]"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {section.goal}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

**Step C — Create `.github/workflows/drummond-grep-check.yml`:**

First-ever GitHub Actions workflow in the repo. Per CONTEXT D-20 (tier 2 grep gate) + D-21 (defense-in-depth).

```yaml
# .github/workflows/drummond-grep-check.yml
#
# Two-tier grep gate (tier 2 — CI-side, defense-in-depth). Per CONTEXT
# D-20 + D-22 (Stage 1.5b). Tier 1 is the extractor (scripts/sanitize-drummond.ts).
# Tier 2 catches hand-written drift bypassing the extractor.
#
# Runs on every PR + push to main. Fails the workflow if any of ~17-20
# real Drummond identifiers appear in committed sanitized fixtures.
#
# This list MUST be kept in sync with .planning/fixtures/drummond/SUBSTITUTION-MAP.md
# (gitignored). Updates to vendor list go in BOTH places (per D-22).

name: Drummond grep check

on:
  pull_request:
  push:
    branches: [main]

jobs:
  grep-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check sanitized fixtures for real Drummond identifiers
        run: |
          # Hardcoded list of high-risk Drummond identifiers (per D-21 narrow scope).
          # Owner + site address + 17 vendor real names from SUBSTITUTION-MAP.md.
          PATTERN='Drummond|501 74th|Holmes Beach|SmartShield Homes|Florida Sunshine Carpentry|Doug Naeher Drywall|Paradise Foam|Banko Overhead Doors|WG Drywall|Loftin Plumbing|Island Lumber|CoatRite|Ecosouth|MJ Florida|Rangel Tile|TNT Painting|Avery Roofing|ML Concrete LLC'

          if git grep -nE "$PATTERN" -- 'src/app/design-system/_fixtures/drummond/'; then
            echo ""
            echo "::error::Real Drummond identifier detected in sanitized fixtures."
            echo "::error::Sanitized fixtures must use SUBSTITUTION-MAP.md substitutions (Caldwell, 712 Pine Ave, etc.)."
            echo "::error::Either re-run scripts/sanitize-drummond.ts or hand-fix the offending file."
            exit 1
          fi

          echo "OK: no real Drummond identifiers found in src/app/design-system/_fixtures/drummond/"
```

**Token discipline reminder:** No hardcoded hex anywhere. The Card / Badge / Eyebrow components are from `src/components/nw/`; they accept variant props and read tokens from CSS vars. Inline styles use `var(--...)` references only.

**Hook T10c reminder:** None of the three new files import from `@/lib/supabase`, `@/lib/org`, or `@/lib/auth`. The imports listed (next/link, @heroicons/react/24/outline, @/components/nw/*) are all permitted.
  </action>

  <verify>
    <automated>npm run build && grep -c "data-direction=\"C\"" src/app/design-system/prototypes/layout.tsx</automated>
    Expected: build exits 0; grep returns >=1.

    Additional checks:
    - `grep -E '@/lib/(supabase|org|auth)' src/app/design-system/prototypes/layout.tsx src/app/design-system/prototypes/page.tsx` returns 0 matches (hook T10c silent).
    - `grep -cE '#[0-9a-fA-F]{3,6}' src/app/design-system/prototypes/layout.tsx src/app/design-system/prototypes/page.tsx` returns 0 (no hardcoded hex).
    - `grep -c "actions/checkout@v4" .github/workflows/drummond-grep-check.yml` returns 1.
    - Manual: navigate to `http://localhost:3000/design-system/prototypes/` after `npm run dev`. Index page renders with 10 Card links + Site Office UPPERCASE eyebrows + slate-tile left-stamp on cards.
  </verify>

  <done>
    - prototypes/layout.tsx forces data-direction="C" data-palette="B"
    - prototypes/page.tsx index renders all 10 prototype links
    - .github/workflows/drummond-grep-check.yml committed and would catch real-name leaks
    - npm run build passes
    - Hook T10c silent on all new files
    - No hardcoded hex in any new file
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>HALT: Wave 0 fixture extraction complete — Jake reviews before Wave 1 launches</name>

  <action>HALT — present the verification block below to Jake. Do NOT proceed to Wave 1 plans (PLAN-2, PLAN-3, PLAN-4, PLAN-5) until Jake explicitly approves. If issues surface, fix Wave 0 work and re-run the checkpoint. R1 escalation: if elapsed time exceeds 4 days, escalate to Jake regardless of completeness (per CONTEXT D-23).</action>

  <what-built>
    - Sanitization pipeline: `scripts/sanitize-drummond.ts` reads SUBSTITUTION-MAP.md, parses 5 pay app `.xlsx` + 1 budget `.xlsx` + 2 schedule files + 1 invoice JSON, applies multi-pass substitution, runs grep gate, writes 12 sanitized TS fixture files
    - 12 sanitized Drummond fixture files at `src/app/design-system/_fixtures/drummond/` (jobs, vendors, cost-codes, invoices, draws, draw-line-items, change-orders, budget, lien-releases, schedule, payments, reconciliation) + types.ts + index.ts barrel
    - Counts: 17 vendors, 5 draws, 25+ budget lines, 20+ schedule items, 4-6 COs, 8 reconciliation pairs, 4-statute lien-release coverage
    - Prototype gallery scaffold: `src/app/design-system/prototypes/layout.tsx` (forces direction=C palette=B), `src/app/design-system/prototypes/page.tsx` (10-Card index)
    - First-ever GitHub Actions workflow: `.github/workflows/drummond-grep-check.yml` (CI-side grep gate, ~17-20 high-risk identifiers)
    - Hook T10c silent on all new files; no hardcoded hex; no `@/lib/supabase` imports
  </what-built>

  <how-to-verify>
**Per CONTEXT D-23 hard halt rule (R1).** Jake reviews sanitized output for privacy + accuracy + sufficiency BEFORE Wave 1 prototype rendering begins.

**R1 escalation status:** if Wave 0 has taken >4 days from kickoff, halt and escalate per CONTEXT D-23. Fallback options: Q4=B compressed fixture (1-2 pay apps, 8-10 vendors) OR scope-cut another Wave 1 deliverable.

1. **Privacy verification (THE non-negotiable check).** Run from project root:
   ```bash
   grep -rnE 'Drummond|501 74th|Holmes Beach|SmartShield Homes|Florida Sunshine|Doug Naeher|Loftin Plumbing|ML Concrete|Banko|Paradise Foam|WG Drywall|CoatRite|Ecosouth|MJ Florida|Rangel Tile|TNT Painting|Avery Roofing|Island Lumber' src/app/design-system/_fixtures/drummond/ | grep -v '^Binary'
   ```
   Expected output: NOTHING (empty result). If ANY match → HALT immediately, fix the substitution, re-run.

2. **Counts verification.** Run:
   ```bash
   npx tsx -e 'import * as f from "./src/app/design-system/_fixtures/drummond"; console.log({jobs: f.DRUMMOND_JOBS.length, vendors: f.DRUMMOND_VENDORS.length, costCodes: f.DRUMMOND_COST_CODES.length, invoices: f.DRUMMOND_INVOICES.length, draws: f.DRUMMOND_DRAWS.length, drawLineItems: f.DRUMMOND_DRAW_LINE_ITEMS.length, changeOrders: f.DRUMMOND_CHANGE_ORDERS.length, budget: f.DRUMMOND_BUDGET_LINES.length, lien: f.DRUMMOND_LIEN_RELEASES.length, schedule: f.DRUMMOND_SCHEDULE_ITEMS.length, payments: f.DRUMMOND_PAYMENTS.length, recon: f.DRUMMOND_RECONCILIATION_PAIRS.length})'
   ```
   Expected counts: jobs=1, vendors=17, costCodes>=25, invoices>=4, draws=5, drawLineItems>=100, changeOrders=4-6, budget>=25, lien>=4, schedule>=20, payments>=count(invoices.status=='paid'), recon=8

3. **Sufficiency check.** Open `src/app/design-system/_fixtures/drummond/invoices.ts` and verify:
   - At least one invoice with `status: "ai_processed"` (yellow confidence)
   - At least one invoice with `status: "pm_review"` (yellow flag)
   - At least one invoice with `status: "qa_review"` (green confidence)
   - At least one invoice with `status: "paid"`
   - At least one invoice with `invoice_type: "progress"` (clean PDF)
   - At least one invoice with `invoice_type: "time_and_materials"` (T&M)
   - At least one invoice with `invoice_type: "lump_sum"`

4. **Schedule milestones.** Open `src/app/design-system/_fixtures/drummond/schedule.ts` and verify:
   - At least 2 entries with `is_milestone: true` (pay app dates render as diamonds)
   - At least one entry with `predecessor_ids` populated (dependencies visible)
   - Total date span >= 6 months (max(end_date) - min(start_date))

5. **Lien release statutes.** Open `src/app/design-system/_fixtures/drummond/lien-releases.ts` and verify all 4 statute types appear at least once: `conditional_progress`, `unconditional_progress`, `conditional_final`, `unconditional_final`.

6. **Scaffold integrity.** Visit `http://localhost:3000/design-system/prototypes/` after `npm run dev`. Expected:
   - 10 Card links render
   - Eyebrow text is UPPERCASE with 0.18em tracking (Site Office)
   - Cards have left-side slate-tile stamp (1px border-left)
   - Card padding compact (16px)
   - No console errors
   - Try `?dir=A` URL — should NOT change appearance (locked direction wins)

7. **CI workflow shape.** Open `.github/workflows/drummond-grep-check.yml`. Verify:
   - Runs on `pull_request` and `push: branches: [main]`
   - Uses `actions/checkout@v4`
   - Pattern includes "Drummond" + "501 74th" + "Holmes Beach" + 14 vendor names

**M3 phone gate reminder (per CONTEXT D-25):** confirm at this checkpoint whether Jake has substituted the `[PHONE]` placeholder in EXPANDED-SCOPE.md §0 + MANUAL-CHECKLIST.md M3. If still PENDING, the phase can continue building Wave 1 prototypes — but it MUST be locked before `/nx` execute completes (not at this halt; this halt's job is fixture verification only).
  </how-to-verify>

  <resume-signal>
Type "approved" to launch Wave 1 (PLAN-2, PLAN-3, PLAN-4, PLAN-5 in parallel).

Or describe issues — common rework reasons:
- Real name leaked: identify which file/value, fix substitution map or fixture, regenerate
- Insufficient counts: add more invoices/CO chains/budget lines via inspect-xlsx + manual JSON
- Sufficiency missing: add missing status / invoice_type / lien type / milestone variants
- Direction lock fails: parent layout's DirectionPaletteShell collapses inner override → fall back to client component pattern
- R1 escalation triggered (>4 days): pick Q4=B (compressed fixture) or scope-cut a Wave 1 deliverable
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Real raw fixtures (`.planning/fixtures/drummond/`) → sanitized output (`src/app/design-system/_fixtures/drummond/`) | Substitution map applied; gitignored input → committed output |
| Local extractor (`scripts/sanitize-drummond.ts`) → committed repo | Tier 1 grep gate inline; refuses to write if real names survive |
| Committed repo → CI (GitHub Actions) | Tier 2 grep gate; rejects PRs/pushes that contain real names |
| `/design-system/prototypes/*` → tenant code (`@/lib/supabase|org|auth`) | Hook T10c rejects imports; pure data exports always pass |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-1.5b-W0-01 | I (Information disclosure) | `src/app/design-system/_fixtures/drummond/*.ts` (committed) | mitigate | Two-tier grep gate (per D-20): tier 1 in `scripts/sanitize-drummond.ts` rejects writes if real names survive substitution; tier 2 in `.github/workflows/drummond-grep-check.yml` runs `git grep` against committed fixtures on every PR + push to main with hardcoded ~17-20 high-risk identifier list. Privacy posture (per D-21): repo is private; defense-in-depth justified. |
| T-1.5b-W0-02 | I (Information disclosure) | `scripts/drummond-invoice-fields.json` (gitignored, hand-curated raw fields) | mitigate | Add to `.gitignore` (verify via `git check-ignore -v` before saving). Contains pre-substitution real names that would leak if committed. Tier 1 extractor reads, applies substitutions, writes substituted-only output. |
| T-1.5b-W0-03 | T (Tampering) | `prototypes/layout.tsx` direction lock | mitigate | Hard-coded `data-direction="C" data-palette="B"` cannot be overridden via URL params (parent shell's URL-driven values are shadowed by inner DOM CSS attribute selector). Verifies at execute time via `?dir=A` URL test. |
| T-1.5b-W0-04 | T (Tampering) | Sanitized fixtures could be hand-edited to bypass extractor | mitigate | Tier 2 CI grep gate runs on every push to main, catches drift. JSDoc header on each fixture file says "DO NOT HAND-EDIT. Re-run `npx tsx scripts/sanitize-drummond.ts` to regenerate." |
| T-1.5b-W0-05 | I (Information disclosure) | Prototype reachable in production without platform_admin gating | mitigate (existing) | `src/middleware.ts:98` `pathname.startsWith("/design-system/")` covers `prototypes/*` via prefix match. Inherited gating; no new middleware code needed. Verified at execute time by visiting prototypes route as non-platform-admin → expected: `/_not-found` rewrite. |
| T-1.5b-W0-06 | E (Elevation of privilege) | Prototype accidentally imports tenant module → bypasses RLS | mitigate (existing) | Hook T10c `nightwork-post-edit.sh:194-230` rejects `@/lib/(supabase|org|auth)` imports in `src/app/design-system/*`. Verified at execute time on each new file (no T10c violations).  |
</threat_model>

<verification>
**Wave 0 gate:** Every check below MUST pass before HALT clears.

1. **Privacy gate (HARD BLOCKING):**
   ```bash
   grep -rnE 'Drummond|501 74th|Holmes Beach|SmartShield Homes|Florida Sunshine|Doug Naeher|Loftin Plumbing|ML Concrete|Banko|Paradise Foam|WG Drywall|CoatRite|Ecosouth|MJ Florida|Rangel Tile|TNT Painting|Avery Roofing|Island Lumber' src/app/design-system/_fixtures/drummond/ | grep -v '^Binary' | wc -l
   ```
   MUST return `0`.

2. **Build gate:** `npm run build` exits 0.

3. **Type gate:** `npx tsc --noEmit` exits 0.

4. **Hook T10c gate:** every new file under `src/app/design-system/*` and `src/app/design-system/_fixtures/drummond/*` has NO `@/lib/(supabase|org|auth)` imports.

5. **Token discipline gate:** `grep -nE '#[0-9a-fA-F]{3,6}' src/app/design-system/prototypes/*.tsx src/app/design-system/_fixtures/drummond/*.ts` returns 0 hardcoded hex matches.

6. **Counts gate:** All entity counts meet or exceed the targets in Task 2 verify table.

7. **CI gate:** `.github/workflows/drummond-grep-check.yml` exists with `actions/checkout@v4` step and pattern matching all 14 vendor names + 3 owner/address keys.
</verification>

<success_criteria>
- Wave 0 HALT cleared by Jake explicitly typing "approved" or "launch Wave 1"
- All gates above pass
- Sanitized fixture sufficiency confirmed (statuses, types, milestones, statutes)
- M3 phone gate noted as PENDING (resolved before /nx, not blocking this halt)
- The downstream Wave 1 plans (PLAN-2 through PLAN-5) can import `from "@/app/design-system/_fixtures/drummond"` and find all expected types + const arrays
</success_criteria>

<output>
After completion, create `.planning/phases/stage-1.5b-prototype-gallery/stage-1.5b-prototype-gallery-1-SUMMARY.md` covering:
- Total fixture entity counts (jobs, vendors, cost-codes, invoices, draws, draw-line-items, change-orders, budget, lien-releases, schedule, payments, reconciliation)
- Substitution map application audit (key real → sanitized substitutions actually applied)
- Any deviations from the planned shape (entity types added/dropped, count overrides, fallbacks invoked)
- Whether D-19 fallback was activated (per-invoice extraction → line-item summaries)
- R1 status: actual elapsed time vs 2-day budget vs 4-day escalation cliff
- Hook T10c clean? Token discipline clean? CI workflow committed?
- Halt verdict: approved with notes / approved clean / re-run needed
</output>
