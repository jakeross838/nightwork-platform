/**
 * Canonical-name normalization + generic-name detection for the cost
 * intelligence spine.
 *
 * Goals:
 *   1. Normalize canonical_name formatting so items from different AI
 *      proposals don't proliferate variants ("MYSTERY FOREST 3CM-AGM"
 *      and "Mystery Forest 3cm - Agm" should collapse to one canonical
 *      string).
 *   2. Catch generic names the AI proposes that would pollute the
 *      catalog ("tile", "lumber", "backsplash") and route them to the
 *      Review tab instead of committing a useless item.
 *
 * Rules applied by normalizeItemName:
 *   - Collapse whitespace, trim
 *   - Title-case most words, but preserve a whitelist of construction
 *     abbreviations (PT, MC, SS, PVC, CPVC, ABS, CDX, MDX, AGM, AWG,
 *     SEER, SEER2, HVAC, GFCI, NM-B, EA, MDF, OSB, LED, LPG, NPT,
 *     BTU, GPM, GPH, PSI, UV, IR, DC, AC, QR, ID, OD)
 *   - Preserve unit suffixes attached to digits as lower-case ("3cm"
 *     not "3Cm", "1/4in" not "1/4In")
 *   - Preserve product code tokens that look like spec patterns
 *     (2x4x8, 2x4, 3/4", 1-1/4in, model numbers with hyphens/digits)
 *   - Collapse dash variants between tokens to a single hyphen with no
 *     surrounding spaces when the neighbours are spec tokens; between
 *     distinct words keep a spaced hyphen
 *   - Strip trailing punctuation
 *
 * This is pure string manipulation — no DB calls. Safe to call from
 * both client and server code.
 */

const ABBREVIATIONS = new Set<string>([
  "PT",
  "MC",
  "SS",
  "PVC",
  "CPVC",
  "ABS",
  "CDX",
  "MDX",
  "AGM",
  "AWG",
  "SEER",
  "SEER2",
  "HVAC",
  "GFCI",
  "NM-B",
  "MDF",
  "OSB",
  "LED",
  "LPG",
  "NPT",
  "BTU",
  "GPM",
  "GPH",
  "PSI",
  "UV",
  "IR",
  "DC",
  "AC",
  "QR",
  "ID",
  "OD",
  "EA",
  "SKU",
  "UPC",
  "MFR",
  "OEM",
  "CO",
  "PCCO",
  "GC",
  "PM",
  "QA",
]);

// Units that follow a digit without a space ("3cm", "1/4in"). Lower-case.
const ATTACHED_UNITS = [
  "cm",
  "mm",
  "in",
  "ft",
  "sf",
  "lf",
  "sq",
  "yd",
  "oz",
  "lb",
  "lbs",
  "kg",
  "g",
  "ml",
  "l",
  "gal",
  "hr",
  "pcs",
  "pc",
  "ga",
];

// Stand-alone generic category labels that should never be a committed
// canonical_name on their own.
const GENERIC_SINGLE_WORDS = new Set<string>([
  "tile",
  "lumber",
  "labor",
  "material",
  "drywall",
  "paint",
  "trim",
  "framing",
  "plumbing",
  "electrical",
  "hvac",
  "flooring",
  "tiling",
  "roofing",
  "stucco",
  "concrete",
  "hardware",
  "fasteners",
  "finish",
  "backsplash",
  "countertop",
  "counter",
  "tops",
  "allowance",
  "other",
  "misc",
  "miscellaneous",
]);

const DIGIT_UNIT_RE = new RegExp(
  `^(\\d+(?:\\.\\d+)?(?:/\\d+(?:\\.\\d+)?)?)(${ATTACHED_UNITS.join("|")})$`,
  "i"
);

