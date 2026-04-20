import { createServerClient } from "@/lib/supabase/server";
import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Badge from "@/components/nw/Badge";
import Link from "next/link";
import { notFound } from "next/navigation";
import SupportAdminActions from "@/components/admin/support-admin-actions";

export const dynamic = "force-dynamic";

type Conversation = {
  id: string;
  user_id: string;
  org_id: string;
  title: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  escalated_at: string | null;
  escalation_reason: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  admin_notes: string | null;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls:
    | Array<{ name: string; input: Record<string, unknown>; output: string }>
    | null;
  tokens_input: number | null;
  tokens_output: number | null;
  created_at: string;
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

function statusVariant(
  status: string
): "neutral" | "info" | "accent" | "success" | "warning" | "danger" {
  if (status === "active") return "info";
  if (status === "escalated") return "warning";
  if (status === "resolved") return "success";
  return "neutral";
}

export default async function SupportDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();

  const { data: conv } = await supabase
    .from("support_conversations")
    .select(
      "id, user_id, org_id, title, status, created_at, updated_at, escalated_at, escalation_reason, resolved_at, resolved_by, admin_notes"
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!conv) notFound();
  const c = conv as Conversation;

  const userIds = [c.user_id];
  if (c.resolved_by) userIds.push(c.resolved_by);

  const [orgRes, profileRes, messagesRes] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", c.org_id).maybeSingle(),
    supabase.from("profiles").select("id, email, full_name").in("id", userIds),
    supabase
      .from("support_messages")
      .select(
        "id, role, content, tool_calls, tokens_input, tokens_output, created_at"
      )
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: true }),
  ]);

  const org = orgRes.data as { name: string } | null;
  const profiles = (profileRes.data ?? []) as Array<{
    id: string;
    email: string | null;
    full_name: string | null;
  }>;
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const submitter = profileById.get(c.user_id);
  const resolver = c.resolved_by ? profileById.get(c.resolved_by) : null;

  const messages = (messagesRes.data ?? []) as Message[];

  const totalInput = messages.reduce(
    (sum, m) => sum + (m.tokens_input ?? 0),
    0
  );
  const totalOutput = messages.reduce(
    (sum, m) => sum + (m.tokens_output ?? 0),
    0
  );
  const toolCallsCount = messages.reduce(
    (sum, m) => sum + (m.tool_calls?.length ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/platform/support"
          className="text-xs"
          style={{ color: "var(--nw-stone-blue)" }}
        >
          ← Back to support inbox
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <Eyebrow tone="muted" className="mb-2">
              STAFF · SUPPORT · DETAIL
            </Eyebrow>
            <h1
              className="font-display text-2xl tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {c.title ?? "Support conversation"}
            </h1>
          </div>
          <Badge variant={statusVariant(c.status)}>
            {c.status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Meta */}
      <Card padding="md">
        <Eyebrow className="mb-3">CONVERSATION META</Eyebrow>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="STARTED" value={formatDateTime(c.created_at)} />
          <Field
            label="USER"
            value={submitter?.email ?? submitter?.full_name ?? c.user_id}
          />
          <Field label="ORG" value={org?.name ?? "—"} />
          <Field label="LAST ACTIVITY" value={formatDateTime(c.updated_at)} />
          <Field
            label="TOKENS"
            value={
              <span
                className="tabular-nums"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                in {totalInput.toLocaleString()} · out {totalOutput.toLocaleString()}
              </span>
            }
          />
          <Field
            label="TOOL CALLS"
            value={
              <span
                className="tabular-nums"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                {toolCallsCount}
              </span>
            }
          />
        </div>
        {c.status === "escalated" && (
          <div
            className="mt-4 p-3 text-xs border flex items-start gap-2"
            style={{
              borderColor: "rgba(201,138,59,0.4)",
              background: "rgba(201,138,59,0.06)",
              color: "var(--nw-warn)",
            }}
          >
            <span
              className="inline-block text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5 border shrink-0"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                borderColor: "var(--nw-warn)",
              }}
            >
              ESCALATED
            </span>
            <span className="flex-1">
              {formatDateTime(c.escalated_at)}:{" "}
              {c.escalation_reason ?? "No reason captured."}
            </span>
          </div>
        )}
        {c.status === "resolved" && (
          <p
            className="mt-3 text-xs"
            style={{ color: "var(--text-tertiary)" }}
          >
            Resolved {formatDateTime(c.resolved_at)}
            {resolver ? ` by ${resolver.email ?? resolver.full_name}` : ""}.
          </p>
        )}
      </Card>

      {/* Messages */}
      <Card padding="md">
        <Eyebrow className="mb-3">CONVERSATION</Eyebrow>
        <div className="space-y-4">
          {messages.length === 0 ? (
            <p
              className="text-xs"
              style={{ color: "var(--text-tertiary)" }}
            >
              No messages.
            </p>
          ) : (
            messages.map((m) => <MessageRow key={m.id} message={m} />)
          )}
        </div>
      </Card>

      {/* Admin actions */}
      <Card padding="md">
        <Eyebrow className="mb-3">ADMIN ACTIONS</Eyebrow>
        <SupportAdminActions
          conversationId={c.id}
          initialStatus={c.status}
          initialAdminNotes={c.admin_notes ?? ""}
        />
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <Eyebrow className="mb-1 block">{label}</Eyebrow>
      <div className="text-sm" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function MessageRow({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className="flex gap-3">
      <span
        className="shrink-0 text-[10px] uppercase tracking-[0.14em] w-[80px] pt-1"
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          color: isUser ? "var(--text-primary)" : "var(--nw-stone-blue)",
        }}
      >
        {isUser ? "USER" : "ASSISTANT"}
      </span>
      <div className="flex-1 min-w-0">
        <div
          className="text-sm whitespace-pre-wrap leading-relaxed"
          style={{ color: "var(--text-primary)" }}
        >
          {message.content}
        </div>
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div
            className="mt-2 space-y-1.5"
            style={{ color: "var(--text-secondary)" }}
          >
            {message.tool_calls.map((tc, i) => (
              <div
                key={`${message.id}-${i}`}
                className="text-[11px] p-2 border"
                style={{
                  borderColor: "var(--border-subtle)",
                  background: "var(--bg-subtle)",
                }}
              >
                <div
                  className="font-medium mb-1 tracking-[0.06em] uppercase text-[10px]"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  TOOL: {tc.name}
                </div>
                {Object.keys(tc.input).length > 0 && (
                  <div
                    className="mb-1 break-words"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  >
                    input: {JSON.stringify(tc.input)}
                  </div>
                )}
                <div
                  className="break-words"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  output: {tc.output.length > 300 ? tc.output.slice(0, 300) + "…" : tc.output}
                </div>
              </div>
            ))}
          </div>
        )}
        <div
          className="mt-1 text-[10px] tabular-nums"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            color: "var(--text-tertiary)",
          }}
        >
          {formatDateTime(message.created_at)}
          {message.tokens_input != null && message.tokens_output != null && (
            <>
              {" · "}
              tokens in {message.tokens_input} / out {message.tokens_output}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
