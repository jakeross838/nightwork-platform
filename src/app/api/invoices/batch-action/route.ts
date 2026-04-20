import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { recalcLinesAndPOs } from "@/lib/recalc";
import { logStatusChange } from "@/lib/activity-log";
import { getWorkflowSettings } from "@/lib/workflow-settings";
import { getCurrentMembership } from "@/lib/org/session";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface BatchActionRequest {
  action: "approve" | "hold" | "deny";
  invoice_ids: string[];
  note?: string;
}

interface FailedItem {
  id: string;
  reason: string;
}

const REVIEWABLE_STATUSES = ["pm_review", "ai_processed", "pm_held"];

export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = createServerClient();
    const body: BatchActionRequest = await request.json();
    const { action, invoice_ids, note } = body;

    // Resolve the acting user once — we use their UUID in each status_history
    // entry so the UI can render "Bob Mozine" instead of "pm".
    const { data: { user: actor } } = await supabase.auth.getUser();
    const actorWho = actor?.id ?? "pm";

    if (!action || !["approve", "hold", "deny"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
      return NextResponse.json({ error: "No invoice IDs provided" }, { status: 400 });
    }

    if ((action === "hold" || action === "deny") && !note) {
      return NextResponse.json(
        { error: `${action === "hold" ? "Hold" : "Deny"} requires a note` },
        { status: 400 }
      );
    }

    // Workflow settings gate the whole operation.
    const settings = await getWorkflowSettings(membership.org_id);
    if (!settings.batch_approval_enabled) {
      return NextResponse.json(
        { error: "Batch approval is disabled for this organization" },
        { status: 403 }
      );
    }

    type BatchInvoiceRow = {
      id: string;
      status: string;
      status_history: unknown;
      job_id: string | null;
      cost_code_id: string | null;
      org_id: string | null;
      invoice_date: string | null;
      total_amount: number;
      po_id: string | null;
      is_potential_duplicate: boolean;
      duplicate_dismissed_at: string | null;
    };

    // Fetch invoices + their line items (for budget / PO allocation checks).
    const { data: rawInvoices, error: fetchError } = await supabase
      .from("invoices")
      .select(
        "id, status, status_history, job_id, cost_code_id, org_id, invoice_date, " +
          "total_amount, po_id, is_potential_duplicate, duplicate_dismissed_at"
      )
      .in("id", invoice_ids)
      .eq("org_id", membership.org_id)
      .is("deleted_at", null);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const invoices = (rawInvoices ?? []) as unknown as BatchInvoiceRow[];
    const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]));

    // Load line items in one shot — only needed for approve actions that
    // require budget_allocation or po_linkage checks.
    const lineItemsByInvoice: Map<
      string,
      Array<{ budget_line_id: string | null; po_id: string | null }>
    > = new Map();
    if (action === "approve") {
      const { data: lines } = await supabase
        .from("invoice_line_items")
        .select("invoice_id, budget_line_id, po_id")
        .in("invoice_id", invoice_ids)
        .is("deleted_at", null);
      for (const l of lines ?? []) {
        const arr = lineItemsByInvoice.get(l.invoice_id as string) ?? [];
        arr.push({
          budget_line_id: (l.budget_line_id as string | null) ?? null,
          po_id: (l.po_id as string | null) ?? null,
        });
        lineItemsByInvoice.set(l.invoice_id as string, arr);
      }
    }

    const success: string[] = [];
    const failed: FailedItem[] = [];

    for (const id of invoice_ids) {
      const invoice = invoiceMap.get(id);

      if (!invoice) {
        failed.push({ id, reason: "Invoice not found" });
        continue;
      }

      if (!REVIEWABLE_STATUSES.includes(invoice.status)) {
        failed.push({
          id,
          reason: `Not in a reviewable state (${invoice.status})`,
        });
        continue;
      }

      if (action === "approve") {
        // Gate 1 — job / cost code presence (always required).
        if (!invoice.job_id || !invoice.cost_code_id) {
          failed.push({ id, reason: "Missing job or cost code" });
          continue;
        }

        // Gate 2 — duplicate flag (when detection enabled).
        if (
          settings.duplicate_detection_enabled &&
          invoice.is_potential_duplicate &&
          !invoice.duplicate_dismissed_at
        ) {
          failed.push({
            id,
            reason: "Flagged as potential duplicate — review individually",
          });
          continue;
        }

        // Gate 3 — invoice date required.
        if (settings.require_invoice_date && !invoice.invoice_date) {
          failed.push({ id, reason: "Missing invoice date" });
          continue;
        }

        // Gate 4 — budget allocation on every line.
        if (settings.require_budget_allocation) {
          const lines = lineItemsByInvoice.get(id) ?? [];
          if (lines.length === 0 || lines.some((l) => !l.budget_line_id)) {
            failed.push({
              id,
              reason: "Invoice is not fully allocated to budget lines",
            });
            continue;
          }
        }

        // Gate 5 — PO linkage.
        if (settings.require_po_linkage) {
          const lines = lineItemsByInvoice.get(id) ?? [];
          const hasHeaderPO = !!invoice.po_id;
          const allLinesHavePO = lines.length > 0 && lines.every((l) => l.po_id);
          if (!hasHeaderPO && !allLinesHavePO) {
            failed.push({ id, reason: "No PO linked" });
            continue;
          }
        }
      }

      // Build status transition.
      const now = new Date().toISOString();
      const existingHistory = Array.isArray(invoice.status_history)
        ? (invoice.status_history as Array<Record<string, unknown>>)
        : [];

      if (action === "approve") {
        const statusEntries = [
          {
            who: actorWho,
            when: now,
            old_status: invoice.status,
            new_status: "pm_approved",
            note: note ?? "pm approve (batch)",
          },
          {
            who: "system",
            when: now,
            old_status: "pm_approved",
            new_status: "qa_review",
            note: "Auto-routed to qa review",
          },
        ];

        const { error: updateError } = await supabase
          .from("invoices")
          .update({
            status: "qa_review",
            status_history: [...existingHistory, ...statusEntries],
          })
          .eq("id", id)
          .eq("org_id", membership.org_id);

        if (updateError) {
          failed.push({ id, reason: updateError.message });
        } else {
          success.push(id);
        }
      } else if (action === "hold") {
        const statusEntry = {
          who: actorWho,
          when: now,
          old_status: invoice.status,
          new_status: "pm_held",
          note: note ?? "pm hold (batch)",
        };
        const { error: updateError } = await supabase
          .from("invoices")
          .update({
            status: "pm_held",
            status_history: [...existingHistory, statusEntry],
          })
          .eq("id", id)
          .eq("org_id", membership.org_id);
        if (updateError) failed.push({ id, reason: updateError.message });
        else success.push(id);
      } else {
        // deny
        const statusEntry = {
          who: actorWho,
          when: now,
          old_status: invoice.status,
          new_status: "pm_denied",
          note: note ?? "pm deny (batch)",
        };
        const { error: updateError } = await supabase
          .from("invoices")
          .update({
            status: "pm_denied",
            status_history: [...existingHistory, statusEntry],
          })
          .eq("id", id)
          .eq("org_id", membership.org_id);
        if (updateError) failed.push({ id, reason: updateError.message });
        else success.push(id);
      }
    }

    if (success.length > 0) {
      const user = actor;
      try {
        const { data: lines } = await supabase
          .from("invoice_line_items")
          .select("invoice_id, budget_line_id, po_id")
          .in("invoice_id", success)
          .is("deleted_at", null);
        await recalcLinesAndPOs(
          (lines ?? []).map((l) => l.budget_line_id),
          (lines ?? []).map((l) => l.po_id)
        );
      } catch (recalcErr) {
        console.warn(
          `[batch-action recalc] ${
            recalcErr instanceof Error ? recalcErr.message : recalcErr
          }`
        );
      }
      for (const id of success) {
        const inv = invoiceMap.get(id);
        if (!inv) continue;
        const toStatus =
          action === "approve"
            ? "qa_review"
            : action === "hold"
              ? "pm_held"
              : "pm_denied";
        await logStatusChange({
          org_id: membership.org_id,
          user_id: user?.id ?? null,
          entity_type: "invoice",
          entity_id: id,
          from: inv.status,
          to: toStatus,
          reason: note,
          extra: { action, batch: true },
        });
      }
    }

    return NextResponse.json({ success, failed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
