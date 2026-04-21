"use client";

import NwMoney from "@/components/nw/Money";
import NwButton from "@/components/nw/Button";
import NwBadge from "@/components/nw/Badge";
import type { LineGroup } from "@/lib/cost-intelligence/group-extraction-lines";
import { COMPONENT_TYPE_LABELS, type QueueLine } from "./queue-types";

type Selection =
  | { kind: "group"; key: string }
  | { kind: "single"; line_id: string };

interface Props {
  selection: Selection;
  isSelected: boolean;
  onSelect: () => void;
  line?: QueueLine;
  group?: LineGroup<QueueLine>;
  /** For flagged + notes tabs. */
  checkbox?: {
    checked: boolean;
    onToggle: () => void;
  } | null;
}

export default function QueueItem({
  selection,
  isSelected,
  onSelect,
  line,
  group,
  checkbox,
}: Props) {
  const accentStyle = isSelected
    ? "border-l-[4px] border-l-[var(--nw-stone-blue)] bg-[var(--bg-subtle)]"
    : "border-l-[4px] border-l-transparent hover:bg-[var(--bg-subtle)]";

  if (selection.kind === "group" && group) {
    const firstLine = group.lines[0];
    const itemType = firstLine?.proposed_item_data?.item_type ?? "material";
    const isScope = firstLine?.proposed_pricing_model === "scope";
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`w-full text-left px-3 py-3 border-b border-[var(--border-default)] transition-colors ${accentStyle}`}
      >
        <div className="flex items-start gap-2">
          <span
            className="mt-0.5 inline-flex items-center justify-center w-[22px] h-[18px] px-1 text-[10px] text-[var(--nw-stone-blue)] border border-[var(--nw-stone-blue)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            ⊞
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span
                className="text-[12px] uppercase tracking-[0.12em] text-[var(--nw-stone-blue)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                {group.occurrence_count} similar
              </span>
              <span className="text-[11px] text-[var(--text-tertiary)] truncate">
                &ldquo;{group.fingerprint_name}&rdquo;
              </span>
            </div>
            <div
              className="mt-1 text-[11px] text-[var(--text-secondary)] uppercase tracking-[0.12em]"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              {itemType} ·{" "}
              {isScope ? (
                <span className="text-[var(--nw-stone-blue)]">scope</span>
              ) : (
                group.unit ?? "each"
              )}
            </div>
            <div
              className="mt-1 text-[12px] text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
            >
              {!isScope && group.unit_price_range &&
              group.unit_price_range.min === group.unit_price_range.max ? (
                <>
                  <NwMoney cents={group.unit_price_range.min} size="sm" /> each ·{" "}
                </>
              ) : !isScope && group.unit_price_range ? (
                <>
                  <NwMoney cents={group.unit_price_range.min} size="sm" /> –{" "}
                  <NwMoney cents={group.unit_price_range.max} size="sm" /> each ·{" "}
                </>
              ) : null}
              <NwMoney cents={group.total_across_occurrences} size="sm" variant="emphasized" /> total
              {isScope && (
                <span className="text-[var(--nw-warn)]"> · scope size needed per line</span>
              )}
            </div>
            <div className="mt-2">
              <NwButton variant="primary" size="sm" onClick={onSelect}>
                Review as group
              </NwButton>
            </div>
          </div>
        </div>
      </button>
    );
  }

  if (selection.kind === "single" && line) {
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
          {checkbox && (
            <input
              type="checkbox"
              checked={checkbox.checked}
              onChange={(e) => {
                e.stopPropagation();
                checkbox.onToggle();
              }}
              className="mt-1 h-[14px] w-[14px] shrink-0"
              aria-label="Select line"
            />
          )}
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
              {line.is_transaction_line && line.transaction_line_type && (
                <NwBadge variant="neutral" size="sm">
                  {line.transaction_line_type.replace(/_/g, " ")}
                </NwBadge>
              )}
            </div>
          </button>
        </div>
      </div>
    );
  }

  return null;
}
