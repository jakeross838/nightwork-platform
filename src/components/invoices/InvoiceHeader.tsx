"use client";

import Link from "next/link";
import VendorContactPopover from "@/components/vendor-contact-popover";
import {
  confidenceColor,
  confidenceLabel,
  statusBadgeOutline,
  formatStatus,
} from "@/lib/utils/format";

export interface InvoiceHeaderVendor {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface InvoiceHeaderProps {
  vendorNameRaw: string | null;
  vendorId: string | null;
  vendor: InvoiceHeaderVendor | null;
  invoiceNumber: string | null;
  confidenceScore: number;
  status: string;
  isCreditMemo: boolean;
  isChangeOrder: boolean;
  assignedPmId: string | null | undefined;
  pmUsers: Array<{ id: string; full_name: string }>;
  reassigning: boolean;
  onReassignPm: (pmId: string) => void;
}

export default function InvoiceHeader({
  vendorNameRaw,
  vendorId,
  vendor,
  invoiceNumber,
  confidenceScore,
  status,
  isCreditMemo,
  isChangeOrder,
  assignedPmId,
  pmUsers,
  reassigning,
  onReassignPm,
}: InvoiceHeaderProps) {
  return (
    <div className="border-b border-[var(--border-default)] bg-[rgba(91,134,153,0.04)] px-4 md:px-6 py-3 print:hidden">
      <div className="max-w-[1600px] mx-auto flex items-center gap-3 md:gap-4 flex-wrap">
        <Link href="/invoices/queue" className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors text-sm">&larr; Queue</Link>
        <h1 className="font-display text-base md:text-xl text-[color:var(--text-primary)] flex items-center gap-2 min-w-0">
          <span className="truncate">{vendorNameRaw ?? "Invoice"}</span>
          <VendorContactPopover
            vendorId={vendorId}
            vendorName={vendorNameRaw ?? vendor?.name ?? null}
            vendor={vendor}
          />
          <span className="text-[color:var(--text-secondary)] hidden md:inline">&mdash;</span>
          <span className="md:hidden"> </span>
          <span className="truncate">{invoiceNumber ?? "No #"}</span>
        </h1>
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${confidenceColor(confidenceScore)}`}>
          {Math.round(confidenceScore * 100)}% {confidenceLabel(confidenceScore)}
        </span>
        <span className={`inline-flex items-center text-xs px-3 py-1 font-medium ${statusBadgeOutline(status)}`}>
          {formatStatus(status)}
        </span>
        {isCreditMemo && (
          <span className="inline-flex items-center text-xs px-3 py-1 font-medium bg-transparent text-[color:var(--nw-stone-blue)] border border-[var(--nw-stone-blue)]">
            Credit Memo
          </span>
        )}
        {isChangeOrder && (
          <span className="inline-flex items-center text-xs px-3 py-1 font-medium bg-transparent text-[color:var(--nw-warn)] border border-[var(--nw-warn)]">
            Change Order
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--text-secondary)]">
          <span>PM:</span>
          <select
            value={assignedPmId ?? ""}
            onChange={(e) => onReassignPm(e.target.value)}
            disabled={reassigning}
            className="bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] px-2 py-1 focus:border-[var(--nw-stone-blue)] focus:outline-none disabled:opacity-50 cursor-pointer"
          >
            <option value="">Unassigned</option>
            {pmUsers.map(u => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </span>
        <button
          onClick={() => window.print()}
          className="ml-auto px-3 py-1 border border-[var(--border-default)] text-[color:var(--text-primary)] hover:bg-[var(--bg-muted)] text-xs uppercase tracking-[0.06em] transition-colors"
          aria-label="Print this invoice"
        >
          Print
        </button>
      </div>
    </div>
  );
}
