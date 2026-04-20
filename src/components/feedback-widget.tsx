"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Button from "@/components/nw/Button";
import { toast } from "@/lib/utils/toast";

type Category = "bug" | "confusion" | "idea" | "other";
type Severity = "low" | "medium" | "high";

const MAX_NOTE_LEN = 2000;

const CATEGORIES: Array<{ value: Category; label: string }> = [
  { value: "bug", label: "Bug" },
  { value: "confusion", label: "Confusion" },
  { value: "idea", label: "Idea" },
  { value: "other", label: "Other" },
];

const SEVERITIES: Array<{ value: Severity; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

// Paths where the feedback button must NOT render. Public marketing +
// auth pages (no session), and the platform admin app (different
// context — staff are the audience, not the customer).
const HIDDEN_PATH_PATTERNS: RegExp[] = [
  /^\/$/,              // marketing root
  /^\/pricing/,
  /^\/login/,
  /^\/signup/,
  /^\/forgot/,
  /^\/auth/,
  /^\/admin\/platform/,
];

function parseBrowser(ua: string): { browser: string; os: string } {
  let browser = "Unknown";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";

  let os = "Unknown";
  if (/Windows NT 10/.test(ua)) os = "Windows 10/11";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return { browser, os };
}

export default function FeedbackWidget({
  authenticated,
}: {
  authenticated: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("bug");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hidden = useMemo(() => {
    if (!authenticated) return true;
    return HIDDEN_PATH_PATTERNS.some((p) => p.test(pathname));
  }, [authenticated, pathname]);

  const resetForm = useCallback(() => {
    setCategory("bug");
    setSeverity("medium");
    setNote("");
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    setOpen(false);
    resetForm();
  }, [submitting, resetForm]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const submit = useCallback(async () => {
    const trimmed = note.trim();
    if (!trimmed) {
      setError("Please describe what you're seeing.");
      return;
    }
    if (trimmed.length > MAX_NOTE_LEN) {
      setError(`Please keep it under ${MAX_NOTE_LEN} characters.`);
      return;
    }
    setError(null);
    setSubmitting(true);

    const { browser, os } = parseBrowser(
      typeof navigator !== "undefined" ? navigator.userAgent : ""
    );
    const theme =
      typeof document !== "undefined"
        ? document.documentElement.getAttribute("data-theme") ?? "light"
        : "light";
    const page_url =
      typeof window !== "undefined" ? window.location.pathname : "";

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          severity,
          note: trimmed,
          page_url,
          browser,
          os,
          theme,
        }),
      });
      if (res.status === 429) {
        setError("Too many submissions. Try again in a bit.");
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }
      toast.success("Thanks, we'll review this.");
      setSubmitting(false);
      setOpen(false);
      resetForm();
    } catch {
      setError("Network error — please try again.");
      setSubmitting(false);
    }
  }, [category, severity, note, resetForm]);

  if (hidden) return null;

  const charCount = note.length;
  const countColor =
    charCount > MAX_NOTE_LEN
      ? "var(--nw-danger)"
      : charCount > MAX_NOTE_LEN * 0.9
        ? "var(--nw-warn)"
        : "var(--text-tertiary)";

  return (
    <>
      {/* Floating trigger — square, slate-deep, subtle hover lift */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Share feedback"
        className="fixed bottom-5 right-5 z-[9000] w-[52px] h-[52px] flex items-center justify-center border transition-all hover:scale-[1.04] hover:shadow-lg print:hidden"
        style={{
          background: "var(--nw-slate-deep)",
          color: "var(--nw-white-sand)",
          borderColor: "rgba(247,245,236,0.16)",
        }}
      >
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9100] flex items-center justify-center px-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Share feedback"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40 cursor-default"
            onClick={handleClose}
          />
          <Card
            padding="none"
            className="relative w-full max-w-[520px] max-h-[90vh] overflow-y-auto animate-fade-up"
          >
            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Eyebrow tone="accent" className="mb-2">
                    HELP US IMPROVE NIGHTWORK
                  </Eyebrow>
                  <h2
                    className="font-display text-2xl tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Share feedback
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  aria-label="Close"
                  className="shrink-0 w-8 h-8 flex items-center justify-center hover:bg-[var(--bg-subtle)] transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Category */}
              <div>
                <Eyebrow className="mb-2 block">CATEGORY</Eyebrow>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  disabled={submitting}
                  className="w-full h-10 px-3 text-sm border bg-transparent"
                  style={{
                    color: "var(--text-primary)",
                    borderColor: "var(--border-strong)",
                    background: "var(--bg-card)",
                  }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Severity */}
              <div>
                <Eyebrow className="mb-2 block">SEVERITY</Eyebrow>
                <div
                  role="radiogroup"
                  aria-label="Severity"
                  className="grid grid-cols-3 gap-2"
                >
                  {SEVERITIES.map((s) => {
                    const active = severity === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSeverity(s.value)}
                        disabled={submitting}
                        className="h-10 text-xs uppercase font-medium border transition-colors"
                        style={{
                          fontFamily: "var(--font-jetbrains-mono)",
                          letterSpacing: "0.12em",
                          color: active
                            ? "var(--nw-white-sand)"
                            : "var(--text-primary)",
                          background: active
                            ? "var(--nw-slate-deep)"
                            : "transparent",
                          borderColor: active
                            ? "var(--nw-slate-deep)"
                            : "var(--border-strong)",
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Note */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Eyebrow>WHAT HAPPENED</Eyebrow>
                  <span
                    className="text-[10px] tabular-nums"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      color: countColor,
                    }}
                  >
                    {charCount}/{MAX_NOTE_LEN}
                  </span>
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={submitting}
                  rows={5}
                  maxLength={MAX_NOTE_LEN}
                  placeholder="Describe what you were doing and what went wrong (or what could be clearer)."
                  className="w-full p-3 text-sm border resize-none"
                  style={{
                    color: "var(--text-primary)",
                    borderColor: "var(--border-strong)",
                    background: "var(--bg-card)",
                  }}
                />
              </div>

              {error && (
                <div
                  className="p-3 text-xs border"
                  style={{
                    color: "var(--nw-danger)",
                    borderColor: "rgba(176,85,78,0.4)",
                    background: "rgba(176,85,78,0.06)",
                  }}
                >
                  {error}
                </div>
              )}

              <p
                className="text-[11px] leading-relaxed"
                style={{ color: "var(--text-tertiary)" }}
              >
                We capture the page you&apos;re on, your browser, and your
                theme so we can reproduce the issue.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={handleClose}
                  disabled={submitting}
                >
                  CANCEL
                </Button>
                <Button
                  variant="primary"
                  onClick={submit}
                  loading={submitting}
                  disabled={submitting || note.trim().length === 0}
                >
                  SEND FEEDBACK
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
