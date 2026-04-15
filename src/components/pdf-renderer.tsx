"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Serve the worker locally from /public so we don't depend on a CDN.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

interface Props {
  fileUrl: string;
  downloadUrl?: string | null;
  fileName?: string | null;
}

/**
 * PDF preview using react-pdf (PDF.js under the hood). Rendering as <canvas>
 * works in every browser regardless of whether the native PDF viewer is
 * available — no iframe / object embed quirks. Page width fits the
 * container so it's legible without manual zoom.
 */
export default function PdfRenderer({ fileUrl, downloadUrl, fileName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [width, setWidth] = useState<number>(600);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) setWidth(w);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="border border-brand-border bg-brand-surface">
      <div className="flex items-center justify-between border-b border-brand-border bg-brand-surface px-3 py-2">
        <span className="text-[11px] tracking-[0.08em] uppercase text-cream-dim truncate pr-2">
          PDF{fileName ? ` · ${fileName}` : ""}
          {numPages ? ` · ${numPages} page${numPages !== 1 ? "s" : ""}` : ""}
        </span>
        <a
          href={downloadUrl ?? fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 border border-teal text-teal hover:bg-teal hover:text-white transition-colors whitespace-nowrap"
        >
          Open in New Tab
        </a>
      </div>
      <div
        ref={containerRef}
        className="max-h-[700px] overflow-auto p-3 bg-white"
      >
        {error ? (
          <div className="p-4 text-center text-sm text-status-danger">
            <p className="font-medium">Preview failed</p>
            <p className="mt-1 text-xs">{error}</p>
            <a
              href={downloadUrl ?? fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 px-3 py-1.5 border border-teal text-teal hover:bg-teal hover:text-white text-xs font-medium transition-colors"
            >
              Open PDF in new tab
            </a>
          </div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={(err) => setError(err.message)}
            loading={
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-teal/30 border-t-teal animate-spin mx-auto" />
                <p className="mt-2 text-xs text-cream-dim">Loading PDF…</p>
              </div>
            }
          >
            {numPages &&
              Array.from({ length: numPages }, (_, i) => (
                <Page
                  key={`page_${i + 1}`}
                  pageNumber={i + 1}
                  width={width - 24}
                  className="mb-3 shadow-sm"
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />
              ))}
          </Document>
        )}
      </div>
    </div>
  );
}
