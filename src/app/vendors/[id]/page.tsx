"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/app-shell";
import Breadcrumbs from "@/components/breadcrumbs";
import CostCodeCombobox, { CostCodeOption } from "@/components/cost-code-combobox";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatDate, formatStatus, statusBadgeOutline } from "@/lib/utils/format";

interface Vendor {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  default_cost_code_id: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  total_amount: number;
  status: string;
  jobs: { id: string; name: string } | null;
  cost_codes: { id: string; code: string; description: string } | null;
}

export default function VendorDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [costCodes, setCostCodes] = useState<CostCodeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Vendor>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace(`/login?redirect=/vendors/${params.id}`); return; }

        // Load vendor row — try with `notes` first; fall back without it if the
        // column doesn't exist yet (migration 00015 not applied).
        let vendorRow:
          | (Vendor & Record<string, unknown>)
          | null = null;
        const withNotes = await supabase
          .from("vendors")
          .select("id, name, address, phone, email, default_cost_code_id, notes")
          .eq("id", params.id)
          .is("deleted_at", null)
          .maybeSingle();
        if (withNotes.error && /notes/i.test(withNotes.error.message)) {
          const fallback = await supabase
            .from("vendors")
            .select("id, name, address, phone, email, default_cost_code_id")
            .eq("id", params.id)
            .is("deleted_at", null)
            .maybeSingle();
          if (fallback.data) {
            vendorRow = { ...(fallback.data as Omit<Vendor, "notes">), notes: null };
          }
        } else if (withNotes.data) {
          vendorRow = withNotes.data as Vendor & Record<string, unknown>;
        }

        if (!vendorRow) {
          setLoadError(
            withNotes.error?.message ?? "Vendor not found"
          );
          return;
        }

        const vendorTyped: Vendor = {
          id: String(vendorRow.id),
          name: String(vendorRow.name ?? ""),
          address: (vendorRow.address as string | null) ?? null,
          phone: (vendorRow.phone as string | null) ?? null,
          email: (vendorRow.email as string | null) ?? null,
          notes: (vendorRow.notes as string | null) ?? null,
          default_cost_code_id: (vendorRow.default_cost_code_id as string | null) ?? null,
        };
        setVendor(vendorTyped);
        setForm(vendorTyped);

        // Invoices — note the join returns an array for the foreign relation.
        // Normalize to object.
        const { data: rawInvoices, error: invErr } = await supabase
          .from("invoices")
          .select(`
            id, invoice_number, invoice_date, total_amount, status,
            jobs:job_id(id, name),
            cost_codes:cost_code_id(id, code, description)
          `)
          .eq("vendor_id", params.id)
          .is("deleted_at", null)
          .order("invoice_date", { ascending: false });
        if (invErr) {
          console.warn("invoice fetch failed:", invErr.message);
        }
        const normalized: Invoice[] = (rawInvoices ?? []).map((r) => {
          const row = r as Record<string, unknown>;
          const jobs = Array.isArray(row.jobs) ? (row.jobs[0] ?? null) : (row.jobs ?? null);
          const costCodes = Array.isArray(row.cost_codes) ? (row.cost_codes[0] ?? null) : (row.cost_codes ?? null);
          return {
            id: String(row.id),
            invoice_number: (row.invoice_number as string | null) ?? null,
            invoice_date: (row.invoice_date as string | null) ?? null,
            total_amount: Number(row.total_amount ?? 0),
            status: String(row.status ?? ""),
            jobs: jobs as { id: string; name: string } | null,
            cost_codes: costCodes as { id: string; code: string; description: string } | null,
          };
        });
        setInvoices(normalized);

        // Cost codes
        const { data: ccData } = await supabase
          .from("cost_codes")
          .select("id, code, description, category, is_change_order")
          .is("deleted_at", null)
          .order("sort_order");
        if (ccData) setCostCodes(ccData as CostCodeOption[]);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Load failed");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id, router]);

  const stats = useMemo(() => {
    const count = invoices.length;
    const total = invoices.reduce((s, i) => s + (i.total_amount ?? 0), 0);
    const avg = count > 0 ? total / count : 0;
    const codeCounts = new Map<string, { code: string; description: string; count: number }>();
    for (const i of invoices) {
      if (!i.cost_codes) continue;
      const key = i.cost_codes.id;
      const prev = codeCounts.get(key);
      if (prev) prev.count += 1;
      else codeCounts.set(key, {
        code: i.cost_codes.code,
        description: i.cost_codes.description,
        count: 1,
      });
    }
    const entries = Array.from(codeCounts.values());
    const mostCommon = entries.length === 0
      ? null
      : entries.reduce((best, cur) => (cur.count > best.count ? cur : best), entries[0]);
    return { count, total, avg, mostCommon };
  }, [invoices]);

  async function handleSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/vendors/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          phone: form.phone,
          email: form.email,
          notes: form.notes,
          default_cost_code_id: form.default_cost_code_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setVendor((prev) => (prev ? { ...prev, ...(data as Vendor) } : prev));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
          <div className="w-8 h-8 border-2 border-[rgba(91,134,153,0.3)] border-t-[var(--nw-stone-blue)] animate-spin mx-auto" />
        </main>
      </AppShell>
    );
  }
  if (!vendor) {
    return (
      <AppShell>
        <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
          <p className="text-[color:var(--text-primary)]">Vendor not found</p>
          {loadError && <p className="text-[color:var(--nw-danger)] text-xs mt-2">{loadError}</p>}
          <Link href="/vendors" className="text-[color:var(--nw-stone-blue)] hover:underline text-sm mt-3 inline-block">Back to vendors</Link>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs items={[{ label: "Vendors", href: "/vendors" }, { label: vendor.name }]} />
        <span
          className="block mb-2 text-[10px] uppercase"
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.14em",
            color: "var(--text-tertiary)",
          }}
        >
          Admin · Vendor
        </span>
        <h2
          className="m-0 mb-1"
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 500,
            fontSize: "30px",
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
          }}
        >
          {vendor.name}
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Vendor Detail</p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <Stat label="Invoices" value={String(stats.count)} />
          <Stat label="Total Billed" value={formatCents(stats.total)} />
          <Stat label="Average" value={formatCents(Math.round(stats.avg))} />
          <Stat
            label="Most Common Code"
            value={stats.mostCommon ? `${stats.mostCommon.code} ${stats.mostCommon.description}` : "—"}
          />
        </div>

        <section
          className="border p-6 mb-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}
        >
          <h3
            className="m-0 mb-4"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 500,
              fontSize: "16px",
              color: "var(--text-primary)",
            }}
          >
            Vendor Info
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditField label="Name">
              <input
                className="input"
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </EditField>
            <EditField label="Email">
              <input
                type="email"
                className="input"
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </EditField>
            <EditField label="Phone">
              <input
                className="input"
                value={form.phone ?? ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </EditField>
            <EditField label="Address">
              <input
                className="input"
                value={form.address ?? ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </EditField>
            <EditField label="Default Cost Code" full>
              <CostCodeCombobox
                value={form.default_cost_code_id ?? null}
                onChange={(id) => setForm({ ...form, default_cost_code_id: id })}
                options={costCodes}
                placeholder="No default cost code"
                hideCoVariants
              />
            </EditField>
            <EditField label="QB Mapping / Notes" full>
              <Textarea
                minRows={3}
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. Pays as 'Doug Naeher Drywall Inc.' in QB, mapped to Subcontractor account…"
              />
            </EditField>
          </div>
          {error && (
            <div className="mt-4 border border-[rgba(176,85,78,0.35)] bg-[rgba(176,85,78,0.08)] px-4 py-2 text-sm text-[color:var(--nw-danger)]">
              {error}
            </div>
          )}
          <div className="mt-4 flex items-center justify-end gap-3">
            {saved && <span className="text-[11px] text-[color:var(--nw-success)] uppercase tracking-wider">Saved</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-[36px] px-4 text-[11px] uppercase disabled:opacity-60 transition-colors"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.12em",
                fontWeight: 500,
                background: "var(--nw-stone-blue)",
                color: "var(--nw-white-sand)",
                border: "1px solid var(--nw-stone-blue)",
              }}
            >
              {saving ? "Saving" : "Save Changes"}
            </button>
          </div>
        </section>

        <section
          className="border p-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}
        >
          <h3
            className="m-0 mb-4"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 500,
              fontSize: "16px",
              color: "var(--text-primary)",
            }}
          >
            Invoice History
          </h3>
          {invoices.length === 0 ? (
            <p className="text-sm text-[color:var(--text-secondary)]">No invoices from this vendor yet.</p>
          ) : (
            <div className="border border-[var(--border-default)] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-default)] text-[11px] uppercase tracking-wider text-[color:var(--text-secondary)] bg-[rgba(91,134,153,0.04)]">
                    <th className="text-left px-3 py-3 font-medium">Date</th>
                    <th className="text-left px-3 py-3 font-medium">Inv #</th>
                    <th className="text-left px-3 py-3 font-medium">Job</th>
                    <th className="text-left px-3 py-3 font-medium">Cost Code</th>
                    <th className="text-right px-3 py-3 font-medium">Amount</th>
                    <th className="text-left px-3 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b border-[var(--border-default)] last:border-0 hover:bg-[rgba(91,134,153,0.06)] cursor-pointer"
                      onClick={() => router.push(`/invoices/${inv.id}`)}
                    >
                      <td className="px-3 py-2 text-[color:var(--text-muted)]">{formatDate(inv.invoice_date)}</td>
                      <td className="px-3 py-2 text-[color:var(--text-muted)] font-mono text-xs">{inv.invoice_number ?? "—"}</td>
                      <td className="px-3 py-2 text-[color:var(--text-primary)]">{inv.jobs?.name ?? "—"}</td>
                      <td className="px-3 py-2 text-[color:var(--text-muted)] text-xs">
                        {inv.cost_codes ? `${inv.cost_codes.code} ${inv.cost_codes.description}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-[color:var(--text-primary)] tabular-nums">{formatCents(inv.total_amount)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 text-[11px] uppercase tracking-wider border ${statusBadgeOutline(inv.status)}`}>
                          {formatStatus(inv.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: var(--bg-subtle);
          border: 1px solid var(--border-default);
          color: var(--text-primary);
          font-size: 14px;
        }
        .input:focus { outline: none; border-color: var(--nw-stone-blue); }
      `}</style>
    </AppShell>
  );
}

function EditField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-[11px] font-medium text-[color:var(--text-secondary)] uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--border-default)] bg-[var(--bg-card)] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[color:var(--text-secondary)] font-medium">{label}</p>
      <p className="text-sm mt-1 tabular-nums text-[color:var(--text-primary)] font-medium truncate" title={value}>{value}</p>
    </div>
  );
}
