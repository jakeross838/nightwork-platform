/**
 * Phase 2.9 regression fence — R.15.
 *
 * Migration 00074 adds public.client_portal_access and
 * public.client_portal_messages + 3 SECURITY DEFINER RPCs
 * (create_client_portal_invite / submit_client_portal_message /
 * mark_client_portal_message_read). Backs the Branch 3/4 client-
 * portal UI: hashed long-lived tokens, sliding-window expires_at,
 * mixed authenticated + anon write surface.
 *
 * Plan amendments A-O + P landed at commit beb70db. Pre-flight
 * findings at qa-reports/preflight-branch2-phase2.9.md (commit
 * 9fb9544).
 *
 * NO R.23 DIVERGENCE. Composition: 3-policy + PM-on-own-jobs from
 * job_milestones/00071+00072 + role-narrowing from approval_chains/
 * 00070 + Amendment F.2 SECURITY DEFINER pattern extended to anon
 * grant.
 *
 * AMENDMENT D (token hardening — threat-model raise from org_invites):
 * column is access_token_hash (NOT access_token); stores SHA-256 hex
 * of a 64-char hex plaintext generated server-side and returned ONCE
 * by create_client_portal_invite. CHECK(char_length = 64) rejects
 * accidental plaintext (48-char gen_random_bytes(24) hex).
 *
 * AMENDMENT J (first anon-grant in Branch 2): submit_message +
 * mark_read RPCs grant EXECUTE to anon. Defense is the in-body
 * token validation (hash compare + revoked_at + expires_at);
 * invalid/revoked/expired produces silent no-op (timing-oracle
 * defense).
 *
 * AMENDMENT N (visibility_config CHECK + COMMENT). Performance
 * fallback to COMMENT-only documented in header if Dry-Run surfaces
 * regression; this test fences the kept-CHECK path and documents the
 * fallback alternative.
 *
 * Role-set asymmetry (intentional): client_portal_access write
 * role-set = (owner, admin, pm) — accounting EXCLUDED (Decision #2);
 * client_portal_messages INSERT role-set = (owner, admin, pm,
 * accounting) — accounting INCLUDED for billing-question responses.
 *
 * This test file is static: regex assertions against migration SQL
 * text + .down.sql. Dynamic DB probes (live-auth RLS, GRANT
 * verification via has_function_privilege, RPC token-hashing /
 * sliding-window behavior, visibility_config CHECK negative probes,
 * XOR CHECK negative probes, Amendment N latency measurement) fire
 * during the Migration Dry-Run per R.19 and are recorded in
 * qa-reports/qa-branch2-phase2.9.md.
 *
 * Pattern matches __tests__/pricing-history.test.ts (Phase 2.8) and
 * __tests__/milestones-retainage.test.ts (Phase 2.7).
 */
import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

type Case = { name: string; fn: () => void };
const cases: Case[] = [];
const test = (name: string, fn: () => void) => cases.push({ name, fn });

const MIGRATION = "supabase/migrations/00074_client_portal.sql";
const MIGRATION_DOWN = "supabase/migrations/00074_client_portal.down.sql";

// ── migration file existence ─────────────────────────────────────────

test("migration 00074 exists", () => {
  assert.ok(existsSync(MIGRATION), `${MIGRATION} missing`);
});

test("migration 00074 has a rollback companion (.down.sql)", () => {
  assert.ok(existsSync(MIGRATION_DOWN), `${MIGRATION_DOWN} missing`);
});

// ── header documentation (Amendment O) ───────────────────────────────

test("migration 00074 header cites plan-amendment commit beb70db", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(/beb70db/i.test(src), "header must cite plan-amendment commit beb70db");
});

test("migration 00074 header cites pre-flight commit 9fb9544", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(/9fb9544/i.test(src), "header must cite pre-flight commit 9fb9544");
});

test("migration 00074 header documents NO R.23 divergence + composition rationale", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(/R\.23/i.test(src), "header must invoke R.23 framing");
  assert.ok(
    /no\s+r\.23\s+divergence|composition|composes\s+from/i.test(src),
    "header must explicitly state no-divergence and composition rationale"
  );
  assert.ok(
    /job_milestones/i.test(src),
    "header must cite job_milestones precedent (PM-on-own-jobs narrowing)"
  );
  assert.ok(
    /approval_chains/i.test(src),
    "header must cite approval_chains precedent (role-set narrowing)"
  );
});

test("migration 00074 header documents Amendment D token-hardening + org_invites threat-model divergence", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(/SHA-?256|sha256/i.test(src), "header must reference SHA-256 hashing");
  assert.ok(
    /org_invites/i.test(src),
    "header must compare against org_invites precedent"
  );
  assert.ok(
    /threat[- ]?model|security\s+bar|long[- ]lived|14[- ]?day/i.test(src),
    "header must articulate the threat-model raise vs org_invites"
  );
  assert.ok(
    /never\s+stor|plaintext\s+(?:never|is\s+returned\s+)?once/i.test(src),
    "header must state that plaintext is never stored / returned once"
  );
});

