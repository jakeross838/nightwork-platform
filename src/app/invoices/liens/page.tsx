"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/app-shell";
import FinancialViewTabs from "@/components/financial-view-tabs";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate } from "@/lib/utils/format";
import EmptyState, { EmptyIcons } from "@/components/empty-state";
import { SkeletonList } from "@/components/loading-skeleton";
import { toast } from "@/lib/utils/toast";
import NwBadge, { type BadgeVariant } from "@/components/nw/Badge";
import NwMoney from "@/components/nw/Money";
import NwButton from "@/components/nw/Button";

interface LienRelease {
  id: string;
  vendor_id: string | null;
  amount: number | null;
  release_type: string;
  status: string;
  through_date: string | null;
  document_url: string | null;
  vendors: { id: string; name: string } | null;
  jobs: { id: string; name: string } | null;
  draws: { id: string; draw_number: number; revision_number: number } | null;
}

interface BulkMatch {
  file: string;
  releaseId: string | null;
  vendor: string | null;
  job: string | null;
  amount: number | null;
  matchScore: "exact" | "vendor+amount" | "vendor" | "none";
}

const STATUSES = ["all", "pending", "received", "waived", "not_required"] as const;
type StatusFilter = (typeof STATUSES)[number];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Extract the first $NNN.NN or NNN amount from a filename, if present. */
function extractAmount(filename: string): number | null {
  const match = filename.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2}))/);
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, ""));
  return isFinite(n) ? Math.round(n * 100) : null;
}

