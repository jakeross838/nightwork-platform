"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate } from "@/lib/utils/format";
import JobTabs from "@/components/job-tabs";
import JobFinancialBar from "@/components/job-financial-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import DrawsSubTabs from "@/components/draws-sub-tabs";

interface LienRelease {
  id: string;
  vendor_id: string | null;
  draw_id: string | null;
  release_type: string;
  amount: number | null;
  status: string;
  through_date: string | null;
  received_at: string | null;
  document_url: string | null;
  notes: string | null;
  created_at: string;
  vendors: { id: string; name: string } | null;
  draws: { id: string; draw_number: number; revision_number: number } | null;
  payment_summary: {
    paid_count: number;
    total_count: number;
    paid_amount: number;
    total_amount: number;
  } | null;
}

interface Job {
  id: string;
  name: string;
}

const RELEASE_TYPES = [
  { value: "conditional_progress", label: "Conditional Progress" },
  { value: "unconditional_progress", label: "Unconditional Progress" },
  { value: "conditional_final", label: "Conditional Final" },
  { value: "unconditional_final", label: "Unconditional Final" },
];

const STATUSES = ["all", "pending", "received", "waived", "not_required"] as const;

export default function JobLienReleasesPage({ params }: { params: { id: string } }) {
  const [job, setJob] = useState<Job | null>(null);
  const [releases, setReleases] = useState<LienRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawFilter, setDrawFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  async function refresh() {
    const [jobRes, lrRes] = await Promise.all([
      supabase.from("jobs").select("id, name").eq("id", params.id).single(),
      fetch(`/api/lien-releases?job_id=${params.id}`).then((r) => r.json()),
    ]);
    if (jobRes.data) setJob(jobRes.data as Job);
    setReleases(Array.isArray(lrRes) ? (lrRes as LienRelease[]) : []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const draws = useMemo(() => {
    const map = new Map<string, { id: string; number: number; revision: number }>();
    for (const r of releases) {
      if (r.draws) {
        map.set(r.draws.id, { id: r.draws.id, number: r.draws.draw_number, revision: r.draws.revision_number });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.number - b.number);
  }, [releases]);

  const vendors = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of releases) {
      if (r.vendors) set.set(r.vendors.id, r.vendors.name);
    }
    return Array.from(set.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [releases]);

  const filtered = useMemo(() => {
    return releases.filter((r) => {
      if (drawFilter && r.draw_id !== drawFilter) return false;
      if (vendorFilter && r.vendor_id !== vendorFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [releases, drawFilter, vendorFilter, statusFilter]);

  const pendingIds = filtered.filter((r) => r.status === "pending").map((r) => r.id);

  async function save(id: string, patch: Partial<LienRelease>) {
    setSaving(true);
    const res = await fetch(`/api/lien-releases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setEditingId(null);
      await refresh();
    }
    setSaving(false);
  }

  async function bulk(action: "mark_received" | "waive") {
    if (pendingIds.length === 0) return;
    if (action === "waive" && !window.confirm(`Waive ${pendingIds.length} lien release(s)?`)) return;
    setBulkBusy(true);
    await fetch(`/api/lien-releases/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: pendingIds, action }),
    });
    await refresh();
    setBulkBusy(false);
  }

  return (
    <>
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Jobs", href: "/jobs" },
            { label: job?.name ?? "Job", href: `/jobs/${params.id}` },
            { label: "Lien Releases" },
          ]}
        />
        <h2 className="font-display text-2xl text-slate-tile mb-2">{job?.name} — Lien Releases</h2>
        <p className="text-sm text-[rgba(59,88,100,0.55)] mb-6">
          Track conditional and unconditional waivers for every vendor on every draw.
        </p>
        <JobTabs jobId={params.id} active="draws" />
        <JobFinancialBar jobId={params.id} />
        <DrawsSubTabs jobId={params.id} active="liens" />

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-2 border-stone-blue/30 border-t-teal animate-spin mx-auto" />
          </div>
        ) : (
          <>
            {/* Filters + bulk actions */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <select
                value={drawFilter}
                onChange={(e) => setDrawFilter(e.target.value)}
                className="px-3 py-2 bg-[rgba(91,134,153,0.06)] border border-[rgba(59,88,100,0.15)] text-sm text-slate-tile focus:border-stone-blue focus:outline-none"
              >
                <option value="">All Draws</option>
                {draws.map((d) => (
                  <option key={d.id} value={d.id}>
                    Draw #{d.number}
                    {d.revision > 0 ? ` Rev ${d.revision}` : ""}
                  </option>
                ))}
              </select>
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="px-3 py-2 bg-[rgba(91,134,153,0.06)] border border-[rgba(59,88,100,0.15)] text-sm text-slate-tile focus:border-stone-blue focus:outline-none"
              >
                <option value="">All Vendors</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as (typeof STATUSES)[number])}
                className="px-3 py-2 bg-[rgba(91,134,153,0.06)] border border-[rgba(59,88,100,0.15)] text-sm text-slate-tile focus:border-stone-blue focus:outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? "All Statuses" : s.replace("_", " ")}
                  </option>
                ))}
              </select>

              <div className="flex-1" />
              <button
                onClick={() => bulk("mark_received")}
                disabled={pendingIds.length === 0 || bulkBusy}
                className="px-3 py-2 border border-nw-success text-nw-success hover:bg-nw-success/10 disabled:opacity-40 text-sm font-medium transition-colors"
              >
                Mark {pendingIds.length} as Received
              </button>
              <button
                onClick={() => bulk("waive")}
                disabled={pendingIds.length === 0 || bulkBusy}
                className="px-3 py-2 border border-[rgba(59,88,100,0.15)] text-[rgba(59,88,100,0.55)] hover:text-slate-tile disabled:opacity-40 text-sm font-medium transition-colors"
              >
                Waive {pendingIds.length}
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="border border-[rgba(59,88,100,0.15)] p-10 text-center">
                <p className="text-slate-tile font-display">No lien releases yet</p>
                <p className="text-[rgba(59,88,100,0.55)] text-sm mt-1">
                  They auto-generate when a draw is submitted for approval.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-[rgba(59,88,100,0.15)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[rgba(91,134,153,0.06)] text-left">
                      <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider">Vendor</th>
                      <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider">Draw</th>
                      <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider">Type</th>
                      <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider text-right">Amount</th>
                      <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider">Status</th>
                      <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider">Payment</th>
                      <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider">Through Date</th>
                      <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider">Document</th>
                      <th className="py-3 px-4 text-[11px] text-slate-tile font-bold uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-t border-[rgba(59,88,100,0.08)] hover:bg-brand-elevated/30 transition-colors">
                        <td className="py-3 px-4 text-slate-tile">{r.vendors?.name ?? "—"}</td>
                        <td className="py-3 px-4 text-[rgba(59,88,100,0.70)]">
                          {r.draws ? `Draw #${r.draws.draw_number}${r.draws.revision_number > 0 ? ` Rev ${r.draws.revision_number}` : ""}` : "—"}
                        </td>
                        <td className="py-3 px-4 text-[rgba(59,88,100,0.70)] text-xs">{humanType(r.release_type)}</td>
                        <td className="py-3 px-4 text-slate-tile text-right font-display font-medium">
                          {r.amount != null ? formatCents(r.amount) : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium border ${badgeFor(r.status)}`}>
                            {humanStatus(r.status)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <PaymentStatusBadge summary={r.payment_summary} />
                        </td>
                        <td className="py-3 px-4 text-[rgba(59,88,100,0.70)] text-xs">{formatDate(r.through_date)}</td>
                        <td className="py-3 px-4 text-[rgba(59,88,100,0.70)] text-xs">
                          {r.document_url ? (
                            <span className="inline-flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-nw-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              <a className="text-stone-blue hover:underline" href={r.document_url} target="_blank" rel="noreferrer">
                                View
                              </a>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-nw-danger">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              <span className="text-xs">Missing</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setEditingId(r.id)}
                            className="text-xs text-stone-blue hover:underline"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {editingId && (
        <EditModal
          release={releases.find((r) => r.id === editingId)!}
          onClose={() => setEditingId(null)}
          onSave={(patch) => save(editingId, patch)}
          saving={saving}
        />
      )}
    </>
  );
}

function EditModal({
  release,
  onClose,
  onSave,
  saving,
}: {
  release: LienRelease;
  onClose: () => void;
  onSave: (patch: Partial<LienRelease>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    release_type: release.release_type,
    amount: release.amount ?? 0,
    status: release.status,
    through_date: release.through_date ?? "",
    document_url: release.document_url ?? "",
    notes: release.notes ?? "",
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white border border-[rgba(59,88,100,0.15)] max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg text-slate-tile mb-1">Edit Lien Release</h3>
        <p className="text-sm text-[rgba(59,88,100,0.55)] mb-4">
          {release.vendors?.name ?? "Vendor"} — {release.draws ? `Draw #${release.draws.draw_number}` : "—"}
        </p>
        <div className="space-y-3">
          <Field label="Release Type">
            <select
              className="input"
              value={form.release_type}
              onChange={(e) => setForm({ ...form, release_type: e.target.value })}
            >
              {RELEASE_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>
                  {rt.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount (dollars)">
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.amount / 100}
              onChange={(e) => setForm({ ...form, amount: Math.round(Number(e.target.value) * 100) })}
            />
          </Field>
          <Field label="Status">
            <select
              className="input"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="pending">Pending</option>
              <option value="received">Received</option>
              <option value="waived">Waived</option>
              <option value="not_required">Not Required</option>
            </select>
          </Field>
          <Field label="Through Date">
            <input
              type="date"
              className="input"
              value={form.through_date}
              onChange={(e) => setForm({ ...form, through_date: e.target.value })}
            />
          </Field>
          <Field label="Document URL">
            <input
              type="url"
              className="input"
              placeholder="https://…"
              value={form.document_url}
              onChange={(e) => setForm({ ...form, document_url: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <textarea
              rows={3}
              className="input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-[rgba(59,88,100,0.55)] hover:text-slate-tile text-sm">
            Cancel
          </button>
          <button
            onClick={() =>
              onSave({
                release_type: form.release_type,
                amount: form.amount,
                status: form.status,
                through_date: form.through_date || null,
                document_url: form.document_url || null,
                notes: form.notes || null,
              })
            }
            disabled={saving}
            className="px-4 py-2 bg-slate-deep hover:bg-slate-deeper disabled:opacity-60 text-white text-sm font-medium transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: var(--bg-subtle, #faf7f2);
          border: 1px solid var(--border-default, #e8e0d0);
          color: var(--text-primary, #2b3a42);
          font-size: 14px;
        }
        .input:focus {
          outline: none;
          border-color: var(--org-primary, #3f5862);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-[rgba(59,88,100,0.55)] uppercase tracking-wider mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function humanType(t: string): string {
  return (
    RELEASE_TYPES.find((rt) => rt.value === t)?.label ??
    t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function humanStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function badgeFor(status: string): string {
  if (status === "received") return "bg-transparent text-nw-success border border-nw-success";
  if (status === "pending") return "bg-transparent text-nw-warn border border-nw-warn";
  return "bg-transparent text-[rgba(59,88,100,0.55)] border border-[rgba(59,88,100,0.15)]-light";
}

function PaymentStatusBadge({
  summary,
}: {
  summary: LienRelease["payment_summary"];
}) {
  if (!summary || summary.total_count === 0) {
    return <span className="text-[rgba(59,88,100,0.55)] text-xs">—</span>;
  }
  const { paid_count, total_count } = summary;
  if (paid_count === total_count) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium border border-nw-success text-nw-success">
        Paid {paid_count}/{total_count}
      </span>
    );
  }
  if (paid_count === 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium border border-[rgba(59,88,100,0.15)]-light text-[rgba(59,88,100,0.55)]">
        Unpaid 0/{total_count}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium border border-nw-warn text-nw-warn">
      Partial {paid_count}/{total_count}
    </span>
  );
}
