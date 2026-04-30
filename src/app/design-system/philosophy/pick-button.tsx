"use client";

// Stage 1.5a Wave C T24.1 — CP2 pick affordance UI.
//
// CARVE-OUT: this file is under src/app/design-system/ but the design-
// system isolation hook (T10c) only blocks imports from @/lib/supabase|
// org|auth/. We don't import any of those here — the pick action is a
// fetch() to /api/design-system/pick-direction which gates on
// platform_admin server-side. Compliant.
//
// Per T24.1 spec:
//   - Each direction gets a "Pick this direction" button
//   - Click POSTs to /api/design-system/pick-direction with the chosen
//     direction's name + an optional reasoning note
//   - Server route (separate file) verifies platform_admin, writes to
//     .planning/design/CHOSEN-DIRECTION.md, then revalidates the page
//   - After pick: a "DIRECTION LOCKED — <picked direction>" banner
//     replaces these per-direction buttons (rendered in page.tsx)

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import Card from "@/components/nw/Card";
import Eyebrow from "@/components/nw/Eyebrow";
import Button from "@/components/nw/Button";
import type { ChosenDirection } from "@/lib/design-system/chosen-direction";

const DIRECTIONS = [
  { key: "helm-brass" as const, label: "Helm + Brass" },
  { key: "specimen" as const, label: "Specimen" },
  { key: "site-office" as const, label: "Site Office" },
];

type DirectionKey = (typeof DIRECTIONS)[number]["key"];

export default function PickDirectionPanel({
  chosen,
}: {
  chosen: ChosenDirection | null;
}) {
  const [picking, setPicking] = useState<DirectionKey | null>(null);
  const [reasoning, setReasoning] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // If a direction is already locked (real value, not TBD), this panel
  // collapses to a "locked" indicator. The locked banner up-page in
  // page.tsx is the primary surface.
  const isLocked = chosen && chosen.direction !== "TBD";

  if (isLocked) {
    return (
      <Card padding="md">
        <Eyebrow tone="muted" className="mb-1">CP2 pick</Eyebrow>
        <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
          Direction is locked &mdash; see the banner above. The pick was
          made on {chosen!.pickedAt} by {chosen!.pickedBy}. Switching
          requires a new Strategic Checkpoint per PHILOSOPHY.md §7.4.
        </p>
      </Card>
    );
  }

  async function pick(direction: DirectionKey, label: string) {
    setPicking(direction);
    setError(null);

    if (!confirm(`Pick "${label}" as the Nightwork design direction?\n\nThis locks subordinate work across the playground, design skills, patterns catalogue, and Forbidden list. Proceed?`)) {
      setPicking(null);
      return;
    }

    try {
      const res = await fetch("/api/design-system/pick-direction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ direction, label, reasoning }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      // Revalidate the philosophy page so the banner updates.
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pick failed");
    } finally {
      setPicking(null);
    }
  }

  return (
    <Card padding="lg">
      <Eyebrow tone="accent" className="mb-3">CP2 pick · Platform admin only</Eyebrow>
      <h3
        className="text-[18px] mb-2"
        style={{
          fontFamily: "var(--font-space-grotesk)",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
        }}
      >
        Pick a direction
      </h3>
      <p className="text-[12px] mb-4 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Optional &mdash; add a short reasoning note that gets recorded in
        the marker file. The pick writes to <span style={{
          fontFamily: "var(--font-jetbrains-mono)",
          color: "var(--nw-stone-blue)",
        }}>.planning/design/CHOSEN-DIRECTION.md</span>. The pick is
        gated to platform_admin; the API route returns 403 otherwise.
      </p>
      <textarea
        value={reasoning}
        onChange={(e) => setReasoning(e.target.value)}
        placeholder="Optional reasoning (recorded in the marker file)…"
        className="w-full text-[12px] p-3 mb-4 border"
        style={{
          fontFamily: "var(--font-inter)",
          borderColor: "var(--border-default)",
          background: "var(--bg-card)",
          color: "var(--text-primary)",
          minHeight: "80px",
        }}
      />
      <div className="flex flex-wrap gap-2">
        {DIRECTIONS.map((d) => (
          <Button
            key={d.key}
            variant={picking === d.key ? "secondary" : "primary"}
            size="md"
            disabled={picking !== null}
            loading={picking === d.key}
            onClick={() => pick(d.key, d.label)}
          >
            Pick {d.label} →
          </Button>
        ))}
      </div>
      {error ? (
        <div
          className="mt-4 px-3 py-2 border-l-2 text-[12px]"
          style={{
            borderColor: "var(--nw-danger)",
            background: "rgba(176, 85, 78, 0.06)",
            color: "var(--nw-danger)",
          }}
        >
          {error}
        </div>
      ) : null}
      <p className="mt-4 text-[10px] italic" style={{ color: "var(--text-tertiary)" }}>
        The marker file does not exist yet (or contains a TBD placeholder)
        until the first successful pick. Wave C leaves the file empty
        intentionally &mdash; Jake picks at CP2 review.
      </p>
    </Card>
  );
}
