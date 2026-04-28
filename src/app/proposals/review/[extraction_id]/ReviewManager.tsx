"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/app-shell";
import NwButton from "@/components/nw/Button";
import NwBadge from "@/components/nw/Badge";
import NwEyebrow from "@/components/nw/Eyebrow";
import Money from "@/components/nw/Money";
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

// ParsedProposal shape (cents-normalized) returned from
// /api/proposals/extract. Local type avoids a server-import cycle.
interface ProposalLineItemForm {
  line_number: number;
  description: string;
  description_normalized: string | null;
  quantity: number | null;
  unit_of_measure: string | null;
  unit_price_cents: number | null;
  total_price_cents: number;
  cost_code_pick: CostCodePick;
  material_cost_cents: number | null;
  labor_cost_cents: number | null;
  subcontract_cost_cents: number | null;
  tax_cents: number | null;
  delivery_cents: number | null;
  notes_cents: number | null;
  attributes: Record<string, unknown>;
  ai_cost_code_suggestion: string | null;
}

interface FeeScheduleEntryForm {
  rate_type: string;
  description: string | null;
  rate_cents: number | null;
  unit: string | null;
}

interface PaymentScheduleEntryForm {
  milestone: string;
  percentage_pct: number | null;
  amount_cents: number | null;
  trigger: string | null;
}

interface PaymentTermsForm {
  net_days: number | null;
  late_interest_rate_pct: number | null;
  governing_law: string | null;
  other_terms_text: string | null;
}

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
  // Phase 3.4 Step 5b/5c — structured billing data
  additional_fee_schedule: FeeScheduleEntryForm[] | null;
  payment_schedule: PaymentScheduleEntryForm[] | null;
  payment_terms: PaymentTermsForm | null;
  line_items: ProposalLineItemForm[];
  confidence_score: number;
  confidence_details: Record<string, number>;
  flags: string[];
  raw_extraction: unknown;
}

// Cost-code pick state — three sources (Phase 3.3 [New], Phase 1 [Legacy],
// PM-suggested [Pending]) plus an empty placeholder. Step 5 commit
// inspects `kind` to decide which FK column to write (org_cost_code_id
// vs cost_code_id) per Jake's clarification 3 in prompt 176.
type CostCodePick =
  | { kind: "none" }
  | { kind: "org"; org_cost_code_id: string; code: string; name: string }
  | { kind: "legacy"; cost_code_id: string; code: string; description: string }
  | {
      kind: "pending";
      suggestion_id: string;
      suggested_code: string;
      suggested_name: string;
    };

interface SuggestModalState {
  line_index: number;
  suggested_code: string;
  suggested_name: string;
  rationale: string;
}

const CONFIDENCE_GREEN = 0.85;
const CONFIDENCE_YELLOW = 0.7;

function confidenceColor(score: number | undefined): string {
  if (score === undefined) return "var(--text-tertiary)";
  if (score >= CONFIDENCE_GREEN) return "var(--nw-success)";
  if (score >= CONFIDENCE_YELLOW) return "var(--nw-warning)";
  return "var(--nw-danger)";
}

function ConfidenceDot({ score, title }: { score: number | undefined; title?: string }) {
  return (
    <span
      title={title ?? (score !== undefined ? `${(score * 100).toFixed(0)}%` : "no score")}
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: confidenceColor(score),
        marginLeft: 6,
      }}
    />
  );
}

