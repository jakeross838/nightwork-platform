"use client";

import NwMoney from "@/components/nw/Money";
import { COMPONENT_TYPE_LABELS, type QueueLine } from "./queue-types";

type Selection = { kind: "single"; line_id: string };

interface Props {
  selection: Selection;
  isSelected: boolean;
  onSelect: () => void;
  line: QueueLine;
}

export default function QueueItem({
  isSelected,
  onSelect,
  line,
}: Props) {
  const accentStyle = isSelected
    ? "border-l-[4px] border-l-[var(--nw-stone-blue)] bg-[var(--bg-subtle)]"
    : "border-l-[4px] border-l-transparent hover:bg-[var(--bg-subtle)]";

  const itemType = line.proposed_item_data?.item_type;
  const firstComponent = line.components[0];
  const isScope = line.proposed_pricing_model === "scope";
  const scopeValue = line.extracted_scope_size_value;
  const scopeMetric = line.proposed_scope_size_metric;
  const lineTotal = line.raw_total_cents ?? 0;
  const perMetricCents =
    isScope && scopeValue && scopeValue > 0 ? Math.round(lineTotal / scopeValue) : null;

  return (
    <div
      className={`w-full border-b border-[var(--border-default)] transition-colors ${accentStyle}`}
    >
      <div className="flex items-start gap-2 px-3 py-3">
        <button type="button" onClick={onSelect} className="flex-1 min-w-0 text-left">
          <div
            className="text-[12px] text-[var(--text-primary)] truncate"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            title={line.raw_description}
          >
            {line.raw_description}
          </div>
          <div
            className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {itemType ?? "—"} ·{" "}
            {isScope ? (
              <span className="text-[var(--nw-stone-blue)]">scope</span>
            ) : (
              line.raw_unit_text ?? "each"
            )}
            {!isScope && firstComponent && firstComponent.component_type !== "material" && (
              <> · {COMPONENT_TYPE_LABELS[firstComponent.component_type]}</>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div
              className="text-[12px] text-[var(--text-primary)]"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <NwMoney cents={line.raw_total_cents} size="sm" />
              {isScope && perMetricCents != null && scopeMetric && (
                <span className="text-[var(--text-tertiary)]">
                  {" "}
                  ·{" "}
                  <span className="text-[var(--text-secondary)]">
                    <NwMoney cents={perMetricCents} size="sm" />/{scopeMetric.replace(/_/g, " ")}
                  </span>
                </span>
              )}
              {isScope && perMetricCents == null && (
                <span className="text-[var(--nw-warn)]"> · scope size needed</span>
              )}
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
