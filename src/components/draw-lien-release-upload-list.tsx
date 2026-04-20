"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { formatCents, formatDate } from "@/lib/utils/format";
import { toast } from "@/lib/utils/toast";

interface Release {
  id: string;
  vendor_id: string | null;
  amount: number | null;
  release_type: string;
  status: string;
  through_date: string | null;
  document_url: string | null;
  vendors: { id: string; name: string } | null;
}

export default function DrawLienReleaseUploadList({
  drawId: _drawId,
  releases,
  onChange,
}: {
  drawId: string;
  releases: Release[];
  onChange: () => void | Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ matched: number; missing: string[] } | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const bulkInput = useRef<HTMLInputElement | null>(null);

  const missingCount = releases.filter(
    (r) => (r.status === "pending" || r.status === "received") && !r.document_url
  ).length;

  async function uploadFor(releaseId: string, file: File) {
    setBusyId(releaseId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/lien-releases/${releaseId}/upload`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        await onChange();
        toast.success("Lien release uploaded");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Upload failed");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function bulkUpload(files: FileList) {
    setBulkBusy(true);
    setBulkResults(null);
    const matched: string[] = [];
    const missing: string[] = [];
    for (const file of Array.from(files)) {
      const lower = file.name.toLowerCase();
      // Match the first release whose vendor name appears in the filename.
      const match = releases.find(
        (r) =>
          r.vendors?.name &&
          lower.includes(r.vendors.name.toLowerCase().replace(/\s+/g, "")) === false
            ? lower.includes(r.vendors.name.toLowerCase())
            : !!r.vendors?.name &&
              lower.includes(r.vendors.name.toLowerCase().replace(/[\s,.]/g, ""))
      );
      const target =
        match ??
        releases.find(
          (r) =>
            r.vendors?.name &&
            lower.includes(
              r.vendors.name.toLowerCase().split(/\s+/)[0]
            )
        );
      if (!target) {
        missing.push(file.name);
        continue;
      }
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/lien-releases/${target.id}/upload`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        matched.push(target.id);
      } else {
        missing.push(file.name);
      }
    }
    setBulkResults({ matched: matched.length, missing });
    await onChange();
    setBulkBusy(false);
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-display text-[color:var(--text-primary)]">Lien Release Documents</p>
          <p className="text-xs text-[color:var(--text-secondary)] mt-0.5">
            Upload signed waivers per vendor. Required for draw approval when{" "}
            <Link className="text-[color:var(--nw-stone-blue)] hover:underline" href="/settings/workflow">
              workflow setting
            </Link>{" "}
            is on.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {missingCount > 0 ? (
            <span className="text-xs text-[color:var(--nw-danger)] font-medium">
              {missingCount} document(s) missing
            </span>
          ) : releases.length > 0 ? (
            <span className="text-xs text-[color:var(--nw-success)]">All documents uploaded</span>
          ) : null}
          <input
            ref={bulkInput}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => e.target.files && bulkUpload(e.target.files)}
          />
          <button
            onClick={() => bulkInput.current?.click()}
            disabled={bulkBusy || releases.length === 0}
            className="px-3 py-1.5 bg-[var(--nw-stone-blue)] hover:bg-[var(--nw-gulf-blue)] disabled:opacity-50 text-white text-sm font-medium"
          >
            {bulkBusy ? "Uploading…" : "Upload All"}
          </button>
        </div>
      </div>

      {bulkResults && (
        <div className="bg-[var(--bg-card)] border border-[rgba(91,134,153,0.3)] p-3 text-sm text-[color:var(--text-primary)] space-y-1">
          <p className="text-[color:var(--nw-success)]">Matched and uploaded {bulkResults.matched} file(s).</p>
          {bulkResults.missing.length > 0 && (
            <p className="text-[color:var(--nw-warn)]">
              Could not match: {bulkResults.missing.join(", ")}. Use the per-row upload to assign
              manually.
            </p>
          )}
        </div>
      )}

      {releases.length === 0 ? (
        <div className="border border-[var(--border-default)] p-6 text-center text-[color:var(--text-secondary)] text-sm">
          No lien releases yet. They auto-generate when this draw is submitted.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[var(--border-default)]">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="bg-[var(--bg-subtle)] text-left">
                <Th>Vendor</Th>
                <Th>Type</Th>
                <Th right>Amount</Th>
                <Th>Status</Th>
                <Th>Through</Th>
                <Th>Document</Th>
                <Th right>Action</Th>
              </tr>
            </thead>
            <tbody>
              {releases.map((r) => {
                const has = !!r.document_url;
                const required = r.status === "pending" || r.status === "received";
                const missing = required && !has;
                return (
                  <tr key={r.id} className="border-t border-[var(--border-default)]">
                    <td className="py-2.5 px-3 text-[color:var(--text-primary)]">{r.vendors?.name ?? "—"}</td>
                    <td className="py-2.5 px-3 text-[color:var(--text-muted)] text-xs">
                      {humanReleaseType(r.release_type)}
                    </td>
                    <td className="py-2.5 px-3 text-[color:var(--text-primary)] text-right font-display">
                      {r.amount != null ? formatCents(r.amount) : "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium border ${badge(r.status)}`}>
                        {r.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[color:var(--text-muted)] text-xs">{formatDate(r.through_date)}</td>
                    <td className="py-2.5 px-3">
                      {has ? (
                        <span className="inline-flex items-center gap-1.5 text-[color:var(--nw-success)]">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <a href={r.document_url!} target="_blank" rel="noreferrer" className="text-xs text-[color:var(--nw-stone-blue)] hover:underline">
                            View
                          </a>
                        </span>
                      ) : missing ? (
                        <span className="inline-flex items-center gap-1.5 text-[color:var(--nw-danger)]">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="text-xs">Missing</span>
                        </span>
                      ) : (
                        <span className="text-[color:var(--text-secondary)] text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        ref={(el) => {
                          fileInputs.current[r.id] = el;
                        }}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadFor(r.id, f);
                        }}
                      />
                      <button
                        onClick={() => fileInputs.current[r.id]?.click()}
                        disabled={busyId === r.id}
                        className="px-2.5 py-1 border border-[var(--border-default)] text-[color:var(--text-primary)] hover:bg-[var(--bg-muted)] disabled:opacity-50 text-xs"
                      >
                        {busyId === r.id ? "Uploading…" : has ? "Replace" : "Upload"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`py-2.5 px-3 text-[10px] text-[color:var(--text-primary)] font-bold uppercase tracking-wider ${
        right ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function badge(status: string): string {
  if (status === "received") return "bg-transparent text-[color:var(--nw-success)] border border-[rgba(74,138,111,0.5)]";
  if (status === "pending") return "bg-transparent text-[color:var(--nw-warn)] border border-[var(--nw-warn)]";
  return "bg-transparent text-[color:var(--text-secondary)] border border-[var(--border-strong)]";
}

function humanReleaseType(t: string): string {
  return t
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
