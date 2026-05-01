import type { HTMLAttributes, ReactNode } from "react";

export type EyebrowTone = "default" | "accent" | "warn" | "success" | "danger" | "muted";

export interface EyebrowProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: EyebrowTone;
  icon?: ReactNode;
  children: ReactNode;
}

// JetBrains Mono 10px UPPERCASE 0.14em — the single most-repeated motif in
// the design system. Per skill rule #6: eyebrow appears above every section.
//
// Theme awareness: default + muted use semantic tokens so the eyebrow
// reads correctly on both bgs. Colored tones (accent/warn/success/danger)
// keep their nw-* hue — the design system uses these as a fixed signal
// regardless of theme.
const TONE_COLORS: Record<EyebrowTone, string> = {
  default: "var(--text-primary)",
  accent: "var(--nw-stone-blue)",
  warn: "var(--nw-warn)",
  success: "var(--nw-success)",
  danger: "var(--nw-danger)",
  muted: "var(--text-tertiary)",
};

export default function Eyebrow({
  tone = "muted",
  icon,
  className,
  children,
  ...rest
}: EyebrowProps) {
  // Inline styles use direction-aware CSS vars with non-direction fallbacks
  // so NwEyebrow stays visually identical outside .design-system-scope (the
  // fallback values match the historic UPPERCASE / 0.14em / mono / normal
  // contract). Inside .design-system-scope, the layout's data-direction
  // attribute resolves --eyebrow-* vars to per-direction values; the
  // attribute-selector override in design-system.css is also applied as a
  // safety net for `data-slot="eyebrow"`. Color stays driven by the tone.
  return (
    <span
      data-slot="eyebrow"
      className={[
        "inline-flex items-center gap-1.5",
        "font-medium leading-none",
        "text-[10px]",
        className ?? "",
      ].join(" ")}
      style={{
        fontFamily: "var(--eyebrow-font-family, var(--font-jetbrains-mono))",
        letterSpacing: "var(--eyebrow-letter-spacing, 0.14em)",
        // CSS vars in textTransform / fontStyle aren't typed by React.
        // Cast via `as` on the value rather than the property to keep the
        // surrounding object well-typed.
        textTransform: "var(--eyebrow-text-transform, uppercase)" as unknown as React.CSSProperties["textTransform"],
        fontStyle: "var(--eyebrow-font-style, normal)" as unknown as React.CSSProperties["fontStyle"],
        color: TONE_COLORS[tone],
      }}
      {...rest}
    >
      {icon ? <span className="inline-flex items-center">{icon}</span> : null}
      {children}
    </span>
  );
}
