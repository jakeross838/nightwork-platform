---
phase: stage-1.5b-prototype-gallery
plan: 6
type: execute
wave: 2
depends_on: [1, 2]
files_modified:
  - src/app/design-system/prototypes/draws/[id]/print/page.tsx
  - src/app/design-system/prototypes/reconciliation/page.tsx
autonomous: false
threat_model_severity: low
requirements: []
must_haves:
  truths:
    - "User can view AIA G702/G703 print preview at /design-system/prototypes/draws/d-caldwell-05/print"
    - "G702 cover sheet attempts pixel-perfect against Pay Application #5 - Drummond-501 74th St.pdf reference"
    - "G703 detail page renders at 80% fidelity (page breaks may differ; signature block stub; bank-acceptable layout)"
    - "G702 1-day judgment encoded as halt point: if pixel-perfect attempt exceeds 1 day, drop to 80% on both G702 and G703 and continue"
    - "Print stylesheet uses pure CSS @page + @media print against existing component tree (NO server-side PDF generator)"
    - "Print density forced compact via SYSTEM.md §10b's existing @media print { :root { --density-row: var(--density-compact-row) } } rule"
    - "Print:hidden chrome + hidden print:block content pattern replicated from src/app/draws/[id]/page.tsx:269-470 production precedent"
    - "User can view reconciliation strawman at /design-system/prototypes/reconciliation/ rendering 4 candidates × 2 drift types = 8 prototypes"
    - "Section anchors enable scroll-to-section comparison (invoice↔PO at top, draw↔budget below)"
    - "Reconciliation extends existing ReconciliationStrawman function in patterns/page.tsx:1149-1279 — does NOT diverge per A16.1 (would force forbidden rewrite)"
    - "All routes pass hook T10c"
  artifacts:
    - path: "src/app/design-system/prototypes/draws/[id]/print/page.tsx"
      provides: "AIA G702/G703 print preview — pixel-perfect G702 attempt + 80% G703"
      contains: "DRUMMOND_DRAWS"
    - path: "src/app/design-system/prototypes/reconciliation/page.tsx"
      provides: "Reconciliation strawman — 4 candidates × 2 drift types matrix"
      contains: "DRUMMOND_RECONCILIATION_PAIRS"
  key_links:
    - from: "prototypes/draws/[id]/print/page.tsx"
      to: "DRUMMOND_DRAWS + DRUMMOND_DRAW_LINE_ITEMS + DRUMMOND_COST_CODES + DRUMMOND_CHANGE_ORDERS + DRUMMOND_JOBS"
      via: "named imports + print stylesheet rules"
      pattern: "@media print"
    - from: "prototypes/draws/[id]/print/page.tsx"
      to: "src/app/globals.css print stylesheet"
      via: "inheritance via @media print { } block"
      pattern: "print:hidden"
    - from: "prototypes/reconciliation/page.tsx"
      to: "DRUMMOND_RECONCILIATION_PAIRS"
      via: "named import + filter by drift_type"
      pattern: "DRUMMOND_RECONCILIATION_PAIRS"
    - from: "prototypes/reconciliation/page.tsx"
      to: "patterns/page.tsx:1149-1279 ReconciliationStrawman 4 candidate visual shapes"
      via: "structural mirror — re-implement same 4 Card shapes against Drummond data"
      pattern: "Candidate 1\\|Candidate 2\\|Candidate 3\\|Candidate 4"
---

<objective>
Render the AIA G702/G703 print preview (with the G702 1-day judgment halt encoded as an explicit task structure) and the reconciliation strawman (4 candidates × 2 drift types = 8 prototypes).

Both are specialized prototypes that depend on PLAN-2's draws/[id]/page.tsx layout precedent (for the print extension) and PLAN-1's reconciliation fixture (for the strawman matrix). Wave 2 sequencing: launches after Wave 1 settles.

Purpose:
- Print preview tests PATTERNS.md §10 Print View at AIA fidelity. The G702 pixel-perfect attempt is the single biggest risk in 1.5b after fixture extraction — encoded with explicit 1-day judgment + escape clause per CONTEXT D-16/D-24.
- Reconciliation strawman tests PATTERNS.md §11 against real Drummond drift. Per CONTEXT Q3=C: render all 4 candidates; document a "leading candidate" recommendation at end (final lock at reconciliation phase post-3.9).

Output:
- Print preview at `/design-system/prototypes/draws/{id}/print`
- Reconciliation strawman at `/design-system/prototypes/reconciliation/` (single page, 4×2 matrix)
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
@.planning/phases/stage-1.5b-prototype-gallery/stage-1.5b-prototype-gallery-2-SUMMARY.md
@CLAUDE.md
@.planning/design/SYSTEM.md
@.planning/design/COMPONENTS.md
@.planning/design/PATTERNS.md
@.planning/design/CHOSEN-DIRECTION.md
@src/app/design-system/_fixtures/drummond/index.ts
@src/app/design-system/_fixtures/drummond/types.ts
@src/app/design-system/patterns/page.tsx
@src/app/design-system/prototypes/layout.tsx
@src/app/design-system/prototypes/draws/[id]/page.tsx
@src/app/draws/[id]/page.tsx
@src/app/globals.css
@src/components/nw/Card.tsx
@src/components/nw/Eyebrow.tsx
@src/components/nw/Money.tsx
@src/components/nw/DataRow.tsx
@src/components/nw/Badge.tsx
@.planning/fixtures/drummond/source3-downloads/Pay Application #5 - Drummond-501 74th St.pdf

<interfaces>
<!-- Drummond fixture imports — same set as PLAN-2/PLAN-3.

For print: DRUMMOND_DRAWS, DRUMMOND_DRAW_LINE_ITEMS, DRUMMOND_COST_CODES,
           DRUMMOND_CHANGE_ORDERS, DRUMMOND_JOBS

For reconciliation: DRUMMOND_RECONCILIATION_PAIRS
  type DrummondReconciliationDriftType = "invoice_po" | "draw_budget";
  type DrummondReconciliationPair = {
    id: string;
    drift_type: DrummondReconciliationDriftType;
    imported: Record<string, unknown>;  // QuickBooks / external snapshot
    current:  Record<string, unknown>;  // Nightwork current state
    diffs: Array<{ field: string; imported_value: unknown; current_value: unknown }>;
  };
-->

