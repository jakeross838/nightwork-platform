"use client";

import { useCallback, useEffect, useState } from "react";

/* ---------- Types ---------- */

type CalculationMethod = "fixed" | "rate_x_quantity" | "percentage" | "manual";

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

interface FormState {
  name: string;
  calculation_method: CalculationMethod;
  default_amount_cents: string; // dollars input
  default_rate_cents: string; // dollars input
  default_quantity_unit: string;
  default_percentage: string; // whole number input (e.g. "18")
  default_cost_code_id: string;
  sort_order: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  calculation_method: "fixed",
  default_amount_cents: "",
  default_rate_cents: "",
  default_quantity_unit: "month",
  default_percentage: "",
  default_cost_code_id: "",
  sort_order: "0",
};

const METHOD_LABELS: Record<CalculationMethod, string> = {
  fixed: "Fixed",
  rate_x_quantity: "Rate x Qty",
  percentage: "Percentage",
  manual: "Manual",
};

const METHOD_BADGE: Record<CalculationMethod, string> = {
  fixed: "bg-blue-500/20 text-blue-300",
  rate_x_quantity: "bg-purple-500/20 text-purple-300",
  percentage: "bg-amber-500/20 text-amber-300",
  manual: "bg-gray-500/20 text-gray-300",
};

const FIXED_UNITS = ["month", "project", "draw"];
const RATE_UNITS = ["hour", "day", "week", "month"];

/* ---------- Helpers ---------- */

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function defaultValueDisplay(t: BillingType): string {
  switch (t.calculation_method) {
    case "fixed":
      if (t.default_amount_cents != null) {
        const unit = t.default_quantity_unit ?? "month";
        return `${formatCents(t.default_amount_cents)} / ${unit}`;
      }
      return "\u2014";
    case "rate_x_quantity":
      if (t.default_rate_cents != null) {
        const unit = t.default_quantity_unit ?? "hour";
        return `${formatCents(t.default_rate_cents)} / ${unit}`;
      }
      return "\u2014";
    case "percentage":
      if (t.default_percentage != null) {
        return `${(t.default_percentage * 100).toFixed(0)}%`;
      }
      return "\u2014";
    case "manual":
      return "\u2014";
    default:
      return "\u2014";
  }
}

/* ---------- Component ---------- */

