"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import AppShell from "@/components/app-shell";
import { useOrgBranding } from "@/components/org-branding-provider";
import { PUBLIC_APP_NAME } from "@/lib/org/public";
import GettingStartedChecklist from "@/components/getting-started-checklist";
import {
  formatMoney,
  formatRelativeTime,
  formatStatus,
} from "@/lib/utils/format";
import { SkeletonStatCard, SkeletonBlock } from "@/components/loading-skeleton";
import EmptyState, { EmptyIcons } from "@/components/empty-state";

type UserRole = "owner" | "admin" | "pm" | "accounting";

interface DashboardData {
  metrics: {
    activeJobs: number;
    pmQueueCount: number;
    pmQueueOldDays: number;
    openDrawsCount: number;
    submittedDrawsOldDays: number;
    paymentsDueCents: number;
    paymentsOverdue30: boolean;
  };
  attention: {
    total: number;
    items: AttentionItem[];
  };
  activity: ActivityEntry[];
  cashFlow: {
    monthInvoiced: number;
    monthPaid: number;
    monthNet: number;
    outstandingTotal: number;
    aging: { current: number; d30: number; d60: number; d90: number };
    upcomingCommitted: number;
  };
}

interface AttentionItem {
  kind: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  href: string;
  ageDays?: number;
}

interface ActivityEntry {
  id: string;
  user_name: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  job_name?: string | null;
  job_id?: string | null;
  link_href?: string;
}

