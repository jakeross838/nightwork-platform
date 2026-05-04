---
phase: stage-1.5b-prototype-gallery
plan: 2
type: execute
wave: 1
depends_on: [1]
files_modified:
  - src/app/design-system/prototypes/invoices/[id]/page.tsx
  - src/app/design-system/prototypes/draws/[id]/page.tsx
  - src/app/design-system/prototypes/vendors/page.tsx
  - src/app/design-system/prototypes/vendors/[id]/page.tsx
autonomous: true
threat_model_severity: low
requirements: []
must_haves:
  truths:
    - "User can view a Caldwell invoice rendered with Document Review pattern at /design-system/prototypes/invoices/{id}"
    - "Invoice renders for all 4 fixture statuses (ai_processed, pm_review, qa_review, paid) with correct status badge + audit timeline"
    - "Invoice renders all 3 format types (clean PDF, T&M, lump_sum) with appropriate confidence routing colors"
    - "User can view Caldwell Pay App 5 rendered with Document Review pattern at /design-system/prototypes/draws/d-caldwell-05"
    - "Draw approval renders G702 summary panel + G703 line items table with all rows"
    - "User can browse 17 Caldwell vendors in List+Detail at /design-system/prototypes/vendors"
    - "Long vendor names ('Bay Region Carpentry Inc', 'Coastal Smart Systems LLC') render without breaking layout on nw-phone breakpoint"
    - "User can view a single vendor detail at /design-system/prototypes/vendors/{id} with vendor profile + recent invoice activity"
    - "All routes inherit Site Office direction (UPPERCASE 0.18em eyebrows, JetBrains Mono dominance, compact density, slate-tile left-stamp, 150ms motion) from prototypes/layout.tsx"
    - "All routes pass hook T10c (no @/lib/supabase|org|auth imports)"
  artifacts:
    - path: "src/app/design-system/prototypes/invoices/[id]/page.tsx"
      provides: "Invoice approval prototype — Document Review pattern with hero grid 50/50 (file preview LEFT + right-rail panels RIGHT) + audit timeline"
      contains: "CALDWELL_INVOICES"
    - path: "src/app/design-system/prototypes/draws/[id]/page.tsx"
      provides: "Draw approval prototype — Document Review pattern + G702 summary + G703 line items table"
      contains: "CALDWELL_DRAWS"
    - path: "src/app/design-system/prototypes/vendors/page.tsx"
      provides: "Vendors index — List+Detail layout with 17 entries"
      contains: "CALDWELL_VENDORS"
    - path: "src/app/design-system/prototypes/vendors/[id]/page.tsx"
      provides: "Vendor detail — Document Review pattern with profile + recent activity"
      contains: "CALDWELL_VENDORS"
  key_links:
    - from: "prototypes/invoices/[id]/page.tsx"
      to: "CALDWELL_INVOICES + CALDWELL_VENDORS + CALDWELL_JOBS + CALDWELL_COST_CODES"
      via: "named imports from @/app/design-system/_fixtures/drummond"
      pattern: "from \"@/app/design-system/_fixtures/drummond\""
    - from: "prototypes/draws/[id]/page.tsx"
      to: "CALDWELL_DRAWS + CALDWELL_DRAW_LINE_ITEMS + CALDWELL_COST_CODES + CALDWELL_CHANGE_ORDERS"
      via: "named imports from @/app/design-system/_fixtures/drummond"
      pattern: "CALDWELL_DRAW_LINE_ITEMS"
    - from: "prototypes/vendors/page.tsx"
      to: "CALDWELL_VENDORS + CALDWELL_INVOICES"
      via: "named imports + filter for vendor activity"
      pattern: "CALDWELL_VENDORS"
    - from: "prototypes/vendors/[id]/page.tsx"
      to: "CALDWELL_VENDORS + CALDWELL_INVOICES + CALDWELL_LIEN_RELEASES"
      via: "named imports + filter for vendor's invoice/lien history"
      pattern: "CALDWELL_INVOICES.filter"
---

<objective>
Render the financial workflow Document Review surfaces — invoice approval, draw approval (Pay App 5), and vendor management (list + detail). All extend PATTERNS.md §2 Document Review (gold standard) at Site Office direction with real-shape Caldwell data.

Purpose: This is the primary stress test for the gold-standard Document Review pattern. If the design system fundamentally fails on real data, the failure surfaces here first (long vendor names breaking layout, 25+ G703 line items overflowing compact density, status timeline cluttering the audit panel).

Output:
- Invoice prototype at `/design-system/prototypes/invoices/{id}` for any of 4-6 Caldwell invoices (4 statuses × 3 format types)
- Draw prototype at `/design-system/prototypes/draws/{id}` rendering Pay App 5 (canonical) with full G703 line items
- Vendor list at `/design-system/prototypes/vendors` showing all 17 Caldwell vendors in List+Detail
- Vendor detail at `/design-system/prototypes/vendors/{id}` for any single vendor
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
@.planning/design/CHOSEN-DIRECTION.md
@src/app/design-system/_fixtures/drummond/index.ts
@src/app/design-system/_fixtures/drummond/types.ts
@src/app/design-system/patterns/page.tsx
@src/app/design-system/prototypes/layout.tsx
@src/app/design-system/prototypes/page.tsx
@src/components/nw/Card.tsx
@src/components/nw/Eyebrow.tsx
@src/components/nw/Money.tsx
@src/components/nw/DataRow.tsx
@src/components/nw/Badge.tsx
@src/components/nw/StatusDot.tsx

<interfaces>
<!-- Caldwell fixture types from Wave 0 (PLAN-1). Available via:
       import { ... } from "@/app/design-system/_fixtures/drummond";
     The barrel re-exports types + all 12 const arrays. -->

Core types (full shapes in src/app/design-system/_fixtures/drummond/types.ts):
  - CaldwellInvoice (id, vendor_id, job_id, cost_code_id, po_id, co_id, invoice_number, invoice_date, description, invoice_type, total_amount, confidence_score, confidence_details, status, received_date, payment_date, draw_id, line_items, flags, original_file_url)
  - CaldwellVendor (id, name, address, phone, email, default_cost_code_id)
  - CaldwellJob (id, name, address, client_name, contract_type, original_contract_amount, current_contract_amount, gc_fee_percentage, ...)
  - CaldwellCostCode (id, code, description, category, sort_order)
  - CaldwellDraw (id, job_id, draw_number, application_date, period_start, period_end, status, revision_number, original_contract_sum, net_change_orders, contract_sum_to_date, total_completed_to_date, less_previous_payments, current_payment_due, balance_to_finish, deposit_amount)
  - CaldwellDrawLineItem (id, draw_id, budget_line_id, cost_code_id, previous_applications, this_period, total_to_date, percent_complete, balance_to_finish)
  - CaldwellChangeOrder (id, job_id, pcco_number, description, amount, gc_fee_amount, gc_fee_rate, total_with_fee, estimated_days_added, status, approved_date, draw_number)
  - CaldwellLienRelease (id, vendor_id, invoice_id, draw_id, release_type, status, release_date, amount_through)

