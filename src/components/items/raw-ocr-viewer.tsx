"use client";

import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import type { InvoiceExtractionRow } from "@/lib/cost-intelligence/types";

interface Props {
  extraction: InvoiceExtractionRow;
}

export default function RawOcrViewer({ extraction }: Props) {
  const fieldConfidences = extraction.field_confidences ?? {};
  const hasOcr = !!extraction.raw_ocr_text && extraction.raw_ocr_text.trim().length > 0;

  return (
    <div className="mb-4 border border-[var(--border-default)] bg-[var(--bg-subtle)]">
      <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between">
        <div>
          <NwEyebrow tone="muted">Raw OCR text + extraction metadata</NwEyebrow>
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            Captured by {extraction.extraction_model ?? "model unknown"}
            {extraction.extraction_prompt_version
              ? ` · prompt ${extraction.extraction_prompt_version}`
              : ""}
          </p>
        </div>
        {extraction.raw_pdf_url ? (
          <a
            href={extraction.raw_pdf_url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-nw-gulf-blue hover:underline"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            Open original →
          </a>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-0">
        <div className="p-4 border-r border-[var(--border-default)] max-h-[360px] overflow-auto">
          {hasOcr ? (
            <pre
              className="text-[11px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              {extraction.raw_ocr_text}
            </pre>
          ) : (
            <p className="text-[12px] text-[var(--text-tertiary)]">
              No raw OCR text captured. The invoice was parsed directly from the source PDF /
              image; line items hold the structured result. This field is populated when a
              text-extraction step runs before AI parsing.
            </p>
          )}
        </div>

        <div className="p-4 space-y-3">
          <NwEyebrow tone="muted">Field confidence</NwEyebrow>
          {Object.keys(fieldConfidences).length === 0 ? (
            <p className="text-[11px] text-[var(--text-tertiary)]">None recorded.</p>
          ) : (
            <ul className="space-y-1.5 text-[11px]">
              {Object.entries(fieldConfidences).map(([field, conf]) => (
                <li key={field} className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">{field}</span>
                  <NwBadge
                    size="sm"
                    variant={
                      conf >= 0.9 ? "success" : conf >= 0.75 ? "accent" : "warning"
                    }
                  >
                    {Math.round(conf * 100)}%
                  </NwBadge>
                </li>
              ))}
            </ul>
          )}

          {extraction.total_tokens_input != null || extraction.total_tokens_output != null ? (
            <div className="pt-2 border-t border-[var(--border-default)] text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.14em]" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
              {extraction.total_tokens_input ?? 0} in · {extraction.total_tokens_output ?? 0} out
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
