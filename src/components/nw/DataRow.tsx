import type { HTMLAttributes, ReactNode } from "react";
import Eyebrow from "./Eyebrow";

export type DataRowVariant = "normal" | "emphasized" | "danger";
export type DataRowLayout = "stacked" | "horizontal";

export interface DataRowProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  value: ReactNode;
  variant?: DataRowVariant;
  layout?: DataRowLayout;
  // Use on inverse (slate-deep) cards — switches the eyebrow tint to a
  // semi-transparent white-sand. Value color is unaffected (caller controls).
  inverse?: boolean;
}

// Pattern from Slate Invoice Detail right rail:
//   <eyebrow label> on top
//   <value> below (body or money)
// "horizontal" layout puts label left, value right (used in audit / lien rails).
//
// Theme awareness: normal + emphasized resolve via --text-primary. Danger
// keeps the fixed --nw-danger hue (intentional signal). When `inverse` is
// true, the row is rendered on a slate-deep "dark island" Card variant
// even when the page is in light mode, so we hardcode white-sand.
const VARIANT_VALUE_COLORS: Record<DataRowVariant, string> = {
  normal: "var(--text-primary)",
  emphasized: "var(--text-primary)",
  danger: "var(--nw-danger)",
};

export default function DataRow({
  label,
  value,
  variant = "normal",
  layout = "stacked",
  inverse = false,
  className,
  ...rest
}: DataRowProps) {
  const valueColor = inverse ? "var(--nw-white-sand)" : VARIANT_VALUE_COLORS[variant];
  const valueWeight = variant === "emphasized" ? "font-medium" : "";

  // Eyebrow tone — on inverse cards we override to a faded sand color via
  // inline style; otherwise use the muted default.
  const labelNode = (
    <Eyebrow
      tone="muted"
      style={inverse ? { color: "rgba(247,245,236,0.5)" } : undefined}
    >
      {label}
    </Eyebrow>
  );

  if (layout === "horizontal") {
    return (
      <div
        className={[
          "flex items-baseline justify-between gap-4 py-1",
          className ?? "",
        ].join(" ")}
        {...rest}
      >
        {labelNode}
        <span
          className={["text-[13px]", valueWeight].join(" ")}
          style={{ color: valueColor }}
        >
          {value}
        </span>
      </div>
    );
  }

  return (
    <div
      className={["flex flex-col gap-1.5", className ?? ""].join(" ")}
      {...rest}
    >
      {labelNode}
      <span
        className={["text-[13px]", valueWeight].join(" ")}
        style={{ color: valueColor }}
      >
        {value}
      </span>
    </div>
  );
}