Const arrays (named exports):
  - CALDWELL_INVOICES: CaldwellInvoice[]
  - CALDWELL_VENDORS: CaldwellVendor[]
  - CALDWELL_JOBS: CaldwellJob[]
  - CALDWELL_COST_CODES: CaldwellCostCode[]
  - CALDWELL_DRAWS: CaldwellDraw[]
  - CALDWELL_DRAW_LINE_ITEMS: CaldwellDrawLineItem[]
  - CALDWELL_CHANGE_ORDERS: CaldwellChangeOrder[]
  - CALDWELL_LIEN_RELEASES: CaldwellLienRelease[]

<!-- Nightwork primitive components (from src/components/nw/). All read CSS
     vars; all are tenant-blind (no org_id/membership/vendor_id props). -->

import Card from "@/components/nw/Card";
  // Props: padding="none" | "sm" | "md" | "lg", className?, children
  // Renders with data-slot="card" (picked up by direction-aware CSS)

import Eyebrow from "@/components/nw/Eyebrow";
  // Props: tone="default" | "muted" | "accent" | "success" | "warn" | "danger",
  //        icon?: ReactNode, className?, children
  // Renders with data-slot="eyebrow" (UPPERCASE in Site Office)

import Money from "@/components/nw/Money";
  // Props: cents: number, size="sm" | "md" | "lg", variant="default" | "emphasized"
  // Renders cents as $X,XXX.XX in JetBrains Mono

import DataRow from "@/components/nw/DataRow";
  // Props: label: string, value: ReactNode
  // Renders 2-column key-value row

import Badge from "@/components/nw/Badge";
  // Props: variant="neutral" | "accent" | "success" | "warn" | "danger" | "info"
  // Renders status pill

<!-- Document Review pattern shape (analog: src/app/design-system/patterns/page.tsx
     Pattern1DocumentReview at lines 259-407). Hero grid 50/50: file preview LEFT
     + right-rail panels RIGHT, audit timeline below. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Invoice approval prototype</name>
  <files>src/app/design-system/prototypes/invoices/[id]/page.tsx</files>

  <read_first>
    - src/app/design-system/patterns/page.tsx (lines 259-407 — Pattern1DocumentReview FULL function; the gold standard layout)
    - src/app/design-system/_fixtures/drummond/types.ts (CaldwellInvoice + sub-types — full file from Wave 0)
    - src/app/design-system/_fixtures/drummond/invoices.ts (full file — actual fixture data the prototype renders)
    - src/app/design-system/_fixtures/invoices.ts (analog: SAMPLE_INVOICES — see how status badge variants map to confidence routing)
    - src/app/design-system/_fixtures/drummond/vendors.ts (resolve vendor_id → name)
    - src/app/design-system/_fixtures/drummond/jobs.ts (resolve job_id → name)
    - src/app/design-system/_fixtures/drummond/cost-codes.ts (resolve cost_code_id → code+description)
    - src/components/nw/Card.tsx (Card component API)
    - src/components/nw/Eyebrow.tsx (Eyebrow component API)
    - src/components/nw/Money.tsx (Money component API)
    - src/components/nw/DataRow.tsx (DataRow component API)
    - src/components/nw/Badge.tsx (Badge component API)
    - .planning/design/PATTERNS.md §2 (Document Review canonical contract — confirms file preview LEFT, right-rail RIGHT, audit timeline BELOW)
    - CLAUDE.md (invoice statuses + confidence routing thresholds: ≥85% green, 70-84% yellow, <70% red)
  </read_first>

  <action>
**Create `src/app/design-system/prototypes/invoices/[id]/page.tsx`:**

