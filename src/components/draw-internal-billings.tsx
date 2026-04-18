"use client";

import { useEffect, useState, useCallback } from "react";
import { formatCents } from "@/lib/utils/format";

interface BillingType {
  id: string;
  name: string;
  calculation_method: string;
  default_amount_cents: number | null;
  default_rate_cents: number | null;
  default_quantity_unit: string | null;
  default_percentage: number | null;
}

interface InternalBilling {
  id: string;
  billing_type_id: string;
  cost_code_id: string | null;
  description: string | null;
  amount_cents: number;
  rate_cents: number | null;
  quantity: number | null;
  percentage: number | null;
  status: string;
  draw_line_item_id: string | null;
  internal_billing_types?: { name: string; calculation_method: string };
  cost_codes?: { code: string; description: string } | null;
}

interface Props {
  drawId: string;
  jobId: string;
  isDraft: boolean;
  onChange: () => void;
}

export default function DrawInternalBillings({ drawId, jobId, isDraft, onChange }: Props) {
  const [billingTypes, setBillingTypes] = useState<BillingType[]>([]);
  const [draftBillings, setDraftBillings] = useState<InternalBilling[]>([]);
  const [attachedBillings, setAttachedBillings] = useState<InternalBilling[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [baseCents, setBaseCents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [attaching, setAttaching] = useState(false);
  const [detachingId, setDetachingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [typesRes, billingsRes, drawRes] = await Promise.all([
        fetch("/api/internal-billing-types"),
        fetch(`/api/jobs/${jobId}/internal-billings`),
        fetch(`/api/draws/${drawId}`),
      ]);
      const types = typesRes.ok ? await typesRes.json() : [];
      const billings = billingsRes.ok ? await billingsRes.json() : [];
      const drawData = drawRes.ok ? await drawRes.json() : null;

      setBillingTypes(Array.isArray(types) ? types : []);

      const all = Array.isArray(billings) ? billings : [];
      // Draft billings not yet on a draw (attachable)
      setDraftBillings(all.filter((b: InternalBilling) => b.status === "draft"));
      // Billings attached to THIS draw
      setAttachedBillings(
        all.filter(
          (b: InternalBilling) =>
            b.status === "attached" && b.draw_line_item_id != null
        )
      );

      // Compute base from draw's budget + CO line items
      if (drawData?.g703_rows) {
        const rows = drawData.g703_rows as Array<{ this_period: number; source_type?: string }>;
        const base = rows
          .filter((r) => !r.source_type || r.source_type === "budget" || r.source_type === "change_order")
          .reduce((s, r) => s + (r.this_period ?? 0), 0);
        setBaseCents(base);
      } else {
        setBaseCents(0);
      }
    } finally {
      setLoading(false);
    }
  }, [drawId, jobId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function computeAmount(b: InternalBilling): number {
    const method = billingTypes.find((t) => t.id === b.billing_type_id)?.calculation_method
      ?? b.internal_billing_types?.calculation_method;
    if (method === "percentage" && b.percentage) {
      // Compute from base + selected non-percentage fixed amounts
      const selectedFixed = Array.from(selected)
        .map((id) => draftBillings.find((d) => d.id === id))
        .filter((d): d is InternalBilling => {
          if (!d) return false;
          const m = billingTypes.find((t) => t.id === d.billing_type_id)?.calculation_method;
          return m !== "percentage";
        })
        .reduce((s, d) => s + d.amount_cents, 0);

      const attachedNonPct = attachedBillings
        .filter((d) => {
          const m = billingTypes.find((t) => t.id === d.billing_type_id)?.calculation_method;
          return m !== "percentage";
        })
        .reduce((s, d) => s + d.amount_cents, 0);

      const totalBase = baseCents + selectedFixed + attachedNonPct;
      return Math.round(totalBase * b.percentage);
    }
    return b.amount_cents;
  }

  async function handleAttach() {
    if (selected.size === 0) return;
    setAttaching(true);
    try {
      const res = await fetch(`/api/draws/${drawId}/internal-billings/attach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billing_ids: Array.from(selected) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Attach failed");
        return;
      }
      setSelected(new Set());
      await fetchData();
      onChange();
    } finally {
      setAttaching(false);
    }
  }

  async function handleDetach(billingId: string) {
    setDetachingId(billingId);
    try {
      const res = await fetch(
        `/api/draws/${drawId}/internal-billings/attach?billing_id=${billingId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Detach failed");
        return;
      }
      await fetchData();
      onChange();
    } finally {
      setDetachingId(null);
    }
  }

  function getMethodLabel(b: InternalBilling): string {
    return billingTypes.find((t) => t.id === b.billing_type_id)?.calculation_method
      ?? b.internal_billing_types?.calculation_method ?? "";
  }

  if (loading) {
    return <div className="text-cream-dim text-sm py-8 text-center">Loading internal billings...</div>;
  }

  // Compute live total for all selected
  const selectedTotal = Array.from(selected)
    .map((id) => draftBillings.find((d) => d.id === id))
    .filter((d): d is InternalBilling => !!d)
    .reduce((s, d) => s + computeAmount(d), 0);

  const attachedTotal = attachedBillings.reduce((s, b) => s + b.amount_cents, 0);

  return (
    <div className="space-y-6">
      {/* Already attached */}
      {attachedBillings.length > 0 && (
        <div>
          <h3 className="text-[11px] tracking-[0.08em] uppercase text-cream-dim mb-3">
            Attached to This Draw
          </h3>
          <div className="border border-brand-border divide-y divide-brand-border">
            {attachedBillings.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3 bg-brand-card">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider bg-teal/20 text-teal">
                    INTERNAL
                  </span>
                  <span className="text-sm text-cream">
                    {b.internal_billing_types?.name ?? "—"}
                  </span>
                  {b.description && (
                    <span className="text-sm text-cream-dim">— {b.description}</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-cream tabular-nums">
                    {formatCents(b.amount_cents)}
                  </span>
                  {isDraft && (
                    <button
                      onClick={() => handleDetach(b.id)}
                      disabled={detachingId === b.id}
                      className="text-xs text-status-danger hover:underline disabled:opacity-50"
                    >
                      {detachingId === b.id ? "..." : "Detach"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="flex justify-between px-4 py-2 bg-brand-surface text-sm">
              <span className="text-cream-dim">Attached total</span>
              <span className="text-cream font-medium tabular-nums">{formatCents(attachedTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Draft billings available to attach */}
      {isDraft && draftBillings.length > 0 && (
        <div>
          <h3 className="text-[11px] tracking-[0.08em] uppercase text-cream-dim mb-3">
            Available to Attach
          </h3>

          {/* Base display */}
          <div className="mb-3 px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream-dim">
            Draw base (budget + CO lines): <span className="text-cream font-medium">{formatCents(baseCents)}</span>
          </div>

          <div className="border border-brand-border divide-y divide-brand-border">
            {draftBillings.map((b) => {
              const method = getMethodLabel(b);
              const checked = selected.has(b.id);
              const amount = computeAmount(b);

              return (
                <label
                  key={b.id}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                    checked ? "bg-teal/5" : "bg-brand-card hover:bg-brand-surface"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(b.id)}
                      className="accent-teal"
                    />
                    <span className="text-sm text-cream">
                      {b.internal_billing_types?.name ?? "—"}
                    </span>
                    {b.description && (
                      <span className="text-sm text-cream-dim">— {b.description}</span>
                    )}
                    {method === "percentage" && b.percentage && (
                      <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider bg-amber-500/20 text-amber-300">
                        {(b.percentage * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-cream tabular-nums">
                    {method === "percentage" && b.percentage ? (
                      <span>
                        {formatCents(amount)}{" "}
                        <span className="text-cream-dim text-xs">
                          (= base × {(b.percentage * 100).toFixed(0)}%)
                        </span>
                      </span>
                    ) : (
                      formatCents(amount)
                    )}
                  </div>
                </label>
              );
            })}

            {selected.size > 0 && (
              <div className="flex justify-between items-center px-4 py-3 bg-brand-surface">
                <span className="text-sm text-cream-dim">
                  {selected.size} selected — total: <span className="text-cream font-medium">{formatCents(selectedTotal)}</span>
                </span>
                <button
                  onClick={handleAttach}
                  disabled={attaching}
                  className="bg-teal text-white px-4 py-1.5 text-sm disabled:opacity-50"
                >
                  {attaching ? "Attaching..." : "Attach Selected"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isDraft && draftBillings.length === 0 && attachedBillings.length === 0 && (
        <div className="text-center py-8 text-cream-dim text-sm">
          No internal billings for this job.{" "}
          <a href={`/jobs/${jobId}/internal-billings`} className="text-teal hover:underline">
            Add billings
          </a>{" "}
          first, then attach them here.
        </div>
      )}

      {!isDraft && attachedBillings.length === 0 && (
        <div className="text-center py-8 text-cream-dim text-sm">
          No internal billings attached to this draw.
        </div>
      )}
    </div>
  );
}
