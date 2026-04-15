"use client";

import { useMemo, useState } from "react";

type StatusEntry = {
  who?: unknown;
  when?: unknown;
  old_status?: unknown;
  new_status?: unknown;
  note?: unknown;
};

type Props = {
  currentStatus: string;
  history: Array<Record<string, unknown>>;
};

const STANDARD_FLOW: Array<{ key: string; label: string }> = [
  { key: "received", label: "Received" },
  { key: "pm_review", label: "PM Review" },
  { key: "pm_approved", label: "PM Approved" },
  { key: "qa_review", label: "QA Review" },
  { key: "qa_approved", label: "QA Approved" },
  { key: "in_draw", label: "In Draw" },
  { key: "paid", label: "Paid" },
];

// Aliases fold onto the canonical flow node.
const ALIAS: Record<string, string> = {
  ai_processed: "pm_review",
  pushed_to_qb: "in_draw",
};

const BRANCH_COLORS: Record<string, string> = {
  pm_held: "bg-brass",
  pm_denied: "bg-status-danger",
  qa_kicked_back: "bg-status-danger",
  void: "bg-status-danger",
  info_requested: "bg-brass",
};

function statusColor(key: string): string {
  if (["received", "pm_review", "qa_review"].includes(key)) return "bg-teal";
  if (["pm_approved", "qa_approved"].includes(key)) return "bg-status-success";
  if (key === "in_draw") return "bg-teal";
  if (key === "paid") return "bg-status-success";
  return "bg-teal";
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function InvoiceStatusTimeline({ currentStatus, history }: Props) {
  const stages = useMemo(() => {
    // Resolve canonical status key (apply alias).
    const canonicalCurrent = ALIAS[currentStatus] ?? currentStatus;

    // Walk history to figure out which stages have been reached.
    const reached = new Set<string>();
    const stageEntries = new Map<string, StatusEntry>();

    for (const entry of history) {
      const raw = String((entry as StatusEntry).new_status ?? "");
      const canonical = ALIAS[raw] ?? raw;
      reached.add(canonical);
      // Keep the LAST entry that landed on this stage.
      stageEntries.set(canonical, entry as StatusEntry);
    }
    reached.add(canonicalCurrent);

    // Every invoice starts at "received" even if not explicit in history.
    reached.add("received");

    return STANDARD_FLOW.map((stage, idx) => {
      const isCurrent = stage.key === canonicalCurrent;
      const isPast = reached.has(stage.key) && !isCurrent;
      const entry = stageEntries.get(stage.key) ?? null;
      return {
        ...stage,
        isCurrent,
        isPast,
        entry,
        idx,
      };
    });
  }, [currentStatus, history]);

  // Branch entries (denied/held/kicked back/info requested/void)
  const branches = useMemo(() => {
    return history
      .filter((e) => {
        const ns = String((e as StatusEntry).new_status ?? "");
        return ns in BRANCH_COLORS;
      })
      .slice(-3) // only show the last few branches to avoid clutter
      .map((e) => e as StatusEntry);
  }, [history]);

  return (
    <div className="border border-brand-border bg-brand-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider brass-underline">
          Status Timeline
        </p>
      </div>

      {/* Horizontal timeline (desktop) */}
      <div className="hidden md:block">
        <div className="flex items-start relative pt-3">
          {stages.map((stage, i) => (
            <div key={stage.key} className="flex-1 flex flex-col items-center relative min-w-0">
              {/* Connector line (left side) */}
              {i > 0 && (
                <div
                  className={`absolute top-[11px] left-0 right-1/2 h-px ${
                    stage.isPast || stage.isCurrent
                      ? "bg-teal"
                      : "border-t border-dashed border-brand-border"
                  }`}
                  style={
                    !stage.isPast && !stage.isCurrent
                      ? { height: 0, borderTop: "1px dashed var(--border-default)" }
                      : {}
                  }
                />
              )}
              {/* Connector line (right side) */}
              {i < stages.length - 1 && (
                <div
                  className={`absolute top-[11px] left-1/2 right-0 h-px ${
                    stage.isPast
                      ? "bg-teal"
                      : "border-t border-dashed border-brand-border"
                  }`}
                  style={
                    !stage.isPast
                      ? { height: 0, borderTop: "1px dashed var(--border-default)" }
                      : {}
                  }
                />
              )}
              <TimelineDot stage={stage} />
              <div className="mt-2 text-[10px] text-center text-cream-dim leading-tight px-1">
                {stage.label}
                {stage.entry?.when ? (
                  <div className="mt-0.5 text-[9px] text-cream-dim/70">
                    {formatDateTime(String(stage.entry.when))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Branch indicators */}
        {branches.length > 0 && (
          <div className="mt-4 pt-3 border-t border-brand-border flex flex-wrap gap-2">
            {branches.map((b, i) => {
              const ns = String(b.new_status ?? "");
              const color = BRANCH_COLORS[ns] ?? "bg-brand-border";
              return (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] ${color} text-white`}
                  title={String(b.note ?? "")}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
                  {ns.replace(/_/g, " ")} — {formatDateTime(String(b.when ?? ""))}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Vertical timeline (mobile) */}
      <div className="md:hidden">
        <div className="flex flex-col space-y-0">
          {stages.map((stage, i) => (
            <div key={stage.key} className="relative pl-6 pb-3 last:pb-0">
              {i < stages.length - 1 && (
                <div
                  className={`absolute left-[7px] top-4 bottom-0 w-px ${
                    stage.isPast ? "bg-teal" : "border-l border-dashed border-brand-border"
                  }`}
                  style={
                    !stage.isPast
                      ? { width: 0, borderLeft: "1px dashed var(--border-default)" }
                      : {}
                  }
                />
              )}
              <div className="absolute left-0 top-0.5">
                <TimelineDot stage={stage} />
              </div>
              <div className="text-xs">
                <p className={`font-medium ${stage.isCurrent ? "text-cream" : stage.isPast ? "text-cream-muted" : "text-cream-dim"}`}>
                  {stage.label}
                </p>
                {stage.entry?.when ? (
                  <p className="text-cream-dim text-[10px] mt-0.5">
                    {formatDateTime(String(stage.entry.when))}
                    {stage.entry.who ? ` — ${String(stage.entry.who)}` : ""}
                  </p>
                ) : null}
                {stage.entry?.note ? (
                  <p className="text-cream-dim/80 mt-1 italic text-[10px] leading-relaxed">
                    {String(stage.entry.note)}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {branches.length > 0 && (
          <div className="mt-3 pt-3 border-t border-brand-border space-y-1.5">
            {branches.map((b, i) => {
              const ns = String(b.new_status ?? "");
              const color = BRANCH_COLORS[ns] ?? "bg-brand-border";
              return (
                <div key={i} className={`flex items-center gap-2 px-2 py-1 ${color} text-white text-[10px]`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
                  <span>
                    {ns.replace(/_/g, " ")} — {formatDateTime(String(b.when ?? ""))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineDot({
  stage,
}: {
  stage: {
    key: string;
    label: string;
    isCurrent: boolean;
    isPast: boolean;
    entry: StatusEntry | null;
  };
}) {
  const [hovered, setHovered] = useState(false);

  const base = statusColor(stage.key);
  const size = stage.isCurrent ? "w-5 h-5" : stage.isPast ? "w-4 h-4" : "w-4 h-4";
  const fill = stage.isCurrent
    ? `${base} border-2 border-white shadow`
    : stage.isPast
      ? `${base} border border-white/80`
      : "bg-transparent border-2 border-brand-border";
  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`${size} ${fill} rounded-full z-10`} />
      {hovered && stage.entry && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-30 bg-brand-bg/95 border border-brand-border p-2 text-[11px] text-cream min-w-[180px] shadow-lg pointer-events-none">
          <p className="font-medium">{stage.label}</p>
          {stage.entry.when ? (
            <p className="text-cream-dim mt-0.5">
              {formatDateTime(String(stage.entry.when))}
              {stage.entry.who ? ` — ${String(stage.entry.who)}` : ""}
            </p>
          ) : null}
          {stage.entry.note ? (
            <p className="text-cream-dim/80 mt-1 italic leading-relaxed">
              {String(stage.entry.note)}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
