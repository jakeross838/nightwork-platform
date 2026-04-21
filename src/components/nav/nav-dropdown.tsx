"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";

export interface NavDropdownItem {
  href: string;
  label: string;
  count?: number | null;
  disabled?: boolean;
  disabledReason?: string;
  soon?: boolean;
}

interface NavDropdownProps {
  label: string;
  items: NavDropdownItem[];
  active: boolean;
  activeHref?: string;
}

const HOVER_CLOSE_DELAY_MS = 150;

/**
 * Hybrid hover+click dropdown for the top nav. Hover-capable pointers
 * (mouse on desktop) open on mouseenter; touch/coarse pointers toggle
 * on click. Keyboard: Enter/Space opens, Arrow keys move focus within,
 * Escape closes, Tab exits.
 */
export default function NavDropdown({
  label,
  items,
  active,
  activeHref,
}: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [isHoverCapable, setIsHoverCapable] = useState(true);

  // Detect coarse / fine pointer once on mount
  useEffect(() => {
    const mql = window.matchMedia("(hover: hover) and (pointer: fine)");
    setIsHoverCapable(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsHoverCapable(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current != null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
      setFocusedIndex(-1);
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearCloseTimeout]);

  const handleMouseEnter = useCallback(() => {
    if (!isHoverCapable) return;
    clearCloseTimeout();
    setOpen(true);
  }, [isHoverCapable, clearCloseTimeout]);

  const handleMouseLeave = useCallback(() => {
    if (!isHoverCapable) return;
    scheduleClose();
  }, [isHoverCapable, scheduleClose]);

  const handleClick = useCallback(() => {
    setOpen((prev) => !prev);
    setFocusedIndex(-1);
  }, []);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocusedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const enabledIndices = items
        .map((item, i) => (item.disabled ? -1 : i))
        .filter((i) => i >= 0);

      if (e.key === "Escape") {
        setOpen(false);
        setFocusedIndex(-1);
        buttonRef.current?.focus();
        return;
      }
      if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
        e.preventDefault();
        setOpen(true);
        setFocusedIndex(enabledIndices[0] ?? -1);
        return;
      }
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const pos = enabledIndices.indexOf(focusedIndex);
        const next = pos === -1 ? 0 : Math.min(pos + 1, enabledIndices.length - 1);
        setFocusedIndex(enabledIndices[next] ?? -1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const pos = enabledIndices.indexOf(focusedIndex);
        const next = pos === -1 ? enabledIndices.length - 1 : Math.max(pos - 1, 0);
        setFocusedIndex(enabledIndices[next] ?? -1);
      } else if (e.key === "Home") {
        e.preventDefault();
        setFocusedIndex(enabledIndices[0] ?? -1);
      } else if (e.key === "End") {
        e.preventDefault();
        setFocusedIndex(enabledIndices[enabledIndices.length - 1] ?? -1);
      } else if (e.key === "Tab") {
        // Let tab exit the menu naturally
        setOpen(false);
        setFocusedIndex(-1);
      }
    },
    [open, items, focusedIndex]
  );

  // Focus the active item after open
  useEffect(() => {
    if (!open || focusedIndex < 0) return;
    const el = menuRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-nav-item]")[
      focusedIndex
    ];
    el?.focus();
  }, [open, focusedIndex]);

  return (
    <div
      ref={containerRef}
      className="relative h-full flex items-stretch"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1 h-full px-[14px] text-[13px] font-medium font-sans transition-colors border-b-2 -mb-px ${
          active
            ? "text-[#F7F5EC] border-b-nw-stone-blue"
            : "text-[rgba(247,245,236,0.65)] hover:text-[#F7F5EC] border-transparent"
        }`}
      >
        {label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M2.5 3.5l2.5 3 2.5-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={handleKeyDown}
          className="absolute top-full left-0 min-w-[220px] z-50 py-1 border bg-[var(--bg-card)] shadow-lg"
          style={{
            borderColor: "var(--border-default)",
            boxShadow:
              "0 12px 24px -6px rgba(0,0,0,0.18), 0 4px 10px -2px rgba(0,0,0,0.08)",
          }}
        >
          {items.map((item, i) => {
            const isActive = !!activeHref && activeHref === item.href;
            if (item.disabled) {
              return (
                <div
                  key={item.href + i}
                  role="menuitem"
                  aria-disabled="true"
                  title={item.disabledReason ?? "Coming soon"}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px] cursor-default select-none"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <span>{item.label}</span>
                  {item.soon && <SoonPill />}
                </div>
              );
            }
            return (
              <Link
                key={item.href + i}
                href={item.href}
                data-nav-item
                role="menuitem"
                tabIndex={focusedIndex === i ? 0 : -1}
                onClick={() => {
                  setOpen(false);
                  setFocusedIndex(-1);
                }}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 text-[13px] transition-colors ${
                  isActive
                    ? "bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                }`}
                style={
                  isActive
                    ? { borderLeft: "2px solid var(--nw-stone-blue)", paddingLeft: "calc(0.75rem - 2px)" }
                    : undefined
                }
              >
                <span>{item.label}</span>
                {item.count != null && item.count > 0 ? <CountBadge count={item.count} /> : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SoonPill() {
  return (
    <span
      className="px-[5px] py-[1px] text-[9px] tracking-[0.12em] uppercase border"
      style={{
        fontFamily: "var(--font-jetbrains-mono)",
        color: "var(--text-tertiary)",
        borderColor: "var(--border-default)",
      }}
    >
      Soon
    </span>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span
      className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 border text-[10px] font-bold"
      style={{
        fontFamily: "var(--font-jetbrains-mono)",
        color: "var(--text-primary)",
        borderColor: "var(--border-default)",
        background: "var(--bg-subtle)",
      }}
    >
      {count}
    </span>
  );
}

export interface MobileNavSectionProps {
  label: string;
  items: NavDropdownItem[];
  defaultOpen?: boolean;
  onItemClick?: () => void;
  activeHref?: string;
}

/**
 * Mobile hierarchical collapsible section. Tap header toggles expanded.
 */
export function MobileNavSection({
  label,
  items,
  defaultOpen = true,
  onItemClick,
  activeHref,
}: MobileNavSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center justify-between py-3 px-4 text-[13px] font-medium font-sans text-[rgba(247,245,236,0.8)] hover:text-[#F7F5EC] transition-colors"
        aria-expanded={open}
      >
        <span>{label}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="flex flex-col pl-2">
          {items.map((item, i) => {
            if (item.disabled) {
              return (
                <div
                  key={item.href + i}
                  className="flex items-center gap-2 py-2.5 px-6 text-[13px] text-[rgba(247,245,236,0.35)]"
                >
                  <span>{item.label}</span>
                  {item.soon && <SoonPill />}
                </div>
              );
            }
            const isActive = !!activeHref && activeHref === item.href;
            return (
              <Link
                key={item.href + i}
                href={item.href}
                onClick={onItemClick}
                className={`flex items-center justify-between py-2.5 px-6 text-[13px] transition-colors ${
                  isActive
                    ? "text-[#F7F5EC]"
                    : "text-[rgba(247,245,236,0.65)] hover:text-[#F7F5EC]"
                }`}
              >
                <span>{item.label}</span>
                {item.count != null && item.count > 0 ? (
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 border text-[10px] font-bold"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      color: "#F7F5EC",
                      borderColor: "rgba(247,245,236,0.25)",
                    }}
                  >
                    {item.count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
