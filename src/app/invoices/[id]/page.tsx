"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatCents, confidenceColor, confidenceLabel } from "@/lib/utils/format";

interface Job {
  id: string;
  name: string;
  address: string | null;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string | null;
  description: string | null;
  amount: number;
}

interface BudgetInfo {
  original_estimate: number;
  revised_estimate: number;
  total_spent: number;
  remaining: number;
}

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
  line_items: Array<{
    description: string;
    qty: number | null;
    unit: string | null;
    rate: number | null;
    amount: number;
  }>;
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

  // Form state
  const [jobId, setJobId] = useState<string>("");
  const [costCodeId, setCostCodeId] = useState<string>("");
  const [poId, setPoId] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [invoiceType, setInvoiceType] = useState("");
  const [description, setDescription] = useState("");

  // Dropdown data
  const [jobs, setJobs] = useState<Job[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [budgetInfo, setBudgetInfo] = useState<BudgetInfo | null>(null);

  // Action state
  const [actionNote, setActionNote] = useState("");
  const [showNoteModal, setShowNoteModal] = useState<"hold" | "deny" | null>(null);

  // Fetch invoice
  useEffect(() => {
    async function fetchInvoice() {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (res.ok) {
        const data: InvoiceData = await res.json();
        setInvoice(data);
        setJobId(data.job_id ?? "");
        setCostCodeId(data.cost_code_id ?? "");
        setPoId(data.po_id ?? "");
        setInvoiceNumber(data.invoice_number ?? "");
        setInvoiceDate(data.invoice_date ?? "");
        setTotalAmount(String(data.total_amount / 100));
        setInvoiceType(data.invoice_type ?? "");
        setDescription(data.description ?? "");
      }
      setLoading(false);
    }
    fetchInvoice();
  }, [invoiceId]);

  // Fetch dropdown data
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

  // Fetch POs when job changes
  useEffect(() => {
    async function fetchPOs() {
      if (!jobId) { setPurchaseOrders([]); return; }
      const { data } = await supabase
        .from("purchase_orders")
        .select("id, po_number, description, amount")
        .eq("job_id", jobId)
        .is("deleted_at", null)
        .order("po_number");
      if (data) setPurchaseOrders(data);
    }
    fetchPOs();
  }, [jobId]);

  // Fetch budget info when job + cost code selected
  useEffect(() => {
    async function fetchBudget() {
      if (!jobId || !costCodeId) { setBudgetInfo(null); return; }

      const { data: budgetLine } = await supabase
        .from("budget_lines")
        .select("original_estimate, revised_estimate")
        .eq("job_id", jobId)
        .eq("cost_code_id", costCodeId)
        .is("deleted_at", null)
        .single();

      if (!budgetLine) { setBudgetInfo(null); return; }

      // Sum of all approved/in-draw invoices for this job + cost code
      const { data: spentData } = await supabase
        .from("invoices")
        .select("total_amount")
        .eq("job_id", jobId)
        .eq("cost_code_id", costCodeId)
        .in("status", ["pm_approved", "qa_review", "qa_approved", "pushed_to_qb", "in_draw", "paid"])
        .is("deleted_at", null);

      const totalSpent = spentData?.reduce((sum, inv) => sum + inv.total_amount, 0) ?? 0;

      setBudgetInfo({
        original_estimate: budgetLine.original_estimate,
        revised_estimate: budgetLine.revised_estimate,
        total_spent: totalSpent,
        remaining: budgetLine.revised_estimate - totalSpent,
      });
    }
    fetchBudget();
  }, [jobId, costCodeId]);

  const buildOverrides = useCallback(() => {
    if (!invoice) return {};
    const overrides: Record<string, { old: unknown; new: unknown }> = {};

    if (invoiceNumber !== (invoice.invoice_number ?? "")) {
      overrides.invoice_number = { old: invoice.invoice_number, new: invoiceNumber };
    }
    if (invoiceDate !== (invoice.invoice_date ?? "")) {
      overrides.invoice_date = { old: invoice.invoice_date, new: invoiceDate };
    }
    if (totalAmount !== String(invoice.total_amount / 100)) {
      overrides.total_amount = { old: invoice.total_amount / 100, new: parseFloat(totalAmount) };
    }
    if (invoiceType !== (invoice.invoice_type ?? "")) {
      overrides.invoice_type = { old: invoice.invoice_type, new: invoiceType };
    }
    if (description !== (invoice.description ?? "")) {
      overrides.description = { old: invoice.description, new: description };
    }
    if (jobId !== (invoice.job_id ?? "")) {
      overrides.job_id = { old: invoice.job_id, new: jobId };
    }
    if (costCodeId !== (invoice.cost_code_id ?? "")) {
      overrides.cost_code_id = { old: invoice.cost_code_id, new: costCodeId };
    }

    return overrides;
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
    if (totalAmount !== String((invoice?.total_amount ?? 0) / 100)) {
      updates.total_amount = Math.round(parseFloat(totalAmount) * 100);
    }
    if (invoiceType !== (invoice?.invoice_type ?? "")) updates.invoice_type = invoiceType;
    if (description !== (invoice?.description ?? "")) updates.description = description;

    const res = await fetch(`/api/invoices/${invoiceId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        note,
        pm_overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
        updates: Object.keys(updates).length > 0 ? updates : undefined,
      }),
    });

    setSaving(false);
    if (res.ok) {
      router.push("/invoices/queue");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-500">Loading invoice...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-red-400">Invoice not found</p>
      </div>
    );
  }

  const isReviewable = ["pm_review", "ai_processed"].includes(invoice.status);
  const autoFills = (invoice.confidence_details as Record<string, unknown>)?.auto_fills as Record<string, boolean> | undefined;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/invoices/queue" className="text-gray-400 hover:text-white transition-colors text-sm">
              &larr; Queue
            </Link>
            <h1 className="text-xl font-semibold">
              {invoice.vendor_name_raw ?? "Invoice"} — {invoice.invoice_number ?? "No #"}
            </h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${confidenceColor(invoice.confidence_score)}`}>
              {Math.round(invoice.confidence_score * 100)}% {confidenceLabel(invoice.confidence_score)}
            </span>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
              {invoice.status.replace(/_/g, " ")}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left: Document Preview */}
          <div className="xl:col-span-1">
            <div className="sticky top-6">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Original Document</p>
              {invoice.signed_file_url ? (
                invoice.original_file_type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={invoice.signed_file_url}
                    alt="Invoice"
                    className="w-full rounded-lg border border-gray-700"
                  />
                ) : (
                  <iframe
                    src={invoice.signed_file_url}
                    className="w-full h-[700px] rounded-lg border border-gray-700"
                    title="Invoice PDF"
                  />
                )
              ) : (
                <div className="h-64 rounded-lg border border-gray-700 bg-gray-800/50 flex items-center justify-center">
                  <p className="text-gray-500 text-sm">No preview available</p>
                </div>
              )}
            </div>
          </div>

          {/* Middle: Editable Form */}
          <div className="xl:col-span-1 space-y-6">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice Details</p>

            <div className="space-y-4">
              <FormField label="Job" value={jobId} onChange={setJobId} type="select"
                options={[{ value: "", label: "— Select Job —" }, ...jobs.map(j => ({ value: j.id, label: `${j.name} — ${j.address ?? ""}` }))]}
                disabled={!isReviewable}
                aiFilled={!!autoFills?.job_id}
              />

              <FormField label="Cost Code" value={costCodeId} onChange={setCostCodeId} type="select"
                options={[{ value: "", label: "— Select Cost Code —" }, ...costCodes.map(c => ({ value: c.id, label: `${c.code} — ${c.description}` }))]}
                disabled={!isReviewable}
                aiFilled={!!autoFills?.cost_code_id}
              />

              {purchaseOrders.length > 0 && (
                <FormField label="Purchase Order" value={poId} onChange={setPoId} type="select"
                  options={[{ value: "", label: "— No PO —" }, ...purchaseOrders.map(p => ({ value: p.id, label: `${p.po_number ?? "PO"} — ${formatCents(p.amount)}` }))]}
                  disabled={!isReviewable}
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Invoice #" value={invoiceNumber} onChange={setInvoiceNumber} disabled={!isReviewable} />
                <FormField label="Invoice Date" value={invoiceDate} onChange={setInvoiceDate} type="date" disabled={!isReviewable} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Total ($)" value={totalAmount} onChange={setTotalAmount} type="number" disabled={!isReviewable} />
                <FormField label="Type" value={invoiceType} onChange={setInvoiceType} type="select"
                  options={[
                    { value: "lump_sum", label: "Lump Sum" },
                    { value: "progress", label: "Progress" },
                    { value: "time_and_materials", label: "Time & Materials" },
                  ]}
                  disabled={!isReviewable}
                />
              </div>

              <FormField label="Description" value={description} onChange={setDescription} type="textarea" disabled={!isReviewable} />

              {/* Vendor raw info */}
              <div className="border-t border-gray-800 pt-4">
                <p className="text-xs text-gray-500 mb-2">AI Parsed (raw)</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                  <div>Vendor: {invoice.vendor_name_raw ?? "—"}</div>
                  <div>Job Ref: {invoice.job_reference_raw ?? "—"}</div>
                  <div>PO Ref: {invoice.po_reference_raw ?? "—"}</div>
                  <div>CO Ref: {invoice.co_reference_raw ?? "—"}</div>
                </div>
              </div>

              {/* Line Items (read-only) */}
              {invoice.line_items && invoice.line_items.length > 0 && (
                <div className="border-t border-gray-800 pt-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Line Items</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="py-1.5 pr-2 text-left text-gray-400">Description</th>
                          <th className="py-1.5 pr-2 text-right text-gray-400">Qty</th>
                          <th className="py-1.5 pr-2 text-right text-gray-400">Rate</th>
                          <th className="py-1.5 text-right text-gray-400">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.line_items.map((item, i) => (
                          <tr key={i} className="border-b border-gray-800/50">
                            <td className="py-1.5 pr-2 text-gray-300">{item.description}</td>
                            <td className="py-1.5 pr-2 text-right text-gray-400">{item.qty ?? "—"}</td>
                            <td className="py-1.5 pr-2 text-right text-gray-400">{item.rate != null ? `$${item.rate}` : "—"}</td>
                            <td className="py-1.5 text-right text-gray-200">${item.amount?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {isReviewable && (
              <div className="border-t border-gray-800 pt-6 space-y-3">
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAction("approve")}
                    disabled={saving}
                    className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
                  >
                    {saving ? "Saving..." : "Approve"}
                  </button>
                  <button
                    onClick={() => setShowNoteModal("hold")}
                    disabled={saving}
                    className="flex-1 px-4 py-3 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
                  >
                    Hold
                  </button>
                  <button
                    onClick={() => setShowNoteModal("deny")}
                    disabled={saving}
                    className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
                  >
                    Deny
                  </button>
                </div>
                <button
                  onClick={() => handleAction("request_info", "PM requesting additional information")}
                  disabled={saving}
                  className="w-full px-4 py-2 border border-gray-700 hover:border-gray-500 text-gray-300 text-sm rounded-lg transition-colors"
                >
                  Request Info
                </button>
              </div>
            )}
          </div>

          {/* Right: Budget Sidebar */}
          <div className="xl:col-span-1">
            <div className="sticky top-6 space-y-6">
              {/* Budget Info */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Budget Status</p>
                {budgetInfo ? (
                  <div className="space-y-3">
                    <BudgetRow label="Original Estimate" value={budgetInfo.original_estimate} />
                    <BudgetRow label="Revised Estimate" value={budgetInfo.revised_estimate} />
                    <BudgetRow label="Total Spent" value={budgetInfo.total_spent} />
                    <div className="border-t border-gray-700 pt-3">
                      <BudgetRow
                        label="Remaining"
                        value={budgetInfo.remaining}
                        highlight={budgetInfo.remaining < 0 ? "red" : budgetInfo.remaining < invoice.total_amount ? "yellow" : "green"}
                      />
                    </div>
                    {budgetInfo.remaining < invoice.total_amount && (
                      <div className="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-xs text-red-400 font-medium">
                          This invoice ({formatCents(invoice.total_amount)}) exceeds remaining budget
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    {jobId && costCodeId ? "No budget line found" : "Select a job and cost code to see budget"}
                  </p>
                )}
              </div>

              {/* Payment Info */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Payment</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Received</span>
                    <span className="text-gray-200">{invoice.received_date ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Scheduled</span>
                    <span className="text-gray-200">{invoice.payment_date ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount</span>
                    <span className="text-white font-medium">{formatCents(invoice.total_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Confidence Details */}
              {invoice.confidence_details && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">AI Confidence</p>
                  <div className="space-y-2">
                    {Object.entries(invoice.confidence_details)
                      .filter(([field, score]) => field !== "auto_fills" && typeof score === "number")
                      .map(([field, score]) => (
                      <div key={field} className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">{field.replace(/_/g, " ")}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${confidenceColor(score as number)}`}>
                          {Math.round((score as number) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status History */}
              {invoice.status_history && invoice.status_history.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Status History</p>
                  <div className="space-y-2">
                    {invoice.status_history.map((entry, i) => (
                      <div key={i} className="text-xs border-l-2 border-gray-700 pl-3 py-1">
                        <p className="text-gray-300">
                          {String(entry.old_status)} → {String(entry.new_status)}
                        </p>
                        <p className="text-gray-500">{String(entry.who)} — {new Date(String(entry.when)).toLocaleString()}</p>
                        {entry.note ? <p className="text-gray-400 mt-0.5">{String(entry.note)}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-white mb-4">
              {showNoteModal === "hold" ? "Hold Invoice" : "Deny Invoice"}
            </h3>
            <textarea
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="Add a note (required)..."
              className="w-full h-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  if (actionNote.trim()) {
                    handleAction(showNoteModal, actionNote.trim());
                    setShowNoteModal(null);
                    setActionNote("");
                  }
                }}
                disabled={!actionNote.trim() || saving}
                className={`flex-1 px-4 py-2 text-white font-medium rounded-lg disabled:opacity-50 ${
                  showNoteModal === "hold" ? "bg-yellow-600 hover:bg-yellow-500" : "bg-red-600 hover:bg-red-500"
                }`}
              >
                {showNoteModal === "hold" ? "Hold" : "Deny"}
              </button>
              <button
                onClick={() => { setShowNoteModal(null); setActionNote(""); }}
                className="flex-1 px-4 py-2 border border-gray-700 text-gray-300 rounded-lg hover:border-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({
  label, value, onChange, type = "text", options, disabled, aiFilled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number" | "date" | "select" | "textarea";
  options?: { value: string; label: string }[];
  disabled?: boolean;
  aiFilled?: boolean;
}) {
  const baseClass = `w-full px-3 py-2 bg-gray-800 border rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none disabled:opacity-50 ${aiFilled ? "border-blue-500/50" : "border-gray-700"}`;

  return (
    <div>
      <label className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
        {aiFilled && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 normal-case tracking-normal">
            AI
          </span>
        )}
      </label>
      {type === "select" && options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={baseClass}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} rows={3} className={`${baseClass} resize-none`} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={baseClass} />
      )}
    </div>
  );
}

function BudgetRow({ label, value, highlight }: { label: string; value: number; highlight?: "red" | "yellow" | "green" }) {
  const colorClass = highlight === "red" ? "text-red-400" : highlight === "yellow" ? "text-yellow-400" : highlight === "green" ? "text-green-400" : "text-gray-200";
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={`font-medium ${colorClass}`}>{formatCents(value)}</span>
    </div>
  );
}
