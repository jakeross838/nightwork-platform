"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/app-shell";
import NwButton from "@/components/nw/Button";
import NwBadge from "@/components/nw/Badge";
import Money from "@/components/nw/Money";
import { Textarea } from "@/components/ui/textarea";

// ── Phase 3.4 Issue 2 component imports ───────────────────────────
import ProposalReviewHeader from "@/components/proposals/ProposalReviewHeader";
import ProposalFilePreview from "@/components/proposals/ProposalFilePreview";
import ProposalDetailsPanel from "@/components/proposals/ProposalDetailsPanel";
import ProposalLineItemsSection from "@/components/proposals/ProposalLineItemsSection";
import {
  type CostCodePick,
  type ProposalLineItemForm,
} from "@/components/proposals/ProposalLineItemRow";
import ProposalFeeScheduleSection, {
  type FeeScheduleEntryForm,
} from "@/components/proposals/ProposalFeeScheduleSection";
import ProposalPaymentScheduleSection, {
  type PaymentScheduleEntryForm,
} from "@/components/proposals/ProposalPaymentScheduleSection";
import ProposalPaymentTermsSection, {
  type PaymentTermsForm,
} from "@/components/proposals/ProposalPaymentTermsSection";
import ProposalScheduleItemsSection, {
  type ScheduleItemForm,
} from "@/components/proposals/ProposalScheduleItemsSection";

import type {
  ExtractionRow,
  JobOption,
  VendorOption,
  OrgCostCodeOption,
  LegacyCostCodeOption,
  PendingSuggestionOption,
} from "./page";
import type { OrgMemberRole } from "@/lib/org/session";

interface Props {
  extraction: ExtractionRow;
  pdfSignedUrl: string | null;
  jobs: JobOption[];
  vendors: VendorOption[];
  orgCostCodes: OrgCostCodeOption[];
  legacyCostCodes: LegacyCostCodeOption[];
  pendingSuggestions: PendingSuggestionOption[];
  role: OrgMemberRole;
}

// ── Form shape ────────────────────────────────────────────────────
//
// Composes the section-specific form types from the extracted-component
// files. Each section file owns its slice of the form so it can be
// edited / tested independently; the orchestrator just glues them.
interface ProposalForm {
  vendor_name: string;
  vendor_id: string | null;
  vendor_address: string | null;
  proposal_number: string | null;
  proposal_date: string | null;
  valid_through: string | null;
  job_id: string | null;
  title: string;
  total_cents: number;
  scope_summary: string;
  inclusions: string | null;
  exclusions: string | null;
  notes: string | null;
  vendor_stated_start_date: string | null;
  vendor_stated_duration_days: number | null;
  additional_fee_schedule: FeeScheduleEntryForm[] | null;
  payment_schedule: PaymentScheduleEntryForm[] | null;
  payment_terms: PaymentTermsForm | null;
  schedule_items: ScheduleItemForm[] | null;
  accepted_signature_present: boolean;
  accepted_signature_name: string | null;
  accepted_signature_date: string | null;
  job_address: string | null;
  line_items: ProposalLineItemForm[];
  confidence_score: number;
  confidence_details: Record<string, number>;
  flags: string[];
  raw_extraction: unknown;
}

interface SuggestModalState {
  line_index: number;
  suggested_code: string;
  suggested_name: string;
  rationale: string;
}

// ── ParsedProposal envelope shape — what /api/proposals/extract returns ──
interface ExtractedProposal {
  vendor_name: string;
  vendor_address: string | null;
  proposal_number: string | null;
  proposal_date: string | null;
  valid_through: string | null;
  title: string;
  total_cents: number;
  scope_summary: string;
  inclusions: string | null;
  exclusions: string | null;
  notes: string | null;
  vendor_stated_start_date: string | null;
  vendor_stated_duration_days: number | null;
  additional_fee_schedule: FeeScheduleEntryForm[] | null;
  payment_schedule: PaymentScheduleEntryForm[] | null;
  payment_terms: PaymentTermsForm | null;
  schedule_items: ScheduleItemForm[] | null;
  accepted_signature_present: boolean;
  accepted_signature_name: string | null;
  accepted_signature_date: string | null;
  job_address: string | null;
  line_items: Array<{
    line_number: number;
    description: string;
    description_normalized: string | null;
    quantity: number | null;
    unit_of_measure: string | null;
    unit_price_cents: number | null;
    total_price_cents: number;
    cost_code_suggestion: string | null;
    material_cost_cents: number | null;
    labor_cost_cents: number | null;
    subcontract_cost_cents: number | null;
    tax_cents: number | null;
    delivery_cents: number | null;
    notes_cents: number | null;
    attributes: Record<string, unknown>;
  }>;
  confidence_score: number;
  confidence_details: Record<string, number>;
  flags: string[];
  raw_response: unknown;
}