export default function InternalBillingTypesManager() {
  const [types, setTypes] = useState<BillingType[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  /* ---- Fetch ---- */

  const fetchTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/internal-billing-types?all=true", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load billing types");
      const data: BillingType[] = await res.json();
      setTypes(data);
    } catch {
      setMessage({ kind: "err", text: "Failed to load billing types." });
    }
  }, []);

  const fetchCostCodes = useCallback(async () => {
    try {
      const res = await fetch("/api/cost-codes", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { codes: CostCode[] };
      setCostCodes(data.codes ?? []);
    } catch {
      // non-critical; picker will be empty
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchTypes(), fetchCostCodes()]).finally(() =>
      setLoading(false)
    );
  }, [fetchTypes, fetchCostCodes]);

  /* ---- Form helpers ---- */

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setMessage(null);
  }

  function openEdit(t: BillingType) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      calculation_method: t.calculation_method,
      default_amount_cents:
        t.default_amount_cents != null
          ? (t.default_amount_cents / 100).toString()
          : "",
      default_rate_cents:
        t.default_rate_cents != null
          ? (t.default_rate_cents / 100).toString()
          : "",
      default_quantity_unit: t.default_quantity_unit ?? "month",
      default_percentage:
        t.default_percentage != null
          ? (t.default_percentage * 100).toString()
          : "",
      default_cost_code_id: t.default_cost_code_id ?? "",
      sort_order: t.sort_order.toString(),
    });
    setShowForm(true);
    setMessage(null);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /* ---- Save ---- */

  async function handleSave() {
    if (!form.name.trim()) {
      setMessage({ kind: "err", text: "Name is required." });
      return;
    }

    setSaving(true);
    setMessage(null);

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      calculation_method: form.calculation_method,
      sort_order: parseInt(form.sort_order, 10) || 0,
      default_cost_code_id: form.default_cost_code_id || null,
    };

    // Clear fields that don't apply to the selected method
    body.default_amount_cents = null;
    body.default_rate_cents = null;
    body.default_quantity_unit = null;
    body.default_percentage = null;

    switch (form.calculation_method) {
      case "fixed": {
        const dollars = parseFloat(form.default_amount_cents);
        if (!isNaN(dollars)) body.default_amount_cents = Math.round(dollars * 100);
        body.default_quantity_unit = form.default_quantity_unit || "month";
        break;
      }
      case "rate_x_quantity": {
        const dollars = parseFloat(form.default_rate_cents);
        if (!isNaN(dollars)) body.default_rate_cents = Math.round(dollars * 100);
        body.default_quantity_unit = form.default_quantity_unit || "hour";
        break;
      }
      case "percentage": {
        const pct = parseFloat(form.default_percentage);
        if (!isNaN(pct)) body.default_percentage = pct / 100; // 18 -> 0.18
        break;
      }
      case "manual":
        break;
    }

    try {
      const url = editingId
        ? `/api/internal-billing-types/${editingId}`
        : "/api/internal-billing-types";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? `Save failed (${res.status})`
        );
      }
      setMessage({ kind: "ok", text: editingId ? "Updated." : "Created." });
      cancelForm();
      await fetchTypes();
    } catch (e) {
      setMessage({
        kind: "err",
        text: e instanceof Error ? e.message : "Save failed",
      });
    } finally {
      setSaving(false);
    }
  }

  /* ---- Toggle active ---- */

  async function toggleActive(t: BillingType) {
    try {
      const res = await fetch(`/api/internal-billing-types/${t.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_active: !t.is_active }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      await fetchTypes();
    } catch {
      setMessage({ kind: "err", text: "Failed to toggle active status." });
    }
  }

  /* ---- Reorder ---- */

  async function swapOrder(indexA: number, indexB: number) {
    if (indexB < 0 || indexB >= types.length) return;
    const a = types[indexA];
    const b = types[indexB];

    // Optimistic update
    setTypes((prev) => {
      const next = [...prev];
      next[indexA] = { ...a, sort_order: b.sort_order };
      next[indexB] = { ...b, sort_order: a.sort_order };
      next.sort((x, y) => x.sort_order - y.sort_order);
      return next;
    });

    try {
      await Promise.all([
        fetch(`/api/internal-billing-types/${a.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sort_order: b.sort_order }),
        }),
        fetch(`/api/internal-billing-types/${b.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sort_order: a.sort_order }),
        }),
      ]);
    } catch {
      await fetchTypes(); // revert on failure
    }
  }

  /* ---- Render ---- */

  if (loading) {
    return (
      <div className="text-[rgba(59,88,100,0.55)] text-sm py-12 text-center">
        Loading billing types...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-slate-tile">
            Internal Billing Types
          </h2>
          <p className="text-sm text-[rgba(59,88,100,0.55)] mt-0.5">
            Define reusable billing categories (GC Fee, Supervision, Permits,
            etc.) that can be applied per-job.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="px-4 py-2 bg-slate-deep text-white text-sm shrink-0"
        >
          + Add Type
        </button>
      </div>

      {/* Message */}
      {message && (
        <p
          className={`text-xs ${
            message.kind === "ok" ? "text-nw-success" : "text-nw-danger"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Form */}
      {showForm && (
        <div className="border border-[rgba(59,88,100,0.15)] bg-white p-4 space-y-4">
          <h3 className="text-[11px] tracking-[0.08em] uppercase text-[rgba(59,88,100,0.55)]">
            {editingId ? "Edit Billing Type" : "New Billing Type"}
          </h3>

          <div className="grid sm:grid-cols-2 gap-3">
            {/* Name */}
            <label className="block">
              <span className="block text-[11px] tracking-[0.08em] uppercase text-[rgba(59,88,100,0.55)] mb-1">
                Name
              </span>
              <input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="e.g. GC Fee, Supervision, Permit Fee"
                className="w-full border border-[rgba(59,88,100,0.15)] bg-[rgba(91,134,153,0.06)] text-slate-tile text-sm px-3 py-2"
              />
            </label>

            {/* Calculation Method */}
            <label className="block">
              <span className="block text-[11px] tracking-[0.08em] uppercase text-[rgba(59,88,100,0.55)] mb-1">
                Calculation Method
              </span>
              <select
                value={form.calculation_method}
                onChange={(e) =>
                  updateField(
                    "calculation_method",
                    e.target.value as CalculationMethod
                  )
                }
                className="w-full border border-[rgba(59,88,100,0.15)] bg-[rgba(91,134,153,0.06)] text-slate-tile text-sm px-3 py-2"
              >
                <option value="fixed">Fixed Amount</option>
                <option value="rate_x_quantity">Rate x Quantity</option>
                <option value="percentage">Percentage</option>
                <option value="manual">Manual Entry</option>
              </select>
            </label>

            {/* Conditional fields */}
            {form.calculation_method === "fixed" && (
              <>
                <label className="block">
                  <span className="block text-[11px] tracking-[0.08em] uppercase text-[rgba(59,88,100,0.55)] mb-1">
                    Default Amount ($)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.default_amount_cents}
                    onChange={(e) =>
                      updateField("default_amount_cents", e.target.value)
                    }
                    placeholder="4000.00"
                    className="w-full border border-[rgba(59,88,100,0.15)] bg-[rgba(91,134,153,0.06)] text-slate-tile text-sm px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="block text-[11px] tracking-[0.08em] uppercase text-[rgba(59,88,100,0.55)] mb-1">
                    Unit
                  </span>
                  <select
                    value={form.default_quantity_unit}
                    onChange={(e) =>
                      updateField("default_quantity_unit", e.target.value)
                    }
                    className="w-full border border-[rgba(59,88,100,0.15)] bg-[rgba(91,134,153,0.06)] text-slate-tile text-sm px-3 py-2"
                  >
                    {FIXED_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            {form.calculation_method === "rate_x_quantity" && (
              <>
                <label className="block">
                  <span className="block text-[11px] tracking-[0.08em] uppercase text-[rgba(59,88,100,0.55)] mb-1">
                    Default Rate ($)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.default_rate_cents}
                    onChange={(e) =>
                      updateField("default_rate_cents", e.target.value)
                    }
                    placeholder="35.00"
                    className="w-full border border-[rgba(59,88,100,0.15)] bg-[rgba(91,134,153,0.06)] text-slate-tile text-sm px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="block text-[11px] tracking-[0.08em] uppercase text-[rgba(59,88,100,0.55)] mb-1">
                    Unit
                  </span>
                  <select
                    value={form.default_quantity_unit}
                    onChange={(e) =>
                      updateField("default_quantity_unit", e.target.value)
                    }
                    className="w-full border border-[rgba(59,88,100,0.15)] bg-[rgba(91,134,153,0.06)] text-slate-tile text-sm px-3 py-2"
                  >
                    {RATE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            {form.calculation_method === "percentage" && (
              <label className="block sm:col-span-2">
                <span className="block text-[11px] tracking-[0.08em] uppercase text-[rgba(59,88,100,0.55)] mb-1">
                  Default Percentage
                </span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.default_percentage}
                  onChange={(e) =>
                    updateField("default_percentage", e.target.value)
                  }
                  placeholder="18"
                  className="w-full border border-[rgba(59,88,100,0.15)] bg-[rgba(91,134,153,0.06)] text-slate-tile text-sm px-3 py-2"
                />
                <span className="text-[10px] text-[rgba(59,88,100,0.55)] mt-1 block">
                  Enter as whole number (e.g. 18 for 18%)
                </span>
              </label>
            )}

            {/* Cost code picker -- all methods */}
            <label className="block">
              <span className="block text-[11px] tracking-[0.08em] uppercase text-[rgba(59,88,100,0.55)] mb-1">
                Default Cost Code (optional)
              </span>
              <select
                value={form.default_cost_code_id}
                onChange={(e) =>
                  updateField("default_cost_code_id", e.target.value)
                }
                className="w-full border border-[rgba(59,88,100,0.15)] bg-[rgba(91,134,153,0.06)] text-slate-tile text-sm px-3 py-2"
              >
                <option value="">-- None --</option>
                {costCodes.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.code} - {cc.description}
                  </option>
                ))}
              </select>
            </label>

            {/* Sort order */}
            <label className="block">
              <span className="block text-[11px] tracking-[0.08em] uppercase text-[rgba(59,88,100,0.55)] mb-1">
                Sort Order
              </span>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => updateField("sort_order", e.target.value)}
                className="w-full border border-[rgba(59,88,100,0.15)] bg-[rgba(91,134,153,0.06)] text-slate-tile text-sm px-3 py-2"
              />
            </label>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="px-4 py-2 bg-slate-deep text-white text-sm disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="px-4 py-2 border border-[rgba(59,88,100,0.15)] text-slate-tile text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border border-[rgba(59,88,100,0.15)] bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[rgba(91,134,153,0.06)]">
            <tr className="text-left text-[11px] tracking-[0.08em] uppercase text-[rgba(59,88,100,0.55)]">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Method</th>
              <th className="px-3 py-2 font-medium">Default Value</th>
              <th className="px-3 py-2 font-medium text-center">Active</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t, idx) => (
              <tr key={t.id} className="border-t border-[rgba(59,88,100,0.08)]">
                <td className="px-3 py-2 text-slate-tile font-medium">
                  {t.name}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider rounded ${METHOD_BADGE[t.calculation_method]}`}
                  >
                    {METHOD_LABELS[t.calculation_method]}
                  </span>
                </td>
                <td className="px-3 py-2 text-[rgba(59,88,100,0.55)]">
                  {defaultValueDisplay(t)}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => toggleActive(t)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      t.is_active ? "bg-green-500" : "bg-gray-600"
                    }`}
                    role="switch"
                    aria-checked={t.is_active}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                        t.is_active ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => swapOrder(idx, idx - 1)}
                      disabled={idx === 0}
                      className="text-xs px-1.5 py-1 border border-[rgba(59,88,100,0.15)] hover:bg-[rgba(91,134,153,0.06)] disabled:opacity-30"
                      title="Move up"
                    >
                      &#9650;
                    </button>
                    <button
                      type="button"
                      onClick={() => swapOrder(idx, idx + 1)}
                      disabled={idx === types.length - 1}
                      className="text-xs px-1.5 py-1 border border-[rgba(59,88,100,0.15)] hover:bg-[rgba(91,134,153,0.06)] disabled:opacity-30"
                      title="Move down"
                    >
                      &#9660;
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(t)}
                      className="text-xs px-2 py-1 border border-[rgba(59,88,100,0.15)] hover:bg-[rgba(91,134,153,0.06)] text-slate-tile"
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {types.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-[rgba(59,88,100,0.55)] text-sm"
                >
                  No billing types yet. Click &quot;+ Add Type&quot; to create
                  one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[rgba(59,88,100,0.55)]">
        {types.length} billing type{types.length !== 1 ? "s" : ""} total.
      </p>
    </div>
  );
}
