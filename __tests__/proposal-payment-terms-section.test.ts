/**
 * Phase 3.4 Issue 2 commit 8 — ProposalPaymentTermsSection structural fence.
 *
 * Locks the terms key-value editor: net_days, late_interest_rate_pct,
 * governing_law, other_terms_text. All-fields-null collapses back to
 * null at the parent so the commit route preserves the absence-of-terms
 * signal.
 */

import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const FILE = "src/components/proposals/ProposalPaymentTermsSection.tsx";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

test("file exists at src/components/proposals/ProposalPaymentTermsSection.tsx", () => {
  assert.ok(existsSync(FILE), `missing ${FILE}`);
});

const source = existsSync(FILE) ? readFileSync(FILE, "utf8") : "";

test("declares 'use client'", () => {
  assert.match(source, /^"use client";/m);
});

test("exports default ProposalPaymentTermsSection", () => {
  assert.match(source, /export default function ProposalPaymentTermsSection/);
});

test("exports PaymentTermsForm with the four sub-fields", () => {
  assert.match(source, /export interface PaymentTermsForm/);
  assert.match(source, /net_days:\s*number\s*\|\s*null/);
  assert.match(source, /late_interest_rate_pct:\s*number\s*\|\s*null/);
  assert.match(source, /governing_law:\s*string\s*\|\s*null/);
  assert.match(source, /other_terms_text:\s*string\s*\|\s*null/);
});

test("terms prop accepts null OR PaymentTermsForm", () => {
  assert.match(source, /terms:\s*PaymentTermsForm\s*\|\s*null/);
});

test("collapses to null when all sub-fields become null", () => {
  // The all-null collapse is the contract that lets the commit
  // route distinguish "no terms section on the proposal" from
  // "PM filled at least one field".
  assert.match(
    source,
    /allNull[\s\S]{0,400}?onChange\(allNull\s*\?\s*null\s*:/
  );
});

test("renders all four field labels", () => {
  assert.match(source, /Net days/);
  assert.match(source, /Late interest rate/);
  assert.match(source, /Governing law/);
  assert.match(source, /Other terms text/);
});

test("self-contained: defines local FormField helper", () => {
  assert.match(source, /function FormField\(/);
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
    "ProposalPaymentTermsSection must not depend on the orchestrator"
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
