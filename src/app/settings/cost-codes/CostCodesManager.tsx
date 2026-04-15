"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CostCode } from "./page";

type Draft = {
  id?: string;
  code: string;
  description: string;
  category: string;
  sort_order: number;
  is_change_order: boolean;
};

function csvEscape(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

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

export default function CostCodesManager({ initial }: { initial: CostCode[] }) {
  const router = useRouter();
  const [codes, setCodes] = useState<CostCode[]>(initial);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [importPreview, setImportPreview] = useState<Draft[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return codes;
    return codes.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.category ?? "").toLowerCase().includes(q)
    );
  }, [codes, search]);

  async function refresh() {
    const res = await fetch("/api/cost-codes", { cache: "no-store" });
    if (res.ok) {
      const body = (await res.json()) as { codes: CostCode[] };
      setCodes(body.codes);
    }
  }

  function startAdd() {
    setEditing({ code: "", description: "", category: "", sort_order: 0, is_change_order: false });
  }

  function startEdit(c: CostCode) {
    setEditing({
      id: c.id,
      code: c.code,
      description: c.description,
      category: c.category ?? "",
      sort_order: c.sort_order,
      is_change_order: c.is_change_order,
    });
  }

  async function saveEditing() {
    if (!editing) return;
    setBusy(true);
    setMessage(null);
    try {
      const url = editing.id ? `/api/cost-codes/${editing.id}` : "/api/cost-codes";
      const method = editing.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: editing.code,
          description: editing.description,
          category: editing.category || null,
          sort_order: editing.sort_order,
          is_change_order: editing.is_change_order,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Save failed (${res.status})`);
      }
      setEditing(null);
      setMessage({ kind: "ok", text: "Saved." });
      await refresh();
      router.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  async function deleteOne(id: string) {
    if (!confirm("Delete this cost code? It will be soft-deleted and can be restored via SQL if needed.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cost-codes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setMessage({ kind: "ok", text: "Deleted." });
      await refresh();
      router.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Delete failed" });
    } finally {
      setBusy(false);
    }
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} cost codes? Soft-delete only.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/cost-codes/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: Array.from(selected) }),
      });
      if (!res.ok) throw new Error("Bulk delete failed");
      setSelected(new Set());
      setMessage({ kind: "ok", text: "Bulk delete complete." });
      await refresh();
      router.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Bulk delete failed" });
    } finally {
      setBusy(false);
    }
  }

  async function bulkCategory() {
    if (selected.size === 0) return;
    const category = prompt("New category for selected cost codes (blank to clear):");
    if (category === null) return;
    setBusy(true);
    try {
      const res = await fetch("/api/cost-codes/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "category", ids: Array.from(selected), category: category || null }),
      });
      if (!res.ok) throw new Error("Bulk update failed");
      setSelected(new Set());
      setMessage({ kind: "ok", text: "Category applied." });
      await refresh();
      router.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Bulk update failed" });
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const header = "code,description,category,sort_order,is_change_order";
    const rows = codes
      .map((c) =>
        [
          csvEscape(c.code),
          csvEscape(c.description),
          csvEscape(c.category ?? ""),
          String(c.sort_order),
          c.is_change_order ? "true" : "false",
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([`${header}\n${rows}\n`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cost-codes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) throw new Error("Empty CSV");
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const codeIdx = header.indexOf("code");
      const descIdx = header.indexOf("description");
      if (codeIdx === -1 || descIdx === -1) {
        throw new Error('CSV must include "code" and "description" columns.');
      }
      const catIdx = header.indexOf("category");
      const sortIdx = header.indexOf("sort_order");
      const coIdx = header.indexOf("is_change_order");
      const drafts: Draft[] = rows.slice(1).map((r, i) => ({
        code: r[codeIdx]?.trim() ?? "",
        description: r[descIdx]?.trim() ?? "",
        category: catIdx >= 0 ? r[catIdx]?.trim() ?? "" : "",
        sort_order: sortIdx >= 0 ? Number(r[sortIdx]) || i : i,
        is_change_order: coIdx >= 0 ? /^(true|1|yes|y)$/i.test(r[coIdx] ?? "") : false,
      }));
      setImportPreview(drafts.filter((d) => d.code && d.description));
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Parse failed" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function commitImport() {
    if (!importPreview) return;
    setBusy(true);
    try {
      const res = await fetch("/api/cost-codes/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codes: importPreview }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Import failed");
      }
      const body = await res.json();
      setImportPreview(null);
      setMessage({ kind: "ok", text: `Imported ${body.imported} cost codes.` });
      await refresh();
      router.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Import failed" });
    } finally {
      setBusy(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <input
          type="search"
          placeholder="Search code, description, or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-brand-border bg-white text-sm w-[320px] max-w-full"
        />
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={startAdd}
            className="px-3 py-2 bg-[var(--org-primary)] text-white text-sm"
          >
            + Add Cost Code
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-3 py-2 border border-brand-border text-sm"
          >
            Import CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={exportCsv}
            className="px-3 py-2 border border-brand-border text-sm"
          >
            Export CSV
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-brand-surface border border-brand-border text-sm">
          <span className="text-cream">{selected.size} selected</span>
          <button type="button" onClick={bulkCategory} disabled={busy} className="px-3 py-1 border border-brand-border">
            Change category
          </button>
          <button type="button" onClick={bulkDelete} disabled={busy} className="px-3 py-1 border border-brand-border text-status-danger">
            Delete
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-cream-dim">
            Clear
          </button>
        </div>
      )}

      {message && (
        <p className={`text-xs ${message.kind === "ok" ? "text-status-success" : "text-status-danger"}`}>
          {message.text}
        </p>
      )}

      {importPreview && (
        <div className="border border-brand-border bg-white p-4">
          <h3 className="section-label">Import Preview — {importPreview.length} rows</h3>
          <div className="max-h-[240px] overflow-auto mt-2 text-sm">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-cream-dim">
                  <th className="px-2 py-1">Code</th>
                  <th className="px-2 py-1">Description</th>
                  <th className="px-2 py-1">Category</th>
                  <th className="px-2 py-1">Sort</th>
                  <th className="px-2 py-1">CO?</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.map((d, i) => (
                  <tr key={i} className="border-t border-brand-row-border">
                    <td className="px-2 py-1 font-mono">{d.code}</td>
                    <td className="px-2 py-1">{d.description}</td>
                    <td className="px-2 py-1">{d.category}</td>
                    <td className="px-2 py-1">{d.sort_order}</td>
                    <td className="px-2 py-1">{d.is_change_order ? "✓" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={commitImport}
              disabled={busy}
              className="px-3 py-2 bg-[var(--org-primary)] text-white text-sm"
            >
              {busy ? "Importing…" : "Confirm import"}
            </button>
            <button
              type="button"
              onClick={() => setImportPreview(null)}
              className="px-3 py-2 border border-brand-border text-sm"
            >
              Cancel
            </button>
          </div>
          <p className="mt-2 text-xs text-cream-dim">
            Rows with matching <code>code</code> values will be updated. New codes will be inserted.
          </p>
        </div>
      )}

      {editing && (
        <div className="border border-brand-border bg-white p-4">
          <h3 className="section-label">{editing.id ? "Edit Cost Code" : "New Cost Code"}</h3>
          <div className="grid sm:grid-cols-2 gap-3 mt-2">
            <label className="block">
              <span className="block text-[11px] tracking-[0.08em] uppercase text-cream-dim mb-1">Code</span>
              <input
                value={editing.code}
                onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                className="w-full px-3 py-2 border border-brand-border bg-white text-sm font-mono"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] tracking-[0.08em] uppercase text-cream-dim mb-1">Description</span>
              <input
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="w-full px-3 py-2 border border-brand-border bg-white text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] tracking-[0.08em] uppercase text-cream-dim mb-1">Category</span>
              <input
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                className="w-full px-3 py-2 border border-brand-border bg-white text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] tracking-[0.08em] uppercase text-cream-dim mb-1">Sort Order</span>
              <input
                type="number"
                value={editing.sort_order}
                onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-brand-border bg-white text-sm"
              />
            </label>
            <label className="flex items-center gap-2 sm:col-span-2 text-sm text-cream">
              <input
                type="checkbox"
                checked={editing.is_change_order}
                onChange={(e) => setEditing({ ...editing, is_change_order: e.target.checked })}
              />
              Change-order variant (C-code)
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={saveEditing}
              disabled={busy || !editing.code || !editing.description}
              className="px-3 py-2 bg-[var(--org-primary)] text-white text-sm disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-3 py-2 border border-brand-border text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="border border-brand-border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-surface">
            <tr className="text-left text-[11px] tracking-[0.08em] uppercase text-cream-dim">
              <th className="px-3 py-2 w-8"></th>
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Sort</th>
              <th className="px-3 py-2 font-medium">CO</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-brand-row-border">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleSelect(c.id)}
                  />
                </td>
                <td className="px-3 py-2 font-mono text-cream">{c.code}</td>
                <td className="px-3 py-2 text-cream">{c.description}</td>
                <td className="px-3 py-2 text-cream-dim">{c.category ?? ""}</td>
                <td className="px-3 py-2 text-cream-dim">{c.sort_order}</td>
                <td className="px-3 py-2 text-cream-dim">{c.is_change_order ? "Yes" : ""}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    className="text-xs px-2 py-1 border border-brand-border hover:bg-brand-surface"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteOne(c.id)}
                    className="ml-1 text-xs px-2 py-1 border border-brand-border text-status-danger hover:bg-brand-surface"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-cream-dim text-sm">
                  {search ? "No matching cost codes." : "No cost codes yet. Click + Add or Import CSV."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-cream-dim">
        {filtered.length} of {codes.length} codes shown.
      </p>
    </div>
  );
}
