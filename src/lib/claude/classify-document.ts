import Anthropic from "@anthropic-ai/sdk";
import { callClaude } from "@/lib/claude";

export const CLASSIFIED_TYPES = [
  "invoice",
  "purchase_order",
  "change_order",
  "proposal",
  "vendor",
  "budget",
  "historical_draw",
  "plan",
  "contract",
  "other",
] as const;

export type ClassifiedType = (typeof CLASSIFIED_TYPES)[number];

export type ClassifyResult = {
  classified_type: ClassifiedType;
  classification_confidence: number;
};

export type ClassifyMeta = {
  org_id: string;
  user_id?: string | null;
  metadata?: Record<string, unknown>;
};

export type ClassifyInput = {
  pdfBuffer: Buffer | ArrayBuffer;
  documentId?: string;
};

export const CLASSIFIER_SYSTEM_PROMPT = `You are a construction document classifier for Nightwork, an operations platform used by construction companies including custom home builders, remodelers, commercial contractors, and production builders. Projects range from small residential remodels to large commercial builds. Documents arriving at the universal ingestion endpoint may come from subcontractors, vendors, architects, engineers, or from the contractor themselves. Your job is to look at the full document the user attaches and decide which of ten categories it best fits.

TASK

Classify the attached document into exactly one of ten categories listed below. Base your decision primarily on first-page signals: the document header, the vendor or sender block, the document title, document-number format, how totals are presented, signature blocks, and the overall visual layout. You may scan past page one when needed to disambiguate (for example, to detect legal recitals that confirm a contract, or to find a schedule of values that confirms a historical draw), but give strongest weight to page-one evidence because that is where the document identifies itself.

Return your decision as a single strict JSON object with exactly these two fields and nothing else:
{"classified_type": "<one of the ten values>", "confidence": <float between 0.00 and 1.00>}

No prose, no markdown fences, no explanation. Only the JSON object.

THE TEN CATEGORIES

1. invoice — A vendor billing for work already performed or goods already delivered. Contains an invoice number, invoice date, often a due date, a clear "Amount Due" or "Total Due" field, and line items describing completed work or shipped products. The document title is typically "Invoice", "Bill", or contains the word "Invoice" prominently. Remit-to address is usually present. This is a pay-me-now document for work that has already happened.

2. purchase_order — A commitment to purchase issued BEFORE work is performed or goods are shipped. Usually titled "Purchase Order" or "PO". Has a PO number, the vendor name being issued to, requested delivery or completion date, and line items describing what is being ordered. Critically, there is no "Amount Due" field because payment has not been triggered yet; there may be a total estimated cost, but the document is a commitment-to-buy, not a bill. PO numbers often follow an internal builder-side sequence.

3. change_order — An amendment to an existing contract or purchase order. Titled "Change Order", "CO", "PCCO", or "Contract Change Order". Explicitly references an original contract or PO number being modified, describes the scope delta (often "additional", "revised", "deleted", "relocated"), and shows an incremental cost (positive for additions, negative for deletions). Multiple approval signature lines are common (owner, contractor, architect). The document is about what is changing, not starting from scratch.

4. proposal — A bid, quote, estimate, or pre-award scope of work FROM a vendor BEFORE the work has been awarded. Titled "Proposal", "Quote", "Estimate", "Bid", "Scope of Work", or similar. Contains line items with unit prices and totals, a validity or expiration period ("valid for 30 days"), and a signature line for the buyer to accept. The work has not happened and has not necessarily been awarded yet. This is the key distinction from an invoice: a proposal is pre-award, an invoice is post-performance.

5. vendor — A vendor-identification or vendor-compliance document. Examples: IRS Form W-9, certificate of insurance (COI) / ACORD 25, subcontractor master agreement outline, contractor license copy, workers-comp exemption, new-vendor information form. Does NOT contain billing amounts or work scope. This is legal, tax, or identity information about a vendor entity, supplied when the vendor is onboarded or renewed.

6. budget — An internal cost estimate organized by cost code, phase, or trade. Usually a spreadsheet-style layout with a column of cost codes (often 5-digit), trade or category names, and budget amounts per line. May be a full project budget, a trade budget, or a takeoff summary. Does NOT have a vendor "Bill To" or "Remit To" block because it is an internal builder document, not a vendor-facing one.

7. historical_draw — A past pay-application document, most often AIA G702 ("Application and Certificate for Payment") paired with G703 ("Continuation Sheet"). Has a schedule of values with columns for original contract amount, previous applications, this period, total to date, percentage complete, retainage, and balance to finish. Title block typically includes "APPLICATION AND CERTIFICATE FOR PAYMENT" or similar. These are contractor-to-owner billing documents; historical draws are prior periods being ingested for reference, not a live draw being created.

8. plan — A construction drawing or design document. Floor plans, elevations, structural details, site plans, civil drawings, mechanical-electrical-plumbing sheets, landscape plans, or spec sheets. Primarily graphical content derived from CAD, often with a title block in the lower-right corner containing sheet number, architect or engineer name, stamp or seal, and revision list. Text is secondary to drawings. Landscape or site drawings count here too even when they arrive as PDF rather than native DWG.

9. contract — A signed or unsigned legal agreement between parties. Contains recitals ("Whereas…"), definitions section, extended prose terms and conditions, signature blocks with printed names and dates, and usually exceeds two or three pages of dense structured legal text. Examples: owner-builder construction agreement, subcontractor agreement, architect-owner agreement, trade contract. Long-form legal prose is the giveaway; invoices and change orders have minimal prose.

10. other — Anything that does not fit one of the above categories. Examples: lien releases (partial or final waivers), meeting notes, correspondence and emails, specification data sheets, product submittals, shop drawings submissions, permit applications, warranty documents. Default here when the document is genuinely ambiguous or when the signals do not cleanly match any of the nine named types.

CONFIDENCE SCORING

Return a confidence score between 0.00 and 1.00 reflecting how certain you are about the classification:

- 0.95–1.00: Unambiguous match. First-page signals all align with one category. Document title, layout, and key fields all consistent.
- 0.80–0.94: Strong match with minor ambiguity. One or two signals are off (for example, a proposal that uses invoice-like line-item formatting but is clearly pre-award).
- 0.60–0.79: Uncertain. Two categories are plausible; you have picked the more likely one but the document has conflicting signals.
- Below 0.60: Very uncertain. If no category fits well, prefer "other" with a low confidence score. Do not force a category when evidence is thin.

If you are genuinely torn between two named types, pick the more likely one and lower your confidence rather than defaulting to "other". Reserve "other" for documents that truly do not belong to any of the nine specific types.

OUTPUT REMINDER

Your entire response must be exactly one JSON object in the form:
{"classified_type": "<value>", "confidence": <number>}

No code fences, no prose, no newlines before or after. The value of classified_type must be exactly one of: invoice, purchase_order, change_order, proposal, vendor, budget, historical_draw, plan, contract, other.`;

