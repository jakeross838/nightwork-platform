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

export default function AdminSettingsPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [report, setReport] = useState<CheckReport | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [running, setRunning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <h2 className="font-display text-xl text-cream mb-4">Data Integrity</h2>
      <div>
        {role && role !== "owner" && (
          <div className="mt-6 border border-status-warning/40 bg-status-warning/5 px-4 py-3 text-sm text-status-warning">
            Integrity check is owner-only. You can still view the activity log below.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <section className="bg-brand-card border border-brand-border p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium text-cream uppercase tracking-wider">Integrity Check</h3>
                <p className="text-[11px] text-cream-dim mt-1">
                  Audits budget lines, purchase orders, and job contracts against recomputed totals from source data.
                </p>
              </div>
              <button
                onClick={runCheck}
                disabled={running || role !== "owner"}
                className="px-4 py-2 bg-teal hover:bg-teal-hover text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {running ? "Running…" : "Run Check"}
              </button>
            </div>

            {error && (
              <div className="mb-3 border border-status-danger/40 bg-status-danger/5 px-3 py-2 text-xs text-status-danger">
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
                  <p className="text-sm text-cream">
                    {report.mismatches.length === 0
                      ? <span className="text-status-success">✓ 0 mismatches found</span>
                      : <span className="text-status-danger">{report.mismatches.length} mismatch(es)</span>}
                  </p>
                  <p className="text-[10px] text-cream-dim">{formatDateTime(report.ran_at)}</p>
                </div>
                {report.mismatches.length > 0 && (
                  <>
                    <div className="max-h-72 overflow-y-auto border border-brand-border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-brand-surface/50 border-b border-brand-border text-[10px] uppercase tracking-wider text-cream-dim">
                            <th className="text-left px-2 py-1 font-medium">Entity</th>
                            <th className="text-left px-2 py-1 font-medium">Field</th>
                            <th className="text-right px-2 py-1 font-medium">Stored</th>
                            <th className="text-right px-2 py-1 font-medium">Calculated</th>
                            <th className="text-right px-2 py-1 font-medium">Δ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.mismatches.map((m, i) => (
                            <tr key={i} className="border-b border-brand-row-border last:border-0">
                              <td className="px-2 py-1 text-cream">
                                <span className="text-[10px] uppercase tracking-wider text-cream-dim mr-1">{m.entity_type}</span>
                                {m.label}
                              </td>
                              <td className="px-2 py-1 text-cream-muted">{m.field}</td>
                              <td className="px-2 py-1 text-right tabular-nums text-cream">{formatCents(m.stored_value)}</td>
                              <td className="px-2 py-1 text-right tabular-nums text-cream">{formatCents(m.calculated_value)}</td>
                              <td className={`px-2 py-1 text-right tabular-nums font-medium ${m.delta < 0 ? "text-status-danger" : "text-status-success"}`}>
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
                      className="mt-4 px-4 py-2 border border-status-success text-status-success hover:bg-status-success hover:text-white text-sm disabled:opacity-50 transition-colors"
                    >
                      {fixing ? "Recomputing…" : "Fix All"}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>

          <section className="bg-brand-card border border-brand-border p-6">
            <div className="mb-3">
              <h3 className="text-sm font-medium text-cream uppercase tracking-wider">Recent Activity</h3>
              <p className="text-[11px] text-cream-dim mt-1">
                Last 40 entries from the activity log. Status changes, deletions, and blocked actions are captured here.
              </p>
            </div>
            {activity.length === 0 ? (
              <p className="text-xs text-cream-dim py-4">No activity recorded yet.</p>
            ) : (
              <div className="max-h-[440px] overflow-y-auto divide-y divide-brand-row-border">
                {activity.map((a) => (
                  <div key={a.id} className="py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-cream">
                        <span className="text-[10px] uppercase tracking-wider text-cream-dim mr-1.5">{a.entity_type}</span>
                        <ActivityBadge action={a.action} />
                      </span>
                      <span className="text-[10px] text-cream-dim">{formatDateTime(a.created_at)}</span>
                    </div>
                    {a.details && (
                      <p className="text-[11px] text-cream-muted mt-0.5 truncate">
                        {describeDetails(a.action, a.details)}
                      </p>
                    )}
                    {a.entity_id && (
                      <Link
                        href={entityLink(a.entity_type, a.entity_id)}
                        className="text-[10px] text-teal hover:underline"
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
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-brand-border bg-brand-surface/30 p-3">
      <p className="text-[10px] uppercase tracking-wider text-cream-dim">{label}</p>
      <p className="text-lg text-cream mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function ActivityBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    created: "text-status-success border-status-success/40",
    updated: "text-cream-muted border-brand-border",
    status_changed: "text-teal border-teal/40",
    deleted: "text-status-danger border-status-danger/40",
    delete_blocked: "text-status-warning border-status-warning/40",
    voided: "text-status-danger border-status-danger/40",
    void_blocked: "text-status-warning border-status-warning/40",
    merged: "text-brass border-brass/40",
    approved: "text-status-success border-status-success/40",
    denied: "text-status-danger border-status-danger/40",
    recomputed: "text-cream-muted border-brand-border",
    imported: "text-cream-muted border-brand-border",
  };
  const cls = colors[action] ?? "text-cream-muted border-brand-border";
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
