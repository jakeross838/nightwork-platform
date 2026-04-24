"use client";

import { useEffect, useRef, useState } from "react";
import InvoiceAllocationsEditor from "@/components/invoice-allocations-editor";
import AiParsedRawPanel from "@/components/invoices/AiParsedRawPanel";
import { formatCents } from "@/lib/utils/format";

/**
 * Inline combobox used for Job / Cost Code / Purchase Order dropdowns.
 * Moved here from page.tsx during Phase 1 extraction — only used by this form.
 */
function SearchCombobox({ label, value, onChange, options, disabled, aiFilled, grouped, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string; group?: string }[];
  disabled?: boolean; aiFilled?: boolean; grouped?: boolean; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = options.find(o => o.value === value)?.label ?? "";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = options.filter(o =>
    o.value === "" || o.label.toLowerCase().includes(search.toLowerCase())
  );

  const groups = grouped
    ? Array.from(new Set(filtered.filter(o => o.group).map(o => o.group!)))
    : [];

  return (
    <div ref={ref} className="relative">
      <label className="flex items-center gap-2 text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider mb-1.5">
        {label}
        {aiFilled && <AiBadge />}
      </label>
      <div
        className={`flex items-center w-full px-3 py-2.5 bg-[var(--bg-subtle)] border text-sm transition-colors cursor-text ${
          open ? "border-[var(--nw-stone-blue)]" : aiFilled ? "border-[rgba(91,134,153,0.35)]" : "border-[var(--border-default)]"
        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        onClick={() => { setOpen(true); setSearch(""); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        {open ? (
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={selectedLabel || placeholder || "Type to search..."}
            className="flex-1 bg-transparent text-[color:var(--text-primary)] placeholder:text-[color:var(--text-secondary)] outline-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" && filtered.length > 0) {
                const first = filtered.find(o => o.value !== "");
                if (first) { onChange(first.value); setOpen(false); }
              }
            }}
          />
        ) : (
          <span className={`flex-1 truncate ${value ? "text-[color:var(--text-primary)]" : "text-[color:var(--text-secondary)]"}`}>
            {selectedLabel || placeholder || "Select..."}
          </span>
        )}
        {value && !disabled && (
          <button onClick={(e) => { e.stopPropagation(); onChange(""); }} className="ml-2 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <svg className={`w-4 h-4 ml-1 text-[color:var(--text-secondary)] transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto bg-[var(--bg-card)] border border-[var(--border-default)] shadow-2xl">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-[color:var(--text-secondary)] text-center">No matches</div>
          ) : grouped && groups.length > 0 ? (
            groups.map(group => {
              const groupItems = filtered.filter(o => o.group === group);
              if (groupItems.length === 0) return null;
              return (
                <div key={group}>
                  <div className="px-3 py-1.5 text-[10px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider bg-[var(--bg-subtle)] sticky top-0">{group}</div>
                  {groupItems.map(o => (
                    <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-muted)] transition-colors ${o.value === value ? "text-[color:var(--nw-stone-blue)] bg-[rgba(91,134,153,0.08)]" : "text-[color:var(--text-primary)]"}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              );
            })
          ) : (
            filtered.map(o => (
              <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-muted)] transition-colors ${o.value === value ? "text-[color:var(--nw-stone-blue)] bg-[rgba(91,134,153,0.08)]" : o.value === "" ? "text-[color:var(--text-secondary)]" : "text-[color:var(--text-primary)]"}`}>
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AiBadge() {
  return <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold bg-transparent text-[color:var(--nw-stone-blue)] border border-[var(--nw-stone-blue)] normal-case tracking-normal">AI</span>;
}

function FormField({ label, value, onChange, type = "text", disabled, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: "text" | "number" | "date" | "textarea"; disabled?: boolean; placeholder?: string;
}) {
  const base = "w-full px-3 py-2.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-secondary)] focus:border-[var(--nw-stone-blue)] focus:outline-none disabled:opacity-50 transition-colors";
  return (
    <div>
      <label className="flex items-center gap-2 text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider mb-1.5">{label}</label>
      {type === "textarea" ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} rows={3} placeholder={placeholder} className={`${base} resize-none`} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} className={base} />
      )}
    </div>
  );
}

export interface InvoiceDetailsFormCostCode {
  id: string;
  code: string;
  description: string;
  category: string;
  is_change_order: boolean;
}

export interface InvoiceDetailsFormProps {
  // Invoice context (for AllocationsEditor + AiParsedRawPanel)
  invoiceId: string;
  invoiceTotalCents: number;
  invoiceStatus: string;
  vendorNameRaw: string | null;
  jobReferenceRaw: string | null;
  poReferenceRaw: string | null;
  coReferenceRaw: string | null;

  // Review mode
  isReviewable: boolean;

  // Job
  jobId: string;
  onJobIdChange: (v: string) => void;
  jobOptions: { value: string; label: string }[];
  jobAiFilled: boolean;

  // Change Order toggle (side-effects handled in parent)
  isChangeOrder: boolean;
  onChangeOrderToggle: () => void;

  // CO Reference
  coReference: string;
  onCoReferenceChange: (v: string) => void;

  // Cost Code
  costCodeId: string;
  onCostCodeIdChange: (v: string) => void;
  costCodeOptions: { value: string; label: string; group?: string }[];
  costCodeAiFilled: boolean;

  // Allocations editor context
  costCodes: InvoiceDetailsFormCostCode[];

  // Purchase Order
  poOptions: { value: string; label: string }[] | null;
  poId: string;
  onPoIdChange: (v: string) => void;

  // Invoice # / Date / Total / Type / Description
  invoiceNumber: string;
  onInvoiceNumberChange: (v: string) => void;
  invoiceDate: string;
  onInvoiceDateChange: (v: string) => void;
  totalAmount: string;
  onTotalAmountChange: (v: string) => void;
  invoiceType: string;
  onInvoiceTypeChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;

  // Amount-guard indicators
  amountOverAi: boolean;
  amountOver10Pct: boolean;
  amountIncreasePct: number;
  aiParsedTotal: number;
  isCreditMemo: boolean;
}

/**
 * The main editable invoice form body — rendered as a React Fragment so its
 * children become direct siblings under the parent's `mt-5 space-y-4` wrapper,
 * preserving the original spacing with the Line Items section that follows.
 */
export default function InvoiceDetailsForm({
  invoiceId,
  invoiceTotalCents,
  invoiceStatus,
  vendorNameRaw,
  jobReferenceRaw,
  poReferenceRaw,
  coReferenceRaw,
  isReviewable,
  jobId,
  onJobIdChange,
  jobOptions,
  jobAiFilled,
  isChangeOrder,
  onChangeOrderToggle,
  coReference,
  onCoReferenceChange,
  costCodeId,
  onCostCodeIdChange,
  costCodeOptions,
  costCodeAiFilled,
  costCodes,
  poOptions,
  poId,
  onPoIdChange,
  invoiceNumber,
  onInvoiceNumberChange,
  invoiceDate,
  onInvoiceDateChange,
  totalAmount,
  onTotalAmountChange,
  invoiceType,
  onInvoiceTypeChange,
  description,
  onDescriptionChange,
  amountOverAi,
  amountOver10Pct,
  amountIncreasePct,
  aiParsedTotal,
  isCreditMemo,
}: InvoiceDetailsFormProps) {
  return (
    <>
      {/* Job — searchable combobox */}
      <SearchCombobox label="Job" value={jobId} onChange={onJobIdChange}
        options={jobOptions} disabled={!isReviewable}
        aiFilled={jobAiFilled} placeholder="Search jobs..." />

      {/* Change Order toggle — side-effects handled by parent (updates
          cost code + every line between base and C-variant). */}
      <div className="flex items-center gap-3">
        <label className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider">Change Order?</label>
        <button
          onClick={onChangeOrderToggle}
          disabled={!isReviewable}
          className={`relative inline-flex h-6 w-11 items-center transition-colors disabled:opacity-50 ${isChangeOrder ? "bg-[var(--nw-warn)]" : "bg-[var(--border-default)]"}`}
        >
          <span className={`inline-block h-4 w-4 transform bg-white transition-transform ${isChangeOrder ? "translate-x-6" : "translate-x-1"}`} />
        </button>
        <span className="text-xs text-[color:var(--text-secondary)]">{isChangeOrder ? "Yes" : "No"}</span>
      </div>

      {/* CO Reference — only when toggle is on */}
      {isChangeOrder && (
        <FormField label="CO Reference" value={coReference} onChange={onCoReferenceChange}
          disabled={!isReviewable} placeholder="e.g. PCCO #3" />
      )}

      {/* Cost Code — searchable, grouped by category */}
      <SearchCombobox label="Cost Code" value={costCodeId} onChange={onCostCodeIdChange}
        options={costCodeOptions} disabled={!isReviewable}
        aiFilled={costCodeAiFilled} grouped placeholder="Search cost codes..." />

      {/* Phase D: invoice allocation splitter — persists per-line splits
          separately from the invoice-level cost_code default. The id
          `workbench-allocations` is a scroll target for the showcase
          read-only allocation summary above (click any row to jump here). */}
      {invoiceTotalCents != null && invoiceStatus !== "received" && (
        <div id="workbench-allocations" className="scroll-mt-24">
          <InvoiceAllocationsEditor
            invoiceId={invoiceId}
            invoiceTotalCents={invoiceTotalCents}
            costCodes={costCodes}
            readOnly={!isReviewable}
          />
        </div>
      )}

      {poOptions && poOptions.length > 0 && (
        <SearchCombobox label="Purchase Order" value={poId} onChange={onPoIdChange}
          options={poOptions}
          disabled={!isReviewable} placeholder="Select PO..." />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Invoice #" value={invoiceNumber} onChange={onInvoiceNumberChange} disabled={!isReviewable} />
        <FormField label="Invoice Date" value={invoiceDate} onChange={onInvoiceDateChange} type="date" disabled={!isReviewable} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FormField label="Total ($)" value={totalAmount} onChange={onTotalAmountChange} type="number" disabled={!isReviewable} />
          {amountOverAi && !amountOver10Pct && (
            <p className="mt-1.5 text-[11px] text-[color:var(--nw-warn)]">
              +{amountIncreasePct.toFixed(1)}% vs AI-parsed {formatCents(aiParsedTotal)}
            </p>
          )}
          {amountOver10Pct && (
            <p className="mt-1.5 text-[11px] text-[color:var(--nw-danger)] font-medium">
              Warning: +{amountIncreasePct.toFixed(1)}% over AI-parsed {formatCents(aiParsedTotal)} — note required
            </p>
          )}
          {isCreditMemo && (
            <span className="mt-1.5 inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-transparent text-[color:var(--nw-stone-blue)] border border-[var(--nw-stone-blue)]">
              Credit Memo
            </span>
          )}
        </div>
        <div>
          <label className="flex items-center gap-2 text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider mb-1.5">Type</label>
          <select value={invoiceType} onChange={(e) => onInvoiceTypeChange(e.target.value)} disabled={!isReviewable}
            className="w-full px-3 py-2.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none disabled:opacity-50">
            <option value="lump_sum">Lump Sum</option>
            <option value="progress">Progress</option>
            <option value="time_and_materials">Time &amp; Materials</option>
          </select>
        </div>
      </div>

      <FormField label="Description" value={description} onChange={onDescriptionChange} type="textarea" disabled={!isReviewable} />

      {/* Raw AI data */}
      <AiParsedRawPanel
        vendorNameRaw={vendorNameRaw}
        jobReferenceRaw={jobReferenceRaw}
        poReferenceRaw={poReferenceRaw}
        coReferenceRaw={coReferenceRaw}
      />
    </>
  );
}
