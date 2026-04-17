"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCents } from "@/lib/utils/format";

type ChangeOrder = {
  id: string;
  pcco_number: number;
  title: string | null;
  description: string | null;
  amount: number;
  gc_fee_amount: number;
  gc_fee_rate: number;
  total_with_fee: number;
  application_number: number | null;
  co_type: string;
  status: string;
};

type Attached = {
  id: string;
  change_order_id: string;
  this_period: number;
  change_orders: ChangeOrder | null;
};

export default function DrawChangeOrders({
  drawId,
  editable,
}: {
  drawId: string;
  editable: boolean;
}) {
  const [attached, setAttached] = useState<Attached[]>([]);
  const [available, setAvailable] = useState<ChangeOrder[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const res = await fetch(`/api/draws/${drawId}/change-orders`);
    const data = await res.json();
    setAttached(data.attached ?? []);
    setAvailable(data.available ?? []);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [drawId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pendingTotal = useMemo(
    () =>
      available
        .filter((c) => selected.has(c.id))
        .reduce((s, c) => s + (c.total_with_fee ?? 0), 0),
    [available, selected]
  );

  async function attach() {
    if (selected.size === 0) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/draws/${drawId}/change-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ change_order_ids: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSelected(new Set());
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attach failed");
    } finally {
      setWorking(false);
    }
  }

  async function detach(coId: string) {
    if (!confirm("Remove this change order from the draw?")) return;
    setWorking(true);
    try {
      const res = await fetch(
        `/api/draws/${drawId}/change-orders?change_order_id=${coId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Detach failed");
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Detach failed");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <section className="mt-6">
        <h3 className="font-display text-lg text-cream mb-2">Change orders</h3>
        <div className="text-sm text-cream-dim">Loading…</div>
      </section>
    );
  }

  const hasAny = attached.length + available.length > 0;
  if (!hasAny) {
    return (
      <section className="mt-6">
        <h3 className="font-display text-lg text-cream mb-2">Change orders</h3>
        <p className="text-sm text-cream-dim">
          No approved change orders for this job yet.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <header className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg text-cream">Change orders</h3>
        {editable && selected.size > 0 && (
          <button
            onClick={attach}
            disabled={working}
            className="px-3 py-1.5 bg-teal text-white text-xs font-medium hover:bg-teal/90 disabled:opacity-60"
          >
            {working ? "Attaching…" : `Attach ${selected.size} (${formatCents(pendingTotal)})`}
          </button>
        )}
      </header>

      {attached.length > 0 && (
        <div className="border border-brand-border bg-brand-card overflow-hidden mb-4">
          <div className="px-3 py-2 bg-brand-surface/60 text-[11px] uppercase tracking-wider text-cream-dim">
            On this draw
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-cream-dim border-b border-brand-border">
                <th className="px-3 py-1.5">PCCO #</th>
                <th className="px-3 py-1.5">Description</th>
                <th className="px-3 py-1.5 text-right">Amount</th>
                <th className="px-3 py-1.5 text-right">Fee</th>
                <th className="px-3 py-1.5 text-right">Total</th>
                <th className="px-3 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {attached.map((a) => {
                const co = a.change_orders;
                if (!co) return null;
                return (
                  <tr key={a.id} className="border-b border-brand-row-border last:border-0">
                    <td className="px-3 py-2 text-cream">#{co.pcco_number}</td>
                    <td className="px-3 py-2 text-cream-dim">
                      {co.title ?? co.description ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-cream-dim tabular-nums">
                      {formatCents(co.amount)}
                    </td>
                    <td className="px-3 py-2 text-right text-cream-dim tabular-nums">
                      {formatCents(co.gc_fee_amount)} ({Math.round(Number(co.gc_fee_rate) * 100)}%)
                    </td>
                    <td className="px-3 py-2 text-right text-cream tabular-nums font-medium">
                      {formatCents(co.total_with_fee)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {editable && (
                        <button
                          onClick={() => detach(co.id)}
                          className="text-xs text-status-danger hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editable && available.length > 0 && (
        <div className="border border-brand-border bg-brand-card overflow-hidden">
          <div className="px-3 py-2 bg-brand-surface/60 text-[11px] uppercase tracking-wider text-cream-dim">
            Available to attach (approved, not yet on any draw)
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-cream-dim border-b border-brand-border">
                <th className="px-3 py-1.5 w-8" />
                <th className="px-3 py-1.5">PCCO #</th>
                <th className="px-3 py-1.5">Description</th>
                <th className="px-3 py-1.5 text-right">Amount</th>
                <th className="px-3 py-1.5 text-right">Fee</th>
                <th className="px-3 py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {available.map((co) => (
                <tr key={co.id} className="border-b border-brand-row-border last:border-0">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(co.id)}
                      onChange={() => toggle(co.id)}
                    />
                  </td>
                  <td className="px-3 py-2 text-cream">#{co.pcco_number}</td>
                  <td className="px-3 py-2 text-cream-dim">
                    {co.title ?? co.description ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-cream-dim tabular-nums">
                    {formatCents(co.amount)}
                  </td>
                  <td className="px-3 py-2 text-right text-cream-dim tabular-nums">
                    {formatCents(co.gc_fee_amount)} ({Math.round(Number(co.gc_fee_rate) * 100)}%)
                  </td>
                  <td className="px-3 py-2 text-right text-cream tabular-nums">
                    {formatCents(co.total_with_fee)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <div className="mt-3 border border-status-danger/40 bg-status-danger/5 px-3 py-2 text-sm text-status-danger">
          {error}
        </div>
      )}
    </section>
  );
}
