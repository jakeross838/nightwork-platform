// Nightwork wordmark — canonical render for React surfaces.
//
// nwrp19 spec — locked v0 for 1.5a ship:
//   - Text: lowercase "nightwork" (single word, no caps)
//   - Font: Space Grotesk Medium (var(--font-display) — loaded by next/font in layout.tsx)
//   - Letter-spacing: -0.02em
//   - Underline: 2px stroke, full width of wordmark, gradient opacity 100% (left) → 0% (right)
//   - Underline color: --nw-stone-blue (token-driven; works across both candidate palettes)
//   - Spacing: 6px between wordmark baseline and line top
//
// Color modes:
//   - "auto"    → wordmark = --text-primary (adapts to light/dark via theme), line = --nw-stone-blue gradient
//   - "inverse" → wordmark = --nw-white-sand (forced light text on dark bg), line = --nw-stone-blue gradient
//   - "brand"   → wordmark = --nw-stone-blue, line = --nw-stone-blue (single-color treatment)
//
// Why inline SVG with currentColor:
//   - Inline <svg> in a React component renders within the document's CSS scope,
//     so font-family: var(--font-display) resolves to the next/font-loaded
//     Space Grotesk perfectly. <img src="...svg"> is sandboxed and can't see
//     page fonts — that's why the static SVG file in /public/brand/ uses
//     "Space Grotesk, system-ui" declaratively (best-effort fallback).
//   - currentColor lets a single SVG inherit text color from CSS — no need
//     for separate light/dark variants.
//
// Reference: .planning/design/BRANDING.md §1, §4

import type { CSSProperties } from "react";

export type WordmarkColor = "auto" | "inverse" | "brand";

export interface NwWordmarkProps {
  /** Width in px. Default 110 (nav size). Maps to height via 56/220 viewBox ratio (~28px tall at 110px wide). */
  size?: number;
  /** Color treatment. Default "auto" — adapts to bg via --text-primary. */
  color?: WordmarkColor;
  className?: string;
  /** Optional override style. Color tokens applied internally; consumers should not need to override. */
  style?: CSSProperties;
}

// ViewBox tuned to Space Grotesk Medium "nightwork" rendering at 44px:
//   - text width measured ~210px; padded to 220 for comfortable bounding
//   - text height + descender + 6px underline gap + 2px line ≈ 56
//   - At consumer size=110, the rendered height = 110 * (56/220) = 28px
const VIEWBOX_WIDTH = 220;
const VIEWBOX_HEIGHT = 56;

// Color tokens per mode. Wordmark uses currentColor on the <text>; the
// component sets `color` on the wrapping <svg> via inline style. The
// underline stroke pulls --nw-stone-blue directly from the token system
// for "auto" + "inverse"; "brand" uses the same token for both.
function getWordmarkStyle(color: WordmarkColor): CSSProperties {
  switch (color) {
    case "inverse":
      return { color: "var(--nw-white-sand)" };
    case "brand":
      return { color: "var(--nw-stone-blue)" };
    case "auto":
    default:
      return { color: "var(--text-primary)" };
  }
}

export function NwWordmark({
  size = 110,
  color = "auto",
  className,
  style,
}: NwWordmarkProps) {
  const height = Math.round((size * VIEWBOX_HEIGHT) / VIEWBOX_WIDTH);
  const wordmarkStyle = getWordmarkStyle(color);
  const mergedStyle: CSSProperties = { ...wordmarkStyle, ...style };

  // Stable gradient ID per mode — multiple wordmarks on the same page
  // shouldn't fight over a single ID. Mode-keyed is enough since each
  // mode renders the same gradient definition.
  const gradientId = `nw-wordmark-line-${color}`;

  return (
    <svg
      role="img"
      aria-label="Nightwork"
      width={size}
      height={height}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={className}
      style={mergedStyle}
      data-color={color}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0%"
          y1="50%"
          x2="100%"
          y2="50%"
        >
          <stop
            offset="0%"
            stopColor="var(--nw-stone-blue)"
            stopOpacity="1"
          />
          <stop
            offset="100%"
            stopColor="var(--nw-stone-blue)"
            stopOpacity="0"
          />
        </linearGradient>
      </defs>
      {/* Wordmark text — uses var(--font-display) which next/font binds to
          Space Grotesk in layout.tsx. system-ui fallback covers SSR before
          font load. fill="currentColor" lets the wrapping <svg> color: prop
          drive the text color. fontSize 44 chosen so x-height at the chosen
          letter-spacing fills viewBox width comfortably; -0.88 tracking at
          44px = -0.02em per spec. */}
      <text
        x="0"
        y="40"
        fontFamily="var(--font-display), 'Space Grotesk', system-ui, sans-serif"
        fontWeight={500}
        fontSize={44}
        letterSpacing="-0.88"
        fill="currentColor"
      >
        nightwork
      </text>
      {/* Underline — 2px stroke, full viewBox width, gradient opacity 1→0
          left to right per spec. y=50 places line ~6px below text baseline
          (text baseline y=40, descender ~4px, gap 6px). */}
      <line
        x1="0"
        y1="50"
        x2={VIEWBOX_WIDTH}
        y2="50"
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
      />
    </svg>
  );
}

export default NwWordmark;
