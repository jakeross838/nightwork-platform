/**
 * Invoice-level line_nature classifier + BOM detector.
 *
 * One Claude call per invoice that:
 *   1. Classifies each line_item by its nature (material / labor / scope /
 *      equipment / service / bom_spec / unclassified).
 *   2. Identifies lines that should be skipped entirely (draws, progress
 *      payments, CO narratives, location headers, admin notes) and returns
 *      them in a separate `skipped_lines` array — the extractor persists
 *      these on document_extractions.skipped_lines for audit but does NOT
 *      create extraction_lines for them.
 *   3. Proposes BOM attachments: $0 product spec lines that describe a
 *      product included in a scope line on the same invoice. Returns the
 *      target scope line's index + a confidence score that drives the
 *      two-tier attach flow (auto-confirm >= 0.85, pending 0.5-0.85,
 *      unclassified < 0.5).
 *
 * BOM detection is inherently cross-line: the AI needs to see all lines on
 * the invoice to know which scope line a $0 spec belongs to. That's why
 * this lives here and not in match-item.ts (which is per-line).
 *
 * F-022: JSON.parse is wrapped in try/catch — a bad response falls back to
 * treating every line as 'unclassified' with no BOM attachments so the PM
 * can triage in the Review tab.
 */

import { callClaude } from "@/lib/claude";

const CLASSIFIER_MODEL = "claude-sonnet-4-20250514";

export type LineNature =
  | "material"
  | "labor"
  | "scope"
  | "equipment"
  | "service"
  | "bom_spec"
  | "unclassified";

export type SkipReason =
  | "flagged_transaction"
  | "admin_note"
  | "change_order_narrative"
  | "draw"
  | "progress_payment"
  | "other_non_item";

export interface ClassifierLineInput {
  /** Stable line index within the invoice (matches invoice_line_items.line_index). */
  line_index: number;
  description: string;
  amount_cents: number;
  qty: number | null;
  unit: string | null;
  rate_cents: number | null;
}

export interface ProposedBomAttachment {
  target_line_index: number;
  confidence: number;
  reasoning: string;
  product_description: string | null;
  product_specs: Record<string, unknown>;
}

export interface LineClassification {
  line_index: number;
  line_nature: LineNature;
  nature_confidence: number;
  nature_reasoning: string;
  proposed_bom_attachment: ProposedBomAttachment | null;
}

export interface SkippedLineResult {
  line_index: number;
  raw_description: string;
  amount_cents: number;
  skip_reason: SkipReason;
  detected_type: string;
}

export interface InvoiceNatureClassification {
  lines: LineClassification[];
  skipped_lines: SkippedLineResult[];
}

export interface ClassifyOptions {
  org_id: string;
  user_id?: string | null;
  invoice_id?: string;
  vendor_name?: string | null;
}

/**
 * Classify every line on an invoice in a single Claude call. Returns a
 * deterministic fallback (every line = 'unclassified', no skips, no BOM
 * attachments) when the AI response cannot be parsed so the extractor can
 * keep going instead of erroring the whole invoice.
 */
