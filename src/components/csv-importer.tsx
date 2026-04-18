"use client";

import { useMemo, useRef, useState } from "react";

/**
 * Reusable CSV/Excel importer.
 *
 *   <CsvImporter
 *     fields={[
 *       { key: "code", label: "Cost Code", required: true, aliases: ["code","cost_code","number"] },
 *       { key: "description", label: "Description", required: true, aliases: ["description","desc","name"] },
 *     ]}
 *     previewRowCount={10}
 *     validate={(row) => (row.amount && !isFinite(Number(row.amount)) ? "Invalid amount" : null)}
 *     onImport={async (rows) => { ... post to API ... }}
 *   />
 *
 * Steps:
 *   1. User uploads file → rows are parsed (CSV via inline parser, XLSX via
 *      ExcelJS on the server side if needed — see server-side routes that
 *      accept the upload for xlsx).
 *   2. Column mapping UI — auto-map by header name / alias, fall back to
 *      manual dropdowns. Required fields highlighted.
 *   3. Preview first N rows with mapped data and inline validation.
 *   4. Confirm → `onImport` fires with the mapped rows.
 *
 * This is the client-only CSV parser; xlsx uploads call server-side parsing
 * and return already-mapped rows. The component treats both the same way.
 */

export type CsvImportField = {
  key: string;
  label: string;
  required?: boolean;
  aliases?: string[];
  type?: "text" | "number" | "date" | "boolean";
};

export type CsvImportRow = Record<string, string>;

type ValidateRowFn = (row: CsvImportRow) => string | null;

interface CsvImporterProps {
  fields: CsvImportField[];
  previewRowCount?: number;
  validate?: ValidateRowFn;
  onImport: (rows: CsvImportRow[]) => Promise<{ imported?: number; error?: string } | void>;
  importLabel?: string;
  hint?: string;
}

