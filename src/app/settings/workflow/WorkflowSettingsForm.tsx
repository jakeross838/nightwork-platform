"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  DuplicateSensitivity,
  WorkflowSettings,
} from "@/lib/workflow-settings";
import { toast } from "@/lib/utils/toast";
import FirstUseTip from "@/components/first-use-tip";

type Pm = { id: string; name: string };
type Props = { settings: WorkflowSettings; pms: Pm[] };

type FormState = {
  batch_approval_enabled: boolean;
  quick_approve_enabled: boolean;
  quick_approve_min_confidence: number;
  require_invoice_date: boolean;
  require_budget_allocation: boolean;
  require_po_linkage: boolean;
  over_budget_requires_note: boolean;
  duplicate_detection_enabled: boolean;
  duplicate_detection_sensitivity: DuplicateSensitivity;
  auto_route_high_confidence: boolean;
  auto_route_confidence_threshold: number;
  require_lien_release_for_draw: boolean;
  co_approval_required: boolean;
  payment_auto_scheduling: boolean;
  cover_letter_template: string;
  // Phase 9 — bulk invoice import
  import_max_batch_size: number;
  import_default_pm_id: string;
  import_auto_route_threshold: number;
};

function toFormState(s: WorkflowSettings): FormState {
  return {
    batch_approval_enabled: s.batch_approval_enabled,
    quick_approve_enabled: s.quick_approve_enabled,
    quick_approve_min_confidence: s.quick_approve_min_confidence,
    require_invoice_date: s.require_invoice_date,
    require_budget_allocation: s.require_budget_allocation,
    require_po_linkage: s.require_po_linkage,
    over_budget_requires_note: s.over_budget_requires_note,
    duplicate_detection_enabled: s.duplicate_detection_enabled,
    duplicate_detection_sensitivity: s.duplicate_detection_sensitivity,
    auto_route_high_confidence: s.auto_route_high_confidence,
    auto_route_confidence_threshold: s.auto_route_confidence_threshold,
    require_lien_release_for_draw: s.require_lien_release_for_draw,
    co_approval_required: s.co_approval_required,
    payment_auto_scheduling: s.payment_auto_scheduling,
    cover_letter_template: s.cover_letter_template ?? "",
    import_max_batch_size: s.import_max_batch_size ?? 50,
    import_default_pm_id: s.import_default_pm_id ?? "",
    import_auto_route_threshold: s.import_auto_route_threshold ?? 85,
  };
}

