"use client";

import { useState } from "react";
import NwMoney from "@/components/nw/Money";

interface Props {
  vendorName: string;
  lineCount: number;
  subtotalCents: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function VendorGroup({
  vendorName,
  lineCount,
  subtotalCents,
  defaultOpen = true,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-[var(--border-default)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-[var(--bg-subtle)] hover:bg-[var(--bg-subtle)]/80"
      >
        <span
          className="w-[14px] text-[12px] text-[var(--text-tertiary)]"
          aria-hidden="true"
        >
          {open ? "▾" : "▸"}
        </span>
        <span
          className="flex-1 min-w-0 text-[13px] text-[var(--text-primary)] text-left truncate"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          {vendorName}
        </span>
        <span className="text-[11px] text-[var(--text-tertiary)] shrink-0">
          {lineCount} line{lineCount === 1 ? "" : "s"}
        </span>
        <span
          className="text-[12px] text-[var(--text-secondary)] shrink-0"
          style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
        >
          <NwMoney cents={subtotalCents} size="sm" />
        </span>
      </button>
      {open && <div>{children}</div>}
    </section>
  );
}
