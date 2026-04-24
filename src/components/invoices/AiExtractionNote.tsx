"use client";

import NwEyebrow from "@/components/nw/Eyebrow";
import { formatFlag } from "@/lib/utils/format";

export interface AiExtractionNoteProps {
  confidenceScore: number;
  confidenceDetails:
    | (Record<string, number> & { auto_fills?: Record<string, boolean> })
    | null;
  flags: string[];
  aiModelUsed?: string;
}

export default function AiExtractionNote({
  confidenceScore,
  confidenceDetails,
  flags,
  aiModelUsed,
}: AiExtractionNoteProps) {
  const conf = confidenceDetails ?? {};
  const fields = Object.entries(conf).filter(
    ([k, v]) => k !== "auto_fills" && typeof v === "number"
  );
  const autoFills = (confidenceDetails as Record<string, unknown> | null)
    ?.auto_fills as Record<string, boolean> | undefined;
  const autoFillCount = autoFills
    ? Object.values(autoFills).filter(Boolean).length
    : 0;

  const narrative = (() => {
    const parts: string[] = [];
    if (autoFillCount > 0) {
      parts.push(
        `${autoFillCount} field${autoFillCount === 1 ? "" : "s"} auto-filled by Claude.`
      );
    }
    if (fields.length > 0) {
      const avg = fields.reduce((s, [, v]) => s + (v as number), 0) / fields.length;
      parts.push(
        `Per-field confidence avg ${(avg * 100).toFixed(0)}% across ${fields.length} extracted field${fields.length === 1 ? "" : "s"}.`
      );
    }
    if (flags.length > 0) {
      parts.push(
        `Flags raised: ${flags.map((f) => formatFlag(f)).join(", ")}.`
      );
    }
    if (parts.length === 0) {
      parts.push("Extracted by Claude. No additional metadata recorded.");
    }
    return parts.join(" ");
  })();

  const overallConfPct = (confidenceScore * 100).toFixed(1);

  return (
    <div
      className="mt-4 p-4 border"
      style={{
        background: "rgba(91,134,153,0.08)",
        borderColor: "rgba(91,134,153,0.3)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-block w-1.5 h-1.5"
          style={{ background: "var(--nw-stone-blue)" }}
          aria-hidden="true"
        />
        <NwEyebrow tone="accent">AI Extraction · {aiModelUsed ?? "Claude"}</NwEyebrow>
      </div>
      <p
        className="m-0 text-[13px] leading-relaxed"
        style={{ color: "var(--text-primary)" }}
      >
        {narrative}
      </p>
      <div
        className="mt-2 text-[11px]"
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          letterSpacing: "0.04em",
          color: "var(--text-tertiary)",
        }}
      >
        CONFIDENCE{" "}
        <b
          style={{
            color:
              confidenceScore >= 0.85
                ? "var(--nw-success)"
                : confidenceScore >= 0.7
                  ? "var(--nw-warn)"
                  : "var(--nw-danger)",
          }}
        >
          {overallConfPct}%
        </b>
        {aiModelUsed ? <> · MODEL {aiModelUsed.toUpperCase()}</> : null}
      </div>
    </div>
  );
}
