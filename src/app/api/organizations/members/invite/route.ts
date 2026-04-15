import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ApiError, withApiError } from "@/lib/api/errors";
import { ADMIN_OR_OWNER, requireRole } from "@/lib/org/require";

export const dynamic = "force-dynamic";

const VALID_ROLES = new Set(["owner", "admin", "pm", "accounting"]);

export const POST = withApiError(async (request: NextRequest) => {
  const membership = await requireRole(ADMIN_OR_OWNER);
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", 401);

  const body = (await request.json()) as { email?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  const role = body.role;
  if (!email) throw new ApiError("Email is required", 400);
  if (!role || !VALID_ROLES.has(role)) throw new ApiError("Invalid role", 400);

  // If they're already a member, bail. (UNIQUE on org_invites(org_id,email) also
  // blocks duplicate pending invites.)
  const { data: existingMember } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingMember) {
    const { data: alreadyMember } = await supabase
      .from("org_members")
      .select("id")
      .eq("org_id", membership.org_id)
      .eq("user_id", existingMember.id)
      .maybeSingle();
    if (alreadyMember) {
      throw new ApiError("That user is already a member of this organization.", 409);
    }
  }

  const { data: invite, error } = await supabase
    .from("org_invites")
    .insert({
      org_id: membership.org_id,
      email,
      role,
      invited_by: user.id,
    })
    .select("id, token")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ApiError("An invite for that email is already pending.", 409);
    }
    throw new ApiError(error.message, 500);
  }

  const origin = request.headers.get("origin") ?? request.nextUrl.origin;
  const inviteUrl = `${origin}/signup?invite=${invite.token}`;

  return NextResponse.json({ invite_id: invite.id, invite_url: inviteUrl });
});
