import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedInvoice } from "@/lib/types/invoice";

// Lazy so the SDK isn't instantiated at module-load time (before dotenv
// runs in scripts, before env is injected on Vercel edge workers, etc.).
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
 if (!_anthropic) _anthropic = new Anthropic();
 return _anthropic;
}

/**
 * A minimal interface covering the subset of SupabaseClient we rely on.
 * Both the SSR client (used by API routes) and the plain supabase-js
 * client (used by /scripts) satisfy it.
 */
type Client = SupabaseClient | { from: (table: string) => unknown };

async function callWithRetry(
 fn: () => Promise<Anthropic.Messages.Message>,
 maxRetries = 5
): Promise<Anthropic.Messages.Message> {
 for (let attempt = 0; attempt <= maxRetries; attempt++) {
 try {
 return await fn();
 } catch (err) {
 const isRetryable =
 err instanceof Anthropic.APIError &&
 (err.status === 529 || err.status === 503 || err.status === 429);
 if (!isRetryable || attempt === maxRetries) {
 if (isRetryable) {
 throw new Error("Claude API is overloaded. Please try again in a minute.");
 }
 throw err;
 }
 const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
 console.log(`Claude API overloaded, retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
 await new Promise((r) => setTimeout(r, delay));
 }
 }
 throw new Error("Retry logic failed unexpectedly");
}

async function getCostCodeList(supabase: Client): Promise<string> {
 // `any` here because this function supports both SSR and plain supabase-js
 // clients; the call shape is identical but the generic parameters differ.
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const { data } = await (supabase as any)
 .from("cost_codes")
 .select("code, description, category, is_change_order")
 .is("deleted_at", null)
 .order("sort_order");

 if (!data || data.length === 0) return "";

 return data
 .map(
 (c: { code: string; description: string; category: string; is_change_order: boolean }) =>
 `${c.code} - ${c.description} [${c.category}]${c.is_change_order ? " (CO)" : ""}`
 )
 .join("\n");
}

function buildPrompt(costCodeList: string): string {
 const costCodeSection = costCodeList
 ? `\n\nAlso suggest the most likely cost code from the list below. If the invoice references a change order (CO, PCCO, change order, extra work, additional), prefer the C-variant code. Return your suggestion in the cost_code_suggestion field.\n\nFor each line item, ALSO suggest the most appropriate cost code based on the line item description. A single invoice often spans multiple cost codes — e.g. a lumber invoice may have framing material AND strapping material on separate lines. A T&M invoice may have labor lines AND materials lines. Return a per-line suggestion in line_items[].cost_code_suggestion when you can identify a likely code.\n\nCOST CODES:\n${costCodeList}`
 : "";

 return `You are parsing a construction document for a luxury custom home builder running cost-plus (open book) projects.

FIRST: Determine the document type. Is this an invoice, a proposal/agreement, a quote/estimate, a credit memo, a statement, or unknown? Set "document_type" accordingly.

Extract every field you can find. For fields you cannot find, return null. Be thorough — look for vendor info, invoice numbers, dates, PO references, job/project references, line item details, and totals.

For T&M (time and materials) invoices with daily labor entries, parse each line with crew size, hours, and rate. Verify that the total equals the sum of line amounts.

CHANGE ORDER DETECTION (MANDATORY — BIAS TOWARD TRUE): Determine if this invoice is likely a change order. Set is_change_order: true at the invoice level if ANY of the following phrases appear anywhere on the document (case-insensitive, partial match):
 - "change order", "CO #", "PCCO"
 - "additional", "extra", "added" (any form of the word)
 - "beyond scope", "beyond original scope", "not in original"
 - "revision", "revised", "modification", "modified"
 - "extension required", "extensions required", "added extensions"
 - "relocated", "relocation"
 - General references to work not typically in an original contract (e.g. "additional extensions required", "added fixtures", "client requested upgrade")
 - The subject/description contains "Change Order" or "CO #"
When in doubt, prefer is_change_order: true. A false positive is cheap (PM un-toggles); a false negative is expensive (invoice bills against base budget when it should go to CO).
If is_change_order is true at the invoice level, suggest which PCCO number it might relate to in co_reference (e.g. "PCCO #3" or just the raw reference you see). Also prefer the C-variant cost code in cost_code_suggestion.
ALSO determine is_change_order at the line-item level — a single invoice can mix base-contract lines and CO lines. Set line_items[].is_change_order accordingly, and line_items[].co_reference when the line references a specific PCCO.

MATH CHECK (MANDATORY): You MUST verify that the sum of all line item amounts equals the stated subtotal and total. Specifically:
1. Sum every line_items[].amount. Compare to the subtotal field.
2. Check that subtotal + tax = total_amount (if tax applies).
3. If any of these checks fail (difference > $0.01), you MUST include "math_mismatch" in the flags array. Do not skip this step.
Report the discrepancy details in the description if found (e.g. "Line items sum to $X but stated total is $Y").

Set confidence_score from 0.0 to 1.0 based on how confident you are in the overall extraction accuracy. Set per-field confidence in confidence_details.

Flag issues in the flags array. Common flags:
- "no_invoice_number" if no invoice number found
- "handwritten_detected" if handwriting is present
- "math_mismatch" if line items don't sum to the stated total, or subtotal + tax != total_amount
- "blurry_or_low_quality" if image quality is poor
- "multi_page" if it appears to span multiple pages
- "credit_memo" if this is a credit/negative amount
- "not_an_invoice" if document_type is not "invoice"
- "change_order" if this invoice is a change order (is_change_order: true)
- "mixed_cost_codes" if line items span multiple cost codes${costCodeSection}

Return ONLY valid JSON matching this exact schema (no markdown, no code fences):

{
 "document_type": "invoice | proposal | quote | credit_memo | statement | unknown",
 "vendor_name": "string",
 "vendor_address": "string | null",
 "invoice_number": "string | null",
 "invoice_date": "YYYY-MM-DD | null",
 "po_reference": "string | null",
 "job_reference": "string | null",
 "description": "string",
 "invoice_type": "progress | time_and_materials | lump_sum",
 "is_change_order": "boolean",
 "co_reference": "string | null",
 "line_items": [
 {
 "description": "string",
 "date": "YYYY-MM-DD | null",
 "qty": "number | null",
 "unit": "string | null",
 "rate": "number | null",
 "amount": "number",
 "is_change_order": "boolean",
 "co_reference": "string | null",
 "cost_code_suggestion": {
 "code": "string | null — 5-digit code (with C suffix if change order line)",
 "description": "string | null",
 "confidence": "number 0.0-1.0"
 }
 }
 ],
 "subtotal": "number",
 "tax": "number | null",
 "total_amount": "number",
 "confidence_score": "number 0.0-1.0",
 "confidence_details": {
 "vendor_name": "number 0.0-1.0",
 "invoice_number": "number 0.0-1.0",
 "total_amount": "number 0.0-1.0",
 "job_reference": "number 0.0-1.0",
 "cost_code_suggestion": "number 0.0-1.0"
 },
 "cost_code_suggestion": {
 "code": "string — the default 5-digit code (with C suffix if change order)",
 "description": "string",
 "confidence": "number 0.0-1.0",
 "is_change_order": "boolean"
 },
 "flags": ["string"]
}

All dollar amounts should be in dollars (not cents). We convert to cents on our end.`;
}

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export async function parseInvoiceWithVision(
 fileBuffer: Buffer,
 mediaType: string,
 fileName: string,
 supabase: Client
): Promise<ParsedInvoice> {
 const base64 = fileBuffer.toString("base64");
 const costCodeList = await getCostCodeList(supabase);
 const prompt = buildPrompt(costCodeList);

 const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [];

 if (mediaType === "application/pdf") {
 contentBlocks.push({
 type: "document",
 source: {
 type: "base64",
 media_type: "application/pdf",
 data: base64,
 },
 });
 } else if (mediaType.startsWith("image/")) {
 contentBlocks.push({
 type: "image",
 source: {
 type: "base64",
 media_type: mediaType as ImageMediaType,
 data: base64,
 },
 });
 }

 contentBlocks.push({
 type: "text",
 text: `Parse this invoice file (${fileName}). ${prompt}`,
 });

 const response = await callWithRetry(() =>
 getAnthropic().messages.create({
 model: "claude-sonnet-4-20250514",
 max_tokens: 4096,
 messages: [
 {
 role: "user",
 content: contentBlocks,
 },
 ],
 })
 );

 const textBlock = response.content.find((block) => block.type === "text");
 if (!textBlock || textBlock.type !== "text") {
 throw new Error("No text response from Claude");
 }

 const jsonText = textBlock.text
 .replace(/```json\s*/g, "")
 .replace(/```\s*/g, "")
 .trim();

 return JSON.parse(jsonText) as ParsedInvoice;
}

export async function parseInvoiceFromText(
 text: string,
 fileName: string,
 supabase: Client
): Promise<ParsedInvoice> {
 const costCodeList = await getCostCodeList(supabase);
 const prompt = buildPrompt(costCodeList);

 const response = await callWithRetry(() =>
 getAnthropic().messages.create({
 model: "claude-sonnet-4-20250514",
 max_tokens: 4096,
 messages: [
 {
 role: "user",
 content: `Below is the extracted text content from a construction invoice file (${fileName}). ${prompt}\n\n--- INVOICE TEXT ---\n${text}\n--- END INVOICE TEXT ---`,
 },
 ],
 })
 );

 const textBlock = response.content.find((block) => block.type === "text");
 if (!textBlock || textBlock.type !== "text") {
 throw new Error("No text response from Claude");
 }

 const jsonText = textBlock.text
 .replace(/```json\s*/g, "")
 .replace(/```\s*/g, "")
 .trim();

 return JSON.parse(jsonText) as ParsedInvoice;
}
