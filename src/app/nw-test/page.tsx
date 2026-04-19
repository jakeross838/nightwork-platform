"use client";

// Visual verification page for src/components/nw/* primitives + theme system.
// Renders every variant in context. NOT linked from any nav — direct URL only.
// Adds a theme toggle and a side-by-side light/dark swatch grid so primitives
// can be visually confirmed under both themes without leaving the page.

import Badge from "@/components/nw/Badge";
import Button from "@/components/nw/Button";
import Card from "@/components/nw/Card";
import DataRow from "@/components/nw/DataRow";
import Eyebrow from "@/components/nw/Eyebrow";
import Money from "@/components/nw/Money";
import StatusDot from "@/components/nw/StatusDot";
import { useTheme } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <Eyebrow tone="default" className="mb-2">
        {title}
      </Eyebrow>
      {description ? (
        <p
          className="text-[13px] mb-4 max-w-2xl"
          style={{ color: "var(--text-secondary)" }}
        >
          {description}
        </p>
      ) : null}
      <div>{children}</div>
    </section>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="block mb-3 text-[10px] uppercase"
      style={{
        fontFamily: "var(--font-jetbrains-mono)",
        letterSpacing: "0.14em",
        color: "var(--text-tertiary)",
      }}
    >
      {children}
    </span>
  );
}

// Renders all primitives inside a chosen theme scope. Used by the
// "Light / Dark side-by-side" section. Wraps content in a div with
// `data-theme={theme}` so the [data-theme="dark"] CSS block applies
// locally without affecting the rest of the page.
function PrimitiveShowcase({ theme }: { theme: "light" | "dark" }) {
  return (
    <div
      data-theme={theme}
      className="p-6 border"
      style={{
        background: "var(--bg-page)",
        color: "var(--text-primary)",
        borderColor: "var(--border-default)",
      }}
    >
      <Eyebrow tone="accent" className="mb-4">
        {theme} theme
      </Eyebrow>

      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="primary" size="sm">Primary</Button>
          <Button variant="secondary" size="sm">Secondary</Button>
          <Button variant="ghost" size="sm">Ghost</Button>
          <Button variant="danger" size="sm">Danger</Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="neutral">Received</Badge>
          <Badge variant="info">PM Review</Badge>
          <Badge variant="accent">Awaiting</Badge>
          <Badge variant="success">Approved</Badge>
          <Badge variant="warning">Pending</Badge>
          <Badge variant="danger">Disputed</Badge>
        </div>

        <Card>
          <Eyebrow className="mb-2">Card</Eyebrow>
          <p className="text-[13px]">
            Card surface — bg-card var swaps with theme. Body copy uses
            text-primary.
          </p>
        </Card>

        <div className="flex items-baseline gap-4 flex-wrap">
          <Money cents={482000000} variant="emphasized" size="xl" />
          <Money cents={-25000} signColor />
          <Money cents={null} />
        </div>

        <div className="flex items-center gap-4 flex-wrap text-[13px]">
          <span className="inline-flex items-center gap-2"><StatusDot variant="active" /> Active</span>
          <span className="inline-flex items-center gap-2"><StatusDot variant="pending" /> Pending</span>
          <span className="inline-flex items-center gap-2"><StatusDot variant="info" /> Info</span>
          <span className="inline-flex items-center gap-2"><StatusDot variant="danger" /> Danger</span>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-3 max-w-md">
          <DataRow label="Vendor" value="Harborline Plumbing" />
          <DataRow
            label="Total"
            value={<Money cents={1860000} variant="emphasized" size="lg" />}
          />
          <DataRow layout="horizontal" label="Net due" value={<Money cents={17503750} variant="emphasized" />} />
          <DataRow layout="horizontal" label="Previous" value={<Money cents={-2890000} signColor />} />
        </div>
      </div>
    </div>
  );
}

