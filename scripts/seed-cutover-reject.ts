import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
(async () => {
  const buffer = readFileSync(
    "__tests__/fixtures/classifier/.local/proposal/Drummond - REV Garage doors - Banko 9.26.25.pdf"
  );
  const ts = Date.now();
  const path = `00000000-0000-0000-0000-000000000001/ingest/${ts}_Banko_GarageDoors_cutover.pdf`;
  const u = await supabase.storage
    .from("invoice-files")
    .upload(path, buffer, { contentType: "application/pdf", upsert: true });
  if (u.error) {
    console.error(u.error);
    process.exit(1);
  }
  const r = await supabase
    .from("document_extractions")
    .insert({
      org_id: "00000000-0000-0000-0000-000000000001",
      invoice_id: null,
      raw_pdf_url: path,
      verification_status: "pending",
      extraction_model: "classifier-only",
      extraction_prompt_version: "phase-3.4-cutover-seed",
      classified_type: "proposal",
      classification_confidence: 0.98,
    })
    .select("id")
    .single();
  if (r.error) {
    console.error(r.error);
    process.exit(1);
  }
  console.log("reject_test_id:", r.data.id);
})();