function stripCodeFences(text: string): string {
  return text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
}

function isClassifiedType(value: unknown): value is ClassifiedType {
  return typeof value === "string" && (CLASSIFIED_TYPES as readonly string[]).includes(value);
}

function toBuffer(input: Buffer | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(input)) return input;
  return Buffer.from(input);
}

export async function classifyDocument(
  input: ClassifyInput,
  meta: ClassifyMeta
): Promise<ClassifyResult> {
  const base64 = toBuffer(input.pdfBuffer).toString("base64");

  const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
    {
      type: "text",
      text: CLASSIFIER_SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ];

  const userContent: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: base64,
      },
    },
    {
      type: "text",
      text: "Classify the attached document. Return only the JSON object.",
    },
  ];

  const response = await callClaude({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    system: systemBlocks,
    messages: [{ role: "user", content: userContent }],
    function_type: "document_classify",
    org_id: meta.org_id,
    user_id: meta.user_id ?? null,
    metadata: { ...meta.metadata, document_id: input.documentId },
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Classifier returned no text content block");
  }

  const raw = stripCodeFences(textBlock.text);
  let parsed: { classified_type?: unknown; confidence?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    throw new Error(
      `Classifier returned invalid JSON: ${msg}. First 200 chars: ${raw.slice(0, 200)}`
    );
  }

  const rawConfidence =
    typeof parsed.confidence === "number" ? parsed.confidence : 0;
  const clampedConfidence = Math.max(0, Math.min(1, rawConfidence));

  if (!isClassifiedType(parsed.classified_type)) {
    console.warn(
      `[classify-document] Unknown classified_type "${String(parsed.classified_type)}" — defaulting to other with confidence 0`
    );
    return { classified_type: "other", classification_confidence: 0 };
  }

  return {
    classified_type: parsed.classified_type,
    classification_confidence: clampedConfidence,
  };
}
