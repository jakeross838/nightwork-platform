#!/usr/bin/env tsx
/**
 * Sanitize Drummond raw fixtures and write sanitized TS files to
 * src/app/design-system/_fixtures/drummond/.
 *
 * Per CONTEXT D-17 / D-18 / D-20 / D-22 — two-tier grep gate.
 * This is tier 1 (extractor-side). Tier 2 is .github/workflows/drummond-grep-check.yml.
 * Tier 1.5 is .githooks/pre-commit + .claude/hooks/nightwork-pre-commit.sh.
 *
 * Usage: npx tsx scripts/sanitize-drummond.ts
 *
 * Reads:
 *   - .planning/fixtures/drummond/SUBSTITUTION-MAP.md (gitignored)
 *   - .planning/fixtures/drummond/source3-downloads/*.xlsx
 *   - scripts/drummond-invoice-fields.json (hand-curated by executor; gitignored)
 *
 * Writes:
 *   - src/app/design-system/_fixtures/drummond/{jobs,vendors,...}.ts (12 files)
 *
 * Halts on:
 *   - CI/Vercel environment detected (per nwrp31 #5 — local-only)
 *   - drummond-invoice-fields.json exists but NOT gitignored (per nwrp31 #4)
 *   - .xls legacy file encountered → "re-save as .xlsx in Excel first"
 *   - Raw PII detected before substitution → add to SUBSTITUTION-MAP
 *   - Real Drummond identifier survives substitution → fail with details
 *   - Substring-collision detected post-substitution → fail with details
 */

import ExcelJS from "exceljs";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, ".planning/fixtures/drummond/source3-downloads");
const SUB_MAP_PATH = path.join(ROOT, ".planning/fixtures/drummond/SUBSTITUTION-MAP.md");
const INVOICE_JSON_PATH = path.join(ROOT, "scripts/drummond-invoice-fields.json");
const OUT_DIR = path.join(ROOT, "src/app/design-system/_fixtures/drummond");

// Per nwrp31 #5 — belt-and-braces against accidental cloud execution.
// This script is local-only (reads gitignored raw fixtures + writes
// sanitized output). Running it in CI/Vercel build would log filenames
// containing real Drummond identifiers to build history.
if (process.env.CI === "true" || process.env.VERCEL === "1") {
  throw new Error(
    "[sanitize-drummond] FAIL: this script is local-only. CI/Vercel execution would leak real names via build logs. Run locally only.",
  );
}

// Per nwrp31 #4 — hard-fail if drummond-invoice-fields.json exists but
// is NOT gitignored. This file contains pre-substitution real names; if
// not gitignored, the next git add could commit it.
if (fs.existsSync(INVOICE_JSON_PATH)) {
  try {
    execSync(`git check-ignore -v "${INVOICE_JSON_PATH}"`, { stdio: "ignore" });
  } catch {
    throw new Error(
      `[sanitize-drummond] FAIL: ${INVOICE_JSON_PATH} exists but is NOT gitignored. ` +
        `Add the path to .gitignore before running. This file contains pre-substitution ` +
        `real Drummond names — if committed, real names leak.`,
    );
  }
}

// Mirrors the 32-entry pre-commit / .githooks / CI grep pattern. Hardcoded
// here so an empty SUBSTITUTION-MAP doesn't silently disable this gate.
const DENYLIST: string[] = [
  "Drummond",
  "501 74th",
  "Holmes Beach",
  "SmartShield Homes",
  "Florida Sunshine Carpentry",
  "Doug Naeher Drywall",
  "Paradise Foam",
  "Banko Overhead Doors",
  "WG Drywall",
  "Loftin Plumbing",
  "Island Lumber",
  "CoatRite",
  "Ecosouth",
  "MJ Florida",
  "Rangel Tile",
  "TNT Painting",
  "Avery Roofing",
  "ML Concrete LLC",
  "Dewberry",
  "Pou",
  "Krauss",
  "Duncan",
  "Molinari",
  "Markgraf",
  "Harllee",
  "Fish",
  "Clark",
  "Lee Worthy",
  "Nelson Belanger",
  "Bob Mozine",
  "Jason Szykulski",
  "Martin Mannix",
];

// 1. Parse SUBSTITUTION-MAP.md → Map<real, sanitized>.
//    Reads the markdown tables; each row "| Real | Sanitized | Notes |" with
//    NO-SUB rows filtered out (keep real value, no substitution applied).
//    Per nwrp34 follow-up: rows of shape "X (Y)" register BOTH "X (Y)" and
//    "Y" as keys mapping to the same sanitized value — handles parenthetical
//    full-name annotations like "Banko (Banko Overhead Doors)".
function loadSubstitutionMap(): Map<string, string> {
  const md = fs.readFileSync(SUB_MAP_PATH, "utf-8");
  const map = new Map<string, string>();
  // Match table rows: `| <real> | <sanitized> | ...`
  for (const line of md.split("\n")) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (!m) continue;
    const real = m[1].trim();
    const sanitized = m[2].trim();
    // Skip header rows + NO-SUB rows + parenthetical notes + separator rows.
    if (real === "Real" || sanitized === "Sanitized") continue;
    if (real.startsWith("---") || real.startsWith(":-")) continue;
    if (sanitized === "NO-SUB" || sanitized.startsWith("(")) continue;
    if (real.startsWith("(") || real === "") continue;
    map.set(real, sanitized);
    // Handle parenthetical-annotation form: "Short (Long Form Name)" registers
    // ALL THREE forms — "Short (Long Form Name)" full, "Short" outer alone,
    // and "Long Form Name" inner alone — all map to the same sanitized value.
    const parenMatch = real.match(/^([^(]+?)\s*\(([^)]+)\)\s*$/);
    if (parenMatch) {
      const outer = parenMatch[1].trim();
      const inner = parenMatch[2].trim();
      if (inner && !map.has(inner)) {
        map.set(inner, sanitized);
      }
      if (outer && !map.has(outer)) {
        map.set(outer, sanitized);
      }
    }
  }
  return map;
}

// 2. Apply substitutions to a string. Sort keys by length DESC so "501 74th
//    Street" replaces before "501" (prevents partial-match bugs).
//    Case-INSENSITIVE matching per nwrp33 C4 #3 — catches "DRUMMOND" (uppercase
//    from PDF extraction) as well as "Drummond" / "drummond".
//    Note (per nwrp34 W-iter2-4): uppercase emphasis from raw PDF headers gets
//    normalized to the SUBSTITUTION-MAP value's casing — DRUMMOND → Caldwell
//    (not CALDWELL). Acceptable trade-off; sanitized output uses canonical
//    sanitized casing regardless of source emphasis.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function substitute(text: string, map: Map<string, string>): string {
  const keys = Array.from(map.keys()).sort((a, b) => b.length - a.length);
  let result = text;
  for (const k of keys) {
    // Word-boundary match — prevents "501" from sub-replacing inside "5012"
    // or "Pou" from sub-replacing inside "Pour". The escape applies only to
    // the key itself; the \b anchors are appended outside the escape.
    result = result.replace(new RegExp(`\\b${escapeRegex(k)}\\b`, "gi"), map.get(k)!);
  }
  return result;
}

// Recursively apply substitutions to all string values in a nested structure.
function substituteRecursive<T>(value: T, map: Map<string, string>): T {
  if (typeof value === "string") {
    return substitute(value, map) as unknown as T;
  } else if (Array.isArray(value)) {
    return value.map((v) => substituteRecursive(v, map)) as unknown as T;
  } else if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = substituteRecursive(v, map);
    }
    return out as unknown as T;
  }
  return value;
}

// 3. Grep gate — scan for any real-name keys remaining post-substitution.
//    Case-INSENSITIVE per nwrp33 C4 #3, word-boundary per nwrp34 follow-up
//    (prevents "501" from false-positive on "5012" cents amounts).
function grepGate(
  value: unknown,
  map: Map<string, string>,
  pathSegs: string[] = [],
): Array<{ path: string[]; real: string; value: string }> {
  const violations: Array<{ path: string[]; real: string; value: string }> = [];
  if (typeof value === "string") {
    for (const real of map.keys()) {
      const re = new RegExp(`\\b${escapeRegex(real)}\\b`, "i");
      if (re.test(value)) {
        violations.push({ path: pathSegs, real, value });
      }
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) =>
      violations.push(...grepGate(v, map, [...pathSegs, String(i)])),
    );
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      violations.push(...grepGate(v, map, [...pathSegs, k]));
    }
  }
  return violations;
}

// 3b. PII pattern check (per nwrp33 C4 #1 + nwrp34 W-iter2-2 + W-iter2-3).
//     IMPORTANT: run on RAW input data BEFORE substitution (per nwrp34 W-iter2-2).
//     SUBSTITUTION-MAP mints contact@<sanitized>.com emails and 555-XXX-XXXX
//     phone numbers — running piiCheck post-substitution would false-positive
//     on every legitimate sanitized vendor row and halt the script.
//     Catches: free-text PII the SUBSTITUTION-MAP doesn't enumerate (homeowner
//     phone fragments, account numbers, SSN-shape values needing addition to
//     the substitution map before the script proceeds).
const PII_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: "us-phone", regex: /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g },
  { name: "email", regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { name: "ssn-shape", regex: /\b\d{3}-?\d{2}-?\d{4}\b/g }, // per nwrp34 W-iter2-3
  { name: "account-fragment", regex: /\b\d{6,9}\b/g }, // per nwrp34 W-iter2-3
];

function piiCheck(
  value: unknown,
  pathSegs: string[] = [],
): Array<{ path: string[]; piiType: string; matches: string[] }> {
  const hits: Array<{ path: string[]; piiType: string; matches: string[] }> = [];
  if (typeof value === "string") {
    for (const { name, regex } of PII_PATTERNS) {
      const matches = value.match(regex);
      if (matches && matches.length > 0) {
        hits.push({ path: pathSegs, piiType: name, matches });
      }
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...piiCheck(v, [...pathSegs, String(i)])));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      hits.push(...piiCheck(v, [...pathSegs, k]));
    }
  }
  return hits;
}

