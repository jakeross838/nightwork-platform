"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { ParseResult, ParsedInvoice } from "@/lib/types/invoice";
import { formatDollars, confidenceColor, confidenceLabel } from "@/lib/utils/format";

type FileStatus = {
  file: File;
  objectUrl: string;
  status: "uploading" | "done" | "error";
  result?: ParseResult;
  error?: string;
  saved?: boolean;
  saving?: boolean;
};

const ACCEPTED_EXTENSIONS = ".pdf,.docx,.xlsx,.jpg,.jpeg,.png";
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_MIME_TYPES.includes(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ["pdf", "docx", "xlsx", "jpg", "jpeg", "png"].includes(ext ?? "");
}

function FilePreview({ fileStatus }: { fileStatus: FileStatus }) {
  const { file, objectUrl } = fileStatus;
  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");

  if (isPdf) {
    return (
      <iframe
        src={objectUrl}
        className="w-full h-full min-h-[500px] rounded-lg border border-gray-700"
        title={file.name}
      />
    );
  }

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={objectUrl}
        alt={file.name}
        className="w-full h-auto max-h-[600px] object-contain rounded-lg border border-gray-700"
      />
    );
  }

  return (
    <div className="flex items-center justify-center h-64 rounded-lg border border-gray-700 bg-gray-800/50">
      <div className="text-center">
        <svg className="mx-auto h-16 w-16 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="mt-2 text-sm text-gray-400">{file.name}</p>
        <p className="text-xs text-gray-500">Preview not available for this file type</p>
      </div>
    </div>
  );
}

