import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";
import { checkPlanLimit, planDisplayName } from "@/lib/plan-limits";

export const dynamic = "force-dynamic";

type UsageRow = {
  id: string;
  created_at: string;
  function_type: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_cents: number | null;
  status: string;
  user_id: string | null;
};

type MonthlyTotal = {
  label: string;
  calls: number;
  cost_cents: number;
};

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function formatCents(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(cents / 100);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFunctionType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function UsageDashboardPage() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");
  if (membership.role !== "admin" && membership.role !== "owner") {
    redirect("/settings/company");
  }

  const supabase = createServerClient();
  const orgId = membership.org_id;

  // Pull plan-limit snapshots for every dimension the spec calls for.
  const [aiCheck, usersCheck, jobsCheck, storageCheck] = await Promise.all([
    checkPlanLimit(orgId, "ai_calls"),
    checkPlanLimit(orgId, "users"),
    checkPlanLimit(orgId, "active_jobs"),
    checkPlanLimit(orgId, "storage"),
  ]);

  // Recent API calls (last 50) and last-3-months totals.
  const { data: recentRaw } = await supabase
    .from("api_usage")
    .select("id, created_at, function_type, input_tokens, output_tokens, total_tokens, estimated_cost_cents, status, user_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);
  const recent = (recentRaw ?? []) as UsageRow[];

  // Resolve user names for the "Triggered by" column.
  const userIds = Array.from(new Set(recent.map((r) => r.user_id).filter((x): x is string => !!x)));
  const { data: profileRows } = userIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] as { id: string; full_name: string }[] };
  const profileById = new Map(
    (profileRows ?? []).map((p) => [p.id as string, p.full_name as string])
  );

  // Monthly totals for the last 3 months (including current).
  const now = new Date();
  const monthStarts: Date[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthStarts.push(d);
  }
  const earliest = monthStarts[0];
  const { data: monthRowsRaw } = await supabase
    .from("api_usage")
    .select("created_at, estimated_cost_cents")
    .eq("org_id", orgId)
    .gte("created_at", earliest.toISOString());
  const monthRows = (monthRowsRaw ?? []) as Array<{ created_at: string; estimated_cost_cents: number | null }>;

  const monthly: MonthlyTotal[] = monthStarts.map((start, idx) => {
    const end =
      idx < monthStarts.length - 1
        ? monthStarts[idx + 1]
        : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    let calls = 0;
    let cost = 0;
    for (const row of monthRows) {
      const t = new Date(row.created_at).getTime();
      if (t >= start.getTime() && t < end.getTime()) {
        calls++;
        cost += row.estimated_cost_cents ?? 0;
      }
    }
    return { label: monthLabel(start), calls, cost_cents: cost };
  });

  // Storage is a placeholder number until we add a real tracking pipeline.
  const storageKnown = storageCheck.current > 0 || storageCheck.limit > 0;

  return (
    <div className="space-y-6">
      <section className="bg-white border border-border-def p-6">
        <div className="flex items-baseline justify-between flex-wrap gap-3">
          <div>
            <p className="text-[11px] tracking-[0.08em] uppercase text-tertiary">Current Plan</p>
            <h2 className="mt-1 font-display text-3xl text-slate-tile">{planDisplayName(aiCheck.plan)}</h2>
            <p className="mt-1 text-sm text-secondary">
              Usage resets on the 1st of each month.
            </p>
          </div>
          <Link
            href="/settings/billing"
            className="px-4 py-2 border border-border-def text-[12px] tracking-[0.08em] uppercase text-slate-tile hover:bg-bg-sub transition-colors"
          >
            Change Plan
          </Link>
        </div>
      </section>

      <div className="grid sm:grid-cols-2 gap-4">
        <UsageCard
          label="AI Calls (this month)"
          current={aiCheck.current}
          limit={aiCheck.limit}
        />
        <UsageCard
          label="Active Jobs"
          current={jobsCheck.current}
          limit={jobsCheck.limit}
        />
        <UsageCard
          label="Team Members"
          current={usersCheck.current}
          limit={usersCheck.limit}
        />
        {storageKnown ? (
          <UsageCard
            label="Storage (GB)"
            current={storageCheck.current}
            limit={storageCheck.limit}
          />
        ) : (
          <div className="bg-white border border-border-def p-5">
            <p className="text-[11px] tracking-[0.08em] uppercase text-tertiary">Storage</p>
            <p className="mt-2 font-display text-2xl text-slate-tile">Coming soon</p>
            <p className="mt-2 text-xs text-tertiary">
              We&apos;ll surface per-org storage usage once the Supabase Storage tracking pipeline lands.
            </p>
          </div>
        )}
      </div>

      <section className="bg-white border border-border-def p-6">
        <h3 className="font-display text-lg text-slate-tile">Last 3 months</h3>
        <p className="mt-1 text-xs text-tertiary">
          AI call volume and estimated cost by calendar month.
        </p>
        <div className="mt-4 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-[0.08em] uppercase text-tertiary border-b border-border-def">
                <th className="py-2 font-medium">Month</th>
                <th className="py-2 font-medium">AI calls</th>
                <th className="py-2 font-medium">Estimated cost</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m) => (
                <tr key={m.label} className="border-b border-border-def last:border-b-0">
                  <td className="py-2 text-slate-tile">{m.label}</td>
                  <td className="py-2 text-slate-tile">{m.calls.toLocaleString()}</td>
                  <td className="py-2 text-slate-tile">{formatCents(m.cost_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-border-def p-6">
        <h3 className="font-display text-lg text-slate-tile">Recent API Calls</h3>
        <p className="mt-1 text-xs text-tertiary">
          Last 50 calls. Each invoice parse and future AI feature is logged here.
        </p>
        {recent.length === 0 ? (
          <p className="mt-6 text-sm text-tertiary">
            No API calls yet this billing period. Upload an invoice to see activity here.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] tracking-[0.08em] uppercase text-tertiary border-b border-border-def">
                  <th className="py-2 font-medium">Time</th>
                  <th className="py-2 font-medium">Function</th>
                  <th className="py-2 font-medium">Tokens</th>
                  <th className="py-2 font-medium">Cost</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Triggered by</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-b border-border-def last:border-b-0">
                    <td className="py-2 text-slate-tile whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                    <td className="py-2 text-slate-tile">{formatFunctionType(r.function_type)}</td>
                    <td className="py-2 text-secondary tabular-nums">
                      {(r.total_tokens ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 text-secondary tabular-nums">{formatCents(r.estimated_cost_cents)}</td>
                    <td className="py-2">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="py-2 text-secondary">
                      {r.user_id ? (profileById.get(r.user_id) ?? "—") : "System"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function UsageCard({
  label,
  current,
  limit,
}: {
  label: string;
  current: number;
  limit: number;
}) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : limit > 0 ? Math.min(100, (current / limit) * 100) : 0;
  const nearCap = !unlimited && pct >= 80;
  const atCap = !unlimited && current >= limit;

  const barColor = atCap
    ? "bg-nw-danger"
    : nearCap
      ? "bg-nw-danger"
      : "bg-slate-deep";
  const valueColor = atCap || nearCap ? "text-nw-danger" : "text-slate-tile";

  return (
    <div className="bg-white border border-border-def p-5">
      <p className="text-[11px] tracking-[0.08em] uppercase text-tertiary">{label}</p>
      <p className={`mt-2 font-display text-2xl ${valueColor}`}>
        {current.toLocaleString()}
        <span className="text-tertiary text-base font-normal">
          {" / "}
          {unlimited ? "Unlimited" : limit.toLocaleString()}
        </span>
      </p>
      {!unlimited && (
        <div className="mt-3 h-2 bg-bg-sub rounded-sm overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {nearCap && !atCap && (
        <p className="mt-2 text-[11px] text-nw-danger">
          Approaching your plan limit.
        </p>
      )}
      {atCap && (
        <p className="mt-2 text-[11px] text-nw-danger">
          Limit reached. Upgrade to keep going.
        </p>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: "bg-nw-success-muted text-nw-success border-nw-success",
    error: "bg-nw-danger-muted text-nw-danger border-nw-danger",
    timeout: "bg-nw-warn-muted text-nw-warn border-nw-warn",
  };
  const cls = styles[status] ?? "bg-bg-sub text-secondary border-border-def";
  return (
    <span className={`px-2 py-0.5 border text-[10px] tracking-[0.08em] uppercase ${cls}`}>
      {status}
    </span>
  );
}
