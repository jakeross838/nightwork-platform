import { createServerClient } from "@/lib/supabase/server";
import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";
import Link from "next/link";
import AuditRow from "@/components/admin/audit-row";

export const dynamic = "force-dynamic";

type AuditRowData = {
  id: string;
  admin_user_id: string;
  admin_email: string | null;
  action: string;
  target_org_id: string | null;
  target_org_name: string | null;
  target_user_id: string | null;
  target_user_email: string | null;
  target_record_type: string | null;
  target_record_id: string | null;
  details: unknown;
  reason: string | null;
  created_at: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function actionVariant(
  action: string
): "success" | "warning" | "danger" | "info" | "neutral" | "accent" {
  if (action.startsWith("impersonate")) return "accent";
  if (action.includes("unlock") || action.includes("extend")) return "success";
  if (action.includes("lock") || action.includes("reset")) return "info";
  if (
    action.includes("remove") ||
    action.includes("churn") ||
    action.includes("delete")
  )
    return "danger";
  return "neutral";
}

async function fetchAudit(searchParams: {
  admin?: string;
  action?: string;
  org?: string;
  since?: string;
}): Promise<AuditRowData[]> {
  const supabase = createServerClient();

  let q = supabase
    .from("platform_admin_audit")
    .select(
      "id, admin_user_id, action, target_org_id, target_user_id, target_record_type, target_record_id, details, reason, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (searchParams.admin) q = q.eq("admin_user_id", searchParams.admin);
  if (searchParams.action) q = q.eq("action", searchParams.action);
  if (searchParams.org) q = q.eq("target_org_id", searchParams.org);
  if (searchParams.since) q = q.gte("created_at", searchParams.since);

  const { data } = await q;
  const rows = (data ?? []) as Array<{
    id: string;
    admin_user_id: string;
    action: string;
    target_org_id: string | null;
    target_user_id: string | null;
    target_record_type: string | null;
    target_record_id: string | null;
    details: unknown;
    reason: string | null;
    created_at: string;
  }>;
  if (rows.length === 0) return [];

  const adminIds = Array.from(new Set(rows.map((r) => r.admin_user_id)));
  const orgIds = Array.from(
    new Set(rows.map((r) => r.target_org_id).filter(Boolean))
  ) as string[];
  const userIds = Array.from(
    new Set(rows.map((r) => r.target_user_id).filter(Boolean))
  ) as string[];
  const profileIds = Array.from(new Set([...adminIds, ...userIds]));

  const [profiles, orgs] = await Promise.all([
    profileIds.length
      ? supabase
          .from("profiles")
          .select("id, email")
          .in("id", profileIds)
      : Promise.resolve({ data: [] }),
    orgIds.length
      ? supabase
          .from("organizations")
          .select("id, name")
          .in("id", orgIds)
      : Promise.resolve({ data: [] }),
  ]);

  const emailById = new Map(
    ((profiles.data ?? []) as Array<{ id: string; email: string | null }>).map(
      (p) => [p.id, p.email ?? null]
    )
  );
  const orgNameById = new Map(
    ((orgs.data ?? []) as Array<{ id: string; name: string }>).map((o) => [
      o.id,
      o.name,
    ])
  );

  return rows.map((r) => ({
    ...r,
    admin_email: emailById.get(r.admin_user_id) ?? null,
    target_org_name: r.target_org_id
      ? orgNameById.get(r.target_org_id) ?? null
      : null,
    target_user_email: r.target_user_id
      ? emailById.get(r.target_user_id) ?? null
      : null,
  }));
}

async function fetchFilterOptions() {
  const supabase = createServerClient();
  const [admins, actions] = await Promise.all([
    supabase.from("platform_admins").select("user_id"),
    supabase.from("platform_admin_audit").select("action"),
  ]);
  const adminIds = ((admins.data ?? []) as Array<{ user_id: string }>).map(
    (a) => a.user_id
  );
  const { data: profiles } = adminIds.length
    ? await supabase
        .from("profiles")
        .select("id, email")
        .in("id", adminIds)
    : { data: [] };
  const actionSet = new Set(
    ((actions.data ?? []) as Array<{ action: string }>).map((a) => a.action)
  );
  return {
    admins: ((profiles ?? []) as Array<{ id: string; email: string | null }>)
      .map((p) => ({ id: p.id, email: p.email }))
      .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? "")),
    actions: Array.from(actionSet).sort(),
  };
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { admin?: string; action?: string; org?: string; since?: string };
}) {
  const [rows, options] = await Promise.all([
    fetchAudit(searchParams),
    fetchFilterOptions(),
  ]);

  // Build a ?format=csv download URL that keeps current filters.
  const csvParams = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v) csvParams.set(k, v);
  }
  csvParams.set("format", "csv");
  const csvHref = `/api/admin/platform/audit/export?${csvParams.toString()}`;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Eyebrow tone="muted" className="mb-2">
            AUDIT LOG
          </Eyebrow>
          <h1
            className="font-display text-3xl tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Platform admin activity
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Append-only record of every staff action. Showing latest{" "}
            {rows.length}.
          </p>
        </div>
        <Link
          href={csvHref}
          className="text-xs px-3 py-1.5 border"
          style={{
            borderColor: "var(--border-default)",
            color: "var(--text-primary)",
          }}
        >
          Export CSV
        </Link>
      </div>

      {/* Filters */}
      <Card padding="md">
        <form className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                color: "var(--text-tertiary)",
              }}
            >
              Admin
            </label>
            <select
              name="admin"
              defaultValue={searchParams.admin ?? ""}
              className="h-9 px-2 text-sm border min-w-[200px]"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                borderColor: "var(--border-default)",
              }}
            >
              <option value="">All</option>
              {options.admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email ?? a.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                color: "var(--text-tertiary)",
              }}
            >
              Action
            </label>
            <select
              name="action"
              defaultValue={searchParams.action ?? ""}
              className="h-9 px-2 text-sm border min-w-[200px]"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                borderColor: "var(--border-default)",
              }}
            >
              <option value="">All</option>
              {options.actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                color: "var(--text-tertiary)",
              }}
            >
              Since
            </label>
            <input
              type="date"
              name="since"
              defaultValue={searchParams.since ?? ""}
              className="h-9 px-2 text-sm border"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                borderColor: "var(--border-default)",
              }}
            />
          </div>
          <button
            type="submit"
            className="h-9 px-3 text-sm border"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
            }}
          >
            Apply
          </button>
          <Link
            href="/admin/platform/audit"
            className="h-9 px-3 text-sm border inline-flex items-center"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
            }}
          >
            Clear
          </Link>
        </form>
      </Card>

      <Card padding="none">
        <table className="w-full text-sm">
          <thead
            className="border-b"
            style={{ borderColor: "var(--border-default)" }}
          >
            <tr>
              <Th label="When" />
              <Th label="Admin" />
              <Th label="Action" />
              <Th label="Target" />
              <Th label="Reason" />
              <Th label="" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <AuditRow
                key={r.id}
                row={{
                  id: r.id,
                  when: formatDate(r.created_at),
                  admin: r.admin_email ?? r.admin_user_id.slice(0, 8),
                  action: r.action,
                  actionVariant: actionVariant(r.action),
                  target_org_id: r.target_org_id,
                  target_org_name: r.target_org_name,
                  target_user_id: r.target_user_id,
                  target_user_email: r.target_user_email,
                  target_record_type: r.target_record_type,
                  target_record_id: r.target_record_id,
                  details: r.details,
                  reason: r.reason,
                }}
              />
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  No audit entries match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <p
        className="text-xs"
        style={{ color: "var(--text-tertiary)" }}
      >
        Audit rows are append-only. No UI path exists to edit or delete them —
        that is by design. <Badge variant="accent">IMMUTABLE</Badge>
      </p>
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
