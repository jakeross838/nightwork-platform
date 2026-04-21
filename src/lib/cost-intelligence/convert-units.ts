/**
 * Unit conversion resolution + application.
 *
 * Given an item (with canonical_unit + conversion_rules) and an observed
 * unit from an invoice line, compute the ratio that normalizes observed
 * values into canonical values. Resolution order:
 *
 *   1. Same unit → ratio = 1, source = 'same_unit'
 *   2. Tenant rule on the item (items.conversion_rules[observed_unit])
 *   3. Industry template (unit_conversion_templates keyed by category /
 *      subcategory / from_unit / to_unit)
 *   4. AI suggestion — writes a unit_conversion_suggestions row with
 *      status='pending' so a human can confirm, and returns the ratio
 *      tagged as 'ai_suggested_pending'.
 *   5. Fallback ratio=1 with source='no_rule' when even the AI can't help.
 *
 * The applied ratio means: 1 {observed_unit} = {ratio} {canonical_unit}.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { callClaude } from "@/lib/claude";

const SUGGESTION_MODEL = "claude-sonnet-4-20250514";

export type ConversionSource =
  | "same_unit"
  | "tenant_rule"
  | "template"
  | "ai_suggested_pending"
  | "ai_suggested_confirmed"
  | "no_conversion"
  | "no_rule";

export interface ResolvedConversion {
  ratio: number;
  source: ConversionSource;
  suggestion_id?: string;
  reasoning?: string;
}

export interface ItemForConversion {
  id: string;
  org_id: string;
  canonical_unit: string;
  conversion_rules: Record<string, { ratio: number; notes?: string }> | null;
  category: string | null;
  subcategory: string | null;
}

function normalizeUnit(unit: string | null | undefined): string {
  if (!unit) return "";
  return unit.toLowerCase().trim();
}

/**
 * Resolve conversion ratio without side-effects (no AI call, no DB writes).
 * Used by fast paths where we only want to apply an existing rule.
 */
export async function resolveConversion(
  supabase: SupabaseClient,
  item: ItemForConversion,
  observedUnit: string
): Promise<ResolvedConversion> {
  const observed = normalizeUnit(observedUnit);
  const canonical = normalizeUnit(item.canonical_unit);

  if (!observed || !canonical) {
    return { ratio: 1, source: "no_conversion" };
  }

  if (observed === canonical) {
    return { ratio: 1, source: "same_unit" };
  }

  // Tenant rule
  const rules = item.conversion_rules ?? {};
  const tenantRule = rules[observed] ?? rules[observedUnit];
  if (tenantRule && typeof tenantRule.ratio === "number" && tenantRule.ratio > 0) {
    return { ratio: tenantRule.ratio, source: "tenant_rule" };
  }

  // Template
  if (item.category) {
    const { data } = await supabase
      .from("unit_conversion_templates")
      .select("ratio, notes, item_subcategory")
      .eq("item_category", item.category)
      .eq("from_unit", observed)
      .eq("to_unit", canonical)
      .limit(10);

    const rows = (data ?? []) as Array<{
      ratio: number;
      notes: string | null;
      item_subcategory: string | null;
    }>;

    // Prefer subcategory-specific, then 'any', then first
    const specific = rows.find((r) => r.item_subcategory === item.subcategory);
    const any = rows.find((r) => r.item_subcategory === "any");
    const template = specific ?? any ?? rows[0];
    if (template) {
      return { ratio: Number(template.ratio), source: "template" };
    }
  }

  return { ratio: 1, source: "no_rule" };
}

/**
 * Resolve conversion with AI fallback. When no rule/template exists, ask
 * Claude for a ratio and write a unit_conversion_suggestions row so a
 * human can confirm.
 */