test("migration 00074 header documents first anon-grant in Branch 2 + GRANT lineage", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /first\s+anon[- ]?grant/i.test(src),
    "header must label this as the first anon-grant in Branch 2"
  );
  assert.ok(
    /00032/.test(src) && /00067/.test(src) && /00070/.test(src) && /00073/.test(src),
    "header must cite the 00032 → 00067 → 00070 → 00073 Amendment F.2 GRANT-pattern lineage"
  );
});

test("migration 00074 header documents sliding-window expires_at (90-day auto-extend)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /sliding[- ]window/i.test(src),
    "header must label expires_at as sliding-window"
  );
  assert.ok(
    /90\s*days?/i.test(src),
    "header must document the 90-day default / extension window"
  );
});

test("migration 00074 header documents append-only messages (Decision #7)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /append[- ]only/i.test(src),
    "header must document append-only message semantic"
  );
});

test("migration 00074 header documents service-role API portal-read path (Decision #1)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /service[- ]role/i.test(src),
    "header must document the service-role portal-read path"
  );
});

test("migration 00074 header documents role-set asymmetry between tables", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Must mention both that accounting is excluded from access AND
  // that accounting is included on messages.
  assert.ok(
    /accounting/i.test(src),
    "header must explicitly discuss accounting role inclusion/exclusion across the two tables"
  );
});

test("migration 00074 header references GH #17 security-review checklist", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /GH\s*#17|issue\s*#17/i.test(src),
    "header must reference GH #17 (Branch 3/4 client-portal security review)"
  );
});

// ── client_portal_access table (Amendments A / B / D / E / N) ────────

test("migration 00074 creates public.client_portal_access table", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.client_portal_access\s*\(/i.test(src),
    "migration must CREATE TABLE public.client_portal_access"
  );
});

test("migration 00074 client_portal_access has full column set (Amendments A / B / D / N)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.client_portal_access\s*\(([\s\S]*?)\n\)\s*;/i
  );
  assert.ok(match, "could not locate client_portal_access CREATE TABLE body");
  const body = match![1];
  const required: Array<[string, RegExp]> = [
    ["id PK uuid", /\bid\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\s*\(\s*\)/i],
    ["org_id NOT NULL FK", /\borg_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.organizations\s*\(\s*id\s*\)/i],
    ["job_id NOT NULL FK", /\bjob_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.jobs\s*\(\s*id\s*\)/i],
    ["email NOT NULL", /\bemail\s+TEXT\s+NOT\s+NULL\b/i],
    ["name nullable text", /\bname\s+TEXT\b/i],
    ["access_token_hash NOT NULL CHECK len=64", /\baccess_token_hash\s+TEXT\s+NOT\s+NULL[\s\S]*?CHECK\s*\(\s*char_length\s*\(\s*access_token_hash\s*\)\s*=\s*64\s*\)/i],
    ["visibility_config JSONB NOT NULL DEFAULT '{}' (Amendment N)", /\bvisibility_config\s+JSONB\s+NOT\s+NULL\s+DEFAULT\s+'{}'::jsonb/i],
    ["invited_at NOT NULL DEFAULT now()", /\binvited_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\s*\(\s*\)/i],
    ["last_accessed_at nullable", /\blast_accessed_at\s+TIMESTAMPTZ\b/i],
    ["revoked_at nullable", /\brevoked_at\s+TIMESTAMPTZ\b/i],
    ["expires_at NOT NULL DEFAULT now()+90 days", /\bexpires_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s*\(\s*now\s*\(\s*\)\s*\+\s*interval\s+'90 days'\s*\)/i],
    ["created_at NOT NULL DEFAULT now()", /\bcreated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\s*\(\s*\)/i],
    ["updated_at NOT NULL DEFAULT now()", /\bupdated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\s*\(\s*\)/i],
    ["created_by FK auth.users (nullable)", /\bcreated_by\s+UUID\s+REFERENCES\s+auth\.users\s*\(\s*id\s*\)/i],
  ];
  for (const [label, re] of required) {
    assert.ok(re.test(body), `client_portal_access body must contain ${label}`);
  }
});

test("migration 00074 client_portal_access column is access_token_hash (NOT access_token) — Amendment D rename guard", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.client_portal_access\s*\(([\s\S]*?)\n\)\s*;/i
  );
  assert.ok(match, "could not locate client_portal_access CREATE TABLE body");
  const body = match![1];
  // Amendment D defect guard — the original spec used access_token (plaintext);
  // Amendment D renames to access_token_hash. A future reverter must not
  // reintroduce the plaintext column.
  assert.ok(
    !/\baccess_token\s+TEXT\b/i.test(body),
    "Amendment D defect guard — must NOT have a bare access_token column (plaintext storage rejected by threat-model raise; column is access_token_hash)"
  );
  assert.ok(
    /\baccess_token_hash\s+TEXT\b/i.test(body),
    "must declare access_token_hash TEXT (Amendment D — SHA-256 hex digest storage)"
  );
});

test("migration 00074 client_portal_access has 64-char length CHECK on access_token_hash (Amendment D)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CHECK\s*\(\s*char_length\s*\(\s*access_token_hash\s*\)\s*=\s*64\s*\)/i.test(src),
    "must have CHECK (char_length(access_token_hash) = 64) — rejects 48-char gen_random_bytes(24) hex (org_invites pattern) while accepting SHA-256 hex"
  );
});

