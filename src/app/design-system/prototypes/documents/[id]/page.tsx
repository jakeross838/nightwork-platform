// src/app/design-system/prototypes/documents/[id]/page.tsx
//
// Document review prototype — 3 sub-types per Stage 1.5b deliverable #7:
//   - Architectural plans (sanitized plan PDF preview)
//   - Construction contracts (sanitized contract DOCX preview)
//   - Lien releases (Florida 4-statute types — 713.20(2)(a)/(b)/(c)/(d))
//
// Document type discriminated via id prefix:
//   lr-caldwell-*    → CaldwellLienRelease lookup
//   plan-caldwell-*  → synthesized plan stub
//   contract-caldwell-* → synthesized contract stub
//
// (Note: per CLAUDE.md "Project Identity Guard" + nwrp33 grep gate, the
// fixtures use the Caldwell substituted surname. Routes mirror the
// fixture namespace for consistency.)
//
// All three extend Pattern1DocumentReview (PATTERNS.md §2):
// file preview LEFT + structured fields right-rail + audit/status
// timeline BELOW.
//
// Per CONTEXT cross-cutting "Soft-delete + status_history APPLIES (display
// only)": the production lien_releases table currently lacks the
// status_history JSONB column (R.7 violation per CURRENT-STATE A.2 / F1
// gap #7). The prototype renders the 4-status enum correctly and fakes
// a 2-step timeline client-side, labeled with an explicit "F1 fixes the
// schema" disclaimer so this can never be mistaken for canonical data.
//
// Hook T10c — no imports from @/lib/supabase|org|auth.

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  PaperClipIcon,
  DocumentTextIcon,
  ScaleIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";

import {
  CALDWELL_LIEN_RELEASES,
  CALDWELL_VENDORS,
  CALDWELL_INVOICES,
  CALDWELL_JOBS,
  type CaldwellLienReleaseType,
  type CaldwellLienReleaseStatus,
} from "@/app/design-system/_fixtures/drummond";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Money from "@/components/nw/Money";
import DataRow from "@/components/nw/DataRow";
import Badge from "@/components/nw/Badge";

// Florida 4-statute reference — per CLAUDE.md §Lien.
// Source: F.S. 713.20 (Construction Lien Law).
const STATUTE_LABEL: Record<
  CaldwellLienReleaseType,
  { label: string; statute: string }
> = {
  conditional_progress: {
    label: "Conditional waiver — progress payment",
    statute: "Florida Statute 713.20(2)(a)",
  },
  unconditional_progress: {
    label: "Unconditional waiver — progress payment",
    statute: "Florida Statute 713.20(2)(c)",
  },
  conditional_final: {
    label: "Conditional waiver — final payment",
    statute: "Florida Statute 713.20(2)(b)",
  },
  unconditional_final: {
    label: "Unconditional waiver — final payment",
    statute: "Florida Statute 713.20(2)(d)",
  },
};

// Badge variants on the public Badge primitive are
//   "neutral" | "success" | "warning" | "danger" | "info" | "accent"
// (per src/components/nw/Badge.tsx line 3-9).
const LIEN_STATUS_BADGE: Record<
  CaldwellLienReleaseStatus,
  {
    variant: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
    label: string;
  }
> = {
  not_required: { variant: "neutral", label: "NOT REQUIRED" },
  pending: { variant: "warning", label: "PENDING" },
  received: { variant: "success", label: "RECEIVED" },
  waived: { variant: "info", label: "WAIVED" },
};

