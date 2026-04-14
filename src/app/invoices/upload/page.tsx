"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ParseResult, ParsedInvoice } from "@/lib/types/invoice";
import {
  formatDollars, confidenceColor, confidenceLabel,
  formatInvoiceType, formatFlag, formatDocumentType, formatDate,
} from "@/lib/utils/format";
import NavBar from "@/components/nav-bar";

type ParseStep = "uploading" | "analyzing" | "extracting" | "matching" | "complete";

const PARSE_STEPS: { key: ParseStep; label: string }[] = [
  { key: "uploading", label: "Uploading file..." },
  { key: "analyzing", label: "Analyzing document..." },
  { key: "extracting", label: "Extracting invoice data..." },
  { key: "matching", label: "Matching vendor and job..." },
  { key: "complete", label: "Complete" },
];

type FileStatus = {
  file: File;
  objectUrl: string;
  status: "uploading" | "done" | "error";
  parseStep: ParseStep;
  startedAt: number;
  result?: ParseResult;
  error?: string;
  saved?: boolean;
  saving?: boolean;
};

type DuplicateInfo = {
  fileIndex: number;
  existing: {
    id: string;
    vendor_name_raw: string;
    total_amount: number;
    status: string;
  };
};

const ACCEPTED_EXTENSIONS = ".pdf,.docx,.xlsx,.jpg,.jpeg,.png";
const ACCEPTED_MIME_TYPES = [
  "application/pdf", "image/jpeg", "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_MIME_TYPES.includes(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ["pdf", "docx", "xlsx", "jpg", "jpeg", "png"].includes(ext ?? "");
}