export default function NwTestPage() {
  const { theme } = useTheme();

  return (
    <main
      className="min-h-screen"
      style={{
        background: "var(--bg-page)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-inter)",
      }}
    >
      <div className="mx-auto max-w-[1180px] px-8 py-10">
        <header
          className="mb-12 pb-6 border-b flex items-start justify-between gap-6"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div>
            <Eyebrow tone="accent" className="mb-3">
              Slate Primitives · /nw-test
            </Eyebrow>
            <h1
              className="text-[30px] mb-2"
              style={{
                fontFamily: "var(--font-space-grotesk)",
                letterSpacing: "-0.02em",
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              Nightwork UI primitives
            </h1>
            <p className="text-[14px] max-w-2xl" style={{ color: "var(--text-secondary)" }}>
              Visual verification surface. Active theme:{" "}
              <code
                className="px-1.5 py-0.5 border text-[12px]"
                style={{
                  borderColor: "var(--border-default)",
                  background: "var(--bg-card)",
                  fontFamily: "var(--font-jetbrains-mono)",
                }}
              >
                {theme}
              </code>
              . Toggle with the button on the right; choice persists via{" "}
              <code style={{ fontFamily: "var(--font-jetbrains-mono)" }}>nw_theme</code> cookie.
            </p>
          </div>
          <div className="shrink-0">
            <ThemeToggle />
          </div>
        </header>

        {/* SIDE-BY-SIDE THEMES */}
        <Section
          title="Light / Dark side-by-side"
          description="Both blocks render the same primitives — left forced light, right forced dark. Independent of the page-level toggle, so you can verify both themes simultaneously."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PrimitiveShowcase theme="light" />
            <PrimitiveShowcase theme="dark" />
          </div>
        </Section>

        {/* BUTTON */}
        <Section title="Button" description="Primary, secondary, ghost, danger × sm/md/lg, plus disabled/loading.">
          <div className="space-y-6">
            <div>
              <SubLabel>Primary</SubLabel>
              <div className="flex items-center gap-3 flex-wrap">
                <Button variant="primary" size="sm">Approve</Button>
                <Button variant="primary" size="md">Approve &amp; release →</Button>
                <Button variant="primary" size="lg">Push to QuickBooks →</Button>
                <Button variant="primary" disabled>Disabled</Button>
                <Button variant="primary" loading>Saving</Button>
              </div>
            </div>
            <div>
              <SubLabel>Secondary</SubLabel>
              <div className="flex items-center gap-3 flex-wrap">
                <Button variant="secondary" size="sm">Edit</Button>
                <Button variant="secondary" size="md">Request changes</Button>
                <Button variant="secondary" size="lg">View invoice</Button>
                <Button variant="secondary" disabled>Disabled</Button>
                <Button variant="secondary" loading>Loading</Button>
              </div>
            </div>
            <div>
              <SubLabel>Ghost</SubLabel>
              <div className="flex items-center gap-3 flex-wrap">
                <Button variant="ghost" size="sm">Cancel</Button>
                <Button variant="ghost" size="md">Skip for now</Button>
                <Button variant="ghost" size="lg">More options</Button>
                <Button variant="ghost" disabled>Disabled</Button>
              </div>
            </div>
            <div>
              <SubLabel>Danger</SubLabel>
              <div className="flex items-center gap-3 flex-wrap">
                <Button variant="danger" size="sm">Void</Button>
                <Button variant="danger" size="md">Reject invoice</Button>
                <Button variant="danger" size="lg">Delete draw</Button>
                <Button variant="danger" disabled>Disabled</Button>
              </div>
            </div>
          </div>
        </Section>

        {/* BADGE */}
        <Section title="Badge" description="Bordered status pills — never filled. JetBrains Mono 10px, 0.14em tracking.">
          <div className="space-y-4">
            <div>
              <SubLabel>Variants — small (default)</SubLabel>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="neutral">Received</Badge>
                <Badge variant="info">PM Review</Badge>
                <Badge variant="accent">Awaiting You</Badge>
                <Badge variant="success">QA Approved</Badge>
                <Badge variant="warning">Over Allowance</Badge>
                <Badge variant="danger">Disputed</Badge>
              </div>
            </div>
            <div>
              <SubLabel>Variants — medium</SubLabel>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="neutral" size="md">Received</Badge>
                <Badge variant="success" size="md">In Draw</Badge>
                <Badge variant="warning" size="md">Pending</Badge>
                <Badge variant="danger" size="md">Void</Badge>
              </div>
            </div>
          </div>
        </Section>

        {/* CARD */}
        <Section title="Card" description="White card on sand (default) or slate-deep inverse for right rails.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card>
              <Eyebrow className="mb-2">Default Card</Eyebrow>
              <p className="text-[14px] mb-3">
                White background, 1px slate border, no border radius. Default 20px
                padding (md). This is the baseline for most surfaces.
              </p>
              <Button variant="primary" size="sm">View</Button>
            </Card>
            <Card variant="inverse">
              <Eyebrow tone="muted" className="mb-2" style={{ color: "rgba(247,245,236,0.5)" }}>
                Inverse Card
              </Eyebrow>
              <p className="text-[14px] mb-3 text-nw-white-sand">
                Slate-deep background, light text. Used for the right-rail in the
                Slate Invoice Detail reference.
              </p>
              <Money cents={1860000} variant="emphasized" size="xl" className="text-nw-white-sand" />
            </Card>
            <Card padding="sm">
              <Eyebrow className="mb-1">Padding · sm</Eyebrow>
              <p className="text-[13px]">12px padding for compact contexts.</p>
            </Card>
            <Card padding="lg">
              <Eyebrow className="mb-1">Padding · lg</Eyebrow>
              <p className="text-[13px]">24px padding for headline content.</p>
            </Card>
          </div>
        </Section>

        {/* EYEBROW */}
        <Section title="Eyebrow" description="Tracked uppercase labels — the most-repeated motif in the system.">
          <div className="space-y-3">
            <div><Eyebrow>Default · muted slate</Eyebrow></div>
            <div><Eyebrow tone="default">Default · slate-tile</Eyebrow></div>
            <div><Eyebrow tone="accent">Accent · stone-blue</Eyebrow></div>
            <div><Eyebrow tone="warn">⚠ Warn · awaiting your approval · due apr 25</Eyebrow></div>
            <div><Eyebrow tone="success">Success · qa approved</Eyebrow></div>
            <div><Eyebrow tone="danger">Danger · disputed</Eyebrow></div>
            <div>
              <Eyebrow
                tone="accent"
                icon={
                  <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 10h14M10 3v14" />
                  </svg>
                }
              >
                With inline icon
              </Eyebrow>
            </div>
          </div>
        </Section>

        {/* MONEY */}
        <Section title="Money" description="Tabular nums, JetBrains Mono. cents → formatted dollars (matches DB convention).">
          <div className="space-y-4">
            <div>
              <SubLabel>Sizes</SubLabel>
              <div className="flex items-baseline gap-6 flex-wrap">
                <Money cents={482000000} size="sm" />
                <Money cents={482000000} size="md" />
                <Money cents={482000000} size="lg" />
                <Money cents={482000000} size="xl" variant="emphasized" />
              </div>
            </div>
            <div>
              <SubLabel>Variants</SubLabel>
              <div className="flex items-baseline gap-6 flex-wrap">
                <Money cents={175037} />
                <Money cents={-25000} variant="negative" />
                <Money cents={2890000} variant="emphasized" size="lg" />
                <Money cents={null} />
                <Money cents={0} variant="muted" />
              </div>
            </div>
            <div>
              <SubLabel>Sign coloring (auto negative → danger)</SubLabel>
              <div className="flex items-baseline gap-6 flex-wrap">
                <Money cents={50000} signColor />
                <Money cents={-50000} signColor />
              </div>
            </div>
            <div>
              <SubLabel>Whole dollars + tabular alignment</SubLabel>
              <Card padding="sm" className="max-w-sm">
                <table className="w-full text-[13px]">
                  <tbody>
                    <tr><td className="py-1">Framing</td><td className="py-1 text-right"><Money cents={29800000} /></td></tr>
                    <tr><td className="py-1">Drywall</td><td className="py-1 text-right"><Money cents={11200000} /></td></tr>
                    <tr><td className="py-1">Plumbing</td><td className="py-1 text-right"><Money cents={13400000} /></td></tr>
                    <tr><td className="py-1">Electrical</td><td className="py-1 text-right"><Money cents={18600000} /></td></tr>
                    <tr style={{ borderTop: "1px solid var(--border-strong)" }}>
                      <td className="pt-2 font-medium">Total</td>
                      <td className="pt-2 text-right"><Money cents={73000000} variant="emphasized" /></td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            </div>
          </div>
        </Section>

        {/* STATUS DOT */}
        <Section title="StatusDot" description="The other rounded primitive — small status indicators.">
          <div className="flex items-center gap-6 flex-wrap">
            <span className="inline-flex items-center gap-2 text-[13px]">
              <StatusDot variant="active" label="Active" />
              Active
            </span>
            <span className="inline-flex items-center gap-2 text-[13px]">
              <StatusDot variant="pending" label="Pending" />
              Pending
            </span>
            <span className="inline-flex items-center gap-2 text-[13px]">
              <StatusDot variant="info" label="Info" />
              Info
            </span>
            <span className="inline-flex items-center gap-2 text-[13px]">
              <StatusDot variant="danger" label="Danger" />
              Danger
            </span>
            <span className="inline-flex items-center gap-2 text-[13px]">
              <StatusDot variant="inactive" label="Inactive" />
              Inactive
            </span>
            <span className="inline-flex items-center gap-2 text-[13px]">
              <StatusDot variant="active" size="sm" label="Active small" />
              Active · sm
            </span>
          </div>
        </Section>

        {/* DATA ROW */}
        <Section title="DataRow" description="Label + value pattern from the Slate Invoice Detail right rail.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card>
              <Eyebrow className="mb-4">Stacked (default)</Eyebrow>
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <DataRow label="Total amount" value={<Money cents={1860000} variant="emphasized" size="xl" />} />
                <DataRow label="Net after retainage" value={<Money cents={1674000} variant="emphasized" size="xl" />} />
                <DataRow label="Vendor" value="Harborline Plumbing" />
                <DataRow label="Project" value="Anna Maria — Hanlon" />
                <DataRow label="Received" value="Apr 17, 2026" />
                <DataRow label="Due" value="May 17, 2026" />
              </div>
            </Card>
            <Card variant="inverse">
              <Eyebrow tone="muted" className="mb-4" style={{ color: "rgba(247,245,236,0.5)" }}>
                Inverse · stacked
              </Eyebrow>
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <DataRow inverse label="Total amount" value={<Money cents={1860000} className="text-nw-white-sand" size="xl" />} />
                <DataRow inverse label="Vendor" value={<span className="text-nw-stone-blue underline">Harborline ↗</span>} />
                <DataRow inverse label="Received" value={<span className="text-nw-white-sand">Apr 17 · 10:04 AM</span>} />
                <DataRow inverse label="Due" value={<span className="text-nw-white-sand">May 17 · Net 30</span>} />
              </div>
            </Card>
            <Card className="md:col-span-2">
              <Eyebrow className="mb-4">Horizontal layout</Eyebrow>
              <div className="max-w-md space-y-1">
                <DataRow layout="horizontal" label="Original contract" value={<Money cents={482000000} />} />
                <DataRow layout="horizontal" label="Net change orders" value={<Money cents={28500000} signColor />} />
                <DataRow layout="horizontal" label="Contract to date" value={<Money cents={510500000} variant="emphasized" />} />
                <DataRow layout="horizontal" label="Less previous" value={<Money cents={-289000000} signColor />} />
                <DataRow layout="horizontal" label="Current due" variant="danger" value={<Money cents={17503750} variant="emphasized" />} />
              </div>
            </Card>
          </div>
        </Section>
      </div>
    </main>
  );
}
