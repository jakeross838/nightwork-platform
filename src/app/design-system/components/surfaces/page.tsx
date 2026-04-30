// Design-system playground — components/surfaces (Stage 1.5a, T20b).
//
// Renders the 5 Surfaces entries from COMPONENTS.md §2: Card, Modal (Dialog),
// Drawer, Sheet, Tabs. Card and Drawer are rendered live; Modal/Sheet/Tabs
// are doc-stubs (primitives not yet installed — see installed list at end).
//
// Per nwrp17 — install + codemod is preferred when needed; doc-stub is
// the safer choice at this wave when the design contract is locked but
// installation cost is high. Sibling Wave A confirmed Drawer is installed.
//
// IMPORTANT — token discipline:
//   - All colors via CSS vars (--bg-page, --text-primary, --border-default,
//     etc.) or `nw-*` Tailwind utilities. No hex.
//   - Square corners. The bullet dot in anti-pattern lists uses --radius-dot.
//   - Heroicons outline for new icons. Lucide is contained in shadcn
//     primitives only per A12.2.
//
// IMPORTANT — sample-data isolation (SPEC D9 / hook T10c):
//   - Fixtures imported from `@/app/design-system/_fixtures` only.
//   - No imports from `@/lib/supabase|org|auth`.

"use client";

import {
  CheckIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

import NwButton from "@/components/nw/Button";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwCard from "@/components/nw/Card";
import NwDataRow from "@/components/nw/DataRow";
import NwMoney from "@/components/nw/Money";

import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Input as ShadcnInput } from "@/components/ui/input";

import { SAMPLE_INVOICES, SAMPLE_VENDORS } from "@/app/design-system/_fixtures";

// ─────────────────────────────────────────────────────────────────────────
// Section helpers (same shape as inputs/page.tsx)
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

