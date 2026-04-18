"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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

type FitMode = "width" | "page" | "manual";

/**
 * PDF preview using react-pdf (PDF.js under the hood). Renders as <canvas>.
 *
 * Controls: zoom in/out, fit-to-width, fit-to-page, expand-to-modal,
 * download original. The zoom stack works for inline and expanded views.
 *
 * Mobile: the expanded modal takes the full viewport and relies on the
 * browser's pinch-to-zoom for the page canvas.
 */
export default function PdfRenderer({ fileUrl, downloadUrl, fileName }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <PdfViewer
        fileUrl={fileUrl}
        downloadUrl={downloadUrl}
        fileName={fileName}
        onExpand={() => setExpanded(true)}
      />
      {expanded && (
        <div
          className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-2 md:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded PDF preview"
          onClick={(e) => {
            if (e.target === e.currentTarget) setExpanded(false);
          }}
        >
          <div className="bg-white w-full h-full md:w-[80vw] md:h-[85vh] flex flex-col shadow-2xl">
            <PdfViewer
              fileUrl={fileUrl}
              downloadUrl={downloadUrl}
              fileName={fileName}
              onClose={() => setExpanded(false)}
              fullscreen
            />
          </div>
        </div>
      )}
    </>
  );
}

function PdfViewer({
  fileUrl,
  downloadUrl,
  fileName,
  onExpand,
  onClose,
  fullscreen,
}: {
  fileUrl: string;
  downloadUrl?: string | null;
  fileName?: string | null;
  onExpand?: () => void;
  onClose?: () => void;
  fullscreen?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);
  const [containerHeight, setContainerHeight] = useState<number>(700);
  const [error, setError] = useState<string | null>(null);

  // Manual zoom scale (1 = native; changes when user uses +/-).
  const [scale, setScale] = useState<number>(1);
  const [fitMode, setFitMode] = useState<FitMode>("width");
  const [firstPageSize, setFirstPageSize] = useState<{ w: number; h: number } | null>(null);

  // Retry counter — PDF.js occasionally fails on first load when the signed
  // URL is fresh (transient 403). Up to 2 retries at 3s, reset on success.
  const [retryKey, setRetryKey] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);
  const MAX_RETRIES = 2;

  const handleLoadError = useCallback(
    (err: { message: string }) => {
      if (retryCount < MAX_RETRIES) {
        const next = retryCount + 1;
        const t = setTimeout(() => {
          setRetryCount(next);
          setRetryKey((k) => k + 1);
          setError(null);
        }, 3000);
        // Keep the loading spinner visible during the retry delay.
        return () => clearTimeout(t);
      }
      setError(err.message);
    },
    [retryCount]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        const h = Math.floor(entry.contentRect.height);
        if (w > 0) setContainerWidth(w);
        if (h > 0) setContainerHeight(h);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Width passed to react-pdf <Page />. In fit-width, fill the container.
  // In fit-page, scale so the first page fits both height & width. In
  // manual mode, multiply the base width by the scale.
  const pageWidth = (() => {
    const avail = containerWidth - 24;
    if (fitMode === "width") return avail;
    if (fitMode === "page" && firstPageSize) {
      const byHeight = (containerHeight - 24) * (firstPageSize.w / firstPageSize.h);
      return Math.min(avail, byHeight);
    }
    return Math.max(150, avail * scale);
  })();

  const zoomIn = useCallback(() => {
    setFitMode("manual");
    setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)));
  }, []);
  const zoomOut = useCallback(() => {
    setFitMode("manual");
    setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)));
  }, []);

  return (
    <div className={`border border-brand-border bg-brand-surface flex flex-col ${fullscreen ? "h-full" : ""}`}>
      <div className="flex items-center justify-between border-b border-brand-border bg-brand-surface px-3 py-2 gap-2 flex-wrap">
        <span className="text-[11px] tracking-[0.08em] uppercase text-cream-dim truncate pr-2 min-w-0 flex-1">
          PDF{fileName ? ` · ${fileName}` : ""}
          {numPages ? ` · ${numPages} page${numPages !== 1 ? "s" : ""}` : ""}
        </span>
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={zoomOut}
            className="px-2 py-1 text-sm text-cream-dim hover:text-cream border border-brand-border"
            aria-label="Zoom out"
            title="Zoom out"
          >
            &#8722;
          </button>
          <span className="px-2 text-[11px] text-cream-dim w-14 text-center tabular-nums">
            {fitMode === "width" ? "Fit W" : fitMode === "page" ? "Fit P" : `${Math.round(scale * 100)}%`}
          </span>
          <button
            type="button"
            onClick={zoomIn}
            className="px-2 py-1 text-sm text-cream-dim hover:text-cream border border-brand-border"
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              setFitMode("width");
              setScale(1);
            }}
            className={`px-2 py-1 text-[11px] border ${fitMode === "width" ? "bg-teal text-white border-teal" : "text-cream-dim border-brand-border"}`}
            title="Fit width"
          >
            Fit W
          </button>
          <button
            type="button"
            onClick={() => {
              setFitMode("page");
              setScale(1);
            }}
            className={`px-2 py-1 text-[11px] border ${fitMode === "page" ? "bg-teal text-white border-teal" : "text-cream-dim border-brand-border"}`}
            title="Fit page"
          >
            Fit P
          </button>
          {!fullscreen && onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="px-2 py-1 text-[11px] border border-brand-border text-cream-dim hover:text-cream ml-1"
              title="Expand"
              aria-label="Expand PDF"
            >
              &#x2922;
            </button>
          )}
          <a
            href={downloadUrl ?? fileUrl}
            download={fileName ?? undefined}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 border border-teal text-teal hover:bg-teal hover:text-white transition-colors whitespace-nowrap ml-1"
          >
            Download Original
          </a>
          {fullscreen && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 text-[11px] border border-brand-border text-cream-dim hover:text-cream ml-1"
              title="Close"
              aria-label="Close expanded PDF"
            >
              &#10007;
            </button>
          )}
        </div>
      </div>
      <div
        ref={containerRef}
        className={`${fullscreen ? "flex-1" : "max-h-[700px]"} overflow-auto p-3 bg-white`}
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
            key={retryKey}
            file={fileUrl}
            onLoadSuccess={({ numPages: n }) => {
              setNumPages(n);
              setRetryCount(0);
            }}
            onLoadError={handleLoadError}
            loading={
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-teal/30 border-t-teal animate-spin mx-auto" />
                <p className="mt-2 text-xs text-cream-dim">
                  {retryCount > 0 ? `Retrying (${retryCount}/${MAX_RETRIES})…` : "Loading PDF…"}
                </p>
              </div>
            }
          >
            {numPages &&
              Array.from({ length: numPages }, (_, i) => (
                <Page
                  key={`page_${i + 1}`}
                  pageNumber={i + 1}
                  width={pageWidth}
                  className="mb-3 shadow-sm"
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  onLoadSuccess={(page) => {
                    if (i === 0 && !firstPageSize) {
                      setFirstPageSize({ w: page.width, h: page.height });
                    }
                  }}
                />
              ))}
          </Document>
        )}
      </div>
    </div>
  );
}
