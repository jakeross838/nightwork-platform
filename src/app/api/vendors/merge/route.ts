import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
 getCurrentMembership,
 getMembershipFromRequest,
} from "@/lib/org/session";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

interface MergeRequest {
 primary_id: string;
 merge_ids: string[];
}

export async function POST(request: NextRequest) {
 try {
 // Auth + role gate — must run BEFORE any DB access. Previously the
 // handler executed all 3 destructive mutations before checking
 // membership; any authenticated user could mass-reassign and soft-
 // delete vendors across orgs. (audit backend H-1 / CRITICAL).
 const membership =
 getMembershipFromRequest(request) ?? (await getCurrentMembership());
 if (!membership) {
 return NextResponse.json(
 { error: "Not authenticated" },
 { status: 401 }
 );
 }
 if (membership.role !== "admin" && membership.role !== "owner") {
 return NextResponse.json(
 { error: "Vendor merge requires admin or owner role" },
 { status: 403 }
 );
 }

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

 // Verify the primary vendor exists, is not deleted, and belongs to
 // the caller's org. The org_id filter prevents cross-org primary
 // traversal; combined with the org-scoped destructive ops below it
 // makes the whole merge a no-op for any cross-org vendor IDs.
 const { data: primary, error: primaryErr } = await supabase
 .from("vendors")
 .select("id, name")
 .eq("id", primary_id)
 .eq("org_id", membership.org_id)
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
 .in("vendor_id", idsToMerge)
 .eq("org_id", membership.org_id);

 if (invoiceErr) {
 console.error("Failed to update invoices during vendor merge:", invoiceErr);
 return NextResponse.json(
 { error: `Failed to update invoices: ${invoiceErr.message}` },
 { status: 500 }
 );
 }

 // Also repoint purchase_orders so the merge survives the finance chain.
 const { error: poErr } = await supabase
 .from("purchase_orders")
 .update({ vendor_id: primary_id, updated_at: new Date().toISOString() })
 .in("vendor_id", idsToMerge)
 .eq("org_id", membership.org_id);
 if (poErr) {
 console.error("Failed to update POs during vendor merge:", poErr);
 return NextResponse.json(
 { error: `Failed to update purchase orders: ${poErr.message}` },
 { status: 500 }
 );
 }

 // Soft-delete the merged vendors
 const { error: deleteErr } = await supabase
 .from("vendors")
 .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
 .in("id", idsToMerge)
 .eq("org_id", membership.org_id);

 if (deleteErr) {
 console.error("Failed to soft-delete merged vendors:", deleteErr);
 return NextResponse.json(
 { error: `Failed to soft-delete vendors: ${deleteErr.message}` },
 { status: 500 }
 );
 }

 // Activity log: one entry per merged vendor pointing at the surviving vendor_id.
 const { data: { user } } = await supabase.auth.getUser();
 for (const mergedId of idsToMerge) {
 await logActivity({
 org_id: membership.org_id,
 user_id: user?.id ?? null,
 entity_type: "vendor",
 entity_id: mergedId,
 action: "merged",
 details: { into_vendor_id: primary_id, into_vendor_name: primary.name },
 });
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
