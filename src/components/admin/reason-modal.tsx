"use client";

import { useEffect, useRef, useState } from "react";

export type ReasonModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
};

/**
 * Every cross-tenant admin action goes through this modal so we always
 * capture a `reason` string before writing to platform_admin_audit. The
 * input is required — confirm is disabled while empty or while the
 * parent reports `busy`.
 */
export default function ReasonModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  busy = false,
  error = null,
  onConfirm,
  onClose,
}: ReasonModalProps) {
  const [reason, setReason] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      // Focus shortly after the modal paints.
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const trimmed = reason.trim();
  const canSubmit = trimmed.length > 0 && !busy;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(16, 24, 32, 0.55)" }}
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-md border shadow-xl"
        style={{
          background: "var(--bg-card)",
          borderColor: "var(--border-default)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 py-4 border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          <h2
            className="font-display text-lg tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h2>
          {description ? (
            <p
              className="text-xs mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {description}
            </p>
          ) : null}
        </div>

        <div className="px-5 py-4 space-y-3">
          <label
            className="text-[10px] uppercase tracking-[0.14em] font-medium block"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              color: "var(--text-tertiary)",
            }}
          >
            REASON (REQUIRED)
          </label>
          <textarea
            ref={inputRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="What are you doing and why?"
            className="w-full px-3 py-2 text-sm border resize-none"
            style={{
              background: "var(--bg-page)",
              color: "var(--text-primary)",
              borderColor: "var(--border-default)",
            }}
            disabled={busy}
          />
          {error ? (
            <div
              className="text-xs px-3 py-2 border"
              style={{
                color: "var(--nw-danger)",
                borderColor: "var(--nw-danger)",
                background: "rgba(176, 85, 78, 0.06)",
              }}
            >
              {error}
            </div>
          ) : null}
        </div>

        <div
          className="px-5 py-3 border-t flex items-center justify-end gap-2"
          style={{ borderColor: "var(--border-default)" }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-xs px-3 py-1.5 border"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => canSubmit && onConfirm(trimmed)}
            disabled={!canSubmit}
            className="text-xs px-3 py-1.5 font-medium border"
            style={{
              borderColor: destructive
                ? "var(--nw-danger)"
                : "var(--nw-stone-blue)",
              color: destructive ? "var(--nw-danger)" : "var(--nw-stone-blue)",
              background: destructive
                ? "rgba(176, 85, 78, 0.06)"
                : "rgba(91, 134, 153, 0.06)",
              opacity: canSubmit ? 1 : 0.4,
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
