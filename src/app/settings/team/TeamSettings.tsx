"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeamMember, PendingInvite } from "./page";
import NwBadge from "@/components/nw/Badge";

const ROLE_OPTIONS: Array<{ value: TeamMember["role"]; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "pm", label: "Project Manager" },
  { value: "accounting", label: "Accounting" },
];

export default function TeamSettings({
  currentUserId,
  members,
  pending,
}: {
  currentUserId: string;
  members: TeamMember[];
  pending: PendingInvite[];
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamMember["role"]>("pm");
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeOwners = members.filter((m) => m.role === "owner" && m.is_active).length;

  async function submitInvite() {
    setMessage(null);
    setInviteLink(null);
    try {
      const res = await fetch("/api/organizations/members/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Invite failed");
      setInviteLink(body.invite_url as string);
      setInviteEmail("");
      setMessage({ kind: "ok", text: "Invite created. Share the link below." });
      router.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Invite failed" });
    }
  }

  async function updateMember(id: string, patch: Partial<{ role: TeamMember["role"]; is_active: boolean }>) {
    setBusyId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/organizations/members/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Update failed");
      router.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Update failed" });
    } finally {
      setBusyId(null);
    }
  }

  async function revokeInvite(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/organizations/invites/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Revoke failed");
      router.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Revoke failed" });
    } finally {
      setBusyId(null);
    }
  }

  function statusBadge(m: TeamMember) {
    if (!m.is_active) return <Badge tone="muted">Deactivated</Badge>;
    if (!m.accepted_at) return <Badge tone="warn">Invited</Badge>;
    return <Badge tone="ok">Active</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-label">Team Members ({members.length})</h2>
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen((o) => !o)}
          className="px-4 py-2 bg-[var(--nw-stone-blue)] text-white text-sm font-medium"
        >
          {inviteOpen ? "Cancel" : "Invite Member"}
        </button>
      </div>

      {inviteOpen && (
        <div className="border border-[var(--border-default)] bg-white p-4">
          <h3 className="text-sm font-medium text-[color:var(--text-primary)] mb-3">Invite a new team member</h3>
          <div className="grid sm:grid-cols-[1fr_180px_auto] gap-3 items-end">
            <label className="block">
              <span className="block text-[11px] tracking-[0.08em] uppercase text-[color:var(--text-secondary)] mb-1">Email</span>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                className="w-full px-3 py-2 border border-[var(--border-default)] bg-white text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] tracking-[0.08em] uppercase text-[color:var(--text-secondary)] mb-1">Role</span>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as TeamMember["role"])}
                className="w-full px-3 py-2 border border-[var(--border-default)] bg-white text-sm"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={submitInvite}
              disabled={!inviteEmail.trim()}
              className="px-4 py-2 bg-[var(--nw-stone-blue)] text-white text-sm font-medium disabled:opacity-50 h-[38px]"
            >
              Send Invite
            </button>
          </div>
          {inviteLink && (
            <div className="mt-3 p-3 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-xs">
              <p className="text-[color:var(--text-secondary)] uppercase tracking-[0.08em] mb-1">Invite link</p>
              <code className="block break-all text-[color:var(--text-primary)]">{inviteLink}</code>
            </div>
          )}
        </div>
      )}

      {message && (
        <p className={`text-xs ${message.kind === "ok" ? "text-[color:var(--nw-success)]" : "text-[color:var(--nw-danger)]"}`}>
          {message.text}
        </p>
      )}

      <div className="border border-[var(--border-default)] bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-subtle)]">
            <tr className="text-left text-[11px] tracking-[0.08em] uppercase text-[color:var(--text-secondary)]">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isSelf = m.user_id === currentUserId;
              const isLastOwner = m.role === "owner" && activeOwners <= 1;
              const canDeactivate = !isSelf && !(m.role === "owner" && activeOwners <= 1);
              return (
                <tr key={m.id} className="border-t border-[var(--border-default)]">
                  <td className="px-4 py-3 text-[color:var(--text-primary)]">
                    {m.full_name}
                    {isSelf && <span className="ml-2 text-[10px] text-[color:var(--text-secondary)] uppercase">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--text-secondary)]">{m.email ?? ""}</td>
                  <td className="px-4 py-3">
                    <select
                      value={m.role}
                      disabled={isSelf || isLastOwner || busyId === m.id}
                      onChange={(e) => updateMember(m.id, { role: e.target.value as TeamMember["role"] })}
                      className="px-2 py-1 border border-[var(--border-default)] bg-white text-sm"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">{statusBadge(m)}</td>
                  <td className="px-4 py-3 text-[color:var(--text-secondary)] text-xs">
                    {m.accepted_at ? new Date(m.accepted_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canDeactivate && (
                      <button
                        type="button"
                        onClick={() => updateMember(m.id, { is_active: !m.is_active })}
                        disabled={busyId === m.id}
                        className="text-xs px-2 py-1 border border-[var(--border-default)] hover:bg-[var(--bg-subtle)]"
                      >
                        {m.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pending.length > 0 && (
        <section>
          <h2 className="section-label">Pending Invites ({pending.length})</h2>
          <div className="border border-[var(--border-default)] bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-subtle)]">
                <tr className="text-left text-[11px] tracking-[0.08em] uppercase text-[color:var(--text-secondary)]">
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Sent</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((inv) => (
                  <tr key={inv.id} className="border-t border-[var(--border-default)]">
                    <td className="px-4 py-3 text-[color:var(--text-primary)]">{inv.email}</td>
                    <td className="px-4 py-3 text-[color:var(--text-secondary)] capitalize">{inv.role}</td>
                    <td className="px-4 py-3 text-[color:var(--text-secondary)] text-xs">
                      {new Date(inv.invited_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--text-secondary)] text-xs">
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => revokeInvite(inv.id)}
                        disabled={busyId === inv.id}
                        className="text-xs px-2 py-1 border border-[var(--border-default)] hover:bg-[var(--bg-subtle)]"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Badge({ tone, children }: { tone: "ok" | "warn" | "muted"; children: React.ReactNode }) {
  const variant = tone === "ok" ? "success" : tone === "warn" ? "warning" : "neutral";
  return (
    <NwBadge variant={variant} size="sm">
      {children}
    </NwBadge>
  );
}

// Global helper classes for team form
const teamStyles = `
  .nw-panel { background: var(--bg-card); border-color: var(--border-default); }
  .nw-eyebrow { font-family: var(--font-jetbrains-mono); letter-spacing: 0.14em; color: var(--text-tertiary); }
  .nw-input { background: var(--bg-subtle); border-color: var(--border-default); color: var(--text-primary); }
  .nw-input:focus { outline: none; border-color: var(--nw-stone-blue); }
  .nw-primary-btn { font-family: var(--font-jetbrains-mono); letter-spacing: 0.12em; font-weight: 500; background: var(--nw-stone-blue); color: var(--nw-white-sand); border: 1px solid var(--nw-stone-blue); }
  .nw-primary-btn:hover:not(:disabled) { background: var(--nw-gulf-blue); border-color: var(--nw-gulf-blue); }
`;
if (typeof document !== "undefined" && !document.getElementById("nw-team-styles")) {
  const s = document.createElement("style");
  s.id = "nw-team-styles";
  s.textContent = teamStyles;
  document.head.appendChild(s);
}
