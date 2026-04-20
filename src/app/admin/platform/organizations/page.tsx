import { createServerClient } from "@/lib/supabase/server";
import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";
import Link from "next/link";
import ImpersonateButton from "@/components/admin/impersonate-button";

export const dynamic = "force-dynamic";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  subscription_plan: string;
  subscription_status: string;
  created_at: string;
  member_count: number;
  active_jobs: number;
  invoices_30d: number;
};

async function fetchOrganizations(
  q: string | undefined,
  status: string | undefined
): Promise<OrgRow[]> {
  const supabase = createServerClient();

  let orgsQuery = supabase
    .from("organizations")
    .select(
      "id, name, slug, logo_url, subscription_plan, subscription_status, created_at"
    );
  if (q) orgsQuery = orgsQuery.ilike("name", `%${q}%`);
  if (status) orgsQuery = orgsQuery.eq("subscription_status", status);

  const { data: orgs } = await orgsQuery;
  const rows = (orgs ?? []) as Array<Omit<OrgRow, "member_count" | "active_jobs" | "invoices_30d">>;
  if (rows.length === 0) return [];

  const ids = rows.map((o) => o.id);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [members, jobs, invoices] = await Promise.all([
    supabase.from("org_members").select("org_id").in("org_id", ids).eq("is_active", true),
    supabase.from("jobs").select("org_id").in("org_id", ids).eq("status", "active"),
    supabase
      .from("invoices")
      .select("org_id")
      .in("org_id", ids)
      .gte("created_at", thirtyDaysAgo),
  ]);

  const memberCounts: Record<string, number> = {};
  for (const m of (members.data ?? []) as Array<{ org_id: string }>) {
    memberCounts[m.org_id] = (memberCounts[m.org_id] ?? 0) + 1;
  }
  const jobCounts: Record<string, number> = {};
  for (const j of (jobs.data ?? []) as Array<{ org_id: string }>) {
    jobCounts[j.org_id] = (jobCounts[j.org_id] ?? 0) + 1;
  }
  const invCounts: Record<string, number> = {};
  for (const inv of (invoices.data ?? []) as Array<{ org_id: string }>) {
    invCounts[inv.org_id] = (invCounts[inv.org_id] ?? 0) + 1;
  }

  return rows.map((o) => ({
    ...o,
    member_count: memberCounts[o.id] ?? 0,
    active_jobs: jobCounts[o.id] ?? 0,
    invoices_30d: invCounts[o.id] ?? 0,
  }));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusVariant(
  status: string
): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "active") return "success";
  if (status === "trialing") return "info";
  if (status === "past_due") return "warning";
  if (status === "cancelled") return "danger";
  return "neutral";
}

export default async function OrganizationsListPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const q = searchParams.q?.trim();
  const status = searchParams.status?.trim();
  const rows = await fetchOrganizations(q, status);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Eyebrow tone="muted" className="mb-2">
            ORGANIZATIONS
          </Eyebrow>
          <h1
            className="font-display text-3xl tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            All tenants
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            {rows.length} {rows.length === 1 ? "organization" : "organizations"}
            {q ? ` matching “${q}”` : ""}
            {status ? ` · ${status}` : ""}
          </p>
        </div>

        <form className="flex gap-2 items-center">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name…"
            className="h-9 px-3 text-sm border"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              borderColor: "var(--border-default)",
            }}
          />
          <select
            name="status"
            defaultValue={status ?? ""}
            className="h-9 px-3 text-sm border"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              borderColor: "var(--border-default)",
            }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="past_due">Past due</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            type="submit"
            className="h-9 px-3 text-sm border"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
            }}
          >
            Filter
          </button>
        </form>
      </div>

      <Card padding="none">
        <table className="w-full text-sm">
          <thead
            className="border-b"
            style={{ borderColor: "var(--border-default)" }}
          >
            <tr>
              <Th label="Name" />
              <Th label="Plan" />
              <Th label="Status" />
              <Th label="Members" align="right" />
              <Th label="Active jobs" align="right" />
              <Th label="Invoices 30d" align="right" />
              <Th label="Created" />
              <Th label="" />
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr
                key={o.id}
                className="border-b"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/platform/organizations/${o.id}`}
                    className="flex items-center gap-2"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {o.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={o.logo_url}
                        alt=""
                        className="w-6 h-6 rounded-sm object-cover"
                      />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-sm text-[10px] flex items-center justify-center font-medium"
                        style={{
                          background: "var(--bg-subtle)",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {o.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium">{o.name}</span>
                  </Link>
                  <div
                    className="text-xs mt-0.5"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    /{o.slug}
                  </div>
                </td>
                <td
                  className="px-4 py-3 text-xs capitalize"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {o.subscription_plan.replace(/_/g, " ")}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(o.subscription_status)}>
                    {o.subscription_status}
                  </Badge>
                </td>
                <td
                  className="px-4 py-3 text-right tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
                  {o.member_count}
                </td>
                <td
                  className="px-4 py-3 text-right tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
                  {o.active_jobs}
                </td>
                <td
                  className="px-4 py-3 text-right tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
                  {o.invoices_30d}
                </td>
                <td
                  className="px-4 py-3 text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {formatDate(o.created_at)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Link
                    href={`/admin/platform/organizations/${o.id}`}
                    className="text-xs underline mr-3"
                    style={{ color: "var(--nw-stone-blue)" }}
                  >
                    View
                  </Link>
                  <ImpersonateButton orgId={o.id} orgName={o.name} size="sm" />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  No organizations match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Th({
  label,
  align = "left",
}: {
  label: string;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${
        align === "right" ? "text-right" : "text-left"
      }`}
      style={{ color: "var(--text-tertiary)" }}
    >
      {label}
    </th>
  );
}
