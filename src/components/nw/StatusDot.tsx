import type { HTMLAttributes } from "react";

export type StatusDotVariant = "active" | "pending" | "inactive" | "danger" | "info";
export type StatusDotSize = "sm" | "md";

export interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: StatusDotVariant;
  size?: StatusDotSize;
  // Optional accessible label. Renders as a visually-hidden span for screen readers.
  label?: string;
}

// Theme awareness: inactive switches to semantic --text-muted so it's
// visible against both bgs. Active/pending/danger/info use fixed nw-* hues
// — the dot is meant to be a consistent status signal.
const VARIANT_COLORS: Record<StatusDotVariant, string> = {
  active: "var(--nw-success)",
  pending: "var(--nw-warn)",
  inactive: "var(--text-muted)",
  danger: "var(--nw-danger)",
  info: "var(--nw-stone-blue)",
};

const SIZE_PX: Record<StatusDotSize, string> = {
  sm: "w-1.5 h-1.5",
  md: "w-2 h-2",
};

// One of two components allowed to be round (per non-negotiable #1 — avatars + dots).
export default function StatusDot({
  variant = "active",
  size = "md",
  label,
  className,
  ...rest
}: StatusDotProps) {
  return (
    <span className={["inline-flex items-center", className ?? ""].join(" ")} {...rest}>
      <span
        aria-hidden={label ? undefined : true}
        className={["inline-block rounded-full", SIZE_PX[size]].join(" ")}
        style={{ backgroundColor: VARIANT_COLORS[variant] }}
      />
      {label ? (
        <span className="sr-only">{label}</span>
      ) : null}
    </span>
  );
}
