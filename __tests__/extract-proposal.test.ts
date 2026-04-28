/**
 * Phase 3.4 Step 2 — proposal extraction library tests.
 *
 * Covers:
 *   - Structural: file exists, exports the right surface, uses
 *     callClaude with function_type='proposal_extract', ephemeral
 *     cache_control on the system prompt
 *   - dollarsToCents handles null / NaN / negative / float-rounding
 *   - normalizeProposal happy path: dollars → cents on every numeric
 *     field, line_items[].attributes preserved, raw_response retained
 *   - normalizeProposal minimal: lump-sum line with no breakdown leaves
 *     ALL six *_cents breakdown fields null (never inferred)
 *   - normalizeProposal validation: throws on missing vendor_name,
 *     missing title, missing total_amount, per-line missing description
 *     or amount
 *   - normalizeProposal cleanup: clamps confidence_score to [0, 1],
 *     drops non-string flags, drops non-numeric confidence_details
 *     entries, defaults line_number to idx+1 when missing
 *   - Live: gated behind RUN_PROPOSAL_EXTRACT_LIVE=1 + ANTHROPIC_API_KEY,
 *     runs extractProposal() on the first proposal fixture and asserts
 *     the returned shape (no accuracy gate — that's Step 6B's job)
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { strict as assert } from "node:assert";
import * as dotenv from "dotenv";

const FILE = "src/lib/ingestion/extract-proposal.ts";

type Case = { name: string; fn: () => Promise<void> | void };
const cases: Case[] = [];
const test = (name: string, fn: () => Promise<void> | void) =>
  cases.push({ name, fn });

// ── Structural ──────────────────────────────────────────────────
test("extract-proposal.ts exists at src/lib/ingestion/extract-proposal.ts", () => {
  assert.ok(existsSync(FILE), `missing ${FILE}`);
});

const source = existsSync(FILE) ? readFileSync(FILE, "utf8") : "";

test("exports extractProposal, normalizeProposal, dollarsToCents, PROPOSAL_EXTRACT_SYSTEM_PROMPT, types", () => {
  assert.match(source, /export\s+async\s+function\s+extractProposal/);
  assert.match(source, /export\s+function\s+normalizeProposal/);
  assert.match(source, /export\s+function\s+dollarsToCents/);
  assert.match(source, /export\s+const\s+PROPOSAL_EXTRACT_SYSTEM_PROMPT/);
  assert.match(source, /export\s+type\s+ParsedProposal\b/);
  assert.match(source, /export\s+type\s+ParsedProposalLineItem\b/);
});

test("uses callClaude with function_type='proposal_extract'", () => {
  assert.match(source, /from\s+['"]@\/lib\/claude['"]/);
  assert.match(source, /function_type:\s*['"]proposal_extract['"]/);
});

test("system prompt uses ephemeral cache_control (cache reuse across eval)", () => {
  assert.match(source, /cache_control:\s*\{\s*type:\s*['"]ephemeral['"]/);
});

test("system prompt covers vendor-attribution, breakdown-explicit-only, schedule-explicit-only", () => {
  // Exact phrases that must remain in the prompt — these are the
  // load-bearing extraction rules.
  assert.match(source, /VENDOR ATTRIBUTION/);
  assert.match(source, /SENDER/);
  assert.match(source, /COST BREAKDOWN.*EXPLICIT ONLY/i);
  assert.match(source, /NEVER INFER/);
  assert.match(source, /VENDOR SCHEDULE/);
});

test("system prompt covers fee schedule + payment schedule + payment terms (Step 5b/5c)", () => {
  // The 3 new structured sections must remain in the prompt.
  assert.match(source, /ADDITIONAL FEE SCHEDULE/);
  assert.match(source, /PAYMENT SCHEDULE/);
  assert.match(source, /PAYMENT TERMS/);
  // Each must reinforce the never-infer rule consistent with vendor schedule.
  assert.match(source, /additional_fee_schedule[\s\S]{0,600}?never infer/i);
  assert.match(source, /payment_schedule[\s\S]{0,600}?NEVER infer/i);
});

test("system prompt covers schedule_items + acceptance signature (Step 5f/5g)", () => {
  assert.match(source, /SCHEDULE ITEMS/);
  assert.match(source, /ACCEPTANCE SIGNATURE/);
  // Per prompt 186: explicit guidance for the 3 acceptance fields.
  assert.match(source, /accepted_signature_present/);
  assert.match(source, /accepted_signature_name/);
  assert.match(source, /accepted_signature_date/);
});

test("system prompt — Step 5g bug fixes for net_days, valid_through, inclusions", () => {
  // Bug 1 (net_days conflated with collection-cost timeline) — prompt
  // must distinguish past-due window from collection threshold.
  assert.match(source, /past due/i);
  assert.match(source, /interest accrues|interest will be charged/i);
  // Bug 2 (valid_through inferred from "valid for 30 days" + proposal_date) —
  // prompt must explicitly disallow that compute. After prompt 187, the
  // wording is stricter: only literal month/day/year expiration dates.
  assert.match(source, /HARD RULE/);
  assert.match(source, /Do not compute date arithmetic/);
  // The previous DO-populate example "Quote good for 30 days from 2026-02-15"
  // was the source of the generalization bug — it must be REMOVED, replaced
  // by listing "quote good for 30 days" as a return-null phrasing.
  assert.ok(
    !/Quote good for 30 days from 2026-02-15/.test(source),
    "the DO-populate example was the source of the bug — it must be removed per prompt 187"
  );
  assert.match(source, /quote good for 30 days/);
  // Bug 3 (inclusions/exclusions only triggered by literal section title) —
  // prompt must broaden the trigger.
  assert.match(source, /even if the section is not literally titled/i);
});

test("system prompt instructs title generation (proposals.title is NOT NULL)", () => {
  assert.match(source, /TITLE GENERATION/);
  assert.match(source, /never return an empty string/);
});

test("does NOT touch hot-path matcher imports", () => {
  // Addendum-B boundary: this module is a new surface and must not
  // import anything from the matcher path.
  assert.ok(
    !/from\s+['"]@\/lib\/cost-intelligence\/match-item['"]/.test(source),
    "extract-proposal.ts must not import match-item.ts"
  );
  assert.ok(
    !/from\s+['"]@\/lib\/cost-intelligence\/commit-line-to-spine['"]/.test(source),
    "extract-proposal.ts must not import commit-line-to-spine.ts"
  );
});

// ── dollarsToCents ──────────────────────────────────────────────
test("dollarsToCents converts integer dollars to cents", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  assert.equal(mod.dollarsToCents(100), 10000);
  assert.equal(mod.dollarsToCents(0), 0);
  assert.equal(mod.dollarsToCents(1234.56), 123456);
});

test("dollarsToCents avoids floating-point drift on tricky values", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  // 42.10 * 100 = 4209.999999... in JS; dollarsToCents must round to 4210.
  assert.equal(mod.dollarsToCents(42.1), 4210);
  // 0.1 + 0.2 = 0.30000000000000004 — but we receive a single number from JSON,
  // so the input is already 0.3 → 30 cents.
  assert.equal(mod.dollarsToCents(0.3), 30);
  assert.equal(mod.dollarsToCents(19.99), 1999);
});

test("dollarsToCents handles negative values (credit memos)", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  assert.equal(mod.dollarsToCents(-50.25), -5025);
});

test("dollarsToCents returns null for null/undefined/NaN/Infinity", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  assert.equal(mod.dollarsToCents(null), null);
  assert.equal(mod.dollarsToCents(undefined), null);
  assert.equal(mod.dollarsToCents(NaN), null);
  assert.equal(mod.dollarsToCents(Infinity), null);
  assert.equal(mod.dollarsToCents(-Infinity), null);
});

test("dollarsToCents coerces numeric strings via Number()", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  assert.equal(mod.dollarsToCents("42.10"), 4210);
  assert.equal(mod.dollarsToCents("not a number"), null);
});

// ── normalizeProposal — happy path ───────────────────────────────
function fullProposalRaw() {
  return {
    vendor_name: "Faust Stucco LLC",
    vendor_address: "123 Vendor St, Bradenton FL",
    proposal_number: "Q-2026-118",
    proposal_date: "2026-01-15",
    valid_through: "2026-02-14",
    title: "Stucco proposal — Faust — 2026-01-15",
    total_amount: 48000,
    scope_summary: "Three-coat exterior stucco application on 4,000 SF residence.",
    inclusions: "- All material\n- Labor\n- Cleanup",
    exclusions: "- Color tinting\n- Scaffolding",
    notes: "Net 30 from completion.",
    vendor_stated_start_date: "2026-04-15",
    vendor_stated_duration_days: 14,
    line_items: [
      {
        line_number: 1,
        description: "Stucco - exterior 4,000 SF",
        description_normalized: "Stucco labor exterior 3-coat 4000sf",
        quantity: 4000,
        unit_of_measure: "SF",
        unit_price: 12,
        amount: 48000,
        cost_code_suggestion: "Stucco - exterior",
        material_cost: 18000,
        labor_cost: 30000,
        subcontract_cost: null,
        tax: null,
        delivery: null,
        notes_amount: null,
        attributes: { coats: 3, finish: "smooth" },
      },
    ],
    confidence_score: 0.93,
    confidence_details: {
      vendor_name: 0.99,
      total_amount: 0.99,
      line_items: 0.92,
      cost_code_suggestions: 0.85,
    },
    flags: [],
  };
}

test("normalizeProposal converts all dollar fields to cents", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  const out = mod.normalizeProposal(fullProposalRaw());
  assert.equal(out.total_cents, 4_800_000);
  assert.equal(out.line_items[0].total_price_cents, 4_800_000);
  assert.equal(out.line_items[0].unit_price_cents, 1200);
  assert.equal(out.line_items[0].material_cost_cents, 1_800_000);
  assert.equal(out.line_items[0].labor_cost_cents, 3_000_000);
});

test("normalizeProposal preserves header strings, dates, vendor schedule", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  const out = mod.normalizeProposal(fullProposalRaw());
  assert.equal(out.vendor_name, "Faust Stucco LLC");
  assert.equal(out.vendor_address, "123 Vendor St, Bradenton FL");
  assert.equal(out.proposal_number, "Q-2026-118");
  assert.equal(out.proposal_date, "2026-01-15");
  assert.equal(out.valid_through, "2026-02-14");
  assert.equal(out.title, "Stucco proposal — Faust — 2026-01-15");
  assert.equal(out.vendor_stated_start_date, "2026-04-15");
  assert.equal(out.vendor_stated_duration_days, 14);
});

test("normalizeProposal preserves attributes JSONB and confidence_details", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  const out = mod.normalizeProposal(fullProposalRaw());
  assert.deepEqual(out.line_items[0].attributes, { coats: 3, finish: "smooth" });
  assert.equal(out.confidence_score, 0.93);
  assert.equal(out.confidence_details.vendor_name, 0.99);
  assert.equal(out.confidence_details.cost_code_suggestions, 0.85);
});

test("normalizeProposal retains raw_response for raw_extraction JSONB writeback", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  const raw = fullProposalRaw();
  const out = mod.normalizeProposal(raw);
  assert.equal(out.raw_response, raw, "raw_response should reference the original payload");
});

// ── normalizeProposal — lump-sum / null breakdown ────────────────
test("normalizeProposal keeps all six breakdown *_cents null when proposal is lump-sum", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  const lump = {
    vendor_name: "Doug Naeher Drywall",
    title: "Drywall — Naeher",
    total_amount: 12500,
    scope_summary: "Hang and finish drywall throughout residence.",
    line_items: [
      {
        line_number: 1,
        description: "Hang & finish drywall — full house",
        amount: 12500,
        // unit_price intentionally null → lump sum
        unit_price: null,
        // Breakdown intentionally absent (vendor didn't itemize)
        material_cost: null,
        labor_cost: null,
        subcontract_cost: null,
        tax: null,
        delivery: null,
        notes_amount: null,
      },
    ],
  };
  const out = mod.normalizeProposal(lump);
  assert.equal(out.line_items[0].material_cost_cents, null);
  assert.equal(out.line_items[0].labor_cost_cents, null);
  assert.equal(out.line_items[0].subcontract_cost_cents, null);
  assert.equal(out.line_items[0].tax_cents, null);
  assert.equal(out.line_items[0].delivery_cents, null);
  assert.equal(out.line_items[0].notes_cents, null);
  assert.equal(out.line_items[0].unit_price_cents, null);
  assert.equal(out.line_items[0].total_price_cents, 1_250_000);
  // Defaults
  assert.deepEqual(out.line_items[0].attributes, {});
  assert.equal(out.line_items[0].cost_code_suggestion, null);
  assert.equal(out.line_items[0].quantity, null);
  assert.equal(out.line_items[0].unit_of_measure, null);
  // Headers absent → null
  assert.equal(out.proposal_number, null);
  assert.equal(out.proposal_date, null);
  assert.equal(out.valid_through, null);
  assert.equal(out.vendor_stated_start_date, null);
  assert.equal(out.vendor_stated_duration_days, null);
  // Step 5b/5c structures absent → null at top level
  assert.equal(out.additional_fee_schedule, null);
  assert.equal(out.payment_schedule, null);
  assert.equal(out.payment_terms, null);
  // Step 5f/5g additions absent → null / false defaults
  assert.equal(out.schedule_items, null);
  assert.equal(out.accepted_signature_present, false);
  assert.equal(out.accepted_signature_name, null);
  assert.equal(out.accepted_signature_date, null);
});

// ── normalizeProposal — schedule_items (Step 5f/5g) ─────────────
test("normalizeProposal: schedule_items preserves all sub-fields, filters depends_on/deliverables", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  const out = mod.normalizeProposal({
    vendor_name: "X", title: "T", scope_summary: "s", total_amount: 100,
    line_items: [{ description: "a", amount: 100 }],
    schedule_items: [
      {
        scope_item: "Phase I",
        linked_line_number: 1,
        estimated_start_date: "2026-04-15",
        estimated_duration_days: 14,
        sequence_position: 1,
        depends_on: [], // first phase
        responsibility: "vendor",
        deliverables: ["schematic plan", "concept presentation"],
        trigger: "upon receipt of design fee",
      },
      {
        scope_item: "Phase II",
        linked_line_number: 2,
        estimated_start_date: null,
        estimated_duration_days: null,
        sequence_position: 2,
        depends_on: [1, "bad", 3.5], // 3.5 → 4 via Math.round; "bad" filtered
        responsibility: "vendor",
        deliverables: ["material studies", 42, null, "graphic support"],
        trigger: null,
      },
    ],
  });
  assert.equal(out.schedule_items?.length, 2);
  assert.equal(out.schedule_items?.[0].scope_item, "Phase I");
  assert.deepEqual(out.schedule_items?.[0].deliverables, [
    "schematic plan",
    "concept presentation",
  ]);
  assert.equal(out.schedule_items?.[0].depends_on.length, 0);
  // Phase II: "bad" string dropped, 3.5 → 4
  assert.deepEqual(out.schedule_items?.[1].depends_on, [1, 4]);
  // 42 (number) and null filtered out of deliverables; only strings kept
  assert.deepEqual(out.schedule_items?.[1].deliverables, [
    "material studies",
    "graphic support",
  ]);
});

test("normalizeProposal: schedule_items null/empty → null", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  assert.equal(
    mod.normalizeProposal({
      vendor_name: "X", title: "T", scope_summary: "s", total_amount: 100,
      line_items: [{ description: "a", amount: 100 }],
      schedule_items: null,
    }).schedule_items,
    null
  );
  assert.equal(
    mod.normalizeProposal({
      vendor_name: "X", title: "T", scope_summary: "s", total_amount: 100,
      line_items: [{ description: "a", amount: 100 }],
      schedule_items: [],
    }).schedule_items,
    null
  );
});

test("normalizeProposal: schedule_items drops entries with non-string scope_item", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  const out = mod.normalizeProposal({
    vendor_name: "X", title: "T", scope_summary: "s", total_amount: 100,
    line_items: [{ description: "a", amount: 100 }],
    schedule_items: [
      { scope_item: "valid", sequence_position: 1, depends_on: [], deliverables: [] },
      { scope_item: "", sequence_position: 2, depends_on: [], deliverables: [] },
      { scope_item: 42, sequence_position: 3, depends_on: [], deliverables: [] },
    ],
  });
  assert.equal(out.schedule_items?.length, 1);
  assert.equal(out.schedule_items?.[0].scope_item, "valid");
});

// ── normalizeProposal — acceptance signature (Step 5f/5g) ───────
test("normalizeProposal: accepted_signature_* preserved when present=true with name+date", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  const out = mod.normalizeProposal({
    vendor_name: "X", title: "T", scope_summary: "s", total_amount: 100,
    line_items: [{ description: "a", amount: 100 }],
    accepted_signature_present: true,
    accepted_signature_name: "Jason Szykulski",
    accepted_signature_date: "2025-06-27",
  });
  assert.equal(out.accepted_signature_present, true);
  assert.equal(out.accepted_signature_name, "Jason Szykulski");
  assert.equal(out.accepted_signature_date, "2025-06-27");
});

test("normalizeProposal: accepted_signature_present coerces non-boolean → false", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  // "true" (string), null, undefined all coerce to false.
  const a = mod.normalizeProposal({
    vendor_name: "X", title: "T", scope_summary: "s", total_amount: 100,
    line_items: [{ description: "a", amount: 100 }],
    accepted_signature_present: "true" as unknown as boolean,
  });
  assert.equal(a.accepted_signature_present, false);
  const b = mod.normalizeProposal({
    vendor_name: "X", title: "T", scope_summary: "s", total_amount: 100,
    line_items: [{ description: "a", amount: 100 }],
  });
  assert.equal(b.accepted_signature_present, false);
});

// ── normalizeProposal — fee schedule (Step 5b/5c) ───────────────
test("normalizeProposal: additional_fee_schedule converts dollar rates to cents", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  const out = mod.normalizeProposal({
    vendor_name: "X",
    title: "T",
    scope_summary: "s",
    total_amount: 100,
    line_items: [{ description: "a", amount: 100 }],
    additional_fee_schedule: [
      { rate_type: "principal_hour", description: "Principal architect", rate: 200, unit: "hr" },
      { rate_type: "drafter_hour", description: "Drafter", rate: 90, unit: "hr" },
      { rate_type: "site_visit_fee", description: "Site visit", rate: 750, unit: "visit" },
    ],
  });
  assert.equal(out.additional_fee_schedule?.length, 3);
  assert.equal(out.additional_fee_schedule?.[0].rate_cents, 20000);
  assert.equal(out.additional_fee_schedule?.[1].rate_cents, 9000);
  assert.equal(out.additional_fee_schedule?.[2].rate_cents, 75000);
  assert.equal(out.additional_fee_schedule?.[0].unit, "hr");
});

test("normalizeProposal: additional_fee_schedule null/empty → null (don't expose [])", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  const a = mod.normalizeProposal({
    vendor_name: "X", title: "T", scope_summary: "s", total_amount: 100,
    line_items: [{ description: "a", amount: 100 }],
    additional_fee_schedule: null,
  });
  assert.equal(a.additional_fee_schedule, null);
  const b = mod.normalizeProposal({
    vendor_name: "X", title: "T", scope_summary: "s", total_amount: 100,
    line_items: [{ description: "a", amount: 100 }],
    additional_fee_schedule: [],
  });
  assert.equal(b.additional_fee_schedule, null);
});

test("normalizeProposal: additional_fee_schedule drops entries with non-string rate_type", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  const out = mod.normalizeProposal({
    vendor_name: "X", title: "T", scope_summary: "s", total_amount: 100,
    line_items: [{ description: "a", amount: 100 }],
    additional_fee_schedule: [
      { rate_type: "valid", description: "ok", rate: 100, unit: "hr" },
      { rate_type: 42, description: "bad", rate: 50, unit: "hr" },
      { rate_type: "", description: "empty", rate: 50, unit: "hr" },
    ],
  });
  assert.equal(out.additional_fee_schedule?.length, 1);
  assert.equal(out.additional_fee_schedule?.[0].rate_type, "valid");
});

// ── normalizeProposal — payment schedule (Step 5b/5c) ───────────
test("normalizeProposal: payment_schedule converts amounts to cents, preserves percentage", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  const out = mod.normalizeProposal({
    vendor_name: "X", title: "T", scope_summary: "s", total_amount: 1000,
    line_items: [{ description: "a", amount: 1000 }],
    payment_schedule: [
      { milestone: "deposit", percentage_pct: 50, amount: 500, trigger: "upon contract signing" },
      { milestone: "delivery", percentage_pct: 25, amount: null, trigger: "upon delivery" },
      { milestone: "completion", percentage_pct: 25, amount: 250, trigger: "upon completion" },
    ],
  });
  assert.equal(out.payment_schedule?.length, 3);
  assert.equal(out.payment_schedule?.[0].amount_cents, 50000);
  assert.equal(out.payment_schedule?.[0].percentage_pct, 50);
  assert.equal(out.payment_schedule?.[1].amount_cents, null);
  assert.equal(out.payment_schedule?.[1].percentage_pct, 25);
  assert.equal(out.payment_schedule?.[2].amount_cents, 25000);
  assert.equal(out.payment_schedule?.[0].trigger, "upon contract signing");
});

test("normalizeProposal: payment_schedule null/empty → null", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  assert.equal(
    mod.normalizeProposal({
      vendor_name: "X", title: "T", scope_summary: "s", total_amount: 100,
      line_items: [{ description: "a", amount: 100 }],
      payment_schedule: null,
    }).payment_schedule,
    null
  );
  assert.equal(
    mod.normalizeProposal({
      vendor_name: "X", title: "T", scope_summary: "s", total_amount: 100,
      line_items: [{ description: "a", amount: 100 }],
      payment_schedule: [],
    }).payment_schedule,
    null
  );
});

// ── normalizeProposal — payment terms (Step 5b/5c) ──────────────
test("normalizeProposal: payment_terms preserves all four sub-fields", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  const out = mod.normalizeProposal({
    vendor_name: "X", title: "T", scope_summary: "s", total_amount: 100,
    line_items: [{ description: "a", amount: 100 }],
    payment_terms: {
      net_days: 30,
      late_interest_rate_pct: 1.5,
      governing_law: "Florida law",
      other_terms_text: "Retainage 10% held until final lien release.",
    },
  });
  assert.equal(out.payment_terms?.net_days, 30);
  assert.equal(out.payment_terms?.late_interest_rate_pct, 1.5);
  assert.equal(out.payment_terms?.governing_law, "Florida law");
  assert.equal(
    out.payment_terms?.other_terms_text,
    "Retainage 10% held until final lien release."
  );
});

test("normalizeProposal: payment_terms with all-null sub-fields → null at top level", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  const out = mod.normalizeProposal({
    vendor_name: "X", title: "T", scope_summary: "s", total_amount: 100,
    line_items: [{ description: "a", amount: 100 }],
    payment_terms: {
      net_days: null,
      late_interest_rate_pct: null,
      governing_law: null,
      other_terms_text: null,
    },
  });
  assert.equal(out.payment_terms, null);
});

test("normalizeProposal: payment_terms with partial fields keeps the populated ones", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  const out = mod.normalizeProposal({
    vendor_name: "X", title: "T", scope_summary: "s", total_amount: 100,
    line_items: [{ description: "a", amount: 100 }],
    payment_terms: { net_days: 30 },
  });
  assert.equal(out.payment_terms?.net_days, 30);
  assert.equal(out.payment_terms?.late_interest_rate_pct, null);
  assert.equal(out.payment_terms?.governing_law, null);
  assert.equal(out.payment_terms?.other_terms_text, null);
});

// ── normalizeProposal — defaulting + cleanup ────────────────────
test("normalizeProposal defaults line_number to idx+1 when AI omits it", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  const raw = {
    vendor_name: "X",
    title: "T",
    scope_summary: "s",
    total_amount: 100,
    line_items: [
      { description: "a", amount: 50 },
      { description: "b", amount: 50 },
    ],
  };
  const out = mod.normalizeProposal(raw);
  assert.equal(out.line_items[0].line_number, 1);
  assert.equal(out.line_items[1].line_number, 2);
});

test("normalizeProposal clamps confidence_score to [0, 1]", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  const high = mod.normalizeProposal({
    vendor_name: "X",
    title: "T",
    scope_summary: "s",
    total_amount: 100,
    line_items: [{ description: "a", amount: 100 }],
    confidence_score: 1.5,
  });
  assert.equal(high.confidence_score, 1);
  const low = mod.normalizeProposal({
    vendor_name: "X",
    title: "T",
    scope_summary: "s",
    total_amount: 100,
    line_items: [{ description: "a", amount: 100 }],
    confidence_score: -0.2,
  });
  assert.equal(low.confidence_score, 0);
});

test("normalizeProposal drops non-string flags and non-numeric confidence_details entries", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  const out = mod.normalizeProposal({
    vendor_name: "X",
    title: "T",
    scope_summary: "s",
    total_amount: 100,
    line_items: [{ description: "a", amount: 100 }],
    flags: ["lump_sum", 42, null, "math_mismatch"],
    confidence_details: {
      vendor_name: 0.9,
      total_amount: "not_a_number",
      line_items: 0.85,
    },
  });
  assert.deepEqual(out.flags, ["lump_sum", "math_mismatch"]);
  assert.deepEqual(out.confidence_details, {
    vendor_name: 0.9,
    line_items: 0.85,
  });
});

// ── normalizeProposal — validation ──────────────────────────────
test("normalizeProposal throws when vendor_name missing", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  assert.throws(() =>
    mod.normalizeProposal({
      title: "T",
      scope_summary: "s",
      total_amount: 100,
      line_items: [{ description: "a", amount: 100 }],
    }),
    /vendor_name/
  );
});

test("normalizeProposal throws when title missing (proposals.title is NOT NULL)", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  assert.throws(() =>
    mod.normalizeProposal({
      vendor_name: "X",
      scope_summary: "s",
      total_amount: 100,
      line_items: [{ description: "a", amount: 100 }],
    }),
    /title/
  );
});

test("normalizeProposal throws when total_amount missing", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  assert.throws(() =>
    mod.normalizeProposal({
      vendor_name: "X",
      title: "T",
      scope_summary: "s",
      line_items: [{ description: "a", amount: 100 }],
    }),
    /total_amount/
  );
});

test("normalizeProposal throws when line item missing description", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  assert.throws(() =>
    mod.normalizeProposal({
      vendor_name: "X",
      title: "T",
      scope_summary: "s",
      total_amount: 100,
      line_items: [{ amount: 100 }],
    }),
    /description/
  );
});

test("normalizeProposal throws when line item missing amount", async () => {
  const mod = await import("../src/lib/ingestion/extract-proposal");
  assert.throws(() =>
    mod.normalizeProposal({
      vendor_name: "X",
      title: "T",
      scope_summary: "s",
      total_amount: 100,
      line_items: [{ description: "a" }],
    }),
    /amount/
  );
});

// ── Live (gated) ────────────────────────────────────────────────
// Only runs with RUN_PROPOSAL_EXTRACT_LIVE=1 AND ANTHROPIC_API_KEY set.
// Asserts the returned shape on a real fixture; accuracy is Step 6B's job.
const PROPOSAL_FIXTURE_DIR = "__tests__/fixtures/classifier/.local/proposal";
if (process.env.RUN_PROPOSAL_EXTRACT_LIVE === "1") {
  test("LIVE: extractProposal returns valid ParsedProposal shape on first fixture", async () => {
    dotenv.config({ path: ".env.local" });
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("RUN_PROPOSAL_EXTRACT_LIVE=1 requires ANTHROPIC_API_KEY");
    }
    if (!existsSync(PROPOSAL_FIXTURE_DIR)) {
      throw new Error(`fixture dir missing: ${PROPOSAL_FIXTURE_DIR}`);
    }
    const fixtures = readdirSync(PROPOSAL_FIXTURE_DIR).filter((f) => f.endsWith(".pdf"));
    assert.ok(fixtures.length > 0, "no proposal fixtures found");
    const buf = readFileSync(join(PROPOSAL_FIXTURE_DIR, fixtures[0]));
    const mod = await import("../src/lib/ingestion/extract-proposal");
    const out = await mod.extractProposal(
      { pdfBuffer: buf, documentId: "00000000-0000-0000-0000-000000000000" },
      { org_id: "00000000-0000-0000-0000-000000000001", metadata: { source: "live_test" } }
    );
    assert.ok(typeof out.vendor_name === "string" && out.vendor_name.length > 0);
    assert.ok(typeof out.title === "string" && out.title.length > 0);
    assert.ok(typeof out.scope_summary === "string");
    assert.ok(Number.isInteger(out.total_cents));
    assert.ok(Array.isArray(out.line_items));
    assert.ok(out.line_items.length > 0, "expect at least one line item");
    for (const li of out.line_items) {
      assert.ok(typeof li.description === "string" && li.description.length > 0);
      assert.ok(Number.isInteger(li.total_price_cents));
      assert.ok(Number.isInteger(li.line_number));
    }
    assert.ok(out.confidence_score >= 0 && out.confidence_score <= 1);
    assert.ok(out.raw_response, "raw_response must be retained for raw_extraction writeback");
  });
}

// ── Runner ─────────────────────────────────────────────────────
(async () => {
  let failed = 0;
  for (const c of cases) {
    try {
      await c.fn();
      console.log(`PASS  ${c.name}`);
    } catch (e) {
      failed++;
      console.log(`FAIL  ${c.name}`);
      console.log(`      ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log("");
  if (failed > 0) {
    console.error(`${failed} of ${cases.length} test(s) failed`);
    process.exit(1);
  } else {
    console.log(`${cases.length} test(s) passed`);
  }
})();
