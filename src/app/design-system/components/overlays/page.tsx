// Design-system playground — components/overlays (Stage 1.5a, T20f).
//
// Renders the 4 Overlays entries from COMPONENTS.md §6:
//   Tooltip — shadcn Tooltip rendered live with NwButton trigger.
//   Popover — shadcn Popover rendered live with composed content.
//   Confirm — DOC-STUB (Dialog primitive not installed); intent documented.
//   HoverCard — shadcn HoverCard rendered live with vendor preview.
//
// IMPORTANT — token discipline:
//   - All colors via CSS vars or `nw-*` Tailwind utilities.
//   - Square corners. Bullet dot uses --radius-dot.
//   - Heroicons outline for new icons.
//
// IMPORTANT — sample-data isolation (SPEC D9 / hook T10c):
//   - Fixtures imported from `@/app/design-system/_fixtures` only.

"use client";

import {
  InformationCircleIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

import NwButton from "@/components/nw/Button";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwCard from "@/components/nw/Card";
import NwDataRow from "@/components/nw/DataRow";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";

import { SAMPLE_VENDORS } from "@/app/design-system/_fixtures";

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

function DocStub({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <NwCard
      variant="default"
      padding="md"
      className="border-dashed"
      style={{ borderColor: "var(--border-strong)" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <NwBadge variant="warning" size="sm">
          DOC-STUB
        </NwBadge>
        <span
          className="text-[11px] uppercase"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.14em",
            color: "var(--text-tertiary)",
          }}
        >
          {title}
        </span>
      </div>
      {children}
    </NwCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Tooltip section — shadcn Tooltip live
// ─────────────────────────────────────────────────────────────────────────
function TooltipSection() {
  return (
    <ComponentSection
      title="Tooltip"
      source="shadcn (src/components/ui/tooltip.tsx, codemod-rewritten) — wraps @base-ui/react/tooltip"
    >
      <SubBlock label="Live tooltip — hover or focus the buttons (desktop only)">
        <TooltipProvider delay={200}>
          <div className="flex flex-wrap items-center gap-3">
            <Tooltip>
              <TooltipTrigger
                render={
                  <NwButton variant="primary">Hover me</NwButton>
                }
              />
              <TooltipContent>Tooltip content — short text only.</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-8 h-8 border bg-transparent"
                    style={{
                      borderColor: "var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                    aria-label="More info"
                  >
                    <InformationCircleIcon
                      className="w-4 h-4"
                      aria-hidden="true"
                      strokeWidth={1.5}
                    />
                  </button>
                }
              />
              <TooltipContent side="right">
                Confidence below 70% routes to Diane for triage first.
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1)">
        <TokenList
          bindings={[
            { token: "--foreground", role: "content bg (Tooltip inverts)" },
            { token: "--background", role: "content text" },
            { token: "--foreground (arrow)", role: "arrow fill" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Base UI Tooltip primitive: <code>role=&quot;tooltip&quot;</code>,{" "}
          <code>aria-describedby</code> on trigger pointing to tooltip id.
          Hover or focus to show, blur or Esc to dismiss. Keyboard users:
          focus the trigger, tooltip auto-shows. <strong>Mobile:</strong>{" "}
          tooltips are desktop-first; on <code>nw-phone</code>, prefer inline
          labels OR explicit Popover for non-trivial helper content.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "put non-text content in Tooltip — use HoverCard for rich previews",
            "wrap a <button disabled> in Tooltip — disabled buttons can't receive hover events",
            "show tooltips on every element — they're for non-obvious affordances only",
            "pass org_id (A12.1)",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Popover section — shadcn Popover live
// ─────────────────────────────────────────────────────────────────────────
function PopoverSection() {
  return (
    <ComponentSection
      title="Popover"
      source="shadcn (src/components/ui/popover.tsx, codemod-rewritten) — wraps @base-ui/react/popover"
    >
      <SubBlock label="Live popover — click trigger to show">
        <Popover>
          <PopoverTrigger
            render={
              <NwButton variant="secondary">Open popover</NwButton>
            }
          />
          <PopoverContent>
            <PopoverHeader>
              <PopoverTitle>Quick filter</PopoverTitle>
              <PopoverDescription>
                Apply common invoice filters in one click.
              </PopoverDescription>
            </PopoverHeader>
            <div className="flex flex-col gap-2 mt-2">
              <NwButton variant="ghost" size="sm">
                Held by PM
              </NwButton>
              <NwButton variant="ghost" size="sm">
                In QA queue
              </NwButton>
              <NwButton variant="ghost" size="sm">
                Confidence &lt; 70%
              </NwButton>
            </div>
          </PopoverContent>
        </Popover>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1, §13b)">
        <TokenList
          bindings={[
            { token: "--popover", role: "bg" },
            { token: "--popover-foreground", role: "text" },
            { token: "--foreground/10", role: "ring border around popup" },
            { token: "--shadow-md", role: "elevation" },
            { token: "--ring", role: "focus on content" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Base UI Popover primitive: focus moves into popup on open, trap
          until close, Esc to close, focus returns to trigger.{" "}
          <code>aria-expanded</code> on trigger;{" "}
          <code>aria-controls</code> linking trigger to content;{" "}
          <code>role=&quot;dialog&quot;</code> on content if{" "}
          <code>&lt;PopoverTitle&gt;</code> is present. Mobile: positions
          relative to viewport on <code>nw-phone</code>; if popup would
          overflow, Base UI auto-flips side.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "use Popover for primary navigation — that's AppShell",
            "stack Popovers (Popover-inside-Popover) — nesting confuses focus management",
            "put forms inside Popover unless single-input (e.g., add-tag); use Sheet or Modal for multi-field forms",
            "pass org_id (A12.1)",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Confirm section — DOC-STUB (Dialog not installed)
// ─────────────────────────────────────────────────────────────────────────
function ConfirmSection() {
  return (
    <ComponentSection
      title="Confirm (Dialog variant)"
      source="DOC-STUB — Dialog primitive not yet installed (T20f decision per COMPONENTS.md §6.3)"
    >
      <DocStub title="Confirm primitive intent">
        <p
          className="text-[12px] leading-relaxed mb-3"
          style={{ color: "var(--text-secondary)" }}
        >
          Confirm is a specialized Dialog composition with prescribed
          structure: title + body + cancel + destructive-confirm buttons.
          Once <code>shadcn add dialog</code> ships, Confirm becomes a thin
          wrapper. Until then, document intent + visual reference.
        </p>

        {/* Static visual reference of a Confirm — mock the modal card.
            This is a layout illustration, not a live overlay. */}
        <div
          className="mt-4 mx-auto max-w-[420px] border p-5"
          style={{
            borderColor: "var(--border-strong)",
            background: "var(--bg-card)",
          }}
        >
          <div className="flex items-start gap-3 mb-4">
            <span
              aria-hidden="true"
              className="shrink-0 inline-flex items-center justify-center w-9 h-9"
              style={{
                color: "var(--nw-danger)",
                background: "rgba(176,85,78,0.06)",
              }}
            >
              <ExclamationTriangleIcon className="w-5 h-5" strokeWidth={1.5} />
            </span>
            <div>
              <h3
                className="text-[15px] mb-1"
                style={{
                  fontFamily: "var(--font-space-grotesk)",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}
              >
                Void invoice INV-2026-04-0117?
              </h3>
              <p
                className="text-[12px] leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                This invoice will be marked void and removed from any active
                draw. The original record stays in the audit log.
              </p>
            </div>
          </div>
          <div
            className="flex items-center justify-end gap-3 pt-3 border-t"
            style={{ borderColor: "var(--border-default)" }}
          >
            <NwButton variant="ghost">Cancel</NwButton>
            <NwButton variant="danger">
              <TrashIcon
                className="w-4 h-4 mr-2"
                aria-hidden="true"
                strokeWidth={1.5}
              />
              Void invoice
            </NwButton>
          </div>
        </div>
      </DocStub>

      <SubBlock label="Variants (planned)">
        <ul
          className="text-[12px] leading-relaxed space-y-1 pl-4"
          style={{ color: "var(--text-secondary)", listStyle: "disc" }}
        >
          <li>
            <strong style={{ color: "var(--text-primary)" }}>info</strong> —
            neutral confirm (e.g., &ldquo;Save draft?&rdquo;)
          </li>
          <li>
            <strong style={{ color: "var(--text-primary)" }}>warning</strong> —
            (e.g., &ldquo;Unsaved changes — discard?&rdquo;)
          </li>
          <li>
            <strong style={{ color: "var(--text-primary)" }}>destructive</strong>{" "}
            — (e.g., &ldquo;Delete invoice — are you sure?&rdquo;); uses
            NwButton variant <code>danger</code>
          </li>
        </ul>
      </SubBlock>

      <SubBlock label="Token bindings (planned)">
        <TokenList
          bindings={[
            { token: "inherits Modal tokens", role: "popover bg + foreground + ring" },
            { token: "--destructive (--nw-danger)", role: "destructive variant confirm button" },
            { token: "--primary (--nw-stone-blue)", role: "info variant confirm button" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Inherits Modal a11y. <code>&lt;DialogTitle&gt;</code> is the prompt
          text. The confirm button receives initial focus (NOT cancel —
          Nightwork chooses confirm-focus to align with high-stakes
          ergonomics, with Esc always available to cancel — see COMPONENTS.md
          §6.3 rationale).
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "use Confirm for low-stakes actions — auto-saving forms have no confirm",
            "omit destructive styling for delete confirms — visual signal is required (CLAUDE.md 'high-stakes')",
            "use the same label for confirm + cancel (OK / OK)",
            "pass org_id (A12.1)",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 4. HoverCard section — shadcn HoverCard live with vendor preview
// ─────────────────────────────────────────────────────────────────────────
function HoverCardSection() {
  const vendor = SAMPLE_VENDORS.find((v) => v.id === "v-bayside-plumbing")!;

  return (
    <ComponentSection
      title="HoverCard"
      source="shadcn (src/components/ui/hover-card.tsx, codemod-rewritten) — wraps @base-ui/react/preview-card"
    >
      <SubBlock label="Live hover card — vendor preview (desktop only — mouse-over the link)">
        <p
          className="text-[13px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Invoice BAY-2026-04-0117 from{" "}
          <HoverCard>
            <HoverCardTrigger
              render={
                <button
                  type="button"
                  className="underline underline-offset-4"
                  style={{ color: "var(--nw-stone-blue)" }}
                >
                  {vendor.name}
                </button>
              }
            />
            <HoverCardContent>
              <NwEyebrow tone="accent" className="mb-2">
                Vendor
              </NwEyebrow>
              <h3
                className="text-[14px] mb-2"
                style={{
                  fontFamily: "var(--font-space-grotesk)",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}
              >
                {vendor.name}
              </h3>
              <div className="space-y-1.5">
                <NwDataRow
                  layout="horizontal"
                  label="Address"
                  value={
                    <span className="text-[11px]">{vendor.address}</span>
                  }
                />
                <NwDataRow
                  layout="horizontal"
                  label="Phone"
                  value={vendor.phone}
                />
                <NwDataRow
                  layout="horizontal"
                  label="Email"
                  value={vendor.email}
                />
              </div>
            </HoverCardContent>
          </HoverCard>{" "}
          arrived this morning.
        </p>
      </SubBlock>

      <SubBlock label="Token bindings (inherits Popover)">
        <TokenList
          bindings={[
            { token: "--popover", role: "bg" },
            { token: "--popover-foreground", role: "text" },
            { token: "--foreground/10", role: "ring" },
            { token: "--shadow-md", role: "elevation" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Base UI PreviewCard: <code>role=&quot;dialog&quot;</code> on content;
          trigger gets <code>aria-haspopup=&quot;dialog&quot;</code>. Hover OR
          focus on trigger opens; mouse-leave / blur closes. Keyboard users
          can tab into the content while it&rsquo;s open. <strong>Mobile:</strong>{" "}
          HoverCard is desktop-only — touch events have no hover. At{" "}
          <code>nw-phone</code> (touch-primary) prefer Popover (tap-to-show)
          or Sheet for richer previews.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "use HoverCard for critical info — it's an enhancement",
            "nest HoverCard",
            "put forms inside HoverCard (focus management around hover-leave is brittle)",
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
export default function ComponentsOverlaysPage() {
  return (
    <div className="max-w-[1100px]">
      <header
        className="mb-10 pb-6 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <NwEyebrow tone="accent" className="mb-3">
          Components · Overlays
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
          Overlays primitives
        </h1>
        <p
          className="text-[14px] max-w-[680px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          The 4 overlay primitives from COMPONENTS.md §6: Tooltip (live),
          Popover (live), Confirm (doc-stub — Dialog not installed),
          HoverCard (live with vendor preview).
        </p>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <NwBadge variant="success" size="sm">
            <CheckIcon
              className="w-3 h-3 mr-1"
              aria-hidden="true"
              strokeWidth={1.5}
            />
            3 rendered
          </NwBadge>
          <NwBadge variant="warning" size="sm">
            1 doc-stub
          </NwBadge>
        </div>
      </header>

      <TooltipSection />
      <PopoverSection />
      <ConfirmSection />
      <HoverCardSection />
    </div>
  );
}
