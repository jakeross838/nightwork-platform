"use client";

import VendorContactPopover, {
  type VendorDetail,
} from "@/components/vendor-contact-popover";
import ProposalStatusBadge, {
  type ProposalReviewStatus,
} from "@/components/proposals/ProposalStatusBadge";
import { confidenceColor, confidenceLabel } from "@/lib/utils/format";

/**
 * Phase 3.4 Issue 2 — proposal review sub-header bar.
 *
 * Mirrors the compact invoice review sub-header (`InvoiceHeader.tsx`):
 * blue-tint band across the top, vendor name in font-display, info
 * popover, "— proposal#", confidence rollup pill, status badge, and
 * a Print button on the right.
 *
 * Differences from invoice:
 *   - No back-link (proposals queue page lands in Phase 3.10; the
 *     AppShell sidebar handles navigation today).
 *   - No PM picker (proposals don't have an assigned-PM concept yet).
 *   - Status comes from `ProposalStatusBadge`, not the invoice
 *     `statusBadgeOutline` utility (different state machines).
 *   - Optional `signed` flag on the badge for "Awaiting review · Signed"
 *     when the extracted PDF carries an acceptance signature.
 *
 * The action buttons (Save / Convert PO / Convert CO disabled / Reject)
 * live in the action strip ABOVE the 50/50 hero, not in this bar — that
 * matches the invoice precedent where header chrome stays minimal.
 */

interface Props {
  vendorNameRaw: string | null;
  vendorId: string | null;
  vendor: VendorDetail | null;
  proposalNumber: string | null;
  confidenceScore: number;
  status: ProposalReviewStatus;
  signed?: boolean;
}

export default function ProposalReviewHeader({
  vendorNameRaw,
  vendorId,
  vendor,
  proposalNumber,
  confidenceScore,
  status,
  signed,
}: Props) {
  return (
    <div className="border-b border-[var(--border-default)] bg-[rgba(91,134,153,0.04)] px-4 md:px-6 py-3 print:hidden">
      <div className="max-w-[1600px] mx-auto flex items-center gap-3 md:gap-4 flex-wrap">
        <h1 className="font-display text-base md:text-xl text-[color:var(--text-primary)] flex items-center gap-2 min-w-0">
          <span className="truncate">{vendorNameRaw ?? "Proposal"}</span>
          <VendorContactPopover
            vendorId={vendorId}
            vendorName={vendorNameRaw ?? vendor?.name ?? null}
            vendor={vendor}
          />
          <span className="text-[color:var(--text-secondary)] hidden md:inline">
            &mdash;
          </span>
          <span className="md:hidden"> </span>
          <span className="truncate">{proposalNumber ?? "No #"}</span>
        </h1>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${confidenceColor(confidenceScore)}`}
        >
          {Math.round(confidenceScore * 100)}% {confidenceLabel(confidenceScore)}
        </span>
        <ProposalStatusBadge status={status} signed={signed} />
        <button
          onClick={() => window.print()}
          className="ml-auto px-3 py-1 border border-[var(--border-default)] text-[color:var(--text-primary)] hover:bg-[var(--bg-muted)] text-xs uppercase tracking-[0.06em] transition-colors"
          aria-label="Print this proposal"
        >
          Print
        </button>
      </div>
    </div>
  );
}
