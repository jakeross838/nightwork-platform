# Phase 1.5b: prototype-gallery — Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 24 files (13 fixture files + 11 prototype routes/layout + 1 sanitization script + 1 CI workflow)
**Analogs found:** 22 / 24 (2 files have no direct analog — extractor script, CI workflow — partial precedents instead)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/sanitize-drummond.ts` | utility | batch / file-I/O | `scripts/inspect-xlsx.mjs` | partial (exceljs precedent only) |
| `src/app/design-system/_fixtures/drummond/index.ts` | barrel | static export | `src/app/design-system/_fixtures/index.ts` | exact |
| `src/app/design-system/_fixtures/drummond/types.ts` | type-defs | static export | inline types in `_fixtures/{invoices,jobs,...}.ts` | role-match |
| `src/app/design-system/_fixtures/drummond/jobs.ts` | fixture | static export | `_fixtures/jobs.ts` | exact |
| `src/app/design-system/_fixtures/drummond/vendors.ts` | fixture | static export | `_fixtures/vendors.ts` | exact |
| `src/app/design-system/_fixtures/drummond/cost-codes.ts` | fixture | static export | `_fixtures/cost-codes.ts` | exact |
| `src/app/design-system/_fixtures/drummond/invoices.ts` | fixture | static export | `_fixtures/invoices.ts` | exact |
| `src/app/design-system/_fixtures/drummond/draws.ts` | fixture | static export | `_fixtures/draws.ts` | exact |
| `src/app/design-system/_fixtures/drummond/change-orders.ts` | fixture | static export | `_fixtures/change-orders.ts` | exact |
| `src/app/design-system/_fixtures/drummond/budget.ts` | fixture | static export | `_fixtures/cost-codes.ts` shape (no real budget fixture exists) | role-match |
| `src/app/design-system/_fixtures/drummond/lien-releases.ts` | fixture | static export | NEW shape (no `lien_releases` in playground fixtures) | role-match (mirrors fixture pattern) |
| `src/app/design-system/_fixtures/drummond/schedule.ts` | fixture | static export | NEW shape (Wave 2 entity) | role-match (mirrors fixture pattern) |
| `src/app/design-system/_fixtures/drummond/payments.ts` | fixture | static export | NEW shape (projected from invoice fields) | role-match (mirrors fixture pattern) |
| `src/app/design-system/_fixtures/drummond/reconciliation.ts` | fixture | static export | NEW shape (paired imported/current) | role-match (mirrors fixture pattern) |
| `.github/workflows/drummond-grep-check.yml` | config / CI | batch | NO precedent (no existing workflows) | none |
| `src/app/design-system/prototypes/layout.tsx` | layout | render-only | `src/app/design-system/layout.tsx` + `_components/DirectionPaletteShell.tsx` | role-match (overrides parent) |
| `src/app/design-system/prototypes/page.tsx` | page | render-only | `src/app/design-system/page.tsx` (index landing) | exact |
| `src/app/design-system/prototypes/invoices/[id]/page.tsx` | page | render-only | `patterns/page.tsx:259-407` Pattern1DocumentReview | exact |
| `src/app/design-system/prototypes/draws/[id]/page.tsx` | page | render-only | `patterns/page.tsx:259-407` Pattern1DocumentReview + Pattern9PrintView | exact (composite) |
| `src/app/design-system/prototypes/draws/[id]/print/page.tsx` | page | render-only / print | `patterns/page.tsx:1048-1143` Pattern9PrintView + `src/app/draws/[id]/page.tsx:269-470` print toggle | exact (composite) |
| `src/app/design-system/prototypes/jobs/[id]/budget/page.tsx` | page | render-only | `patterns/page.tsx:483-584` Pattern3Dashboard + `data-display/page.tsx:367-660` DataGrid | exact (composite) |
| `src/app/design-system/prototypes/jobs/[id]/schedule/page.tsx` | page | render-only | `data-display/page.tsx:367-660` DataGrid | partial (TanStack base, custom timeline cells) |
| `src/app/design-system/prototypes/vendors/page.tsx` | page | render-only | `patterns/page.tsx:818-869` Pattern6ListDetail | exact |
| `src/app/design-system/prototypes/vendors/[id]/page.tsx` | page | render-only | `patterns/page.tsx:259-407` Pattern1DocumentReview | exact |
| `src/app/design-system/prototypes/documents/[id]/page.tsx` | page | render-only | `patterns/page.tsx:259-407` Pattern1DocumentReview | exact |
| `src/app/design-system/prototypes/owner-portal/page.tsx` | page | render-only | `patterns/page.tsx:483-584` Pattern3Dashboard | exact |
| `src/app/design-system/prototypes/owner-portal/draws/[id]/page.tsx` | page | render-only | `patterns/page.tsx:259-407` Pattern1DocumentReview | exact |
| `src/app/design-system/prototypes/reconciliation/page.tsx` | page | render-only | `patterns/page.tsx:1149-1279` ReconciliationStrawman | exact |
| `src/app/design-system/prototypes/mobile-approval/page.tsx` | page | render-only | `patterns/page.tsx:590-718` Pattern4MobileApproval | exact |

---

## Pattern Assignments

### `scripts/sanitize-drummond.ts` (utility, batch / file-I/O)

**Analog:** `scripts/inspect-xlsx.mjs` (exceljs precedent only — sanitization logic itself is new)

**Imports + exceljs read pattern** (`scripts/inspect-xlsx.mjs:1-13`):
```typescript
import ExcelJS from 'exceljs';

const PATH = 'P:/Projects Info Folder/Drummond 501 74th St/Budget/Payapps/Drummond_Pay_App_9_March_26.xlsx';

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(PATH);

console.log(`Sheets: ${wb.worksheets.map((s) => s.name).join(', ')}\n`);

