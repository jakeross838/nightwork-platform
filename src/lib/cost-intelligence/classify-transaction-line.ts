/**
 * Regex-based transaction-line classifier.
 *
 * Identifies invoice line items that are *billing events* rather than
 * catalog items — progress payments, draws, rental periods, recurring
 * services, change-order narratives, partial payments — so they can
 * bypass matchItem (which has nothing useful to say about them) and
 * drop straight into the verification queue flagged for human review.
 *
 * DESIGN PRINCIPLE: prefer false-negatives over false-positives. A
 * short ambiguous description like "DW2710 DRILL BIT" or "Drawer
 * pull brass" must NOT match — those are real items that happen to
 * share a substring with transaction vocabulary. The patterns below
 * require enough context (date ranges, ordinal + "draw", "progress
 * payment" as a phrase) that false-positives are rare.
 */

export type TransactionLineType =
  | "progress_payment"
  | "draw"
  | "rental_period"
  | "service_period"
  | "change_order_narrative"
  | "partial_payment"
  | "other";

export interface TransactionDetection {
  is_transaction: boolean;
  type: TransactionLineType | null;
  reasoning: string;
}

interface Pattern {
  type: TransactionLineType;
  regex: RegExp;
  reason: string;
}

// Ordered: first match wins. More specific / higher-confidence patterns
// appear first so they take precedence over broader ones.
const PATTERNS: Pattern[] = [
  // Progress payments / draws — must include ordinal + "draw" OR explicit
  // "progress payment" phrase. "draw" alone is too ambiguous (drawer, drawing).
  {
    type: "draw",
    regex: /\b(?:\d+(?:st|nd|rd|th)|first|second|third|fourth|fifth)\s+draw\b/i,
    reason: "ordinal + 'draw' indicates a pay application",
  },
  {
    type: "draw",
    regex: /\bdraw\s+(?:#|no\.|num|number|request|application|application\s*#)/i,
    reason: "'draw' followed by numeric designator",
  },
  {
    type: "draw",
    regex: /\bamount\s+of\s+this\s+draw\b/i,
    reason: "AIA G702 summary phrase",
  },
  {
    type: "progress_payment",
    regex: /\bprogress\s+payment\b/i,
    reason: "'progress payment' phrase",
  },
  {
    type: "progress_payment",
    regex: /\bbalance\s+(?:due|remaining|forward)\b/i,
    reason: "billing balance phrase",
  },

  // Rental periods — require explicit date range or combo-rent pattern.
  // Bare "rent" or "rental" is not enough (could be "rental property" item).
  {
    type: "rental_period",
    regex: /\bcombo[- ]?rent\b/i,
    reason: "combo-rent is a rental billing period",
  },
  {
    type: "rental_period",
    regex: /\b(?:rent|rental|lease)\s+\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}\s*(?:to|-|through)\s*\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}/i,
    reason: "rent/lease with explicit date range",
  },
  {
    type: "rental_period",
    regex: /\bmonthly\s+rent(?:al)?\b/i,
    reason: "'monthly rent[al]' billing cadence",
  },
  {
    type: "rental_period",
    regex: /\b\d{1,2}x\d{1,2}\s+(?:combo|unit|trailer|storage)\b.*\brent/i,
    reason: "sized unit rental narrative",
  },

  // Service periods — recurring service with frequency marker (2x week,
  // weekly, monthly) or explicit billing period / service period.
  {
    type: "service_period",
    regex: /\b\d+x\s*(?:week|month|day|wk|mo)\s+service\b/i,
    reason: "'Nx week/month/day service' recurring",
  },
  {
    type: "service_period",
    regex: /\bbilling\s+period\b/i,
    reason: "'billing period' indicates a service-period line",
  },
  {
    type: "service_period",
    regex: /\bservice\s+(?:period|for\s+period|from\s+\d)/i,
    reason: "'service period' or 'service from <date>'",
  },
  {
    type: "service_period",
    regex: /\belectric(?:al|ity)?\s+service\s+charges?\b/i,
    reason: "recurring electric service charges",
  },
  {
    type: "service_period",
    regex: /\bportable\s+restroom\b.*\b(?:service|weekly|monthly|\d+x)/i,
    reason: "portable restroom service (recurring)",
  },

  // Change order narratives — narrative text describing work done, often
  // > 80 chars. Look for explicit CO references combined with descriptive
  // text.
  {
    type: "change_order_narrative",
    regex: /\bchange\s+order\s+(?:#|no\.|num|number)\s*\d+/i,
    reason: "explicit 'Change Order #N' reference",
  },
  {
    type: "change_order_narrative",
    regex: /\bCO[- ]?#?\d{1,3}\b(?=.{30,})/i,
    reason: "'CO#N' prefix with long narrative",
  },

  // Partial payments
  {
    type: "partial_payment",
    regex: /\bpartial\s+payment\b/i,
    reason: "'partial payment' phrase",
  },
  {
    type: "partial_payment",
    regex: /\bpartial\s+(?:of|due)\b/i,
    reason: "'partial of/due' phrase",
  },
  {
    type: "partial_payment",
    regex: /\b\d+\s*%\s+(?:paid|payment|of\s+(?:last|total|this))/i,
    reason: "percentage-paid phrase",
  },
  {
    type: "partial_payment",
    regex: /\b(?:remaining|final)\s+balance\b/i,
    reason: "remaining/final balance narrative",
  },
];

/**
 * Decide whether a raw invoice line description represents a
 * transactional billing event rather than a catalog item.
 *
 * Returns a detection object even for non-transaction lines so callers
 * have a uniform shape. When `is_transaction` is false, `type` is
 * null.
 */
export function detectTransactionLine(
  rawDescription: string | null | undefined
): TransactionDetection {
  const text = (rawDescription ?? "").trim();
  if (!text) {
    return { is_transaction: false, type: null, reasoning: "" };
  }

  // Guard against obvious-item words that tend to produce false positives.
  // If the line is VERY short AND mentions tools/hardware without any
  // billing-context signals, short-circuit.
  const shortHardwareGuard =
    text.length <= 30 &&
    /\b(?:drill|screw|nut|bolt|nail|pull|knob|pipe|tube|cap|elbow|tee|fitting)\b/i.test(text);
  if (shortHardwareGuard) {
    return {
      is_transaction: false,
      type: null,
      reasoning: "short hardware-like description; skipping transaction patterns",
    };
  }

  for (const p of PATTERNS) {
    if (p.regex.test(text)) {
      return {
        is_transaction: true,
        type: p.type,
        reasoning: p.reason,
      };
    }
  }

  return { is_transaction: false, type: null, reasoning: "no transaction pattern matched" };
}

/**
 * Exported for unit testing.
 */
export const __TEST_PATTERNS = PATTERNS;
