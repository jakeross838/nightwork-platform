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

const STATUS_BADGE: Record<
  CaldwellDrawStatus,
  {
    variant: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
    label: string;
  }
> = {
  draft: { variant: "neutral", label: "DRAFT" },
  pm_review: { variant: "warning", label: "PM REVIEW" },
  approved: { variant: "success", label: "APPROVED" },
  submitted: { variant: "info", label: "SUBMITTED" },
  paid: { variant: "success", label: "PAID" },
  void: { variant: "danger", label: "VOID" },
};

export default function DrawPrototypePage({
  params,
}: {
  params: { id: string };
}) {
  const draw = CALDWELL_DRAWS.find((d) => d.id === params.id);
  if (!draw) return notFound();

  const job = CALDWELL_JOBS.find((j) => j.id === draw.job_id);
  const status = STATUS_BADGE[draw.status];
  const lineItems = CALDWELL_DRAW_LINE_ITEMS.filter(
    (li) => li.draw_id === draw.id,
  );
  // CO summary on G702 — show all approved COs that have rolled into the
  // contract sum to date through this draw_number (filter by draw_number
  // <= current draw — matches AIA G702 cover sheet PCCO log).
  const cosThroughThisDraw = CALDWELL_CHANGE_ORDERS.filter(
    (co) => co.draw_number !== null && co.draw_number <= draw.draw_number,
  );

  return (
    <div className="px-6 py-8 max-w-[1600px] mx-auto">
      {/* Header band */}
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
            <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Draws</span>
            <span>/</span>
            <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
              Draw #{draw.draw_number}
            </span>
            {draw.revision_number > 0 && (
              <>
                <span>·</span>
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    color: "var(--nw-warn)",
                  }}
                >
                  Rev {draw.revision_number}
                </span>
              </>
            )}
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
            {job?.name ?? "Unknown job"} — Pay App #{draw.draw_number}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="text-[12px]"
              style={{ color: "var(--text-secondary)" }}
            >
              Period: {draw.period_start} – {draw.period_end}
            </span>
            <span
              className="text-[12px]"
              style={{ color: "var(--text-secondary)" }}
            >
              Application: {draw.application_date}
            </span>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/design-system/prototypes/draws/${draw.id}/print`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] border uppercase font-medium"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.12em",
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
              background: "var(--bg-card)",
            }}
          >
            <PrinterIcon className="w-3.5 h-3.5" strokeWidth={1.5} /> Print
          </Link>
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
            <ArrowUturnLeftIcon className="w-3.5 h-3.5" strokeWidth={1.5} /> Send
            back
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] uppercase font-medium border border-nw-stone-blue bg-nw-stone-blue text-nw-white-sand"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.12em",
            }}
          >
            <CheckBadgeIcon className="w-3.5 h-3.5" strokeWidth={1.5} /> Approve
          </button>
        </div>
      </div>

      {/* Hero grid — LEFT: G702 summary, RIGHT: G703 line items */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] mb-6"
        style={{ gap: "1px", background: "var(--border-default)" }}
      >
        {/* LEFT — G702 cover sheet summary */}
        <div
          className="p-5 space-y-4"
          style={{ background: "var(--bg-card)" }}
        >
          <Eyebrow tone="accent">G702 — Application & Certificate</Eyebrow>
          <Card padding="md">
            <div className="space-y-3">
              <DataRow
                label="Original contract sum"
                value={<Money cents={draw.original_contract_sum} size="md" />}
              />
              <DataRow
                label="Net change orders"
                value={
                  <Money
                    cents={draw.net_change_orders}
                    size="md"
                    signColor
                  />
                }
              />
              <DataRow
                label="Contract sum to date"
                value={
                  <Money
                    cents={draw.contract_sum_to_date}
                    size="md"
                    variant="emphasized"
                  />
                }
              />
              <DataRow
                label="Total completed to date"
                value={<Money cents={draw.total_completed_to_date} size="md" />}
              />
              <DataRow
                label="Less previous payments"
                value={<Money cents={draw.less_previous_payments} size="md" />}
              />
              <DataRow
                label="Current payment due"
                value={
                  <Money
                    cents={draw.current_payment_due}
                    size="md"
                    variant="emphasized"
                  />
                }
              />
              <DataRow
                label="Balance to finish"
                value={<Money cents={draw.balance_to_finish} size="md" />}
              />
            </div>
          </Card>

          {cosThroughThisDraw.length > 0 && (
            <Card padding="md">
              <Eyebrow tone="muted" className="mb-3">
                Change orders · {cosThroughThisDraw.length}
              </Eyebrow>
              <ul className="space-y-3 text-[12px]">
                {cosThroughThisDraw.map((co) => (
                  <li
                    key={co.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-[10px] mb-0.5"
                        style={{
                          fontFamily: "var(--font-jetbrains-mono)",
                          letterSpacing: "0.08em",
                          color: "var(--text-tertiary)",
                          textTransform: "uppercase",
                        }}
                      >
                        PCCO #{co.pcco_number}
                      </div>
                      <div
                        className="leading-snug"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {co.description.split(".")[0]}
                      </div>
                    </div>
                    <Money cents={co.total_with_fee} size="sm" signColor />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* RIGHT — G703 line items table — analog: patterns/page.tsx:1086-1133 */}
        <div className="p-5" style={{ background: "var(--bg-card)" }}>
          <Eyebrow tone="accent" className="mb-3">
            G703 — Continuation sheet · {lineItems.length} line items
          </Eyebrow>
          <div className="overflow-x-auto">
            <table
              className="w-full text-[10px]"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <thead>
                <tr style={{ background: "var(--bg-subtle)" }}>
                  {[
                    "Item",
                    "Description",
                    "Original",
                    "Previous",
                    "This period",
                    "Total to date",
                    "%",
                    "Balance",
                  ].map((h) => (
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
                  const cc = CALDWELL_COST_CODES.find(
                    (c) => c.id === li.cost_code_id,
                  );
                  // "Original" estimate per AIA G703 = total scheduled value
                  // for the line. Reconstruct from the row: previous + this
                  // period + balance to finish (the row's three components
                  // sum to the original budget — basic G703 contract math).
                  const originalEstimate =
                    li.previous_applications + li.this_period + li.balance_to_finish;
                  return (
                    <tr key={li.id}>
                      <td
                        className="px-2 py-1.5 border"
                        style={{ borderColor: "var(--border-subtle)" }}
                      >
                        {cc?.code ?? "—"}
                      </td>
                      <td
                        className="px-2 py-1.5 border"
                        style={{
                          borderColor: "var(--border-subtle)",
                          fontFamily: "var(--font-inter, inherit)",
                        }}
                      >
                        {cc?.description ?? "—"}
                      </td>
                      <td
                        className="px-2 py-1.5 border text-right"
                        style={{ borderColor: "var(--border-subtle)" }}
                      >
                        $
                        {(originalEstimate / 100).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        className="px-2 py-1.5 border text-right"
                        style={{ borderColor: "var(--border-subtle)" }}
                      >
                        $
                        {(li.previous_applications / 100).toLocaleString(
                          undefined,
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                        )}
                      </td>
                      <td
                        className="px-2 py-1.5 border text-right"
                        style={{ borderColor: "var(--border-subtle)" }}
                      >
                        $
                        {(li.this_period / 100).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        className="px-2 py-1.5 border text-right"
                        style={{ borderColor: "var(--border-subtle)" }}
                      >
                        $
                        {(li.total_to_date / 100).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        className="px-2 py-1.5 border text-right"
                        style={{ borderColor: "var(--border-subtle)" }}
                      >
                        {(li.percent_complete * 100).toFixed(1)}%
                      </td>
                      <td
                        className="px-2 py-1.5 border text-right"
                        style={{ borderColor: "var(--border-subtle)" }}
                      >
                        $
                        {(li.balance_to_finish / 100).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
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
          <li className="flex items-baseline gap-3">
            <span
              className="w-1.5 h-1.5 mt-1 shrink-0"
              style={{
                borderRadius: "var(--radius-dot)",
                background: "var(--nw-stone-blue)",
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
              {draw.application_date}
            </span>
            <span style={{ color: "var(--text-primary)" }}>
              DRAFTED · period {draw.period_start} – {draw.period_end}
            </span>
          </li>
          {draw.submitted_at && (
            <li className="flex items-baseline gap-3">
              <span
                className="w-1.5 h-1.5 mt-1 shrink-0"
                style={{
                  borderRadius: "var(--radius-dot)",
                  background: "var(--nw-stone-blue)",
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
                {draw.submitted_at.slice(0, 10)}
              </span>
              <span style={{ color: "var(--text-primary)" }}>
                SUBMITTED to owner
              </span>
            </li>
          )}
          {draw.paid_at && (
            <li className="flex items-baseline gap-3">
              <span
                className="w-1.5 h-1.5 mt-1 shrink-0"
                style={{
                  borderRadius: "var(--radius-dot)",
                  background: "var(--nw-stone-blue)",
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
