import type { HTMLAttributes } from "react";

export type MoneyVariant = "default" | "negative" | "emphasized" | "muted";
export type MoneySize = "sm" | "md" | "lg" | "xl";

export interface MoneyProps extends Omit<HTMLAttributes<HTMLSpanElement>, "prefix"> {
  // Amount in CENTS (matching DB convention — see CLAUDE.md "Amounts in cents").
  // Pass null/undefined for an em-dash placeholder.
  cents: number | null | undefined;
  variant?: MoneyVariant;
  size?: MoneySize;
  // When true, negative amounts auto-coerce to the "negative" variant color.
  signColor?: boolean;
  // Optional hard-coded prefix/suffix (e.g. "+", "%"). Default prefix is "$".
  prefix?: string;
  suffix?: string;
  // Show 2 decimals always. Set false for whole-dollar display ($1,234).
  showCents?: boolean;
}

const VARIANT_COLORS: Record<MoneyVariant, string> = {
  default: "var(--nw-slate-tile)",
  negative: "var(--nw-danger)",
  emphasized: "var(--nw-slate-deep)",
  muted: "rgba(59, 88, 100, 0.55)",
};

const SIZE_STYLES: Record<MoneySize, string> = {
  sm: "text-[11px]",
  md: "text-[13px]",
  lg: "text-[15px]",
  xl: "text-[22px]",
};

const EMPHASIZED_WEIGHT: Record<MoneySize, string> = {
  sm: "font-medium",
  md: "font-medium",
  lg: "font-medium",
  xl: "font-semibold",
};

function formatDollars(cents: number, showCents: boolean): string {
  const dollars = Math.abs(cents) / 100;
  return dollars.toLocaleString("en-US", {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
}

export default function Money({
  cents,
  variant = "default",
  size = "md",
  signColor = false,
  prefix = "$",
  suffix,
  showCents = true,
  className,
  ...rest
}: MoneyProps) {
  if (cents === null || cents === undefined) {
    return (
      <span
        className={["inline-block", SIZE_STYLES[size], className ?? ""].join(" ")}
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          fontVariantNumeric: "tabular-nums",
          color: VARIANT_COLORS.muted,
        }}
        {...rest}
      >
        —
      </span>
    );
  }

  const isNegative = cents < 0;
  const resolvedVariant: MoneyVariant =
    signColor && isNegative && variant === "default" ? "negative" : variant;
  const formatted = formatDollars(cents, showCents);
  const sign = isNegative ? "-" : "";

  return (
    <span
      className={[
        "inline-block whitespace-nowrap",
        SIZE_STYLES[size],
        variant === "emphasized" ? EMPHASIZED_WEIGHT[size] : "",
        className ?? "",
      ].join(" ")}
      style={{
        fontFamily: "var(--font-jetbrains-mono)",
        fontVariantNumeric: "tabular-nums",
        color: VARIANT_COLORS[resolvedVariant],
      }}
      {...rest}
    >
      {sign}
      {prefix}
      {formatted}
      {suffix ?? ""}
    </span>
  );
}
