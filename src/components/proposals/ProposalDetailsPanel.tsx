"use client";

import { Textarea } from "@/components/ui/textarea";
import type {
  JobOption,
  VendorOption,
} from "@/app/proposals/review/[extraction_id]/page";

/**
 * Phase 3.4 Issue 2 — proposal review right-rail panel.
 *
 * Mirrors the invoice review's `InvoiceDetailsPanel` shape: metadata
 * grid + extraction summary + scope content. Per Jake's prompt 205,
 * scope sections (summary, inclusions, exclusions, notes) live here
 * rather than below the hero so the right rail is balanced against
 * a tall PDF preview on the left, AND so document-identity content
 * is grouped together.
 *
 * Differences from InvoiceDetailsPanel:
 *   - No status timeline yet (proposals have no status_history pre-
 *     commit). Replaced with an "Extraction metadata" block (model,
 *     prompt version, extracted at) and a re-extract action. When
 *     the committed-proposal view ships, swap in the timeline using
 *     the same component shape per Q1.
 *   - No allocations editor (line items carry their cost codes
 *     inline, per Risk 6).
 *   - Action buttons stay in the action strip above the hero
 *     (per Q2 — codebase precedent over the original memo).
 *
 * Self-contained: declares its own form-slice interface + private
 * Field/Eyebrow helpers. No dependency on the orchestrator.
 */

export interface ProposalDetailsPanelForm {
  vendor_name: string;
  vendor_id: string | null;
  job_id: string | null;
  job_address: string | null;
  proposal_number: string | null;
  proposal_date: string | null;
  valid_through: string | null;
  total_cents: number;
  vendor_stated_start_date: string | null;
  vendor_stated_duration_days: number | null;
  scope_summary: string;
  inclusions: string | null;
  exclusions: string | null;
  notes: string | null;
  confidence_details: Record<string, number>;
  flags: string[];
}

interface Props {
  form: ProposalDetailsPanelForm;
  onChange: (patch: Partial<ProposalDetailsPanelForm>) => void;
  vendors: VendorOption[];
  jobs: JobOption[];
  /** Extraction metadata (read from document_extractions row, not editable). */
  aiModelUsed: string | null;
  extractionPromptVersion: string | null;
  extractedAt: string | null;
  /** Bust the cache and re-extract via ?force=true. Parent owns the fetch. */
  onReExtract: () => void;
  reExtractBusy: boolean;
}

