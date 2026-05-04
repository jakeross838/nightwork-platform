// src/app/design-system/prototypes/owner-portal/page.tsx
//
// Homeowner-facing dashboard — simplified Pattern3Dashboard for non-builder
// audience. Per Stage 1.5b deliverable #9 + Q8=B (dashboard + draw approval
// only; Wave 3 photos/messages/lien-viewer deferred).
//
// Cost-plus open-book transparency per CLAUDE.md: every dollar visible.
// NO builder jargon — translate G702 terminology to homeowner-readable
// language (e.g., "current_payment_due" -> "Amount due this month").
//
// Trust posture test (per CONTEXT R5): if Site Office direction feels too
// archival/utility for homeowner audience, surface as "lighter variant"
// finding. Do not redesign in 1.5b.
//
// Owner portal trust-posture filter: internal-only fields (AI confidence
// scores, PM override audit, vendor cost-code internal mapping) are NOT
// rendered here. Only externally-coherent draw status, payment history,
// and approved-CO totals.
//
// Hook T10c — no imports from @/lib/(supabase|org|auth).

import Link from "next/link";
import {
  CheckBadgeIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

import {
  CALDWELL_DRAWS,
  CALDWELL_JOBS,
  CALDWELL_CHANGE_ORDERS,
} from "@/app/design-system/_fixtures/drummond";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Money from "@/components/nw/Money";
import Badge from "@/components/nw/Badge";

export default function OwnerPortalDashboard() {
  const job = CALDWELL_JOBS[0]; // single-job fixture
  if (!job) return null;

  // Compute KPIs from source-of-truth fixture rows (R.2 honored — no
  // stored aggregates).
  const draws = CALDWELL_DRAWS.filter((d) => d.job_id === job.id);
  const latestDraw = draws[draws.length - 1];
  const paidToDate = draws
    .filter((d) => d.status === "paid")
    .reduce((sum, d) => sum + d.current_payment_due, 0);
  const balanceToFinish = job.current_contract_amount - paidToDate;
  const drawsAwaitingApproval = draws.filter(
    (d) => d.status === "submitted" || d.status === "pm_review",
  );
  const approvedCOs = CALDWELL_CHANGE_ORDERS.filter(
    (co) =>
      co.job_id === job.id &&
      (co.status === "approved" || co.status === "executed"),
  );

  // Next pay app date estimate — last submission + 30 days. Owner-friendly
  // proxy; the system has no scheduled-date model yet.
  const nextDrawDate = latestDraw
    ? (() => {
        const d = new Date(latestDraw.application_date);
        d.setDate(d.getDate() + 30);
        return d.toISOString().slice(0, 10);
      })()
    : null;

  // Short Money formatter for KPI sub-line: integer dollars, no cents.
  const dollarsRounded = (cents: number) =>
    Math.round(cents / 100).toLocaleString("en-US");

  return (
    <div className="px-6 py-8 max-w-[1200px] mx-auto">
      {/* Header band — homeowner-friendly. Note no surname concatenation;
          job.client_name is "Caldwell" (single field per fixture). */}
      <div className="mb-6">
        <Eyebrow tone="muted" className="mb-2">
          Owner portal · {job.name}
        </Eyebrow>
        <h1
          className="text-[28px] mb-2"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Welcome, {job.client_name}
        </h1>
        <p
          className="text-[14px]"
          style={{ color: "var(--text-secondary)" }}
        >
          {job.address} · cost-plus open-book contract · every invoice and
          dollar is visible to you.
        </p>
      </div>

      {/* KPI strip — homeowner-translated. Replaces "G702 contract sum to
          date" / "current payment due" / etc. with plain language. */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 mb-6"
        style={{
          gap: "1px",
          background: "var(--border-default)",
          borderTop: "1px solid var(--border-default)",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        {[
          {
            label: "Total project budget",
            value: <Money cents={job.current_contract_amount} size="lg" />,
            sub: `original $${dollarsRounded(job.original_contract_amount)} + ${approvedCOs.length} change orders`,
          },
          {
            label: "Paid to date",
            value: <Money cents={paidToDate} size="lg" />,
            sub: `${draws.filter((d) => d.status === "paid").length} pay apps paid`,
          },
          {
            label: "Remaining",
            value: <Money cents={balanceToFinish} size="lg" />,
            sub: `${((balanceToFinish / job.current_contract_amount) * 100).toFixed(0)}% of budget`,
          },
          {
            label: "Next pay app expected",
            value: (
              <span
                style={{
                  fontFamily: "var(--font-space-grotesk)",
                  fontWeight: 600,
                  fontSize: "20px",
                  color: "var(--text-primary)",
                }}
              >
                {nextDrawDate ?? "—"}
              </span>
            ),
            sub: `Pay app #${(latestDraw?.draw_number ?? 0) + 1}`,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="p-4"
            style={{ background: "var(--bg-card)" }}
          >
            <Eyebrow tone="muted" className="mb-2">
              {k.label}
            </Eyebrow>
            <div className="mb-1">{k.value}</div>
            <div
              className="text-[10px]"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                color: "var(--text-tertiary)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Awaiting your approval — drawsAwaitingApproval renders only when
          there's a real submitted/pm_review pay app. Caldwell d-caldwell-05
          is "submitted" so this section will render with one item in the
          fixture. */}
      {drawsAwaitingApproval.length > 0 && (
        <Card padding="md" className="mb-6">
          <Eyebrow
            tone="accent"
            className="mb-3"
            icon={<CheckBadgeIcon className="w-3.5 h-3.5" strokeWidth={1.5} />}
          >
            Awaiting your approval · {drawsAwaitingApproval.length}
          </Eyebrow>
          <ul
            className="divide-y"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            {drawsAwaitingApproval.map((d) => (
              <li
                key={d.id}
                className="py-3 flex items-center justify-between gap-4"
              >
                <div>
                  <div
                    className="text-[14px]"
                    style={{
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-space-grotesk)",
                      fontWeight: 500,
                    }}
                  >
                    Pay app #{d.draw_number} — {d.period_start} to{" "}
                    {d.period_end}
                  </div>
                  <div
                    className="text-[11px]"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    Submitted {d.submitted_at?.slice(0, 10) ?? "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Money
                    cents={d.current_payment_due}
                    size="lg"
                    variant="emphasized"
                  />
                  <Link
                    href={`/design-system/prototypes/owner-portal/draws/${d.id}`}
                    className="inline-flex items-center gap-1 px-4 text-[12px] uppercase font-medium"
                    style={{
                      background: "var(--nw-stone-blue)",
                      color: "var(--nw-white-sand)",
                      fontFamily: "var(--font-jetbrains-mono)",
                      letterSpacing: "0.12em",
                      minHeight: "44px",
                    }}
                  >
                    Review →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Recent activity — paid + submitted draws, most-recent first.
          Owner-facing language: "Pay app" not "draw". */}
      <Card padding="md">
        <Eyebrow
          tone="muted"
          className="mb-3"
          icon={<CalendarDaysIcon className="w-3.5 h-3.5" strokeWidth={1.5} />}
        >
          Recent activity
        </Eyebrow>
        <ul className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
          {draws
            .slice()
            .reverse()
            .slice(0, 5)
            .map((d) => (
              <li
                key={d.id}
                className="py-2 flex items-center justify-between gap-3"
              >
                <div>
                  <div
                    className="text-[13px]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Pay app #{d.draw_number} — {d.application_date}
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
                    {d.paid_at
                      ? `Paid ${d.paid_at.slice(0, 10)}`
                      : d.status === "submitted"
                        ? "Awaiting your approval"
                        : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Money cents={d.current_payment_due} size="md" />
                  <Badge
                    variant={
                      d.status === "paid"
                        ? "success"
                        : d.status === "submitted"
                          ? "info"
                          : "neutral"
                    }
                  >
                    {d.status === "submitted"
                      ? "Awaiting"
                      : d.status === "paid"
                        ? "Paid"
                        : d.status.replaceAll("_", " ")}
                  </Badge>
                </div>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}
