import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface MergeRequest {
 primary_id: string;
 merge_ids: string[];
}

export async function POST(request: NextRequest) {
 try {
 const body: MergeRequest = await request.json();
 const { primary_id, merge_ids } = body;

 if (!primary_id || !merge_ids || merge_ids.length === 0) {
 return NextResponse.json(
 { error: "primary_id and merge_ids are required" },
 { status: 400 }
 );
 }

 // Filter out the primary from merge_ids in case it was accidentally included
 const idsToMerge = merge_ids.filter((id) => id !== primary_id);
 if (idsToMerge.length === 0) {
 return NextResponse.json(
 { error: "merge_ids must contain at least one vendor that is not the primary" },
 { status: 400 }
 );
 }

 const supabase = createServerClient();

 // Verify the primary vendor exists and is not deleted
 const { data: primary, error: primaryErr } = await supabase
 .from("vendors")
 .select("id, name")
 .eq("id", primary_id)
 .is("deleted_at", null)
 .single();

 if (primaryErr || !primary) {
 return NextResponse.json(
 { error: "Primary vendor not found" },
 { status: 404 }
 );
 }

 // Update all invoices from merged vendors to point to the primary vendor
 const { error: invoiceErr } = await supabase
 .from("invoices")
 .update({ vendor_id: primary_id, updated_at: new Date().toISOString() })
 .in("vendor_id", idsToMerge);

 if (invoiceErr) {
 console.error("Failed to update invoices during vendor merge:", invoiceErr);
 return NextResponse.json(
 { error: `Failed to update invoices: ${invoiceErr.message}` },
 { status: 500 }
 );
 }

 // Soft-delete the merged vendors
 const { error: deleteErr } = await supabase
 .from("vendors")
 .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
 .in("id", idsToMerge);

 if (deleteErr) {
 console.error("Failed to soft-delete merged vendors:", deleteErr);
 return NextResponse.json(
 { error: `Failed to soft-delete vendors: ${deleteErr.message}` },
 { status: 500 }
 );
 }

 return NextResponse.json({
 success: true,
 primary_id,
 merged_count: idsToMerge.length,
 });
 } catch (err) {
 console.error("Vendor merge error:", err);
 const message = err instanceof Error ? err.message : "Unknown error";
 return NextResponse.json({ error: message }, { status: 500 });
 }
}
