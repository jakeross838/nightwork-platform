"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Eyebrow from "@/components/nw/Eyebrow";
import Button from "@/components/nw/Button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/utils/toast";

type ToolCall = { name: string; input: Record<string, unknown> };
type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  tool_calls?: ToolCall[] | null;
  created_at?: string;
};
type Conversation = {
  id: string;
  status: "active" | "resolved" | "escalated";
  title: string | null;
  created_at: string;
  updated_at: string;
  escalated_at: string | null;
  escalation_reason: string | null;
};

const HIDDEN_PATH_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/pricing/,
  /^\/login/,
  /^\/signup/,
  /^\/forgot/,
  /^\/auth/,
  /^\/admin\/platform/,
];

const MAX_MESSAGE_LEN = 4000;

const TOOL_LABELS: Record<string, string> = {
  get_user_context: "Checked your account context",
  get_invoice: "Looked up invoice",
  get_job: "Looked up job",
  search_recent_activity: "Searched your recent activity",
  escalate_to_human: "Flagged for human review",
};

function toolLabel(call: ToolCall): string {
  const base = TOOL_LABELS[call.name] ?? call.name;
  if (call.name === "get_invoice" && typeof call.input.identifier === "string") {
    return `${base} ${call.input.identifier}`;
  }
  if (call.name === "get_job" && typeof call.input.identifier === "string") {
    return `${base} ${call.input.identifier}`;
  }
  return base;
}

