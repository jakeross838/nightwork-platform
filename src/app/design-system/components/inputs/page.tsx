// Design-system playground — components/inputs (Stage 1.5a, T20a).
//
// Renders the 6 Inputs entries from COMPONENTS.md §1: Button, Input, Select,
// Combobox, DatePicker, Form. Each entry shows variants + states + token
// bindings (cited from SYSTEM.md) + sample data from _fixtures + ARIA notes
// + anti-patterns.
//
// IMPORTANT — token discipline:
//   - All colors via CSS vars (--bg-page, --text-primary, --border-default,
//     etc.) or `nw-*` Tailwind utilities. No hex.
//   - Square corners only. The bullet-dot in anti-pattern lists uses inline
//     border-radius via --radius-dot (the documented avatar/dot exception
//     per SYSTEM.md §1f / §6).
//   - Heroicons outline for new icons. Lucide is contained in shadcn
//     primitives only per A12.2.
//
// IMPORTANT — sample-data isolation (SPEC D9 / hook T10c):
//   - Fixtures imported from `@/app/design-system/_fixtures` only.
//   - No imports from `@/lib/supabase|org|auth`.
//
// Per planner M-P2 — existing inline SVG migration is OUT OF SCOPE; we use
// Heroicons for new icons in this page only.

"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  CalendarIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

import NwButton from "@/components/nw/Button";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwCard from "@/components/nw/Card";

import { Button as ShadcnButton } from "@/components/ui/button";
import { Input as ShadcnInput } from "@/components/ui/input";
import { Textarea as ShadcnTextarea } from "@/components/ui/textarea";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

import { SAMPLE_VENDORS } from "@/app/design-system/_fixtures";

// Page-level utility: a labelled section grouper. Matches the index page +
// sibling category pages so navigation feels consistent.
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

// Sub-grouper inside a Section for variants / states / tokens / a11y / anti-patterns.
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

// Token binding pretty-print. JetBrains Mono with explicit token name +
// "what it does" gloss. Cites SYSTEM.md for verifiability.
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
            <span style={{ color: "var(--text-tertiary)" }}>
              {" "}
              · {b.role}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Anti-patterns list — bulleted "DO NOT". Renders as a danger-tinted card.
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
            {/* Bullet dot — uses inline border-radius via --radius-dot per
                SYSTEM §1f (the avatars-and-dots exception to square corners). */}
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

