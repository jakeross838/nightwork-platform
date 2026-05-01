// Design-system playground — components/navigation (Stage 1.5a, T20d).
//
// Renders the 3 Navigation entries from COMPONENTS.md §4:
//   AppShell — layout wrapper (rendered as a static schematic — the live
//     layout you're inside IS an AppShell composition; we visualize the
//     structure with labelled rectangles, not a recursive AppShell).
//   Tabs-as-nav — doc-stub (shadcn Tabs not installed; existing patterns
//     ad-hoc).
//   Breadcrumb — uses existing src/components/breadcrumbs.tsx.
//
// IMPORTANT — token discipline:
//   - All colors via CSS vars or `nw-*` Tailwind utilities.
//   - Square corners. Bullet dot uses --radius-dot.
//   - Heroicons outline for new icons.
//
// IMPORTANT — sample-data isolation (SPEC D9 / hook T10c):
//   - Fixtures imported from `@/app/design-system/_fixtures` only.

"use client";

import { CheckIcon } from "@heroicons/react/24/outline";

import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import Breadcrumbs from "@/components/breadcrumbs";

// ─────────────────────────────────────────────────────────────────────────
// Section helpers (consistent with sibling category pages)
// ─────────────────────────────────────────────────────────────────────────
function ComponentSection({
  title,
  source,
  children,
}: {
  title: string;
  source: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="mb-12 pb-10 border-b last:border-b-0"
      style={{ borderColor: "var(--border-default)" }}
    >
      <div className="mb-6">
        <NwEyebrow tone="accent" className="mb-2">
          {title}
        </NwEyebrow>
        <p
          className="text-[12px]"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            color: "var(--text-tertiary)",
          }}
        >
          Source · {source}
        </p>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function SubBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <NwEyebrow tone="muted" className="mb-3">
        {label}
      </NwEyebrow>
      {children}
    </div>
  );
}

