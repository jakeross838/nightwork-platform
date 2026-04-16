"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/nav-bar";
import { toast } from "@/lib/utils/toast";
import { formatCents, confidenceLabel, confidenceColor } from "@/lib/utils/format";
import { supabase } from "@/lib/supabase/client";

/**
 * Bulk invoice import page — Phase 9.
 * Client-driven sequential processing: after files upload, the client polls
 * POST /parse-next one invoice at a time so we never hit Claude's rate limit.
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXT = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".docx"];

type ImportStatus =
  | "import_queued"
  | "import_parsing"
  | "import_parsed"
  | "import_error"
  | "import_duplicate"
  | "pm_review"
  | "qa_review"
  | "ai_processed"
  | "pm_approved";

interface ImportRow {
  id: string;
  status: ImportStatus | string;
  original_filename: string | null;
  original_file_type: string | null;
  vendor_name_raw: string | null;
  vendor_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total_amount: number | null;
  confidence_score: number | null;
  job_id: string | null;
  duplicate_of_id: string | null;
  import_error: string | null;
  jobs: { id: string; name: string } | null;
  vendors: { id: string; name: string } | null;
}

interface BatchSummary {
  id: string;
  status: string;
  total_files: number;
  parsed_count: number;
  error_count: number;
  duplicate_count: number;
  sent_to_queue_count: number;
  created_at: string;
  completed_at: string | null;
}

interface JobOption {
  id: string;
  name: string;
}

export default function ImportPage() {
  const [batchId, setBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [batch, setBatch] = useState<BatchSummary | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [assignJobId, setAssignJobId] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cancelledRef = useRef(false);

  // Load jobs for the assign dropdown
  useEffect(() => {
    supabase
      .from("jobs")
      .select("id, name")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name")
      .then(({ data }) => {
        if (data) setJobs(data as JobOption[]);
      });
  }, []);

  const refreshBatch = useCallback(async () => {
    if (!batchId) return;
    try {
      const res = await fetch(`/api/invoices/import/${batchId}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setBatch(json.batch);
      setRows(json.invoices ?? []);
    } catch (err) {
      console.error("refreshBatch", err);
    }
  }, [batchId]);

  // Load an existing batch via ?batch=<id> URL param (used for "resume batch"
  // links and, during dogfood, for reviewing imports in progress).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const id = url.searchParams.get("batch");
    if (id && !batchId) setBatchId(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh once when batchId is set (either from upload or URL param)
  useEffect(() => {
    if (batchId) void refreshBatch();
  }, [batchId, refreshBatch]);

  // Poll while parsing is happening
  useEffect(() => {
    if (!batchId || !parsing) return;
    const interval = setInterval(refreshBatch, 1500);
    return () => clearInterval(interval);
  }, [batchId, parsing, refreshBatch]);

  const validateFiles = (files: File[]): { ok: File[]; errors: string[] } => {
    const ok: File[] = [];
    const errors: string[] = [];
    for (const f of files) {
      const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
      if (!ACCEPTED_EXT.includes(ext)) {
        errors.push(`${f.name}: unsupported type (${ext})`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        errors.push(
          `${f.name}: ${(f.size / 1024 / 1024).toFixed(1)}MB exceeds 10MB limit`
        );
        continue;
      }
      ok.push(f);
    }
    return { ok, errors };
  };

  const startImport = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const { ok, errors } = validateFiles(files);
      if (errors.length > 0) {
        toast.error(`${errors.length} file(s) rejected: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ""}`);
      }
      if (ok.length === 0) return;

      setUploading(true);
      try {
        const fd = new FormData();
        for (const f of ok) fd.append("files", f);
        const res = await fetch("/api/invoices/import/upload", {
          method: "POST",
          body: fd,
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "Upload failed");
          setUploading(false);
          return;
        }
        setBatchId(json.batch_id);
        setUploading(false);
        setParsing(true);
        cancelledRef.current = false;
        // Kick off sequential parsing
        void runParseLoop(json.batch_id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
        setUploading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  async function runParseLoop(id: string) {
    // Process files sequentially until none are queued. Each call returns
    // `{ done: true }` when nothing's left.
    while (!cancelledRef.current) {
      try {
        const res = await fetch(`/api/invoices/import/${id}/parse-next`, {
          method: "POST",
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          if (json?.error) toast.error(`Parse issue: ${json.error}`);
          break;
        }
        const json = await res.json();
        if (json.done) break;
        // Force a refresh so the table shows the new status immediately.
        await refreshBatch();
      } catch (err) {
        console.error("parse-next", err);
        break;
      }
    }
    setParsing(false);
    await refreshBatch();
  }

  const onDropFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (parsing || uploading) {
        toast.error("Wait for current batch to finish before starting another.");
        return;
      }
      void startImport(files);
    },
    [parsing, uploading, startImport]
  );

  // --- Bulk actions ---
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    const parsedIds = rows
      .filter((r) => r.status === "import_parsed" || r.status === "import_duplicate")
      .map((r) => r.id);
    if (selected.size === parsedIds.length) setSelected(new Set());
    else setSelected(new Set(parsedIds));
  };

  const doBulkAssign = async () => {
    if (!batchId || !assignJobId || selected.size === 0) return;
    const res = await fetch(`/api/invoices/import/${batchId}/bulk-assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice_ids: Array.from(selected), job_id: assignJobId }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Assign failed");
      return;
    }
    toast.success(`Assigned job to ${json.updated} invoices`);
    setSelected(new Set());
    setAssignJobId("");
    await refreshBatch();
  };

  const doSendToQueue = async () => {
    if (!batchId) return;
    if (!confirm(`Send ${counts.parsed} parsed invoices to the approval queue?`)) return;
    const res = await fetch(`/api/invoices/import/${batchId}/send-to-queue`, {
      method: "POST",
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Send failed");
      return;
    }
    toast.success(`Sent ${json.promoted} invoices to approval queue`);
    await refreshBatch();
  };

  const doDeleteErrors = async () => {
    if (!batchId || counts.errors === 0) return;
    if (!confirm(`Delete ${counts.errors} errored files? This cannot be undone from the UI.`)) return;
    const res = await fetch(`/api/invoices/import/${batchId}/delete-errors`, {
      method: "POST",
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Delete failed");
      return;
    }
    toast.success(`Deleted ${json.deleted} errored files`);
    await refreshBatch();
  };

  const counts = useMemo(() => {
    const c = {
      total: rows.length,
      queued: 0,
      parsing: 0,
      parsed: 0,
      errors: 0,
      duplicates: 0,
      sent: 0,
    };
    for (const r of rows) {
      if (r.status === "import_queued") c.queued += 1;
      else if (r.status === "import_parsing") c.parsing += 1;
      else if (r.status === "import_parsed") c.parsed += 1;
      else if (r.status === "import_error") c.errors += 1;
      else if (r.status === "import_duplicate") c.duplicates += 1;
      else c.sent += 1;
    }
    return c;
  }, [rows]);

  const done = !parsing && (batch?.status === "complete" || batch?.status === "partial");

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 md:px-6 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="text-xs tracking-[0.15em] uppercase text-cream-dim">
              Invoices
            </div>
            <h1 className="font-display text-3xl text-cream mt-1">Bulk Import</h1>
            <p className="text-sm text-cream-dim mt-1">
              Drop PDFs, DOCX, or images. Up to 50 files, 10MB each. Parsing is sequential to respect AI rate limits.
            </p>
          </div>
          <Link
            href="/invoices"
            className="text-sm text-cream-dim hover:text-cream"
          >
            ← Back to invoices
          </Link>
        </div>

        {/* Dropzone */}
        <DropZone
          onFiles={onDropFiles}
          dragOver={dragOver}
          setDragOver={setDragOver}
          disabled={uploading || parsing}
          onClick={() => fileInputRef.current?.click()}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXT.join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onDropFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Status / progress card */}
        {batch && (
          <section className="mt-8 border border-brand-border bg-brand-surface">
            <header className="px-5 py-4 border-b border-brand-border flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.1em] text-cream-dim">
                  Batch
                </div>
                <div className="text-cream font-medium">
                  {counts.parsed + counts.errors + counts.duplicates + counts.sent} of {batch.total_files} processed
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Stat label="Parsed" value={counts.parsed} tone="ok" />
                <Stat label="Duplicates" value={counts.duplicates} tone="warn" />
                <Stat label="Errors" value={counts.errors} tone="err" />
                <Stat label="Sent" value={counts.sent} tone="muted" />
              </div>
            </header>

            {/* Progress bar */}
            <div className="h-1 bg-brand-border">
              <div
                className="h-full bg-teal transition-all duration-500"
                style={{
                  width: `${
                    batch.total_files > 0
                      ? Math.round(
                          ((counts.parsed + counts.errors + counts.duplicates + counts.sent) /
                            batch.total_files) *
                            100
                        )
                      : 0
                  }%`,
                }}
              />
            </div>

            {/* Actions toolbar */}
            <div className="px-5 py-3 bg-brand-bg/40 border-b border-brand-border flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={doSendToQueue}
                disabled={!done || counts.parsed === 0}
                className="px-4 py-2 bg-teal text-white text-xs tracking-[0.08em] uppercase hover:bg-teal-hover disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send {counts.parsed} to Approval Queue
              </button>
              <button
                type="button"
                onClick={doDeleteErrors}
                disabled={!done || counts.errors === 0}
                className="px-4 py-2 border border-brand-border text-xs tracking-[0.08em] uppercase text-cream hover:bg-brand-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Delete {counts.errors} Errors
              </button>
              <div className="flex-1" />
              {selected.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-cream-dim">
                    {selected.size} selected
                  </span>
                  <select
                    value={assignJobId}
                    onChange={(e) => setAssignJobId(e.target.value)}
                    className="px-2 py-1.5 bg-brand-bg border border-brand-border text-xs text-cream"
                  >
                    <option value="">Assign job…</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={doBulkAssign}
                    disabled={!assignJobId}
                    className="px-3 py-1.5 bg-brass text-bg-dark text-xs tracking-[0.08em] uppercase hover:bg-brass/90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>

            {/* Rows table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.1em] text-cream-dim border-b border-brand-border">
                  <th className="px-4 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={
                        selected.size > 0 &&
                        selected.size ===
                          rows.filter(
                            (r) => r.status === "import_parsed" || r.status === "import_duplicate"
                          ).length
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Vendor</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Job Match</th>
                  <th className="px-3 py-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <RowView
                    key={r.id}
                    row={r}
                    selected={selected.has(r.id)}
                    onToggle={() => toggleSelect(r.id)}
                  />
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}

// ============================================================

function DropZone({
  onFiles,
  dragOver,
  setDragOver,
  disabled,
  onClick,
}: {
  onFiles: (files: FileList) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!disabled && e.dataTransfer.files) onFiles(e.dataTransfer.files);
      }}
      className={`cursor-pointer border border-dashed transition-all ${
        dragOver
          ? "border-teal bg-teal/5"
          : "border-brand-border hover:border-brand-border-hover bg-brand-surface/50"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""} px-8 py-12 text-center`}
    >
      <svg
        className="w-10 h-10 mx-auto text-cream-dim mb-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
      <div className="text-cream font-medium">
        {disabled ? "Processing…" : "Drop invoices here or click to browse"}
      </div>
      <div className="text-xs text-cream-dim mt-1">
        PDF, DOCX, or image · up to 50 files · 10MB each
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "err" | "muted";
}) {
  const color =
    tone === "ok"
      ? "text-status-success"
      : tone === "warn"
      ? "text-brass"
      : tone === "err"
      ? "text-status-danger"
      : "text-cream-dim";
  return (
    <div className="text-center">
      <div className={`text-lg ${color} font-medium`}>{value}</div>
      <div className="text-[10px] uppercase tracking-[0.1em] text-cream-dim">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: string }> = {
    import_queued: { label: "Queued", tone: "bg-brand-border/50 text-cream-dim" },
    import_parsing: { label: "Parsing…", tone: "bg-teal/20 text-teal" },
    import_parsed: { label: "Parsed", tone: "bg-status-success/20 text-status-success" },
    import_error: { label: "Error", tone: "bg-status-danger/20 text-status-danger" },
    import_duplicate: { label: "Duplicate", tone: "bg-brass/20 text-brass" },
    pm_review: { label: "Sent → PM", tone: "bg-cream/10 text-cream-dim" },
    qa_review: { label: "Sent → QA", tone: "bg-cream/10 text-cream-dim" },
  };
  const v = map[status] ?? { label: status, tone: "bg-brand-border/30 text-cream-dim" };
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${v.tone}`}>
      {v.label}
    </span>
  );
}

function RowView({
  row,
  selected,
  onToggle,
}: {
  row: ImportRow;
  selected: boolean;
  onToggle: () => void;
}) {
  const canSelect =
    row.status === "import_parsed" || row.status === "import_duplicate";
  return (
    <tr className="border-b border-brand-border/40 hover:bg-brand-surface-hover/30">
      <td className="px-4 py-2">
        <input
          type="checkbox"
          checked={selected}
          disabled={!canSelect}
          onChange={onToggle}
        />
      </td>
      <td className="px-3 py-2">
        <div className="text-cream text-sm truncate max-w-[320px]" title={row.original_filename ?? ""}>
          {row.original_filename ?? "—"}
        </div>
        {row.import_error && (
          <div className="text-[11px] text-status-danger mt-0.5 truncate max-w-[320px]" title={row.import_error}>
            {row.import_error}
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-3 py-2 text-cream-dim text-sm">
        {row.vendor_name_raw ?? (row.status === "import_queued" || row.status === "import_parsing" ? "…" : "—")}
      </td>
      <td className="px-3 py-2 text-right text-cream-dim text-sm">
        {row.total_amount && row.total_amount > 0 ? formatCents(row.total_amount) : "—"}
      </td>
      <td className="px-3 py-2 text-sm">
        {row.jobs?.name ? (
          <span className="text-cream">{row.jobs.name}</span>
        ) : row.status === "import_parsed" ? (
          <span className="text-brass text-xs">Unmatched — assign</span>
        ) : (
          <span className="text-cream-dim">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-sm">
        {row.confidence_score && row.confidence_score > 0 ? (
          <span className={confidenceColor(row.confidence_score)}>
            {Math.round(row.confidence_score * 100)}% — {confidenceLabel(row.confidence_score)}
          </span>
        ) : (
          <span className="text-cream-dim">—</span>
        )}
      </td>
    </tr>
  );
}
