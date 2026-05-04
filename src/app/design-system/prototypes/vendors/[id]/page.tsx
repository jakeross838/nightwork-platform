// src/app/design-system/prototypes/vendors/[id]/page.tsx
//
// Vendor detail prototype — Document Review pattern (PATTERNS §2)
// extends to vendor profile per CONTEXT D-008. Per Stage 1.5b
// deliverable #6.
//
// Hero grid: profile/verification LEFT, recent invoices/lien releases
// RIGHT. Audit timeline below the hero only when there is meaningful
// vendor lifecycle history (skipped for now — F1 wires real activity log).
//
// Hook T10c — no imports from @/lib/supabase|org|auth.

import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckBadgeIcon } from "@heroicons/react/24/outline";

import {
  CALDWELL_VENDORS,
  CALDWELL_INVOICES,
  CALDWELL_LIEN_RELEASES,
  CALDWELL_COST_CODES,
} from "@/app/design-system/_fixtures/drummond";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Money from "@/components/nw/Money";
import DataRow from "@/components/nw/DataRow";
import Badge from "@/components/nw/Badge";

const LIEN_RELEASE_TYPE_LABEL: Record<string, string> = {
  conditional_progress: "Conditional progress",
  unconditional_progress: "Unconditional progress",
  conditional_final: "Conditional final",
  unconditional_final: "Unconditional final",
};

function lienBadgeVariant(
  status: string,
): "neutral" | "success" | "warning" | "danger" {
  if (status === "received") return "success";
  if (status === "pending") return "warning";
  if (status === "waived") return "neutral";
  return "neutral";
}

export default function VendorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const vendor = CALDWELL_VENDORS.find((v) => v.id === params.id);
  if (!vendor) return notFound();

  const invoices = CALDWELL_INVOICES.filter((i) => i.vendor_id === vendor.id);
  const lienReleases = CALDWELL_LIEN_RELEASES.filter(
    (l) => l.vendor_id === vendor.id,
  );
  const totalInvoiced = invoices.reduce((sum, i) => sum + i.total_amount, 0);
  const defaultCC = vendor.default_cost_code_id
    ? CALDWELL_COST_CODES.find((c) => c.id === vendor.default_cost_code_id)
    : null;

  return (
    <div className="px-6 py-8 max-w-[1600px] mx-auto">
      {/* Header band */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <div
            className="flex items-center gap-2 text-[12px] mb-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            <Link href="/design-system/prototypes/" className="hover:underline">
              Prototypes
            </Link>
            <span>/</span>
            <Link
              href="/design-system/prototypes/vendors"
              className="hover:underline"
            >
              Vendors
            </Link>
            <span>/</span>
            <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
              {vendor.id}
            </span>
          </div>
          <h1
            className="text-[24px] mb-2 nw-direction-headline"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}
          >
            {vendor.name}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="text-[12px]"
              style={{ color: "var(--text-secondary)" }}
            >
              {invoices.length}{" "}
              {invoices.length === 1 ? "invoice" : "invoices"} ·
            </span>
            <Money cents={totalInvoiced} size="md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] border uppercase font-medium"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.12em",
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
              background: "var(--bg-card)",
            }}
          >
            <CheckBadgeIcon className="w-3.5 h-3.5" strokeWidth={1.5} /> Mark
            verified
          </button>
        </div>
      </div>

      {/* Hero grid 50/50 — profile LEFT, activity RIGHT */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 mb-6"
        style={{ gap: "1px", background: "var(--border-default)" }}
      >
        {/* LEFT — profile */}
        <div
          className="p-5 space-y-4"
          style={{ background: "var(--bg-card)" }}
        >
          <Card padding="md">
            <Eyebrow tone="accent" className="mb-3">
              Profile
            </Eyebrow>
            <div className="space-y-3">
              <DataRow label="Address" value={vendor.address} />
              <DataRow label="Phone" value={vendor.phone} />
              <DataRow label="Email" value={vendor.email} />
              <DataRow
                label="Default cost code"
                value={
                  defaultCC
                    ? `${defaultCC.code} · ${defaultCC.description}`
                    : "—"
                }
              />
            </div>
          </Card>

          <Card padding="md">
            <Eyebrow tone="muted" className="mb-3">
              Verification
            </Eyebrow>
            <div className="space-y-3">
              <DataRow
                label="W9 on file"
                value={<Badge variant="success">RECEIVED</Badge>}
              />
              <DataRow
                label="COI"
                value={
                  <span className="inline-flex items-center gap-2">
                    <Badge variant="success">CURRENT</Badge>
                    <span
                      className="text-[10px]"
                      style={{
                        fontFamily: "var(--font-jetbrains-mono)",
                        color: "var(--text-tertiary)",
                        letterSpacing: "0.04em",
                      }}
                    >
                      faked · F1 wires real
                    </span>
                  </span>
                }
              />
              <DataRow label="License #" value="—" />
            </div>
          </Card>
        </div>

        {/* RIGHT — activity */}
        <div
          className="p-5 space-y-4"
          style={{ background: "var(--bg-card)" }}
        >
          <Card padding="md">
            <Eyebrow tone="accent" className="mb-3">
              Recent invoices
            </Eyebrow>
            {invoices.length === 0 ? (
              <Eyebrow tone="muted">No invoices yet</Eyebrow>
            ) : (
              <ul
                className="divide-y"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                {invoices.slice(0, 8).map((inv) => (
                  <li
                    key={inv.id}
                    className="py-2 flex items-center justify-between gap-3 text-[12px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {inv.description}
                      </div>
                      <div
                        className="text-[10px] truncate"
                        style={{
                          fontFamily: "var(--font-jetbrains-mono)",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {inv.invoice_number ?? "—"} · {inv.received_date}
                      </div>
                    </div>
                    <Link
                      href={`/design-system/prototypes/invoices/${inv.id}`}
                      className="hover:underline shrink-0"
                    >
                      <Money cents={inv.total_amount} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {lienReleases.length > 0 && (
            <Card padding="md">
              <Eyebrow tone="muted" className="mb-3">
                Lien releases · {lienReleases.length}
              </Eyebrow>
              <ul className="space-y-3 text-[12px]">
                {lienReleases.map((lr) => (
                  <li
                    key={lr.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-[10px] mb-0.5"
                        style={{
                          fontFamily: "var(--font-jetbrains-mono)",
                          letterSpacing: "0.08em",
                          color: "var(--text-tertiary)",
                          textTransform: "uppercase",
                        }}
                      >
                        {LIEN_RELEASE_TYPE_LABEL[lr.release_type] ??
                          lr.release_type}
                      </div>
                      <div style={{ color: "var(--text-primary)" }}>
                        {lr.release_date ?? "Pending"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Money cents={lr.amount_through} size="sm" />
                      <Badge variant={lienBadgeVariant(lr.status)}>
                        {lr.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
