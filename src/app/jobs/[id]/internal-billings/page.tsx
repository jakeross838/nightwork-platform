"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JobTabs from "@/components/job-tabs";
import JobFinancialBar from "@/components/job-financial-bar";
import Breadcrumbs from "@/components/breadcrumbs";
import EmptyState, { EmptyIcons } from "@/components/empty-state";
import BudgetCostsSubTabs from "@/components/budget-costs-sub-tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatCents } from "@/lib/utils/format";
import { supabase } from "@/lib/supabase/client";

/* ---------- Types ---------- */

type CalculationMethod = "fixed" | "rate_x_quantity" | "percentage" | "manual";
type BillingStatus = "draft" | "attached" | "billed" | "paid";

interface Job {
  id: string;
  name: string;
  address: string | null;
}

interface BillingType {
  id: string;
  name: string;
  calculation_method: CalculationMethod;
  default_amount_cents: number | null;
  default_rate_cents: number | null;
  default_quantity_unit: string | null;
  default_percentage: number | null;
  default_cost_code_id: string | null;
  is_active: boolean;
  sort_order: number;
}

interface CostCode {
  id: string;
  code: string;
  description: string;
}

interface InternalBilling {
  id: string;
  billing_type_id: string;
  cost_code_id: string | null;
  description: string | null;
  amount_cents: number;
  rate_cents: number | null;
  quantity: number | null;
  percentage: number | null;
  period_start: string | null;
  period_end: string | null;
  status: BillingStatus;
  notes: string | null;
  created_at: string;
  internal_billing_types: {
    name: string;
    calculation_method: CalculationMethod;
  } | null;
  cost_codes: {
    code: string;
    description: string;
  } | null;
}

