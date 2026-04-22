"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils/format";
import NwCard from "@/components/nw/Card";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwMoney from "@/components/nw/Money";
import NwStatusDot from "@/components/nw/StatusDot";

const SPENT_STATUSES = [
  "pm_approved",
  "qa_review",
  "qa_approved",
  "pushed_to_qb",
  "in_draw",
  "paid",
];

interface BudgetHealth {
  total_lines: number;
  over_budget: number;
  under_committed: number;
}

interface OpenItems {
  pending_invoices_count: number;
  pending_invoices_total: number;
  draft_pos: number;
  pending_cos: number;
  pending_liens: number;
}

interface ActivityRow {
  id: string;
  created_at: string;
  entity_type: string;
  action: string;
  user_name: string | null;
  details: Record<string, unknown> | null;
}

interface PaymentRow {
  id: string;
  vendor_id: string | null;
  vendor_name: string | null;
  vendor_name_raw: string | null;
  total_amount: number;
  scheduled_payment_date: string | null;
}

/**
 * Composite client-side card group for the job Overview tab: Contract
 * Summary (with % complete bar), Budget Health, Open Items, Recent Activity
 * (last 10), and Upcoming Payments (next 30 days). Each derived value comes
 * from a single query — no N+1 reads.
 */
export interface JobOverviewPreloaded {
  budget_health: BudgetHealth;
  open_items: OpenItems;
  activity: ActivityRow[];
  payments: PaymentRow[];
  billed_to_date: number;
}

