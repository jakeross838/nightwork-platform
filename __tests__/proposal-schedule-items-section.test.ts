/**
 * Phase 3.4 Issue 2 commit 9 — ProposalScheduleItemsSection structural fence.
 *
 * Read-only display of structured schedule_items extracted by the
 * proposal extractor. Phase 3.5 owns the editor surface; this section
 * just lets PMs verify what was extracted before they hit commit.
 */

import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

const FILE = "src/components/proposals/ProposalScheduleItemsSection.tsx";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

test("file exists at src/components/proposals/ProposalScheduleItemsSection.tsx", () => {
  assert.ok(existsSync(FILE), `missing ${FILE}`);
});

const source = existsSync(FILE) ? readFileSync(FILE, "utf8") : "";

test("declares 'use client'", () => {
  assert.match(source, /^"use client";/m);
});

test("exports default ProposalScheduleItemsSection", () => {
  assert.match(source, /export default function ProposalScheduleItemsSection/);
});

test("exports ScheduleItemForm with the nine sub-fields", () => {
  assert.match(source, /export interface ScheduleItemForm/);
  assert.match(source, /scope_item:\s*string/);
  assert.match(source, /linked_line_number:\s*number\s*\|\s*null/);
  assert.match(source, /estimated_start_date:\s*string\s*\|\s*null/);
  assert.match(source, /estimated_duration_days:\s*number\s*\|\s*null/);
  assert.match(source, /sequence_position:\s*number\s*\|\s*null/);
  assert.match(source, /depends_on:\s*number\[\]/);
  assert.match(source, /responsibility:\s*string\s*\|\s*null/);
  assert.match(source, /deliverables:\s*string\[\]/);
  assert.match(source, /trigger:\s*string\s*\|\s*null/);
});

test("items prop accepts null OR ScheduleItemForm[]", () => {
  assert.match(source, /items:\s*ScheduleItemForm\[\]\s*\|\s*null/);
});

test("renders 'Read-only · Phase 3.5 owns the editor' badge", () => {
  // Locks the read-only contract in place so a future contributor
  // doesn't accidentally add edit controls before Phase 3.5 ships.
  assert.match(source, /Read-only/);
  assert.match(source, /Phase 3\.5/);
});

test("does NOT include onChange / edit / add-row / remove-row affordances", () => {
  assert.ok(!/onChange:/.test(source), "no onChange in props");
  assert.ok(
    !/addRow|removeRow|updateRow/.test(source),
    "no row-mutation helpers — read-only section"
  );
});

test("collapsible: useState toggle + ▼/▶ glyph", () => {
  assert.match(source, /useState\(/);
  assert.match(source, /▼/);
  assert.match(source, /▶/);
});

test("empty-state message when no schedule extracted", () => {
  assert.match(source, /list\.length\s*===\s*0/);
  assert.match(source, /No schedule extracted/i);
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
    "ProposalScheduleItemsSection must not depend on the orchestrator"
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
