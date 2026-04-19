import type { HTMLAttributes, ReactNode } from "react";

export type CardVariant = "default" | "inverse";
export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  children: ReactNode;
}

// White card on sand page (default), or slate-deep dark variant for the
// right-rail / inverse contexts seen in the Slate Invoice Detail reference.
// Square corners, thin slate border, no shadow by default.
//
// Theme awareness: default uses semantic --bg-card / --text-primary /
// --border-default so it adapts. Inverse intentionally hardcodes
// slate-deep + white-sand — it's a "dark island" element that stays dark
// even when the page is in light mode (e.g. an invoice's detail rail
// rendered next to a light overview).
const PADDING_STYLES: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
};

const VARIANT_STYLES: Record<CardVariant, string> = {
  default:
    "bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-default)]",
  inverse: "bg-nw-slate-deep text-nw-white-sand border-[rgba(247,245,236,0.08)]",
};

export default function Card({
  variant = "default",
  padding = "md",
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        "border",
        PADDING_STYLES[padding],
        VARIANT_STYLES[variant],
        className ?? "",
      ].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
