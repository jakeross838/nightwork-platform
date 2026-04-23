/**
 * GH #18 regression fence — R.15.
 *
 * Background
 * ----------
 * Any `.from("org_members")` query filtered by `.eq("user_id", X)` +
 * `.eq("is_active", true)` can legitimately return MULTIPLE rows when the
 * user is an active member of 2+ orgs (real scenario: Ross Built staff,
 * platform-admin accounts, QA test users, anyone demo'd across multiple
 * tenant orgs). Calling `.maybeSingle()` on such a query throws "JSON
 * object requested, multiple (or no) rows returned" — the GH #18 bug.
 * Calling `.single()` has the same problem plus throws on 0 rows.
 *
 * Fix pattern (applied in commit landing alongside this test):
 *
 *   .from("org_members")
 *   .select("role, ...")
 *   .eq("user_id", userId)
 *   .eq("is_active", true)
 *   .order("created_at", { ascending: true })
 *   .limit(1)
 *   .maybeSingle()
 *
 * Tiebreaker rule: **oldest membership wins** (identity permanence —
 * primary org = first org joined). Don't flip to DESC without reasoning
 * through why newer memberships should take precedence.
 *
 * Legitimate compound lookups — `.eq("user_id", X).eq("org_id", Y)` or
 * `.eq("id", membershipId)` — are carve-outs; those scope to exactly one
 * row by design and don't need ordering.
 *
 * This fence is a STATIC SCAN of `src/` — no live DB required. Pattern
 * matches __tests__/document-extractions-rename.test.ts (Phase 3.1) and
 * __tests__/status-enum-alignment.test.ts: walk the source tree, grep
 * each .ts/.tsx file, flag offenders.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { strict as assert } from "node:assert";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

const SRC_ROOT = "src";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

function findOrgMemberSingleCalls(source: string): string[] {
  const out: string[] = [];
  // Match .from("org_members") ... .maybeSingle() or .single(). Non-greedy:
  // a query chain must end at the FIRST terminal single-row call, not span
  // across multiple queries. The [\s\S] class handles multi-line chains.
  const re = /\.from\(['"]org_members['"]\)[\s\S]*?\.(maybeSingle|single)\(\)/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const chain = m[0];
    // Reject chains that cross a query boundary: if another `.from(` appears
    // between our `.from("org_members")` and the terminal single-row call,
    // the regex match leaked into a downstream unrelated query. Example:
    // a list-returning org_members query (no `.maybeSingle()`) followed by
    // a different table's `.maybeSingle()` inside a `Promise.all([...])`.
    const fromCount = (chain.match(/\.from\(/g) ?? []).length;
    if (fromCount > 1) continue;
    out.push(chain);
  }
  return out;
}

const files = walk(SRC_ROOT);

test(
  "sanity: src/ tree contains .from('org_members') in ≥10 files",
  () => {
    const withOrg = files.filter((f) =>
      /\.from\(['"]org_members['"]\)/.test(readFileSync(f, "utf8")),
    );
    assert.ok(
      withOrg.length >= 10,
      `expected ≥10 src files referencing org_members — found ${withOrg.length}. Walker may be broken.`,
    );
  },
);

test(
  "no .from('org_members').maybeSingle()/single() chain filters by user_id without .order('created_at' ...) or .eq('org_id' ...) (GH #18)",
  () => {
    const offenders: { file: string; chain: string }[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const chain of findOrgMemberSingleCalls(source)) {
        // Only user-id filters can match multiple rows; .eq("id", PK) is fine.
        if (!/\.eq\(['"]user_id['"]/.test(chain)) continue;
        // Composite filter on org_id scopes to exactly 1 membership — fine.
        if (/\.eq\(['"]org_id['"]/.test(chain)) continue;
        // Must have deterministic ordering on created_at.
        if (/\.order\(['"]created_at['"]/.test(chain)) continue;
        offenders.push({
          file,
          chain: chain.replace(/\s+/g, " ").slice(0, 180),
        });
      }
    }
    if (offenders.length > 0) {
      const lines = offenders.map(
        (o) => `  ${o.file}\n    ${o.chain}`,
      );
      assert.fail(
        `Found ${offenders.length} multi-org anti-pattern site(s). Each must add .order('created_at', { ascending: true }).limit(1) before .maybeSingle()/single(), or filter by org_id for composite lookup:\n\n${lines.join("\n\n")}`,
      );
    }
  },
);

test(
  "tiebreaker on org_members is ascending (oldest membership wins) — no descending order on user_id-scoped queries",
  () => {
    const offenders: { file: string; chain: string }[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const chain of findOrgMemberSingleCalls(source)) {
        if (!/\.eq\(['"]user_id['"]/.test(chain)) continue;
        if (/\.eq\(['"]org_id['"]/.test(chain)) continue;
        const orderMatch = chain.match(
          /\.order\(['"]created_at['"]\s*(?:,\s*\{([^}]*)\})?/,
        );
        if (!orderMatch) continue; // previous test flags missing-order chains
        const opts = orderMatch[1] ?? "";
        if (/ascending\s*:\s*false/.test(opts)) {
          offenders.push({
            file,
            chain: chain.replace(/\s+/g, " ").slice(0, 180),
          });
        }
      }
    }
    if (offenders.length > 0) {
      const lines = offenders.map(
        (o) => `  ${o.file}\n    ${o.chain}`,
      );
      assert.fail(
        `Found ${offenders.length} site(s) ordering org_members by created_at DESC on user_id-scoped queries. Tiebreaker is oldest-wins — use { ascending: true } or omit the options object entirely:\n\n${lines.join("\n\n")}`,
      );
    }
  },
);

test(
  "every user_id-scoped chain also has .limit(1) before .maybeSingle()/single() (defense-in-depth against .order unused when more than 1 row returns)",
  () => {
    const offenders: { file: string; chain: string }[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const chain of findOrgMemberSingleCalls(source)) {
        if (!/\.eq\(['"]user_id['"]/.test(chain)) continue;
        if (/\.eq\(['"]org_id['"]/.test(chain)) continue;
        // Require .limit(1) — without it, .maybeSingle still throws on >1 rows
        if (!/\.limit\(\s*1\s*\)/.test(chain)) {
          offenders.push({
            file,
            chain: chain.replace(/\s+/g, " ").slice(0, 180),
          });
        }
      }
    }
    if (offenders.length > 0) {
      const lines = offenders.map(
        (o) => `  ${o.file}\n    ${o.chain}`,
      );
      assert.fail(
        `Found ${offenders.length} site(s) missing .limit(1). Without limit, .order('created_at') is cosmetic and .maybeSingle() still throws when ≥2 matching rows exist:\n\n${lines.join("\n\n")}`,
      );
    }
  },
);

// ---------------------------------------------------------------
// Runner — matches the convention in every other __tests__/*.ts
// ---------------------------------------------------------------
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