test("migration 00074 client_portal_access has visibility_config CHECK + validator function (Amendment N — Defect #2 workaround)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Defect #2: Postgres rejects subqueries in CHECK constraints
  // (error 0A000). Plan-doc inline CHECK with NOT EXISTS (SELECT
  // ... FROM jsonb_object_keys(...)) was invalid SQL. Migration
  // refactors to an IMMUTABLE helper function called from CHECK,
  // preserving Amendment N's DB-layer validation intent.
  assert.ok(
    /CHECK\s*\(\s*public\.validate_visibility_config\s*\(\s*visibility_config\s*\)\s*\)/i.test(src),
    "visibility_config CHECK must delegate to public.validate_visibility_config(visibility_config) (Amendment N — Defect #2 workaround)"
  );
  // Validator function must exist and be IMMUTABLE
  assert.ok(
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.validate_visibility_config\s*\(\s*p_config\s+JSONB\s*\)[\s\S]*?LANGUAGE\s+plpgsql\s+IMMUTABLE/i.test(src),
    "public.validate_visibility_config(JSONB) must be declared IMMUTABLE plpgsql"
  );
  // Validator body must enumerate keys + check value types
  assert.ok(
    /jsonb_object_keys\s*\(\s*p_config\s*\)/i.test(src),
    "validator body must enumerate keys via jsonb_object_keys(p_config)"
  );
  assert.ok(
    /jsonb_typeof\s*\(\s*p_config\s*->\s*_?key\s*\)\s*<>\s*'boolean'/i.test(src),
    "validator body must reject values whose jsonb_typeof != 'boolean'"
  );
  // Verify the 7 expected key names are listed in the validator's allowed set
  for (const key of [
    "show_invoices",
    "show_budget",
    "show_schedule",
    "show_change_orders",
    "show_draws",
    "show_lien_releases",
    "show_daily_logs",
  ]) {
    assert.ok(
      new RegExp(`'${key}'`).test(src),
      `validator allowed-set must list expected key '${key}'`
    );
  }
});

// ── client_portal_messages table (Amendments C / F / G) ──────────────

test("migration 00074 creates public.client_portal_messages table", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.client_portal_messages\s*\(/i.test(src),
    "migration must CREATE TABLE public.client_portal_messages"
  );
});

test("migration 00074 client_portal_messages has full column set (Amendments C / G)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.client_portal_messages\s*\(([\s\S]*?)\n\)\s*;/i
  );
  assert.ok(match, "could not locate client_portal_messages CREATE TABLE body");
  const body = match![1];
  const required: Array<[string, RegExp]> = [
    ["id PK uuid", /\bid\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\s*\(\s*\)/i],
    ["org_id NOT NULL FK", /\borg_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.organizations\s*\(\s*id\s*\)/i],
    ["job_id NOT NULL FK", /\bjob_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.jobs\s*\(\s*id\s*\)/i],
    ["from_type NOT NULL CHECK builder|client", /\bfrom_type\s+TEXT\s+NOT\s+NULL\s+CHECK\s*\(\s*from_type\s+IN\s*\(\s*'builder'\s*,\s*'client'\s*\)\s*\)/i],
    ["from_user_id FK auth.users ON DELETE SET NULL (Amendment G)", /\bfrom_user_id\s+UUID\s+REFERENCES\s+auth\.users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+SET\s+NULL/i],
    ["from_client_email TEXT", /\bfrom_client_email\s+TEXT\b/i],
    ["message NOT NULL", /\bmessage\s+TEXT\s+NOT\s+NULL\b/i],
    ["read_at nullable", /\bread_at\s+TIMESTAMPTZ\b/i],
    ["created_at NOT NULL DEFAULT now()", /\bcreated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\s*\(\s*\)/i],
    ["created_by FK auth.users", /\bcreated_by\s+UUID\s+REFERENCES\s+auth\.users\s*\(\s*id\s*\)/i],
  ];
  for (const [label, re] of required) {
    assert.ok(re.test(body), `client_portal_messages body must contain ${label}`);
  }
});

test("migration 00074 client_portal_messages has NO updated_at (Amendment C — append-only)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.client_portal_messages\s*\(([\s\S]*?)\n\)\s*;/i
  );
  assert.ok(match, "could not locate client_portal_messages CREATE TABLE body");
  const body = match![1];
  assert.ok(
    !/\bupdated_at\b/i.test(body),
    "client_portal_messages must NOT have updated_at (Amendment C — append-only; only read_at flips via narrow paths)"
  );
});

test("migration 00074 client_portal_messages has NO deleted_at (Amendment C — append-only)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.client_portal_messages\s*\(([\s\S]*?)\n\)\s*;/i
  );
  assert.ok(match, "could not locate client_portal_messages CREATE TABLE body");
  const body = match![1];
  assert.ok(
    !/\bdeleted_at\b/i.test(body),
    "client_portal_messages must NOT have deleted_at (Amendment C — append-only historical record; correction is platform-admin service-role DELETE)"
  );
  assert.ok(
    !/\bretracted_at\b/i.test(body),
    "client_portal_messages must NOT have retracted_at (Decision #7 — no retraction at this phase)"
  );
});

