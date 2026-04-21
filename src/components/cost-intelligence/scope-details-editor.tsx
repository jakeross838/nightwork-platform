"use client";

import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwMoney from "@/components/nw/Money";
import { COMMON_SCOPE_METRICS, type ClassificationDraft } from "./queue-types";

interface Props {
  draft: ClassificationDraft;
  lineTotalCents: number;
  onChange: (next: ClassificationDraft) => void;
  /** Confidence badge is only meaningful when the AI extracted the size. */
  aiExtractedConfidence: number | null;
}

export default function ScopeDetailsEditor({
  draft,
  lineTotalCents,
  onChange,
  aiExtractedConfidence,
}: Props) {
  const sizeNumeric = Number.parseFloat(draft.scope_size_value);
  const hasValidSize = Number.isFinite(sizeNumeric) && sizeNumeric > 0;
  const perMetricCents = hasValidSize ? Math.round(lineTotalCents / sizeNumeric) : null;

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <NwEyebrow tone="accent">Scope details</NwEyebrow>
        <span className="text-[11px] text-[var(--text-tertiary)]">
          Size metric makes this comparable across vendors
        </span>
      </div>

      <div className="border border-[var(--border-default)] bg-[var(--bg-card)] p-3 space-y-3">
        <div className="grid grid-cols-[160px_1fr_110px] gap-2 items-end">
          <label className="block">
            <div
              className="mb-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              Size metric
            </div>
            <input
              list="scope-size-metrics"
              type="text"
              value={draft.scope_size_metric}
              onChange={(e) =>
                onChange({ ...draft, scope_size_metric: e.target.value })
              }
              placeholder="roof_sf"
              className="w-full px-3 h-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[12px] text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            />
            <datalist id="scope-size-metrics">
              {COMMON_SCOPE_METRICS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>

          <label className="block">
            <div
              className="mb-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              Size value
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={draft.scope_size_value}
              onChange={(e) => {
                onChange({
                  ...draft,
                  scope_size_value: e.target.value,
                  // PM edited manually — override source unless AI/job
                  scope_size_source:
                    draft.scope_size_source === "manual" ? "manual" : "manual",
                });
              }}
              placeholder="2400"
              className="w-full px-3 h-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[12px] text-right text-[var(--text-primary)]"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontVariantNumeric: "tabular-nums",
              }}
            />
          </label>

          <div className="text-right pb-1">
            <div
              className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              $/metric
            </div>
            <div
              className="mt-1 text-[13px] text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)", fontVariantNumeric: "tabular-nums" }}
            >
              {perMetricCents != null ? (
                <NwMoney cents={perMetricCents} size="sm" variant="emphasized" />
              ) : (
                <span className="text-[var(--text-tertiary)]">—</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          {draft.scope_size_source === "invoice_extraction" && aiExtractedConfidence != null && (
            <NwBadge variant="accent" size="sm">
              AI extracted · {Math.round((aiExtractedConfidence ?? 0) * 100)}%
            </NwBadge>
          )}
          {draft.scope_size_source === "manual" && (
            <NwBadge variant="neutral" size="sm">
              Manual entry
            </NwBadge>
          )}
          {draft.scope_size_source === "job_characteristics" && (
            <NwBadge variant="info" size="sm">
              From job characteristics
            </NwBadge>
          )}
          {draft.scope_size_source == null && !hasValidSize && (
            <NwBadge variant="warning" size="sm">
              Scope size needed
            </NwBadge>
          )}
        </div>

        {!hasValidSize && (
          <div className="border border-[var(--nw-warn)]/40 bg-[color:var(--nw-warn)]/5 p-2 text-[11px] text-[var(--text-secondary)]">
            Without a scope size, this pricing won&rsquo;t be comparable in benchmarks. You can
            save now and fill this in later from the Scope Data view.
          </div>
        )}
      </div>
    </section>
  );
}