// ─── Sub-component: lien release ──────────────────────────────────────
function LienReleaseDocument({ id }: { id: string }) {
  const lr = CALDWELL_LIEN_RELEASES.find((l) => l.id === id);
  if (!lr) return notFound();

  const vendor = CALDWELL_VENDORS.find((v) => v.id === lr.vendor_id);
  const invoice = CALDWELL_INVOICES.find((i) => i.id === lr.invoice_id);
  const job = CALDWELL_JOBS.find((j) => j.id === lr.job_id);
  const statute = STATUTE_LABEL[lr.release_type];
  const status = LIEN_STATUS_BADGE[lr.status];

  return (
    <div className="px-6 py-8 max-w-[1600px] mx-auto">
      {/* Header band */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <div
            className="flex items-center gap-2 text-[10px] uppercase mb-2"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.14em",
              color: "var(--text-tertiary)",
            }}
          >
            <Link
              href="/design-system/prototypes"
              className="hover:underline"
            >
              Prototypes
            </Link>
            <span>›</span>
            <span>Documents</span>
            <span>›</span>
            <span>{lr.id}</span>
          </div>
          <h1
            className="text-[24px] mb-2 nw-direction-headline"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              letterSpacing: "-0.02em",
              fontWeight: 500,
              color: "var(--text-primary)",
            }}
          >
            Lien release — {vendor?.name ?? "Unknown vendor"}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <Money cents={lr.amount_through} size="lg" variant="emphasized" />
            <Badge variant={status.variant}>{status.label}</Badge>
            <span
              className="text-[11px]"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                color: "var(--text-tertiary)",
              }}
            >
              {statute.statute}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-9 px-4 text-[12px] uppercase font-medium border"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.1em",
              background: "var(--nw-stone-blue)",
              color: "var(--nw-white-sand)",
              borderColor: "var(--nw-stone-blue)",
            }}
          >
            <CheckBadgeIcon
              className="w-4 h-4"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            Mark received
          </button>
        </div>
      </div>

      {/* Hero grid 50/50 — file preview LEFT, structured fields RIGHT */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 mb-6"
        style={{
          gap: "1px",
          background: "var(--border-default)",
          borderTop: "1px solid var(--border-default)",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        {/* LEFT — file preview */}
        <div className="p-5" style={{ background: "var(--bg-card)" }}>
          <Eyebrow tone="muted" className="mb-3">
            Source document
          </Eyebrow>
          <div
            className="aspect-[3/4] border flex flex-col items-center justify-center"
            style={{
              background: "var(--bg-subtle)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <ScaleIcon
              className="w-8 h-8 mb-3"
              strokeWidth={1.25}
              style={{ color: "var(--text-tertiary)" }}
              aria-hidden="true"
            />
            <span
              className="text-[10px] uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Lien release PDF preview
            </span>
            <span
              className="text-[10px] mt-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              react-pdf · sticky on desktop
            </span>
          </div>
        </div>

        {/* RIGHT — structured fields */}
        <div
          className="p-5 space-y-4"
          style={{ background: "var(--bg-card)" }}
        >
          <Card padding="md">
            <Eyebrow tone="accent" className="mb-3">
              Lien details
            </Eyebrow>
            <div className="grid grid-cols-1 gap-3">
              <DataRow label="Type" value={statute.label} />
              <DataRow label="Statute" value={statute.statute} />
              <DataRow label="Vendor" value={vendor?.name ?? "—"} />
              <DataRow label="Project" value={job?.name ?? "—"} />
              <DataRow
                label="Invoice"
                value={
                  invoice ? (
                    <Link
                      href={`/design-system/prototypes/invoices/${invoice.id}`}
                      className="hover:underline"
                      style={{ color: "var(--nw-stone-blue)" }}
                    >
                      {invoice.invoice_number ?? invoice.id}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <DataRow
                label="Amount through"
                value={
                  <Money
                    cents={lr.amount_through}
                    size="md"
                    variant="emphasized"
                  />
                }
              />
              <DataRow label="Release date" value={lr.release_date ?? "—"} />
              {lr.draw_id && (
                <DataRow
                  label="Draw"
                  value={
                    <Link
                      href={`/design-system/prototypes/draws/${lr.draw_id}`}
                      className="hover:underline"
                      style={{ color: "var(--nw-stone-blue)" }}
                    >
                      Pay App #{lr.draw_id.replace("d-caldwell-", "")}
                    </Link>
                  }
                />
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Status timeline (faked per F1 gap #7) */}
      <Card padding="md">
        <Eyebrow tone="muted" className="mb-2">
          Status timeline
        </Eyebrow>
        <div
          className="mb-3 p-3 text-[10px] leading-relaxed"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            background: "var(--bg-subtle)",
            color: "var(--text-tertiary)",
            borderLeft: "2px solid var(--nw-warn)",
          }}
        >
          Note:{" "}
          <code
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            lien_releases.status_history
          </code>{" "}
          JSONB column does not yet exist in the production schema (R.7
          violation per CURRENT-STATE A.2 / F1 gap #7). F1 adds the column.
          This timeline is faked client-side for prototype rendering only.
        </div>
        <ul className="space-y-2 text-[12px]">
          <li className="flex items-baseline gap-2.5">
            <span
              className="w-2 h-2 mt-1 shrink-0"
              style={{
                borderRadius: "var(--radius-dot)",
                background: "var(--nw-success)",
              }}
              aria-hidden="true"
            />
            <span
              className="text-[10px] uppercase shrink-0"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.1em",
                color: "var(--text-tertiary)",
                width: "120px",
              }}
            >
              {invoice?.received_date ?? "—"}
            </span>
            <span style={{ color: "var(--text-primary)" }}>
              REQUESTED with invoice
            </span>
          </li>
          {lr.status === "received" && lr.release_date && (
            <li className="flex items-baseline gap-2.5">
              <span
                className="w-2 h-2 mt-1 shrink-0"
                style={{
                  borderRadius: "var(--radius-dot)",
                  background: "var(--nw-success)",
                }}
                aria-hidden="true"
              />
              <span
                className="text-[10px] uppercase shrink-0"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  letterSpacing: "0.1em",
                  color: "var(--text-tertiary)",
                  width: "120px",
                }}
              >
                {lr.release_date}
              </span>
              <span style={{ color: "var(--text-primary)" }}>
                RECEIVED — signed and notarized
              </span>
            </li>
          )}
          {lr.status === "pending" && (
            <li className="flex items-baseline gap-2.5">
              <span
                className="w-2 h-2 mt-1 shrink-0"
                style={{
                  borderRadius: "var(--radius-dot)",
                  background: "transparent",
                  border: "1px solid var(--text-tertiary)",
                }}
                aria-hidden="true"
              />
              <span
                className="text-[10px] uppercase shrink-0"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  letterSpacing: "0.1em",
                  color: "var(--text-tertiary)",
                  width: "120px",
                }}
              >
                Pending
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                AWAITING signed waiver
              </span>
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}

// ─── Sub-component: architectural plans stub ─────────────────────────
function PlanDocument({ id }: { id: string }) {
  // Synthesized stub — no fixture for plans, but the component exercises
  // the Document Review shape consistently. Real plans will live in the
  // documents table (Wave 2 — currently MISSING per CURRENT-STATE A.4).
  const job = CALDWELL_JOBS[0];

  return (
    <div className="px-6 py-8 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <div
          className="flex items-center gap-2 text-[10px] uppercase mb-2"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.14em",
            color: "var(--text-tertiary)",
          }}
        >
          <Link
            href="/design-system/prototypes"
            className="hover:underline"
          >
            Prototypes
          </Link>
          <span>›</span>
          <span>Documents</span>
          <span>›</span>
          <span>{id}</span>
        </div>
        <h1
          className="text-[24px] mb-2 nw-direction-headline"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.02em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Architectural plans — {job?.name}
        </h1>
        <Badge variant="neutral">PLAN STUB</Badge>
      </div>

      <div
        className="grid grid-cols-1 lg:grid-cols-2 mb-6"
        style={{
          gap: "1px",
          background: "var(--border-default)",
          borderTop: "1px solid var(--border-default)",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        <div className="p-5" style={{ background: "var(--bg-card)" }}>
          <Eyebrow tone="muted" className="mb-3">
            Source document
          </Eyebrow>
          <div
            className="aspect-[3/4] border flex flex-col items-center justify-center"
            style={{
              background: "var(--bg-subtle)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <PaperClipIcon
              className="w-8 h-8 mb-3"
              strokeWidth={1.25}
              style={{ color: "var(--text-tertiary)" }}
              aria-hidden="true"
            />
            <span
              className="text-[10px] uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Plans PDF preview (sanitized)
            </span>
          </div>
        </div>
        <div
          className="p-5 space-y-4"
          style={{ background: "var(--bg-card)" }}
        >
          <Card padding="md">
            <Eyebrow tone="accent" className="mb-3">
              Sheet metadata
            </Eyebrow>
            <div className="grid grid-cols-1 gap-3">
              <DataRow label="Project" value={job?.name ?? "—"} />
              <DataRow label="Sheet" value="A-101 First floor plan" />
              <DataRow
                label="Revision"
                value="Rev 2 (issued 2025-09-15)"
              />
              <DataRow label="Architect" value="(sanitized)" />
              <DataRow label="Scale" value="1/4 in = 1 ft" />
            </div>
          </Card>
        </div>
      </div>

      <Card padding="md">
        <Eyebrow tone="muted" className="mb-2">
          Notes
        </Eyebrow>
        <p
          className="text-[12px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          The plans entity is MISSING from the current schema (per
          CURRENT-STATE A.4). VISION proposes a first-class{" "}
          <code style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
            documents
          </code>{" "}
          table (Wave 2). For 1.5b prototype, the Document Review pattern
          is exercised against this stub to validate the gold-standard
          layout&apos;s reach beyond invoices/draws.
        </p>
      </Card>
    </div>
  );
}

// ─── Sub-component: construction contract stub ────────────────────────
function ContractDocument({ id }: { id: string }) {
  // Synthesized stub from Caldwell job (already sanitized fixture data).
  const job = CALDWELL_JOBS[0];

  return (
    <div className="px-6 py-8 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <div
          className="flex items-center gap-2 text-[10px] uppercase mb-2"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.14em",
            color: "var(--text-tertiary)",
          }}
        >
          <Link
            href="/design-system/prototypes"
            className="hover:underline"
          >
            Prototypes
          </Link>
          <span>›</span>
          <span>Documents</span>
          <span>›</span>
          <span>{id}</span>
        </div>
        <h1
          className="text-[24px] mb-2 nw-direction-headline"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            letterSpacing: "-0.02em",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Construction agreement — {job?.name}
        </h1>
        <div className="flex items-center gap-3">
          <Money
            cents={job?.original_contract_amount ?? 0}
            size="lg"
            variant="emphasized"
          />
          <Badge variant="success">EXECUTED</Badge>
        </div>
      </div>

      <div
        className="grid grid-cols-1 lg:grid-cols-2 mb-6"
        style={{
          gap: "1px",
          background: "var(--border-default)",
          borderTop: "1px solid var(--border-default)",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        <div className="p-5" style={{ background: "var(--bg-card)" }}>
          <Eyebrow tone="muted" className="mb-3">
            Source document
          </Eyebrow>
          <div
            className="aspect-[3/4] border flex flex-col items-center justify-center"
            style={{
              background: "var(--bg-subtle)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <DocumentTextIcon
              className="w-8 h-8 mb-3"
              strokeWidth={1.25}
              style={{ color: "var(--text-tertiary)" }}
              aria-hidden="true"
            />
            <span
              className="text-[10px] uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Contract DOCX preview (sanitized)
            </span>
          </div>
        </div>
        <div
          className="p-5 space-y-4"
          style={{ background: "var(--bg-card)" }}
        >
          <Card padding="md">
            <Eyebrow tone="accent" className="mb-3">
              Contract details
            </Eyebrow>
            <div className="grid grid-cols-1 gap-3">
              <DataRow label="Project" value={job?.name ?? "—"} />
              <DataRow label="Client" value={job?.client_name ?? "—"} />
              <DataRow label="Address" value={job?.address ?? "—"} />
              <DataRow
                label="Contract type"
                value={
                  (job?.contract_type ?? "")
                    .replaceAll("_", " ")
                    .toUpperCase() || "—"
                }
              />
              <DataRow
                label="Original amount"
                value={
                  <Money
                    cents={job?.original_contract_amount ?? 0}
                    size="md"
                    variant="emphasized"
                  />
                }
              />
              <DataRow
                label="Current amount"
                value={
                  <Money cents={job?.current_contract_amount ?? 0} size="md" />
                }
              />
              <DataRow
                label="GC fee"
                value={`${((job?.gc_fee_percentage ?? 0) * 100).toFixed(0)}%`}
              />
              <DataRow
                label="Deposit"
                value={`${((job?.deposit_percentage ?? 0) * 100).toFixed(0)}%`}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Page entry — discriminate by id prefix ──────────────────────────
export default function DocumentPrototypePage({
  params,
}: {
  params: { id: string };
}) {
  const id = params.id;

  // Lien release — direct id match against the fixture (covers both
  // explicit `lr-caldwell-*` prefix and any future renames).
  if (id.startsWith("lr-caldwell-")) {
    return <LienReleaseDocument id={id} />;
  }

  // Architectural plans — stub. Any `plan-*` id renders the plan layout.
  if (id.startsWith("plan-caldwell-") || id.startsWith("plan-")) {
    return <PlanDocument id={id} />;
  }

  // Construction contract — stub. Any `contract-*` id renders contract.
  if (id.startsWith("contract-caldwell-") || id.startsWith("contract-")) {
    return <ContractDocument id={id} />;
  }

  // Fallback — try to locate as a lien release; otherwise 404.
  if (CALDWELL_LIEN_RELEASES.some((l) => l.id === id)) {
    return <LienReleaseDocument id={id} />;
  }

  return notFound();
}
