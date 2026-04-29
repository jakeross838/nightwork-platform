/**
 * Phase 3.4 Issue 2 commit 5 — ProposalLineItemsSection structural fence.
 *
 * The section wraps a list of ProposalLineItemRow components with a
 * card header (line count + roll-up total) and an empty-state for
 * lump-sum proposals. Sits below the 50/50 hero per the operational
 * vs document-identity split (prompt 205).
 */

import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const FILE = "src/components/proposals/ProposalLineItemsSection.tsx";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

test("file exists at src/components/proposals/ProposalLineItemsSection.tsx", () => {
  assert.ok(existsSync(FILE), `missing ${FILE}`);
});

const source = existsSync(FILE) ? readFileSync(FILE, "utf8") : "";

test("declares 'use client'", () => {
  assert.match(source, /^"use client";/m);
});

test("imports ProposalLineItemRow + form types from commit 4", () => {
  assert.match(
    source,
    /import\s+ProposalLineItemRow[\s\S]{0,300}?ProposalLineItemForm[\s\S]{0,80}?CostCodePick[\s\S]{0,200}?from\s+["']@\/components\/proposals\/ProposalLineItemRow["']/
  );
});

test("imports option types from page route", () => {
  assert.match(
    source,
    /import\s+type\s*\{[\s\S]{0,200}?OrgCostCodeOption[\s\S]{0,200}?LegacyCostCodeOption[\s\S]{0,200}?PendingSuggestionOption[^}]*\}\s*from\s*["']@\/app\/proposals\/review\/\[extraction_id\]\/page["']/
  );
});

test("imports Money component for total roll-up", () => {
  assert.match(source, /import\s+Money\s+from\s+["']@\/components\/nw\/Money["']/);
});

test("exports default React component", () => {
  assert.match(source, /export default function ProposalLineItemsSection/);
});

test("renders line count + total in header", () => {
  assert.match(source, /Line items\s*\(\{lineItems\.length\}\)/);
  assert.match(source, /<Money\s+cents=\{totalCents\}/);
});

test("empty-state message for lump-sum proposals", () => {
  assert.match(source, /lineItems\.length\s*===\s*0/);
  assert.match(source, /lump-sum/i);
});

test("maps line_items to ProposalLineItemRow with index-based callbacks", () => {
  assert.match(source, /lineItems\.map\(\(li,\s*idx\)/);
  assert.match(source, /<ProposalLineItemRow\s/);
  assert.match(
    source,
    /onChange=\{\(patch\)\s*=>\s*onLineChange\(idx,\s*patch\)\}/
  );
});

test("does NOT define LineItemRow inline (delegates to commit 4)", () => {
  assert.ok(
    !/function (LineItemRow|ProposalLineItemRow)\(/.test(source),
    "section must not redefine the row component — must import"
  );
});

test("uses Slate semantic CSS vars", () => {
  assert.ok(
    !/bg-cream|text-cream|bg-teal|text-teal|bg-brass|text-brass|bg-brand|text-brand|bg-status|text-status|bg-nightwork|text-nightwork/.test(
      source
    ),
    "Slate semantic vars only — no legacy color namespaces"
  );
  assert.match(source, /var\(--/);
});

test("does NOT import from ReviewManager.tsx", () => {
  assert.ok(
    !/from\s+["'][^"']*ReviewManager["']/.test(source),
    "ProposalLineItemsSection must not depend on the orchestrator"
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
