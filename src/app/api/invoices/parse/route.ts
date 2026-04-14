import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
 ACCEPTED_MIME_TYPES,
 parseInvoiceFile,
} from "@/lib/invoices/parse-file";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Allow up to 2 minutes for retries

export async function POST(request: NextRequest) {
 try {
 const formData = await request.formData();
 const file = formData.get("file") as File | null;

 if (!file) {
 return NextResponse.json({ error: "No file provided" }, { status: 400 });
 }

 const fileKind = ACCEPTED_MIME_TYPES[file.type];
 if (!fileKind) {
 return NextResponse.json(
 { error: `Unsupported file type: ${file.type}` },
 { status: 400 }
 );
 }
 if (fileKind === "xlsx") {
 return NextResponse.json(
 { error: "XLSX parsing is not yet supported. Please convert to PDF." },
 { status: 400 }
 );
 }

 const buffer = Buffer.from(await file.arrayBuffer());

 // Upload to Supabase Storage
 const supabase = createServerClient();
 const timestamp = Date.now();
 const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
 const storagePath = `uploads/${timestamp}_${safeName}`;

 const { error: uploadError } = await supabase.storage
 .from("invoice-files")
 .upload(storagePath, buffer, {
 contentType: file.type,
 upsert: false,
 });

 if (uploadError) {
 console.error("Storage upload error:", uploadError);
 return NextResponse.json(
 { error: `Storage upload failed: ${uploadError.message}` },
 { status: 500 }
 );
 }

 const parsed = await parseInvoiceFile({
 buffer,
 mediaType: file.type,
 fileKind,
 fileName: file.name,
 // Shared helper works with both SSR and supabase-js clients.
 supabase: supabase as unknown as Parameters<typeof parseInvoiceFile>[0]["supabase"],
 });

 // Attempt to match job from parsed job_reference (for the UI suggestion chip)
 if (parsed.job_reference) {
 const jobRef = parsed.job_reference;
 const jobConfidence = parsed.confidence_details?.job_reference ?? 0;
 const { data: matchedJobs } = await supabase
 .from("jobs")
 .select("name, address")
 .is("deleted_at", null)
 .or(`name.ilike.%${jobRef}%,address.ilike.%${jobRef}%`)
 .limit(1);
 if (matchedJobs && matchedJobs.length > 0) {
 parsed.job_suggestion = {
 name: matchedJobs[0].name,
 address: matchedJobs[0].address,
 confidence: jobConfidence,
 };
 }
 }

 return NextResponse.json({
 parsed,
 file_url: storagePath,
 file_name: file.name,
 file_type: fileKind,
 });
 } catch (err) {
 console.error("Invoice parse error:", err);
 const message = err instanceof Error ? err.message : "Unknown error";
 return NextResponse.json(
 { error: `Parse failed: ${message}` },
 { status: 500 }
 );
 }
}
