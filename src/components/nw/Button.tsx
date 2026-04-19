"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

// Slate primitive button. Square corners (no rounded), JetBrains Mono uppercase
// with 0.12em tracking per design system. Variants follow Slate Invoice Detail
// reference: primary = stone-blue, secondary = outlined slate, ghost = text only,
// danger = danger color.
const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "h-[30px] px-3 text-[10px]",
  md: "h-[36px] px-4 text-[11px]",
  lg: "h-[44px] px-5 text-[12px]",
};

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-nw-stone-blue text-nw-white-sand border border-nw-stone-blue " +
    "hover:bg-nw-gulf-blue hover:border-nw-gulf-blue " +
    "disabled:bg-nw-stone-blue/40 disabled:border-nw-stone-blue/40 disabled:cursor-not-allowed",
  secondary:
    "bg-transparent text-nw-slate-tile border border-nw-slate-tile/40 " +
    "hover:border-nw-slate-tile hover:bg-nw-slate-tile/[0.04] " +
    "disabled:opacity-40 disabled:cursor-not-allowed",
  ghost:
    "bg-transparent text-nw-slate-tile border border-transparent " +
    "hover:bg-nw-slate-tile/[0.06] " +
    "disabled:opacity-40 disabled:cursor-not-allowed",
  danger:
    "bg-transparent text-nw-danger border border-nw-danger/60 " +
    "hover:bg-nw-danger/[0.08] hover:border-nw-danger " +
    "disabled:opacity-40 disabled:cursor-not-allowed",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    type = "button",
    className,
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={[
        "inline-flex items-center justify-center gap-2",
        "uppercase font-medium leading-none",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-stone-blue/40 focus-visible:ring-offset-1",
        SIZE_STYLES[size],
        VARIANT_STYLES[variant],
        className ?? "",
      ].join(" ")}
      style={{
        fontFamily: "var(--font-jetbrains-mono)",
        letterSpacing: "0.12em",
      }}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"
        />
      )}
      {children}
    </button>
  );
});

export default Button;
