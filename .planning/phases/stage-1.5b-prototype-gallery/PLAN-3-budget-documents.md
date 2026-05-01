---
phase: stage-1.5b-prototype-gallery
plan: 3
type: execute
wave: 1
depends_on: [1]
files_modified:
  - src/app/design-system/prototypes/jobs/[id]/budget/page.tsx
  - src/app/design-system/prototypes/documents/[id]/page.tsx
autonomous: true
threat_model_severity: low
requirements: []
must_haves:
  truths:
    - "User can view Drummond budget at /design-system/prototypes/jobs/j-drummond/budget with KPI strip + 25+ line items"
    - "Computed fields (previous_applications, this_period, total_to_date, percent_complete, balance_to_finish) derived on render from DRUMMOND_INVOICES (per R.2 recalculate-don't-increment)"
    - "TanStack Table v8 renders 25+ budget line items in compact density without horizontal scroll on nw-tablet (≥768px)"
    - "User can view documents at /design-system/prototypes/documents/{id} for plans, contracts, and lien releases"
    - "Lien release prototype renders all 4 Florida statute types correctly"
    - "Lien release prototype labels faked status_history client-side (per F1 gap)"
    - "All routes inherit Site Office direction from prototypes/layout.tsx"
    - "All routes pass hook T10c (no @/lib/supabase|org|auth imports)"
  artifacts:
    - path: "src/app/design-system/prototypes/jobs/[id]/budget/page.tsx"
      provides: "Budget view prototype — Pattern3Dashboard KPI strip + DataGrid (TanStack Table v8) for budget lines"
      contains: "DRUMMOND_BUDGET_LINES"
    - path: "src/app/design-system/prototypes/documents/[id]/page.tsx"
      provides: "Document review prototype — handles 3 document types (plans, contracts, lien releases) via type discriminator"
      contains: "DRUMMOND_LIEN_RELEASES"
  key_links:
    - from: "prototypes/jobs/[id]/budget/page.tsx"
      to: "DRUMMOND_BUDGET_LINES + DRUMMOND_INVOICES + DRUMMOND_COST_CODES + DRUMMOND_JOBS + DRUMMOND_CHANGE_ORDERS"
      via: "named imports + on-render computation"
      pattern: "DRUMMOND_BUDGET_LINES"
    - from: "prototypes/jobs/[id]/budget/page.tsx"
      to: "@tanstack/react-table v8"
      via: "useReactTable + ColumnDef + getCoreRowModel + getSortedRowModel"
      pattern: "useReactTable"
    - from: "prototypes/documents/[id]/page.tsx"
      to: "DRUMMOND_LIEN_RELEASES + DRUMMOND_VENDORS + DRUMMOND_INVOICES"
      via: "named imports + lookup by document id prefix"
      pattern: "DRUMMOND_LIEN_RELEASES"
---

<objective>
Render the budget view (Pattern3Dashboard + DataGrid stress test) and document review (3 document types: plans, contracts, lien releases). Both extend established 1.5a patterns with real-shape Drummond complexity.

Purpose:
- Budget view tests the DataGrid stress case (25+ line items at compact Site Office density without horizontal scroll on tablet) and validates R.2 "recalculate, don't increment" applies even in prototype contexts.
- Document review extends Pattern1DocumentReview to non-invoice/non-draw document types (plans, contracts, lien releases) — exercises the gold-standard pattern for Wave 2 / future surfaces.

Output:
- Budget prototype at `/design-system/prototypes/jobs/{id}/budget`
- Documents prototype at `/design-system/prototypes/documents/{id}` handling type discriminator
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
@.planning/phases/stage-1.5b-prototype-gallery/stage-1.5b-prototype-gallery-1-SUMMARY.md
@CLAUDE.md
@.planning/design/SYSTEM.md
@.planning/design/COMPONENTS.md
@.planning/design/PATTERNS.md
@src/app/design-system/_fixtures/drummond/index.ts
@src/app/design-system/_fixtures/drummond/types.ts
@src/app/design-system/patterns/page.tsx
@src/app/design-system/components/data-display/page.tsx
@src/app/design-system/prototypes/layout.tsx
@src/components/nw/Card.tsx
@src/components/nw/Eyebrow.tsx
@src/components/nw/Money.tsx
@src/components/nw/DataRow.tsx
@src/components/nw/Badge.tsx

<interfaces>
<!-- Drummond fixture types from Wave 0. Available via:
       import { ... } from "@/app/design-system/_fixtures/drummond";

DrummondBudgetLine (per R.2 — computed fields LEFT OFF the type):
  type DrummondBudgetLine = {
    id: string;
    job_id: string;
    cost_code_id: string;
    original_estimate: number;    // cents
    revised_estimate: number;     // cents (original + approved COs)
  };

DrummondLienRelease + types:
  type DrummondLienReleaseType = "conditional_progress" | "unconditional_progress" | "conditional_final" | "unconditional_final";
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

