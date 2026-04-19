import type { HTMLAttributes, ReactNode } from "react";

export type EyebrowTone = "default" | "accent" | "warn" | "success" | "danger" | "muted";

export interface EyebrowProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: EyebrowTone;
  icon?: ReactNode;
  children: ReactNode;
}

// JetBrains Mono 10px UPPERCASE 0.14em — the single most-repeated motif in
// the design system. Per skill rule #6: eyebrow appears above every section.
const TONE_COLORS: Record<EyebrowTone, string> = {
  default: "var(--nw-slate-tile)",
  accent: "var(--nw-stone-blue)",
  warn: "var(--nw-warn)",
  success: "var(--nw-success)",
  danger: "var(--nw-danger)",
  muted: "rgba(59, 88, 100, 0.55)",
};

export default function Eyebrow({
  tone = "muted",
  icon,
  className,
  children,
  ...rest
}: EyebrowProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5",
        "uppercase font-medium leading-none",
        "text-[10px]",
        className ?? "",
      ].join(" ")}
      style={{
        fontFamily: "var(--font-jetbrains-mono)",
        letterSpacing: "0.14em",
        color: TONE_COLORS[tone],
      }}
      {...rest}
    >
      {icon ? <span className="inline-flex items-center">{icon}</span> : null}
      {children}
    </span>
  );
}
