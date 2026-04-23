/**
 * Phase 2.8 regression fence — R.15.
 *
 * Migration 00073 adds public.pricing_history — a trigger-populated
 * append-only audit spine for pricing observations across 4 source
 * entities (invoice / proposal / po / co). Captures a pricing row
 * when the parent entity reaches its "pricing-committed" status
 * (invoice=qa_approved, proposal=accepted, po=issued, co=approved).
 *
 * Plan amendments A-N + O landed at commit 643b669. Pre-flight
 * findings at qa-reports/preflight-branch2-phase2.8.md (commit
 * 7bc4db0).
 *
 * R.23 DIVERGENCE (Amendment B): this is the first Branch 2 phase
 * outside the 3-policy RLS family. pricing_history adopts a 1-policy
 * shape (single SELECT; no INSERT/UPDATE/DELETE). Closest prior
 * precedent: activity_log. Service-role SECURITY DEFINER triggers
 * bypass RLS on writes. Amendment B regression fence below asserts
 * no-write-policies so a future fixer cannot silently add one.
 *
 * IMMUTABILITY CONTRACT (Amendment C): no deleted_at column; no
 * UPDATE policy. Corrections are platform-admin service-role SQL
 * DELETE only. Load-bearing for pricing-intelligence signal
 * integrity.
 *
 * SPEC CORRECTION (Amendment H): the original plan spec referenced
 * a `purchase_order_line_items` trigger target. That table does not
 * exist. Canonical name is public.po_line_items. Regression fence
 * below asserts the corrected name.
 *
 * This test file is static: regex assertions against the migration
 * SQL text + .down.sql. Dynamic DB probes (live-auth RLS, GRANT
 * verification via has_function_privilege, trigger firing under
 * status gates, backfill row-count + signal-quality spot-check)
 * fire during the Migration Dry-Run per R.19 and are recorded in
 * qa-reports/qa-branch2-phase2.8.md.
 *
 * Pattern matches __tests__/milestones-retainage.test.ts (Phase 2.7)
 * and __tests__/approval-chains.test.ts (Phase 2.6).
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

const MIGRATION = "supabase/migrations/00073_pricing_history.sql";
const MIGRATION_DOWN = "supabase/migrations/00073_pricing_history.down.sql";

// ── migration file existence ─────────────────────────────────────────

test("migration 00073 exists", () => {
  assert.ok(existsSync(MIGRATION), `${MIGRATION} missing`);
});

test("migration 00073 has a rollback companion (.down.sql)", () => {
  assert.ok(existsSync(MIGRATION_DOWN), `${MIGRATION_DOWN} missing`);
});

// ── header documentation (Amendments B / C / H / I / J / M + GH #16) ──

test("migration 00073 header cites plan-amendment commit 643b669", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /643b669/i.test(src),
    "header must cite plan-amendment commit 643b669"
  );
});

test("migration 00073 header documents R.23 divergence with activity_log precedent", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /R\.23/i.test(src),
    "header must invoke R.23 framing"
  );
  assert.ok(
    /activity_log/i.test(src),
    "header must cite activity_log as the closest precedent for the 1-policy shape"
  );
  assert.ok(
    /1[- ]policy|one[- ]policy|single[- ]policy|single\s+SELECT/i.test(src),
    "header must characterize the RLS shape as 1-policy / single SELECT"
  );
});

test("migration 00073 header documents Amendment C immutability + correction procedure", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /immutab|append[- ]only/i.test(src),
    "header must document the append-only / immutability contract"
  );
  assert.ok(
    /DELETE\s+FROM\s+public\.pricing_history[\s\S]{0,200}platform[- ]admin|platform[- ]admin[\s\S]{0,200}DELETE\s+FROM\s+public\.pricing_history/i.test(src),
    "header must document the platform-admin service-role DELETE correction path"
  );
  assert.ok(
    /(do\s+not\s+add|prohibited|load[- ]bearing)/i.test(src),
    "header must explicitly warn against adding UPDATE/soft-delete policies"
  );
});

test("migration 00073 header documents Amendment H po_line_items spec correction", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /purchase_order_line_items/i.test(src) && /po_line_items/i.test(src),
    "header must document the Amendment H rename from purchase_order_line_items → po_line_items"
  );
});

test("migration 00073 header documents Amendment I PO parent-entity resolution", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /issued_date/i.test(src),
    "header must reference purchase_orders.issued_date as the PO trigger date source"
  );
  assert.ok(
    /(parent[- ]entity|purchase_orders\.vendor_id|parent\s+PO)/i.test(src),
    "header must describe PO parent-entity resolution for vendor_id"
  );
});

test("migration 00073 header documents Amendment J SECURITY DEFINER + GRANT lineage (00032 / 00067 / 00070)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /SECURITY\s+DEFINER/i.test(src),
    "header must document the SECURITY DEFINER pattern"
  );
  assert.ok(
    /GRANT\s+EXECUTE/i.test(src),
    "header must document the GRANT EXECUTE pattern"
  );
  assert.ok(
    /00032/.test(src) && /00067/.test(src) && /00070/.test(src),
    "header must cite the 00032 → 00067 → 00070 Amendment F.2 GRANT-pattern lineage"
  );
});

test("migration 00073 header documents Amendment M backfill (invoice-only, qa_approved)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /backfill/i.test(src) && /qa_approved/i.test(src),
    "header must document the Amendment M one-time backfill scoped to qa_approved invoices"
  );
});

test("migration 00073 header cites GH #16 signal-quality validation tracker", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /GH\s*#16|issue\s*#16/i.test(src),
    "header must reference GH #16 (Branch 3/4 pricing-intelligence signal-quality gate)"
  );
});

// ── pricing_history table shape (Amendments A / C / E / F) ───────────

test("migration 00073 creates public.pricing_history table", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.pricing_history\s*\(/i.test(src),
    "migration must CREATE TABLE public.pricing_history"
  );
});

test("migration 00073 pricing_history has full column set (Amendments A / C / E / F)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.pricing_history\s*\(([\s\S]*?)\n\)\s*;/i
  );
  assert.ok(match, "could not locate pricing_history CREATE TABLE body");
  const body = match![1];
  const required: Array<[string, RegExp]> = [
    ["id PK uuid", /\bid\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\s*\(\s*\)/i],
    ["org_id NOT NULL FK", /\borg_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.organizations\s*\(\s*id\s*\)/i],
    ["job_id NOT NULL FK", /\bjob_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.jobs\s*\(\s*id\s*\)/i],
    ["source_type NOT NULL CHECK", /\bsource_type\s+TEXT\s+NOT\s+NULL\s+CHECK/i],
    ["source_id NOT NULL", /\bsource_id\s+UUID\s+NOT\s+NULL\b/i],
    ["source_line_id NOT NULL", /\bsource_line_id\s+UUID\s+NOT\s+NULL\b/i],
    ["vendor_id FK", /\bvendor_id\s+UUID\s+REFERENCES\s+public\.vendors\s*\(\s*id\s*\)/i],
    ["cost_code_id FK", /\bcost_code_id\s+UUID\s+REFERENCES\s+public\.cost_codes\s*\(\s*id\s*\)/i],
    ["description NOT NULL", /\bdescription\s+TEXT\s+NOT\s+NULL\b/i],
    ["quantity NUMERIC", /\bquantity\s+NUMERIC\b/i],
    ["unit TEXT", /\bunit\s+TEXT\b/i],
    ["unit_price BIGINT", /\bunit_price\s+BIGINT\b/i],
    ["amount BIGINT NOT NULL", /\bamount\s+BIGINT\s+NOT\s+NULL\b/i],
    ["date DATE NOT NULL", /\bdate\s+DATE\s+NOT\s+NULL\b/i],
    ["canonical_item_id FK items (Amendment E)", /\bcanonical_item_id\s+UUID\s+REFERENCES\s+public\.items\s*\(\s*id\s*\)/i],
    ["match_confidence NUMERIC with 0-1 CHECK (Amendment F)", /\bmatch_confidence\s+NUMERIC\b[\s\S]*?CHECK\s*\([\s\S]*?match_confidence\s*>=\s*0[\s\S]*?match_confidence\s*<=\s*1/i],
    ["created_at NOT NULL DEFAULT now()", /\bcreated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\s*\(\s*\)/i],
    ["created_by FK auth.users (nullable)", /\bcreated_by\s+UUID\s+REFERENCES\s+auth\.users\s*\(\s*id\s*\)/i],
    ["UNIQUE (source_type, source_line_id)", /UNIQUE\s*\(\s*source_type\s*,\s*source_line_id\s*\)/i],
  ];
  for (const [label, re] of required) {
    assert.ok(re.test(body), `pricing_history body must contain ${label}`);
  }
});

test("migration 00073 pricing_history has NO updated_at (Amendment A — append-only)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.pricing_history\s*\(([\s\S]*?)\n\)\s*;/i
  );
  assert.ok(match, "could not locate pricing_history CREATE TABLE body");
  const body = match![1];
  assert.ok(
    !/\bupdated_at\b/i.test(body),
    "pricing_history must NOT have updated_at (Amendment A — append-only, no UPDATE path)"
  );
});

test("migration 00073 pricing_history has NO deleted_at (Amendment C — immutable)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.pricing_history\s*\(([\s\S]*?)\n\)\s*;/i
  );
  assert.ok(match, "could not locate pricing_history CREATE TABLE body");
  const body = match![1];
  assert.ok(
    !/\bdeleted_at\b/i.test(body),
    "pricing_history must NOT have deleted_at (Amendment C — immutability contract; correction is service-role DELETE)"
  );
});

test("migration 00073 pricing_history UNIQUE constraint is full (non-partial) per Amendment C", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // The inline UNIQUE (source_type, source_line_id) inside CREATE TABLE
  // must not carry a WHERE predicate (which would make it partial).
  // A separate CREATE UNIQUE INDEX ... WHERE would also violate Amendment C.
  assert.ok(
    !/CREATE\s+UNIQUE\s+INDEX[\s\S]{0,200}pricing_history[\s\S]{0,200}WHERE\s+deleted_at/i.test(src),
    "pricing_history UNIQUE must be full (non-partial) — Amendment C explicitly rejects a partial WHERE deleted_at IS NULL"
  );
});

test("migration 00073 declares the 4-value source_type CHECK enum", () => {
  const src = readFileSync(MIGRATION, "utf8");
  for (const v of ["invoice", "proposal", "po", "co"]) {
    assert.ok(
      new RegExp(`'${v}'`).test(src),
      `source_type CHECK must include '${v}'`
    );
  }
  assert.ok(
    /source_type\s+IN\s*\(\s*'invoice'\s*,\s*'proposal'\s*,\s*'po'\s*,\s*'co'\s*\)/i.test(src),
    "source_type CHECK must be exactly IN ('invoice','proposal','po','co')"
  );
});

// ── indexes (Amendment G — 3 spec'd + 2 new) ─────────────────────────

test("migration 00073 creates idx_pricing_history_cost_code (org_id, cost_code_id, date DESC)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+INDEX\s+idx_pricing_history_cost_code\s+ON\s+public\.pricing_history\s*\(\s*org_id\s*,\s*cost_code_id\s*,\s*date\s+DESC\s*\)/i.test(src),
    "must create idx_pricing_history_cost_code on (org_id, cost_code_id, date DESC)"
  );
});

test("migration 00073 creates idx_pricing_history_vendor (org_id, vendor_id, date DESC)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+INDEX\s+idx_pricing_history_vendor\s+ON\s+public\.pricing_history\s*\(\s*org_id\s*,\s*vendor_id\s*,\s*date\s+DESC\s*\)/i.test(src),
    "must create idx_pricing_history_vendor on (org_id, vendor_id, date DESC)"
  );
});

test("migration 00073 creates idx_pricing_history_description_trgm GIN trigram index", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+INDEX\s+idx_pricing_history_description_trgm\s+ON\s+public\.pricing_history\s+USING\s+GIN\s*\(\s*description\s+gin_trgm_ops\s*\)/i.test(src),
    "must create idx_pricing_history_description_trgm USING GIN (description gin_trgm_ops)"
  );
});

test("migration 00073 creates idx_pricing_history_job partial index (Amendment G new)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+INDEX\s+idx_pricing_history_job\s+ON\s+public\.pricing_history\s*\(\s*org_id\s*,\s*job_id\s*,\s*date\s+DESC\s*\)\s+WHERE\s+job_id\s+IS\s+NOT\s+NULL/i.test(src),
    "must create idx_pricing_history_job (org_id, job_id, date DESC) WHERE job_id IS NOT NULL (Amendment G)"
  );
});

test("migration 00073 creates idx_pricing_history_source_lookup (org_id, source_type, source_id) (Amendment G new)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+INDEX\s+idx_pricing_history_source_lookup\s+ON\s+public\.pricing_history\s*\(\s*org_id\s*,\s*source_type\s*,\s*source_id\s*\)/i.test(src),
    "must create idx_pricing_history_source_lookup (org_id, source_type, source_id) for trigger idempotency lookups (Amendment G)"
  );
});

// ── RLS (Amendment B — 1-policy R.23 divergence) ─────────────────────

test("migration 00073 enables RLS on pricing_history", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ALTER\s+TABLE\s+public\.pricing_history\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(src),
    "RLS must be enabled on public.pricing_history"
  );
});

test("migration 00073 pricing_history has exactly 1 policy (SELECT only) — R.23 divergence, Amendment B regression fence", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+POLICY\s+pricing_history_org_read\s+ON\s+public\.pricing_history\s+FOR\s+SELECT/i.test(src),
    "must CREATE POLICY pricing_history_org_read FOR SELECT"
  );
  const policyMatches = src.match(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.pricing_history\b/gi
  );
  assert.strictEqual(
    policyMatches?.length,
    1,
    `EXACTLY 1 policy on public.pricing_history required (R.23 divergence — activity_log precedent, trigger-populated audit spine with no lifecycle); found ${policyMatches?.length ?? 0}`
  );
  // Amendment B regression fence: NO INSERT / UPDATE / DELETE policies.
  // Future fixer attempting to silently add a write policy should be
  // blocked by this test. The append-only semantic is load-bearing for
  // pricing-intelligence signal integrity (see migration header).
  assert.ok(
    !/CREATE\s+POLICY\s+\S+\s+ON\s+public\.pricing_history\s+FOR\s+INSERT/i.test(src),
    "NO INSERT policy allowed (Amendment B — service-role SECURITY DEFINER triggers bypass RLS; no app-layer INSERT path)"
  );
  assert.ok(
    !/CREATE\s+POLICY\s+\S+\s+ON\s+public\.pricing_history\s+FOR\s+UPDATE/i.test(src),
    "NO UPDATE policy allowed (Amendment C — append-only immutability contract; correction is service-role DELETE, not UPDATE)"
  );
  assert.ok(
    !/CREATE\s+POLICY\s+\S+\s+ON\s+public\.pricing_history\s+FOR\s+DELETE/i.test(src),
    "NO DELETE policy allowed (correction is platform-admin service-role SQL only — documented in header correction procedure)"
  );
  assert.ok(
    !/CREATE\s+POLICY\s+\S+\s+ON\s+public\.pricing_history\s+FOR\s+ALL/i.test(src),
    "NO FOR ALL policy allowed (would expose write paths the 1-policy shape explicitly rejects)"
  );
});

test("migration 00073 org_read policy allows any active org member + platform admin", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+POLICY\s+pricing_history_org_read\s+ON\s+public\.pricing_history[\s\S]*?;/i
  );
  assert.ok(match, "could not locate pricing_history_org_read policy body");
  const body = match![0];
  assert.ok(
    /public\.org_members[\s\S]*?is_active\s*=\s*true/is.test(body),
    "read policy must filter via org_members / is_active = true (any active org member)"
  );
  assert.ok(
    /is_platform_admin\s*\(\s*\)/i.test(body),
    "read policy must include platform-admin OR bypass"
  );
  // No role-narrowing: pricing history is org-wide reference data.
  // A PM researching pricing for a future bid legitimately needs to
  // see historical pricing across all of the org's jobs.
  assert.ok(
    !/role\s+IN\s*\(/i.test(body),
    "read policy must NOT narrow by role (pricing_history is org-wide reference data — any member should read)"
  );
});

// ── 4 SECURITY DEFINER trigger functions (Amendment J / F.2) ─────────

const TRIGGER_FUNCTIONS = [
  "trg_pricing_history_from_invoice_line",
  "trg_pricing_history_from_proposal_line",
  "trg_pricing_history_from_po_line",
  "trg_pricing_history_from_co_line",
];

test("migration 00073 declares all 4 trigger functions as SECURITY DEFINER with pinned search_path", () => {
  const src = readFileSync(MIGRATION, "utf8");
  for (const fn of TRIGGER_FUNCTIONS) {
    const re = new RegExp(
      `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${fn}\\s*\\(\\s*\\)[\\s\\S]*?LANGUAGE\\s+plpgsql\\s+SECURITY\\s+DEFINER[\\s\\S]*?SET\\s+search_path\\s*=\\s*public\\s*,\\s*pg_temp`,
      "i"
    );
    assert.ok(
      re.test(src),
      `${fn} must be SECURITY DEFINER with SET search_path = public, pg_temp (Amendment J / F.2 — 00032 → 00067 → 00070 lineage)`
    );
  }
});

test("migration 00073 GRANTs EXECUTE on all 4 trigger functions to authenticated (Amendment J / GH #9 defense)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  for (const fn of TRIGGER_FUNCTIONS) {
    const re = new RegExp(
      `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${fn}\\s*\\(\\s*\\)[\\s\\S]*?TO\\s+authenticated`,
      "i"
    );
    assert.ok(
      re.test(src),
      `migration must GRANT EXECUTE ON FUNCTION public.${fn}() TO authenticated (Amendment J — GH #9 latent-permission-gap defense)`
    );
  }
});

test("migration 00073 each trigger function uses ON CONFLICT (source_type, source_line_id) DO NOTHING for idempotency", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const conflictMatches = src.match(
    /ON\s+CONFLICT\s*\(\s*source_type\s*,\s*source_line_id\s*\)\s+DO\s+NOTHING/gi
  );
  assert.ok(
    conflictMatches && conflictMatches.length >= 4,
    `each of 4 trigger functions must use ON CONFLICT (source_type, source_line_id) DO NOTHING; found ${conflictMatches?.length ?? 0} occurrences (4 trigger bodies + 1 backfill = at least 5 expected, but minimum is 4 trigger bodies)`
  );
});

test("migration 00073 each trigger function checks parent-entity status gate before INSERT", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Each of the 4 trigger functions must have a status-gate IF IS DISTINCT
  // FROM <status> RETURN NEW pattern.
  const gates: Array<[string, RegExp]> = [
    ["invoice qa_approved", /status\s+IS\s+DISTINCT\s+FROM\s+'qa_approved'/i],
    ["proposal accepted", /status\s+IS\s+DISTINCT\s+FROM\s+'accepted'/i],
    ["po issued", /status\s+IS\s+DISTINCT\s+FROM\s+'issued'/i],
    ["co approved", /status\s+IS\s+DISTINCT\s+FROM\s+'approved'/i],
  ];
  for (const [label, re] of gates) {
    assert.ok(re.test(src), `missing status gate: ${label}`);
  }
});

// ── 4 CREATE TRIGGER statements (Amendment H — po_line_items rename) ──

test("migration 00073 creates trigger on public.invoice_line_items (AFTER INSERT OR UPDATE)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TRIGGER\s+trg_invoice_line_items_pricing_history\s+AFTER\s+INSERT\s+OR\s+UPDATE\s+ON\s+public\.invoice_line_items\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.trg_pricing_history_from_invoice_line\s*\(\s*\)/is.test(src),
    "must register AFTER INSERT OR UPDATE trigger on public.invoice_line_items"
  );
});

test("migration 00073 creates trigger on public.proposal_line_items (AFTER INSERT OR UPDATE)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TRIGGER\s+trg_proposal_line_items_pricing_history\s+AFTER\s+INSERT\s+OR\s+UPDATE\s+ON\s+public\.proposal_line_items\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.trg_pricing_history_from_proposal_line\s*\(\s*\)/is.test(src),
    "must register AFTER INSERT OR UPDATE trigger on public.proposal_line_items"
  );
});

test("migration 00073 creates trigger on public.po_line_items (Amendment H defect guard — NOT purchase_order_line_items)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TRIGGER\s+trg_po_line_items_pricing_history\s+AFTER\s+INSERT\s+OR\s+UPDATE\s+ON\s+public\.po_line_items\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.trg_pricing_history_from_po_line\s*\(\s*\)/is.test(src),
    "must register AFTER INSERT OR UPDATE trigger on public.po_line_items (Amendment H — canonical name)"
  );
  // Amendment H defect guard: the original spec used
  // purchase_order_line_items which does not exist. This assertion
  // prevents a future reverter from reintroducing the defect.
  assert.ok(
    !/CREATE\s+TRIGGER[\s\S]{0,200}\bpublic\.purchase_order_line_items\b/i.test(src),
    "Amendment H defect guard — must NOT reference purchase_order_line_items as a trigger target (table does not exist; canonical name is po_line_items)"
  );
});

test("migration 00073 creates trigger on public.change_order_lines (AFTER INSERT OR UPDATE)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TRIGGER\s+trg_change_order_lines_pricing_history\s+AFTER\s+INSERT\s+OR\s+UPDATE\s+ON\s+public\.change_order_lines\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.trg_pricing_history_from_co_line\s*\(\s*\)/is.test(src),
    "must register AFTER INSERT OR UPDATE trigger on public.change_order_lines"
  );
});

// ── PO trigger parent-entity resolution (Amendment I) ─────────────────

test("migration 00073 PO trigger function resolves vendor_id and date from parent purchase_orders (Amendment I)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.trg_pricing_history_from_po_line\s*\(\s*\)[\s\S]*?\$\$\s*;/i
  );
  assert.ok(match, "could not locate PO trigger function body");
  const body = match![0];
  // vendor_id resolved from parent PO
  assert.ok(
    /FROM\s+public\.purchase_orders/i.test(body),
    "PO trigger must SELECT FROM public.purchase_orders to resolve parent-entity fields"
  );
  // date resolved via issued_date with created_at fallback
  assert.ok(
    /issued_date/i.test(body),
    "PO trigger must reference purchase_orders.issued_date (pre-flight probe confirmed this is the PO-date column, no po_date)"
  );
  assert.ok(
    /COALESCE\s*\([\s\S]*?issued_date[\s\S]*?created_at/i.test(body),
    "PO trigger must use COALESCE(issued_date, created_at::date) as the date fallback (Amendment I)"
  );
});

test("migration 00073 PO trigger inserts NULL for quantity/unit/unit_price (Amendment I — po_line_items column asymmetry)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.trg_pricing_history_from_po_line\s*\(\s*\)[\s\S]*?\$\$\s*;/i
  );
  assert.ok(match, "could not locate PO trigger function body");
  const body = match![0];
  // The INSERT VALUES clause must pass NULL for quantity, unit, unit_price
  // (three consecutive NULLs in that positional slot). po_line_items does
  // not carry those columns — Amendment I documents the asymmetry.
  assert.ok(
    /VALUES\s*\([\s\S]*?NULL\s*,\s*NULL\s*,\s*NULL\s*,/i.test(body),
    "PO trigger INSERT VALUES must pass NULL, NULL, NULL for quantity/unit/unit_price (Amendment I — po_line_items asymmetry vs invoice_line_items)"
  );
});

test("migration 00073 PO trigger has COMMENT ON FUNCTION documenting Amendment I asymmetry", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /COMMENT\s+ON\s+FUNCTION\s+public\.trg_pricing_history_from_po_line\s*\(\s*\)\s+IS[\s\S]*?;/i
  );
  assert.ok(
    match,
    "migration must COMMENT ON FUNCTION public.trg_pricing_history_from_po_line() documenting the Amendment I parent-entity resolution + po_line_items asymmetry"
  );
  const body = match![0];
  assert.ok(
    /po_line_items/i.test(body),
    "PO trigger COMMENT must reference po_line_items (the canonical table name)"
  );
});

// ── Backfill (Amendment M — invoice-only, qa_approved) ───────────────

test("migration 00073 backfills pricing_history from invoice_line_items where parent invoices.status = qa_approved (Amendment M)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /INSERT\s+INTO\s+public\.pricing_history[\s\S]*?SELECT[\s\S]*?FROM\s+public\.invoice_line_items\s+ili[\s\S]*?JOIN\s+public\.invoices\s+i\s+ON\s+i\.id\s*=\s*ili\.invoice_id[\s\S]*?WHERE\s+i\.status\s*=\s*'qa_approved'/is.test(src),
    "backfill must INSERT INTO pricing_history SELECT FROM invoice_line_items JOIN invoices WHERE status = 'qa_approved' (Amendment M)"
  );
});

test("migration 00073 backfill excludes soft-deleted invoices", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Anchor on the backfill INSERT SELECT block
  const match = src.match(
    /INSERT\s+INTO\s+public\.pricing_history[\s\S]*?SELECT[\s\S]*?FROM\s+public\.invoice_line_items[\s\S]*?ON\s+CONFLICT[\s\S]*?DO\s+NOTHING\s*;/i
  );
  assert.ok(match, "could not locate backfill INSERT...SELECT block");
  assert.ok(
    /i\.deleted_at\s+IS\s+NULL/i.test(match![0]),
    "backfill must filter invoices by deleted_at IS NULL (don't seed from soft-deleted parents)"
  );
});

test("migration 00073 backfill uses ON CONFLICT (source_type, source_line_id) DO NOTHING for idempotency", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /INSERT\s+INTO\s+public\.pricing_history[\s\S]*?FROM\s+public\.invoice_line_items[\s\S]*?ON\s+CONFLICT[\s\S]*?DO\s+NOTHING\s*;/i
  );
  assert.ok(match, "could not locate backfill INSERT...SELECT block");
  assert.ok(
    /ON\s+CONFLICT\s*\(\s*source_type\s*,\s*source_line_id\s*\)\s+DO\s+NOTHING/i.test(match![0]),
    "backfill ON CONFLICT must target (source_type, source_line_id) DO NOTHING"
  );
});

// ── COMMENTs (Amendment N) ──────────────────────────────────────────

test("migration 00073 adds COMMENT ON TABLE documenting R.23 divergence + activity_log + immutability + GH #16", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /COMMENT\s+ON\s+TABLE\s+public\.pricing_history\s+IS[\s\S]*?;/i
  );
  assert.ok(match, "migration must COMMENT ON TABLE public.pricing_history");
  const body = match![0];
  assert.ok(
    /R\.23/i.test(body),
    "table COMMENT must cite R.23 divergence"
  );
  assert.ok(
    /activity_log/i.test(body),
    "table COMMENT must cite activity_log precedent"
  );
  assert.ok(
    /immutab|append[- ]only/i.test(body),
    "table COMMENT must document immutability / append-only contract"
  );
  assert.ok(
    /GH\s*#16/i.test(body),
    "table COMMENT must cite GH #16 signal-quality validation tracker"
  );
});

test("migration 00073 adds COMMENT ON COLUMN pricing_history.canonical_item_id documenting Branch 3/4 matching", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /COMMENT\s+ON\s+COLUMN\s+public\.pricing_history\.canonical_item_id\s+IS[\s\S]*?;/i
  );
  assert.ok(match, "migration must COMMENT ON COLUMN canonical_item_id");
  assert.ok(
    /Branch\s*3\/?4|cost[- ]intelligence|public\.items/i.test(match![0]),
    "canonical_item_id COMMENT must reference Branch 3/4 matching logic / cost-intelligence spine"
  );
});

test("migration 00073 adds COMMENT ON COLUMN pricing_history.match_confidence documenting 0-1 range (Amendment F)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /COMMENT\s+ON\s+COLUMN\s+public\.pricing_history\.match_confidence\s+IS[\s\S]*?;/i
  );
  assert.ok(match, "migration must COMMENT ON COLUMN match_confidence");
  assert.ok(
    /0\s*,\s*1|0[- ]1|items\.ai_confidence/i.test(match![0]),
    "match_confidence COMMENT must document 0-1 range / items.ai_confidence convention (Amendment F)"
  );
});

// ── down migration (Amendment K) ─────────────────────────────────────

test("00073.down.sql reverses in strict reverse-dependency order", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");

  // 4 triggers must be dropped first (depend on functions)
  for (const trg of [
    "trg_change_order_lines_pricing_history",
    "trg_po_line_items_pricing_history",
    "trg_proposal_line_items_pricing_history",
    "trg_invoice_line_items_pricing_history",
  ]) {
    assert.ok(
      new RegExp(`DROP\\s+TRIGGER\\s+IF\\s+EXISTS\\s+${trg}\\b`, "i").test(src),
      `down must DROP TRIGGER IF EXISTS ${trg}`
    );
  }

  // 4 trigger functions dropped after their triggers
  for (const fn of TRIGGER_FUNCTIONS) {
    assert.ok(
      new RegExp(`DROP\\s+FUNCTION\\s+IF\\s+EXISTS\\s+public\\.${fn}\\s*\\(\\s*\\)`, "i").test(src),
      `down must DROP FUNCTION IF EXISTS public.${fn}()`
    );
  }

  // 1 policy dropped
  assert.ok(
    /DROP\s+POLICY\s+IF\s+EXISTS\s+pricing_history_org_read\s+ON\s+public\.pricing_history/i.test(src),
    "down must DROP POLICY IF EXISTS pricing_history_org_read"
  );

  // RLS disabled
  assert.ok(
    /ALTER\s+TABLE\s+public\.pricing_history\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(src),
    "down must DISABLE RLS on pricing_history"
  );

  // 5 indexes dropped
  for (const idx of [
    "idx_pricing_history_source_lookup",
    "idx_pricing_history_job",
    "idx_pricing_history_description_trgm",
    "idx_pricing_history_vendor",
    "idx_pricing_history_cost_code",
  ]) {
    assert.ok(
      new RegExp(`DROP\\s+INDEX\\s+IF\\s+EXISTS\\s+${idx}\\b`, "i").test(src),
      `down must DROP INDEX IF EXISTS ${idx}`
    );
  }

  // Table dropped last
  assert.ok(
    /DROP\s+TABLE\s+IF\s+EXISTS\s+public\.pricing_history\b/i.test(src),
    "down must DROP TABLE IF EXISTS public.pricing_history"
  );

  // Ordering: triggers → functions → table (reverse-dependency)
  const firstTriggerDropIdx = src.search(
    /DROP\s+TRIGGER\s+IF\s+EXISTS\s+trg_\w+_pricing_history/i
  );
  const firstFnDropIdx = src.search(
    /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.trg_pricing_history_/i
  );
  const tableDropIdx = src.search(
    /DROP\s+TABLE\s+IF\s+EXISTS\s+public\.pricing_history\b/i
  );
  assert.ok(
    firstTriggerDropIdx >= 0 && firstFnDropIdx >= 0 && tableDropIdx >= 0,
    "down must contain trigger drops, function drops, and table drop"
  );
  assert.ok(
    firstTriggerDropIdx < firstFnDropIdx,
    "triggers must be dropped BEFORE functions (reverse-dependency order)"
  );
  assert.ok(
    firstFnDropIdx < tableDropIdx,
    "functions must be dropped BEFORE table (functions reference table via INSERT)"
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