function firstNameOf(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export default function Dashboard() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const [{ data: profile }, { data: membership }] = await Promise.all([
            supabase.from("profiles").select("full_name").eq("id", user.id).single(),
            supabase
              .from("org_members")
              .select("role")
              .eq("user_id", user.id)
              .eq("is_active", true)
              .maybeSingle(),
          ]);
          if (membership?.role) setRole(membership.role as UserRole);
          if (profile?.full_name) setFirstName(firstNameOf(profile.full_name));
        }

        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (res.ok) {
          const json = (await res.json()) as DashboardData;
          setData(json);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const branding = useOrgBranding();
  const brandName = branding?.name ?? PUBLIC_APP_NAME;
  const tagline = branding?.tagline ?? null;
  const isAdminLike = role === "admin" || role === "owner";

  return (
    <AppShell>
      <main className="flex-1 max-w-[1180px] w-full mx-auto px-4 md:px-8 py-7">
        {/* Header */}
        <div className="mb-6 animate-fade-up">
          <h1 className="font-display text-[30px] font-medium tracking-[-0.02em] text-slate-tile">
            {firstName ? `Welcome, ${firstName}` : brandName}
          </h1>
          {tagline && (
            <p className="mt-1 text-[13px] text-tertiary">{tagline}</p>
          )}
        </div>

        {/* Top row — 4 KPI cells with 1px hairline gaps */}
        <section className="mb-6 animate-fade-up stagger-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-bg-mut border border-border-def">
            {loading || !data ? (
              <>
                <SkeletonStatCard />
                <SkeletonStatCard />
                <SkeletonStatCard />
                <SkeletonStatCard />
              </>
            ) : (
              <>
                <MetricCard
                  label="Active Jobs"
                  value={data.metrics.activeJobs.toString()}
                  href="/jobs"
                />
                <MetricCard
                  label="Invoices Pending Review"
                  value={data.metrics.pmQueueCount.toString()}
                  href="/invoices/queue"
                  badge={data.metrics.pmQueueOldDays >= 7 ? { kind: "danger", text: `${data.metrics.pmQueueOldDays}d old` } : undefined}
                />
                <MetricCard
                  label="Open Draws"
                  value={data.metrics.openDrawsCount.toString()}
                  href="/draws"
                  badge={data.metrics.submittedDrawsOldDays >= 5 ? { kind: "warning", text: `${data.metrics.submittedDrawsOldDays}d pending` } : undefined}
                />
                <MetricCard
                  label="Payments Due"
                  value={formatMoney(data.metrics.paymentsDueCents)}
                  href="/invoices/payments"
                  emphasis={data.metrics.paymentsOverdue30 ? "danger" : undefined}
                />
              </>
            )}
          </div>
        </section>

        {/* Second row — Needs Attention queue (full width) */}
        <section className="mb-6 animate-fade-up stagger-2">
          <SectionHeader title="Needs Attention" subtitle={data ? `${data.attention.total} item${data.attention.total === 1 ? "" : "s"}` : undefined} />
          {loading || !data ? (
            <SkeletonBlock height="h-64" />
          ) : data.attention.items.length === 0 ? (
            <EmptyState
              icon={<EmptyIcons.Check />}
              variant="success"
              title="You're all caught up"
              message="Nothing needs your attention right now. New action items will appear here as data flows in."
            />
          ) : (
            <div className="border border-border-def bg-white">
              <ul>
                {data.attention.items.map((item, i) => (
                  <AttentionRow key={`${item.kind}-${i}`} item={item} />
                ))}
              </ul>
              {data.attention.total > data.attention.items.length && (
                <div className="border-t border-border-def px-4 py-3 text-center">
                  <Link href="/invoices/queue" className="font-mono text-[10px] tracking-[0.12em] uppercase text-stone-blue hover:underline">
                    View all {data.attention.total} items
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Third row — Activity Feed + Cash Flow */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-up stagger-3">
          {/* Activity Feed */}
          <div>
            <SectionHeader title="Activity Feed" />
            {loading || !data ? (
              <SkeletonBlock height="h-96" />
            ) : data.activity.length === 0 ? (
              <EmptyState
                icon={<EmptyIcons.Activity />}
                title="No activity yet"
                message="Actions will appear here as your team uses the system."
              />
            ) : (
              <div className="border border-border-def bg-white">
                <ul>
                  {data.activity.map((entry) => (
                    <ActivityRow key={entry.id} entry={entry} />
                  ))}
                </ul>
                <div className="border-t border-border-def px-4 py-3 text-center">
                  <Link href="/settings/admin" className="font-mono text-[10px] tracking-[0.12em] uppercase text-stone-blue hover:underline">
                    View all activity
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Cash Flow Summary */}
          <div>
            <SectionHeader title="Cash Flow" subtitle="This month + outstanding" />
            {loading || !data ? (
              <SkeletonBlock height="h-96" />
            ) : (
              <CashFlowPanel cashFlow={data.cashFlow} />
            )}
          </div>
        </section>

        {isAdminLike && <GettingStartedChecklist />}
      </main>
    </AppShell>
  );
}

// ---------- Metric Card (KPI cell — 1px hairline gap pattern) ----------
function MetricCard({
  label,
  value,
  href,
  badge,
  emphasis,
}: {
  label: string;
  value: string;
  href: string;
  badge?: { kind: "danger" | "warning"; text: string };
  emphasis?: "danger";
}) {
  return (
    <Link
      href={href}
      className="group block p-5 bg-white hover:bg-bg-sub transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-tertiary leading-tight">
          {label}
        </span>
        {badge && (
          <span
            className={`shrink-0 font-mono text-[9px] tracking-[0.12em] uppercase font-medium px-1.5 py-0.5 border ${
              badge.kind === "danger"
                ? "text-nw-danger border-nw-danger"
                : "text-nw-warn border-nw-warn"
            }`}
          >
            {badge.text}
          </span>
        )}
      </div>
      <div
        className={`mt-2.5 font-display text-[28px] font-semibold tracking-[-0.02em] tabular-nums ${
          emphasis === "danger" ? "text-nw-danger" : "text-slate-tile"
        }`}
      >
        {value}
      </div>
    </Link>
  );
}

// ---------- Section Header (eyebrow pattern) ----------
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-border-def">
      <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-tertiary font-medium">{title}</span>
      {subtitle && <span className="font-mono text-[10px] tracking-[0.12em] text-muted">{subtitle}</span>}
    </div>
  );
}

// ---------- Attention Row ----------
const SEV_STYLES: Record<AttentionItem["severity"], { dot: string; label: string }> = {
  critical: { dot: "bg-nw-danger", label: "text-nw-danger" },
  high: { dot: "bg-nw-warn", label: "text-nw-warn" },
  medium: { dot: "bg-nw-warn", label: "text-nw-warn" },
  low: { dot: "bg-[rgba(59,88,100,0.40)]", label: "text-tertiary" },
};

function AttentionRow({ item }: { item: AttentionItem }) {
  const sev = SEV_STYLES[item.severity];
  return (
    <li className="border-b border-border-sub last:border-0">
      <Link
        href={item.href}
        className="flex items-center gap-3 px-4 py-3 hover:bg-bg-sub transition-colors"
      >
        <span className={`shrink-0 inline-block w-2 h-2 rounded-full ${sev.dot}`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-slate-tile font-medium truncate">{item.title}</span>
            {item.ageDays !== undefined && item.ageDays > 0 && (
              <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${sev.label}`}>
                {item.ageDays}d
              </span>
            )}
          </div>
          <p className="text-[12px] text-tertiary mt-0.5 truncate">{item.description}</p>
        </div>
        <svg
          className="shrink-0 w-4 h-4 text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </li>
  );
}

// ---------- Activity Row ----------
function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const verb = describeAction(entry.action, entry.details);
  const entityLabel = describeEntity(entry.entity_type, entry.details);
  const summary = `${entry.user_name ?? "System"} ${verb} ${entityLabel}${entry.job_name ? ` on ${entry.job_name}` : ""}`;
  const content = (
    <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-bg-sub transition-colors">
      <span className="shrink-0 mt-1.5 font-mono text-[10px] text-muted min-w-[48px]">
        {formatRelativeTime(entry.created_at)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] text-slate-tile leading-relaxed">{summary}</p>
      </div>
    </div>
  );
  return (
    <li className="border-b border-border-sub last:border-0">
      {entry.link_href ? <Link href={entry.link_href}>{content}</Link> : content}
    </li>
  );
}

function describeAction(action: string, details: Record<string, unknown> | null): string {
  switch (action) {
    case "created":
      return "created";
    case "updated":
      return "updated";
    case "approved":
      return "approved";
    case "denied":
      return "denied";
    case "voided":
      return "voided";
    case "merged":
      return "merged";
    case "imported":
      return "imported";
    case "deleted":
      return "deleted";
    case "delete_blocked":
      return "tried to delete";
    case "void_blocked":
      return "tried to void";
    case "recomputed":
      return "recomputed";
    case "status_changed": {
      const to = details && typeof details["to"] === "string" ? formatStatus(details["to"] as string) : "";
      return to ? `set status to ${to} on` : "changed status of";
    }
    default:
      return action.replace(/_/g, " ");
  }
}

function describeEntity(entityType: string, details: Record<string, unknown> | null): string {
  const map: Record<string, string> = {
    invoice: "an invoice",
    purchase_order: "a PO",
    change_order: "a change order",
    budget_line: "a budget line",
    budget: "the budget",
    job: "a job",
    vendor: "a vendor",
    cost_code: "a cost code",
    draw: "a draw",
    user: "a user",
  };
  // If details has a more specific identifier, use it.
  if (details) {
    if (typeof details["invoice_number"] === "string") return `Invoice #${details["invoice_number"]}`;
    if (typeof details["po_number"] === "string") return `PO ${details["po_number"]}`;
    if (typeof details["draw_number"] === "number") return `Draw #${details["draw_number"]}`;
    if (typeof details["name"] === "string") return `${map[entityType] ?? entityType} ${details["name"]}`;
  }
  return map[entityType] ?? entityType;
}

// ---------- Cash Flow Panel ----------
function CashFlowPanel({ cashFlow }: { cashFlow: DashboardData["cashFlow"] }) {
  const total =
    cashFlow.aging.current + cashFlow.aging.d30 + cashFlow.aging.d60 + cashFlow.aging.d90;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <div className="border border-border-def bg-white p-5 space-y-5">
      {/* This month */}
      <div>
        <h3 className="font-mono text-[9px] tracking-[0.14em] uppercase text-tertiary mb-2">This month</h3>
        <div className="grid grid-cols-3 gap-3">
          <NumStat label="Invoiced" value={formatMoney(cashFlow.monthInvoiced)} href="/invoices" />
          <NumStat label="Paid" value={formatMoney(cashFlow.monthPaid)} href="/invoices/payments" />
          <NumStat
            label="Net"
            value={formatMoney(cashFlow.monthNet)}
            negative={cashFlow.monthNet < 0}
          />
        </div>
      </div>

      {/* Outstanding aging breakdown */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="font-mono text-[9px] tracking-[0.14em] uppercase text-tertiary">Outstanding</h3>
          <span className="font-mono text-[13px] text-slate-tile tabular-nums">
            {formatMoney(cashFlow.outstandingTotal)}
          </span>
        </div>
        {/* Stacked horizontal bar */}
        <div className="flex h-[5px] w-full overflow-hidden bg-bg-mut">
          {pct(cashFlow.aging.current) > 0 && (
            <div
              className="bg-nw-success"
              style={{ width: `${pct(cashFlow.aging.current)}%` }}
              title={`Current: ${formatMoney(cashFlow.aging.current)}`}
            />
          )}
          {pct(cashFlow.aging.d30) > 0 && (
            <div
              className="bg-nw-warn"
              style={{ width: `${pct(cashFlow.aging.d30)}%` }}
              title={`30-59 days: ${formatMoney(cashFlow.aging.d30)}`}
            />
          )}
          {pct(cashFlow.aging.d60) > 0 && (
            <div
              className="bg-nw-warn/70"
              style={{ width: `${pct(cashFlow.aging.d60)}%` }}
              title={`60-89 days: ${formatMoney(cashFlow.aging.d60)}`}
            />
          )}
          {pct(cashFlow.aging.d90) > 0 && (
            <div
              className="bg-nw-danger"
              style={{ width: `${pct(cashFlow.aging.d90)}%` }}
              title={`90+ days: ${formatMoney(cashFlow.aging.d90)}`}
            />
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <AgeChip color="bg-nw-success" label="Current" value={cashFlow.aging.current} />
          <AgeChip color="bg-nw-warn" label="30-59d" value={cashFlow.aging.d30} />
          <AgeChip color="bg-nw-warn/70" label="60-89d" value={cashFlow.aging.d60} />
          <AgeChip color="bg-nw-danger" label="90+d" value={cashFlow.aging.d90} />
        </div>
      </div>

      {/* Upcoming */}
      <div className="pt-4 border-t border-border-def">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-tertiary">Upcoming (open POs)</span>
          <Link
            href="/jobs"
            className="font-mono text-[13px] text-slate-tile tabular-nums hover:text-stone-blue transition-colors"
          >
            {formatMoney(cashFlow.upcomingCommitted)}
          </Link>
        </div>
      </div>
    </div>
  );
}

function NumStat({
  label,
  value,
  href,
  negative,
}: {
  label: string;
  value: string;
  href?: string;
  negative?: boolean;
}) {
  const inner = (
    <>
      <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-tertiary">{label}</p>
      <p className={`mt-1 font-mono text-[15px] tabular-nums ${negative ? "text-nw-danger" : "text-slate-tile"}`}>
        {value}
      </p>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="block hover:opacity-75 transition-opacity">
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

function AgeChip({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block w-2 h-2 ${color}`} />
      <div>
        <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-tertiary">{label}</p>
        <p className="font-mono text-[12px] tabular-nums text-slate-tile">{formatMoney(value)}</p>
      </div>
    </div>
  );
}
