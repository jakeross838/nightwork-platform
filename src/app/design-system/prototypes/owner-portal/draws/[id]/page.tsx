// src/app/design-system/prototypes/owner-portal/draws/[id]/page.tsx
//
// Owner-facing draw approval — Document Review pattern (PATTERNS §2)
// extending Multi-step Approval (PATTERNS §3) for non-builder homeowner
// audience. Per Stage 1.5b deliverable #9 + Q8=B.
//
// Cost-plus open-book transparency: owner sees every line item AND every
// vendor. Builder version (01.5-2 prototypes/draws/[id]/page.tsx) shows
// cost codes only. This version shows vendor names + amount per vendor
// per line for full transparency. (Hooked into the same fixture; the
// difference is the rendered shape.)
//
// Trust posture test (R5): if Site Office direction (UPPERCASE eyebrows
// + JetBrains Mono) feels too archival for homeowner audience, surface
// as a "lighter variant" finding. Do not redesign in 1.5b.
//
// Owner-portal trust filter: NO AI confidence scores, NO PM override
// audit, NO internal cost-code mapping notes. Surfaces only what a
// homeowner needs to see.
//
// Hook T10c — no imports from @/lib/(supabase|org|auth).

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  CheckBadgeIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";

import {
  CALDWELL_DRAWS,
  CALDWELL_DRAW_LINE_ITEMS,
  CALDWELL_INVOICES,
  CALDWELL_VENDORS,
  CALDWELL_COST_CODES,
  CALDWELL_JOBS,
} from "@/app/design-system/_fixtures/drummond";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Money from "@/components/nw/Money";
import DataRow from "@/components/nw/DataRow";

