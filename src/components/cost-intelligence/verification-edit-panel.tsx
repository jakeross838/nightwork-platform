"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import NwButton from "@/components/nw/Button";
import NwMoney from "@/components/nw/Money";
import { toast } from "@/lib/utils/toast";
import type {
  ItemType,
  ItemUnit,
  ProposedItemData,
} from "@/lib/cost-intelligence/types";

export interface VerificationLineInput {
  id: string;
  raw_description: string;
  raw_quantity: number | null;
  raw_unit_text: string | null;
  raw_unit_price_cents: number | null;
  raw_total_cents: number | null;
  match_tier: string | null;
  match_reasoning: string | null;
  proposed_item: { id: string; canonical_name: string } | null;
  proposed_item_data: ProposedItemData | null;
  invoice_number: string | null;
  invoice_date: string | null;
  vendor_name: string | null;
  line_tax_cents: number | null;
  overhead_allocated_cents: number | null;
}

interface Props {
  line: VerificationLineInput;
  onCancel: () => void;
  onSaved: () => void;
}

type Mode = "pick_existing" | "edit_new";

const ITEM_TYPES: ItemType[] = ["material", "labor", "equipment", "service", "subcontract", "other"];
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

interface ItemSearchResult {
  id: string;
  canonical_name: string;
  item_type: string;
  category: string | null;
  unit: string;
}

