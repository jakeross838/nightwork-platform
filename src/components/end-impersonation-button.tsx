"use client";

import { useState } from "react";

export default function EndImpersonationButton() {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/platform/impersonate/end", {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as {
        redirect?: string;
      };
      // Hard navigation so middleware picks up the cleared cookie.
      window.location.href = body.redirect ?? "/admin/platform";
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="text-xs px-3 py-1 border whitespace-nowrap"
      style={{
        borderColor: "rgba(255,255,255,0.7)",
        color: "#FFF8F3",
        background: "rgba(0,0,0,0.15)",
      }}
    >
      {busy ? "Ending…" : "End impersonation"}
    </button>
  );
}
