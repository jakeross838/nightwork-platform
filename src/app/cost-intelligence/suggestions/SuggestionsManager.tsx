"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/app-shell";
import NwButton from "@/components/nw/Button";
import NwBadge from "@/components/nw/Badge";
import NwEyebrow from "@/components/nw/Eyebrow";
import type { PendingSuggestion, CanonicalCodeOption } from "./page";
import type { OrgMemberRole } from "@/lib/org/session";

interface Props {
  pending: PendingSuggestion[];
  canonical: CanonicalCodeOption[];
  role: OrgMemberRole;
}

interface ResolveDraft {
  suggestion_id: string;
  action: "approve" | "reject";
  resolution_note: string;
}

export default function SuggestionsManager({ pending, canonical, role }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<PendingSuggestion[]>(pending);
  const [draft, setDraft] = useState<ResolveDraft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canResolve = role === "owner" || role === "admin";

  const canonicalById = new Map(canonical.map((c) => [c.id, c]));

  async function submitResolve() {
    if (!draft) return;
    setBusy(draft.suggestion_id);
    setError(null);
    try {
      const res = await fetch(
        `/api/cost-code-suggestions/${draft.suggestion_id}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: draft.action,
            resolution_note: draft.resolution_note || null,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setRows((prev) => prev.filter((r) => r.id !== draft.suggestion_id));
      setDraft(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 px-6 py-8">
        <header className="space-y-2">
          <NwEyebrow tone="accent">Cost Intelligence · Suggestions</NwEyebrow>
          <h1 className="text-2xl font-semibold text-[color:var(--text-primary)]">
            Pending cost-code suggestions
          </h1>
          <p className="text-sm text-[color:var(--text-secondary)]">
            PMs propose new codes from the proposal review form.{" "}
            {canResolve
              ? "As an owner/admin, you can approve a suggestion (creates the org_cost_codes row) or reject with a note."
              : "Only owners and admins can approve or reject. Your suggestions remain visible here until resolved."}
          </p>
        </header>

        {error && (
          <div className="rounded border border-[var(--nw-danger)] bg-[var(--nw-danger)]/10 px-3 py-2 text-sm text-[color:var(--nw-danger)]">
            {error}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-center">
            <p className="text-sm text-[color:var(--text-secondary)]">
              No pending suggestions.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => {
              const canonicalEntry = row.suggested_canonical_code_id
                ? canonicalById.get(row.suggested_canonical_code_id)
                : null;
              return (
                <div
                  key={row.id}
                  className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-4"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-medium text-[color:var(--text-primary)]">
                          {row.suggested_code}
                        </code>
                        <span className="text-sm text-[color:var(--text-secondary)]">
                          {row.suggested_name}
                        </span>
                        <NwBadge variant="warning" size="sm">
                          Pending
                        </NwBadge>
                      </div>
                      {canonicalEntry && (
                        <div className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                          NAHB: {canonicalEntry.code} — {canonicalEntry.full_path}
                        </div>
                      )}
                      {row.suggested_parent_code && (
                        <div className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                          Parent: {row.suggested_parent_code}
                        </div>
                      )}
                      {row.rationale && (
                        <div className="mt-2 text-sm text-[color:var(--text-secondary)]">
                          <span className="font-medium">Rationale:</span> {row.rationale}
                        </div>
                      )}
                      <div className="mt-2 text-xs text-[color:var(--text-tertiary)]">
                        Suggested {new Date(row.created_at).toLocaleString()}
                      </div>
                    </div>
                    {canResolve && (
                      <div className="flex gap-2">
                        <NwButton
                          variant="primary"
                          size="sm"
                          loading={busy === row.id && draft?.action === "approve"}
                          onClick={() =>
                            setDraft({
                              suggestion_id: row.id,
                              action: "approve",
                              resolution_note: "",
                            })
                          }
                        >
                          Approve
                        </NwButton>
                        <NwButton
                          variant="danger"
                          size="sm"
                          loading={busy === row.id && draft?.action === "reject"}
                          onClick={() =>
                            setDraft({
                              suggestion_id: row.id,
                              action: "reject",
                              resolution_note: "",
                            })
                          }
                        >
                          Reject
                        </NwButton>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {draft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-md space-y-4 rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
              <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
                {draft.action === "approve" ? "Approve" : "Reject"} suggestion
              </h2>
              <p className="text-sm text-[color:var(--text-secondary)]">
                {draft.action === "approve"
                  ? "Approving will create an org_cost_codes row and link the suggestion. Optional note for the audit trail."
                  : "Rejecting closes the suggestion. A note is recommended so the suggestor knows why."}
              </p>
              <textarea
                className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[color:var(--text-primary)]"
                rows={3}
                placeholder={
                  draft.action === "approve"
                    ? "Optional note (e.g., mapped to NAHB 01-13-2317)"
                    : "Required: reason for rejection"
                }
                value={draft.resolution_note}
                onChange={(e) =>
                  setDraft({ ...draft, resolution_note: e.target.value })
                }
              />
              <div className="flex justify-end gap-2">
                <NwButton variant="ghost" size="sm" onClick={() => setDraft(null)}>
                  Cancel
                </NwButton>
                <NwButton
                  variant={draft.action === "approve" ? "primary" : "danger"}
                  size="sm"
                  loading={busy === draft.suggestion_id}
                  disabled={
                    draft.action === "reject" && draft.resolution_note.trim() === ""
                  }
                  onClick={submitResolve}
                >
                  {draft.action === "approve" ? "Approve" : "Reject"}
                </NwButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
