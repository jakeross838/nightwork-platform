"use client";

import { formatFlag, confidenceColor } from "@/lib/utils/format";

export interface AiConfidenceBreakdownProps {
  confidenceDetails: Record<string, number> & { auto_fills?: Record<string, boolean> };
}

export default function AiConfidenceBreakdown({ confidenceDetails }: AiConfidenceBreakdownProps) {
  return (
    <div className="space-y-2">
      {Object.entries(confidenceDetails)
        .filter(([f, s]) => f !== "auto_fills" && typeof s === "number")
        .map(([field, score]) => (
          <div key={field} className="flex items-center justify-between text-sm">
            <span className="text-[color:var(--text-muted)]">{formatFlag(field)}</span>
            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${confidenceColor(score as number)}`}>{Math.round((score as number) * 100)}%</span>
          </div>
        ))}
    </div>
  );
}
