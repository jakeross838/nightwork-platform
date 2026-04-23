/**
 * Phase 2.7 regression fence — R.15.
 *
 * Migration 00071 adds:
 *   - public.job_milestones (workflow entity; PMs mark complete;
 *     accounting bills against them into draws)
 *   - public.jobs: retainage_threshold_percent + retainage_dropoff_percent
 *     (NUMERIC(5,2) NOT NULL DEFAULT 50.00 / 5.00 with CHECK 0-100),
 *     AND drops the duplicate jobs_retainage_percent_check (GH #5 Option A)
 *   - public.draws: draw_mode + milestone_completions + tm_* columns
 *
 * Plan amendments landed at commit 510dacb (full amended spec §3913).
 * Pre-flight at commit 0b548ff. R.23 precedent = 00065 proposals
 * 3-policy + 00069 draw_adjustments PM-on-own-jobs read narrowing.
 *
 * This test file is static: regex assertions against the migration SQL
 * text + .down.sql. Dynamic DB probes (live-auth RLS, FK-through-RLS
 * behavior on job_milestones, constraint-drop verification,
 * milestone_completions NOT NULL defense-in-depth, data-preservation
 * on 15 jobs + 2 draws) fire during the Migration Dry-Run per R.19
 * and are recorded in qa-reports/qa-branch2-phase2.7.md.
 *
 * Pattern matches __tests__/approval-chains.test.ts (Phase 2.6) and
 * __tests__/draw-adjustments.test.ts (Phase 2.5).
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

const MIGRATION = "supabase/migrations/00071_milestones_retainage.sql";
const MIGRATION_DOWN = "supabase/migrations/00071_milestones_retainage.down.sql";

// ── migration file existence ─────────────────────────────────────────

test("migration 00071 exists", () => {
  assert.ok(existsSync(MIGRATION), `${MIGRATION} missing`);
});

test("migration 00071 has a rollback companion (.down.sql)", () => {
  assert.ok(existsSync(MIGRATION_DOWN), `${MIGRATION_DOWN} missing`);
});

// ── header documentation ─────────────────────────────────────────────

test("migration 00071 header cites plan-amendment commit 510dacb", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /510dacb/i.test(src),
    "header must cite plan-amendment commit 510dacb"
  );
});

test("migration 00071 header documents R.23 precedent (00065 proposals + 00069 PM narrowing)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /R\.23/i.test(src),
    "header must invoke R.23"
  );
  assert.ok(
    /proposals/i.test(src) && /00065/.test(src),
    "header must cite 00065 proposals precedent"
  );
  assert.ok(
    /draw_adjustments/i.test(src) && /00069/.test(src),
    "header must cite 00069 draw_adjustments PM-on-own-jobs precedent"
  );
});

test("migration 00071 header documents GH #5 Option A resolution", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /GH\s*#5|issue\s*#5/i.test(src),
    "header must reference GH #5"
  );
  assert.ok(
    /Option\s*A/i.test(src),
    "header must cite Option A resolution"
  );
  assert.ok(
    /jobs_retainage_percent_check/i.test(src),
    "header must name the duplicate CHECK being dropped"
  );
});

test("migration 00071 header documents Amendment F.2 N/A (no SECURITY DEFINER functions)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /(F\.2|Amendment\s*K)[\s\S]{0,200}(N\/A|not\s*applicable)/i.test(src),
    "header must explicitly document that Amendment F.2 GRANT-verification is N/A"
  );
});

test("migration 00071 header documents Amendment L writer contracts", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /soft[- ]delete[\s\S]{0,200}cascade/i.test(src),
    "header must document milestone soft-delete cascade writer contract"
  );
  assert.ok(
    /milestone_completions/i.test(src) && /shape|array|JSONB/i.test(src),
    "header must document milestone_completions JSONB shape"
  );
  assert.ok(
    /contract_type/i.test(src) && /draw_mode/i.test(src),
    "header must document draw_mode vs contract_type relationship"
  );
});

test("migration 00071 header cites GH #12 and GH #15 onboarding trackers", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /GH\s*#15|issue\s*#15/i.test(src),
    "header must reference GH #15 (retainage threshold/dropoff onboarding override)"
  );
});

test("migration 00071 header documents Ross-Built-vs-other-orgs context", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /Ross\s*Built|cost[- ]plus|AIA/i.test(src),
    "header must frame milestone + T&M + retainage threshold/dropoff as forward-looking v2.0 infrastructure"
  );
});

// ── job_milestones table shape (Amendment A) ─────────────────────────

test("migration 00071 creates public.job_milestones table", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.job_milestones\s*\(/i.test(src),
    "migration must CREATE TABLE public.job_milestones"
  );
});

test("migration 00071 job_milestones has full audit-column set + required columns (Amendment A)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.job_milestones\s*\(([\s\S]*?)\n\)\s*;/i
  );
  assert.ok(match, "could not locate job_milestones CREATE TABLE body");
  const body = match![1];
  const required: Array<[string, RegExp]> = [
    ["id PK uuid", /\bid\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\s*\(\s*\)/i],
    ["org_id NOT NULL FK", /\borg_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.organizations\s*\(\s*id\s*\)/i],
    ["job_id NOT NULL FK", /\bjob_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.jobs\s*\(\s*id\s*\)/i],
    ["sort_order INT NOT NULL", /\bsort_order\s+INT(?:EGER)?\s+NOT\s+NULL\b/i],
    ["name TEXT NOT NULL", /\bname\s+TEXT\s+NOT\s+NULL\b/i],
    ["amount_cents BIGINT NOT NULL", /\bamount_cents\s+BIGINT\s+NOT\s+NULL\b/i],
    ["target_date DATE", /\btarget_date\s+DATE\b/i],
    ["completed_date DATE", /\bcompleted_date\s+DATE\b/i],
    ["status NOT NULL DEFAULT 'pending' w/ CHECK", /\bstatus\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'pending'\s*(?:CHECK|\n\s*CHECK)/i],
    ["status_history JSONB NOT NULL DEFAULT '[]'", /\bstatus_history\s+JSONB\s+NOT\s+NULL\s+DEFAULT\s+'\[\]'::jsonb/i],
    ["created_at NOT NULL DEFAULT now()", /\bcreated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i],
    ["updated_at NOT NULL DEFAULT now()", /\bupdated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i],
    ["created_by FK auth.users", /\bcreated_by\s+UUID\s+REFERENCES\s+auth\.users\s*\(\s*id\s*\)/i],
    ["deleted_at TIMESTAMPTZ", /\bdeleted_at\s+TIMESTAMPTZ\b/i],
  ];
  for (const [label, re] of required) {
    assert.ok(re.test(body), `job_milestones body must contain ${label}`);
  }
});

test("migration 00071 declares the 4-value status CHECK enum", () => {
  const src = readFileSync(MIGRATION, "utf8");
  for (const v of ["pending", "in_progress", "complete", "billed"]) {
    assert.ok(
      new RegExp(`'${v}'`).test(src),
      `job_milestones status CHECK must include '${v}'`
    );
  }
});

test("migration 00071 registers trg_job_milestones_updated_at trigger", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TRIGGER\s+trg_job_milestones_updated_at\s+BEFORE\s+UPDATE\s+ON\s+public\.job_milestones\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.update_updated_at\s*\(\s*\)/is.test(src),
    "migration must register trg_job_milestones_updated_at using public.update_updated_at()"
  );
});

// ── indexes (Amendment C) ────────────────────────────────────────────

test("migration 00071 creates 1 partial unique + 3 partial indexes on job_milestones with soft-delete-safe predicates", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+UNIQUE\s+INDEX\s+job_milestones_unique_sort_per_job\s+ON\s+public\.job_milestones\s*\(\s*org_id\s*,\s*job_id\s*,\s*sort_order\s*\)\s+WHERE\s+deleted_at\s+IS\s+NULL/is.test(src),
    "must CREATE UNIQUE INDEX job_milestones_unique_sort_per_job (org_id, job_id, sort_order) WHERE deleted_at IS NULL"
  );
  assert.ok(
    /CREATE\s+INDEX\s+idx_job_milestones_org_job\s+ON\s+public\.job_milestones\s*\(\s*org_id\s*,\s*job_id\s*\)\s+WHERE\s+deleted_at\s+IS\s+NULL/is.test(src),
    "must create idx_job_milestones_org_job partial index"
  );
  assert.ok(
    /CREATE\s+INDEX\s+idx_job_milestones_status\s+ON\s+public\.job_milestones\s*\(\s*org_id\s*,\s*status\s*\)\s+WHERE\s+deleted_at\s+IS\s+NULL/is.test(src),
    "must create idx_job_milestones_status partial index"
  );
  assert.ok(
    /CREATE\s+INDEX\s+idx_job_milestones_target_date\s+ON\s+public\.job_milestones\s*\(\s*org_id\s*,\s*target_date\s*\)\s+WHERE\s+target_date\s+IS\s+NOT\s+NULL\s+AND\s+deleted_at\s+IS\s+NULL/is.test(src),
    "must create idx_job_milestones_target_date partial index"
  );
});

// ── RLS (Amendment B) ────────────────────────────────────────────────

test("migration 00071 enables RLS on job_milestones", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ALTER\s+TABLE\s+public\.job_milestones\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(src),
    "RLS must be enabled on public.job_milestones"
  );
});

test("migration 00071 job_milestones has exactly 3 policies (read / insert / update) — no DELETE (R.23)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+POLICY\s+job_milestones_org_read\s+ON\s+public\.job_milestones\s+FOR\s+SELECT/i.test(src),
    "must CREATE POLICY job_milestones_org_read FOR SELECT"
  );
  assert.ok(
    /CREATE\s+POLICY\s+job_milestones_org_insert\s+ON\s+public\.job_milestones\s+FOR\s+INSERT/i.test(src),
    "must CREATE POLICY job_milestones_org_insert FOR INSERT"
  );
  assert.ok(
    /CREATE\s+POLICY\s+job_milestones_org_update\s+ON\s+public\.job_milestones\s+FOR\s+UPDATE/i.test(src),
    "must CREATE POLICY job_milestones_org_update FOR UPDATE"
  );
  const policyMatches = src.match(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.job_milestones\b/gi
  );
  assert.strictEqual(
    policyMatches?.length,
    3,
    `exactly 3 policies on public.job_milestones required (00065 proposals precedent); found ${policyMatches?.length ?? 0}`
  );
  assert.ok(
    !/CREATE\s+POLICY\s+\S+\s+ON\s+public\.job_milestones\s+FOR\s+DELETE/i.test(src),
    "NO DELETE policy allowed (soft-delete via deleted_at; hard DELETE RLS-blocked by default)"
  );
});

test("migration 00071 read policy narrows PMs via EXISTS on jobs.pm_id (00069 draw_adjustments precedent)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+POLICY\s+job_milestones_org_read\s+ON\s+public\.job_milestones[\s\S]*?;/i
  );
  assert.ok(match, "could not locate job_milestones_org_read policy body");
  const body = match![0];
  assert.ok(
    /EXISTS\s*\([\s\S]*?public\.jobs\s+j[\s\S]*?j\.pm_id\s*=\s*auth\.uid\(\)/is.test(body),
    "read policy must include PM-on-own-jobs EXISTS subquery traversing public.jobs.pm_id = auth.uid()"
  );
  assert.ok(
    /app_private\.user_role\(\)\s*=\s*'pm'/i.test(body),
    "read policy must gate PM narrowing on user_role() = 'pm'"
  );
  assert.ok(
    /user_role\(\)\s+IN\s*\(\s*'owner'\s*,\s*'admin'\s*,\s*'accounting'\s*\)/i.test(body),
    "read policy must let owner/admin/accounting read without the PM EXISTS narrowing"
  );
  assert.ok(
    /is_platform_admin\(\)/i.test(body),
    "read policy must include platform-admin OR bypass"
  );
});

test("migration 00071 write policies gate on role IN ('owner','admin','pm','accounting') — workflow-data role set, not approval_chains narrowing", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const insertMatch = src.match(
    /CREATE\s+POLICY\s+job_milestones_org_insert[\s\S]*?;/i
  );
  const updateMatch = src.match(
    /CREATE\s+POLICY\s+job_milestones_org_update[\s\S]*?;/i
  );
  assert.ok(insertMatch, "missing job_milestones_org_insert policy");
  assert.ok(updateMatch, "missing job_milestones_org_update policy");
  for (const body of [insertMatch![0], updateMatch![0]]) {
    assert.ok(
      /role\s+IN\s*\(\s*'owner'\s*,\s*'admin'\s*,\s*'pm'\s*,\s*'accounting'\s*\)/i.test(body),
      "write policies must gate on role IN ('owner','admin','pm','accounting') (proposals precedent — job_milestones is workflow data, not tenant config)"
    );
  }
});

// ── jobs ALTER (Amendment D + Amendment E / GH #5 Option A) ──────────

test("migration 00071 DROPs jobs_retainage_percent_check (Amendment E / GH #5 Option A)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ALTER\s+TABLE\s+public\.jobs[\s\S]*?DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+jobs_retainage_percent_check/is.test(src),
    "migration must DROP CONSTRAINT IF EXISTS jobs_retainage_percent_check (GH #5 Option A)"
  );
});

test("migration 00071 does NOT drop chk_jobs_retainage_percent (the intentional survivor)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    !/DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+chk_jobs_retainage_percent\b/i.test(src),
    "migration must NOT drop chk_jobs_retainage_percent (explicit-name survivor, chk_jobs_* hygiene family)"
  );
});

test("migration 00071 adds jobs.retainage_threshold_percent NUMERIC(5,2) NOT NULL DEFAULT 50 with CHECK 0-100", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ADD\s+COLUMN\s+retainage_threshold_percent\s+NUMERIC\s*\(\s*5\s*,\s*2\s*\)\s+NOT\s+NULL\s+DEFAULT\s+50(?:\.0+)?/i.test(src),
    "must ADD COLUMN retainage_threshold_percent NUMERIC(5,2) NOT NULL DEFAULT 50"
  );
  assert.ok(
    /CONSTRAINT\s+chk_jobs_retainage_threshold_percent\s+CHECK\s*\(\s*retainage_threshold_percent\s*>=\s*0\s+AND\s+retainage_threshold_percent\s*<=\s*100\s*\)/i.test(src),
    "must add explicit-name chk_jobs_retainage_threshold_percent CHECK 0-100"
  );
});

test("migration 00071 adds jobs.retainage_dropoff_percent NUMERIC(5,2) NOT NULL DEFAULT 5 with CHECK 0-100", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ADD\s+COLUMN\s+retainage_dropoff_percent\s+NUMERIC\s*\(\s*5\s*,\s*2\s*\)\s+NOT\s+NULL\s+DEFAULT\s+5(?:\.0+)?/i.test(src),
    "must ADD COLUMN retainage_dropoff_percent NUMERIC(5,2) NOT NULL DEFAULT 5"
  );
  assert.ok(
    /CONSTRAINT\s+chk_jobs_retainage_dropoff_percent\s+CHECK\s*\(\s*retainage_dropoff_percent\s*>=\s*0\s+AND\s+retainage_dropoff_percent\s*<=\s*100\s*\)/i.test(src),
    "must add explicit-name chk_jobs_retainage_dropoff_percent CHECK 0-100"
  );
});

// ── draws ALTER (Amendments F, G, H) ─────────────────────────────────

test("migration 00071 adds draws.draw_mode TEXT NOT NULL DEFAULT 'aia' with 3-value CHECK", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ADD\s+COLUMN\s+draw_mode\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'aia'/i.test(src),
    "must ADD COLUMN draw_mode TEXT NOT NULL DEFAULT 'aia'"
  );
  for (const v of ["aia", "milestone", "tm"]) {
    assert.ok(
      new RegExp(`'${v}'`).test(src),
      `draw_mode CHECK must include '${v}'`
    );
  }
  assert.ok(
    /CHECK\s*\(\s*draw_mode\s+IN\s*\(\s*'aia'\s*,\s*'milestone'\s*,\s*'tm'\s*\)\s*\)/i.test(src),
    "draw_mode CHECK must be exactly IN ('aia','milestone','tm')"
  );
});

test("migration 00071 adds draws.milestone_completions JSONB NOT NULL DEFAULT '[]'::jsonb (Amendment F)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ADD\s+COLUMN\s+milestone_completions\s+JSONB\s+NOT\s+NULL\s+DEFAULT\s+'\[\]'::jsonb/i.test(src),
    "must ADD COLUMN milestone_completions JSONB NOT NULL DEFAULT '[]'::jsonb (Amendment F — matches status_history precedent, never null)"
  );
});

test("migration 00071 adds draws.tm_labor_hours NUMERIC (hours-not-money carve-out)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ADD\s+COLUMN\s+tm_labor_hours\s+NUMERIC\b(?!\s*\()/i.test(src),
    "must ADD COLUMN tm_labor_hours NUMERIC (bare NUMERIC — hours, not a monetary amount per CLAUDE.md R.8)"
  );
});

test("migration 00071 adds draws.tm_material_cost + tm_sub_cost + tm_markup_amount BIGINT (cents)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  for (const col of ["tm_material_cost", "tm_sub_cost", "tm_markup_amount"]) {
    assert.ok(
      new RegExp(`ADD\\s+COLUMN\\s+${col}\\s+BIGINT\\b`, "i").test(src),
      `must ADD COLUMN ${col} BIGINT (cents per CLAUDE.md R.8)`
    );
  }
});

// ── COMMENTs (Amendment H) ───────────────────────────────────────────

test("migration 00071 adds COMMENT ON TABLE public.job_milestones citing proposals/00065 + PM narrowing + Ross-Built context", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /COMMENT\s+ON\s+TABLE\s+public\.job_milestones\s+IS[\s\S]*?;/i
  );
  assert.ok(match, "migration must COMMENT ON TABLE public.job_milestones");
  const body = match![0];
  assert.ok(
    /proposals|00065|R\.23/i.test(body),
    "table COMMENT must cite proposals/00065/R.23 precedent"
  );
  assert.ok(
    /PM|pm_id|draw_adjustments|00069/i.test(body),
    "table COMMENT must reference PM narrowing or 00069 draw_adjustments precedent"
  );
});

test("migration 00071 adds COMMENT ON COLUMN draws.tm_labor_hours citing CLAUDE.md R.8 hours-not-money carve-out", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /COMMENT\s+ON\s+COLUMN\s+public\.draws\.tm_labor_hours\s+IS[\s\S]*?;/i
  );
  assert.ok(match, "migration must COMMENT ON COLUMN public.draws.tm_labor_hours");
  const body = match![0];
  assert.ok(
    /R\.8/i.test(body),
    "tm_labor_hours COMMENT must cite CLAUDE.md R.8 explicitly"
  );
  assert.ok(
    /hours?\s+are\s+not\s+money|not\s+(a\s+)?money|not\s+cents/i.test(body),
    "tm_labor_hours COMMENT must include the hours-not-money carve-out phrasing"
  );
});

test("migration 00071 adds COMMENT ON COLUMN draws.draw_mode documenting application-layer cross-column invariant (Amendment G)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /COMMENT\s+ON\s+COLUMN\s+public\.draws\.draw_mode\s+IS[\s\S]*?;/i
  );
  assert.ok(match, "migration must COMMENT ON COLUMN public.draws.draw_mode");
  const body = match![0];
  assert.ok(
    /application[- ]layer|Branch\s*3\/?4|writer\s+(responsibility|contract)/i.test(body),
    "draw_mode COMMENT must document the application-layer / Branch 3/4 writer responsibility"
  );
  assert.ok(
    /milestone_completions/i.test(body) && /tm_(labor_hours|material_cost|sub_cost|markup_amount)/i.test(body),
    "draw_mode COMMENT must name the columns governed by the cross-column invariant"
  );
});

test("migration 00071 adds COMMENT ON COLUMN draws.milestone_completions documenting expected JSONB shape", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /COMMENT\s+ON\s+COLUMN\s+public\.draws\.milestone_completions\s+IS[\s\S]*?;/i
  );
  assert.ok(match, "migration must COMMENT ON COLUMN public.draws.milestone_completions");
  const body = match![0];
  assert.ok(
    /milestone_id|completed_percent|Branch\s*3\/?4|writer\s+contract/i.test(body),
    "milestone_completions COMMENT must describe Branch 3/4 writer-contract shape (milestone_id / completed_percent)"
  );
});

test("migration 00071 adds COMMENT ON COLUMN jobs.retainage_threshold_percent citing GH #15", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /COMMENT\s+ON\s+COLUMN\s+public\.jobs\.retainage_threshold_percent\s+IS[\s\S]*?;/i
  );
  assert.ok(match, "migration must COMMENT ON COLUMN public.jobs.retainage_threshold_percent");
  assert.ok(
    /GH\s*#15|issue\s*#15/i.test(match![0]),
    "retainage_threshold_percent COMMENT must cite GH #15 onboarding tracker"
  );
});

test("migration 00071 adds COMMENT ON COLUMN jobs.retainage_dropoff_percent", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /COMMENT\s+ON\s+COLUMN\s+public\.jobs\.retainage_dropoff_percent\s+IS/i.test(src),
    "migration must COMMENT ON COLUMN public.jobs.retainage_dropoff_percent"
  );
});

// ── down migration (Amendment I) ─────────────────────────────────────

test("00071.down.sql reverses in strict reverse-dependency order", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");

  // draws columns dropped
  for (const col of [
    "tm_markup_amount", "tm_sub_cost", "tm_material_cost", "tm_labor_hours",
    "milestone_completions", "draw_mode",
  ]) {
    assert.ok(
      new RegExp(`DROP\\s+COLUMN\\s+IF\\s+EXISTS\\s+${col}\\b`, "i").test(src),
      `down must DROP COLUMN IF EXISTS draws.${col}`
    );
  }

  // jobs new columns dropped (CHECK constraints auto-drop with column)
  for (const col of ["retainage_threshold_percent", "retainage_dropoff_percent"]) {
    assert.ok(
      new RegExp(`DROP\\s+COLUMN\\s+IF\\s+EXISTS\\s+${col}\\b`, "i").test(src),
      `down must DROP COLUMN IF EXISTS jobs.${col}`
    );
  }

  // job_milestones policies dropped
  for (const pol of [
    "job_milestones_org_update",
    "job_milestones_org_insert",
    "job_milestones_org_read",
  ]) {
    assert.ok(
      new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+${pol}\\s+ON\\s+public\\.job_milestones`, "i").test(src),
      `down must DROP POLICY IF EXISTS ${pol}`
    );
  }

  // RLS disabled + trigger dropped + indexes dropped + table dropped
  assert.ok(
    /ALTER\s+TABLE\s+public\.job_milestones\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(src),
    "down must DISABLE RLS on job_milestones"
  );
  assert.ok(
    /DROP\s+TRIGGER\s+IF\s+EXISTS\s+trg_job_milestones_updated_at/i.test(src),
    "down must DROP TRIGGER trg_job_milestones_updated_at"
  );
  for (const idx of [
    "idx_job_milestones_target_date",
    "idx_job_milestones_status",
    "idx_job_milestones_org_job",
    "job_milestones_unique_sort_per_job",
  ]) {
    assert.ok(
      new RegExp(`DROP\\s+INDEX\\s+IF\\s+EXISTS\\s+${idx}\\b`, "i").test(src),
      `down must DROP INDEX IF EXISTS ${idx}`
    );
  }
  assert.ok(
    /DROP\s+TABLE\s+IF\s+EXISTS\s+public\.job_milestones\b/i.test(src),
    "down must DROP TABLE IF EXISTS public.job_milestones"
  );
});

test("00071.down.sql includes commented-out GH #5 rollback block (Amendment I — undo path documented, not executed)", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");
  // The block must reference jobs_retainage_percent_check AND must be commented.
  // Heuristic: find a block of --- prefixed lines that contain both the constraint
  // name and an ADD CONSTRAINT / ADD CHECK sketch.
  assert.ok(
    /--[^\n]*jobs_retainage_percent_check/i.test(src),
    "down.sql must reference jobs_retainage_percent_check in a commented-out block"
  );
  assert.ok(
    /--[^\n]*(ADD\s+CONSTRAINT|ADD\s+CHECK|CHECK\s*\()/i.test(src),
    "down.sql must sketch the re-add CHECK as a commented-out ADD CONSTRAINT (Amendment I)"
  );
  // Ensure the block is NOT live SQL (would re-add the duplicate on rollback).
  assert.ok(
    !/^\s*ALTER\s+TABLE\s+public\.jobs\s+ADD\s+CONSTRAINT\s+jobs_retainage_percent_check\b/im.test(src),
    "re-add of jobs_retainage_percent_check must be commented out, never live SQL (otherwise rollback re-introduces the duplicate the up migration just resolved)"
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