function ParsedDataCard({ parsed }: { parsed: ParsedInvoice }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${confidenceColor(parsed.confidence_score)}`}>
          {Math.round(parsed.confidence_score * 100)}% — {confidenceLabel(parsed.confidence_score)}
        </span>
      </div>

      {parsed.flags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {parsed.flags.map((flag) => (
            <span key={flag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
              {flag.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Vendor" value={parsed.vendor_name} />
        <Field label="Invoice #" value={parsed.invoice_number} />
        <Field label="Date" value={parsed.invoice_date} />
        <Field label="Type" value={parsed.invoice_type?.replace(/_/g, " ")} />
        <Field label="Job Reference" value={parsed.job_reference} />
        <Field label="PO Reference" value={parsed.po_reference} />
        <Field label="CO Reference" value={parsed.co_reference} />
        <Field label="Vendor Address" value={parsed.vendor_address} />
      </div>

      {parsed.description && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Description</p>
          <p className="text-sm text-gray-300">{parsed.description}</p>
        </div>
      )}

      {parsed.line_items.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Line Items</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left">
                  <th className="py-2 pr-3 text-gray-400 font-medium">Description</th>
                  <th className="py-2 pr-3 text-gray-400 font-medium text-right">Qty</th>
                  <th className="py-2 pr-3 text-gray-400 font-medium">Unit</th>
                  <th className="py-2 pr-3 text-gray-400 font-medium text-right">Rate</th>
                  <th className="py-2 text-gray-400 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {parsed.line_items.map((item, i) => (
                  <tr key={i} className="border-b border-gray-800">
                    <td className="py-2 pr-3 text-gray-300">{item.description}</td>
                    <td className="py-2 pr-3 text-gray-300 text-right">{item.qty ?? "—"}</td>
                    <td className="py-2 pr-3 text-gray-400">{item.unit ?? "—"}</td>
                    <td className="py-2 pr-3 text-gray-300 text-right">{item.rate != null ? formatDollars(item.rate) : "—"}</td>
                    <td className="py-2 text-gray-200 text-right font-medium">{formatDollars(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="border-t border-gray-700 pt-3 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Subtotal</span>
          <span className="text-gray-300">{formatDollars(parsed.subtotal)}</span>
        </div>
        {parsed.tax != null && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Tax</span>
            <span className="text-gray-300">{formatDollars(parsed.tax)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-semibold">
          <span className="text-gray-200">Total</span>
          <span className="text-white">{formatDollars(parsed.total_amount)}</span>
        </div>
      </div>

      {parsed.confidence_details && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Field Confidence</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(parsed.confidence_details).map(([field, score]) => (
              <div key={field} className="flex items-center justify-between text-xs">
                <span className="text-gray-400">{field.replace(/_/g, " ")}</span>
                <span className={`px-1.5 py-0.5 rounded ${confidenceColor(score)}`}>
                  {Math.round(score * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-gray-200 mt-0.5">{value || "—"}</p>
    </div>
  );
}

export default function UploadPage() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (newFiles: File[]) => {
    const accepted = newFiles.filter(isAcceptedFile);
    if (accepted.length === 0) return;

    const newEntries: FileStatus[] = accepted.map((file) => ({
      file,
      objectUrl: URL.createObjectURL(file),
      status: "uploading" as const,
    }));

    setFiles((prev) => [...prev, ...newEntries]);

    await Promise.allSettled(
      newEntries.map(async (entry) => {
        const formData = new FormData();
        formData.append("file", entry.file);

        try {
          const res = await fetch("/api/invoices/parse", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || `HTTP ${res.status}`);
          }

          const result: ParseResult = await res.json();

          setFiles((prev) =>
            prev.map((f) =>
              f.file === entry.file ? { ...f, status: "done" as const, result } : f
            )
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          setFiles((prev) =>
            prev.map((f) =>
              f.file === entry.file ? { ...f, status: "error" as const, error: message } : f
            )
          );
        }
      })
    );
  }, []);

  const saveOne = async (index: number) => {
    const fileStatus = files[index];
    if (!fileStatus.result || fileStatus.saved) return;

    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, saving: true } : f))
    );

    try {
      const res = await fetch("/api/invoices/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fileStatus.result),
      });

      if (res.ok) {
        setFiles((prev) =>
          prev.map((f, i) => (i === index ? { ...f, saving: false, saved: true } : f))
        );
      } else {
        const err = await res.json();
        throw new Error(err.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, saving: false, error: message } : f))
      );
    }
  };

  const saveAll = async () => {
    setSavingAll(true);
    const unsaved = files
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => f.status === "done" && f.result && !f.saved);

    const payload = unsaved.map(({ f }) => f.result);

    try {
      const res = await fetch("/api/invoices/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setFiles((prev) =>
          prev.map((f) =>
            f.status === "done" && f.result && !f.saved ? { ...f, saved: true } : f
          )
        );
      }
    } catch {
      // individual errors handled per-file
    }
    setSavingAll(false);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      processFiles(Array.from(e.dataTransfer.files));
    },
    [processFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(Array.from(e.target.files));
        e.target.value = "";
      }
    },
    [processFiles]
  );

  const parsedUnsaved = files.filter((f) => f.status === "done" && f.result && !f.saved);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">
              &larr; Home
            </Link>
            <h1 className="text-xl font-semibold">Upload Invoices</h1>
          </div>
          <div className="flex items-center gap-3">
            {parsedUnsaved.length > 1 && (
              <button
                onClick={saveAll}
                disabled={savingAll}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {savingAll ? "Saving..." : `Save All & Route (${parsedUnsaved.length})`}
              </button>
            )}
            <Link
              href="/invoices/queue"
              className="px-4 py-2 border border-gray-700 hover:border-gray-500 text-gray-300 text-sm rounded-lg transition-colors"
            >
              View Queue
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragging ? "border-blue-500 bg-blue-500/10" : "border-gray-700 hover:border-gray-500 bg-gray-900/50"
          }`}
        >
          <input ref={inputRef} type="file" multiple accept={ACCEPTED_EXTENSIONS} onChange={handleFileInput} className="hidden" />
          <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="mt-4 text-lg text-gray-300">
            {isDragging ? "Drop files here" : "Drag & drop invoices here"}
          </p>
          <p className="mt-1 text-sm text-gray-500">or click to browse — PDF, DOCX, XLSX, JPG, PNG</p>
        </div>

        {files.length > 0 && (
          <div className="mt-8 space-y-6">
            {files.map((fileStatus, index) => (
              <div key={`${fileStatus.file.name}-${index}`} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
                  {fileStatus.status === "uploading" && (
                    <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  {fileStatus.status === "done" && !fileStatus.saved && (
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                  )}
                  {fileStatus.saved && (
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                  )}
                  {fileStatus.status === "error" && (
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className="text-sm font-medium text-gray-200">{fileStatus.file.name}</span>
                  <span className="text-xs text-gray-500">{(fileStatus.file.size / 1024).toFixed(0)} KB</span>
                  {fileStatus.status === "uploading" && (
                    <span className="text-xs text-blue-400 ml-auto">Parsing with AI...</span>
                  )}
                  {fileStatus.saved && (
                    <span className="text-xs text-blue-400 ml-auto">Saved & routed</span>
                  )}
                  {fileStatus.status === "done" && fileStatus.result && !fileStatus.saved && (
                    <button
                      onClick={() => saveOne(index)}
                      disabled={fileStatus.saving}
                      className="ml-auto px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      {fileStatus.saving ? "Saving..." : "Save & Route"}
                    </button>
                  )}
                </div>

                {fileStatus.status === "error" && (
                  <div className="px-6 py-4">
                    <p className="text-sm text-red-400">{fileStatus.error}</p>
                  </div>
                )}

                {fileStatus.status === "done" && fileStatus.result && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-800">
                    <div className="p-6">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Original Document</p>
                      <FilePreview fileStatus={fileStatus} />
                    </div>
                    <div className="p-6">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">AI Extracted Data</p>
                      <ParsedDataCard parsed={fileStatus.result.parsed} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
