import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Phase 8f wizard draft persistence.
 *
 * GET    /api/draws/drafts            → list draft draws with wizard_draft state
 * POST   /api/draws/drafts            → create or update a draft (auto-save)
 *                                        body: { id?, job_id?, wizard_draft }
 * DELETE /api/draws/drafts?id=...     → discard a draft (soft-delete the row)
 *
 * Drafts live as actual draws rows with status='draft' and wizard_draft set.
 * They are listed on the draws page as "Resume draft" cards.
 */

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("draws")
      .select(
        "id, job_id, draw_number, status, wizard_draft, updated_at, jobs:job_id (id, name, address)"
      )
      .eq("status", "draft")
      .not("wizard_draft", "is", null)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = (await request.json()) as {
      id?: string;
      wizard_draft?: Record<string, unknown>;
    };

    if (!body.wizard_draft) {
      return NextResponse.json({ error: "wizard_draft required" }, { status: 400 });
    }

    if (body.id) {
      const { error } = await supabase
        .from("draws")
        .update({ wizard_draft: body.wizard_draft })
        .eq("id", body.id)
        .eq("status", "draft");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ id: body.id });
    }

    // No id yet — this is the first auto-save. Don't create a draws row yet
    // (would mess up draw_number sequencing); return a synthetic local-only id.
    // The caller will only persist a real row on submit. For UX purposes the
    // wizard keeps the draft in localStorage until it's bound to a real draw.
    return NextResponse.json({ id: null });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Discard = soft-delete the draft draw and clear its wizard_draft.
    const { error } = await supabase
      .from("draws")
      .update({ deleted_at: new Date().toISOString(), wizard_draft: null })
      .eq("id", id)
      .eq("status", "draft");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
