"use client";

import { useMemo } from "react";
import VendorGroup from "./vendor-group";
import QueueItem from "./queue-item";
import NwButton from "@/components/nw/Button";
import { groupExtractionLines } from "@/lib/cost-intelligence/group-extraction-lines";
import type { QueueLine, QueueTab } from "./queue-types";

export type QueueSelection =
  | { kind: "group"; key: string; line_ids: string[] }
  | { kind: "single"; line_id: string };

interface Props {
  tab: QueueTab;
  lines: QueueLine[];
  selection: QueueSelection | null;
  onSelect: (selection: QueueSelection | null) => void;
  /** For flagged + notes tabs only. */
  bulkState?: {
    selectedIds: Set<string>;
    onToggle: (lineId: string) => void;
    onSelectAllVisible: (ids: string[]) => void;
    onDismissSelected: () => void;
    onDismissAll: () => void;
    busy: boolean;
  };
}

export default function VerificationQueue({
  tab,
  lines,
  selection,
  onSelect,
  bulkState,
}: Props) {
  const isFlatTab = tab === "flagged" || tab === "notes";

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
            {tab === "flagged"
              ? "No flagged transaction lines right now."
              : tab === "notes"
              ? "No $0 notes pending."
              : "All caught up on this type."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {bulkState && (
        <BulkBar
          visibleIds={lines.map((l) => l.id)}
          selectedIds={bulkState.selectedIds}
          onSelectAllVisible={() => bulkState.onSelectAllVisible(lines.map((l) => l.id))}
          onDismissSelected={bulkState.onDismissSelected}
          onDismissAll={bulkState.onDismissAll}
          busy={bulkState.busy}
          tab={tab}
        />
      )}

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
              {isFlatTab ? (
                v.lines.map((line) => (
                  <QueueItem
                    key={line.id}
                    selection={{ kind: "single", line_id: line.id }}
                    isSelected={
                      selection?.kind === "single" && selection.line_id === line.id
                    }
                    onSelect={() =>
                      onSelect({ kind: "single", line_id: line.id })
                    }
                    line={line}
                    checkbox={
                      bulkState
                        ? {
                            checked: bulkState.selectedIds.has(line.id),
                            onToggle: () => bulkState.onToggle(line.id),
                          }
                        : null
                    }
                  />
                ))
              ) : (
                <GroupedVendorLines
                  lines={v.lines}
                  selection={selection}
                  onSelect={onSelect}
                />
              )}
            </VendorGroup>
          );
        })}
      </div>
    </div>
  );
}

function GroupedVendorLines({
  lines,
  selection,
  onSelect,
}: {
  lines: QueueLine[];
  selection: QueueSelection | null;
  onSelect: (selection: QueueSelection | null) => void;
}) {
  const grouped = useMemo(() => groupExtractionLines(lines), [lines]);

  return (
    <div>
      {grouped.groups.map((g) => (
        <QueueItem
          key={g.key}
          selection={{
            kind: "group",
            key: g.key,
          }}
          isSelected={selection?.kind === "group" && selection.key === g.key}
          onSelect={() =>
            onSelect({
              kind: "group",
              key: g.key,
              line_ids: g.lines.map((l) => l.id),
            })
          }
          group={g}
        />
      ))}
      {grouped.singles.map((line) => (
        <QueueItem
          key={line.id}
          selection={{ kind: "single", line_id: line.id }}
          isSelected={selection?.kind === "single" && selection.line_id === line.id}
          onSelect={() => onSelect({ kind: "single", line_id: line.id })}
          line={line}
        />
      ))}
    </div>
  );
}

function BulkBar({
  visibleIds,
  selectedIds,
  onSelectAllVisible,
  onDismissSelected,
  onDismissAll,
  busy,
  tab,
}: {
  visibleIds: string[];
  selectedIds: Set<string>;
  onSelectAllVisible: () => void;
  onDismissSelected: () => void;
  onDismissAll: () => void;
  busy: boolean;
  tab: QueueTab;
}) {
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-default)] bg-[var(--bg-subtle)]">
      <label className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] cursor-pointer">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onSelectAllVisible}
          className="h-[14px] w-[14px]"
        />
        Select all visible
      </label>
      <span className="flex-1" />
      {selectedIds.size > 0 && (
        <NwButton
          variant="secondary"
          size="sm"
          onClick={onDismissSelected}
          loading={busy}
        >
          Dismiss {selectedIds.size}
        </NwButton>
      )}
      <NwButton
        variant="ghost"
        size="sm"
        onClick={onDismissAll}
        loading={busy}
        disabled={busy || visibleIds.length === 0}
      >
        Dismiss all {tab}
      </NwButton>
    </div>
  );
}
