import { ApiError } from "@/lib/api/errors";
import { getCurrentMembership, type OrgMemberRole } from "@/lib/org/session";

/**
 * Throws ApiError(401)/ApiError(403) if the current user isn't a member of
 * an active org OR isn't in the allowed role list. Returns the membership
 * so the caller has `org_id` and `role` for subsequent queries.
 */
export async function requireRole(allowed: OrgMemberRole[]) {
  const membership = await getCurrentMembership();
  if (!membership) throw new ApiError("Not authenticated", 401);
  if (!allowed.includes(membership.role)) {
    throw new ApiError("Forbidden", 403);
  }
  return membership;
}

export const ADMIN_OR_OWNER: OrgMemberRole[] = ["owner", "admin"];
