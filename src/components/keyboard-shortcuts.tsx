"use client";

import { useEffect, useState, useCallback } from "react";

const SHORTCUTS = [
  { keys: "Ctrl+K / ⌘K", description: "Focus search bar" },
  { keys: "?", description: "Show this help" },
  { keys: "Esc", description: "Close modal / go back" },
];

const QUEUE_SHORTCUTS = [
  { keys: "j / k", description: "Navigate up/down in list" },
  { keys: "Enter", description: "Open selected item" },
  { keys: "a", description: "Approve selected (with confirmation)" },
  { keys: "d", description: "Deny selected (with confirmation)" },
];

const DETAIL_SHORTCUTS = [
  { keys: "Ctrl+Enter / ⌘Enter", description: "Approve invoice" },
  { keys: "Esc", description: "Back to queue" },
];

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || (el as HTMLElement).isContentEditable;
}

export function useGlobalShortcuts() {
  const [showHelp, setShowHelp] = useState(false);

  const handler = useCallback((e: KeyboardEvent) => {
    if (isInputFocused()) return;

    if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setShowHelp((prev) => !prev);
      return;
    }

    if (e.key === "Escape") {
      setShowHelp(false);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      const search = document.querySelector<HTMLInputElement>(
        'input[type="text"], input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]'
      );
      if (search) {
        search.focus();
        search.select();
      }
      return;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);

  return { showHelp, setShowHelp };
}

export default function KeyboardShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white border border-border-def w-full max-w-md mx-4 p-6 animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-slate-tile">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-tertiary hover:text-slate-tile text-xs"
          >
            Esc
          </button>
        </div>

        <Section title="Global" items={SHORTCUTS} />
        <Section title="Invoice Queue" items={QUEUE_SHORTCUTS} />
        <Section title="Invoice Detail" items={DETAIL_SHORTCUTS} />

        <p className="mt-4 text-[11px] text-tertiary">
          Shortcuts are disabled when typing in a text field.
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  items,
}: {
  title: string;
  items: Array<{ keys: string; description: string }>;
}) {
  return (
    <div className="mb-4">
      <h3 className="text-[10px] uppercase tracking-wider text-tertiary mb-2">{title}</h3>
      <div className="space-y-1">
        {items.map((s) => (
          <div key={s.keys} className="flex items-center justify-between py-1">
            <span className="text-sm text-secondary">{s.description}</span>
            <kbd className="px-2 py-0.5 text-xs font-mono border border-border-def bg-bg-sub text-slate-tile">
              {s.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}
