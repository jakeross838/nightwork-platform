"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/nw/Button";
import Eyebrow from "@/components/nw/Eyebrow";
import { toast } from "@/lib/utils/toast";

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
] as const;

export default function SupportAdminActions({
  conversationId,
  initialStatus,
  initialAdminNotes,
}: {
  conversationId: string;
  initialStatus: string;
  initialAdminNotes: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [adminNotes, setAdminNotes] = useState(initialAdminNotes);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    status !== initialStatus || adminNotes !== initialAdminNotes;

  async function submit() {
    if (!dirty) {
      setError("No changes to save.");
      return;
    }
    if (!reason.trim()) {
      setError("A short reason is required for the audit log.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/platform/support/${conversationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            admin_notes: adminNotes,
            reason: reason.trim(),
          }),
        }
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Update failed.");
        setSubmitting(false);
        return;
      }
      toast.success("Conversation updated.");
      setReason("");
      setSubmitting(false);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Eyebrow className="mb-1.5 block">STATUS</Eyebrow>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={submitting}
          className="w-full h-10 px-3 text-sm border"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            borderColor: "var(--border-strong)",
          }}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Eyebrow className="mb-1.5 block">INTERNAL NOTES</Eyebrow>
        <textarea
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          disabled={submitting}
          rows={4}
          placeholder="What did we do? Why? Any follow-up for the customer?"
          className="w-full p-3 text-sm border resize-none"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            borderColor: "var(--border-strong)",
          }}
        />
      </div>

      <div>
        <Eyebrow className="mb-1.5 block">AUDIT REASON</Eyebrow>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={submitting}
          placeholder="Why this change? (required)"
          className="w-full h-10 px-3 text-sm border"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            borderColor: "var(--border-strong)",
          }}
        />
      </div>

      {error && (
        <div
          className="p-3 text-xs border"
          style={{
            color: "var(--nw-danger)",
            borderColor: "rgba(176,85,78,0.4)",
            background: "rgba(176,85,78,0.06)",
          }}
        >
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={submit}
          loading={submitting}
          disabled={submitting || !dirty}
        >
          UPDATE
        </Button>
      </div>
    </div>
  );
}
