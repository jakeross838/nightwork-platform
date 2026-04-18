"use client";

import { useEffect, useState } from "react";

export default function DrawCoverLetterEditor({
  drawId,
  jobId: _jobId,
}: {
  drawId: string;
  jobId: string;
}) {
  const [body, setBody] = useState("");
  const [generated, setGenerated] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [originalBody, setOriginalBody] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/draws/${drawId}/cover-letter`);
        if (res.ok) {
          const data = await res.json();
          setBody(data.body ?? "");
          setOriginalBody(data.body ?? "");
          setGenerated(!!data.generated);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [drawId]);

  const dirty = body !== originalBody;

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/draws/${drawId}/cover-letter`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover_letter_text: body }),
      });
      if (res.ok) {
        setOriginalBody(body);
        setGenerated(false);
        setMessage("Saved.");
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? "Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    if (!window.confirm("Regenerate from template? Your edits will be discarded.")) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/draws/${drawId}/cover-letter`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setBody(data.body ?? "");
        setOriginalBody(data.body ?? "");
        setGenerated(true);
        setMessage("Regenerated from template.");
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? "Regenerate failed");
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="w-6 h-6 border-2 border-teal/30 border-t-teal animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="bg-brand-card border border-brand-border p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-display text-cream">Cover Letter</p>
          <p className="text-xs text-cream-dim mt-0.5">
            {generated
              ? "Generated from template — edit below to customize."
              : "Custom edit saved for this draw."}{" "}
            Included as page 1 of the PDF export.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {message && (
            <span className="text-xs text-status-success">{message}</span>
          )}
          <button
            onClick={regenerate}
            disabled={busy || saving}
            className="px-3 py-1.5 border border-brand-border text-cream-dim hover:text-cream text-xs"
          >
            {busy ? "Regenerating…" : "Regenerate from template"}
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving || busy}
            className="px-4 py-1.5 bg-teal hover:bg-teal-hover disabled:opacity-50 text-white text-sm font-medium"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={22}
        spellCheck
        className="w-full px-4 py-3 bg-brand-card border border-brand-border text-sm text-cream font-mono leading-relaxed focus:border-teal focus:outline-none whitespace-pre-wrap"
      />

      <p className="text-xs text-cream-dim">
        Tip: edit the template at <a href="/settings/workflow" className="text-teal hover:underline">Settings → Workflow</a> to change the default for all future draws.
      </p>
    </div>
  );
}