export default function OwnerDrawApprovalPage({
  params,
}: {
  params: { id: string };
}) {
  const draw = CALDWELL_DRAWS.find((d) => d.id === params.id);
  if (!draw) return notFound();

  const job = CALDWELL_JOBS.find((j) => j.id === draw.job_id);
  const drawId = draw.id; // capture for closure narrowing
  const lineItems = CALDWELL_DRAW_LINE_ITEMS.filter(
    (li) => li.draw_id === drawId,
  );

  // Per cost code, find vendor breakdown — for owner transparency.
  // Lookup: invoices linked to THIS draw with the matching cost code.
  // Sum by vendor for the line-item summary.
  function vendorsForLine(costCodeId: string) {
    const invoicesForLine = CALDWELL_INVOICES.filter(
      (i) => i.cost_code_id === costCodeId && i.draw_id === drawId,
    );
    const byVendor = new Map<string, number>();
    for (const inv of invoicesForLine) {
      byVendor.set(
        inv.vendor_id,
        (byVendor.get(inv.vendor_id) ?? 0) + inv.total_amount,
      );
    }
    return Array.from(byVendor.entries()).map(([vid, cents]) => ({
      vendor: CALDWELL_VENDORS.find((v) => v.id === vid),
      cents,
    }));
  }

  const linesWithSpend = lineItems.filter((li) => li.this_period > 0);

  return (
    <div className="px-6 py-8 max-w-[1200px] mx-auto">
      {/* Header band — homeowner-friendly. Pay app # not "Draw N";
          "for your review" not "PM-approved / submitted". */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <div
            className="flex items-center gap-2 text-[12px] mb-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            <Link
              href="/design-system/prototypes/owner-portal"
              className="hover:underline"
            >
              Owner portal
            </Link>
            <span>/</span>
            <span style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
              Pay app #{draw.draw_number}
            </span>
          </div>
          <h1
            className="text-[28px] mb-1"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 500,
              color: "var(--text-primary)",
            }}
          >
            Pay app #{draw.draw_number} for your review
          </h1>
          <p
            className="text-[14px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Work completed {draw.period_start} – {draw.period_end} ·
            submitted by your builder for approval ·{" "}
            {job?.name ?? "—"}
          </p>
        </div>
        {/* Action buttons — owner role: Approve & sign + Request
            clarification. NO Print, NO "Send back to draft". Both 44px
            touch targets per SYSTEM.md §11 (these are nav/secondary
            actions on owner-facing surface; the ACTUAL high-stakes
            approve flow happens after a downstream confirm step that
            this prototype doesn't simulate). */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 text-[12px] uppercase font-medium border"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.12em",
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
              background: "var(--bg-card)",
              minHeight: "44px",
            }}
          >
            <ChatBubbleLeftRightIcon
              className="w-4 h-4"
              strokeWidth={1.5}
            />
            Request clarification
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 text-[12px] uppercase font-medium"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.12em",
              background: "var(--nw-stone-blue)",
              color: "var(--nw-white-sand)",
              minHeight: "56px",
            }}
          >
            <CheckBadgeIcon className="w-4 h-4" strokeWidth={1.5} />
            Approve & sign
          </button>
        </div>
      </div>

      {/* Summary card — homeowner-translated. Internal field names
          contract_sum_to_date / less_previous_payments etc. are read but
          rendered with plain language: "Total project budget" / "Paid
          before this pay app" / "Work completed this period" / "Remaining
          after this pay app". The internal field names never appear in
          rendered text. */}
      <Card padding="md" className="mb-6">
        <Eyebrow tone="accent" className="mb-3">
          This pay app summary
        </Eyebrow>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <DataRow
            label="Total project budget"
            value={<Money cents={draw.contract_sum_to_date} size="md" />}
          />
          <DataRow
            label="Paid before this pay app"
            value={<Money cents={draw.less_previous_payments} size="md" />}
          />
          <DataRow
            label="Work completed this period"
            value={
              <Money
                cents={draw.current_payment_due}
                size="md"
                variant="emphasized"
              />
            }
          />
          <DataRow
            label="Remaining after this pay app"
            value={<Money cents={draw.balance_to_finish} size="md" />}
          />
        </div>
      </Card>

      {/* Detailed line items WITH vendor breakdown — cost-plus open-book
          transparency made literal. Owner sees the cost-code description
          (e.g. "Concrete / Foundation") and the underlying vendor
          payments inside it. The 5-digit AIA cost code is shown as a
          small JetBrains Mono detail, not the primary label, so a
          homeowner reading the card without prior context still
          understands what each line is. */}
      <Card padding="md">
        <Eyebrow tone="muted" className="mb-3">
          Where the money went · {linesWithSpend.length} categories
        </Eyebrow>
        <p
          className="text-[12px] mb-3"
          style={{ color: "var(--text-secondary)" }}
        >
          Cost-plus open-book contract — every vendor invoice is visible.
          Each category below is broken down by the vendors who billed
          against it during this period.
        </p>
        <ul className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
          {linesWithSpend.map((li) => {
            const cc = CALDWELL_COST_CODES.find(
              (c) => c.id === li.cost_code_id,
            );
            const vendors = vendorsForLine(li.cost_code_id);
            return (
              <li key={li.id} className="py-3">
                <div className="flex items-center justify-between mb-1 gap-3">
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-[14px] truncate"
                      style={{
                        color: "var(--text-primary)",
                        fontFamily: "var(--font-space-grotesk)",
                        fontWeight: 500,
                      }}
                    >
                      {cc?.description ?? "—"}
                    </div>
                    <div
                      className="text-[10px]"
                      style={{
                        fontFamily: "var(--font-jetbrains-mono)",
                        color: "var(--text-tertiary)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      Code {cc?.code ?? "—"} ·{" "}
                      {(li.percent_complete * 100).toFixed(0)}% complete
                    </div>
                  </div>
                  <Money
                    cents={li.this_period}
                    size="md"
                    variant="emphasized"
                  />
                </div>
                {vendors.length > 0 && (
                  <ul className="ml-4 mt-2 space-y-1 text-[11px]">
                    {vendors.map((v, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <span>{v.vendor?.name ?? "—"}</span>
                        <Money cents={v.cents} size="sm" />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
