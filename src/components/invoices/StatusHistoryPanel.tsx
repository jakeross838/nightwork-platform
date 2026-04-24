"use client";

import { formatStatus, formatWho, formatDateTime } from "@/lib/utils/format";

function statusDotColor(newStatus: string): string {
  if (["pm_approved", "qa_approved", "pushed_to_qb", "in_draw", "paid"].includes(newStatus)) return "bg-[var(--nw-success)]";
  if (["pm_held", "info_requested"].includes(newStatus)) return "bg-[var(--nw-warn)]";
  if (["pm_denied", "qa_kicked_back", "void"].includes(newStatus)) return "bg-[var(--nw-danger)]";
  return "bg-[var(--nw-stone-blue)]"; // forward progress: pm_review, qa_review, ai_processed
}

export interface StatusHistoryPanelProps {
  history: Array<Record<string, unknown>>;
  userNames: Map<string, string>;
}

export default function StatusHistoryPanel({ history, userNames }: StatusHistoryPanelProps) {
  return (
    <div className="space-y-0">
      {[...history].reverse().map((entry, i) => {
        const newStatus = String(entry.new_status);
        return (
          <div key={i} className="relative pl-6 pb-4 last:pb-0">
            {i < history.length - 1 && (
              <div className="absolute left-[7px] top-3 bottom-0 w-px bg-[var(--border-default)]" />
            )}
            <div className={`absolute left-0 top-1 w-[15px] h-[15px] border-2 border-[var(--bg-card)] ${statusDotColor(newStatus)}`} />
            <div className="text-xs">
              <p className="text-[color:var(--text-primary)] font-medium">
                {formatStatus(String(entry.old_status))} &rarr; {formatStatus(newStatus)}
              </p>
              <p className="text-[color:var(--text-secondary)] mt-0.5">
                {formatWho(String(entry.who), userNames)} &mdash; {formatDateTime(String(entry.when))}
              </p>
              {entry.note ? <p className="text-[color:var(--text-secondary)]/80 mt-1 italic text-[11px] leading-relaxed">{String(entry.note)}</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