// Tokens like 2x4, 2x4x8, 5/8", 1-1/4, 10-32, MODEL-123, PCCO-3 — preserve.
// Digit-first tokens with dashes/dots/slashes/quotes.
const SPEC_TOKEN_RE = /^[0-9][0-9a-z./x\-\\"']*$/i;

export function normalizeItemName(rawName: string): string {
  if (!rawName) return "";

  let s = rawName.replace(/\s+/g, " ").trim();
  // Normalize dash variants — unicode em/en dash to ASCII hyphen for the
  // scanning below; we re-introduce en-dashes for ranges later.
  s = s.replace(/[\u2013\u2014]/g, "-");
  // Replace sequences of dashes with a single hyphen for spacing decisions.
  s = s.replace(/-{2,}/g, "-");
  // Strip trailing punctuation that tends to sneak in from OCR.
  s = s.replace(/[.,;:!?\-\s]+$/, "");
  // Normalize typographic apostrophes.
  s = s.replace(/[\u2018\u2019]/g, "'");
  // Normalize quote marks around measurements (leave literal " in place).
  s = s.replace(/[\u201C\u201D]/g, '"');

  // Tokenize on spaces, preserving internal punctuation.
  const tokens = s.split(" ");
  const out: string[] = [];
  for (const raw of tokens) {
    if (!raw) continue;
    out.push(normalizeToken(raw));
  }
  return out.join(" ");
}

function normalizeToken(token: string): string {
  // Protect tokens that are pure spec patterns (e.g. "2x4x8", "1-1/4",
  // "MODEL-123", "PCCO-3") from title-casing.
  if (SPEC_TOKEN_RE.test(token)) return token.toLowerCase();

  // Digit-unit attachments: "3CM" -> "3cm", "1/4IN" -> "1/4in"
  const digitUnit = token.match(DIGIT_UNIT_RE);
  if (digitUnit) {
    return `${digitUnit[1]}${digitUnit[2].toLowerCase()}`;
  }

  // Abbreviations kept in uppercase (including hyphenated forms like NM-B).
  const upper = token.toUpperCase();
  if (ABBREVIATIONS.has(upper)) return upper;

  // Hyphenated compound: recurse per segment so "3cm-slab" becomes "3cm-Slab"
  // and "NM-B" stays uppercase via the abbreviation check above.
  if (token.includes("-")) {
    return token
      .split("-")
      .map((part) => normalizeToken(part))
      .join("-");
  }

  // Slash-separated fractions ("1/2") — keep as-is.
  if (/^\d+\/\d+"?$/.test(token)) return token;

  // Apostrophe-plural (e.g. "builder's") — preserve lower-case suffix.
  if (/^[A-Za-z]+'[A-Za-z]+$/.test(token)) {
    return toTitle(token);
  }

  // "#N" tokens stay as-is.
  if (/^#\d+$/.test(token)) return token;

  // Default: title-case. Preserve an embedded punctuation/digit cluster that
  // already looks like a spec (has a digit).
  if (/\d/.test(token)) return token;

  return toTitle(token);
}

function toTitle(word: string): string {
  if (!word) return word;
  // Preserve inner capitalization if word is already a mixed-case identifier
  // (e.g. "iPhone", "eBay") — but we don't expect those in item names so just
  // lower then capitalize.
  const lower = word.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export interface GenericityContext {
  item_type?: string | null;
  category?: string | null;
  vendor_name?: string | null;
  raw_description?: string | null;
}

/**
 * Returns true if the proposed canonical_name is too generic to be worth
 * adding to the catalog. Caller should route the line to the Review tab
 * (line_nature='unclassified') with reasoning.
 *
 * Heuristics — true if ANY applies:
 *   - Name (normalized) consists of a single word from GENERIC_SINGLE_WORDS
 *   - Name has < 3 words AND contains no digit / spec token / uppercase code
 *   - Name equals the bare item_type or category label
 */
export function isNameTooGeneric(
  rawName: string,
  context: GenericityContext = {}
): boolean {
  const name = normalizeItemName(rawName);
  if (!name) return true;

  const lower = name.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);

  if (words.length === 1 && GENERIC_SINGLE_WORDS.has(words[0])) return true;

  const itemType = context.item_type?.toLowerCase().trim();
  const category = context.category?.toLowerCase().trim();
  if (itemType && lower === itemType) return true;
  if (category && lower === category) return true;

  if (words.length < 3) {
    // Accept short names that carry a spec token or uppercase code —
    // "PVC 3/4", "SKU 123", "2x4 PT" are specific enough.
    const hasSpec = words.some((w) => /\d/.test(w));
    const hasCode = rawName.split(/\s+/).some((w) => ABBREVIATIONS.has(w.toUpperCase()));
    if (!hasSpec && !hasCode) return true;
  }

  return false;
}
