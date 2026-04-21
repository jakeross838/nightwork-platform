"use client";

import { useMemo } from "react";
import VendorGroup from "./vendor-group";
import QueueItem from "./queue-item";
import type { QueueLine, QueueTab } from "./queue-types";

// Selection is always a single line now — same-item batching was removed
// per user feedback that it hid detail needed for confident verification.
export type QueueSelection = { kind: "single"; line_id: string };

interface Props {
  tab: QueueTab;
  lines: QueueLine[];
  selection: QueueSelection | null;
  onSelect: (selection: QueueSelection | null) => void;
}

export default function VerificationQueue({
  tab,
  lines,
  selection,
  onSelect,
}: Props) {
  const byVendor = useMemo(() => {
    const map = new Map<string, { name: string; lines: QueueLine[] }>();
    for (const l of lines) {
      const vid = l.invoice?.vendor_id ?? "no-vendor";
      const name = l.invoice?.vendor_name ?? "(no vendor)";
      const existing = map.get(vid);
      if (existing) existing.lines.push(l);
      else map.set(vid, { name, lines: [l] });
    }
    return Array.from(map.entries())
      .map(([id, val]) => ({ id, name: val.name, lines: val.lines }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [lines]);

  if (lines.length === 0) {
    return (
      <div className="flex-1 min-h-[400px] flex items-center justify-center p-8">
        <div className="text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 border border-[var(--border-default)] bg-[var(--bg-subtle)] mb-3 text-[var(--nw-success)]"
            aria-hidden="true"
          >
            ✓
          </div>
          <p
            className="text-[14px] tracking-[-0.01em] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Nothing here
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-tertiary)] max-w-[260px]">
            {tab === "review"
              ? "No lines pending classification. The AI placed everything in a nature tab."
              : "All caught up on this type."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        {byVendor.map((v) => {
          const subtotal = v.lines.reduce(
            (s, l) => s + (l.raw_total_cents ?? 0),
            0
          );
          return (
            <VendorGroup
              key={v.id}
              vendorName={v.name}
              lineCount={v.lines.length}
              subtotalCents={subtotal}
              defaultOpen={true}
            >
              {v.lines.map((line) => (
                <QueueItem
                  key={line.id}
                  selection={{ kind: "single", line_id: line.id }}
                  isSelected={
                    selection?.kind === "single" && selection.line_id === line.id
                  }
                  onSelect={() => onSelect({ kind: "single", line_id: line.id })}
                  line={line}
                />
              ))}
            </VendorGroup>
          );
        })}
      </div>
    </div>
  );
}
