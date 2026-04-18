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
      <div className="bg-white border border-[rgba(59,88,100,0.15)] p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-display text-slate-tile">Lien Release Documents</p>
          <p className="text-xs text-[rgba(59,88,100,0.55)] mt-0.5">
            Upload signed waivers per vendor. Required for draw approval when{" "}
            <Link className="text-stone-blue hover:underline" href="/settings/workflow">
              workflow setting
            </Link>{" "}
            is on.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {missingCount > 0 ? (
            <span className="text-xs text-nw-danger font-medium">
              {missingCount} document(s) missing
            </span>
          ) : releases.length > 0 ? (
            <span className="text-xs text-nw-success">All documents uploaded</span>
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
            className="px-3 py-1.5 bg-slate-deep hover:bg-slate-deeper disabled:opacity-50 text-white text-sm font-medium"
          >
            {bulkBusy ? "Uploading…" : "Upload All"}
          </button>
        </div>
      </div>

      {bulkResults && (
        <div className="bg-white border border-stone-blue/30 p-3 text-sm text-slate-tile space-y-1">
          <p className="text-nw-success">Matched and uploaded {bulkResults.matched} file(s).</p>
          {bulkResults.missing.length > 0 && (
            <p className="text-nw-warn">
              Could not match: {bulkResults.missing.join(", ")}. Use the per-row upload to assign
              manually.
            </p>
          )}
        </div>
      )}

      {releases.length === 0 ? (
        <div className="border border-[rgba(59,88,100,0.15)] p-6 text-center text-[rgba(59,88,100,0.55)] text-sm">
          No lien releases yet. They auto-generate when this draw is submitted.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[rgba(59,88,100,0.15)]">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="bg-[rgba(91,134,153,0.06)] text-left">
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
                  <tr key={r.id} className="border-t border-[rgba(59,88,100,0.08)]">
                    <td className="py-2.5 px-3 text-slate-tile">{r.vendors?.name ?? "—"}</td>
                    <td className="py-2.5 px-3 text-[rgba(59,88,100,0.70)] text-xs">
                      {humanReleaseType(r.release_type)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-tile text-right font-display">
                      {r.amount != null ? formatCents(r.amount) : "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium border ${badge(r.status)}`}>
                        {r.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[rgba(59,88,100,0.70)] text-xs">{formatDate(r.through_date)}</td>
                    <td className="py-2.5 px-3">
                      {has ? (
                        <span className="inline-flex items-center gap-1.5 text-nw-success">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <a href={r.document_url!} target="_blank" rel="noreferrer" className="text-xs text-stone-blue hover:underline">
                            View
                          </a>
                        </span>
                      ) : missing ? (
                        <span className="inline-flex items-center gap-1.5 text-nw-danger">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="text-xs">Missing</span>
                        </span>
                      ) : (
                        <span className="text-[rgba(59,88,100,0.55)] text-xs">—</span>
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
                        className="px-2.5 py-1 border border-[rgba(59,88,100,0.15)] text-slate-tile hover:bg-brand-elevated disabled:opacity-50 text-xs"
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
      className={`py-2.5 px-3 text-[10px] text-slate-tile font-bold uppercase tracking-wider ${
        right ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function badge(status: string): string {
  if (status === "received") return "bg-transparent text-nw-success border border-nw-success";
  if (status === "pending") return "bg-transparent text-nw-warn border border-nw-warn";
  return "bg-transparent text-[rgba(59,88,100,0.55)] border border-[rgba(59,88,100,0.15)]-light";
}

function humanReleaseType(t: string): string {
  return t
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