export default function VerificationEditPanel({ line, onCancel, onSaved }: Props) {
  const initialProposed = line.proposed_item_data;
  const [mode, setMode] = useState<Mode>(line.proposed_item?.id ? "pick_existing" : "edit_new");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ItemSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    line.proposed_item?.id ?? null
  );

  const [canonicalName, setCanonicalName] = useState(initialProposed?.canonical_name ?? "");
  const [itemType, setItemType] = useState<ItemType>(initialProposed?.item_type ?? "other");
  const [category, setCategory] = useState(initialProposed?.category ?? "");
  const [subcategory, setSubcategory] = useState(initialProposed?.subcategory ?? "");
  const [unit, setUnit] = useState<ItemUnit>(initialProposed?.unit ?? "each");
  const [specsOpen, setSpecsOpen] = useState(false);
  const [specsText, setSpecsText] = useState(
    JSON.stringify(initialProposed?.specs ?? {}, null, 2)
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const res = await fetch(`/api/cost-intelligence/items?q=${encodeURIComponent(q)}&limit=15`);
      if (!res.ok) return;
      const json = await res.json();
      setResults(json.items ?? []);
    } finally {
      setSearching(false);
    }
  }, []);

  // Seed results when entering pick_existing mode.
  useEffect(() => {
    if (mode === "pick_existing") void runSearch(query);
  }, [mode, query, runSearch]);

  const selectedMeta = useMemo(
    () => results.find((r) => r.id === selectedItemId) ?? null,
    [results, selectedItemId]
  );

  const save = useCallback(async () => {
    setSaving(true);
    try {
      type Body = {
        action: "correct" | "approve";
        corrected_item_id?: string;
        corrected_proposed_data?: ProposedItemData;
        correction_notes?: string;
      };

      // If unchanged from AI proposal and user is in edit_new mode with
      // no field changes, treat as straight approve.
      const isUntouched =
        mode === "edit_new" &&
        initialProposed != null &&
        canonicalName === (initialProposed.canonical_name ?? "") &&
        itemType === initialProposed.item_type &&
        (category || null) === (initialProposed.category ?? null) &&
        (subcategory || null) === (initialProposed.subcategory ?? null) &&
        unit === initialProposed.unit &&
        !notes.trim();

      let body: Body;
      if (isUntouched) {
        body = { action: "approve" };
      } else if (mode === "pick_existing") {
        if (!selectedItemId) {
          toast.error("Select an item first");
          setSaving(false);
          return;
        }
        body = {
          action: "correct",
          corrected_item_id: selectedItemId,
          correction_notes: notes.trim() || undefined,
        };
      } else {
        let parsedSpecs: Record<string, unknown> = {};
        try {
          parsedSpecs = JSON.parse(specsText || "{}");
        } catch {
          toast.error("Specs JSON is invalid");
          setSaving(false);
          return;
        }
        if (!canonicalName.trim()) {
          toast.error("Canonical name is required");
          setSaving(false);
          return;
        }
        body = {
          action: "correct",
          corrected_proposed_data: {
            canonical_name: canonicalName.trim(),
            item_type: itemType,
            category: category.trim() || null,
            subcategory: subcategory.trim() || null,
            specs: parsedSpecs,
            unit,
          },
          correction_notes: notes.trim() || undefined,
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
      toast.success("Committed to spine");
      onSaved();
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : err}`);
      setSaving(false);
    }
  }, [
    mode,
    initialProposed,
    canonicalName,
    itemType,
    category,
    subcategory,
    unit,
    specsText,
    notes,
    selectedItemId,
    line.id,
    onSaved,
  ]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 p-5 bg-[var(--bg-subtle)] border-t border-[var(--border-default)]">
      {/* LEFT — invoice context (read-only) */}
      <div className="space-y-3">
        <NwEyebrow tone="muted">From invoice</NwEyebrow>

        <div className="border border-[var(--border-default)] bg-[var(--bg-card)] p-3">
          <p
            className="text-[13px] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {line.raw_description}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-[11px]">
            <div>
              <div
                className="uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                Qty
              </div>
              <div
                className="mt-0.5 text-[var(--text-secondary)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                {line.raw_quantity ?? "—"} {line.raw_unit_text ?? ""}
              </div>
            </div>
            <div>
              <div
                className="uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                Unit price
              </div>
              <NwMoney cents={line.raw_unit_price_cents} size="sm" />
            </div>
            <div>
              <div
                className="uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                Total
              </div>
              <NwMoney cents={line.raw_total_cents} size="sm" variant="emphasized" />
            </div>
          </div>
          {(line.line_tax_cents || line.overhead_allocated_cents) ? (
            <div
              className="mt-3 flex gap-4 text-[11px] text-[var(--text-tertiary)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              {line.line_tax_cents ? (
                <span>
                  tax <NwMoney cents={line.line_tax_cents} size="sm" />
                </span>
              ) : null}
              {line.overhead_allocated_cents ? (
                <span>
                  overhead <NwMoney cents={line.overhead_allocated_cents} size="sm" />
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          className="text-[11px] text-[var(--text-tertiary)]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          {line.invoice_number && <span>Invoice {line.invoice_number}</span>}
          {line.invoice_date ? <span> · {line.invoice_date}</span> : null}
          {line.vendor_name ? <span> · {line.vendor_name}</span> : null}
        </div>

        {line.match_reasoning && (
          <div className="border border-[var(--border-default)] p-3 text-[12px] text-[var(--text-secondary)] italic bg-[var(--bg-card)]">
            <span
              className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] mr-2"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              AI said
            </span>
            {line.match_reasoning}
          </div>
        )}
      </div>

      {/* RIGHT — classification */}
      <div className="space-y-3">
        <NwEyebrow tone="accent">Classification</NwEyebrow>

        <div
          className="inline-flex items-center border border-[var(--border-default)]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          <button
            type="button"
            onClick={() => setMode("pick_existing")}
            className={`px-3 h-[30px] text-[10px] uppercase tracking-[0.12em] ${
              mode === "pick_existing"
                ? "bg-nw-stone-blue text-nw-white-sand"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Match existing
          </button>
          <button
            type="button"
            onClick={() => setMode("edit_new")}
            className={`px-3 h-[30px] text-[10px] uppercase tracking-[0.12em] border-l border-[var(--border-default)] ${
              mode === "edit_new"
                ? "bg-nw-stone-blue text-nw-white-sand"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Create new
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
            <div className="border border-[var(--border-default)] bg-[var(--bg-card)] max-h-[220px] overflow-auto divide-y divide-[var(--border-default)]">
              {searching ? (
                <p className="p-3 text-[12px] text-[var(--text-tertiary)]">Searching…</p>
              ) : results.length === 0 ? (
                <p className="p-3 text-[12px] text-[var(--text-tertiary)]">No items match.</p>
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
                    <div className="text-[var(--text-primary)] font-medium">{r.canonical_name}</div>
                    <div className="mt-0.5 text-[var(--text-tertiary)]">
                      {r.item_type}
                      {r.category ? ` · ${r.category}` : ""}
                      {r.unit ? ` · unit ${r.unit}` : ""}
                    </div>
                  </button>
                ))
              )}
            </div>
            {selectedMeta && (
              <div className="border border-nw-stone-blue/40 bg-[var(--bg-card)] p-2 text-[12px]">
                <span
                  className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] mr-2"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  Picked
                </span>
                <span className="text-[var(--text-primary)]">{selectedMeta.canonical_name}</span>
                <span className="ml-2 text-[var(--text-tertiary)]">
                  {selectedMeta.item_type} · {selectedMeta.unit}
                </span>
              </div>
            )}
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
              <Field label="Type">
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
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSpecsOpen((p) => !p)}
                className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                {specsOpen ? "− Hide specs JSON" : "+ Advanced: specs JSON"}
              </button>
              {specsOpen && (
                <textarea
                  value={specsText}
                  onChange={(e) => setSpecsText(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-[var(--border-default)] bg-[var(--bg-card)] text-[12px] text-[var(--text-primary)]"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                />
              )}
            </div>
          </div>
        )}

        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Why the AI was wrong (helps train future extractions)"
            className="w-full px-3 py-2 border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
          />
        </Field>
      </div>

      {/* Footer — actions span both columns */}
      <div className="lg:col-span-2 flex items-center justify-end gap-2 pt-2">
        <NwButton variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </NwButton>
        <NwButton variant="primary" size="sm" onClick={save} loading={saving}>
          Save & approve
        </NwButton>
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

// Keep NwBadge import live — consumers embed this component in contexts
// that already render badges from the same tree.
void NwBadge;
