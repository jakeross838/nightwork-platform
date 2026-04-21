"use client";

import Link from "next/link";
import NwEyebrow from "@/components/nw/Eyebrow";
import { relativeTimeLabel, type LearningEntry } from "@/lib/cost-intelligence/recent-learnings";

interface RecentLearningsPanelProps {
  learnings: LearningEntry[];
}

function IconForType({ type }: { type: LearningEntry["type"] }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  if (type === "alias") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M2 6h4M6 6l-2-2M6 6l-2 2M10 6h-4" />
      </svg>
    );
  }
  if (type === "correction") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M2.5 8.5l2-2M4.5 6.5l4-4 1 1-4 4zM2.5 10h7" />
      </svg>
    );
  }
  // conversion
  return (
    <svg {...common} aria-hidden="true">
      <path d="M3 3h6M3 6h6M3 9h6M10 5v-2l-1 1M10 9v2l-1-1" />
    </svg>
  );
}

export default function RecentLearningsPanel({ learnings }: RecentLearningsPanelProps) {
  return (
    <section className="border border-[var(--border-default)] bg-[var(--bg-card)] p-5 h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <NwEyebrow tone="accent">AI Improvement</NwEyebrow>
          <h2
            className="mt-1 text-[18px] tracking-[-0.02em] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Recent Learnings
          </h2>
        </div>
      </div>

      {learnings.length === 0 ? (
        <p className="mt-4 text-[13px] text-[var(--text-secondary)]">
          As you verify items and confirm conversions, the system learns your vendor patterns.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-[var(--border-default)]">
          {learnings.map((l) => (
            <li key={l.id} className="py-3 first:pt-0">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 shrink-0 inline-flex items-center justify-center w-6 h-6 border"
                  style={{
                    color: "var(--text-tertiary)",
                    borderColor: "var(--border-default)",
                    background: "var(--bg-subtle)",
                  }}
                  aria-label={l.type}
                >
                  <IconForType type={l.type} />
                </span>
                <div className="flex-1 min-w-0">
                  {l.link_href ? (
                    <Link
                      href={l.link_href}
                      className="block text-[13px] text-[var(--text-primary)] hover:text-nw-gulf-blue hover:underline"
                    >
                      {l.display_text}
                    </Link>
                  ) : (
                    <span className="block text-[13px] text-[var(--text-primary)]">
                      {l.display_text}
                    </span>
                  )}
                  <div
                    className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  >
                    {relativeTimeLabel(l.timestamp)}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
