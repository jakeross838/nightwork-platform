import { NextResponse, type NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getCurrentMembership } from "@/lib/org/session";
import { callClaude, PlanLimitError } from "@/lib/claude";
import { SUPPORT_SYSTEM_PROMPT } from "@/lib/support/system-prompt";
import { SUPPORT_TOOLS } from "@/lib/support/tools";
import { runTool, type ToolContext } from "@/lib/support/tool-handlers";

// Sonnet 4.6 alias — Anthropic resolves this to the latest Sonnet 4.6
// snapshot. Kept here so the model choice is obvious at the route level.
const MODEL_ID = "claude-sonnet-4-6";

const MAX_TOOL_ITERATIONS = 5;
const MAX_MESSAGES_PER_CONVERSATION = 30;
const MAX_MESSAGES_PER_USER_PER_HOUR = 100;
const MAX_USER_MESSAGE_LEN = 4000;

type ChatBody = {
  conversation_id?: string;
  message?: string;
  page_url?: string;
};

type AnthropicMessage = Anthropic.Messages.MessageParam;
type ContentBlock = Anthropic.Messages.ContentBlock;
type ToolUseBlock = Anthropic.Messages.ToolUseBlock;
type TextBlock = Anthropic.Messages.TextBlock;
type ToolRecord = {
  name: string;
  input: Record<string, unknown>;
  output: string;
};