<!-- TanStack Table v8 (already shipped — package.json: @tanstack/react-table@^8.21.3).
     Existing usage analog: src/app/design-system/components/data-display/page.tsx:367-660. -->

import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
         type ColumnDef, type SortingState, flexRender } from "@tanstack/react-table";

ColumnDef shape (analog from data-display/page.tsx:388-460):
  const columns: ColumnDef<RowType>[] = [
    {
      accessorKey: "field_name",
      header: "Header label",
      cell: (info) => /* render cell */,
      sortingFn: "basic",
    },
    // ...
  ];

useReactTable shape:
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Budget view prototype (KPI strip + DataGrid stress test)</name>
  <files>src/app/design-system/prototypes/jobs/[id]/budget/page.tsx</files>

  <read_first>
    - src/app/design-system/patterns/page.tsx (lines 483-584 Pattern3Dashboard — KPI strip + attention-required pattern)
    - src/app/design-system/components/data-display/page.tsx (lines 367-660 DataGridSection — TanStack Table v8 setup, ColumnDef pattern, sorting state)
    - src/app/design-system/_fixtures/drummond/budget.ts (full file — DRUMMOND_BUDGET_LINES; ≥25 entries)
    - src/app/design-system/_fixtures/drummond/invoices.ts (for computing previous_applications + this_period — filter by cost_code_id + draw_id)
    - src/app/design-system/_fixtures/drummond/cost-codes.ts (resolve cost_code_id → code+description)
    - src/app/design-system/_fixtures/drummond/jobs.ts (resolve job_id → job)
    - src/app/design-system/_fixtures/drummond/change-orders.ts (for KPI "approved COs" sum)
    - src/app/design-system/_fixtures/drummond/draws.ts (for "current draw" identification — Pay App 5)
    - .planning/design/PATTERNS.md §4 (Data-dense Overview)
    - CLAUDE.md (R.2 "Recalculate, don't increment" — must compute these fields on render, not pre-bake into fixture)
    - src/components/nw/Card.tsx + Eyebrow.tsx + Money.tsx + DataRow.tsx + Badge.tsx
  </read_first>

  <action>
**Create `src/app/design-system/prototypes/jobs/[id]/budget/page.tsx`:**

Compose Pattern3Dashboard (KPI strip) + DataGrid (TanStack Table v8) for budget lines. Per R.2, ALL computed fields (`previous_applications`, `this_period`, `total_to_date`, `percent_complete`, `balance_to_finish`) derived on-render from `DRUMMOND_INVOICES` — NEVER pre-baked into the fixture.

