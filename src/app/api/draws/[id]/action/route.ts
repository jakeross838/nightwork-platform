import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";
import { logActivity, logStatusChange } from "@/lib/activity-log";
import { recalcLinesAndPOs } from "@/lib/recalc";
import { notifyRole, notifyUser } from "@/lib/notifications";
import {
  autoGenerateLienReleases,
  pendingReleaseBlockers,
  missingDocumentBlockers,
  markDrawReleasesNotRequired,
} from "@/lib/lien-releases";
import { autoScheduleDrawPayments } from "@/lib/payment-schedule";
import { getWorkflowSettings } from "@/lib/workflow-settings";
import { updateWithLock, isLockConflict } from "@/lib/api/optimistic-lock";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Phase 8 workflow: draft → submitted → approved → locked
// Also supports: approved → paid (legacy), void, and "send back to draft"
const ACTION_MAP: Record<string, { next: string; requires?: string[] }> = {
  submit: { next: "submitted", requires: ["draft", "pm_review"] },
  approve: { next: "approved", requires: ["submitted", "pm_review"] },
  lock: { next: "locked", requires: ["approved"] },
  send_back: { next: "draft", requires: ["submitted", "pm_review"] },
  mark_paid: { next: "paid", requires: ["approved", "submitted", "locked"] },
  void: { next: "void", requires: ["draft", "pm_review", "submitted", "approved", "locked"] },
  // Legacy alias kept for older UI code paths.
  mark_submitted: { next: "submitted", requires: ["draft", "pm_review", "approved"] },
};

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const membership = await getCurrentMembership();
    if (!membership) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const orgId = membership.org_id;

    const supabase = createServerClient();
    const { action, reason, expected_updated_at } = (await request.json()) as {
      action: string;
      reason?: string;
      expected_updated_at?: string;
    };

    const rule = ACTION_MAP[action];
    if (!rule) {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const { data: draw, error: fetchError } = await supabase
      .from("draws")
      .select(
        "id, job_id, org_id, status, status_history, draw_number, revision_number, period_end, is_final, current_payment_due"
      )
      .eq("id", params.id)
      .eq("org_id", orgId)
      .single();
    if (fetchError || !draw) {
      return NextResponse.json({ error: "Draw not found" }, { status: 404 });
    }

    if (rule.requires && !rule.requires.includes(draw.status)) {
      return NextResponse.json(
        {
          error: `Cannot ${action.replace(/_/g, " ")} a ${draw.status} draw. Allowed: ${rule.requires.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    // --- Transition-specific guards ----------------------------------------

    // Void guard: cannot void a draw if any invoice is already paid.
    if (action === "void") {
      const { data: paidInvs } = await supabase
        .from("invoices")
        .select("id")
        .eq("draw_id", params.id)
        .eq("org_id", orgId)
        .eq("payment_status", "paid")
        .is("deleted_at", null);
      if ((paidInvs ?? []).length > 0) {
        await logActivity({
          org_id: orgId,
          entity_type: "draw",
          entity_id: params.id,
          action: "void_blocked",
          details: { reason: "paid_invoices", count: (paidInvs ?? []).length },
        });
        return NextResponse.json(
          {
            error: `Cannot void — ${(paidInvs ?? []).length} invoice(s) in this draw are already paid. Reverse payment first.`,
          },
          { status: 400 }
        );
      }
    }

    // Approve guard: block if any pending lien releases OR (Phase 8f Part F)
    // any required release document is missing when the org setting is on.
    if (action === "approve") {
      const blockers = await pendingReleaseBlockers(params.id);
      if (blockers.count > 0) {
        return NextResponse.json(
          {
            error: `Cannot approve — ${blockers.count} of ${blockers.total} lien release(s) are still pending. Mark received or waive before approving.`,
          },
          { status: 400 }
        );
      }
      const settings = await getWorkflowSettings(orgId);
      if (settings.require_lien_release_for_draw) {
        const docs = await missingDocumentBlockers(params.id);
        if (docs.missing > 0) {
          return NextResponse.json(
            {
              error: `Cannot approve — ${docs.missing} of ${docs.total} lien release document(s) are missing${
                docs.vendors.length > 0 ? ` (${docs.vendors.slice(0, 3).join(", ")}${docs.vendors.length > 3 ? "…" : ""})` : ""
              }. Upload required before approval.`,
              missing_lien_documents: docs,
            },
            { status: 400 }
          );
        }
      }
    }

    const nowIso = new Date().toISOString();
    const existingHistory = Array.isArray(draw.status_history) ? draw.status_history : [];
    // Prefer the acting user's UUID so the UI resolver can render their name.
    const { data: { user: actor } } = await supabase.auth.getUser();
    const statusEntry = {
      who: actor?.id ?? "user",
      when: nowIso,
      old_status: draw.status,
      new_status: rule.next,
      note: reason ?? `Draw ${action.replace(/_/g, " ")}`,
    };

    const updates: Record<string, unknown> = {
      status: rule.next,
      status_history: [...existingHistory, statusEntry],
    };
    if (rule.next === "submitted") updates.submitted_at = nowIso;
    if (rule.next === "approved") updates.approved_at = nowIso;
    if (rule.next === "locked") updates.locked_at = nowIso;
    if (rule.next === "paid") updates.paid_at = nowIso;
    // Phase 8f: once a draw leaves draft, the wizard state is irrelevant. Drop
    // it so the draws list doesn't keep showing it as "Resume draft".
    if (draw.status === "draft" && rule.next !== "draft") {
      updates.wizard_draft = null;
    }

    const lockResult = await updateWithLock(supabase, {
      table: "draws",
      id: params.id,
      orgId,
      expectedUpdatedAt: expected_updated_at,
      updates,
      selectCols: "id, status, updated_at",
    });
    if (isLockConflict(lockResult)) {
      return lockResult.response;
    }

    // --- Side-effects per transition ----------------------------------------

    // draft → submitted: flip invoices to in_draw, auto-generate lien releases.
    if (action === "submit") {
      const { data: invs } = await supabase
        .from("invoices")
        .select("id, status")
        .eq("draw_id", params.id)
        .eq("org_id", orgId)
        .is("deleted_at", null);
      const invIds = (invs ?? []).map((i) => i.id as string);
      if (invIds.length > 0) {
        await supabase
          .from("invoices")
          .update({ status: "in_draw" })
          .in("id", invIds)
          .eq("org_id", orgId);
        try {
          const { data: lines } = await supabase
            .from("invoice_line_items")
            .select("budget_line_id, po_id")
            .in("invoice_id", invIds)
            .is("deleted_at", null);
          await recalcLinesAndPOs(
            (lines ?? []).map((l) => l.budget_line_id as string),
            (lines ?? []).map((l) => l.po_id as string)
          );
        } catch (err) {
          console.warn(`[draw submit recalc] ${err instanceof Error ? err.message : err}`);
        }
        for (const invId of invIds) {
          await logStatusChange({
            org_id: orgId,
            entity_type: "invoice",
            entity_id: invId,
            from: "qa_approved",
            to: "in_draw",
            reason: `Draw #${draw.draw_number} submitted`,
          });
        }
      }
      // Auto-generate lien releases.
      try {
        const newReleases = await autoGenerateLienReleases({
          draw_id: params.id,
          job_id: draw.job_id as string,
          org_id: orgId,
          isFinal: !!draw.is_final,
          through_date: (draw as { period_end: string | null }).period_end ?? null,
          created_by: null,
        });
        if (newReleases > 0) {
          await logActivity({
            org_id: orgId,
            entity_type: "draw",
            entity_id: params.id,
            action: "updated",
            details: { auto_generated_lien_releases: newReleases },
          });
          // Notify accounting that releases are needed.
          try {
            const { data: jobRow } = await supabase
              .from("jobs")
              .select("name")
              .eq("id", draw.job_id as string)
              .eq("org_id", orgId)
              .maybeSingle();
            await notifyRole(orgId, ["accounting", "admin"], {
              notification_type: "lien_release_pending",
              subject: `${newReleases} lien release(s) needed — Draw #${draw.draw_number}`,
              body: `Draw #${draw.draw_number} on ${jobRow?.name ?? "a job"} was submitted. ${newReleases} vendor lien release(s) need to be collected.`,
              action_url: `/draws/${params.id}`,
            });
          } catch (err) {
            console.warn(`[draw submit notify] ${err instanceof Error ? err.message : err}`);
          }
        }
      } catch (err) {
        console.warn(`[auto lien release] ${err instanceof Error ? err.message : err}`);
      }

      // Notify owner/admin for approval.
      try {
        const { data: jobRow } = await supabase
          .from("jobs")
          .select("name")
          .eq("id", draw.job_id as string)
          .eq("org_id", orgId)
          .maybeSingle();
        const amt = `$${Math.round(((draw as { current_payment_due?: number }).current_payment_due ?? 0) / 100).toLocaleString("en-US")}`;
        await notifyRole(orgId, ["owner", "admin"], {
          notification_type: "draw_submitted",
          subject: `Draw #${draw.draw_number} submitted — ${jobRow?.name ?? ""}`,
          body: `Draw #${draw.draw_number} for ${jobRow?.name ?? "a job"} (${amt}) submitted for approval.`,
          action_url: `/draws/${params.id}`,
        });
      } catch {
        /* already logged in notifyRole */
      }
    }

    // submitted/pm_review → draft (send back): revert invoices to qa_approved.
    if (action === "send_back") {
      const { data: invs } = await supabase
        .from("invoices")
        .select("id")
        .eq("draw_id", params.id)
        .eq("org_id", orgId)
        .eq("status", "in_draw")
        .is("deleted_at", null);
      const invIds = (invs ?? []).map((i) => i.id as string);
      if (invIds.length > 0) {
        await supabase
          .from("invoices")
          .update({ status: "qa_approved" })
          .in("id", invIds)
          .eq("org_id", orgId);
        try {
          const { data: lines } = await supabase
            .from("invoice_line_items")
            .select("budget_line_id, po_id")
            .in("invoice_id", invIds)
            .is("deleted_at", null);
          await recalcLinesAndPOs(
            (lines ?? []).map((l) => l.budget_line_id as string),
            (lines ?? []).map((l) => l.po_id as string)
          );
        } catch {
          /* ignore */
        }
        for (const invId of invIds) {
          await logStatusChange({
            org_id: orgId,
            entity_type: "invoice",
            entity_id: invId,
            from: "in_draw",
            to: "qa_approved",
            reason: `Draw #${draw.draw_number} sent back to draft`,
          });
        }
      }
    }

    // submitted → approved: auto-schedule payments, notify submitter.
    if (action === "approve") {
      try {
        const scheduled = await autoScheduleDrawPayments({
          draw_id: params.id,
          org_id: orgId,
        });
        if (scheduled > 0) {
          await logActivity({
            org_id: orgId,
            entity_type: "draw",
            entity_id: params.id,
            action: "updated",
            details: { auto_scheduled_payments: scheduled },
          });
        }
      } catch (err) {
        console.warn(`[auto schedule] ${err instanceof Error ? err.message : err}`);
      }
      // Notify the submitter (approximated via the creator).
      try {
        const { data: me } = await supabase
          .from("draws")
          .select("created_by")
          .eq("id", params.id)
          .eq("org_id", orgId)
          .maybeSingle();
        if (me?.created_by) {
          await notifyUser(me.created_by as string, orgId, {
            notification_type: "draw_approved",
            subject: `Draw #${draw.draw_number} approved`,
            body: `Your draw submission has been approved.`,
            action_url: `/draws/${params.id}`,
          });
        }
      } catch {
        /* ignore */
      }
    }

    // approved → locked: no invoice cascade, but permanent audit.
    // (No extra logic needed beyond timestamps already set above.)

    // any → void: revert invoices, mark lien releases not_required.
    if (action === "void") {
      const { data: invs } = await supabase
        .from("invoices")
        .select("id, status")
        .eq("draw_id", params.id)
        .eq("org_id", orgId)
        .is("deleted_at", null);
      const invIds = (invs ?? []).map((i) => i.id as string);
      if (invIds.length > 0) {
        const { data: unlinked, error: unlinkErr } = await supabase
          .from("invoices")
          .update({ status: "qa_approved", draw_id: null })
          .in("id", invIds)
          .eq("org_id", orgId)
          .in("status", ["in_draw"])
          .select("id");
        if (unlinkErr) {
          console.error("[void] invoice unlink failed:", unlinkErr.message);
        } else if (!unlinked || unlinked.length === 0) {
          console.warn(`[void] Expected to unlink invoices but 0 updated`);
        }
        try {
          const { data: lines } = await supabase
            .from("invoice_line_items")
            .select("budget_line_id, po_id")
            .in("invoice_id", invIds)
            .is("deleted_at", null);
          await recalcLinesAndPOs(
            (lines ?? []).map((l) => l.budget_line_id as string),
            (lines ?? []).map((l) => l.po_id as string)
          );
        } catch {
          /* ignore */
        }
      }
      await markDrawReleasesNotRequired(params.id);
    }

    await logStatusChange({
      org_id: orgId,
      entity_type: "draw",
      entity_id: params.id,
      from: draw.status,
      to: rule.next,
      reason,
    });

    return NextResponse.json({ status: rule.next });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
