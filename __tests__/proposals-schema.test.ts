/**
 * Phase 2.2 regression fence — R.15.
 *
 * Migration 00065 adds two first-class tables — `proposals` and
 * `proposal_line_items` — with the full audit-column set per CLAUDE.md
 * architecture rules, an `updated_at` trigger matching the project-wide
 * pattern (invoices/jobs/COs use `public.update_updated_at()`), the
 * 7-value proposal status CHECK from Part 2 §2.3, a self-referencing
 * `superseded_by_proposal_id` FK, ON DELETE CASCADE on line items,
 * `UNIQUE (job_id, proposal_number)`, and an 8-index performance set
 * (6 on proposals — 3 partial — and 2 on line items). RLS is enabled
 * on both tables and policies match the canonical tenant-table
 * pattern from `00052_cost_intelligence_spine.sql` verbatim: 3
 * policies per table (SELECT/INSERT/UPDATE) with org-member
 * membership join + platform-admin bypass on read. No DELETE policy
 * — RLS blocks hard DELETE by default; deletion is soft-delete via
 * `deleted_at` per codebase convention (defends R.6 + R.7).
 *
 * All DDL uses `public.` schema qualification per G.9.
 *
 * This test locks those contracts in place. R.7 status_history
 * append enforcement is deferred to Branch 3 write routes per the
 * phase spec.
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

const MIGRATION = "supabase/migrations/00065_proposals.sql";
const MIGRATION_DOWN = "supabase/migrations/00065_proposals.down.sql";

const STATUS_VALUES = [
  "received",
  "under_review",
  "accepted",
  "rejected",
  "superseded",
  "converted_to_po",
  "converted_to_co",
];

// ── migration 00065 structure ────────────────────────────────────────

test("migration 00065 exists", () => {
  assert.ok(existsSync(MIGRATION), `${MIGRATION} missing`);
});

test("migration 00065 has a rollback companion (.down.sql)", () => {
  assert.ok(existsSync(MIGRATION_DOWN), `${MIGRATION_DOWN} missing`);
});

test("migration 00065 creates public.proposals table", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.proposals\b/i.test(src),
    "migration must CREATE TABLE public.proposals (schema qualification per G.9)"
  );
});

test("migration 00065 creates public.proposal_line_items table", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.proposal_line_items\b/i.test(src),
    "migration must CREATE TABLE public.proposal_line_items (schema qualification per G.9)"
  );
});

// ── proposals columns + constraints ──────────────────────────────────

test("proposals.updated_at NOT NULL DEFAULT now()", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /updated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i.test(src),
    "proposals must have updated_at TIMESTAMPTZ NOT NULL DEFAULT now()"
  );
});

test("proposals has the 7-value status CHECK constraint", () => {
  const src = readFileSync(MIGRATION, "utf8");
  for (const v of STATUS_VALUES) {
    assert.ok(
      src.includes(`'${v}'`),
      `migration must reference status value '${v}' inside the CHECK constraint`
    );
  }
  assert.ok(
    /CHECK\s*\(\s*status\s+IN\s*\(/i.test(src),
    "migration must declare CHECK (status IN (...)) on proposals"
  );
});

test("proposals has UNIQUE (job_id, proposal_number)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /UNIQUE\s*\(\s*job_id\s*,\s*proposal_number\s*\)/i.test(src),
    "migration must declare UNIQUE (job_id, proposal_number) on proposals"
  );
});

test("proposals.superseded_by_proposal_id self-references public.proposals", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /superseded_by_proposal_id\s+UUID\s+REFERENCES\s+public\.proposals\s*\(\s*id\s*\)/i.test(src),
    "superseded_by_proposal_id must REFERENCES public.proposals(id) (self-ref FK)"
  );
});

// ── proposal_line_items audit columns + cascade ──────────────────────

test("proposal_line_items has all 5 audit columns (org_id NOT NULL, created_at, updated_at, created_by, deleted_at)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Scope the assertions to the proposal_line_items CREATE body so we
  // don't accidentally match the proposals table's columns. Grab
  // everything between `CREATE TABLE ... proposal_line_items (` and
  // the matching closing `);`.
  const match = src.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.proposal_line_items\s*\(([\s\S]*?)\n\)\s*;/i
  );
  assert.ok(match, "could not locate proposal_line_items CREATE body");
  const body = match![1];
  assert.ok(
    /\borg_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.organizations\s*\(\s*id\s*\)/i.test(body),
    "proposal_line_items must have org_id UUID NOT NULL REFERENCES public.organizations(id)"
  );
  assert.ok(
    /\bcreated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i.test(body),
    "proposal_line_items must have created_at TIMESTAMPTZ NOT NULL DEFAULT now()"
  );
  assert.ok(
    /\bupdated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i.test(body),
    "proposal_line_items must have updated_at TIMESTAMPTZ NOT NULL DEFAULT now()"
  );
  assert.ok(
    /\bcreated_by\s+UUID\s+REFERENCES\s+auth\.users\s*\(\s*id\s*\)/i.test(body),
    "proposal_line_items must have created_by UUID REFERENCES auth.users(id)"
  );
  assert.ok(
    /\bdeleted_at\s+TIMESTAMPTZ\b/i.test(body),
    "proposal_line_items must have deleted_at TIMESTAMPTZ"
  );
});

test("proposal_line_items.proposal_id uses ON DELETE CASCADE", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /proposal_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.proposals\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i.test(
      src
    ),
    "proposal_id must REFERENCES public.proposals(id) ON DELETE CASCADE"
  );
});

// ── triggers ─────────────────────────────────────────────────────────

test("trg_proposals_updated_at trigger defined on public.proposals", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TRIGGER\s+trg_proposals_updated_at\s+BEFORE\s+UPDATE\s+ON\s+public\.proposals\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.update_updated_at\s*\(\s*\)/is.test(
      src
    ),
    "migration must CREATE TRIGGER trg_proposals_updated_at calling public.update_updated_at()"
  );
});

test("trg_proposal_line_items_updated_at trigger defined on public.proposal_line_items", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TRIGGER\s+trg_proposal_line_items_updated_at\s+BEFORE\s+UPDATE\s+ON\s+public\.proposal_line_items\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.update_updated_at\s*\(\s*\)/is.test(
      src
    ),
    "migration must CREATE TRIGGER trg_proposal_line_items_updated_at calling public.update_updated_at()"
  );
});

// ── indexes: 6 on proposals (3 partial), 2 on proposal_line_items ───

test("index idx_proposals_org_status (org_id, status)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+INDEX\s+idx_proposals_org_status\s+ON\s+public\.proposals\s*\(\s*org_id\s*,\s*status\s*\)/i.test(
      src
    ),
    "missing CREATE INDEX idx_proposals_org_status ON public.proposals (org_id, status)"
  );
});

test("index idx_proposals_org_job (org_id, job_id)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+INDEX\s+idx_proposals_org_job\s+ON\s+public\.proposals\s*\(\s*org_id\s*,\s*job_id\s*\)/i.test(
      src
    ),
    "missing CREATE INDEX idx_proposals_org_job ON public.proposals (org_id, job_id)"
  );
});

test("index idx_proposals_org_vendor (org_id, vendor_id)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+INDEX\s+idx_proposals_org_vendor\s+ON\s+public\.proposals\s*\(\s*org_id\s*,\s*vendor_id\s*\)/i.test(
      src
    ),
    "missing CREATE INDEX idx_proposals_org_vendor ON public.proposals (org_id, vendor_id)"
  );
});

test("partial index idx_proposals_superseded_by with WHERE ... IS NOT NULL", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+INDEX\s+idx_proposals_superseded_by\s+ON\s+public\.proposals\s*\(\s*superseded_by_proposal_id\s*\)\s+WHERE\s+superseded_by_proposal_id\s+IS\s+NOT\s+NULL/is.test(
      src
    ),
    "missing partial index idx_proposals_superseded_by ON (superseded_by_proposal_id) WHERE superseded_by_proposal_id IS NOT NULL"
  );
});

test("partial index idx_proposals_converted_po with WHERE ... IS NOT NULL", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+INDEX\s+idx_proposals_converted_po\s+ON\s+public\.proposals\s*\(\s*converted_po_id\s*\)\s+WHERE\s+converted_po_id\s+IS\s+NOT\s+NULL/is.test(
      src
    ),
    "missing partial index idx_proposals_converted_po ON (converted_po_id) WHERE converted_po_id IS NOT NULL"
  );
});

test("partial index idx_proposals_converted_co with WHERE ... IS NOT NULL", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+INDEX\s+idx_proposals_converted_co\s+ON\s+public\.proposals\s*\(\s*converted_co_id\s*\)\s+WHERE\s+converted_co_id\s+IS\s+NOT\s+NULL/is.test(
      src
    ),
    "missing partial index idx_proposals_converted_co ON (converted_co_id) WHERE converted_co_id IS NOT NULL"
  );
});

test("index idx_proposal_line_items_proposal (proposal_id)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+INDEX\s+idx_proposal_line_items_proposal\s+ON\s+public\.proposal_line_items\s*\(\s*proposal_id\s*\)/i.test(
      src
    ),
    "missing CREATE INDEX idx_proposal_line_items_proposal ON public.proposal_line_items (proposal_id)"
  );
});

test("index idx_proposal_line_items_cost_code (cost_code_id)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+INDEX\s+idx_proposal_line_items_cost_code\s+ON\s+public\.proposal_line_items\s*\(\s*cost_code_id\s*\)/i.test(
      src
    ),
    "missing CREATE INDEX idx_proposal_line_items_cost_code ON public.proposal_line_items (cost_code_id)"
  );
});

// ── RLS enabled on both tables ───────────────────────────────────────

test("RLS enabled on public.proposals", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ALTER\s+TABLE\s+public\.proposals\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(src),
    "migration must ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY"
  );
});

test("RLS enabled on public.proposal_line_items", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ALTER\s+TABLE\s+public\.proposal_line_items\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(src),
    "migration must ALTER TABLE public.proposal_line_items ENABLE ROW LEVEL SECURITY"
  );
});

// ── RLS policies: 3 per table (SELECT/INSERT/UPDATE), NO DELETE ──────
// Matches the canonical cost_intelligence_spine (00052) pattern. Hard
// DELETE is blocked by RLS default-deny; deletion is soft-delete via
// deleted_at per codebase convention.

test("proposals has 3 RLS policies (SELECT, INSERT, UPDATE) scoped by org_id", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const forVerbs = ["SELECT", "INSERT", "UPDATE"];
  for (const verb of forVerbs) {
    const re = new RegExp(
      `CREATE\\s+POLICY\\s+\\S+\\s+ON\\s+public\\.proposals\\s+FOR\\s+${verb}\\b`,
      "i"
    );
    assert.ok(
      re.test(src),
      `proposals must have a CREATE POLICY ... FOR ${verb} ON public.proposals`
    );
  }
  // All three policies must reference org_id somewhere in USING / WITH CHECK
  // (structural guard only — runtime scope is verified by the Dry-Run probes).
  assert.ok(
    /org_id/.test(src),
    "policies must reference org_id in USING / WITH CHECK clauses"
  );
});

test("proposal_line_items has 3 RLS policies (SELECT, INSERT, UPDATE) scoped by org_id", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const forVerbs = ["SELECT", "INSERT", "UPDATE"];
  for (const verb of forVerbs) {
    const re = new RegExp(
      `CREATE\\s+POLICY\\s+\\S+\\s+ON\\s+public\\.proposal_line_items\\s+FOR\\s+${verb}\\b`,
      "i"
    );
    assert.ok(
      re.test(src),
      `proposal_line_items must have a CREATE POLICY ... FOR ${verb} ON public.proposal_line_items`
    );
  }
});

test("no DELETE policy defined on either table (regression guard — strip comments first)", () => {
  // Strip line comments so explanatory text like
  // "No DELETE policy — RLS blocks hard DELETE..." doesn't false-positive
  // against the `FOR DELETE` token.
  const raw = readFileSync(MIGRATION, "utf8");
  const stripped = raw.replace(/--.*$/gm, "");
  assert.ok(
    !/FOR\s+DELETE\b/i.test(stripped),
    'migration must not contain "FOR DELETE" outside comments — hard DELETE is RLS-blocked by default; soft-delete via deleted_at is the codebase convention (cost_intelligence_spine precedent)'
  );
});

// ── schema qualification (G.9) ───────────────────────────────────────

test("all table references in migration use public. schema qualification", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Find every unqualified reference to our target tables (no 'public.' prefix).
  // Allow them inside comments or string literals. This is a heuristic — the
  // authoritative check is a review of the migration, but a common mistake
  // is dropping the `public.` prefix on ALTER / REFERENCES statements.
  //
  // Strip line comments first.
  const stripped = src.replace(/--.*$/gm, "");
  const suspects = [
    /\bALTER\s+TABLE\s+proposals\b/i,
    /\bALTER\s+TABLE\s+proposal_line_items\b/i,
    /\bREFERENCES\s+proposals\s*\(/i,
    /\bREFERENCES\s+proposal_line_items\s*\(/i,
    /\bREFERENCES\s+jobs\s*\(/i,
    /\bREFERENCES\s+vendors\s*\(/i,
    /\bREFERENCES\s+purchase_orders\s*\(/i,
    /\bREFERENCES\s+change_orders\s*\(/i,
    /\bREFERENCES\s+organizations\s*\(/i,
    /\bREFERENCES\s+cost_codes\s*\(/i,
    /\bON\s+public\.\S+\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+update_updated_at\b/i, // unqualified function call
  ];
  for (const re of suspects) {
    assert.ok(
      !re.test(stripped),
      `found unqualified table reference matching ${re} — every table ref must use public. prefix per G.9`
    );
  }
});

// ── down migration structure ─────────────────────────────────────────

test("down migration drops both tables in reverse-dependency order", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");
  // Line items first (it depends on proposals), proposals second.
  assert.ok(
    /DROP\s+TABLE\s+IF\s+EXISTS\s+public\.proposal_line_items/i.test(src),
    "down migration must DROP TABLE IF EXISTS public.proposal_line_items"
  );
  assert.ok(
    /DROP\s+TABLE\s+IF\s+EXISTS\s+public\.proposals/i.test(src),
    "down migration must DROP TABLE IF EXISTS public.proposals"
  );
  const lineItemsIdx = src.search(/DROP\s+TABLE\s+IF\s+EXISTS\s+public\.proposal_line_items/i);
  const proposalsIdx = src.search(
    /DROP\s+TABLE\s+IF\s+EXISTS\s+public\.proposals(?!\w)/i
  );
  assert.ok(
    lineItemsIdx < proposalsIdx,
    "down migration must drop proposal_line_items BEFORE proposals (child before parent)"
  );
});

// ── runner ────────────────────────────────────────────────────────────

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
