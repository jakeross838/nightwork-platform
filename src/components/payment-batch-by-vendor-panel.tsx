"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCents, formatDate } from "@/lib/utils/format";
import { toast } from "@/lib/utils/toast";

interface PaymentInvoice {
  id: string;
  vendor_name_raw: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  received_date: string | null;
  total_amount: number;
  status: string;
  payment_status: string;
  payment_date: string | null;
  payment_amount: number | null;
  payment_method: string | null;
  payment_reference: string | null;
  scheduled_payment_date: string | null;
  jobs: { id: string; name: string } | null;
  vendors: { id: string; name: string } | null;
}

type Method = "check" | "ach" | "wire" | "credit_card";

interface VendorGroup {
  vendor_id: string;
  vendor_name: string;
  invoices: PaymentInvoice[];
  total: number;
}

interface Receipt {
  vendor_id: string;
  vendor_name: string;
  invoice_count: number;
  total: number;
  payment_method: string;
  payment_reference: string | null;
  payment_date: string;
  missing_lien_release: boolean;
  draw_ids: string[];
}

export default function PaymentBatchByVendorPanel({
  invoices,
  onRefresh,
}: {
  invoices: PaymentInvoice[];
  onRefresh: () => Promise<void> | void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<Method>("check");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  // Per-vendor reference (check #, ACH ref, etc.)
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [perVendorMethod, setPerVendorMethod] = useState<Record<string, Method>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Build vendor groups from unpaid invoices.
  const groups: VendorGroup[] = useMemo(() => {
    const map = new Map<string, VendorGroup>();
    for (const inv of invoices) {
      if (inv.payment_status === "paid") continue;
      if (!inv.vendors?.id) continue;
      const key = inv.vendors.id;
      if (!map.has(key)) {
        map.set(key, {
          vendor_id: key,
          vendor_name: inv.vendors.name,
          invoices: [],
          total: 0,
        });
      }
      const g = map.get(key)!;
      g.invoices.push(inv);
      g.total += inv.total_amount;
    }
    return Array.from(map.values()).sort((a, b) => a.vendor_name.localeCompare(b.vendor_name));
  }, [invoices]);

  function toggleVendor(vendorId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(vendorId)) next.delete(vendorId);
      else next.add(vendorId);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === groups.length) setSelected(new Set());
    else setSelected(new Set(groups.map((g) => g.vendor_id)));
  }

  const selectedGroups = groups.filter((g) => selected.has(g.vendor_id));
  const selectedTotal = selectedGroups.reduce((s, g) => s + g.total, 0);
  const selectedInvoiceCount = selectedGroups.reduce((s, g) => s + g.invoices.length, 0);

  async function processBatch() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/invoices/payments/batch-by-vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_date: paymentDate,
          vendors: selectedGroups.map((g) => ({
            vendor_id: g.vendor_id,
            invoice_ids: g.invoices.map((i) => i.id),
            payment_method: perVendorMethod[g.vendor_id] ?? method,
            payment_reference: refs[g.vendor_id]?.trim() || null,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setReceipts(data.receipts);
        setShowConfirm(false);
        setSelected(new Set());
        await onRefresh();
        const n = data.receipts?.length ?? 0;
        toast.success(`Processed payment for ${n} vendor${n === 1 ? "" : "s"}`);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Batch failed");
        toast.error(data.error ?? "Payment batch failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Receipt screen overrides everything else.
  if (receipts) {
    return <ReceiptView receipts={receipts} onClose={() => setReceipts(null)} />;
  }

  return (
    <div className="space-y-5 animate-fade-up">
      {error && (
        <div className="bg-status-danger/10 border border-status-danger/40 px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      <div className="bg-brand-card border border-brand-border p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-display text-cream">Batch Payments by Vendor</p>
          <p className="text-xs text-cream-dim mt-0.5">
            Pay every unpaid invoice for one or more vendors at once. Reference is per-vendor.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-cream-dim">
            Payment date
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="px-2 py-1.5 bg-brand-surface border border-brand-border text-sm text-cream"
            />
          </label>
          <label className="flex items-center gap-2 text-cream-dim">
            Default method
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
              className="px-2 py-1.5 bg-brand-surface border border-brand-border text-sm text-cream"
            >
              <option value="check">Check</option>
              <option value="ach">ACH</option>
              <option value="wire">Wire</option>
              <option value="credit_card">Credit Card</option>
            </select>
          </label>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="border border-brand-border p-10 text-center text-cream-dim text-sm">
          No unpaid invoices to batch.
        </div>
      ) : (
        <div className="overflow-x-auto border border-brand-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-surface text-left">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === groups.length}
                    onChange={toggleAll}
                  />
                </th>
                <Th>Vendor</Th>
                <Th right>Invoices</Th>
                <Th right>Total</Th>
                <Th>Method</Th>
                <Th>Reference</Th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const sel = selected.has(g.vendor_id);
                return (
                  <tr
                    key={g.vendor_id}
                    className={`border-t border-brand-row-border ${
                      sel ? "bg-teal/5" : "hover:bg-brand-elevated/40"
                    }`}
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={() => toggleVendor(g.vendor_id)}
                      />
                    </td>
                    <td className="py-3 px-4 text-cream">{g.vendor_name}</td>
                    <td className="py-3 px-4 text-cream-muted text-right">{g.invoices.length}</td>
                    <td className="py-3 px-4 text-cream text-right font-display font-medium">
                      {formatCents(g.total)}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        disabled={!sel}
                        value={perVendorMethod[g.vendor_id] ?? method}
                        onChange={(e) =>
                          setPerVendorMethod((prev) => ({
                            ...prev,
                            [g.vendor_id]: e.target.value as Method,
                          }))
                        }
                        className="px-2 py-1 bg-brand-surface border border-brand-border text-xs text-cream disabled:opacity-50"
                      >
                        <option value="check">Check</option>
                        <option value="ach">ACH</option>
                        <option value="wire">Wire</option>
                        <option value="credit_card">Credit Card</option>
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        disabled={!sel}
                        value={refs[g.vendor_id] ?? ""}
                        onChange={(e) =>
                          setRefs((prev) => ({ ...prev, [g.vendor_id]: e.target.value }))
                        }
                        placeholder="Check # or ref"
                        className="w-32 px-2 py-1 bg-brand-surface border border-brand-border text-xs text-cream font-mono disabled:opacity-50"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-brand-bg/95 backdrop-blur border-t border-teal/40 flex items-center justify-between gap-3">
          <p className="text-sm text-cream">
            <span className="font-medium">Pay {selected.size} vendors</span> ·{" "}
            <span className="text-cream-dim">{selectedInvoiceCount} invoices</span> · Total{" "}
            <span className="text-brass font-display">{formatCents(selectedTotal)}</span>
          </p>
          <button
            onClick={() => setShowConfirm(true)}
            className="px-5 py-2 bg-teal hover:bg-teal-hover text-white text-sm font-medium uppercase tracking-wider"
          >
            Process Batch
          </button>
        </div>
      )}

      {showConfirm && (
        <ConfirmModal
          groups={selectedGroups}
          paymentDate={paymentDate}
          refs={refs}
          methods={perVendorMethod}
          defaultMethod={method}
          submitting={submitting}
          onCancel={() => setShowConfirm(false)}
          onConfirm={processBatch}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  groups,
  paymentDate,
  refs,
  methods,
  defaultMethod,
  submitting,
  onCancel,
  onConfirm,
}: {
  groups: VendorGroup[];
  paymentDate: string;
  refs: Record<string, string>;
  methods: Record<string, Method>;
  defaultMethod: Method;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const total = groups.reduce((s, g) => s + g.total, 0);
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={onCancel}>
      <div
        className="bg-brand-card border border-brand-border max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg text-cream mb-1">Confirm Batch Payment</h3>
        <p className="text-sm text-cream-dim mb-4">
          Payment date: <span className="text-cream">{formatDate(paymentDate)}</span> · {groups.length}{" "}
          vendors · {formatCents(total)}
        </p>
        <div className="border border-brand-border max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-surface text-left sticky top-0">
                <Th>Vendor</Th>
                <Th right>Invoices</Th>
                <Th right>Total</Th>
                <Th>Method</Th>
                <Th>Reference</Th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.vendor_id} className="border-t border-brand-row-border">
                  <td className="py-2 px-3 text-cream">{g.vendor_name}</td>
                  <td className="py-2 px-3 text-cream-muted text-right">{g.invoices.length}</td>
                  <td className="py-2 px-3 text-cream text-right font-display">{formatCents(g.total)}</td>
                  <td className="py-2 px-3 text-cream-muted">{methods[g.vendor_id] ?? defaultMethod}</td>
                  <td className="py-2 px-3 text-cream-muted font-mono text-xs">
                    {refs[g.vendor_id]?.trim() || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-cream-dim hover:text-cream text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="px-4 py-2 bg-teal hover:bg-teal-hover disabled:opacity-50 text-white text-sm font-medium"
          >
            {submitting ? "Processing…" : `Pay ${groups.length} vendors`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiptView({ receipts, onClose }: { receipts: Receipt[]; onClose: () => void }) {
  const total = receipts.reduce((s, r) => s + r.total, 0);
  return (
    <div className="print-area space-y-4 animate-fade-up">
      {/* Print-only header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-semibold">Payment Batch Receipt</h1>
        <p className="text-sm">
          {receipts.length} vendor{receipts.length === 1 ? "" : "s"} ·{" "}
          {receipts.reduce((s, r) => s + r.invoice_count, 0)} invoices · {formatCents(total)}
        </p>
      </div>
      <div className="bg-status-success/10 border border-status-success/40 p-4 flex items-center justify-between gap-3 flex-wrap print:hidden">
        <div>
          <p className="text-status-success font-display text-lg">Batch payment complete</p>
          <p className="text-xs text-cream-dim mt-0.5">
            {receipts.length} vendors · {receipts.reduce((s, r) => s + r.invoice_count, 0)} invoices ·{" "}
            {formatCents(total)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 border border-brand-border text-cream text-sm hover:bg-brand-elevated"
          >
            Print
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-teal hover:bg-teal-hover text-white text-sm"
          >
            Done
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-brand-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-surface text-left">
              <Th>Vendor</Th>
              <Th right>Invoices</Th>
              <Th right>Total</Th>
              <Th>Method</Th>
              <Th>Reference</Th>
              <Th>Date</Th>
              <Th>Lien</Th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((r) => (
              <tr key={r.vendor_id} className="border-t border-brand-row-border">
                <td className="py-3 px-4 text-cream">{r.vendor_name}</td>
                <td className="py-3 px-4 text-cream-muted text-right">{r.invoice_count}</td>
                <td className="py-3 px-4 text-cream text-right font-display">{formatCents(r.total)}</td>
                <td className="py-3 px-4 text-cream-muted">{r.payment_method}</td>
                <td className="py-3 px-4 text-cream-muted font-mono text-xs">
                  {r.payment_reference ?? "—"}
                </td>
                <td className="py-3 px-4 text-cream-muted text-xs">{formatDate(r.payment_date)}</td>
                <td className="py-3 px-4">
                  {r.missing_lien_release && r.draw_ids.length > 0 ? (
                    <Link
                      href={`/draws/${r.draw_ids[0]}`}
                      className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium border border-brass text-brass hover:bg-brass/10"
                    >
                      Lien missing
                    </Link>
                  ) : (
                    <span className="text-cream-dim text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`py-3 px-4 text-[10px] text-cream font-bold uppercase tracking-wider ${
        right ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}
