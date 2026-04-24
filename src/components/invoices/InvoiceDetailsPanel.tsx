"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCents, formatDate, formatFlag, formatWho } from "@/lib/utils/format";
import type { OrgMemberRole } from "@/lib/org/session";

export interface InvoiceDetailsPanelAllocRow {
  code: string;
  description: string;
  amount: number;
  pct: number;
}

export interface InvoiceDetailsPanelTimelineEvent {
  when: string;
  label: string;
  tone: "done" | "current" | "pending";
}

export interface InvoiceDetailsPanelDrawInfo {
  id: string;
  draw_number: number;
  status: string;
}

export interface InvoiceDetailsPanelProps {
  totalAmountCents: number;
  vendorName: string;
  vendorId: string | null;
  projectName: string;
  jobId: string | null;
  receivedAtLabel: string | null;
  invoiceDateLabel: string | null;
  drawLabel: string | null;
  drawInfo: InvoiceDetailsPanelDrawInfo | null;
  allocSummary: InvoiceDetailsPanelAllocRow[];
  confidenceScore: number;
  confidenceDetails:
    | (Record<string, number> & { auto_fills?: Record<string, boolean> })
    | null;
  flags: string[];
  aiModelUsed: string | null;
  statusHistory: Array<Record<string, unknown>>;
  currentStatus: string;
  userNames: Map<string, string>;
  /**
   * Current authenticated user's org role, or null while the role is
   * still loading. Used to compute lock-state editability. Null is
   * treated as non-privileged (fail-closed).
   */
  role: OrgMemberRole | null;
}

/**
 * Right column of the invoice detail page. Matches the Slate Design System
 * reference (`Nightwork Invoice Detail - Standalone.html`): metadata grid,
 * cost-code allocation table, AI extraction summary, vertical audit timeline.
 * All colors route through semantic vars so both themes render.
 */
