"use client";

import dynamic from "next/dynamic";

// Load the inner react-pdf viewer client-side only. pdfjs-dist touches
// browser globals (DOMMatrix, worker URL) at module load, which blows up
// under Next's SSR otherwise.
const InvoicePdfPreviewInner = dynamic(() => import("./invoice-pdf-preview-inner"), {
  ssr: false,
  loading: () => null,
});

interface Props {
  fileUrl: string | null | undefined;
  invoiceId: string | null | undefined;
  /** 1-indexed page to jump to when the preview is opened. Defaults to 1. */
  pageNumber?: number | null;
  /** Text from the selected extraction line to highlight on the page. */
  highlightText?: string | null;
}

export default function InvoicePdfPreview(props: Props) {
  return <InvoicePdfPreviewInner {...props} />;
}
