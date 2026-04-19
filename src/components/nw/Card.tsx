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
const PADDING_STYLES: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
};

const VARIANT_STYLES: Record<CardVariant, string> = {
  default: "bg-white text-nw-slate-tile border-[rgba(59,88,100,0.15)]",
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
