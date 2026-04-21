"use client";

import { useCallback, useEffect, useState } from "react";
import NwButton from "@/components/nw/Button";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwBadge from "@/components/nw/Badge";
import { toast } from "@/lib/utils/toast";

interface SampleRow {
  id: string;
  raw_description: string;
  proposed_canonical_name: string | null;
  proposed_type: string | null;
  proposed_unit: string | null;
  classification_confidence: number | null;
}

interface OrgOption {
  id: string;
  name: string;
  pending_count: number;
}

interface DryRunResult {
  eligible_count: number;
  would_commit_count: number;
  confidence_distribution: { high: number; med: number; low: number };
  sample: SampleRow[];
}

export default function BootstrapAliasesPanel({ orgs }: { orgs: OrgOption[] }) {
  const [orgId, setOrgId] = useState<string>(orgs[0]?.id ?? "");
  const [threshold, setThreshold] = useState<number>(0.3);
  const [preview, setPreview] = useState<DryRunResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Preview auto-refreshes when org or threshold changes (debounced).
  useEffect(() => {
    setPreview(null);
  }, [orgId, threshold]);

  const runPreview = useCallback(async () => {
    if (!orgId) return;
    setPreviewing(true);
    try {
      const res = await fetch("/api/admin/platform/cost-intelligence/bootstrap-aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, dry_run: true, confidence_min: threshold }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(`Preview failed: ${json.error ?? res.status}`);
        return;
      }
      setPreview(json as DryRunResult);
    } catch (err) {
      toast.error(`Preview failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setPreviewing(false);
    }
  }, [orgId, threshold]);

  const execute = useCallback(async () => {
    if (!orgId || !preview) return;
    const confirmed = confirm(
      `Bootstrap ${preview.would_commit_count} items + aliases for this org at ≥${Math.round(
        threshold * 100
      )}% classification confidence?\n\nThis creates items + pricing rows without per-line human review.`
    );
    if (!confirmed) return;
    setExecuting(true);
    try {
      const res = await fetch("/api/admin/platform/cost-intelligence/bootstrap-aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, dry_run: false, confidence_min: threshold }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(`Execute failed: ${json.error ?? res.status}`);
        return;
      }
      toast.success(
        `Bootstrapped ${json.committed}/${json.eligible_count} lines${
          json.failed ? ` · ${json.failed} failed` : ""
        }`
      );
      setPreview(null);
    } catch (err) {
      toast.error(`Execute failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setExecuting(false);
    }
  }, [orgId, preview, threshold]);

  return (
    <div className="space-y-5">
      <div>
        <NwEyebrow tone="accent">Platform Admin · Bootstrap</NwEyebrow>
        <h2
          className="mt-1 text-[20px] tracking-[-0.02em] text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          Bootstrap alias library
        </h2>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)] max-w-[680px]">
          Bulk-commit pending <code>ai_new_item</code> lines to the spine so Tier 1/2 matching
          (alias + trigram) starts firing on future invoices. Use once per tenant to seed the
          catalog; ongoing verification happens in the normal queue.
        </p>
        <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
          Skips transaction lines, overhead lines, and lines below the chosen classification
          confidence. Creates items + pricing rows with <code>auto_committed=true</code> so a
          future reviewer can still inspect them.
        </p>
      </div>

      {/* Controls */}
      <div className="border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              className="block text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] mb-1"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              Organization
            </label>
            <select
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="w-full px-3 h-[36px] border border-[var(--border-default)] bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)]"
            >
              {orgs.length === 0 && <option value="">No orgs with pending lines</option>}
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.pending_count} pending)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              className="block text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] mb-1"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              Classification confidence threshold ·{" "}
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {Math.round(threshold * 100)}%
              </span>
            </label>
            <input
              type="range"
              min="0.2"
              max="0.8"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full"
            />
            <div
              className="mt-1 flex justify-between text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              <span>20% · more lines, more noise</span>
              <span>80% · fewer lines, safer</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NwButton variant="secondary" size="sm" onClick={runPreview} loading={previewing} disabled={!orgId}>
            Preview (dry run)
          </NwButton>
          <NwButton
            variant="primary"
            size="sm"
            onClick={execute}
            loading={executing}
            disabled={!preview || preview.would_commit_count === 0 || executing}
          >
            Bootstrap {preview ? `${preview.would_commit_count} items` : ""}
          </NwButton>
        </div>
      </div>

      {/* Preview results */}
      {preview && (
        <div className="border border-[var(--border-default)] bg-[var(--bg-card)]">
          <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between gap-3">
            <NwEyebrow tone="muted">Dry run · {preview.eligible_count} eligible lines</NwEyebrow>
            <div className="flex items-center gap-2 text-[11px]">
              <NwBadge variant="success" size="sm">
                ≥70% {preview.confidence_distribution.high}
              </NwBadge>
              <NwBadge variant="accent" size="sm">
                50-70% {preview.confidence_distribution.med}
              </NwBadge>
              <NwBadge variant="warning" size="sm">
                &lt;50% {preview.confidence_distribution.low}
              </NwBadge>
            </div>
          </div>
          {preview.sample.length === 0 ? (
            <p className="p-4 text-[13px] text-[var(--text-tertiary)]">
              No pending ai_new_item lines meet the current threshold. Lower the threshold or
              confirm there are actually pending lines for this org.
            </p>
          ) : (
            <table className="w-full text-[12px]">
              <thead
                className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
                style={{ fontFamily: "var(--font-jetbrains-mono)" }}
              >
                <tr className="border-b border-[var(--border-default)]">
                  <th className="text-left px-3 py-2 font-medium">Raw line</th>
                  <th className="text-left px-3 py-2 font-medium">Would become</th>
                  <th className="text-left px-3 py-2 font-medium">Type / unit</th>
                  <th className="text-right px-3 py-2 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--border-default)] last:border-b-0">
                    <td
                      className="px-3 py-2 text-[var(--text-primary)] max-w-[280px] truncate"
                      style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                      title={r.raw_description}
                    >
                      {r.raw_description}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-primary)]">
                      {r.proposed_canonical_name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-tertiary)]">
                      {r.proposed_type ?? "—"}
                      {r.proposed_unit ? ` · ${r.proposed_unit}` : ""}
                    </td>
                    <td
                      className="px-3 py-2 text-right"
                      style={{
                        fontFamily: "var(--font-jetbrains-mono)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {r.classification_confidence != null
                        ? `${Math.round(r.classification_confidence * 100)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {preview.sample.length < preview.eligible_count && (
            <p
              className="px-4 py-2 text-[11px] text-[var(--text-tertiary)] border-t border-[var(--border-default)]"
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              Showing first {preview.sample.length} of {preview.eligible_count} eligible lines.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
