"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import NwEyebrow from "@/components/nw/Eyebrow";
import NwButton from "@/components/nw/Button";
import NwMoney from "@/components/nw/Money";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/lib/utils/toast";

type AttachmentSource = "ai_auto" | "ai_suggested" | "manual";
type ConfirmationStatus = "pending" | "confirmed" | "rejected";

interface AttachmentRow {
  id: string;
  bom_extraction_line_id: string;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  attachment_source: AttachmentSource;
  confirmation_status: ConfirmationStatus;
  product_description: string | null;
  bom_line: {
    id: string;
    raw_description: string;
    raw_total_cents: number | null;
  } | null;
}

interface UnattachedBomRow {
  id: string;
  raw_description: string;
  raw_total_cents: number | null;
}

interface Props {
  scopeLineId: string;
  extractionId: string;
}

/**
 * BOM section rendered inside the scope line's detail panel. Shows every
 * line_bom_attachments row tied to the scope line and lets the PM:
 *   - confirm a pending ai_suggested attachment
 *   - remove (soft-delete) any attachment — the $0 spec line goes back to
 *     the Review tab as 'unclassified'
 *   - attach a new $0 spec line from the same invoice via [+ Attach spec line]
 *
 * Attached BOMs render as metadata — never as queue rows and never as cost
 * components. The scope line's total still matches the invoice regardless
 * of whether the PM later splits material/labor (that's handled separately).
 */
