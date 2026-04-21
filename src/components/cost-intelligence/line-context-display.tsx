"use client";

import NwEyebrow from "@/components/nw/Eyebrow";
import NwMoney from "@/components/nw/Money";
import type { QueueLine } from "./queue-types";

interface Props {
  line: QueueLine;
}

export default function LineContextDisplay({ line }: Props) {
  const tax = line.line_tax_cents ?? 0;
  const overhead = line.overhead_allocated_cents ?? 0;
  const hasExtras = tax > 0 || overhead > 0;

  return (
    <section className="space-y-2">
      <NwEyebrow tone="muted">From invoice</NwEyebrow>

      <div
        className="border border-[var(--border-default)] bg-[var(--bg-card)] p-3 text-[13px] text-[var(--text-primary)]"
        style={{ fontFamily: "var(--font-jetbrains-mono)", whiteSpace: "pre-wrap" }}
      >
        {line.raw_description}
      </div>

      <div className="grid grid-cols-3 gap-3 text-[11px]">
        <Stat label="Qty">
          <span
            className="text-[var(--text-secondary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {line.raw_quantity ?? "—"} {line.raw_unit_text ?? ""}
          </span>
        </Stat>
        <Stat label="Unit price">
          <NwMoney cents={line.raw_unit_price_cents} size="sm" />
        </Stat>
        <Stat label="Line total">
          <NwMoney cents={line.raw_total_cents} size="sm" variant="emphasized" />
        </Stat>
      </div>

      {hasExtras && (
        <div
          className="flex gap-4 text-[11px] text-[var(--text-tertiary)]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          {tax > 0 && (
            <span>
              Tax allocated: <NwMoney cents={tax} size="sm" />
            </span>
          )}
          {overhead > 0 && (
            <span>
              Overhead allocated: <NwMoney cents={overhead} size="sm" />
            </span>
          )}
        </div>
      )}

      {line.match_reasoning && (
        <div className="border border-[var(--border-default)] p-2 text-[12px] text-[var(--text-secondary)] italic bg-[var(--bg-card)]">
          <span
            className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] mr-2 not-italic"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            AI said
          </span>
          {line.match_reasoning}
        </div>
      )}
    </section>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        {label}
      </div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