test("migration 00074 client_portal_messages has XOR CHECK on from_type / from_user_id / from_client_email (Amendment F)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Amendment F XOR: builder ⇒ from_user_id present + from_client_email NULL;
  // client ⇒ from_client_email present + from_user_id NULL.
  assert.ok(
    /CHECK\s*\(\s*\(\s*from_type\s*=\s*'builder'\s+AND\s+from_user_id\s+IS\s+NOT\s+NULL\s+AND\s+from_client_email\s+IS\s+NULL\s*\)\s+OR\s+\(\s*from_type\s*=\s*'client'\s+AND\s+from_client_email\s+IS\s+NOT\s+NULL\s+AND\s+from_user_id\s+IS\s+NULL\s*\)\s*\)/i.test(src),
    "Amendment F: must have XOR CHECK enforcing builder↔from_user_id and client↔from_client_email exclusivity"
  );
});

// ── indexes (Amendment K — 5 total) ──────────────────────────────────

test("migration 00074 creates partial UNIQUE index on access_token_hash WHERE revoked_at IS NULL (Amendment D + K)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+UNIQUE\s+INDEX\s+idx_client_portal_access_token_hash\s+ON\s+public\.client_portal_access\s*\(\s*access_token_hash\s*\)\s+WHERE\s+revoked_at\s+IS\s+NULL/i.test(src),
    "must create idx_client_portal_access_token_hash UNIQUE on (access_token_hash) WHERE revoked_at IS NULL — hot-path RPC token lookup"
  );
});

test("migration 00074 creates partial UNIQUE on (org_id, job_id, email) WHERE revoked_at IS NULL (Amendment E)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+UNIQUE\s+INDEX\s+\w+\s+ON\s+public\.client_portal_access\s*\(\s*org_id\s*,\s*job_id\s*,\s*email\s*\)\s+WHERE\s+revoked_at\s+IS\s+NULL/i.test(src),
    "must create UNIQUE INDEX on (org_id, job_id, email) WHERE revoked_at IS NULL (Amendment E — dedup partial)"
  );
});

test("migration 00074 creates idx_client_portal_access_org_job partial index", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+INDEX\s+idx_client_portal_access_org_job\s+ON\s+public\.client_portal_access\s*\(\s*org_id\s*,\s*job_id\s*\)\s+WHERE\s+revoked_at\s+IS\s+NULL/i.test(src),
    "must create idx_client_portal_access_org_job (org_id, job_id) WHERE revoked_at IS NULL"
  );
});

test("migration 00074 creates idx_client_portal_access_email partial index", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+INDEX\s+idx_client_portal_access_email\s+ON\s+public\.client_portal_access\s*\(\s*email\s*\)\s+WHERE\s+revoked_at\s+IS\s+NULL/i.test(src),
    "must create idx_client_portal_access_email (email) WHERE revoked_at IS NULL"
  );
});

test("migration 00074 creates idx_client_portal_messages_timeline (org_id, job_id, created_at DESC)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+INDEX\s+idx_client_portal_messages_timeline\s+ON\s+public\.client_portal_messages\s*\(\s*org_id\s*,\s*job_id\s*,\s*created_at\s+DESC\s*\)/i.test(src),
    "must create idx_client_portal_messages_timeline (org_id, job_id, created_at DESC)"
  );
});

test("migration 00074 creates idx_client_portal_messages_unread partial index", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+INDEX\s+idx_client_portal_messages_unread\s+ON\s+public\.client_portal_messages\s*\(\s*org_id\s*,\s*job_id\s*\)\s+WHERE\s+read_at\s+IS\s+NULL/i.test(src),
    "must create idx_client_portal_messages_unread (org_id, job_id) WHERE read_at IS NULL"
  );
});

// ── trigger (Amendment B — updated_at) ───────────────────────────────

test("migration 00074 creates trg_client_portal_access_updated_at trigger", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+TRIGGER\s+trg_client_portal_access_updated_at\s+BEFORE\s+UPDATE\s+ON\s+public\.client_portal_access\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.update_updated_at\s*\(\s*\)/i.test(src),
    "must register BEFORE UPDATE trigger trg_client_portal_access_updated_at using shared public.update_updated_at()"
  );
});

test("migration 00074 has NO trigger on client_portal_messages (Amendment C — append-only)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    !/CREATE\s+TRIGGER\s+\w+\s+(?:BEFORE|AFTER)\s+\w+(?:\s+OR\s+\w+)*\s+ON\s+public\.client_portal_messages\b/i.test(src),
    "client_portal_messages must NOT have triggers (Amendment C — append-only, no updated_at)"
  );
});

// ── RLS on client_portal_access (Amendment H — 3 policies) ───────────

test("migration 00074 enables RLS on both tables", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /ALTER\s+TABLE\s+public\.client_portal_access\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(src),
    "RLS must be enabled on client_portal_access"
  );
  assert.ok(
    /ALTER\s+TABLE\s+public\.client_portal_messages\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(src),
    "RLS must be enabled on client_portal_messages"
  );
});

