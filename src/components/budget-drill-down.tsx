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
  amount: number; // amount allocated to THIS budget line
  received_date: string | null;
  status: string;
  po_id: string | null;
  po_number: string | null;
  description_preview: string;
  description_full: string | null;
}

interface CORow {
  id: string;
  pcco_number: number | null;
  title: string | null;
  amount: number;
  status: string;
  approved_date: string | null;
}

interface ActivityRow {
  id: string;
  created_at: string;
  entity_type: string;
  action: string;
  user_name: string | null;
  details: Record<string, unknown> | null;
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
const PREVIEW_MAX = 120;

/**
 * Builds a short description preview for an invoice, narrowed to what was
 * charged to a specific budget line.
 *
 *   1. If invoice.description is set → use first PREVIEW_MAX chars.
 *   2. Else, concatenate descriptions from invoice_line_items whose
 *      budget_line_id equals the budget line we're drilling into. (Other
 *      line items on the same invoice, charged to different budget lines,
 *      are not relevant here.)
 *   3. Else → "No description available".
 */
function buildPreview(
  invoiceDescription: string | null | undefined,
  lineItemDescriptions: string[]
): { preview: string; full: string | null } {
  const inv = (invoiceDescription ?? "").trim();
  if (inv) {
    return {
      preview: inv.length > PREVIEW_MAX ? inv.slice(0, PREVIEW_MAX) + "…" : inv,
      full: inv,
    };
  }
  const concat = lineItemDescriptions
    .map((d) => (d ?? "").trim())
    .filter(Boolean)
    .join(" · ");
  if (concat) {
    return {
      preview: concat.length > PREVIEW_MAX ? concat.slice(0, PREVIEW_MAX) + "…" : concat,
      full: concat,
    };
  }
  return { preview: "No description available", full: null };
}

export default function BudgetDrillDown({
  budgetLineId,
  mode,
}: {
  budgetLineId: string;
  mode: Mode;
}) {
  const [pos, setPos] = useState<PORow[] | null>(null);
  // invoices split into PO-linked and direct-spend groups.
  const [invoicesByPo, setInvoicesByPo] = useState<Map<string, InvoiceRow[]> | null>(null);
  const [directInvoices, setDirectInvoices] = useState<InvoiceRow[] | null>(null);
  const [cos, setCos] = useState<CORow[] | null>(null);
  const [activity, setActivity] = useState<ActivityRow[] | null>(null);
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
          "id, original_estimate, revised_estimate, committed, invoiced, co_adjustments, description, cost_codes:cost_code_id (code, description)"
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
          description: string | null;
          cost_codes:
            | { code: string; description: string }
            | { code: string; description: string }[]
            | null;
        };
        const cc = Array.isArray(raw.cost_codes) ? raw.cost_codes[0] : raw.cost_codes;
        setLine({
          code: cc?.code ?? "—",
          description: raw.description || cc?.description || "—",
          original_estimate: raw.original_estimate ?? 0,
          revised_estimate: raw.revised_estimate ?? 0,
          committed: raw.committed ?? 0,
          invoiced: raw.invoiced ?? 0,
          co_adjustments: raw.co_adjustments ?? 0,
        });
      }

      const wantsPOs = mode === "committed" || mode === "full";
      const wantsInvoices = mode === "invoiced" || mode === "committed" || mode === "full";
      const wantsCOs = mode === "co" || mode === "full";
      const wantsActivity = mode === "full";

      if (wantsPOs) {
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

      if (wantsInvoices) {
        const { data: invRows } = await supabase
          .from("invoice_line_items")
          .select(
            `amount_cents, po_id, description, invoice_id,
             invoices:invoice_id (
               id, description, invoice_number, total_amount, received_date, status, deleted_at,
               vendor_name_raw, vendors:vendor_id (name)
             ),
             purchase_orders:po_id (po_number)`
          )
          .eq("budget_line_id", budgetLineId)
          .is("deleted_at", null);

        type Row = {
          amount_cents: number;
          po_id: string | null;
          description: string | null;
          invoice_id: string;
          invoices: {
            id: string;
            description: string | null;
            invoice_number: string | null;
            total_amount: number;
            received_date: string | null;
            status: string;
            deleted_at: string | null;
            vendor_name_raw: string | null;
            vendors: { name: string } | { name: string }[] | null;
          } | null;
          purchase_orders: { po_number: string | null } | null;
        };

        const mapByInv = new Map<
          string,
          {
            inv: NonNullable<Row["invoices"]>;
            po_id: string | null;
            po_number: string | null;
            amount: number;
            lineDescriptions: string[];
          }
        >();

        for (const liRaw of (invRows ?? []) as unknown as Row[]) {
          const invAny = (liRaw as { invoices: unknown }).invoices;
          const inv = Array.isArray(invAny) ? invAny[0] : invAny;
          if (!inv) continue;
          const typedInv = inv as NonNullable<Row["invoices"]>;
          if (typedInv.deleted_at) continue;
          if (!INVOICE_COUNTING_STATUSES.includes(typedInv.status)) continue;
          const poAny = (liRaw as { purchase_orders: unknown }).purchase_orders;
          const po = Array.isArray(poAny) ? poAny[0] : poAny;

          const existing = mapByInv.get(typedInv.id);
          if (existing) {
            existing.amount += liRaw.amount_cents ?? 0;
            if (liRaw.description) existing.lineDescriptions.push(liRaw.description);
          } else {
            mapByInv.set(typedInv.id, {
              inv: typedInv,
              po_id: liRaw.po_id,
              po_number: (po as { po_number?: string | null } | null)?.po_number ?? null,
              amount: liRaw.amount_cents ?? 0,
              lineDescriptions: liRaw.description ? [liRaw.description] : [],
            });
          }
        }

        const poGroup = new Map<string, InvoiceRow[]>();
        const direct: InvoiceRow[] = [];
        for (const entry of Array.from(mapByInv.values())) {
          const { preview, full } = buildPreview(
            entry.inv.description,
            entry.lineDescriptions
          );
          const vendor = Array.isArray(entry.inv.vendors)
            ? entry.inv.vendors[0]?.name
            : entry.inv.vendors?.name;
          const row: InvoiceRow = {
            id: entry.inv.id,
            vendor: vendor ?? entry.inv.vendor_name_raw ?? null,
            invoice_number: entry.inv.invoice_number,
            amount: entry.amount,
            received_date: entry.inv.received_date,
            status: entry.inv.status,
            po_id: entry.po_id,
            po_number: entry.po_number,
            description_preview: preview,
            description_full: full,
          };
          if (entry.po_id) {
            const arr = poGroup.get(entry.po_id) ?? [];
            arr.push(row);
            poGroup.set(entry.po_id, arr);
          } else {
            direct.push(row);
          }
        }
        if (!cancelled) {
          setInvoicesByPo(poGroup);
          setDirectInvoices(direct);
        }
      }

      if (wantsCOs) {
        const { data: coRows } = await supabase
          .from("change_order_lines")
          .select(
            `amount,
             change_orders:co_id (id, pcco_number, description, status, approved_date, deleted_at)`
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
              status: c.status,
              approved_date: c.approved_date,
            });
          }
        }
        if (!cancelled) setCos(out);
      }

      if (wantsActivity) {
        const { data: actRows } = await supabase
          .from("activity_log")
          .select("id, created_at, entity_type, action, user_id, details")
          .eq("entity_type", "budget_line")
          .eq("entity_id", budgetLineId)
          .order("created_at", { ascending: false })
          .limit(10);
        const rows =
          (actRows as Array<{
            id: string;
            created_at: string;
            entity_type: string;
            action: string;
            user_id: string | null;
            details: Record<string, unknown> | null;
          }> | null) ?? [];
        const userIds = Array.from(
          new Set(rows.map((a) => a.user_id).filter((id): id is string => !!id))
        );
        const nameById = new Map<string, string>();
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds);
          for (const p of profiles ?? []) {
            nameById.set(
              (p as { id: string }).id,
              (p as { full_name: string }).full_name
            );
          }
        }
        if (!cancelled) {
          setActivity(
            rows.map((a) => ({
              id: a.id,
              created_at: a.created_at,
              entity_type: a.entity_type,
              action: a.action,
              user_name: a.user_id ? nameById.get(a.user_id) ?? null : null,
              details: a.details,
            }))
          );
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [budgetLineId, mode]);

  const directTotal = directInvoices
    ? directInvoices.reduce((s, r) => s + r.amount, 0)
    : null;
  const coNet = cos ? cos.reduce((s, r) => s + r.amount, 0) : null;
  const poCommittedTotal = pos ? pos.reduce((s, r) => s + r.amount, 0) : null;

  return (
    <div className="space-y-6">
      {mode === "full" && line && (
        <section className="bg-[rgba(91,134,153,0.06)] border border-[var(--border-default)] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[color:var(--text-secondary)] font-medium">
            Reconciliation
          </p>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1.5 text-[12px]">
            <ReconLine label="Original" value={formatCents(line.original_estimate)} />
            <ReconLine label="CO +/−" value={formatCents(line.co_adjustments)} />
            <ReconLine label="Revised" value={formatCents(line.revised_estimate)} strong />
            <ReconLine label="Committed" value={formatCents(line.committed)} />
            <ReconLine label="Invoiced" value={formatCents(line.invoiced)} />
            <ReconLine
              label="Remaining"
              value={formatCents(line.revised_estimate - line.invoiced)}
            />
            <ReconLine
              label="Variance"
              value={formatCents(
                line.revised_estimate -
                  line.invoiced -
                  Math.max(0, line.committed - line.invoiced)
              )}
              tone={
                line.revised_estimate -
                  line.invoiced -
                  Math.max(0, line.committed - line.invoiced) <
                0
                  ? "negative"
                  : "positive"
              }
            />
          </div>
        </section>
      )}

      {(mode === "committed" || mode === "full") && (
        <Section title="Purchase Orders" total={poCommittedTotal}>
          {pos === null || invoicesByPo === null ? (
            <Loading />
          ) : pos.length === 0 ? (
            <Empty label="No open POs against this line." />
          ) : (
            <ul className="divide-y divide-[var(--border-default)]">
              {pos.map((p) => {
                const nested = invoicesByPo.get(p.id) ?? [];
                const remaining = Math.max(0, p.amount - p.invoiced_total);
                return (
                  <li key={p.id} className="py-3 text-[12px]">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/purchase-orders/${p.id}`}
                          className="text-[color:var(--text-primary)] font-medium hover:text-[color:var(--nw-stone-blue)] transition-colors"
                        >
                          {p.po_number ? `PO ${p.po_number}` : "PO"}
                        </Link>
                        <span className="text-[color:var(--text-secondary)] ml-2">· {p.vendor ?? "—"}</span>
                        <p className="mt-0.5 text-[11px] text-[color:var(--text-secondary)] uppercase tracking-wider">
                          {p.status.replace(/_/g, " ")}
                        </p>
                      </div>
                      <div className="text-right shrink-0 tabular-nums">
                        <p className="text-[color:var(--text-primary)]">{formatCents(p.amount)}</p>
                        <p className="text-[11px] text-[color:var(--text-secondary)]">
                          Invoiced {formatCents(p.invoiced_total)} · Remaining{" "}
                          {formatCents(remaining)}
                        </p>
                      </div>
                    </div>

                    {/* Nested invoices under this PO */}
                    {nested.length > 0 && (
                      <ul className="mt-2 pl-3 border-l-2 border-[var(--border-default)] divide-y divide-[var(--border-default)]">
                        {nested.map((i) => (
                          <InvoiceItem key={i.id} row={i} showPoBadge={false} />
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      )}

      {mode === "invoiced" && (
        <>
          {/* Invoiced-only mode: group by PO for PO-linked invoices, then Direct Spend. */}
          <Section
            title="Against PO"
            total={
              invoicesByPo
                ? Array.from(invoicesByPo.values()).reduce(
                    (s, arr) => s + arr.reduce((a, r) => a + r.amount, 0),
                    0
                  )
                : null
            }
          >
            {invoicesByPo === null ? (
              <Loading />
            ) : invoicesByPo.size === 0 ? (
              <Empty label="No PO-linked invoices on this line." />
            ) : (
              <ul className="divide-y divide-[var(--border-default)]">
                {Array.from(invoicesByPo.entries()).map(([poId, rows]) => (
                  <li key={poId} className="py-2">
                    <p className="text-[11px] text-[color:var(--text-secondary)] uppercase tracking-wider">
                      {rows[0]?.po_number ? `PO ${rows[0].po_number}` : "PO"}
                    </p>
                    <ul className="mt-1 divide-y divide-[var(--border-default)]">
                      {rows.map((r) => (
                        <InvoiceItem key={r.id} row={r} showPoBadge={false} />
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Direct Spend (no PO)" total={directTotal}>
            {directInvoices === null ? (
              <Loading />
            ) : directInvoices.length === 0 ? (
              <Empty label="No direct-spend invoices on this line." />
            ) : (
              <ul className="divide-y divide-[var(--border-default)]">
                {directInvoices.map((r) => (
                  <InvoiceItem key={r.id} row={r} showPoBadge={false} />
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      {mode === "full" && (
        <Section title="Direct Spend (no PO)" total={directTotal}>
          {directInvoices === null ? (
            <Loading />
          ) : directInvoices.length === 0 ? (
            <Empty label="No direct-spend invoices on this line." />
          ) : (
            <ul className="divide-y divide-[var(--border-default)]">
              {directInvoices.map((r) => (
                <InvoiceItem key={r.id} row={r} showPoBadge={false} />
              ))}
            </ul>
          )}
        </Section>
      )}

      {(mode === "co" || mode === "full") && (
        <Section title="Change Orders" total={coNet}>
          {cos === null ? (
            <Loading />
          ) : cos.length === 0 ? (
            <Empty label="No approved change orders affecting this line." />
          ) : (
            <ul className="divide-y divide-[var(--border-default)]">
              {cos.map((c) => (
                <li key={c.id} className="py-3 text-[12px]">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/change-orders/${c.id}`}
                        className="text-[color:var(--text-primary)] font-medium hover:text-[color:var(--nw-stone-blue)] transition-colors"
                      >
                        {c.pcco_number ? `PCCO ${c.pcco_number}` : "CO"}
                      </Link>
                      <span className="text-[color:var(--text-secondary)] ml-2">· {c.title ?? "—"}</span>
                      <p className="mt-0.5 text-[11px] text-[color:var(--text-secondary)]">
                        {c.status.replace(/_/g, " ")} · Approved {formatDate(c.approved_date)}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 tabular-nums font-medium ${
                        c.amount < 0 ? "text-[color:var(--nw-danger)]" : "text-[color:var(--nw-success)]"
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

      {mode === "full" && (
        <Section title="Timeline" total={null}>
          {activity === null ? (
            <Loading />
          ) : activity.length === 0 ? (
            <Empty label="No activity recorded for this line yet." />
          ) : (
            <ul className="divide-y divide-[var(--border-default)]">
              {activity.map((a) => (
                <li key={a.id} className="py-2 flex items-start gap-3 text-[12px]">
                  <span className="text-[color:var(--text-secondary)] tabular-nums shrink-0 w-28">
                    {formatActivityTs(a.created_at)}
                  </span>
                  <span className="text-[color:var(--text-primary)] flex-1">
                    <span className="font-medium">
                      {formatEntityAction(a.entity_type, a.action)}
                    </span>
                    {summarizeDetails(a.details) && (
                      <span className="text-[color:var(--text-secondary)]"> · {summarizeDetails(a.details)}</span>
                    )}
                  </span>
                  <span className="text-[color:var(--text-secondary)] shrink-0">{a.user_name ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}

function InvoiceItem({
  row,
  showPoBadge,
}: {
  row: InvoiceRow;
  showPoBadge: boolean;
}) {
  return (
    <li className="py-2.5 text-[12px]">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/invoices/${row.id}`}
              className="text-[color:var(--text-primary)] font-medium hover:text-[color:var(--nw-stone-blue)] transition-colors"
            >
              {row.vendor ?? "—"}
            </Link>
            {row.invoice_number && (
              <span className="text-[color:var(--text-secondary)]">· #{row.invoice_number}</span>
            )}
            <span
              className={`inline-block px-1.5 py-0.5 text-[9px] uppercase tracking-wider border ${
                row.status === "paid"
                  ? "border-[rgba(74,138,111,0.4)] text-[color:var(--nw-success)]"
                  : row.status === "in_draw"
                    ? "border-[rgba(91,134,153,0.4)] text-[color:var(--nw-stone-blue)]"
                    : "border-[var(--border-default)] text-[color:var(--text-secondary)]"
              }`}
            >
              {row.status.replace(/_/g, " ")}
            </span>
            {showPoBadge && row.po_number && (
              <span className="text-[11px] text-[color:var(--text-secondary)]">PO {row.po_number}</span>
            )}
            {showPoBadge && !row.po_number && (
              <span className="text-[11px] text-[color:var(--text-secondary)]">direct</span>
            )}
          </div>
          <p
            className="mt-1 text-[11px] text-[color:var(--text-muted)] leading-snug"
            title={row.description_full ?? undefined}
          >
            {row.description_preview}
          </p>
          <p className="mt-0.5 text-[10px] text-[color:var(--text-secondary)]">
            {formatDate(row.received_date)}
          </p>
        </div>
        <p className="text-[color:var(--text-primary)] shrink-0 tabular-nums">{formatCents(row.amount)}</p>
      </div>
    </li>
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
        <h3 className="font-display text-sm text-[color:var(--text-primary)]">{title}</h3>
        {total !== null && (
          <span className="text-[12px] text-[color:var(--text-secondary)] tabular-nums">
            Total <span className="text-[color:var(--text-primary)] font-medium">{formatCents(total)}</span>
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
      <div className="w-5 h-5 border-2 border-[rgba(91,134,153,0.3)] border-t-[var(--nw-stone-blue)] animate-spin" />
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-[12px] text-[color:var(--text-secondary)] py-3">{label}</p>;
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
      ? "text-[color:var(--nw-success)]"
      : tone === "negative"
        ? "text-[color:var(--nw-danger)]"
        : "text-[color:var(--text-primary)]";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[color:var(--text-secondary)]">{label}</span>
      <span
        className={`text-right tabular-nums ${toneClass} ${strong ? "font-semibold" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function formatActivityTs(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatEntityAction(entity: string, action: string) {
  const e = entity.replace(/_/g, " ");
  const a = action.replace(/_/g, " ");
  return `${e[0].toUpperCase()}${e.slice(1)} ${a}`;
}

function summarizeDetails(details: Record<string, unknown> | null): string | null {
  if (!details) return null;
  if (typeof details.from === "object" && typeof details.to === "object" && details.from && details.to) {
    const f = (details.from as Record<string, unknown>).original_estimate;
    const t = (details.to as Record<string, unknown>).original_estimate;
    if (typeof f === "number" && typeof t === "number") {
      return `original ${formatCents(f)} → ${formatCents(t)}`;
    }
  }
  if (typeof details.field === "string") {
    const to = details.to;
    if (typeof to === "number" || typeof to === "string" || typeof to === "boolean") {
      return `${details.field} → ${String(to)}`;
    }
    return `${details.field} changed`;
  }
  return null;
}
