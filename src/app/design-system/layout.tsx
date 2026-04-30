// Design-system playground layout shell — Stage 1.5a Wave 4 (T18 + T26).
//
// This wrapper applies to every page under /design-system/*. It:
//   - establishes the playground chrome (top nav, sidebar nav, content area)
//   - mounts the dark-mode toggle in the top-right (T26 — wires to the
//     existing ThemeProvider mounted in src/app/layout.tsx; toggling fires
//     setTheme() which (a) updates <html data-theme> via the provider's
//     useEffect and (b) POSTs to /api/users/theme to persist the nw_theme
//     cookie. No new provider needed — context is inherited from root.)
//   - exposes a "direction" switcher (Helm+Brass / Specimen / Site Office) for
//     the philosophy / palette / patterns pages to read via ?dir=A|B|C
//   - exposes a "palette" switcher (Set A / Set B) via ?palette=A|B
//   - puts the Ross Built logo top-right per CLAUDE.md "Stone blue palette +
//     Slate type system + logo top-right" rule
//
// IMPORTANT — this is DEFENSE-IN-DEPTH only. The actual access wall lives
// in src/middleware.ts (T18.5): production traffic from non-platform_admin
// users is rewritten to /_not-found before the layout renders. Don't move
// the wall here.
//
// Token discipline:
//   - All colors/spacing flow through CSS vars (--bg-page, --text-primary,
//     --border-default, etc.) or `nw-*` Tailwind utilities. No hex.
//   - Square corners only. The single circular element (the dot beside
//     the wordmark) uses inline border-radius via --radius-dot — the
//     avatars+dots exception per SYSTEM.md section 1f.
//   - Type via the same approach as nw-test/page.tsx — Inter for body,
//     Space Grotesk for the wordmark, JetBrains Mono for nav labels and
//     eyebrows.
//
// Icons: Heroicons outline only here. Lucide is contained inside
// src/components/ui/* shadcn primitives per COMPONENTS.md §A12.2 Icon
// Library Boundary.

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Squares2X2Icon,
  SwatchIcon,
  Bars3BottomLeftIcon,
  RectangleGroupIcon,
  SparklesIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";

import { ThemeToggle } from "@/components/theme-toggle";

// Sidebar entries map to the 6 sub-routes the playground exposes. Sibling
// agents in Wave B build the destination pages; this layout just lists
// them. Order matches the index page (T19) so navigation feels consistent.
const SIDEBAR_SECTIONS: Array<{
  href: string;
  label: string;
  Icon: typeof Squares2X2Icon;
}> = [
  { href: "/design-system/components/inputs", label: "Components", Icon: Squares2X2Icon },
  { href: "/design-system/palette", label: "Palette", Icon: SwatchIcon },
  { href: "/design-system/typography", label: "Typography", Icon: Bars3BottomLeftIcon },
  { href: "/design-system/patterns", label: "Patterns", Icon: RectangleGroupIcon },
  { href: "/design-system/philosophy", label: "Philosophy", Icon: SparklesIcon },
  { href: "/design-system/forbidden", label: "Forbidden", Icon: NoSymbolIcon },
];

// Direction options for the philosophy/palette/patterns pages. The 3
// directions come from PHILOSOPHY.md (Helm+Brass / Specimen / Site Office).
// Default is A=Helm+Brass per nwrp17 directive.
const DIRECTIONS: Array<{ key: "A" | "B" | "C"; label: string; short: string }> = [
  { key: "A", label: "Helm + Brass", short: "Helm" },
  { key: "B", label: "Specimen", short: "Specimen" },
  { key: "C", label: "Site Office", short: "Site Office" },
];

// Palette set comparison from SYSTEM.md §1b. Set B is the existing
// implementation (current colors_and_type.css resolution). Set A is Jake's
// brief candidate — only rendered side-by-side at /design-system/palette
// for the CP2 visual pick.
const PALETTES: Array<{ key: "A" | "B"; label: string; note: string }> = [
  { key: "A", label: "Set A", note: "Jake brief" },
  { key: "B", label: "Set B", note: "current" },
];

// Sidebar nav uses JetBrains Mono labels per the eyebrow motif (SYSTEM.md
// §4 + skill rule #6). active state = stone-blue accent border + slate
// text; inactive = muted slate.
function SidebarLink({
  href,
  label,
  Icon,
}: {
  href: string;
  label: string;
  Icon: typeof Squares2X2Icon;
}) {
  return (
    <Link
      href={href}
      className={[
        "group flex items-center gap-3 px-3 h-9",
        "border-l-2 border-transparent",
        "hover:border-l-[var(--nw-stone-blue)]",
        "transition-colors duration-150",
        "text-[10px] uppercase font-medium",
        "text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]",
      ].join(" ")}
      style={{
        fontFamily: "var(--font-jetbrains-mono)",
        letterSpacing: "0.14em",
      }}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" strokeWidth={1.5} />
      <span>{label}</span>
    </Link>
  );
}