test("migration 00074 client_portal_access has exactly 3 policies (no DELETE) — Amendment H", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const policyMatches = src.match(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.client_portal_access\b/gi
  );
  assert.strictEqual(
    policyMatches?.length,
    3,
    `EXACTLY 3 policies on client_portal_access required (Amendment H — read/insert/update; soft-delete via revoked_at); found ${policyMatches?.length ?? 0}`
  );
  assert.ok(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.client_portal_access\s+FOR\s+SELECT/i.test(src),
    "must have SELECT policy"
  );
  assert.ok(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.client_portal_access\s+FOR\s+INSERT/i.test(src),
    "must have INSERT policy"
  );
  assert.ok(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.client_portal_access\s+FOR\s+UPDATE/i.test(src),
    "must have UPDATE policy"
  );
  assert.ok(
    !/CREATE\s+POLICY\s+\S+\s+ON\s+public\.client_portal_access\s+FOR\s+DELETE/i.test(src),
    "NO DELETE policy allowed (Amendment H — soft-delete via revoked_at)"
  );
  assert.ok(
    !/CREATE\s+POLICY\s+\S+\s+ON\s+public\.client_portal_access\s+FOR\s+ALL/i.test(src),
    "NO FOR ALL policy allowed (would expose DELETE)"
  );
});

test("migration 00074 client_portal_access INSERT/UPDATE policies are 3-role (owner/admin/pm — accounting EXCLUDED) — Decision #2", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const insertMatch = src.match(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.client_portal_access\s+FOR\s+INSERT[\s\S]*?;/i
  );
  assert.ok(insertMatch, "could not locate client_portal_access INSERT policy");
  const insertBody = insertMatch![0];
  assert.ok(
    /user_role\s*\(\s*\)\s+IN\s*\(\s*'owner'\s*,\s*'admin'\s*,\s*'pm'\s*\)/i.test(insertBody),
    "client_portal_access INSERT role-set must be exactly ('owner','admin','pm') — accounting EXCLUDED per Decision #2"
  );
  // Defect guard: accounting must NOT appear in the access INSERT role-set
  assert.ok(
    !/user_role\s*\(\s*\)\s+IN\s*\([^)]*'accounting'/i.test(insertBody),
    "Decision #2 defect guard: client_portal_access INSERT must NOT include 'accounting' role"
  );

  const updateMatch = src.match(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.client_portal_access\s+FOR\s+UPDATE[\s\S]*?;/i
  );
  assert.ok(updateMatch, "could not locate client_portal_access UPDATE policy");
  const updateBody = updateMatch![0];
  assert.ok(
    /user_role\s*\(\s*\)\s+IN\s*\(\s*'owner'\s*,\s*'admin'\s*,\s*'pm'\s*\)/i.test(updateBody),
    "client_portal_access UPDATE role-set must be ('owner','admin','pm') — accounting EXCLUDED"
  );
});

test("migration 00074 client_portal_access write policies have PM-on-own-jobs narrowing (Amendment H)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Both INSERT and UPDATE policies must traverse jobs.pm_id = auth.uid()
  const writeMatches = src.match(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.client_portal_access\s+FOR\s+(?:INSERT|UPDATE)[\s\S]*?;/gi
  );
  assert.ok(writeMatches && writeMatches.length === 2, "expected 2 write policies on client_portal_access");
  for (const policy of writeMatches!) {
    assert.ok(
      /EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+public\.jobs\s+j\s+WHERE\s+j\.id\s*=\s*client_portal_access\.job_id\s+AND\s+j\.pm_id\s*=\s*auth\.uid\s*\(\s*\)/i.test(policy),
      "write policy must include PM-on-own-jobs EXISTS subquery (jobs.pm_id = auth.uid())"
    );
  }
});

test("migration 00074 client_portal_access SELECT policy has platform-admin bypass", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.client_portal_access\s+FOR\s+SELECT[\s\S]*?;/i
  );
  assert.ok(match, "could not locate client_portal_access SELECT policy");
  assert.ok(
    /is_platform_admin\s*\(\s*\)/i.test(match![0]),
    "SELECT policy must include is_platform_admin() bypass"
  );
});

// ── RLS on client_portal_messages (Amendment I — 3 policies) ─────────

test("migration 00074 client_portal_messages has exactly 3 policies (no DELETE) — Amendment I", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const policyMatches = src.match(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.client_portal_messages\b/gi
  );
  assert.strictEqual(
    policyMatches?.length,
    3,
    `EXACTLY 3 policies on client_portal_messages required (Amendment I — read/insert/read_at-flip-update); found ${policyMatches?.length ?? 0}`
  );
  assert.ok(
    !/CREATE\s+POLICY\s+\S+\s+ON\s+public\.client_portal_messages\s+FOR\s+DELETE/i.test(src),
    "NO DELETE policy allowed (Amendment C — append-only)"
  );
  assert.ok(
    !/CREATE\s+POLICY\s+\S+\s+ON\s+public\.client_portal_messages\s+FOR\s+ALL/i.test(src),
    "NO FOR ALL policy allowed (would expose DELETE)"
  );
});

