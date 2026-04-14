import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
 saveParsedInvoice,
 type SaveInvoiceRequest,
} from "@/lib/invoices/save";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
 try {
 const body = await request.json();
 const items: SaveInvoiceRequest[] = Array.isArray(body) ? body : [body];
 // @supabase/ssr's server client and plain supabase-js share the same
 // query surface; the shared saveParsedInvoice helper only relies on that.
 const supabase = createServerClient() as unknown as Parameters<typeof saveParsedInvoice>[0];
 const savedIds: string[] = [];
 const duplicates: Array<{ index: number; existing: { id: string; vendor_name_raw: string; total_amount: number; status: string } }> = [];

 for (let idx = 0; idx < items.length; idx++) {
 const item = items[idx];
 const result = await saveParsedInvoice(supabase, item);

 if (result.duplicate) {
 // Single-item request → respond immediately with the duplicate modal shape
 if (items.length === 1) {
 return NextResponse.json({
 duplicate: true,
 existing: result.duplicate,
 });
 }
 duplicates.push({ index: idx, existing: result.duplicate });
 continue;
 }
 if (result.id) savedIds.push(result.id);
 }

 return NextResponse.json({
 saved: savedIds,
 ...(duplicates.length > 0 ? { duplicates } : {}),
 });
 } catch (err) {
 console.error("Save error:", err);
 const message = err instanceof Error ? err.message : "Unknown error";
 return NextResponse.json({ error: message }, { status: 500 });
 }
}
