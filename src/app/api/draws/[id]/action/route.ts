/**
 * Draw action route — REBUILT in Phase 1.3.
 *
 * Submit / approve / void each go through a single Postgres RPC
 * (`draw_submit_rpc` / `draw_approve_rpc` / `draw_void_rpc`) so the cascade
 * — draw status, invoice statuses, lien releases, payment scheduling,
 * notification rows — is one atomic transaction. If any step raises, the
 * RPC rolls back everything; the route never sees a half-committed state.
 *
 * Other actions (lock, mark_paid, send_back, mark_submitted) keep the
 * existing TS-side flow because they were not in Phase 1.3's scope (the
 * spec lists three RPCs only). send_back's cascade is a known gap to be
 * cleaned up in a later hardening pass.
 *
 * Failure-injection (R.19 manual tests 2 and 4): two channels, both
 * off by default in production.
 *   1. Env var — FORCE_LIEN_GEN_FAIL / FORCE_APPROVE_FAIL. Must be set at
 *      server start. Useful for CI-style runs.
 *   2. Request header — `x-force-fail: lien_gen` / `approve`. Only honored
 *      when NODE_ENV !== 'production'. Lets one running dev server exercise
 *      both normal and failure paths without a restart (avoids R.1
 *      process-kill rule). In production Next.js sets NODE_ENV=production,
 *      so the header is ignored — no backdoor ships.
 * See migration 00061's header comment for the full failure-injection
 * contract on the RPC side.
 *
 * Post-commit work (recalc + email dispatch) runs in TS after the RPC
 * returns success. These are non-atomic with the cascade by design — a
 * Resend outage shouldn't roll back a draw submit.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentMembership } from "@/lib/org/session";
import { logActivity, logStatusChange } from "@/lib/activity-log";
import {
  getClientForRequest,
  logImpersonatedWrite,
} from "@/lib/auth/impersonation-client";
import { recalcLinesAndPOs } from "@/lib/recalc";
import {
  dispatchEmailToOrgRoles,
  dispatchEmailToUser,
} from "@/lib/notifications";
import { updateWithLock, isLockConflict } from "@/lib/api/optimistic-lock";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Phase 8 workflow: draft → submitted → approved → locked
const ACTION_MAP: Record<string, { next: string; requires?: string[] }> = {
  submit: { next: "submitted", requires: ["draft", "pm_review"] },
  approve: { next: "approved", requires: ["submitted", "pm_review"] },
  lock: { next: "locked", requires: ["approved"] },
  send_back: { next: "draft", requires: ["submitted", "pm_review"] },
  mark_paid: { next: "paid", requires: ["approved", "submitted", "locked"] },
  void: { next: "void", requires: ["draft", "pm_review", "submitted", "approved", "locked"] },
  mark_submitted: { next: "submitted", requires: ["draft", "pm_review", "approved"] },
};

// Resolve the _force_fail token for an RPC. Checks env var first (useful for
// CI), then (in non-production only) the x-force-fail request header. Returns
// null when neither is set, which is the default production path.
function readForceFail(
  envName: string,
  headerToken: string,
  request: NextRequest
): string | null {
  if (process.env[envName]) return headerToken;
  if (process.env.NODE_ENV !== "production") {
    if (request.headers.get("x-force-fail") === headerToken) return headerToken;
  }
  return null;
}

// PG error → HTTP status. The RPCs RAISE with specific SQLSTATEs we recognize.
function rpcErrorToHttp(error: { code?: string; message?: string }): {
  status: number;
  body: Record<string, unknown>;
} {
  const code = error.code ?? "";
  const msg = error.message ?? "RPC failed";

  if (code === "P0002") return { status: 404, body: { error: msg } };
  if (code === "40001") return { status: 409, body: { error: "optimistic_lock_conflict" } };

  // Phase-specific guard codes encoded as 'name:detail' in the message.
  if (msg.startsWith("pending_lien_releases:")) {
    const n = msg.split(":")[1] ?? "?";
    return {
      status: 400,
      body: { error: `Cannot approve — ${n} lien release(s) are still pending. Mark received or waive before approving.` },
    };
  }
  if (msg.startsWith("missing_lien_documents:")) {
    const n = msg.split(":")[1] ?? "?";
    return {
      status: 400,
      body: { error: `Cannot approve — ${n} lien release document(s) are missing. Upload required before approval.` },
    };
  }
  if (msg.startsWith("paid_invoices_in_draw:")) {
    const n = msg.split(":")[1] ?? "?";
    return {
      status: 400,
      body: { error: `Cannot void — ${n} invoice(s) in this draw are already paid. Reverse payment first.` },
    };
  }
  if (msg.startsWith("injected failure")) {
    // Surfaced cleanly so manual tests 2/4 can assert the precise failure mode.
    return { status: 500, body: { error: msg, injected: true } };
  }
  if (code === "P0001") return { status: 400, body: { error: msg } };
  return { status: 500, body: { error: msg } };
}

interface RpcResult {
  status: string;
  draw_number?: number;
  job_id?: string;
  invoice_ids?: string[];
  new_lien_releases?: number;
  current_payment_due?: number;
  scheduled_payment_count?: number;
  releases_marked_not_required?: number;
}

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

    const ctx = await getClientForRequest();
    if (!ctx.ok) {
      return NextResponse.json(
        { error: `Impersonation rejected: ${ctx.reason}` },
        { status: 401 }
      );
    }
    const supabase = ctx.client;
    const { action, reason, expected_updated_at } = (await request.json()) as {
      action: string;
      reason?: string;
      expected_updated_at?: string;
    };

    const rule = ACTION_MAP[action];
    if (!rule) {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Fetch draw for state validation + post-RPC notification context.
    const { data: draw, error: fetchError } = await supabase
      .from("draws")
      .select(
        "id, job_id, org_id, status, status_history, draw_number, revision_number, period_end, is_final, current_payment_due, created_by"
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

    const { data: { user: actor } } = await supabase.auth.getUser();
    const actorId = actor?.id ?? null;

    // ── RPC-based cascades ────────────────────────────────────────────
    if (action === "submit") {
      const forceFail = readForceFail("FORCE_LIEN_GEN_FAIL", "lien_gen", request);
      const { data, error } = await supabase.rpc("draw_submit_rpc", {
        _draw_id: params.id,
        _actor_user_id: actorId,
        _reason: reason ?? null,
        _expected_updated_at: expected_updated_at ?? null,
        _force_fail: forceFail,
      });
      if (error) {
        const { status, body } = rpcErrorToHttp(error);
        return NextResponse.json(body, { status });
      }
      const result = (data ?? {}) as RpcResult;

      // Post-commit: budget/PO recalc + email dispatch + activity log.
      try {
        if (result.invoice_ids && result.invoice_ids.length > 0) {
          const { data: lines } = await supabase
            .from("invoice_line_items")
            .select("budget_line_id, po_id")
            .in("invoice_id", result.invoice_ids)
            .is("deleted_at", null);
          await recalcLinesAndPOs(
            (lines ?? []).map((l) => l.budget_line_id as string),
            (lines ?? []).map((l) => l.po_id as string)
          );
        }
      } catch (err) {
        console.warn(`[draw submit recalc] ${err instanceof Error ? err.message : err}`);
      }

      try {
        const { data: jobRow } = await supabase
          .from("jobs")
          .select("name")
          .eq("id", draw.job_id as string)
          .eq("org_id", orgId)
          .maybeSingle();
        const jobName = jobRow?.name ?? "a job";
        const drawNum = result.draw_number ?? draw.draw_number;
        const amt = `$${Math.round((result.current_payment_due ?? 0) / 100).toLocaleString("en-US")}`;
        if ((result.new_lien_releases ?? 0) > 0) {
          await dispatchEmailToOrgRoles(orgId, ["accounting", "admin"], {
            subject: `${result.new_lien_releases} lien release(s) needed — Draw #${drawNum}`,
            body: `Draw #${drawNum} on ${jobName} was submitted. ${result.new_lien_releases} vendor lien release(s) need to be collected.`,
            action_url: `/draws/${params.id}`,
          });
        }
        await dispatchEmailToOrgRoles(orgId, ["owner", "admin"], {
          subject: `Draw #${drawNum} submitted — ${jobName}`,
          body: `Draw #${drawNum} for ${jobName} (${amt}) submitted for approval.`,
          action_url: `/draws/${params.id}`,
        });
      } catch (err) {
        console.warn(`[draw submit email] ${err instanceof Error ? err.message : err}`);
      }

      await logStatusChange({
        org_id: orgId,
        entity_type: "draw",
        entity_id: params.id,
        from: draw.status,
        to: "submitted",
        reason,
      });
      if ((result.new_lien_releases ?? 0) > 0) {
        await logActivity({
          org_id: orgId,
          entity_type: "draw",
          entity_id: params.id,
          action: "updated",
          details: { auto_generated_lien_releases: result.new_lien_releases },
        });
      }

      await logImpersonatedWrite(ctx, {
        target_record_type: "draw",
        target_record_id: params.id,
        details: { action, from: draw.status, to: "submitted", reason },
        route: `/api/draws/${params.id}/action`,
        method: "POST",
      });

      return NextResponse.json({ status: "submitted" });
    }

    if (action === "approve") {
      const forceFail = readForceFail("FORCE_APPROVE_FAIL", "approve", request);
      const { data, error } = await supabase.rpc("draw_approve_rpc", {
        _draw_id: params.id,
        _actor_user_id: actorId,
        _reason: reason ?? null,
        _expected_updated_at: expected_updated_at ?? null,
        _force_fail: forceFail,
      });
      if (error) {
        const { status, body } = rpcErrorToHttp(error);
        return NextResponse.json(body, { status });
      }
      const result = (data ?? {}) as RpcResult;

      // Post-commit: email dispatch to draw creator + activity log.
      try {
        if (draw.created_by) {
          await dispatchEmailToUser(draw.created_by as string, orgId, {
            subject: `Draw #${result.draw_number ?? draw.draw_number} approved`,
            body: `Your draw submission has been approved.`,
            action_url: `/draws/${params.id}`,
          });
        }
      } catch (err) {
        console.warn(`[draw approve email] ${err instanceof Error ? err.message : err}`);
      }

      await logStatusChange({
        org_id: orgId,
        entity_type: "draw",
        entity_id: params.id,
        from: draw.status,
        to: "approved",
        reason,
      });
      if ((result.scheduled_payment_count ?? 0) > 0) {
        await logActivity({
          org_id: orgId,
          entity_type: "draw",
          entity_id: params.id,
          action: "updated",
          details: { auto_scheduled_payments: result.scheduled_payment_count },
        });
      }

      await logImpersonatedWrite(ctx, {
        target_record_type: "draw",
        target_record_id: params.id,
        details: { action, from: draw.status, to: "approved", reason },
        route: `/api/draws/${params.id}/action`,
        method: "POST",
      });

      return NextResponse.json({ status: "approved" });
    }

    if (action === "void") {
      const { data, error } = await supabase.rpc("draw_void_rpc", {
        _draw_id: params.id,
        _actor_user_id: actorId,
        _reason: reason ?? null,
        _expected_updated_at: expected_updated_at ?? null,
        _force_fail: null,
      });
      if (error) {
        const { status, body } = rpcErrorToHttp(error);
        return NextResponse.json(body, { status });
      }
      const result = (data ?? {}) as RpcResult;

      // Post-commit: recalc on now-detached invoice lines.
      try {
        if (result.invoice_ids && result.invoice_ids.length > 0) {
          const { data: lines } = await supabase
            .from("invoice_line_items")
            .select("budget_line_id, po_id")
            .in("invoice_id", result.invoice_ids)
            .is("deleted_at", null);
          await recalcLinesAndPOs(
            (lines ?? []).map((l) => l.budget_line_id as string),
            (lines ?? []).map((l) => l.po_id as string)
          );
        }
      } catch (err) {
        console.warn(`[draw void recalc] ${err instanceof Error ? err.message : err}`);
      }

      await logStatusChange({
        org_id: orgId,
        entity_type: "draw",
        entity_id: params.id,
        from: draw.status,
        to: "void",
        reason,
      });

      await logImpersonatedWrite(ctx, {
        target_record_type: "draw",
        target_record_id: params.id,
        details: { action, from: draw.status, to: "void", reason },
        route: `/api/draws/${params.id}/action`,
        method: "POST",
      });

      return NextResponse.json({ status: "void" });
    }

    // ── Non-RPC actions (lock, mark_paid, send_back, mark_submitted) ──
    // These keep the existing TS flow because Phase 1.3 scope was the three
    // cascade RPCs only. send_back's cascade is a known follow-up.
    const nowIso = new Date().toISOString();
    const existingHistory = Array.isArray(draw.status_history) ? draw.status_history : [];
    const statusEntry = {
      who: actorId ?? "user",
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

    // send_back cascade (revert in_draw invoices to qa_approved).
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

    await logStatusChange({
      org_id: orgId,
      entity_type: "draw",
      entity_id: params.id,
      from: draw.status,
      to: rule.next,
      reason,
    });

    await logImpersonatedWrite(ctx, {
      target_record_type: "draw",
      target_record_id: params.id,
      details: { action, from: draw.status, to: rule.next, reason },
      route: `/api/draws/${params.id}/action`,
      method: "POST",
    });

    return NextResponse.json({ status: rule.next });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
