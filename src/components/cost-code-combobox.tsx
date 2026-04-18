"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface CostCodeOption {
  id: string;
  code: string;
  description: string;
  category?: string | null;
  is_change_order?: boolean;
}

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  options: CostCodeOption[];
  disabled?: boolean;
  placeholder?: string;
  size?: "sm" | "md";
  /** When true, hides any cost code whose code ends with 'C' (CO variant) unless the line is flagged change_order. */
  hideCoVariants?: boolean;
  /** When true, shows ONLY cost codes whose code ends with 'C'. */
  onlyCoVariants?: boolean;
  /** Optional field label rendered above the input. */
  label?: string;
  ariaLabel?: string;
  /** When provided, shows a small "AI" badge next to the label. */
  aiFilled?: boolean;
  /** When true, the selected value is rendered without a clear (x) button. */
  required?: boolean;
  /** Override the input's className (widens target when used inside tight line-item rows). */
  className?: string;
}

export default function CostCodeCombobox({
  value,
  onChange,
  options,
  disabled,
  placeholder = "Select cost code…",
  size = "md",
  hideCoVariants,
  onlyCoVariants,
  label,
  ariaLabel,
  aiFilled,
  required,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const visibleOptions = useMemo(() => {
    return options.filter((o) => {
      if (onlyCoVariants) return !!o.is_change_order;
      if (hideCoVariants) return !o.is_change_order;
      return true;
    });
  }, [options, hideCoVariants, onlyCoVariants]);

  const selected = useMemo(
    () => visibleOptions.find((o) => o.id === value) ?? null,
    [visibleOptions, value]
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return visibleOptions;
    return visibleOptions.filter((o) => {
      return (
        o.code.toLowerCase().includes(s) ||
        o.description.toLowerCase().includes(s) ||
        (o.category ?? "").toLowerCase().includes(s)
      );
    });
  }, [visibleOptions, search]);

  // Group by category while preserving sort order.
  const grouped = useMemo(() => {
    const map = new Map<string, CostCodeOption[]>();
    for (const o of filtered) {
      const cat = o.category || "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(o);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // Flat list for keyboard navigation.
  const flat = useMemo(() => filtered, [filtered]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setSearch("");
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Keep highlight in view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-index="${highlight}"]`
    );
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function commit(id: string) {
    onChange(id);
    setOpen(false);
  }

  const pad = size === "sm" ? "px-2 py-1 text-[12px]" : "px-3 py-2 text-sm";
  const triggerClasses = `flex items-center justify-between w-full ${pad} bg-[rgba(91,134,153,0.06)] border transition-colors cursor-pointer ${
    open ? "border-stone-blue" : aiFilled ? "border-stone-blue/40" : "border-[rgba(59,88,100,0.15)]"
  } ${disabled ? "opacity-50 pointer-events-none" : "hover:border-stone-blue/60"} ${className}`;

  return (
    <div ref={rootRef} className="relative">
      {label && (
        <label className="flex items-center gap-2 text-[11px] font-medium text-[rgba(59,88,100,0.55)] uppercase tracking-wider mb-1.5">
          {label}
          {aiFilled && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold bg-transparent text-stone-blue border border-stone-blue normal-case tracking-normal">
              AI
            </span>
          )}
        </label>
      )}
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel ?? label ?? "Cost code"}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={triggerClasses}
      >
        <span className={`flex-1 truncate ${selected ? "text-slate-tile" : "text-[rgba(59,88,100,0.55)]"}`}>
          {selected ? `${selected.code} — ${selected.description}` : placeholder}
        </span>
        <div className="flex items-center gap-1 ml-2">
          {selected && !required && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="text-[rgba(59,88,100,0.55)] hover:text-slate-tile"
              aria-label="Clear cost code"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg
            className={`w-4 h-4 text-[rgba(59,88,100,0.55)] transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] bg-white border border-[rgba(59,88,100,0.15)] shadow-2xl">
          <div className="p-2 border-b border-[rgba(59,88,100,0.15)] bg-[rgba(91,134,153,0.06)]">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlight(0);
              }}
              placeholder="Type code, description, or category…"
              className="w-full px-2 py-1.5 bg-white border border-[rgba(59,88,100,0.15)] text-sm text-slate-tile placeholder-cream-dim focus:outline-none focus:border-stone-blue"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlight((h) => Math.min(h + 1, flat.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight((h) => Math.max(h - 1, 0));
                } else if (e.key === "Enter" && flat[highlight]) {
                  e.preventDefault();
                  commit(flat[highlight].id);
                }
              }}
            />
          </div>
          <div ref={listRef} className="max-h-72 overflow-y-auto" role="listbox">
            {grouped.length === 0 ? (
              <div className="px-3 py-4 text-sm text-[rgba(59,88,100,0.55)] text-center">No matches</div>
            ) : (
              grouped.map(([cat, items]) => (
                <div key={cat}>
                  <div className="sticky top-0 px-3 py-1.5 text-[10px] font-semibold text-[rgba(59,88,100,0.55)] uppercase tracking-wider bg-[rgba(91,134,153,0.06)] border-b border-[rgba(59,88,100,0.15)]">
                    {cat}
                  </div>
                  {items.map((o) => {
                    const idx = flat.indexOf(o);
                    const isSelected = o.id === value;
                    const isHighlighted = idx === highlight;
                    return (
                      <button
                        key={o.id}
                        data-index={idx}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setHighlight(idx)}
                        onClick={() => commit(o.id)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-baseline gap-2 ${
                          isHighlighted ? "bg-slate-deep-muted" : ""
                        } ${isSelected ? "text-stone-blue font-medium" : "text-slate-tile"}`}
                      >
                        <span className="font-mono text-[12px] shrink-0 w-14">{o.code}</span>
                        <span className="flex-1 truncate">{o.description}</span>
                        {o.is_change_order && (
                          <span className="text-[10px] uppercase tracking-wider text-nw-warn">CO</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
