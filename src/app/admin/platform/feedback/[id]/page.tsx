import { createServerClient } from "@/lib/supabase/server";
import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";
import Link from "next/link";
import { notFound } from "next/navigation";
import FeedbackStatusForm from "@/components/admin/feedback-status-form";

export const dynamic = "force-dynamic";

type FeedbackDetail = {
  id: string;
  created_at: string;
  updated_at: string;
  category: string;
  severity: string;
  status: string;
  note: string;
  page_url: string | null;
  user_id: string;
  org_id: string;
  user_role: string | null;
  browser: string | null;
  os: string | null;
  theme: string | null;
  impersonation_active: boolean | null;
  impersonation_admin_id: string | null;
  admin_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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
  return "neutral";
}

export default async function FeedbackDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();

  const { data: feedback } = await supabase
    .from("feedback_notes")
    .select(
      "id, created_at, updated_at, category, severity, status, note, page_url, user_id, org_id, user_role, browser, os, theme, impersonation_active, impersonation_admin_id, admin_notes, resolved_by, resolved_at"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!feedback) notFound();
  const f = feedback as FeedbackDetail;

  const userIds = [f.user_id];
  if (f.impersonation_admin_id) userIds.push(f.impersonation_admin_id);
  if (f.resolved_by) userIds.push(f.resolved_by);

  const [orgRes, profilesRes, auditRes] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", f.org_id).maybeSingle(),
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds),
    supabase
      .from("platform_admin_audit")
      .select("id, admin_user_id, action, details, reason, created_at")
      .eq("target_record_type", "feedback")
      .eq("target_record_id", f.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const org = orgRes.data as { id: string; name: string } | null;
  const profiles = (profilesRes.data ?? []) as Array<{
    id: string;
    email: string | null;
    full_name: string | null;
  }>;
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const submitter = profileById.get(f.user_id);
  const impersonator = f.impersonation_admin_id
    ? profileById.get(f.impersonation_admin_id)
    : null;
  const resolver = f.resolved_by ? profileById.get(f.resolved_by) : null;

  const auditRows = (auditRes.data ?? []) as Array<{
    id: string;
    admin_user_id: string;
    action: string;
    details: Record<string, unknown> | null;
    reason: string | null;
    created_at: string;
  }>;
  const adminIds = Array.from(new Set(auditRows.map((r) => r.admin_user_id)));
  const auditProfileLookup =
    adminIds.length === 0
      ? new Map()
      : new Map(
          (
            (
              await supabase
                .from("profiles")
                .select("id, email")
                .in("id", adminIds)
            ).data ?? []
          ).map((p: { id: string; email: string | null }) => [p.id, p])
        );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/platform/feedback"
          className="text-xs"
          style={{ color: "var(--nw-stone-blue)" }}
        >
          ← Back to feedback
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <Eyebrow tone="muted" className="mb-2">
              STAFF · FEEDBACK · DETAIL
            </Eyebrow>
            <h1
              className="font-display text-2xl tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {f.category === "bug"
                ? "Bug report"
                : f.category === "confusion"
                  ? "Confusion report"
                  : f.category === "idea"
                    ? "Idea"
                    : "Feedback"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={severityVariant(f.severity)}>
              {f.severity.toUpperCase()}
            </Badge>
            <Badge variant={statusVariant(f.status)}>
              {f.status.replace("_", " ").toUpperCase()}
            </Badge>
          </div>
        </div>
      </div>

      {/* Section 1 — Report */}
      <Card padding="md">
        <Eyebrow className="mb-3">ORIGINAL SUBMISSION</Eyebrow>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <DetailField label="SUBMITTED" value={formatDateTime(f.created_at)} />
          <DetailField
            label="USER"
            value={submitter?.email ?? submitter?.full_name ?? f.user_id}
          />
          <DetailField label="ROLE" value={f.user_role ?? "—"} />
          <DetailField label="ORG" value={org?.name ?? "—"} />
          <DetailField label="CATEGORY" value={f.category.toUpperCase()} />
          <DetailField label="SEVERITY" value={f.severity.toUpperCase()} />
        </div>
        <div
          className="mt-4 p-4 border text-sm whitespace-pre-wrap"
          style={{
            borderColor: "var(--border-default)",
            color: "var(--text-primary)",
            background: "var(--bg-subtle)",
          }}
        >
          {f.note}
        </div>
      </Card>

      {/* Environment context */}
      <Card padding="md">
        <Eyebrow className="mb-3">ENVIRONMENT AT SUBMISSION</Eyebrow>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <DetailField
            label="PAGE"
            value={
              f.page_url ? (
                <span
                  className="font-mono text-xs break-all"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  {f.page_url}
                </span>
              ) : (
                "—"
              )
            }
          />
          <DetailField label="BROWSER" value={f.browser ?? "—"} />
          <DetailField label="OS" value={f.os ?? "—"} />
          <DetailField label="THEME" value={f.theme ?? "—"} />
        </div>
        {f.impersonation_active && (
          <div
            className="mt-4 p-3 text-xs border flex items-center gap-2"
            style={{
              borderColor: "rgba(176,85,78,0.4)",
              background: "rgba(176,85,78,0.06)",
              color: "var(--nw-danger)",
            }}
          >
            <span
              className="inline-block text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5 border"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                borderColor: "var(--nw-danger)",
              }}
            >
              IMPERSONATION
            </span>
            <span>
              Submitted during an impersonation session by{" "}
              {impersonator?.email ?? f.impersonation_admin_id ?? "unknown"}.
              Treat carefully — it may reflect the admin&apos;s perspective,
              not the customer&apos;s.
            </span>
          </div>
        )}
      </Card>

      {/* Section 2 — Admin response */}
      <Card padding="md">
        <Eyebrow className="mb-3">ADMIN RESPONSE</Eyebrow>
        <FeedbackStatusForm
          feedbackId={f.id}
          initialStatus={f.status}
          initialAdminNotes={f.admin_notes ?? ""}
        />
        {f.resolved_at && (
          <p
            className="mt-3 text-xs"
            style={{ color: "var(--text-tertiary)" }}
          >
            Resolved {formatDateTime(f.resolved_at)}
            {resolver ? ` by ${resolver.email ?? resolver.full_name}` : ""}.
          </p>
        )}
      </Card>

      {/* Section 3 — Audit trail */}
      <Card padding="md">
        <Eyebrow className="mb-3">AUDIT TRAIL</Eyebrow>
        {auditRows.length === 0 ? (
          <p
            className="text-xs"
            style={{ color: "var(--text-tertiary)" }}
          >
            No admin actions recorded yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {auditRows.map((row) => {
              const admin = auditProfileLookup.get(row.admin_user_id) as
                | { email: string | null }
                | undefined;
              const details = row.details ?? {};
              const oldStatus = (details as { old_status?: string }).old_status;
              const newStatus = (details as { new_status?: string }).new_status;
              return (
                <li
                  key={row.id}
                  className="flex items-start gap-3 text-xs border-l-2 pl-3 py-1"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  <span
                    className="tabular-nums shrink-0 w-[110px]"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {formatDateTime(row.created_at)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div style={{ color: "var(--text-primary)" }}>
                      <span className="font-medium">
                        {admin?.email ?? row.admin_user_id}
                      </span>{" "}
                      <span style={{ color: "var(--text-secondary)" }}>
                        {row.action === "feedback_update" &&
                        oldStatus &&
                        newStatus
                          ? `changed status ${oldStatus} → ${newStatus}`
                          : row.action}
                      </span>
                    </div>
                    {row.reason && (
                      <div
                        className="mt-0.5"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {row.reason}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <Eyebrow className="mb-1 block">{label}</Eyebrow>
      <div
        className="text-sm"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}
