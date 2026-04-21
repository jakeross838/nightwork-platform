"use client";

import { useCallback, useEffect, useState } from "react";
import NwButton from "@/components/nw/Button";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwMoney from "@/components/nw/Money";
import { toast } from "@/lib/utils/toast";
import type {
  ItemType,
  ItemUnit,
  ProposedItemData,
} from "@/lib/cost-intelligence/types";
import type { ExtractionLineView } from "./extraction-verification-panel";

interface Props {
  line: ExtractionLineView;
  onClose: () => void;
  onSaved: () => void;
}

const ITEM_TYPES: ItemType[] = [
  "material",
  "labor",
  "equipment",
  "service",
  "subcontract",
  "other",
];

const UNITS: ItemUnit[] = [
  "each",
  "sf",
  "lf",
  "sy",
  "cy",
  "lb",
  "gal",
  "hr",
  "day",
  "lump_sum",
  "pkg",
  "box",
];

type Mode = "pick_existing" | "edit_new";

interface ItemSearchResult {
  id: string;
  canonical_name: string;
  item_type: string;
  category: string | null;
  unit: string;
}

export default function LineCorrectionModal({ line, onClose, onSaved }: Props) {
  const initialProposed = line.proposed_item_data;
  const [mode, setMode] = useState<Mode>(
    line.proposed_item?.id || line.verified_item?.id ? "pick_existing" : "edit_new"
  );

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ItemSearchResult[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    line.verified_item?.id ?? line.proposed_item?.id ?? null
  );
  const [searching, setSearching] = useState(false);

  const [canonicalName, setCanonicalName] = useState(initialProposed?.canonical_name ?? "");
  const [itemType, setItemType] = useState<ItemType>(initialProposed?.item_type ?? "other");
  const [category, setCategory] = useState(initialProposed?.category ?? "");
  const [subcategory, setSubcategory] = useState(initialProposed?.subcategory ?? "");
  const [unit, setUnit] = useState<ItemUnit>(initialProposed?.unit ?? "each");
  const [specsText, setSpecsText] = useState(
    JSON.stringify(initialProposed?.specs ?? {}, null, 2)
  );

  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const res = await fetch(`/api/cost-intelligence/items?q=${encodeURIComponent(q)}&limit=20`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = await res.json();
      setResults(json.items ?? []);
    } catch (err) {
      console.warn("Item search failed", err);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (mode === "pick_existing") void runSearch(query);
    }, 300);
    return () => clearTimeout(t);
  }, [query, mode, runSearch]);

  // Initial load
  useEffect(() => {
    if (mode === "pick_existing") void runSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      let body: {
        action: "correct";
        corrected_item_id?: string;
        corrected_proposed_data?: ProposedItemData;
        correction_notes?: string;
      } = { action: "correct", correction_notes: notes || undefined };

      if (mode === "pick_existing") {
        if (!selectedItemId) {
          toast.error("Select an item first");
          return;
        }
        body = { ...body, corrected_item_id: selectedItemId };
      } else {
        let parsedSpecs: Record<string, unknown> = {};
        try {
          parsedSpecs = JSON.parse(specsText || "{}");
        } catch {
          toast.error("Specs JSON is invalid");
          return;
        }
        if (!canonicalName.trim()) {
          toast.error("Canonical name is required");
          return;
        }
        body = {
          ...body,
          corrected_proposed_data: {
            canonical_name: canonicalName.trim(),
            item_type: itemType,
            category: category.trim() || null,
            subcategory: subcategory.trim() || null,
            specs: parsedSpecs,
            unit,
          },
        };
      }

      const res = await fetch(`/api/cost-intelligence/lines/${line.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Status ${res.status}`);
      }

      toast.success("Correction saved — line committed to spine");
      onSaved();
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setSaving(false);
    }
  }, [mode, selectedItemId, canonicalName, itemType, category, subcategory, unit, specsText, notes, line.id, onSaved]);

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(26,40,48,0.6)] flex items-center justify-center p-4">
      <div className="max-w-[900px] w-full max-h-[90vh] overflow-auto bg-[var(--bg-card)] border border-[var(--border-default)]">
        <div className="p-5 border-b border-[var(--border-default)] flex items-start justify-between gap-4">
          <div>
            <NwEyebrow tone="accent">Correct classification</NwEyebrow>
            <h3
              className="mt-2 text-[20px] tracking-[-0.02em] text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Line verification
            </h3>
          </div>
          <NwButton variant="ghost" size="sm" onClick={onClose}>
            Close
          </NwButton>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5">
          {/* LEFT: raw evidence (read-only) */}
          <div className="space-y-3">
            <NwEyebrow tone="muted">Raw from invoice</NwEyebrow>
            <div className="border border-[var(--border-default)] p-3">
              <p
                className="text-[13px] text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                {line.raw_description}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-[var(--text-tertiary)]">
                <div>
                  <div className="uppercase tracking-[0.14em]" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>qty</div>
                  <div className="mt-0.5 text-[var(--text-secondary)]" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                    {line.raw_quantity ?? "—"} {line.raw_unit_text ?? ""}
                  </div>
                </div>
                <div>
                  <div className="uppercase tracking-[0.14em]" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>unit</div>
                  <NwMoney cents={line.raw_unit_price_cents} size="sm" />
                </div>
                <div>
                  <div className="uppercase tracking-[0.14em]" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>total</div>
                  <NwMoney cents={line.raw_total_cents} size="sm" variant="emphasized" />
                </div>
              </div>
            </div>

            <NwEyebrow tone="muted">AI proposal</NwEyebrow>
            <div className="border border-[var(--border-default)] p-3 text-[12px] text-[var(--text-secondary)]">
              <p className="text-[var(--text-primary)] font-medium">
                {line.proposed_item?.canonical_name ??
                  line.proposed_item_data?.canonical_name ??
                  "(none)"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {line.match_tier && (
                  <NwBadge variant="info" size="sm">
                    {line.match_tier.replace(/_/g, " ")}
                  </NwBadge>
                )}
                {line.match_confidence != null && (
                  <NwBadge variant="neutral" size="sm">
                    {Math.round(line.match_confidence * 100)}%
                  </NwBadge>
                )}
              </div>
              {line.match_reasoning && (
                <p className="mt-2 italic text-[var(--text-tertiary)]">{line.match_reasoning}</p>
              )}
            </div>

            {Array.isArray(line.candidates_considered) && line.candidates_considered.length > 0 && (
              <>
                <NwEyebrow tone="muted">Candidates AI weighed</NwEyebrow>
                <ul className="border border-[var(--border-default)] divide-y divide-[var(--border-default)]">
                  {line.candidates_considered.slice(0, 5).map((c, i) => (
                    <li key={i} className="p-2 text-[11px] text-[var(--text-secondary)]">
                      <div className="text-[var(--text-primary)]">{c.canonical_name}</div>
                      {c.rejected_reason && (
                        <div className="mt-0.5 italic text-[var(--text-tertiary)]">
                          {c.rejected_reason}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* RIGHT: editable correction */}
          <div className="space-y-3">
            <NwEyebrow tone="accent">Your correction</NwEyebrow>

            <div className="flex items-center gap-2 text-[11px]">
              <button
                type="button"
                className={`px-3 h-[30px] border ${
                  mode === "pick_existing"
                    ? "bg-nw-stone-blue text-nw-white-sand border-nw-stone-blue"
                    : "border-[var(--border-default)] text-[var(--text-primary)]"
                } uppercase tracking-[0.12em]`}
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                onClick={() => setMode("pick_existing")}
              >
                Pick existing
              </button>
              <button
                type="button"
                className={`px-3 h-[30px] border ${
                  mode === "edit_new"
                    ? "bg-nw-stone-blue text-nw-white-sand border-nw-stone-blue"
                    : "border-[var(--border-default)] text-[var(--text-primary)]"
                } uppercase tracking-[0.12em]`}
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                onClick={() => setMode("edit_new")}
              >
                Create / edit new
              </button>
            </div>

            {mode === "pick_existing" ? (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search items…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
                />
                <div className="border border-[var(--border-default)] max-h-[300px] overflow-auto divide-y divide-[var(--border-default)]">
                  {searching ? (
                    <p className="p-3 text-[12px] text-[var(--text-tertiary)]">Searching…</p>
                  ) : results.length === 0 ? (
                    <p className="p-3 text-[12px] text-[var(--text-tertiary)]">No matches.</p>
                  ) : (
                    results.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedItemId(r.id)}
                        className={`w-full text-left p-2 text-[12px] transition-colors hover:bg-[var(--bg-subtle)] ${
                          selectedItemId === r.id ? "bg-[var(--bg-subtle)]" : ""
                        }`}
                      >
                        <div className="text-[var(--text-primary)] font-medium">
                          {r.canonical_name}
                        </div>
                        <div className="mt-0.5 text-[var(--text-tertiary)]">
                          {r.item_type}
                          {r.category ? ` · ${r.category}` : ""}
                          {r.unit ? ` · unit ${r.unit}` : ""}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Field label="Canonical name">
                  <input
                    type="text"
                    value={canonicalName}
                    onChange={(e) => setCanonicalName(e.target.value)}
                    className="w-full px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Item type">
                    <select
                      value={itemType}
                      onChange={(e) => setItemType(e.target.value as ItemType)}
                      className="w-full px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
                    >
                      {ITEM_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Unit">
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value as ItemUnit)}
                      className="w-full px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Category">
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
                    />
                  </Field>
                  <Field label="Subcategory">
                    <input
                      type="text"
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      className="w-full px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
                    />
                  </Field>
                </div>
                <Field label="Specs (JSON)">
                  <textarea
                    value={specsText}
                    onChange={(e) => setSpecsText(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-[var(--border-default)] bg-[var(--bg-card)] text-[12px] text-[var(--text-primary)]"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                  />
                </Field>
              </div>
            )}

            <Field label="Notes (why the AI was wrong)">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional — helps train future extractions"
                className="w-full px-3 py-2 border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
              />
            </Field>
          </div>
        </div>

        <div className="p-5 border-t border-[var(--border-default)] flex items-center justify-end gap-2">
          <NwButton variant="secondary" size="md" onClick={onClose} disabled={saving}>
            Cancel
          </NwButton>
          <NwButton variant="primary" size="md" onClick={save} loading={saving}>
            Save correction
          </NwButton>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div
        className="mb-1 text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}
