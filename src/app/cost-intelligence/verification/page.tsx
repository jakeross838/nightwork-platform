"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/app-shell";
import NwEyebrow from "@/components/nw/Eyebrow";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/lib/utils/toast";
import VerificationTabs from "@/components/cost-intelligence/verification-tabs";
import VerificationQueue, {
  type QueueSelection,
} from "@/components/cost-intelligence/verification-queue";
import VerificationDetailPanel from "@/components/cost-intelligence/verification-detail-panel";
import {
  NATURE_BY_TAB,
  type LineNature,
  type QueueLine,
  type QueueTab,
} from "@/components/cost-intelligence/queue-types";
import type {
  ComponentSource,
  ComponentType,
  PricingModel,
  ProposedItemData,
  TransactionLineType,
} from "@/lib/cost-intelligence/types";

type LineQueryRow = {
  id: string;
  extraction_id: string;
  raw_description: string;
  raw_quantity: number | null;
  raw_unit_text: string | null;
  raw_unit_price_cents: number | null;
  raw_total_cents: number | null;
  match_tier: string | null;
  match_confidence: number | null;
  match_confidence_score: number | null;
  classification_confidence: number | null;
  match_reasoning: string | null;
  created_at: string;
  is_transaction_line: boolean;
  transaction_line_type: TransactionLineType | null;
  line_tax_cents: number | null;
  overhead_allocated_cents: number | null;
  proposed_item_id: string | null;
  proposed_item_data: ProposedItemData | null;
  proposed_item: { id: string; canonical_name: string } | null;
  proposed_pricing_model: PricingModel | null;
  proposed_scope_size_metric: string | null;
  extracted_scope_size_value: number | null;
  extracted_scope_size_confidence: number | null;
  extracted_scope_size_source: string | null;
  line_nature: LineNature | null;
  scope_split_into_components: boolean | null;
  scope_estimated_material_cents: number | null;
  invoice_extractions: {
    id: string;
    raw_ocr_text: string | null;
    invoices: {
      id: string;
      invoice_number: string | null;
      invoice_date: string | null;
      vendor_id: string | null;
      original_file_url: string | null;
      vendors: { name: string } | null;
    } | null;
  } | null;
};

type ComponentQueryRow = {
  id: string;
  invoice_extraction_line_id: string | null;
  component_type: ComponentType;
  amount_cents: number;
  source: ComponentSource;
  notes: string | null;
  quantity: number | null;
  unit: string | null;
  unit_rate_cents: number | null;
  display_order: number;
};

