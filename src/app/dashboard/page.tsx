"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import AppShell from "@/components/app-shell";
import { useOrgBranding } from "@/components/org-branding-provider";
import { PUBLIC_APP_NAME } from "@/lib/org/public";
import GettingStartedChecklist from "@/components/getting-started-checklist";
import {
  formatRelativeTime,
  formatStatus,
} from "@/lib/utils/format";
import { SkeletonStatCard, SkeletonBlock } from "@/components/loading-skeleton";
import EmptyState, { EmptyIcons } from "@/components/empty-state";
import NwCard from "@/components/nw/Card";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwButton from "@/components/nw/Button";
import NwMoney from "@/components/nw/Money";
import NwStatusDot, { type StatusDotVariant } from "@/components/nw/StatusDot";

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErrorMessage(null);
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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Dashboard failed (${res.status})`);
      }
      const json = (await res.json()) as DashboardData;
      setData(json);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Couldn't load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const branding = useOrgBranding();
  const brandName = branding?.name ?? PUBLIC_APP_NAME;
  const tagline = branding?.tagline ?? null;
  const isAdminLike = role === "admin" || role === "owner";

  return (
    <AppShell>
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 md:px-6 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <NwEyebrow tone="muted" className="mb-2">Overview · Today</NwEyebrow>
          <h1
            className="m-0"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 500,
              fontSize: "30px",
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}
          >
            {firstName ? `Welcome, ${firstName}` : brandName}
          </h1>
          {tagline && (
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{tagline}</p>
          )}
        </div>

        {errorMessage && !loading && (
          <section className="mb-6 animate-fade-up">
            <NwCard
              padding="md"
              style={{ borderColor: "var(--nw-danger)" }}
            >
              <NwEyebrow tone="danger" className="mb-2">Couldn&apos;t load</NwEyebrow>
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                {errorMessage}
              </p>
              <div className="mt-4">
                <NwButton variant="secondary" size="sm" onClick={load}>Retry</NwButton>
              </div>
            </NwCard>
          </section>
        )}

        {/* Top row — 4 metric cards */}
        <section className="mb-6 animate-fade-up stagger-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                  cents={data.metrics.paymentsDueCents}
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
            <NwCard padding="none">
              <ul>
                {data.attention.items.map((item, i) => (
                  <AttentionRow key={`${item.kind}-${i}`} item={item} />
                ))}
              </ul>
              {data.attention.total > data.attention.items.length && (
                <div className="border-t px-4 py-3 text-center" style={{ borderColor: "var(--border-default)" }}>
                  <Link href="/invoices/queue" className="text-sm hover:underline" style={{ color: "var(--nw-gulf-blue)" }}>
                    View all {data.attention.total} items
                  </Link>
                </div>
              )}
            </NwCard>
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
              <NwCard padding="none">
                <ul>
                  {data.activity.map((entry) => (
                    <ActivityRow key={entry.id} entry={entry} />
                  ))}
                </ul>
                <div className="border-t px-4 py-3 text-center" style={{ borderColor: "var(--border-default)" }}>
                  <Link href="/settings/admin" className="text-sm hover:underline" style={{ color: "var(--nw-gulf-blue)" }}>
                    View all activity
                  </Link>
                </div>
              </NwCard>
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

// ---------- Metric Card ----------
function MetricCard({
  label,
  value,
  cents,
  href,
  badge,
  emphasis,
}: {
  label: string;
  value?: string;
  cents?: number;
  href: string;
  badge?: { kind: "danger" | "warning"; text: string };
  emphasis?: "danger";
}) {
  return (
    <Link
      href={href}
      className="group block p-4 border transition-colors"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        color: "var(--text-primary)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <NwEyebrow tone="muted">{label}</NwEyebrow>
        {badge && (
          <NwBadge variant={badge.kind === "danger" ? "danger" : "warning"} size="sm">
            {badge.text}
          </NwBadge>
        )}
      </div>
      <div className="mt-3">
        {cents !== undefined ? (
          <NwMoney
            cents={cents}
            size="xl"
            variant={emphasis === "danger" ? "negative" : "emphasized"}
          />
        ) : (
          <span
            className="tabular-nums"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: "28px",
              fontWeight: 500,
              color: emphasis === "danger" ? "var(--nw-danger)" : "var(--text-primary)",
            }}
          >
            {value}
          </span>
        )}
      </div>
    </Link>
  );
}

// ---------- Section Header ----------
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h2
        className="m-0"
        style={{
          fontFamily: "var(--font-space-grotesk)",
          fontWeight: 500,
          fontSize: "18px",
          letterSpacing: "-0.01em",
          color: "var(--text-primary)",
        }}
      >
        {title}
      </h2>
      {subtitle && <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{subtitle}</p>}
    </div>
  );
}

// ---------- Attention Row ----------
const SEV_DOT: Record<AttentionItem["severity"], StatusDotVariant> = {
  critical: "danger",
  high: "danger",
  medium: "pending",
  low: "inactive",
};

function AttentionRow({ item }: { item: AttentionItem }) {
  return (
    <li className="border-b last:border-0" style={{ borderColor: "var(--border-default)" }}>
      <Link
        href={item.href}
        className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-subtle)] transition-colors"
      >
        <NwStatusDot variant={SEV_DOT[item.severity]} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.title}</span>
            {item.ageDays !== undefined && item.ageDays > 0 && (
              <NwBadge
                variant={item.severity === "critical" || item.severity === "high" ? "danger" : "warning"}
                size="sm"
              >
                {item.ageDays}d
              </NwBadge>
            )}
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-tertiary)" }}>{item.description}</p>
        </div>
        <svg
          className="shrink-0 w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          style={{ color: "var(--text-tertiary)" }}
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
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--bg-subtle)] transition-colors">
      <span className="mt-1.5">
        <NwStatusDot variant="info" size="sm" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{summary}</p>
        <p
          className="text-[10px] uppercase tracking-[0.14em] mt-0.5"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            color: "var(--text-tertiary)",
          }}
        >
          {formatRelativeTime(entry.created_at)}
        </p>
      </div>
    </div>
  );
  return (
    <li className="border-b last:border-0" style={{ borderColor: "var(--border-default)" }}>
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
    <NwCard padding="md" className="space-y-5">
      {/* This month */}
      <div>
        <NwEyebrow tone="muted" className="mb-2">This month</NwEyebrow>
        <div className="grid grid-cols-3 gap-3">
          <NumStat label="Invoiced" cents={cashFlow.monthInvoiced} href="/invoices" />
          <NumStat label="Paid" cents={cashFlow.monthPaid} href="/invoices/payments" />
          <NumStat label="Net" cents={cashFlow.monthNet} signColor />
        </div>
      </div>

      {/* Outstanding aging breakdown */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <NwEyebrow tone="muted">Outstanding</NwEyebrow>
          <NwMoney cents={cashFlow.outstandingTotal} size="md" variant="emphasized" />
        </div>
        {/* Stacked horizontal bar */}
        <div
          className="flex h-2.5 w-full overflow-hidden border"
          style={{ borderColor: "var(--border-default)", background: "var(--bg-subtle)" }}
        >
          {pct(cashFlow.aging.current) > 0 && (
            <div
              style={{ width: `${pct(cashFlow.aging.current)}%`, background: "var(--nw-success)" }}
              title={`Current`}
            />
          )}
          {pct(cashFlow.aging.d30) > 0 && (
            <div
              style={{ width: `${pct(cashFlow.aging.d30)}%`, background: "var(--nw-warn)" }}
              title={`30-59 days`}
            />
          )}
          {pct(cashFlow.aging.d60) > 0 && (
            <div
              style={{ width: `${pct(cashFlow.aging.d60)}%`, background: "var(--nw-warn)" }}
              title={`60-89 days`}
            />
          )}
          {pct(cashFlow.aging.d90) > 0 && (
            <div
              style={{ width: `${pct(cashFlow.aging.d90)}%`, background: "var(--nw-danger)" }}
              title={`90+ days`}
            />
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <AgeChip variant="active" label="Current" value={cashFlow.aging.current} />
          <AgeChip variant="pending" label="30-59d" value={cashFlow.aging.d30} />
          <AgeChip variant="pending" label="60-89d" value={cashFlow.aging.d60} />
          <AgeChip variant="danger" label="90+d" value={cashFlow.aging.d90} />
        </div>
      </div>

      {/* Upcoming */}
      <div className="pt-4 border-t" style={{ borderColor: "var(--border-default)" }}>
        <div className="flex items-baseline justify-between">
          <NwEyebrow tone="muted">Upcoming (open POs)</NwEyebrow>
          <Link href="/jobs" className="hover:opacity-75 transition-opacity">
            <NwMoney cents={cashFlow.upcomingCommitted} size="md" />
          </Link>
        </div>
      </div>
    </NwCard>
  );
}

function NumStat({
  label,
  cents,
  href,
  signColor,
}: {
  label: string;
  cents: number;
  href?: string;
  signColor?: boolean;
}) {
  const inner = (
    <div className="flex flex-col gap-1">
      <NwEyebrow tone="muted">{label}</NwEyebrow>
      <NwMoney cents={cents} size="md" signColor={signColor} />
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block hover:opacity-75 transition-opacity">
        {inner}
      </Link>
    );
  }
  return inner;
}

function AgeChip({ variant, label, value }: { variant: StatusDotVariant; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <NwStatusDot variant={variant} size="sm" />
      <div>
        <NwEyebrow tone="muted">{label}</NwEyebrow>
        <NwMoney cents={value} size="sm" />
      </div>
    </div>
  );
}
