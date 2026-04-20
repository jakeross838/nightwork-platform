"use client";

import { useState } from "react";
import ReasonModal from "./reason-modal";

export default function ImpersonateButton({
  orgId,
  orgName,
  size = "sm",
}: {
  orgId: string;
  orgName: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm(reason: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/platform/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_org_id: orgId, reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const body = (await res.json()) as { redirect?: string };
      // Hard navigation so middleware picks up the cookie on first load.
      window.location.href = body.redirect ?? "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impersonation failed");
      setBusy(false);
    }
  }

  const cls =
    size === "sm"
      ? "text-xs px-2 py-1 border"
      : "text-sm px-3 py-1.5 border";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cls}
        style={{
          borderColor: "var(--nw-stone-blue)",
          color: "var(--nw-stone-blue)",
          background: "rgba(91, 134, 153, 0.06)",
        }}
      >
        Impersonate
      </button>
      <ReasonModal
        open={open}
        title={`Impersonate ${orgName}`}
        description="You will act as the owner of this organization for up to one hour. Every write is double-logged."
        confirmLabel="Start impersonation"
        busy={busy}
        error={error}
        onConfirm={handleConfirm}
        onClose={() => !busy && setOpen(false)}
      />
    </>
  );
}