Mirror `src/app/design-system/patterns/page.tsx:259-407` Pattern1DocumentReview structure, but:
- Replace static demo data with lookup against `CALDWELL_INVOICES` by `params.id`
- Add a header band with breadcrumb + invoice number + vendor name + status badge + action buttons
- Add the bottom audit timeline derived from invoice.status (faked since CaldwellInvoice doesn't carry status_history JSONB — label as faked client-side per F1 gap)

```typescript
// src/app/design-system/prototypes/invoices/[id]/page.tsx
//
// Invoice approval prototype — Document Review pattern (PATTERNS §2)
// rendering real-shape Caldwell invoice data. Per Stage 1.5b deliverable #2.
//
// Hero grid 50/50: file preview LEFT, right-rail panels RIGHT, audit
// timeline below. Validates the gold-standard layout under real-data
// stress (4 invoice statuses × 3 format types per CLAUDE.md routing).
//
// Site Office direction inherited from prototypes/layout.tsx.
// Hook T10c — no imports from @/lib/supabase|org|auth.

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  PaperClipIcon,
  CheckBadgeIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

import {
  CALDWELL_INVOICES,
  CALDWELL_VENDORS,
  CALDWELL_JOBS,
  CALDWELL_COST_CODES,
  type CaldwellInvoiceStatus,
  type CaldwellInvoiceConfidenceDetails,
} from "@/app/design-system/_fixtures/drummond";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Money from "@/components/nw/Money";
import DataRow from "@/components/nw/DataRow";
import Badge from "@/components/nw/Badge";

// Map invoice status → Badge variant. Mirror confidence routing colors per CLAUDE.md.
const STATUS_BADGE: Record<CaldwellInvoiceStatus, { variant: "neutral" | "accent" | "success" | "warn" | "danger" | "info"; label: string }> = {
  received: { variant: "neutral", label: "RECEIVED" },
  ai_processed: { variant: "warn", label: "AI PROCESSED" },         // yellow flag (70-84%)
  pm_review: { variant: "warn", label: "PM REVIEW" },
  pm_approved: { variant: "success", label: "PM APPROVED" },
  pm_held: { variant: "warn", label: "PM HELD" },
  pm_denied: { variant: "danger", label: "PM DENIED" },
  qa_review: { variant: "info", label: "QA REVIEW" },
  qa_approved: { variant: "success", label: "QA APPROVED" },
  qa_kicked_back: { variant: "danger", label: "QA KICKED BACK" },
  pushed_to_qb: { variant: "success", label: "PUSHED TO QB" },
  in_draw: { variant: "info", label: "IN DRAW" },
  paid: { variant: "success", label: "PAID" },
};

// Confidence color encoding per CLAUDE.md routing thresholds.
function confidenceTone(score: number): "success" | "warn" | "danger" {
  if (score >= 0.85) return "success";
  if (score >= 0.7) return "warn";
  return "danger";
}

// Build a faked status timeline from the invoice's terminal status.
// CaldwellInvoice doesn't carry status_history JSONB (per F1 gap). The
// timeline below shows the workflow path that would have been taken to
// reach the current status — labeled as faked client-side.
function buildTimeline(inv: typeof CALDWELL_INVOICES[number]) {
  const steps: Array<{ when: string; what: string; done: boolean }> = [];
  const r = inv.received_date;
  steps.push({ when: `${r} · 10:04`, what: "RECEIVED via email-in", done: true });
  if (["ai_processed", "pm_review", "pm_approved", "qa_review", "qa_approved", "pushed_to_qb", "in_draw", "paid"].includes(inv.status)) {
    steps.push({ when: `${r} · 10:06`, what: `AI PARSED (confidence ${(inv.confidence_score * 100).toFixed(0)}%)`, done: true });
  }
  if (["pm_review", "pm_approved", "qa_review", "qa_approved", "pushed_to_qb", "in_draw", "paid"].includes(inv.status)) {
    steps.push({ when: `${r} · 11:18`, what: "PM ASSIGNED Bob Mozine", done: true });
  }
  if (["pm_approved", "qa_review", "qa_approved", "pushed_to_qb", "in_draw", "paid"].includes(inv.status)) {
    steps.push({ when: `${r} · 14:22`, what: "PM APPROVED", done: true });
  }
  if (["qa_review", "qa_approved", "pushed_to_qb", "in_draw", "paid"].includes(inv.status)) {
    steps.push({ when: `${r} · 16:00`, what: "QA REVIEW (Diane)", done: true });
  }
  if (["qa_approved", "pushed_to_qb", "in_draw", "paid"].includes(inv.status)) {
    steps.push({ when: `${r} · 17:30`, what: "QA APPROVED", done: true });
  }
  if (["pushed_to_qb", "in_draw", "paid"].includes(inv.status)) {
    steps.push({ when: `${r} · 17:35`, what: "PUSHED TO QB", done: true });
  }
  if (["paid"].includes(inv.status) && inv.payment_date) {
    steps.push({ when: `${inv.payment_date} · 09:00`, what: `PAID via check ${"#"} (Ross Built rule)`, done: true });
  }
  return steps;
}

// Confidence per-field grid for AI parse panel.
function ConfidenceGrid({ details }: { details: CaldwellInvoiceConfidenceDetails }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-[11px]">
      {(Object.keys(details) as Array<keyof CaldwellInvoiceConfidenceDetails>).map((k) => {
        const tone = confidenceTone(details[k]);
        return (
          <div key={k} className="flex items-center justify-between p-2" style={{ background: "var(--bg-subtle)" }}>
            <span style={{ color: "var(--text-secondary)" }}>{k.replaceAll("_", " ")}</span>
            <Badge variant={tone}>{(details[k] * 100).toFixed(0)}%</Badge>
          </div>
        );
      })}
    </div>
  );
}

export default function InvoicePrototypePage({ params }: { params: { id: string } }) {
  const inv = CALDWELL_INVOICES.find((i) => i.id === params.id);
  if (!inv) return notFound();

  const vendor = CALDWELL_VENDORS.find((v) => v.id === inv.vendor_id);
  const job = CALDWELL_JOBS.find((j) => j.id === inv.job_id);
  const costCode = inv.cost_code_id ? CALDWELL_COST_CODES.find((c) => c.id === inv.cost_code_id) : null;
  const status = STATUS_BADGE[inv.status];
  const timeline = buildTimeline(inv);

  return (
    <div className="px-6 py-8 max-w-[1600px] mx-auto">
      {/* Header band — breadcrumb + invoice meta + status + actions */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] mb-2" style={{ color: "var(--text-tertiary)" }}>
            <Link href="/design-system/prototypes/" className="hover:underline">Prototypes</Link>
            <span>/</span>
            <Link href="/design-system/prototypes/invoices" className="hover:underline">Invoices</Link>
            <span>/</span>
            <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>{inv.invoice_number ?? inv.id}</span>
          </div>
          <h1
            className="text-[24px] mb-1"
            style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 500, color: "var(--text-primary)" }}
          >
            {vendor?.name ?? "Unknown vendor"}
          </h1>
          <div className="flex items-center gap-3">
            <Money cents={inv.total_amount} size="lg" variant="emphasized" />
            <Badge variant={status.variant}>{status.label}</Badge>
            <span className="text-[11px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)" }}>
              {inv.invoice_type.replaceAll("_", " ").toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 px-4 py-2 text-[12px] border"
            style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", background: "var(--bg-card)" }}
          >
            <XMarkIcon className="w-4 h-4" strokeWidth={1.5} /> Reject
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-4 py-2 text-[12px]"
            style={{ background: "var(--nw-stone-blue)", color: "var(--nw-white-sand)" }}
          >
            <CheckBadgeIcon className="w-4 h-4" strokeWidth={1.5} /> Push to QB
          </button>
        </div>
      </div>

      {/* Hero grid 50/50 — analog: patterns/page.tsx:314-404 */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 mb-6"
        style={{ gap: "1px", background: "var(--border-default)" }}
      >
        {/* LEFT — file preview placeholder (per PATTERNS.md §2 file preview LEFT) */}
        <div className="p-5" style={{ background: "var(--bg-card)" }}>
          <Eyebrow tone="muted" className="mb-3">Source document</Eyebrow>
          <div
            className="aspect-[3/4] border flex flex-col items-center justify-center"
            style={{ background: "var(--bg-subtle)", borderColor: "var(--border-subtle)" }}
          >
            <PaperClipIcon className="w-8 h-8 mb-3" strokeWidth={1.25} style={{ color: "var(--text-tertiary)" }} />
            <span className="text-[10px] uppercase" style={{ fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "0.18em", color: "var(--text-tertiary)" }}>
              {inv.original_file_url ?? "Invoice PDF preview"}
            </span>
          </div>
        </div>

        {/* RIGHT — right-rail panels (per PATTERNS.md §2 structured fields RIGHT) */}
        <div className="p-5 space-y-4" style={{ background: "var(--bg-card)" }}>
          <Card padding="md">
            <Eyebrow tone="accent" className="mb-3">Invoice details</Eyebrow>
            <div className="grid grid-cols-2 gap-3">
              <DataRow label="Invoice #" value={inv.invoice_number ?? "—"} />
              <DataRow label="Date" value={inv.invoice_date ?? "—"} />
              <DataRow label="Vendor" value={vendor?.name ?? "—"} />
              <DataRow label="Project" value={job?.name ?? "—"} />
              <DataRow label="Cost code" value={costCode ? `${costCode.code} · ${costCode.description}` : "—"} />
              <DataRow label="PO #" value={inv.po_id ?? "—"} />
              <DataRow label="Received" value={inv.received_date} />
              <DataRow label="Payment" value={inv.payment_date ?? "—"} />
            </div>
          </Card>

          <Card padding="md">
            <Eyebrow tone="muted" className="mb-2">AI parse confidence</Eyebrow>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Overall</span>
              <Badge variant={confidenceTone(inv.confidence_score)}>{(inv.confidence_score * 100).toFixed(0)}%</Badge>
            </div>
            <ConfidenceGrid details={inv.confidence_details} />
            {inv.flags.length > 0 && (
              <div className="mt-3 flex items-center gap-1 text-[11px]" style={{ color: "var(--nw-warn)" }}>
                <ExclamationTriangleIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
                {inv.flags.join(" · ")}
              </div>
            )}
          </Card>

          {/* Line items panel */}
          {inv.line_items.length > 0 && (
            <Card padding="md">
              <Eyebrow tone="muted" className="mb-2">Line items · {inv.line_items.length}</Eyebrow>
              <ul className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                {inv.line_items.map((li, i) => (
                  <li key={i} className="py-2 flex items-start justify-between gap-3 text-[12px]">
                    <div>
                      <div style={{ color: "var(--text-primary)" }}>{li.description}</div>
                      {li.qty !== null && li.unit && li.rate !== null && (
                        <div className="text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)" }}>
                          {li.qty} {li.unit} @ ${li.rate.toLocaleString()}
                        </div>
                      )}
                    </div>
                    <Money cents={li.amount} size="sm" />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {/* Audit timeline (BELOW per PATTERNS.md §2) — faked client-side per F1 gap */}
      <Card padding="md">
        <Eyebrow tone="muted" className="mb-2">Status timeline</Eyebrow>
        <div className="mb-2 text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)" }}>
          Note: timeline reconstructed from terminal status. Real status_history JSONB lands in F1.
        </div>
        <ul className="space-y-2 text-[12px]">
          {timeline.map((e, i) => (
            <li key={i} className="flex items-center gap-3">
              <span
                className="w-1.5 h-1.5"
                style={{
                  borderRadius: "var(--radius-dot)",
                  background: e.done ? "var(--nw-stone-blue)" : "var(--border-default)",
                }}
              />
              <span className="text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)", minWidth: "120px" }}>
                {e.when}
              </span>
              <span style={{ color: e.done ? "var(--text-primary)" : "var(--text-tertiary)" }}>{e.what}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
```

**Site Office variant ASSERTIONS (inherited from prototypes/layout.tsx):**
- Eyebrow text auto-renders UPPERCASE 0.18em via `[data-direction="C"] [data-slot="eyebrow"]` selector in design-system.css
- Card auto-renders with 1px slate-tile left-stamp via `[data-direction="C"] [data-slot="card"]` selector
- Compact density via card-padding-y: 1rem inherited from data-direction="C" tokens
- Motion 150ms ease-out (no animations needed in this static prototype, but transition utilities will pick it up)

**Per CONTEXT D-22 / PATTERNS.md token discipline:** every color reference is `var(--...)` — no hex literals. Verify with grep.
  </action>

  <verify>
    <automated>npm run build && grep -c "CALDWELL_INVOICES" src/app/design-system/prototypes/invoices/[id]/page.tsx</automated>
    Expected: build exits 0; grep returns >=1.

    Hex check: `grep -nE '#[0-9a-fA-F]{3,6}' src/app/design-system/prototypes/invoices/[id]/page.tsx` returns 0 matches.

    T10c check: `grep -E '@/lib/(supabase|org|auth)' src/app/design-system/prototypes/invoices/[id]/page.tsx` returns 0 matches.

    Manual visual checks (executor uses Chrome MCP per CLAUDE.md mandatory testing rule):
    - Visit `http://localhost:3000/design-system/prototypes/invoices/inv-caldwell-001` (or actual fixture id — first invoice in CALDWELL_INVOICES). Renders without errors.
    - Eyebrows are UPPERCASE with wide tracking (0.18em — Site Office).
    - Cards have 1px slate-tile left-stamp (NOT brass-bezel top — that's Direction A).
    - Money values render in JetBrains Mono, tabular-nums.
    - Status badge color matches confidence routing (paid=green, pm_review=yellow, qa_review=blue/info, ai_processed=yellow).
    - Cycle through invoices for each status: visit `inv-caldwell-001` through end of fixture; each renders without crashing on missing optional fields (cost_code, po_id, payment_date can be null).
  </verify>

  <done>
    - Invoice prototype renders for all 4+ Caldwell invoices (statuses: ai_processed, pm_review, qa_review, paid)
    - Document Review hero grid 50/50 + audit timeline below
    - All 3 invoice_type values render distinctively (progress, time_and_materials, lump_sum)
    - Confidence routing colors match CLAUDE.md thresholds (≥85% green, 70-84% yellow, <70% red)
    - Site Office direction visually applied (UPPERCASE 0.18em, slate-tile stamp, compact density)
    - Hook T10c silent
    - No hardcoded hex
    - npm run build passes
  </done>
</task>

<task type="auto">
  <name>Task 2: Draw approval prototype (Pay App 5 canonical)</name>
  <files>src/app/design-system/prototypes/draws/[id]/page.tsx</files>

  <read_first>
    - src/app/design-system/patterns/page.tsx (lines 259-407 Pattern1DocumentReview AND lines 1048-1143 Pattern9PrintView G703 simulated table)
    - src/app/design-system/_fixtures/drummond/draws.ts (CALDWELL_DRAWS — 5 entries, Draw #5 canonical)
    - src/app/design-system/_fixtures/drummond/draw-line-items.ts (CALDWELL_DRAW_LINE_ITEMS — one per cost code per draw)
    - src/app/design-system/_fixtures/drummond/cost-codes.ts (resolve cost_code_id → code+description for G703 row Display)
    - src/app/design-system/_fixtures/drummond/change-orders.ts (PCCO log for G702 cover sheet CO summary table)
    - src/app/design-system/_fixtures/drummond/jobs.ts (resolve job_id → job name + contract amount)
    - src/app/draws/[id]/page.tsx lines 269-470 (production draws print pattern; the conditional rendering pattern though we don't print HERE; reference the Telex-ticker audit timeline + summary panel layout)
    - .planning/design/PATTERNS.md §2 + §3 (Document Review extends to Multi-step Approval)
    - CLAUDE.md (G702/G703 schema reference; AIA columns A-J)
    - src/components/nw/* (Card, Eyebrow, Money, DataRow, Badge — same set as Task 1)
  </read_first>

  <action>
**Create `src/app/design-system/prototypes/draws/[id]/page.tsx`:**

Document Review pattern extending to draw approval (per PATTERNS.md §2 + §3 + D-008). Hero layout:
- LEFT: G702 cover sheet summary (contract amounts + change orders rolled up)
- RIGHT: G703 line items table (compact density; one row per cost code)
- BOTTOM: Audit timeline (Site Office Telex-ticker style — JetBrains Mono uppercase eyebrows)

Header band: breadcrumb + draw number + period + status badge + Print button (links to `prototypes/draws/[id]/print`) + Approve action.

```typescript
// src/app/design-system/prototypes/draws/[id]/page.tsx
//
// Draw approval prototype — Document Review pattern extends to draw
// approval per CONTEXT D-008 + PATTERNS.md §2/§3. Pay App 5
// (d-caldwell-05) is the canonical render target per
// EXPANDED-SCOPE deliverable #3.
//
// Hero layout: G702 summary LEFT + G703 line items RIGHT.
// Audit timeline below (Site Office Telex-ticker per design tokens).
//
// Hook T10c — no imports from @/lib/supabase|org|auth.

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  PrinterIcon,
  CheckBadgeIcon,
  ArrowUturnLeftIcon,
} from "@heroicons/react/24/outline";

import {
  CALDWELL_DRAWS,
  CALDWELL_DRAW_LINE_ITEMS,
  CALDWELL_COST_CODES,
  CALDWELL_CHANGE_ORDERS,
  CALDWELL_JOBS,
  type CaldwellDrawStatus,
} from "@/app/design-system/_fixtures/drummond";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Money from "@/components/nw/Money";
import DataRow from "@/components/nw/DataRow";
import Badge from "@/components/nw/Badge";

const STATUS_BADGE: Record<CaldwellDrawStatus, { variant: "neutral" | "accent" | "success" | "warn" | "danger" | "info"; label: string }> = {
  draft: { variant: "neutral", label: "DRAFT" },
  pm_review: { variant: "warn", label: "PM REVIEW" },
  approved: { variant: "success", label: "APPROVED" },
  submitted: { variant: "info", label: "SUBMITTED" },
  paid: { variant: "success", label: "PAID" },
  void: { variant: "danger", label: "VOID" },
};

export default function DrawPrototypePage({ params }: { params: { id: string } }) {
  const draw = CALDWELL_DRAWS.find((d) => d.id === params.id);
  if (!draw) return notFound();

  const job = CALDWELL_JOBS.find((j) => j.id === draw.job_id);
  const status = STATUS_BADGE[draw.status];
  const lineItems = CALDWELL_DRAW_LINE_ITEMS.filter((li) => li.draw_id === draw.id);
  const cosThroughThisDraw = CALDWELL_CHANGE_ORDERS.filter((co) => co.draw_number !== null && co.draw_number <= draw.draw_number);

  return (
    <div className="px-6 py-8 max-w-[1600px] mx-auto">
      {/* Header band */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] mb-2" style={{ color: "var(--text-tertiary)" }}>
            <Link href="/design-system/prototypes/" className="hover:underline">Prototypes</Link>
            <span>/</span>
            <Link href="/design-system/prototypes/draws" className="hover:underline">Draws</Link>
            <span>/</span>
            <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Draw #{draw.draw_number}</span>
            {draw.revision_number > 0 && (
              <span style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--nw-warn)" }}>
                Rev {draw.revision_number}
              </span>
            )}
          </div>
          <h1 className="text-[24px] mb-1" style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 500, color: "var(--text-primary)" }}>
            {job?.name} — Pay App #{draw.draw_number}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
              Period: {draw.period_start} – {draw.period_end} · Application: {draw.application_date}
            </span>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/design-system/prototypes/draws/${draw.id}/print`}
            className="inline-flex items-center gap-1 px-4 py-2 text-[12px] border"
            style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", background: "var(--bg-card)" }}
          >
            <PrinterIcon className="w-4 h-4" strokeWidth={1.5} /> Print
          </Link>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-4 py-2 text-[12px] border"
            style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", background: "var(--bg-card)" }}
          >
            <ArrowUturnLeftIcon className="w-4 h-4" strokeWidth={1.5} /> Send back to draft
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-4 py-2 text-[12px]"
            style={{ background: "var(--nw-stone-blue)", color: "var(--nw-white-sand)" }}
          >
            <CheckBadgeIcon className="w-4 h-4" strokeWidth={1.5} /> Approve
          </button>
        </div>
      </div>

      {/* Hero grid — LEFT: G702 summary, RIGHT: G703 line items */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] mb-6"
        style={{ gap: "1px", background: "var(--border-default)" }}
      >
        {/* LEFT — G702 cover sheet summary */}
        <div className="p-5 space-y-4" style={{ background: "var(--bg-card)" }}>
          <Eyebrow tone="accent">G702 — Application & Certificate</Eyebrow>
          <Card padding="md">
            <div className="space-y-2">
              <DataRow label="Original contract sum" value={<Money cents={draw.original_contract_sum} size="md" />} />
              <DataRow label="Net change orders" value={<Money cents={draw.net_change_orders} size="md" />} />
              <DataRow label="Contract sum to date" value={<Money cents={draw.contract_sum_to_date} size="md" variant="emphasized" />} />
              <DataRow label="Total completed to date" value={<Money cents={draw.total_completed_to_date} size="md" />} />
              <DataRow label="Less previous payments" value={<Money cents={draw.less_previous_payments} size="md" />} />
              <DataRow label="Current payment due" value={<Money cents={draw.current_payment_due} size="md" variant="emphasized" />} />
              <DataRow label="Balance to finish" value={<Money cents={draw.balance_to_finish} size="md" />} />
            </div>
          </Card>

          {cosThroughThisDraw.length > 0 && (
            <Card padding="md">
              <Eyebrow tone="muted" className="mb-2">Change orders · {cosThroughThisDraw.length}</Eyebrow>
              <ul className="space-y-2 text-[12px]">
                {cosThroughThisDraw.map((co) => (
                  <li key={co.id} className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)" }}>
                        PCCO #{co.pcco_number}
                      </div>
                      <div style={{ color: "var(--text-primary)" }}>{co.description}</div>
                    </div>
                    <Money cents={co.total_with_fee} size="sm" />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* RIGHT — G703 line items table — analog: patterns/page.tsx:1086-1133 */}
        <div className="p-5" style={{ background: "var(--bg-card)" }}>
          <Eyebrow tone="accent" className="mb-3">G703 — Continuation sheet · {lineItems.length} line items</Eyebrow>
          <div className="overflow-x-auto">
            <table
              className="w-full text-[10px]"
              style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
            >
              <thead>
                <tr style={{ background: "var(--bg-subtle)" }}>
                  {["Item", "Description", "Original", "Previous", "This period", "Total to date", "%", "Balance"].map((h) => (
                    <th
                      key={h}
                      className="px-2 py-2 text-left border"
                      style={{
                        borderColor: "var(--border-default)",
                        color: "var(--text-secondary)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        fontSize: "9px",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li) => {
                  const cc = CALDWELL_COST_CODES.find((c) => c.id === li.cost_code_id);
                  return (
                    <tr key={li.id}>
                      <td className="px-2 py-1.5 border" style={{ borderColor: "var(--border-subtle)" }}>{cc?.code ?? "—"}</td>
                      <td className="px-2 py-1.5 border" style={{ borderColor: "var(--border-subtle)" }}>{cc?.description ?? "—"}</td>
                      <td className="px-2 py-1.5 border text-right" style={{ borderColor: "var(--border-subtle)" }}>
                        ${(li.previous_applications + li.this_period + li.balance_to_finish).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-2 py-1.5 border text-right" style={{ borderColor: "var(--border-subtle)" }}>
                        ${(li.previous_applications / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-2 py-1.5 border text-right" style={{ borderColor: "var(--border-subtle)" }}>
                        ${(li.this_period / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-2 py-1.5 border text-right" style={{ borderColor: "var(--border-subtle)" }}>
                        ${(li.total_to_date / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-2 py-1.5 border text-right" style={{ borderColor: "var(--border-subtle)" }}>
                        {(li.percent_complete * 100).toFixed(1)}%
                      </td>
                      <td className="px-2 py-1.5 border text-right" style={{ borderColor: "var(--border-subtle)" }}>
                        ${(li.balance_to_finish / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Audit timeline */}
      <Card padding="md">
        <Eyebrow tone="muted" className="mb-2">Status timeline</Eyebrow>
        <div className="mb-2 text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)" }}>
          Note: timeline reconstructed from terminal status. Real status_history JSONB lands in F1.
        </div>
        <ul className="space-y-2 text-[12px]">
          <li className="flex items-center gap-3">
            <span className="w-1.5 h-1.5" style={{ borderRadius: "var(--radius-dot)", background: "var(--nw-stone-blue)" }} />
            <span className="text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)", minWidth: "120px" }}>
              {draw.application_date}
            </span>
            <span style={{ color: "var(--text-primary)" }}>DRAFTED for period {draw.period_start} – {draw.period_end}</span>
          </li>
          {draw.submitted_at && (
            <li className="flex items-center gap-3">
              <span className="w-1.5 h-1.5" style={{ borderRadius: "var(--radius-dot)", background: "var(--nw-stone-blue)" }} />
              <span className="text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)", minWidth: "120px" }}>
                {draw.submitted_at.slice(0, 10)}
              </span>
              <span style={{ color: "var(--text-primary)" }}>SUBMITTED to owner</span>
            </li>
          )}
          {draw.paid_at && (
            <li className="flex items-center gap-3">
              <span className="w-1.5 h-1.5" style={{ borderRadius: "var(--radius-dot)", background: "var(--nw-stone-blue)" }} />
              <span className="text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)", minWidth: "120px" }}>
                {draw.paid_at.slice(0, 10)}
              </span>
              <span style={{ color: "var(--text-primary)" }}>PAID</span>
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
```

