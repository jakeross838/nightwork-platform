"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { PUBLIC_APP_NAME } from "@/lib/org/public";

type Initial = {
  name: string;
  company_address: string | null;
  company_city: string | null;
  company_state: string | null;
  company_zip: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_website: string | null;
  logo_url: string | null;
  builder_type: string | null;
  default_gc_fee_percentage: number;
  default_deposit_percentage: number;
  payment_schedule_type: "5_20" | "15_30" | "monthly" | "custom";
};

const BUILDER_TYPES = [
  { value: "custom_home", label: "Custom Home", gcSuggestion: 20 },
  { value: "remodel", label: "Remodel", gcSuggestion: 15 },
  { value: "commercial", label: "Commercial", gcSuggestion: 12 },
  { value: "multi_family", label: "Multi-Family", gcSuggestion: 10 },
  { value: "other", label: "Other", gcSuggestion: 15 },
];

const PAYMENT_OPTIONS: Array<{
  value: Initial["payment_schedule_type"];
  title: string;
  detail: string;
}> = [
  { value: "5_20", title: "5th / 20th cutoff", detail: "Received by 5th → pay 15th; by 20th → pay 30th." },
  { value: "15_30", title: "15th / 30th", detail: "Twice monthly on the 15th and 30th." },
  { value: "monthly", title: "Monthly", detail: "Pay once a month on the 30th." },
  { value: "custom", title: "Custom", detail: "Configure later in Settings → Financial." },
];

type InviteRow = { email: string; role: "admin" | "pm" | "accounting" };

