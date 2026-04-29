"use client";

import { useState } from "react";

/**
 * Phase 3.4 Issue 2 — schedule items display.
 *
 * Read-only display of the structured `schedule_items` JSONB column
 * extracted by the proposal extractor. Each item carries scope,
 * optional linked line number, optional sequencing, responsibility,
 * deliverables, and trigger. The full editor surface is deferred to
 * Phase 3.5 (the PO detail tab will surface and edit these); this
 * section just lets PMs verify what was extracted before they hit
 * commit, so nothing silently disappears between Claude Vision and
 * the database write.
 *
 * Self-contained: declares ScheduleItemForm locally.
 */

export interface ScheduleItemForm {
  scope_item: string;
  linked_line_number: number | null;
  estimated_start_date: string | null;
  estimated_duration_days: number | null;
  sequence_position: number | null;
  depends_on: number[];
  responsibility: string | null;
  deliverables: string[];
  trigger: string | null;
}

interface Props {
  items: ScheduleItemForm[] | null;
}

export default function ProposalScheduleItemsSection({ items }: Props) {
  const list = items ?? [];
  const [open, setOpen] = useState(list.length > 0);

  return (
    <section className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="text-sm font-semibold text-[color:var(--text-primary)] hover:underline"
        >
          {open ? "▼" : "▶"} Schedule items ({list.length})
        </button>
        <span className="text-[10px] uppercase tracking-[0.1em] font-mono text-[color:var(--text-tertiary)]">
          Read-only · Phase 3.5 owns the editor
        </span>
      </div>
      {open && (
        <>
          {list.length === 0 ? (
            <p className="text-xs text-[color:var(--text-tertiary)]">
              No schedule extracted. The extractor did not surface any
              structured scope/sequence items on this proposal.
            </p>
          ) : (
            <ol className="space-y-2 list-decimal list-inside">
              {list.map((item, idx) => (
                <li
                  key={idx}
                  className="rounded border border-[var(--border-default)] p-2 text-sm text-[color:var(--text-primary)]"
                >
                  <div className="font-medium">{item.scope_item || "(no scope)"}</div>
                  <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-[color:var(--text-secondary)]">
                    {item.linked_line_number !== null && (
                      <Cell label="Line">{item.linked_line_number}</Cell>
                    )}
                    {item.sequence_position !== null && (
                      <Cell label="Seq">{item.sequence_position}</Cell>
                    )}
                    {item.estimated_start_date && (
                      <Cell label="Start">{item.estimated_start_date}</Cell>
                    )}
                    {item.estimated_duration_days !== null && (
                      <Cell label="Duration">
                        {item.estimated_duration_days} days
                      </Cell>
                    )}
                    {item.responsibility && (
                      <Cell label="Responsibility">{item.responsibility}</Cell>
                    )}
                    {item.trigger && <Cell label="Trigger">{item.trigger}</Cell>}
                    {item.depends_on.length > 0 && (
                      <Cell label="Depends on">
                        {item.depends_on.join(", ")}
                      </Cell>
                    )}
                    {item.deliverables.length > 0 && (
                      <Cell label="Deliverables" full>
                        {item.deliverables.join(" · ")}
                      </Cell>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

function Cell({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <span className="text-[9px] uppercase tracking-[0.1em] font-mono text-[color:var(--text-tertiary)] mr-1.5">
        {label}
      </span>
      <span>{children}</span>
    </div>
  );
}
