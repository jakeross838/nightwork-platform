/**
 * Notifications — email via Resend + in-app notification rows.
 *
 * Design principles:
 *   - Failure here NEVER blocks the main action. Every network/DB call is
 *     wrapped so a missing API key or a 500 from Resend produces a console
 *     warning, not a thrown error that rolls back the invoice approval.
 *   - One helper, `sendNotification`, covers both channels. Callers only need
 *     `to_email`, a title/body, and metadata — the helper handles rate-limited
 *     Resend dispatch, the notifications row insert, and per-user opt-outs.
 *   - All inserts use the service-role client because the trigger is called
 *     from API routes where the session user may not have write access to
 *     another user's row in `notifications`.
 */

import { tryCreateServiceRoleClient } from "@/lib/supabase/service";

export type NotificationType =
  | "invoice_uploaded"
  | "invoice_pm_approved"
  | "invoice_pm_denied"
  | "invoice_qa_approved"
  | "draw_created"
  | "draw_submitted"
  | "draw_approved"
  | "lien_release_pending"
  | "payment_scheduled"
  | "invoice_overdue";

export interface SendNotificationArgs {
  /** Recipient email (optional — if omitted only in-app row is created) */
  to_email?: string | null;
  /** Recipient user_id — required for the in-app row. If omitted, email-only. */
  user_id?: string | null;
  org_id: string;
  notification_type: NotificationType;
  /** Plain-text title shown in the bell dropdown and used as the email subject */
  subject: string;
  /** Short body shown in the bell dropdown */
  body: string;
  /** Optional HTML body — defaults to a wrapper around `body` */
  html_body?: string;
  /** Where the bell click lands the user (e.g. /invoices/123) */
  action_url?: string;
  /** FK into the entity this notification is about (e.g. invoice_id) */
  related_entity_id?: string;
}

const RESEND_API_URL = "https://api.resend.com/emails";