function VerificationPageInner() {
  const searchParams = useSearchParams();
  const invoiceFilter = searchParams.get("invoice_id");

  const [lines, setLines] = useState<QueueLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<QueueTab>("materials");
  const [selection, setSelection] = useState<QueueSelection | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    // bom_spec lines are filtered out of the main queue — they appear as
    // attached metadata on the scope line's detail panel, not as queue rows.
    let linesQ = supabase
      .from("invoice_extraction_lines")
      .select(
        "id, extraction_id, raw_description, raw_quantity, raw_unit_text, raw_unit_price_cents, raw_total_cents, match_tier, match_confidence, match_confidence_score, classification_confidence, match_reasoning, created_at, is_transaction_line, transaction_line_type, line_tax_cents, overhead_allocated_cents, proposed_item_id, proposed_item_data, proposed_pricing_model, proposed_scope_size_metric, extracted_scope_size_value, extracted_scope_size_confidence, extracted_scope_size_source, line_nature, scope_split_into_components, scope_estimated_material_cents, proposed_item:items!proposed_item_id(id, canonical_name), invoice_extractions!inner(id, raw_ocr_text, invoices!inner(id, invoice_number, invoice_date, vendor_id, original_file_url, vendors(name)))"
      )
      .eq("verification_status", "pending")
      .eq("is_allocated_overhead", false)
      .neq("line_nature", "bom_spec")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (invoiceFilter) {
      linesQ = linesQ.eq("invoice_extractions.invoice_id", invoiceFilter);
    }

    const { data: linesData, error: linesErr } = await linesQ;
    if (linesErr) {
      toast.error(`Load failed: ${linesErr.message}`);
      setLoading(false);
      return;
    }

    const rows = ((linesData ?? []) as unknown as LineQueryRow[]).filter(
      (r) => r.invoice_extractions?.invoices != null
    );
    const lineIds = rows.map((r) => r.id);

    // Fetch components for all lines in one query
    const componentsByLine = new Map<string, QueueLine["components"]>();
    if (lineIds.length > 0) {
      const { data: cmpData, error: cmpErr } = await supabase
        .from("line_cost_components")
        .select(
          "id, invoice_extraction_line_id, component_type, amount_cents, source, notes, quantity, unit, unit_rate_cents, display_order"
        )
        .in("invoice_extraction_line_id", lineIds)
        .is("deleted_at", null)
        .order("display_order", { ascending: true });

      if (cmpErr) {
        toast.error(`Load components failed: ${cmpErr.message}`);
      }

      const cmpRows = (cmpData ?? []) as ComponentQueryRow[];
      for (const c of cmpRows) {
        if (!c.invoice_extraction_line_id) continue;
        const list = componentsByLine.get(c.invoice_extraction_line_id) ?? [];
        list.push({
          id: c.id,
          component_type: c.component_type,
          amount_cents: c.amount_cents,
          source: c.source,
          notes: c.notes,
          quantity: c.quantity,
          unit: c.unit,
          unit_rate_cents: c.unit_rate_cents,
          display_order: c.display_order,
        });
        componentsByLine.set(c.invoice_extraction_line_id, list);
      }
    }

    // Sign PDF storage paths once per unique invoice file so the detail
    // panel's <iframe> gets a browser-fetchable URL. The invoice-files
    // bucket is private; raw paths resolve as relative URLs against the
    // current page and 404.
    const uniquePaths = Array.from(
      new Set(
        rows
          .map((r) => r.invoice_extractions?.invoices?.original_file_url)
          .filter((p): p is string => Boolean(p))
      )
    );
    const signedUrlByPath = new Map<string, string>();
    await Promise.all(
      uniquePaths.map(async (path) => {
        const { data, error } = await supabase.storage
          .from("invoice-files")
          .createSignedUrl(path, 3600);
        if (!error && data?.signedUrl) {
          signedUrlByPath.set(path, data.signedUrl);
        }
      })
    );

    const mapped: QueueLine[] = rows.map((r) => {
      const inv = r.invoice_extractions!.invoices!;
      return {
        id: r.id,
        extraction_id: r.extraction_id,
        raw_description: r.raw_description,
        raw_quantity: r.raw_quantity,
        raw_unit_text: r.raw_unit_text,
        raw_unit_price_cents: r.raw_unit_price_cents,
        raw_total_cents: r.raw_total_cents,
        match_tier: r.match_tier,
        match_confidence: r.match_confidence,
        match_confidence_score: r.match_confidence_score,
        classification_confidence: r.classification_confidence,
        match_reasoning: r.match_reasoning,
        created_at: r.created_at,
        is_transaction_line: r.is_transaction_line,
        transaction_line_type: r.transaction_line_type,
        proposed_item_id: r.proposed_item_id,
        proposed_item: r.proposed_item,
        proposed_item_data: r.proposed_item_data,
        proposed_pricing_model: r.proposed_pricing_model,
        proposed_scope_size_metric: r.proposed_scope_size_metric,
        extracted_scope_size_value: r.extracted_scope_size_value,
        extracted_scope_size_confidence: r.extracted_scope_size_confidence,
        extracted_scope_size_source: r.extracted_scope_size_source,
        line_tax_cents: r.line_tax_cents,
        overhead_allocated_cents: r.overhead_allocated_cents,
        raw_ocr_text: r.invoice_extractions?.raw_ocr_text ?? null,
        line_nature: r.line_nature,
        scope_split_into_components: r.scope_split_into_components ?? false,
        scope_estimated_material_cents: r.scope_estimated_material_cents,
        invoice: {
          id: inv.id,
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          vendor_id: inv.vendor_id,
          vendor_name: inv.vendors?.name ?? null,
          original_file_url: inv.original_file_url,
          signed_pdf_url: inv.original_file_url
            ? signedUrlByPath.get(inv.original_file_url) ?? null
            : null,
        },
        components: componentsByLine.get(r.id) ?? [],
      };
    });

    setLines(mapped);
    setLoading(false);
  }, [invoiceFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Reset selection when tab changes
  useEffect(() => {
    setSelection(null);
  }, [activeTab]);

  // Partition by line_nature — the Review tab captures unclassified + any
  // line that somehow lacks a nature (e.g. legacy rows from before migration
  // 00058) so nothing falls through the cracks.
  const linesByTab = useMemo(() => {
    const result: Record<QueueTab, QueueLine[]> = {
      materials: [],
      labor: [],
      scope: [],
      equipment: [],
      services: [],
      review: [],
    };
    for (const l of lines) {
      switch (l.line_nature) {
        case "material":
          result.materials.push(l);
          break;
        case "labor":
          result.labor.push(l);
          break;
        case "scope":
          result.scope.push(l);
          break;
        case "equipment":
          result.equipment.push(l);
          break;
        case "service":
          result.services.push(l);
          break;
        case "unclassified":
        case null:
        default:
          result.review.push(l);
          break;
      }
    }
    return result;
  }, [lines]);

  const counts: Record<QueueTab, number> = useMemo(
    () => ({
      materials: linesByTab.materials.length,
      labor: linesByTab.labor.length,
      scope: linesByTab.scope.length,
      equipment: linesByTab.equipment.length,
      services: linesByTab.services.length,
      review: linesByTab.review.length,
    }),
    [linesByTab]
  );

  const visibleLines = linesByTab[activeTab];

  const handleApproved = useCallback((affectedIds: string[]) => {
    setLines((prev) => prev.filter((l) => !affectedIds.includes(l.id)));
    setSelection(null);
  }, []);

  // Build the detail-panel selection object from the queue selection
  const detailSelection = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === "single") {
      const line = lines.find((l) => l.id === selection.line_id);
      if (!line) return null;
      return { kind: "single" as const, line };
    }
    const selectedLines = lines.filter((l) => selection.line_ids.includes(l.id));
    if (selectedLines.length === 0) return null;
    return { kind: "group" as const, key: selection.key, lines: selectedLines };
  }, [selection, lines]);

  // Suppress unused-var lint for NATURE_BY_TAB import when not directly used
  // in this file — it's exported for shared consumers.
  void NATURE_BY_TAB;

  return (
    <AppShell>
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <Link
          href="/cost-intelligence"
          className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--nw-gulf-blue)] uppercase tracking-[0.12em]"
          style={{ fontFamily: "var(--font-jetbrains-mono)" }}
        >
          ← Cost Intelligence
        </Link>

        <div className="mt-4 mb-4">
          <NwEyebrow tone="accent">Cost Intelligence · Verification</NwEyebrow>
          <h1
            className="mt-2 text-[28px] tracking-[-0.02em] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Verify extracted line items
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Tabs filter by line nature. Review holds anything the AI could not classify.
            {invoiceFilter && (
              <>
                {" "}
                <span className="text-[var(--nw-stone-blue)]">
                  Filtered to invoice {invoiceFilter.slice(0, 8)}
                </span>
                {" · "}
                <Link
                  href="/cost-intelligence/verification"
                  className="text-[var(--nw-gulf-blue)] hover:underline"
                >
                  clear
                </Link>
              </>
            )}
          </p>
        </div>

        <div className="sticky top-0 z-10 bg-[var(--bg-main)] pt-1">
          <VerificationTabs active={activeTab} counts={counts} onChange={setActiveTab} />
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[minmax(0,40fr)_minmax(0,60fr)] gap-4 items-stretch">
          <div className="border border-[var(--border-default)] bg-[var(--bg-card)] min-h-[520px] max-h-[calc(100vh-220px)] flex flex-col overflow-hidden">
            {loading ? (
              <div className="flex-1 p-8 text-center text-[13px] text-[var(--text-tertiary)]">
                Loading…
              </div>
            ) : (
              <VerificationQueue
                tab={activeTab}
                lines={visibleLines}
                selection={selection}
                onSelect={setSelection}
              />
            )}
          </div>

          <div className="border border-[var(--border-default)] bg-[var(--bg-card)] min-h-[520px] max-h-[calc(100vh-220px)] flex flex-col overflow-hidden">
            <VerificationDetailPanel
              selection={detailSelection}
              onClose={() => setSelection(null)}
              onApproved={handleApproved}
            />
          </div>
        </div>
      </main>
    </AppShell>
  );
}

export default function VerificationQueuePage() {
  return (
    <Suspense fallback={null}>
      <VerificationPageInner />
    </Suspense>
  );
}
