// src/app/design-system/prototypes/invoices/[id]/page.tsx
//
// Invoice approval prototype — Document Review pattern (PATTERNS §2)
// rendering real-shape Caldwell invoice data. Per Stage 1.5b deliverable #2.
//
// Hero grid 50/50: file preview LEFT, right-rail panels RIGHT, audit
// timeline below. Validates the gold-standard layout under real-data
// stress (4 invoice statuses x 3 format types per CLAUDE.md routing).
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

// Map invoice status -> Badge variant. Mirrors confidence routing colors per CLAUDE.md.
// Note: Badge.tsx uses "warning" (not "warn") for the yellow tone.
const STATUS_BADGE: Record<
  CaldwellInvoiceStatus,
  {
    variant: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
    label: string;
  }
> = {
  received: { variant: "neutral", label: "RECEIVED" },
  ai_processed: { variant: "warning", label: "AI PROCESSED" }, // yellow flag (70-84%)
  pm_review: { variant: "warning", label: "PM REVIEW" },
  pm_approved: { variant: "success", label: "PM APPROVED" },
  pm_held: { variant: "warning", label: "PM HELD" },
  pm_denied: { variant: "danger", label: "PM DENIED" },
  qa_review: { variant: "info", label: "QA REVIEW" },
  qa_approved: { variant: "success", label: "QA APPROVED" },
  qa_kicked_back: { variant: "danger", label: "QA KICKED BACK" },
  pushed_to_qb: { variant: "success", label: "PUSHED TO QB" },
  in_draw: { variant: "info", label: "IN DRAW" },
  paid: { variant: "success", label: "PAID" },
};

// Confidence color encoding per CLAUDE.md routing thresholds.
function confidenceTone(score: number): "success" | "warning" | "danger" {
  if (score >= 0.85) return "success";
  if (score >= 0.7) return "warning";
  return "danger";
}

// Build a faked status timeline from the invoice's terminal status.
// CaldwellInvoice doesn't carry status_history JSONB (per F1 gap). The
// timeline below shows the workflow path that would have been taken to
// reach the current status — labeled as faked client-side.
function buildTimeline(inv: (typeof CALDWELL_INVOICES)[number]) {
  const steps: Array<{ when: string; what: string; done: boolean }> = [];
  const r = inv.received_date;
  steps.push({ when: `${r} · 10:04`, what: "RECEIVED via email-in", done: true });
  if (
    [
      "ai_processed",
      "pm_review",
      "pm_approved",
      "qa_review",
      "qa_approved",
      "pushed_to_qb",
      "in_draw",
      "paid",
    ].includes(inv.status)
  ) {
    steps.push({
      when: `${r} · 10:06`,
      what: `AI PARSED · ${(inv.confidence_score * 100).toFixed(0)}% confidence`,
      done: true,
    });
  }
  if (
    [
      "pm_review",
      "pm_approved",
      "qa_review",
      "qa_approved",
      "pushed_to_qb",
      "in_draw",
      "paid",
    ].includes(inv.status)
  ) {
    steps.push({ when: `${r} · 11:18`, what: "PM ASSIGNED · Brent Mullins", done: true });
  }
  if (
    [
      "pm_approved",
      "qa_review",
      "qa_approved",
      "pushed_to_qb",
      "in_draw",
      "paid",
    ].includes(inv.status)
  ) {
    steps.push({ when: `${r} · 14:22`, what: "PM APPROVED", done: true });
  }
  if (
    ["qa_review", "qa_approved", "pushed_to_qb", "in_draw", "paid"].includes(inv.status)
  ) {
    steps.push({ when: `${r} · 16:00`, what: "QA REVIEW · Diane", done: true });
  }
  if (["qa_approved", "pushed_to_qb", "in_draw", "paid"].includes(inv.status)) {
    steps.push({ when: `${r} · 17:30`, what: "QA APPROVED", done: true });
  }
  if (["pushed_to_qb", "in_draw", "paid"].includes(inv.status)) {
    steps.push({ when: `${r} · 17:35`, what: "PUSHED TO QB", done: true });
  }
  if (inv.status === "in_draw" && inv.draw_id) {
    steps.push({
      when: `${r} · 18:00`,
      what: `IN DRAW · ${inv.draw_id}`,
      done: true,
    });
  }
  if (inv.status === "paid" && inv.payment_date) {
    steps.push({
      when: `${inv.payment_date} · 09:00`,
      what: "PAID via check (Ross Built schedule)",
      done: true,
    });
  }
  return steps;
}

// Confidence per-field grid for AI parse panel.
function ConfidenceGrid({ details }: { details: CaldwellInvoiceConfidenceDetails }) {
  const fieldKeys = Object.keys(details) as Array<keyof CaldwellInvoiceConfidenceDetails>;
  return (
    <div className="grid grid-cols-2 gap-2 text-[11px]">
      {fieldKeys.map((k) => {
        const tone = confidenceTone(details[k]);
        return (
          <div
            key={k}
            className="flex items-center justify-between p-2"
            style={{ background: "var(--bg-subtle)" }}
          >
            <span style={{ color: "var(--text-secondary)" }}>
              {k.replaceAll("_", " ")}
            </span>
            <Badge variant={tone}>{(details[k] * 100).toFixed(0)}%</Badge>
          </div>
        );
      })}
    </div>
  );
}

