"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PaymentScheduleType = "5_20" | "15_30" | "monthly" | "custom";

type Props = {
  org: {
    default_gc_fee_percentage: number;
    default_deposit_percentage: number;
    payment_schedule_type: PaymentScheduleType;
    payment_schedule_config: Record<string, unknown>;
  };
};

const SCHEDULE_LABELS: Record<PaymentScheduleType, string> = {
  "5_20": "Received by 5th → pay 15th; by 20th → pay 30th",
  "15_30": "Pay twice monthly on 15th and 30th",
  monthly: "Pay once monthly on the 30th",
  custom: "Custom schedule",
};

export default function FinancialSettingsForm({ org }: Props) {
  const router = useRouter();
  const [gcFee, setGcFee] = useState(org.default_gc_fee_percentage * 100);
  const [deposit, setDeposit] = useState(org.default_deposit_percentage * 100);
  const [scheduleType, setScheduleType] = useState<PaymentScheduleType>(org.payment_schedule_type);
  const [customCutoff, setCustomCutoff] = useState<number>(
    (org.payment_schedule_config?.cutoff_day as number) ?? 15
  );
  const [customPayDay, setCustomPayDay] = useState<number>(
    (org.payment_schedule_config?.pay_day as number) ?? 30
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onSave() {
    setSaving(true);
    setMessage(null);
    try {
      const config =
        scheduleType === "custom"
          ? { cutoff_day: customCutoff, pay_day: customPayDay }
          : {};
      const res = await fetch("/api/organizations/current", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          default_gc_fee_percentage: Number((gcFee / 100).toFixed(4)),
          default_deposit_percentage: Number((deposit / 100).toFixed(4)),
          payment_schedule_type: scheduleType,
          payment_schedule_config: config,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Save failed (${res.status})`);
      }
      setMessage({ kind: "ok", text: "Saved." });
      router.refresh();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Section title="Default Percentages">
        <div className="grid grid-cols-2 gap-4">
          <PctField
            label="Default GC Fee"
            value={gcFee}
            onChange={setGcFee}
            help="Applied to new jobs and change orders by default."
          />
          <PctField
            label="Default Deposit"
            value={deposit}
            onChange={setDeposit}
            help="Client-paid deposit as a share of contract sum."
          />
        </div>
      </Section>

      <Section title="Payment Schedule">
        <label className="block">
          <span className="block text-[11px] tracking-[0.08em] uppercase text-cream-dim mb-1">
            Schedule Type
          </span>
          <select
            value={scheduleType}
            onChange={(e) => setScheduleType(e.target.value as PaymentScheduleType)}
            className="w-full px-3 py-2 border border-brand-border bg-white text-sm"
          >
            {Object.entries(SCHEDULE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>

        {scheduleType === "custom" && (
          <div className="grid grid-cols-2 gap-4 mt-3">
            <IntField
              label="Cutoff Day"
              value={customCutoff}
              onChange={setCustomCutoff}
              min={1}
              max={28}
              help="Invoices received on or before this day pay out first."
            />
            <IntField
              label="Pay Day"
              value={customPayDay}
              onChange={setCustomPayDay}
              min={1}
              max={31}
              help="Day of month checks are cut."
            />
          </div>
        )}
      </Section>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-[var(--org-primary)] text-white text-sm font-medium disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {message && (
          <span
            className={`text-xs tracking-[0.04em] ${
              message.kind === "ok" ? "text-status-success" : "text-status-danger"
            }`}
          >
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-brand-border bg-white p-5">
      <h2 className="section-label">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function PctField({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  help?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[0.08em] uppercase text-cream-dim mb-1">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full px-3 py-2 border border-brand-border bg-white text-sm"
        />
        <span className="text-cream-dim text-sm">%</span>
      </div>
      {help && <p className="text-xs text-cream-dim mt-1">{help}</p>}
    </label>
  );
}

function IntField({
  label,
  value,
  onChange,
  min,
  max,
  help,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  help?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[0.08em] uppercase text-cream-dim mb-1">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 border border-brand-border bg-white text-sm"
      />
      {help && <p className="text-xs text-cream-dim mt-1">{help}</p>}
    </label>
  );
}
