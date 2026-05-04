---
phase: stage-1.5b-prototype-gallery
plan: 4
type: execute
wave: 1
depends_on: [1]
files_modified:
  - src/app/design-system/prototypes/owner-portal/page.tsx
  - src/app/design-system/prototypes/owner-portal/draws/[id]/page.tsx
  - src/app/design-system/prototypes/mobile-approval/page.tsx
autonomous: true
threat_model_severity: low
requirements: []
must_haves:
  truths:
    - "User can view homeowner dashboard at /design-system/prototypes/owner-portal/ with 4 simplified KPIs + draws-awaiting-approval list"
    - "Owner dashboard uses cost-plus open-book transparency language (NO builder jargon)"
    - "User can view owner-facing draw approval at /design-system/prototypes/owner-portal/draws/{id}"
    - "Owner draw approval shows G703 line items WITH vendor names visible (not just cost codes — homeowner-facing transparency)"
    - "Mobile approval prototype at /design-system/prototypes/mobile-approval renders inside iPhone-sized viewport (393x852 or smaller)"
    - "Mobile approval has 56px high-stakes touch target on Approve button (per Q10=A SYSTEM.md §11)"
    - "Mobile approval flow is testable on Jake's actual phone via Vercel preview URL (M3 ship-time gate)"
    - "Site Office direction inherited; Q5/R5 trust posture findings logged (does Site Office feel too archival for homeowner audience?)"
    - "All routes pass hook T10c"
  artifacts:
    - path: "src/app/design-system/prototypes/owner-portal/page.tsx"
      provides: "Homeowner-facing dashboard — Pattern3Dashboard simplified for non-builder audience"
      contains: "CALDWELL_DRAWS"
    - path: "src/app/design-system/prototypes/owner-portal/draws/[id]/page.tsx"
      provides: "Owner-facing draw approval — Document Review with vendor-name transparency"
      contains: "CALDWELL_DRAW_LINE_ITEMS"
    - path: "src/app/design-system/prototypes/mobile-approval/page.tsx"
      provides: "Mobile invoice approval — iPhone-sized viewport simulator with 56px high-stakes targets"
      contains: "CALDWELL_INVOICES"
  key_links:
    - from: "prototypes/owner-portal/page.tsx"
      to: "CALDWELL_DRAWS + CALDWELL_JOBS + CALDWELL_CHANGE_ORDERS"
      via: "named imports + on-render summarization"
      pattern: "CALDWELL_DRAWS"
    - from: "prototypes/owner-portal/draws/[id]/page.tsx"
      to: "CALDWELL_DRAW_LINE_ITEMS + CALDWELL_INVOICES + CALDWELL_VENDORS + CALDWELL_COST_CODES"
      via: "named imports + per-line-item vendor breakdown"
      pattern: "CALDWELL_VENDORS"
    - from: "prototypes/mobile-approval/page.tsx"
      to: "CALDWELL_INVOICES + CALDWELL_VENDORS + CALDWELL_COST_CODES"
      via: "named imports for the rendered invoice"
      pattern: "CALDWELL_INVOICES"
---

<objective>
Render two surfaces that test Site Office direction's reach beyond the builder's dashboard:
1. **Owner portal** — homeowner-facing dashboard + draw approval. Tests Site Office trust posture for non-builder audience (per Q8=B). Cost-plus open-book transparency: every line item visible, no builder jargon.
2. **Mobile approval flow** — PM-in-field invoice approval on iPhone-sized viewport. Tests 56px high-stakes targets, compact density at 360px, glove-on operation. Real-phone test on Jake's actual phone gates ship (M3 LOCKED per nwrp34 Part 4 — iPhone on Safari).

Purpose:
- Owner portal validates whether Site Office direction (UPPERCASE eyebrows + JetBrains Mono dominance) feels "too archival" for homeowner audience or hits the trust posture correctly.
- Mobile approval is the most concrete test of "PM in field with gloves on" — Q5=B real-phone test specifically required.

Output:
- Owner dashboard at `/design-system/prototypes/owner-portal/`
- Owner draw approval at `/design-system/prototypes/owner-portal/draws/{id}`
- Mobile approval at `/design-system/prototypes/mobile-approval/`
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
@src/components/nw/Card.tsx
@src/components/nw/Eyebrow.tsx
@src/components/nw/Money.tsx
@src/components/nw/DataRow.tsx
@src/components/nw/Badge.tsx

<interfaces>
<!-- Caldwell fixture imports — same set as PLAN-2/PLAN-3.

CaldwellInvoice / CaldwellDraw / CaldwellDrawLineItem / CaldwellVendor /
CaldwellJob / CaldwellCostCode / CaldwellChangeOrder shapes — see PLAN-2's
<interfaces> block for full field-by-field contracts. -->

