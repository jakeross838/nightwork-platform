import type { HTMLAttributes, ReactNode } from "react";

export type BadgeVariant =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent";

export type BadgeSize = "sm" | "md";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
}

// Bordered status pill — never filled (per non-negotiable #7).
// Border + text share the color; background is transparent or a very subtle tint.
//
// Theme awareness: neutral uses semantic --text-primary so it adapts;
// success/warning/danger/info/accent use raw nw-* hues which are designed
// to read on both bgs (per Slate refs).
const VARIANT_STYLES: Record<BadgeVariant, { color: string; tint: string }> = {
  neutral: {
    color: "var(--text-primary)",
    tint: "transparent",
  },
  success: {
    color: "var(--nw-success)",
    tint: "rgba(74, 138, 111, 0.06)",
  },
  warning: {
    color: "var(--nw-warn)",
    tint: "rgba(201, 138, 59, 0.06)",
  },
  danger: {
    color: "var(--nw-danger)",
    tint: "rgba(176, 85, 78, 0.06)",
  },
  info: {
    color: "var(--nw-gulf-blue)",
    tint: "rgba(78, 122, 140, 0.06)",
  },
  accent: {
    color: "var(--nw-stone-blue)",
    tint: "rgba(91, 134, 153, 0.06)",
  },
};

const SIZE_STYLES: Record<BadgeSize, string> = {
  sm: "h-[20px] px-[6px] text-[10px]",
  md: "h-[24px] px-2 text-[11px]",
};

export default function Badge({
  variant = "neutral",
  size = "sm",
  className,
  children,
  ...rest
}: BadgeProps) {
  const tone = VARIANT_STYLES[variant];

  return (
    <span
      className={[
        "inline-flex items-center justify-center",
        "border uppercase font-medium leading-none whitespace-nowrap",
        SIZE_STYLES[size],
        className ?? "",
      ].join(" ")}
      style={{
        fontFamily: "var(--font-jetbrains-mono)",
        letterSpacing: "0.14em",
        color: tone.color,
        borderColor: tone.color,
        backgroundColor: tone.tint,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
