"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/app-shell";
import Breadcrumbs from "@/components/breadcrumbs";
import DrawCompareView from "@/components/draw-compare-view";
import DrawCoverLetterEditor from "@/components/draw-cover-letter-editor";
import DrawLienReleaseUploadList from "@/components/draw-lien-release-upload-list";
import DrawInternalBillings from "@/components/draw-internal-billings";
import DrawChangeOrders from "@/components/draw-change-orders";
import { formatCents, formatDate, formatStatus } from "@/lib/utils/format";
import { toast } from "@/lib/utils/toast";
import NwButton from "@/components/nw/Button";
import NwEyebrow from "@/components/nw/Eyebrow";

interface LienReleaseRow {
  id: string;
  vendor_id: string | null;
  amount: number | null;
  release_type: string;
  status: string;
  through_date: string | null;
  received_at: string | null;
  document_url: string | null;
  notes: string | null;
  vendors: { id: string; name: string } | null;
}

interface DrawData {
  id: string;
  draw_number: number;
  application_number: number | null;
  application_date: string;
  period_start: string;
  period_end: string;
  status: string;
  revision_number: number;
  is_final: boolean;
  parent_draw_id: string | null;
  retainage_percent: number;
  original_contract_sum: number;
  net_change_orders: number;
  contract_sum_to_date: number;
  total_completed_to_date: number;
  retainage_on_completed: number;
  retainage_on_stored: number;
  total_retainage: number;
  total_earned_less_retainage: number;
  less_previous_certificates: number;
  current_payment_due: number;
  balance_to_finish: number;
  deposit_amount: number;
  status_history: Array<Record<string, unknown>>;
  jobs: {
    id: string;
    name: string;
    address: string | null;
    client_name: string | null;
    deposit_percentage: number;
    gc_fee_percentage: number;
    retainage_percent: number;
  } | null;
  line_items: Array<{
    id: string;
    previous_applications: number;
    this_period: number;
    total_to_date: number;
    percent_complete: number;
    balance_to_finish: number;
    retainage: number;
    scheduled_value: number;
    co_adjustment: number;
    is_change_order_line: boolean;
    budget_lines: {
      id: string;
      original_estimate: number;
      revised_estimate: number;
      cost_codes: { code: string; description: string; category: string; sort_order: number };
    };
  }>;
  invoices: Array<{
    id: string;
    vendor_id: string | null;
    vendor_name_raw: string | null;
    invoice_number: string | null;
    total_amount: number;
    cost_code_id: string | null;
    payment_status: string | null;
  }>;
  lien_releases: LienReleaseRow[];
}