export async function classifyLineNatures(
  lines: ClassifierLineInput[],
  opts: ClassifyOptions
): Promise<InvoiceNatureClassification> {
  if (lines.length === 0) {
    return { lines: [], skipped_lines: [] };
  }

  const lineList = lines
    .map((l, i) => {
      const amount = (l.amount_cents / 100).toFixed(2);
      const qty = l.qty ?? "?";
      const unit = l.unit ?? "?";
      const rate = l.rate_cents != null ? (l.rate_cents / 100).toFixed(2) : "?";
      return `${i}. idx=${l.line_index} | "${l.description}" | qty=${qty} unit=${unit} rate=$${rate} total=$${amount}`;
    })
    .join("\n");

  const userPrompt = `You are classifying lines from a construction invoice into the builder's line-nature taxonomy AND deciding which lines should NOT be persisted (admin notes, draws, progress payments, etc.). You also detect $0 product-spec lines that describe a product included in a scope line on the same invoice (BOM attachments).

VENDOR: ${opts.vendor_name ?? "(unknown)"}

INVOICE LINES:
${lineList}

LINE NATURE TAXONOMY:

- 'material': Discrete physical goods from a supplier (lumber, tile, fasteners, hardware). Priced per unit. The vendor sells things off a shelf.

- 'labor': Workmanship only with no material bundled (tile install labor, trim install labor, punchlist). Typically priced per hour or per day.

- 'scope': Subcontractor labor + material bundled together (roof installation, stucco completion, HVAC install, drywall hang & tape). Priced lump-sum or by a size metric (roof_sf, heated_sf, lf, job). This is how subs price work — splits are NOT reliable.

- 'equipment': Equipment rental billed separately (excavator rental, lift rental).

- 'service': Recurring billable service (portable restroom service, waste hauling, temporary electric).

- 'bom_spec': A $0 line that SPECIFIES a product that is INCLUDED in a scope line on the SAME invoice. Example pattern: a Climatic Conditioning HVAC invoice has three $0 lines naming specific Carrier airhandler models (e.g. "17.5 SEER2 2-ton Carrier Infinity"), followed by a single bundled "Installation" total. Those three $0 lines are bom_spec lines that describe the product going into the scope line.

- 'unclassified': You examined the line but cannot confidently assign a nature. Will go to the Review tab for PM triage. Use when genuinely ambiguous — do NOT use this as a catch-all.

SKIP CRITERIA (do NOT persist — return in skipped_lines array):

Skip a line when it is administrative rather than a catalog item:
- Progress payments, draws ("3rd draw", "partial payment of last draw", "Draw #3")
- Change order narratives — long descriptive text about change orders referencing CO/PCCO numbers
- Location identifiers at $0 (street addresses as headers, job-site labels)
- Payment notes at $0 ("PAYMENT NEEDED TO SECURE SLABS", "please remit by DATE")
- Thank-you messages, marketing copy, vendor footers
- ANY $0 line that is NOT a product spec for a scope line on this invoice

DO NOT skip:
- $0 lines that name a product included in a scope line — those are 'bom_spec'
- Credit memos / negative amounts — those remain normal lines

BOM DETECTION:

For every line you classify as 'bom_spec', also populate proposed_bom_attachment:
- target_line_index: the line_index value of the scope line this BOM belongs to
- confidence: 0.0-1.0
  - 0.95+ when the $0 line clearly names a product whose installation is the only scope line on the invoice
  - 0.7-0.9 when one scope line is clearly the best target among several
  - 0.5-0.7 when it's the best guess but ambiguous
  - < 0.5: classify as 'unclassified' instead, do NOT attempt attachment
- reasoning: one sentence explaining why
- product_description: short canonical product name (e.g. "17.5 SEER2 2-ton Carrier Infinity")
- product_specs: { seer: "17.5", tonnage: "2", brand: "Carrier", model_line: "Infinity" } — extract structured spec fields when visible

If there is no scope line on the invoice, the $0 line cannot be a bom_spec. Classify as 'unclassified' or skip (admin_note) based on content.

RESPONSE FORMAT — JSON ONLY, no markdown, no code fences:

{
  "lines": [
    {
      "line_index": 0,
      "line_nature": "scope",
      "nature_confidence": 0.95,
      "nature_reasoning": "Subcontractor HVAC installation priced as a bundled total",
      "proposed_bom_attachment": null
    },
    {
      "line_index": 1,
      "line_nature": "bom_spec",
      "nature_confidence": 0.9,
      "nature_reasoning": "$0 line naming a specific airhandler model included in the install scope",
      "proposed_bom_attachment": {
        "target_line_index": 0,
        "confidence": 0.9,
        "reasoning": "Only scope line on invoice is the bundled install; this names the product installed",
        "product_description": "17.5 SEER2 2-ton Carrier Infinity",
        "product_specs": { "seer": "17.5", "tonnage": "2", "brand": "Carrier" }
      }
    }
  ],
  "skipped_lines": [
    {
      "line_index": 7,
      "raw_description": "3rd Draw for paint",
      "amount_cents": 500000,
      "skip_reason": "draw",
      "detected_type": "draw"
    }
  ]
}

Every input line_index MUST appear in exactly ONE of the two arrays. If you cannot decide, put it in lines with line_nature='unclassified'.`;

  const response = await callClaude({
    model: CLASSIFIER_MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: userPrompt }],
    function_type: "line_nature_classify",
    org_id: opts.org_id,
    user_id: opts.user_id ?? null,
    metadata: {
      invoice_id: opts.invoice_id,
      line_count: lines.length,
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    console.warn(
      "[classify-line-natures] no text response from Claude — falling back to unclassified"
    );
    return fallbackUnclassified(lines);
  }

  const jsonText = textBlock.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    console.warn(
      `[classify-line-natures] JSON.parse failed (F-022): ${
        err instanceof Error ? err.message : String(err)
      } — falling back to unclassified`
    );
    return fallbackUnclassified(lines);
  }

  return normalizeResponse(parsed, lines);
}

function fallbackUnclassified(lines: ClassifierLineInput[]): InvoiceNatureClassification {
  return {
    lines: lines.map((l) => ({
      line_index: l.line_index,
      line_nature: "unclassified" as const,
      nature_confidence: 0,
      nature_reasoning: "AI classifier failed — PM triage in Review tab",
      proposed_bom_attachment: null,
    })),
    skipped_lines: [],
  };
}

