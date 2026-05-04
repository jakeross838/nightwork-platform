// src/app/design-system/prototypes/vendors/page.tsx
//
// Vendors list — Drummond all 18 vendors in PATTERNS.md §7 List + Detail
// layout. Per Stage 1.5b deliverable #6.
//
// Stress test: long names (Bay Region Carpentry Inc, Coastal Smart Systems
// LLC) must render without breaking layout on mobile.
//
// Hook T10c — no imports from @/lib/supabase|org|auth.

"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

import {
  CALDWELL_VENDORS,
  CALDWELL_INVOICES,
  CALDWELL_COST_CODES,
} from "@/app/design-system/_fixtures/drummond";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Money from "@/components/nw/Money";
import DataRow from "@/components/nw/DataRow";
import Badge from "@/components/nw/Badge";

// Map invoice status -> Badge variant for the vendor activity panel.
function activityBadgeVariant(
  status: string,
): "neutral" | "success" | "warning" | "info" {
  if (status === "paid" || status === "qa_approved" || status === "pm_approved")
    return "success";
  if (status === "qa_review" || status === "in_draw" || status === "pushed_to_qb")
    return "info";
  if (status.includes("review") || status === "ai_processed") return "warning";
  return "neutral";
}

export default function VendorsListPage() {
  const [selectedId, setSelectedId] = useState<string>(
    CALDWELL_VENDORS[0]?.id ?? "",
  );
  const selected =
    CALDWELL_VENDORS.find((v) => v.id === selectedId) ?? CALDWELL_VENDORS[0];
  const recentInvoices = CALDWELL_INVOICES.filter(
    (i) => i.vendor_id === selected?.id,
  )
    .sort((a, b) => (b.received_date ?? "").localeCompare(a.received_date ?? ""))
    .slice(0, 5);
  const totalInvoiced = CALDWELL_INVOICES.filter(
    (i) => i.vendor_id === selected?.id,
  ).reduce((sum, i) => sum + i.total_amount, 0);
  const allInvoiceCount = CALDWELL_INVOICES.filter(
    (i) => i.vendor_id === selected?.id,
  ).length;
  const defaultCC = selected?.default_cost_code_id
    ? CALDWELL_COST_CODES.find(
        (c) => c.id === selected.default_cost_code_id,
      )
    : null;

  return (
    <div className="px-6 py-8 max-w-[1600px] mx-auto">
      {/* Header band */}
      <div className="mb-6">
        <div
          className="flex items-center gap-2 text-[12px] mb-2"
          style={{ color: "var(--text-tertiary)" }}
        >
          <Link href="/design-system/prototypes/" className="hover:underline">
            Prototypes
          </Link>
          <span>/</span>
          <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>Vendors</span>
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
          Vendors
        </h1>
        <p
          className="text-[13px]"
          style={{ color: "var(--text-secondary)" }}
        >
          {CALDWELL_VENDORS.length} active vendors on the Caldwell Residence
          project.
        </p>
      </div>

      {/* List + Detail — analog: patterns/page.tsx:822-867 */}
      <Card padding="none">
        <div
          className="grid grid-cols-1 md:grid-cols-[280px_1fr]"
          style={{ minHeight: "560px" }}
        >
          {/* LEFT — list rail */}
          <div
            className="border-r"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div
              className="px-4 py-3 border-b"
              style={{ borderColor: "var(--border-default)" }}
            >
              <Eyebrow tone="muted">
                Vendors · {CALDWELL_VENDORS.length}
              </Eyebrow>
            </div>
            <ul>
              {CALDWELL_VENDORS.map((v) => {
                const isSelected = v.id === selected?.id;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(v.id)}
                      className="w-full text-left px-4 py-3 border-b cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-stone-blue/40"
                      style={{
                        borderColor: "var(--border-subtle)",
                        background: isSelected
                          ? "var(--bg-subtle)"
                          : "transparent",
                        borderLeft: isSelected
                          ? "2px solid var(--nw-stone-blue)"
                          : "2px solid transparent",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        {/* truncate prevents long names from breaking layout */}
                        <span
                          className="text-[12px] font-medium truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {v.name}
                        </span>
                      </div>
                      <div
                        className="text-[10px] truncate"
                        style={{
                          fontFamily: "var(--font-jetbrains-mono)",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {v.email}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* RIGHT — detail pane */}
          <div className="p-5">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                  <div className="min-w-0">
                    <Eyebrow tone="accent" className="mb-2">
                      Vendor profile
                    </Eyebrow>
                    <h2
                      className="text-[20px] mb-1 nw-direction-headline"
                      style={{
                        fontFamily: "var(--font-space-grotesk)",
                        fontWeight: 500,
                        letterSpacing: "-0.02em",
                        color: "var(--text-primary)",
                      }}
                    >
                      {selected.name}
                    </h2>
                  </div>
                  <Link
                    href={`/design-system/prototypes/vendors/${selected.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] border uppercase font-medium"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      letterSpacing: "0.12em",
                      borderColor: "var(--border-default)",
                      color: "var(--text-primary)",
                      background: "var(--bg-card)",
                    }}
                  >
                    Open detail
                    <ArrowTopRightOnSquareIcon
                      className="w-3 h-3"
                      strokeWidth={1.5}
                    />
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card padding="md">
                    <Eyebrow tone="muted" className="mb-3">
                      Contact
                    </Eyebrow>
                    <div className="space-y-3">
                      <DataRow label="Address" value={selected.address} />
                      <DataRow label="Phone" value={selected.phone} />
                      <DataRow label="Email" value={selected.email} />
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
                      Activity
                    </Eyebrow>
                    <div className="space-y-3">
                      <DataRow
                        label="Total invoiced"
                        value={
                          <Money
                            cents={totalInvoiced}
                            size="md"
                            variant="emphasized"
                          />
                        }
                      />
                      <DataRow
                        label="Recent invoices"
                        value={`${recentInvoices.length} of ${allInvoiceCount}`}
                      />
                    </div>
                  </Card>
                </div>

                {recentInvoices.length > 0 && (
                  <Card padding="md" className="mt-4">
                    <Eyebrow tone="muted" className="mb-3">
                      Recent invoices
                    </Eyebrow>
                    <ul
                      className="divide-y"
                      style={{ borderColor: "var(--border-subtle)" }}
                    >
                      {recentInvoices.map((inv) => (
                        <li
                          key={inv.id}
                          className="py-2 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div
                              className="text-[12px] truncate"
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
                              {inv.invoice_number ?? "—"} ·{" "}
                              {inv.received_date}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Money cents={inv.total_amount} size="sm" />
                            <Badge variant={activityBadgeVariant(inv.status)}>
                              {inv.status.replaceAll("_", " ")}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </>
            ) : (
              <Eyebrow tone="muted">No vendor selected</Eyebrow>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
