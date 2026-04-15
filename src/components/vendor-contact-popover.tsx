"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export type VendorDetail = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

type Props = {
  vendorId: string | null;
  vendorName: string | null;
  /**
   * Prefetched vendor contact info (from the invoice detail API join).
   * Preferred over fetching: avoids a second query and any RLS surprise.
   */
  vendor?: VendorDetail | null;
};

/**
 * Info icon next to the vendor name. On click (or hover), opens a popover
 * with phone / email / address. Empty state links to the vendor edit page.
 * Matches the spec: Part H of Phase 8e.
 */
export default function VendorContactPopover({
  vendorId,
  vendorName,
  vendor = null,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const hasContact = !!(vendor?.phone || vendor?.email || vendor?.address);
  const editHref = vendor?.id ? `/vendors/${vendor.id}` : "/vendors";

  return (
    <span ref={ref} className="relative inline-flex items-center align-middle">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Vendor contact info"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Vendor contact info"
        className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-brand-border bg-brand-surface text-cream-dim hover:text-teal hover:border-teal transition-colors"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v.01M12 11v5" />
        </svg>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Vendor contact info"
          className="absolute left-0 top-full mt-2 z-[90] w-72 bg-brand-card border border-brand-border shadow-xl p-3 text-sm animate-fade-up"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-medium text-cream truncate">
            {vendor?.name ?? vendorName ?? "Vendor"}
          </p>
          {!vendorId && (
            <p className="text-xs text-cream-dim mt-2">
              This invoice isn&rsquo;t linked to a vendor record yet.
            </p>
          )}
          {vendorId && !hasContact && (
            <p className="text-xs text-cream-dim mt-2 leading-relaxed">
              No contact info.{" "}
              <Link
                href={editHref}
                className="text-teal hover:underline font-medium"
              >
                Add &rarr;
              </Link>
            </p>
          )}
          {vendorId && hasContact && (
            <div className="mt-2 space-y-2 text-xs">
              {vendor?.phone && (
                <a
                  href={`tel:${vendor.phone}`}
                  className="flex items-center gap-2 text-teal hover:underline"
                >
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 6.75a2.25 2.25 0 012.25-2.25h2.25a1.5 1.5 0 011.5 1.5v2.25a1.5 1.5 0 01-1.5 1.5H5.25a12 12 0 0013.5 13.5v-1.5a1.5 1.5 0 011.5-1.5h2.25a1.5 1.5 0 011.5 1.5v2.25a2.25 2.25 0 01-2.25 2.25A19.5 19.5 0 012.25 6.75z"
                    />
                  </svg>
                  {vendor.phone}
                </a>
              )}
              {vendor?.email && (
                <a
                  href={`mailto:${vendor.email}`}
                  className="flex items-center gap-2 text-teal hover:underline break-all"
                >
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5A2.25 2.25 0 0119.5 19.5h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75-9.75-6.75"
                    />
                  </svg>
                  {vendor.email}
                </a>
              )}
              {vendor?.address && (
                <div className="flex items-start gap-2 text-cream-muted">
                  <svg
                    className="w-3.5 h-3.5 shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z"
                    />
                  </svg>
                  <span className="leading-relaxed">{vendor.address}</span>
                </div>
              )}
              <div className="pt-2 mt-2 border-t border-brand-border">
                <Link
                  href={editHref}
                  className="text-[11px] text-teal hover:underline"
                >
                  Edit vendor &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
