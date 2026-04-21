"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/TextLayer.css";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";

// pdfjs ships its worker as a separate file we serve from /public so the
// browser fetches it same-origin — no CORS, no mixed-content, no CDN
// availability concerns. The copy in /public must match the pdfjs-dist
// version that react-pdf resolves (a postinstall copy script keeps them
// in sync on install).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

interface Props {
  fileUrl: string | null | undefined;
  invoiceId: string | null | undefined;
  pageNumber?: number | null;
  highlightText?: string | null;
}

const MIN_MATCH_LEN = 3;
const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c] ?? c);

// Normalize for match comparison — lowercase + collapse whitespace. Keeps
// punctuation intact because invoice descriptions carry meaningful tokens
// like "1/4" and "1-1/2".
function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export default function InvoicePdfPreviewInner({
  fileUrl,
  invoiceId,
  pageNumber,
  highlightText,
}: Props) {
  const [open, setOpen] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState<number>(pageNumber && pageNumber > 0 ? pageNumber : 1);

  useEffect(() => {
    if (pageNumber && pageNumber > 0) setCurrentPage(pageNumber);
  }, [pageNumber]);

  useEffect(() => {
    // Clamp if the document turns out to have fewer pages than requested.
    if (numPages > 0 && currentPage > numPages) setCurrentPage(numPages);
  }, [numPages, currentPage]);

  const needle = useMemo(() => normalize(highlightText ?? ""), [highlightText]);
  const hasHighlight = needle.length >= MIN_MATCH_LEN;

  // customTextRenderer wraps the portion of each text item that overlaps
  // with the line's raw_description with <mark class="nw-highlight">. We
  // return HTML (react-pdf injects via innerHTML), so every untrusted
  // substring must pass through escapeHtml first. Matching is fuzzy: we
  // look for the PDF's text-item string inside the normalized highlight
  // needle (either direction) so that multi-chunk text layers still get
  // highlighted piece by piece.
  const customTextRenderer = useCallback(
    ({ str }: { str: string }): string => {
      if (!hasHighlight) return escapeHtml(str);
      const nStr = normalize(str);
      if (nStr.length < MIN_MATCH_LEN) return escapeHtml(str);
      if (needle.includes(nStr) || nStr.includes(needle)) {
        return `<mark class="nw-highlight">${escapeHtml(str)}</mark>`;
      }
      return escapeHtml(str);
    },
    [needle, hasHighlight]
  );

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
        <div className="border border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden">
          {isPdf ? (
            <>
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-default)] bg-[var(--bg-subtle)]">
                <div
                  className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  {numPages > 0 ? `Page ${currentPage} of ${numPages}` : "Loading…"}
                </div>
                {numPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="w-[26px] h-[24px] inline-flex items-center justify-center border border-[var(--border-default)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Previous page"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                      disabled={currentPage >= numPages}
                      className="w-[26px] h-[24px] inline-flex items-center justify-center border border-[var(--border-default)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Next page"
                    >
                      →
                    </button>
                  </div>
                )}
              </div>
              <div className="max-h-[500px] overflow-auto flex justify-center bg-[var(--bg-subtle)] p-3">
                <Document
                  file={fileUrl}
                  onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                  loading={
                    <div className="p-6 text-[12px] text-[var(--text-tertiary)]">Loading PDF…</div>
                  }
                  error={
                    <div className="p-6 text-[12px] text-[color:var(--status-danger)]">
                      Failed to load PDF
                    </div>
                  }
                >
                  <Page
                    pageNumber={currentPage}
                    width={600}
                    customTextRenderer={customTextRenderer}
                    renderAnnotationLayer={false}
                  />
                </Document>
              </div>
              {hasHighlight && (
                <div
                  className="px-3 py-1.5 border-t border-[var(--border-default)] text-[11px] text-[var(--text-tertiary)] truncate"
                  title={highlightText ?? undefined}
                >
                  Highlighted: <span className="text-[var(--text-secondary)]">{highlightText}</span>
                </div>
              )}
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl} alt="Invoice" className="w-full max-h-[500px] object-contain" />
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