export default function OnboardWizard({
  userFullName,
  initial,
}: {
  userFullName: string;
  initial: Initial;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  // Step 1
  const [company, setCompany] = useState<Initial>(initial);

  // Step 2
  const [gcFee, setGcFee] = useState(Math.round(initial.default_gc_fee_percentage * 100));
  const [deposit, setDeposit] = useState(Math.round(initial.default_deposit_percentage * 100));
  const [payment, setPayment] = useState<Initial["payment_schedule_type"]>(initial.payment_schedule_type);

  // Step 3
  const [codeChoice, setCodeChoice] = useState<"template" | "csv" | "blank" | null>(null);
  const [codePreviewCount, setCodePreviewCount] = useState<number | null>(null);

  // Step 4
  const [invites, setInvites] = useState<InviteRow[]>([{ email: "", role: "pm" }]);

  // Step 5
  const [job, setJob] = useState({ name: "", address: "", client_name: "", contract_amount: "" });

  async function saveCompany() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/organizations/current", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: company.name,
          company_address: company.company_address,
          company_city: company.company_city,
          company_state: company.company_state,
          company_zip: company.company_zip,
          company_phone: company.company_phone,
          company_email: company.company_email,
          company_website: company.company_website,
          builder_type: company.builder_type,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setStep(2);
      autoSuggestGc();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function autoSuggestGc() {
    const match = BUILDER_TYPES.find((b) => b.value === company.builder_type);
    if (match) setGcFee(match.gcSuggestion);
  }

  async function onLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/organizations/logo", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
      const { logo_url } = await res.json();
      setCompany((c) => ({ ...c, logo_url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (logoRef.current) logoRef.current.value = "";
    }
  }

  async function saveFinancial() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/organizations/current", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          default_gc_fee_percentage: Number((gcFee / 100).toFixed(4)),
          default_deposit_percentage: Number((deposit / 100).toFixed(4)),
          payment_schedule_type: payment,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadTemplate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cost-codes/template", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Template load failed");
      const body = await res.json();
      setCodePreviewCount(body.imported);
      setCodeChoice("template");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Template load failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendInvites(): Promise<void> {
    const pending = invites.filter((i) => i.email.trim());
    for (const inv of pending) {
      try {
        await fetch("/api/organizations/members/invite", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: inv.email.trim().toLowerCase(), role: inv.role }),
        });
      } catch {
        /* skip on error; team can be invited later from Settings */
      }
    }
  }

  async function createFirstJob(): Promise<void> {
    if (!job.name.trim()) return;
    const amountCents = Math.round(parseFloat(job.contract_amount || "0") * 100);
    await fetch("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: job.name.trim(),
        address: job.address || null,
        client_name: job.client_name || null,
        original_contract_amount: amountCents,
        contract_type: "cost_plus",
      }),
    });
  }

  async function finish(createJob: boolean) {
    setBusy(true);
    setError(null);
    try {
      await sendInvites();
      if (createJob) await createFirstJob();
      const res = await fetch("/api/onboarding/complete", { method: "POST" });
      if (!res.ok) throw new Error("Could not mark onboarding complete");
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish onboarding");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-white-sand">
      <header className="border-b border-border-def bg-white">
        <div className="max-w-[900px] mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-display text-lg tracking-[0.12em] uppercase text-slate-tile">
            {PUBLIC_APP_NAME}
          </span>
          <span className="text-xs text-tertiary">Welcome{userFullName ? `, ${userFullName.split(" ")[0]}` : ""}</span>
        </div>
      </header>

      <main className="max-w-[900px] mx-auto px-6 py-10">
        <StepRail step={step} />

        {error && (
          <p className="mb-4 px-3 py-2 text-sm text-nw-danger border border-nw-danger/40 bg-nw-danger/5">
            {error}
          </p>
        )}

        {step === 1 && (
          <Panel title="Company Info" subtitle="Tell us about your business. This powers your nav, invoice headers, and G702 exports.">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Company Name" value={company.name} onChange={(v) => setCompany({ ...company, name: v })} />
              <label className="block">
                <span className="block text-[11px] tracking-[0.08em] uppercase text-tertiary mb-1">
                  Builder Type
                </span>
                <select
                  value={company.builder_type ?? ""}
                  onChange={(e) => setCompany({ ...company, builder_type: e.target.value || null })}
                  className="w-full px-3 py-2.5 border border-border-def bg-white text-sm"
                >
                  <option value="">Select…</option>
                  {BUILDER_TYPES.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <Field label="Address" value={company.company_address ?? ""} onChange={(v) => setCompany({ ...company, company_address: v })} />
            <div className="grid grid-cols-3 gap-3">
              <Field label="City" value={company.company_city ?? ""} onChange={(v) => setCompany({ ...company, company_city: v })} />
              <Field label="State" value={company.company_state ?? ""} onChange={(v) => setCompany({ ...company, company_state: v })} />
              <Field label="ZIP" value={company.company_zip ?? ""} onChange={(v) => setCompany({ ...company, company_zip: v })} />
            </div>
            <Field label="Phone" value={company.company_phone ?? ""} onChange={(v) => setCompany({ ...company, company_phone: v })} />
            <Field label="Email" type="email" value={company.company_email ?? ""} onChange={(v) => setCompany({ ...company, company_email: v })} />
            <Field label="Website" value={company.company_website ?? ""} onChange={(v) => setCompany({ ...company, company_website: v })} placeholder="https://example.com" />

            <div>
              <span className="block text-[11px] tracking-[0.08em] uppercase text-tertiary mb-1">Logo (optional)</span>
              <div className="flex items-center gap-4">
                <div className="h-14 w-36 flex items-center justify-center border border-border-def bg-[var(--org-primary)]">
                  {company.logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={company.logo_url} alt="Logo" className="max-h-10 max-w-[130px] object-contain" />
                  ) : (
                    <span className="text-white text-[10px] uppercase tracking-[0.08em]">No logo</span>
                  )}
                </div>
                <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onLogoSelect} className="text-sm" />
              </div>
            </div>

            <NavFooter>
              <button
                type="button"
                onClick={saveCompany}
                disabled={busy || !company.name.trim()}
                className="px-5 py-2.5 bg-slate-deep text-white text-[13px] tracking-[0.08em] uppercase disabled:opacity-60"
              >
                {busy ? "Saving…" : "Next — Financial Defaults"}
              </button>
            </NavFooter>
          </Panel>
        )}

        {step === 2 && (
          <Panel title="Financial Defaults" subtitle="These apply to new jobs and can be overridden per project.">
            <div className="grid sm:grid-cols-2 gap-4">
              <PctField label="Default GC Fee" value={gcFee} onChange={setGcFee} help={`Suggested ${suggestedGc(company.builder_type)}% for ${labelFor(company.builder_type)}.`} />
              <PctField label="Default Deposit" value={deposit} onChange={setDeposit} help="Client deposit as share of contract sum." />
            </div>
            <div>
              <span className="block text-[11px] tracking-[0.08em] uppercase text-tertiary mb-2">Payment Schedule</span>
              <div className="grid sm:grid-cols-2 gap-3">
                {PAYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPayment(opt.value)}
                    className={`text-left p-4 border transition-colors ${
                      payment === opt.value
                        ? "border-stone-blue bg-slate-deep-muted"
                        : "border-border-def bg-white hover:bg-bg-sub"
                    }`}
                  >
                    <p className="font-display text-slate-tile">{opt.title}</p>
                    <p className="mt-1 text-xs text-secondary">{opt.detail}</p>
                  </button>
                ))}
              </div>
            </div>
            <NavFooter>
              <BackBtn onClick={() => setStep(1)} />
              <button
                type="button"
                onClick={saveFinancial}
                disabled={busy}
                className="px-5 py-2.5 bg-slate-deep text-white text-[13px] tracking-[0.08em] uppercase disabled:opacity-60"
              >
                {busy ? "Saving…" : "Next — Cost Codes"}
              </button>
            </NavFooter>
          </Panel>
        )}

        {step === 3 && (
          <Panel title="Cost Codes" subtitle="Pick a starting point. You can edit any code from Settings → Cost Codes.">
            <div className="grid md:grid-cols-3 gap-4">
              <ChoiceCard
                selected={codeChoice === "template"}
                title="Standard Residential"
                subtitle="217 codes across 29 categories — covers planning, permits, site, framing, trades, finishes, and landscaping."
                cta={codeChoice === "template" && codePreviewCount !== null ? `Loaded (${codePreviewCount} codes)` : busy ? "Loading…" : "Use Template"}
                onClick={loadTemplate}
              />
              <ChoiceCard
                selected={codeChoice === "csv"}
                title="Import CSV / Excel"
                subtitle="Bring your existing structure. After onboarding, go to Settings → Cost Codes → Import."
                cta="I'll Import"
                onClick={() => setCodeChoice("csv")}
              />
              <ChoiceCard
                selected={codeChoice === "blank"}
                title="Start Blank"
                subtitle="Add codes one at a time as you need them. Best for very small or highly custom operations."
                cta="Skip for Now"
                onClick={() => setCodeChoice("blank")}
              />
            </div>
            <NavFooter>
              <BackBtn onClick={() => setStep(2)} />
              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={codeChoice === null}
                className="px-5 py-2.5 bg-slate-deep text-white text-[13px] tracking-[0.08em] uppercase disabled:opacity-60"
              >
                Next — Invite Team
              </button>
            </NavFooter>
          </Panel>
        )}

        {step === 4 && (
          <Panel title="Invite Your Team" subtitle="You can invite people now or do it later from Settings → Team.">
            <div className="space-y-2">
              {invites.map((inv, i) => (
                <div key={i} className="grid grid-cols-[1fr_180px_auto] gap-2 items-center">
                  <input
                    type="email"
                    value={inv.email}
                    placeholder="teammate@company.com"
                    onChange={(e) => setInvites(invites.map((x, xi) => (xi === i ? { ...x, email: e.target.value } : x)))}
                    className="px-3 py-2 border border-border-def bg-white text-sm"
                  />
                  <select
                    value={inv.role}
                    onChange={(e) => setInvites(invites.map((x, xi) => (xi === i ? { ...x, role: e.target.value as InviteRow["role"] } : x)))}
                    className="px-3 py-2 border border-border-def bg-white text-sm"
                  >
                    <option value="pm">Project Manager</option>
                    <option value="accounting">Accounting</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setInvites(invites.filter((_, xi) => xi !== i))}
                    className="px-2 text-tertiary text-sm hover:text-slate-tile"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setInvites([...invites, { email: "", role: "pm" }])}
                className="text-sm text-stone-blue hover:underline underline-offset-4"
              >
                + Add another
              </button>
            </div>
            <NavFooter>
              <BackBtn onClick={() => setStep(3)} />
              <button
                type="button"
                onClick={() => setStep(5)}
                className="px-5 py-2.5 bg-slate-deep text-white text-[13px] tracking-[0.08em] uppercase"
              >
                Next — First Job
              </button>
            </NavFooter>
          </Panel>
        )}

        {step === 5 && (
          <Panel title="Create Your First Project" subtitle="Optional — you can always create jobs later from the Jobs page.">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Job Name" value={job.name} onChange={(v) => setJob({ ...job, name: v })} placeholder="Smith Residence" />
              <Field label="Client Name" value={job.client_name} onChange={(v) => setJob({ ...job, client_name: v })} />
              <div className="sm:col-span-2">
                <Field label="Address" value={job.address} onChange={(v) => setJob({ ...job, address: v })} />
              </div>
              <CurrencyField
                label="Contract Amount (USD)"
                value={job.contract_amount}
                onChange={(v) => setJob({ ...job, contract_amount: v })}
                placeholder="2,500,000"
              />
            </div>
            <NavFooter>
              <BackBtn onClick={() => setStep(4)} />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => finish(false)}
                  disabled={busy}
                  className="px-5 py-2.5 border border-border-def text-[13px] tracking-[0.08em] uppercase disabled:opacity-60"
                >
                  Skip — I&apos;ll do this later
                </button>
                <button
                  type="button"
                  onClick={() => finish(true)}
                  disabled={busy || !job.name.trim()}
                  className="px-5 py-2.5 bg-slate-deep text-white text-[13px] tracking-[0.08em] uppercase disabled:opacity-60"
                >
                  {busy ? "Finishing…" : "Create Job & Finish"}
                </button>
              </div>
            </NavFooter>
          </Panel>
        )}
      </main>
    </div>
  );
}

