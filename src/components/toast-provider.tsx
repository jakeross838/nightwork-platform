"use client";

/**
 * Toast notification system — Phase 8g.
 *
 * Lightweight, dependency-free toast provider. Mount once in the root layout.
 * Trigger via the `toast` helpers in `@/lib/utils/toast`. Toasts stack in the
 * top-right, auto-dismiss after 5s (overrideable), and cap at 3 visible.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type ToastKind = "success" | "error" | "warning" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  durationMs: number;
}

interface ToastContextValue {
  push: (kind: ToastKind, message: string, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 5000;

let toastIdCounter = 0;
type Subscriber = (kind: ToastKind, message: string, durationMs?: number) => void;
const subscribers = new Set<Subscriber>();

/** Module-level publisher so non-React code (helper modules) can fire toasts. */
export function publishToast(kind: ToastKind, message: string, durationMs?: number) {
  subscribers.forEach((sub) => sub(kind, message, durationMs));
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback<ToastContextValue["push"]>(
    (kind, message, durationMs = DEFAULT_DURATION) => {
      const id = ++toastIdCounter;
      setToasts((prev) => {
        const next = [...prev, { id, kind, message, durationMs }];
        // Cap to MAX_VISIBLE — drop oldest when over.
        return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
      });
      const timer = setTimeout(() => dismiss(id), durationMs);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  // Allow non-React modules to push toasts via publishToast().
  useEffect(() => {
    const sub: Subscriber = (kind, message, durationMs) => push(kind, message, durationMs);
    subscribers.add(sub);
    return () => {
      subscribers.delete(sub);
    };
  }, [push]);

  // Cleanup all timers on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful fallback when provider missing (SSR/unit tests).
    return {
      push: (_kind: ToastKind, _message: string) => {
        if (typeof window !== "undefined") {
          // eslint-disable-next-line no-console
          console.warn("[toast] Provider missing; toast was not rendered:", _message);
        }
      },
    };
  }
  return ctx;
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed top-4 right-4 z-[10000] flex flex-col gap-2 max-w-[calc(100vw-2rem)] sm:max-w-sm pointer-events-none print:hidden"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

const KIND_STYLES: Record<ToastKind, { border: string; iconBg: string; icon: JSX.Element }> = {
  success: {
    border: "border-status-success",
    iconBg: "text-status-success",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  error: {
    border: "border-status-danger",
    iconBg: "text-status-danger",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  warning: {
    border: "border-status-warning",
    iconBg: "text-status-warning",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
  },
  info: {
    border: "border-teal",
    iconBg: "text-teal",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const style = KIND_STYLES[toast.kind];
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 bg-brand-card border ${style.border} px-4 py-3 shadow-md animate-fade-up`}
    >
      <span className={style.iconBg}>{style.icon}</span>
      <p className="flex-1 text-sm text-cream leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-cream-dim hover:text-cream transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