export async function POST(request: NextRequest) {
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

  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (message.length > MAX_USER_MESSAGE_LEN) {
    return NextResponse.json(
      { error: `Message must be ${MAX_USER_MESSAGE_LEN} characters or fewer` },
      { status: 400 }
    );
  }

  // User-level hourly rate limit.
  const svc = createServiceRoleClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: hourlyCount } = await svc
    .from("support_messages")
    .select("id, conversation_id, support_conversations!inner(user_id)", {
      count: "exact",
      head: true,
    })
    .eq("support_conversations.user_id", user.id)
    .eq("role", "user")
    .gte("created_at", oneHourAgo);
  if ((hourlyCount ?? 0) >= MAX_MESSAGES_PER_USER_PER_HOUR) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in an hour." },
      { status: 429 }
    );
  }

  // Resolve conversation: either existing + owned, or create new.
  let conversationId = typeof body.conversation_id === "string" ? body.conversation_id : "";
  if (conversationId) {
    const { data: existing } = await supabase
      .from("support_conversations")
      .select("id, user_id, status")
      .eq("id", conversationId)
      .maybeSingle();
    const conv = existing as
      | { id: string; user_id: string; status: string }
      | null;
    if (!conv || conv.user_id !== user.id) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }
    // Per-conversation cap on USER turns so an escalated thread doesn't grow forever.
    const { count: userMsgCount } = await svc
      .from("support_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .eq("role", "user");
    if ((userMsgCount ?? 0) >= MAX_MESSAGES_PER_CONVERSATION) {
      return NextResponse.json(
        {
          error:
            "This conversation is at its message limit. Please start a new one.",
        },
        { status: 429 }
      );
    }
  } else {
    const title = message.slice(0, 60);
    const { data: created, error: createErr } = await supabase
      .from("support_conversations")
      .insert({
        user_id: user.id,
        org_id: membership.org_id,
        title,
        status: "active",
      })
      .select("id")
      .single();
    if (createErr || !created) {
      return NextResponse.json(
        { error: `Could not create conversation: ${createErr?.message ?? "unknown"}` },
        { status: 500 }
      );
    }
    conversationId = (created as { id: string }).id;
  }

  // Insert user message.
  const { error: insertUserErr } = await supabase
    .from("support_messages")
    .insert({
      conversation_id: conversationId,
      role: "user",
      content: message,
    });
  if (insertUserErr) {
    return NextResponse.json(
      { error: `Could not save message: ${insertUserErr.message}` },
      { status: 500 }
    );
  }

  // Load full conversation history (all messages, ordered). RLS ensures
  // the user only sees their own; we already verified ownership above.
  const { data: historyRows } = await supabase
    .from("support_messages")
    .select("role, content, tool_calls, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const history = (historyRows ?? []) as Array<{
    role: "user" | "assistant";
    content: string;
    tool_calls: ToolRecord[] | null;
    created_at: string;
  }>;

  // Build Anthropic messages. For simplicity we use text-only message
  // blocks when replaying history — any previous tool_use/tool_result
  // rounds are captured inside the text content already, and the user
  // turns need to stay alternating. This means past tool calls don't
  // survive across turns, but for short support threads that's fine.
  const messages: AnthropicMessage[] = history.map((row) => ({
    role: row.role,
    content: row.content,
  }));

  const impersonationActive =
    request.headers.get("x-impersonation-active") === "1";
  const pageUrl =
    typeof body.page_url === "string" ? body.page_url.slice(0, 500) : null;

  const toolCtx: ToolContext = {
    supabase,
    userId: user.id,
    orgId: membership.org_id,
    role: membership.role,
    pageUrl,
    impersonationActive,
    conversationId,
  };

  // Tool-call loop. Cap at MAX_TOOL_ITERATIONS to prevent runaway.
  const toolsUsed: ToolRecord[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalAssistantText = "";
  let escalated = false;

  let iterations = 0;
  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;
    let response: Anthropic.Messages.Message;
    try {
      response = await callClaude({
        model: MODEL_ID,
        max_tokens: 2048,
        system: SUPPORT_SYSTEM_PROMPT,
        tools: SUPPORT_TOOLS,
        messages,
        function_type: "support_chat",
        org_id: membership.org_id,
        user_id: user.id,
        metadata: { conversation_id: conversationId, iteration: iterations },
      });
    } catch (err) {
      if (err instanceof PlanLimitError) {
        return NextResponse.json(
          {
            error:
              "Your organization has reached its monthly AI usage limit. Upgrade your plan to continue using support chat.",
          },
          { status: 402 }
        );
      }
      console.error("[support-chat] Claude call failed:", err);
      return NextResponse.json(
        {
          error:
            "We couldn't reach the AI right now. Please try again in a moment.",
        },
        { status: 502 }
      );
    }

    totalInputTokens += response.usage?.input_tokens ?? 0;
    totalOutputTokens += response.usage?.output_tokens ?? 0;

    const contentBlocks = response.content as ContentBlock[];
    const toolUses: ToolUseBlock[] = contentBlocks.filter(
      (b): b is ToolUseBlock => b.type === "tool_use"
    );
    const textBlocks: TextBlock[] = contentBlocks.filter(
      (b): b is TextBlock => b.type === "text"
    );

    // Capture partial text so the final user-facing answer is a join of
    // any reasoning text across iterations (usually only the last one has
    // user-facing content).
    if (textBlocks.length > 0) {
      const joined = textBlocks.map((b) => b.text).join("\n\n").trim();
      if (joined) finalAssistantText = joined;
    }

    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      break;
    }

    // Append the assistant turn (with tool_use blocks) + the tool_results
    // turn so the next API call sees the full exchange.
    messages.push({ role: "assistant", content: contentBlocks });

    const toolResultBlocks: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const input = (tu.input ?? {}) as Record<string, unknown>;
      const result = await runTool(toolCtx, tu.name, input);
      toolsUsed.push({ name: tu.name, input, output: result.text });
      if (tu.name === "escalate_to_human" && result.structured?.escalated) {
        escalated = true;
      }
      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: result.text,
      });
    }
    messages.push({ role: "user", content: toolResultBlocks });
  }

  if (!finalAssistantText) {
    // Belt-and-suspenders: if the model exhausted tool iterations without
    // producing text, give the user a readable stub.
    finalAssistantText =
      "I had trouble composing a full answer. Could you rephrase the question, or ask me to escalate this?";
  }

  // Persist assistant message (with tool_calls JSON if any tools ran).
  const { error: insertAssistantErr } = await supabase
    .from("support_messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: finalAssistantText,
      tool_calls: toolsUsed.length > 0 ? toolsUsed : null,
      tokens_input: totalInputTokens,
      tokens_output: totalOutputTokens,
    });
  if (insertAssistantErr) {
    console.error(
      "[support-chat] assistant message insert failed:",
      insertAssistantErr.message
    );
  }

  // Touch conversation updated_at via a no-op column update so the
  // inbox sorts this thread to the top.
  await supabase
    .from("support_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return NextResponse.json({
    conversation_id: conversationId,
    assistant_message: finalAssistantText,
    tools_used: toolsUsed.map((t) => ({ name: t.name, input: t.input })),
    escalated,
    tokens: { input: totalInputTokens, output: totalOutputTokens },
  });
}
