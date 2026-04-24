"use client";

import Link from "next/link";
import NwBadge, { type BadgeVariant } from "@/components/nw/Badge";
import NwButton from "@/components/nw/Button";
import { formatStatus } from "@/lib/utils/format";
import { toast } from "@/lib/utils/toast";

export interface InvoiceTitleStripProps {
  vendorName: string;
  projectName: string;
  jobId: string | null;
  invoiceNumber: string | null;
  status: string;
  statusBadgeVariant: BadgeVariant;
  receivedDateLabel: string | null;
  drawLabel: string | null;
  drawId: string | null;
  signedFileUrl: string | null;
  isQaApproved: boolean;
}

export default function InvoiceTitleStrip({
  vendorName,
  projectName,
  jobId,
  invoiceNumber,
  status,
  statusBadgeVariant,
  receivedDateLabel,
  drawLabel,
  drawId,
  signedFileUrl,
  isQaApproved,
}: InvoiceTitleStripProps) {
  return (
    <div className="mb-6">
      <div
        className="mb-3 text-[10px] uppercase"
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          letterSpacing: "0.14em",
          color: "var(--text-tertiary)",
        }}
      >
        Home / Financial / Invoices /{" "}
        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
          #{invoiceNumber ?? "—"} · {vendorName}
        </span>
      </div>
      <div className="flex items-end justify-between gap-5 flex-wrap">
        <div className="min-w-0">
          <h1
            className="m-0 mb-1 flex items-center gap-3 flex-wrap"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 500,
              fontSize: "30px",
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}
          >
            <span>Invoice #{invoiceNumber ?? "—"}</span>
            <NwBadge variant={statusBadgeVariant}>{formatStatus(status)}</NwBadge>
          </h1>
          <p
            className="text-[13px] m-0"
            style={{ color: "var(--text-secondary)" }}
          >
            {vendorName} ·{" "}
            <Link
              href={jobId ? `/jobs/${jobId}` : "#"}
              className="font-medium"
              style={{ color: "var(--nw-stone-blue)" }}
            >
              {projectName}
            </Link>
            {receivedDateLabel ? <> · Received {receivedDateLabel}</> : null}
            {drawLabel ? (
              <>
                {" · Assigned to "}
                <Link
                  href={drawId ? `/draws/${drawId}` : "#"}
                  className="font-medium"
                  style={{ color: "var(--nw-stone-blue)" }}
                >
                  {drawLabel}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {signedFileUrl ? (
            <a
              href={signedFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
            >
              <NwButton variant="ghost" size="md">
                Download PDF
              </NwButton>
            </a>
          ) : null}
          {isQaApproved ? (
            <NwButton
              variant="primary"
              size="md"
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
