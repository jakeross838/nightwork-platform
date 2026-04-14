import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { createServerClient } from "@/lib/supabase/server";
import {
  parseInvoiceWithVision,
  parseInvoiceFromText,
} from "@/lib/claude/parse-invoice";

export const dynamic = "force-dynamic";

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "image",
  "image/png": "image",
  "image/jpg": "image",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

export const maxDuration = 120; // Allow up to 2 minutes for retries

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileType = ACCEPTED_TYPES[file.type];
    if (!fileType) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
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

    // Parse with Claude based on file type
    let parsed;

    if (fileType === "pdf" || fileType === "image") {
      parsed = await parseInvoiceWithVision(buffer, file.type, file.name);
    } else if (fileType === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      if (!result.value.trim()) {
        return NextResponse.json(
          { error: "Could not extract text from DOCX file" },
          { status: 400 }
        );
      }
      parsed = await parseInvoiceFromText(result.value, file.name);
    } else {
      return NextResponse.json(
        { error: "XLSX parsing is not yet supported. Please convert to PDF." },
        { status: 400 }
      );
    }

    // Attempt to match job from parsed job_reference
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
      file_type: fileType,
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
