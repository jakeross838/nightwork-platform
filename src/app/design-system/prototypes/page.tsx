// src/app/design-system/prototypes/page.tsx
//
// Prototype gallery index — landing page for /design-system/prototypes/.
// Lists the 10 prototype routes that validate the design system on
// real-shape Caldwell data per Stage 1.5b expanded scope.
//
// All 10 sections inherit Site Office + Set B from prototypes/layout.tsx
// (per CONTEXT D-02). Token discipline enforced — no hardcoded hex.
//
// Wave 0 disposition: this index ships as the empty-state landing.
// Wave 1 plans (01.5-2 through 01.5-5) build the destination prototype
// pages. Until they ship, every Card link points to a Wave 1 / Wave 2
// route that will 404 — the index itself renders cleanly so Jake can
// verify the locked Site Office direction + Set B palette + Card grid
// pattern at Wave 0 HALT (per plan task 4 verification step 6).
//
// Hook T10c — no imports from @/lib/supabase|org|auth.

import Link from "next/link";
import {
  DocumentTextIcon,
  CheckBadgeIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  BuildingOfficeIcon,
  FolderOpenIcon,
  DevicePhoneMobileIcon,
  HomeModernIcon,
  ScaleIcon,
  PrinterIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";

// 10 prototype routes per EXPANDED-SCOPE §7 (deliverable #2-#11; #1 is
// fixtures, no route). Wave column flags which Wave 1/2 plan owns the
// destination page; Wave 0 only ships this index + the locked layout.
const SECTIONS: Array<{
  href: string;
  label: string;
  Icon: typeof DocumentTextIcon;
  blurb: string;
  goal: string;
  wave: "Wave 1" | "Wave 2";
}> = [
  {
    href: "/design-system/prototypes/invoices/inv-caldwell-001",
    label: "Invoice approval",
    Icon: DocumentTextIcon,
    blurb:
      "AI-parsed invoice review — clean PDF, T&M, lump-sum format types across 4 workflow statuses.",
    goal:
      "Validate Document Review (PATTERNS §2) at real-data confidence + status diversity.",
    wave: "Wave 1",
  },
  {
    href: "/design-system/prototypes/draws/d-caldwell-05",
    label: "Draw approval",
    Icon: CheckBadgeIcon,
    blurb:
      "Pay App 5 — G702 summary + G703 line items with full Caldwell CO chain rolled in.",
    goal:
      "Validate Document Review extending to draw approval at 25+ G703 line item density.",
    wave: "Wave 1",
  },
  {
    href: "/design-system/prototypes/draws/d-caldwell-05/print",
    label: "Print preview (G702/G703)",
    Icon: PrinterIcon,
    blurb:
      "AIA G702 cover sheet + G703 detail page — pixel-perfect attempt on cover, 80% on detail.",
    goal:
      "Validate PATTERNS §10 Print View at AIA fidelity. Halt if pixel-perfect explodes (1-day judgment).",
    wave: "Wave 2",
  },
  {
    href: "/design-system/prototypes/jobs/j-caldwell-1/budget",
    label: "Budget view",
    Icon: ChartBarIcon,
    blurb:
      "Caldwell budget — 25+ line items with computed previous/this-period/percent-complete derived on render.",
    goal:
      "Validate Pattern3Dashboard + DataGrid stress test at compact density.",
    wave: "Wave 1",
  },
  {
    href: "/design-system/prototypes/jobs/j-caldwell-1/schedule",
    label: "Schedule (Gantt)",
    Icon: CalendarDaysIcon,
    blurb:
      "6+ month Gantt with 20+ tasks, dependencies, milestones for pay app dates. Wave 2 preview.",
    goal:
      "Validate Site Office direction at Gantt density. NEW pattern — readability finding feeds 1.5a-followup.",
    wave: "Wave 2",
  },
  {
    href: "/design-system/prototypes/vendors",
    label: "Vendors",
    Icon: BuildingOfficeIcon,
    blurb: "17 Caldwell vendors in List+Detail layout — long names stress test.",
    goal:
      "Validate Pattern6ListDetail at real vendor name length + entity-type mix.",
    wave: "Wave 1",
  },
  {
    href: "/design-system/prototypes/documents/lr-caldwell-001",
    label: "Documents",
    Icon: FolderOpenIcon,
    blurb:
      "Plans, contracts, lien releases — sub-prototypes per document type.",
    goal:
      "Validate Document Review extends to non-invoice/draw document types.",
    wave: "Wave 1",
  },
  {
    href: "/design-system/prototypes/mobile-approval",
    label: "Mobile approval",
    Icon: DevicePhoneMobileIcon,
    blurb:
      "PM in field — invoice approval on iPhone-sized viewport, 56px high-stakes targets.",
    goal:
      "Validate Pattern4MobileApproval. Real-phone test on Jake's actual phone GATES SHIP.",
    wave: "Wave 1",
  },
  {
    href: "/design-system/prototypes/owner-portal",
    label: "Owner portal",
    Icon: HomeModernIcon,
    blurb:
      "Homeowner dashboard + draw approval. Cost-plus open-book transparency.",
    goal:
      'Validate Site Office trust posture for non-builder audience. "Lighter variant" finding if too archival.',
    wave: "Wave 1",
  },
  {
    href: "/design-system/prototypes/reconciliation",
    label: "Reconciliation strawman",
    Icon: ScaleIcon,
    blurb:
      "4 candidates × 2 drift types (invoice↔PO, draw↔budget) = 8 prototypes.",
    goal:
      "Validate PATTERNS §11 strawman against real Caldwell drift. Leading candidate documented at 1.5b end.",
    wave: "Wave 2",
  },
];

export default function PrototypeGalleryIndex() {
  return (
    <div className="max-w-[1100px]">
      {/* Header — eyebrow + title + intro paragraph. Mirrors design-system
          landing shape so the gallery feels like a sibling of the
          playground rather than an unrelated page. */}
      <header
        className="mb-10 pb-6 border-b"
        style={{ borderColor: "var(--border-default)" }}
      >
        <Eyebrow tone="accent" className="mb-3">
          Stage 1.5b · Prototype gallery
        </Eyebrow>
        <h1
          className="text-[34px] mb-3 nw-direction-headline"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.02em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Prototype gallery
        </h1>
        <p
          className="text-[14px] max-w-[680px] leading-relaxed mb-3"
          style={{ color: "var(--text-secondary)" }}
        >
          Site Office direction + Set B palette, rendered against sanitized
          Caldwell fixtures. Validates whether the design system actually
          works for real construction workflows — invoice review, draw
          approval, budget views, schedule, vendors, documents, mobile,
          owner portal, reconciliation strawman, and AIA G702/G703 print.
        </p>
        <Badge variant="accent">CP2 locked: Site Office + Set B</Badge>
      </header>

      {/* Card grid — analog: src/app/design-system/page.tsx:131-213. */}
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
                {/* Eyebrow row — icon + label + wave tag */}
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
                  <Badge
                    variant={section.wave === "Wave 1" ? "accent" : "neutral"}
                  >
                    {section.wave}
                  </Badge>
                </div>

                {/* Title — Space Grotesk, smaller than the page H1. */}
                <h2
                  className="text-[18px] mb-2 nw-direction-headline"
                  style={{
                    fontFamily: "var(--font-space-grotesk)",
                    letterSpacing: "-0.01em",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                  }}
                >
                  {section.label}
                </h2>

                {/* Body blurb */}
                <p
                  className="text-[13px] mb-3 leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {section.blurb}
                </p>

                {/* Validation goal — italic, smaller, muted */}
                <p
                  className="text-[12px] mb-5 leading-relaxed italic"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {section.goal}
                </p>

                {/* CTA arrow */}
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

      {/* Footer note — empty-state guidance until Wave 1 prototypes ship */}
      <footer
        className="mt-10 pt-6 border-t text-[11px] leading-relaxed"
        style={{
          borderColor: "var(--border-default)",
          color: "var(--text-tertiary)",
        }}
      >
        <p className="mb-1">
          Internal prototype gallery · Production access gated to platform
          admins · Sanitized Caldwell fixtures only — no real Ross Built
          records.
        </p>
        <p>
          Wave 0 ships this index + the locked Site Office layout. Wave 1
          plans (01.5-2 through 01.5-5) build the destination prototype
          pages — until they land, the cards above link to routes that
          will 404. The locked direction lives in
          <code
            className="mx-1"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            prototypes/layout.tsx
          </code>
          and cannot be flipped via URL params.
        </p>
      </footer>
    </div>
  );
}