export async function resolveConversionWithAI(
  supabase: SupabaseClient,
  item: ItemForConversion & { canonical_name: string },
  observedUnit: string,
  opts: {
    orgId: string;
    userId?: string | null;
    sourceExtractionLineId?: string;
  }
): Promise<ResolvedConversion> {
  const prelim = await resolveConversion(supabase, item, observedUnit);
  if (prelim.source !== "no_rule") return prelim;

  // No deterministic rule — ask Claude.
  const ai = await suggestConversionFromAI({
    itemName: item.canonical_name,
    itemCategory: item.category,
    itemSubcategory: item.subcategory,
    fromUnit: observedUnit,
    toUnit: item.canonical_unit,
    orgId: opts.orgId,
    userId: opts.userId ?? null,
  });

  if (!ai) {
    return { ratio: 1, source: "no_rule" };
  }

  // Persist a pending suggestion so a human can confirm.
  const { data: inserted } = await supabase
    .from("unit_conversion_suggestions")
    .insert({
      org_id: opts.orgId,
      item_id: item.id,
      from_unit: normalizeUnit(observedUnit),
      to_unit: normalizeUnit(item.canonical_unit),
      suggested_ratio: ai.ratio,
      ai_reasoning: ai.reasoning,
      ai_confidence: ai.confidence,
      source_extraction_line_id: opts.sourceExtractionLineId ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  return {
    ratio: ai.ratio,
    source: "ai_suggested_pending",
    suggestion_id: (inserted as { id: string } | null)?.id,
    reasoning: ai.reasoning,
  };
}

/**
 * Apply a conversion ratio to observed quantity/unit-price.
 *
 * canonicalQty       = observedQty * ratio
 * canonicalUnitPrice = observedUnitPrice / ratio (price-per-canonical-unit goes down
 *                                                  as one observed unit represents
 *                                                  more canonical units)
 */
export function applyConversion(
  observedQty: number,
  observedUnitPriceCents: number,
  ratio: number
): { canonicalQty: number; canonicalUnitPriceCents: number } {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return {
      canonicalQty: observedQty,
      canonicalUnitPriceCents: observedUnitPriceCents,
    };
  }
  return {
    canonicalQty: observedQty * ratio,
    canonicalUnitPriceCents: Math.round(observedUnitPriceCents / ratio),
  };
}

interface AISuggestionArgs {
  itemName: string;
  itemCategory: string | null;
  itemSubcategory: string | null;
  fromUnit: string;
  toUnit: string;
  orgId: string;
  userId: string | null;
}

interface AISuggestionResult {
  ratio: number;
  confidence: number;
  reasoning: string;
  requires_verification: boolean;
}

/**
 * Call Claude with a construction-knowledge prompt to get a conversion
 * ratio. Does NOT persist anything — just returns the suggestion, or
 * null if Claude couldn't produce a usable one.
 */
export async function suggestConversionFromAI(
  args: AISuggestionArgs
): Promise<AISuggestionResult | null> {
  const userPrompt = `You provide unit conversion ratios for construction items. Given an item description and two units, return the conversion ratio with reasoning.

ITEM: "${args.itemName}"
CATEGORY: ${args.itemCategory ?? "(none)"}
SUBCATEGORY: ${args.itemSubcategory ?? "(none)"}
FROM UNIT: "${args.fromUnit}"
TO UNIT: "${args.toUnit}"

The ratio means: 1 ${args.fromUnit} = ratio ${args.toUnit}.

Examples:
- item "2x4x8 premium spruce", from "bundle", to "each" → ratio 48, "Standard lumber bundle of 2x4x8s contains 48 pieces"
- item "12x12 ceramic tile", from "box", to "sf" → ratio 10, "Typical 12x12 ceramic tile box covers 10 sf"
- item "interior latex paint", from "gallon", to "sf" → ratio 350, "1 gal covers ~350 sf with one coat"

If the conversion requires a specific product spec you don't have (e.g. tile box coverage depends on tile size), return a best-guess ratio with lower confidence and requires_verification=true.

If no reasonable conversion exists (e.g. converting "each" to "lb" without knowing fastener spec), return ratio=0 and explain.

Respond with JSON ONLY (no markdown, no code fences):
{
  "ratio": number,
  "confidence": 0.0-1.0,
  "reasoning": "one sentence",
  "requires_verification": boolean
}`;

  let response;
  try {
    response = await callClaude({
      model: SUGGESTION_MODEL,
      max_tokens: 256,
      messages: [{ role: "user", content: userPrompt }],
      function_type: "unit_conversion_suggest",
      org_id: args.orgId,
      user_id: args.userId,
      metadata: {
        item_name: args.itemName.slice(0, 80),
        from_unit: args.fromUnit,
        to_unit: args.toUnit,
      },
    });
  } catch (err) {
    console.warn(
      `[convert-units] AI suggestion failed: ${err instanceof Error ? err.message : err}`
    );
    return null;
  }

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;

  const jsonText = block.text
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    const parsed = JSON.parse(jsonText) as {
      ratio?: number;
      confidence?: number;
      reasoning?: string;
      requires_verification?: boolean;
    };
    const ratio = Number(parsed.ratio);
    if (!Number.isFinite(ratio) || ratio <= 0) return null;
    return {
      ratio,
      confidence: clamp01(Number(parsed.confidence ?? 0.5)),
      reasoning: parsed.reasoning ?? "",
      requires_verification: Boolean(parsed.requires_verification ?? true),
    };
  } catch {
    return null;
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Merge a confirmed ratio into an item's conversion_rules JSONB.
 * Used by the verification flow — called after a human confirms an
 * AI-suggested conversion.
 */
export async function mergeConversionRuleIntoItem(
  supabase: SupabaseClient,
  itemId: string,
  observedUnit: string,
  ratio: number,
  notes: string | null
): Promise<void> {
  const { data: item } = await supabase
    .from("items")
    .select("conversion_rules")
    .eq("id", itemId)
    .maybeSingle();

  const existingRules =
    ((item as { conversion_rules: Record<string, { ratio: number; notes?: string | null }> } | null)
      ?.conversion_rules) ?? {};

  const merged = {
    ...existingRules,
    [normalizeUnit(observedUnit)]: { ratio, notes: notes ?? undefined },
  };

  await supabase.from("items").update({ conversion_rules: merged }).eq("id", itemId);
}