test("migration 00074 client_portal_messages INSERT is 4-role (includes accounting) + WITH CHECK from_type='builder' — Amendment I + Decision #2", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.client_portal_messages\s+FOR\s+INSERT[\s\S]*?;/i
  );
  assert.ok(match, "could not locate client_portal_messages INSERT policy");
  const body = match![0];
  // Role-set is the 4-role set INCLUDING accounting (Decision #2 — billing
  // questions route to accounting, asymmetric vs access table).
  assert.ok(
    /user_role\s*\(\s*\)\s+IN\s*\(\s*'owner'\s*,\s*'admin'\s*,\s*'pm'\s*,\s*'accounting'\s*\)/i.test(body),
    "client_portal_messages INSERT role-set must INCLUDE 'accounting' (Decision #2 — asymmetric vs access table; billing questions route here)"
  );
  // WITH CHECK must constrain from_type = 'builder' (client side via RPC)
  assert.ok(
    /from_type\s*=\s*'builder'/i.test(body),
    "client_portal_messages INSERT WITH CHECK must enforce from_type = 'builder' (client-side INSERTs go through RPC, not RLS)"
  );
});

test("migration 00074 client_portal_messages UPDATE is narrow read_at-flip only (Amendment I)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.client_portal_messages\s+FOR\s+UPDATE[\s\S]*?;/i
  );
  assert.ok(match, "could not locate client_portal_messages UPDATE policy");
  const body = match![0];
  assert.ok(
    /from_type\s*=\s*'client'/i.test(body),
    "UPDATE policy must restrict to from_type = 'client' (only client messages can be marked read by builder)"
  );
  assert.ok(
    /read_at\s+IS\s+NULL/i.test(body),
    "UPDATE policy must restrict to read_at IS NULL (only flipping unread → read)"
  );
});

test("migration 00074 client_portal_messages SELECT policy has platform-admin bypass + PM narrowing", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+POLICY\s+\S+\s+ON\s+public\.client_portal_messages\s+FOR\s+SELECT[\s\S]*?;/i
  );
  assert.ok(match, "could not locate client_portal_messages SELECT policy");
  const body = match![0];
  assert.ok(
    /is_platform_admin\s*\(\s*\)/i.test(body),
    "SELECT policy must include is_platform_admin() bypass"
  );
  assert.ok(
    /EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+public\.jobs\s+j\s+WHERE\s+j\.id\s*=\s*client_portal_messages\.job_id\s+AND\s+j\.pm_id\s*=\s*auth\.uid\s*\(\s*\)/i.test(body),
    "SELECT policy must include PM-on-own-jobs EXISTS subquery"
  );
});

// ── 3 SECURITY DEFINER RPCs (Amendment J — first anon-grant) ─────────

test("migration 00074 declares create_client_portal_invite as SECURITY DEFINER + pinned search_path + GRANT to authenticated", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.create_client_portal_invite\s*\([\s\S]*?LANGUAGE\s+plpgsql\s+SECURITY\s+DEFINER[\s\S]*?SET\s+search_path\s*=\s*public\s*,\s*pg_temp/i.test(src),
    "create_client_portal_invite must be SECURITY DEFINER with pinned search_path"
  );
  assert.ok(
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.create_client_portal_invite\s*\([\s\S]*?\)\s+TO\s+authenticated\b/i.test(src),
    "create_client_portal_invite must GRANT EXECUTE TO authenticated (Amendment J — builder-side RPC)"
  );
});

test("migration 00074 declares submit_client_portal_message as SECURITY DEFINER + pinned search_path + GRANT to anon (first anon-grant)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.submit_client_portal_message\s*\([\s\S]*?LANGUAGE\s+plpgsql\s+SECURITY\s+DEFINER[\s\S]*?SET\s+search_path\s*=\s*public\s*,\s*pg_temp/i.test(src),
    "submit_client_portal_message must be SECURITY DEFINER with pinned search_path"
  );
  assert.ok(
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.submit_client_portal_message\s*\([\s\S]*?\)\s+TO\s+anon\b/i.test(src),
    "submit_client_portal_message must GRANT EXECUTE TO anon (Amendment J — first anon-grant in Branch 2)"
  );
});

test("migration 00074 declares mark_client_portal_message_read as SECURITY DEFINER + pinned search_path + GRANT to anon", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.mark_client_portal_message_read\s*\([\s\S]*?LANGUAGE\s+plpgsql\s+SECURITY\s+DEFINER[\s\S]*?SET\s+search_path\s*=\s*public\s*,\s*pg_temp/i.test(src),
    "mark_client_portal_message_read must be SECURITY DEFINER with pinned search_path"
  );
  assert.ok(
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.mark_client_portal_message_read\s*\([\s\S]*?\)\s+TO\s+anon\b/i.test(src),
    "mark_client_portal_message_read must GRANT EXECUTE TO anon (Amendment J)"
  );
});

// ── token-hashing regression fences (Amendment D + J) ────────────────

test("migration 00074 all 3 RPC bodies use SHA-256 digest for token hashing (Amendment D)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  for (const fn of [
    "create_client_portal_invite",
    "submit_client_portal_message",
    "mark_client_portal_message_read",
  ]) {
    const match = src.match(
      new RegExp(
        `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${fn}\\s*\\([\\s\\S]*?\\$\\$\\s*;`,
        "i"
      )
    );
    assert.ok(match, `could not locate ${fn} function body`);
    assert.ok(
      /encode\s*\(\s*(?:extensions\.)?digest\s*\([^)]*?,\s*'sha256'\s*\)\s*,\s*'hex'\s*\)/i.test(match![0]),
      `${fn} body must hash via encode(digest(<token>, 'sha256'), 'hex') — Amendment D (extensions.digest qualifier permitted; pgcrypto lives in extensions schema on Supabase)`
    );
  }
});

