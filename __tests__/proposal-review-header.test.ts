/**
 * Phase 3.4 Issue 2 commit 3 — ProposalReviewHeader structural fence.
 *
 * The component must mirror the invoice `InvoiceHeader.tsx` compact
 * sub-header pattern: blue-tint band, vendor name in font-display,
 * VendorContactPopover, proposal#, confidence rollup pill, status
 * badge via ProposalStatusBadge, Print button on the right. NO
 * back-link (Phase 3.10 owns the proposals queue), NO PM picker
 * (proposals have no assigned-PM concept yet).
 */

import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const FILE = "src/components/proposals/ProposalReviewHeader.tsx";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

test("file exists at src/components/proposals/ProposalReviewHeader.tsx", () => {
  assert.ok(existsSync(FILE), `missing ${FILE}`);
});

const source = existsSync(FILE) ? readFileSync(FILE, "utf8") : "";

test("declares 'use client' (uses window.print + interactive popover)", () => {
  assert.match(source, /^"use client";/m);
});

test("imports VendorContactPopover (reuses invoice popover)", () => {
  assert.match(
    source,
    /import\s+VendorContactPopover[\s\S]{0,80}?from\s+["']@\/components\/vendor-contact-popover["']/
  );
});

test("imports ProposalStatusBadge (commit 1 dependency)", () => {
  assert.match(
    source,
    /import\s+ProposalStatusBadge[\s\S]{0,80}?from\s+["']@\/components\/proposals\/ProposalStatusBadge["']/
  );
});

test("imports confidenceColor + confidenceLabel from format utils", () => {
  assert.match(
    source,
    /import\s*\{[^}]*confidenceColor[\s\S]{0,40}?confidenceLabel[^}]*\}\s*from\s*["']@\/lib\/utils\/format["']/
  );
});

test("exports default React component", () => {
  assert.match(source, /export default function ProposalReviewHeader/);
});

test("uses font-display for vendor name (Slate type system parity)", () => {
  assert.match(source, /font-display/);
});

test("matches invoice header blue-tint band background", () => {
  // InvoiceHeader.tsx uses bg-[rgba(91,134,153,0.04)] — same band.
  assert.match(source, /rgba\(91,\s*134,\s*153,\s*0\.04\)/);
});

test("renders confidence rollup pill (% + High/Needs Review/Low)", () => {
  assert.match(source, /confidenceColor\(/);
  assert.match(source, /confidenceLabel\(/);
  assert.match(source, /Math\.round\(confidenceScore\s*\*\s*100\)/);
});

test("renders ProposalStatusBadge with status + signed props", () => {
  assert.match(
    source,
    /<ProposalStatusBadge\s+status=\{status\}\s+signed=\{signed\}/
  );
});

test("Print button right-aligned via ml-auto, prints via window.print()", () => {
  assert.match(source, /ml-auto/);
  assert.match(source, /window\.print\(\)/);
});

test("does NOT include a back-link (Phase 3.10 owns proposals queue)", () => {
  assert.ok(
    !/proposals\/queue/i.test(source),
    "back-link to proposals queue must be omitted in Phase 3.4"
  );
});

test("does NOT include a PM picker (no assigned-PM concept on proposals)", () => {
  assert.ok(
    !/assigned_?pm|pmUsers|onReassignPm/i.test(source),
    "ProposalReviewHeader must not include the PM picker pattern"
  );
});

test("hidden in print preview (sub-header chrome shouldn't print)", () => {
  assert.match(source, /print:hidden/);
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