export default function SupportChatWidget({
  authenticated,
}: {
  authenticated: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hidden = useMemo(() => {
    if (!authenticated) return true;
    return HIDDEN_PATH_PATTERNS.some((p) => p.test(pathname));
  }, [authenticated, pathname]);

  // Load most-recent conversation when panel opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetch("/api/support/current")
      .then((r) => (r.ok ? r.json() : { conversation: null, messages: [] }))
      .then((data) => {
        if (cancelled) return;
        setConversation(data.conversation ?? null);
        setMessages(data.messages ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Auto-scroll to latest message.
  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, submitting]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_MESSAGE_LEN) {
      setError(`Message must be ${MAX_MESSAGE_LEN} characters or fewer.`);
      return;
    }
    setError(null);
    setSubmitting(true);

    // Optimistically show the user message.
    const optimistic: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");

    const pageUrl =
      typeof window !== "undefined" ? window.location.pathname : null;
    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversation?.id,
          message: trimmed,
          page_url: pageUrl,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Something went wrong.");
        setSubmitting(false);
        // Roll back optimistic user bubble so the user can retry.
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      const data = (await res.json()) as {
        conversation_id: string;
        assistant_message: string;
        tools_used: ToolCall[];
        escalated: boolean;
      };
      // Refresh from server so message IDs + timestamps are canonical.
      const refreshed = await fetch("/api/support/current").then((r) =>
        r.ok ? r.json() : null
      );
      if (refreshed) {
        setConversation(refreshed.conversation ?? null);
        setMessages(refreshed.messages ?? []);
      } else {
        // Fallback: append assistant message client-side.
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.assistant_message,
            tool_calls: data.tools_used.length > 0 ? data.tools_used : null,
          },
        ]);
      }
      if (data.escalated) {
        toast.info("Your request has been escalated to human support.");
      }
      setSubmitting(false);
    } catch {
      setError("Network error — please try again.");
      setSubmitting(false);
      setMessages((prev) => prev.slice(0, -1));
    }
  }, [input, conversation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!submitting) submit();
      }
    },
    [submit, submitting]
  );

  if (hidden) return null;

  const escalated = conversation?.status === "escalated";

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open support chat"
          className="fixed bottom-5 right-5 z-[9000] w-[52px] h-[52px] flex items-center justify-center border transition-all hover:scale-[1.04] hover:shadow-lg print:hidden"
          style={{
            background: "var(--nw-slate-deep)",
            color: "var(--nw-white-sand)",
            borderColor: "rgba(247,245,236,0.16)",
          }}
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 sm:inset-auto sm:bottom-5 sm:right-5 z-[9100] flex sm:block print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Nightwork support chat"
        >
          <button
            type="button"
            aria-label="Close"
            className="sm:hidden absolute inset-0 bg-nw-slate-deep/40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <aside
            className="relative w-full sm:w-[400px] h-full sm:h-[600px] max-h-[calc(100vh-2.5rem)] flex flex-col border animate-fade-up"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border-default)",
              boxShadow: "0 12px 40px rgba(26,40,48,0.18)",
            }}
          >
            {/* Header */}
            <header
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: "var(--border-default)" }}
            >
              <div>
                <Eyebrow tone="accent">NIGHTWORK SUPPORT</Eyebrow>
                <h2
                  className="font-display text-base mt-0.5"
                  style={{ color: "var(--text-primary)" }}
                >
                  Ask anything
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-8 h-8 flex items-center justify-center hover:bg-[var(--bg-subtle)]"
                style={{ color: "var(--text-secondary)" }}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </header>

            {/* Escalation banner */}
            {escalated && (
              <div
                className="px-4 py-2 text-xs border-b"
                style={{
                  background: "rgba(201,138,59,0.08)",
                  borderColor: "rgba(201,138,59,0.3)",
                  color: "var(--nw-warn)",
                }}
              >
                This conversation has been escalated. A team member will
                follow up by email within 24 hours.
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {loading ? (
                <p
                  className="text-xs text-center"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Loading…
                </p>
              ) : messages.length === 0 ? (
                <div className="space-y-3">
                  <p
                    className="text-sm"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Hi there. I&apos;m the Nightwork support assistant.
                  </p>
                  <p
                    className="text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Ask me how to approve an invoice, generate a draw, review
                    a specific job, or escalate to our team if you&apos;re
                    stuck.
                  </p>
                </div>
              ) : (
                messages.map((m, idx) => (
                  <MessageBubble key={m.id ?? `msg-${idx}`} message={m} />
                ))
              )}
              {submitting && (
                <div
                  className="text-xs"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block w-2 h-2 animate-pulse"
                      style={{ background: "var(--nw-stone-blue)", borderRadius: "var(--radius-dot)" }}
                    />
                    Assistant is thinking…
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div
              className="border-t px-3 py-3 space-y-2"
              style={{ borderColor: "var(--border-default)" }}
            >
              {error && (
                <div
                  className="px-2 py-1 text-[11px] border"
                  style={{
                    color: "var(--nw-danger)",
                    borderColor: "rgba(176,85,78,0.4)",
                    background: "rgba(176,85,78,0.06)",
                  }}
                >
                  {error}
                </div>
              )}
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={submitting}
                minRows={2}
                maxLength={MAX_MESSAGE_LEN}
                placeholder="Ask a question or describe an issue…"
                className="resize-none"
              />
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] tabular-nums"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    color:
                      input.length > MAX_MESSAGE_LEN * 0.9
                        ? "var(--nw-warn)"
                        : "var(--text-tertiary)",
                  }}
                >
                  {input.length}/{MAX_MESSAGE_LEN}
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={submit}
                  loading={submitting}
                  disabled={submitting || input.trim().length === 0}
                >
                  SEND
                </Button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[88%] px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed border"
        style={{
          background: isUser ? "var(--nw-slate-deep)" : "var(--bg-subtle)",
          color: isUser ? "var(--nw-white-sand)" : "var(--text-primary)",
          borderColor: isUser
            ? "var(--nw-slate-deep)"
            : "var(--border-default)",
        }}
      >
        {message.content}
        {!isUser && message.tool_calls && message.tool_calls.length > 0 && (
          <div className="mt-2 pt-2 border-t flex flex-wrap gap-1"
            style={{ borderColor: "rgba(59,88,100,0.12)" }}
          >
            {message.tool_calls.map((tc, i) => (
              <span
                key={`${tc.name}-${i}`}
                className="inline-flex items-center gap-1 text-[10px] uppercase font-medium px-1.5 py-0.5 border"
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  letterSpacing: "0.1em",
                  color: "var(--text-tertiary)",
                  borderColor: "var(--border-default)",
                }}
              >
                {toolLabel(tc)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