test("migration 00074 create_client_portal_invite generates plaintext via gen_random_bytes(32) — 64-char hex", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.create_client_portal_invite\s*\([\s\S]*?\$\$\s*;/i
  );
  assert.ok(match, "could not locate create_client_portal_invite body");
  assert.ok(
    /encode\s*\(\s*(?:extensions\.)?gen_random_bytes\s*\(\s*32\s*\)\s*,\s*'hex'\s*\)/i.test(match![0]),
    "create_client_portal_invite must generate plaintext via encode(gen_random_bytes(32), 'hex') — 64-char hex; Amendment D longer than org_invites' 24-byte / 48-char convention (extensions.gen_random_bytes qualifier permitted)"
  );
});

test("migration 00074 RPC bodies include sliding-window expires_at extension (Decision #6)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  for (const fn of ["submit_client_portal_message", "mark_client_portal_message_read"]) {
    const match = src.match(
      new RegExp(
        `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${fn}\\s*\\([\\s\\S]*?\\$\\$\\s*;`,
        "i"
      )
    );
    assert.ok(match, `could not locate ${fn} body`);
    assert.ok(
      /expires_at\s*=\s*now\s*\(\s*\)\s*\+\s*interval\s+'90 days'/i.test(match![0]),
      `${fn} body must extend expires_at = now() + interval '90 days' on success (Decision #6 sliding window)`
    );
    assert.ok(
      /last_accessed_at\s*=\s*now\s*\(\s*\)/i.test(match![0]),
      `${fn} body must update last_accessed_at = now() on success`
    );
  }
});

test("migration 00074 anon RPC bodies validate revoked_at IS NULL AND expires_at > now() (timing-oracle defense)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  for (const fn of ["submit_client_portal_message", "mark_client_portal_message_read"]) {
    const match = src.match(
      new RegExp(
        `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${fn}\\s*\\([\\s\\S]*?\\$\\$\\s*;`,
        "i"
      )
    );
    assert.ok(match, `could not locate ${fn} body`);
    assert.ok(
      /revoked_at\s+IS\s+NULL/i.test(match![0]),
      `${fn} must validate revoked_at IS NULL`
    );
    assert.ok(
      /expires_at\s*>\s*now\s*\(\s*\)/i.test(match![0]),
      `${fn} must validate expires_at > now()`
    );
  }
});

// ── COMMENTs (Amendment N + O) ───────────────────────────────────────

test("migration 00074 adds COMMENT ON TABLE for client_portal_access citing Amendment D + R.23 composition", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // SQL string literals use '' to escape '. Match IS 'body'; treating
  // the body as a single-quoted SQL string so embedded semicolons
  // inside the COMMENT prose don't terminate the match prematurely.
  const match = src.match(
    /COMMENT\s+ON\s+TABLE\s+public\.client_portal_access\s+IS\s+'(?:[^']|'')*'\s*;/i
  );
  assert.ok(match, "must COMMENT ON TABLE public.client_portal_access");
  const body = match![0];
  assert.ok(
    /SHA-?256/i.test(body),
    "client_portal_access COMMENT must reference SHA-256 token hashing"
  );
  assert.ok(
    /R\.23/i.test(body),
    "client_portal_access COMMENT must invoke R.23 framing"
  );
});

test("migration 00074 adds COMMENT ON COLUMN for access_token_hash (Amendment D)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.ok(
    /COMMENT\s+ON\s+COLUMN\s+public\.client_portal_access\.access_token_hash\s+IS[\s\S]*?;/i.test(src),
    "must COMMENT ON COLUMN client_portal_access.access_token_hash documenting threat-model + plaintext-never-stored"
  );
});

test("migration 00074 adds COMMENT ON COLUMN for visibility_config (Amendment N)", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /COMMENT\s+ON\s+COLUMN\s+public\.client_portal_access\.visibility_config\s+IS[\s\S]*?;/i
  );
  assert.ok(match, "must COMMENT ON COLUMN visibility_config");
  // Document the 7 expected keys
  for (const key of [
    "show_invoices",
    "show_budget",
    "show_schedule",
    "show_change_orders",
    "show_draws",
    "show_lien_releases",
    "show_daily_logs",
  ]) {
    assert.ok(
      new RegExp(key).test(match![0]),
      `visibility_config COMMENT must document key '${key}'`
    );
  }
});

test("migration 00074 adds COMMENT ON COLUMN for expires_at documenting sliding window", () => {
  const src = readFileSync(MIGRATION, "utf8");
  const match = src.match(
    /COMMENT\s+ON\s+COLUMN\s+public\.client_portal_access\.expires_at\s+IS[\s\S]*?;/i
  );
  assert.ok(match, "must COMMENT ON COLUMN expires_at");
  assert.ok(
    /sliding[- ]window/i.test(match![0]),
    "expires_at COMMENT must label as sliding-window"
  );
  assert.ok(
    /90\s*days?/i.test(match![0]),
    "expires_at COMMENT must reference 90-day window"
  );
});

