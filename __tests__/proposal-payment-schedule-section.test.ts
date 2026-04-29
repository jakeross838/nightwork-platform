/**
 * Phase 3.4 Issue 2 commit 7 — ProposalPaymentScheduleSection structural fence.
 *
 * Locks the milestone editor: collapsible card with grid rows for
 * (milestone, percentage_pct, amount_cents, trigger), add/remove row,
 * null-vs-empty distinction so commit route can preserve vendor intent.
 */

import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const FILE = "src/components/proposals/ProposalPaymentScheduleSection.tsx";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

test("file exists at src/components/proposals/ProposalPaymentScheduleSection.tsx", () => {
  assert.ok(existsSync(FILE), `missing ${FILE}`);
});

const source = existsSync(FILE) ? readFileSync(FILE, "utf8") : "";

test("declares 'use client'", () => {
  assert.match(source, /^"use client";/m);
});

test("exports default ProposalPaymentScheduleSection", () => {
  assert.match(source, /export default function ProposalPaymentScheduleSection/);
});

test("exports PaymentScheduleEntryForm with milestone/percentage_pct/amount_cents/trigger", () => {
  assert.match(source, /export interface PaymentScheduleEntryForm/);
  assert.match(source, /milestone:\s*string/);
  assert.match(source, /percentage_pct:\s*number\s*\|\s*null/);
  assert.match(source, /amount_cents:\s*number\s*\|\s*null/);
  assert.match(source, /trigger:\s*string\s*\|\s*null/);
});

test("entries prop accepts null OR PaymentScheduleEntryForm[]", () => {
  assert.match(source, /entries:\s*PaymentScheduleEntryForm\[\]\s*\|\s*null/);
});

test("removeRow returns null when last row removed", () => {
  assert.match(source, /next\.length\s*===\s*0\s*\?\s*null\s*:/);
});

test("collapsible: useState toggle + ▼/▶ glyph", () => {
  assert.match(source, /useState\(/);
  assert.match(source, /▼/);
  assert.match(source, /▶/);
});

test("add row labeled '+ Add milestone'", () => {
  assert.match(source, /\+ Add milestone/);
});

test("self-contained: defines local FormField + cents helpers", () => {
  assert.match(source, /function FormField\(/);
  assert.match(source, /function centsToDollars\(/);
  assert.match(source, /function dollarsToCents\(/);
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
    "ProposalPaymentScheduleSection must not depend on the orchestrator"
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
