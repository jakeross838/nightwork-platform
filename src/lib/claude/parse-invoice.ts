import Anthropic from "@anthropic-ai/sdk";
import type { ParsedInvoice } from "@/lib/types/invoice";
import { createServerClient } from "@/lib/supabase/server";

const anthropic = new Anthropic();

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

async function getCostCodeList(): Promise<string> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("cost_codes")
    .select("code, description, category, is_change_order")
    .is("deleted_at", null)
    .order("sort_order");

  if (!data || data.length === 0) return "";

  return data
    .map((c) => `${c.code} - ${c.description} [${c.category}]${c.is_change_order ? " (CO)" : ""}`)
    .join("\n");
}

function buildPrompt(costCodeList: string): string {
  const costCodeSection = costCodeList
    ? `\n\nAlso suggest the most likely Ross Built cost code from the list below. If the invoice references a change order (CO, PCCO, change order, extra work, additional), prefer the C-variant code. Return your suggestion in the cost_code_suggestion field.\n\nCOST CODES:\n${costCodeList}`
    : "";

  return `You are parsing a construction document for Ross Built Custom Homes, a luxury coastal custom home builder in Bradenton/Anna Maria Island, FL. They run cost-plus (open book) projects in the $1.5M–$10M+ range.

FIRST: Determine the document type. Is this an invoice, a proposal/agreement, a quote/estimate, a credit memo, a statement, or unknown? Set "document_type" accordingly.

Extract every field you can find. For fields you cannot find, return null. Be thorough — look for vendor info, invoice numbers, dates, PO references, job/project references, line item details, and totals.

For T&M (time and materials) invoices with daily labor entries, parse each line with crew size, hours, and rate. Verify that the total equals the sum of line amounts.

MATH CHECK: Compare subtotal to total_amount. If they differ (beyond tax), add "math_mismatch" to flags. Also verify that the sum of line_items amounts equals the subtotal. Report any discrepancies.

Set confidence_score from 0.0 to 1.0 based on how confident you are in the overall extraction accuracy. Set per-field confidence in confidence_details.

Flag issues in the flags array. Common flags:
- "no_invoice_number" if no invoice number found
- "handwritten_detected" if handwriting is present
- "math_mismatch" if line items don't sum to the total, or subtotal != total minus tax
- "blurry_or_low_quality" if image quality is poor
- "multi_page" if it appears to span multiple pages
- "credit_memo" if this is a credit/negative amount
- "not_an_invoice" if document_type is not "invoice"${costCodeSection}

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
  "co_reference": "string | null",
  "line_items": [
    {
      "description": "string",
      "date": "YYYY-MM-DD | null",
      "qty": "number | null",
      "unit": "string | null",
      "rate": "number | null",
      "amount": "number"
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
    "code": "string — the 5-digit code (with C suffix if change order)",
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
  fileName: string
): Promise<ParsedInvoice> {
  const base64 = fileBuffer.toString("base64");
  const costCodeList = await getCostCodeList();
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
    anthropic.messages.create({
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
  fileName: string
): Promise<ParsedInvoice> {
  const costCodeList = await getCostCodeList();
  const prompt = buildPrompt(costCodeList);

  const response = await callWithRetry(() =>
    anthropic.messages.create({
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
