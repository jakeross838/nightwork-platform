"use client";

export interface AiParsedRawPanelProps {
  vendorNameRaw: string | null;
  jobReferenceRaw: string | null;
  poReferenceRaw: string | null;
  coReferenceRaw: string | null;
}

export default function AiParsedRawPanel({
  vendorNameRaw,
  jobReferenceRaw,
  poReferenceRaw,
  coReferenceRaw,
}: AiParsedRawPanelProps) {
  return (
    <div className="border-t border-[var(--border-default)] pt-4">
      <p className="text-[11px] text-[color:var(--text-secondary)] mb-2 uppercase tracking-wider">AI Parsed (raw)</p>
      <div className="grid grid-cols-2 gap-2 text-xs text-[color:var(--text-secondary)]">
        <div>Vendor: {vendorNameRaw ?? "—"}</div>
        <div>Job Ref: {jobReferenceRaw ?? "—"}</div>
        <div>PO Ref: {poReferenceRaw ?? "—"}</div>
        <div>CO Ref: {coReferenceRaw ?? "—"}</div>
      </div>
    </div>
  );
}
