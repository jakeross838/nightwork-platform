/**
 * Tiered item matching.
 *
 * Tier 1 — Exact alias (instant, free)
 * Tier 2 — Vendor-scoped trigram (instant, free)
 * Tier 3 — AI semantic match with vendor context (1 Claude call)
 * Tier 4 — AI propose new item (folded into Tier 3 call output when no
 *          existing item matches)
 *
 * All Claude calls go through callClaude() for metering + plan-limit
 * enforcement + api_usage logging.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { callClaude } from "@/lib/claude";
import type {
  MatchResult,
  VendorContext,
  ProposedItemData,
  CandidateConsideration,
  ItemType,
  ItemUnit,
} from "./types";

const MATCH_MODEL = "claude-sonnet-4-20250514";

export interface MatchInput {
  raw_description: string;
  raw_quantity: number | null;
  raw_unit_price_cents: number | null;
  raw_total_cents: number | null;
  raw_unit_text: string | null;
}

export interface MatchOptions {
  org_id: string;
  user_id?: string | null;
  invoice_id?: string;
}

type CandidateItem = {
  id: string;
  canonical_name: string;
  item_type: string;
  category: string | null;
  subcategory: string | null;
  specs: Record<string, unknown> | null;
  unit: string;
  default_cost_code_id: string | null;
  similarity?: number;
};

export async function matchItem(
  supabase: SupabaseClient,
  input: MatchInput,
  context: VendorContext,
  opts: MatchOptions
): Promise<MatchResult> {
  const raw = (input.raw_description ?? "").trim();
  if (!raw) {
    return {
      item_id: null,
      proposed_item_data: null,
      confidence: 0,
      created_via: "ai_new_item",
      reasoning: "Empty raw description — cannot classify",
      candidates_considered: [],
    };
  }

  // Tier 1: Exact alias match scoped to this vendor
  if (context.vendor_id) {
    const { data: exactAlias } = await supabase
      .from("item_aliases")
      .select("item_id, alias_text, occurrence_count, items!inner(id,canonical_name,item_type,unit)")
      .eq("org_id", opts.org_id)
      .eq("vendor_id", context.vendor_id)
      .ilike("alias_text", raw)
      .limit(1)
      .maybeSingle();

    if (exactAlias?.item_id) {
      return {
        item_id: exactAlias.item_id as string,
        proposed_item_data: null,
        confidence: 1.0,
        created_via: "alias_match",
        reasoning: `Exact alias match for this vendor ("${raw}" seen ${
          (exactAlias.occurrence_count as number) ?? 1
        }x previously)`,
        candidates_considered: [],
      };
    }
  }

  // Tier 2: Trigram match scoped to this vendor's previous aliases
  if (context.vendor_id) {
    const { data: fuzzy } = await supabase.rpc("find_vendor_alias_matches", {
      p_org_id: opts.org_id,
      p_vendor_id: context.vendor_id,
      p_query: raw,
      p_threshold: 0.65,
      p_limit: 5,
    });

    // Fallback if RPC doesn't exist — do it inline with pg_trgm similarity
    let matches: Array<{ item_id: string; alias_text: string; canonical_name: string; similarity: number }> = [];
    if (Array.isArray(fuzzy)) {
      matches = fuzzy as typeof matches;
    } else {
      const { data } = await supabase
        .from("item_aliases")
        .select("item_id, alias_text, items(canonical_name)")
        .eq("org_id", opts.org_id)
        .eq("vendor_id", context.vendor_id)
        .limit(50);
      // local similarity fallback: simple token overlap
      const q = raw.toLowerCase();
      type AliasRow = {
        item_id: string;
        alias_text: string;
        items: { canonical_name: string } | { canonical_name: string }[] | null;
      };
      matches = ((data ?? []) as unknown as AliasRow[])
        .map((a) => {
          const itemsField = a.items;
          const canonical = Array.isArray(itemsField)
            ? itemsField[0]?.canonical_name ?? ""
            : itemsField?.canonical_name ?? "";
          return {
            item_id: a.item_id,
            alias_text: a.alias_text,
            canonical_name: canonical,
            similarity: trigramSim(q, a.alias_text.toLowerCase()),
          };
        })
        .filter((m) => m.similarity > 0.65)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);
    }

    if (matches[0] && matches[0].similarity > 0.85) {
      return {
        item_id: matches[0].item_id,
        proposed_item_data: null,
        confidence: matches[0].similarity,
        created_via: "trigram_match",
        reasoning: `Fuzzy match (${Math.round(matches[0].similarity * 100)}% similar) to vendor's previous "${matches[0].alias_text}"`,
        candidates_considered: matches.map((m) => ({
          item_id: m.item_id,
          canonical_name: m.canonical_name,
          score: m.similarity,
        })),
      };
    }
  }

  // Tier 3: AI semantic match with vendor context
  const candidateItems = await getCandidateItems(supabase, opts.org_id, raw);
  const aiResult = await aiSemanticMatch({
    input,
    candidates: candidateItems,
    context,
    org_id: opts.org_id,
    user_id: opts.user_id ?? null,
    invoice_id: opts.invoice_id,
  });

  return aiResult;
}

/** Pull candidate items by trigram similarity on canonical_name. */
async function getCandidateItems(
  supabase: SupabaseClient,
  orgId: string,
  query: string
): Promise<CandidateItem[]> {
  // Try RPC for pg_trgm similarity first
  const { data: rpc } = await supabase.rpc("find_item_candidates", {
    p_org_id: orgId,
    p_query: query,
    p_limit: 10,
  });

  if (Array.isArray(rpc) && rpc.length > 0) {
    return rpc as CandidateItem[];
  }

  // Fallback: pull a reasonable slice and rank in-memory
  const { data } = await supabase
    .from("items")
    .select(
      "id, canonical_name, item_type, category, subcategory, specs, unit, default_cost_code_id"
    )
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .limit(200);

  const q = query.toLowerCase();
  const scored = ((data ?? []) as CandidateItem[])
    .map((item) => ({
      ...item,
      similarity: trigramSim(q, item.canonical_name.toLowerCase()),
    }))
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, 10);

  return scored;
}

