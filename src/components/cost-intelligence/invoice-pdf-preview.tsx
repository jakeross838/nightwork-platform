"use client";

import { useState } from "react";

interface Props {
  fileUrl: string | null | undefined;
  invoiceId: string | null | undefined;
}

export default function InvoicePdfPreview({ fileUrl, invoiceId }: Props) {
  const [open, setOpen] = useState(false);
  if (!fileUrl) return null;
  const isPdf = /\.pdf(\?|$)/i.test(fileUrl);

  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        {open ? "▾ Hide invoice preview" : "▸ View invoice PDF"}
      </button>
      {open && (
        <div className="border border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden max-h-[400px]">
          {isPdf ? (
            <iframe
              src={fileUrl}
              title="Invoice PDF"
              className="w-full h-[400px]"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl} alt="Invoice" className="w-full max-h-[400px] object-contain" />
          )}
          {invoiceId && (
            <div className="border-t border-[var(--border-default)] px-3 py-2 text-[11px] text-[var(--text-tertiary)]">
              <a
                href={`/invoices/${invoiceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--nw-gulf-blue)] hover:underline"
              >
                Open full invoice →
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