for (const sheet of wb.worksheets) {
  console.log(`─── Sheet: ${sheet.name} (${sheet.rowCount} rows × ${sheet.columnCount} cols) ───`);
```

**Cell-iteration pattern** (`scripts/inspect-xlsx.mjs:14-25`):
```typescript
sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
  if (n++ >= 40) return;
  const cells = [];
  for (let c = 1; c <= Math.min(10, sheet.columnCount); c++) {
    const v = row.getCell(c).value;
    const t = typeof v === 'object' && v && 'result' in v ? v.result : v;
    const s = t == null ? '' : String(t).slice(0, 22);
    cells.push(`[${c}]${s}`);
  }
});
```

**What this script must add (NO analog):**
1. Read SUBSTITUTION-MAP.md from gitignored location
2. Apply `realName → fictionalName` substitution post-read, pre-write
3. Run grep against the sanitized output before writing — fail if any real Drummond names survive
4. Output to `src/app/design-system/_fixtures/drummond/*.ts` files

**Note:** the existing `inspect-xlsx.mjs` is a `.mjs` file. Per `.planning/codebase/CONVENTIONS.md` (TS strict mode, tsx runner), this new file should be `.ts` and run via `npx tsx scripts/sanitize-drummond.ts` like other utility scripts (e.g., `bulk-import.ts`, `backfill-cost-intelligence.ts` per `STRUCTURE.md` listing).

---

### `src/app/design-system/_fixtures/drummond/index.ts` (barrel, static export)

**Analog:** `src/app/design-system/_fixtures/index.ts` (lines 1-17)

**Full file pattern** (mirror exactly with `drummond/` paths):
```typescript
// Re-exports for the design-system playground fixtures (Stage 1.5a T19.5).
//
// Pure constants only. No imports from @/lib/supabase|org|auth (per
// SPEC C6 / D9). Consumers can do:
//
//   import { SAMPLE_INVOICES, SAMPLE_VENDORS } from '@/app/design-system/_fixtures';
//
// instead of reaching into individual files.

export * from "./cost-codes";
export * from "./vendors";
export * from "./jobs";
export * from "./users";
export * from "./invoices";
export * from "./draws";
export * from "./change-orders";
```

**Apply to drummond/index.ts:** same shape, `DRUMMOND_*` constants instead of `SAMPLE_*` per D-04 (keeps fictional and Drummond fixtures separable on cross-imports).

---

### `src/app/design-system/_fixtures/drummond/jobs.ts` (fixture, static export)

**Analog:** `src/app/design-system/_fixtures/jobs.ts` (lines 14-45)

**Type definition pattern** (lines 14-29):
```typescript
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
```

**Constant array pattern** (lines 30-45 — first entry):
```typescript
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
  // ... 4 more
];
```

**Apply to drummond/jobs.ts:**
- `DrummondJob` type (extends `SampleJob` shape; only one job — Drummond/Halcyon — but Drummond has more nuance per CONTEXT D-001 sec 1.1: substitution covers homeowner name + address)
- `DRUMMOND_JOB` (single object) or `DRUMMOND_JOBS` (1-item array — keeps shape consistent for cross-fixture lookups)
- Use **substituted** name + address from SUBSTITUTION-MAP.md (locked: owner Caldwell, "712 Pine Ave, Anna Maria FL 34216", job code GC0501 per AUTO-LOG line 99)

---

### `src/app/design-system/_fixtures/drummond/vendors.ts` (fixture, static export)

**Analog:** `src/app/design-system/_fixtures/vendors.ts` (lines 10-100)

**Type + array shape** (lines 10-35):
```typescript
export type SampleVendor = {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  default_cost_code_id: string | null;
};

export const SAMPLE_VENDORS: SampleVendor[] = [
  {
    id: "v-coastal-carpentry",
    name: "Coastal Carpentry Co.",
    address: "1418 Bayshore Dr, St. Petersburg, FL 33704",
    phone: "(727) 555-0181",
    email: "billing@coastalcarpentry.example",
    default_cost_code_id: "cc-06101", // Framing — Rough Carpentry
  },
  // ...
];
```

**Apply to drummond/vendors.ts:**
- `DrummondVendor` type (same shape as `SampleVendor`)
- `DRUMMOND_VENDORS` array — 17 entries per AUTO-LOG (14 fictional + 3 NO-SUB for Ferguson/FPL/Home Depot per nwrp27 RULE 1)
- Long names are the stress test (e.g., "Florida Sunshine Carpentry", "ML Concrete LLC") — verify this layout doesn't break List+Detail mobile rendering
- IDs prefixed `v-caldwell-` (per CONTEXT D-27 + nwrp31 #7) to avoid collision with playground `v-coastal-carpentry`

---

### `src/app/design-system/_fixtures/drummond/cost-codes.ts` (fixture, static export)

**Analog:** `src/app/design-system/_fixtures/cost-codes.ts` (lines 8-30)

**Type + first entry** (lines 8-30):
```typescript
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
  // ...
];
```

**Apply to drummond/cost-codes.ts:** same `SampleCostCode` shape (renamed `DrummondCostCode`). Drummond uses 5-digit codes mapping AIA G703 — extract from `Drummond - Line Items Cost Coded.pdf` (Source 1) per CONTEXT 1.1. Sort_order matches G703 row order in Pay App 5.

---

### `src/app/design-system/_fixtures/drummond/invoices.ts` (fixture, static export)

**Analog:** `src/app/design-system/_fixtures/invoices.ts` (lines 11-97 + ~12 entries through line 566)

**Type definitions** (lines 11-60):
```typescript
export type SampleInvoiceType = "progress" | "time_and_materials" | "lump_sum";

export type SampleInvoiceStatus =
  | "received" | "ai_processed" | "pm_review" | "pm_approved" | "pm_held" | "pm_denied"
  | "qa_review" | "qa_approved" | "qa_kicked_back" | "pushed_to_qb" | "in_draw" | "paid";

export type SampleInvoiceLineItem = {
  description: string;
  date: string | null;
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
  invoice_date: string | null;
  description: string;
  invoice_type: SampleInvoiceType;
  total_amount: number; // cents
  confidence_score: number; // 0-1
  confidence_details: { ... 5 fields, each 0-1 ... };
  status: SampleInvoiceStatus;
  received_date: string;
  payment_date: string | null;
  line_items: SampleInvoiceLineItem[];
  flags: string[];
};
```

**Sample entry — clean PDF, high confidence, pm_approved** (lines 64-97):
```typescript
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
    { description: "Rough-in plumbing — Phase 2 progress (40%)", date: null, qty: null, unit: null, rate: null, amount: 1_860_000 },
  ],
  flags: [],
},
```

**Apply to drummond/invoices.ts:**
- `DrummondInvoice` type EXTENDS `SampleInvoice` (per CONTEXT D-005). Additional fields if needed: `original_file_url` (string for fixture path), `co_id` (link to change order — already supported via `co_reference_raw` in CLAUDE.md schema).
- Per EXPANDED-SCOPE deliverable #2: ≥4 invoices spanning the workflow (ai_processed yellow, pm_review yellow, qa_review green, paid). Three format types per CLAUDE.md (clean PDF, T&M, lump-sum).
- Per D-19 fallback: if manual Read for ~94 PDFs is too slow, parse only 4-6 priority invoices manually; render rest with line-item summaries from pay apps.

**Sample entry — T&M, mid-confidence, pm_review** (`_fixtures/invoices.ts:99-165`) is the analog for T&M (Drummond Pay App 5 has Florida Sunshine Carpentry T&M invoices — daily labor entries).

---

### `src/app/design-system/_fixtures/drummond/draws.ts` (fixture, static export)

**Analog:** `src/app/design-system/_fixtures/draws.ts` (lines 7-150)

**Type + first entry** (lines 7-61):
```typescript
export type SampleDrawStatus =
  | "draft" | "pm_review" | "approved" | "submitted" | "paid" | "void";

export type SampleDraw = {
  id: string;
  job_id: string;
  draw_number: number;
  application_date: string;
  period_start: string;
  period_end: string;
  status: SampleDrawStatus;
  revision_number: number;

  // G702 summary fields (cents) — pre-rolled for display fidelity.
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
  // ...
];
```

**Apply to drummond/draws.ts:**
- `DrummondDraw` type same shape; 5 entries (Drs 1-5 per Source 3 inventory; per EXPANDED-SCOPE deliverable #3, Pay App 5 is the canonical render target).
- Numbers extracted from XLSX pay apps via the sanitization script.
- **Per CONTEXT 1.1** "Drummond Pay App 8" reference in CLAUDE.md does NOT match Source 3 inventory (5 pay apps, not 8) — flag as polish requirement.

**Note: `_fixtures/draws.ts` already has `draw_line_items` shape implied via the G702 fields. Drummond will need a separate `draw_line_items.ts` if rendering full G703 detail (one per cost code per draw — 20-50 rows per pay app per CONTEXT 1.1). Treat as part of `drummond/draws.ts` if rolled in, OR add a sibling `drummond/draw-line-items.ts` to keep file granularity matched to fixture-per-entity convention.**

---

### `src/app/design-system/_fixtures/drummond/change-orders.ts` (fixture, static export)

**Analog:** `src/app/design-system/_fixtures/change-orders.ts` (lines 7-44)

**Type + first entry** (lines 7-44):
```typescript
export type SampleChangeOrderStatus =
  | "draft" | "pending_approval" | "approved" | "executed" | "void";

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
  approved_date: string | null;
  draw_number: number | null; // which draw billed
};

export const SAMPLE_CHANGE_ORDERS: SampleChangeOrder[] = [
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
  // ...
];
```

**Apply to drummond/change-orders.ts:**
- `DrummondChangeOrder` type same shape.
- 4-6 CO chain per CONTEXT 1.1 (PCCO logs implicit in Pay App PDFs G702 cover sheets).
- Drummond default GC fee 20% (some at 18%, some "no fee" per CLAUDE.md).
- Tests "complex CO chains affecting multiple budget lines" (deliverable acceptance criterion).

---

### `src/app/design-system/_fixtures/drummond/budget.ts` (fixture, static export)

**Analog:** No direct existing fixture (no `budget.ts` exists in playground `_fixtures/`). Mirror `cost-codes.ts` shape for type discipline.

**Pattern to follow** — mirror existing fixture file shape, define new `DrummondBudgetLine` type per CONTEXT D-005:

```typescript
// New shape, mirrors CLAUDE.md budget_lines schema with computed fields
// LEFT OFF the type per R.2 "Recalculate, don't increment".
export type DrummondBudgetLine = {
  id: string;
  job_id: string;
  cost_code_id: string;
  original_estimate: number; // cents
  revised_estimate: number;  // cents (original + approved COs)
};

export const DRUMMOND_BUDGET_LINES: DrummondBudgetLine[] = [
  // 25-50 line items per CONTEXT 1.1 — extracted from Drummond_Budget_2026-04-15.xlsx
];
```

**Computed fields (NEVER stored, always derived per R.2 / CLAUDE.md):**
- `previous_applications` — sum of invoices in prior draws (from `DRUMMOND_INVOICES.filter(i => i.draw_id === priorDraw.id)`)
- `this_period` — sum of invoices in current draw
- `total_to_date` — `previous + this_period`
- `percent_complete` — `total_to_date / revised_estimate`
- `balance_to_finish` — `revised_estimate - total_to_date`

**Where computation lives:** the prototype budget page (`prototypes/jobs/[id]/budget/page.tsx`) computes these on-render from fixture arrays — NOT pre-baked into the fixture (per CLAUDE.md "Recalculate, don't increment" R.2).

---

### `src/app/design-system/_fixtures/drummond/lien-releases.ts` (fixture, static export)

**Analog:** No existing playground fixture. Mirror fixture file shape; new type per CONTEXT D-005 (4-statute enum + status without history JSONB per gap #7).

**Pattern to follow:**
```typescript
// New shape — Florida 4-statute lien release types per CONTEXT 1.1.
// status_history JSONB column missing in production DB (CURRENT-STATE A.2 R.7
// violation, F1 fixes). For 1.5b prototype: render the 4-status enum WITHOUT
// JSONB drilldown, OR fake a history client-side and label it explicitly.

export type DrummondLienReleaseType =
  | "conditional_progress"        // Florida statute 713.20(2)(a)
  | "unconditional_progress"      // Florida statute 713.20(2)(c)
  | "conditional_final"           // Florida statute 713.20(2)(b)
  | "unconditional_final";        // Florida statute 713.20(2)(d)

export type DrummondLienReleaseStatus =
  | "not_required" | "pending" | "received" | "waived";

export type DrummondLienRelease = {
  id: string;
  job_id: string;
  vendor_id: string;
  invoice_id: string;
  draw_id: string | null;
  release_type: DrummondLienReleaseType;
  status: DrummondLienReleaseStatus;
  release_date: string | null; // YYYY-MM-DD
  amount_through: number; // cents — amount through which release applies
};

export const DRUMMOND_LIEN_RELEASES: DrummondLienRelease[] = [
  // Extracted from Drummond-Nov 2025 Lien Releases.pdf
];
```

**Apply to drummond/lien-releases.ts:**
- Pure constants, no live imports.
- Tests "Lien release prototype renders Florida 4-statute types correctly" (acceptance criterion).
- Source: `Drummond-Nov 2025 Lien Releases.pdf` (companion to combined invoice batch per CONTEXT 1.1).

---

### `src/app/design-system/_fixtures/drummond/schedule.ts` (fixture, static export)

**Analog:** No existing playground fixture (Wave 2 entity per Q2 override C). Mirror fixture file shape; new type per CONTEXT D-011.

**Pattern to follow** (per CONTEXT D-011 — proposed shape, F1 may revise):
```typescript
// Wave 2 preview surface per Q2 override C. NOT canonical schema —
// schema lock happens in F1; 1.5b implementation may discover real
// complexity that informs F1 revision.

export type DrummondScheduleStatus =
  | "not_started" | "in_progress" | "complete" | "blocked";

export type DrummondScheduleItem = {
  id: string;
  job_id: string;
  name: string;
  start_date: string;          // ISO date
  end_date: string;            // ISO date
  predecessor_ids: string[];   // dependencies
  parent_id?: string;          // hierarchical tasks (constant in real construction schedules)
  assigned_vendor_id?: string;
  percent_complete: number;    // 0-1
  status: DrummondScheduleStatus;
  is_milestone: boolean;       // milestones render as diamonds in Gantt, not bars; pay app dates are milestones
};

export const DRUMMOND_SCHEDULE_ITEMS: DrummondScheduleItem[] = [
  // ≥20 tasks per acceptance criterion. Source:
  //   Schedule_List_Drummond-501 74th St.xlsx
  //   Schedule_Gantt_Drummond-501 74th St (12).pdf
  // (per D-12 — use real Drummond Schedule_*.xlsx data, NOT reconstructed
  // dates from pay app + lien dates as EXPANDED-SCOPE §1.2 hedged).
];
```

**Apply to drummond/schedule.ts:**
- Pure constants, no live imports.
- 6+ month timeline + 20+ tasks + dependencies visible + today-marker clear (acceptance criterion).
- Used by `prototypes/jobs/[id]/schedule/page.tsx` Gantt render.

---

### `src/app/design-system/_fixtures/drummond/payments.ts` (fixture, static export)

**Analog:** No existing playground fixture. Mirror fixture file shape; new type per CONTEXT D-005 (inferred from invoice fields per CURRENT-STATE A.2 — `payments` is PARTIAL, projected from `invoices.payment_date` + `check_number`).

**Pattern to follow:**
```typescript
// Per CONTEXT 1.1 — payments is PARTIAL, projected from invoices columns.
// F1 promotes to first-class entity. For 1.5b prototype: show inferred
// payment record from invoice fields. Payment date computed from
// received_date via Ross Built rule (received by 5th → 15th, by 20th → 30th)
// — see src/lib/payment-schedule.ts for the canonical math (NOT for import,
// fixture is pure data).

export type DrummondPayment = {
  id: string;
  invoice_id: string;
  job_id: string;
  vendor_id: string;
  amount: number;            // cents
  check_number: string | null;
  payment_date: string;      // YYYY-MM-DD — computed from received_date
  picked_up: boolean;
  picked_up_at: string | null;
};

export const DRUMMOND_PAYMENTS: DrummondPayment[] = [
  // Inferred from sanitized DRUMMOND_INVOICES rows where status is in
  // ['paid'] (per CLAUDE.md SPENT_STATUSES + payment-schedule.ts logic).
];
```

---

### `src/app/design-system/_fixtures/drummond/reconciliation.ts` (fixture, static export)

**Analog:** No existing playground fixture. NEW shape — paired imported/current per CONTEXT D-009.

**Pattern to follow:**
```typescript
// Drummond drift fixtures derived from real Source 3 invoice-vs-PO and
// pay-app-vs-budget mismatches. Per CONTEXT D-009 — paired
// `imported` / `current` shapes for ReconciliationStrawman 4 candidates ×
// 2 drift types. Q6 = A primary (invoice ↔ PO) + B secondary (draw ↔ budget).

export type DrummondReconciliationDriftType =
  | "invoice_po"    // canonical example per D-028
  | "draw_budget";

export type DrummondReconciliationPair = {
  id: string;
  drift_type: DrummondReconciliationDriftType;
  imported: Record<string, unknown>;  // QuickBooks / external snapshot
  current:  Record<string, unknown>;  // Nightwork current state
  // Field-level diff highlighting per the strawman candidates
  diffs: Array<{ field: string; imported_value: unknown; current_value: unknown }>;
};

export const DRUMMOND_RECONCILIATION_PAIRS: DrummondReconciliationPair[] = [
  // 4 candidates × 2 drift types = 8 prototype pairs (per Q3=C, Q6=A+B).
];
```

**Apply to drummond/reconciliation.ts:**
- Mirrors existing `ReconciliationStrawman` function in `patterns/page.tsx:1149-1279` (which already implements the 4 candidate visual shapes: side-by-side delta, inline diff, timeline overlay, hybrid split+inline).
- Reuses 1.5a-locked PATTERNS.md §11 strawman — does NOT diverge per A16.1 (would force forbidden rewrite).

---

### `.github/workflows/drummond-grep-check.yml` (config / CI, batch)

**Analog:** NO precedent — `.github/` does not exist in repo as of 2026-05-01.

**What the workflow must do (from D-20 + D-21):**
1. Trigger on `pull_request` and `push` to main.
2. Run `git grep` against `src/app/design-system/_fixtures/drummond/` for hardcoded list of ~17-20 high-risk Drummond identifiers.
3. Hardcoded list (must be kept in sync with gitignored SUBSTITUTION-MAP.md per D-22):
   - "Drummond"
   - "501 74th"
   - "Holmes Beach"
   - 17 vendor real names (locked in SUBSTITUTION-MAP.md, mirrored here)
4. Fail CI if any match.

**Reference for GitHub Actions YAML structure** — none in this repo. Use the standard pattern:
```yaml
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
      - name: Check for real Drummond names
        run: |
          if git grep -E 'Drummond|501 74th|Holmes Beach|<vendor1>|<vendor2>|...' \
             -- 'src/app/design-system/_fixtures/drummond/'; then
            echo "FAIL: real Drummond identifier detected in sanitized fixtures"
            exit 1
          fi
```

**Note:** Per `vercel.json` evidence in AUTO-LOG (line 25), the project deploys via Vercel + GitHub. This is the first-ever GitHub Actions workflow in the repo — no internal precedent exists for YAML structure. Follow GitHub's published `actions/checkout@v4` standard.

---

### `src/app/design-system/prototypes/layout.tsx` (layout, render-only)

**Analog:** `src/app/design-system/layout.tsx` (lines 130-221) + `src/app/design-system/_components/DirectionPaletteShell.tsx` (lines 31-50)

**Parent layout chrome** (`src/app/design-system/layout.tsx:130-221`) — cannot be re-rendered (Next.js inherits via App Router). New `prototypes/layout.tsx` only needs to **OVERRIDE the DirectionPaletteShell** to lock direction=C palette=B per D-02.

**DirectionPaletteShell pattern** (`_components/DirectionPaletteShell.tsx:31-50`):
```typescript
export function DirectionPaletteShell({ children }: DirectionPaletteShellProps) {
  const params = useSearchParams();
  const direction = (params?.get("dir") ?? "A") as string;
  const palette = (params?.get("palette") ?? "B") as string;

  const validDir: Direction = direction === "B" || direction === "C" ? (direction as Direction) : "A";
  const validPalette: Palette = palette === "A" ? "A" : "B";

  return (
    <div
      data-direction={validDir}
      data-palette={validPalette}
      className="design-system-scope"
    >
      {children}
    </div>
  );
}
```

**Apply to prototypes/layout.tsx:**
```typescript
// prototypes/layout.tsx — overrides parent DirectionPaletteShell to LOCK
// the CP2 pick (Site Office direction + Set B palette) for all prototype
// routes. Per D-02 — prevents accidental flips during walkthrough.

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

**No imports from `@/lib/supabase|org|auth`** per hook T10c (verified in AUTO-LOG line 22).

**Note:** Parent `design-system/layout.tsx` already wraps children in `DirectionPaletteShell`. Need to verify Next.js semantics — if parent's shell wraps the prototypes/layout.tsx output, this nested data-direction will override at the inner scope (CSS attribute selectors hit innermost ancestor first). If parent wraps and inner doesn't propagate, may need a different approach (e.g., a client component that strips parent's URL params or renders alongside DirectionPaletteSwitcher hidden).

---

### `src/app/design-system/prototypes/page.tsx` (page, render-only)

**Analog:** `src/app/design-system/page.tsx` (lines 95-238 — the playground index)

**Index landing structure** (lines 31-93):
```typescript
const SECTIONS: Array<{
  href: string;
  label: string;
  Icon: typeof Squares2X2Icon;
  blurb: string;
  why: string;
  tag: "CP2" | "REF";
}> = [
  {
    href: "/design-system/components/inputs",
    label: "Components",
    Icon: Squares2X2Icon,
    blurb: "Every primitive in COMPONENTS.md rendered live across 6 category pages...",
    why: "Compare how the playbook reads in the browser vs the doc.",
    tag: "REF",
  },
  // ...
];
```

**Card grid render pattern** (lines 131-213):
```typescript
<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
  {SECTIONS.map((section) => {
    const { Icon } = section;
    return (
      <Link key={section.href} href={section.href} className="group block ...">
        <Card padding="lg" className="h-full transition-colors duration-150 group-hover:border-[var(--border-strong)]">
          <div className="flex items-center justify-between mb-3">
            <Eyebrow tone="default" icon={<Icon ... />}>
              {section.label}
            </Eyebrow>
            <Badge variant={section.tag === "CP2" ? "accent" : "neutral"}>
              {section.tag === "CP2" ? "CP2 pick" : "Reference"}
            </Badge>
          </div>
          <h2 className="text-[18px] mb-2 ...">{section.label}</h2>
          <p className="text-[13px] mb-3 ...">{section.blurb}</p>
        </Card>
      </Link>
    );
  })}
</div>
```

**Apply to prototypes/page.tsx:**
- `SECTIONS` array maps to the 11 prototype routes (invoices, draws, draws-print, jobs/budget, jobs/schedule, vendors, documents, owner-portal, owner-portal/draws, reconciliation, mobile-approval).
- Each entry: `href`, `label`, `Icon` (Heroicons outline), `blurb` (what), `why` (validation goal), `tag` ("CP2-validate" — all are validation surfaces).
- Card grid render same shape as `design-system/page.tsx:131`.
- **Token discipline:** every color via `var(--bg-card)` / `var(--text-primary)` / `var(--border-default)` etc. NO hex.

---

### `src/app/design-system/prototypes/invoices/[id]/page.tsx` (page, render-only)

**Analog:** `src/app/design-system/patterns/page.tsx:259-407` — `Pattern1DocumentReview`

**Hero grid 50/50 layout pattern** (lines 314-404):
```typescript
{/* Hero grid 50/50 */}
<div
  className="grid grid-cols-1 lg:grid-cols-2"
  style={{ gap: "1px", background: "var(--border-default)" }}