function ProgressSteps({ currentStep, startedAt, error }: { currentStep: ParseStep; startedAt: number; error?: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (currentStep === "complete" || error) return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [currentStep, startedAt, error]);

  const currentIdx = PARSE_STEPS.findIndex(s => s.key === currentStep);

  return (
    <div className="px-6 py-5">
      <div className="space-y-2.5">
        {PARSE_STEPS.map((step, i) => {
          const isDone = i < currentIdx || currentStep === "complete";
          const isActive = i === currentIdx && currentStep !== "complete";
          const isPending = i > currentIdx && currentStep !== "complete";

          return (
            <div key={step.key} className={`flex items-center gap-3 transition-opacity duration-300 ${isPending ? "opacity-30" : "opacity-100"}`}>
              {/* Icon */}
              {isDone ? (
                <div className="w-5 h-5 rounded-full bg-status-success/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-status-success" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                </div>
              ) : isActive ? (
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-teal animate-pulse" />
                </div>
              ) : (
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-brand-border" />
                </div>
              )}
              {/* Label */}
              <span className={`text-sm ${isDone ? "text-cream-dim" : isActive ? "text-cream font-medium" : "text-cream-dim"}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      {/* Slow parse warning */}
      {elapsed >= 15 && currentStep !== "complete" && !error && (
        <p className="mt-3 text-xs text-cream-dim animate-fade-up">
          Complex documents take a bit longer — still working...
        </p>
      )}
    </div>
  );
}

function FilePreview({ fileStatus }: { fileStatus: FileStatus }) {
  const { file, objectUrl } = fileStatus;
  if (file.type === "application/pdf") {
    return <iframe src={objectUrl} className="w-full h-full min-h-[500px] rounded-lg border border-brand-border" title={file.name} />;
  }
  if (file.type.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={objectUrl} alt={file.name} className="w-full h-auto max-h-[600px] object-contain rounded-lg border border-brand-border" />;
  }
  return (
    <div className="flex items-center justify-center h-64 rounded-lg border border-brand-border bg-brand-surface">
      <div className="text-center">
        <svg className="mx-auto h-12 w-12 text-cream-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="mt-2 text-sm text-cream-dim">{file.name}</p>
      </div>
    </div>
  );
}

function ParsedDataCard({ parsed }: { parsed: ParsedInvoice }) {
  const isNotInvoice = parsed.document_type && parsed.document_type !== "invoice";
  const allLineItemsZero = parsed.line_items.length > 0 && parsed.line_items.every(i => !i.amount || i.amount === 0);

  // Math mismatch detection (client-side double-check)
  const lineItemsSum = parsed.line_items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const mathMismatchInfo = (() => {
    // Check line items sum vs stated total
    if (parsed.line_items.length > 0 && parsed.total_amount) {
      const diff = Math.abs(lineItemsSum - parsed.total_amount);
      if (diff > 0.01) return { lineItemsSum, statedTotal: parsed.total_amount, difference: diff };
    }
    // Check subtotal vs total (accounting for tax)
    if (parsed.subtotal && parsed.total_amount) {
      const diff = Math.abs(parsed.total_amount - parsed.subtotal - (parsed.tax ?? 0));
      if (diff > 0.01) return { lineItemsSum: parsed.subtotal, statedTotal: parsed.total_amount - (parsed.tax ?? 0), difference: diff };
    }
    return null;
  })();

  return (
    <div className="space-y-4">
      {/* Badges row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${confidenceColor(parsed.confidence_score)}`}>
          {Math.round(parsed.confidence_score * 100)}% — {confidenceLabel(parsed.confidence_score)}
        </span>

        {/* Document type warning */}
        {isNotInvoice && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-status-warning-muted text-brass border border-brass/20">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
            This appears to be a {formatDocumentType(parsed.document_type!)}, not an Invoice
          </span>
        )}

        {/* Math mismatch */}
        {(mathMismatchInfo || parsed.flags.includes("math_mismatch")) && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-status-danger-muted text-status-danger border border-status-danger/20">
            {mathMismatchInfo
              ? `Math Mismatch: Line items sum to ${formatDollars(mathMismatchInfo.lineItemsSum)} but invoice states ${formatDollars(mathMismatchInfo.statedTotal)} — difference of ${formatDollars(mathMismatchInfo.difference)}`
              : "Math Mismatch"}
          </span>
        )}

        {/* Other flags */}
        {parsed.flags.filter(f => f !== "math_mismatch" && f !== "not_an_invoice").map((flag) => (
          <span key={flag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-warning-muted text-brass border border-brass/20">
            {formatFlag(flag)}
          </span>
        ))}
      </div>

      {/* Core Fields */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label="Vendor" value={parsed.vendor_name} />
        <Field label="Invoice #" value={parsed.invoice_number} />
        <Field label="Date" value={formatDate(parsed.invoice_date)} />
        <Field label="Type" value={formatInvoiceType(parsed.invoice_type)} />
        <Field label="Job Reference" value={parsed.job_reference} />
        <Field label="PO Reference" value={parsed.po_reference} />
        {parsed.co_reference && <Field label="CO Reference" value={parsed.co_reference} />}
        {parsed.vendor_address && <Field label="Vendor Address" value={parsed.vendor_address} />}
      </div>

      {/* AI Suggestions */}
      {(parsed.job_suggestion || parsed.cost_code_suggestion) && (
        <div className="space-y-2">
          {parsed.job_suggestion && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl">
              <span className="text-[11px] font-medium text-cream-dim uppercase tracking-wider flex-shrink-0">Suggested Job</span>
              <span className="text-sm text-cream font-medium truncate">
                {parsed.job_suggestion.name}
              </span>
              <span className={`ml-auto flex-shrink-0 px-2 py-0.5 rounded text-xs ${confidenceColor(parsed.job_suggestion.confidence)}`}>
                {Math.round(parsed.job_suggestion.confidence * 100)}%
              </span>
            </div>
          )}
          {parsed.cost_code_suggestion && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl">
              <span className="text-[11px] font-medium text-cream-dim uppercase tracking-wider flex-shrink-0">Suggested Cost Code</span>
              <span className="text-sm text-cream font-medium truncate">
                {parsed.cost_code_suggestion.code} — {parsed.cost_code_suggestion.description}
              </span>
              <span className={`ml-auto flex-shrink-0 px-2 py-0.5 rounded text-xs ${confidenceColor(parsed.cost_code_suggestion.confidence)}`}>
                {Math.round(parsed.cost_code_suggestion.confidence * 100)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {parsed.description && (
        <div>
          <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1">Description</p>
          <p className="text-sm text-cream-muted">{parsed.description}</p>
        </div>
      )}

      {/* Line Items — smart display */}
      {parsed.line_items.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-2">
            {allLineItemsZero ? "Scope Items" : "Line Items"}
          </p>
          {allLineItemsZero ? (
            // Scope-only display: just descriptions, no $0 columns
            <div className="rounded-lg border border-brand-border overflow-hidden">
              {parsed.line_items.map((item, i) => (
                <div key={i} className={`px-3 py-2 text-sm text-cream-muted ${i > 0 ? "border-t border-brand-row-border" : ""}`}>
                  {item.description}
                </div>
              ))}
            </div>
          ) : (
            // Full table with amounts
            <div className="overflow-x-auto rounded-lg border border-brand-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-brand-surface text-left">
                    <th className="py-2 px-3 text-cream-dim font-medium text-xs">Description</th>
                    <th className="py-2 px-3 text-cream-dim font-medium text-xs text-right">Qty</th>
                    <th className="py-2 px-3 text-cream-dim font-medium text-xs">Unit</th>
                    <th className="py-2 px-3 text-cream-dim font-medium text-xs text-right">Rate</th>
                    <th className="py-2 px-3 text-cream-dim font-medium text-xs text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.line_items.map((item, i) => (
                    <tr key={i} className="border-t border-brand-row-border">
                      <td className="py-2 px-3 text-cream-muted">{item.description}</td>
                      <td className="py-2 px-3 text-cream-muted text-right">{item.qty ?? "—"}</td>
                      <td className="py-2 px-3 text-cream-dim">{item.unit ?? "—"}</td>
                      <td className="py-2 px-3 text-cream-muted text-right">{item.rate != null ? formatDollars(item.rate) : "—"}</td>
                      <td className="py-2 px-3 text-cream text-right font-medium">{formatDollars(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Totals */}
      <div className="border-t border-brand-border pt-3 space-y-1.5">
        {parsed.subtotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-cream-dim">Subtotal</span>
            <span className="text-cream-muted">{formatDollars(parsed.subtotal)}</span>
          </div>
        )}
        {parsed.tax != null && parsed.tax > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-cream-dim">Tax</span>
            <span className="text-cream-muted">{formatDollars(parsed.tax)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-semibold pt-1">
          <span className="text-cream">Total</span>
          <span className="text-brass font-display text-lg">{formatDollars(parsed.total_amount)}</span>
        </div>
      </div>

      {/* Field Confidence */}
      {parsed.confidence_details && (
        <div className="pt-2">
          <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-2">Field Confidence</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(parsed.confidence_details).map(([field, score]) => (
              <div key={field} className="flex items-center justify-between text-xs">
                <span className="text-cream-dim">{formatFlag(field)}</span>
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
      <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider">{label}</p>
      <p className="text-sm text-cream mt-0.5">{value || "—"}</p>
    </div>
  );
}

function DuplicateModal({
  duplicate,
  onSaveAnyway,
  onCancel,
  saving,
}: {
  duplicate: DuplicateInfo;
  onSaveAnyway: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const amountDollars = duplicate.existing.total_amount / 100;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-brand-card border border-brand-border rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
        {/* Warning icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-status-warning-muted flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-brass" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
          </div>
          <h3 className="text-lg font-display text-cream">Possible Duplicate Detected</h3>
        </div>

        <p className="text-sm text-cream-muted mb-4">
          An invoice from <span className="font-medium text-cream">{duplicate.existing.vendor_name_raw}</span> for{" "}
          <span className="font-medium text-brass">{formatDollars(amountDollars)}</span> already
          exists in the system.
        </p>

        <div className="bg-brand-surface border border-brand-border rounded-xl px-4 py-3 mb-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-cream-dim">Status</span>
            <span className="text-cream font-medium capitalize">{duplicate.existing.status.replace(/_/g, " ")}</span>
          </div>
        </div>

        <a
          href={`/invoices/${duplicate.existing.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-teal hover:text-teal-hover transition-colors mb-5"
        >
          View existing invoice
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-brand-border text-cream text-sm font-medium rounded-xl hover:bg-brand-surface transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSaveAnyway}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-status-warning-muted text-brass text-sm font-medium rounded-xl hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {saving ? "Saving..." : "Save Anyway"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UploadPage() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [duplicateModal, setDuplicateModal] = useState<DuplicateInfo | null>(null);
  const [duplicateSaving, setDuplicateSaving] = useState(false);
  const duplicateHitRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (newFiles: File[]) => {
    const accepted = newFiles.filter(isAcceptedFile);
    if (accepted.length === 0) return;
    const now = Date.now();
    const newEntries: FileStatus[] = accepted.map((file) => ({
      file, objectUrl: URL.createObjectURL(file), status: "uploading" as const,
      parseStep: "uploading" as ParseStep, startedAt: now,
    }));
    setFiles((prev) => [...prev, ...newEntries]);
    await Promise.allSettled(
      newEntries.map(async (entry) => {
        // Advance through simulated steps on realistic timers
        const advanceStep = (step: ParseStep, delay: number) =>
          new Promise<void>((resolve) => setTimeout(() => {
            setFiles((prev) => prev.map((f) =>
              f.file === entry.file && f.status === "uploading" ? { ...f, parseStep: step } : f
            ));
            resolve();
          }, delay));

        const formData = new FormData();
        formData.append("file", entry.file);

        // Start the fetch and the step timers in parallel
        const fetchPromise = fetch("/api/invoices/parse", { method: "POST", body: formData });

        // Advance steps at realistic intervals (the actual fetch runs in parallel)
        advanceStep("analyzing", 1500);
        advanceStep("extracting", 4000);
        advanceStep("matching", 8000);

        try {
          const res = await fetchPromise;
          if (!res.ok) { const err = await res.json(); throw new Error(err.error || `HTTP ${res.status}`); }
          const result: ParseResult = await res.json();
          setFiles((prev) => prev.map((f) => f.file === entry.file ? { ...f, status: "done" as const, parseStep: "complete" as ParseStep, result } : f));
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          setFiles((prev) => prev.map((f) => f.file === entry.file ? { ...f, status: "error" as const, error: message } : f));
        }
      })
    );
  }, []);

  const saveOne = async (index: number, forceSave = false) => {
    const fs = files[index];
    if (!fs.result || fs.saved) return;
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, saving: true } : f)));
    try {
      const payload = forceSave
        ? { ...fs.result, force_save: true }
        : fs.result;
      const res = await fetch("/api/invoices/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Handle duplicate response
      if (data.duplicate && data.existing) {
        setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, saving: false } : f)));
        duplicateHitRef.current = true;
        setDuplicateModal({ fileIndex: index, existing: data.existing });
        return;
      }

      setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, saving: false, saved: true } : f)));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, saving: false, error: message } : f)));
    }
  };

  const saveAll = async () => {
    setSavingAll(true);
    duplicateHitRef.current = false;
    // Save one at a time so duplicates can be resolved individually
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.status === "done" && f.result && !f.saved && !f.saving) {
        await saveOne(i);
        // If a duplicate was detected, stop batch so user can resolve it
        if (duplicateHitRef.current) break;
      }
    }
    setSavingAll(false);
  };

  const handleDuplicateSaveAnyway = async () => {
    if (!duplicateModal) return;
    setDuplicateSaving(true);
    await saveOne(duplicateModal.fileIndex, true);
    setDuplicateSaving(false);
    setDuplicateModal(null);
  };

  const handleDuplicateCancel = () => {
    setDuplicateModal(null);
  };

  const parsedUnsaved = files.filter((f) => f.status === "done" && f.result && !f.saved);

  return (
    <div className="min-h-screen">
      <NavBar />

      {/* Sub-header with Save All */}
      {parsedUnsaved.length > 1 && (
        <div className="border-b border-brand-border bg-brand-surface/50 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-end">
            <button onClick={saveAll} disabled={savingAll}
              className="px-4 py-2 bg-teal hover:bg-teal-hover disabled:opacity-50 text-brand-bg text-sm font-medium rounded-lg transition-colors">
              {savingAll ? "Saving..." : `Save All & Route (${parsedUnsaved.length})`}
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFiles(Array.from(e.dataTransfer.files)); }}
          onClick={() => inputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-8 md:p-16 text-center cursor-pointer transition-all duration-300 ${
            isDragging ? "border-teal bg-teal/5 shadow-[0_0_40px_-10px_rgba(74,155,142,0.2)]" : "border-brand-border hover:border-brand-border-light bg-brand-surface/30"
          }`}
        >
          <input ref={inputRef} type="file" multiple accept={ACCEPTED_EXTENSIONS}
            onChange={(e) => { if (e.target.files) { processFiles(Array.from(e.target.files)); e.target.value = ""; } }}
            className="hidden" />
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-surface border border-brand-border mb-5">
            <svg className={`w-6 h-6 transition-colors ${isDragging ? "text-teal" : "text-cream-dim"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <p className="text-lg text-cream font-display">{isDragging ? "Drop files here" : <><span className="hidden md:inline">Drag & drop invoices</span><span className="md:hidden">Upload Invoices</span></>}</p>
          <p className="mt-1.5 text-sm text-cream-dim hidden md:block">or click to browse &mdash; PDF, DOCX, XLSX, JPG, PNG</p>
          <button className="mt-4 px-6 py-3 bg-teal hover:bg-teal-hover text-brand-bg font-medium rounded-xl transition-colors md:hidden">Browse Files</button>
        </div>

        {/* Results */}
        {files.length > 0 && (
          <div className="mt-8 space-y-6">
            {files.map((fileStatus, index) => (
              <div key={`${fileStatus.file.name}-${index}`}
                className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden animate-fade-up"
                style={{ animationDelay: `${index * 0.05}s` }}>
                {/* Card Header */}
                <div className="px-6 py-4 border-b border-brand-border flex items-center gap-3">
                  {fileStatus.status === "uploading" && (
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-teal animate-pulse" />
                    </div>
                  )}
                  {fileStatus.status === "done" && !fileStatus.saved && (
                    <div className="w-5 h-5 rounded-full bg-status-success/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-status-success" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </div>
                  )}
                  {fileStatus.saved && (
                    <div className="w-5 h-5 rounded-full bg-teal/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-teal" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </div>
                  )}
                  {fileStatus.status === "error" && (
                    <div className="w-5 h-5 rounded-full bg-status-danger/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-status-danger" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-cream">{fileStatus.file.name}</span>
                    <span className="text-xs text-cream-dim ml-2">{(fileStatus.file.size / 1024).toFixed(0)} KB</span>
                  </div>
                  {fileStatus.saved && <span className="text-xs text-teal flex-shrink-0">Saved &amp; Routed</span>}
                  {fileStatus.status === "done" && fileStatus.result && !fileStatus.saved && (
                    <button onClick={(e) => { e.stopPropagation(); saveOne(index); }} disabled={fileStatus.saving}
                      className="flex-shrink-0 px-4 py-1.5 bg-teal hover:bg-teal-hover disabled:opacity-50 text-brand-bg text-xs font-semibold rounded-lg transition-colors">
                      {fileStatus.saving ? "Saving..." : "Save & Route"}
                    </button>
                  )}
                </div>

                {/* Progress steps while parsing */}
                {fileStatus.status === "uploading" && (
                  <ProgressSteps currentStep={fileStatus.parseStep} startedAt={fileStatus.startedAt} />
                )}

                {/* Error with retry */}
                {fileStatus.status === "error" && (
                  <div className="px-6 py-4 flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-status-danger">Parse failed</p>
                      <p className="text-xs text-status-danger/80 mt-1">{fileStatus.error}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Reset this file to uploading and retry
                        setFiles((prev) => prev.map((f, i) => i === index ? { ...f, status: "uploading" as const, parseStep: "uploading" as ParseStep, startedAt: Date.now(), error: undefined } : f));
                        const formData = new FormData();
                        formData.append("file", fileStatus.file);
                        const advanceStep = (step: ParseStep, delay: number) =>
                          setTimeout(() => {
                            setFiles((prev) => prev.map((f, i) =>
                              i === index && f.status === "uploading" ? { ...f, parseStep: step } : f
                            ));
                          }, delay);
                        advanceStep("analyzing", 1500);
                        advanceStep("extracting", 4000);
                        advanceStep("matching", 8000);
                        fetch("/api/invoices/parse", { method: "POST", body: formData })
                          .then(async (res) => {
                            if (!res.ok) { const err = await res.json(); throw new Error(err.error || `HTTP ${res.status}`); }
                            const result: ParseResult = await res.json();
                            setFiles((prev) => prev.map((f, i) => i === index ? { ...f, status: "done" as const, parseStep: "complete" as ParseStep, result } : f));
                          })
                          .catch((err) => {
                            const message = err instanceof Error ? err.message : "Unknown error";
                            setFiles((prev) => prev.map((f, i) => i === index ? { ...f, status: "error" as const, error: message } : f));
                          });
                      }}
                      className="flex-shrink-0 px-4 py-2 bg-status-danger hover:brightness-110 text-white text-xs font-medium rounded-lg transition-all"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Side-by-side: balanced 50/50 */}
                {fileStatus.status === "done" && fileStatus.result && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-brand-border">
                    <div className="p-5">
                      <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-3">Original Document</p>
                      <FilePreview fileStatus={fileStatus} />
                    </div>
                    <div className="p-5">
                      <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-3">AI Extracted Data</p>
                      <ParsedDataCard parsed={fileStatus.result.parsed} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Duplicate invoice warning modal */}
      {duplicateModal && (
        <DuplicateModal
          duplicate={duplicateModal}
          onSaveAnyway={handleDuplicateSaveAnyway}
          onCancel={handleDuplicateCancel}
          saving={duplicateSaving}
        />
      )}
    </div>
  );
}
