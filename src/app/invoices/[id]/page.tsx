"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatCents, confidenceColor, confidenceLabel } from "@/lib/utils/format";

interface Job { id: string; name: string; address: string | null; }
interface CostCode { id: string; code: string; description: string; }
interface PurchaseOrder { id: string; po_number: string | null; description: string | null; amount: number; }
interface BudgetInfo { original_estimate: number; revised_estimate: number; total_spent: number; remaining: number; }

interface InvoiceData {
  id: string;
  job_id: string | null;
  vendor_id: string | null;
  cost_code_id: string | null;
  po_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  vendor_name_raw: string | null;
  job_reference_raw: string | null;
  po_reference_raw: string | null;
  description: string | null;
  line_items: Array<{ description: string; qty: number | null; unit: string | null; rate: number | null; amount: number; }>;
  total_amount: number;
  invoice_type: string | null;
  co_reference_raw: string | null;
  confidence_score: number;
  confidence_details: (Record<string, number> & { auto_fills?: Record<string, boolean> }) | null;
  status: string;
  status_history: Array<Record<string, unknown>>;
  received_date: string | null;
  payment_date: string | null;
  original_file_type: string | null;
  pm_overrides: Record<string, { old: unknown; new: unknown }> | null;
  signed_file_url: string | null;
  jobs: Job | null;
  vendors: { id: string; name: string } | null;
  cost_codes: CostCode | null;
}

