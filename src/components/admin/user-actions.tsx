"use client";

import { useState } from "react";
import ReasonModal from "./reason-modal";

type ActionKey =
  | "reset_password"
  | "lock_account"
  | "unlock_account"
  | "remove_from_org"
  | "impersonate";

type OrgSummary = { id: string; name: string; role: string };

const ACTION_COPY: Record<
  ActionKey,
  { title: string; description: string; confirm: string; destructive?: boolean }
> = {
  reset_password: {
    title: "Send password reset email",
    description:
      "Sends a one-time password reset link to the user's current email.",
    confirm: "Send reset",
  },
  lock_account: {
    title: "Lock account",
    description:
      "Disables sign-in for this user across every org. Reversible via unlock.",
    confirm: "Lock account",
    destructive: true,
  },
  unlock_account: {
    title: "Unlock account",
    description: "Re-enables sign-in for this user.",
    confirm: "Unlock",
  },
  remove_from_org: {
    title: "Remove from organization",
    description:
      "Sets is_active = false on their org_members row. User can be re-invited later.",
    confirm: "Remove",
    destructive: true,
  },
  impersonate: {
    title: "Impersonate",
    description:
      "Acts as this user's primary org for up to one hour. Writes are double-logged.",
    confirm: "Start impersonation",
  },
};

export default function UserActions({
  userId,
  userName,
  canImpersonate,
  orgs,
}: {
  userId: string;
  userName: string;
  canImpersonate: boolean;
  orgs: OrgSummary[];
}) {
  const [open, setOpen] = useState<ActionKey | null>(null);
  const [removeOrgId, setRemoveOrgId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm(reason: string) {
    if (!open) return;
    setBusy(true);
    setError(null);
    try {
      if (open === "impersonate") {
        // Pick the first active org; UI caller already verified one exists.
        const targetOrg = orgs[0];
        if (!targetOrg) {
          throw new Error("User has no org to impersonate into");
        }
        const res = await fetch("/api/admin/platform/impersonate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_org_id: targetOrg.id, reason }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        const body = (await res.json()) as { redirect?: string };
        window.location.href = body.redirect ?? "/dashboard";
        return;
      }

      const body: Record<string, unknown> = { action: open, reason };
      if (open === "remove_from_org") {
        if (!removeOrgId) throw new Error("Pick an organization to remove from");
        body.org_id = removeOrgId;
      }
      const res = await fetch(
        `/api/admin/platform/users/${userId}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const r = await res.json().catch(() => ({}));
        throw new Error(r.error ?? `Request failed (${res.status})`);
      }
      setOpen(null);
      setRemoveOrgId(null);
      setBusy(false);
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
        <ActionButton onClick={() => setOpen("reset_password")}>
          Send password reset
        </ActionButton>
        <ActionButton onClick={() => setOpen("lock_account")} destructive>
          Lock account
        </ActionButton>
        <ActionButton onClick={() => setOpen("unlock_account")}>
          Unlock account
        </ActionButton>
        {canImpersonate ? (
          <ActionButton onClick={() => setOpen("impersonate")}>
            Impersonate
          </ActionButton>
        ) : null}
      </div>

      {orgs.length > 0 ? (
        <div className="mt-4">
          <Eyebrow2>REMOVE FROM ORG</Eyebrow2>
          <div className="mt-2 flex gap-2 items-center flex-wrap">
            <select
              value={removeOrgId ?? ""}
              onChange={(e) => setRemoveOrgId(e.target.value || null)}
              className="h-8 px-2 text-xs border"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                borderColor: "var(--border-default)",
              }}
            >
              <option value="">— select organization —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.role})
                </option>
              ))}
            </select>
            <ActionButton
              onClick={() =>
                removeOrgId ? setOpen("remove_from_org") : setError("Pick an org first")
              }
              destructive
            >
              Remove
            </ActionButton>
          </div>
        </div>
      ) : null}

      {error && !open ? (
        <div
          className="text-xs px-3 py-2 border mt-3"
          style={{
            color: "var(--nw-danger)",
            borderColor: "var(--nw-danger)",
            background: "rgba(176, 85, 78, 0.06)",
          }}
        >
          {error}
        </div>
      ) : null}

      {current ? (
        <ReasonModal
          open={open !== null}
          title={`${current.title} — ${userName}`}
          description={current.description}
          confirmLabel={current.confirm}
          destructive={current.destructive}
          busy={busy}
          error={error}
          onConfirm={handleConfirm}
          onClose={() => {
            if (!busy) {
              setOpen(null);
              setRemoveOrgId(null);
              setError(null);
            }
          }}
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

function Eyebrow2({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] uppercase tracking-[0.14em] font-medium"
      style={{
        fontFamily: "var(--font-jetbrains-mono)",
        color: "var(--text-tertiary)",
      }}
    >
      {children}
    </span>
  );
}