<!-- Print stylesheet base (already shipped src/app/globals.css:255-289):

  @media print {
    html, body { background: #ffffff !important; color: #000000 !important; }
    nav, header, footer, aside, .nav-bar, .nav-area, .sidebar, button, [role="button"], input, select, textarea, .no-print { display: none !important; }
    body { font-size: 11pt; line-height: 1.4; }
    table { border-collapse: collapse !important; width: 100% !important; }
    table th, table td { border: 1px solid #999 !important; padding: 4px 6px !important; color: #000 !important; }
    table th { background: #f0f0f0 !important; font-weight: 600 !important; }
    .print-area { max-width: 100% !important; padding: 0 !important; }
    .print-page-break { page-break-after: always; }
    .print-avoid-break { page-break-inside: avoid; }
    a, a:visited { color: #000 !important; text-decoration: none !important; }
    .grain::after { display: none !important; }
  }
-->

<!-- Production precedent for print toggle (src/app/draws/[id]/page.tsx:269-470):

  - Chrome wrapped in `print:hidden` Tailwind class
  - Print-only header shown via `hidden print:block`
  - `<button onClick={() => window.print()}>` triggers print dialog
  - `<main className="print-area">` opts content INTO print view

  This component uses identical pattern. Replicate exactly. -->

<!-- 4 candidate visual shapes (from src/app/design-system/patterns/page.tsx:1149-1279):

  Candidate 1 — Side-by-side delta (lines 1168-1193):
    Card containing two-column grid: Imported (left) vs Current (right)
    Drift highlighted via left-border on differing field

  Candidate 2 — Inline diff (lines 1196-1218):
    Card with stacked add/delete rows, JetBrains Mono, danger/success colors

  Candidate 3 — Timeline overlay (lines 1221-1248):
    Card with single timeline list, imported/current/match circles per attribute

  Candidate 4 — Hybrid split + inline (lines 1251-1276):
    Card with top-level split + per-attribute inline diff inside each side
-->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: G702 cover sheet pixel-perfect attempt (1-day budget)</name>
  <files>src/app/design-system/prototypes/draws/[id]/print/page.tsx</files>

  <read_first>
    - src/app/globals.css (lines 255-289 — existing print stylesheet base)
    - src/app/draws/[id]/page.tsx (lines 269-470 — production print toggle precedent: print:hidden chrome + hidden print:block content)
    - src/app/design-system/patterns/page.tsx (lines 1048-1143 Pattern9PrintView — G703 simulated table visual contract)
    - .planning/fixtures/drummond/source3-downloads/Pay Application #5 - Drummond-501 74th St.pdf (the pixel-perfect reference target — read this PDF using Claude Code Read tool to study the exact G702 layout: header block placement, signature blocks, change order summary table position, line numbering A-G)
    - src/app/design-system/_fixtures/drummond/draws.ts (DRUMMOND_DRAWS — Pay App 5 = d-caldwell-05)
    - src/app/design-system/_fixtures/drummond/draw-line-items.ts (G703 line items)
    - src/app/design-system/_fixtures/drummond/cost-codes.ts (5-digit cost codes for G703 column A)
    - src/app/design-system/_fixtures/drummond/change-orders.ts (PCCO log for G702 change order summary table)
    - src/app/design-system/_fixtures/drummond/jobs.ts (project info for G702 header block)
    - .planning/design/PATTERNS.md §10 Print View
    - .planning/design/SYSTEM.md §10b (print density forces compact via @media print { :root { --density-row: var(--density-compact-row) } })
    - CLAUDE.md (G702 schema reference: lines 1-7 contract sum → net change orders → contract sum to date → total completed → less previous → current due → balance to finish; signature block: Contractor Jake Ross + date)
  </read_first>

  <action>
**[1-DAY-JUDGMENT TASK]** This task encodes the G702 pixel-perfect 1-day halt per CONTEXT D-16 + D-24 + Jake's nwrp29 directive #5.

**Time-budget structure:**

The executor MUST treat this task as having two phases:

1. **Phase 1A — Pixel-perfect G702 attempt (1-day budget).** Open the reference PDF (`Pay Application #5 - Drummond-501 74th St.pdf`) using the Claude Code Read tool. Study the exact layout: header block typography, line spacing, table column proportions, signature block placement. Build the print stylesheet to match within 1 working day of focused effort.

2. **Phase 1B — Self-evaluate at 1-day mark.** After 1 day of focused work, the executor evaluates: is pixel-perfect G702 tractable in another day? If YES → continue. If NO → invoke escape clause: drop G702 to 80% fidelity and proceed to Task 2 (G703 80%). Log the escape clause invocation as a 1.5b-followup item ("pixel-perfect AIA G702 fidelity needed for production AIA Document Service certification — separate phase post-1.5b").

**Per CONTEXT D-15 (Q7 override):** G702 cover sheet attempts pixel-perfect; G703 detail page accepts 80%. **Per CONTEXT D-16:** if pixel-perfect G702 explodes past 1-day, drop both to 80% and continue.

**The escape clause is NOT a failure.** It is the DOCUMENTED fallback per Jake's override. A 1-day pixel-perfect attempt that converges is the success path; an attempt that exceeds 1 day with no tractable path is the documented secondary success path (drop to 80%, log followup).

**Implementation skeleton:**

```typescript
// src/app/design-system/prototypes/draws/[id]/print/page.tsx
//
// AIA G702/G703 print preview prototype — Stage 1.5b deliverable #4.
//
// TIERED FIDELITY per CONTEXT D-15 (Q7 override):
//   - G702 cover sheet: pixel-perfect attempt against
//     Pay Application #5 - Drummond-501 74th St.pdf
//   - G703 detail page: 80% fidelity (page breaks may differ;
//     signature block stub; bank-acceptable but not pixel-matched)
//
// HALT POINT (per CONTEXT D-16/D-24): if pixel-perfect G702
// attempt exceeds 1-day budget, drop to 80% on both G702 and G703,
// log as 1.5b-followup. The executor self-evaluates at the 1-day mark.
//
// Print stylesheet strategy (per D-13): pure CSS @page + @media print
// against existing component tree. NO server-side PDF generator
// (puppeteer/playwright). Density forced compact via SYSTEM.md §10b.
//
// Print toggle pattern (per D-14): print:hidden chrome + hidden print:block
// content. Replicates src/app/draws/[id]/page.tsx:269-470 precedent.
//
// Hook T10c — no imports from @/lib/supabase|org|auth.

"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { PrinterIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";

import {
  DRUMMOND_DRAWS,
  DRUMMOND_DRAW_LINE_ITEMS,
  DRUMMOND_COST_CODES,
  DRUMMOND_CHANGE_ORDERS,
  DRUMMOND_JOBS,
} from "@/app/design-system/_fixtures/drummond";

// Helper: cents → "$X,XXX.XX" format. Print uses plain text, not Money component.
function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DrawPrintPage({ params }: { params: { id: string } }) {
  const draw = DRUMMOND_DRAWS.find((d) => d.id === params.id);
  if (!draw) return notFound();

  const job = DRUMMOND_JOBS.find((j) => j.id === draw.job_id);
  const lineItems = DRUMMOND_DRAW_LINE_ITEMS.filter((li) => li.draw_id === draw.id);
  const cosThroughThisDraw = DRUMMOND_CHANGE_ORDERS
    .filter((co) => co.draw_number !== null && co.draw_number <= draw.draw_number)
    .sort((a, b) => a.pcco_number - b.pcco_number);

  return (
    <>
      {/* Page-specific print rules — override globals.css base where AIA differs */}
      <style jsx global>{`
        @page {
          size: letter;
          margin: 0.75in;
        }

        @media print {
          /* G702 cover sheet on first page; G703 detail starts on next page */
          .g702-cover { page-break-after: always; }

          /* Compact density forced per SYSTEM.md §10b */
          :root { --density-row: var(--density-compact-row, 1.25rem); }

          /* AIA-specific table sizing — G703 fits 8 columns letter-portrait */
          .aia-g703 { font-size: 8pt; }
          .aia-g703 th, .aia-g703 td { padding: 2pt 3pt !important; }
          .aia-g703 th { letter-spacing: 0.04em; text-transform: uppercase; }

          /* G702 header — bigger, formal */
          .aia-g702-header { font-size: 14pt; font-weight: 600; text-align: center; }
          .aia-g702-subheader { font-size: 9pt; text-align: center; margin-bottom: 0.25in; }

          /* Signature block — preserved at bottom */
          .aia-signature { margin-top: 0.5in; border-top: 1pt solid #000; padding-top: 0.25in; }
        }
      `}</style>

      {/* Chrome — hidden in print (print:hidden + .no-print belt-and-suspenders) */}
      <div className="print:hidden no-print px-6 py-4 border-b" style={{ borderColor: "var(--border-default)", background: "var(--bg-page)" }}>
        <div className="max-w-[1600px] mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2 text-[12px]">
            <Link href={`/design-system/prototypes/draws/${draw.id}`} className="hover:underline flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
              <ArrowLeftIcon className="w-4 h-4" strokeWidth={1.5} /> Back to draw
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px]" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-jetbrains-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Print preview · Pay App #{draw.draw_number}
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 px-4 py-2 text-[12px]"
              style={{ background: "var(--nw-stone-blue)", color: "var(--nw-white-sand)" }}
              aria-label="Print this draw"
            >
              <PrinterIcon className="w-4 h-4" strokeWidth={1.5} /> Print
            </button>
          </div>
        </div>
      </div>

      {/* Print area — opt content INTO print view */}
      <main className="print-area max-w-[8.5in] mx-auto px-4 py-6">
        {/*
          ═══════════════════════════════════════════════════════
          G702 COVER SHEET — pixel-perfect attempt (1-DAY BUDGET)
          ═══════════════════════════════════════════════════════

          Reference: .planning/fixtures/drummond/source3-downloads/Pay Application #5 - Drummond-501 74th St.pdf

          Layout per AIA G702-1992 standard:
          - Top: Title block (APPLICATION AND CERTIFICATE FOR PAYMENT)
          - Subhead: TO OWNER, FROM CONTRACTOR, PROJECT, CONTRACT FOR fields
          - Application info: APPLICATION NO, PERIOD TO, CONTRACT DATE, PROJECT NO
          - Statement of contractor: 7 numbered lines (1-7) showing contract math
          - Change order summary table: Total approved last/this period
          - Certificate by Contractor: signature block (Jake Ross / Director of Construction)
          - Architect's Certificate: optional/N/A (skip for builder-direct)

          The executor uses the Read tool to open the PDF and study the exact
          column proportions, type sizes, line spacing of the reference. Build
          the JSX/CSS to match within 1 working day. If the attempt exceeds
          1 day with no tractable path, invoke the escape clause (Phase 1B
          self-evaluation) and DROP TO 80% on this section.
        */}
        <section className="g702-cover">
          <h1 className="aia-g702-header">APPLICATION AND CERTIFICATE FOR PAYMENT</h1>
          <p className="aia-g702-subheader">AIA Document G702 · Pay Application #{draw.draw_number}</p>

          {/* Header block — TO OWNER / FROM CONTRACTOR / PROJECT / CONTRACT FOR */}
          <div className="grid grid-cols-2 gap-4 mb-4 text-[10pt]">
            <div>
              <div className="text-[8pt] uppercase tracking-wider mb-1">TO OWNER:</div>
              <div>{job?.client_name ?? "—"}</div>
              <div>{job?.address ?? "—"}</div>
            </div>
            <div>
              <div className="text-[8pt] uppercase tracking-wider mb-1">FROM CONTRACTOR:</div>
              <div>Ross Built Custom Homes</div>
              <div>305 67th St West, Bradenton FL 34209</div>
            </div>
            <div>
              <div className="text-[8pt] uppercase tracking-wider mb-1">PROJECT:</div>
              <div>{job?.name ?? "—"}</div>
              <div>{job?.address ?? "—"}</div>
            </div>
            <div>
              <div className="text-[8pt] uppercase tracking-wider mb-1">CONTRACT FOR:</div>
              <div>Cost-Plus Construction</div>
              <div>GC Fee: {((job?.gc_fee_percentage ?? 0) * 100).toFixed(0)}%</div>
            </div>
          </div>

          {/* Application info row */}
          <div className="grid grid-cols-4 gap-2 mb-4 text-[9pt] border-t border-b py-2" style={{ borderColor: "#000" }}>
            <div><div className="text-[7pt] uppercase">Application No.</div><div className="font-semibold">{draw.draw_number}</div></div>
            <div><div className="text-[7pt] uppercase">Period to</div><div className="font-semibold">{draw.period_end}</div></div>
            <div><div className="text-[7pt] uppercase">Contract Date</div><div className="font-semibold">{draw.application_date}</div></div>
            <div><div className="text-[7pt] uppercase">Project No.</div><div className="font-semibold">{job?.id ?? "—"}</div></div>
          </div>

          {/* Statement of contractor — 7 numbered lines */}
          <div className="text-[10pt] mb-4">
            <div className="font-semibold mb-2">CONTRACTOR'S APPLICATION FOR PAYMENT</div>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="py-1 pl-4">1. ORIGINAL CONTRACT SUM</td>
                  <td className="text-right py-1 pr-4 font-semibold">{fmt(draw.original_contract_sum)}</td>
                </tr>
                <tr>
                  <td className="py-1 pl-4">2. NET CHANGE BY CHANGE ORDERS</td>
                  <td className="text-right py-1 pr-4">{fmt(draw.net_change_orders)}</td>
                </tr>
                <tr style={{ borderTop: "1pt solid #000" }}>
                  <td className="py-1 pl-4 font-semibold">3. CONTRACT SUM TO DATE (Line 1 + 2)</td>
                  <td className="text-right py-1 pr-4 font-semibold">{fmt(draw.contract_sum_to_date)}</td>
                </tr>
                <tr>
                  <td className="py-1 pl-4">4. TOTAL COMPLETED & STORED TO DATE</td>
                  <td className="text-right py-1 pr-4">{fmt(draw.total_completed_to_date)}</td>
                </tr>
                <tr>
                  <td className="py-1 pl-4">5. RETAINAGE (0% per Ross Built standard)</td>
                  <td className="text-right py-1 pr-4">$0.00</td>
                </tr>
                <tr style={{ borderTop: "1pt solid #000" }}>
                  <td className="py-1 pl-4">6. LESS PREVIOUS CERTIFICATES FOR PAYMENT</td>
                  <td className="text-right py-1 pr-4">{fmt(draw.less_previous_payments)}</td>
                </tr>
                <tr style={{ borderTop: "1pt solid #000", background: "#f0f0f0" }}>
                  <td className="py-2 pl-4 font-bold text-[12pt]">7. CURRENT PAYMENT DUE</td>
                  <td className="text-right py-2 pr-4 font-bold text-[12pt]">{fmt(draw.current_payment_due)}</td>
                </tr>
                <tr>
                  <td className="py-1 pl-4">BALANCE TO FINISH</td>
                  <td className="text-right py-1 pr-4">{fmt(draw.balance_to_finish)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Change order summary table */}
          {cosThroughThisDraw.length > 0 && (
            <div className="text-[9pt] mb-4">
              <div className="font-semibold mb-1">CHANGE ORDER SUMMARY</div>
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f0f0f0" }}>
                    <th className="text-left p-1 border" style={{ borderColor: "#000" }}>PCCO #</th>
                    <th className="text-left p-1 border" style={{ borderColor: "#000" }}>Description</th>
                    <th className="text-right p-1 border" style={{ borderColor: "#000" }}>Amount</th>
                    <th className="text-right p-1 border" style={{ borderColor: "#000" }}>GC Fee</th>
                    <th className="text-right p-1 border" style={{ borderColor: "#000" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cosThroughThisDraw.map((co) => (
                    <tr key={co.id}>
                      <td className="p-1 border" style={{ borderColor: "#000" }}>{co.pcco_number}</td>
                      <td className="p-1 border" style={{ borderColor: "#000" }}>{co.description}</td>
                      <td className="p-1 border text-right" style={{ borderColor: "#000" }}>{fmt(co.amount)}</td>
                      <td className="p-1 border text-right" style={{ borderColor: "#000" }}>{fmt(co.gc_fee_amount)}</td>
                      <td className="p-1 border text-right font-semibold" style={{ borderColor: "#000" }}>{fmt(co.total_with_fee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Signature block */}
          <div className="aia-signature text-[9pt]">
            <p className="mb-2">The undersigned Contractor certifies that to the best of the Contractor's knowledge, information and belief the Work covered by this Application for Payment has been completed in accordance with the Contract Documents...</p>
            <div className="grid grid-cols-2 gap-8 mt-4">
              <div>
                <div style={{ borderTop: "1pt solid #000" }} className="pt-1">
                  Jake Ross, Director of Construction
                </div>
              </div>
              <div>
                <div style={{ borderTop: "1pt solid #000" }} className="pt-1">
                  Date
                </div>
              </div>
            </div>
          </div>
        </section>

        {/*
          ═══════════════════════════════════════════════════════
          G703 CONTINUATION SHEET — 80% FIDELITY
          ═══════════════════════════════════════════════════════

          See Task 2 below.
        */}
      </main>

      {/* Page 2+: G703 detail (80% fidelity) — see Task 2 */}
    </>
  );
}
```

**Phase 1B self-evaluation checkpoint:** at 1-day work-mark, evaluate.

**If continuing:** complete pixel-perfect G702 (header alignment, table column proportions, signature block) over a second day max.

**If invoking escape clause:**
- Drop G702 to 80% (acceptable margins, page breaks may differ, signature block stub)
- Drop G703 to 80% (was already 80%)
- Log entry in plan summary: "1.5b-followup-1: pixel-perfect AIA G702 fidelity for production AIA Document Service certification — separate phase post-1.5b"
- Continue to Task 2 (G703 implementation)
- Inform Jake of the escape clause invocation in the next status update

**Per CONTEXT 'Claude's Discretion':** "Tactical sub-decisions during implementation... Halt only if a tactical choice would force a SYSTEM.md / COMPONENTS.md / PATTERNS.md update." The 1-day judgment is a tactical sub-decision; the executor decides without halt unless the SYSTEM.md print density rule (§10b) needs revision.
  </action>

  <verify>
    <automated>npm run build && grep -c "g702-cover\|aia-g702\|window.print" src/app/design-system/prototypes/draws/[id]/print/page.tsx</automated>
    Expected: build exits 0; grep returns >=2.

    Hex check: hardcoded hex permitted in this file ONLY for print colors that must be raw values (#000, #999, #f0f0f0 as already used in src/app/globals.css:255-289). Documented exception per CONTEXT cross-cutting "Print view uses a print-specific override stylesheet." All other colors must be `var(--...)`.

    T10c check: `grep -E '@/lib/(supabase|org|auth)' src/app/design-system/prototypes/draws/[id]/print/page.tsx` returns 0 matches.

    Manual visual checks (Chrome MCP):
    - Visit `/design-system/prototypes/draws/d-caldwell-05/print`. Print preview chrome (Back + Print button) renders.
    - Click "Print" button — browser print dialog opens.
    - In print preview UI, verify: chrome hidden, content fits letter portrait with 0.75in margins, G702 occupies first page, G703 starts on second page (page-break-after: always works).
    - Compare side-by-side with `Pay Application #5 - Drummond-501 74th St.pdf`: G702 layout matches reference within tractable bounds (header block placement, signature block at bottom).

    **Phase 1B self-evaluation log (in plan summary):** if pixel-perfect attempt converged within 1 day OR escape clause invoked at 1-day mark — document either way.
  </verify>

  <done>
    - G702 cover sheet renders with all 7 numbered lines (contract sum → current payment due → balance to finish)
    - Header block (TO OWNER / FROM CONTRACTOR / PROJECT / CONTRACT FOR) renders
    - Application info row (App #, Period, Contract Date, Project #) renders
    - Change order summary table renders if any COs apply through this draw
    - Signature block at bottom (Jake Ross / Director of Construction)
    - print:hidden chrome correctly hides Back button + Print button
    - page-break-after: always isolates G702 to first page
    - Compact print density forced via @media print { :root { --density-row } }
    - Phase 1B judgment outcome documented (pixel-perfect achieved OR escape clause invoked)
  </done>
</task>

<task type="auto">
  <name>Task 2: G703 continuation sheet (80% fidelity)</name>
  <files>src/app/design-system/prototypes/draws/[id]/print/page.tsx</files>

  <read_first>
    - The file just-built in Task 1 (extending it)
    - src/app/design-system/patterns/page.tsx (lines 1048-1143 Pattern9PrintView — G703 simulated table visual contract)
    - src/app/design-system/_fixtures/drummond/draw-line-items.ts (DRUMMOND_DRAW_LINE_ITEMS — one per cost code per draw)
    - src/app/design-system/_fixtures/drummond/cost-codes.ts (5-digit codes for column A)
  </read_first>

  <action>
**Add the G703 continuation sheet section to the print page** (extends Task 1's file).

Per CONTEXT D-15 (Q7 override): G703 detail page accepts 80% fidelity (page breaks may differ; signature block stub; bank-acceptable layout but not pixel-matched).

Add this section AFTER `</section>` of `g702-cover`, INSIDE the `<main>` tag:

```typescript
{/*
  ═══════════════════════════════════════════════════════
  G703 CONTINUATION SHEET — 80% FIDELITY (per Q7 override)
  ═══════════════════════════════════════════════════════

  AIA G703-1992 standard layout:
  - Top: Title block (CONTINUATION SHEET)
  - Subhead: APPLICATION NO, APPLICATION DATE, PERIOD TO
  - 8-column table:
    A. Item No (5-digit cost code)
    B. Description of Work
    C. Scheduled Value (Original estimate)
    D. Work Completed: Previous Applications
    E. Work Completed: This Period
    F. Total Completed & Stored to Date (D+E)
    G. % (F/C)
    H. Balance to Finish (C-F)
  - Per page subtotals + grand total on final page

  At 80% fidelity: page breaks may differ from reference, no per-page subtotals,
  grand total at end. Bank-acceptable but not pixel-matched.
*/}
<section className="aia-g703">
  <h2 className="aia-g702-header text-[12pt]">CONTINUATION SHEET</h2>
  <p className="aia-g702-subheader">AIA Document G703</p>

  <div className="grid grid-cols-3 gap-2 mb-3 text-[9pt] border-t border-b py-2" style={{ borderColor: "#000" }}>
    <div><div className="text-[7pt] uppercase">Application No.</div><div className="font-semibold">{draw.draw_number}</div></div>
    <div><div className="text-[7pt] uppercase">Application Date</div><div className="font-semibold">{draw.application_date}</div></div>
    <div><div className="text-[7pt] uppercase">Period To</div><div className="font-semibold">{draw.period_end}</div></div>
  </div>

  <table className="aia-g703 w-full" style={{ borderCollapse: "collapse" }}>
    <thead>
      <tr style={{ background: "#f0f0f0" }}>
        <th className="border p-1" style={{ borderColor: "#000" }}>A<br/>Item</th>
        <th className="border p-1 text-left" style={{ borderColor: "#000" }}>B<br/>Description</th>
        <th className="border p-1 text-right" style={{ borderColor: "#000" }}>C<br/>Scheduled Value</th>
        <th className="border p-1 text-right" style={{ borderColor: "#000" }}>D<br/>Previous</th>
        <th className="border p-1 text-right" style={{ borderColor: "#000" }}>E<br/>This Period</th>
        <th className="border p-1 text-right" style={{ borderColor: "#000" }}>F<br/>Total To Date</th>
        <th className="border p-1 text-right" style={{ borderColor: "#000" }}>G<br/>%</th>
        <th className="border p-1 text-right" style={{ borderColor: "#000" }}>H<br/>Balance</th>
      </tr>
    </thead>
    <tbody>
      {lineItems.map((li) => {
        const cc = DRUMMOND_COST_CODES.find((c) => c.id === li.cost_code_id);
        const scheduled = li.previous_applications + li.this_period + li.balance_to_finish;
        return (
          <tr key={li.id} className="print-avoid-break">
            <td className="border p-1" style={{ borderColor: "#000", fontFamily: "monospace" }}>{cc?.code ?? "—"}</td>
            <td className="border p-1" style={{ borderColor: "#000" }}>{cc?.description ?? "—"}</td>
            <td className="border p-1 text-right" style={{ borderColor: "#000" }}>{fmt(scheduled)}</td>
            <td className="border p-1 text-right" style={{ borderColor: "#000" }}>{fmt(li.previous_applications)}</td>
            <td className="border p-1 text-right" style={{ borderColor: "#000" }}>{fmt(li.this_period)}</td>
            <td className="border p-1 text-right font-semibold" style={{ borderColor: "#000" }}>{fmt(li.total_to_date)}</td>
            <td className="border p-1 text-right" style={{ borderColor: "#000" }}>{(li.percent_complete * 100).toFixed(0)}%</td>
            <td className="border p-1 text-right" style={{ borderColor: "#000" }}>{fmt(li.balance_to_finish)}</td>
          </tr>
        );
      })}
      {/* Grand totals row */}
      <tr style={{ background: "#f0f0f0", borderTop: "2pt solid #000" }}>
        <td className="border p-1 font-bold" colSpan={2} style={{ borderColor: "#000" }}>GRAND TOTAL</td>
        <td className="border p-1 text-right font-bold" style={{ borderColor: "#000" }}>
          {fmt(lineItems.reduce((s, li) => s + li.previous_applications + li.this_period + li.balance_to_finish, 0))}
        </td>
        <td className="border p-1 text-right font-bold" style={{ borderColor: "#000" }}>
          {fmt(lineItems.reduce((s, li) => s + li.previous_applications, 0))}
        </td>
        <td className="border p-1 text-right font-bold" style={{ borderColor: "#000" }}>
          {fmt(lineItems.reduce((s, li) => s + li.this_period, 0))}
        </td>
        <td className="border p-1 text-right font-bold" style={{ borderColor: "#000" }}>
          {fmt(lineItems.reduce((s, li) => s + li.total_to_date, 0))}
        </td>
        <td className="border p-1 text-right font-bold" style={{ borderColor: "#000" }}>
          —
        </td>
        <td className="border p-1 text-right font-bold" style={{ borderColor: "#000" }}>
          {fmt(lineItems.reduce((s, li) => s + li.balance_to_finish, 0))}
        </td>
      </tr>
    </tbody>
  </table>
</section>
```

**80% fidelity acceptance:** layout uses 8-column AIA structure with correct labels (A-H), borders visible in print, grand total row, monospace cost codes, percent_complete column. Page breaks happen naturally — `print-avoid-break` keeps individual rows from splitting but the executor does NOT pursue per-page subtotal rendering (out of scope for 80%).

**Per print stylesheet base (already shipped):** `@media print { table th, table td { border: 1px solid #999 !important; ... } }` — these existing global rules apply. The page-specific `<style jsx global>` from Task 1 adds AIA-specific column padding overrides only.
  </action>

  <verify>
    <automated>npm run build && grep -c "aia-g703\|GRAND TOTAL" src/app/design-system/prototypes/draws/[id]/print/page.tsx</automated>
    Expected: build exits 0; grep returns >=2.

    Manual visual checks (Chrome MCP):
    - Visit `/design-system/prototypes/draws/d-caldwell-05/print` → click Print button → in browser print preview:
      - G703 starts on page 2 (page-break-after on g702-cover works)
      - 8 columns labeled A-H render
      - All N line items render (one row per draw_line_item)
      - Cost codes in column A use monospace font
      - Currency values in columns C/D/E/F/H use right alignment with $ formatting
      - Percent column G uses % formatting
      - Grand total row at bottom with sums
      - Borders visible in print (1pt solid black)
      - Bank-acceptable layout (mid-line breaks may occur — acceptable per 80%)
    - Verify against `Pay Application #5 - Drummond-501 74th St.pdf`: AIA shape matches; pixel-matching not required at 80%.
  </verify>

  <done>
    - G703 8-column AIA table renders with all line items
    - Grand total row sums correctly
    - Page-break-after on G702 isolates G703 to second page
    - print-avoid-break keeps individual rows whole
    - 80% fidelity acceptance met (AIA shape correct, page breaks acceptable)
    - npm run build passes
  </done>
</task>

<task type="auto">
  <name>Task 3: Reconciliation strawman (4 candidates × 2 drift types)</name>
  <files>src/app/design-system/prototypes/reconciliation/page.tsx</files>

  <read_first>
    - src/app/design-system/patterns/page.tsx (lines 1149-1279 — ReconciliationStrawman function — read FULL function; this prototype EXTENDS, does NOT diverge per A16.1)
    - src/app/design-system/_fixtures/drummond/reconciliation.ts (DRUMMOND_RECONCILIATION_PAIRS — 8 pairs: 4 candidates × 2 drift types)
    - src/app/design-system/_fixtures/drummond/types.ts (DrummondReconciliationPair contract)
    - .planning/design/PATTERNS.md §11 (Reconciliation strawman with Candidates A/B/C/D documented)
    - src/components/nw/Card.tsx, Eyebrow.tsx, Money.tsx, DataRow.tsx, Badge.tsx
  </read_first>

  <action>
**Create `src/app/design-system/prototypes/reconciliation/page.tsx`:**

Single page rendering 4×2 matrix top-to-bottom. Per CONTEXT D-07: per drift-type sections (invoice↔PO at top, draw↔budget at bottom). Each section contains 4 candidate Cards stacked.

Per CONTEXT D-08: EXTENDS existing ReconciliationStrawman function visual contract — does NOT diverge. Re-implements the same 4 Card visual shapes against Drummond drift fixture.

```typescript
// src/app/design-system/prototypes/reconciliation/page.tsx
//
// Reconciliation strawman prototype — 4 candidates × 2 drift types
// rendered as 8 prototype Cards top-to-bottom. Per Stage 1.5b
// deliverable #10 + Q3=C (leading candidate documented; final lock at
// reconciliation phase post-3.9) + Q6=A+B (invoice↔PO + draw↔budget).
//
// Per CONTEXT D-07: single page rendering 4×2 matrix top-to-bottom.
// Per drift-type sections enable side-by-side scrolling comparison.
//
// Per CONTEXT D-08: extends existing ReconciliationStrawman function
// in patterns/page.tsx:1149-1279 — does NOT diverge per A16.1
// (would force forbidden PATTERNS.md §11 rewrite).
//
// Per CONTEXT D-09: uses DRUMMOND_RECONCILIATION_PAIRS fixture from
// _fixtures/drummond/reconciliation.ts — 8 paired imported/current
// shapes derived from real Source 3 invoice-vs-PO and pay-app-vs-budget
// mismatches.
//
// Hook T10c — no imports from @/lib/supabase|org|auth.

import Link from "next/link";

import {
  DRUMMOND_RECONCILIATION_PAIRS,
  type DrummondReconciliationPair,
  type DrummondReconciliationDriftType,
} from "@/app/design-system/_fixtures/drummond";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import DataRow from "@/components/nw/DataRow";

// Each pair has a candidate label embedded in id (e.g., rec-caldwell-invoice_po-1
// for candidate 1 of invoice_po drift type).
function candidateOf(pair: DrummondReconciliationPair): number {
  const match = pair.id.match(/-([1-4])$/);
  return match ? parseInt(match[1], 10) : 1;
}

// Render a single drift's value as readable text.
function val(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}

// Candidate 1 — Side-by-side delta (analog patterns/page.tsx:1168-1193)
function Candidate1SideBySide({ pair }: { pair: DrummondReconciliationPair }) {
  const driftFields = pair.diffs.map((d) => d.field);
  const importedKeys = Object.keys(pair.imported);
  const currentKeys = Object.keys(pair.current);
  const allKeys = Array.from(new Set([...importedKeys, ...currentKeys]));

  return (
    <Card padding="md">
      <Eyebrow tone="accent" className="mb-2">Candidate 1 · Side-by-side delta</Eyebrow>
      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <div className="border p-3" style={{ borderColor: "var(--border-default)" }}>
          <Eyebrow tone="muted" className="mb-2">Imported · QuickBooks</Eyebrow>
          {allKeys.map((k) => (
            <DataRow key={k} label={k.replaceAll("_", " ")} value={val(pair.imported[k])} />
          ))}
        </div>
        <div className="border p-3" style={{ borderColor: "var(--border-default)" }}>
          <Eyebrow tone="muted" className="mb-2">Current · Nightwork</Eyebrow>
          {allKeys.map((k) => {
            const isDrift = driftFields.includes(k);
            const cell = <DataRow key={k} label={k.replaceAll("_", " ")} value={val(pair.current[k])} />;
            return isDrift ? (
              <div key={k} className="border-l-2 pl-2" style={{ borderColor: "var(--nw-warn)" }}>
                {cell}
              </div>
            ) : cell;
          })}
        </div>
      </div>
    </Card>
  );
}

// Candidate 2 — Inline diff (analog patterns/page.tsx:1196-1218)
function Candidate2InlineDiff({ pair }: { pair: DrummondReconciliationPair }) {
  return (
    <Card padding="md">
      <Eyebrow tone="accent" className="mb-2">Candidate 2 · Inline diff</Eyebrow>
      <div className="text-[11px] space-y-1" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
        {pair.diffs.map((d, i) => (
          <div key={i} className="space-y-1">
            <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)", letterSpacing: "0.08em" }}>
              {d.field.replaceAll("_", " ")}
            </div>
            <div className="px-2 py-1" style={{ background: "rgba(220, 38, 38, 0.08)", color: "var(--nw-danger)" }}>
              − {val(d.imported_value)}
            </div>
            <div className="px-2 py-1" style={{ background: "rgba(34, 197, 94, 0.08)", color: "var(--nw-success)" }}>
              + {val(d.current_value)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Candidate 3 — Timeline overlay (analog patterns/page.tsx:1221-1248)
function Candidate3TimelineOverlay({ pair }: { pair: DrummondReconciliationPair }) {
  const allKeys = Array.from(new Set([...Object.keys(pair.imported), ...Object.keys(pair.current)]));
  const driftFields = pair.diffs.map((d) => d.field);

  return (
    <Card padding="md">
      <Eyebrow tone="accent" className="mb-2">Candidate 3 · Timeline overlay</Eyebrow>
      <ul className="space-y-2 text-[12px]">
        {allKeys.map((k) => {
          const isDrift = driftFields.includes(k);
          return (
            <li key={k} className="flex items-center gap-3">
              <span
                className="w-2 h-2"
                style={{
                  borderRadius: "var(--radius-dot)",
                  background: isDrift ? "var(--nw-warn)" : "var(--nw-success)",
                }}
              />
              <span className="text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)", minWidth: "100px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {k.replaceAll("_", " ")}
              </span>
              <span style={{ color: "var(--text-primary)" }}>
                {isDrift
                  ? <>imported <code>{val(pair.imported[k])}</code> vs current <code>{val(pair.current[k])}</code></>
                  : <>{val(pair.current[k])} (match)</>}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// Candidate 4 — Hybrid split + inline (analog patterns/page.tsx:1251-1276)
function Candidate4Hybrid({ pair }: { pair: DrummondReconciliationPair }) {
  const driftFields = pair.diffs.map((d) => d.field);
  const allKeys = Array.from(new Set([...Object.keys(pair.imported), ...Object.keys(pair.current)]));

  return (
    <Card padding="md">
      <Eyebrow tone="accent" className="mb-2">Candidate 4 · Hybrid (split + inline)</Eyebrow>
      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <div>
          <Eyebrow tone="muted" className="mb-2">Imported</Eyebrow>
          {allKeys.map((k) => {
            const isDrift = driftFields.includes(k);
            return (
              <div key={k} className="mb-1">
                <DataRow label={k.replaceAll("_", " ")} value={val(pair.imported[k])} />
                {isDrift && (
                  <div className="text-[9px] mt-0.5" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--nw-danger)" }}>
                    → {val(pair.current[k])}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div>
          <Eyebrow tone="muted" className="mb-2">Current</Eyebrow>
          {allKeys.map((k) => {
            const isDrift = driftFields.includes(k);
            return (
              <div key={k} className="mb-1">
                <DataRow label={k.replaceAll("_", " ")} value={val(pair.current[k])} />
                {isDrift && (
                  <div className="text-[9px] mt-0.5" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--nw-success)" }}>
                    ← {val(pair.imported[k])}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function CandidateRenderer({ pair }: { pair: DrummondReconciliationPair }) {
  const c = candidateOf(pair);
  switch (c) {
    case 1: return <Candidate1SideBySide pair={pair} />;
    case 2: return <Candidate2InlineDiff pair={pair} />;
    case 3: return <Candidate3TimelineOverlay pair={pair} />;
    case 4: return <Candidate4Hybrid pair={pair} />;
    default: return null;
  }
}

function DriftSection({ driftType, title, anchor }: { driftType: DrummondReconciliationDriftType; title: string; anchor: string }) {
  const pairs = DRUMMOND_RECONCILIATION_PAIRS
    .filter((p) => p.drift_type === driftType)
    .sort((a, b) => candidateOf(a) - candidateOf(b));

  return (
    <section id={anchor} className="mb-8">
      <Eyebrow tone="accent" className="mb-3">{title} · {pairs.length} candidates</Eyebrow>
      <div className="space-y-4">
        {pairs.map((p) => (
          <CandidateRenderer key={p.id} pair={p} />
        ))}
      </div>
    </section>
  );
}

export default function ReconciliationStrawmanPage() {
  return (
    <div className="px-6 py-8 max-w-[1400px] mx-auto">
      {/* Header band */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[12px] mb-2" style={{ color: "var(--text-tertiary)" }}>
          <Link href="/design-system/prototypes/" className="hover:underline">Prototypes</Link>
          <span>/</span>
          <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Reconciliation</span>
        </div>
        <h1 className="text-[24px] mb-1" style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 500, color: "var(--text-primary)" }}>
          Reconciliation strawman
        </h1>
        <p className="text-[13px] mb-3" style={{ color: "var(--text-secondary)" }}>
          4 candidates × 2 drift types = 8 prototypes rendered against real Drummond drift.
          Per CONTEXT Q3=C: leading candidate documented at end of 1.5b; final lock at first reconciliation phase post-3.9.
        </p>
        {/* Anchor nav */}
        <nav className="flex items-center gap-3 text-[11px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          <a href="#invoice-po" className="hover:underline">Invoice ↔ PO drift →</a>
          <span>·</span>
          <a href="#draw-budget" className="hover:underline">Draw ↔ Budget drift →</a>
        </nav>
      </div>

      {/* Drift sections */}
      <DriftSection driftType="invoice_po" title="Invoice ↔ PO drift" anchor="invoice-po" />
      <DriftSection driftType="draw_budget" title="Draw ↔ Budget drift" anchor="draw-budget" />

      {/* Footnote */}
      <div className="mt-8 p-4" style={{ background: "var(--bg-subtle)" }}>
        <Eyebrow tone="muted" className="mb-2">About this strawman</Eyebrow>
        <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
          Per CONTEXT D-08 and PATTERNS.md §11 acceptance posture (A16.1), this prototype EXTENDS the
          existing ReconciliationStrawman function in <code>src/app/design-system/patterns/page.tsx:1149-1279</code> —
          it does NOT diverge. Picking a non-Candidate-1 model now would force a non-trivial PATTERNS.md
          rewrite mid-foundation. Per Q3=C, the goal of 1.5b is to render all 4 against real Drummond drift
          so Jake's preference becomes visually obvious; the leading candidate is a recommendation, not a lock.
        </p>
      </div>
    </div>
  );
}
```

**Per CONTEXT acceptance criterion:** "Reconciliation strawman renders all 4 candidates × 2 drift types (8 prototypes)". The DriftSection component renders all candidates for each drift_type filter; Wave 0 Task 2 acceptance ensures DRUMMOND_RECONCILIATION_PAIRS contains exactly 8 entries (4 candidates × 2 drift types).

**Per CONTEXT D-08 (do NOT diverge):** the 4 Candidate components (Candidate1SideBySide, Candidate2InlineDiff, Candidate3TimelineOverlay, Candidate4Hybrid) mirror the visual contracts at `patterns/page.tsx:1168-1276` exactly. If the executor finds a "better" rendering during execute, that's a PATTERNS.md §11 polish proposal — log as 1.5b finding, do NOT modify the component shapes here.

**Leading-candidate recommendation (per Q3=C):** the executor renders all 4 honestly; Jake's preference becomes visually obvious during the 1.5b walkthrough. The plan summary notes the executor's leading-candidate observation but does NOT lock — final lock happens at the reconciliation phase post-3.9 (per D-028).
  </action>

  <verify>
    <automated>npm run build && grep -c "Candidate1SideBySide\|Candidate2InlineDiff\|Candidate3TimelineOverlay\|Candidate4Hybrid\|DRUMMOND_RECONCILIATION_PAIRS" src/app/design-system/prototypes/reconciliation/page.tsx</automated>
    Expected: build exits 0; grep returns >=5.

    Hex check: `grep -nE '#[0-9a-fA-F]{3,6}' src/app/design-system/prototypes/reconciliation/page.tsx` — ALLOWED only inside `rgba(220, 38, 38, ...)` / `rgba(34, 197, 94, ...)` calls (these are CSS rgba carve-outs for the candidate-2 inline diff backgrounds, mirror of the patterns/ analog). Any other hex MUST be 0.

    T10c check: returns 0 matches.

    Manual visual checks (Chrome MCP):
    - Visit `/design-system/prototypes/reconciliation/`. Page renders header + 2 anchor nav links.
    - Section "Invoice ↔ PO drift" shows 4 Candidate Cards stacked.
    - Section "Draw ↔ Budget drift" shows 4 Candidate Cards stacked.
    - Total 8 Candidate Cards visible.
    - Each card has its candidate label as an Eyebrow (Candidate 1 · Side-by-side delta, etc.).
    - Click anchor "Invoice ↔ PO drift" — page scrolls to that section.
    - Drift highlighting visible:
      - Candidate 1: left-border on differing field in Current column
      - Candidate 2: red minus / green plus inline rows
      - Candidate 3: warn-tone dots on drifted attributes, success on matches
      - Candidate 4: split layout with arrows (← / →) showing the cross-reference
    - Footnote disclaimer renders at bottom.
  </verify>

  <done>
    - 8 reconciliation prototypes render (4 candidates × 2 drift types)
    - Section anchors enable scroll-to-section navigation
    - Drift highlighting consistent with PATTERNS.md §11 strawman
    - 4 Candidate components mirror patterns/page.tsx:1168-1276 visual contracts
    - npm run build passes
    - Leading-candidate observation captured in summary (does NOT lock — final at reconciliation phase post-3.9)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Prototype routes (`/design-system/prototypes/*`) → tenant code | Hook T10c rejects imports |
| Print stylesheet | Pure CSS @page + @media print; no server-side PDF generator |
| Reconciliation candidate divergence | Mirrors PATTERNS.md §11 visual contracts; does not diverge |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-1.5b-W2-01 | T (Tampering) | Print stylesheet leaks personally-styled colors into print, breaks bank-acceptable monochrome | mitigate | Page-specific @page + @media print rules force `#000000` text, `#ffffff` background, `#999` borders. Existing globals.css:255-289 base print stylesheet enforces. |
| T-1.5b-W2-02 | I (Information disclosure) | Drummond name leaks into G702 cover sheet via DRUMMOND_JOBS rendering | mitigate (existing) | Wave 0 grep gates ensure DRUMMOND_JOBS contains substituted name (Caldwell). G702 renders `{job.client_name}` which is sanitized. |
| T-1.5b-W2-03 | I (Information disclosure) | Reconciliation pair imported/current shapes contain real names | mitigate (existing) | Wave 0 Task 2 generates DRUMMOND_RECONCILIATION_PAIRS via the same substitution pipeline as other fixtures. CI grep gate runs on every commit. |
| T-1.5b-W2-04 | E (Elevation of privilege) | Print page calls `window.print()` — no privilege escalation since this is a prototype with no real submission pathway | accept | window.print() opens browser print dialog; no API call. |
| T-1.5b-W2-05 | T (Tampering) | Pixel-perfect G702 attempt could bypass 1-day judgment if executor doesn't self-evaluate | mitigate | Task 1 explicitly encodes Phase 1A (1-day attempt) + Phase 1B (self-evaluate at 1-day mark). The escape clause is the documented secondary success path — invoking it is acceptable, NOT a failure. Plan summary captures the outcome. |
</threat_model>

<verification>
- npm run build passes
- Hook T10c silent on both new files
- No hardcoded hex outside print-specific carve-outs (#000, #999, #f0f0f0 in print stylesheet) and reconciliation rgba() backgrounds
- G702 renders all 7 numbered statement-of-contractor lines
- G703 renders all line items with grand total row
- Print-page-break isolates G702 to first page
- Reconciliation page renders 8 candidate cards (4 × 2)
- 1-day judgment outcome documented in plan summary (pixel-perfect achieved OR escape clause invoked)
</verification>

<success_criteria>
- Print preview at `/design-system/prototypes/draws/d-caldwell-05/print` renders G702 cover (pixel-perfect attempt or 80% per escape clause) + G703 detail (80%)
- Reconciliation strawman at `/design-system/prototypes/reconciliation/` renders 4 candidates × 2 drift types = 8 prototypes
- Phase 1B 1-day judgment encoded as explicit task structure with escape clause
- Leading-candidate observation captured in plan summary (does NOT lock per Q3=C)
- All routes pass build, T10c, and token discipline gates (rgba() exception documented for Candidate 2 backgrounds)
</success_criteria>

<output>
After completion, create `.planning/phases/stage-1.5b-prototype-gallery/stage-1.5b-prototype-gallery-6-SUMMARY.md` covering:
- **Phase 1B outcome:** Did pixel-perfect G702 converge in 1 day? OR was the escape clause invoked? (Either is success per CONTEXT D-16/D-24.)
- If escape clause invoked: log "1.5b-followup-N: pixel-perfect AIA G702 fidelity for production AIA Document Service certification — separate phase post-1.5b"
- G703 80% fidelity render observations
- Reconciliation leading-candidate observation (which candidate visually communicated drift most clearly against Drummond data?) — recommendation only; final lock at reconciliation phase post-3.9
- Critical findings (if any)
</output>
