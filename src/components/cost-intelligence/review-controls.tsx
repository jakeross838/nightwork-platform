"use client";

import { useState } from "react";
import NwButton from "@/components/nw/Button";
import NwEyebrow from "@/components/nw/Eyebrow";
import { toast } from "@/lib/utils/toast";
import type { LineNature } from "./queue-types";

type ReclassifyTarget = "material" | "labor" | "scope" | "equipment" | "service";

const OPTIONS: Array<{ value: ReclassifyTarget; label: string }> = [
  { value: "material", label: "Materials" },
  { value: "labor", label: "Labor" },
  { value: "scope", label: "Scope" },
  { value: "equipment", label: "Equipment" },
  { value: "service", label: "Services" },
];

interface Props {
  lineId: string;
  currentNature: LineNature | null;
  onReclassified: (lineId: string) => void;
}

/**
 * Inline reclassify + skip controls shown at the top of the detail panel
 * when a line is unclassified. Moves the line out of the Review tab into
 * the selected nature tab, or skips it entirely (soft-deletes + records
 * on invoice_extractions.skipped_lines).
 */
export default function ReviewControls({
  lineId,
  currentNature,
  onReclassified,
}: Props) {
  const [target, setTarget] = useState<ReclassifyTarget>("material");
  const [busy, setBusy] = useState(false);

  if (currentNature !== "unclassified" && currentNature !== null) return null;

  const reclassify = async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/cost-intelligence/extraction-lines/${lineId}/reclassify`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ new_line_nature: target }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Status ${res.status}`);
      }
      toast.success(`Moved to ${target}`);
      onReclassified(lineId);
    } catch (err) {
      toast.error(`Reclassify failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    if (!confirm("Skip this line? It will be removed from the queue and preserved on the invoice's skipped_lines audit list.")) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/cost-intelligence/extraction-lines/${lineId}/skip`,
        { method: "PUT" }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Status ${res.status}`);
      }
      toast.success("Line skipped");
      onReclassified(lineId);
    } catch (err) {
      toast.error(`Skip failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border border-[var(--nw-warn)]/40 bg-[color:var(--nw-warn)]/5 p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <NwEyebrow tone="warn">Needs classification</NwEyebrow>
        <span className="text-[11px] text-[var(--text-tertiary)]">
          AI couldn&rsquo;t confidently assign a nature
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <label
          className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          Reclassify as
        </label>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value as ReclassifyTarget)}
          disabled={busy}
          className="h-[30px] px-2 border border-[var(--border-default)] bg-[var(--bg-main)] text-[13px] text-[var(--text-primary)]"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <NwButton variant="secondary" size="sm" onClick={reclassify} loading={busy}>
          Move
        </NwButton>
        <span className="flex-1" />
        <NwButton variant="ghost" size="sm" onClick={skip} loading={busy}>
          Skip this line
        </NwButton>
      </div>
    </section>
  );
}