<!-- SYSTEM.md §11 mobile touch targets (per Q10=A in 1.5a):
       - Standard tap: 44px minimum
       - High-stakes (Approve, Push to QB, Submit): 56px minimum
     The mobile-approval prototype's Approve button MUST be 56px (height + padding). -->

<!-- Pattern4MobileApproval analog (src/app/design-system/patterns/page.tsx:590-718):
       - Centered iPhone-frame container w/ aspectRatio: "393 / 852"
       - 260px width fixed (scaled-down preview); for actual viewport prototype,
         render full-screen at 393px (or device width) instead.
     The 1.5b mobile-approval prototype is a FULL-SCREEN page that's tested at
     real iPhone viewport — not the patterns/ scaled-down container. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Owner portal dashboard + owner-facing draw approval</name>
  <files>src/app/design-system/prototypes/owner-portal/page.tsx, src/app/design-system/prototypes/owner-portal/draws/[id]/page.tsx</files>

  <read_first>
    - src/app/design-system/patterns/page.tsx (lines 483-584 Pattern3Dashboard — KPI strip + attention-required pattern; simplify language for owner audience)
    - src/app/design-system/patterns/page.tsx (lines 259-407 Pattern1DocumentReview — gold standard for owner draw approval)
    - src/app/design-system/_fixtures/drummond/jobs.ts (single Drummond job — Caldwell Residence)
    - src/app/design-system/_fixtures/drummond/draws.ts (5 historical pay apps)
    - src/app/design-system/_fixtures/drummond/draw-line-items.ts (G703 line items for owner-facing render)
    - src/app/design-system/_fixtures/drummond/invoices.ts (filter by draw_id to show vendor-level breakdown per line)
    - src/app/design-system/_fixtures/drummond/vendors.ts (resolve vendor_id for owner-facing transparency)
    - src/app/design-system/_fixtures/drummond/cost-codes.ts (resolve cost_code_id for owner-friendly category labels)
    - src/app/design-system/_fixtures/drummond/change-orders.ts (CO summary on dashboard)
    - .planning/design/PATTERNS.md §2 + §3 (Document Review + Multi-step Approval extensions for owner draw approval)
    - CLAUDE.md "Cost-plus open-book transparency" rule + "owner sees every invoice"
    - src/components/nw/Card.tsx, Eyebrow.tsx, Money.tsx, DataRow.tsx, Badge.tsx
  </read_first>

  <action>
**Step A — Create `src/app/design-system/prototypes/owner-portal/page.tsx`:**

Simplified Pattern3Dashboard for homeowner. NO builder jargon — translate "G702 contract sum to date" → "Total project budget", "current_payment_due" → "Amount due this month".