export default function CsvImporter({
  fields,
  previewRowCount = 10,
  validate,
  onImport,
  importLabel = "Import",
  hint,
}: CsvImporterProps) {
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvImportRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({}); // fieldKey -> header
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported?: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    try {
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        const parsed = parseCsv(text);
        if (parsed.length < 2) throw new Error("CSV must contain a header row and at least one data row");
        const hdr = parsed[0].map((h) => h.trim()).filter(Boolean);
        const data = parsed
          .slice(1)
          .filter((r) => r.some((c) => c && c.trim()))
          .map((r) => {
            const obj: CsvImportRow = {};
            hdr.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
            return obj;
          });
        setHeaders(hdr);
        setRows(data);
      } else if (file.name.toLowerCase().endsWith(".xlsx")) {
        // Use the server-side xlsx parser by uploading the file.
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/csv-parse/xlsx", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "xlsx parse failed");
        setHeaders(data.headers as string[]);
        setRows(data.rows as CsvImportRow[]);
      } else {
        throw new Error("Unsupported file format — please upload a .csv or .xlsx file");
      }

      // Auto-map.
      setMapping(autoMap(headers.length > 0 ? headers : [], fields));
      setStep("map");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed");
    }
  }

  // Re-run auto-map whenever headers/fields change (e.g., initial file load).
  useMemoEffect(() => {
    if (headers.length > 0) {
      setMapping(autoMap(headers, fields));
    }
  }, [headers, fields]);

  const preview = useMemo(() => {
    return rows.slice(0, previewRowCount).map((r) => {
      const mapped: CsvImportRow = {};
      for (const f of fields) {
        const col = mapping[f.key];
        mapped[f.key] = col ? (r[col] ?? "") : "";
      }
      return mapped;
    });
  }, [rows, mapping, fields, previewRowCount]);

  const rowValidationErrors = useMemo(() => {
    return preview.map((row) => {
      for (const f of fields) {
        if (f.required && !row[f.key]) return `Missing "${f.label}"`;
        if (f.type === "number" && row[f.key] && !isFinite(Number(String(row[f.key]).replace(/[$,\s]/g, ""))))
          return `Invalid number for "${f.label}": ${row[f.key]}`;
      }
      if (validate) {
        const v = validate(row);
        if (v) return v;
      }
      return null;
    });
  }, [preview, fields, validate]);

  const canContinueMapping = fields.every((f) => !f.required || mapping[f.key]);

  async function doImport() {
    setImporting(true);
    setError(null);
    try {
      // Build mapped rows from all rows (not just preview).
      const mapped: CsvImportRow[] = rows.map((r) => {
        const obj: CsvImportRow = {};
        for (const f of fields) {
          const col = mapping[f.key];
          obj[f.key] = col ? (r[col] ?? "") : "";
        }
        return obj;
      });

      // Skip rows that fail basic required-field validation.
      const valid = mapped.filter((row) => fields.every((f) => !f.required || row[f.key]));
      if (valid.length === 0) throw new Error("No valid rows to import");

      const res = await onImport(valid);
      if (res && "error" in res && res.error) throw new Error(res.error);
      setResult(res ?? { imported: valid.length });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="bg-white border border-border-def p-6">
      {step === "upload" && (
        <div>
          <div
            className="border-2 border-dashed border-border-def p-10 text-center hover:border-stone-blue transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
          >
            <p className="text-slate-tile text-sm">Drop a .csv or .xlsx file, or click to choose</p>
            {hint && <p className="text-[11px] text-tertiary mt-2">{hint}</p>}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
          {error && (
            <p className="text-nw-danger text-sm mt-3">{error}</p>
          )}
        </div>
      )}

      {step === "map" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-slate-tile uppercase tracking-wider">Map Columns</h3>
              <p className="text-[11px] text-tertiary">{fileName} · {rows.length} rows detected</p>
            </div>
            <button
              onClick={reset}
              className="text-[11px] text-tertiary hover:text-slate-tile"
            >
              ← Change file
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            {fields.map((f) => (
              <div key={f.key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="text-sm text-tertiary text-right">
                  {f.label}
                  {f.required && <span className="text-nw-danger">*</span>}
                </div>
                <span className="text-tertiary">→</span>
                <select
                  className="px-2 py-1 bg-bg-sub border border-border-def text-sm text-slate-tile focus:outline-none focus:border-stone-blue"
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                >
                  <option value="">— Skip —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {!canContinueMapping && (
            <p className="text-nw-warn text-xs mb-3">Map all required fields to continue.</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                if (!canContinueMapping) {
                  setError("Map all required fields first.");
                  return;
                }
                setStep("preview");
                setError(null);
              }}
              disabled={!canContinueMapping}
              className="px-4 py-2 bg-slate-deep text-white text-sm hover:bg-slate-deeper disabled:opacity-50 transition-colors"
            >
              Preview →
            </button>
          </div>

          {error && <p className="text-nw-danger text-sm mt-3">{error}</p>}
        </div>
      )}

      {step === "preview" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-slate-tile uppercase tracking-wider">Preview</h3>
              <p className="text-[11px] text-tertiary">
                First {preview.length} of {rows.length} rows · validation {rowValidationErrors.filter((e) => e).length > 0 ? "errors below" : "passed"}
              </p>
            </div>
            <button
              onClick={() => setStep("map")}
              className="text-[11px] text-tertiary hover:text-slate-tile"
            >
              ← Back to mapping
            </button>
          </div>

          <div className="overflow-x-auto border border-border-def">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-bg-sub/50 border-b border-border-def text-[10px] uppercase tracking-wider text-tertiary">
                  <th className="text-left px-2 py-1.5 font-medium">#</th>
                  {fields.map((f) => (
                    <th key={f.key} className="text-left px-2 py-1.5 font-medium">{f.label}</th>
                  ))}
                  <th className="text-left px-2 py-1.5 font-medium">Validation</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className={`border-b border-border-sub last:border-0 ${rowValidationErrors[i] ? "bg-nw-danger/10" : ""}`}>
                    <td className="px-2 py-1 text-tertiary">{i + 1}</td>
                    {fields.map((f) => (
                      <td key={f.key} className="px-2 py-1 text-slate-tile">{r[f.key] || <span className="text-tertiary">—</span>}</td>
                    ))}
                    <td className="px-2 py-1 text-[11px]">
                      {rowValidationErrors[i] ? (
                        <span className="text-nw-danger">{rowValidationErrors[i]}</span>
                      ) : (
                        <span className="text-nw-success">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={doImport}
              disabled={importing}
              className="px-5 py-2 bg-slate-deep text-white text-sm font-medium hover:bg-slate-deeper disabled:opacity-50 transition-colors"
            >
              {importing ? "Importing…" : importLabel}
            </button>
          </div>

          {error && <p className="text-nw-danger text-sm mt-3">{error}</p>}
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-6">
          <p className="text-nw-success text-lg">Import complete</p>
          <p className="text-sm text-tertiary mt-1">
            Imported {result?.imported ?? rows.length} rows.
          </p>
          <button
            onClick={reset}
            className="mt-4 px-4 py-2 border border-border-def text-sm text-slate-tile hover:bg-bg-sub transition-colors"
          >
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Tiny useEffect clone that runs on the same stack as useMemo. Only used
 *  here to re-run auto-mapping when headers change. Inline to avoid a
 *  dependency. */
import { useEffect } from "react";
function useMemoEffect(fn: () => void, deps: unknown[]) {
  useEffect(fn, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

function autoMap(headers: string[], fields: CsvImportField[]): Record<string, string> {
  const out: Record<string, string> = {};
  const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_");
  const normHeaders = headers.map((h) => ({ orig: h, n: norm(h) }));
  for (const f of fields) {
    const keyNorm = norm(f.key);
    const aliasNorm = (f.aliases ?? []).map(norm);
    const candidates = [keyNorm, norm(f.label), ...aliasNorm];
    const found = normHeaders.find((h) => candidates.includes(h.n));
    if (found) out[f.key] = found.orig;
  }
  return out;
}

/** Minimal RFC 4180-ish CSV parser. Handles quoted fields, escaped quotes,
 *  CRLF and LF newlines. Trims rows with all empty cells. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { cur.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && input[i + 1] === "\n") i++;
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}
