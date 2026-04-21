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
    cost_intelligence_settings: {
      auto_commit_enabled: boolean;
      auto_commit_threshold: number;
      verification_required_for_low_confidence: boolean;
    };
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
  const [autoCommitEnabled, setAutoCommitEnabled] = useState(
    org.cost_intelligence_settings.auto_commit_enabled
  );
  const [autoCommitThreshold, setAutoCommitThreshold] = useState(
    Math.round(org.cost_intelligence_settings.auto_commit_threshold * 100)
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
          cost_intelligence_settings: {
            auto_commit_enabled: autoCommitEnabled,
            auto_commit_threshold: Math.max(0.5, Math.min(1, autoCommitThreshold / 100)),
            verification_required_for_low_confidence:
              org.cost_intelligence_settings.verification_required_for_low_confidence,
          },
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
          <span className="block text-[10px] uppercase mb-1 nw-eyebrow">
            Schedule Type
          </span>
          <select
            value={scheduleType}
            onChange={(e) => setScheduleType(e.target.value as PaymentScheduleType)}
            className="w-full px-3 py-2 border nw-field text-sm"
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

      <Section title="Cost Intelligence">
        <p className="text-[12px] text-[color:var(--text-secondary)] leading-relaxed">
          When enabled, AI extractions with confidence above the threshold are
          automatically committed to the cost intelligence database without
          requiring per-line verification. Default is OFF — every extraction
          waits for human verification.
        </p>

        <label className="flex items-center gap-3 mt-2">
          <input
            type="checkbox"
            checked={autoCommitEnabled}
            onChange={(e) => setAutoCommitEnabled(e.target.checked)}
            className="h-[16px] w-[16px]"
          />
          <span className="text-[13px] text-[color:var(--text-primary)]">
            Enable auto-commit for high-confidence extractions
          </span>
        </label>

        <div className={autoCommitEnabled ? "opacity-100" : "opacity-50 pointer-events-none"}>
          <label className="block mt-3">
            <span className="block text-[10px] uppercase mb-1 nw-eyebrow">
              Auto-commit threshold ({autoCommitThreshold}%)
            </span>
            <input
              type="range"
              min={80}
              max={99}
              step={1}
              value={autoCommitThreshold}
              onChange={(e) => setAutoCommitThreshold(Number(e.target.value))}
              className="w-full"
            />
            <div
              className="mt-1 flex justify-between text-[10px] uppercase"
              style={{ fontFamily: "var(--font-jetbrains-mono)", letterSpacing: "0.14em", color: "var(--text-tertiary)" }}
            >
              <span>80%</span>
              <span>99%</span>
            </div>
          </label>
          <p className="text-[11px] text-[color:var(--text-secondary)] mt-2">
            ⚠ Auto-commit accelerates data flow but reduces human verification.
            Recommended only for established vendor relationships where AI
            accuracy has been validated.
          </p>
        </div>
      </Section>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="h-[36px] px-4 text-[11px] uppercase disabled:opacity-60 nw-primary-btn"
        >
          {saving ? "Saving" : "Save changes"}
        </button>
        {message && (
          <span
            className="text-xs"
            style={{
              color: message.kind === "ok" ? "var(--nw-success)" : "var(--nw-danger)",
            }}
          >
            {message.text}
          </span>
        )}
      </div>
      <style jsx>{`
        :global(.nw-eyebrow) {
          font-family: var(--font-jetbrains-mono);
          letter-spacing: 0.14em;
          color: var(--text-tertiary);
        }
        :global(.nw-field) {
          background: var(--bg-subtle);
          border-color: var(--border-default);
          color: var(--text-primary);
        }
        :global(input.nw-field:focus), :global(select.nw-field:focus) {
          outline: none;
          border-color: var(--nw-stone-blue);
        }
        :global(.nw-primary-btn) {
          font-family: var(--font-jetbrains-mono);
          letter-spacing: 0.12em;
          font-weight: 500;
          background: var(--nw-stone-blue);
          color: var(--nw-white-sand);
          border: 1px solid var(--nw-stone-blue);
        }
        :global(.nw-primary-btn:hover:not(:disabled)) {
          background: var(--nw-gulf-blue);
          border-color: var(--nw-gulf-blue);
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="border p-5"
      style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}
    >
      <h2
        className="m-0 mb-3 text-[10px] uppercase"
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          letterSpacing: "0.14em",
          color: "var(--text-tertiary)",
        }}
      >
        {title}
      </h2>
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
      <span className="block text-[10px] uppercase mb-1 nw-eyebrow">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full px-3 py-2 border nw-field text-sm"
        />
        <span className="text-[color:var(--text-secondary)] text-sm">%</span>
      </div>
      {help && <p className="text-xs text-[color:var(--text-secondary)] mt-1">{help}</p>}
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
      <span className="block text-[10px] uppercase mb-1 nw-eyebrow">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 border nw-field text-sm"
      />
      {help && <p className="text-xs text-[color:var(--text-secondary)] mt-1">{help}</p>}
    </label>
  );
}
