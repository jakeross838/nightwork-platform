/**
 * Diagnostic: dump what /api/proposals/extract would return for the
 * cutover seed extraction. Re-runs extractProposal on the stored PDF
 * and prints the response envelope so we can compare what the UI
 * receives vs what setForm expects.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { extractProposal } from "../src/lib/ingestion/extract-proposal";

dotenv.config({ path: ".env.local" });

const ROSS_BUILT_ORG = "00000000-0000-0000-0000-000000000001";
const EXTRACTION_ID = "0011b454-0291-42de-a082-fe040b45bcf3";

(async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: row, error: loadErr } = await supabase
    .from("document_extractions")
    .select("id, raw_pdf_url, classification_confidence")
    .eq("id", EXTRACTION_ID)
    .maybeSingle();
  if (loadErr || !row) {
    console.error("load failed:", loadErr);
    process.exit(1);
  }

  const { data: file, error: dlErr } = await supabase.storage
    .from("invoice-files")
    .download(row.raw_pdf_url);
  if (dlErr || !file) {
    console.error("download failed:", dlErr);
    process.exit(1);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await extractProposal(
    { pdfBuffer: buffer, documentId: EXTRACTION_ID },
    { org_id: ROSS_BUILT_ORG, metadata: { source: "diagnostic-dump" } }
  );

  // Match the route's response envelope shape
  const responseEnvelope = {
    extraction_id: EXTRACTION_ID,
    classified_type: "proposal",
    classification_confidence: row.classification_confidence,
    extracted_data: parsed,
    confidence_summary: {
      overall: parsed.confidence_score,
      per_field: parsed.confidence_details,
      flags: parsed.flags,
    },
  };

  console.log("\n=== TOP-LEVEL KEYS ===");
  console.log(Object.keys(responseEnvelope).join(", "));
  console.log("\n=== extracted_data TOP-LEVEL KEYS ===");
  console.log(Object.keys(responseEnvelope.extracted_data).join(", "));
  console.log("\n=== extracted_data.vendor_name ===");
  console.log(responseEnvelope.extracted_data.vendor_name);
  console.log("\n=== extracted_data.line_items[0] (full) ===");
  console.log(JSON.stringify(responseEnvelope.extracted_data.line_items[0], null, 2));
  console.log("\n=== extracted_data.line_items COUNT ===");
  console.log(responseEnvelope.extracted_data.line_items.length);
  console.log("\n=== JSON SIZE ===");
  console.log(JSON.stringify(responseEnvelope).length, "bytes");
})();
