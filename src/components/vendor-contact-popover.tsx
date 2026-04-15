"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type VendorDetail = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

type Props = {
  vendorId: string | null;
  vendorName: string | null;
  /** Optional extra class for the trigger icon. */
  className?: string;
};

/**
 * Small info icon next to the vendor name. On hover (desktop) or tap (mobile),
 * shows a popover with phone / email / address. Empty state links to the
 * vendor edit page.
 */
export default function VendorContactPopover({ vendorId, vendorName, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
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

  useEffect(() => {
    if (!open || loaded || !vendorId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("vendors")
        .select("id, name, phone, email, address")
        .eq("id", vendorId)
        .maybeSingle();
      if (!cancelled) {
        setVendor(data as VendorDetail | null);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loaded, vendorId]);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => setOpen(true)}
        aria-label="Vendor contact info"
        aria-expanded={open}
        aria-haspopup="true"
        className={`inline-flex items-center justify-center w-5 h-5 text-cream-dim hover:text-cream transition-colors ${className}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v.01M12 11v5" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-2 z-[60] w-64 bg-brand-card border border-brand-border shadow-lg p-3 text-sm animate-fade-up"
          onMouseLeave={() => setOpen(false)}
        >
          <p className="font-medium text-cream truncate">{vendor?.name ?? vendorName ?? "Vendor"}</p>
          {!vendorId && (
            <p className="text-xs text-cream-dim mt-2">
              This invoice&rsquo;s vendor is not linked to a vendor record.
            </p>
          )}
          {vendorId && !loaded && (
            <p className="text-xs text-cream-dim mt-2">Loading…</p>
          )}
          {vendorId && loaded && (
            <div className="mt-2 space-y-1.5 text-xs">
              {vendor?.phone ? (
                <a href={`tel:${vendor.phone}`} className="flex items-center gap-2 text-teal hover:underline">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75a2.25 2.25 0 012.25-2.25h2.25a1.5 1.5 0 011.5 1.5v2.25a1.5 1.5 0 01-1.5 1.5H5.25a12 12 0 0013.5 13.5v-1.5a1.5 1.5 0 011.5-1.5h2.25a1.5 1.5 0 011.5 1.5v2.25a2.25 2.25 0 01-2.25 2.25A19.5 19.5 0 012.25 6.75z" />
                  </svg>
                  {vendor.phone}
                </a>
              ) : null}
              {vendor?.email ? (
                <a href={`mailto:${vendor.email}`} className="flex items-center gap-2 text-teal hover:underline break-all">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5A2.25 2.25 0 0119.5 19.5h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75-9.75-6.75" />
                  </svg>
                  {vendor.email}
                </a>
              ) : null}
              {vendor?.address ? (
                <div className="flex items-start gap-2 text-cream-muted">
                  <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z" />
                  </svg>
                  <span>{vendor.address}</span>
                </div>
              ) : null}
              {!vendor?.phone && !vendor?.email && !vendor?.address && (
                <p className="text-cream-dim">
                  No contact info.{" "}
                  <Link
                    href={`/vendors/${vendor?.id ?? ""}`}
                    className="text-teal hover:underline"
                  >
                    Add &rarr;
                  </Link>
                </p>
              )}
              {(vendor?.phone || vendor?.email || vendor?.address) && (
                <div className="pt-1.5 mt-1.5 border-t border-brand-border">
                  <Link
                    href={`/vendors/${vendor?.id ?? ""}`}
                    className="text-[11px] text-teal hover:underline"
                  >
                    Edit vendor &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