export default function WorkflowSettingsForm({ settings, pms }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(toFormState(settings));
  const [initial, setInitial] = useState<FormState>(toFormState(settings));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  function patch<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/workflow-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? `Save failed (${res.status})`);
      setMessage({ kind: "ok", text: "Saved." });
      toast.success("Workflow settings saved");
      setInitial(form);
      router.refresh();
    } catch (e) {
      const text = e instanceof Error ? e.message : "Save failed";
      setMessage({ kind: "err", text });
      toast.error(text);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6 pb-24">
      <FirstUseTip id="workflow-settings">
        Configure how your team processes invoices, approvals, and draws. These settings apply to everyone in your organization.
      </FirstUseTip>
      <Section
        title="Invoice Approvals"
        subtitle="Control how PMs review, approve, and code invoices."
      >
        <Toggle
          label="Allow batch approval"
          description="Let PMs approve multiple invoices at once from the queue."
          checked={form.batch_approval_enabled}
          onChange={(v) => patch("batch_approval_enabled", v)}
        />
        <Toggle
          label="Allow quick approve"
          description="One-click approve for high-confidence invoices without opening detail."
          checked={form.quick_approve_enabled}
          onChange={(v) => patch("quick_approve_enabled", v)}
        />
        {form.quick_approve_enabled && (
          <SubSetting>
            <DropdownField
              label="Minimum AI confidence for quick approve"
              value={String(form.quick_approve_min_confidence)}
              onChange={(v) =>
                patch("quick_approve_min_confidence", Number(v))
              }
              options={[
                { value: "90", label: "90%" },
                { value: "95", label: "95%" },
                { value: "99", label: "99%" },
              ]}
            />
          </SubSetting>
        )}
        <Toggle
          label="Require invoice date before approval"
          description="Block approval if no invoice date is entered."
          checked={form.require_invoice_date}
          onChange={(v) => patch("require_invoice_date", v)}
        />
        <Toggle
          label="Require budget line allocation"
          description="PMs must code every invoice to a budget line before approving."
          checked={form.require_budget_allocation}
          onChange={(v) => patch("require_budget_allocation", v)}
        />
        <Toggle
          label="Require PO linkage"
          description="Every invoice must reference a purchase order before approval."
          checked={form.require_po_linkage}
          onChange={(v) => patch("require_po_linkage", v)}
        />
        <Toggle
          label="Over-budget approval requires note"
          description="PM must enter a reason when approving an over-budget invoice."
          checked={form.over_budget_requires_note}
          onChange={(v) => patch("over_budget_requires_note", v)}
        />
      </Section>

      <Section
        title="Duplicate Detection"
        subtitle="Catch invoices that may already be in the system before they're paid twice."
      >
        <Toggle
          label="Duplicate detection"
          description="Flag invoices that may be duplicates of existing records."
          checked={form.duplicate_detection_enabled}
          onChange={(v) => patch("duplicate_detection_enabled", v)}
        />
        {form.duplicate_detection_enabled && (
          <SubSetting>
            <DropdownField
              label="Sensitivity"
              value={form.duplicate_detection_sensitivity}
              onChange={(v) =>
                patch(
                  "duplicate_detection_sensitivity",
                  v as DuplicateSensitivity
                )
              }
              options={[
                {
                  value: "strict",
                  label: "Strict — amount ±2%, date ±14 days",
                },
                {
                  value: "moderate",
                  label: "Moderate — amount ±5%, date ±30 days",
                },
                {
                  value: "loose",
                  label: "Loose — amount ±10%, date ±60 days",
                },
              ]}
              help="Same invoice number is always flagged regardless of sensitivity."
            />
          </SubSetting>
        )}
      </Section>

      <Section
        title="AI Routing"
        subtitle="Decide when to trust AI parsing and skip accounting intake."
      >
        <Toggle
          label="Auto-route high-confidence invoices"
          description="Skip accounting intake and send directly to PM when AI confidence is high."
          checked={form.auto_route_high_confidence}
          onChange={(v) => patch("auto_route_high_confidence", v)}
        />
        {form.auto_route_high_confidence && (
          <SubSetting>
            <DropdownField
              label="Minimum confidence for auto-route"
              value={String(form.auto_route_confidence_threshold)}
              onChange={(v) =>
                patch("auto_route_confidence_threshold", Number(v))
              }
              options={[
                { value: "80", label: "80%" },
                { value: "85", label: "85%" },
                { value: "90", label: "90%" },
                { value: "95", label: "95%" },
              ]}
            />
          </SubSetting>
        )}
      </Section>

      <Section
        title="Draw & Payment"
        subtitle="Policies for draw submissions, change orders, and check scheduling."
      >
        <Toggle
          label="Require lien releases before draw approval"
          description="Cannot approve a draw until all vendor lien releases are received."
          checked={form.require_lien_release_for_draw}
          onChange={(v) => patch("require_lien_release_for_draw", v)}
        />
        <Toggle
          label="Require CO approval"
          description="Change orders must be approved by owner/admin before taking effect."
          checked={form.co_approval_required}
          onChange={(v) => patch("co_approval_required", v)}
        />
        <Toggle
          label="Auto-schedule payments"
          description="Automatically calculate payment dates based on your payment schedule when invoices are approved."
          checked={form.payment_auto_scheduling}
          onChange={(v) => patch("payment_auto_scheduling", v)}
        />
        <div className="py-3">
          <p className="text-sm text-slate-tile font-medium">Draw cover letter template</p>
          <p className="text-xs text-[rgba(59,88,100,0.55)] mt-0.5 mb-2">
            Used as the body of the auto-generated cover letter. Leave blank to use the built-in
            default. Placeholders: <code className="text-stone-blue">{"{{job_name}}"}</code>,{" "}
            <code className="text-stone-blue">{"{{job_address}}"}</code>,{" "}
            <code className="text-stone-blue">{"{{owner_name}}"}</code>,{" "}
            <code className="text-stone-blue">{"{{draw_number}}"}</code>,{" "}
            <code className="text-stone-blue">{"{{period_start}}"}</code>,{" "}
            <code className="text-stone-blue">{"{{period_end}}"}</code>,{" "}
            <code className="text-stone-blue">{"{{current_payment_due}}"}</code>,{" "}
            <code className="text-stone-blue">{"{{contract_sum_to_date}}"}</code>,{" "}
            <code className="text-stone-blue">{"{{total_completed}}"}</code>,{" "}
            <code className="text-stone-blue">{"{{percent_complete}}"}</code>,{" "}
            <code className="text-stone-blue">{"{{retainage}}"}</code>.
          </p>
          <textarea
            value={form.cover_letter_template}
            onChange={(e) => patch("cover_letter_template", e.target.value)}
            rows={10}
            placeholder="Leave blank to use the built-in default template."
            className="w-full px-3 py-2 bg-[rgba(91,134,153,0.06)] border border-[rgba(59,88,100,0.15)] text-sm text-slate-tile font-mono focus:border-stone-blue focus:outline-none"
          />
        </div>
      </Section>

      <Section
        title="Bulk Import"
        subtitle="Controls the drag-drop bulk invoice importer at /invoices/import."
      >
        <div className="py-3 space-y-4">
          <label className="block">
            <span className="block text-[11px] tracking-[0.08em] uppercase text-[rgba(59,88,100,0.55)] mb-1">
              Max batch size
            </span>
            <input
              type="number"
              min={1}
              max={200}
              value={form.import_max_batch_size}
              onChange={(e) => patch("import_max_batch_size", Math.max(1, Math.min(200, Number(e.target.value) || 50)))}
              className="w-32 px-3 py-2 border border-[rgba(59,88,100,0.15)] bg-white text-sm"
            />
            <p className="text-xs text-[rgba(59,88,100,0.55)] mt-1">
              Largest number of files a single upload can contain (1–200). Default 50.
            </p>
          </label>

          <label className="block">
            <span className="block text-[11px] tracking-[0.08em] uppercase text-[rgba(59,88,100,0.55)] mb-1">
              Default PM for unmatched jobs
            </span>
            <select
              value={form.import_default_pm_id}
              onChange={(e) => patch("import_default_pm_id", e.target.value)}
              className="w-full max-w-sm px-3 py-2 border border-[rgba(59,88,100,0.15)] bg-white text-sm"
            >
              <option value="">— None (leave unassigned) —</option>
              {pms.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-xs text-[rgba(59,88,100,0.55)] mt-1">
              When bulk import can&apos;t match an invoice to a job, assign this PM so they can review. Nullable — leave blank to require explicit assignment.
            </p>
          </label>

          <label className="block">
            <span className="block text-[11px] tracking-[0.08em] uppercase text-[rgba(59,88,100,0.55)] mb-1">
              Auto-route confidence threshold (%)
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={form.import_auto_route_threshold}
              onChange={(e) => patch("import_auto_route_threshold", Math.max(0, Math.min(100, Number(e.target.value) || 85)))}
              className="w-32 px-3 py-2 border border-[rgba(59,88,100,0.15)] bg-white text-sm"
            />
            <p className="text-xs text-[rgba(59,88,100,0.55)] mt-1">
              Confidence above this routes to <strong>PM Review</strong>; below routes to <strong>Accounting QA</strong>. <strong>Never auto-approves</strong> — every invoice is reviewed by a human before it enters a draw.
            </p>
          </label>
        </div>
      </Section>

      <div
        className={`sticky bottom-0 -mx-4 px-4 md:-mx-6 md:px-6 py-4 bg-white-sand/95 backdrop-blur border-t border-[rgba(59,88,100,0.15)] flex items-center gap-3 transition-opacity ${
          dirty || message ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !dirty}
          className="px-4 py-2 bg-[var(--org-primary)] text-white text-sm font-medium disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {dirty && !saving && (
          <button
            type="button"
            onClick={() => setForm(initial)}
            className="px-3 py-2 text-sm text-[rgba(59,88,100,0.55)] hover:text-slate-tile"
          >
            Discard
          </button>
        )}
        {message && (
          <span
            className={`text-xs tracking-[0.04em] ${
              message.kind === "ok" ? "text-nw-success" : "text-nw-danger"
            }`}
          >
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-[rgba(59,88,100,0.15)] bg-white p-6">
      <header className="mb-4">
        <h2 className="section-label">{title}</h2>
        {subtitle && (
          <p className="text-xs text-[rgba(59,88,100,0.55)] mt-1">{subtitle}</p>
        )}
      </header>
      <div className="divide-y divide-brand-border/60">{children}</div>
    </section>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="w-full flex items-start justify-between gap-4 py-4 sm:py-3 first:pt-0 last:pb-0 text-left"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-slate-tile font-medium">{label}</span>
        <span className="block text-xs text-[rgba(59,88,100,0.55)] mt-0.5 leading-relaxed">
          {description}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors border mt-0.5 ${
          checked
            ? "bg-[var(--org-primary)] border-[var(--org-primary)]"
            : "bg-brand-border/40 border-[rgba(59,88,100,0.15)]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}

function SubSetting({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-3 pl-4 border-l-2 border-[var(--org-primary)]/30 ml-1">
      {children}
    </div>
  );
}

function DropdownField({
  label,
  value,
  onChange,
  options,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  help?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[0.08em] uppercase text-[rgba(59,88,100,0.55)] mb-1">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-[rgba(59,88,100,0.15)] bg-white text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {help && <p className="text-xs text-[rgba(59,88,100,0.55)] mt-1">{help}</p>}
    </label>
  );
}