export default function DrawDetailPage() {
  const params = useParams();
  const router = useRouter();
  const drawId = params.id as string;
  const [draw, setDraw] = useState<DrawData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"detail" | "compare" | "cover" | "lien-uploads" | "internal-billings" | "change-orders">(
    "detail"
  );

  async function fetchDraw() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/draws/${drawId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Draw failed to load (${res.status})`);
      }
      setDraw(await res.json());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load draw");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDraw();
  }, [drawId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = async (action: string, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    setActing(true);
    setActionError(null);
    const res = await fetch(`/api/draws/${drawId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      await fetchDraw();
      const ACTION_LABEL: Record<string, string> = {
        submit: "Draw submitted",
        approve: "Draw approved",
        lock: "Draw locked",
        mark_paid: "Draw marked paid",
        void: "Draw voided",
      };
      toast.success(ACTION_LABEL[action] ?? "Draw updated");
    } else {
      const data = await res.json().catch(() => ({ error: "Action failed" }));
      setActionError(data.error ?? "Action failed");
      toast.error(data.error ?? "Action failed");
    }
    setActing(false);
  };

  const handleCreateRevision = async () => {
    setActing(true);
    setActionError(null);
    const res = await fetch(`/api/draws/${drawId}/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/draws/${data.id}`);
    } else {
      const data = await res.json().catch(() => ({ error: "Revise failed" }));
      setActionError(data.error ?? "Revise failed");
      setActing(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-teal/30 border-t-teal animate-spin" />
        </div>
      </AppShell>
    );
  }
  if (loadError || !draw) {
    return (
      <AppShell>
        <main className="max-w-[640px] mx-auto px-4 md:px-6 py-16">
          <div
            className="border p-6"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--nw-danger)",
              color: "var(--text-primary)",
            }}
          >
            <NwEyebrow tone="danger" className="mb-2">Couldn&apos;t load</NwEyebrow>
            <p className="text-sm">{loadError ?? "Draw not found"}</p>
            <div className="mt-4 flex gap-2">
              <NwButton variant="secondary" size="sm" onClick={fetchDraw}>Retry</NwButton>
              <NwButton variant="ghost" size="sm" onClick={() => router.push("/draws")}>Back to Draws</NwButton>
            </div>
          </div>
        </main>
      </AppShell>
    );
  }

  const pendingReleaseCount = draw.lien_releases.filter((l) => l.status === "pending").length;
  const totalReleaseCount = draw.lien_releases.length;
  const missingDocCount = draw.lien_releases.filter(
    (l) => (l.status === "pending" || l.status === "received") && !l.document_url
  ).length;

  const g703Rows = draw.line_items
    .map((li) => ({
      code: li.budget_lines.cost_codes.code,
      description: li.budget_lines.cost_codes.description,
      sort_order: li.budget_lines.cost_codes.sort_order,
      original_estimate: li.budget_lines.original_estimate,
      scheduled_value: li.scheduled_value,
      co_adjustment: li.co_adjustment,
      is_change_order_line: li.is_change_order_line,
      previous_applications: li.previous_applications,
      this_period: li.this_period,
      total_to_date: li.total_to_date,
      retainage: li.retainage,
      percent_complete: li.percent_complete,
      balance_to_finish: li.balance_to_finish,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);

  const visibleRows = g703Rows.filter(
    (r) =>
      r.original_estimate > 0 ||
      r.scheduled_value > 0 ||
      r.previous_applications > 0 ||
      r.this_period > 0
  );
  const baseRows = visibleRows.filter((r) => !r.is_change_order_line);
  const coRows = visibleRows.filter((r) => r.is_change_order_line);
  const hasNoBudget = draw.line_items.length === 0;

  const totals = visibleRows.reduce(
    (acc, r) => ({
      original: acc.original + r.original_estimate,
      scheduled: acc.scheduled + r.scheduled_value,
      previous: acc.previous + r.previous_applications,
      thisPeriod: acc.thisPeriod + r.this_period,
      totalToDate: acc.totalToDate + r.total_to_date,
      retainage: acc.retainage + r.retainage,
      balance: acc.balance + r.balance_to_finish,
    }),
    { original: 0, scheduled: 0, previous: 0, thisPeriod: 0, totalToDate: 0, retainage: 0, balance: 0 }
  );

  // G703 grand-total retainage should equal G702 line 5c (total_retainage).
  const isOutOfBalance = Math.abs(totals.retainage - draw.total_retainage) > 100;

  const showApprove = draw.status === "submitted";
  const showSubmit = draw.status === "draft";
  const _showSendBack = draw.status === "submitted";
  const showLock = draw.status === "approved";
  const showMarkPaid = ["approved", "locked"].includes(draw.status);
  const showVoid = ["draft", "submitted", "approved"].includes(draw.status);
  const isLocked = ["locked", "paid", "void"].includes(draw.status);

  return (
    <AppShell>

      {/* Sub-header */}
      <div className="border-b border-brand-border bg-brand-surface/50 px-6 py-5 print:hidden">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => router.push("/draws")}
              className="text-cream-dim hover:text-teal transition-colors text-sm"
            >
              &larr; Draws
            </button>
            <h1
              className="m-0"
              style={{
                fontFamily: "var(--font-space-grotesk)",
                fontWeight: 500,
                fontSize: "22px",
                letterSpacing: "-0.01em",
                color: "var(--text-primary)",
              }}
            >
              {draw.jobs?.name} <span style={{ color: "var(--text-tertiary)" }}>&mdash;</span> Draw #{draw.draw_number}
              {draw.revision_number > 0 && (
                <span className="ml-1" style={{ color: "var(--nw-warn)" }}>Rev {draw.revision_number}</span>
              )}
              {draw.is_final && (
                <span className="ml-2 text-[10px] px-2 py-0.5 border border-brass text-brass uppercase tracking-wider">
                  FINAL
                </span>
              )}
            </h1>
            <span className={`text-[10px] px-2.5 py-1 font-medium uppercase tracking-[0.08em] ${badgeClass(draw.status)}`}>
              {formatStatus(draw.status)}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 border border-brand-border text-cream hover:bg-brand-elevated text-sm uppercase tracking-[0.06em] transition-colors"
              aria-label="Print this draw"
            >
              Print
            </button>
            {!isLocked && (
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = `/api/draws/${drawId}/export`;
                  a.download = "";
                  a.click();
                }}
                className="px-4 py-2 border border-brand-border text-cream hover:bg-brand-elevated text-sm uppercase tracking-[0.06em] transition-colors"
              >
                Export to Excel
              </button>
            )}
            {showSubmit && (
              <button
                onClick={() => handleAction("submit")}
                disabled={acting}
                className="h-[36px] px-4 text-[11px] uppercase disabled:opacity-50 transition-colors nw-primary-btn"
              >
                {acting ? "Processing..." : "Submit for Approval"}
              </button>
            )}
            {showApprove && (
              <>
                <button
                  onClick={() => handleAction("send_back")}
                  disabled={acting}
                  className="px-4 py-2 border border-brass text-brass hover:bg-brass/10 disabled:opacity-50 text-sm font-medium uppercase tracking-[0.06em] transition-colors"
                >
                  Send Back to Draft
                </button>
                <button
                  onClick={() => handleAction("approve")}
                  disabled={acting}
                  className="px-4 py-2 bg-status-success hover:opacity-90 disabled:opacity-50 text-white text-sm font-medium uppercase tracking-[0.06em] transition-colors"
                >
                  {acting ? "Processing..." : "Approve Draw"}
                </button>
              </>
            )}
            {showLock && (
              <button
                onClick={() =>
                  handleAction(
                    "lock",
                    "Locking this draw makes it permanent. Revisions must be created as new records. Continue?"
                  )
                }
                disabled={acting}
                className="h-[36px] px-4 text-[11px] uppercase disabled:opacity-50 transition-colors nw-primary-btn"
              >
                Lock Draw
              </button>
            )}
            {showMarkPaid && (
              <button
                onClick={() => handleAction("mark_paid")}
                disabled={acting}
                className="px-4 py-2 border border-status-success text-status-success hover:bg-status-success/10 disabled:opacity-50 text-sm font-medium uppercase tracking-[0.06em] transition-colors"
              >
                Mark Paid
              </button>
            )}
            {showVoid && (
              <button
                onClick={() =>
                  handleAction(
                    "void",
                    "Voiding this draw will release its invoices back to QA-approved and mark pending lien releases as not required. Continue?"
                  )
                }
                disabled={acting}
                className="px-4 py-2 border border-status-danger text-status-danger hover:bg-status-danger/10 disabled:opacity-50 text-sm font-medium uppercase tracking-[0.06em] transition-colors"
              >
                Void
              </button>
            )}
          </div>
        </div>
      </div>

      {actionError && (
        <div className="bg-status-danger/10 border-b border-status-danger/40">
          <div className="max-w-[1600px] mx-auto px-6 py-3 text-sm text-status-danger">
            {actionError}
          </div>
        </div>
      )}

      {/* Locked banner */}
      {draw.status === "locked" && (
        <div className="bg-teal/10 border-b border-teal/30">
          <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-teal flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <p className="text-teal text-sm">This draw is locked — permanent record. Changes require a revision.</p>
            </div>
            <button
              onClick={handleCreateRevision}
              disabled={acting}
              className="px-4 py-1.5 bg-transparent hover:bg-teal/10 border border-teal text-teal text-sm font-medium transition-colors disabled:opacity-50"
            >
              {acting ? "Creating..." : "Create Revision"}
            </button>
          </div>
        </div>
      )}
      {draw.status === "paid" && (
        <div className="bg-teal/10 border-b border-teal/30">
          <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-3">
            <svg className="w-5 h-5 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-teal text-sm">This draw has been paid.</p>
          </div>
        </div>
      )}

      {/* Pending-releases warning banner for submitted draws */}
      {draw.status === "submitted" && pendingReleaseCount > 0 && (
        <div className="bg-brass/10 border-b border-brass/40">
          <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-3">
            <svg className="w-5 h-5 text-brass" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-brass text-sm">
              <span className="font-medium">
                {pendingReleaseCount} of {totalReleaseCount}
              </span>{" "}
              lien release(s) still pending for this draw. Collect or waive before approving.
            </p>
          </div>
        </div>
      )}

      <main className="print-area max-w-[1600px] mx-auto px-4 md:px-6 py-6">
        <Breadcrumbs
          items={[
            { label: "Draws", href: "/draws" },
            ...(draw.jobs ? [{ label: draw.jobs.name, href: `/jobs/${draw.jobs.id}` }] : []),
            {
              label: `Draw #${draw.draw_number}${draw.revision_number > 0 ? ` Rev ${draw.revision_number}` : ""}`,
            },
          ]}
        />

        {/* Print-only header — appears at the top of the printed pay app. */}
        <div className="hidden print:block mb-4">
          <h1 className="text-xl font-semibold">
            {draw.jobs?.name} — Draw #{draw.draw_number}
            {draw.revision_number > 0 && ` (Rev ${draw.revision_number})`}
          </h1>
          <p className="text-sm">
            Application Date: {draw.application_date ? formatDate(draw.application_date) : "—"} ·
            Period: {draw.period_start ? formatDate(draw.period_start) : "—"} – {draw.period_end ? formatDate(draw.period_end) : "—"}
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-fade-up print:block">
          {/* G702 Summary */}
          <div className="xl:col-span-1">
            <div className="sticky top-24 space-y-5">
              <div className="bg-brand-card border border-teal/30 p-6">
                <p className="section-label">G702 — Application for Payment</p>
                <div className="mt-5 space-y-2.5">
                  <G702Row num="1" label="Original Contract Sum" value={draw.original_contract_sum} />
                  <G702Row num="2" label="Net Change Orders" value={draw.net_change_orders} />
                  <G702Row num="3" label="Contract Sum to Date" value={draw.contract_sum_to_date} bold />
                  <div className="border-t border-brand-border my-1" />
                  <G702Row num="4" label="Total Completed to Date" value={draw.total_completed_to_date} />
                  <G702Row num="5a" label="Retainage on Completed" value={draw.retainage_on_completed} sub />
                  <G702Row num="5b" label="Retainage on Stored" value={draw.retainage_on_stored} sub />
                  <G702Row num="5c" label="Total Retainage" value={draw.total_retainage} />
                  <G702Row
                    num="6"
                    label="Total Earned Less Retainage"
                    value={draw.total_earned_less_retainage}
                  />
                  <G702Row num="7" label="Less Previous Certificates" value={draw.less_previous_certificates} />
                  <G702Row num="8" label="Current Payment Due" value={draw.current_payment_due} bold highlight />
                  <div className="border-t border-brand-border my-1" />
                  <G702Row num="9" label="Balance + Retainage" value={draw.balance_to_finish} />
                </div>
              </div>

              <div className="bg-brand-card border border-teal/30 p-6">
                <p className="section-label">Details</p>
                <div className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-cream-dim">Application #</span>
                    <span className="text-cream">
                      {draw.application_number ?? draw.draw_number}
                      {draw.revision_number > 0 ? ` Rev ${draw.revision_number}` : ""}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cream-dim">Period</span>
                    <span className="text-cream">
                      {formatDate(draw.period_start)} — {formatDate(draw.period_end)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cream-dim">App Date</span>
                    <span className="text-cream">{formatDate(draw.application_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cream-dim">Retainage %</span>
                    <span className="text-cream">
                      {draw.retainage_percent.toFixed(1)}%{draw.is_final && " (released)"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cream-dim">Owner</span>
                    <span className="text-cream">{draw.jobs?.client_name ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cream-dim">Invoices</span>
                    <span className="text-cream">{draw.invoices?.length ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column with tabs */}
          <div className="xl:col-span-3 min-w-0">
            <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0 mb-4">
              <div className="flex gap-1 bg-brand-surface border border-brand-border p-1 w-fit whitespace-nowrap">
                <TabButton active={activeTab === "detail"} onClick={() => setActiveTab("detail")}>
                  Detail
                </TabButton>
                <TabButton active={activeTab === "compare"} onClick={() => setActiveTab("compare")}>
                  Compare
                </TabButton>
                <TabButton active={activeTab === "cover"} onClick={() => setActiveTab("cover")}>
                  Cover Letter
                </TabButton>
                <TabButton
                  active={activeTab === "lien-uploads"}
                  onClick={() => setActiveTab("lien-uploads")}
                >
                  Lien Releases
                  {missingDocCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] bg-status-danger text-white">
                      {missingDocCount}
                    </span>
                  )}
                </TabButton>
                <TabButton
                  active={activeTab === "internal-billings"}
                  onClick={() => setActiveTab("internal-billings")}
                >
                  Internal Billings
                </TabButton>
                <TabButton
                  active={activeTab === "change-orders"}
                  onClick={() => setActiveTab("change-orders")}
                >
                  Change Orders
                </TabButton>
              </div>
            </div>

            {activeTab === "compare" && <DrawCompareView drawId={drawId} />}
            {activeTab === "cover" && draw && (
              <DrawCoverLetterEditor drawId={drawId} jobId={draw.jobs?.id ?? ""} />
            )}
            {activeTab === "lien-uploads" && draw && (
              <DrawLienReleaseUploadList
                drawId={drawId}
                releases={draw.lien_releases}
                onChange={fetchDraw}
              />
            )}
            {activeTab === "internal-billings" && draw?.jobs && (
              <DrawInternalBillings
                drawId={drawId}
                jobId={draw.jobs.id}
                isDraft={["draft", "pm_review"].includes(draw.status)}
                onChange={() => fetchDraw()}
              />
            )}
            {activeTab === "change-orders" && draw && (
              <DrawChangeOrders
                drawId={drawId}
                editable={["draft", "pm_review"].includes(draw.status)}
              />
            )}

            {activeTab === "detail" && (
              <>
            {isOutOfBalance && (
              <div className="mb-4 p-4 bg-red-900/30 border border-red-500/50 flex items-start gap-3">
                <span className="text-red-400 text-lg leading-none mt-0.5">!</span>
                <div>
                  <p className="text-red-300 font-medium text-sm">G702 / G703 Retainage Out of Balance</p>
                  <p className="text-red-400/80 text-xs mt-1">
                    G703 retainage total ({formatCents(totals.retainage)}) does not match G702 Line 5c
                    Total Retainage ({formatCents(draw.total_retainage)}).
                  </p>
                </div>
              </div>
            )}
            <p className="section-label">G703 — Continuation Sheet</p>
            {hasNoBudget && (
              <div className="mt-3 border border-status-warning/40 bg-status-warning/5 px-4 py-3 text-sm text-status-warning">
                No budget loaded for this job — scheduled values fall back to the job contract. Import a
                budget on the Budget tab for accurate G703 math.
              </div>
            )}
            <div className="mt-5 overflow-x-auto border border-brand-border">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="bg-brand-surface text-left">
                    <Th sticky>A — Item</Th>
                    <Th>B — Description</Th>
                    <Th right>C — Scheduled Value</Th>
                    <Th right>D — Previous</Th>
                    <Th right>E — This Period</Th>
                    <Th right>F — Total to Date</Th>
                    <Th right>G — %</Th>
                    <Th right>H — Retainage</Th>
                    <Th right>I — Balance</Th>
                  </tr>
                </thead>
                <tbody>
                  {baseRows.length > 0 && (
                    <tr className="bg-brand-surface/40 border-t border-brand-border">
                      <td colSpan={9} className="py-1.5 px-4 text-[10px] uppercase tracking-wider text-cream-dim font-semibold">
                        Base Contract
                      </td>
                    </tr>
                  )}
                  {baseRows.map((row, idx) => (
                    <G703RowView key={row.code + "-b"} row={row} idx={idx} />
                  ))}
                  {coRows.length > 0 && (
                    <tr className="bg-brass/10 border-t-2 border-brass/40">
                      <td colSpan={9} className="py-1.5 px-4 text-[10px] uppercase tracking-wider text-brass font-semibold">
                        Change Orders · PCCO adjustments
                      </td>
                    </tr>
                  )}
                  {coRows.map((row, idx) => (
                    <G703RowView key={row.code + "-c"} row={row} idx={idx} co />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-brand-border-light bg-brand-surface">
                    <td colSpan={2} className="py-3 px-4 text-cream font-medium">
                      Grand Total
                    </td>
                    <td className="py-3 px-4 text-cream text-right font-display font-medium">
                      {formatCents(totals.scheduled)}
                    </td>
                    <td className="py-3 px-4 text-cream text-right font-display font-medium">
                      {totals.previous > 0 ? formatCents(totals.previous) : <span className="text-cream-dim">—</span>}
                    </td>
                    <td className="py-3 px-4 text-teal text-right font-display font-medium">
                      {formatCents(totals.thisPeriod)}
                    </td>
                    <td className="py-3 px-4 text-cream text-right font-display font-medium">
                      {formatCents(totals.totalToDate)}
                    </td>
                    <td className="py-3 px-4 text-cream-dim text-right">
                      {totals.scheduled > 0
                        ? `${((totals.totalToDate / totals.scheduled) * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="py-3 px-4 text-brass text-right font-display font-medium">
                      {formatCents(totals.retainage)}
                    </td>
                    <td className="py-3 px-4 text-cream text-right font-display font-medium">
                      {formatCents(totals.balance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Lien releases section */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <p className="section-label">Lien Releases</p>
                {draw.jobs && (
                  <Link
                    href={`/jobs/${draw.jobs.id}/lien-releases`}
                    className="text-xs text-teal hover:underline"
                  >
                    Manage all releases for this job →
                  </Link>
                )}
              </div>
              {draw.lien_releases.length === 0 ? (
                <div className="border border-brand-border px-4 py-4 text-sm text-cream-dim">
                  No lien releases yet. They will auto-generate when this draw is submitted.
                </div>
              ) : (
                <div className="overflow-x-auto border border-brand-border">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead>
                      <tr className="bg-brand-surface text-left">
                        <Th>Vendor</Th>
                        <Th>Type</Th>
                        <Th right>Amount</Th>
                        <Th>Status</Th>
                        <Th>Through Date</Th>
                        <Th>Document</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {draw.lien_releases.map((lr) => (
                        <tr key={lr.id} className="border-t border-brand-row-border">
                          <td className="py-3 px-4 text-cream">{lr.vendors?.name ?? "—"}</td>
                          <td className="py-3 px-4 text-cream-muted text-xs">
                            {formatReleaseType(lr.release_type)}
                          </td>
                          <td className="py-3 px-4 text-cream text-right font-display font-medium">
                            {lr.amount != null ? formatCents(lr.amount) : "—"}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium border ${releaseBadge(lr.status)}`}>
                              {formatReleaseStatus(lr.status)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-cream-muted text-xs">{formatDate(lr.through_date)}</td>
                          <td className="py-3 px-4 text-cream-muted text-xs">
                            {lr.document_url ? (
                              <a href={lr.document_url} target="_blank" rel="noreferrer" className="text-teal hover:underline">
                                View
                              </a>
                            ) : (
                              <span className="text-cream-dim">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Included Invoices */}
            {draw.invoices && draw.invoices.length > 0 && (
              <div className="mt-8">
                <p className="section-label">Included Invoices</p>
                <div className="mt-3 overflow-x-auto border border-brand-border">
                  <table className="w-full min-w-[500px] text-sm">
                    <thead>
                      <tr className="bg-brand-surface text-left">
                        <Th>Vendor</Th>
                        <Th>Invoice #</Th>
                        <Th right>Amount</Th>
                        <Th>Payment</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {draw.invoices.map((inv) => (
                        <tr
                          key={inv.id}
                          className="border-t border-brand-row-border hover:bg-brand-elevated/50 cursor-pointer transition-colors"
                          onClick={() => router.push(`/invoices/${inv.id}`)}
                        >
                          <td className="py-3 px-4 text-cream">{inv.vendor_name_raw ?? "Unknown"}</td>
                          <td className="py-3 px-4 text-cream-muted font-mono text-xs">
                            {inv.invoice_number ?? "—"}
                          </td>
                          <td className="py-3 px-4 text-cream text-right font-display font-medium">
                            {formatCents(inv.total_amount)}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium border ${paymentBadge(inv.payment_status)}`}>
                              {inv.payment_status ?? "unpaid"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
              </>
            )}
          </div>
        </div>
      </main>
      <style jsx>{`
        :global(.nw-primary-btn) {
          background: var(--nw-stone-blue);
          color: var(--nw-white-sand);
          font-family: var(--font-jetbrains-mono);
          letter-spacing: 0.12em;
          font-weight: 500;
          border: 1px solid var(--nw-stone-blue);
        }
        :global(.nw-primary-btn:hover:not(:disabled)) {
          background: var(--nw-gulf-blue);
          border-color: var(--nw-gulf-blue);
        }
      `}</style>
    </AppShell>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        active ? "bg-brand-elevated text-cream" : "text-cream-dim hover:text-cream"
      }`}
    >
      {children}
    </button>
  );
}

// ---- helpers -----------------------------------------------------------

function Th({
  children,
  right,
  sticky,
}: {
  children: React.ReactNode;
  right?: boolean;
  sticky?: boolean;
}) {
  return (
    <th
      className={`py-3 px-4 text-[11px] text-cream font-bold uppercase tracking-wider ${
        right ? "text-right" : ""
      } ${sticky ? "sticky left-0 bg-brand-surface z-10" : ""}`}
    >
      {children}
    </th>
  );
}

function G703RowView({
  row,
  idx,
  co,
}: {
  row: {
    code: string;
    description: string;
    scheduled_value: number;
    co_adjustment: number;
    previous_applications: number;
    this_period: number;
    total_to_date: number;
    retainage: number;
    percent_complete: number;
    balance_to_finish: number;
  };
  idx: number;
  co?: boolean;
}) {
  const overBudget = row.balance_to_finish < 0;
  const stripe = idx % 2 === 1 ? "bg-[#FAFAF5]" : "";
  const highlight = row.this_period > 0 ? "bg-teal/5" : stripe;
  const codeColor = co ? "text-brass" : "text-teal";
  return (
    <tr className={`border-t border-brand-row-border ${highlight}`}>
      <td className={`py-3 px-4 ${codeColor} font-mono text-xs font-bold sticky left-0 z-[1] ${highlight || "bg-brand-card"}`}>
        {row.code}
      </td>
      <td className="py-3 px-4 text-cream">
        {row.description}
        {co && <span className="ml-2 text-[10px] text-brass uppercase tracking-wider">CO</span>}
      </td>
      <td className="py-3 px-4 text-cream text-right">
        {formatCents(row.scheduled_value)}
        {row.co_adjustment > 0 && !co && (
          <span className="text-[10px] text-teal ml-1" title={`Includes ${formatCents(row.co_adjustment)} in approved COs`}>
            (+{formatCents(row.co_adjustment)} CO)
          </span>
        )}
      </td>
      <td className="py-3 px-4 text-cream text-right">
        {row.previous_applications > 0 ? formatCents(row.previous_applications) : <span className="text-cream-dim">—</span>}
      </td>
      <td className="py-3 px-4 text-right font-medium">
        {row.this_period > 0 ? (
          <span className="text-teal">{formatCents(row.this_period)}</span>
        ) : (
          <span className="text-cream-dim">—</span>
        )}
      </td>
      <td className="py-3 px-4 text-cream text-right">
        {row.total_to_date > 0 ? formatCents(row.total_to_date) : <span className="text-cream-dim">—</span>}
      </td>
      <td className="py-3 px-4 text-cream-muted text-right">
        {row.percent_complete > 0 ? `${row.percent_complete.toFixed(1)}%` : <span className="text-cream-dim">—</span>}
      </td>
      <td className="py-3 px-4 text-right">
        {row.retainage > 0 ? (
          <span className="text-brass">{formatCents(row.retainage)}</span>
        ) : (
          <span className="text-cream-dim">—</span>
        )}
      </td>
      <td className={`py-3 px-4 text-right ${overBudget ? "text-red-400 font-medium" : "text-cream"}`}>
        {overBudget && <span className="mr-1 font-bold" title="Over original budget — see change order log">*</span>}
        {formatCents(row.balance_to_finish)}
      </td>
    </tr>
  );
}

function badgeClass(status: string): string {
  if (status === "submitted") return "bg-transparent text-cream border border-cream";
  if (["approved", "locked", "paid"].includes(status))
    return "bg-transparent text-status-success border border-status-success";
  if (status === "draft" || status === "pm_review")
    return "bg-transparent text-brass border border-brass";
  if (status === "void") return "bg-transparent text-status-danger border border-status-danger";
  return "bg-transparent text-cream-muted border border-brand-border-light";
}

function paymentBadge(status: string | null): string {
  if (status === "paid") return "bg-transparent text-status-success border border-status-success";
  if (status === "scheduled") return "bg-transparent text-teal border border-teal";
  if (status === "partial") return "bg-transparent text-brass border border-brass";
  return "bg-transparent text-cream-dim border border-brand-border-light";
}

function releaseBadge(status: string): string {
  if (status === "received") return "bg-transparent text-status-success border border-status-success";
  if (status === "pending") return "bg-transparent text-brass border border-brass";
  if (status === "waived" || status === "not_required")
    return "bg-transparent text-cream-dim border border-brand-border-light";
  return "bg-transparent text-cream-dim border border-brand-border-light";
}

function formatReleaseType(t: string): string {
  const map: Record<string, string> = {
    conditional: "Conditional",
    unconditional: "Unconditional",
    partial: "Partial",
    final: "Final",
    conditional_progress: "Conditional Progress",
    unconditional_progress: "Unconditional Progress",
    conditional_final: "Conditional Final",
    unconditional_final: "Unconditional Final",
  };
  return map[t] ?? t;
}

function formatReleaseStatus(s: string): string {
  const map: Record<string, string> = {
    pending: "Pending",
    received: "Received",
    waived: "Waived",
    not_required: "Not Required",
  };
  return map[s] ?? s;
}

function G702Row({
  num,
  label,
  value,
  bold,
  highlight,
  sub,
}: {
  num: string;
  label: string;
  value: number;
  bold?: boolean;
  highlight?: boolean;
  sub?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${sub ? "pl-4 opacity-70" : ""}`}>
      <div className="flex items-center gap-2">
        {num ? (
          <span className="text-cream-dim text-[11px] font-mono w-6">{num}</span>
        ) : (
          <span className="w-6" />
        )}
        <span className={`text-xs ${bold ? "text-cream font-medium" : "text-cream-muted"}`}>{label}</span>
      </div>
      <span
        className={`font-display text-sm ${
          highlight ? "text-brass font-medium" : bold ? "text-cream font-medium" : "text-cream"
        }`}
      >
        {formatCents(value)}
      </span>
    </div>
  );
}
