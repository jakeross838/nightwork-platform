/**
 * Phase 3.4 Issue 2 commit 4 — ProposalLineItemRow structural fence.
 *
 * Locks the extracted line-item editor in place: cost-code dropdown
 * with org/legacy/pending optgroups, AI suggestion display, suggest-new
 * trigger, collapsible cost breakdown, and Slate type system parity.
 */

import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const FILE = "src/components/proposals/ProposalLineItemRow.tsx";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

test("file exists at src/components/proposals/ProposalLineItemRow.tsx", () => {
  assert.ok(existsSync(FILE), `missing ${FILE}`);
});

const source = existsSync(FILE) ? readFileSync(FILE, "utf8") : "";

test("declares 'use client'", () => {
  assert.match(source, /^"use client";/m);
});

test("exports default React component", () => {
  assert.match(source, /export default function ProposalLineItemRow/);
});

test("exports CostCodePick discriminated union", () => {
  assert.match(source, /export type CostCodePick\s*=/);
  // Four kinds: none, org, legacy, pending
  assert.match(source, /kind:\s*["']none["']/);
  assert.match(source, /kind:\s*["']org["']/);
  assert.match(source, /kind:\s*["']legacy["']/);
  assert.match(source, /kind:\s*["']pending["']/);
});

test("exports ProposalLineItemForm with line-item fields", () => {
  assert.match(source, /export interface ProposalLineItemForm/);
  assert.match(source, /line_number:/);
  assert.match(source, /total_price_cents:/);
  assert.match(source, /cost_code_pick:\s*CostCodePick/);
});

test("imports option types from page route (single source of truth)", () => {
  assert.match(
    source,
    /import\s+type\s*\{[\s\S]{0,200}?OrgCostCodeOption[\s\S]{0,200}?LegacyCostCodeOption[\s\S]{0,200}?PendingSuggestionOption[^}]*\}\s*from\s*["']@\/app\/proposals\/review\/\[extraction_id\]\/page["']/
  );
});

test("cost-code dropdown groups by source: org / legacy / pending", () => {
  // Phase 3.4 Step 7 contract — the optgroup labels are PM-facing copy
  // chosen specifically for this UI; the polish memo flagged a future
  // relabel (project_phase3_4_polish_dropdown_labels). Locked in until
  // that polish lands.
  assert.match(source, /<optgroup\s+label="\[New\] Org codes \(Phase 3\.3\)"/);
  assert.match(source, /<optgroup\s+label="\[Legacy\] Cost codes \(Phase 1\)"/);
  assert.match(
    source,
    /<optgroup\s+label="\[Pending\] Suggested by you \/ your team"/
  );
});

test("renders pending-suggestion badge when cost_code_pick.kind === 'pending'", () => {
  assert.match(
    source,
    /cost_code_pick\.kind\s*===\s*["']pending["'][\s\S]{0,400}?Pending:\s*\{line\.cost_code_pick\.suggested_code\}/
  );
});

test("AI suggestion line shown when ai_cost_code_suggestion is set", () => {
  assert.match(source, /AI suggestion:\s*\{line\.ai_cost_code_suggestion\}/);
});

test("Suggest new trigger calls onSuggestNew", () => {
  assert.match(source, /onClick=\{props\.onSuggestNew\}/);
  assert.match(source, /Suggest new/);
});

test("collapsible cost breakdown covers material/labor/subcontract/tax/delivery/notes", () => {
  assert.match(source, /material_cost_cents/);
  assert.match(source, /labor_cost_cents/);
  assert.match(source, /subcontract_cost_cents/);
  assert.match(source, /tax_cents/);
  assert.match(source, /delivery_cents/);
  assert.match(source, /notes_cents/);
  assert.match(source, /Show.*cost breakdown|cost breakdown/);
});

test("self-contained: defines local FormField + ConfidenceDot helpers", () => {
  // Each section file owns its helpers until commit 11 consolidates.
  assert.match(source, /function FormField\(/);
  assert.match(source, /function ConfidenceDot\(/);
});

test("self-contained: defines local centsToDollars + dollarsToCents", () => {
  assert.match(source, /function centsToDollars\(/);
  assert.match(source, /function dollarsToCents\(/);
});

test("uses Slate semantic CSS vars, not legacy color namespaces", () => {
  assert.ok(
    !/bg-cream|text-cream|bg-teal|text-teal|bg-brass|text-brass|bg-brand|text-brand|bg-status|text-status|bg-nightwork|text-nightwork/.test(
      source
    ),
    "Slate semantic vars only — no legacy color namespaces"
  );
  assert.match(source, /var\(--/);
});

test("does NOT import from ReviewManager.tsx (decouples row from orchestrator)", () => {
  assert.ok(
    !/from\s+["'][^"']*ReviewManager["']/.test(source),
    "ProposalLineItemRow must not depend on ReviewManager — would create a cycle"
  );
});

let failed = 0;
for (const c of cases) {
  try {
    c.fn();
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