const NATURE_SET = new Set<LineNature>([
  "material",
  "labor",
  "scope",
  "equipment",
  "service",
  "bom_spec",
  "unclassified",
]);

const SKIP_REASON_SET = new Set<SkipReason>([
  "flagged_transaction",
  "admin_note",
  "change_order_narrative",
  "draw",
  "progress_payment",
  "other_non_item",
]);

function normalizeResponse(
  parsed: unknown,
  inputLines: ClassifierLineInput[]
): InvoiceNatureClassification {
  const validIndexes = new Set(inputLines.map((l) => l.line_index));
  const indexByAmount = new Map(inputLines.map((l) => [l.line_index, l.amount_cents] as const));
  const indexByDescription = new Map(
    inputLines.map((l) => [l.line_index, l.description] as const)
  );

  const result: InvoiceNatureClassification = { lines: [], skipped_lines: [] };
  const seen = new Set<number>();

  if (!parsed || typeof parsed !== "object") {
    return fallbackUnclassified(inputLines);
  }
  const obj = parsed as Record<string, unknown>;

  const rawLines = Array.isArray(obj.lines) ? obj.lines : [];
  for (const raw of rawLines) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const idx = asFiniteInt(r.line_index);
    if (idx == null || !validIndexes.has(idx)) continue;
    if (seen.has(idx)) continue;

    const nature = asNature(r.line_nature);
    if (!nature) continue;

    const natureConfidence = clamp01(asNumber(r.nature_confidence) ?? 0);
    const natureReasoning = typeof r.nature_reasoning === "string" ? r.nature_reasoning : "";

    let bom: ProposedBomAttachment | null = null;
    const rawBom = r.proposed_bom_attachment;
    if (nature === "bom_spec" && rawBom && typeof rawBom === "object") {
      const b = rawBom as Record<string, unknown>;
      const targetIdx = asFiniteInt(b.target_line_index);
      const confidence = clamp01(asNumber(b.confidence) ?? 0);
      if (targetIdx != null && validIndexes.has(targetIdx) && targetIdx !== idx) {
        bom = {
          target_line_index: targetIdx,
          confidence,
          reasoning: typeof b.reasoning === "string" ? b.reasoning : "",
          product_description:
            typeof b.product_description === "string" ? b.product_description : null,
          product_specs:
            b.product_specs && typeof b.product_specs === "object" && !Array.isArray(b.product_specs)
              ? (b.product_specs as Record<string, unknown>)
              : {},
        };
      }
    }

    result.lines.push({
      line_index: idx,
      line_nature: nature,
      nature_confidence: natureConfidence,
      nature_reasoning: natureReasoning,
      proposed_bom_attachment: bom,
    });
    seen.add(idx);
  }

  const rawSkipped = Array.isArray(obj.skipped_lines) ? obj.skipped_lines : [];
  for (const raw of rawSkipped) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    const idx = asFiniteInt(s.line_index);
    if (idx == null || !validIndexes.has(idx)) continue;
    if (seen.has(idx)) continue;

    const reason = asSkipReason(s.skip_reason) ?? "other_non_item";
    const detectedType = typeof s.detected_type === "string" ? s.detected_type : reason;

    result.skipped_lines.push({
      line_index: idx,
      raw_description:
        typeof s.raw_description === "string"
          ? s.raw_description
          : indexByDescription.get(idx) ?? "",
      amount_cents: asFiniteInt(s.amount_cents) ?? indexByAmount.get(idx) ?? 0,
      skip_reason: reason,
      detected_type: detectedType,
    });
    seen.add(idx);
  }

  // Any input line the AI forgot about defaults to unclassified so the PM
  // sees it in the Review tab instead of being silently dropped.
  for (const li of inputLines) {
    if (seen.has(li.line_index)) continue;
    result.lines.push({
      line_index: li.line_index,
      line_nature: "unclassified",
      nature_confidence: 0,
      nature_reasoning: "AI classifier did not return this line — defaulted to unclassified",
      proposed_bom_attachment: null,
    });
  }

  return result;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asFiniteInt(v: unknown): number | null {
  const n = asNumber(v);
  if (n == null) return null;
  return Math.round(n);
}

function asNature(v: unknown): LineNature | null {
  if (typeof v !== "string") return null;
  const s = v.toLowerCase().trim();
  return NATURE_SET.has(s as LineNature) ? (s as LineNature) : null;
}

function asSkipReason(v: unknown): SkipReason | null {
  if (typeof v !== "string") return null;
  const s = v.toLowerCase().trim();
  return SKIP_REASON_SET.has(s as SkipReason) ? (s as SkipReason) : null;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
