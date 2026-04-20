"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDateTime } from "@/lib/utils/format";

interface Mismatch {
  entity_type: "budget_line" | "purchase_order" | "job";
  entity_id: string;
  label: string;
  field: string;
  stored_value: number;
  calculated_value: number;
  delta: number;
}

interface CheckReport {
  lines_checked: number;
  pos_checked: number;
  jobs_checked: number;
  mismatches: Mismatch[];
  ran_at: string;
}

interface ActivityRow {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  user_id: string | null;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [report, setReport] = useState<CheckReport | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [running, setRunning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingSample, setRemovingSample] = useState(false);
  const [sampleMsg, setSampleMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login?redirect=/settings/admin"); return; }
      const { data: m } = await supabase
        .from("org_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (m) setRole(m.role);

      // Load recent activity — any role that can view this page can see it.
      const { data: act } = await supabase
        .from("activity_log")
        .select("id, entity_type, entity_id, action, details, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(40);
      if (act) setActivity(act as ActivityRow[]);
    }
    load();
  }, [router]);

  async function runCheck() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/integrity-check", { method: "GET" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setReport(data as CheckReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setRunning(false);
    }
  }

  async function fixAll() {
    if (!confirm("Run recalc on every job in the org? This recomputes committed/invoiced/CO adjustments from source data.")) return;
    setFixing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/integrity-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fix: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await runCheck();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setFixing(false);
    }
  }

  return (
    <div>
      <h2 className="font-display text-xl text-[color:var(--text-primary)] mb-4">Data Integrity</h2>
      <div>
        {role && role !== "owner" && (
          <div className="mt-6 border border-[rgba(201,138,59,0.35)] bg-[rgba(201,138,59,0.08)] px-4 py-3 text-sm text-[color:var(--nw-warn)]">
            Integrity check is owner-only. You can still view the activity log below.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <section className="bg-[var(--bg-card)] border border-[var(--border-default)] p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium text-[color:var(--text-primary)] uppercase tracking-wider">Integrity Check</h3>
                <p className="text-[11px] text-[color:var(--text-secondary)] mt-1">
                  Audits budget lines, purchase orders, and job contracts against recomputed totals from source data.
                </p>
              </div>
              <button
                onClick={runCheck}
                disabled={running || role !== "owner"}
                className="px-4 py-2 bg-[var(--nw-stone-blue)] hover:bg-[var(--nw-gulf-blue)] text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {running ? "Running…" : "Run Check"}
              </button>
            </div>

            {error && (
              <div className="mb-3 border border-[rgba(176,85,78,0.35)] bg-[rgba(176,85,78,0.08)] px-3 py-2 text-xs text-[color:var(--nw-danger)]">
                {error}
              </div>
            )}

            {report && (
              <div className="mt-4">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <Stat label="Budget Lines" value={String(report.lines_checked)} />
                  <Stat label="POs" value={String(report.pos_checked)} />
                  <Stat label="Jobs" value={String(report.jobs_checked)} />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-[color:var(--text-primary)]">
                    {report.mismatches.length === 0
                      ? <span className="text-[color:var(--nw-success)]">✓ 0 mismatches found</span>
                      : <span className="text-[color:var(--nw-danger)]">{report.mismatches.length} mismatch(es)</span>}
                  </p>
                  <p className="text-[10px] text-[color:var(--text-secondary)]">{formatDateTime(report.ran_at)}</p>
                </div>
                {report.mismatches.length > 0 && (
                  <>
                    <div className="max-h-72 overflow-y-auto border border-[var(--border-default)]">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[rgba(91,134,153,0.04)] border-b border-[var(--border-default)] text-[10px] uppercase tracking-wider text-[color:var(--text-secondary)]">
                            <th className="text-left px-2 py-1 font-medium">Entity</th>
                            <th className="text-left px-2 py-1 font-medium">Field</th>
                            <th className="text-right px-2 py-1 font-medium">Stored</th>
                            <th className="text-right px-2 py-1 font-medium">Calculated</th>
                            <th className="text-right px-2 py-1 font-medium">Δ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.mismatches.map((m, i) => (
                            <tr key={i} className="border-b border-[var(--border-default)] last:border-0">
                              <td className="px-2 py-1 text-[color:var(--text-primary)]">
                                <span className="text-[10px] uppercase tracking-wider text-[color:var(--text-secondary)] mr-1">{m.entity_type}</span>
                                {m.label}
                              </td>
                              <td className="px-2 py-1 text-[color:var(--text-muted)]">{m.field}</td>
                              <td className="px-2 py-1 text-right tabular-nums text-[color:var(--text-primary)]">{formatCents(m.stored_value)}</td>
                              <td className="px-2 py-1 text-right tabular-nums text-[color:var(--text-primary)]">{formatCents(m.calculated_value)}</td>
                              <td className={`px-2 py-1 text-right tabular-nums font-medium ${m.delta < 0 ? "text-[color:var(--nw-danger)]" : "text-[color:var(--nw-success)]"}`}>
                                {m.delta > 0 ? "+" : ""}{formatCents(m.delta)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      onClick={fixAll}
                      disabled={fixing || role !== "owner"}
                      className="mt-4 px-4 py-2 border border-[rgba(74,138,111,0.5)] text-[color:var(--nw-success)] hover:bg-[var(--nw-success)] hover:text-white text-sm disabled:opacity-50 transition-colors"
                    >
                      {fixing ? "Recomputing…" : "Fix All"}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>

          <section className="bg-[var(--bg-card)] border border-[var(--border-default)] p-6">
            <div className="mb-3">
              <h3 className="text-sm font-medium text-[color:var(--text-primary)] uppercase tracking-wider">Recent Activity</h3>
              <p className="text-[11px] text-[color:var(--text-secondary)] mt-1">
                Last 40 entries from the activity log. Status changes, deletions, and blocked actions are captured here.
              </p>
            </div>
            {activity.length === 0 ? (
              <p className="text-xs text-[color:var(--text-secondary)] py-4">No activity recorded yet.</p>
            ) : (
              <div className="max-h-[440px] overflow-y-auto divide-y divide-[var(--border-default)]">
                {activity.map((a) => (
                  <div key={a.id} className="py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[color:var(--text-primary)]">
                        <span className="text-[10px] uppercase tracking-wider text-[color:var(--text-secondary)] mr-1.5">{a.entity_type}</span>
                        <ActivityBadge action={a.action} />
                      </span>
                      <span className="text-[10px] text-[color:var(--text-secondary)]">{formatDateTime(a.created_at)}</span>
                    </div>
                    {a.details && (
                      <p className="text-[11px] text-[color:var(--text-muted)] mt-0.5 truncate">
                        {describeDetails(a.action, a.details)}
                      </p>
                    )}
                    {a.entity_id && (
                      <Link
                        href={entityLink(a.entity_type, a.entity_id)}
                        className="text-[10px] text-[color:var(--nw-stone-blue)] hover:underline"
                      >
                        View →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="bg-[var(--bg-card)] border border-[var(--border-default)] p-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-[color:var(--text-primary)] uppercase tracking-wider">Sample Data</h3>
              <p className="text-[11px] text-[color:var(--text-secondary)] mt-1">
                Remove the demo project and all associated records (invoices, budget lines, POs, draws).
              </p>
            </div>
            <button
              onClick={async () => {
                if (!confirm("Remove all sample data? This soft-deletes the Sample Residence job and all linked records.")) return;
                setRemovingSample(true);
                setSampleMsg(null);
                try {
                  const res = await fetch("/api/sample-data", { method: "DELETE" });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                  setSampleMsg("Sample data removed.");
                } catch (err) {
                  setSampleMsg(err instanceof Error ? err.message : "Failed");
                } finally {
                  setRemovingSample(false);
                }
              }}
              disabled={removingSample || (role !== "owner" && role !== "admin")}
              className="px-4 py-2 border border-[rgba(176,85,78,0.5)] text-[color:var(--nw-danger)] hover:bg-[var(--nw-danger)] hover:text-white text-sm disabled:opacity-50 transition-colors"
            >
              {removingSample ? "Removing…" : "Remove Sample Data"}
            </button>
          </div>
          {sampleMsg && (
            <p className={`mt-3 text-xs ${sampleMsg.includes("removed") ? "text-[color:var(--nw-success)]" : "text-[color:var(--nw-danger)]"}`}>
              {sampleMsg}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--border-default)] bg-[rgba(91,134,153,0.02)] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[color:var(--text-secondary)]">{label}</p>
      <p className="text-lg text-[color:var(--text-primary)] mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function ActivityBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    created: "text-[color:var(--nw-success)] border-[rgba(74,138,111,0.35)]",
    updated: "text-[color:var(--text-muted)] border-[var(--border-default)]",
    status_changed: "text-[color:var(--nw-stone-blue)] border-[rgba(91,134,153,0.35)]",
    deleted: "text-[color:var(--nw-danger)] border-[rgba(176,85,78,0.35)]",
    delete_blocked: "text-[color:var(--nw-warn)] border-[rgba(201,138,59,0.35)]",
    voided: "text-[color:var(--nw-danger)] border-[rgba(176,85,78,0.35)]",
    void_blocked: "text-[color:var(--nw-warn)] border-[rgba(201,138,59,0.35)]",
    merged: "text-[color:var(--nw-warn)] border-[rgba(201,138,59,0.35)]",
    approved: "text-[color:var(--nw-success)] border-[rgba(74,138,111,0.35)]",
    denied: "text-[color:var(--nw-danger)] border-[rgba(176,85,78,0.35)]",
    recomputed: "text-[color:var(--text-muted)] border-[var(--border-default)]",
    imported: "text-[color:var(--text-muted)] border-[var(--border-default)]",
  };
  const cls = colors[action] ?? "text-[color:var(--text-muted)] border-[var(--border-default)]";
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] uppercase tracking-wider border ${cls}`}>
      {action.replace(/_/g, " ")}
    </span>
  );
}

function describeDetails(action: string, details: Record<string, unknown>): string {
  if (action === "status_changed" && details.from !== undefined && details.to !== undefined) {
    return `${details.from ?? "—"} → ${details.to}${details.reason ? ` — ${details.reason}` : ""}`;
  }
  if (action === "delete_blocked" || action === "void_blocked") {
    const blockers = details.blockers as string[] | undefined;
    return blockers?.join(", ") ?? JSON.stringify(details);
  }
  return JSON.stringify(details);
}

function entityLink(entity_type: string, entity_id: string): string {
  switch (entity_type) {
    case "invoice": return `/invoices/${entity_id}`;
    case "purchase_order": return `/purchase-orders/${entity_id}`;
    case "change_order": return `/change-orders/${entity_id}`;
    case "draw": return `/draws/${entity_id}`;
    case "job": return `/jobs/${entity_id}`;
    case "vendor": return `/vendors/${entity_id}`;
    default: return "#";
  }
}
