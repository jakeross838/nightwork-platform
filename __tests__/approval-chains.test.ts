/**
 * Phase 2.6 regression fence — R.15.
 *
 * Migration 00070 adds public.approval_chains — a tenant-config table
 * carrying per-org configurable approval chains across 6 workflow
 * dimensions (invoice_pm, invoice_qa, co, draw, po, proposal). Seed
 * trigger on public.organizations plus a one-time backfill (3 orgs ×
 * 6 workflow_types = 18 default chains) guarantees every live org has
 * a default chain per workflow_type at rest.
 *
 * Scope decision (pre-flight F-ii): approval_actions table NOT
 * created. Audit flow continues through status_history JSONB on each
 * workflow entity + public.activity_log. See the plan amendment in
 * commit 317961d (preserved through the Markgraf-scenario renumber
 * at 73eaba8, which moved approval_chains from Phase 2.5 to 2.6).
 *
 * R.23 divergence (intentional): write role-set narrowed from the
 * 00065 proposals precedent's (owner, admin, pm, accounting) to
 * (owner, admin) only. Rationale documented in the migration header:
 * approval_chains is tenant config, not workflow data — PMs should
 * not edit who approves what.
 *
 * This test file is static: regex assertions against the migration
 * SQL text + .down.sql. Dynamic DB probes (live-auth RLS, GRANT
 * verification, workflow-type-aware default-stages verification,
 * seed-idempotency, soft-delete unblocking) fire during the
 * Migration Dry-Run per R.19 and are recorded in
 * qa-reports/qa-branch2-phase2.6.md.
 *
 * Pattern matches __tests__/draw-adjustments.test.ts (Phase 2.5).
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

const MIGRATION = "supabase/migrations/00070_approval_chains.sql";
const MIGRATION_DOWN = "supabase/migrations/00070_approval_chains.down.sql";

// ── migration file existence ─────────────────────────────────────────

test("migration 00070 exists", () => {
  assert.ok(existsSync(MIGRATION), `${MIGRATION} missing`);
});

test("migration 00070 has a rollback companion (.down.sql)", () => {
  assert.ok(existsSync(MIGRATION_DOWN), `${MIGRATION_DOWN} missing`);
});

// ── header documentation (F-ii scope + R.23 divergence + F.2 GRANT + GH #12) ──

test("migration 00070 header documents F-ii scope decision (approval_actions NOT created)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /F-ii/i.test(src) && /approval_actions/i.test(src),
    "header must reference F-ii scope decision re: approval_actions"
  );
  assert.ok(
    /status_history|activity_log/i.test(src),
    "header must cite status_history JSONB / activity_log as the audit surface"
  );
});

test("migration 00070 header documents R.23 divergence (owner/admin-only writes)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /R\.23/i.test(src),
    "header must invoke R.23 framing"
  );
  assert.ok(
    /proposals|00065/i.test(src),
    "header must cite the proposals / 00065 precedent"
  );
  assert.ok(
    /tenant[- ]config/i.test(src),
    "header must characterize approval_chains as tenant config (rationale for narrowing)"
  );
});

test("migration 00070 header documents Phase 2.4 Amendment F.2 GRANT pattern", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /00067|F\.2|GH\s*#9/i.test(src),
    "header must cite 00067 / Amendment F.2 / GH #9 GRANT-pattern lineage"
  );
});

test("migration 00070 header documents the dry-run runtime note (ON CONFLICT partial-index predicate)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /RUNTIME NOTE/i.test(src),
    "header must include a RUNTIME NOTE section documenting dry-run findings"
  );
  assert.ok(
    /42P10|ON\s+CONFLICT[\s\S]{0,200}partial/i.test(src),
    "runtime note must reference the 42P10 / partial-index ON CONFLICT finding so future readers don't strip the predicate"
  );
});

test("migration 00070 header documents GH #12 onboarding-wizard tracker", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /GH\s*#12|issue\s*#12/i.test(src),
    "migration must cite GH #12 as the onboarding-wizard override tracker"
  );
});

// ── approval_chains table shape ─────────────────────────────────────

test("migration 00070 creates public.approval_chains table", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.approval_chains\s*\(/i.test(
      src
    ),
    "migration must CREATE TABLE public.approval_chains"
  );
});

test("migration 00070 approval_chains has all required columns", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.approval_chains\s*\(([\s\S]*?)\n\)\s*;/i
  );
  assert.ok(match, "could not locate approval_chains CREATE TABLE body");
  const body = match![1];
  const required: Array<[string, RegExp]> = [
    ["id PK uuid", /\bid\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\s*\(\s*\)/i],
    ["org_id NOT NULL FK", /\borg_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.organizations\s*\(\s*id\s*\)/i],
    ["workflow_type NOT NULL w/ CHECK", /\bworkflow_type\s+TEXT\s+NOT\s+NULL\s+CHECK/i],
    ["name TEXT NOT NULL", /\bname\s+TEXT\s+NOT\s+NULL\b/i],
    ["is_default BOOLEAN NOT NULL DEFAULT FALSE", /\bis_default\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+FALSE\b/i],
    ["conditions JSONB NOT NULL DEFAULT '{}'::jsonb", /\bconditions\s+JSONB\s+NOT\s+NULL\s+DEFAULT\s+'\{\}'::jsonb/i],
    ["stages JSONB NOT NULL", /\bstages\s+JSONB\s+NOT\s+NULL\b/i],
    ["created_at NOT NULL DEFAULT now()", /\bcreated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i],
    ["updated_at NOT NULL DEFAULT now()", /\bupdated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i],
    ["created_by FK auth.users", /\bcreated_by\s+UUID\s+REFERENCES\s+auth\.users\s*\(\s*id\s*\)/i],
    ["deleted_at TIMESTAMPTZ", /\bdeleted_at\s+TIMESTAMPTZ\b/i],
  ];
  for (const [label, re] of required) {
    assert.ok(re.test(body), `approval_chains body must contain ${label}`);
  }
});

test("migration 00070 declares the 6-value workflow_type CHECK enum", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const expected = [
    "invoice_pm",
    "invoice_qa",
    "co",
    "draw",
    "po",
    "proposal",
  ];
  for (const v of expected) {
    assert.ok(
      new RegExp(`'${v}'`).test(src),
      `workflow_type CHECK must include '${v}'`
    );
  }
});

test("migration 00070 registers trg_approval_chains_updated_at trigger", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TRIGGER\s+trg_approval_chains_updated_at\s+BEFORE\s+UPDATE\s+ON\s+public\.approval_chains\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.update_updated_at\s*\(\s*\)/is.test(
      src
    ),
    "migration must register trg_approval_chains_updated_at using public.update_updated_at()"
  );
});

// ── partial unique indexes (Amendment C — both soft-delete-safe) ──

test("migration 00070 creates approval_chains_one_default_per_workflow partial unique index with soft-delete predicate", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+UNIQUE\s+INDEX\s+approval_chains_one_default_per_workflow\s+ON\s+public\.approval_chains\s*\(\s*org_id\s*,\s*workflow_type\s*\)\s+WHERE\s+is_default\s*=\s*true\s+AND\s+deleted_at\s+IS\s+NULL/is.test(
      src
    ),
    "one-default-per-workflow partial unique index must include both is_default = true AND deleted_at IS NULL in the WHERE clause"
  );
});

test("migration 00070 creates approval_chains_unique_name_per_workflow partial unique index with soft-delete predicate", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+UNIQUE\s+INDEX\s+approval_chains_unique_name_per_workflow\s+ON\s+public\.approval_chains\s*\(\s*org_id\s*,\s*workflow_type\s*,\s*name\s*\)\s+WHERE\s+deleted_at\s+IS\s+NULL/is.test(
      src
    ),
    "unique-name-per-workflow partial unique index must include deleted_at IS NULL in the WHERE clause"
  );
});

// ── RLS — enable + exactly 3 policies, no DELETE (R.23) ──────────────

test("migration 00070 enables RLS on approval_chains", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ALTER\s+TABLE\s+public\.approval_chains\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(
      src
    ),
    "RLS must be enabled on public.approval_chains"
  );
});

test("migration 00070 approval_chains has exactly 3 policies (read / insert / update) — no DELETE (R.23)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+POLICY\s+approval_chains_org_read\s+ON\s+public\.approval_chains\s+FOR\s+SELECT/i.test(
      src
    ),
    "must CREATE POLICY approval_chains_org_read FOR SELECT"
  );
  assert.ok(
    /CREATE\s+POLICY\s+approval_chains_org_insert\s+ON\s+public\.approval_chains\s+FOR\s+INSERT/i.test(
      src
    ),
    "must CREATE POLICY approval_chains_org_insert FOR INSERT"
  );
  assert.ok(
    /CREATE\s+POLICY\s+approval_chains_org_update\s+ON\s+public\.approval_chains\s+FOR\s+UPDATE/i.test(
      src
    ),
    "must CREATE POLICY approval_chains_org_update FOR UPDATE"
  );
  const policyMatches = src.match(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.approval_chains\b/gi
  );
  assert.strictEqual(
    policyMatches?.length,
    3,
    `exactly 3 policies on public.approval_chains required (00065 proposals precedent); found ${policyMatches?.length ?? 0}`
  );
  assert.ok(
    !/CREATE\s+POLICY\s+\S+\s+ON\s+public\.approval_chains\s+FOR\s+DELETE/i.test(
      src
    ),
    "NO DELETE policy allowed (soft-delete via deleted_at; hard DELETE RLS-blocked by default)"
  );
});

test("migration 00070 org_read policy allows any active org member + platform admin", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+POLICY\s+approval_chains_org_read\s+ON\s+public\.approval_chains[\s\S]*?;/i
  );
  assert.ok(match, "could not locate approval_chains_org_read policy body");
  const body = match![0];
  assert.ok(
    /public\.org_members[\s\S]*?is_active\s*=\s*true/is.test(body),
    "read policy must filter via org_members / is_active = true"
  );
  assert.ok(
    /is_platform_admin\s*\(\s*\)/i.test(body),
    "read policy must include platform-admin OR bypass"
  );
  // Read policy must NOT narrow by role — approval_chains is tenant
  // config and every org member should be able to see the active
  // approval routing. Only writes are narrowed.
  assert.ok(
    !/role\s+IN\s*\(/i.test(body),
    "read policy must NOT narrow by role (tenant-wide config visibility)"
  );
});

test("migration 00070 write policies narrow to role IN ('owner','admin') — R.23 divergence from proposals' 4-role set", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const insertMatch = src.match(
    /CREATE\s+POLICY\s+approval_chains_org_insert[\s\S]*?;/i
  );
  const updateMatch = src.match(
    /CREATE\s+POLICY\s+approval_chains_org_update[\s\S]*?;/i
  );
  assert.ok(insertMatch, "missing approval_chains_org_insert policy");
  assert.ok(updateMatch, "missing approval_chains_org_update policy");
  for (const body of [insertMatch![0], updateMatch![0]]) {
    assert.ok(
      /role\s+IN\s*\(\s*'owner'\s*,\s*'admin'\s*\)/i.test(body),
      "write policies must gate on role IN ('owner','admin') — R.23 divergence (approval_chains is tenant config, narrower than proposals' 4-role write set)"
    );
    // Guard against accidentally widening to proposals' 4-role set.
    assert.ok(
      !/'pm'/i.test(body),
      "write policies must NOT include 'pm' (R.23 narrowing — approval_chains is tenant config)"
    );
    assert.ok(
      !/'accounting'/i.test(body),
      "write policies must NOT include 'accounting' (R.23 narrowing — approval_chains is tenant config)"
    );
  }
});

// ── helper function: default_stages_for_workflow_type(text) ─────────

test("migration 00070 declares public.default_stages_for_workflow_type(text) helper with IMMUTABLE + pinned search_path", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.default_stages_for_workflow_type\s*\(\s*_?wt\s+text\s*\)[\s\S]*?LANGUAGE\s+plpgsql\s+IMMUTABLE[\s\S]*?SET\s+search_path\s*=\s*public\s*,\s*pg_temp/i
  );
  assert.ok(
    match,
    "helper must be declared IMMUTABLE with SET search_path = public, pg_temp"
  );
});

test("migration 00070 helper function has workflow-type-aware CASE logic (Amendment D.2)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // invoice_pm → 'pm'
  assert.ok(
    /WHEN\s+'invoice_pm'[\s\S]*?jsonb_build_array\s*\(\s*'pm'\s*\)/is.test(src),
    "helper must map invoice_pm → ['pm']"
  );
  // invoice_qa → 'accounting'
  assert.ok(
    /WHEN\s+'invoice_qa'[\s\S]*?jsonb_build_array\s*\(\s*'accounting'\s*\)/is.test(src),
    "helper must map invoice_qa → ['accounting']"
  );
  // ELSE → 'owner','admin'
  assert.ok(
    /ELSE[\s\S]*?jsonb_build_array\s*\(\s*'owner'\s*,\s*'admin'\s*\)/is.test(src),
    "helper's ELSE branch must return ['owner','admin'] (co/draw/po/proposal defaults)"
  );
});

test("migration 00070 GRANTs EXECUTE on helper to authenticated (Amendment F.2 GRANT pattern)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.default_stages_for_workflow_type\s*\(\s*text\s*\)\s*[\s\S]*?TO\s+authenticated/is.test(
      src
    ),
    "migration must GRANT EXECUTE ON FUNCTION public.default_stages_for_workflow_type(text) TO authenticated"
  );
});

// ── seed function: create_default_approval_chains() ─────────────────

test("migration 00070 declares public.create_default_approval_chains() with SECURITY DEFINER + pinned search_path", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.create_default_approval_chains\s*\(\s*\)[\s\S]*?LANGUAGE\s+plpgsql\s+SECURITY\s+DEFINER[\s\S]*?SET\s+search_path\s*=\s*public\s*,\s*pg_temp/i
  );
  assert.ok(
    match,
    "seed function must be SECURITY DEFINER with SET search_path = public, pg_temp (00032 precedent)"
  );
});

test("migration 00070 seed function calls helper + uses ON CONFLICT DO NOTHING with partial-index predicate", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // End-anchor on the CREATE TRIGGER that follows the seed function
  // in the migration, so the body captures everything inside the
  // function (safer than trying to match the $$ dollar-quote tag).
  const match = src.match(
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.create_default_approval_chains\s*\(\s*\)[\s\S]*?CREATE\s+TRIGGER\s+trg_organizations_create_default_approval_chains/i
  );
  assert.ok(match, "could not locate create_default_approval_chains function body");
  const body = match![0];
  assert.ok(
    /public\.default_stages_for_workflow_type\s*\(/i.test(body),
    "seed function must call public.default_stages_for_workflow_type() (DRY source of truth per Amendment D)"
  );
  // ON CONFLICT must REPEAT the partial index predicate
  // (WHERE deleted_at IS NULL) — otherwise PostgreSQL errors
  // 42P10 "no unique or exclusion constraint matching the ON
  // CONFLICT specification" because the backing index is
  // partial (Amendment C). Regression fence for the dry-run
  // finding documented in the migration header's RUNTIME NOTE.
  assert.ok(
    /ON\s+CONFLICT\s*\(\s*org_id\s*,\s*workflow_type\s*,\s*name\s*\)\s+WHERE\s+deleted_at\s+IS\s+NULL\s+DO\s+NOTHING/i.test(
      body
    ),
    "seed function's ON CONFLICT must include `WHERE deleted_at IS NULL` to match the partial unique index (dry-run finding)"
  );
});

test("migration 00070 GRANTs EXECUTE on seed function to authenticated (Amendment F.2)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_default_approval_chains\s*\(\s*\)\s*[\s\S]*?TO\s+authenticated/is.test(
      src
    ),
    "migration must GRANT EXECUTE ON FUNCTION public.create_default_approval_chains() TO authenticated (Amendment F.2 defending GH #9 class)"
  );
});

test("migration 00070 registers trg_organizations_create_default_approval_chains AFTER INSERT trigger", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TRIGGER\s+trg_organizations_create_default_approval_chains\s+AFTER\s+INSERT\s+ON\s+public\.organizations\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.create_default_approval_chains\s*\(\s*\)/is.test(
      src
    ),
    "migration must register trg_organizations_create_default_approval_chains AFTER INSERT on public.organizations"
  );
});

// ── one-time backfill (Amendment D + F) ─────────────────────────────

test("migration 00070 backfills existing orgs × 6 workflow_types via CROSS JOIN unnest", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // INSERT ... SELECT with CROSS JOIN unnest of the 6 workflow_types
  assert.ok(
    /INSERT\s+INTO\s+public\.approval_chains[\s\S]*?SELECT[\s\S]*?FROM\s+public\.organizations[\s\S]*?CROSS\s+JOIN\s+unnest\s*\(\s*ARRAY\s*\[\s*'invoice_pm'\s*,\s*'invoice_qa'\s*,\s*'co'\s*,\s*'draw'\s*,\s*'po'\s*,\s*'proposal'\s*\]\s*\)/is.test(
      src
    ),
    "backfill must CROSS JOIN unnest(ARRAY['invoice_pm','invoice_qa','co','draw','po','proposal']) so every live org gets one default per workflow_type"
  );
  assert.ok(
    /default_stages_for_workflow_type\s*\(/i.test(src),
    "backfill must call default_stages_for_workflow_type() so the helper stays the single source of truth"
  );
  // Same partial-index predicate requirement as the seed
  // function — see migration header RUNTIME NOTE.
  assert.ok(
    /ON\s+CONFLICT\s*\(\s*org_id\s*,\s*workflow_type\s*,\s*name\s*\)\s+WHERE\s+deleted_at\s+IS\s+NULL\s+DO\s+NOTHING/i.test(
      src
    ),
    "backfill's ON CONFLICT must include `WHERE deleted_at IS NULL` to match the partial unique index (dry-run finding)"
  );
});

test("migration 00070 backfill excludes soft-deleted organizations", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Anchor on the SELECT...FROM organizations form (distinct from
  // the seed function's INSERT...VALUES) so we match only the
  // one-time backfill block.
  const match = src.match(
    /INSERT\s+INTO\s+public\.approval_chains[\s\S]*?SELECT[\s\S]*?FROM\s+public\.organizations\s+o[\s\S]*?ON\s+CONFLICT[\s\S]*?DO\s+NOTHING\s*;/i
  );
  assert.ok(match, "could not locate backfill INSERT...SELECT block");
  assert.ok(
    /\bo\.deleted_at\s+IS\s+NULL\b/i.test(match![0]),
    "backfill must filter organizations by deleted_at IS NULL (don't seed dead orgs)"
  );
});

// ── COMMENTs — table + both functions ───────────────────────────────

test("migration 00070 adds COMMENT ON TABLE documenting R.23 divergence + GH #12", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /COMMENT\s+ON\s+TABLE\s+public\.approval_chains\s+IS[\s\S]*?;/i
  );
  assert.ok(match, "migration must COMMENT ON TABLE public.approval_chains");
  const body = match![0];
  assert.ok(
    /R\.23/i.test(body) && /proposals|00065/i.test(body),
    "table comment must cite the R.23 + 00065 proposals precedent"
  );
  assert.ok(
    /tenant[- ]config|owner[\s\S]{0,20}admin/i.test(body),
    "table comment must document the owner/admin-only narrowing rationale"
  );
  assert.ok(
    /GH\s*#12/i.test(body),
    "table comment must cite GH #12 for onboarding-wizard override work"
  );
});

test("migration 00070 adds COMMENT ON FUNCTION for default_stages_for_workflow_type", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /COMMENT\s+ON\s+FUNCTION\s+public\.default_stages_for_workflow_type\s*\(\s*text\s*\)\s+IS/i.test(
      src
    ),
    "migration must COMMENT ON FUNCTION public.default_stages_for_workflow_type(text)"
  );
});

test("migration 00070 adds COMMENT ON FUNCTION for create_default_approval_chains", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /COMMENT\s+ON\s+FUNCTION\s+public\.create_default_approval_chains\s*\(\s*\)\s+IS[\s\S]*?;/i
  );
  assert.ok(
    match,
    "migration must COMMENT ON FUNCTION public.create_default_approval_chains()"
  );
  assert.ok(
    /00032|create_default_workflow_settings/i.test(match![0]),
    "seed-function comment must cite 00032 / create_default_workflow_settings as the precedent"
  );
});

// ── down migration ────────────────────────────────────────────────────

test("00070.down.sql reverses in strict reverse-dependency order", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");

  // Org-creation trigger must be dropped FIRST — it depends on
  // create_default_approval_chains, which depends on the helper.
  assert.ok(
    /DROP\s+TRIGGER\s+IF\s+EXISTS\s+trg_organizations_create_default_approval_chains\s+ON\s+public\.organizations/i.test(
      src
    ),
    "down must DROP TRIGGER trg_organizations_create_default_approval_chains on organizations"
  );
  assert.ok(
    /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.create_default_approval_chains\s*\(\s*\)/i.test(
      src
    ),
    "down must DROP FUNCTION public.create_default_approval_chains()"
  );

  // RLS policies dropped before DISABLE RLS and table DROP.
  const policies = [
    /DROP\s+POLICY\s+IF\s+EXISTS\s+approval_chains_org_update\s+ON\s+public\.approval_chains/i,
    /DROP\s+POLICY\s+IF\s+EXISTS\s+approval_chains_org_insert\s+ON\s+public\.approval_chains/i,
    /DROP\s+POLICY\s+IF\s+EXISTS\s+approval_chains_org_read\s+ON\s+public\.approval_chains/i,
  ];
  for (const re of policies) {
    assert.ok(re.test(src), `down must include ${re}`);
  }

  assert.ok(
    /ALTER\s+TABLE\s+public\.approval_chains\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(
      src
    ),
    "down must DISABLE RLS on approval_chains"
  );

  // updated_at trigger dropped.
  assert.ok(
    /DROP\s+TRIGGER\s+IF\s+EXISTS\s+trg_approval_chains_updated_at/i.test(src),
    "down must DROP TRIGGER trg_approval_chains_updated_at"
  );

  // Both partial unique indexes dropped.
  assert.ok(
    /DROP\s+INDEX\s+IF\s+EXISTS\s+approval_chains_unique_name_per_workflow/i.test(
      src
    ),
    "down must DROP INDEX approval_chains_unique_name_per_workflow"
  );
  assert.ok(
    /DROP\s+INDEX\s+IF\s+EXISTS\s+approval_chains_one_default_per_workflow/i.test(
      src
    ),
    "down must DROP INDEX approval_chains_one_default_per_workflow"
  );

  // Table dropped.
  assert.ok(
    /DROP\s+TABLE\s+IF\s+EXISTS\s+public\.approval_chains\b/i.test(src),
    "down must DROP TABLE public.approval_chains"
  );

  // Helper function dropped LAST (create_default_approval_chains
  // depends on it — can only be dropped after the seed function).
  assert.ok(
    /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.default_stages_for_workflow_type\s*\(\s*text\s*\)/i.test(
      src
    ),
    "down must DROP FUNCTION public.default_stages_for_workflow_type(text)"
  );

  // Ordering: seed function drop must precede helper drop.
  const seedFnDropIdx = src.search(
    /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.create_default_approval_chains\s*\(/i
  );
  const helperFnDropIdx = src.search(
    /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.default_stages_for_workflow_type\s*\(/i
  );
  assert.ok(seedFnDropIdx >= 0, "down must drop create_default_approval_chains()");
  assert.ok(helperFnDropIdx >= 0, "down must drop default_stages_for_workflow_type(text)");
  assert.ok(
    seedFnDropIdx < helperFnDropIdx,
    "down must drop create_default_approval_chains() BEFORE default_stages_for_workflow_type(text) (reverse-dependency order)"
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
