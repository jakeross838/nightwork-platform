import { createServerClient } from "@/lib/supabase/server";
import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

type FeedbackRow = {
  id: string;
  created_at: string;
  category: string;
  severity: string;
  status: string;
  note: string;
  page_url: string | null;
  user_id: string;
  org_id: string;
  resolved_at: string | null;
};

type OrgLookup = { id: string; name: string };
type UserLookup = { id: string; email: string | null; full_name: string | null };

const CATEGORIES = ["bug", "confusion", "idea", "other"] as const;
const SEVERITIES = ["low", "medium", "high"] as const;
const STATUSES = [
  "new",
  "reviewing",
  "in_progress",
  "resolved",
  "wont_fix",
] as const;
const DATE_RANGES = ["7", "30", "all"] as const;

type Params = {
  q?: string;
  org?: string;
  category?: string;
  severity?: string;
  status?: string;
  days?: string;
};

function parseParams(searchParams: Params) {
  const q = searchParams.q?.trim() || "";
  const org = searchParams.org?.trim() || "";
  const category = CATEGORIES.includes(searchParams.category as (typeof CATEGORIES)[number])
    ? (searchParams.category as string)
    : "";
  const severity = SEVERITIES.includes(searchParams.severity as (typeof SEVERITIES)[number])
    ? (searchParams.severity as string)
    : "";
  const status = STATUSES.includes(searchParams.status as (typeof STATUSES)[number])
    ? (searchParams.status as string)
    : "open"; // custom token: means new + reviewing + in_progress
  const days = DATE_RANGES.includes(searchParams.days as (typeof DATE_RANGES)[number])
    ? (searchParams.days as string)
    : "30";
  return { q, org, category, severity, status, days };
}

async function fetchFeedback(params: ReturnType<typeof parseParams>) {
  const supabase = createServerClient();

  let query = supabase
    .from("feedback_notes")
    .select(
      "id, created_at, category, severity, status, note, page_url, user_id, org_id, resolved_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (params.q) {
    query = query.ilike("note", `%${params.q}%`);
  }
  if (params.org) {
    query = query.eq("org_id", params.org);
  }
  if (params.category) {
    query = query.eq("category", params.category);
  }
  if (params.severity) {
    query = query.eq("severity", params.severity);
  }
  if (params.status === "open") {
    query = query.in("status", ["new", "reviewing", "in_progress"]);
  } else if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.days !== "all") {
    const cutoff = new Date(
      Date.now() - Number(params.days) * 24 * 60 * 60 * 1000
    ).toISOString();
    query = query.gte("created_at", cutoff);
  }

  const { data } = await query;
  return (data ?? []) as FeedbackRow[];
}

