import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { writePlatformAudit } from "@/lib/auth/platform-admin-audit";

/**
 * What route handlers get back from getClientForRequest.
 *
 *  - `ok: true, isImpersonation: false` — normal user session. Use
 *    `client` exactly like you would `createServerClient()`.
 *  - `ok: true, isImpersonation: true` — platform admin is
 *    impersonating. `client` is a service-role client; RLS is bypassed
 *    so cross-org writes succeed. Caller is expected to call
 *    `logImpersonatedWrite` after every successful mutation so the
 *    platform_admin_audit row captures the change.
 *  - `ok: false` — a tampered cookie was rejected. Caller should
 *    return 401; the helper has already cleared the cookie and written
 *    an `impersonation_security_fail` audit row.
 */
export type ImpersonationContext =
  | { ok: true; isImpersonation: false; client: SupabaseClient }
  | {
      ok: true;
      isImpersonation: true;
      client: SupabaseClient;
      targetOrgId: string;
      adminUserId: string;
      auditStartId: string | null;
    }
  | { ok: false; reason: string };

type ParsedCookie = {
  admin_user_id?: string;
  target_org_id?: string;
  started_at?: string;
  audit_id?: string;
};

const ONE_HOUR_MS = 60 * 60 * 1000;

function clearCookie(): void {
  try {
    cookies().set("nw_impersonate", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
  } catch {
    // Server component render may be read-only — best effort.
  }
}

async function writeSecurityFail(
  adminUserId: string | null,
  targetOrgId: string | null,
  reason: string
): Promise<void> {
  // We can only insert a row when we have a non-null admin_user_id (FK
  // constraint). If the user is anonymous, skip — there's nothing
  // accountable to record, and clearing the cookie is sufficient.
  if (!adminUserId) return;
  await writePlatformAudit({
    admin_user_id: adminUserId,
    action: "impersonation_security_fail",
    target_org_id: targetOrgId,
    details: { reason },
    reason: `Impersonation rejected: ${reason}`,
  });
}

/**
 * Resolve the right Supabase client for the current request. Reads
 * `nw_impersonate` from cookies, verifies the caller is actually a
 * platform admin, and returns either a user-session client (normal
 * case) or a service-role client (during active impersonation).
 *
 * Rejects tampered cookies with ok:false — clears the cookie and
 * writes an audit row when we know who tried.
 */
export async function getClientForRequest(): Promise<ImpersonationContext> {
  const cookieStore = cookies();
  const raw = cookieStore.get("nw_impersonate")?.value;

  if (!raw) {
    return { ok: true, isImpersonation: false, client: createServerClient() };
  }

  // Parse the cookie. Any parse failure is suspicious — treat as
  // tamper.
  let parsed: ParsedCookie;
  try {
    parsed = JSON.parse(raw) as ParsedCookie;
  } catch {
    clearCookie();
    const userClient = createServerClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();
    await writeSecurityFail(user?.id ?? null, null, "malformed_cookie");
    return { ok: false, reason: "malformed_cookie" };
  }

  // Grab the user session. If there isn't one, the cookie is stale —
  // just clear it and proceed without impersonation. No audit row
  // because there's no one to attribute it to.
  const userClient = createServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    clearCookie();
    return { ok: true, isImpersonation: false, client: userClient };
  }

  // Tamper check: admin_user_id in the cookie must match the signed-in
  // user. An attacker who swaps in another user's cookie would land
  // here.
  if (parsed.admin_user_id && parsed.admin_user_id !== user.id) {
    clearCookie();
    await writeSecurityFail(
      user.id,
      parsed.target_org_id ?? null,
      "admin_id_mismatch"
    );
    return { ok: false, reason: "admin_id_mismatch" };
  }

  // Verify they're actually in the platform_admins table. A cookie
  // manually assembled by someone who isn't staff lands here.
  const { data: pa } = await userClient
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!pa) {
    clearCookie();
    await writeSecurityFail(
      user.id,
      parsed.target_org_id ?? null,
      "not_platform_admin"
    );
    return { ok: false, reason: "not_platform_admin" };
  }

  // Expired or missing target — downgrade to no-impersonation rather
  // than treating as tamper.
  const startedAt = parsed.started_at ? new Date(parsed.started_at) : null;
  const ageMs = startedAt ? Date.now() - startedAt.getTime() : Infinity;
  if (ageMs >= ONE_HOUR_MS || !parsed.target_org_id) {
    clearCookie();
    return { ok: true, isImpersonation: false, client: userClient };
  }

  // All checks passed — return the service-role client so RLS does
  // not reject cross-org writes.
  return {
    ok: true,
    isImpersonation: true,
    client: createServiceRoleClient(),
    targetOrgId: parsed.target_org_id,
    adminUserId: user.id,
    auditStartId: parsed.audit_id ?? null,
  };
}

/**
 * Log a record_edit row to platform_admin_audit after a successful
 * mutation. No-ops when not impersonating. Safe to call
 * unconditionally from a route handler right after the write.
 *
 * `details` is whatever context helps you reconstruct the change
 * later — usually the request body, the before/after row, or
 * both. Keep it under a few KB; the field is JSONB so it's flexible
 * but bloating rows makes audit queries slow.
 */
export async function logImpersonatedWrite(
  ctx: ImpersonationContext,
  args: {
    target_record_type: string;
    target_record_id: string | null;
    details?: Record<string, unknown> | null;
    route?: string;
    method?: string;
  }
): Promise<void> {
  if (!ctx.ok || !ctx.isImpersonation) return;
  await writePlatformAudit({
    admin_user_id: ctx.adminUserId,
    action: "record_edit",
    target_org_id: ctx.targetOrgId,
    target_record_type: args.target_record_type,
    target_record_id: args.target_record_id,
    details: {
      ...(args.details ?? {}),
      ...(args.route ? { route: args.route } : {}),
      ...(args.method ? { method: args.method } : {}),
      impersonation_start_audit_id: ctx.auditStartId,
    },
    reason: `Mutation during impersonation`,
  });
}
