import { createServerClient } from "@/lib/supabase/server";
import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";
import Link from "next/link";
import ImpersonateButton from "@/components/admin/impersonate-button";
import OrgActions from "@/components/admin/org-actions";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  subscription_plan: string;
  subscription_status: string;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  storage_used_bytes: number | null;
  ai_calls_this_month: number | null;
  ai_calls_limit: number | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(size >= 100 ? 0 : 1)} ${units[i]}`;
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

export default async function OrganizationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "id, name, slug, logo_url, subscription_plan, subscription_status, trial_ends_at, stripe_customer_id, stripe_subscription_id, created_at, storage_used_bytes, ai_calls_this_month, ai_calls_limit"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!org) notFound();

  const o = org as OrgRow;

  const [members, jobs, invoices30d, draws, activity] = await Promise.all([
    supabase
      .from("org_members")
      .select("user_id, role, is_active")
      .eq("org_id", o.id),
    supabase
      .from("jobs")
      .select("id, status")
      .eq("org_id", o.id)
      .is("deleted_at", null),
    supabase
      .from("invoices")
      .select("id, status")
      .eq("org_id", o.id)
      .gte(
        "created_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      ),
    supabase.from("draws").select("id").eq("org_id", o.id),
    supabase
      .from("activity_log")
      .select("id, action, entity_type, entity_id, details, created_at, user_id")
      .eq("org_id", o.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const memberRows = (members.data ?? []) as Array<{
    user_id: string;
    role: string;
    is_active: boolean;
  }>;

  // Resolve user emails for members table.
  const memberUserIds = memberRows.map((m) => m.user_id);
  const { data: profiles } = memberUserIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", memberUserIds)
    : { data: [] };
  const profileById = new Map(
    ((profiles ?? []) as Array<{ id: string; email: string | null; full_name: string }>).map(
      (p) => [p.id, p]
    )
  );

  const activeJobs = (jobs.data ?? []).filter(
    (j: { status: string }) => j.status === "active"
  ).length;
  const totalJobs = (jobs.data ?? []).length;

  const invoicesByStatus = ((invoices30d.data ?? []) as Array<{ status: string }>).reduce<
    Record<string, number>
  >((acc, inv) => {
    acc[inv.status] = (acc[inv.status] ?? 0) + 1;
    return acc;
  }, {});

  const trialDaysLeft =
    o.subscription_status === "trialing" && o.trial_ends_at
      ? Math.ceil(
          (new Date(o.trial_ends_at).getTime() - Date.now()) /
            (24 * 60 * 60 * 1000)
        )
      : null;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/platform/organizations"
          className="text-xs underline mb-3 inline-block"
          style={{ color: "var(--text-secondary)" }}
        >
          ← All organizations
        </Link>
        <div className="flex items-center gap-4 mt-2">
          {o.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={o.logo_url}
              alt=""
              className="w-12 h-12 rounded-sm object-cover"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-sm text-lg flex items-center justify-center font-medium"
              style={{
                background: "var(--bg-subtle)",
                color: "var(--text-tertiary)",
              }}
            >
              {o.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1
              className="font-display text-3xl tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {o.name}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-xs">
              <span style={{ color: "var(--text-tertiary)" }}>/{o.slug}</span>
              <Badge variant={statusVariant(o.subscription_status)}>
                {o.subscription_status}
              </Badge>
              <span
                className="capitalize"
                style={{ color: "var(--text-secondary)" }}
              >
                {o.subscription_plan.replace(/_/g, " ")}
              </span>
            </div>
          </div>
          <div className="ml-auto">
            <ImpersonateButton orgId={o.id} orgName={o.name} size="md" />
          </div>
        </div>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md">
          <Eyebrow className="mb-2">MEMBERS</Eyebrow>
          <div
            className="text-2xl font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {memberRows.filter((m) => m.is_active).length}
          </div>
          <div
            className="text-xs mt-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            {memberRows.length - memberRows.filter((m) => m.is_active).length}{" "}
            inactive
          </div>
        </Card>
        <Card padding="md">
          <Eyebrow className="mb-2">JOBS</Eyebrow>
          <div
            className="text-2xl font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {activeJobs}
          </div>
          <div
            className="text-xs mt-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            {totalJobs - activeJobs} other
          </div>
        </Card>
        <Card padding="md">
          <Eyebrow className="mb-2">INVOICES · 30d</Eyebrow>
          <div
            className="text-2xl font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {(invoices30d.data ?? []).length}
          </div>
          <div
            className="text-xs mt-1 space-x-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            <span>paid {invoicesByStatus["paid"] ?? 0}</span>
            <span>
              failed{" "}
              {(invoicesByStatus["qb_failed"] ?? 0) +
                (invoicesByStatus["pm_denied"] ?? 0)}
            </span>
          </div>
        </Card>
        <Card padding="md">
          <Eyebrow className="mb-2">DRAWS</Eyebrow>
          <div
            className="text-2xl font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {(draws.data ?? []).length}
          </div>
        </Card>
      </div>

      {/* Billing + usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card padding="md">
          <Eyebrow className="mb-3">BILLING</Eyebrow>
          <dl
            className="text-sm space-y-1.5"
            style={{ color: "var(--text-secondary)" }}
          >
            <Row label="Status">
              <Badge variant={statusVariant(o.subscription_status)}>
                {o.subscription_status}
              </Badge>
            </Row>
            <Row label="Plan">
              <span
                className="capitalize"
                style={{ color: "var(--text-primary)" }}
              >
                {o.subscription_plan.replace(/_/g, " ")}
              </span>
            </Row>
            {trialDaysLeft !== null ? (
              <Row label="Trial ends">
                <span style={{ color: "var(--text-primary)" }}>
                  {formatDate(o.trial_ends_at)}
                </span>{" "}
                <span style={{ color: "var(--text-tertiary)" }}>
                  ({trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"} left)
                </span>
              </Row>
            ) : null}
            <Row label="Stripe customer">
              <code
                className="text-xs"
                style={{ color: "var(--text-tertiary)" }}
              >
                {o.stripe_customer_id ?? "—"}
              </code>
            </Row>
            <Row label="Subscription id">
              <code
                className="text-xs"
                style={{ color: "var(--text-tertiary)" }}
              >
                {o.stripe_subscription_id ?? "—"}
              </code>
            </Row>
            <Row label="Created">
              <span style={{ color: "var(--text-primary)" }}>
                {formatDate(o.created_at)}
              </span>
            </Row>
          </dl>
        </Card>

        <Card padding="md">
          <Eyebrow className="mb-3">USAGE</Eyebrow>
          <dl
            className="text-sm space-y-1.5"
            style={{ color: "var(--text-secondary)" }}
          >
            <Row label="Storage used">
              <span style={{ color: "var(--text-primary)" }}>
                {formatBytes(o.storage_used_bytes)}
              </span>
            </Row>
            <Row label="AI calls / month">
              <span style={{ color: "var(--text-primary)" }}>
                {o.ai_calls_this_month ?? 0} / {o.ai_calls_limit ?? "∞"}
              </span>
            </Row>
          </dl>
        </Card>
      </div>

      {/* Members */}
      <div>
        <Eyebrow className="mb-3">MEMBERS</Eyebrow>
        <Card padding="none">
          <table className="w-full text-sm">
            <thead
              className="border-b"
              style={{ borderColor: "var(--border-default)" }}
            >
              <tr>
                <Th label="Email" />
                <Th label="Name" />
                <Th label="Role" />
                <Th label="Active" />
                <Th label="" />
              </tr>
            </thead>
            <tbody>
              {memberRows.map((m) => {
                const profile = profileById.get(m.user_id);
                return (
                  <tr
                    key={m.user_id}
                    className="border-b"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    <td
                      className="px-4 py-3"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {profile?.email ?? "—"}
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {profile?.full_name ?? "—"}
                    </td>
                    <td
                      className="px-4 py-3 capitalize"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {m.role}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={m.is_active ? "success" : "neutral"}>
                        {m.is_active ? "active" : "inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/platform/users/${m.user_id}`}
                        className="text-xs underline"
                        style={{ color: "var(--nw-stone-blue)" }}
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {memberRows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    No members.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Activity */}
      <div>
        <Eyebrow className="mb-3">RECENT ACTIVITY</Eyebrow>
        <Card padding="none">
          <table className="w-full text-sm">
            <thead
              className="border-b"
              style={{ borderColor: "var(--border-default)" }}
            >
              <tr>
                <Th label="When" />
                <Th label="Action" />
                <Th label="Entity" />
              </tr>
            </thead>
            <tbody>
              {(activity.data ?? []).map(
                (a: {
                  id: string;
                  action: string;
                  entity_type: string;
                  entity_id: string | null;
                  created_at: string;
                }) => (
                  <tr
                    key={a.id}
                    className="border-b"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    <td
                      className="px-4 py-3 text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {formatDate(a.created_at)}
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {a.action}
                    </td>
                    <td
                      className="px-4 py-3 text-xs"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {a.entity_type} {a.entity_id?.slice(0, 8) ?? ""}
                    </td>
                  </tr>
                )
              )}
              {(!activity.data || activity.data.length === 0) && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-6 text-center text-sm"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    No activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Admin actions */}
      <div>
        <Eyebrow tone="warn" className="mb-3">
          ADMIN ACTIONS
        </Eyebrow>
        <Card padding="md">
          <p
            className="text-xs mb-4"
            style={{ color: "var(--text-tertiary)" }}
          >
            Every action opens a reason prompt and writes to{" "}
            <code>platform_admin_audit</code>.
          </p>
          <OrgActions orgId={o.id} orgName={o.name} />
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <dt
        className="text-[10px] uppercase tracking-[0.14em] font-medium w-36 shrink-0"
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          color: "var(--text-tertiary)",
        }}
      >
        {label}
      </dt>
      <dd className="flex-1">{children}</dd>
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
