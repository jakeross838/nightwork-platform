"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import DOMPurify from "isomorphic-dompurify";
import { fileKindFromUrl } from "@/lib/invoices/display";

// Lazy, client-only — react-pdf uses Web Workers that don't SSR.
const PdfRenderer = dynamic(() => import("./pdf-renderer"), {
  ssr: false,
  loading: () => (
    <div className="border border-[var(--border-default)] bg-[var(--bg-subtle)] p-8 text-center">
      <div className="w-6 h-6 border-2 border-[rgba(91,134,153,0.3)] border-t-[var(--nw-stone-blue)] animate-spin mx-auto" />
      <p className="mt-2 text-xs text-[color:var(--text-secondary)]">Loading preview…</p>
    </div>
  ),
});

/**
 * Preview component that dispatches on file type.
 *   .pdf   → iframe (browser native viewer)
 *   .docx  → rendered HTML (fetched from /api/invoices/[id]/docx-html)
 *   .jpg/.png/.webp/.gif → <img> with click-to-zoom overlay
 *   unknown → download fallback
 *
 * Supports two modes:
 *   - full: large inline preview (used on invoice detail + upload results).
 *   - (no mode prop — default same as full).
 */
export default function InvoiceFilePreview({
  invoiceId,
  fileUrl,
  downloadUrl,
  fileName,
}: {
  /**
   * Required for DOCX rendering — we need an invoice id to hit the
   * /api/invoices/[id]/docx-html route. For the upload results view
   * we don't have an invoice id yet (not saved), so DOCX falls back
   * to a download link.
   */
  invoiceId?: string | null;
  /** Signed (or public) URL to the original file. Required for PDF/image. */
  fileUrl: string | null | undefined;
  /** Same as fileUrl by default; pass if you want a dedicated download link. */
  downloadUrl?: string | null;
  /** Filename shown in the download button label. */
  fileName?: string | null;
}) {
  const kind = fileKindFromUrl(fileUrl);

  if (!fileUrl) {
    return (
      <div className="h-48 xl:h-64 border border-[var(--border-default)] bg-[var(--bg-subtle)] flex items-center justify-center">
        <p className="text-[color:var(--text-secondary)] text-sm">No preview available</p>
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <PdfRenderer
        fileUrl={fileUrl}
        downloadUrl={downloadUrl ?? fileUrl}
        fileName={fileName ?? null}
      />
    );
  }

  if (kind === "image") {
    return (
      <ImagePreview
        src={fileUrl}
        alt={fileName ?? "Invoice image"}
        downloadUrl={downloadUrl ?? fileUrl}
        fileName={fileName ?? null}
      />
    );
  }

  if (kind === "docx") {
    return (
      <DocxPreview
        invoiceId={invoiceId ?? null}
        downloadUrl={downloadUrl ?? fileUrl}
        fileName={fileName ?? "invoice.docx"}
      />
    );
  }

  // unknown / xlsx — just let them download.
  return <UnknownPreview downloadUrl={downloadUrl ?? fileUrl} fileName={fileName ?? "invoice"} />;
}

