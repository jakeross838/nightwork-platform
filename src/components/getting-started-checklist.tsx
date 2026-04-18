"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Checks = {
  companySetUp: boolean;
  costCodesLoaded: boolean;
  teamInvited: boolean;
  firstJobCreated: boolean;
  firstInvoiceUploaded: boolean;
  firstDrawGenerated: boolean;
};

const DISMISS_KEY = "nightwork:getting-started-dismissed";

export default function GettingStartedChecklist() {
  const router = useRouter();
  const [checks, setChecks] = useState<Checks | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [loadingSample, setLoadingSample] = useState(false);
  const [sampleLoaded, setSampleLoaded] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(DISMISS_KEY) : null;
    setDismissed(stored === "1");

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (!membership) return;
      const orgId = membership.org_id as string;

      const [
        { data: org },
        { count: codeCount },
        { count: memberCount },
        { count: jobCount },
        { count: invoiceCount },
        { count: drawCount },
      ] = await Promise.all([
        supabase
          .from("organizations")
          .select("company_address, company_city")
          .eq("id", orgId)
          .maybeSingle(),
        supabase
          .from("cost_codes")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .is("deleted_at", null),
        supabase
          .from("org_members")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId),
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .is("deleted_at", null),
        supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .is("deleted_at", null),
        supabase
          .from("draws")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .is("deleted_at", null),
      ]);

      setChecks({
        companySetUp: !!(org?.company_address && org.company_city),
        costCodesLoaded: (codeCount ?? 0) > 0,
        teamInvited: (memberCount ?? 0) > 1,
        firstJobCreated: (jobCount ?? 0) > 0,
        firstInvoiceUploaded: (invoiceCount ?? 0) > 0,
        firstDrawGenerated: (drawCount ?? 0) > 0,
      });
    })();
  }, []);

  if (!checks || dismissed) return null;

  const done = Object.values(checks).filter(Boolean).length;
  const total = 6;
  if (done === total) return null;

  const items: Array<{ label: string; href: string; done: boolean }> = [
    { label: "Company set up", href: "/settings/company", done: checks.companySetUp },
    { label: "Cost codes loaded", href: "/settings/cost-codes", done: checks.costCodesLoaded },
    { label: "Team invited", href: "/settings/team", done: checks.teamInvited },
    { label: "First job created", href: "/jobs/new", done: checks.firstJobCreated },
    { label: "First invoice uploaded", href: "/invoices?action=upload", done: checks.firstInvoiceUploaded },
    { label: "First draw generated", href: "/draws", done: checks.firstDrawGenerated },
  ];

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function loadSampleData() {
    setLoadingSample(true);
    setSampleError(null);
    try {
      const res = await fetch("/api/sample-data", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSampleLoaded(true);
      router.refresh();
    } catch (err) {
      setSampleError(err instanceof Error ? err.message : "Failed to load sample data");
    } finally {
      setLoadingSample(false);
    }
  }

  return (
    <aside className="w-full max-w-[420px] mx-auto mt-8 mb-0 text-left border border-[rgba(59,88,100,0.15)] bg-white p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] tracking-[0.12em] uppercase text-[rgba(59,88,100,0.55)]">Getting Started</p>
          <h2 className="font-display text-lg text-slate-tile mt-0.5">
            {done} of {total} complete
          </h2>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-[rgba(59,88,100,0.55)] hover:text-slate-tile"
          title="Hide checklist"
        >
          Hide
        </button>
      </div>
      <div className="h-1 w-full bg-[rgba(91,134,153,0.06)] mb-4">
        <div
          className="h-full bg-slate-deep transition-all"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>
      {done === 0 && !sampleLoaded && (
        <div className="mb-4 pb-4 border-b border-[rgba(59,88,100,0.15)]">
          <p className="text-xs text-[rgba(59,88,100,0.70)] mb-2">
            Want to see how it works? Load a demo project with realistic data.
          </p>
          <button
            type="button"
            onClick={loadSampleData}
            disabled={loadingSample}
            className="px-4 py-2 bg-slate-deep hover:bg-slate-deeper text-white text-xs tracking-[0.06em] uppercase disabled:opacity-50 transition-colors"
          >
            {loadingSample ? "Loading…" : "Load Sample Project"}
          </button>
          {sampleError && (
            <p className="mt-2 text-xs text-nw-danger">{sampleError}</p>
          )}
        </div>
      )}
      {sampleLoaded && (
        <div className="mb-4 pb-4 border-b border-[rgba(59,88,100,0.15)]">
          <p className="text-xs text-nw-success">
            Sample project loaded! Refresh the page to see it in your dashboard.
          </p>
        </div>
      )}
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.label}>
            <Link
              href={it.href}
              className={`flex items-center gap-3 px-2 py-1.5 text-sm hover:bg-[rgba(91,134,153,0.06)] ${
                it.done ? "text-[rgba(59,88,100,0.55)] line-through" : "text-slate-tile"
              }`}
            >
              <span
                className={`w-4 h-4 flex items-center justify-center text-[10px] border ${
                  it.done ? "bg-slate-deep border-stone-blue text-white" : "border-[rgba(59,88,100,0.15)]"
                }`}
              >
                {it.done ? "✓" : ""}
              </span>
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