>
  {/* LEFT — file preview */}
  <div className="p-5" style={{ background: "var(--bg-card)" }}>
    <Eyebrow tone="muted" className="mb-3">Source document</Eyebrow>
    <div
      className="aspect-[3/4] border flex flex-col items-center justify-center"
      style={{ background: "var(--bg-subtle)", borderColor: "var(--border-subtle)" }}
    >
      <PaperClipIcon className="w-8 h-8 mb-3" strokeWidth={1.25} />
      <span className="text-[10px] uppercase">Invoice PDF preview</span>
    </div>
  </div>

  {/* RIGHT — right-rail panels */}
  <div className="p-5 space-y-4" style={{ background: "var(--bg-card)" }}>
    <Card padding="md">
      <Eyebrow tone="accent" className="mb-3">Invoice details</Eyebrow>
      <div className="grid grid-cols-2 gap-3">
        <DataRow label="Total" value={<Money cents={inv.total_amount} size="lg" variant="emphasized" />} />
        <DataRow label="Vendor" value={vendor?.name} />
        <DataRow label="Project" value={job?.name} />
        <DataRow label="Cost code" value={costCode ? `${costCode.code} · ${costCode.description}` : "—"} />
        <DataRow label="Received" value={inv.received_date} />
        <DataRow label="Payment" value={inv.payment_date ?? "—"} />
      </div>
    </Card>
    <Card padding="md">
      <Eyebrow tone="muted" className="mb-2">Status timeline</Eyebrow>
      <ul className="space-y-2 text-[12px]">
        {[
          { when: "Apr 22 · 10:04", what: "RECEIVED via email-in", done: true },
          { when: "Apr 22 · 11:18", what: "PM APPROVED by Mark Henderson", done: true },
          // ...
        ].map((e, i) => ( <li key={i}>...</li> ))}
      </ul>
    </Card>
  </div>
