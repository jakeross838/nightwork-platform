"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/app-shell";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwButton from "@/components/nw/Button";
import type { OrgCostCode, CanonicalCode } from "./page";

interface Props {
  initial: OrgCostCode[];
  canonical: CanonicalCode[];
}

interface Draft {
  id?: string;
  code: string;
  name: string;
  parent_code: string;
  canonical_code_id: string;
  is_active: boolean;
  expected_updated_at?: string;
}

const EMPTY_DRAFT: Draft = {
  code: "",
  name: "",
  parent_code: "",
  canonical_code_id: "",
  is_active: true,
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else if (ch === "\r") {
        // skip
      } else {
        cell += ch;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export default function CodesManager({ initial, canonical }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [codes, setCodes] = useState<OrgCostCode[]>(initial);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const canonicalById = useMemo(() => {
    const m = new Map<string, CanonicalCode>();
    for (const c of canonical) m.set(c.id, c);
    return m;
  }, [canonical]);

  // Typeahead matches against canonical code, name, or full_path.
  const [canonicalFilter, setCanonicalFilter] = useState("");
  const canonicalSuggestions = useMemo(() => {
    const q = canonicalFilter.trim().toLowerCase();
    if (!q) return canonical.slice(0, 12);
    return canonical
      .filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.full_path.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [canonical, canonicalFilter]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return codes
      .filter((c) => (showInactive ? true : c.is_active))
      .filter(
        (c) =>
          !q ||
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.parent_code ?? "").toLowerCase().includes(q)
      );
  }, [codes, search, showInactive]);

  function startEdit(c: OrgCostCode) {
    setEditing({
      id: c.id,
      code: c.code,
      name: c.name,
      parent_code: c.parent_code ?? "",
      canonical_code_id: c.canonical_code_id ?? "",
      is_active: c.is_active,
      expected_updated_at: c.updated_at,
    });
    setCanonicalFilter("");
    setError(null);
  }

  function startNew() {
    setEditing({ ...EMPTY_DRAFT });
    setCanonicalFilter("");
    setError(null);
  }

  async function save() {
    if (!editing) return;
    const payload = {
      code: editing.code.trim(),
      name: editing.name.trim(),
      parent_code: editing.parent_code.trim() || null,
      canonical_code_id: editing.canonical_code_id || null,
      is_active: editing.is_active,
      ...(editing.id ? { expected_updated_at: editing.expected_updated_at } : {}),
    };
    if (!payload.code || !payload.name) {
      setError("code and name are required");
      return;
    }

    setSavingId(editing.id ?? "__new__");
    setError(null);
    try {
      const res = editing.id
        ? await fetch(`/api/cost-intelligence/codes/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/cost-intelligence/codes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `HTTP ${res.status}`);
        return;
      }
      setEditing(null);
      router.refresh();
      // Optimistic local update so the table updates immediately.
      const j = (await res.json()) as { code: OrgCostCode };
      if (editing.id) {
        setCodes((prev) => prev.map((c) => (c.id === editing.id ? j.code : c)));
      } else {
        setCodes((prev) => [...prev, j.code].sort((a, b) => a.code.localeCompare(b.code)));
      }
    } finally {
      setSavingId(null);
    }
  }

  async function softDelete(id: string) {
    if (!confirm("Mark this code inactive? It will no longer appear in pickers but historical references stay intact.")) {
      return;
    }
    setSavingId(id);
    try {
      const res = await fetch(`/api/cost-intelligence/codes/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `HTTP ${res.status}`);
        return;
      }
      setCodes((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: false } : c)));
    } finally {
      setSavingId(null);
    }
  }

  async function importCsv(file: File) {
    setImporting(true);
    setError(null);
    setImportMessage(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setError("CSV is empty");
        return;
      }
      const header = rows[0].map((c) => c.trim().toLowerCase());
      const colIdx = (name: string) => header.indexOf(name);
      const codeIdx = colIdx("code");
      const nameIdx = colIdx("name");
      const parentIdx = colIdx("parent_code");
      const canonicalIdx = colIdx("canonical_code");
      if (codeIdx === -1 || nameIdx === -1) {
        setError("CSV must include columns: code, name (parent_code, canonical_code optional)");
        return;
      }
      const payload = rows.slice(1).map((r) => ({
        code: r[codeIdx]?.trim() ?? "",
        name: r[nameIdx]?.trim() ?? "",
        parent_code: parentIdx === -1 ? null : r[parentIdx]?.trim() || null,
        canonical_code: canonicalIdx === -1 ? null : r[canonicalIdx]?.trim() || null,
      }));

      const res = await fetch("/api/cost-intelligence/codes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: payload, spine: "NAHB" }),
      });
      const j = (await res.json()) as {
        imported?: number;
        inserts?: number;
        updates?: number;
        unmapped_canonical?: string[];
        error?: string;
      };
      if (!res.ok) {
        setError(j.error ?? `HTTP ${res.status}`);
        return;
      }
      const unmapped = j.unmapped_canonical ?? [];
      setImportMessage(
        `Imported ${j.imported ?? 0} (${j.inserts ?? 0} new, ${j.updates ?? 0} updated)` +
          (unmapped.length > 0
            ? ` — ${unmapped.length} canonical codes not found in NAHB: ${unmapped
                .slice(0, 3)
                .join(", ")}${unmapped.length > 3 ? "…" : ""}`
            : "")
      );
      router.refresh();
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto py-8 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <NwEyebrow>COST INTELLIGENCE</NwEyebrow>
            <h1 className="text-3xl font-light mt-2 text-[color:var(--text-primary)]">
              Cost Codes
            </h1>
            <p className="text-sm mt-2 text-[color:var(--text-secondary)] max-w-2xl">
              Your org&apos;s working cost codes. Map each one to a canonical NAHB
              code to enable cross-job pricing intelligence within your org.
              Mapping is optional — codes without a canonical mapping still
              work, they just don&apos;t roll up in cost-intelligence queries.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <NwButton variant="secondary" size="md" onClick={() => fileRef.current?.click()}>
              {importing ? "Importing…" : "Import CSV"}
            </NwButton>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCsv(f);
              }}
            />
            <NwButton variant="primary" size="md" onClick={startNew}>
              + Add code
            </NwButton>
          </div>
        </div>

        {error && (
          <div className="border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] p-3 text-sm text-[color:var(--text-primary)]">
            <strong>Error:</strong> {error}
          </div>
        )}
        {importMessage && (
          <div className="border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] p-3 text-sm text-[color:var(--text-primary)]">
            {importMessage}
          </div>
        )}

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by code, name, parent…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 px-3 flex-1 max-w-sm bg-[color:var(--bg-subtle)] border border-[color:var(--border-default)] text-sm text-[color:var(--text-primary)]"
          />
          <label className="text-xs text-[color:var(--text-secondary)] flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive
          </label>
          <span className="text-xs text-[color:var(--text-tertiary)] ml-auto">
            {visible.length} / {codes.length} shown
          </span>
        </div>

        <div className="border border-[color:var(--border-default)]">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--bg-subtle)] text-[color:var(--text-tertiary)] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Parent</th>
                <th className="px-3 py-2 text-left">Canonical (NAHB)</th>
                <th className="px-3 py-2 text-center">Active</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[color:var(--text-tertiary)]">
                    No codes yet. Add your first code or import from CSV.
                  </td>
                </tr>
              )}
              {visible.map((c) => {
                const canonical = c.canonical_code_id
                  ? canonicalById.get(c.canonical_code_id)
                  : null;
                return (
                  <tr
                    key={c.id}
                    className="border-t border-[color:var(--border-default)] hover:bg-[color:var(--bg-subtle)]"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-[color:var(--text-primary)]">
                      {c.code}
                    </td>
                    <td className="px-3 py-2 text-[color:var(--text-primary)]">{c.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[color:var(--text-secondary)]">
                      {c.parent_code ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-[color:var(--text-secondary)]">
                      {canonical ? (
                        <span title={canonical.full_path}>
                          <span className="font-mono">{canonical.code}</span> {canonical.name}
                        </span>
                      ) : (
                        <span className="text-[color:var(--text-tertiary)]">unmapped</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {c.is_active ? (
                        <NwBadge variant="success" size="sm">Active</NwBadge>
                      ) : (
                        <NwBadge variant="neutral" size="sm">Inactive</NwBadge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        onClick={() => startEdit(c)}
                        disabled={savingId === c.id}
                        className="text-xs text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] underline"
                      >
                        Edit
                      </button>
                      {c.is_active && (
                        <button
                          onClick={() => softDelete(c.id)}
                          disabled={savingId === c.id}
                          className="text-xs text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] underline"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {editing && (
          <EditPanel
            draft={editing}
            saving={savingId !== null}
            canonical={canonical}
            canonicalFilter={canonicalFilter}
            canonicalSuggestions={canonicalSuggestions}
            canonicalById={canonicalById}
            onChange={(d) => setEditing(d)}
            onCanonicalFilterChange={setCanonicalFilter}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        )}
      </div>
    </AppShell>
  );
}

interface EditPanelProps {
  draft: Draft;
  saving: boolean;
  canonical: CanonicalCode[];
  canonicalFilter: string;
  canonicalSuggestions: CanonicalCode[];
  canonicalById: Map<string, CanonicalCode>;
  onChange: (d: Draft) => void;
  onCanonicalFilterChange: (s: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function EditPanel({
  draft,
  saving,
  canonicalSuggestions,
  canonicalById,
  onChange,
  canonicalFilter,
  onCanonicalFilterChange,
  onSave,
  onCancel,
}: EditPanelProps) {
  const selected = draft.canonical_code_id
    ? canonicalById.get(draft.canonical_code_id)
    : null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center p-4">
      <div className="w-full max-w-2xl bg-[color:var(--bg-card)] border border-[color:var(--border-default)] p-6 space-y-4">
        <NwEyebrow>{draft.id ? "EDIT CODE" : "NEW CODE"}</NwEyebrow>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-[color:var(--text-tertiary)] uppercase tracking-wider">
              Code
            </span>
            <input
              type="text"
              value={draft.code}
              onChange={(e) => onChange({ ...draft, code: e.target.value })}
              className="mt-1 w-full h-9 px-3 bg-[color:var(--bg-subtle)] border border-[color:var(--border-default)] text-sm font-mono text-[color:var(--text-primary)]"
              placeholder="e.g. R-PLAS-001"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[color:var(--text-tertiary)] uppercase tracking-wider">
              Name
            </span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
              className="mt-1 w-full h-9 px-3 bg-[color:var(--bg-subtle)] border border-[color:var(--border-default)] text-sm text-[color:var(--text-primary)]"
              placeholder="e.g. Stucco — exterior"
            />
          </label>
          <label className="block col-span-2">
            <span className="text-xs text-[color:var(--text-tertiary)] uppercase tracking-wider">
              Parent code (optional)
            </span>
            <input
              type="text"
              value={draft.parent_code}
              onChange={(e) => onChange({ ...draft, parent_code: e.target.value })}
              className="mt-1 w-full h-9 px-3 bg-[color:var(--bg-subtle)] border border-[color:var(--border-default)] text-sm font-mono text-[color:var(--text-primary)]"
              placeholder="(blank for top-level)"
            />
          </label>
          <div className="col-span-2">
            <span className="text-xs text-[color:var(--text-tertiary)] uppercase tracking-wider">
              Map to canonical NAHB code (optional)
            </span>
            {selected ? (
              <div className="mt-1 flex items-center justify-between border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] px-3 py-2 text-sm">
                <div>
                  <span className="font-mono text-xs">{selected.code}</span>
                  <span className="ml-2 text-[color:var(--text-primary)]">{selected.name}</span>
                  <div className="text-[10px] text-[color:var(--text-tertiary)] mt-0.5">
                    {selected.full_path}
                  </div>
                </div>
                <button
                  onClick={() => onChange({ ...draft, canonical_code_id: "" })}
                  className="text-xs text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] underline"
                >
                  Unmap
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={canonicalFilter}
                  onChange={(e) => onCanonicalFilterChange(e.target.value)}
                  className="mt-1 w-full h-9 px-3 bg-[color:var(--bg-subtle)] border border-[color:var(--border-default)] text-sm text-[color:var(--text-primary)]"
                  placeholder="Type to search NAHB codes (code, name, or path)…"
                />
                {canonicalSuggestions.length > 0 && (
                  <div className="mt-1 max-h-48 overflow-y-auto border border-[color:var(--border-default)]">
                    {canonicalSuggestions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => onChange({ ...draft, canonical_code_id: s.id })}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-[color:var(--bg-subtle)] text-[color:var(--text-primary)]"
                      >
                        <span className="font-mono text-xs">{s.code}</span>
                        <span className="ml-2">{s.name}</span>
                        <div className="text-[10px] text-[color:var(--text-tertiary)] mt-0.5">
                          {s.full_path}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <label className="block col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(e) => onChange({ ...draft, is_active: e.target.checked })}
            />
            <span className="text-sm text-[color:var(--text-primary)]">Active</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <NwButton variant="secondary" size="md" onClick={onCancel} disabled={saving}>
            Cancel
          </NwButton>
          <NwButton variant="primary" size="md" onClick={onSave} loading={saving}>
            {draft.id ? "Save changes" : "Create code"}
          </NwButton>
        </div>
      </div>
    </div>
  );
}
