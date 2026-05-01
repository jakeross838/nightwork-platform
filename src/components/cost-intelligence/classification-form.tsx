"use client";

import { useCallback, useEffect, useState } from "react";
import NwEyebrow from "@/components/nw/Eyebrow";
import { Textarea } from "@/components/ui/textarea";
import type { ItemType, ItemUnit } from "@/lib/cost-intelligence/types";
import type { ClassificationDraft } from "./queue-types";

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

interface ItemSearchResult {
  id: string;
  canonical_name: string;
  item_type: string;
  category: string | null;
  unit: string;
}

interface Props {
  draft: ClassificationDraft;
  onChange: (next: ClassificationDraft) => void;
}

export default function ClassificationForm({ draft, onChange }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ItemSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedMeta, setSelectedMeta] = useState<ItemSearchResult | null>(null);

  const runSearch = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const res = await fetch(
        `/api/cost-intelligence/items?q=${encodeURIComponent(q)}&limit=15`
      );
      if (!res.ok) return;
      const json = await res.json();
      setResults(json.items ?? []);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (draft.mode === "existing" && searchOpen) {
      void runSearch(query);
    }
  }, [draft.mode, query, searchOpen, runSearch]);

  return (
    <section className="space-y-3">
      <NwEyebrow tone="accent">Classification</NwEyebrow>

      <div className="space-y-2 text-[13px]">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={draft.mode === "new"}
            onChange={() => onChange({ ...draft, mode: "new", existing_item_id: null })}
            className="h-[14px] w-[14px]"
          />
          <span className="text-[var(--text-primary)]">Create new item</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            checked={draft.mode === "existing"}
            onChange={() => {
              onChange({ ...draft, mode: "existing" });
              setSearchOpen(true);
            }}
            className="h-[14px] w-[14px]"
          />
          <span className="text-[var(--text-primary)]">Match existing item</span>
        </label>
      </div>

      {draft.mode === "new" && (
        <div className="space-y-3">
          <Field label="Item name">
            <input
              type="text"
              value={draft.canonical_name}
              onChange={(e) => onChange({ ...draft, canonical_name: e.target.value })}
              className="w-full px-3 h-[34px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
              placeholder="e.g. Mystery Forest 3CM countertop"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select
                value={draft.item_type}
                onChange={(e) =>
                  onChange({ ...draft, item_type: e.target.value as ItemType })
                }
                className="w-full px-3 h-[34px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
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
                value={draft.unit}
                onChange={(e) => onChange({ ...draft, unit: e.target.value as ItemUnit })}
                className="w-full px-3 h-[34px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {advancedOpen ? "− Hide advanced" : "+ Advanced"}
          </button>

          {advancedOpen && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <input
                    type="text"
                    value={draft.category}
                    onChange={(e) => onChange({ ...draft, category: e.target.value })}
                    className="w-full px-3 h-[34px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
                  />
                </Field>
                <Field label="Subcategory">
                  <input
                    type="text"
                    value={draft.subcategory}
                    onChange={(e) => onChange({ ...draft, subcategory: e.target.value })}
                    className="w-full px-3 h-[34px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
                  />
                </Field>
              </div>
              <Field label="Specs (JSON)">
                <Textarea
                  value={draft.specs_json}
                  onChange={(e) => onChange({ ...draft, specs_json: e.target.value })}
                  minRows={3}
                  className="text-[12px]"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                />
              </Field>
            </div>
          )}
        </div>
      )}

      {draft.mode === "existing" && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Search items…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            className="w-full px-3 h-[34px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
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
                  onClick={() => {
                    onChange({ ...draft, existing_item_id: r.id });
                    setSelectedMeta(r);
                  }}
                  className={`w-full text-left p-2 text-[12px] transition-colors hover:bg-[var(--bg-subtle)] ${
                    draft.existing_item_id === r.id ? "bg-[var(--bg-subtle)]" : ""
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
          {selectedMeta && draft.existing_item_id === selectedMeta.id && (
            <div className="border border-[var(--nw-stone-blue)]/40 bg-[var(--bg-card)] p-2 text-[12px]">
              <span
                className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] mr-2"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                Picked
              </span>
              <span className="text-[var(--text-primary)]">{selectedMeta.canonical_name}</span>
              <button
                type="button"
                onClick={() => {
                  onChange({ ...draft, existing_item_id: null });
                  setSelectedMeta(null);
                }}
                className="ml-3 text-[11px] text-[var(--nw-stone-blue)] hover:underline"
              >
                change
              </button>
            </div>
          )}
        </div>
      )}
    </section>
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