// Doc-stub container — describes intended composition without rendering.
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
// 1. Card section — NwCard rendered live with sample invoice data
// ─────────────────────────────────────────────────────────────────────────
function CardSection() {
  const sampleInvoice = SAMPLE_INVOICES[0]; // Bayside Plumbing
  const vendor = SAMPLE_VENDORS.find((v) => v.id === sampleInvoice.vendor_id);

  return (
    <ComponentSection
      title="Card"
      source="Custom NwCard (src/components/nw/Card.tsx) — shadcn Card not yet installed; NwCard is canonical"
    >
      {/* Variants — default + inverse */}
      <SubBlock label="Card variants (default theme-aware / inverse always-dark)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[860px]">
          <NwCard variant="default" padding="md">
            <NwEyebrow tone="muted" className="mb-2">
              Default variant
            </NwEyebrow>
            <p
              className="text-[13px] leading-relaxed"
              style={{ color: "var(--text-primary)" }}
            >
              White-on-light page background, slate-deeper background on dark
              theme. Theme-aware. Most common Card usage.
            </p>
          </NwCard>
          <NwCard variant="inverse" padding="md">
            <NwEyebrow tone="muted" className="mb-2">
              Inverse variant
            </NwEyebrow>
            <p className="text-[13px] leading-relaxed">
              Always-dark island. Stays slate-deep regardless of page theme.
              Used for invoice detail right rail islands.
            </p>
          </NwCard>
        </div>
      </SubBlock>

      {/* Padding sizes — none / sm / md (default) / lg */}
      <SubBlock label="Card padding (none / sm / md default / lg)">
        <div className="space-y-3 max-w-[860px]">
          {(["none", "sm", "md", "lg"] as const).map((p) => (
            <NwCard key={p} variant="default" padding={p}>
              <p
                className="text-[12px]"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  color: "var(--text-secondary)",
                }}
              >
                padding=&quot;{p}&quot;
              </p>
            </NwCard>
          ))}
        </div>
      </SubBlock>

      {/* Sample data — invoice card with NwDataRow + NwMoney */}
      <SubBlock label="Composed Card — invoice summary (Bayside Plumbing #BAY-2026-04-0117)">
        <NwCard
          variant="default"
          padding="md"
          className="max-w-[420px]"
        >
          <div className="mb-4 pb-3 border-b" style={{ borderColor: "var(--border-default)" }}>
            <NwEyebrow tone="accent" className="mb-1.5">
              Invoice
            </NwEyebrow>
            <h3
              className="text-[16px] mb-0.5"
              style={{
                fontFamily: "var(--font-space-grotesk)",
                fontWeight: 500,
                letterSpacing: "-0.01em",
                color: "var(--text-primary)",
              }}
            >
              {vendor?.name ?? "Vendor"}
            </h3>
            <p
              className="text-[12px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              #{sampleInvoice.invoice_number}
            </p>
          </div>
          <div className="space-y-2.5">
            <NwDataRow
              layout="horizontal"
              label="Invoice date"
              value={sampleInvoice.invoice_date}
            />
            <NwDataRow
              layout="horizontal"
              label="Total amount"
              value={<NwMoney cents={sampleInvoice.total_amount} size="md" />}
            />
            <NwDataRow
              layout="horizontal"
              label="Status"
              value={
                <NwBadge variant="success" size="sm">
                  PM Approved
                </NwBadge>
              }
            />
          </div>
        </NwCard>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1, §6)">
        <TokenList
          bindings={[
            { token: "--bg-card", role: "default container bg" },
            { token: "--text-primary", role: "default text" },
            { token: "--border-default", role: "container border" },
            { token: "--shadow-hover", role: "interactive Card hover lift" },
            { token: "--nw-slate-deep", role: "inverse variant bg" },
            { token: "--nw-white-sand", role: "inverse variant text" },
            { token: "--radius 0", role: "square corners (SYSTEM §6)" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Plain <code>&lt;div&gt;</code>. Caller may apply <code>role=&quot;region&quot;</code> +
          <code>aria-label</code> for landmarks, or <code>role=&quot;button&quot;</code> +
          tabIndex for clickable cards. <strong>Known gap:</strong> no
          polymorphic <code>as</code> prop — wrap externally to render as
          <code>&lt;section&gt;</code> / <code>&lt;button&gt;</code> /{" "}
          <code>&lt;a&gt;</code>. T20b follow-up may add.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "use Card for short status banners — that's Banner (Feedback §3)",
            "nest Card inside Card without explicit need — visual noise",
            "pass org_id (A12.1)",
            "add oversized border-radius — square per SYSTEM §6",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Modal (Dialog) section — DOC-STUB
// ─────────────────────────────────────────────────────────────────────────
function ModalSection() {
  return (
    <ComponentSection
      title="Modal (Dialog)"
      source="DOC-STUB — shadcn Dialog primitive not yet installed (T20b decision per COMPONENTS.md §2.2)"
    >
      <DocStub title="Dialog primitive intent">
        <p
          className="text-[12px] leading-relaxed mb-3"
          style={{ color: "var(--text-secondary)" }}
        >
          Dialog primitive needs <code>npx shadcn@latest add dialog</code> →
          <code>scripts/shadcn-v3-codemod.ts</code> → manual spot-check.
          DEFERRED to a later wave; this entry describes intended composition.
        </p>
        <p
          className="text-[12px] leading-relaxed mb-3"
          style={{ color: "var(--text-secondary)" }}
        >
          Expected source: <code>@base-ui/react/dialog</code>. Mobile: at{" "}
          <code>nw-phone</code>, sizes md/lg/xl upgrade to full (full-screen
          modal). The composed structure:
        </p>
        <pre
          className="text-[11px] leading-relaxed p-3 border overflow-x-auto"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            background: "var(--bg-page)",
            borderColor: "var(--border-default)",
            color: "var(--text-secondary)",
          }}
        >
{`<Dialog open onOpenChange>
  <DialogTrigger>...</DialogTrigger>
  <DialogContent>
    <DialogTitle>...</DialogTitle>
    <DialogDescription>...</DialogDescription>
    {children}
    <DialogClose>Close</DialogClose>
  </DialogContent>
</Dialog>`}
        </pre>
      </DocStub>

      <SubBlock label="Token bindings (planned)">
        <TokenList
          bindings={[
            { token: "--popover", role: "content bg" },
            { token: "--popover-foreground", role: "content text" },
            { token: "--border-default", role: "content ring" },
            { token: "--shadow-panel", role: "content elevation" },
            { token: "--bg-inverse/0.5", role: "overlay backdrop" },
            { token: "--ring", role: "focus on content" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Base UI Dialog primitive: <code>role=&quot;dialog&quot;</code>,{" "}
          <code>aria-modal=&quot;true&quot;</code>, <code>aria-labelledby</code>{" "}
          from DialogTitle, <code>aria-describedby</code> from
          DialogDescription. Focus trapped inside, Esc to close, focus returns
          to trigger on close.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "use Dialog for confirm-only — use Confirm (Overlays §6.3)",
            "stack Dialogs — Dialog inside Dialog is a UX bug",
            "omit DialogTitle — screen readers need it for orientation",
            "pass org_id (A12.1)",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Drawer section — shadcn Drawer (rendered live)
// ─────────────────────────────────────────────────────────────────────────
function DrawerSection() {
  const sampleInvoice = SAMPLE_INVOICES[1]; // Coastal Carpentry T&M

  return (
    <ComponentSection
      title="Drawer"
      source="shadcn (src/components/ui/drawer.tsx, codemod-rewritten) — wraps vaul@^1.1.2"
    >
      <SubBlock label="Live drawer — phone-up swipeable (default direction: bottom)">
        <Drawer>
          <DrawerTrigger asChild>
            <NwButton variant="primary">Open drawer</NwButton>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Hold this invoice?</DrawerTitle>
              <DrawerDescription>
                Add a brief note for accounting before this invoice is held in
                the queue. The PM gets notified once you submit.
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4 space-y-4">
              <NwCard variant="default" padding="sm">
                <NwDataRow
                  layout="horizontal"
                  label="Invoice"
                  value={sampleInvoice.invoice_number}
                />
                <NwDataRow
                  layout="horizontal"
                  label="Amount"
                  value={
                    <NwMoney cents={sampleInvoice.total_amount} size="md" />
                  }
                />
              </NwCard>
              <div>
                <label
                  htmlFor="hold-reason"
                  className="text-[10px] uppercase mb-1.5 block"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    letterSpacing: "0.14em",
                    color: "var(--text-tertiary)",
                  }}
                >
                  Reason
                </label>
                <ShadcnInput
                  id="hold-reason"
                  type="text"
                  placeholder="e.g. waiting on lien release"
                />
              </div>
            </div>
            <DrawerFooter>
              <NwButton variant="primary">Submit hold</NwButton>
              <DrawerClose asChild>
                <NwButton variant="ghost">Cancel</NwButton>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </SubBlock>

      <SubBlock label="Token bindings (per SYSTEM.md §1, §12b)">
        <TokenList
          bindings={[
            { token: "--popover", role: "content bg" },
            { token: "--popover-foreground", role: "content text" },
            { token: "--muted", role: "handle indicator (bottom drawer)" },
            { token: "--nw-slate-deep/10", role: "overlay backdrop" },
            { token: "--ring", role: "focus" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Vaul provides ARIA dialog pattern: <code>role=&quot;dialog&quot;</code>,
          focus trap, Esc to close. <code>aria-labelledby</code> from
          DrawerTitle. Vaul handles drag gestures with reduced-motion fallback.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "use Drawer for primary navigation — that's AppShell + JobSidebar (§4.1)",
            "nest Drawer inside Drawer",
            "pass org_id (A12.1)",
            "skip the bottom-direction handle indicator — it signals draggability",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Sheet section — DOC-STUB
// ─────────────────────────────────────────────────────────────────────────
function SheetSection() {
  return (
    <ComponentSection
      title="Sheet"
      source="DOC-STUB — shadcn Sheet not yet installed; existing pattern: src/components/slide-out-panel.tsx (custom)"
    >
      <DocStub title="Sheet primitive intent">
        <p
          className="text-[12px] leading-relaxed mb-3"
          style={{ color: "var(--text-secondary)" }}
        >
          Sheet primitive will install via{" "}
          <code>npx shadcn@latest add sheet</code> →{" "}
          <code>scripts/shadcn-v3-codemod.ts</code>. The custom{" "}
          <code>slide-out-panel.tsx</code> already satisfies the visual
          contract for budget drill-downs; migrating to shadcn Sheet is
          deferred.
        </p>
        <p
          className="text-[12px] leading-relaxed mb-3"
          style={{ color: "var(--text-secondary)" }}
        >
          Expected source: <code>@base-ui/react/dialog</code> with
          side-positioning. Variants: <code>top</code> / <code>right</code>{" "}
          (default) / <code>bottom</code> / <code>left</code>. Sizes:{" "}
          <code>sm</code> / <code>md</code> default / <code>lg</code> /{" "}
          <code>xl</code> / <code>full</code>.
        </p>
        <p
          className="text-[12px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Mobile: at <code>nw-phone</code>, side <code>right</code>/
          <code>left</code> upgrades to <code>full</code> (full-screen sheet)
          per SYSTEM §13g (no desktop-shrunk-to-phone anti-pattern).
        </p>
      </DocStub>

      <SubBlock label="Token bindings (planned)">
        <TokenList
          bindings={[
            { token: "--popover", role: "content bg" },
            { token: "--popover-foreground", role: "content text" },
            { token: "--border-default", role: "edge ring" },
            { token: "--shadow-panel", role: "content elevation" },
            { token: "--ring", role: "focus" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Same as Modal — <code>role=&quot;dialog&quot;</code>,{" "}
          <code>aria-modal=&quot;true&quot;</code>, focus trap, Esc to close.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "use Sheet where a Drawer is appropriate — Sheet is desktop-side detail panels, Drawer is phone-up flows",
            "stack Sheets",
            "pass org_id (A12.1)",
          ]}
        />
      </SubBlock>
    </ComponentSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Tabs section — DOC-STUB
// ─────────────────────────────────────────────────────────────────────────
function TabsSection() {
  return (
    <ComponentSection
      title="Tabs"
      source="DOC-STUB — shadcn Tabs not yet installed; existing patterns include budget-costs-sub-tabs.tsx, financial-view-tabs.tsx (ad-hoc)"
    >
      <DocStub title="Tabs primitive intent">
        <p
          className="text-[12px] leading-relaxed mb-3"
          style={{ color: "var(--text-secondary)" }}
        >
          Tabs primitive will install via{" "}
          <code>npx shadcn@latest add tabs</code> →{" "}
          <code>scripts/shadcn-v3-codemod.ts</code>. Replaces ad-hoc tab
          implementations across the app.
        </p>
        <p
          className="text-[12px] leading-relaxed mb-3"
          style={{ color: "var(--text-secondary)" }}
        >
          Expected source: <code>@base-ui/react/tabs</code>. Variants:{" "}
          <code>default</code> (underline-only) / <code>pills</code> (square
          pills, used for sub-section nav).
        </p>
        <pre
          className="text-[11px] leading-relaxed p-3 border overflow-x-auto"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            background: "var(--bg-page)",
            borderColor: "var(--border-default)",
            color: "var(--text-secondary)",
          }}
        >
{`<Tabs value onValueChange>
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="invoices">Invoices</TabsTrigger>
    <TabsTrigger value="draws">Draws</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">...</TabsContent>
  <TabsContent value="invoices">...</TabsContent>
  <TabsContent value="draws">...</TabsContent>
</Tabs>`}
        </pre>
      </DocStub>

      <SubBlock label="Token bindings (planned)">
        <TokenList
          bindings={[
            { token: "--text-secondary", role: "inactive tab" },
            { token: "--text-primary", role: "active tab" },
            { token: "--nw-stone-blue", role: "active underline / brand-accent" },
            { token: "--border-default", role: "separator under tab list" },
            { token: "--bg-subtle", role: "hover bg on triggers" },
            { token: "--ring", role: "focus" },
          ]}
        />
      </SubBlock>

      <SubBlock label="ARIA / a11y">
        <ARIANote>
          Base UI Tabs primitive: <code>role=&quot;tablist&quot;</code>,{" "}
          <code>role=&quot;tab&quot;</code>, <code>aria-selected</code>,{" "}
          <code>aria-controls</code>, <code>aria-labelledby</code>. Keyboard:
          arrow keys to navigate, Home/End for first/last, automatic
          activation on focus (default) or manual on Enter.
        </ARIANote>
      </SubBlock>

      <SubBlock label="Anti-patterns">
        <AntiPatterns
          items={[
            "use Tabs for >7 sections — use a Combobox / Select category picker",
            "use Tabs to swap entire pages — that's routing",
            "nest Tabs (sub-tabs OK if visually distinct, but max 1 level deep)",
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
export default function ComponentsSurfacesPage() {
  return (
    <div className="max-w-[1100px]">
      <header
        className="mb-10 pb-6 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <NwEyebrow tone="accent" className="mb-3">
          Components · Surfaces
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
          Surfaces primitives
        </h1>
        <p
          className="text-[14px] max-w-[680px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          The 5 surfaces primitives from COMPONENTS.md §2: Card, Modal
          (Dialog), Drawer, Sheet, Tabs. <strong>Card</strong> and{" "}
          <strong>Drawer</strong> render live; <strong>Modal</strong>,{" "}
          <strong>Sheet</strong>, <strong>Tabs</strong> are doc-stubs (shadcn
          primitives not yet installed; see SPEC §11.2).
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
            <DocumentTextIcon
              className="w-3 h-3 mr-1"
              aria-hidden="true"
              strokeWidth={1.5}
            />
            3 doc-stubs
          </NwBadge>
        </div>
      </header>

      <CardSection />
      <ModalSection />
      <DrawerSection />
      <SheetSection />
      <TabsSection />
    </div>
  );
}
