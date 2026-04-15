"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate } from "@/lib/utils/format";

type Mode = "committed" | "invoiced" | "co" | "full";

interface PORow {
  id: string;
  po_number: string | null;
  vendor: string | null;
  amount: number;
  invoiced_total: number;
  status: string;
}

interface InvoiceRow {
  id: string;
  vendor: string | null;
  invoice_number: string | null;
  amount: number;
  received_date: string | null;
  status: string;
  po_number: string | null;
}

interface CORow {
  id: string;
  pcco_number: number | null;
  title: string | null;
  amount: number;
  approved_date: string | null;
}

const PO_OPEN_STATUSES = ["issued", "partially_invoiced", "fully_invoiced"];
const INVOICE_COUNTING_STATUSES = [
  "pm_approved",
  "qa_review",
  "qa_approved",
  "pushed_to_qb",
  "in_draw",
  "paid",
];
const CO_APPROVED_STATUSES = ["approved", "executed"];

/**
 * Panel body for a single budget line's drill-down. Loaded when the user
 * clicks Committed / Invoiced / CO +/- / line description on the budget
 * table. "full" mode shows all three sections stacked (used when clicking
 * the line description).
 */
export default function BudgetDrillDown({
  budgetLineId,
  mode,
}: {
  budgetLineId: string;
  mode: Mode;
}) {
  const [pos, setPos] = useState<PORow[] | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [cos, setCos] = useState<CORow[] | null>(null);
  const [line, setLine] = useState<{
    code: string;
    description: string;
    original_estimate: number;
    revised_estimate: number;
    committed: number;
    invoiced: number;
    co_adjustments: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Always fetch the budget line header (used by every mode).
      const { data: bl } = await supabase
        .from("budget_lines")
        .select(
          "id, original_estimate, revised_estimate, committed, invoiced, co_adjustments, cost_codes:cost_code_id (code, description)"
        )
        .eq("id", budgetLineId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!cancelled && bl) {
        const raw = bl as unknown as {
          original_estimate: number;
          revised_estimate: number;
          committed: number;
          invoiced: number;
          co_adjustments: number;
          cost_codes: { code: string; description: string } | { code: string; description: string }[] | null;
        };
        const cc = Array.isArray(raw.cost_codes) ? raw.cost_codes[0] : raw.cost_codes;
        setLine({
          code: cc?.code ?? "—",
          description: cc?.description ?? "—",
          original_estimate: raw.original_estimate ?? 0,
          revised_estimate: raw.revised_estimate ?? 0,
          committed: raw.committed ?? 0,
          invoiced: raw.invoiced ?? 0,
          co_adjustments: raw.co_adjustments ?? 0,
        });
      }

      if (mode === "committed" || mode === "full") {
        // POs whose header points at this line OR whose po_line_items point
        // at it. Either way we want the PO row and an invoiced-against
        // rollup.
        const [{ data: headerPOs }, { data: lineItems }] = await Promise.all([
          supabase
            .from("purchase_orders")
            .select(
              "id, po_number, amount, invoiced_total, status, vendors:vendor_id (name)"
            )
            .eq("budget_line_id", budgetLineId)
            .is("deleted_at", null)
            .in("status", PO_OPEN_STATUSES),
          supabase
            .from("po_line_items")
            .select(
              "po_id, amount, purchase_orders!inner(id, po_number, amount, invoiced_total, status, deleted_at, vendor_id, vendors:vendor_id (name))"
            )
            .eq("budget_line_id", budgetLineId)
            .is("deleted_at", null),
        ]);
        const seen = new Set<string>();
        const rows: PORow[] = [];
        for (const po of headerPOs ?? []) {
          const r = po as {
            id: string;
            po_number: string | null;
            amount: number;
            invoiced_total: number;
            status: string;
            vendors: { name: string } | { name: string }[] | null;
          };
          const vendor = Array.isArray(r.vendors) ? r.vendors[0]?.name : r.vendors?.name;
          if (!seen.has(r.id)) {
            seen.add(r.id);
            rows.push({
              id: r.id,
              po_number: r.po_number,
              vendor: vendor ?? null,
              amount: r.amount ?? 0,
              invoiced_total: r.invoiced_total ?? 0,
              status: r.status,
            });
          }
        }
        for (const li of lineItems ?? []) {
          const poRaw = (li as { purchase_orders: unknown }).purchase_orders;
          const po = Array.isArray(poRaw) ? poRaw[0] : poRaw;
          if (!po) continue;
          const p = po as {
            id: string;
            po_number: string | null;
            amount: number;
            invoiced_total: number;
            status: string;
            deleted_at: string | null;
            vendors: { name: string } | { name: string }[] | null;
          };
          if (p.deleted_at) continue;
          if (!PO_OPEN_STATUSES.includes(p.status)) continue;
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          const vendor = Array.isArray(p.vendors) ? p.vendors[0]?.name : p.vendors?.name;
          rows.push({
            id: p.id,
            po_number: p.po_number,
            vendor: vendor ?? null,
            amount: p.amount ?? 0,
            invoiced_total: p.invoiced_total ?? 0,
            status: p.status,
          });
        }
        if (!cancelled) setPos(rows);
      }

      if (mode === "invoiced" || mode === "full") {
        const { data: invRows } = await supabase
          .from("invoice_line_items")
          .select(
            `amount_cents, po_id,
             invoices:invoice_id (
               id, invoice_number, total_amount, received_date, status, deleted_at,
               vendor_name_raw, vendors:vendor_id (name)
             ),
             purchase_orders:po_id (po_number)`
          )
          .eq("budget_line_id", budgetLineId)
          .is("deleted_at", null);
        const out: InvoiceRow[] = [];
        const seenInv = new Set<string>();
        for (const li of invRows ?? []) {
          const invRaw = (li as { invoices: unknown }).invoices;
          const inv = Array.isArray(invRaw) ? invRaw[0] : invRaw;
          if (!inv) continue;
          const i = inv as {
            id: string;
            invoice_number: string | null;
            total_amount: number;
            received_date: string | null;
            status: string;
            deleted_at: string | null;
            vendor_name_raw: string | null;
            vendors: { name: string } | { name: string }[] | null;
          };
          if (i.deleted_at) continue;
          if (!INVOICE_COUNTING_STATUSES.includes(i.status)) continue;
          // Dedup by invoice id — we list each invoice once even if it has
          // multiple lines on this budget line, showing the LINE amount
          // summed.
          const poRaw = (li as { purchase_orders: unknown }).purchase_orders;
          const po = Array.isArray(poRaw) ? poRaw[0] : poRaw;
          const vendor = Array.isArray(i.vendors) ? i.vendors[0]?.name : i.vendors?.name;
          const amt = (li as { amount_cents: number }).amount_cents ?? 0;
          if (seenInv.has(i.id)) {
            // Sum into the existing row.
            const existing = out.find((r) => r.id === i.id);
            if (existing) existing.amount += amt;
          } else {
            seenInv.add(i.id);
            out.push({
              id: i.id,
              vendor: vendor ?? i.vendor_name_raw ?? null,
              invoice_number: i.invoice_number,
              amount: amt,
              received_date: i.received_date,
              status: i.status,
              po_number: (po as { po_number: string | null } | null)?.po_number ?? null,
            });
          }
        }
        if (!cancelled) setInvoices(out);
      }

      if (mode === "co" || mode === "full") {
        const { data: coRows } = await supabase
          .from("change_order_lines")
          .select(
            `amount,
             change_orders:change_order_id (id, pcco_number, description, status, approved_date, deleted_at)`
          )
          .eq("budget_line_id", budgetLineId)
          .is("deleted_at", null);
        const out: CORow[] = [];
        const seenCo = new Set<string>();
        for (const li of coRows ?? []) {
          const coRaw = (li as { change_orders: unknown }).change_orders;
          const co = Array.isArray(coRaw) ? coRaw[0] : coRaw;
          if (!co) continue;
          const c = co as {
            id: string;
            pcco_number: number | null;
            description: string | null;
            status: string;
            approved_date: string | null;
            deleted_at: string | null;
          };
          if (c.deleted_at) continue;
          if (!CO_APPROVED_STATUSES.includes(c.status)) continue;
          const amt = (li as { amount: number }).amount ?? 0;
          if (seenCo.has(c.id)) {
            const existing = out.find((r) => r.id === c.id);
            if (existing) existing.amount += amt;
          } else {
            seenCo.add(c.id);
            out.push({
              id: c.id,
              pcco_number: c.pcco_number,
              title: c.description,
              amount: amt,
              approved_date: c.approved_date,
            });
          }
        }
        if (!cancelled) setCos(out);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [budgetLineId, mode]);

  return (
    <div className="space-y-6">
      {mode === "full" && line && (
        <section className="bg-brand-surface/40 border border-brand-border p-4">
          <p className="text-[11px] uppercase tracking-wider text-cream-dim font-medium">
            Reconciliation
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
            <ReconLine label="Original" value={formatCents(line.original_estimate)} />
            <ReconLine label="CO +/−" value={formatCents(line.co_adjustments)} />
            <ReconLine label="Revised" value={formatCents(line.revised_estimate)} strong />
            <ReconLine label="Committed (POs)" value={formatCents(line.committed)} />
            <ReconLine label="Invoiced" value={formatCents(line.invoiced)} />
            <ReconLine
              label="Variance"
              value={formatCents(line.revised_estimate - line.invoiced - Math.max(0, line.committed - line.invoiced))}
              tone={
                line.revised_estimate - line.invoiced - Math.max(0, line.committed - line.invoiced) < 0
                  ? "negative"
                  : "positive"
              }
            />
          </div>
        </section>
      )}

      {(mode === "committed" || mode === "full") && (
        <Section title="Purchase Orders" total={pos?.reduce((s, r) => s + r.amount, 0) ?? null}>
          {pos === null ? (
            <Loading />
          ) : pos.length === 0 ? (
            <Empty label="No open POs against this line." />
          ) : (
            <ul className="divide-y divide-brand-row-border">
              {pos.map((p) => (
                <li key={p.id} className="py-3 text-[12px]">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/purchase-orders/${p.id}`}
                        className="text-cream font-medium hover:text-teal transition-colors"
                      >
                        {p.po_number ? `PO ${p.po_number}` : "PO"}
                      </Link>
                      <span className="text-cream-dim ml-2">· {p.vendor ?? "—"}</span>
                      <p className="mt-0.5 text-[11px] text-cream-dim uppercase tracking-wider">
                        {p.status.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <p className="text-cream">{formatCents(p.amount)}</p>
                      <p className="text-[11px] text-cream-dim">
                        Invoiced {formatCents(p.invoiced_total)} · Remaining{" "}
                        {formatCents(Math.max(0, p.amount - p.invoiced_total))}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {(mode === "invoiced" || mode === "full") && (
        <Section title="Invoices" total={invoices?.reduce((s, r) => s + r.amount, 0) ?? null}>
          {invoices === null ? (
            <Loading />
          ) : invoices.length === 0 ? (
            <Empty label="No approved invoices on this line." />
          ) : (
            <ul className="divide-y divide-brand-row-border">
              {invoices.map((i) => (
                <li key={i.id} className="py-3 text-[12px]">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/invoices/${i.id}`}
                        className="text-cream font-medium hover:text-teal transition-colors"
                      >
                        {i.vendor ?? "—"}
                      </Link>
                      <span className="text-cream-dim ml-2">
                        {i.invoice_number ? `· #${i.invoice_number}` : ""}
                      </span>
                      <p className="mt-0.5 text-[11px] text-cream-dim">
                        {formatDate(i.received_date)} · {i.status.replace(/_/g, " ")}
                        {i.po_number ? ` · PO ${i.po_number}` : " · direct"}
                      </p>
                    </div>
                    <p className="text-cream shrink-0 tabular-nums">
                      {formatCents(i.amount)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {(mode === "co" || mode === "full") && (
        <Section title="Change Orders" total={cos?.reduce((s, r) => s + r.amount, 0) ?? null}>
          {cos === null ? (
            <Loading />
          ) : cos.length === 0 ? (
            <Empty label="No approved COs affecting this line." />
          ) : (
            <ul className="divide-y divide-brand-row-border">
              {cos.map((c) => (
                <li key={c.id} className="py-3 text-[12px]">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/change-orders/${c.id}`}
                        className="text-cream font-medium hover:text-teal transition-colors"
                      >
                        {c.pcco_number ? `PCCO ${c.pcco_number}` : "CO"}
                      </Link>
                      <span className="text-cream-dim ml-2">· {c.title ?? "—"}</span>
                      <p className="mt-0.5 text-[11px] text-cream-dim">
                        Approved {formatDate(c.approved_date)}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 tabular-nums font-medium ${
                        c.amount < 0 ? "text-status-danger" : "text-status-success"
                      }`}
                    >
                      {c.amount > 0 ? "+" : ""}
                      {formatCents(c.amount)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  total,
  children,
}: {
  title: string;
  total: number | null;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-sm text-cream">{title}</h3>
        {total !== null && (
          <span className="text-[12px] text-cream-dim tabular-nums">
            Total <span className="text-cream font-medium">{formatCents(total)}</span>
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Loading() {
  return (
    <div className="py-6 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-teal/30 border-t-teal animate-spin" />
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-[12px] text-cream-dim py-3">{label}</p>;
}

function ReconLine({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-status-success"
      : tone === "negative"
        ? "text-status-danger"
        : "text-cream";
  return (
    <>
      <span className="text-cream-dim">{label}</span>
      <span
        className={`text-right tabular-nums ${toneClass} ${strong ? "font-semibold" : ""}`}
      >
        {value}
      </span>
    </>
  );
}
