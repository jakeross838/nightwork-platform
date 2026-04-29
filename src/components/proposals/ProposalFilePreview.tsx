"use client";

import PdfRenderer from "@/components/pdf-renderer";

/**
 * Phase 3.4 Issue 2 — proposal file preview.
 *
 * Thin wrapper over the shared PdfRenderer (which mounts react-pdf
 * with the local worker bundle). Matches the visual surface of
 * InvoiceFilePreview's PDF branch — the orchestrator wraps this in
 * the "Source document" card with the "Open in new tab" link, just
 * like the invoice review surface does.
 *
 * Proposals are PDF-only at ingest (Phase 3.2 classifier); image and
 * DOCX branches in InvoiceFilePreview don't apply, so we skip the
 * dispatcher and go straight to the canvas renderer.
 */
export default function ProposalFilePreview({
  fileUrl,
  downloadUrl,
  fileName,
}: {
  fileUrl: string | null | undefined;
  downloadUrl?: string | null;
  fileName?: string | null;
}) {
  if (!fileUrl) {
    return (
      <div className="h-48 xl:h-64 border border-[var(--border-default)] bg-[var(--bg-subtle)] flex items-center justify-center">
        <p className="text-[color:var(--text-secondary)] text-sm">
          No preview available
        </p>
      </div>
    );
  }
  return (
    <PdfRenderer
      fileUrl={fileUrl}
      downloadUrl={downloadUrl ?? fileUrl}
      fileName={fileName ?? null}
    />
  );
}