test("migration 00074 adds COMMENT ON TABLE for client_portal_messages citing append-only + accounting role inclusion", () => {
  const src = readFileSync(MIGRATION, "utf8");
  // Same SQL-string-literal handling as the access COMMENT test.
  const match = src.match(
    /COMMENT\s+ON\s+TABLE\s+public\.client_portal_messages\s+IS\s+'(?:[^']|'')*'\s*;/i
  );
  assert.ok(match, "must COMMENT ON TABLE public.client_portal_messages");
  const body = match![0];
  assert.ok(
    /append[- ]only/i.test(body),
    "client_portal_messages COMMENT must document append-only contract"
  );
  assert.ok(
    /accounting/i.test(body),
    "client_portal_messages COMMENT must reference accounting role inclusion (asymmetric vs access)"
  );
});

test("migration 00074 adds COMMENT ON FUNCTION for all 3 RPCs", () => {
  const src = readFileSync(MIGRATION, "utf8");
  for (const fn of [
    "create_client_portal_invite",
    "submit_client_portal_message",
    "mark_client_portal_message_read",
  ]) {
    assert.ok(
      new RegExp(`COMMENT\\s+ON\\s+FUNCTION\\s+public\\.${fn}\\s*\\(`).test(src),
      `must COMMENT ON FUNCTION public.${fn}`
    );
  }
});

// ── down migration (Amendment L) ─────────────────────────────────────

test("00074.down.sql reverses in strict reverse-dependency order", () => {
  const src = readFileSync(MIGRATION_DOWN, "utf8");

  // 3 functions dropped first (have GRANT dependencies)
  for (const fn of [
    "mark_client_portal_message_read",
    "submit_client_portal_message",
    "create_client_portal_invite",
  ]) {
    assert.ok(
      new RegExp(`DROP\\s+FUNCTION\\s+IF\\s+EXISTS\\s+public\\.${fn}\\s*\\(`, "i").test(src),
      `down must DROP FUNCTION IF EXISTS public.${fn}(...)`
    );
  }

  // Trigger dropped
  assert.ok(
    /DROP\s+TRIGGER\s+IF\s+EXISTS\s+trg_client_portal_access_updated_at\s+ON\s+public\.client_portal_access/i.test(src),
    "down must DROP TRIGGER IF EXISTS trg_client_portal_access_updated_at"
  );

  // 6 policies dropped (3 per table)
  const policyDrops = src.match(/DROP\s+POLICY\s+IF\s+EXISTS\s+\S+\s+ON\s+public\.client_portal_(?:access|messages)/gi);
  assert.ok(
    policyDrops && policyDrops.length === 6,
    `down must DROP all 6 policies (3 per table); found ${policyDrops?.length ?? 0}`
  );

  // RLS disabled on both tables
  assert.ok(
    /ALTER\s+TABLE\s+public\.client_portal_access\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(src),
    "down must DISABLE RLS on client_portal_access"
  );
  assert.ok(
    /ALTER\s+TABLE\s+public\.client_portal_messages\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(src),
    "down must DISABLE RLS on client_portal_messages"
  );

  // 5 indexes dropped
  for (const idx of [
    "idx_client_portal_messages_unread",
    "idx_client_portal_messages_timeline",
    "idx_client_portal_access_email",
    "idx_client_portal_access_org_job",
    "idx_client_portal_access_token_hash",
  ]) {
    assert.ok(
      new RegExp(`DROP\\s+INDEX\\s+IF\\s+EXISTS\\s+(?:public\\.)?${idx}\\b`, "i").test(src),
      `down must DROP INDEX IF EXISTS ${idx}`
    );
  }

  // Both tables dropped (messages first — independent; then access)
  assert.ok(
    /DROP\s+TABLE\s+IF\s+EXISTS\s+public\.client_portal_messages\b/i.test(src),
    "down must DROP TABLE IF EXISTS public.client_portal_messages"
  );
  assert.ok(
    /DROP\s+TABLE\s+IF\s+EXISTS\s+public\.client_portal_access\b/i.test(src),
    "down must DROP TABLE IF EXISTS public.client_portal_access"
  );

  // Order: functions → policies → tables (reverse-dependency)
  const firstFnDropIdx = src.search(
    /DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.(?:mark|submit|create)_client_portal/i
  );
  const firstPolicyDropIdx = src.search(
    /DROP\s+POLICY\s+IF\s+EXISTS\s+\S+\s+ON\s+public\.client_portal_/i
  );
  const tableDropIdx = src.search(
    /DROP\s+TABLE\s+IF\s+EXISTS\s+public\.client_portal_/i
  );
  assert.ok(
    firstFnDropIdx >= 0 && firstPolicyDropIdx >= 0 && tableDropIdx >= 0,
    "down must contain function drops, policy drops, and table drops"
  );
  assert.ok(
    firstFnDropIdx < firstPolicyDropIdx,
    "functions must be dropped BEFORE policies (functions reference tables; policies attached to tables)"
  );
  assert.ok(
    firstPolicyDropIdx < tableDropIdx,
    "policies must be dropped BEFORE tables"
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