async function fetchKpis() {
  const supabase = createServerClient();
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const [newCount, inProgressCount, resolvedWeek, responseSample] =
    await Promise.all([
      supabase
        .from("feedback_notes")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
      supabase
        .from("feedback_notes")
        .select("id", { count: "exact", head: true })
        .in("status", ["reviewing", "in_progress"]),
      supabase
        .from("feedback_notes")
        .select("id", { count: "exact", head: true })
        .eq("status", "resolved")
        .gte("resolved_at", sevenDaysAgo),
      supabase
        .from("feedback_notes")
        .select("created_at, resolved_at")
        .eq("status", "resolved")
        .gte("resolved_at", sevenDaysAgo)
        .limit(200),
    ]);

  const resolvedSample =
    (responseSample.data ?? []) as Array<{
      created_at: string;
      resolved_at: string | null;
    }>;
  let avgHours: number | null = null;
  if (resolvedSample.length > 0) {
    const deltas = resolvedSample
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
    newCount: newCount.count ?? 0,
    inProgress: inProgressCount.count ?? 0,
    resolvedWeek: resolvedWeek.count ?? 0,
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

async function fetchUserLookups(userIds: string[]): Promise<Map<string, UserLookup>> {
  if (userIds.length === 0) return new Map();
  const supabase = createServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);
  const map = new Map<string, UserLookup>();
  for (const row of (data ?? []) as UserLookup[]) {
    map.set(row.id, row);
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

function severityVariant(sev: string): "neutral" | "warning" | "danger" {
  if (sev === "low") return "neutral";
  if (sev === "medium") return "warning";
  return "danger";
}

function statusVariant(
  status: string
): "neutral" | "info" | "accent" | "success" | "danger" {
  if (status === "new") return "info";
  if (status === "reviewing") return "accent";
  if (status === "in_progress") return "accent";
  if (status === "resolved") return "success";
  if (status === "wont_fix") return "neutral";
  return "neutral";
}

function categoryLabel(c: string): string {
  if (c === "bug") return "BUG";
  if (c === "confusion") return "CONFUSION";
  if (c === "idea") return "IDEA";
  return "OTHER";
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export default async function FeedbackInboxPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const params = parseParams(searchParams);
  const [rows, kpis, orgs] = await Promise.all([
    fetchFeedback(params),
    fetchKpis(),
    fetchOrgs(),
  ]);

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const userLookups = await fetchUserLookups(userIds);
  const orgNameById = new Map(orgs.map((o) => [o.id, o.name]));

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow tone="muted" className="mb-2">
          STAFF · FEEDBACK
        </Eyebrow>
        <h1
          className="font-display text-3xl tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Feedback inbox
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Product feedback and bug reports from customer testing.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md">
          <Eyebrow className="mb-2">NEW</Eyebrow>
          <div
            className="text-3xl font-medium tabular-nums"
            style={{
              color: "var(--text-primary)",
              fontFamily: "var(--font-jetbrains-mono)",
            }}
          >
            {kpis.newCount}
          </div>
        </Card>
        <Card padding="md">
          <Eyebrow className="mb-2">IN PROGRESS</Eyebrow>
          <div
            className="text-3xl font-medium tabular-nums"
            style={{
              color: "var(--text-primary)",
              fontFamily: "var(--font-jetbrains-mono)",
            }}
          >
            {kpis.inProgress}
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
          <Eyebrow className="mb-2">AVG RESPONSE · 7D</Eyebrow>
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
        <form className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div className="md:col-span-2">
            <Eyebrow className="mb-1.5 block">SEARCH</Eyebrow>
            <input
              type="text"
              name="q"
              defaultValue={params.q}
              placeholder="Search note text…"
              className="w-full h-9 px-3 text-sm border"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                borderColor: "var(--border-default)",
              }}
            />
          </div>
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
            name="category"
            label="CATEGORY"
            value={params.category}
            options={[
              { value: "", label: "Any" },
              ...CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) })),
            ]}
          />
          <FilterSelect
            name="severity"
            label="SEVERITY"
            value={params.severity}
            options={[
              { value: "", label: "Any" },
              ...SEVERITIES.map((s) => ({ value: s, label: s.toUpperCase() })),
            ]}
          />
          <FilterSelect
            name="status"
            label="STATUS"
            value={params.status}
            options={[
              { value: "open", label: "Open (not resolved)" },
              { value: "new", label: "New" },
              { value: "reviewing", label: "Reviewing" },
              { value: "in_progress", label: "In progress" },
              { value: "resolved", label: "Resolved" },
              { value: "wont_fix", label: "Won't fix" },
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
          <div className="md:col-span-6 flex gap-2">
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
              href="/admin/platform/feedback"
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
              <Th label="Date" />
              <Th label="Org" />
              <Th label="User" />
              <Th label="Category" />
              <Th label="Severity" />
              <Th label="Note" />
              <Th label="Status" />
              <Th label="" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const user = userLookups.get(r.user_id);
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
                    {formatDateTime(r.created_at)}
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
                  <td className="px-4 py-3">
                    <Badge>{categoryLabel(r.category)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={severityVariant(r.severity)}>
                      {r.severity.toUpperCase()}
                    </Badge>
                  </td>
                  <td
                    className="px-4 py-3 text-sm max-w-[320px]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {truncate(r.note, 120)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(r.status)}>
                      {r.status.replace("_", " ").toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/platform/feedback/${r.id}`}
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
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  No feedback matches these filters.
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
