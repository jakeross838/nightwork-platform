import { createServerClient } from "@/lib/supabase/server";
import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

type ConversationRow = {
  id: string;
  user_id: string;
  org_id: string;
  title: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  escalated_at: string | null;
};

type OrgLookup = { id: string; name: string };
type UserLookup = { id: string; email: string | null; full_name: string | null };

const STATUSES = ["active", "escalated", "resolved"] as const;
const DATE_RANGES = ["7", "30", "all"] as const;

type Params = {
  org?: string;
  status?: string;
  days?: string;
};

function parseParams(p: Params) {
  const org = p.org?.trim() || "";
  const status = STATUSES.includes(p.status as (typeof STATUSES)[number])
    ? (p.status as string)
    : "open"; // custom: active + escalated, hides resolved
  const days = DATE_RANGES.includes(p.days as (typeof DATE_RANGES)[number])
    ? (p.days as string)
    : "30";
  return { org, status, days };
}

async function fetchConversations(
  params: ReturnType<typeof parseParams>
): Promise<ConversationRow[]> {
  const supabase = createServerClient();
  let q = supabase
    .from("support_conversations")
    .select(
      "id, user_id, org_id, title, status, created_at, updated_at, escalated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(500);
  if (params.org) q = q.eq("org_id", params.org);
  if (params.status === "open") {
    q = q.in("status", ["active", "escalated"]);
  } else if (params.status) {
    q = q.eq("status", params.status);
  }
  if (params.days !== "all") {
    const cutoff = new Date(
      Date.now() - Number(params.days) * 24 * 60 * 60 * 1000
    ).toISOString();
    q = q.gte("updated_at", cutoff);
  }
  const { data } = await q;
  return (data ?? []) as ConversationRow[];
}

async function fetchKpis() {
  const supabase = createServerClient();
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  const [active, escalated, resolvedWeekRes] = await Promise.all([
    supabase
      .from("support_conversations")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("support_conversations")
      .select("id", { count: "exact", head: true })
      .eq("status", "escalated"),
    supabase
      .from("support_conversations")
      .select("created_at, resolved_at")
      .eq("status", "resolved")
      .gte("resolved_at", sevenDaysAgo)
      .limit(200),
  ]);

  const sample = (resolvedWeekRes.data ?? []) as Array<{
    created_at: string;
    resolved_at: string | null;
  }>;
  let avgHours: number | null = null;
  if (sample.length > 0) {
    const deltas = sample
      .filter((r) => r.resolved_at)
      .map(
        (r) =>
          new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()
      );
    if (deltas.length > 0) {
      const avgMs = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      avgHours = avgMs / (60 * 60 * 1000);
    }
  }

  return {
    active: active.count ?? 0,
    escalated: escalated.count ?? 0,
    resolvedWeek: sample.length,
    avgHours,
  };
}

async function fetchOrgs(): Promise<OrgLookup[]> {
  const supabase = createServerClient();
  const { data } = await supabase.from("organizations").select("id, name");
  return ((data ?? []) as OrgLookup[]).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

async function fetchProfiles(userIds: string[]): Promise<Map<string, UserLookup>> {
  if (userIds.length === 0) return new Map();
  const supabase = createServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);
  return new Map(((data ?? []) as UserLookup[]).map((p) => [p.id, p]));
}

async function fetchToolCounts(
  convIds: string[]
): Promise<Map<string, number>> {
  if (convIds.length === 0) return new Map();
  const supabase = createServerClient();
  const { data } = await supabase
    .from("support_messages")
    .select("conversation_id, tool_calls")
    .in("conversation_id", convIds)
    .not("tool_calls", "is", null);
  const map = new Map<string, number>();
  for (const row of (data ?? []) as Array<{
    conversation_id: string;
    tool_calls: Array<unknown> | null;
  }>) {
    const count = Array.isArray(row.tool_calls) ? row.tool_calls.length : 0;
    map.set(row.conversation_id, (map.get(row.conversation_id) ?? 0) + count);
  }
  return map;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusVariant(
  status: string
): "neutral" | "info" | "accent" | "success" | "warning" | "danger" {
  if (status === "active") return "info";
  if (status === "escalated") return "warning";
  if (status === "resolved") return "success";
  return "neutral";
}

function truncate(s: string | null, n: number): string {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export default async function SupportInboxPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const params = parseParams(searchParams);
  const [rows, kpis, orgs] = await Promise.all([
    fetchConversations(params),
    fetchKpis(),
    fetchOrgs(),
  ]);

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const profiles = await fetchProfiles(userIds);
  const orgNameById = new Map(orgs.map((o) => [o.id, o.name]));
  const toolCounts = await fetchToolCounts(rows.map((r) => r.id));

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow tone="muted" className="mb-2">
          STAFF · SUPPORT
        </Eyebrow>
        <h1
          className="font-display text-3xl tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Support inbox
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          AI chat threads from customers. Escalated threads need human follow-up.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md">
          <Eyebrow className="mb-2">ACTIVE</Eyebrow>
          <div
            className="text-3xl font-medium tabular-nums"
            style={{
              color: "var(--text-primary)",
              fontFamily: "var(--font-jetbrains-mono)",
            }}
          >
            {kpis.active}
          </div>
        </Card>
        <Card padding="md">
          <Eyebrow tone="warn" className="mb-2">
            ESCALATED
          </Eyebrow>
          <div
            className="text-3xl font-medium tabular-nums"
            style={{
              color: "var(--nw-warn)",
              fontFamily: "var(--font-jetbrains-mono)",
            }}
          >
            {kpis.escalated}
          </div>
        </Card>
        <Card padding="md">
          <Eyebrow className="mb-2">RESOLVED · 7D</Eyebrow>
          <div
            className="text-3xl font-medium tabular-nums"
            style={{
              color: "var(--text-primary)",
              fontFamily: "var(--font-jetbrains-mono)",
            }}
          >
            {kpis.resolvedWeek}
          </div>
        </Card>
        <Card padding="md">
          <Eyebrow className="mb-2">AVG RESOLUTION · 7D</Eyebrow>
          <div
            className="text-3xl font-medium tabular-nums"
            style={{
              color: "var(--text-primary)",
              fontFamily: "var(--font-jetbrains-mono)",
            }}
          >
            {kpis.avgHours == null
              ? "—"
              : kpis.avgHours < 1
                ? `${Math.round(kpis.avgHours * 60)}m`
                : kpis.avgHours < 48
                  ? `${kpis.avgHours.toFixed(1)}h`
                  : `${(kpis.avgHours / 24).toFixed(1)}d`}
          </div>
        </Card>
      </div>

      {/* Filter bar */}
      <Card padding="md">
        <form className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <FilterSelect
            name="org"
            label="ORG"
            value={params.org}
            options={[
              { value: "", label: "All orgs" },
              ...orgs.map((o) => ({ value: o.id, label: o.name })),
            ]}
          />
          <FilterSelect
            name="status"
            label="STATUS"
            value={params.status}
            options={[
              { value: "open", label: "Open (active + escalated)" },
              { value: "active", label: "Active" },
              { value: "escalated", label: "Escalated" },
              { value: "resolved", label: "Resolved" },
              { value: "", label: "All" },
            ]}
          />
          <FilterSelect
            name="days"
            label="RANGE"
            value={params.days}
            options={[
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
              { value: "all", label: "All time" },
            ]}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="h-9 px-4 text-xs uppercase font-medium border"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
                background: "var(--nw-slate-deep)",
                color: "var(--nw-white-sand)",
                borderColor: "var(--nw-slate-deep)",
              }}
            >
              APPLY
            </button>
            <Link
              href="/admin/platform/support"
              className="h-9 px-4 text-xs uppercase font-medium border inline-flex items-center"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
                color: "var(--text-secondary)",
                borderColor: "var(--border-default)",
              }}
            >
              RESET
            </Link>
          </div>
        </form>
      </Card>

      {/* Table */}
      <Card padding="none">
        <table className="w-full text-sm">
          <thead
            className="border-b"
            style={{ borderColor: "var(--border-default)" }}
          >
            <tr>
              <Th label="Updated" />
              <Th label="Org" />
              <Th label="User" />
              <Th label="First message" />
              <Th label="Tools" />
              <Th label="Status" />
              <Th label="" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const user = profiles.get(r.user_id);
              return (
                <tr
                  key={r.id}
                  className="border-b"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <td
                    className="px-4 py-3 text-xs tabular-nums"
                    style={{
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-jetbrains-mono)",
                    }}
                  >
                    {formatDateTime(r.updated_at)}
                  </td>
                  <td
                    className="px-4 py-3 text-sm"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {orgNameById.get(r.org_id) ?? "—"}
                  </td>
                  <td
                    className="px-4 py-3 text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {user?.email ?? user?.full_name ?? "—"}
                  </td>
                  <td
                    className="px-4 py-3 text-sm max-w-[360px]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {truncate(r.title, 120)}
                  </td>
                  <td
                    className="px-4 py-3 text-xs tabular-nums"
                    style={{
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-jetbrains-mono)",
                    }}
                  >
                    {toolCounts.get(r.id) ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(r.status)}>
                      {r.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/platform/support/${r.id}`}
                      className="text-xs underline"
                      style={{ color: "var(--nw-stone-blue)" }}
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  No conversations match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Th({ label }: { label: string }) {
  return (
    <th
      className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-left"
      style={{ color: "var(--text-tertiary)" }}
    >
      {label}
    </th>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <Eyebrow className="mb-1.5 block">{label}</Eyebrow>
      <select
        name={name}
        defaultValue={value}
        className="w-full h-9 px-2 text-sm border"
        style={{
          background: "var(--bg-card)",
          color: "var(--text-primary)",
          borderColor: "var(--border-default)",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