```typescript
// src/app/design-system/prototypes/owner-portal/page.tsx
//
// Homeowner-facing dashboard — simplified Pattern3Dashboard for non-builder
// audience. Per Stage 1.5b deliverable #9 + Q8=B (dashboard + draw approval
// only; Wave 3 photos/messages/lien-viewer deferred).
//
// Cost-plus open-book transparency per CLAUDE.md: every dollar visible.
// NO builder jargon — translate G702 terminology to homeowner-readable
// language (e.g., "current_payment_due" → "Amount due this month").
//
// Trust posture test (per CONTEXT R5): if Site Office direction feels too
// archival/utility for homeowner audience, surface as "lighter variant"
// finding. Do not redesign in 1.5b.
//
// Hook T10c — no imports from @/lib/supabase|org|auth.

import Link from "next/link";
import {
  CheckBadgeIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

import {
  CALDWELL_DRAWS,
  CALDWELL_JOBS,
  CALDWELL_CHANGE_ORDERS,
} from "@/app/design-system/_fixtures/drummond";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Money from "@/components/nw/Money";
import Badge from "@/components/nw/Badge";

export default function OwnerPortalDashboard() {
  const job = CALDWELL_JOBS[0]; // single-job fixture
  if (!job) return null;

  // Compute KPIs from source-of-truth fixture rows (R.2 honored).
  const draws = CALDWELL_DRAWS.filter((d) => d.job_id === job.id);
  const latestDraw = draws[draws.length - 1];
  const paidToDate = draws
    .filter((d) => d.status === "paid")
    .reduce((sum, d) => sum + d.current_payment_due, 0);
  const balanceToFinish = job.current_contract_amount - paidToDate;
  const drawsAwaitingApproval = draws.filter((d) => d.status === "submitted" || d.status === "pm_review");
  const approvedCOs = CALDWELL_CHANGE_ORDERS.filter((co) => co.job_id === job.id && (co.status === "approved" || co.status === "executed"));

  // Next draw date estimate — last draw application_date + 30 days.
  const nextDrawDate = latestDraw
    ? (() => {
        const d = new Date(latestDraw.application_date);
        d.setDate(d.getDate() + 30);
        return d.toISOString().slice(0, 10);
      })()
    : null;

  return (
    <div className="px-6 py-8 max-w-[1200px] mx-auto">
      {/* Header band — homeowner-friendly */}
      <div className="mb-6">
        <Eyebrow tone="muted" className="mb-2">Owner portal · Caldwell Residence</Eyebrow>
        <h1 className="text-[28px] mb-2" style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 500, color: "var(--text-primary)" }}>
          Welcome, {job.client_name}
        </h1>
        <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
          {job.address} · cost-plus open-book contract · every invoice and dollar is visible to you.
        </p>
      </div>

      {/* KPI strip — homeowner-translated */}
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
          { label: "Total project budget", value: <Money cents={job.current_contract_amount} size="md" />, sub: `original ${(job.original_contract_amount / 100).toLocaleString(undefined, {maximumFractionDigits:0})} + ${approvedCOs.length} change orders` },
          { label: "Paid to date", value: <Money cents={paidToDate} size="md" />, sub: `${draws.filter(d => d.status === "paid").length} draws paid` },
          { label: "Remaining", value: <Money cents={balanceToFinish} size="md" />, sub: `${(balanceToFinish / job.current_contract_amount * 100).toFixed(0)}% of budget` },
          { label: "Next draw expected", value: <span style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 600, fontSize: "20px" }}>{nextDrawDate ?? "—"}</span>, sub: `Pay App #${(latestDraw?.draw_number ?? 0) + 1}` },
        ].map((k) => (
          <div key={k.label} className="p-4" style={{ background: "var(--bg-card)" }}>
            <Eyebrow tone="muted" className="mb-2">{k.label}</Eyebrow>
            <div className="text-[24px] mb-1" style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 600 }}>
              {k.value}
            </div>
            <div className="text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-accent)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Awaiting your approval */}
      {drawsAwaitingApproval.length > 0 && (
        <Card padding="md" className="mb-6">
          <Eyebrow tone="warn" className="mb-3" icon={<CheckBadgeIcon className="w-3.5 h-3.5" strokeWidth={1.5} />}>
            Awaiting your approval · {drawsAwaitingApproval.length}
          </Eyebrow>
          <ul className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
            {drawsAwaitingApproval.map((d) => (
              <li key={d.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-[14px]" style={{ color: "var(--text-primary)", fontFamily: "var(--font-space-grotesk)", fontWeight: 500 }}>
                    Pay App #{d.draw_number} — {d.period_start} to {d.period_end}
                  </div>
                  <div className="text-[11px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)" }}>
                    Submitted {d.submitted_at?.slice(0, 10) ?? "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Money cents={d.current_payment_due} size="md" variant="emphasized" />
                  <Link
                    href={`/design-system/prototypes/owner-portal/draws/${d.id}`}
                    className="inline-flex items-center gap-1 px-4 py-2 text-[12px]"
                    style={{ background: "var(--nw-stone-blue)", color: "var(--nw-white-sand)" }}
                  >
                    Review →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Recent activity (paid draws) */}
      <Card padding="md">
        <Eyebrow tone="muted" className="mb-3" icon={<CalendarDaysIcon className="w-3.5 h-3.5" strokeWidth={1.5} />}>
          Recent activity
        </Eyebrow>
        <ul className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
          {draws.slice(-4).reverse().map((d) => (
            <li key={d.id} className="py-2 flex items-center justify-between">
              <div>
                <div className="text-[13px]" style={{ color: "var(--text-primary)" }}>
                  Pay App #{d.draw_number} — {d.application_date}
                </div>
                <div className="text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)" }}>
                  {d.paid_at ? `Paid ${d.paid_at.slice(0, 10)}` : "—"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Money cents={d.current_payment_due} size="sm" />
                <Badge variant={d.status === "paid" ? "success" : "info"}>{d.status.toUpperCase()}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
```

**Step B — Create `src/app/design-system/prototypes/owner-portal/draws/[id]/page.tsx`:**

Owner-facing draw approval. Same Document Review pattern as builder-facing PLAN-2 draw approval, BUT:
- Header copy translated for homeowner (no G702/G703 labels; show plain language)
- G703 line items show VENDOR NAMES alongside cost codes (per CONTEXT 5 "Cost-plus open-book transparency: owner sees every line item")
- Action buttons: "Approve & sign" + "Request clarification" (not "Send back to draft")
- NO Print button (owners don't print AIA forms)

```typescript
// src/app/design-system/prototypes/owner-portal/draws/[id]/page.tsx
//
// Owner-facing draw approval — Document Review pattern (PATTERNS §2)
// extending Multi-step Approval (PATTERNS §3) for non-builder homeowner
// audience. Per Stage 1.5b deliverable #9 + Q8=B.
//
// Cost-plus open-book transparency: owner sees every line item AND every
// vendor. Builder version (PLAN-2 prototypes/draws/[id]/page.tsx) shows
// cost codes only. This version shows vendor names + amount per vendor
// per line for full transparency.
//
// Trust posture test (R5): if Site Office direction (UPPERCASE eyebrows
// + JetBrains Mono) feels too archival for homeowner audience, surface
// as a "lighter variant" finding. Do not redesign in 1.5b.
//
// Hook T10c — no imports from @/lib/supabase|org|auth.

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  CheckBadgeIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";

import {
  CALDWELL_DRAWS,
  CALDWELL_DRAW_LINE_ITEMS,
  CALDWELL_INVOICES,
  CALDWELL_VENDORS,
  CALDWELL_COST_CODES,
  CALDWELL_JOBS,
} from "@/app/design-system/_fixtures/drummond";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Money from "@/components/nw/Money";
import DataRow from "@/components/nw/DataRow";
import Badge from "@/components/nw/Badge";

export default function OwnerDrawApprovalPage({ params }: { params: { id: string } }) {
  const draw = CALDWELL_DRAWS.find((d) => d.id === params.id);
  if (!draw) return notFound();

  const job = CALDWELL_JOBS.find((j) => j.id === draw.job_id);
  const lineItems = CALDWELL_DRAW_LINE_ITEMS.filter((li) => li.draw_id === draw.id);

  // Per cost code, find vendor breakdown — for owner transparency.
  function vendorsForLine(costCodeId: string) {
    const invoicesForLine = CALDWELL_INVOICES.filter((i) => i.cost_code_id === costCodeId && i.draw_id === draw.id);
    const byVendor = new Map<string, number>();
    for (const inv of invoicesForLine) {
      byVendor.set(inv.vendor_id, (byVendor.get(inv.vendor_id) ?? 0) + inv.total_amount);
    }
    return Array.from(byVendor.entries()).map(([vid, cents]) => ({
      vendor: CALDWELL_VENDORS.find((v) => v.id === vid),
      cents,
    }));
  }

  return (
    <div className="px-6 py-8 max-w-[1200px] mx-auto">
      {/* Header band — homeowner-friendly */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] mb-2" style={{ color: "var(--text-tertiary)" }}>
            <Link href="/design-system/prototypes/owner-portal/" className="hover:underline">Owner portal</Link>
            <span>/</span>
            <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Pay App #{draw.draw_number}</span>
          </div>
          <h1 className="text-[28px] mb-1" style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 500, color: "var(--text-primary)" }}>
            Pay App #{draw.draw_number} for your review
          </h1>
          <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
            Work completed {draw.period_start} – {draw.period_end} · submitted by your builder for approval
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 px-4 py-3 text-[13px] border"
            style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", background: "var(--bg-card)", minHeight: "44px" }}
          >
            <ChatBubbleLeftRightIcon className="w-4 h-4" strokeWidth={1.5} /> Request clarification
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-4 py-3 text-[13px]"
            style={{ background: "var(--nw-stone-blue)", color: "var(--nw-white-sand)", minHeight: "44px" }}
          >
            <CheckBadgeIcon className="w-4 h-4" strokeWidth={1.5} /> Approve & sign
          </button>
        </div>
      </div>

      {/* Summary card — homeowner-translated */}
      <Card padding="md" className="mb-6">
        <Eyebrow tone="accent" className="mb-3">This pay app summary</Eyebrow>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <DataRow label="Total project budget" value={<Money cents={draw.contract_sum_to_date} size="md" />} />
          <DataRow label="Paid before this pay app" value={<Money cents={draw.less_previous_payments} size="md" />} />
          <DataRow label="Work completed this period" value={<Money cents={draw.current_payment_due} size="md" variant="emphasized" />} />
          <DataRow label="Remaining after this pay app" value={<Money cents={draw.balance_to_finish} size="md" />} />
        </div>
      </Card>

      {/* Detailed line items WITH vendor breakdown */}
      <Card padding="md">
        <Eyebrow tone="muted" className="mb-3">Where the money went · {lineItems.length} categories</Eyebrow>
        <p className="text-[12px] mb-3" style={{ color: "var(--text-secondary)" }}>
          Cost-plus open-book contract — every vendor invoice is visible. Click a category to see the underlying invoices.
        </p>
        <ul className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
          {lineItems.map((li) => {
            const cc = CALDWELL_COST_CODES.find((c) => c.id === li.cost_code_id);
            const vendors = vendorsForLine(li.cost_code_id);
            if (li.this_period === 0) return null;
            return (
              <li key={li.id} className="py-3">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <div className="text-[14px]" style={{ color: "var(--text-primary)", fontFamily: "var(--font-space-grotesk)", fontWeight: 500 }}>
                      {cc?.description ?? "—"}
                    </div>
                    <div className="text-[10px]" style={{ fontFamily: "var(--font-jetbrains-mono)", color: "var(--text-tertiary)" }}>
                      {cc?.code ?? "—"} · {(li.percent_complete * 100).toFixed(0)}% complete
                    </div>
                  </div>
                  <Money cents={li.this_period} size="md" variant="emphasized" />
                </div>
                {vendors.length > 0 && (
                  <ul className="ml-4 mt-2 space-y-1 text-[11px]">
                    {vendors.map((v, i) => (
                      <li key={i} className="flex items-center justify-between" style={{ color: "var(--text-secondary)" }}>
                        <span>{v.vendor?.name ?? "—"}</span>
                        <Money cents={v.cents} size="sm" />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
```

**Per CONTEXT 5 cross-cutting "Cost-plus open-book transparency YES":** owner sees every vendor name. The builder version of draw approval shows cost codes only; this owner version shows vendors INSIDE each cost code. Tests trust posture.

**Trust posture test (per CONTEXT R5 + Q9=B halt criterion):** if Jake reviews this and feels Site Office direction is "too archival/utility" for homeowner — that's a finding, NOT a halt. Goes to Wave 1.1 polish backlog as "lighter variant for owner-facing surfaces" recommendation.
  </action>

  <verify>
    <automated>npm run build && grep -c "CALDWELL_DRAWS\|CALDWELL_DRAW_LINE_ITEMS\|CALDWELL_VENDORS" src/app/design-system/prototypes/owner-portal/page.tsx src/app/design-system/prototypes/owner-portal/draws/[id]/page.tsx</automated>
    Expected: build exits 0; grep returns >=2.

    Hex check: `grep -nE '#[0-9a-fA-F]{3,6}' src/app/design-system/prototypes/owner-portal/page.tsx src/app/design-system/prototypes/owner-portal/draws/[id]/page.tsx` returns 0 matches.

    T10c check: `grep -E '@/lib/(supabase|org|auth)' src/app/design-system/prototypes/owner-portal/page.tsx src/app/design-system/prototypes/owner-portal/draws/[id]/page.tsx` returns 0 matches.

    Manual visual checks (Chrome MCP):
    - Visit `/design-system/prototypes/owner-portal/`. Dashboard renders. Header reads "Welcome, {client_name}" — homeowner-friendly.
    - Verify NO builder jargon: search the rendered HTML for "G702", "G703", "PCCO", "current_payment_due" — should find 0 occurrences.
    - KPI strip shows 4 homeowner-translated values (Total project budget, Paid to date, Remaining, Next draw expected).
    - Awaiting-approval section appears if any draw has status="submitted" or "pm_review" (depending on fixture data).
    - Click "Review →" on a draw — navigates to `/design-system/prototypes/owner-portal/draws/{id}`.
    - Owner draw approval renders. Header reads "Pay App #N for your review" — friendly. Action buttons "Request clarification" + "Approve & sign" (NOT "Send back to draft" + Print).
    - "Where the money went" section shows vendor breakdown beneath each cost code description. Verify vendor names visible (e.g., "Bay Region Carpentry Inc" $X,XXX) — owner can see exactly who got paid.
    - Eyebrows still UPPERCASE 0.18em (Site Office direction inherited via prototypes/layout.tsx).
  </verify>

  <done>
    - Owner dashboard renders with 4 homeowner-translated KPIs + awaiting-approval list + recent-activity list
    - NO builder jargon (G702/G703/PCCO/current_payment_due not in rendered HTML)
    - Owner draw approval extends Document Review pattern WITH per-line vendor breakdown
    - Action buttons reflect owner role (Approve & sign / Request clarification — not builder-side actions)
    - Site Office direction inherited correctly
    - npm run build passes
  </done>
</task>

<task type="auto">
  <name>Task 2: Mobile approval flow prototype</name>
  <files>src/app/design-system/prototypes/mobile-approval/page.tsx</files>

  <read_first>
    - src/app/design-system/patterns/page.tsx (lines 590-718 Pattern4MobileApproval — note this is a SCALED-DOWN preview at 260px width; the prototype is FULL-SCREEN at real iPhone viewport instead)
    - src/app/design-system/_fixtures/drummond/invoices.ts (pick a single Caldwell invoice in pm_review status as the demo)
    - src/app/design-system/_fixtures/drummond/vendors.ts (resolve vendor for the demo invoice)
    - src/app/design-system/_fixtures/drummond/cost-codes.ts (resolve cost code)
    - .planning/design/SYSTEM.md §11 (mobile touch targets — 44px standard, 56px high-stakes per Q10=A)
    - .planning/design/PATTERNS.md §5 (Mobile Touch Approval — pinch zoom, sticky CTA)
    - CLAUDE.md "Mobile with one hand while holding phone in truck" + 56px high-stakes target rule
    - src/components/nw/Card.tsx, Eyebrow.tsx, Money.tsx, DataRow.tsx, Badge.tsx
  </read_first>

  <action>
**Create `src/app/design-system/prototypes/mobile-approval/page.tsx`:**

Unlike the patterns/ playground entry which uses a 260px scaled-down iPhone-frame container for visual demo, this prototype is FULL-SCREEN — it renders at the actual viewport width. Tested at real iPhone width (393px), it occupies the full screen for one-hand operation simulation.

```typescript
// src/app/design-system/prototypes/mobile-approval/page.tsx
//
// Mobile invoice approval prototype — PM-in-field flow. Per Stage 1.5b
// deliverable #8.
//
// FULL-SCREEN page (NOT scaled-down container like patterns/). Tested at
// real iPhone viewport (393px). Real-phone test on Jake's actual phone
// gates ship per Q5=B + M3 LOCKED (CONTEXT D-31 — iPhone on Safari, per nwrp34 Part 4 — phone device info
// be substituted before /nx execute completes).
//
// Touch target spec per SYSTEM.md §11 + Q10=A:
//   - Standard tap (Reject, Hold): 44px minimum
//   - High-stakes (Approve & Push to QB): 56px minimum
//
// Site Office compact density at 360px width is the stress test.
//
// Hook T10c — no imports from @/lib/supabase|org|auth.

"use client";

import { useState } from "react";
import {
  CheckBadgeIcon,
  XMarkIcon,
  PauseIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PaperClipIcon,
} from "@heroicons/react/24/outline";

import {
  CALDWELL_INVOICES,
  CALDWELL_VENDORS,
  CALDWELL_COST_CODES,
} from "@/app/design-system/_fixtures/drummond";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Money from "@/components/nw/Money";
import DataRow from "@/components/nw/DataRow";
import Badge from "@/components/nw/Badge";

export default function MobileApprovalPage() {
  // Pick the first pm_review invoice as the demo (or first invoice if none).
  const inv = CALDWELL_INVOICES.find((i) => i.status === "pm_review") ?? CALDWELL_INVOICES[0];
  const vendor = inv ? CALDWELL_VENDORS.find((v) => v.id === inv.vendor_id) : null;
  const costCode = inv?.cost_code_id ? CALDWELL_COST_CODES.find((c) => c.id === inv.cost_code_id) : null;
  const [showLineItems, setShowLineItems] = useState(false);

  if (!inv) return null;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-page)" }}
    >
      {/* Sticky top app bar — 56px tall, slate-deeper background per Pattern4 analog */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4 border-b"
        style={{
          height: "56px",
          background: "var(--nw-slate-deeper)",
          borderColor: "var(--border-default)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2"
            style={{ borderRadius: "var(--radius-dot)", background: "var(--nw-stone-blue)" }}
          />
          <span
            className="text-[12px] font-medium"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              color: "var(--nw-white-sand)",
            }}
          >
            Nightwork
          </span>
        </div>
        <span
          className="text-[10px]"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            color: "rgba(247,245,236,0.7)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Approve invoice
        </span>
      </div>

      {/* Body — invoice summary card, file preview, line items collapsible */}
      <div className="flex-1 px-4 py-4 space-y-4">
        <Card padding="md">
          <Eyebrow tone="accent" className="mb-2">From</Eyebrow>
          <h1
            className="text-[18px] mb-2"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 500,
              color: "var(--text-primary)",
            }}
          >
            {vendor?.name ?? "Unknown vendor"}
          </h1>
          <div className="flex items-center gap-2 mb-3">
            <Money cents={inv.total_amount} size="lg" variant="emphasized" />
            <Badge variant="warn">PM REVIEW</Badge>
          </div>
          <div className="space-y-2">
            <DataRow label="Invoice #" value={inv.invoice_number ?? "—"} />
            <DataRow label="Date" value={inv.invoice_date ?? "—"} />
            <DataRow label="Cost code" value={costCode ? `${costCode.code}` : "—"} />
            <DataRow label="Type" value={inv.invoice_type.replaceAll("_", " ").toUpperCase()} />
            <DataRow label="Confidence" value={<Badge variant={inv.confidence_score >= 0.85 ? "success" : "warn"}>{(inv.confidence_score * 100).toFixed(0)}%</Badge>} />
          </div>
        </Card>

        {/* File preview — pinch-zoomable on real iPhone */}
        <Card padding="md">
          <Eyebrow tone="muted" className="mb-3">Source document</Eyebrow>
          <div
            className="aspect-[3/4] border flex flex-col items-center justify-center"
            style={{ background: "var(--bg-subtle)", borderColor: "var(--border-subtle)" }}
          >
            <PaperClipIcon className="w-8 h-8 mb-3" strokeWidth={1.25} style={{ color: "var(--text-tertiary)" }} />
            <span
              className="text-[10px] uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.18em",
                color: "var(--text-tertiary)",
              }}
            >
              Invoice PDF preview · pinch to zoom
            </span>
          </div>
        </Card>

        {/* Line items — collapsible to save screen space */}
        {inv.line_items.length > 0 && (
          <Card padding="md">
            <button
              type="button"
              className="w-full flex items-center justify-between"
              onClick={() => setShowLineItems(!showLineItems)}
              style={{ minHeight: "44px" }}
              aria-expanded={showLineItems}
            >
              <Eyebrow tone="muted">Line items · {inv.line_items.length}</Eyebrow>
              {showLineItems ? <ChevronUpIcon className="w-4 h-4" strokeWidth={1.5} /> : <ChevronDownIcon className="w-4 h-4" strokeWidth={1.5} />}
            </button>
            {showLineItems && (
              <ul className="mt-3 divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                {inv.line_items.map((li, i) => (
                  <li key={i} className="py-2 flex items-start justify-between gap-3 text-[12px]">
                    <span style={{ color: "var(--text-primary)" }}>{li.description}</span>
                    <Money cents={li.amount} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      {/* Sticky bottom CTA group — 56px high-stakes target on Approve, 44px on Reject/Hold */}
      <div
        className="sticky bottom-0 grid grid-cols-3 border-t"
        style={{
          gap: "1px",
          background: "var(--border-default)",
          borderColor: "var(--border-default)",
        }}
      >
        <button
          type="button"
          className="flex items-center justify-center gap-1 text-[11px]"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            minHeight: "44px",
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          <XMarkIcon className="w-4 h-4" strokeWidth={1.5} /> Reject
        </button>
        <button
          type="button"
          className="flex items-center justify-center gap-1 text-[11px]"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            minHeight: "44px",
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          <PauseIcon className="w-4 h-4" strokeWidth={1.5} /> Hold
        </button>
        <button
          type="button"
          className="flex items-center justify-center gap-1 text-[11px] font-medium"
          style={{
            background: "var(--nw-stone-blue)",
            color: "var(--nw-white-sand)",
            minHeight: "56px",
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          <CheckBadgeIcon className="w-4 h-4" strokeWidth={1.5} /> Approve
        </button>
      </div>
    </div>
  );
}
```

**Per CONTEXT D-25 + D-31 + Q5=B:** real-phone test on Jake's actual phone is REQUIRED before ship. The phone make/model/browser is now LOCKED per nwrp34 Part 4: **iPhone on Safari** (current iPhone Jake has on hand; whatever current Safari version ships with iOS at walkthrough time). EXPANDED-SCOPE.md §0 + MANUAL-CHECKLIST.md M3 + SETUP-COMPLETE.md substituted. This task builds the prototype that the M3 walkthrough tests against.

**Per acceptance criterion (per Q5=B + Jake's expanded acceptance):** "Jake walks every prototype on his actual phone before ship verdict. PM-in-field flow specifically tested with one-hand operation, gloves-on simulation, outdoor lighting. If any flow fails real-phone test, halt before ship." This prototype is the canonical surface for that test.

**Glove-on test:** the 56px Approve target is the largest hit-area; Reject + Hold are 44px. If glove-on operation fails on 56px, the design system's high-stakes target spec is wrong — escalate as a CRITICAL finding (Q9=B halt criterion).
  </action>

  <verify>
    <automated>npm run build && grep -c 'minHeight: "56px"' src/app/design-system/prototypes/mobile-approval/page.tsx</automated>
    Expected: build exits 0; grep returns >=1 (the Approve high-stakes target).

    Hex + T10c checks return 0 matches.

    Manual visual checks (Chrome MCP):
    - Visit `/design-system/prototypes/mobile-approval/` at desktop width — page is intentionally narrow (designed for mobile).
    - Use Chrome DevTools device toolbar — set viewport to iPhone 14 Pro (393x852). Page fills viewport.
    - Top app bar is 56px tall, slate-deeper background, "Nightwork" wordmark + dot left, "Approve invoice" eyebrow right.
    - Body shows invoice card with vendor + amount + status + key fields. Confidence badge color matches routing.
    - File preview placeholder shows pinch-zoom hint.
    - Line items toggle expands/collapses.
    - Bottom CTA: Reject / Hold each 44px tall, Approve 56px tall, all stretch full row.
    - Tap targets: measure each button's clickable area in DevTools — Reject 44px+, Hold 44px+, Approve 56px+.
    - Set viewport to 360px width (smallest phone) — layout still legible without horizontal scroll.

    **M3 ship-time gate (deferred — not blocking THIS verify):** Jake walks the prototype on his actual phone via Vercel preview URL once committed. Glove-on simulation: tap Approve with index finger only (no precision). Outdoor lighting: read screen in daylight. Document failures (if any) as critical findings.
  </verify>

  <done>
    - Mobile approval prototype renders at full viewport (not scaled-down container)
    - Sticky top app bar (56px) + sticky bottom CTA group (44/44/56) for thumb-accessible approval
    - Approve button minHeight: "56px" (high-stakes per SYSTEM.md §11 / Q10=A)
    - Reject + Hold buttons minHeight: "44px" (standard tap)
    - Compact density legible at 360px width (no horizontal scroll on smallest phone)
    - Line items collapsible to save screen space
    - File preview placeholder labeled "pinch to zoom"
    - npm run build passes
    - M3 phone gate placeholder noted (real-phone test gates SHIP, not this verify)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Prototype routes (`/design-system/prototypes/*`) → tenant code | Hook T10c rejects imports |
| Prototype routes → middleware platform_admin gate | Inherited from `/design-system/*` matcher |
| Owner portal trust posture | Site Office direction inherited; trust-posture finding logged not redesigned |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-1.5b-W1-08 | I (Information disclosure) | Owner portal renders sanitized fixtures only — no real client data leaks | mitigate (existing) | Wave 0 grep gates (extractor + CI) prevent real-data leaks. Owner portal imports CALDWELL_* fixtures only. |
| T-1.5b-W1-09 | E (Elevation of privilege) | Mobile approval renders without auth check at the prototype layer | accept | Hook T10c forbids tenant module imports → no live data ever reaches the prototype. Middleware gates `/design-system/*` to platform_admin in production. The mobile prototype is a static render, not a real approval pathway — clicking Approve has no effect (no `onClick` wired to real API). |
| T-1.5b-W1-10 | T (Tampering) | Owner draw approval shows vendor breakdown derived from current invoice fixtures — could mislead if fixtures don't match draw period | accept | Wave 0 fixture extraction scripted; vendor breakdown in PLAN-4 Task 1 filters by `cost_code_id === bl.cost_code_id && draw_id === draw.id`. Provided Wave 0 generates consistent draw_id assignments (per fixture extraction acceptance), this is safe. |
</threat_model>

<verification>
- npm run build passes
- Hook T10c silent on all 3 new files
- No hardcoded hex
- Owner dashboard contains NO builder jargon (G702/G703/PCCO/current_payment_due not in rendered output)
- Owner draw approval shows vendor names within line item breakdown (cost-plus open-book transparency)
- Mobile approval Approve button = 56px minHeight (high-stakes per Q10=A)
- Mobile approval Reject + Hold buttons = 44px minHeight (standard)
- M3 phone gate placeholder noted in must_haves (real-phone test gates SHIP, not this verify)
</verification>

<success_criteria>
- Owner portal dashboard renders simplified for non-builder audience
- Owner draw approval shows per-vendor-per-line transparency breakdown
- Mobile approval prototype usable on iPhone-sized viewport with correct touch target hierarchy
- All routes pass build, T10c, and token discipline gates
- Trust posture findings (if Site Office feels too archival) and real-phone findings (if 56px fails glove-on) logged for Wave 1.1 polish backlog
</success_criteria>

<output>
After completion, create `.planning/phases/stage-1.5b-prototype-gallery/stage-1.5b-prototype-gallery-4-SUMMARY.md` covering:
- Whether owner portal jargon-free language was achievable (any G702/G703/PCCO leaks?)
- Whether vendor-name transparency in owner draw approval rendered without breaking layout
- Mobile approval observations: 56px target sufficient? compact density legible at 360px?
- Trust posture finding: does Site Office feel too archival for homeowner audience?
- M3 phone gate status: still PENDING or substituted by execute time?
- Critical findings (if any)
</output>
