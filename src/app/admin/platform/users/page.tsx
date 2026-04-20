import { createServerClient } from "@/lib/supabase/server";
import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

type UserRow = {
  user_id: string;
  email: string | null;
  full_name: string;
  role: string;
  created_at: string;
  orgs: Array<{ id: string; name: string; role: string }>;
};

async function fetchUsers(q: string | undefined): Promise<UserRow[]> {
  const supabase = createServerClient();

  let profilesQuery = supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at, org_id");
  if (q) {
    profilesQuery = profilesQuery.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  }
  const { data: profiles } = await profilesQuery;
  const rows = (profiles ?? []) as Array<{
    id: string;
    email: string | null;
    full_name: string;
    role: string;
    created_at: string;
    org_id: string | null;
  }>;
  if (rows.length === 0) return [];

  const userIds = rows.map((r) => r.id);
  const [memberships, orgsRes] = await Promise.all([
    supabase
      .from("org_members")
      .select("user_id, org_id, role")
      .in("user_id", userIds),
    supabase.from("organizations").select("id, name"),
  ]);

  const orgNameById = new Map(
    ((orgsRes.data ?? []) as Array<{ id: string; name: string }>).map((o) => [
      o.id,
      o.name,
    ])
  );

  const orgsByUser: Record<string, UserRow["orgs"]> = {};
  for (const m of (memberships.data ?? []) as Array<{
    user_id: string;
    org_id: string;
    role: string;
  }>) {
    if (!orgsByUser[m.user_id]) orgsByUser[m.user_id] = [];
    orgsByUser[m.user_id].push({
      id: m.org_id,
      name: orgNameById.get(m.org_id) ?? "(unknown)",
      role: m.role,
    });
  }

  return rows.map((r) => ({
    user_id: r.id,
    email: r.email,
    full_name: r.full_name,
    role: r.role,
    created_at: r.created_at,
    orgs: orgsByUser[r.id] ?? [],
  }));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function UsersListPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q?.trim();
  const rows = await fetchUsers(q);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Eyebrow tone="muted" className="mb-2">
            USERS
          </Eyebrow>
          <h1
            className="font-display text-3xl tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            All users
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            {rows.length} {rows.length === 1 ? "user" : "users"}
            {q ? ` matching “${q}”` : ""}
          </p>
        </div>

        <form className="flex gap-2 items-center">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by email or name…"
            className="h-9 px-3 text-sm border"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              borderColor: "var(--border-default)",
            }}
          />
          <button
            type="submit"
            className="h-9 px-3 text-sm border"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
            }}
          >
            Search
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
              <Th label="Email" />
              <Th label="Name" />
              <Th label="Organizations" />
              <Th label="Profile role" />
              <Th label="Created" />
              <Th label="" />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr
                key={u.user_id}
                className="border-b"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <td
                  className="px-4 py-3"
                  style={{ color: "var(--text-primary)" }}
                >
                  <Link
                    href={`/admin/platform/users/${u.user_id}`}
                    className="underline underline-offset-2"
                  >
                    {u.email ?? "—"}
                  </Link>
                </td>
                <td
                  className="px-4 py-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {u.full_name}
                </td>
                <td className="px-4 py-3">
                  {u.orgs.length === 0 ? (
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      — no orgs —
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {u.orgs.map((o) => (
                        <span
                          key={o.id}
                          className="text-xs px-2 py-0.5 border"
                          style={{
                            borderColor: "var(--border-default)",
                            color: "var(--text-secondary)",
                          }}
                          title={o.role}
                        >
                          {o.name}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="neutral">{u.role}</Badge>
                </td>
                <td
                  className="px-4 py-3 text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {formatDate(u.created_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/platform/users/${u.user_id}`}
                    className="text-xs underline"
                    style={{ color: "var(--nw-stone-blue)" }}
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  No users match.
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