export default function InvoicePrototypePage({
  params,
}: {
  params: { id: string };
}) {
  const inv = CALDWELL_INVOICES.find((i) => i.id === params.id);
  if (!inv) return notFound();

  const vendor = CALDWELL_VENDORS.find((v) => v.id === inv.vendor_id);
  const job = CALDWELL_JOBS.find((j) => j.id === inv.job_id);
  const costCode = inv.cost_code_id
    ? CALDWELL_COST_CODES.find((c) => c.id === inv.cost_code_id)
    : null;
  const status = STATUS_BADGE[inv.status];
  const timeline = buildTimeline(inv);

  return (
    <div className="px-6 py-8 max-w-[1600px] mx-auto">
      {/* Header band — breadcrumb + invoice meta + status + actions */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <div
            className="flex items-center gap-2 text-[12px] mb-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            <Link href="/design-system/prototypes/" className="hover:underline">
              Prototypes
            </Link>
            <span>/</span>
            <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Invoices</span>
            <span>/</span>
            <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
              {inv.invoice_number ?? inv.id}
            </span>
          </div>
          <h1
            className="text-[24px] mb-2 nw-direction-headline"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}
          >
            {vendor?.name ?? "Unknown vendor"}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <Money cents={inv.total_amount} size="lg" variant="emphasized" />
            <Badge variant={status.variant}>{status.label}</Badge>
            <span
              className="text-[10px]"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                color: "var(--text-tertiary)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              {inv.invoice_type.replaceAll("_", " ")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] border uppercase font-medium"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.12em",
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
              background: "var(--bg-card)",
            }}
          >
            <XMarkIcon className="w-3.5 h-3.5" strokeWidth={1.5} /> Reject
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] uppercase font-medium border border-nw-stone-blue bg-nw-stone-blue text-nw-white-sand"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.12em",
            }}
          >
            <CheckBadgeIcon className="w-3.5 h-3.5" strokeWidth={1.5} /> Push to QB
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
              {inv.original_file_url ?? "Invoice PDF preview"}
            </span>
            <span
              className="text-[10px] mt-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              react-pdf · sticky on desktop (F1)
            </span>
          </div>
        </div>

        {/* RIGHT — right-rail panels (per PATTERNS.md §2 structured fields RIGHT) */}
        <div className="p-5 space-y-4" style={{ background: "var(--bg-card)" }}>
          <Card padding="md">
            <Eyebrow tone="accent" className="mb-3">
              Invoice details
            </Eyebrow>
            <div className="grid grid-cols-2 gap-3">
              <DataRow label="Invoice #" value={inv.invoice_number ?? "—"} />
              <DataRow label="Date" value={inv.invoice_date ?? "—"} />
              <DataRow label="Vendor" value={vendor?.name ?? "—"} />
              <DataRow label="Project" value={job?.name ?? "—"} />
              <DataRow
                label="Cost code"
                value={
                  costCode ? `${costCode.code} · ${costCode.description}` : "—"
                }
              />
              <DataRow label="PO #" value={inv.po_id ?? "—"} />
              <DataRow label="Received" value={inv.received_date} />
              <DataRow label="Payment" value={inv.payment_date ?? "—"} />
            </div>
          </Card>

          <Card padding="md">
            <Eyebrow tone="muted" className="mb-2">
              AI parse confidence
            </Eyebrow>
            <div className="mb-3 flex items-center gap-2">
              <span
                className="text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              >
                Overall
              </span>
              <Badge variant={confidenceTone(inv.confidence_score)}>
                {(inv.confidence_score * 100).toFixed(0)}%
              </Badge>
            </div>
            <ConfidenceGrid details={inv.confidence_details} />
            {inv.flags.length > 0 && (
              <div
                className="mt-3 flex items-start gap-1.5 text-[11px]"
                style={{ color: "var(--nw-warn)" }}
              >
                <ExclamationTriangleIcon
                  className="w-3.5 h-3.5 mt-0.5 shrink-0"
                  strokeWidth={1.5}
                />
                <span style={{ color: "var(--text-secondary)" }}>
                  {inv.flags.join(" · ")}
                </span>
              </div>
            )}
          </Card>

          {/* Line items panel */}
          {inv.line_items.length > 0 && (
            <Card padding="md">
              <Eyebrow tone="muted" className="mb-2">
                Line items · {inv.line_items.length}
              </Eyebrow>
              <ul
                className="divide-y"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                {inv.line_items.map((li, i) => (
                  <li
                    key={i}
                    className="py-2 flex items-start justify-between gap-3 text-[12px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className="leading-snug"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {li.description}
                      </div>
                      {li.qty !== null && li.unit && li.rate !== null && (
                        <div
                          className="text-[10px] mt-0.5"
                          style={{
                            fontFamily: "var(--font-jetbrains-mono)",
                            color: "var(--text-tertiary)",
                          }}
                        >
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
        <Eyebrow tone="muted" className="mb-2">
          Status timeline
        </Eyebrow>
        <div
          className="mb-3 text-[10px]"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            color: "var(--text-tertiary)",
            letterSpacing: "0.04em",
          }}
        >
          Note: timeline reconstructed from terminal status. Real
          status_history JSONB lands in F1.
        </div>
        <ul className="space-y-2 text-[12px]">
          {timeline.map((e, i) => (
            <li key={i} className="flex items-baseline gap-3">
              <span
                className="w-1.5 h-1.5 mt-1 shrink-0"
                style={{
                  borderRadius: "var(--radius-dot)",
                  background: e.done
                    ? "var(--nw-stone-blue)"
                    : "var(--border-default)",
                }}
              />
              <span
                className="text-[10px] shrink-0"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  color: "var(--text-tertiary)",
                  minWidth: "140px",
                  letterSpacing: "0.04em",
                }}
              >
                {e.when}
              </span>
              <span
                style={{
                  color: e.done
                    ? "var(--text-primary)"
                    : "var(--text-tertiary)",
                }}
              >
                {e.what}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