export default function BulkLienReleasesPage() {
  const router = useRouter();
  const [releases, setReleases] = useState<LienRelease[] | null>(null);
  const [jobFilter, setJobFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const bulkInput = useRef<HTMLInputElement | null>(null);
  const rowInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkMatch[] | null>(null);

  async function reload() {
    const res = await fetch("/api/lien-releases");
    const data = await res.json();
    setReleases(Array.isArray(data) ? (data as LienRelease[]) : []);
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login?redirect=/invoices/liens"); return; }
      await reload();
    }
    init();
  }, [router]);

  const jobs = useMemo(() => {
    if (!releases) return [];
    const map = new Map<string, string>();
    for (const r of releases) if (r.jobs) map.set(r.jobs.id, r.jobs.name);
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [releases]);

  const filtered = useMemo(() => {
    if (!releases) return [];
    const needle = search.trim().toLowerCase();
    return releases.filter((r) => {
      if (jobFilter && r.jobs?.id !== jobFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (needle) {
        const hay = [r.vendors?.name ?? "", r.jobs?.name ?? "", r.release_type]
          .join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [releases, jobFilter, statusFilter, search]);

  const counts = useMemo(() => {
    const all = filtered;
    return {
      total: all.length,
      pending: all.filter((r) => r.status === "pending").length,
      received: all.filter((r) => r.status === "received").length,
      missingDoc: all.filter((r) => (r.status === "pending" || r.status === "received") && !r.document_url).length,
    };
  }, [filtered]);

  /** Best-match one file to an existing release by vendor + amount. */
  function matchOne(file: File, candidates: LienRelease[]): BulkMatch {
    const nname = normalize(file.name);
    const amount = extractAmount(file.name);

    const byVendor = candidates.filter((r) => {
      const vn = r.vendors?.name;
      if (!vn) return false;
      // Match full normalized vendor name OR first word of vendor name (>=3 chars)
      const nv = normalize(vn);
      if (nv && nname.includes(nv)) return true;
      const first = vn.split(/\s+/)[0] ?? "";
      if (first.length >= 3 && nname.includes(normalize(first))) return true;
      return false;
    });

    if (amount !== null) {
      const exact = byVendor.find((r) => r.amount === amount);
      if (exact) return {
        file: file.name, releaseId: exact.id,
        vendor: exact.vendors?.name ?? null, job: exact.jobs?.name ?? null,
        amount: exact.amount, matchScore: "exact",
      };
      const vendorAmount = byVendor.find((r) => r.amount != null && Math.abs((r.amount ?? 0) - amount) < 1);
      if (vendorAmount) return {
        file: file.name, releaseId: vendorAmount.id,
        vendor: vendorAmount.vendors?.name ?? null, job: vendorAmount.jobs?.name ?? null,
        amount: vendorAmount.amount, matchScore: "vendor+amount",
      };
    }
    if (byVendor.length === 1) {
      const only = byVendor[0];
      return {
        file: file.name, releaseId: only.id,
        vendor: only.vendors?.name ?? null, job: only.jobs?.name ?? null,
        amount: only.amount, matchScore: "vendor",
      };
    }
    return { file: file.name, releaseId: null, vendor: null, job: null, amount: null, matchScore: "none" };
  }

  async function handleBulkUpload(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0 || !releases) return;
    setBulkBusy(true);
    setBulkResults(null);

    // Only match against rows that still need a document.
    const eligible = releases.filter((r) => !r.document_url && (r.status === "pending" || r.status === "received"));
    const results: BulkMatch[] = [];

    for (const f of files) {
      const match = matchOne(f, eligible);
      if (!match.releaseId) {
        results.push(match);
        continue;
      }
      try {
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch(`/api/lien-releases/${match.releaseId}/upload`, { method: "POST", body: fd });
        if (!res.ok) match.matchScore = "none"; // mark as failed so UI shows it
      } catch {
        match.matchScore = "none";
      }
      results.push(match);
    }
    setBulkResults(results);
    await reload();
    setBulkBusy(false);
    const matched = results.filter((r) => r.releaseId).length;
    if (matched > 0) toast.success(`Uploaded ${matched} lien release${matched === 1 ? "" : "s"}`);
    if (matched === 0) toast.error("No files could be matched");
  }

  async function handleSingleUpload(releaseId: string, file: File) {
    setBusyId(releaseId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/lien-releases/${releaseId}/upload`, { method: "POST", body: fd });
      if (res.ok) {
        await reload();
        toast.success("Lien release uploaded");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Upload failed");
      }
    } finally {
      setBusyId(null);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) handleBulkUpload(e.dataTransfer.files);
  }

  return (
    <AppShell>
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <FinancialViewTabs active="liens" />
        <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
          <div>
            <span
              className="block mb-2 text-[10px] uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Financial · Lien Releases
            </span>
            <h2
              className="m-0"
              style={{
                fontFamily: "var(--font-space-grotesk)",
                fontWeight: 500,
                fontSize: "30px",
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
              }}
            >
              Lien Releases
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              All lien releases across every active draw. Drop a stack of signed PDFs below — we&rsquo;ll match each one to a release by vendor and amount.
            </p>
          </div>
        </div>

        {/* Drag-drop bulk upload */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mb-6 border-2 border-dashed p-6 text-center transition-colors ${
            dragOver ? "border-[var(--nw-stone-blue)] bg-[rgba(91,134,153,0.08)]" : "border-[var(--border-default)] bg-[var(--bg-card)]"
          }`}
        >
          <p className="font-display text-[color:var(--text-primary)]">Drop signed lien releases here</p>
          <p className="text-sm text-[color:var(--text-secondary)] mt-1">
            PDFs, JPG/PNG supported. Files are matched to open lien releases by the vendor name and (if present) amount in the filename.
          </p>
          <div className="mt-3">
            <input
              ref={bulkInput}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => e.target.files && handleBulkUpload(e.target.files)}
            />
            <NwButton
              variant="primary"
              size="md"
              onClick={() => bulkInput.current?.click()}
              disabled={bulkBusy || (releases?.length ?? 0) === 0}
              loading={bulkBusy}
            >
              {bulkBusy ? "Uploading" : "Choose files"}
            </NwButton>
          </div>
        </div>

        {bulkResults && (
          <div className="mb-6 bg-[var(--bg-card)] border border-[rgba(91,134,153,0.3)] p-4 text-sm">
            <p className="font-display text-[color:var(--text-primary)] mb-2">Bulk upload results</p>
            <ul className="divide-y divide-[var(--border-default)]">
              {bulkResults.map((r, i) => (
                <li key={i} className="py-2 flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-xs text-[color:var(--text-secondary)] truncate max-w-[320px]">{r.file}</span>
                  {r.releaseId ? (
                    <>
                      <NwBadge
                        variant={
                          r.matchScore === "exact"
                            ? "success"
                            : r.matchScore === "vendor+amount"
                              ? "info"
                              : "warning"
                        }
                        size="sm"
                      >
                        {r.matchScore}
                      </NwBadge>
                      <span className="text-[color:var(--text-primary)]">{r.vendor}</span>
                      <span className="text-[color:var(--text-muted)]">· {r.job}</span>
                      <span className="text-[color:var(--text-secondary)] tabular-nums ml-auto">{r.amount != null ? formatCents(r.amount) : "—"}</span>
                    </>
                  ) : (
                    <span className="text-[color:var(--nw-danger)] text-xs">No vendor match — use per-row upload below</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Summary + filters */}
        {releases === null ? (
          <SkeletonList rows={8} columns={["w-32", "w-32", "w-16", "w-24", "w-20", "w-20", "w-20", "w-16", "w-20"]} />
        ) : releases.length === 0 ? (
          <EmptyState
            icon={<EmptyIcons.Inbox />}
            title="No lien releases yet"
            message="Lien releases auto-generate when a draw is submitted for approval. Submit a draw from a job's Draws tab to start the waiver flow."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Stat label="Total" value={String(counts.total)} />
              <Stat label="Pending" value={String(counts.pending)} />
              <Stat label="Received" value={String(counts.received)} />
              <Stat label="Missing Document" value={String(counts.missingDoc)} highlight={counts.missingDoc > 0} />
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <input
                type="search"
                placeholder="Search vendor, job, or type…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-[240px] px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-secondary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
              />
              <select
                value={jobFilter}
                onChange={(e) => setJobFilter(e.target.value)}
                className="px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
              >
                <option value="">All Jobs</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.name}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? "All Statuses" : s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border-default)] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-default)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-secondary)] font-medium">
                    <th className="text-left px-4 py-3 font-medium">Vendor</th>
                    <th className="text-left px-4 py-3 font-medium">Job</th>
                    <th className="text-left px-4 py-3 font-medium">Draw</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-right px-4 py-3 font-medium">Amount</th>
                    <th className="text-left px-4 py-3 font-medium">Through Date</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Document</th>
                    <th className="text-right px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const missing = !r.document_url && (r.status === "pending" || r.status === "received");
                    return (
                      <tr key={r.id} className="border-b border-[var(--border-default)] last:border-0 hover:bg-[rgba(91,134,153,0.06)]">
                        <td className="px-4 py-3 text-[color:var(--text-primary)]">{r.vendors?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-[color:var(--text-muted)]">
                          {r.jobs ? (
                            <Link href={`/jobs/${r.jobs.id}/lien-releases`} className="hover:text-[color:var(--nw-stone-blue)] hover:underline">
                              {r.jobs.name}
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-[color:var(--text-muted)]">
                          {r.draws ? `#${r.draws.draw_number}${r.draws.revision_number > 0 ? ` Rev ${r.draws.revision_number}` : ""}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-[color:var(--text-muted)] text-xs">
                          {r.release_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <NwMoney cents={r.amount} />
                        </td>
                        <td className="px-4 py-3 text-[color:var(--text-muted)] text-xs">{formatDate(r.through_date)}</td>
                        <td className="px-4 py-3">
                          <NwBadge variant={lienBadgeVariant(r.status)} size="sm">
                            {r.status.replace(/_/g, " ")}
                          </NwBadge>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {r.document_url ? (
                            <a href={r.document_url} target="_blank" rel="noreferrer" className="text-[color:var(--nw-stone-blue)] hover:underline">
                              View
                            </a>
                          ) : missing ? (
                            <span className="text-[color:var(--nw-danger)]">Missing</span>
                          ) : (
                            <span className="text-[color:var(--text-secondary)]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            ref={(el) => { rowInputs.current[r.id] = el; }}
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleSingleUpload(r.id, f);
                              if (rowInputs.current[r.id]) rowInputs.current[r.id]!.value = "";
                            }}
                          />
                          <NwButton
                            variant="secondary"
                            size="sm"
                            onClick={() => rowInputs.current[r.id]?.click()}
                            disabled={busyId === r.id}
                            loading={busyId === r.id}
                          >
                            {busyId === r.id ? "Uploading" : r.document_url ? "Replace" : "Upload"}
                          </NwButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-4">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-secondary)] font-medium font-medium">{label}</p>
      <p className={`text-2xl mt-1 font-display tabular-nums ${highlight ? "text-[color:var(--nw-danger)]" : "text-[color:var(--text-primary)]"}`}>{value}</p>
    </div>
  );
}

function lienBadgeVariant(status: string): BadgeVariant {
  if (status === "received") return "success";
  if (status === "pending") return "warning";
  if (status === "waived") return "neutral";
  return "neutral";
}