</div>
```

**Apply to prototypes/invoices/[id]/page.tsx:**
- Import from `@/app/design-system/_fixtures/drummond` (NOT the playground `_fixtures/`).
- Look up invoice by route param `params.id` against `DRUMMOND_INVOICES`.
- Header band with breadcrumb + invoice number + vendor name + status badge + action buttons (Reject / Push to QB).
- Hero grid 50/50: file preview LEFT (placeholder per `lines 322-353` until react-pdf is wired), right-rail panels RIGHT.
- Status timeline at bottom — derived from `status_history` JSONB (CLAUDE.md schema) — for the prototype, fake the timeline from sanitized data.
- Per EXPANDED-SCOPE deliverable #2: 4 invoices (ai_processed, pm_review, qa_review, paid). Three format types (clean PDF, T&M, lump-sum).

---

### `src/app/design-system/prototypes/draws/[id]/page.tsx` (page, render-only — composite)

**Analog 1 (layout):** `src/app/design-system/patterns/page.tsx:259-407` — `Pattern1DocumentReview` (Document Review = gold standard for any review/approval surface per D-008 + PATTERNS.md §2)

**Analog 2 (G702/G703 visual contract):** `src/app/design-system/patterns/page.tsx:1048-1143` — `Pattern9PrintView`

**G703 simulated table pattern** (lines 1086-1133):
```typescript
{/* G703 simulated table */}
<table className="w-full text-[10px]" style={{
  fontFamily: "var(--font-jetbrains-mono)",
  fontVariantNumeric: "tabular-nums",
}}>
  <thead>
    <tr style={{ background: "var(--bg-subtle)" }}>
      {["Item", "Description", "Original", "Previous", "This period", "Total to date", "%", "Balance"].map((h) => (
        <th key={h} className="px-2 py-2 text-left border" style={{
          borderColor: "var(--border-default)",
          color: "var(--text-secondary)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontSize: "9px",
        }}>
          {h}
        </th>
      ))}
    </tr>
  </thead>
  <tbody>
    {rows.map((row) => (
      <tr key={row.item}>
        <td className="px-2 py-1.5 border" style={{ borderColor: "var(--border-subtle)" }}>{row.item}</td>
        <td className="px-2 py-1.5 border" style={{ borderColor: "var(--border-subtle)" }}>{row.desc}</td>
        <td className="px-2 py-1.5 border text-right" style={{ borderColor: "var(--border-subtle)" }}>${row.orig.toLocaleString()}</td>
        ...
      </tr>
    ))}
  </tbody>
