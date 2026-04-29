/**
 * Phase 3.4 Issue 2 commit 1 — ProposalStatusBadge structural fence.
 *
 * Locks the proposal-review status enum + badge labels in place so
 * future status_history surfaces (committed proposals, future PO
 * conversion view) reuse the same enum and labels.
 */

import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const FILE = "src/components/proposals/ProposalStatusBadge.tsx";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

test("file exists at src/components/proposals/ProposalStatusBadge.tsx", () => {
  assert.ok(existsSync(FILE), `missing ${FILE}`);
});

const source = existsSync(FILE) ? readFileSync(FILE, "utf8") : "";

test("exports default React component", () => {
  assert.match(source, /export default function ProposalStatusBadge/);
});

test("exports ProposalReviewStatus enum type", () => {
  assert.match(source, /export type ProposalReviewStatus\s*=/);
});

test("status enum includes awaiting_review", () => {
  assert.match(source, /["']awaiting_review["']/);
});

test("status enum includes committed (post-commit, future)", () => {
  assert.match(source, /["']committed["']/);
});

test("status enum includes rejected (post-commit, future)", () => {
  assert.match(source, /["']rejected["']/);
});

test("status enum includes converted_to_po (post-commit, future)", () => {
  assert.match(source, /["']converted_to_po["']/);
});

test("renders 'Awaiting review' label for awaiting_review", () => {
  assert.match(
    source,
    /case\s+["']awaiting_review["'][\s\S]{0,200}?["']Awaiting review["']/
  );
});

test("renders 'Accepted' label for committed", () => {
  assert.match(
    source,
    /case\s+["']committed["'][\s\S]{0,200}?["']Accepted["']/
  );
});

test("renders 'Rejected' label for rejected", () => {
  assert.match(
    source,
    /case\s+["']rejected["'][\s\S]{0,200}?["']Rejected["']/
  );
});

test("renders 'Converted to PO' label for converted_to_po", () => {
  assert.match(
    source,
    /case\s+["']converted_to_po["'][\s\S]{0,200}?["']Converted to PO["']/
  );
});

test("signed prop appends '· Signed' suffix only on awaiting_review", () => {
  assert.match(source, /·\s+Signed/);
  // The suffix logic must check status === awaiting_review
  assert.match(
    source,
    /signed\s*&&\s*status\s*===\s*["']awaiting_review["']/
  );
});

test("uses Slate semantic color tokens (CSS vars), not legacy namespaces", () => {
  // Per CLAUDE.md: Slate semantics only — no `bg-cream/*`, `text-teal/*`,
  // `text-brass/*`, `text-brand/*`, `bg-status/*`, `bg-nightwork/*` etc.
  assert.ok(
    !/bg-cream|text-cream|bg-teal|text-teal|bg-brass|text-brass|bg-brand|text-brand|bg-status|text-status|bg-nightwork|text-nightwork/.test(
      source
    ),
    "ProposalStatusBadge must use Slate semantic CSS vars (var(--nw-*) / var(--text-*))"
  );
  assert.match(source, /var\(--nw-/);
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
