"use client";

// Client-side switcher for ?dir=A|B|C and ?palette=A|B.
//
// Reads useSearchParams() to highlight the active option. Renders Next
// `Link` elements that preserve the existing pathname + merge the updated
// query param so navigation between design-system pages keeps the user's
// chosen direction/palette.
//
// Visual styling matches the prior PillToggle Server Component the layout
// used to render — JetBrains Mono labels, square 1px borders, stone-blue
// background on the active state.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Direction = "A" | "B" | "C";
type Palette = "A" | "B";

const DIRECTIONS: Array<{ key: Direction; label: string; short: string }> = [
  { key: "A", label: "Helm + Brass", short: "Helm" },
  { key: "B", label: "Specimen", short: "Specimen" },
  { key: "C", label: "Site Office", short: "Site Office" },
];

const PALETTES: Array<{ key: Palette; label: string; note: string }> = [
  { key: "A", label: "Set A", note: "Jake brief" },
  { key: "B", label: "Set B", note: "current" },
];

function PillToggle<TKey extends string>({
  paramName,
  options,
  activeKey,
  buildHref,
}: {
  paramName: string;
  options: Array<{ key: TKey; label: string; short?: string; note?: string }>;
  activeKey: TKey;
  buildHref: (paramName: string, value: string) => string;
}) {
  return (
    <div className="inline-flex border border-[var(--border-strong)]">
      {options.map((opt, i) => {
        const isActive = opt.key === activeKey;
        const href = buildHref(paramName, opt.key);
        return (
          <Link
            key={opt.key}
            href={href}
            className={[
              "px-3 h-7 inline-flex items-center gap-1.5 text-[10px] uppercase font-medium",
              "transition-colors duration-150",
              i > 0 ? "border-l border-[var(--border-strong)]" : "",
              isActive
                ? "bg-[var(--nw-stone-blue)] text-[color:var(--nw-white-sand)]"
                : "bg-transparent text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]",
            ].join(" ")}
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.12em",
            }}
            aria-pressed={isActive}
            aria-current={isActive ? "page" : undefined}
            scroll={false}
          >
            <span>{opt.short ?? opt.label}</span>
            {opt.note ? (
              <span className="text-[9px] opacity-70 normal-case">· {opt.note}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

export function DirectionPaletteSwitcher() {
  const pathname = usePathname();
  const sp = useSearchParams();

  const direction = (sp?.get("dir") ?? "A") as string;
  const palette = (sp?.get("palette") ?? "B") as string;
  const activeDir: Direction = direction === "B" || direction === "C" ? (direction as Direction) : "A";
  const activePalette: Palette = palette === "A" ? "A" : "B";

  // Build href that preserves all existing query params and overrides one.
  // Falls back to the current pathname when usePathname() returns null
  // (shouldn't happen client-side, but makes TS happy + safer).
  function buildHref(paramName: string, value: string) {
    const next = new URLSearchParams(sp ? sp.toString() : "");
    next.set(paramName, value);
    return `${pathname ?? ""}?${next.toString()}`;
  }

  return (
    <div className="flex-1 flex items-center justify-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <span
          className="text-[9px] uppercase"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.14em",
            color: "var(--text-tertiary)",
          }}
        >
          Direction
        </span>
        <PillToggle
          paramName="dir"
          options={DIRECTIONS}
          activeKey={activeDir}
          buildHref={buildHref}
        />
      </div>
      <div className="flex items-center gap-2">
        <span
          className="text-[9px] uppercase"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.14em",
            color: "var(--text-tertiary)",
          }}
        >
          Palette
        </span>
        <PillToggle
          paramName="palette"
          options={PALETTES}
          activeKey={activePalette}
          buildHref={buildHref}
        />
      </div>
    </div>
  );
}
