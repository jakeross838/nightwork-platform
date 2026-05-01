// Nightwork icon — square mark for sub-360px nav, favicon companion in React surfaces.
//
// nwrp19 spec — locked v0 for 1.5a ship:
//   - Square format
//   - Lowercase "n" in Space Grotesk Medium
//   - Stone Blue background (--nw-stone-blue)
//   - White Sand "n" character (--nw-white-sand)
//
// Use this React component for sub-360px viewport collapse from <NwWordmark>.
// For favicon / Apple Touch Icon / PWA manifest, see the static SVG at
// /public/brand/nightwork-icon.svg AND the Next.js file-based icon convention
// in src/app/icon.svg + src/app/apple-icon.png.
//
// Reference: .planning/design/BRANDING.md §2, §7

import type { CSSProperties } from "react";

export interface NwIconProps {
  /** Width AND height in px (square). Default 32. */
  size?: number;
  className?: string;
  style?: CSSProperties;
}

const VIEWBOX = 64;

export function NwIcon({ size = 32, className, style }: NwIconProps) {
  return (
    <svg
      role="img"
      aria-label="Nightwork"
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      className={className}
      style={style}
    >
      {/* Stone Blue square — token-driven so it survives palette flips */}
      <rect width={VIEWBOX} height={VIEWBOX} fill="var(--nw-stone-blue)" />
      {/* Lowercase "n" in Space Grotesk Medium, White Sand fill, centered */}
      <text
        x={VIEWBOX / 2}
        y={44}
        textAnchor="middle"
        fontFamily="var(--font-display), 'Space Grotesk', system-ui, sans-serif"
        fontWeight={500}
        fontSize={44}
        letterSpacing="-0.88"
        fill="var(--nw-white-sand)"
      >
        n
      </text>
    </svg>
  );
}

export default NwIcon;
