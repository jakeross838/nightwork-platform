"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

interface PmUser {
  id: string;
  full_name: string;
}

export default function NewJobPage() {
  const router = useRouter();
  const [pms, setPms] = useState<PmUser[]>([]);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [contractType, setContractType] = useState<"cost_plus" | "fixed">("cost_plus");
  const [originalContract, setOriginalContract] = useState("");
  const [depositPct, setDepositPct] = useState("10");
  const [gcFeePct, setGcFeePct] = useState("20");
  const [pmId, setPmId] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [status, setStatus] = useState<"active" | "complete" | "warranty" | "cancelled">("active");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?redirect=/jobs/new");
        return;
      }
      const { data: membership } = await supabase
        .from("org_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (!membership || !["admin", "owner"].includes(membership.role)) {
        setAuthorized(false);
        return;
      }
      setAuthorized(true);

      // Load PMs (and admins — both can manage jobs)
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name")
        .in("role", ["pm", "admin"])
        .is("deleted_at", null)
        .order("full_name");
      if (users) setPms(users as PmUser[]);
    }
    load();
  }, [router]);

  if (authorized === false) {
    return (
      <main className="max-w-[1600px] mx-auto px-6 py-16 text-center">
        <h2 className="font-display text-2xl text-slate-tile">Access denied</h2>
        <p className="mt-2 text-sm text-tertiary">
          Jobs management is restricted to administrators.
        </p>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Job name is required");
      return;
    }

    const amountDollars = parseFloat(originalContract || "0");
    if (isNaN(amountDollars) || amountDollars < 0) {
      setError("Original contract amount must be a valid number");
      return;
    }

    const depositNum = parseFloat(depositPct) / 100;
    const gcNum = parseFloat(gcFeePct) / 100;

    setSaving(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: address || null,
          client_name: clientName || null,
          client_email: clientEmail || null,
          client_phone: clientPhone || null,
          contract_type: contractType,
          original_contract_amount: Math.round(amountDollars * 100), // cents
          deposit_percentage: isNaN(depositNum) ? 0.1 : depositNum,
          gc_fee_percentage: isNaN(gcNum) ? 0.2 : gcNum,
          pm_id: pmId || null,
          contract_date: contractDate || null,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      router.push(`/jobs/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
      setSaving(false);
    }
  }

  return (
    <>
      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl text-slate-tile">New Job</h2>
            <p className="text-sm text-tertiary mt-1">Create a new construction project</p>
          </div>
          <Link href="/jobs" className="text-sm text-tertiary hover:text-slate-tile underline-offset-4 hover:underline">
            Cancel
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-border-def p-6">
          <Section title="Project">
            <Field label="Name *">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input"
                placeholder="e.g. Smith Residence"
              />
            </Field>
            <Field label="Address">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input"
                placeholder="123 Gulf Dr, Anna Maria, FL"
              />
            </Field>
            <Field label="Contract Type">
              <select
                value={contractType}
                onChange={(e) => setContractType(e.target.value as "cost_plus" | "fixed")}
                className="input"
              >
                <option value="cost_plus">Cost Plus (Open Book)</option>
                <option value="fixed">Fixed Price</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="input"
              >
                <option value="active">Active</option>
                <option value="complete">Complete</option>
                <option value="warranty">Warranty</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
          </Section>

          <Section title="Client">
            <Field label="Client Name">
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Client Email">
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Client Phone">
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="input"
              />
            </Field>
          </Section>

          <Section title="Contract">
            <Field label="Original Contract Amount (USD)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={originalContract}
                onChange={(e) => setOriginalContract(e.target.value)}
                className="input"
                placeholder="0.00"
              />
            </Field>
            <Field label="Contract Date">
              <input
                type="date"
                value={contractDate}
                onChange={(e) => setContractDate(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Deposit %">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={depositPct}
                onChange={(e) => setDepositPct(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="GC Fee %">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={gcFeePct}
                onChange={(e) => setGcFeePct(e.target.value)}
                className="input"
              />
            </Field>
          </Section>

          <Section title="Project Manager">
            <Field label="Assigned PM" full>
              <select
                value={pmId}
                onChange={(e) => setPmId(e.target.value)}
                className="input"
              >
                <option value="">— Unassigned —</option>
                {pms.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </Field>
          </Section>

          {error && (
            <div className="border border-nw-danger/40 bg-nw-danger/5 px-4 py-3 text-sm text-nw-danger">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border-def">
            <Link
              href="/jobs"
              className="px-4 py-2 text-sm text-tertiary hover:text-slate-tile transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-slate-deep hover:bg-slate-deeper disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {saving ? "Creating…" : "Create Job"}
            </button>
          </div>
        </form>
      </main>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: var(--bg-subtle, #F5F5F5);
          border: 1px solid var(--border-default, #E8E8E8);
          color: var(--text-primary);
          font-size: 14px;
        }
        .input:focus {
          outline: none;
          border-color: var(--org-primary);
        }
      `}</style>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-medium text-tertiary uppercase tracking-wider mb-3 pb-2 border-b border-border-def">
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-[11px] font-medium text-tertiary uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}
