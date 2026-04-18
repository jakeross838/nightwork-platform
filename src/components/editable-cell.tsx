"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Inline-editable table cell for budget rows.
 *
 * Behavior:
 *   - Display mode: shows the formatted value; hovering reveals a pencil
 *     icon to hint that the cell is editable. Double-click or clicking the
 *     pencil enters edit mode.
 *   - Edit mode: input is focused, value selected. Enter or blur saves.
 *     Escape cancels. onSave receives the parsed value (number for
 *     "currency", string otherwise) and may throw to signal rollback.
 *   - The parent owns the value; this component is controlled from the
 *     outside via `value` and notifies back via onSave.
 */
export default function EditableCell({
  value,
  kind,
  format,
  onSave,
  ariaLabel,
  placeholder,
  alignRight,
}: {
  value: string | number;
  kind: "currency" | "text";
  format: (v: string | number) => string;
  onSave: (next: string | number) => Promise<void>;
  ariaLabel?: string;
  placeholder?: string;
  alignRight?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(() => toDraft(value, kind));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(toDraft(value, kind));
  }, [value, kind, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  async function commit() {
    if (busy) return;
    setError(null);
    const parsed = parse(draft, kind);
    if (parsed === null) {
      setError("Invalid value");
      return;
    }
    const originalStr = toDraft(value, kind);
    if (originalStr === String(draft).trim()) {
      setEditing(false);
      return;
    }
    try {
      setBusy(true);
      await onSave(parsed);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setDraft(toDraft(value, kind));
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        onDoubleClick={() => setEditing(true)}
        className={`group relative w-full ${
          alignRight ? "text-right" : "text-left"
        } hover:bg-teal/5 px-1 py-1 sm:py-0 rounded-sm transition-colors cursor-text`}
        aria-label={ariaLabel ?? "Editable cell — tap to edit"}
        title="Tap to edit (or double-click)"
      >
        <span className="tabular-nums pr-4">{format(value)}</span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 opacity-100 md:opacity-0 md:group-hover:opacity-100 text-cream-dim pointer-events-none">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 013.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </span>
      </button>
    );
  }

  return (
    <span className={`inline-flex flex-col ${alignRight ? "items-end" : "items-start"} w-full`}>
      <input
        ref={inputRef}
        type={kind === "currency" ? "text" : "text"}
        inputMode={kind === "currency" ? "decimal" : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          } else if (e.key === "Tab") {
            // Let Tab blur and commit.
            commit();
          }
        }}
        onBlur={() => {
          // Commit on blur unless an error already flagged it.
          if (!error) commit();
        }}
        disabled={busy}
        placeholder={placeholder}
        aria-label={ariaLabel ?? "Cell input"}
        className={`px-1 py-0.5 text-[13px] bg-brand-surface border border-teal text-cream focus:outline-none focus:ring-1 focus:ring-teal tabular-nums ${
          alignRight ? "text-right" : "text-left"
        } w-full`}
      />
      {error && <span className="text-[10px] text-status-danger mt-0.5">{error}</span>}
    </span>
  );
}

function toDraft(value: string | number, kind: "currency" | "text"): string {
  if (kind === "currency") {
    const cents = typeof value === "number" ? value : Number(value) || 0;
    // Render as plain dollars with 2 decimals; user types dollars.
    return (cents / 100).toFixed(2);
  }
  return value == null ? "" : String(value);
}

function parse(draft: string, kind: "currency" | "text"): string | number | null {
  if (kind === "currency") {
    const cleaned = draft.trim().replace(/[$,]/g, "");
    if (cleaned === "") return 0;
    const num = Number(cleaned);
    if (!Number.isFinite(num) || num < 0) return null;
    return Math.round(num * 100);
  }
  return draft.trim();
}