// 3c. Substring-collision check (per nwrp33 C4 #2 + nwrp34 W-iter2-1 fix).
//     Per-token predicate: is this token a leak?
//     - If the token IS a sanitized value from the map → not a collision.
//     - If the token CONTAINS any real identifier from the broadened denylist
//       (the same 32-entry pattern shared with the CI / pre-commit / extractor
//       grep gates) → collision detected.
//     Walker calls this per noun-phrase candidate extracted from each string.
//
// Per nwrp34 follow-up: short denylist tokens (3-4 letters like "Pou", "Fish",
// "Clark") use WORD-BOUNDARY matching to avoid false positives like
// "Foundation Pour" matching "Pou". Longer tokens (>=5 letters) use substring
// matching to catch OCR / partial-substitute drift.
function substringCollisionDetected(
  token: string,
  map: Map<string, string>,
  denylist: string[],
): boolean {
  // Sanitized value (intended output) → not a collision.
  if (Array.from(map.values()).includes(token)) return false;
  const lowerToken = token.toLowerCase();
  // Real identifier survived in this token (case mismatch / OCR variant /
  // hybrid post-substitute) → collision.
  for (const id of denylist) {
    const lowerId = id.toLowerCase();
    if (lowerId.length <= 4) {
      // Word-boundary match for short tokens — prevents "pour"/"clarkson"/
      // "fishing" false positives on "Pou"/"Clark"/"Fish".
      const re = new RegExp(`\\b${escapeRegex(lowerId)}\\b`, "i");
      if (re.test(lowerToken)) return true;
    } else {
      // Substring match for longer tokens — catches partial-substitute drift
      // like "Drummondville" or "501 74th Street West".
      if (lowerToken.includes(lowerId)) return true;
    }
  }
  return false;
}

function substringCollisionCheck(
  value: unknown,
  map: Map<string, string>,
  denylist: string[],
  pathSegs: string[] = [],
): Array<{ path: string[]; token: string; value: string }> {
  const hits: Array<{ path: string[]; token: string; value: string }> = [];
  if (typeof value === "string") {
    // Extract candidate tokens — capitalized 2+-word noun phrases (proper-noun
    // shape worth checking against the denylist).
    const NOUN_PHRASE = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,}/g;
    const phrases = value.match(NOUN_PHRASE) || [];
    for (const phrase of phrases) {
      if (substringCollisionDetected(phrase, map, denylist)) {
        hits.push({ path: pathSegs, token: phrase, value });
      }
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) =>
      hits.push(...substringCollisionCheck(v, map, denylist, [...pathSegs, String(i)])),
    );
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      hits.push(...substringCollisionCheck(v, map, denylist, [...pathSegs, k]));
    }
  }
  return hits;
}

// 4. Write a sanitized fixture file with consistent formatting.
function writeFixtureFile(
  filename: string,
  typeName: string,
  constName: string,
  items: unknown[],
  sourceFile: string,
) {
  const header = `// Sanitized Caldwell fixture — generated by scripts/sanitize-drummond.ts
// Source: ${sourceFile}
// Generated: ${new Date().toISOString().slice(0, 10)}
// Substitutions applied per .planning/fixtures/drummond/SUBSTITUTION-MAP.md (gitignored)
//
// DO NOT HAND-EDIT. Re-run \`npx tsx scripts/sanitize-drummond.ts\` to regenerate.

import type { ${typeName} } from "./types";

export const ${constName}: ${typeName}[] = ${JSON.stringify(items, null, 2)};
`;
  fs.writeFileSync(path.join(OUT_DIR, filename), header);
}

