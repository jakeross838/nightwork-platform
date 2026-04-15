import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  computeDrawLines,
  lessPreviousCertificatesForJob,
  rollupDrawTotals,
} from "@/lib/draw-calc";

export const dynamic = "force-dynamic";

/**
 * POST /api/draws/preview
 *
 * Phase 8f wizard helper: returns the same G703 line snapshot + G702 totals
 * the create endpoint would produce without writing anything. Used by Steps
 * 3 and 4 of the wizard so the user sees real numbers before committing.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = (await request.json()) as {
      job_id: string;
      period_start: string;
      period_end: string;
      invoice_ids: string[];
      is_final?: boolean;
    };
    const { job_id, period_start, period_end, invoice_ids, is_final } = body;
    if (!job_id) {
      return NextResponse.json({ error: "job_id required" }, { status: 400 });
    }

    const { data: job } = await supabase
      .from("jobs")
      .select(
        "id, name, address, original_contract_amount, deposit_percentage, retainage_percent"
      )
      .eq("id", job_id)
      .single();
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Next draw number for this job (revisions share a number; rev 0 only).
    const { data: lastDraw } = await supabase
      .from("draws")
      .select("draw_number")
      .eq("job_id", job_id)
      .is("deleted_at", null)
      .eq("revision_number", 0)
      .order("draw_number", { ascending: false })
      .limit(1);
    const drawNumber = (lastDraw?.[0]?.draw_number ?? 0) + 1;

    // Net change orders.
    const { data: changeOrders } = await supabase
      .from("change_orders")
      .select("total_with_fee, amount, co_type, status, pcco_number, description")
      .eq("job_id", job_id)
      .in("status", ["approved", "executed"])
      .is("deleted_at", null);
    const netChangeOrders =
      (changeOrders ?? [])
        .filter((co) => (co as { co_type?: string }).co_type === "owner")
        .reduce(
          (s, co) =>
            s +
            ((co as { total_with_fee?: number; amount?: number }).total_with_fee ??
              (co as { amount?: number }).amount ??
              0),
          0
        );

    const retainagePct = (job as { retainage_percent?: number }).retainage_percent ?? 10;
    const { lines } = await computeDrawLines({
      jobId: job_id,
      drawNumber,
      drawInvoiceIds: invoice_ids ?? [],
      periodStart: period_start,
      periodEnd: period_end,
      retainagePercent: retainagePct,
      isFinalDraw: !!is_final,
    });

    const lessPrevCerts = await lessPreviousCertificatesForJob(job_id, drawNumber);
    const totals = rollupDrawTotals({
      originalContractSum: job.original_contract_amount ?? 0,
      netChangeOrders,
      depositPercentage: job.deposit_percentage ?? 0.1,
      retainagePercent: retainagePct,
      lines,
      lessPreviousCertificates: lessPrevCerts,
      isFinalDraw: !!is_final,
    });

    // Resolve cost-code metadata for each snapshot line so the wizard's G703
    // table can show code + description + change-order flag.
    const ccIds = lines.map((l) => l.cost_code_id);
    const { data: budgetMetaRaw } = await supabase
      .from("budget_lines")
      .select(
        "id, cost_code_id, original_estimate, revised_estimate, " +
          "cost_codes:cost_code_id (code, description, sort_order, is_change_order)"
      )
      .eq("job_id", job_id)
      .is("deleted_at", null)
      .in("cost_code_id", ccIds);
    const budgetMeta = (budgetMetaRaw ?? []) as unknown as Array<{
      id: string;
      cost_code_id: string;
      original_estimate: number;
      revised_estimate: number;
      cost_codes: unknown;
    }>;

    const metaByCc = new Map<
      string,
      {
        budget_line_id: string | null;
        code: string;
        description: string;
        sort_order: number;
        is_change_order: boolean;
        original_estimate: number;
        revised_estimate: number;
      }
    >();
    for (const bl of budgetMeta) {
      const ccRaw = Array.isArray(bl.cost_codes) ? bl.cost_codes[0] : bl.cost_codes;
      const cc = (ccRaw ?? {}) as {
        code?: string;
        description?: string;
        sort_order?: number;
        is_change_order?: boolean;
      };
      metaByCc.set(bl.cost_code_id, {
        budget_line_id: bl.id,
        code: cc.code ?? "—",
        description: cc.description ?? "",
        sort_order: cc.sort_order ?? 0,
        is_change_order: !!cc.is_change_order,
        original_estimate: bl.original_estimate ?? 0,
        revised_estimate: bl.revised_estimate ?? 0,
      });
    }

    // Pull cost-code metadata for any cost code on a selected invoice that
    // doesn't have a budget_line yet — show it in the preview so the user
    // isn't surprised.
    const missing = ccIds.filter((id) => !metaByCc.has(id));
    if (missing.length > 0) {
      const { data: ccs } = await supabase
        .from("cost_codes")
        .select("id, code, description, sort_order, is_change_order")
        .in("id", missing);
      for (const cc of ccs ?? []) {
        metaByCc.set(cc.id as string, {
          budget_line_id: null,
          code: (cc as { code?: string }).code ?? "—",
          description: (cc as { description?: string }).description ?? "",
          sort_order: (cc as { sort_order?: number }).sort_order ?? 0,
          is_change_order: !!(cc as { is_change_order?: boolean }).is_change_order,
          original_estimate: 0,
          revised_estimate: 0,
        });
      }
    }

    const enrichedLines = lines
      .map((l) => {
        const m = metaByCc.get(l.cost_code_id);
        return {
          ...l,
          code: m?.code ?? "—",
          description: m?.description ?? "",
          sort_order: m?.sort_order ?? 0,
          is_change_order: m?.is_change_order ?? false,
          original_estimate: m?.original_estimate ?? 0,
          revised_estimate: m?.revised_estimate ?? 0,
        };
      })
      .sort((a, b) => a.sort_order - b.sort_order);

    // Surface PCCO numbers for the change-order section of the preview.
    const coLines = (changeOrders ?? [])
      .filter((co) => (co as { co_type?: string }).co_type === "owner")
      .map((co) => ({
        pcco_number: (co as { pcco_number?: number }).pcco_number ?? null,
        description: (co as { description?: string }).description ?? "",
        amount:
          (co as { total_with_fee?: number; amount?: number }).total_with_fee ??
          (co as { amount?: number }).amount ??
          0,
      }));

    return NextResponse.json({
      draw_number: drawNumber,
      job: {
        id: job.id,
        name: job.name,
        address: job.address,
        original_contract_amount: job.original_contract_amount,
        retainage_percent: retainagePct,
      },
      lines: enrichedLines,
      change_orders: coLines,
      totals,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