export default function JobOverviewCards({
  jobId,
  originalContract,
  revisedContract,
  approvedCosTotal,
  previousCertificatesTotal = 0,
  preloaded,
}: {
  jobId: string;
  originalContract: number;
  revisedContract: number;
  approvedCosTotal: number;
  previousCertificatesTotal?: number;
  preloaded?: JobOverviewPreloaded | null;
}) {
  const [budgetHealth, setBudgetHealth] = useState<BudgetHealth | null>(preloaded?.budget_health ?? null);
  const [openItems, setOpenItems] = useState<OpenItems | null>(preloaded?.open_items ?? null);
  const [activity, setActivity] = useState<ActivityRow[] | null>(preloaded?.activity ?? null);
  const [payments, setPayments] = useState<PaymentRow[] | null>(preloaded?.payments ?? null);
  const [billedToDate, setBilledToDate] = useState(preloaded?.billed_to_date ?? 0);

  useEffect(() => {
    if (preloaded) {
      setBudgetHealth(preloaded.budget_health);
      setOpenItems(preloaded.open_items);
      setActivity(preloaded.activity);
      setPayments(preloaded.payments);
      setBilledToDate(preloaded.billed_to_date);
      return;
    }
    let cancelled = false;
    async function load() {
      // Budget health — revised, committed, invoiced per line.
      const [bhRes, invRes, poRes, coRes, lrRes, actRes, upRes, allInvRes] = await Promise.all([
        supabase
          .from("budget_lines")
          .select("id, revised_estimate, committed, invoiced")
          .eq("job_id", jobId)
          .is("deleted_at", null),
        // Pending invoices (any status before qa_approved that isn't void/denied/kicked-back/held).
        supabase
          .from("invoices")
          .select("id, total_amount, status")
          .eq("job_id", jobId)
          .in("status", ["received", "ai_processed", "pm_review"])
          .is("deleted_at", null),
        // Draft POs.
        supabase
          .from("purchase_orders")
          .select("id")
          .eq("job_id", jobId)
          .eq("status", "draft")
          .is("deleted_at", null),
        // Pending COs.
        supabase
          .from("change_orders")
          .select("id")
          .eq("job_id", jobId)
          .in("status", ["draft", "pending"])
          .is("deleted_at", null),
        // Pending lien releases.
        supabase
          .from("lien_releases")
          .select("id")
          .eq("job_id", jobId)
          .eq("status", "pending")
          .is("deleted_at", null),
        // Last 10 activity rows directly on this job entity. (Activities
        // on child entities like invoices/POs/COs would need a job_id
        // denormalization in activity_log.details — out of scope here;
        // the job-level log already captures retainage edits, status
        // flips, etc.)
        supabase
          .from("activity_log")
          .select("id, created_at, entity_type, action, user_id, details")
          .eq("entity_type", "job")
          .eq("entity_id", jobId)
          .order("created_at", { ascending: false })
          .limit(10),
        // Upcoming scheduled payments (next 30 days, this job).
        supabase
          .from("invoices")
          .select(
            "id, vendor_id, vendor_name_raw, total_amount, scheduled_payment_date, vendors:vendor_id (name)"
          )
          .eq("job_id", jobId)
          .not("scheduled_payment_date", "is", null)
          .gte("scheduled_payment_date", new Date().toISOString().slice(0, 10))
          .lte(
            "scheduled_payment_date",
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
          )
          .is("deleted_at", null)
          .order("scheduled_payment_date"),
        // Billed-to-date (for the % complete / remaining math, mirrors the bar).
        supabase
          .from("invoices")
          .select("total_amount")
          .eq("job_id", jobId)
          .in("status", SPENT_STATUSES)
          .is("deleted_at", null),
      ]);
      if (cancelled) return;

      // Budget health buckets.
      const lines =
        (bhRes.data as Array<{
          revised_estimate: number;
          committed: number;
          invoiced: number;
        }> | null) ?? [];
      let overBudget = 0;
      let underCommitted = 0;
      for (const l of lines) {
        const rev = l.revised_estimate ?? 0;
        const committed = l.committed ?? 0;
        const invoiced = l.invoiced ?? 0;
        if (rev > 0 && invoiced + committed > rev) overBudget += 1;
        if (rev > 0 && committed === 0) underCommitted += 1;
      }
      setBudgetHealth({
        total_lines: lines.length,
        over_budget: overBudget,
        under_committed: underCommitted,
      });

      // Open items.
      const invRows = (invRes.data as Array<{ total_amount: number }> | null) ?? [];
      setOpenItems({
        pending_invoices_count: invRows.length,
        pending_invoices_total: invRows.reduce((s, r) => s + (r.total_amount ?? 0), 0),
        draft_pos: (poRes.data ?? []).length,
        pending_cos: (coRes.data ?? []).length,
        pending_liens: (lrRes.data ?? []).length,
      });

      // Activity — join names on the client since we don't have a shared view.
      const actRaw = (actRes.data ?? []) as Array<{
        id: string;
        created_at: string;
        entity_type: string;
        action: string;
        user_id: string | null;
        details: Record<string, unknown> | null;
      }>;
      const userIds = Array.from(
        new Set(actRaw.map((a) => a.user_id).filter((id): id is string => !!id))
      );
      const nameById = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        for (const p of profiles ?? []) {
          nameById.set((p as { id: string }).id, (p as { full_name: string }).full_name);
        }
      }
      setActivity(
        actRaw.map((a) => ({
          id: a.id,
          created_at: a.created_at,
          entity_type: a.entity_type,
          action: a.action,
          user_name: a.user_id ? nameById.get(a.user_id) ?? null : null,
          details: a.details,
        }))
      );

      // Upcoming payments.
      setPayments(
        ((upRes.data ?? []) as Array<{
          id: string;
          vendor_id: string | null;
          vendor_name_raw: string | null;
          total_amount: number;
          scheduled_payment_date: string | null;
          vendors: { name: string } | { name: string }[] | null;
        }>).map((r) => {
          const vendorName = Array.isArray(r.vendors) ? r.vendors[0]?.name : r.vendors?.name;
          return {
            id: r.id,
            vendor_id: r.vendor_id,
            vendor_name: vendorName ?? null,
            vendor_name_raw: r.vendor_name_raw,
            total_amount: r.total_amount,
            scheduled_payment_date: r.scheduled_payment_date,
          };
        })
      );

      // Billed to date (% complete on Contract Summary card).
      // Include pre-Nightwork baseline for mid-project imports.
      const allInv = (allInvRes.data as Array<{ total_amount: number }> | null) ?? [];
      const nightworkBilled = allInv.reduce((s, r) => s + (r.total_amount ?? 0), 0);
      setBilledToDate(previousCertificatesTotal + nightworkBilled);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [jobId, preloaded]);

  const percentComplete =
    revisedContract > 0
      ? Math.min(100, Math.max(0, (billedToDate / revisedContract) * 100))
      : 0;

  return (
    <div className="space-y-4">
      {/* Top row: Contract Summary + Budget Health + Open Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Contract Summary */}
        <SectionCard title="Contract Summary">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MiniStat label="Original" cents={originalContract} />
            <MiniStat label="Approved COs" cents={approvedCosTotal} signColor />
            <MiniStat label="Revised" cents={revisedContract} emphasized />
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <NwEyebrow tone="muted">% Complete</NwEyebrow>
              <span
                className="tabular-nums text-[13px]"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  color: "var(--text-primary)",
                }}
              >
                {percentComplete.toFixed(1)}%
              </span>
            </div>
            <div
              className="mt-1.5 h-2 overflow-hidden"
              style={{ background: "var(--bg-subtle)" }}
            >
              <div
                className="h-full transition-all"
                style={{ width: `${percentComplete}%`, background: "var(--nw-stone-blue)" }}
              />
            </div>
          </div>
        </SectionCard>

        {/* Budget Health */}
        <SectionCard title="Budget Health">
          {budgetHealth === null ? (
            <Placeholder />
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <HealthStat label="Total Lines" value={budgetHealth.total_lines} />
              <HealthStat
                label="Over Budget"
                value={budgetHealth.over_budget}
                tone="danger"
                href={`/jobs/${jobId}/budget?filter=over`}
              />
              <HealthStat
                label="Under Committed"
                value={budgetHealth.under_committed}
                tone="warning"
                href={`/jobs/${jobId}/budget?filter=uncommitted`}
              />
            </div>
          )}
        </SectionCard>

        {/* Open Items */}
        <SectionCard title="Open Items">
          {openItems === null ? (
            <Placeholder />
          ) : (
            <div className="space-y-2">
              <OpenItemRow
                href={`/jobs/${jobId}/invoices?status=pending`}
                label="Pending Invoices"
                count={openItems.pending_invoices_count}
                amountCents={openItems.pending_invoices_total}
              />
              <OpenItemRow
                href={`/jobs/${jobId}/purchase-orders?status=draft`}
                label="Draft POs"
                count={openItems.draft_pos}
              />
              <OpenItemRow
                href={`/jobs/${jobId}/change-orders?status=pending`}
                label="Pending COs"
                count={openItems.pending_cos}
              />
              <OpenItemRow
                href={`/jobs/${jobId}/lien-releases?status=pending`}
                label="Pending Liens"
                count={openItems.pending_liens}
              />
            </div>
          )}
        </SectionCard>
      </div>

      {/* Recent Activity */}
      <SectionCard
        title="Recent Activity"
        action={
          <Link
            href={`/jobs/${jobId}?view=activity`}
            className="text-[11px] uppercase hover:underline"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.14em",
              color: "var(--nw-gulf-blue)",
            }}
          >
            View all
          </Link>
        }
      >
        {activity === null ? (
          <Placeholder />
        ) : activity.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>No recent activity.</p>
        ) : (
          <ul
            className="divide-y"
            style={{ borderColor: "var(--border-default)" }}
          >
            {activity.map((a) => (
              <li
                key={a.id}
                className="py-2 flex items-start gap-3 text-[12px]"
              >
                <span className="mt-1.5">
                  <NwStatusDot variant="info" size="sm" />
                </span>
                <span
                  className="shrink-0 w-28 tabular-nums text-[10px] uppercase"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    letterSpacing: "0.14em",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {formatActivityTs(a.created_at)}
                </span>
                <span className="flex-1 break-words" style={{ color: "var(--text-primary)" }}>
                  <span className="font-medium">{formatEntityAction(a.entity_type, a.action)}</span>
                  {summarizeDetails(a.details) && (
                    <span style={{ color: "var(--text-tertiary)" }}> · {summarizeDetails(a.details)}</span>
                  )}
                </span>
                <span className="shrink-0" style={{ color: "var(--text-tertiary)" }}>{a.user_name ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Upcoming Payments */}
      <SectionCard title="Upcoming Payments (next 30 days)">
        {payments === null ? (
          <Placeholder />
        ) : payments.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>No scheduled payments in the next 30 days.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border-default)" }}>
            {payments.map((p) => (
              <li
                key={p.id}
                className="py-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-[12px]"
              >
                <span className="sm:flex-1 truncate" style={{ color: "var(--text-primary)" }}>
                  {p.vendor_name ?? p.vendor_name_raw ?? "—"}
                </span>
                <span className="flex items-center justify-between gap-3 sm:gap-3">
                  <span className="sm:w-24 sm:text-right">
                    <NwMoney cents={p.total_amount} size="sm" variant="muted" />
                  </span>
                  <span
                    className="tabular-nums sm:w-28 sm:text-right text-[10px] uppercase"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      letterSpacing: "0.14em",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {formatDate(p.scheduled_payment_date)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <NwCard padding="md">
      <div className="flex items-center justify-between mb-3">
        <NwEyebrow tone="muted">{title}</NwEyebrow>
        {action}
      </div>
      {children}
    </NwCard>
  );
}

function Placeholder() {
  return (
    <div className="h-16 flex items-center justify-center">
      <div
        className="w-4 h-4 border-2 animate-spin"
        style={{
          borderColor: "var(--border-default)",
          borderTopColor: "var(--nw-stone-blue)",
        }}
      />
    </div>
  );
}

function MiniStat({
  label,
  cents,
  emphasized,
  signColor,
}: {
  label: string;
  cents: number;
  emphasized?: boolean;
  signColor?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <NwEyebrow tone="muted">{label}</NwEyebrow>
      <NwMoney
        cents={cents}
        size="md"
        variant={emphasized ? "emphasized" : "default"}
        signColor={signColor}
      />
    </div>
  );
}

function HealthStat({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: number;
  tone?: "danger" | "warning";
  href?: string;
}) {
  const valueColor =
    tone === "danger"
      ? "var(--nw-danger)"
      : tone === "warning"
        ? "var(--nw-warn)"
        : "var(--text-primary)";
  const body = (
    <div className="flex flex-col gap-1">
      <NwEyebrow tone="muted">{label}</NwEyebrow>
      <p
        className="text-2xl tabular-nums"
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          fontWeight: 500,
          color: valueColor,
        }}
      >
        {value}
      </p>
    </div>
  );
  return href && value > 0 ? (
    <Link href={href} className="block hover:opacity-80 transition-opacity">
      {body}
    </Link>
  ) : (
    body
  );
}

function OpenItemRow({
  href,
  label,
  count,
  amountCents,
}: {
  href: string;
  label: string;
  count: number;
  amountCents?: number;
}) {
  if (count === 0) {
    return (
      <div
        className="flex items-center justify-between text-[12px] py-1"
        style={{ color: "var(--text-tertiary)" }}
      >
        <span>{label}</span>
        <span className="tabular-nums" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>0</span>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="flex items-center justify-between text-[12px] py-1 transition-colors hover:opacity-75"
      style={{ color: "var(--text-primary)" }}
    >
      <span>{label}</span>
      <span className="flex items-center gap-3 tabular-nums">
        {amountCents !== undefined && (
          <NwMoney cents={amountCents} size="sm" variant="muted" />
        )}
        <span
          className="font-medium"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          {count}
        </span>
      </span>
    </Link>
  );
}

function formatActivityTs(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatEntityAction(entity: string, action: string) {
  const e = entity.replace(/_/g, " ");
  const a = action.replace(/_/g, " ");
  return `${e[0].toUpperCase()}${e.slice(1)} ${a}`;
}

function summarizeDetails(details: Record<string, unknown> | null): string | null {
  if (!details) return null;
  if (typeof details.from === "string" && typeof details.to === "string") {
    return `${details.from} → ${details.to}`;
  }
  if (typeof details.field === "string") {
    const to = details.to;
    if (typeof to === "number" || typeof to === "string" || typeof to === "boolean") {
      return `${details.field} → ${String(to)}`;
    }
    return `${details.field} changed`;
  }
  return null;
}
