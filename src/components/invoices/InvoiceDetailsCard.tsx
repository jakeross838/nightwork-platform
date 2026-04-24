"use client";

import Link from "next/link";
import NwMoney from "@/components/nw/Money";
import NwDataRow from "@/components/nw/DataRow";
import { formatDate, formatStatus, formatCents } from "@/lib/utils/format";

export interface InvoiceDetailsCardAllocRow {
  code: string;
  description: string;
  amount: number;
  pct: number;
  ccId: string | null;
}

export interface InvoiceDetailsCardDrawInfo {
  id: string;
  draw_number: number;
  status: string;
}

export interface InvoiceDetailsCardProps {
  totalAmountCents: number;
  vendorName: string;
  vendorId: string | null;
  projectName: string;
  jobId: string | null;
  invoiceDate: string | null;
  receivedDateLabel: string | null;
  invoiceType: string | null;
  drawInfo: InvoiceDetailsCardDrawInfo | null;
  drawLabel: string | null;
  allocSummary: InvoiceDetailsCardAllocRow[];
}

export default function InvoiceDetailsCard({
  totalAmountCents,
  vendorName,
  vendorId,
  projectName,
  jobId,
  invoiceDate,
  receivedDateLabel,
  invoiceType,
  drawInfo,
  drawLabel,
  allocSummary,
}: InvoiceDetailsCardProps) {
  return (
    <div
      className="lg:col-span-2 p-6"
      style={{ background: "var(--nw-slate-deep)", color: "var(--nw-white-sand)" }}
    >
      <h3
        className="m-0 mb-1"
        style={{
          fontFamily: "var(--font-space-grotesk)",
          fontWeight: 500,
          fontSize: "15px",
          color: "var(--nw-white-sand)",
        }}
      >
        Invoice details
      </h3>
      <div
        className="mb-5 text-[9px] uppercase"
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          letterSpacing: "0.14em",
          color: "rgba(247,245,236,0.45)",
        }}
      >
        System metadata · editable below
      </div>

      {/* Top row: total amount (large) */}
      <div className="mb-6">
        <div
          className="text-[9px] uppercase mb-1"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.14em",
            color: "rgba(247,245,236,0.5)",
          }}
        >
          Total amount
        </div>
        <div
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 600,
            fontSize: "28px",
            letterSpacing: "-0.02em",
            color: "var(--nw-white-sand)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <NwMoney
            cents={totalAmountCents}
            size="xl"
            variant="emphasized"
            className="!text-[28px]"
            style={{ color: "var(--nw-white-sand)" }}
          />
        </div>
      </div>

      {/* DataRow grid */}
      <div className="grid grid-cols-2 gap-x-5 gap-y-4 mb-6">
        <NwDataRow
          inverse
          label="Vendor"
          value={
            <Link
              href={vendorId ? `/vendors/${vendorId}` : "#"}
              style={{ color: "var(--nw-stone-blue)", textDecoration: "underline", textUnderlineOffset: "3px" }}
            >
              {vendorName} ↗
            </Link>
          }
        />
        <NwDataRow
          inverse
          label="Project"
          value={
            <Link
              href={jobId ? `/jobs/${jobId}` : "#"}
              style={{ color: "var(--nw-stone-blue)", textDecoration: "underline", textUnderlineOffset: "3px" }}
            >
              {projectName} ↗
            </Link>
          }
        />
        <NwDataRow
          inverse
          label="Invoice date"
          value={<span style={{ color: "var(--nw-white-sand)" }}>{invoiceDate ? formatDate(invoiceDate) : "—"}</span>}
        />
        <NwDataRow
          inverse
          label="Received"
          value={<span style={{ color: "var(--nw-white-sand)" }}>{receivedDateLabel ?? "—"}</span>}
        />
        <NwDataRow
          inverse
          label="Type"
          value={<span style={{ color: "var(--nw-white-sand)" }}>{invoiceType ? formatStatus(invoiceType) : "—"}</span>}
        />
        <NwDataRow
          inverse
          label="Attached to draw"
          value={
            drawInfo ? (
              <Link
                href={`/draws/${drawInfo.id}`}
                style={{ color: "var(--nw-stone-blue)", textDecoration: "underline", textUnderlineOffset: "3px" }}
              >
                {drawLabel} ↗
              </Link>
            ) : (
              <span style={{ color: "rgba(247,245,236,0.5)" }}>Not attached</span>
            )
          }
        />
      </div>

      {/* Cost code allocation summary (read-only — clickable rows scroll
          to the editable allocations section in the workbench below). */}
      {allocSummary.length > 0 ? (
        <div
          className="border"
          style={{ borderColor: "rgba(247,245,236,0.1)", background: "var(--nw-slate-deeper)" }}
        >
          <table className="w-full" style={{ fontSize: "13px" }}>
            <thead>
              <tr>
                <th
                  className="text-left px-3 py-2"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: "9px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(247,245,236,0.45)",
                    fontWeight: 500,
                    borderBottom: "1px solid rgba(247,245,236,0.08)",
                  }}
                >
                  Cost code allocation
                </th>
                <th
                  className="text-right px-3 py-2"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: "9px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(247,245,236,0.45)",
                    fontWeight: 500,
                    borderBottom: "1px solid rgba(247,245,236,0.08)",
                  }}
                >
                  Allocated
                </th>
                <th
                  className="text-right px-3 py-2"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: "9px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(247,245,236,0.45)",
                    fontWeight: 500,
                    borderBottom: "1px solid rgba(247,245,236,0.08)",
                  }}
                >
                  % of invoice
                </th>
              </tr>
            </thead>
            <tbody>
              {allocSummary.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => {
                    const el = document.getElementById("workbench-allocations");
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="cursor-pointer hover:bg-white/[0.02]"
                >
                  <td
                    className="px-3 py-2.5"
                    style={{
                      color: "rgba(247,245,236,0.85)",
                      borderBottom: "1px solid rgba(247,245,236,0.05)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-jetbrains-mono)",
                        fontSize: "11px",
                        color: "var(--nw-stone-blue)",
                        fontWeight: 600,
                        marginRight: "8px",
                      }}
                    >
                      {row.code}
                    </span>
                    {row.description}
                  </td>
                  <td
                    className="px-3 py-2.5 text-right"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      fontSize: "12px",
                      color: "rgba(247,245,236,0.85)",
                      fontVariantNumeric: "tabular-nums",
                      borderBottom: "1px solid rgba(247,245,236,0.05)",
                    }}
                  >
                    {formatCents(row.amount)}
                  </td>
                  <td
                    className="px-3 py-2.5 text-right"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      fontSize: "12px",
                      color: "rgba(247,245,236,0.7)",
                      fontVariantNumeric: "tabular-nums",
                      borderBottom: "1px solid rgba(247,245,236,0.05)",
                    }}
                  >
                    {row.pct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