</table>
```

**Apply to prototypes/draws/[id]/page.tsx:**
- Hero layout: G702 summary panel (LEFT) + G703 line items table (RIGHT) — Document Review extends to draw approval per D-008.
- Status timeline at bottom (Telex-ticker per Site Office direction).
- Action buttons: Submit / Send Back to Draft / Approve.
- Print button → router.push to `prototypes/draws/[id]/print/page.tsx`.

---

### `src/app/design-system/prototypes/draws/[id]/print/page.tsx` (page, render-only / print)

**Analog 1 (print stylesheet base):** `src/app/globals.css:255-289`

**Print stylesheet base** (full):
```css
@media print {
  /* Force light print background */
  html, body { background: #ffffff !important; color: #000000 !important; }

  /* Default: hide chrome that's not part of the printed content. Pages opt
     content INTO the print view by wrapping it in `.print-area`. */
  nav, header, footer, aside,
  .nav-bar, .nav-area, .sidebar,
  button, [role="button"],
  input, select, textarea,
  .no-print { display: none !important; }

  /* Tight, readable type for printed pages */
  body { font-size: 11pt; line-height: 1.4; }

  /* Tables: visible borders, no row hover */
  table { border-collapse: collapse !important; width: 100% !important; }
  table th, table td {
    border: 1px solid #999 !important;
    padding: 4px 6px !important;
    color: #000 !important;
  }
  table th { background: #f0f0f0 !important; font-weight: 600 !important; }

  /* Avoid awkward page splits inside common layout blocks */
  .print-area { max-width: 100% !important; padding: 0 !important; }
  .print-page-break { page-break-after: always; }
  .print-avoid-break { page-break-inside: avoid; }

  /* Make links print as plain text */
  a, a:visited { color: #000 !important; text-decoration: none !important; }
}
```

**Analog 2 (print toggle pattern):** `src/app/draws/[id]/page.tsx:269-470`

**`print:hidden` chrome + `hidden print:block` content** (lines 269 + 459-468):
```tsx
{/* Chrome — hidden in print */}
<div className="border-b border-[var(--border-default)] bg-[rgba(91,134,153,0.04)] px-6 py-5 print:hidden">
  <div className="max-w-[1600px] mx-auto flex items-center justify-between flex-wrap gap-4">
    {/* breadcrumbs, title, action buttons */}
    <div className="flex items-center gap-2 flex-wrap print:hidden">
      <button
        onClick={() => window.print()}
        className="px-4 py-2 border border-[var(--border-default)] ..."
        aria-label="Print this draw"
      >
        Print
      </button>
    </div>
  </div>
</div>

{/* Print-only header — appears at the top of the printed pay app. */}
<div className="hidden print:block mb-4">
  <h1 className="text-xl font-semibold">
    {draw.jobs?.name} — Draw #{draw.draw_number}
    {draw.revision_number > 0 && ` (Rev ${draw.revision_number})`}
  </h1>
  <p className="text-sm">
    Application Date: {formatDate(draw.application_date)} ·
    Period: {formatDate(draw.period_start)} – {formatDate(draw.period_end)}
  </p>
</div>

<main className="print-area max-w-[1600px] mx-auto px-4 md:px-6 py-6">
  {/* Real content rendered same in screen + print */}
</main>
```

**Apply to prototypes/draws/[id]/print/page.tsx:**
- **Per D-13 + D-15:** pure CSS `@page` + `@media print` against the existing component tree — NO server-side PDF generator (puppeteer/playwright).
- **Per D-15 (Q7 override):** G702 cover sheet attempts pixel-perfect (single page, strict layout) against `Pay Application #5 - Drummond-501 74th St.pdf`. G703 detail page accepts 80%.
- **Per D-15:** density forced compact via SYSTEM.md §10b's existing `@media print { :root { --density-row: var(--density-compact-row) } }`.
- **Per D-16 HALT POINT:** if pixel-perfect G702 attempt exceeds 1 day during execute, drop to 80% on both G702 and G703 and continue. Log as 1.5b-followup if pixel-perfect ultimately required for production.
- **Per D-14:** replicate the conditional-rendering pattern in real `src/app/draws/[id]/page.tsx:269-470`.

---

### `src/app/design-system/prototypes/jobs/[id]/budget/page.tsx` (page, render-only — composite)

**Analog 1 (page layout):** `src/app/design-system/patterns/page.tsx:483-584` — `Pattern3Dashboard` (Data-dense Overview pattern)

**KPI strip + attention-required pattern** (lines 511-581):
```typescript
{/* KPI strip */}
<div
  className="grid grid-cols-2 md:grid-cols-4"
  style={{
    gap: "1px",
    background: "var(--border-default)",
    borderTop: "1px solid var(--border-default)",
    borderBottom: "1px solid var(--border-default)",
  }}
>
  {kpis.map((k) => (
    <div key={k.label} className="p-4" style={{ background: "var(--bg-card)" }}>
      <Eyebrow tone="muted" className="mb-2">{k.label}</Eyebrow>
      <div className="text-[28px] mb-1" style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 600 }}>
        {k.value}
      </div>
      <div className="text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-accent)" }}>
        {k.sub}
      </div>
    </div>
  ))}
</div>
```

**Analog 2 (line-item DataGrid):** `src/app/design-system/components/data-display/page.tsx:367-660` — `DataGridSection`

**TanStack Table v8 setup** (lines 388-460):
```typescript
const columns = useMemo<ColumnDef<InvoiceRow>[]>(
  () => [
    {
      accessorKey: "invoice_number",
      header: "Invoice #",
      cell: (info) => (
        <span style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-primary)" }}>
          {info.getValue<string>()}
        </span>
      ),
    },
    {
      accessorKey: "total_amount",
      header: "Amount",
      cell: (info) => <NwMoney cents={info.getValue<number>()} size="md" />,
      sortingFn: "basic",
    },
    // ... more columns
  ],
  [],
);

const table = useReactTable({
  data,
  columns,
  state: { sorting, globalFilter },
  onSortingChange: setSorting,
  onGlobalFilterChange: setGlobalFilter,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
});
```

**Apply to prototypes/jobs/[id]/budget/page.tsx:**
- KPI strip top: original_estimate / committed / invoiced / balance — derived on-render from `DRUMMOND_BUDGET_LINES` + `DRUMMOND_INVOICES` + `DRUMMOND_PURCHASE_ORDERS` per R.2 "Recalculate, don't increment".
- DataGrid for budget lines (25-50 rows per CONTEXT 1.1) — TanStack Table v8 with sortable columns.
- Drilldown via slide-out (mirror real `src/app/jobs/[id]/budget/page.tsx:9` `SlideOutPanel` pattern, but stub it for prototype).
- Tests "DataGrid stress test" (acceptance criterion: 30+ line items render at compact density without horizontal scroll on `nw-tablet`).

---

### `src/app/design-system/prototypes/jobs/[id]/schedule/page.tsx` (page, render-only — Gantt)

**Analog (TanStack Table v8 base):** `src/app/design-system/components/data-display/page.tsx:367-660` — `DataGridSection`

**Per CONTEXT D-10:** Use TanStack Table v8 (already installed `@^8.21.3`) with **custom timeline cell renderers** — NOT from-scratch CSS grid. TanStack handles virtualization, sorting, column sizing; the schedule page writes only the bar-rendering logic on top.

**Pattern to apply** — extend the `DataGridSection` ColumnDef pattern with a custom cell renderer:
```typescript
// columns include task_name + dependencies + a single timeline column with
// custom cell renderer that draws a bar across the date range.

const columns = useMemo<ColumnDef<ScheduleRow>[]>(
  () => [
    { accessorKey: "name", header: "Task" },
    {
      id: "timeline",
      header: () => (/* date axis header — months across top */),
      cell: (info) => {
        const item = info.row.original;
        // compute % position + width relative to project date range
        // render absolute-positioned div as bar (or diamond if is_milestone)
        // status-based bar color via var(--nw-success/warn/danger/...)
        return (
          <div className="relative h-6 ...">
            <div
              className="absolute top-1 h-4 ..."
              style={{
                left: `${pctStart}%`,
                width: `${pctWidth}%`,
                background: statusColor(item.status),
              }}
            />
          </div>
        );
      },
    },
  ],
  [...],
);
```

**Apply to prototypes/jobs/[id]/schedule/page.tsx:**
- Per CONTEXT D-12: use real Drummond `Schedule_*.xlsx` data (NOT reconstructed dates).
- Per acceptance criterion: 6+ month timeline + 20+ tasks + dependencies visible + today-marker clear.
- Per CONTEXT 'deferred ideas': `frappe-gantt` is fallback if TanStack + custom cells prove insufficient — execute-phase decision.
- Site Office direction Gantt-specific density + timeline rendering — if readability fails, log as design-system polish requirement (does NOT halt phase).

---

### `src/app/design-system/prototypes/vendors/page.tsx` (page, render-only)

**Analog:** `src/app/design-system/patterns/page.tsx:818-869` — `Pattern6ListDetail`

**List + Detail layout** (lines 822-867):
```typescript
<Card padding="none">
  <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]" style={{ minHeight: "400px" }}>
    {/* List rail */}
    <div className="border-r" style={{ borderColor: "var(--border-default)" }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-default)" }}>
        <Eyebrow tone="muted">Invoices · 12 total</Eyebrow>
      </div>
      <ul>
        {list.map((inv, i) => (
          <li
            key={inv.id}
            className="px-4 py-3 border-b cursor-pointer"
            style={{
              borderColor: "var(--border-subtle)",
              background: i === selectedIdx ? "var(--bg-subtle)" : "transparent",
              borderLeft: i === selectedIdx ? "2px solid var(--nw-stone-blue)" : "2px solid transparent",
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[12px] font-medium truncate">{v?.name}</span>
              <Money cents={inv.total_amount} size="sm" />
            </div>
            <div className="text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
              {inv.invoice_number ?? "—"} · {inv.received_date}
            </div>
          </li>
        ))}
      </ul>
    </div>
    {/* Detail */}
    <div className="p-5">
      <Pattern1DocumentReviewMini invoiceIdx={selectedIdx} />
    </div>
  </div>
</Card>
```

**Apply to prototypes/vendors/page.tsx:**
- 17 Drummond vendors per CONTEXT 1.1.
- Long names stress test: "Florida Sunshine Carpentry" (substituted), "ML Concrete LLC" (substituted) — verify `truncate` Tailwind class still keeps card boundaries clean on mobile.
- Selected vendor renders sub-Pattern in right pane (mini detail card; or a route push to vendors/[id]/page.tsx for full detail).

---

### `src/app/design-system/prototypes/vendors/[id]/page.tsx` (page, render-only)

**Analog:** `src/app/design-system/patterns/page.tsx:259-407` — `Pattern1DocumentReview` (Document Review extends to vendor detail per D-008)

**Apply to prototypes/vendors/[id]/page.tsx:**
- Header band: vendor name + business type badge + action buttons.
- Hero grid: vendor profile fields LEFT (address, phone, email, default_cost_code) + activity panel RIGHT (recent invoices for this vendor, drilldown links).
- Status timeline at bottom: vendor verification events (W9 received, COI expires, etc. — fake the timeline).

---

### `src/app/design-system/prototypes/documents/[id]/page.tsx` (page, render-only)

**Analog:** `src/app/design-system/patterns/page.tsx:259-407` — `Pattern1DocumentReview`

**Apply to prototypes/documents/[id]/page.tsx:**
- 3 sub-prototypes per EXPANDED-SCOPE deliverable #7: plans, contracts, lien releases.
- Each renders Document Review pattern §2:
  - **Plans:** anonymized Drummond plan PDF preview (LEFT) + project / sheet / revision metadata (RIGHT).
  - **Contracts:** sanitized contract DOCX render (LEFT — mammoth converts DOCX to HTML per STACK.md) + scope summary (RIGHT).
  - **Lien releases:** PDF preview (LEFT) + 4-statute type + status + amount through date (RIGHT) + faked status_history timeline (BOTTOM, labeled "Note: status_history JSONB column missing — F1 fixes the schema. This timeline is faked client-side for prototype only.").

---

### `src/app/design-system/prototypes/owner-portal/page.tsx` (page, render-only)

**Analog:** `src/app/design-system/patterns/page.tsx:483-584` — `Pattern3Dashboard` (Data-dense Overview, but **simplified for non-builder homeowner audience**)

**Apply to prototypes/owner-portal/page.tsx:**
- **Per Q8=B:** dashboard + draw approval only (Wave 3 features defer to Wave 3 phase). NO photos / messages / lien viewer.
- KPI strip simplified for owner: Contract amount / Paid to date / Balance to finish / Next draw date.
- Attention-required list scoped to owner: Draws awaiting approval / Recent activity.
- **Trust posture test (per CONTEXT R5):** Site Office direction may feel too archival for non-builder homeowner audience — surface as "lighter variant" finding if it does.

---

### `src/app/design-system/prototypes/owner-portal/draws/[id]/page.tsx` (page, render-only)

**Analog:** `src/app/design-system/patterns/page.tsx:259-407` — `Pattern1DocumentReview` (Document Review = gold standard, simplified for owner audience)

**Apply to prototypes/owner-portal/draws/[id]/page.tsx:**
- **Per CONTEXT 5 Construction-domain checklist "Cost-plus open-book transparency":** owner sees every line item. No jargon, larger type, total transparency.
- Hero layout: G702 summary LEFT (simpler labels than builder version) + G703 line items RIGHT (with vendor names visible, NOT just cost codes).
- Action buttons: Approve / Request Clarification.
- Tests Site Office trust posture for non-builder audience.

---

### `src/app/design-system/prototypes/reconciliation/page.tsx` (page, render-only)

**Analog:** `src/app/design-system/patterns/page.tsx:1149-1279` — `ReconciliationStrawman`

**4 candidate render shapes** (lines 1167-1276):

**Candidate 1 — Side-by-side delta** (lines 1168-1193):
```typescript
<Card padding="md">
  <Eyebrow tone="accent" className="mb-2">Candidate 1 · Side-by-side delta</Eyebrow>
  <div className="grid grid-cols-2 gap-2 text-[12px]">
    <div className="border p-3" style={{ borderColor: "var(--border-default)" }}>
      <Eyebrow tone="muted" className="mb-2">Imported · QuickBooks</Eyebrow>
      <DataRow label="Vendor" value="Bayside Plumbing Inc" />
      <DataRow label="Total" value={<Money cents={1860000} size="sm" />} />
      <DataRow label="Cost code" value="10101" />
    </div>
    <div className="border p-3" style={{ borderColor: "var(--border-default)" }}>
      <Eyebrow tone="muted" className="mb-2">Current · Nightwork</Eyebrow>
      <DataRow label="Vendor" value="Bayside Plumbing Inc." />
      <DataRow label="Total" value={<Money cents={1860000} size="sm" />} />
      <div className="border-l-2 pl-2" style={{ borderColor: "var(--nw-warn)" }}>
        <DataRow label="Cost code" value="10201" />
      </div>
    </div>
  </div>
</Card>
```

**Candidate 2 — Inline diff** (lines 1196-1218): Stacked add/delete rows, JetBrains Mono, danger/success colors.
**Candidate 3 — Timeline overlay** (lines 1221-1248): single timeline list with imported/current/match circles.
**Candidate 4 — Hybrid (split + inline)** (lines 1251-1276): Top-level split + per-attribute inline diff.

**Apply to prototypes/reconciliation/page.tsx:**
- **Per D-007:** single page rendering 4×2 matrix top-to-bottom. Per drift-type sections: invoice↔PO (top), draw↔budget (bottom). Each section contains 4 candidate Cards stacked. Section anchors enable side-by-side scrolling comparison.
- **Per D-008:** EXTENDS existing `ReconciliationStrawman` function — does NOT diverge.
- **Per D-009:** uses `DRUMMOND_RECONCILIATION_PAIRS` fixture from `_fixtures/drummond/reconciliation.ts`.
- 4 candidates × 2 drift types = 8 prototypes (per Q3=C, Q6=A+B).

---

### `src/app/design-system/prototypes/mobile-approval/page.tsx` (page, render-only)

**Analog:** `src/app/design-system/patterns/page.tsx:590-718` — `Pattern4MobileApproval`

**Mobile viewport pattern** (lines 593-716):
```typescript
<div className="flex justify-center">
  <div
    className="w-[260px] border flex flex-col"
    style={{
      borderColor: "var(--border-default)",
      background: "var(--bg-card)",
      aspectRatio: "393 / 852", // iPhone 14 Pro shape
    }}
  >
    {/* Status bar */}
    <div className="h-4 flex items-center justify-between px-3 text-[9px]" style={{
      fontFamily: "var(--font-jetbrains-mono)",
      background: "var(--nw-slate-deeper)",
      color: "rgba(247,245,236,0.7)",
    }}>
      <span>9:41</span>
      <span>•••</span>
    </div>

    {/* App nav */}
    <div className="h-8 flex items-center justify-between px-3" style={{ background: "var(--nw-slate-deeper)" }}>
      <span className="w-1.5 h-1.5 bg-nw-stone-blue" style={{ borderRadius: "var(--radius-dot)" }} />
      <span className="text-[10px] font-medium" style={{ fontFamily: "var(--font-space-grotesk)", color: "var(--nw-white-sand)" }}>
        Nightwork
      </span>
    </div>

    {/* Sticky CTA — 56px high-stakes target per SYSTEM.md §11 / Q10=A */}
    <div className="p-2 border-t" style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}>
      <button
        type="button"
        className="w-full inline-flex items-center justify-center gap-1 text-[10px] font-medium uppercase"
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          letterSpacing: "0.12em",
          background: "var(--nw-stone-blue)",
          color: "var(--nw-white-sand)",
          padding: "10px 12px",
          minHeight: "40px", // NOTE: per Q10=A SYSTEM.md §11 target is 56px for HIGH-STAKES — adjust to 56px in 1.5b
        }}
      >
        Approve & Push to QB →
      </button>
    </div>
  </div>
</div>
```

**Apply to prototypes/mobile-approval/page.tsx:**
- **Per CONTEXT cross-cutting:** 56px high-stakes touch targets per Q10=A in 1.5a SYSTEM.md §11 (not the 40px in this analog — this analog used pre-CP2 spec; bump to 56px for 1.5b high-stakes).
- Pinch zoom on file preview (PDF rendering).
- Site Office compact density at 360px.
- **Real-device test on Jake's actual phone is a ship gate** (per Q5=B, M3 PENDING).
- Long vendor names render without breaking layout on `nw-phone` (acceptance criterion).

---

## Shared Patterns

### Token Discipline (applies to ALL prototype routes)

**Source:** `.planning/design/SYSTEM.md` + locked Slate tokens in `tailwind.config.ts` + `src/app/globals.css`

**Apply to:** All 11 prototype routes.

```typescript
// RIGHT — bracket-value with CSS var:
<div className="bg-[var(--bg-card)] text-[color:var(--text-primary)] border-[var(--border-default)]">

// RIGHT — nw-* utility aliases:
<div className="bg-nw-slate-tile text-nw-stone-blue">

// RIGHT — inline style with CSS var:
<span style={{ fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "0.14em", color: "var(--text-tertiary)" }}>

// WRONG — hardcoded hex:
<div className="bg-[#5b8699]"> {/* post-edit hook rejects */}
<div style={{ color: "#7d6e64" }}> {/* post-edit hook rejects */}
```

**Hook enforcement:** `.claude/hooks/nightwork-post-edit.sh:194-230` — T10c sample-data isolation in `src/app/design-system/*` plus hardcoded-hex rejection outside `globals.css` / `tailwind.config.*`.

---

### Site Office Variant (applies to ALL prototype routes)

**Source:** `src/app/design-system/design-system.css` (Site Office tokens via `[data-direction="C"]`) + locked at `prototypes/layout.tsx` (per D-02).

**Site Office defaults (locked per D-037):**
- UPPERCASE eyebrows + 0.18em tracking (vs Helm 0.14em)
- JetBrains Mono dominance (vs Specimen italic display)
- Compact density
- 1px slate-tile left-stamp (`--card-accent-border-side: left; --card-accent-border-color: var(--nw-slate-tile)`)
- 150ms ease-out

**Apply to:** All 11 prototype routes via inherited `data-direction="C"` from `prototypes/layout.tsx`. NO per-component direction overrides — inheritance handles it.

---

### Hook T10c Sample-Data Isolation (applies to ALL prototype routes + fixtures)

**Source:** `.claude/hooks/nightwork-post-edit.sh:194-230`

**Apply to:** All `src/app/design-system/prototypes/**/*.tsx` and `src/app/design-system/_fixtures/drummond/**/*.ts`.

**Forbidden imports** (post-edit hook rejects):
```typescript
import { ... } from "@/lib/supabase";    // BLOCKED in /design-system/*
import { ... } from "@/lib/supabase/server";  // BLOCKED
import { ... } from "@/lib/supabase/client";  // BLOCKED
import { getCurrentMembership } from "@/lib/org/session";  // BLOCKED
import { ... } from "@/lib/auth";  // BLOCKED
```

**Permitted imports:**
```typescript
import type { ... } from "@/lib/supabase/types/...";  // type-only OK
import { SAMPLE_INVOICES } from "@/app/design-system/_fixtures";  // OK
import { DRUMMOND_INVOICES } from "@/app/design-system/_fixtures/drummond";  // OK (inherits)
import Card from "@/components/nw/Card";  // OK
import { Combobox } from "@/components/ui/combobox";  // OK
```

---

### Heroicons Outline (applies to ALL prototype routes)

**Source:** COMPONENTS.md §A12.2 Icon Library Boundary

**Apply to:** All prototype routes. Heroicons everywhere outside `src/components/ui/`; Lucide only inside shadcn primitives.

**Pattern** (analog: `src/app/design-system/patterns/page.tsx:15-31`):
```typescript
import {
  DocumentTextIcon,
  CheckBadgeIcon,
  ChartBarIcon,
  DevicePhoneMobileIcon,
  PaperClipIcon,
  // ...
} from "@heroicons/react/24/outline";

// Always use 24/outline variant. Apply strokeWidth={1.5} for nav, 1.25 for hero.
<PaperClipIcon className="w-8 h-8 mb-3" style={{ color: "var(--text-tertiary)" }} strokeWidth={1.25} />
```

---

### Recalculate, Don't Increment (applies to budget + draw prototypes)

**Source:** `CLAUDE.md` Development Rules + `.planning/codebase/CONVENTIONS.md:280-305` (R.2)

**Apply to:** `prototypes/jobs/[id]/budget/page.tsx`, `prototypes/draws/[id]/page.tsx`, `prototypes/owner-portal/draws/[id]/page.tsx`.

**Pattern:**
```typescript
// Compute `previous_applications` / `total_to_date` / `percent_complete`
// from source-of-truth fixture rows on render. Do NOT pre-bake these
// into the fixture (per R.2 — increments drift; recalculation is the
// only correct posture, even in prototypes).

const previous_applications = useMemo(() => {
  return DRUMMOND_INVOICES
    .filter((i) => i.cost_code_id === budgetLine.cost_code_id && i.draw_id < currentDraw.id)
    .reduce((sum, i) => sum + i.total_amount, 0);
}, [budgetLine.cost_code_id, currentDraw.id]);

const this_period = useMemo(() => {
  return DRUMMOND_INVOICES
    .filter((i) => i.cost_code_id === budgetLine.cost_code_id && i.draw_id === currentDraw.id)
    .reduce((sum, i) => sum + i.total_amount, 0);
}, [budgetLine.cost_code_id, currentDraw.id]);

const total_to_date = previous_applications + this_period;
const percent_complete = total_to_date / budgetLine.revised_estimate;
const balance_to_finish = budgetLine.revised_estimate - total_to_date;
```

---

### Substitution Map Privacy (applies to ALL `_fixtures/drummond/*.ts` files)

**Source:** `.planning/fixtures/drummond/SUBSTITUTION-MAP.md` (gitignored, locked 2026-05-01 per AUTO-LOG line 99)

**Apply to:** ALL `_fixtures/drummond/*.ts` files (jobs, vendors, cost-codes, invoices, draws, etc.) and `scripts/sanitize-drummond.ts`.

**Locked substitutions (per AUTO-LOG):**
- Owner surname: **Caldwell** (substitutes "Drummond")
- Site address: **712 Pine Ave, Anna Maria FL 34216** (substitutes "501 74th St, Holmes Beach FL")
- Job code: **GC0501**
- 17 vendor mappings (14 fictional + 3 NO-SUB for Ferguson/FPL/Home Depot per nwrp27 RULE 1)

**Two-tier grep gate (per D-20):**
1. **Extractor-side** (`scripts/sanitize-drummond.ts`) — runs before writing sanitized output, reads real-name list from gitignored SUBSTITUTION-MAP.md, fails extraction if real names detected post-substitution.
2. **CI-side** (`.github/workflows/drummond-grep-check.yml`) — runs against committed `src/app/design-system/_fixtures/drummond/*.ts` to catch hand-written drift bypassing the extractor. Hardcoded list of ~17-20 high-risk Drummond identifiers.

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md / external precedent instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `scripts/sanitize-drummond.ts` | utility | batch / file-I/O | The exceljs read pattern has a precedent (`scripts/inspect-xlsx.mjs`), but the substitution + grep-gate logic is genuinely new. No prior sanitization script exists in the repo. |
| `.github/workflows/drummond-grep-check.yml` | config / CI | batch | NO `.github/` directory exists in the repo (verified via Glob). This is the first GitHub Actions workflow. Use GitHub's published `actions/checkout@v4` standard YAML structure. |

---

## Metadata

**Analog search scope:**
- `src/app/design-system/_fixtures/` (all .ts files)
- `src/app/design-system/layout.tsx` + `_components/`
- `src/app/design-system/page.tsx`
- `src/app/design-system/patterns/page.tsx` (1715 lines — targeted reads)
- `src/app/design-system/components/data-display/page.tsx`
- `src/app/design-system/design-system.css`
- `src/app/draws/[id]/page.tsx` (production print pattern precedent)
- `src/app/jobs/[id]/budget/page.tsx` (production budget page precedent)
- `src/app/vendors/page.tsx` (production vendor list precedent)
- `src/app/globals.css:255-289` (print stylesheet base)
- `src/middleware.ts:85-117` (gating pattern)
- `scripts/inspect-xlsx.mjs` (exceljs precedent)
- `.planning/codebase/{STRUCTURE,CONVENTIONS,STACK}.md`
- `.planning/expansions/stage-1.5b-prototype-gallery-{EXPANDED-SCOPE,AUTO-LOG}.md`
- `.planning/phases/stage-1.5b-prototype-gallery/CONTEXT.md`

**Files scanned:** 19

**Pattern extraction date:** 2026-05-01

---

*Pattern map: stage-1.5b-prototype-gallery*