/** ---------------- Image preview with click-to-zoom + expand ---------------- */
function ImagePreview({ src, alt, downloadUrl, fileName }: { src: string; alt: string; downloadUrl?: string | null; fileName?: string | null }) {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!zoomed) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setZoomed(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [zoomed]);

  return (
    <>
      {/* Document surface stays white — paper metaphor, intentional across themes. */}
      <div className="border border-[var(--border-default)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2">
          <span className="text-[11px] tracking-[0.08em] uppercase text-[color:var(--text-secondary)] truncate pr-2">
            Image{fileName ? ` · ${fileName}` : ""}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoomed(true)}
              className="px-2 py-1 text-[11px] border border-[var(--border-default)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
              title="Expand"
              aria-label="Expand image"
            >
              &#x2922;
            </button>
            <a
              href={downloadUrl ?? src}
              download={fileName ?? undefined}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 border border-[var(--nw-stone-blue)] text-[color:var(--nw-stone-blue)] hover:bg-[var(--nw-stone-blue)] hover:text-[color:var(--nw-white-sand)] transition-colors whitespace-nowrap"
            >
              Download Original
            </a>
          </div>
        </div>
        {/* Document surface stays white — paper metaphor, intentional across themes. */}
        <button
          type="button"
          onClick={() => setZoomed(true)}
          className="block w-full cursor-zoom-in bg-white"
          aria-label="Zoom image"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="w-full h-auto max-h-[700px] object-contain" />
        </button>
      </div>
      {zoomed && (
        <div
          className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-2 md:p-6 cursor-zoom-out touch-manipulation overflow-auto"
          onClick={() => setZoomed(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Image fullscreen"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain shadow-xl"
            style={{ touchAction: "pinch-zoom" }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setZoomed(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-sm px-3 py-1 border border-white/40"
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}

/** ---------------- DOCX preview with HTML render ---------------- */
function DocxPreview({
  invoiceId,
  downloadUrl,
  fileName,
}: {
  invoiceId: string | null;
  downloadUrl: string;
  fileName: string;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!invoiceId) {
      setLoading(false);
      return () => {};
    }
    async function fetchHtml() {
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/docx-html`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setHtml(data.html as string);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Render failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchHtml();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  const header = (
    <div className="flex items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 gap-2">
      <span className="text-[11px] tracking-[0.08em] uppercase text-[color:var(--text-secondary)] truncate">
        DOCX · {fileName}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="px-2 py-1 text-[11px] border border-[var(--border-default)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
          title={expanded ? "Collapse" : "Expand"}
          aria-label={expanded ? "Collapse DOCX" : "Expand DOCX"}
        >
          {expanded ? "\u10007" : "\u2922"}
        </button>
        <a
          href={downloadUrl}
          download={fileName}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 border border-[var(--nw-stone-blue)] text-[color:var(--nw-stone-blue)] hover:bg-[var(--nw-stone-blue)] hover:text-[color:var(--nw-white-sand)] transition-colors"
        >
          Download Original
        </a>
      </div>
    </div>
  );

  const body = (
    <div className={`${expanded ? "flex-1" : "max-h-[700px]"} overflow-auto p-6 text-sm text-[color:var(--text-primary)] leading-relaxed docx-html`}>
      {loading && <p className="text-[color:var(--text-secondary)] text-sm">Rendering DOCX…</p>}
      {error && (
        <p className="text-[color:var(--nw-danger)] text-sm">
          DOCX render failed: {error}. Use Download Original to open the file.
        </p>
      )}
      {!loading && !error && html !== null && (
        // XSS guard: DOMPurify strips <script>, on*= handlers, and javascript: URLs.
        // Mammoth output is otherwise treated as untrusted (vendor-supplied DOCX).
        <div
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }),
          }}
        />
      )}
      {!loading && !error && html === null && !invoiceId && (
        <p className="text-[color:var(--text-secondary)] text-sm">
          DOCX preview is only available after the invoice is saved.
          Use Download Original to view it now.
        </p>
      )}
    </div>
  );

  if (expanded) {
    return (
      <div
        className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-2 md:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Expanded DOCX preview"
        onClick={(e) => {
          if (e.target === e.currentTarget) setExpanded(false);
        }}
      >
        {/* Document surface stays white — paper metaphor, intentional across themes. */}
        <div className="bg-white w-full h-full md:w-[80vw] md:h-[85vh] flex flex-col shadow-2xl">
          {header}
          {body}
        </div>
      </div>
    );
  }

  return (
    // Document surface stays white — paper metaphor, intentional across themes.
    <div className="border border-[var(--border-default)] bg-white">
      {header}
      {body}
    </div>
  );
}

/** ---------------- Unknown file fallback ---------------- */
function UnknownPreview({ downloadUrl, fileName }: { downloadUrl: string; fileName: string }) {
  return (
    <div className="border border-[var(--border-default)] bg-[var(--bg-subtle)] p-6 flex flex-col items-center gap-3 text-center">
      <svg className="w-10 h-10 text-[color:var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
      <p className="text-sm text-[color:var(--text-primary)]">Preview not available</p>
      <a
        href={downloadUrl}
        download={fileName}
        className="inline-flex items-center gap-1 text-[12px] px-3 py-1.5 border border-[var(--nw-stone-blue)] text-[color:var(--nw-stone-blue)] hover:bg-[var(--nw-stone-blue)] hover:text-[color:var(--nw-white-sand)] transition-colors"
      >
        Download {fileName}
      </a>
    </div>
  );
}