function trigramSim(a: string, b: string): number {
  // Cheap Jaccard over 3-grams — good enough as a fallback heuristic.
  const trigrams = (s: string) => {
    const grams = new Set<string>();
    const padded = `  ${s}  `;
    for (let i = 0; i < padded.length - 2; i++) grams.add(padded.slice(i, i + 3));
    return grams;
  };
  const A = trigrams(a);
  const B = trigrams(b);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  A.forEach((g) => {
    if (B.has(g)) inter++;
  });
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

interface AiMatchArgs {
  input: MatchInput;
  candidates: CandidateItem[];
  context: VendorContext;
  org_id: string;
  user_id: string | null;
  invoice_id?: string;
}

async function aiSemanticMatch(args: AiMatchArgs): Promise<MatchResult> {
  const { input, candidates, context } = args;

  const candidateList =
    candidates.length > 0
      ? candidates
          .map(
            (c, i) =>
              `${i + 1}. id=${c.id} | ${c.canonical_name} | type=${c.item_type} | category=${
                c.category ?? "-"
              } | unit=${c.unit} | specs=${JSON.stringify(c.specs ?? {})}`
          )
          .join("\n")
      : "(no existing items in this tenant yet)";

  const correctionsList =
    context.recent_corrections.length > 0
      ? context.recent_corrections
          .slice(0, 10)
          .map(
            (c, i) =>
              `${i + 1}. "${c.source_text}" → AI first said "${
                c.ai_canonical_name ?? "(none)"
              }", human corrected to "${c.corrected_canonical_name ?? "(none)"}"`
          )
          .join("\n")
      : "(no prior corrections for this vendor)";

  const aliasList =
    context.recent_aliases.length > 0
      ? context.recent_aliases
          .slice(0, 20)
          .map((a) => `- "${a.alias_text}" → ${a.canonical_name}`)
          .join("\n")
      : "(no prior aliases for this vendor)";

  const totalDollars =
    input.raw_total_cents != null ? (input.raw_total_cents / 100).toFixed(2) : "?";

  const userPrompt = `You classify construction invoice line items into a builder's item taxonomy. Use the vendor's past alias history and prior corrections to guide your match.

VENDOR: ${context.vendor_name ?? "(unknown)"}

PAST ALIASES FROM THIS VENDOR (how they've phrased items before):
${aliasList}

PAST CORRECTIONS FOR THIS VENDOR (AI mistake → human fix — avoid these mistakes):
${correctionsList}

CANDIDATE EXISTING ITEMS (top matches by fuzzy similarity):
${candidateList}

NEW LINE TO CLASSIFY:
- raw description: "${input.raw_description}"
- quantity: ${input.raw_quantity ?? "?"}
- unit text: ${input.raw_unit_text ?? "?"}
- unit price (¢): ${input.raw_unit_price_cents ?? "?"}
- total (USD): $${totalDollars}

Respond with JSON ONLY (no markdown, no code fences):
{
  "match": "existing" | "new",
  "matched_item_id": "uuid-of-candidate" | null,
  "confidence": 0.0-1.0,
  "reasoning": "one sentence",
  "candidates_considered": [{"item_id": "uuid", "canonical_name": "...", "rejected_reason": "..."}],
  "proposed_item": {
    "canonical_name": "string — short canonical name like '2x4 SPF lumber 8ft' or 'Labor — framing carpenter'",
    "item_type": "material | labor | equipment | service | subcontract | other",
    "category": "string | null",
    "subcategory": "string | null",
    "specs": { "key": "value" },
    "unit": "each | sf | lf | sy | cy | lb | gal | hr | day | lump_sum | pkg | box"
  }
}

If match="existing", set matched_item_id to the candidate's id and the proposed_item field can be omitted or set to null.
If match="new", leave matched_item_id null and fully populate proposed_item.
Confidence below 0.75 → treat as ambiguous, prefer "new".`;

  const response = await callClaude({
    model: MATCH_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: userPrompt }],
    function_type: "item_match",
    org_id: args.org_id,
    user_id: args.user_id,
    metadata: {
      invoice_id: args.invoice_id,
      raw_description: input.raw_description.slice(0, 120),
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return fallbackNewItem(input, "No text response from Claude");
  }

  const jsonText = textBlock.text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  let parsed: AiMatchResponse;
  try {
    parsed = JSON.parse(jsonText) as AiMatchResponse;
  } catch {
    return fallbackNewItem(input, `Claude returned invalid JSON: ${jsonText.slice(0, 200)}`);
  }

  const candidatesConsidered: CandidateConsideration[] = Array.isArray(parsed.candidates_considered)
    ? parsed.candidates_considered.map((c) => ({
        item_id: c.item_id ?? "",
        canonical_name: c.canonical_name ?? "",
        rejected_reason: c.rejected_reason,
      }))
    : [];

  if (parsed.match === "existing" && parsed.matched_item_id) {
    // Verify the matched_item_id exists in our candidates to prevent hallucination
    const valid = candidates.some((c) => c.id === parsed.matched_item_id);
    if (valid) {
      const matched = candidates.find((c) => c.id === parsed.matched_item_id);
      return {
        item_id: parsed.matched_item_id,
        proposed_item_data: null,
        confidence: clamp01(parsed.confidence ?? 0.75),
        created_via: "ai_semantic_match",
        reasoning:
          parsed.reasoning ??
          `AI matched to existing item "${matched?.canonical_name}"`,
        candidates_considered: candidatesConsidered,
      };
    }
    // Model hallucinated an id — fall through to new
  }

  // New item proposal path
  const prop = parsed.proposed_item;
  if (!prop || typeof prop.canonical_name !== "string") {
    return fallbackNewItem(input, "AI returned neither valid match nor proposal");
  }

  const proposedItem: ProposedItemData = {
    canonical_name: prop.canonical_name,
    item_type: normalizeItemType(prop.item_type),
    category: prop.category ?? null,
    subcategory: prop.subcategory ?? null,
    specs: (prop.specs as Record<string, unknown>) ?? {},
    unit: normalizeUnit(prop.unit),
  };

  return {
    item_id: null,
    proposed_item_data: proposedItem,
    confidence: clamp01(parsed.confidence ?? 0.6),
    created_via: "ai_new_item",
    reasoning: parsed.reasoning ?? "AI proposed a new canonical item",
    candidates_considered: candidatesConsidered,
  };
}

type AiMatchResponse = {
  match?: "existing" | "new";
  matched_item_id?: string | null;
  confidence?: number;
  reasoning?: string;
  candidates_considered?: Array<{
    item_id?: string;
    canonical_name?: string;
    rejected_reason?: string;
  }>;
  proposed_item?: {
    canonical_name?: string;
    item_type?: string;
    category?: string | null;
    subcategory?: string | null;
    specs?: unknown;
    unit?: string;
  } | null;
};

function fallbackNewItem(input: MatchInput, reason: string): MatchResult {
  return {
    item_id: null,
    proposed_item_data: {
      canonical_name: input.raw_description.slice(0, 120),
      item_type: "other",
      category: null,
      subcategory: null,
      specs: {},
      unit: normalizeUnit(input.raw_unit_text),
    },
    confidence: 0.3,
    created_via: "ai_new_item",
    reasoning: `Fallback: ${reason}`,
    candidates_considered: [],
  };
}

function normalizeItemType(v: unknown): ItemType {
  const s = typeof v === "string" ? v.toLowerCase().trim() : "";
  const allowed: ItemType[] = ["material", "labor", "equipment", "service", "subcontract", "other"];
  return (allowed as string[]).includes(s) ? (s as ItemType) : "other";
}

function normalizeUnit(v: unknown): ItemUnit {
  const s = typeof v === "string" ? v.toLowerCase().trim() : "";
  const allowed: ItemUnit[] = [
    "each",
    "sf",
    "lf",
    "sy",
    "cy",
    "lb",
    "gal",
    "hr",
    "day",
    "lump_sum",
    "pkg",
    "box",
  ];
  if ((allowed as string[]).includes(s)) return s as ItemUnit;

  // Common aliases
  if (s === "ea" || s === "each" || s === "qty" || s === "pcs" || s === "pc") return "each";
  if (s === "hours" || s === "hour" || s === "hrs") return "hr";
  if (s === "sqft" || s === "sq ft" || s === "square feet") return "sf";
  if (s === "linear feet" || s === "linearft") return "lf";
  if (s === "gallons" || s === "gallon") return "gal";
  if (s === "pounds" || s === "pound" || s === "lbs") return "lb";
  if (s === "ls" || s === "lumpsum" || s === "lump sum") return "lump_sum";
  return "each";
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Build the vendor context blob used in matching. */
export async function buildVendorContext(
  supabase: SupabaseClient,
  orgId: string,
  vendorId: string | null,
  vendorName: string | null
): Promise<VendorContext> {
  const context: VendorContext = {
    vendor_id: vendorId,
    vendor_name: vendorName,
    recent_aliases: [],
    recent_corrections: [],
  };

  if (!vendorId) return context;

  const { data: aliases } = await supabase
    .from("item_aliases")
    .select("alias_text, items!inner(canonical_name)")
    .eq("org_id", orgId)
    .eq("vendor_id", vendorId)
    .order("last_seen_at", { ascending: false })
    .limit(50);

  if (Array.isArray(aliases)) {
    type AliasRow = {
      alias_text: string;
      items:
        | { canonical_name: string }
        | { canonical_name: string }[]
        | null;
    };
    context.recent_aliases = (aliases as unknown as AliasRow[])
      .map((a) => {
        const itemsField = a.items;
        const canonical = Array.isArray(itemsField)
          ? itemsField[0]?.canonical_name ?? ""
          : itemsField?.canonical_name ?? "";
        return { alias_text: a.alias_text, canonical_name: canonical };
      })
      .filter((a) => a.canonical_name);
  }

  const { data: corrections } = await supabase
    .from("item_classification_corrections")
    .select("source_text, ai_canonical_name, corrected_canonical_name")
    .eq("org_id", orgId)
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (Array.isArray(corrections)) {
    context.recent_corrections = corrections as Array<{
      source_text: string;
      ai_canonical_name: string | null;
      corrected_canonical_name: string | null;
    }>;
  }

  return context;
}
