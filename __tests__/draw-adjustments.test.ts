/**
 * Phase 2.5 regression fence — R.15.
 *
 * Migration 00069 adds two new public-schema tables:
 *   - public.draw_adjustments        (first-class draw-level adjustments)
 *   - public.draw_adjustment_line_items (N:N join for rare multi-line
 *                                         allocations)
 *
 * Scope pivot (2026-04-22): Phase 2.5 was reassigned from approval_chains
 * to draw_adjustments after the 2026-04-14 Markgraf substantial-completion
 * email surfaced 9+ distinct adjustment events on one draw with no clean
 * entity to track. Approval chains work moved to Phase 2.6 / migration
 * 00070. See qa-reports/preflight-branch2-phase2.5.md (commit 053f647)
 * and the amended plan spec (commit 73eaba8).
 *
 * This test file is static: regex assertions against the migration SQL
 * text + .down.sql. Dynamic DB probes (live-auth RLS, Markgraf fixtures,
 * enum acceptance, status-workflow transitions) fire during the Migration
 * Dry-Run per R.19 and are recorded in qa-reports/qa-branch2-phase2.5.md.
 *
 * Pattern matches __tests__/cost-codes-hierarchy.test.ts (Phase 2.4) and
 * __tests__/proposals-schema.test.ts (Phase 2.2).
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

const MIGRATION = "supabase/migrations/00069_draw_adjustments.sql";
const MIGRATION_DOWN = "supabase/migrations/00069_draw_adjustments.down.sql";

// ── migration file existence ─────────────────────────────────────────

test("migration 00069 exists", () => {
  assert.ok(existsSync(MIGRATION), `${MIGRATION} missing`);
});

test("migration 00069 has a rollback companion (.down.sql)", () => {
  assert.ok(existsSync(MIGRATION_DOWN), `${MIGRATION_DOWN} missing`);
});

// ── header documentation (scope pivot + C.1, C.2, D2, GH #13) ──

test("migration 00069 header documents the Markgraf scope pivot + preflight cite", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /markgraf/i.test(src),
    "header must reference the Markgraf scenario (scope-pivot source)"
  );
  assert.ok(
    /approval_chains/i.test(src) && /Phase\s*2\.6/i.test(src),
    "header must cite the approval_chains → Phase 2.6 / migration 00070 shift"
  );
});

test("migration 00069 header documents C.1 RLS surgical narrowing rationale", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /proposals/i.test(src) && /00065/.test(src),
    "header must cite the proposals / 00065 precedent (R.23)"
  );
  assert.ok(
    /R\.23/i.test(src),
    "header must invoke R.23 framing"
  );
  assert.ok(
    /pm[- ]on[- ]own[- ]jobs|pm_id\s*=\s*auth\.uid|information (leak|parity)/i.test(
      src
    ),
    "header must document the PM-on-own-jobs surgical predicate narrowing"
  );
});

test("migration 00069 header documents C.2 draw soft-delete invariant", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /soft[- ]delete/i.test(src),
    "header must document the soft-delete invariant"
  );
  assert.ok(
    /Branch\s*3/i.test(src),
    "header must cite Branch 3 as the writer owner of the invariant"
  );
  assert.ok(
    /cascade[s]?\s+don['’]t\s+(trigger|fire)\s+on\s+UPDATE|FK cascades don['’]t\s+(trigger|fire)/i.test(
      src
    ),
    "header must explain that FK cascades don't fire on UPDATE (hence application-layer enforcement)"
  );
});

test("migration 00069 header documents D2 G702/G703 rendering note", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Either in header or COMMENT ON TABLE — both live inside the same file.
  assert.ok(
    /G702|G703|Adjustments\s*&\s*Credits|AIA\s+auditability/i.test(src),
    "migration must reference the G702/G703 / Adjustments & Credits rendering decision (D2)"
  );
});

test("migration 00069 header documents GH #13 CO-numbering tech-debt pointer", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /GH\s*#13|issue\s*#13/i.test(src),
    "migration must cite GH #13 as the CO-numbering reconciliation tracker"
  );
});

test("migration 00069 header documents the 'conditional' naming-collision note", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Only a loose requirement — either header comment or COMMENT ON COLUMN.
  assert.ok(
    /lien_releases|conditional_progress|conditional_final/i.test(src),
    "migration must reference lien_releases release_type values to document the 'conditional' name-collision"
  );
});

// ── draw_adjustments table shape ─────────────────────────────────────

test("migration 00069 creates public.draw_adjustments table", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.draw_adjustments\s*\(/i.test(
      src
    ),
    "migration must CREATE TABLE public.draw_adjustments"
  );
});

test("migration 00069 draw_adjustments has all required columns", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.draw_adjustments\s*\(([\s\S]*?)\n\)\s*;/i
  );
  assert.ok(match, "could not locate draw_adjustments CREATE TABLE body");
  const body = match![1];
  const required: Array<[string, RegExp]> = [
    ["id PK uuid", /\bid\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\s*\(\s*\)/i],
    ["org_id NOT NULL FK", /\borg_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.organizations\s*\(\s*id\s*\)/i],
    ["draw_id NOT NULL FK", /\bdraw_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.draws\s*\(\s*id\s*\)/i],
    ["draw_line_item_id nullable FK", /\bdraw_line_item_id\s+UUID\s+REFERENCES\s+public\.draw_line_items\s*\(\s*id\s*\)/i],
    ["adjustment_type NOT NULL w/ CHECK", /\badjustment_type\s+TEXT\s+NOT\s+NULL\s+CHECK/i],
    ["adjustment_status NOT NULL w/ CHECK + DEFAULT", /\badjustment_status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'proposed'\s*\n\s*CHECK/i],
    ["amount_cents BIGINT NOT NULL", /\bamount_cents\s+BIGINT\s+NOT\s+NULL\b/i],
    ["gp_impact_cents BIGINT nullable", /\bgp_impact_cents\s+BIGINT\b/i],
    ["reason TEXT NOT NULL", /\breason\s+TEXT\s+NOT\s+NULL\b/i],
    ["affected_vendor_id FK", /\baffected_vendor_id\s+UUID\s+REFERENCES\s+public\.vendors\s*\(\s*id\s*\)/i],
    ["affected_invoice_id FK", /\baffected_invoice_id\s+UUID\s+REFERENCES\s+public\.invoices\s*\(\s*id\s*\)/i],
    ["affected_pcco_number TEXT", /\baffected_pcco_number\s+TEXT\b/i],
    ["source_document_id UUID bare (no REFERENCES)", /\bsource_document_id\s+UUID\b/i],
    ["status_history JSONB NOT NULL DEFAULT '[]'", /\bstatus_history\s+JSONB\s+NOT\s+NULL\s+DEFAULT\s+'\[\]'::jsonb/i],
    ["created_at NOT NULL DEFAULT now()", /\bcreated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i],
    ["updated_at NOT NULL DEFAULT now()", /\bupdated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i],
    ["created_by FK auth.users", /\bcreated_by\s+UUID\s+REFERENCES\s+auth\.users\s*\(\s*id\s*\)/i],
    ["deleted_at TIMESTAMPTZ", /\bdeleted_at\s+TIMESTAMPTZ\b/i],
  ];
  for (const [label, re] of required) {
    assert.ok(re.test(body), `draw_adjustments body must contain ${label}`);
  }
});

test("migration 00069 source_document_id is BARE UUID (no REFERENCES) per Phase 2.2 precedent", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.draw_adjustments\s*\(([\s\S]*?)\n\)\s*;/i
  );
  assert.ok(match, "could not locate draw_adjustments CREATE TABLE body");
  const body = match![1];
  // source_document_id should appear, and the line it's on must NOT have REFERENCES.
  const srcDocLine = body
    .split(/\n/)
    .find((l) => /source_document_id/.test(l));
  assert.ok(srcDocLine, "source_document_id column not found in body");
  assert.ok(
    !/REFERENCES/i.test(srcDocLine!),
    "source_document_id must be bare UUID (Phase 2.2 precedent; FK wire-up deferred to Branch 3 / document_extractions)"
  );
});

test("migration 00069 declares the 7-value adjustment_type CHECK enum", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const expected = [
    "correction",
    "credit_goodwill",
    "credit_defect",
    "credit_error",
    "withhold",
    "customer_direct_pay",
    "conditional",
  ];
  for (const v of expected) {
    assert.ok(
      new RegExp(`'${v}'`).test(src),
      `adjustment_type CHECK must include '${v}'`
    );
  }
});

test("migration 00069 declares the 5-value adjustment_status CHECK enum", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const expected = [
    "proposed",
    "approved",
    "applied_to_draw",
    "resolved",
    "voided",
  ];
  for (const v of expected) {
    assert.ok(
      new RegExp(`'${v}'`).test(src),
      `adjustment_status CHECK must include '${v}'`
    );
  }
});

test("migration 00069 registers trg_draw_adjustments_updated_at trigger", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TRIGGER\s+trg_draw_adjustments_updated_at\s+BEFORE\s+UPDATE\s+ON\s+public\.draw_adjustments\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.update_updated_at\s*\(\s*\)/is.test(
      src
    ),
    "migration must register trg_draw_adjustments_updated_at using public.update_updated_at()"
  );
});

// ── draw_adjustment_line_items (join) shape ──────────────────────────

test("migration 00069 creates public.draw_adjustment_line_items join table", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.draw_adjustment_line_items\s*\(/i.test(
      src
    ),
    "migration must CREATE TABLE public.draw_adjustment_line_items"
  );
});

test("migration 00069 draw_adjustment_line_items has all required columns", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.draw_adjustment_line_items\s*\(([\s\S]*?)\n\)\s*;/i
  );
  assert.ok(
    match,
    "could not locate draw_adjustment_line_items CREATE TABLE body"
  );
  const body = match![1];
  const required: Array<[string, RegExp]> = [
    ["id PK uuid", /\bid\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\s*\(\s*\)/i],
    ["org_id NOT NULL FK", /\borg_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.organizations\s*\(\s*id\s*\)/i],
    ["adjustment_id FK CASCADE", /\badjustment_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.draw_adjustments\s*\(\s*id\s*\)\s*\n?\s*ON\s+DELETE\s+CASCADE/i],
    ["draw_line_item_id FK NOT NULL", /\bdraw_line_item_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.draw_line_items\s*\(\s*id\s*\)/i],
    ["allocation_cents BIGINT NOT NULL", /\ballocation_cents\s+BIGINT\s+NOT\s+NULL\b/i],
    ["created_at NOT NULL DEFAULT now()", /\bcreated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i],
    ["updated_at NOT NULL DEFAULT now()", /\bupdated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i],
    ["created_by FK", /\bcreated_by\s+UUID\s+REFERENCES\s+auth\.users\s*\(\s*id\s*\)/i],
    ["deleted_at TIMESTAMPTZ", /\bdeleted_at\s+TIMESTAMPTZ\b/i],
  ];
  for (const [label, re] of required) {
    assert.ok(
      re.test(body),
      `draw_adjustment_line_items body must contain ${label}`
    );
  }
});

test("migration 00069 registers trg_draw_adjustment_line_items_updated_at trigger", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TRIGGER\s+trg_draw_adjustment_line_items_updated_at\s+BEFORE\s+UPDATE\s+ON\s+public\.draw_adjustment_line_items\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.update_updated_at\s*\(\s*\)/is.test(
      src
    ),
    "migration must register trg_draw_adjustment_line_items_updated_at using public.update_updated_at()"
  );
});

// ── indexes (7 total, all partial on deleted_at IS NULL) ─────────────

test("migration 00069 creates the 7 documented indexes with soft-delete-safe partial predicates", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const required: Array<[string, RegExp]> = [
    [
      "idx_draw_adjustments_draw (org_id, draw_id) WHERE deleted_at IS NULL",
      /CREATE\s+INDEX\s+idx_draw_adjustments_draw\s+ON\s+public\.draw_adjustments\s*\(\s*org_id\s*,\s*draw_id\s*\)\s+WHERE\s+deleted_at\s+IS\s+NULL/is,
    ],
    [
      "idx_draw_adjustments_status (org_id, adjustment_status) WHERE deleted_at IS NULL",
      /CREATE\s+INDEX\s+idx_draw_adjustments_status\s+ON\s+public\.draw_adjustments\s*\(\s*org_id\s*,\s*adjustment_status\s*\)\s+WHERE\s+deleted_at\s+IS\s+NULL/is,
    ],
    [
      "idx_draw_adjustments_line_item (draw_line_item_id) partial with NOT NULL + deleted_at IS NULL",
      /CREATE\s+INDEX\s+idx_draw_adjustments_line_item\s+ON\s+public\.draw_adjustments\s*\(\s*draw_line_item_id\s*\)\s+WHERE\s+draw_line_item_id\s+IS\s+NOT\s+NULL\s+AND\s+deleted_at\s+IS\s+NULL/is,
    ],
    [
      "idx_draw_adjustments_vendor (affected_vendor_id) partial with NOT NULL + deleted_at IS NULL",
      /CREATE\s+INDEX\s+idx_draw_adjustments_vendor\s+ON\s+public\.draw_adjustments\s*\(\s*affected_vendor_id\s*\)\s+WHERE\s+affected_vendor_id\s+IS\s+NOT\s+NULL\s+AND\s+deleted_at\s+IS\s+NULL/is,
    ],
    [
      "idx_draw_adjustments_invoice (affected_invoice_id) partial with NOT NULL + deleted_at IS NULL",
      /CREATE\s+INDEX\s+idx_draw_adjustments_invoice\s+ON\s+public\.draw_adjustments\s*\(\s*affected_invoice_id\s*\)\s+WHERE\s+affected_invoice_id\s+IS\s+NOT\s+NULL\s+AND\s+deleted_at\s+IS\s+NULL/is,
    ],
    [
      "idx_dali_adjustment (adjustment_id) partial on deleted_at IS NULL",
      /CREATE\s+INDEX\s+idx_dali_adjustment\s+ON\s+public\.draw_adjustment_line_items\s*\(\s*adjustment_id\s*\)\s+WHERE\s+deleted_at\s+IS\s+NULL/is,
    ],
    [
      "idx_dali_draw_line_item (draw_line_item_id) partial on deleted_at IS NULL",
      /CREATE\s+INDEX\s+idx_dali_draw_line_item\s+ON\s+public\.draw_adjustment_line_items\s*\(\s*draw_line_item_id\s*\)\s+WHERE\s+deleted_at\s+IS\s+NULL/is,
    ],
  ];
  for (const [label, re] of required) {
    assert.ok(re.test(src), `migration must declare ${label}`);
  }
});

// ── RLS — enable + 3 policies per table, no DELETE ────────────────────

test("migration 00069 enables RLS on both new tables", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ALTER\s+TABLE\s+public\.draw_adjustments\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(
      src
    ),
    "RLS must be enabled on public.draw_adjustments"
  );
  assert.ok(
    /ALTER\s+TABLE\s+public\.draw_adjustment_line_items\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(
      src
    ),
    "RLS must be enabled on public.draw_adjustment_line_items"
  );
});

test("migration 00069 draw_adjustments has exactly 3 policies (read / insert / update) — no DELETE (00065 precedent)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+POLICY\s+draw_adjustments_org_read\s+ON\s+public\.draw_adjustments\s+FOR\s+SELECT/i.test(
      src
    ),
    "must CREATE POLICY draw_adjustments_org_read FOR SELECT"
  );
  assert.ok(
    /CREATE\s+POLICY\s+draw_adjustments_org_insert\s+ON\s+public\.draw_adjustments\s+FOR\s+INSERT/i.test(
      src
    ),
    "must CREATE POLICY draw_adjustments_org_insert FOR INSERT"
  );
  assert.ok(
    /CREATE\s+POLICY\s+draw_adjustments_org_update\s+ON\s+public\.draw_adjustments\s+FOR\s+UPDATE/i.test(
      src
    ),
    "must CREATE POLICY draw_adjustments_org_update FOR UPDATE"
  );
  // Regression guard: exactly 3 draw_adjustments policies, no DELETE.
  const policyMatches = src.match(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.draw_adjustments\b/gi
  );
  assert.strictEqual(
    policyMatches?.length,
    3,
    `exactly 3 policies on public.draw_adjustments required (00065 proposals precedent); found ${policyMatches?.length ?? 0}`
  );
  assert.ok(
    !/CREATE\s+POLICY\s+\S+\s+ON\s+public\.draw_adjustments\s+FOR\s+DELETE/i.test(
      src
    ),
    "NO DELETE policy allowed (soft-delete via deleted_at; hard DELETE RLS-blocked by default)"
  );
});

test("migration 00069 draw_adjustment_line_items has exactly 3 policies (read / insert / update) — no DELETE", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+POLICY\s+draw_adjustment_line_items_org_read\s+ON\s+public\.draw_adjustment_line_items\s+FOR\s+SELECT/i.test(
      src
    ),
    "must CREATE POLICY draw_adjustment_line_items_org_read FOR SELECT"
  );
  assert.ok(
    /CREATE\s+POLICY\s+draw_adjustment_line_items_org_insert\s+ON\s+public\.draw_adjustment_line_items\s+FOR\s+INSERT/i.test(
      src
    ),
    "must CREATE POLICY draw_adjustment_line_items_org_insert FOR INSERT"
  );
  assert.ok(
    /CREATE\s+POLICY\s+draw_adjustment_line_items_org_update\s+ON\s+public\.draw_adjustment_line_items\s+FOR\s+UPDATE/i.test(
      src
    ),
    "must CREATE POLICY draw_adjustment_line_items_org_update FOR UPDATE"
  );
  const policyMatches = src.match(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.draw_adjustment_line_items\b/gi
  );
  assert.strictEqual(
    policyMatches?.length,
    3,
    `exactly 3 policies on public.draw_adjustment_line_items required; found ${policyMatches?.length ?? 0}`
  );
});

test("migration 00069 read policy narrows PMs via EXISTS subquery on draws + jobs (C.1 option b)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+POLICY\s+draw_adjustments_org_read\s+ON\s+public\.draw_adjustments[\s\S]*?;/i
  );
  assert.ok(match, "could not locate draw_adjustments_org_read policy body");
  const body = match![0];
  assert.ok(
    /EXISTS\s*\([\s\S]*?public\.draws[\s\S]*?public\.jobs[\s\S]*?pm_id\s*=\s*auth\.uid\(\)/is.test(
      body
    ),
    "read policy must include the PM-on-own-jobs EXISTS subquery traversing draws → jobs → pm_id"
  );
  assert.ok(
    /app_private\.user_role\(\)\s*=\s*'pm'/i.test(body),
    "read policy must gate PM narrowing on user_role() = 'pm'"
  );
  assert.ok(
    /user_role\(\)\s+IN\s*\(\s*'owner'\s*,\s*'admin'\s*,\s*'accounting'\s*\)/i.test(
      body
    ),
    "read policy must let owner/admin/accounting read without the PM EXISTS narrowing"
  );
  assert.ok(
    /is_platform_admin\(\)/i.test(body),
    "read policy must include platform-admin OR bypass"
  );
});

test("migration 00069 write policies gate on role IN ('owner','admin','pm','accounting')", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const insertMatch = src.match(
    /CREATE\s+POLICY\s+draw_adjustments_org_insert[\s\S]*?;/i
  );
  const updateMatch = src.match(
    /CREATE\s+POLICY\s+draw_adjustments_org_update[\s\S]*?;/i
  );
  assert.ok(insertMatch, "missing draw_adjustments_org_insert policy");
  assert.ok(updateMatch, "missing draw_adjustments_org_update policy");
  for (const body of [insertMatch![0], updateMatch![0]]) {
    assert.ok(
      /role\s+IN\s*\(\s*'owner'\s*,\s*'admin'\s*,\s*'pm'\s*,\s*'accounting'\s*\)/i.test(
        body
      ),
      "write policies must gate on role IN ('owner','admin','pm','accounting') (C.1 scope)"
    );
  }
});

test("migration 00069 join-table read policy narrows PMs via adjustment_id → draw_adjustments → draws → jobs chain", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+POLICY\s+draw_adjustment_line_items_org_read[\s\S]*?;/i
  );
  assert.ok(
    match,
    "could not locate draw_adjustment_line_items_org_read policy"
  );
  const body = match![0];
  // Must reach draw_adjustments → draws → jobs for PM narrowing.
  assert.ok(
    /draw_adjustments[\s\S]*?draws[\s\S]*?jobs[\s\S]*?pm_id\s*=\s*auth\.uid\(\)/is.test(
      body
    ),
    "join-table read policy must traverse adjustment_id → draw_adjustments → draws → jobs → pm_id for PM narrowing"
  );
});

// ── COMMENTs on key columns ──────────────────────────────────────────

test("migration 00069 adds COMMENT ON COLUMN for affected_pcco_number citing GH #13", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /COMMENT\s+ON\s+COLUMN\s+public\.draw_adjustments\.affected_pcco_number\s+IS[\s\S]*?;/i
  );
  assert.ok(
    match,
    "migration must COMMENT ON COLUMN public.draw_adjustments.affected_pcco_number"
  );
  assert.ok(
    /GH\s*#13/i.test(match![0]),
    "affected_pcco_number comment must cite GH #13"
  );
});

test("migration 00069 adds COMMENT ON COLUMN for adjustment_type noting naming-collision with lien_releases.release_type", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /COMMENT\s+ON\s+COLUMN\s+public\.draw_adjustments\.adjustment_type\s+IS[\s\S]*?;/i
  );
  assert.ok(
    match,
    "migration must COMMENT ON COLUMN public.draw_adjustments.adjustment_type"
  );
  assert.ok(
    /lien_releases|conditional_progress|conditional_final/i.test(match![0]),
    "adjustment_type comment must cite lien_releases.release_type name-collision"
  );
});

test("migration 00069 adds COMMENT ON COLUMN for source_document_id citing Phase 2.2 precedent", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /COMMENT\s+ON\s+COLUMN\s+public\.draw_adjustments\.source_document_id\s+IS[\s\S]*?;/i
  );
  assert.ok(
    match,
    "migration must COMMENT ON COLUMN public.draw_adjustments.source_document_id"
  );
  assert.ok(
    /Phase\s*2\.2|document_extractions/i.test(match![0]),
    "source_document_id comment must cite Phase 2.2 precedent or document_extractions deferral"
  );
});

test("migration 00069 adds COMMENT ON TABLE documenting D2 + C.1 + C.2 posture", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /COMMENT\s+ON\s+TABLE\s+public\.draw_adjustments\s+IS[\s\S]*?;/i
  );
  assert.ok(match, "migration must COMMENT ON TABLE public.draw_adjustments");
  const body = match![0];
  assert.ok(
    /D2|Adjustments\s*&\s*Credits|G702|G703/i.test(body),
    "table comment must reference D2 rendering rule"
  );
  assert.ok(
    /proposals|00065|R\.23/i.test(body),
    "table comment must cite the proposals / 00065 / R.23 precedent"
  );
});

// ── down migration ────────────────────────────────────────────────────

test("00069.down.sql drops policies, disables RLS, drops triggers, indexes, and tables in reverse order", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");

  // Policies dropped before DISABLE RLS and before table DROP.
  const policies = [
    /DROP\s+POLICY\s+IF\s+EXISTS\s+draw_adjustments_org_update\s+ON\s+public\.draw_adjustments/i,
    /DROP\s+POLICY\s+IF\s+EXISTS\s+draw_adjustments_org_insert\s+ON\s+public\.draw_adjustments/i,
    /DROP\s+POLICY\s+IF\s+EXISTS\s+draw_adjustments_org_read\s+ON\s+public\.draw_adjustments/i,
    /DROP\s+POLICY\s+IF\s+EXISTS\s+draw_adjustment_line_items_org_update\s+ON\s+public\.draw_adjustment_line_items/i,
    /DROP\s+POLICY\s+IF\s+EXISTS\s+draw_adjustment_line_items_org_insert\s+ON\s+public\.draw_adjustment_line_items/i,
    /DROP\s+POLICY\s+IF\s+EXISTS\s+draw_adjustment_line_items_org_read\s+ON\s+public\.draw_adjustment_line_items/i,
  ];
  for (const re of policies) {
    assert.ok(re.test(src), `down must include ${re}`);
  }

  assert.ok(
    /ALTER\s+TABLE\s+public\.draw_adjustments\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(
      src
    ),
    "down must DISABLE RLS on draw_adjustments"
  );
  assert.ok(
    /ALTER\s+TABLE\s+public\.draw_adjustment_line_items\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(
      src
    ),
    "down must DISABLE RLS on draw_adjustment_line_items"
  );
  assert.ok(
    /DROP\s+TRIGGER\s+IF\s+EXISTS\s+trg_draw_adjustments_updated_at/i.test(
      src
    ),
    "down must DROP TRIGGER trg_draw_adjustments_updated_at"
  );
  assert.ok(
    /DROP\s+TRIGGER\s+IF\s+EXISTS\s+trg_draw_adjustment_line_items_updated_at/i.test(
      src
    ),
    "down must DROP TRIGGER trg_draw_adjustment_line_items_updated_at"
  );

  // All 7 indexes dropped.
  const indexDrops = [
    /DROP\s+INDEX\s+IF\s+EXISTS\s+idx_draw_adjustments_draw/i,
    /DROP\s+INDEX\s+IF\s+EXISTS\s+idx_draw_adjustments_status/i,
    /DROP\s+INDEX\s+IF\s+EXISTS\s+idx_draw_adjustments_line_item/i,
    /DROP\s+INDEX\s+IF\s+EXISTS\s+idx_draw_adjustments_vendor/i,
    /DROP\s+INDEX\s+IF\s+EXISTS\s+idx_draw_adjustments_invoice/i,
    /DROP\s+INDEX\s+IF\s+EXISTS\s+idx_dali_adjustment/i,
    /DROP\s+INDEX\s+IF\s+EXISTS\s+idx_dali_draw_line_item/i,
  ];
  for (const re of indexDrops) {
    assert.ok(re.test(src), `down must include ${re}`);
  }

  // Join table dropped BEFORE parent table (CASCADE would auto-drop, but
  // explicit drop is cleaner + matches the parent-last reverse-dependency
  // convention).
  const joinIdx = src.search(
    /DROP\s+TABLE\s+IF\s+EXISTS\s+public\.draw_adjustment_line_items/i
  );
  const parentIdx = src.search(
    /DROP\s+TABLE\s+IF\s+EXISTS\s+public\.draw_adjustments(?!_line_items)/i
  );
  assert.ok(joinIdx >= 0, "down must DROP TABLE public.draw_adjustment_line_items");
  assert.ok(parentIdx >= 0, "down must DROP TABLE public.draw_adjustments");
  assert.ok(
    joinIdx < parentIdx,
    "down must drop draw_adjustment_line_items BEFORE draw_adjustments (reverse-dependency order)"
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