function buildFormFromExtractedData(
  ed: ExtractedProposal,
  preserveMatches?: { vendor_id: string | null; job_id: string | null }
): ProposalForm {
  return {
    vendor_name: ed.vendor_name,
    vendor_id: preserveMatches?.vendor_id ?? null,
    vendor_address: ed.vendor_address,
    proposal_number: ed.proposal_number,
    proposal_date: ed.proposal_date,
    valid_through: ed.valid_through,
    job_id: preserveMatches?.job_id ?? null,
    title: ed.title,
    total_cents: ed.total_cents,
    scope_summary: ed.scope_summary,
    inclusions: ed.inclusions,
    exclusions: ed.exclusions,
    notes: ed.notes,
    vendor_stated_start_date: ed.vendor_stated_start_date,
    vendor_stated_duration_days: ed.vendor_stated_duration_days,
    additional_fee_schedule: ed.additional_fee_schedule,
    payment_schedule: ed.payment_schedule,
    payment_terms: ed.payment_terms,
    schedule_items: ed.schedule_items,
    accepted_signature_present: ed.accepted_signature_present,
    accepted_signature_name: ed.accepted_signature_name,
    accepted_signature_date: ed.accepted_signature_date,
    job_address: ed.job_address,
    line_items: ed.line_items.map((li) => ({
      line_number: li.line_number,
      description: li.description,
      description_normalized: li.description_normalized,
      quantity: li.quantity,
      unit_of_measure: li.unit_of_measure,
      unit_price_cents: li.unit_price_cents,
      total_price_cents: li.total_price_cents,
      cost_code_pick: { kind: "none" },
      ai_cost_code_suggestion: li.cost_code_suggestion,
      material_cost_cents: li.material_cost_cents,
      labor_cost_cents: li.labor_cost_cents,
      subcontract_cost_cents: li.subcontract_cost_cents,
      tax_cents: li.tax_cents,
      delivery_cents: li.delivery_cents,
      notes_cents: li.notes_cents,
      attributes: li.attributes,
    })),
    confidence_score: ed.confidence_score,
    confidence_details: ed.confidence_details,
    flags: ed.flags,
    raw_extraction: ed.raw_response,
  };
}