function defaultHtmlBody(subject: string, body: string, action_url?: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://nightwork.build";
  const link = action_url
    ? `${appUrl.replace(/\/$/, "")}${action_url.startsWith("/") ? action_url : `/${action_url}`}`
    : appUrl;
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #FAF7F2; padding: 32px; margin: 0;">
    <div style="max-width: 560px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E8E0D0; padding: 32px;">
      <h1 style="font-size: 20px; color: #2B3A42; margin: 0 0 12px;">${escapeHtml(subject)}</h1>
      <p style="font-size: 15px; color: #4A5560; line-height: 1.6; margin: 0 0 24px;">${escapeHtml(body)}</p>
      <a href="${link}" style="display: inline-block; background: #3F5862; color: #FFFFFF; padding: 10px 20px; text-decoration: none; font-size: 14px; letter-spacing: 0.04em;">Open in Nightwork</a>
      <p style="font-size: 12px; color: #8A8778; margin: 32px 0 0;">You're receiving this because you're on this invoice or draw. Adjust notifications in your Nightwork settings.</p>
    </div>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Dispatch a notification to a single user. Best-effort: logs on failure but
 * never throws so it can be fire-and-forgotten from an API route.
 */
export async function sendNotification(args: SendNotificationArgs): Promise<void> {
  const {
    to_email,
    user_id,
    org_id,
    notification_type,
    subject,
    body,
    html_body,
    action_url,
  } = args;

  // 1) Log in-app notification row (always, even if email is skipped)
  if (user_id) {
    await logInAppNotification({
      user_id,
      org_id,
      notification_type,
      subject,
      body,
      action_url,
    });
  }

  // 2) Send email via Resend if we have an address and the user has opted in.
  if (to_email && user_id) {
    const optedIn = await userHasEmailEnabled(user_id, org_id);
    if (!optedIn) return;
  }
  if (!to_email) return;

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.NOTIFICATION_FROM_EMAIL ?? "notifications@nightwork.build";

  // If the key isn't configured (dev env), skip the network call.
  if (!apiKey || apiKey === "re_placeholder" || apiKey.length < 10) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[notifications] RESEND_API_KEY not configured — would have sent "${subject}" to ${to_email}`
      );
    }
    return;
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Nightwork <${fromEmail}>`,
        to: [to_email],
        subject,
        html: html_body ?? defaultHtmlBody(subject, body, action_url),
        text: body,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        `[notifications] Resend failed: ${res.status} ${res.statusText} — ${text.slice(0, 200)}`
      );
    }
  } catch (err) {
    console.warn(
      `[notifications] Resend network error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function logInAppNotification(args: {
  user_id: string;
  org_id: string;
  notification_type: NotificationType;
  subject: string;
  body: string;
  action_url?: string;
}): Promise<void> {
  const svc = tryCreateServiceRoleClient();
  if (!svc) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[notifications] No service-role client; skipping in-app notification for ${args.user_id}`
      );
    }
    return;
  }
  try {
    const { error } = await svc.from("notifications").insert({
      user_id: args.user_id,
      org_id: args.org_id,
      type: args.notification_type,
      title: args.subject,
      body: args.body,
      action_url: args.action_url ?? null,
    });
    if (error) {
      console.warn(`[notifications] Insert failed: ${error.message}`);
    }
  } catch (err) {
    console.warn(
      `[notifications] Insert error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function userHasEmailEnabled(
  user_id: string,
  org_id: string
): Promise<boolean> {
  const svc = tryCreateServiceRoleClient();
  if (!svc) return true; // default opt-in when we can't check
  try {
    const { data } = await svc
      .from("org_members")
      .select("email_notifications_enabled")
      .eq("user_id", user_id)
      .eq("org_id", org_id)
      .eq("is_active", true)
      .maybeSingle();
    return data?.email_notifications_enabled !== false;
  } catch {
    return true;
  }
}

/**
 * Convenience: resolve all PMs for a job (assigned PM + job's pm_id) and send
 * them the same notification. Used by the invoice upload flow.
 */
export async function notifyPmsForJob(
  job_id: string,
  org_id: string,
  payload: Omit<
    SendNotificationArgs,
    "user_id" | "to_email" | "org_id"
  >
): Promise<void> {
  const svc = tryCreateServiceRoleClient();
  if (!svc) return;
  try {
    const { data: job } = await svc
      .from("jobs")
      .select("pm_id")
      .eq("id", job_id)
      .maybeSingle();
    const pmIds = new Set<string>();
    if (job?.pm_id) pmIds.add(job.pm_id as string);

    // Also include anyone with role="pm" in the org — keeps the MVP simple.
    const { data: members } = await svc
      .from("org_members")
      .select("user_id, role, email_notifications_enabled")
      .eq("org_id", org_id)
      .eq("is_active", true)
      .in("role", ["pm", "admin", "owner"]);
    for (const m of members ?? []) {
      if (m.user_id) pmIds.add(m.user_id as string);
    }

    if (pmIds.size === 0) return;

    const { data: profiles } = await svc
      .from("profiles")
      .select("id, email, full_name")
      .in("id", Array.from(pmIds));

    await Promise.all(
      (profiles ?? []).map((p) =>
        sendNotification({
          ...payload,
          user_id: p.id as string,
          to_email: (p.email as string | null) ?? null,
          org_id,
        })
      )
    );
  } catch (err) {
    console.warn(
      `[notifications] notifyPmsForJob error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Convenience: notify everyone in the org with a given role (e.g.
 * "accounting" when an invoice moves to QA review).
 */
export async function notifyRole(
  org_id: string,
  roles: Array<"admin" | "owner" | "pm" | "accounting">,
  payload: Omit<
    SendNotificationArgs,
    "user_id" | "to_email" | "org_id"
  >
): Promise<void> {
  const svc = tryCreateServiceRoleClient();
  if (!svc) return;
  try {
    const { data: members } = await svc
      .from("org_members")
      .select("user_id")
      .eq("org_id", org_id)
      .eq("is_active", true)
      .in("role", roles);
    if (!members || members.length === 0) return;

    const { data: profiles } = await svc
      .from("profiles")
      .select("id, email, full_name")
      .in(
        "id",
        members.map((m) => m.user_id as string)
      );

    await Promise.all(
      (profiles ?? []).map((p) =>
        sendNotification({
          ...payload,
          user_id: p.id as string,
          to_email: (p.email as string | null) ?? null,
          org_id,
        })
      )
    );
  } catch (err) {
    console.warn(
      `[notifications] notifyRole error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Convenience: notify a single user by user_id.
 */
export async function notifyUser(
  user_id: string,
  org_id: string,
  payload: Omit<SendNotificationArgs, "user_id" | "to_email" | "org_id">
): Promise<void> {
  const svc = tryCreateServiceRoleClient();
  if (!svc) return;
  try {
    const { data: profile } = await svc
      .from("profiles")
      .select("id, email")
      .eq("id", user_id)
      .maybeSingle();
    await sendNotification({
      ...payload,
      user_id,
      to_email: (profile?.email as string | null) ?? null,
      org_id,
    });
  } catch (err) {
    console.warn(
      `[notifications] notifyUser error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ───── Phase 1.3: post-RPC email dispatch ─────────────────────────────
//
// The draw-cascade RPCs (draw_submit_rpc / draw_approve_rpc) insert
// in-app notification rows inside the transaction. After the RPC commits,
// the route needs to send the matching emails — without inserting duplicate
// in-app rows.
//
// `dispatchEmailToOrgRoles` / `dispatchEmailToUser` are email-only
// counterparts to `notifyRole` / `notifyUser`. They resolve recipient
// profiles + opt-in state and call Resend, but skip the
// `logInAppNotification` call (the RPC did that).

async function sendEmailOnly(args: {
  to_email: string | null;
  user_id: string;
  org_id: string;
  subject: string;
  body: string;
  html_body?: string;
  action_url?: string;
}): Promise<void> {
  const { to_email, user_id, org_id, subject, body, html_body, action_url } = args;
  if (!to_email) return;

  const optedIn = await userHasEmailEnabled(user_id, org_id);
  if (!optedIn) return;

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.NOTIFICATION_FROM_EMAIL ?? "notifications@nightwork.build";

  if (!apiKey || apiKey === "re_placeholder" || apiKey.length < 10) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[notifications] RESEND_API_KEY not configured — would have sent "${subject}" to ${to_email}`
      );
    }
    return;
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Nightwork <${fromEmail}>`,
        to: [to_email],
        subject,
        html: html_body ?? defaultHtmlBody(subject, body, action_url),
        text: body,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        `[notifications] Resend failed: ${res.status} ${res.statusText} — ${text.slice(0, 200)}`
      );
    }
  } catch (err) {
    console.warn(
      `[notifications] Resend network error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Email-only dispatch to every active member of `org_id` whose role is in
 * `roles`. Used by routes after an atomic RPC has already inserted the
 * in-app notification rows.
 */
export async function dispatchEmailToOrgRoles(
  org_id: string,
  roles: Array<"admin" | "owner" | "pm" | "accounting">,
  payload: { subject: string; body: string; action_url?: string; html_body?: string }
): Promise<void> {
  const svc = tryCreateServiceRoleClient();
  if (!svc) return;
  try {
    const { data: members } = await svc
      .from("org_members")
      .select("user_id")
      .eq("org_id", org_id)
      .eq("is_active", true)
      .in("role", roles);
    if (!members || members.length === 0) return;

    const { data: profiles } = await svc
      .from("profiles")
      .select("id, email")
      .in("id", members.map((m) => m.user_id as string));

    await Promise.all(
      (profiles ?? []).map((p) =>
        sendEmailOnly({
          ...payload,
          user_id: p.id as string,
          to_email: (p.email as string | null) ?? null,
          org_id,
        })
      )
    );
  } catch (err) {
    console.warn(
      `[notifications] dispatchEmailToOrgRoles error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Email-only dispatch to a single user. Counterpart to `notifyUser` for
 * post-RPC flows.
 */
export async function dispatchEmailToUser(
  user_id: string,
  org_id: string,
  payload: { subject: string; body: string; action_url?: string; html_body?: string }
): Promise<void> {
  const svc = tryCreateServiceRoleClient();
  if (!svc) return;
  try {
    const { data: profile } = await svc
      .from("profiles")
      .select("id, email")
      .eq("id", user_id)
      .maybeSingle();
    await sendEmailOnly({
      ...payload,
      user_id,
      to_email: (profile?.email as string | null) ?? null,
      org_id,
    });
  } catch (err) {
    console.warn(
      `[notifications] dispatchEmailToUser error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
