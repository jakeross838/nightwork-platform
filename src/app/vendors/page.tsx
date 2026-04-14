"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import NavBar from "@/components/nav-bar";
import { supabase } from "@/lib/supabase/client";
import { formatCents } from "@/lib/utils/format";

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
  const [invoiceAgg, setInvoiceAgg] = useState<Record<string, InvoiceAgg>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [showMerge, setShowMerge] = useState(false);
  const [mergePrimaryId, setMergePrimaryId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [vendorRes, invoiceRes] = await Promise.all([
      supabase
        .from("vendors")
        .select("id, name, default_cost_code_id, cost_codes:default_cost_code_id (code, description)")
        .is("deleted_at", null)
        .order("name"),
      supabase.from("invoices").select("vendor_id, total_amount").is("deleted_at", null),
    ]);

    if (vendorRes.data) {
      const mapped = vendorRes.data.map((v: Record<string, unknown>) => ({
        ...v,
        cost_codes: Array.isArray(v.cost_codes) ? v.cost_codes[0] ?? null : v.cost_codes,
      })) as Vendor[];
      setVendors(mapped);
    }
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
      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl text-cream">Vendors</h2>
            <p className="text-sm text-cream-dim mt-1">Click a vendor to view details &middot; select multiple to merge</p>
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

        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors by name..."
            className="w-full sm:w-80 px-4 py-2 bg-brand-surface border border-brand-border text-sm text-cream placeholder:text-cream-dim focus:outline-none focus:border-teal"
          />
        </div>

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
                  <th className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider">Name</th>
                  <th className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider">Default Cost Code</th>
                  <th className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider text-right">Invoices</th>
                  <th className="py-3 px-5 text-[11px] text-cream font-bold uppercase tracking-wider text-right">Total Billed</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const agg = invoiceAgg[v.id];
                  return (
                    <tr key={v.id} className="border-t border-brand-row-border hover:bg-brand-elevated/50 transition-colors">
                      <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(v.id)}
                          onChange={() => toggleSelect(v.id)}
                          className="w-4 h-4 border-brand-border bg-brand-surface text-teal focus:ring-teal accent-teal"
                        />
                      </td>
                      <td className="py-4 px-5">
                        <Link
                          href={`/vendors/${v.id}`}
                          className="text-cream font-medium hover:text-teal transition-colors"
                        >
                          {v.name}
                        </Link>
                      </td>
                      <td className="py-4 px-5 text-cream-muted">
                        {v.cost_codes
                          ? `${v.cost_codes.code} - ${v.cost_codes.description}`
                          : "—"}
                      </td>
                      <td className="py-4 px-5 text-cream text-right">{agg?.count ?? 0}</td>
                      <td className="py-4 px-5 text-cream text-right font-display font-medium">
                        {formatCents(agg?.total ?? 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

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