export default function BomSection({ scopeLineId, extractionId }: Props) {
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [unattached, setUnattached] = useState<UnattachedBomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [{ data: attachData, error: attachErr }, { data: specData, error: specErr }] =
      await Promise.all([
        supabase
          .from("line_bom_attachments")
          .select(
            "id, bom_extraction_line_id, ai_confidence, ai_reasoning, attachment_source, confirmation_status, product_description, bom_line:invoice_extraction_lines!bom_extraction_line_id(id, raw_description, raw_total_cents)"
          )
          .eq("scope_extraction_line_id", scopeLineId)
          .is("deleted_at", null)
          .order("created_at", { ascending: true }),
        supabase
          .from("invoice_extraction_lines")
          .select("id, raw_description, raw_total_cents")
          .eq("extraction_id", extractionId)
          .in("line_nature", ["bom_spec", "unclassified"])
          .is("deleted_at", null)
          .order("line_order", { ascending: true }),
      ]);

    if (attachErr) {
      toast.error(`Load BOMs failed: ${attachErr.message}`);
    }
    if (specErr) {
      toast.error(`Load spec lines failed: ${specErr.message}`);
    }

    const loadedAttach = (attachData ?? []) as unknown as AttachmentRow[];
    setAttachments(loadedAttach);

    // Lines already attached (active or pending) should not appear as
    // attach-candidates. Build a blocklist from the attachments we just
    // loaded so the picker only shows truly unattached specs.
    const attachedIds = new Set(loadedAttach.map((a) => a.bom_extraction_line_id));
    const specs = (specData ?? []) as UnattachedBomRow[];
    setUnattached(specs.filter((s) => !attachedIds.has(s.id)));

    setLoading(false);
  }, [scopeLineId, extractionId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const confirm = async (attachmentId: string) => {
    setBusyId(attachmentId);
    try {
      const res = await fetch(
        `/api/cost-intelligence/bom-attachments/${attachmentId}/confirm`,
        { method: "POST" }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Status ${res.status}`);
      }
      toast.success("BOM confirmed");
      await fetchData();
    } catch (err) {
      toast.error(`Confirm failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (attachmentId: string) => {
    setBusyId(attachmentId);
    try {
      const res = await fetch(
        `/api/cost-intelligence/bom-attachments/${attachmentId}/reject`,
        { method: "POST" }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Status ${res.status}`);
      }
      toast.success("BOM removed");
      await fetchData();
    } catch (err) {
      toast.error(`Remove failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusyId(null);
    }
  };

  const attach = async (bomLineId: string) => {
    setBusyId(bomLineId);
    try {
      const res = await fetch(`/api/cost-intelligence/bom-attachments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope_line_id: scopeLineId, bom_line_id: bomLineId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Status ${res.status}`);
      }
      toast.success("BOM attached");
      setPicking(false);
      await fetchData();
    } catch (err) {
      toast.error(`Attach failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusyId(null);
    }
  };

  const headerNote = useMemo(() => {
    if (loading) return "Loading…";
    if (attachments.length === 0) return "Nothing attached. Use [+ Attach spec line] to add product details.";
    return `${attachments.length} spec${attachments.length === 1 ? "" : "s"} attached`;
  }, [attachments, loading]);

  return (
    <section className="border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <NwEyebrow tone="accent">Bill of Materials</NwEyebrow>
          <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
            What&rsquo;s included in this scope. {headerNote}
          </p>
        </div>
        <NwButton
          variant="ghost"
          size="sm"
          onClick={() => setPicking((v) => !v)}
          disabled={loading}
        >
          + Attach spec line
        </NwButton>
      </div>

      {picking && (
        <div className="border border-[var(--nw-stone-blue)]/40 bg-[color:var(--nw-stone-blue)]/5 p-3 space-y-2">
          <div
            className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            Unattached spec lines on this invoice
          </div>
          {unattached.length === 0 ? (
            <p className="text-[12px] text-[var(--text-tertiary)]">
              No $0 spec lines available. BOM lines are created automatically
              during extraction — or reclassify a line in the Review tab to
              make it attachable.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-default)]">
              {unattached.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-1.5">
                  <div
                    className="flex-1 min-w-0 text-[12px] text-[var(--text-primary)] truncate"
                    style={{ fontFamily: "var(--font-jetbrains-mono)" }}
                    title={s.raw_description}
                  >
                    {s.raw_description}
                  </div>
                  <div
                    className="text-[11px] text-[var(--text-tertiary)]"
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    <NwMoney cents={s.raw_total_cents} size="sm" />
                  </div>
                  <NwButton
                    variant="secondary"
                    size="sm"
                    onClick={() => attach(s.id)}
                    loading={busyId === s.id}
                  >
                    Attach
                  </NwButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {loading ? null : attachments.length === 0 ? null : (
        <ul className="border border-[var(--border-default)] divide-y divide-[var(--border-default)]">
          {attachments.map((a) => (
            <AttachmentRowView
              key={a.id}
              attachment={a}
              busy={busyId === a.id}
              onConfirm={() => confirm(a.id)}
              onRemove={() => remove(a.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AttachmentRowView({
  attachment,
  busy,
  onConfirm,
  onRemove,
}: {
  attachment: AttachmentRow;
  busy: boolean;
  onConfirm: () => void;
  onRemove: () => void;
}) {
  const label = attachment.product_description
    ? attachment.product_description
    : attachment.bom_line?.raw_description ?? "(no description)";

  const { badgeLabel, badgeColor } = deriveBadge(
    attachment.attachment_source,
    attachment.confirmation_status
  );

  const pending = attachment.confirmation_status === "pending";

  return (
    <li className="px-3 py-2 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div
          className="text-[13px] text-[var(--text-primary)] truncate"
          title={label}
        >
          {label}
        </div>
        {attachment.ai_reasoning && (
          <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)] truncate" title={attachment.ai_reasoning}>
            {attachment.ai_reasoning}
          </p>
        )}
        <span
          className={`inline-flex items-center mt-1 px-1.5 h-[18px] text-[10px] uppercase tracking-[0.14em] border ${badgeColor}`}
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          {badgeLabel}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {pending && (
          <NwButton variant="secondary" size="sm" onClick={onConfirm} loading={busy}>
            Confirm
          </NwButton>
        )}
        <NwButton variant="ghost" size="sm" onClick={onRemove} loading={busy}>
          Remove
        </NwButton>
      </div>
    </li>
  );
}

function deriveBadge(
  source: AttachmentSource,
  status: ConfirmationStatus
): { badgeLabel: string; badgeColor: string } {
  if (source === "manual") {
    return {
      badgeLabel: "Manual",
      badgeColor: "border-[var(--border-default)] text-[var(--text-tertiary)]",
    };
  }
  if (source === "ai_auto" || status === "confirmed") {
    return {
      badgeLabel: "AI · Confirmed",
      badgeColor: "border-[var(--nw-success)]/60 text-[var(--nw-success)]",
    };
  }
  return {
    badgeLabel: "AI · Review",
    badgeColor: "border-[var(--nw-warn)]/60 text-[var(--nw-warn)]",
  };
}
