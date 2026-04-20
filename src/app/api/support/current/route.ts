import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/org/session";

/**
 * Return the user's most-recent active or escalated conversation (if any,
 * less than 7 days old) plus its messages. Called by the chat panel on
 * open so the user resumes the last thread instead of seeing an empty
 * state each time.
 */
export async function GET() {
  const membership = await getCurrentMembership();
  if (!membership) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: conv } = await supabase
    .from("support_conversations")
    .select("id, status, title, created_at, updated_at, escalated_at, escalation_reason")
    .eq("user_id", user.id)
    .neq("status", "resolved")
    .gte("updated_at", sevenDaysAgo)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const conversation = conv as
    | {
        id: string;
        status: string;
        title: string | null;
        created_at: string;
        updated_at: string;
        escalated_at: string | null;
        escalation_reason: string | null;
      }
    | null;

  if (!conversation) {
    return NextResponse.json({ conversation: null, messages: [] });
  }

  const { data: msgs } = await supabase
    .from("support_messages")
    .select("id, role, content, tool_calls, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    conversation,
    messages: (msgs ?? []) as Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      tool_calls: Array<{ name: string; input: Record<string, unknown> }> | null;
      created_at: string;
    }>,
  });
}
