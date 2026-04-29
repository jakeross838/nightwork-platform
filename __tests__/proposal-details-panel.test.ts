/**
 * Phase 3.4 Issue 2 commit 10 — ProposalDetailsPanel structural fence.
 *
 * Right-rail panel mirroring InvoiceDetailsPanel: metadata grid +
 * extraction-metadata block + scope content. Scope sections moved
 * into the right rail (per Jake's prompt 205) so document-identity
 * content lives together and the rail is balanced against the PDF.
 *
 * Status timeline is reserved for the future committed-proposal
 * view; today's panel renders an extraction-metadata block in the
 * same component shape (Q1 decision).
 */

import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const FILE = "src/components/proposals/ProposalDetailsPanel.tsx";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

test("file exists at src/components/proposals/ProposalDetailsPanel.tsx", () => {
  assert.ok(existsSync(FILE), `missing ${FILE}`);
});

const source = existsSync(FILE) ? readFileSync(FILE, "utf8") : "";

test("declares 'use client'", () => {
  assert.match(source, /^"use client";/m);
});

test("exports default ProposalDetailsPanel", () => {
  assert.match(source, /export default function ProposalDetailsPanel/);
});

test("exports ProposalDetailsPanelForm covering identity + scope fields", () => {
  assert.match(source, /export interface ProposalDetailsPanelForm/);
  // Identity fields
  assert.match(source, /vendor_name:/);
  assert.match(source, /vendor_id:/);
  assert.match(source, /job_id:/);
  assert.match(source, /job_address:/);
  assert.match(source, /proposal_number:/);
  assert.match(source, /proposal_date:/);
  assert.match(source, /valid_through:/);
  assert.match(source, /total_cents:/);
  // Vendor-stated schedule
  assert.match(source, /vendor_stated_start_date:/);
  assert.match(source, /vendor_stated_duration_days:/);
  // Scope content (moved into right rail per prompt 205)
  assert.match(source, /scope_summary:/);
  assert.match(source, /inclusions:/);
  assert.match(source, /exclusions:/);
  assert.match(source, /notes:/);
});

test("imports JobOption + VendorOption from page route", () => {
  assert.match(
    source,
    /import\s+type\s*\{[\s\S]{0,200}?JobOption[\s\S]{0,80}?VendorOption[^}]*\}\s*from\s*["']@\/app\/proposals\/review\/\[extraction_id\]\/page["']/
  );
});

test("renders 'Proposal details' h3 in font-display + eyebrow", () => {
  assert.match(source, /Proposal details/);
  assert.match(source, /var\(--font-display\)/);
});

test("metadata grid uses font-mono uppercase eyebrow labels (Slate type)", () => {
  assert.match(source, /font-mono|var\(--font-mono\)/);
  assert.match(source, /textTransform:\s*["']uppercase["']/);
});

test("Total amount is editable as dollars (cents internally)", () => {
  assert.match(source, /centsToDollars\(form\.total_cents\)/);
  assert.match(source, /dollarsToCents/);
});

test("vendor + job dropdowns render option lists", () => {
  assert.match(source, /vendors\.map\(\(v\)/);
  assert.match(source, /jobs\.map\(\(j\)/);
});

test("renders Extraction metadata block (substitute for status timeline)", () => {
  assert.match(source, /Extraction metadata/);
  assert.match(source, /aiModelUsed/);
  assert.match(source, /extractionPromptVersion/);
  assert.match(source, /extractedAt/);
});

test("Re-extract action sits inside extraction-metadata block", () => {
  // Per Q10: placement is inside ProposalDetailsPanel next to the
  // Extraction metadata eyebrow, not in the header chrome.
  assert.match(source, /onReExtract/);
  assert.match(source, /Re-extract/);
});

test("Re-extract guards with confirm dialog mentioning ~\\$0.30 + 30 seconds", () => {
  assert.match(source, /window\.confirm/);
  assert.match(source, /\$0\.30/);
  assert.match(source, /30 seconds/);
});

test("renders flags row when form.flags is non-empty", () => {
  assert.match(source, /form\.flags\.length\s*>\s*0/);
});

test("scope content (summary, inclusions, exclusions, notes) lives IN the panel", () => {
  // Per Jake's prompt 205: document-identity content lives in the
  // right rail; this is the explicit content split.
  assert.match(source, /Scope/);
  assert.match(source, /value=\{form\.scope_summary\}/);
  assert.match(source, /value=\{form\.inclusions\s*\?\?\s*""\}/);
  assert.match(source, /value=\{form\.exclusions\s*\?\?\s*""\}/);
  assert.match(source, /value=\{form\.notes\s*\?\?\s*""\}/);
});

test("does NOT include the action buttons (Save/Convert PO/Reject) — those live in the action strip", () => {
  // Per Q2: codebase precedent — actions in action strip above the
  // hero, not in the right rail.
  assert.ok(
    !/onSave|onCommit|onReject|onConvertPO|Save as Proposal|Convert to PO|Convert to CO|Reject(?!ed)/.test(
      source
    ),
    "action buttons must not be embedded in the right-rail panel"
  );
});

test("does NOT include an InvoiceAllocationsEditor analog (cost codes are inline per line)", () => {
  // Per Risk 6: proposals carry per-line cost codes; the right rail
  // does not host an allocation table.
  assert.ok(
    !/Allocations|allocations[Ee]ditor|AllocationRow/.test(source),
    "no allocations editor — cost codes live in ProposalLineItemRow"
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
    "ProposalDetailsPanel must not depend on the orchestrator"
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
