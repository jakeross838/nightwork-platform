import { createServerClient } from "@/lib/supabase/server";
import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";
import Link from "next/link";
import UserActions from "@/components/admin/user-actions";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

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

export default async function UserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!profile) notFound();

  const [memberships, activity, platformAdmin] = await Promise.all([
    supabase
      .from("org_members")
      .select("org_id, role, is_active")
      .eq("user_id", params.id),
    supabase
      .from("activity_log")
      .select("id, action, entity_type, entity_id, org_id, created_at")
      .eq("user_id", params.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("platform_admins")
      .select("role, notes, created_at")
      .eq("user_id", params.id)
      .maybeSingle(),
  ]);

  const memberRows = (memberships.data ?? []) as Array<{
    org_id: string;
    role: string;
    is_active: boolean;
  }>;

  const orgIds = memberRows.map((m) => m.org_id);
  const { data: orgs } = orgIds.length
    ? await supabase.from("organizations").select("id, name").in("id", orgIds)
    : { data: [] };
  const orgById = new Map(
    ((orgs ?? []) as Array<{ id: string; name: string }>).map((o) => [
      o.id,
      o.name,
    ])
  );

  const p = profile as {
    id: string;
    email: string | null;
    full_name: string;
    role: string;
    created_at: string;
  };
  const pa = platformAdmin.data as {
    role: string;
    notes: string | null;
    created_at: string;
  } | null;

  const canImpersonate = memberRows.some((m) => m.is_active);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/platform/users"
          className="text-xs underline mb-3 inline-block"
          style={{ color: "var(--text-secondary)" }}
        >
          ← All users
        </Link>
        <div className="flex items-center gap-4 mt-2">
          <div
            className="w-12 h-12 rounded-sm flex items-center justify-center font-medium text-lg"
            style={{
              background: "var(--bg-subtle)",
              color: "var(--text-tertiary)",
            }}
          >
            {p.full_name?.slice(0, 1).toUpperCase() ??
              p.email?.slice(0, 1).toUpperCase() ??
              "?"}
          </div>
          <div>
            <h1
              className="font-display text-3xl tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {p.full_name}
            </h1>
            <div
              className="flex items-center gap-3 mt-1 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              <span>{p.email ?? "no email"}</span>
              <Badge variant="neutral">{p.role}</Badge>
              {pa ? <Badge variant="accent">PLATFORM · {pa.role}</Badge> : null}
            </div>
          </div>
        </div>
      </div>

      {/* Memberships */}
      <div>
        <Eyebrow className="mb-3">ORGANIZATIONS</Eyebrow>
        <Card padding="none">
          <table className="w-full text-sm">
            <thead
              className="border-b"
              style={{ borderColor: "var(--border-default)" }}
            >
              <tr>
                <Th label="Org" />
                <Th label="Role" />
                <Th label="Active" />
                <Th label="" />
              </tr>
            </thead>
            <tbody>
              {memberRows.map((m) => (
                <tr
                  key={m.org_id}
                  className="border-b"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/platform/organizations/${m.org_id}`}
                      className="underline underline-offset-2"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {orgById.get(m.org_id) ?? m.org_id}
                    </Link>
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
                      href={`/admin/platform/organizations/${m.org_id}`}
                      className="text-xs underline"
                      style={{ color: "var(--nw-stone-blue)" }}
                    >
                      Org →
                    </Link>
                  </td>
                </tr>
              ))}
              {memberRows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-sm"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    User has no org memberships.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Recent activity */}
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
                <Th label="Org" />
              </tr>
            </thead>
            <tbody>
              {(activity.data ?? []).map(
                (a: {
                  id: string;
                  action: string;
                  entity_type: string;
                  entity_id: string | null;
                  org_id: string;
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
                    <td
                      className="px-4 py-3 text-xs"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {orgById.get(a.org_id) ?? a.org_id.slice(0, 8)}
                    </td>
                  </tr>
                )
              )}
              {(!activity.data || activity.data.length === 0) && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-sm"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    No activity recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Actions */}
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
          <UserActions
            userId={p.id}
            userName={p.full_name || p.email || p.id}
            canImpersonate={canImpersonate}
            orgs={memberRows.map((m) => ({
              id: m.org_id,
              name: orgById.get(m.org_id) ?? m.org_id,
              role: m.role,
            }))}
          />
        </Card>
      </div>
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
