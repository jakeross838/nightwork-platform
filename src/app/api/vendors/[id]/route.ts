import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PatchBody {
 name?: string;
 default_cost_code_id?: string | null;
}

export async function PATCH(
 request: NextRequest,
 { params }: { params: Promise<{ id: string }> }
) {
 try {
 const { id } = await params;
 const body: PatchBody = await request.json();

 if (!body.name && body.default_cost_code_id === undefined) {
 return NextResponse.json(
 { error: "At least one field (name, default_cost_code_id) is required" },
 { status: 400 }
 );
 }

 const supabase = createServerClient();

 const updates: Record<string, unknown> = {
 updated_at: new Date().toISOString(),
 };
 if (body.name !== undefined) updates.name = body.name;
 if (body.default_cost_code_id !== undefined) updates.default_cost_code_id = body.default_cost_code_id;

 const { data, error } = await supabase
 .from("vendors")
 .update(updates)
 .eq("id", id)
 .is("deleted_at", null)
 .select("id, name, default_cost_code_id")
 .single();

 if (error) {
 console.error("Vendor update error:", error);
 return NextResponse.json(
 { error: `Failed to update vendor: ${error.message}` },
 { status: 500 }
 );
 }

 if (!data) {
 return NextResponse.json(
 { error: "Vendor not found" },
 { status: 404 }
 );
 }

 return NextResponse.json(data);
 } catch (err) {
 console.error("Vendor PATCH error:", err);
 const message = err instanceof Error ? err.message : "Unknown error";
 return NextResponse.json({ error: message }, { status: 500 });
 }
}
