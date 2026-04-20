import { createServerClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

export type PlatformAdminRole = "staff" | "support" | "engineer";

export type PlatformAdmin = {
  user_id: string;
  role: PlatformAdminRole;
  created_at: string;
  created_by: string | null;
  notes: string | null;
};

/**
 * Return the current user's platform_admin record, or null if they're
 * not a platform admin (or not logged in). RLS on platform_admins allows
 * self-read, so this works for any authenticated user.
 */
export async function getPlatformAdmin(): Promise<PlatformAdmin | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("platform_admins")
    .select("user_id, role, created_at, created_by, notes")
    .eq("user_id", user.id)
    .maybeSingle();

  return (data as PlatformAdmin | null) ?? null;
}

/**
 * Throws if the caller isn't a platform admin. Use at the top of every
 * route handler under /api/admin/platform/* so an auth lapse returns a
 * clear error instead of silently doing nothing.
 *
 * The caller decides how to respond — in API routes, catch this and
 * return a 401/403. In server components, let it propagate so Next
 * renders error.tsx (or use the middleware redirect instead for UX).
 */
export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const admin = await getPlatformAdmin();
  if (!admin) {
    throw new Error("Platform admin required");
  }
  return admin;
}

/**
 * Fast-path check that reads the trusted `x-platform-admin` header
 * stashed by middleware. Avoids the extra auth.getUser() + table
 * lookup on hot API paths. Returns null if the header isn't set —
 * callers should fall back to `getPlatformAdmin()` in that case.
 *
 * SECURITY: middleware strips any inbound `x-platform-admin` header
 * before setting its own (see updateSession in lib/supabase/middleware.ts).
 * A client cannot forge this.
 */
export function getPlatformAdminFromRequest(req: NextRequest): { user_id: string; role: PlatformAdminRole } | null {
  const userId = req.headers.get("x-user-id");
  const isAdmin = req.headers.get("x-platform-admin");
  const role = req.headers.get("x-platform-admin-role");
  if (!userId || isAdmin !== "1" || !role) return null;
  return { user_id: userId, role: role as PlatformAdminRole };
}