interface FormState {
  billing_type_id: string;
  cost_code_id: string;
  description: string;
  amount_dollars: string;
  rate_dollars: string;
  quantity: string;
  percentage: string;
  period_start: string;
  period_end: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  billing_type_id: "",
  cost_code_id: "",
  description: "",
  amount_dollars: "",
  rate_dollars: "",
  quantity: "",
  percentage: "",
  period_start: "",
  period_end: "",
  notes: "",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/* ---------- Helpers ---------- */

function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return "\u2014";
  const fmt = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    if (isNaN(dt.getTime())) return d;
    return `${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
  };
  if (start && end) return `${fmt(start)} \u2014 ${fmt(end)}`;
  if (start) return `${fmt(start)} \u2014`;
  return `\u2014 ${fmt(end!)}`;
}

function statusBadgeStyle(status: BillingStatus): React.CSSProperties {
  // Theme-adaptive: pull colours from CSS vars so badges stay readable in
  // light + dark. Draft = neutral, billed = brand, paid = success,
  // attached = info. Token values live in colors_and_type.css.
  switch (status) {
    case "draft":
      return {
        background: "var(--bg-elevated)",
        color: "var(--text-secondary)",
      };
    case "attached":
      return {
        background: "var(--nw-oceanside)",
        color: "var(--nw-white-sand)",
      };
    case "billed":
      return {
        background: "var(--nw-stone-blue)",
        color: "var(--nw-white-sand)",
      };
    case "paid":
      return {
        background: "var(--nw-success)",
        color: "var(--nw-white-sand)",
      };
    default:
      return {
        background: "var(--bg-elevated)",
        color: "var(--text-secondary)",
      };
  }
}

function statusLabel(status: BillingStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/* ---------- Component ---------- */

export default function JobInternalBillingsPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [billings, setBillings] = useState<InternalBilling[]>([]);
  const [billingTypes, setBillingTypes] = useState<BillingType[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /* ---- Fetch ---- */

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [jobRes, billingsRes, typesRes, codesRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, name, address")
          .eq("id", params.id)
          .is("deleted_at", null)
          .single(),
        fetch(`/api/jobs/${params.id}/internal-billings`, {
          cache: "no-store",
        }).then((r) => {
          if (!r.ok) throw new Error(`Failed to load internal billings (${r.status})`);
          return r.json();
        }),
        fetch("/api/internal-billing-types", { cache: "no-store" }).then((r) => {
          if (!r.ok) throw new Error(`Failed to load billing types (${r.status})`);
          return r.json();
        }),
        fetch("/api/cost-codes", { cache: "no-store" }).then((r) => {
          if (!r.ok) throw new Error(`Failed to load cost codes (${r.status})`);
          return r.json();
        }),
      ]);

      if (jobRes.data) setJob(jobRes.data as Job);
      setBillings(Array.isArray(billingsRes) ? billingsRes : []);
      setBillingTypes(Array.isArray(typesRes) ? typesRes : []);
      const codes = codesRes?.codes ?? codesRes;
      setCostCodes(Array.isArray(codes) ? codes : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace(
          `/login?redirect=/jobs/${params.id}/internal-billings`
        );
        return;
      }
      await loadData();
    })();
  }, [params.id, router, loadData]);

  /* ---- KPIs ---- */

  const totalUnbilled = useMemo(() => {
    return billings
      .filter((b) => b.status === "draft")
      .reduce((sum, b) => sum + b.amount_cents, 0);
  }, [billings]);

  const billedTotal = useMemo(() => {
    return billings
      .filter((b) => b.status === "attached" || b.status === "billed" || b.status === "paid")
      .reduce((sum, b) => sum + b.amount_cents, 0);
  }, [billings]);

  /* ---- Selected type helper ---- */

  const selectedType = useMemo(() => {
    if (!form.billing_type_id) return null;
    return billingTypes.find((t) => t.id === form.billing_type_id) ?? null;
  }, [form.billing_type_id, billingTypes]);

  /* ---- Live rate x quantity computation ---- */

  const computedTotal = useMemo(() => {
    if (selectedType?.calculation_method !== "rate_x_quantity") return null;
    const rateDollars = parseFloat(form.rate_dollars);
    const qty = parseFloat(form.quantity);
    if (isNaN(rateDollars) || isNaN(qty)) return null;
    const rateCents = Math.round(rateDollars * 100);
    return rateCents * qty;
  }, [selectedType, form.rate_dollars, form.quantity]);

  /* ---- Form open/close ---- */

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setFormError(null);
  }

  function openEdit(billing: InternalBilling) {
    setEditingId(billing.id);
    const method =
      billing.internal_billing_types?.calculation_method ?? "manual";
    setForm({
      billing_type_id: billing.billing_type_id,
      cost_code_id: billing.cost_code_id ?? "",
      description: billing.description ?? "",
      amount_dollars:
        method === "percentage"
          ? ""
          : billing.amount_cents
            ? (billing.amount_cents / 100).toString()
            : "",
      rate_dollars: billing.rate_cents
        ? (billing.rate_cents / 100).toString()
        : "",
      quantity: billing.quantity != null ? billing.quantity.toString() : "",
      percentage:
        billing.percentage != null
          ? (billing.percentage * 100).toString()
          : "",
      period_start: billing.period_start ?? "",
      period_end: billing.period_end ?? "",
      notes: billing.notes ?? "",
    });
    setShowForm(true);
    setFormError(null);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function handleTypeChange(typeId: string) {
    const type = billingTypes.find((t) => t.id === typeId);
    setForm((prev) => ({
      ...prev,
      billing_type_id: typeId,
      cost_code_id: type?.default_cost_code_id ?? prev.cost_code_id,
      amount_dollars:
        type?.calculation_method === "fixed" && type.default_amount_cents != null
          ? (type.default_amount_cents / 100).toString()
          : prev.amount_dollars,
      rate_dollars:
        type?.calculation_method === "rate_x_quantity" &&
        type.default_rate_cents != null
          ? (type.default_rate_cents / 100).toString()
          : prev.rate_dollars,
      percentage:
        type?.calculation_method === "percentage" &&
        type.default_percentage != null
          ? (type.default_percentage * 100).toString()
          : prev.percentage,
    }));
  }

  /* ---- Submit ---- */

  async function handleSubmit() {
    if (!form.billing_type_id) {
      setFormError("Select a billing type.");
      return;
    }

    setSaving(true);
    setFormError(null);

    const method = selectedType?.calculation_method ?? "manual";

    const body: Record<string, unknown> = {
      billing_type_id: form.billing_type_id,
      cost_code_id: form.cost_code_id || null,
      description: form.description || null,
      period_start: form.period_start || null,
      period_end: form.period_end || null,
      notes: form.notes || null,
    };

    switch (method) {
      case "fixed":
      case "manual": {
        const dollars = parseFloat(form.amount_dollars);
        if (isNaN(dollars) || dollars < 0) {
          setFormError("Enter a valid amount.");
          setSaving(false);
          return;
        }
        body.amount_cents = Math.round(dollars * 100);
        break;
      }
      case "rate_x_quantity": {
        const rate = parseFloat(form.rate_dollars);
        const qty = parseFloat(form.quantity);
        if (isNaN(rate) || rate < 0) {
          setFormError("Enter a valid rate.");
          setSaving(false);
          return;
        }
        if (isNaN(qty) || qty <= 0) {
          setFormError("Enter a valid quantity.");
          setSaving(false);
          return;
        }
        body.rate_cents = Math.round(rate * 100);
        body.quantity = qty;
        body.amount_cents = Math.round(Math.round(rate * 100) * qty);
        break;
      }
      case "percentage": {
        const pct = parseFloat(form.percentage);
        if (isNaN(pct) || pct <= 0 || pct > 100) {
          setFormError("Enter a valid percentage (1-100).");
          setSaving(false);
          return;
        }
        body.percentage = pct / 100; // 18 -> 0.18
        body.amount_cents = 0; // calculated at attach time
        break;
      }
    }

    try {
      const url = editingId
        ? `/api/jobs/${params.id}/internal-billings/${editingId}`
        : `/api/jobs/${params.id}/internal-billings`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? `Save failed (${res.status})`
        );
      }
      cancelForm();
      await loadData();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  /* ---- Delete ---- */

  async function handleDelete(billingId: string) {
    if (!window.confirm("Delete this billing entry?")) return;
    try {
      const res = await fetch(
        `/api/jobs/${params.id}/internal-billings/${billingId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? `Delete failed (${res.status})`
        );
      }
      await loadData();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  /* ---- Render: Loading ---- */

  if (loading) {
    return (
      <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
        <div className="w-8 h-8 border-2 border-[rgba(91,134,153,0.3)] border-t-[var(--nw-stone-blue)] animate-spin mx-auto" />
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="max-w-[640px] mx-auto px-6 py-20">
        <div
          className="border p-6"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--nw-danger)",
            color: "var(--text-primary)",
          }}
        >
          <p
            className="text-[10px] uppercase mb-2"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.14em",
              color: "var(--nw-danger)",
            }}
          >
            Couldn&apos;t load
          </p>
          <p className="text-sm mb-4">{loadError}</p>
          <button
            type="button"
            className="inline-flex items-center gap-2 border px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--border-default)" }}
            onClick={() => {
              setLoading(true);
              loadData();
            }}
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="max-w-[1600px] mx-auto px-6 py-20 text-center">
        <p className="text-[color:var(--text-primary)]">Job not found</p>
        <Link
          href="/jobs"
          className="text-[color:var(--nw-stone-blue)] hover:underline text-sm"
        >
          Back to jobs
        </Link>
      </main>
    );
  }

  /* ---- Render: Main ---- */

  return (
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <Breadcrumbs
          items={[
            { label: "Jobs", href: "/jobs" },
            { label: job.name, href: `/jobs/${job.id}` },
            { label: "Internal Billings" },
          ]}
        />
        <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
          <div>
            <span
              className="block mb-2 text-[10px] uppercase"
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                letterSpacing: "0.14em",
                color: "var(--text-tertiary)",
              }}
            >
              Job · Internal Billings
            </span>
            <h2
              className="m-0"
              style={{
                fontFamily: "var(--font-space-grotesk)",
                fontWeight: 500,
                fontSize: "28px",
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
              }}
            >
              {job.name}
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {job.address ?? "No address"}
            </p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="h-[36px] px-4 text-[11px] uppercase transition-colors"
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              letterSpacing: "0.12em",
              fontWeight: 500,
              background: "var(--nw-stone-blue)",
              color: "var(--nw-white-sand)",
              border: "1px solid var(--nw-stone-blue)",
            }}
          >
            + Add Billing
          </button>
        </div>
        <JobTabs jobId={job.id} active="budget" />
        <JobFinancialBar jobId={job.id} />
        <BudgetCostsSubTabs jobId={job.id} active="internal" />

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[color:var(--text-secondary)] font-medium">
              Total Unbilled
            </p>
            <p className="text-xl font-display text-[color:var(--text-primary)] mt-1 tabular-nums">
              {formatCents(totalUnbilled)}
            </p>
            <p className="text-[11px] text-[color:var(--text-secondary)] mt-0.5">
              Draft billings not yet attached to a draw
            </p>
          </div>
          <div className="border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[color:var(--text-secondary)] font-medium">
              Billed Total
            </p>
            <p className="text-xl font-display text-[color:var(--text-primary)] mt-1 tabular-nums">
              {formatCents(billedTotal)}
            </p>
            <p className="text-[11px] text-[color:var(--text-secondary)] mt-0.5">
              Attached, billed, or paid
            </p>
          </div>
        </div>

        {/* Add / Edit Form */}
        {showForm && (
          <div className="border border-[var(--border-default)] bg-[var(--bg-card)] p-4 mb-6 space-y-4">
            <h3 className="text-[11px] tracking-[0.08em] uppercase text-[color:var(--text-secondary)] font-medium">
              {editingId ? "Edit Billing" : "New Billing"}
            </h3>

            {formError && (
              <p className="text-xs text-[color:var(--nw-danger)]">{formError}</p>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              {/* Billing Type */}
              <label className="block">
                <span className="block text-[11px] tracking-[0.08em] uppercase text-[color:var(--text-secondary)] mb-1">
                  Billing Type
                </span>
                <select
                  value={form.billing_type_id}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[color:var(--text-primary)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--nw-stone-blue)]"
                  disabled={saving}
                >
                  <option value="">-- Select type --</option>
                  {billingTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* Cost Code */}
              <label className="block">
                <span className="block text-[11px] tracking-[0.08em] uppercase text-[color:var(--text-secondary)] mb-1">
                  Cost Code
                </span>
                <select
                  value={form.cost_code_id}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, cost_code_id: e.target.value }))
                  }
                  className="w-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[color:var(--text-primary)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--nw-stone-blue)]"
                  disabled={saving}
                >
                  <option value="">-- None --</option>
                  {costCodes.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.code} - {cc.description}
                    </option>
                  ))}
                </select>
              </label>

              {/* Adaptive fields based on calculation method */}
              {selectedType?.calculation_method === "fixed" && (
                <label className="block">
                  <span className="block text-[11px] tracking-[0.08em] uppercase text-[color:var(--text-secondary)] mb-1">
                    Amount ($)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount_dollars}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        amount_dollars: e.target.value,
                      }))
                    }
                    placeholder="4000.00"
                    className="w-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[color:var(--text-primary)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--nw-stone-blue)]"
                    disabled={saving}
                  />
                  {selectedType.default_quantity_unit && (
                    <span className="text-[10px] text-[color:var(--text-secondary)] mt-1 block">
                      Unit: {selectedType.default_quantity_unit}
                    </span>
                  )}
                </label>
              )}

              {selectedType?.calculation_method === "rate_x_quantity" && (
                <>
                  <label className="block">
                    <span className="block text-[11px] tracking-[0.08em] uppercase text-[color:var(--text-secondary)] mb-1">
                      Rate ($
                      {selectedType.default_quantity_unit
                        ? ` / ${selectedType.default_quantity_unit}`
                        : ""}
                      )
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.rate_dollars}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          rate_dollars: e.target.value,
                        }))
                      }
                      placeholder="35.00"
                      className="w-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[color:var(--text-primary)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--nw-stone-blue)]"
                      disabled={saving}
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] tracking-[0.08em] uppercase text-[color:var(--text-secondary)] mb-1">
                      Quantity
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.quantity}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, quantity: e.target.value }))
                      }
                      placeholder="40"
                      className="w-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[color:var(--text-primary)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--nw-stone-blue)]"
                      disabled={saving}
                    />
                  </label>
                  {/* Live computed total */}
                  <div className="sm:col-span-2">
                    <p className="text-sm text-[color:var(--text-primary)] tabular-nums">
                      {computedTotal != null ? (
                        <>
                          <span className="text-[color:var(--text-secondary)]">Total: </span>
                          <span className="text-[color:var(--nw-stone-blue)] font-medium font-display">
                            {formatCents(computedTotal)}
                          </span>
                          <span className="text-[color:var(--text-secondary)] text-xs ml-2">
                            ({form.rate_dollars || "0"} x {form.quantity || "0"}
                            {selectedType.default_quantity_unit
                              ? ` ${selectedType.default_quantity_unit}s`
                              : ""}
                            )
                          </span>
                        </>
                      ) : (
                        <span className="text-[color:var(--text-secondary)] text-xs">
                          Enter rate and quantity to see total
                        </span>
                      )}
                    </p>
                  </div>
                </>
              )}

              {selectedType?.calculation_method === "percentage" && (
                <div className="sm:col-span-2">
                  <label className="block">
                    <span className="block text-[11px] tracking-[0.08em] uppercase text-[color:var(--text-secondary)] mb-1">
                      Percentage
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={form.percentage}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, percentage: e.target.value }))
                      }
                      placeholder="18"
                      className="w-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[color:var(--text-primary)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--nw-stone-blue)]"
                      disabled={saving}
                    />
                  </label>
                  <p className="text-[10px] text-[color:var(--text-secondary)] mt-1">
                    Enter as whole number (e.g. 18 for 18%). Amount calculated
                    when attached to a draw.
                  </p>
                </div>
              )}

              {selectedType?.calculation_method === "manual" && (
                <label className="block">
                  <span className="block text-[11px] tracking-[0.08em] uppercase text-[color:var(--text-secondary)] mb-1">
                    Amount ($)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount_dollars}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        amount_dollars: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                    className="w-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[color:var(--text-primary)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--nw-stone-blue)]"
                    disabled={saving}
                  />
                </label>
              )}

              {/* Description */}
              <label className="block sm:col-span-2">
                <span className="block text-[11px] tracking-[0.08em] uppercase text-[color:var(--text-secondary)] mb-1">
                  Description
                </span>
                <Textarea
                  minRows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  disabled={saving}
                />
              </label>

              {/* Period */}
              <label className="block">
                <span className="block text-[11px] tracking-[0.08em] uppercase text-[color:var(--text-secondary)] mb-1">
                  Period Start
                </span>
                <input
                  type="date"
                  value={form.period_start}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, period_start: e.target.value }))
                  }
                  className="w-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[color:var(--text-primary)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--nw-stone-blue)]"
                  disabled={saving}
                />
              </label>
              <label className="block">
                <span className="block text-[11px] tracking-[0.08em] uppercase text-[color:var(--text-secondary)] mb-1">
                  Period End
                </span>
                <input
                  type="date"
                  value={form.period_end}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, period_end: e.target.value }))
                  }
                  className="w-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[color:var(--text-primary)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--nw-stone-blue)]"
                  disabled={saving}
                />
              </label>

              {/* Notes */}
              <label className="block sm:col-span-2">
                <span className="block text-[11px] tracking-[0.08em] uppercase text-[color:var(--text-secondary)] mb-1">
                  Notes
                </span>
                <Textarea
                  minRows={2}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  disabled={saving}
                />
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || !form.billing_type_id}
                className="px-4 py-2 bg-[var(--nw-stone-blue)] hover:bg-[var(--nw-gulf-blue)] text-nw-white-sand text-sm font-medium disabled:opacity-60 transition-colors"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Billing"
                    : "Add Billing"}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                disabled={saving}
                className="px-4 py-2 border border-[var(--border-default)] text-[color:var(--text-primary)] text-sm hover:bg-[var(--bg-subtle)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Billings Table */}
        {billings.length === 0 && !showForm ? (
          <EmptyState
            icon={<EmptyIcons.Document />}
            title="No internal billings yet"
            message="Add GC fees, supervision, equipment, and other internal charges for this job."
            primaryAction={{ label: "+ Add Billing", onClick: openAdd }}
          />
        ) : billings.length > 0 ? (
          <div className="border nw-panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] text-[11px] uppercase tracking-wider text-[color:var(--text-secondary)] bg-[rgba(91,134,153,0.04)]">
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">
                    Description
                  </th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 font-medium">Period</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {billings.map((b) => {
                  const method =
                    b.internal_billing_types?.calculation_method ?? "manual";
                  const isDraft = b.status === "draft";

                  return (
                    <tr
                      key={b.id}
                      className="border-b border-[var(--border-default)] last:border-0 hover:bg-[rgba(91,134,153,0.06)] transition-colors"
                    >
                      <td className="px-4 py-3 text-[color:var(--text-primary)] font-medium">
                        {b.internal_billing_types?.name ?? "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-[color:var(--text-muted)]">
                        {b.description || "\u2014"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block px-2 py-0.5 text-[11px] uppercase tracking-wider"
                          style={statusBadgeStyle(b.status)}
                        >
                          {statusLabel(b.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[color:var(--text-primary)] tabular-nums font-display">
                        {method === "percentage" && isDraft
                          ? b.percentage != null
                            ? `${(b.percentage * 100).toFixed(0)}%`
                            : "\u2014"
                          : formatCents(b.amount_cents)}
                      </td>
                      <td className="px-4 py-3 text-[color:var(--text-muted)] text-xs">
                        {formatPeriod(b.period_start, b.period_end)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isDraft ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(b)}
                              className="text-xs text-[color:var(--nw-stone-blue)] hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(b.id)}
                              className="text-xs text-[color:var(--nw-danger)] hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-[color:var(--text-secondary)]">\u2014</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="mt-4 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
          {billings.length} billing{billings.length !== 1 ? "s" : ""} total.
          Percentage billings are computed when attached to a draw.
        </p>
        <style jsx>{`
          :global(.nw-panel) {
            background: var(--bg-card);
            border-color: var(--border-default);
          }
        `}</style>
      </main>
  );
}
