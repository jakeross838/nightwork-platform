"use client";

import Link from "next/link";
import NwBadge, { type BadgeVariant } from "@/components/nw/Badge";
import NwButton from "@/components/nw/Button";
import { formatCents, formatStatus, confidenceColor, confidenceLabel } from "@/lib/utils/format";
import { toast } from "@/lib/utils/toast";

export interface InvoiceSummaryStripProps {
  vendorName: string;
  invoiceNumber: string | null;
  totalAmountCents: number;

  invoiceDate: string | null;
  receivedDateLabel: string | null;
  invoiceDateLabel: string | null;

  projectName: string;
  jobId: string | null;

  status: string;
  statusBadgeVariant: BadgeVariant;
  confidenceScore: number;

  drawLabel: string | null;
  drawId: string | null;

  signedFileUrl: string | null;
  isQaApproved: boolean;
}

/**
 * Horizontal summary strip shown at the top of the invoice detail page,
 * directly below InvoiceHeader. Consolidates what used to live in the
 * InvoiceTitleStrip (H1 + vendor/project/date line) and the dark teal
 * InvoiceDetailsCard (total amount + data grid) into a single scannable row.
 */
export default function InvoiceSummaryStrip({
  vendorName,
  invoiceNumber,
  totalAmountCents,
  invoiceDate: _invoiceDate,
  receivedDateLabel,
  invoiceDateLabel,
  projectName,
  jobId,
  status,
  statusBadgeVariant,
  confidenceScore,
  drawLabel,
  drawId,
  signedFileUrl,
  isQaApproved,
}: InvoiceSummaryStripProps) {
  return (
    <div
      className="border-b px-4 md:px-6 py-5 print:hidden"
      style={{ borderColor: "var(--border-default)" }}
    >
      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8 flex-wrap">
        {/* Primary — vendor / amount / invoice # */}
        <div className="flex-1 min-w-0">
          <div
            className="text-[10px] uppercase mb-1"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.14em",
              color: "var(--text-tertiary)",
            }}
          >
            Vendor
          </div>
          <div
            className="truncate"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 500,
              fontSize: "22px",
              letterSpacing: "-0.01em",
              color: "var(--text-primary)",
              lineHeight: 1.2,
            }}
          >
            {vendorName}
          </div>
          <div className="mt-1 flex items-baseline gap-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            <span>Invoice #{invoiceNumber ?? "—"}</span>
            <span className="text-[color:var(--text-tertiary)]">·</span>
            <span
              className="font-display"
              style={{
                fontSize: "18px",
                fontWeight: 500,
                color: "var(--text-primary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatCents(totalAmountCents)}
            </span>
          </div>
        </div>

        {/* Secondary — invoice date / received date / project */}
        <div className="flex items-start gap-6 flex-wrap">
          <div>
            <div
              className="text-[10px] uppercase mb-1"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Invoice date
            </div>
            <div className="text-sm" style={{ color: "var(--text-primary)" }}>
              {invoiceDateLabel ?? "—"}
            </div>
          </div>
          <div>
            <div
              className="text-[10px] uppercase mb-1"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Received
            </div>
            <div className="text-sm" style={{ color: "var(--text-primary)" }}>
              {receivedDateLabel ?? "—"}
            </div>
          </div>
          <div>
            <div
              className="text-[10px] uppercase mb-1"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Project
            </div>
            <div className="text-sm">
              <Link
                href={jobId ? `/jobs/${jobId}` : "#"}
                className="font-medium"
                style={{ color: "var(--nw-stone-blue)" }}
              >
                {projectName}
              </Link>
            </div>
          </div>
        </div>

        {/* Tertiary — status + confidence + draw + utility actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <NwBadge variant={statusBadgeVariant}>{formatStatus(status)}</NwBadge>
          <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${confidenceColor(confidenceScore)}`}>
            {Math.round(confidenceScore * 100)}% {confidenceLabel(confidenceScore)}
          </span>
          {drawLabel && (
            <Link
              href={drawId ? `/draws/${drawId}` : "#"}
              className="inline-flex items-center text-xs px-2.5 py-0.5 border font-medium"
              style={{
                borderColor: "var(--nw-stone-blue)",
                color: "var(--nw-stone-blue)",
              }}
            >
              {drawLabel} ↗
            </Link>
          )}
          {signedFileUrl ? (
            <a
              href={signedFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
            >
              <NwButton variant="ghost" size="sm">
                Download PDF
              </NwButton>
            </a>
          ) : null}
          {isQaApproved ? (
            <NwButton
              variant="primary"
              size="sm"
              onClick={() => toast.info("QuickBooks integration coming soon")}
            >
              Push to QuickBooks →
            </NwButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}