// Caption helper for "(simulated)" tag below state demonstrations.
function SimulatedCaption() {
  return (
    <p
      className="text-[10px] mt-1"
      style={{
        fontFamily: "var(--font-jetbrains-mono)",
        letterSpacing: "0.12em",
        color: "var(--text-tertiary)",
      }}
    >
      (simulated)
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Button section — NwButton + shadcn Button references
// ─────────────────────────────────────────────────────────────────────────
function ButtonSection() {
  return (
    <ComponentSection
      title="Button"
      source="Custom NwButton (src/components/nw/Button.tsx) + shadcn (src/components/ui/button.tsx, codemod-rewritten)"
    >
      {/* Variants — NwButton */}
      <SubBlock label="NwButton variants">
        <div className="flex flex-wrap items-center gap-3">
          <NwButton variant="primary">Primary</NwButton>
          <NwButton variant="secondary">Secondary</NwButton>
          <NwButton variant="ghost">Ghost</NwButton>
          <NwButton variant="danger">Danger</NwButton>
        </div>
      </SubBlock>

      {/* Variants — shadcn Button (rendered for parity) */}
      <SubBlock label="shadcn Button variants (for shadcn-internal composition only)">
        <div className="flex flex-wrap items-center gap-3">
          <ShadcnButton variant="default">Default</ShadcnButton>
          <ShadcnButton variant="outline">Outline</ShadcnButton>
          <ShadcnButton variant="secondary">Secondary</ShadcnButton>
          <ShadcnButton variant="ghost">Ghost</ShadcnButton>
          <ShadcnButton variant="destructive">Destructive</ShadcnButton>
          <ShadcnButton variant="link">Link</ShadcnButton>
        </div>
      </SubBlock>

      {/* Sizes — NwButton */}
      <SubBlock label="NwButton sizes (sm 30 / md 36 / lg 44)">
        <div className="flex flex-wrap items-center gap-3">
          <NwButton size="sm">Small</NwButton>
          <NwButton size="md">Medium</NwButton>
          <NwButton size="lg">Large</NwButton>
        </div>
      </SubBlock>

      {/* States — primary variant, 6 states in a 2x3 grid. Hover + focus
          are simulated via ring/border styles since CSS pseudo-classes
          only fire on actual pointer/keyboard input. */}
      <SubBlock label="NwButton states (primary)">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-[640px]">
          <div>
            <NwButton variant="primary">Default</NwButton>
            <p
              className="text-[10px] mt-1"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
                color: "var(--text-tertiary)",
              }}
            >
              default
            </p>
          </div>
          <div>
            {/* Simulated hover — apply hover styles directly */}
            <button
              type="button"
              className="h-[36px] px-4 text-[11px] inline-flex items-center justify-center gap-2 uppercase font-medium leading-none transition-colors duration-150 bg-nw-gulf-blue text-nw-white-sand border border-nw-gulf-blue"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
              }}
            >
              Hover
            </button>
            <SimulatedCaption />
          </div>
          <div>
            {/* Simulated focus-visible — apply ring directly */}
            <button
              type="button"
              className="h-[36px] px-4 text-[11px] inline-flex items-center justify-center gap-2 uppercase font-medium leading-none bg-nw-stone-blue text-nw-white-sand border border-nw-stone-blue ring-2 ring-nw-stone-blue/40 ring-offset-1"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
              }}
            >
              Focus-visible
            </button>
            <SimulatedCaption />
          </div>
          <div>
            {/* Simulated active — apply micro-shift directly */}
            <button
              type="button"
              className="h-[36px] px-4 text-[11px] inline-flex items-center justify-center gap-2 uppercase font-medium leading-none bg-nw-stone-blue text-nw-white-sand border border-nw-stone-blue translate-y-px"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
              }}
            >
              Active
            </button>
            <SimulatedCaption />
          </div>
          <div>
            <NwButton variant="primary" disabled>
              Disabled
            </NwButton>
            <p
              className="text-[10px] mt-1"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
                color: "var(--text-tertiary)",
              }}
            >
              disabled
            </p>
          </div>
          <div>
            <NwButton variant="primary" loading>
              Loading
            </NwButton>
            <p
              className="text-[10px] mt-1"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
                color: "var(--text-tertiary)",
              }}
            >
              loading
            </p>
          </div>
        </div>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1, §4c, §6, §12b)">
        <TokenList
          bindings={[
            { token: "--nw-stone-blue", role: "primary bg + brand-accent" },
            { token: "--nw-gulf-blue", role: "primary hover bg (T12 patch — AA-normal)" },
            { token: "--nw-white-sand", role: "primary text" },
            { token: "--text-primary", role: "secondary/ghost text" },
            { token: "--border-strong", role: "secondary outline" },
            { token: "--bg-subtle", role: "secondary/ghost hover bg" },
            { token: "--nw-danger", role: "danger color + ring" },
            { token: "--font-jetbrains-mono", role: "label typography" },
            { token: "letter-spacing 0.12em", role: "--tracking-button (SYSTEM §4c)" },
            { token: "--radius 0", role: "square corners (SYSTEM §6)" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Native <code>&lt;button&gt;</code> with <code>type=&quot;button&quot;</code> default. Disabled
          propagates pointer-events-none. focus-visible:ring-2 ring-nw-stone-blue/40
          ring-offset-1 per SYSTEM §12b. <strong>Known gap:</strong> loading does
          NOT yet set <code>aria-busy=&quot;true&quot;</code> — flagged for T20a follow-up
          per COMPONENTS.md §14.2. <strong>Touch-target gap:</strong> sm (30px) and
          md (36px) below WCAG 2.5.5 44px minimum; use lg on mobile.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "pass org_id / membership / vendor_id props (A12.1 violation; hook C8 rejects)",
            "use shadcn Button default size for high-stakes mobile actions (fails WCAG 2.5.5 44px)",
            "add oversized border-radius utilities — square corners only per SYSTEM §6; hook T10b rejects",
            "hardcode raw hex values (use design tokens — bg-nw-stone-blue or bg-primary instead)",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Input section — shadcn Input
// ─────────────────────────────────────────────────────────────────────────
function InputSection() {
  return (
    <ComponentSection
      title="Input"
      source="shadcn (src/components/ui/input.tsx, codemod-rewritten)"
    >
      <SubBlock label="Variants by type prop (text / email / password / number / tel / url)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[680px]">
          <div>
            <label
              className="text-[10px] uppercase mb-1.5 block"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Text
            </label>
            <ShadcnInput type="text" placeholder="Vendor name" />
          </div>
          <div>
            <label
              className="text-[10px] uppercase mb-1.5 block"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Email
            </label>
            <ShadcnInput type="email" placeholder="ar@vendor.example" />
          </div>
          <div>
            <label
              className="text-[10px] uppercase mb-1.5 block"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Number (amount in dollars)
            </label>
            <ShadcnInput type="number" placeholder="0.00" step="0.01" />
          </div>
          <div>
            <label
              className="text-[10px] uppercase mb-1.5 block"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Tel
            </label>
            <ShadcnInput type="tel" placeholder="(941) 555-0204" />
          </div>
        </div>
      </SubBlock>

      <SubBlock label="Input states (default / focus-visible / disabled / aria-invalid)">
        <div className="grid grid-cols-2 gap-4 max-w-[680px]">
          <div>
            <ShadcnInput placeholder="Default" />
            <p
              className="text-[10px] mt-1"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
                color: "var(--text-tertiary)",
              }}
            >
              default
            </p>
          </div>
          <div>
            {/* Simulated focus-visible — apply ring directly */}
            <input
              type="text"
              defaultValue="focused"
              className="h-8 w-full rounded-none border border-ring px-2.5 py-1 text-base ring-3 ring-ring/50 bg-transparent outline-none"
            />
            <SimulatedCaption />
          </div>
          <div>
            <ShadcnInput placeholder="Disabled" disabled />
            <p
              className="text-[10px] mt-1"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
                color: "var(--text-tertiary)",
              }}
            >
              disabled
            </p>
          </div>
          <div>
            <ShadcnInput
              defaultValue="invalid value"
              aria-invalid="true"
            />
            <p
              className="text-[10px] mt-1"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
                color: "var(--nw-danger)",
              }}
            >
              aria-invalid
            </p>
          </div>
        </div>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1, §4, §12b)">
        <TokenList
          bindings={[
            { token: "--input", role: "border (alias of --border-default)" },
            { token: "--background", role: "bg (alias of --bg-page)" },
            { token: "--foreground", role: "text (alias of --text-primary)" },
            { token: "--muted-foreground", role: "placeholder (--text-secondary)" },
            { token: "--ring", role: "focus-visible ring (--nw-stone-blue)" },
            { token: "--destructive", role: "aria-invalid ring + border" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Native <code>&lt;input&gt;</code> via Base UI. focus-visible:border-ring + ring-3
          ring-ring/50. disabled: pointer-events-none, cursor-not-allowed,
          bg-input/50. <code>aria-invalid=&quot;true&quot;</code> swaps to destructive ring.
          Placeholder uses <code>placeholder:text-muted-foreground</code> (passes AA-large
          at 3:1 — see CONTRAST-MATRIX.md). <strong>Touch target:</strong> h-8 = 32px
          desktop; bump to h-11 (44px) on <code>nw-phone</code> for mobile.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "nest Input inside Button (use InputGroup composition)",
            "hardcode raw placeholder color via Tailwind named color utilities; use the design token (placeholder:text-muted-foreground)",
            "pass org_id (A12.1 violation)",
            "reach into the value via DOM — use React state",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 2.5 Textarea section — shadcn Textarea (react-textarea-autosize)
// Added per nwrp18-A — primitive upgraded to auto-grow with min/max bounds.
// ─────────────────────────────────────────────────────────────────────────
function TextareaSection() {
  return (
    <ComponentSection
      title="Textarea"
      source="shadcn (src/components/ui/textarea.tsx) wraps react-textarea-autosize per nwrp18-A"
    >
      <SubBlock label="Default — auto-grow from minRows=4 (~80px) to maxRows=12 (~240px)">
        <div className="max-w-[680px]">
          <ShadcnTextarea placeholder="Type a longer note. The textarea grows up to 12 rows; after that internal scroll kicks in." />
        </div>
      </SubBlock>

      <SubBlock label="minRows=2 — compact form usage (line-item descriptions, chat input)">
        <div className="max-w-[680px]">
          <ShadcnTextarea
            minRows={2}
            placeholder="Compact 2-row default for inline rows."
          />
        </div>
      </SubBlock>

      <SubBlock label="minRows=6 — long-form input (cover letter, draw notes)">
        <div className="max-w-[680px]">
          <ShadcnTextarea
            minRows={6}
            placeholder="Larger surface for editorial / template content."
            defaultValue={
              "Project: Drummond residence\nDraw 8 cover letter — period 2026-04-01 to 2026-04-30.\n\nThis cover letter accompanies the AIA G702/G703 application for payment.\n\nAll line items reflect work completed and inspected per cost code allocation."
            }
          />
        </div>
      </SubBlock>

      <SubBlock label="States (default / disabled / aria-invalid)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[680px]">
          <div>
            <ShadcnTextarea defaultValue="Default — focused state shows --nw-stone-blue border on focus" />
            <p
              className="text-[10px] mt-1"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
                color: "var(--text-tertiary)",
              }}
            >
              default
            </p>
          </div>
          <div>
            <ShadcnTextarea
              disabled
              defaultValue="Disabled — locked while saving / read-only"
            />
            <p
              className="text-[10px] mt-1"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
                color: "var(--text-tertiary)",
              }}
            >
              disabled
            </p>
          </div>
          <div className="md:col-span-2">
            <ShadcnTextarea
              aria-invalid="true"
              defaultValue="Invalid — error state highlights border with --color-error"
            />
            <p
              className="text-[10px] mt-1"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
                color: "var(--nw-danger)",
              }}
            >
              aria-invalid
            </p>
          </div>
        </div>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1, §4, §6, §12b)">
        <TokenList
          bindings={[
            { token: "--bg-subtle", role: "default bg" },
            { token: "--bg-muted", role: "disabled bg" },
            { token: "--border-default", role: "default border" },
            { token: "--nw-stone-blue", role: "focus border" },
            { token: "--color-error", role: "aria-invalid border" },
            { token: "--text-primary", role: "value text" },
            { token: "--text-secondary", role: "placeholder text" },
            { token: "--radius 0", role: "square corners (SYSTEM §6)" },
            { token: "13px text-size", role: "tighter than Input — matches proposal/invoice form density" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Native <code>&lt;textarea&gt;</code> via{" "}
          <code>react-textarea-autosize</code>. Auto-grow respects content
          height with internal scroll past <code>maxRows</code>. Disabled
          adds <code>cursor-not-allowed + opacity-60 + bg-muted</code>.{" "}
          <code>aria-invalid=&quot;true&quot;</code> swaps border to{" "}
          <code>--color-error</code>. Ref forwarding preserved via{" "}
          <code>React.forwardRef</code> for <code>useRef&lt;HTMLTextAreaElement&gt;</code>{" "}
          callers (autoFocus, scroll-into-view, etc.).
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "use a raw <textarea> with rows={N} — silently truncates long content; the primitive auto-grows up to maxRows=12 then scrolls internally",
            "set a fixed h-N height class (e.g. h-24) — disables auto-grow; pass minRows / maxRows props instead",
            "hardcode bg / border / focus styles — primitive owns the token bindings; consumer-side overrides via className for site-specific contexts only",
            "pass org_id / membership / vendor_id props (A12.1 violation; hook C8 rejects)",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Select section — DOC-STUB (primitive not yet installed)
// ─────────────────────────────────────────────────────────────────────────
function SelectSection() {
  return (
    <ComponentSection
      title="Select"
      source="DOC-STUB — shadcn Select primitive not yet installed (Wave B decision per COMPONENTS.md §1.3)"
    >
      <NwCard variant="default" padding="md">
        <div className="space-y-3">
          <p
            className="text-[12px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            <strong style={{ color: "var(--text-primary)" }}>
              T20a decision point:
            </strong>{" "}
            Select primitive needs <code>npx shadcn@latest add select</code> →{" "}
            <code>scripts/shadcn-v3-codemod.ts</code> → manual spot-check.
            DEFERRED to a later wave; this entry describes intended composition.
          </p>
          <p
            className="text-[12px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Expected source: <code>@base-ui/react/select</code> (consistent with
            shadcn 4.x registry default — same library family as Combobox /
            Tooltip / Popover). Variants will mirror Combobox&rsquo;s surface
            (key differentiator: Select has NO filtering — use Combobox for
            &gt;7 options or any need to type-to-find).
          </p>
          <p
            className="text-[12px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Mobile behavior on <code>nw-phone</code>: Base UI Select renders as
            a native <code>&lt;select&gt;</code> for OS-aligned keyboard
            experience.
          </p>
        </div>
      </NwCard>

      <SubBlock label="Token bindings (planned)">
        <TokenList
          bindings={[
            { token: "--popover", role: "content bg" },
            { token: "--popover-foreground", role: "items text" },
            { token: "--accent", role: "hover/highlighted item" },
            { token: "--ring", role: "focus" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y (planned)">
        <ARIANote>
          Base UI Select primitive supports keyboard nav (arrow keys, Home/End,
          type-to-select), <code>aria-expanded</code>, <code>aria-haspopup=&quot;listbox&quot;</code>,
          <code>aria-activedescendant</code> per ARIA listbox spec.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "use <select> for >7 options where filtering is needed — use Combobox §1.4",
            "pass org_id (A12.1 violation)",
            "nest Select inside Combobox — they overlap; pick one",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Combobox section — shadcn Combobox + sample vendor data
// ─────────────────────────────────────────────────────────────────────────
function ComboboxSection() {
  return (
    <ComponentSection
      title="Combobox"
      source="shadcn (src/components/ui/combobox.tsx, codemod-rewritten) — wraps @base-ui/react/combobox"
    >
      <SubBlock label="Live combobox — vendor picker (10 fictional vendors from _fixtures/vendors)">
        <div className="max-w-[420px]">
          <Combobox items={SAMPLE_VENDORS}>
            <ComboboxInput placeholder="Type to filter vendors…" showTrigger />
            <ComboboxContent>
              <ComboboxEmpty>No vendors match</ComboboxEmpty>
              <ComboboxList>
                {SAMPLE_VENDORS.map((v) => (
                  <ComboboxItem key={v.id} value={v}>
                    <span className="flex flex-col gap-0.5">
                      <span style={{ color: "var(--text-primary)" }}>
                        {v.name}
                      </span>
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {v.address.split(",").slice(-2).join(",").trim()}
                      </span>
                    </span>
                  </ComboboxItem>
                ))}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1, §6)">
        <TokenList
          bindings={[
            { token: "--popover", role: "popup bg" },
            { token: "--popover-foreground", role: "popup text" },
            { token: "--accent", role: "highlighted item bg" },
            { token: "--accent-foreground", role: "highlighted item text" },
            { token: "--muted-foreground", role: "placeholder" },
            { token: "--border-default", role: "input border + popup ring" },
            { token: "--radius 0", role: "square corners (SYSTEM §6)" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Base UI Combobox supports <code>aria-expanded</code>, <code>aria-controls</code>,
          <code>aria-activedescendant</code>, <code>aria-autocomplete=&quot;list&quot;</code>.
          Keyboard: arrow up/down to nav, Enter to select, Esc to close,
          type-to-filter. Tab moves focus out. Touch target on items needs
          ≥44px row height — use <code>density=&quot;comfortable&quot;</code> from SYSTEM §10.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "pass vendor_id (A12.1) — use a generic value prop that the domain wrapper resolves",
            "import lucide-react in domain code; chevron + clear inside combobox.tsx are scoped exception (A12.2)",
            "use Combobox for <5 options — use Select",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 5. DatePicker section — Calendar + Popover composition
// ─────────────────────────────────────────────────────────────────────────
function DatePickerSection() {
  const [date, setDate] = useState<Date | undefined>(new Date("2026-04-22"));

  return (
    <ComponentSection
      title="DatePicker"
      source="shadcn Calendar (src/components/ui/calendar.tsx) + Popover composition — wraps react-day-picker@^9.14.0"
    >
      <SubBlock label="Live picker — sample invoice date (Bayside Plumbing #BAY-2026-04-0117)">
        <div className="flex items-center gap-3 max-w-[420px]">
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className="h-8 px-3 text-[12px] inline-flex items-center gap-2 border bg-transparent"
                  style={{
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-inter)",
                  }}
                >
                  <CalendarIcon
                    className="w-4 h-4"
                    aria-hidden="true"
                    strokeWidth={1.5}
                  />
                  {date
                    ? date.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "Pick a date"}
                  <ChevronDownIcon
                    className="w-3 h-3 ml-2"
                    aria-hidden="true"
                    strokeWidth={1.5}
                  />
                </button>
              }
            />
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                defaultMonth={new Date("2026-04-01")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1, §10)">
        <TokenList
          bindings={[
            { token: "--background", role: "calendar bg" },
            { token: "--foreground", role: "day label" },
            { token: "--accent", role: "selected day" },
            { token: "--accent-foreground", role: "selected day text" },
            { token: "--muted-foreground", role: "outside-month days, weekday labels" },
            { token: "--ring", role: "focus on day cell" },
            { token: "--primary", role: "today indicator" },
            { token: "--cell-size 1.75rem desktop / 44px nw-phone", role: "touch-target compliance" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          DayPicker emits ARIA grid pattern: <code>role=&quot;grid&quot;</code>,{" "}
          <code>aria-label=&quot;&lt;Month Year&gt;&quot;</code>,{" "}
          <code>role=&quot;gridcell&quot;</code> per day. Keyboard: arrow keys move 1
          day, PageUp/PageDown 1 month, Home/End start/end of week, Enter to
          select. Default <code>--cell-size:1.75rem</code> (28px) is BELOW WCAG;
          override to 44px on <code>nw-phone</code>.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "roll your own calendar — use Calendar + Popover composition",
            "store dates as strings — use Date objects, format on render",
            "pass org_id (A12.1)",
            "use this for date-time pairs; DateTime composition is deferred",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Form section — composed Input + Select-stub + Combobox + DatePicker
// ─────────────────────────────────────────────────────────────────────────
function FormSection() {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(new Date("2026-04-22"));
  const [amount, setAmount] = useState("18,600.00");

  // Find vendor by ID for display
  const vendor = SAMPLE_VENDORS.find((v) => v.id === vendorId) ?? null;

  return (
    <ComponentSection
      title="Form"
      source="DOC-STUB primitive (planned) + composed example — react-hook-form + Zod planned at T20a follow-up"
    >
      <SubBlock label="Composed form — invoice intake mock">
        <NwCard variant="default" padding="md" className="max-w-[640px]">
          <p
            className="text-[12px] mb-5 leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            This is a static composition (no react-hook-form binding) — the
            shadcn Form primitive isn&rsquo;t installed yet. Each field uses an
            existing primitive: Combobox for vendor, Calendar+Popover for date,
            Input for invoice number + amount.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vendor — combobox */}
            <div>
              <label
                htmlFor="form-vendor"
                className="text-[10px] uppercase mb-1.5 block"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  letterSpacing: "0.14em",
                  color: "var(--text-tertiary)",
                }}
              >
                Vendor
              </label>
              <Combobox
                items={SAMPLE_VENDORS}
                value={vendor}
                onValueChange={(v) => {
                  // v is the SampleVendor item (or null)
                  if (v && typeof v === "object" && "id" in v) {
                    setVendorId((v as { id: string }).id);
                  } else {
                    setVendorId(null);
                  }
                }}
              >
                <ComboboxInput
                  id="form-vendor"
                  placeholder="Select vendor…"
                  showTrigger
                />
                <ComboboxContent>
                  <ComboboxEmpty>No vendors match</ComboboxEmpty>
                  <ComboboxList>
                    {SAMPLE_VENDORS.map((v) => (
                      <ComboboxItem key={v.id} value={v}>
                        {v.name}
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>

            {/* Date — popover + calendar */}
            <div>
              <label
                htmlFor="form-date"
                className="text-[10px] uppercase mb-1.5 block"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  letterSpacing: "0.14em",
                  color: "var(--text-tertiary)",
                }}
              >
                Invoice date
              </label>
              <Popover>
                <PopoverTrigger
                  render={
                    <button
                      id="form-date"
                      type="button"
                      className="h-8 w-full px-3 text-[12px] inline-flex items-center gap-2 border bg-transparent"
                      style={{
                        borderColor: "var(--border-default)",
                        color: "var(--text-primary)",
                        fontFamily: "var(--font-inter)",
                      }}
                    >
                      <CalendarIcon
                        className="w-4 h-4"
                        aria-hidden="true"
                        strokeWidth={1.5}
                      />
                      {date
                        ? date.toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "Pick date"}
                    </button>
                  }
                />
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={setDate} />
                </PopoverContent>
              </Popover>
            </div>

            {/* Invoice number — input */}
            <div>
              <label
                htmlFor="form-invoice-number"
                className="text-[10px] uppercase mb-1.5 block"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  letterSpacing: "0.14em",
                  color: "var(--text-tertiary)",
                }}
              >
                Invoice number
              </label>
              <ShadcnInput
                id="form-invoice-number"
                type="text"
                placeholder="e.g. BAY-2026-04-0117"
              />
            </div>

            {/* Total — input */}
            <div>
              <label
                htmlFor="form-amount"
                className="text-[10px] uppercase mb-1.5 block"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  letterSpacing: "0.14em",
                  color: "var(--text-tertiary)",
                }}
              >
                Total amount
              </label>
              <ShadcnInput
                id="form-amount"
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div
            className="mt-6 pt-5 border-t flex items-center justify-end gap-3"
            style={{ borderColor: "var(--border-default)" }}
          >
            <NwButton variant="ghost" size="md">
              Cancel
            </NwButton>
            <NwButton variant="primary" size="md">
              Save invoice
            </NwButton>
          </div>
        </NwCard>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1, §4, §12b)">
        <TokenList
          bindings={[
            { token: "--text-primary", role: "label text" },
            { token: "--text-secondary", role: "description text" },
            { token: "--destructive", role: "error message + invalid border" },
            { token: "--ring", role: "focus on input" },
            { token: "--border-default", role: "input border" },
            { token: "--font-jetbrains-mono + tracking-eyebrow", role: "FormLabel typography (SYSTEM §4c)" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          When the shadcn Form primitive lands: <code>FormLabel htmlFor</code> +
          <code>FormControl id</code> association; <code>FormMessage role=&quot;alert&quot;</code> with{" "}
          <code>aria-live=&quot;polite&quot;</code> for errors;{" "}
          <code>FormDescription</code> linked via <code>aria-describedby</code>;{" "}
          <code>aria-invalid</code> toggled by validation state. <strong>Mobile:</strong>{" "}
          horizontal forms collapse to vertical at <code>nw-phone</code>.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "bypass FormField — uncontrolled Inputs scattered without form wrapping break validation feedback",
            "use plain <label> — use FormLabel for the htmlFor wiring",
            "display errors as toasts — toasts are for cross-page events; field errors render inline",
            "pass org_id to Form / FormField (A12.1)",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Page assembly
// ─────────────────────────────────────────────────────────────────────────
export default function ComponentsInputsPage() {
  return (
    <div className="max-w-[1100px]">
      {/* Page header — matches /design-system/page.tsx + index style */}
      <header
        className="mb-10 pb-6 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <NwEyebrow tone="accent" className="mb-3">
          Components · Inputs
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
          Inputs primitives
        </h1>
        <p
          className="text-[14px] max-w-[680px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          The 7 input primitives from COMPONENTS.md §1: Button, Input, Textarea,
          Select, Combobox, DatePicker, Form. Each shows variants, states, token
          bindings cited from SYSTEM.md, ARIA notes, and anti-patterns. Sample
          data flows from <code>_fixtures/</code> only — no <code>@/lib/</code> imports.
        </p>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <NwBadge variant="info" size="sm">
            7 components
          </NwBadge>
          <NwBadge variant="warning" size="sm">
            2 doc-stubs (Select, Form)
          </NwBadge>
          <NwBadge variant="accent" size="sm">
            <CheckIcon
              className="w-3 h-3 mr-1"
              aria-hidden="true"
              strokeWidth={1.5}
            />
            Tokens-only
          </NwBadge>
        </div>
      </header>

      <ButtonSection />
      <InputSection />
      <TextareaSection />
      <SelectSection />
      <ComboboxSection />
      <DatePickerSection />
      <FormSection />
    </div>
  );
}
