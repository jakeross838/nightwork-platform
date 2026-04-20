"use client";

import { useState } from "react";
import ReasonModal from "./reason-modal";

type ActionKey = "extend_trial" | "mark_churned" | "unlock";

const ACTION_COPY: Record<
  ActionKey,
  { title: string; description: string; confirm: string; destructive?: boolean }
> = {
  extend_trial: {
    title: "Extend trial by 30 days",
    description:
      "Pushes the trial end date out by 30 days from today. Works even if the trial has already expired.",
    confirm: "Extend trial",
  },
  unlock: {
    title: "Unlock organization",
    description:
      "Clears a past-due payment lock so members can access the app. Does NOT reset billing — run a Stripe retry separately.",
    confirm: "Unlock",
  },
  mark_churned: {
    title: "Mark organization as churned",
    description:
      "Sets subscription_status to cancelled. Reversible by extend-trial or reactivation.",
    confirm: "Mark churned",
    destructive: true,
  },
};

export default function OrgActions({
  orgId,
  orgName,
}: {
  orgId: string;
  orgName: string;
}) {
  const [open, setOpen] = useState<ActionKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm(reason: string) {
    if (!open) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/platform/organizations/${orgId}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: open, reason }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setOpen(null);
      setBusy(false);
      // Refresh the page so new state is visible.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
      setBusy(false);
    }
  }

  const current = open ? ACTION_COPY[open] : null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <ActionButton onClick={() => setOpen("extend_trial")}>
          Extend trial +30d
        </ActionButton>
        <ActionButton onClick={() => setOpen("unlock")}>
          Unlock account
        </ActionButton>
        <ActionButton onClick={() => setOpen("mark_churned")} destructive>
          Mark as churned
        </ActionButton>
      </div>
      {current ? (
        <ReasonModal
          open={open !== null}
          title={`${current.title} — ${orgName}`}
          description={current.description}
          confirmLabel={current.confirm}
          destructive={current.destructive}
          busy={busy}
          error={error}
          onConfirm={handleConfirm}
          onClose={() => !busy && setOpen(null)}
        />
      ) : null}
    </>
  );
}

function ActionButton({
  onClick,
  destructive,
  children,
}: {
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs px-3 py-1.5 border"
      style={{
        borderColor: destructive ? "var(--nw-danger)" : "var(--border-default)",
        color: destructive ? "var(--nw-danger)" : "var(--text-primary)",
        background: "var(--bg-card)",
      }}
    >
      {children}
    </button>
  );
}
