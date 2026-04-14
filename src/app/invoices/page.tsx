"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatCents, formatStatus, formatDate } from "@/lib/utils/format";
import NavBar from "@/components/nav-bar";

interface Invoice {
  id: string;
  vendor_name_raw: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total_amount: number;
  confidence_score: number;
  received_date: string;
  payment_date: string | null;
  status: string;
  jobs: { name: string } | null;
  cost_codes: { code: string; description: string } | null;
  assigned_pm: { id: string; full_name: string } | null;
}

interface PmUser { id: string; full_name: string; }

type SortKey = "vendor" | "date" | "amount" | "status" | "pm";
type SortDir = "asc" | "desc";
type ConfidenceFilter = "all" | "high" | "medium" | "low";
type AmountRange = "all" | "0-5k" | "5k-25k" | "25k-100k" | "100k+";

const ALL_STATUSES = [
  "received", "ai_processed", "pm_review", "pm_approved", "pm_held", "pm_denied",
  "qa_review", "qa_approved", "qa_kicked_back", "pushed_to_qb", "qb_failed",
  "in_draw", "paid", "void",
];

function statusBadgeColor(status: string): string {
  if (["pm_approved", "qa_approved", "pushed_to_qb"].includes(status)) return "bg-status-success/15 text-status-success border-status-success/25";
  if (["in_draw", "paid"].includes(status)) return "bg-teal/15 text-teal border-teal/25";
  if (["pm_review", "ai_processed", "qa_review", "received"].includes(status)) return "bg-brass/15 text-brass border-brass/25";
  if (["pm_held", "qa_kicked_back"].includes(status)) return "bg-status-warning/15 text-status-warning border-status-warning/25";
  if (["pm_denied", "void", "qb_failed"].includes(status)) return "bg-status-danger/15 text-status-danger border-status-danger/25";
  return "bg-brand-surface text-cream-dim border-brand-border";
}

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-cream-dim/40">↕</span>;
  return <span className="ml-1 text-teal">{dir === "asc" ? "↑" : "↓"}</span>;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-xl px-4 py-3">
      <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider">{label}</p>
      <p className="text-xl font-display font-medium text-cream mt-1">{value}</p>
      {sub && <p className="text-xs text-cream-dim mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AllInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pmUsers, setPmUsers] = useState<PmUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [pmFilter, setPmFilter] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");

  // Advanced
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [amountRange, setAmountRange] = useState<AmountRange>("all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    async function fetchData() {
      const [invResult, pmResult] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, vendor_name_raw, invoice_number, invoice_date, total_amount, confidence_score, received_date, payment_date, status, jobs:job_id (name), cost_codes:cost_code_id (code, description), assigned_pm:assigned_pm_id (id, full_name)")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("users")
          .select("id, full_name")
          .in("role", ["pm", "admin"])
          .is("deleted_at", null)
          .order("full_name"),
      ]);
      if (!invResult.error && invResult.data) setInvoices(invResult.data as unknown as Invoice[]);
      if (!pmResult.error && pmResult.data) setPmUsers(pmResult.data as PmUser[]);
      setLoading(false);
    }
    fetchData();
  }, []);

  // Unique job names
  const jobNames = useMemo(() => {
    const names = new Set<string>();
    invoices.forEach(inv => { if (inv.jobs?.name) names.add(inv.jobs.name); });
    return Array.from(names).sort();
  }, [invoices]);

  // Stats
  const stats = useMemo(() => {
    const total = invoices.length;
    const totalValue = invoices.reduce((s, inv) => s + inv.total_amount, 0);
    const pending = invoices.filter(inv => ["pm_review", "ai_processed", "received"].includes(inv.status)).length;
    const approved = invoices.filter(inv => ["pm_approved", "qa_review", "qa_approved", "pushed_to_qb"].includes(inv.status)).length;
    const inDraw = invoices.filter(inv => inv.status === "in_draw").length;
    const paid = invoices.filter(inv => inv.status === "paid").length;
    return { total, totalValue, pending, approved, inDraw, paid };
  }, [invoices]);

  // Advanced filter count
  const advancedFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilters.size > 0) count++;
    if (amountRange !== "all") count++;
    if (dateStart || dateEnd) count++;
    return count;
  }, [statusFilters, amountRange, dateStart, dateEnd]);

  // Filter + sort
  const filtered = useMemo(() => {
    let result = invoices;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(inv =>
        (inv.vendor_name_raw ?? "").toLowerCase().includes(q) ||
        (inv.invoice_number ?? "").toLowerCase().includes(q)
      );
    }
    if (jobFilter) result = result.filter(inv => inv.jobs?.name === jobFilter);
    if (pmFilter) {
      if (pmFilter === "__unassigned__") result = result.filter(inv => !inv.assigned_pm);
      else result = result.filter(inv => inv.assigned_pm?.id === pmFilter);
    }
    if (confidenceFilter !== "all") {
      result = result.filter(inv => {
        const s = inv.confidence_score;
        if (confidenceFilter === "high") return s >= 0.85;
        if (confidenceFilter === "medium") return s >= 0.70 && s < 0.85;
        return s < 0.70;
      });
    }
    if (statusFilters.size > 0) result = result.filter(inv => statusFilters.has(inv.status));
    if (amountRange !== "all") {
      result = result.filter(inv => {
        const amt = inv.total_amount;
        switch (amountRange) {
          case "0-5k": return amt < 500000;
          case "5k-25k": return amt >= 500000 && amt < 2500000;
          case "25k-100k": return amt >= 2500000 && amt < 10000000;
          case "100k+": return amt >= 10000000;
          default: return true;
        }
      });
    }
    if (dateStart) result = result.filter(inv => (inv.invoice_date ?? "") >= dateStart);
    if (dateEnd) result = result.filter(inv => (inv.invoice_date ?? "") <= dateEnd);

    return [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "vendor": cmp = (a.vendor_name_raw ?? "").localeCompare(b.vendor_name_raw ?? ""); break;
        case "date": cmp = (a.invoice_date ?? "").localeCompare(b.invoice_date ?? ""); break;
        case "amount": cmp = a.total_amount - b.total_amount; break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "pm": cmp = (a.assigned_pm?.full_name ?? "").localeCompare(b.assigned_pm?.full_name ?? ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [invoices, search, jobFilter, pmFilter, confidenceFilter, statusFilters, amountRange, dateStart, dateEnd, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "vendor" || key === "pm" ? "asc" : "desc"); }
  };

  const toggleStatus = (s: string) => {
    setStatusFilters(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const isFiltered = search.trim() !== "" || jobFilter !== "" || pmFilter !== "" || confidenceFilter !== "all" || statusFilters.size > 0 || amountRange !== "all" || dateStart !== "" || dateEnd !== "";

  const clearAllFilters = () => { setSearch(""); setJobFilter(""); setPmFilter(""); setConfidenceFilter("all"); setStatusFilters(new Set()); setAmountRange("all"); setDateStart(""); setDateEnd(""); };

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl text-cream">All Invoices</h2>
            <p className="text-sm text-cream-dim mt-1">
              {isFiltered ? `Showing ${filtered.length} of ${invoices.length} invoices` : `${invoices.length} total invoices`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-teal/30 border-t-teal animate-spin mx-auto" />
            <p className="mt-4 text-cream-dim text-sm">Loading invoices...</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard label="Total Invoices" value={stats.total.toString()} />
              <StatCard label="Total Value" value={formatCents(stats.totalValue)} />
              <StatCard label="Pending Review" value={stats.pending.toString()} sub={`${stats.approved} approved`} />
              <StatCard label="In Draw / Paid" value={`${stats.inDraw} / ${stats.paid}`} />
            </div>

            {/* Primary filters */}
            <div className="flex flex-col md:flex-row gap-3 mb-3">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search vendor or invoice #..."
                  className="w-full pl-9 pr-8 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream placeholder-cream-dim focus:border-teal focus:outline-none" />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-cream-dim hover:text-cream">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}
                className="px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream focus:border-teal focus:outline-none md:w-48">
                <option value="">All Jobs</option>
                {jobNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select value={pmFilter} onChange={(e) => setPmFilter(e.target.value)}
                className="px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream focus:border-teal focus:outline-none md:w-44">
                <option value="">All PMs</option>
                <option value="__unassigned__">Unassigned</option>
                {pmUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
              <select value={confidenceFilter} onChange={(e) => setConfidenceFilter(e.target.value as ConfidenceFilter)}
                className="px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream focus:border-teal focus:outline-none md:w-40">
                <option value="all">All Confidence</option>
                <option value="high">High (≥85%)</option>
                <option value="medium">Medium (70–84%)</option>
                <option value="low">Low (&lt;70%)</option>
              </select>
            </div>

            {/* More Filters toggle */}
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setShowMoreFilters(!showMoreFilters)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-cream-dim hover:text-cream border border-brand-border rounded-xl hover:border-brand-border-light transition-colors">
                <svg className={`w-4 h-4 transition-transform ${showMoreFilters ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                More Filters
                {advancedFilterCount > 0 && (
                  <span className="ml-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-teal text-brand-bg text-[10px] font-bold">
                    {advancedFilterCount}
                  </span>
                )}
              </button>
              {isFiltered && (
                <button onClick={clearAllFilters}
                  className="px-3 py-2 text-sm text-cream-dim hover:text-cream border border-brand-border rounded-xl hover:border-brand-border-light transition-colors">
                  Clear all filters
                </button>
              )}
            </div>

            {/* Advanced filters */}
            {showMoreFilters && (
              <div className="mb-5 p-4 bg-brand-surface/50 border border-brand-border rounded-xl space-y-4 animate-fade-up">
                {/* Status multi-select */}
                <div>
                  <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-2">Status</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_STATUSES.map(s => (
                      <button key={s} onClick={() => toggleStatus(s)}
                        className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                          statusFilters.has(s) ? statusBadgeColor(s) + " font-medium" : "text-cream-dim border-brand-border hover:border-brand-border-light"
                        }`}>
                        {formatStatus(s)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Amount range */}
                  <div>
                    <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-2">Amount Range</p>
                    <select value={amountRange} onChange={(e) => setAmountRange(e.target.value as AmountRange)}
                      className="px-3 py-2 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream focus:border-teal focus:outline-none">
                      <option value="all">All</option>
                      <option value="0-5k">$0 – $5K</option>
                      <option value="5k-25k">$5K – $25K</option>
                      <option value="25k-100k">$25K – $100K</option>
                      <option value="100k+">$100K+</option>
                    </select>
                  </div>
                  {/* Date range */}
                  <div>
                    <p className="text-[11px] font-medium text-cream-dim uppercase tracking-wider mb-2">Invoice Date Range</p>
                    <div className="flex items-center gap-2">
                      <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
                        className="px-3 py-2 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream focus:border-teal focus:outline-none" />
                      <span className="text-cream-dim text-sm">to</span>
                      <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
                        className="px-3 py-2 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream focus:border-teal focus:outline-none" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* No results */}
            {filtered.length === 0 && (
              <div className="text-center py-16">
                <p className="text-cream-muted text-sm">No invoices match your filters</p>
                <button onClick={clearAllFilters} className="mt-2 text-sm text-teal hover:text-teal-hover transition-colors">Clear all filters</button>
              </div>
            )}

            {filtered.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-brand-border animate-fade-up">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand-surface text-left">
                      <th className="py-3 px-4 text-[11px] text-cream font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-teal transition-colors" onClick={() => toggleSort("vendor")}>
                        Vendor<SortArrow active={sortKey === "vendor"} dir={sortDir} />
                      </th>
                      <th className="py-3 px-4 text-[11px] text-cream font-semibold uppercase tracking-wider">Inv #</th>
                      <th className="py-3 px-4 text-[11px] text-cream font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-teal transition-colors" onClick={() => toggleSort("date")}>
                        Date<SortArrow active={sortKey === "date"} dir={sortDir} />
                      </th>
                      <th className="py-3 px-4 text-[11px] text-cream font-semibold uppercase tracking-wider">Job</th>
                      <th className="py-3 px-4 text-[11px] text-cream font-semibold uppercase tracking-wider">Cost Code</th>
                      <th className="py-3 px-4 text-[11px] text-cream font-semibold uppercase tracking-wider text-right cursor-pointer select-none hover:text-teal transition-colors" onClick={() => toggleSort("amount")}>
                        Amount<SortArrow active={sortKey === "amount"} dir={sortDir} />
                      </th>
                      <th className="py-3 px-4 text-[11px] text-cream font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-teal transition-colors" onClick={() => toggleSort("status")}>
                        Status<SortArrow active={sortKey === "status"} dir={sortDir} />
                      </th>
                      <th className="py-3 px-4 text-[11px] text-cream font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-teal transition-colors" onClick={() => toggleSort("pm")}>
                        PM<SortArrow active={sortKey === "pm"} dir={sortDir} />
                      </th>
                      <th className="py-3 px-4 text-[11px] text-cream font-semibold uppercase tracking-wider">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((inv) => (
                      <tr key={inv.id}
                        className="border-t border-brand-row-border hover:bg-brand-elevated/50 cursor-pointer transition-colors"
                        onClick={() => {
                          const reviewable = ["pm_review", "ai_processed"].includes(inv.status);
                          window.location.href = reviewable ? `/invoices/${inv.id}` : `/invoices/${inv.id}`;
                        }}>
                        <td className="py-3 px-4 text-cream font-medium">{inv.vendor_name_raw ?? "Unknown"}</td>
                        <td className="py-3 px-4 text-cream-muted font-mono text-xs">{inv.invoice_number ?? <span className="text-cream-dim">—</span>}</td>
                        <td className="py-3 px-4 text-cream-muted">{formatDate(inv.invoice_date)}</td>
                        <td className="py-3 px-4">
                          {inv.jobs?.name ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-brass-muted text-brass text-xs font-medium">{inv.jobs.name}</span>
                          ) : (
                            <span className="text-cream-dim">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-cream-muted text-xs">
                          {inv.cost_codes ? `${inv.cost_codes.code}` : <span className="text-cream-dim">—</span>}
                        </td>
                        <td className="py-3 px-4 text-cream text-right font-medium font-display">{formatCents(inv.total_amount)}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusBadgeColor(inv.status)}`}>
                            {formatStatus(inv.status)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-cream-muted text-xs">{inv.assigned_pm?.full_name ?? <span className="text-cream-dim">—</span>}</td>
                        <td className="py-3 px-4 text-cream-muted text-xs">{formatDate(inv.payment_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