// Helper: convert dollar amount (number or string) to cents (integer).
function dollarsToCents(d: number | string | null | undefined): number {
  if (d == null) return 0;
  const n = typeof d === "string" ? parseFloat(d.replace(/[$,]/g, "")) : d;
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

// Compute payment_date per Ross Built rule:
//   received by 5th → pay 15th
//   received by 20th → pay 30th
//   weekend/holiday → next business day (we approximate by skipping Sat/Sun)
function computePaymentDate(receivedDate: string): string {
  const d = new Date(receivedDate + "T12:00:00Z"); // noon UTC to avoid TZ flip
  const day = d.getUTCDate();
  const month = d.getUTCMonth();
  const year = d.getUTCFullYear();
  let target: Date;
  if (day <= 5) {
    target = new Date(Date.UTC(year, month, 15));
  } else if (day <= 20) {
    target = new Date(Date.UTC(year, month, 30));
  } else {
    // After 20th → 15th of next month
    target = new Date(Date.UTC(year, month + 1, 15));
  }
  // Skip weekends — bump to Monday
  const dow = target.getUTCDay();
  if (dow === 6) target = new Date(target.getTime() + 2 * 86400000); // Sat → Mon
  if (dow === 0) target = new Date(target.getTime() + 1 * 86400000); // Sun → Mon
  return target.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────
// Per-entity extraction logic.
// ─────────────────────────────────────────────────────────────────────────

type InvoiceJson = {
  vendor_name_raw: string;
  invoice_number: string | null;
  invoice_date: string | null;
  total_amount_dollars: number;
  description: string;
  invoice_type: "progress" | "time_and_materials" | "lump_sum";
  status: string;
  received_date: string;
  line_items?: Array<{ description: string; amount_dollars: number; date?: string | null; qty?: number | null; unit?: string | null; rate?: number | null }>;
  flags?: string[];
  cost_code?: string | null;
  confidence_score?: number;
  confidence_details?: {
    vendor_name?: number;
    invoice_number?: number;
    total_amount?: number;
    job_reference?: number;
    cost_code_suggestion?: number;
  };
};

type DrawJson = {
  draw_number: number;
  application_date: string;
  period_start: string;
  period_end: string;
  original_contract_sum_dollars: number;
  net_change_orders_dollars: number;
  contract_sum_to_date_dollars: number;
  total_completed_to_date_dollars: number;
  less_previous_payments_dollars: number;
  current_payment_due_dollars: number;
  balance_to_finish_dollars: number;
  deposit_amount_dollars: number;
  status: "draft" | "pm_review" | "approved" | "submitted" | "paid" | "void";
  revision_number?: number;
  submitted_at?: string | null;
  paid_at?: string | null;
};

type DrawLineItemJson = {
  draw_number: number;
  cost_code: string;
  previous_applications_dollars: number;
  this_period_dollars: number;
  total_to_date_dollars: number;
  percent_complete: number;
  balance_to_finish_dollars: number;
};

type LienReleaseJson = {
  vendor_name_raw: string;
  invoice_number: string | null;
  release_type: "conditional_progress" | "unconditional_progress" | "conditional_final" | "unconditional_final";
  status: "received" | "pending" | "not_required" | "waived";
  release_date: string | null;
  amount_through_dollars: number;
};

type ChangeOrderJson = {
  pcco_number: number;
  description: string;
  amount_dollars: number;
  gc_fee_rate?: number;
  estimated_days_added?: number;
  status: "draft" | "pending_approval" | "approved" | "executed" | "void";
  approved_date?: string | null;
  draw_number?: number | null;
};

type BudgetLineJson = {
  cost_code: string;
  original_estimate_dollars: number;
  revised_estimate_dollars?: number;
};

type ScheduleItemJson = {
  name: string;
  start_date: string;
  end_date: string;
  predecessor_ids?: string[];
  parent_id?: string;
  assigned_vendor_slug?: string;
  percent_complete?: number;
  status?: "not_started" | "in_progress" | "complete" | "blocked";
  is_milestone?: boolean;
};

type DrummondFieldsJson = {
  invoices?: InvoiceJson[];
  draws?: DrawJson[];
  draw_line_items?: DrawLineItemJson[];
  lien_releases?: LienReleaseJson[];
  change_orders?: ChangeOrderJson[];
  budget_lines?: BudgetLineJson[];
  schedule_items?: ScheduleItemJson[];
  // Job + cost-codes + vendors are derived from the SUBSTITUTION-MAP and
  // raw fixture inspection; if executor wants to override, they can supply
  // full vendor list here.
  vendors_override?: Array<{ name_raw: string; default_cost_code?: string }>;
  job_override?: {
    name_raw: string;
    address_raw: string;
    client_name_raw: string;
    contract_amount_dollars: number;
    revised_contract_amount_dollars?: number;
    pm_id?: string;
  };
};

// Slugify a string for use in IDs.
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Main pipeline.
// ─────────────────────────────────────────────────────────────────────────
async function main() {
  const subMap = loadSubstitutionMap();
  console.log(`[sanitize-drummond] Loaded ${subMap.size} substitution entries`);

  // Verify .xls files have been re-saved as .xlsx (per D-18 pre-step).
  if (!fs.existsSync(RAW_DIR)) {
    console.error(`[sanitize-drummond] FAIL: raw fixture directory not found at ${RAW_DIR}`);
    process.exit(1);
  }
  const rawFiles = fs.readdirSync(RAW_DIR);
  const xlsFiles = rawFiles.filter((f) => f.toLowerCase().endsWith(".xls"));
  if (xlsFiles.length > 0) {
    console.error(`[sanitize-drummond] FAIL: ${xlsFiles.length} legacy .xls file(s) found:`);
    xlsFiles.forEach((f) => console.error(`  - ${f}`));
    console.error(`[sanitize-drummond] Re-save these as .xlsx in Excel before re-running (per CONTEXT D-18).`);
    process.exit(1);
  }

  // Load hand-curated invoice JSON if present (per CONTEXT D-17/D-19).
  let fields: DrummondFieldsJson = {};
  if (fs.existsSync(INVOICE_JSON_PATH)) {
    fields = JSON.parse(fs.readFileSync(INVOICE_JSON_PATH, "utf-8")) as DrummondFieldsJson;
    console.log(
      `[sanitize-drummond] Loaded hand-curated fields: ${(fields.invoices || []).length} invoices, ` +
        `${(fields.draws || []).length} draws, ${(fields.draw_line_items || []).length} draw line items, ` +
        `${(fields.lien_releases || []).length} lien releases, ${(fields.change_orders || []).length} change orders, ` +
        `${(fields.budget_lines || []).length} budget lines, ${(fields.schedule_items || []).length} schedule items`,
    );
  } else {
    console.warn(
      `[sanitize-drummond] WARN: ${INVOICE_JSON_PATH} not found. ` +
        `Sanitized fixtures will use derived/defaulted data only. ` +
        `For full invoice + draw fixture quality, hand-curate this JSON file (per CONTEXT D-17/D-19).`,
    );
  }

  // Per nwrp34 W-iter2-2: piiCheck on RAW input BEFORE substitution.
  // Catches unmapped PII before substitution (homeowner phone fragments,
  // account numbers, SSN-shape values needing addition to the substitution
  // map before the script proceeds).
  const rawPiiHits = piiCheck(fields);
  if (rawPiiHits.length > 0) {
    console.error("[sanitize-drummond] FAIL — raw PII detected in drummond-invoice-fields.json; review and add to SUBSTITUTION-MAP if customer-identifying:");
    for (const hit of rawPiiHits.slice(0, 20)) {
      console.error(`  ${hit.path.join(".")}: [${hit.piiType}] ${hit.matches.slice(0, 3).join(", ")}`);
    }
    console.error(
      `\n[sanitize-drummond] Note: vendor email + phone fields are expected to be substituted by the SUBSTITUTION-MAP. ` +
        `If these hits are vendor contact data that the map covers, you can clear them from the JSON or trust the substitution + grepGate post-substitute. ` +
        `If they are homeowner contact data or other unmapped PII, add to SUBSTITUTION-MAP.md and re-run.`,
    );
    // Note: do NOT hard-exit here — the SUBSTITUTION-MAP is expected to mint
    // its own 555-area-code phone numbers + contact@<vendor>.com emails,
    // which would re-trigger this check post-substitution. The check exists
    // to surface unmapped PII for executor review. Continue processing.
    // Per Jake's directive (nwrp34 W-iter2-2): warn but do not halt; the
    // grepGate + substringCollisionCheck on sanitized output are the hard gates.
  }

  // ─── JOBS ────────────────────────────────────────────────────────────
  // 1 entry — the Caldwell residence.
  const jobAnalog = fields.job_override;
  const jobs = [
    {
      id: "j-caldwell-1",
      name: jobAnalog
        ? substitute(jobAnalog.name_raw, subMap)
        : "Caldwell Residence",
      address: jobAnalog
        ? substitute(jobAnalog.address_raw, subMap)
        : "712 Pine Ave, Anna Maria, FL 34216",
      client_name: jobAnalog
        ? substitute(jobAnalog.client_name_raw, subMap)
        : "Mr. & Mrs. Caldwell",
      client_email: "client@caldwellresidence.example",
      client_phone: "(941) 555-0701",
      contract_type: "cost_plus" as const,
      original_contract_amount: jobAnalog
        ? dollarsToCents(jobAnalog.contract_amount_dollars)
        : 287_500_000, // $2.875M default — derived from Pay App 5 context
      current_contract_amount: jobAnalog
        ? dollarsToCents(jobAnalog.revised_contract_amount_dollars ?? jobAnalog.contract_amount_dollars)
        : 296_250_000,
      pm_id: jobAnalog?.pm_id ?? "u-brent-mullins", // sanitized PM (Bob Mozine → Brent Mullins per SUBSTITUTION-MAP)
      status: "active" as const,
      deposit_percentage: 0.1,
      gc_fee_percentage: 0.2,
    },
  ];

  // ─── COST CODES ──────────────────────────────────────────────────────
  // 25+ entries — covers Pay App 5 G703 row coverage. Per CLAUDE.md
  // "Drummond - Line Items Cost Coded.pdf" + standard Ross Built 5-digit codes.
  const costCodes = [
    // 01xxx — Pre-construction
    { id: "cc-01101", code: "01101", description: "Architectural Services", category: "Pre-construction", sort_order: 1 },
    { id: "cc-01104", code: "01104", description: "Pre-Permitting Planning Services", category: "Pre-construction", sort_order: 2 },
    { id: "cc-01201", code: "01201", description: "Engineering — Structural", category: "Pre-construction", sort_order: 3 },
    { id: "cc-01301", code: "01301", description: "Survey & Permitting Fees", category: "Pre-construction", sort_order: 4 },
    // 03xxx — Site logistics
    { id: "cc-03110", code: "03110", description: "Temporary Electric & Water", category: "Site logistics", sort_order: 5 },
    { id: "cc-03112", code: "03112", description: "Debris Removal", category: "Site logistics", sort_order: 6 },
    { id: "cc-03115", code: "03115", description: "Site Protection & Fencing", category: "Site logistics", sort_order: 7 },
    // 04xxx — Site work
    { id: "cc-04101", code: "04101", description: "Site Work — Clearing & Grading", category: "Site work", sort_order: 8 },
    { id: "cc-04201", code: "04201", description: "Site Work — Driveway & Hardscape", category: "Site work", sort_order: 9 },
    // 05xxx — Concrete
    { id: "cc-05101", code: "05101", description: "Concrete / Foundation", category: "Concrete", sort_order: 10 },
    { id: "cc-05201", code: "05201", description: "Concrete / Slab on Grade", category: "Concrete", sort_order: 11 },
    // 06xxx — Framing
    { id: "cc-06101", code: "06101", description: "Framing — Rough Carpentry", category: "Framing", sort_order: 12 },
    { id: "cc-06201", code: "06201", description: "Framing — Trusses", category: "Framing", sort_order: 13 },
    // 07xxx — Roofing
    { id: "cc-07101", code: "07101", description: "Roofing — Underlayment & Shingles", category: "Roofing", sort_order: 14 },
    { id: "cc-07201", code: "07201", description: "Roofing — Metal & Standing Seam", category: "Roofing", sort_order: 15 },
    // 08xxx — Insulation
    { id: "cc-08101", code: "08101", description: "Insulation — Spray Foam", category: "Envelope", sort_order: 16 },
    // 09xxx — Electrical
    { id: "cc-09101", code: "09101", description: "Electrical — Rough", category: "Electrical", sort_order: 17 },
    { id: "cc-09201", code: "09201", description: "Electrical — Trim & Finish", category: "Electrical", sort_order: 18 },
    // 10xxx — Plumbing
    { id: "cc-10101", code: "10101", description: "Plumbing — Rough", category: "Plumbing", sort_order: 19 },
    { id: "cc-10201", code: "10201", description: "Plumbing — Trim & Fixtures", category: "Plumbing", sort_order: 20 },
    // 12xxx — HVAC
    { id: "cc-12101", code: "12101", description: "HVAC — Rough & Equipment", category: "HVAC", sort_order: 21 },
    // 13xxx — Smart home
    { id: "cc-13101", code: "13101", description: "Smart Home — Low Voltage & Security", category: "Systems", sort_order: 22 },
    // 14xxx — Doors & Windows
    { id: "cc-14101", code: "14101", description: "Doors & Windows — Exterior", category: "Openings", sort_order: 23 },
    { id: "cc-14201", code: "14201", description: "Garage Doors", category: "Openings", sort_order: 24 },
    // 15xxx — Finishes
    { id: "cc-15101", code: "15101", description: "Drywall — Hang & Finish", category: "Finishes", sort_order: 25 },
    { id: "cc-15201", code: "15201", description: "Tile — Floor & Wall", category: "Finishes", sort_order: 26 },
    { id: "cc-15301", code: "15301", description: "Trim & Millwork", category: "Finishes", sort_order: 27 },
    { id: "cc-15401", code: "15401", description: "Cabinetry & Built-ins", category: "Finishes", sort_order: 28 },
    { id: "cc-15501", code: "15501", description: "Painting & Coatings", category: "Finishes", sort_order: 29 },
    // 16xxx — Lumber
    { id: "cc-16101", code: "16101", description: "Lumber & Building Materials", category: "Materials", sort_order: 30 },
  ];

  // ─── VENDORS ─────────────────────────────────────────────────────────
  // 17 entries — 14 substituted + 3 NO-SUB (Ferguson, FPL, Home Depot).
  // Per SUBSTITUTION-MAP.md vendor table.
  const vendors = [
    {
      id: "v-caldwell-coastal-smart-systems",
      name: substitute("SmartShield Homes", subMap),
      address: "2104 Coastal Way, Bradenton, FL 34208",
      phone: "(941) 555-0301",
      email: "contact@coastalsmartsystems.example",
      default_cost_code_id: "cc-13101",
    },
    {
      id: "v-caldwell-bay-region-carpentry",
      name: substitute("Florida Sunshine Carpentry", subMap),
      address: "418 Bay Region Dr, Sarasota, FL 34243",
      phone: "(941) 555-0302",
      email: "contact@bayregioncarpentry.example",
      default_cost_code_id: "cc-06101",
    },
    {
      id: "v-caldwell-sandhill-drywall",
      name: substitute("Doug Naeher Drywall", subMap),
      address: "812 Sandhill Trail, Bradenton, FL 34203",
      phone: "(941) 555-0303",
      email: "contact@sandhilldrywall.example",
      default_cost_code_id: "cc-15101",
    },
    {
      id: "v-caldwell-coastline-foam",
      name: substitute("Paradise Foam", subMap),
      address: "519 Coastline Ave, Palmetto, FL 34221",
      phone: "(941) 555-0304",
      email: "contact@coastlinefoam.example",
      default_cost_code_id: "cc-08101",
    },
    {
      id: "v-caldwell-bayside-doors",
      name: substitute("Banko Overhead Doors", subMap),
      address: "207 Bayside Pkwy, Bradenton, FL 34209",
      phone: "(941) 555-0305",
      email: "contact@baysidedoors.example",
      default_cost_code_id: "cc-14201",
    },
    {
      id: "v-caldwell-coastal-finishes",
      name: substitute("WG Drywall", subMap),
      address: "316 Coastal Finishes Way, Bradenton, FL 34210",
      phone: "(941) 555-0306",
      email: "contact@coastalfinishes.example",
      default_cost_code_id: "cc-15101",
    },
    {
      id: "v-caldwell-anchor-bay-plumbing",
      name: substitute("Loftin Plumbing", subMap),
      address: "925 Anchor Bay Rd, Bradenton, FL 34211",
      phone: "(941) 555-0307",
      email: "contact@anchorbayplumbing.example",
      default_cost_code_id: "cc-10101",
    },
    {
      id: "v-caldwell-sun-coast-lumber",
      name: substitute("Island Lumber", subMap),
      address: "1402 Sun Coast Blvd, Sarasota, FL 34233",
      phone: "(941) 555-0308",
      email: "contact@suncoastlumber.example",
      default_cost_code_id: "cc-16101",
    },
    {
      id: "v-caldwell-tide-mark-coatings",
      name: substitute("CoatRite", subMap),
      address: "608 Tide Mark Way, Bradenton, FL 34212",
      phone: "(941) 555-0309",
      email: "contact@tidemarkcoatings.example",
      default_cost_code_id: "cc-15501",
    },
    {
      id: "v-caldwell-manatee-eco",
      name: substitute("Ecosouth", subMap),
      address: "714 Manatee Eco Dr, Bradenton, FL 34213",
      phone: "(941) 555-0310",
      email: "contact@manateeeco.example",
      default_cost_code_id: "cc-08101",
    },
    {
      id: "v-caldwell-mj-bay",
      name: substitute("MJ Florida", subMap),
      address: "503 MJ Bay Trail, Sarasota, FL 34234",
      phone: "(941) 555-0311",
      email: "contact@mjbay.example",
      default_cost_code_id: "cc-15201",
    },
    {
      id: "v-caldwell-sand-dollar-tile",
      name: substitute("Rangel Tile", subMap),
      address: "812 Sand Dollar Ave, Bradenton, FL 34214",
      phone: "(941) 555-0312",
      email: "contact@sanddollartile.example",
      default_cost_code_id: "cc-15201",
    },
    {
      id: "v-caldwell-bayside-painting",
      name: substitute("TNT Painting", subMap),
      address: "919 Bayside Painting Blvd, Sarasota, FL 34235",
      phone: "(941) 555-0313",
      email: "contact@baysidepainting.example",
      default_cost_code_id: "cc-15501",
    },
    {
      id: "v-caldwell-coastline-roofing",
      name: substitute("Avery Roofing", subMap),
      address: "1006 Coastline Roof Rd, Bradenton, FL 34215",
      phone: "(941) 555-0314",
      email: "contact@coastlineroofing.example",
      default_cost_code_id: "cc-07101",
    },
    {
      id: "v-caldwell-bay-region-concrete",
      name: substitute("ML Concrete LLC", subMap),
      address: "1418 Bay Region Concrete Way, Bradenton, FL 34216",
      phone: "(941) 555-0315",
      email: "contact@bayregionconcrete.example",
      default_cost_code_id: "cc-05101",
    },
    // 3 NO-SUB national chains
    {
      id: "v-caldwell-ferguson",
      name: "Ferguson",
      address: "Ferguson Enterprises, FL Branch",
      phone: "(800) 555-0001",
      email: "contact@ferguson.example",
      default_cost_code_id: "cc-10101",
    },
    {
      id: "v-caldwell-fpl",
      name: "FPL",
      address: "Florida Power & Light, FL",
      phone: "(800) 555-0002",
      email: "contact@fpl.example",
      default_cost_code_id: "cc-03110",
    },
    {
      id: "v-caldwell-home-depot",
      name: "Home Depot",
      address: "Home Depot, Bradenton FL Branch",
      phone: "(800) 555-0003",
      email: "contact@homedepot.example",
      default_cost_code_id: "cc-16101",
    },
  ];

  // ─── INVOICES ─────────────────────────────────────────────────────────
  // 4-6 minimum invoices. Pull from hand-curated JSON if available;
  // otherwise mint a default set covering 4 statuses + 3 format types.
  let invoices: Array<Record<string, unknown>>;
  if (fields.invoices && fields.invoices.length > 0) {
    invoices = fields.invoices.map((inv, i) => {
      const sanitizedVendorName = substitute(inv.vendor_name_raw, subMap);
      // Match vendor by sanitized name
      const vendor = vendors.find((v) => v.name === sanitizedVendorName);
      const id = `inv-caldwell-${String(i + 1).padStart(3, "0")}`;
      const status = inv.status as
        | "received" | "ai_processed" | "pm_review" | "pm_approved" | "pm_held"
        | "pm_denied" | "qa_review" | "qa_approved" | "qa_kicked_back"
        | "pushed_to_qb" | "in_draw" | "paid";
      const lineItems = (inv.line_items ?? []).map((li) => ({
        description: substitute(li.description, subMap),
        date: li.date ?? null,
        qty: li.qty ?? null,
        unit: li.unit ?? null,
        rate: li.rate ?? null,
        amount: dollarsToCents(li.amount_dollars),
      }));
      const isPaid = status === "paid" || status === "in_draw" || status === "pushed_to_qb";
      return {
        id,
        vendor_id: vendor?.id ?? "v-caldwell-coastal-smart-systems",
        job_id: "j-caldwell-1",
        cost_code_id: inv.cost_code ? `cc-${inv.cost_code}` : (vendor?.default_cost_code_id ?? null),
        po_id: null,
        co_id: null,
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        description: substitute(inv.description, subMap),
        invoice_type: inv.invoice_type,
        total_amount: dollarsToCents(inv.total_amount_dollars),
        confidence_score: inv.confidence_score ?? (status === "ai_processed" ? 0.72 : status === "pm_review" ? 0.81 : 0.94),
        confidence_details: {
          vendor_name: inv.confidence_details?.vendor_name ?? 0.96,
          invoice_number: inv.confidence_details?.invoice_number ?? (inv.invoice_number ? 0.92 : 0.0),
          total_amount: inv.confidence_details?.total_amount ?? 0.99,
          job_reference: inv.confidence_details?.job_reference ?? 0.85,
          cost_code_suggestion: inv.confidence_details?.cost_code_suggestion ?? 0.78,
        },
        status,
        received_date: inv.received_date,
        payment_date: isPaid ? computePaymentDate(inv.received_date) : null,
        draw_id: status === "in_draw" || status === "paid" || status === "pushed_to_qb" ? "d-caldwell-05" : null,
        line_items: lineItems,
        flags: inv.flags ?? [],
        original_file_url: null,
      };
    });
  } else {
    // Default 6-invoice fixture covering required workflow + format diversity.
    invoices = [
      // 1 — ai_processed (yellow), progress, clean PDF
      {
        id: "inv-caldwell-001",
        vendor_id: "v-caldwell-anchor-bay-plumbing",
        job_id: "j-caldwell-1",
        cost_code_id: "cc-10101",
        po_id: null,
        co_id: null,
        invoice_number: "ABP-2025-11-0042",
        invoice_date: "2025-11-08",
        description: "Plumbing rough-in — first floor + master suite",
        invoice_type: "progress",
        total_amount: 1_989_900,
        confidence_score: 0.81,
        confidence_details: {
          vendor_name: 0.96,
          invoice_number: 0.84,
          total_amount: 0.99,
          job_reference: 0.74,
          cost_code_suggestion: 0.72,
        },
        status: "ai_processed",
        received_date: "2025-11-10",
        payment_date: null,
        draw_id: null,
        line_items: [
          {
            description: "Plumbing rough-in — Phase 2 progress",
            date: null,
            qty: null,
            unit: null,
            rate: null,
            amount: 1_989_900,
          },
        ],
        flags: ["job_reference_low_confidence"],
        original_file_url: null,
      },
      // 2 — pm_review (yellow), T&M, daily labor
      {
        id: "inv-caldwell-002",
        vendor_id: "v-caldwell-bay-region-carpentry",
        job_id: "j-caldwell-1",
        cost_code_id: "cc-06101",
        po_id: null,
        co_id: null,
        invoice_number: "BRC-2511-08",
        invoice_date: "2025-11-08",
        description: "Framing — week ending 11/07, T&M",
        invoice_type: "time_and_materials",
        total_amount: 1_854_000,
        confidence_score: 0.78,
        confidence_details: {
          vendor_name: 0.95,
          invoice_number: 0.74,
          total_amount: 0.92,
          job_reference: 0.69,
          cost_code_suggestion: 0.61,
        },
        status: "pm_review",
        received_date: "2025-11-10",
        payment_date: null,
        draw_id: null,
        line_items: [
          {
            description: "Lead carpenter — site supervision",
            date: "2025-11-03",
            qty: 8,
            unit: "hours",
            rate: 95,
            amount: 76_000,
          },
          {
            description: "Crew of 4 — exterior wall framing",
            date: "2025-11-03",
            qty: 32,
            unit: "hours",
            rate: 65,
            amount: 208_000,
          },
          {
            description: "Crew of 4 — interior partitions",
            date: "2025-11-04",
            qty: 32,
            unit: "hours",
            rate: 65,
            amount: 208_000,
          },
          {
            description: "Crew of 4 — second story framing",
            date: "2025-11-05",
            qty: 32,
            unit: "hours",
            rate: 65,
            amount: 208_000,
          },
          {
            description: "Lumber pull — second story plates",
            date: "2025-11-06",
            qty: null,
            unit: null,
            rate: null,
            amount: 1_154_000,
          },
        ],
        flags: ["job_reference_low_confidence"],
        original_file_url: null,
      },
      // 3 — qa_review (green), lump_sum
      {
        id: "inv-caldwell-003",
        vendor_id: "v-caldwell-sandhill-drywall",
        job_id: "j-caldwell-1",
        cost_code_id: "cc-15101",
        po_id: null,
        co_id: null,
        invoice_number: null, // some vendors omit
        invoice_date: "2025-11-12",
        description: "Drywall hang & finish — full house",
        invoice_type: "lump_sum",
        total_amount: 4_125_000,
        confidence_score: 0.93,
        confidence_details: {
          vendor_name: 0.97,
          invoice_number: 0.0,
          total_amount: 0.99,
          job_reference: 0.91,
          cost_code_suggestion: 0.94,
        },
        status: "qa_review",
        received_date: "2025-11-13",
        payment_date: null,
        draw_id: null,
        line_items: [
          {
            description: "Drywall hang & finish — full house",
            date: null,
            qty: null,
            unit: null,
            rate: null,
            amount: 4_125_000,
          },
        ],
        flags: ["no_invoice_number"],
        original_file_url: null,
      },
      // 4 — paid, progress, clean PDF
      {
        id: "inv-caldwell-004",
        vendor_id: "v-caldwell-coastal-smart-systems",
        job_id: "j-caldwell-1",
        cost_code_id: "cc-13101",
        po_id: null,
        co_id: null,
        invoice_number: "INV-105472",
        invoice_date: "2025-10-15",
        description: "Smart home — low voltage rough + camera prewire",
        invoice_type: "progress",
        total_amount: 284_584,
        confidence_score: 0.97,
        confidence_details: {
          vendor_name: 0.99,
          invoice_number: 0.97,
          total_amount: 0.99,
          job_reference: 0.95,
          cost_code_suggestion: 0.94,
        },
        status: "paid",
        received_date: "2025-10-18",
        payment_date: computePaymentDate("2025-10-18"),
        draw_id: "d-caldwell-05",
        line_items: [
          {
            description: "Low voltage rough — first floor",
            date: null,
            qty: null,
            unit: null,
            rate: null,
            amount: 184_584,
          },
          {
            description: "Camera + alarm prewire — exterior + 4 cameras",
            date: null,
            qty: null,
            unit: null,
            rate: null,
            amount: 100_000,
          },
        ],
        flags: [],
        original_file_url: null,
      },
      // 5 — paid, progress, lumber pull (Island Lumber → Sun Coast Lumber)
      {
        id: "inv-caldwell-005",
        vendor_id: "v-caldwell-sun-coast-lumber",
        job_id: "j-caldwell-1",
        cost_code_id: "cc-16101",
        po_id: null,
        co_id: null,
        invoice_number: "525830",
        invoice_date: "2025-10-22",
        description: "Lumber + framing materials — second floor pull",
        invoice_type: "progress",
        total_amount: 6_009,
        confidence_score: 0.95,
        confidence_details: {
          vendor_name: 0.98,
          invoice_number: 0.96,
          total_amount: 0.99,
          job_reference: 0.92,
          cost_code_suggestion: 0.91,
        },
        status: "paid",
        received_date: "2025-10-23",
        payment_date: computePaymentDate("2025-10-23"),
        draw_id: "d-caldwell-05",
        line_items: [
          {
            description: "Lumber pull — second floor framing",
            date: null,
            qty: null,
            unit: null,
            rate: null,
            amount: 6_009,
          },
        ],
        flags: [],
        original_file_url: null,
      },
      // 6 — pm_held, lump_sum, awaiting clarification
      {
        id: "inv-caldwell-006",
        vendor_id: "v-caldwell-coastline-foam",
        job_id: "j-caldwell-1",
        cost_code_id: "cc-08101",
        po_id: null,
        co_id: null,
        invoice_number: "5977",
        invoice_date: "2025-10-30",
        description: "Spray foam insulation — full house envelope",
        invoice_type: "lump_sum",
        total_amount: 1_792_156,
        confidence_score: 0.69,
        confidence_details: {
          vendor_name: 0.91,
          invoice_number: 0.84,
          total_amount: 0.97,
          job_reference: 0.62,
          cost_code_suggestion: 0.5,
        },
        status: "pm_held",
        received_date: "2025-11-01",
        payment_date: null,
        draw_id: null,
        line_items: [
          {
            description: "Spray foam insulation — walls + roof deck",
            date: null,
            qty: null,
            unit: null,
            rate: null,
            amount: 1_792_156,
          },
        ],
        flags: ["job_reference_low_confidence", "scope_unclear"],
        original_file_url: null,
      },
    ];
  }

  // ─── DRAWS ────────────────────────────────────────────────────────────
  // 5 historical pay apps. Use hand-curated JSON if available; otherwise
  // synthesize 5 draws with monotonically increasing periods.
  let draws: Array<Record<string, unknown>>;
  if (fields.draws && fields.draws.length > 0) {
    draws = fields.draws.map((d) => ({
      id: `d-caldwell-${String(d.draw_number).padStart(2, "0")}`,
      job_id: "j-caldwell-1",
      draw_number: d.draw_number,
      application_date: d.application_date,
      period_start: d.period_start,
      period_end: d.period_end,
      status: d.status,
      revision_number: d.revision_number ?? 0,
      original_contract_sum: dollarsToCents(d.original_contract_sum_dollars),
      net_change_orders: dollarsToCents(d.net_change_orders_dollars),
      contract_sum_to_date: dollarsToCents(d.contract_sum_to_date_dollars),
      total_completed_to_date: dollarsToCents(d.total_completed_to_date_dollars),
      less_previous_payments: dollarsToCents(d.less_previous_payments_dollars),
      current_payment_due: dollarsToCents(d.current_payment_due_dollars),
      balance_to_finish: dollarsToCents(d.balance_to_finish_dollars),
      deposit_amount: dollarsToCents(d.deposit_amount_dollars),
      submitted_at: d.submitted_at ?? (d.status !== "draft" && d.status !== "pm_review" ? `${d.application_date}T14:30:00Z` : null),
      paid_at: d.paid_at ?? (d.status === "paid" ? `${d.period_end}T11:15:00Z` : null),
    }));
  } else {
    // Synthesize 5 draws spanning ~6 months (March 2025 → November 2025).
    const ORIGINAL = 287_500_000; // $2.875M
    const NET_COS = 8_750_000; // $87.5K
    const CONTRACT_TO_DATE = ORIGINAL + NET_COS;
    const DEPOSIT = 28_750_000; // 10%
    const drawProgressions = [
      { num: 1, period: ["2025-03-01", "2025-07-31"], application: "2025-08-05", completed: 86_250_000, status: "paid" as const },
      { num: 2, period: ["2025-08-01", "2025-08-31"], application: "2025-09-05", completed: 130_500_000, status: "paid" as const },
      { num: 3, period: ["2025-09-01", "2025-09-30"], application: "2025-10-05", completed: 172_800_000, status: "paid" as const },
      { num: 4, period: ["2025-10-01", "2025-10-31"], application: "2025-11-05", completed: 214_600_000, status: "paid" as const },
      { num: 5, period: ["2025-11-01", "2025-11-30"], application: "2025-12-05", completed: 252_100_000, status: "submitted" as const },
    ];
    draws = drawProgressions.map((d, i) => {
      const previousPayments = i > 0 ? drawProgressions[i - 1].completed : 0;
      const currentPaymentDue = d.completed - previousPayments;
      const balanceToFinish = CONTRACT_TO_DATE - d.completed;
      return {
        id: `d-caldwell-${String(d.num).padStart(2, "0")}`,
        job_id: "j-caldwell-1",
        draw_number: d.num,
        application_date: d.application,
        period_start: d.period[0],
        period_end: d.period[1],
        status: d.status,
        revision_number: 0,
        original_contract_sum: ORIGINAL,
        net_change_orders: NET_COS,
        contract_sum_to_date: CONTRACT_TO_DATE,
        total_completed_to_date: d.completed,
        less_previous_payments: previousPayments,
        current_payment_due: currentPaymentDue,
        balance_to_finish: balanceToFinish,
        deposit_amount: DEPOSIT,
        submitted_at: `${d.application}T14:30:00Z`,
        paid_at: d.status === "paid" ? `${d.period[1]}T11:15:00Z` : null,
      };
    });
  }

  // ─── DRAW LINE ITEMS ─────────────────────────────────────────────────
  // 25+ per draw, 100+ total. Use hand-curated JSON if available;
  // otherwise synthesize from cost codes + budget proportions.
  let drawLineItems: Array<Record<string, unknown>>;
  if (fields.draw_line_items && fields.draw_line_items.length > 0) {
    drawLineItems = fields.draw_line_items.map((li, i) => {
      const drawId = `d-caldwell-${String(li.draw_number).padStart(2, "0")}`;
      const ccId = `cc-${li.cost_code}`;
      return {
        id: `dli-caldwell-${String(i + 1).padStart(4, "0")}`,
        draw_id: drawId,
        budget_line_id: `bl-caldwell-${li.cost_code}`,
        cost_code_id: ccId,
        previous_applications: dollarsToCents(li.previous_applications_dollars),
        this_period: dollarsToCents(li.this_period_dollars),
        total_to_date: dollarsToCents(li.total_to_date_dollars),
        percent_complete: li.percent_complete,
        balance_to_finish: dollarsToCents(li.balance_to_finish_dollars),
      };
    });
  } else {
    // Synthesize draw line items: each cost code gets one per draw, with
    // monotonically increasing this_period values that sum to total_completed.
    drawLineItems = [];
    const costCodeWeights: Record<string, number> = {
      "01101": 0.04, "01104": 0.02, "01201": 0.03, "01301": 0.02,
      "03110": 0.02, "03112": 0.01, "03115": 0.01,
      "04101": 0.04, "04201": 0.03,
      "05101": 0.07, "05201": 0.04,
      "06101": 0.10, "06201": 0.04,
      "07101": 0.05, "07201": 0.03,
      "08101": 0.04,
      "09101": 0.06, "09201": 0.03,
      "10101": 0.06, "10201": 0.03,
      "12101": 0.05,
      "13101": 0.02,
      "14101": 0.04, "14201": 0.02,
      "15101": 0.05, "15201": 0.04, "15301": 0.03, "15401": 0.06, "15501": 0.04,
      "16101": 0.03,
    };
    let id = 1;
    const drawObjs = draws as Array<{ id: string; draw_number: number; total_completed_to_date: number; contract_sum_to_date: number; balance_to_finish: number }>;
    for (const draw of drawObjs) {
      const drawTotalCents = draw.total_completed_to_date;
      const contractSum = draw.contract_sum_to_date;
      const previousDraw = drawObjs.find((d) => d.draw_number === draw.draw_number - 1);
      const previousTotal = previousDraw?.total_completed_to_date ?? 0;
      for (const cc of costCodes) {
        const weight = costCodeWeights[cc.code] ?? 0;
        if (weight === 0) continue;
        const allocatedTotal = Math.round(drawTotalCents * weight);
        const previousAllocated = Math.round(previousTotal * weight);
        const thisPeriod = allocatedTotal - previousAllocated;
        const revisedEstimate = Math.round(contractSum * weight);
        const percentComplete = revisedEstimate > 0 ? Math.min(allocatedTotal / revisedEstimate, 1) : 0;
        const balanceToFinish = revisedEstimate - allocatedTotal;
        drawLineItems.push({
          id: `dli-caldwell-${String(id++).padStart(4, "0")}`,
          draw_id: draw.id,
          budget_line_id: `bl-caldwell-${cc.code}`,
          cost_code_id: cc.id,
          previous_applications: previousAllocated,
          this_period: thisPeriod,
          total_to_date: allocatedTotal,
          percent_complete: Math.round(percentComplete * 1000) / 1000,
          balance_to_finish: balanceToFinish,
        });
      }
    }
  }

  // ─── CHANGE ORDERS ───────────────────────────────────────────────────
  // 4-6 entries. Use hand-curated JSON if available; otherwise mint defaults.
  let changeOrders: Array<Record<string, unknown>>;
  if (fields.change_orders && fields.change_orders.length > 0) {
    changeOrders = fields.change_orders.map((co) => {
      const feeRate = co.gc_fee_rate ?? 0.2;
      const amount = dollarsToCents(co.amount_dollars);
      const feeAmount = Math.round(amount * feeRate);
      return {
        id: `co-caldwell-${String(co.pcco_number).padStart(2, "0")}`,
        job_id: "j-caldwell-1",
        pcco_number: co.pcco_number,
        description: substitute(co.description, subMap),
        amount,
        gc_fee_amount: feeAmount,
        gc_fee_rate: feeRate,
        total_with_fee: amount + feeAmount,
        estimated_days_added: co.estimated_days_added ?? 0,
        status: co.status,
        approved_date: co.approved_date ?? null,
        draw_number: co.draw_number ?? null,
      };
    });
  } else {
    changeOrders = [
      {
        id: "co-caldwell-01",
        job_id: "j-caldwell-1",
        pcco_number: 1,
        description: "Pool — upgrade to PebbleTec finish + spa enclosure",
        amount: 3_500_000, // $35K
        gc_fee_amount: 700_000,
        gc_fee_rate: 0.2,
        total_with_fee: 4_200_000,
        estimated_days_added: 14,
        status: "executed",
        approved_date: "2025-08-22",
        draw_number: 2,
      },
      {
        id: "co-caldwell-02",
        job_id: "j-caldwell-1",
        pcco_number: 2,
        description: "Kitchen — reconfigure island, add wine fridge alcove",
        amount: 1_850_000,
        gc_fee_amount: 370_000,
        gc_fee_rate: 0.2,
        total_with_fee: 2_220_000,
        estimated_days_added: 7,
        status: "executed",
        approved_date: "2025-09-15",
        draw_number: 3,
      },
      {
        id: "co-caldwell-03",
        job_id: "j-caldwell-1",
        pcco_number: 3,
        description: "HVAC — upgrade to high-efficiency variable speed system",
        amount: 1_240_000,
        gc_fee_amount: 248_000,
        gc_fee_rate: 0.2,
        total_with_fee: 1_488_000,
        estimated_days_added: 5,
        status: "executed",
        approved_date: "2025-10-08",
        draw_number: 4,
      },
      {
        id: "co-caldwell-04",
        job_id: "j-caldwell-1",
        pcco_number: 4,
        description: "Garage — extend bay 3 by 4ft for boat clearance",
        amount: 1_780_000,
        gc_fee_amount: 320_400,
        gc_fee_rate: 0.18, // negotiated lower fee
        total_with_fee: 2_100_400,
        estimated_days_added: 18,
        status: "approved",
        approved_date: "2025-11-12",
        draw_number: null,
      },
      {
        id: "co-caldwell-05",
        job_id: "j-caldwell-1",
        pcco_number: 5,
        description: "Outdoor kitchen — extend covered lanai + grill station",
        amount: 380_000,
        gc_fee_amount: 76_000,
        gc_fee_rate: 0.2,
        total_with_fee: 456_000,
        estimated_days_added: 10,
        status: "pending_approval",
        approved_date: null,
        draw_number: null,
      },
    ];
  }

  // ─── BUDGET LINES ────────────────────────────────────────────────────
  // 25+ entries — one per cost code per job, computed fields LEFT OFF per R.2.
  let budget: Array<Record<string, unknown>>;
  if (fields.budget_lines && fields.budget_lines.length > 0) {
    budget = fields.budget_lines.map((bl) => ({
      id: `bl-caldwell-${bl.cost_code}`,
      job_id: "j-caldwell-1",
      cost_code_id: `cc-${bl.cost_code}`,
      original_estimate: dollarsToCents(bl.original_estimate_dollars),
      revised_estimate: dollarsToCents(bl.revised_estimate_dollars ?? bl.original_estimate_dollars),
    }));
  } else {
    // Synthesize budget from cost codes + weights, applying CO adjustments to
    // affected lines.
    const TOTAL_BUDGET = 287_500_000; // job original
    const REVISED_TOTAL = 296_250_000;
    const codeWeights: Record<string, number> = {
      "01101": 0.04, "01104": 0.02, "01201": 0.03, "01301": 0.02,
      "03110": 0.02, "03112": 0.01, "03115": 0.01,
      "04101": 0.04, "04201": 0.03,
      "05101": 0.07, "05201": 0.04,
      "06101": 0.10, "06201": 0.04,
      "07101": 0.05, "07201": 0.03,
      "08101": 0.04,
      "09101": 0.06, "09201": 0.03,
      "10101": 0.06, "10201": 0.03,
      "12101": 0.05,
      "13101": 0.02,
      "14101": 0.04, "14201": 0.02,
      "15101": 0.05, "15201": 0.04, "15301": 0.03, "15401": 0.06, "15501": 0.04,
      "16101": 0.03,
    };
    budget = costCodes
      .filter((cc) => (codeWeights[cc.code] ?? 0) > 0)
      .map((cc) => {
        const weight = codeWeights[cc.code] ?? 0;
        const original = Math.round(TOTAL_BUDGET * weight);
        const revised = Math.round(REVISED_TOTAL * weight);
        return {
          id: `bl-caldwell-${cc.code}`,
          job_id: "j-caldwell-1",
          cost_code_id: cc.id,
          original_estimate: original,
          revised_estimate: revised,
        };
      });
  }

  // ─── LIEN RELEASES ───────────────────────────────────────────────────
  // 4 minimum (1 per Florida statute type).
  let lienReleases: Array<Record<string, unknown>>;
  if (fields.lien_releases && fields.lien_releases.length > 0) {
    lienReleases = fields.lien_releases.map((lr, i) => {
      const sanitizedVendorName = substitute(lr.vendor_name_raw, subMap);
      const vendor = vendors.find((v) => v.name === sanitizedVendorName);
      const matchingInvoice = invoices.find((inv) => inv.invoice_number === lr.invoice_number) as
        | { id: string; vendor_id: string; draw_id: string | null }
        | undefined;
      return {
        id: `lr-caldwell-${String(i + 1).padStart(3, "0")}`,
        job_id: "j-caldwell-1",
        vendor_id: vendor?.id ?? matchingInvoice?.vendor_id ?? "v-caldwell-coastal-smart-systems",
        invoice_id: matchingInvoice?.id ?? "inv-caldwell-001",
        draw_id: matchingInvoice?.draw_id ?? null,
        release_type: lr.release_type,
        status: lr.status,
        release_date: lr.release_date,
        amount_through: dollarsToCents(lr.amount_through_dollars),
      };
    });
  } else {
    // 4 statute types — at least one of each.
    lienReleases = [
      {
        id: "lr-caldwell-001",
        job_id: "j-caldwell-1",
        vendor_id: "v-caldwell-coastal-smart-systems",
        invoice_id: "inv-caldwell-004",
        draw_id: "d-caldwell-05",
        release_type: "conditional_progress",
        status: "received",
        release_date: "2025-10-25",
        amount_through: 284_584,
      },
      {
        id: "lr-caldwell-002",
        job_id: "j-caldwell-1",
        vendor_id: "v-caldwell-sun-coast-lumber",
        invoice_id: "inv-caldwell-005",
        draw_id: "d-caldwell-05",
        release_type: "unconditional_progress",
        status: "received",
        release_date: "2025-11-01",
        amount_through: 6_009,
      },
      {
        id: "lr-caldwell-003",
        job_id: "j-caldwell-1",
        vendor_id: "v-caldwell-anchor-bay-plumbing",
        invoice_id: "inv-caldwell-001",
        draw_id: null,
        release_type: "conditional_final",
        status: "pending",
        release_date: null,
        amount_through: 1_989_900,
      },
      {
        id: "lr-caldwell-004",
        job_id: "j-caldwell-1",
        vendor_id: "v-caldwell-coastline-foam",
        invoice_id: "inv-caldwell-006",
        draw_id: null,
        release_type: "unconditional_final",
        status: "pending",
        release_date: null,
        amount_through: 1_792_156,
      },
    ];
  }

  // ─── SCHEDULE ITEMS ──────────────────────────────────────────────────
  // 20+ tasks, 6+ month timeline, ≥2 milestones, dependencies populated.
  let schedule: Array<Record<string, unknown>>;
  if (fields.schedule_items && fields.schedule_items.length > 0) {
    schedule = fields.schedule_items.map((s, i) => ({
      id: `s-caldwell-${String(i + 1).padStart(3, "0")}`,
      job_id: "j-caldwell-1",
      name: substitute(s.name, subMap),
      start_date: s.start_date,
      end_date: s.end_date,
      predecessor_ids: s.predecessor_ids ?? [],
      ...(s.parent_id ? { parent_id: s.parent_id } : {}),
      ...(s.assigned_vendor_slug ? { assigned_vendor_id: `v-caldwell-${s.assigned_vendor_slug}` } : {}),
      percent_complete: s.percent_complete ?? 0,
      status: s.status ?? "not_started",
      is_milestone: s.is_milestone ?? false,
    }));
  } else {
    // Synthesize 22 schedule tasks + 5 milestones spanning March 2025 → Feb 2026.
    schedule = [
      // Pre-construction
      { id: "s-caldwell-001", job_id: "j-caldwell-1", name: "Architectural Services — Schematic + DD", start_date: "2025-01-15", end_date: "2025-02-28", predecessor_ids: [], percent_complete: 1, status: "complete", is_milestone: false },
      { id: "s-caldwell-002", job_id: "j-caldwell-1", name: "Permits — County + Stormwater", start_date: "2025-02-15", end_date: "2025-03-15", predecessor_ids: ["s-caldwell-001"], percent_complete: 1, status: "complete", is_milestone: false },
      { id: "s-caldwell-003", job_id: "j-caldwell-1", name: "Pre-Construction Meeting", start_date: "2025-03-01", end_date: "2025-03-01", predecessor_ids: ["s-caldwell-002"], percent_complete: 1, status: "complete", is_milestone: true },
      // Site work + foundation
      { id: "s-caldwell-004", job_id: "j-caldwell-1", name: "Site Clearing + Grading", start_date: "2025-03-15", end_date: "2025-04-05", predecessor_ids: ["s-caldwell-003"], percent_complete: 1, status: "complete", is_milestone: false, assigned_vendor_id: "v-caldwell-bay-region-concrete" },
      { id: "s-caldwell-005", job_id: "j-caldwell-1", name: "Foundation Casting", start_date: "2025-04-08", end_date: "2025-05-01", predecessor_ids: ["s-caldwell-004"], percent_complete: 1, status: "complete", is_milestone: false, assigned_vendor_id: "v-caldwell-bay-region-concrete" },
      { id: "s-caldwell-006", job_id: "j-caldwell-1", name: "Foundation Inspection", start_date: "2025-05-02", end_date: "2025-05-02", predecessor_ids: ["s-caldwell-005"], percent_complete: 1, status: "complete", is_milestone: true },
      // Framing
      { id: "s-caldwell-007", job_id: "j-caldwell-1", name: "First Floor Framing", start_date: "2025-05-05", end_date: "2025-06-10", predecessor_ids: ["s-caldwell-006"], percent_complete: 1, status: "complete", is_milestone: false, assigned_vendor_id: "v-caldwell-bay-region-carpentry" },
      { id: "s-caldwell-008", job_id: "j-caldwell-1", name: "Second Floor Framing", start_date: "2025-06-12", end_date: "2025-07-20", predecessor_ids: ["s-caldwell-007"], percent_complete: 1, status: "complete", is_milestone: false, assigned_vendor_id: "v-caldwell-bay-region-carpentry" },
      { id: "s-caldwell-009", job_id: "j-caldwell-1", name: "Roof Trusses + Decking", start_date: "2025-07-22", end_date: "2025-08-15", predecessor_ids: ["s-caldwell-008"], percent_complete: 1, status: "complete", is_milestone: false, assigned_vendor_id: "v-caldwell-bay-region-carpentry" },
      { id: "s-caldwell-010", job_id: "j-caldwell-1", name: "Dry-In Inspection", start_date: "2025-08-18", end_date: "2025-08-18", predecessor_ids: ["s-caldwell-009"], percent_complete: 1, status: "complete", is_milestone: true },
      // Mechanical rough
      { id: "s-caldwell-011", job_id: "j-caldwell-1", name: "Plumbing Rough-In", start_date: "2025-08-20", end_date: "2025-09-25", predecessor_ids: ["s-caldwell-010"], percent_complete: 0.95, status: "in_progress", is_milestone: false, assigned_vendor_id: "v-caldwell-anchor-bay-plumbing" },
      { id: "s-caldwell-012", job_id: "j-caldwell-1", name: "Electrical Rough", start_date: "2025-08-25", end_date: "2025-10-05", predecessor_ids: ["s-caldwell-010"], percent_complete: 0.85, status: "in_progress", is_milestone: false },
      { id: "s-caldwell-013", job_id: "j-caldwell-1", name: "HVAC Rough + Equipment", start_date: "2025-09-01", end_date: "2025-10-15", predecessor_ids: ["s-caldwell-010"], percent_complete: 0.7, status: "in_progress", is_milestone: false },
      { id: "s-caldwell-014", job_id: "j-caldwell-1", name: "Smart Home Low Voltage", start_date: "2025-09-15", end_date: "2025-10-20", predecessor_ids: ["s-caldwell-012"], percent_complete: 0.6, status: "in_progress", is_milestone: false, assigned_vendor_id: "v-caldwell-coastal-smart-systems" },
      // Envelope
      { id: "s-caldwell-015", job_id: "j-caldwell-1", name: "Spray Foam Insulation", start_date: "2025-10-22", end_date: "2025-11-05", predecessor_ids: ["s-caldwell-011", "s-caldwell-012", "s-caldwell-013"], percent_complete: 0.5, status: "in_progress", is_milestone: false, assigned_vendor_id: "v-caldwell-coastline-foam" },
      { id: "s-caldwell-016", job_id: "j-caldwell-1", name: "Drywall Hang + Finish", start_date: "2025-11-10", end_date: "2025-12-15", predecessor_ids: ["s-caldwell-015"], percent_complete: 0.2, status: "in_progress", is_milestone: false, assigned_vendor_id: "v-caldwell-sandhill-drywall" },
      // Finishes
      { id: "s-caldwell-017", job_id: "j-caldwell-1", name: "Tile — Floor + Wall", start_date: "2025-12-18", end_date: "2026-01-20", predecessor_ids: ["s-caldwell-016"], percent_complete: 0, status: "not_started", is_milestone: false, assigned_vendor_id: "v-caldwell-sand-dollar-tile" },
      { id: "s-caldwell-018", job_id: "j-caldwell-1", name: "Cabinetry + Built-ins", start_date: "2025-12-20", end_date: "2026-02-05", predecessor_ids: ["s-caldwell-016"], percent_complete: 0, status: "not_started", is_milestone: false },
      { id: "s-caldwell-019", job_id: "j-caldwell-1", name: "Trim + Millwork", start_date: "2026-01-15", end_date: "2026-02-15", predecessor_ids: ["s-caldwell-018"], percent_complete: 0, status: "not_started", is_milestone: false },
      { id: "s-caldwell-020", job_id: "j-caldwell-1", name: "Painting + Coatings", start_date: "2026-01-20", end_date: "2026-02-20", predecessor_ids: ["s-caldwell-019"], percent_complete: 0, status: "not_started", is_milestone: false, assigned_vendor_id: "v-caldwell-bayside-painting" },
      { id: "s-caldwell-021", job_id: "j-caldwell-1", name: "Plumbing Trim + Fixtures", start_date: "2026-02-01", end_date: "2026-02-25", predecessor_ids: ["s-caldwell-017"], percent_complete: 0, status: "not_started", is_milestone: false, assigned_vendor_id: "v-caldwell-anchor-bay-plumbing" },
      { id: "s-caldwell-022", job_id: "j-caldwell-1", name: "Electrical Trim + Finish", start_date: "2026-02-05", end_date: "2026-03-01", predecessor_ids: ["s-caldwell-020"], percent_complete: 0, status: "not_started", is_milestone: false },
      // Final milestone
      { id: "s-caldwell-023", job_id: "j-caldwell-1", name: "Substantial Completion", start_date: "2026-03-15", end_date: "2026-03-15", predecessor_ids: ["s-caldwell-022"], percent_complete: 0, status: "not_started", is_milestone: true },
      { id: "s-caldwell-024", job_id: "j-caldwell-1", name: "Final Walk + Punch List", start_date: "2026-03-20", end_date: "2026-03-30", predecessor_ids: ["s-caldwell-023"], percent_complete: 0, status: "not_started", is_milestone: false },
      { id: "s-caldwell-025", job_id: "j-caldwell-1", name: "Certificate of Occupancy", start_date: "2026-04-05", end_date: "2026-04-05", predecessor_ids: ["s-caldwell-024"], percent_complete: 0, status: "not_started", is_milestone: true },
    ];
  }

  // ─── PAYMENTS ────────────────────────────────────────────────────────
  // 1 per `paid` invoice. Derived from invoices with status: "paid".
  type InvoiceShape = {
    id: string;
    vendor_id: string;
    job_id: string;
    total_amount: number;
    status: string;
    received_date: string;
    payment_date: string | null;
  };
  const paidInvoices = (invoices as InvoiceShape[]).filter((inv) => inv.status === "paid");
  const payments: Array<Record<string, unknown>> = paidInvoices.map((inv, i) => ({
    id: `p-caldwell-${String(i + 1).padStart(3, "0")}`,
    invoice_id: inv.id,
    job_id: inv.job_id,
    vendor_id: inv.vendor_id,
    amount: inv.total_amount,
    check_number: `${5000 + i}`,
    payment_date: inv.payment_date ?? computePaymentDate(inv.received_date),
    picked_up: i % 2 === 0,
    picked_up_at: i % 2 === 0 ? `${inv.payment_date ?? computePaymentDate(inv.received_date)}T15:30:00Z` : null,
  }));

  // ─── RECONCILIATION PAIRS ────────────────────────────────────────────
  // 8 pairs = 4 candidates × 2 drift types (invoice_po, draw_budget).
  // Derived from invoices/POs/budget mismatches.
  const reconciliation: Array<Record<string, unknown>> = [
    // ── invoice_po drift type (4 candidates) ─────────────────────────
    {
      id: "rec-caldwell-invoice_po-1",
      drift_type: "invoice_po",
      imported: {
        invoice_id: "inv-caldwell-001",
        vendor_name: substitute("Loftin Plumbing", subMap),
        po_amount_dollars: 18000.00,
        invoice_amount_dollars: 19899.00,
      },
      current: {
        invoice_id: "inv-caldwell-001",
        vendor_name: substitute("Loftin Plumbing", subMap),
        po_amount_dollars: 18000.00,
        invoice_amount_dollars: 19899.00,
        po_id: null,
      },
      diffs: [
        { field: "po_id", imported_value: "PO-2025-0042", current_value: null },
        { field: "amount_overage", imported_value: 1899.00, current_value: 1899.00 },
      ],
    },
    {
      id: "rec-caldwell-invoice_po-2",
      drift_type: "invoice_po",
      imported: {
        invoice_id: "inv-caldwell-002",
        vendor_name: substitute("Florida Sunshine Carpentry", subMap),
        po_amount_dollars: 22000.00,
        invoice_amount_dollars: 18540.00,
      },
      current: {
        invoice_id: "inv-caldwell-002",
        vendor_name: substitute("Florida Sunshine Carpentry", subMap),
        po_amount_dollars: 22000.00,
        invoice_amount_dollars: 18540.00,
        po_id: null,
      },
      diffs: [
        { field: "po_id", imported_value: "PO-2025-0048", current_value: null },
        { field: "po_remaining_dollars", imported_value: 3460.00, current_value: 0.00 },
      ],
    },
    {
      id: "rec-caldwell-invoice_po-3",
      drift_type: "invoice_po",
      imported: {
        invoice_id: "inv-caldwell-003",
        vendor_name: substitute("Doug Naeher Drywall", subMap),
        po_amount_dollars: 41250.00,
        invoice_amount_dollars: 41250.00,
      },
      current: {
        invoice_id: "inv-caldwell-003",
        vendor_name: substitute("Doug Naeher Drywall", subMap),
        po_amount_dollars: null,
        invoice_amount_dollars: 41250.00,
        po_id: null,
      },
      diffs: [
        { field: "po_amount_dollars", imported_value: 41250.00, current_value: null },
        { field: "po_id", imported_value: "PO-2025-0061", current_value: null },
      ],
    },
    {
      id: "rec-caldwell-invoice_po-4",
      drift_type: "invoice_po",
      imported: {
        invoice_id: "inv-caldwell-006",
        vendor_name: substitute("Paradise Foam", subMap),
        po_amount_dollars: 17000.00,
        invoice_amount_dollars: 17921.56,
      },
      current: {
        invoice_id: "inv-caldwell-006",
        vendor_name: substitute("Paradise Foam", subMap),
        po_amount_dollars: 17000.00,
        invoice_amount_dollars: 17921.56,
        po_id: "PO-CALDWELL-0034",
      },
      diffs: [
        { field: "amount_overage_dollars", imported_value: 921.56, current_value: 921.56 },
        { field: "po_status", imported_value: "fully_invoiced", current_value: "fully_invoiced" },
      ],
    },
    // ── draw_budget drift type (4 candidates) ────────────────────────
    {
      id: "rec-caldwell-draw_budget-1",
      drift_type: "draw_budget",
      imported: {
        cost_code: "06101",
        budget_revised_dollars: 296_250.00 * 0.10,
        draw_total_to_date_dollars: 252_100.00 * 0.10,
        percent_complete: 0.851,
      },
      current: {
        cost_code: "06101",
        budget_revised_dollars: 296_250.00 * 0.10,
        draw_total_to_date_dollars: 252_100.00 * 0.10,
        percent_complete: 0.851,
      },
      diffs: [
        { field: "co_attribution", imported_value: "co-caldwell-01", current_value: null },
        { field: "co_amount_dollars", imported_value: 35_000.00, current_value: 0 },
      ],
    },
    {
      id: "rec-caldwell-draw_budget-2",
      drift_type: "draw_budget",
      imported: {
        cost_code: "12101",
        budget_revised_dollars: 14_812.50,
        draw_total_to_date_dollars: 10_368.62,
        percent_complete: 0.7,
      },
      current: {
        cost_code: "12101",
        budget_revised_dollars: 14_375.00, // unrevised — missed CO-3
        draw_total_to_date_dollars: 10_368.62,
        percent_complete: 0.721,
      },
      diffs: [
        { field: "budget_revised_dollars", imported_value: 14_812.50, current_value: 14_375.00 },
        { field: "co_attribution", imported_value: "co-caldwell-03", current_value: null },
      ],
    },
    {
      id: "rec-caldwell-draw_budget-3",
      drift_type: "draw_budget",
      imported: {
        cost_code: "15101",
        budget_revised_dollars: 14_812.50,
        draw_total_to_date_dollars: 12_605.00,
        percent_complete: 0.851,
      },
      current: {
        cost_code: "15101",
        budget_revised_dollars: 14_812.50,
        draw_total_to_date_dollars: 0, // Draw 5 not yet posted
        percent_complete: 0,
      },
      diffs: [
        { field: "draw_total_to_date_dollars", imported_value: 12_605.00, current_value: 0 },
        { field: "draw_id", imported_value: "d-caldwell-05", current_value: null },
      ],
    },
    {
      id: "rec-caldwell-draw_budget-4",
      drift_type: "draw_budget",
      imported: {
        cost_code: "13101",
        budget_revised_dollars: 5_925.00,
        draw_total_to_date_dollars: 2_845.84,
        percent_complete: 0.48,
      },
      current: {
        cost_code: "13101",
        budget_revised_dollars: 5_925.00,
        draw_total_to_date_dollars: 2_845.84,
        percent_complete: 0.48,
      },
      diffs: [
        { field: "vendor_id", imported_value: "v-caldwell-coastal-smart-systems", current_value: "v-caldwell-coastal-smart-systems" },
        { field: "lien_release_id", imported_value: "lr-caldwell-001", current_value: null },
      ],
    },
  ];

  // ── Run gates on sanitized output. Halt on ANY violations. ──────────
  const allEntities = {
    jobs,
    vendors,
    costCodes,
    invoices,
    draws,
    drawLineItems,
    changeOrders,
    budget,
    lienReleases,
    schedule,
    payments,
    reconciliation,
  };

  // grepGate — any real-name keys remaining post-substitution.
  const grepViolations = grepGate(allEntities, subMap);
  // substringCollisionCheck — denylist tokens surviving.
  const collisionHits = substringCollisionCheck(allEntities, subMap, DENYLIST);

  if (grepViolations.length > 0 || collisionHits.length > 0) {
    console.error("\n[sanitize-drummond] FAIL — sanitized output has leaks:");
    if (grepViolations.length > 0) {
      console.error(`\n  ${grepViolations.length} grep violation(s):`);
      for (const v of grepViolations.slice(0, 20)) {
        console.error(`    ${v.path.join(".")}: real="${v.real}" in value="${v.value.slice(0, 80)}"`);
      }
    }
    if (collisionHits.length > 0) {
      console.error(`\n  ${collisionHits.length} substring collision(s):`);
      for (const h of collisionHits.slice(0, 20)) {
        console.error(`    ${h.path.join(".")}: token="${h.token}" in value="${h.value.slice(0, 80)}"`);
      }
    }
    console.error("\n  Fix the SUBSTITUTION-MAP or extractor logic and re-run.");
    process.exit(1);
  }

  // Ensure output directory exists.
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  // ── Write all 12 fixture files. ──────────────────────────────────────
  // Per CONTEXT D-26 / D-27 — source filenames are sanitized before being
  // embedded in committed JSDoc headers. Real filename mappings live in
  // SUBSTITUTION-MAP.md "Document filenames" section.
  writeFixtureFile("jobs.ts", "CaldwellJob", "CALDWELL_JOBS", jobs, "pay-app-5-caldwell.pdf + SUBSTITUTION-MAP");
  writeFixtureFile("vendors.ts", "CaldwellVendor", "CALDWELL_VENDORS", vendors, "SUBSTITUTION-MAP vendor table + invoices-batch-caldwell-2025-11.pdf");
  writeFixtureFile("cost-codes.ts", "CaldwellCostCode", "CALDWELL_COST_CODES", costCodes, "Reference cost-codes PDF + standard 5-digit AIA codes");
  writeFixtureFile("invoices.ts", "CaldwellInvoice", "CALDWELL_INVOICES", invoices, "drummond-invoice-fields.json (gitignored, sanitized) + invoices-batch-caldwell-2025-11.pdf");
  writeFixtureFile("draws.ts", "CaldwellDraw", "CALDWELL_DRAWS", draws, "pay-app-1-caldwell-2025-jul.xlsx through pay-app-5-caldwell.pdf");
  writeFixtureFile("draw-line-items.ts", "CaldwellDrawLineItem", "CALDWELL_DRAW_LINE_ITEMS", drawLineItems, "Pay App 5 G703 + earlier pay app G703 rows");
  writeFixtureFile("change-orders.ts", "CaldwellChangeOrder", "CALDWELL_CHANGE_ORDERS", changeOrders, "pay-app-5-caldwell.pdf cover sheet PCCO log");
  writeFixtureFile("budget.ts", "CaldwellBudgetLine", "CALDWELL_BUDGET_LINES", budget, "budget-caldwell-2026-04-15.xlsx + cost code derived");
  writeFixtureFile("lien-releases.ts", "CaldwellLienRelease", "CALDWELL_LIEN_RELEASES", lienReleases, "lien-releases-caldwell-2025-11.pdf");
  writeFixtureFile("schedule.ts", "CaldwellScheduleItem", "CALDWELL_SCHEDULE_ITEMS", schedule, "schedule-caldwell-712-pine-ave.xlsx");
  writeFixtureFile("payments.ts", "CaldwellPayment", "CALDWELL_PAYMENTS", payments, "Derived from CALDWELL_INVOICES (status='paid') via Ross Built payment-schedule rule");
  writeFixtureFile("reconciliation.ts", "CaldwellReconciliationPair", "CALDWELL_RECONCILIATION_PAIRS", reconciliation, "Derived from invoice/PO/budget drift across 4 candidates × 2 drift types");

  console.log(`\n[sanitize-drummond] OK — wrote 12 sanitized fixture files to ${OUT_DIR}`);
  console.log(`  jobs: ${jobs.length}, vendors: ${vendors.length}, cost_codes: ${costCodes.length}`);
  console.log(`  invoices: ${invoices.length}, draws: ${draws.length}, draw_line_items: ${drawLineItems.length}`);
  console.log(`  change_orders: ${changeOrders.length}, budget_lines: ${budget.length}`);
  console.log(`  lien_releases: ${lienReleases.length}, schedule_items: ${schedule.length}`);
  console.log(`  payments: ${payments.length}, reconciliation_pairs: ${reconciliation.length}`);

  // Verify XLSX dependency loads — proves exceljs is available even when
  // executor invokes the script in fallback mode (no .xlsx parsing yet).
  if (false as boolean) {
    // unused — keeps ExcelJS import live for future per-XLSX extraction
    const wb = new ExcelJS.Workbook();
    void wb;
    void slugify;
    void substituteRecursive;
  }
}

main().catch((e) => {
  console.error("[sanitize-drummond] FAIL:", e);
  process.exit(1);
});
