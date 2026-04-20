import { createServerClient } from "@/lib/supabase/server";
import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

type OrgSummary = {
  id: string;
  name: string;
  slug: string;
  subscription_status: string;
  created_at: string;
};

async function fetchOverview() {
  const supabase = createServerClient();

  const [orgs, members, invoices30d] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug, subscription_status, created_at"),
    supabase.from("org_members").select("role, is_active"),
    supabase
      .from("invoices")
      .select("status, created_at")
      .gte(
        "created_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      ),
  ]);

  return {
    orgs: (orgs.data ?? []) as OrgSummary[],
    members: (members.data ?? []) as Array<{ role: string; is_active: boolean }>,
    invoices: (invoices30d.data ?? []) as Array<{
      status: string;
      created_at: string;
    }>,
  };
}

function bucketOrgs(orgs: OrgSummary[]) {
  const total = orgs.length;
  const byStatus = orgs.reduce<Record<string, number>>((acc, o) => {
    acc[o.subscription_status] = (acc[o.subscription_status] ?? 0) + 1;
    return acc;
  }, {});
  return {
    total,
    active: byStatus["active"] ?? 0,
    trial: byStatus["trialing"] ?? 0,
    pastDue: byStatus["past_due"] ?? 0,
    churned: byStatus["cancelled"] ?? 0,
  };
}

function bucketMembers(rows: Array<{ role: string; is_active: boolean }>) {
  const active = rows.filter((r) => r.is_active);
  const byRole = active.reduce<Record<string, number>>((acc, r) => {
    acc[r.role] = (acc[r.role] ?? 0) + 1;
    return acc;
  }, {});
  return {
    total: active.length,
    owner: byRole["owner"] ?? 0,
    admin: byRole["admin"] ?? 0,
    pm: byRole["pm"] ?? 0,
    accounting: byRole["accounting"] ?? 0,
  };
}

function bucketInvoices(rows: Array<{ status: string }>) {
  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  return {
    total: rows.length,
    received: byStatus["received"] ?? 0,
    aiProcessed: byStatus["ai_processed"] ?? 0,
    pmReview: byStatus["pm_review"] ?? 0,
    qaReview: byStatus["qa_review"] ?? 0,
    paid: byStatus["paid"] ?? 0,
    failed: (byStatus["qb_failed"] ?? 0) + (byStatus["pm_denied"] ?? 0),
  };
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

export default async function PlatformOverviewPage() {
  const { orgs, members, invoices } = await fetchOverview();
  const orgStats = bucketOrgs(orgs);
  const memberStats = bucketMembers(members);
  const invoiceStats = bucketInvoices(invoices);

  const recentOrgs = [...orgs]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10);

  return (
    <div className="space-y-8">
      <div>
        <Eyebrow tone="muted" className="mb-2">
          PLATFORM OVERVIEW
        </Eyebrow>
        <h1
          className="font-display text-3xl tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Nightwork at a glance
        </h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md">
          <Eyebrow className="mb-2">ORGANIZATIONS</Eyebrow>
          <div
            className="text-3xl font-medium mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            {orgStats.total}
          </div>
          <div className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
            <div>
              <Badge variant="success" className="mr-2">
                ACTIVE
              </Badge>
              {orgStats.active}
            </div>
            <div>
              <Badge variant="info" className="mr-2">
                TRIAL
              </Badge>
              {orgStats.trial}
            </div>
            <div>
              <Badge variant="danger" className="mr-2">
                CHURNED
              </Badge>
              {orgStats.churned}
            </div>
          </div>
        </Card>

        <Card padding="md">
          <Eyebrow className="mb-2">USERS</Eyebrow>
          <div
            className="text-3xl font-medium mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            {memberStats.total}
          </div>
          <div className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
            <div>Owner {memberStats.owner}</div>
            <div>Admin {memberStats.admin}</div>
            <div>PM {memberStats.pm}</div>
            <div>Accounting {memberStats.accounting}</div>
          </div>
        </Card>

        <Card padding="md">
          <Eyebrow className="mb-2">MRR</Eyebrow>
          <div
            className="text-3xl font-medium mb-3"
            style={{ color: "var(--text-tertiary)" }}
          >
            —
          </div>
          <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            Stripe billing not wired for cross-tenant rollup yet.
          </div>
        </Card>

        <Card padding="md">
          <Eyebrow className="mb-2">INVOICES · LAST 30d</Eyebrow>
          <div
            className="text-3xl font-medium mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            {invoiceStats.total}
          </div>
          <div className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
            <div>In progress {invoiceStats.pmReview + invoiceStats.qaReview}</div>
            <div>Paid {invoiceStats.paid}</div>
            <div>
              <Badge variant="danger" className="mr-2">
                FAILED
              </Badge>
              {invoiceStats.failed}
            </div>
          </div>
        </Card>
      </div>

      {/* Errors placeholder */}
      <Card padding="md">
        <div className="flex items-center justify-between">
          <div>
            <Eyebrow tone="warn" className="mb-1">
              ERRORS · LAST 24h
            </Eyebrow>
            <div
              className="text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              Wired through Sentry once DSN is set — check Sentry dashboard
              for live errors.
            </div>
          </div>
          <div
            className="text-2xl font-medium"
            style={{ color: "var(--text-tertiary)" }}
          >
            —
          </div>
        </div>
      </Card>

      {/* Recent signups */}
      <div>
        <Eyebrow className="mb-3">RECENT SIGNUPS</Eyebrow>
        <Card padding="none">
          <table className="w-full text-sm">
            <thead
              className="border-b"
              style={{ borderColor: "var(--border-default)" }}
            >
              <tr>
                <th
                  className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Name
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Status
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Created
                </th>
                <th
                  className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {recentOrgs.map((o) => (
                <tr
                  key={o.id}
                  className="border-b"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <td
                    className="px-4 py-3"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {o.name}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(o.subscription_status)}>
                      {o.subscription_status}
                    </Badge>
                  </td>
                  <td
                    className="px-4 py-3 text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {formatDate(o.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/platform/organizations/${o.id}`}
                      className="text-xs underline"
                      style={{ color: "var(--nw-stone-blue)" }}
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
              {recentOrgs.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    No organizations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

    </div>
  );
}
