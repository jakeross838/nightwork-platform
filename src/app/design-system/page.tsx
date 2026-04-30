// Design-system playground — Stage 1.5a T19.
//
// Doorway for the playground. Surfaces 6 sections (Components / Palette /
// Typography / Patterns / Philosophy / Forbidden) as cards with a
// 1-paragraph "what this is" + "why look at it" summary. Sibling agents
// in Wave B build the destination pages; this index just lists them.
//
// Token discipline: no hex; everything via CSS vars or nw-* utilities.
// Type via Space Grotesk for the title, JetBrains Mono for eyebrows,
// Inter for body — same approach as nw-test/page.tsx.

import Link from "next/link";
import {
  Squares2X2Icon,
  SwatchIcon,
  Bars3BottomLeftIcon,
  RectangleGroupIcon,
  SparklesIcon,
  NoSymbolIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";

// Each entry: where you go, what you see, why it matters at CP2.
// CP2 = Strategic Checkpoint #2 — Jake picks PHILOSOPHY direction +
// PALETTE set after walking the playground. Sections marked "CP2"
// are decision-driving; sections marked "REF" are reference docs.
const SECTIONS: Array<{
  href: string;
  label: string;
  Icon: typeof Squares2X2Icon;
  blurb: string;
  why: string;
  tag: "CP2" | "REF";
}> = [
  {
    href: "/design-system/components/inputs",
    label: "Components",
    Icon: Squares2X2Icon,
    blurb:
      "Every primitive in COMPONENTS.md rendered live across 6 category pages: inputs, surfaces, feedback, navigation, data display, overlays. Each component shows its variants, states, token bindings, and anti-patterns.",
    why: "Compare how the playbook reads in the browser vs the doc. Spot any feel-wrong primitive before downstream pages depend on it.",
    tag: "REF",
  },
  {
    href: "/design-system/palette",
    label: "Palette",
    Icon: SwatchIcon,
    blurb:
      "Slate palette Set A (Jake brief candidate — cooler stone-blue, lighter dark slate, new warm-gray token) and Set B (current implementation — what colors_and_type.css resolves to today) rendered side-by-side with per-token contrast labels. Exact hex values are visible on the palette page itself.",
    why: "CP2 visual pick. Set B clears more WCAG AA-normal pairings on dark; Set A reads slightly cooler. See which hue you actually want to live with.",
    tag: "CP2",
  },
  {
    href: "/design-system/typography",
    label: "Typography",
    Icon: Bars3BottomLeftIcon,
    blurb:
      "Slate type system rendered: Space Grotesk (display, 400/500, -0.02em tracking), Inter (body, 14-15px), JetBrains Mono (eyebrows + money, 10-11px UPPERCASE, 0.14em tracking, tabular-nums).",
    why: "Confirm the type stack feels like construction-back-office (Linear/Stripe-adjacent) and not marketing-page (Calibri/system-font generic).",
    tag: "REF",
  },
  {
    href: "/design-system/patterns",
    label: "Patterns",
    Icon: RectangleGroupIcon,
    blurb:
      "Each of the 12 PATTERNS.md entries as a static layout: Document Review (gold standard), Dashboard, Settings, List+Detail, Wizard, Empty Workspace, Print View, Mobile Approval, Reconciliation (4 candidate models), AppShell, Audit Timeline, File Uploader.",
    why: "Verify the page-pattern catalogue covers every real Nightwork screen. Reconciliation strawman is the riskiest — pick a model at 1.5b mock-up time.",
    tag: "REF",
  },
  {
    href: "/design-system/philosophy",
    label: "Philosophy",
    Icon: SparklesIcon,
    blurb:
      "3 distinct directions (Helm + Brass / Specimen / Site Office), each with thesis + would/wouldn't + concrete invoice-review + dashboard + mobile-approval renders. Pick one at CP2 — the choice locks every subsequent UI phase.",
    why: "CP2 directional pick. Each direction has a 'Pick this direction' button (T24.1) that writes the choice to .planning/design/CHOSEN-DIRECTION.md. Locked DRAFT until CP2.",
    tag: "CP2",
  },
  {
    href: "/design-system/forbidden",
    label: "Forbidden",
    Icon: NoSymbolIcon,
    blurb:
      "Visual examples of every Forbidden item with a 'DO NOT' overlay: bouncy easing, generic gradients, purple/pink accents, dark glows, oversized rounded corners, marketing-page typography on internal screens, phone-app-trying-to-be-desktop, desktop-trying-to-be-phone-app.",
    why: "Reference for what we're saying NO to. Every reject reflects an A2.1 quantified threshold — bouncy = cubic-bezier 4th arg ≥ 1.0, purple = HSL hue 270°-320°, etc.",
    tag: "REF",
  },
];

export default function DesignSystemIndexPage() {
  return (
    <div className="max-w-[1100px]">
      {/* Header — eyebrow + title + intro paragraph. Matches nw-test header
          shape so the design feels consistent with the rest of the
          playground. */}
      <header className="mb-10 pb-6 border-b" style={{ borderColor: "var(--border-default)" }}>
        <Eyebrow tone="accent" className="mb-3">
          Stage 1.5a · Strategic Checkpoint #2
        </Eyebrow>
        <h1
          className="text-[34px] mb-3"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.02em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Nightwork design system
        </h1>
        <p
          className="text-[14px] max-w-[680px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Six sections, six decisions to make. Browse Components / Palette /
          Typography / Patterns to confirm the foundations. Walk Philosophy to
          pick a direction at CP2 — the chosen direction locks every UI phase
          from 1.5b onward. Forbidden lists what we&rsquo;re saying NO to so
          downstream work doesn&rsquo;t drift.
        </p>
      </header>

      {/* Section grid — 1 col on phone, 2 on tablet+. Each Card uses the
          default variant (white on sand) with stacked Eyebrow + title +
          blurb + "why" + arrow. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {SECTIONS.map((section) => {
          const { Icon } = section;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-stone-blue/40"
            >
              <Card
                padding="lg"
                className="h-full transition-colors duration-150 group-hover:border-[var(--border-strong)]"
              >
                {/* Eyebrow row — icon + label + tag */}
                <div className="flex items-center justify-between mb-3">
                  <Eyebrow
                    tone="default"
                    icon={
                      <Icon
                        className="w-3.5 h-3.5"
                        aria-hidden="true"
                        strokeWidth={1.5}
                      />
                    }
                  >
                    {section.label}
                  </Eyebrow>
                  <Badge variant={section.tag === "CP2" ? "accent" : "neutral"}>
                    {section.tag === "CP2" ? "CP2 pick" : "Reference"}
                  </Badge>
                </div>

                {/* Title — Space Grotesk, smaller than the page H1. */}
                <h2
                  className="text-[18px] mb-2"
                  style={{
                    fontFamily: "var(--font-space-grotesk)",
                    letterSpacing: "-0.01em",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                  }}
                >
                  {section.label}
                </h2>

                {/* Body — Inter 13px / leading-relaxed. */}
                <p
                  className="text-[13px] mb-3 leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {section.blurb}
                </p>

                {/* Why-it-matters — italic, smaller, muted. */}
                <p
                  className="text-[12px] mb-5 leading-relaxed italic"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {section.why}
                </p>

                {/* CTA arrow — uses Heroicons outline; no underline, just
                    the chevron and stone-blue accent. */}
                <span
                  className="inline-flex items-center gap-1.5 text-[10px] uppercase font-medium"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    letterSpacing: "0.14em",
                    color: "var(--nw-stone-blue)",
                  }}
                >
                  Open
                  <ArrowRightIcon
                    className="w-3 h-3 transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden="true"
                    strokeWidth={1.5}
                  />
                </span>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Footer note — playground access posture + how to navigate. Helps
          first-time visitors understand the gate without surfacing it
          loudly. */}
      <footer
        className="mt-10 pt-6 border-t text-[11px] leading-relaxed"
        style={{
          borderColor: "var(--border-default)",
          color: "var(--text-tertiary)",
        }}
      >
        <p className="mb-1">
          Internal playground · Production access gated to platform admins ·
          Sample data only — no Drummond, no real Ross Built records.
        </p>
        <p>
          Use the sidebar to jump between sections. The direction + palette
          switchers in the top nav drive the philosophy / palette / patterns
          pages.
        </p>
      </footer>
    </div>
  );
}