export default function InvoiceDetailsPanel({
  totalAmountCents,
  vendorName,
  vendorId,
  projectName,
  jobId,
  receivedAtLabel,
  invoiceDateLabel,
  drawLabel,
  drawInfo,
  allocSummary,
  confidenceScore,
  confidenceDetails,
  flags,
  aiModelUsed,
  statusHistory,
  currentStatus,
  userNames,
  role,
}: InvoiceDetailsPanelProps) {
  const timeline = buildTimeline(statusHistory, currentStatus, userNames);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const currentLabel = humanStatus(currentStatus);
  const nextPending = pendingAfter(currentStatus)[0] ?? null;
  // Phase 3a: role prop is threaded in so Phase 3b (vendor name,
  // invoice #, date editing in-panel) can gate fields via
  // canEditInvoice({status}, role). Today the panel has no editable
  // fields; lock/permission logic lives at the page + allocations
  // editor level. Suppress unused-var complaint without introducing
  // dead code in the meantime.
  void role;
  const overallPct = (confidenceScore * 100).toFixed(1);
  const autoFills = (confidenceDetails as Record<string, unknown> | null)
    ?.auto_fills as Record<string, boolean> | undefined;
  const autoFillCount = autoFills
    ? Object.values(autoFills).filter(Boolean).length
    : 0;
  const flagsCleared = currentStatus === "qa_approved" && flags.length > 0;

  return (
    <div
      className="p-[22px]"
      style={{ background: "var(--bg-card)" }}
    >
      {/* ─── Invoice details metadata ─── */}
      <h3
        className="m-0 mb-0.5"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 500,
          fontSize: "15px",
          color: "var(--text-primary)",
        }}
      >
        Invoice details
      </h3>
      <Eyebrow>System metadata · editable by PM and accounting</Eyebrow>

      <div className="grid grid-cols-2 gap-x-5 gap-y-[14px] mt-4">
        <Field label="Total amount">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "22px",
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatCents(totalAmountCents)}
          </span>
        </Field>
        <Field label="Vendor">
          <Link
            href={vendorId ? `/vendors/${vendorId}` : "#"}
            style={{
              color: "var(--nw-stone-blue)",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            {vendorName} ↗
          </Link>
        </Field>
        <Field label="Project">
          <Link
            href={jobId ? `/jobs/${jobId}` : "#"}
            style={{
              color: "var(--nw-stone-blue)",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            {projectName} ↗
          </Link>
        </Field>
        {receivedAtLabel && (
          <Field label="Received">
            <span style={{ color: "var(--text-primary)" }}>{receivedAtLabel}</span>
          </Field>
        )}
        {invoiceDateLabel && (
          <Field label="Invoice date">
            <span style={{ color: "var(--text-primary)" }}>{invoiceDateLabel}</span>
          </Field>
        )}
        {drawLabel && (
          <Field label="Attached to draw">
            <Link
              href={drawInfo ? `/draws/${drawInfo.id}` : "#"}
              style={{
                color: "var(--nw-stone-blue)",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              {drawLabel} ↗
            </Link>
          </Field>
        )}
      </div>

      {/* ─── Cost-code allocation table ─── */}
      {allocSummary.length > 0 && (
        <div
          className="mt-[18px] border"
          style={{
            borderColor: "var(--border-default)",
            background: "var(--bg-subtle)",
          }}
        >
          <table className="w-full border-collapse" style={{ fontSize: "13px" }}>
            <thead>
              <tr>
                <AllocTh>Cost code allocation</AllocTh>
                <AllocTh align="right">Allocated</AllocTh>
                <AllocTh align="right">% of invoice</AllocTh>
              </tr>
            </thead>
            <tbody>
              {allocSummary.map((row, i) => (
                <tr key={i}>
                  <AllocTd>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        color: "var(--nw-stone-blue)",
                        fontWeight: 600,
                        marginRight: "8px",
                      }}
                    >
                      {row.code}
                    </span>
                    {row.description}
                  </AllocTd>
                  <AllocTd align="right" mono>
                    {formatCents(row.amount)}
                  </AllocTd>
                  <AllocTd align="right" mono tertiary>
                    {row.pct.toFixed(1)}%
                  </AllocTd>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── AI extraction summary ─── */}
      <div
        className="mt-[14px] p-[14px]"
        style={{
          background: "rgba(91,134,153,0.08)",
          border: "1px solid rgba(91,134,153,0.3)",
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-block"
            style={{
              width: "5px",
              height: "5px",
              background: "var(--nw-stone-blue)",
            }}
            aria-hidden="true"
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--nw-stone-blue)",
              fontWeight: 500,
            }}
          >
            AI extraction · {aiModelUsed ?? "Claude"}
          </span>
        </div>
        <p
          className="m-0"
          style={{
            fontSize: "12px",
            lineHeight: 1.55,
            color: "var(--text-primary)",
          }}
        >
          {buildAiNarrative(confidenceDetails, flags, autoFillCount)}
        </p>
        <div
          className="mt-2"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.04em",
            color: "var(--text-tertiary)",
          }}
        >
          CONFIDENCE{" "}
          <b
            style={{
              color:
                confidenceScore >= 0.85
                  ? "var(--nw-success)"
                  : confidenceScore >= 0.7
                    ? "var(--nw-warn)"
                    : "var(--nw-danger)",
            }}
          >
            {overallPct}%
          </b>
          {flagsCleared
            ? ` · ${flags.length} FLAG${flags.length === 1 ? "" : "S"} CLEARED`
            : flags.length > 0
              ? ` · ${flags.length} FLAG${flags.length === 1 ? "" : "S"}`
              : null}
        </div>
      </div>

      {/* ─── Status timeline — collapsed summary + expand toggle ─── */}
      <div className="mt-[22px] flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>Current stage</Eyebrow>
          <div
            className="mt-1"
            style={{
              fontSize: "13px",
              color: "var(--text-primary)",
              fontWeight: 500,
            }}
          >
            {currentLabel}
          </div>
          <div
            className="mt-0.5"
            style={{
              fontSize: "12px",
              color: "var(--text-tertiary)",
            }}
          >
            {nextPending ? `Next: ${nextPending}` : "No further steps pending"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTimelineOpen((o) => !o)}
          className="flex items-center gap-1.5 shrink-0"
          aria-expanded={timelineOpen}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--nw-stone-blue)",
          }}
        >
          {timelineOpen ? "Collapse" : "View full timeline"}
          <svg
            className={`w-3 h-3 transition-transform ${timelineOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {timelineOpen && (
        <div className="relative pl-4 mt-3">
          <div
            className="absolute"
            style={{
              left: "4px",
              top: "6px",
              bottom: "6px",
              width: "1px",
              background: "var(--border-default)",
            }}
          />
          {timeline.map((ev, i) => (
            <TimelineRow key={i} event={ev} />
          ))}
        </div>
      )}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "9px",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--text-tertiary)",
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: "13px" }}>{children}</span>
    </div>
  );
}

function AllocTh({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={align === "right" ? "text-right" : "text-left"}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "9px",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--text-tertiary)",
        padding: "8px 12px",
        borderBottom: "1px solid var(--border-default)",
        fontWeight: 500,
      }}
    >
      {children}
    </th>
  );
}

function AllocTd({
  children,
  align,
  mono,
  tertiary,
}: {
  children: React.ReactNode;
  align?: "right";
  mono?: boolean;
  tertiary?: boolean;
}) {
  return (
    <td
      className={align === "right" ? "text-right" : ""}
      style={{
        padding: "10px 12px",
        borderBottom: "1px solid var(--border-subtle)",
        color: tertiary ? "var(--text-tertiary)" : "var(--text-primary)",
        fontVariantNumeric: "tabular-nums",
        fontFamily: mono ? "var(--font-mono)" : undefined,
        fontSize: mono ? "12px" : undefined,
      }}
    >
      {children}
    </td>
  );
}

function TimelineRow({
  event,
}: {
  event: InvoiceDetailsPanelTimelineEvent;
}) {
  const dotStyle: React.CSSProperties = (() => {
    if (event.tone === "done")
      return { background: "var(--color-success)", border: "2px solid var(--bg-card)" };
    if (event.tone === "current")
      return { background: "var(--nw-stone-blue)", border: "2px solid var(--bg-card)" };
    return {
      background: "transparent",
      border: "2px solid var(--border-strong)",
    };
  })();

  return (
    <div className="relative py-[6px] pb-[14px]">
      <span
        aria-hidden="true"
        className="absolute"
        style={{
          left: "-16px",
          top: "10px",
          width: "9px",
          height: "9px",
          borderRadius: "50%",
          ...dotStyle,
        }}
      />
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: "2px",
        }}
      >
        {event.when}
      </div>
      <div
        style={{
          fontSize: "13px",
          color:
            event.tone === "pending" ? "var(--text-tertiary)" : "var(--text-primary)",
        }}
      >
        {event.label}
      </div>
    </div>
  );
}

function buildTimeline(
  history: Array<Record<string, unknown>>,
  currentStatus: string,
  userNames: Map<string, string>
): InvoiceDetailsPanelTimelineEvent[] {
  const events: InvoiceDetailsPanelTimelineEvent[] = [];
  for (const h of history ?? []) {
    const when = formatTimelineStamp(h.at as string | undefined);
    const who = formatWho((h.by as string | null) ?? "", userNames);
    const newStatus = String(h.new_status ?? "");
    const note = (h.note as string | undefined) ?? null;
    const label = buildHistoryLabel(newStatus, who, note);
    events.push({
      when,
      label,
      tone: newStatus === currentStatus ? "current" : "done",
    });
  }
  // Trailing pending markers inferred from current status
  for (const pending of pendingAfter(currentStatus)) {
    events.push({ when: "PENDING", label: pending, tone: "pending" });
  }
  return events;
}

function formatTimelineStamp(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${month} ${day} · ${hh}:${mm}`;
}

function buildHistoryLabel(
  newStatus: string,
  who: string,
  note: string | null
): string {
  const action = humanStatus(newStatus);
  const suffix = note ? ` · ${note}` : "";
  const actor = who ? ` by ${who}` : "";
  return `${action}${actor}${suffix}`;
}

function humanStatus(s: string): string {
  switch (s) {
    case "received":
      return "Received";
    case "ai_processed":
      return "Auto-classified by Nightwork AI";
    case "pm_review":
      return "Sent to PM review";
    case "pm_approved":
      return "PM approved";
    case "pm_held":
      return "Held";
    case "pm_denied":
      return "Denied";
    case "qa_review":
      return "Sent to QA review";
    case "qa_approved":
      return "QA approved";
    case "qa_kicked_back":
      return "Kicked back by QA";
    case "info_requested":
      return "Info requested";
    case "pushed_to_qb":
      return "Pushed to QuickBooks";
    case "in_draw":
      return "Attached to draw";
    case "paid":
      return "Paid";
    case "void":
      return "Voided";
    default:
      return s || "Status changed";
  }
}

function pendingAfter(currentStatus: string): string[] {
  switch (currentStatus) {
    case "received":
    case "ai_processed":
      return ["PM review", "QA approval", "Attach to draw", "Push to QuickBooks"];
    case "pm_review":
      return ["QA approval", "Attach to draw", "Push to QuickBooks"];
    case "pm_approved":
    case "qa_review":
      return ["QA approval", "Attach to draw", "Push to QuickBooks"];
    case "qa_approved":
      return ["Attach to draw", "Push to QuickBooks"];
    case "in_draw":
      return ["Push to QuickBooks"];
    default:
      return [];
  }
}

function buildAiNarrative(
  confidenceDetails:
    | (Record<string, number> & { auto_fills?: Record<string, boolean> })
    | null,
  flags: string[],
  autoFillCount: number
): string {
  const parts: string[] = [];
  const conf = confidenceDetails ?? {};
  const fields = Object.entries(conf).filter(
    ([k, v]) => k !== "auto_fills" && typeof v === "number"
  );
  if (autoFillCount > 0) {
    parts.push(
      `${autoFillCount} field${autoFillCount === 1 ? "" : "s"} auto-filled by Claude.`
    );
  }
  if (fields.length > 0) {
    const avg =
      fields.reduce((s, [, v]) => s + (v as number), 0) / fields.length;
    parts.push(
      `Per-field confidence avg ${(avg * 100).toFixed(0)}% across ${fields.length} extracted field${fields.length === 1 ? "" : "s"}.`
    );
  }
  if (flags.length > 0) {
    parts.push(
      `Flags raised: ${flags.map((f) => formatFlag(f)).join(", ")}.`
    );
  }
  if (parts.length === 0) {
    parts.push("Extracted by Claude. No additional metadata recorded.");
  }
  return parts.join(" ");
}

export function buildAllocSummary(lineItems: Array<{
  amount_cents: number;
  cost_code_id: string | null;
  cost_codes: { code: string; description: string } | null;
}>): InvoiceDetailsPanelAllocRow[] {
  const total = lineItems.reduce((s, li) => s + li.amount_cents, 0);
  const byCode = new Map<string, { code: string; description: string; amount: number }>();
  for (const li of lineItems) {
    const cc = li.cost_codes;
    const key = cc?.code ?? "unassigned";
    const prev = byCode.get(key);
    if (prev) {
      prev.amount += li.amount_cents;
    } else {
      byCode.set(key, {
        code: cc?.code ?? "—",
        description: cc?.description ?? "Unassigned",
        amount: li.amount_cents,
      });
    }
  }
  return Array.from(byCode.values()).map((row) => ({
    ...row,
    pct: total > 0 ? (row.amount / total) * 100 : 0,
  }));
}

// Unused export sentinel to silence tree-shaking TS warnings for these
// helpers — re-exported in case a future callsite wants the same helpers.
export { formatDate };
