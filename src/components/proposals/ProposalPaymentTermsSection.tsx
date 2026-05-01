"use client";

import { Textarea } from "@/components/ui/textarea";

/**
 * Phase 3.4 Issue 2 — payment terms editor.
 *
 * Extracted from the inline PaymentTermsSection in ReviewManager.tsx.
 * Single object (not a list) of (net_days, late_interest_rate_pct,
 * governing_law, other_terms_text). `terms === null` means "no terms
 * section on the proposal"; setting all sub-fields to null collapses
 * back to null so the commit route can preserve the absence-of-terms
 * signal.
 *
 * Self-contained: declares PaymentTermsForm + private FormField locally.
 */

export interface PaymentTermsForm {
  net_days: number | null;
  late_interest_rate_pct: number | null;
  governing_law: string | null;
  other_terms_text: string | null;
}

interface Props {
  terms: PaymentTermsForm | null;
  onChange: (next: PaymentTermsForm | null) => void;
}

export default function ProposalPaymentTermsSection({ terms, onChange }: Props) {
  const t: PaymentTermsForm = terms ?? {
    net_days: null,
    late_interest_rate_pct: null,
    governing_law: null,
    other_terms_text: null,
  };
  const updateField = (patch: Partial<PaymentTermsForm>) => {
    const merged = { ...t, ...patch };
    const allNull =
      merged.net_days === null &&
      merged.late_interest_rate_pct === null &&
      merged.governing_law === null &&
      merged.other_terms_text === null;
    onChange(allNull ? null : merged);
  };

  return (
    <section className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-3">
      <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">
        Payment terms
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Net days">
          <input
            type="number"
            className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
            value={t.net_days ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              updateField({
                net_days: Number.isFinite(v) ? (v as number) : null,
              });
            }}
            placeholder="30"
          />
        </FormField>
        <FormField label="Late interest rate (%)">
          <input
            type="number"
            step="0.01"
            className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
            value={t.late_interest_rate_pct ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              updateField({
                late_interest_rate_pct: Number.isFinite(v) ? (v as number) : null,
              });
            }}
            placeholder="1.5"
          />
        </FormField>
      </div>
      <FormField label="Governing law">
        <input
          className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
          value={t.governing_law ?? ""}
          onChange={(e) =>
            updateField({ governing_law: e.target.value || null })
          }
          placeholder="Florida law"
        />
      </FormField>
      <FormField label="Other terms text">
        <Textarea
          minRows={3}
          value={t.other_terms_text ?? ""}
          onChange={(e) =>
            updateField({ other_terms_text: e.target.value || null })
          }
          placeholder="Retainage, lien-release requirements, deposit refundability..."
        />
      </FormField>
    </section>
  );
}

// ── Private helpers ───────────────────────────────────────────────

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-tertiary)] font-mono">
        {label}
      </span>
      {children}
    </label>
  );
}
