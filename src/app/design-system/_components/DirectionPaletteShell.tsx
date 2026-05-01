"use client";

// Client-side wrapper that reads ?dir=A|B|C and ?palette=A|B from the URL
// and applies them as data attributes + a `.design-system-scope` className
// on a wrapper that contains every design-system page's content.
//
// CSS attribute selectors in design-system.css then cascade to swap:
//   - palette tokens (--nw-stone-blue, --nw-slate-deep, --nw-warm-gray)
//   - direction tokens (eyebrow tracking/case/family, card padding, motion,
//     headline weight, accent border)
//
// The `.design-system-scope` className narrows direction overrides to ONLY
// hit components rendered inside design-system pages — non-design-system
// surfaces keep the locked Slate aesthetic.
//
// Why a Client Component? Layouts in Next.js App Router don't receive
// searchParams as props. Reading useSearchParams() requires a client
// boundary. The layout itself stays a Server Component; only this wrapper
// + the switcher are client.

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

type Direction = "A" | "B" | "C";
type Palette = "A" | "B";

interface DirectionPaletteShellProps {
  children: ReactNode;
}

export function DirectionPaletteShell({ children }: DirectionPaletteShellProps) {
  const params = useSearchParams();
  const direction = (params?.get("dir") ?? "A") as string;
  const palette = (params?.get("palette") ?? "B") as string;

  // Defense — only allow known values. Falling back to defaults guards
  // against URL tampering / bookmark drift.
  const validDir: Direction = direction === "B" || direction === "C" ? (direction as Direction) : "A";
  const validPalette: Palette = palette === "A" ? "A" : "B";

  return (
    <div
      data-direction={validDir}
      data-palette={validPalette}
      className="design-system-scope"
    >
      {children}
    </div>
  );
}
