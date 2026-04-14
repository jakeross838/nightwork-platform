"use client";

import { Fragment, useEffect, useState, useMemo, useCallback } from "react";
import NavBar from "@/components/nav-bar";
import { supabase } from "@/lib/supabase/client";
import { formatCents } from "@/lib/utils/format";

interface CostCode {
 id: string;
 code: string;
 description: string;
}

interface Vendor {
 id: string;
 name: string;
 default_cost_code_id: string | null;
 cost_codes: { code: string; description: string } | null;
}

interface InvoiceRow {
 vendor_id: string;
 total_amount: number;
}

interface InvoiceAgg {
 count: number;
 total: number;
}

export default function VendorsPage() {
 const [vendors, setVendors] = useState<Vendor[]>([]);
 const [costCodes, setCostCodes] = useState<CostCode[]>([]);
 const [invoiceAgg, setInvoiceAgg] = useState<Record<string, InvoiceAgg>>({});
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState("");

 // Selection state
 const [selected, setSelected] = useState<Set<string>>(new Set());

 // Inline editing state
 const [expandedId, setExpandedId] = useState<string | null>(null);
 const [editName, setEditName] = useState("");
 const [editCostCodeId, setEditCostCodeId] = useState<string | null>(null);
 const [saving, setSaving] = useState(false);

 // Merge modal state
 const [showMerge, setShowMerge] = useState(false);
 const [mergePrimaryId, setMergePrimaryId] = useState<string | null>(null);
 const [merging, setMerging] = useState(false);

 const fetchData = useCallback(async () => {
 setLoading(true);
 const [vendorRes, costCodeRes, invoiceRes] = await Promise.all([
 supabase
 .from("vendors")
 .select("id, name, default_cost_code_id, cost_codes:default_cost_code_id (code, description)")
 .is("deleted_at", null)
 .order("name"),
 supabase
 .from("cost_codes")
 .select("id, code, description")
 .is("deleted_at", null)
 .order("code"),
 supabase
 .from("invoices")
 .select("vendor_id, total_amount")
 .is("deleted_at", null),
 ]);

 if (vendorRes.data) {
 // Supabase may return cost_codes as an array with one element or as an object
 const mapped = vendorRes.data.map((v: Record<string, unknown>) => ({
 ...v,
 cost_codes: Array.isArray(v.cost_codes) ? v.cost_codes[0] ?? null : v.cost_codes,
 })) as Vendor[];
 setVendors(mapped);
 }
 if (costCodeRes.data) setCostCodes(costCodeRes.data);

 // Aggregate invoice data client-side
 if (invoiceRes.data) {
 const agg: Record<string, InvoiceAgg> = {};
 for (const inv of invoiceRes.data as InvoiceRow[]) {
 if (!inv.vendor_id) continue;
 if (!agg[inv.vendor_id]) agg[inv.vendor_id] = { count: 0, total: 0 };
 agg[inv.vendor_id].count += 1;
 agg[inv.vendor_id].total += inv.total_amount ?? 0;
 }
 setInvoiceAgg(agg);
 }

 setLoading(false);
 }, []);

 useEffect(() => {
 fetchData();
 }, [fetchData]);

 const filtered = useMemo(() => {
 if (!search.trim()) return vendors;
 const q = search.toLowerCase();
 return vendors.filter((v) => v.name.toLowerCase().includes(q));
 }, [vendors, search]);

 const totalVendors = vendors.length;
 const vendorsNoInvoices = vendors.filter((v) => !invoiceAgg[v.id]).length;

 // Expand row for inline edit
 function handleRowClick(v: Vendor) {
 if (expandedId === v.id) {
 setExpandedId(null);
 return;
 }
 setExpandedId(v.id);
 setEditName(v.name);
 setEditCostCodeId(v.default_cost_code_id);
 }

 async function handleSaveEdit() {
 if (!expandedId) return;
 setSaving(true);
 const body: Record<string, unknown> = {};
 const vendor = vendors.find((v) => v.id === expandedId);
 if (!vendor) { setSaving(false); return; }
 if (editName !== vendor.name) body.name = editName;
 if (editCostCodeId !== vendor.default_cost_code_id) body.default_cost_code_id = editCostCodeId;

 if (Object.keys(body).length === 0) {
 setSaving(false);
 setExpandedId(null);
 return;
 }

 const res = await fetch(`/api/vendors/${expandedId}`, {
 method: "PATCH",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(body),
 });

 if (res.ok) {
 setExpandedId(null);
 await fetchData();
 }
 setSaving(false);
 }

 function toggleSelect(id: string) {
 setSelected((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 }

 function openMerge() {
 if (selected.size < 2) return;
 setMergePrimaryId(null);
 setShowMerge(true);
 }

 async function handleMerge() {
 if (!mergePrimaryId) return;
 setMerging(true);
 const mergeIds = Array.from(selected).filter((id) => id !== mergePrimaryId);

 const res = await fetch("/api/vendors/merge", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ primary_id: mergePrimaryId, merge_ids: mergeIds }),
 });

 if (res.ok) {
 setShowMerge(false);
 setSelected(new Set());
 setMergePrimaryId(null);
 await fetchData();
 }
 setMerging(false);
 }

 const selectedVendors = vendors.filter((v) => selected.has(v.id));

 return (
 <div className="min-h-screen">
 <NavBar />
 <main className="max-w-7xl mx-auto px-6 py-8">
 {/* Header */}
 <div className="flex items-center justify-between mb-6">
 <div>
 <h2 className="font-display text-2xl text-cream">Vendors</h2>
 <p className="text-sm text-cream-dim mt-1">Manage vendor records and merge duplicates</p>
 </div>
 {selected.size >= 2 && (
 <button
 onClick={openMerge}
 className="px-4 py-2 bg-brass hover:bg-brass/80 text-brand-bg text-sm font-medium transition-colors"
 >
 Merge {selected.size} Vendors
 </button>
 )}
 </div>

 {/* Stats */}
 <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 mb-6">
 <div className="bg-brand-card border border-brand-border p-4">
 <p className="text-xs text-cream-dim uppercase tracking-wider mb-1">Total Vendors</p>
 <p className="text-2xl font-display text-cream">{totalVendors}</p>
 </div>
 <div className="bg-brand-card border border-brand-border p-4">
 <p className="text-xs text-cream-dim uppercase tracking-wider mb-1">No Invoices</p>
 <p className="text-2xl font-display text-cream">{vendorsNoInvoices}</p>
 </div>
 </div>

 {/* Search */}
 <div className="mb-4">
 <input
 type="text"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search vendors by name..."
 className="w-full sm:w-80 px-4 py-2 bg-brand-surface border border-brand-border text-sm text-cream placeholder:text-cream-dim focus:outline-none focus:border-teal"
 />
 </div>

 {/* Table */}
 {loading ? (
 <div className="text-center py-20">
 <div className="w-8 h-8 border-2 border-teal/30 border-t-teal animate-spin mx-auto" />
 </div>
 ) : filtered.length === 0 ? (
 <div className="text-center py-20 animate-fade-up">
 <p className="text-cream text-lg font-display">No vendors found</p>
 <p className="text-cream-dim text-sm mt-1">
 {search ? "Try a different search term" : "Vendors are created automatically when invoices are processed"}
 </p>
 </div>
 ) : (
 <div className="overflow-x-auto border border-brand-border animate-fade-up">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-brand-surface text-left">
 <th className="py-3 px-4 w-10">
 <span className="sr-only">Select</span>
 </th>
 <th className="py-3 px-5 text-[11px] text-cream font-semibold uppercase tracking-wider">Name</th>
 <th className="py-3 px-5 text-[11px] text-cream font-semibold uppercase tracking-wider">Default Cost Code</th>
 <th className="py-3 px-5 text-[11px] text-cream font-semibold uppercase tracking-wider text-right">Invoices</th>
 <th className="py-3 px-5 text-[11px] text-cream font-semibold uppercase tracking-wider text-right">Total Billed</th>
 </tr>
 </thead>
 <tbody>
 {filtered.map((v) => {
 const agg = invoiceAgg[v.id];
 const isExpanded = expandedId === v.id;
 return (
 <Fragment key={v.id}>
 <tr
 className={`border-t border-brand-row-border hover:bg-brand-elevated/50 cursor-pointer transition-colors ${
 isExpanded ? "bg-brand-elevated/50" : ""
 }`}
 >
 <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
 <input
 type="checkbox"
 checked={selected.has(v.id)}
 onChange={() => toggleSelect(v.id)}
 className="w-4 h-4 border-brand-border bg-brand-surface text-teal focus:ring-teal accent-teal"
 />
 </td>
 <td
 className="py-4 px-5 text-cream font-medium cursor-pointer"
 onClick={() => handleRowClick(v)}
 >
 {v.name}
 </td>
 <td
 className="py-4 px-5 text-cream-muted cursor-pointer"
 onClick={() => handleRowClick(v)}
 >
 {v.cost_codes
 ? `${v.cost_codes.code} - ${v.cost_codes.description}`
 : "—"}
 </td>
 <td
 className="py-4 px-5 text-cream text-right cursor-pointer"
 onClick={() => handleRowClick(v)}
 >
 {agg?.count ?? 0}
 </td>
 <td
 className="py-4 px-5 text-cream text-right font-display font-medium cursor-pointer"
 onClick={() => handleRowClick(v)}
 >
 {formatCents(agg?.total ?? 0)}
 </td>
 </tr>
 {isExpanded && (
 <tr className="border-t border-brand-border bg-brand-card">
 <td colSpan={5} className="py-4 px-5">
 <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
 <div className="flex-1 min-w-0">
 <label className="block text-xs text-cream-dim mb-1">Vendor Name</label>
 <input
 type="text"
 value={editName}
 onChange={(e) => setEditName(e.target.value)}
 className="w-full px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:outline-none focus:border-teal"
 />
 </div>
 <div className="flex-1 min-w-0">
 <label className="block text-xs text-cream-dim mb-1">Default Cost Code</label>
 <select
 value={editCostCodeId ?? ""}
 onChange={(e) =>
 setEditCostCodeId(e.target.value || null)
 }
 className="w-full px-3 py-2 bg-brand-surface border border-brand-border text-sm text-cream focus:outline-none focus:border-teal"
 >
 <option value="">None</option>
 {costCodes.map((cc) => (
 <option key={cc.id} value={cc.id}>
 {cc.code} - {cc.description}
 </option>
 ))}
 </select>
 </div>
 <div className="flex gap-2">
 <button
 onClick={handleSaveEdit}
 disabled={saving}
 className="px-4 py-2 bg-teal hover:bg-teal-hover text-brand-bg text-sm font-medium transition-colors disabled:opacity-50"
 >
 {saving ? "Saving..." : "Save"}
 </button>
 <button
 onClick={() => setExpandedId(null)}
 className="px-4 py-2 bg-brand-surface hover:bg-brand-elevated text-cream-dim text-sm transition-colors border border-brand-border"
 >
 Cancel
 </button>
 </div>
 </div>
 </td>
 </tr>
 )}
 </Fragment>
 );
 })}
 </tbody>
 </table>
 </div>
 )}

 {/* Merge Modal */}
 {showMerge && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
 <div className="bg-brand-card border border-brand-border shadow-2xl max-w-lg w-full mx-4 p-6">
 <h3 className="font-display text-lg text-cream mb-4">Merge Vendors</h3>
 <p className="text-sm text-cream-dim mb-4">
 Select which vendor name to keep as the primary. All invoices from the other vendors will be
 reassigned to the primary, and the others will be removed.
 </p>
 <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
 {selectedVendors.map((v) => {
 const agg = invoiceAgg[v.id];
 return (
 <label
 key={v.id}
 className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${
 mergePrimaryId === v.id
 ? "border-teal bg-teal/10"
 : "border-brand-border bg-brand-surface hover:bg-brand-elevated/50"
 }`}
 >
 <input
 type="radio"
 name="mergePrimary"
 value={v.id}
 checked={mergePrimaryId === v.id}
 onChange={() => setMergePrimaryId(v.id)}
 className="accent-teal"
 />
 <div className="flex-1 min-w-0">
 <p className="text-sm text-cream font-medium truncate">{v.name}</p>
 <p className="text-xs text-cream-dim">
 {agg?.count ?? 0} invoice{(agg?.count ?? 0) !== 1 ? "s" : ""} &middot;{" "}
 {formatCents(agg?.total ?? 0)}
 </p>
 </div>
 </label>
 );
 })}
 </div>
 <div className="flex justify-end gap-3">
 <button
 onClick={() => setShowMerge(false)}
 className="px-4 py-2 bg-brand-surface hover:bg-brand-elevated text-cream-dim text-sm transition-colors border border-brand-border"
 >
 Cancel
 </button>
 <button
 onClick={handleMerge}
 disabled={!mergePrimaryId || merging}
 className="px-4 py-2 bg-brass hover:bg-brass/80 text-brand-bg text-sm font-medium transition-colors disabled:opacity-50"
 >
 {merging ? "Merging..." : "Confirm Merge"}
 </button>
 </div>
 </div>
 </div>
 )}
 </main>
 </div>
 );
}

