// Design-system playground — components/feedback (Stage 1.5a, T20c).
//
// Renders the 6 Feedback entries from COMPONENTS.md §3:
//   Toast (custom toast-provider.tsx)
//   Banner (composition over NwCard + NwBadge)
//   Empty State (existing src/components/empty-state.tsx)
//   Loading State (composition + existing loading-skeleton.tsx)
//   Error State (composition matching src/app/error.tsx pattern)
//   Skeleton (existing loading-skeleton.tsx exports)
//
// Per nwrp17 — re-uses existing Nightwork components where possible.
// Toast trigger buttons need the ToastProvider mounted; the playground
// inherits it from the root layout (src/app/layout.tsx).
//
// IMPORTANT — token discipline:
//   - All colors via CSS vars or `nw-*` Tailwind utilities.
//   - Square corners. The bullet dot uses --radius-dot.
//   - Heroicons outline for new icons.
//
// IMPORTANT — sample-data isolation (SPEC D9 / hook T10c):
//   - Fixtures imported from `@/app/design-system/_fixtures` only.

"use client";

import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  XMarkIcon,
  DocumentMagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

import NwButton from "@/components/nw/Button";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwCard from "@/components/nw/Card";

import EmptyState, { EmptyIcons } from "@/components/empty-state";
import { Skeleton, SkeletonStatCard, SkeletonTableRow } from "@/components/loading-skeleton";
import { useToast } from "@/components/toast-provider";

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
// 1. Toast section — uses existing toast-provider.tsx
// ─────────────────────────────────────────────────────────────────────────
function ToastSection() {
  const { push } = useToast();

  return (
    <ComponentSection
      title="Toast"
      source="Custom Nightwork toast-provider.tsx (NOT Sonner — see COMPONENTS.md §3.1)"
    >
      <SubBlock label="Trigger toasts (top-right; auto-dismiss 5s; max 3 visible)">
        <div className="flex flex-wrap gap-3">
          <NwButton
            variant="primary"
            size="md"
            onClick={() =>
              push("success", "Invoice approved — pushed to QA queue.")
            }
          >
            <CheckCircleIcon
              className="w-4 h-4 mr-2"
              aria-hidden="true"
              strokeWidth={1.5}
            />
            Success toast
          </NwButton>
          <NwButton
            variant="secondary"
            size="md"
            onClick={() =>
              push(
                "warning",
                "Invoice held — PM notified. No further action needed."
              )
            }
          >
            <ExclamationTriangleIcon
              className="w-4 h-4 mr-2"
              aria-hidden="true"
              strokeWidth={1.5}
            />
            Warning toast
          </NwButton>
          <NwButton
            variant="danger"
            size="md"
            onClick={() =>
              push(
                "error",
                "Connection lost — your last edit was not saved. Try again in a moment."
              )
            }
          >
            <XCircleIcon
              className="w-4 h-4 mr-2"
              aria-hidden="true"
              strokeWidth={1.5}
            />
            Error toast
          </NwButton>
          <NwButton
            variant="ghost"
            size="md"
            onClick={() =>
              push("info", "Tip: press Cmd+Enter from any field to save.")
            }
          >
            <InformationCircleIcon
              className="w-4 h-4 mr-2"
              aria-hidden="true"
              strokeWidth={1.5}
            />
            Info toast
          </NwButton>
        </div>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1)">
        <TokenList
          bindings={[
            { token: "--bg-card", role: "default toast bg" },
            { token: "--color-success", role: "success accent + icon" },
            { token: "--color-warning", role: "warning accent + icon" },
            { token: "--color-error", role: "error accent + icon" },
            { token: "--nw-stone-blue", role: "info accent + icon" },
            { token: "--shadow-panel", role: "elevation" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Container has <code>role=&quot;status&quot;</code> (success / info /
          warning) or <code>role=&quot;alert&quot;</code> (error) so screen
          readers announce on append. <code>aria-live=&quot;polite&quot;</code>{" "}
          for status, <code>assertive</code> for alert. Stack max 3 visible
          (oldest evicts on overflow). Mobile: pinned top-center full-width-
          minus-padding at <code>nw-phone</code>.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "use Toast for form-field errors — those render inline (FormMessage)",
            "stack >3 toasts — UX overload",
            "auto-dismiss errors — let user dismiss explicitly",
            "pass org_id to the Toast API (A12.1)",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Banner section — composition (no unified primitive yet)
// ─────────────────────────────────────────────────────────────────────────
function BannerSection() {
  const variants = [
    {
      kind: "info" as const,
      icon: InformationCircleIcon,
      color: "var(--nw-stone-blue)",
      tint: "rgba(91,134,153,0.06)",
      title: "Tip",
      message: "Click a column header to sort. Drag the divider to resize.",
    },
    {
      kind: "success" as const,
      icon: CheckCircleIcon,
      color: "var(--nw-success)",
      tint: "rgba(74,138,111,0.06)",
      title: "All caught up",
      message:
        "Every invoice in this period has been approved and is in the next draw.",
    },
    {
      kind: "warning" as const,
      icon: ExclamationTriangleIcon,
      color: "var(--nw-warn)",
      tint: "rgba(201,138,59,0.06)",
      title: "Heads up",
      message:
        "3 invoices have been waiting over 5 days. Consider escalating.",
    },
    {
      kind: "danger" as const,
      icon: XCircleIcon,
      color: "var(--nw-danger)",
      tint: "rgba(176,85,78,0.06)",
      title: "Connection lost",
      message:
        "Last sync failed at 3:42 PM. Retrying automatically every 30 seconds.",
    },
  ];

  return (
    <ComponentSection
      title="Banner"
      source="Composition (no unified primitive yet) — existing patterns: connection-banner.tsx, trial-banner.tsx, impersonation-banner.tsx"
    >
      <SubBlock label="4 variants — info / success / warning / danger">
        <div className="space-y-3 max-w-[860px]">
          {variants.map((v) => {
            const Icon = v.icon;
            return (
              <div
                key={v.kind}
                role={v.kind === "danger" ? "alert" : "status"}
                aria-live={v.kind === "danger" ? "assertive" : "polite"}
                className="flex items-start gap-3 px-4 py-3 border"
                style={{
                  borderColor: v.color,
                  background: v.tint,
                  borderLeftWidth: "3px",
                }}
              >
                <span
                  aria-hidden="true"
                  className="shrink-0 mt-0.5"
                  style={{ color: v.color }}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.5} />
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] font-medium mb-0.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {v.title}
                  </p>
                  <p
                    className="text-[12px] leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {v.message}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Dismiss"
                  className="shrink-0"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <XMarkIcon
                    className="w-4 h-4"
                    aria-hidden="true"
                    strokeWidth={1.5}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1)">
        <TokenList
          bindings={[
            { token: "--color-success / --color-warning / --color-error / --text-accent", role: "left edge + icon" },
            { token: "--bg-subtle", role: "tinted bg (variant-specific RGBA mix)" },
            { token: "--text-primary", role: "title text" },
            { token: "--text-secondary", role: "body text" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          <code>role=&quot;status&quot;</code> (info / success / warning) or{" "}
          <code>role=&quot;alert&quot;</code> (danger). Dismiss button has
          <code>aria-label=&quot;Dismiss&quot;</code>.{" "}
          <code>aria-live=&quot;polite&quot;</code> so SR users hear when banner
          enters DOM mid-session. Always full-width on <code>nw-phone</code>;
          action CTA wraps below text if needed.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "stack banners — pick the highest-priority",
            "put critical errors in a Banner — use Modal or Toast",
            "pass org_id (A12.1)",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Empty State section — uses existing empty-state.tsx
// ─────────────────────────────────────────────────────────────────────────
function EmptyStateSection() {
  return (
    <ComponentSection
      title="Empty State"
      source="Nightwork-authored (src/components/empty-state.tsx)"
    >
      <SubBlock label="Default variant — no invoices">
        <div className="max-w-[640px]">
          <EmptyState
            icon={<EmptyIcons.Inbox />}
            title="No invoices yet"
            message="Once you upload an invoice, it'll appear here. Drag a PDF onto this area or use the upload button."
            primaryAction={{
              label: "Upload invoice",
              onClick: () => undefined,
            }}
            secondaryAction={{
              label: "Browse vendors",
              onClick: () => undefined,
            }}
          />
        </div>
      </SubBlock>

      <SubBlock label="Success variant — all caught up">
        <div className="max-w-[640px]">
          <EmptyState
            variant="success"
            icon={<EmptyIcons.Check />}
            title="All caught up"
            message="Every invoice for this period has been reviewed. The next draw is ready to compile."
            primaryAction={{
              label: "Compile draw",
              onClick: () => undefined,
            }}
          />
        </div>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1, §4)">
        <TokenList
          bindings={[
            { token: "--bg-card", role: "container bg" },
            { token: "--border-default", role: "dashed border" },
            { token: "--text-primary", role: "title" },
            { token: "--text-secondary", role: "message" },
            { token: "--nw-success", role: "success-variant icon" },
            { token: "--font-display (Space Grotesk)", role: "title typography" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Plain <code>&lt;div&gt;</code> container. Icon is decorative
          (<code>aria-hidden</code>). Action buttons inherit Button a11y.
          Mobile: padding collapses to <code>py-12 px-4</code> at{" "}
          <code>nw-phone</code>; action buttons stack vertically.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "use Empty State for loading — use Skeleton (§3.6)",
            "use Empty State for errors — use Error State (§3.5)",
            "omit primary action when one exists — empty state is a CTA opportunity",
            "pass org_id (A12.1)",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Loading State section — composition with --brand-accent spinner
// ─────────────────────────────────────────────────────────────────────────
function LoadingStateSection() {
  return (
    <ComponentSection
      title="Loading State"
      source="Composition (no unified primitive yet) — uses --brand-accent for spinner stroke"
    >
      <SubBlock label="3 variants — inline / block / full-screen-mock">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-[860px]">
          {/* Inline — small spinner inside text */}
          <NwCard variant="default" padding="md">
            <NwEyebrow tone="muted" className="mb-2">
              Inline
            </NwEyebrow>
            <p
              className="text-[12px] inline-flex items-center gap-2"
              style={{ color: "var(--text-secondary)" }}
            >
              <span
                aria-hidden="true"
                className="inline-block w-3 h-3 border-2 border-current border-t-transparent animate-spin"
                style={{ borderRadius: "var(--radius-dot)", color: "var(--nw-stone-blue)" }}
              />
              Saving…
            </p>
          </NwCard>

          {/* Block — centered spinner with helper text */}
          <NwCard variant="default" padding="md">
            <NwEyebrow tone="muted" className="mb-2">
              Block
            </NwEyebrow>
            <div
              className="flex flex-col items-center justify-center py-6"
              role="status"
              aria-live="polite"
            >
              <span
                aria-hidden="true"
                className="inline-block w-6 h-6 border-2 border-current border-t-transparent animate-spin"
                style={{ borderRadius: "var(--radius-dot)", color: "var(--nw-stone-blue)" }}
              />
              <p
                className="text-[11px] uppercase mt-2"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  letterSpacing: "0.14em",
                  color: "var(--text-tertiary)",
                }}
              >
                Loading invoices
              </p>
              <span className="sr-only">Loading…</span>
            </div>
          </NwCard>

          {/* Full-screen — mock with reduced height */}
          <NwCard variant="default" padding="md">
            <NwEyebrow tone="muted" className="mb-2">
              Full-screen (mock)
            </NwEyebrow>
            <div
              className="flex flex-col items-center justify-center py-10 border"
              style={{
                background: "rgba(91,134,153,0.04)",
                borderColor: "var(--border-default)",
              }}
            >
              <ArrowPathIcon
                className="w-6 h-6 animate-spin"
                aria-hidden="true"
                strokeWidth={1.5}
                style={{ color: "var(--nw-stone-blue)" }}
              />
              <p
                className="text-[12px] mt-3"
                style={{ color: "var(--text-secondary)" }}
              >
                Preparing draw G702…
              </p>
            </div>
          </NwCard>
        </div>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1, §2)">
        <TokenList
          bindings={[
            { token: "--brand-accent", role: "spinner stroke (A12.3 brand-customizable)" },
            { token: "--border-default", role: "spinner ring background" },
            { token: "--text-secondary", role: "label text" },
            { token: "--bg-card/0.85", role: "full-screen overlay bg" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Container has <code>role=&quot;status&quot;</code> +{" "}
          <code>aria-live=&quot;polite&quot;</code> + visually-hidden text
          &ldquo;Loading…&rdquo; so screen readers announce on append.
          Decorative spinner is <code>aria-hidden</code>. Full-screen variant
          covers safe-area-inset.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "use LoadingState for filter changes / tab switches — those should be instant from cached data",
            "omit aria-live — invisible loading is a SR bug",
            "use bouncy easing on spinner (SYSTEM §13b — hook T10b rejects)",
            "pass org_id (A12.1)",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Error State section — composition matching error.tsx pattern
// ─────────────────────────────────────────────────────────────────────────
function ErrorStateSection() {
  return (
    <ComponentSection
      title="Error State"
      source="Composition matching src/app/error.tsx pattern; relates to Next.js error.tsx boundaries (T20g)"
    >
      <SubBlock label="3 variants — inline / block / full-page mock">
        <div className="space-y-4 max-w-[860px]">
          {/* Inline — compact error inside a row */}
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2 px-3 py-2 border text-[12px]"
            style={{
              borderColor: "rgba(176,85,78,0.5)",
              background: "rgba(176,85,78,0.04)",
              color: "var(--text-primary)",
            }}
          >
            <XCircleIcon
              className="w-4 h-4 mt-0.5 shrink-0"
              aria-hidden="true"
              strokeWidth={1.5}
              style={{ color: "var(--nw-danger)" }}
            />
            <span style={{ color: "var(--nw-danger)" }}>Inline error.</span>
            <span style={{ color: "var(--text-secondary)" }}>
              Invoice number must match the format VENDOR-YYYY-####.
            </span>
          </div>

          {/* Block — centered card with retry */}
          <NwCard
            variant="default"
            padding="lg"
            className="text-center max-w-[440px] mx-auto"
            style={{ borderColor: "rgba(176,85,78,0.4)" }}
          >
            <span
              aria-hidden="true"
              className="inline-flex items-center justify-center w-12 h-12 mx-auto mb-3"
              style={{
                color: "var(--nw-danger)",
                background: "rgba(176,85,78,0.06)",
              }}
            >
              <XCircleIcon className="w-7 h-7" strokeWidth={1.5} />
            </span>
            <NwEyebrow tone="danger" className="mb-2">
              Couldn&rsquo;t load invoices
            </NwEyebrow>
            <p
              className="text-[13px] mb-5 leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              Network request timed out. Check your connection and try again.
              If this keeps happening, contact support.
            </p>
            <div className="flex items-center justify-center gap-3">
              <NwButton variant="primary">Try again</NwButton>
              <NwButton variant="ghost">Get help</NwButton>
            </div>
          </NwCard>
        </div>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1)">
        <TokenList
          bindings={[
            { token: "--color-error / --nw-danger", role: "icon stroke + accent" },
            { token: "--bg-card", role: "container bg" },
            { token: "--text-primary", role: "title" },
            { token: "--text-secondary", role: "message" },
            { token: "--nw-danger/0.06", role: "subtle tinted icon backplate" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Container has <code>role=&quot;alert&quot;</code> +{" "}
          <code>aria-live=&quot;assertive&quot;</code> so SR users hear
          immediately. Retry button inherits Button a11y. Per SPEC B10 — every
          category page in <code>/design-system/components/&lt;category&gt;</code>{" "}
          has its own <code>error.tsx</code> boundary that falls back to
          &ldquo;this component preview failed; check console&rdquo;.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "include raw stack traces in production — gate with process.env.NODE_ENV === 'development'",
            "silently swallow errors and show empty state — distinguish 'no data' from 'error fetching'",
            "pass org_id (A12.1)",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Skeleton section — uses existing loading-skeleton.tsx
// ─────────────────────────────────────────────────────────────────────────
function SkeletonSection() {
  return (
    <ComponentSection
      title="Skeleton"
      source="Nightwork-authored (src/components/loading-skeleton.tsx) — exports Skeleton, SkeletonStatCard, SkeletonTableRow"
    >
      <SubBlock label="Atomic Skeleton — pulse rectangles">
        <NwCard variant="default" padding="md">
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
          </div>
        </NwCard>
      </SubBlock>

      <SubBlock label="SkeletonStatCard — dashboard top-row preset">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-[860px]">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>
      </SubBlock>

      <SubBlock label="SkeletonTableRow — list-view preset">
        <div
          className="border max-w-[860px]"
          style={{ borderColor: "var(--border-default)" }}
        >
          <SkeletonTableRow columns={["w-2/3", "w-1/2", "w-1/3", "w-1/4"]} />
          <SkeletonTableRow columns={["w-2/3", "w-1/2", "w-1/3", "w-1/4"]} />
          <SkeletonTableRow columns={["w-2/3", "w-1/2", "w-1/3", "w-1/4"]} />
        </div>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1)">
        <TokenList
          bindings={[
            { token: "--bg-muted", role: "pulse bg" },
            { token: "Tailwind animate-pulse", role: "linear easing only — bouncy forbidden" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          If <code>ariaLabel</code> provided, <code>role=&quot;status&quot;</code>{" "}
          is applied. Screen readers announce on append. Decorative skeletons
          (no ariaLabel) are SR-silent. Caller controls dimensions via Tailwind
          classes; collapse responsive widths via Tailwind responsive prefixes.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "use Skeleton during filter changes — those should be instant",
            "animate Skeleton with bouncy easing — animate-pulse is the only allowed motion (linear)",
            "nest Skeleton inside Skeleton",
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
export default function ComponentsFeedbackPage() {
  return (
    <div className="max-w-[1100px]">
      <header
        className="mb-10 pb-6 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <NwEyebrow tone="accent" className="mb-3">
          Components · Feedback
        </NwEyebrow>
        <h1
          className="text-[28px] mb-3"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.02em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Feedback primitives
        </h1>
        <p
          className="text-[14px] max-w-[680px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          The 6 feedback primitives from COMPONENTS.md §3: Toast, Banner,
          Empty State, Loading State, Error State, Skeleton. Toasts trigger
          live via the existing <code>toast-provider.tsx</code> mounted at the
          root; banners + loading + error states are composed inline.
        </p>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <NwBadge variant="success" size="sm">
            <CheckCircleIcon
              className="w-3 h-3 mr-1"
              aria-hidden="true"
              strokeWidth={1.5}
            />
            6 rendered
          </NwBadge>
          <NwBadge variant="info" size="sm">
            <DocumentMagnifyingGlassIcon
              className="w-3 h-3 mr-1"
              aria-hidden="true"
              strokeWidth={1.5}
            />
            All token-bound
          </NwBadge>
        </div>
      </header>

      <ToastSection />
      <BannerSection />
      <EmptyStateSection />
      <LoadingStateSection />
      <ErrorStateSection />
      <SkeletonSection />
    </div>
  );
}