export default function ReviewManager(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ProposalForm | null>(null);
  const [loading, setLoading] = useState(true);
  // Suppress the "AI is reading the PDF…" loading copy for the first 1s
  // so cache hits (Issue 1) don't flash a 20–40s message. Times out:
  // still loading after 1s → reveal copy.
  const [showLoadingCopy, setShowLoadingCopy] = useState(false);
  const [actionBusy, setActionBusy] = useState<
    null | "save" | "convert_po" | "reject"
  >(null);
  const [reExtractBusy, setReExtractBusy] = useState(false);
  const [extractedAt, setExtractedAt] = useState<string | null>(null);
  const [extractionPromptVersion, setExtractionPromptVersion] = useState<
    string | null
  >(null);
  const [aiModelUsed, setAiModelUsed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestModal, setSuggestModal] = useState<SuggestModalState | null>(null);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [pendingSuggestions, setPendingSuggestions] = useState<
    PendingSuggestionOption[]
  >(props.pendingSuggestions);

  // Initial extraction load — cache-aware via Issue 1's route caching.
  useEffect(() => {
    let cancelled = false;
    const revealTimer = setTimeout(() => {
      if (!cancelled) setShowLoadingCopy(true);
    }, 1000);
    (async () => {
      try {
        const res = await fetch("/api/proposals/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extraction_id: props.extraction.id }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as { extracted_data: ExtractedProposal };
        if (cancelled) return;
        setForm(buildFormFromExtractedData(json.extracted_data));
        setExtractedAt(props.extraction.extraction_prompt_version ? new Date().toISOString() : null);
        setExtractionPromptVersion(props.extraction.extraction_prompt_version);
        setAiModelUsed(props.extraction.extraction_model);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      } finally {
        clearTimeout(revealTimer);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(revealTimer);
    };
  }, [props.extraction.id, props.extraction.extraction_model, props.extraction.extraction_prompt_version]);

  function updateForm(patch: Partial<ProposalForm>) {
    setForm((f) => (f ? { ...f, ...patch } : f));
  }

  function updateLine(idx: number, patch: Partial<ProposalLineItemForm>) {
    setForm((f) => {
      if (!f) return f;
      const next = f.line_items.slice();
      next[idx] = { ...next[idx], ...patch };
      return { ...f, line_items: next };
    });
  }

  function pickCostCodeFromValue(value: string): CostCodePick {
    if (value === "") return { kind: "none" };
    const [kind, id] = value.split(":");
    if (kind === "org") {
      const code = props.orgCostCodes.find((c) => c.id === id);
      if (code)
        return {
          kind: "org",
          org_cost_code_id: id,
          code: code.code,
          name: code.name,
        };
    }
    if (kind === "legacy") {
      const code = props.legacyCostCodes.find((c) => c.id === id);
      if (code)
        return {
          kind: "legacy",
          cost_code_id: id,
          code: code.code,
          description: code.description,
        };
    }
    if (kind === "pending") {
      const sugg = pendingSuggestions.find((s) => s.id === id);
      if (sugg)
        return {
          kind: "pending",
          suggestion_id: id,
          suggested_code: sugg.suggested_code,
          suggested_name: sugg.suggested_name,
        };
    }
    return { kind: "none" };
  }

  function pickToValue(pick: CostCodePick): string {
    switch (pick.kind) {
      case "org":
        return `org:${pick.org_cost_code_id}`;
      case "legacy":
        return `legacy:${pick.cost_code_id}`;
      case "pending":
        return `pending:${pick.suggestion_id}`;
      default:
        return "";
    }
  }

  async function submitSuggestion() {
    if (!suggestModal) return;
    setSuggestBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cost-code-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggested_code: suggestModal.suggested_code,
          suggested_name: suggestModal.suggested_name,
          rationale: suggestModal.rationale || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { suggestion_id: string };
      const newSugg: PendingSuggestionOption = {
        id: json.suggestion_id,
        suggested_code: suggestModal.suggested_code,
        suggested_name: suggestModal.suggested_name,
        source_proposal_line_item_id: null,
      };
      setPendingSuggestions((prev) => [newSugg, ...prev]);
      updateLine(suggestModal.line_index, {
        cost_code_pick: {
          kind: "pending",
          suggestion_id: json.suggestion_id,
          suggested_code: suggestModal.suggested_code,
          suggested_name: suggestModal.suggested_name,
        },
      });
      setSuggestModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSuggestBusy(false);
    }
  }

  async function commit(thenConvertToPo: boolean) {
    if (!form) return;
    if (!form.job_id) {
      setError("Pick a job before saving.");
      return;
    }
    if (!form.vendor_id) {
      setError("Pick or confirm a vendor before saving.");
      return;
    }
    setActionBusy(thenConvertToPo ? "convert_po" : "save");
    setError(null);
    try {
      const res = await fetch("/api/proposals/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extraction_id: props.extraction.id,
          form: {
            vendor_id: form.vendor_id,
            vendor_name: form.vendor_name,
            vendor_address: form.vendor_address,
            job_id: form.job_id,
            proposal_number: form.proposal_number,
            proposal_date: form.proposal_date,
            valid_through: form.valid_through,
            title: form.title,
            total_cents: form.total_cents,
            scope_summary: form.scope_summary,
            inclusions: form.inclusions,
            exclusions: form.exclusions,
            notes: form.notes,
            vendor_stated_start_date: form.vendor_stated_start_date,
            vendor_stated_duration_days: form.vendor_stated_duration_days,
            additional_fee_schedule: form.additional_fee_schedule,
            payment_schedule: form.payment_schedule,
            payment_terms: form.payment_terms,
            schedule_items: form.schedule_items,
            accepted_signature_present: form.accepted_signature_present,
            accepted_signature_name: form.accepted_signature_name,
            accepted_signature_date: form.accepted_signature_date,
            job_address: form.job_address,
            line_items: form.line_items,
            raw_extraction: form.raw_extraction,
            ai_confidence: form.confidence_score,
            ai_confidence_details: form.confidence_details,
            flags: form.flags,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { proposal_id: string };
      if (thenConvertToPo) {
        const poRes = await fetch(
          `/api/proposals/${json.proposal_id}/convert-to-po`,
          { method: "POST" }
        );
        if (poRes.status === 501) {
          alert(
            "Proposal saved. Convert to PO will be available once Phase 3.5 ships."
          );
        } else if (!poRes.ok) {
          const body = await poRes.json().catch(() => ({}));
          throw new Error(
            body.error || `Convert to PO failed: HTTP ${poRes.status}`
          );
        }
      }
      router.push(`/proposals/${json.proposal_id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setActionBusy(null);
    }
  }

  async function reject() {
    if (!form) return;
    if (!confirm("Mark this extraction rejected? It will not commit a proposal."))
      return;
    setActionBusy("reject");
    setError(null);
    try {
      const res = await fetch(
        `/api/proposals/extract/${props.extraction.id}/reject`,
        { method: "POST" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      router.push("/proposals");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setActionBusy(null);
    }
  }

  async function handleReExtract() {
    if (reExtractBusy) return;
    setReExtractBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/proposals/extract?force=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extraction_id: props.extraction.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { extracted_data: ExtractedProposal };
      setForm(
        buildFormFromExtractedData(json.extracted_data, {
          vendor_id: form?.vendor_id ?? null,
          job_id: form?.job_id ?? null,
        })
      );
      setExtractedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReExtractBusy(false);
    }
  }

  if (loading) {
    if (!showLoadingCopy) {
      return (
        <AppShell>
          <div className="px-6 py-8" />
        </AppShell>
      );
    }
    return (
      <AppShell>
        <div className="px-6 py-8 space-y-2">
          <p className="text-sm text-[color:var(--text-primary)]">
            AI is reading the PDF — typically 20–40 seconds for multi-line
            proposals.
          </p>
          <p className="text-xs text-[color:var(--text-tertiary)]">
            Form fields will populate when extraction completes. Don&rsquo;t
            navigate away.
          </p>
        </div>
      </AppShell>
    );
  }

  if (error && !form) {
    return (
      <AppShell>
        <div className="px-6 py-8 space-y-3">
          <h1 className="text-xl font-semibold text-[color:var(--text-primary)]">
            Extraction failed
          </h1>
          <p className="text-sm text-[color:var(--nw-danger)]">{error}</p>
          <NwButton variant="secondary" size="sm" onClick={() => router.refresh()}>
            Retry
          </NwButton>
        </div>
      </AppShell>
    );
  }

  if (!form) return null;

  return (
    <AppShell>
      <ProposalReviewHeader
        vendorNameRaw={form.vendor_name}
        vendorId={form.vendor_id}
        vendor={null}
        proposalNumber={form.proposal_number}
        confidenceScore={form.confidence_score}
        status="awaiting_review"
        signed={form.accepted_signature_present}
      />

      <main className="print-area max-w-[1600px] mx-auto px-4 md:px-6 py-6 space-y-5 print:py-2">
        {/* Print-only summary. globals.css `@media print` hides every
            <input>/<select>/<textarea>, so the editable form below
            collapses to bare labels in print. This block renders the
            same values as static text so a printed proposal is useful.
            Mirrors invoice review at src/app/invoices/[id]/page.tsx
            (~L1010). Browser view ignores it via `hidden`; print view
            reveals it via `print:block`. */}
        <div className="hidden print:block mb-4 space-y-3">
          <h1 className="text-xl font-semibold">
            {form.vendor_name || "Proposal"}
            {form.proposal_number ? ` — #${form.proposal_number}` : ""}
          </h1>
          <p className="text-sm">
            Total: <Money cents={form.total_cents} /> · Date:{" "}
            {form.proposal_date ?? "—"}
            {form.valid_through ? ` · Valid through: ${form.valid_through}` : ""}
            {form.job_address ? ` · Site: ${form.job_address}` : ""}
          </p>
          {form.scope_summary && (
            <div>
              <h2 className="text-sm font-semibold">Scope</h2>
              <p className="text-sm whitespace-pre-line">{form.scope_summary}</p>
            </div>
          )}
          {form.line_items.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold">
                Line items ({form.line_items.length})
              </h2>
              <table className="w-full text-xs mt-1">
                <thead>
                  <tr>
                    <th className="text-left">#</th>
                    <th className="text-left">Description</th>
                    <th className="text-right">Qty</th>
                    <th className="text-left">UoM</th>
                    <th className="text-right">Unit</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {form.line_items.map((li) => (
                    <tr key={li.line_number}>
                      <td>{li.line_number}</td>
                      <td>{li.description}</td>
                      <td className="text-right">{li.quantity ?? "—"}</td>
                      <td>{li.unit_of_measure ?? "—"}</td>
                      <td className="text-right">
                        <Money cents={li.unit_price_cents} />
                      </td>
                      <td className="text-right">
                        <Money cents={li.total_price_cents} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action strip — h1 + buttons above the 50/50 hero. Mirrors the
            invoice review surface's action-strip pattern (per Q2). */}
        <header className="flex items-end justify-between gap-5 flex-wrap">
          <div className="min-w-0">
            <div
              className="font-mono uppercase tracking-[0.14em] text-[10px] text-[color:var(--nw-stone-blue)] mb-1"
            >
              Save as Proposal — review &amp; commit
            </div>
            <h1
              className="font-display flex items-center gap-3 flex-wrap"
              style={{
                fontWeight: 500,
                fontSize: "28px",
                letterSpacing: "-0.02em",
                margin: 0,
                color: "var(--text-primary)",
                lineHeight: 1.15,
              }}
            >
              <span>{form.title}</span>
            </h1>
            {form.flags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {form.flags.map((f) => (
                  <NwBadge key={f} variant="warning" size="sm">
                    {f}
                  </NwBadge>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <NwButton
              variant="primary"
              size="md"
              loading={actionBusy === "save"}
              disabled={actionBusy !== null}
              onClick={() => commit(false)}
            >
              Save as Proposal
            </NwButton>
            <NwButton
              variant="secondary"
              size="md"
              loading={actionBusy === "convert_po"}
              disabled={actionBusy !== null}
              onClick={() => commit(true)}
            >
              Convert to PO
            </NwButton>
            <NwButton
              variant="secondary"
              size="md"
              disabled
              title="Available after Phase 3.7"
            >
              Convert to CO
            </NwButton>
            <NwButton
              variant="danger"
              size="md"
              loading={actionBusy === "reject"}
              disabled={actionBusy !== null}
              onClick={reject}
            >
              Reject
            </NwButton>
          </div>
        </header>

        {error && (
          <div className="border border-[var(--nw-danger)] bg-[var(--nw-danger)]/10 px-3 py-2 text-sm text-[color:var(--nw-danger)]">
            {error}
          </div>
        )}

        {/* 50/50 hero — file preview LEFT, details panel RIGHT.
            Mirrors invoice page.tsx ~L1310: 1px hairline gap, both cells
            on bg-card, single matched pair separated by the grid gap. */}
        <div
          className="grid grid-cols-1 lg:grid-cols-2 items-start"
          style={{
            gap: "1px",
            background: "var(--border-default)",
            border: "1px solid var(--border-default)",
          }}
        >
          {/* LEFT — Source document */}
          <div className="p-[22px]" style={{ background: "var(--bg-card)" }}>
            <div className="flex items-center justify-between mb-[14px]">
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 500,
                  fontSize: "15px",
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                Source document
              </h3>
              {props.pdfSignedUrl && (
                <a
                  href={props.pdfSignedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--nw-stone-blue)",
                  }}
                >
                  Open in new tab ↗
                </a>
              )}
            </div>
            <ProposalFilePreview
              fileUrl={props.pdfSignedUrl}
              downloadUrl={props.pdfSignedUrl}
              fileName={`${form.vendor_name} — ${form.proposal_number ?? "proposal"}.pdf`}
            />
          </div>

          {/* RIGHT — Details panel (metadata + extraction info + scope) */}
          <div style={{ background: "var(--bg-card)" }}>
            <ProposalDetailsPanel
              form={form}
              onChange={updateForm}
              vendors={props.vendors}
              jobs={props.jobs}
              aiModelUsed={aiModelUsed}
              extractionPromptVersion={extractionPromptVersion}
              extractedAt={extractedAt}
              onReExtract={handleReExtract}
              reExtractBusy={reExtractBusy}
            />
          </div>
        </div>

        {/* Below-hero sections — operational content per prompt 205 */}
        <ProposalLineItemsSection
          lineItems={form.line_items}
          totalCents={form.total_cents}
          lineItemsConfidence={form.confidence_details.line_items}
          orgCostCodes={props.orgCostCodes}
          legacyCostCodes={props.legacyCostCodes}
          pendingSuggestions={pendingSuggestions}
          onLineChange={updateLine}
          onPickFromValue={(idx, v) =>
            updateLine(idx, { cost_code_pick: pickCostCodeFromValue(v) })
          }
          pickToValue={pickToValue}
          onSuggestNew={(idx) => {
            const li = form.line_items[idx];
            setSuggestModal({
              line_index: idx,
              suggested_code: "",
              suggested_name: li?.ai_cost_code_suggestion ?? "",
              rationale: "",
            });
          }}
        />

        <ProposalFeeScheduleSection
          entries={form.additional_fee_schedule}
          onChange={(next) => updateForm({ additional_fee_schedule: next })}
        />

        <ProposalPaymentScheduleSection
          entries={form.payment_schedule}
          onChange={(next) => updateForm({ payment_schedule: next })}
        />

        <ProposalPaymentTermsSection
          terms={form.payment_terms}
          onChange={(next) => updateForm({ payment_terms: next })}
        />

        <ProposalScheduleItemsSection items={form.schedule_items} />
      </main>

      {/* Suggest-new-cost-code modal — kept inline, tightly coupled to
          line state + the suggestion submit handler. */}
      {suggestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-nw-slate-deep/30 p-4">
          <div className="w-full max-w-md space-y-4 border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
            <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
              Suggest new cost code
            </h2>
            <p className="text-sm text-[color:var(--text-secondary)]">
              Owners and admins approve suggestions in{" "}
              <code>/cost-intelligence/suggestions</code>. Until approved, your
              proposal line will show as &ldquo;Pending&rdquo;.
            </p>
            <SuggestField label="Code (your team's format, e.g. R-STUC-001)">
              <input
                className="w-full border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                value={suggestModal.suggested_code}
                onChange={(e) =>
                  setSuggestModal({
                    ...suggestModal,
                    suggested_code: e.target.value,
                  })
                }
              />
            </SuggestField>
            <SuggestField label="Display name">
              <input
                className="w-full border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                value={suggestModal.suggested_name}
                onChange={(e) =>
                  setSuggestModal({
                    ...suggestModal,
                    suggested_name: e.target.value,
                  })
                }
              />
            </SuggestField>
            <SuggestField label="Why is this code needed? (optional)">
              <Textarea
                minRows={2}
                value={suggestModal.rationale}
                onChange={(e) =>
                  setSuggestModal({
                    ...suggestModal,
                    rationale: e.target.value,
                  })
                }
              />
            </SuggestField>
            <div className="flex justify-end gap-2">
              <NwButton
                variant="ghost"
                size="sm"
                onClick={() => setSuggestModal(null)}
              >
                Cancel
              </NwButton>
              <NwButton
                variant="primary"
                size="sm"
                loading={suggestBusy}
                disabled={
                  suggestModal.suggested_code.trim() === "" ||
                  suggestModal.suggested_name.trim() === ""
                }
                onClick={submitSuggestion}
              >
                Submit suggestion
              </NwButton>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// Suggest-modal field wrapper — kept inline because the modal is the
// only consumer in this file.
function SuggestField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-tertiary)] font-mono">
        {label}
      </span>
      {children}
    </label>
  );
}