**Per acceptance criterion:** "All 30+ line item DataGrid renders within Site Office compact density without horizontal scroll on `nw-tablet`." This task uses raw `<table>` for the G703 (matches the PATTERNS.md §10 print contract). The `overflow-x-auto` wrapper allows horizontal scroll on phone if columns don't fit; on tablet (`nw-tablet` breakpoint = ≥768px), all 8 columns must fit without overflow. Verify visually at execute time.

**Per CONTEXT D-08 / PATTERNS.md §2:** Document Review extends here. The hero is split LEFT (G702 summary) / RIGHT (G703 detail) instead of file preview / right-rail panels. This is a deliberate evolution of the gold-standard pattern for the draw-approval workflow — both halves share the audit timeline below.
  </action>

  <verify>
    <automated>npm run build && grep -c "CALDWELL_DRAW_LINE_ITEMS" src/app/design-system/prototypes/draws/[id]/page.tsx</automated>
    Expected: build exits 0; grep returns >=1.

    Hex check + T10c check (same patterns as Task 1) return 0 matches.

    Manual visual checks (Chrome MCP):
    - Visit `http://localhost:3000/design-system/prototypes/draws/d-caldwell-05`. Page renders without crashing.
    - G703 line items table shows ALL line items for Pay App 5 (count matches `CALDWELL_DRAW_LINE_ITEMS.filter(l => l.draw_id === "d-caldwell-05").length`).
    - On tablet width (768px+), all 8 G703 columns fit without horizontal scroll.
    - On phone width (360px), horizontal scroll appears (acceptable per PATTERNS.md §2 mobile behavior).
    - Status timeline at bottom shows ≥1 entry derived from draw status.
    - Try `d-caldwell-01` through `d-caldwell-04` — all render without errors.
  </verify>

  <done>
    - Draw prototype renders Pay App 5 (canonical) with full G703 line items
    - G702 summary panel + G703 line items table + audit timeline structure matches Document Review extension
    - All 5 historical draws render without errors
    - Cost code resolution (id → code+description) works for all G703 rows
    - PCCO change order summary shows COs that affect this draw (filtered by draw_number)
    - Site Office direction visually applied
    - npm run build passes
  </done>
