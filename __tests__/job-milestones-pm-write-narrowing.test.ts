/**
 * Phase 2.7 §5.7 addendum — R.15.
 *
 * Migration 00072 closes the defense-in-depth asymmetry surfaced
 * in qa-reports/qa-branch2-phase2.7.md §5.7: job_milestones_
 * org_read narrowed PMs via EXISTS on public.jobs.pm_id, but
 * job_milestones_org_insert / org_update only gated on role +
 * org_id. Because public.jobs has no PM-narrowed SELECT policy
 * (unlike public.draws), FK-through-RLS didn't catch cross-job
 * PM INSERTs.
 *
 * 00072 rewrites both write policies to include the same
 * EXISTS predicate the read policy uses. Writes now match
 * reads.
 *
 * This file is static: regex assertions against the migration
 * SQL + .down.sql. Dynamic live-auth RLS probes verifying the
 * fix (Martin on Fish succeeds, Martin on Dewberry rejected)
 * fire during Migration Dry-Run and are recorded in the
 * Phase 2.7 QA report §5.10.
 *
 * Pattern matches __tests__/milestones-retainage.test.ts.
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

const MIGRATION = "supabase/migrations/00072_job_milestones_pm_write_narrowing.sql";
const MIGRATION_DOWN = "supabase/migrations/00072_job_milestones_pm_write_narrowing.down.sql";

// ── migration file existence ─────────────────────────────────────────

test("migration 00072 exists", () => {
  assert.ok(existsSync(MIGRATION), `${MIGRATION} missing`);
});

test("migration 00072 has a rollback companion (.down.sql)", () => {
  assert.ok(existsSync(MIGRATION_DOWN), `${MIGRATION_DOWN} missing`);
});

// ── header documentation ─────────────────────────────────────────────

test("migration 00072 header cites Phase 2.7 QA §5.7 asymmetry context", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /QA\s*§?\s*5\.7|qa-branch2-phase2\.7\.md|§\s*5\.7/i.test(src),
    "header must cite Phase 2.7 QA §5.7 as the asymmetry source"
  );
  assert.ok(
    /c05da3a/i.test(src),
    "header should cite Phase 2.7 feature commit c05da3a"
  );
});

test("migration 00072 header documents the FK-through-RLS rationale", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /FK[- ]through[- ]RLS|emergent\s+defense/i.test(src),
    "header must reference FK-through-RLS / emergent-defense context"
  );
  assert.ok(
    /public\.jobs/i.test(src) && /public\.draws/i.test(src),
    "header must contrast public.jobs (org-wide readable) vs. public.draws (PM-narrowed)"
  );
});

// ── policy DROP + recreate with EXISTS narrowing ─────────────────────

test("migration 00072 drops the existing insert + update policies", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /DROP\s+POLICY\s+IF\s+EXISTS\s+job_milestones_org_insert\s+ON\s+public\.job_milestones/i.test(src),
    "migration must DROP POLICY job_milestones_org_insert"
  );
  assert.ok(
    /DROP\s+POLICY\s+IF\s+EXISTS\s+job_milestones_org_update\s+ON\s+public\.job_milestones/i.test(src),
    "migration must DROP POLICY job_milestones_org_update"
  );
});

test("migration 00072 recreates INSERT policy with PM-narrowing EXISTS clause", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+POLICY\s+job_milestones_org_insert\s+ON\s+public\.job_milestones\s+FOR\s+INSERT[\s\S]*?;/i
  );
  assert.ok(match, "could not locate CREATE POLICY job_milestones_org_insert");
  const body = match![0];
  assert.ok(
    /role\s+IN\s*\(\s*'owner'\s*,\s*'admin'\s*,\s*'pm'\s*,\s*'accounting'\s*\)/i.test(body),
    "insert policy must still gate on the 4-role workflow-data write set"
  );
  assert.ok(
    /app_private\.user_role\(\)\s*=\s*'pm'/i.test(body),
    "insert policy must branch on user_role() = 'pm'"
  );
  assert.ok(
    /EXISTS\s*\([\s\S]*?public\.jobs\s+j[\s\S]*?j\.pm_id\s*=\s*auth\.uid\(\)/is.test(body),
    "insert policy must include EXISTS subquery traversing public.jobs.pm_id = auth.uid() — matches read-policy narrowing"
  );
  assert.ok(
    /user_role\(\)\s+IN\s*\(\s*'owner'\s*,\s*'admin'\s*,\s*'accounting'\s*\)/i.test(body),
    "insert policy must let owner/admin/accounting through without the PM EXISTS gate"
  );
});

test("migration 00072 recreates UPDATE policy with PM-narrowing EXISTS clause", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+POLICY\s+job_milestones_org_update\s+ON\s+public\.job_milestones\s+FOR\s+UPDATE[\s\S]*?;/i
  );
  assert.ok(match, "could not locate CREATE POLICY job_milestones_org_update");
  const body = match![0];
  assert.ok(
    /EXISTS\s*\([\s\S]*?public\.jobs\s+j[\s\S]*?j\.pm_id\s*=\s*auth\.uid\(\)/is.test(body),
    "update policy must include EXISTS subquery traversing public.jobs.pm_id = auth.uid()"
  );
  assert.ok(
    /app_private\.user_role\(\)\s*=\s*'pm'/i.test(body),
    "update policy must branch on user_role() = 'pm'"
  );
  assert.ok(
    /user_role\(\)\s+IN\s*\(\s*'owner'\s*,\s*'admin'\s*,\s*'accounting'\s*\)/i.test(body),
    "update policy must let owner/admin/accounting through without the PM EXISTS gate"
  );
});

test("migration 00072 preserves the read policy (no DROP / CREATE of job_milestones_org_read)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    !/DROP\s+POLICY[^;]*job_milestones_org_read/i.test(src),
    "migration must NOT drop the read policy — asymmetry is fixed by tightening writes, not re-touching reads"
  );
  assert.ok(
    !/CREATE\s+POLICY\s+job_milestones_org_read/i.test(src),
    "migration must NOT recreate the read policy"
  );
});

test("migration 00072 policy count regression fence — still exactly 3 policies total after the swap", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const drops = src.match(
    /DROP\s+POLICY\s+IF\s+EXISTS\s+\S+\s+ON\s+public\.job_milestones\b/gi
  );
  const creates = src.match(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.job_milestones\b/gi
  );
  assert.strictEqual(
    drops?.length ?? 0,
    2,
    `migration should drop exactly 2 policies (insert + update); found ${drops?.length ?? 0}`
  );
  assert.strictEqual(
    creates?.length ?? 0,
    2,
    `migration should recreate exactly 2 policies (insert + update); found ${creates?.length ?? 0}`
  );
  assert.ok(
    !/CREATE\s+POLICY\s+\S+\s+ON\s+public\.job_milestones\s+FOR\s+DELETE/i.test(src),
    "no DELETE policy — soft-delete via deleted_at (R.23 precedent)"
  );
});

// ── down migration ────────────────────────────────────────────────────

test("00072.down.sql restores the pre-fix insert + update policies (no EXISTS clause)", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");
  assert.ok(
    /DROP\s+POLICY\s+IF\s+EXISTS\s+job_milestones_org_insert\s+ON\s+public\.job_milestones/i.test(src),
    "down must DROP the narrowed insert policy"
  );
  assert.ok(
    /DROP\s+POLICY\s+IF\s+EXISTS\s+job_milestones_org_update\s+ON\s+public\.job_milestones/i.test(src),
    "down must DROP the narrowed update policy"
  );
  // Down should recreate both policies in their ORIGINAL non-narrowed shape.
  const insertMatch = src.match(
    /CREATE\s+POLICY\s+job_milestones_org_insert\s+ON\s+public\.job_milestones\s+FOR\s+INSERT[\s\S]*?;/i
  );
  const updateMatch = src.match(
    /CREATE\s+POLICY\s+job_milestones_org_update\s+ON\s+public\.job_milestones\s+FOR\s+UPDATE[\s\S]*?;/i
  );
  assert.ok(insertMatch, "down must CREATE POLICY job_milestones_org_insert (restored shape)");
  assert.ok(updateMatch, "down must CREATE POLICY job_milestones_org_update (restored shape)");
  for (const body of [insertMatch![0], updateMatch![0]]) {
    assert.ok(
      !/EXISTS\s*\([\s\S]*?j\.pm_id\s*=\s*auth\.uid\(\)/is.test(body),
      "restored policy must NOT include the EXISTS pm_id narrowing (restoring pre-fix asymmetric shape)"
    );
    assert.ok(
      /role\s+IN\s*\(\s*'owner'\s*,\s*'admin'\s*,\s*'pm'\s*,\s*'accounting'\s*\)/i.test(body),
      "restored policy must still gate on the 4-role workflow-data write set"
    );
  }
});

test("00072.down.sql documents that rollback restores the asymmetry (not a fresh bug)", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");
  assert.ok(
    /asymmetry|§\s*5\.7|QA|pre[- ]fix/i.test(src),
    "down.sql must document that reverting restores the §5.7 asymmetric shape (intentional property of the rollback path)"
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
