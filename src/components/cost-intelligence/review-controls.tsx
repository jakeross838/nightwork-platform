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
  lineIds: string[];
  currentNature: LineNature | null;
  onReclassified: (lineIds: string[]) => void;
}

/**
 * Inline reclassify + skip controls shown at the top of the detail panel
 * when a line is unclassified. Moves the line out of the Review tab into
 * the selected nature tab, or skips it entirely (soft-deletes + records
 * on document_extractions.skipped_lines).
 *
 * When multiple lineIds are passed (group selection), the action loops
 * over all of them — the group queue view bundles identical-text lines,
 * so applying the same nature to the whole set is the expected behavior.
 */
export default function ReviewControls({
  lineIds,
  currentNature,
  onReclassified,
}: Props) {
  const [target, setTarget] = useState<ReclassifyTarget>("material");
  const [busy, setBusy] = useState(false);

  if (currentNature !== "unclassified" && currentNature !== null) return null;
  if (lineIds.length === 0) return null;

  const isGroup = lineIds.length > 1;

  const reclassify = async () => {
    setBusy(true);
    const success: string[] = [];
    const failures: string[] = [];
    try {
      for (const id of lineIds) {
        const res = await fetch(
          `/api/cost-intelligence/extraction-lines/${id}/reclassify`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ new_line_nature: target }),
          }
        );
        if (res.ok) success.push(id);
        else failures.push(id);
      }
      toast.success(
        `Moved ${success.length}${failures.length ? ` · ${failures.length} failed` : ""} to ${target}`
      );
      if (success.length > 0) onReclassified(success);
    } catch (err) {
      toast.error(`Reclassify failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    const message = isGroup
      ? `Skip all ${lineIds.length} lines in this group? They'll be removed from the queue and preserved on the invoices' skipped_lines audit list.`
      : "Skip this line? It will be removed from the queue and preserved on the invoice's skipped_lines audit list.";
    if (!confirm(message)) return;
    setBusy(true);
    const success: string[] = [];
    const failures: string[] = [];
    try {
      for (const id of lineIds) {
        const res = await fetch(
          `/api/cost-intelligence/extraction-lines/${id}/skip`,
          { method: "PUT" }
        );
        if (res.ok) success.push(id);
        else failures.push(id);
      }
      toast.success(
        `Skipped ${success.length}${failures.length ? ` · ${failures.length} failed` : ""}`
      );
      if (success.length > 0) onReclassified(success);
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
          {isGroup
            ? `Applies to all ${lineIds.length} lines in this group`
            : "AI couldn’t confidently assign a nature"}
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
          {isGroup ? `Move all ${lineIds.length}` : "Move"}
        </NwButton>
        <span className="flex-1" />
        <NwButton variant="ghost" size="sm" onClick={skip} loading={busy}>
          {isGroup ? `Skip all ${lineIds.length}` : "Skip this line"}
        </NwButton>
      </div>
    </section>
  );
}