function suggestedGc(builderType: string | null): number {
  return BUILDER_TYPES.find((b) => b.value === builderType)?.gcSuggestion ?? 15;
}

function labelFor(builderType: string | null): string {
  return BUILDER_TYPES.find((b) => b.value === builderType)?.label ?? "your builder type";
}

function StepRail({ step }: { step: number }) {
  const steps = ["Company", "Financial", "Cost Codes", "Team", "First Job"];
  return (
    <div className="flex items-center gap-2 mb-8 overflow-x-auto">
      {steps.map((label, i) => {
        const num = i + 1;
        const active = step === num;
        const done = step > num;
        return (
          <div key={label} className="flex items-center gap-2 flex-shrink-0">
            <div
              className={`w-7 h-7 flex items-center justify-center text-[12px] font-medium ${
                done
                  ? "bg-slate-deep text-white"
                  : active
                  ? "border-2 border-stone-blue text-slate-tile"
                  : "border border-border-def text-tertiary"
              }`}
            >
              {done ? "✓" : num}
            </div>
            <span className={`text-sm ${active ? "text-slate-tile font-medium" : "text-tertiary"}`}>{label}</span>
            {i < steps.length - 1 && <span className="w-8 h-px bg-brand-border" />}
          </div>
        );
      })}
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-border-def p-6 md:p-8">
      <h1 className="font-display text-2xl text-slate-tile">{title}</h1>
      <p className="mt-1 text-sm text-secondary">{subtitle}</p>
      <div className="mt-6 space-y-4">{children}</div>
    </section>
  );
}

function NavFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 pt-6 border-t border-border-def flex items-center justify-between gap-3 flex-wrap">{children}</div>;
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2.5 text-[13px] tracking-[0.08em] uppercase text-secondary hover:text-slate-tile"
    >
      ← Back
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[0.08em] uppercase text-tertiary mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-border-def bg-white text-sm"
      />
    </label>
  );
}

function CurrencyField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string; // raw digits, no commas
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  // Store raw digits in state, display with thousands separators.
  const display = value ? Number(value).toLocaleString("en-US") : "";
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[0.08em] uppercase text-tertiary mb-1">{label}</span>
      <div className="flex items-stretch">
        <span className="flex items-center px-3 border border-r-0 border-border-def bg-bg-sub text-tertiary text-sm">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 border border-border-def bg-white text-sm"
        />
      </div>
    </label>
  );
}

function PctField({ label, value, onChange, help }: { label: string; value: number; onChange: (v: number) => void; help: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[0.08em] uppercase text-tertiary mb-1">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
          step="0.1"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full px-3 py-2.5 border border-border-def bg-white text-sm"
        />
        <span className="text-tertiary text-sm">%</span>
      </div>
      <p className="mt-1 text-xs text-tertiary">{help}</p>
    </label>
  );
}

function ChoiceCard({
  title,
  subtitle,
  cta,
  onClick,
  selected,
}: {
  title: string;
  subtitle: string;
  cta: string;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left p-5 border flex flex-col transition-colors ${
        selected
          ? "border-stone-blue bg-slate-deep-muted"
          : "border-border-def bg-white hover:border-stone-blue hover:bg-stone-blue-muted/40"
      }`}
    >
      <h3 className="font-display text-lg text-slate-tile">{title}</h3>
      <p className="mt-2 text-sm text-secondary flex-1">{subtitle}</p>
      <span
        style={{
          color: "#3F5B62",
          fontWeight: 600,
          cursor: "pointer",
          textDecoration: "underline",
          textDecorationThickness: "2px",
          textUnderlineOffset: "3px",
        }}
        className="mt-4 inline-flex items-center gap-1 text-[12px] tracking-[0.08em] uppercase self-start transition-opacity group-hover:opacity-70"
      >
        {selected ? "✓ " : ""}{cta}
      </span>
    </button>
  );
}