</task>

<task type="auto">
  <name>Task 3: Vendors list + vendor detail prototypes</name>
  <files>src/app/design-system/prototypes/vendors/page.tsx, src/app/design-system/prototypes/vendors/[id]/page.tsx</files>

  <read_first>
    - src/app/design-system/patterns/page.tsx (lines 818-869 Pattern6ListDetail; lines 871-940ish Pattern1DocumentReviewMini for the detail-pane pattern)
    - src/app/design-system/_fixtures/drummond/vendors.ts (CALDWELL_VENDORS — 17 entries; includes long names like "Bay Region Carpentry Inc")
    - src/app/design-system/_fixtures/drummond/invoices.ts (filter for vendor's recent invoice activity)
    - src/app/design-system/_fixtures/drummond/cost-codes.ts (resolve default_cost_code_id → code+description)
    - src/app/design-system/_fixtures/drummond/lien-releases.ts (filter for vendor's lien-release activity)
    - .planning/design/PATTERNS.md §7 (List + Detail layout — shows the 280px list rail + variable detail pattern)
    - src/components/nw/* (Card, Eyebrow, DataRow, Money, Badge)
  </read_first>

  <action>
**Step A — Create `src/app/design-system/prototypes/vendors/page.tsx`:**

List + Detail layout. 280px LEFT rail listing all 17 vendors; RIGHT pane defaults to first vendor's profile (or empty state with "Select a vendor" prompt). Per Pattern6ListDetail analog with selection driven by URL search params (`?selected=v-caldwell-...`).

```typescript
// src/app/design-system/prototypes/vendors/page.tsx
//
// Vendors list — Drummond all 17 vendors in PATTERNS.md §7 List + Detail
// layout. Per Stage 1.5b deliverable #6.
//
// Stress test: long names (Bay Region Carpentry Inc, Coastal Smart Systems
// LLC) must render without breaking layout on mobile.
//
// Hook T10c — no imports from @/lib/supabase|org|auth.

"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

import {
  CALDWELL_VENDORS,
  CALDWELL_INVOICES,
  CALDWELL_COST_CODES,
} from "@/app/design-system/_fixtures/drummond";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Money from "@/components/nw/Money";
import DataRow from "@/components/nw/DataRow";
import Badge from "@/components/nw/Badge";

export default function VendorsListPage() {
  const [selectedId, setSelectedId] = useState<string>(CALDWELL_VENDORS[0]?.id ?? "");
  const selected = CALDWELL_VENDORS.find((v) => v.id === selectedId) ?? CALDWELL_VENDORS[0];
  const recentInvoices = CALDWELL_INVOICES
    .filter((i) => i.vendor_id === selected?.id)
    .sort((a, b) => (b.received_date ?? "").localeCompare(a.received_date ?? ""))
    .slice(0, 5);
  const totalInvoiced = CALDWELL_INVOICES
    .filter((i) => i.vendor_id === selected?.id)
    .reduce((sum, i) => sum + i.total_amount, 0);
  const defaultCC = selected?.default_cost_code_id
    ? CALDWELL_COST_CODES.find((c) => c.id === selected.default_cost_code_id)
    : null;

  return (
    <div className="px-6 py-8 max-w-[1600px] mx-auto">
      {/* Header band */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[12px] mb-2" style={{ color: "var(--text-tertiary)" }}>
          <Link href="/design-system/prototypes/" className="hover:underline">Prototypes</Link>
          <span>/</span>
          <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Vendors</span>
        </div>
        <h1 className="text-[24px] mb-1" style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 500, color: "var(--text-primary)" }}>
          Vendors
        </h1>
        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {CALDWELL_VENDORS.length} active vendors on the Caldwell Residence project.
        </p>
      </div>

      {/* List + Detail — analog: patterns/page.tsx:822-867 */}
      <Card padding="none">
        <div
          className="grid grid-cols-1 md:grid-cols-[280px_1fr]"
          style={{ minHeight: "560px" }}
        >
          {/* LEFT — list rail */}
          <div className="border-r" style={{ borderColor: "var(--border-default)" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-default)" }}>
              <Eyebrow tone="muted">Vendors · {CALDWELL_VENDORS.length}</Eyebrow>
            </div>
            <ul>
              {CALDWELL_VENDORS.map((v) => {
                const isSelected = v.id === selected?.id;
                return (
                  <li
                    key={v.id}
                    className="px-4 py-3 border-b cursor-pointer"
                    style={{
                      borderColor: "var(--border-subtle)",
                      background: isSelected ? "var(--bg-subtle)" : "transparent",
                      borderLeft: isSelected ? "2px solid var(--nw-stone-blue)" : "2px solid transparent",
                    }}
                    onClick={() => setSelectedId(v.id)}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      {/* truncate prevents long names from breaking layout */}
                      <span className="text-[12px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {v.name}
                      </span>
                    </div>
                    <div className="text-[10px] truncate" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)" }}>
                      {v.email}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* RIGHT — detail pane */}
          <div className="p-5">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <Eyebrow tone="accent" className="mb-2">Vendor profile</Eyebrow>
                    <h2 className="text-[20px] mb-1" style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 500, color: "var(--text-primary)" }}>
                      {selected.name}
                    </h2>
                  </div>
                  <Link
                    href={`/design-system/prototypes/vendors/${selected.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] border"
                    style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", background: "var(--bg-card)" }}
                  >
                    Open detail <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card padding="md">
                    <Eyebrow tone="muted" className="mb-3">Contact</Eyebrow>
                    <div className="space-y-2">
                      <DataRow label="Address" value={selected.address} />
                      <DataRow label="Phone" value={selected.phone} />
                      <DataRow label="Email" value={selected.email} />
                      <DataRow label="Default cost code" value={defaultCC ? `${defaultCC.code} · ${defaultCC.description}` : "—"} />
                    </div>
                  </Card>

                  <Card padding="md">
                    <Eyebrow tone="muted" className="mb-3">Activity</Eyebrow>
                    <div className="space-y-2">
                      <DataRow label="Total invoiced" value={<Money cents={totalInvoiced} size="md" variant="emphasized" />} />
                      <DataRow label="Recent invoices" value={`${recentInvoices.length} of ${CALDWELL_INVOICES.filter(i => i.vendor_id === selected.id).length}`} />
                    </div>
                  </Card>
                </div>

                {recentInvoices.length > 0 && (
                  <Card padding="md" className="mt-4">
                    <Eyebrow tone="muted" className="mb-2">Recent invoices</Eyebrow>
                    <ul className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                      {recentInvoices.map((inv) => (
                        <li key={inv.id} className="py-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[12px] truncate" style={{ color: "var(--text-primary)" }}>
                              {inv.description}
                            </div>
                            <div className="text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)" }}>
                              {inv.invoice_number ?? "—"} · {inv.received_date}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Money cents={inv.total_amount} size="sm" />
                            <Badge variant={inv.status === "paid" ? "success" : inv.status.includes("review") ? "warn" : "neutral"}>
                              {inv.status.replaceAll("_", " ").toUpperCase()}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </>
            ) : (
              <Eyebrow tone="muted">No vendor selected</Eyebrow>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
```

**Per stress test acceptance criterion:** "Long vendor names render without breaking layout on `nw-phone`." Implementation:
- List rail uses `truncate` Tailwind class on the name span — long names like "Bay Region Carpentry Inc" + "Coastal Smart Systems LLC" get clipped with ellipsis.
- Detail pane h2 has no truncate (full name shown) — verify it doesn't wrap awkwardly on 360px width.

**Step B — Create `src/app/design-system/prototypes/vendors/[id]/page.tsx`:**

Vendor detail using Document Review pattern (extends per D-008). Profile fields LEFT, activity panel RIGHT, lien-release status timeline BOTTOM.

```typescript
// src/app/design-system/prototypes/vendors/[id]/page.tsx
//
// Vendor detail prototype — Document Review pattern (PATTERNS §2)
// extends to vendor profile per CONTEXT D-008. Per Stage 1.5b deliverable #6.
//
// Hook T10c — no imports from @/lib/supabase|org|auth.

import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckBadgeIcon } from "@heroicons/react/24/outline";

import {
  CALDWELL_VENDORS,
  CALDWELL_INVOICES,
  CALDWELL_LIEN_RELEASES,
  CALDWELL_COST_CODES,
} from "@/app/design-system/_fixtures/drummond";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Money from "@/components/nw/Money";
import DataRow from "@/components/nw/DataRow";
import Badge from "@/components/nw/Badge";

export default function VendorDetailPage({ params }: { params: { id: string } }) {
  const vendor = CALDWELL_VENDORS.find((v) => v.id === params.id);
  if (!vendor) return notFound();

  const invoices = CALDWELL_INVOICES.filter((i) => i.vendor_id === vendor.id);
  const lienReleases = CALDWELL_LIEN_RELEASES.filter((l) => l.vendor_id === vendor.id);
  const totalInvoiced = invoices.reduce((sum, i) => sum + i.total_amount, 0);
  const defaultCC = vendor.default_cost_code_id ? CALDWELL_COST_CODES.find((c) => c.id === vendor.default_cost_code_id) : null;

  return (
    <div className="px-6 py-8 max-w-[1600px] mx-auto">
      {/* Header band */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] mb-2" style={{ color: "var(--text-tertiary)" }}>
            <Link href="/design-system/prototypes/" className="hover:underline">Prototypes</Link>
            <span>/</span>
            <Link href="/design-system/prototypes/vendors" className="hover:underline">Vendors</Link>
            <span>/</span>
            <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>{vendor.id}</span>
          </div>
          <h1 className="text-[24px] mb-1" style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 500, color: "var(--text-primary)" }}>
            {vendor.name}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{invoices.length} invoices · </span>
            <Money cents={totalInvoiced} size="md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 px-4 py-2 text-[12px] border"
            style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", background: "var(--bg-card)" }}
          >
            <CheckBadgeIcon className="w-4 h-4" strokeWidth={1.5} /> Mark verified
          </button>
        </div>
      </div>

      {/* Hero grid 50/50 — profile LEFT, activity RIGHT */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 mb-6"
        style={{ gap: "1px", background: "var(--border-default)" }}
      >
        {/* LEFT — profile */}
        <div className="p-5 space-y-4" style={{ background: "var(--bg-card)" }}>
          <Card padding="md">
            <Eyebrow tone="accent" className="mb-3">Profile</Eyebrow>
            <div className="space-y-2">
              <DataRow label="Address" value={vendor.address} />
              <DataRow label="Phone" value={vendor.phone} />
              <DataRow label="Email" value={vendor.email} />
              <DataRow label="Default cost code" value={defaultCC ? `${defaultCC.code} · ${defaultCC.description}` : "—"} />
            </div>
          </Card>

          <Card padding="md">
            <Eyebrow tone="muted" className="mb-3">Verification</Eyebrow>
            <div className="space-y-2">
              <DataRow label="W9 on file" value={<Badge variant="success">RECEIVED</Badge>} />
              <DataRow label="COI" value={<Badge variant="success">CURRENT (faked — F1 wires real)</Badge>} />
              <DataRow label="License #" value="—" />
            </div>
          </Card>
        </div>

        {/* RIGHT — activity */}
        <div className="p-5 space-y-4" style={{ background: "var(--bg-card)" }}>
          <Card padding="md">
            <Eyebrow tone="accent" className="mb-3">Recent invoices</Eyebrow>
            {invoices.length === 0 ? (
              <Eyebrow tone="muted">No invoices yet</Eyebrow>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                {invoices.slice(0, 8).map((inv) => (
                  <li key={inv.id} className="py-2 flex items-center justify-between gap-3 text-[12px]">
                    <div className="min-w-0">
                      <div className="truncate" style={{ color: "var(--text-primary)" }}>{inv.description}</div>
                      <div className="text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)" }}>
                        {inv.invoice_number ?? "—"} · {inv.received_date}
                      </div>
                    </div>
                    <Link href={`/design-system/prototypes/invoices/${inv.id}`} className="hover:underline flex items-center gap-2">
                      <Money cents={inv.total_amount} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {lienReleases.length > 0 && (
            <Card padding="md">
              <Eyebrow tone="muted" className="mb-3">Lien releases · {lienReleases.length}</Eyebrow>
              <ul className="space-y-2 text-[12px]">
                {lienReleases.map((lr) => (
                  <li key={lr.id} className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)" }}>
                        {lr.release_type.replaceAll("_", " ").toUpperCase()}
                      </div>
                      <div style={{ color: "var(--text-primary)" }}>{lr.release_date ?? "Pending"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Money cents={lr.amount_through} size="sm" />
                      <Badge variant={lr.status === "received" ? "success" : "warn"}>
                        {lr.status.toUpperCase()}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Per CONTEXT D-08:** Vendor detail extends Document Review pattern even though there's no "file preview" surface for a vendor — the LEFT/RIGHT split adapts to profile/activity, with the Card padding/border-left maintaining Site Office direction characteristics.
  </action>

  <verify>
    <automated>npm run build && grep -c "CALDWELL_VENDORS" src/app/design-system/prototypes/vendors/page.tsx src/app/design-system/prototypes/vendors/[id]/page.tsx</automated>
    Expected: build exits 0; grep returns >=2.

    Hex + T10c checks return 0 matches.

    Manual visual checks (Chrome MCP):
    - Visit `/design-system/prototypes/vendors`. List shows 17 vendors. Selected vendor (default first) shows profile on right.
    - Click each vendor in list — right pane updates (state-driven selection). Long names like "Coastal Smart Systems LLC" truncate cleanly in list rail (no overflow).
    - Click "Open detail" on selected vendor — navigates to `/design-system/prototypes/vendors/{id}`. Detail page renders profile + verification + recent invoices + lien releases.
    - Phone width (360px): list rail collapses to full width, detail pane stacks below. Long names don't break layout.
    - Click invoice in vendor detail "Recent invoices" — links to `/design-system/prototypes/invoices/{id}`.
  </verify>

  <done>
    - Vendors list renders all 17 with selectable rail
    - Long vendor names truncate cleanly on mobile
    - Vendor detail extends Document Review pattern
    - Cross-links work: vendors list → vendor detail → invoice detail
    - Lien release activity rendered for vendors with lien data
    - npm run build passes
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Prototype routes (`/design-system/prototypes/*`) → tenant code (`@/lib/supabase|org|auth`) | Hook T10c rejects imports; pure data exports always pass |
| Prototype routes → middleware platform_admin gate | Inherited from `/design-system/*` matcher in src/middleware.ts:98 |
| Sanitized fixture imports | Only `@/app/design-system/_fixtures/drummond` permitted (no playground fictional fixtures cross-imported per D-04) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-1.5b-W1-01 | I (Information disclosure) | Prototype reachable in production without platform_admin gating | mitigate (existing) | `src/middleware.ts:98` `pathname.startsWith("/design-system/")` covers `prototypes/*` via prefix match. Inherited gating verified at execute time by visiting non-platform-admin → expected redirect. |
| T-1.5b-W1-02 | E (Elevation of privilege) | Prototype accidentally imports tenant module → bypasses RLS | mitigate (existing) | Hook T10c `nightwork-post-edit.sh:194-230` rejects `@/lib/(supabase|org|auth)` imports in `src/app/design-system/*`. All four files verified clean post-write. |
| T-1.5b-W1-03 | T (Tampering) | Real-name leak via Wave 0 fixtures consumed in Wave 1 prototypes | accept | Wave 0 grep gates already enforced; Wave 1 only consumes via barrel imports. CI workflow continues to gate on every PR/push. No additional mitigation needed in this plan. |
| T-1.5b-W1-04 | I (Information disclosure) | Faked status_history client-side could create misleading audit trail if mistaken for real data | mitigate | Each prototype renders an explicit "Note: timeline reconstructed from terminal status. Real status_history JSONB lands in F1." disclaimer above the timeline. Acceptable in throwaway prototype context per CONTEXT cross-cutting checklist "Soft-delete + status_history APPLIES (display only)". |
</threat_model>

<verification>
- npm run build passes (no TypeScript errors)
- Hook T10c silent on all 4 new files (no @/lib/supabase|org|auth imports)
- No hardcoded hex anywhere in the 4 new files
- Visual checks confirm Site Office direction applied (UPPERCASE 0.18em eyebrows + slate-tile left-stamp + compact density)
- All 4+ Caldwell invoice statuses render distinctly with correct Badge color tone
- All 5 Drummond draws render Pay App G702 + G703 without errors
- All 17 Caldwell vendors render in list with long names truncating cleanly
- Cross-route links work (vendor detail → invoices)
</verification>

<success_criteria>
- Invoice prototype renders all 4+ CALDWELL_INVOICES at `/design-system/prototypes/invoices/{id}`
- Draw prototype renders all 5 CALDWELL_DRAWS at `/design-system/prototypes/draws/{id}`, with Pay App 5 (`d-caldwell-05`) as the canonical demo
- Vendors list renders 17 entries at `/design-system/prototypes/vendors` with state-driven selection
- Vendor detail renders any CALDWELL_VENDORS entry at `/design-system/prototypes/vendors/{id}`
- All routes pass build, T10c, and token discipline gates
- Long vendor names + 25+ G703 line items don't break layout on tablet width
</success_criteria>

<output>
After completion, create `.planning/phases/stage-1.5b-prototype-gallery/stage-1.5b-prototype-gallery-2-SUMMARY.md` covering:
- Which CALDWELL_INVOICES rendered (count + status diversity + format-type diversity)
- Which CALDWELL_DRAWS rendered (Pay App 5 G703 line item count, CO chain length)
- CALDWELL_VENDORS visual stress observations (long-name truncation behavior, mobile layout)
- Any findings for the 1.5b polish backlog (visual issues that don't block but feed Wave 1.1)
- Critical findings (if any) — does the design system fundamentally fail at any of these workflows?
- Hook T10c clean? Token discipline clean?
</output>
