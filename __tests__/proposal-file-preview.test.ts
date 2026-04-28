/**
 * Phase 3.4 Issue 2 commit 2 — ProposalFilePreview structural fence.
 *
 * The component must thinly wrap PdfRenderer (no local PDF logic),
 * accept fileUrl/downloadUrl/fileName props matching InvoiceFilePreview's
 * PDF branch surface, and gracefully render an empty state when fileUrl
 * is null. PDF-only assumption: no image/docx fallbacks.
 */

import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const FILE = "src/components/proposals/ProposalFilePreview.tsx";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

test("file exists at src/components/proposals/ProposalFilePreview.tsx", () => {
  assert.ok(existsSync(FILE), `missing ${FILE}`);
});

const source = existsSync(FILE) ? readFileSync(FILE, "utf8") : "";

test("declares 'use client' (PdfRenderer is client-only via dynamic worker)", () => {
  assert.match(source, /^"use client";/m);
});

test("imports PdfRenderer from @/components/pdf-renderer", () => {
  assert.match(
    source,
    /import\s+PdfRenderer\s+from\s+["']@\/components\/pdf-renderer["']/
  );
});

test("exports default React component", () => {
  assert.match(source, /export default function ProposalFilePreview/);
});

test("accepts fileUrl, downloadUrl, fileName props", () => {
  assert.match(source, /fileUrl/);
  assert.match(source, /downloadUrl/);
  assert.match(source, /fileName/);
});

test("renders empty state when fileUrl is falsy", () => {
  assert.match(source, /if\s*\(!fileUrl\)/);
  assert.match(source, /No preview available/i);
});

test("delegates to PdfRenderer (no local PDF parsing)", () => {
  assert.match(source, /<PdfRenderer/);
  assert.ok(
    !/from\s+["']react-pdf["']/.test(source),
    "ProposalFilePreview must not import react-pdf directly — defer to PdfRenderer"
  );
});

test("does NOT include image / docx / unknown branches (PDF-only)", () => {
  assert.ok(
    !/ImagePreview|DocxPreview|UnknownPreview|fileKindFromUrl/.test(source),
    "Proposals are PDF-only; this wrapper must not embed dispatcher branches"
  );
});

test("uses Slate semantic CSS vars for empty state", () => {
  assert.ok(
    !/bg-cream|text-cream|bg-teal|text-teal|bg-brass|bg-brand|bg-status|bg-nightwork/.test(
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
