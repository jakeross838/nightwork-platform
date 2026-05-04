// src/app/design-system/prototypes/mobile-approval/page.tsx
//
// Mobile invoice approval prototype — PM-in-field flow. Per Stage 1.5b
// deliverable #8.
//
// FULL-SCREEN page (NOT scaled-down container like patterns/). Tested at
// real iPhone viewport (375-414px). Real-phone test on Jake's actual
// phone gates ship per Q5=B + M3 LOCKED (CONTEXT D-31 — iPhone on Safari,
// per nwrp34 Part 4).
//
// Touch target spec per SYSTEM.md §11 + Q10=A:
//   - Standard tap (Hold): 44px minimum
//   - High-stakes (Approve, Reject): per SYSTEM.md §11a both should be
//     56px. The plan deliberately sets Reject = 44px to TEST the
//     hierarchy claim under glove-on operation (per the "glove-on test"
//     paragraph in 01.5-4-PLAN.md). Documented as a Wave 1.1 polish
//     finding in SUMMARY: "Reject at 44px contradicts SYSTEM.md §11a;
//     update SYSTEM or move Reject to 56px in production."
//
// Compact density legible at 360px width is the stress test (Caldwell
// invoices have long vendor names like "Coastal Smart Systems LLC").
//
// Hook T10c — no imports from @/lib/(supabase|org|auth).

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
  // Pick the first pm_review invoice as the demo (or first invoice if
  // none). Caldwell fixture has 2 pm_review invoices: inv-caldwell-006
  // (FPL temp electric, $58.13 — small) and inv-caldwell-007 (Bay Region
  // Carpentry T&M, $8,377 — larger / more line items). The first match
  // by `find` order will be inv-caldwell-006 since it appears earlier in
  // the fixture array. Both exercise the layout shape.
  const inv =
    CALDWELL_INVOICES.find((i) => i.status === "pm_review") ??
    CALDWELL_INVOICES[0];
  const vendor = inv
    ? CALDWELL_VENDORS.find((v) => v.id === inv.vendor_id)
    : null;
  const costCode = inv?.cost_code_id
    ? CALDWELL_COST_CODES.find((c) => c.id === inv.cost_code_id)
    : null;
  const [showLineItems, setShowLineItems] = useState(false);

  if (!inv) return null;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-page)" }}
    >
      {/* Sticky top app bar — 56px tall, slate-deeper background per
          Pattern4 mobile pattern analog. Wordmark dot left, eyebrow
          context label right. Inverse styling so it stands out on
          white-sand body content. */}
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
            style={{
              borderRadius: "var(--radius-dot)",
              background: "var(--nw-stone-blue)",
            }}
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

      {/* Body — invoice summary card, file preview, line items collapsible.
          Single-column layout, no horizontal scroll at 360px width. */}
      <div className="flex-1 px-4 py-4 space-y-4">
        <Card padding="md">
          <Eyebrow tone="accent" className="mb-2">
            From
          </Eyebrow>
          <h1
            className="text-[18px] mb-2 break-words"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 500,
              color: "var(--text-primary)",
            }}
          >
            {vendor?.name ?? "Unknown vendor"}
          </h1>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Money
              cents={inv.total_amount}
              size="xl"
              variant="emphasized"
            />
            {/* Status badge: pm_review = warning per existing convention.
                Plan code used variant="warn" (invalid Badge variant) —
                fixed to "warning" (the actual exposed variant per
                Badge.tsx). [Rule 1 - Bug] */}
            <Badge variant="warning">PM REVIEW</Badge>
          </div>
          <div className="space-y-2">
            <DataRow label="Invoice #" value={inv.invoice_number ?? "—"} />
            <DataRow label="Date" value={inv.invoice_date ?? "—"} />
            <DataRow
              label="Cost code"
              value={
                costCode ? `${costCode.code} · ${costCode.description}` : "—"
              }
            />
            <DataRow
              label="Type"
              value={inv.invoice_type.replaceAll("_", " ").toUpperCase()}
            />
            <DataRow
              label="Confidence"
              value={
                <Badge
                  variant={
                    inv.confidence_score >= 0.85 ? "success" : "warning"
                  }
                >
                  {(inv.confidence_score * 100).toFixed(0)}%
                </Badge>
              }
            />
          </div>
        </Card>

        {/* File preview placeholder — pinch-zoomable on real iPhone. The
            actual PDF render is a Wave 2 concern; this prototype shows
            the LAYOUT shape only. */}
        <Card padding="md">
          <Eyebrow tone="muted" className="mb-3">
            Source document
          </Eyebrow>
          <div
            className="aspect-[3/4] border flex flex-col items-center justify-center"
            style={{
              background: "var(--bg-subtle)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <PaperClipIcon
              className="w-8 h-8 mb-3"
              strokeWidth={1.25}
              style={{ color: "var(--text-tertiary)" }}
            />
            <span
              className="text-[10px] uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.18em",
                color: "var(--text-tertiary)",
              }}
            >
              Invoice PDF preview
            </span>
            <span
              className="text-[10px] mt-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              pinch to zoom on mobile
            </span>
          </div>
        </Card>

        {/* Line items — collapsible to save screen space. The
            collapse/expand button itself is 44px (standard nav, not
            high-stakes). */}
        {inv.line_items.length > 0 && (
          <Card padding="md">
            <button
              type="button"
              className="w-full flex items-center justify-between"
              onClick={() => setShowLineItems(!showLineItems)}
              style={{ minHeight: "44px" }}
              aria-expanded={showLineItems}
            >
              <Eyebrow tone="muted">
                Line items · {inv.line_items.length}
              </Eyebrow>
              {showLineItems ? (
                <ChevronUpIcon className="w-4 h-4" strokeWidth={1.5} />
              ) : (
                <ChevronDownIcon className="w-4 h-4" strokeWidth={1.5} />
              )}
            </button>
            {showLineItems && (
              <ul
                className="mt-3 divide-y"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                {inv.line_items.map((li, i) => (
                  <li
                    key={i}
                    className="py-2 flex items-start justify-between gap-3 text-[12px]"
                  >
                    <span
                      style={{ color: "var(--text-primary)" }}
                      className="flex-1 min-w-0"
                    >
                      {li.description}
                    </span>
                    <Money cents={li.amount} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      {/* Sticky bottom CTA group — Reject 44px / Hold 44px / Approve 56px.
          Per plan: tests the touch-target hierarchy claim under glove-on
          operation. Per SYSTEM.md §11a `reject` is high-stakes (56px)
          but the plan deliberately tests the differentiation. Finding
          surfaced in SUMMARY for Wave 1.1 polish backlog. */}
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
          className="flex items-center justify-center gap-1 text-[11px] uppercase font-medium"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            minHeight: "44px",
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.12em",
          }}
        >
          <XMarkIcon className="w-4 h-4" strokeWidth={1.5} />
          Reject
        </button>
        <button
          type="button"
          className="flex items-center justify-center gap-1 text-[11px] uppercase font-medium"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            minHeight: "44px",
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.12em",
          }}
        >
          <PauseIcon className="w-4 h-4" strokeWidth={1.5} />
          Hold
        </button>
        <button
          type="button"
          className="flex items-center justify-center gap-1.5 text-[12px] uppercase font-medium"
          style={{
            background: "var(--nw-stone-blue)",
            color: "var(--nw-white-sand)",
            minHeight: "56px",
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.12em",
          }}
        >
          <CheckBadgeIcon className="w-4 h-4" strokeWidth={1.5} />
          Approve
        </button>
      </div>
    </div>
  );
}
