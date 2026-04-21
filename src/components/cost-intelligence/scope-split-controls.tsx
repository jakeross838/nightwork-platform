"use client";

import { useState } from "react";
import NwButton from "@/components/nw/Button";
import NwMoney from "@/components/nw/Money";
import NwEyebrow from "@/components/nw/Eyebrow";
import { toast } from "@/lib/utils/toast";

interface Props {
  lineId: string;
  lineTotalCents: number;
  splitActive: boolean;
  currentMaterialCents: number | null;
  onSplitChanged: () => void;
}

/**
 * Controls for splitting a scope line's total into material + labor
 * components, or reverting back to the bundled labor_and_material view.
 *
 * Split is NEVER fabricated — requires explicit PM input. The total
 * always matches the invoice line; labor = total − material.
 */
export default function ScopeSplitControls({
  lineId,
  lineTotalCents,
  splitActive,
  currentMaterialCents,
  onSplitChanged,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [materialInput, setMaterialInput] = useState(
    currentMaterialCents != null ? (currentMaterialCents / 100).toFixed(2) : ""
  );
  const [busy, setBusy] = useState(false);

  const parsedMaterialCents = parseDollarsToCents(materialInput);
  const laborCents =
    parsedMaterialCents != null ? lineTotalCents - parsedMaterialCents : null;
  const invalid =
    parsedMaterialCents == null ||
    parsedMaterialCents < 0 ||
    parsedMaterialCents > lineTotalCents;

  const saveSplit = async () => {
    if (parsedMaterialCents == null) {
      toast.error("Enter a valid material total");
      return;
    }
    if (parsedMaterialCents < 0 || parsedMaterialCents > lineTotalCents) {
      toast.error("Material must be between $0 and the line total");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        `/api/cost-intelligence/extraction-lines/${lineId}/split-scope`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estimated_material_cents: parsedMaterialCents }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Status ${res.status}`);
      }
      toast.success("Split saved");
      setModalOpen(false);
      onSplitChanged();
    } catch (err) {
      toast.error(`Split failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };

  const revert = async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/cost-intelligence/extraction-lines/${lineId}/revert-split`,
        { method: "PUT" }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Status ${res.status}`);
      }
      toast.success("Reverted to bundled");
      onSplitChanged();
    } catch (err) {
      toast.error(`Revert failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {splitActive ? (
        <NwButton variant="ghost" size="sm" onClick={revert} loading={busy}>
          Revert to bundled
        </NwButton>
      ) : (
        <NwButton
          variant="secondary"
          size="sm"
          onClick={() => setModalOpen(true)}
          disabled={busy}
        >
          Split into material + labor
        </NwButton>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[480px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xl">
            <div className="px-5 py-3 border-b border-[var(--border-default)]">
              <NwEyebrow tone="accent">Split scope cost</NwEyebrow>
              <h3
                className="mt-1 text-[16px] text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-space-grotesk)" }}
              >
                Enter the material estimate
              </h3>
              <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                Labor is computed as line total − material. Never fabricated.
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <label className="block">
                <div
                  className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] mb-1"
                  style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                >
                  Material total (USD)
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={materialInput}
                  onChange={(e) => setMaterialInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-[var(--border-default)] bg-[var(--bg-main)] text-[14px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--nw-stone-blue)]"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                />
              </label>

              <div className="grid grid-cols-3 gap-2 text-[12px]">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Line total
                  </div>
                  <div
                    className="text-[var(--text-primary)]"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    <NwMoney cents={lineTotalCents} size="sm" />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Material
                  </div>
                  <div
                    className="text-[var(--text-primary)]"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    <NwMoney cents={parsedMaterialCents ?? 0} size="sm" />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    Labor (computed)
                  </div>
                  <div
                    className={`${
                      laborCents != null && laborCents >= 0
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--nw-danger)]"
                    }`}
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    <NwMoney cents={laborCents ?? 0} size="sm" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-default)]">
              <NwButton
                variant="ghost"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={busy}
              >
                Cancel
              </NwButton>
              <NwButton
                variant="primary"
                size="sm"
                onClick={saveSplit}
                loading={busy}
                disabled={invalid}
              >
                Save split
              </NwButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