function TokenList({
  bindings,
}: {
  bindings: Array<{ token: string; role: string }>;
}) {
  return (
    <div
      className="border p-3 text-[11px] leading-relaxed"
      style={{
        borderColor: "var(--border-default)",
        background: "var(--bg-subtle)",
      }}
    >
      <ul className="space-y-1">
        {bindings.map((b) => (
          <li
            key={b.token}
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              color: "var(--text-secondary)",
            }}
          >
            <span style={{ color: "var(--nw-stone-blue)" }}>{b.token}</span>
            <span style={{ color: "var(--text-tertiary)" }}> · {b.role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AntiPatterns({ items }: { items: string[] }) {
  return (
    <div
      className="border p-3 text-[12px] leading-relaxed"
      style={{
        borderColor: "rgba(176,85,78,0.4)",
        background: "rgba(176,85,78,0.04)",
      }}
    >
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li
            key={i}
            className="pl-3 relative"
            style={{ color: "var(--text-secondary)" }}
          >
            <span
              className="absolute left-0 top-[6px] w-1.5 h-1.5"
              style={{
                background: "var(--nw-danger)",
                borderRadius: "var(--radius-dot)",
              }}
              aria-hidden="true"
            />
            <strong style={{ color: "var(--nw-danger)" }}>DO NOT</strong>{" "}
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ARIANote({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[12px] leading-relaxed"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 1. AppShell section — static schematic of the wrapper structure
// ─────────────────────────────────────────────────────────────────────────
function AppShellSection() {
  return (
    <ComponentSection
      title="AppShell"
      source="Nightwork-authored (src/components/app-shell.tsx) — wraps every authenticated page"
    >
      <SubBlock label="Composition schematic — top nav + sidebar + main + right-rail + footer">
        {/* Static labelled diagram of the AppShell anatomy. Rendered as
            simple rectangles — the playground itself sits inside an
            AppShell-equivalent layout (src/app/design-system/layout.tsx),
            so a recursive render would be confusing. */}
        <div
          className="border max-w-[860px]"
          style={{ borderColor: "var(--border-default)" }}
        >
          {/* Top nav strip */}
          <div
            className="h-12 flex items-center justify-between px-4 border-b"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--bg-subtle)",
            }}
          >
            <span
              className="text-[10px] uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              NavBar · brand-accent · org logo top-right
            </span>
            <span
              className="text-[10px]"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                color: "var(--text-tertiary)",
              }}
            >
              h-12 · 56px
            </span>
          </div>

          {/* Body grid */}
          <div className="grid grid-cols-12 min-h-[280px]">
            {/* Sidebar */}
            <div
              className="col-span-3 border-r p-3"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-subtle)",
              }}
            >
              <span
                className="text-[10px] uppercase block mb-2"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  letterSpacing: "0.14em",
                  color: "var(--text-tertiary)",
                }}
              >
                JobSidebar
              </span>
              <p
                className="text-[10px] leading-relaxed"
                style={{ color: "var(--text-tertiary)" }}
              >
                w-[220px] desktop · drawer overlay on{" "}
                <code>nw-tablet</code> / <code>nw-phone</code>. Active item
                indicator uses <code>--brand-accent</code> border-l.
              </p>
            </div>

            {/* Main content */}
            <div className="col-span-7 p-4">
              <span
                className="text-[10px] uppercase block mb-2"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  letterSpacing: "0.14em",
                  color: "var(--text-tertiary)",
                }}
              >
                Main content
              </span>
              <p
                className="text-[10px] leading-relaxed"
                style={{ color: "var(--text-tertiary)" }}
              >
                Page-level content lives here. PATTERNS.md (T14) layouts —
                Document Review, Dashboard, List+Detail, Wizard — all extend
                this main region.
              </p>
            </div>

            {/* Right rail */}
            <div
              className="col-span-2 border-l p-3"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-subtle)",
              }}
            >
              <span
                className="text-[10px] uppercase block mb-2"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  letterSpacing: "0.14em",
                  color: "var(--text-tertiary)",
                }}
              >
                Right rail
              </span>
              <p
                className="text-[10px] leading-relaxed"
                style={{ color: "var(--text-tertiary)" }}
              >
                Optional. Used for invoice review structured fields, audit
                timeline.
              </p>
            </div>
          </div>

          {/* Footer (optional) */}
          <div
            className="h-8 px-4 flex items-center border-t"
            style={{
              borderColor: "var(--border-default)",
              background: "var(--bg-subtle)",
            }}
          >
            <span
              className="text-[10px]"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                color: "var(--text-tertiary)",
              }}
            >
              Optional footer · status bar · attribution
            </span>
          </div>
        </div>
      </SubBlock>

      <SubBlock label="Variants — with-sidebar (default) / no-sidebar">
        <p
          className="text-[12px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          The shell handles NavBar + sidebar visibility internally via
          path-matching against a NO_SIDEBAR regex (invoice detail, draw
          detail, admin, settings, login, etc. all hide sidebar). At{" "}
          <code>nw-phone</code>/<code>nw-tablet</code>, sidebar collapses;
          hamburger toggle in NavBar opens overlay drawer. Logo shrinks to
          icon-only at &lt;360px viewport per CLAUDE.md UI rules Q13.
        </p>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1, §2)">
        <TokenList
          bindings={[
            { token: "--bg-page", role: "shell bg" },
            { token: "--text-primary", role: "default text" },
            { token: "--border-default", role: "sidebar / nav-bar separators" },
            { token: "--brand-logo", role: "NavBar logo (A12.3 tenant-customizable)" },
            { token: "--brand-accent", role: "active-nav-item indicator (A12.3)" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          NavBar has <code>role=&quot;navigation&quot;</code> +{" "}
          <code>aria-label=&quot;Primary&quot;</code>. Sidebar has{" "}
          <code>role=&quot;navigation&quot;</code> +{" "}
          <code>aria-label=&quot;Job navigation&quot;</code>. Mobile drawer has{" "}
          <code>role=&quot;dialog&quot;</code> +{" "}
          <code>aria-modal=&quot;true&quot;</code> while open. Skip-to-main-content
          link (planned T20d follow-up) for keyboard users.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "bypass AppShell — every authenticated page wraps in it for consistent NavBar + sidebar",
            "hardcode the logo asset — it's tenant-customizable via --brand-logo (A12.3 / SYSTEM §2)",
            "pass org_id to AppShell — org context flows through OrgBrandingProvider server-side",
            "duplicate NavBar inside a page — AppShell renders it once",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Tabs-as-nav section — DOC-STUB (shadcn Tabs not installed)
// ─────────────────────────────────────────────────────────────────────────
function TabsAsNavSection() {
  // Static visualization of the pills variant — same shape as job-tabs.tsx.
  const tabs = [
    { label: "Overview", href: "#", current: true },
    { label: "Budget", href: "#" },
    { label: "Invoices", href: "#" },
    { label: "Draws", href: "#" },
    { label: "Change orders", href: "#" },
  ];

  return (
    <ComponentSection
      title="Tabs-as-nav"
      source="DOC-STUB — shadcn Tabs not yet installed; existing pattern: src/components/job-tabs.tsx (ad-hoc, pills variant)"
    >
      <SubBlock label="Visual reference — pills variant (matches job-tabs.tsx)">
        <div
          className="flex items-center gap-2 flex-wrap p-3 border max-w-[860px]"
          style={{
            borderColor: "var(--border-default)",
            background: "var(--bg-subtle)",
          }}
          role="navigation"
          aria-label="Job navigation example"
        >
          {tabs.map((t) => (
            <span
              key={t.label}
              className="px-3 h-8 inline-flex items-center text-[11px] uppercase font-medium border"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
                color: t.current
                  ? "var(--nw-white-sand)"
                  : "var(--text-secondary)",
                background: t.current
                  ? "var(--nw-stone-blue)"
                  : "transparent",
                borderColor: t.current
                  ? "var(--nw-stone-blue)"
                  : "var(--border-default)",
              }}
              aria-current={t.current ? "page" : undefined}
            >
              {t.label}
            </span>
          ))}
        </div>
      </SubBlock>

      <SubBlock label="Composition (when Tabs primitive ships)">
        <pre
          className="text-[11px] leading-relaxed p-3 border overflow-x-auto"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            background: "var(--bg-page)",
            borderColor: "var(--border-default)",
            color: "var(--text-secondary)",
          }}
        >
{`<Tabs value={pathname} role="navigation" aria-label="Job">
  <TabsList>
    <TabsTrigger asChild value="/jobs/[id]">
      <Link href="/jobs/[id]" aria-current="page">Overview</Link>
    </TabsTrigger>
    <TabsTrigger asChild value="/jobs/[id]/budget">
      <Link href="/jobs/[id]/budget">Budget</Link>
    </TabsTrigger>
    {/* … */}
  </TabsList>
</Tabs>`}
        </pre>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1, §4c)">
        <TokenList
          bindings={[
            { token: "--text-secondary", role: "inactive" },
            { token: "--text-primary", role: "active" },
            { token: "--nw-stone-blue", role: "active indicator + brand-accent" },
            { token: "--border-default", role: "separator" },
            { token: "--bg-subtle", role: "hover bg" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          When used as nav, each <code>&lt;TabsTrigger&gt;</code> should be a
          <code>&lt;Link&gt;</code> with <code>aria-current=&quot;page&quot;</code> on
          the matching one (rather than <code>aria-selected</code>).{" "}
          <code>role=&quot;navigation&quot;</code> on the container; tab semantics
          yield to nav semantics. Mobile: horizontal scroll on overflow with
          sticky current-tab indicator.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "use TabsTrigger value pattern for routing — use Link href so URL is source of truth",
            "use Tabs-as-nav for >7 destinations — use a Combobox / Select",
            "nest Tabs-as-nav",
            "pass org_id (A12.1)",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Breadcrumb section — uses existing breadcrumbs.tsx
// ─────────────────────────────────────────────────────────────────────────
function BreadcrumbSection() {
  return (
    <ComponentSection
      title="Breadcrumb"
      source="Nightwork-authored (src/components/breadcrumbs.tsx)"
    >
      <SubBlock label="Default — Job > Invoices > #INV-2026-04-0117">
        <div
          className="border p-4 max-w-[860px]"
          style={{ borderColor: "var(--border-default)" }}
        >
          <Breadcrumbs
            items={[
              { label: "Jobs", href: "/jobs" },
              { label: "Pelican Bay Estate", href: "/jobs/pelican-bay" },
              { label: "Invoices", href: "/jobs/pelican-bay/invoices" },
              { label: "BAY-2026-04-0117" },
            ]}
          />
        </div>
      </SubBlock>

      <SubBlock label="Long trail — collapses middle items on phone (>3 levels)">
        <div
          className="border p-4 max-w-[860px]"
          style={{ borderColor: "var(--border-default)" }}
        >
          <Breadcrumbs
            items={[
              { label: "Jobs", href: "/jobs" },
              { label: "Pelican Bay Estate", href: "/jobs/pelican-bay" },
              { label: "Draws", href: "/jobs/pelican-bay/draws" },
              { label: "Draw 8", href: "/jobs/pelican-bay/draws/8" },
              { label: "Lien releases" },
            ]}
          />
        </div>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1, §4)">
        <TokenList
          bindings={[
            { token: "--text-secondary", role: "default crumbs" },
            { token: "--text-primary", role: "current crumb (last item)" },
            { token: "--text-tertiary", role: "separator chevrons" },
            { token: "--nw-stone-blue", role: "hover color on link crumbs" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          <code>&lt;nav aria-label=&quot;Breadcrumb&quot;&gt;</code> wrapper;{" "}
          <code>&lt;ol&gt;</code> with crumb items; current item has{" "}
          <code>aria-current=&quot;page&quot;</code>. At <code>nw-phone</code>,
          middle crumbs collapse to &ldquo;…&rdquo; if trail length &gt; 3.
          Hidden in print (<code>print:hidden</code>) — page header is enough
          for printed pages.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "skip the leading 'Home' crumb — Breadcrumbs prepends it automatically",
            "nest Breadcrumbs inside Breadcrumbs",
            "include action-CTAs as crumbs — crumbs are pure navigation",
            "pass org_id (A12.1)",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Page assembly
// ─────────────────────────────────────────────────────────────────────────
export default function ComponentsNavigationPage() {
  return (
    <div className="max-w-[1100px]">
      <header
        className="mb-10 pb-6 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <NwEyebrow tone="accent" className="mb-3">
          Components · Navigation
        </NwEyebrow>
        <h1
          className="text-[28px] mb-3 nw-direction-headline"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.02em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Navigation primitives
        </h1>
        <p
          className="text-[14px] max-w-[680px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          The 3 navigation primitives from COMPONENTS.md §4: AppShell (the
          authenticated layout wrapper, visualized as a schematic),
          Tabs-as-nav (doc-stub — shadcn Tabs not installed), Breadcrumb
          (existing breadcrumbs.tsx).
        </p>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <NwBadge variant="success" size="sm">
            <CheckIcon
              className="w-3 h-3 mr-1"
              aria-hidden="true"
              strokeWidth={1.5}
            />
            2 rendered
          </NwBadge>
          <NwBadge variant="warning" size="sm">
            1 doc-stub
          </NwBadge>
        </div>
      </header>

      <AppShellSection />
      <TabsAsNavSection />
      <BreadcrumbSection />
    </div>
  );
}
