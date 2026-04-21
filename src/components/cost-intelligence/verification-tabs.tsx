"use client";

import type { QueueTab } from "./queue-types";

const TABS: Array<{ id: QueueTab; label: string }> = [
  { id: "materials", label: "Materials" },
  { id: "labor", label: "Labor" },
  { id: "scope", label: "Scope" },
  { id: "equipment", label: "Equipment" },
  { id: "services", label: "Services" },
  { id: "review", label: "Review" },
];

interface Props {
  active: QueueTab;
  counts: Record<QueueTab, number>;
  onChange: (tab: QueueTab) => void;
}

export default function VerificationTabs({ active, counts, onChange }: Props) {
  return (
    <div className="flex items-end gap-1 border-b border-[var(--border-default)]">
      {TABS.map((t) => {
        const isActive = active === t.id;
        const count = counts[t.id] ?? 0;
        const reviewNeedsAttention = t.id === "review" && count > 0;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-2 px-4 h-[40px] text-[12px] border-b-[2px] -mb-px transition-colors ${
              isActive
                ? "border-[var(--nw-stone-blue)] text-[var(--text-primary)]"
                : reviewNeedsAttention
                ? "border-transparent text-[var(--nw-warn)] hover:text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span
              className="uppercase tracking-[0.14em] text-[10px]"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              {t.label}
            </span>
            <span
              className={`inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 text-[10px] border ${
                isActive
                  ? "border-[var(--nw-stone-blue)] text-[var(--nw-stone-blue)]"
                  : reviewNeedsAttention
                  ? "border-[var(--nw-warn)] text-[var(--nw-warn)]"
                  : "border-[var(--border-default)] text-[var(--text-tertiary)]"
              }`}
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
