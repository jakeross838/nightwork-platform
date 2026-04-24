/**
 * Unit tests for src/lib/invoice-permissions.ts — Phase 2.3.
 *
 * Coverage:
 *   - isInvoiceLocked(): every InvoiceStatus value mapped to its
 *     expected boolean
 *   - canEditLockedFields(): every OrgMemberRole value mapped to its
 *     expected boolean
 *   - canEditInvoice(): full status × role matrix, plus the specific
 *     cases called out in the Phase 2 brief
 */

import { strict as assert } from "node:assert";
import {
  isInvoiceLocked,
  canEditLockedFields,
  canEditInvoice,
  type InvoiceStatus,
} from "../src/lib/invoice-permissions";
import type { OrgMemberRole } from "../src/lib/org/session";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

// ── Status matrix ────────────────────────────────────────────────────

const LOCKED: InvoiceStatus[] = [
  "pm_approved",
  "qa_review",
  "qa_approved",
  "in_draw",
  "paid",
];

const UNLOCKED: InvoiceStatus[] = [
  "received",
  "ai_processed",
  "pm_review",
  "pm_held",
  "pm_denied",
  "qa_kicked_back",
  "pushed_to_qb",
  "qb_failed",
  "void",
  "import_queued",
  "import_parsing",
  "import_parsed",
  "import_error",
  "import_duplicate",
  "info_requested",
  "info_received",
];

const ALL_STATUSES: InvoiceStatus[] = [...LOCKED, ...UNLOCKED];
const ALL_ROLES: OrgMemberRole[] = ["owner", "admin", "accounting", "pm"];
const PRIVILEGED: OrgMemberRole[] = ["owner", "admin", "accounting"];
const NON_PRIVILEGED: OrgMemberRole[] = ["pm"];

// ── isInvoiceLocked ──────────────────────────────────────────────────

for (const s of LOCKED) {
  test(`isInvoiceLocked('${s}') === true`, () => {
    assert.equal(isInvoiceLocked(s), true);
  });
}

for (const s of UNLOCKED) {
  test(`isInvoiceLocked('${s}') === false`, () => {
    assert.equal(isInvoiceLocked(s), false);
  });
}

test("isInvoiceLocked tolerates unknown status strings", () => {
  assert.equal(isInvoiceLocked("garbage_value_never_defined"), false);
});

// ── canEditLockedFields ──────────────────────────────────────────────

for (const r of PRIVILEGED) {
  test(`canEditLockedFields('${r}') === true`, () => {
    assert.equal(canEditLockedFields(r), true);
  });
}

for (const r of NON_PRIVILEGED) {
  test(`canEditLockedFields('${r}') === false`, () => {
    assert.equal(canEditLockedFields(r), false);
  });
}

// ── canEditInvoice — full matrix ─────────────────────────────────────

for (const status of ALL_STATUSES) {
  for (const role of ALL_ROLES) {
    const locked = LOCKED.includes(status);
    const privileged = PRIVILEGED.includes(role);
    const expected = !locked || privileged;
    test(`canEditInvoice({status:'${status}'}, '${role}') === ${expected}`, () => {
      assert.equal(canEditInvoice({ status }, role), expected);
    });
  }
}

// ── Brief-specified spot checks (redundant but explicit) ─────────────

test("pm_review + pm → editable (not locked)", () => {
  assert.equal(canEditInvoice({ status: "pm_review" }, "pm"), true);
});

test("qa_review + pm → not editable (locked + not privileged)", () => {
  assert.equal(canEditInvoice({ status: "qa_review" }, "pm"), false);
});

test("qa_review + accounting → editable (locked + privileged)", () => {
  assert.equal(canEditInvoice({ status: "qa_review" }, "accounting"), true);
});

test("paid + admin → editable (locked + privileged)", () => {
  assert.equal(canEditInvoice({ status: "paid" }, "admin"), true);
});

test("pm_review + accounting → editable (not locked, privilege trivially satisfies)", () => {
  assert.equal(canEditInvoice({ status: "pm_review" }, "accounting"), true);
});

// ── runner ───────────────────────────────────────────────────────────

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