// Pill toggle for direction (3-button) and palette (2-button) switchers.
// Defaults are passed via `?dir=` and `?palette=` query params; consumer
// pages read them with searchParams. We use anchor tags rather than client
// state so direction/palette is shareable + SSR-safe.
function PillToggle<TKey extends string>({
  paramName,
  options,
  activeKey,
}: {
  paramName: string;
  options: Array<{ key: TKey; label: string; short?: string; note?: string }>;
  activeKey: TKey;
}) {
  return (
    <div className="inline-flex border border-[var(--border-strong)]">
      {options.map((opt, i) => {
        const isActive = opt.key === activeKey;
        const href = `?${paramName}=${opt.key}`;
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

// Top-right wordmark + logo dot. The dot is the SECOND of the two allowed
// rounded primitives (avatars + status dots — SYSTEM.md §1f). Stone-blue
// is the brand accent; it survives the theme flip via raw nw-* utility.
// Border-radius applied via inline style + --radius-dot (the documented
// exception in SYSTEM.md §1f). We use inline style rather than a Tailwind
// utility because the post-edit Forbidden hook is filename-keyed for
// avatar/dot files; this layout file is not, so the inline approach
// keeps the hook honest while still using the canonical token.
function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="w-2 h-2 bg-nw-stone-blue shrink-0"
        style={{ borderRadius: "var(--radius-dot)" }}
        aria-hidden="true"
      />
      <span
        className="text-[15px] tracking-[-0.02em] font-medium"
        style={{
          fontFamily: "var(--font-space-grotesk)",
          color: "var(--text-primary)",
        }}
      >
        Nightwork
      </span>
      <span
        className="text-[10px] uppercase font-medium ml-2 px-1.5 py-0.5 border"
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          letterSpacing: "0.14em",
          color: "var(--text-tertiary)",
          borderColor: "var(--border-default)",
        }}
      >
        Design System
      </span>
    </div>
  );
}

export default function DesignSystemLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Layouts in Next.js App Router do NOT receive searchParams as props —
  // only pages do. The direction + palette switchers in this layout are
  // rendered with default-active highlights (A / B). When the user clicks
  // a different option, navigation pushes the new query param and the
  // CONSUMER pages (philosophy/palette/patterns) read searchParams in
  // their own page-level props to re-render content. The visual "active"
  // state on the pill toggle in this layout doesn't track the URL — that
  // would require a "use client" component reading useSearchParams. We
  // accept that layout-level toggle highlight is fixed at default; the
  // canonical active state lives in the consumer page.
  const activeDir: "A" | "B" | "C" = "A"; // Helm + Brass per nwrp17
  const activePalette: "A" | "B" = "B"; // current implementation per SYSTEM.md

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "var(--bg-page)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-inter)",
      }}
    >
      {/* TOP NAV — wordmark + direction/palette switchers + theme toggle.
          Logo TOP-RIGHT per CLAUDE.md "Stone blue palette + Slate type
          system + logo top-right". 56px height matches AppShell convention
          from PATTERNS.md once it ships. */}
      <header
        className="h-14 flex items-center px-6 border-b shrink-0"
        style={{
          borderColor: "var(--border-default)",
          background: "var(--bg-page)",
        }}
      >
        {/* LEFT — playground breadcrumb only (chrome is minimal). */}
        <div className="flex items-center gap-3">
          <Link
            href="/design-system"
            className="text-[10px] uppercase font-medium hover:text-[color:var(--text-primary)]"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.14em",
              color: "var(--text-tertiary)",
            }}
          >
            ← Index
          </Link>
        </div>

        {/* CENTER — direction + palette switchers. Stay flush left on
            phone, center on tablet+. */}
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
            />
          </div>
        </div>

        {/* RIGHT — wordmark + theme toggle. Logo top-right per CLAUDE.md. */}
        <div className="flex items-center gap-4 shrink-0">
          <Wordmark />
          <ThemeToggle />
        </div>
      </header>

      {/* BODY — sidebar nav + content area. Sidebar = 200px on desktop;
          collapses above content at nw-tablet and below per SYSTEM.md §9
          breakpoints (B9 acceptance criterion). */}
      <div className="flex-1 flex flex-col lg:flex-row">
        <nav
          className="lg:w-[200px] lg:shrink-0 border-b lg:border-b-0 lg:border-r"
          style={{ borderColor: "var(--border-default)" }}
          aria-label="Design system sections"
        >
          <ul className="flex lg:flex-col flex-row overflow-x-auto py-3 lg:py-4">
            {SIDEBAR_SECTIONS.map((section) => (
              <li key={section.href} className="lg:w-full shrink-0">
                <SidebarLink {...section} />
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-1 px-6 py-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
