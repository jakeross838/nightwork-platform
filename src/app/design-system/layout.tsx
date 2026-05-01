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
import { NwWordmark } from "@/components/branding/Wordmark";

// CP2 — design-system-scoped CSS overrides (palette Set A + direction
// tokens for typography/motion/density/accent-border). Side-effect import
// — Next bundles into every /design-system/* route.
import "./design-system.css";

import { DirectionPaletteShell } from "./_components/DirectionPaletteShell";
import { DirectionPaletteSwitcher } from "./_components/DirectionPaletteSwitcher";

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

// Top-right wordmark + Design System eyebrow. Per nwrp19 lock — the canonical
// NwWordmark replaces the prior text+dot rendering. Underline gradient is part
// of the wordmark itself; the standalone dot was retired as of nwrp19. The
// "Design System" eyebrow remains as a context label.
function Wordmark() {
  return (
    <div className="flex items-center gap-3">
      <NwWordmark size={110} />
      <span
        className="text-[10px] uppercase font-medium px-1.5 py-0.5 border"
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
  // CP2 — direction + palette switchers + the wrapper that applies the
  // resulting `data-direction` / `data-palette` attributes are extracted
  // to Client Components (DirectionPaletteSwitcher + DirectionPaletteShell)
  // so they can read useSearchParams() reactively. The switcher highlights
  // the active option from the URL; the shell wraps children with the
  // attributes that CSS attribute selectors in design-system.css consume.
  //
  // Per nwrp20 — clicking a switcher option swaps the rendered design
  // (palette tokens + direction tokens for typography/motion/density/
  // card-accent) across every /design-system/* page in real time without
  // a full reload.

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

        {/* CENTER — direction + palette switchers (Client Component reads
            useSearchParams() to highlight the active option + builds hrefs
            that preserve the rest of the query string). */}
        <DirectionPaletteSwitcher />

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
          {/* Client wrapper applies data-direction + data-palette + the
              `.design-system-scope` class that gates all direction-aware
              CSS overrides to ONLY hit children inside the playground. */}
          <DirectionPaletteShell>{children}</DirectionPaletteShell>
        </main>
      </div>
    </div>
  );
}