```typescript
// src/app/design-system/prototypes/jobs/[id]/budget/page.tsx
//
// Budget view prototype — Pattern3Dashboard (KPI strip) + DataGrid
// (TanStack Table v8 budget line items). Per Stage 1.5b deliverable #5.
//
// Per R.2 "Recalculate, don't increment" — every computed field
// (previous_applications, this_period, total_to_date, percent_complete,
// balance_to_finish) is derived on-render from DRUMMOND_INVOICES,
// NOT pre-baked into DRUMMOND_BUDGET_LINES (the type contract excludes them).
//
// Stress test: 25+ line items must render at compact Site Office density
// without horizontal scroll on nw-tablet (≥768px).
//
// Hook T10c — no imports from @/lib/supabase|org|auth.

"use client";

import { useMemo, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

import {
  DRUMMOND_BUDGET_LINES,
  DRUMMOND_INVOICES,
  DRUMMOND_COST_CODES,
  DRUMMOND_JOBS,
  DRUMMOND_CHANGE_ORDERS,
  DRUMMOND_DRAWS,
  type DrummondBudgetLine,
} from "@/app/design-system/_fixtures/drummond";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Money from "@/components/nw/Money";
import Badge from "@/components/nw/Badge";

// Computed shape per R.2 — never stored. Always derived on render.
type BudgetRow = DrummondBudgetLine & {
  cost_code_label: string;
  previous_applications: number;
  this_period: number;
  total_to_date: number;
  percent_complete: number;
  balance_to_finish: number;
};

export default function BudgetPrototypePage({ params }: { params: { id: string } }) {
  const job = DRUMMOND_JOBS.find((j) => j.id === params.id);
  if (!job) return notFound();

  // Identify "current draw" = the draw being prepared (or the latest paid).
  // For Drummond fixture, Pay App 5 is canonical (per EXPANDED-SCOPE deliverable #3).
  const currentDraw = DRUMMOND_DRAWS.find((d) => d.id === "d-drummond-05") ?? DRUMMOND_DRAWS[DRUMMOND_DRAWS.length - 1];

  // Per R.2 — compute on render from source-of-truth invoice fixture rows.
  const rows: BudgetRow[] = useMemo(() => {
    return DRUMMOND_BUDGET_LINES.filter((bl) => bl.job_id === job.id).map((bl) => {
      const cc = DRUMMOND_COST_CODES.find((c) => c.id === bl.cost_code_id);

      // Sum invoices in PRIOR draws for this cost code.
      const previous_applications = DRUMMOND_INVOICES
        .filter((i) =>
          i.cost_code_id === bl.cost_code_id &&
          i.draw_id !== null &&
          i.draw_id !== currentDraw.id
        )
        .reduce((sum, i) => sum + i.total_amount, 0);

      // Sum invoices in CURRENT draw for this cost code.
      const this_period = DRUMMOND_INVOICES
        .filter((i) =>
          i.cost_code_id === bl.cost_code_id &&
          i.draw_id === currentDraw.id
        )
        .reduce((sum, i) => sum + i.total_amount, 0);

      const total_to_date = previous_applications + this_period;
      const percent_complete = bl.revised_estimate > 0 ? total_to_date / bl.revised_estimate : 0;
      const balance_to_finish = bl.revised_estimate - total_to_date;

      return {
        ...bl,
        cost_code_label: cc ? `${cc.code} · ${cc.description}` : "—",
        previous_applications,
        this_period,
        total_to_date,
        percent_complete,
        balance_to_finish,
      };
    });
  }, [job.id, currentDraw.id]);

  // KPI summary — also derived on render per R.2.
  const kpis = useMemo(() => {
    const originalSum = rows.reduce((s, r) => s + r.original_estimate, 0);
    const revisedSum = rows.reduce((s, r) => s + r.revised_estimate, 0);
    const totalToDateSum = rows.reduce((s, r) => s + r.total_to_date, 0);
    const balanceSum = rows.reduce((s, r) => s + r.balance_to_finish, 0);
    const approvedCOs = DRUMMOND_CHANGE_ORDERS
      .filter((co) => co.job_id === job.id && (co.status === "approved" || co.status === "executed"))
      .reduce((s, co) => s + co.total_with_fee, 0);
    const overUnderTotal = rows.filter((r) => r.balance_to_finish < 0).length;
    return { originalSum, revisedSum, totalToDateSum, balanceSum, approvedCOs, overUnderTotal };
  }, [rows, job.id]);

  // TanStack Table v8 setup — analog: data-display/page.tsx:388-460
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<BudgetRow>[]>(() => [
    {
      accessorKey: "cost_code_label",
      header: "Cost code",
      cell: (info) => (
        <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: "11px", color: "var(--text-primary)" }}>
          {info.getValue<string>()}
        </span>
      ),
    },
    {
      accessorKey: "original_estimate",
      header: "Original",
      cell: (info) => <Money cents={info.getValue<number>()} size="sm" />,
      sortingFn: "basic",
    },
    {
      accessorKey: "revised_estimate",
      header: "Revised",
      cell: (info) => <Money cents={info.getValue<number>()} size="sm" />,
      sortingFn: "basic",
    },
    {
      accessorKey: "previous_applications",
      header: "Previous",
      cell: (info) => <Money cents={info.getValue<number>()} size="sm" />,
      sortingFn: "basic",
    },
    {
      accessorKey: "this_period",
      header: "This period",
      cell: (info) => <Money cents={info.getValue<number>()} size="sm" />,
      sortingFn: "basic",
    },
    {
      accessorKey: "total_to_date",
      header: "Total to date",
      cell: (info) => <Money cents={info.getValue<number>()} size="sm" />,
      sortingFn: "basic",
    },
    {
      accessorKey: "percent_complete",
      header: "%",
      cell: (info) => {
        const pct = info.getValue<number>();
        const tone: "success" | "warn" | "danger" = pct > 1 ? "danger" : pct > 0.85 ? "warn" : "success";
        return <Badge variant={tone}>{(pct * 100).toFixed(1)}%</Badge>;
      },
      sortingFn: "basic",
    },
    {
      accessorKey: "balance_to_finish",
      header: "Balance",
      cell: (info) => {
        const bal = info.getValue<number>();
        return <span style={{ color: bal < 0 ? "var(--nw-danger)" : "var(--text-primary)" }}><Money cents={bal} size="sm" /></span>;
      },
      sortingFn: "basic",
    },
  ], []);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="px-6 py-8 max-w-[1600px] mx-auto">
      {/* Header band */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[12px] mb-2" style={{ color: "var(--text-tertiary)" }}>
          <Link href="/design-system/prototypes/" className="hover:underline">Prototypes</Link>
          <span>/</span>
          <Link href={`/design-system/prototypes/jobs/${job.id}`} className="hover:underline" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
            {job.id}
          </Link>
          <span>/</span>
          <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Budget</span>
        </div>
        <h1 className="text-[24px] mb-1" style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 500, color: "var(--text-primary)" }}>
          {job.name} — Budget
        </h1>
        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {rows.length} budget lines · Current draw: Pay App #{currentDraw.draw_number}
        </p>
      </div>

      {/* KPI strip — analog: patterns/page.tsx:511-581 */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 mb-6"
        style={{
          gap: "1px",
          background: "var(--border-default)",
          borderTop: "1px solid var(--border-default)",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        {[
          { label: "Original contract", value: <Money cents={kpis.originalSum} size="md" />, sub: "as signed" },
          { label: "Revised total", value: <Money cents={kpis.revisedSum} size="md" />, sub: `incl. ${(kpis.approvedCOs / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} approved COs` },
          { label: "Invoiced to date", value: <Money cents={kpis.totalToDateSum} size="md" />, sub: `${(kpis.totalToDateSum / kpis.revisedSum * 100).toFixed(1)}% complete` },
          { label: "Remaining", value: <Money cents={kpis.balanceSum} size="md" />, sub: kpis.overUnderTotal > 0 ? `${kpis.overUnderTotal} lines over budget` : "all lines on budget" },
        ].map((k) => (
          <div key={k.label} className="p-4" style={{ background: "var(--bg-card)" }}>
            <Eyebrow tone="muted" className="mb-2">{k.label}</Eyebrow>
            <div className="text-[28px] mb-1" style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 600 }}>
              {k.value}
            </div>
            <div className="text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-accent)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      {/* DataGrid stress test — TanStack Table v8 with sortable columns */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table
            className="w-full text-[11px]"
            style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
          >
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} style={{ background: "var(--bg-subtle)" }}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className="px-2 py-2 text-left border cursor-pointer select-none"
                      style={{
                        borderColor: "var(--border-default)",
                        color: "var(--text-secondary)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        fontSize: "9px",
                      }}
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getIsSorted() === "asc" && " ↑"}
                      {h.column.getIsSorted() === "desc" && " ↓"}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-2 py-1.5 border"
                      style={{ borderColor: "var(--border-subtle)" }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
```

**R.2 verification:** the `DrummondBudgetLine` type from Wave 0 deliberately omits `previous_applications`, `this_period`, `total_to_date`, `percent_complete`, `balance_to_finish`. The component's `BudgetRow` type ADDS them as the result of derivation. The `useMemo` block computes them. NO pre-baking allowed.

**Acceptance criterion verification:** "All 30+ line item DataGrid renders within Site Office compact density without horizontal scroll on nw-tablet."
- Site Office direction enforces `--card-padding-y: 1rem` (compact) inherited from `prototypes/layout.tsx`
- Table cells use 11px font + JetBrains Mono tabular-nums (compact horizontal footprint)
- Verify at execute: open Chrome DevTools, set viewport to 768px width, count visible columns — all 8 should fit without horizontal scroll. If columns overflow, this is a CRITICAL finding (per Q9=B halt criterion: design system fails at real workflow).
  </action>

  <verify>
    <automated>npm run build && grep -c "useReactTable\|getCoreRowModel\|getSortedRowModel" src/app/design-system/prototypes/jobs/[id]/budget/page.tsx</automated>
    Expected: build exits 0; grep returns >=3.

    Per R.2 verification: `grep -c "useMemo\|previous_applications.*=.*DRUMMOND_INVOICES" src/app/design-system/prototypes/jobs/[id]/budget/page.tsx` returns >=2 (computed via useMemo + DRUMMOND_INVOICES filter).

    Hex + T10c checks return 0 matches.

    Manual visual checks (Chrome MCP):
    - Visit `/design-system/prototypes/jobs/j-drummond/budget`. Page renders.
    - KPI strip shows 4 numbers (original, revised, invoiced, remaining).
    - DataGrid shows 25+ rows.
    - Click column header — sorting toggles (asc/desc indicators appear).
    - Set viewport 768px width — all 8 columns fit without horizontal scroll. Set 360px — horizontal scroll appears (acceptable on phone).
    - Spot-check a row's math: pick any row where `total_to_date > 0`, verify `previous_applications + this_period === total_to_date` and `revised_estimate - total_to_date === balance_to_finish`.
  </verify>

  <done>
    - Budget prototype renders 25+ Drummond budget lines with all computed fields derived on render (R.2 honored)
    - KPI strip shows 4 derived sums
    - TanStack Table v8 sorting works on every column
    - All 8 columns fit at tablet width (768px+) without horizontal scroll
    - Site Office direction visually applied (compact density visible)
    - npm run build passes
  </done>
</task>

<task type="auto">
  <name>Task 2: Document review prototype (3 sub-types: plans, contracts, lien releases)</name>
  <files>src/app/design-system/prototypes/documents/[id]/page.tsx</files>

  <read_first>
    - src/app/design-system/patterns/page.tsx (lines 259-407 Pattern1DocumentReview — Document Review canonical)
    - src/app/design-system/_fixtures/drummond/lien-releases.ts (DRUMMOND_LIEN_RELEASES; 4 statute types covered)
    - src/app/design-system/_fixtures/drummond/vendors.ts (resolve vendor_id)
    - src/app/design-system/_fixtures/drummond/invoices.ts (resolve invoice_id for lien-release linkage)
    - src/app/design-system/_fixtures/drummond/jobs.ts (resolve job_id)
    - .planning/design/PATTERNS.md §2 (Document Review canonical)
    - CLAUDE.md (Florida 4-statute lien release types — 713.20(2)(a)/(b)/(c)/(d))
    - .planning/phases/stage-1.5b-prototype-gallery/PATTERNS.md "documents/[id]/page.tsx" (lines 1159-1170 — 3 sub-prototypes pattern)
    - src/components/nw/Card.tsx, Eyebrow.tsx, Money.tsx, DataRow.tsx, Badge.tsx
  </read_first>

  <action>
**Create `src/app/design-system/prototypes/documents/[id]/page.tsx`:**

Discriminate document type by id prefix:
- `lr-drummond-*` → lien release (resolve from `DRUMMOND_LIEN_RELEASES`)
- `plan-drummond-*` → architectural plans (synthesize stub from job; sanitized plan PDF preview)
- `contract-drummond-*` → construction contract (synthesize stub; sanitized contract DOCX preview)

Each renders the Document Review pattern (file preview LEFT + structured fields RIGHT + audit/status timeline BELOW).

```typescript
// src/app/design-system/prototypes/documents/[id]/page.tsx
//
// Document review prototype — 3 sub-types per Stage 1.5b deliverable #7:
//   - Architectural plans (anonymized Drummond plan PDF preview)
//   - Construction contracts (sanitized contract DOCX preview)
//   - Lien releases (Florida 4-statute types — 713.20(2)(a)/(b)/(c)/(d))
//
// Document type discriminated via id prefix:
//   lr-drummond-*       → DrummondLienRelease lookup
//   plan-drummond-*     → synthesized plan stub
//   contract-drummond-* → synthesized contract stub
//
// All three extend Pattern1DocumentReview (PATTERNS.md §2).
//
// Per CONTEXT cross-cutting "Soft-delete + status_history APPLIES (display only)":
// lien_releases.status_history JSONB column missing in production DB (F1 fixes
// per gap #7). Prototype renders 4-status enum + faked client-side timeline
// labeled with explicit "F1 fixes the schema" disclaimer.
//
// Hook T10c — no imports from @/lib/supabase|org|auth.

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  PaperClipIcon,
  DocumentTextIcon,
  ScaleIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";

import {
  DRUMMOND_LIEN_RELEASES,
  DRUMMOND_VENDORS,
  DRUMMOND_INVOICES,
  DRUMMOND_JOBS,
  type DrummondLienReleaseType,
  type DrummondLienReleaseStatus,
} from "@/app/design-system/_fixtures/drummond";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Money from "@/components/nw/Money";
import DataRow from "@/components/nw/DataRow";
import Badge from "@/components/nw/Badge";

// Florida 4-statute reference — per CLAUDE.md.
const STATUTE_LABEL: Record<DrummondLienReleaseType, { label: string; statute: string }> = {
  conditional_progress:   { label: "Conditional waiver — progress payment", statute: "Florida Statute 713.20(2)(a)" },
  unconditional_progress: { label: "Unconditional waiver — progress payment", statute: "Florida Statute 713.20(2)(c)" },
  conditional_final:      { label: "Conditional waiver — final payment", statute: "Florida Statute 713.20(2)(b)" },
  unconditional_final:    { label: "Unconditional waiver — final payment", statute: "Florida Statute 713.20(2)(d)" },
};

const LIEN_STATUS_BADGE: Record<DrummondLienReleaseStatus, { variant: "neutral" | "accent" | "success" | "warn" | "danger" | "info"; label: string }> = {
  not_required: { variant: "neutral", label: "NOT REQUIRED" },
  pending:      { variant: "warn", label: "PENDING" },
  received:     { variant: "success", label: "RECEIVED" },
  waived:       { variant: "info", label: "WAIVED" },
};

function LienReleaseDocument({ id }: { id: string }) {
  const lr = DRUMMOND_LIEN_RELEASES.find((l) => l.id === id);
  if (!lr) return notFound();

  const vendor = DRUMMOND_VENDORS.find((v) => v.id === lr.vendor_id);
  const invoice = DRUMMOND_INVOICES.find((i) => i.id === lr.invoice_id);
  const job = DRUMMOND_JOBS.find((j) => j.id === lr.job_id);
  const statute = STATUTE_LABEL[lr.release_type];
  const status = LIEN_STATUS_BADGE[lr.status];

  return (
    <div className="px-6 py-8 max-w-[1600px] mx-auto">
      {/* Header band */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] mb-2" style={{ color: "var(--text-tertiary)" }}>
            <Link href="/design-system/prototypes/" className="hover:underline">Prototypes</Link>
            <span>/</span>
            <Link href="/design-system/prototypes/documents" className="hover:underline">Documents</Link>
            <span>/</span>
            <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>{lr.id}</span>
          </div>
          <h1 className="text-[24px] mb-1" style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 500, color: "var(--text-primary)" }}>
            Lien release — {vendor?.name ?? "Unknown vendor"}
          </h1>
          <div className="flex items-center gap-3">
            <Money cents={lr.amount_through} size="lg" variant="emphasized" />
            <Badge variant={status.variant}>{status.label}</Badge>
            <span className="text-[11px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)" }}>
              {statute.statute}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 px-4 py-2 text-[12px]"
            style={{ background: "var(--nw-stone-blue)", color: "var(--nw-white-sand)" }}
          >
            <CheckBadgeIcon className="w-4 h-4" strokeWidth={1.5} /> Mark received
          </button>
        </div>
      </div>

      {/* Hero grid 50/50 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 mb-6" style={{ gap: "1px", background: "var(--border-default)" }}>
        {/* LEFT — file preview */}
        <div className="p-5" style={{ background: "var(--bg-card)" }}>
          <Eyebrow tone="muted" className="mb-3">Source document</Eyebrow>
          <div
            className="aspect-[3/4] border flex flex-col items-center justify-center"
            style={{ background: "var(--bg-subtle)", borderColor: "var(--border-subtle)" }}
          >
            <ScaleIcon className="w-8 h-8 mb-3" strokeWidth={1.25} style={{ color: "var(--text-tertiary)" }} />
            <span className="text-[10px] uppercase" style={{ fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "0.18em", color: "var(--text-tertiary)" }}>
              Lien release PDF preview
            </span>
          </div>
        </div>

        {/* RIGHT — structured fields */}
        <div className="p-5 space-y-4" style={{ background: "var(--bg-card)" }}>
          <Card padding="md">
            <Eyebrow tone="accent" className="mb-3">Lien details</Eyebrow>
            <div className="grid grid-cols-1 gap-3">
              <DataRow label="Type" value={statute.label} />
              <DataRow label="Statute" value={statute.statute} />
              <DataRow label="Vendor" value={vendor?.name ?? "—"} />
              <DataRow label="Project" value={job?.name ?? "—"} />
              <DataRow label="Invoice" value={invoice ? <Link href={`/design-system/prototypes/invoices/${invoice.id}`} className="hover:underline">{invoice.invoice_number ?? invoice.id}</Link> : "—"} />
              <DataRow label="Amount through" value={<Money cents={lr.amount_through} size="md" variant="emphasized" />} />
              <DataRow label="Release date" value={lr.release_date ?? "—"} />
              {lr.draw_id && <DataRow label="Draw" value={<Link href={`/design-system/prototypes/draws/${lr.draw_id}`} className="hover:underline">{lr.draw_id}</Link>} />}
            </div>
          </Card>
        </div>
      </div>

      {/* Status timeline (faked per F1 gap #7) */}
      <Card padding="md">
        <Eyebrow tone="muted" className="mb-2">Status timeline</Eyebrow>
        <div className="mb-3 p-2 text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", background: "var(--bg-subtle)", color: "var(--text-tertiary)" }}>
          Note: <code>lien_releases.status_history</code> JSONB column does not yet exist in the production schema (R.7 violation per CURRENT-STATE A.2). F1 adds the column. This timeline is faked client-side for prototype rendering only.
        </div>
        <ul className="space-y-2 text-[12px]">
          <li className="flex items-center gap-3">
            <span className="w-1.5 h-1.5" style={{ borderRadius: "var(--radius-dot)", background: "var(--nw-stone-blue)" }} />
            <span className="text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)", minWidth: "120px" }}>
              {invoice?.received_date ?? "—"}
            </span>
            <span style={{ color: "var(--text-primary)" }}>REQUESTED with invoice</span>
          </li>
          {lr.status === "received" && lr.release_date && (
            <li className="flex items-center gap-3">
              <span className="w-1.5 h-1.5" style={{ borderRadius: "var(--radius-dot)", background: "var(--nw-stone-blue)" }} />
              <span className="text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)", minWidth: "120px" }}>
                {lr.release_date}
              </span>
              <span style={{ color: "var(--text-primary)" }}>RECEIVED — signed and notarized</span>
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}

function PlanDocument({ id }: { id: string }) {
  // Synthesized stub — no fixture for plans, but the component renders the
  // Document Review shape consistently. Real plans would come from the
  // documents table (Wave 2 — currently MISSING per CURRENT-STATE A.4).
  const job = DRUMMOND_JOBS[0]; // single-job fixture

  return (
    <div className="px-6 py-8 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[12px] mb-2" style={{ color: "var(--text-tertiary)" }}>
          <Link href="/design-system/prototypes/" className="hover:underline">Prototypes</Link>
          <span>/</span>
          <Link href="/design-system/prototypes/documents" className="hover:underline">Documents</Link>
          <span>/</span>
          <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>{id}</span>
        </div>
        <h1 className="text-[24px] mb-1" style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 500, color: "var(--text-primary)" }}>
          Architectural plans — {job?.name}
        </h1>
        <Badge variant="neutral">PLAN STUB</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 mb-6" style={{ gap: "1px", background: "var(--border-default)" }}>
        <div className="p-5" style={{ background: "var(--bg-card)" }}>
          <Eyebrow tone="muted" className="mb-3">Source document</Eyebrow>
          <div className="aspect-[3/4] border flex flex-col items-center justify-center" style={{ background: "var(--bg-subtle)", borderColor: "var(--border-subtle)" }}>
            <PaperClipIcon className="w-8 h-8 mb-3" strokeWidth={1.25} style={{ color: "var(--text-tertiary)" }} />
            <span className="text-[10px] uppercase" style={{ fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "0.18em", color: "var(--text-tertiary)" }}>
              Plans PDF preview (anonymized)
            </span>
          </div>
        </div>
        <div className="p-5 space-y-4" style={{ background: "var(--bg-card)" }}>
          <Card padding="md">
            <Eyebrow tone="accent" className="mb-3">Sheet metadata</Eyebrow>
            <div className="grid grid-cols-1 gap-3">
              <DataRow label="Project" value={job?.name ?? "—"} />
              <DataRow label="Sheet" value="A-101 First floor plan" />
              <DataRow label="Revision" value="Rev 2 (issued 2025-09-15)" />
              <DataRow label="Architect" value="(sanitized)" />
              <DataRow label="Scale" value="1/4 in = 1 ft" />
            </div>
          </Card>
        </div>
      </div>

      <Card padding="md">
        <Eyebrow tone="muted" className="mb-2">Notes</Eyebrow>
        <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
          Plans entity is MISSING from the current schema (per CURRENT-STATE A.4). VISION proposes a first-class
          <code> documents</code> table (Wave 2). For 1.5b prototype, the Document Review pattern is exercised
          against this stub to validate the gold-standard layout's reach beyond invoices/draws.
        </p>
      </Card>
    </div>
  );
}

function ContractDocument({ id }: { id: string }) {
  // Synthesized stub from Drummond contract (anonymized).
  const job = DRUMMOND_JOBS[0];

  return (
    <div className="px-6 py-8 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[12px] mb-2" style={{ color: "var(--text-tertiary)" }}>
          <Link href="/design-system/prototypes/" className="hover:underline">Prototypes</Link>
          <span>/</span>
          <Link href="/design-system/prototypes/documents" className="hover:underline">Documents</Link>
          <span>/</span>
          <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>{id}</span>
        </div>
        <h1 className="text-[24px] mb-1" style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 500, color: "var(--text-primary)" }}>
          Construction agreement — {job?.name}
        </h1>
        <div className="flex items-center gap-3">
          <Money cents={job?.original_contract_amount ?? 0} size="lg" variant="emphasized" />
          <Badge variant="success">EXECUTED</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 mb-6" style={{ gap: "1px", background: "var(--border-default)" }}>
        <div className="p-5" style={{ background: "var(--bg-card)" }}>
          <Eyebrow tone="muted" className="mb-3">Source document</Eyebrow>
          <div className="aspect-[3/4] border flex flex-col items-center justify-center" style={{ background: "var(--bg-subtle)", borderColor: "var(--border-subtle)" }}>
            <DocumentTextIcon className="w-8 h-8 mb-3" strokeWidth={1.25} style={{ color: "var(--text-tertiary)" }} />
            <span className="text-[10px] uppercase" style={{ fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "0.18em", color: "var(--text-tertiary)" }}>
              Contract DOCX preview (sanitized)
            </span>
          </div>
        </div>
        <div className="p-5 space-y-4" style={{ background: "var(--bg-card)" }}>
          <Card padding="md">
            <Eyebrow tone="accent" className="mb-3">Contract details</Eyebrow>
            <div className="grid grid-cols-1 gap-3">
              <DataRow label="Project" value={job?.name ?? "—"} />
              <DataRow label="Client" value={job?.client_name ?? "—"} />
              <DataRow label="Address" value={job?.address ?? "—"} />
              <DataRow label="Contract type" value={(job?.contract_type ?? "").replaceAll("_", " ").toUpperCase()} />
              <DataRow label="Original amount" value={<Money cents={job?.original_contract_amount ?? 0} size="md" variant="emphasized" />} />
              <DataRow label="Current amount" value={<Money cents={job?.current_contract_amount ?? 0} size="md" />} />
              <DataRow label="GC fee" value={`${((job?.gc_fee_percentage ?? 0) * 100).toFixed(0)}%`} />
              <DataRow label="Deposit" value={`${((job?.deposit_percentage ?? 0) * 100).toFixed(0)}%`} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function DocumentPrototypePage({ params }: { params: { id: string } }) {
  if (params.id.startsWith("lr-drummond-")) return <LienReleaseDocument id={params.id} />;
  if (params.id.startsWith("plan-drummond-")) return <PlanDocument id={params.id} />;
  if (params.id.startsWith("contract-drummond-")) return <ContractDocument id={params.id} />;
  // Default: try lien releases (most likely match if no prefix specified)
  if (DRUMMOND_LIEN_RELEASES.some((l) => l.id === params.id)) return <LienReleaseDocument id={params.id} />;
  return notFound();
}
```

**Per CONTEXT 1.4 PATTERNS surfaces table** "§2 Document Review (gold standard)" applies to "Invoice review, draw approval, lien release review, document review for plans/contracts" — this task delivers all four "non-invoice/non-draw" applications of the pattern.

**Per F1 gap (CURRENT-STATE A.2 R.7 violation):** lien releases lack `status_history` JSONB. The prototype:
- Renders the 4-status enum correctly (LIEN_STATUS_BADGE)
- Fakes a 2-step timeline (REQUESTED → RECEIVED) labeled with explicit "F1 fixes the schema" disclaimer
- Tests "Lien release prototype renders Florida 4-statute types correctly (with status_history JSONB faked locally — F1 fixes the schema)" acceptance criterion
  </action>

  <verify>
    <automated>npm run build && grep -c "STATUTE_LABEL\|conditional_progress" src/app/design-system/prototypes/documents/[id]/page.tsx</automated>
    Expected: build exits 0; grep returns >=4 (statute labels for 4 types).

    Hex + T10c checks return 0 matches.

    Manual visual checks (Chrome MCP):
    - Visit `/design-system/prototypes/documents/lr-drummond-001` (or actual lien release id from fixture). Lien release renders with statute label + status badge.
    - Visit a `lr-drummond-*` for each of the 4 statute types — verify all 4 statute labels render distinctly (713.20(2)(a) through 713.20(2)(d)).
    - Visit `/design-system/prototypes/documents/plan-drummond-001`. Plan stub renders with sheet metadata Card.
    - Visit `/design-system/prototypes/documents/contract-drummond-001`. Contract stub renders with contract details (job amounts, GC fee, deposit).
    - Bottom timeline on lien release shows the explicit "F1 fixes the schema" disclaimer in JetBrains Mono.
  </verify>

  <done>
    - Document review prototype routes by id prefix to lien release / plan / contract sub-component
    - Lien release renders all 4 Florida statute types correctly
    - Faked status_history timeline labeled with F1 disclaimer
    - Plan + contract stubs render Document Review pattern shape consistently
    - Cross-route links work (lien release → invoice, lien release → draw)
    - npm run build passes
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Prototype routes (`/design-system/prototypes/*`) → tenant code | Hook T10c rejects imports |
| Prototype routes → middleware platform_admin gate | Inherited from `/design-system/*` matcher |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-1.5b-W1-05 | I (Information disclosure) | Faked status_history timeline could mislead audit if mistaken for real data | mitigate | Explicit disclaimer block above timeline: "Note: lien_releases.status_history JSONB column does not yet exist... This timeline is faked client-side for prototype rendering only." Renders in JetBrains Mono with subtle background — clearly marked as non-canonical. |
| T-1.5b-W1-06 | T (Tampering) | TanStack Table v8 sorting could mishandle cents (BigInt vs Number) | accept | All cents values are JS Number; max contract amount ~$10M = 1B cents = well within Number.MAX_SAFE_INTEGER. No precision loss. |
| T-1.5b-W1-07 | E (Elevation of privilege) | Prototype imports tenant module → bypasses RLS | mitigate (existing) | Hook T10c rejects @/lib/supabase|org|auth imports. Verified post-write. |
</threat_model>

<verification>
- npm run build passes
- Hook T10c silent on both new files
- No hardcoded hex
- R.2 honored: BudgetRow computed fields derived in useMemo, NOT pre-baked into DRUMMOND_BUDGET_LINES
- TanStack Table v8 imports + setup match analog at data-display/page.tsx:367-660
- All 4 Florida statute types render distinctly in lien release prototype
- F1 disclaimer present and visible above lien-release status timeline
</verification>

<success_criteria>
- Budget prototype renders 25+ Drummond budget lines with full computed-field derivation, sortable columns, KPI strip
- Documents prototype handles 3 sub-types via id prefix discriminator
- All 4 Florida lien-release statute types render correctly
- All routes pass build, T10c, and token discipline gates
- 30+ line item DataGrid stress test passes at 768px without horizontal scroll
</success_criteria>

<output>
After completion, create `.planning/phases/stage-1.5b-prototype-gallery/stage-1.5b-prototype-gallery-3-SUMMARY.md` covering:
- Budget line count rendered + sort behavior + tablet-width column fit observation
- 4 Florida statute coverage (which lien-release ids exercise each statute)
- Whether the DataGrid stress test passed at compact density (acceptance criterion)
- Findings for 1.5b polish backlog (visual issues that don't block)
- Critical findings (if any) — does the 30+ row DataGrid fundamentally fail at compact density?
</output>
