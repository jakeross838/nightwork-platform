/**
 * Phase 3.4 cutover seed — uploads one proposal fixture to storage
 * and creates the document_extractions row classified as 'proposal'.
 *
 * Replicates what /api/ingest does (upload + classify + insert), but
 * skips the classifier call since we already know the type. Service-
 * role write so it works without an authenticated session.
 *
 * Outputs the extraction_id so Jake can navigate to
 * /proposals/review/<extraction_id> for the dogfood pass.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ROSS_BUILT_ORG = "00000000-0000-0000-0000-000000000001";
const FIXTURE_PATH =
  "__tests__/fixtures/classifier/.local/proposal/Drummond - ML Concrete 5-1-25 SQ Signed.pdf";

(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const buffer = readFileSync(FIXTURE_PATH);
  const fileName = "ML_Concrete_5-1-25_cutover.pdf";
  const timestamp = Date.now();
  const storagePath = `${ROSS_BUILT_ORG}/ingest/${timestamp}_${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("invoice-files")
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadError) {
    console.error("upload failed:", uploadError.message);
    process.exit(1);
  }
  console.log("uploaded:", storagePath);

  const { data: row, error: insertError } = await supabase
    .from("document_extractions")
    .insert({
      org_id: ROSS_BUILT_ORG,
      invoice_id: null,
      raw_pdf_url: storagePath,
      verification_status: "pending",
      extraction_model: "classifier-only",
      extraction_prompt_version: "phase-3.4-cutover-seed",
      classified_type: "proposal",
      classification_confidence: 0.95,
    })
    .select("id")
    .single();
  if (insertError || !row) {
    console.error("insert failed:", insertError?.message);
    process.exit(1);
  }
  console.log("\nextraction_id:", row.id);
  console.log("review URL: http://localhost:3003/proposals/review/" + row.id);
})();