// Convert dollars (form input) to integer cents for state. Mirrors the
// normalization in src/lib/ingestion/extract-proposal.ts dollarsToCents
// — kept inline here so the form doesn't import a server-only module.
function dollarsToCents(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function centsToDollars(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toFixed(2);
}

export default function ReviewManager(props: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ProposalForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<
    null | "save" | "convert_po" | "reject"
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestModal, setSuggestModal] = useState<SuggestModalState | null>(null);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [pendingSuggestions, setPendingSuggestions] = useState<
    PendingSuggestionOption[]
  >(props.pendingSuggestions);

  // Load extraction on mount. /api/proposals/extract is idempotent —
  // re-running on refresh just re-fetches the cached AI response.
  useEffect(() => {
    let cancelled = false;
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
        const json = (await res.json()) as {
          extracted_data: {
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
            additional_fee_schedule: Array<{
              rate_type: string;
              description: string | null;
              rate_cents: number | null;
              unit: string | null;
            }> | null;
            payment_schedule: Array<{
              milestone: string;
              percentage_pct: number | null;
              amount_cents: number | null;
              trigger: string | null;
            }> | null;
            payment_terms: {
              net_days: number | null;
              late_interest_rate_pct: number | null;
              governing_law: string | null;
              other_terms_text: string | null;
            } | null;
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
          };
        };
        if (cancelled) return;
        const ed = json.extracted_data;
        setForm({
          vendor_name: ed.vendor_name,
          vendor_id: null,
          vendor_address: ed.vendor_address,
          proposal_number: ed.proposal_number,
          proposal_date: ed.proposal_date,
          valid_through: ed.valid_through,
          job_id: null,
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
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.extraction.id]);

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
      if (code) return { kind: "org", org_cost_code_id: id, code: code.code, name: code.name };
    }
    if (kind === "legacy") {
      const code = props.legacyCostCodes.find((c) => c.id === id);
      if (code) return { kind: "legacy", cost_code_id: id, code: code.code, description: code.description };
    }
    if (kind === "pending") {
      const sugg = pendingSuggestions.find((s) => s.id === id);
      if (sugg) return { kind: "pending", suggestion_id: id, suggested_code: sugg.suggested_code, suggested_name: sugg.suggested_name };
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
      // Auto-pick the new suggestion on the line that triggered the modal
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
        const poRes = await fetch(`/api/proposals/${json.proposal_id}/convert-to-po`, {
          method: "POST",
        });
        // Phase 3.5 stub returns 501 — treat as a soft signal the proposal
        // was saved but PO generation isn't ready yet.
        if (poRes.status === 501) {
          alert(
            "Proposal saved. Convert to PO will be available once Phase 3.5 ships."
          );
        } else if (!poRes.ok) {
          const body = await poRes.json().catch(() => ({}));
          throw new Error(body.error || `Convert to PO failed: HTTP ${poRes.status}`);
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
    if (!confirm("Mark this extraction rejected? It will not commit a proposal.")) return;
    setActionBusy("reject");
    setError(null);
    try {
      const res = await fetch(`/api/proposals/extract/${props.extraction.id}/reject`, {
        method: "POST",
      });
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

  if (loading) {
    return (
      <AppShell>
        <div className="px-6 py-8">
          <p className="text-sm text-[color:var(--text-secondary)]">
            Loading proposal extraction...
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

  const overallConf = form.confidence_score;

  return (
    <AppShell>
      <div className="px-6 py-6 space-y-6">
        {/* Header bar with action buttons */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <NwEyebrow tone="accent">Proposal review</NwEyebrow>
            <h1 className="mt-1 text-xl font-semibold text-[color:var(--text-primary)]">
              {form.title}
              <ConfidenceDot
                score={overallConf}
                title={`Overall confidence ${(overallConf * 100).toFixed(0)}%`}
              />
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
          <div className="flex gap-2">
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
          <div className="rounded border border-[var(--nw-danger)] bg-[var(--nw-danger)]/10 px-3 py-2 text-sm text-[color:var(--nw-danger)]">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* PDF preview */}
          <div className="rounded border border-[var(--border-default)] bg-[var(--bg-card)]">
            <div className="border-b border-[var(--border-default)] px-3 py-2">
              <NwEyebrow tone="muted">Original PDF</NwEyebrow>
            </div>
            {props.pdfSignedUrl ? (
              <iframe
                src={props.pdfSignedUrl}
                title="Proposal PDF preview"
                className="w-full"
                style={{ height: "calc(100vh - 240px)", minHeight: 560 }}
              />
            ) : (
              <div className="px-3 py-8 text-sm text-[color:var(--text-tertiary)]">
                No PDF preview available.
              </div>
            )}
          </div>

          {/* Form */}
          <div className="space-y-4">
            <section className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-3">
              <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">
                Header
              </h2>

              <FormField
                label="Vendor (extracted)"
                conf={form.confidence_details.vendor_name}
              >
                <input
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                  value={form.vendor_name}
                  onChange={(e) => updateForm({ vendor_name: e.target.value })}
                />
              </FormField>

              <FormField label="Match to vendor in your registry">
                <select
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                  value={form.vendor_id ?? ""}
                  onChange={(e) =>
                    updateForm({ vendor_id: e.target.value || null })
                  }
                >
                  <option value="">— pick vendor —</option>
                  {props.vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Job">
                <select
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                  value={form.job_id ?? ""}
                  onChange={(e) => updateForm({ job_id: e.target.value || null })}
                >
                  <option value="">— pick job —</option>
                  {props.jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name}
                      {j.client_name ? ` (${j.client_name})` : ""}
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Proposal number">
                  <input
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                    value={form.proposal_number ?? ""}
                    onChange={(e) =>
                      updateForm({ proposal_number: e.target.value || null })
                    }
                    placeholder="(none)"
                  />
                </FormField>
                <FormField label="Total" conf={form.confidence_details.total_amount}>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                    value={centsToDollars(form.total_cents)}
                    onChange={(e) => {
                      const cents = dollarsToCents(e.target.value);
                      updateForm({ total_cents: cents ?? 0 });
                    }}
                  />
                </FormField>
                <FormField label="Proposal date">
                  <input
                    type="date"
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                    value={form.proposal_date ?? ""}
                    onChange={(e) =>
                      updateForm({ proposal_date: e.target.value || null })
                    }
                  />
                </FormField>
                <FormField label="Valid through">
                  <input
                    type="date"
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                    value={form.valid_through ?? ""}
                    onChange={(e) =>
                      updateForm({ valid_through: e.target.value || null })
                    }
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Vendor-stated start date (only if explicit)">
                  <input
                    type="date"
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                    value={form.vendor_stated_start_date ?? ""}
                    onChange={(e) =>
                      updateForm({ vendor_stated_start_date: e.target.value || null })
                    }
                  />
                </FormField>
                <FormField label="Vendor-stated duration (days)">
                  <input
                    type="number"
                    className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                    value={form.vendor_stated_duration_days ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      updateForm({
                        vendor_stated_duration_days: Number.isFinite(v) ? (v as number) : null,
                      });
                    }}
                  />
                </FormField>
              </div>
            </section>

            <section className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-3">
              <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">
                Scope
              </h2>

              <FormField label="Scope summary">
                <textarea
                  rows={3}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                  value={form.scope_summary}
                  onChange={(e) => updateForm({ scope_summary: e.target.value })}
                />
              </FormField>
              <FormField label="Inclusions (only if explicit on proposal)">
                <textarea
                  rows={3}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                  value={form.inclusions ?? ""}
                  onChange={(e) =>
                    updateForm({ inclusions: e.target.value || null })
                  }
                />
              </FormField>
              <FormField label="Exclusions (only if explicit on proposal)">
                <textarea
                  rows={3}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                  value={form.exclusions ?? ""}
                  onChange={(e) =>
                    updateForm({ exclusions: e.target.value || null })
                  }
                />
              </FormField>
              <FormField label="Notes">
                <textarea
                  rows={2}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                  value={form.notes ?? ""}
                  onChange={(e) => updateForm({ notes: e.target.value || null })}
                />
              </FormField>
            </section>

            <FeeScheduleSection
              entries={form.additional_fee_schedule}
              onChange={(next) => updateForm({ additional_fee_schedule: next })}
            />

            <PaymentScheduleSection
              entries={form.payment_schedule}
              onChange={(next) => updateForm({ payment_schedule: next })}
            />

            <PaymentTermsSection
              terms={form.payment_terms}
              onChange={(next) => updateForm({ payment_terms: next })}
            />

            <section className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">
                  Line items ({form.line_items.length})
                </h2>
                <span className="text-xs text-[color:var(--text-tertiary)]">
                  Total{" "}
                  <Money
                    cents={form.total_cents}
                    variant="emphasized"
                    size="md"
                  />
                </span>
              </div>

              <div className="space-y-3">
                {form.line_items.map((li, idx) => (
                  <LineItemRow
                    key={idx}
                    line={li}
                    idx={idx}
                    confidence={form.confidence_details.line_items}
                    orgCostCodes={props.orgCostCodes}
                    legacyCostCodes={props.legacyCostCodes}
                    pendingSuggestions={pendingSuggestions}
                    onChange={(patch) => updateLine(idx, patch)}
                    onPickFromValue={(v) =>
                      updateLine(idx, { cost_code_pick: pickCostCodeFromValue(v) })
                    }
                    pickToValue={pickToValue}
                    onSuggestNew={() =>
                      setSuggestModal({
                        line_index: idx,
                        suggested_code: "",
                        suggested_name: li.ai_cost_code_suggestion ?? "",
                        rationale: "",
                      })
                    }
                  />
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Suggest-new-code modal */}
        {suggestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-md space-y-4 rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
              <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
                Suggest new cost code
              </h2>
              <p className="text-sm text-[color:var(--text-secondary)]">
                Owners and admins approve suggestions in{" "}
                <code>/cost-intelligence/suggestions</code>. Until approved, your
                proposal line will show as &ldquo;Pending&rdquo;.
              </p>
              <FormField label="Code (your team's format, e.g. R-STUC-001)">
                <input
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                  value={suggestModal.suggested_code}
                  onChange={(e) =>
                    setSuggestModal({ ...suggestModal, suggested_code: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Display name">
                <input
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                  value={suggestModal.suggested_name}
                  onChange={(e) =>
                    setSuggestModal({ ...suggestModal, suggested_name: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Why is this code needed? (optional)">
                <textarea
                  rows={2}
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                  value={suggestModal.rationale}
                  onChange={(e) =>
                    setSuggestModal({ ...suggestModal, rationale: e.target.value })
                  }
                />
              </FormField>
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
      </div>
    </AppShell>
  );
}

// ── helpers ─────────────────────────────────────────────────────

// Phase 3.4 Step 5e — collapsible fee schedule editor. Mirrors the
// extractor: null = "no fee table on this proposal", non-null array
// = explicit hourly/blended rate rows.
function FeeScheduleSection({
  entries,
  onChange,
}: {
  entries: FeeScheduleEntryForm[] | null;
  onChange: (next: FeeScheduleEntryForm[] | null) => void;
}) {
  const [open, setOpen] = useState(entries !== null && entries.length > 0);
  const list = entries ?? [];
  const addRow = () =>
    onChange([
      ...list,
      { rate_type: "", description: null, rate_cents: null, unit: null },
    ]);
  const removeRow = (idx: number) => {
    const next = list.slice();
    next.splice(idx, 1);
    onChange(next.length === 0 ? null : next);
  };
  const updateRow = (idx: number, patch: Partial<FeeScheduleEntryForm>) => {
    const next = list.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  return (
    <section className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="text-sm font-semibold text-[color:var(--text-primary)] hover:underline"
        >
          {open ? "▼" : "▶"} Additional fee schedule ({list.length})
        </button>
        {open && (
          <NwButton variant="ghost" size="sm" onClick={addRow}>
            + Add rate
          </NwButton>
        )}
      </div>
      {open && (
        <>
          {list.length === 0 ? (
            <p className="text-xs text-[color:var(--text-tertiary)]">
              No rate table extracted. Add a row if the proposal lists hourly or
              blended rates the vendor will bill at for additional services.
            </p>
          ) : (
            <div className="space-y-2">
              {list.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 rounded border border-[var(--border-default)] p-2"
                >
                  <div className="col-span-3">
                    <FormField label="Type">
                      <input
                        className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                        value={row.rate_type}
                        onChange={(e) =>
                          updateRow(idx, { rate_type: e.target.value })
                        }
                        placeholder="hourly"
                      />
                    </FormField>
                  </div>
                  <div className="col-span-4">
                    <FormField label="Description">
                      <input
                        className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                        value={row.description ?? ""}
                        onChange={(e) =>
                          updateRow(idx, { description: e.target.value || null })
                        }
                      />
                    </FormField>
                  </div>
                  <div className="col-span-2">
                    <FormField label="Rate">
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                        value={centsToDollars(row.rate_cents)}
                        onChange={(e) =>
                          updateRow(idx, {
                            rate_cents: dollarsToCents(e.target.value),
                          })
                        }
                      />
                    </FormField>
                  </div>
                  <div className="col-span-2">
                    <FormField label="Unit">
                      <input
                        className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                        value={row.unit ?? ""}
                        onChange={(e) =>
                          updateRow(idx, { unit: e.target.value || null })
                        }
                        placeholder="hr"
                      />
                    </FormField>
                  </div>
                  <div className="col-span-1 flex items-end">
                    <NwButton variant="ghost" size="sm" onClick={() => removeRow(idx)}>
                      ✕
                    </NwButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// Phase 3.4 Step 5e — collapsible payment schedule editor. Mirrors
// extractor: null = "single payment / no milestones", non-null = list
// of milestone entries with percentage_pct OR amount_cents (or both).
function PaymentScheduleSection({
  entries,
  onChange,
}: {
  entries: PaymentScheduleEntryForm[] | null;
  onChange: (next: PaymentScheduleEntryForm[] | null) => void;
}) {
  const [open, setOpen] = useState(entries !== null && entries.length > 0);
  const list = entries ?? [];
  const addRow = () =>
    onChange([
      ...list,
      { milestone: "", percentage_pct: null, amount_cents: null, trigger: null },
    ]);
  const removeRow = (idx: number) => {
    const next = list.slice();
    next.splice(idx, 1);
    onChange(next.length === 0 ? null : next);
  };
  const updateRow = (idx: number, patch: Partial<PaymentScheduleEntryForm>) => {
    const next = list.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  return (
    <section className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="text-sm font-semibold text-[color:var(--text-primary)] hover:underline"
        >
          {open ? "▼" : "▶"} Payment schedule ({list.length})
        </button>
        {open && (
          <NwButton variant="ghost" size="sm" onClick={addRow}>
            + Add milestone
          </NwButton>
        )}
      </div>
      {open && (
        <>
          {list.length === 0 ? (
            <p className="text-xs text-[color:var(--text-tertiary)]">
              No milestones extracted. Add a row if the proposal specifies
              multi-step billing (e.g., 50% deposit + 50% on completion).
            </p>
          ) : (
            <div className="space-y-2">
              {list.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 rounded border border-[var(--border-default)] p-2"
                >
                  <div className="col-span-3">
                    <FormField label="Milestone">
                      <input
                        className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                        value={row.milestone}
                        onChange={(e) =>
                          updateRow(idx, { milestone: e.target.value })
                        }
                        placeholder="deposit"
                      />
                    </FormField>
                  </div>
                  <div className="col-span-2">
                    <FormField label="%">
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                        value={row.percentage_pct ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          updateRow(idx, {
                            percentage_pct: Number.isFinite(v) ? (v as number) : null,
                          });
                        }}
                      />
                    </FormField>
                  </div>
                  <div className="col-span-2">
                    <FormField label="Amount">
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                        value={centsToDollars(row.amount_cents)}
                        onChange={(e) =>
                          updateRow(idx, {
                            amount_cents: dollarsToCents(e.target.value),
                          })
                        }
                      />
                    </FormField>
                  </div>
                  <div className="col-span-4">
                    <FormField label="Trigger">
                      <input
                        className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                        value={row.trigger ?? ""}
                        onChange={(e) =>
                          updateRow(idx, { trigger: e.target.value || null })
                        }
                        placeholder="upon contract signing"
                      />
                    </FormField>
                  </div>
                  <div className="col-span-1 flex items-end">
                    <NwButton variant="ghost" size="sm" onClick={() => removeRow(idx)}>
                      ✕
                    </NwButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// Phase 3.4 Step 5e — payment terms key-value display. Single object
// (not a list). Null = "no terms section on the proposal". Form
// initializes from extracted terms; PMs can fill in any sub-field.
function PaymentTermsSection({
  terms,
  onChange,
}: {
  terms: PaymentTermsForm | null;
  onChange: (next: PaymentTermsForm | null) => void;
}) {
  const t = terms ?? {
    net_days: null,
    late_interest_rate_pct: null,
    governing_law: null,
    other_terms_text: null,
  };
  const updateField = (patch: Partial<PaymentTermsForm>) => {
    const merged = { ...t, ...patch };
    const allNull =
      merged.net_days === null &&
      merged.late_interest_rate_pct === null &&
      merged.governing_law === null &&
      merged.other_terms_text === null;
    onChange(allNull ? null : merged);
  };

  return (
    <section className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-3">
      <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">
        Payment terms
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Net days">
          <input
            type="number"
            className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
            value={t.net_days ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              updateField({ net_days: Number.isFinite(v) ? (v as number) : null });
            }}
            placeholder="30"
          />
        </FormField>
        <FormField label="Late interest rate (%)">
          <input
            type="number"
            step="0.01"
            className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
            value={t.late_interest_rate_pct ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              updateField({
                late_interest_rate_pct: Number.isFinite(v) ? (v as number) : null,
              });
            }}
            placeholder="1.5"
          />
        </FormField>
      </div>
      <FormField label="Governing law">
        <input
          className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
          value={t.governing_law ?? ""}
          onChange={(e) =>
            updateField({ governing_law: e.target.value || null })
          }
          placeholder="Florida law"
        />
      </FormField>
      <FormField label="Other terms text">
        <textarea
          rows={3}
          className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
          value={t.other_terms_text ?? ""}
          onChange={(e) =>
            updateField({ other_terms_text: e.target.value || null })
          }
          placeholder="Retainage, lien-release requirements, deposit refundability..."
        />
      </FormField>
    </section>
  );
}

function FormField({
  label,
  conf,
  children,
}: {
  label: string;
  conf?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center text-[11px] uppercase tracking-[0.12em] text-[color:var(--text-tertiary)]">
        {label}
        {conf !== undefined && <ConfidenceDot score={conf} />}
      </label>
      {children}
    </div>
  );
}

interface LineItemRowProps {
  line: ProposalLineItemForm;
  idx: number;
  confidence: number | undefined;
  orgCostCodes: OrgCostCodeOption[];
  legacyCostCodes: LegacyCostCodeOption[];
  pendingSuggestions: PendingSuggestionOption[];
  onChange: (patch: Partial<ProposalLineItemForm>) => void;
  onPickFromValue: (value: string) => void;
  pickToValue: (pick: CostCodePick) => string;
  onSuggestNew: () => void;
}

function LineItemRow(props: LineItemRowProps) {
  const { line, confidence } = props;
  const [showBreakdown, setShowBreakdown] = useState(false);
  const pickValue = props.pickToValue(line.cost_code_pick);

  return (
    <div className="rounded border border-[var(--border-default)] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[color:var(--text-tertiary)]">
          Line {line.line_number}
          <ConfidenceDot score={confidence} />
        </span>
        {line.cost_code_pick.kind === "pending" && (
          <NwBadge variant="warning" size="sm">
            Pending: {line.cost_code_pick.suggested_code}
          </NwBadge>
        )}
      </div>
      <FormField label="Description (verbatim)">
        <textarea
          rows={2}
          className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
          value={line.description}
          onChange={(e) => props.onChange({ description: e.target.value })}
        />
      </FormField>
      <FormField label="Description (AI-normalized — feeds embedding)">
        <input
          className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
          value={line.description_normalized ?? ""}
          onChange={(e) =>
            props.onChange({ description_normalized: e.target.value || null })
          }
          placeholder="(none)"
        />
      </FormField>
      <div className="grid grid-cols-4 gap-2">
        <FormField label="Qty">
          <input
            type="number"
            step="0.01"
            className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
            value={line.quantity ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              props.onChange({ quantity: Number.isFinite(v) ? (v as number) : null });
            }}
          />
        </FormField>
        <FormField label="UoM">
          <input
            className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
            value={line.unit_of_measure ?? ""}
            onChange={(e) =>
              props.onChange({ unit_of_measure: e.target.value || null })
            }
            placeholder="EA, LF, SF..."
          />
        </FormField>
        <FormField label="Unit price">
          <input
            type="number"
            step="0.01"
            className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
            value={centsToDollars(line.unit_price_cents)}
            onChange={(e) =>
              props.onChange({ unit_price_cents: dollarsToCents(e.target.value) })
            }
          />
        </FormField>
        <FormField label="Amount">
          <input
            type="number"
            step="0.01"
            className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
            value={centsToDollars(line.total_price_cents)}
            onChange={(e) =>
              props.onChange({
                total_price_cents: dollarsToCents(e.target.value) ?? 0,
              })
            }
          />
        </FormField>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <FormField label="Cost code">
            <select
              className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
              value={pickValue}
              onChange={(e) => props.onPickFromValue(e.target.value)}
            >
              <option value="">— pick code —</option>
              {props.orgCostCodes.length > 0 && (
                <optgroup label="[New] Org codes (Phase 3.3)">
                  {props.orgCostCodes.map((c) => (
                    <option key={c.id} value={`org:${c.id}`}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {props.legacyCostCodes.length > 0 && (
                <optgroup label="[Legacy] Cost codes (Phase 1)">
                  {props.legacyCostCodes.map((c) => (
                    <option key={c.id} value={`legacy:${c.id}`}>
                      {c.code} — {c.description}
                    </option>
                  ))}
                </optgroup>
              )}
              {props.pendingSuggestions.length > 0 && (
                <optgroup label="[Pending] Suggested by you / your team">
                  {props.pendingSuggestions.map((s) => (
                    <option key={s.id} value={`pending:${s.id}`}>
                      {s.suggested_code} — {s.suggested_name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </FormField>
          {line.ai_cost_code_suggestion && (
            <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
              AI suggestion: {line.ai_cost_code_suggestion}
            </p>
          )}
        </div>
        <NwButton variant="ghost" size="sm" onClick={props.onSuggestNew}>
          Suggest new
        </NwButton>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowBreakdown((s) => !s)}
          className="text-xs text-[color:var(--text-secondary)] underline"
        >
          {showBreakdown ? "Hide" : "Show"} cost breakdown
        </button>
        {showBreakdown && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(
              [
                ["material_cost_cents", "Material"],
                ["labor_cost_cents", "Labor"],
                ["subcontract_cost_cents", "Subcontract"],
                ["tax_cents", "Tax"],
                ["delivery_cents", "Delivery"],
                ["notes_cents", "Other / notes"],
              ] as const
            ).map(([key, label]) => (
              <FormField key={key} label={label}>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
                  value={centsToDollars(line[key])}
                  onChange={(e) =>
                    props.onChange({ [key]: dollarsToCents(e.target.value) } as Partial<ProposalLineItemForm>)
                  }
                  placeholder="(null = not on proposal)"
                />
              </FormField>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