export default function ProposalDetailsPanel({
  form,
  onChange,
  vendors,
  jobs,
  aiModelUsed,
  extractionPromptVersion,
  extractedAt,
  onReExtract,
  reExtractBusy,
}: Props) {
  const handleReExtract = () => {
    if (reExtractBusy) return;
    const ok = window.confirm(
      "Re-extract will discard your pending edits and re-run AI extraction on the source PDF (~$0.30, ~30 seconds). Continue?"
    );
    if (ok) onReExtract();
  };

  return (
    <div className="p-[22px] space-y-5" style={{ background: "var(--bg-card)" }}>
      {/* ── Document identity ── */}
      <div>
        <h3
          className="m-0 mb-0.5"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            fontSize: "15px",
            color: "var(--text-primary)",
          }}
        >
          Proposal details
        </h3>
        <Eyebrow>Document identity · editable by PM</Eyebrow>
      </div>

      <div className="grid grid-cols-2 gap-x-5 gap-y-[14px]">
        <Field label="Total amount" full>
          <input
            type="number"
            step="0.01"
            value={centsToDollars(form.total_cents)}
            onChange={(e) => {
              const cents = dollarsToCents(e.target.value);
              onChange({ total_cents: cents ?? 0 });
            }}
            className="w-full bg-[var(--bg-subtle)] border border-[var(--border-default)] px-2 py-1 text-[18px] font-medium text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
            style={{ fontFamily: "var(--font-display)", fontVariantNumeric: "tabular-nums" }}
          />
        </Field>

        <Field label="Vendor (extracted)" full>
          <input
            type="text"
            value={form.vendor_name}
            onChange={(e) => onChange({ vendor_name: e.target.value })}
            className="w-full bg-[var(--bg-subtle)] border border-[var(--border-default)] px-2 py-1 text-[13px] text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
          />
        </Field>

        <Field label="Match to vendor" full>
          <select
            value={form.vendor_id ?? ""}
            onChange={(e) => onChange({ vendor_id: e.target.value || null })}
            className="w-full bg-[var(--bg-subtle)] border border-[var(--border-default)] px-2 py-1 text-[13px] text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
          >
            <option value="">— pick vendor —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Job" full>
          <select
            value={form.job_id ?? ""}
            onChange={(e) => onChange({ job_id: e.target.value || null })}
            className="w-full bg-[var(--bg-subtle)] border border-[var(--border-default)] px-2 py-1 text-[13px] text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
          >
            <option value="">— pick job —</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
                {j.client_name ? ` (${j.client_name})` : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Job address (extracted)" full>
          <input
            type="text"
            value={form.job_address ?? ""}
            onChange={(e) => onChange({ job_address: e.target.value || null })}
            placeholder="(none extracted — vendor proposal had no project address)"
            className="w-full bg-[var(--bg-subtle)] border border-[var(--border-default)] px-2 py-1 text-[13px] text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
          />
        </Field>

        <Field label="Proposal #">
          <input
            type="text"
            value={form.proposal_number ?? ""}
            onChange={(e) => onChange({ proposal_number: e.target.value || null })}
            placeholder="(none)"
            className="w-full bg-[var(--bg-subtle)] border border-[var(--border-default)] px-2 py-1 text-[13px] text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
          />
        </Field>

        <Field label="Proposal date">
          <input
            type="date"
            value={form.proposal_date ?? ""}
            onChange={(e) => onChange({ proposal_date: e.target.value || null })}
            className="w-full bg-[var(--bg-subtle)] border border-[var(--border-default)] px-2 py-1 text-[13px] text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
          />
        </Field>

        <Field label="Valid through">
          <input
            type="date"
            value={form.valid_through ?? ""}
            onChange={(e) => onChange({ valid_through: e.target.value || null })}
            className="w-full bg-[var(--bg-subtle)] border border-[var(--border-default)] px-2 py-1 text-[13px] text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
          />
        </Field>

        <Field label="Vendor-stated start">
          <input
            type="date"
            value={form.vendor_stated_start_date ?? ""}
            onChange={(e) =>
              onChange({ vendor_stated_start_date: e.target.value || null })
            }
            className="w-full bg-[var(--bg-subtle)] border border-[var(--border-default)] px-2 py-1 text-[13px] text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
          />
        </Field>

        <Field label="Vendor-stated duration (days)">
          <input
            type="number"
            value={form.vendor_stated_duration_days ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              onChange({
                vendor_stated_duration_days: Number.isFinite(v)
                  ? (v as number)
                  : null,
              });
            }}
            className="w-full bg-[var(--bg-subtle)] border border-[var(--border-default)] px-2 py-1 text-[13px] text-[color:var(--text-primary)] focus:border-[var(--nw-stone-blue)] focus:outline-none"
          />
        </Field>
      </div>

      {/* ── Extraction metadata ── */}
      <div
        className="p-[14px]"
        style={{
          background: "rgba(91,134,153,0.08)",
          border: "1px solid rgba(91,134,153,0.3)",
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--nw-stone-blue)",
              fontWeight: 500,
            }}
          >
            Extraction metadata · {aiModelUsed ?? "Claude"}
          </span>
          <button
            type="button"
            onClick={handleReExtract}
            disabled={reExtractBusy}
            title="Re-run AI extraction on the source PDF (~$0.30, ~30s)"
            className="text-[10px] uppercase tracking-[0.1em] font-mono text-[color:var(--nw-stone-blue)] hover:underline disabled:opacity-50"
          >
            {reExtractBusy ? "Re-extracting…" : "↻ Re-extract"}
          </button>
        </div>
        <dl className="text-[12px] text-[color:var(--text-primary)] space-y-1">
          <MetaRow label="Prompt version" value={extractionPromptVersion} />
          <MetaRow label="Extracted at" value={formatStamp(extractedAt)} />
          {form.flags.length > 0 && (
            <MetaRow
              label="Flags"
              value={form.flags.join(", ")}
              tone="warn"
            />
          )}
        </dl>
      </div>

      {/* ── Scope content ── */}
      <div>
        <h3
          className="m-0 mb-0.5"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            fontSize: "15px",
            color: "var(--text-primary)",
          }}
        >
          Scope
        </h3>
        <Eyebrow>Vendor&rsquo;s stated work · editable by PM</Eyebrow>
      </div>

      <div className="space-y-3">
        <Field label="Summary" full>
          <Textarea
            minRows={4}
            value={form.scope_summary}
            onChange={(e) => onChange({ scope_summary: e.target.value })}
          />
        </Field>
        <Field label="Inclusions (only if explicit)" full>
          <Textarea
            minRows={3}
            value={form.inclusions ?? ""}
            onChange={(e) => onChange({ inclusions: e.target.value || null })}
          />
        </Field>
        <Field label="Exclusions (only if explicit)" full>
          <Textarea
            minRows={3}
            value={form.exclusions ?? ""}
            onChange={(e) => onChange({ exclusions: e.target.value || null })}
          />
        </Field>
        <Field label="Notes" full>
          <Textarea
            minRows={2}
            value={form.notes ?? ""}
            onChange={(e) => onChange({ notes: e.target.value || null })}
          />
        </Field>
      </div>
    </div>
  );
}

// ── Private helpers ───────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "9px",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--text-tertiary)",
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1 ${full ? "col-span-2" : ""}`}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function MetaRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | null;
  tone?: "warn";
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        {label}
      </dt>
      <dd
        className="text-right"
        style={{
          color: tone === "warn" ? "var(--nw-warn)" : "var(--text-primary)",
        }}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

function centsToDollars(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toFixed(2);
}

function dollarsToCents(dollars: string): number | null {
  if (dollars === "") return null;
  const n = Number(dollars);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function formatStamp(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${month} ${day} · ${hh}:${mm}`;
}
