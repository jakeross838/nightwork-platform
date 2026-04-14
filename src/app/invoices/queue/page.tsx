"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatCents, confidenceColor, daysAgo, formatDate } from "@/lib/utils/format";
import NavBar from "@/components/nav-bar";

interface QueueInvoice {
  id: string;
  vendor_name_raw: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total_amount: number;
  confidence_score: number;
  received_date: string;
  status: string;
  jobs: { name: string } | null;
  assigned_pm: { id: string; full_name: string } | null;
}

interface PmUser {
  id: string;
  full_name: string;
}

type SortKey = "vendor" | "date" | "amount" | "confidence" | "waiting" | "pm";
type SortDir = "asc" | "desc";
type ConfidenceFilter = "all" | "high" | "medium" | "low";
type StatusFilter = "pending" | "held" | "kicked_back" | "all";
type AmountRange = "all" | "0-5k" | "5k-25k" | "25k-100k" | "100k+";

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-cream-dim/40">&#8597;</span>;
  return <span className="ml-1 text-teal">{dir === "asc" ? "\u2191" : "\u2193"}</span>;
}

export default function QueuePage() {
  const [invoices, setInvoices] = useState<QueueInvoice[]>([]);
  const [pmUsers, setPmUsers] = useState<PmUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Primary filters (always visible)
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [pmFilter, setPmFilter] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");

  // Advanced filters (collapsible)
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [amountRange, setAmountRange] = useState<AmountRange>("all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("waiting");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    async function fetchData() {
      const [invoiceResult, pmResult] = await Promise.all([
        supabase
          .from("invoices")
          .select(
            "id, vendor_name_raw, invoice_number, invoice_date, total_amount, confidence_score, received_date, status, jobs:job_id (name), assigned_pm:assigned_pm_id (id, full_name)"
          )
          .in("status", ["pm_review", "ai_processed", "pm_held"])
          .is("deleted_at", null)
          .order("received_date", { ascending: true }),
        supabase
          .from("users")
          .select("id, full_name")
          .in("role", ["pm", "admin"])
          .is("deleted_at", null)
          .order("full_name"),
      ]);

      if (!invoiceResult.error && invoiceResult.data) {
        setInvoices(invoiceResult.data as unknown as QueueInvoice[]);
      }
      if (!pmResult.error && pmResult.data) {
        setPmUsers(pmResult.data as PmUser[]);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  // Unique job names for dropdown
  const jobNames = useMemo(() => {
    const names = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.jobs?.name) names.add(inv.jobs.name);
    });
    return Array.from(names).sort();
  }, [invoices]);

  // Count active advanced filters for badge
  const advancedFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "pending") count++;
    if (amountRange !== "all") count++;
    if (dateStart || dateEnd) count++;
    return count;
  }, [statusFilter, amountRange, dateStart, dateEnd]);

  // Filter + sort
  const filtered = useMemo(() => {
    let result = invoices;

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (inv) =>
          (inv.vendor_name_raw ?? "").toLowerCase().includes(q) ||
          (inv.invoice_number ?? "").toLowerCase().includes(q)
      );
    }

    // Job filter
    if (jobFilter) {
      result = result.filter((inv) => inv.jobs?.name === jobFilter);
    }

    // PM filter
    if (pmFilter) {
      if (pmFilter === "__unassigned__") {
        result = result.filter((inv) => !inv.assigned_pm);
      } else {
        result = result.filter((inv) => inv.assigned_pm?.id === pmFilter);
      }
    }

    // Confidence filter
    if (confidenceFilter !== "all") {
      result = result.filter((inv) => {
        const s = inv.confidence_score;
        if (confidenceFilter === "high") return s >= 0.85;
        if (confidenceFilter === "medium") return s >= 0.7 && s < 0.85;
        return s < 0.7; // low
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "pending") {
        result = result.filter(
          (inv) => inv.status === "pm_review" || inv.status === "ai_processed"
        );
      } else if (statusFilter === "held") {
        result = result.filter((inv) => inv.status === "pm_held");
      } else if (statusFilter === "kicked_back") {
        // Kicked-back items return to pm_review status
        result = result.filter((inv) => inv.status === "pm_review");
      }
    }

    // Amount range filter
    if (amountRange !== "all") {
      result = result.filter((inv) => {
        const amt = inv.total_amount;
        switch (amountRange) {
          case "0-5k":
            return amt >= 0 && amt < 500000;
          case "5k-25k":
            return amt >= 500000 && amt < 2500000;
          case "25k-100k":
            return amt >= 2500000 && amt < 10000000;
          case "100k+":
            return amt >= 10000000;
          default:
            return true;
        }
      });
    }

    // Date range filter (received_date)
    if (dateStart) {
      result = result.filter((inv) => inv.received_date >= dateStart);
    }
    if (dateEnd) {
      result = result.filter((inv) => inv.received_date <= dateEnd);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "vendor":
          cmp = (a.vendor_name_raw ?? "").localeCompare(
            b.vendor_name_raw ?? ""
          );
          break;
        case "date":
          cmp = (a.invoice_date ?? "").localeCompare(b.invoice_date ?? "");
          break;
        case "amount":
          cmp = a.total_amount - b.total_amount;
          break;
        case "confidence":
          cmp = a.confidence_score - b.confidence_score;
          break;
        case "waiting":
          cmp = daysAgo(a.received_date) - daysAgo(b.received_date);
          break;
        case "pm":
          cmp = (a.assigned_pm?.full_name ?? "").localeCompare(
            b.assigned_pm?.full_name ?? ""
          );
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [
    invoices,
    search,
    jobFilter,
    pmFilter,
    confidenceFilter,
    statusFilter,
    amountRange,
    dateStart,
    dateEnd,
    sortKey,
    sortDir,
  ]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "vendor" || key === "pm" ? "asc" : "desc");
    }
  };

  const isFiltered =
    search.trim() !== "" ||
    jobFilter !== "" ||
    pmFilter !== "" ||
    confidenceFilter !== "all" ||
    statusFilter !== "pending" ||
    amountRange !== "all" ||
    dateStart !== "" ||
    dateEnd !== "";

  const clearAllFilters = () => {
    setSearch("");
    setJobFilter("");
    setPmFilter("");
    setConfidenceFilter("all");
    setStatusFilter("pending");
    setAmountRange("all");
    setDateStart("");
    setDateEnd("");
  };

  return (
    <div className="min-h-screen">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl text-cream">PM Queue</h2>
            <p className="text-sm text-cream-dim mt-1">
              {isFiltered
                ? `Showing ${filtered.length} of ${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}`
                : `${invoices.length} invoice${invoices.length !== 1 ? "s" : ""} pending PM review`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-teal/30 border-t-teal animate-spin mx-auto" />
            <p className="mt-4 text-cream-dim text-sm">Loading queue...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-20 animate-fade-up">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-surface border border-brand-border mb-6">
              <svg
                className="w-7 h-7 text-cream-dim"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-cream text-lg font-display">All clear</p>
            <p className="text-cream-dim text-sm mt-1">
              No invoices pending review
            </p>
          </div>
        ) : (
          <>
            {/* Primary filter row */}
            <div className="flex flex-col md:flex-row gap-3 mb-3">
              {/* Search */}
              <div className="relative flex-1">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-dim"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search vendor or invoice #..."
                  className="w-full pl-9 pr-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream placeholder-cream-dim focus:border-teal focus:outline-none"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-cream-dim hover:text-cream"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Job dropdown */}
              <select
                value={jobFilter}
                onChange={(e) => setJobFilter(e.target.value)}
                className="px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream focus:border-teal focus:outline-none md:w-48"
              >
                <option value="">All Jobs</option>
                {jobNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              {/* PM dropdown */}
              <select
                value={pmFilter}
                onChange={(e) => setPmFilter(e.target.value)}
                className="px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream focus:border-teal focus:outline-none md:w-48"
              >
                <option value="">All PMs</option>
                <option value="__unassigned__">Unassigned</option>
                {pmUsers.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.full_name}
                  </option>
                ))}
              </select>

              {/* Confidence filter */}
              <select
                value={confidenceFilter}
                onChange={(e) =>
                  setConfidenceFilter(e.target.value as ConfidenceFilter)
                }
                className="px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream focus:border-teal focus:outline-none md:w-40"
              >
                <option value="all">All Confidence</option>
                <option value="high">High (&ge;85%)</option>
                <option value="medium">Medium (70-84%)</option>
                <option value="low">Low (&lt;70%)</option>
              </select>
            </div>

            {/* More Filters toggle + advanced filters */}
            <div className="mb-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowMoreFilters((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-cream-dim hover:text-cream border border-brand-border rounded-xl hover:border-brand-border-light transition-colors"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${showMoreFilters ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                  More Filters
                  {!showMoreFilters && advancedFilterCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal/20 text-teal text-xs font-semibold">
                      {advancedFilterCount}
                    </span>
                  )}
                </button>

                {/* Clear filters */}
                {isFiltered && (
                  <button
                    onClick={clearAllFilters}
                    className="px-3 py-2 text-sm text-cream-dim hover:text-cream border border-brand-border rounded-xl hover:border-brand-border-light transition-colors whitespace-nowrap"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              {showMoreFilters && (
                <div className="flex flex-col md:flex-row gap-3 mt-3 pl-0 md:pl-0">
                  {/* Status filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as StatusFilter)
                    }
                    className="px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream focus:border-teal focus:outline-none md:w-44"
                  >
                    <option value="pending">Pending Review</option>
                    <option value="held">Held</option>
                    <option value="kicked_back">Kicked Back</option>
                    <option value="all">All Statuses</option>
                  </select>

                  {/* Amount range */}
                  <select
                    value={amountRange}
                    onChange={(e) =>
                      setAmountRange(e.target.value as AmountRange)
                    }
                    className="px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream focus:border-teal focus:outline-none md:w-40"
                  >
                    <option value="all">All Amounts</option>
                    <option value="0-5k">$0 - $5K</option>
                    <option value="5k-25k">$5K - $25K</option>
                    <option value="25k-100k">$25K - $100K</option>
                    <option value="100k+">$100K+</option>
                  </select>

                  {/* Date range start */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-cream-dim whitespace-nowrap">
                      From
                    </label>
                    <input
                      type="date"
                      value={dateStart}
                      onChange={(e) => setDateStart(e.target.value)}
                      className="px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream focus:border-teal focus:outline-none"
                    />
                  </div>

                  {/* Date range end */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-cream-dim whitespace-nowrap">
                      To
                    </label>
                    <input
                      type="date"
                      value={dateEnd}
                      onChange={(e) => setDateEnd(e.target.value)}
                      className="px-3 py-2.5 bg-brand-surface border border-brand-border rounded-xl text-sm text-cream focus:border-teal focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* No results after filtering */}
            {filtered.length === 0 && (
              <div className="text-center py-16 animate-fade-up">
                <p className="text-cream-muted text-sm">
                  No invoices match your filters
                </p>
                <button
                  onClick={clearAllFilters}
                  className="mt-2 text-sm text-teal hover:text-teal-hover transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            )}

            {filtered.length > 0 && (
              <>
                {/* Mobile card layout */}
                <div className="flex flex-col gap-3 md:hidden">
                  {filtered.map((inv, i) => (
                    <div
                      key={inv.id}
                      className="bg-brand-card border border-brand-border rounded-xl p-4 cursor-pointer active:opacity-80 transition-opacity animate-fade-up"
                      style={{ animationDelay: `${0.05 + i * 0.03}s` }}
                      onClick={() =>
                        (window.location.href = `/invoices/${inv.id}`)
                      }
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-cream font-medium text-base">
                          {inv.vendor_name_raw ?? "Unknown"}
                        </span>
                        <span className="text-cream font-display font-medium text-lg">
                          {formatCents(inv.total_amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div>
                          {inv.jobs?.name ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-brass-muted text-brass text-xs font-medium">
                              {inv.jobs.name}
                            </span>
                          ) : (
                            <span className="text-cream-dim text-xs">
                              Unmatched
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${confidenceColor(inv.confidence_score)}`}
                          >
                            {Math.round(inv.confidence_score * 100)}%
                          </span>
                          {(() => {
                            const d = daysAgo(inv.received_date);
                            return (
                              <span
                                className={`text-sm font-medium ${d > 5 ? "text-status-danger" : d > 2 ? "text-brass" : "text-cream-dim"}`}
                              >
                                {d}d
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                      {/* PM name + invoice details */}
                      <div className="flex items-center gap-2 mt-2 text-xs text-cream-muted">
                        <span className={inv.assigned_pm ? "text-cream-muted" : "text-cream-dim"}>
                          {inv.assigned_pm?.full_name ?? "Unassigned"}
                        </span>
                        {(inv.invoice_number || inv.invoice_date) && (
                          <>
                            <span>&middot;</span>
                            {inv.invoice_number && (
                              <span className="font-mono">
                                #{inv.invoice_number}
                              </span>
                            )}
                            {inv.invoice_number && inv.invoice_date && (
                              <span>&middot;</span>
                            )}
                            {inv.invoice_date && <span>{formatDate(inv.invoice_date)}</span>}
                          </>
                        )}
                      </div>
                      {inv.status === "pm_held" && (
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-400 text-xs font-medium border border-yellow-500/25">
                            Held
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop table layout */}
                <div className="hidden md:block overflow-x-auto rounded-2xl border border-brand-border animate-fade-up">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-brand-surface text-left">
                        <th
                          className="py-3 px-5 text-[11px] text-cream font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-teal transition-colors"
                          onClick={() => toggleSort("vendor")}
                        >
                          Vendor
                          <SortArrow
                            active={sortKey === "vendor"}
                            dir={sortDir}
                          />
                        </th>
                        <th className="py-3 px-5 text-[11px] text-cream font-semibold uppercase tracking-wider">
                          Invoice #
                        </th>
                        <th
                          className="py-3 px-5 text-[11px] text-cream font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-teal transition-colors"
                          onClick={() => toggleSort("date")}
                        >
                          Date
                          <SortArrow
                            active={sortKey === "date"}
                            dir={sortDir}
                          />
                        </th>
                        <th className="py-3 px-5 text-[11px] text-cream font-semibold uppercase tracking-wider">
                          Job
                        </th>
                        <th
                          className="py-3 px-5 text-[11px] text-cream font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-teal transition-colors"
                          onClick={() => toggleSort("pm")}
                        >
                          PM
                          <SortArrow
                            active={sortKey === "pm"}
                            dir={sortDir}
                          />
                        </th>
                        <th
                          className="py-3 px-5 text-[11px] text-cream font-semibold uppercase tracking-wider text-right cursor-pointer select-none hover:text-teal transition-colors"
                          onClick={() => toggleSort("amount")}
                        >
                          Amount
                          <SortArrow
                            active={sortKey === "amount"}
                            dir={sortDir}
                          />
                        </th>
                        <th
                          className="py-3 px-5 text-[11px] text-cream font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-teal transition-colors"
                          onClick={() => toggleSort("confidence")}
                        >
                          Confidence
                          <SortArrow
                            active={sortKey === "confidence"}
                            dir={sortDir}
                          />
                        </th>
                        <th
                          className="py-3 px-5 text-[11px] text-cream font-semibold uppercase tracking-wider text-right cursor-pointer select-none hover:text-teal transition-colors"
                          onClick={() => toggleSort("waiting")}
                        >
                          Waiting
                          <SortArrow
                            active={sortKey === "waiting"}
                            dir={sortDir}
                          />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((inv) => (
                        <tr
                          key={inv.id}
                          className="border-t border-brand-row-border hover:bg-brand-elevated/50 cursor-pointer transition-colors"
                          onClick={() =>
                            (window.location.href = `/invoices/${inv.id}`)
                          }
                        >
                          <td className="py-4 px-5 text-cream font-medium">
                            {inv.vendor_name_raw ?? "Unknown"}
                            {inv.status === "pm_held" && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 text-[10px] font-medium border border-yellow-500/25">
                                Held
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-5 text-cream-muted font-mono text-xs">
                            {inv.invoice_number ?? (
                              <span className="text-cream-dim">&mdash;</span>
                            )}
                          </td>
                          <td className="py-4 px-5 text-cream-muted">
                            {formatDate(inv.invoice_date)}
                          </td>
                          <td className="py-4 px-5">
                            {inv.jobs?.name ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-brass-muted text-brass text-xs font-medium">
                                {inv.jobs.name}
                              </span>
                            ) : (
                              <span className="text-cream-dim">Unmatched</span>
                            )}
                          </td>
                          <td className="py-4 px-5">
                            <span
                              className={
                                inv.assigned_pm
                                  ? "text-cream-muted text-sm"
                                  : "text-cream-dim text-sm"
                              }
                            >
                              {inv.assigned_pm?.full_name ?? "Unassigned"}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-cream text-right font-medium font-display">
                            {formatCents(inv.total_amount)}
                          </td>
                          <td className="py-4 px-5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${confidenceColor(inv.confidence_score)}`}
                            >
                              {Math.round(inv.confidence_score * 100)}%
                            </span>
                          </td>
                          <td className="py-4 px-5 text-right">
                            {(() => {
                              const d = daysAgo(inv.received_date);
                              return (
                                <span
                                  className={`text-sm font-medium ${d > 5 ? "text-status-danger" : d > 2 ? "text-brass" : "text-cream-dim"}`}
                                >
                                  {d}d
                                </span>
                              );
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
