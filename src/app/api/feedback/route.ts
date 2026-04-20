import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getCurrentMembership } from "@/lib/org/session";

type Category = "bug" | "confusion" | "idea" | "other";
type Severity = "low" | "medium" | "high";

const ALLOWED_CATEGORIES: Category[] = ["bug", "confusion", "idea", "other"];
const ALLOWED_SEVERITIES: Severity[] = ["low", "medium", "high"];

const RATE_LIMIT_PER_HOUR = 20;
const MAX_NOTE_LEN = 2000;

function sanitizeString(input: unknown, maxLen: number): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const category = body.category as string | undefined;
  const severity = body.severity as string | undefined;
  const noteRaw = body.note;

  if (!category || !ALLOWED_CATEGORIES.includes(category as Category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!severity || !ALLOWED_SEVERITIES.includes(severity as Severity)) {
    return NextResponse.json({ error: "Invalid severity" }, { status: 400 });
  }
  if (typeof noteRaw !== "string" || !noteRaw.trim()) {
    return NextResponse.json({ error: "Note is required" }, { status: 400 });
  }
  if (noteRaw.length > MAX_NOTE_LEN) {
    return NextResponse.json(
      { error: `Note must be ${MAX_NOTE_LEN} characters or fewer` },
      { status: 400 }
    );
  }

  // Rate limit: count the user's feedback in the last hour. Service-role
  // client so we can read across RLS boundaries cleanly — the DB is
  // authoritative across serverless instances.
  const svc = createServiceRoleClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: countError } = await svc
    .from("feedback_notes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", oneHourAgo);

  if (countError) {
    return NextResponse.json(
      { error: `Rate check failed: ${countError.message}` },
      { status: 500 }
    );
  }
  if ((recentCount ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in an hour." },
      { status: 429 }
    );
  }

  // Impersonation context from middleware-stamped headers.
  const impersonationActive = request.headers.get("x-impersonation-active") === "1";
  const impersonationAdminId = impersonationActive
    ? request.headers.get("x-impersonation-admin-user-id")
    : null;

  // Insert via the user's session client so the insert policy runs.
  // user_id MUST match auth.uid() per the policy — don't spoof it.
  const insertRecord = {
    user_id: user.id,
    org_id: membership.org_id,
    category,
    severity,
    note: noteRaw.trim(),
    page_url: sanitizeString(body.page_url, 500),
    user_role: membership.role,
    impersonation_active: impersonationActive,
    impersonation_admin_id: impersonationAdminId,
    browser: sanitizeString(body.browser, 50),
    os: sanitizeString(body.os, 50),
    theme: sanitizeString(body.theme, 20),
  };

  const { data: inserted, error: insertError } = await supabase
    .from("feedback_notes")
    .insert(insertRecord)
    .select("id")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: `Insert failed: ${insertError?.message ?? "unknown"}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: (inserted as { id: string }).id });
}
