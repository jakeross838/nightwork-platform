"use client";

import { useState } from "react";
import { formatCents, formatDate } from "@/lib/utils/format";

export interface PaymentPanelInvoice {
  id: string;
  total_amount: number;
  received_date: string | null;
  scheduled_payment_date: string | null;
  payment_date: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_amount: number | null;
  payment_status: string | null;
  status: string;
  vendor_name_raw: string | null;
}

export interface PaymentPanelProps {
  invoice: PaymentPanelInvoice;
  onRefresh: () => void;
}

// Phase 8 — payment actions panel (Schedule Payment / Mark as Paid / Reverse).
export default function PaymentPanel({ invoice, onRefresh }: PaymentPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState<"check" | "ach" | "wire" | "credit_card">("check");
  const [payReference, setPayReference] = useState("");
  const [payAmount, setPayAmount] = useState((invoice.total_amount / 100).toFixed(2));

  const status = invoice.payment_status ?? "unpaid";
  const canPay = ["pm_approved", "qa_review", "qa_approved", "pushed_to_qb", "in_draw", "paid"].includes(invoice.status);

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/invoices/${invoice.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed" }));
      setError(data.error ?? "Failed");
    } else {
      onRefresh();
      setShowPayModal(false);
    }
    setBusy(false);
  }

  return (
    <>
      {/* Inline SidebarCard chrome — duplicated from page.tsx helper so this
          component is self-contained (Phase 1 rule: no shared-utility files). */}
      <div
        className="border p-5"
        style={{
          background: "var(--bg-card)",
          borderColor: "var(--border-default)",
        }}
      >
        <p
          className="text-[10px] uppercase mb-4"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.14em",
            color: "var(--text-tertiary)",
            fontWeight: 500,
          }}
        >
          Payment
        </p>
        <div>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-[color:var(--text-muted)]">Status</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium border ${
                  status === "paid"
                    ? "border-[rgba(74,138,111,0.5)] text-[color:var(--nw-success)]"
                    : status === "scheduled"
                      ? "border-[var(--nw-stone-blue)] text-[color:var(--nw-stone-blue)]"
                      : status === "partial"
                        ? "border-[var(--nw-warn)] text-[color:var(--nw-warn)]"
                        : "border-[var(--border-strong)] text-[color:var(--text-secondary)]"
                }`}
              >
                {status}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-[color:var(--text-muted)]">Received</span><span className="text-[color:var(--text-muted)]">{formatDate(invoice.received_date)}</span></div>
            {invoice.scheduled_payment_date && (
              <div className="flex justify-between"><span className="text-[color:var(--text-muted)]">Scheduled</span><span className="text-[color:var(--text-primary)]">{formatDate(invoice.scheduled_payment_date)}</span></div>
            )}
            {invoice.payment_date && (
              <div className="flex justify-between"><span className="text-[color:var(--text-muted)]">Paid</span><span className="text-[color:var(--text-primary)]">{formatDate(invoice.payment_date)}</span></div>
            )}
            {invoice.payment_method && (
              <div className="flex justify-between"><span className="text-[color:var(--text-muted)]">Method</span><span className="text-[color:var(--text-primary)]">{invoice.payment_method}</span></div>
            )}
            {invoice.payment_reference && (
              <div className="flex justify-between"><span className="text-[color:var(--text-muted)]">Reference</span><span className="text-[color:var(--text-primary)] font-mono text-xs">{invoice.payment_reference}</span></div>
            )}
            <div className="flex justify-between border-t border-[var(--border-default)] pt-2.5">
              <span className="text-[color:var(--text-muted)]">Total</span>
              <span className="text-[color:var(--text-primary)] font-display text-base font-medium">{formatCents(invoice.total_amount)}</span>
            </div>
            {invoice.payment_amount != null && invoice.payment_amount !== invoice.total_amount && (
              <div className="flex justify-between">
                <span className="text-[color:var(--text-muted)]">Paid so far</span>
                <span className="text-[color:var(--nw-warn)] font-display font-medium">{formatCents(invoice.payment_amount)}</span>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 bg-[rgba(176,85,78,0.12)] border border-[rgba(176,85,78,0.35)] px-3 py-2 text-xs text-[color:var(--nw-danger)]">
              {error}
            </div>
          )}

          {canPay && (
            <div className="mt-4 flex flex-col gap-2">
              {status === "unpaid" && (
                <button
                  onClick={() => call({ action: "schedule" })}
                  disabled={busy}
                  className="px-3 py-2 border border-[var(--nw-stone-blue)] text-[color:var(--nw-stone-blue)] hover:bg-[rgba(91,134,153,0.12)] disabled:opacity-50 text-sm font-medium transition-colors"
                >
                  {busy ? "Scheduling…" : "Schedule Payment"}
                </button>
              )}
              {status !== "paid" && (
                <button
                  onClick={() => setShowPayModal(true)}
                  disabled={busy}
                  className="px-3 py-2 bg-[var(--nw-stone-blue)] hover:bg-[var(--nw-gulf-blue)] disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  Mark as Paid
                </button>
              )}
              {(status === "paid" || status === "partial") && (
                <button
                  onClick={() => {
                    if (window.confirm("Reverse payment? This unmarks the invoice and clears payment fields.")) {
                      call({ action: "reverse" });
                    }
                  }}
                  disabled={busy}
                  className="px-3 py-2 border border-[rgba(176,85,78,0.5)] text-[color:var(--nw-danger)] hover:bg-[rgba(176,85,78,0.12)] disabled:opacity-50 text-sm font-medium transition-colors"
                >
                  Reverse Payment
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showPayModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={() => setShowPayModal(false)}>
          <div className="bg-[var(--bg-card)] border border-[var(--border-default)] max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg text-[color:var(--text-primary)] mb-1">Mark Invoice as Paid</h3>
            <p className="text-sm text-[color:var(--text-secondary)] mb-4">{invoice.vendor_name_raw ?? "Vendor"} — {formatCents(invoice.total_amount)}</p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider mb-1 block">Payment Date</span>
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider mb-1 block">Amount (dollars)</span>
                <input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider mb-1 block">Method</span>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as typeof payMethod)} className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none">
                  <option value="check">Check</option>
                  <option value="ach">ACH</option>
                  <option value="wire">Wire</option>
                  <option value="credit_card">Credit Card</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider mb-1 block">Reference (check #, txn ID)</span>
                <input type="text" value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="e.g. 10452" className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-default)] text-sm text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none" />
              </label>
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button onClick={() => setShowPayModal(false)} className="px-4 py-2 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] text-sm">Cancel</button>
              <button
                onClick={() =>
                  call({
                    action: "mark_paid",
                    payment_date: payDate,
                    payment_amount: Math.round(Number(payAmount) * 100),
                    payment_method: payMethod,
                    payment_reference: payReference || null,
                  })
                }
                disabled={busy}
                className="px-4 py-2 bg-[var(--nw-stone-blue)] hover:bg-[var(--nw-gulf-blue)] disabled:opacity-60 text-white text-sm font-medium transition-colors"
              >
                {busy ? "Recording…" : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