export default function InvoiceReviewPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [jobId, setJobId] = useState("");
  const [costCodeId, setCostCodeId] = useState("");
  const [poId, setPoId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [invoiceType, setInvoiceType] = useState("");
  const [description, setDescription] = useState("");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [budgetInfo, setBudgetInfo] = useState<BudgetInfo | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [showNoteModal, setShowNoteModal] = useState<"hold" | "deny" | null>(null);

  useEffect(() => {
    async function fetchInvoice() {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (res.ok) {
        const data: InvoiceData = await res.json();
        setInvoice(data);
        setJobId(data.job_id ?? ""); setCostCodeId(data.cost_code_id ?? ""); setPoId(data.po_id ?? "");
        setInvoiceNumber(data.invoice_number ?? ""); setInvoiceDate(data.invoice_date ?? "");
        setTotalAmount(String(data.total_amount / 100)); setInvoiceType(data.invoice_type ?? "");
        setDescription(data.description ?? "");
      }
      setLoading(false);
    }
    fetchInvoice();
  }, [invoiceId]);

  useEffect(() => {
    async function fetchLookups() {
      const [jobsRes, codesRes] = await Promise.all([
        supabase.from("jobs").select("id, name, address").is("deleted_at", null).eq("status", "active").order("name"),
        supabase.from("cost_codes").select("id, code, description").is("deleted_at", null).order("sort_order"),
      ]);
      if (jobsRes.data) setJobs(jobsRes.data);
      if (codesRes.data) setCostCodes(codesRes.data);
    }
    fetchLookups();
  }, []);

  useEffect(() => {
    async function fetchPOs() {
      if (!jobId) { setPurchaseOrders([]); return; }
      const { data } = await supabase.from("purchase_orders").select("id, po_number, description, amount").eq("job_id", jobId).is("deleted_at", null).order("po_number");
      if (data) setPurchaseOrders(data);
    }
    fetchPOs();
  }, [jobId]);

  useEffect(() => {
    async function fetchBudget() {
      if (!jobId || !costCodeId) { setBudgetInfo(null); return; }
      const { data: bl } = await supabase.from("budget_lines").select("original_estimate, revised_estimate").eq("job_id", jobId).eq("cost_code_id", costCodeId).is("deleted_at", null).single();
      if (!bl) { setBudgetInfo(null); return; }
      const { data: spent } = await supabase.from("invoices").select("total_amount").eq("job_id", jobId).eq("cost_code_id", costCodeId).in("status", ["pm_approved","qa_review","qa_approved","pushed_to_qb","in_draw","paid"]).is("deleted_at", null);
      const totalSpent = spent?.reduce((s, i) => s + i.total_amount, 0) ?? 0;
      setBudgetInfo({ original_estimate: bl.original_estimate, revised_estimate: bl.revised_estimate, total_spent: totalSpent, remaining: bl.revised_estimate - totalSpent });
    }
    fetchBudget();
  }, [jobId, costCodeId]);

  const buildOverrides = useCallback(() => {
    if (!invoice) return {};
    const o: Record<string, { old: unknown; new: unknown }> = {};
    if (invoiceNumber !== (invoice.invoice_number ?? "")) o.invoice_number = { old: invoice.invoice_number, new: invoiceNumber };
    if (invoiceDate !== (invoice.invoice_date ?? "")) o.invoice_date = { old: invoice.invoice_date, new: invoiceDate };
    if (totalAmount !== String(invoice.total_amount / 100)) o.total_amount = { old: invoice.total_amount / 100, new: parseFloat(totalAmount) };
    if (invoiceType !== (invoice.invoice_type ?? "")) o.invoice_type = { old: invoice.invoice_type, new: invoiceType };
    if (description !== (invoice.description ?? "")) o.description = { old: invoice.description, new: description };
    if (jobId !== (invoice.job_id ?? "")) o.job_id = { old: invoice.job_id, new: jobId };
    if (costCodeId !== (invoice.cost_code_id ?? "")) o.cost_code_id = { old: invoice.cost_code_id, new: costCodeId };
    return o;
  }, [invoice, invoiceNumber, invoiceDate, totalAmount, invoiceType, description, jobId, costCodeId]);

  const handleAction = async (action: "approve" | "hold" | "deny" | "request_info", note?: string) => {
    setSaving(true);
    const overrides = buildOverrides();
    const updates: Record<string, unknown> = {};
    if (jobId) updates.job_id = jobId;
    if (costCodeId) updates.cost_code_id = costCodeId;
    if (poId) updates.po_id = poId;
    if (invoiceNumber !== (invoice?.invoice_number ?? "")) updates.invoice_number = invoiceNumber;
    if (invoiceDate !== (invoice?.invoice_date ?? "")) updates.invoice_date = invoiceDate;
    if (totalAmount !== String((invoice?.total_amount ?? 0) / 100)) updates.total_amount = Math.round(parseFloat(totalAmount) * 100);
    if (invoiceType !== (invoice?.invoice_type ?? "")) updates.invoice_type = invoiceType;
    if (description !== (invoice?.description ?? "")) updates.description = description;
    const res = await fetch(`/api/invoices/${invoiceId}/action`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note, pm_overrides: Object.keys(overrides).length > 0 ? overrides : undefined, updates: Object.keys(updates).length > 0 ? updates : undefined }),
    });
    setSaving(false);
    if (res.ok) router.push("/invoices/queue");
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-teal/30 border-t-teal animate-spin" />
    </div>
  );

  if (!invoice) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-status-danger font-display text-lg">Invoice not found</p>
    </div>
  );

  const isReviewable = ["pm_review", "ai_processed"].includes(invoice.status);
  const autoFills = (invoice.confidence_details as Record<string, unknown>)?.auto_fills as Record<string, boolean> | undefined;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-brand-border bg-brand-bg/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <Link href="/invoices/queue" className="text-cream-dim hover:text-cream transition-colors text-sm">
            &larr; Queue
          </Link>
          <h1 className="font-display text-xl text-cream">
            {invoice.vendor_name_raw ?? "Invoice"} <span className="text-cream-dim">&mdash;</span> {invoice.invoice_number ?? "No #"}
          </h1>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${confidenceColor(invoice.confidence_score)}`}>
            {Math.round(invoice.confidence_score * 100)}% {confidenceLabel(invoice.confidence_score)}
          </span>
          <span className="text-xs text-cream-dim bg-brand-surface px-2.5 py-1 rounded-full border border-brand-border">
            {invoice.status.replace(/_/g, " ")}
          </span>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 opacity-0 animate-fade-up">
          {/* Left: Document Preview */}
          <div className="xl:col-span-1">
            <div className="sticky top-24">
              <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-3 brass-underline">Original Document</p>
              <div className="mt-5">
                {invoice.signed_file_url ? (
                  invoice.original_file_type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={invoice.signed_file_url} alt="Invoice" className="w-full rounded-xl border border-brand-border" />
                  ) : (
                    <iframe src={invoice.signed_file_url} className="w-full h-[700px] rounded-xl border border-brand-border bg-brand-surface" title="Invoice PDF" />
                  )
                ) : (
                  <div className="h-64 rounded-xl border border-brand-border bg-brand-surface flex items-center justify-center">
                    <p className="text-cream-dim text-sm">No preview available</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Middle: Editable Form */}
          <div className="xl:col-span-1 space-y-6 opacity-0 animate-fade-up stagger-2">
            <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider brass-underline">Invoice Details</p>

            <div className="mt-5 space-y-4">
              <FormField label="Job" value={jobId} onChange={setJobId} type="select"
                options={[{ value: "", label: "— Select Job —" }, ...jobs.map(j => ({ value: j.id, label: `${j.name} — ${j.address ?? ""}` }))]}
                disabled={!isReviewable} aiFilled={!!autoFills?.job_id} />

              <FormField label="Cost Code" value={costCodeId} onChange={setCostCodeId} type="select"
                options={[{ value: "", label: "— Select Cost Code —" }, ...costCodes.map(c => ({ value: c.id, label: `${c.code} — ${c.description}` }))]}
                disabled={!isReviewable} aiFilled={!!autoFills?.cost_code_id} />

              {purchaseOrders.length > 0 && (
                <FormField label="Purchase Order" value={poId} onChange={setPoId} type="select"
                  options={[{ value: "", label: "— No PO —" }, ...purchaseOrders.map(p => ({ value: p.id, label: `${p.po_number ?? "PO"} — ${formatCents(p.amount)}` }))]}
                  disabled={!isReviewable} />
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Invoice #" value={invoiceNumber} onChange={setInvoiceNumber} disabled={!isReviewable} />
                <FormField label="Invoice Date" value={invoiceDate} onChange={setInvoiceDate} type="date" disabled={!isReviewable} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Total ($)" value={totalAmount} onChange={setTotalAmount} type="number" disabled={!isReviewable} />
                <FormField label="Type" value={invoiceType} onChange={setInvoiceType} type="select"
                  options={[{ value: "lump_sum", label: "Lump Sum" }, { value: "progress", label: "Progress" }, { value: "time_and_materials", label: "Time & Materials" }]}
                  disabled={!isReviewable} />
              </div>

              <FormField label="Description" value={description} onChange={setDescription} type="textarea" disabled={!isReviewable} />

              {/* Raw AI data */}
              <div className="border-t border-brand-border pt-4">
                <p className="text-[11px] text-cream-dim mb-2 uppercase tracking-wider">AI Parsed (raw)</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-cream-dim">
                  <div>Vendor: {invoice.vendor_name_raw ?? "—"}</div>
                  <div>Job Ref: {invoice.job_reference_raw ?? "—"}</div>
                  <div>PO Ref: {invoice.po_reference_raw ?? "—"}</div>
                  <div>CO Ref: {invoice.co_reference_raw ?? "—"}</div>
                </div>
              </div>

              {/* Line Items */}
              {invoice.line_items?.length > 0 && (
                <div className="border-t border-brand-border pt-4">
                  <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-2">Line Items</p>
                  <div className="overflow-x-auto rounded-lg border border-brand-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-brand-surface">
                          <th className="py-2 px-3 text-left text-cream-dim font-medium">Description</th>
                          <th className="py-2 px-3 text-right text-cream-dim font-medium">Qty</th>
                          <th className="py-2 px-3 text-right text-cream-dim font-medium">Rate</th>
                          <th className="py-2 px-3 text-right text-cream-dim font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.line_items.map((item, i) => (
                          <tr key={i} className="border-t border-brand-border/50">
                            <td className="py-2 px-3 text-cream-muted">{item.description}</td>
                            <td className="py-2 px-3 text-right text-cream-dim">{item.qty ?? "—"}</td>
                            <td className="py-2 px-3 text-right text-cream-dim">{item.rate != null ? `$${item.rate}` : "—"}</td>
                            <td className="py-2 px-3 text-right text-cream font-medium">${item.amount?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            {isReviewable && (
              <div className="border-t border-brand-border pt-6 space-y-3">
                <div className="flex gap-3">
                  <button onClick={() => handleAction("approve")} disabled={saving}
                    className="flex-1 px-4 py-3 bg-status-success hover:brightness-110 disabled:opacity-50 text-white font-medium rounded-xl transition-all">
                    {saving ? "Saving..." : "Approve"}
                  </button>
                  <button onClick={() => setShowNoteModal("hold")} disabled={saving}
                    className="flex-1 px-4 py-3 bg-brass hover:brightness-110 disabled:opacity-50 text-brand-bg font-medium rounded-xl transition-all">
                    Hold
                  </button>
                  <button onClick={() => setShowNoteModal("deny")} disabled={saving}
                    className="flex-1 px-4 py-3 bg-status-danger hover:brightness-110 disabled:opacity-50 text-white font-medium rounded-xl transition-all">
                    Deny
                  </button>
                </div>
                <button onClick={() => handleAction("request_info", "PM requesting additional information")} disabled={saving}
                  className="w-full px-4 py-2 border border-brand-border hover:border-brand-border-light text-cream-muted text-sm rounded-xl transition-colors">
                  Request Info
                </button>
              </div>
            )}
          </div>

          {/* Right: Sidebar */}
          <div className="xl:col-span-1 opacity-0 animate-fade-up stagger-4">
            <div className="sticky top-24 space-y-5">
              {/* Budget */}
              <SidebarCard title="Budget Status">
                {budgetInfo ? (
                  <div className="space-y-3">
                    <BudgetRow label="Original Estimate" value={budgetInfo.original_estimate} />
                    <BudgetRow label="Revised Estimate" value={budgetInfo.revised_estimate} />
                    <BudgetRow label="Total Spent" value={budgetInfo.total_spent} />
                    <div className="border-t border-brand-border pt-3">
                      <BudgetRow label="Remaining" value={budgetInfo.remaining}
                        highlight={budgetInfo.remaining < 0 ? "danger" : budgetInfo.remaining < invoice.total_amount ? "warning" : "success"} />
                    </div>
                    {budgetInfo.remaining < invoice.total_amount && (
                      <div className="mt-2 px-3 py-2 bg-status-danger-muted border border-status-danger/20 rounded-lg">
                        <p className="text-xs text-status-danger font-medium">
                          Invoice ({formatCents(invoice.total_amount)}) exceeds remaining budget
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-cream-dim">
                    {jobId && costCodeId ? "No budget line found" : "Select job + cost code"}
                  </p>
                )}
              </SidebarCard>

              {/* Payment */}
              <SidebarCard title="Payment">
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between"><span className="text-cream-dim">Received</span><span className="text-cream">{invoice.received_date ?? "—"}</span></div>
                  <div className="flex justify-between"><span className="text-cream-dim">Scheduled</span><span className="text-cream">{invoice.payment_date ?? "—"}</span></div>
                  <div className="flex justify-between border-t border-brand-border pt-2.5"><span className="text-cream-dim">Amount</span><span className="text-brass font-display text-base font-medium">{formatCents(invoice.total_amount)}</span></div>
                </div>
              </SidebarCard>

              {/* AI Confidence */}
              {invoice.confidence_details && (
                <SidebarCard title="AI Confidence">
                  <div className="space-y-2">
                    {Object.entries(invoice.confidence_details)
                      .filter(([f, s]) => f !== "auto_fills" && typeof s === "number")
                      .map(([field, score]) => (
                      <div key={field} className="flex items-center justify-between text-sm">
                        <span className="text-cream-dim">{field.replace(/_/g, " ")}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${confidenceColor(score as number)}`}>
                          {Math.round((score as number) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </SidebarCard>
              )}

              {/* Status History */}
              {invoice.status_history?.length > 0 && (
                <SidebarCard title="Status History">
                  <div className="space-y-3">
                    {invoice.status_history.map((entry, i) => (
                      <div key={i} className="text-xs border-l-2 border-teal/30 pl-3 py-1">
                        <p className="text-cream-muted font-medium">
                          {String(entry.old_status)} &rarr; {String(entry.new_status)}
                        </p>
                        <p className="text-cream-dim mt-0.5">{String(entry.who)} &mdash; {new Date(String(entry.when)).toLocaleString()}</p>
                        {entry.note ? <p className="text-cream-dim mt-1 italic">{String(entry.note)}</p> : null}
                      </div>
                    ))}
                  </div>
                </SidebarCard>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 w-full max-w-md opacity-0 animate-fade-up shadow-2xl">
            <h3 className="font-display text-xl text-cream mb-4">
              {showNoteModal === "hold" ? "Hold Invoice" : "Deny Invoice"}
            </h3>
            <textarea value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder="Add a note (required)..."
              className="w-full h-24 px-3 py-2 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream placeholder-cream-dim focus:border-teal focus:outline-none resize-none" />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { if (actionNote.trim()) { handleAction(showNoteModal, actionNote.trim()); setShowNoteModal(null); setActionNote(""); } }}
                disabled={!actionNote.trim() || saving}
                className={`flex-1 px-4 py-2.5 text-white font-medium rounded-xl disabled:opacity-50 transition-all ${showNoteModal === "hold" ? "bg-brass text-brand-bg" : "bg-status-danger"}`}>
                {showNoteModal === "hold" ? "Hold" : "Deny"}
              </button>
              <button onClick={() => { setShowNoteModal(null); setActionNote(""); }}
                className="flex-1 px-4 py-2.5 border border-brand-border text-cream-muted rounded-xl hover:border-brand-border-light transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-5">
      <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-4 brass-underline">{title}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function FormField({ label, value, onChange, type = "text", options, disabled, aiFilled }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: "text" | "number" | "date" | "select" | "textarea";
  options?: { value: string; label: string }[]; disabled?: boolean; aiFilled?: boolean;
}) {
  const base = `w-full px-3 py-2.5 bg-brand-surface border rounded-xl text-sm text-cream placeholder-cream-dim focus:border-teal focus:outline-none disabled:opacity-50 transition-colors ${aiFilled ? "border-teal/40" : "border-brand-border"}`;
  return (
    <div>
      <label className="flex items-center gap-2 text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-1.5">
        {label}
        {aiFilled && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal/15 text-teal border border-teal/25 normal-case tracking-normal">AI</span>
        )}
      </label>
      {type === "select" && options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={base}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} rows={3} className={`${base} resize-none`} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={base} />
      )}
    </div>
  );
}

function BudgetRow({ label, value, highlight }: { label: string; value: number; highlight?: "danger" | "warning" | "success" }) {
  const color = highlight === "danger" ? "text-status-danger" : highlight === "warning" ? "text-brass" : highlight === "success" ? "text-status-success" : "text-cream";
  return (
    <div className="flex justify-between text-sm">
      <span className="text-cream-dim">{label}</span>
      <span className={`font-medium font-display ${color}`}>{formatCents(value)}</span>
    </div>
  );
}
